function doGet(e) {
  // Récupère le nom de la page demandée via le paramètre URL ?p=nom_du_fichier (ex : ?p=admin)
  // Si aucun paramètre n'est spécifié, le script charge le fichier 'Index' par défaut.
  var page = (e && e.parameter && e.parameter.p) ? e.parameter.p : 'Index';

  try {
    return HtmlService.createHtmlOutputFromFile(page)
      .setTitle('Portail de Révisions')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    // Si le fichier HTML demandé n'existe pas, retour automatique sur 'Index'
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Portail de Révisions')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
}

// ---------------------------------------------------------------
// Comptes élèves, quiz et flashcards.
//
// Tout est stocké dans les propriétés du script :
//   student_<id>  un compte élève (classe, pseudo, PIN haché)
//   quiz_<id>     un quiz créé depuis l'administration
//   deck_<id>     un paquet de flashcards créé depuis l'administration
//   override_<id>  version modifiée d'un quiz intégré (voir Contenu.gs) ; l'original n'est jamais modifié
//   builtin_assign  à qui est donné chaque quiz intégré (voir Contenu.gs)
// Un élément trop gros pour une propriété (9 Ko) est découpé en morceaux : <clé>~0, <clé>~1…
//   prog_<idÉlève>__<idQuiz>  la progression d'un élève dans un quiz (réussites d'affilée par question)
//   done_<idÉlève>__<idQuiz>  combien de fois l'élève a terminé ce quiz (historique : la remise à zéro de la progression n'y touche pas)
//   parcours_<idÉlève>__<idQuiz>  où en est l'élève dans le parcours de révision de cette leçon (voir plus bas)
// Le mot de passe administrateur est la propriété ADMIN_PASSWORD.
//
// Séparation des élèves : le serveur ne renvoie à un élève que les quiz et paquets qui lui sont destinés
// (champ « pour »). Un quiz ou un paquet sans destinataire reste caché.
// ---------------------------------------------------------------
var QUIZ_PREFIX = 'quiz_';
var DECK_PREFIX = 'deck_';
var STUDENT_PREFIX = 'student_';
var OVERRIDE_PREFIX = 'override_';   // version modifiée d'un quiz intégré (l'original reste dans Contenu.gs)
var BUILTIN_ASSIGN_KEY = 'builtin_assign';
var PROGRESS_PREFIX = 'prog_';
var DONE_PREFIX = 'done_';
var PARCOURS_PREFIX = 'parcours_';
var MASTERY = 2;            // réussites consécutives aux quiz pour qu'une question soit vérifiée
var MAX_QUESTIONS = 50;
var MAX_CARDS = 150;
var MAX_FIELDS = 12;       // champs maximum dans une question à plusieurs champs
var MAX_STUDENTS = 40;
var MAX_VALUE_BYTES = 8500; // une propriété est limitée à 9 Ko : au-delà, on découpe
var CHUNK_CHARS = 3000;     // taille d'un morceau (3 octets au pire par caractère, donc < 9 Ko)
var MAX_ITEM_CHARS = 250000; // plafond de sécurité pour un quiz ou un paquet
var MAX_PIN_FAILS = 5;      // erreurs de PIN avant blocage temporaire
var LOCK_SECONDS = 300;     // durée du blocage (5 minutes)

// ---------------- Côté élève ----------------

// Connexion + données de l'élève en un seul appel. Les identifiants sont revérifiés à chaque appel.
function getStudentData(classe, pseudo, pin) {
  var st = authStudent_(classe, pseudo, pin);
  var quizzes = quizzesOf_(st.id);
  var decks = list_(DECK_PREFIX).filter(function (d) { return isFor_(d, st.id); }).map(withoutPour_);
  var props = PropertiesService.getScriptProperties().getProperties();
  var progress = {};
  var fois = {};
  var parcours = {};
  quizzes.forEach(function (q) {
    var rec = parseJson_(props[progressKey_(st.id, q.id)]);
    parcours[q.id] = presentParcours_(readParcours_(props[parcoursKey_(st.id, q.id)], q, rec), q);
    if (rec && rec.q) progress[q.id] = rec.q;
    var done = parseJson_(props[doneKey_(st.id, q.id)]);
    if (done && done.n) fois[q.id] = done.n;
  });
  return {
    student: { id: st.id, classe: st.classe, pseudo: st.pseudo },
    quizzes: quizzes.map(withoutPour_),
    decks: decks,
    progress: progress,
    fois: fois,
    parcours: parcours
  };
}

// Enregistre le résultat d'une question pendant un passage de quiz (quiz initial ou vérification).
// Réussite du premier essai => une réussite d'affilée de plus (MASTERY = 2 : question « vérifiée », plafonnée) ;
// erreur ou « Je ne sais pas » => retour à 0 et une erreur de plus. Une question n'est comptée qu'UNE fois par passage
// (double envoi, nouvelle tentative réseau, opId rejoué : sans effet). Hors passage de quiz, le résultat est ignoré.
// Les identifiants sont revérifiés ; seul un quiz auquel l'élève a accès, et une question de ce passage, sont acceptés.
function saveResult(classe, pseudo, pin, quizId, qhash, success, opId) {
  var st = authStudent_(classe, pseudo, pin);
  var quiz = quizzesOf_(st.id).filter(function (q) { return q.id === quizId; })[0];
  if (!quiz) throw new Error('Quiz inaccessible.');
  if (!/^[0-9a-f]{8}$/.test(String(qhash)) || !quiz.questions.some(function (q) { return qid_(q) === qhash; })) {
    throw new Error('Question inconnue.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var store = PropertiesService.getScriptProperties();
    var key = progressKey_(st.id, quizId);
    var rec = parseJson_(store.getProperty(key)) || { q: {}, maj: 0 };
    var pc = readParcours_(store.getProperty(parcoursKey_(st.id, quizId)), quiz, rec);
    var cur = rec.q[qhash] || [0, 0];
    var out = function (extra) { var o = { ok: Math.min(MASTERY, cur[0]), fails: cur[1], parcours: presentParcours_(pc, quiz) }; for (var k in extra) o[k] = extra[k]; return o; };
    if (seenOp_(pc, opId)) return out({ rejoue: true });
    if (pc.etape === 'quiz_initial' && !pc.pass) pc.pass = { kind: 'initial', list: quizIds_(quiz), res: {} };
    if (!pc.pass) return out({ ignore: true });
    if (pc.pass.list.indexOf(qhash) < 0) throw new Error('Question inconnue pour ce passage.');
    if (pc.pass.res[qhash] !== undefined) { rememberOp_(pc, opId); store.setProperty(parcoursKey_(st.id, quizId), JSON.stringify(pc)); return out({ rejoue: true }); }
    // une série déjà au-dessus du seuil (anciennes données) n'est pas abaissée par une réussite
    cur = success === true ? [cur[0] >= MASTERY ? cur[0] : cur[0] + 1, cur[1]] : [0, cur[1] + 1];
    rec.q[qhash] = cur;
    rec.maj = Date.now();
    pc.pass.res[qhash] = success === true ? 1 : 0;
    rememberOp_(pc, opId); pc.maj = rec.maj;
    store.setProperty(key, JSON.stringify(rec));
    store.setProperty(parcoursKey_(st.id, quizId), JSON.stringify(pc));
    return out({});
  } finally {
    lock.releaseLock();
  }
}

// ---------------- Parcours de révision d'une leçon (schemaVersion 2) ----------------
//   quiz_initial       un seul passage COMPLET du quiz (toutes les questions) ;
//   cartes_ciblees     flashcards des questions ratées (ou « Je ne sais pas ») ; chaque carte doit être retournée, évaluée
//                      (Oublié / Hésité / Trouvé) et finir Trouvé ; puis vérification ;
//   verification       passages de quiz sur les questions dont la série est < MASTERY (2 réussites consécutives) ;
//                      une erreur renvoie aux cartes ciblées, sinon passage suivant tant qu'il reste des questions à 1 sur 2 ;
//   cartes_finales     paquet complet (toutes les questions), même règle que les cartes ciblées ;
//   attente_validation « Faire valider par un adulte » demandé ; valide : validé par l'administrateur (validateParcours).
// Le serveur décide de l'étape. L'auto-évaluation des cartes est déclarative : elle ne modifie jamais les séries du quiz.
// Enregistrement : { v:2, etape, pass:{kind,list,res}|null, pile:{kind,ids,etat:{id:{d,n}},q}|null, fini, valide, maj, ops:[opId], v1? }
function defaultParcours_() { return { v: 2, etape: 'quiz_initial', pass: null, pile: null, maj: 0 }; }
function parcoursKey_(studentId, quizId) { return PARCOURS_PREFIX + studentId + '__' + quizId; }

function quizIds_(quiz) { return quiz.questions.map(qid_); }
function serie_(rec, id) { var r = rec && rec.q && rec.q[id]; return r ? r[0] : 0; }
// Identifiants des questions dont la série est sous le seuil (dans l'ordre du quiz)
function underIds_(quiz, rec) { return quizIds_(quiz).filter(function (id) { return serie_(rec, id) < MASTERY; }); }

function enterCiblees_(pc, ids) { pc.etape = 'cartes_ciblees'; pc.pass = null; pc.pile = { kind: 'ciblees', ids: ids, etat: {}, q: null }; }
function enterVerification_(pc, ids) { pc.etape = 'verification'; pc.pile = null; pc.pass = { kind: 'verif', list: ids, res: {} }; }
function enterFinales_(pc, quiz) { pc.etape = 'cartes_finales'; pc.pass = null; pc.pile = { kind: 'finales', ids: quizIds_(quiz), etat: {}, q: null }; }
// Après une erreur, ou à l'issue d'une vérification sans erreur : quelle étape suit ?
function nextStep_(pc, quiz, rec) {
  var under = underIds_(quiz, rec);
  if (under.length) enterVerification_(pc, under); else enterFinales_(pc, quiz);
}

// Lecture d'un enregistrement (migration à la volée de l'ancien format, sans rien écrire : la première écriture le fait)
function readParcours_(raw, quiz, rec) {
  var pc = parseJson_(raw);
  if (!pc) return defaultParcours_();
  if (pc.v === 2) return pc;
  return migrateParcours_(pc, quiz, rec);
}

// Migration v1 -> v2 (voir docs/REPRISE.md). Les séries sont conservées (plafonnées à l'usage) ; l'ancien enregistrement est gardé dans pc.v1.
//   valide -> valide ; fini -> attente_validation ; revision -> cartes_finales (ou vérification s'il reste des questions < 2) ;
//   cartes -> cartes_ciblees recalculée depuis les questions sous le seuil ; quiz avec au moins un passage fait -> cartes ciblées / paquet final ;
//   quiz sans passage -> quiz_initial. Aucune carte n'est marquée « Trouvé » rétroactivement.
function migrateParcours_(old, quiz, rec) {
  var pc = defaultParcours_();
  pc.v1 = old; pc.maj = old.maj || 0;
  var under = underIds_(quiz, rec);
  if (old.etape === 'valide') { pc.etape = 'valide'; pc.valide = old.valide || 0; pc.fini = old.fini || 0; }
  else if (old.etape === 'fini') { pc.etape = 'attente_validation'; pc.fini = old.fini || 0; }
  else if (old.etape === 'revision') { if (under.length) enterVerification_(pc, under); else enterFinales_(pc, quiz); }
  else if (old.etape === 'cartes') { if (under.length) enterCiblees_(pc, under); else enterFinales_(pc, quiz); }
  else if ((old.passages || 0) > 0 || (old.cycle || 1) > 1) { if (under.length) enterCiblees_(pc, under); else enterFinales_(pc, quiz); }
  return pc;
}

function seenOp_(pc, opId) { return !!opId && (pc.ops || []).indexOf(String(opId)) >= 0; }
function rememberOp_(pc, opId) {
  if (!opId) return;
  pc.ops = (pc.ops || []).concat(String(opId).slice(0, 40)).slice(-30);
}

// Version envoyée au navigateur : sans sauvegarde de migration ni identifiants d'opérations ; le passage initial est présenté d'avance.
function presentParcours_(pc, quiz) {
  var out = {};
  Object.keys(pc).forEach(function (k) { if (k !== 'v1' && k !== 'ops') out[k] = pc[k]; });
  if (out.etape === 'quiz_initial' && !out.pass) out.pass = { kind: 'initial', list: quizIds_(quiz), res: {} };
  return out;
}

function pileDone_(pile, live) {
  return !!pile && pile.ids.filter(function (id) { return live.indexOf(id) >= 0; }).every(function (id) { return pile.etat[id] && pile.etat[id].d === 'trouve'; });
}

// Fin d'un passage de quiz : le compteur « fait N fois » augmente (une seule fois par passage : un renvoi est sans effet),
// puis le serveur décide de l'étape suivante à partir des réponses du passage. Un passage inachevé est refusé.
function finishQuiz(classe, pseudo, pin, quizId, opId) {
  var st = authStudent_(classe, pseudo, pin);
  var quiz = quizzesOf_(st.id).filter(function (q) { return q.id === quizId; })[0];
  if (!quiz) throw new Error('Quiz inaccessible.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var store = PropertiesService.getScriptProperties();
    var key = doneKey_(st.id, quizId);
    var rec = parseJson_(store.getProperty(key)) || { n: 0, last: 0 };
    var prog = parseJson_(store.getProperty(progressKey_(st.id, quizId)));
    var pk = parcoursKey_(st.id, quizId);
    var pc = readParcours_(store.getProperty(pk), quiz, prog);
    if (seenOp_(pc, opId)) return { n: rec.n, parcours: presentParcours_(pc, quiz), rejoue: true };
    if (pc.etape === 'quiz_initial' && !pc.pass) pc.pass = { kind: 'initial', list: quizIds_(quiz), res: {} };
    if (!pc.pass) return { n: rec.n, parcours: presentParcours_(pc, quiz), rejoue: true };
    var live = quizIds_(quiz);
    var list = pc.pass.list.filter(function (id) { return live.indexOf(id) >= 0; });
    if (!list.every(function (id) { return pc.pass.res[id] !== undefined; })) throw new Error('Ce passage est en cours : réponds à toutes les questions.');
    rec.n += 1; rec.last = Date.now();
    store.setProperty(key, JSON.stringify(rec));
    var erreurs = list.filter(function (id) { return pc.pass.res[id] === 0; });
    var bilan = { total: list.length, bons: list.length - erreurs.length, erreurs: erreurs.length, genre: pc.pass.kind };
    if (erreurs.length) enterCiblees_(pc, erreurs); else nextStep_(pc, quiz, prog);
    bilan.restant = underIds_(quiz, prog).length;
    rememberOp_(pc, opId); pc.maj = Date.now();
    store.setProperty(pk, JSON.stringify(pc));
    return { n: rec.n, parcours: presentParcours_(pc, quiz), bilan: bilan };
  } finally {
    lock.releaseLock();
  }
}

// Auto-évaluation d'une carte (« oublie », « hesite », « trouve ») : suppose que la carte a été retournée.
// q = instantané de la file de répétition (pour reprendre une pile : cartes à présenter, files Oublié / Hésité, carte courante).
function rateCard(classe, pseudo, pin, quizId, cardId, verdict, snapshot, opId) {
  var st = authStudent_(classe, pseudo, pin);
  var quiz = quizzesOf_(st.id).filter(function (q) { return q.id === quizId; })[0];
  if (!quiz) throw new Error('Quiz inaccessible.');
  if (['oublie', 'hesite', 'trouve'].indexOf(verdict) < 0) throw new Error('Choix invalide.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var store = PropertiesService.getScriptProperties();
    var pk = parcoursKey_(st.id, quizId);
    var pc = readParcours_(store.getProperty(pk), quiz, parseJson_(store.getProperty(progressKey_(st.id, quizId))));
    if (pc.etape !== 'cartes_ciblees' && pc.etape !== 'cartes_finales') throw new Error("Cette étape n'est pas en cours.");
    if (seenOp_(pc, opId)) return { parcours: presentParcours_(pc, quiz), rejoue: true };
    if (pc.pile.ids.indexOf(cardId) < 0) throw new Error('Carte inconnue.');
    var prev = pc.pile.etat[cardId] || { d: '', n: 0 };
    pc.pile.etat[cardId] = { d: verdict, n: prev.n + 1 };
    pc.pile.q = cleanSnapshot_(snapshot, pc.pile.ids);
    rememberOp_(pc, opId); pc.maj = Date.now();
    store.setProperty(pk, JSON.stringify(pc));
    return { parcours: presentParcours_(pc, quiz) };
  } finally {
    lock.releaseLock();
  }
}

// Ne garde de l'instantané que des identifiants de la pile (f : à présenter, o : Oublié, h : Hésité, c : carte courante)
function cleanSnapshot_(s, ids) {
  if (!s || typeof s !== 'object') return null;
  var keep = function (list) { return (Array.isArray(list) ? list : []).filter(function (id) { return ids.indexOf(id) >= 0; }).slice(0, ids.length); };
  var waits = {};
  if (s.w && typeof s.w === 'object') Object.keys(s.w).forEach(function (id) { if (ids.indexOf(id) >= 0) waits[id] = Math.max(0, Math.min(3, Number(s.w[id]) || 0)); });
  return { f: keep(s.f), o: keep(s.o), h: keep(s.h), w: waits, c: ids.indexOf(s.c) >= 0 ? s.c : '', l: ids.indexOf(s.l) >= 0 ? s.l : '' };
}

// Cartes ciblées terminées -> vérification. Refusé tant qu'une carte n'a pas été évaluée et ne finit pas « Trouvé ».
function cardsDone(classe, pseudo, pin, quizId, opId) {
  return moveParcours_(classe, pseudo, pin, quizId, 'cartes_ciblees', opId, function (pc, quiz, prog) {
    nextStep_(pc, quiz, prog);
  });
}

// Paquet final terminé -> « En attente de validation » (réservé à l'adulte ensuite). Exige toutes les questions vérifiées.
function requestValidation(classe, pseudo, pin, quizId, opId) {
  return moveParcours_(classe, pseudo, pin, quizId, 'cartes_finales', opId, function (pc, quiz, prog) {
    if (underIds_(quiz, prog).length) throw new Error("Des questions ne sont pas encore vérifiées (pas en cours d'étape).");
    pc.etape = 'attente_validation'; pc.fini = Date.now(); pc.pile = null;
  });
}

function moveParcours_(classe, pseudo, pin, quizId, from, opId, change) {
  var st = authStudent_(classe, pseudo, pin);
  var quiz = quizzesOf_(st.id).filter(function (q) { return q.id === quizId; })[0];
  if (!quiz) throw new Error('Quiz inaccessible.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var store = PropertiesService.getScriptProperties();
    var pk = parcoursKey_(st.id, quizId);
    var prog = parseJson_(store.getProperty(progressKey_(st.id, quizId)));
    var pc = readParcours_(store.getProperty(pk), quiz, prog);
    if (seenOp_(pc, opId)) return { parcours: presentParcours_(pc, quiz), rejoue: true };
    if (pc.etape !== from) throw new Error("Cette étape n'est pas en cours.");
    if (!pileDone_(pc.pile, quizIds_(quiz))) throw new Error("Cartes en cours : toutes ne sont pas encore évaluées « Trouvé ».");
    change(pc, quiz, prog);
    rememberOp_(pc, opId); pc.maj = Date.now();
    store.setProperty(pk, JSON.stringify(pc));
    return { parcours: presentParcours_(pc, quiz) };
  } finally {
    lock.releaseLock();
  }
}

// ---------------- Côté administrateur (mot de passe requis pour tout) ----------------

function adminData(password) {
  checkAdmin_(password);
  var props = PropertiesService.getScriptProperties().getProperties();
  var assigned = builtinAssign_();
  var students = students_();
  var customQuizzes = list_(QUIZ_PREFIX).map(withQids_);
  var builtins = builtins_();
  var modifies = {};
  list_(OVERRIDE_PREFIX).forEach(function (o) { modifies[o.id] = true; });
  var allQuizzes = builtins.concat(customQuizzes);
  var progress = {};
  students.forEach(function (st) {
    progress[st.id] = allQuizzes
      .filter(function (q) { return quizFor_(q, st.id, assigned); })
      .map(function (q) { return lessonSummary_(q, parseJson_(props[progressKey_(st.id, q.id)]), parseJson_(props[doneKey_(st.id, q.id)]), readParcours_(props[parcoursKey_(st.id, q.id)], q, parseJson_(props[progressKey_(st.id, q.id)]))); });
  });
  return {
    students: students.map(publicStudent_),
    quizzes: customQuizzes,
    decks: list_(DECK_PREFIX),
    builtins: builtins.map(function (q) {
      return { id: q.id, titre: q.titre, emoji: q.emoji, matiere: q.matiere, questions: q.questions.length, pour: assigned[q.id] || [], modifie: !!modifies[q.id] };
    }),
    progress: progress
  };
}

// Création (sans id) ou modification (avec id) d'un compte. Le PIN est enregistré haché : on ne peut plus le relire.
// En modification, un PIN vide conserve l'ancien.
function saveStudent(password, student) {
  checkAdmin_(password);
  if (!student || typeof student !== 'object') throw new Error('Compte invalide.');
  var classe = str_(student.classe, 30);
  var pseudo = str_(student.pseudo, 30);
  if (!classe) throw new Error('La classe est obligatoire.');
  if (!pseudo) throw new Error('Le pseudo est obligatoire.');
  var pin = typeof student.pin === 'string' ? student.pin.trim() : '';

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var store = PropertiesService.getScriptProperties();
    var all = students_();
    var existing = null;
    if (student.id && /^[a-z0-9-]{1,60}$/.test(student.id)) {
      existing = all.filter(function (s) { return s.id === student.id; })[0] || null;
    }
    if (!existing && !pin) throw new Error('Le PIN est obligatoire pour un nouvel élève.');
    if (pin && !/^\d{4,8}$/.test(pin)) throw new Error('Le PIN doit comporter de 4 à 8 chiffres.');
    if (!existing && all.length >= MAX_STUDENTS) throw new Error('Maximum ' + MAX_STUDENTS + ' élèves.');
    var duplicate = all.some(function (s) {
      return (!existing || s.id !== existing.id) && norm_(s.classe) === norm_(classe) && norm_(s.pseudo) === norm_(pseudo);
    });
    if (duplicate) throw new Error('Cet élève existe déjà dans cette classe (même pseudo).');

    var rec = existing || { id: uniqueStudentId_(pseudo, all), ajoute: Date.now() };
    rec.classe = classe;
    rec.pseudo = pseudo;
    if (pin) {
      rec.salt = Utilities.getUuid();
      rec.hash = hashPin_(rec.salt, pin);
    }
    store.setProperty(STUDENT_PREFIX + rec.id, JSON.stringify(rec));
    return { id: rec.id };
  } finally {
    lock.releaseLock();
  }
}

// Supprime l'élève, sa remise à zéro, et le retire de tout ce qui lui était destiné.
function deleteStudent(password, id) {
  checkAdmin_(password);
  if (!/^[a-z0-9-]{1,60}$/.test(String(id))) throw new Error('Identifiant invalide.');
  var store = PropertiesService.getScriptProperties();
  store.deleteProperty(STUDENT_PREFIX + id);
  deleteProgress_(id, 'all');
  deleteDone_(id, 'all');
  deleteParcours_(id, 'all');
  var assigned = builtinAssign_();
  Object.keys(assigned).forEach(function (k) { assigned[k] = assigned[k].filter(function (x) { return x !== id; }); });
  store.setProperty(BUILTIN_ASSIGN_KEY, JSON.stringify(assigned));
  [QUIZ_PREFIX, DECK_PREFIX].forEach(function (prefix) {
    list_(prefix).forEach(function (item) {
      if ((item.pour || []).indexOf(id) >= 0) {
        item.pour = item.pour.filter(function (x) { return x !== id; });
        putItem_(store, prefix, item.id, item);
      }
    });
  });
  return true;
}

function saveQuiz(password, quiz) {
  checkAdmin_(password);
  return save_(QUIZ_PREFIX, validateQuiz_(quiz), quiz.id);
}

function saveDeck(password, deck) {
  checkAdmin_(password);
  return save_(DECK_PREFIX, validateDeck_(deck), deck.id);
}

function deleteQuiz(password, id) {
  checkAdmin_(password);
  remove_(QUIZ_PREFIX, id);
  deleteProgress_('all', id);
  deleteDone_('all', id);
  deleteParcours_('all', id);
  return true;
}

function deleteDeck(password, id) {
  checkAdmin_(password);
  return remove_(DECK_PREFIX, id);
}

// À qui est donné un quiz intégré
function setBuiltinAssign(password, quizId, pour) {
  checkAdmin_(password);
  if (!isBuiltin_(quizId)) throw new Error('Quiz intégré inconnu.');
  var assigned = builtinAssign_();
  assigned[quizId] = cleanPour_(pour);
  PropertiesService.getScriptProperties().setProperty(BUILTIN_ASSIGN_KEY, JSON.stringify(assigned));
  return { pour: assigned[quizId] };
}

// Version à modifier d'un quiz intégré : la version en vigueur (modifiée ou d'origine) et ses destinataires.
function getBuiltinForEdit(password, quizId) {
  checkAdmin_(password);
  if (!isBuiltin_(quizId)) throw new Error('Quiz intégré inconnu.');
  var quiz = builtins_().filter(function (q) { return q.id === quizId; })[0];
  return { quiz: quiz, pour: builtinAssign_()[quizId] || [] };
}

// Enregistre une version modifiée d'un quiz intégré (l'original reste intact et peut être rétabli).
// Les questions gardent leur identifiant : la progression des élèves est conservée, même si l'énoncé change.
function saveBuiltin(password, quizId, quiz) {
  checkAdmin_(password);
  if (!isBuiltin_(quizId)) throw new Error('Quiz intégré inconnu.');
  var clean = validateQuiz_(quiz);
  var pour = clean.pour;
  delete clean.pour;
  clean.id = quizId;
  clean.ajoute = 0;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var store = PropertiesService.getScriptProperties();
    putItem_(store, OVERRIDE_PREFIX, quizId, clean);
    var assigned = builtinAssign_();
    assigned[quizId] = pour;
    store.setProperty(BUILTIN_ASSIGN_KEY, JSON.stringify(assigned));
  } finally {
    lock.releaseLock();
  }
  return { id: quizId };
}

