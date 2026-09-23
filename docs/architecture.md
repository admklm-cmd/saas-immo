# Architecture d'Ascend Strategy — choix techniques et pourquoi

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
| Journal d'étapes non réécrivable | `ai_agent_run_steps` en ajout seul, `duration_ms` recalculé par la base |
| Mandat signé : confirmation humaine, sortie par un directeur avec motif, trace en ajout seul | `change_contact_stage` (RPC) + triggers `guard_contact_mandate_stage` et `guard_stage_change_activity` |
| Aucune valeur en euros écrite par une IA | `guard_property_estimated_value` : écriture refusée tant qu'une exécution d'agent de la session est ouverte |

**Lecture des e-mails des membres** : `public.list_agency_members` est la seule fonction qui lit
`auth.users` pour l'application ; elle est bornée à l'agence de l'appelant et à quatre colonnes
(voir §6.3).

Le client `service_role` (`lib/supabase/admin.ts`) refuse de s'exécuter côté navigateur et n'est
utilisé que pour le chargement des données de test en local et les tests d'intégration.

### 3.1 Le seul chemin d'écriture public : `/estimation`

**Le problème.** `/estimation` doit fonctionner pour un visiteur **non connecté**. Or `anon` n'a
aucun privilège sur aucune table (règle ci-dessus) et il n'existe pas de session à qui appliquer
une politique RLS. Il faut donc un chemin d'écriture qui reste sûr **sans** session — et qui reste
sûr même appelé directement, en contournant totalement Next.js.

**Pourquoi une fonction `SECURITY DEFINER`, pas la clé `service_role` côté serveur Next.js.** La
clé secrète contourne RLS *entièrement* : l'exposer, même seulement dans une server action, veut
dire qu'un bug de validation y ouvrirait un accès total à la base. Une fonction Postgres
`SECURITY DEFINER`, elle, n'ouvre que ce qu'elle contient explicitement : elle écrit exactement un
`inbound_leads` et les `consents` correspondants, dans **une seule transaction**, et force
elle-même les champs sensibles (agence, source, statut, horodatages) — rien d'autre n'est
accessible par ce chemin.

**La clé publique est publique : la fonction doit se défendre elle-même.**
`public.submit_estimation_request` (`supabase/migrations/20260922120000_public_estimation_request.sql`)
est accordée à `anon` : n'importe qui peut l'appeler directement avec la clé `publishable`, sans
passer par `/estimation` ni par la server action. Chaque garde-fou vit donc **dans la fonction**,
pas seulement dans `features/estimation/` :

| Garde-fou | Où, et pourquoi un appel direct ne peut pas le contourner |
|---|---|
| Agence cible | `private.estimation_target_agency()` — valeur fixe, **jamais un paramètre** de la fonction ; un appelant direct ne peut pas rediriger une soumission vers une autre agence |
| Texte de consentement exact | `private.estimation_consent_text(canal)` — valeur fixe par canal, **jamais un paramètre** ; un appelant direct ne peut pas forger ce qu'un visiteur a accepté |
| Limitation de débit | comptage + insertion dans `private.estimation_submissions` (schéma `private`, absent de `schemas` dans `supabase/config.toml` — inatteignable par l'API Data même avec les bonnes clés). **Seul le plafond par agence (30/h) résiste à un appel direct** : l'empreinte IP est un *paramètre* (`p_ip_hash`), donc un appelant direct choisit son compartiment — voir `docs/security.md` §2.8 |
| Caractères de contrôle | `private.guard_inbound_lead_text()` (migration `20260923090000`) refuse un caractère de contrôle dans le texte libre ou dans une valeur de `payload`, et tout saut de ligne dans un champ d'identité : sinon un appelant direct stockait `first_name = "Jean\r\nBcc: …"`, que Léa recopie dans `contacts.first_name` |
| Bornes de chaque champ texte | vérifiées en PL/pgSQL, **avant toute écriture** — zod côté Next.js est une première ligne, pas la seule |
| Champ piège invisible | vérifié en premier, rejeté avec **le même message** qu'une validation ordinaire |
| `search_path`, privilèges | `set search_path = ''` (aucune résolution de schéma ambiguë), `revoke ... from public`, `grant execute` limité à `anon, authenticated` |

**Pourquoi la validation complète se fait avant toute écriture.** La fonction ne contient **aucun**
bloc `EXCEPTION WHEN ... THEN` : la moindre erreur, n'importe où dans son corps, annule
**tout** ce que cet appel a fait (garantie transactionnelle standard de PL/pgSQL). En validant tout
— piège, empreinte IP, bornes des champs, cohérence consentement/coordonnées — **avant** d'écrire
quoi que ce soit, un appel refusé n'écrit jamais rien de partiel : il n'y a tout simplement rien à
annuler. `features/estimation/estimation.integration.test.ts` le prouve pour de vrai (pas seulement
par lecture du code) en forçant, via une connexion Postgres directe, un échec **au milieu** de
l'insertion des consentements (déclencheur temporaire, propre à la transaction du test, jamais
persisté) : le lead créé juste avant disparaît avec le reste.

