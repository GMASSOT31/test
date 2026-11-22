// cible: cloudflare
const { chromium } = require('playwright');
const { makeWorld, install, LEO, PW, page, ok, summary } = require('./harness');

(async () => {
  const w = makeWorld();
  w.run('saveStudent', PW, LEO);
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 360, height: 720 } });
    await install(ctx, w, { profils: true });
    const p = await ctx.newPage();
    let attempts = 0, offline = false;
    await p.route('**/api/getStudentData', async route => {
      attempts++;
      if (offline || attempts === 1) await route.abort('failed');
      else if (attempts === 2) await route.fulfill({ status: 503, body: '{"error":"Indisponible"}', contentType: 'application/json' });
      else await route.continue();
    });
    await p.goto(page('Index.html'));
    await p.fill('#login-classe', LEO.classe);
    await p.fill('#login-pseudo', LEO.pseudo);
    await p.fill('#login-pin', LEO.pin);
    await p.click('#login-btn');
    await p.locator('#app:not([hidden])').waitFor();
    ok(attempts === 3 && await p.locator('#login-pin').inputValue() === '',
      'deux pannes transitoires : une seule saisie et le PIN est effacé après connexion');

    await p.click('#logout');
    await p.reload();
    await p.locator('#who .qp-profil').click();
    offline = true;
    await p.fill('#login-pin', LEO.pin);
    await p.click('#login-btn');
    await p.getByText('Connexion interrompue.', { exact: false }).waitFor();
    ok(attempts === 6 && await p.locator('#login-pin').inputValue() === LEO.pin &&
      await p.locator('#login-profil').isVisible() && await p.locator('#login-profil-retrait').isHidden(),
    'panne persistante : le profil et la saisie sont conservés pour réessayer');

    offline = false;
    await p.fill('#login-pin', '9999');
    await p.click('#login-btn');
    await p.getByText('PIN incorrect, ou ce profil', { exact: false }).waitFor();
    ok(attempts === 7 && await p.locator('#login-pin').inputValue() === '',
      'PIN réellement refusé : pas de nouvel essai automatique et le champ est effacé');
    await p.fill('#login-pin', LEO.pin);
    await p.click('#login-btn');
    await p.locator('#app:not([hidden])').waitFor();
    ok(attempts === 8, 'le bon PIN fonctionne dès le premier envoi quand le réseau répond');
  } finally {
    await b.close();
  }
  process.exit(summary() ? 1 : 0);
})().catch(error => { console.log('ECHEC:', error.message); process.exit(1); });
