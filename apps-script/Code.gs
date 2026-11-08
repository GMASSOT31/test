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
//   srs_<idÉlève>__<idQuiz>  la révision espacée d'un élève sur une leçon : niveau et échéance de chaque question,
//                            date du contrôle, plan de séances, historique (voir « Révision espacée »)
//   schema_version  '3' une fois les anciennes données (prog_, done_, parcours_) effacées
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
  migrateV3_();
  var quizzes = quizzesOf_(st.id);
  var decks = list_(DECK_PREFIX).filter(function (d) { return isFor_(d, st.id); }).map(withoutPour_);
  var props = PropertiesService.getScriptProperties().getProperties();
  var srs = {};
  quizzes.forEach(function (q) { srs[q.id] = presentSrs_(readSrs_(props[srsKey_(st.id, q.id)])); });
  return {
    student: { id: st.id, classe: st.classe, pseudo: st.pseudo },
    quizzes: quizzes.map(withoutPour_),
    decks: decks,
    srs: srs,
    now: Date.now()
  };
}

// ---------------- Révision espacée (parcours v3) ----------------
// Chaque question d'une leçon a un niveau : 0 Nouvelle, 1 Découverte (réussie en QCM), 2 Rappelée (réussie sans choix),
// 3 Ancrée, 4 Maîtrisée. Un succès au PREMIER essai d'une séance fait monter d'un niveau (un QCM ne dépasse pas le
// niveau 1) et repousse la prochaine révision ; une erreur ou « Je ne sais pas » renvoie au niveau 1, révision au plus tôt.
// Sans date de contrôle : révision dans INTERVAL_DAYS[niveau] jours. Avec une date : la leçon suit un plan de séances
// (makePlan_) qui finit juste avant le contrôle ; contrôle le lendemain = mode express (séances espacées d'EXPRESS_GAP_MIN).
// Une séance « bonus » (question pas encore à réviser) n'avance pas le plan ; ses erreurs comptent.
// Enregistrement srs_<élève>__<quiz> :
//   { v:3, it:{ idQuestion: [niveau, échéance(ms), erreurs, réussites, erreursSûres] }, exam:'AAAA-MM-JJ'|'', plan:[ms…],
//     tf: commencer par tester, mode:'actif'|'entretien'|'archive', ses:[[début, durée(s), questions, réussies, bonus]],
//     cur:{ s: séance, f:{ id:1 } }, ops:[…] }
var SRS_PREFIX = 'srs_';
var SCHEMA_KEY = 'schema_version';
var LEVEL_MAX = 4;
var INTERVAL_DAYS = [0, 1, 3, 7, 14];
var MAINTENANCE_DAYS = 30;
var EXPRESS_GAP_MIN = 60;
var DAY_MS = 86400000, MIN_MS = 60000;
var MAX_SESSIONS_KEPT = 30;

function srsKey_(studentId, quizId) { return SRS_PREFIX + studentId + '__' + quizId; }
function defaultSrs_() { return { v: 3, it: {}, exam: '', plan: [], tf: false, mode: 'actif', ses: [], maj: 0 }; }
function readSrs_(raw) { var r = parseJson_(raw); return r && r.v === 3 ? r : defaultSrs_(); }
// Version envoyée aux pages : sans la séance en cours ni les identifiants d'opérations
function presentSrs_(r) {
  return { it: r.it, exam: r.exam || '', plan: r.plan || [], tf: !!r.tf, cfg: !!r.cfg, mode: r.mode || 'actif', ses: (r.ses || []).slice(-MAX_SESSIONS_KEPT) };
}

// Passage au parcours v3 : une seule fois, on efface les anciennes progressions, parcours et compteurs (décision du 8/11/2026).
// Comptes, quiz, paquets et attributions sont conservés.
function migrateV3_() {
  var store = PropertiesService.getScriptProperties();
  if (store.getProperty(SCHEMA_KEY) === '3') return;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (store.getProperty(SCHEMA_KEY) === '3') return;
    Object.keys(store.getProperties()).forEach(function (k) {
      if (k.indexOf(PROGRESS_PREFIX) === 0 || k.indexOf(DONE_PREFIX) === 0 || k.indexOf(PARCOURS_PREFIX) === 0) store.deleteProperty(k);
    });
    store.setProperty(SCHEMA_KEY, '3');
  } finally {
    lock.releaseLock();
  }
}