**Le lead reste `pending` : Léa n'est pas modifiée.** La fonction écrit `inbound_leads` avec
`status = 'pending'`, `contact_id = null` — exactement comme un lead saisi manuellement par un
membre de l'agence. `features/agents-ia/lea-acquisition/lea.ts` le traite donc **sans aucun
changement** : c'est vérifié pour de vrai par le même test d'intégration, qui appelle
`runLeaAcquisition` sur le lead que la fonction publique vient de créer.

**Une conséquence : `consents.contact_id` devient nullable.** Un lead n'est pas un consentement
(voir l'en-tête de `lea.ts`), et le contact n'existe donc pas encore au moment où le formulaire
public recueille un vrai consentement. Cette migration rend `consents.contact_id` nullable pour
recevoir ce consentement *avant* le contact, avec une référence au lead dans `proof->>'lead_id'`.
`current_consents` est mis à jour pour exclure ces lignes (une « consentement courant » est une
notion **par contact** ; une ligne sans contact n'en fait pas encore partie). Un nouveau trigger,
`private.reconcile_lead_consents()`, copie ce consentement sur le contact **au moment précis** où
Léa (ou un humain) l'attache au lead — sans toucher au code de Léa, puisque c'est un trigger
`AFTER UPDATE` sur `inbound_leads`. Tant que ce rattachement n'a pas eu lieu (lead encore `pending`,
ou `rejected`), le consentement existe comme preuve mais **n'autorise aucun envoi** : la vérification
d'envoi (`guard_outbound_message`) ne regarde que les consentements **d'un contact**.

**Empreinte IP, pas adresse IP.** L'adresse ne vient jamais d'un champ du formulaire : elle est lue
côté serveur depuis les en-têtes de la requête (`x-forwarded-for` / `x-real-ip`), puis hachée
(SHA-256 salé, `ESTIMATION_IP_HASH_SALT`) avant d'atteindre la base — voir
`docs/security.md` pour ce que ça couvre et pour la durée de conservation.
`x-forwarded-for` est une **liste** que le client commence et que chaque proxy complète : c'est donc
l'entrée ajoutée par **notre** proxy qui est retenue (`TRUSTED_PROXY_HOPS = 1`, un nginx en frontal),
jamais la première, sinon préfixer une valeur inventée suffirait à changer de compartiment.

Le sel n'a **aucune valeur de repli** : `features/estimation/ip-hash.ts` le lit dans l'environnement
serveur et exige au moins 32 caractères, et `submitEstimationRequestForClient` refuse la demande
**avant toute écriture** s'il manque. Un sel codé en dur dans le dépôt serait public et rendrait les
empreintes réversibles ; mieux vaut un formulaire momentanément indisponible qu'une pseudo-anonymisation.

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
ni une date, ni une confirmation de mandat, ni l'identité d'une personne. Ces décisions n'existent
même pas dans les schémas de sortie : il n'y a aucun champ par lequel les exprimer. Trois exemples,
un par type de décision à conséquence :

| Décision | Qui la prend | Ce que l'IA peut, au mieux, exprimer |
|---|---|---|
| Quel créneau réserver (Louis) | le code calcule les créneaux légaux et libres | un identifiant **dans la liste fermée** fournie ; hors liste ⇒ réponse entière invalide |
| Si deux vendeurs sont la même personne (Léa) | le code, sur correspondance **exacte** de l'email et du téléphone normalisés | rien : aucun champ de dédoublonnage n'existe dans son schéma |
| Quelle étape du pipeline après un rendez-vous (Sarah) | le code, depuis une **liste blanche** qui ne contient que `estimation_faite` | rien : aucun champ d'étape n'existe dans son schéma |

Pourquoi le dédoublonnage n'est pas confié à un modèle : une correspondance « probable » qui
fusionnerait deux familles différentes dans une seule fiche est une faute grave et difficilement
réversible. On préfère un doublon visible, qu'un humain tranche, à une fusion silencieuse.

**Règles partagées, écrites une fois.** Le choix du canal, la vérification du consentement courant
et l'ajout de la mention de désinscription vivent dans `lib/agents/consent.ts` et sont utilisés à
l'identique par Louis et par Emma : la seule règle qui a des conséquences juridiques ne peut pas
diverger d'un agent à l'autre.

**Exécution sans contact.** Léa travaille *avant* qu'un contact existe :
`startGuardedContactlessRun` ouvre un run avec `contact_id = null` (la colonne est nullable, et la
base interdit de la modifier ensuite). Tous les autres garde-fous — coupe-circuit, volume quotidien,
appartenance à l'agence — s'appliquent sans changement.

**Injection de prompt.** Le texte écrit par un prospect est une **donnée, jamais une instruction** :
il est isolé dans des blocs `<donnee_non_fiable>`, les balises forgées sont neutralisées, la
longueur est bornée, et — surtout — même une injection réussie ne peut rien déclencher, puisque
seule la sortie validée par le schéma est utilisée et que le schéma ne contient aucune action.

**Repli sûr.** Réponse invalide après `MAX_AI_ATTEMPTS` tentatives : **aucune écriture métier**, une
tâche est ouverte pour un humain, le run est marqué `failed`. Un agent ne devine jamais.

**Coût.** Les tokens consommés sont enregistrés par exécution et par agence
(`ai_agent_runs.input_tokens` / `output_tokens`), y compris pour une tentative échouée.

**Voir l'agent travailler, sans mise en scène.** Chaque exécution écrit aussi un journal d'étapes
détaillé (`ai_agent_run_steps`, API dans `lib/agents/steps.ts`) : `guardrails` → `context_loaded` →
`prompt_built` → `ai_call` → `output_validated` → `decision` → `persisted`. Ces étapes sont
enregistrées **au moment où le travail a lieu**, avec des instants mesurés côté serveur, et
`duration_ms` est **recalculé par la base** à partir de `started_at` / `finished_at` : l'interface
rejoue des durées réelles et n'a **jamais** le droit de fabriquer une barre de progression. Le
`guardrails` est posé par `startGuardedRun` lui-même, y compris quand l'exécution est refusée
(statut `blocked` + motif), pour que l'utilisateur voie *pourquoi* ça s'est arrêté. Une panne
d'enregistrement d'étape n'échoue jamais l'exécution métier (même règle que `finishRun`).

**Ce que l'écran affiche est ce qui a été mesuré.** Les chiffres de l'écran « Agents IA »
(`features/agents-ia/data.ts`, exposés par `queries.ts`) sont des **comptages exacts en base**, jamais
un échantillon : l'agrégation se fait en SQL (`public.agent_activity_summary`, migration
`20260917120000`, `security invoker` — la RLS de l'appelant s'applique), sur deux fenêtres nommées et
calculées en **Europe/Paris** (`today`, `last7Days`). Trois règles s'y ajoutent :

