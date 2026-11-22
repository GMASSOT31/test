// cible: cloudflare
const { chromium } = require('playwright');
const { makeWorld, install, login, LEO, PW, page, startLesson, ok, summary } = require('./harness');

(async () => {
  const world = makeWorld();
  const owner = { pseudo: 'Papa', password: PW };
  world.run('adminData', owner);
  world.run('saveStudent', owner, LEO);
  const question = 'Combien font deux et deux ?';
  const explanation = 'On ajoute deux unités.';
  const quiz = world.run('saveQuiz', owner, {
    titre: 'Calcul à écouter', pour: ['leo'],
    questions: [{ question, options: ['Trois', 'Quatre', 'Cinq'], correct: 1, explication: explanation }],
  });
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 720 } });
    await install(ctx, world, { auto: true });
    await ctx.addInitScript(() => {
      let pending;
      window.voice = { texts: [], cancelled: 0 };
      window.SpeechSynthesisUtterance = class {
        constructor(text) { this.text = text; }
      };
      Object.defineProperty(window, 'speechSynthesis', { value: {
        speak(utterance) { pending = utterance; window.voice.texts.push([utterance.text, utterance.lang]); },
        cancel() { pending = null; window.voice.cancelled++; },
      } });
      window.finishSpeech = () => {
        while (pending) {
          const utterance = pending;
          pending = null;
          utterance.onend();
        }
        return window.voice.texts.splice(0);
      };
    });
    const p = await ctx.newPage();
    await p.goto(page('Index.html'));
    await login(p, LEO);
    await startLesson(p, 'Calcul à écouter', { tf: false });

    await p.getByRole('button', { name: 'Écouter la carte', exact: true }).click();
    const discovery = await p.evaluate(() => window.finishSpeech());
    ok(JSON.stringify(discovery) === JSON.stringify([[question, 'fr-FR'], ['Quatre', 'fr-FR'], [explanation, 'fr-FR']]),
      'la découverte lit la question, la réponse et l’explication en français');
    await p.getByRole('button', { name: 'Écouter la carte', exact: true }).click();
    await p.getByRole('button', { name: /carte suivante/ }).click();
    await p.waitForFunction(() => window.voice.cancelled > 0);
    ok(true, 'changer de carte arrête la lecture précédente');
    await p.evaluate(() => window.voice.texts.splice(0));

    const options = await p.locator('.option').allTextContents();
    await p.getByRole('button', { name: 'Écouter la question', exact: true }).click();
    const spoken = await p.evaluate(() => window.finishSpeech().map(([text]) => text));
    ok(JSON.stringify(spoken) === JSON.stringify([question, ...options.map((option, i) => 'Proposition ' + (i + 1) + '. ' + option)]),
      'le QCM lit les propositions dans l’ordre affiché');

    await p.getByRole('button', { name: 'Quatre', exact: true }).click();
    const correction = p.getByRole('button', { name: 'Écouter la correction', exact: true });
    ok(await correction.isVisible() && await p.locator('.auto-next').isHidden(),
      'après avoir utilisé l’audio, l’élève peut écouter la correction sans passage automatique');
    await correction.click();
    ok((await p.evaluate(() => window.finishSpeech().map(([text]) => text))).includes(explanation), 'la correction lit l’explication');

    await p.evaluate(id => revisionPreview(id, 0, 'rappel'), quiz.id);
    await p.getByRole('button', { name: 'Écouter la question', exact: true }).click();
    ok(JSON.stringify(await p.evaluate(() => window.finishSpeech().map(([text]) => text))) === JSON.stringify([question]),
      'le rappel ne lit pas les propositions tant qu’elles sont masquées');
    await p.getByRole('button', { name: /Je sais, je suis sûr/ }).click();
    await p.getByRole('button', { name: 'Écouter la question', exact: true }).click();
    ok((await p.evaluate(() => window.finishSpeech().map(([text]) => text))).length === 4, 'les propositions révélées sont lues');
  } finally {
    await browser.close();
  }
  process.exit(summary() ? 1 : 0);
})().catch(error => { console.log('ECHEC:', error.message); process.exit(1); });
