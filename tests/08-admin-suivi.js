// Suivi parent (admin) : niveaux par leçon, prête pour le contrôle, questions difficiles, historique, date du contrôle, archivage, remises à zéro
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, PW, ADM, SRC, startLesson, answerCurrent } = require('./harness');
const DAY = 86400000;

(async () => {
  const w = makeWorld();
  for (const [c, p, n] of [['5B', 'Léo', '1234'], ['5B', 'Emma', '4321'], ['6A', 'Nina', '2468'], ['5e A', 'Zoé', '1357']]) w.run('saveStudent', ADM, { classe: c, pseudo: p, pin: n });
  w.run('setBuiltinAssign', ADM, 'zootopia', ['leo', 'emma']); w.run('setBuiltinAssign', ADM, 'byzance-30', ['leo']); w.run('setBuiltinAssign', ADM, 'musique-carnaval', ['emma', 'nina']);
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
  await a.goto('file://' + SRC + 'admin.html'); await a.fill('#admin-pseudo', 'Papa'); await a.fill('#password', PW); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])');
  await a.click('#tab-programmes');
  const card = id => a.locator(`.prog-card[data-student="${id}"]`);
  const lesson = (sid, qid) => card(sid).locator(`.lesson[data-quiz="${qid}"]`);

  // ---- 0. EN UN COUP D'ŒIL : chaque élève, ses leçons et leur pourcentage ; le reste derrière « + » ----
  ok((await a.locator('#pane-programmes h2').first().innerText()).includes('Mes enfants'), 'accueil « 👨‍👧 Mes enfants » (suivi et comptes au même endroit)');
  const rows = async id => (await card(id).locator('.lesson-row .lr-main').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
  const rl = await rows('leo');
  ok(rl.length === 2 && rl.some(t => t.includes('Zootopia') && t.includes('57 %')) && rl.some(t => t.includes('Grand quiz') && t.includes('1 %')), 'Léo : ses 2 leçons et leur pourcentage, d\'un coup d\'œil : ' + rl.join(' | '));
  ok((await card('leo').locator('.st-pct').innerText()) === '15 %' && (await card('emma').locator('.st-pct').innerText()) === '1 %' && (await card('zoe').locator('.st-pct').count()) === 0, 'avancement global à côté du nom : Léo 15 %, Emma 1 % ; Zoé (aucune leçon) : rien');
  ok((await a.locator('.prog-card .lesson').count()) === 0 && (await a.locator('.prog-card .student-sum').count()) === 0 && (await a.locator('.prog-card .exam-input').count()) === 0, 'PAR DÉFAUT : ni détail, ni résumé, ni réglage : seulement les leçons et leur %');
  ok((await card('zoe').innerText()).includes('Aucune leçon pour l\'instant') && (await card('zoe').locator('.pick-btn').innerText()).includes('Choisir ses leçons') && (await card('zoe').locator('.pick-btn.secondary').count()) === 0, 'élève sans leçon : bouton « 📚 Choisir ses leçons » mis en avant');
  ok((await a.locator('#guide').innerText()) === '', 'des élèves sont au travail : plus de guide « Pour commencer »');
  // « + » de l'élève : son activité et ses actions
  await card('leo').locator('.prog-head .plus').click();
  const sumLeo = (await card('leo').locator('.student-sum').innerText());
  ok(sumLeo.includes('2 séances cette semaine (12 min)') && sumLeo.includes('3 questions à réviser') && sumLeo.includes('dernière activité'), '« + » de Léo : « ' + sumLeo + ' »');
  ok((await card('leo').locator('.prog-head .plus').innerText()) === '−' && (await card('leo').locator('text=Tout remettre à zéro pour Léo').count()) === 1, 'le « + » devient « − » ; la remise à zéro de l\'élève est là');
  // « + » d'une leçon : tout son détail
  const openLesson = async (sid, qid) => card(sid).locator(`.lesson-row[data-quiz="${qid}"] .plus`).click();
  await openLesson('leo', 'zootopia'); await openLesson('emma', 'musique-carnaval');
  // ---- 1. une leçon : niveaux, prête pour le contrôle, à réviser, questions difficiles, historique ----
  const lz = lesson('leo', 'zootopia');
  ok((await lz.locator('.lvl-legend').innerText()).replace(/\s+/g, ' ').includes('🌱 Nouvelle 3 🌿 Découverte 1 🌳 Rappelée 2 ⭐ Ancrée 4 🏆 Maîtrisée 0'), 'niveaux de Zootopia : ' + (await lz.locator('.lvl-legend').innerText()).replace(/\s+/g, ' '));
  ok((await lz.locator('.avancement').innerText()) === 'Avancement 57 %', 'Zootopia : avancement 57 % (4 ancrées, 2 rappelées, 1 découverte sur 10)');
  ok((await lz.locator('.lvl-bar .lvl').count()) === 4, 'barre des niveaux en couleurs (4 niveaux présents)');
  ok((await lz.locator('.pret').innerText()) === '🟡 Presque (60 %)' && (await lz.locator('.pret').getAttribute('class')).includes('mid'), 'prête pour le contrôle : « ' + await lz.locator('.pret').innerText() + ' » (au moins rappelées : 6 / 10)');
  ok((await lz.innerText()).includes('3 questions à réviser maintenant') && (await lz.innerText()).includes('Pas de contrôle prévu'), 'à réviser maintenant et contrôle');
  await lz.locator('.difficiles summary').click();
  const diff = await lz.locator('.difficiles li').allInnerTexts();
  ok(diff.length === 1 && diff[0].includes(zoo.questions[6].question) && diff[0].includes('3 erreurs (dont 1 en étant sûr·e)'), 'questions difficiles : ' + diff.join(' | '));
  await lz.locator('.historique summary').click();
  const hist = await lz.locator('.historique li').allInnerTexts();
  ok(hist.length === 2 && hist[0].includes('5 min · 6 / 8 réussies du premier coup') && hist[1].includes('7 min · 7 / 10'), 'historique (récent d\'abord) : ' + hist.join(' | '));
  ok((await card('leo').locator('.student-extra .total').innerText()).includes('Avancement 15 % sur 2 leçons · 4 / 40 questions ancrées'), 'total de Léo : ' + await card('leo').locator('.student-extra .total').innerText());
  ok((await lesson('emma', 'musique-carnaval').innerText()).includes('Jamais commencée') && (await lesson('emma', 'musique-carnaval').locator('.pret').innerText()).includes('0 %'), 'leçon jamais commencée');

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
  await openLesson('leo', 'byzance-30');
  await lesson('leo', 'byzance-30').locator('text=Archiver').click(); await a.waitForFunction(() => document.querySelector('#prog-status').textContent.includes('archivée'));
  const toggle = card('leo').locator('.archived-toggle');
  ok(JSON.parse(w.props['srs_leo__byzance-30']).mode === 'archive' && (await card('leo').locator('.lesson-row[data-quiz="byzance-30"]').count()) === 0 && (await toggle.innerText()).includes('📦 1 leçon archivée') && (await toggle.getAttribute('aria-expanded')) === 'false',
    'leçon archivée : elle disparaît de la liste, rangée sous « ' + await toggle.innerText() + ' »');
  ok((await card('leo').locator('.st-pct').innerText()) === '57 %' && (await card('emma').locator('.archived-toggle').count()) === 0, 'l\'avancement de Léo ne compte plus la leçon archivée (57 % = Zootopia seule) ; Emma n\'a rien d\'archivé : pas de bouton');
  await toggle.click();
  ok((await card('leo').locator('.lesson-row.archived[data-quiz="byzance-30"]').count()) === 1 && (await lesson('leo', 'byzance-30').locator('.exam-txt').innerText()) === '📦 Archivée' && (await toggle.innerText()).includes('masquer'), 'on la déploie : elle réapparaît (grisée) avec son détail');
  await lesson('leo', 'byzance-30').locator('text=Réactiver').click(); await a.waitForFunction(() => document.querySelector('#prog-status').textContent.includes('réactivée'));
  ok(JSON.parse(w.props['srs_leo__byzance-30']).mode === 'entretien', 'réactivée (rappels espacés)');

  // ---- 4. plus de filtre ni de regroupement : une fiche par enfant ----
  ok((await a.locator('#prog-filtre').count()) === 0 && (await a.locator('#tab-eleves').count()) === 0 && (await a.locator('.prog-card').count()) === 4, 'ni filtre, ni onglet « Élèves » séparé : les 4 fiches directement');

  // ---- 5. ce que l'élève fait se voit dans le suivi ----
  await sp.reload(); await sp.waitForSelector('#app:not([hidden])');
  await startLesson(sp, 'Zootopia'); await answerCurrent(sp, true); await sp.evaluate(() => revisionFlush());
  await a.click('#unlock'); await a.waitForSelector('#lock-status.ok'); await a.click('#tab-programmes');
  ok((await lesson('leo', 'zootopia').innerText()).includes('Dernière activité'), 'la réponse de Léo apparaît dans le suivi');

  // ---- 6. remises à zéro ----
  await lesson('leo', 'zootopia').locator('text=Remettre cette leçon à zéro').click(); await a.waitForSelector('#prog-status.ok');
  ok((await lesson('leo', 'zootopia').locator('.lvl-legend').innerText()).includes('Nouvelle 10') && !w.props['srs_leo__zootopia'] && !!w.props['srs_leo__byzance-30'] && !!w.props['srs_emma__zootopia'], 'remise à zéro d\'UNE leçon de Léo : le reste est intact');
  await card('emma').locator('.prog-head .plus').click();
  await card('emma').locator('text=Tout remettre à zéro pour Emma').click(); await a.waitForSelector('#prog-status.ok');
  ok(!Object.keys(w.props).some(k => k.startsWith('srs_emma__')) && !!w.props['srs_leo__byzance-30'], 'tout remettre à zéro pour Emma : Léo intact');
  ok((await a.locator('#reset-all').count()) === 0, 'plus de « remise à zéro générale » (rarement utile) : on remet à zéro un enfant ou une leçon');
  await a.evaluate(() => { document.getElementById('password').value = 'mauvais'; });
  await lesson('leo', 'zootopia').locator('text=Remettre cette leçon à zéro').click(); await a.waitForSelector('#prog-status.err');
  ok((await a.locator('#prog-status').innerText()).includes('Pseudo ou mot de passe incorrect'), 'sans le bon mot de passe : refusé');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
