const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, EMMA, PW, SRC } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('saveStudent', PW, { classe: '5B', pseudo: 'Emma', pin: '4321' });
w.run('setBuiltinAssign', PW, 'zootopia', ['leo', 'emma']); w.run('setBuiltinAssign', PW, 'byzance', ['leo']);
const Lc = ['5B', 'Léo', '1234'], Ec = ['5B', 'Emma', '4321'];
const ZOO = ['sahara square', 'tundratown', 'downtown', 'rainforest district', 'skyscrapers', 'sand dunes', 'waterfall', 'raffe', 'el', 'humid'];

(async () => {
  // ---------- serveur ----------
  ok(w.run('finishQuiz', ...Lc, 'zootopia').n === 1 && w.run('finishQuiz', ...Lc, 'zootopia').n === 2, 'finishQuiz : 1 puis 2 (cumulé)');
  ok(w.run('finishQuiz', ...Ec, 'zootopia').n === 1, 'le compteur d\'Emma est indépendant de celui de Léo');
  ok(w.try('finishQuiz', ...Ec, 'byzance').err === 'Quiz inaccessible.', 'Emma ne peut pas compter une partie sur un quiz qu\'elle n\'a pas');
  ok(w.try('finishQuiz', '5B', 'Léo', '0000', 'zootopia').err === 'Classe, pseudo ou PIN incorrect.', 'refusé avec un mauvais PIN');
  ok(w.try('finishQuiz', ...Lc, 'inexistant').err === 'Quiz inaccessible.' && w.try('finishQuiz', ...Lc, '__proto__').err === 'Quiz inaccessible.', 'quiz inconnu ou piégé refusé');
  ok(JSON.stringify(w.run('getStudentData', ...Lc).fois) === '{"zootopia":2}' && JSON.stringify(w.run('getStudentData', ...Ec).fois) === '{"zootopia":1}', 'getStudentData renvoie les compteurs : Léo ' + JSON.stringify(w.run('getStudentData', ...Lc).fois) + ', Emma ' + JSON.stringify(w.run('getStudentData', ...Ec).fois));
  const adm = w.run('adminData', PW);
  const lz = adm.progress.leo.find(x => x.id === 'zootopia'), lb = adm.progress.leo.find(x => x.id === 'byzance');
  ok(lz.fois === 2 && lz.derniere > 0 && lb.fois === 0 && lb.derniere === 0, 'adminData : Zootopia fait 2 fois (date de la dernière), Byzance jamais fait');
  w.run('saveResult', ...Lc, 'zootopia', w.ctx.qhash_(w.ctx.BUILTIN_QUIZZES[2].questions[0].question), true);
  w.run('resetProgress', PW, 'leo', 'zootopia');
  ok(w.run('adminData', PW).progress.leo.find(x => x.id === 'zootopia').fois === 2, 'remise à zéro d\'une leçon : la progression disparaît, le compteur « fait 2 fois » est CONSERVÉ');
  w.run('resetProgress', PW, 'leo', 'all'); w.run('resetProgress', PW, 'all', 'all');
  ok(w.run('adminData', PW).progress.leo.find(x => x.id === 'zootopia').fois === 2 && w.run('adminData', PW).progress.emma.find(x => x.id === 'zootopia').fois === 1, 'même après « tout remettre à zéro » : compteurs conservés (Léo 2, Emma 1)');
  ok(Object.keys(w.props).filter(k => k.startsWith('done_')).sort().join() === 'done_emma__zootopia,done_leo__zootopia', 'stockage : une propriété par élève et par quiz');
  const custom = w.run('saveQuiz', PW, { titre: 'Maths', questions: [{ question: 'q ?', options: ['a', 'b'], correct: 0 }], pour: ['emma'] });
  w.run('finishQuiz', ...Ec, custom.id);
  ok(w.run('getStudentData', ...Ec).fois[custom.id] === 1, 'compteur aussi sur un quiz créé depuis l\'administration');
  w.run('deleteQuiz', PW, custom.id);
  ok(!Object.keys(w.props).some(k => k.startsWith('done_') && k.endsWith('__' + custom.id)) && Object.keys(w.props).some(k => k.startsWith('done_leo__zootopia')), 'supprimer un quiz efface ses compteurs, pas ceux des autres quiz');

  // ---------- page élève ----------
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1000, height: 1000 } }); await install(c, w);
  const errs = [];
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  const label = async name => (await p.locator('.card', { hasText: name }).locator('.fois').innerText()).trim();
  ok((await label('Zootopia')) === '🔁 Fait 2 fois' && (await label('Byzance')) === 'Pas encore fait', 'ÉTIQUETTES sur les quiz de Léo : Zootopia « ' + await label('Zootopia') + ' », Byzance « ' + await label('Byzance') + ' »');
  ok(await p.locator('.card .fois').count() === 2, 'une étiquette sur CHAQUE quiz');
  // partie abandonnée : ne compte pas
  await p.locator('.card', { hasText: 'Zootopia' }).click(); await p.fill('.saisie', ZOO[0]); await p.keyboard.press('Enter'); await p.click('.back');
  ok((await label('Zootopia')) === '🔁 Fait 2 fois', 'une partie abandonnée en cours de route ne compte PAS');
  // partie terminée : compte
  await p.locator('.card', { hasText: 'Zootopia' }).click();
  for (let i = 0; i < 10; i++) { await p.fill('.saisie', ZOO[i]); await p.keyboard.press('Enter'); await p.locator('.panel .btn', { hasText: /suivante|résultat/ }).click(); }
  ok((await p.locator('.final').innerText()).trim() === '10 / 10', 'partie terminée jusqu\'au résultat (10 / 10)');
  await p.click('text=Retour aux leçons');
  ok((await label('Zootopia')) === '🔁 Fait 3 fois', 'l\'étiquette passe à « ' + await label('Zootopia') + ' » dès le retour à la liste');
  await p.evaluate(() => revisionFlush());
  ok(w.run('adminData', PW).progress.leo.find(x => x.id === 'zootopia').fois === 3, 'le serveur a bien enregistré 3 parties');
  // deux parties de plus, jouées sur un autre appareil : le compteur est cumulé sur le serveur
  w.run('finishQuiz', ...Lc, 'zootopia'); w.run('finishQuiz', ...Lc, 'zootopia');
  // autre appareil + autre élève
  const c2 = await b.newContext({ viewport: { width: 1000, height: 900 } }); await install(c2, w);
  const p2 = await c2.newPage(); await p2.goto('file://' + SRC + 'Index.html'); await login(p2, LEO);
  ok((await p2.locator('.card', { hasText: 'Zootopia' }).locator('.fois').innerText()).trim() === '🔁 Fait 5 fois', 'AUTRE APPAREIL : Léo retrouve « Fait 5 fois »');
  await p2.click('#logout'); await p2.fill('#login-pseudo', 'Emma'); await p2.fill('#login-pin', '4321'); await p2.click('#login-btn'); await p2.waitForSelector('#app:not([hidden])');
  ok((await p2.locator('.card', { hasText: 'Zootopia' }).locator('.fois').innerText()).trim() === '🔁 Fait 1 fois', 'EMMA voit son propre compteur : « Fait 1 fois » (singulier correct)');

  // ---------- administration ----------
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message)); a.on('dialog', d => d.accept());
  await a.goto('file://' + SRC + 'admin.html'); await a.fill('#password', PW); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])'); await a.click('#tab-programmes');
  const card = id => a.locator(`.prog-card[data-student="${id}"]`);
  await card('leo').locator('text=Détails').click(); await card('emma').locator('text=Détails').click();
  const zl = card('leo').locator('.lesson[data-quiz="zootopia"]'), bl = card('leo').locator('.lesson[data-quiz="byzance"]');
  ok((await zl.locator('.fois-admin').innerText()).trim() === '🔁 Fait 5 fois' && (await bl.locator('.fois-admin').innerText()).trim() === 'Pas encore fait', 'ADMIN, onglet Programmes de révision (Détails) : Zootopia « ' + (await zl.locator('.fois-admin').innerText()).trim() + ' », Byzance « ' + (await bl.locator('.fois-admin').innerText()).trim() + ' »');
  ok((await card('emma').locator('.lesson[data-quiz="zootopia"] .fois-admin').innerText()).trim() === '🔁 Fait 1 fois', 'Emma : « Fait 1 fois »');
  ok(((await zl.locator('.fois-admin').getAttribute('title')) || '').startsWith('Dernière partie terminée'), 'survol : date de la dernière partie terminée');
  const order = await zl.locator('.lesson-title .badges > span').evaluateAll(l => l.map(e => e.className));
  ok(order.join() === 'parcours-admin,fois-admin,niveau', 'le compteur est à côté de l’étape du parcours et du niveau (même ligne)');
  await zl.locator('text=Remettre cette leçon à zéro').click(); await a.waitForSelector('#prog-status.ok');
  ok((await a.locator('#prog-status').innerText()).includes('compteur') && (await a.locator('#prog-status').innerText()).includes('conservé'), 'après la remise à zéro de la leçon, le message précise que le compteur est conservé : « ' + (await a.locator('#prog-status').innerText()).slice(0, 110) + '… »');
  ok((await zl.locator('.fois-admin').innerText()).trim() === '🔁 Fait 5 fois' && (await zl.locator('.niveau').innerText()).trim() === 'Pas commencée', 'la leçon est « Pas commencée » mais « Fait 5 fois » reste affiché');
  // suppression de l'élève : le compteur disparaît
  w.run('deleteStudent', PW, 'leo');
  ok(!Object.keys(w.props).some(k => k.startsWith('done_leo__') || k.startsWith('prog_leo__')), 'supprimer un élève efface aussi ses compteurs');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
