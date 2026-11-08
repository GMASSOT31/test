// Suivi parent (admin) : niveaux par leçon, prête pour le contrôle, questions difficiles, historique, date du contrôle, archivage, remises à zéro
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, SRC, startLesson, answerCurrent } = require('./harness');
const DAY = 86400000;

(async () => {
  const w = makeWorld();
  for (const [c, p, n] of [['5B', 'Léo', '1234'], ['5B', 'Emma', '4321'], ['6A', 'Nina', '2468'], ['5e A', 'Zoé', '1357']]) w.run('saveStudent', PW, { classe: c, pseudo: p, pin: n });
  w.run('setBuiltinAssign', PW, 'zootopia', ['leo', 'emma']); w.run('setBuiltinAssign', PW, 'byzance-30', ['leo']); w.run('setBuiltinAssign', PW, 'musique-carnaval', ['emma', 'nina']);
  const zoo = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia'), byz = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'byzance-30');
  const zid = zoo.questions.map(q => w.ctx.qhash_(q.question)), bid = byz.questions.map(q => w.ctx.qhash_(q.question));
  const now = w.now();
  w.run('getStudentData', '5B', 'Léo', '1234');   // passage au parcours v3 (remise à zéro unique)
  // Léo / Zootopia : 4 ancrées, 2 rappelées, 1 découverte (ratée 3 fois dont 1 « sûre »), 3 nouvelles ; 2 séances
  const it = {};
  zid.forEach((id, i) => { it[id] = i < 4 ? [3, now + 5 * DAY, 0, 3, 0] : i < 6 ? [2, now - 1000, 0, 2, 0] : i === 6 ? [1, now - 1000, 3, 1, 1] : [0, 0, 0, 0, 0]; });
  w.props['srs_leo__zootopia'] = JSON.stringify({ v: 3, it, exam: '', plan: [], tf: true, cfg: 1, mode: 'actif', ses: [[now - 2 * DAY, 420, 10, 7, 0], [now - 3600e3, 300, 8, 6, 0]], maj: now - 3600e3 });
  w.props['srs_leo__byzance-30'] = JSON.stringify({ v: 3, it: { [bid[0]]: [1, now + DAY, 0, 1, 0] }, exam: '', plan: [], tf: true, cfg: 1, mode: 'actif', ses: [], maj: now - DAY });
  w.props['srs_emma__zootopia'] = JSON.stringify({ v: 3, it: { [zid[0]]: [1, now + DAY, 0, 1, 0] }, exam: '', plan: [], tf: false, cfg: 1, mode: 'actif', ses: [[now - 600e3, 200, 5, 5, 0]], maj: now - 600e3 });

  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1200, height: 1000 } }); await install(c, w);
  const errs = [];
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message)); a.on('dialog', d => d.accept());
  await a.goto('file://' + SRC + 'admin.html'); await a.fill('#password', PW); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])');
  await a.click('#tab-programmes');
  const card = id => a.locator(`.prog-card[data-student="${id}"]`);
  const lesson = (sid, qid) => card(sid).locator(`.lesson[data-quiz="${qid}"]`);

  // ---- 0. par défaut : une ligne par élève, son activité, et « Détails » ----
  ok((await a.locator('#pane-programmes h2').first().innerText()).includes('Suivi des révisions'), 'onglet « Suivi des révisions »');
  ok((await a.locator('.prog-card').count()) === 4 && (await a.locator('.prog-card .lesson').count()) === 0, 'PAR DÉFAUT : une ligne par élève, détails repliés');
  const sumLeo = (await card('leo').locator('.student-sum').innerText());
  ok(sumLeo.includes('2 séances cette semaine (12 min)') && sumLeo.includes('3 questions à réviser') && sumLeo.includes('dernière activité'), 'résumé de Léo : « ' + sumLeo + ' »');
  ok((await card('zoe').locator('.student-sum').innerText()).startsWith('0 séance cette semaine'), 'Zoé : aucune séance');
  for (const id of ['leo', 'emma', 'nina', 'zoe']) await card(id).locator('text=Détails').click();

  // ---- 1. une leçon : niveaux, prête pour le contrôle, à réviser, questions difficiles, historique ----
  const lz = lesson('leo', 'zootopia');
  ok((await lz.locator('.lvl-legend').innerText()).replace(/\s+/g, ' ').includes('🌱 Nouvelle 3 🌿 Découverte 1 🌳 Rappelée 2 ⭐ Ancrée 4 🏆 Maîtrisée 0'), 'niveaux de Zootopia : ' + (await lz.locator('.lvl-legend').innerText()).replace(/\s+/g, ' '));
  ok((await lz.locator('.lvl-bar .lvl').count()) === 4, 'barre des niveaux en couleurs (4 niveaux présents)');
  ok((await lz.locator('.pret').innerText()) === '🟡 Presque (60 %)' && (await lz.locator('.pret').getAttribute('class')).includes('mid'), 'prête pour le contrôle : « ' + await lz.locator('.pret').innerText() + ' » (au moins rappelées : 6 / 10)');
  ok((await lz.innerText()).includes('3 questions à réviser maintenant') && (await lz.innerText()).includes('Pas de contrôle prévu'), 'à réviser maintenant et contrôle');
  await lz.locator('.difficiles summary').click();
  const diff = await lz.locator('.difficiles li').allInnerTexts();
  ok(diff.length === 1 && diff[0].includes(zoo.questions[6].question) && diff[0].includes('3 erreurs (dont 1 en étant sûr·e)'), 'questions difficiles : ' + diff.join(' | '));
  await lz.locator('.historique summary').click();
  const hist = await lz.locator('.historique li').allInnerTexts();
  ok(hist.length === 2 && hist[0].includes('5 min · 6 / 8 réussies du premier coup') && hist[1].includes('7 min · 7 / 10'), 'historique (récent d\'abord) : ' + hist.join(' | '));
  ok((await card('leo').locator('.prog-detail .total').innerText()).includes('4 / 40 questions ancrées (10 %) sur 2 leçons'), 'total de Léo : ' + await card('leo').locator('.prog-detail .total').innerText());
  ok((await lesson('emma', 'musique-carnaval').innerText()).includes('Jamais commencée') && (await lesson('emma', 'musique-carnaval').locator('.pret').innerText()).includes('0 %'), 'leçon jamais commencée');
  ok((await card('zoe').innerText()).includes('Aucune leçon attribuée'), 'élève sans leçon : message');

  // ---- 2. le parent fixe la date du contrôle : plan recalculé, l'élève le voit ----
  const tomorrow = new Date(w.now() + DAY).toISOString().slice(0, 10);
  await lz.locator('.exam-input').fill(tomorrow);
  await lz.locator('text=Enregistrer la date').click(); await a.waitForSelector('#prog-status.ok');
  ok((await lesson('leo', 'zootopia').locator('.exam-txt').innerText()).includes('Contrôle demain (révision express)') && (await lesson('leo', 'zootopia').locator('.plan-txt').innerText()).includes('séances faites'), 'date fixée : « ' + await lesson('leo', 'zootopia').locator('.exam-txt').innerText() + ' » · ' + await lesson('leo', 'zootopia').locator('.plan-txt').innerText());
  ok(JSON.parse(w.props['srs_leo__zootopia']).exam === tomorrow && JSON.parse(w.props['srs_leo__zootopia']).plan.length >= 2, 'serveur : date et plan enregistrés');
  const sp = await c.newPage(); sp.on('pageerror', e => errs.push(e.message)); await sp.goto('file://' + SRC + 'Index.html'); await login(sp, LEO);
  ok((await sp.locator('.card.lecon', { hasText: 'Zootopia' }).locator('.exam-badge').innerText()) === '🔥 Contrôle demain', 'l\'élève voit « 🔥 Contrôle demain » sur la leçon');
  await lesson('leo', 'zootopia').locator('text=Pas de contrôle').click(); await a.waitForFunction(() => document.querySelector('#prog-status').textContent.includes('Plus de contrôle'));
  ok((await lesson('leo', 'zootopia').locator('.exam-txt').innerText()) === 'Pas de contrôle prévu', '« Pas de contrôle » : la date est retirée');

  // ---- 3. archiver / réactiver ----
  await lesson('leo', 'byzance-30').locator('text=Archiver').click(); await a.waitForFunction(() => document.querySelector('#prog-status').textContent.includes('archivée'));
  ok((await lesson('leo', 'byzance-30').locator('.exam-txt').innerText()) === '📦 Archivée' && JSON.parse(w.props['srs_leo__byzance-30']).mode === 'archive', 'leçon archivée');
  await lesson('leo', 'byzance-30').locator('text=Réactiver').click(); await a.waitForFunction(() => document.querySelector('#prog-status').textContent.includes('réactivée'));
  ok(JSON.parse(w.props['srs_leo__byzance-30']).mode === 'entretien', 'réactivée (rappels espacés)');

  // ---- 4. filtres ----
  const opts = await a.locator('#prog-filtre option').allInnerTexts();
  ok(opts[0] === 'Tous les élèves' && opts.includes('Toute la classe 5B') && opts.includes('👤 Léo'), 'filtre : ' + opts.join(' | '));
  await a.selectOption('#prog-filtre', 'c:5b'); ok((await a.locator('.prog-card').count()) === 2, 'filtre « Toute la classe 5B » : 2 fiches');
  await a.selectOption('#prog-filtre', 'all');
  await a.click('#tab-eleves'); await a.locator('#student-list .item', { hasText: 'Emma' }).locator('text=Progression').click();
  ok((await a.locator('#prog-filtre').inputValue()) === 's:emma' && (await a.locator('.prog-card').count()) === 1, '« Progression » (liste des élèves) ouvre le suivi d\'Emma');
  await a.selectOption('#prog-filtre', 'all');

  // ---- 5. ce que l'élève fait se voit dans le suivi ----
  await sp.reload(); await sp.waitForSelector('#app:not([hidden])');
  await startLesson(sp, 'Zootopia'); await answerCurrent(sp, true); await sp.evaluate(() => revisionFlush());
  await a.click('#unlock'); await a.waitForSelector('#lock-status.ok'); await a.click('#tab-programmes');
  ok((await lesson('leo', 'zootopia').innerText()).includes('Dernière activité'), 'la réponse de Léo apparaît dans le suivi');

  // ---- 6. remises à zéro ----
  await lesson('leo', 'zootopia').locator('text=Remettre cette leçon à zéro').click(); await a.waitForSelector('#prog-status.ok');
  ok((await lesson('leo', 'zootopia').locator('.lvl-legend').innerText()).includes('Nouvelle 10') && !w.props['srs_leo__zootopia'] && !!w.props['srs_leo__byzance-30'] && !!w.props['srs_emma__zootopia'], 'remise à zéro d\'UNE leçon de Léo : le reste est intact');
  await card('emma').locator('text=Tout remettre à zéro pour Emma').click(); await a.waitForSelector('#prog-status.ok');
  ok(!Object.keys(w.props).some(k => k.startsWith('srs_emma__')) && !!w.props['srs_leo__byzance-30'], 'tout remettre à zéro pour Emma : Léo intact');
  await a.click('#reset-all'); await a.waitForSelector('#prog-status.ok');
  ok(!Object.keys(w.props).some(k => k.startsWith('srs_')), 'remise à zéro générale : plus aucune révision');
  await a.fill('#password', 'mauvais');
  await lesson('leo', 'zootopia').locator('text=Remettre cette leçon à zéro').click(); await a.waitForSelector('#prog-status.err');
  ok((await a.locator('#prog-status').innerText()).includes('Mot de passe incorrect'), 'sans le bon mot de passe : refusé');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
