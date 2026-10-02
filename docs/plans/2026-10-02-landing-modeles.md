# Plan — modèles MIG / Striker sur la landing (`/`), 02/10/2026 (soir)

Branche : `feat/landing-polish` (pas de nouvelle branche, pas de push). Demande de l'utilisateur
**validée** : `docs/references/2026-10-02-modeles-mig-striker.md` (+ capture du modèle C).
Spécification : `docs/design-system.md` **§ 2.11.8** (2.11.8.1 règles, 2.11.8.2 effets de titre,
2.11.8.3 bloc A, 2.11.8.4 bloc B, 2.11.8.5 bloc C, 2.11.8.6 critères). Renvois posés dans § 1.1,
§ 2.11, § 2.11.1, § 2.11.2, § 2.11.3, § 2.11.3 bis, § 2.11.5, § 2.11.7.

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
