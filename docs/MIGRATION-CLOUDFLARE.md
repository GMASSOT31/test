# Migrer QUIZy de Google Apps Script vers Cloudflare

**Nom de l'application : QUIZy** (décision de l'utilisateur, 16/11/2026). Partout : titre des pages et des onglets, nom de
l'appli installée sur l'écran d'accueil (manifest : `name` et `short_name` « QUIZy »), Worker `quizy`, adresse
`https://quizy.<compte>.workers.dev` (ou un nom de domaine plus tard).

But : la même application, **qui marche exactement pareil** (toute la logique de `docs/LOGIQUE-APP.md`), mais hébergée sur
Cloudflare : plus rapide, sans cadre Google, sans limite de 500 Ko, installable sur l'écran d'accueil du téléphone, gratuite.
Tout se pilote depuis un téléphone. **Règle de l'utilisateur (16/11/2026) : le site actuel (Apps Script) n'est jamais désactivé** :
il reste en ligne et utilisable pendant et après la migration ; rien ne le bloque, ne le redirige ni ne le met en lecture seule
sans son accord explicite.

## État (16/11/2026)
- ✅ Version Cloudflare construite et testée en local (branche `cloudflare-migration`) : les 24 suites passent sur les deux versions,
  + export (28), import (29), fuseau (30), bout en bout sur `wrangler dev` (31). Détails techniques : `docs/REPRISE.md` §5 bis.
- ✅ Bouton « 💾 Exporter toutes les données » (menu 👤, administrateur principal) ajouté à l'espace parents.
- ✅ En ligne : **https://quizy.gabriel-massot31.workers.dev** (compte `f4ec7fb04d7a99f9e990a5396cf4319d`, Durable Object créé en
  Europe de l'Ouest). Base vide : toutes les pages mènent à `/installer`. Code d'installation = secret `INSTALL_CODE` du Worker.
- Pages et icônes sont **intégrées au Worker** (`src/files.gen.js`, servies par `src/assets.js`) au lieu des « Workers Assets » :
  l'envoi des assets utilise un jeton temporaire que le proxy de la session remplacerait par le jeton d'API.
- ⏳ Publication du bouton d'export sur l'appli Apps Script, puis transfert des données (export → installer).

---

## 1. Architecture cible (offre gratuite Cloudflare)

```
Téléphone / ordinateur
   │  https://quizy.<compte>.workers.dev   (ou un nom de domaine plus tard)
   ▼
Worker « quizy »
   ├─ fichiers statiques : /            → page élève (Index.html)
   │                       /parents     → espace parents (admin.html)
   │                       manifest + icône (appli « QUIZy » installable)
   └─ API : POST /api/<fonction>  corps = [arguments]  → { ok, value } | { error }
          │
          ▼
   Durable Object « Store » (stockage SQLite, une seule instance « quizy-eu »)
      - exécute la logique de Code.gs, UNE requête à la fois (= LockService)
      - table props(key, value)      = PropertiesService (mêmes clés, mêmes valeurs)
      - table cache(key, value, exp) = CacheService (compteurs anti-essais)
```