- `runsToday` compte **exactement ce que compte `private.guard_ai_agent_run`** pour la limite
  quotidienne — toutes les exécutions de l'agence du jour parisien **sauf** les `blocked`, tous agents
  confondus. Un chiffre affiché à côté d'une limite doit être le chiffre sur lequel la limite porte ;
- la **dernière exécution de chaque agent** vient d'une requête dédiée par agent, sans borne de
  pagination : un agent qui a réellement tourné ne peut pas s'afficher « Jamais exécuté » ;
- **un comptage qui a échoué n'est jamais renvoyé comme `0`.** La réponse de l'agrégat est validée par
  zod et un `count` absent est une erreur : la lecture entière renvoie `{ data: null, error }` et
  l'écran affiche l'erreur. Un zéro rassurant inventé serait un chiffre faux, ce que CLAUDE.md interdit.

**Refuser un brouillon demande un motif.** `rejectOutboundMessage(client, id, { reason, note? })` exige
un motif pris dans une **liste fermée** (`MESSAGE_REJECTION_REASONS`) — pas de texte libre en guise de
motif : c'est exploitable pour corriger les agents, et rien de personnel ni de rédigé par un prospect
ne peut atterrir dans un journal en ajout seul. Un commentaire libre facultatif est accepté, borné à
300 caractères et débarrassé des caractères de contrôle. Motif et commentaire sont journalisés dans
`activities` avec l'auteur humain estampillé par la base.

