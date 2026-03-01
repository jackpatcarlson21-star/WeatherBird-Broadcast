import React, { useState, useEffect } from 'react';
import { CloudLightning, ExternalLink, AlertTriangle, RefreshCw, Calendar, TrendingUp, Map, Activity } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import TabPanel from '../layout/TabPanel';
import {
  NHC_ATLANTIC_OUTLOOK_URL,
  NHC_PACIFIC_OUTLOOK_URL,
  NHC_MAPSERVER_BASE,
  NHC_ATLANTIC_STORM_LAYERS,
  NHC_PACIFIC_STORM_LAYERS,
  PLACEHOLDER_IMG,
} from '../../utils/constants';

// ── HURDAT2 ──────────────────────────────────────────────────────────────────────

const HURDAT2_URLS = {
  atlantic: '/hurdat2-atlantic.txt',
  pacific:  '/hurdat2-pacific.txt',
};

// Module-level cache — persists across renders without re-fetching
let hurdat2Cache = { atlantic: null, pacific: null };

const parseLatLon = (str) => {
  const v = parseFloat(str);
  return (str.includes('S') || str.includes('W')) ? -v : v;
};

const parseHURDAT2 = (text) => {
  const storms = [];
  let current = null;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    // Header line: e.g. "AL092023, IDA, 54,"
    if (/^[A-Z]{2}\d{6}/.test(line)) {
      if (current && current.track.length >= 2) storms.push(current);
      const parts = line.split(',').map(s => s.trim());
      current = {
        id:       parts[0],
        name:     parts[1] || 'UNNAMED',
        year:     parseInt(parts[0].slice(4, 8), 10),
        basin:    parts[0].slice(0, 2),
        track:    [],
        peakWind: 0,
      };
    } else if (current) {
      // Data line: YYYYMMDD, HHMM, ident, status, lat, lon, wind, pressure, ...
      const parts = line.split(',').map(s => s.trim());
      if (parts.length < 7) continue;
      const month = parseInt(parts[0].slice(4, 6), 10);
      const lat   = parseLatLon(parts[4]);
      const lon   = parseLatLon(parts[5]);
      const wind  = parseInt(parts[6], 10);
      if (isNaN(lat) || isNaN(lon) || isNaN(wind)) continue;
      current.track.push({ lat, lon, wind, month });
      if (wind > current.peakWind) current.peakWind = wind;
    }
  }
  if (current && current.track.length >= 2) storms.push(current);
  return storms;
};

const fetchHURDAT2 = async (basin) => {
  if (hurdat2Cache[basin]) return hurdat2Cache[basin];
  const res = await fetch(HURDAT2_URLS[basin]);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const storms = parseHURDAT2(text);
  hurdat2Cache[basin] = storms;
  return storms;
};

// ── Category helpers ──────────────────────────────────────────────────────────────

const getCatFromKnots = (kts) => {
  if (kts >= 137) return { label: 'CAT 5', color: '#FF00FF' };
  if (kts >= 113) return { label: 'CAT 4', color: '#FF4500' };
  if (kts >= 96)  return { label: 'CAT 3', color: '#FF8C00' };
  if (kts >= 83)  return { label: 'CAT 2', color: '#FFD700' };
  if (kts >= 64)  return { label: 'CAT 1', color: '#FBBF24' };
  if (kts >= 34)  return { label: 'TS',    color: '#67E8F9' };
  return               { label: 'TD',    color: '#6B7280' };
};

const getStormCategory = (windMph) => {
  if (!windMph) return null;
  if (windMph >= 157) return { label: 'CAT 5', color: 'text-fuchsia-400', border: 'border-fuchsia-500', bg: 'bg-fuchsia-900/50' };
  if (windMph >= 130) return { label: 'CAT 4', color: 'text-red-400',     border: 'border-red-500',     bg: 'bg-red-900/50' };
  if (windMph >= 111) return { label: 'CAT 3', color: 'text-orange-400',  border: 'border-orange-500',  bg: 'bg-orange-900/50' };
  if (windMph >= 96)  return { label: 'CAT 2', color: 'text-yellow-400',  border: 'border-yellow-500',  bg: 'bg-yellow-900/40' };
  if (windMph >= 74)  return { label: 'CAT 1', color: 'text-yellow-300',  border: 'border-yellow-400',  bg: 'bg-yellow-900/40' };
  if (windMph >= 39)  return { label: 'TS',    color: 'text-cyan-400',    border: 'border-cyan-500',    bg: 'bg-cyan-900/40' };
  return               { label: 'TD',    color: 'text-gray-400',    border: 'border-gray-500',    bg: 'bg-gray-900/40' };
};

