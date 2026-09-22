# Workflows des agents IA

Source de vérité des workflows d'AiaA. **Tout** agent (Léa, Hugo, Emma, Louis, Sarah ou un futur
agent) est documenté ici avec les **9 champs obligatoires** définis dans `CLAUDE.md` :
déclencheur, entrées, étapes, outils utilisés, sorties, condition de passage à l'étape/agent
suivant, conditions d'arrêt, gestion des erreurs, critères de réussite.

Règle valable pour tous : **l'IA rédige et classe, le code décide et écrit.** Aucun agent ne
choisit une étape de pipeline, un destinataire, un canal, un envoi, une date ou une confirmation :
ces champs n'existent pas dans les schémas de sortie.

État : **simulateur** (`AI_PROVIDER=simulator`). Aucun appel payant, aucun envoi réel.
Tout ce qui est produit est marqué `is_simulation`.

---

## Gabarit

```
### Déclencheur
### Entrées
### Étapes
### Outils utilisés
### Sorties
### Condition de passage à l'étape / à l'agent suivant
### Conditions d'arrêt
### Gestion des erreurs
### Critères de réussite
```

---

## Hugo — qualification

> Mission : à partir du dossier CRM, identifier le bien, le secteur, la motivation de vente et le
> délai du projet. Ne rien inventer.
>
> Code : `features/agents-ia/hugo-qualification/` · Entrée : `qualifyContact(contactId)`

### Déclencheur
Action humaine depuis la fiche contact (bouton « Lancer Hugo »), via la server action
`qualifyContact(contactId)`. Aucun déclenchement automatique à ce stade.

### Entrées
- Le contact de l'agence de l'appelant : étape, source, présence d'un email / téléphone, motivation
  et délai déjà connus (données CRM **fiables**).
- Le premier bien rattaché au contact, s'il existe : type, ville, secteur, code postal, surface,
  pièces.
- Les 5 dernières entrées d'historique (`activities`).
- Le texte libre du prospect (`contacts.notes`) et les résumés d'historique : **données non
  fiables**, isolées dans des blocs `<donnee_non_fiable>`.
- Prompt système versionné : `hugo-qualification-2026-09-v1`.

### Étapes
1. Vérifier le format de l'identifiant ; sinon « Contact introuvable. ».
2. Résoudre la session et l'agence côté serveur (`resolveAgentContext`).
3. Garde-fous (`startGuardedRun`) : appartenance du contact à l'agence, coupe-circuit,
   limite quotidienne, reprise humaine. Ouvrir le run dans `ai_agent_runs`.
4. Lire le bien et l'historique récent.
5. Construire le prompt : faits CRM d'un côté, texte du prospect isolé de l'autre.
6. Appeler le fournisseur IA, valider la sortie avec le schéma zod (2 tentatives maximum).
7. **Fusion (code)** : une valeur déjà présente dans le CRM gagne toujours ; Hugo ne comble que les
   trous et n'écrit jamais `null` par-dessus une valeur existante.
8. **Décision d'étape (code)** : voir « condition de passage » ci-dessous.
9. Écrire les colonnes comblées (`contacts`, `properties`), ouvrir une tâche humaine si nécessaire,
   écrire l'entrée d'historique, clôturer le run.

### Outils utilisés
`lib/agents/context.ts` · `lib/agents/runner.ts` · `lib/agents/ai-task.ts` · `lib/agents/journal.ts`
· `lib/claude/` (interface fournisseur + simulateur) · tables `contacts`, `properties`,
`activities`, `tasks`, `ai_agent_runs`.

### Sorties
- Sortie IA validée : `property_type`, `city`, `sector`, `sale_motivation`, `sale_timeline`
  (enums fermés ou `null`), `missing_fields`, `confidence`, `summary`.
- Écritures : colonnes de qualification comblées ; `contacts.stage` éventuellement avancé.
- Une ligne `activities` (`ai_qualification_done`, `ai_information_missing` ou
  `ai_qualification_to_review`), attribuée à Hugo et marquée simulation.
- Éventuellement une tâche humaine (`missing_information` ou `qualification_to_review`).
- Une ligne `ai_agent_runs` avec entrée, sortie, décision, fournisseur, modèle et tokens.
- Résultat applicatif : `{ data: HugoRunResult, error: null }`.

