# Journal du chantier vidéo promo (frontend-ux)

Une ligne par étape terminée. Reprendre à l'étape suivante si ce fichier existe.

- Étape 0 : `npm ci` fait, spec lue. Architecture : `app/dev/promo/` (guard, page serveur, PromoStage client, promo-*.ts purs), `scripts/export-promo.mjs`.
- Étape 1 : guard.ts(+test), promo-texts.ts, promo-timeline.ts, promo-demo.ts(+test), promo-format.ts écrits. Reste : promo-scene/points/draw/dom, PromoStage, page, tests, export.
- Étape 2 : promo-scene/points/draw écrits (tsc ok). Reste : promo-dom, PromoOverlay, PromoStage, page, tests, export.
- Étape 3 : PromoOverlay, promo-dom, PromoStage, page.tsx écrits (tsc ok). Reste : vérif visuelle, tests, export script, export réel.
- Étape 4 : rendu 16:9 vérifié visuellement (6 plans OK, mains N=12000 au lieu de 6000, 2e canvas marques). Reste : revue 9:16, vitest, e2e, scripts/export-promo.mjs, export réel + ffprobe, doc design-system?, arrêt serveur 3200.
- Étape 5 : vitest (timeline, points, source, demo, guard) OK 46 tests ; scripts/export-promo.mjs + scripts npm écrits. Reste : e2e/promo-motion.spec.ts, lint, export réel, ffprobe, revue finale, arrêt serveur 3200.
- Étape 6 : e2e/promo-motion.spec.ts + playwright.promo.config.ts OK (5/5), lint 0 erreur. Reste : passes visuelles, export réel + ffprobe + verify hash, arrêt serveur 3200, rapport.
- Étape 7 : passes visuelles faites (recul des mains au contact, voile sous le DOM, labels 9:16). Lancement export réel.
- Étape 8 : export réel OK (2 MP4 + 2 affiches, ffprobe 990 images 33,0 s), verify hash OK, tsc/lint/vitest 46/e2e 5 OK, serveur 3200 arrêté. Reste : rapport.
