// Converts raw HURDAT2 best-track files (data/hurdat2/*.txt) into the compact
// JSON the Hurricane tab loads (public/hurdat2-*.json).
//
// Output: { "storms": [[id, name, track], ...] } where track is a flat list of
// [lat*10, lon*10, windKnots, month] for each 6-hourly fix (west/south are
// negative). Only the fields the tab draws are kept, which turns ~11 MB of
// text into well under 1 MB.
//
// Usage: npm run hurdat2

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const parseCoord = (str) => {
  const v = Math.round(parseFloat(str) * 10);
  return /[SW]/.test(str) ? -v : v;
};

const convert = (text) => {
  const storms = [];
  let current = null;
  const finish = () => { if (current && current.track.length >= 8) storms.push(current); };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(',').map(s => s.trim());

    if (/^[A-Z]{2}\d{6}$/.test(parts[0])) {
      finish();
      current = { id: parts[0], name: parts[1] || 'UNNAMED', track: [] };
    } else if (current) {
      if (parts.length < 7) continue;
      const month = parseInt(parts[0].slice(4, 6), 10);
      const lat = parseCoord(parts[4]);
      const lon = parseCoord(parts[5]);
      const wind = parseInt(parts[6], 10);
      if ([month, lat, lon, wind].some(Number.isNaN)) continue;
      current.track.push(lat, lon, wind, month);
    }
  }
  finish(); // 8 numbers = 2 fixes, the minimum the tab will draw
  return storms;
};

let lastYear = 0;
for (const basin of ['atlantic', 'pacific']) {
  const storms = convert(readFileSync(join(root, 'data/hurdat2', `${basin}.txt`), 'utf8'));
  if (!storms.length) throw new Error(`${basin}: no storms parsed — is the source file valid HURDAT2?`);

  const out = JSON.stringify({ storms: storms.map(s => [s.id, s.name, s.track]) });
  writeFileSync(join(root, 'public', `hurdat2-${basin}.json`), out);

  const years = storms.map(s => parseInt(s.id.slice(4, 8), 10));
  lastYear = Math.max(lastYear, ...years);
  console.log(`${basin}: ${storms.length} storms, ${Math.min(...years)}-${Math.max(...years)}, ${(out.length / 1024).toFixed(0)} kB`);
}
console.log(`Set HURDAT2_LAST_YEAR = ${lastYear} in src/components/tabs/HurricaneTab.jsx if it differs.`);
