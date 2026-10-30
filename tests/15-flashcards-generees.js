const { chromium } = require('playwright');
const { makeWorld, install, login } = require('./harness');
const W = makeWorld(); require('./harness').seed(W, { allToLeo: true });
const ok = (c, m) => console.log((c ? 'OK   ' : 'ECHEC'), m);
(async () => {
  const b = await chromium.launch();
  const p = await (await (async () => { const c = await b.newContext(); await install(c, W); return c; })()).newPage({ viewport: { width: 1000, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').join(__dirname, '..', 'apps-script', 'Index.html') + ''); await login(p);
  const quizTitles = await p.locator('.card h3').allInnerTexts();
  await p.click('#tab-flashcards');
  const deckTitles = await p.locator('.card h3').allInnerTexts();
  ok(JSON.stringify(deckTitles) === JSON.stringify(quizTitles), 'paquets = mêmes noms que les quiz : ' + deckTitles.join(' / '));
  ok((await p.locator('#count-flashcards').innerText()) === '3', 'compteur Flashcards = 3');
  console.log('metas:', await p.locator('.card .meta').allInnerTexts());

  // vérification exhaustive : chaque carte = question / bonne réponse
  const bad = await p.evaluate(() => {
    const out = [];
    decksFromQuizzes().forEach((d, i) => d.cartes.forEach((c, j) => {
      const q = QUIZZES[i].questions[j];
      const want = q.reponses ? q.reponses[0] : q.options[q.correct];
      if (c.recto !== q.question || c.verso !== want || !c.verso) out.push(d.titre + ' #' + (j + 1));
    }));
    return out;
  });
  ok(bad.length === 0, 'toutes les cartes (50) ont recto = question et verso = bonne réponse ' + JSON.stringify(bad));

  // parcours du paquet du grand quiz
  await p.locator('.card', { hasText: 'Grand quiz' }).click();
  ok((await p.locator('.face-text').innerText()).startsWith("En quelle année s'effondre"), 'recto de la carte 1');
  await p.locator('.flashcard').click();
  ok((await p.locator('.face-text').innerText()) === '476', 'verso de la carte 1 = 476');
  ok((await p.locator('.progress').innerText()).includes('Cartes travaillées 0 sur 30') && (await p.locator('.progress').innerText()).includes('Cartes encore à revoir 30'), 'paquet de 30 cartes distinctes : « Cartes travaillées 0 sur 30 · Cartes encore à revoir 30 »');
  // Zootopia
  await p.click('text=Retour à la liste');
  await p.locator('.card', { hasText: 'Zootopia' }).click();
  await p.locator('.flashcard').click();
  ok((await p.locator('.face-text').innerText()) === 'sahara square', 'Zootopia carte 1 : verso = sahara square');
  ok(!(await p.locator('.panel').innerText()).includes('undefined'), 'pas de "undefined"');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close();
})();
