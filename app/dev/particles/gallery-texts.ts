import type { ParticlePreset } from "@/components/motion/shapes";

/** Interface texts of the /dev/particles development gallery (never shipped to production). */
export const PARTICLE_GALLERY_TEXTS = {
  overline: "Outil de développement",
  title: "Matière particulaire",
  intro:
    "Six variations décoratives d’une même matière. Elles n’illustrent aucune activité réelle des agents IA et cette page n’existe pas en production.",
  pause: "Mettre en pause",
  resume: "Reprendre",
  freeze: "Figer le temps",
  timeLabel: "Instant affiché",
  timeValue: (seconds: number) => `t = ${seconds.toFixed(1).replace(".", ",")} s`,
  reducedMotion: "Mouvement réduit",
  reducedOn: "actif",
  reducedOff: "inactif",
  loop: (seconds: number) => `Boucle de ${seconds} s`,
  endless: "Mouvement continu",
  transitionTitle: "Transition entre écrans",
  transitionIntro:
    "Grande zone, densité automatique. Changez de forme, même pendant une transformation : les particules repartent de leur position affichée.",
  transitionGroup: "Forme affichée",
  soloBack: "Retour à la galerie",
  backgroundTitle: "Matière en fond de page",
  backgroundIntro:
    "Aperçu du mode fond : un seul canevas fixé à la fenêtre, derrière le contenu, avec le budget validé (6 000, 4 000 ou 1 800 particules selon la largeur) et des opacités plafonnées.",
  backgroundCardTitle: "Carte de contenu",
  backgroundCardBody: "Les cartes restent blanches et opaques ; les textes posés hors carte doivent rester lisibles sur la matière.",
} as const;

export const PRESET_LABELS: Record<ParticlePreset, { screen: string; form: string }> = {
  veil: { screen: "Tableau de bord", form: "Voile fluide" },
  sphere: { screen: "Contacts vendeurs", form: "Sphère tournante" },
  current: { screen: "Pipeline", form: "Courant de gauche à droite" },
  agents: { screen: "Agents IA", form: "Sphère qui se divise en quatre formes" },
  vortex: { screen: "Messages à valider", form: "Vortex devenant relief" },
  grid: { screen: "Paramètres", form: "Grille ondulante" },
};
