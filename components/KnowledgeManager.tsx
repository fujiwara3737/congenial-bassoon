import React, { useState, useRef, useEffect } from 'react';
import { DocumentItem, DocCategory, SourceType } from '../types';
import { analyzeSource } from '../services/geminiService';

interface KnowledgeManagerProps {
  documents: DocumentItem[];
  addDocument: (doc: DocumentItem) => void;
  editDocument: (doc: DocumentItem) => void;
  deleteDocument: (id: string) => void;
}

const KnowledgeManager: React.FC<KnowledgeManagerProps> = ({ documents, addDocument, editDocument, deleteDocument }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Voice Input State
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // Filter & Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocCategory | ''>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocCategory>(DocCategory.CAMBODIA_INFO);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  // Source Metadata States
  const [tempSourceType, setTempSourceType] = useState<SourceType>('text');
  const [tempSourceUrl, setTempSourceUrl] = useState<string>('');

  // Source Input Modal
  const [activeSourceMode, setActiveSourceMode] = useState<'url' | 'youtube' | 'notebooklm' | null>(null);
  const [sourceInput, setSourceInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('お使いのブラウザは音声入力をサポートしていません。Google ChromeまたはMicrosoft Edgeをご利用ください。');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      const lastResultIndex = event.results.length - 1;
      const transcript = event.results[lastResultIndex][0].transcript;
      
      setContent(prev => {
         // Append with a newline if there's existing content and it doesn't end with a newline
         const separator = prev.length > 0 && !prev.endsWith('\n') ? '\n' : '';
         return prev + separator + transcript;
      });
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) return;

    if (editingId) {
      // Update existing document
      const existingDoc = documents.find(d => d.id === editingId);
      if (existingDoc) {
        const updatedDoc: DocumentItem = {
          ...existingDoc,
          title,
          category,
          content,
          tags: tags.split(',').map(t => t.trim()).filter(t => t),
          updatedAt: new Date(),
        };
        editDocument(updatedDoc);
      }
    } else {
      // Create new document
      const newDoc: DocumentItem = {
        id: Date.now().toString(),
        title,
        category,
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        sourceType: tempSourceType,
        sourceUrl: tempSourceUrl
      };
      addDocument(newDoc);
    }

    resetForm();
    setIsFormOpen(false);
  };

  const handleDeleteWithConfirm = (id: string) => {
    if (window.confirm('本当にこのナレッジを削除してもよろしいですか？\n削除すると元に戻せません。')) {
      deleteDocument(id);
      if (editingId === id) {
        resetForm();
        setIsFormOpen(false);
      }
    }
  };

  const handleEditClick = (doc: DocumentItem) => {
    setEditingId(doc.id);
    setTitle(doc.title);
    setCategory(doc.category);
    setContent(doc.content);
    setTags(doc.tags.join(', '));
    setTempSourceType(doc.sourceType || 'text');
    setTempSourceUrl(doc.sourceUrl || '');
    
    setIsFormOpen(true);
    document.querySelector('.knowledge-container')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyLink = async (doc: DocumentItem) => {
    if (!doc.sourceUrl) return;
    try {
      await navigator.clipboard.writeText(doc.sourceUrl);
      setCopiedId(doc.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const resetForm = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    setEditingId(null);
    setTitle('');
    setCategory(DocCategory.CAMBODIA_INFO);
    setContent('');
    setTags('');
    setActiveSourceMode(null);
    setSourceInput('');
    setTempSourceType('text');
    setTempSourceUrl('');
  };

  const handleCancel = () => {
    resetForm();
    setIsFormOpen(false);
  };

  // --- Source Handling ---

  const handleManualEntry = () => {
    resetForm();
    setTempSourceType('text');
    setIsFormOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    resetForm();
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = reader.result as string;
        const type = file.type.includes('pdf') ? 'pdf' : 'image';
        
        setTempSourceType(type);

        const result = await analyzeSource(type, base64String, file.type);
        
        setTitle(result.title);
        setContent(result.content);
        setTags(result.tags.join(', '));
        setIsFormOpen(true);
      } catch (error) {
        alert('解析に失敗しました。もう一度お試しください。');
      } finally {
        setIsAnalyzing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlSubmit = async () => {
    if (!sourceInput) return;
    
    setIsAnalyzing(true);
    const currentMode = activeSourceMode;
    // We'll close the modal later after success or failure handling
    
    try {
      let type: SourceType = 'url';
      if (currentMode === 'notebooklm') {
        type = 'notebooklm';
      } else if (currentMode === 'youtube' || sourceInput.includes('youtube.com') || sourceInput.includes('youtu.be')) {
        type = 'youtube';
      }

      // Reset form base first
      resetForm();
      setTempSourceType(type);
      setTempSourceUrl(sourceInput);

      const result = await analyzeSource(type, sourceInput);

      setTitle(result.title);
      setContent(result.content);
      setTags(result.tags.join(', '));
      
      // Finally open the form with populated data
      setIsFormOpen(true);
      setActiveSourceMode(null); // Close modal
    } catch (error) {
      console.error('URL Analysis failed:', error);
      
      // Fallback: If AI fails (common with NotebookLM or auth-walled URLs), 
      // still open the form so user can save the link.
      let type: SourceType = 'url';
      if (currentMode === 'notebooklm') type = 'notebooklm';
      
      resetForm();
      setTempSourceType(type);
      setTempSourceUrl(sourceInput);
      setTitle(type === 'notebooklm' ? 'NotebookLM 共有リンク' : '新規リンク');
      setContent(`URL: ${sourceInput}\n\n(自動解析に失敗しました。内容を手動で入力してください)`);
      setTags('未解析');
      
      setIsFormOpen(true);
      setActiveSourceMode(null);
    } finally {
      setIsAnalyzing(false);
      setSourceInput('');
    }
  };

  const handleSmartPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        alert('クリップボードが空です。');
        return;
      }

      setIsAnalyzing(true);
      resetForm();

      // Check if text is a URL
      const isUrl = /^(http|https):\/\/[^ "]+$/.test(text.trim());

      if (isUrl) {
        const url = text.trim();
        let type: SourceType = 'url';
        
        if (url.includes('notebooklm.google')) {
          type = 'notebooklm';
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
          type = 'youtube';
        }
        
        setTempSourceType(type);
        setTempSourceUrl(url);

        try {
          const result = await analyzeSource(type, url);
          setTitle(result.title);
          setContent(result.content);
          setTags(result.tags.join(', '));
        } catch (error) {
          console.error('URL Analysis failed, falling back to text:', error);
          // Fallback
          setTitle(type === 'notebooklm' ? 'NotebookLM 共有リンク' : 'クリップボードからのリンク');
          setContent(`URL: ${url}\n\n(自動解析失敗 - 手動で詳細を入力してください)`);
          setTags('未解析');
        }
      } else {
        // Regular text
        setTempSourceType('text');
        setTitle('クリップボードからのメモ');
        setContent(text);
      }
      
      setIsFormOpen(true);
    } catch (error) {
      console.error('Paste failed:', error);
      alert('クリップボードの読み取りに失敗しました。ブラウザの許可設定を確認してください。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- UI Helpers ---

  const filteredDocuments = documents.filter(doc => {
    if (selectedCategory && doc.category !== selectedCategory) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const searchTerms = searchQuery.toLowerCase().split(/[\s,]+/).filter(t => t.length > 0);
    return searchTerms.every(term => 
      doc.tags.some(tag => tag.toLowerCase().includes(term)) ||
      doc.title.toLowerCase().includes(term) ||
      doc.category.toLowerCase().includes(term) ||
      doc.content.toLowerCase().includes(term)
    );
  }).sort((a, b) => {
    const dateA = a.updatedAt.getTime();
    const dateB = b.updatedAt.getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const getCategoryColor = (category: DocCategory) => {
    switch (category) {
      case DocCategory.CAMBODIA_INFO:
      case DocCategory.TRAVEL:
      case DocCategory.ENTRY_ACCEPTANCE:
        return 'bg-teal-100 text-teal-800';
      case DocCategory.PRE_ENTRY:
      case DocCategory.LABOR_CONTRACT:
      case DocCategory.ENV_PREP:
        return 'bg-purple-100 text-purple-800';
      case DocCategory.DRIVING_SCHOOL:
      case DocCategory.LICENSE_CENTER:
        return 'bg-amber-100 text-amber-800';
      case DocCategory.JOINING_ADJUSTMENT:
      case DocCategory.EMPLOYMENT_SUPPORT:
      case DocCategory.POST_EMPLOYMENT_SUPPORT:
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getSourceIcon = (type?: SourceType) => {
    switch (type) {
      case 'notebooklm':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" />
              <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
            </svg>
          </div>
        );
      case 'youtube':
        return (
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
            </svg>
          </div>
        );
      case 'url':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S12 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S12 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
        );
      case 'pdf':
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
             </svg>
          </div>
        );
      case 'image':
         return (
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
             </svg>
          </div>
        );
      case 'text':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
          </div>
        );
    }
  };

  const getSourcePlaceholder = () => {
    switch (activeSourceMode) {
      case 'youtube': return "https://www.youtube.com/watch?v=...";
      case 'notebooklm': return "https://notebooklm.google.com/...";
      default: return "https://example.com/...";
    }
  }

  const getSourceTitle = () => {
    switch (activeSourceMode) {
      case 'youtube': return 'YouTube動画を追加';
      case 'notebooklm': return 'NotebookLMを追加';
      default: return 'Webサイトを追加';
    }
  }

  return (
    <div className="knowledge-container h-full overflow-y-auto bg-slate-50 relative">
      {/* Loading Overlay */}
      {isAnalyzing && (
        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-fdso-200 border-t-fdso-600 mb-4"></div>
            <p className="text-fdso-800 font-semibold animate-pulse">AIが資料を解析中...</p>
          </div>
        </div>
      )}

      {/* URL Input Modal */}
      {activeSourceMode && (
        <div className="absolute inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-fade-in-up">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {getSourceTitle()}
            </h3>
            <input
              type="text"
              value={sourceInput}
              onChange={(e) => setSourceInput(e.target.value)}
              placeholder={getSourcePlaceholder()}
              className="w-full p-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-fdso-500 outline-none"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => { setActiveSourceMode(null); setSourceInput(''); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                キャンセル
              </button>
              <button 
                onClick={handleUrlSubmit}
                disabled={!sourceInput}
                className="px-4 py-2 bg-fdso-600 text-white rounded-lg hover:bg-fdso-700 disabled:opacity-50"
              >
                読み込む
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 md:p-8">
        <header className="mb-6 md:mb-8">
          <h2 className="text-2xl font-bold text-slate-800">ソース</h2>
          <p className="text-slate-500 mt-1">
             ナレッジベースに追加する情報源を選択してください。
          </p>
        </header>

        {/* Source Cards (NotebookLM Style) */}
        {!isFormOpen && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-8 md:mb-10">
            {/* Paste Text */}
            <button 
              onClick={handleManualEntry}
              className="flex flex-col items-center justify-center p-3 md:p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-fdso-300 hover:bg-fdso-50 transition-all group h-32"
            >
              <div className="bg-fdso-100 p-3 rounded-full text-fdso-600 mb-2 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">ナレッジメモ</span>
            </button>

            {/* Upload PDF/Image */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-3 md:p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-purple-300 hover:bg-purple-50 transition-all group h-32 relative"
            >
               <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
              />
              <div className="bg-purple-100 p-3 rounded-full text-purple-600 mb-2 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">ファイル読込</span>
              <span className="text-[10px] text-slate-400 mt-1">PDF / 画像 / カメラ</span>
            </button>

            {/* Website */}
            <button 
              onClick={() => setActiveSourceMode('url')}
              className="flex flex-col items-center justify-center p-3 md:p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 hover:bg-blue-50 transition-all group h-32"
            >
              <div className="bg-blue-100 p-3 rounded-full text-blue-600 mb-2 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S12 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S12 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Webサイト</span>
            </button>

            {/* NotebookLM */}
            <button 
              onClick={() => setActiveSourceMode('notebooklm')}
              className="flex flex-col items-center justify-center p-3 md:p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-300 hover:bg-emerald-50 transition-all group h-32"
            >
              <div className="bg-emerald-100 p-3 rounded-full text-emerald-600 mb-2 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" />
                  <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">NotebookLM</span>
            </button>

            {/* YouTube */}
            <button 
              onClick={() => setActiveSourceMode('youtube')}
              className="flex flex-col items-center justify-center p-3 md:p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-red-300 hover:bg-red-50 transition-all group h-32"
            >
              <div className="bg-red-100 p-3 rounded-full text-red-600 mb-2 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">YouTube</span>
            </button>

             {/* Copy from Clipboard (Smart Paste) */}
             <button 
              onClick={handleSmartPaste}
              className="flex flex-col items-center justify-center p-3 md:p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-slate-50 transition-all group h-32"
            >
              <div className="bg-slate-100 p-3 rounded-full text-slate-600 mb-2 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">ペースト</span>
            </button>
          </div>
        )}

        {isFormOpen && (
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-fdso-200 mb-8 animate-fade-in-down ring-2 ring-fdso-100">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <div className="flex items-center space-x-3">
                 {getSourceIcon(tempSourceType)}
                 <h3 className="text-lg font-semibold text-slate-700">
                  {editingId ? 'ナレッジ編集' : '新規登録'}
                 </h3>
              </div>
              {editingId && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-bold">編集中</span>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">タイトル</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-fdso-500 outline-none"
                  placeholder="タイトルを入力"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">カテゴリ</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as DocCategory)}
                  className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-fdso-500 outline-none"
                >
                  {Object.values(DocCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {tempSourceUrl && (
              <div className="mb-4 bg-slate-50 p-2 rounded border border-slate-200 text-xs text-slate-500 break-all flex items-center">
                 <span className="font-bold mr-2">SOURCE:</span> {tempSourceUrl}
              </div>
            )}
            
            <div className="mb-4 relative">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-600">
                  内容 <span className="text-xs text-fdso-500 ml-2 md:inline hidden">※具体的な手順や「〇〇の時は△△する」といった形式がAIにとって学習しやすいです。</span>
                </label>
                <button
                  onClick={toggleRecording}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                    isRecording 
                      ? 'bg-red-100 text-red-600 ring-2 ring-red-400 animate-pulse' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title="音声入力"
                >
                   {isRecording ? (
                     <>
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                      録音中...
                     </>
                   ) : (
                     <>
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                         <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                         <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                       </svg>
                       音声入力
                     </>
                   )}
                </button>
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-md h-64 md:h-96 focus:ring-2 focus:ring-fdso-500 outline-none font-mono text-sm leading-relaxed"
                placeholder="内容を入力してください..."
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-600 mb-1">タグ（カンマ区切り）</label>
              <input
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-fdso-500 outline-none"
                placeholder="安全指導, 現場メモ, 悪天候"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between gap-4 mt-6 border-t pt-4">
               {editingId ? (
                 <button
                    onClick={() => handleDeleteWithConfirm(editingId)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center justify-center sm:justify-start"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    削除
                 </button>
               ) : (
                 <div className="hidden sm:block"></div>
               )}
               <div className="flex space-x-3 justify-end">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  className={`px-6 py-2 text-white rounded-lg font-medium shadow-sm transition-colors ${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-fdso-600 hover:bg-fdso-700'}`}
                >
                  {editingId ? '上書き保存' : '登録'}
                </button>
               </div>
            </div>
          </div>
        )}

        {/* Filter & Search Section */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl shadow-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-fdso-500 focus:border-transparent transition-all"
                placeholder="キーワード検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="w-1/2 sm:w-48">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as DocCategory | '')}
                  className="w-full px-2 md:px-4 py-3 border border-slate-200 rounded-xl shadow-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-fdso-500 focus:border-transparent appearance-none cursor-pointer text-sm"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                >
                  <option value="">全カテゴリ</option>
                  {Object.values(DocCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="w-1/2 sm:w-32">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                  className="w-full px-2 md:px-4 py-3 border border-slate-200 rounded-xl shadow-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-fdso-500 focus:border-transparent appearance-none cursor-pointer text-sm"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                >
                  <option value="newest">新しい順</option>
                  <option value="oldest">古い順</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || selectedCategory) && (
            <div className="flex flex-wrap gap-2 items-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
              <span className="text-sm font-medium text-slate-500 mr-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1">
                  <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
                </svg>
                絞り込み中:
              </span>
              
              {selectedCategory && (
                <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center shadow-sm border ${getCategoryColor(selectedCategory)}`}>
                  カテゴリ: {selectedCategory}
                  <button 
                    onClick={() => setSelectedCategory('')} 
                    className="ml-2 hover:bg-black/10 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </span>
              )}

              {searchQuery && (
                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-medium flex items-center border border-slate-200 shadow-sm">
                  検索語: {searchQuery}
                  <button 
                    onClick={() => setSearchQuery('')} 
                    className="ml-2 hover:bg-slate-200 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </span>
              )}
              
              <button 
                onClick={() => { setSearchQuery(''); setSelectedCategory(''); }}
                className="text-xs text-fdso-600 hover:text-fdso-800 hover:underline ml-auto font-medium"
              >
                クリア
              </button>
            </div>
          )}
        </div>

        {/* Document List - Grid Layout like NotebookLM Sources */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map(doc => (
            <div key={doc.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-64 overflow-hidden relative">
              <div className="p-4 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2">
                    {getSourceIcon(doc.sourceType)}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getCategoryColor(doc.category)} truncate max-w-[100px]`}>
                      {doc.category}
                    </span>
                  </div>
                   <div className="flex space-x-1 absolute top-2 right-2 bg-white rounded-full p-1 shadow-sm border border-slate-100 z-10">
                      {/* Copy Link Button */}
                      {doc.sourceUrl && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCopyLink(doc); }}
                          className="p-1.5 text-slate-400 hover:text-blue-500 rounded-full hover:bg-blue-50 transition-colors"
                          title="リンクをコピー"
                        >
                           {copiedId === doc.id ? (
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-500">
                               <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                             </svg>
                           ) : (
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                             </svg>
                           )}
                        </button>
                      )}
                      <button 
                        onClick={() => handleEditClick(doc)}
                        className="p-1.5 text-slate-400 hover:text-amber-500 rounded-full hover:bg-amber-50"
                        title="編集"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleDeleteWithConfirm(doc.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50"
                        title="削除"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                   </div>
                </div>
                
                <h3 className="text-base font-bold text-slate-800 mb-2 line-clamp-2 leading-tight min-h-[2.5rem]">{doc.title}</h3>
                
                <div className="flex-1 relative overflow-hidden">
                   <p className="text-xs text-slate-500 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                    {doc.content}
                  </p>
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent"></div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex -space-x-1 overflow-hidden">
                     {/* Placeholder for "shared" users or tags looking like small avatars */}
                     {doc.tags.slice(0, 3).map((tag, i) => (
                       <span key={i} className="inline-block px-2 py-0.5 bg-slate-100 text-[10px] text-slate-500 rounded-full border border-white">
                         #{tag}
                       </span>
                     ))}
                  </div>
                  <span className="text-[10px] text-slate-400">{doc.updatedAt.toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredDocuments.length === 0 && (
              <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-20 bg-white rounded-lg border border-dashed border-slate-300">
                  <p className="text-slate-400">
                    {(searchQuery || selectedCategory) 
                      ? `条件に一致するドキュメントは見つかりませんでした。` 
                      : 'ナレッジがありません。上の「ソース」から情報を追加してください。'}
                  </p>
                  {(searchQuery || selectedCategory) && (
                      <button 
                          onClick={() => {setSearchQuery(''); setSelectedCategory('');}}
                          className="mt-2 text-fdso-600 hover:underline text-sm"
                      >
                          フィルターを解除
                      </button>
                  )}
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeManager;