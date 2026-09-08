/* ═══════════════════════════════════════════
   Génération des icônes de la PWA
   ═══════════════════════════════════════════
   Deux modes :

   1. À partir d'une image source (recommandé)
        node tests/gen-icons.mjs icons/source.png
      L'image est recadrée au carré, posée sur un fond opaque dont la
      couleur est échantillonnée dans l'image elle-même, puis déclinée
      dans toutes les tailles attendues.

   2. Sans argument : dessine une icône de repli en tracés vectoriels,
      sans aucune dépendance aux polices.

   Les noms de fichiers produits sont ceux déjà référencés par
   index.html, manifest.json et sw.js : rien d'autre n'est à modifier.

   Deux contraintes de plateforme guident la sortie :
   · apple-touch-icon doit être un carré plein et opaque. iOS applique
     son propre masque arrondi ; des coins déjà arrondis produiraient
     des liserés clairs.
   · Une icône « maskable » doit tenir dans les 80 % centraux, faute de
     quoi Android rogne les bords avec son masque circulaire.        */

import { createRequire } from 'node:module';
// createRequire suit la résolution CommonJS : fonctionne avec un playwright
// installé localement comme avec une installation globale via NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const OUT = new URL('../icons/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const SOURCE = process.argv[2] ? resolve(process.argv[2]) : null;
if (SOURCE && !existsSync(SOURCE)) {
  console.error(`Image source introuvable : ${SOURCE}`);
  process.exit(1);
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const dataUri = p => `data:${MIME[extname(p).toLowerCase()] || 'image/png'};base64,${readFileSync(p).toString('base64')}`;

/* ── Repli vectoriel ───────────────────────── */
const TEAL = '#3DBFBA', TEAL_LIGHT = '#5FD4CF', INK = '#131D35';
const SEVEN = 'M20 9 H84 A5 5 0 0 1 88.6 16 L57 92 A5 5 0 0 1 52.4 95 H32 A5 5 0 0 1 27.4 88 L55.5 27 H20 A5 5 0 0 1 20 9 Z';
const FLIP = `<g fill="currentColor">
  <path d="M2 2 h17 v5.4 h-11 v4.2 h9.4 v5.4 h-9.4 v7 h-6 z"/>
  <path d="M23 2 h6 v16.6 h10.4 v5.4 h-16.4 z"/>
  <path d="M43 2 h6 v22 h-6 z"/>
  <path d="M53 2 h11.6 a7.6 7.6 0 0 1 0 15.2 h-5.6 v6.8 h-6 z m6 5.2 v4.8 h5 a2.4 2.4 0 0 0 0-4.8 z"/>
</g>`;

function vectorPage({ size, maskable }) {
  const scale = maskable ? 0.66 : 0.84;
  const frame = maskable ? '' : `
    <rect x="${size * 0.055}" y="${size * 0.055}" width="${size * 0.89}" height="${size * 0.89}"
          rx="${size * 0.175}" fill="none" stroke="rgba(255,255,255,.20)" stroke-width="${size * 0.012}"/>`;
  const inner = size * scale, offX = (size - inner) / 2;
  const flipW = inner * 0.62, flipH = flipW * 0.26, gap = inner * 0.045;
  const sevenH = inner - flipH - gap, sevenW = sevenH * 0.9;
  return `<!doctype html><meta charset="utf-8">
  <style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}svg{display:block}</style>
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${TEAL_LIGHT}"/><stop offset="1" stop-color="${TEAL}"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>${frame}
    <svg x="${(size - flipW) / 2}" y="${offX}" width="${flipW}" height="${flipH}" viewBox="0 0 70 26" style="color:rgba(19,29,53,.55)">${FLIP}</svg>
    <svg x="${(size - sevenW) / 2}" y="${offX + flipH + gap}" width="${sevenW}" height="${sevenH}" viewBox="0 0 100 100">
      <path d="${SEVEN}" fill="${INK}" transform="translate(${size * 0.006},${size * 0.008})" opacity=".22"/>
      <path d="${SEVEN}" fill="#fff"/>
    </svg>
  </svg>`;
}

/* ── Rendu depuis une image source ─────────── */
function sourcePage({ size, maskable, uri }) {
  // Zone sûre d'une icône maskable. Le masque le plus agressif est un
  // cercle inscrit dans le canevas (rayon = 50 %). Pour qu'un visuel CARRÉ
  // y survive en entier, son demi-diagonale doit rester sous ce rayon :
  //   côté × √2 / 2 ≤ 0,5  →  côté ≤ 70,7 %
  // D'où 70 %, qui garantit que le cadre Art Déco n'est jamais rogné,
  // quel que soit le lanceur Android.
  const scale = maskable ? 0.70 : 1;
  return `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden;background:#fff}canvas{display:block}</style>
<canvas id="c" width="${size}" height="${size}"></canvas>
<script>
window.__done = (async () => {
  const img = new Image();
  img.src = ${JSON.stringify(uri)};
  await img.decode();

  // Recadrage centré au carré, pour ne jamais déformer l'illustration.
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2, sy = (img.height - side) / 2;

  // Couleur de fond échantillonnée dans l'image : on lit un anneau situé
  // juste à l'intérieur du bord, là où se trouve l'aplat de l'icône, en
  // ignorant les pixels transparents ou quasi blancs des coins arrondis.
  const s = document.createElement('canvas');
  s.width = s.height = side;
  const sc = s.getContext('2d', { willReadFrequently: true });
  sc.drawImage(img, sx, sy, side, side, 0, 0, side, side);
  const px = sc.getImageData(0, 0, side, side).data;
  const at = (x, y) => { const i = ((y * side) + x) * 4; return [px[i], px[i+1], px[i+2], px[i+3]]; };
  const inset = Math.round(side * 0.12);
  const probes = [];
  for (let t = 0; t <= 1.0001; t += 1 / 24) {
    const p = Math.round(inset + t * (side - 2 * inset));
    probes.push(at(p, inset), at(p, side - inset), at(inset, p), at(side - inset, p));
  }
  const solid = probes.filter(c => c[3] > 250 && !(c[0] > 240 && c[1] > 240 && c[2] > 240));
  const pool = solid.length ? solid : probes.filter(c => c[3] > 250);
  let bg = '#3DBFBA';
  if (pool.length) {
    // Médiane par canal : insensible aux motifs et aux liserés.
    const med = k => { const v = pool.map(c => c[k]).sort((a, b) => a - b); return v[v.length >> 1]; };
    bg = 'rgb(' + med(0) + ',' + med(1) + ',' + med(2) + ')';
  }

  // Les icônes d'application ont des coins arrondis, donc des pixels
  // transparents ou blancs à l'extérieur. Peindre un fond puis dessiner
  // l'image par-dessus ne suffit pas : l'image recouvre ce fond. On
  // remplit donc depuis les quatre coins vers l'intérieur, en s'arrêtant
  // dès que l'illustration commence. Sans ça, iOS ré-arrondit une icône
  // déjà arrondie et laisse un liseré clair sur chaque coin.
  const m = bg.match(/\\d+/g).map(Number);
  const dat = sc.getImageData(0, 0, side, side);
  const q = dat.data;
  const dehors = i => q[i+3] < 250 || (q[i] > 238 && q[i+1] > 238 && q[i+2] > 238);
  const vus = new Uint8Array(side * side);
  const pile = [0, side - 1, side * (side - 1), side * side - 1];
  while (pile.length) {
    const n = pile.pop();
    if (vus[n]) continue;
    const i = n * 4;
    if (!dehors(i)) continue;
    vus[n] = 1;
    q[i] = m[0]; q[i+1] = m[1]; q[i+2] = m[2]; q[i+3] = 255;
    const x = n % side, y = (n / side) | 0;
    if (x > 0) pile.push(n - 1);
    if (x < side - 1) pile.push(n + 1);
    if (y > 0) pile.push(n - side);
    if (y < side - 1) pile.push(n + side);
  }
  sc.putImageData(dat, 0, 0);

  const ctx = document.getElementById('c').getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ${size}, ${size});
  ctx.imageSmoothingQuality = 'high';
  const d = ${size} * ${scale}, o = (${size} - d) / 2;
  ctx.drawImage(s, 0, 0, side, side, o, o, d, d);
  return bg;
})();
</script>`;
}

const TARGETS = [
  { file: 'icon-180.png', size: 180, maskable: false },  // apple-touch-icon
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'favicon-32.png', size: 32, maskable: false },
];

const uri = SOURCE ? dataUri(SOURCE) : null;
console.log(SOURCE ? `Source : ${SOURCE}` : 'Aucune source fournie — repli sur le dessin vectoriel.');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let bg = null;
for (const t of TARGETS) {
  const ctx = await browser.newContext({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(SOURCE ? sourcePage({ ...t, uri }) : vectorPage(t), { waitUntil: 'load' });
  if (SOURCE) bg = await page.evaluate(() => window.__done);
  const buf = await page.screenshot({ omitBackground: false });
  writeFileSync(`${OUT}${t.file}`, buf);
  console.log(`✓ ${t.file.padEnd(24)} ${t.size}×${t.size}  ${(buf.length / 1024).toFixed(1)} ko`);
  await ctx.close();
}
await browser.close();
if (bg) console.log(`\nFond échantillonné : ${bg}`);
console.log('\nPense à aligner theme_color / background_color (manifest.json) et');
console.log('la balise <meta name="theme-color"> sur cette couleur.');
