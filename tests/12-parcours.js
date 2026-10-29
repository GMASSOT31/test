const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, EMMA, PW, SRC } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('saveStudent', PW, { classe: '5B', pseudo: 'Emma', pin: '4321' });
w.run('setBuiltinAssign', PW, 'zootopia', ['leo']);
const Lc = ['5B', 'Léo', '1234'], Ec = ['5B', 'Emma', '4321'];
const zoo = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia');
const pc = (cred = Lc) => w.run('getStudentData', ...cred).parcours.zootopia;
const ZOO = ['sahara square', 'tundratown', 'downtown', 'rainforest district', 'skyscrapers', 'sand dunes', 'waterfall', 'raffe', 'el', 'humid'];

(async () => {
  // ================= SERVEUR : la machine à états du parcours =================
  ok(JSON.stringify(pc()) === '{"etape":"quiz","passages":0,"cycle":1,"maj":0}', 'départ : étape 1, 0 passage, tour 1');
  ok(w.run('finishQuiz', ...Lc, 'zootopia').parcours.passages === 1 && w.run('finishQuiz', ...Lc, 'zootopia').parcours.passages === 2, 'finishQuiz : 1 puis 2 passages (étape 1)');
  const r3 = w.run('finishQuiz', ...Lc, 'zootopia');
  ok(r3.parcours.etape === 'cartes' && r3.parcours.passages === 3 && r3.n === 3, '3e passage, des questions ne sont pas sues : étape 2 (« cartes ») ; le compteur « fait » = 3');
  ok(w.run('finishQuiz', ...Lc, 'zootopia').parcours.etape === 'cartes' && pc().passages === 3, 'un quiz terminé pendant l\'étape 2 ne fait pas avancer le parcours (mais compte dans « fait N fois »)');
  ok(w.try('requestValidation', ...Lc, 'zootopia').err === "Cette étape n'est pas en cours.", 'on ne peut pas demander la validation depuis l\'étape 2');
  const c1 = w.run('cardsDone', ...Lc, 'zootopia');
  ok(c1.parcours.etape === 'quiz' && c1.parcours.passages === 0 && c1.parcours.cycle === 2, '« C\'est bon, j\'ai mémorisé » : retour à l\'étape 1, 0 passage, tour 2');
  ok(w.try('cardsDone', ...Lc, 'zootopia').err === "Cette étape n'est pas en cours.", 'cardsDone ne marche que depuis l\'étape 2 (pas de double envoi)');
  // toutes les questions sues -> l'étape 2 est sautée
  zoo.questions.forEach(q => { for (let i = 0; i < 3; i++) w.run('saveResult', ...Lc, 'zootopia', w.ctx.qhash_(q.question), true); });
  for (let i = 0; i < 3; i++) w.run('finishQuiz', ...Lc, 'zootopia');
  ok(pc().etape === 'revision', 'tout est su (10 questions à 3 / 3) : après 3 passages on saute l\'étape 2 et on passe à l\'étape 3');
  ok(w.try('cardsDone', ...Lc, 'zootopia').err && w.run('finishQuiz', ...Lc, 'zootopia').parcours.etape === 'revision', 'à l\'étape 3, un quiz de plus ne change rien');
  const v = w.run('requestValidation', ...Lc, 'zootopia');
  ok(v.parcours.etape === 'fini' && v.parcours.fini > 0, 'étape 3 -> « fini » (en attente de validation)');
  ok(w.try('requestValidation', ...Lc, 'zootopia').err === "Cette étape n'est pas en cours.", 'pas de double demande');
  // sécurité
  ok(w.try('cardsDone', ...Ec, 'zootopia').err === 'Quiz inaccessible.' && w.try('requestValidation', ...Ec, 'zootopia').err === 'Quiz inaccessible.' && w.try('finishQuiz', ...Ec, 'zootopia').err === 'Quiz inaccessible.', 'Emma ne peut pas toucher au parcours de Léo (quiz non attribué)');
  ok(w.try('cardsDone', '5B', 'Léo', '0000', 'zootopia').err === 'Classe, pseudo ou PIN incorrect.', 'mauvais PIN refusé');
  // validation par l'administrateur
  ok(w.try('validateParcours', 'faux', 'leo', 'zootopia').err === 'Mot de passe incorrect.', 'validation : mot de passe admin requis');
  ok(w.try('validateParcours', PW, 'inconnu', 'zootopia').err === 'Élève inconnu.', 'élève inconnu refusé');
  const val = w.run('validateParcours', PW, 'leo', 'zootopia');
  ok(val.parcours.etape === 'valide' && val.parcours.valide > 0, 'validation par l\'admin : « valide »');
  ok(w.try('validateParcours', PW, 'leo', 'zootopia').err === "Ce parcours n'attend pas de validation.", 'on ne peut pas valider deux fois (ni un parcours non terminé)');
  const lessonAdm = w.run('adminData', PW).progress.leo.find(x => x.id === 'zootopia');
  ok(lessonAdm.parcours.etape === 'valide' && lessonAdm.fois >= 5, 'adminData : parcours « valide » ; compteur « fait » conservé (' + lessonAdm.fois + ')');
  // remise à zéro d'une leçon : le parcours repart de l'étape 1, le compteur reste
  const foisAvant = lessonAdm.fois; w.run('resetProgress', PW, 'leo', 'zootopia');
  const after = w.run('adminData', PW).progress.leo.find(x => x.id === 'zootopia');
  ok(after.parcours.etape === 'quiz' && after.parcours.passages === 0 && after.parcours.cycle === 1 && after.fois === foisAvant, 'remise à zéro de la leçon : parcours à l\'étape 1 (0 passage, tour 1), compteur « fait ' + foisAvant + ' fois » conservé');
  w.run('finishQuiz', ...Lc, 'zootopia'); w.run('deleteStudent', PW, 'leo');
  ok(!Object.keys(w.props).some(k => k.startsWith('parcours_leo__')), 'supprimer un élève efface son parcours');
  w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('setBuiltinAssign', PW, 'zootopia', ['leo']);
  // remise à zéro générale + suppression du quiz
  w.run('finishQuiz', ...Lc, 'zootopia'); w.run('resetProgress', PW, 'all', 'all');
  ok(pc().passages === 0 && !Object.keys(w.props).some(k => k.startsWith('parcours_')), 'remise à zéro générale : tous les parcours repartent de l\'étape 1');

  // ================= PAGE ÉLÈVE : le parcours =================
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1100, height: 1000 } }); await install(c, w);
  const errs = [];
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  const sync = () => p.evaluate(() => revisionFlush());
  const card = () => p.locator('.card.lecon', { hasText: 'Zootopia' });
  const nextBtn = () => p.locator('.panel .btn', { hasText: /suivante|résultat/ });
  // une partie complète ; wrongFirst = numéros (0, 1…) de questions où l'élève se trompe d'abord
  const runQuiz = async (wrongFirst = []) => {
    for (let i = 0; i < 10; i++) {
      if (wrongFirst.includes(i)) { await p.fill('.saisie', 'faux'); await p.keyboard.press('Enter'); }
      await p.fill('.saisie', ZOO[i]); await p.keyboard.press('Enter'); await nextBtn().click();
    }
  };
  const result = async () => ((await p.locator('.etape-msg').innerText()) || '').replace(/\s+/g, ' ').trim();

  // ---- accueil ----
  const heading = p.locator('.home-question h2');
  ok((await heading.innerText()) === 'Quelle leçon veux-tu réviser maintenant ?', 'ACCUEIL : la question « ' + await heading.innerText() + ' »');
  const hb = await heading.boundingBox(), gb = await p.locator('.grid').boundingBox(), cb = await p.locator('.content').boundingBox();
  ok(hb.y < gb.y && Math.abs((hb.x + hb.width / 2) - (cb.x + cb.width / 2)) < 30 && (await heading.evaluate(e => getComputedStyle(e.parentElement).textAlign)) === 'center', 'la question est CENTRÉE, au-dessus des leçons (« en dessous ses quiz sont présentés »)');
  ok((await p.locator('#tab-quiz').innerText()).includes('Mes leçons'), 'onglet « 🎓 Mes leçons »');
  ok((await card().locator('.etape').innerText()) === 'Étape 1 sur 3 · Quiz : 0 / 3 passages faits' && (await card().locator('.dot.on').innerText()) === '1 Quiz', 'la carte de la leçon indique l\'étape : « ' + await card().locator('.etape').innerText() + ' »');

  // ---- étape 1 : le quiz, 3 passages ----
  await card().click();
  ok(await p.locator('.question').isVisible() && (await p.locator('.etape-banner').innerText()) === 'Étape 1 sur 3 · Passage 1 sur 3', 'un clic sur la leçon lance DIRECTEMENT le quiz, bandeau « ' + await p.locator('.etape-banner').innerText() + ' »');
  await runQuiz();
  ok((await result()).includes('Passage 1 sur 3 terminé. Il te reste 2 passages avant l\'étape suivante.'), 'fin du passage 1 : « ' + await result() + ' »');
  ok((await p.locator('.actions .btn', { hasText: 'Passage suivant' }).count()) === 1 && (await p.locator('text=Rejouer').count()) === 0, 'bouton « Passage suivant → » (plus de « Rejouer »)');
  await p.click('text=Passage suivant');
  ok((await p.locator('.etape-banner').innerText()) === 'Étape 1 sur 3 · Passage 2 sur 3', 'bandeau : « ' + await p.locator('.etape-banner').innerText() + ' »');
  await runQuiz([0, 1]);                                          // passage 2 : se trompe d'abord sur Q1 et Q2
  ok((await result()).includes('Passage 2 sur 3 terminé. Il te reste 1 passage avant'), 'fin du passage 2 : « ' + await result() + ' » (singulier)');
  await sync();
  ok(pc().passages === 2 && pc().etape === 'quiz', 'le serveur suit : 2 passages faits');
  // autre appareil : le compteur suit l'élève
  const c2 = await b.newContext({ viewport: { width: 1000, height: 900 } }); await install(c2, w);
  const p2 = await c2.newPage(); await p2.goto('file://' + SRC + 'Index.html'); await login(p2, LEO);
  ok((await p2.locator('.card.lecon .etape').innerText()) === 'Étape 1 sur 3 · Quiz : 2 / 3 passages faits', 'AUTRE APPAREIL : « ' + await p2.locator('.card.lecon .etape').innerText() + ' »'); await p2.close();
  await p.click('text=Passage suivant'); await runQuiz();       // passage 3
  const m3 = await result();
  ok(m3.includes('Tes 3 passages sont faits') && m3.includes('revoir les 2 flashcards des questions que tu ne sais pas encore'), 'fin du 3e passage : « ' + m3 + ' »');
  ok((await p.locator('.actions .btn', { hasText: 'Étape suivante' }).count()) === 1, 'bouton « Étape suivante → »');
  await sync();
  ok(pc().etape === 'cartes', 'le serveur est passé à l\'étape 2 (comme l\'écran)');

  // ---- étape 2 : flashcards des questions non sues ----
  await p.click('text=Retour aux leçons');
  ok((await card().locator('.etape').innerText()) === 'Étape 2 sur 3 · Flashcards à revoir (2)' && (await card().locator('.dot.done').innerText()) === '1 Quiz', 'la carte : « ' + await card().locator('.etape').innerText() + ' »');
  await card().click();
  ok(await p.locator('.flashcard').isVisible() && (await p.locator('.question').count()) === 0, 'un clic ouvre les flashcards (plus le quiz)');
  ok((await p.locator('.etape-intro').innerText()).includes('Étape 2 sur 3') && (await p.locator('.progress').innerText()).includes('Carte 1 / 2'), 'message d\'étape ; 2 cartes (uniquement les non sues) : ' + (await p.locator('.progress').innerText()).replace(/\s+/g, ' '));
  const front = [];
  front.push(await p.locator('.face-text').innerText()); await p.click('text=Suivante →'); front.push(await p.locator('.face-text').innerText());
  ok(front.every(t => zoo.questions.slice(0, 2).some(q => q.question === t)), 'ce sont bien les 2 questions non sues (Q1 et Q2) : ' + front.map(t => t.slice(0, 28)).join(' | '));
  await p.click('text=← Précédente');
  ok(!(await p.locator('.finish-btn').isVisible()), 'le bouton « C\'est bon, j\'ai mémorisé » n\'est PAS visible sur la 1re carte');
  await p.click('text=Suivante →');
  ok(await p.locator('.finish-btn').isVisible() && (await p.locator('.finish-btn').innerText()).includes("C'est bon, j'ai mémorisé"), 'il apparaît à la DERNIÈRE carte : « ' + await p.locator('.finish-btn').innerText() + ' »');
  await p.click('.finish-btn');
  ok((await p.locator('.etape-banner').innerText()) === 'Étape 1 sur 3 · Passage 1 sur 3 (tour 2)' && await p.locator('.question').isVisible(), '« C\'est bon, j\'ai mémorisé » : retour à l\'étape 1, le quiz recommence (« ' + await p.locator('.etape-banner').innerText() + ' »)');
  await sync(); ok(pc().etape === 'quiz' && pc().passages === 0 && pc().cycle === 2, 'serveur : étape 1, 0 passage, tour 2');

  // ---- 2e tour : les questions Q1 et Q2 deviennent sues -> on saute l'étape 2 ----
  await runQuiz(); ok((await result()).includes('Il te reste 2 passages'), '2e tour, passage 1 : « ' + await result() + ' »');
  await p.click('text=Passage suivant'); await runQuiz(); await p.click('text=Passage suivant'); await runQuiz();
  const m6 = await result();
  ok(m6.includes('Tes 3 passages sont faits et tu sais tout') && m6.includes('Dernière étape'), 'tout est su après le 2e tour : « ' + m6 + ' »');
  await sync(); ok(pc().etape === 'revision', 'serveur : étape 3');

  // ---- étape 3 : le paquet complet sans choix ----
  await p.click('.actions .btn:has-text("Étape suivante")');
  ok((await p.locator('.etape-intro').innerText()) === 'Maintenant apprends les réponses mais sans choix proposés.', 'ÉTAPE 3 : message « ' + await p.locator('.etape-intro').innerText() + ' »');
  ok((await p.locator('.progress').innerText()).includes('Carte 1 / 10'), 'le paquet ENTIER : 10 cartes');
  let tropTot = false;
  for (let i = 0; i < 9; i++) { if (await p.locator('.finish-btn').isVisible()) tropTot = true; await p.click('text=Suivante →'); }
  ok(!tropTot, 'le bouton « Faire valider par un adulte » n\'apparaît pas avant la dernière carte (cartes 1 à 9 sur 10)');
  ok(await p.locator('.finish-btn').isVisible() && (await p.locator('.finish-btn').innerText()).includes('Faire valider par un adulte'), 'à la dernière carte : « ' + await p.locator('.finish-btn').innerText() + ' »');
  await p.click('.finish-btn');
  ok((await p.locator('.panel h2').innerText()) === 'Parcours terminé !' && (await result()).includes('Montre-le maintenant à un adulte'), 'PARCOURS TERMINÉ : « ' + await result() + ' »');
  await sync(); ok(pc().etape === 'fini', 'serveur : en attente de validation');
  await p.click('text=Retour aux leçons');
  ok((await card().locator('.etape').innerText()) === '⏳ Parcours terminé : en attente de validation', 'la carte : « ' + await card().locator('.etape').innerText() + ' »');
  await card().click(); ok((await p.locator('.panel h2').innerText()) === 'Parcours terminé !' && (await p.locator('.question, .flashcard').count()) === 0, 'rouvrir la leçon : l\'écran de fin, pas le quiz');

  // ---- côté admin : validation ----
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message)); a.on('dialog', d => d.accept());
  await a.goto('file://' + SRC + 'admin.html'); await a.fill('#password', PW); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])'); await a.click('#tab-programmes');
  await a.locator('.prog-card[data-student="leo"]').locator('text=Détails').click();
  const lesson = a.locator('.prog-card[data-student="leo"] .lesson[data-quiz="zootopia"]');
  ok((await lesson.locator('.parcours-admin').innerText()) === '⏳ À valider' && (await lesson.locator('text=Valider le parcours').count()) === 1, 'ADMIN : « ⏳ À valider » et bouton « ✅ Valider le parcours »');
  await lesson.locator('text=Valider le parcours').click(); await a.waitForSelector('#prog-status.ok');
  ok((await lesson.locator('.parcours-admin').innerText()).startsWith('✅ Validé le') && (await lesson.locator('text=Valider le parcours').count()) === 0, 'validé : « ' + await lesson.locator('.parcours-admin').innerText() + ' »');
  await p.reload(); await p.waitForSelector('#app:not([hidden])');
  ok((await card().locator('.etape').innerText()) === '✅ Parcours validé', 'CHEZ L\'ÉLÈVE : « ' + await card().locator('.etape').innerText() + ' »');
  await card().click(); ok((await p.locator('.panel h2').innerText()) === 'Parcours validé !', 'écran « Parcours validé ! »');
  // remise à zéro de la leçon par l'admin : repart de l'étape 1
  await lesson.locator('text=Remettre cette leçon à zéro').click(); await a.waitForSelector('#prog-status.ok');
  ok((await lesson.locator('.parcours-admin').innerText()).startsWith('Étape 1 · 0 / 3'), 'remise à zéro de la leçon : « ' + await lesson.locator('.parcours-admin').innerText() + ' »');
  await p.reload(); await p.waitForSelector('#app:not([hidden])');
  ok((await card().locator('.etape').innerText()) === 'Étape 1 sur 3 · Quiz : 0 / 3 passages faits', 'élève : de nouveau « ' + await card().locator('.etape').innerText() + ' »');

  // ---- les autres onglets restent disponibles ----
  await p.click('#tab-flashcards'); ok((await p.locator('.card h3').count()) >= 1, 'l\'onglet « Flashcards » est toujours là');
  await p.click('#tab-programme'); ok((await p.locator('.progress-panel').count()) === 1, 'l\'onglet « Programme » aussi');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
