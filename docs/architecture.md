# Architecture d'AiaA — choix techniques et pourquoi

Document de référence technique du prototype. Il explique **pourquoi** chaque choix a été fait,
ce qu'il protège, et ce qu'il ne couvre pas encore. Il est tenu à jour à chaque changement
structurant. État : prototype, Supabase local uniquement, aucune communication externe réelle.

---

## 1. Vue d'ensemble

```
Navigateur (Server Components + quelques composants clients)
        │  server actions / routes API (jamais d'appel direct à la base)
        ▼
Code serveur Next.js  ──►  lib/agents/  (garde-fous, journal, contexte)
        │                        │
        │                        └──►  lib/claude/  (interface fournisseur IA + simulateur)
        ▼
Supabase Postgres  ──  RLS + contraintes + triggers  (dernière ligne de défense)
```

Principe directeur : **chaque règle importante est appliquée deux fois** — une fois par le code
(message clair, refus propre) et une fois par la base (contrainte, trigger, RLS). Le code peut
avoir un bug ; la base, elle, refuse.

---

## 2. Next.js App Router + TypeScript strict

**Pourquoi.** Un seul projet pour le site public de l'agence (non connecté) et l'espace CRM
(connecté), avec du rendu serveur par défaut. Les Server Components évitent d'envoyer au
navigateur des données ou de la logique qui n'ont rien à y faire.

**Conséquences concrètes.**
- Server Components par défaut ; `"use client"` seulement pour l'interactivité.
- **Toute mutation passe par une server action** (`features/<domaine>/actions.ts`). Les routes
  `app/api/` sont réservées aux webhooks externes.
- Chaque server action **revérifie la session et l'agence côté serveur**
  (`resolveAgentContext`), même si l'interface affiche déjà la bonne chose. L'`agency_id` n'est
  jamais lu depuis une valeur envoyée par le navigateur : il vient de la table `memberships`.
- TypeScript strict, et les types de la base sont générés (`types/database.ts`, `npm run db:types`).

---

## 3. Supabase : Postgres, Auth, Row Level Security

**Pourquoi.** Postgres géré, autorisation dans la base elle-même (RLS), et déploiement
auto-hébergeable sur VPS le moment venu — sans réécrire l'application.

**Isolation entre agences.** Chaque table métier porte un `agency_id`. Les politiques RLS
autorisent une ligne uniquement si l'utilisateur de la session est membre de cette agence
(`private.member_agency_ids()`, `SECURITY DEFINER`, basée sur `auth.uid()`). Jamais sur un
paramètre envoyé par le client. En complément :

- **clés étrangères composites** `(agency_id, <fk>)` : un contact de l'agence A ne peut pas être
  rattaché à un bien de l'agence B, même si le code se trompe ;
- `anon` n'a **aucun privilège** sur aucune table ; les formulaires publics passent par du code serveur ;
- `agency_id` est **immuable** après création (trigger) ;
- `consents` et `activities` sont **en ajout seul** : l'`UPDATE` et le `DELETE` sont refusés à tous
  les rôles non superutilisateur, `service_role` compris, et le `TRUNCATE` aussi.

**Garde-fous produit tenus par la base** (et pas seulement par le code) :

| Règle | Mécanisme |
|---|---|
| Coupe-circuit de l'agence | `agencies.ai_paused`, vérifié par le trigger `guard_ai_agent_run` (avec verrou de ligne) |
| Limite quotidienne d'exécutions IA | `agencies.ai_daily_run_limit`, comptée sur la journée **Europe/Paris** |
| Aucun envoi sans consentement valide | `guard_outbound_message` relit le consentement courant **au moment de l'envoi** |
| Premier contact validé par un humain | `guard_outbound_message` : un premier message non validé ne peut pas partir |
| Aucune double réservation de créneau | contrainte d'exclusion `appointments_no_overlap` (GiST) |
| Un seul rendez-vous actif par contact | **code uniquement** pour l'instant (`checkEligibility`) — voir « ce qui n'est pas couvert » |
| Aucun double envoi | `outbound_messages.idempotency_key`, unique par agence |
| Journal d'exécution non réécrivable | `guard_ai_agent_run` : un run terminé est figé, les colonnes d'identité sont immuables |

