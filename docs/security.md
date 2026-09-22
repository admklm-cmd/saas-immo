# Sécurité — état des lieux

**Dernière revue** : 2026-09-22 — audit du jalon « Relances Emma » (écran `/agents-ia/relances`,
lecture serveur `listEmmaFollowUpCandidates`, chemin `prepareFollowUp`), par l'agent `cybersecurite`.
Revue complète précédente : 2026-09-16, branche `feat/init-prototype`.

Ce document décrit **ce qui est réellement couvert aujourd'hui** et **ce qui ne l'est pas encore**.
Il ne promet aucune sécurité absolue : aucun système n'est inviolable, et une partie des protections
décrites ci-dessous n'a de sens qu'une fois le produit correctement déployé et exploité.

> **Avertissement juridique.** Les règles de démarchage et de protection des données rappelées ici
> résument la réglementation connue en septembre 2026. Elles **doivent être validées par un juriste
> avant toute commercialisation** et avant tout contact avec une personne réelle. Le prototype ne
> contacte personne : toute communication externe est simulée.

---

## 1. Périmètre actuel

Prototype d'entraînement, **jamais mis en ligne**, exécuté uniquement sur un poste de développement
avec un Supabase local. Données **entièrement fictives** (deux agences de test, emails `@example.test`).
Les agents IA du produit (Léa, Hugo, Emma, Louis, Sarah) tournent sur un **simulateur** : aucun appel
d'API payant, aucun fournisseur d'envoi (email, SMS, WhatsApp, téléphone, agenda) n'est branché.

Ce que cela implique : **rien ne peut sortir du système aujourd'hui**, même en cas de bug applicatif —
il n'existe aucun code capable d'émettre un message réel.

---

## 2. Ce qui est couvert

### 2.1 Isolation entre agences (le risque n°1 du produit)

- Les **12 tables métier** (`agencies`, `memberships`, `contacts`, `properties`, `consents`,
  `appointments`, `outbound_messages`, `activities`, `ai_agent_runs`, `ai_agent_run_steps`, `tasks`,
  `inbound_leads`) portent un `agency_id` et ont **RLS activée** (vérifié directement dans `pg_class`).
- Toutes les politiques passent par `private.member_agency_ids()` / `private.director_agency_ids()`,
  qui lisent l'appartenance réelle de la **session** (`auth.uid()`). **Aucune politique `using (true)`,
  aucune politique ne lit une valeur envoyée par le navigateur** (vérifié dans `pg_policies`).
- Le rôle `anon` n'a **aucun privilège** sur aucune table du schéma `public` (vérifié dans
  `information_schema.role_table_grants`). Les formulaires publics passeront par du code serveur.
- Les fonctions d'aide vivent dans le schéma `private`, **non exposé par l'API** (PostgREST ne sert que
  `public` et `graphql_public`) : elles ne sont appelables ni en RPC, ni via l'en-tête `Content-Profile`.
- **Intégrité inter-agences en profondeur** : clés étrangères composites `(agency_id, <fk>)`, donc un
  bien, un rendez-vous, un message ou une tâche ne peut pas être rattaché au contact d'une autre agence,
  même si RLS venait à être mal configurée.
- `agency_id` est **immuable** après création (trigger), y compris pour le rôle de service.

**Testé, pas supposé** : `lib/supabase/database-isolation.integration.test.ts` exécute, avec de vrais
utilisateurs authentifiés, la matrice **12 tables × 4 opérations (lire / créer / modifier / supprimer)
× 2 directions (A → B et B → A)**, plus l'accès anonyme. Chemins détournés vérifiés lors de l'audit :
jointures imbriquées PostgREST, endpoint GraphQL, en-tête `x-agency-id` forgé, RPC avec un `agency_id`
nul ou étranger, table `auth.users`, buckets de stockage.

### 2.2 Authentification et autorisations

- L'espace connecté est fermé côté serveur (`app/(app)/layout.tsx`, `auth.getUser()` qui revalide le
  jeton). Sans session : redirection, aucun rendu.
- Ce n'est **pas** la frontière de sécurité : chaque lecture (`features/*/queries.ts`) et chaque server
  action re-résout la session et l'`agency_id` côté serveur, et RLS reste la dernière ligne.
- Rôles : seul un **directeur** peut supprimer un contact (effacement RGPD) ou réactiver les agents IA
  après un coupe-circuit. Un agent ne peut ni se promouvoir, ni ajouter ou retirer un membre
  (`memberships` est en lecture seule pour les utilisateurs).
- **Inscription en self-service fermée** (`supabase/config.toml`, `[auth].enable_signup = false`) : les
  comptes d'agence sont créés à l'accueil client. Longueur minimale de mot de passe portée à 12.
- Les mots de passe sont gérés et hachés par Supabase Auth ; **aucun mot de passe en dur** nulle part,
  y compris dans les fixtures (générés aléatoirement, écrits dans un fichier ignoré par git).
- Le message d'erreur de connexion est identique pour « email inconnu » et « mot de passe faux ».

### 2.3 Secrets

- Aucun secret dans le code, les fixtures, les migrations ou les messages d'erreur (recherche de motifs
  `sb_secret_`, `sb_publishable_`, `eyJ…`, `sk-ant-`, mots de passe littéraux).
