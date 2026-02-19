import React from 'react';
import { DARK_BLUE, NAVY_BLUE, BRIGHT_CYAN } from '../../utils/constants';
import { getWeatherDescription, formatTime } from '../../utils/helpers';

const Footer = ({ current, daily, locationName, alerts }) => {
  const temp = current ? Math.round(current.temperature_2m) : '--';
  const cond = current ? getWeatherDescription(current.weather_code) : 'LOADING';
  const wind = current ? `${Math.round(current.wind_speed_10m)} MPH` : '--';
  const feelsLike = current ? Math.round(current.apparent_temperature) : '--';
  const high = daily?.temperature_2m_max?.[0] != null ? Math.round(daily.temperature_2m_max[0]) : '--';
  const low = daily?.temperature_2m_min?.[0] != null ? Math.round(daily.temperature_2m_min[0]) : '--';
  const sunrise = daily?.sunrise?.[0] ? formatTime(daily.sunrise[0]) : '--';
  const sunset = daily?.sunset?.[0] ? formatTime(daily.sunset[0]) : '--';
  const hasAlerts = alerts && alerts.length > 0;

  // Construct Alerts Text
  let alertText = "";
  if (hasAlerts) {
    alertText = alerts.map(a => ` ${a.properties.headline.toUpperCase()} `).join(" ::: ");
    alertText += " ::: "; // Spacer
  }

  // Ticker Text Construction
  const baseText = `CURRENTLY IN ${locationName.toUpperCase()}: ${temp}°F ${cond} - FEELS LIKE: ${feelsLike}°F - WIND: ${wind} ::: HIGH: ${high}°F / LOW: ${low}°F ::: SUNRISE: ${sunrise} / SUNSET: ${sunset} ::: WE LOVE YOU SHANNON! ::: CAW CAW! ::: THANK YOU FOR USING WEATHERBIRD! ::: `;

  // If alerts exist, put them FIRST
  const tickerText = alertText ? `${alertText} ${baseText}` : baseText;

  return (
    <footer
      className={`h-12 shrink-0 flex items-center relative overflow-hidden ${hasAlerts ? 'alert-glow-border' : ''}`}
      style={{
        background: `linear-gradient(to top, ${NAVY_BLUE}, ${DARK_BLUE})`,
        borderTop: `4px solid ${hasAlerts ? '#EF4444' : BRIGHT_CYAN}`,
        transition: 'border-top-color 0.5s ease',
      }}
    >
      {/* Scrolling Ticker - Full Width */}
      <div className="w-full relative h-full flex items-center overflow-hidden bg-black/20">
        <div className={`whitespace-nowrap font-vt323 text-base sm:text-xl px-4 tracking-widest absolute ${alerts && alerts.length > 0 ? 'text-red-300 font-bold animate-marquee-slow' : 'text-cyan-300 animate-marquee'}`}>
          {tickerText.repeat(3)}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 60s linear infinite;
          will-change: transform;
        }
        .animate-marquee-slow {
          animation: marquee 120s linear infinite;
          will-change: transform;
        }
      `}</style>
    </footer>
  );
};

export default Footer;
