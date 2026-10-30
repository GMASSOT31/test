// Réseau : réponse perdue après exécution (rejeu par identifiant d'opération), évaluation de carte perdue, réessai sans tout recommencer
const { chromium } = require('playwright');
const { makeWorld, bridge, ok, summary, login, LEO, PW, SRC } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
const Q = w.run('saveQuiz', PW, { titre: 'Deux', matiere: 'Test', emoji: '2️⃣', pour: ['leo'], questions: [{ question: 'Un ?', reponses: ['un'] }, { question: 'Deux ?', reponses: ['deux'] }] });
const Lc = ['5B', 'Léo', '1234'];
const QI = w.run('adminData', PW).quizzes.find(q => q.titre === 'Deux').id;
const pc = () => w.run('getStudentData', ...Lc).parcours[QI];

(async () => {
  // le serveur exécute l'appel mais la réponse est perdue (échec côté page) : déclenché sur demande
  let loseResponse = {}, failCard = 0; const log = [];
  const call = async (fn, args) => {
    log.push(fn);
    if (fn === 'rateCard' && failCard > 0) { failCard--; return { err: 'Service indisponible' }; }
    const res = await w.call(fn, args);
    if (loseResponse[fn] > 0) { loseResponse[fn]--; return { err: 'Réponse perdue' }; }
    return res;
  };
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1000, height: 900 } });
  await c.exposeFunction('__srv', call); await c.addInitScript(bridge); await c.addInitScript('window.revisionAutoNext = false;');
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  const sync = () => p.evaluate(() => revisionFlush());
  const nextBtn = () => p.locator('.panel .btn', { hasText: /suivante|résultat/ });
  await p.locator('.card.lecon', { hasText: 'Deux' }).click();

  // 1. le serveur enregistre la réponse mais la réponse se perd : le rejeu (même opId) ne compte pas deux fois
  loseResponse = { saveResult: 1 };
  await p.fill('.saisie', 'faux'); await p.keyboard.press('Enter'); await sync();
  ok(JSON.stringify(JSON.parse(w.props['prog_leo__' + QI]).q[Object.keys(JSON.parse(w.props['prog_leo__' + QI]).q)[0]]) === '[0,1]', 'réponse perdue puis rejouée : UNE seule erreur côté serveur');
  await p.click('text=Je ne sais pas'); await nextBtn().click();
  await p.fill('.saisie', 'deux'); await p.keyboard.press('Enter'); await nextBtn().click();
  // 2. fin de passage : la réponse de finishQuiz se perd, le rejeu ne compte pas une 2e partie
  loseResponse = { finishQuiz: 1 };
  await p.locator('.actions .btn', { hasText: 'Revoir mes cartes' }).waitFor({ timeout: 15000 });
  await sync();
  ok(w.run('getStudentData', ...Lc).fois[QI] === 1 && pc().etape === 'cartes_ciblees', 'finishQuiz rejoué après réponse perdue : compteur 1 (pas 2), cartes_ciblees');

  // 3. carte Trouvé non enregistrée (3 échecs) : la fin est refusée, puis le réessai renvoie les évaluations sans recommencer
  await p.click('.actions .btn:has-text("Revoir mes cartes")');
  ok((await p.locator('.cards-count').innerText()).includes('encore à revoir 1'), 'une seule carte ciblée (la 1re question, ratée)');
  failCard = 3;
  await p.click('.flip-btn'); await p.click('.eval-btn.trouve'); await sync();
  ok((await p.locator('#sync-status').innerText()).includes('Sauvegarde en attente'), 'message « Sauvegarde en attente » : « ' + await p.locator('#sync-status').innerText() + ' »');
  ok((await p.locator('.finish-btn').innerText()) === 'Vérifier mes réponses' && pc().etape === 'cartes_ciblees', 'localement tout est Trouvé, mais le serveur n\'a pas validé la fin');
  await p.click('.finish-btn'); await sync();
  await p.waitForFunction(() => document.querySelector('.etape-msg').textContent.includes('Sauvegarde en attente'));
  ok(pc().etape === 'cartes_ciblees' && (await p.locator('.etape-msg').innerText()).includes('on la renvoie') && (await p.locator('.finish-btn').isEnabled()), 'fin refusée par le serveur : message, bouton réactivé, on renvoie l\'évaluation (« ' + (await p.locator('.etape-msg').innerText()).slice(0, 90) + ' »)');
  await sync();
  await p.click('.finish-btn'); await sync();
  await p.locator('.etape-banner').waitFor();
  ok(pc().etape === 'verification' && (await p.locator('.etape-banner').innerText()).startsWith('Vérification'), 'réessai : la pile est validée sans la recommencer, vérification lancée');
  ok(await p.locator('#sync-status').innerText().then(t => t.includes('Progression enregistrée') || t === ''), 'après succès : « Progression enregistrée »');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
