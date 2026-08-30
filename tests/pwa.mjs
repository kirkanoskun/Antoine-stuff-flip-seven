/* Vérifie l'installabilité et le fonctionnement hors ligne. */
import { createRequire } from 'node:module';
// createRequire suit la résolution CommonJS : fonctionne avec un playwright
// installé localement comme avec une installation globale via NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8899';

let pass = 0, fail = 0; const bad = [];
const check = (n, a, e) => {
  const ok = JSON.stringify(a) === JSON.stringify(e);
  ok ? pass++ : (fail++, bad.push({ n, a, e }));
  console.log(`${ok ? '✓' : '✗'} ${n}${ok ? '' : `  → attendu ${JSON.stringify(e)}, obtenu ${JSON.stringify(a)}`}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

const bad404 = [];
page.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === BASE) bad404.push(`${r.status()} ${r.url()}`); });

await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });

/* ── Manifest ── */
const mf = await page.evaluate(async () => {
  const l = document.querySelector('link[rel=manifest]');
  if (!l) return null;
  const r = await fetch(l.href);
  return r.ok ? await r.json() : null;
});
check('manifest chargé et valide', !!mf, true);
check('manifest · name', !!mf.name, true);
check('manifest · short_name court', mf.short_name.length <= 12, true);
check('manifest · start_url sans espaces', /\s|%20/.test(mf.start_url), false);
check('manifest · display standalone', mf.display, 'standalone');
check('manifest · scope défini', !!mf.scope, true);
check('manifest · icônes PNG uniquement', mf.icons.every(i => i.type === 'image/png'), true);
check('manifest · a une icône 512 "any"', mf.icons.some(i => i.sizes === '512x512' && i.purpose.includes('any')), true);
check('manifest · a une icône maskable', mf.icons.some(i => i.purpose.includes('maskable')), true);

/* Les tailles déclarées correspondent-elles aux vraies dimensions ? */
const sizeOk = await page.evaluate(async (icons) => {
  const out = [];
  for (const i of icons) {
    const dim = await new Promise(res => {
      const im = new Image();
      im.onload = () => res(`${im.naturalWidth}x${im.naturalHeight}`);
      im.onerror = () => res('ERREUR');
      im.src = new URL(i.src, location.href).href;
    });
    out.push({ src: i.src, declared: i.sizes, real: dim, ok: dim === i.sizes });
  }
  return out;
}, mf.icons);
sizeOk.forEach(s => check(`icône ${s.src.split('/').pop()} : ${s.declared} réel`, s.real, s.declared));

/* ── apple-touch-icon ── */
const ati = await page.getAttribute('link[rel="apple-touch-icon"]', 'href');
check('apple-touch-icon en PNG (iOS ignore le SVG)', /\.png$/.test(ati), true);
const atiDim = await page.evaluate(h => new Promise(res => {
  const i = new Image(); i.onload = () => res(`${i.naturalWidth}x${i.naturalHeight}`); i.onerror = () => res('ERREUR'); i.src = h;
}), ati);
check('apple-touch-icon 180x180', atiDim, '180x180');

/* ── Viewport & zones sûres ── */
const vp = await page.getAttribute('meta[name=viewport]', 'content');
check('viewport-fit=cover', vp.includes('viewport-fit=cover'), true);
check('pas de user-scalable=no (accessibilité)', /user-scalable\s*=\s*no/.test(vp), false);
check('pas de maximum-scale', /maximum-scale/.test(vp), false);

/* On lit la source brute : le CSSOM de Chromium écarte les propriétés
   préfixées qu'il connaît déjà sous leur forme standard. */
const css = await (await fetch(`${BASE}/index.html`)).text();
check('CSS utilise env(safe-area-inset-*)', css.includes('safe-area-inset'), true);
check('CSS utilise 100dvh', css.includes('100dvh'), true);
check('CSS overscroll-behavior', css.includes('overscroll-behavior'), true);
check('CSS -webkit-backdrop-filter', css.includes('-webkit-backdrop-filter'), true);
check('CSS prefers-reduced-motion', css.includes('prefers-reduced-motion'), true);

/* Le corps de page ne déborde pas horizontalement */
for (const w of [320, 360, 390, 430, 768, 1024]) {
  await page.setViewportSize({ width: w, height: 800 });
  const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(`pas de débordement horizontal à ${w}px`, over, false);
}
await page.setViewportSize({ width: 390, height: 844 });

/* ── Service worker ── */
const swState = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'non supporté';
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return 'échec';
  return reg.active ? 'actif' : 'inactif';
});
check('service worker actif', swState, 'actif');

const cached = await page.evaluate(async () => {
  const keys = await caches.keys();
  const out = {};
  for (const k of keys) out[k] = (await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname);
  return out;
});
const appCache = Object.entries(cached).find(([k]) => k.startsWith('flip7-app'));
check('cache applicatif créé', !!appCache, true);
check('index.html précaché', appCache[1].some(p => p.endsWith('/index.html')), true);
check('icônes précachées', appCache[1].filter(p => p.includes('/icons/')).length >= 4, true);

/* ── Hors ligne ── */
await ctx.setOffline(true);
const offlineOk = await page.evaluate(async () => {
  try { const r = await fetch('./index.html'); return r.ok; } catch (e) { return false; }
});
check('index.html servi depuis le cache hors ligne', offlineOk, true);

await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
const worksOffline = await page.evaluate(() => !!document.getElementById('startBtn'));
check('application utilisable hors ligne', worksOffline, true);
await ctx.setOffline(false);

check('aucune ressource locale en 404', bad404, []);

await browser.close();
console.log(`\n${pass} réussis, ${fail} échoués`);
if (fail) { console.log(JSON.stringify(bad, null, 2)); process.exit(1); }
