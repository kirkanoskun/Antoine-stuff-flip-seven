/* Tests du moteur de score, exécutés dans la page via window.__flip7. */
import { createRequire } from 'node:module';
// createRequire suit la résolution CommonJS : fonctionne avec un playwright
// installé localement comme avec une installation globale via NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8899/index.html';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext()).newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });

const out = await page.evaluate(() => {
  const F = window.__flip7;
  const res = [];
  const sel = (o = {}) => Object.assign(F.newSelection(), o);
  const t = (name, s, variant, merciless, expected) => {
    const r = F.computeScore(sel(s), variant, merciless);
    res.push({ name, actual: r.total, expected, ok: r.total === expected, flip7: r.flip7 });
  };

  /* ══ STANDARD — non-régression stricte ══ */
  t('std []', {}, 'standard', false, 0);
  t('std [3,7,9]', { numbers: [3, 7, 9] }, 'standard', false, 19);
  t('std [3,7,9] +4', { numbers: [3, 7, 9], mods: [4] }, 'standard', false, 23);
  t('std [3,7,9] x2', { numbers: [3, 7, 9], x2: true }, 'standard', false, 38);
  t('std [3,7,9] x2 +4', { numbers: [3, 7, 9], x2: true, mods: [4] }, 'standard', false, 42);
  t('std Flip7 [1..7] = 28+15', { numbers: [1, 2, 3, 4, 5, 6, 7] }, 'standard', false, 43);
  t('std bust', { numbers: [3, 7, 9], bust: true }, 'standard', false, 0);
  t('std bust + x2 + mods (bust prime)', { numbers: [9], x2: true, mods: [10], bust: true }, 'standard', false, 10);
  t('std x2 ne double pas les bonus', { numbers: [10], x2: true, mods: [2, 4] }, 'standard', false, 26);
  t('std Flip7 avec x2 : +15 apres x2', { numbers: [0, 1, 2, 3, 4, 5, 6], x2: true }, 'standard', false, 57);

  /* ══ VENGEANCE — vecteurs de la spec ══ */
  t('vg [13,13] + porte-bonheur', { numbers: [13, 13], luckyThirteen: true }, 'vengeance', false, 26);
  t('vg [13,13,1,2,3,4,5] Flip7 = 41+15', { numbers: [13, 13, 1, 2, 3, 4, 5], luckyThirteen: true }, 'vengeance', false, 56);
  t('vg [10,11] div2 = floor(21/2)', { numbers: [10, 11], malus: ['div2'] }, 'vengeance', false, 10);
  t('vg [11] div2 = floor(11/2)', { numbers: [11], malus: ['div2'] }, 'vengeance', false, 5);
  t('vg [3] -10 normal = plancher 0', { numbers: [3], malus: [-10] }, 'vengeance', false, 0);
  t('vg [3] -10 sans pitie = -7', { numbers: [3], malus: [-10] }, 'vengeance', true, -7);
  t('vg [0,5,6] Le Zero annule', { numbers: [0, 5, 6] }, 'vengeance', false, 0);
  t('vg [0,1,2,3,4,5,6] Zero + Flip7 = 21+15', { numbers: [0, 1, 2, 3, 4, 5, 6] }, 'vengeance', false, 36);
  t('vg bust -6 sans pitie = -6', { numbers: [9], malus: [-6], bust: true }, 'vengeance', true, -6);
  t('vg bust -6 normal = 0', { numbers: [9], malus: [-6], bust: true }, 'vengeance', false, 0);

  /* ══ VENGEANCE — cas limites ══ */
  t('vg div2 avant malus', { numbers: [10, 10], malus: ['div2', -4] }, 'vengeance', false, 6);      // 20/2=10, -4 => 6
  t('vg double div2 cumulatif', { numbers: [10, 11], malus: ['div2', 'div2'] }, 'vengeance', false, 5); // 21->10->5
  t('vg Flip7 +15 non divise', { numbers: [1, 2, 3, 4, 5, 6, 7], malus: ['div2'] }, 'vengeance', false, 29); // 28->14, +15
  t('vg Flip7 clamp avant bonus', { numbers: [0, 1, 2, 3, 4, 5, 6], malus: [-10, -10, -10] }, 'vengeance', false, 15); // 21-30=-9 -> 0, +15
  t('vg Flip7 sans pitie sans clamp', { numbers: [0, 1, 2, 3, 4, 5, 6], malus: [-10, -10, -10] }, 'vengeance', true, 6); // -9 +15
  t('vg don du Flip7 : pas de +15 pour le donneur', { numbers: [1, 2, 3, 4, 5, 6, 7], flip7Gift: 'x' }, 'vengeance', true, 28);
  t('vg [13] seul', { numbers: [13] }, 'vengeance', false, 13);
  t('vg 7 porte-malheur : ne reste que le 7', { numbers: [7], discardedByUnlucky7: true }, 'vengeance', false, 7);
  t('vg zero seul non-flip7', { numbers: [0] }, 'vengeance', false, 0);
  t('vg malus seuls sans pitie', { numbers: [], malus: [-2, -4] }, 'vengeance', true, -6);

  /* ══ isFlip7 ══ */
  const f7 = [];
  const chk = (name, s, expected) => { const a = F.isFlip7(sel(s)); f7.push({ name, actual: a, expected, ok: a === expected }); };
  chk('7 distinctes = flip7', { numbers: [1, 2, 3, 4, 5, 6, 7] }, true);
  chk('6 cartes != flip7', { numbers: [1, 2, 3, 4, 5, 6] }, false);
  chk('8 cartes != flip7', { numbers: [1, 2, 3, 4, 5, 6, 7, 8] }, false);
  chk('doublon non-13 != flip7', { numbers: [1, 1, 3, 4, 5, 6, 7] }, false);
  chk('paire 13 SANS porte-bonheur != flip7', { numbers: [13, 13, 1, 2, 3, 4, 5] }, false);
  chk('paire 13 AVEC porte-bonheur = flip7', { numbers: [13, 13, 1, 2, 3, 4, 5], luckyThirteen: true }, true);
  chk('trois 13 != flip7', { numbers: [13, 13, 13, 1, 2, 3, 4], luckyThirteen: true }, false);
  chk('bust != flip7', { numbers: [1, 2, 3, 4, 5, 6, 7], bust: true }, false);
  chk('le zero compte dans les 7', { numbers: [0, 1, 2, 3, 4, 5, 6] }, true);

  /* ══ validation douce ══ */
  const val = [];
  const v = (name, s, expectCount) => {
    const w = F.validateSelection(sel(s));
    val.push({ name, actual: w.length, expected: expectCount, ok: w.length === expectCount, warns: w });
  };
  v('rien a signaler', { numbers: [1, 2, 3] }, 0);
  v('doublon non-13 signale', { numbers: [4, 4] }, 1);
  v('deux 13 sans porte-bonheur signale', { numbers: [13, 13] }, 1);
  v('deux 13 avec porte-bonheur OK', { numbers: [13, 13], luckyThirteen: true }, 0);
  v('trois 13 signale', { numbers: [13, 13, 13], luckyThirteen: true }, 1);
  v('plus de 7 cartes signale', { numbers: [1, 2, 3, 4, 5, 6, 7, 8] }, 1);

  return { res, f7, val };
});

let pass = 0, fail = 0;
const show = (title, rows) => {
  console.log(`\n── ${title} ──`);
  rows.forEach(r => {
    r.ok ? pass++ : fail++;
    console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `  → attendu ${r.expected}, obtenu ${r.actual}${r.warns ? ' ' + JSON.stringify(r.warns) : ''}`}`);
  });
};
show('Score', out.res);
show('isFlip7', out.f7);
show('Validation douce', out.val);

if (pageErrors.length) { console.log('\n✗ Exceptions JS:', pageErrors); fail += pageErrors.length; }

console.log(`\n${pass} réussis, ${fail} échoués`);
await browser.close();
if (fail) process.exit(1);
