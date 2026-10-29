const { makeWorld, ok, summary } = require('./harness');
const w = makeWorld(); const pw = 'secret';

// --- comptes ---
const leo = w.run('saveStudent', pw, { classe: '5B', pseudo: 'Léo', pin: '1234' });
const emma = w.run('saveStudent', pw, { classe: '5B', pseudo: 'Emma', pin: '987654' });
ok(leo.id === 'leo' && emma.id === 'emma', 'comptes créés : ' + leo.id + ', ' + emma.id);
const raw = w.props['student_leo'];
ok(!raw.includes('1234') && /"hash":"[0-9a-f]{64}"/.test(raw) && raw.includes('"salt"'), 'le PIN n\'est jamais stocké en clair (hash SHA-256 salé)');
ok(w.try('saveStudent', pw, { classe: '5B', pseudo: 'Zoé', pin: '123' }).err.includes('4 à 8 chiffres'), 'PIN de 3 chiffres refusé');
ok(w.try('saveStudent', pw, { classe: '5B', pseudo: 'Zoé', pin: 'abcd' }).err.includes('4 à 8 chiffres'), 'PIN avec des lettres refusé');
ok(w.try('saveStudent', pw, { classe: '5B', pseudo: 'Zoé', pin: '' }).err.includes('PIN est obligatoire'), 'PIN obligatoire à la création');
ok(w.try('saveStudent', pw, { classe: '', pseudo: 'Zoé', pin: '1234' }).err.includes('classe'), 'classe obligatoire');
ok(w.try('saveStudent', pw, { classe: ' 5b ', pseudo: 'LEO', pin: '4321' }).err.includes('existe déjà'), 'doublon refusé (insensible à la casse, aux accents et aux espaces)');
ok(w.try('saveStudent', 'faux', { classe: '5B', pseudo: 'X', pin: '1234' }).err === 'Mot de passe incorrect.', 'création refusée sans le mot de passe admin');
const adm = w.run('adminData', pw);
ok(adm.students.length === 2 && !JSON.stringify(adm).includes('"hash"') && !JSON.stringify(adm).includes('"salt"'), 'adminData ne renvoie ni hash ni sel');

// --- connexion ---
const e1 = w.try('getStudentData', '5B', 'Léo', '0000').err, e2 = w.try('getStudentData', '5B', 'Inconnu', '1234').err, e3 = w.try('getStudentData', '6A', 'Léo', '1234').err;
ok(e1 === 'Classe, pseudo ou PIN incorrect.' && e1 === e2 && e2 === e3, 'mauvais PIN / pseudo inconnu / mauvaise classe : même message (on ne révèle pas ce qui est faux)');
const d = w.run('getStudentData', ' 5b ', 'léo', '1234');
ok(d.student.id === 'leo' && d.student.pseudo === 'Léo', 'connexion insensible à la casse, aux accents et aux espaces : ' + JSON.stringify(d.student));
ok(!JSON.stringify(d.student).includes('hash'), 'aucune donnée secrète dans la réponse');

// --- séparation : tout est caché tant que rien n'est attribué ---
ok(d.quizzes.length === 0 && d.decks.length === 0, 'rien n\'est attribué : l\'élève ne voit aucun quiz (caché par défaut)');
ok(w.try('setBuiltinAssign', pw, 'inconnu', ['leo']).err === 'Quiz intégré inconnu.', 'quiz intégré inconnu refusé');
w.run('setBuiltinAssign', pw, 'byzance', ['leo']);
w.run('setBuiltinAssign', pw, 'zootopia', ['emma', 'fantome', 'emma']);
ok(JSON.stringify(w.run('setBuiltinAssign', pw, 'zootopia', ['emma', 'fantome', 'emma']).pour) === '["emma"]', 'identifiants inconnus et doublons retirés');
let L = w.run('getStudentData', '5B', 'Léo', '1234'), E = w.run('getStudentData', '5B', 'Emma', '987654');
ok(L.quizzes.map(q => q.id).join() === 'byzance' && E.quizzes.map(q => q.id).join() === 'zootopia', 'Léo voit Byzance seulement, Emma voit Zootopia seulement');
ok(!JSON.stringify(L).includes('Zootopia') && !JSON.stringify(E).includes('Byzance'), 'le contenu de l\'autre élève n\'apparaît nulle part dans la réponse');