- `.env.example` ne contient que des **noms** de variables.
- Seules `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sont exposées au
  navigateur : ce sont des valeurs publiques par conception, et elles restent soumises à RLS.
- `.gitignore` couvre `.env`, `.env.*` (sauf `.env.example`), `fixtures/.generated-credentials.json`,
  `supabase/.temp/` et `*.pem`. Vérifié avec `git ls-files` et `git check-ignore` : **aucun fichier
  d'environnement n'est suivi ni sur le point de l'être**.
- **Clé `service_role`** (`lib/supabase/admin.ts`) : `import "server-only"` (la compilation échoue si un
  composant client l'importe) **et** garde d'exécution qui refuse tout contexte navigateur. Elle n'est
  utilisée par **aucun chemin déclenché par une requête utilisateur** : seuls le chargeur de fixtures
  local et les tests d'intégration l'emploient, et tous deux refusent de s'exécuter contre autre chose
  que `127.0.0.1:54321` / `localhost:54321` et avec `NODE_ENV=production`.

### 2.4 Entrées, injections, en-têtes

- **Validation** : sorties d'IA validées par des schémas zod stricts ; arguments des server actions
  validés par zod au runtime (`lib/agents/input.ts`) — une signature TypeScript ne protège rien sur un
  endpoint public.
- **Injection SQL** : uniquement le client Supabase (requêtes paramétrées), aucun SQL concaténé.
- **XSS** : aucun `dangerouslySetInnerHTML`, aucun `eval` ; React échappe tout le contenu affiché.
- **CSRF** : les server actions Next.js sont protégées nativement ; les seules routes API sont les
  trois webhooks, qui ne traitent rien (voir 3.2).
- **Redirection ouverte** : `?suivant=` filtré par `lib/utils/safe-redirect.ts` (rejette `//`, `/\`,
  les antislashs et les caractères de contrôle, plage exacte `\u0000`-` ` (espace comprise) et
  `\u007F`).
- **Garde-fous écrits en octets bruts, corrigés (22/09/2026)** : `features/agents-ia/types.ts`
  (`cleanDraftText`), `lib/utils/safe-redirect.ts` (`FORBIDDEN_CHARACTERS`) et leurs tests
  contenaient des caractères de contrôle **écrits en octets bruts dans le source** (NUL, ESC, US,
  DEL) plutôt qu'en séquences d'échappement `\uXXXX`. Conséquence corrigée : Git et les outils de
  recherche voyaient ces fichiers comme binaires (`file` les classait `data`), ce qui les rendait
  illisibles en revue et exposés à une corruption silencieuse par un éditeur ou un formateur — un
  risque direct pour deux garde-fous de sécurité. Remplacés par leurs échappements textuels, à
  comportement runtime strictement identique (vérifié par test).
- **En-têtes de sécurité** : appliqués à **toutes** les réponses via `next.config.ts` — CSP
  (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`, `connect-src` limité au site et au projet Supabase), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`, et `Strict-Transport-Security` **en production uniquement**.
  `X-Powered-By` est désactivé. Vérifié sur de vraies réponses HTTP (`e2e/en-tetes-securite.spec.ts`).

### 2.5 Agents IA

- Le texte écrit par un prospect est **toujours une donnée, jamais une instruction** : il est isolé dans
  des blocs `<donnee_non_fiable>`, précédé d'une consigne explicite, avec la balise **neutralisée à
  l'intérieur du contenu** (impossible de « fermer » le bloc) et une taille bornée.
- Les décisions à conséquence sont prises **par le code** : les créneaux libres sont calculés par le
  code et proposés à l'IA sous forme de **liste fermée**, et le créneau retenu est relu depuis la carte
  du code, jamais depuis la réponse du modèle.
- Toute sortie d'IA passe par un **schéma zod strict** (`strictObject` : une clé en trop invalide la
  réponse entière). Une réponse invalide ⇒ **aucune écriture métier**, une tâche pour un humain, et une
  exécution journalisée en `failed`. Les schémas ne contiennent **aucun champ** permettant de décider
  d'une étape du pipeline, d'un destinataire, d'un canal ou d'un envoi.
- **Coupe-circuit** (`agencies.ai_paused`) et **limite quotidienne** par agence : vérifiés par le code
  *et* par la base (trigger sous verrou de ligne, donc deux exécutions concurrentes ne peuvent pas
  dépasser la limite). Une tentative refusée est journalisée en `blocked`. Le panneau de
  `/agents-ia` permet à tout membre de suspendre les agents ; seul un directeur peut les réactiver.
- **Reprise en main humaine** (`contacts.human_takeover`) : aucune action automatique.
- Chaque exécution est journalisée (`ai_agent_runs`) avec entrée (métadonnées seulement, jamais le texte
  libre du prospect), sortie, décision, fournisseur, modèle et tokens — le suivi de coût par agence
  existe dès maintenant.
- **Aucun agent n'invente une information manquante** : champ à `null` + tâche « information manquante ».
- L'auteur d'une entrée d'historique **ne peut pas être forgé** : un utilisateur ne peut pas écrire une
  ligne `activities` attribuée à un agent IA ou au système, et le drapeau `is_simulation` d'une entrée
  IA est **estampillé par le serveur** depuis l'exécution réellement en cours
  (migration `20260916150000_activity_actor_guard.sql`).
- **Journal d'étapes en ajout seul** (`ai_agent_run_steps`, migration `20260916161000`) : `UPDATE`,
  `DELETE` et `TRUNCATE` refusés à tous les rôles non superutilisateur, service role compris. Les
  durées affichées par l'interface sont **recalculées par la base** à partir des instants enregistrés
  (`duration_ms` est ignoré s'il vient du client) et une étape ne peut pas être datée dans le futur :
  le rejeu animé d'une exécution repose donc sur des mesures, jamais sur une mise en scène.
- **Valeur estimée d'un bien jamais écrite par une IA** (`properties.estimated_value_eur`, migration
  `20260916160000`) : la base refuse l'écriture tant qu'une exécution d'agent de la session appelante
  est ouverte, et la provenance (`source`, `recorded_at`, `recorded_by`) est **estampillée par le
  serveur** puis figée. Limite connue : le lien se fait sur `triggered_by_user_id = auth.uid()` (voir
  `docs/architecture.md`).