### Condition de passage à l'étape / à l'agent suivant
Les quatre champs requis (type de bien, ville, motivation, délai) doivent être connus — dans le CRM
ou trouvés dans cette exécution — **et** `confidence ≥ 0,6`. Alors :
- délai `immediat` ou `moins_de_3_mois` → étape **`chaud`** ;
- sinon → étape **`qualifie`**.

Hugo ne déplace qu'un contact `nouveau` ou `qualifie`, et **jamais en arrière**. Il n'atteint jamais
`rdv_planifie`, `estimation_faite`, `mandat_signe` ni `perdu`.
Un contact `qualifie` ou `chaud` devient éligible à **Louis**.

### Conditions d'arrêt
- Coupe-circuit de l'agence actif (`ai_paused`).
- Limite quotidienne d'exécutions atteinte.
- Dossier repris en main par un conseiller (`human_takeover`).
- Contact inexistant ou appartenant à une autre agence.
- Information requise manquante : étape **inchangée**, tâche ouverte, rien n'est inventé.
- Confiance insuffisante : étape inchangée, tâche de vérification.
- Sortie IA invalide après les tentatives autorisées.

### Gestion des erreurs
- Tentative refusée par un garde-fou → run `blocked` journalisé avec la raison, **aucune écriture**,
  message français clair.
- Sortie IA invalide → **aucune écriture métier**, tâche `ai_response_invalid` pour un humain,
  run `failed`, tokens tout de même comptés.
- Erreur de base → message générique en français, détail technique logué côté serveur uniquement.
- Une deuxième exécution ne duplique pas la tâche : la tâche ouverte existante est réutilisée.

### Critères de réussite
- Un dossier complet est qualifié : étape avancée, colonnes comblées, historique écrit, aucune tâche.
- Un dossier incomplet ne bouge pas : `missing_fields` renseigné, tâche ouverte, **rien d'inventé**.
- Une tentative d'injection (« ignore tes instructions… ») ne produit aucune action : la seule chose
  qui puisse arriver est une qualification, et `mandat_signe` reste inatteignable.
- Chaque exécution est journalisée, avec son fournisseur, son modèle et ses tokens.

---

## Louis — rendez-vous

> Mission : proposer un créneau d'estimation à un contact qualifié et préparer le message qui
> l'accompagne. **C'est le code qui calcule les créneaux ; Louis en choisit un dans la liste.**
>
> Code : `features/agents-ia/louis-rendez-vous/` · Entrée : `proposeAppointment(contactId)`

### Déclencheur
Action humaine depuis la fiche contact (bouton « Lancer Louis »), via la server action
`proposeAppointment(contactId)`. Aucun déclenchement automatique à ce stade.

### Entrées
- Le contact de l'agence de l'appelant : prénom, étape, coordonnées, motivation, délai, conseiller
  assigné.
- Le premier bien rattaché, s'il existe.
- Les rendez-vous `proposed` / `confirmed` de **toute l'agence** sur l'horizon (14 jours).
- Le **consentement courant** par canal (vue `current_consents`).
- Les 5 dernières entrées d'historique et le texte libre du prospect : **données non fiables**.
- La liste fermée des créneaux libres, calculée par le code.
- Prompt système versionné : `louis-rendez-vous-2026-09-v1`.

### Étapes
1. Vérifier le format de l'identifiant ; sinon « Contact introuvable. ».
2. Résoudre la session et l'agence côté serveur.
3. Garde-fous (`startGuardedRun`) : appartenance, coupe-circuit, limite quotidienne, reprise
   humaine. Ouvrir le run.
4. Lire le bien et l'agenda de l'agence.
5. **Éligibilité (code)** : étape `qualifie` ou `chaud`, et aucun rendez-vous actif pour ce contact.
6. **Canal et consentement (code)** : email > SMS > WhatsApp ; un canal n'est retenu que si le
   contact y est joignable **et** que le consentement courant est `granted`.
7. **Calcul des créneaux (code)** : Europe/Paris, lundi–vendredi, hors jours fériés français,
   10h–13h et 14h–18h, durée 60 min, au moins 24 h à l'avance, horizon 14 jours, aucun chevauchement
   avec un rendez-vous existant de l'agence. 5 créneaux au maximum.
8. Appeler le fournisseur IA en lui donnant **uniquement** cette liste ; valider la sortie avec un
   schéma zod dans lequel `slot_id` doit appartenir à la liste.
