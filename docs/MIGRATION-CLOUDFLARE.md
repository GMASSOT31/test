# Migrer l'application de Google Apps Script vers Cloudflare

But : la même application, **qui marche exactement pareil** (toute la logique de `docs/LOGIQUE-APP.md`), mais hébergée sur
Cloudflare : plus rapide, sans cadre Google, sans limite de 500 Ko, installable sur l'écran d'accueil du téléphone, gratuite.
Tout se pilote depuis un téléphone. L'application actuelle continue de tourner tant que la nouvelle n'est pas validée.

---

## 1. Architecture cible (offre gratuite Cloudflare)

```
Téléphone / ordinateur
   │  https://revision.<compte>.workers.dev   (ou un nom de domaine plus tard)
   ▼
Worker « revision »
   ├─ fichiers statiques : /            → page élève (Index.html)
   │                       /parents     → espace parents (admin.html)
   │                       manifest + icône (appli installable)
   └─ API : POST /api/<fonction>  corps = [arguments]  → { ok, value } | { error }
          │
          ▼
   Durable Object « Store » (stockage SQLite, une seule instance « main »)
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
4. **Bascule** : à un moment calme (le soir), exporter, importer, puis l'ancienne adresse affiche « L'appli a déménagé ➔ » avec le
   lien (et refuse les nouvelles réponses pour qu'aucune progression ne se perde). Les enfants ajoutent la nouvelle adresse sur
   l'écran d'accueil.

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
| Progression faite pendant la bascule | export juste avant ; l'ancienne appli refuse ensuite les écritures avec un message clair |
| Décalage d'un jour (fuseau) | test dédié Europe/Paris, été / hiver |
| Mot de passe administrateur | choisi à l'installation (non exporté) |
| Quotas | offre gratuite : 100 000 requêtes/jour, bien au-delà du besoin ; sinon 5 $/mois |
| Retour en arrière | l'ancienne appli reste intacte et peut être réouverte tant que tout n'est pas validé |

---

## 7. Message à donner à la nouvelle session

```
Je veux migrer mon application de révision (dépôt GMASSOT31/test, dossier apps-script/) de Google Apps Script vers
Cloudflare Workers, sans rien changer à son fonctionnement. Lis d'abord, en entier : docs/LOGIQUE-APP.md (toute la logique,
à respecter à la lettre), docs/MIGRATION-CLOUDFLARE.md (le plan à suivre) et docs/REPRISE.md (règles et procédures).

Règles : réponds en français ; sois autonome (branche, code, tests, commit, push, déploiement, vérification en ligne, PR et
fusion) ; quand tu dois me demander quelque chose, utilise AskUserQuestion avec au moins 2 choix ; je travaille depuis mon
téléphone ; ne me demande jamais de jeton ni de mot de passe dans le chat (utilise le formulaire sécurisé request_credential
pour le jeton Cloudflare) ; ne supprime ni ne modifie aucune donnée réelle sans mon accord explicite ; l'application Apps Script
actuelle doit continuer de marcher jusqu'à ce que je valide la bascule.

Commence par construire et tester la version Cloudflare en local (les 24 suites de tests doivent passer), puis demande-moi
le jeton Cloudflare pour la mettre en ligne.
```
