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
//   builtin_assign  à qui est donné chaque quiz intégré (voir Contenu.gs)
//   programme_reset / reset_<id>  dates de remise à zéro du programme de révision
// Le mot de passe administrateur est la propriété ADMIN_PASSWORD.
//
// Séparation des élèves : le serveur ne renvoie à un élève que les quiz et paquets qui lui sont destinés
// (champ « pour »). Un quiz ou un paquet sans destinataire reste caché.
// ---------------------------------------------------------------
var QUIZ_PREFIX = 'quiz_';
var DECK_PREFIX = 'deck_';
var STUDENT_PREFIX = 'student_';
var BUILTIN_ASSIGN_KEY = 'builtin_assign';
var RESET_KEY = 'programme_reset';
var RESET_STUDENT_PREFIX = 'reset_';
var MAX_QUESTIONS = 50;
var MAX_CARDS = 150;
var MAX_STUDENTS = 40;
var MAX_VALUE_BYTES = 8500; // une propriété est limitée à 9 Ko
var MAX_PIN_FAILS = 5;      // erreurs de PIN avant blocage temporaire
var LOCK_SECONDS = 300;     // durée du blocage (5 minutes)

// ---------------- Côté élève ----------------

// Connexion + données de l'élève en un seul appel. Les identifiants sont revérifiés à chaque appel.
function getStudentData(classe, pseudo, pin) {
  var st = authStudent_(classe, pseudo, pin);
  var assigned = builtinAssign_();
  var quizzes = BUILTIN_QUIZZES
    .filter(function (q) { return (assigned[q.id] || []).indexOf(st.id) >= 0; })
    .concat(list_(QUIZ_PREFIX).filter(function (q) { return isFor_(q, st.id); }))
    .map(withoutPour_);
  var decks = list_(DECK_PREFIX).filter(function (d) { return isFor_(d, st.id); }).map(withoutPour_);
  var props = PropertiesService.getScriptProperties();
  var reset = Math.max(Number(props.getProperty(RESET_KEY)) || 0, Number(props.getProperty(RESET_STUDENT_PREFIX + st.id)) || 0);
  return { student: { id: st.id, classe: st.classe, pseudo: st.pseudo }, quizzes: quizzes, decks: decks, reset: reset };
}

// ---------------- Côté administrateur (mot de passe requis pour tout) ----------------

function adminData(password) {
  checkAdmin_(password);
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var assigned = builtinAssign_();
  var resets = {};
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(RESET_STUDENT_PREFIX) === 0) resets[k.slice(RESET_STUDENT_PREFIX.length)] = Number(all[k]) || 0;
  });
  return {
    students: students_().map(publicStudent_),
    quizzes: list_(QUIZ_PREFIX),
    decks: list_(DECK_PREFIX),
    builtins: BUILTIN_QUIZZES.map(function (q) {
      return { id: q.id, titre: q.titre, emoji: q.emoji, matiere: q.matiere, questions: q.questions.length, pour: assigned[q.id] || [] };
    }),
    resetAll: Number(all[RESET_KEY]) || 0,
    resets: resets
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
  store.deleteProperty(RESET_STUDENT_PREFIX + id);
  var assigned = builtinAssign_();
  Object.keys(assigned).forEach(function (k) { assigned[k] = assigned[k].filter(function (x) { return x !== id; }); });
  store.setProperty(BUILTIN_ASSIGN_KEY, JSON.stringify(assigned));
  [QUIZ_PREFIX, DECK_PREFIX].forEach(function (prefix) {
    list_(prefix).forEach(function (item) {
      if ((item.pour || []).indexOf(id) >= 0) {
        item.pour = item.pour.filter(function (x) { return x !== id; });
        store.setProperty(prefix + item.id, JSON.stringify(item));
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
  return remove_(QUIZ_PREFIX, id);
}

function deleteDeck(password, id) {
  checkAdmin_(password);
  return remove_(DECK_PREFIX, id);
}

// À qui est donné un quiz intégré
function setBuiltinAssign(password, quizId, pour) {
  checkAdmin_(password);
  if (!BUILTIN_QUIZZES.some(function (q) { return q.id === quizId; })) throw new Error('Quiz intégré inconnu.');
  var assigned = builtinAssign_();
  assigned[quizId] = cleanPour_(pour);
  PropertiesService.getScriptProperties().setProperty(BUILTIN_ASSIGN_KEY, JSON.stringify(assigned));
  return { pour: assigned[quizId] };
}

// Remise à zéro du programme de révision : target = 'all' ou l'id d'un élève.
// La progression est enregistrée sur l'appareil de l'élève, l'administrateur ne peut donc pas l'effacer directement :
// il enregistre la date ici, et l'appareil repart de 0 à la prochaine connexion de l'élève si cette date est plus récente.
function resetProgramme(password, target) {
  checkAdmin_(password);
  var ts = Date.now();
  var store = PropertiesService.getScriptProperties();
  if (!target || target === 'all') {
    store.setProperty(RESET_KEY, String(ts));
  } else {
    if (!students_().some(function (s) { return s.id === target; })) throw new Error('Élève inconnu.');
    store.setProperty(RESET_STUDENT_PREFIX + target, String(ts));
  }
  return { reset: ts };
}

// ---------------- Fonctions internes (le _ final les rend non appelables depuis les pages) ----------------

function students_() { return list_(STUDENT_PREFIX); }

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
    .filter(function (k) { return k.indexOf(prefix) === 0; })
    .map(function (k) { return JSON.parse(props[k]); })
    .sort(function (a, b) { return (a.ajoute || 0) - (b.ajoute || 0); });
}

function save_(prefix, clean, requestedId) {
  var store = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var existing = null;
    if (requestedId && /^[a-z0-9-]{1,60}$/.test(requestedId)) {
      var raw = store.getProperty(prefix + requestedId);
      if (raw) existing = JSON.parse(raw);
    }
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
    var json = JSON.stringify(clean);
    if (unescape(encodeURIComponent(json)).length > MAX_VALUE_BYTES) {
      throw new Error('Trop volumineux : réduis le nombre ou la longueur des éléments.');
    }
    store.setProperty(prefix + clean.id, json);
    return { id: clean.id };
  } finally {
    lock.releaseLock();
  }
}

function remove_(prefix, id) {
  if (!/^[a-z0-9-]{1,60}$/.test(String(id))) throw new Error('Identifiant invalide.');
  PropertiesService.getScriptProperties().deleteProperty(prefix + id);
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

// Une question est soit à choix (options + correct), soit à réponse écrite (reponses).
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
  var questions = quiz.questions.map(function (q, i) {
    var label = 'Question ' + (i + 1) + ' : ';
    var question = str_(q && q.question, 300);
    if (!question) throw new Error(label + "l'énoncé est vide.");
    var out = { question: question };

    if (Array.isArray(q.reponses)) {
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
  return {
    titre: titre,
    matiere: str_(quiz.matiere, 40) || 'Divers',
    emoji: str_(quiz.emoji, 8) || '📘',
    description: str_(quiz.description, 300),
    pour: cleanPour_(quiz.pour),
    questions: questions
  };
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