9. Relire le créneau depuis la table du code (jamais depuis ce qu'a écrit le modèle).
10. Créer le rendez-vous en statut **`proposed`**, puis le message en statut
    **`pending_validation`**, marqué simulation, avec la mention de désinscription ajoutée par le
    code. Si le message échoue, le rendez-vous créé est supprimé (rien d'orphelin).
11. Écrire l'entrée d'historique (`appointment_proposed`) et clôturer le run.

### Outils utilisés
`features/agents-ia/louis-rendez-vous/slots.ts` (créneaux, jours fériés, Europe/Paris) ·
`decision.ts` (éligibilité, canal, mention légale) · `lib/agents/*` · `lib/claude/*` ·
tables `appointments`, `outbound_messages`, `activities`, `tasks`, `ai_agent_runs`,
vue `current_consents`.

### Sorties
- Sortie IA validée : `slot_id` (dans la liste), `message_subject`, `message_body`, `reason`,
  `confidence`.
- Un `appointments` en statut `proposed`, `is_simulation = true`, rattaché au conseiller assigné.
- Un `outbound_messages` en statut `pending_validation`, `is_simulation = true`,
  `created_by_agent = 'louis'`, avec une clé d'idempotence par exécution.
- Une ligne `activities` (`appointment_proposed`) attribuée à Louis et marquée simulation.
- Une ligne `ai_agent_runs` avec entrée, sortie, décision, fournisseur, modèle et tokens.
- Résultat applicatif `LouisRunResult` : `appointmentId`, `startsAt`, `endsAt`, `messageId`,
  `messageBody`, `isSimulation`, `provider`, plus le détail (`slotLabel`, `offeredSlots`, `channel`,
  `runId`…).

### Condition de passage à l'étape / à l'agent suivant
**Louis ne passe pas lui-même le contact en `rdv_planifie`.** Cette étape signifie « rendez-vous
confirmé » et exige une **confirmation humaine** dans `/agents-ia/suivi-rendez-vous`. La base fait
alors progresser atomiquement `appointments.status` de `proposed` à `confirmed`, le contact à
`rdv_planifie`, et ajoute l'activité d'audit. Le rendez-vous confirmé doit ensuite être marqué
`done` dans le même écran avec un compte-rendu humain obligatoire et estampillé. **Rien n'est envoyé
à personne.** Une fois ce pont humain terminé, Sarah devient disponible.

### Conditions d'arrêt
- Coupe-circuit actif, limite quotidienne atteinte, reprise humaine.
- Contact inexistant ou appartenant à une autre agence.
- Contact pas encore qualifié (`appointment_stage_not_ready`).
- Rendez-vous actif déjà existant pour ce contact (`appointment_already_scheduled`).
- Aucun consentement valide (`consent_not_granted`) ou aucune coordonnée exploitable
  (`appointment_no_reachable_channel`).
- Aucun créneau libre sur l'horizon (`appointment_no_available_slot`).
- Sortie IA invalide **ou créneau hors liste** (`ai_response_invalid`).
- Créneau pris entre-temps, refusé par la base (`appointment_slot_taken`).

### Gestion des erreurs
- Garde-fou → run `blocked`, aucune écriture, message français clair.
- Consentement manquant, coordonnées manquantes, agenda plein → **aucune écriture métier**, tâche
  dédiée pour un conseiller (`appointment_consent_missing`, `appointment_channel_missing`,
  `appointment_no_slot`), run `failed`.
- Sortie invalide ou créneau hors liste → aucune écriture, tâche `ai_response_invalid`, run `failed`.
- Conflit de réservation : la base tranche (contrainte d'exclusion `appointments_no_overlap`, et le
  cas échéant un interblocage) — aucune écriture n'est conservée, l'utilisateur est invité à
  relancer Louis.
- Échec d'écriture du message après création du rendez-vous → le rendez-vous est **supprimé**
  (compensation) pour ne pas bloquer un créneau sans raison.

### Critères de réussite
- Le créneau proposé est toujours un créneau **calculé par le code** : jour ouvré, hors férié,
  heure ouvrée, à l'heure de Paris, libre.
- Un créneau inventé par l'IA n'aboutit jamais à un rendez-vous.
- Aucune double réservation : jamais deux rendez-vous qui se chevauchent pour un même conseiller
  (garanti par la base, y compris lors d'exécutions simultanées), et jamais deux rendez-vous actifs
  pour un même contact (garanti par le code ; voir la limite connue dans `docs/architecture.md`).
- Rien n'est envoyé : le message reste « à valider », marqué simulation, avec sa mention de
  désinscription et sans aucun lien.
- L'étape du contact est inchangée.
- Chaque exécution est journalisée, avec son fournisseur, son modèle et ses tokens.

---

## Léa — acquisition

> Mission : vérifier la source d'un lead entrant, **dédoublonner**, créer la fiche contact.
> **Le dédoublonnage est fait par le code**, sur correspondance exacte de l'email et du téléphone
> normalisés. L'IA ne fait qu'extraire une identité et signaler ce qui manque.
>
> Code : `features/agents-ia/lea-acquisition/` · Entrée : `processInboundLead(leadId)`

### Déclencheur
Action humaine depuis la boîte de réception des leads (bouton « Lancer Léa »), via la server action
`processInboundLead(leadId)`. Aucun déclenchement automatique à ce stade — y compris pour un lead
créé par le formulaire public : Léa ne tourne jamais toute seule, un membre de l'agence lance
toujours l'exécution.

Le lead peut désormais aussi arriver du formulaire public d'estimation (`/estimation`), via
`public.submit_estimation_request` (`SECURITY DEFINER`, `anon` n'a toujours **aucun privilège
direct** sur `inbound_leads` — voir `docs/architecture.md` §3.1). Cette fonction écrit un lead au
statut `pending` **strictement identique** à un lead saisi manuellement (même colonnes, mêmes
règles) : Léa le traite sans aucune adaptation de son code, prouvé par
`features/estimation/estimation.integration.test.ts`.

### Entrées
- Un lead de `inbound_leads` appartenant à l'agence de l'appelant et au statut **`pending`** :
  source, `payload` structuré (champs de formulaire — donnée **fiable**), `raw_text` (message du
  prospect — donnée **non fiable**, isolée dans un bloc `<donnee_non_fiable>`).
- Les fiches existantes de l'agence (`id`, prénom, nom, email, téléphone), lues pour le
  dédoublonnage. Au-delà de `LEAD_DEDUPE_SCAN_LIMIT` (5 000), l'exécution **refuse de conclure**
  plutôt que de comparer une liste tronquée.
- Prompt système versionné : `lea-acquisition-2026-09-v1`.

### Étapes
1. Vérifier le format de l'identifiant ; sinon « Lead introuvable. ».
2. Résoudre la session et l'agence côté serveur (`resolveAgentContext`).
3. Lire le lead : inexistant ou d'une autre agence → « Lead introuvable. » ; déjà traité →
   `lead_already_processed`. **Aucune exécution n'est ouverte** dans ces deux cas.
4. Garde-fous (`startGuardedContactlessRun`) : coupe-circuit, limite quotidienne. Léa travaille
   **avant** qu'un contact existe : le run est journalisé avec `contact_id = null` (colonne
   nullable), et la base interdit de le modifier ensuite.
5. Lire les fiches existantes de l'agence.
6. Construire le prompt : faits du lead d'un côté (compteurs et drapeaux), texte du prospect isolé
   de l'autre.
7. Appeler le fournisseur IA, valider la sortie (2 tentatives maximum).
8. **Fusion (code)** : le `payload` structuré gagne toujours ; le modèle ne comble que les trous ;
   une valeur que la base refuserait (email malformé, « à rappeler » à la place d'un numéro) devient
   **manquante**, jamais approximée.
9. **Dédoublonnage (code)** : correspondance **exacte** sur l'email (minuscules) et sur le téléphone
   (chiffres, formes `+33` / `0033` ramenées au format national). Le nom n'est **jamais** une clé.
10. Écrire : fiche créée, ou lead rattaché à la fiche existante, ou rien du tout. Tâche humaine,
    entrée d'historique, clôture du run.

### Outils utilisés
`features/agents-ia/lea-acquisition/dedupe.ts` (normalisation + correspondance exacte) ·
`decision.ts` (fusion, valeurs acceptables, issue) · `lib/agents/*` · `lib/claude/*` · tables
`inbound_leads`, `contacts`, `activities`, `tasks`, `ai_agent_runs`.

### Sorties
- Sortie IA validée : `first_name`, `last_name`, `email`, `phone` (ou `null`), `missing_fields`,
  `confidence`, `summary`. **Aucun champ de dédoublonnage, de statut de lead ou d'étape.**
- Trois issues possibles :
  - **`contact_created`** : une ligne `contacts` (étape `nouveau`, `notes` = texte brut du lead),
    le lead passe à `processed` avec `contact_id` et `processed_run_id`, une tâche
    **`collect_consent`** est ouverte — *un lead n'est pas un consentement* — et une entrée
    `contact_created_from_lead` est écrite. Si le lead vient du formulaire public d'estimation et
    portait déjà un consentement (recueilli au moment de la soumission, avant que ce contact
    n'existe), un trigger de la base (`private.reconcile_lead_consents()`, hors du code de Léa) le
    rattache au contact **au même instant** que cette mise à jour : la tâche `collect_consent` peut
    donc apparaître alors qu'un consentement existe déjà — un humain qui ouvre le dossier le voit
    dans l'historique des consentements et peut classer la tâche sans relancer le prospect.
  - **`duplicate_found`** : **aucune fiche créée**, le lead passe à `duplicate` et pointe la fiche
    existante, tâche `lead_duplicate`, entrée `lead_duplicate_detected`. Le même rattachement de
    consentement pré-contact s'applique ici aussi.
  - **`incomplete`** : **rien n'est écrit**, le lead **reste `pending`**, tâche `lead_incomplete`
    listant les champs manquants, entrée `ai_information_missing`.
- Une ligne `ai_agent_runs` (sans contact) avec entrée, sortie, décision, fournisseur et tokens.
- Résultat applicatif : `{ data: LeaRunResult, error: null }`.

### Condition de passage à l'étape / à l'agent suivant
La fiche est créée à l'étape **`nouveau`** : Léa ne qualifie personne. Elle devient éligible à
**Hugo**. Aucun envoi n'est possible tant qu'un consentement n'a pas été recueilli et enregistré par
un humain (la base le revérifie à l'envoi).

### Conditions d'arrêt
- Coupe-circuit de l'agence actif ; limite quotidienne atteinte.
- Lead inexistant, d'une autre agence, ou déjà traité.
- Lead trop incomplet : il faut **un nom et au moins un moyen de contact** exploitable.
- Trop de fiches à comparer pour garantir un dédoublonnage exact.
- Sortie IA invalide après les tentatives autorisées.

### Gestion des erreurs
- Garde-fou → run `blocked` journalisé avec la raison, **aucune écriture**, message français clair.
- Sortie IA invalide → **aucune écriture métier**, tâche `ai_response_invalid`, run `failed`.
- Échec d'écriture du lead **après** création de la fiche : le lead reste `pending`. Rien n'est
  perdu et rien n'est dupliqué — une seconde exécution retrouve la fiche que Léa vient de créer
  comme **doublon exact** et rattache le lead à celle-ci.
- Les tâches sans contact (`lead_incomplete`, `ai_response_invalid`) sont réutilisées au lieu d'être
  empilées : l'index d'unicité des tâches ouvertes ne couvre que celles rattachées à un contact.

### Critères de réussite
- Un lead complet donne **une** fiche, jamais deux, avec une tâche de recueil de consentement.
- Un doublon évident (même email **et** même téléphone, écrits autrement) ne crée **aucune** seconde
  fiche.
- Deux personnes différentes qui se ressemblent ne sont **jamais** fusionnées : sans correspondance
  exacte, il n'y a pas de doublon.
- Un lead vide ne crée rien et dit ce qui manque.
- Une tentative d'injection dans le texte du lead ne déclenche aucune action et ne fusionne rien.
- Le dédoublonnage ne regarde jamais les fiches d'une autre agence.

---

## Emma — relation

> Mission : préparer les relances et adapter le contenu des messages. **Emma rédige le contenu ;
> le code choisit le destinataire, le canal, le moment, et vérifie le consentement.**
>
> Code : `features/agents-ia/emma-relation/` · Entrée : `prepareFollowUp(contactId)`

### Déclencheur
Action humaine depuis la fiche contact (bouton « Lancer Emma ») ou depuis l'espace de travail
manuel `/agents-ia/relances` (« Relances Emma »), via la server action `prepareFollowUp(contactId)`.
Aucun déclenchement automatique à ce stade, et aucune cadence de relance n'est définie : l'écran
« Relances Emma » ne dit jamais qu'un dossier est « dû » ou « en retard », il liste les dossiers
éligibles et pourquoi chacun peut ou non être relancé maintenant.

L'écran lit `getEmmaFollowUpCandidates()`, qui calcule pour chaque contact des étapes éligibles un
canal retenu (même règle que ci-dessous, `null` si aucun canal consenti) et un `blockedReason`
(`human_takeover`, `pending_draft`, `consent_or_channel_missing`, ou `null`). **Ce calcul est un
confort d'affichage uniquement** : bouton visuellement désactivé avec la raison associée, mais la
server action ci-dessous revérifie chaque condition côté serveur au clic, y compris des conditions
que l'écran ne connaît pas (coupe-circuit, limite quotidienne).

### Entrées
- Le contact de l'agence de l'appelant : prénom, étape, coordonnées, source, motivation, délai.
- Le premier bien rattaché, s'il existe.
- Les 20 derniers messages du contact : sert à détecter un brouillon déjà en attente et à calculer
  le délai depuis le dernier envoi.
- Les rendez-vous `proposed` / `confirmed` du contact.
- Le **consentement courant** par canal (vue `current_consents`).
- Les 5 dernières entrées d'historique et le texte libre du prospect : **données non fiables**.
- Prompt système versionné : `emma-relation-2026-09-v1`.

### Étapes
1. Vérifier le format de l'identifiant ; sinon « Contact introuvable. ».
2. Résoudre la session et l'agence côté serveur.
3. Garde-fous (`startGuardedRun`) : appartenance, coupe-circuit, limite quotidienne, **reprise
   humaine**. Ouvrir le run.
4. Lire le bien, les messages, les rendez-vous.
5. **Éligibilité (code)** : étape dans `EMMA_ELIGIBLE_STAGES` (`nouveau`, `qualifie`, `chaud`,
   `rdv_planifie`, `estimation_faite`) — jamais `mandat_signe`, jamais `perdu` — **et** aucun
   brouillon d'Emma déjà en attente de validation.
6. **Canal et consentement (code)** : email > SMS > WhatsApp ; un canal n'est retenu que si le
   contact y est joignable **et** que le consentement courant est `granted`. Un consentement retiré
   n'est pas un consentement ; un consentement `phone` n'autorise jamais un message.
7. **Clé d'idempotence (code)** : `emma-<contact>-<jour parisien>`.
8. Appeler le fournisseur IA ; valider la sortie (schéma strict : aucun lien, aucun montant en
   euros, aucun champ de canal, de destinataire, de date ou d'envoi).
9. Écrire le brouillon dans `outbound_messages`, statut **`pending_validation`**,
   `is_simulation = true`, `created_by_agent = 'emma'`, objet conservé uniquement pour un canal qui
   en a un, mention de désinscription ajoutée **par le code**.
10. Écrire l'entrée d'historique (`message_drafted`) et clôturer le run.

### Outils utilisés
`lib/agents/consent.ts` (canal, consentement, mention STOP — **règle partagée avec Louis**) ·
`features/agents-ia/emma-relation/decision.ts` (éligibilité, idempotence) · `lib/agents/*` ·
`lib/claude/*` · tables `outbound_messages`, `activities`, `tasks`, `ai_agent_runs`, vue
`current_consents`.

### Sorties
- Sortie IA validée : `message_subject` (ou `null`), `message_body`, `angle` (vocabulaire fermé),
  `reason`, `confidence`.
- Un `outbound_messages` en statut `pending_validation`, marqué simulation, avec sa clé
  d'idempotence. **Rien n'est envoyé, rien n'est validé.**
- Une ligne `activities` (`message_drafted`) attribuée à Emma et marquée simulation.
- Une ligne `ai_agent_runs` avec entrée, sortie, décision, fournisseur, modèle et tokens.
- Résultat applicatif `EmmaRunResult` : `messageId`, `messageSubject`, `messageBody`,
  `messageStatus`, `channel`, `isSimulation`, plus le détail (`angle`, `reason`, `confidence`,
  `idempotencyKey`, `runId`…).

### Condition de passage à l'étape / à l'agent suivant
**L'étape du contact est inchangée** : une relance ne qualifie ni ne fait avancer personne. Le
brouillon part vers la file « à valider » ; un humain de l'agence le relit, l'approuve puis
l'envoie (règle du premier contact, tenue par la base). Une réponse du vendeur ramène le dossier
vers **Hugo** (qualification) ou **Louis** (rendez-vous).

### Conditions d'arrêt
- Coupe-circuit actif, limite quotidienne atteinte, **reprise humaine** (`human_takeover`).
- Contact inexistant ou appartenant à une autre agence.
- Dossier clos ou mandat signé (`follow_up_stage_not_eligible`).
- Brouillon déjà en attente de validation (`follow_up_already_drafted`), y compris quand c'est la
  **base** qui refuse la clé d'idempotence.
- Aucun consentement valide (`consent_not_granted`) ou aucune coordonnée exploitable
  (`appointment_no_reachable_channel`).
- Sortie IA invalide (lien, montant en euros, clé en trop, angle hors vocabulaire…).

### Gestion des erreurs
- Garde-fou → run `blocked`, aucune écriture, message français clair.
- Consentement manquant ou coordonnées manquantes → **aucun brouillon**, tâche dédiée
  (`follow_up_consent_missing`, `follow_up_channel_missing`), entrée d'historique, run `failed`.
- Sortie invalide → aucun brouillon, tâche `ai_response_invalid`, run `failed`.
- Double brouillon refusé par la base (clé d'idempotence) → run `failed` avec
  `follow_up_already_drafted` ; **aucun second message n'existe**.
- Erreur de base → message générique en français, détail technique logué côté serveur uniquement.

### Critères de réussite
- **Aucun brouillon ne peut exister sans consentement valide au moment de la rédaction**, et un
  consentement retiré invalide le canal.
- Deux exécutions ne produisent **jamais** deux brouillons pour le même contact le même jour.
- Rien n'est envoyé : le message reste « à valider », marqué simulation, avec sa mention de
  désinscription, sans lien et sans montant en euros.
- Une tentative d'injection ne change ni le canal, ni le statut, ni l'étape, et ne fait apparaître
  aucun chiffre inventé dans le message.
- L'étape du contact est inchangée. Chaque exécution est journalisée avec ses tokens.

---

## Sarah — suivi

> Mission : exploiter le compte-rendu du rendez-vous d'estimation et suivre le dossier.
> **Le compte-rendu est écrit par un humain ; Sarah ne l'écrit jamais et ne signe jamais un mandat.**
>
> Code : `features/agents-ia/sarah-suivi/` · Entrée : `followThroughAppointment(appointmentId)`

### Déclencheur
Action humaine depuis `/agents-ia/suivi-rendez-vous` (bouton « Lancer Sarah »), via la server action
`followThroughAppointment(appointmentId)`. Avant cela, le même écran expose les deux actions humaines
`confirmAppointment(appointmentId)` puis `completeAppointment(appointmentId, { reportNotes })`.
Aucun déclenchement automatique à ce stade.

### Entrées
- Un rendez-vous de l'agence de l'appelant, au statut **`done`**, dont `report_notes` est
  renseigné (donc rédigé et estampillé par un membre de l'agence).
- Le contact rattaché et son premier bien, s'il existe.
- Les 5 dernières entrées d'historique.
- **Données non fiables**, isolées dans des blocs `<donnee_non_fiable>` : le compte-rendu lui-même
  (il cite le vendeur), le texte libre du prospect, les résumés d'historique.
- Prompt système versionné : `sarah-suivi-2026-09-v1`.

### Étapes
1. Vérifier le format de l'identifiant ; sinon « Rendez-vous introuvable. ».
2. Résoudre la session et l'agence côté serveur.
3. Lire le rendez-vous ; inexistant ou d'une autre agence → « Rendez-vous introuvable. ».
4. Garde-fous (`startGuardedRun`) sur **son contact** : appartenance, coupe-circuit, limite
   quotidienne, reprise humaine. Ouvrir le run.
5. Lire le bien et l'historique récent.
6. **Éligibilité (code)** : le rendez-vous doit être `done` **et** avoir un compte-rendu. Sinon :
   arrêt, tâche de saisie, rien n'est déduit.
7. Construire le prompt : faits CRM d'un côté, compte-rendu isolé de l'autre.
8. Appeler le fournisseur IA ; valider la sortie (schéma strict : **aucun champ d'étape**, aucun
   montant en euros, aucun lien, vocabulaire fermé pour la position du vendeur).
9. **Décision d'étape (code)** : liste blanche `SARAH_ALLOWED_TARGET_STAGES = ["estimation_faite"]`.
   Voir « condition de passage ».
10. Écrire l'étape éventuellement avec un verrou optimiste sur l'étape lue avant l'appel IA : une
    décision humaine concurrente gagne toujours. Écrire les tâches et l'historique, puis clôturer le run.

### Outils utilisés
`features/agents-ia/sarah-suivi/decision.ts` (liste blanche d'étapes, plan de tâches) ·
`lib/agents/*` · `lib/claude/*` · tables `appointments` (**lecture seule**), `contacts`,
`activities`, `tasks`, `ai_agent_runs`.

### Sorties
- Sortie IA validée : `summary`, `seller_decision` (vocabulaire fermé), `objections`,
  `missing_documents`, `next_steps` (titre + détail), `estimation_presented` (booléen — **jamais le
  montant**), `missing_fields`, `confidence`.
- Éventuellement `contacts.stage` porté à **`estimation_faite`**, et rien d'autre.
- Des tâches humaines à types stables, choisis **par le code** : `follow_through_next_steps`,
  `missing_documents`, `follow_through_to_review`.
- Une ligne `activities` (`ai_follow_through_done`) attribuée à Sarah et marquée simulation.
- Une ligne `ai_agent_runs` avec entrée, sortie, décision, fournisseur, modèle et tokens.
- Résultat applicatif `SarahRunResult` : `previousStage`, `stage`, `stageChanged`, `decision`,
  `followThrough`, `sellerDecisionLabel`, `tasks`, `runId`…

### Condition de passage à l'étape / à l'agent suivant
`confidence ≥ 0,5` **et** étape courante dans `SARAH_MOVABLE_STAGES` (`qualifie`, `chaud`,
`rdv_planifie`) → étape **`estimation_faite`**. Sinon : étape inchangée.

**`mandat_signe` est structurellement inatteignable**, et c'est garanti deux fois :
1. le schéma de sortie de Sarah n'a **aucun champ d'étape** — il n'existe nulle part où en mettre
   une, et l'objet strict refuse toute clé supplémentaire ;
2. l'étape est choisie par le code dans une **liste blanche** qui ne contient que
   `estimation_faite` ; `isStageAllowedForSarah` la revérifie juste avant l'écriture.
`perdu` est exclu pour la même raison : fermer un dossier est une décision humaine.
La signature du mandat est **toujours** confirmée par un humain de l'agence.

### Conditions d'arrêt
- Coupe-circuit actif, limite quotidienne atteinte, reprise humaine.
- Rendez-vous inexistant ou appartenant à une autre agence.
- Rendez-vous non réalisé ou sans compte-rendu (`appointment_report_missing`).
- Étape modifiée par un humain pendant l'analyse (`contact_stage_changed`) : aucune décision humaine
  n'est remplacée, aucune tâche de succès n'est créée.
- Confiance insuffisante : étape inchangée, tâche de vérification.
- Sortie IA invalide, y compris une classification hors vocabulaire ou un montant en euros glissé
  dans un texte.

### Gestion des erreurs
- Garde-fou → run `blocked`, aucune écriture, message français clair.
- Compte-rendu manquant → **aucune déduction**, tâche `appointment_report_missing` pour le
  conseiller qui a réalisé le rendez-vous, run `failed`.
- Sortie invalide → aucune écriture métier, tâche `ai_response_invalid`, run `failed`.
- Erreur de base → message générique en français, détail technique logué côté serveur uniquement.
- Une deuxième exécution ne duplique pas les tâches : l'index d'unicité des tâches ouvertes
  (agence, contact, type) fait réutiliser celles qui sont déjà ouvertes.

### Critères de réussite
- **Aucune sortie de Sarah, même malveillante, ne produit `mandat_signe`** — prouvé par
  `features/agents-ia/sarah-suivi/schema.test.ts`, `decision.test.ts` et
  `sarah.integration.test.ts` (compte-rendu affirmant que le mandat est signé).
- **Aucun montant en euros** ne sort de Sarah : ni dans le résumé, ni dans une tâche, ni dans
  l'historique. Elle dit seulement qu'une estimation a été présentée.
- Le compte-rendu et sa preuve d'auteur (`report_recorded_by`, `report_recorded_at`) sont
  **inchangés** après son passage.
- Un compte-rendu vide ne produit aucune action inventée : `next_steps` vide, champ signalé
  manquant, étape inchangée.
- Rien n'est envoyé, aucun message n'est même préparé.
- Chaque exécution est journalisée, avec son fournisseur, son modèle et ses tokens.
