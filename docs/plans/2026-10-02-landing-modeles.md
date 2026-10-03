# Plan — modèles MIG / Striker sur la landing (`/`), 02/10/2026 (soir)

Branche : `feat/landing-polish` (pas de nouvelle branche, pas de push). Demande de l'utilisateur
**validée** : `docs/references/2026-10-02-modeles-mig-striker.md` (+ capture du modèle C).
Spécification : `docs/design-system.md` **§ 2.11.8** (2.11.8.1 règles, 2.11.8.2 effets de titre,
2.11.8.3 bloc A, 2.11.8.4 bloc B, 2.11.8.5 bloc C, 2.11.8.6 critères). Renvois posés dans § 1.1,
§ 2.11, § 2.11.1, § 2.11.2, § 2.11.3, § 2.11.3 bis, § 2.11.5, § 2.11.7.

**Lot 3 (03/10/2026) — implémenté et testé** (`frontend-ux`, 03/10/2026 ; avancement, mesures et écarts : `docs/design-system.md` § 2.11.8.7 « Avancement ») — à auditer par l'utilisateur : retours de l'audit de l'utilisateur
(`docs/references/2026-10-02-modeles-mig-striker.md`, section « Retours … (03/10) ») ; spec
`docs/design-system.md` **§ 2.11.8.7** ; brief en fin de ce document.

Statut : **Lot 1 et Lot 2 implémentés et testés** (`frontend-ux`, 02–03/10/2026 ; avancement, mesures
réelles et écarts : `docs/design-system.md` § 2.11.8). Implémentation : `frontend-ux`. Audit : **l'utilisateur**
(à faire).
Périmètre : `/` seulement. Ne changent pas : réseau (`components/landing/living/`), voiles
(`.particle-veil`, `.network-veil-title`), CRM, `/estimation`, sections problème / agents /
résultat (hors effet de titre). Aucune dépendance npm, aucune donnée, aucune requête.

**Ordre : Lot 1 puis Lot 2.** Les deux lots sont indépendants fonctionnellement ; les fichiers
communs (listés) sont touchés dans des parties distinctes, Lot 2 part de l'état commité du Lot 1.

---

## Lot 1 — effets de titre uniques + bloc A

### L1-T1 — Effets de titre (§ 2.11.8.2)

- `components/ui/EditorialTitle.tsx` (+ `.module.css`, `EditorialTitleReplay.module.css`) :
  - nouvelle valeur `accentEffect="tech"` : le mot accentué rendu en `span` par lettre
    (`inline-block`, `font-kerning: none` sur ces `span`), `data-accent-effect="tech"` sur le
    `h1`/`h2`, montage de l'îlot client dans `.title-accent` ;
  - **préparer le Lot 2** : props `tone?: "ink" | "inverse"` (défaut `ink` ; `inverse` =
    `text-ink-inverse` sur tous les mots) et `align?: "start" | "center"` (défaut `start`).
    Rendu actuel strictement inchangé quand elles sont absentes.
- Nouveau dossier `components/ui/tech-accent/` : adapter le code TechText récupérable par
  `git show f83805c^:components/landing/wordmark/<fichier>` (`tech-wordmark.ts`,
  `paint-wordmark.ts`, `wordmark-engine.ts`, `TechWordmark.tsx`, `TechWordmark.module.css`,
  tests) à un **mot de titre** : délai 760 ms après `entering`, étiquette **sous** le cadre,
  débord du canvas 32 / 32 / 32 / 44 px, specks 10 / 6, police lue sur le `span` (Instrument
  Serif italique), boîte = encre. En-tête « Adapted from React Bits — TechText » sur chaque
  fichier adapté.
- Rejeu au survol de « décide » : le balayage rejoue (conditions du § 2.11.2 D) ; suivi du
  pointeur et lettre qu'on tire (souris / stylet). `AccentReplayController` **ignore**
  `[data-accent-effect="tech"]` ; commentaires « seven titles » → « three titles ».
- Appels :
  - `LandingHero` : inchangé (`underline` + `accentReplay`) — seule la mise en page change (L1-T2).
  - `ProblemHeading` : inchangé.
  - `LandingControl` : `accentEffect="tech"` + `accentReplay`.
  - `LandingAgents`, `LandingResult`, `LandingSolution`, `LandingFinal` : **retirer**
    `accentEffect` et `accentReplay` (deux lignes par fichier, rien d'autre dans les deux
    derniers : ils sont réécrits au Lot 2).
