// Révision espacée (parcours v3) côté serveur : niveaux, échéances, plan selon la date du contrôle, express, bonus, migration
const { makeWorld, ok, summary, PW } = require('./harness');
const DAY = 86400000, MIN = 60000, HOUR = 3600000;
const w = makeWorld({ ADMIN_PASSWORD: PW, prog_leo__zootopia: '{"q":{}}', done_leo__zootopia: '{"n":3}', parcours_leo__zootopia: '{"v":2}', student_vieux: 'x' });
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('saveStudent', PW, { classe: '5B', pseudo: 'Emma', pin: '4321' });
w.run('setBuiltinAssign', PW, 'zootopia', ['leo', 'emma']); w.run('setBuiltinAssign', PW, 'byzance', ['leo']);
const L = ['5B', 'Léo', '1234'], E = ['5B', 'Emma', '4321'];
const zoo = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia'), ids = zoo.questions.map(q => w.ctx.qhash_(q.question));
const get = (c = L) => w.run('getStudentData', ...c);
const srs = (c = L, quiz = 'zootopia') => get(c).srs[quiz];
let op = 0;
const ans = (id, stage, good, sid, conf = '', c = L, quiz = 'zootopia') => w.run('answer', ...c, quiz, id, stage, good, conf, sid, 'op' + (++op)).item;
const dayStart = ms => Math.floor(ms / DAY) * DAY;   // le harnais tourne en UTC
const iso = ms => new Date(ms).toISOString().slice(0, 10);

// ---- migration : effacement unique des anciennes données ----
const d0 = get();
ok(!Object.keys(w.props).some(k => /^(prog|done|parcours)_/.test(k)) && w.props.schema_version === '3' && w.props.student_vieux === 'x', 'RAZ : progressions, compteurs et parcours effacés une seule fois ; comptes conservés');
ok(JSON.stringify(d0.srs.zootopia) === '{"it":{},"exam":"","plan":[],"tf":false,"cfg":false,"mode":"actif","ses":[]}' && typeof d0.now === 'number', 'leçon neuve : aucune question travaillée ; l\'heure du serveur est envoyée');
w.props.prog_leo__zootopia = 'nouveau'; get();
ok(w.props.prog_leo__zootopia === 'nouveau', 'la remise à zéro ne se refait pas (une seule fois par version)');
delete w.props.prog_leo__zootopia;

// ---- sans contrôle : niveaux et intervalles 1, 3, 7, 14 jours ----
let t0 = w.now();
let it = ans(ids[0], 'qcm', true, 's1');
ok(it[0] === 1 && it[1] === dayStart(t0) + DAY && it[3] === 1, 'nouvelle question réussie en QCM : niveau 1 (Découverte), à revoir demain');
it = ans(ids[0], 'rappel', true, 's1');
ok(it[0] === 1, 'une 2e réponse dans la même séance ne fait pas monter le niveau');
it = ans(ids[1], 'qcm', false, 's1');
ok(it[0] === 0 && it[2] === 1, 'nouvelle question ratée : reste à 0, une erreur');
it = ans(ids[1], 'qcm', true, 's1');
ok(it[0] === 1 && it[2] === 1 && it[1] === dayStart(t0) + DAY, 'puis réussie dans la même séance (après correction) : niveau 1, à revoir demain');
w.advance(DAY);
it = ans(ids[0], 'rappel', true, 's2');
ok(it[0] === 2 && it[1] === dayStart(w.now()) + 3 * DAY, 'le lendemain, rappel réussi : niveau 2 (Rappelée), dans 3 jours');
it = ans(ids[1], 'rappel', true, 's2', 'doute');
ok(it[0] === 1, 'réussi mais « je crois savoir » : le niveau ne monte pas');
it = ans(ids[2], 'qcm', true, 's2'); const before = it.slice();
it = ans(ids[0], 'rappel', true, 's3');
ok(it[0] === 2, 'séance « bonus » (question pas encore à revoir) : une réussite n\'avance pas le plan');
w.advance(3 * DAY);
it = ans(ids[0], 'rappel', true, 's4'); ok(it[0] === 3 && it[1] === dayStart(w.now()) + 7 * DAY, 'niveau 3 (Ancrée) : dans 7 jours');
w.advance(7 * DAY);
it = ans(ids[0], 'rappel', true, 's5'); ok(it[0] === 4 && it[1] === dayStart(w.now()) + 14 * DAY, 'niveau 4 (Maîtrisée) : dans 14 jours');
w.advance(14 * DAY);
it = ans(ids[0], 'qcm', true, 's6'); ok(it[0] === 4, 'un QCM ne fait pas monter au-delà (seul le rappel compte)');
w.advance(14 * DAY);
it = ans(ids[0], 'rappel', false, 's7', 'sur');
ok(it[0] === 1 && it[1] === dayStart(w.now()) + DAY && it[4] === 1, 'erreur (même maîtrisée) : retour au niveau 1, demain ; erreur « sûre » comptée');
ok(w.run('answer', ...L, 'zootopia', ids[3], 'qcm', true, '', 's7', 'op' + op).rejoue, 'opération rejouée (même identifiant) : sans effet');