// ---- dates (fuseau du script : Europe/Paris) ----
function tzOffsetMin_(ms) {
  try {
    var z = Utilities.formatDate(new Date(ms), 'Europe/Paris', 'Z');
    return (z.charAt(0) === '-' ? -1 : 1) * (parseInt(z.substr(1, 2), 10) * 60 + parseInt(z.substr(3, 2), 10));
  } catch (e) {
    return -new Date(ms).getTimezoneOffset();
  }
}
function dayStart_(ms) { var off = tzOffsetMin_(ms) * MIN_MS; return Math.floor((ms + off) / DAY_MS) * DAY_MS - off; }
function dateStart_(str) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ''));
  if (!m) return 0;
  var utc = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  var d = new Date(utc);
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return 0;
  return utc - tzOffsetMin_(utc) * MIN_MS;
}

// Plan de séances jusqu'au contrôle (instant de chaque séance). Contrôle demain : maintenant, +1 h, le matin du contrôle.
// Sinon : aujourd'hui, demain, puis des écarts croissants (3, 7, 15 jours…) et toujours la veille du contrôle.
function makePlan_(now, exam) {
  var E = dateStart_(exam), today = dayStart_(now);
  if (!E) return [];
  var d = Math.round((E - today) / DAY_MS);
  if (d <= 0) return [now];
  if (d === 1) return now + EXPRESS_GAP_MIN * MIN_MS < E ? [now, now + EXPRESS_GAP_MIN * MIN_MS, E] : [now, E];
  var offsets = [0, 1], next = 3;
  while (next < d - 1) { offsets.push(next); next = next * 2 + 1; }
  if (offsets[offsets.length - 1] < d - 1) offsets.push(d - 1);
  var plan = offsets.map(function (o) { return o === 0 ? now : today + o * DAY_MS; });
  if (d === 2) plan.push(E);   // dernier coup d'œil le matin du contrôle
  return plan;
}
function isExpress_(r, now) {
  var E = dateStart_(r.exam);
  return !!E && Math.round((E - dayStart_(now)) / DAY_MS) <= 1;
}
// Prochaine séance du plan (au moins EXPRESS_GAP_MIN plus tard en express, sinon un autre jour), 0 s'il n'y en a plus
function nextSlot_(r, now) {
  var express = isExpress_(r, now);
  var min = express ? now + (EXPRESS_GAP_MIN - 1) * MIN_MS : dayStart_(now) + DAY_MS;
  var plan = r.plan || [];
  for (var i = 0; i < plan.length; i++) if (plan[i] >= min) return plan[i];
  return 0;
}
function lastSlot_(r) { var p = r.plan || []; return p.length ? p[p.length - 1] : 0; }
function examActive_(r, now) { var E = dateStart_(r.exam); return !!E && E + DAY_MS > now; }

// Échéance d'une question qui vient de passer au niveau lvl
function dueFor_(r, lvl, now) {
  if (examActive_(r, now)) {
    var nxt = nextSlot_(r, now);
    if (lvl >= 3) { var last = lastSlot_(r); if (last > now + MIN_MS && (!nxt || last >= nxt)) return last; }
    if (nxt) return nxt;
    // plus de séance prévue avant le contrôle : on revient au rythme normal
  }
  var days = lvl >= LEVEL_MAX && r.it && r.mode === 'entretien' ? MAINTENANCE_DAYS : INTERVAL_DAYS[Math.max(1, Math.min(lvl, LEVEL_MAX))];
  return dayStart_(now) + days * DAY_MS;
}

