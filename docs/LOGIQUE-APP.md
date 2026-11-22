# QUIZy — logique complète de l'application de révision

Document de référence : **tout ce que l'application fait, et pourquoi**, indépendamment de la plateforme (Google Apps Script aujourd'hui).
À lire avant toute réécriture ou migration : une nouvelle version doit respecter chaque règle ci-dessous (les suites `tests/` les vérifient).

Sources : `apps-script/Code.gs` (serveur), `apps-script/Index.html` (page élève), `apps-script/admin.html` (espace parents),
`apps-script/Contenu.gs` (leçons fournies). Voir aussi `docs/PARCOURS-V3.md` (genèse du parcours) et `docs/REPRISE.md` (exploitation).

---

## 1. Les acteurs

| Acteur | Accès | Ce qu'il fait |
|---|---|---|
| **Élève (enfant)** | page élève (`/exec`) avec **classe + pseudo + PIN** | révise ses leçons, voit ses progrès, fait des flashcards |
| **Parent invité** | espace parents (`?p=admin`) avec **pseudo + mot de passe** | gère SA famille : ses enfants, leurs leçons, leur suivi |
| **Administrateur principal** (l'utilisateur) | même espace, son pseudo (`ADMIN_PSEUDO`) | comme un parent + modifie les leçons fournies, invite des familles (code), voit les familles, sauvegarde |

Un élève ne voit **que** les leçons et paquets qui lui sont attribués. Un parent ne voit **que** sa famille.

---

## 2. Les données

Stockage clé → valeur (aujourd'hui `PropertiesService`, ~500 Ko au total, 9 Ko par valeur : les gros éléments sont découpés
en morceaux `<clé>~0, <clé>~1…` avec une tête `{ _chunks, id, ajoute }`).

| Clé | Contenu |
|---|---|
| `student_<id>` | `{ id, classe, pseudo, salt, hash, ajoute, fam? }` — hash = SHA-256 hex de `salt + ':' + PIN` |
| `parent_<id>` | famille invitée : `{ id, pseudo, famille, salt, hash, ajoute, vu }` (même hachage, mot de passe) |
| `quiz_<id>` | leçon créée : `{ id, titre, matiere, emoji, description, lien?, pour:[idÉlève], questions:[…], ajoute, fam? }` |
| `deck_<id>` | paquet de flashcards en plus : `{ id, titre, matiere, emoji, description, pour, cartes:[{recto, verso}], ajoute, fam? }` |
| `override_<id>` | version modifiée d'une leçon fournie (l'original reste dans `Contenu.gs`, « Rétablir » supprime l'override) |
| `builtin_assign` | `{ idLeçonFournie: [idÉlève…] }` — à qui est donnée chaque leçon fournie (toutes familles) |
| `lesson_discipline_<id>` | `{ id, name }` — discipline de classement créée par l’administrateur principal |
| `lesson_classification_<type>:<idLeçon>` | identifiant de la discipline dans la vue Leçons de l’administrateur. Sans effet sur les matières, les attributions et la progression |
| `srs_<idÉlève>__<idLeçon>` | révision espacée d'un élève sur une leçon (voir §4) |
| `schema_version` | `'3'` (migration unique déjà faite : anciennes clés `prog_`, `done_`, `parcours_` effacées) |
| `ADMIN_PSEUDO` | pseudo de l'administrateur principal (choisi à sa 1re connexion) |
| `ADMIN_PASSWORD` | mot de passe admin en clair (prioritaire ; sert de secours en cas d'oubli) |
| `ADMIN_PASS_HASH` | `sel:hash` quand l'admin a changé son mot de passe depuis l'appli (`ADMIN_PASSWORD` est alors retiré) |
| `INVITE_CODE` | code d'invitation `XXXX-XXXX` (absent = inscriptions fermées) |

Le cache temporaire `quiz-visible|<idÉlève>` porte le quiz visible, le dernier signal et la dernière réponse signalée. Il expire après 75 secondes, reste limité à l’administrateur principal pour ses propres enfants et ne figure pas dans les exports.

**Famille** : champ `fam` = id du parent invité ; absent = famille de l'administrateur principal.
Les identifiants (`id`) sont des « slugs » du pseudo / titre, rendus uniques (`leo`, `leo-2`…).

### Une question
- QCM : `{ id, question, options:[2..6], correct:index, rappel?:[réponses courtes], explication? }`
- Réponse écrite : `{ id, question, reponses:[1..10 acceptées], explication? }`
- Plusieurs champs : `{ id, question, champs:[{ label, reponses, groupe? }], libre?, explication? }`
- `id` = 8 caractères hexadécimaux, **stable** : la progression y est attachée. Une question sans `id` (leçons fournies d'origine)
  prend l'empreinte **FNV-1a 32 bits** de son énoncé (`qhash_` serveur = `qhash` page : **les deux doivent rester identiques**).
- Corriger l'énoncé ou la réponse garde l'`id`, donc la progression.
- Comparaison des réponses écrites : insensible à la casse, aux accents, à la ponctuation et aux espaces ; un nombre décimal
  « 0,25 » = « 0.25 » (mais ≠ « 25 »).
- Limites : 60 questions par leçon, énoncé 300 car., réponse 150, explication 400, 150 cartes par paquet.

---

## 3. Les leçons
- **Leçons fournies** (`Contenu.gs`, 11 aujourd'hui : Byzance, Grand quiz Byzance, Zootopia, Musique, Anglais animaux, Révolution,
  Technologie 5ᵉ, Physique-chimie 5ᵉ ×4). Chaque parent les donne à ses enfants ; seul l'administrateur principal les modifie
  (pour tous) ou les rétablit.
- **Leçons créées** par un parent : à la main (formulaire) ou **avec une IA** (assistant en 3 étapes, §8). Rangées dans sa famille.
- **Flashcards** : chaque leçon donne automatiquement un paquet (recto = question, verso = bonne réponse) ; des paquets « en plus » peuvent être créés.

---

## 4. Le cœur : la révision espacée (parcours v3)

### 4.1 Principes pédagogiques
1. **Se tester plutôt que relire** : le niveau ne dépend que des réponses, jamais de l'avis de l'enfant.
2. **Espacer** : une question réussie revient de plus en plus tard ; une erreur la fait revenir vite.
3. **Réapprendre dans la séance** : une question ratée revient 4 écrans plus loin, jusqu'à être réussie.
4. **Retrouver plutôt que reconnaître** : QCM pour découvrir, puis questions **sans choix** pour ancrer.
5. **Correction immédiate** : la bonne réponse et l'explication s'affichent tout de suite.
6. **Mélanger** : la révision du jour mélange les leçons.

### 4.2 Les 5 niveaux d'une question
Enregistrement `it[idQuestion] = [niveau, échéance(ms), erreurs, réussites, erreursSûres]`.

| Niveau | Nom | Atteint quand | Revient (sans contrôle) |
|---|---|---|---|
| 0 | 🌱 Nouvelle | jamais réussie | — |
| 1 | 🌿 Découverte | réussie en QCM, ou après une erreur (retour au niveau 1) | demain (J+1) |
| 2 | 🌳 Rappelée | réussie **sans choix**, du premier coup, alors qu'elle était **à revoir** | J+3 |
| 3 | ⭐ Ancrée | idem | J+7 |
| 4 | 🏆 Maîtrisée | idem | J+14 (J+30 en mode entretien) |

Intervalles : `INTERVAL_DAYS = [0, 1, 3, 7, 14]`, `MAINTENANCE_DAYS = 30`. Les échéances régulières commencent à **7 h, heure de Paris**, le jour prévu. Les séances de quiz sont proposées entre 7 h et 22 h. Une séance déjà commencée peut être terminée après 22 h.

### 4.3 Règles de réponse (`answer`)
Paramètres : leçon, question, `stage` (`qcm` ou `rappel`), `ok` (juste du premier essai), `conf` (`sur` | `doute` | ''), `sid`
(identifiant de séance), `opId` (identifiant d'opération).
- **Idempotence** : une opération déjà vue (`opId` parmi les 40 derniers) ne compte pas deux fois (réseau qui rejoue).
- **Seule la première réponse d'une question dans une séance compte.** Un nouvel essai dans la même séance (après correction) ne fait
  que passer une question **nouvelle** au niveau 1 si elle est enfin réussie.
- Une question est **« à revoir »** si niveau > 0 et échéance ≤ maintenant + 5 min.
- **Réussite** : réussites +1 ; niveau 0 → 1 ; si à revoir : en `rappel` sans doute → niveau +1 (max 4), en QCM ou « je crois savoir » →
  niveau inchangé ; **si pas à revoir (révision en avance / séance bonus) : rien ne change** (le plan ne bouge pas).
  Puis échéance = `dueFor_(niveau)`.
- **Erreur** (ou « Je ne sais pas ») : erreurs +1 ; si l'enfant était **sûr**, erreursSûres +1 ; niveau → 1 (0 reste 0) ;
  échéance = `dueFor_(1)` (au plus vite).
- Si la date du contrôle est passée, le plan est vidé (retour au rythme normal).

### 4.4 Date du contrôle et plan de séances (`makePlan_`)
Fixée par l'enfant à la 1re ouverture de la leçon (Demain, Après-demain, Dans une semaine, Pas de contrôle, ou une date), ou par le
parent (suivi, ou étape 3 de la création IA). Bornes : d'aujourd'hui à 1 an.
- **Contrôle demain = mode express** : première séance pendant la fenêtre de révision, rappel à **+1 h** uniquement s’il tombe avant 22 h, puis dernier rappel **facultatif à partir de 7 h** le matin du contrôle.
- 2 jours : aujourd'hui, demain à partir de 7 h, puis le rappel facultatif le matin du contrôle. 3 jours : aujourd'hui, demain, la veille.
- Plus loin : aujourd'hui, demain, J+3, J+7, J+15… (`next = next × 2 + 1`) et **toujours la veille**.
- Contrôle aujourd'hui : une séance pendant la fenêtre de révision, si celle-ci est encore ouverte aujourd’hui.
- Avec un contrôle actif, `dueFor_` place la question à la **prochaine séance du plan** (en express : au moins 59 min plus tard,
  sinon un autre jour) ; une question **ancrée ou maîtrisée** saute à la **dernière** séance. S'il n'y a plus de séance : rythme normal.
- Changer la date recalcule le plan et ramène les questions déjà travaillées à la prochaine séance.
- Après le contrôle, la leçon demande : **🧠 garder en mémoire** (mode `entretien` : rappels espacés, maîtrisées à 30 jours) ou
  **📦 archiver** (mode `archive` : hors révision du jour, réactivable). Mode normal : `actif`.

### 4.5 Composition d'une séance (page élève, `buildTasks`)
- Une séance vise ~15 questions (~10 min) : d'abord les questions **à revoir** (au plus 20, posées **sans choix**), puis des
  **nouvelles** par **blocs de 5** : les 5 cartes « 📖 Je découvre » (question + réponse + explication), puis ces 5 en QCM « ✅ Je teste ».
- **Avec un contrôle à venir** : toutes les nouvelles questions dès la 1re séance (jusqu'à 40), sinon elles n'auraient pas le temps de revenir.
- **« Déjà travaillée en classe »** (`tf`) : pas de cartes, on commence directement par le QCM.
- **Erreur** : bonne réponse affichée, puis « 🔁 Je corrige » : la question revient 4 écrans plus loin (même étape), jusqu'à réussite.
- **Séance bonus** (rien à revoir ni à découvrir) : 10 questions, les moins avancées puis les plus ratées ; ses erreurs comptent,
  ses réussites n'avancent pas le plan.
- **Révision du jour** (accueil) : les questions à revoir de **toutes** les leçons actives, les plus anciennes d'abord, 30 au plus, **mélangées**.
- Passage automatique à la question suivante après une bonne réponse du premier coup (1 s, 1,8 s s'il y a une explication).

### 4.5 bis Questions de synthèse (QUIZy Cloudflare, depuis le 16/11/2026)
- Type de question `{ id, question, synthese: true, modele, attendus:[2..5], explication? }` (10 au plus par leçon, en plus des
  60 questions). Générées par l'IA à la création (15 % du nombre de questions, arrondi au-dessus), modifiables dans l'éditeur.
- Proposées en fin de séance d'une leçon quand ≥ 50 % des questions « classiques » sont au moins Rappelées 🌳 (≥ 30 % à 7 jours
  ou moins du contrôle) : 1 nouvelle par séance (2 près du contrôle, + 1 déjà vue en avance). Jamais en cartes « Je découvre ».
  Une synthèse due revient comme les autres (révision du jour comprise). Aucun appel IA en séance.
- Écran : la question, une zone de texte, « Valider » → réponse modèle + éléments attendus à cocher (la liste ne fait que
  suggérer) → autoévaluation : ✅ J'ai réussi / 🟡 Partiellement / ❌ Je n'ai pas réussi. Pas de note automatique, pas de nouvel
  essai dans la séance, pas de passage automatique. Flashcard : la réponse modèle au verso.
- Serveur `answerSynthese(…, évaluation, texte, sid, opId)` → même moteur que `answer` : réussi = rappel réussi (niveau +1 si à
  revoir, intervalle plus long) ; partiel = « juste mais je doutais » (niveau inchangé, revient plus vite) ; non = erreur
  (niveau 1, J+1). Les 3 dernières réponses rédigées et autoévaluations sont gardées (`srs.syn`) et montrées au parent.

### 4.6 Les formes d'une question selon l'étape
- **QCM d'origine** : choix mélangés ; la bonne réponse s'affiche toujours après le choix.
- **Réponse écrite en étape QCM** : choix fabriqués avec la bonne réponse + jusqu'à 3 autres réponses de la leçon.
- **Rappel d'un QCM** : s'il a des réponses courtes (`rappel`), l'enfant **écrit** ; sinon **« QCM masqué »** : il cherche dans sa tête,
  dit « 😎 Je sais, je suis sûr(e) » / « 🤔 Je crois savoir » / « Je ne sais pas », puis choisit parmi 4-5 propositions (choix
  d'origine + bonnes réponses d'autres questions ; Vrai/Faux : rien d'ajouté). « Je crois savoir » juste = pas de montée.
- **Réponse écrite / champs** : une seule validation ; la bonne réponse s'affiche en cas d'erreur.

### 4.7 Fin de séance (`endSession`)
Historique `ses = [[début, durée(s), questions, réussiesPremierCoup, bonus]]` (30 dernières). Bilan affiché : « X / Y réussies du
premier coup », questions qui ont progressé d'un niveau, prochaine séance, ou « Continuer » / « Découvrir 5 nouvelles questions ».

### 4.8 Enregistrement fiable côté élève
Les envois partent **un par un, dans l'ordre**, chacun avec un `opId` ; **3 essais** en cas de panne réseau (pas pour les erreurs
définitives : PIN incorrect, leçon inaccessible…). Indicateur « ⏳ Sauvegarde en attente » / « ✅ Progression enregistrée » /
« ⚠️ ». Le serveur fait foi : la page recopie ce qu'il renvoie.

### 4.9 Indicateurs
- **Avancement** (parent, par leçon et par enfant) = (Découverte×1 + Rappelée×2 + (Ancrée+Maîtrisée)×3) / (3 × nb questions).
  Les leçons archivées ne comptent pas.
- **« Prête pour le contrôle ? »** = part des questions au moins Rappelées : ≥ 90 % ✅ prête, ≥ 60 % 🟡 presque, sinon 🔴.
- **Questions difficiles** : celles qui ont des erreurs (dont « en étant sûr·e »), les 5 pires.

---

## 5. La page élève
- Connexion **Classe / Pseudo / PIN** (insensible à la casse et aux accents). 5 erreurs sur un couple classe/pseudo → blocage 5 min.
  Classe et pseudo préremplis (jamais le PIN) ; connecté le temps de l'onglet. Lien discret « 👨‍👩‍👧 Espace parents ».
- **Mes leçons** (accueil) : carte « 🎯 Ta révision du jour » (nb de questions, minutes estimées) ; leçons triées : contrôle le plus
  proche, puis « contrôle passé », à réviser, nouvelle, à découvrir, en attente, ancrée ; archivées repliées.
  Chaque carte : badge du contrôle (🔥 aujourd'hui / demain, 📅 date), barre des 5 niveaux, statut et **une seule action**
  (Commencer, Réviser maintenant, Continuer, Séance bonus, Choisir, Réactiver).
- **Écran d'une leçon** : contrôle (modifiable), plan en pastilles (✓ séances faites), niveaux, bouton principal, « 🃏 Voir les cartes ».
- **1re ouverture** : « Quand est ton contrôle ? » + « As-tu déjà travaillé cette leçon en classe ? » (la date du parent est proposée).
- **Mes progrès** : questions ancrées / total, niveaux, séances et minutes de la semaine, leçons.
- **Flashcards** : un paquet par leçon + paquets en plus ; question → « Voir la réponse » → Oublié / Hésité / Trouvé ; Oublié et
  Hésité reviennent jusqu'à Trouvé. **N'influence jamais la révision espacée.**
- Téléphone : bandeau fin, barre d'onglets en bas (Mes leçons, Mes progrès, Flashcards, Se déconnecter).

### 5 ter. Partage des leçons entre familles (QUIZy Cloudflare, depuis le 16/11/2026)
- Clé `shares` = `{ 'b:<idLeçonFournie>' | 'q:<idLeçonCréée>' : [idFamille…] }`. Une famille invitée ne voit dans « Leçons fournies »
  que ce que l'administrateur lui partage (leçons fournies, leçons de l'administrateur, leçons d'autres familles). Tant que la clé
  n'existe pas, chaque famille garde les leçons fournies déjà données à ses enfants (calculé, écrit au premier partage modifié).
- L'administrateur voit une 3e partie « 👪 Leçons créées par les familles » (famille auteure, partages) : il les donne à ses
  enfants, les partage avec d'autres familles (jamais avec l'auteure), ou les supprime (pour tout le monde).
- Une famille donne une leçon partagée à ses enfants (`setAccess`, sans toucher aux enfants des autres familles), ne la modifie pas
  et ne voit ni l'auteure ni les autres destinataires. L'auteure corrige sa leçon pour tous ; une fois partagée (ou donnée à
  d'autres enfants), elle ne peut plus la supprimer : « demande à l'administrateur ».
- Retirer un partage : les enfants de la famille n'ont plus la leçon ; leur progression est gardée (elle revient si on repartage).
- Onglet « Leçons » : parties repliables avec leur nombre (repliées sur téléphone, ouvertes sur ordinateur, état retenu sur
  l'appareil, localStorage `quizy-lecons-ouvertes`). Fonction serveur `setShare(cred, kind, id, familles)` (administrateur).

### Quiz sur invitation (QUIZy Cloudflare)

- Les commandes réservées à l’administrateur sont repérées en violet. Dans « Enfants → Ajouter un orphelin », l’administrateur choisit un pseudo et une leçon fournie ou créée par lui pour générer le lien.
- La date du contrôle est facultative et proposée pour le lendemain. Elle initialise le parcours habituel, dont la révision express si le contrôle est le lendemain. Le lien expire sept jours après la date choisie, ou sept jours après sa création sans date. Les changements ultérieurs du plan de révision ne prolongent pas le lien.
- L’invitation donne accès à une copie de la leçon et à sa propre progression. Le lien contient un secret transmis dans le fragment d’URL. Après validation il est conservé pour la durée de l’onglet, sans créer de profil mémorisé. Le serveur conserve l’empreinte du secret dans `guest_<id>` et la progression dans `srs_<id>__<quiz>`.
- En fin de séance, l’enfant peut répondre à la question « Cette séance t’a aidé à réviser ? » et envoyer un lien séparé à un parent. Ce lien permet de créer une famille une seule fois et expire avec l’invitation. Les liens déjà émis fonctionnent indépendamment du code général de création de famille. La nouvelle famille peut créer des leçons et bénéficie des règles de partage habituelles.
- L’administrateur retrouve le suivi dans « Enfants → Les orphelins », avec les niveaux, les séances et la réponse au sondage. L’expiration bloque l’accès et le suivi reste consultable. Supprimer l’invitation retire ses deux accès et efface la progression associée. La limite est de 100 invitations conservées.

### 5 bis. Écran « Qui es-tu ? » (QUIZy Cloudflare, depuis le 16/11/2026)
- Après chaque connexion réussie (élève ou parent), le profil est mémorisé **sur l'appareil** (localStorage `profiles`, 8 au plus,
  le plus récent en premier, sans doublon) : nom, rôle, identifiant de connexion (classe + pseudo, ou pseudo), couleur d'avatar.
  Jamais de PIN, de mot de passe, de jeton ni de donnée sensible ; rien dans l'URL.
- Au lancement, sans session ouverte et avec au moins un profil : grille de pastilles (initiale colorée + prénom + rôle) sur les
  deux pages. Toucher un profil ne demande plus que le PIN (élève) ou le mot de passe (parent) ; un profil de l'autre rôle ouvre
  l'autre page. « ➕ Autre profil / Nouvelle connexion » = formulaire complet ; « Retirer » enlève un profil de l'appareil.
- Refus : « PIN (ou mot de passe) incorrect, ou ce profil n'existe plus » (on ne dit pas lequel, sécurité) + « Retirer ce profil ».
- Renommage d'un enfant depuis l'espace parents sur le même appareil : son profil suit. Déconnexion : formulaire normal.
- Stockage bloqué (navigation privée) : pas d'écran « Qui es-tu ? », le reste marche normalement.

### 5 quater. Installer QUIZy comme une appli (QUIZy Cloudflare, depuis le 16/11/2026)
- QUIZy est une appli web installable (PWA) : manifeste (`/manifest.webmanifest`, `/manifest-parents.webmanifest` pour
  l'espace parents), icônes 180/192/512/maskable, affichage `standalone` → une fois installée, elle s'ouvre dans sa propre
  fenêtre, sans barre d'adresse. Petit service worker (`/sw.js`) : rend l'appli installable et montre une page « Pas de
  connexion internet » (`/hors-ligne`) si le réseau manque. Il ne met **jamais** en cache les données (/api, /setup).
- Invitation **après une connexion réussie seulement** (jamais sur l'écran de connexion), en bas de l'écran (au-dessus de la
  barre d'onglets sur téléphone), avec l'icône et le nom « Installer QUIZy » ; l'appli reste utilisable derrière.
  - Chrome, Edge, Android… : bouton « Installer » = fenêtre d'installation du navigateur en un clic (`beforeinstallprompt`).
  - iPhone / iPad : bouton « Comment faire ? » = tutoriel en 3 étapes (Partager — en bas sur iPhone, en haut à droite sur
    iPad — → « Sur l'écran d'accueil » → « Ajouter »).
  - Firefox ordinateur, Safari Mac, navigateurs intégrés (Instagram…) : rien n'est proposé.
- Jamais proposé si l'appli est déjà installée (ouverte en fenêtre indépendante, ou installée depuis cette page).
- « Plus tard » (ou refus dans la fenêtre du navigateur, ou « J'ai compris » du tutoriel) : pas de nouvelle proposition avant
  **7 jours** ; « Non merci » : pas avant **90 jours**. Mémorisé sur l'appareil (localStorage `quizy-installation`, aucune donnée
  personnelle). Stockage bloqué : au plus une proposition par visite. Espace parents : menu 👤 → « 📲 Installer l'appli »
  (visible seulement quand l'installation est possible), même après « Plus tard ».

---

## 6. L'espace parents
- Connexion **pseudo + mot de passe** ; lien « 👪 Créer ma famille » (code d'invitation) ; 8 erreurs sur un pseudo → blocage 5 min.
- Barre : **👨‍👧 Enfants** (accueil) · **📚 Leçons** · ↻ · menu **👤 pseudo ▾** (👪 Familles invitées pour l'administrateur,
  🔑 Changer le mot de passe, 🔒 Se déconnecter). À la déconnexion, la page est vidée.
- **Enfants** : une fiche par enfant en **accordéon** (initiale, nom, « N leçons · 🔥/📅 contrôle … », % d'avancement) ; repliée sur
  téléphone, ouverte sur ordinateur, état retenu par appareil. Dépliée : une ligne par leçon (emoji, **titre court** = partie après
  « : », badge du contrôle, %) ; toucher une leçon → titre complet, **date du contrôle**, état, niveaux, questions difficiles,
  historique, archiver/réactiver, remise à zéro. Pied : **📚 Choisir ses leçons** (cases, enregistrées tout de suite) et
  **⚙️ Compte** (activité, rappel de connexion, modifier classe/pseudo/PIN, tout remettre à zéro, supprimer). Guide « 🚀 Pour commencer ».
- **Leçons** : ✏️ Mes leçons, 🏛️ Leçons fournies, 🃏 Cartes en plus ; « ⚙️ Gérer » : cases des enfants (immédiat), Modifier,
  Supprimer / Rétablir. « ➕ Créer une leçon » → choix IA / à la main.
- **Familles invitées** (administrateur) : code d'invitation (nouveau / fermer), adresse à donner, jauge de stockage, familles
  (enfants, inscription, dernière connexion, nouveau mot de passe, supprimer).

---

## 7. Familles et sécurité
- Inscription d'une famille : code d'invitation exact (insensible à la casse/tirets), pseudo unique (y compris celui de l'admin),
  mot de passe ≥ 8 caractères ; 20 mauvais codes → blocage 5 min ; 15 familles max ; inscriptions refusées au-delà de 85 % du stockage.
- Un parent ne peut lire ni modifier que sa famille (élèves, leçons, paquets, progression, attributions des leçons fournies : il ne
  remplace que la part de ses enfants). Le couple **classe + pseudo** d'un élève est **unique entre toutes les familles** (connexion).
- Supprimer une leçon ne touche jamais la progression d'une leçon fournie ni d'une autre famille.
- Limites : 40 élèves pour l'admin, 12 par famille invitée, 150 au total.
- Fonctions réservées à l'administrateur principal : modifier/rétablir une leçon fournie, code d'invitation, nouveau mot de passe ou
  suppression d'une famille, sauvegarde complète (`backupData`, sans les mots de passe admin).

---

## 8. Créer une leçon avec une IA
1. **La demande** : nombre de questions (10 à 60, 20 par défaut) + classe (CE2 → Terminale), retenus par appareil ; texte généré par
   `buildPrompt(n, classe)` : contenu de la leçon uniquement, couverture complète, une idée par question, 4 réponses dont une seule
   juste avec des pièges plausibles, difficultés mêlées, `rappel` pour les réponses courtes, explication, format **JSON**
   `{ titre, matiere, emoji, description, questions:[{ question, options, bonne_reponse (texte), rappel, explication }] }`.
   Depuis le 16/11/2026 : + `syntheses:[{ question, reponse_modele, elements_attendus:[3..5] }]` (15 % arrondi au-dessus,
   plusieurs notions par question, moins voire aucune si la leçon est trop courte).
   Téléphone : **📤 Envoyer à mon IA** (menu de partage) ; partout : **📋 Copier la demande**.
2. **La réponse** : collée puis lue avec tolérance (texte autour, ```json, virgules en trop, guillemets typographiques, réponse en
   lettre ou sans accents, liste seule) ; questions sans bonne réponse reconnaissable ignorées ; 4 réponses max ; 60 questions max.
3. **Vérifier** : titre, pour qui (enfant unique coché d'office), date du contrôle facultative (plan calculé), aperçu → créer ;
   ou « ✏️ Retoucher à la main » (formulaire prérempli).

---

## 9. Fonctions serveur (contrat à garder)
Élève (identifiants classe, pseudo, PIN) : `getStudentData`, `answer`, `endSession`, `setLessonPlan`, `setLessonMode`.
Parent (`{pseudo, password}`) : `adminData`, `saveStudent`, `deleteStudent`, `saveQuiz`, `saveDeck`, `deleteQuiz`, `deleteDeck`,
`setBuiltinAssign`, `setAccess`, `setLessonPlanAdmin`, `setLessonModeAdmin`, `resetProgress`, `changePassword`.
Administrateur principal : `getBuiltinForEdit`, `saveBuiltin`, `restoreBuiltin`, `setInviteCode`, `resetParentPassword`,
`deleteFamily`, `backupData`. Public (avec code) : `createFamily`.
Les fonctions finissant par `_` sont internes. Écritures sous **verrou** (une à la fois).

---

## 10. Invariants à ne jamais casser
1. `qhash` (FNV-1a) identique serveur / page ; `id` des questions stables.
2. Format des enregistrements `srs_…` et des clés (sinon la progression est perdue).
3. Hachage `SHA-256(sel + ':' + secret)` en hexadécimal (PIN des élèves, mots de passe des parents) : une migration doit les reprendre tels quels.
4. Idempotence par `opId`, première réponse de la séance seule comptée, révision en avance sans effet sur le plan.
5. Jours calés sur Europe/Paris.
6. Séparation stricte élèves / familles.
7. 668 contrôles automatiques dans `tests/` (24 suites) : tous verts avant toute mise en ligne.
