const { makeWorld, ok, summary, PW, sr: sr_ } = require('./harness');
const w = makeWorld();
const sr = (...a) => sr_(w, ...a);   // chaque appel = une nouvelle présentation de la question
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
w.run('saveStudent', PW, { classe: '5B', pseudo: 'Emma', pin: '4321' });
w.run('saveStudent', PW, { classe: '6A', pseudo: 'Nina', pin: '2468' });
w.run('setBuiltinAssign', PW, 'zootopia', ['leo', 'emma']);
w.run('setBuiltinAssign', PW, 'byzance', ['leo']);
const custom = w.run('saveQuiz', PW, { titre: 'Maths', questions: [{ question: '2+2 ?', options: ['3', '4'], correct: 1 }, { question: '3+3 ?', options: ['5', '6'], correct: 1 }], pour: ['emma'] });
const L = ['5B', 'Léo', '1234'], E = ['5B', 'Emma', '4321'], N = ['6A', 'Nina', '2468'];
const cqid = w.run('getStudentData', '5B', 'Emma', '4321').quizzes.find(q => q.id === custom.id).questions[0].id;   // identifiant stable de la 1re question du quiz créé
const zoo = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia');
const h = i => w.ctx.qhash_(zoo.questions[i].question);

// ---- empreintes : même calcul côté serveur que côté page (FNV-1a) ----
const fnvPage = t => { let x = 0x811c9dc5; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 0x01000193); } return ('0000000' + (x >>> 0).toString(16)).slice(-8); };
ok(zoo.questions.every(q => w.ctx.qhash_(q.question) === fnvPage(q.question)) && w.ctx.qhash_('Quelle est la capitale ? é') === fnvPage('Quelle est la capitale ? é'), 'empreinte des énoncés identique côté serveur et côté page (accents compris)');
ok(new Set(w.ctx.BUILTIN_QUIZZES.flatMap(q => q.questions.map(x => w.ctx.qhash_(x.question)))).size === w.ctx.BUILTIN_QUIZZES.reduce((n, q) => n + q.questions.length, 0), 'aucune collision d\'empreinte entre les ' + w.ctx.BUILTIN_QUIZZES.reduce((n, q) => n + q.questions.length, 0) + ' questions intégrées');

// ---- enregistrement des résultats ----
{ const x = sr(...L, 'zootopia', h(0), true); ok(x.ok === 1 && x.fails === 0, 'réussite : 1 / 2'); }
sr(...L, 'zootopia', h(0), true);
ok(sr(...L, 'zootopia', h(0), true).ok === 2, '2 réussites consécutives : 2 / 2 (vérifiée)');
ok(sr(...L, 'zootopia', h(0), true).ok === 2, 'une 3e réussite ne dépasse pas 2');
{ const x = sr(...L, 'zootopia', h(0), false); ok(x.ok === 0 && x.fails === 1, 'une erreur remet à 0 et compte 1 erreur'); }
sr(...L, 'zootopia', h(1), true);
ok(sr(...L, 'zootopia', h(0), false).fails === 2, 'les erreurs s\'accumulent (2)');
const d = w.run('getStudentData', ...L);
ok(d.progress.zootopia[h(0)].join() === '0,2' && d.progress.zootopia[h(1)].join() === '1,0', 'getStudentData renvoie la progression : ' + JSON.stringify(d.progress.zootopia).slice(0, 80));
ok(!('byzance' in d.progress), 'seuls les quiz déjà joués ont une progression');

// ---- sécurité ----
ok(w.try('saveResult', '5B', 'Léo', '0000', 'zootopia', h(0), true).err === 'Classe, pseudo ou PIN incorrect.', 'enregistrement refusé avec un mauvais PIN');
ok(w.try('saveResult', ...N, 'zootopia', h(0), true).err === 'Quiz inaccessible.', 'Nina (sans accès à Zootopia) ne peut rien y enregistrer');
ok(w.try('saveResult', ...L, 'maths', h(0), true).err === 'Quiz inaccessible.', 'Léo ne peut pas écrire dans le quiz « Maths » d\'Emma');
ok(w.try('saveResult', ...L, 'zootopia', 'deadbeef', true).err === 'Question inconnue.', 'une empreinte qui n\'appartient pas au quiz est refusée');
ok(w.try('saveResult', ...L, 'zootopia', 'pas-une-empreinte', true).err === 'Question inconnue.', 'format d\'empreinte invalide refusé');
ok(w.try('saveResult', ...L, '__proto__', h(0), true).err === 'Quiz inaccessible.', 'identifiant de quiz piégé refusé');
ok(!Object.keys(w.props).some(k => k.startsWith('prog_emma__')), 'Emma n\'a aucune progression : les écritures de Léo ne la touchent pas');
sr(...E, 'zootopia', h(0), true);
ok(w.run('getStudentData', ...E).progress.zootopia[h(0)].join() === '1,0' && w.run('getStudentData', ...L).progress.zootopia[h(0)].join() === '0,2', 'la progression d\'Emma est indépendante de celle de Léo sur le même quiz');
const eC = w.run('getStudentData', ...E).quizzes.find(q => q.id === custom.id);
sr(...E, custom.id, cqid, true);
ok(w.run('getStudentData', ...E).progress[custom.id][cqid].join() === '1,0', 'progression aussi enregistrée sur un quiz créé depuis l\'administration');

