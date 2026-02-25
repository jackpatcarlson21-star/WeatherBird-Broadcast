import React, { useState, useEffect } from 'react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';

const MODELS = [
  { id: 'gfs_seamless',  name: 'GFS',   label: 'American (NOAA)' },
  { id: 'ecmwf_ifs025', name: 'ECMWF', label: 'European' },
  { id: 'icon_seamless', name: 'ICON',  label: 'German (DWD)' },
  { id: 'gem_seamless',  name: 'GEM',   label: 'Canadian' },
];

const MODEL_COLORS = {
  gfs_seamless:  '#60A5FA',
  ecmwf_ifs025: '#4ADE80',
  icon_seamless: '#FACC15',
  gem_seamless:  '#FB923C',
};

const MODEL_TEXT_COLORS = {
  gfs_seamless:  'text-blue-400',
  ecmwf_ifs025: 'text-green-400',
  icon_seamless: 'text-yellow-400',
  gem_seamless:  'text-orange-400',
};

const W = 560;
const H = 195;
const PAD = { top: 22, right: 20, bottom: 52, left: 44 };

const getConfidenceColor = (spread, [low, mid]) => {
  if (spread <= low)  return '#4ADE80';
  if (spread <= mid)  return '#FACC15';
  return '#F87171';
};