**Corriger un brouillon ne vaut jamais validation.** `updateDraftContent(client, id, input)` accepte
uniquement l'objet et le corps validés par zod. La server action recharge le message dans l'agence de
l'appelant, refuse les messages déjà refusés ou envoyés et applique un verrou optimiste sur leur état.
Toute correction aboutit à `pending_validation` : si le message était `approved`, le trigger efface
`validated_by` et `validated_at`. L'interface exige alors une nouvelle validation avant l'envoi simulé.

**Ce qu'une IA ne peut pas écrire, même par erreur de code.** `properties.estimated_value_eur` est
la donnée qui engage l'agence devant un vendeur : la base refuse toute écriture de cette colonne
pendant qu'une exécution d'agent de la session appelante est ouverte
(`private.guard_property_estimated_value`). Limite connue et assumée : le lien se fait sur
`triggered_by_user_id = auth.uid()`, donc il bloque exactement le chemin de code d'un agent, pas un
membre de la même agence qui saisirait une valeur au même moment qu'un collègue — refuser ce cas
serait un faux positif sans bénéfice. Côté code, `lib/agents/` n'écrit cette colonne pour aucun agent.

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

### 6.1 Tableau de bord : comptages exacts, « indisponible » plutôt que 0

`features/dashboard/` (`getDashboardSummary()` → `buildDashboardSummary(client)`) calcule
le tableau de bord uniquement à partir des données enregistrées, avec le client serveur de session
(RLS active, jamais `admin.ts`) et l'agence résolue côté serveur (`resolveAgentContext`).

- **Comptages exacts en base** : chaque chiffre est un `count: "exact", head: true` filtré par
  `agency_id`, ou l'agrégat SQL `agent_activity_summary`. Aucun compteur ne repose sur la longueur
  d'une liste paginée (les écrans liés sont limités à 50 lignes, PostgREST à 1 000).
- **Mêmes définitions que les écrans liés** : file « à valider » (`pending_validation` +
  `approved`), leads `pending`, rendez-vous « à confirmer » = `proposed` et contact en `qualifie` /
  `chaud` / `rdv_planifie` (jointure `!inner`, même règle que la base), « à clôturer » = `confirmed`.
  Les constantes sont partagées avec `features/agents-ia/data.ts`.
- **Périmètre explicite** : chaque indicateur porte un `scope` typé (`pending_all_time`,
  `open_all_time`, `current`, `today`, `last_7_days`, `upcoming`) avec ses bornes en Europe/Paris.
- **Indisponible ≠ 0** : un calcul en échec donne `{ status: "unavailable" }` pour cet indicateur
  seul (détail logué côté serveur) ; `0` n'est renvoyé que mesuré (`{ status: "ok", value: 0 }`).
  Contrairement à l'écran Agents IA (tout ou rien), un indicateur en échec ne masque pas les autres.
  Seule une session ou une agence invalide fait échouer tout l'appel.
- **Échantillons** : les listes d'action renvoient le total exact et au plus 5 éléments avec les
  identifiants nécessaires aux liens ; l'échantillon n'est jamais présenté comme la liste complète.

### 6.2 Listes paginées `/taches` et `/rendez-vous` : même définition que le tableau de bord

`features/tasks/` (`getOpenTasks`, `completeTask`) et `features/appointments/` (`getAppointments`)
suivent les mêmes règles que le tableau de bord : client de session (RLS), agence résolue côté
serveur, jamais `admin.ts`.

- **Pagination validée** (`lib/utils/pagination.ts`) : `limit` 1..100, `offset` 0..5000, entiers
  seulement ; total **exact** (`count: "exact"`), jamais déduit de la page. Une page au-delà de la
  fin (`PGRST103`) renvoie une liste vide avec le total exact.
- **Définitions partagées** : `OPEN_TASK_STATUS` (`features/tasks/types.ts`) et
  `UPCOMING_APPOINTMENT_STATUSES` (`features/appointments/types.ts`) sont importées par
  `features/dashboard/data.ts` : le total de `/taches` (portée `all`) égale `openTasks`, celui de
  `/rendez-vous` (vue `upcoming`, même instant) égale `upcomingAppointments`. Prouvé en
  intégration.
- **« Marquer comme faite »** : UPDATE conditionnel (`status = open`) ; `completed_at` /
  `completed_by` posés par le trigger `guard_task`. Second appel : « Cette tâche est déjà
  terminée. ». Aucune ligne `activities` : l'historique du contact lit déjà la tâche et son statut.
- **Minimisation** : ni email, ni téléphone, ni texte libre (détails de tâche, compte-rendu) dans
  ces listes.

