import React from 'react';

export type DarumaExpression = 'zen' | 'fierce' | 'tiger' | 'grinning' | 'mystic' | 'focused';

interface DarumaArtProps {
  size?: number | string;
  className?: string;
  expression?: DarumaExpression;
  glowColor?: string;
  goldAccent?: boolean;
}

export function DarumaArt({
  size = 64,
  className = '',
  expression = 'zen',
  glowColor = '#ffb347',
  goldAccent = true
}: DarumaArtProps) {
  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 320 400"
        className="w-full h-full drop-shadow-[0_0_14px_rgba(255,179,71,0.25)]"
      >
        {/* Main Daruma Egg-shaped Body (Reference Image 4) */}
        <g fill="#0b0f12" stroke="#ffffff" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round">
          {/* Outer Outline */}
          <path d="M 160 20 C 70 20, 25 100, 25 210 C 25 320, 70 380, 160 380 C 250 380, 295 320, 295 210 C 295 100, 250 20, 160 20 Z" />

          {/* Top Swirling Head Woodcut Ripples (Reference Image 4 top row) */}
          <path d="M 90 45 Q 160 75 230 45" fill="none" strokeWidth="4" />
          <path d="M 70 75 Q 160 115 250 75" fill="none" strokeWidth="4" />
          <path d="M 55 110 Q 160 155 265 110" fill="none" strokeWidth="3" />

          {/* Inner Face Mask Cutout */}
          <path 
            d="M 160 65 C 105 65, 60 105, 60 175 C 60 250, 100 275, 160 275 C 220 275, 260 250, 260 175 C 260 105, 215 65, 160 65 Z" 
            fill="#ffffff" 
            stroke="#000000" 
            strokeWidth="5" 
          />
        </g>

        {/* Dynamic Eyebrows & Eyes based on Expression */}
        <g fill="#000000" stroke="#000000" strokeWidth="3">
          {/* Eyebrows (Crane / Wave Pattern from Reference Image 4) */}
          {expression === 'fierce' || expression === 'tiger' ? (
            <>
              {/* Sharp Angled Flaming Brows */}
              <path d="M 75 140 C 95 105, 140 105, 150 145 C 135 125, 105 125, 85 145 Z" fill="#000000" />
              <path d="M 245 140 C 225 105, 180 105, 170 145 C 185 125, 215 125, 235 145 Z" fill="#000000" />
            </>
          ) : expression === 'zen' ? (
            <>
              {/* Classic Zen Swirling Flame Eyebrows */}
              <path d="M 80 135 C 100 100, 145 110, 150 135 C 130 120, 100 120, 85 140 Z" fill="#000000" />
              <path d="M 240 135 C 220 100, 175 110, 170 135 C 190 120, 220 120, 235 140 Z" fill="#000000" />
            </>
          ) : (
            <>
              {/* Grand Curved Wing Brows */}
              <path d="M 75 130 Q 115 90 152 135 Q 115 115 75 130 Z" fill="#000000" />
              <path d="M 245 130 Q 205 90 168 135 Q 205 115 245 130 Z" fill="#000000" />
            </>
          )}

          {/* Daruma Big Round Eyes */}
          <circle cx="115" cy="165" r="22" fill="#ffffff" stroke="#000000" strokeWidth="4" />
          <circle cx="205" cy="165" r="22" fill="#ffffff" stroke="#000000" strokeWidth="4" />
          
          {/* Pupils */}
          <circle cx="115" cy="165" r="11" fill="#000000" />
          <circle cx="205" cy="165" r="11" fill="#000000" />
          <circle cx="118" cy="161" r="3.5" fill="#ffffff" />
          <circle cx="208" cy="161" r="3.5" fill="#ffffff" />

          {/* Broad Nose */}
          <path d="M 160 165 C 150 180, 145 195, 140 200 C 150 208, 170 208, 180 200 C 175 195, 170 180, 160 165 Z" fill="#000000" />

          {/* Majestic Swirled Mustache (Reference Image 4) */}
          <path d="M 160 212 C 130 205, 90 220, 80 245 C 110 240, 135 225, 160 230 C 185 225, 210 240, 240 245 C 230 220, 190 205, 160 212 Z" fill="#000000" />

          {/* Determined Mouth Line */}
          <path d="M 135 248 Q 160 258 185 248" fill="none" stroke="#000000" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* Lower Body Traditional Kanji "福" (Fuku - Fortune / Blessing) Crest (Reference Image 4) */}
        <g>
          {/* Kanji Medallion Circle */}
          <ellipse cx="160" cy="325" rx="42" ry="32" fill="#050809" stroke="#ffffff" strokeWidth="3" />
          
          {/* Japanese Kanji 福 */}
          <text 
            x="160" 
            y="336" 
            fill={goldAccent ? '#ffcc00' : '#ffffff'} 
            fontSize="32" 
            fontWeight="bold" 
            textAnchor="middle" 
            fontFamily="'Yuji Boku', 'Shippori Mincho', serif"
            style={{ filter: goldAccent ? 'drop-shadow(0 0 6px rgba(255,204,0,0.6))' : 'none' }}
          >
            福
          </text>
        </g>

        {/* Side Body Dragon-Scale / Wave Ripples */}
        <g stroke="#ffffff" strokeWidth="3" fill="none">
          <path d="M 40 240 Q 55 280 75 320" />
          <path d="M 50 270 Q 65 305 85 340" />
          <path d="M 280 240 Q 265 280 245 320" />
          <path d="M 270 270 Q 255 305 235 340" />
        </g>
      </svg>
    </div>
  );
}
