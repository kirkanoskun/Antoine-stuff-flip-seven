import { createRequire } from 'node:module';
// createRequire suit la résolution CommonJS : fonctionne avec un playwright
// installé localement comme avec une installation globale via NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = '/home/user/Antoine-stuff-flip-seven/icons';
mkdirSync(OUT, { recursive: true });

const TEAL = '#3DBFBA';
const TEAL_LIGHT = '#5FD4CF';
const INK = '#131D35';
const YELLOW = '#F7C62E';
const ORANGE = '#FF7B3D';

/* Le "7" en tracé pur — aucune dépendance aux polices.
   Repère 0..100. Barre supérieure + jambage diagonal, angles adoucis. */
const SEVEN = 'M20 9 H84 A5 5 0 0 1 88.6 16 L57 92 A5 5 0 0 1 52.4 95 H32 A5 5 0 0 1 27.4 88 L55.5 27 H20 A5 5 0 0 1 20 9 Z';

/* "FLIP" en tracés géométriques, repère 0..100 large / 0..26 haut. */
const FLIP = `
<g fill="currentColor">
  <!-- F -->
  <path d="M2 2 h17 v5.4 h-11 v4.2 h9.4 v5.4 h-9.4 v7 h-6 z"/>
  <!-- L -->
  <path d="M23 2 h6 v16.6 h10.4 v5.4 h-16.4 z"/>
  <!-- I -->
  <path d="M43 2 h6 v22 h-6 z"/>
  <!-- P -->
  <path d="M53 2 h11.6 a7.6 7.6 0 0 1 0 15.2 h-5.6 v6.8 h-6 z m6 5.2 v4.8 h5 a2.4 2.4 0 0 0 0-4.8 z"/>
</g>`;

function page({ size, maskable }) {
  // Zone de sécurité maskable : le contenu doit tenir dans les 80% centraux.
  const scale = maskable ? 0.66 : 0.84;
  // Plein-bord carré partout : iOS et Android appliquent leur propre masque.
  // Des coins arrondis pré-cuits produiraient des liserés au masquage.
  const radius = 0;
  const frame = maskable ? '' : `
    <rect x="${size * 0.055}" y="${size * 0.055}" width="${size * 0.89}" height="${size * 0.89}"
          rx="${size * 0.175}" fill="none" stroke="rgba(255,255,255,.20)" stroke-width="${size * 0.012}"/>
    <rect x="${size * 0.088}" y="${size * 0.088}" width="${size * 0.824}" height="${size * 0.824}"
          rx="${size * 0.15}" fill="none" stroke="rgba(255,255,255,.11)" stroke-width="${size * 0.006}"/>`;

  const inner = size * scale;
  const offX = (size - inner) / 2;
  // Bloc = FLIP (hauteur 26 sur 100 de large) + 7 (hauteur 100 sur ~90 de large)
  const flipW = inner * 0.62;
  const flipH = flipW * 0.26;
  const gap = inner * 0.045;
  const sevenH = inner - flipH - gap;
  const sevenW = sevenH * 0.9;
  const blockTop = offX;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}
    svg{display:block}
  </style></head><body>
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${TEAL_LIGHT}"/>
        <stop offset="1" stop-color="${TEAL}"/>
      </linearGradient>
      <linearGradient id="seven" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#FFFFFF"/>
        <stop offset="1" stop-color="#EAFBFA"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
    ${frame}
    <!-- FLIP -->
    <svg x="${(size - flipW) / 2}" y="${blockTop}" width="${flipW}" height="${flipH}" viewBox="0 0 70 26" style="color:rgba(19,29,53,.55)">
      ${FLIP}
    </svg>
    <!-- 7 -->
    <svg x="${(size - sevenW) / 2}" y="${blockTop + flipH + gap}" width="${sevenW}" height="${sevenH}" viewBox="0 0 100 100">
      <path d="${SEVEN}" fill="${INK}" transform="translate(${size * 0.006},${size * 0.008})" opacity=".22"/>
      <path d="${SEVEN}" fill="url(#seven)"/>
    </svg>
  </svg></body></html>`;
}

const TARGETS = [
  { file: 'icon-180.png', size: 180, maskable: false },
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'favicon-32.png', size: 32, maskable: false },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const t of TARGETS) {
  const ctx = await browser.newContext({
    viewport: { width: t.size, height: t.size },
    deviceScaleFactor: 1,
  });
  const p = await ctx.newPage();
  await p.setContent(page(t), { waitUntil: 'load' });
  const buf = await p.screenshot({ omitBackground: false });
  writeFileSync(`${OUT}/${t.file}`, buf);
  console.log(`✓ ${t.file} (${t.size}x${t.size}) ${buf.length} bytes`);
  await ctx.close();
}
await browser.close();
console.log('done');
