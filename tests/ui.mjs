/* Parcours d'interface complet : standard, Vengeance, Sans Pitié, migration. */
import { createRequire } from 'node:module';
// createRequire suit la résolution CommonJS : fonctionne avec un playwright
// installé localement comme avec une installation globale via NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8899/index.html';

let pass = 0, fail = 0;
const bad = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : (fail++, bad.push({ name, actual, expected }));
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    attendu: ${JSON.stringify(expected)}\n    obtenu : ${JSON.stringify(actual)}`}`);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message));

const goto = async () => { await page.goto(URL, { waitUntil: 'domcontentloaded' }); };
const ids = () => page.evaluate(() => state.players.map(p => p.id));
const tot = () => page.evaluate(() => { const t = totals(); return state.players.map(p => t[p.id]); });
const confirmYes = async () => { await page.click('#confirmYes'); await page.waitForTimeout(120); };

async function addPlayers(names) {
  for (const n of names) { await page.fill('#playerName', n); await page.click('#addPlayerBtn'); }
}

/* ══════════ A. Parcours standard ══════════ */
await goto();
await page.evaluate(() => localStorage.clear());
await goto();

await addPlayers(['Antoine', 'Sophie', 'Marc']);
check('A1 · 3 joueurs', await page.locator('#playerList .player-row').count(), 3);
check('A2 · variante par défaut', await page.evaluate(() => state.variant), 'standard');

await page.fill('#targetScore', '60');
await page.click('#startBtn');
check('A3 · jeu visible', await page.locator('#game').isVisible(), true);

let P = await ids();
await page.fill(`#in_${P[0]}`, '25');
await page.fill(`#in_${P[1]}`, '10');
await page.click('#validateBtn');
check('A4 · totaux manche 1', await tot(), [25, 10, 0]);

// Saisie invalide refusée
await page.fill(`#in_${P[0]}`, '12abc');
await page.click('#validateBtn');
check('A5 · saisie sale rejetée (pas de manche ajoutée)', await page.evaluate(() => state.rounds.length), 1);
await page.fill(`#in_${P[0]}`, '');

// Calculateur standard
await page.evaluate(p => openCalc(p), P[0]);
await page.evaluate(() => { [3, 7, 9].forEach(n => document.querySelector(`#numGrid [data-num="${n}"]`).click()); });
check('A6 · calc affiche 19', await page.locator('#calcTotal').textContent(), '19');
await page.click('#applyCalcBtn');
check('A7 · score reporté dans l\'input', await page.inputValue(`#in_${P[0]}`), '19');

// Annulation de manche via la feuille maison
await page.click('#undoBtn');
check('A8 · feuille de confirmation ouverte', await page.locator('#confirmOverlay').isVisible(), true);
await confirmYes();
check('A9 · manche annulée', await tot(), [0, 0, 0]);

/* ══════════ B. Égalité → mort subite ══════════ */
await page.fill(`#in_${P[0]}`, '60');
await page.fill(`#in_${P[1]}`, '60');
await page.fill(`#in_${P[2]}`, '5');
await page.click('#validateBtn');
await page.waitForTimeout(500);
check('B1 · pas de victoire sur égalité', await page.locator('#victoryOverlay').isVisible(), false);
check('B2 · bandeau égalité affiché', (await page.locator('#winBanner').textContent()).includes('Égalité'), true);
check('B3 · saisie encore ouverte', await page.locator('#entryPanel').isVisible(), true);

// La manche suivante départage
await page.fill(`#in_${P[0]}`, '5');
await page.click('#validateBtn');
await page.waitForTimeout(600);
check('B4 · victoire après départage', await page.locator('#victoryOverlay').isVisible(), true);
check('B5 · gagnant = Antoine', (await page.locator('#victoryTitle').textContent()).trim(), 'Antoine');

await page.click('#replayBtn');
check('B6 · scores remis à zéro', await tot(), [0, 0, 0]);
check('B7 · joueurs conservés', await page.evaluate(() => state.players.length), 3);

