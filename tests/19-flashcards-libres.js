// Flashcards libres (retournement obligatoire, Oublié / Hésité / Trouvé), doubles clics, clavier, « Voir les cartes » d'une leçon
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
w.run('saveDeck', PW, { titre: 'Quatre', matiere: 'Test', emoji: '4️⃣', cartes: ['A', 'B', 'C', 'D'].map(x => ({ recto: 'Carte ' + x, verso: 'Réponse ' + x })), pour: ['leo'] });
w.run('saveDeck', PW, { titre: 'Une seule', matiere: 'Test', emoji: '1️⃣', cartes: [{ recto: 'Seule', verso: 'Unique' }], pour: ['leo'] });
w.run('saveQuiz', PW, { titre: 'Mixte', matiere: 'Test', emoji: '🧩', pour: ['leo'], questions: [
  { question: 'Champs ?', champs: [{ label: 'Un', reponses: ['un'] }, { label: 'Deux', reponses: ['deux'] }], explication: 'Un puis deux.' },
  { question: 'Texte ?', reponses: ['abc'], explication: 'Parce que a, b, c.' },
  { question: 'QCM ?', options: ['x', 'y'], correct: 1 }] });
const Lc = ['5B', 'Léo', '1234'];
const mixId = w.run('adminData', PW).quizzes.find(q => q.titre === 'Mixte').id;
const mixQ = w.run('adminData', PW).quizzes.find(q => q.titre === 'Mixte').questions.map(q => q.id);

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 800 } }); await install(c, w);
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  const sync = () => p.evaluate(() => revisionFlush());
  const face = async () => (await p.locator('.flashcard .face-text').innerText()).trim();
  const nextBtn = () => p.locator('.panel .btn', { hasText: /suivante|résultat/ });

  // ================= T04 : répétition des cartes (flashcards libres, pile de 4) =================
  await p.click('#tab-flashcards'); await p.locator('.card', { hasText: 'Quatre' }).click();
  const order = [];
  const rate = async (cls) => { order.push(await face()); await p.click('.flip-btn'); await p.click('.eval-btn.' + cls); };
  await rate('oublie'); await rate('hesite'); await rate('trouve'); await rate('trouve');
  ok(order.join() === 'Carte A,Carte B,Carte C,Carte D', 'les 4 cartes sont présentées une fois, dans l\'ordre : ' + order.join(', '));
  ok((await p.locator('.cards-count').innerText()) === 'Cartes travaillées 4 sur 4 · Cartes encore à revoir 2', 'compteurs : 4 cartes distinctes (« ' + await p.locator('.cards-count').innerText() + ' »)');
  ok((await face()) === 'Carte A' && (await p.locator('.eval-btn').count()) === 0, 'A (Oublié) revient d\'abord, au recto');
  await rate('trouve');
  ok((await face()) === 'Carte B', 'puis B (Hésité), après A');
  ok((await p.locator('.finish-btn').count()) === 0, 'pas de fin tant que B n\'est pas Trouvé');
  await rate('hesite');
  ok((await face()) === 'Carte B' && (await p.locator('.cards-count').innerText()).includes('encore à revoir 1'), 'B encore Hésité : revient (seule carte restante, au recto) ; total toujours 4');
  await rate('trouve');
  await p.locator('.finish-btn').waitFor();
  ok((await p.locator('.finish-btn').innerText()) === 'Terminer la séance' && (await p.locator('.cards-count').innerText()) === 'Cartes travaillées 4 sur 4 · Cartes encore à revoir 0', 'tout Trouvé : fin de séance');
  ok(JSON.stringify(Object.keys(w.props).filter(k => k.startsWith('parcours_'))) === '[]', 'les flashcards libres ne touchent pas au parcours obligatoire (aucun enregistrement serveur)');

  // ================= T05 : aucun contournement par navigation =================
  await p.click('.back'); await p.locator('.card', { hasText: 'Quatre' }).click();
  ok((await p.locator('text=Suivante').count()) === 0 && (await p.locator('text=Précédente').count()) === 0, 'plus de boutons Suivante / Précédente');
  for (let i = 0; i < 3; i++) await p.click('text=Mélanger');
  ok((await p.locator('.finish-btn').count()) === 0 && (await p.locator('.cards-count').innerText()).includes('travaillées 0 sur 4') && (await p.locator('.eval-btn').count()) === 0, 'Mélanger ne valide rien et les évaluations restent absentes avant le verso');
  await p.click('.flip-btn');
  await p.evaluate(() => { const b = document.querySelector('.eval-btn.trouve'); b.click(); b.click(); b.click(); });   // triple clic
  ok((await p.locator('.cards-count').innerText()).includes('travaillées 1 sur 4'), 'triple clic sur une évaluation : une seule transition (' + await p.locator('.cards-count').innerText() + ')');
  await p.click('.back'); await p.click('#tab-flashcards'); await p.locator('.card', { hasText: 'Une seule' }).click();
  await p.click('.flip-btn'); await p.click('.eval-btn.oublie');
  ok((await face()) === 'Seule' && (await p.locator('.eval-btn').count()) === 0 && (await p.locator('.finish-btn').count()) === 0, 'pile d\'une seule carte : réapparaît au recto après Oublié, sans boucle automatique');
  await p.waitForTimeout(600);
  ok((await face()) === 'Seule' && (await p.locator('.eval-btn').count()) === 0, 'aucune minuterie : elle attend une action de l\'élève');
  await p.keyboard.press('Tab'); await p.click('.flip-btn'); await p.click('.eval-btn.trouve');
  ok((await p.locator('.finish-btn').count()) === 1, 'pile d\'une carte : Trouvé permet la fin');
  // clavier : Entrée / Espace retournent la carte
  await p.click('.back'); await p.click('#tab-flashcards'); await p.locator('.card', { hasText: 'Quatre' }).click();
  await p.locator('.flip-btn').focus(); await p.keyboard.press('Enter');
  ok((await p.locator('.eval-btn').count()) === 3, 'Entrée retourne la carte (bouton focalisé)');
  await p.click('.eval-btn.trouve'); await p.locator('.flip-btn').focus(); await p.keyboard.press('Space');
  ok((await p.locator('.eval-btn').count()) === 3, 'Espace retourne la carte');

  // « Voir les cartes » depuis une leçon : même paquet, sans effet sur le plan
  await p.click('.back'); await p.click('#tab-quiz'); await p.locator('.card.lecon', { hasText: 'Mixte' }).click();
  if (await p.locator('.setup').count()) { await p.locator('.choice', { hasText: 'Pas de contrôle prévu' }).click(); await p.locator('.choice.wide', { hasText: 'Non' }).click(); await p.click('.setup .actions .btn'); await p.waitForSelector('.session-head'); await p.click('text=Arrêter'); if (await p.locator('.result').count()) await p.click('text=Retour aux leçons'); await p.locator('.card.lecon', { hasText: 'Mixte' }).click(); }
  await p.click('text=Voir les cartes');
  ok((await p.locator('.cards-count').innerText()).includes('sur 3') && (await p.locator('.back').innerText()).includes('Retour à la leçon'), '« Voir les cartes » d\'une leçon : ses 3 cartes, retour à la leçon');
  await p.click('.back'); ok(await p.locator('.lesson-screen').isVisible(), 'retour à l\'écran de la leçon');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
