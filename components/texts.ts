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
import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";
import type { AppointmentView } from "@/features/appointments/types";
import type { ConsentStatus, PropertyType } from "@/features/contacts/types";
import type { DashboardScopeKey } from "@/features/dashboard/types";
import type { EstimationConsentChannel } from "@/features/estimation/consent-texts";
import type { PropertyTypeChoice } from "@/features/estimation/types";
import type { SettingsIntegrationCategory } from "@/features/settings/types";
import type { TaskScope } from "@/features/tasks/types";
import type { AgentRunStatus } from "@/lib/agents/messages";
import type { MembershipRole } from "@/lib/agents/types";

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

/**
 * Role of a member in the agency, as displayed (team list, history of a
 * contact). One source, so « Directeur » never reads differently on two screens.
 */
export const MEMBERSHIP_ROLE_LABELS: Readonly<Record<MembershipRole, string>> = {
  agent: "Conseiller",
  director: "Directeur",
};

/**
 * Outcome of an AI run, as the interface names it. Deliberately more explicit
 * than the short journal labels: a run refused by a guard rail is the product
 * doing its job, never an error, and must never read like one.
 */
export const RUN_OUTCOME_LABELS: Readonly<Record<AgentRunStatus, string>> = {
  running: "En cours",
  succeeded: "Réussie",
  failed: "Erreur technique",
  blocked: "Bloquée par un garde-fou",
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
    tasks: "Tâches",
    appointments: "Rendez-vous",
    settings: "Paramètres",
    /** Groups of the primary navigation (docs/design-system.md §2.10). */
    groupPilotage: "Pilotage",
    groupAgents: "Agents IA",
    groupSettings: "Réglages",
    /** Entry of `/agents-ia` inside the « Agents IA » group. */
    agentsOverview: "Vue d'ensemble",
    menuOpen: "Menu",
    menuClose: "Fermer",
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
    // Label of a request that runs on the simulator (ThreeDotLoader in a button).
    simulationRunning: "Simulation en cours…",
    // Passive wait for a human decision (PendingDots) — never a processing state.
    pendingValidation: "En attente de validation",
    notFoundTitle: "Page introuvable",
    notFoundBody: "Le lien est peut-être obsolète, ou la page n'existe pas.",
    unexpected: "Une erreur technique est survenue. Aucune action n'a été effectuée.",
  },

  /**
   * An action refused by a guard rail (kill switch, daily limit, human takeover,
   * consent, signed mandate…). Informative, never alarming: nothing broke, a
   * rule of the agency applied. Technical errors keep their own wording.
   */
  guardRail: {
    title: "Bloquée par un garde-fou",
    reason: "Motif",
    notAnError: "Ce n'est pas une erreur : une règle de l'agence a refusé l'action, rien n'a été fait.",
    stopped: "Arrêt décidé par un garde-fou : ce n'est pas une erreur.",
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
    /** Mobile list of contacts (the table becomes one card per contact under 768 px). */
    listLabel: "Contacts de l'agence",
    /** Legend of the shapes of the table (decorative: each shape also carries its words). */
    legendOpenTasks: "Tâches ouvertes",
    /** Last update under the name, when the table folds its own column away (768–1279 px). */
    updatedOn: "Mis à jour le",
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
    // Human review of a message: author and time exactly as stored server-side.
    reviewApproved: "Validé",
    reviewRejected: "Refusé",
    reviewBy: (author: string) => `par ${author}`,
    reviewAuthorWithRole: (email: string, role: string) => `${email} (${role})`,
    reviewAtPrefix: "le",
    reviewAuthorUnknown: "Auteur non disponible",
    reviewPending: "En attente de validation humaine",

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
    /** Unit written after the big figure of a column (figure + unit read as `columnCount`). */
    columnUnit: (total: number) => (total > 1 ? "dossiers" : "dossier"),
    columnEmpty: "Aucun dossier à cette étape.",
    lostSubtitle: "Affichée à part : cette étape n'est plus travaillée activement.",
    /** Position of a column in the seller's journey (readable on a phone, one column per screen). */
    stageIndex: (position: number, total: number) => `Étape ${position} sur ${total}`,
    /** Name of the horizontally scrolling board. Must never contain a stage label. */
    boardLabel: "Parcours des dossiers, de gauche à droite",
    /** Jump links above the board, one per stage. */
    stageNavLabel: "Aller à une étape du parcours",

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

  /** Pagination of a server list (« 26–50 sur 131 », Précédent / Suivant). */
  pagination: {
    label: "Pagination",
    range: (from: number, to: number, total: number) => `${from}–${to} sur ${total}`,
    previous: "Précédent",
    next: "Suivant",
  },

  /**
   * Tâches (`/taches`) — the open to-do list of the agency.
   *
   * The figure is the EXACT total of the chosen filter, always shown with its
   * scope. « En retard » is written in words, never carried by a colour.
   */
  tasks: {
    title: "Tâches",
    subtitle:
      "Le travail qui attend un membre de l'agence, souvent ouvert par un agent IA qui a refusé d'inventer une information manquante.",
    filtersLabel: "Filtrer les tâches",
    filters: {
      all: "Toutes",
      overdue: "En retard",
      mine: "Les miennes",
    } satisfies Record<TaskScope, string>,
    unit: (total: number) => (total > 1 ? "tâches ouvertes" : "tâche ouverte"),
    scopes: {
      all: "toutes dates",
      overdue: "échéance dépassée à l'instant de la lecture",
      mine: "qui vous sont assignées, toutes dates",
    } satisfies Record<TaskScope, string>,
    listLabel: "Tâches ouvertes",
    errorTitle: "Impossible d'afficher les tâches",
    resetFilters: "Revenir à toutes les tâches",
    emptyTitles: {
      all: "Aucune tâche ouverte",
      overdue: "Aucune tâche en retard",
      mine: "Aucune tâche ne vous est assignée",
    } satisfies Record<TaskScope, string>,
    emptyBodies: {
      all: "Quand un agent IA ne peut pas compléter un dossier sans inventer, il ouvre une tâche : elle apparaîtra ici.",
      overdue: "Toutes les tâches ouvertes sont dans les temps.",
      mine: "Les tâches assignées à d'autres membres restent visibles dans « Toutes ».",
    } satisfies Record<TaskScope, string>,
    emptyAction: "Voir les contacts",
    emptyActionOtherScope: "Voir toutes les tâches",
    pastEndTitle: "Cette page est vide",
    pastEndBody: "La liste a changé depuis votre dernière lecture.",
    pastEndAction: "Revenir à la première page",
    agencyTask: "Tâche d'agence",
    contactPrefix: "Contact :",
    dueAt: (when: string) => `Échéance : ${when}`,
    noDueDate: "Sans échéance",
    overdue: "En retard",
    openedBy: (agent: string) => `Ouverte par ${agent}`,
    complete: "Marquer comme faite",
    completeFor: (title: string) => `— ${title}`,
    completing: "Enregistrement…",
    completed: (title: string) => `Tâche « ${title} » marquée comme faite.`,
    alreadyDoneTitle: "Rien à faire",
    completeErrorTitle: "La tâche n'a pas été modifiée",
  },

  /**
   * Rendez-vous d'estimation (`/rendez-vous`).
   *
   * « À venir » uses the same definition as the dashboard figure. Every
   * appointment of the prototype is simulated: no calendar is connected.
   */
  appointments: {
    title: "Rendez-vous d'estimation",
    subtitle: "Les rendez-vous d'estimation de l'agence, dans l'heure de Paris. Aucun agenda réel n'est connecté.",
    viewsLabel: "Période des rendez-vous",
    views: {
      upcoming: "À venir",
      past: "Passés",
    } satisfies Record<AppointmentView, string>,
    // "rendez-vous" is invariable: same unit in the singular and the plural.
    unit: () => "rendez-vous",
    scopes: {
      upcoming: "à venir, à partir de maintenant — proposés ou confirmés",
      past: "passés, tous statuts",
    } satisfies Record<AppointmentView, string>,
    listLabel: {
      upcoming: "Rendez-vous à venir",
      past: "Rendez-vous passés",
    } satisfies Record<AppointmentView, string>,
    errorTitle: "Impossible d'afficher les rendez-vous",
    resetFilters: "Revenir aux rendez-vous à venir",
    emptyTitles: {
      upcoming: "Aucun rendez-vous à venir",
      past: "Aucun rendez-vous passé",
    } satisfies Record<AppointmentView, string>,
    emptyBodies: {
      upcoming: "Louis propose un créneau depuis la fiche d'un contact qualifié ; un conseiller le confirme ensuite.",
      past: "Les rendez-vous dont l'heure est passée apparaîtront ici, quel que soit leur statut.",
    } satisfies Record<AppointmentView, string>,
    emptyAction: "Voir les contacts",
    pastEndTitle: "Cette page est vide",
    pastEndBody: "La liste a changé depuis votre dernière lecture.",
    pastEndAction: "Revenir à la première page",
    statusPrefix: "Statut du rendez-vous :",
    contactPrefix: "Contact :",
    confirmInFollowThrough: "Confirmer dans le suivi",
    closeInFollowThrough: "Clôturer dans le suivi",
    openInFollowThrough: "Ouvrir dans le suivi",
    actionFor: (name: string) => `— ${name}`,
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
    running: "Simulation en cours…",
    errorTitle: "Erreur technique : l'agent n'a pas pu s'exécuter",
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
    // Folded help under the replay: long explanations stay available, never permanent.
    howToRead: "Comment lire ce rejeu",
    // A run still marked « en cours »: the steps recorded so far, nothing assumed after them.
    inProgressState: "En cours",
    recordedSoFar: "Étapes enregistrées à ce stade",
    inProgressNote:
      "Exécution encore en cours : seules les étapes déjà enregistrées sont affichées, aucune étape suivante n'est supposée.",
  },

  /**
   * Compact, folded preview of an execution's process, shown under each run
   * listed on « Agents IA » (last run of an agent, recent issues, journal).
   * Same measured steps as the full replay; nothing is invented.
   */
  runProcess: {
    summary: "Voir le processus",
    loading: "Lecture des étapes enregistrées…",
    unavailableTitle: "Processus indisponible",
    stepsCount: (count: number) =>
      count > 1 ? `${count} étapes enregistrées` : `${count} étape enregistrée`,
    stoppedAt: (phase: string) => `Arrêt à l'étape « ${phase} »`,
    completed: "Toutes les étapes enregistrées sont terminées.",
    stepSr: (position: number, total: number, phase: string, status: string) =>
      `Étape ${position} sur ${total} : ${phase} — ${status}`,
    listLabel: "Étapes de l'exécution",
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
    outcomeBlocked: (count: number) =>
      count > 1 ? `Bloquées par un garde-fou : ${count}` : `Bloquée par un garde-fou : ${count}`,
    outcomeFailed: (count: number) =>
      count > 1 ? `Erreurs techniques : ${count}` : `Erreur technique : ${count}`,
    tokens: "Jetons",
    tokensValue: (input: number, output: number) => `${input} en entrée / ${output} en sortie`,
    lastRun: "Dernière exécution",
    lastErrors: "Erreurs et blocages récents",
    noError: "Aucune erreur ni blocage enregistré pour cet agent.",
    viewReplay: "Voir le rejeu",
    inboundLead: "Lead entrant",
    inboundLeadHint: "Léa travaille avant toute fiche : cette exécution n'est rattachée à aucun contact.",
    openContact: "Voir la fiche",
    // Page structure: decision first, then the runs concerned, then details.
    decisionTitle: "À décider",
    pendingCta: "Ouvrir la file à valider",
    pendingNone: "Aucun brouillon n'attend de validation.",
    figuresHelp: "Comment ces chiffres sont comptés",
    issuesSubtitle: "Les plus récents de chaque agent, du plus récent au plus ancien.",
    issuesHelp: "Erreur technique ou garde-fou ?",
    issuesHelpBody:
      "Une erreur technique est une défaillance à examiner. Un blocage par un garde-fou est une règle de l'agence qui a refusé l'action : rien n'a été fait, ce n'est pas une erreur.",
    issuesEmpty: "Aucune erreur ni blocage récent pour les cinq agents.",
    agentIssues: (count: number) =>
      count > 1 ? `${count} erreurs ou blocages récents` : `${count} erreur ou blocage récent`,
    agentIssuesLink: "Voir la liste",
    technicalDetails: "Détails techniques",
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
    summaryCount: (total: number) =>
      total > 1 ? `${total} exécutions enregistrées` : `${total} exécution enregistrée`,
    summaryHint: "Filtres, pagination et aperçu du processus de chaque exécution.",
    allSimulated: "Toutes les exécutions de cette liste sont simulées.",
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
    // The send is always simulated in this prototype: the busy label says so.
    sending: "Simulation en cours…",
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
    contactLink: "Ouvrir la fiche",
    // The payload carried no first name: said, never guessed from the free text.
    nameMissing: "Nom non transmis",
    run: "Lancer Léa",
    runHint: "Vérifie la source, dédoublonne, crée la fiche. Ne recueille aucun consentement.",
    running: "Simulation en cours…",
    alreadyProcessed: "Ce lead a déjà été traité : aucune seconde fiche ne sera créée.",
    successTitle: "Léa a terminé",
    errorActionTitle: "Erreur technique : Léa n'a pas pu traiter ce lead",
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
    running: "Simulation en cours…",
    successTitle: "Sarah a terminé le suivi",
    errorActionTitle: "Erreur technique : Sarah n'a pas pu suivre ce rendez-vous",
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
    errorCode: "Code d'erreur technique",
    blockedCode: "Garde-fou appliqué",
    outcome: "Résultat",
    contact: "Contact",
    unknown: "Non renseigné",
    outcomeTitle: "Résultat",
    measuredDuration: "Durée mesurée",
    runId: "Identifiant de l'exécution",
    technicalHint: "Dates, fournisseur, modèle, jetons et codes journalisés.",
  },

  /**
   * Rail « réseau opérationnel » of ONE dossier (docs/design-system.md §3.1).
   *
   * Every status comes from a recorded row (run, message review, appointment,
   * human stage change). A stage with nothing recorded reads « En attente »;
   * one skipped while a later one was recorded reads « Aucune trace pour ce
   * dossier ». No percentage, no estimated duration.
   */
  dossierJourney: {
    title: "Parcours du dossier",
    subtitle:
      "Étapes réellement enregistrées pour ce dossier. Une étape sans trace reste en attente : rien n'est supposé.",
    listLabel: (contact: string) => `Parcours du dossier de ${contact}`,
    selectedTitle: "Dernier dossier traité",
    selectedSubtitle: (agent: string, contact: string) =>
      `Dernière exécution enregistrée rattachée à un contact : ${agent}, pour ${contact}.`,
    emptyTitle: "Aucun dossier traité pour l'instant",
    emptyBody:
      "Le parcours apparaîtra ici dès qu'un agent aura travaillé sur un dossier. Lancez Hugo, Emma ou Louis depuis une fiche contact.",
    emptyCta: "Ouvrir les contacts",
    unavailableTitle: "Parcours indisponible",
    loading: "Lecture de l'historique du dossier…",
    inboundLead:
      "Léa traite un lead entrant avant toute fiche contact : cette exécution n'appartient encore à aucun dossier.",
    openContact: "Voir la fiche",
    durationHint: "Seule l'exécution rejouée ici porte une durée : celle mesurée par le serveur.",
    stages: {
      prospect: { name: "Prospect", action: "Dossier ouvert" },
      lea: { name: "Léa", action: "Source vérifiée, fiche créée" },
      first_review: { name: "Validation humaine", action: "Premier contact" },
      hugo: { name: "Hugo", action: "Qualification" },
      emma: { name: "Emma", action: "Relance préparée" },
      follow_up_review: { name: "Validation humaine", action: "Relance" },
      louis: { name: "Louis", action: "Créneau d'estimation" },
      appointment: { name: "Rendez-vous", action: "Estimation" },
      sarah: { name: "Sarah", action: "Suivi jusqu'au mandat" },
      mandate: { name: "Mandat", action: "Confirmé par un humain" },
    },
    status: {
      pending: "En attente",
      untraced: "Aucune trace pour ce dossier",
      prospectDone: "Fiche créée",
      leaDone: "Trace enregistrée",
      reviewApproved: "Validé par l'agence",
      reviewRejected: "Refusé par l'agence",
      reviewPending: "Validation humaine nécessaire",
      appointmentProposed: "Proposé, à confirmer",
      mandateDone: "Confirmé par un humain",
    },
  },

  /** Level 1 of « Agents IA »: the immediate situation, exact counts only. */
  situation: {
    title: "Situation immédiate",
    listLabel: "Situation immédiate des agents IA",
    activeAgents: "Agents actifs",
    activeAgentsValue: (active: number, total: number) => `${active} sur ${total}`,
    pendingValidation: "Validations attendues",
    blocked: "Blocages par un garde-fou",
    failed: "Erreurs techniques",
    windowNote: (window: string) => `Blocages et erreurs comptés ${window}, dans le journal des exécutions.`,
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
    messagesUnit: (total: number) => (total > 1 ? "messages pas encore envoyés" : "message pas encore envoyé"),
    // One line on desktop, and still honest: the figure counts BOTH states.
    messagesHint: "À valider, ou validés en attente d'envoi.",
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
      total > 1 ? "propositions de créneau à confirmer" : "proposition de créneau à confirmer",
    toConfirmEmpty: "Aucune proposition de rendez-vous à confirmer.",

    toCloseTitle: "Rendez-vous à clôturer",
    toCloseUnit: (total: number) => (total > 1 ? "confirmés, compte-rendu à saisir" : "confirmé, compte-rendu à saisir"),
    toCloseEmpty: "Aucun rendez-vous confirmé en attente de compte-rendu.",
    followThroughLink: "Ouvrir le suivi des rendez-vous",

    tasksTitle: "Tâches ouvertes",
    tasksUnit: (total: number) => (total > 1 ? "tâches ouvertes" : "tâche ouverte"),
    tasksHint: "Même liste que l'écran « Tâches ».",
    tasksEmpty: "Aucune tâche ouverte.",
    tasksLink: "Ouvrir les tâches",
    agencyTask: "Tâche d'agence, sans contact",
    dueAt: (when: string) => `Échéance : ${when}`,
    noDueDate: "Sans échéance",
    openedBy: (agent: string) => `Ouverte par ${agent}`,

    pipelineUnit: (total: number) => (total > 1 ? "dossiers" : "dossier"),
    pipelineLink: "Ouvrir le pipeline",
    pipelineLostNote: "Étape qui n'est plus travaillée activement.",

    /** Pipeline frieze: the demonstration of the screen (docs/design-system.md §3.5). */
    friezeTitle: "Où en sont les dossiers",
    friezeSubtitle: "Chaque dossier à son étape, et les décisions humaines en chemin",
    friezeListLabel: "Étapes du pipeline, dans l'ordre du parcours vendeur",
    friezeLegendDot: "1 point = 1 dossier",
    friezeLegendHuman: "Décision humaine attendue",
    friezeCapped: (drawn: number) => `${drawn} points affichés`,
    friezeMandateNote: "Confirmé par un humain",
    friezeCheckpointNone: "Rien en attente",
    friezeCheckpoints: {
      leads: {
        title: "Leads à traiter",
        unit: (total: number) => (total > 1 ? "leads à traiter" : "lead à traiter"),
      },
      "to-confirm": {
        title: "Rendez-vous à confirmer",
        // "rendez-vous" is invariable.
        unit: () => "rendez-vous à confirmer",
      },
      "to-close": {
        title: "Comptes-rendus à saisir",
        unit: (total: number) => (total > 1 ? "comptes-rendus à saisir" : "compte-rendu à saisir"),
      },
    },

    agentsTitle: "Agents IA",
    agentsSubtitle: "Coupe-circuit et exécutions réellement enregistrées, sur simulateur.",
    agentsLink: "Gérer les agents IA et le coupe-circuit",
    killSwitchLabel: "Coupe-circuit",
    killSwitchOn: "Actif : tous les agents IA sont suspendus",
    killSwitchOff: "Inactif : les agents IA peuvent s'exécuter",
    runsTotal: "Exécutions",
    runsFailed: "Erreurs techniques",
    runsBlocked: "Bloquées par un garde-fou",
    runsBlockedHint:
      "Un blocage n'est pas une erreur : un garde-fou (coupe-circuit, limite quotidienne, reprise par un conseiller, consentement absent, mandat déjà signé…) a refusé l'exécution.",
    runsWindowTitle: (scope: string) => `Exécutions ${scope}`,

    upcomingTitle: "Prochains rendez-vous",
    upcomingSubtitle: "Rendez-vous d'estimation proposés ou confirmés, du plus proche au plus lointain.",
    // "rendez-vous" is invariable: same unit in the singular and the plural.
    upcomingUnit: () => "rendez-vous à venir",
    upcomingEmpty: "Aucun rendez-vous d'estimation à venir.",
    upcomingLink: "Ouvrir les rendez-vous",
    appointmentStatusPrefix: "Statut du rendez-vous :",
  },

  /**
   * `/parametres` — read-only. Only the existing kill switch can be operated
   * here; everything else is set with Ascend Strategy during onboarding.
   * Nothing on this screen may suggest a real connection or a retention period.
   */
  settings: {
    title: "Paramètres",
    subtitle: "Profil de l'agence, équipe, agents IA, intégrations et conservation des données.",
    readOnlyBadge: "Lecture seule",
    readOnlyTitle: "Cette page est en lecture seule",
    readOnlyBody: `Ces réglages sont définis avec ${BRAND.name} lors de la mise en place de votre agence : pour en modifier un, adressez-vous à l'équipe ${BRAND.name}. Seul le coupe-circuit des agents IA s'utilise directement ici.`,
    errorTitle: "Impossible d'afficher les paramètres",
    unavailable: "Indisponible",
    unavailableHint: "Cette section n'a pas pu être lue. Les autres sections restent à jour.",
    notProvided: "Non renseigné",

    agencyTitle: "Agence",
    agencySubtitle: "L'agence telle qu'elle est enregistrée.",
    agencyName: "Nom",
    agencyCity: "Ville",
    agencySector: "Secteur",

    teamTitle: "Équipe",
    teamSubtitle: "Les membres qui ont accès à l'espace de l'agence.",
    teamCount: (total: number) => (total > 1 ? `${total} membres` : `${total} membre`),
    teamEmpty: "Aucun membre à afficher.",
    you: "(vous)",
    noEmail: "Adresse email non renseignée",
    rolePrefix: "Rôle :",
    memberSince: (date: string) => `Membre depuis le ${date}`,

    agentsTitle: "Agents IA",
    agentsSubtitle: "Le coupe-circuit s'utilise ici, selon votre rôle. La limite quotidienne se consulte.",
    dailyLimitTitle: "Limite quotidienne",
    dailyLimitSubtitle: "Exécutions maximales des agents IA par journée, heure de Paris.",
    dailyLimitUnit: (limit: number) => (limit > 1 ? "exécutions par jour" : "exécution par jour"),
    dailyLimitHint:
      "Une fois la limite atteinte, les exécutions suivantes sont refusées par un garde-fou et journalisées, jusqu'au lendemain.",
    agentsLink: "Ouvrir les agents IA",

    integrationsTitle: "Intégrations",
    integrationsSubtitle:
      "Aucune intégration n'est connectée. Dans ce prototype, tout échange avec l'extérieur est simulé.",
    integrationCategories: {
      real_estate_software: "Logiciels immobiliers",
      messaging: "Messagerie",
      calendar: "Agendas",
    } satisfies Record<SettingsIntegrationCategory, string>,
    notConnected: "Non connectée",
    integrationSimulates: {
      outbound_messages: "Messages préparés et « envoyés » en simulation : rien ne part vers l'extérieur.",
      appointments: "Rendez-vous réservés en simulation : aucun agenda n'est modifié.",
      none: "Aucun échange, même simulé : ni import ni export.",
    },

    retentionTitle: "Conservation des données",
    retentionSubtitle: "Durée pendant laquelle les données des contacts sont conservées.",
    retentionLabel: "Durée de conservation",
    retentionUndefined: "Non définie — à valider avant mise en production",
  },

  /** `/inscription` — no self-service sign-up, on purpose. No form, no invented address. */
  signUp: {
    title: "Inscription",
    lead: "Les comptes d'agence ne se créent pas en libre-service.",
    body: `${BRAND.name} crée le compte de votre agence et les accès de votre équipe avec vous, lors de la mise en place.`,
    securityNote:
      "C'est un choix de sécurité : chaque accès est rattaché à une agence vérifiée, jamais ouvert par un inconnu.",
    alreadyMember: "Votre agence est déjà équipée ?",
    signIn: "Se connecter",
    backHome: "Retour à l'accueil",
  },

  /**
   * Shared words of the public site. The landing copy itself lives in
   * `components/landing-texts.ts`; the h1 is read from there, never retyped.
   */
  marketing: {
    heroTitle: HERO_TITLE,
    heroNote: "Prototype de démonstration. Aucune donnée réelle, aucun envoi réel.",
    signIn: LANDING_TEXTS.actions.signIn,
    estimation: LANDING_TEXTS.actions.estimation,
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
    running: "Simulation en cours…",
    runHint:
      "Le serveur revérifie le consentement, les doublons et le coupe-circuit avant de lancer Emma.",
    successTitle: "Emma a préparé une relance",
    errorActionTitle: "Erreur technique : Emma n'a préparé aucun brouillon",
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
