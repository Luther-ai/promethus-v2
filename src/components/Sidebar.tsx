import React from 'react';
import { AgentKey, AGENTS, ORDER, AgentPersona, getAgentConfig } from '../types';

export function Sidebar({
  open,
  onClose,
  activeAgent,
  onSelectAgent,
  mode,
  setMode,
  logCount,
  onOpenLog,
  onOpenVault,
  onOpenConnectors,
  onOpenApi,
  onOpenPersonas,
  onOpenBuilder,
  onOpenQrCode,
  onOpenBudget,
  onOpenGmail,
  onOpenOrchestrator,
  onOpenWiretap,
  personas,
  seats
}: {
  open: boolean;
  onClose: () => void;
  activeAgent: AgentKey;
  onSelectAgent: (key: AgentKey) => void;
  mode: 'SINGLE' | 'ROUND TABLE';
  setMode: (mode: 'SINGLE' | 'ROUND TABLE') => void;
  logCount: number;
  onOpenLog: () => void;
  onOpenVault: () => void;
  onOpenConnectors: () => void;
  onOpenApi: () => void;
  onOpenPersonas?: () => void;
  onOpenBuilder?: () => void;
  onOpenQrCode?: () => void;
  onOpenBudget?: () => void;
  onOpenGmail?: () => void;
  onOpenOrchestrator?: () => void;
  onOpenWiretap?: () => void;
  personas?: Record<AgentKey, AgentPersona>;
  seats?: AgentKey[];
}) {
  const seatsList = seats && seats.length > 0 ? seats : ORDER;

  return (
    <>
      <div 
        className={`fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm transition-all duration-200 ease-in-out ${open ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={onClose}
      ></div>
      <aside className={`fixed right-0 top-16 bottom-0 w-[300px] max-w-[88vw] z-[80] flex flex-col bg-[var(--panel)] text-[var(--ink)] border-l border-[var(--line)] shadow-2xl transition-transform duration-200 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="flex justify-between items-center shrink-0 p-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--cyan)] font-bold text-xl" style={{ border: '1px solid var(--cyan)', boxShadow: 'inset 0 0 10px rgba(53,242,223,0.2)' }}>B</div>
            <span className="font-semibold text-lg tracking-tight display text-[#fff]">BuildEngine</span>
          </div>
          <button className="drawer-close md:hidden" onClick={onClose}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <nav className="flex flex-col gap-2">
            <button className={`btn w-full justify-start ${mode === 'ROUND TABLE' ? 'active' : ''}`} onClick={() => setMode('ROUND TABLE')}>
              <div className="w-4 h-4 rounded-full border-2 border-current opacity-50"></div>
              Convene the Circle
            </button>
            <button className="btn w-full justify-between" onClick={onOpenLog}>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border border-current opacity-50 rounded-sm"></div>
                Chat Log
              </div>
              <span className="bg-[rgba(53,242,223,0.1)] px-2 py-0.5 rounded text-xs font-bold text-[var(--cyan)]">{logCount}</span>
            </button>
            <button className="btn w-full justify-start" onClick={onOpenVault}>
              <div className="w-4 h-4 border border-current opacity-50 rounded-sm"></div>
              Vault
            </button>
            <button className="btn w-full justify-start" onClick={onOpenConnectors}>
              <div className="w-4 h-4 border border-current opacity-50 rounded-sm"></div>
              Connectors
            </button>
            <button className="btn w-full justify-start text-[var(--cyan)] border-[rgba(53,242,223,0.3)] hover:border-[var(--cyan)]" onClick={onOpenApi}>
              <div className="w-4 h-4 rounded-sm flex items-center justify-center font-bold text-xs">⚡</div>
              API & Models Config
            </button>
            {onOpenBudget && (
              <button className="btn w-full justify-start text-amber-300 border-amber-500/30 hover:border-amber-400" onClick={onOpenBudget}>
                <div className="w-4 h-4 rounded-sm flex items-center justify-center font-bold text-xs">📊</div>
                Budget Watcher & Tokens
              </button>
            )}
            {onOpenPersonas && (
              <button className="btn w-full justify-start text-emerald-300 border-emerald-500/30 hover:border-emerald-400" onClick={onOpenPersonas}>
                <div className="w-4 h-4 rounded-sm flex items-center justify-center font-bold text-xs">🎭</div>
                Agent Personas & Roles
              </button>
            )}
            {onOpenBuilder && (
              <button className="btn w-full justify-start text-purple-300 border-purple-500/30 hover:border-purple-400" onClick={onOpenBuilder}>
                <div className="w-4 h-4 rounded-sm flex items-center justify-center font-bold text-xs">⚙</div>
                AI Builder & Trainer (Jarvis)
              </button>
            )}
            {onOpenQrCode && (
              <button className="btn w-full justify-start text-cyan-300 border-cyan-500/30 hover:border-cyan-400" onClick={onOpenQrCode}>
                <div className="w-4 h-4 rounded-sm flex items-center justify-center font-bold text-xs">📱</div>
                Scan QR Code (Mobile)
              </button>
            )}
            {onOpenGmail && (
              <button className="btn w-full justify-start text-red-400 border-red-500/30 hover:border-red-400" onClick={onOpenGmail}>
                <div className="w-4 h-4 rounded-sm flex items-center justify-center font-bold text-xs">✉</div>
                Gmail Workspace
              </button>
            )}
            {onOpenOrchestrator && (
              <button className="btn w-full justify-start text-cyan-400 border-cyan-500/30 hover:border-cyan-400" onClick={onOpenOrchestrator}>
                <div className="w-4 h-4 rounded-sm flex items-center justify-center font-bold text-xs">🌿</div>
                Task Trees & Orchestrator
              </button>
            )}
            {onOpenWiretap && (
              <button className="btn w-full justify-start text-indigo-400 border-indigo-500/30 hover:border-indigo-400" onClick={onOpenWiretap}>
                <div className="w-4 h-4 rounded-sm flex items-center justify-center font-bold text-xs">📡</div>
                AI Boardroom Wiretap
              </button>
            )}
            <button className={`btn w-full justify-start ${mode === 'SINGLE' ? 'active' : ''}`} onClick={() => setMode('SINGLE')}>
              <div className="w-4 h-4 rounded-full border-2 border-current opacity-50"></div>
              Single Agent
            </button>
          </nav>

          <div className="mt-6">
          <div className="text-[10px] font-bold tracking-widest text-[var(--muted)] uppercase mb-3 px-2 flex justify-between items-center">
            <span>Agents & Roles</span>
            <span className="text-[9px] text-[var(--cyan)] font-mono">{seatsList.length} SEATS ACTIVE</span>
          </div>
          <div className="flex flex-col gap-2">
            {seatsList.map((key) => {
              const a = AGENTS[key] || getAgentConfig(key);
              const roleTitle = personas?.[key]?.roleTitle || a.role;
              const isActive = activeAgent === key;
              const colorVar = a.color || (
                key === 'prometheus' ? 'var(--cyan)' : 
                key === 'sage' ? 'var(--violet)' : 
                key === 'forge' ? 'var(--amber)' : 
                key === 'questioner' ? 'var(--green)' : 'var(--blue)'
              );
              
              return (
                <div 
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border`}
                  style={{ 
                    borderColor: isActive ? 'var(--line)' : 'transparent',
                    background: isActive ? 'rgba(53,242,223,0.04)' : 'transparent'
                  }}
                  onClick={() => onSelectAgent(key)}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg" style={{ color: colorVar, border: `1px solid ${colorVar}`, background: `rgba(255,255,255,0.02)` }}>{a.glyph || '⚡'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate text-white">{a.name}</div>
                    <div className="text-[10px] text-[var(--muted)] truncate font-mono">{roleTitle}</div>
                  </div>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--green)', boxShadow: '0 0 10px var(--green)' }}></span>
                </div>
              );
            })}
          </div>
        </div>
        </div>

        <div className="mt-auto p-4 border-t border-[var(--line)] shrink-0 bg-[var(--panel)]">
          <div className="text-[10px] font-bold tracking-widest text-[var(--muted)] uppercase mb-3 px-2">System State</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-[rgba(53,242,223,0.03)] border border-[var(--line)] rounded-lg">
              <span className="block text-[var(--muted)] text-[9px] tracking-wider uppercase mb-1">STT</span>
              <b className="block text-sm text-[var(--cyan)]">READY</b>
            </div>
            <div className="p-3 bg-[rgba(53,242,223,0.03)] border border-[var(--line)] rounded-lg">
              <span className="block text-[var(--muted)] text-[9px] tracking-wider uppercase mb-1">TTS</span>
              <b className="block text-sm text-[var(--cyan)]">ONLINE</b>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
