import React from 'react';

const WeatherBackground = ({ weatherCode, night }) => {
  const code = weatherCode || 0;

  // Rain: codes 51-67, 80-82, 95+
  const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  // Snow: codes 71-77, 85-86
  const isSnow = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
  // Clear night: stars
  const isStarry = code === 0 && night;
  // Cloudy: codes 1-3
  const isCloudy = code >= 1 && code <= 3;
  // Thunderstorm flash overlay
  const isThunder = code >= 95;

  return (
    <div className="weather-particles">
      {isRain && (
        <>
          <div className="particle-rain" />
          <div className="particle-rain" />
          <div className="particle-rain" />
          <div className="particle-rain" />
          <div className="particle-rain" />
          <div className="particle-rain" />
          <div className="particle-rain" />
          <div className="particle-rain" />
          <div className="particle-rain" />
          <div className="particle-rain" />
        </>
      )}

      {isSnow && (
        <>
          <div className="particle-snow" />
          <div className="particle-snow" />
          <div className="particle-snow" />
          <div className="particle-snow" />
          <div className="particle-snow" />
          <div className="particle-snow" />
          <div className="particle-snow" />
          <div className="particle-snow" />
        </>
      )}

      {isStarry && (
        <>
          <div className="particle-star" />
          <div className="particle-star" />
          <div className="particle-star" />
          <div className="particle-star" />
          <div className="particle-star" />
          <div className="particle-star" />
          <div className="particle-star" />
        </>
      )}

      {isCloudy && (
        <>
          <div className="particle-cloud">&#9729;</div>
          <div className="particle-cloud">&#9729;</div>
          <div className="particle-cloud">&#9729;</div>
          <div className="particle-cloud">&#9729;</div>
          <div className="particle-cloud">&#9729;</div>
        </>
      )}

      {isThunder && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            animation: 'alertFlash 4s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
};

export default WeatherBackground;
