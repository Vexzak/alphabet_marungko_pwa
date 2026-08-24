import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, sep, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.wav', '.ogg'];
const SKIP_FOLDERS = ['__manus__'];

function walk(dir, base = '') {
  let results = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_FOLDERS.includes(entry)) continue;

    const fullPath = join(dir, entry);
    const relPath = join(base, entry).split(sep).join('/');

    if (statSync(fullPath).isDirectory()) {
      results = results.concat(walk(fullPath, relPath));
    } else if (EXTENSIONS.some(ext => entry.toLowerCase().endsWith(ext))) {
      results.push('/' + relPath);
    }
  }
  return results;
}

const allAssets = walk(PUBLIC_DIR);

writeFileSync(
  join(PUBLIC_DIR, 'asset-manifest.json'),
  JSON.stringify(allAssets, null, 2)
);

console.log(`Generated asset-manifest.json with ${allAssets.length} assets`);