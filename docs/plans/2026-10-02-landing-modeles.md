# Plan — modèles MIG / Striker sur la landing (`/`), 02/10/2026 (soir)

Branche : `feat/landing-polish` (pas de nouvelle branche, pas de push). Demande de l'utilisateur
**validée** : `docs/references/2026-10-02-modeles-mig-striker.md` (+ capture du modèle C).
Spécification : `docs/design-system.md` **§ 2.11.8** (2.11.8.1 règles, 2.11.8.2 effets de titre,
2.11.8.3 bloc A, 2.11.8.4 bloc B, 2.11.8.5 bloc C, 2.11.8.6 critères). Renvois posés dans § 1.1,
§ 2.11, § 2.11.1, § 2.11.2, § 2.11.3, § 2.11.3 bis, § 2.11.5, § 2.11.7.

**Lot 4 (04/10/2026) — implémenté et testé** (`frontend-ux`, 04/10/2026 ; mesures, écarts et tests : `docs/design-system.md` § 2.11.8.8 « Avancement du Lot 4 ») — à auditer par l'utilisateur ; spec `docs/design-system.md` **§ 2.11.8.8** ;
brief « Lot 4 » en fin de ce document.

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

---

## Lot 4 — retours de l'utilisateur (04/10) : trois blocs lents, ROI, titres, rejeu

Spécification : `docs/design-system.md` **§ 2.11.8.8** (L4-A à L4-F). Demande **validée**
(`docs/references/2026-10-02-modeles-mig-striker.md`, « Retours … (04/10) — Lot 4 ») ;
chiffres : `docs/recherche-roi-agences.md`. Un seul lot, sur l'état actuel de
`feat/landing-polish`. Pas de push, pas de nouvelle branche, aucune donnée, aucune requête.
**Une seule dépendance autorisée : `animejs` 4.x** (MIT), version figée.

**Ordre** : L4-T0 (dépendance) → L4-T1 (titres) → L4-T2 (bloc A) → L4-T3 (ROI) → L4-T4
(rejeu) → tests → captures → mesures reportées au § 2.11.8.8 (« Avancement »).

### L4-T0 — Dépendance

