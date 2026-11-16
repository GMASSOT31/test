// cible: cloudflare
// Transfert Apps Script → Cloudflare : export (backupData) de l'appli actuelle, puis « Installer » dans QUIZy sur Cloudflare.
// Vérifications côte à côte : mêmes enfants, leçons, attributions, progressions, familles ; PIN et mots de passe des familles
// valables tels quels ; morceaux ~0, ~1… recollés ; nouvel import ; sécurité de l'installation ; écran « Installer ».
const { chromium } = require('playwright');
const { makeWorldAs, makeWorldCf, ok, summary, page } = require('./harness');
const DAY = 86400000;
// Différences voulues de la version Cloudflare (partage des leçons, 16/11/2026) : champs de partage en plus, et une famille ne
// voit que les leçons fournies partagées (au départ : celles déjà données à ses enfants)
const clean = o => {
  const c = JSON.parse(JSON.stringify(o)); delete c.now; if (c.stockage) delete c.stockage.octets;
  delete c.partagees; delete c.leconsFamilles;
  (c.builtins || []).forEach(b => delete b.familles); (c.quizzes || []).forEach(q => delete q.familles);
  if (c.moi && !c.moi.owner && c.builtins) c.builtins = c.builtins.filter(b => b.pour.length);
  // questions de synthèse (16/11/2026) : historique des synthèses de l'élève et résumé pour le parent
  Object.values(c.srs || {}).forEach(r => delete r.syn);
  Object.values(c.progress || {}).forEach(list => list.forEach(l => delete l.syntheses));
  return c;
};
const same = (a, b) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));

