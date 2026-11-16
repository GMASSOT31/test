// Menu 👤 → « 💾 Exporter toutes les données » (administrateur principal) : fichier = backupData, sans mots de passe admin.
// Sert au transfert vers QUIZy sur Cloudflare. Tourne sur les deux versions (QUIZY_TARGET).
const { chromium } = require('playwright');
const fs = require('fs');
const { makeWorld, install, ok, summary, page } = require('./harness');

(async () => {
  const w = makeWorld();
  const ADM = { pseudo: 'Papa', password: 'secret' };
  w.run('saveStudent', ADM, { classe: 'Gaby', pseudo: 'Jul', pin: '1111' });
  w.run('setBuiltinAssign', ADM, 'zootopia', ['jul']);
  w.run('answer', 'Gaby', 'Jul', '1111', 'zootopia', w.ctx.qhash_(w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia').questions[0].question), 'qcm', true, '', 's1', 'op1');
  const code = w.run('setInviteCode', ADM, 'new').code;
  w.run('createFamily', code, { famille: 'Martin', pseudo: 'Maman Martin', password: 'motdepasse1' });
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true }); await install(c, w);
  await c.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const errs = [];
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message));
  const login = async (pseudo, password) => {
    await a.fill('#admin-pseudo', pseudo); await a.fill('#password', password); await a.click('#unlock');
    await a.waitForSelector('#lock-status.ok, #lock-status.err');
  };
  const logout = async () => { await a.click('#acct-btn'); await a.click('#lock'); await a.waitForSelector('#admin-area', { state: 'hidden' }); };
  await a.goto(page('admin.html'));

  // ---- administrateur principal ----
  await login('Papa', 'secret');
  await a.click('#acct-btn');
  ok(await a.locator('#menu-export').isVisible() && (await a.locator('#menu-export').innerText()).includes('💾 Exporter toutes les données'), 'administrateur : « 💾 Exporter toutes les données » dans le menu 👤');
  await a.click('#menu-export');
  await a.waitForSelector('#export-status.ok, #export-status.err');
  const st = await a.locator('#export-status').innerText();
  ok(await a.locator('#export-panel').isVisible() && /Fichier prêt \(\d+ Ko\) : 1 enfant, 1 famille invitée, 0 leçon créée, 1 progression/.test(st), 'fichier préparé, résumé : « ' + st + ' »');
  ok(await a.locator('#export-download').isVisible() && await a.locator('#export-copy').isVisible() && !(await a.locator('#export-share').isVisible()), 'boutons « Télécharger » et « Copier » (« Partager » seulement sur téléphone)');

  const [dl] = await Promise.all([a.waitForEvent('download'), a.click('#export-download')]);
  const name = dl.suggestedFilename();
  const file = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(/^quizy-export-\d{4}-\d{2}-\d{2}-\d{2}h\d{2}\.json$/.test(name), 'téléchargement : ' + name);
  const ref = w.run('backupData', ADM);
  ok(file.schema === 3 && typeof file.date === 'number' && JSON.stringify(file.proprietes) === JSON.stringify(JSON.parse(JSON.stringify(ref.proprietes))), 'contenu = backupData (toutes les propriétés, mêmes valeurs)');
  ok(!('ADMIN_PASSWORD' in file.proprietes) && !('ADMIN_PASS_HASH' in file.proprietes) && file.proprietes.ADMIN_PSEUDO === 'Papa', 'sans les mots de passe administrateur, avec le pseudo administrateur (ADMIN_PSEUDO)');
  ok(Object.keys(file.proprietes).some(k => k.startsWith('srs_jul__')) && file.proprietes.student_jul.includes('"hash"') && !file.proprietes.student_jul.includes('1111') && Object.keys(file.proprietes).some(k => k.startsWith('parent_')), 'enfants (PIN hachés seulement), progressions et familles inclus');
  ok((await a.locator('#export-status').innerText()).includes('Téléchargement lancé'), 'message après le téléchargement');

  await a.click('#export-copy');
  await a.waitForFunction(() => document.querySelector('#export-status').textContent.includes('copié'), null, { timeout: 3000 }).catch(() => {});
  const clip = await a.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(JSON.parse(clip || '{}').proprietes && JSON.stringify(JSON.parse(clip).proprietes) === JSON.stringify(file.proprietes), '« Copier le contenu » : même contenu dans le presse-papiers');

  await a.click('#export-close');
  ok(await a.locator('#export-panel').isHidden(), '« ✕ Fermer » referme le panneau');
  await a.click('#acct-btn'); await a.click('#menu-export'); await a.waitForSelector('#export-status.ok');
  await logout();
  ok(await a.locator('#export-panel').isHidden() && (await a.locator('#export-status').innerText()) === '' && await a.evaluate(() => EXPORT === null), 'déconnexion : panneau fermé, données de l\'export effacées de la page');

  // ---- famille invitée : pas d'export ----
  await login('Maman Martin', 'motdepasse1');
  await a.click('#acct-btn');
  ok(await a.locator('#menu-export').isHidden(), 'famille invitée : pas de bouton d\'export');
  ok(w.try('backupData', { pseudo: 'Maman Martin', password: 'motdepasse1' }).err === "Réservé à l'administrateur principal.", 'serveur : export refusé à une famille invitée');
  const viaPage = await a.evaluate(() => new Promise(r => google.script.run.withSuccessHandler(() => r('ok')).withFailureHandler(e => r(e.message)).backupData({ pseudo: 'Maman Martin', password: 'motdepasse1' })));
  ok(/Réservé à l'administrateur principal/.test(viaPage), 'appel forcé depuis la page : refusé (« ' + viaPage + ' »)');

  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close();
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
