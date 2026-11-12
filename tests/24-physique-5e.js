// Les 4 leçons de physique-chimie 5ᵉ : 60 questions, corrigé accepté, décimales « 0,25 » = « 0.25 » (mais ≠ « 25 »)
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
const IDS = ['pc5-melanges', 'pc5-conversions', 'pc5-solubilite', 'pc5-graphiques'];
IDS.forEach(id => w.run('setBuiltinAssign', PW, id, ['leo']));
const Q = IDS.map(id => w.ctx.BUILTIN_QUIZZES.find(q => q.id === id));
(async () => {
  ok(Q.every(q => q && q.questions.length === 15 && q.matiere === 'Physique-chimie'), '4 leçons de 15 questions, matière Physique-chimie');
  ok(Q.every(q => q.questions.every(x => x.options ? x.correct >= 0 && x.correct < x.options.length : (x.reponses || x.champs))), 'chaque question a sa bonne réponse');
  ok(new Set(Q.flatMap(q => q.questions.map(x => w.ctx.qhash_(x.question)))).size === 60, 'les 60 énoncés sont tous différents');
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1000, height: 900 } }); await install(c, w);
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  ok((await p.locator('.card.lecon').count()) === 4, 'l\'élève voit ses 4 leçons');
  const res = () => p.evaluate(() => window.revisionPreviewResult);
  const refused = [];
  for (const quiz of Q) {
    for (let i = 0; i < 15; i++) {
      const q = quiz.questions[i];
      await p.evaluate(([id, i, st]) => revisionPreview(id, i, st), [quiz.id, i, q.options ? 'qcm' : 'rappel']);
      if (q.options) await p.locator('.option').filter({ hasText: new RegExp('^' + q.options[q.correct].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).click();
      else if (q.champs) { const ins = p.locator('.saisie.champ'); for (let k = 0; k < q.champs.length; k++) await ins.nth(k).fill(q.champs[k].reponses[0]); await p.locator('.panel .btn', { hasText: 'Valider' }).click(); }
      else { await p.fill('.saisie', q.reponses[0]); await p.keyboard.press('Enter'); }
      if (!(await res())) refused.push(quiz.id + ' #' + (i + 1));
    }
  }
  ok(refused.length === 0, 'corrigé saisi : les 60 réponses acceptées ' + JSON.stringify(refused));
  // décimales et unités (leçon 2, question 7 : 250 g = 0,25 kg)
  const tryTyped = async (quizId, i, v) => { await p.evaluate(([id, i]) => revisionPreview(id, i, 'rappel'), [quizId, i]); await p.fill('.saisie', v); await p.keyboard.press('Enter'); return res(); };
  ok(await tryTyped('pc5-conversions', 6, '0.25') && await tryTyped('pc5-conversions', 6, '0,25 kg') && await tryTyped('pc5-conversions', 6, '0,25kg'), '« 0.25 », « 0,25 kg », « 0,25kg » acceptés');
  ok(!(await tryTyped('pc5-conversions', 6, '25')) && !(await tryTyped('pc5-conversions', 6, '2,5')), '« 25 » et « 2,5 » refusés (la virgule compte)');
  ok(await tryTyped('pc5-conversions', 12, '1,50') && !(await tryTyped('pc5-conversions', 12, '15')), 'coefficient : « 1,50 » accepté, « 15 » refusé');
  ok(await tryTyped('pc5-solubilite', 4, '2 000') && await tryTyped('pc5-solubilite', 4, '2000 g/L'), 'solubilité : « 2 000 » et « 2000 g/L » acceptés');
  ok(await tryTyped('pc5-melanges', 10, 'CO2') && await tryTyped('pc5-melanges', 10, 'Dioxyde de carbone'), 'gaz des boissons : « CO2 » ou « Dioxyde de carbone »');
  // questions Oui / Non : pas de choix ajoutés au rappel
  await p.evaluate(() => revisionPreview('pc5-melanges', 9, 'rappel')); await p.locator('.masked-btns .btn').first().click();
  ok((await p.locator('.option').count()) === 2, 'question Oui / Non en rappel : toujours 2 choix');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
