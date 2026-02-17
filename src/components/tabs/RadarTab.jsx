import React, { useState, useMemo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import TabPanel from '../layout/TabPanel';

// NEXRAD Radar Stations with coordinates (decimal degrees)
const NEXRAD_STATIONS = [
  { id: 'KABR', name: 'Aberdeen, SD', lat: 45.456, lon: -98.413 },
  { id: 'KENX', name: 'Albany, NY', lat: 42.586, lon: -74.064 },
  { id: 'KABX', name: 'Albuquerque, NM', lat: 35.150, lon: -106.824 },
  { id: 'KAMA', name: 'Amarillo, TX', lat: 35.233, lon: -101.709 },
  { id: 'KFFC', name: 'Atlanta, GA', lat: 33.364, lon: -84.566 },
  { id: 'KEWX', name: 'Austin/San Antonio, TX', lat: 29.704, lon: -98.028 },
  { id: 'KBBX', name: 'Beale AFB, CA', lat: 39.496, lon: -121.632 },
  { id: 'KBGM', name: 'Binghamton, NY', lat: 42.200, lon: -75.985 },
  { id: 'KBMX', name: 'Birmingham, AL', lat: 33.172, lon: -86.770 },
  { id: 'KBIS', name: 'Bismarck, ND', lat: 46.771, lon: -100.760 },
  { id: 'KBOX', name: 'Boston, MA', lat: 41.956, lon: -71.137 },
  { id: 'KBRO', name: 'Brownsville, TX', lat: 25.916, lon: -97.419 },
  { id: 'KBUF', name: 'Buffalo, NY', lat: 42.949, lon: -78.737 },
  { id: 'KCXX', name: 'Burlington, VT', lat: 44.511, lon: -73.167 },
  { id: 'KCAE', name: 'Columbia, SC', lat: 33.949, lon: -81.118 },
  { id: 'KCLX', name: 'Charleston, SC', lat: 32.656, lon: -81.042 },
  { id: 'KRLX', name: 'Charleston, WV', lat: 38.311, lon: -81.723 },
  { id: 'KCYS', name: 'Cheyenne, WY', lat: 41.152, lon: -104.806 },
  { id: 'KLOT', name: 'Chicago, IL', lat: 41.605, lon: -88.085 },
  { id: 'KILN', name: 'Cincinnati, OH', lat: 39.420, lon: -83.822 },
  { id: 'KCLE', name: 'Cleveland, OH', lat: 41.413, lon: -81.860 },
  { id: 'KCRP', name: 'Corpus Christi, TX', lat: 27.784, lon: -97.511 },
  { id: 'KFWS', name: 'Dallas/Fort Worth, TX', lat: 32.573, lon: -97.303 },
  { id: 'KDVN', name: 'Davenport, IA', lat: 41.612, lon: -90.581 },
  { id: 'KFTG', name: 'Denver, CO', lat: 39.787, lon: -104.546 },
  { id: 'KDMX', name: 'Des Moines, IA', lat: 41.731, lon: -93.723 },
  { id: 'KDTX', name: 'Detroit, MI', lat: 42.700, lon: -83.472 },
  { id: 'KDDC', name: 'Dodge City, KS', lat: 37.761, lon: -99.969 },
  { id: 'KDLH', name: 'Duluth, MN', lat: 46.837, lon: -92.210 },
  { id: 'KEPZ', name: 'El Paso, TX', lat: 31.873, lon: -106.698 },
  { id: 'KEOX', name: 'Fort Rucker, AL', lat: 31.461, lon: -85.459 },
  { id: 'KAPX', name: 'Gaylord, MI', lat: 44.907, lon: -84.720 },
  { id: 'KGGW', name: 'Glasgow, MT', lat: 48.206, lon: -106.625 },
  { id: 'KGLD', name: 'Goodland, KS', lat: 39.367, lon: -101.700 },
  { id: 'KMVX', name: 'Grand Forks, ND', lat: 47.528, lon: -97.325 },
  { id: 'KGJX', name: 'Grand Junction, CO', lat: 39.062, lon: -108.214 },
  { id: 'KGRR', name: 'Grand Rapids, MI', lat: 42.894, lon: -85.545 },
  { id: 'KTFX', name: 'Great Falls, MT', lat: 47.460, lon: -111.385 },
  { id: 'KGRB', name: 'Green Bay, WI', lat: 44.499, lon: -88.111 },
  { id: 'KGSP', name: 'Greenville/Spartanburg, SC', lat: 34.883, lon: -82.220 },
  { id: 'KUEX', name: 'Hastings, NE', lat: 40.321, lon: -98.442 },
  { id: 'KHGX', name: 'Houston, TX', lat: 29.472, lon: -95.079 },
  { id: 'KIND', name: 'Indianapolis, IN', lat: 39.708, lon: -86.280 },
  { id: 'KJKL', name: 'Jackson, KY', lat: 37.591, lon: -83.313 },
  { id: 'KJAN', name: 'Jackson, MS', lat: 32.318, lon: -90.080 },
  { id: 'KJAX', name: 'Jacksonville, FL', lat: 30.485, lon: -81.702 },
  { id: 'KEAX', name: 'Kansas City, MO', lat: 38.810, lon: -94.264 },
  { id: 'KBYX', name: 'Key West, FL', lat: 24.598, lon: -81.703 },
  { id: 'KMRX', name: 'Knoxville, TN', lat: 36.169, lon: -83.402 },
  { id: 'KARX', name: 'La Crosse, WI', lat: 43.823, lon: -91.191 },
  { id: 'KLCH', name: 'Lake Charles, LA', lat: 30.125, lon: -93.216 },
  { id: 'KESX', name: 'Las Vegas, NV', lat: 35.701, lon: -114.891 },
  { id: 'KDFX', name: 'Laughlin AFB, TX', lat: 29.273, lon: -100.281 },
  { id: 'KILX', name: 'Lincoln, IL', lat: 40.151, lon: -89.337 },
  { id: 'KLZK', name: 'Little Rock, AR', lat: 34.836, lon: -92.262 },
  { id: 'KVTX', name: 'Los Angeles, CA', lat: 34.412, lon: -119.179 },
  { id: 'KLVX', name: 'Louisville, KY', lat: 37.975, lon: -85.944 },
  { id: 'KLBB', name: 'Lubbock, TX', lat: 33.654, lon: -101.814 },
  { id: 'KMQT', name: 'Marquette, MI', lat: 46.531, lon: -87.548 },
  { id: 'KMLB', name: 'Melbourne, FL', lat: 28.113, lon: -80.654 },
  { id: 'KNQA', name: 'Memphis, TN', lat: 35.345, lon: -89.873 },
  { id: 'KAMX', name: 'Miami, FL', lat: 25.611, lon: -80.413 },
  { id: 'KMAF', name: 'Midland, TX', lat: 31.943, lon: -102.189 },
  { id: 'KMKX', name: 'Milwaukee, WI', lat: 42.968, lon: -88.551 },
  { id: 'KMPX', name: 'Minneapolis, MN', lat: 44.849, lon: -93.566 },
  { id: 'KMBX', name: 'Minot, ND', lat: 48.393, lon: -100.865 },
  { id: 'KMOB', name: 'Mobile, AL', lat: 30.679, lon: -88.240 },
  { id: 'KVAX', name: 'Moody AFB, GA', lat: 30.890, lon: -83.002 },
  { id: 'KMHX', name: 'Morehead City, NC', lat: 34.776, lon: -76.876 },
  { id: 'KOHX', name: 'Nashville, TN', lat: 36.247, lon: -86.563 },
  { id: 'KLIX', name: 'New Orleans, LA', lat: 30.337, lon: -89.826 },
  { id: 'KOKX', name: 'New York City, NY', lat: 40.866, lon: -72.864 },
  { id: 'KAKQ', name: 'Norfolk, VA', lat: 36.984, lon: -77.008 },
  { id: 'KLNX', name: 'North Platte, NE', lat: 41.958, lon: -100.576 },
  { id: 'KTLX', name: 'Oklahoma City, OK', lat: 35.333, lon: -97.278 },
  { id: 'KOAX', name: 'Omaha, NE', lat: 41.320, lon: -96.367 },
  { id: 'KPAH', name: 'Paducah, KY', lat: 37.068, lon: -88.772 },
  { id: 'KPDT', name: 'Pendleton, OR', lat: 45.691, lon: -118.853 },
  { id: 'KDIX', name: 'Philadelphia, PA', lat: 39.947, lon: -74.411 },
  { id: 'KIWA', name: 'Phoenix, AZ', lat: 33.289, lon: -111.670 },
  { id: 'KPBZ', name: 'Pittsburgh, PA', lat: 40.532, lon: -80.218 },
  { id: 'KGYX', name: 'Portland, ME', lat: 43.891, lon: -70.256 },
  { id: 'KRTX', name: 'Portland, OR', lat: 45.715, lon: -122.966 },
  { id: 'KPUX', name: 'Pueblo, CO', lat: 38.460, lon: -104.181 },
  { id: 'KRAX', name: 'Raleigh, NC', lat: 35.666, lon: -78.490 },
  { id: 'KUDX', name: 'Rapid City, SD', lat: 44.125, lon: -102.830 },
  { id: 'KRGX', name: 'Reno, NV', lat: 39.754, lon: -119.462 },
  { id: 'KRIW', name: 'Riverton, WY', lat: 43.066, lon: -108.477 },
  { id: 'KFCX', name: 'Roanoke, VA', lat: 37.024, lon: -80.274 },
  { id: 'KJGX', name: 'Robins AFB, GA', lat: 32.675, lon: -83.351 },
  { id: 'KDAX', name: 'Sacramento, CA', lat: 38.501, lon: -121.678 },
  { id: 'KLSX', name: 'St. Louis, MO', lat: 38.699, lon: -90.683 },
  { id: 'KMTX', name: 'Salt Lake City, UT', lat: 41.263, lon: -112.448 },
  { id: 'KSJT', name: 'San Angelo, TX', lat: 31.371, lon: -100.493 },
  { id: 'KNKX', name: 'San Diego, CA', lat: 32.919, lon: -117.042 },
  { id: 'KMUX', name: 'San Francisco, CA', lat: 37.155, lon: -121.898 },
  { id: 'KHNX', name: 'San Joaquin Valley, CA', lat: 36.314, lon: -119.632 },
  { id: 'KSOX', name: 'Santa Ana Mountains, CA', lat: 33.818, lon: -117.636 },
  { id: 'KATX', name: 'Seattle, WA', lat: 48.195, lon: -122.496 },
  { id: 'KSHV', name: 'Shreveport, LA', lat: 32.451, lon: -93.841 },
  { id: 'KFSD', name: 'Sioux Falls, SD', lat: 43.588, lon: -96.729 },
  { id: 'KOTX', name: 'Spokane, WA', lat: 47.680, lon: -117.627 },
  { id: 'KSGF', name: 'Springfield, MO', lat: 37.235, lon: -93.400 },
  { id: 'KCCX', name: 'State College, PA', lat: 40.923, lon: -78.004 },
  { id: 'KLWX', name: 'Sterling, VA (DC)', lat: 38.976, lon: -77.478 },
  { id: 'KTLH', name: 'Tallahassee, FL', lat: 30.398, lon: -84.329 },
  { id: 'KTBW', name: 'Tampa, FL', lat: 27.706, lon: -82.402 },
  { id: 'KTWX', name: 'Topeka, KS', lat: 38.997, lon: -96.233 },
  { id: 'KEMX', name: 'Tucson, AZ', lat: 31.894, lon: -110.630 },
  { id: 'KINX', name: 'Tulsa, OK', lat: 36.175, lon: -95.565 },
  { id: 'KVNX', name: 'Vance AFB, OK', lat: 36.741, lon: -98.128 },
  { id: 'KICT', name: 'Wichita, KS', lat: 37.655, lon: -97.443 },
  { id: 'KLTX', name: 'Wilmington, NC', lat: 33.989, lon: -78.429 },
  // Alaska
  { id: 'PAHG', name: 'Kenai/Anchorage, AK', lat: 60.726, lon: -151.351 },
  { id: 'PAPD', name: 'Fairbanks, AK', lat: 65.035, lon: -147.502 },
  { id: 'PACG', name: 'Sitka, AK', lat: 56.853, lon: -135.529 },
  { id: 'PAEC', name: 'Nome, AK', lat: 64.512, lon: -165.295 },
  { id: 'PAKC', name: 'King Salmon, AK', lat: 58.680, lon: -156.629 },
  { id: 'PAIH', name: 'Middleton Island, AK', lat: 59.461, lon: -146.303 },
  { id: 'PABC', name: 'Bethel, AK', lat: 60.792, lon: -161.876 },
  // Hawaii
  { id: 'PHKM', name: 'Kohala, HI (Big Island)', lat: 20.125, lon: -155.778 },
  { id: 'PHKI', name: 'Kauai, HI', lat: 21.894, lon: -159.552 },
  { id: 'PHMO', name: 'Molokai, HI', lat: 21.133, lon: -157.180 },
  { id: 'PHWA', name: 'South Shore, HI (Oahu)', lat: 21.305, lon: -158.019 },
];

// Find nearest radar station to a given location
const findNearestRadar = (lat, lon) => {
  let nearest = NEXRAD_STATIONS[0];
  let minDist = Infinity;

  for (const station of NEXRAD_STATIONS) {
    const dLat = station.lat - lat;
    const dLon = station.lon - lon;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < minDist) {
      minDist = dist;
      nearest = station;
    }
  }
  return nearest;
};

