// Parcours v2 (cahier des charges V3.1) côté serveur : états, séries à 2, cartes évaluées, migration, idempotence
const { makeWorld, ok, summary, PW } = require('./harness');
const w = makeWorld();
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('saveStudent', PW, { classe: '5B', pseudo: 'Emma', pin: '4321' });
w.run('setBuiltinAssign', PW, 'zootopia', ['leo']);
const L = ['5B', 'Léo', '1234'], E = ['5B', 'Emma', '4321'];
const zoo = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia');
const ids = zoo.questions.map(q => w.ctx.qhash_(q.question));
const get = (c = L) => w.run('getStudentData', ...c);
const pc = (c = L) => get(c).parcours.zootopia;
const serie = id => (get().progress.zootopia || {})[id] || [0, 0];
const play = (list, good, cred = L, quiz = 'zootopia') => list.forEach(id => w.run('saveResult', ...cred, quiz, id, good(id)));
const fin = (cred = L, quiz = 'zootopia') => w.run('finishQuiz', ...cred, quiz);

// ---- T01 : quiz initial parfait ----
let p = pc();
ok(p.v === 2 && p.etape === 'quiz_initial' && p.pass.kind === 'initial' && p.pass.list.length === 10, 'départ : quiz_initial, UN passage de toutes les questions (10)');
ok(w.try('finishQuiz', ...L, 'zootopia').err && pc().etape === 'quiz_initial', 'un passage inachevé ne peut pas être clôturé');
play(ids, () => true);
ok(ids.every(id => serie(id)[0] === 1), 'quiz initial parfait : 10 séries à 1 sur 2');
let r = w.run('finishQuiz', ...L, 'zootopia', 'f1');
ok(r.parcours.etape === 'verification' && r.parcours.pass.list.length === 10 && !r.parcours.pile && r.n === 1, 'aucune carte ciblée : directement la vérification des 10 questions');
ok(r.bilan.total === 10 && r.bilan.bons === 10 && r.bilan.erreurs === 0 && r.bilan.restant === 10, 'bilan : 10/10, 10 questions restant à vérifier');
r = w.run('finishQuiz', ...L, 'zootopia', 'f1'); ok(r.rejoue && r.n === 1 && get().fois.zootopia === 1, 'relire le bilan (finishQuiz renvoyé) ne compte pas une partie de plus');
play(ids, () => true);
r = fin();
ok(r.parcours.etape === 'cartes_finales' && r.parcours.pile.kind === 'finales' && r.parcours.pile.ids.length === 10 && ids.every(id => serie(id)[0] === 2), 'vérification réussie : 10 séries à 2 sur 2, paquet final de 10 cartes');
ok(get().fois.zootopia === 2, 'compteur de parties : 2');
ok(w.try('requestValidation', ...L, 'zootopia').err, 'demande adulte refusée avant la fin du paquet final');
ok(w.try('cardsDone', ...L, 'zootopia').err === "Cette étape n'est pas en cours.", 'cardsDone refusé à l\'étape paquet final');
ids.slice(0, 9).forEach(id => w.run('rateCard', ...L, 'zootopia', id, 'trouve', null));
ok(w.try('requestValidation', ...L, 'zootopia').err && pc().etape === 'cartes_finales', 'une carte non évaluée : fin refusée (9 cartes sur 10)');
w.run('rateCard', ...L, 'zootopia', ids[9], 'oublie', null);
ok(w.try('requestValidation', ...L, 'zootopia').err, 'dernière carte « Oublié » : fin refusée');
ok(ids.every(id => serie(id)[0] === 2), 'l\'auto-évaluation ne modifie pas les séries des quiz');
w.run('rateCard', ...L, 'zootopia', ids[9], 'trouve', null);
r = w.run('requestValidation', ...L, 'zootopia');
ok(r.parcours.etape === 'attente_validation' && r.parcours.fini > 0, 'tout Trouvé : en attente de validation');
ok(w.try('validateParcours', 'faux', 'leo', 'zootopia').err === 'Mot de passe incorrect.', 'validation : réservée à l\'administrateur authentifié');
ok(w.try('rateCard', ...L, 'zootopia', ids[0], 'trouve', null).err, 'plus d\'évaluation une fois la demande faite');
const v = w.run('validateParcours', PW, 'leo', 'zootopia');
ok(v.parcours.etape === 'valide' && pc().etape === 'valide' && w.run('adminData', PW).progress.leo[0].parcours.etape === 'valide', 'validation adulte : vues élève et administration concordent');

