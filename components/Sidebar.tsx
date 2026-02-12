import React from 'react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, isOpen, onClose }) => {
  const menuItems = [
    { id: ViewMode.DASHBOARD, label: 'ダッシュボード', icon: '📊' },
    { id: ViewMode.CHAT, label: '対話型マニュアル', icon: '💬' },
    { id: ViewMode.KNOWLEDGE_BASE, label: 'ナレッジ管理', icon: '📚' },
  ];

  return (
    <div className={`
      fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col h-full shadow-xl transition-transform duration-300 ease-in-out
      md:translate-x-0 md:static md:shadow-none md:z-auto
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="p-6 border-b border-slate-700 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-wider text-fdso-300">FDSO</h1>
          <p className="text-xs text-slate-400 mt-1">特定技能支援ナレッジベース</p>
        </div>
        <button 
          onClick={onClose}
          className="md:hidden p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
        >
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentView === item.id
                ? 'bg-fdso-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700 shrink-0">
        <div className="flex items-center space-x-3 text-sm text-slate-400">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>System Online</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;