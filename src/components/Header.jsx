import React from 'react';
import { Map, Waves, GitCompare, FileSpreadsheet, FileText, Sun, Moon, User } from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  theme, 
  setTheme,
  onOpenBackendModal,
  backendConfig,
  backendOnline,
  user,
  onLogout
}) {
  return (
    <header className="bg-[#111827] border-b border-slate-800 px-5 py-2.5 flex items-center justify-between z-30 shrink-0">
      {/* Brand Header */}
      <div className="flex items-center space-x-3">
        <div className="bg-blue-600 p-2 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
          {/* Logo bar chart building icon */}
          <div className="flex items-end space-x-1 h-5 w-5">
            <div className="bg-white w-1 h-3 rounded-sm"></div>
            <div className="bg-white w-1 h-5 rounded-sm"></div>
            <div className="bg-white w-1 h-2 rounded-sm"></div>
            <div className="bg-white w-1 h-4 rounded-sm"></div>
          </div>
        </div>
        <div>
          <h1 className="font-extrabold text-lg text-white tracking-tight leading-none">UrbanTwin</h1>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">Simulate Before You Build</p>
        </div>
      </div>

      {/* Main Top Navigation Pills */}
      <nav className="flex items-center space-x-2">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'map'
              ? 'bg-white text-slate-900 shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Map className="w-3.5 h-3.5" />
          <span>Map</span>
        </button>

        <button
          onClick={() => setActiveTab('simulate')}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'simulate'
              ? 'bg-white text-slate-900 shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Waves className="w-3.5 h-3.5" />
          <span>Simulate</span>
        </button>

        <button
          onClick={() => setActiveTab('compare')}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'compare'
              ? 'bg-white text-slate-900 shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          <span>Compare</span>
        </button>

        <button
          onClick={() => setActiveTab('data')}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'data'
              ? 'bg-white text-slate-900 shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Data</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'reports'
              ? 'bg-white text-slate-900 shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Reports</span>
        </button>
      </nav>

      {/* Right User & Theme Controls */}
      <div className="flex items-center space-x-4">
        {/* Backend Status Trigger */}
        <button
          onClick={onOpenBackendModal}
          className={`text-[11px] px-2.5 py-1 rounded-full border font-mono transition ${
            backendConfig.isEnabled && backendOnline
              ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {backendConfig.isEnabled && backendOnline ? 'Flask Connected' : 'Flask Standalone'}
        </button>

        {/* Light/Dark Toggle */}
        <div 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="bg-slate-900 border border-slate-700 p-1 rounded-full flex items-center space-x-1 cursor-pointer"
        >
          <div className={`p-1 rounded-full ${theme === 'light' ? 'bg-amber-400 text-slate-900' : 'text-slate-400'}`}>
            <Sun className="w-3.5 h-3.5" />
          </div>
          <div className={`p-1 rounded-full ${theme === 'dark' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
            <Moon className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Profile Pill */}
        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-xs">
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-200">
            <User className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-slate-200 font-semibold block text-[11px] leading-tight">{user?.name || 'User'}</span>
            <span className="text-[9px] text-slate-400 block leading-none">Authenticated</span>
          </div>
        </div>
        <button onClick={onLogout} className="text-[10px] text-slate-400 hover:text-white">Sign out</button>
      </div>
    </header>
  );
}
