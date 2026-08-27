import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { CustomAgentConfig, AgentKey, AgentPersona } from '../types';
import { getCustomAgents } from '../lib/agentBuilderStore';

interface QrCodeModalProps {
  open: boolean;
  onClose: () => void;
  activePersonas?: Record<AgentKey, AgentPersona>;
}

export function QrCodeModal({
  open,
  onClose,
  activePersonas
}: QrCodeModalProps) {
  const [contentMode, setContentMode] = useState<'app_url' | 'agent' | 'personas' | 'custom'>('app_url');
  const [appUrl, setAppUrl] = useState('');
  const [customText, setCustomText] = useState('');
  const [availableAgents, setAvailableAgents] = useState<CustomAgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [qrTheme, setQrTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppUrl(window.location.href);
    }
    const agents = getCustomAgents();
    setAvailableAgents(agents);
    if (agents.length > 0) {
      setSelectedAgentId(agents[0].id);
    }
  }, [open]);

  // Generate QR Code image whenever options change
  useEffect(() => {
    if (!open) return;

    const generate = async () => {
      let payload = appUrl || window.location.href;

      if (contentMode === 'app_url') {
        payload = appUrl || window.location.href;
      } else if (contentMode === 'agent') {
        const agent = availableAgents.find((a) => a.id === selectedAgentId);
        if (agent) {
          payload = JSON.stringify({
            type: 'BUILDENGINE_AGENT',
            agent: {
              name: agent.name,
              roleTitle: agent.roleTitle,
              glyph: agent.glyph,
              color: agent.color,
              intro: agent.intro,
              systemPrompt: agent.systemPrompt,
              capabilities: agent.capabilities
            }
          });
        }
      } else if (contentMode === 'personas' && activePersonas) {
        payload = JSON.stringify({
          type: 'BUILDENGINE_PERSONAS',
          personas: activePersonas
        });
      } else if (contentMode === 'custom') {
        payload = customText || appUrl;
      }

      if (!payload) return;

      try {
        const isDarkTheme = qrTheme === 'dark';
        const url = await QRCode.toDataURL(payload, {
          width: 400,
          margin: 2,
          color: {
            dark: isDarkTheme ? '#38bdf8' : '#030712',
            light: isDarkTheme ? '#020617' : '#ffffff'
          },
          errorCorrectionLevel: 'M'
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error('Failed to generate QR code:', err);
      }
    };

    generate();
  }, [open, contentMode, appUrl, customText, selectedAgentId, availableAgents, activePersonas, qrTheme]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(appUrl || window.location.href);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `buildengine-qr-code-${Date.now()}.png`;
    a.click();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-2xl overflow-hidden text-[var(--ink)]"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(56, 189, 248, 0.1)'
        }}
      >
        {/* HEADER */}
        <header className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between shrink-0 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg text-cyan-300 border border-cyan-500/40 bg-cyan-950/60">
              📱
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Scan to Connect Device</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                    Mobile & Tablet
                  </span>
                </h2>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Scan this QR code with your phone or tablet camera to open BuildEngine instantly
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent hover:border-[var(--line)] transition-colors cursor-pointer"
            title="Close QR Code Modal"
          >
            ✕
          </button>
        </header>

        {/* PAYLOAD MODE SELECTOR */}
        <div className="px-6 py-2.5 border-b border-[var(--line)] bg-slate-900/30 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setContentMode('app_url')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              contentMode === 'app_url'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <span>🌐</span>
            <span>Open App URL</span>
          </button>

          <button
            onClick={() => setContentMode('agent')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              contentMode === 'agent'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <span>⚙</span>
            <span>Share Agent</span>
          </button>

          <button
            onClick={() => setContentMode('personas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              contentMode === 'personas'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <span>🎭</span>
            <span>Boardroom Config</span>
          </button>

          <button
            onClick={() => setContentMode('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              contentMode === 'custom'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <span>✍</span>
            <span>Custom Prompt</span>
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* EXTRA OPTIONS ACCORDING TO CONTENT MODE */}
          {contentMode === 'agent' && availableAgents.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-white mb-1">
                Select Agent to Encode into QR Code
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                aria-label="Select agent to encode into QR code"
                className="w-full bg-slate-950 border border-[var(--line)] text-xs text-white rounded-lg p-2.5 outline-none font-mono"
              >
                {availableAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.roleTitle}
                  </option>
                ))}
              </select>
            </div>
          )}

          {contentMode === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-white mb-1">
                Custom Text or Prompt to Encode
              </label>
              <textarea
                rows={3}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type or paste prompt text to encode into QR code..."
                className="w-full bg-slate-950 border border-[var(--line)] text-xs text-white rounded-lg p-2.5 outline-none font-mono"
              />
            </div>
          )}

          {/* QR CODE CARD */}
          <div className="flex flex-col items-center justify-center space-y-4 py-2">
            <div 
              className={`p-5 sm:p-6 rounded-2xl shadow-2xl border-4 transition-all ${
                qrTheme === 'dark' 
                  ? 'bg-slate-950 border-cyan-500/40 shadow-[0_0_35px_rgba(56,189,248,0.2)]' 
                  : 'bg-white border-cyan-400/60 shadow-[0_0_35px_rgba(255,255,255,0.15)]'
              }`}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="BuildEngine Scannable QR Code"
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain mx-auto block"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-800 font-mono text-xs">
                  Generating QR Code...
                </div>
              )}

              <div 
                className={`mt-3 text-center text-[11px] font-mono font-bold tracking-tight ${
                  qrTheme === 'dark' ? 'text-cyan-300' : 'text-slate-900'
                }`}
              >
                BuildEngine Prometheus · Live Instance
              </div>
            </div>

            {/* THEME TOGGLE & CONTRAST */}
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span>QR Style:</span>
              <button
                onClick={() => setQrTheme('light')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  qrTheme === 'light'
                    ? 'bg-white text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                High Contrast (White)
              </button>
              <button
                onClick={() => setQrTheme('dark')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  qrTheme === 'dark'
                    ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Cyber Dark (Cyan)
              </button>
            </div>
          </div>

          {/* URL & ACTION BUTTONS */}
          <div className="space-y-3 max-w-lg mx-auto">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/80 border border-[var(--line)]">
              <span className="text-xs font-mono text-cyan-300 truncate flex-1 text-left px-2">
                {appUrl || window.location.href}
              </span>
              <button
                onClick={handleCopyUrl}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shrink-0 cursor-pointer"
              >
                {copySuccess ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleDownloadQr}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
              >
                <span>💾 Download QR (PNG)</span>
              </button>
              <a
                href={appUrl || window.location.href}
                target="_blank"
                rel="noreferrer"
                className="flex-1 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 font-semibold text-xs transition-colors flex items-center justify-center gap-2 border border-purple-500/40 text-center"
              >
                <span>↗ Open New Window</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
