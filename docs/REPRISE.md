# Reprise du développement – portail de révision (Google Apps Script)

## Prompt à copier dans une nouvelle session Claude Code

```
Je continue le développement d'un portail de révision scolaire pour mes enfants, en application web Google Apps Script. Le dépôt est GMASSOT31/test (dossier apps-script/). Lis d'abord docs/REPRISE.md : il contient l'architecture, les règles, la procédure de publication et les tests.

Règles : réponds en français ; sois autonome (branche, code, tests, commit, push, publication clasp, vérification en ligne, PR et fusion) sans me demander d'autorisation à chaque étape ; quand tu dois me demander quelque chose, utilise l'outil AskUserQuestion avec au moins 2 choix ; ne supprime jamais de données réelles sans mon accord explicite ; ne réutilise pas le mot de passe admin temporaire sans me redemander par dialogue ; ne me demande jamais de jeton ni de mot de passe dans le chat.

Attends ma prochaine consigne.
```

## 1. État
- `main` est déployé : parcours v3 (révision espacée, voir `docs/PARCOURS-V3.md`). Les anciennes progressions ont été effacées une fois (décision de l'utilisateur, 8/11/2026).
- URL publique (à ne jamais changer) : `https://script.google.com/macros/s/AKfycbzzqlCAUDZAoHOmhxufvj4CAAHWX8JtU8vBsTB0ZsoEK_mLu2tW4BoESRUdrg4b7bkF/exec` ; admin : `?p=admin`.
- Déploiement à mettre à jour : `AKfycbzzqlCAUDZAoHOmhxufvj4CAAHWX8JtU8vBsTB0ZsoEK_mLu2tW4BoESRUdrg4b7bkF` (ne jamais en créer un autre).
- Script ID clasp : `1AuUOChTuh7QZBnUHmUnCCf9Y0U4Apr08pQvaLuxp862V7d_2CC2FsbLA`.
- Un mot de passe admin temporaire (communiqué par l'utilisateur pendant une session) est peut-être encore en place : demander de le remplacer dans la propriété de script `ADMIN_PASSWORD`.
- Connexion admin (« Espace parents ») = **pseudo + mot de passe**. Administrateur principal (l'utilisateur) : le premier pseudo saisi avec le bon mot de passe est enregistré dans `ADMIN_PSEUDO` (insensible à la casse et aux accents). Son mot de passe : `ADMIN_PASSWORD` (en clair) ou, une fois changé depuis l'appli (menu 👤 → « Changer le mot de passe »), `ADMIN_PASS_HASH` (sel:SHA-256) et `ADMIN_PASSWORD` est retiré. **Oubli** : remettre `ADMIN_PASSWORD` dans les propriétés du script, il reprend le dessus.
- **Familles** (décision utilisateur 13/11/2026) : d'autres parents s'inscrivent avec un code d'invitation (« 👪 Créer ma famille » sur la page de connexion) ; un compte par famille ; chaque parent ne voit que sa famille ; l'administrateur principal seul voit l'onglet 👪 Parents, modifie les leçons fournies et gère le code. Limite ~10-15 familles (stockage des propriétés ≈ 500 Ko, jauge dans l'onglet Parents ; inscriptions bloquées à 85 %).

## 2. Fichiers (`apps-script/`)
- `Code.gs` serveur (→ `Code.js` pour clasp) ; `Contenu.gs` quiz intégrés (`BUILTIN_QUIZZES` : byzance, byzance-30, zootopia, musique-carnaval, anglais-animaux, histoire-revolution, techno-5e-numerique, pc5-melanges, pc5-conversions, pc5-solubilite, pc5-graphiques) ; `Index.html` page élève ; `admin.html` administration ; `appsscript.json` manifeste (`executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`).
- `cartes/` : anciennes pages statiques, ne pas toucher.
- `tests/` : suites de tests (voir §5).

## 3. Architecture
**Données** (`PropertiesService`) : `student_<id>` (classe, pseudo, sel + SHA-256 du PIN, `fam` si famille invitée) ; `parent_<id>` (compte d'une famille invitée : pseudo, famille, sel + hash du mot de passe, `ajoute`, `vu`) ; `INVITE_CODE` (absent = inscriptions fermées) ; `ADMIN_PSEUDO`, `ADMIN_PASSWORD` / `ADMIN_PASS_HASH` ; `quiz_<id>`, `deck_<id>` (découpés en morceaux `<clé>~0, ~1…` si trop gros) ; `override_<id>` (quiz intégré modifié) ; `builtin_assign` ; `srs_<élève>__<quiz>` (révision espacée : `it:{idQuestion:[niveau, échéance ms, erreurs, réussites, erreursSûres]}`, `exam`, `plan`, `tf`, `cfg`, `mode`, `ses`) ; `schema_version` = '3'. Anti-force-brute du PIN (5 erreurs → 5 min) via `CacheService`.

**Séparation** : un élève ne reçoit que les quiz/paquets dont il est destinataire (`pour`, retiré avant envoi avec `fam`). Pas de lecture publique de listes. Toute l'admin passe par `checkAdmin_(identifiants)` qui renvoie `{owner, fam, pseudo, famille}` (`fam` = '' pour l'administrateur principal, sinon id du parent) ; il accepte `{pseudo, password}` ou, pour compatibilité, la chaîne du mot de passe tant qu'aucun `ADMIN_PSEUDO` n'est enregistré ; 8 erreurs sur un pseudo → blocage 5 min. **Familles** : élèves, quiz et paquets portent `fam` ; tout est filtré par famille (`familyStudents_`, `ownedBy_`) ; `builtin_assign` est global mais chaque famille ne modifie que ses élèves (`mergePour_`) ; le couple classe + pseudo d'un élève reste unique entre toutes les familles (connexion élève). Les fonctions finissant par `_` sont internes.

**Fonctions publiques** – élève : `getStudentData`, `answer`, `endSession`, `setLessonPlan`, `setLessonMode`. Admin : `adminData`, `saveStudent`, `deleteStudent`, `saveQuiz`, `saveDeck`, `deleteQuiz`, `deleteDeck`, `setBuiltinAssign`, `setAccess` (kind 'builtin' | 'quiz' | 'deck', liste des enfants), `resetProgress`, `setLessonPlanAdmin`, `setLessonModeAdmin`, `changePassword` ; administrateur principal seulement (`ownerOnly_`) : `getBuiltinForEdit`, `saveBuiltin`, `restoreBuiltin`, `setInviteCode`, `resetParentPassword`, `deleteFamily`, `backupData`. Public (avec code) : `createFamily`.

**Questions** : id stable `q.id` (8 hex) ; à défaut empreinte FNV-1a de l'énoncé (`qhash_` serveur = `qhash` page, doivent rester identiques). Types : QCM, réponse écrite (comparaison insensible casse/accents/ponctuation), plusieurs champs, option `explication`, option quiz `lien:{texte,url,icone?}`. Question sue = 3 réussites d'affilée (`MASTERY = 3`), une erreur remet à 0 ; en réponse écrite seul le premier coup compte.

**Parcours v3 (voir `docs/PARCOURS-V3.md`)** — niveaux 0 Nouvelle → 1 Découverte (QCM réussi) → 2 Rappelée (sans choix) → 3 Ancrée → 4 Maîtrisée ; révisions à 1, 3, 7, 14 jours ; avec une date de contrôle, plan de séances jusqu'à la veille (contrôle demain = express : maintenant, +1 h, le matin). Séance : découvrir (cartes) → tester (QCM) → corriger (la question ratée revient). Révision du jour = questions dues de toutes les leçons, mélangées. Séance bonus possible (n'avance pas le plan). Après le contrôle : l'élève garde la leçon en mémoire (entretien) ou l'archive.

**Page élève** : connexion Classe/Pseudo/PIN ; « Mes leçons » (révision du jour + leçons avec statut, badge du contrôle, barre des niveaux) ; écran de leçon (plan, niveaux, bouton principal, « Voir les cartes ») ; première ouverture : « Quand est ton contrôle ? » + « déjà travaillée en classe ? » ; « Flashcards » libres ; « Mes progrès ». Passage automatique après une bonne réponse du premier coup (1 s / 1,8 s ; `window.revisionAutoNext = false` le désactive). Envois : `enqueue()`/`enqueueOp()` (ordre, 3 essais, identifiant d'opération), `window.revisionFlush()` ; `window.revisionPreview(quizId, index, 'qcm'|'rappel')` affiche une question seule (tests).

**Admin (« Espace parents », jamais « enseignant », vocabulaire « enfants »)** — épurée le 14/11/2026 pour le téléphone : connexion pseudo + mot de passe (lien « 👪 Créer ma famille ») ; barre du haut = **2 onglets** (👨‍👧 Enfants, 📚 Leçons) + ↻ Actualiser + menu « 👤 pseudo ▾ » (👪 Familles invitées pour l'administrateur principal, 🔑 Changer le mot de passe, 🔒 Se déconnecter). **Enfants** (accueil, fusion de Suivi + Élèves) : « ➕ Ajouter un enfant », guide « Pour commencer », une fiche par enfant (tri alphabétique, sans classe ni filtre) = nom + avancement global + une ligne par leçon (nom, badge du contrôle, barre, %) ; « + » d'une leçon = date du contrôle d'abord, puis état, niveaux, questions difficiles, historique, archiver, remise à zéro ; « + » de l'enfant = activité, rappel de connexion, ✏️ Modifier (classe/pseudo/PIN), tout remettre à zéro, 🗑️ Supprimer ; pied de fiche = « 📚 Choisir ses leçons » (cases, enregistrement immédiat via `setAccess`) et « 📦 N leçons archivées » (repliées, hors avancement). Après l'ajout d'un enfant, son choix de leçons s'ouvre. **Leçons** (fusion de Leçons + Flashcards) : « ➕ Créer une leçon », ✏️ Mes leçons, 🏛️ Leçons fournies, 🃏 Cartes en plus (« ➕ Créer un paquet ») ; chaque ligne « ⚙️ Gérer » = cases des enfants (enregistrées tout de suite), Modifier / Supprimer (ou Rétablir pour l'administrateur). Plus de remise à zéro générale. Les données se rechargent toutes seules quand on revient sur l'appli (> 1 min). À la déconnexion, messages et données de la session sont effacés de la page.

**Style** : bannière fournie par l'utilisateur dans `Index.html` et `admin.html` ; palette bleu #3b6fe0, or #ffd166, rose #ff8fb8, violet #785aff, menthe #5dffb0.

## 4. Publication (à chaque évolution)
1. `git fetch origin main && git checkout -B <branche> origin/main`, modifier, lancer les tests (§5).
2. Commit, `git push -u origin <branche>`.
3. Dossier clasp temporaire : `clasp clone <scriptId>` dans un dossier neuf ; vérifier que le distant est identique à `origin/main` (`cmp`), sinon alerter ; copier `Index.html`, `admin.html`, `Code.gs`→`Code.js`, `Contenu.gs`→`Contenu.js` ; `clasp push -f` ; `clasp deploy -i <deploymentId> -d "<description>"`. Attendre ~20 s (« Script function not found » juste après est transitoire).
4. Vérifier en ligne avec Playwright (l'app est dans un iframe `*.googleusercontent.com` ; clavier via `page.keyboard`).
5. PR (head = branche, base = main) puis fusion en squash.

**Connexion clasp** (si `~/.clasprc.json` absent) : le script de connexion n'est volontairement pas dans le dépôt. Utiliser `clasp login --no-localhost` : afficher le lien Google, demander à l'utilisateur par AskUserQuestion (choix « Other ») de coller l'adresse `http://localhost…?code=…` obtenue, puis la fournir à clasp. Ne jamais demander de jeton ni de mot de passe. Accès révocable sur myaccount.google.com/permissions (ligne « clasp »).

## 5. Tests
`node tests/NN-nom.js` (un fichier par suite, ~630 contrôles, tous verts). `tests/harness.js` fait tourner le vrai `Code.gs` + `Contenu.gs` dans `vm` (faux `PropertiesService`, `CacheService`, `LockService`, `Utilities` ; `world.advance(ms)` fait avancer l'horloge du serveur) et fournit un faux `google.script.run` pour les pages. Aides : `startLesson`, `answerCurrent`, `finishSession`. Suites clés : 02 (moteur), 12 (séances), 08 (suivi parent), 21 (téléphone), 25 (familles, serveur), 26 (familles, page admin).

## 6. Données réelles (ne pas toucher sans accord)
Classe « Gaby » : « Jul » (id `mael`), « Mael » (id `mael-2`, quiz intégrés attribués dont Technologie 5ᵉ) et « test » (créé par l'utilisateur). Ids internes ≠ noms affichés. Progressions remises à zéro au passage au parcours v3.

## 7. Idées non demandées
Transfert de l'ancienne progression locale ; attribution par classe ; test en ligne complet d'un parcours (demande le mot de passe admin) ; passage automatique aussi après une erreur ; déploiement automatique via GitHub Actions (secret `CLASPRC_JSON`) ; nettoyage des branches fusionnées et de `test-workflow-perm`.
