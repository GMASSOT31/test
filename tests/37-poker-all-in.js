// cible: cloudflare
const { chromium } = require('playwright');
const { makeWorld, install, page, login, LEO, PW, ok, summary } = require('./harness');

(async () => {
  const world = makeWorld();
  world.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  const id = 'poker-all-in';
  const quizzes = () => world.run('getStudentData', '5B', 'Léo', '1234').quizzes;
  ok(!quizzes().some(q => q.id === id), 'le quiz est caché avant attribution');

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
    await install(context, world);
    const admin = await context.newPage();
    await admin.goto(page('admin.html'));
    await admin.fill('#admin-pseudo', 'Papa');
    await admin.fill('#password', PW);
    await admin.click('#unlock');
    await admin.locator('#lock-status.ok').waitFor({ state: 'attached' });
    await admin.click('#tab-quiz-liste');
    await admin.locator('#provided-lessons .ls-toggle').click();
    const lesson = admin.locator(`#builtin-list .builtin[data-id="${id}"]`);
    await lesson.locator('.builtin-toggle').click();
    await lesson.locator('.pour-item', { hasText: 'Léo' }).locator('input').check();
    await lesson.locator('.builtin-pour').filter({ hasText: 'Léo' }).waitFor();
    const quiz = quizzes().find(q => q.id === id);
    ok(quiz.questions.length === 20, 'l’attribution depuis les Leçons fournies rend les 20 questions accessibles');

    const outsId = 'poker-outs';
    world.run('setBuiltinAssign', { pseudo: 'Papa', password: PW }, outsId, ['leo']);
    ok(quizzes().find(q => q.id === outsId).questions.length === 15, 'le nouveau quiz contient exactement 15 questions');

    const student = await context.newPage();
    await student.goto(page('Index.html'));
    await login(student, LEO);
    const expected = [52, 26, 27, 47, 34, 26, 87, 92, 22, 4, 75, 37, 16, 18, 95, 75, 30, 50, 97, 98];
    const images = new Set();
    for (const [i, percent] of expected.entries()) {
      await student.evaluate(([id, i]) => revisionPreview(id, i, 'qcm'), [id, i]);
      const image = student.locator('.question-image');
      const asset = await image.evaluate(async img => {
        await img.decode();
        return { src: img.getAttribute('src'), alt: img.alt, right: img.getBoundingClientRect().right };
      });
      images.add(asset.src);
      ok(asset.alt.includes('Pouille') && asset.alt.includes('Zigouille') && asset.right <= 360,
        `question ${i + 1} : image chargée avec description et adaptée à 360 px`);
      await student.getByRole('button', { name: percent + ' %', exact: true }).click();
      ok(await student.evaluate(() => window.revisionPreviewResult === true),
        `question ${i + 1} : ${percent} % accepté`);
    }
    ok(images.size === 20, 'une image distincte par question');

    const outsExpected = [61, 26, 34, 56, 26, 19, 85, 74, 20, 9, 23, 34, 0, 100, 98];
    for (const [i, percent] of outsExpected.entries()) {
      await student.evaluate(([id, index]) => revisionPreview(id, index, 'qcm'), [outsId, i]);
      const asset = await student.locator('.question-image').evaluate(async img => {
        await img.decode();
        return { src: img.getAttribute('src'), alt: img.alt, right: img.getBoundingClientRect().right };
      });
      const stage = i < 8 ? 'Flop' : 'Turn';
      ok(asset.src === '/poker-outs-' + String(i + 1).padStart(2, '0') + '.png' &&
        asset.alt.includes('Pouille :') && asset.alt.includes('Zig :') && asset.alt.includes(stage + ' :') && asset.right <= 360,
      `outs, question ${i + 1} : cartes du ${stage.toLowerCase()} chargées à 360 px`);
      await student.getByRole('button', { name: percent + ' %', exact: true }).click();
      ok(await student.evaluate(() => window.revisionPreviewResult === true),
        `outs, question ${i + 1} : ${percent} % accepté`);
    }
  } finally {
    await browser.close();
  }
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message); process.exit(1); });
