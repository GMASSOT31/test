# QUIZy — guide du projet pour les développeurs (Claude Code, Codex)

Application de révision scolaire (élèves + espace parents). Ce fichier est **la** référence pratique : dépôt, hébergement,
données, parcours, commandes, déploiement. `AGENTS.md` y renvoie. Détails métier : `docs/LOGIQUE-APP.md` (invariants §10).
Historique et procédures : `docs/REPRISE.md`, `docs/MIGRATION-CLOUDFLARE.md`, `docs/PARCOURS-V3.md`.

Vérifié le 21/11/2026 (dépôt à `75de053`, accès Cloudflare et GitHub de la session Claude Code). Ce qui n'a pas pu être
confirmé est marqué **(non vérifié)**.

## 1. Consignes de l'utilisateur (toujours valables)
- Répondre en **français**. Être autonome : branche, code, tests, commit, push, déploiement, vérification en ligne, PR, fusion.
- Une question à l'utilisateur = un choix entre au moins 2 options (il travaille depuis son téléphone).
- **Jamais** de jeton, mot de passe ou secret demandé, écrit ou recopié dans le chat, le code, les commits ou la doc.
- **Ne supprimer ni modifier aucune donnée réelle sans accord explicite** (comptes, leçons, progressions en production).
- On ne travaille **que sur QUIZy Cloudflare** (`cloudflare/`). `apps-script/` = ancienne version **figée** : ne pas la
  modifier, ne pas la publier, ne jamais la désactiver ni la rediriger (elle reste en ligne).
- `cartes/` : anciennes pages statiques (servies par GitHub Pages), ne pas toucher.

