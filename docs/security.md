# Sécurité — état des lieux

**Dernière revue** : 2026-09-16 — audit complet de la branche `feat/init-prototype` (tâche 7 du plan
`docs/plans/2026-09-15-init-prototype.md`), par l'agent `cybersecurite`.

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
  les antislashs et les caractères de contrôle).
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
  `properties.estimated_value_eur`, les schémas d'Emma et de Sarah rejettent tout montant en euros dans
  un message, un résumé, une objection ou une tâche (`noMoney`, `lib/claude/schemas.ts`). Sarah dit
  seulement qu'une estimation *a été présentée*, jamais laquelle.
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
  la matière brute saisie par un membre de l'agence. Rien ne peut partir vers ces personnes tant
  qu'un consentement n'est pas enregistré dans `consents` et vérifié à l'envoi par la base. `anon`
  n'a toujours aucun privilège : il n'existe pas encore de formulaire public alimentant cette table.
- **Pas d'extraction de portails tiers** : aucun scraping n'existe dans le code.

### 2.7 Dépendances

`npm audit` : **0 vulnérabilité** (16/09/2026). Dépendances peu nombreuses, toutes largement utilisées
et directement justifiées par la stack (`next`, `react`, `@supabase/*`, `zod`, `@date-fns/tz`,
`server-only`). Aucun SDK de fournisseur d'IA payant n'est installé.

---

## 3. Ce qui n'est PAS couvert aujourd'hui

### 3.1 Limitation de débit et anti-spam

Aucun formulaire public n'existe encore (la page d'estimation est une coquille). La connexion s'appuie
sur les limites intégrées de Supabase Auth. **Dès que le formulaire d'estimation sera écrit**, il faudra :
limitation de débit par IP et par agence, anti-spam (pot de miel et/ou captcha), et bornes de taille.

### 3.2 Webhooks

`app/api/webhooks/{whatsapp,sms,logiciel-immo}/route.ts` répondent `501 Not Implemented` et **ne lisent
même pas le corps de la requête** : ils ne présentent aucun risque en l'état (ni traitement, ni écriture,
ni divulgation). Quand un fournisseur sera branché : vérification de signature **avant** toute lecture
de la charge utile, validation zod, idempotence, réponse rapide et traitement en tâche de fond.

### 3.3 Conformité — parties non encore implémentées

- **Désinscription** : la base sait enregistrer un retrait de consentement et le respecte à l'envoi,
  mais il n'existe **ni lien de désinscription, ni mot-clé STOP, ni écran de retrait**. À faire avec le
  premier canal réel.
- **Horaires d'appel et plafond de 4 appels par mois** : aucune fonctionnalité d'appel n'existe
  (`outbound_messages` interdit explicitement le canal `phone`). À implémenter avec la téléphonie.
- **Cases de consentement non précochées** : le formulaire d'estimation n'existe pas encore ; la règle
  devra être appliquée et testée à ce moment-là. Le stockage du texte versionné et de la preuve est déjà
  prêt et obligatoire.
- **Durées de conservation, purge automatique, export des données d'une personne** : non implémentés.
  L'effacement est possible (suppression d'un contact par un directeur, cascade), mais il n'y a ni
  export RGPD, ni politique de rétention, ni **journal des accès sensibles**.
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