// ---- T02 : erreur puis deux réussites (3 questions A, B, C) ----
w.run('resetProgress', PW, 'all', 'all');
const q3 = w.run('saveQuiz', PW, { titre: 'Trois', matiere: 'Test', emoji: '3️⃣', questions: ['A', 'B', 'C'].map(t => ({ question: 'Question ' + t, options: ['x', 'y'], correct: 0 })), pour: ['leo'] });
const QI = q3.id || w.run('adminData', PW).quizzes[0].id;
const tid = w.run('adminData', PW).quizzes.find(x => x.titre === 'Trois').questions.map(q => q.id || w.ctx.qhash_(q.question));
const [A, B, C] = tid;
const pc3 = () => get().parcours[QI];
const ser3 = id => ((get().progress[QI] || {})[id] || [0, 0]);
tid.forEach(id => w.run('saveResult', ...L, QI, id, id !== C));
r = fin(L, QI);
ok(r.parcours.etape === 'cartes_ciblees' && JSON.stringify(r.parcours.pile.ids) === JSON.stringify([C]) && r.bilan.erreurs === 1, 'T02 : A et B justes, C fausse : seule C en cartes ciblées');
ok(ser3(A)[0] === 1 && ser3(B)[0] === 1 && JSON.stringify(ser3(C)) === '[0,1]', 'séries 1, 1, 0 (une erreur comptée pour C)');
ok(w.try('rateCard', ...L, QI, A, 'trouve', null).err === 'Carte inconnue.', 'une carte étrangère à la pile est refusée');
ok(w.try('cardsDone', ...L, QI).err, 'cartes ciblées : fin refusée avant « Trouvé »');
w.run('rateCard', ...L, QI, C, 'hesite', { f: [], o: [], h: [C], w: { [C]: 0 }, c: C, l: C });
ok(w.try('cardsDone', ...L, QI).err, '« Hésité » ne suffit pas');
w.run('rateCard', ...L, QI, C, 'trouve', { f: [], o: [], h: [], w: {}, c: '', l: C });
r = w.run('cardsDone', ...L, QI);
ok(r.parcours.etape === 'verification' && r.parcours.pass.list.length === 3, 'Trouvé -> vérification de A, B, C');
tid.forEach(id => w.run('saveResult', ...L, QI, id, true));
r = fin(L, QI);
ok(ser3(A)[0] === 2 && ser3(B)[0] === 2 && ser3(C)[0] === 1 && r.parcours.etape === 'verification' && JSON.stringify(r.parcours.pass.list) === JSON.stringify([C]), 'A et B à 2 sur 2, C à 1 sur 2 : le passage suivant ne contient que C');
ok(r.bilan.restant === 1 && r.bilan.erreurs === 0, 'restant à vérifier : 1');
ok(w.try('saveResult', ...L, QI, A, true).err === 'Question inconnue pour ce passage.', 'une question déjà à 2 sur 2 est exclue de la vérification');
// ---- T03 : erreur pendant la vérification ----
w.run('saveResult', ...L, QI, C, false);
ok(JSON.stringify(ser3(C)) === '[0,2]', 'erreur en vérification : série à 0, une erreur de plus');
r = fin(L, QI);
ok(r.parcours.etape === 'cartes_ciblees' && JSON.stringify(r.parcours.pile.ids) === JSON.stringify([C]), 'T03 : seule la question ratée retourne aux cartes ciblées');
w.run('rateCard', ...L, QI, C, 'trouve', null); w.run('cardsDone', ...L, QI);
ok(JSON.stringify(pc3().pass.list) === JSON.stringify([C]) && ser3(A)[0] === 2, 'puis vérification de C seule ; A et B ne sont pas réinterrogées');
w.run('saveResult', ...L, QI, C, true); r = fin(L, QI);
ok(r.parcours.etape === 'verification' && ser3(C)[0] === 1, 'C : 1 sur 2 ; il faut encore une réussite');
w.run('saveResult', ...L, QI, C, true); r = fin(L, QI);
ok(r.parcours.etape === 'cartes_finales' && r.parcours.pile.ids.length === 3, 'deux réussites consécutives : paquet final de 3 cartes');

// ---- règles de comptage ----
w.run('resetProgress', PW, 'all', 'all');
w.run('saveResult', ...L, 'zootopia', ids[0], false, 'op1');
const again = w.run('saveResult', ...L, 'zootopia', ids[0], false, 'op1');
w.run('saveResult', ...L, 'zootopia', ids[0], false, 'op2');
ok(JSON.stringify(serie(ids[0])) === '[0,1]' && again.rejoue, 'Je ne sais pas / erreur : UNE seule erreur par présentation (opId rejoué ou double envoi)');
w.run('saveResult', ...L, 'zootopia', ids[0], true);
ok(JSON.stringify(serie(ids[0])) === '[0,1]', 'une réponse corrigée après erreur ne compte pas comme réussite');
w.run('saveResult', ...L, 'zootopia', ids[1], true, 'op3'); w.run('saveResult', ...L, 'zootopia', ids[1], true, 'op3');
ok(serie(ids[1])[0] === 1, 'double envoi d\'une réussite : une seule série');
ok(w.try('saveResult', ...E, 'zootopia', ids[1], true).err === 'Quiz inaccessible.', 'Emma ne peut pas écrire sur la leçon de Léo');
ok(w.try('saveResult', ...L, 'zootopia', 'deadbeef', true).err === 'Question inconnue.', 'question étrangère refusée');
ok(w.try('cardsDone', ...E, 'zootopia').err === 'Quiz inaccessible.' && w.try('rateCard', ...E, 'zootopia', ids[0], 'trouve', null).err === 'Quiz inaccessible.' && w.try('requestValidation', ...E, 'zootopia').err === 'Quiz inaccessible.', 'isolation : les autres actions aussi');
ok(w.try('rateCard', ...L, 'zootopia', ids[0], 'trouve', null).err === "Cette étape n'est pas en cours.", 'pas d\'évaluation de carte pendant un quiz');

