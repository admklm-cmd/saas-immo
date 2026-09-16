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
