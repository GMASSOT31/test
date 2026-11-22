// cible: cloudflare
const { chromium } = require('playwright');
const { makeWorld, install, login, LEO, PW, page, startLesson, ok, summary } = require('./harness');

(async () => {
  const w = makeWorld();
  const owner = { pseudo: 'Papa', password: PW };
  const family = { pseudo: 'Dupont', password: 'motdepasse1' };
  const creds = [LEO.classe, LEO.pseudo, LEO.pin];
  w.run('adminData', owner);
  const code = w.run('setInviteCode', owner, 'new').code;
  w.run('createFamily', code, { ...family, famille: 'Dupont' });
  w.run('saveStudent', owner, LEO);
  const { id: quiz } = w.run('saveQuiz', owner, { titre: 'Calcul actif', pour: ['leo'],
    questions: [{ question: 'Deux et deux ?', options: ['Trois', 'Quatre'], correct: 1 }] });
  const activity = () => w.run('getQuizActivity', owner).leo;
  const report = (sid, id, answered) => w.run('reportQuizActivity', ...creds, sid, id, answered);
  ok(w.try('getQuizActivity', family).err && w.try('reportQuizActivity', ...creds, 'testtab01', 'byzance', false).err,
    'les familles invitées et les quiz non attribués sont exclus du suivi');
  report('testtab01', quiz, false);
  report('testtab02', quiz, true);
  report('testtab01', '', false);
  ok(activity()?.lastAnswer === w.now(), 'fermer un ancien onglet ne retire pas le signal du dernier');
  ok(!Object.keys(w.run('backupData', owner).proprietes).some(key => key.startsWith('quiz-visible|')), 'l’activité n’est pas exportée');
  w.advance(76000);
  ok(!activity(), 'un signal expiré disparaît au bout de 75 secondes');

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    await install(ctx, w);
    const admin = await ctx.newPage();
    await admin.goto(page('admin.html'));
    await admin.fill('#admin-pseudo', owner.pseudo);
    await admin.fill('#password', PW);
    await admin.click('#unlock');
    const status = admin.locator('[data-student="leo"] .kid-activity');
    await status.filter({ hasText: 'Aucun quiz détecté' }).waitFor();
    const student = await ctx.newPage();
    await student.goto(page('Index.html'));
    await login(student, LEO);
    await startLesson(student, 'Calcul actif', { tf: true });
    const refresh = async () => {
      await admin.bringToFront();
      await admin.click('#tab-programmes');
    };
    await refresh();
    await status.filter({ hasText: 'Quiz ouvert : Calcul actif' }).waitFor();
    ok(true, 'l’administrateur voit le titre sur la fiche de son enfant à 360 px');

    await student.getByRole('button', { name: 'Quatre', exact: true }).click();
    await refresh();
    await status.filter({ hasText: 'réponse à' }).waitFor();
    ok(true, 'la dernière réponse apparaît avec son heure');

    await student.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await refresh();
    await status.filter({ hasText: 'Aucun quiz détecté' }).waitFor();
    ok(!activity(), 'masquer l’onglet arrête le signal de Quizy');
  } finally {
    await browser.close();
  }
  process.exit(summary() ? 1 : 0);
})().catch(error => { console.log('ECHEC:', error.message); process.exit(1); });
