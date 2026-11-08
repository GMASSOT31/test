// Largeurs 320, 375, 390 et 768 : aucune action hors écran horizontalement, boutons utiles jamais cachés par la barre du bas ;
// suivi parent lisible sur téléphone
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC, answerCurrent } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('setBuiltinAssign', PW, 'zootopia', ['leo']); w.run('setBuiltinAssign', PW, 'byzance-30', ['leo']);

(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [width, height] of [[320, 640], [375, 740], [390, 800], [768, 1024]]) {
    const c = await b.newContext({ viewport: { width, height } }); await install(c, w);
    w.run('resetProgress', PW, 'all', 'all');
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
    const fits = async (what, sel) => {
      const r = await p.evaluate(sel => {
        const els = [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null);
        const bad = els.filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(e => e.textContent.trim().slice(0, 20));
        return { scroll: document.documentElement.scrollWidth, n: els.length, bad };
      }, sel);
      ok(r.scroll <= width && r.bad.length === 0 && r.n > 0, `${width}px · ${what} : ${r.n} éléments, rien hors écran${r.bad.length ? ' (hors écran : ' + r.bad + ')' : ''}`);
    };
    // le bouton est visible au-dessus de la barre du bas (sur téléphone) après un défilement normal
    const reachable = async (what, sel) => {
      await p.locator(sel).first().scrollIntoViewIfNeeded();
      const okk = await p.evaluate(sel => { const bar = document.querySelector('.sidebar').getBoundingClientRect(); const r = document.querySelector(sel).getBoundingClientRect();
        if (innerWidth >= 700) return r.bottom <= innerHeight + 1;
        if (r.bottom > bar.top + 1) window.scrollBy(0, r.bottom - bar.top + 10);
        const r2 = document.querySelector(sel).getBoundingClientRect(); return r2.bottom <= bar.top + 1 && r2.top >= 0; }, sel);
      ok(okk, `${width}px · ${what} : atteignable, pas caché par la barre du bas`);
    };
    await fits('accueil (révision du jour, leçons, barre du bas)', '.daily, .card, .sidebar .tab');
    ok(width >= 700 || ((await p.locator('.sidebar .tab').count()) === 4 && new Set(await p.locator('.sidebar .tab').evaluateAll(l => l.map(e => Math.round(e.getBoundingClientRect().top)))).size === 1), `${width}px · les 4 onglets sur une seule ligne`);
    await p.locator('.card.lecon', { hasText: 'Zootopia' }).click();
    await fits('première ouverture (date du contrôle)', '.choice, .setup .btn, .setup input');
    await p.locator('.choice', { hasText: 'Demain' }).first().click(); await p.locator('.choice.wide', { hasText: 'Non' }).click();
    await reachable('« C\'est parti »', '.setup .actions .btn');
    await p.click('.setup .actions .btn'); await p.waitForSelector('.session-head');
    await fits('carte « Je découvre »', '.session-head, .flashcard, .panel.session .btn');
    await reachable('« J\'ai lu »', '.panel.session .actions .btn');
    for (let i = 0; i < 5; i++) await answerCurrent(p);
    await fits('QCM', '.option, .session-head');
    await answerCurrent(p, false, { next: false });
    await fits('correction', '.option, .next-btn, .mastery-line');
    await reachable('« Continuer »', '.next-btn');
    await p.click('.next-btn');
    // formats sans choix
    await p.evaluate(() => revisionPreview('byzance-30', 0, 'rappel'));
    await fits('QCM masqué', '.masked-btns .btn');
    await reachable('« Je ne sais pas » (QCM masqué)', '.masked-btns .idk');
    await p.evaluate(() => revisionPreview('zootopia', 0, 'rappel'));
    await fits('réponse écrite', '.saisie, .saisie-actions .btn');
    await p.evaluate(() => { S = null; activeTab = 'quiz'; renderList(); });
    await p.locator('.card.lecon', { hasText: 'Zootopia' }).click();
    await fits('écran de la leçon (plan, niveaux, boutons)', '.plan-dots li, .lvl-legend, .lesson-screen .btn');
    await reachable('bouton principal de la leçon', '.lesson-screen .big-btn');
    await c.close();
  }
  // suivi parent sur téléphone
  const c = await b.newContext({ viewport: { width: 375, height: 740 } }); await install(c, w);
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message));
  await a.goto('file://' + SRC + 'admin.html'); await a.fill('#password', PW); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])'); await a.click('#tab-programmes');
  await a.locator('.prog-card[data-student="leo"]').locator('text=Détails').click();
  const r = await a.evaluate(() => ({ scroll: document.documentElement.scrollWidth, bad: [...document.querySelectorAll('.lesson .btn, .exam-input, .lvl-bar, .pret')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length }));
  ok(r.scroll <= 375 && r.bad === 0, 'SUIVI PARENT à 375 px : niveaux, date du contrôle et boutons dans l\'écran');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
