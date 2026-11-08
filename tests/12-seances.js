// Parcours v3 côté élève : première ouverture (date du contrôle), séance découvrir -> tester -> corriger, bilan, écran de leçon,
// révision du jour (mélange des leçons), révision express, séance bonus, après le contrôle, archivage
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC, answerCurrent, finishSession } = require('./harness');
const DAY = 86400000, HOUR = 3600000;
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
w.run('setBuiltinAssign', PW, 'zootopia', ['leo']); w.run('setBuiltinAssign', PW, 'byzance', ['leo']);
const L = ['5B', 'Léo', '1234'];
const srs = q => w.run('getStudentData', ...L).srs[q];
// le harnais tourne en UTC : on se place à 10 h pour que « 1 h plus tard » reste le même jour
w.advance(Math.floor(w.now() / DAY) * DAY + DAY + 10 * HOUR - w.now());

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1000, height: 1000 }, timezoneId: 'UTC' }); await install(c, w);
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + SRC + 'Index.html'); await login(p, LEO);
  const card = t => p.locator('.card.lecon', { hasText: t });
  const reload = async () => { await p.evaluate(() => revisionFlush()); await p.reload(); await p.waitForSelector('#app:not([hidden])'); };
  const chip = () => p.locator('.stage-chip').innerText();
  const txt = async sel => (await p.locator(sel).innerText()).replace(/\s+/g, ' ').trim();

  // ---- A. accueil et première ouverture ----
  ok((await txt('.daily')).includes('Rien à réviser'), 'ACCUEIL : rien à réviser au départ');
  ok((await card('Zootopia').locator('.etape').innerText()) === 'Nouvelle leçon · 10 questions' && (await card('Zootopia').locator('.action-pill').innerText()) === 'Commencer', 'leçon neuve : « Nouvelle leçon » / « Commencer »');
  await card('Zootopia').click();
  ok((await p.locator('.setup h3').allInnerTexts()).join(' | ') === '📅 Quand est ton contrôle sur cette leçon ? | 📚 As-tu déjà travaillé cette leçon en classe ?', 'PREMIÈRE OUVERTURE : date du contrôle puis « déjà travaillée ? »');
  ok((await p.locator('.setup .choice:not(.wide):not(.date-choice)').allInnerTexts()).join('|') === 'Demain|Après-demain|Dans une semaine|Pas de contrôle prévu' && await p.locator('.setup input[type=date]').count() === 1, 'choix : Demain, Après-demain, Dans une semaine, Pas de contrôle, ou une autre date');
  ok(await p.locator('.setup .actions .btn').isDisabled(), '« C\'est parti » inactif tant que les deux réponses ne sont pas données');
  await p.locator('.choice', { hasText: 'Demain' }).first().click();
  ok((await p.locator('.plan-hint').innerText()).includes('Révision express'), 'Demain : « ' + await p.locator('.plan-hint').innerText() + ' »');
  await p.locator('.choice', { hasText: 'Pas de contrôle prévu' }).click();
  ok((await p.locator('.plan-hint').innerText()).includes('1 jour, 3 jours, 7 jours'), 'Pas de contrôle : espacement expliqué');
  await p.locator('.choice.wide', { hasText: 'Non' }).click();
  await p.click('.setup .actions .btn');
  await p.waitForSelector('.session-head');

  // ---- B. séance « découvrir » : cartes puis test, erreur corrigée dans la séance ----
  ok((await chip()) === '📖 Je découvre' && (await p.locator('.session-count').innerText()) === '0 / 10', 'la séance commence par les cartes (« Je découvre »), 10 questions à tester');
  ok((await p.locator('.flashcard.learn .face-answer').innerText()) === 'sahara square', 'la carte montre la question ET la réponse');
  for (let i = 0; i < 5; i++) await answerCurrent(p);
  ok((await chip()) === '✅ Je teste' && (await p.locator('.option').count()) === 4, 'après 5 cartes : test (QCM de 4 choix fabriqués avec les autres réponses)');
  await answerCurrent(p, false, { next: false });
  ok((await p.locator('.mastery-line').innerText()).includes('elle revient dans un instant') && await p.locator('.next-btn').isVisible() && (await p.locator('.option.correct').count()) === 1, 'erreur : la bonne réponse s\'affiche, la question reviendra');
  await p.click('.next-btn');
  let seen = [];
  for (let k = 0; k < 6; k++) { seen.push(await chip()); await answerCurrent(p, true); }
  ok(seen.includes('🔁 Je corrige'), 'la question ratée revient dans la séance (« Je corrige ») : ' + seen.join(', '));
  const n = await finishSession(p);
  ok((await txt('.result h2')) === 'Séance terminée !' && (await txt('.result .final')) === '9 / 10', 'BILAN : 9 / 10 réussies du premier coup');
  ok((await txt('.result .etape-msg')).includes('10 questions ont progressé') && (await txt('.result .etape-msg')).includes('Prochaine séance : demain'), 'bilan : « ' + await txt('.result .etape-msg') + ' »');
  const z = srs('zootopia');
  ok(Object.values(z.it).length === 10 && Object.values(z.it).every(i => i[0] === 1) && z.ses.length === 1 && z.ses[0][2] === 10 && z.ses[0][3] === 9, 'serveur : 10 questions découvertes, séance enregistrée (10 questions, 9 du premier coup)');

  // ---- C. écran de la leçon ----
  await p.click('text=Voir la leçon');
  ok((await txt('.exam-line')).startsWith('📅 Pas de contrôle prévu') && (await txt('.plan')).includes('Comment ça marche ?'), 'écran de leçon : pas de contrôle, explication du principe');
  ok((await txt('.lesson-levels .lvl-legend')).includes('🌿 Découverte 10') && (await txt('.lesson-screen .etape-msg')).includes('Prochaine séance : demain'), 'niveaux (10 découvertes) et prochaine séance');
  ok((await p.locator('.lesson-screen .big-btn').innerText()) === '▶ Séance bonus', 'rien à réviser : « Séance bonus »');

  // ---- F. séance bonus : n'avance pas le plan ----
  await p.click('.lesson-screen .big-btn');
  ok((await chip()) === '✅ Séance bonus', 'séance bonus');
  await finishSession(p);
  ok((await txt('.result .etape-msg')).includes('le plan reste le même') && Object.values(srs('zootopia').it).every(i => i[0] === 1), 'bonus : réussites sans effet sur le plan (toujours niveau 1)');
  await p.click('text=Retour aux leçons');

  // ---- E. révision express (contrôle demain) sur Byzance ----
  await card('Byzance').click();
  await p.locator('.choice', { hasText: 'Demain' }).first().click(); await p.locator('.choice.wide', { hasText: 'Oui' }).click(); await p.click('.setup .actions .btn');
  await p.waitForSelector('.session-head');
  ok((await chip()) === '✅ Je teste' && (await p.locator('.flashcard.learn').count()) === 0, 'déjà travaillée : on commence directement par tester (pas de cartes)');
  await finishSession(p);
  await p.click('text=Voir la leçon');
  ok((await txt('.exam-line')).includes('🔥 Contrôle demain · révision express'), 'contrôle demain : « révision express »');
  const dots = await p.locator('.plan-dots li').allInnerTexts();
  ok(dots.length === 3 && dots[0].startsWith('✓') && dots[1].includes('1 h plus tard') && dots[2].includes('Le matin du contrôle'), 'plan : ✓ séance 1, 1 h plus tard, le matin du contrôle : ' + dots.map(d => d.replace(/\s+/g, ' ')).join(' | '));
  await p.click('.back');
  ok((await card('Byzance').locator('.exam-badge').innerText()) === '🔥 Contrôle demain' && (await p.locator('.card.lecon').first().innerText()).includes('Byzance'), 'accueil : badge « 🔥 Contrôle demain », la leçon passe en premier');

  // 1 h plus tard : la séance 2 est due
  w.advance(HOUR + 60000); await reload();
  ok((await card('Byzance').locator('.etape').innerText()) === 'À réviser : 10 questions' && (await txt('.daily')).includes('Ta révision du jour'), '1 h plus tard : « À réviser : 10 questions » et révision du jour');
  await card('Byzance').click(); await p.click('.lesson-screen .big-btn');
  ok(await p.locator('.masked-btns').isVisible(), 'séance 2 : rappel sans choix (QCM masqué : réfléchir d\'abord)');
  await finishSession(p);
  ok(Object.values(srs('byzance').it).every(i => i[0] === 2), 'serveur : les 10 questions passent au niveau 2 (rappelées)');

  // ---- D. le lendemain : révision du jour, les deux leçons mélangées ----
  w.advance(DAY); await reload();
  ok((await txt('.daily')).includes('20 questions de 2 leçons'), 'révision du jour : « ' + await txt('.daily') + ' »');
  await p.click('.daily-btn');
  const lessons = new Set();
  for (let k = 0; k < 6; k++) { lessons.add(await p.locator('.panel.session .meta').innerText()); await answerCurrent(p, true); }
  ok(lessons.size === 2, 'les questions des deux leçons sont mélangées (le nom de la leçon est indiqué) : ' + [...lessons].join(' / '));
  await finishSession(p);
  ok((await txt('.result .etape-msg')).includes('Révision du jour terminée'), 'fin : « Révision du jour terminée »');
  ok(srs('zootopia').ses.length === 3 && srs('byzance').ses.length === 3, 'la séance mélangée est enregistrée dans chaque leçon');

  // ---- G. après le contrôle : garder en mémoire ou archiver ----
  await p.click('text=Retour aux leçons');
  ok((await card('Byzance').locator('.exam-badge').innerText()) === '🔥 Contrôle aujourd\'hui', 'le jour du contrôle : « 🔥 Contrôle aujourd\'hui »');
  w.advance(DAY); await reload();
  ok((await card('Byzance').locator('.etape').innerText()) === 'Contrôle passé : garder cette leçon en mémoire ?' && (await p.locator('.card.lecon').first().innerText()).includes('Byzance'), 'le jour d\'après le contrôle : « garder en mémoire ? » (en premier)');
  await card('Byzance').click();
  await p.click('text=Non, l\'archiver');
  await p.waitForSelector('.archived');
  ok(srs('byzance').mode === 'archive' && (await p.locator('.archived summary').innerText()) === 'Leçons archivées (1)' && (await txt('.daily')).includes('Rien à réviser'), 'archivée : rangée à part, hors de la révision du jour');
  await p.click('.archived summary'); await p.locator('.archived .card.lecon').click();
  await p.click('text=Réactiver la leçon');
  await p.waitForSelector('.lesson-screen');
  ok(srs('byzance').mode === 'entretien' && (await txt('.exam-line')).startsWith('🧠 En mémoire'), 'réactivée : gardée en mémoire (rappels espacés)');

  // ---- I. modifier la date du contrôle ----
  await p.click('.exam-line .linkish');
  ok((await p.locator('.setup .choice.wide.on').count()) === 1, 'Modifier : le formulaire reprend le choix « déjà travaillée »');
  await p.locator('.choice', { hasText: 'Dans une semaine' }).click(); await p.click('.setup .actions .btn');
  await p.waitForSelector('.lesson-screen');
  ok((await p.locator('.plan-dots li').count()) === 4 && srs('byzance').plan.length === 4, 'contrôle dans une semaine : plan de 4 séances');

  // ---- H. arrêter une séance en cours ----
  await p.click('.back'); await card('Zootopia').click(); await p.click('.lesson-screen .big-btn');
  await answerCurrent(p, true); await p.click('text=Arrêter');
  ok((await txt('.result h2')) === 'Séance arrêtée' && (await txt('.result .final')) === '1 / 1', 'arrêter : bilan partiel (1 / 1)');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
