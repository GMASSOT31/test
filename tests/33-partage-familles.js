// cible: cloudflare
// Partage des leçons avec les familles (16/11/2026) et onglet « Leçons » en parties repliables :
// - une famille ne voit dans « Leçons fournies » que ce que l'administrateur lui partage (au départ : ce qu'elle avait déjà donné) ;
// - l'administrateur voit une 3e partie « Leçons créées par les familles », les donne à ses enfants, les partage à d'autres familles ;
// - la famille auteure corrige sa leçon partout, mais ne peut plus la supprimer une fois partagée ;
// - retirer un partage retire la leçon aux enfants de la famille (progression gardée) ; rien ne fuit d'une famille à l'autre.
const { chromium } = require('playwright');
const { makeWorldCf, install, ok, summary, page } = require('./harness');
const P = n => page(n, 'cloudflare');

(async () => {
  const w = makeWorldCf({ ADMIN_PASSWORD: 'secret12' });
  const ADM = { pseudo: 'Papa', password: 'secret12' }, DUP = { pseudo: 'Dupont', password: 'motdepasse1' }, MAR = { pseudo: 'Martin', password: 'motdepasse2' };
  w.run('adminData', ADM);
  w.run('saveStudent', ADM, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  const code = w.run('setInviteCode', ADM, 'new').code;
  w.run('createFamily', code, { famille: 'Dupont', pseudo: 'Dupont', password: 'motdepasse1' });
  w.run('createFamily', code, { famille: 'Martin', pseudo: 'Martin', password: 'motdepasse2' });
  w.run('saveStudent', DUP, { classe: '5C', pseudo: 'Lou', pin: '2222' });
  w.run('saveStudent', MAR, { classe: '5C', pseudo: 'Zoé', pin: '3333' });

  // ---- 1. reprise de l'existant : ce qui était déjà donné reste (données d'avant le partage) ----
  w.props.builtin_assign = JSON.stringify({ zootopia: ['zoe', 'leo'] });
  ok(!w.props.shares && w.run('adminData', MAR).builtins.map(b => b.id).join() === 'zootopia' && w.run('adminData', DUP).builtins.length === 0, 'données d\'avant : Martin garde Zootopia (déjà donnée à Zoé), Dupont n\'a rien');
  ok(w.run('getStudentData', '5C', 'Zoé', '3333').quizzes.map(q => q.id).join() === 'zootopia', 'Zoé garde sa leçon');
  ok(!w.props.shares, 'une simple lecture n\'écrit rien (la reprise est calculée)');

  // ---- 2. une famille crée une leçon : elle apparaît chez l'administrateur (3e partie) ----
  const dictee = w.run('saveQuiz', DUP, { titre: 'Dictée : les homophones', matiere: 'Français', emoji: '✍️', pour: ['lou'],
    questions: [{ question: 'a ou à : il ___ faim', options: ['a', 'à'], correct: 0 }, { question: 'et ou est : il ___ grand', options: ['et', 'est'], correct: 1 }] }).id;
  const b = await chromium.launch();
  const tel = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await install(tel, w);
  const errs = []; const a = await tel.newPage(); a.on('pageerror', e => errs.push(e.message)); a.on('dialog', d => d.accept());
  // ouvre une partie seulement si elle est repliée (l'état est retenu sur l'appareil, partagé entre les pages du test)
  const ouvrir = async (pg, sec) => { if ((await pg.locator(sec + ' .ls-toggle').getAttribute('aria-expanded')) !== 'true') await pg.click(sec + ' .ls-toggle'); };
  const connect = async (pg, cred) => { await pg.goto(P('admin.html')); await pg.fill('#admin-pseudo', cred.pseudo); await pg.fill('#password', cred.password); await pg.click('#unlock'); await pg.waitForSelector('#admin-area:not([hidden])'); await pg.click('#tab-quiz-liste'); };
  await connect(a, ADM);
  const sections = await a.locator('.ls:not([hidden]) .ls-titre').allInnerTexts();
  ok(JSON.stringify(sections) === '["✏️ Mes leçons","🏛️ Leçons fournies","👪 Leçons créées par les familles","🃏 Cartes en plus"]', 'administrateur : 4 parties : ' + sections.join(' · '));
  ok((await a.locator('.ls-corps:visible').count()) === 0 && (await a.locator('.ls-toggle[aria-expanded="false"]').count()) === 4, 'téléphone : toutes les parties repliées (titres seulement)');
  ok(JSON.stringify(await a.locator('.ls:not([hidden]) .ls-nb').allInnerTexts()) === '["0","11","1","0"]', 'nombre de leçons de chaque partie : 0, 11, 1, 0');
  const boxes = await a.locator('.ls-toggle').evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
  ok(boxes.every(hh => hh >= 48) && (await a.locator('.ls-toggle').first().getAttribute('aria-controls')) === 'ls-mes', 'boutons de partie : 48 px au moins, reliés à leur contenu (aria-controls)');
  await a.click('#family-lessons .ls-toggle');
  ok(await a.locator('#ls-familles').isVisible() && (await a.locator('#family-lessons .ls-toggle').getAttribute('aria-expanded')) === 'true', 'toucher une partie la déplie');
  const row = a.locator(`#family-list .builtin[data-id="${dictee}"]`);
  ok((await row.innerText()).includes('Créée par la famille Dupont') && (await row.innerText()).includes('Donnée à personne'), 'la leçon de Dupont, avec sa famille auteure ; aucun de MES enfants ne l\'a');
  await a.reload(); await a.waitForSelector('#admin-pseudo'); await a.fill('#admin-pseudo', 'Papa'); await a.fill('#password', 'secret12'); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])'); await a.click('#tab-quiz-liste');
  ok(await a.locator('#ls-familles').isVisible() && await a.locator('#ls-mes').isHidden(), 'l\'état des parties est retenu sur l\'appareil');

  // ---- 3. l'administrateur la donne à Léo et la partage avec Martin (pas avec Dupont, l'auteure) ----
  await row.locator('.builtin-toggle').click();
  ok(JSON.stringify(await row.locator('.pour-familles .pour-item').allInnerTexts()) === '["👪 Martin"]', 'familles proposées : Martin seulement (pas l\'auteure)');
  await row.locator('.pour-item', { hasText: 'Léo' }).locator('input').check();
  await a.waitForFunction(id => document.querySelector(`#family-list .builtin[data-id="${id}"]`).textContent.includes('👥 Léo'), dictee);
  await a.locator(`#family-list .builtin[data-id="${dictee}"] .pour-familles input`).check();
  await a.waitForFunction(id => document.querySelector(`#family-list .builtin[data-id="${id}"]`).textContent.includes('Partagée : Martin'), dictee);
  ok(JSON.stringify(JSON.parse(w.props.shares)['q:' + dictee]) === '["martin"]' && JSON.parse(w.props['quiz_' + dictee]).pour.sort().join() === 'leo,lou', 'enregistré : partagée avec Martin ; Léo et Lou l\'ont');
  ok(w.run('getStudentData', '5B', 'Léo', '1234').quizzes.some(q => q.id === dictee), 'Léo voit la leçon de la famille Dupont');
  // et une leçon fournie partagée avec Dupont
  await ouvrir(a, '#provided-lessons');
  const zoo = a.locator('#builtin-list .builtin[data-id="byzance"]');
  await zoo.locator('.builtin-toggle').click();
  await zoo.locator('.pour-familles .pour-item', { hasText: 'Dupont' }).locator('input').check();
  await a.waitForFunction(() => document.querySelector('#builtin-list .builtin[data-id="byzance"]').textContent.includes('Partagée : Dupont'));
  ok((JSON.parse(w.props.shares)['b:byzance'] || []).join() === 'dupont' && (JSON.parse(w.props.shares)['b:zootopia'] || []).join() === 'martin', 'Byzance partagée avec Dupont ; la reprise (Zootopia pour Martin) est maintenant enregistrée');

  // ---- 4. la famille Martin : « Leçons fournies » = Zootopia + la dictée partagée ; pas de 3e partie ----
  const m = await tel.newPage(); m.on('pageerror', e => errs.push(e.message)); m.on('dialog', d => d.accept());
  await connect(m, MAR);
  ok(await m.locator('#family-lessons').isHidden() && JSON.stringify(await m.locator('.ls:not([hidden]) .ls-nb').allInnerTexts()) === '["0","2","0"]', 'famille : 3 parties (pas de « Leçons créées par les familles ») ; Leçons fournies : 2');
  await ouvrir(m, '#provided-lessons');
  const shared = m.locator(`#shared-list .builtin[data-id="${dictee}"]`);
  ok(!(await m.locator('#ls-fournies').innerText()).includes('Dupont') && (await shared.count()) === 1, 'la dictée apparaît dans ses Leçons fournies, sans le nom de la famille auteure');
  await shared.locator('.builtin-toggle').click();
  ok((await shared.locator('button', { hasText: 'Modifier' }).count()) === 0 && (await shared.locator('button', { hasText: 'Supprimer' }).count()) === 0 && (await shared.locator('.pour-familles').count()) === 0 && (await shared.innerText()).includes('tu ne peux pas la modifier'), 'leçon partagée : ni Modifier, ni Supprimer, ni partage ; seulement « Qui l\'a ? »');
  await shared.locator('.pour-item', { hasText: 'Zoé' }).locator('input').check();
  await m.waitForFunction(id => document.querySelector(`#shared-list .builtin[data-id="${id}"]`).textContent.includes('👥 Zoé'), dictee);
  ok(w.run('getStudentData', '5C', 'Zoé', '3333').quizzes.some(q => q.id === dictee) && JSON.parse(w.props['quiz_' + dictee]).pour.sort().join() === 'leo,lou,zoe', 'Zoé reçoit la dictée (Léo et Lou la gardent)');
  const dm = w.run('adminData', MAR);
  ok(!JSON.stringify(dm).includes('lou') && !JSON.stringify(dm).includes('leo') && !JSON.stringify(dm).includes('Dupont') && !JSON.stringify(dm).includes('"familles"'), 'Martin ne voit ni les enfants, ni le nom, ni les partages des autres familles');
  ok(w.try('setAccess', MAR, 'quiz', dictee, ['zoe', 'lou']).ok.pour.join() === 'zoe' && JSON.parse(w.props['quiz_' + dictee]).pour.sort().join() === 'leo,lou,zoe', 'Martin ne peut pas donner la leçon à un enfant d\'une autre famille (ni la retirer)');
  ok(w.try('saveQuiz', MAR, { id: dictee, titre: 'Piratée', questions: [{ question: 'x', reponses: ['y'] }] }).err === 'Élément introuvable.' && w.try('deleteQuiz', MAR, dictee).err === 'Élément introuvable.', 'Martin ne peut ni la modifier ni la supprimer');

  // ---- 5. la famille auteure : corrections partout, suppression bloquée ----
  const dq = JSON.parse(w.props['quiz_' + dictee]);
  w.run('saveQuiz', DUP, { id: dictee, titre: 'Dictée : homophones (corrigée)', matiere: 'Français', emoji: '✍️', pour: ['lou'], questions: dq.questions });
  ok(w.run('getStudentData', '5C', 'Zoé', '3333').quizzes.find(q => q.id === dictee).titre === 'Dictée : homophones (corrigée)' && JSON.parse(w.props['quiz_' + dictee]).pour.sort().join() === 'leo,lou,zoe', 'Dupont corrige : la correction arrive chez Zoé et Léo, qui gardent la leçon');
  const d2 = await tel.newPage(); d2.on('pageerror', e => errs.push(e.message)); d2.on('dialog', d => d.accept());
  await connect(d2, DUP);
  await ouvrir(d2, '#my-lessons');
  const own = d2.locator(`#quiz-list .builtin[data-id="${dictee}"]`);
  await own.locator('.builtin-toggle').click(); await own.locator('button', { hasText: 'Supprimer' }).click();
  await d2.waitForSelector('#quizlist-status.err');
  ok((await d2.locator('#quizlist-status').innerText()) === "Cette leçon est partagée avec d'autres familles : demande à l'administrateur de la supprimer." && !!w.props['quiz_' + dictee], 'Dupont ne peut plus supprimer sa leçon partagée (message clair)');
  ok(JSON.stringify(await d2.locator('.ls:not([hidden]) .ls-nb').allInnerTexts()) === '["1","1","0"]', 'Dupont : Mes leçons 1, Leçons fournies 1 (Byzance partagée)');
  const lou = w.run('adminData', DUP).quizzes.find(q => q.id === dictee);
  ok(lou.pour.join() === 'lou' && !('familles' in lou), 'Dupont voit seulement son enfant parmi les destinataires (ni Léo ni Zoé)');

  // ---- 6. retirer le partage : Zoé perd la leçon, sa progression est gardée ----
  w.run('answer', '5C', 'Zoé', '3333', dictee, dq.questions[0].id, 'qcm', true, '', 's1', 'op1');
  await a.reload(); await a.waitForSelector('#admin-pseudo'); await a.fill('#admin-pseudo', 'Papa'); await a.fill('#password', 'secret12'); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])'); await a.click('#tab-quiz-liste');
  const row2 = a.locator(`#family-list .builtin[data-id="${dictee}"]`);
  await row2.locator('.builtin-toggle').click(); await row2.locator('.pour-familles input').uncheck();
  await a.waitForFunction(id => !document.querySelector(`#family-list .builtin[data-id="${id}"]`).textContent.includes('Partagée'), dictee);
  ok(!w.run('getStudentData', '5C', 'Zoé', '3333').quizzes.some(q => q.id === dictee) && !!w.props['srs_zoe__' + dictee] && JSON.parse(w.props['quiz_' + dictee]).pour.sort().join() === 'leo,lou', 'partage retiré : Zoé n\'a plus la leçon, sa progression est gardée, Léo et Lou la gardent');
  ok(w.run('adminData', MAR).partagees.length === 0, 'Martin ne la voit plus');
  // l'administrateur supprime la leçon de la famille
  await row2.locator('button', { hasText: 'Supprimer' }).click();
  await a.waitForFunction(id => !document.querySelector(`#family-list .builtin[data-id="${id}"]`), dictee);
  ok(!w.props['quiz_' + dictee] && !w.run('getStudentData', '5B', 'Léo', '1234').quizzes.some(q => q.id === dictee) && !JSON.parse(w.props.shares)['q:' + dictee] && (await a.locator('#nb-familles').innerText()) === '0', 'l\'administrateur la supprime : disparue pour tout le monde');

  // ---- 7. sur ordinateur : parties ouvertes par défaut ----
  const pc = await b.newContext({ viewport: { width: 1280, height: 900 } }); await install(pc, w);
  const o = await pc.newPage(); await connect(o, ADM);
  ok((await o.locator('.ls-toggle[aria-expanded="true"]').count()) === 4 && await o.locator('#builtin-list').isVisible(), 'ordinateur : parties ouvertes par défaut');
  // suppression d'une famille : ses partages disparaissent
  w.run('deleteFamily', ADM, 'dupont');
  ok(!JSON.stringify(JSON.parse(w.props.shares)).includes('dupont'), 'famille supprimée : plus aucun partage à son nom');

  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close();
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