### Correspondance des services Google → Cloudflare
| Apps Script | Cloudflare | Remarque |
|---|---|---|
| `PropertiesService` | API SQL **synchrone** du Durable Object (`ctx.storage.sql`) | mêmes clés ; plus besoin de découper en morceaux, mais lire les anciens morceaux `~0, ~1` à l'import |
| `LockService` | le Durable Object traite une requête à la fois | sérialisation garantie |
| `CacheService` | table `cache` avec expiration | anti-force-brute (PIN, mots de passe, code d'invitation) |
| `Utilities.computeDigest` (SHA-256) | `createHash('sha256')` de `node:crypto` (option `nodejs_compat`, synchrone) | **même résultat** : les PIN et mots de passe existants restent valables |
| `Utilities.getUuid` | `crypto.randomUUID()` | |
| `Utilities.formatDate(…, 'Europe/Paris', 'Z')` | `Intl.DateTimeFormat` avec `timeZone: 'Europe/Paris'` | test dédié (heure d'été / d'hiver) |
| `Utilities.sleep` | rien (les compteurs suffisent) | |
| `HtmlService` + cadre Google | fichiers statiques servis directement | liens `target="_top"` et adresses `/exec` à remplacer |
| `google.script.run` (pages) | petit fichier `run.js` qui offre **la même interface** et appelle `fetch('/api/…')` | les pages ne changent presque pas |
| `clasp push / deploy` | `wrangler deploy` (ou déploiement automatique depuis GitHub) | |

La logique (`Code.gs`, `Contenu.gs`) est reprise **telle quelle**, seuls les services ci-dessus sont fournis par un adaptateur.
Le harnais de tests (`tests/harness.js`) fournit déjà de faux services : les **24 suites existantes** serviront de juge de paix.

---

## 2. Transfert des données (sans rien perdre)
1. Dans l'appli **actuelle**, ajouter pour l'administrateur un bouton **« 💾 Exporter toutes les données »** (menu 👤) : télécharge un
   fichier JSON (= `backupData` + `ADMIN_PSEUDO`), sans les mots de passe administrateur.
2. Dans la **nouvelle** appli, base vide → écran **« Installer »** : choisir ce fichier + choisir le mot de passe administrateur →
   import des clés telles quelles (les morceaux `~0, ~1…` sont recollés).
3. Vérification côte à côte : mêmes enfants, leçons, attributions, progressions, familles. Les **PIN des enfants et les mots de passe
   des familles marchent tels quels** (même hachage).
4. **Passage à QUIZy sur Cloudflare** : à un moment calme (le soir), exporter puis installer, et les enfants ajoutent la nouvelle
   adresse sur l'écran d'accueil. **L'ancien site reste actif** : pas de blocage, pas de redirection, pas de lecture seule. Comme
   les deux sites ne partagent pas leurs données, refaire un export / import si les enfants ont révisé sur l'ancien entre-temps
   (l'import remplace les données de la nouvelle version).

---

## 3. Ce que fait l'utilisateur, depuis son téléphone (≈ 10 minutes en tout)
1. Créer un **compte Cloudflare gratuit** (dash.cloudflare.com).
2. Créer un **jeton d'API** : Mon profil → API Tokens → Create Token → modèle **« Edit Cloudflare Workers »**, puis le coller dans
   le **formulaire sécurisé** que la session affichera (jamais dans le chat).
3. Approuver la fenêtre qui autorise la session à joindre `api.cloudflare.com`.
4. Le jour de la bascule : « Exporter » dans l'ancienne appli, « Installer » dans la nouvelle (choisir le fichier, choisir le mot de passe).
5. Tester sur le téléphone, puis dire « on bascule ».

## 4. Ce que fait la session (tout le reste)
Branche, code (`cloudflare/` : `wrangler.toml`, `src/worker.js`, `src/store.js`, adaptateur, `public/`), tests, déploiement
(`wrangler deploy`), vérification en ligne avec Playwright, documentation (`docs/REPRISE.md` à jour), PR et fusion.

## 5. Critères de réussite (parité)
- Les 24 suites existantes passent contre la nouvelle version, plus des tests nouveaux :
  - l'API HTTP de bout en bout (`wrangler dev`) ;
  - l'import/export ;
  - le fuseau horaire (changement d'heure) ;
  - un PIN existant qui marche après import.
- En ligne : connexion élève, séance complète (découvrir → tester → corriger), révision du jour, suivi parent, date du contrôle,
  création d'une leçon avec une IA, familles.
- Réponses en moins de 300 ms (contre 1 à 3 s aujourd'hui).

## 6. Risques et parades
| Risque | Parade |
|---|---|
| Progression faite sur l'ancien site après l'export | nouvel export / import ; l'ancien site n'est jamais bloqué |
| Décalage d'un jour (fuseau) | test dédié Europe/Paris, été / hiver |
| Mot de passe administrateur | choisi à l'installation (non exporté) |
| Quotas | offre gratuite : 100 000 requêtes/jour, bien au-delà du besoin ; sinon 5 $/mois |
| Retour en arrière | l'ancien site reste intact et en ligne : il suffit de continuer à l'utiliser |

---

## 7. Message à donner à la nouvelle session

```
Je veux migrer mon application de révision QUIZy (dépôt GMASSOT31/test, dossier apps-script/) de Google Apps Script vers
Cloudflare Workers, sans rien changer à son fonctionnement. L'appli s'appelle QUIZy (titres, appli installable, Worker « quizy »). Lis d'abord, en entier : docs/LOGIQUE-APP.md (toute la logique,
à respecter à la lettre), docs/MIGRATION-CLOUDFLARE.md (le plan à suivre) et docs/REPRISE.md (règles et procédures).

Règles : réponds en français ; sois autonome (branche, code, tests, commit, push, déploiement, vérification en ligne, PR et
fusion) ; quand tu dois me demander quelque chose, utilise AskUserQuestion avec au moins 2 choix ; je travaille depuis mon
téléphone ; ne me demande jamais de jeton ni de mot de passe dans le chat (utilise le formulaire sécurisé request_credential
pour le jeton Cloudflare) ; ne supprime ni ne modifie aucune donnée réelle sans mon accord explicite ; l'application Apps Script
actuelle (Apps Script) ne doit JAMAIS être désactivée, bloquée ni redirigée : elle reste en ligne et utilisable.

Commence par construire et tester la version Cloudflare en local (les 24 suites de tests doivent passer), puis demande-moi
le jeton Cloudflare pour la mettre en ligne.
```