// Rétablit la version d'origine d'un quiz intégré. La progression des élèves est conservée.
function restoreBuiltin(password, quizId) {
  checkAdmin_(password);
  if (!isBuiltin_(quizId)) throw new Error('Quiz intégré inconnu.');
  delItem_(PropertiesService.getScriptProperties(), OVERRIDE_PREFIX, quizId);
  return true;
}

// Valide le parcours d'un élève sur une leçon (il l'a terminé et demandé la validation d'un adulte).
function validateParcours(password, studentId, quizId) {
  checkAdmin_(password);
  if (!students_().some(function (s) { return s.id === studentId; })) throw new Error('Élève inconnu.');
  if (!/^[a-z0-9-]{1,60}$/.test(String(quizId))) throw new Error('Identifiant de quiz invalide.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var store = PropertiesService.getScriptProperties();
    var pk = parcoursKey_(studentId, quizId);
    var quiz = builtins_().concat(list_(QUIZ_PREFIX).map(withQids_)).filter(function (q) { return q.id === quizId; })[0];
    if (!quiz) throw new Error('Quiz inconnu.');
    var pc = readParcours_(store.getProperty(pk), quiz, parseJson_(store.getProperty(progressKey_(studentId, quizId))));
    if (pc.etape !== 'attente_validation') throw new Error("Ce parcours n'attend pas de validation.");
    pc.etape = 'valide'; pc.valide = Date.now(); pc.maj = pc.valide;
    store.setProperty(pk, JSON.stringify(pc));
    return { parcours: slimParcours_(pc) };
  } finally {
    lock.releaseLock();
  }
}

