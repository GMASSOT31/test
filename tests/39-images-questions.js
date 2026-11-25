// cible: cloudflare
// Images des questions : envoi (/media/upload, parents seulement, formats vérifiés, figures SVG sans script ni lien), lecture
// (/media/<id>), validation dans la leçon (image avec l'énoncé, image avec la correction, suggestion de l'IA), affichage côté
// élève (énoncé, correction, carte « À retenir », agrandissement), éditeur des parents (ajout, retrait), demande à l'IA et
// lecture de sa réponse (figure dessinée → image, image à ajouter → rappel), export / import avec les images.
const { chromium } = require('playwright');
const { makeWorldCf, install, ok, summary, page, login, LEO } = require('./harness');
const P = n => page(n, 'cloudflare');
const ADM = { pseudo: 'Papa', password: 'secret12' };
const SVG_OK = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 120'><rect width='200' height='120' fill='white'/><polygon points='20,100 180,100 60,20' fill='none' stroke='black' stroke-width='2'/><text x='10' y='115' font-size='14'>A</text></svg>";

(async () => {
  const w = makeWorldCf({ ADMIN_PASSWORD: 'secret12' });
  w.run('adminData', ADM);
  w.run('saveStudent', ADM, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  const b = await chromium.launch();
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  await install(ctx, w);
  const a = await ctx.newPage(); a.on('pageerror', e => errs.push(e.message));
  await a.goto(P('admin.html'));
  // une vraie image PNG (dessinée dans le navigateur) pour les envois
  const pngB64 = await a.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 60; c.height = 40;
    const x = c.getContext('2d'); x.fillStyle = '#e33'; x.fillRect(0, 0, 60, 40); x.fillStyle = '#33e'; x.fillRect(10, 10, 20, 20);
    return c.toDataURL('image/png').split(',')[1];
  });
  const upload = body => a.evaluate(bd => fetch('/media/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bd) }).then(r => r.json()), body);

  // ---- 1. envoi et lecture ----
  let r = await upload({ type: 'image/png', data: pngB64 });
  ok(r.error && !r.ok, 'envoi sans identifiants : refusé (' + r.error + ')');
  r = await upload({ cred: { pseudo: 'Papa', password: 'faux-mot-2' }, type: 'image/png', data: pngB64 });
  ok(!!r.error, 'envoi avec un mauvais mot de passe : refusé');
  r = await upload({ cred: ADM, type: 'image/png', data: pngB64 });
  const png = r.value && r.value.src;
  ok(/^\/media\/[0-9a-f]{32}$/.test(png || ''), 'photo envoyée par un parent : adresse /media/<identifiant> (' + png + ')');
  const lu = await a.evaluate(u => fetch(u).then(async x => ({ s: x.status, t: x.headers.get('content-type'), c: x.headers.get('cache-control'), csp: x.headers.get('content-security-policy'), n: (await x.arrayBuffer()).byteLength })), png);
  ok(lu.s === 200 && lu.t === 'image/png' && /immutable/.test(lu.c) && /sandbox/.test(lu.csp) && lu.n > 50, 'image servie telle quelle (type, cache long, CSP sandbox) : ' + JSON.stringify(lu));
  ok((await a.evaluate(() => fetch('/media/' + '0'.repeat(32)).then(x => x.status))) === 404, 'identifiant inconnu : 404');
  r = await upload({ cred: ADM, type: 'image/jpeg', data: pngB64 });
  ok(/valide/.test(r.error || ''), 'contenu qui ne correspond pas au format annoncé : refusé');
  r = await upload({ cred: ADM, type: 'application/pdf', data: pngB64 });
  ok(/Format/.test(r.error || ''), 'format non image : refusé');
  for (const [bad, why] of [[SVG_OK.replace('</svg>', '<script>alert(1)</script></svg>'), 'script'],
    [SVG_OK.replace("<rect", "<rect onclick='x()'"), 'gestionnaire on…'],
    [SVG_OK.replace('</svg>', "<image href='https://exemple.com/a.png'/></svg>"), 'image extérieure'],
    [SVG_OK.replace("fill='white'", "fill='url(https://exemple.com/x)'"), 'url() extérieure'],
    ['<html><body>pas une figure</body></html>', 'pas un SVG']]) {
    r = await upload({ cred: ADM, type: 'image/svg+xml', data: bad });
    ok(!!r.error, 'figure SVG refusée (' + why + ') : ' + r.error);
  }
  r = await upload({ cred: ADM, type: 'image/svg+xml', data: SVG_OK });
  const svg = r.value && r.value.src;
  const svgLu = await a.evaluate(u => fetch(u).then(async x => ({ t: x.headers.get('content-type'), txt: await x.text() })), svg);
  ok(svgLu.t === 'image/svg+xml' && svgLu.txt.includes('<polygon'), 'figure SVG simple acceptée et servie');

  // ---- 2. leçon : validation des images ----
  const base = { titre: 'Géométrie', matiere: 'Maths', pour: ['leo'], questions: [
    { question: 'Quel est ce polygone ?', options: ['Un triangle', 'Un carré'], correct: 0, explication: 'Il a trois côtés.',
      image: { src: svg, alt: 'Un triangle ABC' }, imageReponse: { src: png, alt: 'Le triangle colorié' } },
    { question: 'Combien de côtés a un carré ?', reponses: ['4', 'quatre'], imageSuggeree: { moment: 'reponse', description: 'Un carré et ses 4 côtés' } }] };
  let t = w.try('saveQuiz', ADM, { ...base, questions: [{ ...base.questions[0], image: { src: 'https://exemple.com/a.png' } }] });
  ok(/image invalide/.test(t.err || ''), 'image extérieure dans une question : refusée (' + t.err + ')');
  const qid = w.run('saveQuiz', ADM, base).id;
  const stored = w.run('adminData', ADM).quizzes.find(q => q.id === qid);
  const [q1, q2] = stored.questions;
  ok(q1.image.src === svg && q1.image.alt === 'Un triangle ABC' && q1.imageReponse.src === png && !q1.imageSuggeree,
    'question enregistrée avec son image (énoncé) et son image (correction)');
  ok(q2.imageSuggeree && q2.imageSuggeree.moment === 'reponse' && !q2.image, 'image suggérée gardée comme rappel tant qu\'elle n\'est pas ajoutée');
  const eleve = w.run('getStudentData', '5B', 'Léo', '1234').quizzes.find(q => q.id === qid);
  ok(eleve.questions[0].image.src === svg && eleve.questions[0].imageReponse.src === png, 'l\'élève reçoit les images de la question');

  // ---- 3. côté élève : énoncé, correction, carte « À retenir », agrandissement ----
  const e = await ctx.newPage(); e.on('pageerror', x => errs.push(x.message));
  await e.goto(P('Index.html')); await login(e, LEO);
  await e.evaluate(i => { const z = QUIZZES.find(q => q.id === i); startSession({ quiz: z }); S.tasks = [{ quiz: z, q: z.questions[0], stage: 'carte' }, { quiz: z, q: z.questions[0], stage: 'qcm' }]; S.i = 0; showTask(); }, qid);
  const carte = await e.evaluate(() => ({ q: [...document.querySelectorAll('.face-text img')].map(i => i.getAttribute('src')), r: [...document.querySelectorAll('.face-expl img')].map(i => i.getAttribute('src')) }));
  ok(carte.q[0] === svg && carte.r[0] === png, 'carte « À retenir » : image de l\'énoncé et image de la correction');
  await e.click('.actions .btn');
  await e.waitForSelector('h3.question img');
  const enonce = await e.evaluate(() => { const i = document.querySelector('h3.question img'); return { src: i.getAttribute('src'), alt: i.alt, charge: i.complete && i.naturalWidth > 0, expl: getComputedStyle(document.querySelector('.explication')).display }; });
  ok(enonce.src === svg && enonce.alt === 'Un triangle ABC', 'question : image avec l\'énoncé, décrite pour les lecteurs d\'écran');
  await e.waitForFunction(() => { const i = document.querySelector('h3.question img'); return i.complete && i.naturalWidth > 0; });
  ok(true, 'l\'image de l\'énoncé se charge');
  ok(enonce.expl === 'none', 'avant la réponse : correction (et son image) cachée');
  await e.click('h3.question .img-zoom');
  ok(await e.locator('.zoom-overlay img').isVisible(), 'toucher l\'image : elle s\'affiche en grand');
  await e.keyboard.press('Escape');
  ok(await e.locator('.zoom-overlay').count() === 0, 'Échap : l\'agrandissement se ferme');
  await e.click('.option >> text=Un triangle');
  await e.waitForSelector('.explication img', { state: 'visible' });
  ok((await e.locator('.explication img').getAttribute('src')) === png && /trois côtés/.test(await e.locator('.explication').innerText()),
    'après la réponse : explication + image de la correction');

  // ---- 4. éditeur des parents : ajouter, décrire, retirer ----
  await a.fill('#admin-pseudo', 'Papa'); await a.fill('#password', 'secret12'); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])');
  await a.click('#tab-quiz-liste'); await a.click('#tab-quiz-ajout'); await a.click('#mode-manual');
  await a.fill('#titre', 'Frises'); await a.fill('.question .q-text', 'En quelle année commence la Révolution ?');
  await a.fill('.question .opt-text >> nth=0', '1789'); await a.fill('.question .opt-text >> nth=1', '1815');
  await a.click('.question .q-images summary');
  const slotQ = a.locator('.question .q-img-slot[data-moment="question"]'), slotR = a.locator('.question .q-img-slot[data-moment="reponse"]');
  ok(await slotQ.locator('.btn', { hasText: 'Ajouter une image' }).isVisible() && await slotR.isVisible(), 'éditeur : deux emplacements (avec la question, avec la correction)');
  await slotQ.locator('input[type=file]').setInputFiles({ name: 'frise.png', mimeType: 'image/png', buffer: Buffer.from(pngB64, 'base64') });
  await slotQ.locator('.status.ok').waitFor();
  ok(await slotQ.locator('img').isVisible() && await slotQ.locator('.q-img-alt').isVisible(), 'photo choisie : réduite, envoyée, aperçu affiché');
  await slotQ.locator('.q-img-alt').fill('Frise de 1789 à 1815');
  await slotR.locator('input[type=file]').setInputFiles({ name: 'carte.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG_OK) });
  await slotR.locator('.status.ok').waitFor();
  await slotR.locator('.btn', { hasText: 'Retirer' }).click();
  ok(await slotR.locator('img').isHidden(), '« Retirer » : l\'image de la correction est enlevée');
  await a.click('#save-quiz'); await a.waitForSelector('#quizlist-status.ok');
  const frise = w.run('adminData', ADM).quizzes.find(q => q.titre === 'Frises').questions[0];
  ok(/^\/media\/[0-9a-f]{32}$/.test(frise.image.src) && frise.image.alt === 'Frise de 1789 à 1815' && !frise.imageReponse, 'leçon enregistrée : image + description, sans l\'image retirée');
  const friseType = await a.evaluate(u => fetch(u).then(x => x.headers.get('content-type')), frise.image.src);
  ok(friseType === 'image/jpeg', 'photo réduite en JPEG avant l\'envoi (' + friseType + ')');

  // ---- 5. demande à l'IA et lecture de sa réponse ----
  await a.click('#tab-quiz-liste'); await a.click('#tab-quiz-ajout'); await a.click('#mode-ia');
  const prompt = await a.inputValue('#ia-prompt');
  ok(/« illustration »/.test(prompt) && /moment/.test(prompt) && /<svg xmlns=/.test(prompt) && /je l'ajouterai moi-même/.test(prompt) && /16\. Longueur maximale/.test(prompt),
    'demande à l\'IA : règle « illustration » (figure SVG ou image à ajouter) et exemple, règles suivantes renumérotées');
  const reponseIa = JSON.stringify({ titre: 'Maths : triangles', matiere: 'Maths', emoji: '📐', questions: [
    { question: 'Combien mesure l\'angle C ?', options: ['70°', '60°'], bonne_reponse: '70°', illustration: { moment: 'question', description: 'Triangle avec 50° et 60°', svg: SVG_OK } },
    { question: 'Où se trouve Paris ?', options: ['En France', 'En Italie'], bonne_reponse: 'En France', illustration: { moment: 'correction', description: 'Carte de France avec Paris' } },
    { question: 'Figure piégée ?', options: ['Oui', 'Non'], bonne_reponse: 'Non', illustration: { moment: 'question', description: 'Un carré', svg: SVG_OK.replace('</svg>', '<script>x()</script></svg>') } }] });
  await a.click('#ia-next-1'); await a.fill('#ia-answer', '```json\n' + reponseIa + '\n```'); await a.waitForSelector('#ia-parse-status.ok'); await a.click('#ia-next-2');
  await a.click('#ia-preview-sum');
  const revue = await a.evaluate(() => ({ figs: document.querySelectorAll('#ia-questions .ia-img').length, txt: document.getElementById('ia-summary').innerText + ' ' + document.getElementById('ia-questions').innerText }));
  ok(revue.figs === 2 && /Image à ajouter toi-même : Carte de France/.test(revue.txt) && /2 figures dessinées/.test(revue.txt), 'vérification : figures de l\'IA visibles, image à ajouter signalée');
  await a.click('#ia-save'); await a.waitForSelector('#quizlist-status.ok, #prog-status.ok');
  const iaQ = w.run('adminData', ADM).quizzes.find(q => q.titre === 'Maths : triangles').questions;
  ok(/^\/media\//.test(iaQ[0].image && iaQ[0].image.src) && iaQ[0].image.alt === 'Triangle avec 50° et 60°', 'figure de l\'IA enregistrée comme image de la question');
  ok(iaQ[1].imageSuggeree && iaQ[1].imageSuggeree.moment === 'reponse' && !iaQ[1].imageReponse, 'image décrite seulement : rappel « à ajouter » sur la correction');
  ok(!iaQ[2].image && iaQ[2].imageSuggeree && iaQ[2].imageSuggeree.description === 'Un carré', 'figure dangereuse refusée : la leçon est créée quand même, l\'image devient une suggestion');
  ok(/1 figure de l'IA refusée/.test(await a.locator('#quizlist-status, #prog-status').first().innerText().catch(() => '') + await a.evaluate(() => (document.querySelector('#quizlist-status.ok') || document.querySelector('#prog-status.ok') || {}).textContent || '')), 'le parent est prévenu qu\'une figure a été refusée');
  // « Retoucher » : la suggestion s'affiche dans l'éditeur
  await a.click('#tab-quiz-liste'); await a.click('#tab-quiz-ajout'); await a.click('#mode-ia'); await a.click('#ia-next-1');
  await a.fill('#ia-answer', '```json\n' + reponseIa + '\n```'); await a.waitForSelector('#ia-parse-status.ok'); await a.click('#ia-next-2');
  await a.click('#ia-edit'); await a.waitForSelector('#pane-quiz-ajout:not([hidden])');
  const ed = await a.evaluate(() => [...document.querySelectorAll('#questions .question')].slice(0, 3).map(b => ({
    img: !!(b.querySelector('.q-img-slot[data-moment="question"] img:not([hidden])')), sugg: [...b.querySelectorAll('.q-img-sugg:not([hidden])')].map(x => x.textContent).join('') })));
  ok(ed[0].img && /Carte de France/.test(ed[1].sugg), 'Retoucher : figure déjà en place, suggestion « 💡 Image suggérée par l\'IA » affichée');

  // ---- 6. export / import : les images voyagent avec les données ----
  const exp = w.core.call('backupData', [ADM]).value;
  ok(exp.medias && exp.medias[svg.slice(7)] && exp.medias[png.slice(7)] && exp.medias[png.slice(7)].type === 'image/png', 'export complet : les images sont incluses');
  const w2 = makeWorldCf({}, { env: { INSTALL_CODE: 'CODE-1' } });
  const inst = w2.core.install({ code: 'CODE-1', data: JSON.parse(JSON.stringify(exp)), pseudo: 'Papa', password: 'secret12' });
  const res2 = await w2.core.handle(new Request('http://x' + png));
  ok(inst.images === Object.keys(exp.medias).length && res2.status === 200 && res2.headers.get('content-type') === 'image/png', 'installation depuis l\'export : images restaurées (' + inst.images + ')');
  const exp2 = JSON.parse(JSON.stringify(exp)); exp2.medias[png.slice(7)].data = 'pas-du-base64!';
  let erreur = ''; try { w2.core.importData({ cred: ADM, data: exp2 }); } catch (x) { erreur = x.message; }
  ok(/illisible|valide/.test(erreur), 'fichier abîmé (image) : import refusé, rien n\'est remplacé (' + erreur + ')');

  ok(errs.length === 0, 'aucune erreur JavaScript : ' + errs.join(' | '));
  await b.close();
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