### 6.3 Paramètres `/parametres` : lecture seule, sections indépendantes

`features/settings/` (`getAgencySettings`) suit le principe du tableau de bord : client de session
(RLS), agence résolue côté serveur (`resolveAgentContext`), jamais `admin.ts`, et chaque section
(`agency`, `members`, `agents.killSwitch`, `agents.dailyRunLimit`) est `ok` ou `unavailable`
indépendamment. Seule une session ou une agence invalide renvoie `{ data: null, error }`.

- **Membres** : l'e-mail vit dans `auth.users`, illisible par les rôles clients. D'où un RPC étroit,
  `public.list_agency_members(target_agency uuid)` (`SECURITY DEFINER`, `search_path = ''`), qui ne
  renvoie que `user_id`, `email`, `role`, `created_at` de l'adhésion. **Pourquoi un paramètre
  revérifié plutôt qu'aucun paramètre** : pour un utilisateur membre de plusieurs agences,
  l'application choisit l'agence en TypeScript (adhésion la plus ancienne) ; refaire ce choix en SQL
  pourrait diverger (égalité de `created_at`, évolution future de la règle) et afficher l'équipe
  d'une autre agence que le reste de la page. Le paramètre n'est pas cru : la fonction revérifie
  l'adhésion de `auth.uid()` et refuse sinon (`forbidden`). `EXECUTE` : `authenticated` seul.
- **Coupe-circuit** : `findAiPausedState` (lecture dédiée, comme sur le tableau de bord) et l'action
  existante `setAgencyAiPaused` ; rien de nouveau.
- **Intégrations** : liste statique (`SETTINGS_INTEGRATIONS`), toutes `simulation`, non connectées,
  sans aucune donnée de configuration. **Conservation** : `{ status: "undefined" }`, aucune durée
  inventée.

---

## 7. Validation avec zod, aux deux bouts

- **Entrées** : tout ce qui vient du client (formulaire, server action, webhook) est validé avant
  tout traitement.
- **Sorties d'IA** : schémas `strictObject` — toute clé supplémentaire invalide la réponse entière.
  Enums fermés dès qu'un vocabulaire existe, longueurs bornées partout, aucun lien autorisé dans un
  message rédigé par l'IA, et **aucun montant en euros** dans les textes libres d'Emma et de Sarah
  (`noMoney`, `lib/claude/schemas.ts`) : la colonne `estimated_value_eur` est déjà interdite aux
  agents par la base, cette vérification ferme la voie de contournement par le texte.

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
- **E2E (Playwright)** : parcours utilisateur. Un seul worker (`playwright.config.ts`) : plusieurs
  parcours basculent le coupe-circuit de la **même** agence fictive, et en parallèle ils se
  refuseraient mutuellement des exécutions.

### 10.1 Lancer les tests

```
npm run db:start   # une fois : la base locale doit tourner
npx vitest run     # unitaires + intégration
npx playwright test
npm run test:all   # raccourci : les deux, dans cet ordre
```

Les deux commandes s'enchaînent **dans n'importe quel ordre, autant de fois qu'on veut**, sans
rechargement manuel des données entre les deux.

### 10.2 Pourquoi un `globalSetup` Playwright

Les tests d'intégration (Vitest) et les tests E2E (Playwright) tapent la **même** base Supabase
locale, et les deux consomment des données fixtures : un brouillon validé passe à `sent_simulated`,
un créneau proposé est réservé. Enchaînés, les seconds trouvaient donc une base déjà entamée par
les premiers — par exemple le test « isolation : la file d'une agence ne montre jamais le brouillon
d'une autre » ne trouvait plus le brouillon fixture de l'agence B. Défaut d'outillage, pas défaut
produit : l'isolation entre agences, elle, est vérifiée par les tests d'intégration RLS.

`e2e/global-setup.ts` (déclaré dans `playwright.config.ts`) recharge donc les fixtures avant chaque
suite E2E — l'état de départ est **établi**, jamais hérité. Il lance `npm run db:seed` dans un
processus enfant plutôt que d'importer `fixtures/load-fixtures.ts` : ce module est en ESM
(`import.meta.url`) alors que Playwright transpile en CommonJS les fichiers qu'il charge. Le
chargeur de fixtures reste ainsi l'unique source de vérité, inchangé. Coût : environ 5 secondes par
run.

Deux détails qui comptent :

