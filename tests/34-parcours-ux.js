// cible: cloudflare
// Menu 👤 → « 🧭 Parcours UX » (administrateur principal seulement) : 2 boutons, diagrammes Mermaid de l'enfant et du parent,
// zoom, légende ; sans réseau vers le CDN, le texte du diagramme s'affiche à la place. Mermaid est servi en local pour le test.
const { chromium } = require('playwright');
const { makeWorldCf, install, ok, summary, page, CF } = require('./harness');
const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';

(async () => {
  const w = makeWorldCf({ ADMIN_PASSWORD: 'secret12' });
  const ADM = { pseudo: 'Papa', password: 'secret12' };
  w.run('adminData', ADM);
  const code = w.run('setInviteCode', ADM, 'new').code;
  w.run('createFamily', code, { famille: 'Dupont', pseudo: 'Dupont', password: 'motdepasse1' });
  const b = await chromium.launch(); const errs = [];
  const ctx = async (vp, mermaid = true) => {
    const c = await b.newContext({ viewport: vp }); await install(c, w);
    await c.route(MERMAID, r => (mermaid ? r.fulfill({ path: CF + 'node_modules/mermaid/dist/mermaid.min.js', contentType: 'text/javascript' }) : r.abort()));
    return c;
  };
  const connect = async (p, pseudo, pw) => { await p.goto(page('admin.html', 'cloudflare')); await p.fill('#admin-pseudo', pseudo); await p.fill('#password', pw); await p.click('#unlock'); await p.waitForSelector('#admin-area:not([hidden])'); };

  // ---- administrateur, ordinateur ----
  const c = await ctx({ width: 1300, height: 900 });
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await connect(p, 'Papa', 'secret12');
  await p.click('#acct-btn');
  const items = await p.locator('#acct-menu .menu-item:visible').allInnerTexts();
  ok(items.indexOf('🧭 Parcours UX') === items.indexOf('🔑 Changer le mot de passe') + 1, 'menu 👤 : « 🧭 Parcours UX » juste sous « Changer le mot de passe » : ' + items.join(' · '));
  ok(!(await p.evaluate(u => [...document.scripts].some(s => s.src === u), MERMAID)), 'Mermaid n\'est pas chargé tant qu\'on n\'ouvre pas le panneau');
  await p.click('#menu-ux');
  ok(await p.locator('#ux-panel').isVisible() && JSON.stringify(await p.locator('.ux-btn').allInnerTexts()) === '["🎒 Parcours UX de l\'enfant","👨‍👩‍👧 Parcours UX du parent"]', 'panneau ouvert : 2 boutons « Parcours UX de l\'enfant » et « … du parent »');
  for (const [k, titre, mots] of [['enfant', "🎒 Parcours de l'enfant", ['Se connecter', 'Qui es-tu', 'Je découvre', 'Je teste', 'Je corrige', 'Les 5 niveaux', 'Maîtrisée', 'Flashcards']],
    ['parent', '👨‍👩‍👧 Parcours du parent', ['Entrer', 'Ajouter un enfant', 'Avec une IA', 'Suivre les révisions', 'Inviter une famille', 'Exporter les données']]]) {
    await p.click('#ux-' + k);
    await p.waitForSelector('#ux-diagramme svg', { timeout: 20000 });
    await p.waitForFunction(t => document.querySelector('#ux-diagramme svg') && document.querySelector('#ux-titre').textContent === t && document.querySelector('#ux-diagramme').textContent.length > 50, titre);
    const txt = await p.locator('#ux-diagramme').innerText();
    ok(mots.every(m => txt.includes(m)), k + ' : diagramme dessiné (' + mots.join(', ') + ')');
    ok((await p.locator('#ux-' + k).getAttribute('aria-pressed')) === 'true' && (await p.locator('#ux-diagramme svg').getAttribute('aria-label')) === titre && (await p.locator('#ux-status').innerText()) === '', k + ' : bouton enfoncé, dessin nommé pour les lecteurs d\'écran, pas de message d\'erreur');
    const couleurs = await p.locator('#ux-diagramme .node').count();
    ok(couleurs >= 15 && (await p.locator('#ux-diagramme .cluster').count()) >= 5, k + ' : ' + couleurs + ' cases réparties en étapes numérotées');
  }
  const w0 = await p.evaluate(() => document.querySelector('#ux-diagramme svg').getBoundingClientRect().width);
  await p.click('#ux-plus'); await p.click('#ux-plus');
  const w1 = await p.evaluate(() => document.querySelector('#ux-diagramme svg').getBoundingClientRect().width);
  await p.click('#ux-moins'); await p.click('#ux-moins'); await p.click('#ux-moins');
  const w2 = await p.evaluate(() => document.querySelector('#ux-diagramme svg').getBoundingClientRect().width);
  ok(w1 > w0 * 1.4 && w2 < w0, 'zoom ➕ / ➖ : ' + Math.round(w0) + ' → ' + Math.round(w1) + ' → ' + Math.round(w2) + ' px');
  ok((await p.locator('.ux-legende .lg').count()) === 7, 'légende des couleurs (7)');
  await p.click('#ux-close');
  ok(await p.locator('#ux-panel').isHidden(), '« ✕ Fermer » referme le panneau');
  await p.click('#acct-btn'); await p.click('#menu-ux'); await p.click('#ux-enfant'); await p.waitForSelector('#ux-diagramme svg');
  await p.click('#acct-btn'); await p.click('#lock'); await p.waitForSelector('#admin-area', { state: 'hidden' });
  ok(await p.locator('#ux-panel').isHidden() && (await p.locator('#ux-diagramme').innerHTML()) === '', 'déconnexion : panneau fermé et vidé');

  // ---- téléphone : diagramme en colonne ----
  const t = await (await ctx({ width: 390, height: 844 })).newPage(); t.on('pageerror', e => errs.push(e.message));
  await connect(t, 'Papa', 'secret12'); await t.click('#acct-btn'); await t.click('#menu-ux'); await t.click('#ux-enfant');
  await t.waitForSelector('#ux-diagramme svg', { timeout: 20000 });
  const dims = await t.evaluate(() => { const r = document.querySelector('#ux-diagramme svg').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  ok(dims.h > dims.w * 2 && !(await t.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'téléphone : parcours en colonne (' + Math.round(dims.w) + '×' + Math.round(dims.h) + '), la page ne déborde pas');
  const zb = await t.locator('#ux-plus').boundingBox();
  ok(zb.width >= 48 && zb.height >= 48, 'boutons de zoom : 48 px au moins');

  // ---- sans réseau vers le CDN : le texte du diagramme ----
  const n = await (await ctx({ width: 1000, height: 800 }, false)).newPage();
  await connect(n, 'Papa', 'secret12'); await n.click('#acct-btn'); await n.click('#menu-ux'); await n.click('#ux-parent');
  await n.waitForSelector('#ux-status.err');
  ok((await n.locator('.ux-source').innerText()).startsWith('flowchart TB') && (await n.locator('#ux-status').innerText()).includes('texte du diagramme'), 'CDN injoignable : message clair et texte Mermaid affiché');

  // ---- famille invitée : pas de Parcours UX ----
  const f = await (await ctx({ width: 1000, height: 800 })).newPage(); f.on('pageerror', e => errs.push(e.message));
  await connect(f, 'Dupont', 'motdepasse1'); await f.click('#acct-btn');
  ok(await f.locator('#menu-ux').isHidden(), 'famille invitée : pas de « Parcours UX » dans le menu');

  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close();
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
