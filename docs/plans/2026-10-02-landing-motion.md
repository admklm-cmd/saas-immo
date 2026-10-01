# Landing en mouvement — effets de titre, wordmark « Ascend », réseau 3D, zéro boucle

> Auteur : `web-designer`, rédigé le 01/10/2026 pour le lot du 02/10/2026.
> Branche : `feat/landing-motion` (créée depuis `feat/expressive-typography`, propre au départ).
> Périmètre : **landing publique (`/`) uniquement.** Le CRM, `/estimation` et les composants
> partagés gardent leur rendu actuel (toute évolution d'un composant partagé est une option
> désactivée par défaut, ou une règle CSS limitée à la landing).
> La spécification exécutable vit dans `docs/design-system.md` § 2.11 (et renvois en § 1.1,
> § 2.5, § 3.8). En cas d'écart, **c'est elle qui fait foi**.

> **Révision « 02/10 — référence utilisateur ».** L'utilisateur a fourni le rendu exact du
> réseau : `C:\Users\admha\Documents\Codex\2026-10-01\am\outputs\ascend-neural-network-demo.html`
> (hors dépôt ; à verser dans `docs/references/reseau-neuronal-demo.html`). Le réseau est
> respécifié d'après ce fichier (§ 2.3, T5, T6, T7, T8, § 5 ; design-system § 2.11.4 réécrit,
> § 2.11.1 règle 4, § 2.11.6, § 2.11.7). Inchangés : effets de titre (T3), wordmark (T4),
> parcours / badge / graphique (T1, T2), retrait de `MotionToggle`.

Distinction obligatoire : **demandé** (§ 0) · **spécifié** (`docs/design-system.md` § 2.11,
01/10/2026, réseau révisé le 02/10) · **implémenté** (rien) · **testé** (rien) · **validé
visuellement** (rien). Seules mesures réelles de la révision : la copie instrumentée de la
**référence** (pas du produit), § 2.3.
Aucun test n'a été exécuté pour rédiger ce plan : l'audit de l'existant est une **lecture du
code** (fichiers cités) et de l'audit du 01/10/2026 (`docs/audits/2026-10-01-expressive-typography.md`,
captures 1440 / 1024 / 390 de la veille). Les captures de contrôle sont demandées à la tâche T8.

---

## 0. Demande (validée par l'utilisateur, fait foi)