- **Compte-rendu de rendez-vous** (`appointments.report_*`, migration `20260916163000`) : auteur et
  date estampillés par le serveur, les trois colonnes renseignées ou absentes ensemble.
- Tests d'injection réels sur **les cinq agents** : `lib/claude/prompt.test.ts`, les `schema.test.ts`
  de chaque agent, les simulations (`lib/claude/simulations/*.test.ts`) et les tests d'intégration
  `hugo.`, `louis.`, `lea.`, `emma.`, `sarah.integration.test.ts` (charge « ignore tes instructions
  précédentes… », avec demande d'envoi de masse, de fusion de fiches, de mandat signé et de montant
  inventé selon l'agent).

### 2.6 Garde-fous produit et conformité (partie couverte)

- **Aucun envoi sans consentement valide** : le consentement courant du canal est vérifié **au moment de
  l'envoi** par un trigger de la base, pas seulement par l'application.
- **Premier contact validé par un humain** : un message ne peut passer à `sent_simulated` sans
  validation humaine tant qu'aucun message n'a déjà été envoyé à ce contact. La validation est
  **estampillée par le serveur** (`validated_by` ne peut être que l'appelant).
- **Registre des consentements en ajout seul** : `UPDATE`, `DELETE` et `TRUNCATE` sont refusés à tous les
  rôles non superutilisateur, **service role compris** ; seule la cascade de suppression de l'agence
  (clôture de compte) est acceptée. Un consentement accordé **exige** le texte présenté, sa version et
  une preuve (contrainte de base). Un consentement ne peut pas être daté dans le futur.
- **Aucun double envoi** : clé d'idempotence unique par agence ; un message envoyé est immuable.
- **Aucune double réservation** : contrainte d'exclusion GiST sur (agence, conseiller, plage horaire).
- **Preuve de rendez-vous non effaçable directement** : les membres peuvent faire progresser un
  rendez-vous dans la machine d'état, mais n'ont plus le privilège `DELETE` sur `appointments`. Un
  rendez-vous réalisé et son compte-rendu restent donc intacts. L'effacement RGPD par un directeur
  part toujours du contact et conserve la cascade de clé étrangère.
- **Mandat signé jamais auto-déclaré par une IA** : Hugo ne peut sortir que de `nouveau`/`qualifie`, et
  seulement vers `qualifie`/`chaud` ; Louis et Emma ne changent aucune étape ; **Sarah** ne peut écrire
  qu'une seule étape, `estimation_faite`, choisie par le code dans une liste blanche
  (`SARAH_ALLOWED_TARGET_STAGES`) et revérifiée juste avant l'écriture. Aucun schéma de sortie n'a de
  champ d'étape. Un **humain** peut bien sûr passer un contact en `mandat_signe` : c'est exactement ce
  que la règle produit demande. Testé sur des comptes-rendus malveillants
  (`features/agents-ia/sarah-suivi/sarah.integration.test.ts`).
- **Une décision humaine concurrente gagne toujours sur Sarah** : son écriture vers
  `estimation_faite` vérifie encore l'étape qu'elle avait lue avant l'appel IA. Si un conseiller passe
  entre-temps le dossier à `mandat_signe`, `perdu` ou une autre étape, l'update ne touche aucune ligne,
  le run échoue explicitement et l'étape humaine reste intacte.
- **Aucun montant en euros écrit par une IA, même en texte libre** : en plus du refus de la base sur
  `properties.estimated_value_eur`, les schémas d'Emma, de Louis et de Sarah rejettent tout montant en
  euros dans un message, un résumé, une objection ou une tâche (`noMoney`, `lib/claude/schemas.ts`).
  Sarah dit seulement qu'une estimation *a été présentée*, jamais laquelle. Louis en avait été oublié
  jusqu'au 22/09/2026 : son schéma ne portait pas le garde-fou alors qu'annoncer un prix à un vendeur
  est une promesse explicite du produit — corrigé, couvert par `louis-rendez-vous/schema.test.ts`.
- **Injection d'en-tête d'email impossible depuis un objet rédigé par l'IA (22/09/2026)** : l'objet
  (`message_subject`) écrit par Emma et par Louis deviendra un en-tête d'email le jour où un vrai
  fournisseur sera branché, et le corps du message est assemblé à partir de valeurs CRM que le
  prospect peut influencer. Deux garde-fous partagés (`noControlCharacters`, `singleLine`,
  `lib/claude/schemas.ts`) interdisent désormais tout caractère de contrôle dans l'objet et le corps,
  et imposent que l'objet tienne sur **une seule ligne** (aucun `\r\n`, méthode classique pour
  glisser un `Bcc:` caché). Le corps conserve volontairement les sauts de ligne et les tabulations
  d'un message légitime. Couvert par `emma-relation/schema.test.ts` et
  `louis-rendez-vous/schema.test.ts`.
- **Dédoublonnage jamais confié à un modèle** : Léa rapproche deux fiches par correspondance **exacte**
  de l'email et du téléphone normalisés, dans le code (`lea-acquisition/dedupe.ts`). Son schéma de
  sortie n'a aucun champ permettant d'affirmer que deux personnes sont la même, et le nom n'est jamais
  une clé de rapprochement. Une fusion silencieuse de deux vendeurs différents est donc impossible.
- **Un lead n'ouvre aucun droit à contacter quelqu'un** : la fiche créée par Léa arrive **sans aucun
  consentement**, et une tâche `collect_consent` est ouverte. Aucun envoi n'est possible tant qu'un
  consentement prouvable n'est pas enregistré et vérifié à l'envoi par la base.
- **Aucune relance sans consentement valide au moment de la rédaction** : Emma vérifie le consentement
  courant du canal (vue `current_consents`) **avant** d'appeler le modèle ; sans lui, aucun brouillon
  n'est écrit et une tâche est ouverte. Un consentement retiré invalide le canal, et un consentement
  `phone` n'autorise jamais un message.
- **Mention de désinscription impossible à supprimer par le contenu du prospect** : la mention est
  ajoutée par le code (`lib/agents/consent.ts`) à tout message qui ne porte pas déjà une **consigne**
  de désinscription. Jusqu'au 22/09/2026 la détection se contentait du mot `STOP` : une valeur
  contrôlée par le prospect et recopiée dans le corps (prénom, nom de l'agence, texte repris par le
  modèle) suffisait à faire sauter une mention légalement obligatoire. Corrigé et couvert par
  `lib/agents/consent.test.ts` et `features/agents-ia/emma-relation/emma.integration.test.ts`
  (prénom `« STOP Jean »`).
- **L'écran de relances ne décide rien** : `listEmmaFollowUpCandidates` (lecture) ne sert qu'à
  l'affichage ; `prepareFollowUp` revérifie session, agence, coupe-circuit, quota, reprise humaine,
  étape, double brouillon et consentement courant au moment du clic. La RLS reste la frontière : la
  lecture le prouve sans son filtre applicatif dans
  `features/agents-ia/emma-follow-ups.integration.test.ts`.
- **Aucun double brouillon de relance** : garanti deux fois — par le code (un brouillon déjà en attente
  bloque une seconde exécution) et par la base (clé d'idempotence `emma-<contact>-<jour parisien>`,
  unique par agence).
- **Envoi impossible sans validation humaine explicite** : le passage `pending_validation` →
  `approved` → `sent_simulated` est en trois étapes séparées, et valider n'envoie pas. Un brouillon
  non validé est refusé côté code (`outbound_message_not_approved`) puis côté base
  (`first_contact_requires_human_validation`). `validated_by` est estampillé avec l'appelant par la
  base, jamais accepté depuis le client.
- **Refus tracé** : refuser un brouillon exige un **motif d'une liste fermée** (validé par zod côté
  serveur), plus un commentaire libre facultatif borné à 300 caractères et nettoyé de ses caractères
  de contrôle. Motif et commentaire sont écrits dans `activities` (en ajout seul) avec l'auteur humain
  estampillé par la base. Un motif hors liste est refusé (`invalid_reason`) et le brouillon reste en
  attente : aucune décision n'est enregistrée sans sa justification.
