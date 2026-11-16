// cible: cloudflare
// Installation de QUIZy comme une appli (PWA) : manifeste, service worker et page hors ligne, invitation discrète
// après la connexion, installation en un clic (beforeinstallprompt), tutoriel iPhone / iPad, rien si déjà installée,
// « Plus tard » (7 jours) / « Non merci » (90 jours) mémorisés, stockage bloqué sans erreur, menu des parents.
const { chromium, devices } = require('playwright');
const { makeWorldCf, install, ok, summary, page, login, LEO } = require('./harness');
const P = n => page(n, 'cloudflare');
const ADM = { pseudo: 'Papa', password: 'secret12' };
const JOUR = 24 * 3600 * 1000;
const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const UA_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';
const UA_IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

// simule l'événement que Chrome / Edge envoient quand l'appli est installable
const offrir = (p, issue = 'accepted') => p.evaluate(o => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  window.__prompts = 0; e.prompt = () => { window.__prompts++; }; e.userChoice = Promise.resolve({ outcome: o, platform: 'web' });
  window.dispatchEvent(e); window.__empeche = e.defaultPrevented;
}, issue);
const etat = p => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('quizy-installation') || '{}'); } catch (e) { return 'bloqué'; } });
const bandeau = p => p.locator('#qi-bandeau');
const visible = async (loc, ms = 3000) => { try { await loc.waitFor({ state: 'visible', timeout: ms }); return true; } catch (e) { return false; } };

