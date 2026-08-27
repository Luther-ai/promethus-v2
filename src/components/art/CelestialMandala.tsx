import React from 'react';

interface CelestialMandalaProps {
  size?: number | string;
  className?: string;
  spinning?: boolean;
  intensity?: number;
  color?: string;
}

export function CelestialMandala({
  size = '100%',
  className = '',
  spinning = true,
  intensity = 1,
  color = '#ffffff'
}: CelestialMandalaProps) {
  return (
    <div 
      className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer Rotating Cloud & Sun Rays Ring */}
      <svg
        viewBox="0 0 500 500"
        className={`w-full h-full absolute inset-0 ${spinning ? 'animate-[spin_90s_linear_infinite]' : ''}`}
        style={{ filter: `drop-shadow(0 0 ${12 * intensity}px rgba(255,255,255,${0.25 * intensity}))` }}
      >
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="35%" stopColor="#f4ede2" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#d5c7b3" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          
          <pattern id="cloudHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.2" />
          </pattern>
        </defs>

        {/* Outer Heavy Woodblock Circle Frame */}
        <circle cx="250" cy="250" r="238" fill="none" stroke="#ffffff" strokeWidth="10" />
        <circle cx="250" cy="250" r="230" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="6,4" />
        <circle cx="250" cy="250" r="222" fill="#050808" stroke="#ffffff" strokeWidth="3" />

        {/* Radial Sun Ray Bursts (Reference Image 1) */}
        <g stroke="#ffffff" strokeWidth="2.5" opacity="0.85" strokeLinecap="round">
          {Array.from({ length: 64 }).map((_, i) => {
            const angle = (i * 360) / 64;
            const rad = (angle * Math.PI) / 180;
            const isLong = i % 2 === 0;
            const rInner = 80 + (i % 4) * 8;
            const rOuter = isLong ? 175 + (i % 3) * 12 : 140;
            const x1 = 250 + rInner * Math.cos(rad);
            const y1 = 250 + rInner * Math.sin(rad);
            const x2 = 250 + rOuter * Math.cos(rad);
            const y2 = 250 + rOuter * Math.sin(rad);
            return (
              <line
                key={`ray-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeDasharray={i % 3 === 0 ? "4,6,12,6" : "8,8"}
              />
            );
          })}
        </g>

        {/* Swirling Traditional Japanese Kumo (Clouds) Ring */}
        <g fill="#020404" stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
          {/* Top Cloud Cluster */}
          <path d="M 180 60 Q 210 35 250 40 Q 290 35 320 60 Q 350 90 330 120 Q 300 135 250 130 Q 200 135 170 120 Q 150 90 180 60 Z" />
          <path d="M 210 55 Q 230 45 250 48 Q 270 45 290 55" fill="none" strokeWidth="2" />
          <path d="M 195 85 Q 220 70 250 72 Q 280 70 305 85 Q 280 100 250 98 Q 220 100 195 85 Z" fill="#ffffff" />

          {/* Right Cloud Swirls */}
          <path d="M 440 180 Q 465 210 460 250 Q 465 290 440 320 Q 410 350 380 330 Q 365 300 370 250 Q 365 200 380 170 Q 410 150 440 180 Z" />
          <path d="M 415 195 Q 430 220 428 250 Q 430 280 415 305 Q 400 280 402 250 Q 400 220 415 195 Z" fill="#ffffff" />
          <path d="M 390 220 Q 400 235 400 250 Q 400 265 390 280" fill="none" strokeWidth="2" />

          {/* Bottom Cloud Cluster */}
          <path d="M 180 440 Q 210 465 250 460 Q 290 465 320 440 Q 350 410 330 380 Q 300 365 250 370 Q 200 365 170 380 Q 150 410 180 440 Z" />
          <path d="M 195 415 Q 220 430 250 428 Q 280 430 305 415 Q 280 400 250 402 Q 220 400 195 415 Z" fill="#ffffff" />
          <path d="M 220 390 Q 235 400 250 400 Q 265 400 280 390" fill="none" strokeWidth="2" />

          {/* Left Cloud Swirls */}
          <path d="M 60 180 Q 35 210 40 250 Q 35 290 60 320 Q 90 350 120 330 Q 135 300 130 250 Q 135 200 120 170 Q 90 150 60 180 Z" />
          <path d="M 85 195 Q 70 220 72 250 Q 70 280 85 305 Q 100 280 98 250 Q 100 220 85 195 Z" fill="#ffffff" />
          <path d="M 110 220 Q 100 235 100 250 Q 100 265 110 280" fill="none" strokeWidth="2" />

          {/* Diagonal Stylized Tomoe Swirls */}
          <path d="M 120 120 Q 150 100 170 125 Q 155 155 125 145 Z" fill="#ffffff" />
          <path d="M 380 120 Q 350 100 330 125 Q 345 155 375 145 Z" fill="#ffffff" />
          <path d="M 380 380 Q 350 400 330 375 Q 345 345 375 355 Z" fill="#ffffff" />
          <path d="M 120 380 Q 150 400 170 375 Q 155 345 125 355 Z" fill="#ffffff" />
        </g>

        {/* Concentric Inner Ring */}
        <circle cx="250" cy="250" r="75" fill="#030606" stroke="#ffffff" strokeWidth="5" />
        <circle cx="250" cy="250" r="70" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4,4" />
        <circle cx="250" cy="250" r="55" fill="none" stroke="#ffffff" strokeWidth="2" />
      </svg>

      {/* Counter-rotating Inner Celestial Sun Core */}
      <svg
        viewBox="0 0 200 200"
        className={`w-[36%] h-[36%] absolute z-10 ${spinning ? 'animate-[spin_40s_linear_infinite_reverse]' : ''}`}
      >
        <circle cx="100" cy="100" r="70" fill="#ffffff" stroke="#000000" strokeWidth="4" />
        <circle cx="100" cy="100" r="62" fill="#000000" />
        <circle cx="100" cy="100" r="50" fill="#ffffff" />
        
        {/* Core Kanji or Spirit Crest */}
        <g fill="#000000">
          <circle cx="100" cy="100" r="42" fill="#050808" stroke="#ffffff" strokeWidth="2" />
          {/* Ancient Taijitu / Tomoe Spiral in Center */}
          <path d="M 100 62 A 19 19 0 0 1 100 100 A 19 19 0 0 0 100 138 A 38 38 0 0 1 100 62 Z" fill="#ffffff" />
          <circle cx="100" cy="81" r="5" fill="#000000" />
          <circle cx="100" cy="119" r="5" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}