(async () => {
  // ---------- 1. une vraie famille sur l'appli Apps Script ----------
  const A = makeWorldAs({ ADMIN_PASSWORD: 'secret' });
  const ADM = { pseudo: 'Papa', password: 'secret' };
  A.run('adminData', ADM);                                                   // 1re connexion : ADMIN_PSEUDO = Papa
  A.run('saveStudent', ADM, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  A.run('saveStudent', ADM, { classe: '5B', pseudo: 'Emma', pin: '4321' });
  A.run('setBuiltinAssign', ADM, 'zootopia', ['leo', 'emma']);
  A.run('setBuiltinAssign', ADM, 'byzance-30', ['leo']);
  const long = i => 'Question numéro ' + i + ' : ' + 'quelle est la réponse à cette question assez longue pour remplir la place ? '.repeat(2);
  A.run('saveQuiz', ADM, { titre: 'Grand quiz : sciences', matiere: 'Sciences', emoji: '🔬', pour: ['leo'],
    questions: Array.from({ length: 60 }, (_, i) => ({ question: long(i), options: ['Réponse A ' + i, 'Réponse B ' + i, 'Réponse C', 'Réponse D'], correct: i % 4, explication: 'Parce que ' + 'c\'est ainsi. '.repeat(10) })) });
  A.run('saveDeck', ADM, { titre: 'Mots anglais', cartes: [{ recto: 'dog', verso: 'chien' }, { recto: 'cat', verso: 'chat' }], pour: ['emma'] });
  const mus = A.run('getBuiltinForEdit', ADM, 'musique-carnaval').quiz; mus.titre += ' (modifié)';
  A.run('saveBuiltin', ADM, 'musique-carnaval', mus); A.run('setBuiltinAssign', ADM, 'musique-carnaval', ['emma']);
  const code = A.run('setInviteCode', ADM, 'new').code;
  A.run('createFamily', code, { famille: 'Martin', pseudo: 'Maman Martin', password: 'motdepasse1' });
  const MM = { pseudo: 'Maman Martin', password: 'motdepasse1' };
  A.run('saveStudent', MM, { classe: 'CM2', pseudo: 'Zoé', pin: '5678' });
  A.run('saveQuiz', MM, { titre: 'Tables', matiere: 'Maths', emoji: '✖️', pour: ['zoe'], questions: [{ question: '7 × 8 ?', reponses: ['56'] }] });
  A.run('setBuiltinAssign', MM, 'zootopia', ['zoe']);
  // des révisions : Léo sur Zootopia (avec un contrôle), Emma, Zoé
  const zoo = A.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia'), zid = zoo.questions.map(q => A.ctx.qhash_(q.question));
  const L = ['5B', 'Léo', '1234'], E = ['5B', 'Emma', '4321'], Z = ['CM2', 'Zoé', '5678'];
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  A.run('setLessonPlan', ...L, 'zootopia', iso(A.now() + 7 * DAY), true);
  let op = 0;
  zid.slice(0, 6).forEach((id, i) => A.run('answer', ...L, 'zootopia', id, 'qcm', i % 3 !== 0, i === 0 ? 'sur' : '', 's1', 'op' + (++op)));
  A.run('endSession', ...L, 'zootopia', 's1', { n: 6, ok: 4, dur: 300 }, 'op' + (++op));
  zid.slice(0, 3).forEach(id => A.run('answer', ...E, 'zootopia', id, 'qcm', true, '', 'e1', 'op' + (++op)));
  A.run('answer', ...Z, 'zootopia', zid[0], 'qcm', false, '', 'z1', 'op' + (++op));
  A.advance(2 * DAY);
  const exported = JSON.parse(JSON.stringify(A.run('backupData', ADM)));
  const chunkKeys = Object.keys(exported.proprietes).filter(k => /~\d+$/.test(k));
  ok(chunkKeys.some(k => k.startsWith('quiz_')) && chunkKeys.some(k => k.startsWith('override_musique-carnaval~')), 'export Apps Script : des éléments découpés en morceaux (' + chunkKeys.length + ' morceaux)');

  // ---------- 2. installation sur Cloudflare (base vide) ----------
  const ENV = { INSTALL_CODE: 'QZ7K-M2PA' };
  const C = makeWorldCf({}, { env: ENV, timeZone: 'Europe/Paris', now: A.now() });
  ok(C.core.status().installed === false, 'Cloudflare, base vide : « pas installé »');
  ok(C.core.guard(() => C.core.install({ code: 'FAUX-CODE', data: exported, password: 'nouveau-mdp-1' })).error === "Code d'installation incorrect.", 'mauvais code d\'installation refusé');
  ok(/8 caractères/.test(C.core.guard(() => C.core.install({ code: ENV.INSTALL_CODE, data: exported, password: 'court' })).error), 'mot de passe trop court refusé');
  ok(/famille invitée/.test(C.core.guard(() => C.core.install({ code: ENV.INSTALL_CODE, data: exported, pseudo: 'maman martin', password: 'nouveau-mdp-1' })).error), 'pseudo administrateur = celui d\'une famille : refusé');
  ok(/pas un export/.test(C.core.guard(() => C.core.install({ code: ENV.INSTALL_CODE, data: { foo: 1 }, password: 'nouveau-mdp-1' })).error) &&
    /schéma 2/.test(C.core.guard(() => C.core.install({ code: ENV.INSTALL_CODE, data: { schema: 2, proprietes: {} }, password: 'nouveau-mdp-1' })).error) &&
    /abîmé/.test(C.core.guard(() => C.core.install({ code: ENV.INSTALL_CODE, data: { schema: 3, proprietes: { x: 1 } }, password: 'nouveau-mdp-1' })).error), 'fichier invalide refusé (format, version, valeur)');
  ok(Object.keys(C.props).length === 0, 'après ces refus : base toujours vide');
  const withPw = { ...exported, proprietes: { ...exported.proprietes, ADMIN_PASSWORD: 'piege', ADMIN_PASS_HASH: 'x:y' } };
  const inst = C.core.guard(() => C.core.install({ code: ' qz7k-m2pa ', data: withPw, password: 'nouveau-mdp-1' }));
  ok(inst.ok && inst.value.enfants === 3 && inst.value.familles === 1 && inst.value.lecons === 2 && inst.value.paquets === 1 && inst.value.leconsFourniesModifiees === 1 && inst.value.progressions === 3 && inst.value.adminPseudo === 'Papa',
    'installation : ' + JSON.stringify(inst.value || inst.error));
  ok(C.props.ADMIN_PASSWORD === undefined && /^[\w-]+:[0-9a-f]{64}$/.test(C.props.ADMIN_PASS_HASH) && C.props.ADMIN_PASS_HASH !== 'x:y', 'mot de passe administrateur : haché (sel:SHA-256), jamais repris du fichier');
  const keysA = Object.keys(exported.proprietes).sort(), keysC = Object.keys(C.props).filter(k => k !== 'ADMIN_PASS_HASH').sort();
  ok(JSON.stringify(keysA) === JSON.stringify(keysC) && keysA.every(k => C.props[k] === exported.proprietes[k]), 'toutes les clés reprises telles quelles (' + keysA.length + ' clés, valeurs identiques)');
  ok(C.core.guard(() => C.core.install({ code: ENV.INSTALL_CODE, data: exported, password: 'autre-mdp-12' })).error.includes('déjà installé'), 'une 2e installation est refusée');

  // ---------- 3. côte à côte ----------
  const NEW = { pseudo: 'Papa', password: 'nouveau-mdp-1' };
  for (const [nom, cr] of [['Léo', L], ['Emma', E], ['Zoé', Z]])
    ok(same(A.run('getStudentData', ...cr), C.run('getStudentData', ...cr)), nom + ' : connexion avec son PIN habituel, mêmes leçons, paquets et progression qu\'avant');
  ok(C.try('getStudentData', '5B', 'Léo', '0000').err === 'Classe, pseudo ou PIN incorrect.', 'mauvais PIN toujours refusé');
  ok(same(A.run('adminData', ADM), C.run('adminData', NEW)), 'espace parents (administrateur) : enfants, leçons, attributions, suivi, familles identiques');
  ok(same(A.run('adminData', MM), C.run('adminData', MM)), 'famille invitée : connexion avec son mot de passe habituel, mêmes données');
  ok(C.try('adminData', ADM).err === 'Pseudo ou mot de passe incorrect.', 'l\'ancien mot de passe administrateur ne marche pas (il a été choisi à l\'installation)');
  ok(C.run('getStudentData', ...L).quizzes.find(q => q.titre === 'Grand quiz : sciences').questions.length === 60 &&
    C.run('getStudentData', ...E).quizzes.find(q => q.id === 'musique-carnaval').titre.endsWith('(modifié)'), 'éléments en morceaux recollés : leçon de 60 questions, leçon fournie modifiée');
  ok(same(A.run('backupData', ADM), C.run('backupData', NEW)), 'un export de la version Cloudflare redonne exactement les mêmes données');
  // la révision continue sur Cloudflare
  const before = JSON.parse(C.props['srs_leo__zootopia']).it[zid[1]];
  const r = C.run('answer', ...L, 'zootopia', zid[1], 'rappel', true, '', 'c1', 'op-cf-1');
  ok(r.item[0] >= before[0] && JSON.parse(C.props['srs_leo__zootopia']).it[zid[1]][3] === before[3] + 1, 'Léo continue ses révisions sur Cloudflare (réponse enregistrée)');

  // ---------- 4. nouvel import (les enfants ont révisé sur l'ancien site entre-temps) ----------
  zid.slice(6, 10).forEach(id => A.run('answer', ...L, 'zootopia', id, 'qcm', true, '', 's2', 'op' + (++op)));
  A.run('saveStudent', ADM, { classe: '5B', pseudo: 'Tom', pin: '9999' });
  const exported2 = JSON.parse(JSON.stringify(A.run('backupData', ADM)));
  ok(C.core.guard(() => C.core.importData({ cred: ADM, data: exported2 })).error === 'Pseudo ou mot de passe incorrect.', 'nouvel import : refusé sans le mot de passe administrateur de QUIZy Cloudflare');
  ok(C.core.guard(() => C.core.importData({ cred: MM, data: exported2 })).error === "Réservé à l'administrateur principal.", 'nouvel import : refusé à une famille invitée');
  const imp = C.core.guard(() => C.core.importData({ cred: NEW, data: exported2 }));
  ok(imp.ok && imp.value.enfants === 4, 'nouvel import accepté : ' + JSON.stringify(imp.value || imp.error));
  ok(C.props['srs_leo__zootopia'] === exported2.proprietes['srs_leo__zootopia'] && C.run('getStudentData', '5B', 'Tom', '9999').student.id === 'tom', 'les données sont remplacées par celles du fichier (progression de Léo, nouvel enfant Tom)');
  ok(!!C.run('adminData', NEW).moi.owner, 'pseudo et mot de passe administrateur de QUIZy Cloudflare conservés');

  // ---------- 5. mot de passe administrateur oublié : secret ADMIN_PASSWORD du Worker ----------
  const R = C.reopen({ ...ENV, ADMIN_PASSWORD: 'secours-2026' });
  ok(R.guard(() => R.app.adminData({ pseudo: 'Papa', password: 'secours-2026' })).ok, 'secours : le secret ADMIN_PASSWORD du Worker permet de se reconnecter (comme la propriété ADMIN_PASSWORD d\'Apps Script)');
  ok(!('ADMIN_PASSWORD' in R.app.backupData({ pseudo: 'Papa', password: 'secours-2026' }).proprietes), 'le mot de passe de secours n\'apparaît jamais dans un export');
  ok(C.reopen(ENV).guard(() => C.reopen(ENV).app.adminData(NEW)).ok, 'secret retiré : le mot de passe habituel remarche');

  // ---------- 6. l'écran « Installer » (navigateur) ----------
  const W = makeWorldCf({}, { env: ENV, timeZone: 'Europe/Paris' });
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.addInitScript('window.QUIZY_PROFILS = false;');   // profils : suite 32
  const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(page('Index.html', 'cloudflare'));
  ok(new URL(p.url()).pathname === '/installer' && (await p.title()) === 'QUIZy · Installer', 'base vide : la page élève mène à l\'écran « Installer »');
  await p.goto(page('admin.html', 'cloudflare'));
  ok(new URL(p.url()).pathname === '/installer', 'base vide : l\'espace parents aussi');
  await p.goto(page('installer', 'cloudflare') + '#code=QZ7K-M2PA');
  await p.waitForSelector('#form:not([hidden])');
  ok((await p.locator('#titre').innerText()).includes('Installer QUIZy') && (await p.locator('#code').inputValue()) === 'QZ7K-M2PA' && await p.locator('#zone-remplacer').isHidden(), 'mode installation, code prérempli depuis le lien, pas de case « remplacer »');
  await p.setInputFiles('#fichier', { name: 'quizy-export.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await p.waitForFunction(() => document.querySelector('#resume-fichier').textContent.includes('Fichier du'));
  ok(/3 enfants, 1 famille invitée, 2 leçons créées, 3 progressions/.test(await p.locator('#resume-fichier').innerText()) && (await p.locator('#pseudo').inputValue()) === 'Papa', 'fichier lu : ' + await p.locator('#resume-fichier').innerText() + ' ; pseudo prérempli');
  await p.fill('#password', 'nouveau-mdp-1'); await p.fill('#password2', 'nouveau-mdp-2'); await p.click('#go');
  ok((await p.locator('#status').innerText()) === 'Les deux mots de passe ne sont pas identiques.', 'confirmation différente : refusée');
  await p.fill('#password2', 'nouveau-mdp-1'); await p.click('#go');
  await p.waitForSelector('#fini:not([hidden])');
  ok(/Administrateur : Papa/.test(await p.locator('#resume').innerText()) && /3 enfants/.test(await p.locator('#resume').innerText()), 'installé : ' + (await p.locator('#resume').innerText()).replace(/\n/g, ' · '));
  ok(Object.keys(W.props).length === Object.keys(exported.proprietes).length + 1, 'données installées dans la base');
  await p.click('text=Espace parents');
  await p.fill('#admin-pseudo', 'Papa'); await p.fill('#password', 'nouveau-mdp-1'); await p.click('#unlock');
  await p.waitForSelector('#admin-area:not([hidden])');
  ok((await p.locator('#pane-programmes').innerText()).includes('Léo') && (await p.locator('#pane-programmes').innerText()).includes('Emma'), 'espace parents : Léo et Emma sont là');
  await p.goto(page('Index.html', 'cloudflare'));
  await p.fill('#login-classe', '5B'); await p.fill('#login-pseudo', 'Léo'); await p.fill('#login-pin', '1234'); await p.click('#login-btn');
  await p.waitForSelector('#app:not([hidden])');
  ok((await p.locator('.card h3').allInnerTexts()).includes('Zootopia : les quartiers'), 'page élève : Léo se connecte avec son PIN habituel et retrouve ses leçons');
  await p.goto(page('installer', 'cloudflare'));
  await p.waitForSelector('#form:not([hidden])');
  ok((await p.locator('#titre').innerText()).includes('Importer') && await p.locator('#zone-code').isHidden() && await p.locator('#zone-remplacer').isVisible(), 'une fois installé : l\'écran propose seulement un nouvel import (administrateur)');
  await p.setInputFiles('#fichier', { name: 'quizy-export.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported2)) });
  await p.waitForFunction(() => document.querySelector('#resume-fichier').textContent.includes('Fichier du'));
  await p.fill('#pseudo', 'Papa'); await p.fill('#password', 'nouveau-mdp-1'); await p.click('#go');
  ok((await p.locator('#status').innerText()).includes('Coche la case'), 'remplacement à confirmer (case à cocher)');
  await p.check('#remplacer'); await p.click('#go');
  await p.waitForSelector('#fini:not([hidden])');
  ok(/4 enfants/.test(await p.locator('#resume').innerText()) && W.props['srs_leo__zootopia'] === exported2.proprietes['srs_leo__zootopia'], 'nouvel import depuis l\'écran : 4 enfants, progression à jour');
  // ---------- 7. « 🔍 Vérifier » (lecture seule) ----------
  const verify = async (pw = 'nouveau-mdp-1') => {
    await p.goto('about:blank'); await p.goto(page('installer', 'cloudflare'));
    await p.waitForSelector('#verif:not([hidden])');
    await p.setInputFiles('#v-fichier', { name: 'quizy-export.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported2)) });
    await p.waitForFunction(() => document.querySelector('#v-status').textContent.includes('Fichier du'));
    await p.fill('#v-pseudo', 'Papa'); await p.fill('#v-password', pw);
    const before = JSON.stringify(W.props);
    await p.click('#v-go');
    await p.waitForFunction(() => /✅|⚠️|incorrect/.test(document.querySelector('#v-status').textContent));
    return { status: await p.locator('#v-status').innerText(), rapport: await p.locator('#v-resultat').innerText(), inchange: before === JSON.stringify(W.props) };
  };
  let v = await verify();
  ok(v.status === '✅ Tout correspond.' && /(\d+) éléments identiques sur \1 /.test(v.rapport) && /PIN inchangés : oui ✅/.test(v.rapport) && /mots de passe inchangés : oui ✅/.test(v.rapport), 'VÉRIFIER après import : tout correspond (' + v.rapport.split('\n')[0] + ')');
  ok(v.inchange, 'la vérification ne modifie rien');
  ok(/Léo \(5B\) : .*les quartiers \d+ %/.test(v.rapport) && /Tom \(5B\)/.test(v.rapport), 'rapport : chaque enfant avec ses leçons et son avancement');
  W.advance(3 * DAY); W.run('answer', '5B', 'Léo', '1234', 'zootopia', zid[2], 'rappel', true, '', 'v1', 'op-verif-1');
  v = await verify();
  ok(v.status === '✅ Tout correspond.' && /Révisé sur QUIZy depuis l'export[\s\S]*progression de Léo \(5B\) sur « Zootopia : les quartiers »/.test(v.rapport), 'révision faite sur QUIZy après l\'export : signalée comme normale');
  const tom = JSON.parse(W.props.student_tom); W.props.student_tom = JSON.stringify({ ...tom, hash: '0'.repeat(64) });
  v = await verify();
  ok(v.status.startsWith('⚠️') && /PIN inchangés : non ⚠️/.test(v.rapport) && /Différent[\s\S]*compte de Tom/.test(v.rapport), 'PIN différent : signalé (« ' + v.status + ' »)');
  W.props.student_tom = JSON.stringify(tom);
  v = await verify('mauvais-mdp');
  ok(v.status === 'Pseudo ou mot de passe incorrect.' && v.rapport === '', 'mauvais mot de passe : rien n\'est montré');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close();
  process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
