import React from 'react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';

const W = 560;
const H = 200;
const PAD = { top: 26, right: 16, bottom: 44, left: 50 };

// ─── Reusable SVG chart ────────────────────────────────────────────────────────

const PrecipChart = ({ data, title, lines, formatTick, threshold }) => {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allValues = data.flatMap(h =>
    lines.map(l => l.getValue(h)).filter(v => v != null)
  );
  if (!allValues.length) return null;

  const rawMin = 0;
  const rawMax = Math.max(...allValues);
  const padTop  = rawMax * 0.18 || 0.05;
  const minVal  = 0;
  const maxVal  = rawMax + padTop;
  const range   = maxVal - minVal || 1;

  const xPos = (i) => PAD.left + (i / Math.max(data.length - 1, 1)) * innerW;
  const yPos = (v) => PAD.top + innerH - ((v - minVal) / range) * innerH;
  const chartBottom = PAD.top + innerH;

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = rawMax * i / 4;
    return { v, y: yPos(v) };
  });

  const clipId = `clip-p-${title.replace(/\W/g, '')}`;

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
            <filter key={l.key} id={`glow-p-${l.key}`}>
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
          {/* Gradient fills — fade from line color at top to transparent at bottom */}
          {lines.map(l => (
            <linearGradient key={`grad-${l.key}`} id={`grad-p-${l.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={l.color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={l.color} stopOpacity="0"   />
            </linearGradient>
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
              {formatTick ? formatTick(tick.v) : tick.v.toFixed(2)}
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

        {/* Area fills with gradient */}
        {lines.map(l => {
          const pts = data.map((h, i) => {
            const v = l.getValue(h);
            return v != null ? { x: xPos(i), y: yPos(v) } : null;
          }).filter(Boolean);
          if (pts.length < 2) return null;
          const d = `M ${pts[0].x},${chartBottom} L ${pts.map(p => `${p.x},${p.y}`).join(' L ')} L ${pts[pts.length - 1].x},${chartBottom} Z`;
          return (
            <path key={`area-${l.key}`} d={d}
              fill={`url(#grad-p-${l.key})`}
              clipPath={`url(#${clipId})`} />
          );
        })}

        {/* 50% threshold line */}
        {threshold != null && (() => {
          const ty = yPos(threshold);
          return (
            <g>
              <line x1={PAD.left} y1={ty} x2={W - PAD.right} y2={ty}
                stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="5,3" />
              <text x={W - PAD.right + 4} y={ty + 4} textAnchor="start"
                fill="rgba(255,255,255,0.45)" fontSize="12">
                {formatTick ? formatTick(threshold) : threshold}
              </text>
            </g>
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
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={`url(#glow-p-${l.key})`}
              clipPath={`url(#${clipId})`}
            />
          );
        })}

        {/* Dots — color and size scaled by intensity */}
        {lines.map(l =>
          data.map((h, i) => {
            const v = l.getValue(h);
            if (v == null || v === 0) return null;
            const dotColor = l.getIntensityColor ? l.getIntensityColor(v) : l.color;
            const dotSize  = l.getIntensitySize  ? l.getIntensitySize(v)  : 4.5;
            return (
              <circle key={`${l.key}-${i}`}
                cx={xPos(i)} cy={yPos(v)} r={dotSize}
                fill={dotColor}
                filter={`url(#glow-p-${l.key})`}
              >
                <title>{h.time}: {formatTick ? formatTick(v) : v.toFixed(2)}{l.intensityLabel ? ` · ${l.intensityLabel(v)}` : ''}</title>
              </circle>
            );
          })
        )}

        {/* Peak annotations */}
        {lines.map(l => {
          const vals = data.map(h => l.getValue(h) ?? 0);
          const peak = Math.max(...vals);
          if (peak <= 0) return null;
          const peakIdx = vals.indexOf(peak);
          const px = xPos(peakIdx);
          const py = yPos(peak);
          const anchor = peakIdx < 2 ? 'start' : peakIdx > data.length - 3 ? 'end' : 'middle';
          return (
            <g key={`peak-${l.key}`}>
              <line x1={px} y1={py - 6} x2={px} y2={py - 22}
                stroke={l.color} strokeWidth="1" strokeOpacity="0.7" />
              <text x={px} y={py - 26} textAnchor={anchor}
                fill={l.color} fontSize="14" fontWeight="bold"
                filter={`url(#glow-p-${l.key})`}>
                {formatTick ? formatTick(peak) : peak}
              </text>
            </g>
          );
        })}

        {/* X axis time labels */}
        {data.map((h, i) => (
          <text key={i} x={xPos(i)} y={chartBottom + 16} textAnchor="middle"
            fill={i === 0 ? 'rgba(255,255,255,0.75)' : 'rgba(0,255,255,0.5)'}
            fontSize="14">
            {h.time}
          </text>
        ))}
      </svg>

      {/* Line legend (multi-line charts) */}
      {lines.length > 1 && (
        <div className="flex gap-4 mt-2 text-xs">
          {lines.map(l => (
            <div key={l.key} className="flex items-center gap-1.5">
              <svg width="20" height="8">
                <line x1="0" y1="4" x2="20" y2="4" stroke={l.color} strokeWidth="2" />
              </svg>
              <span style={{ color: l.color }}>{l.label}</span>
            </div>
          ))}
        </div>
      )}
      {/* Intensity legend */}
      {lines.some(l => l.intensityStops) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-cyan-600">
          {lines.flatMap(l => (l.intensityStops || []).map(s => (
            <span key={s.label} className="flex items-center gap-1">
              <svg width="10" height="10">
                <circle cx="5" cy="5" r={s.r} fill={s.color} />
              </svg>
              {s.label}
            </span>
          )))}
        </div>
      )}
    </div>
  );
};

