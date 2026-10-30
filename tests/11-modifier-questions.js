const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, PW, SRC } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('saveStudent', PW, { classe: '5B', pseudo: 'Emma', pin: '4321' });
const L = ['5B', 'Léo', '1234'], E = ['5B', 'Emma', '4321'];
const prog = (cred, quizId) => (w.run('getStudentData', ...cred).progress[quizId] || {});
const quizOf = (cred, id) => w.run('getStudentData', ...cred).quizzes.find(q => q.id === id);
const orig = w.ctx.BUILTIN_QUIZZES.map(q => JSON.stringify(q)).join();

(async () => {
  // ================= SERVEUR =================
  // ---- 1. compatibilité : un quiz enregistré AVANT les identifiants (sans « id » de question) ----
  w.props['quiz_ancien'] = JSON.stringify({ id: 'ancien', ajoute: 1, titre: 'Ancien', matiere: 'Test', emoji: '📘', description: '', pour: ['leo'], questions: [{ question: 'Capitale de la France ?', options: ['Lyon', 'Paris'], correct: 1 }, { question: '2 + 2 ?', options: ['3', '4'], correct: 1 }] });
  const h0 = w.ctx.qhash_('Capitale de la France ?');
  const q0 = quizOf(L, 'ancien');
  ok(q0.questions[0].id === h0, 'quiz ancien sans identifiants : l\'identifiant de chaque question = l\'empreinte de son énoncé (' + h0 + ') : les progressions déjà enregistrées restent valables');
  w.run('saveResult', ...L, 'ancien', h0, true); w.run('saveResult', ...L, 'ancien', h0, true);
  const adm0 = w.run('adminData', PW).quizzes.find(q => q.id === 'ancien');
  ok(adm0.questions[0].id === h0, 'adminData fournit ces identifiants au formulaire de modification');
  // ---- 2. correction d'une faute dans l'énoncé : la progression est conservée ----
  const edited = JSON.parse(JSON.stringify(adm0)); edited.questions[0].question = 'Quelle est la capitale de la France ?'; edited.questions.push({ question: 'Nouvelle question ?', options: ['a', 'b'], correct: 0 });
  w.run('saveQuiz', PW, edited);
  const q1 = quizOf(L, 'ancien');
  ok(q1.questions[0].question === 'Quelle est la capitale de la France ?' && q1.questions[0].id === h0, 'énoncé corrigé, MÊME identifiant conservé');
  ok(JSON.stringify(prog(L, 'ancien')[h0]) === '[2,0]', 'la progression de la question corrigée est CONSERVÉE (2 réussites sur 3) : ' + JSON.stringify(prog(L, 'ancien')[h0]));
  ok(/^[0-9a-f]{8}$/.test(q1.questions[2].id) && q1.questions[2].id !== q1.questions[1].id && q1.questions[2].id !== h0, 'la question ajoutée reçoit un nouvel identifiant : ' + q1.questions[2].id);
  const lz = w.run('adminData', PW).progress.leo.find(x => x.id === 'ancien');
  ok(lz.total === 3 && lz.enCours === 1, 'l\'admin voit 3 questions, dont 1 en cours : ' + JSON.stringify({ total: lz.total, enCours: lz.enCours }));
  ok(w.run('saveResult', ...L, 'ancien', h0, true).ok === 3, 'la question corrigée continue de progresser (3 / 3 = sue)');
  // identifiants invalides ou en double : régénérés
  const dup = w.run('saveQuiz', PW, { titre: 'Doublons', pour: ['leo'], questions: [{ id: 'abcdef12', question: 'a ?', options: ['x', 'y'], correct: 0 }, { id: 'abcdef12', question: 'b ?', options: ['x', 'y'], correct: 0 }, { id: 'PAS-VALIDE', question: 'c ?', options: ['x', 'y'], correct: 0 }] });
  const ids = quizOf(L, dup.id).questions.map(q => q.id);
  ok(ids[0] === 'abcdef12' && new Set(ids).size === 3 && ids.every(i => /^[0-9a-f]{8}$/.test(i)), 'identifiants en double ou invalides régénérés, tous uniques : ' + ids.join(', '));

  // ---- 3. quiz trop gros pour une propriété : découpé en morceaux ----
  const big = { titre: 'Gros quiz', pour: ['leo'], questions: Array.from({ length: 45 }, (_, i) => ({ question: 'Question numéro ' + i + ' ' + 'très longue '.repeat(18) + '?', options: ['réponse A ' + 'x'.repeat(100), 'réponse B ' + 'y'.repeat(100), 'réponse C'], correct: i % 3, explication: 'Explication détaillée '.repeat(10) })) };
  const bs = w.run('saveQuiz', PW, big);
  const chunks = Object.keys(w.props).filter(k => k.startsWith('quiz_' + bs.id + '~'));
  ok(chunks.length >= 2 && Object.values(w.props).every(v => unescape(encodeURIComponent(v)).length < 9000), 'quiz de 45 questions enregistré (plus de limite de 9 Ko) : découpé en ' + chunks.length + ' morceaux, tous sous 9 Ko');
  const back = quizOf(L, bs.id);
  ok(back.questions.length === 45 && back.questions[44].question === big.questions[44].question && back.questions[7].options[1] === big.questions[7].options[1], 'relu à l\'identique après découpage (45 questions)');
  ok(!w.run('adminData', PW).quizzes.some(q => q.id.includes('~')) && w.run('adminData', PW).quizzes.filter(q => q.id === bs.id).length === 1, 'les morceaux n\'apparaissent pas comme des quiz à part');
  const small = JSON.parse(JSON.stringify(big)); small.id = bs.id; small.questions = small.questions.slice(0, 2);
  w.run('saveQuiz', PW, small);
  ok(Object.keys(w.props).filter(k => k.startsWith('quiz_' + bs.id + '~')).length === 0 && quizOf(L, bs.id).questions.length === 2, 'réduit à 2 questions : les anciens morceaux sont supprimés');
  w.run('saveQuiz', PW, { ...big, id: bs.id }); w.run('deleteQuiz', PW, bs.id);
  ok(!Object.keys(w.props).some(k => k.startsWith('quiz_' + bs.id)), 'suppression : le quiz et tous ses morceaux disparaissent');

  // ---- 4. modifier un quiz intégré ----
  w.run('setBuiltinAssign', PW, 'zootopia', ['leo', 'emma']); w.run('setBuiltinAssign', PW, 'musique-carnaval', ['leo']);
  const zoo = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia');
  const hz = w.ctx.qhash_(zoo.questions[0].question);
  w.run('saveResult', ...L, 'zootopia', hz, true); w.run('saveResult', ...L, 'zootopia', hz, true); w.run('saveResult', ...E, 'zootopia', hz, true);
  ok(w.try('getBuiltinForEdit', 'faux', 'zootopia').err === 'Mot de passe incorrect.' && w.try('getBuiltinForEdit', PW, 'inconnu').err === 'Quiz intégré inconnu.', 'modification d\'un quiz intégré : mot de passe requis, quiz inconnu refusé');
  const ed = w.run('getBuiltinForEdit', PW, 'zootopia');
  ok(ed.quiz.questions.length === 10 && ed.quiz.questions[0].id === hz && ed.pour.sort().join() === 'emma,leo', 'getBuiltinForEdit : version en vigueur avec les identifiants (= empreintes d\'origine) et ses destinataires');
  const ed2 = JSON.parse(JSON.stringify(ed.quiz)); ed2.questions[0].question = 'Le quartier du désert, chaud et sec (en anglais) ?'; ed2.questions[0].reponses = ['sahara square', 'le sahara square']; ed2.pour = ['leo'];
  w.run('saveBuiltin', PW, 'zootopia', ed2);
  ok(quizOf(L, 'zootopia').questions[0].question.includes('(en anglais)') && quizOf(E, 'zootopia') === undefined, 'élève : il voit l\'énoncé corrigé ; les destinataires ont été mis à jour (Emma n\'y a plus accès)');
  ok(JSON.stringify(prog(L, 'zootopia')[hz]) === '[2,0]', 'PROGRESSION CONSERVÉE sur la question corrigée d\'un quiz intégré : ' + JSON.stringify(prog(L, 'zootopia')[hz]));
  ok(w.ctx.BUILTIN_QUIZZES.map(q => JSON.stringify(q)).join() === orig, 'l\'original (Contenu.gs) n\'est jamais modifié');
  ok(w.run('adminData', PW).builtins.find(b => b.id === 'zootopia').modifie === true && w.run('adminData', PW).builtins.find(b => b.id === 'byzance').modifie === false, 'adminData signale « modifié » pour ce quiz seulement');
  const ov = JSON.parse(w.props['override_zootopia'] || '{}');
  ok(ov.id === 'zootopia' && !('pour' in ov), 'la version modifiée est stockée à part, sans destinataires (ils restent gérés par l\'attribution)');
  // gros quiz intégré : le quiz de musique modifié (champs, lien, icône)
  const mu = w.run('getBuiltinForEdit', PW, 'musique-carnaval'); const mu2 = JSON.parse(JSON.stringify(mu.quiz)); mu2.pour = mu.pour; mu2.questions[1].question += ' (corrigé)';
  w.run('saveBuiltin', PW, 'musique-carnaval', mu2);
  const mq = quizOf(L, 'musique-carnaval');
  ok(mq.questions.length === 40 && mq.questions[1].question.endsWith('(corrigé)') && mq.questions.filter(q => q.champs).length === 12 && mq.lien.icone === '🎧' && mq.lien.url.includes('digipad'), 'quiz de musique modifié (gros, découpé en morceaux) : 40 questions, 12 à champs, lien et icône 🎧 conservés');
  ok(Object.keys(w.props).filter(k => k.startsWith('override_musique-carnaval~')).length >= 2, 'stocké en ' + Object.keys(w.props).filter(k => k.startsWith('override_musique-carnaval~')).length + ' morceaux');
  // ajout et suppression de questions dans un quiz intégré
  const z3 = JSON.parse(JSON.stringify(w.run('getBuiltinForEdit', PW, 'zootopia').quiz)); z3.pour = ['leo']; const removed = z3.questions.pop(); z3.questions.push({ question: 'Comment dit-on « neige » ?', reponses: ['snow'] });
  w.run('saveBuiltin', PW, 'zootopia', z3);
  const zq = quizOf(L, 'zootopia');
  ok(zq.questions.length === 10 && !zq.questions.some(q => q.id === removed.id) && /^[0-9a-f]{8}$/.test(zq.questions[9].id) && zq.questions[9].id !== removed.id, 'une question retirée disparaît, la nouvelle reçoit son propre identifiant');
  // rétablir
  ok(w.try('restoreBuiltin', 'faux', 'zootopia').err === 'Mot de passe incorrect.', 'rétablir : mot de passe requis');
  w.run('restoreBuiltin', PW, 'zootopia');
  ok(quizOf(L, 'zootopia').questions[0].question === zoo.questions[0].question && !('override_zootopia' in w.props) && JSON.stringify(prog(L, 'zootopia')[hz]) === '[2,0]', 'rétablir l\'original : énoncé d\'origine, version modifiée supprimée, progression toujours conservée');
  ok(w.run('adminData', PW).builtins.find(b => b.id === 'zootopia').modifie === false, 'plus « modifié »');
  ok(w.try('saveBuiltin', PW, 'inconnu', { titre: 'x', questions: [{ question: 'q', options: ['a', 'b'], correct: 0 }] }).err === 'Quiz intégré inconnu.' && w.try('saveBuiltin', 'faux', 'zootopia', ed2).err === 'Mot de passe incorrect.', 'saveBuiltin : quiz inconnu et mauvais mot de passe refusés');

  // ================= ADMINISTRATION (interface) =================
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1200, height: 1000 } }); await install(c, w);
  const errs = [];
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message)); a.on('dialog', d => d.accept());
  await a.goto('file://' + SRC + 'admin.html'); await a.fill('#password', PW); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])');
  await a.click('#tab-quiz-liste');
  const row = id => a.locator(`.builtin[data-id="${id}"]`);
  ok((await a.locator('.builtin button', { hasText: 'Modifier' }).count()) === 5 && (await a.locator('.builtin button', { hasText: 'Rétablir' }).count()) === 1, 'LISTE DES QUIZ : un bouton « Modifier » sur chacun des 5 quiz intégrés ; « Rétablir l\'original » seulement sur celui déjà modifié (musique)');
  ok((await row('musique-carnaval').locator('.badge-modifie').count()) === 1 && (await row('zootopia').locator('.badge-modifie').count()) === 0, 'pastille « ✏️ modifié » sur le bon quiz');
  // modifier Zootopia depuis l'interface (correction d'une faute)
  await row('zootopia').locator('text=Modifier').click();
  ok((await a.locator('.pane:visible').getAttribute('id')) === 'pane-quiz-ajout' && (await a.locator('#quiz-form-title').innerText()).includes('quiz intégré') && await a.locator('#builtin-note').isVisible(), '« Modifier » : formulaire ouvert, titre « ' + await a.locator('#quiz-form-title').innerText() + ' », avertissement affiché');
  ok((await a.locator('#questions .question').count()) === 10 && (await a.locator('#quiz-pour input:checked').evaluateAll(l => l.map(i => i.value))).join() === 'leo', '10 questions chargées, destinataire actuel coché (Léo seul)');
  ok((await a.locator('#q-count').innerText()) === '10 questions', 'compteur : « ' + await a.locator('#q-count').innerText() + ' »');
  await a.fill('#q-search', 'désert'); 
  ok((await a.locator('#questions .question:visible').count()) === 1 && (await a.locator('#q-count').innerText()).startsWith('1 sur 10'), 'RECHERCHE « désert » : 1 question affichée sur 10 (« ' + await a.locator('#q-count').innerText() + ' »)');
  await a.fill('#q-search', 'zzzz'); ok((await a.locator('#questions .question:visible').count()) === 0, 'aucun résultat : aucune question affichée');
  await a.fill('#q-search', 'wet');   // une réponse acceptée de la dernière question
  ok((await a.locator('#questions .question:visible').count()) === 1, 'la recherche porte aussi sur les réponses (« wet » trouve la question « humide »)');
  await a.fill('#q-search', '');
  await a.click('#q-collapse');
  ok((await a.locator('#questions .question.collapsed').count()) === 10 && (await a.locator('#questions .question:visible .choice-area:visible, #questions .question:visible .typed-area:visible').count()) === 0, '« Tout replier » : seules les en-têtes et énoncés restent visibles');
  await a.click('#q-expand'); ok((await a.locator('#questions .question.collapsed').count()) === 0, '« Tout déplier »');
  await a.fill('.q-text', 'Le quartier du désert, chaud et sec (en anglais) ?');
  await a.click('#save-quiz'); await a.waitForSelector('#quizlist-status.ok');
  ok((await a.locator('#quizlist-status').innerText()).includes('progression des élèves est conservée') && (await a.locator('.pane:visible').getAttribute('id')) === 'pane-quiz-liste', 'enregistré : retour à la liste, message « ' + (await a.locator('#quizlist-status').innerText()).slice(0, 90) + '… »');
  ok((await row('zootopia').locator('.badge-modifie').count()) === 1 && (await row('zootopia').locator('text=Rétablir').count()) === 1, 'Zootopia est maintenant « modifié » et peut être rétabli');
  ok(w.run('getStudentData', ...L).quizzes.find(q => q.id === 'zootopia').questions[0].question.includes('(en anglais)') && JSON.stringify(prog(L, 'zootopia')[hz]) === '[2,0]', 'côté élève : énoncé corrigé ET progression intacte (2 / 3)');
  // musique : l'icône du lien survit à une modification par l'interface
  await row('musique-carnaval').locator('text=Modifier').click();
  ok((await a.locator('#lien-icone').inputValue()) === '🎧' && (await a.locator('#lien-url').inputValue()).includes('digipad') && (await a.locator('#questions .question').count()) === 40, 'quiz de musique chargé : 40 questions, lien et icône 🎧 dans le formulaire');
  await a.click('#save-quiz'); await a.waitForSelector('#quizlist-status.ok');
  ok(quizOf(L, 'musique-carnaval').lien.icone === '🎧' && quizOf(L, 'musique-carnaval').questions.filter(q => q.champs).length === 12, 'ré-enregistré sans rien changer : icône, champs et questions conservés');
  // rétablir depuis l'interface
  await row('zootopia').locator('text=Rétablir').click(); await a.waitForFunction(() => document.querySelector('#quizlist-status').textContent.includes('rétablie'));
  ok((await row('zootopia').locator('.badge-modifie').count()) === 0 && quizOf(L, 'zootopia').questions[0].question === zoo.questions[0].question, 'RÉTABLIR : la version d\'origine revient (énoncé d\'origine, pastille retirée)');
  // modifier un quiz créé : la progression suit aussi
  await a.click('#tab-quiz-liste'); await a.locator('#quiz-list .item', { hasText: 'Ancien' }).locator('text=Modifier').click();
  ok((await a.locator('#questions .question').count()) === 3 && !(await a.locator('#builtin-note').isVisible()), 'un quiz créé : modifiable comme avant (3 questions), sans l\'avertissement « quiz intégré »');
  await a.locator('.q-text').nth(1).fill('Combien font deux plus deux ?'); await a.click('#save-quiz'); await a.waitForSelector('#quizlist-status.ok');
  const h1 = w.ctx.qhash_('2 + 2 ?');
  ok(quizOf(L, 'ancien').questions[1].question === 'Combien font deux plus deux ?' && quizOf(L, 'ancien').questions[1].id === h1, 'énoncé corrigé depuis l\'interface : même identifiant conservé');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
