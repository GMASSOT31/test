function doGet(e) {
  // Récupère le nom de la page demandée via le paramètre URL ?p=nom_du_fichier (ex : ?p=admin)
  // Si aucun paramètre n'est spécifié, le script charge le fichier 'Index' par défaut.
  var page = (e && e.parameter && e.parameter.p) ? e.parameter.p : 'Index';

  // Nom de l'application : QUIZy (titre de l'onglet du navigateur)
  try {
    return HtmlService.createHtmlOutputFromFile(page)
      .setTitle(page === 'admin' ? 'QUIZy · Parents' : 'QUIZy')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    // Si le fichier HTML demandé n'existe pas, retour automatique sur 'Index'
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('QUIZy')
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
//   parent_<id>   un compte parent invité = une famille (pseudo, nom de famille, mot de passe haché)
// Les élèves, quiz et paquets d'une famille invitée portent le champ fam (= id du parent) ; sans fam : famille de
// l'administrateur principal. Administrateur principal : ADMIN_PSEUDO + ADMIN_PASSWORD (ou ADMIN_PASS_HASH une fois le
// mot de passe changé depuis l'appli). INVITE_CODE : code d'invitation pour créer une famille (absent = inscriptions fermées).
//
// Séparation des élèves : le serveur ne renvoie à un élève que les quiz et paquets qui lui sont destinés
// (champ « pour »). Un quiz ou un paquet sans destinataire reste caché.
// ---------------------------------------------------------------
var QUIZ_PREFIX = 'quiz_';
var DECK_PREFIX = 'deck_';
var STUDENT_PREFIX = 'student_';
var GUEST_PREFIX = 'guest_';
var GUEST_CLASS = '@invitation';
var OVERRIDE_PREFIX = 'override_';   // version modifiée d'un quiz intégré (l'original reste dans Contenu.gs)
var BUILTIN_ASSIGN_KEY = 'builtin_assign';
var SHARES_KEY = 'shares';   // leçons partagées par l'administrateur avec les familles (voir shares_)
var DISCIPLINE_PREFIX = 'lesson_discipline_';
var CLASSIFICATION_PREFIX = 'lesson_classification_';
var PROGRESS_PREFIX = 'prog_';
var DONE_PREFIX = 'done_';
var PARCOURS_PREFIX = 'parcours_';
var MAX_QUESTIONS = 60;
var MAX_SYNTHESES = 10;    // questions de synthèse en plus (15 % de 60, arrondi au-dessus = 9)
var MIN_ATTENDUS = 2, MAX_ATTENDUS = 5;   // éléments essentiels attendus d'une question de synthèse (3 à 5 demandés à l'IA)
var MAX_CARDS = 150;
var MAX_FIELDS = 12;       // champs maximum dans une question à plusieurs champs
var MAX_STUDENTS = 40;          // élèves de la famille de l'administrateur principal
var MAX_FAMILY_STUDENTS = 12;   // élèves d'une famille invitée
var MAX_ALL_STUDENTS = 150;     // toutes familles confondues
var PARENT_PREFIX = 'parent_';
var INVITE_KEY = 'INVITE_CODE';
var OWNER_HASH_KEY = 'ADMIN_PASS_HASH';
var MAX_FAMILIES = 15;
var MAX_ADMIN_FAILS = 8;        // erreurs de connexion parent avant blocage temporaire (par pseudo)
var MAX_INVITE_FAILS = 20;      // mauvais codes d'invitation avant blocage temporaire
var MIN_PASSWORD = 8;
var STORAGE_MAX = 500000;       // les propriétés du script sont limitées à environ 500 Ko
var STORAGE_SIGNUP_LIMIT = 0.85; // au-delà, plus de nouvelle famille
var MAX_VALUE_BYTES = 8500; // une propriété est limitée à 9 Ko : au-delà, on découpe
var CHUNK_CHARS = 3000;     // taille d'un morceau (3 octets au pire par caractère, donc < 9 Ko)
var MAX_ITEM_CHARS = 250000; // plafond de sécurité pour un quiz ou un paquet
var MAX_PIN_FAILS = 5;      // erreurs de PIN avant blocage temporaire
var LOCK_SECONDS = 300;     // durée du blocage (5 minutes)
var QUIZ_ACTIVITY_SECONDS = 75;

// ---------------- Côté élève ----------------

// Connexion + données de l'élève en un seul appel. Les identifiants sont revérifiés à chaque appel.
function getStudentData(classe, pseudo, pin) {
  var st = authStudent_(classe, pseudo, pin);
  migrateV3_();
  var quizzes = quizzesOf_(st.id);
  var decks = st.quiz ? [] : list_(DECK_PREFIX).filter(function (d) { return isFor_(d, st.id); }).map(withoutPour_);
  var props = PropertiesService.getScriptProperties().getProperties();
  var srs = {};
  quizzes.forEach(function (q) { srs[q.id] = presentSrs_(readSrs_(props[srsKey_(st.id, q.id)])); });
  var data = {
    student: { id: st.id, classe: st.classe, pseudo: st.pseudo },
    quizzes: quizzes.map(withoutPour_),
    decks: decks,
    srs: srs,
    now: Date.now()
  };
  if (st.quiz) data.guest = { parentCode: st.parentUsed ? '' : guestParentCode_(st.id, pin), helpful: st.helpful };
  return data;
}

// Signal éphémère d’une séance visible. Le cache ne fait pas partie des sauvegardes.
function reportQuizActivity(classe, pseudo, pin, sid, quizId, answered) {
  if (!/^[a-z0-9]{8,40}$/.test(String(sid))) throw new Error('Séance invalide.');
  var st = authStudent_(classe, pseudo, pin);
  if (st.quiz) return false;
  var cache = CacheService.getScriptCache();
  var key = 'quiz-visible|' + st.id;
  var previous = parseJson_(cache.get(key));
  if (quizId === '') {
    if (previous && previous.sid === sid) cache.remove(key);
    return true;
  }
  var quiz = quizzesOf_(st.id).find(function (q) { return q.id === quizId; });
  if (!quiz) throw new Error('Quiz inaccessible.');
  var time = Date.now();
  var lastAnswer = previous && previous.sid === sid && previous.quizId === quizId ? previous.lastAnswer : null;
  cache.put(key, JSON.stringify({ sid: sid, quizId: quizId, titre: quiz.titre, seenAt: time,
    lastAnswer: answered === true ? time : lastAnswer }), QUIZ_ACTIVITY_SECONDS);
  return true;
}

function getQuizActivity(cred) {
  var me = ownerOnly_(cred);
  var cache = CacheService.getScriptCache();
  var active = {};
  familyStudents_(me).forEach(function (st) {
    var seen = parseJson_(cache.get('quiz-visible|' + st.id));
    if (seen) active[st.id] = { titre: seen.titre, seenAt: seen.seenAt, lastAnswer: seen.lastAnswer };
  });
  return active;
}

// Invitations à une seule leçon, indépendantes des comptes élèves et des attributions ordinaires.
function createQuizInvitation(cred, kind, quizId, pseudo, exam) {
  ownerOnly_(cred);
  migrateV3_();
  pseudo = str_(pseudo, 30);
  if (!pseudo) throw new Error('Choisis un pseudo.');
  var store = PropertiesService.getScriptProperties();
  var source = kind === 'builtin' ? builtins_() : kind === 'quiz' ? list_(QUIZ_PREFIX).filter(function (q) { return !q.fam; }) : [];
  var quiz = source.filter(function (q) { return q.id === quizId; })[0];
  if (!quiz) throw new Error('Leçon introuvable.');
  var now = Date.now(), r = defaultSrs_();
  applyPlan_(r, exam, false, now);
  if (list_(GUEST_PREFIX).length >= 100 || storageBytes_(store.getProperties()) > STORAGE_MAX * STORAGE_SIGNUP_LIMIT)
    throw new Error("Limite d’invitations atteinte. Supprime une invitation terminée pour libérer de la place.");
  var id = 'invite-' + Utilities.getUuid().replace(/-/g, '');
  var secret = Utilities.getUuid().replace(/-/g, '');
  var parentCode = guestParentCode_(id, secret);
  var expires = (exam ? dateStart_(exam) : now) + 7 * DAY_MS;
  var guest = { id: id, pseudo: pseudo, ajoute: now, expires: expires, exam: r.exam,
    hash: hashPin_(id, secret), parentHash: hashPin_(id, parentCode), quiz: withoutPour_(withQids_(quiz)) };
  putItem_(store, GUEST_PREFIX, id, guest);
  store.setProperty(srsKey_(id, quizId), JSON.stringify(r));
  return { link: id + '.' + secret, expires: expires };
}

function guestParentCode_(id, secret) {
  return 'I' + id.slice(7).toUpperCase() + hashPin_('parent:' + id, secret).slice(0, 32).toUpperCase();
}

function guestById_(id) {
  if (!/^invite-[0-9a-f]{32}$/.test(String(id))) return null;
  var guest = getItem_(PropertiesService.getScriptProperties(), GUEST_PREFIX, id);
  return guest && guest.quiz ? guest : null;
}

function removeQuizInvitation(cred, id) {
  ownerOnly_(cred);
  var guest = guestById_(id);
  if (!guest) throw new Error('Invitation introuvable.');
  var store = PropertiesService.getScriptProperties();
  delItem_(store, GUEST_PREFIX, id);
  store.deleteProperty(srsKey_(id, guest.quiz.id));
  return true;
}

function quizInvitationFeedback(id, secret, helpful) {
  var guest = authStudent_(GUEST_CLASS, id, secret);
  if (typeof helpful !== 'boolean') throw new Error('Réponse invalide.');
  guest.helpful = helpful;
  putItem_(PropertiesService.getScriptProperties(), GUEST_PREFIX, id, guest);
  return true;
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
function readSrs_(raw) {
  var r = parseJson_(raw);
  if (!r || r.v !== 3) return defaultSrs_();
  // Reprend les anciens plans (minuit ou rappel nocturne) sans toucher aux niveaux ni à l’historique.
  var times = new Map();
  function normalize(ms) {
    if (!times.has(ms)) times.set(ms, revisionTime_(ms));
    return times.get(ms);
  }
  r.plan = Array.from(new Set((r.plan || []).map(normalize)));
  Object.keys(r.it).forEach(function (id) {
    var it = r.it[id];
    if (it[1] > 0) it[1] = normalize(it[1]);
  });
  return r;
}
// Version envoyée aux pages : sans la séance en cours ni les identifiants d'opérations
function presentSrs_(r) {
  return { it: r.it, exam: r.exam || '', plan: r.plan || [], tf: !!r.tf, cfg: !!r.cfg, mode: r.mode || 'actif', ses: (r.ses || []).slice(-MAX_SESSIONS_KEPT), syn: r.syn || {} };
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

// Jour civil représenté en UTC pour pouvoir lui ajouter des jours de calendrier,
// puis conversion de 7 h ou 22 h avec le décalage du jour cible (heure d’été/hiver).
function revisionDay_(ms) {
  return Math.floor((ms + tzOffsetMin_(ms) * MIN_MS) / DAY_MS) * DAY_MS;
}
function revisionHour_(day, hour) {
  var local = day + hour * 60 * MIN_MS;
  return local - tzOffsetMin_(local) * MIN_MS;
}
function revisionTime_(ms) {
  var day = revisionDay_(ms), morning = revisionHour_(day, 7);
  if (ms < morning) return morning;
  return ms < revisionHour_(day, 22) ? ms : revisionHour_(day + DAY_MS, 7);
}

// Plan de séances jusqu'au contrôle. Après 22 h, le prochain créneau commence à 7 h.
function makePlan_(now, exam) {
  var E = dateStart_(exam), today = revisionDay_(now);
  if (!E) return [];
  var examDay = revisionDay_(E), d = (examDay - today) / DAY_MS;
  var first = revisionTime_(now);
  if (d <= 0) return revisionDay_(first) === today ? [first] : [];
  if (d === 1) {
    var morning = revisionHour_(examDay, 7), later = first + EXPRESS_GAP_MIN * MIN_MS;
    if (first >= morning) return [morning];
    return later < revisionHour_(today, 22) ? [first, later, morning] : [first, morning];
  }
  var offsets = [0, 1], next = 3;
  while (next < d - 1) { offsets.push(next); next = next * 2 + 1; }
  if (offsets[offsets.length - 1] < d - 1) offsets.push(d - 1);
  var plan = offsets.map(function (o) { return o === 0 ? first : revisionHour_(today + o * DAY_MS, 7); });
  if (d === 2) plan.push(revisionHour_(examDay, 7));
  return Array.from(new Set(plan));
}
function isExpress_(r, now) {
  var E = dateStart_(r.exam);
  return !!E && (revisionDay_(E) - revisionDay_(now)) / DAY_MS <= 1;
}
// Prochaine séance du plan (au moins EXPRESS_GAP_MIN plus tard en express, sinon un autre jour), 0 s'il n'y en a plus
function nextSlot_(r, now) {
  var express = isExpress_(r, now);
  var min = express ? now + (EXPRESS_GAP_MIN - 1) * MIN_MS : revisionHour_(revisionDay_(now) + DAY_MS, 7);
  var plan = r.plan || [];
  for (var i = 0; i < plan.length; i++) if (plan[i] >= min) return plan[i];
  return 0;
}
function lastSlot_(r) { var p = r.plan || []; return p.length ? p[p.length - 1] : 0; }
function examActive_(r, now) { var E = dateStart_(r.exam); return !!E && revisionDay_(E) >= revisionDay_(now); }

// Échéance d'une question qui vient de passer au niveau lvl
function dueFor_(r, lvl, now) {
  if (examActive_(r, now)) {
    var nxt = nextSlot_(r, now);
    if (lvl >= 3) { var last = lastSlot_(r); if (last > now + MIN_MS && (!nxt || last >= nxt)) return last; }
    if (nxt) return nxt;
    // plus de séance prévue avant le contrôle : on revient au rythme normal
  }
  var days = lvl >= LEVEL_MAX && r.it && r.mode === 'entretien' ? MAINTENANCE_DAYS : INTERVAL_DAYS[Math.max(1, Math.min(lvl, LEVEL_MAX))];
  return revisionHour_(revisionDay_(now) + days * DAY_MS, 7);
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
    return answerCore_(r, now, qid, stage === 'synthese' ? 'qcm' : stage, ok, conf, sid, opId);   // la synthèse passe par answerSynthese
  });
}

// Question de synthèse : l'enfant rédige, compare au corrigé, puis s'autoévalue (aucune note automatique).
// evaluation 'reussi' = comme un rappel réussi (niveau +1 si elle était à revoir : intervalle plus long) ;
// 'partiel' = comme « juste, mais je doutais » (niveau inchangé : elle revient plus vite) ;
// 'non' = comme une erreur (niveau 1 : elle revient à court terme). Mêmes intervalles que le reste du parcours.
// La réponse rédigée et l'autoévaluation sont gardées (3 dernières par question) pour suivre la progression.
function answerSynthese(classe, pseudo, pin, quizId, qid, evaluation, texte, sid, opId) {
  if (['reussi', 'partiel', 'non'].indexOf(evaluation) < 0) throw new Error('Autoévaluation invalide.');
  return withSrs_(classe, pseudo, pin, quizId, function (r, quiz, now) {
    var q = /^[0-9a-f]{8}$/.test(String(qid)) ? quiz.questions.filter(function (x) { return qid_(x) === qid; })[0] : null;
    if (!q || !q.synthese) throw new Error('Question inconnue.');
    var res = answerCore_(r, now, qid, 'synthese', evaluation !== 'non', evaluation === 'partiel' ? 'doute' : '', sid, opId);
    if (!res.rejoue) {
      r.syn = r.syn || {};
      r.syn[qid] = (r.syn[qid] || []).concat([[now, evaluation, str_(texte, 1500)]]).slice(-3);
    }
    return res;
  });
}

// Noyau commun : une réponse (première de la séance seule comptée, idempotence par opId, révision en avance sans effet)
function answerCore_(r, now, qid, stage, ok, conf, sid, opId) {
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
      else if (due) lvl = (stage === 'rappel' || stage === 'synthese') && conf !== 'doute' ? Math.min(LEVEL_MAX, lvl + 1) : lvl;
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
    if (revisionDay_(E) < revisionDay_(now) || E > now + 366 * DAY_MS) throw new Error('Choisis une date entre aujourd\'hui et dans un an.');
  }
  r.exam = exam;
  r.plan = exam ? makePlan_(now, exam) : [];
  if (typeof testFirst === 'boolean') { r.tf = testFirst; r.cfg = 1; }
  r.mode = 'actif';
  // les questions déjà travaillées suivent le nouveau plan : à revoir à la prochaine séance
  Object.keys(r.it).forEach(function (id) {
    var it = r.it[id];
    if (it[0] > 0 && exam) it[1] = Math.min(it[1], nextSlot_(r, now) || r.plan[0] || revisionTime_(now));
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
    Object.keys(r.it).forEach(function (id) { var it = r.it[id]; if (it[0] > 0) it[1] = Math.max(it[1], revisionHour_(revisionDay_(now) + INTERVAL_DAYS[Math.min(it[0], LEVEL_MAX)] * DAY_MS, 7)); });
  }
}

// ---------------- Côté administrateur (identifiants requis pour tout) ----------------
// Chaque parent ne voit et ne modifie que SA famille : ses élèves (champ fam), ses leçons et paquets créés (champ fam),
// et l'accès de ses élèves aux leçons fournies. L'administrateur principal (ADMIN_PSEUDO) a la famille '' (données
// sans champ fam) ; lui seul modifie les leçons fournies, gère le code d'invitation et voit l'onglet Parents.

function adminData(cred) {
  var me = checkAdmin_(cred);
  migrateV3_();
  var store = PropertiesService.getScriptProperties();
  var props = store.getProperties();
  var assigned = builtinAssign_();
  var students = familyStudents_(me);
  var ids = students.map(function (s) { return s.id; });
  var sh = shares_();
  // ce que voit ce parent : leçons fournies partagées avec sa famille (toutes pour l'administrateur), ses leçons créées,
  // et les leçons créées par d'autres que l'administrateur lui a partagées (administrateur : toutes celles des familles)
  var visibles = list_(QUIZ_PREFIX).filter(function (q) { return visibleQuiz_(sh, q, me.fam); }).map(withQids_);
  var customQuizzes = visibles.filter(ownedBy_(me));
  var autres = visibles.filter(function (q) { return !ownedBy_(me)(q); });
  var builtins = builtins_().filter(function (q) { return visibleBuiltin_(sh, q.id, me.fam); });
  var modifies = {};
  list_(OVERRIDE_PREFIX).forEach(function (o) { modifies[o.id] = true; });
  var allQuizzes = builtins.concat(visibles);
  var progress = {};
  students.forEach(function (st) {
    progress[st.id] = allQuizzes
      .filter(function (q) { return quizFor_(q, st.id, assigned); })
      .map(function (q) { return lessonSummary_(q, readSrs_(props[srsKey_(st.id, q.id)])); });
  });
  var res = {
    moi: { pseudo: me.pseudo, owner: me.owner, famille: me.famille || '' },
    students: students.map(publicStudent_),
    // destinataires limités aux enfants de la famille : jamais ceux d'une autre famille
    quizzes: customQuizzes.map(function (q) {
      var c = withPourOf_(q, ids);
      if (me.owner) c.familles = sh['q:' + q.id] || [];
      return c;
    }),
    decks: list_(DECK_PREFIX).filter(ownedBy_(me)),
    builtins: builtins.map(function (q) {
      var b = { id: q.id, titre: q.titre, emoji: q.emoji, matiere: q.matiere, questions: q.questions.length, pour: onlyIds_(assigned[q.id], ids), modifie: me.owner && !!modifies[q.id] };
      if (me.owner) b.familles = sh['b:' + q.id] || [];
      return b;
    }),
    // famille : leçons créées par d'autres, partagées par l'administrateur (sans dire par qui ni avec qui d'autre)
    partagees: me.owner ? [] : autres.map(function (q) { return lessonCard_(q, ids); }),
    progress: progress,
    now: Date.now()
  };
  if (me.owner) {
    var classification = lessonClassification_(props);
    if (classification.disciplines.length) res.lessonClassification = classification;
    var all = students_();
    res.parents = parents_().map(function (p) {
      return { id: p.id, pseudo: p.pseudo, famille: p.famille, ajoute: p.ajoute, vu: p.vu || 0,
        enfants: all.filter(function (s) { return s.fam === p.id; }).length };
    });
    // 3e partie : leçons créées par les familles, avec la famille auteure et les familles à qui elles sont partagées
    var noms = {};
    parents_().forEach(function (p) { noms[p.id] = p.famille; });
    res.leconsFamilles = autres.map(function (q) {
      var c = lessonCard_(q, ids);
      c.auteur = q.fam; c.famille = noms[q.fam] || '?'; c.familles = sh['q:' + q.id] || [];
      return c;
    });
    res.invitation = store.getProperty(INVITE_KEY) || '';
    var guests = list_(GUEST_PREFIX);
    if (guests.length) res.quizInvitations = guests.map(function (st) {
      return { id: st.id, pseudo: st.pseudo, expires: st.expires, exam: st.exam, helpful: st.helpful,
        progress: lessonSummary_(st.quiz, readSrs_(props[srsKey_(st.id, st.quiz.id)])) };
    });
    res.stockage = { octets: storageBytes_(props), max: STORAGE_MAX };
  } else {
    touchParent_(store, me.fam);
  }
  return res;
}

// Classement personnel de l’administrateur, séparé des leçons et de leurs destinataires.
function lessonClassification_(props) {
  var disciplines = [], byLesson = {};
  Object.keys(props).forEach(function (key) {
    if (key.indexOf(DISCIPLINE_PREFIX) === 0) disciplines.push(parseJson_(props[key]));
    if (key.indexOf(CLASSIFICATION_PREFIX) === 0) byLesson[key.slice(CLASSIFICATION_PREFIX.length)] = props[key];
  });
  return { disciplines: disciplines.filter(Boolean), byLesson: byLesson };
}

function createLessonDiscipline(cred, name) {
  return saveLessonDiscipline_(cred, name, null);
}

function renameLessonDiscipline(cred, id, name) {
  return saveLessonDiscipline_(cred, name, typeof id === 'string' ? id : '');
}

function saveLessonDiscipline_(cred, name, id) {
  ownerOnly_(cred);
  var label = str_(name, 60).replace(/\s+/g, ' ');
  if (!label) throw new Error('Donne un nom à la discipline.');
  var store = PropertiesService.getScriptProperties();
  var state = lessonClassification_(store.getProperties());
  var discipline = state.disciplines.find(function (d) { return d.id === id; });
  if (id !== null && !discipline) throw new Error('Discipline introuvable.');
  if (state.disciplines.some(function (d) { return d.id !== id && norm_(d.name) === norm_(label); })) {
    throw new Error('Cette discipline existe déjà.');
  }
  if (!discipline) {
    discipline = { id: Utilities.getUuid(), name: label };
    state.disciplines.push(discipline);
  }
  discipline.name = label;
  store.setProperty(DISCIPLINE_PREFIX + discipline.id, JSON.stringify(discipline));
  return state;
}

function classifyLesson(cred, kind, id, disciplineId) {
  ownerOnly_(cred);
  var store = PropertiesService.getScriptProperties();
  if (!/^[a-z0-9-]{1,80}$/.test(String(id))) throw new Error('Leçon introuvable.');
  var exists = kind === 'builtin' ? builtins_().some(function (q) { return q.id === id; })
    : kind === 'quiz' ? getItem_(store, QUIZ_PREFIX, id)
    : kind === 'deck' && getItem_(store, DECK_PREFIX, id);
  if (!exists) throw new Error('Leçon introuvable.');
  var key = CLASSIFICATION_PREFIX + kind + ':' + id;
  if (disciplineId === '') store.deleteProperty(key);
  else {
    if (typeof disciplineId !== 'string' || !store.getProperty(DISCIPLINE_PREFIX + disciplineId)) {
      throw new Error('Discipline introuvable.');
    }
    store.setProperty(key, disciplineId);
  }
  return lessonClassification_(store.getProperties());
}

// Création (sans id) ou modification (avec id) d'un compte. Le PIN est enregistré haché : on ne peut plus le relire.
// En modification, un PIN vide conserve l'ancien.
function saveStudent(cred, student) {
  var me = checkAdmin_(cred);
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
    var family = all.filter(function (s) { return (s.fam || '') === me.fam; });
    var existing = null;
    if (student.id && /^[a-z0-9-]{1,60}$/.test(student.id)) {
      existing = family.filter(function (s) { return s.id === student.id; })[0] || null;
      if (!existing && all.some(function (s) { return s.id === student.id; })) throw new Error('Élève inconnu.');
    }
    if (!existing && !pin) throw new Error('Le PIN est obligatoire pour un nouvel élève.');
    if (pin && !/^\d{4,8}$/.test(pin)) throw new Error('Le PIN doit comporter de 4 à 8 chiffres.');
    var max = me.owner ? MAX_STUDENTS : MAX_FAMILY_STUDENTS;
    if (!existing && family.length >= max) throw new Error('Maximum ' + max + ' élèves.');
    if (!existing && all.length >= MAX_ALL_STUDENTS) throw new Error("Le nombre maximum d'élèves est atteint : contacte l'administrateur.");
    var same = all.filter(function (s) {
      return (!existing || s.id !== existing.id) && norm_(s.classe) === norm_(classe) && norm_(s.pseudo) === norm_(pseudo);
    })[0];
    if (same && (same.fam || '') === me.fam) throw new Error('Cet élève existe déjà dans cette classe (même pseudo).');
    // la connexion élève se fait par classe + pseudo : ce couple doit rester unique entre toutes les familles
    if (same) throw new Error('Un autre élève utilise déjà ce pseudo dans cette classe : choisis un autre pseudo (ex. « ' + pseudo + ' ' + pseudo.charAt(0).toUpperCase() + '. ») ou une autre classe.');

    var rec = existing || { id: uniqueStudentId_(pseudo, all), ajoute: Date.now() };
    if (!existing && me.fam) rec.fam = me.fam;
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

// Supprime l'élève, sa progression, et le retire de tout ce qui lui était destiné.
function deleteStudent(cred, id) {
  var me = checkAdmin_(cred);
  if (!/^[a-z0-9-]{1,60}$/.test(String(id))) throw new Error('Identifiant invalide.');
  if (!familyStudents_(me).some(function (s) { return s.id === id; })) throw new Error('Élève inconnu.');
  deleteStudentCore_(id);
  return true;
}

function saveQuiz(cred, quiz) {
  var me = checkAdmin_(cred);
  var ids = familyIds_(me);
  return save_(QUIZ_PREFIX, validateQuiz_(quiz, ids), quiz.id, me.fam, ids);
}

function saveDeck(cred, deck) {
  var me = checkAdmin_(cred);
  var ids = familyIds_(me);
  return save_(DECK_PREFIX, validateDeck_(deck, ids), deck.id, me.fam, ids);
}

function deleteQuiz(cred, id) {
  var me = checkAdmin_(cred);
  if (!/^[a-z0-9-]{1,60}$/.test(String(id))) throw new Error('Identifiant invalide.');
  var item = getItem_(PropertiesService.getScriptProperties(), QUIZ_PREFIX, id);
  if (!item) return true;
  var own = (item.fam || '') === me.fam;
  // une famille ne supprime que ses leçons ; l'administrateur peut aussi supprimer celles des familles
  if (!own && !me.owner) throw new Error('Élément introuvable.');
  var sh = shares_();
  if (own && !me.owner) {
    // leçon partagée par l'administrateur (ou donnée à d'autres enfants) : suppression bloquée pour la famille auteure
    var ids = familyIds_(me);
    var ailleurs = (sh['q:' + id] || []).length > 0 || (item.pour || []).some(function (sid) { return ids.indexOf(sid) < 0; });
    if (ailleurs) throw new Error("Cette leçon est partagée avec d'autres familles : demande à l'administrateur de la supprimer.");
  }
  remove_(QUIZ_PREFIX, id);
  deleteProgress_('all', id);
  if (sh['q:' + id]) { delete sh['q:' + id]; saveShares_(sh); }
  return true;
}

function deleteDeck(cred, id) {
  var me = checkAdmin_(cred);
  checkOwned_(DECK_PREFIX, id, me);
  return remove_(DECK_PREFIX, id);
}

// À qui est donné un quiz intégré (parmi les élèves de la famille ; les autres familles ne sont pas touchées)
function setBuiltinAssign(cred, quizId, pour) {
  return assignBuiltin_(checkAdmin_(cred), quizId, pour);
}

// Donner ou retirer une leçon (kind 'builtin' ou 'quiz') ou un paquet ('deck') : pour = les élèves de la famille qui l'ont.
// Sert aux cases à cocher de la page parents (enregistrement immédiat, sans renvoyer tout le contenu).
function setAccess(cred, kind, id, pour) {
  var me = checkAdmin_(cred);
  if (kind === 'builtin') return assignBuiltin_(me, id, pour);
  var prefix = kind === 'quiz' ? QUIZ_PREFIX : kind === 'deck' ? DECK_PREFIX : '';
  if (!prefix) throw new Error('Type inconnu.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var item;
    if (prefix === QUIZ_PREFIX) {
      // leçon créée : celle de la famille, ou une leçon qui lui est partagée (administrateur : toutes)
      if (!/^[a-z0-9-]{1,60}$/.test(String(id))) throw new Error('Identifiant invalide.');
      item = getItem_(PropertiesService.getScriptProperties(), prefix, id);
      if (!item || !visibleQuiz_(shares_(), item, me.fam)) throw new Error('Élément introuvable.');
    } else {
      item = checkOwned_(prefix, id, me);
      if (!item) throw new Error('Élément introuvable.');
    }
    var ids = familyIds_(me);
    item.pour = mergePour_(item.pour, ids, cleanPour_(pour, ids));
    putItem_(PropertiesService.getScriptProperties(), prefix, item.id, item);
    return { pour: onlyIds_(item.pour, ids) };
  } finally {
    lock.releaseLock();
  }
}

function assignBuiltin_(me, quizId, pour) {
  if (!isBuiltin_(quizId)) throw new Error('Quiz intégré inconnu.');
  if (!visibleBuiltin_(shares_(), quizId, me.fam)) throw new Error("Cette leçon ne t'a pas été partagée.");
  var ids = familyIds_(me);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var assigned = builtinAssign_();
    assigned[quizId] = mergePour_(assigned[quizId], ids, cleanPour_(pour, ids));
    PropertiesService.getScriptProperties().setProperty(BUILTIN_ASSIGN_KEY, JSON.stringify(assigned));
    return { pour: onlyIds_(assigned[quizId], ids) };
  } finally {
    lock.releaseLock();
  }
}

// ---------------- Partage des leçons avec les familles (administrateur principal) ----------------
// kind 'builtin' (leçon fournie) ou 'quiz' (leçon créée : la sienne ou celle d'une famille) ; familles = ids des familles qui
// la voient dans « Leçons fournies ». Une famille retirée : ses enfants n'ont plus la leçon (leur progression est gardée).
function setShare(cred, kind, id, familles) {
  ownerOnly_(cred);
  var store = PropertiesService.getScriptProperties();
  var key, quiz = null;
  if (kind === 'builtin') {
    if (!isBuiltin_(id)) throw new Error('Quiz intégré inconnu.');
    key = 'b:' + id;
  } else if (kind === 'quiz') {
    if (!/^[a-z0-9-]{1,60}$/.test(String(id))) throw new Error('Identifiant invalide.');
    quiz = getItem_(store, QUIZ_PREFIX, id);
    if (!quiz) throw new Error('Leçon introuvable.');
    key = 'q:' + id;
  } else {
    throw new Error('Type inconnu.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var auteur = quiz ? (quiz.fam || '') : '';
    var chosen = cleanPour_(familles, parents_().map(function (p) { return p.id; })).filter(function (f) { return f !== auteur; });
    var sh = shares_();
    var before = sh[key] || [];
    if (chosen.length) sh[key] = chosen; else delete sh[key];
    saveShares_(sh);
    var removed = before.filter(function (f) { return chosen.indexOf(f) < 0; });
    if (removed.length) {
      var kids = students_().filter(function (s) { return removed.indexOf(s.fam || '') >= 0; }).map(function (s) { return s.id; });
      var drop = function (list) { return (list || []).filter(function (x) { return kids.indexOf(x) < 0; }); };
      if (quiz) {
        quiz.pour = drop(quiz.pour);
        putItem_(store, QUIZ_PREFIX, quiz.id, quiz);
      } else {
        var assigned = builtinAssign_();
        assigned[id] = drop(assigned[id]);
        store.setProperty(BUILTIN_ASSIGN_KEY, JSON.stringify(assigned));
      }
    }
    return { familles: chosen };
  } finally {
    lock.releaseLock();
  }
}

// Version à modifier d'un quiz intégré : la version en vigueur (modifiée ou d'origine) et ses destinataires.
function getBuiltinForEdit(cred, quizId) {
  var me = ownerOnly_(cred);
  if (!isBuiltin_(quizId)) throw new Error('Quiz intégré inconnu.');
  var quiz = builtins_().filter(function (q) { return q.id === quizId; })[0];
  return { quiz: quiz, pour: onlyIds_(builtinAssign_()[quizId], familyIds_(me)) };
}

// Enregistre une version modifiée d'un quiz intégré (l'original reste intact et peut être rétabli).
// Les questions gardent leur identifiant : la progression des élèves est conservée, même si l'énoncé change.
// Réservé à l'administrateur principal : la leçon modifiée est la même pour toutes les familles.
function saveBuiltin(cred, quizId, quiz) {
  var me = ownerOnly_(cred);
  if (!isBuiltin_(quizId)) throw new Error('Quiz intégré inconnu.');
  var ids = familyIds_(me);
  var clean = validateQuiz_(quiz, ids);
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
    assigned[quizId] = mergePour_(assigned[quizId], ids, pour);
    store.setProperty(BUILTIN_ASSIGN_KEY, JSON.stringify(assigned));
  } finally {
    lock.releaseLock();
  }
  return { id: quizId };
}

// Rétablit la version d'origine d'un quiz intégré. La progression des élèves est conservée.
function restoreBuiltin(cred, quizId) {
  ownerOnly_(cred);
  if (!isBuiltin_(quizId)) throw new Error('Quiz intégré inconnu.');
  delItem_(PropertiesService.getScriptProperties(), OVERRIDE_PREFIX, quizId);
  return true;
}

// Le parent fixe ou corrige la date du contrôle d'une leçon pour un élève ('' = pas de contrôle), ou change son mode.
function setLessonPlanAdmin(cred, studentId, quizId, exam) {
  return withSrsAdmin_(cred, studentId, quizId, function (r, now) { applyPlan_(r, exam, undefined, now); });
}
function setLessonModeAdmin(cred, studentId, quizId, mode) {
  return withSrsAdmin_(cred, studentId, quizId, function (r, now) { applyMode_(r, mode, now); });
}
function withSrsAdmin_(cred, studentId, quizId, fn) {
  var me = checkAdmin_(cred);
  if (!familyStudents_(me).some(function (s) { return s.id === studentId; })) throw new Error('Élève inconnu.');
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

// Remise à zéro de la progression : pour un élève (id ou 'all' = tous les élèves DE LA FAMILLE) et une leçon (id ou 'all').
// La progression étant enregistrée sur le serveur, l'élève la retrouve vide à sa prochaine connexion ou actualisation.
function resetProgress(cred, studentId, quizId) {
  var me = checkAdmin_(cred);
  studentId = studentId || 'all';
  quizId = quizId || 'all';
  var ids = familyIds_(me);
  if (studentId !== 'all' && ids.indexOf(studentId) < 0) throw new Error('Élève inconnu.');
  if (quizId !== 'all' && !/^[a-z0-9-]{1,60}$/.test(String(quizId))) throw new Error('Identifiant de quiz invalide.');
  var n = 0;
  (studentId === 'all' ? ids : [studentId]).forEach(function (id) { n += deleteProgress_(id, quizId); });
  return { supprimes: n };
}

// ---------------- Familles : inscription, mots de passe, onglet Parents ----------------

// Inscription d'une famille depuis la page de connexion parents : il faut le code d'invitation donné par l'administrateur.
function createFamily(code, info) {
  info = info && typeof info === 'object' ? info : {};
  var store = PropertiesService.getScriptProperties();
  var cache = CacheService.getScriptCache();
  var failKey = 'invitation-echecs';
  var invite = store.getProperty(INVITE_KEY) || '';
  var normalized = normCode_(code);
  var guestCode = /^I[0-9A-F]{64}$/.test(normalized);
  var guest = guestCode ? guestById_('invite-' + normalized.slice(1, 33).toLowerCase()) : null;
  if (guestCode && (!guest || guest.parentUsed || guest.expires <= Date.now() || guest.parentHash !== hashPin_(guest.id, normalized)))
    throw new Error("Ce lien d’inscription a expiré ou a déjà été utilisé.");
  if (!guestCode && Number(cache.get(failKey) || 0) >= MAX_INVITE_FAILS) throw new Error("Trop d'essais. Réessaie dans quelques minutes.");
  if (!invite && !guestCode) throw new Error("Les inscriptions sont fermées : demande un code d'invitation à l'administrateur.");
  if (!guestCode && normalized !== normCode_(invite)) {
    cache.put(failKey, String(Number(cache.get(failKey) || 0) + 1), LOCK_SECONDS);
    Utilities.sleep(1000);
    throw new Error("Code d'invitation incorrect.");
  }
  var famille = str_(info.famille, 40);
  var pseudo = str_(info.pseudo, 30);
  if (famille.length < 2) throw new Error('Indique le nom de ta famille.');
  if (pseudo.length < 2) throw new Error('Choisis un pseudo (2 caractères minimum).');
  checkNewPassword_(info.password);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var parents = parents_();
    if (parents.length >= MAX_FAMILIES) throw new Error("Le nombre maximum de familles est atteint : contacte l'administrateur.");
    var owner = store.getProperty('ADMIN_PSEUDO') || '';
    if (norm_(pseudo) === norm_(owner) || parents.some(function (p) { return norm_(p.pseudo) === norm_(pseudo); })) {
      throw new Error('Ce pseudo est déjà pris : choisis-en un autre.');
    }
    if (storageBytes_(store.getProperties()) > STORAGE_MAX * STORAGE_SIGNUP_LIMIT) {
      throw new Error("L'espace de stockage est presque plein : contacte l'administrateur.");
    }
    var id = uniqueId_(slugify_(pseudo) || 'parent', parents.map(function (p) { return p.id; }));
    var salt = Utilities.getUuid();
    var rec = { id: id, pseudo: pseudo, famille: famille, salt: salt, hash: hashPin_(salt, info.password), ajoute: Date.now(), vu: 0 };
    if (guest) {
      guest.parentUsed = true;
      putItem_(store, GUEST_PREFIX, guest.id, guest);
    }
    store.setProperty(PARENT_PREFIX + id, JSON.stringify(rec));
    return { pseudo: pseudo, famille: famille };
  } finally {
    lock.releaseLock();
  }
}

// Le parent connecté change son mot de passe (cred contient le mot de passe ACTUEL).
// Administrateur principal : le nouveau mot de passe est enregistré haché (ADMIN_PASS_HASH) et ADMIN_PASSWORD est retiré.
// Mot de passe oublié : remettre la propriété ADMIN_PASSWORD dans l'éditeur Apps Script, elle reprend le dessus.
function changePassword(cred, newPassword) {
  var me = checkAdmin_(cred);
  checkNewPassword_(newPassword);
  var store = PropertiesService.getScriptProperties();
  var salt = Utilities.getUuid();
  if (me.owner) {
    store.setProperty(OWNER_HASH_KEY, salt + ':' + hashPin_(salt, newPassword));
    store.deleteProperty('ADMIN_PASSWORD');
  } else {
    setParentPassword_(store, me.fam, newPassword);
  }
  return true;
}

// Code d'invitation : 'new' en crée un nouveau (l'ancien ne marche plus), 'close' ferme les inscriptions.
function setInviteCode(cred, action) {
  ownerOnly_(cred);
  var store = PropertiesService.getScriptProperties();
  if (action === 'close') {
    store.deleteProperty(INVITE_KEY);
    return { code: '' };
  }
  var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // sans 0/O, 1/I/L : facile à dicter
  var hex = Utilities.getUuid().replace(/[^0-9a-f]/gi, '');
  var code = '';
  for (var i = 0; i < 8; i++) code += alphabet.charAt(parseInt(hex.substr(i * 2, 2), 16) % alphabet.length);
  code = code.slice(0, 4) + '-' + code.slice(4);
  store.setProperty(INVITE_KEY, code);
  return { code: code };
}

// L'administrateur donne un nouveau mot de passe à un parent qui a oublié le sien.
function resetParentPassword(cred, parentId, newPassword) {
  ownerOnly_(cred);
  checkNewPassword_(newPassword);
  var store = PropertiesService.getScriptProperties();
  var p = setParentPassword_(store, parentId, newPassword);
  CacheService.getScriptCache().remove('admin-echecs|' + norm_(p.pseudo));
  return true;
}

// L'administrateur supprime une famille : le compte parent, ses élèves (et leur progression), ses leçons et paquets.
function deleteFamily(cred, parentId) {
  ownerOnly_(cred);
  var store = PropertiesService.getScriptProperties();
  var p = /^[a-z0-9-]{1,60}$/.test(String(parentId)) ? parseJson_(store.getProperty(PARENT_PREFIX + parentId)) : null;
  if (!p) throw new Error('Famille inconnue.');
  students_().filter(function (s) { return s.fam === p.id; }).forEach(function (s) { deleteStudentCore_(s.id); });
  list_(QUIZ_PREFIX).filter(function (q) { return q.fam === p.id; }).forEach(function (q) { delItem_(store, QUIZ_PREFIX, q.id); deleteProgress_('all', q.id); });
  list_(DECK_PREFIX).filter(function (d) { return d.fam === p.id; }).forEach(function (d) { delItem_(store, DECK_PREFIX, d.id); });
  var sh = shares_();
  Object.keys(sh).forEach(function (k) {
    if (k.indexOf('q:') === 0 && !getItem_(store, QUIZ_PREFIX, k.slice(2))) { delete sh[k]; return; }   // leçon supprimée
    sh[k] = sh[k].filter(function (f) { return f !== p.id; });
    if (!sh[k].length) delete sh[k];
  });
  saveShares_(sh);
  store.deleteProperty(PARENT_PREFIX + p.id);
  return true;
}

// ---------------- Fonctions internes (le _ final les rend non appelables depuis les pages) ----------------

function students_() { return list_(STUDENT_PREFIX); }
function parents_() { return list_(PARENT_PREFIX); }

// Ce qui appartient à la famille du parent connecté (me.fam : '' pour l'administrateur principal)
function familyStudents_(me) { return students_().filter(function (s) { return (s.fam || '') === me.fam; }); }
function familyIds_(me) { return familyStudents_(me).map(function (s) { return s.id; }); }
function ownedBy_(me) { return function (item) { return (item.fam || '') === me.fam; }; }
function onlyIds_(list, ids) { return (list || []).filter(function (id) { return ids.indexOf(id) >= 0; }); }
// Remplace, dans une liste de destinataires, ceux de la famille par la nouvelle sélection (les autres familles restent)
function mergePour_(old, familyIds, chosen) {
  return (old || []).filter(function (id) { return familyIds.indexOf(id) < 0; }).concat(chosen);
}
function checkOwned_(prefix, id, me) {
  if (!/^[a-z0-9-]{1,60}$/.test(String(id))) throw new Error('Identifiant invalide.');
  var item = getItem_(PropertiesService.getScriptProperties(), prefix, id);
  if (item && (item.fam || '') !== me.fam) throw new Error('Élément introuvable.');
  return item;
}

function deleteStudentCore_(id) {
  var store = PropertiesService.getScriptProperties();
  store.deleteProperty(STUDENT_PREFIX + id);
  CacheService.getScriptCache().remove('quiz-visible|' + id);
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
}

// Taille occupée par les propriétés du script (clés + valeurs, en octets UTF-8)
function storageBytes_(props) {
  return Object.keys(props).reduce(function (n, k) { return n + utf8Len_(k) + utf8Len_(String(props[k])); }, 0);
}
function utf8Len_(text) { return unescape(encodeURIComponent(text)).length; }
function normCode_(code) { return String(code == null ? '' : code).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function checkNewPassword_(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) throw new Error('Le mot de passe doit faire au moins ' + MIN_PASSWORD + ' caractères.');
  if (password.length > 100) throw new Error('Le mot de passe est trop long (100 caractères maximum).');
}
function setParentPassword_(store, parentId, password) {
  var key = PARENT_PREFIX + parentId;
  var p = /^[a-z0-9-]{1,60}$/.test(String(parentId)) ? parseJson_(store.getProperty(key)) : null;
  if (!p) throw new Error('Famille inconnue.');
  p.salt = Utilities.getUuid();
  p.hash = hashPin_(p.salt, password);
  store.setProperty(key, JSON.stringify(p));
  return p;
}
// Dernière connexion d'un parent invité (au plus une écriture toutes les 10 minutes)
function touchParent_(store, parentId) {
  var key = PARENT_PREFIX + parentId;
  var p = parseJson_(store.getProperty(key));
  if (p && Date.now() - (p.vu || 0) > 10 * MIN_MS) {
    p.vu = Date.now();
    store.setProperty(key, JSON.stringify(p));
  }
}

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
  if (studentId.indexOf('invite-') === 0) {
    var guest = guestById_(studentId);
    if (guest) return [guest.quiz];
  }
  var assigned = builtinAssign_(), sh = shares_();
  var st = getItem_(PropertiesService.getScriptProperties(), STUDENT_PREFIX, studentId);
  var fam = st && st.fam ? st.fam : '';
  return builtins_().filter(function (q) { return visibleBuiltin_(sh, q.id, fam); })
    .concat(list_(QUIZ_PREFIX).filter(function (q) { return visibleQuiz_(sh, q, fam); }).map(withQids_))
    .filter(function (q) { return quizFor_(q, studentId, assigned); });
}

// ---- Partages : clé shares = { 'b:<idLeçonFournie>' | 'q:<idLeçonCréée>' : [idFamille…] } ----
// Absente (avant cette fonction) : chaque famille garde les leçons fournies déjà données à ses enfants. Ce calcul ne
// modifie rien (une simple lecture reste une lecture) : la clé n'est écrite qu'au premier changement de partage.
function shares_() {
  var store = PropertiesService.getScriptProperties();
  var raw = store.getProperty(SHARES_KEY);
  if (raw) {
    var s = parseJson_(raw);
    if (s && typeof s === 'object' && !Array.isArray(s)) return s;
  }
  var sh = {}, famOf = {}, assigned = builtinAssign_();
  students_().forEach(function (st) { famOf[st.id] = st.fam || ''; });
  Object.keys(assigned).forEach(function (qid) {
    if (!isBuiltin_(qid)) return;
    (assigned[qid] || []).forEach(function (sid) {
      var f = famOf[sid];
      if (!f) return;
      sh['b:' + qid] = sh['b:' + qid] || [];
      if (sh['b:' + qid].indexOf(f) < 0) sh['b:' + qid].push(f);
    });
  });
  return sh;
}
function saveShares_(sh) { PropertiesService.getScriptProperties().setProperty(SHARES_KEY, JSON.stringify(sh)); }
// fam = '' : administrateur principal (voit tout)
function visibleBuiltin_(sh, quizId, fam) { return !fam || (sh['b:' + quizId] || []).indexOf(fam) >= 0; }
function visibleQuiz_(sh, quiz, fam) { return !fam || (quiz.fam || '') === fam || (sh['q:' + quiz.id] || []).indexOf(fam) >= 0; }
// Copie d'une leçon créée avec seulement les destinataires de la famille
function withPourOf_(q, ids) { var c = {}; Object.keys(q).forEach(function (k) { c[k] = q[k]; }); c.pour = onlyIds_(q.pour, ids); return c; }
// Fiche courte d'une leçon créée par d'autres (sans son contenu)
function lessonCard_(q, ids) {
  return { id: q.id, titre: q.titre, emoji: q.emoji, matiere: q.matiere, questions: q.questions.length, pour: onlyIds_(q.pour, ids) };
}

// Résumé d'une leçon pour le suivi parent : questions par niveau, à réviser maintenant, prête pour le contrôle,
// questions difficiles, date du contrôle et plan, historique des séances.
function lessonSummary_(quiz, r) {
  var now = Date.now();
  var revisionOpen = revisionTime_(now) === now;
  var niveaux = [0, 0, 0, 0, 0], erreurs = 0, aReviser = 0, maj = r.maj || 0;
  var difficiles = [];
  quiz.questions.forEach(function (question) {
    var it = r.it[qid_(question)] || [0, 0, 0, 0, 0];
    niveaux[Math.min(it[0], LEVEL_MAX)]++;
    erreurs += it[2];
    if (it[0] > 0 && it[1] <= now && revisionOpen) aReviser++;
    if (it[2] > 0) difficiles.push({ question: question.question, erreurs: it[2], sures: it[4], niveau: it[0] });
  });
  difficiles.sort(function (a, b) { return b.erreurs - a.erreurs || a.niveau - b.niveau; });
  var total = quiz.questions.length;
  return {
    id: quiz.id, titre: quiz.titre, emoji: quiz.emoji, matiere: quiz.matiere, total: total,
    niveaux: niveaux, erreurs: erreurs, aReviser: aReviser, maj: maj,
    pret: total ? Math.round((niveaux[2] + niveaux[3] + niveaux[4]) / total * 100) : 0,
    // avancement de l'apprentissage : découverte 1/3, rappelée 2/3, ancrée ou maîtrisée 3/3
    avancement: total ? Math.round((niveaux[1] + 2 * niveaux[2] + 3 * (niveaux[3] + niveaux[4])) / (3 * total) * 100) : 0,
    difficiles: difficiles.slice(0, 5),
    // questions de synthèse : dernière autoévaluation et réponse rédigée (suivi par le parent)
    syntheses: quiz.questions.filter(function (q) { return q.synthese; }).map(function (q) {
      var id = qid_(q), hist = (r.syn || {})[id] || [], last = hist[hist.length - 1], it = r.it[id];
      return { question: q.question, niveau: it ? it[0] : 0, essais: hist.length, dernier: last ? { date: last[0], eval: last[1], texte: last[2] } : null };
    }),
    exam: r.exam || '', plan: r.plan || [], mode: r.mode || 'actif',
    seances: (r.ses || []).slice(-10).reverse().map(function (x) { return { debut: x[0], duree: x[1], questions: x[2], reussies: x[3], bonus: !!x[4] }; }),
    nbSeances: (r.ses || []).length
  };
}

// Sauvegarde complète des données (comptes avec PIN haché, quiz, progressions) : à conserver hors du dépôt.
function backupData(cred) {
  ownerOnly_(cred);
  var props = PropertiesService.getScriptProperties().getProperties();
  delete props.ADMIN_PASSWORD;
  delete props[OWNER_HASH_KEY];
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
  Object.keys(item).forEach(function (k) { if (k !== 'pour' && k !== 'fam') copy[k] = item[k]; });
  return copy;
}

// Ne garde que des identifiants d'élèves autorisés (ceux de la famille), sans doublon
function cleanPour_(pour, ids) {
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
  return uniqueId_(slugify_(pseudo) || 'eleve', all.map(function (s) { return s.id; }));
}
function uniqueId_(base, taken) {
  var id = base;
  var n = 2;
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
  if (classe === GUEST_CLASS) {
    var guest = guestById_(pseudo);
    if (!guest || guest.expires <= Date.now() || !/^[0-9a-f]{32}$/.test(String(pin)) || guest.hash !== hashPin_(guest.id, pin))
      throw new Error('Ce lien est expiré ou invalide. Demande un nouveau lien à la personne qui te l’a envoyé.');
    guest.classe = 'Invité';
    return guest;
  }
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
  if (prefix === QUIZ_PREFIX || prefix === DECK_PREFIX) {
    store.deleteProperty(CLASSIFICATION_PREFIX + (prefix === QUIZ_PREFIX ? 'quiz:' : 'deck:') + id);
  }
}

function save_(prefix, clean, requestedId, fam, famIds) {
  var store = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var existing = null;
    if (requestedId && /^[a-z0-9-]{1,60}$/.test(requestedId)) existing = getItem_(store, prefix, requestedId);
    if (existing && (existing.fam || '') !== (fam || '')) throw new Error('Élément introuvable.');
    if (fam) clean.fam = fam;
    if (existing) {
      clean.id = existing.id;
      clean.ajoute = existing.ajoute;
      // leçon partagée : la modifier ne la retire pas aux enfants des autres familles
      if (famIds && Array.isArray(clean.pour)) clean.pour = mergePour_(existing.pour, famIds, clean.pour);
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

// Identifiants d'un parent : { pseudo, password } envoyés par la page d'administration. Renvoie qui est connecté :
// { owner, fam, pseudo, famille }. L'administrateur principal a la famille '' ; un parent invité, celle de son compte.
// Administrateur principal : son pseudo est enregistré dans ADMIN_PSEUDO à la première connexion réussie (il le choisit) ;
// son mot de passe est ADMIN_PASSWORD (en clair, prioritaire : sert aussi en cas d'oubli) ou, une fois changé depuis
// l'appli, ADMIN_PASS_HASH. Un mot de passe seul (ancienne forme) n'est accepté que tant qu'aucun pseudo n'est enregistré.
function checkAdmin_(cred) {
  var store = PropertiesService.getScriptProperties();
  var withPseudo = !!cred && typeof cred === 'object';
  var password = withPseudo ? cred.password : cred;
  if (typeof password !== 'string') password = '';
  var pseudo = withPseudo ? str_(cred.pseudo, 30) : '';
  var saved = store.getProperty('ADMIN_PSEUDO') || '';
  var ownerSet = !!(store.getProperty('ADMIN_PASSWORD') || store.getProperty(OWNER_HASH_KEY));
  var parent = pseudo ? parents_().filter(function (p) { return norm_(p.pseudo) === norm_(pseudo); })[0] : null;
  if (!ownerSet && !parent) {
    throw new Error("Mot de passe administrateur non défini : ajoute la propriété de script ADMIN_PASSWORD.");
  }
  if (withPseudo && !pseudo) throw new Error('Saisis ton pseudo.');
  var cache = CacheService.getScriptCache();
  var failKey = 'admin-echecs|' + norm_(pseudo);
  if (Number(cache.get(failKey) || 0) >= MAX_ADMIN_FAILS) throw new Error("Trop d'essais. Réessaie dans quelques minutes.");
  // un pseudo déjà pris par un parent invité ne peut pas devenir celui de l'administrateur
  var ownerPseudoOk = saved ? (withPseudo && norm_(pseudo) === norm_(saved)) : !parent;
  if (ownerPseudoOk && ownerPasswordOk_(store, password)) {
    cache.remove(failKey);
    if (withPseudo && !saved) store.setProperty('ADMIN_PSEUDO', pseudo);
    return { owner: true, fam: '', pseudo: saved || pseudo, famille: '' };
  }
  if (parent && parent.hash === hashPin_(parent.salt, password)) {
    cache.remove(failKey);
    return { owner: false, fam: parent.id, pseudo: parent.pseudo, famille: parent.famille };
  }
  cache.put(failKey, String(Number(cache.get(failKey) || 0) + 1), LOCK_SECONDS);
  Utilities.sleep(1000); // ralentit les essais répétés
  throw new Error(withPseudo ? 'Pseudo ou mot de passe incorrect.' : 'Mot de passe incorrect.');
}
function ownerPasswordOk_(store, password) {
  var plain = store.getProperty('ADMIN_PASSWORD');
  if (plain) return password === plain;
  var saved = store.getProperty(OWNER_HASH_KEY) || '';
  var i = saved.indexOf(':');
  return i > 0 && saved.slice(i + 1) === hashPin_(saved.slice(0, i), password);
}
// Réservé à l'administrateur principal (leçons fournies, code d'invitation, onglet Parents, sauvegarde)
function ownerOnly_(cred) {
  var me = checkAdmin_(cred);
  if (!me.owner) throw new Error("Réservé à l'administrateur principal.");
  return me;
}

// Une question est de l'un des trois types : à choix (options + correct), à réponse écrite (reponses),
// ou à plusieurs champs (champs : [{ label, reponses, groupe? }], libre?).
function validateQuiz_(quiz, allowedIds) {
  if (!quiz || typeof quiz !== 'object') throw new Error('Quiz invalide.');
  var titre = str_(quiz.titre, 120);
  if (!titre) throw new Error('Le titre est obligatoire.');
  if (!Array.isArray(quiz.questions) || quiz.questions.length < 1) {
    throw new Error('Il faut au moins une question.');
  }
  var nbSyntheses = quiz.questions.filter(function (q) { return q && q.synthese === true; }).length;
  if (quiz.questions.length - nbSyntheses > MAX_QUESTIONS) {
    throw new Error('Maximum ' + MAX_QUESTIONS + ' questions par quiz.');
  }
  if (nbSyntheses > MAX_SYNTHESES) throw new Error('Maximum ' + MAX_SYNTHESES + ' questions de synthèse par leçon.');
  if (nbSyntheses === quiz.questions.length) throw new Error('Il faut au moins une question en plus des questions de synthèse.');
  var seen = {};
  var questions = quiz.questions.map(function (q, i) {
    var label = 'Question ' + (i + 1) + ' : ';
    var question = str_(q && q.question, 300);
    if (!question) throw new Error(label + "l'énoncé est vide.");
    // L'identifiant d'une question existante est conservé (sa progression aussi) ; une nouvelle question en reçoit un.
    var qid = (typeof q.id === 'string' && /^[0-9a-f]{8}$/.test(q.id) && !seen[q.id]) ? q.id : newQid_(seen);
    seen[qid] = true;
    var out = { id: qid, question: question };
    if (q.synthese === true) {
      // Question de synthèse : réponse rédigée, corrigée par l'enfant lui-même (réponse modèle + éléments essentiels attendus)
      var modele = str_(q.modele, 1000);
      if (!modele) throw new Error(label + 'la réponse modèle est vide.');
      var attendus = (Array.isArray(q.attendus) ? q.attendus : []).map(function (a) { return str_(a, 200); }).filter(Boolean);
      if (attendus.length < MIN_ATTENDUS || attendus.length > MAX_ATTENDUS) {
        throw new Error(label + 'il faut entre ' + MIN_ATTENDUS + ' et ' + MAX_ATTENDUS + ' éléments attendus.');
      }
      out.synthese = true;
      out.modele = modele;
      out.attendus = attendus;
    } else if (Array.isArray(q.champs)) {
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
    pour: cleanPour_(quiz.pour, allowedIds || []),
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

function validateDeck_(deck, allowedIds) {
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
    pour: cleanPour_(deck.pour, allowedIds || []),
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
