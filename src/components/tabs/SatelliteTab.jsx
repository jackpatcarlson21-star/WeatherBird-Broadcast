import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import { getSatelliteInfo } from '../../utils/helpers';

const BASE = 'https://cdn.star.nesdis.noaa.gov';

const CHANNELS = [
  {
    id: 'GEOCOLOR',
    label: 'VISIBLE',
    description: 'GeoColor — daytime true-color / nighttime IR composite',
    buildUrl: (sat, path, sector) =>
      `${BASE}/${sat}/ABI/${path}/GEOCOLOR/${sat}-${sector}-GEOCOLOR-600x600.gif`,
  },
  {
    id: 'Sandwich',
    label: 'INFRARED',
    description: 'Sandwich — visible imagery with IR cloud-top temperature overlay',
    buildUrl: (sat, path, sector) =>
      `${BASE}/${sat}/ABI/${path}/Sandwich/${sat}-${sector}-Sandwich-600x600.gif`,
  },
  {
    id: 'AirMass',
    label: 'WATER VAPOR',
    description: 'AirMass RGB — moisture patterns, jet stream & air mass boundaries',
    buildUrl: (sat, path, sector) =>
      `${BASE}/${sat}/ABI/${path}/AirMass/${sat}-${sector}-AirMass-600x600.gif`,
  },
];

const SatelliteTab = ({ location }) => {
  const [channel, setChannel] = useState('GEOCOLOR');
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(Date.now());
      setImgLoading(true);
      setImgError(false);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const satInfo = useMemo(() => getSatelliteInfo(location.lat, location.lon), [location.lat, location.lon]);
  const activeChannel = CHANNELS.find(c => c.id === channel);
  const imgSrc = `${activeChannel.buildUrl(satInfo.sat, satInfo.path, satInfo.sector)}?t=${refreshKey}`;

  const handleChannel = (id) => {
    if (id === channel) return;
    setChannel(id);
    setImgLoading(true);
    setImgError(false);
  };

  return (
    <TabPanel title="SATELLITE IMAGERY">
      <div className="text-center space-y-4">
        {/* Channel toggle */}
        <div className="flex justify-center gap-2 flex-wrap">
          {CHANNELS.map(c => (
            <button
              key={c.id}
              onClick={() => handleChannel(c.id)}
              className={`px-4 py-2 rounded-lg font-vt323 text-lg transition-all ${
                channel === c.id
                  ? 'bg-cyan-600 text-white border-2 border-white'
                  : 'bg-black/30 text-cyan-300 border-2 border-cyan-700 hover:border-cyan-500'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <h3 className="text-xl sm:text-2xl text-cyan-300">
          {satInfo.label.toUpperCase()} — {satInfo.sat}
        </h3>
        <p className="text-sm text-cyan-400">{activeChannel.description}</p>

        <div
          className="relative w-full rounded-lg border-4 border-cyan-500 overflow-hidden bg-black flex items-center justify-center"
          style={{ minHeight: '500px' }}
        >
          {imgLoading && !imgError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <RefreshCw size={32} className="text-cyan-400 animate-spin mb-2" />
              <span className="text-cyan-400 text-sm">Loading imagery...</span>
            </div>
          )}
          {imgError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <AlertTriangle size={32} className="text-yellow-400 mb-2" />
              <span className="text-yellow-400 text-sm">Failed to load satellite image</span>
              <button
                onClick={() => { setImgError(false); setImgLoading(true); setRefreshKey(Date.now()); }}
                className="mt-2 px-3 py-1 text-xs bg-cyan-900/50 text-cyan-300 rounded border border-cyan-600 hover:bg-cyan-800 transition"
              >
                RETRY
              </button>
            </div>
          )}
          <img
            key={`${channel}-${refreshKey}`}
            src={imgSrc}
            alt={`${satInfo.label} ${activeChannel.label} satellite`}
            className={`max-w-full max-h-full ${imgLoading || imgError ? 'opacity-0' : 'opacity-100'} transition-opacity`}
            onLoad={() => { setImgLoading(false); setImgError(false); }}
            onError={() => { setImgLoading(false); setImgError(true); }}
          />
        </div>

        <p className="text-xs text-cyan-400">
          Source: NOAA GOES Satellite — auto-refreshes every 5 minutes
        </p>
      </div>
    </TabPanel>
  );
};

export default SatelliteTab;
