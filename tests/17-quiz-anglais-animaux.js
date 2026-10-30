// Quiz intégré « Anglais : les animaux » : 20 questions à réponse écrite, corrigé officiel accepté
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC } = require('./harness');
const KEY = ['A porcupine', 'A sloth', 'A ferret', 'A reindeer', 'A racoon', 'A cheetah', 'A camel', 'A polar bear', 'A yak', 'An antelope',
  'Wolves', 'Foxes', 'Sheep', 'Squirrels', 'Buffalo', 'A sloth', 'A giraffe', 'A cheetah', 'A camel', 'A pig'];
(async () => {
  const w = makeWorld({ ADMIN_PASSWORD: PW });
  w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  const adm = w.run('adminData', PW);
  const q = adm.builtins.find(x => x.id === 'anglais-animaux');
  ok(q && q.questions === 20 && q.matiere === 'Anglais', 'le quiz est dans la liste des quiz intégrés (20 questions)');
  ok(w.run('getStudentData', '5B', 'Léo', '1234').quizzes.every(x => x.id !== 'anglais-animaux'), 'non attribué : l\'élève ne le voit pas');
  w.run('setBuiltinAssign', PW, 'anglais-animaux', ['leo']);
  const d = w.run('getStudentData', '5B', 'Léo', '1234');
  const quiz = d.quizzes.find(x => x.id === 'anglais-animaux');
  ok(quiz && quiz.questions.length === 20 && quiz.questions.every(x => x.reponses && x.reponses.length), 'attribué : l\'élève reçoit les 20 questions à réponse écrite');

  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1000, height: 900 } }); await install(c, w);
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  await p.locator('.card.lecon', { hasText: 'Anglais : les animaux' }).click();
  for (let i = 0; i < 20; i++) {
    await p.fill('.saisie', KEY[i]); await p.keyboard.press('Enter');
    await p.locator('.panel .btn', { hasText: /suivante|résultat/ }).click();
  }
  ok((await p.locator('.final').innerText()) === '20 / 20', 'corrigé officiel saisi tel quel (majuscules, « A », « Wolves »…) : ' + await p.locator('.final').innerText());
  await p.evaluate(() => revisionFlush());
  const prog = w.run('adminData', PW).progress.leo.find(x => x.id === 'anglais-animaux');
  ok(prog && prog.fois === 1, 'compteur « fait 1 fois » côté admin');
  // sans article, ou mauvaise réponse
  await p.click('text=Retour aux leçons'); await p.locator('.card.lecon', { hasText: 'Anglais : les animaux' }).click();
  await p.fill('.saisie', 'porcupine'); await p.keyboard.press('Enter');
  ok(await p.locator('.question').isVisible() && !(await p.locator('.feedback.bad, .feedback.err').count()), 'sans l\'article (« porcupine ») : accepté');
  await p.locator('.panel .btn', { hasText: /suivante|résultat/ }).click();
  await p.fill('.saisie', 'sloths'); await p.keyboard.press('Enter');
  ok((await p.locator('.panel').innerText()).includes('essaie encore'), 'mauvaise réponse (« sloths ») : « essaie encore »');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
