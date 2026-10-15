# Chantier hero du 14/10/2026 (journal, frontend-ux)

Spec : `docs/design-system.md` § U (U.1 à U.10). Ordre : a, b, c, d, e, f.

- étape a terminée (code) : `EditorialTitle.tsx`, `EditorialTitlePrompt.module.css` (plus de `>` ni de curseur), `ReplayAnimationsButton.tsx`, `landing-texts.ts` (`subtitleLines`), `LandingHero.tsx` (étiquette au-dessus du terminal, sous-titre mono), `HeroStage.module.css` (zone compensée +57/+33/+37 px). Reste : tests unitaires/E2E de l'étape a.
  Tests unitaires de l'étape a ajoutés (LandingHero, landing-texts). E2E à adapter à l'étape f.
- étape b terminée : mobile (zone de sphère propre, mains 2×, boutons empilés, titre 28 px), en-tête (libellé court « Estimation » sous 40 rem, nom accessible complet) : fichiers hero-config.ts, layout.ts, hero-paint.ts, HeroStage.module.css, LandingHero.tsx, EditorialTitlePrompt.module.css, app/(marketing)/layout.tsx, texts.ts. Reste : tests unitaires layout phone.
- étape c terminée (code) : perles rondes (hero-config RAIL_DOTS/Tier.railDots…, hands-robots, robots, robot-motion réécrit sans boule, hero-paint paintBeads, attributs data-rail-dots*). Restent : tests unitaires particles/live-motion à mettre à jour (étape f).
- étape d terminée (code) : mouvement continu : timeline.ts (libellés, WAVE 3000-9600, data-phases), sphere-field.ts (sphereAngle Φ(T), prepare/at), hands-pairing.ts (remplace hold-pairing/hold-transitions supprimés), HeroScene.compute (bezier(A(T),C,B(T),e)), flowEase, respiration dès 7000 ms (greffe sur live), boule tenue supprimée, HELD_ENABLED=false dans hero-config. Restent : e (script bake --config/--out), f (tests unitaires cassés, E2E, mesures, captures).
- étape e terminée : drapeau HELD_ENABLED=false (hero-config, point d'insertion documenté), script bake-hero-hands.mjs --config/--out (non exécuté : ne doit pas régénérer hands.baked.json). Pas de scripts/hero-held.config.json livré (il référencerait une image absente). Reste : f.