function seenOpSrs_(r, opId) { return !!opId && (r.ops || []).indexOf(String(opId)) >= 0; }
function rememberOpSrs_(r, opId) { if (opId) r.ops = (r.ops || []).concat(String(opId).slice(0, 40)).slice(-40); }

// Accès commun : élève authentifié, leçon attribuée, enregistrement lu sous verrou puis écrit
function withSrs_(classe, pseudo, pin, quizId, fn) {
  var st = authStudent_(classe, pseudo, pin);
  var quiz = quizzesOf_(st.id).filter(function (q) { return q.id === quizId; })[0];
  if (!quiz) throw new Error('Quiz inaccessible.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var store = PropertiesService.getScriptProperties();
    var key = srsKey_(st.id, quizId);
    var r = readSrs_(store.getProperty(key));
    var out = fn(r, quiz, Date.now());
    r.maj = Date.now();
    store.setProperty(key, JSON.stringify(r));
    return out;
  } finally {
    lock.releaseLock();
  }
}

// Une réponse : stage 'qcm' (reconnaissance) ou 'rappel' (sans choix) ; ok = juste du premier essai ; conf = 'sur' | 'doute' | '' ;
// sid = identifiant de la séance (seule la PREMIÈRE réponse d'une question dans une séance fait avancer le plan).
function answer(classe, pseudo, pin, quizId, qid, stage, ok, conf, sid, opId) {
  return withSrs_(classe, pseudo, pin, quizId, function (r, quiz, now) {
    if (!/^[0-9a-f]{8}$/.test(String(qid)) || !quiz.questions.some(function (q) { return qid_(q) === qid; })) throw new Error('Question inconnue.');
    if (seenOpSrs_(r, opId)) return { qid: qid, item: r.it[qid] || [0, 0, 0, 0, 0], rejoue: true };
    rememberOpSrs_(r, opId);
    sid = String(sid || '').slice(0, 30);
    if (!r.cur || r.cur.s !== sid) r.cur = { s: sid, f: {} };
    var it = r.it[qid] || [0, 0, 0, 0, 0];
    var lvl = it[0];
    var first = !r.cur.f[qid];
    r.cur.f[qid] = 1;
    if (r.plan && r.plan.length && !examActive_(r, now)) { r.plan = []; }
    if (!first) {
      // nouvel essai dans la même séance (après correction) : une question nouvelle apprise passe au niveau 1
      if (ok === true && lvl === 0) { it[0] = 1; it[1] = dueFor_(r, 1, now); }
      r.it[qid] = it;
      return { qid: qid, item: it };
    }
    var due = lvl > 0 && it[1] <= now + 5 * MIN_MS;
    if (ok === true) {
      it[3] += 1;
      if (lvl === 0) lvl = 1;
      else if (due) lvl = stage === 'rappel' && conf !== 'doute' ? Math.min(LEVEL_MAX, lvl + 1) : lvl;
      else { r.it[qid] = it; return { qid: qid, item: it, bonus: true }; }   // révision en avance : le plan ne change pas
      it[0] = lvl; it[1] = dueFor_(r, lvl, now);
    } else {
      it[2] += 1;
      if (conf === 'sur') it[4] += 1;
      it[0] = lvl === 0 ? 0 : 1;
      it[1] = dueFor_(r, 1, now);
    }
    r.it[qid] = it;
    return { qid: qid, item: it };
  });
}

// Fin de séance : ajoutée à l'historique (affiché à l'élève et au parent)
function endSession(classe, pseudo, pin, quizId, sid, stats, opId) {
  return withSrs_(classe, pseudo, pin, quizId, function (r, quiz, now) {
    if (seenOpSrs_(r, opId)) return { ses: r.ses };
    rememberOpSrs_(r, opId);
    var s = stats || {};
    var n = Math.max(0, Math.min(500, Number(s.n) || 0)), okN = Math.max(0, Math.min(n, Number(s.ok) || 0));
    var dur = Math.max(0, Math.min(4 * 3600, Math.round(Number(s.dur) || 0)));
    r.ses = (r.ses || []).concat([[now - dur * 1000, dur, n, okN, s.bonus ? 1 : 0]]).slice(-MAX_SESSIONS_KEPT);
    if (r.cur && r.cur.s === String(sid || '').slice(0, 30)) delete r.cur;
    return { ses: r.ses };
  });
}

