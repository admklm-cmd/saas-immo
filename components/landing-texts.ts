/**
 * Interface text of the public landing page (`/`), in French.
 *
 * Kept apart from `components/texts.ts` so the landing can evolve without
 * touching the application texts. Every statement here must stay TRUE for the
 * prototype: no client, testimonial, price, percentage or result is invented
 * (see `components/landing-texts.test.ts`, which fails on any of them).
 */
export const LANDING_TEXTS = {
  actions: {
    estimation: "Demander une estimation",
    signIn: "Espace agence",
  },

  hero: {
    tag: "5 agents · contrôle humain",
    /** One entry per visual line: the reveal animation works line by line. */
    titleLines: ["Chaque demande", "vendeur avance.", "Votre agence", "garde la main."],
    /** From this line on, the title is set in the secondary ink. */
    titleSecondFrom: 2,
    subtitle:
      "Cinq agents IA préparent chaque étape jusqu'à une prochaine action claire. Le premier message et le mandat restent validés par votre équipe.",
    proofLabel: "Ce que le prototype fait réellement",
    proofs: [
      "Cinq agents spécialisés, chacun borné",
      "Premier message validé par un humain",
      "Mandat confirmé par un humain",
      "Actions externes simulées",
      "Blocages et erreurs consignés",
      "Données isolées entre agences",
    ],
    illustrationNote: "Animations : exemple fictif, simulation. Aucune activité en direct.",
  },

  journey: {
    badge: "Exemple fictif — simulation",
    title: "Parcours d'un prospect fictif",
    prospect: "Demande d'estimation reçue pour une maison",
    steps: [
      { actor: "Léa", role: "Acquisition", action: "Source vérifiée, fiche créée", kind: "agent" },
      { actor: "Hugo", role: "Qualification", action: "Bien, secteur, motivation et délai structurés", kind: "agent" },
      { actor: "Emma", role: "Relation", action: "Premier message préparé, rien n'est envoyé", kind: "agent" },
      { actor: "Validation humaine", role: "Conseiller", action: "Le message est relu puis validé", kind: "human" },
      { actor: "Louis", role: "Rendez-vous", action: "Créneau d'estimation proposé", kind: "agent" },
      { actor: "Sarah", role: "Suivi", action: "Compte-rendu exploité, suivi du dossier", kind: "agent" },
      { actor: "Mandat", role: "Conseiller", action: "Signature confirmée par un humain", kind: "human" },
    ],
    states: {
      waiting: "À venir",
      active: "En cours",
      awaiting: "En attente de validation",
      done: "Terminé",
      validated: "Validé par un conseiller",
      confirmed: "Confirmé par un humain",
    },
    note: "Illustration rejouée en boucle. Aucun prospect réel, aucun envoi.",
  },

  problem: {
    kicker: "Le problème",
    title: "Les demandes arrivent de partout. Le suivi se perd en chemin.",
    body: "Formulaire, appel, portail : la même personne revient par deux canaux, une relance attend, une information manque. Sans ordre clair, le dossier s'arrête avant le rendez-vous.",
    symptoms: [
      { title: "Doublons", body: "Un même vendeur enregistré deux fois, suivi par deux personnes." },
      { title: "Relances perdues", body: "Oubliées, ou envoyées deux fois au même contact." },
      { title: "Suppositions", body: "Une information manquante complétée de mémoire plutôt que demandée." },
    ],
  },

  solution: {
    kicker: "La solution",
    title: "Un ordre lisible, de la demande au mandat.",
    body: "Chaque étape a un responsable, une sortie attendue et une condition de passage. Le dossier ne franchit jamais une validation humaine sans elle.",
    railLabel: "Étapes d'un dossier vendeur",
    rail: [
      { label: "Demande reçue", owner: "Léa" },
      { label: "Qualification", owner: "Hugo" },
      { label: "Relance préparée", owner: "Emma" },
      { label: "Validation humaine", owner: "Conseiller", human: true },
      { label: "Rendez-vous", owner: "Louis" },
      { label: "Suivi", owner: "Sarah" },
      { label: "Mandat", owner: "Conseiller", human: true },
    ],
    railNote: "Exemple fictif — simulation.",
  },

  agents: {
    kicker: "Cinq agents, cinq périmètres",
    title: "Chaque agent sait où son travail commence. Et où il s'arrête.",
    body: "Le dossier avance dans un ordre lisible. Les informations manquantes deviennent des tâches, jamais des suppositions.",
    list: [
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
  },

  control: {
    kicker: "Le contrôle reste humain",
    title: "L'IA prépare. Votre équipe décide.",
    body: "Les garde-fous sont vérifiés par le serveur à chaque action, pas seulement affichés à l'écran.",
    facts: [
      { title: "Premier contact", body: "Toujours relu et validé par un conseiller avant tout envoi." },
      { title: "Mandat signé", body: "Toujours confirmé par un humain, jamais déclaré par un agent." },
      { title: "Consentement", body: "Vérifié canal par canal avant toute action externe." },
      { title: "Coupe-circuit", body: "Suspend les cinq agents de l'agence d'un seul clic." },
      { title: "Refus ou reprise en main", body: "Les relances s'arrêtent immédiatement." },
      { title: "Information manquante", body: "Signalée comme manquante, jamais inventée." },
    ],
  },

  result: {
    kicker: "Le résultat",
    title: "Chaque dossier a une prochaine action claire.",
    body: "Dans l'espace agence, chaque contact indique son étape, ce qui a été fait et ce qui attend une décision.",
    pipelineLabel: "Étapes du pipeline",
    /** The stage names themselves come from the pipeline domain (real labels). */
    pipelineLostNote: "possible à chaque étape",
    outcomes: [
      { title: "L'étape du dossier", body: "Du nouveau contact au mandat signé, sans ambiguïté." },
      { title: "L'historique", body: "Les actions des agents et de l'équipe, blocages et erreurs compris." },
      { title: "Ce qui attend", body: "Les messages à valider et les tâches créées pour les informations manquantes." },
    ],
  },

  final: {
    title: "Voyez le parcours complet avec un bien fictif.",
    body: "Commencez par une demande d'estimation, puis retrouvez le dossier dans l'espace agence.",
    note: "Prototype de démonstration. Aucune donnée réelle, aucun envoi réel.",
  },

  /** Page-level pause of the looping illustrations (WCAG 2.2.2). */
  motion: {
    pause: "Mettre les animations en pause",
    resume: "Reprendre les animations",
  },

  /**
   * Short interface fragments painted by the living background (decorative,
   * `aria-hidden`): generic, no real name, no figure.
   */
  living: {
    agents: ["Léa", "Hugo", "Emma", "Louis", "Sarah"],
    gate: "Validation humaine",
    goal: "Mandat",
    fragments: {
      received: "Demande reçue",
      status: "Statut : qualifié",
      duration: "Durée mesurée",
      validation: "Validation requise",
      validated: "Validé",
      appointment: "Rendez-vous proposé",
      followUp: "Suivi du dossier",
      blocked: "Bloqué par un garde-fou",
    },
  },
} as const;

export type LandingTexts = typeof LANDING_TEXTS;

/** Full hero title, as read by assistive technology and search engines. */
export const HERO_TITLE = LANDING_TEXTS.hero.titleLines.join(" ");
