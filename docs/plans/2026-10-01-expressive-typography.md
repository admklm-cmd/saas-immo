# Typographie expressive — vision et options (étape 1 sur 7)

> Auteur : `web-designer`, 01/10/2026. Branche `feat/expressive-typography`.
> Statut : **options tranchées par l'utilisateur le 01/10/2026** (§ 10). La spécification
> exécutable vit désormais dans `docs/design-system.md` § 2.2 et § 3.8 (étape 4, faite) ; en cas
> d'écart, c'est elle qui fait foi.
> Suite prévue : 1. vision (ce document) → 2. page de comparaison `/dev/typographie`
> (`frontend-ux`) → 3. choix de l'utilisateur → 4. spécification dans `docs/design-system.md` →
> 5. implémentation → 6. captures et tests → 7. audit écrit.

Distinction obligatoire : **demandé** (tout ce document) · **spécifié** (`docs/design-system.md`
§ 2.2, § 3.8, 01/10/2026) · **implémenté** (seulement la galerie `/dev/typographie`) · **testé**
(rien dans le produit) · **validé visuellement** (le choix sur la galerie, pas le produit).

---

## 0. Ce que l'utilisateur a demandé (fait foi)

1. Une police de titres **avec du caractère**, semi-grasse, lettres un peu resserrées.
   **Geist** devient le texte courant, **Geist Mono** reste pour les chiffres, **Inter disparaît**.
2. **Un mot accentué** dans certains titres : (A) serif italique, (B) bleu transparent,
   (C) mot net pendant que le reste passe du flou au net — ou une combinaison.
3. **Plus de contraste d'échelle** : très grands titres, petits labels en capitales et en mono.
4. **Titres-phrases** sur le site public ; **titres courts** dans le CRM.
5. **Apparition ligne par ligne** ; rien sous `prefers-reduced-motion: reduce`.
6. **Polices gratuites**, uniquement via `next/font/google` (build, servies depuis notre origine,
   CSP `font-src 'self'` inchangée, aucune dépendance npm).
7. Site public très expressif ; CRM sobre — **niveau du CRM à choisir**.

### Contradictions signalées (non tranchées en silence)

| # | Source A | Source B | Proposition |
|---|---|---|---|
| 1 | Demande actuelle : « Inter disparaît », Geist en texte courant | `docs/design-system.md` § 2.2 (Inter = corps et labels) et `app/globals.css` l. 21–35 | La demande actuelle prime (rang 1). § 2.2 sera réécrit à l'étape 4. |
| 2 | DA 30/09 § 2 : « titres principaux… très forts » | Demande : « semi-gras » | La force vient de la **taille** et de l'**encre noire**, pas de la graisse. Graisse 600 (public) ; 600 à 650 dans le CRM si la police choisie paraît trop légère à 42 px (axe variable). |
| 3 | Variante B (mot bleu) | DA 30/09 § 1 : « le bleu ne doit PAS devenir la couleur dominante », il apparaît en « petits traits, repères, points » | Un mot bleu de 120 px serait la plus grande surface bleue de la page. B est spécifiée (§ 3.2) mais **non recommandée** pour le hero. |
| 4 | `docs/design-system.md` § 1.1 : hero « révélé ligne puis mot » | Demande : « ligne par ligne » | La demande prime : la révélation mot par mot disparaît (sauf mécanique interne de C, § 3.3). |
| 5 | `components/landing/HeroTitle.module.css` l. 3–4 : « keeps the system font stack » | Le `h1` est en Geist depuis le 26/09 (règle de base `h1–h4`, `app/globals.css` l. 225–230) | Commentaire périmé, à corriger lors de l'implémentation. |

---

## 1. Audit : pourquoi la typographie actuelle paraît fade

Observations (code lu, pas de capture à cette étape) :

1. **Deux polices qui se ressemblent.** `app/layout.tsx` l. 16–17 charge Inter (corps) et Geist
   (titres) : deux grotesques néo-suisses au squelette presque identique. L'œil ne perçoit pas de
   changement de rôle entre un titre et un paragraphe ; seuls la taille et la graisse changent.
2. **Deux graisses de titre incohérentes.** Landing en 600 avec un approche très négatif
   (`LandingHeading.tsx` : `font-semibold tracking-[-0.05em]` ; `HeroTitle.module.css` : 600,
   `-0.058em` ; `ProblemHeading.module.css` : 600, `-0.05em`), CRM en 800 (`PageHeader.tsx` :
   `font-extrabold`). Le même rôle « titre » a deux voix. À -0,058 em, Geist (police déjà
   serrée) se comprime sans gagner en caractère.
3. **Le seul procédé d'accent est un gris.** `HeroTitle` passe la seconde moitié du titre en
   `ink-muted` (`titleSecondFrom: 2`), `ProblemHeading` met l'observation en `ink-subtle`. Un titre
   qui « s'éteint » à moitié renforce l'impression de fadeur. Seul « administratif »
   (`ProblemHeading.module.css`, `.emphasis`, filet cobalt sous le mot) porte un vrai accent, et
   il est unique dans tout le site.