// ── Active storm queries ──────────────────────────────────────────────────────────

const queryStormLayer = async (layerId) => {
  const url = `${NHC_MAPSERVER_BASE}/${layerId}/query?where=tau%3D0&outFields=stormname,stormtype,maxwind,gust,mslp,tcdir,tcspd,advdate,lat,lon,basin&f=json&returnGeometry=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.features || data.features.length === 0) return null;
  return data.features[0].attributes;
};

const fetchActiveStorms = async (layers) => {
  const results = await Promise.all(layers.map(queryStormLayer));
  return results.filter(Boolean);
};

// ── Season context ────────────────────────────────────────────────────────────────

const getSeasonStatus = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const inSeason = (month > 6 || (month === 6 && day >= 1)) && (month < 11 || (month === 11 && day <= 30));
  const nearPeak = month === 9 && day >= 1 && day <= 20;
  const daysToSeasonStart = (() => {
    if (inSeason) return 0;
    const nextJun1 = new Date(now.getFullYear() + (month > 6 ? 1 : 0), 5, 1);
    return Math.ceil((nextJun1 - now) / 86400000);
  })();
  return { inSeason, nearPeak, daysToSeasonStart, month };
};

const AVG_SEASON = { named: 14, hurricanes: 7, major: 3 };

// ── MapViewReset (must live inside MapContainer) ──────────────────────────────────

const MapViewReset = ({ lat, lon, zoom }) => {
  const map = useMap();
  useEffect(() => { map.setView([lat, lon], zoom); }, [lat, lon, zoom, map]);
  return null;
};

// ── HurricaneTab ──────────────────────────────────────────────────────────────────

const HurricaneTab = () => {
  const [view, setView]   = useState('active');
  const [basin, setBasin] = useState('atlantic');

  // Active storm state
  const [atlanticStorms, setAtlanticStorms] = useState(null);
  const [pacificStorms, setPacificStorms]   = useState(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(false);

  // History map state
  const [hurdat2Storms, setHurdat2Storms] = useState(null);
  const [histLoading, setHistLoading]     = useState(false);
  const [histError, setHistError]         = useState(null);
  const [selectedStorm, setSelectedStorm] = useState(null);
  const [selectedYear, setSelectedYear]   = useState(2023);

  // Fetch live active storms on mount
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(false);
      try {
        const [atl, pac] = await Promise.all([
          fetchActiveStorms(NHC_ATLANTIC_STORM_LAYERS),
          fetchActiveStorms(NHC_PACIFIC_STORM_LAYERS),
        ]);
        setAtlanticStorms(atl);
        setPacificStorms(pac);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Lazy-fetch HURDAT2 only when history view is opened
  useEffect(() => {
    if (view !== 'history') return;
    if (hurdat2Cache[basin]) {
      setHurdat2Storms(hurdat2Cache[basin]);
      return;
    }
    setHistLoading(true);
    setHistError(null);
    setHurdat2Storms(null);
    fetchHURDAT2(basin)
      .then(storms => setHurdat2Storms(storms))
      .catch(err => setHistError(err.message || 'Failed to load'))
      .finally(() => setHistLoading(false));
  }, [view, basin]);

  const activeStorms = basin === 'atlantic' ? atlanticStorms : pacificStorms;
  const totalActive  = (atlanticStorms?.length || 0) + (pacificStorms?.length || 0);
  const season       = getSeasonStatus();

  // Year bounds per basin
  const minYear = basin === 'atlantic' ? 1851 : 1949;
  const maxYear = 2023;

  // Filter HURDAT2 tracks to the selected season
  const seasonStorms = (hurdat2Storms ?? []).filter(s => {
    if (basin === 'atlantic' && s.basin !== 'AL') return false;
    if (basin === 'pacific'  && !['EP', 'CP'].includes(s.basin)) return false;
    return s.year === selectedYear;
  });

  // Season summary stats (wind in knots)
  const seasonNamed = seasonStorms.filter(s => s.peakWind >= 34).length;
  const seasonHurr  = seasonStorms.filter(s => s.peakWind >= 64).length;
  const seasonMajor = seasonStorms.filter(s => s.peakWind >= 96).length;

  const mapCenter = basin === 'atlantic' ? { lat: 25, lon: -60 } : { lat: 20, lon: -140 };

  return (
    <TabPanel title="HURRICANE TRACKER">

      {/* ── Top toggle: ACTIVE / HISTORY ── */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded border-2 font-bold transition-all ${
            view === 'active'
              ? 'border-cyan-400 bg-cyan-900/50 text-white shadow-neon-md'
              : 'border-cyan-800 text-cyan-400 hover:border-cyan-500 hover:bg-white/5'
          }`}
        >
          <Activity size={16} /> ACTIVE
        </button>
        <button
          onClick={() => setView('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded border-2 font-bold transition-all ${
            view === 'history'
              ? 'border-cyan-400 bg-cyan-900/50 text-white shadow-neon-md'
              : 'border-cyan-800 text-cyan-400 hover:border-cyan-500 hover:bg-white/5'
          }`}
        >
          <Map size={16} /> HISTORY
        </button>
      </div>

      {/* ══════════════════════ ACTIVE VIEW ══════════════════════ */}
      {view === 'active' && (
        <>
          {/* Season Context Panel */}
          <div className="mb-4 p-4 bg-black/30 rounded-lg border-2 border-cyan-800">
            <h3 className="text-lg text-cyan-300 font-bold mb-3 flex items-center gap-2">
              <Calendar size={18} /> ATLANTIC HURRICANE SEASON
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-white font-vt323 mb-3">
              <div className="bg-black/20 rounded p-2">
                <p className="text-xs text-cyan-400">SEASON DATES</p>
                <p className="text-base font-bold">JUN 1 – NOV 30</p>
              </div>
              <div className="bg-black/20 rounded p-2">
                <p className="text-xs text-cyan-400">PEAK</p>
                <p className={`text-base font-bold ${season.nearPeak ? 'text-red-400' : 'text-white'}`}>SEPT 10</p>
              </div>
              <div className={`rounded p-2 ${season.inSeason ? 'bg-orange-900/40 border border-orange-700' : 'bg-green-900/20 border border-green-900'}`}>
                <p className="text-xs text-cyan-400">STATUS</p>
                <p className={`text-base font-bold ${season.inSeason ? 'text-orange-300' : 'text-green-400'}`}>
                  {season.inSeason ? (season.nearPeak ? 'PEAK SEASON' : 'ACTIVE') : 'OFF-SEASON'}
                </p>
              </div>
              <div className="bg-black/20 rounded p-2">
                <p className="text-xs text-cyan-400">{season.inSeason ? 'ACTIVE SYSTEMS' : 'DAYS TO SEASON'}</p>
                <p className="text-base font-bold">
                  {season.inSeason ? totalActive : season.daysToSeasonStart}
                </p>
              </div>
            </div>
            <div className="border-t border-cyan-900 pt-3">
              <p className="text-xs text-cyan-500 mb-2 flex items-center gap-1">
                <TrendingUp size={12} /> AVG ATLANTIC SEASON (30-YR NORMAL)
              </p>
              <div className="flex gap-4 text-sm">
                <span className="text-cyan-300"><span className="text-white font-bold">{AVG_SEASON.named}</span> named storms</span>
                <span className="text-cyan-300"><span className="text-white font-bold">{AVG_SEASON.hurricanes}</span> hurricanes</span>
                <span className="text-cyan-300"><span className="text-white font-bold">{AVG_SEASON.major}</span> major (CAT 3+)</span>
              </div>
            </div>
          </div>

          {/* Active Storms */}
          <div className="mb-6 p-4 bg-black/30 rounded-lg border-2 border-cyan-700">
            <h3 className="text-xl text-cyan-300 font-bold mb-3 flex items-center gap-2">
              <CloudLightning size={20} /> ACTIVE TROPICAL SYSTEMS
            </h3>

            {loading && (
              <div className="flex items-center gap-2 text-cyan-400 py-4">
                <RefreshCw size={16} className="animate-spin" />
                <span>Querying NOAA MapServer for active systems...</span>
              </div>
            )}

            {!loading && error && (
              <div className="flex items-center gap-2 text-yellow-400 py-2">
                <AlertTriangle size={16} />
                <span className="text-sm">Unable to fetch live storm data. View the outlook maps below for current tropical activity.</span>
              </div>
            )}

            {!loading && !error && totalActive === 0 && (
              <div>
                <p className="text-green-400 py-2">No active tropical systems at this time.</p>
                {!season.inSeason && (
                  <p className="text-cyan-600 text-sm mt-1">
                    The Atlantic hurricane season runs June 1 through November 30.
                    {season.daysToSeasonStart > 0 && ` Next season begins in ${season.daysToSeasonStart} days.`}
                  </p>
                )}
              </div>
            )}

            {!loading && !error && activeStorms && activeStorms.length > 0 && (
              <div className="space-y-3">
                {activeStorms.map((storm, idx) => {
                  const cat = getStormCategory(storm.maxwind);
                  return (
                    <div key={idx} className={`p-3 bg-black/40 rounded border ${cat?.border || 'border-cyan-600'}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-white">{storm.stormname || 'Unnamed System'}</span>
                          {cat && (
                            <span className={`px-2 py-0.5 text-xs rounded ${cat.bg} ${cat.border} border ${cat.color} font-bold`}>
                              {cat.label}
                            </span>
                          )}
                          {storm.stormtype && <span className="text-xs text-gray-400">{storm.stormtype}</span>}
                        </div>
                        {storm.maxwind && (
                          <span className={`font-bold ${cat?.color || 'text-yellow-400'}`}>{storm.maxwind} mph</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                        {storm.gust && <span className="text-gray-300">Gusts: <span className="text-white font-bold">{storm.gust} mph</span></span>}
                        {storm.mslp && <span className="text-gray-300">Pressure: <span className="text-white font-bold">{storm.mslp} mb</span></span>}
                        {storm.tcdir != null && storm.tcspd != null && (
                          <span className="text-gray-300">Movement: <span className="text-white font-bold">{storm.tcdir}° at {storm.tcspd} mph</span></span>
                        )}
                        {storm.lat != null && storm.lon != null && (
                          <span className="text-gray-300">Position: <span className="text-white font-bold">{storm.lat.toFixed(1)}°N {Math.abs(storm.lon).toFixed(1)}°W</span></span>
                        )}
                      </div>
                      {storm.advdate && <p className="text-xs text-gray-500 mt-2">Advisory: {storm.advdate}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Basin Toggle */}
          <div className="flex gap-2 mb-4">
            {['atlantic', 'pacific'].map(b => (
              <button
                key={b}
                onClick={() => setBasin(b)}
                className={`px-4 py-2 rounded border-2 font-bold transition-all ${
                  basin === b
                    ? 'border-cyan-400 bg-cyan-900/50 text-white shadow-neon-md'
                    : 'border-cyan-800 text-cyan-400 hover:border-cyan-500 hover:bg-white/5'
                }`}
              >
                {b.toUpperCase()} {b === 'atlantic' && atlanticStorms?.length ? `(${atlanticStorms.length})` : ''}
                {b === 'pacific'  && pacificStorms?.length  ? `(${pacificStorms.length})`  : ''}
              </button>
            ))}
          </div>

          {/* 7-Day Outlook Map */}
          <div className="text-center">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg text-cyan-300">
                {basin === 'atlantic' ? 'ATLANTIC' : 'PACIFIC'} 7-DAY TROPICAL OUTLOOK
              </h3>
              <a
                href="https://www.nhc.noaa.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1 bg-cyan-900/50 text-cyan-300 rounded border border-cyan-500 hover:bg-cyan-800 hover:text-white transition font-vt323"
              >
                <ExternalLink size={16} /> NHC.NOAA.GOV
              </a>
            </div>
            <img
              src={basin === 'atlantic' ? NHC_ATLANTIC_OUTLOOK_URL : NHC_PACIFIC_OUTLOOK_URL}
              alt={`${basin === 'atlantic' ? 'Atlantic' : 'Pacific'} 7-Day Tropical Outlook`}
              className="w-full h-auto rounded-lg border-4 border-cyan-500 mx-auto max-w-4xl bg-black"
              onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
            />
            <p className="text-xs text-gray-400 mt-2 italic">
              Source: National Hurricane Center / NOAA
            </p>
          </div>
        </>
      )}

      {/* ══════════════════════ HISTORY VIEW ══════════════════════ */}
      {view === 'history' && (
        <>
          {/* Basin toggle */}
          <div className="flex gap-2 mb-4">
            {['atlantic', 'pacific'].map(b => (
              <button
                key={b}
                onClick={() => { setBasin(b); setSelectedStorm(null); setSelectedYear(2023); }}
                className={`px-4 py-1.5 rounded border-2 font-bold text-sm transition-all ${
                  basin === b
                    ? 'border-cyan-400 bg-cyan-900/50 text-white'
                    : 'border-cyan-800 text-cyan-400 hover:border-cyan-500'
                }`}
              >
                {b.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Year navigator */}
          <div className="flex items-center justify-between mb-4 p-3 bg-black/30 rounded-lg border border-cyan-800">
            <button
              onClick={() => { setSelectedYear(y => Math.max(minYear, y - 1)); setSelectedStorm(null); }}
              disabled={selectedYear <= minYear}
              className="px-4 py-1.5 rounded border border-cyan-700 text-cyan-300 font-bold hover:bg-cyan-900/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ◀ PREV
            </button>

            <div className="text-center">
              <p className="text-2xl font-bold text-white font-vt323">{selectedYear}</p>
              <p className="text-xs text-cyan-500 uppercase">
                {basin === 'atlantic' ? 'Atlantic' : 'Eastern Pacific'} Season
              </p>
            </div>

            <button
              onClick={() => { setSelectedYear(y => Math.min(maxYear, y + 1)); setSelectedStorm(null); }}
              disabled={selectedYear >= maxYear}
              className="px-4 py-1.5 rounded border border-cyan-700 text-cyan-300 font-bold hover:bg-cyan-900/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              NEXT ▶
            </button>
          </div>

          {/* Season summary stats */}
          {!histLoading && !histError && hurdat2Storms && (
            <div className="grid grid-cols-3 gap-3 mb-4 text-center font-vt323">
              <div className="bg-black/20 rounded p-2 border border-cyan-900">
                <p className="text-xs text-cyan-500">NAMED STORMS</p>
                <p className="text-2xl font-bold text-white">{seasonNamed}</p>
                <p className="text-xs text-cyan-700">avg {AVG_SEASON.named}</p>
              </div>
              <div className="bg-black/20 rounded p-2 border border-cyan-900">
                <p className="text-xs text-cyan-500">HURRICANES</p>
                <p className="text-2xl font-bold text-white">{seasonHurr}</p>
                <p className="text-xs text-cyan-700">avg {AVG_SEASON.hurricanes}</p>
              </div>
              <div className="bg-black/20 rounded p-2 border border-cyan-900">
                <p className="text-xs text-cyan-500">MAJOR (CAT 3+)</p>
                <p className="text-2xl font-bold text-white">{seasonMajor}</p>
                <p className="text-xs text-cyan-700">avg {AVG_SEASON.major}</p>
              </div>
            </div>
          )}

          {/* Category legend */}
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            {[
              { label: 'TD',    color: '#6B7280' },
              { label: 'TS',    color: '#67E8F9' },
              { label: 'CAT 1', color: '#FBBF24' },
              { label: 'CAT 2', color: '#FFD700' },
              { label: 'CAT 3', color: '#FF8C00' },
              { label: 'CAT 4', color: '#FF4500' },
              { label: 'CAT 5', color: '#FF00FF' },
            ].map(c => (
              <span key={c.label} className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-1.5 rounded-full" style={{ background: c.color }} />
                <span style={{ color: c.color }}>{c.label}</span>
              </span>
            ))}
          </div>

          {/* Loading */}
          {histLoading && (
            <div className="flex items-center gap-2 text-cyan-400 py-10 justify-center">
              <RefreshCw size={16} className="animate-spin" />
              <span>Loading HURDAT2 historical data...</span>
            </div>
          )}

          {/* Error */}
          {histError && (
            <div className="p-4 bg-black/30 rounded-lg border border-yellow-700 text-yellow-400">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} />
                <span className="font-bold">Could not load historical track data</span>
              </div>
              <a
                href="https://www.nhc.noaa.gov/data/#hurdat"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/40 border border-yellow-600 rounded text-sm hover:bg-yellow-900/60 transition w-fit"
              >
                <ExternalLink size={14} /> View HURDAT2 on NHC
              </a>
            </div>
          )}

          {/* Map */}
          {!histLoading && !histError && hurdat2Storms && (
            <div className="rounded-lg overflow-hidden border-2 border-cyan-700" style={{ height: 420 }}>
              <MapContainer
                center={[mapCenter.lat, mapCenter.lon]}
                zoom={3}
                style={{ height: '100%', width: '100%', background: '#05050f' }}
                zoomControl
                attributionControl={false}
              >
                <MapViewReset lat={mapCenter.lat} lon={mapCenter.lon} zoom={3} />
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution="© CARTO"
                  subdomains="abcd"
                  maxZoom={19}
                />
                {seasonStorms.map((storm) => {
                  const isSelected = selectedStorm?.id === storm.id;
                  const cat = getCatFromKnots(storm.peakWind);
                  return (
                    <Polyline
                      key={storm.id}
                      positions={storm.track.map(p => [p.lat, p.lon])}
                      pathOptions={{
                        color:   cat.color,
                        weight:  isSelected ? 4 : 2,
                        opacity: isSelected ? 1 : 0.75,
                      }}
                      eventHandlers={{
                        click: () => setSelectedStorm(isSelected ? null : storm),
                      }}
                    >
                      <Tooltip sticky>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {storm.name} · {cat.label} · {Math.round(storm.peakWind * 1.15078)} mph peak
                        </span>
                      </Tooltip>
                    </Polyline>
                  );
                })}
              </MapContainer>
            </div>
          )}

          {/* Storm list for the selected season */}
          {!histLoading && !histError && hurdat2Storms && seasonStorms.length > 0 && (
            <div className="mt-3 space-y-1">
              {seasonStorms.map((storm) => {
                const isSelected = selectedStorm?.id === storm.id;
                const cat = getCatFromKnots(storm.peakWind);
                return (
                  <button
                    key={storm.id}
                    onClick={() => setSelectedStorm(isSelected ? null : storm)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded border text-sm transition-all ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-900/40 text-white'
                        : 'border-cyan-900 bg-black/20 text-cyan-300 hover:border-cyan-600 hover:bg-black/40'
                    }`}
                  >
                    <span className="font-bold">{storm.name}</span>
                    <span
                      className="px-2 py-0.5 text-xs rounded font-bold border"
                      style={{ color: cat.color, borderColor: cat.color }}
                    >
                      {cat.label}
                    </span>
                    <span className="text-gray-400 text-xs">{Math.round(storm.peakWind * 1.15078)} mph peak</span>
                  </button>
                );
              })}
            </div>
          )}

          {!histLoading && !histError && hurdat2Storms && seasonStorms.length === 0 && (
            <p className="text-cyan-600 text-sm text-center py-4">No recorded storms for {selectedYear}.</p>
          )}

          <p className="text-xs text-gray-500 mt-3 italic text-center">
            NOAA HURDAT2 Best Track Database · Click a track or storm name to highlight
          </p>
        </>
      )}

    </TabPanel>
  );
};

export default HurricaneTab;
