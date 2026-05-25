import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import TabPanel from '../layout/TabPanel';

const getSatelliteInfo = (lat, lon) => {
  if (lat > 54)               return { sat: 'GOES18', path: 'SECTOR/AK',  sector: 'AK',    label: 'Alaska' };
  if (lat < 25 && lon < -150) return { sat: 'GOES18', path: 'SECTOR/HI',  sector: 'HI',    label: 'Hawaii' };
  if (lon <= -100)             return { sat: 'GOES19', path: 'CONUS',      sector: 'CONUS', label: 'Continental US' };
  if (lon <= -90) return lat < 37
    ? { sat: 'GOES19', path: 'SECTOR/SP',  sector: 'SP',  label: 'Southern Plains' }
    : { sat: 'GOES19', path: 'SECTOR/CGL', sector: 'CGL', label: 'Great Lakes' };
  if (lat < 35)   return { sat: 'GOES19', path: 'SECTOR/SE',  sector: 'SE',  label: 'Southeast' };
  if (lon > -78)  return { sat: 'GOES19', path: 'SECTOR/NE',  sector: 'NE',  label: 'Northeast' };
  return               { sat: 'GOES19', path: 'SECTOR/CGL', sector: 'CGL', label: 'Great Lakes' };
};

const CHANNELS = [
  {
    id: 'GEOCOLOR',
    label: 'VISIBLE',
    description: 'GeoColor — daytime true-color / nighttime IR composite',
    buildUrl: (sat, path, sector) =>
      `https://cdn.star.nesdis.noaa.gov/${sat}/ABI/${path}/GEOCOLOR/${sat}-${sector}-GEOCOLOR-600x600.gif`,
  },
  {
    id: '13',
    label: 'INFRARED',
    description: 'Band 13 — Clean longwave IR (shows cloud tops, day & night)',
    buildUrl: (sat, path, sector) =>
      `https://cdn.star.nesdis.noaa.gov/${sat}/ABI/${path}/13/${sat}-${sector}-Band13-600x600.gif`,
  },
  {
    id: '09',
    label: 'WATER VAPOR',
    description: 'Band 09 — Mid-level water vapor (tracks moisture & jet stream)',
    buildUrl: (sat, path, sector) =>
      `https://cdn.star.nesdis.noaa.gov/${sat}/ABI/${path}/09/${sat}-${sector}-Band09-600x600.gif`,
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