const RadarTab = ({ location }) => {
  const nearestRadar = useMemo(() => findNearestRadar(location.lat, location.lon), [location.lat, location.lon]);
  const [showNational, setShowNational] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const localRadarUrl = `https://radar.weather.gov/ridge/standard/${nearestRadar.id}_loop.gif`;

  const handleToggle = (national) => {
    setShowNational(national);
    setImgLoading(true);
    setImgError(false);
  };

  return (
    <TabPanel title="DOPPLER RADAR">
      <div className="text-center space-y-4">
        {/* Toggle buttons */}
        <div className="flex justify-center gap-2">
          <button
            onClick={() => handleToggle(false)}
            className={`px-4 py-2 rounded-lg font-vt323 text-lg transition-all ${
              !showNational
                ? 'bg-cyan-600 text-white border-2 border-white'
                : 'bg-black/30 text-cyan-300 border-2 border-cyan-700 hover:border-cyan-500'
            }`}
          >
            LOCAL
          </button>
          <button
            onClick={() => handleToggle(true)}
            className={`px-4 py-2 rounded-lg font-vt323 text-lg transition-all ${
              showNational
                ? 'bg-cyan-600 text-white border-2 border-white'
                : 'bg-black/30 text-cyan-300 border-2 border-cyan-700 hover:border-cyan-500'
            }`}
          >
            NATIONAL
          </button>
        </div>

        <h3 className="text-xl sm:text-2xl text-cyan-300">
          {showNational ? 'NATIONAL RADAR' : `NEXRAD RADAR - ${nearestRadar.id}`}
        </h3>
        <p className="text-sm text-cyan-400">
          {showNational ? 'Continental United States' : nearestRadar.name}
        </p>

        <div className="relative w-full rounded-lg border-4 border-cyan-500 overflow-hidden bg-black flex items-center justify-center" style={{ minHeight: '500px' }}>
          {imgLoading && !imgError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <RefreshCw size={32} className="text-cyan-400 animate-spin mb-2" />
              <span className="text-cyan-400 text-sm">Loading radar imagery...</span>
            </div>
          )}
          {imgError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <AlertTriangle size={32} className="text-yellow-400 mb-2" />
              <span className="text-yellow-400 text-sm">Failed to load radar image</span>
              <button
                onClick={() => { setImgError(false); setImgLoading(true); }}
                className="mt-2 px-3 py-1 text-xs bg-cyan-900/50 text-cyan-300 rounded border border-cyan-600 hover:bg-cyan-800 transition"
              >
                RETRY
              </button>
            </div>
          )}
          <img
            key={showNational ? 'national' : nearestRadar.id}
            src={showNational ? "https://radar.weather.gov/ridge/standard/CONUS-LARGE_loop.gif" : localRadarUrl}
            alt={showNational ? "National CONUS Radar" : `NEXRAD Radar ${nearestRadar.id}`}
            className={`max-w-full max-h-full ${imgLoading || imgError ? 'opacity-0' : 'opacity-100'} transition-opacity`}
            style={showNational ? {} : { imageRendering: 'pixelated' }}
            onLoad={() => { setImgLoading(false); setImgError(false); }}
            onError={() => { setImgLoading(false); setImgError(true); }}
          />
        </div>

        <p className="text-xs text-cyan-400">
          Source: NOAA/NWS RIDGE Radar
        </p>
      </div>
    </TabPanel>
  );
};

export default RadarTab;
