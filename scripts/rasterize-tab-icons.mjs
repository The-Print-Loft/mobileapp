/**
 * Rasterize the tab-bar SVG icons (in assets/tab-icons/src) to PNGs at
 * @1x/@2x/@3x, so the native tab bar (NativeTabs) can use them — it can't take
 * SVGs. Re-run after changing a source SVG:
 *
 *   npm i --no-save @resvg/resvg-js && node scripts/rasterize-tab-icons.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'assets/tab-icons/src');
const outDir = join(root, 'assets/tab-icons');
const BASE = 24; // icons are designed on a 24×24 grid
const SCALES = [1, 2, 3];

for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.svg'))) {
  const name = file.replace(/\.svg$/, '');
  const svg = readFileSync(join(srcDir, file), 'utf8');
  for (const scale of SCALES) {
    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: BASE * scale },
    })
      .render()
      .asPng();
    writeFileSync(join(outDir, `${name}${scale === 1 ? '' : `@${scale}x`}.png`), png);
  }
  console.log(`rasterized ${name} → ${BASE}/${BASE * 2}/${BASE * 3}px`);
}
