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
    title: "Ce n'est pas la prospection qui freine vos mandats. C'est l'administratif.",
    body: "Les demandes arrivent. Mais chaque dossier traîne des relances à faire à la main, des informations éparpillées et des fiches en double. Le suivi sature, et le dossier s'arrête avant le rendez-vous.",
    /** The three causes of the administrative block, as named on the chart. */
    symptoms: [
      { title: "Relances manuelles", body: "Notées de mémoire, oubliées, ou envoyées deux fois au même contact." },
      {
        title: "Dossiers dispersés",
        body: "Formulaire, appel, portail : les informations d'un même vendeur vivent à trois endroits.",
      },
      { title: "Doublons entre conseillers", body: "Un même vendeur enregistré deux fois, suivi par deux personnes." },
    ],
    /** Illustrative chart: no figure on the axes, labelled as a fictitious example. */
    chart: {
      label: "Illustration — exemple fictif",
      title: "La progression plafonne au niveau de l'administratif",
      axisX: "Temps",
      axisY: "Mandats",
      zone: "Blocage administratif",
      causesLabel: "Causes du blocage administratif",
      description:
        "Illustration sans chiffres. Une courbe de mandats progresse avec le temps, puis plafonne. Au niveau du plafond, une zone en pointillés nommée « Blocage administratif » regroupe trois causes : relances manuelles, dossiers dispersés, doublons entre conseillers.",
    },
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
    carousel: {
      label: "Étapes d'un dossier vendeur, de la demande au mandat",
      hint: "Choisissez une étape pour voir ce qu'elle fait sur un dossier fictif.",
      previous: "Étape précédente",
      next: "Étape suivante",
      kinds: { agent: "Agent IA", human: "Étape humaine" },
      stepPrefix: "Étape",
      missionLabel: "Sa mission",
      boundaryLabel: "Sa limite",
      sceneBadge: "Exemple fictif — simulation",
    },
    /**
     * The seven steps of the carousel, in the order of the hero journey
     * (`journey.steps`): same names, detailed. Every scene is a fictitious
     * example (La Ciotat / Cassis), no real person, no figure presented as a
     * statistic.
     */
    steps: [
      {
        key: "lea",
        kind: "agent",
        name: "Léa",
        role: "Acquisition",
        action: "Vérifie la source, dédoublonne et crée une fiche propre.",
        boundary: "Ne transforme jamais une demande en consentement.",
      },
      {
        key: "hugo",
        kind: "agent",
        name: "Hugo",
        role: "Qualification",
        action: "Structure le bien, le secteur, la motivation et le délai.",
        boundary: "Signale ce qui manque au lieu de l'inventer.",
      },
      {
        key: "emma",
        kind: "agent",
        name: "Emma",
        role: "Relation",
        action: "Prépare une relance adaptée au contexte enregistré.",
        boundary: "Le premier message reste soumis à validation.",
      },
      {
        key: "review",
        kind: "human",
        name: "Validation humaine",
        role: "Conseiller",
        action: "Relit le premier message, le modifie, le valide ou le refuse.",
        boundary: "Aucun premier contact ne part sans elle.",
      },
      {
        key: "louis",
        kind: "agent",
        name: "Louis",
        role: "Rendez-vous",
        action: "Propose un créneau d'estimation et prépare le dossier.",
        boundary: "Ne réserve jamais deux fois le même créneau.",
      },
      {
        key: "sarah",
        kind: "agent",
        name: "Sarah",
        role: "Suivi",
        action: "Transforme le compte-rendu humain en prochaines actions.",
        boundary: "Ne déclare jamais seule un mandat signé.",
      },
      {
        key: "mandate",
        kind: "human",
        name: "Mandat",
        role: "Conseiller",
        action: "Le conseiller confirme lui-même la signature du mandat.",
        boundary: "Jamais auto-déclaré par un agent IA.",
      },
    ],
    /** One illustrated scene per step. Fictitious data only. */
    scenes: {
      lea: {
        title: "Deux demandes entrent, une seule fiche en sort",
        incoming: [
          { source: "Formulaire d'estimation du site", detail: "Maison · La Ciotat" },
          { source: "Appel reçu à l'agence", detail: "Même adresse e-mail" },
        ],
        checks: [
          { label: "Source vérifiée", detail: "Formulaire du site de l'agence" },
          { label: "Doublon détecté", detail: "Demandes rapprochées, aucune fiche en double" },
        ],
        output: "Fiche créée · Maison · La Ciotat",
        note: "Une demande n'est pas un consentement : aucun n'est déduit.",
      },
      hugo: {
        title: "Le projet structuré, sans supposition",
        fields: [
          { label: "Bien", value: "Appartement T3 avec terrasse" },
          { label: "Secteur", value: "Cassis" },
          { label: "Délai", value: "Vente souhaitée avant l'été" },
          { label: "Motivation", value: null },
        ],
        missing: "Information manquante — signalée, pas inventée",
        task: "Tâche créée : demander la motivation au vendeur",
      },
      emma: {
        title: "Une relance préparée, jamais envoyée seule",
        channel: "E-mail",
        consent: "Consentement e-mail vérifié avant tout envoi",
        subject: "Votre demande d'estimation à Cassis",
        body: "Bonjour, merci pour votre demande concernant votre appartement. Un conseiller peut passer l'estimer la semaine prochaine, au moment qui vous convient.",
        unsubscribe: "Se désinscrire de nos messages",
        status: "Brouillon — rien n'est envoyé",
      },
      review: {
        title: "Un conseiller relit, puis décide",
        reviewer: "Conseiller de l'agence",
        message: "Premier contact préparé par Emma",
        actions: { edit: "Modifier", reject: "Refuser", approve: "Valider" },
        result: "Premier contact validé par un humain",
        note: "Sans cette validation, rien ne part.",
      },
      louis: {
        title: "Un créneau libre, jamais réservé deux fois",
        day: "Mardi · estimation à Cassis",
        slots: [
          { time: "9 h 30", state: "taken", label: "Déjà réservé" },
          { time: "11 h 00", state: "proposed", label: "Proposé au vendeur" },
          { time: "15 h 30", state: "free", label: "Libre" },
        ],
        folder: "Dossier d'estimation préparé : bien, secteur, historique",
        note: "Un créneau déjà réservé n'est jamais reproposé.",
      },
      sarah: {
        title: "Du compte-rendu aux prochaines actions",
        reportLabel: "Compte-rendu du conseiller",
        report: "Visite faite. Vendeur intéressé, attend l'avis de valeur avant de décider.",
        actionsLabel: "Suivi préparé par Sarah",
        actions: [
          "Avis de valeur à envoyer, après validation humaine",
          "Relance prévue si le consentement reste valide",
          "Étape du dossier : estimation faite",
        ],
      },
      mandate: {
        title: "Le mandat, confirmé par un humain",
        proposal: "Sarah signale un mandat à confirmer",
        pending: "Confirmation humaine requise",
        confirmed: "Mandat signé, confirmé par le conseiller",
        note: "Un agent IA ne déclare jamais seul un mandat signé.",
      },
    },
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