Le client `service_role` (`lib/supabase/admin.ts`) refuse de s'exécuter côté navigateur et n'est
utilisé que pour le chargement des données de test en local et les tests d'intégration.

---

## 4. Fournisseur d'IA interchangeable, simulateur d'abord

**Pourquoi.** L'abonnement de développement ne finance pas les agents du produit, et aucun budget
d'API n'est défini. Il ne doit donc être **techniquement impossible** de déclencher un appel payant
par accident, tout en gardant la possibilité de brancher un vrai fournisseur sans réécriture.

**Comment.**
- `lib/claude/provider.ts` définit l'interface `AiProvider` (`name`, `model`, `isSimulation`,
  `generate`). Le reste du code ne connaît que cette interface.
- `lib/claude/client.ts` choisit l'implémentation d'après `AI_PROVIDER`. **Seul `simulator` est
  branché** ; toute autre valeur est refusée avec un message explicite — jamais de repli silencieux
  vers un service payant, jamais de repli silencieux vers le simulateur non plus.
- `lib/claude/simulator.ts` produit des réponses **déterministes, hors ligne, gratuites**, à partir
  des seules entrées fournies. Une information absente reste `null` et est signalée manquante.
- Tout ce qui sort du simulateur est marqué `is_simulation` jusque dans l'historique CRM, pour
  qu'une action simulée ne soit jamais confondue avec une action réelle.
- Le SDK d'un fournisseur payant n'est **pas installé** dans le projet.

**Brancher un vrai fournisseur plus tard** : ajouter un adaptateur à côté de `simulator.ts`, lire sa
clé dans une variable d'environnement serveur, ajouter une branche dans `client.ts`. Rien d'autre
ne change.

---

## 5. Les agents IA : ce que l'IA décide, et ce qu'elle ne décide jamais

L'infrastructure commune est dans `lib/agents/` (elle est identique pour Léa, Hugo, Emma, Louis et
Sarah, donc elle vit dans `lib/`, pas dans un domaine) ; chaque agent garde son prompt, son schéma
et sa logique de décision dans `features/agents-ia/<agent>/`.

Séquence imposée à **tous** les agents :

```
session + agence  →  garde-fous (coupe-circuit, volume, reprise humaine, appartenance du contact)
→  run ouvert dans ai_agent_runs  →  règles métier du code  →  appel IA (contenu prospect isolé)
→  validation zod (réessai limité)  →  écritures  →  historique CRM  →  run clôturé
```

**L'IA ne décide jamais** : ni une étape du pipeline, ni un destinataire, ni un canal, ni un envoi,
ni une date, ni une confirmation de mandat. Ces décisions n'existent même pas dans les schémas de
sortie : il n'y a aucun champ par lequel les exprimer. Exemple, Louis : c'est **le code** qui calcule
les créneaux légaux et libres ; Louis choisit un identifiant dans cette liste fermée, et un
identifiant hors liste invalide toute la réponse.

**Injection de prompt.** Le texte écrit par un prospect est une **donnée, jamais une instruction** :
il est isolé dans des blocs `<donnee_non_fiable>`, les balises forgées sont neutralisées, la
longueur est bornée, et — surtout — même une injection réussie ne peut rien déclencher, puisque
seule la sortie validée par le schéma est utilisée et que le schéma ne contient aucune action.

**Repli sûr.** Réponse invalide après `MAX_AI_ATTEMPTS` tentatives : **aucune écriture métier**, une
tâche est ouverte pour un humain, le run est marqué `failed`. Un agent ne devine jamais.

**Coût.** Les tokens consommés sont enregistrés par exécution et par agence
(`ai_agent_runs.input_tokens` / `output_tokens`), y compris pour une tentative échouée.

---

