import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svgPath = join(__dirname, 'public', 'icon.svg');
const svg = readFileSync(svgPath);

// Generate 192x192 icon
sharp(svg)
  .resize(192, 192)
  .png()
  .toFile(join(__dirname, 'public', 'icon-192.png'))
  .then(() => console.log('Created icon-192.png'))
  .catch(err => console.error('Error creating 192:', err));

// Generate 512x512 icon
sharp(svg)
  .resize(512, 512)
  .png()
  .toFile(join(__dirname, 'public', 'icon-512.png'))
  .then(() => console.log('Created icon-512.png'))
  .catch(err => console.error('Error creating 512:', err));
