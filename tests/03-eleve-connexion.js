const { chromium } = require('playwright');
const fs = require('fs');
const { makeWorld, install, ok, summary, seed, login, LEO, EMMA, PW, SRC } = require('./harness');
const URL_ = 'file://' + SRC + 'Index.html';

(async () => {
  const w = makeWorld(); seed(w);
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1000, height: 900 } });      // = UN SEUL appareil, partagé par les deux enfants
  await install(c, w);
  const errs = [];
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL_);

  // ---- 1. écran de connexion, aucun contenu dans la page ----
  ok(await p.locator('#login').isVisible() && !(await p.locator('#app').isVisible()), 'au départ : seul l\'écran de connexion est visible');
  const labels = await p.locator('#login-form label').allInnerTexts();
  ok(JSON.stringify(labels) === '["Classe","Pseudo","PIN"]', 'trois champs : ' + labels.join(', '));
  ok((await p.locator('#login-pin').getAttribute('type')) === 'password' && (await p.locator('#login-pin').getAttribute('inputmode')) === 'numeric', 'le PIN est masqué et le clavier numérique est demandé');
  const html = fs.readFileSync(SRC + 'Index.html', 'utf8');
  ok(!/sahara square|Justinien|Constantinople|Zootopia/.test(html), 'le fichier de la page ne contient plus aucun quiz (ils viennent du serveur)');
  ok((await p.evaluate(() => QUIZZES.length + FLASHCARDS.length)) === 0, 'avant connexion : aucune donnée en mémoire');

  // ---- 2. mauvais identifiants ----
  await p.fill('#login-classe', '5B'); await p.fill('#login-pseudo', 'Léo'); await p.fill('#login-pin', '9999'); await p.click('#login-btn');
  await p.waitForFunction(() => document.querySelector('#login-error').textContent.length > 0);
  ok((await p.locator('#login-error').innerText()) === 'Classe, pseudo ou PIN incorrect.', 'mauvais PIN : « ' + await p.locator('#login-error').innerText() + ' » (sans préfixe « Error: »)');
  ok(await p.locator('#login').isVisible() && (await p.locator('#login-pin').inputValue()) === '' && (await p.locator('#login-pseudo').inputValue()) === 'Léo', 'on reste sur la connexion, PIN effacé, pseudo conservé');
  ok(await p.locator('#login-btn').isEnabled(), 'bouton de nouveau utilisable');

  // ---- 3. Léo ----
  await login(p, LEO);
  const leoCards = await p.locator('.card h3').allInnerTexts();
  ok(JSON.stringify(leoCards) === JSON.stringify(['Grand quiz : Byzance et l\'Empire carolingien', 'Zootopia : les quartiers']), 'Léo voit ses 2 quiz : ' + leoCards.join(' / '));
  ok((await p.locator('#whoami-name').innerText()) === '👤 Léo · 5B', 'bandeau « 👤 Léo · 5B »');
  ok((await p.locator('#count-quiz').innerText()) === '2' && (await p.locator('#count-programme').innerText()) === '40', 'compteurs : 2 quiz, 40 cartes à apprendre (30 + 10)');
  ok((await p.locator('#rvStreak').innerText()) === '🔥 Série : 1 jour', 'série de jours de Léo : ' + await p.locator('#rvStreak').innerText());
  await p.click('#tab-flashcards');
  const leoDecks = await p.locator('.card h3').allInnerTexts();
  ok(leoDecks.length === 3 && leoDecks.includes('Mots anglais') && !leoDecks.some(t => t.includes('Maths')), 'flashcards de Léo : ses 2 paquets générés + « Mots anglais » : ' + leoDecks.join(' / '));
  // Léo réussit Zootopia Q1 + rate Q2 => progression à lui
  await p.click('#tab-quiz'); await p.locator('.card', { hasText: 'Zootopia' }).click();
  await p.fill('.saisie', 'sahara square'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  await p.fill('.saisie', 'faux'); await p.keyboard.press('Enter');
  await p.evaluate(() => revisionFlush());
  ok(Object.keys(w.props).filter(k => k.startsWith('prog_')).join() === 'prog_leo__zootopia', 'progression enregistrée SUR LE SERVEUR, au nom de Léo : ' + Object.keys(w.props).filter(k => k.startsWith('prog_')).join());
  ok(!(await p.evaluate(() => JSON.stringify(QUIZZES))).includes('Maths'), 'aucune trace du quiz d\'Emma dans la page de Léo');

  // ---- 4. déconnexion puis Emma sur le MÊME appareil ----
  await p.evaluate(() => revisionFlush()); await p.click('#logout');
  ok(await p.locator('#login').isVisible() && !(await p.locator('#app').isVisible()), 'déconnexion : retour à l\'écran de connexion');
  ok((await p.locator('#login-classe').inputValue()) === '5B' && (await p.locator('#login-pseudo').inputValue()) === 'Léo' && (await p.locator('#login-pin').inputValue()) === '', 'classe et pseudo préremplis, PIN jamais conservé');
  ok((await p.evaluate(() => QUIZZES.length)) === 0, 'après déconnexion : les données de Léo ont quitté la mémoire de la page');
  await p.fill('#login-pseudo', 'Emma'); await p.fill('#login-pin', '4321'); await p.click('#login-btn');
  await p.waitForSelector('#app:not([hidden])');
  const emmaCards = await p.locator('.card h3').allInnerTexts();
  ok(JSON.stringify(emmaCards) === JSON.stringify(['Byzance et l\'Europe carolingienne', 'Maths']), 'Emma voit ses 2 quiz : ' + emmaCards.join(' / '));
  ok(!(await p.evaluate(() => JSON.stringify([QUIZZES, FLASHCARDS]))).match(/Zootopia|Grand quiz|Mots anglais/), 'aucun quiz ni paquet de Léo dans la page d\'Emma');
  ok((await p.locator('#count-programme').innerText()) === '11', 'programme d\'Emma : 11 cartes (10 + 1), indépendant de celui de Léo');
  ok((await p.locator('#rvStreak').innerText()) === '🔥 Série : 1 jour', 'série d\'Emma indépendante');
  await p.click('#tab-flashcards');
  ok(!(await p.locator('.card h3').allInnerTexts()).includes('Mots anglais'), 'paquet « Mots anglais » (pour Léo) invisible pour Emma');
  ok(await p.evaluate(() => { const q = QUIZZES.find(x => x.id === 'byzance'); return progressOf(q, q.questions[0]).ok === 0; }), 'la progression de Léo n\'a aucun effet chez Emma');
  ok(!Object.keys(w.props).some(k => k.startsWith('prog_emma__')) && Object.keys(w.props).some(k => k.startsWith('prog_leo__')), 'la progression de Léo est au nom de Léo seul : rien n\'existe au nom d\'Emma');

  // ---- 5. retour de Léo : sa progression est intacte ----
  await p.click('#logout'); await p.fill('#login-pseudo', 'Léo'); await p.fill('#login-pin', '1234'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok(await p.evaluate(() => { const q = QUIZZES.find(x => x.id === 'zootopia'); return progressOf(q, q.questions[0]).ok === 1 && progressOf(q, q.questions[1]).fails === 1; }), 'Léo retrouve sa progression (Q1 réussie 1/3, Q2 ratée)');

  // ---- 6. la session survit au rechargement de la page, pas à la déconnexion ----
  await p.reload(); await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('#whoami-name').innerText()) === '👤 Léo · 5B', 'rechargement : toujours connecté en tant que Léo');
  await p.click('#logout'); await p.reload(); await p.waitForTimeout(400);
  ok(await p.locator('#login').isVisible(), 'après déconnexion, un rechargement redemande la connexion');

  // ---- 7. blocage après 5 mauvais PIN ----
  for (let i = 0; i < 5; i++) { await p.fill('#login-pin', '0000'); await p.click('#login-btn'); await p.waitForFunction(n => document.querySelector('#login-error').textContent.length > 0 && !document.querySelector('#login-btn').disabled, i); await p.fill('#login-pin', ''); }
  await p.fill('#login-pin', '1234'); await p.click('#login-btn');
  await p.waitForFunction(() => document.querySelector('#login-error').textContent.startsWith("Trop d'essais"));
  ok(true, 'après 5 erreurs, même le bon PIN est refusé : « ' + await p.locator('#login-error').innerText() + ' »');
  w.advance(301000);
  await p.fill('#login-pin', '1234'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok(true, 'après 5 minutes, la connexion refonctionne');

  // ---- 8. remise à zéro par l'admin : seulement l'élève visé ----
  w.run('resetProgress', PW, 'leo', 'all');
  await p.click('#logout'); await p.fill('#login-pin', '1234'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('#count-programme').innerText()) === '40', 'remise à zéro de Léo : retour à 40 cartes à sa prochaine connexion');
  await p.click('#logout'); await p.fill('#login-pseudo', 'Emma'); await p.fill('#login-pin', '4321'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok(!Object.keys(w.props).some(k => k.startsWith('prog_leo__')), 'la remise à zéro de Léo a supprimé sa progression sur le serveur');

  // ---- 8b. la progression suit l'élève sur un AUTRE appareil ----
  await p.click('#logout'); await p.fill('#login-pseudo', 'Léo'); await p.fill('#login-pin', '1234'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  await p.click('#tab-quiz'); await p.locator('.card', { hasText: 'Zootopia' }).click();
  await p.fill('.saisie', 'sahara square'); await p.keyboard.press('Enter'); await p.evaluate(() => revisionFlush());
  const c2 = await b.newContext({ viewport: { width: 1000, height: 900 } }); await install(c2, w);
  const p2 = await c2.newPage(); p2.on('pageerror', e => errs.push(e.message)); await p2.goto(URL_); await login(p2, LEO);
  ok(await p2.evaluate(() => { const q = QUIZZES.find(x => x.id === 'zootopia'); return progressOf(q, q.questions[0]).ok === 1; }) && (await p2.locator('#count-programme').innerText()) === '40', 'AUTRE APPAREIL : Léo retrouve sa progression (Q1 : 1 / 3), sans rien avoir joué dessus');
  await p2.close();

  // ---- 9. élève sans aucun quiz attribué ----
  w.run('saveStudent', PW, { classe: '6A', pseudo: 'Nina', pin: '2468' });
  await p.click('#logout'); await p.fill('#login-classe', '6A'); await p.fill('#login-pseudo', 'Nina'); await p.fill('#login-pin', '2468'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('.empty').innerText()).includes('Aucune leçon'), 'élève sans quiz : « ' + await p.locator('.empty').innerText() + ' »');
  await p.click('#tab-programme');
  ok((await p.locator('.progress-panel .score').innerText()) === '0 / 0', 'programme vide : 0 / 0 (pas de division par zéro : ' + await p.locator('.progress-panel .score').innerText() + ')');

  // ---- 10. un élève ne peut pas appeler les fonctions d'administration depuis sa page ----
  const adminTry = await p.evaluate(() => new Promise(res => google.script.run.withSuccessHandler(() => res('ACCÈS')).withFailureHandler(e => res(e.message)).adminData('')));
  ok(adminTry.includes('Mot de passe incorrect'), 'depuis la console d\'un élève : adminData refusée (' + adminTry + ')');
  const hidden = await p.evaluate(() => new Promise(res => google.script.run.withSuccessHandler(() => res('ACCÈS')).withFailureHandler(e => res(e.message)).list_()));
  ok(hidden.includes('indisponible'), 'fonctions internes non appelables (' + hidden + ')');

  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close();
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