4. **Échelle écrasée dans le CRM.** `text-section` 24 px et `text-heading` 21 px sont presque
   égaux ; `text-hero` 42 px ne fait que 3,8 fois un label de 11 px. Rien ne domine franchement.
5. **Labels sans voix propre.** Sur-titres (`text-overline font-semibold text-ink-subtle uppercase`)
   et `.label` sont en Inter, comme le corps. Geist Mono n'est employé que pour les chiffres
   (`.figure`) : le « petit label technique » demandé n'existe pas.
6. **Révélation du hero trop morcelée.** `HeroTitle.module.css` : un mot toutes les 38 ms, 760 ms
   chacun, flou 6 px. Bien exécuté, mais on regarde des mots tomber au lieu de lire une phrase.
7. **`/estimation` parle comme le CRM.** `app/(marketing)/estimation/page.tsx` utilise `PageHeader`
   (titre court, 42 px, 800) : la page publique la plus importante (acquisition) a le ton d'un
   écran de travail.

Ce qui est bon et doit être gardé : titres déjà courts dans le CRM, titres de landing déjà en
phrases pour la plupart, voile `.particle-veil` (contraste mesuré), copie `sr-only` du titre animé
(nom accessible lu une fois), `.figure` en chiffres tabulaires, révélation désactivée sous
mouvement réduit et état final par défaut.

---

## 2. Trois polices de titres candidates

Toutes vérifiées dans `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`
(Next 16.3.8 installé) : disponibles, licence libre (OFL), sous-ensemble `latin` (couvre é è ê à ç
ô œ É À Ç « » ’ et l'espace fine insécable U+202F — **à vérifier visuellement** sur la page de
comparaison, ligne de contrôle § 7).

Règle commune : graisse **600** pour les titres, approche négatif proportionnel à la taille,
`font-optical-sizing: auto` quand la police a un axe `opsz`.

### 2.1 Bricolage Grotesque — recommandée

- Import : `import { Bricolage_Grotesque } from "next/font/google"` ;
  `Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], display: "swap", variable: "--font-bricolage" })`
  (graisse variable 200–800 ; axes `opsz` 12–96, `wdth` 75–100).
- Graisses employées : 600 (titres), 700 (rare : chiffre-titre éventuel).
- Approche proposé : poster `-0.035em` · section `-0.03em` · `h1` CRM `-0.025em` · titre de
  carte 21 px `-0.01em`. Option « serré » : `font-variation-settings: "wdth" 92` sur poster et
  section uniquement.
- Pourquoi : c'est la seule des trois qui **change de personnalité avec la taille**. L'axe
  optique dessine des pièges à encre et des formes affirmées à 96 px et plus, puis redevient calme
  et ouverte à 21 px. Exactement le besoin : site public expressif, CRM sobre, **une seule police**.
