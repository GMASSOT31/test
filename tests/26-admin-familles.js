// Page admin : onglet Parents, code d'invitation, « Créer ma famille », menu du compte, changer le mot de passe
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, SRC } = require('./harness');

(async () => {
  const w = makeWorld();
  const ADM = { pseudo: 'Papa', password: 'secret' };
  w.run('saveStudent', ADM, { classe: 'Gaby', pseudo: 'Jul', pin: '1111' });
  w.run('setBuiltinAssign', ADM, 'zootopia', ['jul']);
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1200, height: 900 } }); await install(c, w);
  const errs = [], dialogs = [];
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message));
  a.on('dialog', d => { dialogs.push(d.message()); d.type() === 'prompt' ? d.accept('temporaire-9') : d.accept(); });
  const login = async (pseudo, password) => {
    await a.fill('#admin-pseudo', pseudo); await a.fill('#password', password); await a.click('#unlock');
    await a.waitForSelector('#lock-status.ok, #lock-status.err');
  };
  const logout = async () => { await a.click('#acct-btn'); await a.click('#lock'); await a.waitForSelector('#admin-area', { state: 'hidden' }); };
  await a.goto('file://' + SRC + 'admin.html');

  // ---- 1. administrateur : onglet Parents, code d'invitation ----
  await login('Papa', 'secret');
  ok(await a.locator('#tab-parents').isVisible(), 'administrateur : onglet « 👪 Parents » à côté d\'« Élèves »');
  await a.click('#tab-parents');
  ok((await a.locator('#invite-box').innerText()).includes('Inscriptions fermées') && (await a.locator('#parent-list .item').count()) === 1 && (await a.locator('#parent-list').innerText()).includes('Ta famille'), 'pas encore de code : inscriptions fermées ; seule ta famille est listée');
  ok(/Stockage utilisé : \d+ Ko sur 500 Ko \(\d+ %\)/.test(await a.locator('#stockage').innerText()), 'stockage affiché : ' + (await a.locator('#stockage').innerText()).trim());
  await a.click('text=Créer un code d\'invitation'); await a.waitForSelector('#invite-code');
  const code = await a.locator('#invite-code').innerText();
  ok(code === w.props.INVITE_CODE && (await a.locator('#invite-box input').inputValue()).endsWith('/exec?p=admin'), 'code ' + code + ' affiché avec l\'adresse de l\'espace parents à donner');
  await logout();

  // ---- 2. une famille s'inscrit ----
  ok(await a.locator('#signup').isHidden() && (await a.locator('#signup-open').innerText()).includes('Créer ma famille'), 'page de connexion : lien discret « 👪 Créer ma famille »');
  await a.click('#signup-open');
  await a.fill('#su-code', 'ZZZZ-ZZZZ'); await a.fill('#su-famille', 'Famille Dupont'); await a.fill('#su-pseudo', 'Dupont'); await a.fill('#su-pw', 'motdepasse1'); await a.fill('#su-pw2', 'motdepasse2');
  await a.click('#su-save'); await a.waitForSelector('#su-status.err');
  ok((await a.locator('#su-status').innerText()).includes('pas identiques'), 'mots de passe différents : refusé avant l\'envoi');
  await a.fill('#su-pw2', 'motdepasse1'); await a.click('#su-save'); await a.waitForFunction(() => document.querySelector('#su-status').textContent.includes('incorrect'));
  ok((await a.locator('#su-status').innerText()) === 'Code d\'invitation incorrect.', 'mauvais code : « Code d\'invitation incorrect. »');
  await a.fill('#su-code', code.toLowerCase()); await a.click('#su-save'); await a.waitForSelector('#admin-area:not([hidden])');
  ok(!!w.props.parent_dupont && await a.locator('#signup').isHidden() && (await a.locator('#admin-pseudo').inputValue()) === 'Dupont', 'famille créée : connexion automatique');

  // ---- 3. le parent invité : seulement sa famille ----
  ok(await a.locator('#tab-parents').isHidden() && (await a.locator('#acct-btn').innerText()).includes('Dupont'), 'parent invité : pas d\'onglet Parents ; menu « Dupont ▾ »');
  await a.click('#acct-btn');
  ok((await a.locator('#acct-who').innerText()).includes('Famille Dupont'), 'le menu rappelle la famille');
  await a.click('#tab-programmes');
  ok((await a.locator('#guide').innerText()).includes('Pour commencer') && !(await a.locator('body').innerText()).includes('Jul'), 'nouvelle famille : guide « Pour commencer », aucun enfant d\'une autre famille');
  await a.click('#tab-eleves'); await a.click('#tab-eleve-ajout');
  await a.fill('#st-classe', 'Dupont'); await a.fill('#st-pseudo', 'Lou'); await a.fill('#st-pin', '2222'); await a.click('#save-student'); await a.waitForSelector('#eleves-status.ok');
  ok(JSON.parse(w.props.student_lou).fam === 'dupont', 'le parent crée le compte de son enfant (rangé dans sa famille)');
  await a.click('#tab-quiz-liste');
  ok((await a.locator('.builtin button', { hasText: 'Modifier' }).count()) === 0 && (await a.locator('#builtin-hint').innerText()).includes('Coche tes enfants'), 'leçons fournies : il coche ses enfants, mais ne peut pas les modifier');
  const zoo = a.locator('#builtin-list .builtin[data-id="zootopia"]');
  ok((await zoo.innerText()).includes('Donnée à personne'), 'Zootopia : donnée à personne de SA famille (Jul n\'apparaît pas)');
  await zoo.locator('.builtin-toggle').click();
  ok((await zoo.locator('.pour-item').allInnerTexts()).join() === 'Lou (Dupont)', 'cases à cocher : seulement Lou');
  await zoo.locator('.pour-item input').check(); await zoo.locator('text=Enregistrer l\'accès').click();
  await a.waitForFunction(() => document.querySelector('#builtin-list .builtin[data-id="zootopia"]').textContent.includes('👥 Lou'));
  ok(JSON.stringify(JSON.parse(w.props.builtin_assign).zootopia.sort()) === '["jul","lou"]', 'Zootopia donnée à Lou ; Jul (autre famille) la garde');

  // ---- 4. changer le mot de passe (menu du compte) ----
  await a.click('#acct-btn'); await a.click('#change-pw');
  ok(await a.locator('#pw-panel').isVisible() && await a.locator('#acct-menu').isHidden(), '« Changer le mot de passe » ouvre le formulaire');
  await a.fill('#pw-old', 'mauvais-mdp'); await a.fill('#pw-new', 'nouveau-mdp-1'); await a.fill('#pw-new2', 'nouveau-mdp-1');
  await a.click('#pw-save'); await a.waitForSelector('#pw-status.err');
  ok((await a.locator('#pw-status').innerText()) === 'Mot de passe actuel incorrect.', 'mauvais mot de passe actuel : refusé');
  await a.fill('#pw-old', 'motdepasse1'); await a.fill('#pw-new2', 'autre-chose'); await a.click('#pw-save');
  ok((await a.locator('#pw-status').innerText()).includes('pas identiques'), 'confirmation différente : refusé');
  await a.fill('#pw-new2', 'nouveau-mdp-1'); await a.click('#pw-save'); await a.waitForSelector('#pw-status.ok');
  ok((await a.locator('#pw-status').innerText()).includes('Mot de passe changé') && (await a.locator('#pw-old').inputValue()) === '', 'mot de passe changé ; champs vidés');
  await a.click('#unlock'); await a.waitForSelector('#lock-status.ok');
  ok(await a.locator('#admin-area').isVisible(), 'la session continue avec le nouveau mot de passe (Actualiser fonctionne)');
  await logout();
  await login('Dupont', 'motdepasse1');
  ok((await a.locator('#lock-status').innerText()) === 'Pseudo ou mot de passe incorrect.', 'l\'ancien mot de passe ne marche plus');
  await login('Dupont', 'nouveau-mdp-1');
  ok(await a.locator('#admin-area').isVisible(), 'le nouveau, si');
  await logout();

  // ---- 5. l'administrateur : la famille apparaît, nouveau mot de passe, suppression ----
  await login('Papa', 'secret'); await a.click('#tab-parents');
  const row = a.locator('#parent-list .item[data-parent="dupont"]');
  ok((await row.innerText()).includes('Famille Dupont') && (await row.innerText()).includes('👤 Dupont · 1 enfant') && (await row.innerText()).includes('dernière connexion') && (await a.locator('#count-parents').innerText()) === '1', 'onglet Parents : « Famille Dupont », 1 enfant, dernière connexion');
  ok(!(await a.locator('#pane-programmes').innerText()).includes('Lou'), 'l\'administrateur ne voit pas Lou dans son suivi');
  await row.locator('text=Nouveau mot de passe').click(); await a.waitForSelector('#parents-status.ok');
  ok(w.run('adminData', { pseudo: 'Dupont', password: 'temporaire-9' }).moi.famille === 'Famille Dupont', 'nouveau mot de passe donné à Dupont (mot de passe oublié)');
  await row.locator('text=Supprimer').click(); await a.waitForFunction(() => document.querySelector('#parents-status').textContent.includes('supprimée'));
  ok(!w.props.parent_dupont && !w.props.student_lou && !!w.props.student_jul && dialogs.some(m => m.includes('effacés définitivement')), 'supprimer la famille (après confirmation) : Dupont et Lou effacés, Jul intact');

  // ---- 6. l'administrateur change son mot de passe ----
  await a.click('#acct-btn'); await a.click('#change-pw');
  await a.fill('#pw-old', 'secret'); await a.fill('#pw-new', 'papa-2026!'); await a.fill('#pw-new2', 'papa-2026!'); await a.click('#pw-save'); await a.waitForSelector('#pw-status.ok');
  ok(!w.props.ADMIN_PASSWORD && !!w.props.ADMIN_PASS_HASH, 'administrateur : mot de passe temporaire remplacé (plus de mot de passe en clair dans le script)');
  await a.click('#tab-programmes'); await a.click('#unlock'); await a.waitForSelector('#lock-status.ok');
  ok(await a.locator('#admin-area').isVisible(), 'session toujours ouverte');

  // ---- 7. téléphone : inscription lisible ----
  const m = await b.newContext({ viewport: { width: 360, height: 740 } }); await install(m, w);
  const p = await m.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + SRC + 'admin.html'); await p.click('#signup-open');
  ok(await p.locator('#su-save').isVisible() && await p.evaluate(() => document.documentElement.scrollWidth <= 360), 'téléphone : formulaire « Créer ma famille » sans défilement horizontal');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
