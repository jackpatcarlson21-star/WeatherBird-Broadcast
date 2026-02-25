import React, { useState, useEffect, useCallback } from 'react';
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

// Taller chart + larger padding so text stays readable when scaled down on mobile
const W = 560;
const H = 250;
const PAD = { top: 26, right: 20, bottom: 66, left: 50 };

const getConfidenceColor = (spread, [low, mid]) => {
  if (spread <= low) return '#4ADE80';
  if (spread <= mid) return '#FACC15';
  return '#F87171';
};

const ModelChart = ({ days, modelData, valueKey, title, formatTick, formatTooltip, spreadThresholds, hiddenModels, hoverDay, onHoverDay }) => {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const visibleModels = MODELS.filter(m => !hiddenModels.has(m.id));

  const allValues = days.flatMap((_, i) =>
    visibleModels.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null)
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

  // Spread fill
  const spreadTopPts = days.map((_, i) => {
    const vals = visibleModels.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null);
    return vals.length ? `${xPos(i)},${yPos(Math.max(...vals))}` : null;
  }).filter(Boolean);
  const spreadBotPts = days.map((_, i) => {
    const vals = visibleModels.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null);
    return vals.length ? `${xPos(i)},${yPos(Math.min(...vals))}` : null;
  }).filter(Boolean).reverse();
  const spreadPath = spreadTopPts.length
    ? `M ${spreadTopPts.join(' L ')} L ${spreadBotPts.join(' L ')} Z`
    : '';

  // Consensus line
  const consensusPts = days.map((_, i) => {
    const vals = visibleModels.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null);
    if (!vals.length) return null;
    return `${xPos(i)},${yPos(vals.reduce((a, b) => a + b, 0) / vals.length)}`;
  }).filter(Boolean);

  // Per-day spread for confidence badges
  const daySpreads = days.map((_, i) => {
    const vals = visibleModels.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null);
    return vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : 0;
  });

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = rawMin + ((rawMax - rawMin) * i / 4);
    return { v, y: yPos(v) };
  });

  const dayLabelY = chartBottom + 18;
  const badgeY    = chartBottom + 34;
  const badgeSize = 12;

  // Resolve the SVG x from a pointer/touch event
  const getSvgDayIndex = useCallback((clientX, svgEl) => {
    const rect = svgEl.getBoundingClientRect();
    const svgX = (clientX - rect.left) * (W / rect.width);
    const dayFloat = (svgX - PAD.left) / innerW * (days.length - 1);
    return Math.max(0, Math.min(days.length - 1, Math.round(dayFloat)));
  }, [days.length, innerW]);

  const handleMouseMove = useCallback((e) => {
    onHoverDay(getSvgDayIndex(e.clientX, e.currentTarget));
  }, [getSvgDayIndex, onHoverDay]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) onHoverDay(getSvgDayIndex(touch.clientX, e.currentTarget));
  }, [getSvgDayIndex, onHoverDay]);

  return (
    <div className="p-3 rounded-lg border border-cyan-800 bg-black/20">
      <div className="text-cyan-300 text-sm tracking-widest mb-2 font-bold">{title}</div>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ fontFamily: 'VT323, monospace', overflow: 'visible', cursor: 'crosshair', touchAction: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onHoverDay(null)}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => onHoverDay(null)}
      >
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

        {/* TODAY marker */}
        <line x1={xPos(0)} y1={PAD.top - 5} x2={xPos(0)} y2={chartBottom}
          stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3,3" />
        <text x={xPos(0)} y={PAD.top - 8} textAnchor="middle"
          fill="rgba(255,255,255,0.55)" fontSize="12" letterSpacing="1">TODAY</text>

        {/* Model lines */}
        {visibleModels.map(model => {
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
              strokeWidth="2"
              strokeOpacity="0.75"
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={`url(#glow-${valueKey})`}
              clipPath={`url(#clip-${valueKey})`}
            />
          );
        })}

        {/* Consensus line */}
        {visibleModels.length >= 2 && consensusPts.length >= 2 && (
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

        {/* Dots — larger radius for touch */}
        {visibleModels.map(model =>
          days.map((_, i) => {
            const v = modelData[model.id]?.daily?.[valueKey]?.[i];
            if (v == null) return null;
            const spreadLabel = formatTooltip ? formatTooltip(daySpreads[i]) : `${daySpreads[i].toFixed(1)}`;
            return (
              <circle key={`${model.id}-${i}`}
                cx={xPos(i)} cy={yPos(v)} r="5"
                fill={MODEL_COLORS[model.id]}
                filter={`url(#glow-${valueKey})`}
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
            fontSize="15">
            {new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'short' }).slice(0, 3).toUpperCase()}
          </text>
        ))}

        {/* Confidence badge row */}
        <text x={PAD.left - 6} y={badgeY + badgeSize - 2} textAnchor="end"
          fill="rgba(0,255,255,0.3)" fontSize="11">CONF</text>
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

        {/* Synchronized crosshair */}
        {hoverDay !== null && (
          <line
            x1={xPos(hoverDay)} y1={PAD.top}
            x2={xPos(hoverDay)} y2={chartBottom}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1"
            strokeDasharray="4,3"
            pointerEvents="none"
          />
        )}

      </svg>
    </div>
  );
};

