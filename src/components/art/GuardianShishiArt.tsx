import React from 'react';

interface GuardianShishiArtProps {
  size?: number | string;
  className?: string;
  glowColor?: string;
  title?: string;
}

export function GuardianShishiArt({
  size = 64,
  className = '',
  glowColor = '#ffb347',
  title = 'SHISHI'
}: GuardianShishiArtProps) {
  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 500 500"
        className="w-full h-full drop-shadow-[0_0_16px_rgba(255,179,71,0.3)]"
      >
        {/* Outer Circular Seal Frame (Reference Image 2) */}
        <circle cx="250" cy="250" r="240" fill="#000000" stroke="#ffffff" strokeWidth="12" />
        <circle cx="250" cy="250" r="226" fill="#0a0e10" stroke="#ffffff" strokeWidth="3" />

        {/* Radial Sunburst Mane Behind */}
        <g stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.9">
          <line x1="250" y1="20" x2="250" y2="120" strokeWidth="12" />
          <line x1="180" y1="35" x2="205" y2="135" strokeWidth="10" />
          <line x1="320" y1="35" x2="295" y2="135" strokeWidth="10" />
          <line x1="110" y1="75" x2="165" y2="165" strokeWidth="12" />
          <line x1="390" y1="75" x2="335" y2="165" strokeWidth="12" />
          <line x1="55" y1="140" x2="135" y2="200" strokeWidth="14" />
          <line x1="445" y1="140" x2="365" y2="200" strokeWidth="14" />
          <line x1="30" y1="230" x2="120" y2="245" strokeWidth="12" />
          <line x1="470" y1="230" x2="380" y2="245" strokeWidth="12" />
        </g>

        {/* Mystic Third Eye on Brow (Reference Image 2) */}
        <g fill="#000000" stroke="#ffffff" strokeWidth="5">
          <circle cx="250" cy="115" r="32" fill="#ffffff" />
          <circle cx="250" cy="115" r="22" fill="#000000" stroke="#ffffff" strokeWidth="4" />
          <circle cx="250" cy="115" r="12" fill={glowColor} />
          {/* Vertical slit in third eye */}
          <rect x="247" y="106" width="6" height="18" rx="3" fill="#000000" />
          {/* Third eye flame crown */}
          <path d="M 250 80 L 250 35" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
        </g>

        {/* Massive Swirling Flame Mane & Eyebrows */}
        <g fill="#ffffff" stroke="#000000" strokeWidth="5" strokeLinejoin="round">
          {/* Left Brow Swirl */}
          <path d="M 240 160 C 210 120, 160 110, 140 140 C 110 180, 160 215, 185 220 C 170 200, 160 170, 195 160 C 220 155, 235 170, 240 160 Z" />
          {/* Right Brow Swirl */}
          <path d="M 260 160 C 290 120, 340 110, 360 140 C 390 180, 340 215, 315 220 C 330 200, 340 170, 305 160 C 280 155, 265 170, 260 160 Z" />
        </g>

        {/* Shishi Fierce Staring Eyes */}
        <g fill="#000000" stroke="#ffffff" strokeWidth="6">
          <circle cx="160" cy="235" r="36" fill="#ffffff" />
          <circle cx="160" cy="235" r="26" fill="#000000" stroke="#ffffff" strokeWidth="4" />
          <circle cx="160" cy="235" r="14" fill="#ffffff" />
          <rect x="157" y="224" width="6" height="22" rx="3" fill="#000000" />

          <circle cx="340" cy="235" r="36" fill="#ffffff" />
          <circle cx="340" cy="235" r="26" fill="#000000" stroke="#ffffff" strokeWidth="4" />
          <circle cx="340" cy="235" r="14" fill="#ffffff" />
          <rect x="337" y="224" width="6" height="22" rx="3" fill="#000000" />
        </g>

        {/* Great Shishi Snout & Whiskers */}
        <g fill="#ffffff" stroke="#000000" strokeWidth="5" strokeLinejoin="round">
          {/* Central Nose Bridge */}
          <path d="M 250 200 C 230 220, 220 260, 210 280 C 230 300, 270 300, 290 280 C 280 260, 270 220, 250 200 Z" />
          <ellipse cx="232" cy="285" rx="10" ry="14" fill="#000000" />
          <ellipse cx="268" cy="285" rx="10" ry="14" fill="#000000" />

          {/* Left Upper Cheek & Whisker Mane */}
          <path d="M 210 290 C 160 270, 110 290, 120 330 C 130 370, 190 360, 220 335 C 190 335, 170 320, 185 305 Z" />
          {/* Right Upper Cheek & Whisker Mane */}
          <path d="M 290 290 C 340 270, 390 290, 380 330 C 370 370, 310 360, 280 335 C 310 335, 330 320, 315 305 Z" />
        </g>

        {/* Roaring Fangs and Clenched Jaws */}
        <g fill="#000000" stroke="#ffffff" strokeWidth="5">
          <path d="M 160 335 Q 250 315 340 335 Q 345 395 250 405 Q 155 395 160 335 Z" />
          
          {/* Upper Teeth Row */}
          <rect x="200" y="340" width="18" height="18" rx="2" fill="#ffffff" />
          <rect x="222" y="340" width="18" height="18" rx="2" fill="#ffffff" />
          <rect x="244" y="340" width="18" height="18" rx="2" fill="#ffffff" />
          <rect x="266" y="340" width="18" height="18" rx="2" fill="#ffffff" />
          <rect x="288" y="340" width="18" height="18" rx="2" fill="#ffffff" />

          {/* Giant Curved Lower Fangs Piercing Up */}
          <path d="M 145 385 C 130 330, 180 320, 185 355 C 170 365, 160 380, 145 385 Z" fill="#ffffff" stroke="#000000" strokeWidth="3" />
          <path d="M 355 385 C 370 330, 320 320, 315 355 C 330 365, 340 380, 355 385 Z" fill="#ffffff" stroke="#000000" strokeWidth="3" />

          {/* Lower Center Teeth */}
          <rect x="210" y="375" width="18" height="18" rx="2" fill="#ffffff" />
          <rect x="232" y="375" width="18" height="18" rx="2" fill="#ffffff" />
          <rect x="254" y="375" width="18" height="18" rx="2" fill="#ffffff" />
          <rect x="276" y="375" width="18" height="18" rx="2" fill="#ffffff" />
        </g>

        {/* Lower Arch Text Ribbon / Seal (Reference Image 2) */}
        <g>
          <path d="M 120 435 Q 250 480 380 435" fill="none" stroke="#000000" strokeWidth="36" />
          <text 
            x="250" 
            y="450" 
            fill="#ffffff" 
            fontSize="26" 
            fontWeight="900" 
            letterSpacing="6" 
            textAnchor="middle" 
            fontFamily="'Cinzel', 'Shippori Mincho', serif"
          >
            {title}
          </text>
        </g>
      </svg>
    </div>
  );
}
