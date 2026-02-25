import React, { useState, useEffect, useCallback } from 'react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';

const MODELS = [
  { id: 'gfs_seamless',  name: 'GFS',   label: 'American (NOAA)' },
  { id: 'ecmwf_ifs025', name: 'ECMWF', label: 'European' },
  { id: 'jma_seamless',  name: 'JMA',   label: 'Japanese (JMA)' },
  { id: 'gem_seamless',  name: 'GEM',   label: 'Canadian' },
];

const MODEL_COLORS = {
  gfs_seamless:  '#60A5FA',
  ecmwf_ifs025: '#4ADE80',
  jma_seamless:  '#FACC15',
  gem_seamless:  '#FB923C',
};

const MODEL_TEXT_COLORS = {
  gfs_seamless:  'text-blue-400',
  ecmwf_ifs025: 'text-green-400',
  jma_seamless:  'text-yellow-400',
  gem_seamless:  'text-orange-400',
};

const MODEL_INFO = {
  gfs_seamless: {
    fullName:   'Global Forecast System',
    agency:     'NOAA / NCEP (USA)',
    updates:    '4× daily (00, 06, 12, 18 UTC)',
    resolution: '~13 km',
    notes:      'The primary US reference model. Good for near-term forecasts and general patterns. Sometimes struggles with precipitation timing and intensity.',
  },
  ecmwf_ifs025: {
    fullName:   'Integrated Forecast System',
    agency:     'ECMWF (Europe)',
    updates:    '2× daily (00, 12 UTC)',
    resolution: '~9 km',
    notes:      'Widely regarded as the gold standard for medium-range forecasting (days 4–10). Consistently tops global verification studies, especially for temperature and large-scale patterns.',
  },
  jma_seamless: {
    fullName:   'Global Spectral Model',
    agency:     'Japan Meteorological Agency',
    updates:    '2× daily (00, 12 UTC)',
    resolution: '~20 km',
    notes:      'Strong performer over the Pacific and Asia-Pacific region. Less commonly cited in the US but a reliable global model worth including for independent perspective.',
  },
  gem_seamless: {
    fullName:   'Global Environmental Multiscale',
    agency:     'Environment & Climate Change Canada',
    updates:    '2× daily (00, 12 UTC)',
    resolution: '~15 km',
    notes:      'Solid performer for North America and Arctic regions. Often competitive with GFS for Canadian and northern US weather patterns.',
  },
};

const W = 560;
const H = 250;
const PAD = { top: 26, right: 20, bottom: 66, left: 50 };

const getConfidenceColor = (spread, [low, mid]) => {
  if (spread <= low) return '#4ADE80';
  if (spread <= mid) return '#FACC15';
  return '#F87171';
};

// Returns a Set of model IDs that are running as outliers for a given day/variable.
// A model is an outlier if its deviation from the consensus exceeds 50% of the total
// spread AND the spread itself is significant (above the low-confidence threshold).
const findOutliers = (visibleModels, modelData, valueKey, dayIndex, minSpread) => {
  const entries = visibleModels
    .map(m => ({ id: m.id, v: modelData[m.id]?.daily?.[valueKey]?.[dayIndex] }))
    .filter(e => e.v != null);
  if (entries.length < 3) return new Set();
  const mean   = entries.reduce((s, e) => s + e.v, 0) / entries.length;
  const spread = Math.max(...entries.map(e => e.v)) - Math.min(...entries.map(e => e.v));
  if (spread <= minSpread) return new Set();
  return new Set(entries.filter(e => Math.abs(e.v - mean) > spread * 0.5).map(e => e.id));
};