/* ══════════ C. Vengeance ══════════ */
await page.click('#editPlayersBtn');
await page.click('#segVengeance');
check('C1 · variante Vengeance', await page.evaluate(() => state.variant), 'vengeance');
check('C2 · bascule Sans Pitié visible', await page.locator('#mercilessRow').isVisible(), true);
await page.click('#mercilessSwitch');
check('C3 · Sans Pitié actif', await page.evaluate(() => state.merciless), true);
check('C4 · badge en en-tête', (await page.locator('#headerVariant').textContent()).trim(), 'Vengeance · Sans Pitié');

await page.click('#startBtn');
check('C5 · bouton ± présent en Sans Pitié', await page.locator('.sign-btn').count(), 3);

P = await ids();
// Carte 13 disponible uniquement en Vengeance
await page.evaluate(p => openCalc(p), P[0]);
check('C6 · carte 13 présente', await page.locator('#numGrid [data-num="13"]').count(), 1);
check('C7 · section standard masquée', await page.locator('#stdSection').isVisible(), false);
check('C8 · section Vengeance visible', await page.locator('#vengSection').isVisible(), true);

// 13 tri-état : sans porte-bonheur, un seul 13
await page.click('#numGrid [data-num="13"]');
await page.click('#numGrid [data-num="13"]');
check('C9 · sans porte-bonheur le 13 est binaire', await page.evaluate(() => calc.sel.numbers.filter(n => n === 13).length), 0);

await page.click('#luckyChip');
await page.click('#numGrid [data-num="13"]');
await page.click('#numGrid [data-num="13"]');
check('C10 · avec porte-bonheur, deux 13', await page.evaluate(() => calc.sel.numbers.filter(n => n === 13).length), 2);
check('C11 · total = 26', await page.locator('#calcTotal').textContent(), '26');
check('C12 · badge compteur ×2 affiché', await page.locator('#numGrid [data-num="13"] .count').textContent(), '×2');

// Retirer le porte-bonheur ramène à un seul 13
await page.click('#luckyChip');
check('C13 · retrait du porte-bonheur → un seul 13', await page.evaluate(() => calc.sel.numbers.filter(n => n === 13).length), 1);

// Malus et ÷2
await page.click('#luckyChip');
await page.click('#numGrid [data-num="13"]');
await page.click('#malusGrid [data-malus="-10"]');
check('C14 · 26 − 10 = 16', await page.locator('#calcTotal').textContent(), '16');
await page.click('#div2Chip');
check('C15 · ÷2 avant malus : 13 − 10 = 3', await page.locator('#calcTotal').textContent(), '3');

// Score négatif autorisé en Sans Pitié
await page.click('#malusGrid [data-malus="-8"]');
check('C16 · score négatif en Sans Pitié', await page.locator('#calcTotal').textContent(), '-5');
await page.click('#applyCalcBtn');
check('C17 · négatif reporté', await page.inputValue(`#in_${P[0]}`), '-5');

/* ══════════ D. Avertissement de doublon ══════════ */
await page.evaluate(p => openCalc(p), P[1]);
await page.click('#numGrid [data-num="5"]');
check('D1 · pas d\'avertissement sur carte unique', await page.locator('#warnBox').isVisible(), false);
await page.evaluate(() => { calc.sel.numbers = [5, 5]; refresh(); });
check('D2 · doublon signalé', await page.locator('#warnBox').isVisible(), true);
await page.click('#cancelCalcBtn');

/* ══════════ E. Don du Flip 7 ══════════ */
await page.evaluate(p => openCalc(p), P[1]);
await page.evaluate(() => { calc.sel.numbers = [1, 2, 3, 4, 5, 6, 7]; refresh(); });
check('E1 · Flip 7 détecté', await page.locator('#flip7Badge').isVisible(), true);
check('E2 · total 28+15', await page.locator('#calcTotal').textContent(), '43');
check('E3 · encart de don visible', await page.locator('#giftBox').isVisible(), true);
const giftBtns = await page.locator('#giftOpts button').count();
check('E4 · 1 option "je garde" + 2 cibles', giftBtns, 3);
await page.locator('#giftOpts button').nth(1).click();
check('E5 · don → le donneur perd son +15', await page.locator('#calcTotal').textContent(), '28');
await page.click('#applyCalcBtn');
await page.click('#validateBtn');

