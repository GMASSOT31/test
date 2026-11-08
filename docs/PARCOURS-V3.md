# Parcours v3 : révision espacée

Objectif : qu'un enfant qui utilise l'appli connaisse sa leçon plus vite et plus solidement, avec des séances courtes, claires, et un suivi lisible pour le parent.

## Principes (recherche en sciences de l'apprentissage)
- **Se tester plutôt que relire** : chaque carte lue est suivie d'une question ; le niveau ne dépend que des tests, jamais de l'avis de l'enfant.
- **Espacer** : une question réussie revient de plus en plus tard (1, 3, 7, 14 jours) ; une erreur la fait revenir vite.
- **Réapprendre à chaque séance** : une question ratée revient plus loin dans la même séance jusqu'à être réussie.
- **Retrouver plutôt que reconnaître** : QCM pour découvrir, puis questions sans choix (réponse écrite, champs, ou « QCM masqué » : réfléchir d'abord, dire si l'on est sûr, puis voir 4 à 5 choix).
- **Correction immédiate** : bonne réponse et explication tout de suite.
- **Mélanger** : la révision du jour mélange les leçons.

## Niveaux d'une question (`srs_<élève>__<quiz>.it`)
| Niveau | Atteint quand | Revient |
|---|---|---|
| 🌱 0 Nouvelle | jamais réussie | — |
| 🌿 1 Découverte | réussie en QCM (ou erreur : retour ici) | demain |
| 🌳 2 Rappelée | réussie sans choix, du premier coup, quand elle était à revoir | dans 3 jours |
| ⭐ 3 Ancrée | idem | dans 7 jours |
| 🏆 4 Maîtrisée | idem | dans 14 jours (30 en entretien) |
Seule la première réponse d'une question dans une séance compte ; « je crois savoir » ne fait pas monter ; une séance bonus (question pas encore à revoir) n'avance pas le plan mais ses erreurs comptent.

## Date du contrôle et plan (`makePlan_`)
Fixée par l'enfant à la première ouverture (Demain, Après-demain, Dans une semaine, Pas de contrôle, ou une date) ou par le parent dans le suivi. Avec une date, les questions reviennent aux séances du plan ; les ancrées sautent à la dernière séance.
- Demain (express) : maintenant, 1 h plus tard, le matin du contrôle (si commencé tard le soir : maintenant et le matin).
- 2 jours : aujourd'hui, demain, le matin du contrôle. 3 jours : aujourd'hui, demain, la veille.
- Plus : aujourd'hui, demain, J+3, J+7, J+15… et toujours la veille.
Avec une date, toutes les nouvelles questions sont découvertes dès la première séance ; sans date, par blocs de 5 (environ 15 questions par séance).
Après la date : l'enfant choisit de garder la leçon en mémoire (entretien) ou de l'archiver (hors révision du jour, réactivable).

## Séance
Découvrir (cartes question + réponse) → Tester (QCM) → Corriger (la question ratée revient 4 écrans plus loin) → bilan (réussies du premier coup, questions qui ont progressé, prochaine séance). « Déjà travaillée en classe » : on commence directement par tester. Les questions à revoir sont posées sans choix.

## Suivi parent
Par élève : séances et minutes de la semaine, questions à réviser, dernière activité. Par leçon : barre des niveaux, « Prête pour le contrôle ? » (part des questions au moins rappelées : ≥ 90 % prête, ≥ 60 % presque), questions difficiles (erreurs, dont « sûr·e »), historique des séances, date du contrôle et plan, archiver / réactiver, remise à zéro.

## Passage au v3
Effacement unique (clé `schema_version`) des anciennes clés `prog_`, `done_`, `parcours_` ; comptes, quiz, paquets et attributions conservés. Sauvegarde possible avant : `backupData(motDePasse)`.
