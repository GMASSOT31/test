// cible: cloudflare
const { chromium } = require('playwright');
const { makeWorld, install, page, PW, ok, summary, finishSession } = require('./harness');

(async () => {
  const w = makeWorld();
  const cred = { pseudo: 'Papa', password: PW };
  w.run('adminData', cred);
  const quiz = w.run('saveQuiz', cred, { titre: 'Calcul mental', questions: [
    { question: '2 + 2 ?', options: ['4', '5'], correct: 0 },
    { question: '3 + 3 ?', options: ['5', '6'], correct: 1 },
  ] });
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await install(ctx, w);
    await ctx.addInitScript(() => {
      navigator.share = data => { window.testShare = data; return Promise.resolve(); };
    });
    const admin = await ctx.newPage();
    await admin.goto(page('admin.html'));
    await admin.fill('#admin-pseudo', cred.pseudo);
    await admin.fill('#password', PW);
    await admin.click('#unlock');
    await admin.locator('#lock-status.ok').waitFor({ state: 'attached' });
    ok(await admin.locator('#admin-color-key').isVisible(), 'le violet identifie les commandes admin');
    ok(!(await admin.locator('#quiz-invitations').evaluate(el => el.open)), 'Les orphelins est replié par défaut');
    await admin.getByRole('button', { name: /Ajouter un orphelin/ }).click();
    const form = admin.locator('#orphan-form');
    await form.getByLabel('Pseudo de l’enfant').fill('Lune');
    await form.getByLabel('Leçon', { exact: true }).selectOption({ label: 'Calcul mental' });
    const exam = await form.getByLabel('Date du contrôle').inputValue();
    await form.getByRole('button', { name: 'Créer le lien' }).click();
    const link = await form.getByLabel('Lien du quiz invité').inputValue();
    await admin.locator('#quiz-invitations summary', { hasText: 'Lune' }).waitFor();
    ok(await admin.locator('#quiz-invitations').evaluate(el => el.open), 'le nouvel invité apparaît dans Les orphelins');
    const [id, secret] = new URL(link).hash.slice(6).split('.');
    const args = ['@invitation', id, secret];
    const invited = () => w.run('getStudentData', ...args);
    ok(invited().quizzes.length === 1 && invited().srs[quiz.id].exam === exam, 'lien créé pour une leçon unique et contrôle fixé');
    ok(w.try('getStudentData', '@invitation', id, '0'.repeat(32)).err &&
      w.try('answer', ...args, 'byzance', 'deadbeef', 'qcm', true, '', 's1', 'x').err,
    'un lien incorrect ou une autre leçon sont refusés');
    ok(!JSON.stringify(w.props).includes(secret), 'le secret du lien est haché dans la base');

    const student = await ctx.newPage();
    await student.goto(link);
    await student.locator('.lesson-screen .big-btn').click();
    await finishSession(student);
    await student.getByRole('button', { name: 'Oui', exact: true }).click();
    await student.getByText('Merci pour ta réponse !').waitFor();
    await student.getByRole('button', { name: 'Envoyer à un parent' }).click();
    const referral = await student.evaluate(() => window.testShare.url);
    ok(referral.includes('/parents#invitation=') && !referral.includes(secret), 'le partage transmet un lien de création de famille distinct');
    const guests = w.run('adminData', cred).quizInvitations;
    ok(guests[0].pseudo === 'Lune' && guests[0].progress.nbSeances === 1 && guests[0].helpful === true, 'suivi et sondage associés au pseudo invité');
    ok(w.run('adminData', cred).students.length === 0, 'aucun compte élève nécessaire');

    const parent = await ctx.newPage();
    await parent.goto(referral);
    await parent.waitForSelector('#signup:not([hidden])');
    await parent.fill('#su-famille', 'Famille Test');
    await parent.fill('#su-pseudo', 'Parent Test');
    await parent.fill('#su-pw', 'mot-de-passe-test');
    await parent.fill('#su-pw2', 'mot-de-passe-test');
    await parent.click('#su-save');
    await parent.waitForSelector('#admin-area:not([hidden])');
    const parentCred = { pseudo: 'Parent Test', password: 'mot-de-passe-test' };
    ok((await parent.locator('#admin-color-key').isHidden()) && await parent.locator('#orphan-tools').isHidden() && !w.run('adminData', parentCred).quizInvitations
      && w.try('createQuizInvitation', parentCred, 'quiz', quiz.id, 'Autre', exam).err, 'le parent invité ne voit ni suivi ni commandes admin');
    ok(w.try('createFamily', new URL(referral).hash.slice(12), { famille: 'Autre', pseudo: 'Autre parent', password: 'mot-de-passe-test' }).err,
      'le lien de création de famille est à usage unique');
    w.advance(10 * 86400000);
    ok(w.try('getStudentData', ...args).err && w.run('adminData', cred).quizInvitations[0].progress.nbSeances === 1,
      'à expiration, l’accès est fermé et le suivi reste disponible');
    w.run('removeQuizInvitation', cred, id);
    ok(!w.run('adminData', cred).quizInvitations && !w.props['srs_' + id + '__' + quiz.id], 'suppression explicite de l’invitation et de son suivi');
  } finally {
    await browser.close();
  }
  process.exit(summary() ? 1 : 0);
})().catch(error => { console.log('ECHEC:', error.message); process.exit(1); });