// ─── Line chart ────────────────────────────────────────────────────────────────

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

  const consensusPts = days.map((_, i) => {
    const vals = visibleModels.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null);
    if (!vals.length) return null;
    return `${xPos(i)},${yPos(vals.reduce((a, b) => a + b, 0) / vals.length)}`;
  }).filter(Boolean);

  const daySpreads = days.map((_, i) => {
    const vals = visibleModels.map(m => modelData[m.id]?.daily?.[valueKey]?.[i]).filter(v => v != null);
    return vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : 0;
  });

  // Outlier sets per day — model is flagged when it accounts for >50% of spread
  const dayOutliers = days.map((_, i) =>
    findOutliers(visibleModels, modelData, valueKey, i, spreadThresholds[0])
  );

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = rawMin + ((rawMax - rawMin) * i / 4);
    return { v, y: yPos(v) };
  });

  const dayLabelY = chartBottom + 18;
  const badgeY    = chartBottom + 34;
  const badgeSize = 12;

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

        {spreadPath && (
          <path d={spreadPath} fill="rgba(0,255,255,0.13)" clipPath={`url(#clip-${valueKey})`} />
        )}

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

        <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH}
          fill="none" stroke="rgba(0,255,255,0.2)" strokeWidth="1" />

        <line x1={xPos(0)} y1={PAD.top - 5} x2={xPos(0)} y2={chartBottom}
          stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3,3" />
        <text x={xPos(0)} y={PAD.top - 8} textAnchor="middle"
          fill="rgba(255,255,255,0.55)" fontSize="12" letterSpacing="1">TODAY</text>

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

        {visibleModels.map(model =>
          days.map((_, i) => {
            const v = modelData[model.id]?.daily?.[valueKey]?.[i];
            if (v == null) return null;
            const spreadLabel = formatTooltip ? formatTooltip(daySpreads[i]) : `${daySpreads[i].toFixed(1)}`;
            const outlier = dayOutliers[i].has(model.id);
            return (
              <g key={`${model.id}-${i}`}>
                {/* Dashed outlier ring */}
                {outlier && (
                  <circle
                    cx={xPos(i)} cy={yPos(v)} r="10"
                    fill="none"
                    stroke={MODEL_COLORS[model.id]}
                    strokeWidth="1.5"
                    strokeDasharray="3,2"
                    strokeOpacity="0.85"
                    pointerEvents="none"
                    filter={`url(#glow-${valueKey})`}
                  />
                )}
                <circle
                  cx={xPos(i)} cy={yPos(v)} r="5"
                  fill={MODEL_COLORS[model.id]}
                  filter={`url(#glow-${valueKey})`}
                >
                  <title>{model.name}: {formatTooltip ? formatTooltip(v) : Math.round(v)}{outlier ? ' ⚠ OUTLIER' : ''}{'\n'}Spread this day: {spreadLabel}</title>
                </circle>
              </g>
            );
          })
        )}

        {days.map((day, i) => (
          <text key={i} x={xPos(i)} y={dayLabelY} textAnchor="middle"
            fill={i === 0 ? 'rgba(255,255,255,0.75)' : 'rgba(0,255,255,0.5)'}
            fontSize="15">
            {new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'short' }).slice(0, 3).toUpperCase()}
          </text>
        ))}

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

// ─── Day card ──────────────────────────────────────────────────────────────────

