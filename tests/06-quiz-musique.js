const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC } = require('./harness');

// Corrigé officiel (texte fourni), tel qu'un élève le saisirait. Clé = numéro de question (0 = première).
const QCM_KEY = { 0: "Genre musical dans lequel le compositeur imite des éléments non musicaux à l'aide d'un orchestre symphonique", 2: '1886', 3: 'Fin du 19ᵉ siècle', 5: 'Faire rire',
  6: "Il craignait pour sa réputation de membre de l'Académie des beaux-arts", 8: '14 tableaux', 12: 'Pianiste, organiste et compositeur', 13: 'Époque post-romantique', 15: 'Samson et Dalila',
  16: 'Il est le tout premier compositeur de renom à composer une musique spécialement pour un film', 18: "La carte d'identité du son", 20: 'Du nombre de vibrations', 22: 'Le volume sonore de la musique',
  26: 'Crescendo = devenir de plus en plus fort ; Decrescendo = devenir de plus en plus doux', 28: 'Le piano', 30: 'La nage lente', 32: 'La contrebasse', 34: 'Deux violons jouant en glissando et legato',
  36: 'La flûte traversière et les cordes', 38: 'Le violoncelle' };
const TYPED_KEY = { 1: 'Fantaisie', 4: 'Mardi gras', 7: 'Le cygne', 9: 'Pierre', 10: 'Paris', 14: '12', 17: "Assassinat", 27: 'pp < p < mp < mf < f < ff' };
const CHAMPS_KEY = { 11: ['Alger', 'pneumonie'], 19: ['voix', 'instrument'], 21: ['Aigu', 'médium', 'grave'], 23: ['Lent', 'modéré', 'rapide'],
  24: ['pianissimo', 'très doucement', 'piano', 'doucement', 'mezzo piano', 'assez doux'], 25: ['mezzo forte', 'assez fort', 'forte', 'fort', 'fortissimo', 'très fort'],
  29: ['très grave', 'mp < f > mp', 'très rapide', 'legato'], 31: ['orchestre de cordes', 'medium/grave', 'mezzo piano', 'lent', 'legato'],
  33: ['grave', 'mezzo forte', 'modéré', 'staccato'], 35: ['braiement', 'aigu', 'grave', 'forte', 'rapide', 'lent'],
  37: ['chant', 'battement', 'aiguë', 'médium/grave', 'mezzo forte', 'pianissimo', 'legato', 'staccato'], 39: ['grâce', 'médium', 'mezzo forte', 'modéré', 'legato', 'vibrato'] };