// Remise à zéro de la progression : pour un élève (id ou 'all') et une leçon (id d'un quiz ou 'all').
// La progression étant enregistrée sur le serveur, l'élève la retrouve vide à sa prochaine connexion ou actualisation.
function resetProgress(password, studentId, quizId) {
  checkAdmin_(password);
  studentId = studentId || 'all';
  quizId = quizId || 'all';
  if (studentId !== 'all' && !students_().some(function (s) { return s.id === studentId; })) throw new Error('Élève inconnu.');
  if (quizId !== 'all' && !/^[a-z0-9-]{1,60}$/.test(String(quizId))) throw new Error('Identifiant de quiz invalide.');
  return { supprimes: deleteProgress_(studentId, quizId) + deleteParcours_(studentId, quizId) };
}

// ---------------- Fonctions internes (le _ final les rend non appelables depuis les pages) ----------------

function students_() { return list_(STUDENT_PREFIX); }

function parseJson_(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

// Empreinte courte d'un énoncé (FNV-1a 32 bits) : identifie une question dans la progression.
// Le même calcul existe dans la page élève (Index.html) : les deux doivent rester identiques.
function qhash_(text) {
  var h = 0x811c9dc5;
  var t = String(text);
  for (var i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ('0000000' + (h >>> 0).toString(16)).slice(-8);
}

// Identifiant stable d'une question : sert de clé à la progression. Une question sans identifiant (quiz anciens,
// quiz intégrés d'origine) prend l'empreinte de son énoncé : les progressions déjà enregistrées restent valables.
function qid_(question) { return question.id || qhash_(question.question); }

// Copie d'un quiz où chaque question a son identifiant
function withQids_(quiz) {
  var copy = {};
  Object.keys(quiz).forEach(function (k) { copy[k] = quiz[k]; });
  copy.questions = quiz.questions.map(function (q) {
    if (q.id) return q;
    var c = { id: qhash_(q.question) };
    Object.keys(q).forEach(function (k) { c[k] = q[k]; });
    return c;
  });
  return copy;
}

function newQid_(seen) {
  var id;
  do { id = qhash_(String(Math.random()) + ':' + Date.now()); } while (seen[id]);
  return id;
}

function isBuiltin_(quizId) { return BUILTIN_QUIZZES.some(function (q) { return q.id === quizId; }); }

// Quiz intégrés en vigueur : la version modifiée par l'administrateur si elle existe, sinon l'original.
function builtins_() {
  var ov = {};
  list_(OVERRIDE_PREFIX).forEach(function (o) { ov[o.id] = o; });
  return BUILTIN_QUIZZES.map(function (q) { return withQids_(ov[q.id] ? ov[q.id] : q); });
}

function progressKey_(studentId, quizId) { return PROGRESS_PREFIX + studentId + '__' + quizId; }
function doneKey_(studentId, quizId) { return DONE_PREFIX + studentId + '__' + quizId; }

// Le quiz est-il destiné à cet élève ? (quiz intégré attribué, ou quiz créé pour lui)
function quizFor_(quiz, studentId, assigned) {
  return quiz.pour ? isFor_(quiz, studentId) : (assigned[quiz.id] || []).indexOf(studentId) >= 0;
}

function quizzesOf_(studentId) {
  var assigned = builtinAssign_();
  return builtins_().concat(list_(QUIZ_PREFIX).map(withQids_)).filter(function (q) { return quizFor_(q, studentId, assigned); });
}

// Résumé d'une leçon pour l'administration : questions sues / en cours / à apprendre, erreurs, dernière activité.
function lessonSummary_(quiz, rec, done, parcours) {
  var q = (rec && rec.q) || {};
  var sues = 0, enCours = 0, erreurs = 0;
  quiz.questions.forEach(function (question) {
    var r = q[qid_(question)] || [0, 0];
    if (r[0] >= MASTERY) sues++; else if (r[0] > 0) enCours++;
    erreurs += r[1];
  });
  return {
    id: quiz.id, titre: quiz.titre, emoji: quiz.emoji, matiere: quiz.matiere,
    total: quiz.questions.length, sues: sues, enCours: enCours, erreurs: erreurs, maj: (rec && rec.maj) || 0,
    fois: (done && done.n) || 0, derniere: (done && done.last) || 0,
    parcours: slimParcours_(parcours || defaultParcours_())
  };
}

// Version courte pour l'administration : étape, dates et avancement du passage ou de la pile en cours
function slimParcours_(pc) {
  var out = { etape: pc.etape, maj: pc.maj || 0, fini: pc.fini || 0, valide: pc.valide || 0 };
  if (pc.pass) out.passage = { genre: pc.pass.kind, total: pc.pass.list.length, repondues: Object.keys(pc.pass.res).length };
  if (pc.pile) out.pile = { genre: pc.pile.kind, total: pc.pile.ids.length, trouvees: pc.pile.ids.filter(function (id) { return pc.pile.etat[id] && pc.pile.etat[id].d === 'trouve'; }).length };
  return out;
}

// Sauvegarde complète des données (comptes avec PIN haché, quiz, progressions, parcours) : à faire avant toute migration.
function backupData(password) {
  checkAdmin_(password);
  var props = PropertiesService.getScriptProperties().getProperties();
  delete props.ADMIN_PASSWORD;
  return { date: Date.now(), schema: 2, proprietes: props };
}

// Retour arrière de la migration : restaure les anciens parcours (v1) gardés à la première écriture. Les séries et compteurs restent.
function rollbackParcoursV1(password) {
  checkAdmin_(password);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var store = PropertiesService.getScriptProperties();
    var all = store.getProperties(), n = 0;
    Object.keys(all).forEach(function (k) {
      if (k.indexOf(PARCOURS_PREFIX) !== 0) return;
      var pc = parseJson_(all[k]);
      if (pc && pc.v === 2 && pc.v1) { store.setProperty(k, JSON.stringify(pc.v1)); n++; }
    });
    return n;
  } finally {
    lock.releaseLock();
  }
}

// Supprime la progression d'un élève ('all' = tous) sur une leçon ('all' = toutes). Renvoie le nombre d'enregistrements supprimés.
function deleteProgress_(studentId, quizId) { return deleteByPrefix_(PROGRESS_PREFIX, studentId, quizId); }
// Idem pour les compteurs de parties (uniquement lors de la suppression d'un élève ou d'un quiz).
function deleteDone_(studentId, quizId) { return deleteByPrefix_(DONE_PREFIX, studentId, quizId); }
// Le parcours repart de l'étape 1 (remise à zéro d'une leçon, ou suppression d'un élève ou d'un quiz).
function deleteParcours_(studentId, quizId) { return deleteByPrefix_(PARCOURS_PREFIX, studentId, quizId); }

function deleteByPrefix_(prefix, studentId, quizId) {
  var store = PropertiesService.getScriptProperties();
  var n = 0;
  Object.keys(store.getProperties()).forEach(function (k) {
    if (k.indexOf(prefix) !== 0) return;
    var parts = k.slice(prefix.length).split('__');
    if ((studentId === 'all' || parts[0] === studentId) && (quizId === 'all' || parts[1] === quizId)) {
      store.deleteProperty(k);
      n++;
    }
  });
  return n;
}

function publicStudent_(s) { return { id: s.id, classe: s.classe, pseudo: s.pseudo, ajoute: s.ajoute }; }

function builtinAssign_() {
  var raw = PropertiesService.getScriptProperties().getProperty(BUILTIN_ASSIGN_KEY);
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}

function isFor_(item, studentId) { return (item.pour || []).indexOf(studentId) >= 0; }

function withoutPour_(item) {
  var copy = {};
  Object.keys(item).forEach(function (k) { if (k !== 'pour') copy[k] = item[k]; });
  return copy;
}

// Ne garde que des identifiants d'élèves existants, sans doublon
function cleanPour_(pour) {
  var ids = students_().map(function (s) { return s.id; });
  var out = [];
  (Array.isArray(pour) ? pour : []).forEach(function (id) {
    if (ids.indexOf(id) >= 0 && out.indexOf(id) < 0) out.push(id);
  });
  return out;
}

function norm_(text) {
  return String(text == null ? '' : text).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function uniqueStudentId_(pseudo, all) {
  var base = slugify_(pseudo) || 'eleve';
  var id = base;
  var n = 2;
  var taken = all.map(function (s) { return s.id; });
  while (taken.indexOf(id) >= 0) { id = base + '-' + n++; }
  return id;
}

function hashPin_(salt, pin) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pin, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// Vérifie classe + pseudo + PIN. Message volontairement identique quelle que soit l'erreur.
// Après MAX_PIN_FAILS erreurs sur le même couple classe/pseudo : blocage de LOCK_SECONDS.
function authStudent_(classe, pseudo, pin) {
  var c = norm_(classe);
  var p = norm_(pseudo);
  var cache = CacheService.getScriptCache();
  var key = 'echecs|' + c + '|' + p;
  if (Number(cache.get(key) || 0) >= MAX_PIN_FAILS) {
    throw new Error("Trop d'essais. Réessaie dans quelques minutes.");
  }
  var st = students_().filter(function (s) { return norm_(s.classe) === c && norm_(s.pseudo) === p; })[0];
  var good = !!st && st.hash === hashPin_(st.salt, String(pin == null ? '' : pin).trim());
  if (!good) {
    cache.put(key, String(Number(cache.get(key) || 0) + 1), LOCK_SECONDS);
    Utilities.sleep(800); // ralentit les essais répétés
    throw new Error('Classe, pseudo ou PIN incorrect.');
  }
  cache.remove(key);
  return st;
}

function list_(prefix) {
  var props = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(props)
    .filter(function (k) { return k.indexOf(prefix) === 0 && k.indexOf('~') < 0; })
    .map(function (k) { return readItem_(props, k); })
    .filter(Boolean)
    .sort(function (a, b) { return (a.ajoute || 0) - (b.ajoute || 0); });
}

// Lit un élément, éventuellement découpé en morceaux (<clé>~0, <clé>~1…)
function readItem_(props, key) {
  var head = parseJson_(props[key]);
  if (!head || !head._chunks) return head;
  var text = '';
  for (var i = 0; i < head._chunks; i++) text += props[key + '~' + i] || '';
  return parseJson_(text);
}

function getItem_(store, prefix, id) {
  var key = prefix + id;
  var head = parseJson_(store.getProperty(key));
  if (!head || !head._chunks) return head;
  var text = '';
  for (var i = 0; i < head._chunks; i++) text += store.getProperty(key + '~' + i) || '';
  return parseJson_(text);
}

// Écrit un élément ; au-delà de la taille d'une propriété, il est découpé en morceaux.
function putItem_(store, prefix, id, obj) {
  var key = prefix + id;
  var json = JSON.stringify(obj);
  if (json.length > MAX_ITEM_CHARS) throw new Error('Trop volumineux : réduis le nombre ou la longueur des éléments.');
  var old = parseJson_(store.getProperty(key));
  var oldChunks = old && old._chunks ? old._chunks : 0;
  var chunks = 0;
  if (unescape(encodeURIComponent(json)).length <= MAX_VALUE_BYTES) {
    store.setProperty(key, json);
  } else {
    chunks = Math.ceil(json.length / CHUNK_CHARS);
    for (var i = 0; i < chunks; i++) store.setProperty(key + '~' + i, json.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS));
    store.setProperty(key, JSON.stringify({ _chunks: chunks, id: obj.id, ajoute: obj.ajoute }));
  }
  for (var j = chunks; j < oldChunks; j++) store.deleteProperty(key + '~' + j);   // anciens morceaux devenus inutiles
}

function delItem_(store, prefix, id) {
  var key = prefix + id;
  var old = parseJson_(store.getProperty(key));
  var n = old && old._chunks ? old._chunks : 0;
  for (var i = 0; i < n; i++) store.deleteProperty(key + '~' + i);
  store.deleteProperty(key);
}

function save_(prefix, clean, requestedId) {
  var store = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var existing = null;
    if (requestedId && /^[a-z0-9-]{1,60}$/.test(requestedId)) existing = getItem_(store, prefix, requestedId);
    if (existing) {
      clean.id = existing.id;
      clean.ajoute = existing.ajoute;
    } else {
      var base = slugify_(clean.titre) || 'element';
      var id = base;
      var n = 2;
      while (store.getProperty(prefix + id)) { id = base + '-' + n++; }
      clean.id = id;
      clean.ajoute = Date.now();
    }
    putItem_(store, prefix, clean.id, clean);
    return { id: clean.id };
  } finally {
    lock.releaseLock();
  }
}

