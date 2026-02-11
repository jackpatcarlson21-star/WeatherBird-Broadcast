import React from 'react';

const PixelBird = ({ bodyColor = '#00FFFF' }) => (
  <svg
    viewBox="0 0 32 32"
    width="64"
    height="64"
    style={{ imageRendering: 'pixelated' }}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Head */}
    <rect x="12" y="4" width="8" height="2" fill={bodyColor} />
    <rect x="10" y="6" width="12" height="2" fill={bodyColor} />
    <rect x="10" y="8" width="12" height="2" fill={bodyColor} />
    {/* Eyes */}
    <rect x="12" y="8" width="2" height="2" fill="#000" />
    <rect x="18" y="8" width="2" height="2" fill="#000" />
    {/* Eye shine */}
    <rect x="12" y="8" width="1" height="1" fill="#FFF" />
    <rect x="18" y="8" width="1" height="1" fill="#FFF" />
    {/* Beak */}
    <rect x="22" y="8" width="4" height="2" fill="#FFA500" />
    <rect x="22" y="10" width="2" height="2" fill="#FFA500" />
    {/* Body */}
    <rect x="8" y="10" width="14" height="2" fill={bodyColor} />
    <rect x="6" y="12" width="16" height="2" fill={bodyColor} />
    <rect x="6" y="14" width="16" height="2" fill={bodyColor} />
    <rect x="6" y="16" width="16" height="2" fill={bodyColor} />
    <rect x="8" y="18" width="14" height="2" fill={bodyColor} />
    {/* Belly highlight */}
    <rect x="12" y="14" width="6" height="4" fill={bodyColor} opacity="0.6" />
    {/* Wing */}
    <rect x="4" y="12" width="2" height="2" fill={bodyColor} opacity="0.8" />
    <rect x="2" y="14" width="4" height="2" fill={bodyColor} opacity="0.8" />
    <rect x="2" y="16" width="2" height="2" fill={bodyColor} opacity="0.6" />
    {/* Tail */}
    <rect x="22" y="16" width="4" height="2" fill={bodyColor} opacity="0.7" />
    <rect x="24" y="14" width="4" height="2" fill={bodyColor} opacity="0.5" />
    {/* Feet */}
    <rect x="10" y="20" width="2" height="2" fill="#FFA500" />
    <rect x="8" y="22" width="2" height="2" fill="#FFA500" />
    <rect x="12" y="22" width="2" height="2" fill="#FFA500" />
    <rect x="16" y="20" width="2" height="2" fill="#FFA500" />
    <rect x="14" y="22" width="2" height="2" fill="#FFA500" />
    <rect x="18" y="22" width="2" height="2" fill="#FFA500" />
  </svg>
);

const WeatherBird = ({ temp, weatherCode, windSpeed, night }) => {
  let message = "";
  let animation = "";
  let accessory = "";
  let bodyColor = "#00FFFF"; // cyan default

  // Determine bird state based on conditions
  if (weatherCode >= 95) {
    bodyColor = "#FACC15"; // yellow for storms
    accessory = "\u26A1";
    message = "YIKES! Stay safe inside!";
    animation = "animate-bounce";
  } else if (weatherCode >= 71 && weatherCode <= 77) {
    bodyColor = "#93C5FD"; // light blue for snow
    accessory = "\u2744\uFE0F";
    message = "Brrr! Bundle up out there!";
    animation = "animate-pulse";
  } else if (weatherCode >= 51 && weatherCode <= 67) {
    bodyColor = "#60A5FA"; // blue for rain
    accessory = "\u2614";
    message = "Don't forget your umbrella!";
    animation = "";
  } else if (windSpeed >= 25) {
    accessory = "\uD83D\uDCA8";
    message = "Hold onto your feathers!";
    animation = "animate-wiggle";
  } else if (temp <= 32) {
    bodyColor = "#60A5FA"; // blue for cold
    accessory = "\uD83E\uDDE3";
    message = "It's freezing! Stay warm!";
    animation = "animate-shiver";
  } else if (temp >= 90) {
    bodyColor = "#FB923C"; // orange for hot
    accessory = "\uD83D\uDE0E";
    message = "Whew! It's a hot one!";
    animation = "animate-pulse";
  } else if (weatherCode === 0 && !night) {
    accessory = "\u2600\uFE0F";
    message = "Beautiful day! Get outside!";
    animation = "animate-happy";
  } else if (night && weatherCode === 0) {
    bodyColor = "#6366F1"; // indigo for night
    accessory = "\uD83C\uDF19";
    message = "What a lovely night!";
    animation = "";
  } else if (weatherCode <= 3) {
    accessory = "\u26C5";
    message = "Looking pretty nice today!";
    animation = "";
  } else {
    message = "CAW CAW!";
    animation = "";
  }

  return (
    <div className="flex flex-col items-center p-4 rounded-lg border-2 border-cyan-600 bg-black/30">
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes shiver {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        @keyframes happy {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-wiggle { animation: wiggle 0.3s ease-in-out infinite; }
        .animate-shiver { animation: shiver 0.1s ease-in-out infinite; }
        .animate-happy { animation: happy 0.5s ease-in-out infinite; }
      `}</style>
      <div className={`${animation}`}>
        <span className="relative inline-block">
          <PixelBird bodyColor={bodyColor} />
          {accessory && <span className="absolute -top-2 -right-4 text-3xl">{accessory}</span>}
        </span>
      </div>
      <p className="text-cyan-300 font-vt323 text-lg mt-2 text-center">{message}</p>
    </div>
  );
};

export default WeatherBird;