// ---- résumé pour l'administration ----
for (let i = 2; i < 5; i++) { for (let k = 0; k < 2; k++) sr(...L, 'zootopia', h(i), true); }
const adm = w.run('adminData', PW);
const lz = adm.progress.leo.find(x => x.id === 'zootopia');
ok(lz.total === 10 && lz.sues === 3 && lz.enCours === 1 && lz.erreurs === 2 && lz.maj > 0, 'résumé de Léo sur Zootopia : ' + JSON.stringify(lz));
ok(adm.progress.leo.map(x => x.id).sort().join() === 'byzance,zootopia' && adm.progress.emma.map(x => x.id).sort().join() === 'maths,zootopia'.split(',').sort().join() && adm.progress.nina.length === 0, 'chaque élève n\'a que ses leçons (Léo : 2, Emma : 2, Nina : aucune)');
ok(adm.progress.leo.find(x => x.id === 'byzance').sues === 0 && adm.progress.leo.find(x => x.id === 'byzance').maj === 0, 'une leçon jamais jouée : 0 sue, aucune activité');
ok(w.try('adminData', 'faux').err === 'Mot de passe incorrect.', 'résumé de progression : mot de passe admin requis');
ok(!JSON.stringify(adm).includes('1234') && !JSON.stringify(adm.progress).includes(h(0)), 'ni PIN ni détail question par question dans la vue admin');

// ---- remise à zéro ciblée ----
ok(w.try('resetProgress', 'faux', 'leo', 'zootopia').err === 'Mot de passe incorrect.', 'remise à zéro refusée sans mot de passe');
ok(w.try('resetProgress', PW, 'inconnu', 'zootopia').err === 'Élève inconnu.', 'élève inconnu refusé');
ok(w.try('resetProgress', PW, 'leo', 'Pas Valide!').err === 'Identifiant de quiz invalide.', 'identifiant de quiz invalide refusé');
sr(...L, 'byzance', w.ctx.qhash_(w.ctx.BUILTIN_QUIZZES[0].questions[0].question), true);
ok(w.run('resetProgress', PW, 'leo', 'zootopia').supprimes === 2, 'remise à zéro d\'UNE leçon pour UN élève : progression + parcours supprimés');
const after = w.run('adminData', PW);
ok(after.progress.leo.find(x => x.id === 'zootopia').sues === 0 && after.progress.leo.find(x => x.id === 'byzance').enCours === 1, 'Léo : Zootopia remis à 0, mais Byzance conservé');
ok(after.progress.emma.find(x => x.id === 'zootopia').enCours === 1 && after.progress.emma.find(x => x.id === 'maths').enCours === 1, 'Emma n\'est pas touchée (Zootopia et Maths conservés)');
ok(Object.keys(w.run('getStudentData', ...L).progress).join() === 'byzance', 'à sa reconnexion, Léo retrouve Zootopia vide et Byzance intact');
w.run('resetProgress', PW, 'leo', 'all');
ok(!Object.keys(w.props).some(k => k.startsWith('prog_leo__')) && Object.keys(w.props).some(k => k.startsWith('prog_emma__')), 'toutes les leçons d\'un élève : Léo vidé, Emma intacte');
sr(...L, 'zootopia', h(0), true);
ok(w.run('resetProgress', PW, 'all', 'zootopia').supprimes === 4, 'une leçon pour tous les élèves : progression et parcours de Léo et d\'Emma supprimés');
ok(w.run('adminData', PW).progress.emma.find(x => x.id === 'maths').enCours === 1, '… mais pas les autres leçons d\'Emma');
w.run('resetProgress', PW, 'all', 'all');
ok(!Object.keys(w.props).some(k => k.startsWith('prog_')), 'tout pour tous : plus aucune progression');
ok(typeof w.ctx.resetProgramme === 'undefined', 'l\'ancienne remise à zéro globale n\'existe plus');

// ---- nettoyage à la suppression ----
sr(...E, custom.id, cqid, true); sr(...L, 'byzance', w.ctx.qhash_(w.ctx.BUILTIN_QUIZZES[0].questions[0].question), true);
w.run('deleteQuiz', PW, custom.id);
ok(!Object.keys(w.props).some(k => k.startsWith('prog_') && k.endsWith('__' + custom.id)) && Object.keys(w.props).some(k => k.startsWith('prog_leo__byzance')), 'supprimer un quiz efface sa progression (pour tous), pas celle des autres quiz');
w.run('deleteStudent', PW, 'leo');
ok(!Object.keys(w.props).some(k => k.startsWith('prog_leo__')), 'supprimer un élève efface sa progression');
process.exit(summary() ? 1 : 0);