## 2. Où est quoi (configuration réelle)
| Élément | Valeur |
|---|---|
| Dépôt GitHub | https://github.com/GMASSOT31/test |
| Dossier de l'application | `cloudflare/` (sources à modifier : `cloudflare/source/`, `cloudflare/static/`, `cloudflare/src/`, `cloudflare/theme/`) |
| Branche principale | `main` (branche par défaut, vérifié) |
| Branche de production | **aucune liaison automatique** : la production = ce qui a été publié avec `wrangler deploy`, par convention depuis `main` à jour après fusion. Dernier déploiement (21/11/2026 08:25 UTC, version `e5648755-…`) = `main` à `75de053` (orphelins, #54) : 33 fichiers statiques identiques octet par octet et textes de #54 présents en ligne (vérifié). |
| Site public | https://quizy.gabriel-massot31.workers.dev (élève `/`, parents `/parents`, installation `/installer`) |
| Hébergeur | Cloudflare Workers, offre gratuite |
| Projet | Worker **`quizy`** (`cloudflare/wrangler.toml`), compte Cloudflare `f4ec7fb04d7a99f9e990a5396cf4319d`, sous-domaine `gabriel-massot31.workers.dev` |
| Tableau de bord | https://dash.cloudflare.com/f4ec7fb04d7a99f9e990a5396cf4319d/workers/services/view/quizy/production |
| Base de données | **Cloudflare Durable Objects (stockage SQLite)**, pas de Supabase/D1/KV. Espace de noms `quizy_Store` (id non secret `5a8036f2491e4e16af50e809b465be15`), classe `Store`, **instance unique** `idFromName('quizy-eu')`, `locationHint: 'weur'` |
| Connexion à la base | `cloudflare/src/worker.js` (choix de l'instance) → `cloudflare/src/core.js` (`ctx.storage.sql`, tables `props` et `cache`) |

Autres éléments du même compte, **sans rapport avec QUIZy** (ne pas toucher) : Worker `appely`, projets Pages `suivy`, `tuby`,
`corvee`. Les projets Supabase du compte (Zoo de Lecture, Suivy, CRM C2e, Claudine) ne servent pas à QUIZy (aucune référence
dans le code). Pas de domaine personnalisé, pas de liaison Git « Workers Builds » (vérifié : aucun déclencheur).

Ancienne version (figée, toujours en ligne) : Google Apps Script, URL et identifiants dans `docs/REPRISE.md` §1. Ses données
(propriétés du script Google) sont **distinctes** de celles de Cloudflare (importées une fois à l'installation, puis séparées).
**(non vérifié aujourd'hui** : aucun accès Google Apps Script depuis la session ; dernier état connu = déploiement @40.)

GitHub Pages est actif sur le dépôt (`main`, racine) : il publie notamment `cartes/` sur https://gmassot31.github.io/test/ .
Il n'héberge **pas** QUIZy. (URL non ouverte depuis la session : réseau bloqué ; le flux « pages build and deployment » réussit.)

## 3. Environnements
| Environnement | Comment | Base utilisée | Écrit en production ? |
|---|---|---|---|
| Tests automatiques | `node tests/run-all.cjs` | SQLite **en mémoire** (`node:sqlite`, serveur HTTP local 127.0.0.1) | Non |
| Local | `cd cloudflare && npx wrangler dev` | Durable Object **local** (`cloudflare/.wrangler/state`, non versionné) — vérifié : base vide, redirige vers `/installer` | Non |
| Prévisualisation | **Aucune** : `preview_urls = false`, pas d'environnement wrangler séparé | — | — |
| Production | `npx wrangler deploy` | Durable Object `quizy_Store` / instance `quizy-eu` | **Oui** |

⚠️ Il n'existe pas d'environnement intermédiaire : **tout `wrangler deploy` met en ligne immédiatement, sur les vraies données.**
Ne pas utiliser `wrangler dev --remote` ni `wrangler versions upload` sans accord : comportement vis-à-vis des données réelles
**non vérifié**. Pour « prévisualiser », utiliser les tests (Playwright) ou `wrangler dev` en local.

## 4. Architecture en bref
```
Navigateur ── page HTML (public/index.html, public/parents.html, construites depuis source/Index.html et source/admin.html)
   │  static/run.js : google.script.run.f(args) → POST /api/f  (JSON)  → { ok, value } | { error }
   ▼
src/worker.js ─ src/router.js : /api/*, /setup/* → Durable Object « Store » ; le reste → src/assets.js (fichiers intégrés)
   ▼
src/core.js : services Google réimplémentés (PropertiesService = table props, CacheService = table cache, SHA-256, Europe/Paris)
   ▼
src/app.gen.js = source/Contenu.gs + source/Code.gs emballés SANS modification par build.cjs (la logique métier est dans Code.gs)
```
- `cloudflare/build.cjs` (lancé par wrangler et par les tests) : génère `src/app.gen.js`, `public/`, `src/files.gen.js`, applique
  `theme/theme.cjs` (identité visuelle : chaque remplacement doit trouver sa cible, sinon la construction échoue).
- Pas de Workers Assets : les fichiers sont intégrés au Worker (`src/files.gen.js`).
- Toute fonction de `Code.gs` sans `_` final (et ≠ `doGet`) est appelable par `/api/` : **les contrôles d'accès sont dans
  chaque fonction**. `router.js` refuse les POST non JSON (protection contre les appels d'une autre origine).
- Un seul Durable Object traite une requête à la fois (remplace `LockService`).

### Données (table `props`, clé → JSON) — détail dans `docs/REPRISE.md` §3 et `docs/LOGIQUE-APP.md` §2
`student_<id>` (élève, PIN haché, `fam`), `parent_<id>` (famille invitée), `quiz_<id>` / `deck_<id>` (leçons, cartes ;
morcelées `~0, ~1…`), `override_<id>` (leçon intégrée modifiée ; originaux dans `Contenu.gs`), `builtin_assign`, `shares`
(partage aux familles), `guest_<id>` (id `invite-<32 hex>` ; pseudo, copie du quiz, expiration, empreintes du lien élève et du lien parent à usage unique),
`srs_<élève ou invité>__<quiz>` (révision espacée), `INVITE_CODE`, `ADMIN_PSEUDO`, `ADMIN_PASS_HASH`,
`schema_version`. Table `cache` : compteurs anti-force-brute (`echecs|…`, `admin-echecs|…`).

### Règles d'accès (dans `cloudflare/source/Code.gs`, pas de RLS)
- Élève : `authStudent_(classe, pseudo, pin)` — 5 erreurs → blocage 5 min. Ne reçoit que les leçons dont il est destinataire.
- Élève invité : lien à durée limitée, vérifié à chaque accès au serveur. Il donne accès à une seule leçon et à sa progression.
  Lien `/#quiz=<id>.<secret>` (id = `invite-<32 hex>`, secret = 32 hex) → `connect({ classe: '@invitation', pseudo: id, pin: secret })` (`Index.html`) →
  `authStudent_` reconnaît `@invitation` via `guestById_` (empreinte + expiration). Lien parent : `/parents#invitation=<code>`.
  Les nouveaux liens ajoutent `?invitation=1` pour sélectionner la vignette « À toi de jouer ! » ; le fragment reste côté navigateur. Sans ce paramètre, la page sert la vignette générale « Révise en jouant ! ».
- Parent / administrateur : `checkAdmin_(cred)` → `{owner, fam, pseudo, famille}` ; 8 erreurs → blocage 5 min.
- Cloisonnement par famille : `familyStudents_`, `ownedBy_`, `visibleQuiz_`, `visibleBuiltin_`, `shares_`.
- Administrateur principal seulement : `ownerOnly_` (leçons intégrées, code d'invitation, familles, export).

## 5. Parcours principaux (écran → serveur → données)
Fonctions client dans `cloudflare/source/Index.html` (élève) et `cloudflare/source/admin.html` (parents) ; serveur dans
`cloudflare/source/Code.gs` ; transport `static/run.js` → `src/router.js` → `src/core.js`.

| Parcours | Écran / fonction client | Fonction serveur | Données | Accès | Tests |
|---|---|---|---|---|---|
| Connexion élève | `Index.html` `#login-form` → `connect()` → `enterApp()` | `getStudentData` | `student_*`, `quiz_*`, `deck_*`, `builtin_assign`, `shares`, `srs_*`, cache `echecs|` | `authStudent_` | 01, 03, 09, 32 |
| Réviser (séance, révision du jour) | `buildTasks`, `showTask`, réponses | `answer`, `answerSynthese`, `endSession`, `setLessonPlan`, `setLessonMode` | `srs_<élève>__<quiz>` | `authStudent_` + leçon visible | 02, 12, 13, 14, 35 |
| Connexion parent / admin | `admin.html` `unlock()` → `reload()` → `renderAll()` | `adminData` | `ADMIN_PSEUDO`, `ADMIN_PASS_HASH`, `parent_*` | `checkAdmin_` | 01, 04, 32 |
| Enfants | onglet Enfants | `saveStudent`, `deleteStudent`, `resetProgress` | `student_*`, `srs_*` | `checkAdmin_` + famille | 04, 08, 25 |
| Leçons et cartes (dont création avec une IA) | onglet Leçons, éditeur | `saveQuiz`, `saveDeck`, `deleteQuiz`, `deleteDeck`, `setAccess`, `setBuiltinAssign`, `setShare`, `getBuiltinForEdit`/`saveBuiltin`/`restoreBuiltin` | `quiz_*`, `deck_*`, `override_*`, `builtin_assign`, `shares` | `checkAdmin_`, `ownerOnly_` pour intégrées/partage | 11, 15, 19, 27, 33, 35 |
| Quiz sur invitation | Enfants → Ajouter un orphelin ; suivi dans Enfants → Les orphelins | `createQuizInvitation`, `getStudentData`, API de révision habituelles, `quizInvitationFeedback`, `removeQuizInvitation` ; inscription via `createFamily` | `guest_*`, `srs_*` | Création et suivi réservés à l’administrateur ; accès élève par lien ; lien parent distinct et à usage unique | 38 |
| Familles invitées | « 👪 Créer ma famille » ; menu 👤 → Familles invitées | `createFamily`, `setInviteCode`, `resetParentPassword`, `deleteFamily` | `INVITE_CODE`, `parent_*` | code d'invitation ; `ownerOnly_` | 25, 26, 33 |
| Installation / import / export | `/installer` (`static/installer.html`) ; menu 👤 → Exporter | `/setup/status`, `/setup/install`, `/setup/import` (`core.js`) ; `backupData` | toute la table `props` | secret `INSTALL_CODE` ; admin principal | 28, 29, 31 |
| Profils « Qui es-tu ? » | `static/profils.js` | — (navigateur seul) | localStorage `profiles` | — | 32 |
| Installer l'appli (PWA) | `static/installation.js`, `static/sw.js`, manifestes | — | localStorage `quizy-installation` | — | 36 |
| Quiz intégré illustré « Poker ALL IN » | `Index.html` `questionContent()` : questions `a1100001`…`a1100020` du quiz `poker-all-in` → image `static/poker-all-in-01…20.png` | données dans `source/Contenu.gs` (`BUILTIN_QUIZZES`) | `builtin_assign` | comme les autres leçons intégrées | 37 |

⚠️ **Import** (`/setup/import`) **remplace toutes les données** : jamais en production sans accord explicite.

Dans l’onglet Leçons, l’administrateur crée des disciplines et classe les éléments via « Gérer ». Les quatre rubriques restent distinctes. Un bouton crayon permet de renommer une discipline en conservant son classement. Les fonctions `createLessonDiscipline`, `renameLessonDiscipline` et `classifyLesson` enregistrent ce classement séparément et `adminData` le renvoie uniquement à l’administrateur principal. Le classement est inclus dans la sauvegarde. Voir la suite 39.

L’onglet Enfants de l’administrateur principal affiche les séances visibles de ses enfants. La page élève envoie un signal au début, toutes les 35 secondes et après une réponse. Le cache « quiz-visible » expire après 75 secondes et le tableau se rafraîchit toutes les 25 secondes. Les comptes invités sont exclus et aucun historique de ce signal n’est exporté. Voir la suite 41.

## 6. Versionné dans Git / configuré ailleurs
- **Dans Git** : tout le code (`cloudflare/source`, `static`, `src/{worker,core,router,assets}.js`, `theme`, `build.cjs`,
  `wrangler.toml`, `package*.json`), les tests (`tests/`), la doc.
- **Généré, non versionné** (`cloudflare/.gitignore`) : `public/`, `src/app.gen.js`, `src/files.gen.js`, `node_modules/`,
  `.wrangler/`, `.dev.vars`.
- **Uniquement côté Cloudflare** : secrets du Worker, contenu de la base (Durable Object), historique des déploiements,
  journaux (observability activée), sous-domaine workers.dev.
- **Uniquement côté Google** : ancienne appli Apps Script et ses propriétés (figée). **Côté GitHub** : réglage GitHub Pages.

## 7. Variables d'environnement et secrets (noms seulement, jamais de valeur)
| Nom | Où | Rôle |
|---|---|---|
| `INSTALL_CODE` | secret du Worker (défini en production, vérifié) ; `.dev.vars` en local | code demandé par `/installer` |
| `ADMIN_PASSWORD` | secret du Worker, **absent normalement** (vérifié absent) | secours si le mot de passe admin est oublié : `wrangler secret put`, se connecter, changer le mot de passe, `wrangler secret delete` |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | variables du shell qui déploie | `wrangler deploy`, `secret list`… (droits Workers Scripts : édition) |
| `QUIZY_TARGET` | tests | `cloudflare` (défaut) ou `apps-script` (ancienne version figée) |
| `WRANGLER_SEND_METRICS=false` | facultatif | pas de télémétrie wrangler |

Dans les sessions Claude Code cloud, l’accès est fourni par le proxy. Dans l’espace Codex déjà autorisé, Wrangler
réutilise sa session OAuth via `XDG_CONFIG_HOME=/workspace/.quizy-wrangler`. Si elle a expiré ou si l’espace a été remplacé,
`wrangler login --device --scopes account:read user:read workers_scripts:write` permet au propriétaire du compte de valider
l’accès dans son navigateur. Le dossier de configuration reste en dehors du dépôt.

## 8. Commandes (vérifiées le 21/11/2026 sauf mention)
```bash
cd cloudflare && npm ci                 # dépendances (wrangler 4, mermaid pour la suite 34)
node build.cjs                          # construction seule → public/ + src/*.gen.js
cd .. && node tests/run-all.cjs         # toutes les suites (cible cloudflare) — 35 suites, 1010 contrôles, 0 échec (21/11, `75de053`)
QUIZY_TARGET=cloudflare node tests/36-installation.js   # une suite
cd cloudflare && npx wrangler dev       # site local (base locale vide → /installer ; mettre INSTALL_CODE dans .dev.vars)
npx wrangler deploy                     # ⚠️ MISE EN LIGNE immédiate, données réelles (construit avant d'envoyer)
npx wrangler deployments list           # versions en ligne (lecture)
```
- Tests : Playwright + Chromium (préinstallés dans les sessions cloud ; sinon `npx playwright install chromium`).
  `tests/harness.js` : `makeWorldCf()`, `install(ctx, world, {profils, installation, auto})`, `page()`, `login()`.
  Les suites commençant par `// cible: cloudflare` ne tournent que pour Cloudflare.
- Mise en ligne : **seulement** `wrangler deploy` (manuel). Ni un push ni une fusion sur `main` ne déploient QUIZy
  (une fusion relance seulement GitHub Pages, sans effet sur QUIZy).
- Après déploiement : vérifier en ligne que `/`, `/parents` répondent 200 et les fichiers touchés (sans se connecter avec un
  vrai compte sauf accord).

## 9. Accès dont un agent peut avoir besoin (et comment les vérifier en lecture)
| Mission | Accès | Vérification sans risque |
|---|---|---|
| Code, tests, PR | GitHub (lecture/écriture sur GMASSOT31/test) | `git ls-remote origin` ; `git fetch origin main` |
| Déploiement, journaux, secrets | jeton API Cloudflare du compte | `npx wrangler whoami` ; `npx wrangler deployments list` ; `npx wrangler secret list` (noms seuls) |
| Voir le site | réseau vers `quizy.gabriel-massot31.workers.dev` | `curl -sI https://quizy.gabriel-massot31.workers.dev/` (200) |
| Données réelles | aucune lecture directe prévue : passer par l'export admin (menu 👤) avec l'utilisateur | — |
| Ancienne appli Apps Script | aucune (figée) | — |

## 10. Règles de coopération entre développeurs (Claude Code et Codex)
- **Une branche dédiée par tâche**, créée depuis `main` à jour (`git fetch origin && git switch -c <tâche> origin/main`).
  Jamais de travail direct sur `main`, jamais de `push --force` sur la branche d'un autre.
- **Préserver les changements de l'autre développeur** : ne pas écraser, annuler ni reformater son travail en cours ;
  `git status` avant de commencer ; en cas de conflit, intégrer les deux intentions, sinon demander à l'utilisateur.
- **Avant la fusion** : intégrer le dernier `main` (`git fetch origin && git merge origin/main` ou rebase de sa propre branche),
  puis relancer la construction, la suite du parcours concerné et `node tests/run-all.cjs`.
- **Un seul déploiement à la fois**, depuis `main` à jour après fusion (sinon on écrase en ligne le travail de l'autre).
- Mettre à jour **ce fichier** (et `docs/LOGIQUE-APP.md` si règle métier) quand une modification change une règle métier,
  le back-end, les données ou le déploiement. Pas de copie de ces informations dans `AGENTS.md`.
- Commits et PR en français ; pas de secret ni de donnée personnelle dans les commits, la doc ou les journaux.
