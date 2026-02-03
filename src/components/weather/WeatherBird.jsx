import React from 'react';

const WeatherBird = ({ temp, weatherCode, windSpeed, night }) => {
  let bird = "🐦";
  let message = "";
  let animation = "";
  let accessory = "";

  // Determine bird state based on conditions
  if (weatherCode >= 95) {
    // Thunderstorm
    bird = "🐦";
    accessory = "⚡";
    message = "YIKES! Stay safe inside!";
    animation = "animate-bounce";
  } else if (weatherCode >= 71 && weatherCode <= 77) {
    // Snow
    bird = "🐦";
    accessory = "❄️";
    message = "Brrr! Bundle up out there!";
    animation = "animate-pulse";
  } else if (weatherCode >= 51 && weatherCode <= 67) {
    // Rain
    bird = "🐦";
    accessory = "☔";
    message = "Don't forget your umbrella!";
    animation = "";
  } else if (windSpeed >= 25) {
    // Very windy
    bird = "🐦";
    accessory = "💨";
    message = "Hold onto your feathers!";
    animation = "animate-wiggle";
  } else if (temp <= 32) {
    // Freezing
    bird = "🥶";
    accessory = "🧣";
    message = "It's freezing! Stay warm!";
    animation = "animate-shiver";
  } else if (temp >= 90) {
    // Hot
    bird = "🐦";
    accessory = "😎";
    message = "Whew! It's a hot one!";
    animation = "animate-pulse";
  } else if (weatherCode === 0 && !night) {
    // Clear and sunny
    bird = "🐦";
    accessory = "☀️";
    message = "Beautiful day! Get outside!";
    animation = "animate-happy";
  } else if (night && weatherCode === 0) {
    // Clear night
    bird = "🦉";
    accessory = "🌙";
    message = "What a lovely night!";
    animation = "";
  } else if (weatherCode <= 3) {
    // Partly cloudy
    bird = "🐦";
    accessory = "⛅";
    message = "Looking pretty nice today!";
    animation = "";
  } else {
    // Default
    bird = "🐦";
    accessory = "";
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
      <div className={`text-6xl ${animation}`}>
        <span className="relative">
          {bird}
          {accessory && <span className="absolute -top-2 -right-4 text-3xl">{accessory}</span>}
        </span>
      </div>
      <p className="text-cyan-300 font-vt323 text-lg mt-2 text-center">{message}</p>
    </div>
  );
};

export default WeatherBird;
