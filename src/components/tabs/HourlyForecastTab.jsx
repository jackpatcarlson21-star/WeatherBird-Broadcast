import React, { useState } from 'react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';
import { formatTime, isNight } from '../../utils/helpers';
import { AnimatedWeatherIcon } from '../weather';

const W = 560;
const H = 200;
const PAD = { top: 26, right: 16, bottom: 44, left: 48 };

// ─── Hourly line/area chart ────────────────────────────────────────────────────

const HourlyChart = ({ data, title, lines, formatTick, isArea }) => {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allValues = data.flatMap(h =>
    lines.map(l => l.getValue(h)).filter(v => v != null)
  );
  if (!allValues.length) return null;

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const pad    = (rawMax - rawMin) * 0.2 || 2;
  const minVal = isArea ? 0 : rawMin - pad;
  const maxVal = rawMax + pad;
  const range  = maxVal - minVal;

  const xPos = (i) => PAD.left + (i / Math.max(data.length - 1, 1)) * innerW;
  const yPos = (v) => PAD.top + innerH - ((v - minVal) / range) * innerH;
  const chartBottom = PAD.top + innerH;

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = isArea
      ? (rawMax * i / 4)
      : rawMin + ((rawMax - rawMin) * i / 4);
    return { v, y: yPos(v) };
  });

  const clipId = `clip-h-${title.replace(/\W/g, '')}`;

  return (
    <div className="p-3 rounded-lg border border-cyan-800 bg-black/20">
      <div className="text-cyan-300 text-sm tracking-widest mb-2 font-bold">{title}</div>

      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ fontFamily: 'VT323, monospace', overflow: 'visible' }}
      >
        <defs>
          {lines.map(l => (
            <filter key={l.key} id={`glow-h-${l.key}`}>
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {/* Grid lines + Y labels */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={tick.y} x2={W - PAD.right} y2={tick.y}
              stroke="rgba(0,255,255,0.1)" strokeWidth="1" strokeDasharray="4,4" />
            <text x={PAD.left - 6} y={tick.y + 5} textAnchor="end"
              fill="rgba(0,255,255,0.45)" fontSize="14">
              {formatTick ? formatTick(tick.v) : Math.round(tick.v)}
            </text>
          </g>
        ))}

        {/* Chart border */}
        <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH}
          fill="none" stroke="rgba(0,255,255,0.2)" strokeWidth="1" />

        {/* NOW marker */}
        <line x1={xPos(0)} y1={PAD.top - 5} x2={xPos(0)} y2={chartBottom}
          stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3,3" />
        <text x={xPos(0)} y={PAD.top - 8} textAnchor="middle"
          fill="rgba(255,255,255,0.55)" fontSize="12" letterSpacing="1">NOW</text>

        {/* Area fill for first line */}
        {isArea && (() => {
          const pts = data.map((h, i) => {
            const v = lines[0].getValue(h);
            return v != null ? { x: xPos(i), y: yPos(v) } : null;
          }).filter(Boolean);
          if (pts.length < 2) return null;
          const d = `M ${pts[0].x},${chartBottom} L ${pts.map(p => `${p.x},${p.y}`).join(' L ')} L ${pts[pts.length - 1].x},${chartBottom} Z`;
          return (
            <path d={d} fill={lines[0].color} fillOpacity="0.2"
              clipPath={`url(#${clipId})`} />
          );
        })()}

        {/* Lines */}
        {lines.map(l => {
          const pts = data.map((h, i) => {
            const v = l.getValue(h);
            return v != null ? `${xPos(i)},${yPos(v)}` : null;
          }).filter(Boolean);
          if (pts.length < 2) return null;
          return (
            <path key={l.key}
              d={`M ${pts.join(' L ')}`}
              fill="none"
              stroke={l.color}
              strokeWidth={l.width ?? 2}
              strokeDasharray={l.dash ?? 'none'}
              strokeOpacity={l.opacity ?? 1}
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={`url(#glow-h-${l.key})`}
              clipPath={`url(#${clipId})`}
            />
          );
        })}

        {/* Dots */}
        {lines.map(l =>
          data.map((h, i) => {
            const v = l.getValue(h);
            if (v == null) return null;
            return (
              <circle key={`${l.key}-${i}`}
                cx={xPos(i)} cy={yPos(v)} r="4.5"
                fill={l.color}
                filter={`url(#glow-h-${l.key})`}
              >
                <title>{h.time}: {formatTick ? formatTick(v) : v}</title>
              </circle>
            );
          })
        )}

        {/* X axis time labels */}
        {data.map((h, i) => (
          <text key={i} x={xPos(i)} y={chartBottom + 16} textAnchor="middle"
            fill={i === 0 ? 'rgba(255,255,255,0.75)' : 'rgba(0,255,255,0.5)'}
            fontSize="14">
            {h.time}
          </text>
        ))}
      </svg>

      {/* Legend for multi-line charts */}
      {lines.length > 1 && (
        <div className="flex gap-4 mt-2 text-xs">
          {lines.map(l => (
            <div key={l.key} className="flex items-center gap-1.5">
              <svg width="20" height="8">
                <line x1="0" y1="4" x2="20" y2="4"
                  stroke={l.color} strokeWidth="2"
                  strokeDasharray={l.dash ?? 'none'} />
              </svg>
              <span style={{ color: l.color }}>{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── View toggle ───────────────────────────────────────────────────────────────

const ViewToggle = ({ viewMode, setViewMode }) => (
  <div className="flex items-center gap-1 bg-black/30 border border-cyan-800 rounded-lg p-1">
    {['TABLE', 'GRAPH'].map(mode => (
      <button
        key={mode}
        onClick={() => setViewMode(mode.toLowerCase())}
        className={`px-3 py-1 rounded text-xs tracking-widest transition-all ${
          viewMode === mode.toLowerCase()
            ? 'bg-cyan-800 text-cyan-200 shadow-inner'
            : 'text-cyan-700 hover:text-cyan-400'
        }`}
      >
        {mode}
      </button>
    ))}
  </div>
);

// ─── Tab ───────────────────────────────────────────────────────────────────────

const HourlyForecastTab = ({ hourly, sunrise, sunset, isWeatherLoading }) => {
  const [viewMode, setViewMode] = useState('table');

  if (isWeatherLoading) return <LoadingIndicator />;

  const now = new Date();
  let startIndex = 0;
  if (hourly?.time) {
    for (let i = 0; i < hourly.time.length; i++) {
      const hourTime = new Date(hourly.time[i]);
      if (hourTime >= now) { startIndex = i; break; }
      if (i === hourly.time.length - 1) startIndex = i;
    }
  }

  const data = hourly?.time ? hourly.time.slice(startIndex, startIndex + 12).map((time, i) => {
    const idx = startIndex + i;
    const hourDate = new Date(time);
    return {
      time:      i === 0 ? 'NOW' : formatTime(time),
      temp:      Math.round(hourly.temperature_2m[idx]),
      feelsLike: Math.round(hourly.apparent_temperature?.[idx] ?? hourly.temperature_2m[idx]),
      pop:       Math.round(hourly.precipitation_probability[idx]),
      code:      hourly.weather_code[idx],
      wind:      Math.round(hourly.wind_speed_10m[idx]),
      humidity:  Math.round(hourly.relative_humidity_2m?.[idx] ?? 0),
      snowfall:  hourly.snowfall?.[idx] ?? 0,
      night:     isNight(hourDate, sunrise, sunset),
    };
  }) : [];

  const hasSomeSnow = data.some(h => h.snowfall > 0);

  return (
    <TabPanel title="12-HOUR FORECAST">

      {/* Toggle */}
      <div className="flex justify-end mb-3">
        <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
      </div>

      {/* ── Table view ── */}
      {viewMode === 'table' && (
        <>
          <div className="flex items-center px-2 sm:px-3 py-2 text-xs text-cyan-500 border-b border-cyan-800/50 mb-1">
            <div className="w-14 sm:w-20">TIME</div>
            <div className="w-10 sm:w-16 text-center"></div>
            <div className="flex-1 text-center">TEMP</div>
            <div className="w-12 sm:w-16 text-center">RAIN</div>
            <div className="hidden sm:block w-16 text-center">HUMIDITY</div>
            <div className="hidden sm:block w-16 text-center">WIND</div>
            {hasSomeSnow && <div className="hidden sm:block w-16 text-center">SNOW</div>}
          </div>

          <div className="space-y-0.5">
            {data.map((h, index) => (
              <div
                key={index}
                className={`flex items-center px-2 sm:px-3 py-2.5 rounded-md transition-colors
                  ${index === 0
                    ? 'bg-cyan-900/50 border border-cyan-500/50'
                    : index % 2 === 0 ? 'bg-black/20' : 'bg-black/10'}`}
              >
                <div className="w-14 sm:w-20">
                  <p className={`text-sm sm:text-base font-bold font-vt323 ${index === 0 ? 'text-cyan-300' : 'text-cyan-400'}`}>
                    {h.time}
                  </p>
                </div>
                <div className="w-10 sm:w-16 flex justify-center">
                  <AnimatedWeatherIcon code={h.code} night={h.night} size={28} />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xl sm:text-2xl font-bold text-white">{h.temp}°F</span>
                  {h.feelsLike !== h.temp && (
                    <span className="text-xs text-gray-400 ml-2">({h.feelsLike}°)</span>
                  )}
                </div>
                <div className="w-12 sm:w-16 text-center">
                  <span className={`text-sm sm:text-base font-bold ${h.pop >= 50 ? 'text-blue-400' : h.pop >= 20 ? 'text-blue-300' : 'text-gray-400'}`}>
                    {h.pop}%
                  </span>
                </div>
                <div className="hidden sm:block w-16 text-center">
                  <span className={`text-sm text-gray-300 ${h.humidity >= 80 ? 'text-blue-300' : ''}`}>
                    {h.humidity}%
                  </span>
                </div>
                <div className="hidden sm:block w-16 text-center">
                  <span className="text-sm text-gray-300">{h.wind} mph</span>
                </div>
                {hasSomeSnow && (
                  <div className="hidden sm:block w-16 text-center">
                    <span className={`text-sm font-bold ${h.snowfall > 0 ? 'text-purple-300' : 'text-gray-600'}`}>
                      {h.snowfall > 0 ? `${h.snowfall.toFixed(1)}"` : '--'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Graph view ── */}
      {viewMode === 'graph' && (
        <div className="space-y-4">
          <HourlyChart
            data={data}
            title="TEMPERATURE (°F)"
            formatTick={v => `${Math.round(v)}°`}
            lines={[
              { key: 'temp',      label: 'Temp',       getValue: h => h.temp,      color: '#67E8F9', width: 2.5 },
              { key: 'feelsLike', label: 'Feels Like', getValue: h => h.feelsLike, color: '#94A3B8', width: 1.5, dash: '5,3', opacity: 0.85 },
            ]}
          />
          <HourlyChart
            data={data}
            title="RAIN CHANCE (%)"
            formatTick={v => `${Math.round(v)}%`}
            isArea
            lines={[
              { key: 'pop', label: 'Rain Chance', getValue: h => h.pop, color: '#60A5FA', width: 2 },
            ]}
          />
          <HourlyChart
            data={data}
            title="WIND SPEED (MPH)"
            formatTick={v => `${Math.round(v)}`}
            lines={[
              { key: 'wind', label: 'Wind', getValue: h => h.wind, color: '#A78BFA', width: 2 },
            ]}
          />
          {hasSomeSnow && (
            <HourlyChart
              data={data}
              title="SNOWFALL (IN)"
              formatTick={v => `${v.toFixed(1)}"`}
              isArea
              lines={[
                { key: 'snow', label: 'Snowfall', getValue: h => h.snowfall, color: '#C4B5FD', width: 2 },
              ]}
            />
          )}
        </div>
      )}

    </TabPanel>
  );
};

export default HourlyForecastTab;