// quiz créé pour Emma seulement
const q = w.run('saveQuiz', pw, { titre: 'Maths', questions: [{ question: '2+2 ?', options: ['3', '4'], correct: 1 }], pour: ['emma', 'fantome'] });
L = w.run('getStudentData', '5B', 'Léo', '1234'); E = w.run('getStudentData', '5B', 'Emma', '987654');
ok(!L.quizzes.some(x => x.id === q.id) && E.quizzes.some(x => x.id === q.id), 'quiz créé « pour Emma » : invisible pour Léo, visible pour Emma');
ok(!JSON.stringify(E).includes('"pour"') && !JSON.stringify(E).includes('leo'), 'le champ « pour » (et les identifiants des autres) n\'est pas transmis à l\'élève');
// quiz sans destinataire = caché
const q2 = w.run('saveQuiz', pw, { titre: 'Brouillon', questions: [{ question: 'q', options: ['a', 'b'], correct: 0 }] });
ok(!w.run('getStudentData', '5B', 'Léo', '1234').quizzes.some(x => x.id === q2.id) && !w.run('getStudentData', '5B', 'Emma', '987654').quizzes.some(x => x.id === q2.id), 'quiz sans destinataire : caché pour tout le monde');
// quiz pour les deux + paquet
const q3 = w.run('saveQuiz', pw, { titre: 'Commun', questions: [{ question: 'q', options: ['a', 'b'], correct: 0 }], pour: ['leo', 'emma'] });
const dk = w.run('saveDeck', pw, { titre: 'Mots', cartes: [{ recto: 'dog', verso: 'chien' }], pour: ['leo'] });
L = w.run('getStudentData', '5B', 'Léo', '1234'); E = w.run('getStudentData', '5B', 'Emma', '987654');
ok(L.quizzes.some(x => x.id === q3.id) && E.quizzes.some(x => x.id === q3.id), 'quiz pour les deux : visible des deux');
ok(L.decks.length === 1 && E.decks.length === 0, 'paquet de flashcards pour Léo : invisible pour Emma');

// --- accès administrateur ---
ok(typeof w.ctx.getQuizzes === 'undefined' && typeof w.ctx.getDecks === 'undefined' && typeof w.ctx.getProgrammeReset === 'undefined', 'plus aucune lecture publique de la liste des quiz/paquets');
ok(w.try('adminData', 'faux').err === 'Mot de passe incorrect.', 'adminData refusée sans mot de passe');
for (const f of ['students_', 'authStudent_', 'list_', 'hashPin_', 'checkAdmin_']) { /* appelables en interne mais pas depuis une page */ }
(async () => {
  for (const f of ['students_', 'authStudent_', 'list_', 'hashPin_', 'checkAdmin_', 'doGet']) ok((await w.call(f, [])).err.startsWith('Fonction indisponible'), 'fonction interne non appelable depuis une page : ' + f);

  // --- blocage après erreurs de PIN ---
  for (let i = 0; i < 5; i++) w.try('getStudentData', '5B', 'Emma', '0000');
  ok(w.try('getStudentData', '5B', 'Emma', '987654').err.startsWith("Trop d'essais"), 'après 5 mauvais PIN : même le bon PIN est refusé (blocage)');
  ok(!w.try('getStudentData', '5B', 'Léo', '1234').err, 'le blocage ne touche que l\'élève visé');
  w.advance(301000);
  ok(!w.try('getStudentData', '5B', 'Emma', '987654').err, 'après 5 minutes : le bon PIN fonctionne de nouveau');
  for (let i = 0; i < 4; i++) w.try('getStudentData', '5B', 'Emma', '0000');
  w.run('getStudentData', '5B', 'Emma', '987654');
  for (let i = 0; i < 4; i++) w.try('getStudentData', '5B', 'Emma', '0000');
  ok(!w.try('getStudentData', '5B', 'Emma', '987654').err, 'un succès remet le compteur d\'erreurs à zéro');

  // --- modification d'un compte ---
  w.run('saveStudent', pw, { id: 'leo', classe: '5B', pseudo: 'Léo', pin: '' });
  ok(!w.try('getStudentData', '5B', 'Léo', '1234').err, 'modifier sans PIN conserve l\'ancien PIN');
  w.run('saveStudent', pw, { id: 'leo', classe: '5C', pseudo: 'Léo', pin: '5555' });
  ok(w.try('getStudentData', '5B', 'Léo', '1234').err && !w.try('getStudentData', '5C', 'Léo', '5555').err, 'nouvelle classe + nouveau PIN : l\'ancien ne marche plus');
  ok(w.run('getStudentData', '5C', 'Léo', '5555').quizzes.some(x => x.id === 'byzance'), 'ses quiz attribués le suivent après le changement de classe');

  // --- suppression : plus aucun accès hérité ---
  w.run('deleteStudent', pw, 'leo');
  ok(w.try('getStudentData', '5C', 'Léo', '5555').err === 'Classe, pseudo ou PIN incorrect.', 'élève supprimé : connexion impossible');
  ok(!JSON.stringify(w.run('adminData', pw)).includes('"leo"'), 'élève supprimé retiré des attributions (quiz intégrés, quiz, paquets, remises à zéro)');
  const leo2 = w.run('saveStudent', pw, { classe: '5B', pseudo: 'Léo', pin: '1111' });
  const L2 = w.run('getStudentData', '5B', 'Léo', '1111');
  ok(leo2.id === 'leo' && L2.quizzes.length === 0 && L2.decks.length === 0 && Object.keys(L2.progress).length === 0 && !Object.keys(w.props).some(k => k.startsWith('prog_leo__')), 'un nouvel élève de même pseudo ne récupère AUCUN accès de l\'ancien (ni quiz, ni paquet, ni progression)');
  console.log(); process.exit(summary() ? 1 : 0);
})();
