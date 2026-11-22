// cible: cloudflare
const { chromium } = require('playwright');
const { makeWorld, install, login, LEO, PW, page, startLesson, ok, summary } = require('./harness');

(async () => {
  const w = makeWorld();
  w.advance(Date.parse('2026-11-22T12:00:00Z') - w.now());
  const owner = { pseudo: 'Papa', password: PW };
  const creds = [LEO.classe, LEO.pseudo, LEO.pin];
  w.run('adminData', owner);
  w.run('saveStudent', owner, LEO);
  const { id } = w.run('saveQuiz', owner, { titre: 'Repère de mémoire', pour: ['leo'],
    questions: [{ question: 'Quel est le satellite de la Terre ?', options: ['La Lune', 'Mars'], correct: 0 }] });
  const qid = w.run('getStudentData', ...creds).quizzes[0].questions[0].id;

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 720 } });
    await install(ctx, w);
    const student = await ctx.newPage();
    await student.goto(page('Index.html'));
    await login(student, LEO);
    await startLesson(student, 'Repère de mémoire', { tf: true });
    const fitsScreen = async width => {
      await student.setViewportSize({ width, height: 720 });
      const bounds = await student.locator('.session').boundingBox();
      return Math.round(bounds.x) === 0 && Math.round(bounds.width) === width &&
        await student.locator('.rv-banner').isHidden() && await student.locator('.sidebar').isHidden();
    };
    ok(await fitsScreen(360) && await fitsScreen(900), 'la séance occupe toute la largeur sur téléphone et tablette');
    await student.getByRole('button', { name: 'Mars', exact: true }).click();
    ok(await student.locator('.next-btn').isVisible(), 'la première erreur garde le parcours habituel');
    await student.locator('.next-btn').click();
    await student.getByRole('button', { name: 'Mars', exact: true }).click();
    const form = student.locator('form.memory-scene');
    ok(await form.isVisible() && await student.locator('.next-btn').isHidden(), 'la deuxième erreur demande une scène avant de continuer');
    const save = form.getByRole('button', { name: 'Garder mon indice' });
    await save.click();
    ok(await form.isVisible(), 'la scène vide ne fait pas avancer la séance');
    const cue = 'Dans ma cuisine, la Lune roule autour de ma table comme un ballon.';
    await form.getByLabel('Mon image').fill(cue);
    await save.click();
    await student.getByText('Mon indice', { exact: false }).waitFor();
    const hint = student.locator('details.memory-scene');
    ok(!await hint.evaluate(el => el.open), 'l’indice reste masqué jusqu’au clic');
    await hint.locator('summary').click();
    ok(await hint.getByText(cue, { exact: true }).isVisible(), 'la scène personnelle réapparaît à la question suivante');
    await student.getByRole('button', { name: 'Arrêter', exact: false }).click();
    ok(await student.locator('.rv-banner').isVisible() && await student.locator('.sidebar').isVisible(), 'le bilan rétablit la navigation');
    const stored = w.run('getStudentData', ...creds).srs[id];
    ok(stored.memoryCues[qid] === cue && stored.it[qid][2] === 1, 'l’indice est conservé séparément du compteur de progression');
    ok(!JSON.stringify(w.run('adminData', owner).progress).includes(cue), 'la description ne figure pas dans le suivi parent');
    ok(w.try('saveMemoryCue', ...creds, id, 'deadbeef', cue).err, 'un indice ne peut pas être attribué à une question étrangère');
  } finally {
    await browser.close();
  }
  process.exit(summary() ? 1 : 0);
})().catch(error => { console.log('ECHEC:', error.message); process.exit(1); });