(async () => {
  const w = makeWorld();
  w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  w.run('saveStudent', PW, { classe: '5B', pseudo: 'Emma', pin: '4321' });
  w.run('setBuiltinAssign', PW, 'musique-carnaval', ['leo']);
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1000, height: 1100 } }); await install(c, w);
  const errs = [];
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);

  // ---- 1. intégrité des données ----
  const Q = await p.evaluate(() => QUIZZES[0]);
  ok(Q.id === 'musique-carnaval' && Q.questions.length === 40, 'quiz « ' + Q.titre + ' » : 40 questions');
  const idxQcm = Q.questions.map((q, i) => q.options ? i : -1).filter(i => i >= 0), idxTyped = Q.questions.map((q, i) => q.reponses ? i : -1).filter(i => i >= 0), idxChamps = Q.questions.map((q, i) => q.champs ? i : -1).filter(i => i >= 0);
  ok(JSON.stringify(idxQcm) === JSON.stringify(Object.keys(QCM_KEY).map(Number)) && JSON.stringify(idxTyped) === JSON.stringify(Object.keys(TYPED_KEY).map(Number)) && JSON.stringify(idxChamps) === JSON.stringify(Object.keys(CHAMPS_KEY).map(Number)), '20 QCM, 8 réponses écrites et 12 à plusieurs champs, aux bonnes places');
  ok(idxQcm.every(i => Q.questions[i].options.length === 3 && Q.questions[i].correct >= 0 && Q.questions[i].correct < 3), 'chaque QCM a 3 réponses et une bonne réponse valide');
  const wrongKey = idxQcm.filter(i => !Q.questions[i].options[Q.questions[i].correct].startsWith(QCM_KEY[i]));
  ok(wrongKey.length === 0, 'la bonne réponse de CHAQUE QCM correspond au corrigé officiel ' + JSON.stringify(wrongKey));
  ok(new Set(Q.questions.map(q => q.question)).size === 40, 'les 40 énoncés sont tous différents (la progression repose dessus)');
  ok(idxChamps.every(i => Q.questions[i].champs.length >= 2 && Q.questions[i].champs.every(f => f.reponses.length >= 1 && f.label)), 'chaque question à champs a ≥ 2 champs, tous étiquetés et avec des réponses attendues');
  await p.locator('.card', { hasText: 'Musique descriptive' }).click();
  ok((await p.locator('.quiz-link').getAttribute('href')) === 'https://digipad.app/p/1852174/2ea2dfaf331198' && (await p.locator('.quiz-link').innerText()) === '🎧 Écouter les extraits sonores (Padlet / Digipad)', 'bouton audio présent avec l\'adresse du Digipad : « ' + (await p.locator('.quiz-link').innerText()) + ' »');
  ok((await p.locator('.quiz-link').getAttribute('target')) === '_blank' && (await p.locator('.quiz-link').getAttribute('rel')) === 'noopener noreferrer', 'il s\'ouvre dans un nouvel onglet (noopener noreferrer)');
  await p.click('.back');

  // ---- 2. parcours complet avec le corrigé officiel : 40 / 40 ----
  const next = () => p.locator('.panel .btn', { hasText: /suivante|résultat/ }).click();
  await p.locator('.card', { hasText: 'Musique descriptive' }).click();
  for (let i = 0; i < 40; i++) {
    const label = (await p.locator('.progress span').first().innerText()).trim();
    if (!label.startsWith('Question ' + (i + 1) + ' ')) throw new Error('ordre inattendu à la question ' + (i + 1) + ' : ' + label);
    if (i in QCM_KEY) { const t = Q.questions[i].options[Q.questions[i].correct]; await p.locator('.option', { hasText: t.slice(0, 40) }).first().click(); }
    else if (i in TYPED_KEY) { await p.fill('.saisie', TYPED_KEY[i]); await p.keyboard.press('Enter'); }
    else { const inputs = p.locator('.saisie.champ'); for (let k = 0; k < CHAMPS_KEY[i].length; k++) await inputs.nth(k).fill(CHAMPS_KEY[i][k]); await p.locator('.panel .btn', { hasText: 'Valider' }).click(); }
    if (!(await p.locator('.feedback.ok, .option.correct').count())) throw new Error('question ' + (i + 1) + ' refusée avec le corrigé : ' + Q.questions[i].question.slice(0, 60) + ' | feedback=' + (await p.locator('.feedback').allInnerTexts()).join('/') + ' | champs=' + JSON.stringify(await p.locator('.saisie').evaluateAll(l => l.map(i => (i.disabled ? 'V:' : 'x:') + i.value))) + ' | attendu=' + JSON.stringify(CHAMPS_KEY[i] || TYPED_KEY[i]));
    await next();
  }
  const final = (await p.locator('.final').innerText()).trim();
  ok(final === '40 / 40', 'RÉPONDRE AVEC LE CORRIGÉ OFFICIEL : score ' + final + ' (aucune réponse du corrigé refusée)');
  ok(await p.evaluate(() => QUIZZES[0].questions.every(q => progressOf(QUIZZES[0], q).ok === 1)), 'les 40 questions ont 1 / 3 réussites au programme');

  // ---- 3. cas limites des questions à plusieurs champs ----
  const goto = async i => { await p.evaluate(() => { activeTab = 'quiz'; renderList(); }); await p.locator('.card', { hasText: 'Musique descriptive' }).click(); for (let k = 0; k < i; k++) { if (Q.questions[k].options) await p.locator('.option').first().click(); else { await p.evaluate(() => { }); const ins = p.locator('.saisie'); for (let n = 0; n < await ins.count(); n++) await ins.nth(n).fill('x'); await p.keyboard.press('Enter'); if (await p.locator('text=Valider').count()) await p.locator('.panel .btn', { hasText: 'Valider' }).click(); } /* on avance sans valider : voir ci-dessous */ } };
  // plus simple : on saute directement à la question voulue en forçant l'index (la fonction startQuiz n'expose pas l'index) → on rejoue depuis le début avec « Voir la réponse »
  const open = async i => {
    await p.evaluate(() => { activeTab = 'quiz'; renderList(); });
    await p.locator('.card', { hasText: 'Musique descriptive' }).click();
    for (let k = 0; k < i; k++) {
      const qk = Q.questions[k];
      if (qk.options) { await p.locator('.option').first().click(); }
      else if (qk.reponses) { for (let t = 0; t < 3; t++) { await p.fill('.saisie', 'zzz'); await p.keyboard.press('Enter'); } await p.locator('text=Voir la réponse').click(); }
      else { const ins = p.locator('.saisie.champ'); for (let n = 0; n < await ins.count(); n++) await ins.nth(n).fill('zzz'); for (let t = 0; t < 3; t++) await p.locator('.panel .btn', { hasText: 'Valider' }).click(); await p.locator('text=Voir la réponse').click(); }
      await next();
    }
  };
  const fill = async vals => { const ins = p.locator('.saisie.champ'); for (let k = 0; k < vals.length; k++) { if (!(await ins.nth(k).isDisabled())) await ins.nth(k).fill(vals[k]); } await p.locator('.panel .btn', { hasText: 'Valider' }).click(); };
  const state = async () => p.locator('.saisie.champ').evaluateAll(l => l.map(i => (i.disabled ? 'V' : 'x') + ':' + i.value));

  // 3a. Lion (index 29) : un champ faux sur quatre
  await open(29);
  const scoreAvant = (await p.locator('.score').innerText());
  await fill(['très grave', 'forte', 'très rapide', 'legato']);
  ok((await p.locator('.feedback').innerText()).includes('1 champ à corriger'), 'Lion, 1 champ faux sur 4 : « ' + (await p.locator('.feedback').innerText()) + ' »');
  const st = await state();
  ok(st[0].startsWith('V') && st[2].startsWith('V') && st[3].startsWith('V') && st[1].startsWith('x'), 'les 3 bons champs sont verrouillés en vert, le faux reste modifiable : ' + st.join(' | '));
  await fill(['', 'mp<f>mp']);
  ok(await p.locator('.feedback.ok').isVisible(), '« mp<f>mp » (sans espaces) accepté pour « mp < f > mp »');
  ok((await p.locator('.feedback').innerText()).includes('sans point') && (await p.locator('.score').innerText()) === scoreAvant, 'réussi au 2e essai : pas de point (score inchangé : ' + scoreAvant + ')');
  ok((await p.locator('.mastery-line').innerText()).includes('repart à 0'), 'et la question repart à 0 / 3 au programme');

  // 3b. catégories de hauteur, ordre libre (index 21)
  await open(21);
  await fill(['grave', 'aigu', 'médium']);
  ok(await p.locator('.feedback.ok').isVisible() && (await p.locator('.feedback').innerText()).includes('Bravo'), 'ordre libre : « grave, aigu, médium » accepté du premier coup');
  await open(21);
  await fill(['aigu', 'aigu', 'grave']);
  ok((await p.locator('.feedback').innerText()).includes('1 champ à corriger'), 'doublon « aigu, aigu, grave » : un seul « aigu » compte, 1 champ à corriger');
  await fill(['', 'médium']);
  ok(await p.locator('.feedback.ok').isVisible(), 'après correction (« médium ») : validé');

  // 3c. Cygne : les deux modes de jeu sont interchangeables mais pas répétables (index 39)
  await open(39);
  await fill(['grâce', 'médium', 'mezzo forte', 'modéré', 'vibrato', 'legato']);
  ok(await p.locator('.feedback.ok').isVisible() && (await p.locator('.feedback').innerText()).includes('Bravo'), 'Cygne : « vibrato, legato » accepté dans le désordre');
  await open(39);
  await fill(['grâce', 'médium', 'mezzo forte', 'modéré', 'legato', 'legato']);
  ok((await p.locator('.feedback').innerText()).includes('1 champ à corriger'), 'Cygne : « legato, legato » refusé (un seul « legato »)');

  await open(19); await fill(['voix', 'voix']);
  ok((await p.locator('.feedback').innerText()).includes('1 champ à corriger'), 'timbre : « voix, voix » refusé (un seul « voix »)');
  await open(19); await fill(['instrument', 'voix']);
  ok(await p.locator('.feedback.ok').isVisible(), 'timbre : « instrument, voix » accepté dans le désordre');

  // 3d. champs à position fixe : l'ordre compte (Ânes, index 35 : Hi = aigu, Han = grave)
  await open(35);
  await fill(['braiement', 'grave', 'aigu', 'forte', 'rapide', 'lent']);
  ok((await p.locator('.feedback').innerText()).includes('2 champs à corriger'), 'Ânes : « Hi = grave, Han = aigu » inversés → 2 champs à corriger (l\'ordre compte ici)');

  // 3e. espaces et accents (Tortues, index 31) ; synonymes
  await open(31);
  await fill(['Orchestre de CORDES', 'médium / grave', 'MP', 'lent', 'Legato']);
  ok(await p.locator('.feedback.ok').isVisible() && (await p.locator('.feedback').innerText()).includes('Bravo'), 'Tortues : majuscules, « médium / grave » avec espaces, « MP » pour mezzo piano : accepté');

  // 3f. ordre des nuances (index 27) : variantes acceptées, mauvais ordre refusé
  for (const [v, good] of [['pp<p<mp<mf<f<ff', true], ['PP < P < MP < MF < F < FF', true], ['pp, p, mp, mf, f, ff', true], ['pp p mp mf f ff', true], ['p < pp < mp < mf < f < ff', false]]) {
    await open(27); await p.fill('.saisie', v); await p.keyboard.press('Enter');
    ok((await p.locator('.feedback.ok').count()) === (good ? 1 : 0), `ordre des nuances « ${v} » : ${good ? 'accepté' : 'refusé'}`);
  }

  // 3g. abandon après 3 validations ratées (Éléphant, index 33)
  await open(33);
  for (let t = 0; t < 3; t++) await fill(['x', 'x', 'x', 'x']);
  ok(await p.locator('text=Voir la réponse').isVisible(), '« Voir la réponse » après 3 validations ratées');
  await p.locator('text=Voir la réponse').click();
  ok(JSON.stringify((await p.locator('.saisie.champ').evaluateAll(l => l.map(i => i.value)))) === '["grave","mezzo forte","modéré","staccato"]', 'les bonnes réponses sont affichées dans les champs');
  ok(await p.locator('.saisie.champ').evaluateAll(l => l.every(i => i.disabled)) && await p.locator('.panel .btn', { hasText: /suivante/ }).isVisible(), 'champs verrouillés, bouton « Question suivante » disponible');

  // ---- 4. flashcards du programme pour une question à champs ----
  const verso = await p.evaluate(() => decksFromQuizzes()[0].cartes[29].verso);
  ok(verso === 'Hauteur : très grave · Nuance : mp < f > mp · Durée : très rapide · Mode de jeu : legato', 'flashcard du Lion : « ' + verso + ' »');
  const cardsAll = await p.evaluate(() => decksFromQuizzes()[0].cartes);
  ok(cardsAll.length === 40 && cardsAll.every(c => c.recto && c.verso && !/undefined/.test(c.verso)), '40 flashcards générées, aucune vide ni « undefined »');

  // ---- 5. bouton audio ----
  await p.evaluate(() => { QUIZZES[0].lien.url = 'https://digipad.app/p/123'; });
  await open(0);
  const href = await p.locator('.quiz-link').getAttribute('href'), tgt = await p.locator('.quiz-link').getAttribute('target'), rel = await p.locator('.quiz-link').getAttribute('rel');
  ok(href === 'https://digipad.app/p/123' && tgt === '_blank' && rel === 'noopener noreferrer', 'avec une adresse : bouton « ' + (await p.locator('.quiz-link').innerText()) + ' » (nouvel onglet, rel=noopener noreferrer)');
  await p.evaluate(() => { QUIZZES[0].lien.url = 'javascript:alert(1)'; });
  await open(0);
  ok((await p.locator('.quiz-link').count()) === 0, 'une adresse « javascript: » n\'est jamais affichée comme lien');

  // ---- 6. attribution : invisible pour qui ne l'a pas ----
  await p.click('#logout'); await p.fill('#login-pseudo', 'Emma'); await p.fill('#login-pin', '4321'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('.empty').innerText()).includes('Aucune leçon') && !(await p.evaluate(() => JSON.stringify(QUIZZES))).includes('Carnaval'), 'Emma (sans accès) ne voit rien et la page ne contient rien du quiz de musique');
  const adm = w.run('adminData', PW);
  ok(adm.builtins.some(q => q.id === 'musique-carnaval' && q.questions === 40 && q.pour.join() === 'leo'), 'l\'administration le liste parmi les quiz intégrés (40 questions, accès : Léo)');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
