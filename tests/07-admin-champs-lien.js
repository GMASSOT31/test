const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC } = require('./harness');
const w = makeWorld(); w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
const Q = (extra) => ({ titre: 'T', questions: [{ question: 'q ?', ...extra }] });
const err = q => w.try('saveQuiz', PW, q).err;

(async () => {
  // ---- serveur : validation des questions à plusieurs champs et du lien ----
  const f2 = [{ label: 'A', reponses: ['a'] }, { label: 'B', reponses: ['b'] }];
  const good = w.run('saveQuiz', PW, { titre: 'Champs', pour: ['leo'], lien: { texte: 'Extraits', url: 'https://digipad.app/p/1' }, questions: [{ question: 'Q ?', libre: true, champs: [{ label: 'A', reponses: ['a', 'A bis'] }, { label: 'B', reponses: ['b'], groupe: 'g1' }] }] });
  const st = JSON.parse(w.props['quiz_' + good.id]);
  ok(st.questions[0].champs.length === 2 && st.questions[0].libre === true && st.questions[0].champs[1].groupe === 'g1' && !('options' in st.questions[0]) && !('reponses' in st.questions[0]), 'question à champs enregistrée (libre, groupe, sans options) : ' + JSON.stringify(st.questions[0]).slice(0, 110));
  ok(JSON.stringify(st.lien) === '{"texte":"Extraits","url":"https://digipad.app/p/1"}', 'lien enregistré : ' + JSON.stringify(st.lien));
  ok(err(Q({ champs: [f2[0]] })).includes('entre 2 et 12 champs'), '1 seul champ refusé');
  ok(err(Q({ champs: Array.from({ length: 13 }, (_, i) => ({ label: 'c' + i, reponses: ['x'] })) })).includes('entre 2 et 12 champs'), '13 champs refusés');
  ok(err(Q({ champs: [{ label: '', reponses: ['a'] }, f2[1]] })).includes("l'intitulé est vide"), 'intitulé vide refusé : ' + err(Q({ champs: [{ label: '', reponses: ['a'] }, f2[1]] })));
  ok(err(Q({ champs: [{ label: 'A', reponses: [] }, f2[1]] })).includes('au moins') || err(Q({ champs: [{ label: 'A', reponses: [] }, f2[1]] })).includes('entre 1 et 10'), 'champ sans réponse acceptée refusé');
  ok(err(Q({ champs: [{ label: 'A', reponses: ['a'], groupe: '<b>' }, f2[1]] })).includes('groupe'), 'nom de groupe avec des signes dangereux refusé');
  ok(err({ titre: 'T', lien: { url: 'javascript:alert(1)' }, questions: [{ question: 'q', options: ['a', 'b'], correct: 0 }] }).includes('http'), 'lien « javascript: » refusé');
  ok(err({ titre: 'T', lien: { url: 'ftp://x.org/f' }, questions: [{ question: 'q', options: ['a', 'b'], correct: 0 }] }).includes('http'), 'lien « ftp: » refusé');
  const noLink = w.run('saveQuiz', PW, { titre: 'Sans lien', lien: { texte: 'seul' }, questions: [{ question: 'q', options: ['a', 'b'], correct: 0 }] });
  ok(!('lien' in JSON.parse(w.props['quiz_' + noLink.id])), 'texte sans adresse : aucun lien enregistré');
  const defTxt = w.run('saveQuiz', PW, { titre: 'Texte par défaut', lien: { url: 'https://exemple.org' }, questions: [{ question: 'q', options: ['a', 'b'], correct: 0 }] });
  ok(JSON.parse(w.props['quiz_' + defTxt.id]).lien.texte === 'Ouvrir le lien', 'adresse sans texte : « Ouvrir le lien » par défaut');
  for (const id of [noLink.id, defTxt.id]) w.run('deleteQuiz', PW, id);

  // ---- administration : création complète par l'interface ----
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1100, height: 1000 } }); await install(c, w);
  const errs = [];
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message)); a.on('dialog', d => d.accept());
  await a.goto('file://' + SRC + 'admin.html'); await a.fill('#password', PW); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])');
  // on repart d'un site propre : on retire le quiz « Champs » créé pour le test serveur
  w.run('deleteQuiz', PW, good.id); await a.click('#unlock'); await a.waitForSelector('#lock-status.ok');

  await a.click('#tab-quiz-ajout');
  await a.fill('#titre', 'Analyse musicale'); await a.fill('#matiere', 'Musique');
  await a.fill('#lien-texte', 'Écouter les extraits'); await a.fill('#lien-url', 'https://digipad.app/p/1852174/2ea2dfaf331198');
  await a.locator('#quiz-pour .pour-item', { hasText: 'Léo' }).locator('input').check();
  // question 1 : plusieurs champs, ordre fixe
  await a.fill('.q-text', 'Analyse du Lion : complète.'); await a.locator('.q-type').nth(0).selectOption('fields');
  ok(await a.locator('.question').nth(0).locator('.fields-area').isVisible() && await a.locator('.question').nth(0).locator('.choice-area').isHidden(), 'type « Plusieurs champs » : la zone des champs s\'affiche, celle des choix se masque');
  ok((await a.locator('.question').nth(0).locator('.field-row').count()) === 2, '2 champs proposés par défaut');
  await a.locator('.question').nth(0).locator('text=+ Ajouter un champ').click();
  const rows = a.locator('.question').nth(0).locator('.field-row');
  const setRow = async (i, l, r, g = '') => { await rows.nth(i).locator('.f-label').fill(l); await rows.nth(i).locator('.f-reps').fill(r); await rows.nth(i).locator('.f-groupe').fill(g); };
  await setRow(0, 'Hauteur', 'très grave'); await setRow(1, 'Nuance', 'mp < f > mp ; mp<f>mp'); await setRow(2, 'Mode de jeu', 'legato');
  // question 2 : plusieurs champs, ordre libre
  await a.click('#add-question'); await a.locator('.q-type').nth(1).selectOption('fields');
  await a.locator('.q-text').nth(1).fill('Cite deux couleurs primaires.'); await a.locator('.q-libre').nth(1).selectOption('libre');
  const rows2 = a.locator('.question').nth(1).locator('.field-row');
  await rows2.nth(0).locator('.f-label').fill('Couleur 1'); await rows2.nth(0).locator('.f-reps').fill('rouge');
  await rows2.nth(1).locator('.f-label').fill('Couleur 2'); await rows2.nth(1).locator('.f-reps').fill('bleu');
  await a.locator('.question').nth(1).locator('.q-expl').fill('Rouge, jaune, bleu.');
  await a.click('#save-quiz'); await a.waitForSelector('#quizlist-status.ok', { timeout: 8000 });
  const id = Object.keys(w.props).find(k => k.startsWith('quiz_'));
  const saved = JSON.parse(w.props[id]);
  ok(saved.questions[0].champs.length === 3 && saved.questions[0].champs[1].reponses.join('|') === 'mp < f > mp|mp<f>mp' && !saved.questions[0].libre, 'question 1 enregistrée : 3 champs, réponses multiples, ordre fixe');
  ok(saved.questions[1].libre === true && saved.questions[1].explication === 'Rouge, jaune, bleu.', 'question 2 enregistrée : ordre libre + explication');
  ok(saved.lien && saved.lien.url === 'https://digipad.app/p/1852174/2ea2dfaf331198' && saved.lien.texte === 'Écouter les extraits', 'lien enregistré depuis le formulaire');

  // validations côté formulaire
  await a.click('#tab-quiz-ajout'); await a.click('#reset-quiz'); await a.fill('#titre', 'X'); await a.fill('#lien-url', 'javascript:alert(1)'); await a.fill('.q-text', 'q'); const o = a.locator('.opt-text'); await o.nth(0).fill('a'); await o.nth(1).fill('b');
  await a.click('#save-quiz'); await a.waitForSelector('#quiz-status.err');
  ok((await a.locator('#quiz-status').innerText()).includes('http'), 'formulaire : adresse « javascript: » refusée : « ' + await a.locator('#quiz-status').innerText() + ' »');
  await a.click('#reset-quiz'); await a.fill('#titre', 'X'); await a.fill('.q-text', 'q'); await a.locator('.q-type').nth(0).selectOption('fields');
  await a.click('#save-quiz'); await a.waitForSelector('#quiz-status.err');
  ok((await a.locator('#quiz-status').innerText()).includes("l'intitulé est vide"), 'formulaire : champs vides refusés : « ' + await a.locator('#quiz-status').innerText() + ' »');
  await a.click('#reset-quiz');

  // modification : tout est rechargé tel quel, puis ré-enregistré à l'identique
  await a.click('#tab-quiz-liste'); await a.locator('#quiz-list .item', { hasText: 'Analyse musicale' }).locator('text=Modifier').click();
  ok((await a.locator('#lien-url').inputValue()) === saved.lien.url && (await a.locator('#lien-texte').inputValue()) === saved.lien.texte, 'modification : lien rechargé');
  ok((await a.locator('.q-type').nth(0).inputValue()) === 'fields' && (await a.locator('.question').nth(0).locator('.field-row').count()) === 3 && (await a.locator('.q-libre').nth(1).inputValue()) === 'libre', 'modification : types, champs et ordre libre rechargés');
  await a.evaluate(() => { document.querySelector('#quizlist-status').className = 'status'; });
  await a.click('#save-quiz'); await a.waitForSelector('#quizlist-status.ok');
  const again = JSON.parse(w.props[id]);
  ok(JSON.stringify({ ...again, ajoute: 0 }) === JSON.stringify({ ...saved, ajoute: 0 }), 'ré-enregistré sans rien changer : contenu strictement identique');

  // ---- côté élève : il voit le quiz, le lien, et joue les deux questions ----
  const s = await c.newPage(); s.on('pageerror', e => errs.push('élève : ' + e.message));
  await s.goto('file://' + SRC + 'Index.html'); await login(s, LEO);
  await s.locator('.card', { hasText: 'Analyse musicale' }).click();
  ok((await s.locator('.quiz-link').getAttribute('href')) === saved.lien.url && (await s.locator('.quiz-link').innerText()) === '🔗 Écouter les extraits', 'ÉLÈVE : bouton « ' + await s.locator('.quiz-link').innerText() + ' » (icône par défaut 🔗)');
  const ins = s.locator('.saisie.champ'); await ins.nth(0).fill('très grave'); await ins.nth(1).fill('MP<F>MP'); await ins.nth(2).fill('Legato'); await s.locator('.panel .btn', { hasText: 'Valider' }).click();
  ok((await s.locator('.feedback.ok').innerText()).includes('Bravo'), 'ÉLÈVE : question à champs réussie du premier coup (casse et espaces ignorés)');
  await s.locator('.panel .btn', { hasText: 'suivante' }).click();
  const ins2 = s.locator('.saisie.champ'); await ins2.nth(0).fill('Bleu'); await ins2.nth(1).fill('rouge'); await s.locator('.panel .btn', { hasText: 'Valider' }).click();
  ok((await s.locator('.feedback.ok').innerText()).includes('Bravo') && (await s.locator('.explication').innerText()) === 'Rouge, jaune, bleu.', 'ÉLÈVE : ordre libre accepté (« bleu, rouge ») et explication affichée');
  await s.locator('.panel .btn', { hasText: /résultat/ }).click();
  ok((await s.locator('.final').innerText()) === '2 / 2', 'ÉLÈVE : score 2 / 2');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
