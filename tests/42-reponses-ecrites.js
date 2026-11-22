// cible: cloudflare
const { chromium } = require('playwright');
const { makeWorld, install, login, LEO, PW, page, ok, summary } = require('./harness');

(async () => {
  const world = makeWorld();
  const owner = { pseudo: 'Papa', password: PW };
  world.run('adminData', owner);
  world.run('saveStudent', owner, LEO);
  const expected = 'tú tienes / el tiene';
  const { id } = world.run('saveQuiz', owner, {
    titre: 'Espagnol : tener', pour: ['leo'],
    questions: [
      { question: 'Conjugue tener à la deuxième et à la troisième personne.', reponses: [expected] },
      { question: 'Donne les deux formes de tener.', options: ['tu tengo / el tienen', expected], correct: 1, rappel: ['tienes / tiene'] },
    ],
  });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await install(context, world);
    const p = await context.newPage();
    await p.goto(page('Index.html'));
    await login(p, LEO);
    const answer = async (index, text) => {
      await p.evaluate(([quizId, index]) => revisionPreview(quizId, index, 'rappel'), [id, index]);
      await p.locator('.saisie').fill(text);
      await p.locator('.saisie').press('Enter');
      return p.evaluate(() => window.revisionPreviewResult);
    };
    ok(await answer(0, 'tú tienes / él tiene'), 'une réponse écrite accepte él même si le corrigé indique el');
    ok(await answer(1, 'tú tienes / él tiene'), 'en rappel, le corrigé complet affiché est accepté');
    ok(await answer(1, 'tienes / tiene'), 'la variante courte reste acceptée');
    ok(await answer(1, 'tú tienes / él tienen') === false, 'une conjugaison incorrecte reste refusée');
  } finally {
    await browser.close();
  }
  process.exit(summary() ? 1 : 0);
})().catch(error => { console.log('ECHEC:', error.message); process.exit(1); });
