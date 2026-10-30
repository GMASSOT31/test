const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC } = require('./harness');

(async () => {
  const w = makeWorld();
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1200, height: 1000 } });
  await install(c, w);
  const errs = [];
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message)); a.on('dialog', d => d.accept());
  await a.goto('file://' + SRC + 'admin.html');
  const waitOk = async (id) => a.waitForSelector(`${id}.ok`, { timeout: 8000 });
  const tab = async t => a.click('#tab-' + t);
  const visiblePane = async () => (await a.locator('.pane:visible').evaluateAll(l => l.map(e => e.id))).join();

  // ---- 1. verrouillé, puis barre latérale ----
  ok(await a.locator('#admin-area').isHidden() && await a.locator('#locked-hint').isVisible(), 'au départ : gestion masquée et message d\'invitation à saisir le mot de passe');
  await a.fill('#password', 'mauvais'); await a.click('#unlock'); await a.waitForSelector('#lock-status.err');
  ok((await a.locator('#lock-status').innerText()).trim() === 'Mot de passe incorrect.' && await a.locator('#admin-area').isHidden(), 'mauvais mot de passe : refusé, rien ne s\'affiche');
  await a.fill('#password', PW); await a.press('#password', 'Enter'); await waitOk('#lock-status');
  ok(await a.locator('#admin-area').isVisible() && await a.locator('#locked-hint').isHidden(), 'bon mot de passe (touche Entrée) : gestion déverrouillée');
  const labels = (await a.locator('.sidebar .tab').allInnerTexts()).map(t => t.replace(/\s*\d+\s*$/, '').replace(/\s+/g, ' ').trim());
  ok(JSON.stringify(labels) === JSON.stringify(['➕ Ajouter un élève', '👥 Liste des élèves', '➕ Ajouter un quiz', '📋 Liste des quiz', '🃏 Ajouter des flashcards', '📅 Programmes de révision']), 'BARRE LATÉRALE, 6 onglets dans l\'ordre demandé : ' + labels.join(' | '));
  ok((await visiblePane()) === 'pane-eleve-ajout' && (await a.locator('#tab-eleve-ajout').getAttribute('aria-selected')) === 'true', 'sans élève, on arrive sur « Ajouter un élève »');
  // mot de passe rangé dans la barre latérale, sous les onglets
  const yPw = (await a.locator('#password').boundingBox()).y, yLast = (await a.locator('#tab-programmes').boundingBox()).y;
  ok(await a.locator('#lock-dock #password').count() === 1 && await a.locator('.sidebar #lockbar.docked').count() === 1 && yPw > yLast, 'MOT DE PASSE DANS LA BARRE LATÉRALE, sous l\'onglet « Programmes de révision » (y ' + Math.round(yPw) + ' > ' + Math.round(yLast) + ')');
  ok(await a.locator('body > #lockbar').count() === 0 && (await a.locator('#unlock').innerText()).includes('Actualiser') && await a.locator('#lock').isVisible(), 'la barre du haut a disparu ; boutons « ↻ Actualiser » et « 🔒 Verrouiller » dans la barre latérale');
  await a.click('#lock');
  ok(await a.locator('#admin-area').isHidden() && (await a.locator('#password').inputValue()) === '' && await a.locator('body > #lockbar').count() === 1 && (await a.locator('#unlock').innerText()) === 'Déverrouiller' && await a.locator('#locked-hint').isVisible(), '« Verrouiller » : gestion masquée, mot de passe effacé, barre remise en haut');
  await a.fill('#password', PW); await a.click('#unlock'); await waitOk('#lock-status');
  ok(await a.locator('#admin-area').isVisible() && await a.locator('#lock-dock #password').count() === 1, 'redéverrouillage : la barre retourne dans la barre latérale');
  for (const [t, pane] of [['eleves', 'pane-eleves'], ['quiz-ajout', 'pane-quiz-ajout'], ['quiz-liste', 'pane-quiz-liste'], ['fc-ajout', 'pane-fc-ajout'], ['programmes', 'pane-programmes'], ['eleve-ajout', 'pane-eleve-ajout']]) {
    await tab(t);
    if ((await visiblePane()) !== pane || (await a.locator('.tab[aria-selected="true"]').count()) !== 1 || (await a.locator('.tab[aria-selected="true"]').getAttribute('data-tab')) !== t) ok(false, 'onglet ' + t + ' : mauvais affichage (' + await visiblePane() + ')');
  }
  ok(true, 'chaque onglet n\'affiche que sa propre page, et un seul onglet est actif à la fois');

  // ---- 2. ajouter des élèves : on est renvoyé vers la liste ----
  const addStudent = async (classe, pseudo, pin) => { await tab('eleve-ajout'); await a.fill('#st-classe', classe); await a.fill('#st-pseudo', pseudo); await a.fill('#st-pin', pin); await a.click('#save-student'); };
  await addStudent('5B', 'Léo', '123'); await a.waitForSelector('#student-status.err');
  ok((await a.locator('#student-status').innerText()).includes('4 à 8 chiffres') && (await visiblePane()) === 'pane-eleve-ajout', 'PIN trop court refusé, on reste sur le formulaire : « ' + await a.locator('#student-status').innerText() + ' »');
  for (const [cl, ps, pin] of [['5B', 'Léo', '1234'], ['5B', 'Emma', '4321'], ['6A', 'Nina', '2468'], ['5e A', 'Zoé', '1357'], ['5b', 'Adam', '9753']]) { await addStudent(cl, ps, pin); await waitOk('#eleves-status'); }
  ok((await visiblePane()) === 'pane-eleves' && (await a.locator('#eleves-status').innerText()).includes('peut se connecter'), 'après l\'enregistrement : retour automatique à la liste avec confirmation : « ' + (await a.locator('#eleves-status').innerText()).slice(0, 60) + '… »');
  ok((await a.locator('#count-eleves').innerText()) === '5', 'pastille « Liste des élèves » : 5');
  ok((await a.locator('#st-pseudo').inputValue()) === '' && (await a.locator('#student-form-title').innerText()).includes('Nouvel élève'), 'le formulaire est remis à zéro après l\'enregistrement');

  // ---- 3. liste des élèves rangés par classe ----
  const heads = await a.locator('#student-list details.classe > summary').allInnerTexts();
  ok(JSON.stringify(heads) === JSON.stringify(['Classe 5B · 3 élèves', 'Classe 5e A · 1 élève', 'Classe 6A · 1 élève']), 'LISTE RANGÉE PAR CLASSE : ' + heads.join(' | ') + ' (« 5b » regroupé avec « 5B »)');
  const inFirst = await a.locator('#student-list details.classe').nth(0).locator('.item .info strong').allInnerTexts();
  ok(JSON.stringify(inFirst) === '["Adam","Emma","Léo"]', 'élèves de chaque classe triés par pseudo : ' + inFirst.join(', '));
  ok(!(await a.locator('body').innerText()).match(/9753|1234|4321|2468|1357/) && !Object.values(w.props).some(v => v.includes('"1234"')), 'aucun PIN affiché ni stocké en clair');
  await tab('eleve-ajout'); await a.fill('#st-classe', '5b'); await a.fill('#st-pseudo', 'LEO'); await a.fill('#st-pin', '9999'); await a.click('#save-student'); await a.waitForSelector('#student-status.err');
  ok((await a.locator('#student-status').innerText()).includes('existe déjà'), 'doublon refusé : « ' + await a.locator('#student-status').innerText() + ' »');
  await a.click('#reset-student-form');

  // ---- 4. modifier un élève depuis la liste ----
  await tab('eleves');
  await a.locator('#student-list .item', { hasText: 'Léo' }).locator('text=Modifier').click();
  ok((await visiblePane()) === 'pane-eleve-ajout' && (await a.locator('#student-form-title').innerText()).includes('Modifier : Léo') && (await a.locator('#st-pin').inputValue()) === '', '« Modifier » ouvre le formulaire d\'ajout, prérempli, PIN vide');
  await a.fill('#st-pin', '5555'); await a.click('#save-student'); await waitOk('#eleves-status');
  ok(w.try('getStudentData', '5B', 'Léo', '1234').err && !w.try('getStudentData', '5B', 'Léo', '5555').err, 'nouveau PIN pris en compte, ancien refusé');

  // ---- 5. ajouter un quiz pour Emma ----
  await tab('quiz-ajout');
  ok((await a.locator('#quiz-pour .pour-item').allInnerTexts()).includes('Emma (5B)'), 'cases « Pour quels élèves ? » : ' + (await a.locator('#quiz-pour .pour-item').allInnerTexts()).join(' | '));
  await a.fill('#titre', 'Maths'); await a.fill('#matiere', 'Maths'); await a.fill('#emoji', '➗');
  await a.locator('#quiz-pour .pour-item', { hasText: 'Emma' }).locator('input').check();
  await a.fill('.q-text', 'Combien font 2 + 2 ?');
  const o = a.locator('.question').nth(0).locator('.opt-text'); await o.nth(0).fill('3'); await o.nth(1).fill('4');
  await a.locator('.question').nth(0).locator('input[type=radio]').nth(1).check();
  await a.locator('.question').nth(0).locator('.q-expl').fill('2 + 2 = 4');
  await a.click('#save-quiz'); await waitOk('#quizlist-status');
  const quizId = Object.keys(w.props).find(k => k.startsWith('quiz_'));
  ok(JSON.stringify(JSON.parse(w.props[quizId]).pour) === '["emma"]' && (await visiblePane()) === 'pane-quiz-liste', 'quiz enregistré pour Emma, retour à « Liste des quiz »');
  ok((await a.locator('#quiz-list .item').innerText()).includes('Pour : Emma') && (await a.locator('#count-quiz').innerText()) === '6', 'liste des quiz : « Pour : Emma » ; pastille 6 (1 créé + 5 intégrés)');
  await tab('quiz-ajout'); await a.fill('#titre', 'Brouillon'); await a.fill('.q-text', 'q ?');
  const o2 = a.locator('.question').nth(0).locator('.opt-text'); await o2.nth(0).fill('a'); await o2.nth(1).fill('b');
  await a.click('#save-quiz'); await waitOk('#quizlist-status');
  ok((await a.locator('#quizlist-status').innerText()).includes('reste caché') && (await a.locator('#quiz-list .warn').count()) === 1, 'sans destinataire : prévenu « caché », signalé en rouge dans la liste');
  await a.locator('#quiz-list .item', { hasText: 'Maths' }).locator('text=Modifier').click();
  ok((await visiblePane()) === 'pane-quiz-ajout' && JSON.stringify(await a.locator('#quiz-pour input:checked').evaluateAll(l => l.map(i => i.value))) === '["emma"]', '« Modifier » (liste des quiz) : formulaire d\'ajout, case d\'Emma cochée');
  await a.click('#reset-quiz');

  // ---- 6. quiz intégrés (dans « Liste des quiz ») ----
  await tab('quiz-liste');
  const rows = await a.locator('#builtin-list .builtin strong').allInnerTexts();
  ok(rows.length === 5, '5 quiz intégrés listés : ' + rows.map(r => r.slice(0, 22)).join(' | '));
  for (const id of ['byzance-30', 'zootopia']) {
    const row = a.locator(`#builtin-list .builtin[data-id="${id}"]`);
    await row.locator('.pour-item', { hasText: 'Léo' }).locator('input').check(); await row.locator('text=Enregistrer l\'accès').click();
    await a.waitForFunction(i => document.querySelector(`.builtin[data-id="${i}"] .info span:last-child`).textContent.includes('Pour : Léo'), id);
  }
  ok(JSON.parse(w.props.builtin_assign)['zootopia'].join() === 'leo', 'accès aux quiz intégrés enregistré : ' + w.props.builtin_assign);

  // ---- 7. ajouter des flashcards (liste des paquets sous le formulaire) ----
  await tab('fc-ajout');
  await a.fill('#deck-titre', 'Mots anglais'); await a.fill('#deck-cartes', 'dog | chien\ncat | chat');
  await a.locator('#deck-pour .pour-item', { hasText: 'Léo' }).locator('input').check();
  await a.click('#save-deck'); await waitOk('#deck-status');
  ok((await visiblePane()) === 'pane-fc-ajout' && (await a.locator('#deck-list .item').innerText()).includes('Mots anglais') && (await a.locator('#count-decks').innerText()) === '1', 'paquet enregistré pour Léo ; il apparaît dans « Paquets enregistrés » sous le formulaire (pastille 1)');
  await a.locator('#deck-list .item', { hasText: 'Mots anglais' }).locator('text=Modifier').click();
  ok((await a.locator('#deck-cartes').inputValue()) === 'dog | chien\ncat | chat' && JSON.stringify(await a.locator('#deck-pour input:checked').evaluateAll(l => l.map(i => i.value))) === '["leo"]', 'modifier un paquet : cartes et destinataire rechargés');
  await a.click('#reset-deck');

  // ---- 8. ce que voient les élèves ----
  const sp = await c.newPage(); sp.on('pageerror', e => errs.push(e.message));
  await sp.goto('file://' + SRC + 'Index.html'); await login(sp, { classe: '5B', pseudo: 'Léo', pin: '5555' });
  ok(JSON.stringify(await sp.locator('.card h3').allInnerTexts()) === JSON.stringify(['Grand quiz : Byzance et l\'Empire carolingien', 'Zootopia : les quartiers']), 'LÉO voit ses 2 quiz intégrés (ni Maths, ni Brouillon)');
  await sp.click('#logout'); await sp.fill('#login-pseudo', 'Emma'); await sp.fill('#login-pin', '4321'); await sp.click('#login-btn'); await sp.waitForSelector('#app:not([hidden])');
  ok(JSON.stringify(await sp.locator('.card h3').allInnerTexts()) === '["Maths"]', 'EMMA voit seulement « Maths »');

  // ---- 9. supprimer un élève depuis la liste ----
  await tab('eleves');
  await a.locator('#student-list .item', { hasText: 'Adam' }).locator('text=Supprimer').click(); await waitOk('#eleves-status');
  ok(JSON.stringify(await a.locator('#student-list details.classe').nth(0).locator('.item .info strong').allInnerTexts()) === '["Emma","Léo"]' && (await a.locator('#count-eleves').innerText()) === '4', 'Adam supprimé : la classe 5B n\'a plus qu\'Emma et Léo (pastille 4)');
  await a.locator('#student-list .item', { hasText: 'Léo' }).locator('text=Supprimer').click(); await waitOk('#eleves-status');
  ok(!w.props.builtin_assign.includes('leo') && !JSON.stringify(Object.values(w.props)).includes('"leo"') && w.try('getStudentData', '5B', 'Léo', '5555').err, 'Léo supprimé : retiré de toutes les attributions, connexion impossible');
  ok((await a.locator('#deck-status, #quizlist-status').count()) >= 1 && errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
