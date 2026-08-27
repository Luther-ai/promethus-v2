import React, { useState, useEffect, useRef } from 'react';
import { DarumaArt } from './art/DarumaArt';
import { OniMaskArt } from './art/OniMaskArt';
import { GuardianShishiArt } from './art/GuardianShishiArt';

type GameMode = 'menu' | 'daruma_catch' | 'blade_reflex' | 'spirit_pong';

// Mini Web Audio Synth for retro arcade & sword slash SFX
class ArcadeAudio {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playCoin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch {}
  }

  playSlash() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch {}
  }

  playHit() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch {}
  }

  playGameOver() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, this.ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.5);
    } catch {}
  }
}

const audio = new ArcadeAudio();

export function BreakroomArcade2D({
  onClose,
  userName = 'Co-Pilot'
}: {
  onClose?: () => void;
  userName?: string;
}) {
  const [activeGame, setActiveGame] = useState<GameMode>('menu');
  const [soundOn, setSoundOn] = useState(true);
  const [highScores, setHighScores] = useState({
    daruma: 0,
    reflex: 0,
    pong: 0
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sound toggle
  useEffect(() => {
    audio.enabled = soundOn;
  }, [soundOn]);

  // Load high scores from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('neo_edo_arcade_scores');
      if (saved) setHighScores(JSON.parse(saved));
    } catch {}
  }, []);

  const saveScore = (game: 'daruma' | 'reflex' | 'pong', score: number) => {
    setHighScores(prev => {
      if (score > prev[game]) {
        const next = { ...prev, [game]: score };
        try { localStorage.setItem('neo_edo_arcade_scores', JSON.stringify(next)); } catch {}
        return next;
      }
      return prev;
    });
  };

  // ----------------------------------------------------
  // GAME 1: DARUMA FORTUNE CATCHER
  // ----------------------------------------------------
  const [darumaState, setDarumaState] = useState({
    score: 0,
    lives: 3,
    gameOver: false,
    combo: 0
  });

  useEffect(() => {
    if (activeGame !== 'daruma_catch') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = 600);
    let height = (canvas.height = 400);

    let playerX = width / 2;
    const playerY = height - 40;
    const playerWidth = 44;
    const playerHeight = 44;

    let items: Array<{
      x: number;
      y: number;
      speed: number;
      type: 'coin' | 'tea' | 'scroll' | 'spike';
      size: number;
      symbol: string;
      points: number;
    }> = [];

    let currentScore = 0;
    let currentLives = 3;
    let combo = 0;
    let isOver = false;
    let spawnTimer = 0;

    let leftPressed = false;
    let rightPressed = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') leftPressed = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rightPressed = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') leftPressed = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rightPressed = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      playerX = (e.clientX - rect.left) * scaleX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        playerX = (e.touches[0].clientX - rect.left) * scaleX;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove);

    const loop = () => {
      // Clear with Sumi-e dark wash
      ctx.fillStyle = '#060a0b';
      ctx.fillRect(0, 0, width, height);

      // Draw traditional background grid & clouds
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      if (!isOver) {
        // Player movement
        if (leftPressed) playerX -= 7;
        if (rightPressed) playerX += 7;
        playerX = Math.max(playerWidth / 2, Math.min(width - playerWidth / 2, playerX));

        // Spawn Items
        spawnTimer++;
        if (spawnTimer > 35) {
          spawnTimer = 0;
          const rand = Math.random();
          let itemType: 'coin' | 'tea' | 'scroll' | 'spike' = 'coin';
          let symbol = '🪙';
          let points = 10;

          if (rand < 0.25) {
            itemType = 'spike';
            symbol = '⚡';
            points = 0;
          } else if (rand < 0.65) {
            itemType = 'coin';
            symbol = '🪙';
            points = 10;
          } else if (rand < 0.88) {
            itemType = 'tea';
            symbol = '🍵';
            points = 25;
          } else {
            itemType = 'scroll';
            symbol = '📜';
            points = 50;
          }

          items.push({
            x: Math.random() * (width - 60) + 30,
            y: -20,
            speed: 2.5 + Math.random() * 2 + currentScore * 0.005,
            type: itemType,
            size: 24,
            symbol,
            points
          });
        }

        // Update items
        for (let i = items.length - 1; i >= 0; i--) {
          const item = items[i];
          item.y += item.speed;

          // Check collision with player
          const dx = item.x - playerX;
          const dy = item.y - playerY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < playerWidth / 2 + item.size / 2) {
            // Collision!
            if (item.type === 'spike') {
              currentLives--;
              combo = 0;
              audio.playHit();
              if (currentLives <= 0) {
                isOver = true;
                audio.playGameOver();
                saveScore('daruma', currentScore);
              }
            } else {
              combo++;
              currentScore += item.points * Math.min(combo, 5);
              audio.playCoin();
            }
            items.splice(i, 1);
            continue;
          }

          // Off screen bottom
          if (item.y > height + 30) {
            items.splice(i, 1);
          }
        }
      }

      // Draw falling items
      for (const item of items) {
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.symbol, item.x, item.y);
      }

      // Draw Player: Daruma Fortune Basket
      ctx.save();
      ctx.translate(playerX, playerY);

      // Daruma base body
      ctx.fillStyle = '#0b0f12';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Golden Fuku Kanji in center
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 14px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('福', 0, 1);

      // Red Daruma ribbon
      ctx.strokeStyle = '#ff3838';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 23, Math.PI * 0.8, Math.PI * 2.2);
      ctx.stroke();
      ctx.restore();

      // Draw HUD (Top Bar)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE: ${currentScore}`, 16, 26);
      ctx.fillText(`COMBO: x${Math.min(combo, 5)}`, 160, 26);

      ctx.textAlign = 'right';
      ctx.fillText(`LIVES: ${'❤️'.repeat(Math.max(0, currentLives))}`, width - 16, 26);

      if (isOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#ff3838';
        ctx.font = 'bold 28px "Cinzel", serif';
        ctx.textAlign = 'center';
        ctx.fillText('STAGE FAILED - GAME OVER', width / 2, height / 2 - 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = '16px "JetBrains Mono", monospace';
        ctx.fillText(`FINAL SCORE: ${currentScore}`, width / 2, height / 2 + 15);
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Click "Restart" below to try again', width / 2, height / 2 + 45);
      }

      setDarumaState({
        score: currentScore,
        lives: currentLives,
        gameOver: isOver,
        combo
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [activeGame]);

  // ----------------------------------------------------
  // GAME 2: ONI BLADE REFLEX (DOJO DUEL)
  // ----------------------------------------------------
  const [reflexState, setReflexState] = useState<{
    status: 'waiting' | 'ready' | 'flash' | 'slashed' | 'early' | 'round_over';
    reactionTime: number | null;
    round: number;
    bestTime: number | null;
    rating: string;
  }>({
    status: 'waiting',
    reactionTime: null,
    round: 1,
    bestTime: null,
    rating: ''
  });

  const reflexTimerRef = useRef<any>(null);
  const flashTimeRef = useRef<number>(0);

  const startReflexRound = () => {
    if (reflexTimerRef.current) clearTimeout(reflexTimerRef.current);
    setReflexState(prev => ({
      ...prev,
      status: 'ready',
      reactionTime: null,
      rating: ''
    }));

    // Random delay between 1.5s and 4.2s
    const delay = 1500 + Math.random() * 2700;
    reflexTimerRef.current = setTimeout(() => {
      flashTimeRef.current = performance.now();
      audio.playSlash();
      setReflexState(prev => ({ ...prev, status: 'flash' }));
    }, delay);
  };

  const handleReflexClick = () => {
    if (reflexState.status === 'ready') {
      // Clicked too early!
      if (reflexTimerRef.current) clearTimeout(reflexTimerRef.current);
      audio.playHit();
      setReflexState(prev => ({
        ...prev,
        status: 'early',
        rating: 'TOO EARLY! FOUL STRIKE'
      }));
    } else if (reflexState.status === 'flash') {
      const now = performance.now();
      const reaction = Math.round(now - flashTimeRef.current);
      audio.playSlash();

      let rating = 'TRAINEE SLICE (Slow)';
      if (reaction < 180) rating = '⚡ GODLIKE SHOGUN REFLEX!';
      else if (reaction < 230) rating = '🔥 MASTER BLADE STRIKE!';
      else if (reaction < 300) rating = '⚔️ SHARP SAMURAI CUT!';
      else if (reaction < 400) rating = '🥋 DECENT RONIN SLASH';

      saveScore('reflex', 1000 - Math.min(reaction, 999));

      setReflexState(prev => ({
        ...prev,
        status: 'slashed',
        reactionTime: reaction,
        bestTime: prev.bestTime === null || reaction < prev.bestTime ? reaction : prev.bestTime,
        rating,
        round: prev.round + 1
      }));
    }
  };

  // ----------------------------------------------------
  // GAME 3: SPIRIT GATE PONG 2D
  // ----------------------------------------------------
  const [pongScore, setPongScore] = useState({ player: 0, ai: 0, winner: '' });
  const [selectedAgentOpponent, setSelectedAgentOpponent] = useState<'forge' | 'sage' | 'prometheus'>('forge');

  useEffect(() => {
    if (activeGame !== 'spirit_pong') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = 600);
    let height = (canvas.height = 360);

    const paddleHeight = 70;
    const paddleWidth = 10;
    let playerY = height / 2 - paddleHeight / 2;
    let aiY = height / 2 - paddleHeight / 2;

    let ballX = width / 2;
    let ballY = height / 2;
    let ballSpeedX = 4.5;
    let ballSpeedY = 2.5;
    const ballRadius = 7;

    let pScore = 0;
    let aScore = 0;
    let winner = '';

    const resetBall = (direction: number) => {
      ballX = width / 2;
      ballY = height / 2;
      ballSpeedX = 4.5 * direction;
      ballSpeedY = (Math.random() - 0.5) * 4;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleY = canvas.height / rect.height;
      playerY = (e.clientY - rect.top) * scaleY - paddleHeight / 2;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        const scaleY = canvas.height / rect.height;
        playerY = (e.touches[0].clientY - rect.top) * scaleY - paddleHeight / 2;
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove);

    const loop = () => {
      // Black ink background
      ctx.fillStyle = '#06090a';
      ctx.fillRect(0, 0, width, height);

      // Center dashed net
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      ctx.setLineDash([]);

      if (!winner) {
        // Player paddle bounds
        playerY = Math.max(0, Math.min(height - paddleHeight, playerY));

        // AI Paddle movement (varies with selected agent)
        const aiSpeed = selectedAgentOpponent === 'forge' ? 3.8 : selectedAgentOpponent === 'sage' ? 3.2 : 4.2;
        const aiTarget = ballY - paddleHeight / 2;
        if (aiY < aiTarget - 6) aiY += aiSpeed;
        else if (aiY > aiTarget + 6) aiY -= aiSpeed;
        aiY = Math.max(0, Math.min(height - paddleHeight, aiY));

        // Ball movement
        ballX += ballSpeedX;
        ballY += ballSpeedY;

        // Top/Bottom bounce
        if (ballY - ballRadius <= 0 || ballY + ballRadius >= height) {
          ballSpeedY = -ballSpeedY;
          audio.playHit();
        }

        // Left Paddle (Player) collision
        if (
          ballX - ballRadius <= 25 + paddleWidth &&
          ballX + ballRadius >= 25 &&
          ballY >= playerY &&
          ballY <= playerY + paddleHeight
        ) {
          ballSpeedX = Math.abs(ballSpeedX) * 1.05; // speed up
          const deltaY = ballY - (playerY + paddleHeight / 2);
          ballSpeedY = deltaY * 0.18;
          audio.playSlash();
        }

        // Right Paddle (AI) collision
        if (
          ballX + ballRadius >= width - 25 - paddleWidth &&
          ballX - ballRadius <= width - 25 &&
          ballY >= aiY &&
          ballY <= aiY + paddleHeight
        ) {
          ballSpeedX = -Math.abs(ballSpeedX) * 1.05;
          const deltaY = ballY - (aiY + paddleHeight / 2);
          ballSpeedY = deltaY * 0.18;
          audio.playHit();
        }

        // Score check
        if (ballX < 0) {
          aScore++;
          audio.playGameOver();
          if (aScore >= 5) winner = 'AGENT';
          else resetBall(1);
        } else if (ballX > width) {
          pScore++;
          audio.playCoin();
          if (pScore >= 5) {
            winner = 'CO-PILOT';
            saveScore('pong', pScore * 100);
          } else {
            resetBall(-1);
          }
        }
      }

      // Draw Player Paddle (Cyan Spirit Blade)
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.fillRect(25, playerY, paddleWidth, paddleHeight);

      // Draw AI Paddle (Cinnabar / Amber Blade)
      const aiColor = selectedAgentOpponent === 'forge' ? '#ffb347' : selectedAgentOpponent === 'sage' ? '#c49bff' : '#ff3838';
      ctx.fillStyle = aiColor;
      ctx.shadowColor = aiColor;
      ctx.shadowBlur = 10;
      ctx.fillRect(width - 25 - paddleWidth, aiY, paddleWidth, paddleHeight);
      ctx.shadowBlur = 0;

      // Draw Glowing Ball
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Scores
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${pScore}`, width / 4, 45);
      ctx.fillText(`${aScore}`, (3 * width) / 4, 45);

      if (winner) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = winner === 'CO-PILOT' ? '#22d3ee' : '#ff3838';
        ctx.font = 'bold 26px "Cinzel", serif';
        ctx.fillText(winner === 'CO-PILOT' ? '🏆 VICTORY! YOU DEFEATED THE AGENT' : 'DEFEAT! AGENT PREVAILED', width / 2, height / 2 - 15);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px "JetBrains Mono", monospace';
        ctx.fillText('Click below to restart match', width / 2, height / 2 + 25);
      }

      setPongScore({ player: pScore, ai: aScore, winner });
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [activeGame, selectedAgentOpponent]);

  return (
    <div className="w-full h-full flex flex-col bg-[#05090a] text-white rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
      {/* ARCADE HEADER */}
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-black/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center justify-center text-lg shadow-[0_0_12px_rgba(239,68,68,0.3)]">
            ⛩️
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wider font-['Cinzel'] text-white flex items-center gap-2">
              NEO-EDO BREAKROOM ARCADE <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">2D ENGINE</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">Relax, test your reflexes, and duel AI agents.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="px-2.5 py-1 text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-mono text-slate-300 transition-colors"
            title="Toggle Sound Effects"
          >
            {soundOn ? '🔊 SFX ON' : '🔇 SFX OFF'}
          </button>
          {activeGame !== 'menu' && (
            <button
              onClick={() => setActiveGame('menu')}
              className="px-3 py-1 text-xs font-bold rounded-lg border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 font-mono transition-colors"
            >
              ← GAME MENU
            </button>
          )}
        </div>
      </div>

      {/* ARCADE BODY */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col items-center justify-center">
        {/* GAME MENU SELECTOR */}
        {activeGame === 'menu' && (
          <div className="w-full max-w-lg space-y-4 py-2">
            <div className="text-center mb-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                Off-Duty Recreation Modules
              </span>
              <h2 className="text-xl font-bold font-['Cinzel'] text-white">Choose Your 2D Challenge</h2>
            </div>

            {/* Game 1 Card */}
            <div 
              onClick={() => setActiveGame('daruma_catch')}
              className="p-4 rounded-xl border border-white/15 bg-gradient-to-r from-amber-950/30 via-slate-900/50 to-black hover:border-amber-400/60 hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-between group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <DarumaArt size={48} expression="zen" />
                <div>
                  <h4 className="text-sm font-bold text-amber-300 group-hover:text-amber-200 font-['Cinzel']">
                    1. Daruma Fortune Catcher
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    Catch falling coins, scrolls & tea. Dodge cursed lightning!
                  </p>
                  <span className="text-[10px] text-amber-500/80 font-mono">
                    BEST SCORE: {highScores.daruma} PTS
                  </span>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold group-hover:bg-amber-500 group-hover:text-black transition-all">
                PLAY →
              </span>
            </div>

            {/* Game 2 Card */}
            <div 
              onClick={() => {
                setActiveGame('blade_reflex');
                startReflexRound();
              }}
              className="p-4 rounded-xl border border-white/15 bg-gradient-to-r from-red-950/30 via-slate-900/50 to-black hover:border-red-400/60 hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-between group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <OniMaskArt size={48} glowColor="#ff3838" />
                <div>
                  <h4 className="text-sm font-bold text-red-300 group-hover:text-red-200 font-['Cinzel']">
                    2. Oni Blade Reflex Duel
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    Wait for the "斬" flash and slice with millisecond precision!
                  </p>
                  <span className="text-[10px] text-red-400/80 font-mono">
                    BEST TIME: {highScores.reflex > 0 ? `${1000 - highScores.reflex}ms` : '--'}
                  </span>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-mono font-bold group-hover:bg-red-500 group-hover:text-black transition-all">
                PLAY →
              </span>
            </div>

            {/* Game 3 Card */}
            <div 
              onClick={() => setActiveGame('spirit_pong')}
              className="p-4 rounded-xl border border-white/15 bg-gradient-to-r from-cyan-950/30 via-slate-900/50 to-black hover:border-cyan-400/60 hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-between group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <GuardianShishiArt size={48} glowColor="#35f2df" title="PONG" />
                <div>
                  <h4 className="text-sm font-bold text-cyan-300 group-hover:text-cyan-200 font-['Cinzel']">
                    3. Spirit Gate Pong 2D
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    Classic 2D paddle ping-pong duel against Forge, Sage or Prometheus!
                  </p>
                  <span className="text-[10px] text-cyan-400/80 font-mono">
                    BEST RATING: {highScores.pong > 0 ? `${highScores.pong} PTS` : '--'}
                  </span>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold group-hover:bg-cyan-500 group-hover:text-black transition-all">
                PLAY →
              </span>
            </div>
          </div>
        )}

        {/* GAME 1 CANVAS CONTAINER */}
        {activeGame === 'daruma_catch' && (
          <div className="flex flex-col items-center w-full max-w-xl">
            <canvas
              ref={canvasRef}
              className="w-full max-w-[600px] h-[340px] rounded-xl border border-amber-500/30 shadow-[0_0_25px_rgba(245,158,11,0.15)] cursor-crosshair touch-none"
            />
            <div className="mt-3 flex items-center justify-between w-full max-w-[600px] px-2">
              <span className="text-xs text-slate-400 font-mono">
                Controls: Mouse, Touch, or <b>A/D / Arrow Keys</b>
              </span>
              {darumaState.gameOver && (
                <button
                  onClick={() => {
                    setActiveGame('menu');
                    setTimeout(() => setActiveGame('daruma_catch'), 50);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-black font-bold font-mono text-xs hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  🔄 RESTART RUN
                </button>
              )}
            </div>
          </div>
        )}

        {/* GAME 2: BLADE REFLEX INTERFACE */}
        {activeGame === 'blade_reflex' && (
          <div className="flex flex-col items-center w-full max-w-md text-center py-2">
            <div className="mb-3">
              <span className="text-[11px] font-mono text-red-400 uppercase tracking-wider">
                ROUND {reflexState.round} • DOJO DUEL
              </span>
              <h3 className="text-lg font-bold font-['Cinzel'] text-white">Focus Your Mind</h3>
            </div>

            {/* Main Reflex Stage Area */}
            <div 
              onClick={handleReflexClick}
              className={`w-full h-56 rounded-2xl border flex flex-col items-center justify-center p-6 select-none cursor-pointer transition-all ${
                reflexState.status === 'flash'
                  ? 'bg-red-600 border-white shadow-[0_0_50px_rgba(239,68,68,0.9)] animate-pulse'
                  : reflexState.status === 'slashed'
                  ? 'bg-emerald-950/60 border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                  : reflexState.status === 'early'
                  ? 'bg-amber-950/60 border-amber-500/60'
                  : 'bg-black/80 border-red-500/30 hover:border-red-500/60 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]'
              }`}
            >
              {reflexState.status === 'ready' && (
                <div className="space-y-2 animate-pulse">
                  <div className="text-4xl text-slate-500">⛩️</div>
                  <p className="text-sm font-mono text-slate-300 font-bold">WAIT FOR THE FLASH...</p>
                  <p className="text-[10px] text-slate-500 font-mono">Do NOT click early!</p>
                </div>
              )}

              {reflexState.status === 'flash' && (
                <div className="space-y-1">
                  <span className="text-7xl font-bold font-['Yuji_Boku',serif] text-white">
                    斬
                  </span>
                  <p className="text-base font-black tracking-widest text-white uppercase font-mono">
                    CLICK / SLICE NOW!
                  </p>
                </div>
              )}

              {reflexState.status === 'slashed' && (
                <div className="space-y-2">
                  <span className="text-4xl font-bold font-mono text-emerald-300">
                    {reflexState.reactionTime} ms
                  </span>
                  <p className="text-xs font-bold text-white font-mono">{reflexState.rating}</p>
                </div>
              )}

              {reflexState.status === 'early' && (
                <div className="space-y-1">
                  <span className="text-3xl text-amber-400">⚠️</span>
                  <p className="text-sm font-bold text-amber-300 font-mono">TOO EARLY!</p>
                  <p className="text-xs text-slate-400 font-mono">Patience, samurai. Strike only on the flash.</p>
                </div>
              )}
            </div>

            {/* Action Buttons & Best Record */}
            <div className="mt-4 flex items-center justify-between w-full px-2">
              <span className="text-xs text-slate-400 font-mono">
                Best: {reflexState.bestTime ? `${reflexState.bestTime}ms` : '--'}
              </span>

              {(reflexState.status === 'slashed' || reflexState.status === 'early') && (
                <button
                  onClick={startReflexRound}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold font-mono text-xs shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all cursor-pointer"
                >
                  NEXT DUEL →
                </button>
              )}
            </div>
          </div>
        )}

        {/* GAME 3: SPIRIT PONG CANVAS */}
        {activeGame === 'spirit_pong' && (
          <div className="flex flex-col items-center w-full max-w-xl">
            {/* Opponent Selection */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-400 font-mono">Opponent:</span>
              <button
                onClick={() => setSelectedAgentOpponent('forge')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                  selectedAgentOpponent === 'forge'
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Forge (Aggressive)
              </button>
              <button
                onClick={() => setSelectedAgentOpponent('sage')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                  selectedAgentOpponent === 'sage'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Sage (Tactical)
              </button>
              <button
                onClick={() => setSelectedAgentOpponent('prometheus')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                  selectedAgentOpponent === 'prometheus'
                    ? 'bg-red-500 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Prometheus (Master)
              </button>
            </div>

            <canvas
              ref={canvasRef}
              className="w-full max-w-[600px] h-[300px] rounded-xl border border-cyan-500/30 shadow-[0_0_25px_rgba(34,211,238,0.15)] cursor-ns-resize touch-none"
            />
            <div className="mt-2 flex items-center justify-between w-full max-w-[600px] px-2 text-xs text-slate-400 font-mono">
              <span>Control: Move mouse or finger vertically to block</span>
              {pongScore.winner && (
                <button
                  onClick={() => {
                    setActiveGame('menu');
                    setTimeout(() => setActiveGame('spirit_pong'), 50);
                  }}
                  className="px-3 py-1 rounded bg-cyan-500 text-black font-bold font-mono text-xs hover:bg-cyan-400"
                >
                  REMATCH
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
