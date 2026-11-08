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
  const prev = i => p.evaluate(i => revisionPreview('anglais-animaux', i, 'rappel'), i);
  const res = () => p.evaluate(() => window.revisionPreviewResult);
  const refused = [];
  for (let i = 0; i < 20; i++) { await prev(i); await p.fill('.saisie', KEY[i]); await p.keyboard.press('Enter'); if (!(await res())) refused.push(i + 1); }
  ok(refused.length === 0, 'corrigé officiel saisi tel quel (majuscules, « A », « Wolves »…) : 20 / 20 acceptées ' + JSON.stringify(refused));
  await prev(0); await p.fill('.saisie', 'porcupine'); await p.keyboard.press('Enter');
  ok(await res(), 'sans l\'article (« porcupine ») : accepté');
  await prev(1); await p.fill('.saisie', 'sloths'); await p.keyboard.press('Enter');
  ok(!(await res()) && (await p.locator('.feedback.ko').innerText()).includes('a sloth'), 'mauvaise réponse (« sloths ») : refusée, la bonne réponse s\'affiche');
  // en QCM (première découverte), les choix sont fabriqués avec les autres réponses de la leçon
  await p.evaluate(() => revisionPreview('anglais-animaux', 0, 'qcm'));
  const opts = await p.locator('.option').allInnerTexts();
  ok(opts.length === 4 && opts.includes('a porcupine') && new Set(opts).size === 4, 'QCM de découverte : 4 choix dont « a porcupine » : ' + opts.join(' | '));
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