const after = await tot();
check('E6 · cible pénalisée de −15', after[0], -5 - 15);
check('E7 · donneur garde 28', after[1], 28);

/* ══════════ F. Historique ══════════ */
const histTxt = await page.locator('#history').textContent();
check('F1 · marqueur de don dans l\'historique', histTxt.includes('🎁'), true);

/* ══════════ G. Persistance & rechargement ══════════ */
await page.reload({ waitUntil: 'domcontentloaded' });
check('G1 · état restauré', await tot(), after);
check('G2 · variante restaurée', await page.evaluate(() => state.variant), 'vengeance');
check('G3 · Sans Pitié restauré', await page.evaluate(() => state.merciless), true);

/* ══════════ H. Verrouillage de la variante ══════════ */
await page.click('#editPlayersBtn');
check('H1 · variante verrouillée en cours de partie', await page.locator('#segStandard').isDisabled(), true);
check('H2 · note de verrouillage visible', await page.locator('#variantLocked').isVisible(), true);

/* ══════════ I. Suppression de joueur purge ses points ══════════ */
const before = await page.evaluate(() => state.rounds.length);
await page.locator('#playerList .player-row button').first().click();
check('I1 · confirmation demandée', await page.locator('#confirmOverlay').isVisible(), true);
await confirmYes();
check('I2 · joueur retiré', await page.evaluate(() => state.players.length), 2);
check('I3 · manches conservées', await page.evaluate(() => state.rounds.length), before);
check('I4 · aucune entrée orpheline', await page.evaluate(() =>
  state.rounds.every(r => Object.keys(r.entries).every(id => state.players.some(p => p.id === id)))), true);
check('I5 · aucun don vers un joueur supprimé', await page.evaluate(() =>
  state.rounds.every(r => Object.values(r.entries).every(e =>
    !e.cards || !e.cards.flip7Gift || state.players.some(p => p.id === e.cards.flip7Gift)))), true);

/* ══════════ J. Migration v1 → v2 ══════════ */
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('flip7_state_v1', JSON.stringify({
    players: [{ id: 'a', name: 'Vieux Jean' }, { id: 'b', name: 'Vieille Marie' }],
    target: 150,
    started: true,
    rounds: [{ a: 30, b: 12 }, { a: 15, b: 40, zz: 999 }]
  }));
});
await goto();
check('J1 · joueurs migrés', await page.evaluate(() => state.players.map(p => p.name)), ['Vieux Jean', 'Vieille Marie']);
check('J2 · totaux migrés', await tot(), [45, 52]);
check('J3 · objectif migré', await page.evaluate(() => state.target), 150);
check('J4 · version 2', await page.evaluate(() => state.version), 2);
check('J5 · scores orphelins écartés', await page.evaluate(() =>
  state.rounds.every(r => !('zz' in r.entries))), true);
check('J6 · manches marquées manuelles', await page.evaluate(() =>
  state.rounds.every(r => Object.values(r.entries).every(e => e.manual === true && e.cards === null))), true);
check('J7 · v2 écrite en base', await page.evaluate(() => !!localStorage.getItem('flip7_state_v2')), true);
check('J8 · v1 préservée', await page.evaluate(() => !!localStorage.getItem('flip7_state_v1')), true);

/* ══════════ K. Robustesse ══════════ */
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('flip7_state_v2', '{ceci n est pas du json'); });
await goto();
check('K1 · JSON corrompu → état par défaut', await page.evaluate(() => state.players.length), 0);
check('K2 · app fonctionnelle après corruption', await page.locator('#setup').isVisible(), true);

check('Z · aucune exception JS', jsErrors, []);

await browser.close();
console.log(`\n${pass} réussis, ${fail} échoués`);
if (fail) { console.log(JSON.stringify(bad, null, 2)); process.exit(1); }
