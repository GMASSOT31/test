// Passage automatique après une bonne réponse du premier coup (1 s, 1,8 s avec explication) ; jamais après une erreur ;
// un clic manuel n'est jamais suivi d'un second saut ; quitter pendant l'attente est sans effet.
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC, startLesson } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
for (const id of ['byzance', 'byzance-30']) w.run('setBuiltinAssign', PW, id, ['leo']);

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1000, height: 1100 } });
  await install(c, w, { auto: true });          // passage automatique ACTIVÉ (comportement réel)
  const errs = [];
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  const qtext = () => p.locator('.panel.session .question').innerText().catch(() => '');
  const right = () => p.evaluate(() => { const t = document.querySelector('.panel.session .question').textContent; for (const q of QUIZZES.flatMap(x => x.questions)) if (q.question === t) return q.options[q.correct]; });
  const click = async good => { const r = await right(); const t = (await p.locator('.option').allInnerTexts()).find(x => good ? x === r : x !== r); await p.locator('.option').filter({ hasText: t }).first().click(); };

  await startLesson(p, 'Byzance et l\'Europe');      // déjà travaillée : un QCM par question, sans explication
  // ---- bonne réponse : on reste un instant puis on passe seul ----
  let q1 = await qtext();
  await click(true);
  ok(await p.locator('.option.correct').isVisible() && (await p.locator('.auto-next').evaluate(e => getComputedStyle(e).display)) === 'block', 'juste : la bonne réponse en vert et la barre d\'attente');
  ok((await qtext()) === q1, 'on reste un instant sur la question');
  await p.waitForFunction(t => document.querySelector('.panel.session .question')?.textContent !== t, q1, { timeout: 3000 });
  ok(true, 'puis passage automatique à la question suivante (environ 1 s)');
  // ---- clic manuel avant la fin de l'attente : un seul saut ----
  const seq = [await qtext()];
  await click(true); await p.click('.next-btn');
  seq.push(await qtext());
  await p.waitForTimeout(1600);
  seq.push(await qtext());
  ok(seq[1] !== seq[0] && seq[2] === seq[1], 'clic manuel pendant l\'attente : la question suivante s\'affiche et le minuteur ne saute pas une question de plus');
  // ---- erreur : pas de passage automatique ----
  const qe = await qtext();
  await click(false);
  await p.waitForTimeout(2200);
  ok((await qtext()) === qe && await p.locator('.next-btn').isVisible() && (await p.locator('.auto-next').evaluate(e => getComputedStyle(e).display)) === 'none', 'erreur : on reste sur la question (bouton « Continuer »), aucune avance automatique');
  await p.click('.next-btn');
  // ---- quitter pendant l'attente : rien ne casse ----
  await click(true); await p.click('text=Arrêter');
  await p.waitForTimeout(1500);
  ok(await p.locator('.result').isVisible() && (await p.locator('.result h2').innerText()) === 'Séance arrêtée', 'quitter pendant l\'attente : le bilan reste affiché (le minuteur ne relance rien)');
  await p.click('text=Retour aux leçons');

  // ---- question avec explication : attente plus longue ----
  await startLesson(p, 'Grand quiz');
  const qx = await qtext();
  await click(true);
  await p.waitForTimeout(1300);
  ok((await qtext()) === qx && await p.locator('.explication').isVisible(), 'avec explication : après 1,3 s on est encore dessus et l\'explication est lisible');
  await p.waitForFunction(t => document.querySelector('.panel.session .question')?.textContent !== t, qx, { timeout: 3000 });
  ok(true, 'puis passage automatique (attente plus longue : 1,8 s)');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
