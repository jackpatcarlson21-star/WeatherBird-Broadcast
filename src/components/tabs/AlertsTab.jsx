import React, { useState, useEffect } from 'react';
import { Radio, MapPin, X, Clock, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';
import { getExpirationCountdown } from '../../utils/helpers';

const AlertsTab = ({ alerts, location }) => {
  const [showRadioModal, setShowRadioModal] = useState(false);
  const [speakingAlertId, setSpeakingAlertId] = useState(null);

  // Text-to-speech handler with toggle support
  const handleSpeak = (alert) => {
    if (!('speechSynthesis' in window)) return;

    const alertId = alert.properties?.id;

    // If already speaking this alert, stop it
    if (speakingAlertId === alertId) {
      window.speechSynthesis.cancel();
      setSpeakingAlertId(null);
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Build the text to speak (remove symbols that get read aloud, convert ... to pause)
    const rawText = `${alert.properties.event}. ${alert.properties.headline}. ${alert.properties.description}. ${alert.properties.instruction || ''}`;
    const text = rawText.replace(/\*/g, '').replace(/\.{3,}/g, ', , ').replace(/\.{2}/g, '.');

    const utterance = new SpeechSynthesisUtterance(text);

    // Try to find a natural-sounding voice (prioritize neural/natural voices)
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
      v.name.includes('Natural') ||
      v.name.includes('Neural')
    ) || voices.find(v =>
      v.name.includes('Google UK English Female') ||
      v.name.includes('Google US English')
    ) || voices.find(v =>
      v.name.includes('Samantha') ||
      v.name.includes('Karen') ||
      v.name.includes('Moira')
    ) || voices.find(v =>
      v.name.includes('Microsoft') && v.name.includes('Online')
    ) || voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => setSpeakingAlertId(null);
    utterance.onerror = () => setSpeakingAlertId(null);

    setSpeakingAlertId(alertId);
    window.speechSynthesis.speak(utterance);
  };

  // Tick counter to force re-render every 60s for live countdowns
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Alerts are now passed down from App to avoid double fetching
  if (!alerts) return <TabPanel title="ACTIVE ALERTS"><LoadingIndicator /></TabPanel>;

  return (
    <TabPanel title="ACTIVE ALERTS">
      {/* NOAA Radio Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowRadioModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-900/50 text-red-300 rounded border border-red-500 hover:bg-red-800 hover:text-white transition font-vt323 text-lg"
        >
          <Radio size={20} /> NOAA WEATHER RADIO
        </button>
      </div>

      {/* NOAA Radio Modal */}
      {showRadioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gradient-to-b from-gray-900 to-black border-2 border-red-500 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-red-400 flex items-center gap-2">
                <Radio size={24} /> NOAA WEATHER RADIO
              </h2>
              <button
                onClick={() => setShowRadioModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-cyan-300 mb-4 text-sm">
              Listen to live NOAA Weather Radio for emergency alerts and forecasts near <span className="text-white font-bold">{location?.name || 'your area'}</span>.
            </p>

            <div className="space-y-3">
              <a
                href="https://noaaweatherradio.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-red-700/50 text-white rounded border border-red-400 hover:bg-red-600 hover:text-white transition font-vt323 text-xl"
              >
                <Radio size={20} /> LISTEN LIVE - 131+ STATIONS
              </a>

              <a
                href={`https://www.weather.gov/nwr/stations?state=${location?.name?.split(', ').pop() || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-900/50 text-blue-300 rounded border border-blue-500 hover:bg-blue-800 hover:text-white transition font-vt323 text-lg"
              >
                <MapPin size={18} /> NWS STATION INFO & FREQUENCIES
              </a>
            </div>

            <p className="text-gray-500 text-xs mt-4 text-center">
              NOAA Weather Radio broadcasts 24/7 weather information directly from National Weather Service offices.
            </p>
            <p className="text-yellow-600 text-xs mt-2 text-center">
              Warning: Online streams should not be relied upon for life safety - use a dedicated weather radio receiver.
            </p>
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <ShieldAlert size={64} className="text-green-500 mb-4" />
          <h3 className="text-2xl text-green-400 font-bold">NO ACTIVE ALERTS</h3>
          <p className="text-cyan-300">There are currently no active watches, warnings, or advisories for this location.</p>
        </div>
      )}
      <div className="space-y-4">
        {alerts.map((alert, idx) => (
          <div key={idx} className={`p-4 border-l-8 bg-black/30 rounded ${
            alert.properties.severity === 'Severe' ? 'border-red-500 bg-red-900/20' :
            alert.properties.severity === 'Moderate' ? 'border-orange-500 bg-orange-900/20' :
            'border-yellow-500 bg-yellow-900/20'
          }`}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold text-white">{alert.properties.headline}</h3>
              <div className="flex items-center gap-2">
                {/* Text-to-Speech Button */}
                <button
                  onClick={() => handleSpeak(alert)}
                  className={`p-1.5 rounded transition-colors ${
                    speakingAlertId === alert.properties?.id
                      ? 'bg-cyan-500 animate-pulse'
                      : 'bg-cyan-900/50 hover:bg-cyan-700'
                  }`}
                  title={speakingAlertId === alert.properties?.id ? "Stop reading" : "Read alert aloud"}
                >
                  {speakingAlertId === alert.properties?.id ? (
                    <VolumeX size={16} className="text-white" />
                  ) : (
                    <Volume2 size={16} className="text-cyan-300" />
                  )}
                </button>
                <span className="text-xs bg-black/50 px-2 py-1 rounded text-cyan-300">{alert.properties.severity.toUpperCase()}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-300 mb-2 font-vt323">
              <span>Effective: {new Date(alert.properties.effective).toLocaleString()}</span>
              {alert.properties.expires && (
                <span className="text-yellow-400">
                  <Clock size={14} className="inline mr-1" />
                  {getExpirationCountdown(alert.properties.expires)}
                </span>
              )}
            </div>
            <p className="text-sm text-cyan-100 font-vt323 whitespace-pre-wrap">{alert.properties.description}</p>
            {alert.properties.instruction && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <p className="text-xs text-yellow-300 font-bold">INSTRUCTION:</p>
                <p className="text-xs text-yellow-100 italic">{alert.properties.instruction}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </TabPanel>
  );
};

export default AlertsTab;
