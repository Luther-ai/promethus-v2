import React from 'react';
import { AgentKey, AGENTS, ORDER, AgentPersona, SpeakerState, getAgentConfig } from '../types';

type Props = {
  activeAgent: AgentKey;
  coreState: string;
  coreText: string;
  transcript: string;
  agentStates: Record<AgentKey, string>;
  speakerState?: SpeakerState;
  onSelectAgent: (key: AgentKey) => void;
  personas?: Record<AgentKey, AgentPersona>;
  seats?: AgentKey[];
};

const FALLBACK_COLORS: Record<string, string> = {
  prometheus: '#4cecff',
  sage: '#9b8cff',
  forge: '#ffb84d',
  questioner: '#6dffb6',
  gemini: '#6fa8ff',
  sam: '#ff72c6',
};

export function CoreRing({
  activeAgent,
  coreState,
  coreText,
  transcript,
  agentStates,
  speakerState,
  onSelectAgent,
  personas,
  seats
}: Props) {
  const seatsList = seats && seats.length > 0 ? seats : ORDER;
  const currentSpeakerId = speakerState?.agentId || activeAgent;
  const active = AGENTS[currentSpeakerId] || getAgentConfig(currentSpeakerId);
  const activeRole = personas?.[currentSpeakerId]?.roleTitle || active.role;
  const audioLevel = Math.max(0, Math.min(100, speakerState?.audioLevel || 0));
  const status = speakerState?.status || (coreState === 'thinking' ? 'thinking' : coreState === 'listening' ? 'listening' : 'idle');
  const activeColor = active.color || FALLBACK_COLORS[currentSpeakerId] || '#4cecff';

  const stateLabel = status === 'speaking'
    ? `${active.name} // SPEAKING`
    : status === 'thinking'
      ? `${active.name} // PROCESSING`
      : status === 'listening'
        ? 'VOICE LINK // LISTENING'
        : 'CORE // STANDBY';

  return (
    <section className="stage hud-stage" aria-label="Prometheus AI command core">
      <div className="hud-corner hud-corner-tl" />
      <div className="hud-corner hud-corner-tr" />
      <div className="hud-corner hud-corner-bl" />
      <div className="hud-corner hud-corner-br" />

      <div className="hud-readout hud-readout-left" aria-hidden="true">
        <span>VOICE LINK</span>
        <strong>{status === 'listening' ? 'LIVE' : 'READY'}</strong>
        <small>STT / TTS CHANNEL</small>
      </div>
      <div className="hud-readout hud-readout-right" aria-hidden="true">
        <span>NEURAL CORE</span>
        <strong>{status === 'thinking' ? 'BUSY' : 'NOMINAL'}</strong>
        <small>ROUND TABLE {seatsList.length} NODES</small>
      </div>

      <div className="reactor-halo reactor-halo-a" />
      <div className="reactor-halo reactor-halo-b" />
      <div className="reactor-scan" />

      <div className="circle-container hud-core-layout">
        <div className="hud-grid" aria-hidden="true" />
        <div className="ring r1" />
        <div className="ring r2" />
        <div className="ring r3" />
        <div className="ring r4" />
        <div className="ring r5" />

        <div className="orbital-arc arc-one" />
        <div className="orbital-arc arc-two" />
        <div className="orbital-arc arc-three" />

        <div className="orbital-label label-top">PROMETHEUS / COMMAND CORE</div>
        <div className="orbital-label label-bottom">ENCRYPTED LINK · LOCAL UI CHANNEL</div>

        <div className="orbit-node-layer">
          {seatsList.map((key, i) => {
            const agent = AGENTS[key] || getAgentConfig(key);
            const color = agent.color || FALLBACK_COLORS[key] || '#4cecff';
            const isActive = activeAgent === key;
            const isSpeaking = speakerState?.agentId === key;
            const nodeState = agentStates[key] || 'idle';
            const angle = i * (360 / Math.max(1, seatsList.length));

            return (
              <button
                type="button"
                key={key}
                className={`agent-node ${isActive ? 'is-active' : ''} ${isSpeaking ? 'is-speaking' : ''} ${nodeState === 'thinking' ? 'is-thinking' : ''}`}
                style={{
                  ['--angle' as string]: `${angle}deg`,
                  ['--agent-color' as string]: color,
                  ['--delay' as string]: `${i * 180}ms`,
                }}
                onClick={() => onSelectAgent(key)}
                aria-label={`${agent.name}, ${personas?.[key]?.roleTitle || agent.role}${isActive ? ', selected' : ''}`}
                aria-pressed={isActive}
              >
                <span className="agent-node-glyph">{agent.glyph || '◈'}</span>
                <span className="agent-node-line" />
                <span className="agent-node-text">
                  <b>{agent.name}</b>
                  <small>{personas?.[key]?.roleTitle || agent.role}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div
          className={`core-center ${coreState || ''} hud-reactor`}
          style={{
            ['--core-color' as string]: activeColor,
            ['--audio' as string]: `${audioLevel}%`,
          }}
        >
          <div className="core-energy" />
          <div className="core-inner-ring" />
          <div className="core-crosshair" aria-hidden="true"><span /><i /></div>

          <div className="core-status">
            <span className="status-led" />
            <span>{stateLabel}</span>
          </div>

          <div className="core-monogram" aria-hidden="true">
            <span>{active.glyph || '◈'}</span>
          </div>

          <div className="core-identity">
            <h2>{active.name.toUpperCase()}</h2>
            <span>{activeRole}</span>
          </div>

          <div className="core-signal" aria-hidden="true">
            {Array.from({ length: 15 }).map((_, i) => <i key={i} style={{ animationDelay: `${i * 45}ms` }} />)}
          </div>
        </div>

        <div className="core-readout core-readout-left"><span>LINK</span><b>SECURE</b></div>
        <div className="core-readout core-readout-right"><span>STATE</span><b>{coreText || 'standby'}</b></div>

        <div className="core-transcript" aria-live="polite">
          <span className="transcript-prefix">INPUT //</span>
          <span>{transcript || 'Ready. Speak naturally or type a command below.'}</span>
        </div>
      </div>
    </section>
  );
}
