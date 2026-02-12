import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardHome from './components/DashboardHome';
import ChatInterface from './components/ChatInterface';
import KnowledgeManager from './components/KnowledgeManager';
import { ViewMode, DocumentItem } from './types';
import { storageService } from './services/storageService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial Data Load from IndexedDB
  useEffect(() => {
    const loadData = async () => {
      try {
        const docs = await storageService.getAll();
        setDocuments(docs);
      } catch (error) {
        console.error("Failed to load documents:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const addDocument = async (doc: DocumentItem) => {
    await storageService.save(doc);
    setDocuments(prev => [doc, ...prev]);
  };

  const editDocument = async (updatedDoc: DocumentItem) => {
    await storageService.save(updatedDoc);
    setDocuments(prev => prev.map(doc => 
      doc.id === updatedDoc.id ? updatedDoc : doc
    ));
  };

  const deleteDocument = async (id: string) => {
    await storageService.delete(id);
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const handleSidebarNavigation = (view: ViewMode) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center bg-slate-50">
           <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-fdso-200 border-t-fdso-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">Loading Database...</p>
           </div>
        </div>
      );
    }

    switch (currentView) {
      case ViewMode.DASHBOARD:
        return (
          <DashboardHome 
            documents={documents}
            onNavigateToChat={() => setCurrentView(ViewMode.CHAT)}
            onNavigateToDocs={() => setCurrentView(ViewMode.KNOWLEDGE_BASE)}
          />
        );
      case ViewMode.CHAT:
        return <ChatInterface documents={documents} />;
      case ViewMode.KNOWLEDGE_BASE:
        return (
          <KnowledgeManager 
            documents={documents} 
            addDocument={addDocument}
            editDocument={editDocument}
            deleteDocument={deleteDocument}
          />
        );
      default:
        return <div>View not found</div>;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-800">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar 
        currentView={currentView} 
        setView={handleSidebarNavigation} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 h-full overflow-hidden relative flex flex-col w-full">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="font-bold text-slate-800 text-lg">FDSO Knowledge</span>
          <div className="w-8"></div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;