// ---- contrôle dans une semaine : plan de séances ----
w.run('resetProgress', PW, 'leo', 'zootopia');
let now = w.now(), today = dayStart(now);
let r = w.run('setLessonPlan', ...L, 'zootopia', iso(today + 7 * DAY), false);
ok(JSON.stringify(r.plan.map(p => Math.round((dayStart(p) - today) / DAY))) === '[0,1,3,6]' && r.plan[0] === now && r.cfg && !r.tf, 'contrôle dans 7 jours : séances aujourd\'hui, demain, J+3 et la veille');
r = w.run('setLessonPlan', ...L, 'zootopia', iso(today + 14 * DAY), true);
ok(JSON.stringify(r.plan.map(p => Math.round((dayStart(p) - today) / DAY))) === '[0,1,3,7,13]' && r.tf, 'dans 14 jours : 0, 1, 3, 7 et la veille (13) ; « commencer par tester » enregistré');
r = w.run('setLessonPlan', ...L, 'zootopia', iso(today + 3 * DAY), true);
ok(JSON.stringify(r.plan.map(p => Math.round((dayStart(p) - today) / DAY))) === '[0,1,2]', 'dans 3 jours : aujourd\'hui, demain, la veille');
r = w.run('setLessonPlan', ...L, 'zootopia', iso(today + 2 * DAY), true);
ok(JSON.stringify(r.plan.map(p => Math.round((dayStart(p) - today) / DAY))) === '[0,1,2]' && r.plan[2] === today + 2 * DAY, 'dans 2 jours : aujourd\'hui, demain, le matin du contrôle');
r = w.run('setLessonPlan', ...L, 'zootopia', iso(today + 7 * DAY), true);
it = ans(ids[0], 'qcm', true, 'p1');
ok(it[1] === today + DAY, 'avec un plan : la question réussie revient à la séance suivante (demain)');
w.advance(DAY);
it = ans(ids[0], 'rappel', true, 'p2'); ok(it[0] === 2 && it[1] === today + 3 * DAY, 'demain réussie : revient à la séance J+3');
w.advance(2 * DAY);
it = ans(ids[0], 'rappel', true, 'p3'); ok(it[0] === 3 && it[1] === today + 6 * DAY, 'ancrée (niveau 3) : revient à la DERNIÈRE séance (la veille)');
it = ans(ids[1], 'qcm', false, 'p3'); ok(it[1] === today + 6 * DAY, 'erreur : revient à la séance suivante');
w.advance(5 * DAY);   // jour du contrôle
it = ans(ids[0], 'rappel', true, 'p4'); ok(it[0] === 4 && it[1] === dayStart(w.now()) + 14 * DAY, 'plus de séance prévue : rythme normal (14 jours)');

