# Répartition des outils IA de développement

> Validé par l'utilisateur le 10/10/2026. Ces outils servent à **développer** le produit.
> Ils ne remplacent pas les agents IA du produit (Léa, Hugo, Emma, Louis, Sarah).

## Principe

Un seul outil écrit sur une branche à la fois. Le code qui part dans `main` passe toujours par
Claude Code (orchestrateur + agents `automatisation-ia`, `web-designer`, `frontend-ux`,
`cybersecurite`) : plan validé, tests réellement exécutés, audit sécurité, pull request.

| Outil | Capacité | Rôle | Ce qu'il ne fait pas |
|---|---|---|---|
| **Claude Code** | Session longue, accès au dépôt, agents spécialisés, tests | Plan, code, migrations, tests, audit, fusion | — |
| **Gemini** | Utilisable sans limite, fort en image et en lecture de captures | Exploration visuelle, maquettes, images, propositions de textes, relecture du rendu à partir de captures d'écran | Ne touche jamais `features/`, `lib/`, `supabase/`, `app/api/`, `e2e/`, ni `.env*` ; ne pousse jamais sur `main` |
| **Codex** | 3 demandes maximum par période | Contre-audit sécurité **indépendant**, en lecture seule, aux étapes clés | N'écrit pas de code applicatif |

## Gemini — mode d'emploi

1. Il lit `docs/DIRECTIVES-GEMINI.md`, puis `docs/PRD.md` et `docs/design-system.md`.
2. Il travaille sur une branche `gemini/<sujet>`, ou seulement dans `docs/propositions-gemini/`
   (maquettes, images de référence, textes proposés).
3. Une image retenue n'est copiée dans `public/images/` qu'après validation de l'utilisateur.
4. Ses propositions passent ensuite par `web-designer` (spécification exécutable), puis
   `frontend-ux` (code). Gemini ne modifie pas directement les composants en production.

## Codex — les 3 demandes prévues

1. Contre-audit de la branche `fix/security-p1` (SEC-001, SEC-002, SEC-003, SEC-007).
2. Contre-audit de `feat/ai-ready` (Privacy Gateway, connexion IA réelle) **avant** toute activation.
3. Réserve : audit d'ensemble avant le premier déploiement sur VPS.

Chaque demande est préparée par l'orchestrateur, prête à copier-coller. Le rapport est écrit
dans `docs/audits/AAAA-MM-JJ-codex-<sujet>.md`, puis relu par `cybersecurite`. Un point critique
ou élevé bloque la livraison comme pour `cybersecurite`.
