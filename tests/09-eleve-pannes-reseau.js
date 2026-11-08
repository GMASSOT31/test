// Pannes réseau pendant une séance : 3 essais, ordre conservé, avertissement, pas d'insistance sur une erreur d'identifiants
const { chromium } = require('playwright');
const { makeWorld, bridge, ok, summary, login, LEO, PW, SRC, startLesson, answerCurrent } = require('./harness');

(async () => {
  const w = makeWorld();
  w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('setBuiltinAssign', PW, 'zootopia', ['leo']);
  // pont avec pannes simulées sur « answer »
  let failures = 0; const log = [];
  const call = async (fn, args) => {
    if (fn === 'answer') { log.push(args[6] + ':' + args[4].slice(0, 4)); if (failures > 0) { failures--; return { err: 'Service indisponible' }; } }
    return w.call(fn, args);
  };
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1000, height: 900 } });
  await c.exposeFunction('__srv', call); await c.addInitScript(bridge); await c.addInitScript('window.revisionAutoNext = false;');
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  const sync = async () => (await p.locator('#sync-status').innerText()).trim();
  const level = i => p.evaluate(i => { const z = QUIZZES[0]; return itemOf(z, z.questions[i])[0]; }, i);
  const cur = () => p.evaluate(() => { const t = document.querySelector('.panel.session .question').textContent; return QUIZZES[0].questions.findIndex(x => x.question === t); });
  await startLesson(p, 'Zootopia');                     // « déjà travaillée » : un QCM par question
  const srv = () => JSON.parse(w.props['srs_leo__zootopia'] || '{"it":{}}').it;

  // 1. panne passagère : 2 échecs puis succès
  failures = 2; let qi = await cur(); await answerCurrent(p, true, { next: false });
  ok((await level(qi)) === 1, 'pendant la panne, la page compte déjà la question comme découverte : l\'élève n\'est pas bloqué');
  await p.evaluate(() => revisionFlush());
  ok(Object.keys(srv()).length === 1 && log.filter(x => x.startsWith('true')).length === 3 && (await sync()) === '✅ Progression enregistrée', 'PANNE PASSAGÈRE : 3 tentatives (2 échecs, 1 succès), « Progression enregistrée »');
  await p.click('.next-btn');

  // 2. l'ordre des envois est conservé
  log.length = 0;
  await answerCurrent(p, true); await answerCurrent(p, false, { next: false });
  await p.evaluate(() => revisionFlush());
  ok(/^true:.{4},false:.{4}$/.test(log.join(',')), 'ordre des envois conservé : ' + log.join(' → '));
  const it = Object.values(srv());
  ok(it.length === 3 && it.filter(v => v[0] === 1).length === 2 && it.filter(v => v[0] === 0 && v[2] === 1).length === 1, 'serveur : 2 questions découvertes, 1 ratée (0, une erreur)');
  await p.click('.next-btn');

  // 3. panne durable : avertissement visible, puis il disparaît au prochain succès
  failures = 99; log.length = 0; qi = await cur();
  await answerCurrent(p, true, { next: false }); await p.evaluate(() => revisionFlush());
  ok(log.length === 3 && (await sync()).includes('Sauvegarde en attente') && (await sync()).includes('pas pu être enregistrée'), 'PANNE DURABLE : 3 tentatives puis « ' + await sync() + ' »');
  ok((await level(qi)) === 1, 'et la page continue de compter la progression localement');
  failures = 0; await p.click('.next-btn');
  await answerCurrent(p, true, { next: false }); await p.evaluate(() => revisionFlush());
  ok((await sync()) === '✅ Progression enregistrée', 'dès qu\'un envoi réussit : « Progression enregistrée »');

  // 4. une erreur d'identifiants n'est pas rejouée (pas de blocage de compte par insistance)
  log.length = 0; w.run('saveStudent', PW, { id: 'leo', classe: '5B', pseudo: 'Léo', pin: '7777' });   // le PIN change pendant la séance
  await p.click('.next-btn'); await answerCurrent(p, true, { next: false }); await p.evaluate(() => revisionFlush());
  ok(log.length === 1 && (await sync()).includes('pas pu être enregistrée'), 'PIN changé en cours de séance : 1 seule tentative, avertissement affiché');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