// ---- contrôle demain : révision express ----
w.run('resetProgress', PW, 'leo', 'zootopia');
const noon = dayStart(w.now()) + 12 * HOUR; w.advance(noon - w.now());
now = w.now(); today = dayStart(now);
r = w.run('setLessonPlan', ...L, 'zootopia', iso(today + DAY), true);
ok(r.plan.length === 3 && r.plan[0] === now && r.plan[1] === now + HOUR && r.plan[2] === today + DAY, 'contrôle demain (à midi) : maintenant, 1 h plus tard, le matin du contrôle');
it = ans(ids[0], 'qcm', true, 'x1'); ok(it[1] === now + HOUR, 'express : réussie, revient 1 h plus tard');
it = ans(ids[1], 'qcm', false, 'x1'); ans(ids[1], 'qcm', true, 'x1'); ok(srs().it[ids[1]][1] === now + HOUR, 'express : ratée puis corrigée, revient aussi 1 h plus tard');
w.advance(HOUR + MIN);
it = ans(ids[0], 'rappel', true, 'x2'); ok(it[0] === 2 && it[1] === today + DAY, '1 h plus tard : rappel réussi, revient le matin du contrôle');
const late = dayStart(w.now()) + 23 * HOUR + 30 * MIN; w.advance(late - w.now());
r = w.run('setLessonPlan', ...L, 'zootopia', iso(dayStart(w.now()) + DAY), true);
ok(r.plan.length === 2 && r.plan[1] === dayStart(w.now()) + DAY, 'express commencé à 23 h 30 : maintenant et le matin du contrôle');
ok(w.try('setLessonPlan', ...L, 'zootopia', iso(dayStart(w.now()) - DAY), true).err === "Choisis une date entre aujourd'hui et dans un an.", 'date passée refusée');
ok(w.try('setLessonPlan', ...L, 'zootopia', '2026-13-45', true).err === 'Date invalide.', 'date invalide refusée');
r = w.run('setLessonPlan', ...L, 'zootopia', '', true);
ok(r.exam === '' && r.plan.length === 0, 'pas de contrôle : plus de plan');

// ---- après le contrôle : entretien ou archive ----
r = w.run('setLessonMode', ...L, 'zootopia', 'archive');
ok(r.mode === 'archive', 'archivée');
r = w.run('setLessonMode', ...L, 'zootopia', 'entretien');
ok(r.mode === 'entretien' && r.exam === '', 'gardée en mémoire (entretien)');
ok(w.try('setLessonMode', ...L, 'zootopia', 'nimporte').err === 'Choix invalide.', 'mode inconnu refusé');

// ---- historique des séances ----
const s1 = w.run('endSession', ...L, 'zootopia', 'x2', { n: 8, ok: 6, dur: 300 }, 'fin1');
const s2 = w.run('endSession', ...L, 'zootopia', 'x2', { n: 8, ok: 6, dur: 300 }, 'fin1');
ok(s1.ses.length === 1 && s2.ses.length === 1 && s1.ses[0][1] === 300 && s1.ses[0][2] === 8 && s1.ses[0][3] === 6, 'fin de séance enregistrée une fois (opération rejouée sans effet)');
w.run('endSession', ...L, 'zootopia', 'x3', { n: 5, ok: 99, dur: 1e9, bonus: true }, 'fin2');
const last = srs().ses.slice(-1)[0];
ok(last[3] === 5 && last[1] === 4 * 3600 && last[4] === 1, 'valeurs bornées (réussies ≤ questions, durée ≤ 4 h), séance bonus marquée');

