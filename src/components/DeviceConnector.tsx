import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { BreakroomArcade2D } from './BreakroomArcade2D';
import { DarumaArt } from './art/DarumaArt';
import { OniMaskArt } from './art/OniMaskArt';
import { GuardianShishiArt } from './art/GuardianShishiArt';

interface DeviceConnectorProps {
  open: boolean;
  onClose: () => void;
  onClearAllSharedMessages: () => void;
  collaboratorCount: number;
  userName: string;
  onChangeUserName: (name: string) => void;
  sharedAppUrl?: string;
  breakroomMessages: any[];
  onSendBreakroomMessage: (content: string) => void;
  onClearBreakroomMessages: () => void;
}

export function DeviceConnector({
  open,
  onClose,
  onClearAllSharedMessages,
  collaboratorCount,
  userName,
  onChangeUserName,
  sharedAppUrl,
  breakroomMessages,
  onSendBreakroomMessage,
  onClearBreakroomMessages
}: DeviceConnectorProps) {
  const [activeTab, setActiveTab] = useState<'breakroom' | 'arcade2d' | 'connector'>('breakroom');
  const [appUrl, setAppUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [qrTheme, setQrTheme] = useState<'dark' | 'light'>('dark');
  const [chatInput, setChatInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = sharedAppUrl || (typeof window !== 'undefined' ? window.location.href : '');
    setAppUrl(url);
  }, [sharedAppUrl, open]);

  useEffect(() => {
    if (!open || !appUrl) return;

    const generateQr = async () => {
      try {
        const isDarkTheme = qrTheme === 'dark';
        const dataUrl = await QRCode.toDataURL(appUrl, {
          width: 240,
          margin: 1,
          color: {
            dark: isDarkTheme ? '#ffffff' : '#020404',
            light: isDarkTheme ? '#020404' : '#ffffff'
          },
          errorCorrectionLevel: 'M'
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('Failed to generate device QR code:', err);
      }
    };

    generateQr();
  }, [open, appUrl, qrTheme]);

  // Scroll to bottom of chat when messages update
  useEffect(() => {
    if (activeTab === 'breakroom') {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [breakroomMessages, activeTab]);

  const handleCopyLink = () => {
    if (!appUrl) return;
    navigator.clipboard.writeText(appUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    onSendBreakroomMessage(chatInput.trim());
    setChatInput('');
  };

  const sendQuickAction = (emoji: string, text: string) => {
    onSendBreakroomMessage(`${emoji} *${text}*`);
  };

  const insertMention = (agentName: string) => {
    setChatInput((prev) => `${agentName} ${prev}`.trim() + ' ');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl flex flex-col rounded-2xl bg-[#060a0c] border border-white/15 shadow-2xl overflow-hidden text-slate-100"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 50px rgba(255, 255, 255, 0.08)',
          height: activeTab === 'arcade2d' ? '650px' : '620px',
          maxHeight: '92vh'
        }}
      >
        {/* HEADER WITH SUMI-E WOODCUT ART */}
        <header className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/20 bg-white/5 shadow-inner">
              {activeTab === 'arcade2d' ? (
                <span className="text-xl">⛩️</span>
              ) : activeTab === 'breakroom' ? (
                <DarumaArt size={30} expression="zen" />
              ) : (
                <span className="text-xl">📱</span>
              )}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wider font-['Cinzel'] flex items-center gap-2">
                {activeTab === 'arcade2d' 
                  ? 'Neo-Edo 2D Breakroom Arcade' 
                  : activeTab === 'breakroom'
                  ? 'Co-Pilot Tea Room & AI Lounge' 
                  : 'Multi-Device Co-Pilot Hub'}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {activeTab === 'arcade2d'
                  ? 'Mini-games: Daruma Catch, Dojo Reflex Duel & Spirit Pong.'
                  : activeTab === 'breakroom'
                  ? 'Talk directly to specific agents (@Sage, @Forge, @Prometheus).'
                  : 'QR sync and live multi-screen collaboration.'}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-colors cursor-pointer text-sm font-bold"
            title="Close"
          >
            ✕
          </button>
        </header>

        {/* 3-WAY NAVIGATION TABS */}
        <div className="flex border-b border-white/10 bg-black/50 p-1 shrink-0 gap-1">
          <button
            onClick={() => setActiveTab('breakroom')}
            className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'breakroom'
                ? 'bg-amber-950/40 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>🍵 Tea Room Chat</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTab('arcade2d')}
            className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'arcade2d'
                ? 'bg-red-950/40 text-red-300 border border-red-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>⛩️ 2D Mini-Games</span>
            <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 text-[9px]">NEW</span>
          </button>

          <button
            onClick={() => setActiveTab('connector')}
            className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'connector'
                ? 'bg-cyan-950/40 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>🔗 QR & Devices</span>
            <span className="text-[10px] opacity-75 font-mono">({collaboratorCount})</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* TAB 1: 2D ARCADE */}
          {activeTab === 'arcade2d' ? (
            <BreakroomArcade2D onClose={onClose} userName={userName} />
          ) : activeTab === 'connector' ? (
            /* TAB 2: DEVICE CONNECTOR */
            <div className="p-5 space-y-4 overflow-y-auto max-h-full">
              {/* REAL-TIME SYNC STATUS */}
              <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 tracking-wider font-mono uppercase flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Multi-Device Mirror Active
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-cyan-500/10 text-cyan-200 text-[10px] font-mono border border-cyan-500/30 font-bold">
                    {collaboratorCount} {collaboratorCount === 1 ? 'Device' : 'Devices'} Connected
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  Prompts, builder state, and breakroom mini-games are synced real-time across all active browser windows.
                </p>
              </div>

              {/* USER PROFILE NAME */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Co-Pilot Display Moniker
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => onChangeUserName(e.target.value)}
                    placeholder="Enter moniker..."
                    className="flex-1 px-3 py-2 bg-black/60 border border-white/15 text-sm text-white rounded-xl outline-none focus:border-cyan-400 transition-colors font-mono"
                  />
                  <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-cyan-300 flex items-center shrink-0">
                    👤 Active Mon
                  </div>
                </div>
              </div>

              {/* SHARE INVITE LINK */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Invite Link
                </label>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-black/70 border border-white/15">
                  <span className="text-xs font-mono text-cyan-300 truncate flex-1 text-left px-1.5 select-all">
                    {appUrl}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="px-3.5 py-1 rounded-lg bg-white text-black hover:bg-slate-200 font-bold text-xs font-mono transition-all shrink-0 cursor-pointer"
                  >
                    {copySuccess ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* SCAN QR */}
              <div className="flex flex-col items-center justify-center space-y-2 pt-1">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Scan QR with Phone or Tablet
                </span>

                <div 
                  className={`p-3 rounded-xl border transition-all duration-300 ${
                    qrTheme === 'dark' 
                      ? 'bg-black border-white/30 shadow-lg' 
                      : 'bg-white border-white/60 shadow-lg'
                  }`}
                >
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Scannable QR Code"
                      className="w-36 h-36 object-contain mx-auto block"
                    />
                  ) : (
                    <div className="w-36 h-36 flex items-center justify-center text-slate-400 font-mono text-xs">
                      Generating...
                    </div>
                  )}
                </div>

                {/* THEME TOGGLE */}
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setQrTheme('dark')}
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all uppercase ${
                      qrTheme === 'dark' ? 'bg-white text-black' : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    Dark Inks
                  </button>
                  <button
                    onClick={() => setQrTheme('light')}
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all uppercase ${
                      qrTheme === 'light' ? 'bg-white text-black' : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    Washi Paper
                  </button>
                </div>
              </div>

              {/* PURGE LOGS */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-slate-200">Log Purge</h4>
                  <p className="text-[10px] text-slate-400 font-mono">Clear shared cross-device message logs.</p>
                </div>
                <button
                  onClick={onClearAllSharedMessages}
                  className="px-3 py-1.5 rounded-lg border border-red-500/40 hover:bg-red-500/20 text-red-300 text-[10px] font-mono uppercase font-bold cursor-pointer"
                >
                  Purge Shared Log
                </button>
              </div>
            </div>
          ) : (
            /* TAB 3: BREAKROOM TEA ROOM & SELECTIVE AI SUMMONING */
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#040708]">
              {/* SUMMON SPECIFIC AGENT QUICK SELECTOR BAR */}
              <div className="px-4 py-2 border-b border-white/10 bg-black/60 flex items-center gap-2 overflow-x-auto shrink-0">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold shrink-0">
                  Direct Summon:
                </span>
                <button
                  onClick={() => insertMention('@Prometheus')}
                  className="px-2 py-0.5 rounded-md bg-red-950/40 border border-red-500/40 text-red-300 text-[10px] font-mono hover:bg-red-900/60 transition-colors flex items-center gap-1 shrink-0"
                >
                  👹 @Prometheus
                </button>
                <button
                  onClick={() => insertMention('@Forge')}
                  className="px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-500/40 text-amber-300 text-[10px] font-mono hover:bg-amber-900/60 transition-colors flex items-center gap-1 shrink-0"
                >
                  🦁 @Forge
                </button>
                <button
                  onClick={() => insertMention('@Sage')}
                  className="px-2 py-0.5 rounded-md bg-purple-950/40 border border-purple-500/40 text-purple-300 text-[10px] font-mono hover:bg-purple-900/60 transition-colors flex items-center gap-1 shrink-0"
                >
                  🧘 @Sage
                </button>
                <button
                  onClick={() => insertMention('@Questioner')}
                  className="px-2 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono hover:bg-emerald-900/60 transition-colors flex items-center gap-1 shrink-0"
                >
                  🎭 @Questioner
                </button>
              </div>

              {/* CHILL CHAT SCROLL AREA */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {breakroomMessages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const isSystem = msg.role === 'system';
                  
                  let borderCol = 'border-white/10 bg-white/5 text-slate-200';
                  let prefix = '🍵';
                  let avatar = null;

                  if (isSystem) {
                    borderCol = 'border-amber-500/30 bg-amber-950/20 text-amber-200';
                    prefix = '🔔 NOTIFICATION';
                  } else if (isUser) {
                    borderCol = 'border-cyan-500/40 bg-cyan-950/30 text-cyan-100';
                    prefix = '📱 CO-PILOT';
                  } else if (msg.role === 'prometheus') {
                    borderCol = 'border-red-500/30 bg-red-950/25 text-red-200';
                    prefix = '👹 PROMETHEUS';
                    avatar = <OniMaskArt size={20} glowColor="#ff3838" />;
                  } else if (msg.role === 'sage') {
                    borderCol = 'border-purple-500/30 bg-purple-950/25 text-purple-200';
                    prefix = '🧘 SAGE';
                    avatar = <DarumaArt size={18} expression="zen" glowColor="#c084fc" />;
                  } else if (msg.role === 'forge') {
                    borderCol = 'border-amber-500/30 bg-amber-950/25 text-amber-200';
                    prefix = '🦁 FORGE';
                    avatar = <GuardianShishiArt size={18} glowColor="#fbbf24" title="FORGE" />;
                  } else if (msg.role === 'questioner') {
                    borderCol = 'border-emerald-500/30 bg-emerald-950/25 text-emerald-200';
                    prefix = '🎭 QUESTIONER';
                    avatar = <DarumaArt size={18} expression="fierce" glowColor="#4ade80" />;
                  } else if (msg.role === 'gemini') {
                    borderCol = 'border-sky-500/30 bg-sky-950/25 text-sky-200';
                    prefix = '✨ GEMINI';
                    avatar = <DarumaArt size={18} expression="mystic" glowColor="#38bdf8" />;
                  }

                  return (
                    <div 
                      key={msg.id}
                      className={`p-3.5 rounded-2xl border text-xs leading-relaxed max-w-[85%] transition-all ${
                        isUser ? 'ml-auto text-right' : 'mr-auto text-left'
                      } ${borderCol}`}
                    >
                      <div className={`flex items-center gap-1.5 font-mono text-[9px] uppercase font-bold mb-1.5 ${isUser ? 'justify-end text-cyan-300' : 'text-slate-400'}`}>
                        {avatar}
                        <span>{prefix}</span>
                        <span>•</span>
                        <span>{msg.who || 'CO-PILOT'}</span>
                        <span className="opacity-60 ml-1">
                          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="font-mono break-words whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* QUICK TEA ROOM TOASTS */}
              <div className="px-4 py-2 border-t border-white/10 bg-black/40 flex flex-wrap gap-1.5 items-center shrink-0">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight mr-1">Toast:</span>
                <button 
                  onClick={() => sendQuickAction('🍵', 'pours fresh Gyokuro green tea for the table')}
                  className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer font-mono"
                >
                  🍵 Green Tea
                </button>
                <button 
                  onClick={() => sendQuickAction('🍶', 'toasts a warm flask of Junmai Daiginjo sake')}
                  className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer font-mono"
                >
                  🍶 Warm Sake
                </button>
                <button 
                  onClick={() => sendQuickAction('🍡', 'shares a plate of sweet tri-color Dango')}
                  className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer font-mono"
                >
                  🍡 Dango
                </button>
                <button 
                  onClick={() => setActiveTab('arcade2d')}
                  className="px-2.5 py-0.5 rounded bg-red-950/40 border border-red-500/40 text-[10px] text-red-300 hover:text-white hover:bg-red-900/60 transition-colors flex items-center gap-1 cursor-pointer font-mono ml-auto font-bold"
                >
                  ⛩️ Launch 2D Game
                </button>
              </div>

              {/* INPUT BOX WITH PROMPT TRIGGER */}
              <form onSubmit={handleSendChat} className="p-3.5 border-t border-white/10 flex gap-2 shrink-0 bg-black/70">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Chat or summon an agent (e.g. "@Sage what's your take?")...`}
                  className="flex-1 px-3.5 py-2 bg-black/60 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono transition-all"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold font-mono uppercase transition-all cursor-pointer shadow-md shrink-0"
                >
                  Send
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Clear tea room chatter logs?')) {
                      onClearBreakroomMessages();
                    }
                  }}
                  className="px-2.5 py-2 bg-white/5 hover:bg-red-500/20 border border-white/10 text-slate-400 hover:text-red-300 rounded-xl text-xs font-bold font-mono uppercase transition-all cursor-pointer shrink-0"
                  title="Clear chatter logs"
                >
                  🧹
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
