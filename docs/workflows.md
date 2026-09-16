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
**Le contact ne passe pas en `rdv_planifie`.** Cette étape signifie « rendez-vous confirmé » et
exige une **confirmation humaine** : un membre de l'agence valide le message, l'envoie, puis
confirme le rendez-vous (itération suivante). Tant que ce n'est pas fait, le rendez-vous reste
`proposed` et le message `pending_validation`. **Rien n'est envoyé à personne.**
Une fois le rendez-vous réalisé, le dossier passe à **Sarah** (suivi).

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

## Léa — acquisition · Emma — relation · Sarah — suivi

Non implémentés à ce stade. Ils suivront le même socle (`lib/agents/`), le même format de
documentation (les 9 champs ci-dessus) et la même règle : **l'IA rédige et classe, le code décide
et écrit**.