const DayCard = ({ day, dayIndex, modelData, hiddenModels, hasSnow }) => {
  const visibleModels = MODELS.filter(m => !hiddenModels.has(m.id));
  const isToday = dayIndex === 0;

  // Split into two groups so each mini-table only has 3 columns — much more readable
  const VAR_GROUPS = [
    [
      { key: 'temperature_2m_max', label: 'HI',   fmt: v => `${Math.round(v)}°` },
      { key: 'temperature_2m_min', label: 'LO',   fmt: v => `${Math.round(v)}°` },
      { key: 'wind_speed_10m_max', label: 'WIND', fmt: v => `${Math.round(v)}`  },
    ],
    [
      { key: 'precipitation_sum',             label: 'PRCP', fmt: v => `${v.toFixed(1)}"` },
      { key: 'precipitation_probability_max', label: 'RAIN', fmt: v => `${Math.round(v)}%` },
      ...(hasSnow ? [{ key: 'snowfall_sum', label: 'SNOW', fmt: v => `${v.toFixed(1)}"` }] : []),
    ],
  ];
  // Flat list still needed for outlier detection over all vars
  const VARS = VAR_GROUPS.flat();

  const dayName = new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'short' }).slice(0, 3).toUpperCase();
  const dateStr = new Date(day + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });

  const tempVals = visibleModels
    .map(m => modelData[m.id]?.daily?.temperature_2m_max?.[dayIndex])
    .filter(v => v != null);
  const tempSpread = tempVals.length >= 2 ? Math.max(...tempVals) - Math.min(...tempVals) : 0;
  const confColor  = getConfidenceColor(tempSpread, [3, 6]);
  const confLabel  = tempSpread <= 3 ? 'HIGH' : tempSpread <= 6 ? 'MED' : 'LOW';

  const avg = (key) => {
    const vals = visibleModels.map(m => modelData[m.id]?.daily?.[key]?.[dayIndex]).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  // Min spread per variable to qualify for outlier detection
  const VAR_MIN_SPREAD = {
    temperature_2m_max: 3, temperature_2m_min: 3,
    wind_speed_10m_max: 5, precipitation_sum: 0.1,
    precipitation_probability_max: 10, snowfall_sum: 0.5,
  };
  const varOutliers = {};
  VARS.forEach(({ key }) => {
    varOutliers[key] = findOutliers(visibleModels, modelData, key, dayIndex, VAR_MIN_SPREAD[key] ?? 0);
  });
  const outlierModelIds = new Set(Object.values(varOutliers).flatMap(s => [...s]));
  const outlierNames = MODELS.filter(m => outlierModelIds.has(m.id)).map(m => m.name);

  return (
    <div className={`rounded-lg border p-3 bg-black/20 flex flex-col gap-2 ${isToday ? 'border-white/30' : 'border-cyan-800'}`}>
      <div className="flex items-start justify-between">
        <div>
          <span className={`font-bold text-xl tracking-wide ${isToday ? 'text-white' : 'text-cyan-300'}`}>{dayName}</span>
          {isToday && <span className="ml-2 text-xs text-white/50 tracking-widest">TODAY</span>}
          <div className="text-cyan-600 text-sm mt-0.5">{dateStr}</div>
          {outlierNames.length > 0 && (
            <div className="text-xs text-orange-400 mt-0.5 tracking-wide">
              ⚠ {outlierNames.join(', ')} outlier
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-3.5 h-3.5 rounded-sm"
            style={{ backgroundColor: confColor, boxShadow: `0 0 5px ${confColor}` }} />
          <div className="text-xs font-bold tracking-wider" style={{ color: confColor }}>{confLabel}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-cyan-900 pt-2">
        {VAR_GROUPS.map((group, gi) => (
          <div key={gi}>
            {/* Column headers */}
            <div className="flex text-xs text-cyan-600 tracking-wider mb-1">
              <div className="w-14 shrink-0" />
              {group.map(v => (
                <div key={v.key} className="flex-1 text-center">{v.label}</div>
              ))}
            </div>

            {/* Model rows */}
            {visibleModels.map(model => (
              <div key={model.id} className="flex items-center text-sm py-0.5">
                <div className="w-14 shrink-0 font-bold truncate" style={{ color: MODEL_COLORS[model.id] }}>
                  {model.name}
                </div>
                {group.map(({ key, fmt }) => {
                  const v = modelData[model.id]?.daily?.[key]?.[dayIndex];
                  const outlier = varOutliers[key]?.has(model.id);
                  return (
                    <div key={key} className="flex-1 text-center"
                      style={{
                        color: MODEL_COLORS[model.id],
                        textDecoration: outlier ? 'underline' : 'none',
                        textDecorationStyle: outlier ? 'wavy' : undefined,
                        textDecorationColor: outlier ? MODEL_COLORS[model.id] : undefined,
                        fontWeight: outlier ? 'bold' : undefined,
                      }}>
                      {v != null ? fmt(v) : '—'}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* AVG row */}
            {visibleModels.length >= 2 && (
              <div className="flex items-center text-sm pt-1.5 mt-1 border-t border-cyan-900 font-bold">
                <div className="w-14 shrink-0 text-white">AVG</div>
                {group.map(({ key, fmt }) => {
                  const a = avg(key);
                  return (
                    <div key={key} className="flex-1 text-center text-white">
                      {a != null ? fmt(a) : '—'}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── View toggle ───────────────────────────────────────────────────────────────

const ViewToggle = ({ viewMode, setViewMode }) => (
  <div className="flex items-center gap-1 bg-black/30 border border-cyan-800 rounded-lg p-1 self-start">
    {['LINES', 'CARDS'].map(mode => (
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

// ─── Model info panel ──────────────────────────────────────────────────────────

const ModelInfoPanel = ({ modelId, onClose }) => {
  const info = MODEL_INFO[modelId];
  const model = MODELS.find(m => m.id === modelId);
  if (!info || !model) return null;
  return (
    <div className="mt-2 p-3 rounded-lg border bg-black/40 text-xs"
      style={{ borderColor: MODEL_COLORS[modelId] }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="font-bold" style={{ color: MODEL_COLORS[modelId] }}>{model.name}</span>
          <span className="text-cyan-400 ml-2">{info.fullName}</span>
        </div>
        <button onClick={onClose} className="text-cyan-700 hover:text-cyan-400 text-base leading-none shrink-0">✕</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 mb-2 text-cyan-500">
        <div><span className="text-cyan-700">Agency: </span>{info.agency}</div>
        <div><span className="text-cyan-700">Updates: </span>{info.updates}</div>
        <div><span className="text-cyan-700">Resolution: </span>{info.resolution}</div>
      </div>
      <p className="text-cyan-400 opacity-80 leading-relaxed">{info.notes}</p>
    </div>
  );
};

// ─── Tab ───────────────────────────────────────────────────────────────────────

const ModelComparisonTab = ({ location }) => {
  const [modelData, setModelData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hiddenModels, setHiddenModels] = useState(new Set());
  const [hoverDay, setHoverDay] = useState(null);
  const [viewMode, setViewMode] = useState('lines');
  const [infoModel, setInfoModel] = useState(null);

  const toggleModel = useCallback((modelId) => {
    setHiddenModels(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  }, []);

  const toggleInfo = useCallback((modelId) => {
    setInfoModel(prev => prev === modelId ? null : modelId);
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
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,precipitation_sum,snowfall_sum,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=14&models=${model.id}`;
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
  const avgSpread   = tempSpreads.reduce((a, b) => a + b, 0) / (tempSpreads.length || 1);
  const firstBadDay = tempSpreads.findIndex(s => s > 6);

  let bannerStyle, bannerLabel, bannerMsg;
  if (visibleModels.length < 2) {
    bannerStyle = 'border-cyan-800 bg-black/20 text-cyan-500';
    bannerLabel = 'SINGLE MODEL';
    bannerMsg   = 'Enable more models to see agreement analysis';
  } else if (avgSpread <= 3) {
    bannerStyle = 'border-green-700 bg-green-900/20 text-green-400';
    bannerLabel = '▲ HIGH AGREEMENT';
    bannerMsg   = 'Models in strong agreement — high confidence forecast';
  } else if (avgSpread <= 6) {
    bannerStyle = 'border-yellow-700 bg-yellow-900/20 text-yellow-400';
    bannerLabel = '◆ MODERATE AGREEMENT';
    bannerMsg   = firstBadDay > 0
      ? `Models agree near-term · Uncertainty increases ${new Date(days[firstBadDay] + 'T12:00:00').toLocaleDateString([], { weekday: 'long' })} onward`
      : 'Some spread between models — moderate confidence';
  } else {
    bannerStyle = 'border-red-700 bg-red-900/20 text-red-400';
    bannerLabel = '▼ LOW AGREEMENT';
    bannerMsg   = 'Models diverging significantly — use caution interpreting this forecast';
  }

  const hasSnow = days.some((_, i) =>
    MODELS.some(m => (modelData[m.id]?.daily?.snowfall_sum?.[i] ?? 0) > 0)
  );

  const chartProps = { days, modelData, hiddenModels, hoverDay, onHoverDay: setHoverDay };

  return (
    <TabPanel title="MODEL COMPARISON">

      {/* Agreement banner + view toggle */}
      <div className="flex flex-wrap items-stretch gap-3 mb-4">
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 p-3 rounded-lg border ${bannerStyle}`}>
          <span className="font-bold tracking-widest text-xs whitespace-nowrap">{bannerLabel}</span>
          <span className="text-xs opacity-80">{bannerMsg}</span>
        </div>
        <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
      </div>

      {/* Legend / model toggle */}
      <div className="mb-4 p-3 rounded-lg border border-cyan-800 bg-black/20">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-x-4 sm:gap-y-2 mb-2">
          {MODELS.map(model => {
            const hidden = hiddenModels.has(model.id);
            return (
              <div key={model.id} className="flex items-center gap-1">
                <button
                  onClick={() => toggleModel(model.id)}
                  className={`flex items-center gap-2 py-1.5 px-2 rounded transition-opacity text-sm ${hidden ? 'opacity-30' : 'opacity-100'}`}
                  title={hidden ? `Show ${model.name}` : `Hide ${model.name}`}
                >
                  <span className="w-5 h-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: MODEL_COLORS[model.id], boxShadow: hidden ? 'none' : `0 0 4px ${MODEL_COLORS[model.id]}` }} />
                  <span className={`font-bold ${MODEL_TEXT_COLORS[model.id]} ${hidden ? 'line-through' : ''}`}>{model.name}</span>
                  <span className="text-cyan-600 text-xs hidden sm:inline">{model.label}</span>
                </button>
                <button
                  onClick={() => toggleInfo(model.id)}
                  className={`text-xs w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                    infoModel === model.id
                      ? 'border-cyan-400 text-cyan-300 bg-cyan-900/40'
                      : 'border-cyan-800 text-cyan-700 hover:border-cyan-500 hover:text-cyan-400'
                  }`}
                  title={`About ${model.name}`}
                >ⓘ</button>
              </div>
            );
          })}
          <div className="flex items-center gap-2 py-1.5 px-2 text-sm">
            <span className="w-5 h-0.5 rounded-full shrink-0"
              style={{ backgroundColor: '#FFFFFF', boxShadow: '0 0 5px rgba(255,255,255,0.8)' }} />
            <span className="font-bold text-white">AVG</span>
            <span className="text-cyan-600 text-xs hidden sm:inline">Model consensus</span>
          </div>
        </div>

        {/* Model info panel */}
        {infoModel && (
          <ModelInfoPanel modelId={infoModel} onClose={() => setInfoModel(null)} />
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-cyan-900 text-xs text-cyan-500">
          <span className="mr-1 opacity-60">CONF:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-green-400" /> High</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-yellow-400" /> Med</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-red-400" /> Low</span>
        </div>
      </div>

      {/* Line chart view */}
      {viewMode === 'lines' && (
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
            valueKey="wind_speed_10m_max" title="WIND SPEED (MPH)"
            formatTick={v => `${Math.round(v)}`}
            formatTooltip={v => `${Math.round(v)} mph`}
            spreadThresholds={[5, 10]}
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
          <p className="text-xs text-cyan-700 text-center">
            White line = model consensus · Shaded area = spread · Click legend to toggle · Swipe charts to sync crosshair
          </p>
        </div>
      )}

      {/* Day cards view */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {days.map((day, i) => (
            <DayCard
              key={day}
              day={day}
              dayIndex={i}
              modelData={modelData}
              hiddenModels={hiddenModels}
              hasSnow={hasSnow}
            />
          ))}
        </div>
      )}

    </TabPanel>
  );
};

export default ModelComparisonTab;