// Date du contrôle ('' = pas de contrôle) et préférence « commencer par tester » ; refait le plan à partir de maintenant.
function setLessonPlan(classe, pseudo, pin, quizId, exam, testFirst) {
  return withSrs_(classe, pseudo, pin, quizId, function (r, quiz, now) { applyPlan_(r, exam, testFirst, now); return presentSrs_(r); });
}
function applyPlan_(r, exam, testFirst, now) {
  exam = String(exam || '');
  if (exam) {
    var E = dateStart_(exam);
    if (!E) throw new Error('Date invalide.');
    if (E < dayStart_(now) || E > now + 366 * DAY_MS) throw new Error('Choisis une date entre aujourd\'hui et dans un an.');
  }
  r.exam = exam;
  r.plan = exam ? makePlan_(now, exam) : [];
  if (typeof testFirst === 'boolean') { r.tf = testFirst; r.cfg = 1; }
  r.mode = 'actif';
  // les questions déjà travaillées suivent le nouveau plan : à revoir à la prochaine séance
  Object.keys(r.it).forEach(function (id) {
    var it = r.it[id];
    if (it[0] > 0 && exam) it[1] = Math.min(it[1], nextSlot_(r, now) || r.plan[0] || now);
  });
}

// Après le contrôle : 'entretien' (rappels espacés longs), 'archive' (hors révision du jour) ou 'actif'
function setLessonMode(classe, pseudo, pin, quizId, mode) {
  return withSrs_(classe, pseudo, pin, quizId, function (r, quiz, now) { applyMode_(r, mode, now); return presentSrs_(r); });
}
function applyMode_(r, mode, now) {
  if (['actif', 'entretien', 'archive'].indexOf(mode) < 0) throw new Error('Choix invalide.');
  r.mode = mode;
  if (mode !== 'actif') { r.exam = ''; r.plan = []; }
  if (mode === 'entretien') {
    Object.keys(r.it).forEach(function (id) { var it = r.it[id]; if (it[0] > 0) it[1] = Math.max(it[1], dayStart_(now) + INTERVAL_DAYS[Math.min(it[0], LEVEL_MAX)] * DAY_MS); });
  }
}

// ---------------- Côté administrateur (mot de passe requis pour tout) ----------------

