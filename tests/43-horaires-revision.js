// cible: cloudflare
const { chromium } = require('playwright');
const { makeWorldCf, install, login, LEO, PW, page, finishSession, ok, summary } = require('./harness');

(async () => {
  const t = s => Date.parse(s);
  const start = t('2026-11-22T20:20:00Z'); // 21 h 20 à Paris
  const morning = t('2026-11-23T06:00:00Z');
  const w = makeWorldCf({ ADMIN_PASSWORD: PW }, { timeZone: 'Europe/Paris', now: start });
  const owner = { pseudo: 'Papa', password: PW };
  w.run('adminData', owner);
  w.run('saveStudent', owner, LEO);
  const { id } = w.run('saveQuiz', owner, { titre: 'Contrôle demain', pour: ['leo'],
    questions: [{ question: 'Deux et deux ?', options: ['Trois', 'Quatre'], correct: 1 }] });
  const creds = [LEO.classe, LEO.pseudo, LEO.pin];
  const key = 'srs_leo__' + id;
  const question = w.run('getStudentData', ...creds).quizzes[0].questions[0].id;
  const latePlan = w.run('setLessonPlan', ...creds, id, '2026-11-23', true);
  ok(latePlan.plan.join() === [start, morning].join(), 'à 21 h 20 le rappel de 22 h 20 est sauté');
  ok(w.ctx.makePlan_(t('2026-11-22T20:00:00Z'), '2026-11-23').length === 2 &&
    w.ctx.makePlan_(t('2026-11-22T19:59:00Z'), '2026-11-23').length === 3, 'un rappel à 22 h est exclu, un rappel à 21 h 59 est accepté');
  // Enregistrement d’une ancienne révision avec rappel à 22 h 20 et créneau de minuit.
  const old = JSON.parse(w.props[key]);
  old.plan = [start, t('2026-11-22T21:20:00Z'), t('2026-11-22T23:00:00Z')];
  old.it[question] = [1, t('2026-11-22T23:00:00Z'), 0, 1, 0];
  w.props[key] = JSON.stringify(old);
  const srs = () => w.run('getStudentData', ...creds).srs[id];
  ok(srs().plan.join() === [start, morning].join() && srs().it[question][1] === morning,
    'un ancien plan est normalisé et les deux rappels nocturnes sont regroupés à 7 h');
  w.props[key] = JSON.stringify({ ...old, it: {} });

  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 360, height: 720 }, timezoneId: 'Europe/Paris' });
    await install(ctx, w);
    const p = await ctx.newPage();
    await p.goto(page('Index.html'));
    await login(p, LEO);
    await p.locator('.card.lecon').click();
    await p.locator('.lesson-screen .big-btn').click();
    await finishSession(p);
    ok(await p.getByText(/Révision facultative le matin du contrôle/).isVisible() &&
      srs().it[question][1] === morning, 'après la séance, l’enfant voit le rappel facultatif à 7 h');
    const reload = async time => {
      w.advance(time - w.now());
      await p.reload();
      await p.locator('.card.lecon').waitFor();
    };
    for (const time of [t('2026-11-22T21:00:00Z'), t('2026-11-22T23:00:00Z')]) {
      await reload(time);
      await p.locator('.card.lecon').click();
      const startButton = p.getByRole('button', { name: 'Séance bonus', exact: false });
      await startButton.click();
      ok(await p.locator('.session-head').isVisible() && srs().it[question][1] === morning,
        'séance volontaire possible à ' + new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit' }).format(time) +
        ', sans avancer le rappel de 7 h');
      await p.locator('.session-head .back').click();
    }
    await reload(morning);
    ok(await p.getByText('Ta révision du jour').isVisible(), 'à 7 h, la révision du matin redevient disponible');
  } finally {
    await b.close();
  }
  process.exit(summary() ? 1 : 0);
})().catch(error => { console.log('ECHEC:', error.message); process.exit(1); });
