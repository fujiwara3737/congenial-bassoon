import React, { useState, useMemo } from 'react';
import { DocumentItem, DocCategory } from '../types';

interface DashboardHomeProps {
  documents: DocumentItem[];
  onNavigateToChat: () => void;
  onNavigateToDocs: () => void;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ documents, onNavigateToChat, onNavigateToDocs }) => {
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const stats = {
    totalDocs: documents.length,
    preEntry: documents.filter(d => 
      d.category === DocCategory.PRE_ENTRY || 
      d.category === DocCategory.TRAVEL || 
      d.category === DocCategory.ENTRY_ACCEPTANCE
    ).length,
    training: documents.filter(d => 
      d.category === DocCategory.DRIVING_SCHOOL || 
      d.category === DocCategory.LICENSE_CENTER
    ).length,
    support: documents.filter(d => 
      d.category === DocCategory.EMPLOYMENT_SUPPORT || 
      d.category === DocCategory.POST_EMPLOYMENT_SUPPORT
    ).length,
  };

  // Filter and sort documents for the library list
  const libraryDocs = useMemo(() => {
    let docs = [...documents];
    
    // Category Filter
    if (filterCategory) {
      docs = docs.filter(d => d.category === filterCategory);
    }

    // Search Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      docs = docs.filter(d => 
        d.title.toLowerCase().includes(query) ||
        d.content.toLowerCase().includes(query) ||
        d.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort by newest
    return docs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [documents, filterCategory, searchQuery]);

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50">
      <header className="mb-6 md:mb-10 flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">FDSO Knowledge System</h1>
          <p className="text-sm md:text-base text-slate-500 mt-2">
            特定技能（ドライバー）支援業務 専用AIナレッジベース
          </p>
        </div>
        <div className="text-right hidden md:block">
          <div className="text-sm font-semibold text-slate-600">System Status</div>
          <div className="flex items-center justify-end text-emerald-600 text-sm mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            Operational
          </div>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
        <button 
          onClick={onNavigateToChat}
          className="bg-gradient-to-br from-fdso-700 to-fdso-900 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex flex-col items-start relative overflow-hidden group min-h-[160px]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-white/20 transition-all"></div>
          <div className="bg-white/20 p-3 rounded-lg mb-4 backdrop-blur-sm">
            <span className="text-3xl">💬</span>
          </div>
          <h3 className="text-xl font-bold mb-2">対話型マニュアル (AI Assistant)</h3>
          <p className="text-fdso-100 text-sm text-left leading-relaxed">
            社内規定や法的要件について質問してください。<br/>
            <span className="opacity-80 text-xs">※登録データのみに基づいて回答します</span>
          </p>
        </button>

        <button 
          onClick={onNavigateToDocs}
          className="bg-white border border-slate-200 p-6 rounded-2xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1 flex flex-col items-start group min-h-[160px]"
        >
           <div className="bg-emerald-100 p-3 rounded-lg mb-4 group-hover:bg-emerald-200 transition-colors">
            <span className="text-3xl text-emerald-600">📚</span>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">ナレッジ管理・登録</h3>
          <p className="text-slate-500 text-sm text-left leading-relaxed">
            新規ドキュメント、YouTube動画、または <strong className="text-emerald-600">NotebookLM</strong> の共有リンクを追加・管理します。
          </p>
        </button>
      </div>

      {/* Learning Banner */}
      <div 
        onClick={onNavigateToDocs}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 md:p-8 mb-8 text-white shadow-lg cursor-pointer hover:shadow-xl transition-all transform hover:-translate-y-1 relative overflow-hidden group"
      >
        <div className="absolute right-0 top-0 h-full w-2/3 bg-white/5 skew-x-12 translate-x-12 group-hover:translate-x-6 transition-transform duration-700"></div>
        <div className="absolute left-0 bottom-0 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl -ml-10 -mb-10"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-white/20 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Self Study</span>
                    <span className="bg-amber-400 text-amber-900 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider animate-pulse">Recommended</span>
                </div>
                <h3 className="text-xl md:text-3xl font-bold mb-3">データソースを閲覧して学ぶ</h3>
                <p className="text-emerald-50 text-sm md:text-base leading-relaxed max-w-2xl">
                    登録されたマニュアル、最新の法規制、現場のトラブルシューティング事例を直接ブラウジング。<br className="hidden md:inline"/>
                    AIに頼るだけでなく、原文を読み込むことで確実な業務知識を身につけましょう。
                </p>
            </div>
            <div className="bg-white/20 p-4 rounded-full md:mr-4 shrink-0 group-hover:bg-white/30 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 md:w-10 md:h-10">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
            </div>
        </div>
        <div className="mt-4 md:mt-0 md:absolute md:bottom-4 md:right-8 flex items-center text-sm font-semibold text-emerald-100 group-hover:text-white transition-colors">
            <span>ライブラリを開く</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
        </div>
      </div>

      {/* Stats Overview */}
      <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        登録データ状況
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-10">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-fdso-200 transition-colors">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">全ドキュメント</p>
          <p className="text-2xl md:text-3xl font-bold text-slate-800 mt-2">{stats.totalDocs}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-purple-200 transition-colors">
          <p className="text-xs text-purple-500 font-bold uppercase tracking-wider">入国・手続</p>
          <p className="text-2xl md:text-3xl font-bold text-slate-800 mt-2">{stats.preEntry}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-amber-200 transition-colors">
          <p className="text-xs text-amber-500 font-bold uppercase tracking-wider">教習・試験</p>
          <p className="text-2xl md:text-3xl font-bold text-slate-800 mt-2">{stats.training}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors">
          <p className="text-xs text-blue-500 font-bold uppercase tracking-wider">就業支援</p>
          <p className="text-2xl md:text-3xl font-bold text-slate-800 mt-2">{stats.support}</p>
        </div>
      </div>

      {/* Library Section (Replaces Recent Updates) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-bold text-slate-700 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          ナレッジライブラリ
        </h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Search Input */}
           <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-fdso-500 transition-all"
                placeholder="キーワード検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full sm:w-48 p-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:ring-2 focus:ring-fdso-500 outline-none cursor-pointer"
          >
            <option value="">全てのカテゴリ (最新順)</option>
            {Object.values(DocCategory).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8 flex flex-col">
        <div className="max-h-[500px] overflow-y-auto">
          {libraryDocs.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {libraryDocs.map(doc => (
                <div key={doc.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group" onClick={onNavigateToDocs}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200`}>
                        {doc.category}
                      </span>
                      {doc.sourceType === 'notebooklm' && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center">
                          NotebookLM
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{doc.updatedAt.toLocaleDateString()}</span>
                  </div>
                  <h4 className="font-semibold text-slate-800 group-hover:text-fdso-600 transition-colors mb-1">{doc.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{doc.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mb-2 opacity-50">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>条件に一致するナレッジが見つかりません</p>
            </div>
          )}
        </div>
        <div className="bg-slate-50 p-2 text-center border-t border-slate-100 text-xs text-slate-400">
           表示中: {libraryDocs.length} 件
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;