(async () => {
  const w = makeWorldCf({ ADMIN_PASSWORD: 'secret12' });
  w.run('adminData', ADM);
  w.run('saveStudent', ADM, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  const b = await chromium.launch();
  const errs = [];
  async function contexte(opts = {}, init = '') {
    const c = await b.newContext(Object.assign({ viewport: { width: 1280, height: 800 }, userAgent: UA_CHROME }, opts));
    await install(c, w, { installation: true });
    await c.addInitScript('window.QUIZY_INSTALLATION_DELAI = 0;' + init);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
    return { c, p };
  }

  // ---- 1. manifeste, icônes, service worker, page hors ligne ----
  let { c, p } = await contexte();
  await p.goto(P('Index.html'));
  const tete = await p.evaluate(() => ({
    manifeste: document.querySelector('link[rel=manifest]').getAttribute('href'),
    apple: document.querySelector('link[rel=apple-touch-icon]').getAttribute('href'),
    capable: document.querySelector('meta[name=apple-mobile-web-app-capable]').content,
    script: !!document.querySelector('script[src="/installation.js"]')
  }));
  ok(tete.manifeste === '/manifest.webmanifest' && tete.apple === '/icon-180.png' && tete.capable === 'yes' && tete.script, 'page élève : manifeste, icône Apple, mode appli et script d\'installation');
  const m = await p.evaluate(() => fetch('/manifest.webmanifest').then(r => r.json()));
  ok(m.name === 'QUIZy' && m.short_name === 'QUIZy' && m.id === '/' && m.start_url === '/' && m.scope === '/' && m.display === 'standalone',
    'manifeste : nom, id, adresse de départ et fenêtre indépendante (standalone)');
  ok(m.icons.some(i => i.sizes === '192x192' && i.type === 'image/png') && m.icons.some(i => i.sizes === '512x512' && i.purpose === 'any')
    && m.icons.some(i => i.purpose === 'maskable'), 'manifeste : icônes 192, 512 et « maskable »');
  const icones = await p.evaluate(() => Promise.all(['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/icon-180.png'].map(u => fetch(u).then(r => r.status + ' ' + r.headers.get('content-type')))));
  ok(icones.every(s => s === '200 image/png'), 'icônes servies : ' + icones.join(', '));
  const mp = await p.evaluate(() => fetch('/manifest-parents.webmanifest').then(r => r.json()));
  ok(mp.start_url === '/parents' && mp.display === 'standalone', 'manifeste parents : ouvre /parents en fenêtre indépendante');
  const sw = await p.evaluate(() => fetch('/sw.js').then(r => r.status + ' ' + r.headers.get('content-type')));
  ok(/^200 (text|application)\/javascript/.test(sw), 'service worker servi : ' + sw);
  const enreg = await p.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(r => r.active ? r.scope : 'inactif'), new Promise(r => setTimeout(() => r('délai'), 5000))]));
  ok(/\/$/.test(enreg), 'service worker enregistré et actif sur tout le site : ' + enreg);
  await p.reload();
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'la page est prise en charge par le service worker');
  const api = await p.evaluate(() => fetch('/api/getStudentData', { method: 'POST', body: '[]' }).then(r => r.status));
  ok(api !== 0, 'les appels /api passent toujours par le serveur (statut ' + api + ')');
  await c.setOffline(true);
  await p.goto(P('Index.html')).catch(() => {});
  ok(/Pas de connexion internet/.test(await p.locator('body').innerText().catch(() => '')), 'sans réseau : page « hors ligne » claire (au lieu de l\'erreur du navigateur)');
  await c.setOffline(false);
  await p.goto(P('Index.html'));
  ok(await p.locator('#login-classe').isVisible(), 'réseau revenu : l\'appli normale s\'affiche');

  // ---- 2. installation en un clic (Chrome / Edge) ----
  await offrir(p);
  ok(await p.evaluate(() => window.__empeche === true), 'la mini-barre automatique du navigateur est remplacée par l\'invitation de QUIZy');
  await p.waitForTimeout(300);
  ok(await bandeau(p).count() === 0, 'écran de connexion : aucune invitation (seulement après une connexion réussie)');
  await login(p, LEO);
  ok(await visible(bandeau(p)), 'après la connexion : invitation affichée');
  const inv = await p.evaluate(() => {
    const d = document.getElementById('qi-bandeau'); const img = d.querySelector('img');
    return { titre: d.querySelector('strong').textContent, icone: img.getAttribute('src'), charge: img.complete && img.naturalWidth > 0, role: d.getAttribute('role'),
      boutons: [...d.querySelectorAll('button')].map(x => x.textContent), tailles: [...d.querySelectorAll('button')].map(x => Math.min(x.offsetWidth, x.offsetHeight)) };
  });
  ok(inv.titre === 'Installer QUIZy' && inv.icone === '/icon-192.png' && inv.charge, 'invitation : nom et icône de l\'appli');
  ok(JSON.stringify(inv.boutons) === '["Plus tard","Non merci","Installer"]' && inv.tailles.every(t => t >= 48) && inv.role === 'dialog',
    'boutons « Installer », « Plus tard », « Non merci » (cibles ≥ 48 px) : ' + inv.boutons.join(' · '));
  ok(await p.locator('#app').isVisible() && await p.locator('#qi-bandeau').evaluate(d => getComputedStyle(d).position === 'fixed'), 'non bloquant : l\'appli reste utilisable derrière');
  await p.click('#qi-installer');
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__prompts) === 1 && await bandeau(p).count() === 0, 'un clic sur « Installer » ouvre la fenêtre d\'installation du navigateur');
  let e = await etat(p);
  ok(e.installee === true, 'installation acceptée : retenue sur l\'appareil');
  await p.reload(); await p.waitForSelector('#app:not([hidden])');
  await p.waitForTimeout(300);
  ok(await bandeau(p).count() === 0 && await p.evaluate(() => !QuizyInstallation.peutInstaller()), 'appli installée : plus aucune proposition');
  await c.close();

  // ---- 3. « Plus tard » / « Non merci » / refus dans la fenêtre du navigateur ----
  ({ c, p } = await contexte());
  await p.goto(P('Index.html')); await offrir(p); await login(p, LEO);
  await visible(bandeau(p));
  const avant = Date.now();
  await p.click('#qi-plus-tard');
  e = await etat(p);
  ok(await bandeau(p).count() === 0 && e.choix === 'plus-tard' && Math.abs(e.pause - avant - 7 * JOUR) < 60000, '« Plus tard » : fermé, reproposé dans 7 jours');
  await p.reload(); await p.waitForSelector('#app:not([hidden])'); await offrir(p); await p.waitForTimeout(400);
  ok(await bandeau(p).count() === 0, 'visite suivante : pas sollicité de nouveau');
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('quizy-installation')); o.pause = Date.now() - 1000; localStorage.setItem('quizy-installation', JSON.stringify(o)); });
  await p.reload(); await p.waitForSelector('#app:not([hidden])'); await offrir(p);
  ok(await visible(bandeau(p)), 'une semaine plus tard : l\'invitation revient (une fois)');
  await p.click('#qi-non-merci');
  e = await etat(p);
  ok(e.choix === 'non' && Math.abs(e.pause - Date.now() - 90 * JOUR) < 60000, '« Non merci » : plus proposé avant 90 jours');
  await p.evaluate(() => localStorage.removeItem('quizy-installation'));
  await p.reload(); await p.waitForSelector('#app:not([hidden])'); await offrir(p, 'dismissed');
  await visible(bandeau(p)); await p.click('#qi-installer'); await p.waitForTimeout(200);
  e = await etat(p);
  ok(e.choix === 'plus-tard' && !e.installee && await bandeau(p).count() === 0, 'refus dans la fenêtre du navigateur : on n\'insiste pas avant 7 jours');
  await c.close();

  // ---- 4. déjà ouverte comme appli (fenêtre indépendante) : rien ----
  ({ c, p } = await contexte({}, `const mm = window.matchMedia.bind(window);
    window.matchMedia = q => /display-mode: standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q);`));
  await p.goto(P('Index.html')); await offrir(p); await login(p, LEO); await p.waitForTimeout(400);
  ok(await bandeau(p).count() === 0 && await p.evaluate(() => QuizyInstallation.installee()), 'appli ouverte en fenêtre indépendante : aucune invitation');
  await c.close();

  // ---- 5. navigateur sans installation (Firefox ordinateur) : rien, même pas de menu ----
  ({ c, p } = await contexte({ userAgent: UA_FIREFOX }));
  await p.goto(P('Index.html')); await login(p, LEO); await p.waitForTimeout(400);
  ok(await bandeau(p).count() === 0, 'navigateur qui ne sait pas installer : aucune invitation');
  await p.goto(P('admin.html'));
  await p.fill('#admin-pseudo', 'Papa'); await p.fill('#password', 'secret12'); await p.click('#unlock'); await p.waitForSelector('#admin-area:not([hidden])');
  ok(await p.locator('#menu-install').isHidden() && await bandeau(p).count() === 0, 'espace parents : menu « Installer l\'appli » masqué');
  await c.close();

  // ---- 6. iPhone : tutoriel adapté ----
  ({ c, p } = await contexte(Object.assign({}, devices['iPhone 13'])));
  await p.goto(P('Index.html')); await login(p, LEO);
  ok(await visible(bandeau(p)), 'iPhone : invitation après la connexion');
  ok(await p.locator('#qi-installer').innerText() === 'Comment faire ?', 'iPhone : bouton « Comment faire ? » (pas d\'installation automatique sur iOS)');
  await p.waitForTimeout(400); // fin de l'animation d'apparition
  const pos = await p.evaluate(() => {
    const r = document.getElementById('qi-bandeau').getBoundingClientRect(); const s = [...document.querySelectorAll('.sidebar')].find(x => getComputedStyle(x).position === 'fixed');
    return { bas: r.bottom, barre: s ? s.getBoundingClientRect().top : null, gauche: r.left, droite: r.right, larg: innerWidth };
  });
  ok(pos.barre !== null && pos.bas <= pos.barre && pos.gauche >= 0 && pos.droite <= pos.larg, 'téléphone : l\'invitation se pose au-dessus de la barre d\'onglets, sans déborder ' + JSON.stringify(pos));
  await p.click('#qi-installer');
  ok(await visible(p.locator('#qi-tutoriel')), 'tutoriel affiché');
  const tuto = await p.locator('#qi-tutoriel').innerText();
  ok(/Partager/.test(tuto) && /en bas/.test(tuto) && /Sur l.écran d.accueil/.test(tuto) && /Ajouter/.test(tuto), 'tutoriel iPhone : Partager (en bas) → « Sur l\'écran d\'accueil » → « Ajouter »');
  ok(await p.locator('#qi-tutoriel [role=dialog][aria-modal=true]').count() === 1 && await p.locator('#qi-compris').evaluate(x => x.offsetHeight >= 48 && document.activeElement === x),
    'tutoriel accessible : boîte de dialogue, bouton « J\'ai compris » focalisé (≥ 48 px)');
  await p.click('#qi-compris');
  ok(await p.locator('#qi-tutoriel').count() === 0 && (await etat(p)).choix === 'plus-tard', '« J\'ai compris » : fermé, pas reproposé avant une semaine');
  await c.close();

  // ---- 7. iPad (se présente comme un Mac tactile) : bouton Partager en haut ----
  ({ c, p } = await contexte({ userAgent: UA_IPAD, viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: false }, 'Object.defineProperty(Navigator.prototype, "maxTouchPoints", { get: () => 5 });'));
  await p.goto(P('Index.html')); await login(p, LEO);
  await visible(bandeau(p)); await p.click('#qi-installer');
  ok(/en haut à droite/.test(await p.locator('#qi-tutoriel').innerText()), 'tutoriel iPad : bouton Partager en haut à droite');
  await c.close();

  // ---- 8. espace parents : invitation + menu « 📲 Installer l'appli », puis appinstalled ----
  ({ c, p } = await contexte());
  await p.goto(P('admin.html')); await offrir(p);
  await p.fill('#admin-pseudo', 'Papa'); await p.fill('#password', 'secret12'); await p.click('#unlock'); await p.waitForSelector('#admin-area:not([hidden])');
  ok(await visible(bandeau(p)), 'espace parents : invitation après la connexion');
  await p.click('#qi-plus-tard');
  await p.click('#acct-btn');
  ok(await p.locator('#menu-install').isVisible(), 'après « Plus tard » : l\'installation reste possible depuis le menu du compte');
  await p.click('#menu-install'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__prompts) === 1, 'menu « Installer l\'appli » : fenêtre d\'installation du navigateur en un clic');
  await p.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  ok((await etat(p)).installee === true && await p.locator('#menu-install').isHidden(), 'installée (événement appinstalled) : menu masqué, plus de proposition');
  await c.close();

  // ---- 9. stockage bloqué : aucune erreur, proposé une seule fois par visite ----
  ({ c, p } = await contexte({}, 'Object.defineProperty(window, "localStorage", { get() { throw new Error("bloqué"); } });'));
  await p.goto(P('Index.html')); await offrir(p); await login(p, LEO);
  ok(await visible(bandeau(p)), 'stockage bloqué : l\'invitation fonctionne');
  await p.click('#qi-plus-tard');
  await p.click('#logout'); await login(p, LEO); await offrir(p); await p.waitForTimeout(400);
  ok(await bandeau(p).count() === 0, 'stockage bloqué : pas reproposé pendant la même visite');
  await c.close();

  // ---- 10. tests automatiques : QUIZY_INSTALLATION = false coupe tout ----
  c = await b.newContext(); await install(c, w); p = await c.newPage();
  await p.goto(P('Index.html')); await offrir(p); await login(p, LEO); await p.waitForTimeout(400);
  ok(await bandeau(p).count() === 0 && await p.evaluate(() => window.__empeche === false), 'désactivée (QUIZY_INSTALLATION = false) : rien n\'est intercepté');
  await c.close();

  ok(errs.length === 0, 'aucune erreur JavaScript : ' + errs.join(' | '));
  await b.close();
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