// ---- migration v1 -> v2 ----
const key = 'parcours_leo__zootopia', pkey = 'prog_leo__zootopia';
const setOld = (old, series) => {
  w.run('resetProgress', PW, 'all', 'all');
  w.props[key] = JSON.stringify(old);
  if (series) { const q = {}; ids.forEach((id, i) => { q[id] = [series[i % series.length], 0]; }); w.props[pkey] = JSON.stringify({ q, maj: 1 }); }
};
const mig = () => pc();
setOld({ etape: 'quiz', passages: 0, cycle: 1, maj: 5 }, [0]);
ok(mig().etape === 'quiz_initial' && mig().pass.list.length === 10, 'migration : ancien quiz sans passage terminé -> quiz_initial');
setOld({ etape: 'quiz', passages: 2, cycle: 1, maj: 5 }, [0, 1, 2, 3]);
let m = mig();
ok(m.etape === 'cartes_ciblees' && m.pile.ids.length === 6 && Object.keys(m.pile.etat).length === 0, 'migration : un passage terminé, séries 0/1/2/3 -> cartes ciblées des questions sous le seuil (aucune carte « Trouvé » inventée)');
ok(serie(ids[3])[0] === 3, 'les séries stockées ne sont pas altérées (3 reste lisible, traité comme 2)');
setOld({ etape: 'quiz', passages: 1, cycle: 1 }, [2, 3]);
ok(mig().etape === 'cartes_finales' && mig().pile.ids.length === 10, 'migration : tout est à 2 ou plus -> paquet final');
setOld({ etape: 'cartes', passages: 3, cycle: 1 }, [0, 2]);
ok(mig().etape === 'cartes_ciblees' && mig().pile.ids.length === 5, 'migration : ancienne étape cartes -> cartes_ciblees recalculées');
setOld({ etape: 'revision', passages: 3, cycle: 2 }, [3]);
ok(mig().etape === 'cartes_finales', 'migration : ancien paquet final en cours -> cartes_finales');
setOld({ etape: 'revision', passages: 3, cycle: 2 }, [3, 0]);
ok(mig().etape === 'verification' && mig().pass.list.length === 5, 'migration : « revision » avec des questions sous le seuil -> vérification (pas de paquet final prématuré)');
setOld({ etape: 'fini', fini: 777, passages: 3 }, [3]);
ok(mig().etape === 'attente_validation' && mig().fini === 777, 'migration : demande en attente reste en attente');
setOld({ etape: 'valide', fini: 777, valide: 888 }, [3]);
ok(mig().etape === 'valide' && mig().valide === 888 && w.try('validateParcours', PW, 'leo', 'zootopia').err === "Ce parcours n'attend pas de validation.", 'migration : parcours validé reste validé');

// migration répétable, retour arrière
setOld({ etape: 'quiz', passages: 2, cycle: 1, maj: 5 }, [0, 1, 2, 3]);
const first = JSON.stringify(pc()), second = JSON.stringify(pc());
ok(first === second, 'migration relancée : même résultat (lecture sans effet)');
w.run('saveResult', ...L, 'zootopia', ids[0], true);   // première écriture : pas de saveResult hors passage -> ignoré, pas d'écriture
ok(!JSON.parse(w.props[key]).v, 'une lecture ou un résultat ignoré n\'écrit rien : l\'ancien enregistrement reste intact');
w.run('rateCard', ...L, 'zootopia', JSON.parse(JSON.stringify(pc().pile.ids))[0], 'trouve', null);
const written = JSON.parse(w.props[key]);
ok(written.v === 2 && written.v1 && written.v1.passages === 2 && !('v1' in pc()), 'première écriture : v2 enregistré avec l\'ancien parcours en sauvegarde (v1), non envoyé au navigateur');
ok(w.try('rollbackParcoursV1', 'faux').err === 'Mot de passe incorrect.', 'retour arrière réservé à l\'administrateur');
ok(w.run('rollbackParcoursV1', PW) === 1 && JSON.parse(w.props[key]).passages === 2 && JSON.parse(w.props[key]).etape === 'quiz', 'retour arrière : l\'ancien parcours est restauré');
const bk = w.run('backupData', PW);
ok(bk.schema === 2 && Object.keys(bk.proprietes).some(k => k.startsWith('student_')) && !('ADMIN_PASSWORD' in bk.proprietes), 'sauvegarde : toutes les données sauf le mot de passe administrateur');
process.exit(summary() ? 1 : 0);
