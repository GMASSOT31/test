// cible: cloudflare
// De bout en bout sur le VRAI runtime Cloudflare en local (wrangler dev : workerd, Durable Object SQLite, fichiers statiques) :
// pages et appli installable, installation, API HTTP, fonctions internes refusées, PIN existant après import, persistance au
// redémarrage, une requête à la fois (idempotence), temps de réponse, séance complète dans le navigateur, vraie panne réseau.
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const { makeWorldAs, ok, summary, login, LEO, startLesson, answerCurrent, CF } = require('./harness');

const PORT = 8700 + (process.pid % 200), BASE = 'http://127.0.0.1:' + PORT;
const CODE = 'TEST-' + (1000 + (process.pid % 9000));
const PERSIST = fs.mkdtempSync(path.join(os.tmpdir(), 'quizy-wrangler-'));
let proc = null;
async function startWrangler() {
  proc = spawn(path.join(CF, 'node_modules', '.bin', 'wrangler'), ['dev', '--ip', '127.0.0.1', '--port', String(PORT), '--var', 'INSTALL_CODE:' + CODE, '--persist-to', PERSIST, '--log-level', 'warn', '--show-interactive-dev-session=false'],
    { cwd: CF, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; proc.stdout.on('data', d => { log += d; }); proc.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(BASE + '/setup/status'); if (r.ok) return; } catch (e) { /* pas encore prêt */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('wrangler dev ne démarre pas :\n' + log.slice(-2000));
}
async function stopWrangler() { if (!proc) return; const p = proc; proc = null; p.kill('SIGTERM'); await new Promise(r => { p.on('exit', r); setTimeout(r, 5000); }); }
const post = (p, body, type = 'application/json') => fetch(BASE + p, { method: 'POST', headers: { 'content-type': type }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const api = async (fn, ...args) => (await post('/api/' + fn, args)).json();

(async () => {
  // une sauvegarde de l'appli Apps Script, avec Léo (PIN 1234) qui a déjà révisé
  const A = makeWorldAs({ ADMIN_PASSWORD: 'secret' }); const OLD = { pseudo: 'Papa', password: 'secret' };
  A.run('adminData', OLD);
  A.run('saveStudent', OLD, { classe: '5B', pseudo: 'Léo', pin: '1234' }); A.run('setBuiltinAssign', OLD, 'zootopia', ['leo']); A.run('setBuiltinAssign', OLD, 'byzance', ['leo']);
  const zid = A.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia').questions.map(q => A.ctx.qhash_(q.question));
  A.run('answer', '5B', 'Léo', '1234', 'zootopia', zid[0], 'qcm', true, '', 's0', 'op0');
  const exported = JSON.parse(JSON.stringify(A.run('backupData', OLD)));

  await startWrangler();
  // ---- 1. base vide : installation ----
  let r = await fetch(BASE + '/', { redirect: 'manual' });
  ok(r.status === 302 && r.headers.get('location') === BASE + '/installer', 'base vide : / redirige vers /installer');
  ok((await (await fetch(BASE + '/installer')).text()).includes('<title>QUIZy · Installer</title>'), 'écran « Installer » servi');
  ok((await (await post('/setup/install', { code: 'FAUX', password: 'motdepasse-1' })).json()).error === "Code d'installation incorrect.", 'installation refusée sans le bon code');
  const inst = await (await post('/setup/install', { code: CODE, data: exported, password: 'motdepasse-1' })).json();
  ok(inst.ok && inst.value.enfants === 1 && inst.value.progressions === 1 && inst.value.adminPseudo === 'Papa', 'installation avec le fichier exporté : ' + JSON.stringify(inst.value || inst.error));
  ok((await (await post('/setup/install', { code: CODE, password: 'motdepasse-2' })).json()).error.includes('déjà installé'), 'une 2e installation est refusée');
  const ADM = { pseudo: 'Papa', password: 'motdepasse-1' };

  // ---- 2. pages et appli installable ----
  const eleve = await (await fetch(BASE + '/')).text(), parents = await (await fetch(BASE + '/parents')).text();
  ok(eleve.includes('<title>QUIZy</title>') && parents.includes('<title>QUIZy · Parents</title>'), 'pages : « QUIZy » et « QUIZy · Parents »');
  ok(!/script\.google\.com|\/exec\b/.test(eleve + parents) && eleve.includes('href="/parents"') && parents.includes('href="/"'), 'liens entre les pages : / et /parents (plus aucune adresse Google)');
  ok(eleve.includes('<script src="/run.js"></script>') && eleve.includes('rel="manifest" href="/manifest.webmanifest"'), 'pont run.js et manifeste dans la page élève');
  const man = await (await fetch(BASE + '/manifest.webmanifest')).json();
  ok(man.name === 'QUIZy' && man.short_name === 'QUIZy' && man.display === 'standalone' && man.start_url === '/', 'manifeste : appli « QUIZy » installable (plein écran, démarre sur /)');
  const icons = await Promise.all(['/icon-192.png', '/icon-512.png', '/icon-180.png', '/icon.svg'].map(async u => { const x = await fetch(BASE + u); return x.status === 200 && (await x.arrayBuffer()).byteLength > 300; }));
  ok(icons.every(Boolean), 'icônes servies (192, 512, 180 pour iPhone, SVG)');

  // ---- 3. API ----
  const d = await api('getStudentData', '5B', 'Léo', '1234');
  ok(d.ok && d.value.student.id === 'leo' && d.value.srs.zootopia.it[zid[0]][0] === 1, 'PIN existant après import : Léo se connecte, sa progression est là');
  ok((await api('getStudentData', '5B', 'Léo', '9999')).error === 'Classe, pseudo ou PIN incorrect.', 'mauvais PIN : { error } avec le message habituel');
  ok((await api('hashPin_', 'a', 'b')).error === 'Fonction indisponible : hashPin_' && (await api('doGet')).error === 'Fonction indisponible : doGet' && (await api('existePas')).error === 'Fonction indisponible : existePas', 'fonctions internes (_), doGet et inconnues : refusées');
  ok((await fetch(BASE + '/api/adminData')).status === 405, 'GET sur l\'API : refusé (405)');
  ok((await post('/api/adminData', JSON.stringify([ADM]), 'text/plain')).status === 415, 'corps non JSON (formulaire d\'un autre site) : refusé (415)');
  ok((await post('/api/adminData', '{pas du json')).status === 400 && (await (await post('/api/adminData', '{"a":1}')).json()).error === 'Requête invalide.', 'JSON invalide ou arguments hors tableau : refusés');
  const exp = await api('backupData', ADM);
  ok(exp.ok && !('ADMIN_PASS_HASH' in exp.value.proprietes) && Object.keys(exported.proprietes).every(k => exp.value.proprietes[k] === exported.proprietes[k]), 'export depuis Cloudflare = données importées (sans mot de passe administrateur)');

  // ---- 4. une requête à la fois : idempotence et pas de perte en parallèle ----
  const L = ['5B', 'Léo', '1234'];
  await Promise.all(zid.slice(1, 9).map((id, i) => api('answer', ...L, 'zootopia', id, 'qcm', true, '', 'p1', 'par-' + i)));
  await Promise.all([1, 2, 3, 4, 5].map(() => api('answer', ...L, 'zootopia', zid[9], 'qcm', false, '', 'p1', 'meme-op')));
  const it = (await api('getStudentData', ...L)).value.srs.zootopia.it;
  ok(zid.slice(1, 9).every(id => it[id] && it[id][0] === 1 && it[id][3] === 1), '8 réponses envoyées en même temps : toutes enregistrées');
  ok(!!it[zid[9]] && it[zid[9]][2] === 1, 'la même opération envoyée 5 fois en même temps : comptée une seule fois');

  // ---- 5. temps de réponse ----
  const times = [];
  for (let i = 0; i < 15; i++) { const t0 = performance.now(); await api('getStudentData', ...L); times.push(performance.now() - t0); }
  times.sort((a, b) => a - b);
  ok(times[7] < 300, 'temps de réponse médian : ' + Math.round(times[7]) + ' ms (< 300 ms)');

  // ---- 6. persistance : redémarrage du Worker ----
  await stopWrangler(); await startWrangler();
  const again = await api('getStudentData', ...L);
  ok(again.ok && Object.keys(again.value.srs.zootopia.it).length === 10 && (await api('adminData', ADM)).ok, 'après redémarrage : données et mot de passe toujours là (stockage SQLite du Durable Object)');

  // ---- 7. navigateur : séance complète, espace parents, vraie panne réseau ----
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.addInitScript('window.revisionAutoNext = false;');
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/'); await login(p, LEO);
  ok((await p.locator('.card h3').allInnerTexts()).length === 2, 'page élève (téléphone) : Léo voit ses 2 leçons');
  await startLesson(p, 'Byzance', { tf: false });
  let n = 0; while (await p.locator('.session-head').count() && n < 12) { await answerCurrent(p, n !== 7); n++; }
  await p.evaluate(() => revisionFlush());
  const srv = (await api('getStudentData', ...L)).value.srs.byzance;
  ok(Object.keys(srv.it).length >= 5 && Object.values(srv.it).some(v => v[2] === 1) && srv.cfg, 'séance (découvrir → tester → corriger) enregistrée sur le serveur : ' + Object.keys(srv.it).length + ' questions, une erreur');
  ok((await p.locator('#sync-status').innerText()).includes('✅') || (await p.locator('#sync-status').innerText()) === '', 'indicateur : progression enregistrée');
  // vraie coupure réseau sur les réponses : 3 essais puis avertissement
  let tries = 0;
  await p.route('**/api/answer', route => { tries++; route.abort('internetdisconnected'); });
  while (await p.locator('.flashcard.learn').count()) await answerCurrent(p);
  if (await p.locator('.session-head').count()) {
    await answerCurrent(p, true, { next: false }); await p.evaluate(() => revisionFlush());
    ok(tries === 3 && (await p.locator('#sync-status').innerText()).includes('pas pu être enregistrée'), 'COUPURE RÉSEAU : 3 essais puis « ' + await p.locator('#sync-status').innerText() + ' »');
    await p.unroute('**/api/answer');
    await p.click('.next-btn'); await answerCurrent(p, true, { next: false }); await p.evaluate(() => revisionFlush());
    ok((await p.locator('#sync-status').innerText()) === '✅ Progression enregistrée', 'réseau revenu : « ✅ Progression enregistrée »');
  } else ok(false, 'la séance aurait dû continuer');
  // espace parents
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message));
  await a.goto(BASE + '/parents');
  await a.fill('#admin-pseudo', 'Papa'); await a.fill('#password', 'motdepasse-1'); await a.click('#unlock');
  await a.waitForSelector('#admin-area:not([hidden])');
  ok((await a.locator('#pane-programmes').innerText()).includes('Léo'), 'espace parents : connexion pseudo + mot de passe choisi à l\'installation, fiche de Léo');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close();
  await stopWrangler();
  fs.rmSync(PERSIST, { recursive: true, force: true });
  process.exit(summary() ? 1 : 0);
})().catch(async e => { console.log('ECHEC:', e.message.split('\n').slice(0, 5).join(' | ')); await stopWrangler(); process.exit(1); });
