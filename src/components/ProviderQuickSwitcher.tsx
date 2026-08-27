import React, { useState, useEffect, useRef } from 'react';
import { ApiProfile, DEFAULT_PROFILES } from './ApiPanel';
import { storage } from '../storage';

export function ProviderQuickSwitcher({
  activeProfileId,
  onSelectProfile,
  onOpenApiPanel
}: {
  activeProfileId: string | null;
  onSelectProfile: (profile: ApiProfile) => void;
  onOpenApiPanel: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<ApiProfile[]>(DEFAULT_PROFILES);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProfiles();
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProfiles = async () => {
    try {
      const data = await storage.get('api_profiles');
      if (data && data.value) {
        const parsed: ApiProfile[] = JSON.parse(data.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProfiles(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setProfiles(DEFAULT_PROFILES);
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || DEFAULT_PROFILES[0];

  const handleSelect = (profile: ApiProfile) => {
    onSelectProfile(profile);
    setIsOpen(false);
    setToastMessage(`Switched AI Engine to ${profile.name} (${profile.model})`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getProviderBadge = (provider: ApiProfile['provider']) => {
    switch (provider) {
      case 'openrouter':
        return { icon: '🧠', bg: 'bg-purple-950/80 border-purple-500/50 text-purple-300', label: 'OpenRouter' };
      case 'openai':
        return { icon: '🤖', bg: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300', label: 'OpenAI' };
      case 'anthropic':
        return { icon: '🎭', bg: 'bg-amber-950/80 border-amber-500/50 text-amber-300', label: 'Anthropic' };
      case 'gemini':
        return { icon: '⚡', bg: 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300', label: 'Gemini' };
      case 'custom':
        return { icon: '🔌', bg: 'bg-blue-950/80 border-blue-500/50 text-blue-300', label: 'Custom' };
      default:
        return { icon: '⚙', bg: 'bg-slate-800 border-slate-600 text-slate-300', label: 'API' };
    }
  };

  const filteredProfiles = profiles.filter(p => {
    if (selectedFilter === 'all') return true;
    return p.provider === selectedFilter;
  });

  const activeBadge = getProviderBadge(activeProfile.provider);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-[9999] flex items-center gap-2 bg-emerald-950 border border-emerald-500/60 text-emerald-200 px-4 py-2.5 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-bounce text-xs font-mono">
          <span className="text-base">⚡</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Switcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`btn flex items-center gap-2 px-3 py-1.5 rounded-md border font-mono text-xs cursor-pointer transition-all duration-200 ${activeBadge.bg} shadow-md hover:brightness-125`}
        title="Click to switch between AI APIs (OpenRouter, OpenAI, Anthropic, Gemini, Custom)"
      >
        <span className="text-sm">{activeBadge.icon}</span>
        <div className="flex flex-col text-left leading-none">
          <div className="flex items-center gap-1">
            <span className="font-bold text-xs">{activeProfile.name}</span>
            <span className="text-[9px] opacity-75 uppercase tracking-wider bg-black/40 px-1 py-0.2 rounded border border-white/10">
              {activeProfile.provider}
            </span>
          </div>
          <span className="text-[10px] opacity-70 font-mono mt-0.5 max-w-[140px] truncate">
            {activeProfile.model.split('/').pop()}
          </span>
        </div>
        <span className="text-[10px] opacity-60 ml-1">▼</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-slate-900/95 border border-cyan-500/30 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-[999] overflow-hidden">
          {/* Header */}
          <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 text-sm">⚡</span>
              <span className="font-bold text-xs font-mono text-slate-200 tracking-wider">SELECT AI ENGINE</span>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenApiPanel();
              }}
              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              + Manage Keys
            </button>
          </div>

          {/* Provider Filter Chips */}
          <div className="p-2 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono scrollbar-none">
            {['all', 'openrouter', 'openai', 'anthropic', 'gemini', 'custom'].map(filter => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-2 py-1 rounded-md cursor-pointer transition-all uppercase ${
                  selectedFilter === filter
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Profiles List */}
          <div className="max-h-72 overflow-y-auto p-2 space-y-1.5">
            {/* Quick Auto Modes */}
            {selectedFilter === 'all' && (
              <div className="grid grid-cols-2 gap-1.5 pb-1 border-b border-slate-800">
                <button
                  onClick={() => handleSelect({
                    id: 'auto-switch',
                    name: 'Auto Round-Robin Mode',
                    provider: 'openrouter',
                    apiKey: '',
                    model: 'Rotates Providers Per Message'
                  })}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer font-mono text-[11px] flex items-center gap-1.5 ${
                    activeProfileId === 'auto-switch'
                      ? 'bg-rose-950/80 border-rose-500/80 text-rose-200 font-bold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-rose-400 font-bold">🔀</span>
                  <div>
                    <div className="font-semibold text-slate-100 leading-tight">Auto Round-Robin</div>
                    <div className="text-[9px] text-slate-400">Rotates each turn</div>
                  </div>
                </button>

                <button
                  onClick={() => handleSelect({
                    id: 'server-default',
                    name: 'Server Auto Fallback',
                    provider: 'gemini',
                    apiKey: '',
                    model: 'Environment Provider'
                  })}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer font-mono text-[11px] flex items-center gap-1.5 ${
                    activeProfileId === 'server-default' || !activeProfileId
                      ? 'bg-slate-800 border-slate-600 text-slate-100 font-bold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-slate-400 font-bold">🛡️</span>
                  <div>
                    <div className="font-semibold text-slate-200 leading-tight">Server Fallback</div>
                    <div className="text-[9px] text-slate-500">Auto env priority</div>
                  </div>
                </button>
              </div>
            )}

            {filteredProfiles.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-slate-400">
                No profiles matching filter "{selectedFilter}".
              </div>
            ) : (
              filteredProfiles.map(p => {
                const isActive = p.id === activeProfile.id;
                const badge = getProviderBadge(p.provider);
                const hasKey = Boolean(p.apiKey && p.apiKey.trim().length > 0);

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                      isActive
                        ? 'bg-cyan-950/50 border-cyan-500/60 shadow-[0_0_12px_rgba(53,242,223,0.15)]'
                        : 'bg-slate-950/40 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 border ${badge.bg}`}>
                        {badge.icon}
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-xs font-bold truncate ${isActive ? 'text-cyan-200' : 'text-slate-200'}`}>
                            {p.name}
                          </span>
                          {isActive && (
                            <span className="bg-cyan-500 text-slate-950 text-[9px] font-bold px-1.5 py-0.2 rounded font-sans uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 truncate">
                          {p.model}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        hasKey
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                          : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                      }`}>
                        {hasKey ? 'Key Configured' : 'Server/Env Key'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Action */}
          <div className="p-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="text-[10px] text-slate-500">Switch active engine on demand</span>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenApiPanel();
              }}
              className="px-2.5 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-900 text-[11px] font-bold cursor-pointer transition-all"
            >
              Open API Panel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