// ─── Tab ───────────────────────────────────────────────────────────────────────

const PrecipGraphTab = ({ hourly, isWeatherLoading }) => {
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
    const idx  = startIndex + i;
    const rain = hourly.rain?.[idx] ?? 0;
    const snow = hourly.snowfall?.[idx] ?? 0;
    return {
      time:        i === 0 ? 'NOW' : new Date(time).toLocaleTimeString([], { hour: 'numeric' }),
      probability: Math.round(hourly.precipitation_probability?.[idx] ?? 0),
      rain, snow,
      amount:  snow > 0 ? snow : rain,
      hasSnow: snow > 0,
      hasRain: rain > 0,
    };
  }) : [];

  const hasSnow     = data.some(h => h.hasSnow);
  const totalRain   = data.reduce((s, d) => s + d.rain, 0);
  const totalSnow   = data.reduce((s, d) => s + d.snow, 0);
  const totalPrecip = data.reduce((s, d) => s + d.amount, 0);
  const avgProb     = data.length ? Math.round(data.reduce((s, d) => s + d.probability, 0) / data.length) : 0;
  const peakProb    = data.reduce((m, d) => d.probability > m.probability ? d : m, { probability: 0, time: '--' });
  const peakAmount  = data.reduce((m, d) => d.amount > m.amount ? d : m, { amount: 0, time: '--', hasSnow: false });

  return (
    <TabPanel title="12-HOUR PRECIPITATION">

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
          <p className="text-xs text-cyan-400 mb-1">AVG CHANCE</p>
          <p className="text-2xl font-bold text-white">{avgProb}%</p>
        </div>
        <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
          <p className="text-xs text-cyan-400 mb-1">PEAK CHANCE</p>
          <p className="text-2xl font-bold text-white">{peakProb.probability}%</p>
          <p className="text-xs text-cyan-300">{peakProb.time}</p>
        </div>
        <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
          <p className="text-xs text-cyan-400 mb-1">12HR TOTAL</p>
          <p className="text-2xl font-bold text-white">{totalPrecip.toFixed(2)}"</p>
          {totalSnow > 0 && <p className="text-xs text-purple-300">❄️ {totalSnow.toFixed(2)}" snow</p>}
        </div>
        <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
          <p className="text-xs text-cyan-400 mb-1">PEAK HOUR</p>
          <p className="text-2xl font-bold text-white">{peakAmount.amount.toFixed(2)}"</p>
          <p className="text-xs text-cyan-300">{peakAmount.time}{peakAmount.hasSnow ? ' ❄️' : ''}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Rain chance chart */}
        <PrecipChart
          data={data}
          title="CHANCE OF PRECIPITATION (%)"
          formatTick={v => `${Math.round(v)}%`}
          threshold={50}
          lines={[{
            key: 'prob', label: 'Rain Chance', getValue: h => h.probability, color: '#60A5FA',
            getIntensityColor: v => v >= 70 ? '#FFFFFF' : v >= 50 ? '#60A5FA' : v >= 30 ? '#22D3EE' : '#475569',
            getIntensitySize:  v => v >= 70 ? 7 : v >= 50 ? 6 : v >= 30 ? 5 : 4,
            intensityLabel:    v => v >= 70 ? 'Very likely' : v >= 50 ? 'Likely' : v >= 30 ? 'Possible' : 'Unlikely',
            intensityStops: [
              { label: 'Unlikely (<30%)',  color: '#475569', r: 4 },
              { label: 'Possible (30%+)',  color: '#22D3EE', r: 5 },
              { label: 'Likely (50%+)',    color: '#60A5FA', r: 6 },
              { label: 'Very likely (70%+)', color: '#FFFFFF', r: 7 },
            ],
          }]}
        />

        {/* Amount chart */}
        <PrecipChart
          data={data}
          title="EXPECTED AMOUNT (IN)"
          formatTick={v => `${v.toFixed(2)}"`}
          lines={[
            {
              key: 'rain', label: 'Rain', getValue: h => h.rain, color: '#38BDF8',
              getIntensityColor: v => v >= 0.5 ? '#FFFFFF' : v >= 0.25 ? '#38BDF8' : v >= 0.1 ? '#7DD3FC' : '#BAE6FD',
              getIntensitySize:  v => v >= 0.5 ? 8 : v >= 0.25 ? 6.5 : v >= 0.1 ? 5 : 4,
              intensityLabel:    v => v >= 0.5 ? 'Heavy' : v >= 0.25 ? 'Moderate' : v >= 0.1 ? 'Light' : 'Trace',
              intensityStops: [
                { label: 'Trace',    color: '#BAE6FD', r: 4   },
                { label: 'Light',    color: '#7DD3FC', r: 5   },
                { label: 'Moderate', color: '#38BDF8', r: 6.5 },
                { label: 'Heavy',    color: '#FFFFFF', r: 8   },
              ],
            },
            ...(hasSnow ? [{
              key: 'snow', label: 'Snowfall', getValue: h => h.snow, color: '#C4B5FD',
              getIntensityColor: v => v >= 0.5 ? '#FFFFFF' : v >= 0.25 ? '#A78BFA' : v >= 0.1 ? '#C4B5FD' : '#DDD6FE',
              getIntensitySize:  v => v >= 0.5 ? 8 : v >= 0.25 ? 6.5 : v >= 0.1 ? 5 : 4,
              intensityLabel:    v => v >= 0.5 ? 'Heavy' : v >= 0.25 ? 'Moderate' : v >= 0.1 ? 'Light' : 'Trace',
              intensityStops: [
                { label: 'Snow trace',    color: '#DDD6FE', r: 4   },
                { label: 'Snow light',    color: '#C4B5FD', r: 5   },
                { label: 'Snow moderate', color: '#A78BFA', r: 6.5 },
                { label: 'Snow heavy',    color: '#FFFFFF', r: 8   },
              ],
            }] : []),
          ]}
        />
      </div>

    </TabPanel>
  );
};

export default PrecipGraphTab;
