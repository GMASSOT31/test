// cible: cloudflare
const { chromium } = require('playwright');
const { makeWorldCf, install, ok, summary, page } = require('./harness');

(async () => {
  const w = makeWorldCf({ ADMIN_PASSWORD: 'secret12' });
  const owner = { pseudo: 'Papa', password: 'secret12' };
  const family = { pseudo: 'Dupont', password: 'motdepasse1' };
  const questions = [{ question: '1 + 1 ?', options: ['1', '2'], correct: 1 }];
  w.run('adminData', owner);
  const code = w.run('setInviteCode', owner, 'new').code;
  w.run('createFamily', code, { ...family, famille: 'Dupont' });
  w.run('saveStudent', owner, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  const quiz = w.run('saveQuiz', owner, { titre: 'Calcul', pour: ['leo'], questions }).id;
  const familyQuiz = w.run('saveQuiz', family, { titre: 'Dictée', questions }).id;
  const deck = w.run('saveDeck', owner, { titre: 'Vocabulaire', cartes: [{ recto: 'pomme', verso: 'apple' }] }).id;
  const before = w.run('getStudentData', '5B', 'Léo', '1234').quizzes;
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 360, height: 720 }, isMobile: true, hasTouch: true });
    await install(context, w);
    const admin = await context.newPage();
    const connect = async (tab, cred) => {
      await tab.goto(page('admin.html', 'cloudflare'));
      await tab.fill('#admin-pseudo', cred.pseudo);
      await tab.fill('#password', cred.password);
      await tab.click('#unlock');
      await tab.locator('#lock-status.ok').waitFor({ state: 'attached' });
      await tab.click('#tab-quiz-liste');
    };
    await connect(admin, owner);
    await admin.getByText('➕ Créer une discipline', { exact: true }).click();
    await admin.getByLabel('Nom de la discipline').fill('Mathématiques');
    await admin.getByRole('button', { name: 'Créer la discipline', exact: true }).click();
    await admin.getByText('Discipline créée.', { exact: false }).waitFor();
    const state = () => w.run('adminData', owner).lessonClassification;
    const [{ id }] = state().disciplines;
    ok(w.try('createLessonDiscipline', owner, ' mathematiques ').err, 'les doublons ne créent pas une seconde discipline');
    ok(w.try('createLessonDiscipline', family, 'Privée').err && w.try('classifyLesson', family, 'quiz', familyQuiz, id).err,
      'une famille ne peut pas créer de discipline ni modifier le classement');
    ok(w.try('classifyLesson', owner, 'quiz', 'absent', id).err && w.try('classifyLesson', owner, 'quiz', quiz, 'absente').err,
      'une leçon ou une discipline inexistante est refusée');

    for (const [section, lesson] of [['my-lessons', quiz], ['provided-lessons', 'zootopia'], ['family-lessons', familyQuiz], ['deck-lessons', deck]]) {
      const block = admin.locator('#' + section);
      await block.locator('.ls-toggle').click();
      const row = block.locator('.builtin[data-id="' + lesson + '"]');
      await row.locator('.builtin-toggle').click();
      await row.getByLabel('Discipline', { exact: true }).selectOption(id);
      await block.locator('.discipline-group', { hasText: 'Mathématiques' }).locator('.builtin[data-id="' + lesson + '"]').waitFor();
      ok(await row.isVisible(), 'le classement s’affiche immédiatement dans ' + section);
    }
    ok(Object.keys(state().byLesson).length === 4, 'les quatre types sont enregistrés côté serveur');
    ok(JSON.stringify(before) === JSON.stringify(w.run('getStudentData', '5B', 'Léo', '1234').quizzes),
      'le classement ne change ni les leçons ni les attributions de l’élève');
    ok(!w.run('adminData', family).lessonClassification, 'le classement reste privé');
    ok(w.run('backupData', owner).proprietes['lesson_classification_quiz:' + quiz] === id, 'le classement est inclus dans la sauvegarde');

    await connect(admin, owner);
    const myLessons = admin.locator('#my-lessons');
    const group = myLessons.locator('.discipline-group', { hasText: 'Mathématiques' });
    await group.locator('summary').click();
    const row = group.locator('.builtin');
    await row.locator('.builtin-toggle').click();
    ok(await row.getByLabel('Discipline', { exact: true }).inputValue() === id, 'le classement revient à la reconnexion');
    await row.getByLabel('Discipline', { exact: true }).selectOption('');
    await myLessons.locator('.builtin[data-id="' + quiz + '"]').waitFor();
    ok(!state().byLesson['quiz:' + quiz] && state().byLesson['builtin:zootopia'] === id,
      'retirer une leçon de sa discipline ne touche pas les autres');
    w.run('deleteDeck', owner, deck);
    ok(!state().byLesson['deck:' + deck], 'la suppression d’un paquet efface aussi son classement');
  } finally {
    await browser.close();
  }
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message); process.exit(1); });
