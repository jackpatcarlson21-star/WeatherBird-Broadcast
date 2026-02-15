import React, { useState, useEffect, useRef } from 'react';

const CRTPowerOn = ({ onComplete }) => {
  const [phase, setPhase] = useState('radar');
  const canvasRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const sweepAngle = useRef(0);
  const blips = useRef([]);
  const birdImg = useRef(null);

  // Pre-render pixel bird SVG to an Image for canvas stamping
  useEffect(() => {
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 24" width="32" height="24">
      <rect x="12" y="2" width="8" height="2" fill="#00FFFF"/>
      <rect x="10" y="4" width="12" height="2" fill="#00FFFF"/>
      <rect x="10" y="6" width="12" height="2" fill="#00FFFF"/>
      <rect x="12" y="6" width="2" height="2" fill="#000"/>
      <rect x="18" y="6" width="2" height="2" fill="#000"/>
      <rect x="12" y="6" width="1" height="1" fill="#FFF"/>
      <rect x="18" y="6" width="1" height="1" fill="#FFF"/>
      <rect x="22" y="6" width="4" height="2" fill="#FFA500"/>
      <rect x="22" y="8" width="2" height="2" fill="#FFA500"/>
      <rect x="8" y="8" width="14" height="2" fill="#00FFFF"/>
      <rect x="6" y="10" width="16" height="2" fill="#00FFFF"/>
      <rect x="6" y="12" width="16" height="2" fill="#00FFFF"/>
      <rect x="6" y="14" width="16" height="2" fill="#00FFFF"/>
      <rect x="8" y="16" width="14" height="2" fill="#00FFFF"/>
      <rect x="4" y="10" width="2" height="2" fill="#00FFFF" opacity="0.8"/>
      <rect x="2" y="12" width="4" height="2" fill="#00FFFF" opacity="0.8"/>
      <rect x="22" y="14" width="4" height="2" fill="#00FFFF" opacity="0.7"/>
      <rect x="24" y="12" width="4" height="2" fill="#00FFFF" opacity="0.5"/>
      <rect x="10" y="18" width="2" height="2" fill="#FFA500"/>
      <rect x="8" y="20" width="2" height="2" fill="#FFA500"/>
      <rect x="12" y="20" width="2" height="2" fill="#FFA500"/>
      <rect x="16" y="18" width="2" height="2" fill="#FFA500"/>
      <rect x="14" y="20" width="2" height="2" fill="#FFA500"/>
      <rect x="18" y="20" width="2" height="2" fill="#FFA500"/>
    </svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      birdImg.current = img;
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  // Phase timing: radar runs for 2.8s, then fade out for 0.6s
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('fadeout'), 2800);
    const t2 = setTimeout(() => {
      setPhase('done');
      onCompleteRef.current?.();
    }, 3400);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Generate random radar blips once
  useEffect(() => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 0.3 + Math.random() * 0.55;
      pts.push({ angle, dist, size: 18 + Math.random() * 10, opacity: 0 });
    }
    blips.current = pts;
  }, []);

  // Canvas radar animation
  useEffect(() => {
    if (phase !== 'radar' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.7;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 10;
    const sweepSpeed = 0.03;

    let animId;
    const draw = () => {
      // Fade trail
      ctx.fillStyle = 'rgba(0, 8, 16, 0.08)';
      ctx.fillRect(0, 0, size, size);

      // Range rings
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let r = 1; r <= 4; r++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (radius / 4) * r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crosshairs
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.stroke();

      // Sweep beam
      sweepAngle.current += sweepSpeed;
      const angle = sweepAngle.current;
      const grad = ctx.createConicalGradient
        ? null
        : (() => {
            // Fallback: draw sweep as a filled arc with gradient
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            g.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
            g.addColorStop(1, 'rgba(0, 255, 255, 0.05)');
            return g;
          })();

      // Draw sweep cone (trailing glow)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -0.4, 0);
      ctx.closePath();
      const sweepGrad = ctx.createLinearGradient(0, 0, radius, 0);
      sweepGrad.addColorStop(0, 'rgba(0, 255, 255, 0.25)');
      sweepGrad.addColorStop(1, 'rgba(0, 255, 255, 0.02)');
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // Bright leading edge
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(radius, 0);
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Blips — light up when sweep passes over them
      for (const blip of blips.current) {
        const blipAngleNorm = ((blip.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const sweepNorm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        let diff = sweepNorm - blipAngleNorm;
        if (diff < 0) diff += Math.PI * 2;

        if (diff < 0.3) {
          blip.opacity = Math.min(1, blip.opacity + 0.15);
        } else {
          blip.opacity = Math.max(0, blip.opacity - 0.008);
        }

        if (blip.opacity > 0.01) {
          const bx = cx + Math.cos(blip.angle) * blip.dist * radius;
          const by = cy + Math.sin(blip.angle) * blip.dist * radius;
          const s = blip.size;

          ctx.save();
          ctx.globalAlpha = blip.opacity * 0.9;

          if (birdImg.current) {
            // Draw bird sprite centered on blip position
            ctx.drawImage(birdImg.current, bx - s / 2, by - s * 0.375, s, s * 0.75);
            // Glow behind bird
            ctx.globalAlpha = blip.opacity * 0.2;
            ctx.shadowColor = 'rgba(0, 255, 255, 0.8)';
            ctx.shadowBlur = 12;
            ctx.drawImage(birdImg.current, bx - s / 2, by - s * 0.375, s, s * 0.75);
            ctx.shadowBlur = 0;
          } else {
            // Fallback dot if image hasn't loaded yet
            ctx.beginPath();
            ctx.arc(bx, by, 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 255, ${blip.opacity * 0.9})`;
            ctx.fill();
          }

          ctx.restore();
        }
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.fill();

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: '#000f1a' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');

        @keyframes fade-out {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        .radar-glow {
          filter: drop-shadow(0 0 20px rgba(0, 255, 255, 0.3));
        }
        .intro-fadeout {
          animation: fade-out 0.6s ease-out forwards;
        }
      `}</style>

      {/* Radar + Logo (overlaid) */}
      {(phase === 'radar' || phase === 'fadeout') && (
        <div className={`relative flex flex-col items-center justify-center ${phase === 'fadeout' ? 'intro-fadeout' : ''}`}>
          <div className="relative radar-glow">
            <canvas ref={canvasRef} />
          </div>

          {/* Bird + Title overlaid below radar */}
          <div className="flex flex-col items-center mt-6">
            <svg viewBox="0 0 32 24" width="64" height="48" style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 0 10px rgba(0, 255, 255, 0.8))' }} className="mb-2">
              <rect x="12" y="2" width="8" height="2" fill="#00FFFF"/><rect x="10" y="4" width="12" height="2" fill="#00FFFF"/><rect x="10" y="6" width="12" height="2" fill="#00FFFF"/>
              <rect x="12" y="6" width="2" height="2" fill="#000"/><rect x="18" y="6" width="2" height="2" fill="#000"/><rect x="12" y="6" width="1" height="1" fill="#FFF"/><rect x="18" y="6" width="1" height="1" fill="#FFF"/>
              <rect x="22" y="6" width="4" height="2" fill="#FFA500"/><rect x="22" y="8" width="2" height="2" fill="#FFA500"/>
              <rect x="8" y="8" width="14" height="2" fill="#00FFFF"/><rect x="6" y="10" width="16" height="2" fill="#00FFFF"/><rect x="6" y="12" width="16" height="2" fill="#00FFFF"/><rect x="6" y="14" width="16" height="2" fill="#00FFFF"/><rect x="8" y="16" width="14" height="2" fill="#00FFFF"/>
              <rect x="4" y="10" width="2" height="2" fill="#00FFFF" opacity="0.8"/><rect x="2" y="12" width="4" height="2" fill="#00FFFF" opacity="0.8"/>
              <rect x="22" y="14" width="4" height="2" fill="#00FFFF" opacity="0.7"/><rect x="24" y="12" width="4" height="2" fill="#00FFFF" opacity="0.5"/>
              <rect x="10" y="18" width="2" height="2" fill="#FFA500"/><rect x="8" y="20" width="2" height="2" fill="#FFA500"/><rect x="12" y="20" width="2" height="2" fill="#FFA500"/>
              <rect x="16" y="18" width="2" height="2" fill="#FFA500"/><rect x="14" y="20" width="2" height="2" fill="#FFA500"/><rect x="18" y="20" width="2" height="2" fill="#FFA500"/>
            </svg>
            <div className="text-4xl sm:text-5xl font-bold text-white tracking-[0.2em]"
                 style={{ fontFamily: 'VT323, monospace', textShadow: '0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.4)' }}>
              WEATHERBIRD
            </div>
          </div>
        </div>
      )}

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)' }}
      />
    </div>
  );
};

export default CRTPowerOn;
