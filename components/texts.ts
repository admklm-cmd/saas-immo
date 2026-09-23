/**
 * Centralised French interface copy.
 *
 * CLAUDE.md: the interface is in French, the code is in English, and UI strings
 * are centralised instead of being scattered across components.
 *
 * Domain labels that already exist server-side (pipeline stages, consent
 * channels, message statuses…) are NOT duplicated here: they come from
 * `features/contacts/types.ts` and `lib/agents/messages.ts`.
 */

import { BRAND } from "@/components/brand";
import type { ConsentStatus, PropertyType } from "@/features/contacts/types";
import type { DashboardScopeKey } from "@/features/dashboard/types";
import type { EstimationConsentChannel } from "@/features/estimation/consent-texts";
import type { PropertyTypeChoice } from "@/features/estimation/types";

/**
 * Two label maps are missing from `features/contacts/types.ts` (owned by the
 * automatisation-ia agent). They live here for now and should be moved next to
 * the other domain labels — see "À transmettre" in the frontend report.
 */
export const PROPERTY_TYPE_LABELS: Readonly<Record<PropertyType, string>> = {
  apartment: "Appartement",
  house: "Maison",
  land: "Terrain",
  commercial: "Local commercial",
  other: "Autre",
};

export const CONSENT_STATUS_LABELS: Readonly<Record<ConsentStatus, string>> = {
  granted: "Accordé",
  withdrawn: "Retiré",
};

/** Choice labels of the public estimation form's property type selector. */
export const ESTIMATION_PROPERTY_TYPE_LABELS: Readonly<Record<PropertyTypeChoice, string>> = {
  maison: "Maison",
  appartement: "Appartement",
  terrain: "Terrain",
  autre: "Autre",
};

/** Visible channel name shown above each consent checkbox of `/estimation`. */
export const ESTIMATION_CONSENT_CHANNEL_LABELS: Readonly<Record<EstimationConsentChannel, string>> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  phone: "Téléphone",
};

