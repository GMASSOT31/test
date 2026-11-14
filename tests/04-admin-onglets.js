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
  const toStudent = a.locator('#to-student');
  ok(await toStudent.isVisible() && (await toStudent.innerText()).includes('Espace élève') && (await toStudent.getAttribute('href')).endsWith('/exec') && (await toStudent.getAttribute('target')) === '_top', 'connexion enseignant : lien discret « Espace élève » (vers la page élève, dans toute la fenêtre)');
  const waitOk = async (id) => a.waitForSelector(`${id}.ok`, { timeout: 8000 });
  // navigation : 2 sections en haut (Enfants, Leçons) ; les formulaires s'ouvrent depuis leur section ; Familles depuis le menu du compte
  const PARENT = { 'eleve-ajout': 'programmes', 'quiz-ajout': 'quiz-liste', 'fc-ajout': 'quiz-liste' };
  const OPENER = { 'eleve-ajout': '#tab-eleve-ajout', 'quiz-ajout': '#tab-quiz-ajout', 'fc-ajout': '#new-deck' };
  const tab = async t => {
    if (t === 'parents') { await a.click('#acct-btn'); await a.click('#menu-parents'); return; }
    if (PARENT[t]) { await a.click('#tab-' + PARENT[t]); await a.click(OPENER[t]); return; }
    await a.click('#tab-' + t);
  };
  const visiblePane = async () => (await a.locator('.pane:visible').evaluateAll(l => l.map(e => e.id))).join();
  const card = id => a.locator(`.prog-card[data-student="${id}"]`);
  const openKid = async id => { if (!(await card(id).locator('.student-extra').count())) await card(id).locator('.kid-acct').click(); };

  // ---- 1. verrouillé, puis barre latérale ----
  ok(await a.locator('#admin-area').isHidden() && await a.locator('#locked-hint').isVisible(), 'au départ : gestion masquée et message d\'invitation à saisir le mot de passe');
  ok(await a.locator('#admin-pseudo').isVisible() && (await a.locator('#admin-pseudo').getAttribute('placeholder')).includes('Pseudo') && (await a.locator('#unlock').innerText()) === 'Se connecter', 'CONNEXION PARENTS : pseudo + mot de passe, bouton « Se connecter »');
  await a.fill('#password', PW); await a.click('#unlock'); await a.waitForSelector('#lock-status.err');
  ok((await a.locator('#lock-status').innerText()).trim() === 'Saisis ton pseudo.' && await a.locator('#admin-area').isHidden(), 'sans pseudo : « Saisis ton pseudo. »');
  await a.fill('#admin-pseudo', 'Papa'); await a.fill('#password', 'mauvais'); await a.click('#unlock'); await a.waitForSelector('#lock-status.err');
  ok((await a.locator('#lock-status').innerText()).trim() === 'Pseudo ou mot de passe incorrect.' && await a.locator('#admin-area').isHidden() && !w.props.ADMIN_PSEUDO, 'mauvais mot de passe : refusé, rien ne s\'affiche, aucun pseudo enregistré');
  await a.fill('#password', PW); await a.press('#password', 'Enter'); await waitOk('#lock-status');
  ok(w.props.ADMIN_PSEUDO === 'Papa', 'première connexion réussie : le pseudo « Papa » devient l\'identifiant parent');
  ok(await a.locator('#admin-area').isVisible() && await a.locator('#locked-hint').isHidden(), 'bon pseudo et mot de passe (touche Entrée) : espace parents ouvert');
  const labels = (await a.locator('.topnav .tab').allInnerTexts()).map(t => t.replace(/\s*\d+\s*$/, '').replace(/\s+/g, ' ').trim());
  ok(JSON.stringify(labels) === JSON.stringify(['👨‍👧 Enfants', '📚 Leçons']), 'BARRE DU HAUT ÉPURÉE, 2 sections : ' + labels.join(' | '));
  ok((await visiblePane()) === 'pane-programmes' && (await a.locator('#tab-programmes').getAttribute('aria-selected')) === 'true', 'on arrive sur « Enfants » (suivi + comptes)');
  ok((await a.locator('#guide .guide li').count()) === 3 && (await a.locator('#guide').innerText()).includes('Pour commencer') && (await a.locator('#guide').innerText()).includes('Crée le compte de ton enfant'), 'sans élève : guide « Pour commencer » en 3 étapes');
  const navBox = await a.locator('.topnav').boundingBox(), lockBox = await a.locator('#acct-btn').boundingBox();
  ok(await a.locator('.topnav #lockbar.docked').count() === 1 && Math.abs((lockBox.y + lockBox.height / 2) - (navBox.y + navBox.height / 2)) < 20, 'Actualiser et le menu du compte sont sur la même ligne que les sections');
  ok(await a.locator('body > #lockbar').count() === 0 && (await a.locator('#unlock').innerText()).includes('Actualiser') && (await a.locator('#acct-btn').innerText()).includes('Papa') && await a.locator('#lock').isHidden(), 'boutons « ↻ Actualiser » et « Papa ▾ » (menu du compte, replié)');
  await a.click('#acct-btn');
  ok(await a.locator('#menu-parents').isVisible() && await a.locator('#change-pw').isVisible() && await a.locator('#lock').isVisible() && (await a.locator('#acct-who').innerText()).includes('administrateur'), 'menu du compte : « Familles invitées » (administrateur), « Changer le mot de passe », « Se déconnecter »');
  await a.click('#tab-programmes');
  ok(await a.locator('#acct-menu').isHidden(), 'un clic ailleurs referme le menu');
  await a.click('#acct-btn');
  ok(await a.locator('#to-student').isHidden(), 'une fois connecté : le lien « Espace élève » disparaît');
  await a.click('#lock');
  ok(await a.locator('#admin-area').isHidden() && (await a.locator('#password').inputValue()) === '' && await a.locator('body > #lockbar').count() === 1 && (await a.locator('#unlock').innerText()) === 'Se connecter' && (await a.locator('#admin-pseudo').inputValue()) === 'Papa' && await a.locator('#locked-hint').isVisible(), '« Verrouiller » : gestion masquée, mot de passe effacé, barre remise en haut');
  ok(await a.locator('#to-student').isVisible(), 'après « Verrouiller » : le lien « Espace élève » revient');
  await a.fill('#admin-pseudo', 'Maman'); await a.fill('#password', PW); await a.click('#unlock'); await a.waitForSelector('#lock-status.err');
  ok((await a.locator('#lock-status').innerText()).trim() === 'Pseudo ou mot de passe incorrect.', 'un autre pseudo avec le bon mot de passe : refusé (le pseudo est enregistré)');
  await a.fill('#admin-pseudo', ' papa '); await a.fill('#password', PW); await a.click('#unlock'); await waitOk('#lock-status');
  ok(await a.locator('#admin-area').isVisible() && await a.locator('#lock-dock #password').count() === 1, 'reconnexion (« papa », sans tenir compte des majuscules ni des espaces) : les boutons retournent dans la barre du haut');
  for (const [t, pane] of [['quiz-liste', 'pane-quiz-liste'], ['quiz-ajout', 'pane-quiz-ajout'], ['fc-ajout', 'pane-fc-ajout'], ['parents', 'pane-parents'], ['programmes', 'pane-programmes'], ['eleve-ajout', 'pane-eleve-ajout']]) {
    await tab(t);
    const sel = await a.locator('.tab[aria-selected="true"]').evaluateAll(l => l.map(e => e.dataset.tab));
    const want = t === 'parents' ? [] : [PARENT[t] || t];
    if ((await visiblePane()) !== pane || JSON.stringify(sel) !== JSON.stringify(want)) ok(false, 'section ' + t + ' : mauvais affichage (' + await visiblePane() + ' / ' + sel + ')');
  }
  ok(true, 'chaque section n\'affiche que sa page ; les formulaires gardent leur onglet actif ; « Familles invitées » s\'ouvre depuis le menu');

  // ---- 2. ajouter des enfants : retour à « Enfants », son choix de leçons s'ouvre ----
  const addStudent = async (classe, pseudo, pin) => { await tab('eleve-ajout'); await a.fill('#st-classe', classe); await a.fill('#st-pseudo', pseudo); await a.fill('#st-pin', pin); await a.click('#save-student'); };
  await addStudent('5B', 'Léo', '123'); await a.waitForSelector('#student-status.err');
  ok((await a.locator('#student-status').innerText()).includes('4 à 8 chiffres') && (await visiblePane()) === 'pane-eleve-ajout', 'PIN trop court refusé, on reste sur le formulaire : « ' + await a.locator('#student-status').innerText() + ' »');
  for (const [cl, ps, pin] of [['5B', 'Léo', '1234'], ['5B', 'Emma', '4321'], ['6A', 'Nina', '2468'], ['5e A', 'Zoé', '1357'], ['5b', 'Adam', '9753']]) { await addStudent(cl, ps, pin); await waitOk('#prog-status'); }
  ok((await visiblePane()) === 'pane-programmes' && (await a.locator('#prog-status').innerText()).includes('se connecte avec sa classe'), 'après l\'enregistrement : retour à « Enfants » avec confirmation : « ' + (await a.locator('#prog-status').innerText()).slice(0, 60) + '… »');
  ok((await a.locator('.picker').count()) === 1 && (await card('adam').locator('.picker').count()) === 1, 'le choix des leçons du nouvel enfant (Adam) s\'ouvre aussitôt, et lui seul');
  ok((await a.locator('#count-eleves').innerText()) === '5', 'pastille « Enfants » : 5');
  ok((await a.locator('#st-pseudo').inputValue()) === '' && (await a.locator('#student-form-title').innerText()).includes('Ajouter un enfant'), 'le formulaire est remis à zéro après l\'enregistrement');

  // ---- 3. une fiche par enfant, par ordre alphabétique ----
  const names = await a.locator('.prog-card .st-name').allInnerTexts();
  ok(JSON.stringify(names) === JSON.stringify(['Adam', 'Emma', 'Léo', 'Nina', 'Zoé']) && (await a.locator('details.classe').count()) === 0 && (await a.locator('#prog-filtre').count()) === 0, 'FICHES ENFANTS triées par pseudo, sans regroupement par classe ni filtre : ' + names.join(', '));
  ok(!(await a.locator('body').innerText()).match(/9753|1234|4321|2468|1357/) && !Object.values(w.props).some(v => v.includes('"1234"')), 'aucun PIN affiché ni stocké en clair');
  await tab('eleve-ajout'); await a.fill('#st-classe', '5b'); await a.fill('#st-pseudo', 'LEO'); await a.fill('#st-pin', '9999'); await a.click('#save-student'); await a.waitForSelector('#student-status.err');
  ok((await a.locator('#student-status').innerText()).includes('existe déjà'), 'doublon refusé : « ' + await a.locator('#student-status').innerText() + ' »');
  await a.click('#reset-student-form');

  // ---- 4. modifier un enfant depuis sa fiche (« + ») ----
  await tab('programmes'); await openKid('leo');
  ok((await card('leo').locator('.login-info').innerText()).includes('classe « 5B », pseudo « Léo »'), '« ⚙️ Compte » de l\'enfant : rappel de sa connexion (classe, pseudo)');
  await card('leo').locator('text=Modifier').click();
  ok((await visiblePane()) === 'pane-eleve-ajout' && (await a.locator('#student-form-title').innerText()).includes('Modifier : Léo') && (await a.locator('#st-pin').inputValue()) === '', '« ✏️ Modifier » ouvre le formulaire, prérempli, PIN vide');
  await a.fill('#st-pin', '5555'); await a.click('#save-student'); await waitOk('#prog-status');
  ok(w.try('getStudentData', '5B', 'Léo', '1234').err && !w.try('getStudentData', '5B', 'Léo', '5555').err && (await card('leo').locator('.picker').count()) === 0, 'nouveau PIN pris en compte, ancien refusé (modification : pas de choix de leçons ouvert)');

  // ---- 5. ajouter un quiz pour Emma ----
  await tab('quiz-ajout');
  ok((await a.locator('#quiz-pour .pour-item').allInnerTexts()).includes('Emma (5B)'), 'cases « Pour quels enfants ? » : ' + (await a.locator('#quiz-pour .pour-item').allInnerTexts()).join(' | '));
  await a.fill('#titre', 'Maths'); await a.fill('#matiere', 'Maths'); await a.fill('#emoji', '➗');
  await a.locator('#quiz-pour .pour-item', { hasText: 'Emma' }).locator('input').check();
  await a.fill('.q-text', 'Combien font 2 + 2 ?');
  const o = a.locator('.question').nth(0).locator('.opt-text'); await o.nth(0).fill('3'); await o.nth(1).fill('4');
  await a.locator('.question').nth(0).locator('input[type=radio]').nth(1).check();
  await a.locator('.question').nth(0).locator('.q-expl').fill('2 + 2 = 4');
  await a.click('#save-quiz'); await waitOk('#quizlist-status');
  const quizId = Object.keys(w.props).find(k => k.startsWith('quiz_'));
  ok(JSON.stringify(JSON.parse(w.props[quizId]).pour) === '["emma"]' && (await visiblePane()) === 'pane-quiz-liste', 'leçon enregistrée pour Emma, retour à « Leçons »');
  ok((await a.locator('#quiz-list .builtin').innerText()).includes('👥 Emma') && await a.locator('#my-lessons').isVisible(), '« ✏️ Mes leçons » : « Maths », 👥 Emma');
  await tab('quiz-ajout'); await a.fill('#titre', 'Brouillon'); await a.fill('.q-text', 'q ?');
  const o2 = a.locator('.question').nth(0).locator('.opt-text'); await o2.nth(0).fill('a'); await o2.nth(1).fill('b');
  await a.click('#save-quiz'); await waitOk('#quizlist-status');
  ok((await a.locator('#quizlist-status').innerText()).includes('reste caché') && (await a.locator('#quiz-list .builtin-pour.none').count()) === 1, 'sans destinataire : prévenu « cachée », « Donnée à personne » dans la liste');
  const mine = a.locator('#quiz-list .builtin', { hasText: 'Maths' });
  await mine.locator('.builtin-toggle').click(); await mine.locator('text=Modifier').click();
  ok((await visiblePane()) === 'pane-quiz-ajout' && JSON.stringify(await a.locator('#quiz-pour input:checked').evaluateAll(l => l.map(i => i.value))) === '["emma"]', '« ⚙️ Gérer » → « Modifier » : formulaire, case d\'Emma cochée');
  await a.click('#reset-quiz');

  // ---- 6. leçons fournies : cases enregistrées tout de suite ----
  await tab('quiz-liste');
  const rows = await a.locator('#builtin-list .builtin strong').allInnerTexts();
  ok(rows.length === 11, '11 leçons fournies listées : ' + rows.map(r => r.slice(0, 22)).join(' | '));
  ok((await a.locator('#builtin-list .builtin-details:visible').count()) === 0 && (await a.locator('#builtin-list .builtin').first().innerText()).replace(/\s+/g, ' ').trim().split(' ').length < 14, 'LISTE COMPACTE : titre court, matière et destinataires (réglages repliés) : ' + (await a.locator('#builtin-list .builtin').first().innerText()).replace(/\s+/g, ' '));
  ok((await a.locator('#builtin-list .builtin-toggle').first().getAttribute('aria-expanded')) === 'false', 'un bouton « ⚙️ Gérer » par leçon (replié)');
  for (const id of ['byzance-30', 'zootopia']) {
    const row = a.locator(`#builtin-list .builtin[data-id="${id}"]`);
    await row.locator('.builtin-toggle').click();
    ok(await row.locator('.builtin-details').isVisible() && (await row.locator('.builtin-toggle').getAttribute('aria-expanded')) === 'true', 'réglages dépliés : ' + id);
    await row.locator('.pour-item', { hasText: 'Léo' }).locator('input').check();
    await a.waitForFunction(i => document.querySelector(`.builtin[data-id="${i}"] .builtin-pour`).textContent.includes('Léo'), id);
  }
  ok(JSON.parse(w.props.builtin_assign)['zootopia'].join() === 'leo' && (await a.locator('text=Enregistrer l\'accès').count()) === 0, 'cocher suffit : accès enregistré tout de suite (plus de bouton « Enregistrer l\'accès ») : ' + w.props.builtin_assign);
  ok(await a.locator('#builtin-list .builtin[data-id="zootopia"] .builtin-details').isVisible(), 'après enregistrement, la leçon reste dépliée');
  await a.locator('#builtin-list .builtin[data-id="zootopia"] .builtin-toggle').click();
  ok(await a.locator('#builtin-list .builtin[data-id="zootopia"] .builtin-details').isHidden(), 'un second clic replie les réglages');
  // depuis la fiche de l'enfant : « 📚 Choisir ses leçons »
  await tab('programmes');
  await card('emma').locator('.pick-btn').click();
  const pick = card('emma').locator('.picker');
  ok((await pick.locator('.pick-item').count()) === 13 && await pick.locator('.pick-item[data-quiz="' + quizId.slice(5) + '"] input').isChecked(), 'choix des leçons d\'Emma : ses 2 leçons créées + les 11 fournies, « Maths » cochée');
  await pick.locator('.pick-item[data-quiz="musique-carnaval"] input').check();
  await a.waitForFunction(() => document.querySelector('.prog-card[data-student="emma"] .lesson-row[data-quiz="musique-carnaval"]'));
  ok(JSON.parse(w.props.builtin_assign)['musique-carnaval'].join() === 'emma' && (await a.locator('#prog-status').innerText()).includes('donnée à Emma') && (await card('emma').locator('.picker').count()) === 1, 'cocher « Musique » : donnée à Emma tout de suite, la leçon apparaît sur sa fiche, le choix reste ouvert');
  await card('emma').locator('.pick-item[data-quiz="musique-carnaval"] input').uncheck();
  await a.waitForFunction(() => !document.querySelector('.prog-card[data-student="emma"] .lesson-row[data-quiz="musique-carnaval"]'));
  ok(JSON.parse(w.props.builtin_assign)['musique-carnaval'].length === 0, 'décocher : retirée');

  // ---- 7. cartes en plus (dans « Leçons ») ----
  await tab('quiz-liste');
  ok(await a.locator('#new-deck').isVisible() && (await a.locator('#deck-list').innerText()).includes('Aucun paquet'), '« 🃏 Cartes en plus » en bas de « Leçons », avec « ➕ Créer un paquet »');
  await a.click('#new-deck');
  ok((await visiblePane()) === 'pane-fc-ajout' && await a.locator('#deck-form-section').isVisible(), 'le formulaire de paquet s\'ouvre');
  await a.fill('#deck-titre', 'Mots anglais'); await a.fill('#deck-cartes', 'dog | chien\ncat | chat');
  await a.locator('#deck-pour .pour-item', { hasText: 'Léo' }).locator('input').check();
  await a.click('#save-deck'); await waitOk('#decklist-status');
  ok((await visiblePane()) === 'pane-quiz-liste' && (await a.locator('#deck-list .builtin').innerText()).includes('Mots anglais') && (await a.locator('#deck-list .builtin').innerText()).includes('👥 Léo'), 'paquet enregistré pour Léo ; retour à « Leçons », il apparaît dans « Cartes en plus »');
  const dk = a.locator('#deck-list .builtin', { hasText: 'Mots anglais' });
  await dk.locator('.builtin-toggle').click(); await dk.locator('.pour-item', { hasText: 'Emma' }).locator('input').check();
  await a.waitForFunction(() => document.querySelector('#deck-list .builtin-pour').textContent.includes('Emma'));
  ok(JSON.stringify(JSON.parse(w.props[Object.keys(w.props).find(k => k.startsWith('deck_'))]).pour.sort()) === '["emma","leo"]', 'paquet : cocher Emma l\'ajoute tout de suite');
  await dk.locator('.pour-item', { hasText: 'Emma' }).locator('input').uncheck();
  await a.waitForFunction(() => !document.querySelector('#deck-list .builtin-pour').textContent.includes('Emma'));
  await a.locator('#deck-list .builtin', { hasText: 'Mots anglais' }).locator('text=Modifier').click();
  ok((await a.locator('#deck-cartes').inputValue()) === 'dog | chien\ncat | chat' && JSON.stringify(await a.locator('#deck-pour input:checked').evaluateAll(l => l.map(i => i.value))) === '["leo"]', 'modifier un paquet : cartes et destinataire rechargés');
  await a.click('#reset-deck');

  // ---- 8. ce que voient les élèves ----
  const sp = await c.newPage(); sp.on('pageerror', e => errs.push(e.message));
  await sp.goto('file://' + SRC + 'Index.html'); await login(sp, { classe: '5B', pseudo: 'Léo', pin: '5555' });
  ok(JSON.stringify(await sp.locator('.card h3').allInnerTexts()) === JSON.stringify(['Grand quiz : Byzance et l\'Empire carolingien', 'Zootopia : les quartiers']), 'LÉO voit ses 2 quiz intégrés (ni Maths, ni Brouillon)');
  await sp.click('#logout'); await sp.fill('#login-pseudo', 'Emma'); await sp.fill('#login-pin', '4321'); await sp.click('#login-btn'); await sp.waitForSelector('#app:not([hidden])');
  ok(JSON.stringify(await sp.locator('.card h3').allInnerTexts()) === '["Maths"]', 'EMMA voit seulement « Maths »');

  // ---- 9. supprimer un enfant depuis sa fiche (« + ») ----
  await tab('programmes'); await openKid('adam');
  await card('adam').locator('text=Supprimer Adam').click(); await waitOk('#prog-status');
  ok(JSON.stringify(await a.locator('.prog-card .st-name').allInnerTexts()) === JSON.stringify(['Emma', 'Léo', 'Nina', 'Zoé']) && (await a.locator('#count-eleves').innerText()) === '4', 'Adam supprimé (après confirmation) : 4 fiches');
  await openKid('leo'); await card('leo').locator('text=Supprimer Léo').click(); await waitOk('#prog-status');
  ok(!w.props.builtin_assign.includes('leo') && !JSON.stringify(Object.values(w.props)).includes('"leo"') && w.try('getStudentData', '5B', 'Léo', '5555').err, 'Léo supprimé : retiré de toutes les attributions, connexion impossible');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
