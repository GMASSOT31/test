// cible: cloudflare
// Écran « Qui es-tu ? » : profils mémorisés sur l'appareil (localStorage "profiles"), connexion par mot de passe/PIN seul,
// « Autre profil / Nouvelle connexion », retrait, profil disparu ou refusé, renommage, 8 profils au plus, stockage bloqué,
// rien dans l'URL, jamais de secret mémorisé, accessibilité (clavier, aria-label, cibles de 48 px, contraste).
const { chromium } = require('playwright');
const { makeWorldCf, install, ok, summary, page } = require('./harness');
const P = n => page(n, 'cloudflare');
const ADM = { pseudo: 'Papa', password: 'secret12' };

(async () => {
  const w = makeWorldCf({ ADMIN_PASSWORD: 'secret12' });
  w.run('adminData', ADM);                                         // ADMIN_PSEUDO = Papa
  w.run('saveStudent', ADM, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  w.run('saveStudent', ADM, { classe: '5B', pseudo: 'Emma', pin: '4321' });
  w.run('setBuiltinAssign', ADM, 'zootopia', ['leo', 'emma']);
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await install(c, w, { profils: true });
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  const profils = () => p.evaluate(() => JSON.parse(localStorage.getItem('profiles') || '[]'));
  const tuiles = () => p.locator('#who .qp-nom').allInnerTexts();
  const relancer = async (url = P('Index.html')) => { await p.goto('about:blank'); await p.goto(url); };

  // ---- 1. premier lancement : formulaire normal ----
  await p.goto(P('Index.html'));
  ok(await p.locator('#who').isHidden() && await p.locator('#login-classe').isVisible(), 'aucun profil mémorisé : formulaire de connexion normal');

  // ---- 2. connexion : le profil est mémorisé, sans aucun secret ----
  await p.fill('#login-classe', '5b'); await p.fill('#login-pseudo', 'leo'); await p.fill('#login-pin', '1234'); await p.click('#login-btn');
  await p.waitForSelector('#app:not([hidden])');
  let L = await profils();
  ok(L.length === 1 && L[0].role === 'eleve' && L[0].nom === 'Léo' && L[0].pseudo === 'Léo' && L[0].classe === '5B' && L[0].id === 'leo' && /^#[0-9A-F]{6}$/i.test(L[0].couleur),
    'après la connexion : profil mémorisé (nom et classe officiels, rôle, couleur) : ' + JSON.stringify(L[0]));
  const autorises = ['role', 'id', 'nom', 'pseudo', 'classe', 'couleur', 'admin', 'maj'];
  ok(Object.keys(L[0]).every(k => autorises.includes(k)) && !JSON.stringify(L).includes('1234'), 'jamais de PIN ni d\'autre champ que ceux prévus');
  ok(!/l[eé]o|5b|1234/i.test(decodeURIComponent(p.url())), 'rien de personnel dans l\'adresse : ' + p.url());

  // ---- 3. déconnexion : formulaire normal ; au lancement suivant : « Qui es-tu ? » ----
  await p.click('#logout');
  ok(await p.locator('#who').isHidden() && await p.locator('#login-classe').isVisible(), 'déconnexion : formulaire normal (prérempli), pas la grille');
  await relancer();
  ok(await p.locator('#who').isVisible() && await p.locator('#login-form').isHidden() && (await p.locator('#who h2').innerText()) === 'Qui es-tu ?', 'nouveau lancement : écran « Qui es-tu ? »');
  ok(JSON.stringify(await tuiles()) === '["Léo"]' && (await p.locator('#who .qp-role').first().innerText()) === 'Élève · 5B', 'une pastille : Léo, « Élève · 5B »');

  // ---- 4. accessibilité ----
  const tuile = p.locator('#who .qp-profil').first(), retirer = p.locator('#who .qp-retirer').first(), autre = p.locator('#who .qp-autre');
  ok((await tuile.getAttribute('aria-label')) === 'Me connecter : Léo, élève · 5b' && (await retirer.getAttribute('aria-label')) === 'Retirer le profil Léo de cet appareil', 'boutons nommés pour les lecteurs d\'écran (aria-label)');
  const tailles = await Promise.all([tuile, retirer, autre].map(x => x.boundingBox()));
  ok(tailles.every(t => t.height >= 48 && t.width >= 48), 'cibles tactiles d\'au moins 48 px : ' + tailles.map(t => Math.round(t.width) + '×' + Math.round(t.height)).join(', '));
  ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('qp-profil')), 'le focus clavier est sur le premier profil');
  const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const src = require('fs').readFileSync(__dirname + '/../cloudflare/static/profils.js', 'utf8');
  const palette = JSON.parse(/var COULEURS = (\[[^\]]+\])/.exec(src)[1].replace(/'/g, '"'));
  ok(palette.every(h => 1.05 / (lum(h) + 0.05) >= 4.5), 'couleurs d\'avatar : initiale blanche lisible (contraste ≥ 4,5:1) : ' + palette.map(h => (1.05 / (lum(h) + 0.05)).toFixed(1)).join(', '));

  // ---- 5. toucher le profil : seul le PIN est demandé (au clavier) ----
  await p.keyboard.press('Enter');
  ok(await p.locator('#who').isHidden() && await p.locator('#login-pin').isVisible() && await p.locator('#login-classe').isHidden() && await p.locator('#login-pseudo').isHidden(), 'profil choisi : classe et pseudo cachés (déjà remplis), seul le PIN est demandé');
  ok((await p.locator('#login-profil').innerText()).includes('Léo') && await p.evaluate(() => document.activeElement.id === 'login-pin'), 'puce « Léo » affichée, curseur dans le PIN');
  await p.keyboard.type('1234'); await p.keyboard.press('Enter');
  await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('#whoami-name').innerText()) === '👤 Léo · 5B', 'connecté avec le PIN seul');

  // ---- 6. « Autre profil / Nouvelle connexion » : Emma ; ordre et doublons ----
  await p.click('#logout'); await relancer();
  await p.click('#who .qp-autre');
  ok(await p.locator('#login-classe').isVisible() && (await p.locator('#login-classe').inputValue()) === '' && (await p.locator('#login-pseudo').inputValue()) === '', '« Autre profil / Nouvelle connexion » : formulaire complet, vide');
  await p.fill('#login-classe', '5B'); await p.fill('#login-pseudo', 'Emma'); await p.fill('#login-pin', '4321'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok(JSON.stringify((await profils()).map(x => x.nom)) === '["Emma","Léo"]', 'le plus récent en premier : Emma, Léo');
  await p.click('#logout'); await relancer(); await p.click('#who .qp-profil >> text=Léo'); await p.fill('#login-pin', '1234'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  L = await profils();
  ok(JSON.stringify(L.map(x => x.nom)) === '["Léo","Emma"]', 'Léo de nouveau en tête, sans doublon');

  // ---- 7. PIN refusé : message clair + « Retirer ce profil » ----
  await p.click('#logout'); await relancer();
  await p.click('#who .qp-profil >> text=Emma'); await p.fill('#login-pin', '0000'); await p.click('#login-btn');
  await p.waitForSelector('#login-profil-retrait:not([hidden])');
  ok((await p.locator('#login-error').innerText()) === "PIN incorrect, ou ce profil n'existe plus. Réessaie, ou retire ce profil de l'appareil." && await p.locator('#login-pin').isVisible() && await p.locator('#login-classe').isHidden(),
    'PIN refusé : message clair, on reste sur le profil (le PIN seul)');
  ok(await p.locator('text=Retirer ce profil de cet appareil').isVisible(), 'proposition : « 🗑️ Retirer ce profil de cet appareil »');
  await p.fill('#login-pin', '4321'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok(true, 'et on peut réessayer avec le bon PIN');

  // ---- 8. profil qui n'existe plus côté serveur ----
  w.run('deleteStudent', ADM, 'emma');
  await p.click('#logout'); await relancer();
  await p.click('#who .qp-profil >> text=Emma'); await p.fill('#login-pin', '4321'); await p.click('#login-btn');
  await p.waitForSelector('#login-profil-retrait:not([hidden])');
  ok((await p.locator('#login-error').innerText()).includes("ce profil n'existe plus"), 'enfant supprimé : « … ou ce profil n\'existe plus »');
  await p.click('text=Retirer ce profil de cet appareil');
  ok(JSON.stringify(await tuiles()) === '["Léo"]' && JSON.stringify((await profils()).map(x => x.nom)) === '["Léo"]', 'retiré : retour à la grille, Emma n\'y est plus');

  // ---- 9. renommage (espace parents, même appareil) : le profil suit ----
  const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message));
  await a.goto(P('admin.html'));
  ok(JSON.stringify(await a.locator('#who .qp-nom').allInnerTexts()) === '["Léo"]' && await a.locator('#lockbar').isHidden(), 'espace parents : la grille montre aussi les profils (Léo)');
  await a.click('#who .qp-autre');
  await a.fill('#admin-pseudo', 'Papa'); await a.fill('#password', 'secret12'); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])');
  let PL = await a.evaluate(() => JSON.parse(localStorage.getItem('profiles')));
  ok(PL[0].role === 'parent' && PL[0].nom === 'Papa' && PL[0].admin === true && !JSON.stringify(PL).includes('secret12'), 'parent connecté : profil « Papa » (administrateur) mémorisé, sans mot de passe');
  ok(!(await a.locator('#lockbar').getAttribute('class')).includes('avec-profil') && await a.locator('#who-chip').isHidden() && await a.locator('#who').isHidden(), 'connecté : barre normale (plus de mode profil ni de grille)');
  await a.evaluate(() => loadStudent(DATA.students.find(x => x.id === 'leo')));   // = « ✏️ Modifier (pseudo, classe, PIN) »
  await a.fill('#st-pseudo', 'Léon'); await a.click('#save-student');
  await a.waitForFunction(() => document.querySelector('#prog-status').textContent.includes('Léon'));
  const edit = true;
  PL = await a.evaluate(() => JSON.parse(localStorage.getItem('profiles')));
  const leo = PL.find(x => x.id === 'leo');
  ok(edit && leo && leo.nom === 'Léon' && leo.pseudo === 'Léon', 'enfant renommé dans l\'espace parents : son profil mémorisé devient « Léon »');
  await a.click('#acct-btn'); await a.click('#lock');

  // ---- 10. depuis la page élève, toucher le profil parent : espace parents, mot de passe seul (rien dans l'URL) ----
  await relancer();
  ok(JSON.stringify(await tuiles()) === '["Papa","Léon"]' && (await p.locator('#who .qp-role').first().innerText()) === 'Parent · administrateur', 'grille : Papa (parent · administrateur) puis Léon');
  await p.click('#who .qp-profil >> text=Papa');
  await p.waitForURL(/\/parents$/);
  await p.waitForSelector('#who-chip:not([hidden])');
  ok(new URL(p.url()).pathname === '/parents' && new URL(p.url()).search === '' && new URL(p.url()).hash === '', 'espace parents ouvert, adresse sans aucune donnée : ' + p.url());
  ok(await p.locator('#admin-pseudo').isHidden() && await p.locator('#password').isVisible() && (await p.locator('#who-chip').innerText()).includes('Papa'), 'seul le mot de passe est demandé (puce « Papa »)');
  await p.fill('#password', 'faux-mdp-1'); await p.click('#unlock');
  await p.waitForSelector('#who-retrait:not([hidden])');
  ok((await p.locator('#lock-status').innerText()) === "Mot de passe incorrect, ou ce profil n'existe plus." && await p.locator('#who-retrait >> text=Retirer ce profil').isVisible(), 'mot de passe refusé : message clair + « Retirer ce profil »');
  await p.fill('#password', 'secret12'); await p.click('#unlock'); await p.waitForSelector('#admin-area:not([hidden])');
  ok(await p.locator('#who-chip').isHidden() && await p.locator('#who-retrait').isHidden(), 'connecté : la puce et la proposition disparaissent');
  await p.click('#acct-btn'); await p.click('#lock');
  // et dans l'autre sens : profil élève touché dans l'espace parents
  await relancer(P('admin.html'));
  await p.click('#who .qp-profil >> text=Léon');
  await p.waitForSelector('#login-profil:not([hidden])');
  ok(new URL(p.url()).pathname === '/' && (await p.locator('#login-profil').innerText()).includes('Léon') && await p.locator('#login-classe').isHidden(), 'profil élève touché dans l\'espace parents : page élève, PIN seul');
  await p.fill('#login-pin', '1234'); await p.click('#login-btn'); await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('#whoami-name').innerText()) === '👤 Léon · 5B', 'Léon se connecte avec son PIN habituel');

  // ---- 11. bouton « Retirer » de la grille ----
  await p.click('#logout'); await relancer();
  await p.click('#who .qp-retirer[aria-label="Retirer le profil Papa de cet appareil"]');
  ok(JSON.stringify(await tuiles()) === '["Léon"]' && (await p.locator('#who .qp-statut').innerText()) === 'Profil « Papa » retiré de cet appareil.', 'bouton « Retirer » : profil retiré, message annoncé');
  await p.click('#who .qp-retirer');
  ok(await p.locator('#who').isHidden() && await p.locator('#login-classe').isVisible() && (await profils()).length === 0, 'dernier profil retiré : formulaire normal');

  // ---- 12. 8 profils au plus ----
  const n = await p.evaluate(() => { for (let i = 1; i <= 10; i++) QuizyProfils.memoriser({ role: 'eleve', id: 'e' + i, nom: 'Élève ' + i, pseudo: 'Élève ' + i, classe: '6A' }); return JSON.parse(localStorage.getItem('profiles')).map(x => x.nom); });
  ok(n.length === 8 && n[0] === 'Élève 10' && n[7] === 'Élève 3', '8 profils au plus, les plus récents gardés : ' + n.join(', '));
  ok(await p.evaluate(() => { QuizyProfils.memoriser({ role: 'eleve', id: 'x', nom: 'X', pseudo: 'X', classe: '6A', pin: '9999', password: 'p', token: 't' }); return !/9999|password|token|"pin"/.test(localStorage.getItem('profiles')); }), 'un champ secret passé par erreur n\'est jamais enregistré');

  // ---- 13. stockage abîmé ou bloqué : le site marche sans ----
  await p.evaluate(() => localStorage.setItem('profiles', '{pas du json'));
  await relancer();
  ok(await p.locator('#who').isHidden() && await p.locator('#login-classe').isVisible(), 'valeur abîmée : formulaire normal, sans erreur');
  const c2 = await b.newContext(); await install(c2, w, { profils: true });
  await c2.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqué', 'SecurityError'); } }); Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('bloqué', 'SecurityError'); } }); });
  const q = await c2.newPage(); const e2 = []; q.on('pageerror', e => e2.push(e.message));
  await q.goto(P('Index.html'));
  await q.fill('#login-classe', '5B'); await q.fill('#login-pseudo', 'Léon'); await q.fill('#login-pin', '1234'); await q.click('#login-btn'); await q.waitForSelector('#app:not([hidden])');
  await q.goto(P('admin.html')); await q.fill('#admin-pseudo', 'Papa'); await q.fill('#password', 'secret12'); await q.click('#unlock'); await q.waitForSelector('#admin-area:not([hidden])');
  ok(e2.length === 0, 'stockage bloqué (navigation privée) : connexions élève et parent normales, aucune erreur ' + JSON.stringify(e2));

  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close();
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
