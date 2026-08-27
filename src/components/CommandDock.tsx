import React, { KeyboardEvent, useState, useRef, useEffect } from 'react';
import { AgentKey, AGENTS, ORDER, getAgentConfig } from '../types';

export function CommandDock({
  listening,
  speaking,
  voiceState,
  level,
  onMicClick,
  onSend,
  seats
}: {
  listening: boolean;
  speaking: boolean;
  voiceState: string;
  level: number;
  onMicClick: () => void;
  onSend: (text: string) => void;
  seats?: AgentKey[];
}) {
  const [text, setText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableSeats = seats && seats.length > 0 ? seats : ORDER;

  const isSlash = text.startsWith('/');
  const filterTerm = isSlash ? text.slice(1).trim().toLowerCase() : '';

  const matchedAgents = isSlash
    ? availableSeats
        .map(key => ({ key, config: AGENTS[key] || getAgentConfig(key) }))
        .filter(({ key, config }) => {
          if (!filterTerm) return true;
          return (
            key.toLowerCase().includes(filterTerm) ||
            config.name.toLowerCase().includes(filterTerm) ||
            config.role.toLowerCase().includes(filterTerm)
          );
        })
    : [];

  useEffect(() => {
    setSelectedIndex(0);
  }, [filterTerm]);

  const selectAgent = (key: AgentKey) => {
    setText(`/${key} `);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText('');
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isSlash && matchedAgents.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % matchedAgents.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + matchedAgents.length) % matchedAgents.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && text.trim() === `/${filterTerm}`)) {
        e.preventDefault();
        const selected = matchedAgents[selectedIndex];
        if (selected) {
          selectAgent(selected.key);
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="absolute left-1/2 bottom-8 -translate-x-1/2 w-[min(780px,calc(100%-30px))] flex flex-col items-center gap-4 z-10">
      <div className="flex flex-col items-center gap-2">
        <button 
          className={`mic w-14 h-14 rounded-full border border-[var(--line)] bg-[rgba(5,18,15,0.8)] text-[var(--muted)] text-2xl transition-all flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl
          ${listening ? 'on' : ''} ${speaking && !listening ? 'interrupt' : ''} hover:border-[var(--cyan)] hover:text-[var(--cyan)] hover:scale-105`}
          onClick={onMicClick}
          title="Toggle speech recognition"
        >
          🎙
        </button>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] font-bold text-[var(--muted)] tracking-wider uppercase">{voiceState}</span>
          <span className="w-16 h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden level-bar border border-[var(--line)]">
            <i style={{ width: `${level}%` }}></i>
          </span>
        </div>
      </div>

      <div className="relative w-full">
        {/* Slash Command Autocomplete Popover */}
        {isSlash && showSuggestions && matchedAgents.length > 0 && (
          <div className="absolute bottom-full mb-2 left-0 right-0 bg-slate-900/95 border border-[var(--cyan)]/40 backdrop-blur-xl rounded-xl p-2 shadow-[0_-10px_30px_rgba(0,0,0,0.9)] max-h-56 overflow-y-auto flex flex-col gap-1 z-20">
            <div className="text-[10px] font-mono tracking-wider text-[var(--cyan)] uppercase px-2 py-1 border-b border-slate-800 flex justify-between items-center">
              <span>Direct AI Target (Slash Commands)</span>
              <span className="text-[9px] text-slate-400">Click or press Tab/Enter to select</span>
            </div>
            {matchedAgents.map(({ key, config }, idx) => {
              const isSelected = idx === selectedIndex;
              const color = config.color || '#35f2df';
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectAgent(key)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-cyan-500/20 border border-cyan-500/40 text-white' : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <span
                    className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ color, border: `1px solid ${color}`, background: 'rgba(255,255,255,0.03)' }}
                  >
                    {config.glyph || '⚡'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">/{key}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({config.name})</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{config.role}</div>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                    Target Only
                  </span>
                </button>
              );
            })}
          </div>
        )}
        
        <div className="w-full h-12 flex items-center gap-3 px-4 border border-[var(--line)] bg-[rgba(5,18,15,0.85)] rounded-xl focus-within:border-[var(--cyan)] focus-within:shadow-[0_0_15px_var(--cyan-glow)] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <span className="text-[var(--cyan)] font-bold opacity-90">ᛗ</span>
          <input 
            ref={inputRef}
            value={text}
            onChange={e => {
              setText(e.target.value);
              setShowSuggestions(e.target.value.startsWith('/'));
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type / (AI name) to speak directly to a specific AI..." 
            className="flex-1 min-w-0 border-0 outline-none bg-transparent text-[var(--ink)] text-sm placeholder-[var(--muted)] font-mono"
            autoComplete="off" 
          />
          <button 
            onClick={handleSend}
            className="w-8 h-8 rounded-md bg-[rgba(53,242,223,0.1)] border border-[var(--cyan)] text-[var(--cyan)] flex items-center justify-center hover:bg-[var(--cyan)] hover:text-[#000] transition-colors cursor-pointer shadow-[0_0_10px_var(--cyan-glow)]"
            title="Send"
          >
            ↵
          </button>
        </div>
      </div>
    </div>
  );
}

