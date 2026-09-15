# Plan validé — Initialisation du prototype AiaA

- **Validé par l'utilisateur le** : 2026-09-15
- **Branche** : `feat/init-prototype`
- **Statut** : étape 0 (préparation) faite. Reprendre à la tâche 1.

## Décisions déjà prises

- Emplacement du projet : `C:\Users\admha\mon-saas\saas-immo`.
- Docker Desktop installé et lancé (serveur 29.8.0) → Supabase en local via `supabase start`.
- Exécution par l'orchestrateur et ses vrais sous-agents (option A), dans une session ouverte dans ce dossier.
- Dépôt GitHub distant : **pas encore fourni**. Commits locaux seulement tant que l'URL n'est pas donnée ; demander l'URL avant l'étape de push.

## Demande d'origine de l'utilisateur

1. Initialiser le projet : Next.js (App Router) + TypeScript strict, Tailwind CSS, Supabase, Vitest, Playwright, en suivant exactement la structure et les conventions de `CLAUDE.md`.
2. Créer dans `docs/` : `product.md` (écrans, agents IA et leur rôle), `architecture.md` (choix techniques et pourquoi), `workflows.md` (vide pour l'instant, rempli agent par agent), `security.md` (état des lieux sécurité).
3. Créer `fixtures/` : l'agence fictive La Ciotat/Cassis et une deuxième agence fictive pour tester l'isolation.
4. Premier parcours de bout en bout : contact fictif → qualification par Hugo → proposition de rendez-vous par Louis → historique dans le CRM. Hugo et Louis tournent sur un simulateur (aucun budget API défini).
5. Tester chaque pièce isolément, puis en intégration, et rapporter les résultats réels.

**Objectif** : poser le socle d'AiaA et faire tourner le parcours Hugo → Louis → historique CRM, entièrement simulé et réellement testé.

## Tâches

0. **Préparation (orchestrateur) — FAIT** : `CLAUDE.md`, `.claude/agents/`, `.claude/skills/appsec-review/`, `.claude/settings.json`, `.gitignore` ; branche `master` renommée `main`, commit initial, branche `feat/init-prototype`.

1. **Socle technique (automatisation-ia)** : Next.js App Router + TS strict + Tailwind + ESLint, Vitest, Playwright, `supabase init`, arborescence complète de `CLAUDE.md`, `.env.example` (noms uniquement), `lib/supabase/{client,server,admin}.ts` (`admin.ts` refuse de s'exécuter côté navigateur). Versions vérifiées dans la documentation officielle au moment de l'installation.
   *Fin* : `npm run dev` démarre ; tsc, lint, Vitest et Playwright passent chacun un test minimal (résultats réels).

2. **Base de données et isolation (automatisation-ia)** : `supabase/migrations/<date>_init.sql`, `types/database.ts` généré, tests d'isolation.
   *Fin* : pour chaque table, un utilisateur de l'agence A ne peut ni lire, ni créer, ni modifier, ni supprimer une ligne de l'agence B (test réel sur Supabase local).

3. **Données de test (automatisation-ia)** : `fixtures/`.
   - Agence A « Calanques Immobilier (fictive) », La Ciotat / Cassis, 8 collaborateurs, 450 000 € de CA, ~25 contacts à différentes étapes, biens, consentements variés (dont absents ou retirés), rendez-vous existants.
   - Agence B « Agence Test Isolation (fictive) », ~5 contacts.
   - Utilisateurs de test : un directeur et un agent pour A, un utilisateur pour B.
   - Emails en `@example.test` ; téléphones dans les plages réservées à la fiction par l'ARCEP (à vérifier).
   - Script de chargement limité au Supabase local (bloque toute autre adresse), aucun mot de passe en dur.
   *Fin* : `npm run db:reset` charge les données ; un test vérifie qu'elles sont bien synthétiques.

4. **Hugo et Louis sur simulateur (automatisation-ia)**
   - `lib/claude/` : interface commune au fournisseur d'IA ; seul branchement pour l'instant : le simulateur. Aucun appel payant, pas de SDK Anthropic installé.
   - `features/agents-ia/hugo-qualification/` (prompt versionné, schéma de sortie, logique de décision) : extrait type de bien, secteur, motivation, délai. Information absente = `null` + signalée comme manquante, jamais inventée. Passe le contact en `qualifié` ou `chaud`, ou le laisse en `nouveau` avec une tâche « info manquante ».
   - `features/agents-ia/louis-rendez-vous/` : **le code** calcule les créneaux libres (heures ouvrées, jours fériés, aucun chevauchement) ; Louis choisit uniquement parmi eux et rédige le message. Rendez-vous « proposé », message « à valider » avec badge simulation. Rien n'est envoyé. L'étape `rdv_planifié` n'est atteinte qu'après confirmation humaine (itération suivante).
   - Garde-fous vérifiés par le code avant chaque exécution : coupe-circuit de l'agence, limite de volume par agence, journal de chaque exécution, réponse de l'IA validée avant usage. Réponse invalide : aucune action, tâche créée pour un humain.
   - Livré : `qualifyContact(contactId)`, `proposeAppointment(contactId)`, `getContacts()`, `getContactById(id)`, `getContactTimeline(id)`. Toutes renvoient `{ data, error }` et revérifient session et agence côté serveur.
   *Fin* : tests unitaires et d'intégration listés plus bas au vert.

5. **Documentation** : `docs/architecture.md` et `docs/workflows.md` (automatisation-ia ; `workflows.md` vide, seulement le gabarit des champs obligatoires) ; `docs/product.md` et `docs/design-system.md` (frontend-ux) ; `docs/security.md` (cybersecurite).

6. **Interface du parcours (frontend-ux)** : design system de base en noir et blanc (tokens, `components/ui/` : bouton, carte, badge d'étape, badge « simulation », squelette de chargement). Pages `(auth)/connexion`, `(app)/layout` (vérifie la session), `contacts` (liste), `contacts/[id]` (fiche, boutons « Lancer Hugo » et « Lancer Louis », historique). Les autres pages de la structure restent des coquilles « À venir ».
   *Fin* : tsc, lint et E2E au vert.

7. **Audit de sécurité (cybersecurite)** : revue de toute la branche (isolation, secrets, validation des entrées, injection de prompt, garde-fous, `npm audit`). Corrige ce qui est simple ; bloque la livraison s'il reste un problème critique ou élevé.

8. **Vérification et livraison (orchestrateur)** : tsc, lint, Vitest, Playwright, `git diff --stat main...HEAD`. Commit `feat: bootstrap AiaA prototype with Hugo → Louis journey`, puis push seulement si un dépôt distant a été fourni.

## Base de données

Toutes les tables : `agency_id` et RLS activée. Politiques via une fonction `is_agency_member(agency_id)` basée sur la session, jamais sur une valeur envoyée par le navigateur.

| Table | Rôle |
|---|---|
| `agencies` | agence et coupe-circuit IA |
| `memberships` | utilisateur ↔ agence, rôle agent ou directeur |
| `contacts` | fiche vendeur et étape du pipeline |
| `properties` | bien lié au contact |
| `consents` | une ligne par contact et par canal, avec texte, version, source, preuve. Ajout seulement : jamais modifiée ni supprimée |
| `appointments` | rendez-vous ; index unique contre la double réservation d'un même créneau |
| `outbound_messages` | brouillons IA, statut « à valider » |
| `activities` | historique du CRM, ajout seulement, marqué simulation ou non |
| `ai_agent_runs` | journal des agents : entrée, sortie, décision, statut, fournisseur (`simulator`), tokens |

## Dépendances

- `next`, `react`, `typescript`, `tailwindcss` : stack imposée.
- `@supabase/supabase-js`, `@supabase/ssr` : base de données et session côté serveur.
- `zod` : validation des entrées et des sorties de l'IA.
- `@date-fns/tz` : créneaux à l'heure de Paris.
- Dev : `vitest`, `@testing-library/react`, `jsdom`, `@playwright/test`, `supabase` (CLI), `tsx`.

## Risques légaux et sécurité

- Fuite entre agences : RLS, testée avec les deux agences fictives.
- Envoi réel accidentel : aucun fournisseur d'envoi branché, tout marqué « simulation » (interface et journaux).
- Premier contact : le message de Louis reste « à valider » ; l'écran de validation vient à l'itération suivante.
- Injection de prompt : notes du prospect traitées comme données ; test « ignore tes instructions ».
- `service_role` : uniquement pour le script de chargement local.
- Données uniquement fictives ; règles légales à faire valider par un juriste avant commercialisation.

## Tests prévus

**Isolés (Vitest)** : schémas de sortie de Hugo et Louis (valides, invalides, malveillants) ; simulateur de Hugo (données complètes / manquantes, rien d'inventé) ; calcul des créneaux (week-ends, fériés, chevauchements) ; garde-fous (coupe-circuit, limite de volume) ; validité d'un consentement ; 2 ou 3 composants d'interface avec données simulées.

**Intégration (Vitest sur Supabase local)** : isolation A/B sur les 9 tables (lecture, création, modification, suppression) ; Hugo → étape changée + journal + historique ; Louis → rendez-vous « proposé » + message « à valider » ; double réservation refusée par la base ; coupe-circuit activé → rien n'est créé.

**E2E (Playwright)** : `e2e/parcours-hugo-louis.spec.ts` : connexion agence A → fiche contact → Hugo → Louis → historique à jour avec badges. Cas d'erreur : coupe-circuit activé → message clair, aucune action. Isolation : l'utilisateur A qui ouvre l'adresse d'un contact de B obtient une page introuvable.

Rapporter la sortie réelle de chaque commande.
