// cible: cloudflare
// Nettoyage automatique des images (choix de l'utilisateur, 25/11/2026) : dès qu'un envoi ferait atteindre 90 % de l'espace
// des images, effacer d'abord les images inutilisées (les plus anciennes d'abord), puis les plus anciennes encore utilisées,
// jusqu'à redescendre à 80 % ; les images de moins de 24 h pas encore enregistrées passent en dernier. Côté pages : une image
// effacée disparaît sans cadre vide chez l'enfant ; l'éditeur prévient le parent. (Quota réduit à 10 000 octets pour le test.)
const { chromium } = require('playwright');
const { makeWorldCf, install, ok, summary, page, login, LEO } = require('./harness');
const P = n => page(n, 'cloudflare');
const ADM = { pseudo: 'Papa', password: 'secret12' };
const DAY = 86400000;
// vraie image PNG (1 × 1 pixel) complétée jusqu'à n octets : le navigateur l'affiche, le serveur compte n octets
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const png = n => Buffer.concat([PNG1, Buffer.alloc(Math.max(0, n - PNG1.length))]).toString('base64');

function monde() {
  const w = makeWorldCf({ ADMIN_PASSWORD: 'secret12' }, { env: { MEDIA_QUOTA_BYTES: '10000' } });
  w.run('adminData', ADM);
  w.run('saveStudent', ADM, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  w.up = n => { const r = w.core.uploadMedia({ cred: ADM, type: 'image/png', data: png(n) }); w.advance(1000); return r; };
  w.id = src => src.slice(7);
  w.exists = src => w.sql.exec('SELECT COUNT(*) AS n FROM media WHERE id = ?', w.id(src)).toArray()[0].n === 1;
  w.total = () => Number(w.sql.exec('SELECT COALESCE(SUM(size), 0) AS n FROM media').toArray()[0].n);
  w.lecon = (titre, srcs) => w.run('saveQuiz', ADM, { titre, pour: ['leo'], questions: srcs.map((src, i) => ({ question: 'Question ' + i + ' ?', options: ['Oui', 'Non'], correct: 0, image: { src, alt: 'Image ' + i } })) }).id;
  return w;
}

(async () => {
  // ---- 1. sous 90 % : rien n'est effacé ; à 90 % : les inutilisées les plus anciennes d'abord ----
  let w = monde();
  const A = w.up(2000).src; w.advance(DAY);
  const B = w.up(2000).src; w.advance(DAY);
  const C = w.up(2000).src; w.advance(DAY);
  w.lecon('Utilisées', [B, C]);
  const D = w.up(2000); w.advance(2 * DAY);
  ok(D.effacees.unused === 0 && D.effacees.used === 0 && w.total() === 8000 && w.exists(A), 'sous 90 % (8 000 / 10 000) : aucune image effacée');
  const E = w.up(1500);
  ok(E.effacees.unused === 1 && E.effacees.used === 0 && !w.exists(A) && w.exists(B) && w.exists(C) && w.exists(D.src) && w.exists(E.src),
    'envoi qui atteint 90 % : la plus ancienne image INUTILISÉE est effacée, les images des leçons restent');
  ok(w.total() <= 8000, 'après le nettoyage, on est redescendu sous 80 % (' + w.total() + ' octets)');
  ok((await w.core.handle(new Request('http://x' + A))).status === 404, 'image effacée : 404');

  // ---- 2. plus assez d'inutilisées : les plus anciennes encore utilisées ----
  w = monde();
  const X = w.up(2900).src; w.advance(DAY);
  const Y = w.up(2900).src; w.advance(DAY);
  const Z = w.up(2900).src; w.advance(DAY);
  const qid = w.lecon('Trois images', [X, Y, Z]);
  const W = w.up(1000);
  ok(W.effacees.used === 1 && !w.exists(X) && w.exists(Y) && w.exists(Z) && w.exists(W.src),
    'toutes utilisées : la plus ancienne (même utilisée) est effacée, une seule suffit');
  const q = w.run('getStudentData', '5B', 'Léo', '1234').quizzes.find(x => x.id === qid);
  ok(q && q.questions.length === 3 && q.questions[0].question === 'Question 0 ?', 'la leçon reste intacte (texte des questions), seule l\'image a disparu');

  // ---- 3. image récente pas encore enregistrée : épargnée avant les images utilisées ----
  w = monde();
  const U1 = w.up(3000).src; w.advance(DAY);
  const U2 = w.up(3000).src; w.advance(DAY);
  w.lecon('Deux images', [U1, U2]);
  const R = w.up(2500).src;   // envoyée à l'instant, pas encore dans une leçon (éditeur ouvert)
  const S = w.up(1000);
  ok(w.exists(R) && !w.exists(U1) && S.effacees.used === 1, 'image envoyée depuis moins de 24 h, pas encore enregistrée : gardée, l\'ancienne image utilisée part avant elle');

  // ---- 4. adresse d'image coupée entre deux morceaux de données : reconnue comme utilisée ----
  w = monde();
  const K = w.up(3000).src; w.advance(DAY);
  const L = w.up(3000).src; w.advance(DAY);
  const id = w.id(K);
  w.props['quiz_decoupe'] = JSON.stringify({ _chunks: 2 });
  w.props['quiz_decoupe~0'] = '{"titre":"Découpée","questions":[{"image":{"src":"/media/' + id.slice(0, 10);
  w.props['quiz_decoupe~1'] = id.slice(10) + '"}}]}';
  w.up(3500);
  ok(w.exists(K) && !w.exists(L), 'leçon découpée en morceaux : son image est bien vue comme utilisée (c\'est l\'inutilisée qui part)');

  // ---- 5. pages : image effacée chez l'enfant et dans l'éditeur ----
  w = monde();
  const G = w.up(3000).src; w.advance(DAY);
  const H2 = w.up(3000).src; w.advance(DAY);
  const qid2 = w.lecon('Photos', [G, H2]);
  w.sql.exec('DELETE FROM media WHERE id = ?', w.id(G));   // comme après un nettoyage
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await install(ctx, w);
  const e = await ctx.newPage(); e.on('pageerror', x => errs.push(x.message));
  await e.goto(P('Index.html')); await login(e, LEO);
  await e.evaluate(i => { const z = QUIZZES.find(q => q.id === i); startSession({ quiz: z }); S.tasks = [{ quiz: z, q: z.questions[0], stage: 'qcm' }]; S.i = 0; showTask(); }, qid2);
  await e.waitForFunction(() => !document.querySelector('h3.question img'), null, { timeout: 5000 }).catch(() => {});
  ok(await e.locator('h3.question img, h3.question .img-zoom').count() === 0 && (await e.locator('h3.question').innerText()).includes('Question 0'),
    'élève : image effacée → la question s\'affiche sans cadre vide');
  const a = await ctx.newPage(); a.on('pageerror', x => errs.push(x.message));
  await a.goto(P('admin.html'));
  await a.fill('#admin-pseudo', 'Papa'); await a.fill('#password', 'secret12'); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])');
  await a.evaluate(i => loadQuiz(DATA.quizzes.find(x => x.id === i)), qid2);
  const slot0 = a.locator('#questions .question').nth(0).locator('.q-img-slot[data-moment="question"]');
  await slot0.locator('.status.err').waitFor({ timeout: 5000 }).catch(() => {});
  ok(/effacée automatiquement/.test(await slot0.locator('.status').innerText()), 'éditeur : le parent est prévenu que l\'image a été effacée');
  const autres = await a.locator('#questions .question').nth(1).locator('.status').allInnerTexts();
  ok(!autres.some(t => /effacée/.test(t)), 'éditeur : les images encore présentes ne sont pas signalées ' + JSON.stringify(autres));
  // envoi depuis l'éditeur qui déclenche un nettoyage : message au parent
  w.sql.exec('DELETE FROM media'); const v1 = w.up(4450).src; w.advance(2 * DAY); w.up(4450); w.advance(2 * DAY);
  await a.locator('#questions .question').nth(1).locator('.q-img-slot[data-moment="reponse"] input[type=file]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(png(1500), 'base64') });
  const st = a.locator('#questions .question').nth(1).locator('.q-img-slot[data-moment="reponse"] .status');
  await a.waitForFunction(el => /Image ajoutée|rror|❌/.test(el.textContent), await st.elementHandle(), { timeout: 8000 }).catch(() => {});
  ok(/ancienne image a été effacée automatiquement/.test(await st.innerText()) && !w.exists(v1), 'envoi depuis l\'éditeur : « Espace presque plein : 1 ancienne image a été effacée automatiquement » — ' + await st.innerText());
  ok(errs.length === 0, 'aucune erreur JavaScript : ' + errs.join(' | '));
  await b.close();
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
