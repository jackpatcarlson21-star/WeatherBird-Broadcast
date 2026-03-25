import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// --- Satellite frame cache ---
// Fetches latest.jpg every 10 min per sector, keeps last 6 frames in memory
const frameStore = {};   // 'GOES19/CGL' → [Buffer, Buffer, ...]
const activePollers = {};
const MAX_FRAMES = 6;

function getSatUrl(sat, sector) {
  return sector === 'CONUS'
    ? `https://cdn.star.nesdis.noaa.gov/${sat}/ABI/CONUS/GEOCOLOR/latest.jpg`
    : `https://cdn.star.nesdis.noaa.gov/${sat}/ABI/SECTOR/${sector}/GEOCOLOR/latest.jpg`;
}

async function fetchAndStore(sat, sector) {
  try {
    const res = await fetch(getSatUrl(sat, sector));
    if (!res.ok) { console.warn(`[SAT] ${sat}/${sector} returned ${res.status}`); return; }
    const buf = Buffer.from(await res.arrayBuffer());
    const key = `${sat}/${sector}`;
    if (!frameStore[key]) frameStore[key] = [];
    frameStore[key].push(buf);
    if (frameStore[key].length > MAX_FRAMES) frameStore[key].shift();
    console.log(`[SAT] ${key} — ${frameStore[key].length}/${MAX_FRAMES} frames cached`);
  } catch (e) {
    console.error(`[SAT] Fetch error for ${sat}/${sector}:`, e.message);
  }
}

function startPolling(sat, sector) {
  const key = `${sat}/${sector}`;
  if (activePollers[key]) return;
  console.log(`[SAT] Starting poller for ${key}`);
  fetchAndStore(sat, sector); // fetch immediately
  activePollers[key] = setInterval(() => fetchAndStore(sat, sector), 10 * 60 * 1000);
}

// GET /api/satellite/frames?sat=GOES19&sector=CGL
// Returns how many frames are cached. Starts polling if not already.
app.get('/api/satellite/frames', (req, res) => {
  const { sat, sector } = req.query;
  if (!sat || !sector) return res.status(400).json({ error: 'Missing sat or sector' });
  startPolling(sat, sector);
  const key = `${sat}/${sector}`;
  res.json({ count: (frameStore[key] || []).length });
});

// GET /api/satellite/frame?sat=GOES19&sector=CGL&idx=0
// Serves a specific cached frame as JPEG.
app.get('/api/satellite/frame', (req, res) => {
  const { sat, sector, idx } = req.query;
  if (!sat || !sector || idx === undefined) return res.status(400).json({ error: 'Missing params' });
  const key = `${sat}/${sector}`;
  const frames = frameStore[key] || [];
  const frame = frames[parseInt(idx)];
  if (!frame) return res.status(404).json({ error: 'Frame not available yet' });
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'no-cache');
  res.send(frame);
});

// Serve Vite build in production
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

app.listen(PORT, () => console.log(`WeatherBird server running on port ${PORT}`));
