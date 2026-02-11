import React from 'react';

const Scanlines = () => (
  <div className="pointer-events-none absolute inset-0 z-50 crt-container">
    {/* Scanlines - more visible */}
    <div className="absolute inset-0 opacity-40">
      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_3px]" />
    </div>

    {/* Heavy vignette for CRT curve illusion */}
    <div className="absolute inset-0 crt-vignette" />

    {/* RGB color separation on edges */}
    <div className="absolute inset-0 crt-rgb" />

    {/* Screen glare/reflection */}
    <div className="absolute inset-0 crt-glare" />

    <style>{`
      /* Main container gets slight curve on edges */
      .crt-container {
        border-radius: 20px;
        overflow: hidden;
      }

      /* Heavy vignette - dark edges, bright center */
      .crt-vignette {
        background: radial-gradient(
          ellipse 70% 70% at 50% 50%,
          transparent 0%,
          transparent 50%,
          rgba(0, 0, 0, 0.4) 80%,
          rgba(0, 0, 0, 0.8) 100%
        );
      }

      /* RGB color fringing on edges like real CRT */
      .crt-rgb {
        background:
          radial-gradient(ellipse at 10% 50%, rgba(255, 0, 0, 0.08) 0%, transparent 30%),
          radial-gradient(ellipse at 90% 50%, rgba(0, 0, 255, 0.08) 0%, transparent 30%),
          radial-gradient(ellipse at 50% 5%, rgba(0, 255, 0, 0.05) 0%, transparent 25%),
          radial-gradient(ellipse at 50% 95%, rgba(0, 255, 0, 0.05) 0%, transparent 25%);
      }

      /* Screen glare - reflection highlight */
      .crt-glare {
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.1) 0%,
          transparent 30%,
          transparent 70%,
          rgba(255, 255, 255, 0.03) 100%
        );
      }
    `}</style>
  </div>
);

export default Scanlines;