function adminData(password) {
  checkAdmin_(password);
  migrateV3_();
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
      .map(function (q) { return lessonSummary_(q, readSrs_(props[srsKey_(st.id, q.id)])); });
  });
  return {
    students: students.map(publicStudent_),
    quizzes: customQuizzes,
    decks: list_(DECK_PREFIX),
    builtins: builtins.map(function (q) {
      return { id: q.id, titre: q.titre, emoji: q.emoji, matiere: q.matiere, questions: q.questions.length, pour: assigned[q.id] || [], modifie: !!modifies[q.id] };
    }),
    progress: progress,
    now: Date.now()
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

// Le parent fixe ou corrige la date du contrôle d'une leçon pour un élève ('' = pas de contrôle), ou change son mode.
function setLessonPlanAdmin(password, studentId, quizId, exam) {
  return withSrsAdmin_(password, studentId, quizId, function (r, now) { applyPlan_(r, exam, undefined, now); });
}
function setLessonModeAdmin(password, studentId, quizId, mode) {
  return withSrsAdmin_(password, studentId, quizId, function (r, now) { applyMode_(r, mode, now); });
}
function withSrsAdmin_(password, studentId, quizId, fn) {
  checkAdmin_(password);
  if (!students_().some(function (s) { return s.id === studentId; })) throw new Error('Élève inconnu.');
  var quiz = quizzesOf_(studentId).filter(function (q) { return q.id === quizId; })[0];
  if (!quiz) throw new Error("Cette leçon n'est pas attribuée à cet élève.");
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var store = PropertiesService.getScriptProperties();
    var key = srsKey_(studentId, quizId);
    var r = readSrs_(store.getProperty(key));
    fn(r, Date.now());
    r.maj = Date.now();
    store.setProperty(key, JSON.stringify(r));
    return lessonSummary_(quiz, r);
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
  return { supprimes: deleteProgress_(studentId, quizId) };
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


// Le quiz est-il destiné à cet élève ? (quiz intégré attribué, ou quiz créé pour lui)
function quizFor_(quiz, studentId, assigned) {
  return quiz.pour ? isFor_(quiz, studentId) : (assigned[quiz.id] || []).indexOf(studentId) >= 0;
}

function quizzesOf_(studentId) {
  var assigned = builtinAssign_();
  return builtins_().concat(list_(QUIZ_PREFIX).map(withQids_)).filter(function (q) { return quizFor_(q, studentId, assigned); });
}

// Résumé d'une leçon pour le suivi parent : questions par niveau, à réviser maintenant, prête pour le contrôle,
// questions difficiles, date du contrôle et plan, historique des séances.
function lessonSummary_(quiz, r) {
  var now = Date.now();
  var niveaux = [0, 0, 0, 0, 0], erreurs = 0, aReviser = 0, maj = r.maj || 0;
  var difficiles = [];
  quiz.questions.forEach(function (question) {
    var it = r.it[qid_(question)] || [0, 0, 0, 0, 0];
    niveaux[Math.min(it[0], LEVEL_MAX)]++;
    erreurs += it[2];
    if (it[0] > 0 && it[1] <= now) aReviser++;
    if (it[2] > 0) difficiles.push({ question: question.question, erreurs: it[2], sures: it[4], niveau: it[0] });
  });
  difficiles.sort(function (a, b) { return b.erreurs - a.erreurs || a.niveau - b.niveau; });
  var total = quiz.questions.length;
  return {
    id: quiz.id, titre: quiz.titre, emoji: quiz.emoji, matiere: quiz.matiere, total: total,
    niveaux: niveaux, erreurs: erreurs, aReviser: aReviser, maj: maj,
    pret: total ? Math.round((niveaux[2] + niveaux[3] + niveaux[4]) / total * 100) : 0,
    difficiles: difficiles.slice(0, 5),
    exam: r.exam || '', plan: r.plan || [], mode: r.mode || 'actif',
    seances: (r.ses || []).slice(-10).reverse().map(function (x) { return { debut: x[0], duree: x[1], questions: x[2], reussies: x[3], bonus: !!x[4] }; }),
    nbSeances: (r.ses || []).length
  };
}

// Sauvegarde complète des données (comptes avec PIN haché, quiz, progressions) : à conserver hors du dépôt.
function backupData(password) {
  checkAdmin_(password);
  var props = PropertiesService.getScriptProperties().getProperties();
  delete props.ADMIN_PASSWORD;
  return { date: Date.now(), schema: 3, proprietes: props };
}

// Supprime la révision d'un élève ('all' = tous) sur une leçon ('all' = toutes) ; renvoie le nombre d'enregistrements supprimés.
// Les anciennes clés (prog_, done_, parcours_) sont effacées au passage si elles existent encore.
function deleteProgress_(studentId, quizId) {
  return deleteByPrefix_(SRS_PREFIX, studentId, quizId) + deleteByPrefix_(PROGRESS_PREFIX, studentId, quizId) +
    deleteByPrefix_(DONE_PREFIX, studentId, quizId) + deleteByPrefix_(PARCOURS_PREFIX, studentId, quizId);
}

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
      // réponse courte facultative : permet de reposer la question sans choix (rappel écrit)
      if (Array.isArray(q.rappel)) {
        var rappel = q.rappel.map(function (r) { return str_(r, 80); }).filter(Boolean).slice(0, 10);
        if (rappel.length) out.rappel = rappel;
      }
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
