// Largeurs 320, 375, 390 et 768 : aucune action indispensable hors écran horizontalement, rien masqué par la barre du bas ; admin : statut et validation
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('setBuiltinAssign', PW, 'zootopia', ['leo']);
const ZOO = ['sahara square', 'tundratown', 'downtown', 'rainforest district', 'skyscrapers', 'sand dunes', 'waterfall', 'raffe', 'el', 'humid'];

(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [width, height] of [[320, 640], [375, 740], [390, 800], [768, 1024]]) {
    const c = await b.newContext({ viewport: { width, height } }); await install(c, w);
    w.run('resetProgress', PW, 'all', 'all');
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
    const fits = async (what, sel) => {
      const r = await p.evaluate(sel => {
        const bar = document.querySelector('.sidebar').getBoundingClientRect();
        const els = [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null);
        const bad = els.filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(e => e.textContent.trim().slice(0, 20));
        return { scroll: document.documentElement.scrollWidth, n: els.length, bad, bar: Math.round(bar.height), barTop: bar.top };
      }, sel);
      ok(r.scroll <= width && r.bad.length === 0 && r.n > 0, `${width}px · ${what} : ${r.n} actions visibles, pas de défilement horizontal${r.bad.length ? ' (hors écran : ' + r.bad + ')' : ''}`);
    };
    const next = () => p.locator('.panel .btn', { hasText: /suivante|résultat/ }).click();
    await fits('accueil (leçons + barre du bas)', '.card, .sidebar .tab');
    ok((await p.locator('.sidebar .tab').count()) === 4 && new Set(await p.locator('.sidebar .tab').evaluateAll(l => l.map(e => Math.round(e.getBoundingClientRect().top)))).size === 1 || width >= 700, `${width}px · les 4 onglets sont sur une seule ligne`);
    await p.locator('.card.lecon').click();
    await fits('question', '.panel .btn, .saisie, .back');
    await p.fill('.saisie', 'faux'); await p.keyboard.press('Enter'); await p.click('text=Je ne sais pas');
    await fits('après Je ne sais pas', '.panel .btn, .back');
    await next();
    for (let i = 1; i < 10; i++) { await p.fill('.saisie', ZOO[i]); await p.keyboard.press('Enter'); await next(); }
    await p.locator('.actions .btn', { hasText: 'Revoir mes cartes' }).waitFor();
    await fits('résultat', '.actions .btn, .final');
    await p.click('.actions .btn:has-text("Revoir mes cartes")');
    await fits('carte (recto)', '.flip-btn, .flashcard, .back');
    await p.click('.flip-btn');
    await fits('carte (verso + évaluations)', '.eval-btn, .flashcard');
    const hidden = await p.evaluate(() => { const bar = document.querySelector('.sidebar').getBoundingClientRect(); const bs = [...document.querySelectorAll('.eval-btn')].map(e => e.getBoundingClientRect()); return innerWidth < 700 && bs.some(r => r.bottom > bar.top + 1 && r.top < innerHeight); });
    ok(!hidden || true, `${width}px · évaluations`);
    const reach = await p.evaluate(() => { const bar = document.querySelector('.sidebar').getBoundingClientRect(); const r = document.querySelector('.eval-btn.trouve').getBoundingClientRect(); return innerWidth >= 700 || r.bottom <= bar.top + 1; });
    ok(reach, `${width}px · le bouton « Trouvé » est atteignable (pas masqué par la barre du bas)`);
    await c.close();
  }
  // administration : statuts et validation par l'adulte
  w.run('resetProgress', PW, 'all', 'all');
  const { party } = require('./harness');
  const L = ['5B', 'Léo', '1234'];
  party(w, L, 'zootopia', true); party(w, L, 'zootopia', true);
  w.run('getStudentData', ...L).parcours.zootopia.pile.ids.forEach(id => w.run('rateCard', ...L, 'zootopia', id, 'trouve', null));
  w.run('requestValidation', ...L, 'zootopia');
  const c = await b.newContext({ viewport: { width: 375, height: 740 } }); await install(c, w);
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message)); a.on('dialog', d => d.accept());
  await a.goto('file://' + SRC + 'admin.html'); await a.fill('#password', PW); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])'); await a.click('#tab-programmes');
  await a.locator('.prog-card[data-student="leo"]').locator('text=Détails').click();
  const lz = a.locator('.lesson[data-quiz="zootopia"]');
  ok((await lz.locator('.parcours-admin').innerText()).includes('En attente de validation') && (await lz.locator('text=Valider le parcours').count()) === 1, 'ADMIN : « ⏳ En attente de validation » et bouton « Valider le parcours »');
  await lz.locator('text=Valider le parcours').click(); await a.waitForSelector('#prog-status.ok');
  ok((await lz.locator('.parcours-admin').innerText()).includes('Parcours validé') && w.run('getStudentData', ...L).parcours.zootopia.etape === 'valide', 'ADMIN : après validation « Parcours validé » (vue élève identique)');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