- `THIRD_PARTY_NOTICES.md` : remettre la section « React Bits — TechText » (licence copiée à
  l'identique depuis `git show f83805c^:THIRD_PARTY_NOTICES.md`), « Adapted in » →
  `components/ui/tech-accent/…`, « Scope of use » → effet décoratif d'un mot de titre du site.

### L1-T2 — Bloc A (§ 2.11.8.3)

- `components/landing/LandingHero.tsx` : deux bandes ; bande 1 = grille actuelle, colonne
  gauche étiquette + `h1` (conteneur `@container` identique), colonne droite sous-titre +
  actions + preuves, `lg:items-end` ; `min-h-[…]` retiré ; bande 2 = bloc A pleine largeur.
- Nouveau `components/landing/ecosystem/` : `HeroEcosystem.tsx` (client), `ecosystem-timeline.ts`
  (**pur** : pas, instants, cases cochées à t, durée du cycle 9 800 ms), `EcosystemCard.tsx`,
  `CursorYou.tsx` (curseur « Vous », **réutilisé au Lot 2** par les cartes 4 et 7 du bloc C),
  `ConvergingLines.tsx`, `ecosystem.module.css`. Réutiliser `AgentAppIcon`, `Icon`,
  `SimulationBadge`, `ButtonLink`.
- Supprimer `components/landing/HeroJourney.tsx`, `journey-timeline.ts` et son test.
- `components/landing-texts.ts`, **clé `journey` seulement** (+ `hero` si besoin) : garder
  `journey.badge` et `journey.steps` (testés contre le carrousel des agents) ; ajouter
  `journey.cards` (tableau du § 2.11.8.3 : prénom, rôle, nature, glyphe, lignes `{ icon, label,
  by: "agent" | "you" | "missing", detail? }`), `journey.pills` (`agent: "Agent"`, `you: "Vous"`),
  `journey.cursor: "Vous"`, `journey.guard` (phrase en segments, mots forts « validez »,
  « confirmez »), `journey.note: "Illustration en boucle, exemple fictif. Aucun prospect réel,
  aucun envoi."`, `journey.dots` (`label: "Choisir une étape"`, `item: "Étape {n} sur 7 : {nom}"`),
  `journey.srSummary` (phrases du § 2.11.8.3, Accessibilité). Retirer `journey.states`,
  `journey.prospect` s'ils ne servent plus.
- Contrat de la figure : `data-testid="hero-ecosystem"`, `data-loop="allowed"` (**seul élément
  de la page**), `data-loop-state` (`reduced` | `paused` | `playing`), `data-loop-cycles`,
  `data-step` ; chaque case `data-check` (`agent` | `you` | `missing`) et `data-checked`.
  **Aucun `requestAnimationFrame`**, aucune animation infinie : minuteurs + transitions CSS.

### L1 — ne pas toucher

`components/landing/living/**`, `LandingProblem`, `problem/**`, `agents/**`,
`LandingHeading.tsx`, `components/ui/Button*.tsx`, `SimulationBadge.tsx`, le corps de
`LandingSolution.tsx` et `LandingFinal.tsx` (hors retrait des deux props), clés `solution` et
`final` de `landing-texts.ts`, CRM, `/estimation`, `app/globals.css` (sauf token local
indispensable, à signaler).

### L1 — tests

- Unitaires (Vitest) :
  - `tech-accent/*.test.ts` : chronologie du balayage pour 6 lettres (≤ 1 600 ms, délai 760),
    ressort (retour < 0,5 px ≤ 700 ms, dépassement ≤ 6 px), plafond de glisser 0,6 em, specks
    déterministes, portée ; peinture (contour extérieur seul).
  - `EditorialTitle.test.tsx` : `tech` → lettres en `span`, `data-accent-effect`, aucun cadre ni
    trait ; `tone` / `align` ; rendu inchangé sans ces props ; `accentReplay` sans effet → aucun
    attribut.
  - `ecosystem-timeline.test.ts` : cycle 9 800 ms ; instants des 15 coches ; une case `you` n'est
    cochée qu'après l'arrivée du curseur ; « Motivation » jamais cochée ; état final = HTML serveur.
  - `LandingHero.test.tsx`, `app/(marketing)/page.test.tsx`, `landing-texts.test.ts` mis à jour
    (badge, note, phrase de garde-fou, aucun chiffre interdit).
- E2E (Playwright) :
  - `e2e/landing-titre-tech.spec.ts` (nouveau) : § 2.11.8.6 T2, T3 (1440 souris, 390 tactile,
    mouvement réduit).
  - `e2e/typographie-expressive.spec.ts` : § 2.11.8.6 T1 sur les **sept** titres (solution et
    final : aucun effet dès ce lot) ; critère 6 bis réduit aux trois titres.
  - `e2e/landing-ecosysteme.spec.ts` (nouveau) : A1–A5 à 1440 / 1024 / 390 / 360.
  - `e2e/landing-sans-boucle.spec.ts` : **exception du bloc A** — captures avec
    `mask: [page.locator("[data-loop='allowed']")]` ; assertion qu'**un seul** élément porte
    `data-loop="allowed"` ; compteur `requestAnimationFrame` et liste des animations infinies
    **inchangés** (toujours exigés à zéro / vide) ; ajout : section « problème » centrée →
    `data-loop-state="paused"`.
  - `e2e/accueil.spec.ts` : remplacer les assertions de `HeroJourney` (états `done`, 5,2 s) par
    celles du bloc A ; garder les garde-fous (§ 2.11.7 n° 10).
- Fini quand : `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, les E2E ci-dessus +
  `landing-reseau`, `particules`, `voiles-lisibilite`, `premier-regard` verts ; captures 1440 /
  1024 / 390 : hero (bande 1 + bloc A en lecture, mouvement réduit), titre « décide » pendant le
  balayage et au repos.

---

## Lot 2 — bloc B + bloc C

### L2-T1 — Bloc B (§ 2.11.8.4)

- `components/landing/LandingSolution.tsx` : en-tête inchangé (sans effet depuis le Lot 1),
  les 7 cartes remplacées par la grille de 5 tuiles.
- Nouveau `components/landing/solution/` : `SolutionTile.tsx` (tuile commune),
  `RoadmapVisual.tsx`, `ProgressVisual.tsx` (étapes réelles `PIPELINE_STAGES` /
  `PIPELINE_STAGE_LABELS`, sans « Perdu »), `TeamVisual.tsx`, `ReportVisual.tsx`,
  `GuardsVisual.tsx`, `solution.module.css`. Server Components ; mouvement en CSS sous le
  `Reveal` (`[data-reveal="entering"]`), état final par défaut.
- `landing-texts.ts`, **clé `solution` seulement** : garder `kicker`, `title*`, `body`, `rail`,
  `railLabel` ; ajouter `tiles` (titres, paragraphes, `aria-label` des visuels, « Progression —
  dossier fictif », « En attente de vous », « Compte-rendu · Sarah », « 3 actions prêtes »,
  légendes des nombres, lignes libellé / valeur) et `fictive: "Exemple fictif"`.

### L2-T2 — Bloc C (§ 2.11.8.5)

- `components/landing/LandingFinal.tsx` : panneau noir pleine largeur, titre centré blanc
  (`LandingHeading` avec `veil={false}`, nouvelles props `tone="inverse"` et `align="center"`
  transmises à `EditorialTitle`), paragraphe, actions, note, flèches, piste, étiquette,
  progression.
- `components/landing/LandingHeading.tsx` : transmettre `tone` et `align` (défauts inchangés).
- Nouveau `components/landing/process/` : `ProcessCarousel.tsx` (client ; réutilise
  `agents/useTrackPhysics.ts` et `track-physics.ts` **sans les modifier** — si une adaptation est
  nécessaire, l'envelopper, ne pas changer le comportement du carrousel des agents),
  `process-carousel.ts` (pur : index borné, pourcentage `Math.round((i+1)/7*100)`, libellés),
  `ProcessCard.tsx`, sept visuels `visuals/*.tsx` + `process.module.css`. Curseur « Vous » :
  `ecosystem/CursorYou.tsx` du Lot 1.
- `components/ui/Button.tsx` / `ButtonLink.tsx` : variantes **`light`** et **`outline-light`**
  (§ 2.11.8.5) ; variantes existantes inchangées.
- `components/ui/SimulationBadge.tsx` : prop `surface?: "light" | "dark"` (défaut `light`, rendu
  actuel ; `dark` = fond `#fafafa`, texte `#0a0a0b`). Le CRM ne l'utilise pas.
- `landing-texts.ts`, **clé `final` seulement** : garder `title*`, `note` ; ajouter `body`
  (« Sept étapes, de la demande au mandat. Deux restent toujours humaines. »), `carousel`
  (`label: "Les sept étapes d'un dossier"`, `previous: "Étape précédente"`, `next: "Étape
  suivante"`, `stepPrefix: "Étape n°"`, `human: "Humaine"`, `position: "Étape {n} sur 7"`,
  `badge` = `journey.badge`), `steps` (7 × `{ key, title, owner, body, pending, done }`, textes du
  § 2.11.8.5). **Aucun « % » dans les textes** : le pourcentage est calculé.

### L2 — ne pas toucher

`components/ui/EditorialTitle*` (props prêtes depuis le Lot 1), `components/ui/tech-accent/**`,
`components/landing/ecosystem/**` (sauf import de `CursorYou`), `AccentReplayController`,
`LandingHero`, `LandingControl`, `LandingAgents`, `agents/**` (réutilisation en lecture seule),
`living/**`, clés `hero`, `journey`, `control` de `landing-texts.ts`, `e2e/landing-titre-tech.spec.ts`,
`e2e/landing-ecosysteme.spec.ts`, CRM, `/estimation`.

### L2 — tests

- Unitaires : `process-carousel.test.ts` (bornes, pourcentages 14 / 29 / 43 / 57 / 71 / 86 /
  100, libellés) ; rendu de `LandingSolution` (5 tuiles, étiquettes « Exemple fictif » sur 1–4,
  aucune sur 5, aucun chiffre hors tuile 5) ; `LandingFinal` (ordre titre → paragraphe →
  actions → note → flèches → piste ; flèche précédente `aria-disabled` au départ) ;
  `Button.test.tsx` (deux variantes), `SimulationBadge.test.tsx` (`surface`) ;
  `landing-texts.test.ts` (nouvelles clés).
- E2E :
  - `e2e/landing-solution.spec.ts` (nouveau) : B1–B3 à 1440 / 1024 / 390 / 360, mouvement
    réduit.
  - `e2e/landing-final.spec.ts` (nouveau) : C1–C5 (flèches, clavier, glisser souris, clic sur
    voisine, 10 s sans défilement automatique, contrastes calculés, mouvement réduit, 390 / 360).
  - `e2e/accueil.spec.ts` : remplacer le test « panneau final : la note est le dernier
    élément… » (§ 2.11.3 bis, remplacé) par l'ordre et le centrage du bloc C.
  - `e2e/typographie-expressive.spec.ts` : titre final centré et `tone` inverse (couleur
    calculée `#fafafa`), toujours sans effet.
  - `e2e/landing-sans-boucle.spec.ts` : inchangé ; doit rester vert (section `final` + 5 s).
- Fini quand : lint, `tsc`, Vitest, E2E ci-dessus + `landing-sans-boucle`, `landing-reseau`,
  `landing-agents`, `particules`, `voiles-lisibilite`, `premier-regard` verts ; captures 1440 /
  1024 / 390 : grille de la solution (pendant et après l'arrivée), panneau final (carte 1, carte
  4 après « Valider », carte 7), mouvement réduit.

---

## Mesures à reporter dans `docs/design-system.md` § 2.11.8 après implémentation

Largeur du mot « décide » avant / après découpage en lettres ; début et fin réels du balayage ;
coût d'une image active ; durée réelle d'un cycle du bloc A ; contrastes mesurés du bloc C ;
hauteur réelle de la bande 1 du hero à 1440 × 900 (critère A1). Tout écart avec la spécification
est signalé, pas corrigé en silence.

---

## Lot 3 — retours de l'audit (03/10) : bloc A ordonné, bloc B sans texte, section contrôle

Spécification : `docs/design-system.md` **§ 2.11.8.7** (L3-A à L3-E). Un seul lot, sur l'état
commité des Lots 1 et 2. Branche `feat/landing-polish`, pas de push. Aucune dépendance, aucune
donnée, aucune requête.

**Ordre** : L3-T1 (A) → L3-T2 (B) → L3-T3 (titre) → L3-T4 (section contrôle) → tests.

### L3-T1 — Bloc A ordonné (§ 2.11.8.7 L3-A)

- `components/landing/ecosystem/ecosystem.module.css` : ≥ 1440 (`90rem`) grille
  `repeat(7, 186px)`, `gap: 12px`, **aucune** marge haute (supprimer les décalages
  `.colEmma` … `.colMandate`), cartes étirées à la même hauteur ; 1024–1439 grille
  `repeat(8, 100px)`, `gap: 16px`, chaque carte sur 2 demi-colonnes, rangée 2 (Louis, Sarah,
  Mandat) en colonnes 2–3 / 4–5 / 6–7, `grid-auto-rows: 1fr` ; < 1024 carrousel inchangé +
  `align-items: stretch`. Carte : rembourrage 8 px ; ligne : `padding: 0 8px`, `gap: 6px`.
  Ligne manquante : libellé et détail empilés (13 / 14 px et 11 / 13 px). Les enveloppes
  `.col` / `.group` peuvent disparaître du JSX si la grille les rend inutiles (ordre DOM =
  ordre des cartes).
- `HeroEcosystem.tsx` : structure de la piste adaptée à la grille (ordre DOM = Léa, Hugo, Emma,
  Validation, Louis, Sarah, Mandat).
- `ecosystem-geometry.ts` : **parc** = pointe au centre horizontal de la carte `review`,
  20 px sous son bord bas ; `convergingGeometry` : une ligne **par carte de la dernière
  rangée** (≥ 1440 : 7 ; 1024–1439 : 3), départ au milieu du bas de la carte + 8 px.
- `components/landing-texts.ts`, clé `journey` : Emma ligne 1 `label: "Consentement"`
  (`srSummary` inchangé).
- **Ne pas toucher** : `ecosystem-timeline.ts` (chronologie, `EcosystemLoop`), `CursorYou.tsx` ;
  `EcosystemCard.tsx` seulement pour la ligne manquante empilée.

### L3-T2 — Bloc B : illustrations seules (§ 2.11.8.7 L3-B)

- `components/landing/solution/SolutionTile.tsx` : `article` `aria-labelledby` → `h3.sr-only`
  (titre, id `solution-tile-{n}-title`) + `p.sr-only` (paragraphe) ; plus de bloc `.text`
  visible, plus d'`Icon` ; retirer `data-icon-trigger` ; la prop `icon` peut disparaître.
- `solution.module.css` : cadres 2–5 `flex: 1`, `min-height` 232 px (≥ 1024) / 220 px ;
  tuile 1 inchangée (remplit). Si les unités de conteneur des visuels 2–4 cassent : hauteur
  fixe 232 / 220 (le signaler).
- `LandingSolution.tsx` : retirer les props `icon` si supprimées. **Visuels inchangés**
  (`RoadmapVisual`, `ProgressVisual`, `TeamVisual`, `ReportVisual`, `GuardsVisual`).

### L3-T3 — Titre contrôle centré (§ 2.11.8.7 L3-C)

- `LandingControl.tsx` : `align="center"` (garder `accentEffect="tech"` et `accentReplay`).
- `LandingHeading.tsx` : en mode centré, ajouter `mx-auto` au bloc du sur-titre. Rien d'autre.
- **Ne pas toucher** `components/ui/EditorialTitle*`, `components/ui/tech-accent/**`.

### L3-T4 — Section contrôle : deux tuiles (§ 2.11.8.7 L3-D)

- `LandingControl.tsx` : remplacer le `ul` des 6 cartes par la grille de 2 tuiles + séparateurs
  (≥ 1280).
- Nouveau `components/landing/control/` :
  - `ControlTile.tsx` (Server Component : `article`, cadre, légende `h3` + paragraphe + liste
    de 3 garde-fous ; arrivée CSS sous `Reveal frame="still"`, survol) ;
  - `TeamChartVisual.tsx` (Server Component, scènes fixes 518 × 264 et 286 × 288, SVG des
    lignes aux coordonnées du § 2.11.8.7, mouvement CSS `backwards`) ;
  - `ControlTimeline.tsx` (`"use client"`, îlot de la frise) + `control-timeline.ts` (**pur** :
    `DAY_MS = 280`, blocs, événements, `frameAt(t)`, `finalFrame()`, `STEP_TIMES`, lecteur
    une fois à minuteur injecté — même principe que `EcosystemLoop`, sans boucle) ;
  - `control.module.css` (+ un second module si le premier dépasse ≈ 300 lignes).
  - Réutiliser `AgentAppIcon`, `Icon`, `SimulationBadge`, `ecosystem/CursorYou.tsx` (import
    seulement, **sans le modifier**), `Reveal`.
- `landing-texts.ts`, clé `control` : `facts` inchangés + champ `tile` ; ajouter `tiles.team`,
  `tiles.timeline` (textes exacts du § 2.11.8.7). Aucun « % ».
- Contrat : `data-testid="control-grid"`, `control-tile` (× 2), `control-timeline`
  (`data-visual-state`, `data-step`), `control-playhead` (`data-day`), blocs `data-block`,
  `data-shown`, `data-decision`. **Pas de `data-loop`.** **Aucun `requestAnimationFrame`**,
  aucune animation infinie, un seul minuteur armé.

### L3 — ne pas toucher

CRM (`app/(app)/**`, `features/**`), `/estimation`, `components/landing/living/**`,
`components/landing/process/**` (bloc C), `components/ui/tech-accent/**` (sauf besoin
démontré, à signaler), `components/ui/EditorialTitle*`, `AccentReplayController`,
`ecosystem-timeline.ts`, `CursorYou.tsx`, `agents/**`, `problem/**`, `LandingFinal.tsx`,
`LandingHero.tsx` (hors besoin de la grille), clés `hero`, `problem`, `agents`, `result`,
`final` de `landing-texts.ts`, `app/globals.css` (sauf token local indispensable, à
signaler), `THIRD_PARTY_NOTICES.md`.

### L3 — tests

- Unitaires (Vitest) :
  - `control-timeline.test.ts` (nouveau) : instants du tableau (924, 1 404, 1 584, 1 824,
    2 272, 2 636, 2 972, 3 308, fin 3 760) ; « 1er contact » `pending` avant 1 584,
    `validated` après, **jamais** validé avant l'arrivée du curseur (1 404) ; Mandat `pending`
    à tout instant ; état final = HTML serveur ; un seul minuteur armé ; aucun rejeu ; les
    9 états de la fiche dans l'ordre.
  - `LandingControl.test.tsx` (nouveau) : 2 tuiles, 6 facts (nom + phrase) en texte, 3 + 3
    dans l'ordre, 2 `role="img"` nommés, badge sur la frise seule, aucun `[data-loop]`, titre
    `data-title-align="center"` et `data-accent-effect="tech"`.
  - `LandingHeading.test.tsx` : sur-titre centré (`mx-auto`) en mode `center`, inchangé sinon.
  - `LandingSolution.test.tsx` : titres en `h3.sr-only`, paragraphes `sr-only`, aucun texte
    visible hors cadre, badges 1–4, `role="img"` inchangés.
  - `ecosystem-timeline.test.ts` : inchangé et vert ; `landing-texts.test.ts` : libellé
    « Consentement », clés `control.tiles`, `facts[].tile`.
  - `app/(marketing)/page.test.tsx` : vert (facts toujours présents).
- E2E (Playwright) :
  - `e2e/landing-ecosysteme.spec.ts` : A1 réécrit selon L3-A1 (1440 : 7 colonnes de 186,
    7 lignes, un seul haut, une seule hauteur ; 1024 : 7 cartes de 216 en 4 + 3, rangée 2
    centrée, 3 lignes) ; contrôle « libellé sur une ligne » : exclure la ligne `missing`
    (seule sur deux lignes) ; ajouter L3-A2 et L3-A4 ; A2–A5 inchangés.
  - `e2e/landing-solution.spec.ts` : L3-B1, L3-B2 (1440 / 1024 / 390 / 360).
  - `e2e/landing-controle.spec.ts` (nouveau) : L3-C1, L3-D1 à L3-D6 à 1440 / 1280 / 1024 /
    390 / 360, mouvement réduit, sans JS (`javaScriptEnabled: false` : facts et état final).
  - `e2e/landing-titre-tech.spec.ts` : doit rester vert (titre centré).
  - `e2e/landing-sans-boucle.spec.ts` : **inchangé**, doit rester vert (un seul `[data-loop]`,
    section `controle` immobile 5 s après centrage).
  - `e2e/typographie-expressive.spec.ts`, `e2e/accueil.spec.ts` : verts (adapter seulement une
    assertion qui lirait les 6 anciennes cartes, à signaler).
- Fini quand : `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, les E2E ci-dessus +
  `landing-final`, `landing-agents`, `landing-reseau`, `particules`, `voiles-lisibilite`,
  `premier-regard` verts ; captures 1440 / 1024 / 390 : hero (bloc A au repos et pendant une
  coche « Vous »), grille de la solution, section contrôle (frise à ≈ 1,2 s, à la fin,
  mouvement réduit). Mesures réelles (hauteur commune des cartes A, fin réelle de la frise et
  de l'organigramme, largeur des libellés de blocs) et écarts reportés dans
  `docs/design-system.md` § 2.11.8.7, pas corrigés en silence.