function remove_(prefix, id) {
  if (!/^[a-z0-9-]{1,60}$/.test(String(id))) throw new Error('Identifiant invalide.');
  delItem_(PropertiesService.getScriptProperties(), prefix, id);
  return true;
}

function checkAdmin_(password) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!expected) {
    throw new Error("Mot de passe administrateur non défini : ajoute la propriété de script ADMIN_PASSWORD.");
  }
  if (password !== expected) {
    Utilities.sleep(1000); // ralentit les essais répétés
    throw new Error('Mot de passe incorrect.');
  }
}

// Une question est de l'un des trois types : à choix (options + correct), à réponse écrite (reponses),
// ou à plusieurs champs (champs : [{ label, reponses, groupe? }], libre?).
function validateQuiz_(quiz) {
  if (!quiz || typeof quiz !== 'object') throw new Error('Quiz invalide.');
  var titre = str_(quiz.titre, 120);
  if (!titre) throw new Error('Le titre est obligatoire.');
  if (!Array.isArray(quiz.questions) || quiz.questions.length < 1) {
    throw new Error('Il faut au moins une question.');
  }
  if (quiz.questions.length > MAX_QUESTIONS) {
    throw new Error('Maximum ' + MAX_QUESTIONS + ' questions par quiz.');
  }
  var seen = {};
  var questions = quiz.questions.map(function (q, i) {
    var label = 'Question ' + (i + 1) + ' : ';
    var question = str_(q && q.question, 300);
    if (!question) throw new Error(label + "l'énoncé est vide.");
    // L'identifiant d'une question existante est conservé (sa progression aussi) ; une nouvelle question en reçoit un.
    var qid = (typeof q.id === 'string' && /^[0-9a-f]{8}$/.test(q.id) && !seen[q.id]) ? q.id : newQid_(seen);
    seen[qid] = true;
    var out = { id: qid, question: question };

    if (Array.isArray(q.champs)) {
      if (q.champs.length < 2 || q.champs.length > MAX_FIELDS) {
        throw new Error(label + 'il faut entre 2 et ' + MAX_FIELDS + ' champs.');
      }
      out.champs = q.champs.map(function (c, j) {
        var fl = label + 'champ ' + (j + 1) + ' : ';
        var intitule = str_(c && c.label, 60);
        if (!intitule) throw new Error(fl + "l'intitulé est vide.");
        var reps = (c && Array.isArray(c.reponses) ? c.reponses : []).map(function (r) { return str_(r, 80); }).filter(Boolean);
        if (reps.length < 1 || reps.length > 10) throw new Error(fl + 'il faut entre 1 et 10 réponses acceptées.');
        var field = { label: intitule, reponses: reps };
        var groupe = str_(c.groupe, 20);
        if (groupe) {
          if (!/^[A-Za-z0-9À-ÿ _-]+$/.test(groupe)) throw new Error(fl + 'le nom du groupe contient un caractère non autorisé.');
          field.groupe = groupe;
        }
        return field;
      });
      if (q.libre === true) out.libre = true;
    } else if (Array.isArray(q.reponses)) {
      var reponses = q.reponses.map(function (r) { return str_(r, 80); }).filter(Boolean);
      if (reponses.length < 1 || reponses.length > 10) {
        throw new Error(label + 'il faut entre 1 et 10 réponses acceptées.');
      }
      out.reponses = reponses;
    } else {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
        throw new Error(label + 'il faut entre 2 et 6 réponses.');
      }
      var options = q.options.map(function (o) { return str_(o, 150); });
      if (options.some(function (o) { return !o; })) throw new Error(label + 'une réponse est vide.');
      if (typeof q.correct !== 'number' || q.correct % 1 !== 0 || q.correct < 0 || q.correct >= options.length) {
        throw new Error(label + 'la bonne réponse est invalide.');
      }
      out.options = options;
      out.correct = q.correct;
    }

    var explication = str_(q.explication, 400);
    if (explication) out.explication = explication;
    return out;
  });
  var clean = {
    titre: titre,
    matiere: str_(quiz.matiere, 40) || 'Divers',
    emoji: str_(quiz.emoji, 8) || '📘',
    description: str_(quiz.description, 300),
    pour: cleanPour_(quiz.pour),
    questions: questions
  };
  var lien = validateLien_(quiz.lien);
  if (lien) clean.lien = lien;
  return clean;
}

