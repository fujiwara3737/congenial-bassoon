import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import { DocumentItem, ChatMessage, DocCategory } from '../types';
import { SYSTEM_INSTRUCTION_PREFIX } from '../constants';

const getClient = () => {
  // API key must be obtained exclusively from the environment variable process.env.API_KEY
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is missing in environment variables.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const formatContext = (documents: DocumentItem[]): string => {
  if (documents.length === 0) return "現在、社内ナレッジベースに登録されているドキュメントはありません。";

  let context = "【社内ナレッジコンテキスト】\n以下の情報を参照して回答してください。\n\n";

  // Group by category for better organization
  const grouped = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<DocCategory, DocumentItem[]>);

  Object.entries(grouped).forEach(([category, docs]) => {
    context += `### カテゴリ: ${category}\n`;
    docs.forEach(doc => {
      context += `---
タイトル: ${doc.title}
更新日: ${doc.updatedAt.toLocaleDateString()}
タグ: ${doc.tags.join(', ')}
内容:
${doc.content}
---\n`;
    });
    context += "\n";
  });

  return context;
};

export const sendMessageToGemini = async (
  message: string,
  history: ChatMessage[],
  documents: DocumentItem[]
): Promise<string> => {
  try {
    const ai = getClient();
    const knowledgeContext = formatContext(documents);
    
    const fullSystemInstruction = `${SYSTEM_INSTRUCTION_PREFIX}\n\n${knowledgeContext}`;

    // Convert ChatMessage history to Gemini Content format
    // Exclude error messages and ensure proper role mapping if needed
    const previousHistory = history
      .filter(msg => !msg.isError)
      .map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

    const chat: Chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      history: previousHistory,
      config: {
        systemInstruction: fullSystemInstruction,
        temperature: 0.1, // Lower temperature strictly for RAG
      },
    });
    
    const response: GenerateContentResponse = await chat.sendMessage({ 
      message: message 
    });

    return response.text || "申し訳ありません。回答を生成できませんでした。";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "システムエラーが発生しました。APIキーを確認するか、しばらく経ってから再度お試しください。";
  }
};

const cleanJsonString = (text: string): string => {
  let cleaned = text.trim();
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned;
};

export const analyzeSource = async (
  type: 'image' | 'pdf' | 'url' | 'youtube' | 'text' | 'notebooklm',
  data: string,
  mimeType?: string
): Promise<{ title: string; content: string; tags: string[] }> => {
  const ai = getClient();
  
  let prompt = "";
  let parts: any[] = [];
  let tools: any[] = [];

  const commonPrompt = `
    Analyze the provided input and extract the key information to create a knowledge base entry for a logistics/driver support company (FDSO).
    1. Title: Create a concise, professional title.
    2. Content: Summarize the content in detail, focusing on actionable steps, rules, or important information for drivers/staff. If it's an image of a document, transcribe the important text. If it's a URL, summarize the key points.
    3. Tags: Generate 3-5 relevant tags (e.g., '安全指導', '入管法', '車両点検').
    
    IMPORTANT: Return ONLY valid JSON.
  `;

  if (type === 'text') {
    prompt = `${commonPrompt}\n\nInput Text:\n${data}`;
    parts = [{ text: prompt }];
  } else if (type === 'image' || type === 'pdf') {
    prompt = commonPrompt;
    if (!mimeType) throw new Error("MimeType required for file input");
    
    // Clean base64 string
    const base64Data = data.split(',')[1] || data;
    
    parts = [
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      },
      { text: prompt }
    ];
  } else if (type === 'url' || type === 'youtube' || type === 'notebooklm') {
    const typeLabel = type === 'notebooklm' ? 'NotebookLM Shared Link' : 'URL';
    prompt = `${commonPrompt}\n\nAnalyze this ${typeLabel}: ${data}`;
    parts = [{ text: prompt }];
    // Use Google Search for grounding URLs
    tools = [{ googleSearch: {} }];
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: parts
      },
      config: {
        tools: tools,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            tags: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from AI");

    try {
      const cleanedText = cleanJsonString(resultText);
      return JSON.parse(cleanedText);
    } catch (parseError) {
      console.warn("JSON Parse Failed:", parseError, resultText);
      return {
        title: "解析結果 (手動確認推奨)",
        content: resultText,
        tags: ["要確認", "解析エラー"]
      };
    }

  } catch (error) {
    console.error("Analysis Error:", error);
    
    // Fallback for NotebookLM or inaccessible URLs
    if (type === 'notebooklm' || type === 'url') {
      return {
        title: type === 'notebooklm' ? "NotebookLM ドキュメント" : "Webリンク",
        content: `URL: ${data}\n\n※自動解析に失敗したか、アクセス権限が必要なコンテンツです。\nリンク先の内容を確認し、ここに手動で要約やメモを追記してください。`,
        tags: ["要追記", type === 'notebooklm' ? "NotebookLM" : "URL"]
      };
    }

    throw new Error("AIによる解析に失敗しました。");
  }
};