1. Trois effets de titre sur le mot accentué existant :
   hero « … garde la *main*. » = **surlignage** ; problème « … C'est l'*administratif*. » =
   **flou du reste + cadre à 4 coins** (d'après TrueFocus, React Bits) puis tout redevient net ;
   panneau final « Déposez une demande *fictive*. … » = **les deux** (flou du reste puis surlignage).
2. **TechText** (React Bits) : le mot « Ascend » en très grand dans le panneau final, adapté à la DA.
3. **Réseau neuronal 3D sur toute la landing** (nœuds et fibres noirs, impulsions électriques
   bleues qui parcourent les fibres et illuminent le cœur des neurones), plus dense, présent
   partout, y compris derrière les textes, contraste AA garanti. Faire évoluer `LivingBackground`.
4. **Aucune animation en boucle** sur la landing. Les impulsions sont jouées en **séquences
   bornées** (arrivée sur la page, puis à la première entrée dans chaque section), puis le
   réseau reste visible et immobile. Statuer sur `MotionToggle` (WCAG 2.2.2).
5. *(02/10 — référence utilisateur)* Le réseau doit coller au fichier de démonstration fourni :
   une vingtaine de neurones organiques espacés en profondeur, arbres dendritiques qui
   s'affinent, fibres de liaison sinueuses vers les 3 plus proches voisins, perspective et
   orbite de caméra lente, impulsions bleues à reflet et traînée qui se divisent aux
   embranchements et **illuminent le cœur** des neurones. Décisions de l'orchestrateur : une
   cascade à l'arrivée puis une courte salve par section, une fois ; caméra liée au défilement
   (et pendant une séquence), jamais de rotation au repos ; graine déterministe ; ni curseur de
   densité ni bouton « régénérer » ; halo des cœurs aux valeurs de la démo, pas plus.

Contraintes : aucune dépendance npm (`motion` exclu : CSS + petit JS), aucun rouge, bleu rare,
noir = information principale, mouvement réduit et pause = état final immédiat, titre lu une
fois (`sr-only` + `aria-hidden`), mentions « Simulation » / « Exemple fictif » / validation
humaine / « aucun envoi réel » intactes, budget de performance explicite.

---

## 1. Audit de l'existant (lecture du code, 01/10/2026)

### 1.1 Inventaire exhaustif de ce qui bouge en boucle sur `/`

| # | Élément | Fichier(s) | Mécanisme | Durée du cycle | Fin aujourd'hui |
|---|---|---|---|---|---|
| B1 | Illustration du parcours du hero | `components/landing/HeroJourney.tsx` (l. 52–56 : `index = (index + 1) % frames.length`), `components/landing/journey-timeline.ts` (`RESET_MS` 900, `AGENT_MS` 1500, `AWAITING_MS` 2600, `VALIDATED_MS` 700, `FINAL_HOLD_MS` 3600) | `setTimeout` en chaîne, rejoue depuis le début | ≈ 16,3 s (900 + 5 × 1500 + 2 × (2600 + 700) + 3600) | Jamais (sauf pause, onglet caché, mouvement réduit) |
| B2 | Fond vivant : dossiers fictifs qui circulent sur le chemin Léa → Mandat | `components/landing/living/files.ts`, `scenes.ts` (`period` 2,8–3,2 s), `timeline.ts` | Boucle `requestAnimationFrame` continue (`LivingEngine.ts`, `tick`) ; un dossier naît toutes les `period` secondes | Infini | Jamais tant que la page est visible |
| B3 | Fond vivant : ondulation des arrêts (scène `probleme`, `scatter` 9 px) | `model.ts` (`scenePoints`, `Math.sin(time * 0.37 …)`) | Sinus du temps | ≈ 17 s | Jamais |
| B4 | Fond vivant : agents qui s'allument tour à tour (scène `agents`) | `model.ts` (`spotlight`, `time % 7.5`) | Modulo du temps | 7,5 s | Jamais |
| B5 | Fond vivant : impulsions de trame (`probleme` : une toutes les 7,5 s par emplacement ; `agents` : toutes les 4 s, 3 au plus, visibles 99 % du temps) | `mesh.ts`, `routes.ts`, `mesh-style.ts` | Créneaux périodiques | 4 s / 7,5 s | Jamais |
| B6 | Fond vivant : poussières (`motes`) qui dérivent vers l'entrée | `motes.ts` | Dérive continue | Infini | Jamais |
| B7 | Fond vivant : « regain » de présence au défilement (`boost`, décroît en 1,6 s) | `LivingEngine.ts` (`boost`, `REST_INTENSITY` 0,72) | Lié au défilement | — | Se calme après le défilement (pas une boucle, mais un changement non nécessaire) |
| B8 | Badge « Simulation » : flottement vertical 3 s + point pulsant 2 s | `components/ui/micro-interactions.css` (`.simulation-badge`, `.simulation-dot`, `infinite`) ; rendu sur la landing par `HeroJourney.tsx`, `LandingSolution.tsx`, `agents/SceneFrame.tsx` | CSS `infinite` | 3 s / 2 s | Jamais (composant partagé avec le CRM) |

**Ne bouclent pas (vérifié) :** apparition des titres (`EditorialTitle.module.css`, une fois,
`backwards`) ; graphique du problème (`BlockerChart.module.css`, une fois — mais sa séquence
complète dure ≈ 5,1 s : `CAPACITY_DELAY_MS` 4 400 + 700 ms, `problem-scene.ts` l. 218–225) ;
causes du problème (`ProblemSystem.module.css`, une fois) ; ouverture de l'application des
agents (`agents.module.css`, une fois) ; icônes (`components/icons/`, testé « never loops ») ;
défilement physique du carrousel (piloté par la main) ; halo et magnétisme des boutons
(`PointerField`, pilotés par le pointeur). Le fond de particules du CRM (`components/motion/`)
n'est **pas** rendu sur `/` et n'est pas concerné.

### 1.2 Autres constats utiles au lot

- **Le fond vivant raconte une histoire en 2D** (chemin de 8 arrêts étiqueté Léa … Mandat,
  dossiers, garde-fou, trame grise dans deux scènes seulement : `probleme` et `agents`). Les
  cinq autres scènes n'ont **pas** de trame (`SceneSpec.mesh` = 0). Il n'y a pas de profondeur
  réelle (deux plans « proche / lointain » et une parallaxe de 20 px).
- Les étiquettes du fond (« Léa », « Hugo »…) se voient à travers le `backdrop-blur` du panneau
  final (réserve n° 3 de l'audit du 01/10/2026).
- **Voiles** : sur la landing, un seul `.particle-veil` (blanc 90 %) couvre des blocs entiers
  (colonne du hero, en-tête « problème », `LandingHeading`) : le réseau est effacé derrière
  **tous** les textes, titres compris. C'est ce qui empêche aujourd'hui « le réseau derrière les
  textes ». `.particle-veil` est partagé avec le CRM (§ 2.5.8) : il ne doit pas changer.
- `MotionToggle` (`components/landing/MotionToggle.tsx`) pilote `<html data-landing-motion>`
  lu par `HeroJourney`, `LivingBackground` et `EditorialTitle.module.css` (l. 98–99).
- Le panneau final est opaque (`bg-surface/90` + `backdrop-blur-sm`) et sans voile de titre
  (`LandingHeading veil={false}`).
- Le mot accentué est `inline` avec `line-height: 0` (`.title-accent`, `app/globals.css`) : tout
  ornement doit être positionné **sans** changer la boîte de ligne (critère de 0 px d'écart).
- `docs/design-system.md` § 2.1 mentionne encore `--color-danger` rouge : hors landing (CRM,
  `ErrorDots`), hors de ce lot, signalé au § 6.

---

## 2. Décisions

### 2.1 Effets de titre (spéc. : design-system § 2.11.2)

| Titre | Effet | Ce qui reste à la fin |
|---|---|---|
| Hero (`h1`, au chargement) | Apparition actuelle inchangée, puis un **trait cobalt** se dessine sous « *main* » de gauche à droite (640 ms) | Le trait reste (accent durable, comme le mot italique) |
| Problème (`h2`, à l'entrée) | Les lignes arrivent mais **restent floues (5 px)** ; seul « *administratif* » est net ; un **cadre à 4 coins cobalt se resserre** sur le mot (560 ms) ; tenue ≈ 1,1 s ; le reste redevient net et le cadre s'efface | Titre net, sans cadre (identique à l'état actuel) |
| Final (`h2`, à l'entrée) | Flou du reste + cadre qui se resserre sur « *fictive* » ; puis le cadre s'efface **pendant que** le trait cobalt se dessine sous le mot ; le reste redevient net | Titre net + trait sous « *fictive* » |

Adaptations de TrueFocus, et pourquoi :
- **Pas de glissement de mot en mot** : il n'y a qu'un mot actif par titre ; le cadre part d'un
  cadrage plus large (échelle 1,28) et **se resserre** sur le mot. Résultat équivalent (« la
  mise au point se fait sur ce mot »), en CSS pur, sans mesure JavaScript.
- **Pas de `drop-shadow`** : c'est une lueur, interdite par la DA (aucun glow).
- Coins de 1 rem et trait de 3 px **conservés** sur ordinateur ; 12 px / 2 px sur téléphone.
- Flou de **5 px** (valeur TrueFocus) sur les titres de 64 px ; **3 px** sous 640 px (36 px de
  corps : 5 px y effacerait les mots au lieu de les mettre en retrait).
- Aucun minuteur JavaScript : délais CSS, déclenchés par le `Reveal` existant (sections) ou
  au chargement (hero). Une seule fois ; rien ne se rejoue au retour sur la section.

### 2.2 TechText → `TechWordmark` « Ascend » (spéc. : § 2.11.3)

- Placé en **signature du panneau final**, sous la note, aligné sur le bord gauche du titre,
  très grand : `clamp(4rem, 19cqi, 15rem)` du panneau (≈ 207 px à 1440, 64 px à 390).
- **Au repos (et sans JavaScript, et sous mouvement réduit) : le mot en HTML**, plein, encre
  noire, statique. Le canvas n'est peint que pendant une animation, puis effacé : au repos il
  n'y a **aucun** canvas visible, donc aucun écart entre le texte et son dessin.
- Balayage automatique **une seule fois** (à la première entrée dans l'écran, 2 s après, ≈ 1,5 s),
  jamais de balayage d'attente ; ensuite seulement le pointeur (souris/stylet) réveille l'effet.
- Tactile : pas de glisser-déposer, `touch-action: pan-y pinch-zoom` : le défilement n'est jamais
  bloqué ; un toucher sur une lettre montre le cadre 1,2 s.
- **Accessibilité : `aria-hidden="true"`** (décoratif). Justification : le nom réel est déjà
  écrit et lu dans le logo de l'en-tête et le pied de page (« Ascend Strategy ») ; un
  `role="img"` ajouterait « Ascend » au milieu de l'appel à l'action pour un lecteur d'écran,
  sans information nouvelle. Le mot reste **visuellement** lisible en permanence.
- Couleurs : encre `#18181b` ; cadre, poignées, étiquette et la moitié des « specks » en cobalt
  `#2457ff` ; étiquette mono blanche sur cobalt (5,4:1).

### 2.3 Réseau neuronal 3D (spéc. : § 2.11.4) — révisé 02/10 — référence utilisateur

- **On fait évoluer `LivingBackground`** (même composant, même canvas fixe, même câblage
  `data-living-scene`, mêmes garde-fous : onglet caché, DPR plafonné, mouvement réduit, coût
  mesuré). On **remplace le modèle** : l'histoire 2D (chemin étiqueté, dossiers, poussières,
  trame de deux scènes) est retirée. Pourquoi : (1) l'utilisateur demande un réseau neuronal
  complet et sa référence n'a ni chemin ni étiquette ; (2) le parcours Léa → Mandat est déjà
  **démontré par l'interface** (hero, section agents) ; (3) des dossiers qui circulent en
  permanence suggèrent une activité réelle (règle d'honnêteté) ; (4) cela supprime les
  étiquettes vues à travers le panneau final. Pas de second canvas.
- **Rendu = la référence utilisateur**, paramètre pour paramètre (design-system § 2.11.4) :
  34 neurones à 1440 (28 à 1024, 20 sur téléphone), corps irréguliers à 14 points lissés et
  noyau sombre, 7–11 branches + un axone par neurone divisés sur 2 niveaux et qui s'affinent en
  3 tronçons, liaisons sinueuses vers les 3 plus proches voisins, perspective 4,5 / (4,5 + z),
  opacité et épaisseur selon la proximité, impulsions cobalt à reflet clair, traînée de 4 points
  et halo très discret, division aux embranchements (70 %), cœur qui s'illumine ≈ 2,1 s.
- **Composition sur une page longue : un volume fixe derrière la fenêtre**, vu par une caméra
  qui pivote avec la progression du défilement (lacet ± 0,16 rad, tangage en arc ± 0,055 rad —
  l'orbite de la référence, mais pilotée par le geste). Chaque écran a la densité de la
  référence, quelle que soit la longueur de la page ; le coût reste borné à une fenêtre ; le
  réseau est derrière toutes les sections, y compris en haut, en bas et sous les textes.
  Écarté : un réseau « haut comme la page » qui défile (coût et mémoire proportionnels à la
  page, cache impossible, densité à réinventer).
- **Aucune boucle** (adaptation principale) : la référence déclenche un battement toutes les
  0,8–3 s sans fin. Ici : **cascade d'arrivée** (deux battements à 650 ms d'écart, 0,9 s après
  le premier dessin, ≤ 3 sauts, tout éteint ≤ 4,8 s) puis **une salve par section** à sa
  première entrée (un battement, ≤ 2 sauts, tout éteint ≤ 3,8 s). Échéances strictes : une
  impulsion qui finirait après la fin de sa séquence n'est pas lancée. Vitesse 1,5 × la
  référence (≈ 190–290 px/s) pour que deux sauts tiennent ; jamais plus vite. Ensuite : réseau
  immobile, **aucun `requestAnimationFrame`**.
- **Caméra** : ne bouge que pendant un défilement (se pose en < 1,2 s après le geste) et, sous
  condition de coût, d'une petite dérive aller-retour pendant une séquence (+ 0,012 rad puis
  retour : l'état final ne dépend pas des séquences). Jamais de rotation au repos.
- **Graine déterministe** : même classe d'écran → même réseau et mêmes cascades ; aucun
  `Math.random`. Pas de curseur de densité, pas de bouton « régénérer » (outils de démo).
- **Performance** (mesures sur une copie instrumentée de la **référence**, Chromium sans
  interface, DPR 1 — pas une mesure du produit) : 7,7 ms par image à 1440 × 900 telle quelle
  (hors budget), **3,6 ms** en regroupant les tracés par opacité et épaisseur (≈ 75 groupes),
  rendu équivalent ; 1,8 ms à 390 × 844. D'où trois règles : tracés regroupés, **cache du
  repos** (une image de séquence à caméra immobile = copie du cache + impulsions + cœurs,
  cible ≤ 1,5 ms), replis ordonnés si le p95 « caméra en mouvement » dépasse 4 ms. Abandonné
  de la référence pour tenir le cache : l'épaississement des fibres d'un neurone allumé.
- **Derrière les textes** : voile de titre `.network-veil-title` porté à **70 %** (60 % au
  01/10) car les fibres proches de la référence sont bien plus marquées (opacité jusqu'à 0,71
  contre 0,28) ; à 60 %, une ligne `ink-subtle` tomberait à ≈ 2,8:1 au pixel le plus sombre.
  Petits textes : `.particle-veil` (90 %). Impulsions, halos et cœurs **s'éteignent** dans
  les zones de texte (fondu 16 px) ; corps cellulaires à moitié ; fibres sous le voile.
- **Atmosphère** de la référence adaptée : vignette radiale conservée ; voile blanc du haut
  limité à l'en-tête (96 px) et voile du bas plafonné à 50 % (au lieu de 97 %), pour que le
  réseau reste visible en haut et en bas de chaque écran.
- `aria-hidden="true"` conservé sur le canvas (la référence porte `role="img"` et un libellé :
  sur la landing ce serait une image décorative annoncée à chaque visite, sans information ;
  le texte visible « Animations : exemple fictif, simulation. Aucune activité en direct. »
  reste la mention d'honnêteté).

### 2.4 Zéro boucle et `MotionToggle`

| # | Élément | Version « jouée une fois » |
|---|---|---|
| B1 | Parcours du hero | Joué **une fois** à la première entrée dans l'écran (≥ 50 % visible), en **4,7 s**, jusqu'au mandat confirmé, puis reste sur l'état final. Note « Illustration rejouée en boucle. … » → « Illustration jouée une fois. Aucun prospect réel, aucun envoi. » *(Option « Rejouer » : question n° 1.)* |
| B2–B6 | Fond vivant | Remplacés par le réseau 3D de la référence : cascade d'arrivée (≤ 4,8 s) et une salve par section (≤ 3,8 s), une fois chacune, puis immobile |
| B7 | Regain au défilement | Supprimé (intensité constante) |
| B8 | Badge « Simulation » | Sur la landing seulement : **un seul cycle** (3 s), puis immobile ; le texte « Simulation » ne change pas. Le CRM garde son badge actuel |
| — | Graphique du problème | Resserré : `CAPACITY_DELAY_MS` = `FRICTION_DELAY_MS` + 700 → séquence complète ≤ 4,9 s |

**WCAG 2.2.2 (Pause, Stop, Hide)** ne s'applique qu'à une information en mouvement qui
démarre automatiquement, **dure plus de 5 s** et est présentée en parallèle d'autre contenu.
Après ce lot, chaque mouvement automatique se termine **en moins de 5 s** après son départ
(hero : titre 1,4 s, parcours 4,7 s, réseau 4,8 s ; sections : titre ≤ 2,4 s, réseau ≤ 3,8 s
— révisé 02/10, 2,9 s au 01/10 —, graphique ≤ 4,9 s ; wordmark 1,5 s ; badge 3 s), et la
rotation au défilement comme les effets du wordmark au pointeur sont déclenchés par
l'utilisateur. **`MotionToggle` n'est donc plus exigé : il est retiré**, avec
`landing-motion.ts`, les sélecteurs `html[data-landing-motion="paused"]` et les textes
`LANDING_TEXTS.motion`. Condition : le test « aucune boucle » (T7) passe ; s'il échoue, le
bouton reste. Le mouvement réduit reste le mécanisme d'arrêt système (état final immédiat).

---

## 3. Ordre d'implémentation pour `frontend-ux`

Chaque tâche est atomique, testée isolément puis en intégration (règle `CLAUDE.md`). Aucune
nouvelle dépendance. Aucune modification hors `components/landing/**`, `components/ui/EditorialTitle.*`,
`components/ui/editorial-title.ts`, `components/landing-texts.ts`, `app/globals.css` (classes
listées), `app/(marketing)/page.tsx` et les tests concernés.

### T1 — Parcours du hero joué une fois (B1)

- Fichiers : `components/landing/journey-timeline.ts`, `HeroJourney.tsx`, `landing-texts.ts`
  (`journey.note`, `journey.replay` si question 1 = oui), `journey-timeline.test.ts`,
  `LandingHero.test.tsx`.
- Fait quand : séquence sans image de remise à zéro finale, durées du § 2.11.5, aucune
  instruction modulo ; démarrage à la première entrée dans l'écran (`IntersectionObserver`,
  seuil 0,5, une fois) ; état final conservé ; mouvement réduit = état final sans minuteur ;
  onglet caché = saut à l'état final ; option « Rejouer » si validée (bouton texte, désactivé
  pendant la lecture).
- Tests unitaires : somme des durées = 4 700 ms ; dernière image = `finalFrame` ; la séquence
  ne contient qu'une image par étape (+ attentes humaines) ; aucune image après l'état final.
- E2E (`e2e/accueil.spec.ts`) : à 1440, après 6 s, toutes les étapes sont « terminé /
  validé / confirmé » et ne changent plus pendant 3 s ; mouvement réduit : état final à l'instant 0.

### T2 — Badge « Simulation » et graphique sur la landing (B8, graphique)

- Fichiers : `app/(marketing)/page.tsx` (attribut `data-landing` sur l'enveloppe), une règle
  dans `app/globals.css` (ou un module de la landing) : `[data-landing] .simulation-badge,
  [data-landing] .simulation-dot { animation-iteration-count: 1; }` ;
  `components/landing/problem/problem-scene.ts` (`CAPACITY_DELAY_MS`).
- Fait quand : sur `/` les deux animations du badge jouent un cycle et s'arrêtent ; sur
  `/agents-ia/a-valider` elles restent infinies (CRM inchangé) ; le graphique termine ≤ 4,9 s.
- Tests : unitaire `problem-scene.test.ts` (fin de séquence ≤ 4 900 ms) ; E2E : sur `/`,
  `getAnimations()` du badge du hero → `iterations` = 1 ; sur une page CRM → `Infinity`.

### T3 — Effets du mot accentué (`EditorialTitle`)

- Fichiers : `components/ui/EditorialTitle.tsx`, `EditorialTitle.module.css`,
  `EditorialTitle.test.tsx`, `components/landing/LandingHero.tsx`,
  `components/landing/problem/ProblemHeading.tsx`, `LandingHeading.tsx` (+ prop transmise),
  `LandingFinal.tsx`, `app/globals.css` (token `--ease-draw`).
- Fait quand : prop `accentEffect` (`"none"` par défaut, `"underline"`, `"focus"`,
  `"focus-underline"`) conforme au § 2.11.2 ; hero = `underline`, problème = `focus`,
  final = `focus-underline` ; aucun autre titre ne change ; état final par défaut (sans JS,
  mouvement réduit) ; pas d'écart de hauteur de ligne ; nom accessible inchangé.
- Tests unitaires : rendu des ornements selon l'effet (`data-accent-effect`, nœuds vides
  `aria-hidden` dans le visuel, aucun texte ajouté au `textContent` du visuel) ; `none` ne rend
  aucun ornement ; le CSS ne contient ni `infinite` ni `drop-shadow`.
- E2E (`e2e/typographie-expressive.spec.ts`, cas ajoutés) : échantillonnage du hero à
  0,4 / 1,0 / 1,6 s (trait : `clip-path` passe de masqué à complet ; final ≥ 1,4 s complet) ;
  problème et final à 0,8 s (mots non accentués `filter` ≈ `blur(5px)`, mot accentué net,
  cadre opacité 1) puis à 2,6 s (tout `filter: none`, cadre opacité 0, trait complet sur
  « fictive ») ; mouvement réduit : instant 0 = état final (trait visible hero/final, pas de
  cadre, pas de flou) ; écart de hauteur de ligne ≤ 0,5 px avec et sans ornement (1440 / 390).

### T4 — `TechWordmark` « Ascend » dans le panneau final

- Fichiers (nouveaux) : `components/landing/wordmark/tech-wordmark.ts` (pur : géométrie des
  lettres, ressort, chronologie du balayage, specks à graine fixe),
  `components/landing/wordmark/TechWordmark.tsx` (client), `TechWordmark.module.css`,
  `tech-wordmark.test.ts` ; modifié : `LandingFinal.tsx`, `landing-texts.ts` (`final.wordmark`).
- Fait quand : rendu conforme au § 2.11.3 ; HTML statique au repos ; canvas effacé et aucune
  boucle hors animation ; balayage une fois ; drag souris/stylet uniquement ; tactile non
  bloquant ; `aria-hidden` ; aucun débordement à 1440 / 1024 / 390 / 360.
- Tests unitaires : ressort revenu à < 0,5 px en ≤ 700 ms, dépassement ≤ 6 px ; balayage
  ≤ 1 600 ms, 6 arrêts dans l'ordre ; specks ≤ 15 (≤ 8 en compact), positions identiques à
  graine égale ; déplacement de glisser plafonné à 0,6 em.
- E2E (`e2e/accueil.spec.ts` ou nouveau `e2e/landing-wordmark.spec.ts`) : mouvement réduit →
  aucun `canvas` dans le wordmark, texte « Ascend » visible ; mouvement autorisé → attribut
  `data-wordmark-state` passe `idle → sweep → idle` une fois en ≤ 4 s après l'entrée ; le
  conteneur a `touch-action` contenant `pan-y` ; le conteneur est `aria-hidden="true"` ;
  le nom accessible du panneau final ne contient pas « Ascend ».

### T5 — Modèle pur du réseau (révisé 02/10 — référence utilisateur)

Prérequis : lire la référence utilisateur en entier (chemin en tête de plan) ; c'est elle qui
fixe l'apparence, le § 2.11.4 fixe les adaptations.

- Fichiers (nouveaux, `components/landing/living/`, tous purs, sans DOM) :
  `random.ts` (générateur à graine, ex. mulberry32 ; `hash01`, `smoothstep`, `clamp01` repris
  de `timeline.ts`), `network.ts` (neurones, corps à 14 points, arbres dendritiques, axone,
  liaisons par déplacement du point médian, longueurs cumulées, table des embranchements,
  fibres sortantes ; points en `Float32Array`), `camera.ts` (pose depuis la progression du
  défilement, dérive de séquence, lissage, projection `4,5 / (4,5 + profondeur)`),
  `signals.ts` (battements, excitation, période réfractaire, propagation à longueur réelle,
  divisions à 70 %, énergie des cœurs, échéances et plafonds, choix des neurones éligibles
  hors zones calmes), `quiet.ts` (atténuation par distance aux rectangles de texte) ; tests à
  côté de chacun. `scenes.ts` réduit à la liste des scènes + `isLivingScene`.
- Fait quand : valeurs du § 2.11.4 (génération, projection, impulsions, cœurs, séquences)
  appliquées ; **aucun `Math.random`** ni horloge réelle dans ces fichiers (le temps est un
  paramètre) ; sortie identique à graine et classe égales ; aucune allocation dans les
  fonctions appelées à chaque image.
- Tests unitaires (Vitest) :
  - **Déterminisme** : deux générations (même graine, même classe) → tableaux de points
    identiques ; une autre graine → différents.
  - **Budget** : neurones = 34 / 28 / 20 ; fibres dendritiques = 7 × Σ (branches + 1) avec
    branches ∈ [7 ; 11] ; fibres de liaison ≤ 3 N, sans doublon ; fibres et points sous les
    plafonds par classe.
  - **Espacement** : distance minimale `hypot(dx, dy, 0,4 dz)` > 0,30 pour la graine par défaut
    dans les trois classes (si la graine par défaut échoue, en choisir une autre et la noter
    dans le § 2.11.4).
  - **Couverture** (projection à p = 0, 0,5, 1) : 1440 × 900 → chaque case d'une grille 3 × 3
    contient ≥ 1 corps ; chaque tuile 240 × 240 px contient ≥ 1 point de fibre ; 390 × 844 →
    grille 2 × 3, ≥ 1 corps par case.
  - **Forme** : chaque branche a ≥ 8 pas ; l'épaisseur de fin vaut 0,25 × l'épaisseur ; une
    liaison a 2⁵ + 1 = 33 points ; le contour d'un corps a 14 points.
  - **Caméra** : pose(0) = (lacet −0,16 ; tangage 0), pose(0,5) = (0 ; 0,055), pose(1) =
    (0,16 ; 0) à 10⁻⁶ près ; lissage : écart < 0,0005 rad en ≤ 1,2 s après un saut de cible ;
    dérive de séquence nulle à t = 0 et t = T ; mouvement réduit : pose constante.
  - **Propagation** : la tête d'une impulsion échantillonnée reste sur le tracé (distance au
    segment < 10⁻⁶) ; le temps d'arrivée = longueur réelle / vitesse.
  - **Séquences** (horloge simulée, graine par défaut, 1440 × 900) : arrivée → dernière
    excitation ≤ 2 700 ms, dernière impulsion terminée ≤ 4 800 ms, toutes énergies nulles à
    4 800 ms, sauts ≤ 3 ; section → ≤ 1 700 / ≤ 3 800 ms, sauts ≤ 2 ; plafond d'impulsions
    simultanées jamais dépassé ; même graine → même liste d'événements ; `hero` ne déclenche
    jamais de salve ; une scène déjà jouée ne rejoue rien ; mouvement réduit → 0 événement.
  - **Zones calmes** : facteur 0 dans un rectangle, 1 à ≥ 16 px ; corps : 0,5 dans le
    rectangle ; aucun neurone choisi comme origine à moins de 48 px d'une zone.
  - **Garde-fou de source** : test qui lit les fichiers de `components/landing/living/` et
    échoue s'il y trouve `Math.random`, `shadowBlur`, `drop-shadow` ou une affectation de
    `filter`.

### T6 — Rendu, moteur, intégration du réseau et voiles (révisé 02/10)

- Fichiers : `living/renderer.ts` (réécrit : tracés **regroupés** par opacité au 1/20 et
  épaisseur au 1/4 px, ≤ 96 `stroke()` par image ; corps lissés ; impulsions et cœurs aux
  valeurs plafonds de la référence ; **cache du repos** dans un canvas hors écran),
  `LivingEngine.ts` (états `idle → sequence → settled`, `camera`, `reduced`, `hidden` ; boucle
  **uniquement** pendant une séquence ou un mouvement de caméra ; plus de `boost` ni de
  `REST_INTENSITY`), `LivingBackground.tsx` (progression du défilement de la page → pose ;
  déclenchement de l'arrivée après `document.fonts.ready` + 900 ms ; salve à la première entrée
  de chaque scène ; lecture des rectangles `[data-network-quiet]` à chaque image active ; calque
  `.network-atmosphere` ; plus aucune référence à `landing-motion` après T7),
  `LivingBackground.module.css` (atmosphère : vignette radiale, haut 96 px, bas 50 %),
  `app/globals.css` (`.network-veil-title`, blanc **70 %**, landing seulement),
  `LandingHero.tsx`, `LandingHeading.tsx`, `LandingProblem.tsx` / `ProblemHeading.tsx` et les
  autres sections (voiles scindés par rôle de texte, `data-network-quiet` posé sur chaque bloc
  de texte hors carte).
  **Supprimés** : `files.ts`, `labels.ts`, `routes.ts`, `motes.ts`, `mesh.ts`, `mesh-style.ts`,
  `model.ts` et leurs tests (`model.test.ts`, `presence.test.ts`, `composition.test.ts`,
  `mesh.test.ts`, `canvas-recorder.test-helper.ts` s'il n'a plus d'usage).
- Fait quand : attributs de test du § 2.11.4 exposés (`data-motion`, `data-sequences`,
  `data-nodes`, `data-links`, `data-fibers`, `data-signals`, `data-lit`, `data-frames`,
  `data-frame-ms`, `data-frame-ms-p95`) ; arrivée `settled` ≤ 6,0 s après le chargement ; au
  repos **aucun** `requestAnimationFrame` ni minuteur ; coût p95 ≤ 4 ms caméra en mouvement à
  1440 × 900 (sinon replis dans l'ordre du § 2.11.4, reportés avec la mesure) ; cible ≤ 1,5 ms
  en séquence à caméra immobile ; onglet caché et mouvement réduit conformes ; capture côte à
  côte avec la référence jugée équivalente (corps, arbres, liaisons, impulsions, cœurs).
- Tests unitaires : moteur avec horloge simulée (`EngineEnvironment` existant) : aucune demande
  d'image après `settled` ; aucune demande d'image tant que la cible de caméra est atteinte ;
  défilement → `camera` puis `settled` ≤ 1,2 s après le dernier changement de cible ; onglet
  caché pendant une séquence → au retour `settled`, 0 impulsion, 0 cœur, rien de rejoué ;
  mouvement réduit → un seul dessin, aucune demande d'image, y compris après un défilement ;
  redimensionnement sans changement de classe → même géométrie (même empreinte), aucune
  séquence rejouée.
- E2E (nouveau `e2e/landing-reseau.spec.ts`, Chromium, mouvement autorisé sauf (f)) :
  (a) **arrivée** : `data-motion` passe `idle → sequence → settled`, `settled` ≤ 6,0 s ;
      `data-sequences` = `arrivee` ; pendant la séquence `data-lit` > 0 au moins une fois ;
  (b) **aucune boucle** (script d'initialisation qui compte les appels à
      `requestAnimationFrame`) : 1 s après `settled`, **0 appel** sur 2 s, `data-frames`
      inchangé, deux captures du canvas à 1 s d'écart identiques au pixel ;
  (c) **sections** : défilement jusqu'à chaque scène → `data-sequences` s'enrichit de son nom
      une seule fois ; retour sur une scène déjà jouée → inchangé ; ≤ 4,0 s après l'entrée →
      `settled`, puis 0 appel à `requestAnimationFrame` sur 2 s ;
  (d) **caméra** : pendant un défilement programmé, `data-frames` augmente et `data-motion` =
      `camera` (ou `sequence`) ; ≤ 1,2 s après l'arrêt → `settled`, puis 0 appel sur 2 s ;
  (e) **coût** à 1440 × 900 : `data-frame-ms-p95` ≤ 4 pendant un défilement et pendant
      l'arrivée (relevé reporté dans le § 2.11.4) ;
  (f) **mouvement réduit** : `data-motion="reduced"` à l'instant 0 ; aucun pixel cobalt dans le
      canvas (aucun pixel où B − R > 80 et B > 150) ; canvas identique au pixel avant et après
      un défilement ; 0 appel à `requestAnimationFrame` après le chargement ;
  (g) **couleur au repos** : en `settled`, aucun pixel cobalt dans le canvas ;
  (h) **encre** : alpha moyen du canvas en `settled` dans la bande (1,2–2,2 % à 1440 ; 0,8–2,0 %
      à 390) ;
  (i) **contraste** : méthode de `voiles-lisibilite.spec.ts` (texte masqué, pixel le plus
      sombre et pixel médian sous chaque ligne) sur tous les textes hors carte de `/`, à 3
      instants de l'arrivée + `settled`, 1440 × 900 et 390 × 844 — seuils du § 2.11.4 ;
  (j) **téléphone** 390 × 844, émulation tactile : `data-nodes="20"`, rapport
      `canvas.width / innerWidth` ≤ 1,5 ;
  (k) **onglet caché** pendant l'arrivée (émulation `visibilitychange`) : au retour `settled`
      sans nouvelle impulsion, `data-signals="0"`.

### T7 — Retrait de `MotionToggle` et test global « aucune boucle »

- Fichiers : supprimer `MotionToggle.tsx`, `landing-motion.ts` ; nettoyer `HeroJourney.tsx`,
  `LivingBackground.tsx`, `EditorialTitle.module.css` (sélecteurs `data-landing-motion`),
  `LandingHero.tsx` (emplacement réutilisé par « Rejouer » si validé), `landing-texts.ts`
  (`motion`), `e2e/accueil.spec.ts` (test de pause remplacé).
- Fait quand : plus aucune référence à `landing-motion` ; test « aucune boucle » vert.
- E2E « aucune boucle » de **page entière** (1440 × 900 et 390 × 844, mouvement autorisé,
  pointeur hors page) : script d'initialisation qui compte **tous** les appels à
  `requestAnimationFrame` de la page ; après chargement + 7 s : **0 appel** sur une fenêtre de
  2 s, deux captures pleine fenêtre à 1 s d'écart **identiques au pixel**, `data-frames` du
  réseau inchangé ; idem après avoir amené chaque section au centre puis attendu 5 s ;
  `document.getAnimations()` ne contient aucune animation `iterations: Infinity` en cours
  sur `/`.

### T8 — Captures, mesures, mise à jour de la spécification

- Captures 1440 / 1024 / 390 (et 360 pour le wordmark) : hero à 0,4 / 1,0 / 2,0 / 7 s ;
  problème et final pendant le cadre (≈ 0,9 s après l'entrée) et à la fin ; wordmark au repos,
  pendant le balayage, au survol, en glisser ; réseau pendant la cascade d'arrivée (≈ 2,0 s
  après son départ : impulsions et un cœur allumé visibles), réglé, pendant une salve de
  section, et en haut / milieu / bas de page (pose de caméra différente) ; mouvement réduit à
  l'instant 0 ; **une capture de la référence utilisateur à 1440 et 390 pour comparaison
  côte à côte**.
- Reporter dans `docs/design-system.md` § 2.11 les valeurs mesurées (coût p95 caméra en
  mouvement et en séquence, repli éventuellement appliqué, encre, contraste minimal, tailles du
  wordmark) à la place des valeurs cibles, puis passer la main au `web-designer` pour l'audit
  écrit (`docs/audits/AAAA-MM-JJ-landing-motion.md`).

Vérifications de fin de lot (à exécuter réellement) : `npx tsc --noEmit`, `npm run lint`,
`npx vitest run`, `npx playwright test e2e/accueil.spec.ts e2e/typographie-expressive.spec.ts
e2e/landing-reseau.spec.ts e2e/landing-probleme.spec.ts e2e/landing-agents.spec.ts
e2e/icones.spec.ts e2e/premier-regard.spec.ts e2e/voiles-lisibilite.spec.ts e2e/particules.spec.ts`
(les deux derniers : non-régression du CRM), `npm run build`.

---

## 4. Ce qui ne change pas (garde-fous)

- Textes : « Simulation », « Exemple fictif — simulation », « Animations : exemple fictif,
  simulation. Aucune activité en direct. », « Prototype de démonstration. Aucune donnée réelle,
  aucun envoi réel. », la validation humaine et le mandat confirmé par un humain dans le
  parcours et la section agents. Seule la note du parcours change (« rejouée en boucle » →
  « jouée une fois »), sa seconde phrase reste.
- Aucun chiffre, client, témoignage ou durée présentés comme réels ; le réseau ne lit aucun
  état réel et ne s'active jamais en réponse à une action métier.
- CRM : `RouteParticles`, `.particle-veil`, badge « Simulation » infini, titres sans effet —
  inchangés. `/estimation` : titre sans effet (`accentEffect` absent).
- Typographie du 01/10/2026 (tailles, apparition ligne par ligne, mot italique) inchangée.

## 5. Questions à l'utilisateur (avant le code) — révisé 02/10

*Tranché par l'orchestrateur le 02/10 (n'est plus une question) : le réseau pivote légèrement
pendant le défilement et pendant une séquence, jamais au repos.*

1. **Bouton « Rejouer l'illustration »** sous le parcours du hero (à la place du bouton pause),
   puisque l'illustration ne se joue plus qu'une fois ? Recommandation : **oui** (déclenché par
   l'utilisateur, conforme WCAG, utile en démonstration). Sans réponse : T1 livre **sans**
   bouton (ajout ultérieur sans impact).
2. **Titre « problème » : réseau visible derrière les deux lignes grises** (contraste ≥ 3:1,
   seuil AA des grands textes, au lieu de ≈ 4,7:1) **ou** réseau quasi effacé derrière ces deux
   lignes (contraste inchangé) ? Recommandation : **réseau visible** (c'est la demande « derrière
   les textes ») ; le titre principal en noir reste ≥ 7:1 dans les deux cas.
3. **Vitesse des impulsions** : 1,5 × celle de la démonstration (≈ 190–290 px/s), pour qu'une
   cascade traverse deux ou trois neurones dans la limite de 5 s, **ou** exactement celle de la
   démonstration, avec des cascades plus courtes (souvent un seul neurone atteint par salve) ?
   Recommandation : **1,5 ×** (le mouvement reste lent et lisible ; la cascade, qui montre que
   « l'information circule », est le cœur de l'effet).

## 6. Hors périmètre, signalé

- `--color-danger` (rouge) existe encore dans `app/globals.css` et `docs/design-system.md` § 2.1
  (CRM, `ErrorDots`) : contraire à la règle « plus aucun rouge » du 30/09/2026 ; à traiter dans
  le lot direction artistique (non commencé d'après la chaîne de branches).
- Défauts préexistants de l'audit du 01/10/2026 (§ 6) : en-tête public à 390, deux bords
  gauches à 1440, adresse coupée dans la barre latérale du CRM.