- **Correction avant validation** : l'écran permet de modifier uniquement l'objet et le corps via
  `updateDraftContent`. L'entrée est validée et bornée par zod, la lecture et l'écriture sont limitées
  à l'agence de l'appelant, et un message corrigé revient toujours à `pending_validation`. Corriger un
  message déjà approuvé annule donc son approbation ; un message refusé ou envoyé reste final.
- **Aucun chiffre inventé sur l'écran « Agents IA »** : tous les compteurs sont des agrégats SQL
  exacts sur des fenêtres parisiennes nommées, `runsToday` compte exactement ce que compte le
  garde-fou de la base pour la limite quotidienne, et **une lecture en erreur n'est jamais affichée
  comme un zéro** — la lecture entière échoue et l'écran doit montrer l'erreur (tests :
  `features/agents-ia/activity.test.ts`, `data.test.ts`, `dashboard.integration.test.ts`, ce dernier
  comparant chaque compteur à un comptage direct, y compris au-delà de 500 exécutions dans la journée).
- **Un consentement valide hier n'est pas une permission aujourd'hui** : le consentement du canal est
  relu **au moment de l'envoi**. Un retrait survenu entre la validation et l'envoi bloque l'envoi
  (`consent_not_granted`) — testé explicitement dans `validation.integration.test.ts`.
- **« Envoyé » veut toujours dire simulé** : aucun fournisseur d'envoi n'est branché, et la base
  refuse tout envoi non marqué simulation (`outbound_messages_sent_is_simulation`).
- **Parcours complet testé de bout en bout** (`features/agents-ia/parcours-complet.integration.test.ts`) :
  lead → Léa → consentement recueilli par un humain → Hugo → Louis → validation et envoi humains →
  compte-rendu humain → Sarah → Emma. Le test vérifie surtout ce que la chaîne **ne fait pas** :
  aucun envoi sans validation, aucun contact passé en `mandat_signe` par un agent, et tout ce que
  produit un agent est marqué simulation.
- **Tout est marqué « simulation »**, dans l'interface (badge textuel, jamais une simple couleur) et
  dans les journaux (`is_simulation` sur `activities`, `appointments`, `outbound_messages`,
  `ai_agent_runs`). Un message « envoyé » ne peut l'être qu'en simulation (contrainte de base).
- **Un lead entrant n'est pas un consentement** : `inbound_leads` (migration `20260916162000`) stocke
  la matière brute saisie par un membre de l'agence, ou reçue par le formulaire public d'estimation
  (voir ci-dessous). Rien ne peut partir vers ces personnes tant qu'un consentement n'est pas
  enregistré dans `consents` **et rattaché à un contact**, vérifié à l'envoi par la base.