## 6. Erreurs : `{ data, error }` partout

Les fonctions serveur (server actions, queries, agents) renvoient un `Result<T>` =
`{ data: T, error: null }` ou `{ data: null, error: { code, message } }` — jamais d'exception brute
jusqu'à l'interface (`lib/utils/result.ts`).

- `code` : anglais, stable, testable (`consent_not_granted`, `appointment_slot_taken`…).
- `message` : français, clair, affichable, **centralisé** dans `lib/agents/messages.ts`.
- Le détail technique (message Postgres, trace) est **logué côté serveur** et n'est jamais exposé.
- « Introuvable » et « appartient à une autre agence » renvoient **exactement le même message**
  (« Contact introuvable. ») : un message d'erreur ne doit rien apprendre sur une autre agence.

---

## 7. Validation avec zod, aux deux bouts

- **Entrées** : tout ce qui vient du client (formulaire, server action, webhook) est validé avant
  tout traitement.
- **Sorties d'IA** : schémas `strictObject` — toute clé supplémentaire invalide la réponse entière.
  Enums fermés dès qu'un vocabulaire existe, longueurs bornées partout, aucun lien autorisé dans un
  message rédigé par l'IA.

---

## 8. Temps et droit français

Tout ce qui a un sens légal est calculé en **Europe/Paris** (`lib/agents/time.ts`,
`@date-fns/tz`) : jamais en UTC, jamais dans le fuseau du serveur.

- Journée de comptage du volume IA : journée calendaire parisienne.
- Créneaux de rendez-vous : lundi–vendredi, **hors jours fériés français** (calculés, Pâques
  comprise), 10h–13h et 14h–18h — à l'intérieur des plages légales d'appel (10h–13h / 14h–20h).
- Les instants sont stockés en `timestamptz` et renvoyés à l'interface en ISO-8601 UTC canonique.

---

## 9. Intégrations externes

Aucune intégration réelle n'est branchée dans le prototype : tout est simulé et marqué comme tel.
Le principe est posé : un **adaptateur par service** dans `lib/integrations/`, respectant une
interface commune ; le reste du code appelle l'interface, jamais la librairie du fournisseur.
Jetons OAuth et clés : côté serveur uniquement, jamais renvoyés au navigateur.

---

## 10. Tests

- **Unitaires (Vitest)** : logique pure, sans base ni réseau — calcul des créneaux, schémas de
  sortie IA (valides / invalides / malveillants), règles de consentement, décisions de pipeline.
- **Intégration (Vitest, Supabase local)** : `*.integration.test.ts`. Sessions réelles, RLS active,
  deux agences fictives créées puis supprimées. Ils refusent de s'exécuter sur autre chose que le
  Supabase local.
- **E2E (Playwright)** : parcours utilisateur.

---

## 11. Ce qui n'est pas couvert (à ce stade)

- Aucun envoi réel : aucun fournisseur d'email, SMS, WhatsApp ou agenda n'est branché.
- Aucun appel IA payant : seul le simulateur existe.
- **Un seul rendez-vous actif par contact** n'est garanti que par le code. En pratique, deux
  exécutions simultanées de Louis sur le même contact choisissent le même créneau et le même
  conseiller, donc la contrainte d'exclusion les départage ; mais si elles visaient des conseillers
  différents, deux rendez-vous pourraient coexister. Correctif proposé (décision de schéma, à
  valider) : `create unique index … on public.appointments (agency_id, contact_id) where status in
  ('proposed','confirmed');`. À arbitrer avec le métier : une agence peut légitimement vouloir deux
  rendez-vous actifs (estimation puis signature).
- Pas encore : file d'attente de validation des premiers contacts, confirmation humaine d'un
  rendez-vous (passage en `rdv_planifie`), désinscription entrante (STOP reçu), purge RGPD
  automatique, chiffrement applicatif des jetons d'intégration.
- Les règles juridiques implémentées reflètent l'état connu en septembre 2026 et **doivent être
  validées par un juriste** avant commercialisation.
