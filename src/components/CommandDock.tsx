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
      .filter(({ key, config }) => !filterTerm || key.toLowerCase().includes(filterTerm) || config.name.toLowerCase().includes(filterTerm) || config.role.toLowerCase().includes(filterTerm))
    : [];

  useEffect(() => setSelectedIndex(0), [filterTerm]);

  const selectAgent = (key: AgentKey) => {
    setText(`/${key} `);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    setShowSuggestions(false);
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
        if (selected) selectAgent(selected.key);
        return;
      }
    }
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="command-dock absolute left-1/2 bottom-6 -translate-x-1/2 w-[min(820px,calc(100%-28px))] z-30">
      <div className="command-meta">
        <div className="command-state">
          <span className={`command-led ${listening ? 'is-live' : speaking ? 'is-speaking' : ''}`} />
          <span>{voiceState}</span>
        </div>
        <span className="command-hint">/agent targets · Enter sends · Ctrl+K command palette</span>
      </div>

      <div className="command-shell">
        <button
          type="button"
          className={`mic mic-orb ${listening ? 'on' : ''} ${speaking && !listening ? 'interrupt' : ''}`}
          onClick={onMicClick}
          title={speaking && !listening ? 'Interrupt speech and listen' : 'Toggle speech recognition'}
          aria-label={speaking && !listening ? 'Interrupt speech and listen' : 'Toggle speech recognition'}
        >
          <span className="mic-core">{listening ? '◉' : '◎'}</span>
          <span className="mic-ring" />
          {listening && <span className="mic-level" style={{ ['--level' as string]: `${Math.max(8, Math.min(100, level))}%` }} />}
        </button>

        <div className="command-input-wrap">
          <div className="command-prefix" aria-hidden="true">PROMETHEUS <span>//</span></div>
          {isSlash && showSuggestions && matchedAgents.length > 0 && (
            <div className="slash-popover" role="listbox" aria-label="AI agent targets">
              <div className="slash-head"><span>DIRECT TARGET</span><small>↑ ↓ navigate · Tab select</small></div>
              {matchedAgents.map(({ key, config }, idx) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === selectedIndex}
                  key={key}
                  className={`slash-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={() => selectAgent(key)}
                >
                  <span className="slash-glyph" style={{ color: config.color || 'var(--cyan)', borderColor: config.color || 'var(--cyan)' }}>{config.glyph || '◈'}</span>
                  <span><b>/{key}</b><small>{config.name} · {config.role}</small></span>
                </button>
              ))}
            </div>
          )}
          <input
            ref={inputRef}
            value={text}
            onChange={e => { setText(e.target.value); setShowSuggestions(e.target.value.startsWith('/')); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask Prometheus anything…"
            className="command-input"
            autoComplete="off"
            aria-label="Command input"
          />
          <span className="command-caret" aria-hidden="true" />
        </div>

        <div className="audio-meter" aria-label={`Input level ${Math.round(level)} percent`}>
          {Array.from({ length: 12 }).map((_, i) => (
            <i key={i} style={{ opacity: level > (i + 1) * 7 ? 1 : 0.22 }} />
          ))}
        </div>

        <button type="button" className="send-command" onClick={handleSend} title="Send command" aria-label="Send command">
          <span>↗</span>
        </button>
      </div>
    </div>
  );
}