const ModelComparisonTab = ({ location }) => {
  const [modelData, setModelData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hiddenModels, setHiddenModels] = useState(new Set());
  const [hoverDay, setHoverDay] = useState(null);

  const toggleModel = useCallback((modelId) => {
    setHiddenModels(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!location?.lat || !location?.lon) return;
    const controller = new AbortController();

    const fetchAllModels = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          MODELS.map(async (model) => {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,precipitation_probability_max&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&forecast_days=7&models=${model.id}`;
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

  const visibleModels = MODELS.filter(m => !hiddenModels.has(m.id));

  // Weekly agreement banner
  const tempSpreads = days.map((_, i) => {
    const vals = visibleModels.map(m => modelData[m.id]?.daily?.temperature_2m_max?.[i]).filter(v => v != null);
    return vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : 0;
  });
  const avgSpread = tempSpreads.reduce((a, b) => a + b, 0) / (tempSpreads.length || 1);
  const firstBadDay = tempSpreads.findIndex(s => s > 6);

  let bannerStyle, bannerLabel, bannerMsg;
  if (visibleModels.length < 2) {
    bannerStyle = 'border-cyan-800 bg-black/20 text-cyan-500';
    bannerLabel = 'SINGLE MODEL';
    bannerMsg = 'Enable more models to see agreement analysis';
  } else if (avgSpread <= 3) {
    bannerStyle = 'border-green-700 bg-green-900/20 text-green-400';
    bannerLabel = '▲ HIGH AGREEMENT';
    bannerMsg = 'Models in strong agreement — high confidence forecast this week';
  } else if (avgSpread <= 6) {
    bannerStyle = 'border-yellow-700 bg-yellow-900/20 text-yellow-400';
    bannerLabel = '◆ MODERATE AGREEMENT';
    bannerMsg = firstBadDay > 0
      ? `Models agree near-term · Uncertainty increases ${new Date(days[firstBadDay] + 'T12:00:00').toLocaleDateString([], { weekday: 'long' })} onward`
      : 'Some spread between models — moderate confidence this week';
  } else {
    bannerStyle = 'border-red-700 bg-red-900/20 text-red-400';
    bannerLabel = '▼ LOW AGREEMENT';
    bannerMsg = 'Models diverging significantly — use caution interpreting this forecast';
  }

  const hasSnow = days.some((_, i) =>
    MODELS.some(m => (modelData[m.id]?.daily?.snowfall_sum?.[i] ?? 0) > 0)
  );

  const chartProps = { days, modelData, hiddenModels, hoverDay, onHoverDay: setHoverDay };

  return (
    <TabPanel title="MODEL COMPARISON">

      {/* Weekly Agreement Banner */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 p-3 rounded-lg border ${bannerStyle}`}>
        <span className="font-bold tracking-widest text-xs whitespace-nowrap">{bannerLabel}</span>
        <span className="text-xs opacity-80">{bannerMsg}</span>
      </div>

      {/* Legend / Model Toggle — 2-col grid on mobile, free-wrap on desktop */}
      <div className="mb-4 p-3 rounded-lg border border-cyan-800 bg-black/20">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-x-4 sm:gap-y-2 mb-2">
          {MODELS.map(model => {
            const hidden = hiddenModels.has(model.id);
            return (
              <button
                key={model.id}
                onClick={() => toggleModel(model.id)}
                className={`flex items-center gap-2 py-1.5 px-2 rounded transition-opacity text-sm ${hidden ? 'opacity-30' : 'opacity-100'}`}
                title={hidden ? `Show ${model.name}` : `Hide ${model.name}`}
              >
                <span className="w-5 h-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: MODEL_COLORS[model.id], boxShadow: hidden ? 'none' : `0 0 4px ${MODEL_COLORS[model.id]}` }} />
                <span className={`font-bold ${MODEL_TEXT_COLORS[model.id]} ${hidden ? 'line-through' : ''}`}>{model.name}</span>
                <span className="text-cyan-600 text-xs hidden sm:inline">{model.label}</span>
              </button>
            );
          })}
          <div className="flex items-center gap-2 py-1.5 px-2 text-sm">
            <span className="w-5 h-0.5 rounded-full shrink-0"
              style={{ backgroundColor: '#FFFFFF', boxShadow: '0 0 5px rgba(255,255,255,0.8)' }} />
            <span className="font-bold text-white">AVG</span>
            <span className="text-cyan-600 text-xs hidden sm:inline">Model consensus</span>
          </div>
        </div>
        {/* Confidence key */}
        <div className="flex items-center gap-3 pt-2 border-t border-cyan-900 text-xs text-cyan-500">
          <span className="mr-1 opacity-60">CONF:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-green-400" /> High</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-yellow-400" /> Med</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-red-400" /> Low</span>
        </div>
      </div>

      <div className="space-y-4">
        <ModelChart {...chartProps}
          valueKey="temperature_2m_max" title="HIGH TEMPERATURE (°F)"
          formatTick={v => `${Math.round(v)}°`}
          formatTooltip={v => `${Math.round(v)}°F`}
          spreadThresholds={[3, 6]}
        />
        <ModelChart {...chartProps}
          valueKey="temperature_2m_min" title="LOW TEMPERATURE (°F)"
          formatTick={v => `${Math.round(v)}°`}
          formatTooltip={v => `${Math.round(v)}°F`}
          spreadThresholds={[3, 6]}
        />
        <ModelChart {...chartProps}
          valueKey="precipitation_sum" title="PRECIPITATION (IN)"
          formatTick={v => v.toFixed(1)}
          formatTooltip={v => `${v.toFixed(2)}"`}
          spreadThresholds={[0.1, 0.3]}
        />
        <ModelChart {...chartProps}
          valueKey="precipitation_probability_max" title="RAIN CHANCE (%)"
          formatTick={v => `${Math.round(v)}%`}
          formatTooltip={v => `${Math.round(v)}%`}
          spreadThresholds={[10, 25]}
        />
        {hasSnow && (
          <ModelChart {...chartProps}
            valueKey="snowfall_sum" title="SNOWFALL (IN)"
            formatTick={v => `${v.toFixed(1)}"`}
            formatTooltip={v => `${v.toFixed(2)}"`}
            spreadThresholds={[0.5, 1.5]}
          />
        )}
      </div>

      <p className="text-xs text-cyan-700 mt-4 text-center">
        White line = model consensus · Shaded area = spread · Tap legend to toggle models · Swipe charts to sync crosshair
      </p>
    </TabPanel>
  );
};

export default ModelComparisonTab;
