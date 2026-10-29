function doGet(e) {
  // Récupère le nom du quiz demandé via le paramètre URL ?p=nom_du_fichier
  // (ex : ?p=byzance)
  // Si aucun paramètre n'est spécifié, le script charge le fichier 'Index' par défaut.
  var page = (e && e.parameter && e.parameter.p) ? e.parameter.p : 'Index';

  try {
    return HtmlService.createHtmlOutputFromFile(page)
      .setTitle('Portail de Révisions')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    // Si le fichier HTML demandé n'existe pas encore, retour automatique sur 'Index'
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Portail de Révisions')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
}

// ---------------------------------------------------------------
// Quiz ajoutés depuis la page d'administration (?p=admin)
// Stockés dans les propriétés du script : une propriété 'quiz_<id>' par quiz.
// Le mot de passe se définit dans Paramètres du projet > Propriétés du script
// (propriété ADMIN_PASSWORD). Sans lui, aucune écriture n'est possible.
// ---------------------------------------------------------------
var QUIZ_PREFIX = 'quiz_';
var MAX_QUESTIONS = 50;
var MAX_VALUE_BYTES = 8500; // une propriété est limitée à 9 Ko

// Lecture publique : utilisée par la page d'accueil.
function getQuizzes() {
  var props = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(props)
    .filter(function (k) { return k.indexOf(QUIZ_PREFIX) === 0; })
    .map(function (k) { return JSON.parse(props[k]); })
    .sort(function (a, b) { return (a.ajoute || 0) - (b.ajoute || 0); });
}

function saveQuiz(password, quiz) {
  checkAdmin_(password);
  var clean = validateQuiz_(quiz);
  var store = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var existing = null;
    if (quiz.id && /^[a-z0-9-]{1,60}$/.test(quiz.id)) {
      var raw = store.getProperty(QUIZ_PREFIX + quiz.id);
      if (raw) existing = JSON.parse(raw);
    }
    if (existing) {
      clean.id = existing.id;
      clean.ajoute = existing.ajoute;
    } else {
      var base = slugify_(clean.titre) || 'quiz';
      var id = base;
      var n = 2;
      while (store.getProperty(QUIZ_PREFIX + id)) { id = base + '-' + n++; }
      clean.id = id;
      clean.ajoute = Date.now();
    }
    var json = JSON.stringify(clean);
    if (unescape(encodeURIComponent(json)).length > MAX_VALUE_BYTES) {
      throw new Error('Quiz trop volumineux : réduis le nombre ou la longueur des questions.');
    }
    store.setProperty(QUIZ_PREFIX + clean.id, json);
    return { id: clean.id };
  } finally {
    lock.releaseLock();
  }
}

function deleteQuiz(password, id) {
  checkAdmin_(password);
  if (!/^[a-z0-9-]{1,60}$/.test(String(id))) throw new Error('Identifiant invalide.');
  PropertiesService.getScriptProperties().deleteProperty(QUIZ_PREFIX + id);
  return true;
}

// Les fonctions dont le nom finit par _ ne sont pas appelables depuis la page.
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
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
      throw new Error(label + 'il faut entre 2 et 6 réponses.');
    }
    var options = q.options.map(function (o) { return str_(o, 150); });
    if (options.some(function (o) { return !o; })) throw new Error(label + 'une réponse est vide.');
    if (typeof q.correct !== 'number' || q.correct % 1 !== 0 || q.correct < 0 || q.correct >= options.length) {
      throw new Error(label + 'la bonne réponse est invalide.');
    }
    return { question: question, options: options, correct: q.correct };
  });
  return {
    titre: titre,
    matiere: str_(quiz.matiere, 40) || 'Divers',
    emoji: str_(quiz.emoji, 8) || '📘',
    description: str_(quiz.description, 300),
    questions: questions
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
