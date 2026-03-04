
export enum DocCategory {
  CAMBODIA_INFO = 'カンボジア情報',
  LABOR_CONTRACT = '労働契約関連',
  ENV_PREP = '受入環境整備',
  PRE_ENTRY = '入国前手続',
  TRAVEL = '渡航関係',
  ENTRY_ACCEPTANCE = '入国受入',
  DRIVING_SCHOOL = '教習関係',
  JOINING_ADJUSTMENT = '入社時期調整',
  LICENSE_CENTER = '試験場手続き',
  EMPLOYMENT_SUPPORT = '就業時支援',
  POST_EMPLOYMENT_SUPPORT = '就業後支援'
}

export type SourceType = 'text' | 'url' | 'youtube' | 'pdf' | 'image' | 'notebooklm';

export interface DocumentItem {
  id: string;
  title: string;
  category: DocCategory;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  sourceType?: SourceType;
  sourceUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  CHAT = 'CHAT',
  KNOWLEDGE_BASE = 'KNOWLEDGE_BASE',
  MEETING_SCHEDULER = 'MEETING_SCHEDULER'
}