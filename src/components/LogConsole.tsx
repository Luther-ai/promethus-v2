import React, { useRef, useEffect } from 'react';
import { Message, AgentKey, AGENTS } from '../types';

export function LogConsole({
  messages,
  activeAgent,
  open,
  onClose,
  onSaveVault,
  userName
}: {
  messages: Message[];
  activeAgent: AgentKey;
  open: boolean;
  onClose: () => void;
  onSaveVault: () => void;
  userName: string;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, open]);

  return (
    <section className={`panel console fixed z-40 right-6 bottom-6 w-[min(520px,calc(100vw-48px))] h-[min(640px,calc(100vh-48px))] flex flex-col transition-all duration-200 ease-in-out ${open ? 'translate-y-0 opacity-100 visible' : 'translate-y-4 opacity-0 invisible scale-95'}`}>
      <div className="panel-head">
        <span>Chat Log / <span style={{ color: 'var(--cyan)' }}>{AGENTS[activeAgent].name}</span></span>
        <div className="flex items-center gap-4">
          <span>{(messages.filter(m => m.role === 'user').length)} exchanges</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col gap-4 bg-[var(--bg)]" ref={logRef}>
        <div className="bubble max-w-[88%] p-3 border border-dashed rounded-xl text-sm self-center text-center shadow-sm" style={{ borderColor: 'var(--line)', background: 'rgba(53,242,223,0.02)', color: 'var(--muted)' }}>
          <div className="text-[10px] font-bold tracking-wider uppercase mb-1">System</div>
          <div>Round table is quiet. Click a rune to summon an agent, or convene the circle.</div>
        </div>
        
        {messages.map((msg, i) => {
          let align = 'self-center';
          let border = 'var(--line)';
          let bg = 'rgba(53,242,223,0.02)';
          let whoColor = 'var(--muted)';
          let textColor = 'var(--ink)';

          const isSelf = msg.role === 'user' && msg.who === userName;
          const isOtherUser = msg.role === 'user' && msg.who !== userName;

          if (isSelf) {
            align = 'self-end';
            bg = 'rgba(53,242,223,0.08)';
            border = 'var(--cyan)';
            whoColor = 'var(--cyan)';
            textColor = '#fff';
          } else if (isOtherUser) {
            align = 'self-start';
            bg = 'rgba(245,158,11,0.08)';
            border = 'var(--amber)';
            whoColor = 'var(--amber)';
            textColor = '#fff';
          } else if (msg.role === 'error') {
            align = 'self-center';
            border = 'var(--danger)';
            bg = 'rgba(255,107,107,0.1)';
            whoColor = 'var(--danger)';
            textColor = 'var(--danger)';
          } else if (msg.role === 'prometheus') {
            align = 'self-start';
            border = 'rgba(53,242,223,0.3)';
            bg = 'rgba(53,242,223,0.05)';
            whoColor = 'var(--cyan)';
          } else if (msg.role === 'sage') {
            align = 'self-start';
            border = 'rgba(185,139,255,0.3)';
            bg = 'rgba(185,139,255,0.05)';
            whoColor = 'var(--violet)';
          } else if (msg.role === 'forge') {
            align = 'self-start';
            border = 'rgba(255,179,71,0.3)';
            bg = 'rgba(255,179,71,0.05)';
            whoColor = 'var(--amber)';
          } else if (msg.role === 'questioner') {
            align = 'self-start';
            border = 'rgba(124,255,107,0.3)';
            bg = 'rgba(124,255,107,0.05)';
            whoColor = 'var(--green)';
          } else if (msg.role === 'gemini') {
            align = 'self-start';
            border = 'rgba(79,174,255,0.3)';
            bg = 'rgba(79,174,255,0.05)';
            whoColor = 'var(--blue)';
          }

          return (
            <div key={i} className={`bubble max-w-[88%] p-3 border rounded-xl leading-relaxed text-sm shadow-sm ${align}`} style={{ borderColor: border, background: bg, color: textColor }}>
              <div className="text-[10px] font-bold tracking-wider uppercase mb-1" style={{ color: whoColor, textAlign: isSelf ? 'right' : 'left' }}>{msg.who}</div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          );
        })}
      </div>
      
      <div className="flex gap-3 p-4 border-t" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <button className="btn" onClick={onSaveVault}>Save to Vault</button>
      </div>
    </section>
  );
}