const ModelChart = ({ days, modelData, valueKey, title, formatTick, formatTooltip, spreadThresholds }) => {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allValues = days.flatMap((_, i) =>
    MODELS.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null)
  );
  if (!allValues.length) return null;

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const padding = (rawMax - rawMin) * 0.18 || 1;
  const minVal = rawMin - padding;
  const maxVal = rawMax + padding;
  const valRange = maxVal - minVal;

  const xPos = (i) => PAD.left + (i / Math.max(days.length - 1, 1)) * innerW;
  const yPos = (v) => PAD.top + innerH - ((v - minVal) / valRange) * innerH;
  const chartBottom = PAD.top + innerH;

  // Spread fill path
  const spreadTopPts = days.map((_, i) => {
    const vals = MODELS.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null);
    return vals.length ? `${xPos(i)},${yPos(Math.max(...vals))}` : null;
  }).filter(Boolean);
  const spreadBotPts = days.map((_, i) => {
    const vals = MODELS.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null);
    return vals.length ? `${xPos(i)},${yPos(Math.min(...vals))}` : null;
  }).filter(Boolean).reverse();
  const spreadPath = spreadTopPts.length
    ? `M ${spreadTopPts.join(' L ')} L ${spreadBotPts.join(' L ')} Z`
    : '';

  // Consensus (average) line points
  const consensusPts = days.map((_, i) => {
    const vals = MODELS.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null);
    if (!vals.length) return null;
    return `${xPos(i)},${yPos(vals.reduce((a, b) => a + b, 0) / vals.length)}`;
  }).filter(Boolean);

  // Per-day spread for confidence badges
  const daySpreads = days.map((_, i) => {
    const vals = MODELS.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null);
    return vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : 0;
  });

  // Y axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = rawMin + ((rawMax - rawMin) * i / 4);
    return { v, y: yPos(v) };
  });

  const dayLabelY  = chartBottom + 14;
  const badgeY     = chartBottom + 27;
  const badgeSize  = 9;

  return (
    <div className="p-3 rounded-lg border border-cyan-800 bg-black/20">
      <div className="text-cyan-300 text-sm tracking-widest mb-2 font-bold">{title}</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'VT323, monospace', overflow: 'visible' }}>
        <defs>
          <filter id={`glow-${valueKey}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`glow-avg-${valueKey}`}>
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id={`clip-${valueKey}`}>
            <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {/* Spread shaded region */}
        {spreadPath && (
          <path d={spreadPath} fill="rgba(0,255,255,0.13)" clipPath={`url(#clip-${valueKey})`} />
        )}

        {/* Horizontal grid lines + Y labels */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={tick.y} x2={W - PAD.right} y2={tick.y}
              stroke="rgba(0,255,255,0.1)" strokeWidth="1" strokeDasharray="4,4" />
            <text x={PAD.left - 5} y={tick.y + 4} textAnchor="end"
              fill="rgba(0,255,255,0.45)" fontSize="11">
              {formatTick ? formatTick(tick.v) : Math.round(tick.v)}
            </text>
          </g>
        ))}

        {/* Chart border */}
        <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH}
          fill="none" stroke="rgba(0,255,255,0.2)" strokeWidth="1" />

        {/* TODAY vertical marker */}
        <line x1={xPos(0)} y1={PAD.top - 4} x2={xPos(0)} y2={chartBottom}
          stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3,3" />
        <text x={xPos(0)} y={PAD.top - 7} textAnchor="middle"
          fill="rgba(255,255,255,0.55)" fontSize="10" letterSpacing="1">TODAY</text>

        {/* Model lines */}
        {MODELS.map(model => {
          const pts = days.map((_, i) => {
            const v = modelData[model.id]?.daily?.[valueKey]?.[i];
            return v != null ? `${xPos(i)},${yPos(v)}` : null;
          }).filter(Boolean);
          if (pts.length < 2) return null;
          return (
            <path key={model.id}
              d={`M ${pts.join(' L ')}`}
              fill="none"
              stroke={MODEL_COLORS[model.id]}
              strokeWidth="1.5"
              strokeOpacity="0.75"
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={`url(#glow-${valueKey})`}
              clipPath={`url(#clip-${valueKey})`}
            />
          );
        })}

        {/* Consensus (average) line — bright white, thicker */}
        {consensusPts.length >= 2 && (
          <path
            d={`M ${consensusPts.join(' L ')}`}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter={`url(#glow-avg-${valueKey})`}
            clipPath={`url(#clip-${valueKey})`}
          />
        )}

        {/* Dots on model lines with detailed tooltips */}
        {MODELS.map(model =>
          days.map((_, i) => {
            const v = modelData[model.id]?.daily?.[valueKey]?.[i];
            if (v == null) return null;
            const spreadLabel = formatTooltip ? formatTooltip(daySpreads[i]) : `${daySpreads[i].toFixed(1)}`;
            return (
              <circle key={`${model.id}-${i}`}
                cx={xPos(i)} cy={yPos(v)} r="3.5"
                fill={MODEL_COLORS[model.id]}
                filter={`url(#glow-${valueKey})`}
                style={{ cursor: 'crosshair' }}
              >
                <title>{model.name}: {formatTooltip ? formatTooltip(v) : Math.round(v)}{'\n'}Spread this day: {spreadLabel}</title>
              </circle>
            );
          })
        )}

        {/* X axis day labels */}
        {days.map((day, i) => (
          <text key={i} x={xPos(i)} y={dayLabelY} textAnchor="middle"
            fill={i === 0 ? 'rgba(255,255,255,0.75)' : 'rgba(0,255,255,0.5)'}
            fontSize="12">
            {new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'short' }).slice(0, 3).toUpperCase()}
          </text>
        ))}

        {/* Confidence badge row */}
        <text x={PAD.left - 5} y={badgeY + badgeSize - 1} textAnchor="end"
          fill="rgba(0,255,255,0.3)" fontSize="9">CONF</text>
        {days.map((day, i) => {
          const color = getConfidenceColor(daySpreads[i], spreadThresholds);
          const conf = daySpreads[i] <= spreadThresholds[0] ? 'High confidence'
            : daySpreads[i] <= spreadThresholds[1] ? 'Moderate confidence' : 'Low confidence';
          return (
            <rect key={i}
              x={xPos(i) - badgeSize / 2} y={badgeY}
              width={badgeSize} height={badgeSize} rx="2"
              fill={color} opacity="0.9"
            >
              <title>{new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}{'\n'}{conf}{'\n'}Spread: {formatTooltip ? formatTooltip(daySpreads[i]) : daySpreads[i].toFixed(1)}</title>
            </rect>
          );
        })}

      </svg>
    </div>
  );
};