- Risques : très utilisée par les jeunes marques en 2024–2025 (peut paraître « tendance ») ;
  quelques formes (`g`, `a`, `R`) moins institutionnelles ; fichier plus lourd (trois axes,
  taille réelle à mesurer au build dans `.next/static/media`, pas d'estimation inventée ici).

### 2.2 Schibsted Grotesk — l'option sûre

- Import : `import { Schibsted_Grotesk } from "next/font/google"` ;
  `Schibsted_Grotesk({ subsets: ["latin"], display: "swap", variable: "--font-schibsted" })`
  (graisse variable 400–900, italique disponible mais non utilisée).
- Graisses : 600 (titres), 700 (CRM si 600 paraît léger à 42 px).
- Approche : poster `-0.045em` · section `-0.04em` · `h1` CRM `-0.03em` · carte `-0.012em`.
- Pourquoi : grotesque de presse (dessinée pour un groupe de médias scandinave), ferme, directe,
  crédible. Évoque la presse économique plutôt que la startup : cohérent avec l'immobilier
  professionnel. Excellente tenue à 21 px.
- Risques : caractère plus discret ; à côté de Geist en corps, l'écart peut rester trop faible
  pour un utilisateur qui trouve l'actuel « fade ». C'est le choix si Bricolage paraît trop
  marqué.

### 2.3 Mona Sans — l'option technique

- Import : `import { Mona_Sans } from "next/font/google"` ;
  `Mona_Sans({ subsets: ["latin"], axes: ["wdth"], display: "swap", variable: "--font-mona" })`
  (graisse variable 200–900, axe `wdth` 75–125).
- Graisses : 600.
- Approche : poster `wdth 88` + `-0.02em` · section `wdth 92` + `-0.02em` · `h1` CRM `wdth 100`
  + `-0.02em` · carte `wdth 100` + `-0.01em`.
- Pourquoi : les lettres sont **resserrées par le dessin** (largeur semi-condensée) et non par un
  approche forcé : meilleure lisibilité que de comprimer Geist à -0,058 em. Rendu précis,
  industriel, « produit technologique ».
- Risques : associée à GitHub dans le public technique ; personnalité plus neutre en largeur
  normale (le CRM ressemblerait davantage à l'actuel) ; axe `wdth` à charger.

### 2.4 Écartées (pour mémoire)

Inter Tight (c'est Inter : contraire à la demande), Space Grotesk (très vue, ton « crypto »),
Instrument Sans (trop proche de Geist), Archivo (caractère surtout en très condensé, peu lisible
en CRM), Funnel Display et Host Grotesk (intéressantes mais moins éprouvées à 21 px).

### 2.5 Police serif italique de la variante A

- **Instrument Serif**, italique : `import { Instrument_Serif } from "next/font/google"` ;
  `Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", display: "swap", variable: "--font-accent" })`.
  Une seule graisse (400) et un seul style chargés : un seul fichier.
- Pourquoi : serif à fort contraste, étroite, très élégante en grand ; son étroitesse s'accorde
  avec des titres serrés ; le contraste de **forme** (droit/italique, sans/serif) suffit, aucune
  couleur nécessaire.
- Risque : une seule graisse, déliés fins. À côté d'une sans 600, le mot paraît plus léger :
  compensé par `font-size: 1.06em` (hauteur d'x plus petite). Illisible en dessous de 28 px :
  **interdite sous 28 px**.
- Repli si l'utilisateur la trouve trop fine : **Fraunces** italique
  (`Fraunces({ subsets: ["latin"], style: "italic", axes: ["opsz", "SOFT"], display: "swap" })`,
  graisse 500). Non montrée sur la page de comparaison pour ne pas multiplier les choix.

---

## 3. Le mot accentué : trois variantes et une combinaison

### Règles communes (quelle que soit la variante)

- **Un seul mot accentué par titre**, et au plus **un titre accentué par hauteur d'écran**.
- Le mot porte l'idée de la phrase (le verbe ou le nom qui fait sens), jamais un article, jamais
  un nom d'agent, jamais un chiffre, jamais « simulation » ou une mention de garde-fou.
- Où : `h1` du hero, `h2` de section de la landing, titre de `/estimation`. Dans le CRM : voir § 6.
- Où jamais : boutons, labels, badges, tableaux, données, messages d'erreur ou de blocage, titres
  de carte, tout texte sous 28 px (sous 24 px pour B).
- Au plus **deux procédés par titre** : ton (encre / gris, comme l'observation du problème) et mot
  accentué. Jamais couleur + serif sur le même mot. Dès qu'un titre a un mot accentué, la moitié
  grise du hero (`titleSecondFrom`) disparaît : un seul procédé suffit.
- Données : le mot est déclaré dans les textes (`titleAccent: "main"`, comme l'actuel
  `problem.titleEmphasis`) et **testé** : il doit apparaître exactement une fois dans le titre.
- Accessibilité : le titre est lu **une seule fois**, en entier, sans emphase vocale ajoutée
  (pas de `<em>` qui ferait changer l'intonation de certains lecteurs ; un `span` suffit). Un mot
  accentué n'est jamais porteur d'une information absente du texte.
- Le filet cobalt actuel sous « administratif » (`ProblemHeading.module.css`) est **remplacé** par
  la variante choisie : une seule langue d'accent pour tout le site.

### 3.1 Variante A — serif italique

| Token | Valeur |
|---|---|
| `--font-accent` | Instrument Serif italique 400 (`var(--font-accent)`, repli `ui-serif, Georgia, serif`) |
| `--accent-word-size` | `1.06em` |
| Couleur | `--color-ink` (#18181b) : **17,7:1** sur blanc, 14,6:1 sur `pearl` |
| Approche | `-0.01em` (la serif n'a pas besoin d'être resserrée) |
| Interlignage | hérité ; critère : hauteur de ligne identique avec et sans le mot (mesurée) |

Effet : le mot change de **voix**, pas de couleur. Respecte la DA à la lettre (noir = information
principale, le titre n'est pas coloré). Lisible en niveaux de gris et pour les daltoniens.

### 3.2 Variante B — bleu « transparent »

Contraste calculé (formule WCAG 2.x, cobalt `#2457FF` composé sur le fond) :

| Opacité du cobalt | Blanc | `pearl-soft` #f7f7f9 | `pearl` #e9e9ee | Pire voile mesuré* |
|---|---|---|---|---|
| 100 % | 5,41 | 5,06 | 4,47 | 4,96 |
| 90 % | 4,56 | 4,32 | 3,87 | 4,24 |
| **80 %** | **3,80** | **3,64** | **3,34** | **3,58** |
| 75 % (minimum) | 3,48 | 3,33 | 3,06 | 3,28 |
| 70 % | 3,19 | 3,06 | **2,84 — échoue** | 3,04 |
| 60 % | 2,65 — échoue | 2,57 | 2,43 | 2,55 |

\* `.particle-veil` (90 % blanc) posé sur un sommet de réseau encre à 45 % : fond résultant #f5f5f5.

Conclusions :

- Texte ≥ 24 px (les titres concernés font 36 à 120 px) : seuil **3:1**. La plus faible opacité
  qui passe **partout** (y compris le gris perle du CRM) est **75 %** ; elle passe de justesse sur
  `pearl` (3,06). **Retenue : 80 %**, marge confortable.
- Sous 24 px, il faudrait 4,5:1 : seul le cobalt plein ou `accent-strong` passe. **B est interdite
  sous 24 px.**
- Une vraie transparence laisserait le réseau vivant traverser les lettres et ferait varier le
  contraste. Le token est donc **opaque** : la couleur équivalente au cobalt 80 % sur blanc.

| Token | Valeur |
|---|---|
| `--color-accent-word` | `#5079FF` (cobalt 80 % composé sur blanc ; 3,80:1 blanc, 3,34:1 `pearl`) |
| Plancher autorisé | `#5B81FF` (75 %) — ne jamais aller plus clair |
| Graisse | celle du titre (600) |
| Taille minimale | 24 px |

Risque principal (contradiction n° 3) : à 96–120 px, ce mot est la plus grande tache bleue du
site. Réservée aux titres de section (`text-statement`), **jamais dans le hero**, et jamais deux
mots bleus visibles en même temps. Couleur seule : un utilisateur daltonien ou en niveaux de gris
ne voit qu'un mot un peu plus clair, l'accent se perd (acceptable puisqu'il n'est jamais porteur
d'information, mais l'effet disparaît).

### 3.3 Variante C — le mot net, le reste passe du flou au net

| Token | Valeur |
|---|---|
| `--title-focus-blur` | `8px` (flou initial des mots non accentués) |
| `--title-focus-duration` | `640ms` par ligne |
| `--title-focus-sharp-at` | `55 %` de l'animation (le flou est nul à 352 ms de chaque ligne) |
| `--title-line-step` | `80ms` entre deux lignes (60 ms sous 640 px) |
| `--title-line-delay` | `100ms` (hero au chargement) ; `0ms` (section, au déclenchement de `Reveal`) |
| `--ease-emphasis` (nouveau) | `cubic-bezier(0.16, 1, 0.3, 1)` (sortie expo : rapide puis se pose) |
| Mouvement des mots | opacité 0 → 1, `translateY(0.2em)` → 0, `filter: blur(8px)` → `blur(0)` |
| Mot accentué | **aucun flou, aucune translation** ; opacité 0 → 1 en `--duration-base` (220 ms) dès `--title-line-delay` : il apparaît **le premier, net** |

Durée totale pour 4 lignes : dernier flou terminé à 100 + 3 × 80 + 352 = **692 ms**, dernière
ligne posée à 100 + 240 + 640 = **980 ms**. Le flou est donc toujours **< 1 s**, l'état final est
net et immobile.

Contraintes :

- `filter` ne s'applique pas de façon fiable aux éléments `inline` ; le flou se pose donc **par
  mot** (`inline-block`, mécanique déjà présente dans `HeroTitle.tsx`), mais **tous les mots d'une
  ligne partagent le délai de leur ligne** : la lecture reste ligne par ligne.
- Nom accessible : copie `sr-only` du titre complet + rendu visuel `aria-hidden` (motif actuel de
  `HeroTitle`) : le titre est lu **une seule fois**.
- `prefers-reduced-motion: reduce` : **rien** ne bouge, aucun flou, titre complet immédiatement.
- **Limite importante** : une fois l'animation finie, le mot n'est plus distingué du reste. Sous
  mouvement réduit, il ne l'est jamais. C seule est un **moment**, pas un accent durable.

### 3.4 Combinaison A + C — recommandée pour le site public

Le mot est en serif italique (accent durable, visible au repos, sans couleur) **et** il apparaît
le premier, net, pendant que le reste de la phrase se met au point (C).

- Ce qui reste sans animation : A complète (le mot reste distinct).
- Ce que le mouvement ajoute : l'œil est conduit au mot clé avant de lire la phrase.
- Respect de la DA : titre noir, aucun aplat de couleur, détail intentionnel.
- Où : hero (C joue au chargement) et titres de section (C joue à l'entrée dans l'écran, une fois).

Autres combinaisons possibles mais non recommandées : B + C (bleu + flou : deux effets forts sur
le même titre, et le bleu domine) ; A + B (interdit : couleur + serif sur le même mot).

---

## 4. Échelle typographique proposée

Rôles (trois familles, quatre rôles) :

| Rôle | Famille | Graisse | Token famille |
|---|---|---|---|
| Titre | police choisie (§ 2) | 600 | `--font-display` |
| Accent de titre (si A) | Instrument Serif italique | 400 | `--font-accent` |
| Corps, boutons, champs, labels | **Geist** | 400 corps, 500 interface | `--font-sans` (devient `var(--font-geist)`) |
| Chiffres, labels techniques | Geist Mono, chiffres tabulaires | 500 label, 600 chiffre | `--font-mono` |

### 4.1 Site public

| Token | Taille | Interlignage | Approche | Usage |
|---|---|---|---|---|
| `text-poster` | `clamp(2.5rem, 1rem + 7.2vw, 7.5rem)` : 44 px à 390, 90 px à 1024, 120 px à 1440 | 0,95 | selon police (§ 2) | `h1` du hero |
| `text-statement` | `clamp(2.25rem, 1.25rem + 3.9vw, 4.5rem)` : 36 / 60 / 72 px | 1,0 | selon police | `h2` des sections, titre de `/estimation` |
| `text-lede` | `clamp(1.0625rem, 1rem + 0.3vw, 1.25rem)` : 17 → 20 px | 1,55 | 0 | Sous-titre du hero, introduction de section (`ink-muted`, ≤ 52 ch) |
| `text-base` | 16 px | 1,6 | 0 | Corps |
| `label` | 11 px, capitales | 1,2 | `0.12em` | Sur-titre (Geist 500, `ink-subtle` 5,7:1) |
| `label-mono` (nouveau) | 11 px, capitales | 1,2 | `0.08em` | Index (« 04 / 07 »), sur-titre technique (Geist Mono 500, `ink-subtle`) |

Sur-titre de section (langage d'accent de la DA § 2) : `label-mono` précédé d'un **trait cobalt de
12 × 2 px** (`--color-accent`, repère, pas texte), écart 10 px. Exemple : `— LE PROBLÈME`.

Rapport titre / label : **≈ 11:1** à 1440 px (120 / 11), 4:1 sur mobile (44 / 11).

### 4.2 CRM

| Token | Sobre | Expressif contrôlé | Interlignage | Usage |
|---|---|---|---|---|
| `text-title` | 32 px | 32 px | 1,15 | `h1` sur téléphone ; grands chiffres (`.figure`) |
| `text-hero` | 42 px (≥ 640 px) | 42 px (640–1023), **48 px** (≥ 1024) | 1,05 | `h1` de `PageHeader` |
| `text-section` | 24 px | **28 px** | 1,2 | `h2` de section hors carte |
| `text-heading` | 21 px | 21 px | 1,25 | Titre de carte |
| `text-sm` / `text-base` | 14 / 16 px | idem | — | Interface / corps |
| `label` | 11 px Geist caps | 11 px Geist caps | 1,2 | `dt`, en-têtes de tableau |
| `label-mono` | — | 11 px Geist Mono caps | 1,2 | Sur-titre de page, index, horodatages courts |

Graisse des titres CRM : 600 (650 si la police choisie paraît légère à 42 px ; décision visuelle
sur la page de comparaison). `PageHeader` passe de 800 à cette graisse.

---

## 5. Apparition ligne par ligne

### Approche recommandée

- **Lignes déclarées par l'auteur** dans les textes (`titleLines: [...]`, comme le hero et le
  problème aujourd'hui), **jamais mesurées au runtime**. Chaque ligne est un bloc (`display:block`) ;
  sur mobile, une ligne d'auteur peut se replier sur deux lignes visuelles : elle reste **une**
  unité d'animation (aucun saut, aucun calcul).
- **CSS uniquement.** Aucune mesure, aucun minuteur JavaScript.
  - Hero : l'animation part au chargement (CSS pur).
  - Titres de section : déclenchés par le `Reveal` existant (`.reveal[data-reveal="entering"]`,
    même mécanique que le filet d'« administratif » aujourd'hui). Aucun nouveau JavaScript.
- **Visible sans JavaScript** : l'état final est l'état par défaut ; l'état masqué n'existe que
  dans `@media (prefers-reduced-motion: no-preference)` **et** sous `[data-reveal="hidden"]`
  (attribut posé seulement par JavaScript). Jamais `opacity: 0` par défaut.
- Au plus **4 lignes** animées ; au-delà, le titre est statique.
- **Une seule fois** par chargement (hero) ou par première entrée (section). Un re-rendu React ne
  rejoue rien (`animation-fill-mode: backwards`, aucun `transform` résiduel).

### Valeurs (variantes A et B, sans flou)

| Élément | État initial | État final | Propriété | Durée | Courbe | Décalage |
|---|---|---|---|---|---|---|
| Ligne (sous masque `overflow:hidden`, réserve de 0,1 em pour les jambages, compensée) | `translateY(100%)`, opacité 0 | posée, opacité 1 | `transform`, `opacity` | 640 ms | `--ease-emphasis` | `--title-line-delay` + n × 80 ms (60 ms sous 640 px) |

Variante C et A + C : valeurs du § 3.3 (pas de masque : il couperait le flou).

### Cas limites

- Redimensionnement pendant l'animation : rien n'est recalculé (lignes d'auteur) ; l'animation se
  termine normalement.
- Clavier, tactile : le titre n'est pas interactif ; aucune action n'attend la fin de l'animation
  (boutons du hero cliquables immédiatement).
- `MotionToggle` (pause WCAG 2.2.2) : animation unique de moins de 1,1 s, hors champ du critère ;
  si la pause est active au chargement, le titre est affiché directement.
- `prefers-reduced-motion: reduce` : titre complet et immobile, aucun flou, aucune translation,
  aucune opacité intermédiaire ; le mot accentué A reste visible (forme), B reste bleu, C n'a
  plus d'effet.
- Lecteur d'écran : titre lu une fois (copie `sr-only` + visuel `aria-hidden` dès que le titre
  est découpé en mots, c'est-à-dire en C ; en A/B découpés par ligne seulement, vérifier que le
  nom accessible garde les espaces entre lignes, sinon même motif `sr-only`).
- Tests Playwright : aucun test n'attend une animation (règle existante, § 2.5.5).

---

## 6. Titres-phrases du site public

Contraintes vérifiées : aucun chiffre, pourcentage, prix ni témoignage
(`components/landing-texts.test.ts`) ; aucune promesse d'estimation instantanée ni d'envoi
automatique ; le premier contact et le mandat restent humains ; tout est simulé.
Le **mot accentué** est entre astérisques. Les `/` indiquent les lignes d'auteur (ordinateur).

| Section (fichier) | Titre actuel | Proposition | Mot | Pourquoi |
|---|---|---|---|---|
| Hero (`hero.titleLines`) | « Chaque demande vendeur avance. Votre agence garde la main. » | Chaque demande / vendeur avance. / Votre agence / garde la *main*. | main | Déjà une phrase juste ; l'accent remplace la moitié grise. Contrôle humain = idée de la marque. |
| Problème (`problem.titleLines`) | « Ce n'est pas la prospection qui freine vos mandats. C'est l'administratif. » | Inchangé. Observation en `ink-subtle`, réponse en encre : C'est l'*administratif*. | administratif | Déjà un récit ; seul le procédé d'accent change (le filet cobalt est remplacé). |
| Solution (`solution.title`) | « Un ordre lisible, de la demande au mandat. » | Chaque dossier suit / le même *chemin*, / de la demande au mandat. | chemin | Raconte au lieu d'étiqueter ; le rail en dessous montre ce chemin. |
| Agents (`agents.title`) | « Chaque agent sait où son travail commence. Et où il s'arrête. » | Chaque agent sait / où son travail commence. / Et où il *s'arrête*. | s'arrête | La limite est le message (périmètre borné) ; inchangé hormis l'accent. |
| Contrôle (`control.title`) | « L'IA prépare. Votre équipe décide. » | L'IA prépare. / Votre équipe *décide*. | décide | Inchangé hormis l'accent : l'humain décide. |
| Résultat (`result.title`) | « Chaque dossier a une prochaine action claire. » | Vous ouvrez l'espace agence. / Vous savez par quoi *commencer*. | commencer | Raconte un moment vécu ; vrai (« À faire maintenant » du tableau de bord). |
| Final (`final.title`) | « Voyez le parcours complet avec un bien fictif. » | Déposez une demande *fictive*. / Retrouvez-la dans l'espace agence. | fictive | Le mot accentué rappelle l'honnêteté de la démo. Le `body` actuel devient redondant : à retirer ; la `note` « Aucune donnée réelle, aucun envoi réel » est **conservée**. |
| `/estimation` (`APP_TEXTS.estimation.title`) | « Parlez-nous de votre bien » | Parlez-nous de votre bien. / Un *conseiller* vous répond. | conseiller | Dit qui répond (un humain), sans promettre de chiffre ni de délai. Sous-titre actuel conservé tel quel (il dit « aucune estimation chiffrée »). Passe au rôle public `text-statement`. |

Alternatives si l'utilisateur veut changer le hero : « Vos demandes vendeurs avancent. / Vous
gardez le *dernier* mot. » (mot : dernier). Non retenue par défaut : « garde la main » est déjà
validé.

Non concernés (titres internes de scène, carte du parcours fictif) : inchangés.

---

## 7. Deux niveaux pour le CRM

Le CRM prend dans les deux cas : la nouvelle police des titres, Geist en corps, Geist Mono en
chiffres, graisse 600, **titres courts** (1 à 4 mots, règle du 26/09 inchangée), aucune
révélation ligne par ligne (un conseiller revoit ces écrans des dizaines de fois par jour :
`animate-rise` actuel conservé).

### Niveau 1 — Sobre

- Nouvelle police seule, échelle actuelle (§ 4.2 colonne « Sobre »).
- Aucun mot accentué, aucun sur-titre ajouté, labels en Geist.
- Risque : l'utilisateur peut encore trouver le CRM « fade » ; seul le dessin des lettres change.

### Niveau 2 — Expressif contrôlé

- Échelle élargie : `h1` 48 px dès 1024 px, `h2` de section 28 px (§ 4.2).
- Sur-titre de page en `label-mono` précédé du trait cobalt 12 × 2 px : nom du module
  (`AGENTS IA` au-dessus de « Messages à valider », `CRM` au-dessus de « Contacts vendeurs »).
  Texte fixe, jamais un chiffre non réel.
- En-têtes de tableau et `dt` restent en `label` Geist ; index et horodatages courts en
  `label-mono`.
- Mot accentué **uniquement** dans les titres d'état vide (`EmptyState`), en variante A, si A ou
  A + C est retenue (ex. « Rien à *valider* »), taille portée à 28 px. Jamais dans un `h1` de
  travail, jamais dans une carte, un tableau, une alerte, un blocage.
- Jamais B ni C dans le CRM.

### Recommandation : niveau 2, expressif contrôlé

Le contraste d'échelle et le petit repère cobalt rendent l'écran lisible avant d'être lu (titre
noir → trait bleu → contenu), exactement la hiérarchie de la DA § 4, sans rien ajouter qu'un
conseiller doive lire. L'accent reste confiné aux moments calmes (états vides), où il ne ralentit
aucune décision.

---

## 8. Cahier des charges de la page de comparaison `/dev/typographie`

### Cadre

- Fichier : `app/dev/typographie/page.tsx`. **404 en production** : même garde que `/dev/icons`
  et `/dev/particles` — `if (!isAnimationGalleryEnabled()) notFound();` avec
  `import { isAnimationGalleryEnabled } from "../animations/guard";`. Test unitaire calqué sur
  `app/dev/icons/page.test.tsx`.
- Polices chargées **dans la route uniquement** (par exemple `app/dev/typographie/fonts.ts`), pas
  dans `app/layout.tsx` à cette étape : `Bricolage_Grotesque` (axes `opsz`, `wdth`),
  `Schibsted_Grotesk`, `Mona_Sans` (axe `wdth`), `Instrument_Serif` (400, italique). Toutes
  `subsets: ["latin"]`, `display: "swap"`, une variable CSS chacune. Aucune dépendance npm, CSP
  inchangée.
- Le conteneur de la page force **Geist en corps** (portée locale de `--font-sans`) pour montrer
  l'état « Inter disparaît ».
- Textes de la galerie centralisés dans `app/dev/typographie/gallery-texts.ts` (comme les autres
  galeries). Mention visible en tête : « Spécimen typographique — textes du produit, aucune
  donnée réelle ».
- Le choix courant est porté par l'URL (`?police=bricolage|schibsted|mona`,
  `&accent=a|b|c|ac`, `&crm=sobre|expressif`) via de simples liens : fonctionne sans JavaScript,
  partageable, comparable dans deux onglets. Défaut : `bricolage`, `ac`, `expressif`.
- Chaque spécimen porte une légende `label-mono` exacte : police, graisse, taille, approche,
  axes (ex. `BRICOLAGE GROTESQUE · 600 · 120 PX · −0.035 EM · WDTH 92`), pour que l'utilisateur
  puisse nommer son choix.

### Contenu, dans cet ordre

1. **Les trois polices côte à côte** (3 colonnes à 1440, empilées à 1024 et 390), sans accent,
   sans animation :
   - le hero : « Chaque demande vendeur avance. Votre agence garde la main. » en `text-poster`
     (à 1440, chaque colonne montre la taille réelle d'une colonne ; un lien « voir en pleine
     largeur » ouvre la police seule en 120 px) ;
   - un en-tête CRM réel : sur-titre `AGENTS IA`, `h1` « Messages à valider » en 42 et 48 px,
     un titre de carte 21 px « Premier contact préparé par Emma », un chiffre `.figure` 32 px
     étiqueté « exemple », un label ;
   - une ligne de contrôle des glyphes : `É À Ç œ « Déjà vu » l’été — 1 234,56 €` avec espace fine
     avant « : » et dans les guillemets.
2. **Le mot accentué** (police sélectionnée par `?police=`) : quatre blocs A, B, C, A + C, chacun
   sur le titre du problème et sur celui du hero, avec un bouton **« Rejouer »** par bloc et la
   légende des tokens. Le bloc B affiche son contraste calculé (3,80:1 sur blanc) et un second
   spécimen sur fond `pearl` (3,34:1).
3. **L'échelle** : public (`text-poster` → `text-statement` → `text-lede` → `text-base` →
   `label` → `label-mono`) puis CRM sobre et CRM expressif, chaque palier avec sa taille en px
   affichée en mono. Le sur-titre avec trait cobalt est montré une fois.
4. **L'apparition ligne par ligne** : le hero complet en `text-poster`, avec la variante d'accent
   sélectionnée, et un bouton **« Rejouer »** (remonte le titre, aucune autre logique). Puis un
   titre de section rejoué de la même façon.
5. **Les deux niveaux CRM** côte à côte (empilés sous 1024) : un en-tête de « Messages à valider »
   + une carte + un état vide « Rien à valider », sur fond `.app-canvas`, en sobre puis en
   expressif contrôlé.

### Comportements exigés

- « Rejouer » : bouton réel (`<button>`), focus visible cobalt, nom accessible « Rejouer
  l'apparition du titre ». Sous `prefers-reduced-motion: reduce` : bouton désactivé avec texte
  visible « Mouvement réduit actif : le titre s'affiche directement ».
- Spécimens de titre : `h2`/`h3` dans une hiérarchie correcte (un seul `h1` : le titre de la
  galerie). Titre animé lu une fois par un lecteur d'écran.
- Aucune animation en boucle ; aucune animation tant que l'utilisateur ne la déclenche pas, hors
  premier affichage.
- Aucun débordement horizontal à 1440, 1024, 390 et 360 px (sauf la zone « pleine largeur »,
  défilable explicitement si besoin).
- Le reste de l'application est **inchangé** (aucun fichier hors `app/dev/typographie/`).

### Définition de « terminé » pour cette page

1. `/dev/typographie` s'affiche en développement, renvoie 404 en production (test).
2. Les 4 polices sont servies depuis l'origine (aucune requête vers `fonts.googleapis.com` ni
   `fonts.gstatic.com` dans l'onglet réseau) ; `npm run build` réussit.
3. Captures 1440, 1024, 390 de chaque section + une capture sous mouvement réduit, remises au
   `web-designer` pour l'étape 3.
4. `npm run lint`, `npx tsc --noEmit`, `npx vitest run` passent (résultats réels).

---

## 9. Questions pour l'utilisateur

1. **Quelle police de titres ?** Bricolage Grotesque (caractère qui s'adapte à la taille —
   recommandée), Schibsted Grotesk (presse, sûre) ou Mona Sans (technique, serrée par le dessin).
2. **Quel mot accentué ?** A serif italique, B bleu, C flou → net, ou **A + C** (recommandée :
   accent durable sans couleur, et le mot apparaît le premier).
3. **Quel niveau pour le CRM ?** Sobre, ou **expressif contrôlé** (recommandé : titres plus
   grands, petit sur-titre technique avec trait bleu, accent seulement dans les états vides).

---

## 10. Décisions de l'utilisateur (01/10/2026)

Choix faits sur la page de comparaison `/dev/typographie` (étape 3), transmis par l'orchestrateur.

| # | Question | Décision | Effet |
|---|---|---|---|
| 1 | Police des titres | **Bricolage Grotesque** | Geist devient le texte courant, Geist Mono reste pour les chiffres et devient la voix des sur-titres, **Inter est supprimée** du produit. |
| 2 | Mot accentué | **A + C** | Instrument Serif italique permanent sur un seul mot ; apparition flou → net où ce mot arrive net en premier. B (bleu) n'est utilisée nulle part. |
| 3 | Niveau du CRM | **Expressif contrôlé** | `h1` 48 px dès 1024 px, `h2` de section 28 px, sur-titre mono en capitales avec trait cobalt, mot italique **seulement dans les états vides** ; ni B, ni C, ni apparition ligne par ligne dans le CRM. |
| 4 | Titres-phrases du site public | **Propositions du § 6 retenues** sans modification | Textes exacts, découpage en lignes et mot accentué : `docs/design-system.md` § 2.2.9. |

Points restés ouverts après la galerie, tranchés par le `web-designer` à l'étape 4 (détail et
justification dans `docs/design-system.md` § 2.2) :

- **Option « serré » (`wdth 92`)** : non retenue (l'utilisateur a validé la largeur par défaut) ;
  l'axe `wdth` n'est pas chargé. Levier documenté si le hero paraît trop petit à l'audit.
- **Graisse** : 600 partout, public et CRM (650 non retenu : une seule voix).
- **Approche des titres de section CRM (28 px)** : `-0.015em`.
- **Titres de carte** : Bricolage 600, 21 px, `-0.01em` ; titres ≤ 18 px en Geist.
- **Chiffres** : Geist Mono 600 tabulaire, tailles inchangées.
- **Mot net (C)** : opacité seule, `--duration-base` (220 ms), `--ease-standard` — ce que
  l'utilisateur a vu.
- **Mot accentué** : `display: inline` obligatoire (`line-height: 0` sur un `inline-block`
  écrase la boîte), groupe mot + ponctuation insécable.
- **Hero** : le poster est borné par sa colonne (`min(var(--text-poster), 13cqi)`), la grille du
  hero n'est pas refaite.
- **`/estimation`** : titre à l'échelle des pages (32 / 42 / 48 px), la colonne `max-w-2xl` ne
  permet pas `text-statement`.
- **Découpage des titres longs** pour tenir à 1440 px : problème, résultat et final passent à
  trois lignes d'auteur (mêmes mots que le § 6, sauf le `body` final retiré comme prévu).
- **Huit états vides** reçoivent le mot italique (liste au § 2.2.9 du design system) ; les
  résultats de filtre, pages vides de pagination, historiques et pages introuvables non.
- **Sur-titres CRM** : groupes de la navigation (`PILOTAGE`, `AGENTS IA`, `VUE D'ENSEMBLE`,
  `RÉGLAGES`) ; aucun sur-titre là où un fil d'Ariane existe.
- **Galerie `/dev/typographie`** : à **supprimer** à la fin de l'implémentation (jamais
  commitée), après avoir déplacé la logique `splitAccent` / `countAccent` dans le composant de
  titre du produit. Raisons : elle fait télécharger au build deux familles jamais utilisées
  (Schibsted Grotesk, Mona Sans), ses tokens locaux divergeraient des tokens réels, et les
  écrans du produit deviennent la référence.

Suite : étape 5 (implémentation, `frontend-ux`), étape 6 (captures et tests), étape 7 (audit
écrit `docs/audits/2026-10-0X-typographie-expressive.md`, critères au § 2.2.10 du design system).