// ---- sécurité et isolation ----
ok(w.try('answer', ...E, 'byzance', ids[0], 'qcm', true, '', 's', 'z1').err === 'Quiz inaccessible.', 'Emma ne peut pas répondre sur une leçon qui n\'est pas à elle');
ok(w.try('answer', ...L, 'zootopia', 'deadbeef', 'qcm', true, '', 's', 'z2').err === 'Question inconnue.', 'question étrangère refusée');
ok(w.try('answer', '5B', 'Léo', '0000', 'zootopia', ids[0], 'qcm', true, '', 's', 'z3').err === 'Classe, pseudo ou PIN incorrect.', 'mauvais PIN refusé');
ans(ids[5], 'qcm', true, 'e1', '', E);
ok(srs(E).it[ids[5]][0] === 1 && !(srs().it[ids[5]]), 'la progression d\'Emma est séparée de celle de Léo');
ok(w.try('setLessonPlanAdmin', 'faux', 'leo', 'zootopia', '').err === 'Mot de passe incorrect.' && w.try('setLessonModeAdmin', 'faux', 'leo', 'zootopia', 'archive').err === 'Mot de passe incorrect.', 'actions parent : mot de passe requis');
ok(w.try('setLessonPlanAdmin', PW, 'emma', 'byzance', '').err === "Cette leçon n'est pas attribuée à cet élève.", 'parent : leçon non attribuée refusée');

// ---- suivi parent ----
const t = dayStart(w.now());
const sum = w.run('setLessonPlanAdmin', PW, 'leo', 'zootopia', iso(t + DAY));
ok(sum.exam === iso(t + DAY) && sum.plan.length >= 2 && srs().exam === iso(t + DAY), 'le parent fixe la date du contrôle : plan recalculé, vu par l\'élève');
w.run('setLessonModeAdmin', PW, 'leo', 'zootopia', 'archive'); ok(srs().mode === 'archive', 'le parent peut archiver');
const adm = w.run('adminData', PW).progress.leo.find(x => x.id === 'zootopia');
ok(typeof adm.avancement === 'number' && adm.avancement === Math.round((adm.niveaux[1] + 2 * adm.niveaux[2] + 3 * (adm.niveaux[3] + adm.niveaux[4])) / 30 * 100), 'avancement de l\'apprentissage : ' + adm.avancement + ' %');
ok(Array.isArray(adm.niveaux) && adm.niveaux.reduce((a, b) => a + b, 0) === 10 && typeof adm.pret === 'number' && adm.seances.length === 2 && adm.nbSeances === 2, 'résumé parent : niveaux, prêt, historique');
ok(adm.difficiles.length >= 1 && adm.difficiles[0].question && adm.difficiles[0].erreurs >= 1, 'questions difficiles (avec leur énoncé)');
ok(!JSON.stringify(w.run('adminData', PW)).includes('1234'), 'aucun PIN dans les données du parent');
ok(typeof w.ctx.saveResult === 'undefined' && typeof w.ctx.finishQuiz === 'undefined' && typeof w.ctx.validateParcours === 'undefined', 'l\'ancien parcours (saveResult, finishQuiz, validation) n\'existe plus');

// ---- remise à zéro et suppression ----
ok(w.run('resetProgress', PW, 'leo', 'zootopia').supprimes === 1 && !srs().it[ids[0]], 'remise à zéro d\'une leçon');
ans(ids[0], 'qcm', true, 'r1');
w.run('deleteStudent', PW, 'leo');
ok(!Object.keys(w.props).some(k => k.startsWith('srs_leo__')), 'supprimer un élève efface ses révisions');
// ---- réponse courte facultative d'un QCM (rappel écrit) ----
const rq = w.run('saveQuiz', PW, { titre: 'Dates', pour: ['emma'], questions: [{ question: 'Exécution du roi ?', options: ['1789', '1793'], correct: 1, rappel: ['1793', ' en 1793 ', ''] }] });
const rqq = w.run('getStudentData', ...E).quizzes.find(q => q.titre === 'Dates').questions[0];
ok(JSON.stringify(rqq.rappel) === '["1793","en 1793"]', 'QCM avec réponse courte : enregistrée (pour le rappel écrit)');
process.exit(summary() ? 1 : 0);
