import React, { useState, useEffect } from 'react';
import { CloudLightning, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import { NHC_ATLANTIC_OUTLOOK_URL, NHC_PACIFIC_OUTLOOK_URL, NHC_CURRENT_SUMMARIES_URL, PLACEHOLDER_IMG } from '../../utils/constants';

const HurricaneTab = () => {
  const [basin, setBasin] = useState('atlantic');
  const [storms, setStorms] = useState(null);
  const [stormsError, setStormsError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStorms = async () => {
      setLoading(true);
      try {
        const res = await fetch(NHC_CURRENT_SUMMARIES_URL);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setStorms(data);
        setStormsError(false);
      } catch {
        setStormsError(true);
        setStorms(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStorms();
  }, []);

  const activeStorms = storms?.activeStorms || [];

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
            <span>Checking for active systems...</span>
          </div>
        )}

        {!loading && stormsError && (
          <div className="flex items-center gap-2 text-yellow-400 py-2">
            <AlertTriangle size={16} />
            <span className="text-sm">Unable to fetch live storm data (CORS restricted). View the outlook maps below for current tropical activity.</span>
          </div>
        )}

        {!loading && !stormsError && activeStorms.length === 0 && (
          <p className="text-green-400 py-2">No active tropical systems at this time.</p>
        )}

        {!loading && !stormsError && activeStorms.length > 0 && (
          <div className="space-y-3">
            {activeStorms.map((storm, idx) => (
              <div key={idx} className="p-3 bg-black/40 rounded border border-cyan-600">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-lg font-bold text-white">{storm.name || 'Unnamed System'}</span>
                    {storm.classification && (
                      <span className="ml-2 px-2 py-0.5 text-xs rounded bg-red-900/50 border border-red-500 text-red-300">
                        {storm.classification}
                      </span>
                    )}
                  </div>
                  {storm.intensity && (
                    <span className="text-yellow-400 font-bold">{storm.intensity} mph</span>
                  )}
                </div>
                {storm.movement && (
                  <p className="text-sm text-cyan-300 mt-1">Movement: {storm.movement}</p>
                )}
                {storm.pressure && (
                  <p className="text-sm text-gray-400">Pressure: {storm.pressure} mb</p>
                )}
                {storm.headline && (
                  <p className="text-sm text-gray-300 mt-2">{storm.headline}</p>
                )}
              </div>
            ))}
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
          ATLANTIC
        </button>
        <button
          onClick={() => setBasin('pacific')}
          className={`px-4 py-2 rounded border-2 font-bold transition-all ${
            basin === 'pacific'
              ? 'border-cyan-400 bg-cyan-900/50 text-white shadow-neon-md'
              : 'border-cyan-800 text-cyan-400 hover:border-cyan-500 hover:bg-white/5'
          }`}
        >
          PACIFIC
        </button>
      </div>

      {/* 5-Day Outlook Map */}
      <div className="text-center">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg text-cyan-300">
            {basin === 'atlantic' ? 'ATLANTIC' : 'PACIFIC'} 5-DAY TROPICAL OUTLOOK
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
          alt={`${basin === 'atlantic' ? 'Atlantic' : 'Pacific'} 5-Day Tropical Outlook`}
          className="w-full h-auto rounded-lg border-4 border-cyan-500 mx-auto max-w-4xl bg-black"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = PLACEHOLDER_IMG;
          }}
        />
        <p className="text-xs text-gray-400 mt-2 italic">
          Source: National Hurricane Center / NOAA. Image updates every 6 hours.
        </p>
      </div>
    </TabPanel>
  );
};

export default HurricaneTab;
