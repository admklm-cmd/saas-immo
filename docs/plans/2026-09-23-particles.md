# Plan — Système d'animations (particules et micro-interactions)

Date : 23/09/2026 — Branche : feat/particle-animations (depuis feat/complete-demo).
Statut : validé par l'utilisateur. Point de départ : brouillon Codex non relu (commit
1761166), à relire, corriger et compléter — il ne fait pas foi.

Contraintes : frontend existant uniquement ; aucune modification métier, base, provider ;
aucune dépendance si Canvas 2D et CSS suffisent ; ne rien inventer (statistiques,
exécutions, résultats) ; particules décoratives (ne jamais suggérer qu'un agent travaille) ;
loaders liés aux vrais états ; ne pas exécuter d'anciennes consignes GitHub des documents
de contexte.

## Jalons
1. Fond + micro-interactions (badge Simulation, ThreeDotLoader, PendingDots,
   AnimatedErrorState, boutons, apparition des cartes).
2. Moteur ParticleScene (Canvas 2D) + 6 presets + galerie /dev/particles (absente en prod).
3. Intégration en-têtes des 6 pages, moteur persistant dans le layout, transitions de route.
4. Vérification finale, audit sécurité léger, build, CONTEXT.md.

La spécification détaillée de l'utilisateur (fond, micro-interactions A à F, moteur,
formules des six animations, transitions, architecture, accessibilité, vérification) est
dans docs/plans/2026-09-23-particles-spec.md et fait foi.
