import React, { useState, useEffect, useRef } from 'react';
import { MapPin, X, AlertTriangle, Star } from 'lucide-react';
import { DARK_BLUE, NAVY_BLUE, BRIGHT_CYAN, MID_BLUE } from '../../utils/constants';

const LocationModal = ({ location, onSave, onClose, savedLocations = [], onSaveLocation, onDeleteLocation, trackingEnabled, onTrackingToggle }) => {
  const [temp, setTemp] = useState({ ...location, error: null });
  const [showSaved, setShowSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const debounceRef = useRef(null);

  // Auto-search as user types (with debounce)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery.trim())}&count=5&language=en&format=json`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (e) {
        console.error("Autocomplete error:", e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  const handleSave = () => {
    const lat = parseFloat(temp.lat);
    const lon = parseFloat(temp.lon);

    if (!temp.name.trim()) {
      setTemp(t => ({ ...t, error: "City name cannot be empty." }));
      return;
    }
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setTemp(t => ({ ...t, error: "Invalid coordinates! Lat: -90 to 90, Lon: -180 to 180." }));
      return;
    }

    setTemp(t => ({ ...t, error: null }));
    onSave({ name: temp.name.trim(), lat, lon });
  };

  const handleInputChange = (e, key) => {
    setTemp(t => ({ ...t, [key]: e.target.value, error: null }));
  };

  const selectResult = (result) => {
    const displayName = result.admin1
      ? `${result.name}, ${result.admin1}`
      : result.name;
    setTemp({
      name: displayName,
      lat: result.latitude,
      lon: result.longitude,
      error: null
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleAutoDetect = () => {
    if (!navigator.geolocation) {
      setTemp(t => ({ ...t, error: "Geolocation is not supported by your browser." }));
      return;
    }

    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
          setTemp(t => ({ ...t, error: "Location access denied. Please use the search instead." }));
          return;
        }
      }).catch(() => {});
    }

    setIsLocating(true);
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
            const nominatimData = await nominatimRes.json();
            const cityName = nominatimData.address?.city || nominatimData.address?.town || nominatimData.address?.village || nominatimData.address?.county || 'My Location';
            const stateName = nominatimData.address?.state || '';
            const displayName = stateName ? `${cityName}, ${stateName}` : cityName;
            setTemp({
              name: displayName,
              lat: latitude.toFixed(4),
              lon: longitude.toFixed(4),
              error: null
            });
          } catch (e) {
            setTemp({
              name: 'My Location',
              lat: latitude.toFixed(4),
              lon: longitude.toFixed(4),
              error: null
            });
          }
          setIsLocating(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          let errorMsg = "Unable to get your location. Please use the search instead.";
          if (error.code === 1) {
            errorMsg = "Location access denied. Please search for your city instead.";
          } else if (error.code === 2) {
            errorMsg = "Location unavailable. Please search for your city instead.";
          } else if (error.code === 3) {
            errorMsg = "Location request timed out. Please search for your city instead.";
          }
          setTemp(t => ({ ...t, error: errorMsg }));
          setIsLocating(false);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    } catch (e) {
      console.error("Geolocation blocked:", e);
      setTemp(t => ({ ...t, error: "GPS is blocked on this site. Please search for your city instead." }));
      setIsLocating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 font-vt323">
      <div className="rounded-xl p-6 sm:p-8 w-full max-w-md shadow-neon-lg" style={{ backgroundColor: NAVY_BLUE, border: `4px solid ${BRIGHT_CYAN}` }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl text-white font-bold">SET LOCATION</h2>
          <button onClick={onClose} className="text-cyan-400 p-1 hover:text-wb-cyan transition">
            <X size={32} />
          </button>
        </div>

        {/* Auto-detect button */}
        <button
          onClick={handleAutoDetect}
          disabled={isLocating}
          className="w-full p-3 mb-4 text-lg font-bold rounded flex items-center justify-center gap-2 transition-all hover:bg-cyan-900 disabled:opacity-50"
          style={{ backgroundColor: MID_BLUE, border: `2px solid ${BRIGHT_CYAN}`, color: BRIGHT_CYAN }}
        >
          <MapPin size={20} />
          {isLocating ? 'DETECTING...' : 'USE MY CURRENT LOCATION'}
        </button>

        {/* Auto-Track Toggle */}
        {onTrackingToggle && (
          <button
            onClick={() => onTrackingToggle(!trackingEnabled)}
            className="w-full p-3 mb-4 text-lg font-bold rounded flex items-center justify-between transition-all"
            style={{
              backgroundColor: trackingEnabled ? 'rgba(34, 197, 94, 0.15)' : `${MID_BLUE}`,
              border: `2px solid ${trackingEnabled ? 'rgba(34, 197, 94, 0.6)' : 'rgba(100, 116, 139, 0.5)'}`,
              color: trackingEnabled ? '#86efac' : '#94a3b8',
            }}
          >
            <span className="flex items-center gap-2">
              <MapPin size={20} />
              AUTO-TRACK LOCATION
            </span>
            <span
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{ backgroundColor: trackingEnabled ? '#22c55e' : '#475569' }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                style={{ transform: trackingEnabled ? 'translateX(24px)' : 'translateX(4px)' }}
              />
            </span>
          </button>
        )}

        {/* City search */}
        <div className="mb-4 relative">
          <div className="relative">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Start typing a city name..."
              className="w-full p-3 text-white text-xl rounded outline-none"
              style={{ backgroundColor: DARK_BLUE, border: `2px solid ${BRIGHT_CYAN}` }}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* Autocomplete dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 rounded border-2 overflow-hidden shadow-lg max-h-60 overflow-y-auto" style={{ borderColor: BRIGHT_CYAN, backgroundColor: DARK_BLUE }}>
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => selectResult(result)}
                  className="w-full p-3 text-left text-white hover:bg-cyan-900 transition border-b border-cyan-800 last:border-b-0 flex items-center gap-2"
                >
                  <MapPin size={16} className="text-cyan-400 shrink-0" />
                  <div>
                    <span className="font-bold">{result.name}</span>
                    {result.admin1 && <span className="text-cyan-400">, {result.admin1}</span>}
                    {result.country && <span className="text-cyan-500 text-sm ml-2">({result.country})</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-cyan-700 pt-4 mt-2">
          <p className="text-sm text-cyan-400 mb-3">Or enter coordinates manually:</p>
          <div className="space-y-3">
            <input
              value={temp.name}
              onChange={e => handleInputChange(e, 'name')}
              placeholder="City Name"
              className="w-full p-3 text-white text-xl rounded outline-none"
              style={{ backgroundColor: DARK_BLUE, border: `2px solid ${BRIGHT_CYAN}` }}
            />
            <div className="flex gap-3">
              <input
                type="number" step="0.0001"
                value={temp.lat}
                onChange={e => handleInputChange(e, 'lat')}
                placeholder="Latitude"
                className="w-1/2 p-3 text-white text-xl rounded outline-none"
                style={{ backgroundColor: DARK_BLUE, border: `2px solid ${BRIGHT_CYAN}` }}
              />
              <input
                type="number" step="0.0001"
                value={temp.lon}
                onChange={e => handleInputChange(e, 'lon')}
                placeholder="Longitude"
                className="w-1/2 p-3 text-white text-xl rounded outline-none"
                style={{ backgroundColor: DARK_BLUE, border: `2px solid ${BRIGHT_CYAN}` }}
              />
            </div>
          </div>
        </div>

        {temp.error && (
          <div className="bg-red-900/50 border border-red-400 p-2 rounded flex items-center gap-2 mt-4">
            <AlertTriangle size={20} className="text-red-400" />
            <p className="text-red-300 text-sm">{temp.error}</p>
          </div>
        )}

        {/* Saved Locations Section */}
        <div className="border-t border-cyan-700 pt-4 mt-4">
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="w-full flex items-center justify-between text-cyan-400 hover:text-cyan-300 transition"
          >
            <span className="flex items-center gap-2">
              <Star size={18} />
              <span className="text-lg">SAVED LOCATIONS ({savedLocations.length})</span>
            </span>
            <span className="text-xl">{showSaved ? '-' : '+'}</span>
          </button>

          {showSaved && (
            <div className="mt-3 space-y-2">
              {savedLocations.length === 0 ? (
                <p className="text-cyan-600 text-sm text-center py-2">No saved locations yet</p>
              ) : (
                savedLocations.map((saved) => (
                  <div
                    key={saved.id}
                    className="flex items-center gap-2 p-2 rounded border border-cyan-800 hover:border-cyan-600 transition"
                    style={{ backgroundColor: DARK_BLUE }}
                  >
                    <button
                      onClick={() => {
                        setTemp({ name: saved.name, lat: saved.lat, lon: saved.lon, error: null });
                        setShowSaved(false);
                      }}
                      className="flex-grow text-left text-white hover:text-cyan-400 transition flex items-center gap-2"
                    >
                      <MapPin size={16} className="text-cyan-400 shrink-0" />
                      <span className="truncate">{saved.name}</span>
                    </button>
                    <button
                      onClick={() => onDeleteLocation(saved.id)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition"
                      title="Delete location"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))
              )}

              {/* Save current location button */}
              {temp.name && temp.lat && temp.lon && (
                <button
                  onClick={() => {
                    onSaveLocation({ name: temp.name, lat: parseFloat(temp.lat), lon: parseFloat(temp.lon) });
                  }}
                  className="w-full mt-2 p-2 text-sm rounded border border-yellow-600 text-yellow-400 hover:bg-yellow-900/30 transition flex items-center justify-center gap-2"
                >
                  <Star size={16} />
                  SAVE "{temp.name}" TO FAVORITES
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          className="mt-6 w-full p-4 text-black text-2xl font-bold rounded shadow-neon-md hover:bg-cyan-300 transition-all active:translate-y-0.5"
          style={{ backgroundColor: BRIGHT_CYAN }}
        >
          SAVE & REBOOT
        </button>
      </div>
    </div>
  );
};

export default LocationModal;
