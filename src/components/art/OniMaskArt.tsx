import React from 'react';

interface OniMaskArtProps {
  size?: number | string;
  className?: string;
  glowColor?: string;
  eyeColor?: string;
  mouthGlow?: boolean;
}

export function OniMaskArt({
  size = 64,
  className = '',
  glowColor = '#ff3838',
  eyeColor = '#ffffff',
  mouthGlow = true
}: OniMaskArtProps) {
  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 400 480"
        className="w-full h-full drop-shadow-[0_0_15px_rgba(255,56,56,0.35)]"
      >
        <defs>
          <filter id="oniGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Horns Crown Top Flame Elements (Reference Image 3) */}
        <g fill="#1a1e20" stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
          {/* Central Top Flame Crown */}
          <path d="M 200 40 C 215 70, 240 60, 230 110 C 220 80, 205 100, 200 130 C 195 100, 180 80, 170 110 C 160 60, 185 70, 200 40 Z" fill="#ffffff" />
          <path d="M 200 70 C 210 90, 220 85, 215 115 C 208 95, 202 105, 200 120 C 198 105, 192 95, 185 115 C 180 85, 190 90, 200 70 Z" fill="#090d0e" />

          {/* Left Great Horn with Trailing Spirit Tendrils */}
          <path d="M 120 180 C 100 130, 80 80, 105 45 C 90 70, 70 110, 65 140 C 50 115, 60 90, 75 75 C 60 95, 45 130, 60 170 C 40 180, 45 200, 75 205 Z" fill="#ffffff" />
          <path d="M 100 160 C 88 125, 78 90, 95 65 C 80 85, 70 115, 72 145 Z" fill="#090d0e" />

          {/* Right Great Horn with Trailing Spirit Tendrils */}
          <path d="M 280 180 C 300 130, 320 80, 295 45 C 310 70, 330 110, 335 140 C 350 115, 340 90, 325 75 C 340 95, 355 130, 340 170 C 360 180, 355 200, 325 205 Z" fill="#ffffff" />
          <path d="M 300 160 C 312 125, 322 90, 305 65 C 320 85, 330 115, 328 145 Z" fill="#090d0e" />
        </g>

        {/* Main Face Contour & Woodblock Plates */}
        <g fill="#090d0e" stroke="#ffffff" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
          {/* Brow and Forehead Ridge */}
          <path d="M 110 190 Q 200 230 290 190 Q 330 230 310 290 Q 300 360 260 410 Q 200 460 140 410 Q 100 360 90 290 Q 70 230 110 190 Z" />

          {/* Forehead Grooves & Crest */}
          <path d="M 160 170 Q 200 190 240 170" fill="none" strokeWidth="4" />
          <path d="M 175 150 Q 200 165 225 150" fill="none" strokeWidth="3" />
          <path d="M 200 140 L 200 195" strokeWidth="4" />

          {/* Fierce Eyebrows (Stylized Woodblock Clouds) */}
          <path d="M 115 225 Q 160 195 190 235 Q 150 245 115 225 Z" fill="#ffffff" />
          <path d="M 285 225 Q 240 195 210 235 Q 250 245 285 225 Z" fill="#ffffff" />

          {/* Deep Sunken Eye Sockets */}
          <ellipse cx="155" cy="265" rx="35" ry="24" fill="#000000" stroke="#ffffff" strokeWidth="3" />
          <ellipse cx="245" cy="265" rx="35" ry="24" fill="#000000" stroke="#ffffff" strokeWidth="3" />

          {/* Glowing Spectral Eyes */}
          <circle cx="155" cy="265" r="14" fill={eyeColor} filter="url(#oniGlow)" />
          <circle cx="245" cy="265" r="14" fill={eyeColor} filter="url(#oniGlow)" />
          {/* Slit Pupils */}
          <rect x="153" y="254" width="4" height="22" rx="2" fill="#000000" />
          <rect x="243" y="254" width="4" height="22" rx="2" fill="#000000" />

          {/* Sharp Nose Bridge and Nostrils */}
          <path d="M 200 230 L 192 310 L 175 320 Q 200 335 225 320 L 208 310 Z" fill="#ffffff" />
          <ellipse cx="188" cy="318" rx="4" ry="7" fill="#000000" />
          <ellipse cx="212" cy="318" rx="4" ry="7" fill="#000000" />

          {/* High Cheekbone Flares */}
          <path d="M 90 280 Q 130 290 145 330 Q 105 320 90 280 Z" fill="#ffffff" />
          <path d="M 310 280 Q 270 290 255 330 Q 295 320 310 280 Z" fill="#ffffff" />

          {/* Menacing Fanged Grin Jaw */}
          <path d="M 125 350 Q 200 330 275 350 Q 285 410 200 435 Q 115 410 125 350 Z" fill="#000000" stroke="#ffffff" strokeWidth="4" />

          {/* Upper Razor Fangs */}
          <path d="M 140 355 L 148 385 L 158 357 Z" fill="#ffffff" />
          <path d="M 160 356 L 168 375 L 178 356 Z" fill="#ffffff" />
          <path d="M 180 356 L 190 373 L 200 356 Z" fill="#ffffff" />
          <path d="M 200 356 L 210 373 L 220 356 Z" fill="#ffffff" />
          <path d="M 222 356 L 232 375 L 240 356 Z" fill="#ffffff" />
          <path d="M 242 357 L 252 385 L 260 355 Z" fill="#ffffff" />

          {/* Great Lower Fangs Piercing Upward */}
          <path d="M 130 405 L 140 340 L 152 400 Z" fill="#ffffff" />
          <path d="M 270 405 L 260 340 L 248 400 Z" fill="#ffffff" />

          {/* Lower Row Teeth */}
          <path d="M 160 405 L 170 385 L 180 408 Z" fill="#ffffff" />
          <path d="M 182 408 L 192 388 L 200 410 Z" fill="#ffffff" />
          <path d="M 200 410 L 208 388 L 218 408 Z" fill="#ffffff" />
          <path d="M 220 408 L 230 385 L 240 405 Z" fill="#ffffff" />

          {/* Heavy Chin Spike and Scrollwork */}
          <path d="M 175 425 Q 200 455 225 425 Q 200 470 175 425 Z" fill="#ffffff" />
          <path d="M 160 415 Q 140 435 155 450 Q 170 435 160 415 Z" fill="#ffffff" />
          <path d="M 240 415 Q 260 435 245 450 Q 230 435 240 415 Z" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}
