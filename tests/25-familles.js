// Familles : inscription avec code d'invitation, chaque parent ne voit que sa famille, mots de passe, onglet Parents (serveur)
const { makeWorld, ok, summary } = require('./harness');

const w = makeWorld();
const ADM = { pseudo: 'Papa', password: 'secret' };
const DUP = { pseudo: 'Dupont', password: 'motdepasse1' };
const err = (fn, ...a) => (w.try(fn, ...a).err || '');

// ---- 1. l'administrateur principal : sa famille, le code d'invitation ----
w.run('saveStudent', ADM, { classe: 'Gaby', pseudo: 'Jul', pin: '1111' });
w.run('setBuiltinAssign', ADM, 'zootopia', ['jul']);
let d = w.run('adminData', ADM);
ok(d.moi.owner === true && d.moi.pseudo === 'Papa' && Array.isArray(d.parents) && d.parents.length === 0 && d.invitation === '' && d.stockage.max === 500000 && d.stockage.octets > 0, 'administrateur : onglet Parents (aucune famille), pas de code, stockage ' + d.stockage.octets + ' o');
ok(err('createFamily', 'ABCD-EFGH', { famille: 'Dupont', pseudo: 'Dupont', password: 'motdepasse1' }).includes('inscriptions sont fermées'), 'sans code d\'invitation : inscriptions fermées');
const code = w.run('setInviteCode', ADM, 'new').code;
ok(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code) && w.props.INVITE_CODE === code, 'code d\'invitation facile à dicter : ' + code);

// ---- 2. inscription d'une famille ----
ok(err('createFamily', 'XXXX-XXXX', { famille: 'Dupont', pseudo: 'Dupont', password: 'motdepasse1' }) === 'Code d\'invitation incorrect.', 'mauvais code : refusé');
ok(err('createFamily', code, { famille: 'Dupont', pseudo: 'Dupont', password: 'court' }).includes('au moins 8 caractères'), 'mot de passe trop court : refusé');
ok(err('createFamily', code, { famille: 'Martin', pseudo: ' papa ', password: 'motdepasse1' }).includes('déjà pris'), 'pseudo de l\'administrateur : refusé');
ok(err('createFamily', code, { famille: '', pseudo: 'Dupont', password: 'motdepasse1' }).includes('nom de ta famille'), 'nom de famille obligatoire');
const created = w.run('createFamily', code.toLowerCase().replace('-', ' '), { famille: 'Famille Dupont', pseudo: 'Dupont', password: 'motdepasse1' });
ok(created.famille === 'Famille Dupont' && JSON.parse(w.props.parent_dupont).hash && !w.props.parent_dupont.includes('motdepasse1'), 'famille créée (code en minuscules accepté) ; mot de passe haché');
ok(err('createFamily', code, { famille: 'Autre', pseudo: 'DUPONT', password: 'motdepasse1' }).includes('déjà pris'), 'même pseudo qu\'un autre parent : refusé');

