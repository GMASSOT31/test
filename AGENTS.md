# AGENTS.md — consignes pour les agents (Codex et autres)

1. **Lire `CLAUDE.md` en entier avant de commencer.** C'est la référence unique du projet : dépôt, hébergement, base de
   données, environnements, parcours, commandes, déploiement et règles de coopération. Ne pas recopier ces informations ici.
2. Respecter les consignes de l'utilisateur de `CLAUDE.md` §1 : répondre en français, ne jamais demander ni écrire de secret,
   ne modifier aucune donnée réelle sans accord, ne travailler que sur `cloudflare/` (`apps-script/` est figé).
3. Suivre les règles de coopération de `CLAUDE.md` §10 : une branche par tâche depuis `main` à jour, préserver le travail en
   cours de l'autre développeur (Claude Code ou Codex), tester le parcours concerné avec le dernier `main` intégré avant la fusion.
4. Vérifier ses accès en lecture (`CLAUDE.md` §9) avant une mission qui en dépend.
5. ⚠️ `npx wrangler deploy` met en ligne immédiatement, sur les données réelles : seulement depuis `main` à jour après fusion.
6. Si une modification change une règle métier, le back-end, les données ou le déploiement, **mettre à jour `CLAUDE.md`**
   (et `docs/LOGIQUE-APP.md` pour les règles métier) dans la même PR.

7. Pour reprendre un chantier ou passer le relais, consulter [docs/REPRISE.md](docs/REPRISE.md) et vérifier le statut de la branche et de la PR.