// Lien utile affiché pendant le quiz (ex. des extraits sonores). Seules les adresses http(s) sont acceptées.
function validateLien_(lien) {
  if (!lien || typeof lien !== 'object') return null;
  var url = str_(lien.url, 300);
  if (!url) return null;
  if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error("L'adresse du lien doit commencer par http:// ou https://.");
  var res = { texte: str_(lien.texte, 60) || 'Ouvrir le lien', url: url };
  var icone = str_(lien.icone, 8);
  if (icone) res.icone = icone;
  return res;
}

function validateDeck_(deck) {
  if (!deck || typeof deck !== 'object') throw new Error('Paquet invalide.');
  var titre = str_(deck.titre, 120);
  if (!titre) throw new Error('Le titre est obligatoire.');
  if (!Array.isArray(deck.cartes) || deck.cartes.length < 1) {
    throw new Error('Il faut au moins une carte.');
  }
  if (deck.cartes.length > MAX_CARDS) {
    throw new Error('Maximum ' + MAX_CARDS + ' cartes par paquet.');
  }
  var cartes = deck.cartes.map(function (c, i) {
    var recto = str_(c && c.recto, 200);
    var verso = str_(c && c.verso, 300);
    if (!recto || !verso) throw new Error('Carte ' + (i + 1) + " : le recto et le verso sont obligatoires.");
    return { recto: recto, verso: verso };
  });
  return {
    titre: titre,
    matiere: str_(deck.matiere, 40) || 'Divers',
    emoji: str_(deck.emoji, 8) || '🃏',
    description: str_(deck.description, 300),
    pour: cleanPour_(deck.pour),
    cartes: cartes
  };
}

function str_(value, max) {
  return (typeof value === 'string' ? value : '').trim().slice(0, max);
}

function slugify_(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
