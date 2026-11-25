# Reprise du développement de QUIZy

Passation entre Claude Code et Codex. [CLAUDE.md](../CLAUDE.md) décrit le dépôt, les accès et les commandes. [LOGIQUE-APP.md](LOGIQUE-APP.md) décrit les règles métier. [PARCOURS-V3.md](PARCOURS-V3.md) résume la révision espacée. [MIGRATION-CLOUDFLARE.md](MIGRATION-CLOUDFLARE.md) conserve l’historique du transfert.

## État vérifié le 25 novembre 2026

| Élément | État |
|---|---|
| Dépôt et application | GMASSOT31/test, sources sous cloudflare/ |
| Dernier main applicatif | ed2e7ce, fusion de la PR nº 67 |
| Production | Worker quizy, version a2776710-0196-45ba-89e4-cac0c1a85296, publiée le 22 novembre à 22 h 49, heure de Paris |
| Vérification | Les pages publiques élève et parents correspondent octet par octet à leur compilation depuis ed2e7ce. Aucun compte réel utilisé |
| Dernière suite complète | 41 suites Cloudflare, 1 109 contrôles réussis sur le même contenu que ed2e7ce |

[Quizy](https://quizy.gabriel-massot31.workers.dev/) · [Espace parents](https://quizy.gabriel-massot31.workers.dev/parents)

La dernière tâche applicative documentée est terminée et déployée. La documentation de passation est disponible sur `docs/passation-claude-code` et attend sa fusion dans `main`. Claude Code peut déjà la lire sur cette branche, puis partir de `origin/main` pour la prochaine demande.

## Changements récents

| PR | Comportement publié |
|---|---|
| [56](https://github.com/GMASSOT31/test/pull/56) | Accueil invité simplifié avec action immédiate et progression sur téléphone |
| [57](https://github.com/GMASSOT31/test/pull/57) | « Poker à tapis · Compte tes outs », 15 duels illustrés, en plus de « Poker ALL IN » |
| [58](https://github.com/GMASSOT31/test/pull/58), [60](https://github.com/GMASSOT31/test/pull/60) | Disciplines dans les quatre rubriques de Leçons. Renommage avec conservation du classement |
| [62](https://github.com/GMASSOT31/test/pull/62) | Vignettes du site et des invitations, lecture à voix haute, quiz visible et dernière réponse dans Enfants |
| [63](https://github.com/GMASSOT31/test/pull/63), [67](https://github.com/GMASSOT31/test/pull/67) | Rappels entre 7 h et 22 h, heure de Paris. Séances volontaires à toute heure. Contrôle demain : rappel à +1 h seulement avant 22 h, rappel facultatif dès 7 h |
| [65](https://github.com/GMASSOT31/test/pull/65), [67](https://github.com/GMASSOT31/test/pull/67) | Immersion dès l’ouverture de la leçon. Après deux erreurs sur une question, l’enfant décrit une scène personnelle et peut la relire ou l’écouter au rappel |
| [66](https://github.com/GMASSOT31/test/pull/66) | Jusqu’à deux relances pour une panne transitoire de connexion. Un refus du PIN efface la saisie et conserve le blocage normal |

**Décision à conserver.** La branche fix/reponses-espagnol à 2e2992a contient une proposition rejetée par l’utilisateur. Elle acceptait automatiquement la réponse complète du QCM en rappel écrit, ce qui facilitait le copier-coller. Elle reste hors de main. Ne pas la fusionner ni réintroduire ce comportement.

**Publication.** Merge met à jour GitHub. Le Worker est publié manuellement avec Wrangler depuis main après fusion. Dans la session Codex, le proxy Git permettait de pousser les branches et l’API de création de PR renvoyait 403. Vérifier les capacités de la session avant de solliciter un clic. [Procédure et accès](../CLAUDE.md#8-commandes)

## Passation à la prochaine session

Avant de quitter une tâche en cours, noter les faits vérifiés dans ce document, ou dans la PR si elle est encore ouverte.

| À transmettre | Information attendue |
|---|---|
| Tâche | Objectif demandé et décisions de l’utilisateur |
| Git | Branche, dernier commit, lien et état de la PR, SHA de main |
| Validation | Commandes exécutées, résultats et tests restants |
| Production | Version du Worker et vérifications réalisées, ou déploiement en attente |
| Suite | Prochaine action et éventuel clic utilisateur nécessaire |

Commencer par git status -sb et git fetch origin main. Pour une tâche en cours, reprendre sa branche après vérification. Pour une nouvelle demande, créer une branche depuis origin/main. Préserver le travail de l’autre agent et les données réelles. Les dossiers apps-script/ et cartes/ restent figés.

## Prompt à copier dans Claude Code ou Codex

> Je reprends QUIZy, dépôt GMASSOT31/test. Lis AGENTS.md, CLAUDE.md et docs/REPRISE.md sur main, ou sur docs/passation-claude-code si la documentation attend sa fusion. Consulte les sections pertinentes de docs/LOGIQUE-APP.md. Vérifie l’état Git et le dernier main. Travaille sur cloudflare/, réponds en français et reprends la tâche documentée si elle est encore ouverte. Sinon, attends ma prochaine demande. Préserve les données réelles et les décisions déjà prises. Gère la branche, les tests, la PR, le déploiement autorisé et la vérification en ligne. Demande mon intervention uniquement si un accès ou une validation indispensable la requiert. Avant de passer le relais, consigne la branche, la PR, les tests, l’état en production et la prochaine action dans docs/REPRISE.md ou la PR ouverte.
