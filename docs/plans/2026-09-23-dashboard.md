# Plan — Tableau de bord (`/dashboard`)

Date : 23/09/2026 — Branche : `feat/dashboard` (créée depuis `chore/ascend-strategy-brand`).
Statut : validé par l'utilisateur.

## Objectif

Remplacer la coquille `ComingSoon` de `/dashboard` par une vue d'ensemble utile, calculée
uniquement sur les données réellement enregistrées, orientée actions et liens vers les dossiers.

## Règles de calcul (validées par l'utilisateur)

- Réutiliser les lectures existantes quand elles sont exactes, **mais** aucun compteur ne doit
  porter sur une page d'une liste paginée. Constat : `listInboundLeads`,
  `listMessagesToValidate`, `listAppointmentsToFollowThrough` sont limitées à 50 lignes et
  `listContacts` est plafonnée par PostgREST (`max_rows = 1000`). Les compteurs utilisent donc
  des comptages exacts en base (`count: "exact", head: true`), filtrés par `agency_id` et
  soumis à RLS.
- Chaque indicateur affiche sa période ou son périmètre (« en attente, toutes dates »,
  « sur 7 jours », « aujourd'hui », « dossiers ouverts »…).
- Échec d'un calcul → « Indisponible » pour cet indicateur. `0` uniquement si le calcul a réussi.
  Un indicateur en échec ne masque pas les autres.
- Marque Ascend Strategy et logo conservés.

## Tâches

1. `automatisation-ia` — `features/dashboard/{types,data,queries}.ts` + tests unitaires et
   intégration deux agences. Aucun changement de schéma (sinon : retour à l'utilisateur).
2. `frontend-ux` — `app/(app)/dashboard/{page,loading}.tsx`, `features/dashboard/components/*`,
   `components/texts.ts`, `docs/product.md`, `docs/design-system.md`, `e2e/dashboard.spec.ts`.
   Blocs : À faire maintenant · Pipeline · Agents IA · Prochains rendez-vous.
3. `cybersecurite` — audit du diff de la branche, droit de blocage.
4. Orchestrateur — contrôles complets (tsc, lint, vitest, playwright, build), commit, push,
   pull request vers `main` (pas de fusion automatique), mise à jour de `CONTEXT.md`.
