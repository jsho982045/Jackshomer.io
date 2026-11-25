// Downloads CC0 photo-scanned textures from Poly Haven (https://polyhaven.com, no attribution
// required) and converts them to compact WebP files in public/textures/.
// Run once:  npm run textures
import sharp from 'sharp';
import { mkdir, writeFile, access } from 'node:fs/promises';

const OUT = new URL('../public/textures/', import.meta.url);
// id -> which maps we need. Everything is fetched at 1K, which is plenty for the web.
const SETS = {
  rough_wood: ['diff', 'nor', 'rough'],          // cabin logs + beams
  wood_floor_worn: ['diff', 'nor', 'rough'],     // cabin floor
  wood_table_worn: ['diff', 'nor', 'rough'],     // cabin table
  rustic_stone_wall: ['diff', 'nor', 'rough'],   // cabin fireplace
  rough_linen: ['diff', 'nor'],                  // linen banner
  american_walnut_veneer: ['diff'],              // desk surface
};
const KEY = { diff: 'Diffuse', nor: 'nor_gl', rough: 'Rough' };
const QUALITY = { diff: 80, nor: 90, rough: 70 };

await mkdir(OUT, { recursive: true });
for (const [id, maps] of Object.entries(SETS)) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  for (const m of maps) {
    const dest = new URL(`${id}_${m}.webp`, OUT);
    try { await access(dest); console.log('✓ exists', id, m); continue; } catch {}
    const url = files[KEY[m]]?.['1k']?.jpg?.url;
    if (!url) { console.warn('! no 1k jpg for', id, m); continue; }
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    let img = sharp(buf);
    if (m === 'rough') img = img.greyscale();
    await writeFile(dest, await img.webp({ quality: QUALITY[m], effort: 6 }).toBuffer());
    console.log('↓', id, m);
  }
}
console.log('Done. Textures are in public/textures/');
