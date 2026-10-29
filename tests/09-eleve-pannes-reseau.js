const { chromium } = require('playwright');
const { makeWorld, bridge, ok, summary, login, LEO, PW, SRC } = require('./harness');

(async () => {
  const w = makeWorld();
  w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('setBuiltinAssign', PW, 'zootopia', ['leo']);
  // pont avec pannes simulées sur saveResult
  let failures = 0; const log = [];
  const call = async (fn, args) => {
    if (fn === 'saveResult') { log.push(args[5] + ':' + args[4].slice(0, 4)); if (failures > 0) { failures--; return { err: 'Service indisponible' }; } }
    return w.call(fn, args);
  };
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1000, height: 900 } });
  await c.exposeFunction('__srv', call); await c.addInitScript(bridge); await c.addInitScript('window.revisionAutoNext = false;');
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  const sync = async () => (await p.locator('#sync-status').innerText()).trim();
  const answer = async (txt) => { await p.fill('.saisie', txt); await p.keyboard.press('Enter'); await p.locator('.panel .btn', { hasText: /suivante|résultat/ }).click(); };
  await p.locator('.card', { hasText: 'Zootopia' }).click();
  const srv = () => Object.keys(w.props).filter(k => k.startsWith('prog_leo__')).length;

  // 1. panne passagère : 2 échecs puis succès
  failures = 2; await p.fill('.saisie', 'sahara square'); await p.keyboard.press('Enter');
  ok(await p.evaluate(() => { const z = QUIZZES[0]; return progressOf(z, z.questions[0]).ok === 1; }), 'pendant la panne, la page affiche quand même la progression (1 / 3) : l\'élève n\'est pas bloqué');
  await p.evaluate(() => revisionFlush());
  ok(srv() === 1 && log.length === 3 && (await sync()) === '', 'PANNE PASSAGÈRE : 3 tentatives (2 échecs, 1 succès), résultat finalement enregistré, aucun avertissement');
  await p.locator('.panel .btn', { hasText: /suivante/ }).click();

  // 2. l'ordre des envois est conservé
  log.length = 0;
  await answer('tundratown');                                                    // Q2 : juste du 1er coup
  await p.fill('.saisie', 'faux'); await p.keyboard.press('Enter');             // Q3 : 1re erreur…
  await p.fill('.saisie', 'downtown'); await p.keyboard.press('Enter');         // … puis la bonne réponse (sans point)
  await p.evaluate(() => revisionFlush());
  ok(/^true:.{4},false:.{4}$/.test(log.join(',')), 'ordre des envois conservé : ' + log.join(' → '));
  const z = JSON.parse(w.props['prog_leo__zootopia']).q;
  ok(Object.keys(z).length === 3 && Object.values(z).filter(v => v[0] === 1 && v[1] === 0).length === 2 && Object.values(z).filter(v => v[0] === 0 && v[1] === 1).length === 1, 'serveur : Q1 et Q2 réussies (1 / 3), Q3 ratée au 1er essai (remise à 0, 1 erreur) → ' + JSON.stringify(z));

  // 3. panne durable : avertissement visible, puis il disparaît au prochain succès
  await p.locator('.panel .btn', { hasText: /suivante/ }).click();
  failures = 99; log.length = 0;
  await p.fill('.saisie', 'rainforest district'); await p.keyboard.press('Enter'); await p.evaluate(() => revisionFlush());
  ok(log.length === 3 && (await sync()).includes('pas pu être enregistrée'), 'PANNE DURABLE : 3 tentatives puis avertissement « ' + await sync() + ' »');
  ok(await p.evaluate(() => { const q = QUIZZES[0]; return progressOf(q, q.questions[3]).ok === 1; }), 'et la page continue de compter la progression localement');
  failures = 0; await p.locator('.panel .btn', { hasText: /suivante/ }).click();
  await p.fill('.saisie', 'skyscrapers'); await p.keyboard.press('Enter'); await p.evaluate(() => revisionFlush());
  ok((await sync()) === '', 'dès qu\'un envoi réussit, l\'avertissement disparaît');

  // 4. une erreur d'authentification n'est pas rejouée (pas de blocage de compte par insistance)
  log.length = 0; w.run('saveStudent', PW, { id: 'leo', classe: '5B', pseudo: 'Léo', pin: '7777' });   // le PIN change pendant que l'élève joue
  await p.locator('.panel .btn', { hasText: /suivante/ }).click(); await p.fill('.saisie', 'sand dunes'); await p.keyboard.press('Enter'); await p.evaluate(() => revisionFlush());
  ok(log.length === 1 && (await sync()).includes('pas pu être enregistrée'), 'PIN changé en cours de partie : 1 seule tentative (pas d\'insistance), avertissement affiché');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
