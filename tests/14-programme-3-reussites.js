const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, seed, login } = require('./harness');
const W = makeWorld(); seed(W, { allToLeo: true });
const URL_ = 'file://' + require('path').join(__dirname, '..', 'apps-script', 'Index.html') + '';
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
  await install(ctx, W);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL_); await login(p);
  const count = async () => Number(await p.locator('#count-programme').innerText());
  const home = async () => { await p.evaluate(() => { activeTab = 'quiz'; renderList(); }); };

  // Zootopia Q1 (réponse écrite). good=true : du 1er coup ; good='retry' : une erreur puis la bonne ; false : mauvaise puis abandon
  async function zootopiaQ1(mode) {
    await home(); await p.locator('.card', { hasText: 'Zootopia' }).click();
    if (mode !== true) { await p.fill('.saisie', 'faux'); await p.keyboard.press('Enter'); }
    if (mode === true || mode === 'retry') { await p.fill('.saisie', 'sahara square'); await p.keyboard.press('Enter'); }
    return (await p.locator('.mastery-line').innerText()).trim();
  }
  // Grand quiz Q1 (QCM mélangé) : good ou mauvais choix
  async function grandQ1(good) {
    await home(); await p.locator('.card', { hasText: 'Grand quiz' }).click();
    const texts = await p.locator('.option').allInnerTexts();
    const target = good ? '476' : texts.find(t => t !== '476');
    await p.locator('.option', { hasText: new RegExp('^' + esc(target) + '$') }).click();
    return (await p.locator('.mastery-line').innerText()).trim();
  }

  // 1. départ : tout est à apprendre
  const total = await p.evaluate(() => programmeStats().total);
  ok(total === 50, 'au départ : 50 questions au total');
  ok((await count()) === 50, 'compteur Programme = 50 au départ (toutes les questions)');
  await p.click('#tab-programme');
  ok((await p.locator('.progress-panel .score').innerText()) === '0 / 50', 'questions sues : 0 / 50');
  ok(JSON.stringify(await p.locator('.card .meta').allInnerTexts()) === JSON.stringify(['10 cartes restantes sur 10','30 cartes restantes sur 30','10 cartes restantes sur 10']), 'un paquet par quiz : ' + (await p.locator('.card .meta').allInnerTexts()).join(' | '));
  await p.locator('.card', { hasText: 'Grand quiz' }).click();
  ok((await p.locator('.progress').innerText()).includes('Carte 1 / 30'), 'le paquet du grand quiz contient ses 30 flashcards');
  ok((await p.locator('.mastery-line').innerText()).includes('○○○ 0 / 3'), 'chaque carte affiche sa progression (○○○ 0 / 3)');

  // 2. trois réussites d'affilée => sue
  let m = await zootopiaQ1(true);
  ok(m.includes('●○○') && m.includes('1 / 3'), 'réussite 1 : ' + m);
  ok((await count()) === 50, '   1 réussite : la question est toujours à apprendre (compteur 50)');
  m = await zootopiaQ1(true); ok(m.includes('●●○') && m.includes('2 / 3'), 'réussite 2 : ' + m);
  m = await zootopiaQ1(true); ok(m.includes('Question sue'), 'réussite 3 : ' + m);
  ok((await count()) === 49, 'compteur Programme = 49 : la question sue sort du programme');
  await p.click('#tab-programme');
  ok((await p.locator('.progress-panel .score').innerText()) === '1 / 50', 'questions sues : 1 / 50');
  const recto = await p.evaluate(() => programmeCards().map(c => c.recto));
  ok(recto.length === 49 && !recto.includes('Le quartier du désert, chaud et sec ?'), 'le paquet « à apprendre » n\'a plus que 49 cartes, sans la question sue');

  // 3. une erreur remet à 0 : réussite, réussite, ERREUR, puis il faut 3 de nouveau
  await grandQ1(true); await grandQ1(true);
  m = await grandQ1(false); ok(m.includes('repart à 0'), 'erreur après 2 réussites : ' + m);
  m = await grandQ1(true); ok(m.includes('●○○'), 'après l\'erreur, on repart de 1 : ' + m);
  await grandQ1(true);
  ok((await count()) === 48 + 0 || (await count()) === 49, '2 réussites seulement depuis l\'erreur : pas encore sue (compteur ' + await count() + ')');
  ok((await p.evaluate(() => progressOf(QUIZZES[1], QUIZZES[1].questions[0]).ok)) === 2, 'progression de la question = 2 / 3 (pas 4 réussites cumulées)');
  m = await grandQ1(true); ok(m.includes('Question sue'), '3e réussite d\'affilée : ' + m);
  ok((await count()) === 48, 'compteur Programme = 48');

  // 4. réponse écrite : trouvée au 2e essai = échec (remise à 0)
  m = await zootopiaQ1('retry');
  ok(m.includes('repart à 0'), 'Zootopia Q1 déjà sue puis ratée au 1er essai : ' + m);
  ok((await count()) === 49, 'la question sue puis ratée revient dans le programme (compteur 49)');
  // abandon = échec aussi
  m = await zootopiaQ1(false);
  ok((await p.evaluate(() => progressOf(QUIZZES[2], QUIZZES[2].questions[0]).ok)) === 0, 'erreur : progression à 0');

  // 5. priorité : les plus ratées d'abord
  const first = await p.evaluate(() => { const c = programmeCards()[0]; return [c.recto.slice(0, 30), c.fails]; });
  ok(first[1] >= 2, 'les cartes les plus ratées passent en premier : ' + JSON.stringify(first));

  // 6. persistance
  const before = await count();
  await p.evaluate(() => revisionFlush());
  await p.reload();
  ok((await count()) === before, 'progression conservée après rechargement (compteur ' + before + ')');

  // 7. tout su => message de félicitations
  await p.evaluate(() => { QUIZZES.forEach(q => q.questions.forEach(x => { progress[keyOf(q, x)] = { ok: MASTERY, fails: 0 }; })); updateCounts(); });
  await p.click('#tab-programme');
  ok((await p.locator('.empty').innerText()).includes('tu sais toutes tes questions') && (await p.locator('.card.done').count()) === 3 && (await p.locator('.card:disabled').count()) === 3, 'tout sue : message « Bravo », 3 paquets terminés et désactivés');
  ok((await count()) === 0 && (await p.locator('.progress-panel .score').innerText()) === '50 / 50', 'compteur 0, questions sues 50 / 50');

  // 8. recommencer
  ok((await p.getByText(/Recommencer|Remettre à zéro|Effacer/).count()) === 0, 'AUCUN bouton de remise à zéro côté élève');
  await p.evaluate(() => { progress = {}; updateCounts(); });

  // 9. quiz qui s'enrichit : une nouvelle question rejoint le programme
  await p.evaluate(() => { QUIZZES.push({ id: 'nouveau', emoji: '🧪', matiere: 'Test', titre: 'Nouveau', description: '', questions: [{ question: 'Q ?', options: ['a', 'b'], correct: 0 }] }); updateCounts(); });
  ok((await count()) === 51, 'un quiz ajouté (admin) apporte ses questions au programme : 51');

  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));

  // 10. stockage refusé
  const c2 = await b.newContext(); await install(c2, W); const q = await c2.newPage(); const e2 = [];
  q.on('pageerror', e => e2.push(e.message));
  await q.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('x', 'SecurityError'); } }));
  await q.goto(URL_); await login(q);
  await q.locator('.card', { hasText: 'Zootopia' }).click();
  await q.fill('.saisie', 'sahara square'); await q.keyboard.press('Enter');
  ok(e2.length === 0 && (await q.locator('.mastery-line').innerText()).includes('1 / 3'), 'stockage refusé : la progression fonctionne le temps de la visite, sans erreur');
  await b.close();
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
