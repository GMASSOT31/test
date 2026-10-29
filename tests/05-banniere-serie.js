const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, seed, login, LEO, EMMA, SRC } = require('./harness');
const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
(async () => {
  const w = makeWorld(); seed(w);
  const b = await chromium.launch(); const errs = [];
  const open = async (ctx, f) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(f + ': ' + e.message)); await p.goto('file://' + SRC + f); return p; };
  let c = await b.newContext({ viewport: { width: 1100, height: 800 } }); await install(c, w);

  // bannière sur les 2 pages, ancienne retirée, page Byzance supprimée
  for (const f of ['Index.html', 'admin.html']) { const p = await open(c, f); ok((await p.locator('.rv-banner').count()) === 1 && (await p.locator('.rv-float').count()) === 4 && (await p.locator('.rv-chip').count()) === 4, f + ' : bannière fournie présente (4 emojis, bandeau, 4 pastilles)'); await p.close(); }
  ok(!require('fs').existsSync(SRC + 'byzance.html'), 'byzance.html supprimée (elle contenait un quiz accessible sans connexion)');

  const p = await open(c, 'Index.html');
  ok((await p.locator('#rvStreak').innerText()) === '👋 Bienvenue', 'avant connexion, la pastille dit « 👋 Bienvenue » (pas de série pour un inconnu)');
  const s0 = await p.locator('#rvSub').innerText();
  await p.waitForFunction(t => document.querySelector('#rvSub').textContent !== t, s0, { timeout: 9000 });
  ok(true, 'les phrases sous le titre tournent toujours');

  // série de jours propre à chaque élève
  await login(p, LEO);
  ok((await p.locator('#rvStreak').innerText()) === '🔥 Série : 1 jour', 'Léo, 1re connexion : ' + await p.locator('#rvStreak').innerText());
  await p.evaluate(d => { localStorage.setItem('rvLast:leo', d); localStorage.setItem('rvStreak:leo', '4'); }, day(1));
  await p.click('#logout'); await p.fill('#login-pin', '1234'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('#rvStreak').innerText()) === '🔥 Série : 5 jours', 'Léo, le lendemain (série de 4) : ' + await p.locator('#rvStreak').innerText());
  await p.click('#logout'); await p.fill('#login-pseudo', 'Emma'); await p.fill('#login-pin', '4321'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('#rvStreak').innerText()) === '🔥 Série : 1 jour', 'Emma sur le même appareil : sa propre série (1 jour), pas celle de Léo');
  await p.click('#logout'); await p.fill('#login-pseudo', 'Léo'); await p.fill('#login-pin', '1234'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('#rvStreak').innerText()) === '🔥 Série : 5 jours', 'Léo, 2e connexion le même jour : la série ne bouge pas');
  await p.evaluate(d => { localStorage.setItem('rvLast:leo', d); localStorage.setItem('rvStreak:leo', '9'); }, day(3));
  await p.click('#logout'); await p.fill('#login-pin', '1234'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('#rvStreak').innerText()) === '🔥 Série : 1 jour', 'jours manqués : la série repart à 1');

  // stockage refusé
  const c2 = await b.newContext(); await install(c2, w); const q = await c2.newPage(); const e2 = []; q.on('pageerror', e => e2.push(e.message));
  await q.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('x', 'SecurityError'); } }));
  await q.goto('file://' + SRC + 'Index.html'); await login(q, LEO);
  ok(e2.length === 0 && (await q.locator('#rvStreak').innerText()) === '👋 Bienvenue' && (await q.locator('.card').count()) === 2, 'stockage refusé : connexion OK, 2 quiz affichés, pas de série (non comptable) mais aucune erreur');
  // mouvement réduit + masquage lecteurs d'écran + 320 px
  const c3 = await b.newContext({ reducedMotion: 'reduce', viewport: { width: 320, height: 700 } }); await install(c3, w);
  const r = await open(c3, 'Index.html');
  ok((await r.evaluate(() => getComputedStyle(document.querySelector('.rv-track')).animationName)) === 'none', 'mouvement réduit : bandeau à l\'arrêt');
  ok((await r.locator('.rv-float[aria-hidden="true"]').count()) === 4, 'éléments décoratifs masqués aux lecteurs d\'écran');
  ok(!(await r.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'écran de connexion à 320 px : pas de défilement horizontal');
  await login(r, LEO);
  ok(!(await r.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'page élève à 320 px : pas de défilement horizontal');
  // ouverture hors du script déployé : message clair
  const c4 = await b.newContext(); const t = await open(c4, 'Index.html');
  await t.fill('#login-classe', 'x'); await t.fill('#login-pseudo', 'x'); await t.fill('#login-pin', '1234'); await t.click('#login-btn');
  ok((await t.locator('#login-error').innerText()).includes('script déployé'), 'sans serveur : message « ' + await t.locator('#login-error').innerText() + ' »');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
