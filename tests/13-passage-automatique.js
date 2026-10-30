const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
for (const id of ['zootopia', 'byzance', 'byzance-30', 'musique-carnaval']) w.run('setBuiltinAssign', PW, id, ['leo']);
w.run('saveQuiz', PW, { titre: 'Champs', pour: ['leo'], questions: [
  { question: 'Analyse A', champs: [{ label: 'Hauteur', reponses: ['grave'] }, { label: 'Durée', reponses: ['lent'] }] },
  { question: 'Analyse B', champs: [{ label: 'Hauteur', reponses: ['aigu'] }, { label: 'Durée', reponses: ['rapide'] }] },
  { question: 'Analyse C', champs: [{ label: 'Nuance', reponses: ['forte'] }, { label: 'Mode', reponses: ['legato'] }] }] });
const ZOO = ['sahara square', 'tundratown', 'downtown', 'rainforest district', 'skyscrapers', 'sand dunes', 'waterfall', 'raffe', 'el', 'humid'];

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1000, height: 1100 } });
  await install(c, w, { auto: true });          // passage automatique ACTIVÉ (comportement réel)
  const errs = [];
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  const label = async () => (await p.locator('.progress span').first().innerText()).trim();
  const open = async name => { await p.evaluate(() => { activeTab = 'quiz'; renderList(); }); await p.locator('.card.lecon', { hasText: name }).click(); };
  const correctText = async () => p.evaluate(() => { const t = document.querySelector('.question').textContent; for (const q of QUIZZES.flatMap(x => x.questions)) if (q.question === t && q.options) return q.options[q.correct]; });
  const clickOption = async (good) => { const c = await correctText(); const t = (await p.locator('.option').allInnerTexts()).find(x => good ? x === c : x !== c); await p.locator('.option', { hasText: new RegExp('^' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).click(); };
  const waitLabel = async (txt, ms) => p.waitForFunction(t => document.querySelector('.progress span')?.textContent.trim().startsWith(t), txt, { timeout: ms });

  // ---------- QCM, bonne réponse : on passe seul à la suivante ----------
  await open('Byzance et l\'Europe');                                // 10 QCM, sans explication
  ok((await label()).startsWith('Question 1 /'), 'départ : ' + await label());
  const t0 = Date.now();
  await clickOption(true);
  ok(await p.locator('.option.correct').isVisible() && (await p.locator('.mastery-line').innerText()).includes('1 / 2') && (await p.locator('.auto-next').evaluate(e => getComputedStyle(e).display)) === 'block', 'juste après le clic : la bonne réponse est en VERT, la progression « ' + (await p.locator('.mastery-line').innerText()).trim().slice(0, 40) + ' » et la barre d\'attente s\'affichent');
  ok((await label()).startsWith('Question 1 /'), 'on reste un instant sur la question (pas de saut immédiat)');
  await waitLabel('Question 2', 4000); const dt = Date.now() - t0;
  ok(dt >= 800 && dt < 2500, 'PASSAGE AUTOMATIQUE à la question 2, sans aucun clic, après ' + dt + ' ms');
  ok((await p.locator('.score').innerText()) === 'Score : 1', 'le score a bien compté la bonne réponse (« Score : 1 »)');

  // ---------- QCM, mauvaise réponse : pas de passage automatique ----------
  await clickOption(false);
  await p.waitForTimeout(2600);
  ok((await label()).startsWith('Question 2 /') && await p.locator('.btn:visible', { hasText: 'Question suivante' }).isVisible() && (await p.locator('.auto-next').evaluate(e => getComputedStyle(e).display)) === 'none', 'MAUVAISE réponse : on reste sur la question, bouton « Question suivante » à cliquer, pas de barre d\'attente (2,6 s plus tard)');
  ok(await p.locator('.option.incorrect').isVisible() && (await p.locator('.mastery-line').innerText()).includes('repart à 0'), 'la bonne réponse et le message restent affichés pour qu\'il puisse les lire');
  await p.locator('.btn:visible', { hasText: 'Question suivante' }).click();
  ok((await label()).startsWith('Question 3 /'), 'après son clic : question 3');

  // ---------- cliquer pendant l'attente : une seule avancée ----------
  await clickOption(true); await p.locator('.btn:visible', { hasText: 'Question suivante' }).click();
  ok((await label()).startsWith('Question 4 /'), 'clic sur « Question suivante » pendant l\'attente : question 4 tout de suite');
  await p.waitForTimeout(2400);
  ok((await label()).startsWith('Question 4 /'), 'et le minuteur ne fait PAS sauter une question de plus (toujours question 4 après 2,4 s)');

  // ---------- quitter pendant l'attente ----------
  await clickOption(true); await p.click('.back');
  await p.waitForTimeout(2400);
  ok(await p.locator('.home-question').isVisible() && (await p.locator('.question').count()) === 0, 'retour aux leçons pendant l\'attente : on reste sur la liste, le quiz ne se relance pas tout seul');

  // ---------- dernière question : direction le résultat ----------
  await open('Zootopia');
  for (let i = 0; i < 9; i++) { await p.fill('.saisie', ZOO[i]); await p.keyboard.press('Enter'); await waitLabel('Question ' + (i + 2), 4000); }
  ok((await label()).startsWith('Question 10 /'), 'RÉPONSE ÉCRITE : 9 bonnes réponses du premier coup, enchaînées sans aucun clic sur « suivante » (Question 10)');
  await p.fill('.saisie', ZOO[9]); await p.keyboard.press('Enter');
  await p.waitForSelector('.final', { timeout: 4000 });
  ok((await p.locator('.final').innerText()).trim() === '10 / 10', 'la dernière bonne réponse mène directement à l\'écran de résultat (10 / 10)');
  await p.evaluate(() => revisionFlush());
  ok(w.run('adminData', PW).progress.leo.find(x => x.id === 'zootopia').fois === 1, 'la partie est bien comptée côté serveur (fait 1 fois)');

  // ---------- réponse écrite avec erreur : on reste ----------
  await p.click('text=Retour aux leçons'); await p.waitForSelector('.home-question');
  await open('Zootopia');
  await p.fill('.saisie', 'faux'); await p.keyboard.press('Enter'); await p.fill('.saisie', ZOO[0]); await p.keyboard.press('Enter');
  await p.waitForTimeout(2600);
  ok((await label()).startsWith('Question 1 /') && (await p.locator('.feedback').innerText()).includes('sans point') && await p.locator('.btn:visible', { hasText: 'Question suivante' }).isVisible(), 'trouvée au 2e essai (sans point) : PAS de passage automatique, il lit le message (« sans point ») et clique');
  await p.click('.back');

  // ---------- plusieurs champs ----------
  await open('Champs');
  const fill = async (v) => { const ins = p.locator('.saisie.champ'); for (let k = 0; k < v.length; k++) { if (!(await ins.nth(k).isDisabled())) await ins.nth(k).fill(v[k]); } await p.locator('.panel .btn', { hasText: 'Valider' }).click(); };
  await fill(['grave', 'lent']);
  ok(await p.locator('.feedback.ok').isVisible(), 'plusieurs champs, tout juste du premier coup : « ' + (await p.locator('.feedback').innerText()).trim() + ' »');
  await waitLabel('Question 2', 4000);
  ok(true, 'PLUSIEURS CHAMPS : passage automatique à la question 2');
  await fill(['aigu', 'faux']); await fill(['', 'rapide']);
  await p.waitForTimeout(2600);
  ok((await label()).startsWith('Question 2 /') && (await p.locator('.feedback').innerText()).includes('sans point'), 'plusieurs champs corrigés au 2e essai (sans point) : pas de passage automatique');
  await p.locator('.btn:visible', { hasText: 'Question suivante' }).click();
  await fill(['forte', 'legato']);
  await p.waitForSelector('.final', { timeout: 4000 });
  ok((await p.locator('.final').innerText()).trim() === '2 / 3', 'dernière question à champs juste : directement le résultat (2 / 3)');
  await p.click('text=Retour aux leçons');

  // ---------- question avec explication et question qui devient « sue » : attente plus longue ----------
  await open('Grand quiz');
  await clickOption(true);                                     // question 1 du grand quiz : avec explication
  await p.waitForTimeout(1300);
  ok((await label()).startsWith('Question 1 /') && await p.locator('.explication').isVisible(), 'question AVEC explication : après 1,3 s on est encore dessus et l\'explication est lisible');
  await waitLabel('Question 2', 4000);
  ok(true, 'puis passage automatique (attente plus longue : 1,8 s)');
  await p.click('.back');

  // ---------- la progression et la fin de partie fonctionnent comme avant ----------
  ok((await p.evaluate(() => { const q = QUIZZES.find(x => x.id === 'zootopia'); return progressOf(q, q.questions[1]).ok; })) === 1, 'la progression est enregistrée comme avant (Q2 de Zootopia : 1 / 2)');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
