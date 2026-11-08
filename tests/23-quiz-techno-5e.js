// Quiz intégré « Technologie 5e » : 40 questions (QCM, réponses écrites, champs), corrigé accepté
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
const Q = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'techno-5e-numerique');
(async () => {
  ok(Q && Q.questions.length === 40 && Q.matiere === 'Technologie', 'quiz intégré : 40 questions');
  ok(w.run('adminData', PW).builtins.some(q => q.id === 'techno-5e-numerique' && q.questions === 40 && q.pour.length === 0), 'listé dans l\'administration, attribué à personne');
  ok(Q.questions.every(q => q.question && (q.options ? q.options.length >= 2 && q.correct >= 0 && q.correct < q.options.length : (q.reponses || q.champs))), 'chaque question a sa bonne réponse');
  w.run('setBuiltinAssign', PW, 'techno-5e-numerique', ['leo']);
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1000, height: 900 } }); await install(c, w);
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  const types = { qcm: 0, texte: 0, champs: 0 }, refused = [];
  for (let i = 0; i < Q.questions.length; i++) {
    const q = Q.questions[i];
    await p.evaluate(([i, st]) => revisionPreview('techno-5e-numerique', i, st), [i, q.options ? 'qcm' : 'rappel']);
    if (q.options) { types.qcm++; await p.locator('.option', { hasText: new RegExp('^' + q.options[q.correct].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).click(); }
    else if (q.champs) { types.champs++; const ins = p.locator('.saisie.champ'); for (let k = 0; k < q.champs.length; k++) await ins.nth(k).fill(q.champs[k].reponses[0]); await p.locator('.panel .btn', { hasText: 'Valider' }).click(); }
    else { types.texte++; await p.fill('.saisie', q.reponses[0]); await p.keyboard.press('Enter'); }
    if (!(await p.evaluate(() => window.revisionPreviewResult))) refused.push(i + 1);
  }
  ok(refused.length === 0, 'corrigé saisi : 40 / 40 acceptées (' + JSON.stringify(types) + ') ' + JSON.stringify(refused));
  // variantes acceptées pour les réponses écrites
  const norm = v => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const typed = Q.questions.filter(q => q.reponses);
  ok(typed.length === 4 && typed.some(q => q.reponses.map(norm).includes('antivirus')) && typed.some(q => q.reponses.includes('3018')) && typed.some(q => q.reponses.includes('3020')), 'réponses écrites : antivirus, 3018, 3020, routeur (avec variantes)');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