- **Base locale arrêtée** : le setup le détecte avant la suite et échoue une fois, en français
  (« La base Supabase locale est injoignable… Démarrez-la avec `npm run db:start` »), au lieu de
  laisser 17 tests expirer un par un.
- **Jamais autre chose que le local** : le setup passe par `assertNotProduction` et
  `assertLocalSupabaseUrl` (`lib/supabase/local-only.ts`), les mêmes gardes que le chargeur de
  fixtures et les tests d'intégration. La sortie du chargeur (qui affiche les mots de passe fictifs
  générés) est capturée et n'est montrée qu'en cas d'échec : les identifiants restent dans
  `fixtures/.generated-credentials.json` (mode 0600, ignoré par git).

Réciproque (Vitest lancé après Playwright) : **pas de setup symétrique**, il n'est pas nécessaire
aujourd'hui. Les tests d'intégration créent leurs propres agences jetables, et la vérification des
fixtures accepte déjà les traces laissées par les parcours E2E (les activités `ai_paused` /
`ai_resumed` du coupe-circuit sont de vraies actions humaines, voir
`fixtures/fixtures.integration.test.ts`). Si un jour un test d'intégration se met à dépendre d'une
fixture non consommée, la réponse sera un `globalSetup` de projet dans `vitest.config.mts` appelant
le même `npm run db:seed`.

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
- La boîte `/agents-ia/leads-entrants`, la file `/agents-ia/a-valider`, le suivi humain des rendez-vous
  puis Sarah dans `/agents-ia/suivi-rendez-vous`, et le coupe-circuit sont implémentés. Emma dispose
  de son moteur serveur simulé mais d'aucune UI dédiée ; le tableau de bord, le pipeline et les
  paramètres restent des routes `ComingSoon`. Le formulaire public d'estimation a désormais un
  chemin d'écriture fonctionnel côté serveur (`features/estimation/`,
  `public.submit_estimation_request`) ; l'écran `/estimation` lui-même (formulaire visible, cases à
  cocher non précochées) reste à construire par `frontend-ux` à partir de ce contrat.
- **Formulaire public d'estimation : un seul agent cible, en dur.** `private.estimation_target_agency()`
  renvoie un identifiant fixe (celui de l'agence fictive « Calanques Immobilier »). Une vraie
  publication multi-agences résoudrait l'agence depuis le domaine/la configuration du site appelant,
  pas depuis une valeur codée dans une migration — décision de schéma à valider avant tout
  déploiement réel.
- **Limitation de débit : pas de purge automatique.** `private.estimation_submissions` grossit sans
  jamais être vidée dans ce prototype (voir `docs/security.md` pour la durée de conservation
  recommandée). Pas de CAPTCHA, pas de WAF, et une empreinte IP peut être contournée par un
  attaquant qui change d'adresse : voir `docs/security.md` pour ce que la limitation couvre
  réellement.
- **Consentement pré-contact non ré-attaché si le lead n'est jamais traité.** Le rattachement
  (`private.reconcile_lead_consents()`) n'a lieu que lorsqu'un contact est effectivement créé ou
  retrouvé pour ce lead (Léa, ou un rattachement manuel). Un lead laissé `pending` ou marqué
  `rejected` garde son consentement comme preuve, mais ce dernier n'autorise jamais un envoi tant
  qu'aucun contact n'existe.
- Pas encore : désinscription entrante (STOP reçu), purge RGPD automatique, chiffrement applicatif
  des jetons d'intégration, et transaction SQL unique pour regrouper toutes les écritures du suivi
  de Sarah (l'échec est propagé aujourd'hui, mais plusieurs requêtes PostgREST restent nécessaires).
- **Dédoublonnage de Léa borné à 5 000 fiches par agence** (`LEAD_DEDUPE_SCAN_LIMIT`) : la
  comparaison se fait dans le code, sur la liste des contacts de l'agence. Au-delà, l'exécution
  **refuse de conclure** plutôt que de comparer une liste tronquée (un doublon manqué crée une
  seconde fiche pour une personne réelle). Correctif le jour où une agence dépasse cet ordre de
  grandeur : filtrer côté base sur `lower(email)` et sur le téléphone normalisé — ce qui suppose
  une colonne normalisée indexée, donc une décision de schéma à valider.
- **Un seul brouillon de relance par contact et par jour parisien** (clé d'idempotence d'Emma) :
  volontaire, mais c'est une règle de rythme arbitraire, à arbitrer avec le métier.
- Les règles juridiques implémentées reflètent l'état connu en septembre 2026 et **doivent être
  validées par un juriste** avant commercialisation.
