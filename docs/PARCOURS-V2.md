# Parcours v2 (cahier des charges V3.1)

Branche `cahier-v31`. État : implémenté et testé (simulation Google + navigateur), **non publié** : le cahier précise que la préparation du code n'est pas une demande de publication.

## Règles implémentées
- **Quiz initial** : un seul passage complet (toutes les questions, aucun bloc de 10). Bilan : score du premier essai et nombre de questions à retravailler.
- **Série** : 0 à 2 (`MASTERY = 2`). Bonne réponse du premier essai : +1. Erreur ou « Je ne sais pas » : retour à 0 et une seule erreur comptée par présentation. Une réponse corrigée après erreur ne compte pas. Une question n'est comptée qu'une fois par passage (double clic, nouvel essai réseau, opId rejoué).
- **Cartes ciblées** : questions ratées / « Je ne sais pas » du passage. Aucune carte vide : si rien n'est raté, on passe directement à la vérification.
- **Vérification** : questions dont la série est < 2 (y compris les bonnes réponses du quiz initial à 1 sur 2). Erreurs → cartes ciblées de ces seules questions ; sinon passage suivant sur les questions encore à 1 sur 2 ; toutes à 2 sur 2 → paquet final.
- **Paquet final** : toutes les cartes de la leçon. Puis « Faire valider par un adulte » → `attente_validation` → `valide` (administration, `validateParcours`).
- **Flashcards actives** (guidées et libres) : question seule, « Voir la réponse » (clic, Entrée, Espace), puis exactement Oublié / Hésité / Trouvé. Toutes les cartes présentées une fois d'abord ; ensuite files Oublié puis Hésité (ordre conservé), une carte revient après au plus 3 autres, jamais deux fois de suite si une autre est disponible ; pile d'une carte : réapparaît au recto, sans minuterie. Fin : chaque identifiant distinct a été évalué et finit Trouvé. Compteurs « Cartes travaillées X sur N » / « Cartes encore à revoir Y » (N = cartes distinctes). « Précédente » supprimé ; « Mélanger » ne mélange que les cartes pas encore présentées et ne valide rien. Les évaluations sont déclaratives et ne changent jamais les séries.
- **Je ne sais pas** : réponses écrites et plusieurs champs, dès l'ouverture ; montre la réponse (tous les champs) et l'explication, verrouille, zéro point, une seule erreur ; remplace l'ancien « Voir la réponse ». Pas de bouton pour les QCM.
- **Passage automatique** : inchangé (1 s / 1,8 s, jamais après erreur) ; temporisateur annulé si on avance à la main.
- **Navigation** : « Mes leçons » par défaut (statut + action unique : Commencer le quiz, Reprendre le quiz, Revoir mes cartes, Continuer la vérification, Réviser toutes les cartes, Voir la demande de validation, Voir le parcours validé) ; Programme → « Mes progrès » (Questions vérifiées + règle « Deux réussites consécutives aux quiz » ; même étape que Mes leçons) ; Flashcards libres conservées.
- **Reprise** : le passage en cours (liste des questions + réponses déjà comptées) et la pile de cartes (évaluations, files Oublié/Hésité, carte courante) sont enregistrés sur le serveur ; rouvrir la leçon reprend sans redonner de point.