// ---- 3. le parent invité ne voit que SA famille ----
d = w.run('adminData', DUP);
ok(d.moi.owner === false && d.moi.famille === 'Famille Dupont' && d.students.length === 0 && d.quizzes.length === 0 && !('parents' in d) && d.builtins.every(b => b.pour.length === 0 && b.modifie === false), 'parent invité : aucun élève, aucune leçon de l\'administrateur, pas d\'onglet Parents');
w.run('saveStudent', DUP, { classe: 'Dupont', pseudo: 'Lou', pin: '2222' });
ok(err('saveStudent', DUP, { classe: 'gaby', pseudo: 'JUL', pin: '3333' }).includes('Un autre élève utilise déjà ce pseudo'), 'même classe + pseudo qu\'un élève d\'une autre famille : refusé (connexion élève unique)');
ok(err('saveStudent', DUP, { id: 'jul', classe: 'Gaby', pseudo: 'Jules', pin: '' }) === 'Élève inconnu.', 'modifier l\'élève d\'une autre famille : refusé');
ok(err('deleteStudent', DUP, 'jul') === 'Élève inconnu.' && !!w.props.student_jul, 'supprimer l\'élève d\'une autre famille : refusé');
w.run('setBuiltinAssign', DUP, 'zootopia', ['lou', 'jul']);
ok(JSON.stringify(JSON.parse(w.props.builtin_assign).zootopia.sort()) === '["jul","lou"]', 'leçon fournie donnée à Lou : Jul la garde, l\'id d\'un autre enfant est ignoré');
w.run('setBuiltinAssign', DUP, 'zootopia', []);
ok(JSON.stringify(JSON.parse(w.props.builtin_assign).zootopia) === '["jul"]', 'Lou n\'y a plus accès : l\'accès de Jul (autre famille) est intact');
w.run('setBuiltinAssign', DUP, 'zootopia', ['lou']);
ok(err('getBuiltinForEdit', DUP, 'zootopia').includes('administrateur principal') && err('saveBuiltin', DUP, 'zootopia', { titre: 'x', questions: [{ question: 'a', reponses: ['b'] }] }).includes('administrateur principal') && err('restoreBuiltin', DUP, 'zootopia').includes('administrateur principal'), 'modifier ou rétablir une leçon fournie : réservé à l\'administrateur principal');
const quizDup = w.run('saveQuiz', DUP, { titre: 'Tables de 7', pour: ['lou', 'jul'], questions: [{ question: '7 × 3 ?', reponses: ['21'] }] });
ok(JSON.stringify(JSON.parse(w.props['quiz_' + quizDup.id]).pour) === '["lou"]' && JSON.parse(w.props['quiz_' + quizDup.id]).fam === 'dupont', 'leçon créée : rangée dans la famille, destinataires limités à ses enfants');
const quizAdm = w.run('saveQuiz', ADM, { titre: 'Secret de Papa', pour: ['jul'], questions: [{ question: 'q ?', reponses: ['r'] }] });
ok(err('saveQuiz', DUP, { id: quizAdm.id, titre: 'piraté', questions: [{ question: 'q', reponses: ['r'] }] }) === 'Élément introuvable.' && err('deleteQuiz', DUP, quizAdm.id) === 'Élément introuvable.' && !!w.props['quiz_' + quizAdm.id], 'modifier ou supprimer la leçon d\'une autre famille : refusé');
ok(w.run('adminData', ADM).quizzes.map(q => q.id).join() === quizAdm.id && w.run('adminData', DUP).quizzes.map(q => q.id).join() === quizDup.id, 'chacun ne voit que ses leçons créées');
const deckDup = w.run('saveDeck', DUP, { titre: 'Mots', pour: ['lou'], cartes: [{ recto: 'dog', verso: 'chien' }] });
ok(w.run('adminData', DUP).decks.length === 1 && w.run('adminData', ADM).decks.length === 0, 'paquets de flashcards séparés aussi');

// ---- 4. progression : chacun chez soi ----
const lou = w.run('getStudentData', 'Dupont', 'Lou', '2222');
ok(lou.quizzes.map(q => q.id).sort().join() === [quizDup.id, 'zootopia'].sort().join() && lou.decks.length === 1 && !('fam' in lou.quizzes.find(q => q.id === quizDup.id)), 'Lou (page élève) : ses 2 leçons et son paquet, sans donnée de famille');
w.props['srs_jul__zootopia'] = JSON.stringify({ v: 3, it: {}, exam: '', plan: [], tf: false, mode: 'actif', ses: [], maj: 1 });
w.props['srs_lou__zootopia'] = JSON.stringify({ v: 3, it: {}, exam: '', plan: [], tf: false, mode: 'actif', ses: [], maj: 1 });
ok(err('setLessonPlanAdmin', DUP, 'jul', 'zootopia', '') === 'Élève inconnu.' && err('resetProgress', DUP, 'jul', 'all') === 'Élève inconnu.', 'date du contrôle ou remise à zéro sur l\'enfant d\'une autre famille : refusé');
w.run('deleteQuiz', DUP, 'zootopia');
ok(!!w.props['srs_jul__zootopia'] && !!w.props['srs_lou__zootopia'], '« supprimer » une leçon fournie (id zootopia) : ne touche à aucune progression');
w.run('resetProgress', DUP, 'all', 'all');
ok(!w.props['srs_lou__zootopia'] && !!w.props['srs_jul__zootopia'], '« Tout remettre à zéro » d\'un parent : seulement ses enfants');
d = w.run('adminData', DUP);
ok(Object.keys(d.progress).join() === 'lou' && d.builtins.find(b => b.id === 'zootopia').pour.join() === 'lou', 'suivi du parent : seulement Lou');

// ---- 5. onglet Parents (administrateur) ----
d = w.run('adminData', ADM);
const fam = d.parents[0];
ok(d.parents.length === 1 && fam.pseudo === 'Dupont' && fam.famille === 'Famille Dupont' && fam.enfants === 1 && fam.vu > 0 && !('hash' in fam) && !('salt' in fam), 'liste des familles : Dupont, 1 enfant, dernière connexion ; jamais de mot de passe haché');
ok(d.students.map(s => s.id).join() === 'jul' && d.builtins.find(b => b.id === 'zootopia').pour.join() === 'jul', 'l\'administrateur voit sa famille dans Suivi/Élèves (pas les enfants des autres)');
ok(err('setInviteCode', DUP, 'new').includes('administrateur principal') && err('backupData', DUP).includes('administrateur principal') && err('deleteFamily', DUP, 'dupont').includes('administrateur principal'), 'code, sauvegarde, suppression de famille : réservés à l\'administrateur');