- **Pas d'extraction de portails tiers** : aucun scraping n'existe dans le code.

### 2.8 Formulaire public d'estimation (`/estimation`)

`anon` obtient, pour la première fois, un droit d'écriture — mais **jamais direct** : une seule
fonction (`public.submit_estimation_request`, migration `20260922120000_public_estimation_request.sql`,
`SECURITY DEFINER`) reste la seule porte, et elle est conçue en supposant qu'elle sera appelée
**directement**, sans passer par `/estimation` ni par la server action (la clé `publishable` est
publique). Voir `docs/architecture.md` §3.1 pour le détail technique ; ici, ce qui est réellement
vérifié :

- **Agence et texte de consentement non falsifiables** : ni l'agence cible, ni le texte exact
  présenté par canal ne sont des paramètres de la fonction — ce sont des valeurs fixes lues dans le
  code SQL (`private.estimation_target_agency()`, `private.estimation_consent_text()`). Un appel
  direct au RPC ne peut ni rediriger une soumission vers une autre agence, ni forger ce qu'un
  visiteur a accepté.
- **Limitation de débit appliquée dans la base, pas seulement côté Next.js** : par empreinte IP
  (3 soumissions / 10 minutes) et par agence (30 / heure), comptée sur
  `private.estimation_submissions` — table du schéma `private`, absent de `schemas` dans
  `supabase/config.toml`, donc **injoignable par l'API Data même avec une clé valide**. Testé
  réellement : `features/estimation/estimation.integration.test.ts` pré-remplit cette table via une
  connexion Postgres directe et vérifie que la (n+1)ᵉ soumission est refusée, pour les deux plafonds.
  **Précision importante (audit du 23/09/2026)** : seul le plafond **par agence** résiste à un
  appelant direct du RPC. L'empreinte IP est un **paramètre** de la fonction (`p_ip_hash`) : qui
  appelle `submit_estimation_request` avec la clé publique choisit son compartiment et n'est donc
  borné que par les 30 soumissions/heure de l'agence. Vérifié en base pendant l'audit (27
  soumissions acceptées en variant l'empreinte à chaque appel, jusqu'au plafond d'agence). Le
  plafond par empreinte ne protège donc que contre un robot naïf qui passe par le formulaire.
- **En-tête `x-forwarded-for` : l'entrée choisie est celle ajoutée par notre propre proxy**
  (`TRUSTED_PROXY_HOPS`, `features/estimation/ip-hash.ts`). L'en-tête est une liste que le client
  commence et que chaque proxy complète : lire la **première** entrée, comme avant le 23/09/2026,
  laissait n'importe qui changer de compartiment de limitation de débit en préfixant une valeur
  inventée — y compris derrière un nginx correctement configuré. L'adresse est en plus normalisée
  (minuscules, sans `[...]` d'IPv6, sans `:port`, longueur bornée) pour qu'une même adresse écrite
  de plusieurs façons ne multiplie pas les compartiments. Couvert par `ip-hash.test.ts`.
- **Caractères de contrôle refusés des deux côtés** (audit du 23/09/2026) : un appelant direct
  pouvait enregistrer `first_name = "Jean\r\nBcc: attaquant@evil.test"` tel quel — une valeur que
  Léa recopie dans `contacts.first_name` et qui deviendra un en-tête d'email le jour où un
  fournisseur réel sera branché. `estimationRequestSchema` refuse maintenant tout caractère de
  contrôle (et tout saut de ligne dans un nom, une ville, un email), et la base refuse la même
  chose sur le chemin réellement emprunté par un attaquant
  (`private.guard_inbound_lead_text()`, migration `20260923090000_inbound_lead_text_guard.sql`,
  déclencheur sur `inbound_leads`) : l'exception annule toute la soumission (aucun lead, aucun
  consentement, aucune ligne de limitation de débit) et le visiteur reçoit le message de validation
  ordinaire. Les sauts de ligne d'un message libre restent acceptés. Couvert par
  `types.test.ts` et `estimation.integration.test.ts`.
- **Atomicité prouvée, pas supposée** : la fonction ne contient aucun `EXCEPTION WHEN` — une erreur
  n'importe où annule tout ce que l'appel a écrit. Le même test force, via un déclencheur temporaire
  propre à sa propre transaction (jamais persisté, même en cas de plantage), un échec pendant
  l'insertion d'un consentement, et vérifie qu'aucun `inbound_leads` orphelin ne subsiste.
- **Champ piège invisible** : vérifié en premier, rejeté avec le message générique de validation —
  une réponse identique à un formulaire normal mal rempli. Limite assumée : un attaquant qui appelle
  la fonction directement (donc sans jamais voir le champ) n'est pas ralenti par lui ; seule la
  limitation de débit le concerne alors.
- **Empreinte IP, jamais l'adresse** : SHA-256 salé (`ESTIMATION_IP_HASH_SALT`, variable serveur),
  calculé côté Next.js depuis les en-têtes de la requête — jamais depuis un champ du formulaire.
- **Aucun sel de repli, et rien n'est enregistré sans sel valide** : il n'existe **aucune valeur par
  défaut** dans le code (un sel codé en dur serait public, donc les empreintes seraient réversibles
  par force brute sur les 4 milliards d'adresses IPv4). Si `ESTIMATION_IP_HASH_SALT` est absente,
  vide ou plus courte que 32 caractères, la demande est refusée **avant la première écriture** :
  aucun `inbound_leads`, aucun `consents`, aucune ligne de limitation de débit. Le visiteur reçoit
  le message générique « indisponible » (aucun nom de variable, aucun indice qu'un secret manque),
  la cause exacte n'est écrite que dans les journaux serveur. Prouvé par comptage de lignes avant /
  après l'appel dans `features/estimation/estimation.integration.test.ts`, et sans appel réseau du
  tout dans `features/estimation/estimation.test.ts`.
- **`anon` ne peut toujours rien lire** : `inbound_leads`, `contacts`, `consents` restent interdits en
  lecture directe à `anon` — prouvé dans le même fichier de test, avec un client anonyme réel (pas
  supposé) — et le schéma `private` est totalement hors d'atteinte de l'API Data.
- **Léa traite le lead sans modification de son code** : vérifié pour de vrai (le test appelle
  `runLeaAcquisition` sur le lead que la fonction publique vient de créer et attend un contact créé).
- **Aucun prix ni fourchette ne peut sortir de ce chemin** : la fonction renvoie `void` ; il n'existe
  ni colonne ni champ de sortie où un montant pourrait apparaître.

**Ce que ce chemin ne couvre PAS**, honnêtement :

- **Pas de CAPTCHA, pas de WAF.** La seule défense contre un flot de robots est la limitation de
  débit décrite ci-dessus et le champ piège (faible contre un attaquant ciblé, voir plus haut).
- **L'empreinte IP est contournable en une ligne**, pas seulement avec un botnet : un appelant
  direct du RPC choisit la valeur de `p_ip_hash` (voir ci-dessus). Le plafond **par agence** borne
  alors les dégâts sans les empêcher : **30 soumissions par heure, soit jusqu'à ~720 faux leads par
  jour**, chacun avec des consentements enregistrés.
- **Le plafond par agence est aussi un levier de déni de service** : 30 requêtes suffisent à
  bloquer le formulaire pour **tous** les visiteurs légitimes pendant une heure — sur le principal
  canal d'acquisition de l'agence. Vérifié en base pendant l'audit du 23/09/2026. Atténuation
  nécessaire avant toute mise en ligne : limitation de débit **en frontal** (nginx/WAF) et/ou
  CAPTCHA, plus une alerte quand le plafond est atteint (rien n'avertit l'agence aujourd'hui).
- **Les soumissions refusées ne sont comptées par rien** : la ligne de limitation de débit est
  écrite dans la même transaction que le lead, donc une soumission rejetée (champ piège, validation,
  caractères de contrôle) est annulée avec le reste et ne consomme aucun quota. Un attaquant peut
  donc envoyer des requêtes invalides sans limite : seule une limitation en frontal y répond.
- **Comptage sans verrou** : le comptage puis l'insertion ne sont pas sérialisés, donc des appels
  strictement simultanés peuvent dépasser légèrement un plafond. Impact volontairement accepté
  (l'ordre de grandeur reste borné) ; à revoir si les plafonds deviennent un vrai contrôle de coût.
- **Rien ne vérifie que le visiteur possède l'adresse ou le numéro qu'il indique**, donc un tiers
  peut faire enregistrer un consentement au nom de quelqu'un d'autre (vérifié pendant l'audit). Le
  premier contact validé par un humain est l'unique filet ; la double confirmation (opt-in par email
  ou SMS) reste **obligatoire avant le premier envoi réel** — voir le point suivant.
- **Effacement RGPD d'un lead non traité** : un lead resté `pending` porte l'identité et les
  coordonnées de la personne sans être rattaché à un contact. La suppression d'un contact par un
  directeur ne l'atteint donc pas. Le privilège `DELETE` existe bien pour les membres sur
  `inbound_leads`, mais **aucun écran ni aucune procédure documentée** ne couvre ce cas, et le
  consentement pré-contact (en ajout seul) reste conservé comme preuve. À traiter avec la politique
  de conservation.
- **Champ piège et remplissage automatique du navigateur** : le champ invisible s'appelle `website`
  et porte `autocomplete="off"`, mais un gestionnaire de formulaires trop zélé pourrait le remplir
  et faire rejeter un visiteur **légitime**, sans aucun moyen pour lui de corriger (le champ est
  invisible). Risque de perte de lead, à surveiller par `frontend-ux` (nom de champ moins
  attrayant, `readonly`, ou détection côté client).
- **Aucune double confirmation (opt-in) par email ou SMS.** Un consentement enregistré par ce
  formulaire ne prouve que « quelqu'un a coché la case avec ces coordonnées », pas que le titulaire
  réel de l'adresse ou du numéro l'a fait. C'est une limite connue de tout formulaire public à simple
  opt-in — atténuée mais pas résolue par la limitation de débit.
- **`private.estimation_submissions` n'est jamais purgée automatiquement.** Aucune tâche planifiée
  n'existe dans ce prototype. Durée de conservation recommandée avant un vrai déploiement : quelques
  jours (assez pour couvrir les fenêtres de 10 minutes et 1 heure ci-dessus, pas plus) ; à mettre en
  œuvre avec un job planifié (`pg_cron` ou équivalent) avant toute mise en production.
- **Un consentement collecté avant qu'un contact existe n'autorise aucun envoi tant qu'il n'est pas
  rattaché.** Le rattachement automatique (`private.reconcile_lead_consents()`) n'a lieu que lorsque
  Léa (ou un humain) attache effectivement le lead à un contact ; un lead resté `pending` ou marqué
  `rejected` garde son consentement comme preuve seulement.
- **Un seul agent cible, en dur** (`private.estimation_target_agency()`) : adapté à ce prototype à une
  agence, pas à une publication multi-agences réelle — voir `docs/architecture.md`.

### 2.7 Dépendances

`npm audit` : **0 vulnérabilité** (22/09/2026). Dépendances peu nombreuses, toutes largement utilisées
et directement justifiées par la stack (`next`, `react`, `@supabase/*`, `zod`, `@date-fns/tz`,
`server-only`). Aucun SDK de fournisseur d'IA payant n'est installé.
**Toutes les dépendances sont épinglées à une version exacte** (`package.json` et `package-lock.json`) :
`@radix-ui/react-icons` portait encore un intervalle (`^1.3.2`), seule exception restante,
corrigée le 22/09/2026 — une version exacte partout évite qu'une mise à jour mineure non revue
change silencieusement ce qui est réellement installé.

---

## 3. Ce qui n'est PAS couvert aujourd'hui

### 3.1 Limitation de débit et anti-spam

Le formulaire public d'estimation a désormais une limitation de débit par empreinte IP et par
agence, et un champ piège — voir §2.8 pour ce qui est couvert et testé, et ses limites honnêtes
(pas de CAPTCHA, pas de WAF, empreinte IP contournable, pas de purge automatique de
`private.estimation_submissions`). La connexion, elle, s'appuie sur les limites intégrées de
Supabase Auth ; aucune limitation de débit dédiée n'existe pour `/connexion`.

### 3.2 Webhooks

`app/api/webhooks/{whatsapp,sms,logiciel-immo}/route.ts` répondent `501 Not Implemented` et **ne lisent
même pas le corps de la requête** : ils ne présentent aucun risque en l'état (ni traitement, ni écriture,
ni divulgation). Quand un fournisseur sera branché : vérification de signature **avant** toute lecture
de la charge utile, validation zod, idempotence, réponse rapide et traitement en tâche de fond.

### 3.3 Conformité — parties non encore implémentées

- **Désinscription** : la base sait enregistrer un retrait de consentement et le respecte à l'envoi,
  mais il n'existe **ni lien de désinscription, ni mot-clé STOP, ni écran de retrait**. À faire avec le
  premier canal réel.
  **Attention (audit du 23/09/2026)** : les textes de consentement enregistrés comme preuve
  (`features/estimation/consent-texts.ts`) et la page `politique-confidentialite` **annoncent** ces
  moyens de retrait (« lien de désinscription présent dans chaque message », « en répondant STOP »).
  C'est une promesse faite au visiteur que le code ne tient pas encore. Acceptable tant que rien
  n'est mis en ligne et que la page affiche son avertissement « prototype de démonstration » ;
  **à corriger ou à implémenter avant la première mise en ligne** (décision produit + revue
  juridique), sans quoi la preuve de consentement décrit un dispositif inexistant.
- **Horaires d'appel et plafond de 4 appels par mois** : aucune fonctionnalité d'appel n'existe
  (`outbound_messages` interdit explicitement le canal `phone`). À implémenter avec la téléphonie.
- **Cases de consentement non précochées** : le contrat serveur est prêt (`features/estimation/`,
  `EstimationConsentChoices`, aucune valeur par défaut à `true`) et le stockage du texte versionné et
  de la preuve est en place et obligatoire (voir §2.8). **L'écran `/estimation` lui-même reste à
  construire par `frontend-ux`** : c'est lui qui devra afficher des cases réellement non précochées.
- **Durées de conservation, purge automatique, export des données d'une personne** : non implémentés.
  L'effacement est possible (suppression d'un contact par un directeur, cascade), mais il n'y a ni
  export RGPD, ni politique de rétention, ni **journal des accès sensibles**. S'y ajoute désormais
  `private.estimation_submissions` (empreintes IP hachées pour la limitation de débit), jamais purgée
  automatiquement — voir §2.8.
### 3.4 Limites techniques connues

- **La CSP autorise encore `'unsafe-inline'` pour les scripts**, parce que Next.js injecte des scripts
  d'amorçage en ligne. S'en passer demande un nonce généré par requête dans un `middleware.ts`. La
  politique actuelle élève la barre (aucune origine de script externe, pas d'`eval` en production) mais
  **ne prétend pas arrêter toutes les XSS**.
- **Pas de MFA** pour les comptes d'agence.
- **Traçabilité des auteurs** : l'auteur d'une entrée d'historique est fiable (voir 2.5) ; en revanche
  `tasks.created_by_agent` et `outbound_messages.created_by_agent` restent déclaratifs — un membre peut
  créer une tâche ou un brouillon en l'attribuant à un agent IA. Impact faible (ces lignes sont
  modifiables et ne constituent pas la preuve d'une action), à durcir de la même façon plus tard.
- **Atomicité du suivi de Sarah** : les erreurs de création de tâche ou d'activité sont désormais
  vérifiées et empêchent de déclarer le run réussi. L'étape, les tâches et l'activité restent toutefois
  écrites par plusieurs requêtes PostgREST : une panne après le changement d'étape peut laisser un
  suivi partiel, clairement marqué en échec. Le durcissement complet demande un RPC transactionnel
  unique qui applique l'étape avec verrou optimiste, crée les tâches idempotentes et ajoute l'activité.
- **Pas de journal d'audit des accès en lecture** (qui a consulté quelle fiche).
- **L'écran de relances n'affiche pas le coupe-circuit** : `EmmaFollowUpCandidateView.canPrepare` ne
  lit pas `agencies.ai_paused`. Un dossier apparaît donc « prêt » alors que l'agence a suspendu ses
  agents ; le clic est refusé côté serveur, journalisé en `blocked` avec son étape explicative, et
  l'écran affiche le refus. Défaut d'ergonomie et de confiance dans le coupe-circuit, pas de faille :
  aucun écran ne peut de toute façon être autoritaire (la pause peut survenir entre l'affichage et le
  clic).
- **Un accès à un contact d'une autre agence n'est pas journalisé** : la réponse est générique
  (`contact_not_found`, identique à « n'existe pas »), mais aucune trace n'est écrite — il n'y a donc
  pas de détection d'un balayage d'identifiants. À traiter avec le journal des accès sensibles.
- **Aucune règle de lint n'interdit d'importer `e2e/` ou `fixtures/` depuis le code applicatif.** Les
  outils qui utilisent la clé de service (`e2e/helpers/local-supabase.ts`,
  `lib/supabase/testing/`) sont protégés à l'exécution (`assertNotProduction` +
  `assertLocalSupabaseUrl`), mais la barrière reste conventionnelle à la compilation.
- Aucun test de charge, aucune revue d'infrastructure : hors périmètre de ce skill et de ce prototype.

---

## 4. Obligatoire avant tout déploiement réel (VPS)

Rien de ce qui suit n'est fait : le prototype n'est pas déployé.

1. **HTTPS obligatoire** (certificat valide, redirection HTTP → HTTPS, HSTS déjà prévu en production).
2. **Base de données non exposée à Internet** : port Postgres fermé au public, accès par réseau privé ou
   tunnel, comptes applicatifs distincts et à privilèges minimaux.
3. **Sauvegardes chiffrées, testées et restaurées au moins une fois**, conservées hors de la machine de
   production.
4. **Secrets hors du dépôt et hors de l'image** : variables d'environnement du serveur ou coffre dédié ;
   rotation prévue. **Toute clé exposée doit être révoquée et régénérée**, jamais simplement effacée.
5. **Mises à jour de sécurité** du système et des dépendances, `npm audit` à chaque livraison.
6. **Journalisation et supervision** : erreurs serveur, tentatives de connexion échouées, exécutions IA
   bloquées — sans jamais écrire de secret ni de donnée personnelle superflue dans les journaux.
7. **Limitation de débit** en frontal (formulaires publics et connexion).
8. **Revue juridique** du parcours de consentement, des textes présentés, de la durée de conservation et
   de l'information des personnes, **avant le premier contact réel**.
9. **Budget et clé d'API IA dédiés** au produit, séparés de l'abonnement de développement, avec plafond
   de dépense. Tant qu'ils n'existent pas, `AI_PROVIDER` reste `simulator` (tout autre valeur est
   refusée par le code, aucun repli silencieux vers un service payant).
10. **MFA au minimum pour les comptes directeur**, et procédure de départ d'un collaborateur.

---

## 5. Historique des revues

| Date | Portée | Résultat |
|---|---|---|
| 2026-09-16 | Branche `feat/init-prototype`, audit complet (isolation, RLS, secrets, `service_role`, validation, injection de prompt, garde-fous produit, RGPD, en-têtes HTTP, dépendances) | Aucun problème critique. 1 problème élevé et 3 moyens corrigés (en-têtes de sécurité non appliqués, forge de l'auteur d'une entrée d'historique, inscription self-service ouverte, longueur minimale de mot de passe). Livraison autorisée. |
| 2026-09-22 | Jalon « Relances Emma » : `/agents-ia/relances`, `listEmmaFollowUpCandidates`, `prepareFollowUp`, `AgentActionsPanel`, helper E2E `clearEmmaArtefacts` | Aucun problème critique. 1 problème élevé corrigé (mention de désinscription supprimable par une donnée contrôlée par le prospect, `lib/agents/consent.ts`). Isolation, coupe-circuit, consentement, premier contact humain et injection de prompt vérifiés. Restent 4 points faibles documentés en 3.4. Livraison autorisée. |
| 2026-09-23 | Audit dédié du **formulaire public d'estimation** (`feat/public-estimation`) : `features/estimation/`, `app/(marketing)/estimation`, `politique-confidentialite`, migration `20260922120000`, privilèges réels de `anon` en base | Aucun problème critique. Isolation vérifiée **en base** : `anon` n'a aucun privilège de table dans `public`/`private`, aucun accès au schéma `private`, une seule fonction exécutable ; texte de consentement identique caractère par caractère entre SQL et TypeScript (196/154/150/231 caractères) ; `current_consents` exclut les consentements sans contact ; `guard_outbound_message` n'autorise aucun envoi depuis un consentement sans contact. **2 corrections** : entrée `x-forwarded-for` choisie (contournement du plafond par empreinte IP même derrière un proxy) et caractères de contrôle acceptés dans les noms (injection d'en-tête d'email en aval) — corrigée côté zod **et** côté base (migration `20260923090000`). **Non corrigé, assumé et documenté** : empreinte IP choisie librement par un appelant direct du RPC, plafond d'agence utilisable comme déni de service, absence de double opt-in, promesse de désinscription non implémentée. 927 → 939 tests verts. |
| 2026-09-22 | Réconciliation `feat/agents-et-ecrans-reconcile` : rejeu chirurgical de 3 correctifs identifiés sur la branche de sauvegarde locale (sans écraser le travail distant, dont `hasOptOutInstruction`) | Octets de contrôle bruts remplacés par leurs échappements dans 3 fichiers dont 2 garde-fous (`features/agents-ia/types.ts`, `lib/utils/safe-redirect.ts`, leurs tests). `noMoney` ajouté au schéma de Louis (oublié jusqu'ici). Deux garde-fous partagés `noControlCharacters`/`singleLine` ajoutés contre l'injection d'en-tête d'email dans les objets d'Emma et de Louis. `@radix-ui/react-icons` épinglé en version exacte. 813 → 822 tests verts (`tsc`, lint et Vitest silencieux/verts), aucune régression. |
