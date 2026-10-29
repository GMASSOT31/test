const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, login, LEO, EMMA, PW, SRC } = require('./harness');

(async () => {
  const w = makeWorld();
  for (const [c, p, n] of [['5B', 'Léo', '1234'], ['5B', 'Emma', '4321'], ['6A', 'Nina', '2468'], ['5e A', 'Zoé', '1357']]) w.run('saveStudent', PW, { classe: c, pseudo: p, pin: n });
  w.run('setBuiltinAssign', PW, 'zootopia', ['leo', 'emma']); w.run('setBuiltinAssign', PW, 'byzance-30', ['leo']); w.run('setBuiltinAssign', PW, 'musique-carnaval', ['emma', 'nina']);
  const zoo = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia'), byz = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'byzance-30');
  const play = (cred, quiz, i, success, times = 1) => { for (let k = 0; k < times; k++) w.run('saveResult', ...cred, quiz.id, w.ctx.qhash_(quiz.questions[i].question), success); };
  const L = ['5B', 'Léo', '1234'], E = ['5B', 'Emma', '4321'];
  for (let i = 0; i < 4; i++) play(L, zoo, i, true, 3);          // Léo : 4 questions sues sur Zootopia
  play(L, zoo, 5, true); play(L, zoo, 6, false);                  // 1 en cours, 1 erreur
  play(L, byz, 0, true, 3);                                       // Léo : 1 sue sur le grand quiz
  play(E, zoo, 0, true, 2);                                       // Emma : 1 en cours sur Zootopia

  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1200, height: 1000 } }); await install(c, w);
  const errs = [];
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message)); a.on('dialog', d => d.accept());
  await a.goto('file://' + SRC + 'admin.html'); await a.fill('#password', PW); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])');
  await a.click('#tab-programmes');
  const card = id => a.locator(`.prog-card[data-student="${id}"]`);
  const lesson = (sid, qid) => card(sid).locator(`.lesson[data-quiz="${qid}"]`);

  // ---- 0. par défaut : seulement les noms et un bouton « Détails » ----
  ok((await a.locator('.prog-card').count()) === 4 && (await a.locator('.prog-card .lesson').count()) === 0 && (await a.locator('.prog-card .bar').count()) === 0, 'PAR DÉFAUT : une ligne par élève (4), aucune leçon ni barre affichée');
  const txt = (await a.locator('.prog-card').allInnerTexts()).map(x => x.replace(/\s+/g, ' ').trim()).sort();
  ok(JSON.stringify(txt) === JSON.stringify(['👤 Emma Détails', '👤 Léo Détails', '👤 Nina Détails', '👤 Zoé Détails']), 'chaque ligne = le nom + « Détails » seulement : ' + txt.join(' | '));
  await card('leo').locator('text=Détails').click();
  ok((await card('leo').locator('.lesson').count()) === 2 && (await card('emma').locator('.lesson').count()) === 0 && (await card('leo').locator('button', { hasText: 'Masquer' }).count()) === 1, 'clic sur « Détails » : seules les 2 leçons de Léo se déplient (le bouton devient « Masquer »)');
  await card('leo').locator('text=Masquer').click();
  ok((await card('leo').locator('.lesson').count()) === 0 && (await card('leo').locator('button', { hasText: 'Détails' }).count()) === 1, '« Masquer » replie le détail');
  for (const id of ['leo', 'emma', 'nina', 'zoe']) await card(id).locator('text=Détails').click();

  // ---- 1. la progression de chaque élève, leçon par leçon ----
  const heads = await a.locator('#prog-list details.classe > summary').allInnerTexts();
  ok(JSON.stringify(heads) === JSON.stringify(['Classe 5B · 2 élèves', 'Classe 5e A · 1 élève', 'Classe 6A · 1 élève']), 'élèves rangés par classe : ' + heads.join(' | '));
  ok((await a.locator('.prog-card').count()) === 4, 'une fiche par élève (4)');
  const lz = await lesson('leo', 'zootopia').innerText();
  ok(lz.includes('4 sues') && lz.includes('1 en cours') && lz.includes('5 à apprendre') && lz.includes('1 erreur') && lz.includes('En cours') && lz.includes('Dernière activité'), 'LÉO / Zootopia : ' + lz.replace(/\s+/g, ' ').slice(0, 130));
  ok((await lesson('leo', 'zootopia').locator('.bar').getAttribute('aria-valuenow')) === '40', 'barre de progression Zootopia de Léo : 40 %');
  const lb = await lesson('leo', 'byzance-30').innerText();
  ok(lb.includes('1 sue') && lb.includes('29 à apprendre') && lb.includes('0 erreur'), 'LÉO / Grand quiz : ' + lb.replace(/\s+/g, ' ').slice(0, 110));
  const le = await lesson('emma', 'zootopia').innerText();
  ok(le.includes('0 sue') && le.includes('1 en cours'), 'EMMA / Zootopia : ' + le.replace(/\s+/g, ' ').slice(0, 90));
  ok((await lesson('emma', 'musique-carnaval').innerText()).includes('Jamais jouée') && (await lesson('emma', 'musique-carnaval').innerText()).includes('Pas commencée'), 'leçon jamais jouée : « Pas commencée · Jamais jouée »');
  ok((await card('zoe').innerText()).includes('Aucune leçon attribuée') && (await card('zoe').locator('button').count()) === 1, 'élève sans leçon : message dans le détail, aucun bouton de remise à zéro (seul « Masquer »)');
  ok((await card('leo').locator('.prog-detail .total').innerText()).includes('5 / 40 questions sues (13 %) sur 2 leçons'), 'total de Léo (dans le détail) : ' + (await card('leo').locator('.prog-detail .total').innerText()));
  ok((await a.locator('.prog-card[data-student="leo"] .lesson').count()) === 2 && (await a.locator('.prog-card[data-student="emma"] .lesson').count()) === 2 && (await a.locator('.prog-card[data-student="nina"] .lesson').count()) === 1, 'chaque élève n\'a que ses propres leçons (Léo 2, Emma 2, Nina 1)');

  // ---- 2. filtres ----
  const opts = await a.locator('#prog-filtre option').allInnerTexts();
  ok(opts[0] === 'Tous les élèves' && opts.includes('Toute la classe 5B') && opts.includes('👤 Léo'), 'filtre : ' + opts.join(' | '));
  await a.selectOption('#prog-filtre', 'c:5b');
  ok((await a.locator('.prog-card').count()) === 2 && (await a.locator('#prog-list details.classe').count()) === 1, 'filtre « Toute la classe 5B » : 2 fiches (Emma et Léo)');
  await a.selectOption('#prog-filtre', 's:nina');
  ok((await a.locator('.prog-card').count()) === 1 && (await card('nina').count()) === 1, 'filtre « Nina » : 1 fiche');
  await a.selectOption('#prog-filtre', 'all');
  ok((await card('leo').locator('.lesson').count()) === 2, 'les détails restent dépliés quand on change de filtre');
  // depuis la liste des élèves : « Progression » filtre directement
  await a.click('#tab-eleves'); await a.locator('#student-list .item', { hasText: 'Emma' }).locator('text=Progression').click();
  ok((await a.locator('.pane:visible').getAttribute('id')) === 'pane-programmes' && (await a.locator('#prog-filtre').inputValue()) === 's:emma' && (await a.locator('.prog-card').count()) === 1, '« Progression » (liste des élèves) : ouvre l\'onglet filtré sur Emma');
  await a.selectOption('#prog-filtre', 'all');

  // ---- 3. remise à zéro d'UNE leçon pour UN élève ----
  await lesson('leo', 'zootopia').locator('text=Remettre cette leçon à zéro').click();
  await a.waitForSelector('#prog-status.ok');
  ok((await a.locator('#prog-status').innerText()).includes('Zootopia') && (await a.locator('#prog-status').innerText()).includes('Léo'), 'confirmation : « ' + await a.locator('#prog-status').innerText() + ' »');
  const lz2 = await lesson('leo', 'zootopia').innerText();
  ok(lz2.includes('0 sue') && lz2.includes('Jamais jouée') && lz2.includes('Pas commencée'), 'Zootopia de Léo remis à zéro : ' + lz2.replace(/\s+/g, ' ').slice(0, 80));
  ok((await lesson('leo', 'byzance-30').innerText()).includes('1 sue'), 'MAIS son grand quiz est conservé (1 sue)');
  ok((await lesson('emma', 'zootopia').innerText()).includes('1 en cours'), 'ET Zootopia d\'Emma n\'est pas touché (1 en cours)');
  ok(!Object.keys(w.props).includes('prog_leo__zootopia') && Object.keys(w.props).includes('prog_leo__byzance-30') && Object.keys(w.props).includes('prog_emma__zootopia'), 'côté serveur : seul l\'enregistrement Léo / Zootopia a disparu');
  // rien à remettre à zéro : message honnête
  await lesson('leo', 'zootopia').locator('text=Remettre cette leçon à zéro').click(); await a.waitForFunction(() => document.querySelector('#prog-status').textContent.includes('Rien à remettre'));
  ok(true, 'leçon déjà vide : « ' + await a.locator('#prog-status').innerText() + ' »');

  // ---- 4. l'élève retrouve sa leçon vide, ses autres leçons intactes (chez lui) ----
  const sp = await c.newPage(); sp.on('pageerror', e => errs.push(e.message)); await sp.goto('file://' + SRC + 'Index.html'); await login(sp, LEO);
  ok(await sp.evaluate(() => { const z = QUIZZES.find(q => q.id === 'zootopia'), g = QUIZZES.find(q => q.id === 'byzance-30'); return progressOf(z, z.questions[0]).ok === 0 && progressOf(g, g.questions[0]).ok === 3; }) && (await sp.locator('#count-programme').innerText()) === '39', 'CHEZ LÉO : Zootopia vide, grand quiz conservé (39 cartes à apprendre)');

  // ---- 5. ce que l'élève joue se voit dans l'admin ----
  await sp.click('#tab-quiz'); await sp.locator('.card', { hasText: 'Zootopia' }).click();
  await sp.fill('.saisie', 'sahara square'); await sp.keyboard.press('Enter'); await sp.evaluate(() => revisionFlush());
  await a.click('#unlock'); await a.waitForSelector('#lock-status.ok'); await a.click('#tab-programmes');
  const lz3 = await lesson('leo', 'zootopia').innerText();
  ok(lz3.includes('0 sue') && lz3.includes('1 en cours') && lz3.includes('Dernière activité'), 'LÉO vient de répondre juste : l\'admin voit « 1 en cours » et la date : ' + lz3.replace(/\s+/g, ' ').slice(0, 100));

  // ---- 6. remise à zéro de toutes les leçons d'UN élève ----
  await card('emma').locator('text=Tout remettre à zéro pour Emma').click(); await a.waitForSelector('#prog-status.ok');
  ok((await lesson('emma', 'zootopia').innerText()).includes('Jamais jouée') && (await lesson('leo', 'zootopia').innerText()).includes('1 en cours') && (await lesson('leo', 'byzance-30').innerText()).includes('1 sue'), 'Emma remise à zéro partout ; Léo intact');

  // ---- 7. remise à zéro générale (zone dangereuse) ----
  await a.click('#reset-all'); await a.waitForSelector('#prog-status.ok');
  ok(!Object.keys(w.props).some(k => k.startsWith('prog_')) && (await a.locator('.prog-card .lesson').evaluateAll(l => l.every(e => e.innerText.includes('Jamais jouée')))), 'remise à zéro générale : plus aucune progression nulle part');
  ok((await a.locator('#reset-all').count()) === 1 && (await a.locator('#pane-programmes section').count()) === 2, 'le bouton général est isolé dans sa propre zone « Remise à zéro générale »');

  // ---- 8. sécurité : refus sans bon mot de passe ----
  await a.fill('#password', 'mauvais');
  await lesson('leo', 'zootopia').locator('text=Remettre cette leçon à zéro').click(); await a.waitForSelector('#prog-status.err');
  ok((await a.locator('#prog-status').innerText()).includes('Mot de passe incorrect'), 'mot de passe retiré : la remise à zéro est refusée (« ' + await a.locator('#prog-status').innerText() + ' »)');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
