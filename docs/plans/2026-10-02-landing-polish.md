# Plan — finition de la landing (`/`), 02/10/2026

Branche : `feat/landing-polish`. Demande de l'utilisateur **validée**. Spécification : `docs/design-system.md`
§ 2.11 (encadré « Révision finition »), § 2.11.2 (tableau des sept titres, D « Rejeu au survol »),
§ 2.11.3 (retiré), § 2.11.3 bis (fin du panneau final), § 2.11.4 (« Composition centrée, bords
atténués »), § 2.11.6, § 2.11.7 (n° 2–6 bis, 7 bis, 9). Périmètre : **`/` seulement** ; CRM, `/estimation`,
`.particle-veil`, `RouteParticles` inchangés. Aucune dépendance, aucune donnée, aucune requête.

Statut : spécifié. Implémentation : `frontend-ux`. Audit : l'utilisateur.

## T1 — Supprimer le wordmark « Ascend »

- Supprimer `components/landing/wordmark/` (5 sources + 2 tests), `e2e/landing-wordmark.spec.ts`,
  la clé `LANDING_TEXTS.final.wordmark` (+ son commentaire), l'exclusion
  `[data-testid='tech-wordmark']` de `e2e/helpers/landing-network.ts`, la section « React Bits —
  TechText » de `THIRD_PARTY_NOTICES.md` (garder l'introduction et la section TrueFocus).
- `LandingFinal.tsx` : § 2.11.3 bis (titre → 40 px → groupe [boutons → 16 px → note] ; rien après la
  note ; `@container` retiré s'il ne sert plus ; docstring mis à jour).
- Ne pas toucher : `BRAND.shortName`, `BRAND.wordmark`, `Logo`, `e2e/marque.spec.ts`.
- Fini quand : `grep -ri "techwordmark\|tech-wordmark\|paint-wordmark\|wordmark-engine\|techtext"
  app components e2e THIRD_PARTY_NOTICES.md` ne renvoie rien ; critère § 2.11.7 n° 6 vert.

## T2 — Effet C sur les quatre titres sans effet

- `accentEffect="focus-underline"` sur `LandingSolution`, `LandingAgents`, `LandingControl`,
  `LandingResult` (via `LandingHeading`, dont le commentaire « final panel only » est corrigé).
- Vérifier la géométrie mot par mot (§ 2.11.2 « Géométrie à vérifier ») ; virgule de « chemin, ».
- Fini quand : § 2.11.7 n° 2, 3, 4, 5 verts sur les sept titres (1440 et 390).

## T3 — Rejeu au survol

- Prop `accentReplay` d'`EditorialTitle` (+ `data-accent-replayable`) ; posée sur les sept titres.
- CSS : règles « joué » (`animation: none`) et « rejeu » (keyframes du § 2.11.2 D), spécificité
  au-dessus des sélecteurs d'entrée, rejeu seulement sous `prefers-reduced-motion: no-preference`.
- Un contrôleur client unique, délégué, monté dans `app/(marketing)/page.tsx` ; conditions,
  délai de 800 ms, filet de 1 600 ms, `data-accent-replays`.
- Tests unitaires : rendu de l'attribut (seulement avec effet ≠ `none` et `accentReplay`) ;
  logique pure d'autorisation (en cours, délai, entrée non terminée, `pointerType`).
- Fini quand : § 2.11.7 n° 6 bis et n° 1 verts.

## T4 — Réseau recentré, bords atténués

- `network.ts` : X = 1,85 (large, moyen), `zMin(|x|)` ; `camera.ts` / moteur : `offsetX` calculé au
  redimensionnement, plafonné à 10 % de W ; `renderer.ts` : `f(u)` sur fibres et corps.
- Constantes nommées (ex. `NODE_X_RANGE`, `EDGE_DEPTH_LIFT`, `CENTER_OFFSET_CAP`,
  `EDGE_FADE`, `EDGE_FADE_BAND`).
- Tests unitaires : § 2.11.7 n° 7 bis (géométrie) + tests de couverture existants ; E2E : n° 7 bis
  (canvas), n° 7, n° 8 (contraste re-mesuré), n° 9.
- Reporter dans le § 2.11.4 les mesures réelles (centre de masse, bandes, encre, coût, contraste,
  graine si changée, replis appliqués).

## Ordre

T1 → T2 → T3 → T4 (T4 indépendant, peut être fait en parallèle). Captures finales 1440 / 1024 / 390 :
panneau final, chaque titre pendant et après l'entrée, un rejeu au survol, réseau en haut / milieu /
bas de page, mouvement réduit.
