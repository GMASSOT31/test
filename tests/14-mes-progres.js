// « Mes progrès » (ex-Programme) et séries de 2 réussites consécutives, côté page élève
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, seed, login } = require('./harness');
const W = makeWorld(); seed(W, { allToLeo: true });
const URL_ = 'file://' + require('path').join(__dirname, '..', 'apps-script', 'Index.html');
const ZOO = ['sahara square', 'tundratown', 'downtown', 'rainforest district', 'skyscrapers', 'sand dunes', 'waterfall', 'raffe', 'el', 'humid'];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
  await install(ctx, W);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL_); await login(p);
  const next = () => p.locator('.panel .btn', { hasText: /suivante|résultat/ }).click();
  const lesson = () => p.locator('.card.lecon', { hasText: 'Zootopia' });

  // 1. départ
  ok((await p.locator('#tab-programme').innerText()).includes('Mes progrès') && !(await p.locator('#tab-programme').innerText()).includes('Programme'), 'l\'onglet « Programme » est devenu « Mes progrès »');
  ok((await p.locator('#tab-quiz').getAttribute('aria-selected')) === 'true', '« Mes leçons » est l\'entrée par défaut après la connexion');
  ok((await p.locator('#count-programme').innerText()) === '', 'plus de compteur « cartes à apprendre » sur cet onglet');
  await p.click('#tab-programme');
  ok((await p.locator('#content h2').first().innerText()) === 'Mes progrès', 'titre « Mes progrès »');
  ok((await p.locator('.progress-panel .progress').innerText()).includes('Questions vérifiées') && (await p.locator('.progress-panel .score').innerText()) === '0 / 50', '« Questions vérifiées » : 0 / 50');
  ok((await p.locator('.progress-panel .hint-small').innerText()).includes('Deux réussites consécutives aux quiz'), 'la règle « Deux réussites consécutives aux quiz » est affichée');
  ok(!(await p.locator('body').innerText()).includes('à apprendre'), 'plus de second parcours « paquets à apprendre » : le bouton de leçon reprend la même étape');
  ok((await p.locator('.card.lecon .action-pill').allInnerTexts()).every(t => t === 'Commencer le quiz') && (await p.locator('.card.lecon').count()) === 3, '3 leçons, chacune avec l\'action « Commencer le quiz »');
  ok(!(await p.locator('body').innerText()).match(/Programme de révision/), 'plus aucun « Programme de révision » dans la page');

  // 2. séries : quiz initial parfait -> 1 sur 2, puis vérification -> 2 sur 2 « vérifiée »
  await p.click('#tab-quiz'); await lesson().click();
  await p.fill('.saisie', ZOO[0]); await p.keyboard.press('Enter');
  let m = (await p.locator('.mastery-line').innerText()).trim();
  ok(m.includes('●○') && m.includes('1 / 2') && m.includes('réussites consécutives'), 'réussite 1 : ' + m);
  await next();
  for (let i = 1; i < 10; i++) { await p.fill('.saisie', ZOO[i]); await p.keyboard.press('Enter'); await next(); }
  await p.locator('.actions .btn', { hasText: 'Vérifier mes réponses' }).waitFor();
  await p.click('.actions .btn:has-text("Vérifier mes réponses")');
  await p.fill('.saisie', ZOO[0]); await p.keyboard.press('Enter');
  m = (await p.locator('.mastery-line').innerText()).trim();
  ok(m.includes('Question vérifiée') && m.includes('2 réussites consécutives'), 'réussite 2 d\'affilée : ' + m);
  await next();
  // une erreur au premier essai remet la série à zéro (réponse corrigée ensuite : sans point)
  await p.fill('.saisie', 'faux'); await p.keyboard.press('Enter'); await p.fill('.saisie', ZOO[1]); await p.keyboard.press('Enter');
  m = (await p.locator('.mastery-line').innerText()).trim();
  ok(m.includes('repart à 0 / 2'), 'erreur puis bonne réponse : la série repart à 0 : ' + m);
  await p.evaluate(() => revisionFlush());
  ok(JSON.stringify(JSON.parse(W.props['prog_leo__zootopia']).q[W.ctx.qhash_(W.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia').questions[1].question)]) === '[0,1]', 'serveur : série 0, une seule erreur comptée');

  // 3. Mes progrès : 1 question vérifiée, la même étape que Mes leçons
  await p.click('.back'); await p.click('#tab-programme');
  ok((await p.locator('.progress-panel .score').innerText()) === '1 / 50', 'Mes progrès : 1 / 50 questions vérifiées');
  const card = p.locator('.card.lecon', { hasText: 'Zootopia' });
  ok((await card.locator('.etape').innerText()).includes('Vérification') && (await card.locator('.action-pill').innerText()) === 'Continuer la vérification', 'Zootopia : « ' + await card.locator('.etape').innerText() + ' » / action « ' + await card.locator('.action-pill').innerText() + ' »');
  ok((await card.locator('.verified').innerText()) === 'Questions vérifiées : 1 sur 10', 'compteur libellé : « Questions vérifiées : 1 sur 10 »');
  await card.click();
  ok(await p.locator('.etape-banner').innerText().then(t => t.startsWith('Vérification')), 'un clic depuis Mes progrès reprend la même étape (vérification)');

  // 4. persistance
  await p.evaluate(() => revisionFlush()); await p.reload(); await p.waitForSelector('#app:not([hidden])');
  await p.click('#tab-programme');
  ok((await p.locator('.progress-panel .score').innerText()) === '1 / 50', 'progression conservée après rechargement');

  // 5. un quiz ajouté apporte ses questions
  await p.evaluate(() => { QUIZZES.push({ id: 'nouveau', emoji: '🧪', matiere: 'Test', titre: 'Nouveau', description: '', questions: [{ question: 'Q ?', options: ['a', 'b'], correct: 0 }] }); });
  ok((await p.evaluate(() => programmeStats().total)) === 51, 'un quiz ajouté (admin) apporte ses questions : 51');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));

  // 6. stockage refusé
  const c2 = await b.newContext(); await install(c2, W); const q = await c2.newPage(); const e2 = [];
  q.on('pageerror', e => e2.push(e.message));
  await q.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('x', 'SecurityError'); } }));
  await q.goto(URL_); await login(q);
  await q.locator('.card.lecon', { hasText: 'Grand quiz' }).click();
  await q.locator('.option').first().click();
  ok(e2.length === 0 && (await q.locator('.mastery-line').count()) === 1, 'stockage refusé : le quiz fonctionne le temps de la visite, sans erreur');
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
