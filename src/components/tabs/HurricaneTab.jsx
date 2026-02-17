import React, { useState, useEffect } from 'react';
import { CloudLightning, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import {
  NHC_ATLANTIC_OUTLOOK_URL,
  NHC_PACIFIC_OUTLOOK_URL,
  NHC_MAPSERVER_BASE,
  NHC_ATLANTIC_STORM_LAYERS,
  NHC_PACIFIC_STORM_LAYERS,
  PLACEHOLDER_IMG,
} from '../../utils/constants';

// Query a single MapServer layer for the current position (tau=0) of an active storm
const queryStormLayer = async (layerId) => {
  const url = `${NHC_MAPSERVER_BASE}/${layerId}/query?where=tau%3D0&outFields=stormname,stormtype,maxwind,gust,mslp,tcdir,tcspd,advdate,lat,lon,basin&f=json&returnGeometry=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.features || data.features.length === 0) return null;
  return data.features[0].attributes;
};

// Fetch all active storms across a set of layers
const fetchActiveStorms = async (layers) => {
  const results = await Promise.all(layers.map(queryStormLayer));
  return results.filter(Boolean);
};

const getStormCategory = (windMph) => {
  if (!windMph) return null;
  if (windMph >= 157) return { label: 'CAT 5', color: 'text-fuchsia-400', border: 'border-fuchsia-500', bg: 'bg-fuchsia-900/50' };
  if (windMph >= 130) return { label: 'CAT 4', color: 'text-red-400', border: 'border-red-500', bg: 'bg-red-900/50' };
  if (windMph >= 111) return { label: 'CAT 3', color: 'text-orange-400', border: 'border-orange-500', bg: 'bg-orange-900/50' };
  if (windMph >= 96) return { label: 'CAT 2', color: 'text-yellow-400', border: 'border-yellow-500', bg: 'bg-yellow-900/50' };
  if (windMph >= 74) return { label: 'CAT 1', color: 'text-yellow-300', border: 'border-yellow-400', bg: 'bg-yellow-900/40' };
  if (windMph >= 39) return { label: 'TS', color: 'text-cyan-400', border: 'border-cyan-500', bg: 'bg-cyan-900/40' };
  return { label: 'TD', color: 'text-gray-400', border: 'border-gray-500', bg: 'bg-gray-900/40' };
};

const HurricaneTab = () => {
  const [basin, setBasin] = useState('atlantic');
  const [atlanticStorms, setAtlanticStorms] = useState(null);
  const [pacificStorms, setPacificStorms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  const activeStorms = basin === 'atlantic' ? atlanticStorms : pacificStorms;
  const totalActive = (atlanticStorms?.length || 0) + (pacificStorms?.length || 0);

  return (
    <TabPanel title="HURRICANE TRACKER">
      {/* Active Storms Section */}
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
          <p className="text-green-400 py-2">No active tropical systems at this time.</p>
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
                      {storm.stormtype && (
                        <span className="text-xs text-gray-400">{storm.stormtype}</span>
                      )}
                    </div>
                    {storm.maxwind && (
                      <span className={`font-bold ${cat?.color || 'text-yellow-400'}`}>{storm.maxwind} mph</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                    {storm.gust && (
                      <span className="text-gray-300">Gusts: <span className="text-white font-bold">{storm.gust} mph</span></span>
                    )}
                    {storm.mslp && (
                      <span className="text-gray-300">Pressure: <span className="text-white font-bold">{storm.mslp} mb</span></span>
                    )}
                    {storm.tcdir != null && storm.tcspd != null && (
                      <span className="text-gray-300">Movement: <span className="text-white font-bold">{storm.tcdir}° at {storm.tcspd} mph</span></span>
                    )}
                    {storm.lat != null && storm.lon != null && (
                      <span className="text-gray-300">Position: <span className="text-white font-bold">{storm.lat.toFixed(1)}°N {Math.abs(storm.lon).toFixed(1)}°W</span></span>
                    )}
                  </div>
                  {storm.advdate && (
                    <p className="text-xs text-gray-500 mt-2">Advisory: {storm.advdate}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Basin Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setBasin('atlantic')}
          className={`px-4 py-2 rounded border-2 font-bold transition-all ${
            basin === 'atlantic'
              ? 'border-cyan-400 bg-cyan-900/50 text-white shadow-neon-md'
              : 'border-cyan-800 text-cyan-400 hover:border-cyan-500 hover:bg-white/5'
          }`}
        >
          ATLANTIC {atlanticStorms?.length ? `(${atlanticStorms.length})` : ''}
        </button>
        <button
          onClick={() => setBasin('pacific')}
          className={`px-4 py-2 rounded border-2 font-bold transition-all ${
            basin === 'pacific'
              ? 'border-cyan-400 bg-cyan-900/50 text-white shadow-neon-md'
              : 'border-cyan-800 text-cyan-400 hover:border-cyan-500 hover:bg-white/5'
          }`}
        >
          PACIFIC {pacificStorms?.length ? `(${pacificStorms.length})` : ''}
        </button>
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
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = PLACEHOLDER_IMG;
          }}
        />
        <p className="text-xs text-gray-400 mt-2 italic">
          Source: National Hurricane Center / NOAA
        </p>
      </div>
    </TabPanel>
  );
};

export default HurricaneTab;