const ModelComparisonTab = ({ location }) => {
  const [modelData, setModelData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!location?.lat || !location?.lon) return;
    const controller = new AbortController();

    const fetchAllModels = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          MODELS.map(async (model) => {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&forecast_days=7&models=${model.id}`;
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) throw new Error(`${model.name} fetch failed`);
            return { id: model.id, data: await res.json() };
          })
        );
        const dataMap = {};
        results.forEach(({ id, data }) => { dataMap[id] = data; });
        setModelData(dataMap);
      } catch (e) {
        if (e.name === 'AbortError') return;
        console.error('Model comparison fetch error:', e);
        setError('Failed to load model comparison data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllModels();
    return () => controller.abort();
  }, [location?.lat, location?.lon]);

  if (isLoading) return <TabPanel title="MODEL COMPARISON"><LoadingIndicator /></TabPanel>;
  if (error) return <TabPanel title="MODEL COMPARISON"><p className="text-red-400 p-4">{error}</p></TabPanel>;

  const firstModel = Object.values(modelData)[0];
  if (!firstModel) return null;
  const days = firstModel.daily?.time || [];

  return (
    <TabPanel title="MODEL COMPARISON">

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 p-3 rounded-lg border border-cyan-800 bg-black/20 text-sm">
        {MODELS.map(model => (
          <div key={model.id} className="flex items-center gap-2">
            <span className="w-5 h-0.5 rounded-full inline-block"
              style={{ backgroundColor: MODEL_COLORS[model.id], boxShadow: `0 0 4px ${MODEL_COLORS[model.id]}` }} />
            <span className={`font-bold ${MODEL_TEXT_COLORS[model.id]}`}>{model.name}</span>
            <span className="text-cyan-600 text-xs">{model.label}</span>
          </div>
        ))}
        {/* Consensus entry */}
        <div className="flex items-center gap-2">
          <span className="w-5 h-0.5 rounded-full inline-block"
            style={{ backgroundColor: '#FFFFFF', boxShadow: '0 0 5px rgba(255,255,255,0.8)' }} />
          <span className="font-bold text-white">AVG</span>
          <span className="text-cyan-600 text-xs">Model consensus</span>
        </div>
        {/* Confidence key */}
        <div className="flex items-center gap-3 ml-auto text-xs">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-green-400" /> High</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-yellow-400" /> Med</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-red-400" /> Low</span>
        </div>
      </div>

      <div className="space-y-4">
        <ModelChart days={days} modelData={modelData}
          valueKey="temperature_2m_max" title="HIGH TEMPERATURE (°F)"
          formatTick={v => `${Math.round(v)}°`}
          formatTooltip={v => `${Math.round(v)}°F`}
          spreadThresholds={[3, 6]}
        />
        <ModelChart days={days} modelData={modelData}
          valueKey="temperature_2m_min" title="LOW TEMPERATURE (°F)"
          formatTick={v => `${Math.round(v)}°`}
          formatTooltip={v => `${Math.round(v)}°F`}
          spreadThresholds={[3, 6]}
        />
        <ModelChart days={days} modelData={modelData}
          valueKey="precipitation_sum" title="PRECIPITATION (IN)"
          formatTick={v => v.toFixed(1)}
          formatTooltip={v => `${v.toFixed(2)}"`}
          spreadThresholds={[0.1, 0.3]}
        />
        <ModelChart days={days} modelData={modelData}
          valueKey="precipitation_probability_max" title="RAIN CHANCE (%)"
          formatTick={v => `${Math.round(v)}%`}
          formatTooltip={v => `${Math.round(v)}%`}
          spreadThresholds={[10, 25]}
        />
      </div>

      <p className="text-xs text-cyan-700 mt-4 text-center">
        White line = model consensus (average) · Shaded area = spread between models · Hover dots or badges for details
      </p>
    </TabPanel>
  );
};

export default ModelComparisonTab;
