// cible: cloudflare
// Questions de synthèse (16/11/2026) : générées par l'IA à la création (15 % arrondi au-dessus, réponse modèle, 3 à 5 éléments
// attendus), proposées quand les bases sont maîtrisées (plus souvent à l'approche du contrôle), rédaction → corrigé →
// autoévaluation (réussi / partiellement / pas réussi) qui alimente la répétition espacée existante ; aucun appel IA ensuite.
const { chromium } = require('playwright');
const { makeWorldCf, install, ok, summary, page } = require('./harness');
const DAY = 86400000;
const P = n => page(n, 'cloudflare');

const SYN = (i, nb = 4) => ({ question: 'Explique comment ' + i + ' ?', synthese: true, modele: 'Réponse modèle ' + i + '. Deux phrases au moins.',
  attendus: Array.from({ length: nb }, (_, k) => 'Élément ' + i + '.' + (k + 1)) });
const BASE = i => ({ question: 'Question de base ' + i + ' ?', options: ['Bonne ' + i, 'Fausse A', 'Fausse B', 'Fausse C'], correct: 0 });
const REPONSE_IA = `Voici :
\`\`\`json
{ "titre": "SVT 5ᵉ : la circulation sanguine", "matiere": "SVT", "emoji": "❤️",
  "questions": [
    { "question": "Quel organe propulse le sang ?", "options": ["Le cœur", "Les poumons", "Le foie", "L'estomac"], "bonne_reponse": "Le cœur", "rappel": ["cœur"] },
    { "question": "Où le sang se charge-t-il en dioxygène ?", "options": ["Les poumons", "Le cœur", "Les reins", "Les muscles"], "bonne_reponse": "A" },
    { "question": "Quels vaisseaux ramènent le sang au cœur ?", "options": ["Les veines", "Les artères", "Les nerfs", "Les os"], "bonne_reponse": "Les veines" }
  ],
  "syntheses": [
    { "question": "Explique comment le cœur, les poumons et les vaisseaux sanguins travaillent ensemble pour apporter du dioxygène aux organes.",
      "reponse_modele": "Le cœur propulse le sang. Le sang passe par les poumons où il se charge en dioxygène. Les artères l'envoient aux organes. Les veines le ramènent au cœur.",
      "elements_attendus": ["Le cœur propulse le sang.", "Les poumons oxygènent le sang.", "Les artères vont du cœur aux organes.", "Les veines ramènent le sang au cœur."] },
    { "question": "Pourquoi le sang doit-il circuler en permanence ?", "réponse_modèle": "Les organes ont besoin de dioxygène en continu.", "éléments_attendus": "- Les organes consomment du dioxygène\\n- Le sang le leur apporte sans arrêt\\n- Sinon les cellules meurent" },
    { "question": "Synthèse sans corrigé", "elements_attendus": ["a", "b", "c"] }
  ] }
\`\`\``;