- `npm install animejs@4.5.0 --save-exact` (dernière 4.x vérifiée le 04/10 ; pas de `^`).
  Section « anime.js » (texte MIT du paquet, à l'identique) dans `THIRD_PARTY_NOTICES.md`.
  Import **uniquement** sous `components/landing/roi/**` (test de garde : aucun autre fichier
  n'importe `animejs`).

### L4-T1 — Titres (§ 2.11.8.8 L4-C)

- `components/ui/EditorialTitle.tsx` : prop `accentFace?: "serif" | "title"` (défaut
  `"serif"`) → classe `title-accent-plain` + `data-accent-face="title"` ; `data-title-word`
  sur chaque `span` de mot visuel (mot accentué compris) ; `accentOverhangEm` → 0 en police
  titre (`editorial-title.ts`).
- `app/globals.css` : classe `title-accent-plain` (`@layer utilities`, après
  `.title-accent`). Rien d'autre dans ce fichier.
- `EditorialTitle.module.css` : `--accent-baseline`, `--accent-ink-top`,
  `--accent-ink-bottom` et décalages du trait / du cadre re-mesurés pour la police titre, sous
  `[data-accent-face="title"]` (les valeurs serif restent pour `/estimation`).
- `LandingHero.tsx`, `LandingHeading.tsx`, `LandingFinal.tsx` : `accentFace="title"`.
- `components/landing/accent-replay.ts` : `isTap`, chemin « toucher » ;
  `AccentReplayController.tsx` : déclenchement par mot (`[data-title-word]`, réarmement au
  `pointerleave` du titre) + toucher bref (écouteurs passifs, jamais `preventDefault`) ;
  attaché dès que le mouvement est autorisé.
- `components/ui/tech-accent/**` : même déclenchement (survol d'un mot depuis l'extérieur ;
  toucher bref → balayage seul, jamais `follow` / `drag` au toucher), en réutilisant
  `accent-replay.ts`.
- **Ne pas toucher** : `EmptyState`, `/estimation`, les polices chargées (Instrument Serif
  reste utilisée par le CRM et `/estimation`).

### L4-T2 — Bloc A (§ 2.11.8.8 L4-A)

- `components/landing-texts.ts`, clé `journey` : `cards` → `blocks` (structure et textes
  exacts du § 2.11.8.8), `pills`, `dots.item`, `srSummary` (3 phrases). `steps` inchangé.
- `components/landing/ecosystem/` :
  - `ecosystem-timeline.ts` : `CYCLE_MS = 24000`, `AGENT_CADENCE_MS = 700`,
    `MISSING_TRACE_AT = 5100`, `CHECKS`, `RINGS`, `CURSOR_MOVES` du tableau ; disposition en
    blocs → groupes → lignes ; `EcosystemLoop` inchangé dans son principe (`setTimeout`
    seulement) ;
  - `EcosystemCard.tsx` → bloc à groupes (ou nouveau `EcosystemBlock.tsx`, l'ancien
    supprimé) ;
  - nouveau `AppTile.tsx` (+ `app-tile.module.css`) : tokens `--app-tile-orange|violet|green`
    **locaux à ce module**, peinture blanche du glyphe, `[data-on-accent]` à la couleur du bas
    du dégradé ;
  - `ecosystem-geometry.ts` : parc sous le bloc Validation, 3 / 2 lignes convergentes ;
  - `ecosystem.module.css` : compositions ≥ 1440 / 1024–1439 / < 1024, durées des coches
    (400 / 320 / 120 ms), appui 150 + 150 ms, anneau 440 ms ;
  - `HeroEcosystem.tsx` : 3 points, histoire de la tuile au début de l'anneau, abonnement au
    rejeu (L4-T4) ;
  - `CursorYou.tsx`, `ConvergingLines.tsx` : réutilisés **sans modification**.
- **Interdit dans le bloc A** : anime.js, `requestAnimationFrame`, animation CSS infinie.

### L4-T3 — Section ROI (§ 2.11.8.8 L4-B)

- `components/landing/LandingResult.tsx` : en-tête ROI + légende + grille + avertissement ;
  garde `section`, `aria-labelledby="result-title"`, `data-living-scene="resultat"` ; retire
  le cadre pipeline, les encarts et les imports `features/**`.
- Nouveau `components/landing/roi/` : `roi-model.ts` (**pur** : défauts, bornes, pas,
  calculs, arrondis, format fr-FR), `RoiWidget.tsx` (tuile), `RoiTag.tsx`, `RoiSlider.tsx`,
  `RoiNumber.tsx` (nombre animé `aria-hidden` + `sr-only` final), `SpeedWidget.tsx`,
  `MandatesWidget.tsx`, `TimeWidget.tsx`, `FollowupWidget.tsx`, `use-roi-arrival.ts`
  (IntersectionObserver ≥ 40 %, + 240 ms, état `armed|playing|done`, mouvement réduit,
  rejeu), `roi.module.css`. Server Components là où rien ne bouge (en-tête, mentions, cadre de
  tuile) ; îlots clients pour les nombres, scènes et curseurs.
- `components/landing-texts.ts` : clé `result` → `roi` (textes exacts du § 2.11.8.8).
- `Reveal` existant pour l'arrivée des tuiles. Aucune valeur enregistrée, aucune requête.

### L4-T4 — Rejeu global (§ 2.11.8.8 L4-D)

- Nouveaux `components/landing/replay/replay-bus.ts` et
  `components/landing/replay/ReplayAnimationsButton.tsx` (îlot client, monté dans
  `app/(marketing)/page.tsx` en dernier contenu de `[data-landing]`, avant
  `AccentReplayController`).
- Nouveau glyphe utilitaire `replay` dans `components/icons/definitions/utility.tsx`
  (`tone: "ink"`, `animated: false`) ; mettre à jour `Icon.test.tsx` / `e2e/icones.spec.ts`
  s'ils comptent les glyphes.
- Abonnements (retour à l'état armé, rien d'autre) : `components/ui/Reveal.tsx` (générique),
  `AccentReplayController` (titres `reveal="load"` : `getAnimations` → `cancel()` /
  `play()` ; retrait de `data-accent-played`), `TechAccent`, `HeroEcosystem`, îlots des
  sections problème et agents qui jouent une arrivée, `ControlTimeline`, `ProcessCarousel` /
  visuels du bloc C (retour **instantané** à l'étape 1), ROI, `SimulationBadge` (cycle
  unique). **Réseau de fond : aucun abonnement.**
- Dans `components/landing/process/**` et `components/landing/control/**` : **seulement**
  l'abonnement au rejeu.

### L4 — ne pas toucher

CRM (`app/(app)/**`, `features/**`), `/estimation`, `components/landing/living/**` (fond :
« ne pas toucher »), voiles, `components/landing/solution/**` (CSS sous `Reveal` : rien à
faire), `components/landing/process/**` et `control/**` hors abonnement au rejeu,
`CursorYou.tsx`, `ConvergingLines.tsx`, `EmptyState`, `e2e/landing-sans-boucle.spec.ts`.

### L4 — tests

- Unitaires (Vitest) :
  - `ecosystem-timeline.test.ts` : réécrit (cycle 24 000, 15 instants, ordre Acquisition →
    Validation (2) → Suivi → Validation (1), cases « Vous » cochées après l'arrivée du
    curseur, « Mandat confirmé » après « Mandat signalé », manquante jamais cochée, pause /
    reprise, état final = HTML serveur).
  - `roi-model.test.ts` (nouveau) : défauts (900 / 270 / 10 800 ; 480 / 72 / 5,8 / 3,5 /
    51 000), bornes (2 030 h / 81 000 € ; ≈ 254 000 €), arrondis, format fr-FR, négociateurs
    5 → 340 h / 13 500 €.
  - `accent-replay.test.ts` : `isTap` (10 px, 600 ms, annulation), `touch` accepté.
  - `replay-bus.test.ts` (nouveau) ; `Reveal.test.tsx` : retour à `hidden` puis `entering`
    au rejeu.
  - `EditorialTitle.test.tsx` : `accentFace="title"` → classe et attribut, `data-title-word`
    sur chaque mot, `serif` par défaut.
  - `landing-texts.test.ts` : bloc A (`blocks`, 12 / 1 / 3, `srSummary` 3 phrases, libellés
    ≤ 20) ; « claims no figure » et « no ROI » **hors clé `roi`** ; nouveau test ROI : textes
    exacts des 4 mentions et de l'avertissement, aucun « garanti » / « vous gagnerez », chaque
    valeur affichée a un `kind` (`source` | `hypothesis` | `estimate`).
  - Gardes : `animejs` importé seulement sous `components/landing/roi/**` ; tokens
    `--app-tile-*` présents dans un seul fichier CSS.
  - `app/(marketing)/page.test.tsx`, `LandingHero.test.tsx` : verts (adapter les lectures de
    `journey.cards` / `result`).
- E2E (Playwright) :
  - `e2e/landing-ecosysteme.spec.ts` : réécrit selon L4-A1 à L4-A5 (1440 / 1024 / 390 / 360,
    boucle de 24 s — un cycle complet, délai du test ajusté —, pause, mouvement réduit, sans
    JS).
  - `e2e/typographie-expressive.spec.ts` : landing → mot accentué en Bricolage droit (L4-C1,
    C2) ; `/estimation` et états vides → serif italique (inchangé) ; le test « tactile : un
    toucher ne rejoue rien » est **remplacé** par L4-C4 ; ajout L4-C3.
  - `e2e/landing-titre-tech.spec.ts` : police titre (T2 recalé) ; test tactile remplacé par
    « toucher bref → `sweep`, jamais `follow` / `drag`, la page défile » ; survol d'un autre
    mot du titre → balayage.
  - `e2e/accueil.spec.ts` : la garde « aucun % ni € » **exclut `[data-testid='roi']`** ;
    lectures du bloc A adaptées (3 blocs, 15 cases).
  - `e2e/landing-roi.spec.ts` (nouveau) : L4-B1 à L4-B5 à 1440 / 1280 / 1024 / 390 / 360,
    mouvement réduit, sans JS, clavier sur les curseurs, `aria-live`.
  - `e2e/landing-rejeu.spec.ts` (nouveau) : L4-D1 à L4-D4.
  - `e2e/landing-sans-boucle.spec.ts` : **inchangé**, vert (bouton fixe immobile ; ROI
    immobile 5 s après centrage ; anime.js à l'arrêt).
  - Verts sans changement attendu : `landing-solution`, `landing-controle`, `landing-final`,
    `landing-agents`, `landing-reseau`, `particules`, `voiles-lisibilite`, `premier-regard`,
    `estimation`, `icones` (sauf comptage de glyphes).
- Fini quand : `npm run lint`, `npx tsc --noEmit`, `npx vitest run` et les E2E ci-dessus
  verts ; captures 1440 / 1024 / 390 / 360 : hero (bloc A au repos, pendant une coche
  « Vous », état final), section ROI (pendant l'arrivée ≈ 0,6 s, à la fin, après un
  changement de curseur, mouvement réduit), un titre à effet pendant un rejeu au toucher
  (390), le bouton de rejeu (≥ 640 et < 640, focus visible). Mesures réelles (largeurs et
  hauteurs des trois blocs, cycle mesuré, fins réelles des 4 widgets,
  `requestAnimationFrame` après `done`, géométrie du trait / du cadre en police titre) et
  écarts reportés dans `docs/design-system.md` § 2.11.8.8, pas corrigés en silence.
