# Reprise du développement – portail de révision (Google Apps Script)

## Prompt à copier dans une nouvelle session Claude Code

```
Je continue le développement d'un portail de révision scolaire pour mes enfants, en application web Google Apps Script. Le dépôt est GMASSOT31/test (dossier apps-script/). Lis d'abord docs/REPRISE.md : il contient l'architecture, les règles, la procédure de publication et les tests.

Règles : réponds en français ; sois autonome (branche, code, tests, commit, push, publication clasp, vérification en ligne, PR et fusion) sans me demander d'autorisation à chaque étape ; quand tu dois me demander quelque chose, utilise l'outil AskUserQuestion avec au moins 2 choix ; ne supprime jamais de données réelles sans mon accord explicite ; ne réutilise pas le mot de passe admin temporaire sans me redemander par dialogue ; ne me demande jamais de jeton ni de mot de passe dans le chat.

Attends ma prochaine consigne.
```

## 1. État
- `main` est déployé en version 24. La branche `cahier-v31` contient le parcours v2 (cahier des charges V3.1) : **préparée et testée, NON publiée** (voir `docs/PARCOURS-V2.md` : règles, migration, retour arrière, procédure de publication).
- URL publique (à ne jamais changer) : `https://script.google.com/macros/s/AKfycbzzqlCAUDZAoHOmhxufvj4CAAHWX8JtU8vBsTB0ZsoEK_mLu2tW4BoESRUdrg4b7bkF/exec` ; admin : `?p=admin`.
- Déploiement à mettre à jour : `AKfycbzzqlCAUDZAoHOmhxufvj4CAAHWX8JtU8vBsTB0ZsoEK_mLu2tW4BoESRUdrg4b7bkF` (ne jamais en créer un autre).
- Script ID clasp : `1AuUOChTuh7QZBnUHmUnCCf9Y0U4Apr08pQvaLuxp862V7d_2CC2FsbLA`.
- Un mot de passe admin temporaire (communiqué par l'utilisateur pendant une session) est peut-être encore en place : demander de le remplacer dans la propriété de script `ADMIN_PASSWORD`.

## 2. Fichiers (`apps-script/`)
- `Code.gs` serveur (→ `Code.js` pour clasp) ; `Contenu.gs` quiz intégrés (`BUILTIN_QUIZZES` : byzance, byzance-30, zootopia, musique-carnaval) ; `Index.html` page élève ; `admin.html` administration ; `appsscript.json` manifeste (`executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`).
- `cartes/` : anciennes pages statiques, ne pas toucher.
- `tests/` : suites de tests (voir §5).

## 3. Architecture
**Données** (`PropertiesService`) : `student_<id>` (classe, pseudo, sel + SHA-256 du PIN) ; `quiz_<id>`, `deck_<id>` (découpés en morceaux `<clé>~0, ~1…` si trop gros) ; `override_<id>` (quiz intégré modifié) ; `builtin_assign` ; `prog_<élève>__<quiz>` `{q:{idQuestion:[réussitesDAffilée,erreurs]},maj}` ; `done_<élève>__<quiz>` `{n,last}` (conservé aux remises à zéro) ; `parcours_<élève>__<quiz>` `{etape,passages,cycle,maj,fini,valide}`. Anti-force-brute du PIN (5 erreurs → 5 min) via `CacheService`.

**Séparation** : un élève ne reçoit que les quiz/paquets dont il est destinataire (`pour`, retiré avant envoi). Pas de lecture publique de listes. Toute l'admin passe par `adminData(motDePasse)`. Les fonctions finissant par `_` sont internes.

**Fonctions publiques** – élève : `getStudentData`, `saveResult`, `finishQuiz`, `cardsDone`, `requestValidation`. Admin : `adminData`, `saveStudent`, `deleteStudent`, `saveQuiz`, `saveDeck`, `deleteQuiz`, `deleteDeck`, `setBuiltinAssign`, `getBuiltinForEdit`, `saveBuiltin`, `restoreBuiltin`, `resetProgress`, `validateParcours`.

**Questions** : id stable `q.id` (8 hex) ; à défaut empreinte FNV-1a de l'énoncé (`qhash_` serveur = `qhash` page, doivent rester identiques). Types : QCM, réponse écrite (comparaison insensible casse/accents/ponctuation), plusieurs champs, option `explication`, option quiz `lien:{texte,url,icone?}`. Question sue = 3 réussites d'affilée (`MASTERY = 3`), une erreur remet à 0 ; en réponse écrite seul le premier coup compte.

**Parcours par leçon (v2, voir `docs/PARCOURS-V2.md`)** — serveur = référence : `quiz_initial` (UN passage complet) → `cartes_ciblees` (questions ratées ou « Je ne sais pas ») → `verification` (questions dont la série est < 2) → `cartes_finales` (paquet complet) → `attente_validation` → `valide`. Question vérifiée = 2 réussites consécutives (`MASTERY = 2`). Flashcards actives : Oublié / Hésité / Trouvé, fin seulement quand chaque carte est retournée, évaluée et Trouvé (contrôlé par le serveur : `rateCard`, `cardsDone`, `requestValidation`). Aucun passage « complet » n'est refait après le quiz initial.

**Page élève** : connexion Classe/Pseudo/PIN, « Mes leçons » (statut + action unique par leçon, « Fait N fois »), « Flashcards » (séances libres, mêmes interactions, sans effet sur le parcours), « Mes progrès » (ex-Programme). Passage automatique après une bonne réponse du premier coup (1 s, 1,8 s avec explication ou question devenue vérifiée ; jamais après une erreur ; `window.revisionAutoNext = false` le désactive). Envois via `enqueue()` / `enqueueOp()` : file ordonnée, 3 essais, identifiant d'opération rejoué sans double effet ; `window.revisionFlush()` attend la fin des envois (tests) ; états « Sauvegarde en attente » / « Progression enregistrée ».

**Admin** : 6 onglets (Ajouter un élève, Liste des élèves, Ajouter un quiz, Liste des quiz, Flashcards, Programmes de révision avec Détails, validation, remises à zéro).

**Style** : bannière fournie par l'utilisateur dans `Index.html` et `admin.html` ; palette bleu #3b6fe0, or #ffd166, rose #ff8fb8, violet #785aff, menthe #5dffb0.

## 4. Publication (à chaque évolution)
1. `git fetch origin main && git checkout -B <branche> origin/main`, modifier, lancer les tests (§5).
2. Commit, `git push -u origin <branche>`.
3. Dossier clasp temporaire : `clasp clone <scriptId>` dans un dossier neuf ; vérifier que le distant est identique à `origin/main` (`cmp`), sinon alerter ; copier `Index.html`, `admin.html`, `Code.gs`→`Code.js`, `Contenu.gs`→`Contenu.js` ; `clasp push -f` ; `clasp deploy -i <deploymentId> -d "<description>"`. Attendre ~20 s (« Script function not found » juste après est transitoire).
4. Vérifier en ligne avec Playwright (l'app est dans un iframe `*.googleusercontent.com` ; clavier via `page.keyboard`).
5. PR (head = branche, base = main) puis fusion en squash.

**Connexion clasp** (si `~/.clasprc.json` absent) : le script de connexion n'est volontairement pas dans le dépôt. Utiliser `clasp login --no-localhost` : afficher le lien Google, demander à l'utilisateur par AskUserQuestion (choix « Other ») de coller l'adresse `http://localhost…?code=…` obtenue, puis la fournir à clasp. Ne jamais demander de jeton ni de mot de passe. Accès révocable sur myaccount.google.com/permissions (ligne « clasp »).

## 5. Tests
`node tests/NN-nom.js` (un fichier par suite, ~550 contrôles, tous verts). `tests/harness.js` fait tourner le vrai `Code.gs` + `Contenu.gs` dans `vm` avec de faux `PropertiesService`, `CacheService`, `LockService`, `Utilities`, et fournit un faux `google.script.run` pour les pages. Les suites 14 et 15 utilisent Playwright (préinstallé). `digipad.app` et `cdn.tailwindcss.com` sont bloqués depuis le conteneur. Playwright : `fill` sur un champ désactivé expire ; un élément de largeur 0 est « invisible ». Suites 18 à 21 : parcours v2 côté serveur (états, migration, retour arrière), flashcards actives, réseau (opérations rejouées), responsive 320/375/390/768 + administration. Aides de `harness.js` : `sr` (nouvelle présentation d'une question), `party` (joue un passage ou des cartes jusqu'à la fin).

## 6. Données réelles (ne pas toucher sans accord)
Classe « Gaby » : « Jul » (id `mael`, rien d'attribué) et « Mael » (id `mael-2`, 4 quiz intégrés, vraie progression). Ids internes ≠ noms affichés. Aucun quiz ni paquet créé en réel.

## 7. Idées non demandées
Transfert de l'ancienne progression locale ; attribution par classe ; test en ligne complet d'un parcours (demande le mot de passe admin) ; passage automatique aussi après une erreur ; déploiement automatique via GitHub Actions (secret `CLASPRC_JSON`) ; nettoyage des branches fusionnées et de `test-workflow-perm`.