(async () => {
  const w = makeWorldCf({ ADMIN_PASSWORD: 'secret12' });
  const ADM = { pseudo: 'Papa', password: 'secret12' };
  w.run('adminData', ADM);
  w.run('saveStudent', ADM, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  const L = ['5B', 'Léo', '1234'];

  // ---- 1. serveur : validation ----
  const err = (fn, ...a) => w.try(fn, ...a).err || '';
  ok(err('saveQuiz', ADM, { titre: 'x', questions: [BASE(1), { question: 'S ?', synthese: true, modele: '', attendus: ['a', 'b', 'c'] }] }).includes('réponse modèle est vide')
    && err('saveQuiz', ADM, { titre: 'x', questions: [BASE(1), { question: 'S ?', synthese: true, modele: 'm', attendus: ['a'] }] }).includes('entre 2 et 5 éléments')
    && err('saveQuiz', ADM, { titre: 'x', questions: [BASE(1), SYN(1, 6)] }).includes('entre 2 et 5 éléments'), 'synthèse invalide refusée (réponse modèle vide, éléments hors 2 à 5)');
  ok(err('saveQuiz', ADM, { titre: 'x', questions: [SYN(1)] }).includes('au moins une question en plus') && err('saveQuiz', ADM, { titre: 'x', questions: [BASE(1)].concat(Array.from({ length: 11 }, (_, i) => SYN(i))) }).includes('Maximum 10 questions de synthèse'),
    'une leçon ne peut pas n\'avoir que des synthèses ; 10 synthèses au plus');
  ok(!!w.try('saveQuiz', ADM, { titre: 'Grosse', questions: Array.from({ length: 60 }, (_, i) => BASE(i)).concat(Array.from({ length: 9 }, (_, i) => SYN(i))) }).ok, '60 questions + 9 synthèses (15 % de 60, arrondi au-dessus) : acceptées');
  const id = w.run('saveQuiz', ADM, { titre: 'SVT : le sang', matiere: 'SVT', emoji: '❤️', pour: ['leo'], questions: Array.from({ length: 10 }, (_, i) => BASE(i)).concat([SYN('a'), SYN('b', 3)]) }).id;
  const quiz = () => w.run('getStudentData', ...L).quizzes.find(q => q.id === id);
  const synQ = quiz().questions.filter(q => q.synthese), baseQ = quiz().questions.filter(q => !q.synthese);
  ok(synQ.length === 2 && synQ[0].modele.startsWith('Réponse modèle a') && synQ[0].attendus.length === 4 && /^[0-9a-f]{8}$/.test(synQ[0].id), 'enregistrée avec la leçon : réponse modèle, éléments attendus, identifiant stable');

  // ---- 2. serveur : autoévaluation → répétition espacée existante ----
  const s0 = synQ[0].id; let op = 0;
  const syn = (ev, txt = 'Ma réponse', sid = 's' + op) => w.run('answerSynthese', ...L, id, s0, ev, txt, sid, 'op' + (++op)).item;
  ok(err('answerSynthese', ...L, id, s0, 'bof', '', 's', 'x').includes('Autoévaluation invalide') && err('answerSynthese', ...L, id, baseQ[0].id, 'reussi', '', 's', 'y') === 'Question inconnue.', 'autoévaluation inconnue, ou question qui n\'est pas une synthèse : refusées');
  let it = syn('reussi');
  ok(it[0] === 1 && it[3] === 1, 'nouvelle synthèse réussie : niveau 1 (Découverte), comme une question découverte');
  w.advance(2 * DAY); it = syn('reussi');
  const due2 = it[1];
  ok(it[0] === 2 && due2 - w.now() > 2 * DAY, 'à revoir, « J\'ai réussi » : niveau +1 (Rappelée), intervalle plus long (J+3)');
  w.advance(4 * DAY); it = syn('partiel');
  ok(it[0] === 2 && it[1] - w.now() < 3 * DAY, '« Partiellement » : niveau inchangé, elle revient plus vite qu\'après une réussite');
  w.advance(4 * DAY); it = syn('non', 'Je ne sais pas trop');
  ok(it[0] === 1 && it[1] - w.now() <= DAY && it[2] === 1 && it[4] === 0, '« Je n\'ai pas réussi » : retour au niveau 1, revient à court terme (demain) ; pas compté « en étant sûr »');
  const rep = w.run('answerSynthese', ...L, id, s0, 'reussi', 'rejouée', 'sX', 'op' + op);
  ok(rep.rejoue && rep.item[0] === 1, 'même opération rejouée (réseau) : comptée une seule fois');
  const hist = w.run('getStudentData', ...L).srs[id].syn[s0];
  ok(hist.length === 3 && hist[2][1] === 'non' && hist[2][2] === 'Je ne sais pas trop', 'réponses rédigées et autoévaluations enregistrées (3 dernières)');
  const sum = w.run('adminData', ADM).progress.leo.find(l => l.id === id).syntheses;
  ok(sum.length === 2 && sum[0].dernier.eval === 'non' && sum[0].dernier.texte === 'Je ne sais pas trop' && sum[1].dernier === null, 'suivi parent : dernière autoévaluation et réponse de chaque synthèse');

  // ---- 3. page élève : la synthèse arrive quand les bases sont maîtrisées ----
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await install(c, w);
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(P('Index.html'));
  await p.fill('#login-classe', '5B'); await p.fill('#login-pseudo', 'Léo'); await p.fill('#login-pin', '1234'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  const taches = () => p.evaluate(i => buildTasks({ quiz: QUIZZES.find(q => q.id === i) }).map(t => (t.q.synthese ? 'S' : t.stage[0])).join(''), id);
  const fixe = (niv, examJours) => p.evaluate(([i, niv, examJours]) => {
    const z = QUIZZES.find(q => q.id === i), r = SRS[i] || (SRS[i] = { it: {}, plan: [], ses: [] });
    z.questions.filter(q => !q.synthese).forEach((q, k) => { r.it[q.id] = [k < niv ? 2 : 1, now() + 9 * 86400000, 0, 1, 0]; });
    z.questions.filter(q => q.synthese).forEach(q => { delete r.it[q.id]; });
    r.exam = examJours == null ? '' : isoDate(now() + examJours * 86400000); r.cfg = true;
  }, [id, niv, examJours]);
  await fixe(4);
  ok(!(await taches()).includes('S'), 'bases pas encore maîtrisées (4/10 Rappelées) : pas de question de synthèse');
  await fixe(5);
  ok(/S$/.test(await taches()) && (await taches()).split('S').length - 1 === 1, 'bases maîtrisées (5/10) : UNE question de synthèse, en fin de séance');
  await fixe(3, 5);
  ok((await taches()).split('S').length - 1 === 2, 'contrôle dans 5 jours : seuil plus bas (3/10 suffisent) et jusqu\'à 2 synthèses');
  await fixe(3, 20);
  ok(!(await taches()).includes('S'), 'contrôle dans 20 jours : seuil normal');
  ok(await p.evaluate(i => !newList(QUIZZES.find(q => q.id === i)).some(q => q.synthese), id) && await p.evaluate(i => deckOf(QUIZZES.find(q => q.id === i)).cartes.some(k => k.verso.startsWith('Réponse modèle')), id),
    'les synthèses ne passent pas par les cartes « Je découvre » ; flashcard : la réponse modèle au verso');

  // ---- 4. page élève : rédiger, valider, comparer, s'autoévaluer ----
  await fixe(5);
  await p.evaluate(i => { const z = QUIZZES.find(q => q.id === i); SRS[i].tf = true; startSession({ quiz: z }); S.tasks = S.tasks.filter(t => t.stage === 'synthese'); S.i = 0; showTask(); }, id);
  await p.waitForSelector('.syn-texte');
  ok((await p.locator('.stage-chip').innerText()).includes('Synthèse') && await p.locator('.syn-corrige').count() === 0 && (await p.locator('.panel.session .question').innerText()).startsWith('Explique comment'), 'la question s\'affiche avec une zone de texte, sans le corrigé');
  await p.fill('.syn-texte', 'Le cœur pousse le sang vers les poumons.');
  await p.click('.syn .btn:has-text("Valider")');
  await p.waitForSelector('.syn-corrige');
  const cases = p.locator('.syn-item input');
  ok((await p.locator('.syn-texte').getAttribute('readonly')) !== null && (await p.locator('.syn-corrige').innerText()).includes('Réponse modèle') && (await cases.count()) >= 3, 'après « Valider » : réponse figée, réponse modèle et éléments attendus en liste à cocher');
  const tailles = await p.locator('.syn-eval').evaluateAll(l => l.map(e => e.getBoundingClientRect().height));
  ok(JSON.stringify(await p.locator('.syn-eval strong').allInnerTexts()) === '["✅ J\'ai réussi","🟡 Partiellement","❌ Je n\'ai pas réussi"]' && tailles.every(t => t >= 48), '3 boutons d\'autoévaluation, 48 px au moins (téléphone)');
  await cases.nth(0).check();
  ok(await p.locator('.syn-eval.syn-partiel.suggere').count() === 1, 'des éléments cochés, pas tous : « Partiellement » suggéré (l\'enfant décide)');
  for (let k = 1; k < await cases.count(); k++) await cases.nth(k).check();
  ok(await p.locator('.syn-eval.syn-reussi.suggere').count() === 1, 'tout coché : « J\'ai réussi » suggéré');
  const qS = await p.evaluate(() => S.tasks[S.i].q.id);
  await p.click('.syn-eval.syn-partiel');
  await p.evaluate(() => revisionFlush());
  const srv = JSON.parse(w.props['srs_leo__' + id]);
  ok(srv.it[qS] && srv.it[qS][0] === 1 && srv.syn[qS].slice(-1)[0][1] === 'partiel' && srv.syn[qS].slice(-1)[0][2] === 'Le cœur pousse le sang vers les poumons.', 'autoévaluation enregistrée sur le serveur avec la réponse rédigée');
  ok((await p.locator('.mastery-line').innerText()).includes('Presque') && await p.locator('.next-btn').isVisible() && await p.locator('.auto-next:visible').count() === 0, 'message adapté, pas de passage automatique (le temps de relire)');
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'téléphone : rien ne déborde');

  // ---- 5. espace parents : le prompt IA, la réponse collée, l'éditeur ----
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message));
  await c.grantPermissions(['clipboard-read', 'clipboard-write']);
  await a.goto(P('admin.html')); await a.fill('#admin-pseudo', 'Papa'); await a.fill('#password', 'secret12'); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])');
  const pr = await a.evaluate(() => [buildPrompt(20, '5ᵉ'), buildPrompt(60, '3ᵉ'), buildPrompt(10, 'CM2')]);
  ok(pr[0].includes('3 QUESTIONS DE SYNTHÈSE') && pr[1].includes('9 QUESTIONS DE SYNTHÈSE') && pr[2].includes('2 QUESTIONS DE SYNTHÈSE'), 'prompt IA : 15 % de synthèses, arrondi au-dessus (20 → 3, 60 → 9, 10 → 2)');
  ok(['"syntheses"', '"reponse_modele"', '"elements_attendus"', '3 à 5 idées essentielles', 'au moins 2 notions', 'trop courte', 'voire aucune', 'élève de 5ᵉ'].every(t => pr[0].includes(t)), 'prompt : plusieurs notions, réponse modèle, 3 à 5 éléments, âge, cas de la leçon trop courte, format JSON');
  await a.click('#tab-quiz-liste'); await a.click('#tab-quiz-ajout'); await a.click('#mode-ia'); await a.click('#ia-next-1');
  await a.fill('#ia-answer', REPONSE_IA);
  await a.waitForSelector('#ia-parse-status.ok');
  ok((await a.locator('#ia-parse-status').innerText()).includes('3 questions + 2 de synthèse'), 'réponse de l\'IA lue : ' + await a.locator('#ia-parse-status').innerText());
  await a.click('#ia-next-2');
  ok((await a.locator('#ia-summary').innerText()).includes('3 questions + 2 de synthèse') && (await a.locator('#ia-summary').innerText()).includes('1 question de synthèse ignorée') && (await a.locator('#ia-questions li.ia-syn').count()) === 2, 'vérification : synthèses comptées à part, synthèse sans corrigé signalée, aperçu avec réponse modèle');
  await a.click('#ia-save');
  await a.waitForSelector('#quizlist-status.ok, #prog-status.ok');
  const cree = Object.keys(w.props).filter(k => k.startsWith('quiz_') && !k.includes('~')).map(k => JSON.parse(w.props[k])).find(q => q.titre === 'SVT 5ᵉ : la circulation sanguine');
  const sy = cree.questions.filter(q => q.synthese);
  ok(sy.length === 2 && sy[1].attendus.length === 3 && sy[1].attendus[0] === 'Les organes consomment du dioxygène' && sy[0].modele.startsWith('Le cœur propulse'), 'leçon créée avec ses 2 synthèses (champs avec accents et liste en texte compris)');
  // l'éditeur garde les synthèses
  await a.evaluate(i => loadQuiz(DATA.quizzes.find(q => q.id === i)), cree.id);
  const types = await a.locator('#questions .q-type').evaluateAll(l => l.map(s => s.value));
  ok(types.filter(t => t === 'synthese').length === 2 && (await a.locator('#questions .question').nth(3).locator('.syn-modele').inputValue()).startsWith('Le cœur propulse') && (await a.locator('#questions .question').nth(3).locator('.syn-attendus').inputValue()).split('\n').length === 4, 'éditeur : type « Synthèse », réponse modèle et éléments affichés');
  ok(!(await a.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'éditeur sur téléphone : rien ne déborde');
  await a.click('#save-quiz');
  await a.waitForSelector('#quizlist-status.ok');
  const apres = JSON.parse(w.props['quiz_' + cree.id]);
  ok(JSON.stringify(apres.questions.filter(q => q.synthese)) === JSON.stringify(sy), 'enregistrer depuis l\'éditeur ne perd rien (mêmes synthèses, mêmes identifiants)');

  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close();
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
