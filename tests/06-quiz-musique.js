const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC, startLesson } = require('./harness');

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
  // le bouton audio s'affiche pendant les questions de la séance
  await startLesson(p, 'Musique descriptive');
  ok((await p.locator('.quiz-link').getAttribute('href')) === 'https://digipad.app/p/1852174/2ea2dfaf331198' && (await p.locator('.quiz-link').innerText()) === '🎧 Écouter les extraits sonores (Padlet / Digipad)', 'bouton audio présent pendant la séance');
  ok((await p.locator('.quiz-link').getAttribute('target')) === '_blank' && (await p.locator('.quiz-link').getAttribute('rel')) === 'noopener noreferrer', 'il s\'ouvre dans un nouvel onglet (noopener noreferrer)');
  await p.click('text=Arrêter'); if (await p.locator('.result').count()) await p.click('text=Retour aux leçons');

  // ---- 2. le corrigé officiel est accepté pour les 40 questions (format sans choix : rappel) ----
  const prev = (i, stage) => p.evaluate(([i, stage]) => revisionPreview('musique-carnaval', i, stage), [i, stage]);
  const fill = async vals => { const ins = p.locator('.saisie.champ'); for (let k = 0; k < vals.length; k++) await ins.nth(k).fill(vals[k]); await p.locator('.panel .btn', { hasText: 'Valider' }).click(); };
  const refused = [];
  for (let i = 0; i < 40; i++) {
    const q = Q.questions[i];
    await prev(i, q.options ? 'qcm' : 'rappel');
    if (i in QCM_KEY) await p.locator('.option', { hasText: q.options[q.correct].slice(0, 40) }).first().click();
    else if (i in TYPED_KEY) { await p.fill('.saisie', TYPED_KEY[i]); await p.keyboard.press('Enter'); }
    else await fill(CHAMPS_KEY[i]);
    if (!(await p.evaluate(() => window.revisionPreviewResult))) refused.push(i + 1);
  }
  ok(refused.length === 0, 'RÉPONDRE AVEC LE CORRIGÉ OFFICIEL : les 40 questions acceptées ' + JSON.stringify(refused));

  // ---- 3. cas limites des questions à plusieurs champs (une validation : les justes en vert, les autres corrigées) ----
  const state = async () => p.locator('.saisie.champ').evaluateAll(l => l.map(i => (i.classList.contains('input-correct') ? 'V' : 'x') + ':' + i.value));
  await prev(29, 'rappel'); await fill(['très grave', 'forte', 'très rapide', 'legato']);
  const st = await state();
  ok(st[0].startsWith('V') && st[2].startsWith('V') && st[3].startsWith('V') && st[1] === 'x:mp < f > mp' && !(await p.evaluate(() => window.revisionPreviewResult)), 'Lion, 1 champ faux sur 4 : les 3 bons en vert, le faux corrigé (« mp < f > mp ») : ' + st.join(' | '));
  await prev(29, 'rappel'); await fill(['très grave', 'mp<f>mp', 'très rapide', 'legato']);
  ok(await p.evaluate(() => window.revisionPreviewResult), '« mp<f>mp » (sans espaces) accepté pour « mp < f > mp »');
  await prev(21, 'rappel'); await fill(['grave', 'aigu', 'médium']);
  ok(await p.evaluate(() => window.revisionPreviewResult), 'ordre libre : « grave, aigu, médium » accepté');
  await prev(21, 'rappel'); await fill(['aigu', 'aigu', 'grave']);
  ok(!(await p.evaluate(() => window.revisionPreviewResult)) && (await state()).filter(x => x.startsWith('V')).length === 2, 'doublon « aigu, aigu, grave » : un seul « aigu » compte');
  await prev(39, 'rappel'); await fill(['grâce', 'médium', 'mezzo forte', 'modéré', 'vibrato', 'legato']);
  ok(await p.evaluate(() => window.revisionPreviewResult), 'Cygne : « vibrato, legato » accepté dans le désordre');
  await prev(39, 'rappel'); await fill(['grâce', 'médium', 'mezzo forte', 'modéré', 'legato', 'legato']);
  ok(!(await p.evaluate(() => window.revisionPreviewResult)), 'Cygne : « legato, legato » refusé (un seul « legato »)');
  await prev(19, 'rappel'); await fill(['instrument', 'voix']);
  ok(await p.evaluate(() => window.revisionPreviewResult), 'timbre : « instrument, voix » accepté dans le désordre');
  await prev(35, 'rappel'); await fill(['braiement', 'grave', 'aigu', 'forte', 'rapide', 'lent']);
  ok((await state()).filter(x => x.startsWith('x')).length === 2, 'Ânes : « Hi = grave, Han = aigu » inversés : 2 champs corrigés (l\'ordre compte ici)');
  await prev(31, 'rappel'); await fill(['Orchestre de CORDES', 'médium / grave', 'MP', 'lent', 'Legato']);
  ok(await p.evaluate(() => window.revisionPreviewResult), 'Tortues : majuscules, « médium / grave » avec espaces, « MP » pour mezzo piano : accepté');
  for (const [v, good] of [['pp<p<mp<mf<f<ff', true], ['PP < P < MP < MF < F < FF', true], ['pp, p, mp, mf, f, ff', true], ['pp p mp mf f ff', true], ['p < pp < mp < mf < f < ff', false]]) {
    await prev(27, 'rappel'); await p.fill('.saisie', v); await p.keyboard.press('Enter');
    ok((await p.evaluate(() => window.revisionPreviewResult)) === good, `ordre des nuances « ${v} » : ${good ? 'accepté' : 'refusé'}`);
  }
  // « Je ne sais pas » sur une question à champs (Éléphant, index 33) : solutions affichées partout
  await prev(33, 'rappel');
  ok(await p.locator('text=Je ne sais pas').isVisible(), '« Je ne sais pas » visible dès la première présentation');
  await p.locator('text=Je ne sais pas').click();
  ok(JSON.stringify(await p.locator('.saisie.champ').evaluateAll(l => l.map(i => i.value))) === '["grave","mezzo forte","modéré","staccato"]' && await p.locator('.saisie.champ').evaluateAll(l => l.every(i => i.disabled)), 'les bonnes réponses sont affichées, champs verrouillés');
  // une question à choix dans le format « rappel » : QCM masqué (réfléchir d'abord) avec plus de choix
  await prev(0, 'rappel');
  ok((await p.locator('.option').count()) === 0 && await p.locator('.masked-btns').isVisible(), 'rappel d\'un QCM : les choix sont cachés, l\'élève réfléchit d\'abord');
  await p.locator('.masked-btns .btn').first().click();
  ok((await p.locator('.option').count()) >= 4, 'puis 4 ou 5 choix (les 3 d\'origine + des réponses d\'autres questions de la leçon) : ' + await p.locator('.option').count());

  // ---- 4. flashcards pour une question à champs ----
  const verso = await p.evaluate(() => decksFromQuizzes()[0].cartes[29].verso);
  ok(verso === 'Hauteur : très grave · Nuance : mp < f > mp · Durée : très rapide · Mode de jeu : legato', 'flashcard du Lion : « ' + verso + ' »');
  const cardsAll = await p.evaluate(() => decksFromQuizzes()[0].cartes);
  ok(cardsAll.length === 40 && cardsAll.every(c => c.recto && c.verso && !/undefined/.test(c.verso)), '40 flashcards générées, aucune vide ni « undefined »');

  // ---- 5. attribution : invisible pour qui ne l'a pas ----
  await p.evaluate(() => { activeTab = 'quiz'; renderList(); });
  await p.click('#logout'); await p.fill('#login-pseudo', 'Emma'); await p.fill('#login-pin', '4321'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('.empty').innerText()).includes('Aucune leçon') && !(await p.evaluate(() => JSON.stringify(QUIZZES))).includes('Carnaval'), 'Emma (sans accès) ne voit rien et la page ne contient rien du quiz de musique');
  const adm = w.run('adminData', PW);
  ok(adm.builtins.some(q => q.id === 'musique-carnaval' && q.questions === 40 && q.pour.join() === 'leo'), 'l\'administration le liste parmi les quiz intégrés (40 questions, accès : Léo)');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
