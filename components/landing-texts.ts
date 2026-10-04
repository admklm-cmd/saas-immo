/**
 * Interface text of the public landing page (`/`), in French.
 *
 * Kept apart from `components/texts.ts` so the landing can evolve without
 * touching the application texts. Every statement here must stay TRUE for the
 * prototype: no client, testimonial, price, percentage or result is invented
 * (see `components/landing-texts.test.ts`, which fails on any of them). The
 * one exception is the `roi` key: sourced figures and editable hypotheses,
 * each tagged, never a promise (docs/design-system.md §2.11.8.8 L4-B).
 */
export const LANDING_TEXTS = {
  actions: {
    estimation: "Demander une estimation",
    signIn: "Espace agence",
  },

  /** « Rejouer les animations » (docs/design-system.md §2.11.8.8 L4-D): fixed button, polite announcement. */
  replay: {
    label: "Rejouer les animations",
    done: "Animations relancées.",
  },

  hero: {
    tag: "5 agents · contrôle humain",
    /**
     * Editorial title (docs/design-system.md §2.2.9): author lines (the reveal
     * works line by line), one accented word, and the sentence they compose
     * (`title === titleLines.join(" ")`, tested).
     */
    title: "Chaque demande vendeur avance. Votre agence garde la main.",
    titleLines: ["Chaque demande", "vendeur avance.", "Votre agence", "garde la main."],
    titleAccent: "main",
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
    steps: [
      { actor: "Léa", role: "Acquisition", action: "Source vérifiée, fiche créée", kind: "agent" },
      { actor: "Hugo", role: "Qualification", action: "Bien, secteur, motivation et délai structurés", kind: "agent" },
      { actor: "Emma", role: "Relation", action: "Premier message préparé, rien n'est envoyé", kind: "agent" },
      { actor: "Validation humaine", role: "Conseiller", action: "Le message est relu puis validé", kind: "human" },
      { actor: "Louis", role: "Rendez-vous", action: "Créneau d'estimation proposé", kind: "agent" },
      { actor: "Sarah", role: "Suivi", action: "Compte-rendu exploité, suivi du dossier", kind: "agent" },
      { actor: "Mandat", role: "Conseiller", action: "Signature confirmée par un humain", kind: "human" },
    ],
    /**
     * Block A of the hero (docs/design-system.md §2.11.8.8 L4-A): three
     * blocks — Acquisition (Léa, Hugo, Emma), Validation humaine (you),
     * Suivi (Louis, Sarah) — each marked by an app tile (glyph, tone). An
     * agents block holds one group per agent; the human block one group per
     * decision (`label`). `by` says who checks a line: an agent, YOU (the
     * « Vous » cursor, never an agent), or nobody (`missing`: the information
     * is flagged, never invented). Same 16 lines as before: 12 agent boxes,
     * 1 missing, 3 « Vous ». Labels ≤ 20 characters. DOM order = reading order.
     */
    blocks: [
      {
        key: "acquisition",
        name: "Acquisition",
        members: "Léa · Hugo · Emma",
        nature: "agents",
        glyph: "leads",
        tone: "orange",
        groups: [
          {
            agent: "Léa",
            glyph: "lea",
            lines: [
              { icon: "search", label: "Source vérifiée", by: "agent" },
              { icon: "merge", label: "Doublon écarté", by: "agent" },
              { icon: "contacts", label: "Fiche créée", by: "agent" },
            ],
          },
          {
            agent: "Hugo",
            glyph: "hugo",
            lines: [
              { icon: "deal", label: "Bien et secteur", by: "agent" },
              { icon: "clock", label: "Délai du projet", by: "agent" },
              { icon: "question", label: "Motivation", by: "missing", detail: "à demander" },
            ],
          },
          {
            agent: "Emma",
            glyph: "emma",
            lines: [
              { icon: "email", label: "Consentement", by: "agent" },
              { icon: "messages", label: "Message préparé", by: "agent" },
            ],
          },
        ],
      },
      {
        key: "validation",
        name: "Validation humaine",
        members: "Vous · Conseiller",
        nature: "human",
        glyph: "humanValidation",
        tone: "violet",
        groups: [
          {
            label: "Premier message",
            lines: [
              { icon: "document", label: "Message relu", by: "you" },
              { icon: "humanValidation", label: "Message validé", by: "you" },
            ],
          },
          {
            label: "Mandat",
            lines: [{ icon: "mandate", label: "Mandat confirmé", by: "you" }],
          },
        ],
      },
      {
        key: "suivi",
        name: "Suivi",
        members: "Louis · Sarah",
        nature: "agents",
        glyph: "pipeline",
        tone: "green",
        groups: [
          {
            agent: "Louis",
            glyph: "louis",
            lines: [
              { icon: "calendar", label: "Créneau proposé", by: "agent" },
              { icon: "document", label: "Dossier préparé", by: "agent" },
            ],
          },
          {
            agent: "Sarah",
            glyph: "sarah",
            lines: [
              { icon: "document", label: "Compte-rendu lu", by: "agent" },
              { icon: "tasks", label: "Actions créées", by: "agent" },
              { icon: "mandate", label: "Mandat signalé", by: "agent" },
            ],
          },
        ],
      },
    ],
    pills: { agents: "Agents", you: "Vous" },
    cursor: "Vous",
    /** The guard rail under the action, in segments: the two strong words are set in ink. */
    guard: [
      { text: "Les agents préparent. Vous " },
      { text: "validez", strong: true },
      { text: " le premier message et " },
      { text: "confirmez", strong: true },
      { text: " le mandat." },
    ],
    note: "Illustration en boucle, exemple fictif. Aucun prospect réel, aucun envoi.",
    dots: { label: "Choisir une étape", item: "Bloc {n} sur 3 : {nom}" },
    /** Read instead of the drawing: the final state, one sentence per block, never announced during the loop. */
    srSummary: [
      "Acquisition, par Léa, Hugo et Emma : source vérifiée, doublon écarté, fiche créée ; bien et secteur, délai du projet, motivation manquante, à demander ; consentement vérifié, message préparé.",
      "Validation humaine, par vous : premier message relu puis validé ; mandat confirmé.",
      "Suivi, par Louis et Sarah : créneau proposé, dossier préparé ; compte-rendu lu, actions créées, mandat signalé.",
    ],
  },

  problem: {
    kicker: "Le problème",
    title: "Ce n'est pas la prospection qui freine vos mandats. C'est l'administratif.",
    /** The same title, in author lines: the observation, then the answer. */
    titleLines: ["Ce n'est pas la prospection", "qui freine vos mandats.", "C'est l'administratif."],
    titleAccent: "administratif",
    /** The lines of the observation (before this index) are set in the subtle ink. */
    titleSubtleBefore: 2,
    body: "Les demandes arrivent. Mais chaque dossier traîne des relances à faire à la main, des informations éparpillées et des fiches en double. Le suivi sature, et le dossier s'arrête avant le rendez-vous.",
    /**
     * The four causes of the administrative block. `key` links each one to the
     * events it produces on the chart (components/landing/problem/problem-scene.ts).
     */
    symptoms: [
      {
        key: "relances",
        title: "Relances manuelles",
        body: "Notées de mémoire, oubliées, ou envoyées deux fois au même contact.",
      },
      {
        key: "dossiers",
        title: "Dossiers dispersés",
        body: "Formulaire, appel, portail : les informations d'un même vendeur vivent à trois endroits.",
      },
      {
        key: "doublons",
        title: "Doublons entre conseillers",
        body: "Un même vendeur enregistré deux fois, suivi par deux personnes.",
      },
      {
        key: "suivi",
        title: "Suivi saturé",
        body: "Chaque dossier ouvert attend un rappel, une réponse, une validation. Le temps part là, pas dans les rendez-vous.",
      },
    ],
    /** Illustrative chart: no figure, no axis, labelled as a fictitious example. */
    chart: {
      label: "Illustration — exemple fictif",
      title: "La progression plafonne au niveau de l'administratif",
      axisX: "Temps",
      axisY: "Mandats",
      capacity: "Capacité absorbée par l'administratif",
      /** Words of the administrative events drawn on the chart. */
      events: {
        relance: "Relance",
        dossier: "Dossier",
        document: "Document",
        doublon: "Doublon",
        suivi: "Suivi",
        validation: "Validation",
      },
      causesLabel: "Ce qui absorbe le temps",
      causesHint: "Sélectionnez une cause pour la repérer dans l'illustration.",
      eventsLabel: "Sur l'illustration",
      description:
        "Illustration sans chiffres, exemple fictif. Une courbe de mandats progresse avec le temps. Puis de petits événements administratifs s'accumulent entre elle et la progression attendue, de plus en plus nombreux : relances, dossiers, documents, doublons, suivis, validations. La courbe ralentit et plafonne, loin de la progression attendue : l'écart est la capacité absorbée par l'administratif. Quatre causes : relances manuelles, qui produisent les relances ; dossiers dispersés, les dossiers et les documents ; doublons entre conseillers, les doublons ; suivi saturé, les suivis et les validations.",
    },
  },

  solution: {
    kicker: "La solution",
    title: "Chaque dossier suit le même chemin, de la demande au mandat.",
    titleLines: ["Chaque dossier suit", "le même chemin,", "de la demande au mandat."],
    titleAccent: "chemin",
    body: "Chaque étape a un responsable, une sortie attendue et une condition de passage. Le dossier ne franchit jamais une validation humaine sans elle.",
    railLabel: "Étapes d'un dossier vendeur",
    /** The seven steps of a dossier, in order (roadmap of tile 1, docs/design-system.md §2.11.8.4). */
    rail: [
      { label: "Demande reçue", owner: "Léa", glyph: "lea" },
      { label: "Qualification", owner: "Hugo", glyph: "hugo" },
      { label: "Relance préparée", owner: "Emma", glyph: "emma" },
      { label: "Validation humaine", owner: "Conseiller", glyph: "humanValidation", human: true },
      { label: "Rendez-vous", owner: "Louis", glyph: "louis" },
      { label: "Suivi", owner: "Sarah", glyph: "sarah" },
      { label: "Mandat", owner: "Conseiller", glyph: "mandate", human: true },
    ],
    /** Label of the illustrations of tiles 1 to 4, next to the Simulation badge. */
    fictive: "Exemple fictif",
    /**
     * The five tiles of block B (docs/design-system.md §2.11.8.4). Tiles 1 to 4
     * are fictitious illustrations; tile 5 states real rules of the prototype
     * (no real send, two mandatory human validations — CLAUDE.md).
     */
    tiles: {
      roadmap: {
        title: "Un seul chemin",
        body: "Sept étapes, un responsable chacune. Le dossier attend la validation humaine.",
        visualLabel: "Feuille de route fictive : sept étapes, la validation humaine attend le conseiller",
        pending: "En attente de vous",
      },
      progress: {
        title: "Un dossier qui avance",
        body: "Chaque étape du pipeline, du nouveau contact au mandat signé.",
        visualLabel: "Courbe fictive d'un dossier, de Nouveau à Mandat signé, sans valeurs",
        heading: "Progression — dossier fictif",
      },
      team: {
        title: "Cinq agents, un conseiller",
        body: "Chaque agent prépare sa part. Vous gardez la décision.",
        visualLabel: "Cinq agents autour du conseiller",
        you: "Vous",
        youRole: "Conseiller · décide",
        agents: [
          { name: "Léa", glyph: "lea" },
          { name: "Hugo", glyph: "hugo" },
          { name: "Emma", glyph: "emma" },
          { name: "Louis", glyph: "louis" },
          { name: "Sarah", glyph: "sarah" },
        ],
      },
      report: {
        title: "Le compte-rendu, exploité",
        body: "Sarah transforme la visite en prochaines actions, à valider.",
        visualLabel: "Compte-rendu fictif exploité par Sarah, simulation",
        card: "Compte-rendu · Sarah",
        actions: "3 actions prêtes",
      },
      guards: {
        title: "Des garde-fous réels",
        body: "Vérifiés par le serveur à chaque action, pas seulement affichés.",
        figures: [
          { value: "0", caption: "envoi réel dans ce prototype" },
          { value: "2", caption: "validations humaines obligatoires" },
        ],
        rows: [
          { label: "Premier contact et mandat", value: "Validés par un humain" },
          { label: "Coupe-circuit", value: "Un clic" },
        ],
      },
    },
  },

  agents: {
    kicker: "Cinq agents, cinq périmètres",
    title: "Chaque agent sait où son travail commence. Et où il s'arrête.",
    titleLines: ["Chaque agent sait", "où son travail commence.", "Et où il s'arrête."],
    titleAccent: "s'arrête",
    body: "Le dossier avance dans un ordre lisible. Les informations manquantes deviennent des tâches, jamais des suppositions.",
    carousel: {
      label: "Étapes d'un dossier vendeur, de la demande au mandat",
      hint: "Choisissez une étape pour voir ce qu'elle fait sur un dossier fictif.",
      previous: "Étape précédente",
      next: "Étape suivante",
      navLabel: "Parcourir les étapes",
      /** Read « Étape 04 sur 07 » (written « 04 / 07 »). */
      positionOf: "sur",
      /** `kinds.agent` / `kinds.human` are read by assistive technology; the two others are written on the tile. */
      kinds: {
        agent: "Agent IA",
        human: "Étape humaine",
        checkpoint: "Contrôle humain",
        outcome: "Aboutissement",
      },
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
    titleLines: ["L'IA prépare.", "Votre équipe décide."],
    titleAccent: "décide",
    body: "Les garde-fous sont vérifiés par le serveur à chaque action, pas seulement affichés à l'écran.",
    /**
     * The six guard rails, word for word. Since §2.11.8.7 L3-D they are the
     * legends of the two tiles (`tile`): written as text at every width, with
     * no JavaScript and under reduced motion, and shown again in the visuals.
     */
    facts: [
      { title: "Premier contact", body: "Toujours relu et validé par un conseiller avant tout envoi.", tile: "team" },
      { title: "Mandat signé", body: "Toujours confirmé par un humain, jamais déclaré par un agent.", tile: "team" },
      { title: "Consentement", body: "Vérifié canal par canal avant toute action externe.", tile: "timeline" },
      { title: "Coupe-circuit", body: "Suspend les cinq agents de l'agence d'un seul clic.", tile: "team" },
      { title: "Refus ou reprise en main", body: "Les relances s'arrêtent immédiatement.", tile: "timeline" },
      { title: "Information manquante", body: "Signalée comme manquante, jamais inventée.", tile: "timeline" },
    ],
    /** The two animated tiles of the section (docs/design-system.md §2.11.8.7 L3-D). */
    tiles: {
      team: {
        title: "Un conseiller, cinq agents",
        body: "Chaque agent prépare sa part. La décision reste à votre équipe.",
        you: "Vous",
        youRole: "Conseiller",
        hub: "Espace agence",
        hubSub: "Ascend Strategy",
        hubSubShort: "Ascend",
        killSwitch: "Coupe-circuit",
        agents: [
          { name: "Léa", role: "Acquisition", glyph: "lea" },
          { name: "Hugo", role: "Qualification", glyph: "hugo" },
          { name: "Emma", role: "Relation", glyph: "emma" },
          { name: "Louis", role: "Rendez-vous", glyph: "louis" },
          { name: "Sarah", role: "Suivi", glyph: "sarah" },
        ],
        visualLabel:
          "Organigramme : vous, conseiller vérifié, relié à l'espace agence ; de là partent cinq agents, Léa, Hugo, Emma, Louis et Sarah ; un coupe-circuit suspend les cinq.",
      },
      timeline: {
        title: "Le dossier attend votre décision",
        body: "Un dossier fictif sur dix jours : il s'arrête à chaque étape humaine.",
        fictive: "Exemple fictif",
        file: "Dossier fictif · T3, Cassis",
        tracks: { agents: "Agents", emma: "Emma", you: "Vous" },
        cursors: { lea: "Léa", emma: "Emma", you: "Vous" },
        days: ["J0", "J2", "J4", "J6", "J8", "J10"],
        blocks: {
          lea: "Léa",
          hugo: "Hugo",
          missing: "Manquante",
          louis: "Louis",
          sarah: "Sarah",
          consent: "Consentement",
          followUp: "Relance",
          stopped: "Arrêtée",
          firstContact: "1er contact",
          validated: "Validé",
          visit: "Visite",
          mandate: "Mandat",
        },
        /** The state line of the file card, in the order of the playback (nine states). */
        states: [
          "Demande reçue · Léa",
          "Qualification · Hugo",
          "Motivation manquante · signalée",
          "Premier contact · en attente de vous",
          "Premier contact · validé par vous",
          "Créneau proposé · Louis",
          "Visite · relances arrêtées",
          "Suivi · Sarah",
          "Mandat · à confirmer par vous",
        ],
        visualLabel:
          "Frise d'un dossier fictif sur dix jours, simulation : Léa crée la fiche, Emma vérifie le consentement, Hugo signale une motivation manquante ; le premier contact attend votre validation, vous le validez ; après votre visite, les relances sont arrêtées ; le mandat attend votre confirmation.",
      },
    },
  },

  /**
   * ROI section (docs/design-system.md §2.11.8.8 L4-B; figures and sources:
   * docs/recherche-roi-agences.md). The ONLY key of the landing allowed to
   * carry figures: each one is tagged `source` (published figure),
   * `hypothesis` (default value, to adjust) or `estimate` (rounded
   * calculation), US studies flagged `us`. Never a promise: no « garanti »,
   * no « vous gagnerez » (tested). Templates: `{value}`, `{hours}`,
   * `{euros}`, `{n}` are filled by `components/landing/roi/roi-model.ts`.
   */
  roi: {
    kicker: "ROI",
    title: "Ce que vos délais coûtent, et ce que l'agence peut regagner.",
    titleLines: ["Ce que vos délais coûtent,", "et ce que l'agence", "peut regagner."],
    titleAccent: "regagner",
    body: "Des ordres de grandeur, calculés à partir d'études publiques et d'hypothèses que vous pouvez ajuster.",
    legend: [
      { tag: "source", text: "chiffre publié" },
      { tag: "hypothesis", text: "valeur par défaut, à ajuster" },
      { tag: "estimate", text: "calcul arrondi" },
    ],
    tags: { source: "Source", hypothesis: "Hypothèse", estimate: "Potentiel estimé", us: "Étude américaine" },
    disclaimer:
      "Chiffres indicatifs, issus d'études publiques (souvent américaines ou anciennes) et d'hypothèses modifiables. Ils ne constituent pas une promesse de résultat.",
    noScript: "Réglages disponibles avec JavaScript.",
    reset: "Valeurs par défaut",
    widgets: {
      speed: {
        kicker: "Réactivité",
        title: "Chaque minute compte",
        value: { text: "×{value}", kind: "source", us: true, sr: "{value} fois plus" },
        caption: "de chances de qualifier un lead rappelé en 5 minutes plutôt qu'en 30 minutes.",
        bars: { fast: "5 min", slow: "30 min", fastRatio: "×21", slowRatio: "×1" },
        secondary: {
          value: { text: "×{value}", kind: "source", us: true, sr: "{value} fois plus" },
          caption: "en tentant le contact dans l'heure plutôt qu'une heure plus tard.",
        },
        note: "Études américaines tous secteurs : MIT/InsideSales 2007 ; Harvard Business Review 2011. Non spécifiques à l'immobilier français.",
      },
      mandates: {
        kicker: "Mandats",
        title: "Les mandats qui partent ailleurs",
        value: { text: "≈ {value} € HT", kind: "estimate", sr: "environ {value} euros hors taxes par an" },
        caption: "d'honoraires potentiellement manqués par an.",
        funnel: [
          { label: "demandes par an", prefix: "", kind: "estimate" },
          { label: "traitées trop tard", prefix: "", kind: "estimate" },
          { label: "mandats", prefix: "≈ ", kind: "estimate" },
          { label: "ventes", prefix: "≈ ", kind: "estimate" },
        ],
        funnelLabel: "Entonnoir annuel",
        sliders: {
          requests: { label: "Demandes vendeurs par mois", valueText: "{n} demandes par mois", kind: "hypothesis" },
          lateShare: {
            label: "Part traitée trop tard ou sans suivi",
            valueText: "{n} pour cent",
            kind: "hypothesis",
            benchmark: { text: "audit américain : 23 % sans réponse", kind: "source", us: true },
          },
        },
        display: { requests: "{n}", lateShare: "{n} %" },
        fixed: [
          { value: "8 %", label: "des demandes deviennent un mandat", kind: "hypothesis" },
          { value: "60 %", label: "des mandats aboutissent à une vente", kind: "hypothesis" },
          { value: "367 000 €", label: "— prix médian d'un appartement à La Ciotat (DVF 2025)", kind: "source" },
          { value: "4 % HT", label: "— honoraires moyens (FNAIM 2016)", kind: "source" },
        ],
        live: "Potentiel estimé : environ {euros} euros hors taxes par an.",
        note: "Prix médian : données DVF La Ciotat 2025. Honoraires : moyenne FNAIM 2016 (4 % HT). Volumes et taux de transformation : hypothèses à ajuster à votre agence.",
      },
      time: {
        kicker: "Temps",
        title: "Le temps qui vous échappe",
        value: { text: "≈ {value} h", kind: "estimate", sr: "environ {value} heures par an" },
        caption: "regagnables par an sur l'administratif.",
        total: { text: "{value} h d'administratif par an", sr: "{value} heures d'administratif par an" },
        worth: { text: "≈ {value} € de temps valorisé par an", sr: "environ {value} euros de temps valorisé par an" },
        sliders: {
          negotiators: { label: "Négociateurs", valueText: "{n} négociateurs", kind: "hypothesis" },
          hours: {
            label: "Heures d'administratif par semaine et par négociateur",
            valueText: "{n} heures par semaine",
            kind: "hypothesis",
            benchmark: { text: "étude : 4 à 6 h", kind: "source" },
          },
        },
        display: { negotiators: "{n}", hours: "{n} h" },
        fixed: [
          { value: "45", label: "semaines travaillées par an", kind: "hypothesis" },
          { value: "30 %", label: "du temps administratif automatisable", kind: "hypothesis" },
          { value: "40 €", label: "de coût horaire chargé", kind: "hypothesis" },
        ],
        live: "Potentiel estimé : environ {hours} heures et {euros} euros par an.",
        note: "Temps administratif : étude La Boîte Immo, 629 professionnels, 2017. Part automatisable, nombre de négociateurs et coût horaire : hypothèses.",
      },
      followup: {
        kicker: "Relance",
        title: "La relance qui fait la différence",
        value: { text: "{value} %", kind: "source", us: true, sr: "{value} pour cent" },
        caption: "des leads convertis avaient été joints au plus tard au 6ᵉ appel.",
        timelineLabel: "Six contacts successifs, canaux alternés",
        message: "Un suivi régulier et multicanal, toujours avec le consentement du contact.",
        note: "Étude Velocify (éditeur, États-Unis, environ 3,5 millions de leads). En France, les appels ne sont permis qu'avec consentement, du lundi au vendredi (10h-13h, 14h-20h) et 4 fois par mois maximum.",
      },
    },
  },

  final: {
    title: "Déposez une demande fictive. Retrouvez-la dans l'espace agence.",
    titleLines: ["Déposez une demande fictive.", "Retrouvez-la", "dans l'espace agence."],
    titleAccent: "fictive",
    body: "Sept étapes, de la demande au mandat. Deux restent toujours humaines.",
    note: "Prototype de démonstration. Aucune donnée réelle, aucun envoi réel.",
    /**
     * The carousel of block C (docs/design-system.md §2.11.8.5). No percentage
     * here: the progress is computed (`process/process-carousel.ts`).
     */
    carousel: {
      label: "Les sept étapes d'un dossier",
      previous: "Étape précédente",
      next: "Étape suivante",
      stepPrefix: "Étape n°",
      human: "Humaine",
      position: "Étape {n} sur 7",
      badge: "Exemple fictif — simulation",
    },
    /** The seven steps; `pending` / `done`: label of the visual while it plays / once played. */
    steps: [
      {
        key: "lea",
        title: "Demande reçue",
        owner: "Léa",
        glyph: "lea",
        human: false,
        body: "La source est vérifiée, les doublons écartés, une fiche propre est créée.",
        pending: "Vérification de la source…",
        done: "Source vérifiée",
      },
      {
        key: "hugo",
        title: "Qualification",
        owner: "Hugo",
        glyph: "hugo",
        human: false,
        body: "Bien, secteur, motivation et délai structurés. Ce qui manque est signalé, jamais inventé.",
        pending: "Structuration du projet…",
        done: "Motivation à demander",
      },
      {
        key: "emma",
        title: "Relance préparée",
        owner: "Emma",
        glyph: "emma",
        human: false,
        body: "Un premier message adapté au dossier, consentement vérifié. Rien n'est envoyé.",
        pending: "Rédaction du brouillon…",
        done: "Brouillon prêt · rien n'est envoyé",
      },
      {
        key: "review",
        title: "Validation humaine",
        owner: "Vous",
        glyph: "humanValidation",
        human: true,
        body: "Le conseiller relit, modifie, valide ou refuse. Sans lui, aucun premier contact ne part.",
        pending: "En attente de votre décision…",
        done: "Validé par un humain",
      },
      {
        key: "louis",
        title: "Rendez-vous",
        owner: "Louis",
        glyph: "louis",
        human: false,
        body: "Un créneau d'estimation libre est proposé, jamais réservé deux fois.",
        pending: "Recherche d'un créneau libre…",
        done: "Créneau proposé",
      },
      {
        key: "sarah",
        title: "Suivi",
        owner: "Sarah",
        glyph: "sarah",
        human: false,
        body: "Le compte-rendu de visite devient des prochaines actions, à valider.",
        pending: "Lecture du compte-rendu…",
        done: "Prochaines actions prêtes",
      },
      {
        key: "mandate",
        title: "Mandat",
        owner: "Vous",
        glyph: "mandate",
        human: true,
        body: "La signature est confirmée par le conseiller. Jamais déclarée par un agent IA.",
        pending: "Confirmation humaine requise…",
        done: "Mandat confirmé par un humain",
      },
    ],
    /** Words drawn inside the visuals of the seven cards (fictitious example, decorative). */
    visuals: {
      lea: { targets: ["Formulaire du site", "Appel reçu"], merged: "1 fiche" },
      hugo: {
        rows: [
          { label: "Bien", value: "T3 avec terrasse" },
          { label: "Secteur", value: "Cassis" },
          { label: "Délai", value: "Avant l'été" },
        ],
        missingLabel: "Motivation",
        missingValue: "Manquante — signalée",
      },
      emma: {
        channel: "E-mail · Brouillon",
        subject: "Votre demande d'estimation à Cassis",
        consent: "Consentement vérifié",
        unsubscribe: "Se désinscrire",
      },
      review: { actions: ["Modifier", "Refuser", "Valider"], cursor: "Vous" },
      louis: {
        slots: [
          { time: "9 h 30", note: "Déjà réservé", taken: true },
          { time: "11 h 00", note: "", taken: false },
          { time: "15 h 30", note: "Libre", taken: false },
        ],
        proposed: "Proposé au vendeur",
      },
      sarah: {
        actions: ["Avis de valeur — après validation", "Relance — si consentement valide", "Étape : estimation faite"],
      },
      mandate: { pending: "À confirmer", confirm: "Confirmer", cursor: "Vous" },
    },
  },
} as const;

export type LandingTexts = typeof LANDING_TEXTS;

/** Full hero title, as read by assistive technology and search engines. */
export const HERO_TITLE = LANDING_TEXTS.hero.title;
