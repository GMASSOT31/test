// « Mes progrès » : questions ancrées, niveaux en couleurs, temps de la semaine, leçons (même action que « Mes leçons »)
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, seed, login, startLesson, finishSession } = require('./harness');
const DAY = 86400000;
const W = makeWorld(); seed(W, { allToLeo: true });
const URL_ = 'file://' + require('path').join(__dirname, '..', 'apps-script', 'Index.html');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
  await install(ctx, W);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL_); await login(p);
  const txt = async sel => (await p.locator(sel).innerText()).replace(/\s+/g, ' ').trim();

  // 1. départ
  ok((await p.locator('#tab-programme').innerText()).includes('Mes progrès'), 'onglet « Mes progrès »');
  ok((await p.locator('#tab-quiz').getAttribute('aria-selected')) === 'true', '« Mes leçons » est l\'entrée par défaut');
  await p.click('#tab-programme');
  ok((await p.locator('#content h2').first().innerText()) === 'Mes progrès' && (await txt('.progress-panel .progress')) === 'Questions ancrées 0 / 50', '« Questions ancrées » : 0 / 50');
  ok((await txt('.progress-panel .lvl-legend')) === '🌱 Nouvelle 50 🌿 Découverte 0 🌳 Rappelée 0 ⭐ Ancrée 0 🏆 Maîtrisée 0', 'les 5 niveaux, avec leur couleur et leur nombre');
  ok((await txt('.progress-panel .hint-small')).startsWith('Cette semaine : 0 séance, 0 min.'), 'temps de la semaine : 0 séance');
  ok((await p.locator('.card.lecon').count()) === 3 && (await p.locator('.card.lecon .action-pill').allInnerTexts()).every(t => t === 'Commencer'), 'les 3 leçons, avec la même action que « Mes leçons »');

  // 2. après une séance, puis des révisions espacées
  await p.click('#tab-quiz'); await startLesson(p, 'Zootopia'); await finishSession(p);
  await p.click('text=Retour aux leçons'); await p.click('#tab-programme');
  ok((await txt('.progress-panel .lvl-legend')).includes('🌿 Découverte 10') && (await txt('.progress-panel .progress')) === 'Questions ancrées 0 / 50', 'après la 1re séance : 10 découvertes, aucune encore ancrée');
  ok((await txt('.progress-panel .hint-small')).startsWith('Cette semaine : 1 séance'), 'une séance comptée cette semaine');
  for (const d of [1, 3]) {
    W.advance(d * DAY); await p.evaluate(() => revisionFlush()); await p.reload(); await p.waitForSelector('#app:not([hidden])');
    await p.click('.daily-btn'); await finishSession(p); await p.click('text=Retour aux leçons');
  }
  await p.click('#tab-programme');
  ok((await txt('.progress-panel .progress')) === 'Questions ancrées 10 / 50' && (await txt('.progress-panel .lvl-legend')).includes('⭐ Ancrée 10'), 'J+1 puis J+4 réussis : 10 questions ancrées');
  const card = p.locator('.card.lecon', { hasText: 'Zootopia' });
  ok((await card.locator('.etape').innerText()).startsWith('⭐ Leçon ancrée'), 'la leçon est « ancrée » : « ' + await card.locator('.etape').innerText() + ' »');
  await card.click();
  ok(await p.locator('.lesson-screen').isVisible(), 'un clic ouvre la leçon (même écran que depuis « Mes leçons »)');

  // 3. un quiz ajouté apporte ses questions
  await p.click('.back'); await p.click('#tab-programme');
  await p.evaluate(() => { QUIZZES.push({ id: 'nouveau', emoji: '🧪', matiere: 'Test', titre: 'Nouveau', description: '', questions: [{ question: 'Q ?', options: ['a', 'b'], correct: 0 }] }); renderList(); });
  ok((await txt('.progress-panel .progress')) === 'Questions ancrées 10 / 51', 'un quiz ajouté apporte ses questions : 51');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));

  // 4. stockage refusé : tout fonctionne le temps de la visite
  const c2 = await b.newContext(); await install(c2, W); const q = await c2.newPage(); const e2 = [];
  q.on('pageerror', e => e2.push(e.message));
  await q.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('x', 'SecurityError'); } }));
  await q.goto(URL_); await login(q);
  await startLesson(q, 'Grand quiz');
  ok(e2.length === 0 && (await q.locator('.session-head').count()) === 1, 'stockage refusé : la séance fonctionne, sans erreur');
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
