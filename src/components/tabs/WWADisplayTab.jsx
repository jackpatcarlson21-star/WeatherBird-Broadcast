import React, { useState } from 'react';
import { Map as MapIcon, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import { NWS_WWA_MAP_URL, PLACEHOLDER_IMG } from '../../utils/constants';

const WWADisplayTab = ({ embedded = false }) => {
  const [keyOpen, setKeyOpen] = useState(false);

  const content = (
  <div>
    <div className="text-center space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-2xl text-cyan-300">NWS NATIONAL HAZARDS</h3>
        <a
          href="https://www.weather.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1 bg-cyan-900/50 text-cyan-300 rounded border border-cyan-500 hover:bg-cyan-800 hover:text-white transition font-vt323"
        >
          <MapIcon size={16} /> FULL MAP
        </a>
      </div>

      <div className="relative">
        <img
          src={NWS_WWA_MAP_URL}
          alt="National WWA Map"
          className="w-full h-auto rounded-lg border-4 border-cyan-500 mx-auto max-w-4xl bg-white"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = PLACEHOLDER_IMG;
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        {/* Fallback container, hidden by default */}
        <div className="hidden absolute inset-0 bg-black/80 items-center justify-center flex-col p-6 text-center">
          <AlertTriangle size={48} className="text-red-500 mb-2" />
          <h3 className="text-xl text-red-400 font-bold">IMAGE FEED BLOCKED</h3>
          <p className="text-cyan-300 mb-4">The National Weather Service server is blocking this image from loading in this specific window.</p>
        </div>
      </div>

      {/* Collapsible Hazards Key */}
      <div className="mt-6 bg-black/20 border-2 border-cyan-700 rounded-lg">
        <button
          onClick={() => setKeyOpen(!keyOpen)}
          className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-white/5 transition rounded-lg"
        >
          <h4 className="text-lg sm:text-xl text-white font-bold">HAZARDS KEY</h4>
          {keyOpen
            ? <ChevronUp size={22} className="text-cyan-400 shrink-0" />
            : <ChevronDown size={22} className="text-cyan-400 shrink-0" />
          }
        </button>

        {keyOpen && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            {/* Warnings - Most Severe */}
            <div className="mb-4">
              <h5 className="text-sm text-red-400 font-bold mb-2">WARNINGS (Immediate Action)</h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FF0000] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Tornado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FFA500] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Severe T-Storm</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#DC143C] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Hurricane</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#B22222] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Tropical Storm</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#B524F7] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Storm Surge</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FF8C00] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Extreme Wind</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#8B0000] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Flash Flood</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#00FF00] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Flood</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FF69B4] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Winter Storm</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FF4500] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Ice Storm</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#CD5C5C] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Blizzard</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#C71585] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Snow Squall</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FF1493] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Red Flag</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#7CFC00] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Coastal Flood</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#228B22] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">River Flood</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#8B4513] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">High Wind</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#4169E1] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Lake Effect Snow</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#B0C4DE] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Wind Chill</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#C71585] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Excessive Heat</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#9400D3] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Hard Freeze</span>
                </div>
              </div>
            </div>

            {/* Watches */}
            <div className="mb-4">
              <h5 className="text-sm text-yellow-400 font-bold mb-2">WATCHES (Be Prepared)</h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FFFF00] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Tornado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#DB7093] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Severe T-Storm</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FF00FF] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Hurricane</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#F08080] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Tropical Storm</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#DB7FF7] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Storm Surge</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#2E8B57] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Flash Flood</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#2E8B57] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Flood</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#4682B4] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Winter Storm</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#B8860B] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">High Wind</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FFE4B5] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Fire Weather</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#48D1CC] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Freeze</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#800000] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Excessive Heat</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#5F9EA0] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Wind Chill</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#4169E1] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Hard Freeze</span>
                </div>
              </div>
            </div>

            {/* Advisories */}
            <div className="mb-4">
              <h5 className="text-sm text-cyan-400 font-bold mb-2">ADVISORIES (Be Aware)</h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#D2B48C] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Wind</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#7B68EE] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Winter Weather</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#6495ED] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Lake Wind</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#00CED1] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Frost</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#008080] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Coastal Flood</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#AFEEEE] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Wind Chill</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#F0E68C] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Dense Fog</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#F0E68C] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Dense Smoke</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FF7F50] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Heat</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#808080] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Air Quality</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#BDB76B] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Dust</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#BDB76B] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Blowing Dust</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#EE82EE] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Freezing Rain</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#EE82EE] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Freezing Spray</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#C71585] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Extreme Cold</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#D8BFD8] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Small Craft</span>
                </div>
              </div>
            </div>

            {/* Special */}
            <div>
              <h5 className="text-sm text-purple-400 font-bold mb-2">SPECIAL STATEMENTS & MARINE</h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FFE4C4] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Special Weather</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#C0C0C0] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Marine Weather</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#FF8C00] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Excessive Heat</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#40E0D0] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Rip Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#40E0D0] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Beach Hazards</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#DDA0DD] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Gale Warning</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#D2691E] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Hazardous Seas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#228B22] border border-white shrink-0"></div>
                  <span className="text-xs text-cyan-100 font-vt323">Hydrologic Outlook</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-3 italic text-center">Colors match official NWS hazard map. Visit weather.gov for complete details.</p>
          </div>
        )}
      </div>
    </div>
  </div>
  );
  if (embedded) return content;
  return <TabPanel title="NATIONAL WATCH / WARNING MAP">{content}</TabPanel>;
};

export default WWADisplayTab;
