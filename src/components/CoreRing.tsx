import React from 'react';
import { AgentKey, AGENTS, ORDER, AgentPersona, SpeakerState, getAgentConfig } from '../types';
import { CelestialMandala } from './art/CelestialMandala';
import { OniMaskArt } from './art/OniMaskArt';
import { GuardianShishiArt } from './art/GuardianShishiArt';
import { DarumaArt } from './art/DarumaArt';

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
}: {
  activeAgent: AgentKey;
  coreState: string;
  coreText: string;
  transcript: string;
  agentStates: Record<AgentKey, string>;
  speakerState?: SpeakerState;
  onSelectAgent: (key: AgentKey) => void;
  personas?: Record<AgentKey, AgentPersona>;
  seats?: AgentKey[];
}) {
  const seatsList = seats && seats.length > 0 ? seats : ORDER;
  const currentSpeakerId = speakerState?.agentId || activeAgent;
  const active = AGENTS[currentSpeakerId] || getAgentConfig(currentSpeakerId);
  const activeRole = personas?.[currentSpeakerId]?.roleTitle || active.role;
  const audioLevel = speakerState?.audioLevel || 0;

  const totalSeats = seatsList.length;

  // Render specific Woodcut / Sumi-e emblem based on agent identity
  const renderAgentEmblem = (key: string, isSpeaking: boolean) => {
    if (key === 'prometheus') {
      return <OniMaskArt size={isSpeaking ? 42 : 32} glowColor="#ff3838" eyeColor="#38bdf8" />;
    }
    if (key === 'forge') {
      return <GuardianShishiArt size={isSpeaking ? 42 : 32} glowColor="#fbbf24" title="FORGE" />;
    }
    if (key === 'sage') {
      return <DarumaArt size={isSpeaking ? 40 : 30} expression="zen" glowColor="#c084fc" />;
    }
    if (key === 'questioner') {
      return <DarumaArt size={isSpeaking ? 40 : 30} expression="fierce" glowColor="#4ade80" />;
    }
    if (key === 'sam') {
      return <DarumaArt size={isSpeaking ? 40 : 30} expression="tiger" glowColor="#ec4899" />;
    }
    // Default Gemini or Custom
    return <DarumaArt size={isSpeaking ? 40 : 30} expression="mystic" glowColor="#38bdf8" />;
  };

  return (
    <section className="stage relative w-full flex-1 flex items-center justify-center overflow-hidden m-4 sm:m-6 rounded-2xl border border-white/15 bg-[#020506] shadow-2xl">
      {/* Background Celestial Mandala (Reference Image 1) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none scale-110 sm:scale-125">
        <CelestialMandala size="min(720px, 92vw)" intensity={speakerState?.agentId ? 1.5 : 0.8} />
      </div>

      <div className="circle-container relative w-[min(560px,88vw)] aspect-square flex items-center justify-center z-10">
        {/* Concentric Woodcut & Cloud Arc Rings */}
        <div className="ring r1 border-white/20"></div>
        <div className="ring r2 border-dashed border-white/30"></div>
        <div className="ring r3 border-white/15"></div>
        <div className="ring r4 border-white/20"></div>
        
        {/* Ancient Kanji & Seal Ring */}
        <div className="rune-ring select-none">
          {'天・地・風・火・雷・水・山・沢・陰・陽・命・心・魂・道・力・智・徳・神・龍・虎・鬼・福・仁・義'.split('').map((char, i) => {
            const a = (i / 24) * Math.PI * 2;
            const r = 49;
            return (
              <span
                key={i}
                className="rune font-['Yuji_Boku',serif] text-[13px] opacity-60 text-white hover:opacity-100 transition-opacity"
                style={{ left: `${50 + r * Math.cos(a)}%`, top: `${50 + r * Math.sin(a)}%` }}
              >
                {char}
              </span>
            );
          })}
        </div>

        {/* Orbiting Agent Seats */}
        <div className="absolute inset-0">
          {seatsList.map((key, i) => {
            const agent = AGENTS[key] || getAgentConfig(key);
            const isSpeaking = speakerState?.agentId === key;
            const isActive = activeAgent === key;
            const isAnySpeakingOrThinking = speakerState && speakerState.agentId !== null && speakerState.agentId !== key;

            const colorVar = agent.color || (
              key === 'prometheus' ? '#ff3838' : 
              key === 'sage' ? '#c084fc' : 
              key === 'forge' ? '#fbbf24' : 
              key === 'questioner' ? '#4ade80' : '#38bdf8'
            );

            // Calculate angle for all dynamic seats evenly spaced around the circle
            const baseAngle = i * (360 / Math.max(1, totalSeats));
            const angle = `${baseAngle}deg`;

            return (
              <div
                key={key}
                className={`orbit-node ${isSpeaking ? 'active-center' : ''}`}
                style={{
                  '--angle': angle,
                  '--speed': '75s',
                  '--delay': '0s',
                  transition: 'transform 500ms cubic-bezier(.22, 1, .36, 1), opacity 350ms ease, filter 350ms ease',
                  opacity: isAnySpeakingOrThinking ? 0.45 : 1,
                  filter: isAnySpeakingOrThinking ? 'grayscale(0.4)' : 'none'
                } as React.CSSProperties}
              >
                <div
                  className={`hex-shape relative overflow-hidden group cursor-pointer ${
                    isActive && !isSpeaking ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.4)]' : ''
                  } ${isSpeaking ? 'working scale-125 shadow-2xl ring-4 ring-white' : ''}`}
                  onClick={() => onSelectAgent(key)}
                  style={{
                    color: colorVar,
                    borderColor: isSpeaking ? '#ffffff' : colorVar,
                    background: isSpeaking ? `radial-gradient(circle, ${colorVar}44 0%, #06090a 80%)` : '#070a0c',
                    boxShadow: isSpeaking ? `0 0 ${25 + audioLevel * 35}px ${colorVar}` : '0 4px 15px rgba(0,0,0,0.6)',
                    transform: isSpeaking ? `scale(${1.25 + audioLevel * 0.25})` : undefined,
                    transition: 'transform 300ms ease, box-shadow 300ms ease'
                  }}
                  title={`${agent.name} - ${personas?.[key]?.roleTitle || agent.role}`}
                >
                  {renderAgentEmblem(key, isSpeaking)}

                  {/* Subtle Japanese Mon label badge below */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 px-2 py-0.5 rounded border border-white/20 text-[9px] font-mono whitespace-nowrap pointer-events-none text-white">
                    {agent.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center Round Stage Core */}
        <div 
          className={`core-center absolute inset-[24%] rounded-full flex flex-col items-center justify-center text-center transition-all duration-500 border-2 ${coreState}`}
          style={{
            boxShadow: speakerState?.agentId ? `0 0 ${40 + audioLevel * 45}px ${active.color || 'var(--cyan)'}cc, inset 0 0 30px ${active.color || 'var(--cyan)'}66` : '0 0 35px rgba(255,255,255,0.15)',
            borderColor: active.color || 'var(--cyan)',
            background: 'radial-gradient(circle, rgba(14,20,24,0.95) 0%, rgba(3,5,6,0.98) 100%)'
          }}
        >
          {/* Top Status Bead */}
          <div className="absolute top-[14%] text-[10px] font-bold tracking-widest uppercase text-slate-400 flex gap-2 items-center font-mono">
            <span 
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ 
                background: active.color || 'var(--cyan)',
                boxShadow: `0 0 12px ${active.color || 'var(--cyan)'}`
              }}
            />
            <span className="text-white">
              {speakerState?.status === 'speaking' 
                ? `${active.name.toUpperCase()} SPEAKING` 
                : speakerState?.status === 'thinking' 
                ? `${active.name.toUpperCase()} CONTEMPLATING` 
                : coreText}
            </span>
          </div>
          
          {/* Active Center Agent Artwork Preview */}
          <div className="my-1 scale-90 sm:scale-100">
            {renderAgentEmblem(currentSpeakerId, speakerState?.status === 'speaking')}
          </div>

          {/* Identity & Title in Woodblock Calligraphy */}
          <div className="flex flex-col items-center max-w-[85%] px-2">
            <h2 
              className="text-lg sm:text-xl font-bold font-['Cinzel','Shippori_Mincho',serif] text-white tracking-widest drop-shadow-md"
              style={{ color: active.color }}
            >
              {active.name.toUpperCase()}
            </h2>
            <div className="text-[11px] font-medium text-slate-300 truncate max-w-full font-mono mt-0.5">
              {activeRole}
            </div>
          </div>
        </div>

        {/* Live Audio Transcript Subtitle */}
        <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-wider text-slate-200 bg-black/80 px-4 py-1.5 rounded-full border border-white/15 max-w-[85%] text-center min-h-[26px] drop-shadow-lg font-mono">
          {transcript || '⛩️ Roundtable Synchronized • Speak or type in dock below'}
        </div>
      </div>
    </section>
  );
}
