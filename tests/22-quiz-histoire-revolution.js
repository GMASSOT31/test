// Quiz intégré « De 1789 à l'exécution du Roi » : 30 questions (QCM, réponses écrites, champs), corrigé du cahier accepté
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
const Q = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'histoire-revolution');
(async () => {
  ok(Q && Q.questions.length === 30 && Q.matiere === 'Histoire', 'quiz intégré : 30 questions');
  ok(w.run('adminData', PW).builtins.some(q => q.id === 'histoire-revolution' && q.questions === 30 && q.pour.length === 0), 'listé dans l\'administration, attribué à personne');
  ok(Q.questions.every(q => q.question && (q.options ? q.options.length >= 2 && q.correct >= 0 && q.correct < q.options.length : (q.reponses || q.champs))), 'chaque question a sa bonne réponse');
  w.run('setBuiltinAssign', PW, 'histoire-revolution', ['leo']);
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1000, height: 900 } }); await install(c, w);
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  await p.locator('.card.lecon', { hasText: "exécution du Roi" }).click();
  const types = { qcm: 0, texte: 0, champs: 0 };
  for (const q of Q.questions) {
    if (q.options) { types.qcm++; await p.locator('.option', { hasText: new RegExp('^' + q.options[q.correct].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).click(); }
    else if (q.champs) { types.champs++; const ins = p.locator('.saisie.champ'); for (let k = 0; k < q.champs.length; k++) await ins.nth(k).fill(q.champs[k].reponses[0]); await p.locator('.panel .btn', { hasText: 'Valider' }).click(); }
    else { types.texte++; await p.fill('.saisie', q.reponses[0]); await p.keyboard.press('Enter'); }
    if (!(await p.locator('.feedback.ok, .option.correct').count())) throw new Error('refusée avec le corrigé : ' + q.question.slice(0, 70));
    await p.locator('.panel .btn', { hasText: /suivante|résultat/ }).click();
  }
  ok((await p.locator('.final').innerText()) === '30 / 30', 'corrigé du cahier saisi : 30 / 30 (' + JSON.stringify(types) + ')');
  // variantes acceptées
  const t = (re, vals) => Q.questions.find(q => re.test(q.question));
  const sameAs = (q, v) => (q.reponses || []).some(r => r.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  ok(sameAs(t(/prêtres/), 'Le Clergé') && sameAs(t(/guillotiné/), '1793') && sameAs(t(/arrêté lors/), 'Varennes'), 'variantes (majuscules, article, accents) acceptées pour les réponses écrites');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
