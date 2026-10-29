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
// Quiz et paquets de flashcards ajoutés depuis la page d'administration (?p=admin)
// Stockés dans les propriétés du script : une propriété 'quiz_<id>' ou 'deck_<id>' par élément.
// Le mot de passe se définit dans Paramètres du projet > Propriétés du script
// (propriété ADMIN_PASSWORD). Sans lui, aucune écriture n'est possible.
// ---------------------------------------------------------------
var QUIZ_PREFIX = 'quiz_';
var DECK_PREFIX = 'deck_';
var MAX_QUESTIONS = 50;
var MAX_CARDS = 150;
var MAX_VALUE_BYTES = 8500; // une propriété est limitée à 9 Ko

// Lectures publiques : utilisées par la page d'accueil.
function getQuizzes() { return list_(QUIZ_PREFIX); }
function getDecks() { return list_(DECK_PREFIX); }

// Écritures : protégées par le mot de passe.
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

// Les fonctions dont le nom finit par _ ne sont pas appelables depuis la page.
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
