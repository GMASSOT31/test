// Parcours de révision côté page élève (cahier des charges V3.1) : quiz initial -> cartes ciblées -> vérification -> paquet final -> validation
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('setBuiltinAssign', PW, 'zootopia', ['leo']);
const Lc = ['5B', 'Léo', '1234'];
const ZOO = ['sahara square', 'tundratown', 'downtown', 'rainforest district', 'skyscrapers', 'sand dunes', 'waterfall', 'raffe', 'el', 'humid'];
const pc = () => w.run('getStudentData', ...Lc).parcours.zootopia;

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1100, height: 1000 } }); await install(c, w);
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  const sync = () => p.evaluate(() => revisionFlush());
  const card = () => p.locator('.card.lecon', { hasText: 'Zootopia' });
  const nextBtn = () => p.locator('.panel .btn', { hasText: /suivante|résultat/ });
  const result = async () => ((await p.locator('.etape-msg').innerText()) || '').replace(/\s+/g, ' ').trim();
  const typed = async (txt) => { await p.fill('.saisie', txt); await p.keyboard.press('Enter'); };

  // ---- accueil : statut et action unique ----
  ok((await card().locator('.etape').innerText()).includes('Quiz initial : toutes les questions, une seule fois') && (await card().locator('.action-pill').innerText()) === 'Commencer le quiz', 'ACCUEIL : statut « ' + await card().locator('.etape').innerText() + ' », action « Commencer le quiz »');
  ok((await card().locator('.verified').innerText()) === 'Questions vérifiées : 0 sur 10' && (await card().locator('.dot').count()) === 4, 'compteur libellé « Questions vérifiées : 0 sur 10 » et 4 étapes (pas de « 3 passages »)');
  ok(!(await card().innerText()).includes('passages'), 'aucun indicateur fondé sur trois passages');

  // ---- étape 1 : UN quiz initial complet : 8 justes, Q9 erreur puis correction, Q10 « Je ne sais pas » ----
  await card().click();
  ok((await p.locator('.etape-banner').innerText()).startsWith('Quiz initial') && (await p.locator('.progress').innerText()).includes('Question 1 / 10'), 'le quiz initial pose TOUTES les questions (1 / 10)');
  for (let i = 0; i < 8; i++) { await typed(ZOO[i]); await nextBtn().click(); }
  await typed('faux'); await typed(ZOO[8]);
  ok((await p.locator('.feedback').innerText()).includes('sans point'), 'Q9 : erreur puis bonne réponse = sans point');
  await nextBtn().click();
  ok(await p.locator('text=Je ne sais pas').isVisible(), 'Q10 : « Je ne sais pas » visible tout de suite');
  await p.click('text=Je ne sais pas');
  ok((await p.locator('.feedback').innerText()).includes('humid') && await p.locator('.saisie').isDisabled(), 'Je ne sais pas : réponse affichée, champ verrouillé');
  await nextBtn().click();
  ok((await p.locator('.final').innerText()) === '8 / 10', 'score du premier essai : 8 / 10');
  await p.locator('.actions .btn', { hasText: 'Revoir mes cartes' }).waitFor();
  ok((await result()).includes('2 questions à retravailler'), 'bilan : « ' + await result() + ' »');
  await sync();
  ok(pc().etape === 'cartes_ciblees' && pc().pile.ids.length === 2, 'serveur : cartes_ciblees avec les 2 questions ratées seulement (pas les 8 réussies)');

  // ---- étape 2 : cartes ciblées ----
  await p.click('.actions .btn:has-text("Revoir mes cartes")');
  ok((await p.locator('.cards-count').innerText()) === 'Cartes travaillées 0 sur 2 · Cartes encore à revoir 2' && (await p.locator('.eval-btn').count()) === 0, 'cartes ciblées : « ' + await p.locator('.cards-count').innerText() + ' », aucune évaluation avant le verso');
  ok((await p.locator('.flashcard .face-label').innerText()).toLowerCase() === 'question' && (await p.locator('.flashcard').innerText()).includes('Cherche ta réponse'), 'recto : question seule + « Cherche ta réponse »');
  await p.click('.flip-btn');
  ok((await p.locator('.eval-btn').allInnerTexts()).join('|') === '❌ Oublié|🤔 Hésité|✅ Trouvé', 'après retournement : exactement Oublié, Hésité, Trouvé');
  await p.click('.eval-btn.oublie');                                   // Q9 oublié
  await p.click('.flashcard');                                          // Q10 (jamais vue) : retournement par clic sur la carte
  await p.click('.eval-btn.trouve');
  ok((await p.locator('.cards-count').innerText()) === 'Cartes travaillées 2 sur 2 · Cartes encore à revoir 1', 'Q9 oublié revient : « ' + await p.locator('.cards-count').innerText() + ' »');
  ok((await p.locator('.eval-btn').count()) === 0 && (await p.locator('.flashcard .face-label').innerText()).toLowerCase() === 'question', 'la carte oubliée revient au RECTO, évaluation à refaire');
  await p.click('.flashcard'); await p.click('.eval-btn.hesite');
  await p.click('.flashcard'); await p.click('.eval-btn.trouve');
  await p.locator('.finish-btn').waitFor();
  ok((await p.locator('.finish-btn').innerText()) === 'Vérifier mes réponses', 'tout Trouvé : bouton « Vérifier mes réponses »');
  await p.click('.finish-btn');
  await p.locator('.etape-banner').waitFor();
  ok((await p.locator('.etape-banner').innerText()) === 'Vérification · 10 questions à vérifier', 'vérification de TOUTES les questions sous 2 sur 2 : « ' + await p.locator('.etape-banner').innerText() + ' »');
  ok(pc().etape === 'verification', 'serveur : verification');

  // ---- étape 3 : vérification (tout juste) : Q9 et Q10 restent à 1 sur 2 ----
  for (let i = 0; i < 10; i++) { await typed(ZOO[i]); await nextBtn().click(); }
  await p.locator('.actions .btn', { hasText: 'Continuer la vérification' }).waitFor();
  const r2 = await result();
  ok(r2.includes('Questions restant à vérifier : 2') && r2.includes('Questions vérifiées : 8 sur 10'), 'bilan de vérification : « ' + r2 + ' »');
  await sync();
  ok(pc().etape === 'verification' && pc().pass.list.length === 2, 'serveur : le passage suivant ne contient QUE les 2 questions à 1 sur 2 (pas de nouveau passage complet)');
  await p.click('.actions .btn:has-text("Continuer la vérification")');
  ok((await p.locator('.etape-banner').innerText()) === 'Vérification · 2 questions à vérifier' && (await p.locator('.progress').innerText()).includes('Question 1 / 2'), 'passage suivant : 2 questions seulement');
  await typed(ZOO[8]); await nextBtn().click(); await typed(ZOO[9]); await nextBtn().click();
  await p.locator('.actions .btn', { hasText: 'Réviser toutes les cartes' }).waitFor();
  ok((await result()).includes('Toutes tes questions sont vérifiées') && (await result()).includes('Questions vérifiées : 10 sur 10'), 'toutes vérifiées : « ' + await result() + ' »');
  await sync(); ok(pc().etape === 'cartes_finales' && pc().pile.ids.length === 10, 'serveur : cartes_finales avec les 10 cartes (même celles à 2 sur 2)');
  ok(w.run('getStudentData', ...Lc).fois.zootopia === 3, 'compteur « fait N fois » : 3 passages terminés (initial + 2 vérifications)');

  // ---- étape 4 : paquet final : toutes les cartes, chacune retournée, évaluée, Trouvé ----
  await p.click('.actions .btn:has-text("Réviser toutes les cartes")');
  ok((await p.locator('.cards-count').innerText()) === 'Cartes travaillées 0 sur 10 · Cartes encore à revoir 10', 'paquet final : 10 cartes distinctes');
  await p.click('.flashcard'); await p.click('.eval-btn.oublie');                // une carte « Oublié » revient plus tard
  for (let i = 0; i < 9; i++) { await p.click('.flashcard'); await p.click('.eval-btn.trouve'); }
  ok((await p.locator('.finish-btn').count()) === 0 && (await p.locator('.cards-count').innerText()).includes('Cartes encore à revoir 1'), 'tant que la carte oubliée n\'est pas Trouvé : pas de fin (' + await p.locator('.cards-count').innerText() + ')');
  await p.click('.flashcard'); await p.click('.eval-btn.trouve');
  ok((await p.locator('.finish-btn').innerText()) === '👩‍🏫 Faire valider par un adulte', 'bouton final : « Faire valider par un adulte »');
  await p.click('.finish-btn');
  await p.locator('h2', { hasText: 'En attente de validation' }).waitFor();
  ok(pc().etape === 'attente_validation' && pc().fini > 0, 'état « En attente de validation » affiché APRÈS confirmation serveur');
  await p.click('text=Retour aux leçons');
  ok((await card().locator('.etape').innerText()).includes('En attente de validation') && (await card().locator('.action-pill').innerText()) === 'Voir la demande de validation', 'accueil : « ' + await card().locator('.etape').innerText() + ' »');
  w.run('validateParcours', PW, 'leo', 'zootopia');
  await p.reload(); await p.waitForSelector('#app:not([hidden])');
  ok((await card().locator('.etape').innerText()).includes('Parcours validé') && (await card().locator('.action-pill').innerText()) === 'Voir le parcours validé', 'après validation adulte : « Parcours validé »');
  await card().click(); ok((await p.locator('h2').filter({ hasText: 'Parcours validé' }).count()) === 1, 'écran « Parcours validé »');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