// ---- 6. mots de passe ----
ok(err('changePassword', DUP, 'court').includes('au moins 8'), 'nouveau mot de passe trop court : refusé');
w.run('changePassword', DUP, 'nouveau-mdp-1');
ok(err('adminData', DUP) === 'Pseudo ou mot de passe incorrect.' && w.run('adminData', { pseudo: 'dupont', password: 'nouveau-mdp-1' }).moi.famille === 'Famille Dupont', 'le parent change son mot de passe : l\'ancien ne marche plus, le nouveau oui');
w.run('changePassword', ADM, 'papa-2026!');
ok(!w.props.ADMIN_PASSWORD && /^[^:]+:[0-9a-f]{64}$/.test(w.props.ADMIN_PASS_HASH) && err('adminData', ADM) === 'Pseudo ou mot de passe incorrect.', 'administrateur : nouveau mot de passe haché, ADMIN_PASSWORD (en clair) retiré, l\'ancien refusé');
const ADM2 = { pseudo: 'Papa', password: 'papa-2026!' };
ok(w.run('adminData', ADM2).moi.owner === true, 'administrateur : connexion avec le nouveau mot de passe');
ok(!('ADMIN_PASS_HASH' in w.run('backupData', ADM2).proprietes), 'la sauvegarde ne contient pas le mot de passe de l\'administrateur');
w.run('resetParentPassword', ADM2, 'dupont', 'temporaire-9');
ok(w.run('adminData', { pseudo: 'Dupont', password: 'temporaire-9' }).moi.owner === false, 'mot de passe oublié d\'un parent : l\'administrateur lui en donne un nouveau');
w.props.ADMIN_PASSWORD = 'secours-123';
const ADM3 = { pseudo: 'Papa', password: 'secours-123' };
ok(w.run('adminData', ADM3).moi.owner === true && err('adminData', ADM2) === 'Pseudo ou mot de passe incorrect.', 'mot de passe oublié de l\'administrateur : remettre ADMIN_PASSWORD dans le script suffit (il reprend le dessus)');

// ---- 7. anti-force-brute ----
for (let i = 0; i < 8; i++) w.try('adminData', { pseudo: 'Dupont', password: 'faux' + i });
ok(err('adminData', { pseudo: 'Dupont', password: 'temporaire-9' }).includes('Trop d\'essais'), '8 erreurs sur un pseudo : blocage temporaire, même avec le bon mot de passe');
w.advance(301000);
ok(w.run('adminData', { pseudo: 'Dupont', password: 'temporaire-9' }).moi.famille === 'Famille Dupont', 'après 5 minutes : de nouveau possible');
for (let i = 0; i < 20; i++) w.try('createFamily', 'ZZZZ-ZZZ' + i, { famille: 'X', pseudo: 'X', password: 'motdepasse1' });
ok(err('createFamily', w.props.INVITE_CODE, { famille: 'Martin', pseudo: 'Martin', password: 'motdepasse1' }).includes('Trop d\'essais'), '20 mauvais codes d\'invitation : inscriptions bloquées quelques minutes');
w.advance(301000);

// ---- 8. supprimer une famille : tout ce qui est à elle, rien d'autre ----
w.run('createFamily', w.props.INVITE_CODE, { famille: 'Martin', pseudo: 'Martin', password: 'motdepasse1' });
w.props['srs_lou__zootopia'] = JSON.stringify({ v: 3, it: {}, exam: '', plan: [], tf: false, mode: 'actif', ses: [], maj: 1 });
w.run('deleteFamily', ADM3, 'dupont');
ok(!w.props.parent_dupont && !w.props.student_lou && !w.props['quiz_' + quizDup.id] && !w.props['deck_' + deckDup.id] && !w.props['srs_lou__zootopia'] && JSON.stringify(JSON.parse(w.props.builtin_assign).zootopia) === '["jul"]', 'famille Dupont supprimée : compte, enfant, leçon, paquet, progression, accès');
ok(!!w.props.student_jul && !!w.props['quiz_' + quizAdm.id] && !!w.props['srs_jul__zootopia'] && !!w.props.parent_martin, 'la famille de l\'administrateur et la famille Martin sont intactes');
w.run('setInviteCode', ADM3, 'close');
ok(!w.props.INVITE_CODE && err('createFamily', 'ABCD-EFGH', { famille: 'Y', pseudo: 'Yves', password: 'motdepasse1' }).includes('fermées'), 'fermer les inscriptions');

process.exit(summary() ? 1 : 0);