export const APP_TEXTS = {
  /**
   * Brand elements — re-exported from `components/brand.ts`, never retyped.
   * The product name is a proper noun, not French copy: it lives in one file
   * so that renaming it can never leave a stale spelling behind.
   */
  brand: BRAND,

  nav: {
    primaryLabel: "Navigation principale",
    skipToContent: "Aller au contenu",
    dashboard: "Tableau de bord",
    contacts: "Contacts vendeurs",
    pipeline: "Pipeline",
    agents: "Agents IA",
    agentsLeads: "Leads entrants",
    agentsFollowUps: "Relances Emma",
    agentsToValidate: "Messages à valider",
    agentsFollowThrough: "Suivi des rendez-vous",
    settings: "Paramètres",
    signedInAs: "Connecté en tant que",
    signOut: "Se déconnecter",
    signingOut: "Déconnexion…",
    signOutError: "La déconnexion a échoué. Réessayez.",
  },

  auth: {
    title: "Connexion",
    subtitle: "Accédez à l'espace de votre agence.",
    emailLabel: "Adresse email",
    emailPlaceholder: "prenom.nom@agence.fr",
    passwordLabel: "Mot de passe",
    submit: "Se connecter",
    submitting: "Connexion en cours…",
    invalidCredentials: "Adresse email ou mot de passe incorrect.",
    missingFields: "Renseignez votre adresse email et votre mot de passe.",
    unexpected: "La connexion a échoué. Réessayez dans un instant.",
    errorTitle: "Connexion impossible",
    noAccount: "Pas encore de compte ? Contactez votre direction d'agence.",
  },

  states: {
    loading: "Chargement…",
    errorTitle: "Une erreur est survenue",
    retry: "Réessayer",
    back: "Retour",
    simulation: "Simulation",
    simulationHint: "Action simulée : rien n'a été envoyé à l'extérieur.",
    comingSoon: "À venir",
    comingSoonBody: "Cet écran arrive dans une prochaine itération du prototype.",
    notFoundTitle: "Page introuvable",
    notFoundBody: "Le lien est peut-être obsolète, ou la page n'existe pas.",
    unexpected: "Une erreur technique est survenue. Aucune action n'a été effectuée.",
  },

  contacts: {
    title: "Contacts vendeurs",
    subtitle: "Tous les contacts de votre agence, du plus récent au plus ancien.",
    count: (total: number) => (total > 1 ? `${total} contacts` : `${total} contact`),
    emptyTitle: "Aucun contact pour l'instant",
    emptyBody:
      "Les contacts arrivent par le formulaire d'estimation du site public, par import ou par saisie manuelle.",
    errorTitle: "Impossible d'afficher les contacts",
    columnName: "Contact",
    columnStage: "Étape",
    columnSource: "Source",
    columnProperty: "Bien",
    columnContactDetails: "Coordonnées",
    columnUpdated: "Mise à jour",
    noEmail: "Email non renseigné",
    noPhone: "Téléphone non renseigné",
    noProperty: "Bien non identifié",
    openContact: "Ouvrir la fiche",
    humanTakeover: "Repris par un conseiller",
    openTasks: (total: number) => (total > 1 ? `${total} tâches ouvertes` : `${total} tâche ouverte`),
  },

  contact: {
    pageTitle: "Fiche contact",
    backToList: "Contacts vendeurs",
    identityTitle: "Coordonnées",
    identitySubtitle: "Informations transmises par le vendeur.",
    email: "Email",
    phone: "Téléphone",
    source: "Source",
    createdAt: "Créé le",
    updatedAt: "Dernière mise à jour",
    motivation: "Motivation de vente",
    timeline: "Délai du projet",
    notes: "Notes",
    notesUntrusted: "Texte libre du vendeur : traité comme donnée, jamais comme instruction.",
    unknown: "Non renseigné",

    propertyTitle: "Bien",
    propertySubtitle: "Bien principal rattaché au contact.",
    propertyEmpty: "Aucun bien identifié pour l'instant.",
    propertyType: "Type",
    propertyAddress: "Adresse",
    propertyCity: "Ville",
    propertySector: "Secteur",
    propertySurface: "Surface",
    propertyRooms: "Pièces",

    consentsTitle: "Consentements",
    consentsSubtitle: "Un consentement par canal, vérifié côté serveur avant tout envoi.",
    consentsEmpty: "Aucun consentement enregistré : aucun envoi n'est possible.",
    consentRecordedAt: "Enregistré le",
    consentSource: "Source",
    consentVersion: "Version du texte",

    timelineTitle: "Historique",
    timelineSubtitle: "Échanges, rendez-vous, tâches et exécutions des agents IA.",
    timelineEmpty: "Aucun événement pour ce contact.",
    timelineError: "Impossible d'afficher l'historique.",
    timelineStageChange: (from: string, to: string) => `Étape : ${from} → ${to}`,
    timelineStageReason: "Motif",

    notFoundTitle: "Contact introuvable.",
    notFoundBody: "Ce contact n'existe pas ou n'appartient pas à votre agence.",
  },

  /**
   * Pipeline — vue par étape et changement d'étape humain.
   *
   * Une carte mène à la fiche contact et porte « Changer d'étape » (server
   * action `changeContactStage`). `perdu` est affiché à part, avec moins de
   * poids visuel que les étapes actives. « Mandat signé » exige toujours une
   * confirmation humaine explicite ; seul un directeur peut en sortir.
   */
  pipeline: {
    title: "Pipeline",
    subtitle: "Vue par étape, du premier contact au mandat signé.",
    errorTitle: "Impossible d'afficher le pipeline",
    columnCount: (total: number) => (total > 1 ? `${total} dossiers` : `${total} dossier`),
    columnEmpty: "Aucun dossier à cette étape.",
    lostSubtitle: "Affichée à part : cette étape n'est plus travaillée activement.",

    /** Human stage change from a pipeline card (server action `changeContactStage`). */
    stageChange: {
      trigger: "Changer d'étape",
      /** Screen-reader suffix, so every trigger has a distinct accessible name. */
      triggerFor: (name: string) => `pour ${name}`,
      menuTitle: "Déplacer vers",
      currentStage: "Actuelle",
      pending: "Déplacement en cours…",
      success: (name: string, stage: string) => `${name} : dossier déplacé vers « ${stage} ».`,
      errorTitle: "L'étape n'a pas été modifiée",
      exitDirectorOnly: "Seul un directeur peut sortir un dossier de « Mandat signé ».",
      requiresConfirmation: "Confirmation demandée",
      cancel: "Annuler",

      enterTitle: "Confirmer le mandat signé",
      enterSummary: (name: string, from: string) =>
        `Le dossier de ${name} passera de « ${from} » à « Mandat signé ».`,
      enterHumanRule:
        "Un mandat signé est toujours confirmé par un membre de l'agence, jamais par un agent IA. Votre confirmation est enregistrée dans l'historique du dossier.",
      enterCheckbox: "Je confirme qu'un mandat a été signé avec ce vendeur",
      enterSubmit: "Confirmer le mandat signé",
      enterBlocked: "Cochez la case de confirmation pour continuer.",

      exitTitle: "Sortir du mandat signé",
      exitSummary: (name: string, to: string) => `Le dossier de ${name} passera de « Mandat signé » à « ${to} ».`,
      exitRule:
        "Décision réservée à un directeur. La signature reste dans l'historique du dossier : cette sortie y est ajoutée avec votre motif.",
      exitCheckbox: "Je confirme vouloir sortir ce dossier de « Mandat signé »",
      reasonLabel: "Motif (obligatoire)",
      reasonHint: "Entre 3 et 500 caractères. Enregistré tel quel dans l'historique du dossier.",
      reasonCounter: (count: number, max: number) => `${count} / ${max} caractères`,
      exitSubmit: "Sortir du mandat signé",
      exitBlocked: "Cochez la confirmation et saisissez un motif d'au moins 3 caractères pour continuer.",
    },
  },

  agents: {
    panelTitle: "Agents IA",
    panelSubtitle:
      "Les agents travaillent sur simulateur : aucune action externe n'est réellement exécutée.",
    runHugo: "Lancer Hugo",
    runHugoHint: "Qualification : type de bien, secteur, motivation et délai du projet.",
    runLouis: "Lancer Louis",
    runLouisHint: "Rendez-vous : propose un créneau d'estimation et rédige le message.",
    runEmma: "Lancer Emma",
    runEmmaHint: "Relance : prépare un message adapté au dossier, envoyé vers la validation humaine.",
    running: "Exécution en cours…",
    blockedTitle: "Action bloquée par un garde-fou",
    errorTitle: "L'agent n'a pas pu s'exécuter",
    hugoSuccessTitle: "Hugo a terminé la qualification",
    louisSuccessTitle: "Louis a préparé une proposition de rendez-vous",
    emmaSuccessTitle: "Emma a préparé une relance",
    stageChanged: "Étape du pipeline",
    stageUnchanged: "Étape inchangée",
    missingFields: "Informations manquantes signalées",
    taskCreated: "Tâche créée pour un conseiller",
    proposedSlot: "Créneau proposé",
    draftMessage: "Message proposé",
    pendingValidation: "Ce message reste à valider par un membre de l'agence avant tout envoi.",
    refreshHint: "L'historique ci-dessous a été mis à jour.",
  },

  /**
   * Replay of one AI run — "voir l'agent travailler".
   *
   * The wording is deliberately factual: the steps and their durations are the
   * ones the server measured and the database recomputed. The interface never
   * invents a rhythm, and says so when it slows the replay down.
   */
  replay: {
    title: "L'agent au travail",
    subtitle:
      "Étapes réellement enregistrées pendant l'exécution, rejouées avec les durées mesurées par le serveur.",
    empty: "Aucune étape n'a été enregistrée pour cette exécution.",
    authorCode: "Code",
    authorAi: "Fournisseur IA",
    authorLegend:
      "Une seule étape sort du code de l'agence : l'appel au fournisseur IA. La décision est prise par le code — chez Louis, elle précède même l'appel.",
    decisionMarker: "Choix arrêté par le code de l'agence, jamais par le modèle.",
    totalMeasured: "Durée totale mesurée",
    speedFactor: (factor: number) => `Rejeu ralenti ×${factor}`,
    speedFactorHint:
      "Seule la vitesse du rejeu est ralentie : les durées affichées restent les durées réellement mesurées.",
    realSpeed: "Rejeu à vitesse réelle",
    flowTitle: "Flux d’exécution",
    flowSubtitle: "Chaque passage correspond à une étape réellement enregistrée.",
    activityRunning: "Activité en cours",
    activityComplete: "Exécution complète",
    measuredProgress: "Progression mesurée",
    showAll: "Tout afficher",
    replayAgain: "Rejouer",
    playing: "Rejeu en cours…",
    finished: "Rejeu terminé.",
    stepAnnounce: (position: number, total: number, phase: string, status: string) =>
      `Étape ${position} sur ${total} : ${phase} — ${status}.`,
    detailSummary: "Détail technique",
    stopped: "Exécution arrêtée à cette étape.",
  },

  /** Screen « Agents IA » — the five agents, their real activity, the kill switch. */
  agentsIa: {
    title: "Agents IA",
    subtitle:
      "Léa, Hugo, Emma, Louis et Sarah : mission, activité réellement enregistrée, erreurs et coupe-circuit.",
    simulatorNote:
      "Les cinq agents tournent sur simulateur : aucun appel payant, aucune communication réelle.",
    overviewErrorTitle: "Impossible d'afficher l'activité des agents",
    agentsSectionTitle: "Les cinq agents, dans l'ordre du cycle de vente",
    agentsSectionSubtitle:
      "Chaque agent a un périmètre borné : ce qu'il fait, et ce qu'il ne décide pas.",
    agencyTitle: "Activité de l'agence",
    agencySubtitle: "Chiffres comptés exactement dans le journal des exécutions, jamais estimés.",
    runsAgainstLimit: "Exécutions décomptées",
    runsAgainstLimitHint: "Les tentatives refusées ne consomment aucun quota.",
    attempts: "Tentatives, refus compris",
    dailyLimit: "Limite quotidienne",
    pendingValidation: "Brouillons en attente de validation",
    mission: "Mission",
    statusActive: "Actif",
    statusPaused: "Suspendu par le coupe-circuit",
    runsLabel: (count: number, window: string) =>
      count > 1 ? `${count} exécutions ${window}` : `${count} exécution ${window}`,
    outcome: (label: string, count: number) => `${label} : ${count}`,
    tokens: "Jetons",
    tokensValue: (input: number, output: number) => `${input} en entrée / ${output} en sortie`,
    lastRun: "Dernière exécution",
    lastErrors: "Dernières erreurs",
    noError: "Aucune erreur ni blocage enregistré pour cet agent.",
    viewReplay: "Voir le rejeu",
    inboundLead: "Lead entrant",
    inboundLeadHint: "Léa travaille avant toute fiche : cette exécution n'est rattachée à aucun contact.",
    openContact: "Voir la fiche",
  },

  /** Kill switch of the agency — a safety control, not a decorative setting. */
  killSwitch: {
    title: "Coupe-circuit des agents IA",
    running: "Agents IA actifs",
    paused: "Coupe-circuit actif",
    descriptionRunning:
      "Les agents IA de l'agence peuvent s'exécuter. Un clic les suspend tous immédiatement.",
    descriptionPaused:
      "Les agents IA de l'agence sont suspendus : aucune exécution n'est possible, chaque tentative est refusée et journalisée.",
    pause: "Suspendre tous les agents IA",
    resume: "Réactiver les agents IA",
    confirmPauseTitle: "Suspendre les cinq agents IA ?",
    confirmPauseBody:
      "Plus aucune exécution ne sera possible tant que le coupe-circuit reste actif. Les tentatives en cours de préparation seront refusées et journalisées.",
    confirmResumeTitle: "Réactiver les cinq agents IA ?",
    confirmResumeBody:
      "Les agents pourront de nouveau s'exécuter, toujours sur simulateur et toujours dans la limite quotidienne de l'agence.",
    confirm: "Confirmer",
    cancel: "Annuler",
    pending: "Application en cours…",
    pausedSuccess: "Les agents IA sont suspendus.",
    resumedSuccess: "Les agents IA sont réactivés.",
    errorTitle: "Le coupe-circuit n'a pas pu être modifié",
  },

  /** Execution journal of the agency: filters, table, pagination. */
  runHistory: {
    title: "Historique des exécutions",
    subtitle: "Toutes les exécutions de l'agence, de la plus récente à la plus ancienne.",
    errorTitle: "Impossible d'afficher l'historique",
    emptyTitle: "Aucune exécution ne correspond",
    emptyBody: "Modifiez les filtres, ou lancez un agent depuis une fiche contact.",
    caption: "Exécutions des agents IA de l'agence",
    filtersLabel: "Filtrer l'historique",
    filterAgent: "Agent",
    filterStatus: "Résultat",
    filterAll: "Tous",
    filterSubmit: "Filtrer",
    filterReset: "Réinitialiser",
    columnAgent: "Agent",
    columnStatus: "Résultat",
    columnContact: "Contact",
    columnDecision: "Décision journalisée",
    columnStartedAt: "Démarrée",
    columnReplay: "Rejeu",
    range: (from: number, to: number, total: number) => `${from}–${to} sur ${total}`,
    previous: "Page précédente",
    next: "Page suivante",
    noDecision: "Aucune décision journalisée",
  },

  /**
   * File d'attente « Messages à valider ».
   *
   * L'écran où s'applique la règle produit la plus stricte de `CLAUDE.md` :
   * **premier contact toujours validé par un humain**. Rien n'y est envoyé
   * automatiquement, et « envoyé » veut dire « envoi simulé ».
   */
  validationQueue: {
    title: "Messages à valider",
    subtitle:
      "Aucun message préparé par un agent IA ne part sans la décision d'un membre de l'agence.",
    ruleTitle: "Premier contact : toujours validé par un humain",
    ruleBody:
      "Un agent IA prépare, un humain décide. Aucun fournisseur d'envoi n'est branché sur ce prototype : un envoi validé ici reste une simulation.",
    count: (total: number) =>
      total > 1 ? `${total} messages en attente` : `${total} message en attente`,
    errorTitle: "Impossible d'afficher la file de validation",
    emptyTitle: "Aucun message en attente",
    emptyBody:
      "Les brouillons préparés par Emma ou Louis apparaissent ici, avec leur contact, leur canal et l'état du consentement.",
    emptyAction: "Voir les contacts",

    firstContact: "Premier contact",
    preparedBy: (agent: string) => `Préparé par ${agent}`,
    writtenByHuman: "Rédigé par un conseiller",
    receivedAt: "Préparé le",
    channel: "Canal",
    consent: "Consentement du canal",
    consentNone: "Aucun consentement enregistré",
    consentBlocked:
      "Sans consentement valide sur ce canal, le serveur refuse l'envoi : le message ne peut pas partir.",
    subject: "Objet",
    body: "Message proposé",
    untrusted: "Texte affiché tel quel, jamais interprété comme une consigne.",
    approvedNotSent: "Validé : le message attend un envoi explicite. Rien n'est parti.",

    validate: "Valider",
    refuse: "Refuser",
    edit: "Modifier",
    send: "Envoyer (simulation)",
    working: "Action en cours…",
    sendBlocked: "Envoi impossible : consentement du canal manquant ou retiré.",

    successValidated: "Message validé. Rien n'a été envoyé.",
    successRejected: (reason: string) => `Message refusé (${reason}) : il ne partira pas.`,
    successSent: "Envoi simulé effectué : aucune communication réelle n'a quitté le produit.",
    actionErrorTitle: "L'action n'a pas abouti",

    rejectTitle: "Pourquoi refuser ce message ?",
    rejectHint:
      "Le motif est obligatoire : c'est lui qui permettra de corriger les agents IA plus tard.",
    rejectReasonLegend: "Motif du refus",
    rejectNote: "Note (facultative)",
    rejectNoteHint: (max: number) =>
      `${max} caractères maximum. Écrite par un membre de l'agence, jamais par un agent IA.`,
    rejectConfirm: "Confirmer le refus",
    cancel: "Annuler",

    editTitle: "Corriger le message avant validation",
    editHint:
      "Seuls l'objet et le texte peuvent être corrigés : ni le canal, ni le destinataire. Un message corrigé repasse « à valider ».",
    editSubject: "Objet",
    editBody: "Message",
    editBodyHint: (max: number) => `${max} caractères maximum.`,
    editSave: "Enregistrer la correction",
    editSuccess: "Message corrigé. Il reste à valider avant tout envoi.",
    editSuccessRevalidation:
      "Message corrigé : la validation précédente est annulée, il doit être validé de nouveau.",
  },

  /**
   * Boîte de réception des leads — le travail de Léa.
   *
   * Règle produit rappelée à l'écran : **un lead n'est pas un consentement**.
   */
  leadsInbox: {
    title: "Leads entrants",
    subtitle:
      "Les demandes reçues, avant toute fiche contact. Léa vérifie la source, dédoublonne et crée la fiche.",
    ruleTitle: "Un lead n'est pas un consentement",
    ruleBody:
      "Recevoir une demande n'autorise aucun envoi : tant qu'un consentement prouvable n'a pas été recueilli et enregistré, aucun email, SMS ni appel n'est possible. Léa ouvre une tâche pour le recueillir.",
    count: (total: number) => (total > 1 ? `${total} leads` : `${total} lead`),
    errorTitle: "Impossible d'afficher les leads entrants",
    emptyTitle: "Aucun lead entrant",
    emptyBody:
      "Les demandes du site public et des logiciels immobiliers arrivent ici, avant toute création de fiche.",
    emptyAction: "Voir les contacts",
    source: "Source",
    receivedAt: "Reçu le",
    fields: "Éléments transmis",
    noFields: "Aucun élément d'identité exploitable",
    rawText: "Message du prospect",
    rawTextNone: "Aucun message joint à ce lead.",
    untrusted: "Texte du prospect : traité comme donnée, jamais comme instruction.",
    // Neutral on purpose: after a duplicate, the record already existed —
    // saying « créée » would claim a second record that was never created.
    contactLink: "Voir la fiche contact",
    run: "Lancer Léa",
    runHint: "Vérifie la source, dédoublonne, crée la fiche. Ne recueille aucun consentement.",
    running: "Léa travaille…",
    alreadyProcessed: "Ce lead a déjà été traité : aucune seconde fiche ne sera créée.",
    successTitle: "Léa a terminé",
    errorActionTitle: "Léa n'a pas pu traiter ce lead",
    viewReplay: "Voir le rejeu",
    duplicateMatched: (fields: string) => `Doublon détecté sur : ${fields}`,
    missingFields: "Éléments manquants signalés",
    taskCreated: "Tâche créée pour un conseiller",
  },

  /**
   * Suivi des rendez-vous d'estimation — le travail de Sarah.
   *
   * Règle produit rappelée à l'écran : **le compte-rendu est écrit par un
   * humain**, et **le mandat signé n'est jamais auto-déclaré**.
   */
  followThrough: {
    title: "Suivi des rendez-vous",
    subtitle:
      "Confirmez le créneau, consignez le rendez-vous réalisé, puis confiez son suivi à Sarah.",
    ruleTitle: "Le compte-rendu est écrit par un humain",
    ruleBody:
      "Un conseiller confirme le rendez-vous et rédige son compte-rendu. Sarah peut ensuite l'exploiter, sans jamais inventer d'information ni déclarer un mandat signé.",
    count: (total: number) =>
      total > 1 ? `${total} rendez-vous à suivre` : `${total} rendez-vous à suivre`,
    errorTitle: "Impossible d'afficher les rendez-vous à suivre",
    emptyTitle: "Aucun rendez-vous à suivre",
    emptyBody:
      "Les propositions de Louis et les rendez-vous confirmés ou réalisés apparaissent ici.",
    emptyAction: "Voir les contacts",
    when: "Rendez-vous",
    report: "Compte-rendu du conseiller",
    reportMissing: "Aucun compte-rendu saisi : Sarah ne peut rien en déduire.",
    reportRecordedAt: "Saisi le",
    status: "Statut du rendez-vous",
    confirm: "Confirmer le rendez-vous",
    confirming: "Confirmation…",
    confirmSuccess: "Rendez-vous confirmé. Le créneau est maintenant réservé par un humain.",
    completeTitle: "Consigner le rendez-vous réalisé",
    completeHint:
      "Compte-rendu obligatoire, rédigé par le conseiller. Ce texte servira au suivi après la clôture.",
    completePlaceholder: "Décrivez les faits observés, la position du vendeur et les prochaines actions…",
    complete: "Enregistrer le compte-rendu",
    completing: "Enregistrement…",
    completeSuccess: "Rendez-vous réalisé et compte-rendu enregistré. Sarah peut maintenant intervenir.",
    workflowErrorTitle: "Le rendez-vous n'a pas pu être mis à jour",
    run: "Lancer Sarah",
    runHint: "Exploite le compte-rendu et ouvre les actions de suivi. Ne déclare jamais un mandat signé.",
    running: "Sarah travaille…",
    successTitle: "Sarah a terminé le suivi",
    errorActionTitle: "Sarah n'a pas pu suivre ce rendez-vous",
    blockedNoReport: "Compte-rendu manquant : le suivi ne peut pas être lancé.",
    reportUntrusted:
      "Texte du conseiller affiché tel quel : Sarah le traite comme une donnée, jamais comme une instruction.",
    sellerPosition: "Position du vendeur",
    summary: "Synthèse du compte-rendu",
    objections: "Points de vigilance",
    noObjection: "Aucun point de vigilance relevé.",
    missingDocuments: "Documents à obtenir",
    noMissingDocument: "Aucun document manquant relevé.",
    nextSteps: "Prochaines actions proposées",
    noNextStep: "Aucune action supplémentaire proposée.",
    estimationPresented: "Estimation présentée pendant le rendez-vous",
    yes: "Oui",
    no: "Non",
    unknown: "Non renseigné",
    taskCount: (total: number) =>
      total > 1 ? `${total} tâches ouvertes pour l'équipe` : `${total} tâche ouverte pour l'équipe`,
    stageChanged: "Le contact passe à l'étape suivante.",
    stageUnchanged: "L'étape du contact reste inchangée.",
    viewReplay: "Voir le rejeu",
    openContact: "Voir la fiche",
  },

  /** One past execution, replayed from the journal. */
  runDetail: {
    pageTitle: "Exécution d'agent",
    back: "Agents IA",
    errorTitle: "Impossible d'afficher cette exécution",
    headTitle: (agent: string) => `Exécution de ${agent}`,
    headCardTitle: "Détails de l'exécution",
    startedAt: "Démarrée le",
    finishedAt: "Terminée le",
    stillRunning: "Exécution encore en cours",
    provider: "Fournisseur",
    model: "Modèle",
    tokens: "Jetons (entrée / sortie)",
    decision: "Décision journalisée",
    errorCode: "Motif d'arrêt journalisé",
    contact: "Contact",
    unknown: "Non renseigné",
  },

  /**
   * Tableau de bord (`/dashboard`).
   *
   * Every figure is displayed with its scope (period or perimeter), and a
   * figure that could not be computed reads « Indisponible », never `0`.
   * Nothing here is a trend or a percentage: the screen only shows what the
   * server counted exactly.
   */
  dashboard: {
    title: "Tableau de bord",
    subtitle: "Ce qui attend votre équipe, calculé uniquement à partir des données réellement enregistrées.",
    generatedAt: (when: string) => `Chiffres lus le ${when} (heure de Paris)`,
    errorTitle: "Impossible d'afficher le tableau de bord",

    /** Scope of a figure, always displayed next to it. */
    scopes: {
      pending_all_time: "en attente, toutes dates",
      open_all_time: "ouvertes, toutes dates",
      current: "état actuel",
      today: "aujourd'hui",
      last_7_days: "sur 7 jours",
      upcoming: "à venir",
    } satisfies Record<DashboardScopeKey, string>,
    scopePrefix: "Périmètre :",
    unavailable: "Indisponible",
    unavailableHint: "Ce chiffre n'a pas pu être calculé. Les autres restent exacts ; rechargez la page pour réessayer.",
    sample: (shown: number, total: number) => `Les ${shown} premiers sur ${total}`,
    sampleFeminine: (shown: number, total: number) => `Les ${shown} premières sur ${total}`,
    viewAll: "Tout voir",
    openContact: "Ouvrir la fiche",

    todoTitle: "À faire maintenant",
    todoSubtitle: "Les dossiers qui attendent une décision humaine, du plus ancien au plus récent.",

    messagesTitle: "Messages à valider",
    messagesUnit: (total: number) =>
      total > 1 ? "messages à valider ou validés, pas encore envoyés" : "message à valider ou validé, pas encore envoyé",
    messagesHint:
      "Même file que l'écran « Messages à valider » : les brouillons à valider et ceux validés qui attendent encore leur envoi.",
    messagesEmpty: "Aucun message n'attend de décision.",
    messagesLink: "Ouvrir la file de validation",
    preparedBy: (agent: string) => `Préparé par ${agent}`,
    writtenByHuman: "Rédigé par un conseiller",
    approvedNotSent: "Validé, pas encore envoyé",

    leadsTitle: "Leads entrants à traiter",
    leadsUnit: (total: number) => (total > 1 ? "leads pas encore traités par Léa" : "lead pas encore traité par Léa"),
    leadsEmpty: "Aucun lead en attente de traitement.",
    leadsLink: "Ouvrir les leads entrants",
    leadItem: (source: string) => `Lead entrant — ${source}`,
    receivedAt: (when: string) => `Reçu le ${when}`,

    toConfirmTitle: "Rendez-vous à confirmer",
    toConfirmUnit: (total: number) =>
      total > 1 ? "propositions de créneau à confirmer par un conseiller" : "proposition de créneau à confirmer par un conseiller",
    toConfirmEmpty: "Aucune proposition de rendez-vous à confirmer.",

    toCloseTitle: "Rendez-vous à clôturer",
    toCloseUnit: (total: number) =>
      total > 1 ? "rendez-vous confirmés, compte-rendu à saisir" : "rendez-vous confirmé, compte-rendu à saisir",
    toCloseEmpty: "Aucun rendez-vous confirmé en attente de compte-rendu.",
    followThroughLink: "Ouvrir le suivi des rendez-vous",

    tasksTitle: "Tâches ouvertes",
    tasksUnit: (total: number) => (total > 1 ? "tâches ouvertes" : "tâche ouverte"),
    tasksHint: "Les tâches se traitent depuis la fiche du contact concerné.",
    tasksEmpty: "Aucune tâche ouverte.",
    tasksLink: "Voir les contacts",
    agencyTask: "Tâche d'agence, sans contact",
    dueAt: (when: string) => `Échéance : ${when}`,
    noDueDate: "Sans échéance",
    openedBy: (agent: string) => `Ouverte par ${agent}`,

    pipelineTitle: "Pipeline",
    pipelineSubtitle: "Nombre de dossiers à chaque étape, compté exactement en base.",
    pipelineUnit: (total: number) => (total > 1 ? "dossiers" : "dossier"),
    pipelineLink: "Ouvrir le pipeline",
    pipelineLostNote: "Étape qui n'est plus travaillée activement.",

    agentsTitle: "Agents IA",
    agentsSubtitle: "Coupe-circuit et exécutions réellement enregistrées, sur simulateur.",
    agentsLink: "Gérer les agents IA et le coupe-circuit",
    killSwitchLabel: "Coupe-circuit",
    killSwitchOn: "Actif : tous les agents IA sont suspendus",
    killSwitchOff: "Inactif : les agents IA peuvent s'exécuter",
    runsTotal: "Exécutions",
    runsFailed: "Erreurs",
    runsBlocked: "Bloquées par un garde-fou",
    runsBlockedHint:
      "Un blocage n'est pas une erreur : un garde-fou (coupe-circuit, limite quotidienne, reprise par un conseiller) a refusé l'exécution.",
    runsWindowTitle: (scope: string) => `Exécutions ${scope}`,

    upcomingTitle: "Prochains rendez-vous",
    upcomingSubtitle: "Rendez-vous d'estimation proposés ou confirmés, du plus proche au plus lointain.",
    // "rendez-vous" is invariable: same unit in the singular and the plural.
    upcomingUnit: () => "rendez-vous à venir",
    upcomingEmpty: "Aucun rendez-vous d'estimation à venir.",
    appointmentStatusPrefix: "Statut du rendez-vous :",
  },

  /** One-line promises of the screens that are still shells. */
  shells: {
    agents:
      "Léa, Hugo, Emma, Louis et Sarah : mission, statut, historique, erreurs — et coupe-circuit de l'agence.",
    agentsToValidate:
      "Chaque premier contact préparé par un agent IA est validé par un humain avant tout envoi.",
    settings: "Agence, utilisateurs, intégrations et conservation des données.",
    signUpTitle: "Inscription",
    signUpBody: `La création de compte d'agence se fait avec l'équipe ${BRAND.name} lors de la mise en place.`,
  },

  marketing: {
    heroKicker: "Le cycle vendeur, orchestré",
    heroTitle: "De la demande vendeur au mandat, sans lâcher le contrôle.",
    heroSubtitle: "Cinq agents spécialisés préparent le travail. Votre équipe garde chaque décision sensible.",
    heroNote: "Prototype de démonstration. Aucune donnée réelle, aucun envoi réel.",
    signIn: "Espace agence",
    estimation: "Demander une estimation",
    proofTitle: "Ce que la démonstration prouve",
    proofs: [
      { value: "5", label: "rôles bornés, du lead au mandat" },
      { value: "100 %", label: "des premiers messages validés par un humain" },
      { value: "Journalisé", label: "décisions, blocages et erreurs consultables" },
      { value: "Simulation", label: "aucune action externe réelle" },
    ],
    storyKicker: "Un dossier, cinq relais",
    storyTitle: "Chaque agent sait où son travail commence. Et où il s'arrête.",
    storyBody:
      "Le dossier avance dans un ordre lisible. Les informations manquantes deviennent des tâches, jamais des suppositions.",
    agents: [
      {
        name: "Léa",
        role: "Acquisition",
        action: "Vérifie la source, dédoublonne et crée une fiche propre.",
        boundary: "Ne transforme jamais une demande en consentement.",
      },
      {
        name: "Hugo",
        role: "Qualification",
        action: "Structure le bien, le secteur, la motivation et le délai.",
        boundary: "Signale ce qui manque au lieu de l'inventer.",
      },
      {
        name: "Emma",
        role: "Relation",
        action: "Prépare une relance adaptée au contexte enregistré.",
        boundary: "Le premier message reste soumis à validation.",
      },
      {
        name: "Louis",
        role: "Rendez-vous",
        action: "Propose un créneau d'estimation et prépare le dossier.",
        boundary: "Ne réserve jamais deux fois le même créneau.",
      },
      {
        name: "Sarah",
        role: "Suivi",
        action: "Transforme le compte-rendu humain en prochaines actions.",
        boundary: "Ne déclare jamais seule un mandat signé.",
      },
    ],
    controlKicker: "Le contrôle reste humain",
    controlTitle: "L'automatisation accélère. Elle ne décide pas à votre place.",
    controlBody:
      "Consentement, premier contact et mandat signé restent sous contrôle de l'agence. Un coupe-circuit suspend les cinq agents immédiatement.",
    controls: [
      "Validation humaine avant le premier envoi",
      "Décisions, blocages et erreurs journalisés",
      "Informations du prospect traitées comme des données non fiables",
      "Mode simulation visible dans toute la démonstration",
    ],
    finalTitle: "Voyez le parcours complet avec un bien fictif.",
    finalBody:
      "Commencez par une demande d'estimation, puis retrouvez le dossier dans l'espace agence.",
  },

  emmaFollowUps: {
    title: "Relances Emma",
    subtitle:
      "Emma prépare une relance adaptée au dossier. Le canal et le consentement sont vérifiés par le code avant toute rédaction.",
    count: (total: number) => (total > 1 ? `${total} dossiers éligibles` : `${total} dossier éligible`),
    ruleTitle: "Un brouillon, jamais un envoi",
    ruleBody:
      "Emma ne choisit ni le destinataire ni le canal et n'envoie rien. Chaque proposition rejoint la file de validation humaine.",
    emptyTitle: "Aucun dossier à relancer",
    emptyBody:
      "Les dossiers signés, perdus ou repris par un conseiller sont exclus automatiquement.",
    emptyAction: "Voir les contacts",
    errorTitle: "Impossible d'afficher les dossiers à relancer",
    cardStage: "Étape actuelle",
    cardContact: "Coordonnées disponibles",
    emailAvailable: "Email renseigné",
    phoneAvailable: "Téléphone renseigné",
    noReachableDetail: "Aucune coordonnée exploitable",
    humanTakeover: "Dossier repris par un conseiller",
    pendingDraft: "Une relance attend déjà une validation humaine",
    consentOrChannelMissing: "Consentement ou coordonnée exploitable manquant",
    ready: "Prêt pour vérification serveur",
    run: "Préparer la relance",
    running: "Emma prépare le brouillon…",
    runHint:
      "Le serveur revérifie le consentement, les doublons et le coupe-circuit avant de lancer Emma.",
    successTitle: "Emma a préparé une relance",
    errorActionTitle: "Emma n'a préparé aucun brouillon",
    draftSubject: "Objet",
    draftBody: "Message proposé",
    channel: "Canal vérifié",
    confidence: "Confiance du modèle",
    nothingSent: "Rien n'a été envoyé. Ce brouillon attend une décision humaine.",
    openContact: "Ouvrir la fiche",
    openQueue: "Valider le message",
    viewReplay: "Voir le rejeu",
  },

  /**
   * Formulaire public de demande d'estimation (`/estimation`) — le principal
   * canal d'acquisition de leads. Aucun prix ni fourchette n'est jamais
   * affiché ici : la promesse est un rappel humain, jamais un chiffre.
   *
   * Les textes de consentement eux-mêmes ne viennent PAS d'ici : ils viennent
   * mot pour mot de `features/estimation/consent-texts.ts`, pour rester
   * identiques à ce qui est enregistré en base comme preuve.
   */
  estimation: {
    eyebrow: "Demande d'estimation",
    title: "Parlez-nous de votre bien",
    subtitle:
      "Quelques informations suffisent pour démarrer. Un conseiller de l'agence étudie votre demande et vous recontacte — aucune estimation chiffrée n'est communiquée par ce formulaire.",

    metaDescription:
      "Demandez l'étude de votre bien par un conseiller de l'agence. Aucun prix n'est calculé ni communiqué par ce formulaire.",

    // Visible required marker, part of the label text: the `required`
    // attribute alone is only announced to screen readers (WCAG 3.3.2).
    requiredMark: "(obligatoire)",

    identityTitle: "Vos coordonnées",
    identitySubtitle: "Pour que l'agence sache qui recontacter, et comment.",
    firstName: "Prénom",
    lastName: "Nom",
    email: "Adresse email",
    phone: "Téléphone",
    contactHint: "Indiquez au moins une adresse email ou un numéro de téléphone.",

    propertyTitle: "Votre bien",
    propertySubtitle: "Ce que vous savez déjà. Le reste se précise avec l'agence.",
    propertyType: "Type de bien",
    city: "Ville",
    postalCode: "Code postal",
    surface: "Surface habitable",
    surfaceHint: "Facultatif, en m².",
    rooms: "Nombre de pièces",
    roomsHint: "Facultatif.",
    message: "Message",
    messageHint: "Facultatif : précisez ce qui vous semble utile, en toute liberté.",

    consentTitle: "Comment pouvons-nous vous recontacter ?",
    consentSubtitle:
      "Cochez chaque moyen de contact que vous autorisez. Aucune case n'est cochée par défaut : sans case cochée, l'agence ne peut vous recontacter par aucun moyen.",
    consentGroupError: "Cochez au moins un moyen de contact autorisé.",
    privacyPolicyIntro: "En envoyant ce formulaire, vous acceptez le traitement de vos données selon notre",
    privacyPolicyLink: "politique de confidentialité",

    submit: "Envoyer ma demande",
    submitting: "Envoi en cours…",
    // True by construction, not a marketing promise: the first message to a
    // contact is always validated by a human (CLAUDE.md, garde-fous produit).
    submitNote:
      "Votre demande est transmise à l'agence. Aucun message ne vous est adressé avant qu'un conseiller ne l'ait validé.",

    formErrorTitle: "Certaines informations doivent être corrigées",
    formErrorBody: "Vérifiez les champs signalés ci-dessous avant d'envoyer votre demande.",
    // Shown when nothing could be pointed at a precise field: never leave the
    // visitor looking for a message that is not displayed.
    formErrorBodyGeneric: "Relisez les informations saisies avant d'envoyer votre demande.",
    serverErrorTitle: "Votre demande n'a pas pu être envoyée",

    successTitle: "Demande envoyée",
    successBody:
      "Un conseiller de l'agence va étudier votre demande et vous recontacte prochainement, par les moyens que vous avez autorisés.",
    successNote: "Aucune estimation chiffrée n'est communiquée par ce formulaire.",

    // Format hints only (never a business rule): the authoritative bounds
    // live in `estimationRequestSchema`, reused as-is by the form.
    surfaceInvalid: "Indiquez une surface positive, en mètres carrés (100 000 m² maximum).",
    roomsInvalid: "Indiquez un nombre de pièces entier et positif (50 maximum).",
  },

  /**
   * Politique de confidentialité liée depuis le formulaire d'estimation.
   *
   * Prototype de démonstration : aucun contact réel, aucune donnée réelle.
   * Contenu volontairement prudent, à faire valider par un juriste avant
   * toute mise en production (voir CLAUDE.md, « Socle légal et sécurité »).
   */
  privacy: {
    title: "Politique de confidentialité",
    metaDescription:
      "Données recueillies par le formulaire d'estimation, finalité, consentement par canal, conservation et droits.",
    prototypeNotice:
      "Prototype de démonstration : ce site ne contacte personne et ne traite aucune donnée personnelle réelle. Ce texte doit être validé par un juriste avant toute mise en production.",
    sections: [
      {
        heading: "Qui traite vos données",
        body: `L'agence immobilière propriétaire du compte ${BRAND.name} est seule responsable du traitement des données recueillies par ce formulaire.`,
      },
      {
        heading: "Quelles données",
        body: "Identité, coordonnées, informations sur le bien à estimer, et le message libre que vous rédigez éventuellement.",
      },
      {
        heading: "Pourquoi",
        body: "Recontacter au sujet de votre demande d'estimation, uniquement par les canaux que vous avez explicitement autorisés.",
      },
      {
        heading: "Ce que ce formulaire ne fait pas",
        body: "Il ne calcule aucun prix et ne communique aucune estimation chiffrée : il transmet votre demande à l'agence, qui l'étudie. Aucune donnée n'est vendue, et aucun canal que vous n'avez pas coché n'est utilisé.",
      },
      {
        heading: "Base légale",
        body: "Votre consentement, donné canal par canal. Aucune case n'est cochée par défaut, et vous pouvez le retirer à tout moment (voir le texte présenté à côté de chaque case).",
      },
      {
        heading: "Preuve de votre consentement",
        body: "Pour chaque case cochée, nous enregistrons la date, le canal concerné, le texte exact qui vous a été présenté et sa version, ainsi qu'une trace technique de l'envoi : une empreinte non réversible de votre adresse IP et l'identification de votre navigateur. Ces éléments servent uniquement à prouver votre accord.",
      },
      {
        heading: "Retirer votre consentement",
        body: "Chaque case indique comment revenir en arrière : lien de désinscription dans les emails, réponse STOP pour les SMS et WhatsApp, simple demande pour le téléphone. Un retrait arrête les relances immédiatement, sans avoir à justifier votre choix.",
      },
      {
        heading: "Conservation",
        body: "Les données sont conservées le temps nécessaire au traitement de votre demande, puis selon la politique de conservation de l'agence. La preuve d'un consentement est conservée aussi longtemps qu'elle peut devoir être produite.",
      },
      {
        heading: "Vos droits",
        body: "Vous pouvez demander l'accès, la rectification ou l'effacement de vos données en contactant directement l'agence.",
      },
    ],
    backToEstimation: "Retour au formulaire d'estimation",
  },
} as const;
