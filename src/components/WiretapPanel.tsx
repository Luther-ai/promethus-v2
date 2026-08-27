import React, { useRef, useEffect, useState } from 'react';
import { AgentKey, AGENTS } from '../types';

export interface InterAgentChat {
  id: string;
  timestamp: string;
  sender: string;
  recipient: string;
  content: string;
  taskContext: string;
  type: 'whisper' | 'consensus' | 'system' | 'system-alert';
}

export function WiretapPanel({
  open,
  onClose,
  chats,
  onClearChats,
  onInjectMessage
}: {
  open: boolean;
  onClose: () => void;
  chats: InterAgentChat[];
  onClearChats: () => void;
  onInjectMessage: (text: string) => void;
}) {
  const [filterContext, setFilterContext] = useState<string>('all');
  const [filterSender, setFilterSender] = useState<string>('all');
  const [intercomMsg, setIntercomMsg] = useState<string>('');
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, open]);

  if (!open) return null;

  // Extract unique contexts for filtering
  const contexts = Array.from(new Set(chats.map(c => c.taskContext)));

  const filteredChats = chats.filter(chat => {
    const matchCtx = filterContext === 'all' || chat.taskContext === filterContext;
    const matchSend = filterSender === 'all' || chat.sender === filterSender || chat.recipient === filterSender;
    return matchCtx && matchSend;
  });

  const getAgentColor = (key: string) => {
    if (key === 'prometheus') return 'var(--cyan)';
    if (key === 'sage') return 'var(--violet)';
    if (key === 'forge') return 'var(--amber)';
    if (key === 'questioner') return 'var(--green)';
    if (key === 'gemini') return '#69b8ff';
    if (key === 'sam') return '#ec4899';
    return 'var(--muted)';
  };

  const getAgentGlyph = (key: string) => {
    if (key === 'prometheus') return 'P';
    if (key === 'sage') return 'S';
    if (key === 'forge') return 'F';
    if (key === 'questioner') return 'Q';
    if (key === 'gemini') return 'G';
    if (key === 'sam') return '💼';
    return '🤖';
  };

  const getAgentName = (key: string) => {
    if (key === 'all') return 'ALL AGENTS';
    return AGENTS[key as AgentKey]?.name || key.toUpperCase();
  };

  const handleSendIntercom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intercomMsg.trim()) return;
    onInjectMessage(intercomMsg);
    setIntercomMsg('');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[85vh] bg-[#0a1112] border border-[var(--line)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--ink)]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono text-xl font-bold shadow-[0_0_15px_rgba(53,242,223,0.15)]">
              📡
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Roundtable Wiretap & Private Feed
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                  BACKEND CHAT LOG
                </span>
              </h2>
              <p className="text-xs text-[var(--muted)]">
                Live monitoring of multi-agent sub-routines, private whispers, and backend consensus loops.
              </p>
            </div>
          </div>

          <button
            className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Filters bar */}
        <div className="px-6 py-3 border-b border-[var(--line)] bg-[var(--bg)] flex flex-wrap gap-4 items-center justify-between text-xs">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-[var(--muted)] font-mono text-[10px] uppercase">Channel:</span>
              <select
                className="bg-black/40 border border-[var(--line)] rounded-md px-2.5 py-1 text-white outline-none focus:border-[var(--cyan)] transition-colors"
                value={filterContext}
                onChange={e => setFilterContext(e.target.value)}
              >
                <option value="all">All Channels</option>
                {contexts.map(ctx => (
                  <option key={ctx} value={ctx}>{ctx}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[var(--muted)] font-mono text-[10px] uppercase">Agent:</span>
              <select
                className="bg-black/40 border border-[var(--line)] rounded-md px-2.5 py-1 text-white outline-none focus:border-[var(--cyan)] transition-colors"
                value={filterSender}
                onChange={e => setFilterSender(e.target.value)}
              >
                <option value="all">All Peers</option>
                {Object.keys(AGENTS).map(k => (
                  <option key={k} value={k}>{AGENTS[k as AgentKey].name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="px-2.5 py-1 rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-[11px] font-mono transition-all cursor-pointer uppercase"
            onClick={onClearChats}
          >
            Purge Logs
          </button>
        </div>

        {/* Chat Stream View */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-950/20 via-[#070c0d] to-[#040708]">
          {filteredChats.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[var(--muted)] gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl animate-pulse">
                📻
              </div>
              <div>
                <p className="text-sm font-bold text-slate-300">Wiretap channel quiet</p>
                <p className="text-xs max-w-sm mt-1">Submit prompts to the main desk to generate live backend consensus logs, or inject an intercom message below.</p>
              </div>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const senderColor = getAgentColor(chat.sender);
              const recipientColor = getAgentColor(chat.recipient);
              const isSystem = chat.type === 'system';

              return (
                <div
                  key={chat.id}
                  className={`flex flex-col p-3.5 rounded-xl border transition-all ${
                    isSystem 
                      ? 'border-dashed border-cyan-500/20 bg-cyan-950/10' 
                      : 'border-[var(--line)] bg-[#0d1618]/60 hover:bg-[#0d1618]/80'
                  }`}
                >
                  {/* Top line metadata */}
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-mono tracking-wider font-bold text-[var(--cyan)] uppercase">
                        {chat.taskContext}
                      </span>
                      <span className="text-[10px] text-[var(--muted)] font-mono">
                        {new Date(chat.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                      chat.type === 'whisper' ? 'bg-purple-500/10 text-purple-400' :
                      chat.type === 'consensus' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-cyan-500/10 text-cyan-400'
                    }`}>
                      {chat.type}
                    </span>
                  </div>

                  {/* Message dialogue content */}
                  <div className="flex gap-3">
                    {/* Avatars */}
                    {!isSystem && (
                      <div className="flex items-center shrink-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold font-mono text-sm shadow-sm"
                          style={{
                            color: senderColor,
                            border: `1px solid ${senderColor}`,
                            background: `${senderColor}10`
                          }}
                        >
                          {getAgentGlyph(chat.sender)}
                        </div>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Name tags */}
                      {!isSystem && (
                        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold mb-1">
                          <span style={{ color: senderColor }}>{getAgentName(chat.sender)}</span>
                          <span className="text-slate-500">➜</span>
                          <span style={{ color: recipientColor }}>{getAgentName(chat.recipient)}</span>
                        </div>
                      )}

                      {/* Content */}
                      <p className={`text-xs leading-relaxed text-slate-100 ${isSystem ? 'font-mono text-[var(--cyan)] italic' : 'font-serif'}`}>
                        {chat.content}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Intercom Direct Injector Form */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--panel)]">
          <form onSubmit={handleSendIntercom} className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-sm tracking-wider shrink-0" title="Intercom Broadcaster">
              🎙️
            </div>
            <input
              type="text"
              className="flex-1 p-2.5 bg-black/40 border border-[var(--line)] rounded-xl text-xs outline-none text-white placeholder-slate-500 focus:border-[var(--cyan)] transition-colors"
              placeholder="Inject direct directive to secret Boardroom Intercom... (e.g. 'Audit budget state now!')"
              value={intercomMsg}
              onChange={e => setIntercomMsg(e.target.value)}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--cyan)] text-slate-950 font-bold text-xs rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer"
            >
              Broadcast Injector
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