## Modèle de données (propriété `parcours_<élève>__<quiz>`, `v: 2`)
`etape` (`quiz_initial | cartes_ciblees | verification | cartes_finales | attente_validation | valide`), `pass` `{kind: initial|verif, list: [idQuestion], res: {id: 1|0}}`, `pile` `{kind: ciblees|finales, ids, etat: {id: {d: oublie|hesite|trouve, n}}, q: {f,o,h,w,c,l}}`, `fini`, `valide`, `maj`, `ops` (30 derniers identifiants d'opération), `v1` (ancien enregistrement, voir migration). La progression `prog_…` ne change pas de forme (`[série, erreurs]`).
Le serveur décide de l'étape et renvoie l'état après chaque transition (`parcours`).

## Contrôles serveur
Identité et attribution de la leçon revérifiées à chaque appel ; question hors passage / carte hors pile refusées ; `finishQuiz` refusé tant que toutes les questions du passage n'ont pas de réponse ; `cardsDone` / `requestValidation` refusés tant que chaque carte de la pile n'est pas évaluée et Trouvé ; paquet final refusé si une question a une série < 2 ; validation réservée à l'administrateur authentifié ; hors passage de quiz, `saveResult` est sans effet (aucune écriture).

## Migration v1 → v2 (à la volée, sans perte)
Lecture seule tant que l'élève n'agit pas : le parcours v1 est converti en mémoire (déterministe, donc répétable), et ne s'écrit qu'à la première action de l'élève, avec l'ancien enregistrement conservé dans `v1`.
| Ancien | Nouveau |
|---|---|
| `valide` | `valide` (date conservée) |
| `fini` | `attente_validation` (date conservée) |
| `revision` | `cartes_finales` (ou `verification` s'il reste des questions < 2) |
| `cartes` | `cartes_ciblees` recalculées depuis les questions < 2 (ou `cartes_finales` si aucune) |
| `quiz` avec ≥ 1 passage fait | `cartes_ciblees` (questions < 2) ou `cartes_finales` |
| `quiz` sans passage | `quiz_initial` |
Séries : jamais abaissées dans le stockage ; une série de 3 est lue comme 2. Compteurs « fait N fois », erreurs, comptes, attributions, contenus : inchangés. Aucune carte n'est marquée « Trouvé » rétroactivement. Une ancienne tentative partielle non enregistrée ne peut pas être reconstruite : l'élève reprend au quiz initial (ou à l'étape recalculée), sans réponse inventée.

## Avant publication : sauvegarde et retour arrière
1. Sauvegarde : fonction `backupData(motDePasse)` (administrateur) : toutes les propriétés sauf `ADMIN_PASSWORD` (à lancer depuis l'éditeur Apps Script ou la console de la page admin, et à conserver hors du dépôt : elle contient les PIN hachés).
2. Publier (procédure habituelle : `clasp push` puis `clasp deploy -i <déploiement>`, même URL).
3. Retour arrière : redéployer la version précédente du code (déploiement 24), puis lancer `rollbackParcoursV1(motDePasse)` : il restaure les anciens parcours (`v1`). Les séries déjà modifiées par des passages faits en v2 restent (elles sont compatibles : un enregistrement v1 lit simplement 0–2 comme « pas encore sue » avec l'ancien seuil de 3).
4. Les pages ouvertes avant la mise en ligne (ancienne version en cache) doivent être rechargées : l'ancien client n'envoie pas d'identifiants d'opération et ignore les nouvelles étapes.

## Tests
`tests/18` (serveur : T01–T03, comptage, isolation, migration, rejeu, retour arrière), `tests/19` (flashcards actives : T04–T06, doubles clics, clavier, Je ne sais pas, reprise), `tests/20` (réseau : réponse perdue, évaluation perdue, réessai), `tests/21` (320/375/390/768 px, administration), `tests/12` (parcours complet côté page), `tests/14` (Mes progrès). Les suites 02, 03, 06, 08, 09, 10, 11, 13, 15 ont été adaptées (seuil 2, reprise, plus de rejeu libre d'un quiz).

## Limites et écarts
- Pas de file d'actions persistante côté navigateur (« si nécessaire » dans le cahier) : « Sauvegarde en attente » s'appuie sur les 3 essais + réessai manuel ; si l'onglet est fermé pendant une panne, les actions non envoyées sont perdues (une question non enregistrée est simplement redemandée au passage suivant).
- Le retournement d'une carte n'est pas envoyé séparément : il est implicite dans l'évaluation (l'interface n'offre pas d'évaluation avant le verso).
- Migration testée sur des données simulées (cas séries 0/1/2/3 et tous les anciens états) ; elle n'a pas été exécutée sur les données réelles.
- Essais réels sur téléphone physique et clavier virtuel non faits (Playwright aux largeurs demandées seulement).
