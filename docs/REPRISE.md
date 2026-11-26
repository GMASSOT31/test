# Reprise du développement de QUIZy

Passation entre Claude Code et Codex. [CLAUDE.md](../CLAUDE.md) décrit le dépôt, les accès et les commandes. [LOGIQUE-APP.md](LOGIQUE-APP.md) décrit les règles métier. [PARCOURS-V3.md](PARCOURS-V3.md) résume la révision espacée. [MIGRATION-CLOUDFLARE.md](MIGRATION-CLOUDFLARE.md) conserve l’historique du transfert.

## État vérifié le 26 novembre 2026

| Élément | État |
|---|---|
| Dépôt et application | GMASSOT31/test, sources sous cloudflare/ |
| Dernier main applicatif | 00e051e, fusion de la PR nº 70 (code identique à la production) |
| Dernier main | d0cb05e, fusion de la PR nº 71 (documentation seulement) |
| Production | Worker quizy, version 38a3b32f-2d90-4a67-9072-416a86d6d71b, publiée le 25 novembre depuis 00e051e |
| Vérification | Le 26 novembre : la version 38a3b32f est toujours la seule à 100 %. Les pages publiques élève et parents correspondent octet par octet à leur compilation depuis d0cb05e (même code que 00e051e). Aucun compte réel utilisé |
| Dernière suite complète | 43 suites Cloudflare, 1 163 contrôles, 0 échec sur 00e051e |

[Quizy](https://quizy.gabriel-massot31.workers.dev/) · [Espace parents](https://quizy.gabriel-massot31.workers.dev/parents)

**Aucune tâche ouverte, aucune PR ouverte, aucun test rouge connu, aucun déploiement en attente.** Prochaine action : attendre la prochaine demande de l’utilisateur et partir de `origin/main` (`d0cb05e`). La branche `docs/passation-claude-code` est entièrement fusionnée (PR nº 71) et peut être ignorée.

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
| [68](https://github.com/GMASSOT31/test/pull/68) | Images dans les questions : avec l’énoncé et avec la correction, ajoutées dans l’éditeur ou dessinées par l’IA (figure SVG), sinon suggérées. Stockées dans la table `media`, incluses dans l’export |
| [69](https://github.com/GMASSOT31/test/pull/69) | Nettoyage automatique des images dès 90 % des 400 Mo : inutilisées les plus anciennes, puis utilisées les plus anciennes, jusqu’à 80 % |
| [70](https://github.com/GMASSOT31/test/pull/70) | Fiche enfant repliée compacte : la ligne de suivi n’apparaît que pendant un quiz ouvert (suite 21 de nouveau verte) |

**Décisions de l’utilisateur du 25 novembre (à conserver).**
- Images des questions (PR nº 68) : seules les images envoyées dans QUIZy sont acceptées (`/media/<id>`), jamais d’adresse extérieure. L’IA dessine une figure SVG ou décrit l’image à ajouter.
- Nettoyage des images (PR nº 69) : déclenché seulement par un envoi qui atteindrait 90 % des 400 Mo. Il efface d’abord les images inutilisées, puis les plus anciennes encore utilisées, jusqu’à 80 %. Ne pas l’étendre à d’autres données.
- Fiche enfant repliée (PR nº 70) : une seule ligne. La ligne de suivi n’apparaît que pendant un quiz ouvert. Ne pas réafficher « Aucun quiz détecté ».

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
