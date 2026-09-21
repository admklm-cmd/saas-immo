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

import type { ConsentStatus, PropertyType } from "@/features/contacts/types";

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

export const APP_TEXTS = {
  brand: {
    name: "AiaA",
    tagline: "CRM et agents IA pour agences immobilières indépendantes",
    prototype: "Prototype",
  },

  nav: {
    primaryLabel: "Navigation principale",
    skipToContent: "Aller au contenu",
    dashboard: "Tableau de bord",
    contacts: "Contacts vendeurs",
    pipeline: "Pipeline",
    agents: "Agents IA",
    agentsLeads: "Leads entrants",
    agentsToValidate: "Messages à valider",
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

    notFoundTitle: "Contact introuvable.",
    notFoundBody: "Ce contact n'existe pas ou n'appartient pas à votre agence.",
  },

  agents: {
    panelTitle: "Agents IA",
    panelSubtitle:
      "Les agents travaillent sur simulateur : aucune action externe n'est réellement exécutée.",
    runHugo: "Lancer Hugo",
    runHugoHint: "Qualification : type de bien, secteur, motivation et délai du projet.",
    runLouis: "Lancer Louis",
    runLouisHint: "Rendez-vous : propose un créneau d'estimation et rédige le message.",
    running: "Exécution en cours…",
    blockedTitle: "Action bloquée par un garde-fou",
    errorTitle: "L'agent n'a pas pu s'exécuter",
    hugoSuccessTitle: "Hugo a terminé la qualification",
    louisSuccessTitle: "Louis a préparé une proposition de rendez-vous",
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
      "Après l'estimation : Sarah exploite le compte-rendu rédigé par un conseiller et ouvre les actions de suivi.",
    ruleTitle: "Le compte-rendu est écrit par un humain",
    ruleBody:
      "Sarah n'invente rien et ne déclare jamais un mandat signé : sans compte-rendu, elle ouvre une tâche pour le conseiller qui a réalisé le rendez-vous.",
    count: (total: number) =>
      total > 1 ? `${total} rendez-vous réalisés` : `${total} rendez-vous réalisé`,
    errorTitle: "Impossible d'afficher les rendez-vous à suivre",
    emptyTitle: "Aucun rendez-vous à suivre",
    emptyBody:
      "Les rendez-vous d'estimation réalisés apparaissent ici, avec leur compte-rendu, dès qu'ils sont passés.",
    emptyAction: "Voir les contacts",
    when: "Rendez-vous",
    report: "Compte-rendu du conseiller",
    reportMissing: "Aucun compte-rendu saisi : Sarah ne peut rien en déduire.",
    reportRecordedAt: "Saisi le",
    run: "Lancer Sarah",
    runHint: "Exploite le compte-rendu et ouvre les actions de suivi. Ne déclare jamais un mandat signé.",
    running: "Sarah travaille…",
    successTitle: "Sarah a terminé le suivi",
    errorActionTitle: "Sarah n'a pas pu suivre ce rendez-vous",
    blockedNoReport: "Compte-rendu manquant : le suivi ne peut pas être lancé.",
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

  /** One-line promises of the screens that are still shells. */
  shells: {
    dashboard: "Statistiques de l'agence, calculées uniquement à partir des données réellement enregistrées.",
    pipeline: "Vue par étape, du premier contact au mandat signé.",
    agents:
      "Léa, Hugo, Emma, Louis et Sarah : mission, statut, historique, erreurs — et coupe-circuit de l'agence.",
    agentsToValidate:
      "Chaque premier contact préparé par un agent IA est validé par un humain avant tout envoi.",
    settings: "Agence, utilisateurs, intégrations et conservation des données.",
    estimation: "Formulaire d'estimation en ligne, avec recueil du consentement canal par canal.",
    signUpTitle: "Inscription",
    signUpBody: "La création de compte d'agence se fait avec l'équipe AiaA lors de la mise en place.",
  },

  marketing: {
    heroTitle: "AiaA",
    heroSubtitle:
      "Le CRM et les agents IA qui aident les agences immobilières indépendantes à gagner plus de mandats.",
    heroNote: "Prototype de démonstration. Aucune donnée réelle, aucun envoi réel.",
    signIn: "Espace agence",
    estimation: "Estimer mon bien",
  },
} as const;
