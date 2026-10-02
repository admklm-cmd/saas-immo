# Système de design — Ascend Strategy

> Propriétaire : agent `frontend-ux`. Toute évolution visuelle passe par ce document.
> Source technique : `app/globals.css` (tokens Tailwind v4) et `components/ui/`.

## 1. Principes

1. **Noir, blanc, gris.** Aucune teinte ne porte de sens. Un statut se lit au texte,
   au remplissage, à l'épaisseur du trait ou à une forme — jamais à une couleur seule.
   Conséquence : l'interface reste lisible en niveaux de gris et pour les daltoniens.
2. **Espace d'abord.** Grandes marges, peu d'éléments par écran, une seule action
   principale visible par zone.
3. **Futuriste à la manière d'Apple.** Typographie nette et hiérarchisée, coins
   arrondis réguliers, ombres presque invisibles, flou et transparence réservés aux
   barres et panneaux fixes.
4. **Ordinateur d'abord** (référence 1440 px), puis tablette et mobile.
5. **Accessibilité WCAG AA** non négociable : contrastes, focus visible, navigation
   clavier complète, libellés de formulaire réels.
6. **Aucune valeur en dur** dans un composant s'il existe un token.

### 1.1 Direction de la landing publique

La page d'accueil adopte un rythme éditorial premium : titres de très grande taille,
composition asymétrique, longues respirations et séparateurs fins. Cette direction
s'inspire du niveau de contraste et du rythme des studios numériques contemporains,
sans reprendre leurs contenus, compositions ou effets propriétaires.

- Thème unique clair, monochrome ; l'accent cobalt est réservé à l'étape active, au
  signal et au point de contrôle humain. Sans image ni ressource distante. Pour le rail
  et le carrousel des agents (ajustements A1/A2, 24/09/2026) la règle est plus stricte :
  cobalt seulement pour ce qui est réellement actif (étape en cours / sélectionnée,
  impulsion, validation qui attend une action) ; une étape humaine se reconnaît à sa
  **forme** (double contour), pas à la couleur. `LandingSolution` et `HeroJourney`
  gardent pour l'instant l'accent statique du Lot 1 sur les étapes humaines.
- **Section « problème »** (`LandingProblem` + `BlockerChart`) : titre « Ce n'est pas
  la prospection qui freine vos mandats. C'est l'administratif. » (trois lignes d'auteur, les
  deux premières en `ink-subtle`, « administratif » en italique ; le filet cobalt sous le mot
  est supprimé depuis le 01/10/2026) ; graphique SVG
  (Server Component) d'une courbe de mandats qui progresse puis plafonne sous une zone
  en pointillés « Blocage administratif ». **Aucun chiffre** : axes « Temps » et
  « Mandats » seulement, étiquette visible « Illustration — exemple fictif ». Courbe
  cobalt (accent discret), zone grise/noire pointillée (un blocage, pas une erreur),
  aire gris perle. `role="img"` + `aria-describedby` vers une description écrite. Tracé
  `stroke-dashoffset` (`pathLength=1`) déclenché par le `Reveal` englobant ; complet
  sans JavaScript et sous mouvement réduit. Les trois causes (relances manuelles,
  dossiers dispersés, doublons entre conseillers) sont écrites à côté, en HTML.
- **Section agents = interface d'OS** (`components/landing/agents/`, section `agents`,
  refonte B du 24/09/2026) : version détaillée du parcours du hero (mêmes noms, même
  ordre, testé contre `journey.steps`) — Léa → Hugo → Emma → Validation humaine → Louis →
  Sarah → Mandat. Voir le motif « module OS » et la navigation physique en § 2.9.
  **Version claire** (passe de direction artistique du 24/09/2026, remplace la surface
  noire) : aucun panneau propre, le système est posé directement sur la page blanche,
  comme les autres sections ; le fond vivant reste visible entre les surfaces. Seules des
  surfaces **locales et légères** portent du texte : la plaque translucide de chaque
  **module** (`AgentStepCard`, onglets), le voile givré sans bord de `StepDetails` et la
  fenêtre blanche `SceneFrame` (un filet `line`, `shadow-raised`, comme les cartes des
  sections solution et contrôle). Texte `ink` / `ink-muted`, filets gris très fins ;
  cobalt **uniquement** pour l'actif et le mouvement (module ouvert, arrivée du flux,
  anneau de la tuile active, marque d'onglet, focus). Hiérarchie : titre de section →
  modules → application ouverte → réseau. Trois natures, trois traitements (tuiles en
  surface `light`, identiques à l'espace connecté) : agent IA = tuile d'app noire à
  symbole clair ; validation humaine = **point de contrôle** (cercle blanc à double
  contour encre, le trait du flux s'arrête sur une barre devant lui, « Contrôle
  humain ») ; mandat = **aboutissement** (cercle plein noir à double contour,
  « Aboutissement », aucun flux après, scène conclue par un bloc noir « confirmé par le
  conseiller »). Chaque scène porte **toujours** `SimulationBadge` + « Exemple fictif —
  simulation ». Lignes `SceneRow` sans bordure : le ton est porté par la pastille
  (`done` pleine, `flag` pointillée, `active` anneau cobalt, `muted` barrée,
  `plain`) ; seule bordure conservée : le pointillé qui signifie « manquant / en
  attente ». Sans JavaScript : Léa ouverte, sa scène dans le HTML serveur. Données
  fictives La Ciotat / Cassis, aucune personne réelle, aucun chiffre présenté comme
  statistique.
- **Modèles MIG / Striker (02/10/2026, soir, § 2.11.8)** : hero recomposé (texte en deux
  colonnes, puis bloc A pleine largeur : cartes d'agents qui se cochent, curseur « Vous » qui
  coche les deux décisions humaines, en boucle) ; solution = grille de 5 tuiles (feuille de
  route, courbe, équipe, compte-rendu, garde-fous) ; panneau final noir, titre centré,
  carrousel des 7 étapes à visuels animés. Trois effets de titre seulement, chacun unique.
- Le récit suit le travail réel de Léa, Hugo, Emma, Louis puis Sarah.
- Les preuves restent vérifiables dans le prototype : cinq rôles bornés, validation
  humaine, journalisation et simulation. Aucun logo client, chiffre commercial ou
  témoignage n'est inventé.
- **Typographie expressive (01/10/2026, § 2.2)** : titres-phrases en Bricolage Grotesque 600,
  échelle fluide propre au site public (`text-poster`, `text-statement`, `text-lede`), un seul
  mot accentué par titre en Instrument Serif italique (encre, jamais de couleur), sur-titres
  mono à trait cobalt, apparition **ligne par ligne** (le mot accentué arrive le premier, net ;
  le reste passe du flou au net). Composant unique `EditorialTitle` ; textes exacts au § 2.2.9.
- Les sections utilisent `Reveal`, `rise-soft` et `stagger`. Le contenu reste visible
  sans JavaScript et immédiatement disponible avec `prefers-reduced-motion`.
- Sur mobile, toutes les compositions reviennent à une colonne, les actions peuvent
  passer à la ligne et aucune zone ne dépend d'une hauteur d'écran fixe.
- **Hero** (`components/landing/LandingHero.tsx`) : étiquette inclinée
  « 5 AGENTS · CONTRÔLE HUMAIN », titre `EditorialTitle` (`h1`, `poster` borné par sa
  colonne) révélé **ligne par ligne** au chargement (mot accentué « main » net en premier,
  flou court sur le reste, CSS pur ; état final par défaut et sous mouvement réduit ; nom
  accessible lu une fois depuis une copie `sr-only` ; `HeroTitle` est supprimé), sous-titre en
  `text-lede`, action noire (`primary`) puis claire
  (`secondary`), ce que le prototype fait réellement, et `HeroJourney` : parcours d'un
  prospect **fictif** étiqueté « Exemple fictif — simulation » + `SimulationBadge`. Le
  HTML serveur est l'état final (toutes les étapes terminées).
- **Lot « landing en mouvement » (spécifié le 01/10/2026 ; T1–T4 implémentés le 01/10/2026,
  réseau T5–T8 non commencé — § 2.11, plan
  `docs/plans/2026-10-02-landing-motion.md`)** : trois effets du mot accentué (hero : trait
  cobalt ; problème : flou du reste + cadre à 4 coins ; final : les deux), wordmark « Ascend »
  (`TechWordmark`) dans le panneau final — **retiré le 02/10/2026** (lot « finition de la
  landing », § 2.11.3 bis ; le mot accentué de tous les titres de section reçoit l'effet et se
  rejoue au survol) —, réseau neuronal 3D sur toute la page à la place de
  l'histoire 2D ci-dessous (*révisé 02/10 — référence utilisateur* : une vingtaine à une
  trentaine de neurones organiques espacés, arbres dendritiques, impulsions qui illuminent les
  cœurs, caméra qui pivote avec le défilement), **aucune animation en boucle** (parcours du hero joué une fois,
  impulsions en séquences bornées), `MotionToggle` retiré. Les deux puces « Fond vivant » et
  « Pause » ci-dessous décrivent l'état **avant** ce lot.
- **Fond vivant** (`components/landing/living/`) : un seul canvas fixe, `aria-hidden`,
  qui illustre des dossiers fictifs (points, signaux, arrêt devant la validation
  humaine, impulsion stoppée par un garde-fou). Chaque section porte
  `data-living-scene` (hero, probleme, solution, agents, controle, resultat, final) et
  la section au centre de l'écran choisit la scène. Boucle `requestAnimationFrame`
  arrêtée hors écran, onglet caché ou pause ; DPR plafonné (2, 1,5 en compact) ; sous
  `prefers-reduced-motion`, aucune boucle : une composition statique par scène. Le
  modèle (`model.ts`, `timeline.ts`) est pur et testé.
  - **Présence** (`SceneSpec.presence`) : 1,35 dans `probleme` et `agents`, 1 partout
    ailleurs ; mobile = moitié du gain (`COMPACT_PRESENCE_GAIN`).
  - **Trame** (`mesh.ts`, `SceneSpec.mesh` : 1 dans `probleme` et `agents`, **0 ailleurs**,
    donc rendu strictement inchangé dans les 5 autres scènes) : réseau neuronal sobre. Chaque
    point ambiant relié à 2–3 voisins et au nœud du chemin le plus proche ; liens choisis une
    fois par scène et par taille d'écran (stables, sans clignotement). Plafonds : 150 liens
    (large), 30 (compact) ; opacité d'un trait ≤ 0,08, décroissante avec la longueur ;
    épaisseur 0,8 px (plan proche) / 0,55 px (plan lointain). Les dossiers fictifs ne
    circulent que sur le chemin des 8 étapes. Ces valeurs sont celles de `probleme` ; la scène
    `agents` suit son propre profil (ci-dessous).
  - **Profil de trame par scène** (`mesh-style.ts`, `SceneSpec.meshStyle`, C3) : seule
    `agents` en a un ; sans profil, la trame de référence C1/C2 est dessinée à l'identique
    (empreintes de `probleme` figées). Profil `agents`, ordinateur : **116 points**, ≤ **260**
    liens (≈ 205 tracés), 2 voisins par point (60 % un 3ᵉ), lien le plus long 240 px, **aucun lien
    ne traverse un texte** de la section (`SceneSpec.content`, marge 3 px). Traits gris
    `line` : opacité à l'écran **≈ 0,16–0,29** (proche, décroît avec la longueur jusqu'à 55 %),
    plan lointain × 0,6 ; épaisseur **0,95 px** (proche) / **0,7 px** (lointain). Chaque sommet
    est dessiné : point gris (encre) de **1,5–2,3 px** de rayon, opacité ≈ **0,45** à l'écran
    (lointain : 1,2 px, ≈ 0,26) ; **hubs** (10 % des points proches) : cercle contouré de
    **3,4 px** (trait 1 px, ≈ 0,52) sur papier, point central. Aucun sommet ni trait sur une
    étiquette (effacement en fondu). Seuls les prospects au repos à moins de 360 px de l'entrée
    (la moitié d'entre eux) glissent vers elle ; les autres restent sur leur sommet.
    Mobile : 26 points, ≤ 42 liens, traits ≈ 0,11–0,17, points 1,2–1,7 px, 1 impulsion.
  - **Impulsions du profil agents** : **3 au plus** (1 sur mobile), une toutes les **4 s** par
    emplacement, vitesse **64 px/s** (lente), le long d'un **itinéraire de 2 à 5 liens** « ouverts »
    (entre deux points, hors éléments de la section à 10 px près et hors étiquettes), le plus
    long de 4 essais déterministes. Point cobalt plein de **2,4 px**, opacité ≈ **0,95** à
    l'écran, traîne de **30 px en 4 segments** d'opacité et d'épaisseur décroissantes (1,8 → 1 px),
    le sommet atteint s'allume en cobalt **0,7 s** (disque plat ≤ 2,6 px). Mesuré : au moins une
    impulsion visible (≥ 0,5 d'opacité, hors éléments) **99 %** du temps, 1,9 en moyenne. Aucune
    lueur, aucun `shadowBlur`, aucun dégradé. Cobalt : **8 %** de l'encre de la scène (réseau seul
    **1,7 %**) ; aucun lien de repos bleu.
  - **Impulsions de trame** (`probleme`) : ≤ 3 simultanées (1 sur mobile), lentes (2,8 s de trajet, une
    toutes les 7,5 s par emplacement), point cobalt + courte traîne.
  - **Règle cobalt** : l'accent `#2457FF` (palette `accent`, lue depuis `--color-accent`)
    est réservé à ce qui bouge ou est actif (dossiers, impulsions, étape active, validation
    humaine). **Aucun lien de repos bleu.** Aucune lueur, aucun halo néon, aucun
    `shadowBlur`, aucun dégradé : traits et disques plats uniquement (testé).
  - **Plans et parallaxe** : 45 % des points sur un plan lointain (plus pâles, plus petits,
    parallaxe × 0,4). Décalage vertical lié à la progression du défilement dans la section,
    lissé sur 0,25 s, **≤ 20 px** (≤ 10 px sur mobile), appliqué à la trame seule et pondéré
    par le poids de trame (0 ailleurs). Mouvement réduit : aucune parallaxe.
  - **Plafond de visibilité** : `probleme` : +30 à +40 % d'« encre » (opacité × surface) par
    rapport au rendu de référence (mesuré : +33 %), moitié sur mobile. `agents` (plafond levé
    par l'utilisateur le 25/09/2026) : **× 3,8** l'encre de C2 sur ordinateur (garde : ≥ × 2,5),
    × 1,4 sur mobile ; encre de la trame sur le titre et l'introduction : **0 %** (garde < 1 %).
  - **Transitions** : poids de trame et présence mélangés en smoothstep sur 1,6 s (aucun
    saut au changement de section).
  - **Étiquettes dégagées** (`labels.ts`, règle générique) : aucun trait de trame ne traverse
    ni ne touche l'étiquette d'un nœud (Léa, Hugo…, boîte estimée + 4 px) : le trait est
    interrompu autour de l'étiquette (un seul tracé par lien, plafonds inchangés) et une
    impulsion s'efface en fondu en passant près d'elle. Une étiquette est toujours à droite de
    son nœud : un lien du chemin n'y arrive que par la gauche ou presque verticalement (testé
    dans `agents`).
  - **Composition de la scène agents** (mesurée à 1440 × 900, section en position de lecture) :
    chemin en colonne quasi verticale à droite du titre (x ≈ 0,66–0,71, hors de la colonne du
    titre de 1280 à 1920 px), qui descend entre deux modules (interstice x 982) jusqu'au
    « Mandat » sous la rangée. Les points de la trame reposent dans des zones libres
    (`SceneSpec.field`, ordinateur seulement) : à droite du titre, bande de la barre, sous
    l'introduction, trois colonnes dans les interstices des modules, bande entre modules et
    fenêtre, marges. Dès **1280 px** de large (`FRAME_PIXEL_MIN`), la composition garde cette
    géométrie en pixels (1440 × 900), centrée comme le contenu (`SceneSpec.frame`) : le contenu
    (`max-w-7xl` centré) y est aux mêmes pixels ; en dessous, mise à l'échelle. Mobile : colonne
    à droite. C3 : le réseau respire dans toute la section — un tiers à droite du titre, le reste
    en bande pleine largeur sous l'introduction, marges gauche et droite, bande entre modules et
    fenêtre (ouverte autour de « Mandat »), chaînes dans les interstices des modules et entre le
    texte de détail et la fenêtre. Sarah remonte à y 0,488 (dégagée de la rangée de 1280 à 1920).
    Mesuré : 100 % des points, 96 % de l'encre des liens et 46 impulsions sur 47 hors des
    éléments (avant : 45 %, 46 %, 15 sur 43), présence et plafonds inchangés.
  - **Budget** : < 4 ms par image sur ordinateur (`data-frame-ms` du canvas ; mesuré
    ≈ 1,0 ms (agents) et ≈ 0,9 ms (probleme) à 1440 × 900, 1,2 ms à 1280, 0,25 ms sur mobile).
- **Pause (WCAG 2.2.2)** : `MotionToggle` suspend l'illustration du hero et le fond
  vivant (`landing-motion.ts`, `<html data-landing-motion="paused">`). Masqué quand
  rien ne bouge. **Retiré au lot landing-motion** : plus aucun mouvement automatique ne dure
  plus de 5 s (justification au § 2.11.6).
- Pas de bouton de contact flottant tant qu'aucun canal réel n'est configuré. Les
  textes vivent dans `components/landing-texts.ts`, testé contre tout chiffre,
  pourcentage, prix ou témoignage inventé.

## 2. Tokens

Tous les tokens vivent dans `@theme` (`app/globals.css`) et Tailwind v4 génère les
utilitaires correspondants.

### 2.1 Couleurs

| Token | Valeur | Utilitaires | Usage |
|---|---|---|---|
| `--color-canvas` | `#ffffff` | `bg-canvas` | Fond de page |
| `--color-surface` | `#ffffff` | `bg-surface` | Cartes, champs |
| `--color-surface-muted` | `#fafafa` | `bg-surface-muted` | En-têtes de tableau, encarts |
| `--color-surface-sunken` | `#f4f4f5` | `bg-surface-sunken` | Survol, puces neutres |
| `--color-inverse` | `#0a0a0b` | `bg-inverse` | Bouton principal, badge fort, alerte d'erreur |
| `--color-inverse-soft` | `#1c1c1f` | `bg-inverse-soft` | Survol du bouton principal |
| `--color-pearl` | `#e9e9ee` | — | Point le plus sombre du fond gris perle (`.app-canvas`) |
| `--color-pearl-soft` | `#f7f7f9` | — | Palier intermédiaire du fond gris perle |
| `--color-ink` | `#18181b` | `text-ink` | Texte principal — **17,7:1** sur blanc, **14,6:1** sur `pearl` |
| `--color-ink-muted` | `#5a5a60` | `text-ink-muted` | Texte secondaire — **6,9:1** (5,7:1 sur `pearl`) |
| `--color-ink-subtle` | `#66666e` | `text-ink-subtle` | Légendes, sur-titres — **5,7:1** (4,7:1 sur `pearl`) |
| `--color-ink-inverse` | `#fafafa` | `text-ink-inverse` | Texte sur fond noir |
| `--color-ink-inverse-muted` | `#a8a8b0` | `text-ink-inverse-muted` | Texte secondaire sur noir — **7,4:1** |
| `--color-line` | `#e4e4e9` | `border-line` | Séparateurs, bordure des cartes |
| `--color-line-strong` | `#d2d2d8` | `border-line-strong` | Bordures de champs et de puces |
| `--color-focus` | `#0a0a0b` | — | Anneau de focus |
| `--color-danger` | `#c63838` | — | **Seule teinte de l'interface** : points d'erreur (`ErrorDots`) uniquement, jamais du texte, toujours à côté d'un message écrit |

Toutes les paires texte/fond utilisées dépassent 4,5:1 (WCAG AA texte normal), y
compris sur le point le plus sombre du fond gris perle.

**Fond de l'espace connecté** (`.app-canvas`, posé sur `<main>` du layout `(app)`) :
blanc, dégradé gris perle très doux, halo blanc diffus —
`radial-gradient(ellipse at 80% 75%, pearl 0%, pearl-soft 34%, canvas 72%)`, fixé à la
fenêtre (`background-attachment: fixed`) pour qu'une longue page n'entraîne pas sa
zone sombre sous la ligne de flottaison. Les cartes restent **blanches et opaques**
(`bg-surface`, `border-line`, `shadow-subtle`) : aucun texte n'est posé sur une
transparence.

### 2.2 Typographie

**Décision du 01/10/2026 (remplace celle du 26/09/2026).** Source : le plan
`docs/plans/2026-10-01-expressive-typography.md` et les choix de l'utilisateur (§ 10 de ce
plan). Titres en **Bricolage Grotesque**, mot accentué en **Instrument Serif italique**, corps en
**Geist**, chiffres et labels techniques en **Geist Mono**. **Inter disparaît du produit.** Site
public très expressif (titres-phrases, mot accentué, apparition ligne par ligne) ; CRM
« expressif contrôlé » (échelle élargie, sur-titre mono à trait cobalt, mot accentué seulement
dans les états vides, aucune apparition ligne par ligne).

Le chargement ne change pas de principe : `next/font/google` télécharge les fichiers **au build**
et les sert depuis notre origine (aucune requête du navigateur vers Google, CSP
`font-src 'self'` inchangée), `display: "swap"`, repli métrique automatique. Aucune dépendance
npm. Contrepartie inchangée : le build a besoin du réseau.

#### 2.2.1 Familles, imports et variables

Tout est déclaré dans `app/layout.tsx`, et seulement là. Les classes `.variable` des quatre
familles sont posées sur `<html>`.

| Rôle | Famille | Import exact (`next/font/google`) | Variable next/font | Token `@theme` (`app/globals.css`) |
|---|---|---|---|---|
| Titre | Bricolage Grotesque, variable 200–800, axe optique | `Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], display: "swap", variable: "--font-bricolage" })` | `--font-bricolage` | `--font-display: var(--font-bricolage), var(--font-geist), ui-sans-serif, system-ui, sans-serif` |
| Mot accentué | Instrument Serif, **italique 400 seulement** (un seul fichier) | `Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", display: "swap", variable: "--font-instrument-serif" })` | `--font-instrument-serif` | `--font-accent: var(--font-instrument-serif), ui-serif, Georgia, serif` |
| Corps, interface, labels | Geist (inchangé) | `Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" })` | `--font-geist` | `--font-sans: var(--font-geist), ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif` |
| Chiffres, label technique | Geist Mono (inchangé) | `Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-geist-mono" })` | `--font-geist-mono` | `--font-mono` (inchangé) |

Règles :

- **Supprimés** : l'import `Inter`, la variable `--font-inter` et toute mention de
  `var(--font-inter)` (y compris dans le repli de `--font-display`). Un test échoue si
  `--font-inter` ou `Inter(` réapparaît dans `app/` ou `components/`.
- **Nom de variable next/font ≠ nom du token `@theme`.** La galerie `/dev/typographie` nommait la
  variable de l'italique `--font-accent` : ne pas recopier, cela donnerait
  `--font-accent: var(--font-accent)` (référence circulaire, police perdue).
- **Axe `wdth` chargé — option « serré » activée sur le hero seulement (décision du
  01/10/2026).** Après l'audit (hero à 78,6 px contre 72 px pour les sections, hiérarchie
  trop plate), l'orchestrateur a retenu l'option 1 du `web-designer` pour un rendu « vraiment
  expressif » : import `Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"],
  display: "swap", variable: "--font-bricolage" })` (accepté par `next/font` 16.3.8 : axe
  `wdth` 75–100 déclaré pour la famille) et `font-variation-settings: "wdth" 92` sur la classe
  `poster` d'`EditorialTitle` **seulement** (le `h1` du hero). Le mot accentué remet
  `font-variation-settings: normal` (`.title-accent`) ; sections, CRM et `/estimation` restent
  en largeur 100.
- **Axe `opsz`** : `font-optical-sizing: auto` (valeur par défaut du navigateur), jamais de
  `"opsz"` forcé. C'est lui qui rend Bricolage affirmée à 80–120 px et calme à 21 px.
- La galerie `/dev/typographie` chargeait aussi Schibsted Grotesk et Mona Sans : ces deux
  familles ne sont **jamais** importées dans le produit. (Galerie supprimée le 01/10/2026 après
  la livraison du lot ; sa logique `splitAccent` / `countAccent` vit dans
  `components/ui/editorial-title.ts`.)

#### 2.2.2 Rôles et graisses

| Rôle | Famille | Graisse | Règle |
|---|---|---|---|
| **Titre** | Bricolage (`font-display`) | **600 partout** (`font-semibold`), public et CRM | Une seule voix : la force vient de la **taille** et de l'**encre noire**, pas de la graisse. 650 n'est pas retenu, 700 et 800 disparaissent de tous les titres (`font-bold` / `font-extrabold` → `font-semibold`, liste au brief). |
| **Mot accentué** | Instrument Serif italique (`font-accent`) | 400 | Uniquement par la classe `.title-accent` (§ 2.2.5). Jamais ailleurs. |
| **Corps** | Geist (`font-sans`, défaut du `body`) | 400 texte courant ; 500 interface (boutons, champs, navigation, badges) ; 600 mise en avant dans une phrase | — |
| **Chiffre** | Geist Mono, chiffres tabulaires (`.figure`) | 600 | `letter-spacing: -0.03em` (inchangé). Tailles inchangées (`text-title`, `text-hero`, `text-section`). Jamais en Bricolage, jamais en italique. `font-bold` → `font-semibold` sur les chiffres. |
| **Label** | Geist (`.label` / `text-overline`) | 500 (600 toléré là où il existe déjà) | 11 px, capitales, `0.1em`, `text-ink-subtle` : `dt`, en-têtes de tableau, sur-titres internes aux cartes. |
| **Label mono** (nouveau) | Geist Mono (`.label-mono`) | 500 | 11 px, capitales (`text-transform`, le texte est stocké en casse normale), `0.08em`, interlignage 1,2, `text-ink-subtle`. Sur-titre de page (CRM), sur-titre de section (site public), index (« 04 / 07 »). |

**Bricolage jamais sous 18 px.** Un titre composé en `text-xs`, `text-sm`, `text-base`, `text-lg`
ou `text-overline` (ex. `h3` « L’agent au travail » des cartes, `h2` des colonnes du pipeline,
`h2` en capitales de `RunOutcomeSummary`) est en **Geist**. Mise en œuvre recommandée, dans
`@layer base` de `app/globals.css`, juste après la règle `h1–h4` :
`:is(h1, h2, h3, h4):is(.text-xs, .text-sm, .text-base, .text-lg, .text-overline) { font-family: var(--font-sans); }`
(les utilitaires restent prioritaires, la règle couvre aussi les futurs titres). Une autre mise
en œuvre est acceptée si le résultat calculé est le même.

#### 2.2.3 Échelle — site public

| Token | Taille calculée (390 / 1024 / 1440 px) | Interlignage | Approche | Usage |
|---|---|---|---|---|
| `text-poster` | `clamp(2.5rem, 1rem + 7.2vw, 7.5rem)` : 44 / 90 / 120 px, **borné par la colonne** : `font-size: min(var(--text-poster), 14cqi)`, `wdth` 92 (décision du 01/10/2026) | 0,95 | `-0.035em` | `h1` du hero |
| `text-statement` | `clamp(2.25rem, 1.25rem + 3.9vw, 4rem)` : 36 / 60 / 64 px (maximum ramené de 72 à 64 px, décision du 01/10/2026) | 1,0 | `-0.03em` | `h2` des sept sections de la landing |
| `text-page` → `text-hero` → `text-title` | 32 (< 640) / 42 (640–1023) / 48 px (≥ 1024) | 1,15 / 1,05 / 1,05 | `-0.02em` / `-0.025em` / `-0.025em` | `h1` de `/estimation` (colonne `max-w-2xl` : le poster n'y tiendrait pas) |
| `text-lede` (nouveau) | `clamp(1.0625rem, 1rem + 0.3vw, 1.25rem)` : 17 → 20 px | 1,55 | 0 | Sous-titre du hero, introduction des sections, sous-titre de `/estimation`. `text-ink-muted`, `max-width: 52ch` |
| `text-base` | 16 px | 1,6 | 0 | Corps |
| `label-mono` | 11 px, capitales | 1,2 | `0.08em` | Sur-titre de section avec trait cobalt (§ 2.2.6) |

**Hero borné par sa colonne.** La grille du hero (`lg:grid-cols-[1.08fr_0.92fr]`) n'est pas
refaite : à 1440 px la colonne du titre mesure ≈ 600 px, 120 px n'y tiennent pas. La colonne de
texte du hero reçoit `container-type: inline-size` et le titre prend
`min(var(--text-poster), 14cqi)` en `wdth` 92 (≈ 85 px à 1440, ≈ 65 px à 1024, 44 px à 390). Critère : à
1440 et 1024 px, **chaque ligne d'auteur tient sur une ligne visuelle** (mesuré). Le
coefficient (`14cqi`) est la seule valeur que `frontend-ux` peut ajuster, entre `12cqi` et
`14cqi`, pour satisfaire ce critère ; la valeur finale est reportée ici. Compromis assumé : le
hero est un peu plus petit que l'actuel (88 px en Geist serré) mais nettement plus présent par
le dessin ; si l'utilisateur le juge trop petit à l'audit, le levier est l'option « serré »
(§ 2.2.1), pas une refonte de la grille.

**Valeur retenue — décision du 01/10/2026 (après audit) : `14cqi` + `wdth` 92 sur le hero,
`text-statement` plafonné à 64 px.** Mesures (Chromium, polices chargées, 01/10/2026) :

| Largeur | Hero (`h1`) | Colonne | Ligne la plus longue (« Chaque demande ») | Lignes visuelles | Sections (`h2`) | Rapport hero / sections |
|---|---|---|---|---|---|---|
| 1440 | 84,67 px | 604,8 px | 548,3 px (marge 56 px) | 1 par ligne d'auteur | 64 px | **1,32** |
| 1024 | 65,32 px | 466,5 px | 437,7 px (marge 29 px) | 1 par ligne d'auteur | 59,9 px | 1,09 |
| 390 | 44,08 px | 342 px | 165 px | 1 par ligne d'auteur | 36 px | 1,22 |
| 360 | 41,92 px | 312 px | 157,5 px | 1 par ligne d'auteur | 36 px | 1,16 |

Le serré libère de la place : « Chaque demande » passe de 575 px (78,6 px, largeur 100) à
548 px à 84,7 px ; la cible ≈ 85 px est atteinte sans toucher la grille, et le hero ne se
replie plus du tout à 360 px. Sections à 1440 : la ligne la plus longue est « Déposez une
demande fictive. » (791 px, panneau final) ; toutes les lignes d'auteur tiennent sur une ligne
visuelle à 1440 et 1024. Hauteur de ligne avec et sans `.title-accent` : écart **0 px** (hero
80,44 / 62,05 / 41,86 / 39,81 px à 1440 / 1024 / 390 / 360 ; sections 64 / 59,94 / 36 px ;
`/estimation` 36,8 px à 390 et 360). Aucun débordement horizontal (0 px) à 1440 / 1024 / 390 /
360. À 1024 le rapport reste 1,09 : le hero y est borné par sa colonne (466 px) alors que les
sections n'atteignent pas encore leur plafond ; accepté (grille inchangée, § 2.2.3).

*Historique (mesure initiale du 01/10/2026, avant audit : `13cqi`, largeur 100, sections à
72 px).* Colonne du titre 605 px à 1440
(titre 78,6 px, ligne la plus longue « Chaque demande » 575 px, marge 30 px) et 467 px à 1024
(titre 60,7 px, ligne la plus longue 455 px, marge 12 px) : chaque ligne d'auteur tient sur une
ligne visuelle. `14cqi` ferait passer « Chaque demande » à ≈ 619 px à 1440, au-delà des 605 px de
la colonne : 13 est le plafond utile. À 390 px : 44,1 px, les quatre lignes tiennent chacune sur
une ligne. À 360 px : 40,6 px, « Chaque demande » se replie sur deux lignes visuelles (autorisé
sous 1024 px, § 2.2.7 ; aucun débordement). Sections (`text-statement`) : 72 px à 1440 et
59,9 px à 1024, toutes les lignes d'auteur sur une ligne visuelle ; la plus serrée est
« Ce n'est pas la prospection » (803 px, titre de la section « problème »). `/estimation` :
48 px dès 1024, chaque ligne sur une ligne visuelle (540 px dans une colonne de 624 px).
Hauteur de ligne avec et sans `.title-accent` : écart 0 px mesuré (hero 74,69 / 57,61 /
41,86 px à 1440 / 1024 / 390 ; état vide « Aucune tâche ouverte » 33,59 px à 1440 / 1024 / 390,
mot à 29,68 px).

Rapport titre / label : ≈ 7,7:1 à 1440 px (85 / 11) dans le hero, 5,8:1 dans les sections
(64 / 11) ; 4:1 sur téléphone.

#### 2.2.4 Échelle — CRM (« expressif contrôlé »)

| Token | Taille | Interlignage | Approche | Usage |
|---|---|---|---|---|
| `text-page` (nouveau) | 48 px (`3rem`) | 1,05 | `-0.025em` | `h1` de `PageHeader` **dès 1024 px** |
| `text-hero` | 42 px | 1,05 | `-0.025em` (était `-0.035em`) | `h1` de 640 à 1023 px ; grands chiffres (`.figure`) |
| `text-title` | 32 px | 1,15 | `-0.02em` | `h1` sous 640 px ; chiffres du tableau de bord |
| `text-section` | **28 px** (était 24) | 1,2 | **`-0.015em`** (était `-0.022em`) | `h2` de section hors carte, titre d'`EmptyState`, `Disclosure` en carte ; chiffre de `SituationStrip` (vérifier 390 px) |
| `text-heading` | 21 px | 1,25 | `-0.01em` (était `-0.012em`) | Titre de carte (`Card`), `Dialog` |
| `text-base` / `text-sm` / `text-xs` | 16 / 14 / 12 px | — | 0 | Corps, interface, légendes |
| `text-overline` | 11 px | 1,2 | `0.1em` (inchangé) | `.label` |

`text-display` (52 px) est **retiré** : aucun écran ne l'utilise.

**Approche des titres de section (point tranché).** `-0.015em` à 28 px : la progression reste
proportionnelle à la taille (48 → `-0.025`, 32 → `-0.02`, 28 → `-0.015`, 21 → `-0.01`). L'ancienne
valeur Geist (`-0.022em`) referme les contre-formes de Bricolage (« rn », « m ») à cette taille ;
la valeur de la galerie (`-0.01em`, celle des titres de carte) paraît lâche sous un `h1` à
`-0.025em`. Si `text-section` devait rester ponctuellement à 24 px (aucun cas prévu), même
approche `-0.015em`.

**Titres de carte (point tranché).** Bricolage 600, 21 px, `-0.01em` : à cette taille l'axe
optique la rend calme et ouverte, cohérente avec le `h1`. Pas de Geist pour les titres de carte
(deux voix pour un même rôle, c'est le défaut corrigé). Les petits titres internes (≤ 18 px)
restent en Geist (§ 2.2.2).

**Chiffres (point tranché).** Aucune nouvelle taille ni nouvelle police : Geist Mono 600
tabulaire, ce qui sépare nettement un chiffre (mono) d'un titre (Bricolage). Seul effet du lot :
le chiffre de `SituationStrip` passe de 24 à 28 px avec `text-section` (aucun débordement à
390 px, sinon le signaler).

#### 2.2.5 Le mot accentué (variante A, partout où il existe)

**Où** : le `h1` du hero, les `h2` des six autres sections de la landing, le `h1` de
`/estimation`, et **huit états vides** du CRM (§ 2.2.9). **Nulle part ailleurs** : jamais dans
un `h1` du CRM, une carte, un bouton, un label, un badge, un tableau, une alerte, un garde-fou,
un blocage, une erreur, une page introuvable, un résultat de filtre, un chiffre, une donnée.

**Règles** :

1. Un seul mot par titre, **mot entier**, présent **exactement une fois** (testé). Jamais un
   article (l'article élidé reste dehors : « l'*administratif* »), jamais un nom d'agent, un
   chiffre, « Simulation » ou une mention de garde-fou. La ponctuation reste dehors (« *main*. »).
2. **Taille calculée du titre ≥ 28 px**, à toutes les largeurs (360 px comprises). Italique
   interdit en dessous.
3. Couleur : **encre** (`--color-ink`, 17,7:1 sur blanc, 14,6:1 sur `pearl`), comme le reste
   du titre. Jamais de couleur sur le mot ; la variante B (bleu) n'est utilisée nulle part.
4. Un `span`, jamais `<em>` ni `<i>` (aucune emphase vocale ajoutée par les lecteurs d'écran).
5. Au plus deux procédés par titre : le ton (lignes d'observation en `ink-subtle`, section
   « problème » seulement) et le mot accentué. La moitié grise du hero (`titleSecondFrom`) et le
   filet cobalt sous « administratif » sont **supprimés**.
6. Au plus un titre accentué par hauteur d'écran (vrai par construction : un par section).

**Classe unique `.title-accent`** (`app/globals.css`, `@layer utilities`), utilisée par
`EditorialTitle` et `EmptyState` :

| Propriété | Valeur | Pourquoi |
|---|---|---|
| `font-family` | `var(--font-accent)` | Instrument Serif italique |
| `font-style` / `font-weight` | `italic` / `400` | Seul fichier chargé |
| `font-size` | `1.06em` (token `--accent-word-size`) | Hauteur d'x plus petite que Bricolage |
| `letter-spacing` | `-0.01em` | La serif n'a pas besoin d'être resserrée |
| `font-variation-settings` | `normal` | N'hérite pas d'un réglage de Bricolage |
| `line-height` | `0` | Les jambages de la serif ne grandissent pas la boîte de ligne |
| `display` | **`inline`** (jamais `inline-block`) | Sur un `inline-block`, `line-height: 0` écrase la boîte et décale la ligne de base. L'apparition du mot (opacité) fonctionne sur un élément `inline`. |

Critère mesuré : la ligne qui porte le mot a la **même hauteur** (écart ≤ 0,5 px) que la même
ligne rendue sans `.title-accent`, à 1440, 1024 et 390 px ; aucun glyphe italique ne touche le
caractère suivant (contrôle visuel sur « *main*. », « *s'arrête*. », « *commencer*. »).

Le mot et sa ponctuation ne doivent jamais être séparés par un retour à la ligne : le groupe
« préfixe + mot + suffixe » est enveloppé dans un `span` `white-space: nowrap` (élément
`inline`).

#### 2.2.6 Sur-titre à trait cobalt (`Overline`)

Langage d'accent de la direction artistique (§ 2 de la règle du 30/09) : un petit label mono
précédé d'un **trait cobalt de 12 × 2 px** (`--color-accent`, repère graphique, jamais du
texte), écart **10 px**, aligné au centre de la hauteur d'x du label. Exemple affiché :
`— PILOTAGE`. Le trait est un pseudo-élément (`::before`, `content: ""`) : rien n'est lu par un
lecteur d'écran. Le sur-titre est un `<p>` **hors** du titre (le nom accessible du `h1`/`h2` ne
contient jamais le sur-titre). Hors carte, il porte `.particle-veil .particle-veil-tight`
(contraste mesuré sur le fond vivant). `text-ink-subtle` : 5,7:1 sur blanc, 4,7:1 sur `pearl`
(≥ 4,5:1 exigé à 11 px).

Où : sur-titre de page des écrans du CRM (§ 2.2.9), sur-titre des sections de la landing (les
`kicker` actuels), sur-titre de `/estimation`. Pas sur la fiche contact ni sur la page
d'exécution (le fil d'Ariane joue déjà ce rôle), pas sur la politique de confidentialité.
L'étiquette inclinée du hero (« 5 agents · contrôle humain ») n'est pas un sur-titre : elle
reste telle quelle (police Geist désormais).

#### 2.2.7 Apparition ligne par ligne (site public seulement, variante C)

Le mot accentué apparaît **le premier, net** ; le reste de la phrase passe du flou au net,
**ligne d'auteur par ligne d'auteur**. Aucun mouvement mot par mot (l'ancien « ligne puis mot »
de `HeroTitle` disparaît). Rien de tout cela dans le CRM.

| Token (local à `EditorialTitle.module.css`) | Valeur |
|---|---|
| `--title-focus-blur` | `8px` (flou initial des mots non accentués) |
| `--title-focus-duration` | `640ms` par ligne ; le flou est nul à **55 %** (352 ms) |
| `--title-line-step` | `80ms` entre deux lignes ; `60ms` sous 640 px |
| `--title-line-delay` | `100ms` au chargement (hero, `/estimation`) ; `0ms` à l'entrée dans l'écran (sections) |
| Courbe des lignes | `--ease-emphasis` = `cubic-bezier(0.16, 1, 0.3, 1)` (nouveau token global, § 2.5.1) |

| Élément | État initial | État final | Propriétés | Durée, courbe | Délai |
|---|---|---|---|---|---|
| Mot non accentué (`inline-block`, le flou l'exige) | opacité 0, `translateY(0.2em)`, `blur(8px)` | opacité 1, `transform: none`, `filter: none` | `opacity`, `transform`, `filter` | 640 ms, `--ease-emphasis` | `--title-line-delay` + n° de ligne × `--title-line-step` (tous les mots d'une ligne partagent ce délai) |
| Mot accentué (`inline`) | opacité 0 | opacité 1 | `opacity` seule : **aucun flou, aucune translation** | **`--duration-base` (220 ms), `--ease-standard`** | `--title-line-delay`, quelle que soit sa ligne |

**Courbe et durée du mot net (point tranché)** : on garde ce que l'utilisateur a vu et validé,
`--duration-base` + `--ease-standard`. C'est une apparition sans déplacement, catégorie
« apparition » du § 2.5.3 ; `--ease-emphasis` reste réservée au déplacement des lignes.

Repères pour 4 lignes (hero) : mot accentué opaque à **320 ms** ; dernier flou terminé à
100 + 3 × 80 + 352 = **692 ms** ; dernière ligne posée à 100 + 240 + 640 = **980 ms**.

Règles :

- **Lignes d'auteur** déclarées dans les textes, jamais mesurées au runtime. Chaque ligne est un
  bloc. Sous 1024 px, une ligne d'auteur peut se replier sur deux lignes visuelles : elle reste
  **une** unité d'animation. Chaque ligne d'auteur porte `text-wrap: balance` (décision du
  01/10/2026, audit) : un repli ne laisse jamais un mot seul (`/estimation` à 390 et 360 px :
  « Parlez-nous / de votre bien. », « Un *conseiller* / vous répond. ») ; sans effet là où la
  ligne tient sur une ligne visuelle.
- **CSS seulement**, aucun minuteur JavaScript. Hero et `/estimation` : animation au
  chargement. Sections : déclenchées par le `Reveal` existant (`[data-reveal="entering"]`) ;
  l'état initial n'existe que sous `[data-reveal="hidden"]` (posé par JavaScript).
- **État final par défaut** (lisible sans JavaScript). L'état initial n'existe que dans
  `@media (prefers-reduced-motion: no-preference)`, jamais `opacity: 0` hors de cette requête.
- `prefers-reduced-motion: reduce` : **rien ne bouge** — aucun flou, aucune translation,
  aucune opacité intermédiaire ; le mot italique reste visible (accent durable).
- Pause du site (`<html data-landing-motion="paused">`, `MotionToggle`) : titre affiché
  directement.
- Au plus **4 lignes** animées ; au-delà le titre est statique (accent conservé).
- **Une seule fois** : `animation-fill-mode: backwards`, aucun `transform` ni `filter`
  résiduel ; un re-rendu React ne rejoue rien ; revenir sur une section ne la rejoue pas.
- Aucune action n'attend la fin : les boutons du hero sont cliquables immédiatement.
- Le `Reveal` qui contient un titre éditorial ne déplace plus son bloc : option `frame="still"`
  (§ 3). Sur-titre et introduction de la section sont simplement visibles ; seul le titre
  porte le mouvement (un seul mouvement par bloc).

#### 2.2.8 Écriture des titres

- **CRM** (règle du 26/09/2026, inchangée) : un titre porte l'idée seul, en 1 à 4 mots ; la
  description d'un `PageHeader` tient sur une ligne ou disparaît si elle répète le titre. Une
  explication devient d'abord une information visuelle (chiffre, badge, pastille, frise), puis
  seulement le texte devenu redondant est retiré. **Une action principale par écran**, visible
  sans défiler à 1440 × 900 (testé : `e2e/premier-regard.spec.ts`).
- **Site public** : titres-phrases, en lignes d'auteur (≤ 4), un mot accentué.
- **Jamais retirés** : mentions « Simulation » et « Exemple fictif — simulation »,
  consentement, désinscription, validation humaine du premier contact, mandat confirmé par un
  humain, coupe-circuit et son libellé, états d'erreur, note « Aucune donnée réelle, aucun
  envoi réel », sous-titre de `/estimation` (« aucune estimation chiffrée »).
- Aucun chiffre, pourcentage, prix ni témoignage dans un titre public
  (`components/landing-texts.test.ts`) ; aucune promesse d'estimation instantanée ni d'envoi
  automatique.

#### 2.2.9 Inventaire exact des titres

Textes centralisés : `components/landing-texts.ts` (`LANDING_TEXTS`, site public) et
`components/texts.ts` (`APP_TEXTS`, CRM et `/estimation`). Pour chaque titre éditorial, trois
clés : `titleLines` (lignes d'auteur), `titleAccent` (le mot), `title` (= `titleLines.join(" ")`,
testé, sert aux tests E2E et au nom accessible). Les textes publics gardent l'apostrophe droite
`'` (§ 6). Le mot accentué est entre astérisques ci-dessous ; `/` sépare les lignes d'auteur.

**Site public**

| Section (clé) | Composant | Balise, taille, déclenchement | Titre exact (lignes) | Mot | Sur-titre affiché |
|---|---|---|---|---|---|
| Hero (`hero`) | `LandingHero` | `h1`, `poster`, chargement | Chaque demande / vendeur avance. / Votre agence / garde la *main*. | main | aucun (étiquette inclinée conservée) |
| Problème (`problem`) | `ProblemHeading` | `h2`, `statement`, entrée | Ce n'est pas la prospection / qui freine vos mandats. / C'est l'*administratif*. — lignes 1–2 en `ink-subtle` (`titleSubtleBefore: 2`) | administratif | — LE PROBLÈME |
| Solution (`solution`) | `LandingSolution` → `LandingHeading` | `h2`, `statement`, entrée | Chaque dossier suit / le même *chemin*, / de la demande au mandat. | chemin | — LA SOLUTION |
| Agents (`agents`) | `LandingAgents` → `LandingHeading` | `h2`, `statement`, entrée | Chaque agent sait / où son travail commence. / Et où il *s'arrête*. | s'arrête | — CINQ AGENTS, CINQ PÉRIMÈTRES |
| Contrôle (`control`) | `LandingControl` → `LandingHeading` | `h2`, `statement`, entrée | L'IA prépare. / Votre équipe *décide*. | décide | — LE CONTRÔLE RESTE HUMAIN |
| Résultat (`result`) | `LandingResult` → `LandingHeading` | `h2`, `statement`, entrée | Vous ouvrez l'espace agence. / Vous savez par quoi / *commencer*. | commencer | — LE RÉSULTAT |
| Final (`final`) | `LandingFinal` → `LandingHeading` | `h2`, `statement`, entrée | Déposez une demande *fictive*. / Retrouvez-la / dans l'espace agence. | fictive | aucun (pas de `kicker` aujourd'hui) |
| `/estimation` (`APP_TEXTS.estimation`) | `app/(marketing)/estimation/page.tsx` | `h1`, `page`, chargement | Parlez-nous de votre bien. / Un *conseiller* vous répond. | conseiller | — DEMANDE D'ESTIMATION (`eyebrow` actuel) |

Conséquences de texte : `final.body` est **supprimé** (redondant avec le titre) ; `final.note`
« Prototype de démonstration. Aucune donnée réelle, aucun envoi réel. » est **conservée** ;
`hero.titleSecondFrom` et `problem.titleEmphasis` disparaissent (remplacés par `titleAccent`).
Les titres « problème », « agents » et « contrôle » ne changent pas de texte (seulement de
découpage). Le sous-titre de `/estimation` et les textes de consentement ne changent pas. Les
titres internes des scènes (`SceneFrame`) et des cartes ne changent pas.

Mises en page touchées (et seulement elles) : `LandingHeading` — le titre peut occuper
`max-w-5xl` (l'introduction reste `max-w-2xl`) ; `ProblemHeading` — le `max-width: 21ch` du
titre est retiré (les lignes d'auteur font la mesure) ; `LandingFinal` — le panneau passe en
**une colonne** (titre, puis actions alignées à gauche, puis la note), sinon le titre n'aurait
qu'≈ 600 px.

**CRM — sur-titres de page** (affichés en capitales par CSS, stockés en casse normale ; le texte
réutilise les groupes de la navigation, aucune nouvelle chaîne)

| Écran | Fichier | `h1` | Sur-titre (source) | Affiché |
|---|---|---|---|---|
| Tableau de bord | `app/(app)/dashboard/page.tsx` | Tableau de bord | `APP_TEXTS.nav.groupPilotage` | — PILOTAGE |
| Contacts vendeurs | `app/(app)/contacts/page.tsx` | Contacts vendeurs | `nav.groupPilotage` | — PILOTAGE |
| Pipeline | `app/(app)/pipeline/page.tsx` | Pipeline | `nav.groupPilotage` | — PILOTAGE |
| Tâches | `app/(app)/taches/page.tsx` | Tâches | `nav.groupPilotage` | — PILOTAGE |
| Rendez-vous | `app/(app)/rendez-vous/page.tsx` | Rendez-vous d’estimation | `nav.groupPilotage` | — PILOTAGE |
| Agents IA | `app/(app)/agents-ia/page.tsx` | Agents IA | `nav.agentsOverview` | — VUE D’ENSEMBLE |
| Leads entrants | `app/(app)/agents-ia/leads-entrants/page.tsx` | Leads entrants | `nav.groupAgents` | — AGENTS IA |
| Messages à valider | `app/(app)/agents-ia/a-valider/page.tsx` | Messages à valider | `nav.groupAgents` | — AGENTS IA |
| Relances Emma | `app/(app)/agents-ia/relances/page.tsx` | Relances Emma | `nav.groupAgents` | — AGENTS IA |
| Suivi des rendez-vous | `app/(app)/agents-ia/suivi-rendez-vous/page.tsx` | Suivi des rendez-vous | `nav.groupAgents` | — AGENTS IA |
| Paramètres | `app/(app)/parametres/page.tsx` | Paramètres | `nav.groupSettings` | — RÉGLAGES |
| Fiche contact | `app/(app)/contacts/[id]/page.tsx` | nom du contact | aucun (fil d'Ariane) | — |
| Exécution d'un agent | `app/(app)/agents-ia/executions/[runId]/page.tsx` | Exécution de {agent} | aucun (fil d'Ariane) | — |
| Politique de confidentialité | `app/(marketing)/politique-confidentialite/page.tsx` | inchangé | aucun | — |
| Connexion, inscription | `app/(auth)/…/page.tsx` | inchangés (`h1` `text-title` 600, Bricolage par la règle de base ; retirer `tracking-tight`, l'approche vient du token) | aucun | — |

Les `loading.tsx` de ces écrans réservent la ligne du sur-titre (un `Skeleton` de 11 px de haut,
≈ 6 rem de large, au-dessus de celui du titre) pour que rien ne saute à l'arrivée du contenu.

**CRM — états vides qui reçoivent le mot italique** (texte inchangé ; nouvelle clé d'accent à
côté du titre, ex. `emptyTitleAccent`)

| Écran | Appel | Titre exact | Mot |
|---|---|---|---|
| Messages à valider | `PendingMessagesList` (`validationQueue.emptyTitle`) | Aucun message en *attente* | attente |
| Leads entrants | `leads-entrants/page.tsx` (`leadsInbox.emptyTitle`) | Aucun lead *entrant* | entrant |
| Relances Emma | `relances/page.tsx` (`emmaFollowUps.emptyTitle`) | Aucun dossier à *relancer* | relancer |
| Suivi des rendez-vous | `suivi-rendez-vous/page.tsx` (`followThrough.emptyTitle`) | Aucun rendez-vous à *suivre* | suivre |
| Contacts vendeurs et Pipeline | `contacts/page.tsx`, `pipeline/page.tsx` (`contacts.emptyTitle`) | Aucun *contact* pour l’instant | contact |
| Tâches, vue « Toutes » | `taches/page.tsx` (`tasks.emptyTitles.all`) | Aucune tâche *ouverte* | ouverte |
| Rendez-vous, vue « À venir » | `rendez-vous/page.tsx` (`appointments.emptyTitles.upcoming`) | Aucun rendez-vous à *venir* | venir |
| Agents IA, dossier sélectionné | `SelectedDossierCard` (`dossierJourney.emptyTitle`) | Aucun dossier *traité* pour l’instant | traité |

**Sans** mot italique (titre en `text-section` quand même, pour que tous les états vides aient
la même taille) : tâches « En retard » et « Les miennes », rendez-vous « Passés » (résultats de
filtre), « Cette page est vide » (tâches, rendez-vous), « Aucune exécution ne correspond »
(filtre), « Aucun événement pour ce contact » (historique), « Contact introuvable. » et « Page
introuvable » (erreurs de navigation).

#### 2.2.10 Critères de contrôle (audit de fin de lot)

1. **Aucune requête** vers `fonts.googleapis.com` ni `fonts.gstatic.com` sur `/`,
   `/estimation`, `/dashboard` (onglet réseau / écoute Playwright) ; `npm run build` réussit ;
   aucune occurrence de `--font-inter` ni de l'import `Inter` dans `app/` et `components/`.
2. **Familles calculées** : `h1`/`h2` en Bricolage, `body` en Geist, `.figure` et
   `.label-mono` en Geist Mono, `.title-accent` en Instrument Serif italique 400 ; aucun titre
   de 18 px ou moins en Bricolage.
3. **Graisses** : 600 sur tous les titres (aucun 700/800 calculé sur un `h1`–`h4`).
4. **Contraste** : titres `ink` ≥ 14,6:1 (pire cas `pearl`) ; lignes d'observation `ink-subtle`
   ≥ 4,7:1 ; sur-titres mono `ink-subtle` 11 px ≥ 4,5:1 sur leur fond réel, voile compris
   (re-mesure par `e2e/voiles-lisibilite.spec.ts`, minimum actuel 5,41:1).
5. **Débordement** : `scrollWidth ≤ clientWidth` du document et de chaque titre à 1440, 1024,
   390 et 360 px sur `/`, `/estimation`, `/dashboard`, `/contacts`, `/agents-ia/a-valider`
   (avec et sans messages), `/taches` (vide) ; à 1440 et 1024 px, chaque ligne d'auteur de la
   landing et de `/estimation` tient sur une ligne visuelle.
6. **Hauteur de ligne** : écart ≤ 0,5 px entre la ligne qui porte le mot italique et la même
   ligne sans `.title-accent` (hero 1440/1024/390, état vide 1440/390).
7. **Taille minimale** : `font-size` calculée de tout `.title-accent` ≥ 28 px, 360 px compris.
8. **Mouvement réduit** (et JavaScript désactivé, et pause du site) : à l'instant 0, sans
   attente, chaque mot a `opacity: 1`, `transform: none`, `filter: none`.
9. **Rythme** (mouvement autorisé) : mot accentué opaque ≤ 320 ms après le chargement du hero ;
   plus aucun flou à 700 ms ; dernière ligne posée ≤ 1 s ; rien ne se rejoue au retour sur une
   section ; boutons du hero cliquables immédiatement.
10. **Structure** : un seul `h1` par page ; nom accessible de chaque titre éditorial = la
    phrase exacte (`title`), lu une fois (copie `sr-only` + rendu `aria-hidden`) ; aucun `<em>`
    ; le sur-titre n'entre pas dans le nom du titre.
11. **CRM** : `h1` 48 px dès 1024, 42 px de 640 à 1023, 32 px dessous, graisse 600 ; `h2` de
    section 28 px ; titres de carte 21 px ; sur-titre exact sur les onze écrans listés, absent
    des quatre autres ; aucun italique hors des huit états vides ; aucune variante B ni C,
    aucune apparition ligne par ligne.
12. **Premier regard** : `e2e/premier-regard.spec.ts` passe (action principale visible sans
    défiler à 1440 × 900, malgré le sur-titre et le `h1` plus grand).
13. **Garde-fous** : « Simulation », « Exemple fictif — simulation », note finale, sous-titre de
    `/estimation`, textes de consentement présents et inchangés ; aucun chiffre ajouté.

#### 2.2.11 Tokens `@theme` à jour (récapitulatif pour `app/globals.css`)

```css
--font-sans: var(--font-geist), ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif;
--font-display: var(--font-bricolage), var(--font-geist), ui-sans-serif, system-ui, sans-serif;
--font-accent: var(--font-instrument-serif), ui-serif, Georgia, serif;
--font-mono: var(--font-geist-mono), ui-monospace, "SF Mono", "Cascadia Mono", "Segoe UI Mono", Menlo, monospace;

--text-poster: clamp(2.5rem, 1rem + 7.2vw, 7.5rem);
--text-poster--line-height: 0.95;
--text-poster--letter-spacing: -0.035em;
/* Hero : min(var(--text-poster), 14cqi) + font-variation-settings: "wdth" 92, dans
   EditorialTitle.module.css (.poster), décision du 01/10/2026 */
--text-statement: clamp(2.25rem, 1.25rem + 3.9vw, 4rem); /* 64 px max, décision du 01/10/2026 */
--text-statement--line-height: 1;
--text-statement--letter-spacing: -0.03em;
--text-lede: clamp(1.0625rem, 1rem + 0.3vw, 1.25rem);
--text-lede--line-height: 1.55;
--text-page: 3rem;
--text-page--line-height: 1.05;
--text-page--letter-spacing: -0.025em;
--text-hero: 2.625rem;              /* line-height 1.05 inchangé */
--text-hero--letter-spacing: -0.025em;
--text-title: 2rem;                 /* inchangé : 1.15, -0.02em */
--text-section: 1.75rem;
--text-section--line-height: 1.2;
--text-section--letter-spacing: -0.015em;
--text-heading: 1.3125rem;          /* line-height 1.25 inchangé */
--text-heading--letter-spacing: -0.01em;
/* --text-display supprimé ; --text-overline inchangé. */

--accent-word-size: 1.06em;
--ease-emphasis: cubic-bezier(0.16, 1, 0.3, 1);
```

Hors `@theme`, dans `@layer utilities` : `.label` (inchangé, Geist par `--font-sans`),
`.label-mono` (nouveau), `.title-accent` (nouveau, § 2.2.5).

### 2.3 Rayons

`--radius-xs` 6 px (focus, petits liens) · `sm` 8 px (squelettes) · `md` 12 px
(champs, alertes) · `lg` 16 px (encarts) · `xl` 24 px (cartes) · `2xl` 32 px.
Boutons et badges : `rounded-full`.

### 2.4 Ombres

| Token | Usage |
|---|---|
| `shadow-subtle` | Cartes, boutons au repos |
| `shadow-raised` | Panneau de connexion, tableau flottant |
| `shadow-overlay` | Éléments superposés : `Dialog`, pastille de confirmation du pipeline |

### 2.5 Mouvement

Le mouvement sert deux choses, et rien d'autre : la **finition perçue** et la
**lisibilité d'un changement d'état**. Une animation qui ne sert ni l'une ni l'autre
n'est pas ajoutée. Plan de travail associé : `docs/plans/2026-09-18-animations.md`.

#### 2.5.1 Tokens réels et quand les utiliser

Ces six tokens existent dans `@theme` (`app/globals.css`). Aucun autre. (`--ease-emphasis` ajouté le 01/10/2026.)

| Token | Valeur | Utilitaire | Quand l'utiliser |
|---|---|---|---|
| `--duration-fast` | 150 ms | `duration-150` | Réaction directe au doigt ou au clavier : survol, pression, focus, changement de fond d'une ligne de tableau |
| `--duration-base` | 220 ms | `duration-200` | Apparition d'un élément dans un écran déjà affiché : alerte, panneau de confirmation, étape de rejeu |
| `--duration-slow` | 300 ms | `duration-300` | Entrée d'une section entière au chargement : en-tête de page, carte, tableau, état vide |
| `--ease-standard` | `cubic-bezier(.22,.61,.36,1)` | `ease-standard` | **Toute entrée** : l'élément démarre vite puis se pose. C'est la courbe par défaut du projet |
| `--ease-exit` | `cubic-bezier(.4,0,1,1)` | `ease-exit` | **Toute sortie** : l'élément part et accélère. Token disponible, **aucun composant ne l'utilise encore** |
| `--ease-emphasis` | `cubic-bezier(0.16, 1, 0.3, 1)` | `ease-emphasis` | **Uniquement** l'apparition ligne par ligne des titres éditoriaux du site public (`EditorialTitle`, § 2.2.7), le resserrement du cadre de mise au point, à l'entrée comme au rejeu au survol (§ 2.11.2) : rapide puis se pose longuement. *(Le glissement du cadre du wordmark a disparu avec lui le 02/10, § 2.11.3.)* Jamais dans le CRM, jamais pour une réaction à une action |
| `--ease-draw` *(nouveau, lot landing-motion, à créer)* | `cubic-bezier(0.65, 0, 0.35, 1)` | `ease-draw` | **Uniquement** un trait qui se dessine (trait sous le mot accentué, § 2.11.2) : départ et arrivée doux, comme un geste de stylo. Jamais pour une entrée ni une sortie |

> Tailwind v4 n'expose pas d'espace de noms `--duration-*` : on utilise l'utilitaire
> numérique correspondant, dont la valeur **est** celle du token. Les courbes, elles,
> sont bien exposées (`ease-standard`, `ease-exit`).

Règle simple : au doute, prendre la durée **inférieure**. Une interface de travail
utilisée toute la journée doit paraître instantanée, pas cinématographique.

#### 2.5.2 Animations nommées disponibles

| Utilitaire | Ce qu'il anime | Durée | Où il est utilisé aujourd'hui |
|---|---|---|---|
| `animate-rise` | Opacité 0 → 1 et translation de 8 px vers le haut | `--duration-slow` | `PageHeader`, `EmptyState`, `ContactsTable`, écran de connexion, accueil public |
| `animate-fade` | Opacité 0 → 1, sans déplacement | `--duration-base` | `Alert`, étape de rejeu, formulaire de refus |
| `animate-shimmer` | Position d'un dégradé de fond | 1,4 s, en boucle | `Skeleton` uniquement |
| `animate-spin-slow` | Rotation | 700 ms, en boucle | Token conservé, **plus utilisé** : le chargement est désormais `ThreeDotLoader` (§ 2.5.7) |
| `animate-pulse` (Tailwind) | Opacité, en boucle | Tailwind | Étape de rejeu **en cours** : indicateur d'activité, jamais une mesure d'avancement |

Également disponibles : `animate-rise-soft` (4 px, 220 ms), `animate-settle`
(`scale(.98)` vers l'état final, 220 ms), `.stagger` et `Reveal` — ces deux derniers
suivent désormais la règle « arrivée des cartes » du § 2.5.7 (12 px, 550 ms, pas de
110 ms plafonné). `Reveal` utilise `IntersectionObserver` sans jamais retirer les
enfants du HTML ; sans JavaScript, sans API disponible ou avec un mouvement réduit,
le contenu reste immédiatement visible.

#### 2.5.3 Inventaire des mouvements autorisés

Rien en dehors de cette liste. Pour chaque catégorie : ce qu'on anime, l'amplitude
maximale, la durée, un écran concerné.

| Catégorie | On anime | Amplitude max | Durée | Exemple |
|---|---|---|---|---|
| Entrée de page ou de section | Opacité + translation verticale | 8 px | `--duration-slow` | En-tête de la liste des contacts (`PageHeader`) |
| Apparition d'une alerte ou d'une confirmation | Opacité seule | aucune translation | `--duration-base` | `Alert` d'erreur après une action ; panneau de confirmation du coupe-circuit |
| Arrivée des cartes (`.stagger`, `Reveal`) | Opacité + translation verticale | 12 px ; pas de 110 ms, plafonné à 5 pas | 550 ms par carte | File « à valider », leads entrants, relances, suivi des rendez-vous, fiche contact, « À faire maintenant » |
| Survol ou pression d'un bouton | Fond, bordure, ombre, `translate`, `scale` | élévation 2 px ; pression `translateY(1px) scale(.97)` | `--duration-fast` | `Button`, `ButtonLink` (§ 2.5.7) |
| Survol d'une ligne ou d'un lien | Fond, texte, bordure | aucune | `--duration-fast` | Lignes de `ContactsTable` et `AgentRunsList`, liens de `AppNav` |
| Micro-interactions d'état réel | Voir § 2.5.7 | — | — | Badge « Simulation », chargement, attente de validation, erreur |
| Champ de formulaire | Couleur de bordure (et ombre pour `Field`) | aucune | `--duration-fast` | `Field`, `Select`, `Textarea`. **L'anneau de focus global (`:focus-visible`), lui, n'est jamais animé** : il apparaît instantanément |
| Passage squelette → contenu | Scintillement du squelette, puis entrée du contenu | 8 px | 1,4 s en boucle, puis `--duration-slow` | `app/(app)/contacts/loading.tsx` puis la liste réelle |
| Ouverture d'une fenêtre de confirmation (`Dialog`) | Opacité + `scale(.98)` → `scale(1)` (`animate-settle`), fond flouté fixe | `scale(0.98)` | `--duration-base` | Confirmation du mandat signé (pipeline) |
| Ouverture d'un panneau ancré ou d'une pastille de confirmation | Opacité + translation de 4 px (`animate-rise-soft`) | 4 px | `--duration-base` | Liste « Changer d'étape » dépliée dans la carte, pastille « dossier déplacé » du pipeline |
| Apparition d'un titre éditorial (site public seulement) | Lignes : opacité + `translateY(0.2em)` + `filter: blur(8px)` → net ; mot accentué : opacité seule | 0,2 em ; flou 8 px ; ≤ 4 lignes ; une seule fois | 640 ms par ligne, pas de 80 ms (60 ms sous 640 px), `--ease-emphasis` ; mot accentué `--duration-base` | `h1` du hero, `h2` des sections, `h1` de `/estimation` (§ 2.2.7) |
| Effet du mot accentué (landing seulement, lot landing-motion) | Trait : `clip-path` ; cadre : opacité + `scale` ; reste du titre : `filter: blur()` tenu puis relâché | trait ≤ 0,05 em ; cadre `scale(1.28)` → 1 ; flou 5 px (3 px < 640 px) ; une seule fois à l'entrée ; **rejeu au survol** (pointeur fin, mouvement autorisé, ≥ 800 ms après le rejeu précédent) | entrée ≤ 2,5 s ; rejeu ≤ 1,4 s (§ 2.11.2) | Les **sept** titres de `/` : `h1` du hero, `h2` problème, solution, agents, contrôle, résultat, final |
| ~~Wordmark « Ascend »~~ | **Retiré le 02/10/2026** (§ 2.11.3) | — | — | — |
| Réseau neuronal 3D (landing, lot landing-motion, révisé 02/10 — référence utilisateur ; composition centrée, bords atténués — finition 02/10) | Canvas 2D : impulsions le long des fibres, cœurs qui s'illuminent ; caméra qui pivote avec le défilement | lacet ± 0,16 rad, tangage ± 0,055 rad sur toute la page | séquence d'arrivée ≤ 4,8 s ; de section ≤ 3,8 s, une fois chacune ; caméra posée < 1,2 s après le geste ; puis immobile (§ 2.11.4) | Fond de `/` |
| Changement d'état d'une carte (brouillon validé ou refusé) | Opacité, et légère mise à l'échelle | `scale(0.98)` → `scale(1)` | `--duration-base` | File « à valider » *(écran livré ; variante `settle` encore attendue en phase 1)* |

#### 2.5.4 Interdits

1. **Jamais d'animation sur une propriété qui recalcule la mise en page.**
   Interdits : `height`, `width`, `margin`, `padding`, `top`, `left`, `font-size`.
   Autorisés : `opacity`, `transform`, et les propriétés de peinture pure
   (`background-color`, `color`, `border-color`, `box-shadow`). Seule exception pour
   `filter: blur()` : l'apparition des titres éditoriaux du site public (§ 2.2.7), < 1 s, une fois ;
   et la mise au point des titres « problème » et final de la landing (§ 2.11.2), flou tenu
   ≤ 1,9 s, terminé ≤ 2,5 s, une fois.
2. **Jamais d'animation qui retarde une action ou masque une erreur.** Un bouton est
   cliquable dès qu'il est affiché. Un message d'erreur n'attend aucune animation :
   il apparaît en opacité, immédiatement.
3. **Jamais de fausse progression.** Règle déjà posée pour le rejeu au § 3.1 :
   « Le rejeu ne ment pas sur le rythme. […] Pas de fausse barre de progression, pas
   de durée arrondie, pas de pause décorative. » Elle vaut pour toute l'interface :
   pas de compteur qui défile jusqu'à sa valeur, pas de barre qui se remplit sans
   mesure réelle derrière.
4. **Jamais d'animation infinie hors indicateur d'état réel.** Seuls tournent en
   boucle : `animate-shimmer` (squelette), `animate-pulse` (étape de rejeu en cours),
   `ThreeDotLoader` (requête en vol), `PendingDots` (attente d'une décision humaine)
   et `SimulationBadge` (rappel permanent qu'une action est simulée). Les particules
   décoratives (`components/motion/`, § 2.5.8) suivent leurs propres règles
   (`docs/plans/2026-09-23-particles-spec.md`). Rien d'autre.
   Les icônes (§ 2.8) ne bouclent jamais : histoire jouée une fois, et la grande variante
   respire deux fois puis se pose (< 5 s).
   **Landing publique (lot landing-motion, § 2.11.1) : aucune exception.** Rien n'y tourne en
   boucle, pas même le badge « Simulation » (un cycle, puis immobile) ; tout mouvement
   automatique se termine en moins de 5 s après son départ.
5. **Jamais le mouvement comme seul porteur d'information.** C'est le corollaire de
   la règle noir et blanc (§ 1) : ce qu'une animation raconte doit aussi être écrit
   en toutes lettres, ou annoncé dans une zone `aria-live`.
6. **Jamais de valeur de durée ou de courbe en dur** dans un composant : les tokens
   du § 2.5.1 existent pour ça.

#### 2.5.5 `prefers-reduced-motion`

`app/globals.css` ramène toutes les animations et transitions à 0,01 ms et coupe le
défilement fluide quand le réglage système est actif.

**Ce qui reste** : l'information, le changement d'état, et l'élément lui-même —
affiché immédiatement, dans son état final. Un composant qui pilote son animation en
JavaScript doit lire le réglage et se passer de tout minuteur (`AgentRunReplay` le
fait déjà : § 3.1, règle 2).

**Ce qui disparaît** : l'entrée progressive, l'échelonnement, le scintillement du
squelette, le retour de pression.

**Règle d'or** : l'interface doit être **entièrement utilisable et testable sans
aucune animation**. Un test Playwright ne doit jamais attendre la fin d'une
animation pour trouver un élément.

**Exception assumée** : le rejeu d'une exécution d'agent n'utilise aucune durée de
token. Ses délais sont les durées réellement mesurées par le serveur (voir § 3.1).

#### 2.5.6 Checklist de revue d'un écran animé

À appliquer avant de livrer.

1. Chaque durée et chaque courbe vient d'un token du § 2.5.1 — aucune valeur en dur.
2. Chaque mouvement entre dans une catégorie du § 2.5.3 — sinon il est retiré.
3. Seules `opacity` et `transform` bougent ; rien ne décale la mise en page.
4. Avec `prefers-reduced-motion` actif, l'écran est complet, lisible et utilisable.
5. Aucun contenu n'est rendu conditionnellement à la fin d'une animation.
6. L'anneau de focus reste visible et instantané ; l'ordre de tabulation est inchangé.
7. Les tests Playwright du parcours passent sans attente liée à une animation.

#### 2.5.7 Micro-interactions d'état réel

Source : `docs/plans/2026-09-23-particles-spec.md` § 2 (fait foi). Styles partagés dans
`components/ui/micro-interactions.css` (importé une fois par `app/globals.css`) : CSS
pur, aucun minuteur JavaScript, aucune mise à jour React par image. **Chaque
animation correspond à un état réellement rendu** ; aucune n'est jouée pour suggérer
une activité qui n'existe pas.

| Composant | Quand | Mouvement | Accessibilité |
|---|---|---|---|
| `SimulationBadge` | Toute action, tout message, toute exécution simulée | Pilule noire, texte blanc. Oscillation verticale 1 px → -2 px, 3 s, `ease-in-out`, infinie ; point blanc pulsant 2 s (opacité .55 → 1, halo 0 → 4 px à 7 %). Ne grossit jamais | Reste un badge : ni focusable, ni cliquable ; texte « Simulation » toujours écrit |
| `ThreeDotLoader` | **Uniquement** pendant une vraie opération asynchrone (server action en vol) | Trois boules à 120°, opacités 1 / .6 / .3, un tour en 1,7 s. `size="sm"` dans un bouton (via `Button isLoading`), `md` pour une zone | Sans `label` : décoratif (`aria-hidden`), le `Button` porte `aria-busy` et son texte (« Simulation en cours… », « Action en cours… »). Avec `label` : `role="status"`, annoncé une fois |
| `PendingDots` | **Uniquement** l'attente passive d'une décision humaine (brouillon « À valider », revue en attente dans l'historique) | Trois points qui rebondissent l'un après l'autre, boucle 1,5 s, décalage .16 s, amplitude 5 px | Libellé « En attente de validation » par défaut ; `label={null}` quand le texte voisin (badge, ligne d'historique) le dit déjà. Masqué dès qu'une décision est réellement en cours d'enregistrement |
| `AnimatedErrorState` (+ `ErrorDots`) | Échec d'une action | Le chargement s'arrête ; trois points `--color-danger` sur pastille blanche, **une seule** secousse horizontale de .45 s (5 px max), puis immobiles | `Alert tone="error"` (`role="alert"`), titre et message écrits : jamais la couleur seule. « Réessayer » seulement si `onRetry` est fourni |
| `Button` | Toujours | Transition 150 ms. Survol (pointeur capable) : élévation 2 px + `shadow-raised` ; pression : `translateY(1px) scale(.97)`. Propriétés individuelles `translate`/`scale` : les voisins ne bougent jamais | Désactivé : ni survol, ni pression, ni mouvement (`pointer-events: none`). En chargement : désactivé mais **pas estompé** (le libellé reste lisible). Focus visible inchangé |
| `.stagger` / `Reveal` | Arrivée du contenu (montage de l'élément) | Fondu + 12 px vers le haut, 550 ms, pas de 110 ms (`--stagger-step`) entre les premières cartes, plafonné à 5 pas | `animation-fill-mode: backwards` : une fois arrivée, la carte ne garde **aucun** `transform` ni contexte d'empilement (les menus ancrés ne sont jamais recouverts par la carte suivante). Un re-rendu React ou une saisie ne rejoue rien |

**Règles d'usage (non négociables)**

1. **Aucun délai artificiel.** Le loader apparaît au lancement de la requête et
   disparaît à sa réponse (succès ou erreur), jamais plus tard.
2. **Pas de double soumission.** Toute action déclenchée par un clic passe par
   `useSingleFlight()` (`components/ui/use-single-flight.ts`) : un second clic arrivé
   avant le re-rendu est ignoré. Le bouton est en plus désactivé par `isLoading`.
3. **« Réessayer » uniquement pour une erreur technique relançable** :
   `isRetryableErrorCode(code)` (`components/ui/retryable.ts`) — `unexpected_error`,
   `ai_provider_unavailable`, `ai_response_invalid`, échecs de lecture/écriture
   (`*_read_failed`, `*_write_failed`, `*_insert_failed`, `*_update_failed`) ou
   exception réseau. **Jamais** pour un garde-fou (coupe-circuit, consentement,
   reprise en main, mandat signé…), une règle métier (déjà fait, introuvable,
   `validation_failed`) : ces refus échoueraient de nouveau. Les refus de garde-fou
   restent affichés par `GuardRailNotice` (information neutre, § 3.1). Le retry relance
   **exactement la même opération** ; le serveur revérifie tout.
4. **`aria-busy`** sur la zone réellement occupée (carte, panneau, formulaire) pendant
   la requête, retiré à la réponse.
5. **Points d'attente ≠ chargement.** `PendingDots` ne s'emploie jamais pour un
   traitement ; `ThreeDotLoader` jamais pour une attente humaine.
6. **`prefers-reduced-motion`** : badge, point, loader, points d'attente, secousse et
   arrivée des cartes sont coupés (`animation: none`) ; les libellés restent. Le
   bouton ne bouge plus au survol ni à la pression.

#### 2.5.8 Particules en fond de page (espace connecté)

Source : `docs/plans/2026-09-23-particles-spec.md` § 5, § 6 et **§ 9** (fait foi). Moteur :
`components/motion/` (`ParticleEngine`, `ParticleScene`, six formes).

**Intégration.** Un seul canvas pour tout l'espace connecté, rendu par `RouteParticles`
dans `app/(app)/layout.tsx`. Ce layout persiste d'une page à l'autre : le canvas et son
moteur ne sont **jamais remontés** à la navigation (une seule boucle
`requestAnimationFrame`, y compris en Strict Mode). Le site public (`/`, `/estimation`,
`/connexion`, `/inscription`) n'a **aucun** canvas.

**Ordre de peinture.** Le dégradé perle (`.app-canvas`) est posé sur l'enveloppe du
layout, qui ne crée pas de contexte d'empilement ; le canvas (`position: fixed`,
`inset: 0`, `z-index: 0`, `pointer-events: none`, `aria-hidden`) se peint au-dessus ;
`<main>`, plus loin dans l'arbre, positionné sans `z-index`, se peint au-dessus du canvas
**sans** enfermer les menus des pages dans son propre contexte ; la navigation garde son
`z-40`. Le canvas est hors flux : aucun décalage de mise en page.

**Forme par route** (`components/motion/route-presets.ts`, préfixe le plus précis d'abord) :

| Route | Forme |
|---|---|
| `/dashboard` | voile |
| `/contacts`, `/contacts/[id]` | sphère — ouvrir une fiche depuis la liste n'est pas un changement de lieu : aucune transformation |
| `/pipeline` | courant |
| `/agents-ia` et ses sous-écrans `leads-entrants`, `relances`, `suivi-rendez-vous`, `executions/[id]` | agents (quatre formes) — règle : **un sous-écran garde la forme de sa section** |
| `/agents-ia/a-valider` | vortex / relief (seule exception, forme propre) |
| `/parametres` | grille |
| `/taches`, `/rendez-vous`, toute nouvelle route de premier niveau | voile — règle : **un écran de premier niveau sans forme propre reprend le voile du tableau de bord** |

Aucune autre forme n'est inventée.

**Transitions.** Déclenchées uniquement par le changement effectif de chemin
(`usePathname` : menu, liens, précédent / suivant du navigateur), jamais par une minuterie.
850 ms (bornées à 700–1 000 ms), dispersion légère puis recomposition, depuis les
positions **affichées** : une navigation rapide repart de ce qui est à l'écran vers la
dernière destination, sans flash ni canvas vide. La navigation n'attend jamais la
transition (le moteur enregistre seulement la demande). Une navigation interrompue ne
crée pas d'entrée d'historique (comportement Next.js) : « précédent » revient à la
dernière page réellement affichée, et la forme suit.

**Budget** (confirmé le 23/09/2026) : 6 000 particules ≥ 1 280 px, 4 000 de 768 à 1 279 px,
1 800 sous 768 px (`devicePixelRatio` plafonné à 1,5). Opacités **.10 à .46** depuis le
26/09/2026 (avant : .08 à .35, +30 %). Densité adaptative : −25 % par palier si une image
coûte plus de 8 ms en moyenne sur 2 s (mesuré à 1440 × 900 : 1,1 à 1,7 ms par image).

**Profondeur** (26/09/2026, `components/motion/engine/depth.ts`, mode fond seulement ;
les aperçus en zone sont inchangés) : chaque particule appartient une fois pour toutes à
un plan, tiré d'un générateur à graine fixe indépendant des graines de forme.

| Plan | Part | Taille | Opacité | Dérive |
|---|---|---|---|---|
| Lointain | 40 % | × 0,75 | × 0,65 | × 0,3 |
| Intermédiaire | 35 % | × 1 | × 0,85 | × 0,6 |
| Proche | 25 % | × 1,5 | × 1 (atteint .46) | × 1 |

Parallaxe : les trois plans suivent la même dérive lente (sinus, une oscillation ≈ 1 min),
12 px d'amplitude pour le plan proche, proportionnelle à la dérive pour les autres ; la
marge de cadrage augmente d'autant (aucun point coupé, testé). Encre totale (opacité ×
surface) : **≈ +30 %** par rapport au rendu plat .08–.35 (test : entre +20 et +45 %).
Aucune allocation par image. Mouvement réduit : temps figé, donc dérive figée.

**Placement** (`components/motion/background-layout.ts`, zone normalisée du canvas) :

Depuis le 26/09/2026, la forme couvre **toute la fenêtre** sur les trois classes (région
`0 → 1` en x et en y) ; seule l'intensité varie : bureau 1, tablette .9, mobile .75. Le
masque latéral `.app-particles` est **supprimé** : le fond se voit aussi à gauche, sous
la navigation translucide.

**Lisibilité — cartes opaques et voile local, jamais de transparence sur les cartes.**
1. Les cartes restent blanches et opaques : la forme ne passe jamais sous un texte de carte.
2. `.particle-veil` (sur un bloc de texte) : pastille blanche à 90 %, bords fondus
   (3 rem × 1,25 rem), sous **chaque bloc de texte posé hors carte**. Le canvas est fixe
   et la page défile : n'importe quel texte hors carte peut passer sur la forme. Sur le
   fond blanc et perle la pastille est invisible ; elle n'efface que les particules.
   Appliquée par : `PageHeader` (lien de retour, titre, description, badges),
   `ListTotal`, le résumé de `Pagination`, l'en-tête « À faire maintenant » du tableau de
   bord, l'en-tête « Les cinq agents » d'Agents IA, l'en-tête « Agents IA » des
   paramètres, la légende « perdu » du pipeline. **Tout nouveau texte hors carte doit
   la recevoir.** Dans une carte, elle serait blanc sur blanc : sans effet.
3. `.particle-veil-tight` (26/09/2026, **en plus** de `.particle-veil`) : même blanc à
   90 %, même bord fondu, mais un débord de **0,5 rem × 0,375 rem** seulement, pour un
   texte posé à moins de 0,75 rem d'un élément que le voile ne doit pas couvrir.
   Rappel d'ordre de peinture : un voile peint **après** un voisin le recouvre ; il ne
   recouvre jamais ses propres enfants. Le bloc voilé est dimensionné aux mots
   (`w-fit`, ou un `inline-block` intérieur quand le bloc porte un espacement), jamais
   à la colonne. Appliqué par : les en-têtes des colonnes du pipeline (« Étape n sur
   6 », nom, nombre, « dossiers ») et « Confirmé par un humain » — la colonne voisine
   et sa ligne de liaison restent intactes, testé dans `e2e/voiles-lisibilite.spec.ts`
   —, les libellés de la carte des étapes, le titre « Situation immédiate » et la note
   de période d'Agents IA (tuiles 0,75 rem dessous), la légende des formes de
   `/contacts`.
4. Contrôle automatique : `e2e/voiles-lisibilite.spec.ts` échoue si un texte visible de
   `<main>` n'est ni sur une surface opaque ni sous un voile (1 440 et 390 px, onze
   écrans).
5. En-tête mobile et colonne de navigation (`.panel-blur`, 78 %) : « Prototype » est en
   `ink-muted` (le flou des particules descendait `ink-subtle` à 4,56:1 à 390 px).

Contraste mesuré le 23/09/2026 sur captures (texte masqué, pixel **le plus sombre**
sous chaque ligne de texte hors carte, 3 instants × 3 positions de défilement, 1 440 /
1 280 / 1 024 / 768 / 390 px, 11 écrans) : minimum **5,24:1** (AA : 4,5:1).

Re-mesuré le 26/09/2026 avec les opacités .10–.46 (même méthode, 3 instants animés ×
4 positions de défilement, 1 440 × 900 et 390 × 844, `/pipeline` — aussi défilé jusqu'à
« Mandat signé » —, `/agents-ia`, `/contacts`, `/parametres`, `/dashboard`) : minimum
**5,41:1** au pixel le plus sombre, aucun texte sous 4,5:1. Avant le voile serré :
« dossiers » 3,46:1, « Confirmé par un humain » 4,23:1, note de période 4,70:1,
« Prototype » (390 px) 4,56:1.

**Mouvement réduit.** Une image statique représentative par page (instant `staticTime`
de chaque forme), changement de forme instantané, aucune boucle `requestAnimationFrame`
(`data-motion="reduced"`).

**Honnêteté.** Le fond est un décor. Il ne lit **aucun** état réel (agents, exécutions,
chargements), ne porte aucun libellé, ne s'accélère ni ne change quand un agent
travaille. L'état réel est dit par `ThreeDotLoader`, `PendingDots`, les badges et le texte.

**Attributs de test** sur le canvas : `data-mode`, `data-preset`, `data-count`,
`data-motion` (`running`, `transition`, `static`, `reduced`, `hidden`) et `data-frame-ms`
(coût moyen d'une image sur la dernière fenêtre de 2 s). Parcours : `e2e/particules.spec.ts`.

#### 2.5.9 Interactions des contrôles (halo, magnétisme, lettres, flèches)

Couche commune : `components/ui/interactions.css` + un seul écouteur délégué
(`PointerField`, monté une fois par layout : `(app)` et `(marketing)`), qui écrit
`--pointer-x/y` et `--magnet-x/y` dans un `requestAnimationFrame`, sans rendu React.

| Effet | Où | Conditions |
|---|---|---|
| Halo de bordure cobalt qui suit le curseur | `Button`/`ButtonLink` `primary`, `accent`, `secondary` ; `CardLink` | Souris précise + mouvement autorisé |
| Magnétisme 3–5 px (`MAGNET_MAX_PX` = 4) | Opt-in (`magnetic`) ; `ButtonLink` par défaut | Idem, et jamais désactivé/occupé |
| Lettres décalées (≤ 12 ms) | Libellé texte des `primary`/`accent` | Idem |
| Double flèche qui s'échange | `arrow`, `ArrowLink`, `CardLink` | Survol précis |
| Montée 2 px / pression 1 px | Bouton actif | `motion-safe:` |

**Jamais** de halo ni de magnétisme :
- sur un contrôle destructif (`destructive` → `data-destructive`, ni `ui-halo` ni `data-pointer`) ;
- dans une **zone sensible** marquée `data-sensitive` : connexion (`SignInForm`),
  estimation (`EstimationForm`), validation/refus/correction d'un message
  (`PendingMessageCard`), changement d'étape et mandat (`PipelineStageMenu`),
  consignation d'un rendez-vous (`SarahAppointmentCard`), coupe-circuit
  (`KillSwitchPanel`). Toute nouvelle zone de ce type doit porter l'attribut ;
- sur écran tactile, stylet, ou avec `prefers-reduced-motion: reduce` (l'écouteur ne
  démarre même pas).

L'anneau de focus cobalt reste toujours visible.

### 2.6 Utilitaires maison

- `.panel-blur` / `.panel-blur-inverse` : fond translucide + `backdrop-filter`, réservés
  aux barres fixes (navigation de l'espace connecté, en-tête du site public).
- `.app-canvas` : fond blanc, dégradé perle, halo blanc (`components/ui/micro-interactions.css`),
  posé sur l'enveloppe du layout connecté.
- `.particle-veil` : voile de lisibilité sous un texte posé sur le fond de particules (§ 2.5.8). `.app-particles` a été supprimé le 26/09/2026.
- `.particle-veil-tight` : variante serrée (débord 0,5 × 0,375 rem), toujours avec `.particle-veil`, près d'un voisin à ne pas couvrir (§ 2.5.8).
- Jamais de voile **dans** une surface déjà opaque : il y dessine un rectangle plus clair et peut déborder de la surface. `LandingHeading` accepte `veil={false}` ; seul le panneau final de la landing l'utilise (décision du 01/10/2026, audit ; titre mesuré à 17,3:1 au pixel le plus sombre du fond du panneau, sans voile, à 1440 et 390).
- `.figure` (Geist Mono, chiffres tabulaires), `.label` (étiquette Geist en capitales), `.label-mono` (étiquette Geist Mono en capitales, sur-titres) et `.title-accent` (mot accentué en Instrument Serif italique, `inline`, `line-height: 0`) : rôles typographiques du § 2.2.
- `.brand-symbol` : peint le symbole de marque avec `currentColor` à travers l'alpha du
  fichier maître, utilisé comme masque CSS (voir § 2.7).

### 2.7 Marque

**Source unique : `components/brand.ts`.** Le nom du produit n'est écrit en dur nulle
part ailleurs — ni dans un écran, ni dans un `metadata`, ni dans un test. `APP_TEXTS.brand`
ne fait que réexporter cet objet. Renommer le produit est un changement d'un seul fichier,
et un test (`components/brand.test.ts`) échoue si un ancien nom réapparaît dans les textes.

#### 2.7.1 Le symbole

Un « A » massif au sommet tronqué, dont la jambe gauche s'incurve en pied, avec une
contre-forme interne en goutte. Fichiers maîtres, dans `public/brand/` :

| Fichier | Contenu | Usage |
|---|---|---|
| `ascend-symbol-black.png` | 992 × 770, fond transparent, tracé `--color-ink` | Masque CSS de `.brand-symbol` **et** export pour fond clair |
| `ascend-symbol-white.png` | idem, tracé `--color-ink-inverse` | Export pour fond sombre (support qui ne sait pas masquer : e-mail, présentation) |

Ces deux PNG sont obtenus par **transformation mécanique** du fichier fourni par
l'agence : rampe linéaire du blanc papier vers le noir d'encre pour reconstituer le
canal alpha (l'anticrénelage des courbes est conservé), puis découpe à la boîte
englobante exacte du dessin. Aucune courbe n'a été redessinée ni vectorisée.

**Inversion automatique.** L'interface n'utilise qu'un seul fichier : `.brand-symbol`
applique l'alpha comme masque et remplit avec `currentColor`. Le symbole prend donc la
couleur du texte qui l'entoure — noir sur surface claire, blanc dans un panneau
`bg-inverse` — sans variante de composant, sans prop de thème et sans JavaScript.
Le `background-color` est confiné dans un `@supports` : là où le masquage n'existe pas,
l'élément reste vide plutôt que de peindre un rectangle noir plein.

#### 2.7.2 Le verrouillage

`Logo` = symbole + « Ascend » / « Strategy » composés **en typographie** sur deux lignes,
à sa droite. Les mots ne sont jamais une image : ils restent nets à tout zoom et suivent
la pile système. Les deux moitiés héritent de `currentColor` : `Logo` ne pose aucune
couleur, sinon il se peindrait en noir sur noir.

| Taille | Symbole | Mots | Où |
|---|---|---|---|
| `sm` (défaut) | `h-7` (28 px) | `text-xs`, `leading-tight` | Barres fixes : en-tête public, colonne de l'espace connecté, en-tête de connexion |
| `md` | `h-10` (40 px) | `text-sm`, `leading-tight` | Écrans calmes, compositions marketing |

**Zone de respiration** : au moins la hauteur du symbole de chaque côté du verrouillage.
L'écart interne symbole ↔ mots (`gap-2.5` / `gap-3`) ne se modifie pas au cas par cas.

**Tailles minimales** : symbole seul 20 px (`LogoSymbol size="sm"`) ; en dessous, la
contre-forme en goutte se referme et le dessin cesse de se lire comme une lettre.
Verrouillage complet : 28 px de symbole. Plus petit, on utilise `LogoSymbol` seul.

#### 2.7.3 Accessibilité

Un logo porte le nom du produit : il n'est **jamais** décoratif.

- `LogoSymbol` seul : `role="img"` + `aria-label` = nom du produit (valeur par défaut).
- `Logo` : le nom accessible est porté **une seule fois**, par le verrouillage entier
  (`role="img"` + `aria-label`), et le symbole y est `aria-hidden`. Sans ce rôle, le nom
  serait reconstitué à partir de deux lignes séparées et les navigateurs ne s'accordent
  pas sur l'espace entre elles (« Ascend Strategy » ou « AscendStrategy »). Le libellé
  reprend le texte visible mot pour mot (WCAG 2.5.3, *label in name*).
- `LogoSymbol label={null}` rend le symbole décoratif : à n'utiliser que lorsque le nom
  est déjà écrit juste à côté.

#### 2.7.4 Icônes de site

Conventions de fichiers de l'App Router (Next.js 16) — aucune balise `<link>` écrite à
la main, aucune entrée `icons` dans `metadata` :

| Fichier | Taille | Composition |
|---|---|---|
| `app/favicon.ico` | 16, 32, 48 | Carré `--color-ink` plein, symbole blanc centré |
| `app/icon.png` | 512 | idem |
| `app/apple-icon.png` | 180 | idem (opaque : Apple n'accepte pas la transparence) |

Le carré noir plein est un choix : un symbole transparent disparaîtrait sur une barre
d'onglets sombre. À 16 px, la contre-forme se referme partiellement — le « A » reste
reconnaissable, mais c'est la limite basse assumée du dessin.

#### 2.7.5 Le jour où un SVG arrive

Le passage au vectoriel ne doit toucher **aucun écran** : il se limite à `BRAND.symbol`
(`components/brand.ts`) et à l'URL de `.brand-symbol` (`app/globals.css`).

### 2.8 Famille d'icônes AiaA (`components/icons/`) et tuiles d'étape

Une seule famille, dessinée à la main, sans dépendance (Radix retiré le 27/09/2026),
d'après les planches `docs/references/icons/planche-1-noir-cobalt.png` (style) et
`planche-2-tuiles-verre.png` (traitement de la tuile, grande variante seulement).
Plan : `docs/plans/2026-09-27-animated-icons.md`. Contrôle : `/dev/icons` (404 en production).

- **Composant** : `<Icon name size="sm|lg" px animate dimmed />` (`Icon.tsx`), serveur-compatible,
  toujours décoratif (`aria-hidden`, `focusable="false"`) : les mots à côté portent le sens.
  `iconComponent(name)` en fait un composant pour les cartes d'icônes (rail, phases d'exécution).
  Dessins dans `definitions/` (planche en deux fichiers, agents, utilitaires), registre `icons.ts`.
- **Grille** : un seul `viewBox 0 0 24 24` (exportable tel quel en 1024 × 1024), zone utile 1,5–22,5.
- **Style** : formes **pleines et organiques** en encre (`currentColor` : noir sur clair, blanc sur
  sombre), traits épais arrondis quand la forme est un trait (anneau, crochets, curseurs), **jamais
  de contour autour d'une forme pleine**, **jamais de découpe peinte en couleur de page** (les trous
  sont de vrais trous, `evenodd`, ou un espace entre deux formes) : l'icône s'inverse proprement.
- **Trois calques** (`data-part`) : `ink` (corps) · `glass` (élément secondaire translucide, cobalt
  pâle : 2ᵉ bulle, 2ᵉ contact, sphère du deal, halo de la cible, barre en cours) · **`accent`, un
  seul par icône** (point, flèche, coche, perle). Le test unitaire vérifie un seul calque accent,
  aucune couleur en dur, aucun style en ligne.
- **Couleur de l'accent** : petite variante = `--color-accent` (cobalt) ; grande variante =
  dégradé très discret `--color-icon-indigo` #6366F1 → `--color-icon-violet` #A78BFA, **sur l'accent
  seul**. **Rouge** (`--color-danger`) : uniquement l'icône `alert` (pastille), toujours à côté d'un
  texte — la couleur ne porte jamais le sens seule. Signes utilitaires (flèches, chevrons, fermer,
  menu, coche, erreur) : tout en `currentColor`, immobiles.
- **Petite variante** (`sm`, 12–24 px ; navigation, boutons, listes, badges) : immobile au repos.
  Son **histoire** joue **une fois** au survol ou au focus clavier du contrôle parent (`a`, `button`,
  `summary`, `label`, onglet, `[data-icon-trigger]`) ou quand `animate` devient vrai (changement d'état,
  ex. tuile d'étape `active`). Jamais de boucle.
- **Grande variante** (`lg`, 48–96 px ; tuile de verre givré blanc translucide, flou 12 px, ombre
  `shadow-raised`, rayon 28 %) : **en-tête** des 7 écrans principaux (tableau de bord, contacts,
  pipeline, agents IA, rendez-vous, tâches, paramètres ; masquée sous 640 px), **cartes des agents**
  (grisée et immobile quand l'agent est en pause), **états vides**. **Nulle part ailleurs.** L'histoire
  joue à l'arrivée (× 1,6 plus lente), puis l'accent **respire deux fois et se pose** : fini en
  < 5 s (WCAG 2.2.2), sans contrôle nécessaire. Choix retenu plutôt que « boucle tant que visible »
  : pur CSS, aucun JavaScript, aucune boucle infinie (règle § 2.5.4 n° 4 respectée).
- **Histoires** (`icon-stories.css`, données seulement : `--story`, `--from-x/y/r/s/o`, `--delay`,
  propriétés enregistrées non héritées) : points des messages clignotent l'un après l'autre, coche
  des tâches et de la validation humaine tracée, perle qui tombe dans l'entonnoir du pipeline, ondes
  du téléphone, flèche de croissance qui monte, loupe qui balaie, curseurs des filtres qui glissent,
  engrenage qui tourne d'un cran (45°, il retombe sur lui-même), liens des intégrations qui se
  connectent, cloche qui se balance (notifications) / pastille rouge qui apparaît (alerte), aiguille
  des rappels qui avance, cœur de la cible qui pulse, nœud de l'agent IA qui arrive le long de son
  lien, crochets de la simulation qui se referment, perle qui parcourt le scénario d'automatisation,
  point du calendrier qui saute à la date, email qui tombe sur l'enveloppe, sphère du deal qui glisse,
  barres d'analytics qui montent, contact secondaire qui apparaît, cadre des leads qui fait la mise au
  point, case du tableau de bord qui pulse une fois. Agents : perle qui tombe dans le bac (Léa), loupe
  qui balaie le bien (Hugo), flèche de relance qui revient (Emma), aiguille du créneau posée (Louis),
  dossier envoyé plus loin (Sarah). **Transform et opacité seulement**, durées `--duration-icon`
  (420 ms), `--icon-step` (90 ms), `--duration-icon-breathe` (1 800 ms).
- **Image fixe = état final signifiant** : sans animation, chaque icône est complète et lisible.
- **Mouvement réduit** : `animation: none` sur toute icône (`icons.css`), en plus de la règle globale.
- **Tuiles d'étape `AgentAppIcon`** (`features/agents-ia/components/icons/`) : inchangées dans leur
  langage — la **forme** dit qui agit (agent carré sombre, humain cercle à double contour, issue cercle
  plein, neutre carré clair) — mais le symbole est désormais une petite icône de la famille (15 / 22 /
  30 / 38 px pour `sm` / `md` / `lg` / `xl`). `active` = anneau cobalt + histoire jouée une fois ;
  `inactive` = symbole gris et immobile.
- **Noms** : les 24 de la planche (`dashboard`, `contacts`, `leads`, `pipeline`, `deal`, `aiAgent`,
  `automation`, `messages`, `calendar`, `tasks`, `reminders`, `email`, `phone`, `humanValidation`,
  `simulation`, `analytics`, `growth`, `priority`, `alert`, `search`, `filters`, `settings`,
  `integrations`, `notifications`), les agents (`lea`, `hugo`, `emma`, `louis`, `sarah`), les étapes
  (`prospect`, `appointment`, `mandate`) et les signes (`check`, `arrowRight/Left/Down`, `chevronRight`,
  `menu`, `close`, `error`, `lock`, `clock`, `document`, `merge`, `question`, `stageMove`, `checkCircle`,
  `code`, `archive`). Anciens noms : `mail` → `email`, `human` → `humanValidation`, `network` → `aiAgent`.

### 2.9 Motif « module OS » et navigation physique

- **Module** (onglet), version claire : plaque translucide gris perle (`pearl-soft` à
  72 %, flou 6 px) avec un filet `line` à 55 % ; prénom `ink`, rôle `ink-muted`.
  Survol : plaque `surface-sunken`, tuile soulevée, l'accent du symbole bouge, la
  mission se précise (70 %). Ouvert : teinte `accent-soft` (88 %), filet cobalt à 42 %,
  élévation `shadow-raised` + 2 px, tuile `active` (anneau cobalt fin, symbole qui joue
  son mouvement), mission visible, petite **marque d'onglet** cobalt (24 × 2 px) en bas du
  module qui s'étire en 300 ms, **flux** : trait de 1,5 px `line-strong` au repos, gris
  foncé (`ink` à 55 %) là où le dossier est passé, **cobalt** sur le segment qui arrive
  au module ouvert. Signaux combinés, jamais une grosse bordure cobalt.
- **Icônes de la landing** : `AgentAppIcon surface="light"` partout (modules, en-tête de
  l'application) — la même variante que /agents-ia et les rails de l'espace connecté ; la
  variante `dark` ne sert plus sur la landing qu'à la pastille du bloc noir de la scène
  du mandat.
- **Application ouverte** : `StepDetails` sur un voile blanc givré sans bord (84 %, flou
  10 px) pour que le réseau passe derrière les mots, jamais dessous ; fenêtre de scène
  blanche (94 %, flou 8 px), un filet `line`, `shadow-raised` ; surfaces internes
  `surface-muted`, étiquettes « Simulation » + « Exemple fictif — simulation » inchangées.
- **Ouvrir l'application** : la tuile du module grandit jusqu'à l'en-tête du panneau
  (FLIP fait main, WAAPI, 460 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`), puis les mots
  (110–170 ms), la fenêtre s'ouvre (échelle 0,985 → 1) et son contenu arrive ligne par
  ligne (55 ms d'écart). Rien au premier rendu ; rien sous mouvement réduit.
- **Navigation discrète** « ← 04 / 07 → » : boutons ronds sans bordure, flèches de la
  famille, `aria-disabled` aux extrémités.
- **Défilement physique** (`useTrackPhysics`, maths pures dans `track-physics.ts`) :
  scroll natif + `scroll-snap` pour le tactile et le trackpad (molette horizontale
  native) ; à la souris, glisser avec inertie : seuil de 6 px avant de devenir un
  glissement (sinon c'est un clic), vitesse mesurée sur les 90 dernières ms, projection
  `v × τ` (τ = 325 ms), arrêt sur le module le plus proche (un lancer avance d'au moins
  un module), approche exponentielle indépendante de la cadence. Le clic qui suit un
  glissement est avalé : **un glissement ne sélectionne jamais**. Navigation au clavier ou
  aux flèches : glissement plus court (τ = 140 ms), module amené entièrement en vue. La
  molette verticale n'est **pas** détournée (la page ne se bloque jamais). Bords en fondu
  quand il reste du contenu. Mouvement réduit : la piste suit la main, puis se pose
  immédiatement sur son arrêt.
- **Clavier et accessibilité** : motif WAI-ARIA tabs (tabindex itinérant, ← → Début Fin,
  Entrée/Espace natifs), panneau focusable et étiqueté par l'onglet, nature de l'étape lue
  en premier, focus cobalt visible sur le blanc (5,4:1) ; texte `ink` 17,7:1 et
  `ink-muted` ≥ 6:1 sur les plaques claires (WCAG AA).

### 2.10 Cadre de l'espace connecté et navigation groupée

Un seul cadre pour toutes les pages de `app/(app)/` : même bord gauche, même hauteur de
titre, quelle que soit la largeur du contenu.

- **Classe de page** (`app/globals.css`, `@layer utilities`) : `page-frame` sur la racine de
  chaque `page.tsx` **et** de son `loading.tsx` (`max-w-7xl`, `px-6 pt-10 pb-16`, puis
  `px-10 pt-12 pb-20` dès 1024 px). Une page de lecture ajoute `page-frame-reading`
  (enfants plafonnés à `max-w-4xl`) ou `page-frame-medium` (`max-w-5xl`) : le contenu
  reste **aligné à gauche** sur le même bord, jamais recentré. Tableau de bord, pipeline et
  contacts : `page-frame` seul. Ne plus écrire `mx-auto max-w-* px-6 py-10…` dans une page.
- **En-tête** : `PageHeader` (`components/ui/PageHeader.tsx`) — sur-titre `Overline` (mono,
  trait cobalt, § 2.2.6) au-dessus de la rangée tuile + titre, puis `h1` Bricolage 600 en
  `text-title` (téléphone), `text-hero` dès 640 px, `text-page` (48 px) dès 1024 px (01/10/2026), au plus une ligne
  `text-base text-ink-muted`, badges (`meta`, ex. `SimulationBadge`) **sous** la phrase,
  l'action principale à droite. `size` n'a plus d'effet (même rôle partout, 26/09/2026).
- **Navigation** (`components/app/`) : `nav-items.ts` est la source unique (`NAV_GROUPS`,
  `NAV_ITEMS`, `isNavItemActive`). Trois groupes : **Pilotage** (Tableau de bord, Contacts
  vendeurs, Pipeline, Tâches, Rendez-vous), **Agents IA** (Vue d'ensemble, Leads entrants,
  Messages à valider, Relances Emma, Suivi des rendez-vous), puis Paramètres seul, séparé par
  un filet (titre de groupe `sr-only`). Chaque groupe est une `ul` nommée par son titre
  (`aria-labelledby`). Une entrée = un glyphe de la famille maison (§ 2.8 ;
  `dashboard`, `prospect`, `pipeline`, `tasks`, `appointment`, `network`, `lea`, `human`,
  `emma`, `sarah`, `settings`) + le libellé.
- **Entrée courante** : rangée blanche surélevée (`bg-surface shadow-subtle ring-1 ring-line`),
  libellé `font-medium`, glyphe en `ink`, et un **repère cobalt** de 2 × 16 px sur le bord
  gauche (`bg-accent`, apparition `opacity` + `scale-y` en 200 ms). Le cobalt dit « vous êtes
  ici » ; `aria-current="page"` et la graisse le disent aussi. Une seule entrée courante par
  écran (`/agents-ia/executions/*` appartient à « Vue d'ensemble »).
- **≥ 1024 px** : `AppNav variant="sidebar"` dans une colonne fixe de 256 px (`panel-blur`,
  `h-dvh`, défilement propre), compte et « Se déconnecter » en bas.
- **< 1024 px** : barre haute de 64 px (logo + bouton « Menu », `panel-blur`) et
  `MobileNav` : un `<details>` natif (fonctionne sans JavaScript) qui ouvre une feuille
  pleine hauteur, `AppNav variant="sheet"` (cibles de 48 px, `text-base`), compte en bas.
  Avec JavaScript, la feuille se comporte comme une modale : le focus boucle entre
  « Fermer » et la feuille, `#content` est `inert` et la page ne défile plus ; Échap
  referme et rend le focus au bouton **où que soit le focus** (écouteur `keydown` posé sur
  `document` dans le gestionnaire `toggle` à l'ouverture, retiré à la fermeture et au
  démontage ; une tabulation partie de l'extérieur revient dans la feuille) ; suivre un
  lien, changer de page ou passer à 1024 px referme (page de nouveau interactive et
  défilable — vérifié en E2E 390 → 1440 px).
- `devIndicators: false` dans `next.config.ts` : l'indicateur « N » de `next dev` masquait
  « Se déconnecter » (développement seulement).

### 2.11 Landing en mouvement : effets de titre, réseau 3D, zéro boucle

> **Révision « modèles MIG / Striker » (02/10/2026, soir — demande validée ; plan
> `docs/plans/2026-10-02-landing-modeles.md`)** — statut : **Lot 1 implémenté** (effets uniques, bloc A), Lot 2 (blocs B, C) spécifié.
> Un effet de titre n'est jamais répété (hero `underline`, problème `focus`, contrôle
> **`tech`**, les autres sans effet) ; bloc A « Vous » dans l'écosystème des agents à la place
> de `HeroJourney` (**seule boucle** de la page) ; bloc B, grille de 5 tuiles à la place des
> 7 cartes de la solution ; bloc C, panneau final sombre avec carrousel des 7 étapes. Tout est
> au **§ 2.11.8**, qui prime sur les passages contraires ci-dessous.

> **Révision « finition de la landing » (02/10/2026, branche `feat/landing-polish`, demande
> validée par l'utilisateur ; plan `docs/plans/2026-10-02-landing-polish.md`)** — statut :
> **spécifié**, non implémenté. Quatre changements, `/` seulement :
> 1. **Wordmark « Ascend » supprimé** (tout le dispositif TechText) : § 2.11.3 marqué retiré,
>    nouvelle fin du panneau final au § 2.11.3 bis.
> 2. **Mise au point puis trait cobalt (`focus-underline`) sur les quatre titres qui n'avaient
>    pas d'effet** : solution (« chemin »), agents (« s'arrête »), contrôle (« décide »),
>    résultat (« commencer ») — § 2.11.2.
> 3. **Rejeu de l'effet au survol** sur les sept titres qui ont un effet (hero compris) :
>    § 2.11.2 D.
> 4. **Réseau 3D recentré et atténué sur les bords latéraux** : § 2.11.4, « Composition
>    centrée, bords atténués ».
> Critères mis à jour : § 2.11.6 et § 2.11.7.

> Statut : **spécifié** le 01/10/2026 par le `web-designer` (demande validée par l'utilisateur,
> plan `docs/plans/2026-10-02-landing-motion.md`). Les valeurs
> marquées « cible » sont à remplacer par les mesures réelles à la livraison (tâche T8).
> **Avancement (01/10/2026, `frontend-ux`, passe 1)** : T1 parcours joué une fois, T2 badge et
> graphique, T3 effets du mot accentué, T4 wordmark — **implémentés et testés** (unitaires +
> E2E `accueil`, `typographie-expressive`, `landing-wordmark`). Réseau (§ 2.11.4, T5–T6), test
> global « aucune boucle » (T7) et captures finales (T8) : **non commencés**. Mesures réelles de
> la passe 1 : wordmark 206,3 px (1440), 157,7 px (1024), 64 px (390 et 360) ; balayage
> déclenché 2 012 ms après l'entrée à 60 %, durée 1 539 ms ; lettres peintes = lettres HTML
> au pixel près (0 pixel différent sur « end » à 1440, DPR 1) ; ressort : retour < 0,5 px
> en ≤ 700 ms et dépassement ≤ 6 px (test unitaire, de 38 à 144 px de départ).
> `MotionToggle` est retiré ; `landing-motion.ts` est supprimé (passe 2).
> **Avancement (01/10/2026, `frontend-ux`, passe 2)** : T5 modèle du réseau, T6 rendu / moteur /
> voiles, T7 test « aucune boucle » de page entière, T8 captures — **implémentés et testés**
> (unitaires `components/landing/living/*.test.ts` ; E2E `landing-reseau`, `landing-sans-boucle`,
> `accueil`). Mesures réelles et écarts : fin du § 2.11.4 (« Mesures réelles — passe 2 »).
> **Validation visuelle** : audit du `web-designer` (aller-retour 1)
> `docs/audits/2026-10-02-landing-motion.md` — **CONFORME AVEC CORRECTIONS MINEURES** : voile des
> deux lignes grises du titre « problème » à 75 % (2,97:1 mesuré au pire à 70 %), contour du
> wordmark sans tracés internes (cosmétique). **Corrections appliquées (01/10, `frontend-ux`)** :
> voile local à 75 % des deux lignes grises (pire mesuré 3,26:1, section en haut de fenêtre,
> réduit, 1440) ; contour extérieur seul du wordmark (tracés internes 245 px → 0 sur le « e »).
> Périmètre : **`/` seulement.** Le CRM, `/estimation`, `.particle-veil`, `RouteParticles` et le
> badge « Simulation » du CRM ne changent pas.
> **Révision « 02/10 — référence utilisateur »** : le réseau (§ 2.11.4) est réécrit d'après la
> démonstration fournie par l'utilisateur ; en découlent la règle 4 du § 2.11.1 (halo discret des
> cœurs et des impulsions autorisé), les durées du § 2.11.6 et les critères 1, 2, 4, 7, 8 et 9 du
> § 2.11.7. Effets de titre (§ 2.11.2), wordmark (§ 2.11.3) et § 2.11.5 : **inchangés**.

#### 2.11.1 Règles communes

1. **Aucune boucle sur la landing** — *exception unique depuis le 02/10 (soir) : le bloc A du
   hero, en boucle par décision de l'utilisateur, en pause hors écran et onglet caché, § 2.11.8.3*.
   Tout mouvement automatique a une fin, atteinte **en moins
   de 5 s** après son départ, puis l'écran est immobile (testé au pixel, § 2.11.7). Seuls les
   effets déclenchés par l'utilisateur (défilement, pointeur, bouton) peuvent bouger ensuite,
   et ils s'arrêtent avec son geste. *Précisé 02/10 (finition)* : le rejeu d'un effet de titre
   au survol (§ 2.11.2 D) est déclenché par le pointeur et **borné à 1,4 s** ; il va à son
   terme si le pointeur sort (jamais figé à mi-flou), puis tout est immobile.
2. **État final = état par défaut** : HTML serveur, sans JavaScript, `prefers-reduced-motion:
   reduce` → état final, net, immobile, à l'instant 0. Jamais d'`opacity: 0` hors de
   `@media (prefers-reduced-motion: no-preference)`.
3. **Une seule fois** par chargement de page : revenir sur une section ne rejoue rien.
4. **Couleurs** : encre `--color-ink` `#18181b` pour l'information et la matière du réseau ;
   cobalt `--color-accent` `#2457ff` **seulement** pour les traits, cadres, impulsions et cœurs
   allumés ; aucun rouge ; aucune lueur (`drop-shadow`, `shadowBlur`, `filter`), aucun dégradé
   coloré. *Révisé 02/10 — référence utilisateur* : **une seule exception**, le halo discret des
   impulsions (deux disques cobalt à 3,5 % et 10 %) et des cœurs allumés (dégradé radial cobalt
   ≤ 0,5 au centre, nul au bord, ≈ 2 s), aux valeurs de la référence, qui sont des plafonds
   (§ 2.11.4) — conforme à la direction artistique (« aucun glow excessif »). Le calque
   d'atmosphère blanc du réseau est le seul autre dégradé.
5. **Honnêteté** : rien ne lit un état réel ; aucune animation ne s'active en réponse à une
   action métier. La mention visible « Animations : exemple fictif, simulation. Aucune activité
   en direct. » reste sous l'illustration du hero.
6. Aucune dépendance npm : CSS et canvas 2D faits main (TrueFocus de React Bits repose sur
   `motion` : il est **réinterprété**, pas importé). *TechText (wordmark) : retiré le 02/10 ;
   revenu le 02/10 (soir) comme effet `tech` du seul mot « décide »
   (`components/ui/tech-accent/`, notice dans `THIRD_PARTY_NOTICES.md`, § 2.11.8.2).*

#### 2.11.2 Effets du mot accentué (`EditorialTitle` `accentEffect`)

> **Remplacé en partie le 02/10/2026 (soir), § 2.11.8.2** : un effet par titre, jamais
> répété — hero `underline`, problème `focus`, contrôle **`tech`** ; solution, agents,
> résultat et final **sans effet ni rejeu**. Le tableau ci-dessous et les mentions
> « sept titres » sont l'historique ; les définitions A, B, C et le mécanisme D restent la
> référence pour les effets conservés.

Trois effets, **sept titres** (*révisé 02/10 — finition* : « trois titres » au 01/10), aucun
autre. Les tokens sont locaux à `EditorialTitle.module.css`.

| Titre (`/`) | Composant | Mot | `accentEffect` | Déclencheur d'entrée | Rejeu au survol (D) |
|---|---|---|---|---|---|
| Hero | `LandingHero` | main | `underline` (A) | chargement (`reveal="load"`) | oui |
| Problème | `ProblemHeading` | administratif | `focus` (B) | entrée (`reveal="in-view"`) | oui |
| Solution | `LandingSolution` → `LandingHeading` | chemin | `focus-underline` (C) — **nouveau** | entrée | oui |
| Agents | `LandingAgents` → `LandingHeading` | s'arrête | `focus-underline` (C) — **nouveau** | entrée | oui |
| Contrôle | `LandingControl` → `LandingHeading` | décide | `focus-underline` (C) — **nouveau** | entrée | oui |
| Résultat | `LandingResult` → `LandingHeading` | commencer | `focus-underline` (C) — **nouveau** | entrée | oui |
| Final | `LandingFinal` → `LandingHeading` | fictive | `focus-underline` (C) | entrée | oui |

`/estimation`, le CRM et les états vides : `accentEffect="none"`, aucun rejeu (inchangé).
L'effet C est appliqué **à l'identique** aux quatre nouveaux titres (mêmes durées, même trait
cobalt conservé au repos — choix de l'utilisateur), joué une fois à l'entrée de la section,
comme « fictive ». Ces quatre titres sont posés sur le voile `.network-veil-title` (70 %) :
rien à changer, le flou transitoire est déjà couvert par la règle « Lisibilité » ci-dessous.

**Géométrie à vérifier par mot nouveau** (aucun nouveau token ; contrôle en gros plan à 1440
et 390, mouvement autorisé, ≈ 0,9 s après l'entrée) :

- « chemin, » : le trait dépasse le mot de +0,06 em à droite ; la virgule qui suit
  (Bricolage, hors de `.title-accent`) descend sous la ligne de base. Le trait **ne doit pas
  toucher la virgule**. Si contact mesuré (≥ 1 pixel commun entre l'encre de la virgule et la
  barre), le débord droit de ce trait passe à 0 (`right: 0`) **pour un mot suivi d'une
  ponctuation descendante** (`,` `;`) — règle locale, les autres mots gardent +0,06 em.
- « s'arrête » : l'apostrophe et l'accent circonflexe ne doivent toucher aucune branche du
  cadre (dégagement ≥ 0,08 em au-dessus de l'encre la plus haute). Si l'encre du « ê » ou de
  l'apostrophe dépasse `--accent-ink-top`, le haut du cadre se cale sur cette encre.
- « commencer » (aucune ascendante) : le cadre garde la hauteur commune (haut calé sur les
  ascendantes) — les sept cadres ont la même proportion ; c'est voulu, ne pas l'ajuster au mot.
- « décide » : l'accent aigu reste sous les ascendantes (« d ») ; rien à faire, à vérifier.
- `--accent-overhang` : 0,02 em pour ces quatre mots (aucun ne finit par « f »).

| Token | Valeur ≥ 1024 px | 640–1023 px | < 640 px |
|---|---|---|---|
| `--focus-rest-blur` (flou tenu du reste du titre) | `5px` | `5px` | `3px` |
| `--focus-frame-arm` (longueur d'une branche de coin) | `16px` (1 rem) | `12px` | `12px` |
| `--focus-frame-width` (épaisseur du trait du cadre) | `3px` | `2px` | `2px` |
| `--focus-frame-from` (échelle de départ du cadre) | `1.28` | `1.28` | `1.28` |
| `--mark-thickness` (trait sous le mot) | `max(3px, 0.05em du titre)` → ≈ 4,2 px (hero 1440), 3,2 px (sections 64 px) | idem | 3 px |
| `--mark-draw` | `640ms`, `--ease-draw` | idem | idem |

**A. Trait (« surlignage ») — `underline`, hero.**

- Géométrie : une barre pleine `--color-accent`, extrémités arrondies (`border-radius: 999px`),
  de **−0,02 em** à gauche du mot à **+0,06 em** à droite (dépasse le débord de l'italique) ;
  son bord haut à **0,08–0,12 em sous la ligne de base** du mot (em du titre). Elle est
  **derrière les glyphes** (le jambage du « f » de *fictive* passe par-dessus) : le mot porte
  `position: relative; z-index: 0` (contexte d'empilement), la barre `z-index: -1`.
- Élément : `span` vide `aria-hidden` (déjà dans le visuel `aria-hidden`), positionné en absolu
  dans `.title-accent` : **aucun effet sur la boîte de ligne** (écart ≤ 0,5 px, critère du § 2.2.5).
- Mouvement : `clip-path: inset(0 100% 0 0 round 999px)` → `inset(0 0 0 0 round 999px)`, de
  gauche à droite, `--mark-draw` (640 ms, `--ease-draw`), **délai 760 ms** après le chargement
  (le dernier flou des lignes du hero est nul à 692 ms) → trait complet à **1 400 ms**.
- État final (défaut, sans JS, mouvement réduit) : trait complet, sans `clip-path`.

**B. Mise au point — `focus`, section « problème »** (t = 0 : `[data-reveal="entering"]`).

| Élément | 0 → 640 ms | jusqu'à la relâche | Relâche | Fin |
|---|---|---|---|---|
| Mots non accentués | Arrivée actuelle (opacité 0 → 1, `translateY(0.2em)` → 0, `--ease-emphasis`, pas de 80 ms / 60 ms par ligne) **mais** le flou va de 8 px à `--focus-rest-blur` (atteint à 352 ms) et y reste | Flou tenu (5 px), couleur inchangée (`ink-subtle` pour les deux premières lignes) | À **1 820 ms** (+ n° de ligne × pas) : flou → 0 en **520 ms**, `--ease-standard` | ≤ 2 500 ms |
| Mot accentué | Opacité 0 → 1 en 220 ms (inchangé) : **net en premier** | Net | — | — |
| Cadre à 4 coins | Délai 160 ms ; opacité 0 → 1 et `scale(1.28)` → `scale(1)`, **560 ms**, `--ease-emphasis` (« la mise au point se resserre sur le mot ») | Tenu (≈ 1,1 s) | À **1 900 ms** : opacité 1 → 0 et `scale(1)` → `scale(1.04)`, **280 ms**, `--ease-exit` | 2 180 ms, invisible |

- **Géométrie du cadre** : un seul `span` vide, `position: absolute`, dans `.title-accent` ;
  quatre coins en L dessinés par **8 couches `linear-gradient`** (deux par coin : branche
  horizontale `--focus-frame-arm` × `--focus-frame-width`, branche verticale
  `--focus-frame-width` × `--focus-frame-arm`), couleur `--color-accent`, angles vifs (pas
  d'arrondi), **aucune ombre**. Dégagement intérieur mesuré depuis l'encre du mot : **0,12 em**
  à gauche et à droite (± 0,03 em), **0,08 em** au-dessus des ascendantes, et **0,04 em
  sous le plus bas jambage** (le « f » final d'*administratif*, le « f » de *fictive*) : aucune
  branche ne touche un glyphe (contrôle visuel en gros plan à 1440 et 390).
- `transform-origin: center` ; propriétés animées : `opacity`, `transform` seulement.
- État final (défaut) : cadre **invisible** (`opacity: 0`), aucun flou → identique au rendu
  actuel. Le cadre n'existe à l'écran que pendant l'effet.
- Contraste du cadre sur blanc : 5,4:1 (≥ 3:1 exigé pour un repère graphique).

**C. Mise au point puis trait — `focus-underline`, panneau final, et depuis le 02/10 solution,
agents, contrôle, résultat** (t = 0 : entrée de la section).

| Élément | Chronologie |
|---|---|
| Mots non accentués | Comme B, mais relâche à **1 700 ms** (+ n° de ligne × pas) → net à ≤ 2 380 ms |
| Mot accentué | Net en premier (220 ms) |
| Cadre | Entrée 160 → 720 ms (comme B) ; sortie à **1 500 ms**, 280 ms, `--ease-exit` |
| Trait | Délai **1 560 ms**, 640 ms, `--ease-draw` → complet à 2 200 ms (le cadre s'efface pendant que le trait naît) |
| Fin | ≤ 2 400 ms : titre net, trait sous « *fictive* » conservé, pas de cadre |

**Règles des trois effets.**

- **Entrée** : CSS seulement, aucun minuteur JavaScript ; déclencheurs existants (chargement
  pour le hero, `Reveal frame="still"` pour les sections). Le rejeu au survol (D) est le seul
  endroit où un peu de JavaScript intervient (poser / retirer un attribut). Un `@keyframes` unique par effet avec des
  pourcentages calculés depuis les durées ci-dessus est accepté (ex. B, mots non accentués,
  2 340 ms : 0 % `blur(8px)` opacité 0 ; 15 % `blur(5px)` ; 27 % opacité 1, `transform: none` ;
  78 % `blur(5px)` ; 100 % `filter: none`).
- `animation-fill-mode: backwards` : aucun `filter` ni `transform` résiduel à la fin.
- Mouvement réduit : `animation: none` ; état final immédiat (trait présent pour `underline` et
  `focus-underline`, cadre absent, aucun flou).
- Le nom accessible ne change pas (copie `sr-only` + visuel `aria-hidden`) ; les ornements sont
  des `span` vides, ils n'ajoutent aucun texte.
- Les boutons restent cliquables immédiatement ; aucune action n'attend la fin.
- Lisibilité : hors flou transitoire (≤ 1,9 s tenu), le texte est net ; le mot accentué est net
  **à tout instant** après 220 ms.

**D. Rejeu au survol — sept titres de `/`** (*ajouté le 02/10/2026 — finition, demande de
l'utilisateur*).

*Idée* : le titre réagit quand on le regarde avec la souris ; il rejoue son effet, puis revient
exactement à son état de repos. Aucune boucle, aucune information nouvelle : c'est une
réponse à un geste.

| Point | Décision |
|---|---|
| Titres concernés | Les sept du tableau ci-dessus. Activation explicite : nouvelle prop `accentReplay` (booléen, défaut `false`) d'`EditorialTitle`, qui pose `data-accent-replayable` sur le `h1`/`h2` **seulement si** l'effet n'est pas `none`. `LandingHeading` la transmet ; `/estimation` et le CRM ne la posent jamais |
| Zone de survol | La boîte du `h1`/`h2` entier (toutes ses lignes). Elle est ajustée aux mots par l'enveloppe `w-fit` du voile ; le débord fondu du voile (pseudo-élément) **n'en fait pas partie** |
| Appareils | Uniquement si `(hover: hover) and (pointer: fine)` **et** `(prefers-reduced-motion: no-preference)` sont vraies ; écoutées en direct (un changement de réglage attache ou détache le comportement sans recharger). Événement retenu seulement si `pointerType` est `mouse` ou `pen` (un toucher sur un appareil hybride ne déclenche rien) |
| Déclencheur | **L'entrée** du pointeur dans le titre (`pointerover` dont le `relatedTarget` est hors du titre). Bouger à l'intérieur ne déclenche rien : un passage = au plus un rejeu |
| Conditions (toutes) | (1) l'effet d'entrée est terminé : aucune animation `running` dans le titre (`getAnimations({ subtree: true })`) et aucun `Reveal` parent en `hidden` ; (2) aucun rejeu en cours sur ce titre ; (3) **≥ 800 ms** depuis la fin du rejeu précédent de ce titre (`REPLAY_COOLDOWN_MS`). Si une condition manque : rien, et rien n'est mis en attente |
| Sortie du pointeur pendant le rejeu | Le rejeu va à son terme (≤ 1,4 s) ; jamais d'interruption à mi-flou |
| État final | **Identique à l'état de repos** : mots nets (`filter: none`, opacité 1, aucun `transform`), cadre invisible (opacité 0), trait complet (sans `clip-path`) pour `underline` et `focus-underline` ; aucune animation restante |
| Mouvement réduit, tactile, clavier, sans JS | Rien. Le titre reste dans son état de repos. Les titres ne deviennent pas focusables (décor) |
| Curseur | Inchangé (le titre n'est pas un lien : pas de `cursor: pointer`) |
| Réseau | Le rejeu ne déclenche aucune séquence du réseau (§ 2.11.4) |

Chronologies du rejeu (t = 0 : entrée du pointeur). **Pas d'arrivée** : aucun mot ne change
d'opacité ni de position, tous les mots non accentués bougent ensemble (pas de décalage par
ligne). Propriétés animées : `filter`, `opacity`, `transform`, `clip-path` seulement.

| Effet | Élément | Chronologie | Fin |
|---|---|---|---|
| `underline` (hero) | Trait | 0 → 240 ms : effacé de gauche à droite (`inset(0 0 0 0)` → `inset(0 0 0 100%)`, `--ease-exit`) ; 240 → 320 ms : absent ; 320 → 960 ms : redessiné de gauche à droite (`inset(0 100% 0 0)` → `inset(0 0 0 0)`, 640 ms, `--ease-draw`) | **960 ms** |
| `underline` | Autres mots, mot accentué | Rien | — |
| `focus` (problème) | Mots non accentués | 0 → 200 ms : flou 0 → `--focus-rest-blur` (`--ease-standard`) ; tenu jusqu'à 900 ms ; 900 → 1 400 ms : flou → 0 (500 ms, `--ease-standard`) | **1 400 ms** |
| `focus` | Cadre | 0 → 480 ms : opacité 0 → 1, `scale(1.28)` → `scale(1)` (`--ease-emphasis`) ; tenu ; 900 → 1 180 ms : opacité → 0, `scale(1.04)` (`--ease-exit`) | 1 180 ms |
| `focus-underline` | Mots non accentués | Comme `focus` | **1 400 ms** |
| `focus-underline` | Cadre | Entrée 0 → 480 ms ; sortie 760 → 1 040 ms (280 ms, `--ease-exit`) | 1 040 ms |
| `focus-underline` | Trait | 0 → 200 ms : effacé de gauche à droite (`--ease-exit`) ; absent jusqu'à 760 ms ; 760 → 1 400 ms : redessiné (640 ms, `--ease-draw`) — le cadre s'efface pendant que le trait renaît, comme à l'entrée | 1 400 ms |
| Tous | Mot accentué | Net et opaque **à tout instant** | — |

Pourcentages de `@keyframes` (un `@keyframes` par élément et par effet, durées ci-dessus) :
mots 1 400 ms — 0 % `filter: blur(0)` ; 14,29 % `blur(var(--focus-rest-blur))` ; 64,29 % idem ;
100 % `filter: none`. Cadre `focus` 1 180 ms — 0 % opacité 0, `scale(var(--focus-frame-from))` ;
40,68 % opacité 1, `scale(1)` ; 76,27 % idem ; 100 % opacité 0, `scale(1.04)`. Cadre
`focus-underline` 1 040 ms — 0 % ; 46,15 % ; 73,08 % ; 100 % (mêmes valeurs). Trait `underline`
960 ms — 0 % `inset(0 0 0 0 round 999px)` ; 25 % `inset(0 0 0 100% round 999px)` ; 33,33 %
`inset(0 100% 0 0 round 999px)` (les deux états intermédiaires sont vides : rien ne se voit
entre 25 et 33 %) ; 100 % `inset(0 0 0 0 round 999px)`. Trait `focus-underline` 1 400 ms — 0 % ;
14,29 % ; 54,29 % ; 100 % (mêmes valeurs). Easing par segment avec
`animation-timing-function` dans les images clés, comme à l'entrée.

**Mécanique (contrat, l'implémentation est libre si elle le respecte).**

- Deux attributs sur le `h1`/`h2` : `data-accent-played` (posé au premier rejeu, jamais retiré)
  et `data-accent-replay="running"` (pendant un rejeu). En CSS :
  `[data-accent-played] :is(.focusWord, .sharpWord, .frame, .mark) { animation: none }` puis,
  dans `@media (prefers-reduced-motion: no-preference)`, les animations de rejeu sous
  `[data-accent-replay="running"]`. **Spécificité** : les sélecteurs d'entrée actuels montent
  à (0,5,0) (`.reveal[data-reveal="entering"] .inView.effectFocusUnderline .focusWord`) ; les
  règles « joué » et « rejeu » doivent l'emporter sans `!important` (sélecteur renforcé, ou
  sélecteurs d'entrée passés sous `:where()`), et « rejeu » doit l'emporter sur « joué ».
  **Raison** : le `Reveal` reste en
  `entering` et la classe `.load` reste posée ; sans `data-accent-played`, retirer l'attribut
  de rejeu remettrait la déclaration d'entrée et **rejouerait l'entrée** (opacité 0, montée). Le
  passage à `animation: none` est invisible : l'entrée est finie et son état final est l'état
  par défaut.
- Fin du rejeu : sur `animationend` de l'élément qui finit en dernier (mots pour `focus` et
  `focus-underline`, trait pour `underline`), l'attribut `data-accent-replay` est retiré et
  l'heure de fin notée. Filet de sécurité : minuteur de **1 600 ms** qui retire l'attribut si
  l'événement n'arrive pas (onglet caché, élément démonté) ; annulé à la fin normale et au
  démontage.
- Un seul contrôleur client pour toute la page (ex. `AccentReplayController`, monté une fois
  dans `app/(marketing)/page.tsx` à l'intérieur de `[data-landing]`), écoute **déléguée** sur
  la racine de la landing : aucun écouteur par titre, aucun état React, aucun rendu. Les
  `EditorialTitle` restent des Server Components.
- Attribut de test : `data-accent-replays` (nombre de rejeux joués depuis le chargement) sur
  le `h1`/`h2`.

**Accessibilité.** Rien n'est annoncé, le nom accessible ne change pas, aucune information
n'en dépend ; déclenché par l'utilisateur, ≤ 1,4 s (2.2.2 non concerné) ; désactivé par
`prefers-reduced-motion` (2.3.3). Aucune modification de la boîte de ligne (écart ≤ 0,5 px,
même critère qu'à l'entrée).

#### 2.11.3 ~~Wordmark « Ascend » (`TechWordmark`, d'après TechText de React Bits)~~ — RETIRÉ le 02/10/2026

> **02/10/2026 (soir)** : le wordmark reste retiré, mais **l'effet TechText revient comme effet
> du mot « décide »** (titre de la section contrôle), § 2.11.8.2. Les valeurs ci-dessous
> (cadre, poignées, étiquette, specks, ressort) servent de référence à cette adaptation ; la
> notice TechText revient dans `THIRD_PARTY_NOTICES.md`.

> **RETIRÉ** (demande de l'utilisateur, lot « finition de la landing », 02/10/2026). Le mot
> « Ascend » du panneau final et **tout** le dispositif TechText disparaissent : composant,
> moteur, peinture canvas, styles, texte `LANDING_TEXTS.final.wordmark`, test E2E
> `e2e/landing-wordmark.spec.ts`, notice TechText de `THIRD_PARTY_NOTICES.md`. Nouvelle fin du
> panneau : § 2.11.3 bis. Rien ne le remplace (aucun autre mot, aucun logo ajouté dans le panneau).
> Le texte ci-dessous est **conservé comme historique** (mesures, décisions) ; il ne s'applique
> plus et ne doit pas être réimplémenté. Le nom « Ascend Strategy » reste lu dans le logo de
> l'en-tête et le pied de page (`BRAND.wordmark`, `e2e/marque.spec.ts` : inchangés).

*Historique (01/10/2026) :*

Fichiers : `components/landing/wordmark/` (`tech-wordmark.ts` pur et testé,
`TechWordmark.tsx` client, `TechWordmark.module.css`). Texte : `LANDING_TEXTS.final.wordmark` =
« Ascend ».

**Place.** Dernier élément du panneau final, **après** la note « Prototype de démonstration… »
(la note reste collée aux actions), aligné sur le bord gauche du titre, `mt-4`. Le panneau
devient conteneur (`container-type: inline-size`). Aucun débordement du panneau ni du document.

| Paramètre (TechText) | Valeur retenue | Pourquoi |
|---|---|---|
| `fontWeight` | 600 (Bricolage, `font-variation-settings: normal`, largeur 100, **`font-optical-sizing: none`**) | Même voix que les titres. *Mesuré 01/10* : en `auto`, le HTML prend la taille optique 96 (dessin plus étroit) alors que le canvas dessine la taille par défaut ; les lettres peintes ne tombaient pas sur les lettres HTML. Avec `none`, écart nul |
| `fontSize` | `clamp(4rem, 19cqi, 15rem)` du panneau — cible ≈ 207 px à 1440, ≈ 160 px à 1024, 64 px à 390 | « Très grand », proportionnel au panneau (150 px fixe déborderait à 390) |
| `letterSpacing` | **`-0.04em`** (retenu le 01/10 : à `-0.05em`, « c » et « e » se chevauchent de 1 px à 206 px ; à `-0.04em`, écart minimal 2 px — écarts mesurés A–s 8, s–c 4, c–e 2, e–n 5, n–d 5 px) | Valeur TechText resserrée d'un cran, serrée comme le hero |
| interlignage | 0,8 (mot sans jambage) | Pas de vide sous le mot |
| `color` | `--color-ink` `#18181b` | Encre = information principale |
| `accentColor` | `--color-accent` `#2457ff` | Cadre, poignées, étiquette, moitié des specks |
| `reveal` | `'area'`, `reach` = 0,75 em (≈ 155 px à 1440), `softness` 0,35 | Les lettres proches du pointeur passent en contour ; transition douce sur 35 % de la portée |
| `dashLength` / `dashGap` / `strokeWidth` | 4 / 2 / 1,5 px CSS (indépendants du DPR) | Valeurs TechText |
| `specks` | 15 (≥ 768 px, pointeur fin) ; 8 (compact) | Carrés de 2–4 px, moitié cobalt (opacité 0,9), moitié encre (0,5), dans la boîte de la lettre élargie de 0,25 em, positions à graine fixe ; chaque speck clignote **2 fois** (0 → 1 → 0 en 360 ms), décalage 40 ms, uniquement au changement de lettre |
| `selection` | oui | Rectangle cobalt de 1 px autour de l'encre de la lettre + 4 px, 4 poignées carrées 5 × 5 px (fond blanc, trait cobalt 1 px) ; glissement de lettre en lettre **160 ms**, `--ease-emphasis` |
| `labels` | oui | Geist Mono 11 px 500, texte « A  118 × 152 » (lettre, largeur × hauteur de l'encre en px CSS arrondis), **blanc sur cobalt** (5,4:1), rayon 4 px, marge 2 × 6 px, 6 px au-dessus du coin haut gauche du cadre (dessous s'il n'y a pas la place) |
| `draggable` | oui, **souris et stylet seulement** | Déplacement plafonné à 0,6 em (frein progressif) ; au relâcher, ressort `k` 220, amortissement 22 (masse 1) : retour à < 0,5 px en ≤ 700 ms, dépassement ≤ 6 px |
| `sweep` | **une fois** | Voir ci-dessous ; jamais de balayage d'attente |
| `speed` | 1 | — |

**États et comportements.**

| Situation | Rendu |
|---|---|
| Sans JavaScript, mouvement réduit, avant hydratation | Le mot en **HTML** (une lettre par `span` `inline-block`, `font-kerning: none`), plein, encre, statique. Aucun canvas monté sous mouvement réduit, aucun écouteur |
| Repos (JS, mouvement autorisé) | Identique : HTML visible, canvas **vide**, aucune boucle `requestAnimationFrame` (`data-wordmark-state="idle"`) |
| Balayage (une fois) | Déclencheur : première fois que le wordmark est visible à ≥ 60 % ; délai **2 000 ms** (le titre du panneau a fini sa mise au point). Le cadre se pose sur « A » puis glisse A → s → c → e → n → d (160 ms de glissement + 60 ms d'arrêt par lettre), la zone de contour suit le cadre, specks autour de la lettre courante ; après « d », le cadre s'efface en 200 ms. Total **≤ 1 600 ms**, puis `idle` |
| Pointeur fin au survol (`(hover: hover) and (pointer: fine)`) | Lettres dans la portée en contour pointillé ; cadre + étiquette sur la lettre la plus proche ; specks au changement de lettre seulement ; pointeur immobile 600 ms → plus aucun speck ; sortie → retour au plein en 200 ms, canvas vidé, `idle` |
| Glisser (souris, stylet) | `pointerdown` sur une lettre → `setPointerCapture`, la lettre suit ; `pointerup` / `pointercancel` / Échap → ressort. `user-select: none` sur le wordmark. Un clic sans glisser (≤ 6 px) ne fait rien d'autre |
| Tactile, pointeur grossier | Ni survol ni glisser. `touch-action: pan-y pinch-zoom` (jamais `none`), aucun `preventDefault` sur `touchmove` : **le défilement n'est jamais bloqué**. Un toucher bref (< 300 ms, < 6 px) sur une lettre montre cadre + étiquette 1,2 s puis s'efface |
| Clavier | Non focusable (décoratif) ; rien d'essentiel |
| Onglet caché | Animation arrêtée, retour à `idle` au retour |

**Rendu.** Pendant un état actif, le canvas (`position: absolute`, débord de 48 px en haut,
32 px à gauche et à droite, 24 px en bas, borné au panneau ; `pointer-events: none`, les
écouteurs sont sur l'enveloppe ; DPR plafonné à 2) dessine **toutes** les lettres à partir des
boîtes mesurées des `span` (`getBoundingClientRect`, police lue sur le `span` via
`getComputedStyle`, dessin après `document.fonts.ready`) ; les `span` passent en
`visibility: hidden` (place conservée). Retour à `idle` : canvas vidé, `span` visibles. Écart
toléré entre lettre HTML et lettre dessinée : ≤ 1 px. Coût ≤ 2 ms par image active.

**Accessibilité.** Enveloppe `aria-hidden="true"` : décoratif. Le nom réel « Ascend Strategy »
est déjà lu dans le logo de l'en-tête et le pied de page ; un `role="img"` l'annoncerait une
troisième fois au milieu de l'appel à l'action. Le mot reste visuellement lisible à tout instant
(17,7:1 au repos ; en contour, trait encre 1,5 px). Aucune information n'en dépend.

**Contour extérieur seul** (correction de l'audit du 01/10) : la police variable superpose des
contours (barre du « e », terminaisons du « c ») ; un `strokeText` simple montre ces tracés
internes. Le pointillé est tracé à 2 × 1,5 px, puis la lettre elle-même est découpée
(`destination-out` + `fillText`) : seule la moitié extérieure (1,5 px) reste, comme le TechText
d'origine. Mesuré à 1440 (DPR 2) : 0 pixel d'encre à plus de 2,5 px dans le glyphe (245 avant
sur le « e ») ; le contour dépasse le glyphe HTML de 2,12 px au plus (1,12–1,42 px avant : + 0,7 à
1,0 px, la largeur visible du trait) ; position des lettres inchangée ; coût d'une image active
p95 0,20 ms, max 0,30 ms (identique avant / après).

#### 2.11.3 bis Fin du panneau final sans wordmark (02/10/2026 — finition)

> **Remplacé le 02/10/2026 (soir)** par le panneau sombre « processus » (bloc C,
> § 2.11.8.5) : titre centré, paragraphe, actions, note **centrés**, puis carrousel. Le tableau
> ci-dessous est l'historique.

| | Avant | Après |
|---|---|---|
| Contenu du panneau | titre « Déposez une demande *fictive*… » ; deux boutons ; note ; wordmark « Ascend » | titre ; deux boutons ; note — **la note est le dernier élément** |
| Titre → boutons | `gap-10` (40 px) | **inchangé** : 40 px |
| Boutons → note | 40 px (`gap-10` de la grille) | **16 px** : boutons et note forment un groupe (`grid justify-items-start gap-4`) ; la note se lit comme la légende des actions |
| Après la note | `mt-4` + wordmark (≈ 207 px de haut à 1440) | **rien** : le rembourrage du panneau ferme la carte — 32 px (`p-8`, < 1024 px), 48 px (`lg:p-12`) sous la note |
| Section | `pt-16 pb-24 lg:pb-36` | inchangé |
| `@container` sur le panneau | utilisé par la taille du wordmark | **retiré** si plus rien ne s'en sert (vérifier qu'aucune classe `@…` ou `cqi` n'est dans le panneau) |

Hauteur du panneau : ≈ 207 px de moins à 1440, ≈ 160 px à 1024, ≈ 64 px à 390 (le wordmark et
sa marge), moins 24 px (note rapprochée). Pied de page et rythme de fin de page inchangés.
Note inchangée mot pour mot : « Prototype de démonstration. Aucune donnée réelle, aucun envoi
réel. » (`text-xs text-ink-subtle`, garde-fou d'honnêteté). Mobile 390 : boutons empilés si
nécessaire (`flex-wrap gap-3` inchangé), note dessous à 16 px, alignée à gauche.

#### 2.11.4 Réseau neuronal 3D (évolution de `LivingBackground`) — révisé 02/10 — référence utilisateur

> **Révision du 02/10/2026 (référence utilisateur).** L'utilisateur a fourni le rendu exact
> attendu : `ascend-neural-network-demo.html` (fichier autonome, canvas 2D, aucune dépendance ;
> chemin d'origine `C:\Users\admha\Documents\Codex\2026-10-01\am\outputs\`, **hors dépôt** — à
> verser dans `docs/references/reseau-neuronal-demo.html` par l'orchestrateur pour la
> traçabilité). Ce paragraphe **remplace** l'interprétation du 01/10 (220 nœuds ronds, 480 fibres
> droites ou peu courbées en tapis, trois plans discrets, cœurs sans halo). Les valeurs ci-dessous
> sont **celles de la référence** sauf les adaptations marquées **[adapt.]**, toutes imposées par
> la règle « aucune boucle », la lisibilité des textes ou le budget de 4 ms.
>
> Mesures faites pour cette révision (copie instrumentée de la référence, Chromium sans
> interface, Playwright 1.63, DPR 1 — **ce ne sont pas des mesures du produit**) : 34 neurones,
> ≈ 2 450 fibres, ≈ 40 000 points à 1440 × 900 ; coût d'une image **7,7 ms** (médiane, p95
> 9,9 ms) tel quel → **3,6 ms** (p95 5,0 ms) en regroupant les tracés par opacité et épaisseur,
> rendu visuellement équivalent ; 390 × 844 : 4,4 → 1,8 ms. Encre (alpha moyen du canvas) :
> 1,4–1,8 % à 1440, 1,6–2,2 % à 1024, 0,6–1,9 % à 390 (5 tirages chacun).

**Principe.** Même composant, même canvas fixe (`position: fixed; inset: 0; z-index: 0;
pointer-events: none; aria-hidden="true"`), même câblage `data-living-scene`, mêmes garde-fous
(onglet caché, DPR plafonné, mouvement réduit, coût mesuré). Le modèle 2D (chemin étiqueté,
dossiers, poussières, trame) est retiré. **Un seul volume de neurones, placé derrière la
fenêtre, vu par une caméra qui pivote avec le défilement** : il est présent derrière chaque
section, du haut au bas de la page, à gauche, à droite et derrière les textes.

Pourquoi un volume fixe plutôt qu'un réseau « long » qui défile avec la page : (1) chaque écran a
exactement la densité et la lisibilité de la référence, quelle que soit la longueur de la page ;
(2) le coût et la mémoire sont bornés par une fenêtre, pas par la page ; (3) l'infrastructure
existante (canvas fixe, pause, mouvement réduit) est conservée telle quelle ; (4) la profondeur
se lit par la rotation, pas par une parallaxe qui ferait « glisser » des neurones à contresens
du texte. Alternative écartée : un monde haut comme la page (coût proportionnel à la page,
cache impossible, densité à réinventer). Hiérarchie inchangée : contenu → interface →
interaction → réseau.

**Classes d'écran.** *Large* : ≥ 1280 px et pointeur fin ; *moyen* : 768–1279 px et pointeur
fin ; *compact* : < 768 px **ou** pointeur grossier. DPR plafonné à 2 (compact : 1,5).

**Budget (plafonds durs).**

| | Large | Moyen | Compact |
|---|---|---|---|
| Neurones | **34** (référence, densité 65 %) | **28** [adapt.] | **20** (référence < 650 px) |
| Fibres dendritiques | 7 × Σ (branches + 1) par neurone, soit ≈ 2 380 ; plafond **2 900** | ≈ 1 960 ; plafond **2 400** | ≈ 1 400 ; plafond **1 700** |
| Fibres de liaison (3 plus proches voisins, sans doublon) | ≈ 64 ; ≤ 3 × N | ≈ 52 | ≈ 38 |
| Points de tracé (plafond) | **46 000** | **38 000** | **28 000** |
| Impulsions simultanées (plafond ; excédent **abandonné**) | **48** [adapt. : 75 dans la référence] | **40** | **28** |
| Coût d'une image avec caméra en mouvement (`data-frame-ms`, p95) | **≤ 4 ms** | ≤ 4 ms | ≤ 4 ms (émulation) |
| Coût d'une image de séquence, caméra immobile (cache) | **≤ 1,5 ms** (cible) | ≤ 1,5 ms | ≤ 1,5 ms |

**Génération (à graine, aucun `Math.random` dans `components/landing/living/`).**
Générateur pseudo-aléatoire à graine (ex. mulberry32) initialisé par `DEFAULT_SEED` et la
classe d'écran : **même classe → même réseau, au point près** (captures et tests stables). Le
réseau n'est regénéré que si la classe change ; un simple redimensionnement **re-projette**
(aucune nouvelle géométrie). Coordonnées « monde » de la référence :

| Élément | Règle (référence) |
|---|---|
| Position d'un neurone | *Révisé 02/10 — finition : voir « Composition centrée, bords atténués » (x large/moyen ± 1,85, z minimal relevé sur les bords).* x ∈ [−1,95 ; 1,95], y ∈ [−1,25 ; 1,25], z ∈ [−0,5 ; 1,5] ; tirage rejeté si un neurone existant est à moins de 0,30 (distance `hypot(dx, dy, 0,4 dz)`), 20 essais |
| Corps cellulaire | rayon r ∈ [0,011 ; 0,023] ; 14 points, angle `rotation + j/14 × 2π`, distance r × [0,55 ; 1,7], composante y × 0,75 ; contour fermé lissé par des quadratiques passant par les milieux ; noyau : disque de 0,34 × la taille projetée |
| Branches | 7 à 11 par neurone, réparties sur 360° (± 0,25 rad), longueur [0,25 ; 0,56], épaisseur [0,8 ; 1,65] px ; **un axone** par neurone : direction libre, longueur [0,7 ; 1,2], épaisseur 1,5 px ; récursion sur **2 niveaux** |
| Tracé d'une branche (marche aléatoire d'angle) | `pas = max(8, arrondi(longueur × 65))` ; à chaque pas : angle += U(−0,28 ; 0,28) + penchant U(±0,045) + 0,095 × sin(0,65 × pas + phase) ; z += U(±0,016) |
| Divisions | au pas U(0,45 ; 0,72) × pas : branche latérale (tangente ± U(0,55 ; 1,25) rad, longueur × U(0,40 ; 0,65), épaisseur × 0,5) ; au bout : prolongement (angle ± 0,5, longueur × U(0,48 ; 0,72), épaisseur × 0,48) ; épaisseur de fin = 0,25 × épaisseur ; opacité propre U(0,65 ; 1) |
| Fibres de liaison | vers les **3 plus proches voisins** (`hypot(dx, dy, 0,7 dz)`), sans doublon ; chemin **irrégulier permanent** : déplacement du point médian, **5 passes**, amplitude ± 0,17 × longueur du segment (z : moitié) ; épaisseur U(0,8 ; 1,9) px, fin 0,65 px, opacité 0,9 |
| Précalculs | longueurs cumulées de chaque tracé, table des embranchements (fibre enfant + distance de départ), liste des fibres sortantes de chaque neurone ; points stockés en `Float32Array` ; **aucune allocation par image** |

**Projection et caméra.**

- Projection (référence) : lacet puis tangage ; `perspective = 4,5 / (4,5 + profondeur)` ;
  x écran = `W/2 + rx × taille × perspective`, y écran = `0,46 H + ry × taille × perspective` ;
  `taille = max(0,29 W ; 0,43 H)` (compact : `max(0,38 W ; 0,30 H)`).
- Proximité : `near = clamp((1,55 − profondeur) / 2,1 ; 0 ; 1)` ; ordre de dessin : fibres de la
  plus lointaine à la plus proche, puis impulsions, puis corps cellulaires du plus lointain au
  plus proche.
- **[adapt.] Pose liée au défilement** (la référence tourne en continu ; ici jamais au repos) :
  `p` = progression du défilement de la page (0 → 1), `θ = π (p − 0,5)`,
  **lacet = 0,16 × sin θ** (± 0,16 rad, amplitude de la référence), **tangage = 0,055 × cos θ**
  (arc d'orbite de la référence). Lissage exponentiel τ = 0,25 s (constante existante) ; la
  boucle ne tourne que tant que l'écart à la cible dépasse 0,0005 rad **ou** qu'une séquence
  joue. Défilement arrêté → la caméra se pose en < 1,2 s, puis plus aucune image.
- **[adapt.] Dérive pendant une séquence** : lacet + 0,012 × sin(π t / T) rad (T = durée de la
  séquence) — la caméra avance puis revient exactement à la pose du défilement : l'état final ne
  dépend pas des séquences. **Conditionnelle** : retirée (amplitude 0) si le coût p95 d'une
  image caméra en mouvement dépasse 4 ms à la mesure de T6 (premier repli, voir « Rendu »).
- Mouvement réduit : pose fixe θ = 0 (lacet 0, tangage 0,055), indépendante du défilement.

**Apparence au repos (encre, jamais de cobalt au repos).**

| Élément | Règle (référence) |
|---|---|
| Fibre : opacité | `clamp((0,045 + near^1,6 × 0,66) × opacité propre ; 0,025 ; 0,95)` |
| Fibre : épaisseur (3 tronçons k = 0, 1, 2, du tronc à la pointe) | `max(0,18 ; (ép. × (1 − k/3) + ép. fin × k/3) × (0,48 + 0,62 near))` px CSS ; extrémités et jonctions arrondies |
| Corps | remplissage opacité `clamp(0,12 + 0,86 near ; 0 ; 1)` ; noyau sombre opacité `0,15 + 0,8 near` |
| Couleur | encre `--color-ink` `#18181b` (la référence utilise le noir pur ; écart invisible, et le contraste se mesure avec le token) |

- **[adapt.] Pas d'épaississement des fibres excitées** (la référence ajoute + 0,2 × énergie à
  l'opacité et à l'épaisseur des fibres d'un neurone allumé) : il imposerait de redessiner tout
  le réseau à chaque image d'une séquence. Le signal est porté par les impulsions et les cœurs.
- **Atmosphère [adapt.]** : calque CSS blanc fixe au-dessus du canvas, sous le contenu
  (`.network-atmosphere`, `aria-hidden`, `pointer-events: none`, statique) : vignette radiale
  de la référence (transparent jusqu'à 25 %, blanc 12 % à 75 % du rayon) ; en haut, blanc 90 % →
  0 sur les **96 premiers px** (zone de l'en-tête) ; en bas, 0 → blanc **50 %** sur les derniers
  12 % de la hauteur. La référence blanchit 19 % en haut et 28 % en bas (jusqu'à 97 %) pour ses
  légendes ; ici les voiles s'en chargent, et le réseau doit rester visible en haut et en bas de
  chaque écran. Seuls dégradés autorisés du réseau : ce calque blanc et le halo des cœurs.

**Composition centrée, bords atténués** (*ajouté le 02/10/2026 — finition, demande de
l'utilisateur : « centre-le et diminue légèrement des côtés »*).

*Constat chiffré* (copie instrumentée de `network.ts` + `camera.ts`, graine `DEFAULT_SEED`,
encre relative = Σ opacité × épaisseur × longueur projetée des fibres dans la fenêtre — **pas
une mesure du produit**) : à 1440 × 900, les neurones **proches** (les plus sombres) du tirage
sont presque tous sur les bords (x ≈ −1,67 ; −1,64 ; −1,11 ; +1,78 ; +1,84) ; le centre de
masse horizontal de l'encre est à **0,39 W** en haut de page, 0,45 W au milieu, 0,50 W en bas ;
les 20 % de gauche portent **28–34 %** de l'encre, les 20 % de droite 15–25 %, les déciles
centraux 5–6 % chacun. À 1024 × 768 : centre de masse 0,51–0,62 W, 20 % de droite = 27–40 %.

*Décision* : trois leviers, dans cet ordre, toutes classes d'écran sauf mention contraire.
Aucune nouvelle couleur, aucun nouveau calque, aucun changement de densité totale.

| Levier | Règle | Valeur |
|---|---|---|
| 1. Placement moins large | x d'un neurone tiré dans [−X ; X] | **X = 1,85** (large, moyen ; 1,95 avant) ; compact **inchangé** (1,95 : la fenêtre ne montre déjà que ± 0,77 unité) |
| 2. Pas de neurone proche sur les bords | z minimal dépend de \|x\| : `zMin = −0,5 + 0,6 × smoothstep(1,0 ; X ; abs(x))` ; z tiré dans [zMin ; 1,5] (un seul tirage, comme avant) | au bord, aucun neurone plus proche que z = 0,1 (proximité ≤ 0,69 au lieu de 0,98) ; inchangé pour \|x\| ≤ 1,0. Toutes classes |
| 3. Recentrage à l'écran | Décalage horizontal `offsetX` ajouté au centre de projection (`centerX = 0,5 W + offsetX`), calculé pour la **pose de référence** (lacet 0, tangage 0,055 = pose du mouvement réduit) : centre de masse de l'encre (fibres, opacité de repos × épaisseur × longueur projetée, segments dans la fenêtre, atténuation du levier 4 comprise) ramené à 0,5 W ; 3 itérations ; plafond **± 10 % de W** | prototype : **+4,9 % W** à 1440 × 900 et 1280 × 800, **−10 % W** (plafond) à 1024 × 768, **−2,7 % W** à 390 × 844 |
| 4. Atténuation latérale douce | Opacité de repos d'une fibre × `f(u)`, u = distance du **milieu projeté** de la fibre au bord gauche ou droit le plus proche, en fraction de W (u < 0 → 0) ; corps cellulaire (remplissage et noyau) × `f(u)` de son centre projeté. `f(u) = 1 − 0,20 × (1 − smoothstep(0 ; 0,15 ; u))` | **× 0,80 au bord**, rampe douce, **× 1 à partir de 15 % de W** vers l'intérieur. Appliqué avant la quantification au 1/20 (aucun groupe de tracé en plus) |

- **Ce qui ne change pas** : impulsions, traînées, halos et noyaux allumés (cobalt, seulement
  pendant une séquence ; leurs origines sont déjà dans les 70 % centraux) ; nombre de neurones,
  de fibres, de points ; épaisseurs ; calque d'atmosphère ; voiles ; zones calmes ; pose liée
  au défilement (le lacet ± 0,16 rad continue de faire « tourner » la composition : le centre
  de masse oscille autour du centre, c'est la profondeur qui se lit).
- **Quand c'est calculé** : `offsetX` à la construction et à chaque re-projection due à un
  **redimensionnement** (anti-rebond 150 ms existant) — **jamais par image** ni par pose. Coût
  ≤ 15 ms une fois (3 passes de projection de ≤ 46 000 points), hors images animées. `f(u)` :
  une multiplication par fibre et par corps lors d'un redessin complet (déjà projeté).
- **Graine** : inchangée (`DEFAULT_SEED` = 20261069) si les tests de couverture passent ; sinon
  première graine suivante qui passe espacement + couverture dans les trois classes, reportée
  ici (même procédure qu'à la passe 2).
- **Origines des séquences** : règles inchangées, appliquées aux positions projetées (décalage
  compris).

*Prototype (mêmes outils, valeurs ci-dessus)* — part de l'encre dans les 20 % de gauche | 20 %
de droite, et centre de masse, pose de référence (haut / bas de page entre parenthèses) :

| Écran | Avant | Après | Centre de masse avant → après |
|---|---|---|---|
| 1440 × 900 | 28,1 % \| 20,5 % | **14,0 % \| 13,5 %** | 0,45 (0,39 / 0,50) → **0,50** (0,45 / 0,55) |
| 1024 × 768 | 14,6 % \| 34,0 % | **17,5 % \| 19,2 %** | 0,57 (0,51 / 0,62) → **0,52** (0,46 / 0,57) |
| 390 × 844 | 17,9 % \| 21,3 % | **17,9 % \| 18,1 %** | 0,51 (0,48 / 0,53) → **0,51** (0,47 / 0,52) |

Encre relative totale : 1440 **+1 %**, 1024 **+3 %**, 390 **−4 %** (la matière est déplacée vers
le centre, pas retirée). Les déciles extrêmes (0–10 % et 90–100 %) gardent 4–8 % de l'encre :
**les bords restent habités**, plus clairs. Grille 3 × 3 à 1440 : 9 cases sur 9 occupées par un
corps cellulaire à toutes les poses.

*Fourchettes d'encre du tableau de mesures* (`settled`, alpha moyen du canvas) : **inchangées**
— 1,2–2,2 % (large, moyen), 0,8–2,0 % (compact) ; mesuré avant : 1,54–1,64 % (1440), 1,37–1,49 %
(1024), 1,24–1,29 % (390). Si une mesure sort de la fourchette, on ne touche pas aux opacités
globales : on règle d'abord l'atténuation (0,20 → 0,15) puis le levier 2 (0,6 → 0,45), et on
reporte la valeur ici.

*Contraste* : seuils du paragraphe « Derrière les textes » **inchangés**, voiles **inchangés**
(70 % titres, 75 % lignes grises du titre « problème », 90 % petits textes). Le recentrage
rapproche l'encre des titres : tout est **re-mesuré** (même protocole). Si un seuil tombe,
dans l'ordre : plafond du recentrage 10 % → 6 % de W, puis levier 2 → 0,45 ; **aucun voile
renforcé** sans validation du `web-designer` (l'utilisateur veut voir le réseau derrière les
titres).

*Mouvement réduit* : même géométrie, même `offsetX`, même atténuation, pose fixe = pose de
référence → c'est l'état le mieux centré. *Responsive* : 1440 et 1280 (large) et 1024 (moyen)
appliquent les quatre leviers ; 390 (compact) applique 2, 3 et 4 (X inchangé).

**Mesures réelles — finition (02/10/2026, `frontend-ux`)** — elles remplacent les chiffres du
prototype ci-dessus. Code : `components/landing/living/composition.ts` (`edgeFade`,
`centerOffset`, `inkProfile` ; constantes `EDGE_FADE` 0,20, `EDGE_FADE_BAND` 0,15,
`CENTER_OFFSET_CAP` 0,10, 3 passes), `network.ts` (`NODE_X_RANGE` 1,85 / 1,85 / 1,95,
`EDGE_DEPTH_LIFT` 0,6, `minDepthAt`), `camera.ts` (`setProjector(…, offsetX)`), `renderer.ts`
(f(u) sur fibres par leur milieu projeté et sur corps par leur centre, avant la quantification),
`LivingEngine.ts` (`offsetX` calculé dans `resize()` seulement ; attribut de test
`data-center-offset`, px CSS).

- **Graine changée : `DEFAULT_SEED` = 20332770** (20261069 avant). Avec les leviers, 20261069
  laissait une case vide à 390 × 844 en bas de page (test de couverture 2 × 3). La règle « première
  graine suivante qui passe espacement + couverture dans les trois classes » ne suffisait pas : les
  premières graines qui la passent échouent ailleurs (20261166 : encre 2,34 % et 3,69:1 sous
  « Qualification » à 390 ; 20262738 : bande gauche plus sombre que le centre en haut de page à
  1440, ratio 1,13 ; 20265792 et 20 autres : **aucune origine éligible pour l'arrivée à 390**, la
  cascade du téléphone ne jouait plus). Critères de sélection appliqués, dans l'ordre : espacement,
  couverture (1440 3 × 3 et tuiles 240 px, 1024 3 × 3, 390 2 × 3, p = 0 / 0,5 / 1), n° 7 bis
  (unitaire, 4 écrans), encre relative proche de la version validée, arrivée jouée dans les trois
  classes, n° 7 bis E2E, contraste n° 8. Deux graines passent tout : 20309866 et 20332770 ;
  **20332770 retenue** (encre à 1440 la plus proche de la version validée, 1,64 % contre 1,84 % ;
  marge des bandes à 1440 0,54 contre 0,69).
- **Replis** : **aucun** (plafond du recentrage 10 %, levier 2 à 0,6, atténuation 0,20) — tous les
  seuils de contraste tiennent.

*Composition (unitaire, encre relative des fibres, pose de référence ; haut / bas de page entre
parenthèses)* — avant = graine 20261069 sans les leviers ; après = graine 20332770, quatre leviers :

| Écran | 20 % gauche \| 20 % droite, avant → après | Déciles extrêmes après | Centre de masse avant → après | `offsetX` |
|---|---|---|---|---|
| 1440 × 900 | 28,3 % \| 20,4 % → **13,0 % \| 13,8 %** | 4,4 % \| 4,9 % | 0,449 (0,394 / 0,499) → **0,499** (0,448 / 0,552) | +2,24 % W (+32,3 px) |
| 1280 × 800 | 28,3 % \| 20,4 % → **13,0 % \| 13,8 %** | 4,4 % \| 4,9 % | 0,449 (0,394 / 0,499) → **0,499** (0,448 / 0,552) | +2,24 % W (+28,7 px) |
| 1024 × 768 | 14,7 % \| 34,4 % → **15,6 % \| 13,0 %** | 5,5 % \| 3,6 % | 0,565 (0,508 / 0,620) → **0,496** (0,456 / 0,544) | +8,25 % W (+84,5 px) |
| 390 × 844 | 17,3 % \| 22,1 % → **19,6 % \| 17,2 %** | 8,8 % \| 7,6 % | 0,518 (0,482 / 0,539) → **0,509** (0,484 / 0,539) | −3,85 % W |

Encre relative totale (même mesure) : 1440 20 545 → 21 481 (+5 %), 1024 11 307 → 14 944 (+32 %),
390 4 352 → 4 230 (−3 %) — l'écart vient de la graine, la densité (neurones, fibres, points)
est inchangée. En haut de page à 1440, le décile de droite descend à 2,1 % et le décile de gauche
du bas de page à 2,6 % (le lacet ± 0,16 rad fait tourner la composition) ; à la pose de référence,
les deux restent ≥ 3 % (critère n° 7 bis).

*Navigateur (Chromium sans interface, Playwright 1.63, DPR 1, serveur de développement)* :

| Mesure | Avant (passe 2) | Après (finition) | Exigence |
|---|---|---|---|
| Alpha moyen des 10 % extrêmes / 60 % centraux, `settled`, 1440 | ≈ 1,3 (prototype) | haut de page **0,54** (gauche 1,06 %, droite 0,35 %, centre 1,95 %) ; milieu **0,43** (0,75 / 0,84 / 1,97 %) | ≤ 0,8 |
| Encre (alpha moyen, `settled`) | 1440 : 1,54–1,64 % ; 1024 : 1,37–1,49 % ; 390 : 1,24–1,29 % | 1440 : **1,61–1,64 %** ; 1280 : **1,82 %** ; 1024 : **1,92 %** ; 390 : **1,20–1,26 %** | 1,2–2,2 % / 0,8–2,0 % |
| Coût p95 caméra en mouvement / arrivée, 1440 | 1,2–1,6 / 1,6–1,7 ms | **1,0 / 1,9 ms** | ≤ 4 ms |
| `settled` après le chargement ; salves de section | 5,1–5,9 s ; 2,9–4,0 s | **4,6 s** ; **2,4–3,9 s** | ≤ 6,0 s ; ≤ 4,0 s |
| Arrivée (cœurs allumés vus) 1440 / 1024 / 390 | — | 3 / 1 / 1 | ≥ 1 |
| Pixels cobalt au repos et en mouvement réduit | 0 | **0** | 0 |
| Contraste minimal (même protocole que la passe 2) | 1440 : 9,13 · 4,91 · 3,33 (réduit 3,26) ; 390 : 9,75 · 4,59 · 3,77 (3,76) | 1440 : titres encre **9,34** · petits textes **5,10** · lignes grises **3,37** autorisé, **3,44** réduit (médian 5,69) ; 390 : **9,54** · **4,86** · **3,44** autorisé, **3,37** réduit (médian 5,69) | ≥ 7 · ≥ 4,5 · ≥ 3 (médian ≥ 4,5) |

**Impulsions électriques (valeurs de la référence = plafonds, jamais augmentées).**

| Couche (de dessous à dessus) | Rayon | Opacité (× opacité de l'impulsion) | Couleur |
|---|---|---|---|
| Traînée : 4 points derrière la tête, espacés de 0,0025 (unités monde), j = 4 → 1 | r × (0,32 + 0,3 × (1 − j/5)) | 0,27 × (1 − j/5) | `--color-accent` `#2457ff` |
| Halo large | 3,5 r | 0,035 | `#2457ff` |
| Halo proche | 2,1 r | 0,10 | `#2457ff` |
| Tête | r | 0,98 | `#2457ff` (référence `rgb(32, 88, 255)`, écart invisible) |
| Reflet | 0,35 r, décalé de (−0,12 r ; −0,12 r) | 0,9 | `#dae8ff` |

- r = `(1,45 + 0,55 near) × perspective` px ; opacité = `(0,55 + 0,45 near) × force × entrée ×
  sortie`, entrée sur les 0,009 premières unités, sortie sur la traîne (U(0,012 ; 0,019)).
- **Propagation** le long de la **longueur réelle** du tracé (échantillonnage par recherche
  dichotomique sur les longueurs cumulées, interpolation entre deux points : la tête ne quitte
  jamais la fibre). Aux embranchements : poursuite dans la branche enfant avec probabilité 0,7
  (tirage à graine), force × 0,78. Au bout d'une fibre de liaison : **excitation** du neurone
  atteint, à l'instant exact d'arrivée, force × 0,79, saut + 1.
- **Excitation d'un neurone** : ignorée s'il est en période réfractaire, si la force < 0,2, si le
  nombre de sauts dépasse le maximum de la séquence, ou si l'instant dépasse l'**échéance
  d'excitation** de la séquence ; sinon : début de l'allumage, période réfractaire
  U(1 600 ; 3 200) ms ; parmi ses fibres sortantes (hors fibre d'arrivée, ordre mélangé à graine)
  : 1 fibre de liaison (2 avec probabilité 0,3) et 2 à 4 dendrites, départs décalés de
  U(45 ; 170) ms.
- **[adapt.] Vitesse** : U(0,00045 ; 0,00069) unité/ms, soit **1,5 × la référence** (≈ 190–290
  px/s à 1440 au lieu de ≈ 125–190) pour que deux sauts tiennent dans une séquence bornée. Jamais
  plus vite : si l'échéance coupe la cascade, la cascade est **plus courte**, pas plus rapide.
  *Question n° 3 du plan, à faire valider par l'utilisateur ; s'il préfère la vitesse exacte de
  la référence, multiplicateur 1,0, échéances inchangées (cascades plus courtes).* La vitesse
  est une constante unique (`SIGNAL_SPEED_FACTOR`) pour que ce choix ne touche rien d'autre.
- **[adapt.] Échéance** : un départ d'impulsion est **refusé** si son arrivée (traînée comprise)
  dépasse la fin de la séquence ; idem si le plafond d'impulsions simultanées est atteint. Rien
  n'est mis en file.

**Cœur qui s'illumine (référence ; halo discret, valeurs = plafonds).**

- Énergie d'un neurone allumé depuis `âge` ms : `E = (1 − e^(−âge/60))² × e^(−âge/620)` pour
  0 ≤ âge < 2 100, sinon 0 (montée ≈ 0,2 s, extinction ≈ 2,1 s).
- Si E > 0,01 : halo = dégradé radial cobalt du rayon 0,4 × taille au rayon `5 × taille + 8 px`,
  arrêts 0 : opacité `0,5 E (0,4 + 0,6 near)` ; 0,3 : `0,19 E (0,4 + 0,6 near)` ; 1 : 0.
- Si E > 0,025 : noyau cobalt rayon `max(1,2 ; 0,46 × taille)` opacité `0,95 E`, centre clair
  `#bfd5ff` rayon `max(0,5 ; 0,16 × taille)` opacité `0,85 E` ; le corps gagne `+ 0,18 E`
  d'opacité.
- Aucun `shadowBlur`, aucun `filter`, aucun `drop-shadow`. Ce halo est la **seule** lueur du
  lot ; il respecte la règle de direction artistique « aucun glow excessif » (opacité maximale
  0,5 au centre, nulle au bord, ≈ 2 s puis éteint).

**Séquences — les seules animations du réseau [adapt. : la référence déclenche un battement
toutes les 0,8–3 s, sans fin].**

| Séquence | Déclencheur | Déroulé | Échéance d'excitation | Fin (tout éteint) |
|---|---|---|---|---|
| **Arrivée** (`arrivee`) | Premier dessin fait, `document.fonts.ready`, puis **+ 900 ms** (les lignes du titre du hero sont posées) | Battement A à 0 ms depuis un neurone central ; battement B à **650 ms** depuis un second neurone central à ≥ 0,9 unité de A ; **3 sauts** au plus | **2 700 ms** | **≤ 4 800 ms** |
| **Section** (`probleme`, `solution`, `agents`, `controle`, `resultat`, `final`) | La section devient la scène courante (bande médiane, observateur existant) **pour la première fois** de ce chargement ; jamais `hero` | **Un** battement ; **2 sauts** au plus | **1 700 ms** | **≤ 3 800 ms** |

- **Neurone central éligible** (critère de la référence + zones calmes) : `|x| < 1,3`,
  `|y| < 0,85`, `z < 0,8`, hors période réfractaire, projeté dans les 70 % centraux de la
  fenêtre et à **≥ 48 px** de toute zone calme ; choix parmi les 3 plus éloignés des zones
  calmes, départagés à graine (graine = `DEFAULT_SEED` + nom de la séquence). Aucun éligible →
  pas de battement (la séquence est tout de même notée comme jouée).
- Chevauchement (défilement rapide) : autorisé ; le plafond d'impulsions s'applique, l'excédent
  est abandonné. Chaque séquence garde sa propre échéance.
- **Fin** : quand aucune impulsion n'est en vol et que toutes les énergies sont nulles, le
  dernier état (réseau au repos) est dessiné, `data-motion="settled"`, et **plus aucun
  `requestAnimationFrame`** n'est demandé. Aucun minuteur ne reste armé.
- WCAG 2.2.2 : chaque séquence se termine en < 5 s après son départ (arrivée 4,8 s, section
  3,8 s).

**Rendu et performance.**

- **Tracés regroupés** : opacité quantifiée au 1/20, épaisseur au 1/4 px ; un seul `stroke()` par
  couple (≤ 96 groupes par image). C'est ce qui ramène la référence de 7,7 à 3,6 ms.
- **Cache du repos** : le réseau au repos (fibres + corps) est dessiné une fois dans un canvas
  hors écran de même taille, pour la pose et les zones calmes courantes. Image de séquence à
  caméra immobile = copie du cache + halos et noyaux allumés + corps des neurones allumés +
  impulsions (cible ≤ 1,5 ms). Caméra en mouvement (défilement, dérive) = redessin complet
  regroupé, puis mise à jour du cache (≤ 4 ms p95). Invalidation : pose, taille, classe, zones
  calmes déplacées.
- **Replis si le p95 « caméra en mouvement » dépasse 4 ms à 1440 × 900 (mesure T6), dans cet
  ordre** : (1) dérive de séquence → 0 ; (2) densité de pas des branches 65 → 45 par unité ;
  (3) large : 34 → 30 neurones. Le repli appliqué est reporté ici avec la mesure. Jamais de
  modification de l'apparence des impulsions ni des cœurs.

**Derrière les textes : voiles et zones calmes.**

- **`.network-veil-title`** (nouvelle classe, **landing seulement**, `app/globals.css`) : même
  forme que `.particle-veil` (pseudo-élément, débord fondu 3 rem × 1,25 rem) mais blanc à
  **70 %** [révisé : 60 % au 01/10] : derrière les grands titres le réseau reste visible à 30 %.
  Raison : les fibres proches de la référence montent à 0,71 d'opacité (0,95 au plafond), contre
  0,28 dans l'interprétation du 01/10 ; à 60 %, une ligne `ink-subtle` passerait sous 3:1 au
  pixel le plus sombre (≈ 2,8:1 calculé), à 70 % elle reste ≈ 3,4:1. Posée sur le titre de
  chaque section et du hero, pas dans le panneau final (déjà opaque).
- **`.particle-veil`** (90 %, inchangé) — et `.particle-veil-tight` près d'un voisin — sur
  chaque **petit** texte hors carte : sur-titres, étiquette inclinée du hero, sous-titres
  (`text-lede`), preuves du hero, notes. Les voiles de bloc actuels (colonne du hero, en-tête
  « problème », `LandingHeading`) sont **scindés** : un voile par rôle de texte, dimensionné
  aux mots (`w-fit` / `inline-block`), jamais à la colonne.
- **Zones calmes** : tout bloc de texte hors surface opaque porte `data-network-quiet`. Le
  canvas lit les rectangles visibles (≤ 40) à chaque image active. Avec `d` = distance au
  rectangle : têtes, traînées, halos et noyaux allumés × `smoothstep(d / 16 px)` (**0 dans le
  texte**) ; corps cellulaires × `0,5 + 0,5 smoothstep(d / 16 px)` (moitié dans le texte) ;
  **fibres non atténuées par le canvas** : seul le voile les adoucit.
- **Seuils de contraste** (pixel le plus sombre sous chaque ligne, texte masqué ; 3 instants
  pendant l'arrivée + état `settled` ; 1440 × 900 et 390 × 844 ; tous les textes hors carte
  de `/`) : texte < 24 px (≤ 18,66 px gras) **≥ 4,5:1** (cible ≥ 5,4) ; titres en encre
  **≥ 7:1** ; lignes de titre `ink-subtle` (section « problème », grand texte) **≥ 3:1** au
  pixel le plus sombre **et ≥ 4,5:1** au pixel médian. *Tranché par l'utilisateur : option A
  (réseau visible derrière ces lignes ; mesuré 3,65:1 au pire, médian 5,69:1).* **Révisé
  (audit du 01/10)** : section amenée en haut de fenêtre, une fibre proche passait sous « vos »
  (2,97:1 / 2,90:1 réduit à 70 %). Ces deux lignes seulement sont posées sur **75 %**
  (`.network-veil-title-subtle`, landing seulement : une couche à 1/6 par ligne grise
  `[data-title-tone="subtle"]`, au-dessus du voile de bloc à 70 %) ; 75 % tient ≥ 3,3:1 même sur
  un pixel d'encre pur, quelle que soit la pose. La ligne en encre et les autres titres restent à 70 %. Ces deux lignes passent de ≈ 4,7:1 (réseau effacé) à ≥ 3:1
  (AA grand texte, 1.4.3) pour que le réseau soit réellement derrière le titre ; si
  l'utilisateur préfère l'ancien niveau, ces deux lignes reprennent `.particle-veil` (90 %).

**Comportements.**

| Situation | Rendu |
|---|---|
| Mouvement réduit | Pose fixe (lacet 0, tangage 0,055), réseau complet au repos, **aucune** impulsion, **aucun** cœur allumé, aucune rotation au défilement, aucun `requestAnimationFrame` ; `data-motion="reduced"` |
| Sans JavaScript | Pas de dessin (fond blanc) ; la page est complète |
| Onglet caché | Boucle arrêtée ; au retour, séquences en cours **annulées**, énergies à 0 → `settled` (rien ne surgit, rien n'est rejoué) |
| Redimensionnement | Anti-rebond 150 ms ; re-projection (même géométrie) ; nouvelle génération seulement si la classe change ; aucune séquence rejouée |
| Téléphone | Classe compacte (20 neurones), mêmes règles de pose, de séquences et de zones calmes ; aucun geste capturé (le canvas n'écoute rien) |

**Attributs de test** (canvas) : `data-motion` (`idle` avant l'arrivée, `sequence`, `camera`
— caméra en mouvement hors séquence —, `settled`, `reduced`, `hidden`), `data-scene`
(inchangé), `data-sequences` (séquences jouées, ex. `arrivee,probleme`), `data-nodes` (neurones),
`data-links` (fibres de liaison), `data-fibers` (toutes les fibres), `data-signals`
(impulsions en vol), `data-lit` (cœurs allumés), `data-frames` (images dessinées depuis le
chargement), `data-frame-ms` (moyenne de la dernière fenêtre active), `data-frame-ms-p95`
(+ `data-frame-ms-p95-full` : images qui redessinent le réseau ; `data-frame-ms-p95-cached` :
images qui copient le cache).

**Mesures réelles — passe 2 (01/10/2026, `frontend-ux` ; Chromium sans interface, Playwright
1.63, DPR 1, serveur de développement).** Elles remplacent les valeurs « cible » ci-dessus.

| Mesure | Valeur mesurée | Exigence |
|---|---|---|
| Neurones / fibres / liaisons / points (large) | 34 / 2 450 / 63 / 40 036 | 34 ; ≤ 2 900 ; ≤ 3 N ; ≤ 46 000 |
| Neurones / fibres / liaisons (compact) | 20 / 1 412 / 40 | 20 ; ≤ 1 700 |
| Coût p95 caméra en mouvement, 1440 × 900 (`data-frame-ms-p95`) | **1,2 – 1,6 ms** (moyenne 1,2–1,3) | ≤ 4 ms |
| Coût p95 de l'arrivée (dérive active : chaque image redessine) | **1,6 – 1,7 ms** | ≤ 4 ms |
| Coût p95 d'une image de séquence à caméra immobile (dérive mise à 0 pour la mesure) | **0,20 ms** | ≤ 1,5 ms |
| 390 × 844 (compact), p95 | 1,0 ms | ≤ 4 ms |
| Intervalle p95 entre deux images (rAF), arrivée / défilement + salve, 1440 | 16,7 / 16,8 ms (60 i/s tenues) | — |
| Repli appliqué | **aucun** (dérive de séquence conservée, 65 pas, 34 neurones) | — |
| `settled` après la fin du chargement (arrivée) | 5,1 – 5,9 s | ≤ 6,0 s |
| Salve de section → `settled` | 2,9 – 4,0 s (6 sections) | ≤ 4,0 s |
| Caméra posée après le dernier événement de défilement | 18 ms (petit pas final) ; ≤ 0,95 s pour le plus grand saut (unitaire) | ≤ 1,2 s |
| Encre (alpha moyen, `settled`) | 1440 : 1,54–1,64 % ; 1024 : 1,37–1,49 % ; 390 : 1,24–1,29 % ; 360 : 1,33–1,38 % | 1,2–2,2 % / 0,8–2,0 % |
| Pixels cobalt au repos et en mouvement réduit | 0 | 0 |
| Contraste minimal (pixel le plus sombre, texte masqué, 3 instants d'arrivée + repos, toutes sections, + section « problème » en haut de fenêtre en mouvement autorisé et réduit) | 1440 : titres encre 9,13:1 · petits textes 4,91:1 · lignes grises du titre « problème » 3,33:1 autorisé, 3,26:1 réduit (médian 5,69:1). 390 : 9,75 · 4,59 · 3,77 autorisé, 3,76 réduit (médian 5,69). *Avant correction (voile 70 %) : 2,97 / 2,90 à 1440, 3,47 / 3,44 à 390, en haut de fenêtre* | ≥ 7 · ≥ 4,5 · ≥ 3 (médian ≥ 4,5) |

*Ce que mesure `data-frame-ms`* : le travail du script de dessin (projection, enregistrement des
tracés, copies), comme la mesure de la référence (7,7 → 3,6 ms). La rastérisation se fait ensuite
dans le pipeline du navigateur et n'y figure pas. Constat de la passe 2 : quand une copie du cache
était faite à chaque image de défilement, elle forçait cette rastérisation dans le script (≈ 7 ms
de plus en rendu logiciel sans GPU) ; d'où la règle retenue ci-dessous. L'intervalle entre images
(16,7 ms au p95) montre que la cadence de 60 i/s est tenue, rastérisation comprise, dans cet
environnement.

**Écarts de mise en œuvre (passe 2), et pourquoi.**

1. **Graine par défaut** : `DEFAULT_SEED` = **20261069** (20261002 laissait une case vide dans le
   test de couverture à 390 × 844 et 1024 × 768). Couverture et espacement vérifiés dans les trois
   classes (test unitaire).
2. **Cache** : caméra en mouvement → le réseau est redessiné **directement** dans le canvas visible
   (pas de copie de cache, qui forcerait la rastérisation à chaque image) ; caméra immobile pendant
   une séquence → cache construit une fois puis copié. Avec la dérive active, l'arrivée et les
   salves redessinent à chaque image (1,6–1,7 ms p95, sous le budget).
3. **Dérive** sur la durée **effective** de la séquence (dernière impulsion et dernier cœur éteints,
   ≤ 4,8 / 3,8 s) plutôt que sur la durée plafond : la caméra revient à 0 au moment où tout s'éteint.
4. **Origine d'une séquence** : la règle de la référence (neurones centraux, 70 % central) ne
   laisse **aucun** neurone éligible dans le hero à 1440 (colonne de titre à gauche, parcours à
   droite). Repli ajouté : à défaut, tout neurone projeté dans la fenêtre moins 4 % de marge. Les
   origines évitent aussi les **surfaces opaques** (`data-network-cover` à ≥ 24 px : parcours du
   hero, panneaux solution / résultat / final, cartes du contrôle — une impulsion née derrière ne
   serait jamais vue) et le voile blanc de l'en-tête (y ≥ 120 px). À 390, l'arrivée n'a qu'une
   origine éligible et les liaisons sont longues : la cascade y est courte (un neurone allumé,
   ≈ 18 impulsions) — conséquence de la règle « plus courte, jamais plus rapide ».
5. **Voiles** (mesure de contraste) : les boîtes des glyphes débordent les boîtes de ligne
   (jambages, italique). `.network-veil-title` garde 70 % mais sa zone pleine dépasse le bloc de
   1,5 rem en haut et en bas et de 0,5 rem sur les côtés avant le fondu ; sur la landing seulement,
   `.particle-veil` dépasse de 0,375 rem × 0,25 rem (`[data-landing] .particle-veil::before`, le CRM
   est inchangé). Sans cela : 6,4:1 sous « garde » (titre encre) et 3,1:1 sous les sur-titres à 390.
6. **Voile du système « problème »** (`ProblemSystem.module.css`) : 76 % → **90 %** et débord de
   2,5 rem sur téléphone (petits textes du graphique et des causes à 4,2:1 sinon). Indice et
   navigation du carrousel des agents (posés à nu sur la page) : `.particle-veil` + zone calme
   (1,14:1 mesuré sinon, une fibre traversant la ligne).
7. Le corps cellulaire d'un neurone allumé est redessiné par-dessus le cache (il paraît un peu plus
   sombre pendant ≈ 2 s) ; les impulsions passent sous les corps du cache au lieu de dessous.
8. **Mouvement réduit** : pas d'atténuation des corps dans les zones calmes (le canvas ne se redessine
   pas au défilement, l'atténuation serait décalée) ; les voiles assurent seuls le contraste.

Captures de contrôle (passe 2) : `…/scratchpad/landing-motion/pass2/` (1440 / 1024 / 390 / 360 :
arrivée à ≈ 2 s, repos haut / milieu / bas, salve « problème », titre « problème » option A,
mouvement réduit ; comparaison côte à côte avec la démo à 1440 et 390).

#### 2.11.5 Parcours du hero, badge et graphique : joués une fois

> **`HeroJourney` remplacé le 02/10/2026 (soir)** par le bloc A (§ 2.11.8.3, en boucle, seule
> exception). Badge et graphique : inchangés.

- **`HeroJourney`** : séquence **sans** image de remise à zéro finale ni modulo. Durées : départ
  (tout « en attente ») **300 ms** ; chaque agent **420 ms** ; validation humaine : attente
  **1 000 ms** puis validée **300 ms** ; mandat : attente **700 ms** puis confirmé (état final)
  — total **4 700 ms**. Démarrage à la première entrée dans l'écran (≥ 50 % visible, une fois) ;
  transition des rangées inchangée (220 ms). Avant le démarrage et après : état final (toutes
  les étapes terminées, mandat « confirmé »). Mouvement réduit : état final, aucun minuteur.
  Onglet caché pendant la lecture : saut à l'état final.
  Note : « Illustration jouée une fois. Aucun prospect réel, aucun envoi. »
- **Option « Rejouer l'illustration » : écartée** (décision de l'utilisateur, question n° 1
  du plan). Aucun bouton sous le parcours : la note d'illustration occupe seule la ligne.
- **Badge « Simulation »** sur `/` : `[data-landing] .simulation-badge, [data-landing]
  .simulation-dot { animation-iteration-count: 1 }` (attribut `data-landing` posé par
  `app/(marketing)/page.tsx`) — un cycle (3 s / 2 s) puis immobile. CRM inchangé.
- **Graphique du problème** : `CAPACITY_DELAY_MS` = `FRICTION_DELAY_MS` + 700 → dernière
  animation finie **≤ 4 900 ms** après le déclenchement (au lieu de ≈ 5 100).

#### 2.11.6 `MotionToggle` : retiré (WCAG 2.2.2)

Le critère 2.2.2 (« Pause, Stop, Hide », niveau A) n'exige un mécanisme de pause que pour une
information en mouvement qui **démarre automatiquement, dure plus de 5 s** et est présentée en
parallèle d'autre contenu. Après ce lot : titre du hero 1,4 s ; parcours 4,7 s ; arrivée du
réseau 4,8 s (départ 0,9 s après le premier dessin) ; titres de section ≤ 2,5 s ; séquences de
section ≤ 3,8 s *(révisé 02/10 — référence utilisateur : 2,9 s au 01/10)* ; graphique ≤ 4,9 s ;
~~wordmark 1,6 s~~ *(wordmark retiré le 02/10)* ; badge 3 s ; icônes < 5 s. La rotation au
défilement (et la caméra qui se pose en < 1,2 s après l'arrêt du geste) et le **rejeu d'un
titre au survol (≤ 1,4 s, § 2.11.2 D)** sont déclenchés par l'utilisateur. Plus rien ne dépasse 5 s : **`MotionToggle`,
`landing-motion.ts`, les sélecteurs `html[data-landing-motion="paused"]` et
`LANDING_TEXTS.motion` sont supprimés.** Condition : le test « aucune boucle » (§ 2.11.7, n° 1)
passe ; sinon le bouton reste. Le réglage système `prefers-reduced-motion` reste l'arrêt
global (état final immédiat).

#### 2.11.7 Critères d'audit mesurables

> **02/10/2026 (soir)** : les critères 1 (exception du bloc A), 2, 3, 4, 6 bis (trois titres),
> 6 et 10 (panneau final, notes) sont complétés ou remplacés par le § 2.11.8.6.

1. **Aucune boucle** (1440 × 900 et 390 × 844, mouvement autorisé, pointeur hors de la page) :
   7 s après le chargement, (a) **aucun appel à `requestAnimationFrame`** pendant une fenêtre
   de 2 s (compteur posé par un script d'initialisation qui enveloppe la fonction), (b) deux
   captures pleine fenêtre à 1 s d'écart **identiques au pixel**, (c) `data-frames` du réseau
   inchangé ; idem après avoir amené chaque section au centre puis attendu 5 s ;
   `document.getAnimations()` ne contient aucune animation à `iterations` infinie ; aucun
   minuteur du réseau armé (`data-signals="0"`, `data-lit="0"`).
2. **Durées** : trait du hero complet ≤ 1,45 s ; titres « problème », solution, agents,
   contrôle, résultat et final nets (tous les mots `filter: none`) ≤ 2,5 s après l'entrée,
   cadre à opacité 0, trait complet sous « chemin », « s'arrête », « décide », « commencer »
   et « fictive » ; parcours dans l'état final
   ≤ 5,2 s après le chargement à 1440 ; réseau `settled` ≤ **6,0 s** après le chargement
   (arrivée : départ + 0,9 s, durée ≤ 4,8 s) ; séquence de section `settled` ≤ 4,0 s après
   l'entrée ; caméra posée ≤ 1,2 s après la fin d'un défilement.
3. **Pendant les effets** (≈ 0,9 s après l'entrée) : mots non accentués `blur(5px)` (3 px sous
   640 px), mot accentué `filter: none` et opacité 1, cadre opacité 1, branches de 16 × 3 px à
   1440 (12 × 2 px à 390), aucune branche sur un glyphe — vérifié aussi sur « chemin »,
   « s'arrête », « décide », « commencer » ; le trait ne touche pas la virgule de « chemin, »
   (§ 2.11.2, « Géométrie à vérifier par mot nouveau »).
4. **Mouvement réduit**, sans JS : à l'instant 0, trait présent (hero, solution, agents,
   contrôle, résultat, final), aucun cadre, aucun flou, parcours final, réseau `reduced` sans
   cobalt. *(« wordmark en HTML sans canvas » : retiré le 02/10.)*
5. **Hauteur de ligne** : écart ≤ 0,5 px avec et sans ornements (les sept titres ; 1440 et 390).
6. ~~**Wordmark**~~ — *remplacé le 02/10 (wordmark retiré)* : **fin du panneau final** — aucun
   élément `[data-testid='tech-wordmark']`, aucun canvas dans le panneau, aucune occurrence de
   `TechWordmark`, `tech-wordmark`, `paint-wordmark`, `wordmark-engine` ni `TechText` dans
   `app/`, `components/`, `e2e/` et `THIRD_PARTY_NOTICES.md` ; la note « Prototype de
   démonstration… » est le dernier élément du panneau, 16 px (± 1) sous le bas des boutons,
   et le bas du panneau est à 32 px (< 1024) / 48 px (≥ 1024) sous la note (± 1) ; aucun
   débordement à 1440 / 1024 / 390 / 360.
6 bis. **Rejeu au survol** (§ 2.11.2 D ; 1440 × 900, souris) : pour chacun des sept titres,
   après la fin de l'entrée, entrer le pointeur → `data-accent-replay="running"`,
   `data-accent-replays` + 1 ; à + 300 ms (types `focus*`) mots non accentués `blur(5px)`, cadre
   opacité ≥ 0,9, mot accentué net ; (hero) trait partiellement ou totalement effacé à
   + 150 ms ; à + 1 600 ms : attribut retiré, mots `filter: none`, opacité 1, cadre opacité 0,
   trait sans découpe (`underline`, `focus-underline`), `getAnimations({ subtree: true })` vide,
   boîte de ligne inchangée (≤ 0,5 px). Puis : sortir / rentrer à + 500 ms d'un rejeu → aucun
   nouveau rejeu ; à fin + 300 ms → aucun ; à fin + 900 ms → un rejeu ; rester et bouger dans
   le titre → un seul rejeu ; survol pendant l'entrée (hero à 300 ms du chargement, section à
   500 ms de l'entrée) → ignoré et **l'entrée n'est pas relancée**. Mouvement réduit, et
   contexte tactile (390 × 844, `hasTouch`, pointeur grossier) : aucun rejeu, aucune animation.
   Le test « aucune boucle » (n° 1) passe toujours, pointeur hors de la page.
7. **Réseau** *(révisé 02/10 — référence utilisateur)* : `data-nodes` = 34 / 28 / 20 selon la
   classe ; fibres et points sous les plafonds ; **lecture « neurones espacés, pas un tapis »** :
   distance minimale entre deux neurones > 0,30 (unités monde), chaque case d'une grille 3 × 3
   de 1440 × 900 contient au moins un corps cellulaire projeté (2 × 3 à 390 × 844), chaque tuile
   de 240 × 240 px est traversée par au moins une fibre ; **encre** (alpha moyen du canvas,
   `settled`, avant voiles) : 1,2–2,2 % (large, moyen), 0,8–2,0 % (compact) — référence mesurée
   1,4–1,8 % à 1440 ; `data-sequences` contient chaque scène au plus une fois ; coût p95 ≤ 4 ms
   caméra en mouvement, cible ≤ 1,5 ms en séquence à caméra immobile ; `data-frames` stable en
   `settled` ; capture comparée côte à côte avec la référence (corps irréguliers, arbres
   dendritiques qui s'affinent, liaisons sinueuses, impulsions à reflet et traînée, cœur qui
   s'illumine) : verdict visuel écrit dans l'audit.
7 bis. **Composition centrée, bords atténués** (*02/10 — finition*, § 2.11.4) — test unitaire
   (géométrie, pose de référence, encre relative des fibres dans la fenêtre) : centre de masse
   horizontal **∈ [0,47 ; 0,53] W** à 1440 × 900, 1280 × 800, 1024 × 768, 390 × 844 ; ∈
   [0,42 ; 0,58] W en haut (p = 0) et en bas (p = 1) de page ; chacune des deux bandes
   latérales de 20 % porte **≤ 20 %** et ≥ 8 % de l'encre ; chaque décile extrême ≥ 3 % (bords
   jamais vides) ; `offsetX` ≤ 10 % de W et identique d'un calcul à l'autre (déterministe) ;
   `f(0) = 0,80`, `f(u ≥ 0,15) = 1`, `f` croissante ; aucun neurone avec z < 0,1 pour
   \|x\| ≥ X. **E2E** (canvas, `settled`, 1440 × 900, haut et milieu de page) : alpha moyen des
   deux bandes extrêmes de 10 % ≤ **0,8 ×** l'alpha moyen des 60 % centraux (prototype ≈ 0,4 ;
   avant ≈ 1,3) ; encre totale dans les fourchettes du n° 7 (inchangées) ; coût p95 ≤ 4 ms
   inchangé ; contraste n° 8 re-mesuré ; 0 pixel cobalt au repos.
8. **Contraste** : seuils du § 2.11.4 sur tous les textes hors carte de `/` ; voile de titre
   à 70 % (75 % sous les deux lignes grises du titre « problème »).
9. **Couleurs** : aucun pixel rouge ; cobalt uniquement sur traits, cadres, impulsions, cœurs
   *(« cadre du wordmark » retiré le 02/10)* ; **en `settled` et en mouvement réduit, aucun pixel cobalt dans le canvas
   du réseau** ; aucun `shadowBlur`, `drop-shadow` ni `filter` dans les fichiers du lot ; seuls
   dégradés : halo des cœurs (valeurs plafonds du § 2.11.4) et calque d'atmosphère blanc.
10. **Garde-fous** : « Simulation », « Exemple fictif — simulation », « Animations : exemple
    fictif, simulation. Aucune activité en direct. », « Aucun prospect réel, aucun envoi. »,
    note finale, validation humaine et mandat confirmé par un humain : présents et lisibles.
11. **Non-régression du CRM** : `e2e/particules.spec.ts`, `e2e/voiles-lisibilite.spec.ts`,
    `e2e/premier-regard.spec.ts` passent ; badge « Simulation » toujours animé dans le CRM.

#### 2.11.8 Révision « modèles MIG / Striker » (02/10/2026, soir) — effets uniques, blocs A, B, C

> Statut : **spécifié** le 02/10/2026 par le `web-designer`, demande **validée** par l'utilisateur
> (source : `docs/references/2026-10-02-modeles-mig-striker.md`, capture du modèle C fournie).
> Plan : `docs/plans/2026-10-02-landing-modeles.md` (deux lots indépendants). Branche
> `feat/landing-polish`. Périmètre : **`/` seulement**. Inchangés : réseau de fond (§ 2.11.4),
> voiles (`.particle-veil`, `.network-veil-title`), CRM, `/estimation`, sections problème,
> agents, résultat (sauf l'effet de leur titre). Aucune dépendance npm (ni Swiper, ni GSAP, ni
> `motion`) : CSS, SVG, DOM et canvas 2D faits main.
>
> **Ce paragraphe prime** sur les passages contraires du § 2.11 (règle 1 du § 2.11.1, tableau
> du § 2.11.2, § 2.11.3 et 2.11.3 bis, `HeroJourney` du § 2.11.5, critères 1, 2, 3, 4, 6, 6 bis
> du § 2.11.7), qui portent un renvoi ici.
>
> **Avancement Lot 1 (02/10/2026, `frontend-ux`) — implémenté et testé** : effets uniques
> (`tech` sur « décide », props `tone` / `align`) et bloc A. Fichiers : `components/ui/tech-accent/`
> (`TechAccent.tsx`, `TechAccent.module.css`, `tech-accent.ts`, `paint-tech-accent.ts`,
> `tech-accent-engine.ts`), `components/landing/ecosystem/` (`HeroEcosystem.tsx`,
> `ecosystem-timeline.ts`, `EcosystemCard.tsx`, `CursorYou.tsx`, `ConvergingLines.tsx`,
> `ecosystem.module.css`) ; `HeroJourney` et `journey-timeline` supprimés. **Mesures réelles**
> (Chromium, 1440 × 900) : « décide » 150,84 px découpé en lettres = 150,84 px en texte continu
> (écart 0) ; balayage démarré **+ 770 ms** après l'entrée, repos **+ 2 296 ms** ; coût d'une
> image active 0,0–0,3 ms (première image 1,8 ms, mesure des lettres comprise) ; lettre « e »
> peinte = lettre HTML (≤ 1 px sur les quatre bords) ; cycle du bloc A **9 798 ms** (ordonnanceur
> sans dérive : chaque pas part de l'heure idéale de fin du précédent) ; bande 1 du hero : bas à
> **526 px**, haut des cartes à **662 px** (< 900, critère A1). **Écarts à la spécification**
> (signalés, à valider à l'audit) : (1) pastille « Agent » / « Vous » posée sur la **deuxième
> ligne de l'en-tête**, à droite du rôle — à 216 px, « Validation humaine » était tronqué à côté
> de la pastille ; (2) fondu des bords (`mask-image` 24 px) **sous 1024 px seulement** — à ≥ 1024
> rien n'est dessous, et le fondu effaçait la moitié de l'étiquette « Vous » du curseur posé sur
> le Mandat ; (3) lignes convergentes **mesurées côté client** : absentes du HTML sans
> JavaScript (décor ; tout le reste de la figure y est) ; (4) carrousel : la dernière carte ne
> peut pas être centrée avec le rembourrage de 24 px, le point l'amène entièrement en vue ;
> (5) tactile : le balayage d'arrivée de « décide » joue aussi (une fois), puis plus rien
> (« aucun canvas » du critère T3 lu comme « canvas vide, aucun rejeu ») ; (6) coche : petit SVG
> local reprenant la géométrie de l'icône `check` (trait blanc tracé, `pathLength`) ; (7) deux
> curseurs « Vous » : un fixe dans la case du Mandat (HTML serveur, mouvement réduit), un mobile
> dans la piste (mouvement autorisé). **Correctif annexe** (`app/globals.css`) : le voile 75 %
> des lignes grises du titre « problème » n'agrandit plus la zone défilable du `h2` (778 → 722 px
> à 1440, 398 → 342 px à 390) — positionnement par ancre (`anchor-name`, sous `@supports`),
> pixels identiques avant / après (captures comparées à 1440 et 390).

##### 2.11.8.1 Règles de l'utilisateur, traduites

1. **Un effet de titre n'apparaît qu'une fois sur `/`.** Trois titres ont un effet, chacun
   différent ; les quatre autres n'en ont **aucun** (ni cadre, ni trait, ni flou tenu, ni rejeu).
2. **Les animations nouvelles vivent seulement dans les blocs A, B, C.** Rien d'autre n'est
   ajouté.
3. **Bloc A en boucle** (seule exception à la règle « aucune boucle », § 2.11.1 n° 1) : pause
   hors écran et onglet caché, mouvement réduit = état final fixe. **B et C** : joués à
   l'arrivée et à l'interaction, bornés, jamais en boucle, **aucun défilement automatique**.
4. **Couleurs** : noir, blanc, gris ; cobalt `--color-accent` `#2457ff` en micro-accent
   (actif, curseur « Vous », progression, cible) ; **aucun rouge** (aucun point
   « enregistrement » rouge, aucune cible rouge du modèle C). Aucune photo, aucune personne
   réelle, aucun chiffre présenté comme une statistique. Tout exemple porte « Simulation » /
   « Exemple fictif ».
5. On reproduit la **composition, le rythme et le mouvement** des modèles (≈ 90 %), jamais leur
   code, leurs images, leurs textes ; rien n'est chargé depuis leurs serveurs.

##### 2.11.8.2 Effets de titre : trois titres, trois effets

| Titre (`/`) | Mot | Effet | Rejeu au survol | Décision |
|---|---|---|---|---|
| Hero (`h1`) | main | `underline` (A, § 2.11.2) | oui (§ 2.11.2 D) | **inchangé** |
| Problème | administratif | `focus` (B, § 2.11.2) | oui | **inchangé** |
| Contrôle | décide | **`tech`** — nouveau, ci-dessous | oui (variante tech) | **nouveau** (remplace `focus-underline`) |
| Solution | chemin | aucun (`none`) | non | retiré |
| Agents | s'arrête | aucun | non | retiré |
| Résultat | commencer | aucun | non | retiré |
| Final (bloc C) | fictive | aucun ; **titre centré, blanc sur le panneau noir** | non | retiré |

- Les titres sans effet gardent leur **typographie** (§ 2.2 : Bricolage 600, mot accentué en
  Instrument Serif italique) et leur **apparition ligne par ligne** du § 2.2.7 (arrivée de base
  commune à tous les titres, pas un effet du mot accentué). *À confirmer par l'utilisateur à
  l'audit — voir « À transmettre » du rapport.*
- `focus-underline` n'est plus utilisé sur `/` : le code reste dans `EditorialTitle` (testé,
  réutilisable), aucun titre ne le pose.
- Le rejeu au survol (§ 2.11.2 D) ne concerne plus que **hero, problème, contrôle**. Les
  quatre autres titres ne portent ni `accentReplay`, ni `data-accent-replayable`.

**Pourquoi « décide » reçoit l'effet tech.** L'effet TechText est un **outil de sélection** :
cadre à poignées, étiquette de mesure, lettre qu'on attrape. C'est le geste d'un humain qui
prend la main sur un objet — exactement le sens de « Votre équipe *décide* ». Placé ailleurs
(« chemin », « commencer »), il serait décoratif. Second argument : la section contrôle n'a pas
d'autre animation (cartes des garde-fous statiques), alors que solution (bloc B) et final
(bloc C) en reçoivent : le mouvement est réparti sur la page au lieu de s'empiler. Le titre est
court (deux lignes), le mot est en fin de titre : l'étiquette de mesure se pose **sous** la
lettre sans recouvrir une autre ligne.

**Effet `tech` sur « décide »** (d'après TechText de React Bits, déjà adapté le 01/10 pour le
wordmark — historique au § 2.11.3 ; code récupérable par
`git show f83805c^:components/landing/wordmark/<fichier>` : `tech-wordmark.ts`,
`paint-wordmark.ts`, `wordmark-engine.ts`, `TechWordmark.tsx`, `TechWordmark.module.css` et
leurs tests). Le titre **reste du texte HTML** : nom accessible inchangé (« L'IA prépare. Votre
équipe décide. », copie `sr-only` existante) ; tout l'effet est décoratif (`aria-hidden`).

| Paramètre | Valeur | Note |
|---|---|---|
| Lettres | le mot accentué découpé en `span` `inline-block` (d · é · c · i · d · e), `font-kerning: none` sur ces `span` seulement | Instrument Serif italique 400, `--color-ink`. Largeur du mot : écart ≤ 2 px avec le rendu actuel ; boîte de ligne : écart ≤ 0,5 px (critère § 2.2.5) |
| Taille | celle du titre (`text-statement` : 64 / 60 / 36 px à 1440 / 1024 / 390) | Aucun agrandissement |
| Boîte d'une lettre | **encre** mesurée (`measureText` : `actualBoundingBox*`) sur la police lue dans le `span` (`getComputedStyle`), après `document.fonts.ready` | L'italique déborde de sa boîte : on cadre l'encre, pas la boîte CSS |
| Cadre | rectangle cobalt 1 px autour de l'encre + 4 px ; 4 poignées carrées 5 × 5 px (fond blanc, trait cobalt 1 px) ; glissement de lettre en lettre 160 ms, `--ease-emphasis` | Valeurs du § 2.11.3 |
| Étiquette | Geist Mono 11 px 500, « d  28 × 46 » (lettre, largeur × hauteur de l'encre en px CSS arrondis), **blanc sur cobalt** (5,4:1), rayon 4 px, marge 2 × 6 px, posée **6 px sous** le cadre, alignée sur son bord gauche | Sous le cadre : « décide » est sur la dernière ligne, il n'y a pas de place au-dessus (interlignage 1) ; sous le mot, 24 px libres jusqu'au paragraphe |
| Contour pointillé | tiret 4 / espace 2 / trait 1,5 px CSS, **contour extérieur seul** (technique `destination-out` du § 2.11.3) ; portée 0,75 em autour du pointeur, adoucie sur 35 % | Couleur encre |
| Specks | 10 (≥ 768 px, pointeur fin) ; 6 (compact) ; carrés 2–4 px, moitié cobalt (0,9), moitié encre (0,5), dans la boîte de la lettre élargie de 0,25 em, graine fixe ; 2 clignotements de 360 ms, décalage 40 ms, au changement de lettre seulement | — |
| Glisser une lettre | souris et stylet seulement ; déplacement plafonné à 0,6 em (frein progressif) ; au relâcher, ressort `k` 220, amortissement 22 : retour < 0,5 px en ≤ 700 ms, dépassement ≤ 6 px ; Échap = relâcher | Valeurs du § 2.11.3 |
| Canvas | `position: absolute` dans `.title-accent`, débord 32 px en haut, 32 px à gauche et à droite, **44 px en bas** (étiquette) ; `pointer-events: none` ; DPR plafonné à 2 ; **vide au repos** (aucune boucle `requestAnimationFrame`) | Les `span` passent en `visibility: hidden` seulement pendant un état actif ; écart lettre HTML / lettre peinte ≤ 1 px |

| Situation | Comportement |
|---|---|
| Sans JS, avant hydratation, mouvement réduit | Le mot en HTML, plein, encre, immobile. **Aucun canvas monté**, aucun écouteur |
| Arrivée (une fois) | Déclencheur : le `Reveal` de la section passe en `entering` (titre ≥ 60 % visible) ; **délai 760 ms** (les deux lignes du titre sont arrivées à ≈ 700 ms ; le mot accentué est net dès 220 ms). Le cadre se pose sur « d » (160 ms), glisse d → é → c → i → d → e (160 ms + 60 ms d'arrêt par lettre), la zone de contour suit le cadre, specks au changement de lettre ; après le « e », le cadre s'efface en 200 ms. **Durée ≤ 1 600 ms** → fin ≤ 2 360 ms après l'entrée, puis repos |
| Rejeu au survol | Mêmes conditions que le § 2.11.2 D (souris ou stylet, `(hover: hover) and (pointer: fine)`, mouvement autorisé, arrivée terminée, aucun rejeu en cours, ≥ 800 ms depuis le précédent, entrée du pointeur dans la boîte du `h2`). Effet : **le balayage rejoue**, sans délai, ≤ 1 600 ms ; `data-accent-replay="running"` pendant le balayage, `data-accent-replays` + 1 |
| Pointeur sur le mot | Dès que le pointeur est à moins de la portée d'une lettre du mot, le **suivi** prend la main (le balayage en cours s'arrête là où il est, le cadre glisse en 160 ms vers la lettre la plus proche) : lettres dans la portée en contour pointillé, cadre + étiquette sur la plus proche. Pointeur immobile 600 ms → plus de speck. Le pointeur quitte le `h2` → retour au plein en 200 ms, canvas vidé, repos |
| Tactile, pointeur grossier, clavier | Rien après l'arrivée (pas de rejeu, pas de toucher qui montre le cadre). `touch-action` du titre inchangé : **le défilement n'est jamais bloqué**. Le titre n'est pas focusable |
| Onglet caché pendant un état actif | Arrêt, retour au repos au retour sur l'onglet |

- Attributs de test sur le `h2` : `data-accent-effect="tech"`, `data-tech-state`
  (`idle` | `sweep` | `follow` | `drag` | `spring`), `data-accent-replays`.
- Contrôleur : le comportement est porté par un îlot client unique dans le mot (ex.
  `TechAccent`) ; `AccentReplayController` **ignore** `[data-accent-effect="tech"]` (pas de
  double rejeu). `EditorialTitle` reste un Server Component.
- Coût : ≤ 2 ms par image active (mesuré 0,20–0,30 ms pour le wordmark le 01/10).
- Notice : la section « React Bits — TechText » revient dans `THIRD_PARTY_NOTICES.md` (texte
  de licence MIT + Commons Clause recopié **à l'identique** de `git show
  f83805c^:THIRD_PARTY_NOTICES.md`), « Adapted in » mis à jour vers les nouveaux fichiers, et
  l'en-tête de chaque fichier adapté reprend la mention « Adapted from React Bits — TechText ».

##### 2.11.8.3 Bloc A — « Vous » dans l'écosystème des agents (remplace `HeroJourney`)

**Idée unique** : cinq agents préparent, **vous** cochez les deux décisions. **En cinq
secondes** : des cartes d'agents se cochent toutes seules, puis un curseur « Vous » vient cocher
la validation du premier message, puis celle du mandat. **Scène** : rangée de cartes de travail
(modèle MIG « écosystème »), lignes fines qui convergent vers l'action « Demander une
estimation ». **Texte restant** : une phrase de garde-fou et la mention de simulation.

**Place et recomposition du hero.** La rangée a besoin de toute la largeur : elle ne tient pas
dans la colonne droite du hero (≈ 560 px). Le hero devient deux bandes dans la même `section`
(`data-living-scene="hero"`, `aria-labelledby="hero-title"`) :

| Bande | ≥ 1024 px | < 1024 px |
|---|---|---|
| 1. Texte | Grille **inchangée** `lg:grid-cols-[1.08fr_0.92fr]`, `lg:items-end`, `gap-16`. Colonne gauche : étiquette inclinée + `h1` (colonne `@container` **identique** : taille du poster inchangée, 84,7 px à 1440). Colonne droite : sous-titre, deux actions, bloc « Ce que le prototype fait réellement » (même ordre, mêmes voiles, mêmes classes ; preuves en `sm:grid-cols-2`) | Une colonne, ordre inchangé : étiquette, titre, sous-titre, actions, preuves |
| 2. Bloc A | Pleine largeur de fenêtre (sort du `max-w-7xl` : `w-screen` centré, la racine `[data-landing]` est déjà en `overflow-x-clip`), `mt-20` (1024–1439 : `mt-16`) | `mt-14`, carrousel |

`min-h-[calc(100dvh-4.5rem)]` est retiré du hero (la hauteur suit le contenu) ; rembourrages
`pt-14 lg:pt-20` inchangés, bas `pb-16 lg:pb-24`. À 1440 × 900, le haut des cartes doit être
visible sans défiler (bas de la bande 1 ≈ 560 px ; critère n° A1).

**Anatomie (≥ 1440 px, 6 colonnes).**

```
            [Simulation] Exemple fictif — simulation
 ┌Léa──────┐            ┌Valid.───┐
 │ ▢ ▢ ▢   │ ┌Emma────┐ │ ◯ ◯     │ ┌Louis───┐            ┌Mandat──┐
 └─────────┘ │ ▢ ▢    │ └─────────┘ │ ▢ ▢    │ ┌Sarah───┐ │ ◯      │
 ┌Hugo─────┐ └────────┘             └────────┘ │ ▢ ▢ ▢  │ └────────┘
 │ ▢ ▢ ┄   │                                   └────────┘
 └─────────┘        ╲   ╲    │    ╱   ╱   ╱   (lignes à 7 %)
                     [ Demander une estimation → ]
             Les agents préparent. Vous validez … confirmez …
     Illustration en boucle, exemple fictif. Aucun prospect réel, aucun envoi.
```

| Élément | Valeurs |
|---|---|
| Légende (au-dessus) | Centrée : `SimulationBadge` + « Exemple fictif — simulation » (`text-xs font-medium text-ink-muted`), `gap-2`, 24 px au-dessus des cartes. Sur un voile `.particle-veil-tight` (texte sur le réseau) |
| Rangée | Colonnes de **216 px**, espacement **16 px**, centrées : 6 × 216 + 5 × 16 = **1 376 px** (marge ≥ 32 px à 1440). Colonne 1 = Léa au-dessus de Hugo (empilées, `gap-4`) ; puis Emma, Validation humaine, Louis, Sarah, Mandat. **Décalages verticaux** (marge haute, pas de `transform`, pour que les lignes mesurent juste) : 0 / 40 / 12 / 56 / 20 / 64 px. Bords de la fenêtre : `mask-image` en fondu sur les 24 px extérieurs (aucun contenu dessous) |
| Carte (agent) | `bg-surface` opaque (`data-network-cover`), bord 1 px `--color-line`, **rayon 24 px** (`rounded-xl`), `shadow-raised`, rembourrage 10 px. En-tête 40 px : tuile `AgentAppIcon` `kind="agent"` `size="sm"` (28 px, carré sombre) + prénom (14 px, 500, `ink`) au-dessus du rôle (12 px, `ink-subtle`) + à droite pastille « Agent » (11 px 500, `ink-subtle` sur `surface-sunken`, rayon 999, 2 × 8 px, 5,2:1) |
| Carte (humaine) | Même boîte **+ double contour** : `outline: 1px solid var(--color-ink)` à `outline-offset: 3px` en plus du bord (la forme dit « humain », § 1.1). Tuile `AgentAppIcon` `kind="human"` (cercle à double contour, glyphe `humanValidation`) ; Mandat : `kind="outcome"`, glyphe `mandate`. Pastille « Vous » (11 px 600, `ink`, bord 1 px `ink`) + **case ronde 10 px** à droite dans la pastille : vide, puis pleine encre quand toutes les lignes de la carte sont cochées |
| Ligne de tâche | Pilule bordée : hauteur 36 px, rayon 999, bord 1 px `--color-line`, rembourrage 0 10 px, `gap-2` ; icône `Icon` `sm` 14 px **`dimmed`** (gris, immobile : pas de pluie d'accents cobalt) ; libellé 13 px 500 `ink`, une ligne, `truncate` ; case à droite. Lignes espacées de 6 px |
| Case agent | Carré 16 × 16, rayon 4, bord 1,5 px `--color-line-strong` ; cochée : fond `--color-inverse`, coche blanche (glyphe `check` 12 px) |
| Case humaine | **Rond** 18 px, double contour (anneau 1,5 px `ink` + anneau extérieur 1 px `ink` à 2 px) ; cochée : disque `--color-inverse`, coche blanche. Forme ≠ case agent : la différence ne repose pas sur la couleur |
| Ligne « manquante » (Hugo) | Pilule en **pointillé** `--color-line-strong`, libellé « Motivation » + « à demander » (12 px `ink-subtle`), case carrée en pointillé, **jamais cochée** |
| Carte active | Anneau cobalt 1 px par-dessus le bord (pseudo-élément, opacité 0 → 1 en 220 ms, `--ease-standard`) pendant que ses lignes se cochent |
| Curseur « Vous » | Flèche SVG 20 × 20 pleine `--color-accent`, contour blanc 1,5 px ; étiquette « Vous » (Geist 12 px 600, blanc sur cobalt, 5,4:1, rayon 999, 2 × 8 px) décalée de (14 ; 16) px de la pointe. Position de repos (« parc ») : 24 px sous et 16 px à gauche de la première case de « Validation humaine » — le conseiller **attend** pendant que les agents travaillent |
| Lignes convergentes | SVG sous la rangée, hauteur **112 px**, une ligne par colonne : du bas de la colonne (+ 8 px) au haut du bouton, courbe `M xᵢ,y₀ C xᵢ,y₀+0,55h  x_c,y₁−0,55h  x_c,y₁`, trait 1 px `--color-ink` à **opacité 0,07**, `vector-effect: non-scaling-stroke`. Recalculées au redimensionnement (`ResizeObserver`), jamais animées |
| Action | `ButtonLink` `primary` `lg` « Demander une estimation » (`LANDING_TEXTS.actions.estimation`), `arrow="forward"`, centré, vers `/estimation` |
| Carte de texte | 16 px sous le bouton, centrée, `max-w-[22rem]`, `bg-surface`, bord 1 px `line`, rayon 16 px, rembourrage 12 × 16, `text-sm text-ink-muted text-center` : « Les agents préparent. Vous **validez** le premier message et **confirmez** le mandat. » — les deux mots en gras sont en `text-ink font-medium` |
| Note | 12 px sous la carte, centrée, `text-xs text-ink-subtle`, sur voile serré : « Illustration en boucle, exemple fictif. Aucun prospect réel, aucun envoi. » ; puis la mention existante `hero.illustrationNote` (« Animations : exemple fictif, simulation. Aucune activité en direct. »), inchangée, à 4 px |

**Contenu exact des cartes** (`LANDING_TEXTS.journey.cards`, icônes de `components/icons/`) :

| Carte | Tuile (glyphe, nature) | Lignes (icône · libellé · qui coche) |
|---|---|---|
| Léa · Acquisition | `lea`, agent | `search` · Source vérifiée · agent ; `merge` · Doublon écarté · agent ; `contacts` · Fiche créée · agent |
| Hugo · Qualification | `hugo`, agent | `deal` · Bien et secteur · agent ; `clock` · Délai du projet · agent ; `question` · Motivation — à demander · **manquante** |
| Emma · Relation | `emma`, agent | `email` · Consentement vérifié · agent ; `messages` · Message préparé · agent |
| Validation humaine · Conseiller | `humanValidation`, humain | `document` · Message relu · **Vous** ; `humanValidation` · Message validé · **Vous** |
| Louis · Rendez-vous | `louis`, agent | `calendar` · Créneau proposé · agent ; `document` · Dossier préparé · agent |
| Sarah · Suivi | `sarah`, agent | `document` · Compte-rendu lu · agent ; `tasks` · Actions créées · agent ; `mandate` · Mandat signalé · agent |
| Mandat · Conseiller | `mandate`, aboutissement | `mandate` · Mandat confirmé · **Vous** |

Règle métier visible : **aucune case humaine n'est jamais cochée sans le curseur « Vous »**, et
Sarah « signale » le mandat sans le déclarer.

**Boucle — chronologie d'un cycle (9 800 ms).** Un seul ordonnanceur à minuteurs
(`setTimeout`), **aucun `requestAnimationFrame`**, aucune animation CSS infinie : chaque pas
pose un état, les transitions CSS font le mouvement (`transform`, `opacity` seulement). Coche
d'une case : fond opacité 0 → 1 et `scale(0.6)` → `scale(1)` en 200 ms `--ease-emphasis`, puis
coche tracée (`stroke-dashoffset` 1 → 0) en 160 ms, délai 60 ms. Cadence agent : une case toutes
les **280 ms**.

| t (ms) | Événement |
|---|---|
| 0 → 240 | **Remise à zéro** : toutes les coches s'effacent ensemble (opacité → 0, `scale(0.6)`, 240 ms, `--ease-exit`) ; pastilles « Vous » vidées |
| 0 → 900 | Le curseur revient de la case du Mandat au parc (900 ms, `--ease-emphasis`) |
| 900 / 1 180 / 1 460 | Léa coche ses 3 lignes (anneau actif 900 → 1 740) |
| 1 740 / 2 020 | Hugo coche 2 lignes ; **2 300** : la case « Motivation » trace son pointillé (200 ms) et reste vide (anneau 1 740 → 2 580) |
| 2 580 / 2 860 | Emma coche 2 lignes (anneau 2 580 → 3 140) |
| 3 140 → 3 620 | Validation humaine active ; le curseur glisse du parc à la case 1 (480 ms, `--ease-emphasis`) |
| 3 620 → 3 740 | Clic : curseur `scale(0.88)` → 1, case `scale(0.92)` → 1 (120 ms) ; coche à 3 700 |
| 3 860 → 4 140 | Glisse vers la case 2 (280 ms) ; clic 4 140 → 4 260, coche à 4 220 ; pastille « Vous » pleine ; anneau éteint à 4 500 |
| 4 500 / 4 780 | Louis coche 2 lignes (anneau 4 500 → 5 060) |
| 5 060 / 5 340 / 5 620 | Sarah coche 3 lignes (anneau 5 060 → 5 900) |
| 5 900 → 6 620 | Mandat actif ; le curseur glisse jusqu'à sa case (720 ms, `--ease-emphasis`) |
| 6 620 → 6 740 | Clic, coche à 6 700 ; pastille « Vous » pleine |
| 6 740 → 9 800 | **Tenue de l'état final** (3 060 ms), anneau du Mandat éteint à 7 200 ; puis cycle suivant |

Le déplacement du curseur est un **FLIP** : position de la case cible mesurée
(`getBoundingClientRect`, relative à la piste), `transform: translate(x, y)` avec transition ;
recalcul au redimensionnement (le curseur saute à sa position, sans transition).

| Situation | Comportement |
|---|---|
| HTML serveur, sans JS | **État final** : toutes les cases agent cochées, « Motivation — à demander » vide en pointillé, deux cases « Vous » cochées, Mandat confirmé, curseur posé sur la case du Mandat, aucun anneau |
| Mouvement réduit | Même état final, immobile, **aucun minuteur** (`data-loop-state="reduced"`) ; bascule en direct si le réglage change (saut à l'état final) |
| Lecture | Démarre quand la figure est visible à **≥ 25 %** (`IntersectionObserver`), par une remise à zéro ; `data-loop-state="playing"`, `data-loop-cycles` = nombre de cycles commencés |
| Hors écran (< 25 %) ou onglet caché | **Pause** : le pas en cours finit sa transition (≤ 900 ms), plus aucun minuteur armé ; `data-loop-state="paused"`. Reprise au même pas quand la condition revient |
| Survol, clic, clavier dans la figure | La boucle ne réagit pas (illustration) ; le bouton et le lien restent utilisables à tout instant |

**Accessibilité.** `figure` avec `aria-labelledby` vers un titre `sr-only` « Parcours d'un
prospect fictif » ; la partie dessinée (cartes, cases, curseur, lignes) est `aria-hidden` ; une
liste `sr-only` **statique** décrit l'état final, une phrase par carte (ex. « Léa,
acquisition : source vérifiée, doublon écarté, fiche créée. », « Hugo, qualification : bien et
secteur, délai du projet ; motivation manquante, à demander. », « Validation humaine, par
vous : message relu, message validé. », « Mandat, par vous : mandat confirmé. »). Rien n'est
annoncé pendant la boucle. Le mouvement démarre automatiquement et dure plus de 5 s : **WCAG
2.2.2** est respecté par la pause hors écran **et** parce que l'information est complète sans
lui (liste statique, état final serveur) ; *décision de l'utilisateur, consignée.* L'arrêt
global reste `prefers-reduced-motion`. Contrastes : libellés `ink` 17,7:1 ; rôles `ink-subtle`
5,7:1 ; étiquette « Vous » 5,4:1 ; cases et curseur ≥ 3:1.

**Responsive.**

| Largeur | Composition |
|---|---|
| ≥ 1440 | 6 colonnes (ci-dessus) |
| 1024–1439 | **4 colonnes empilées** de 216 px, `gap-4` : [Léa / Hugo] [Emma / Validation] [Louis / Sarah] [Mandat] ; décalages 0 / 32 / 12 / 48 px ; 4 × 216 + 3 × 16 = 912 px. Lignes : une par colonne |
| < 1024 | **Carrousel** horizontal natif : `overflow-x: auto`, `scroll-snap-type: x mandatory`, une carte par diapositive (`snap-center`), largeur `min(264px, 76vw)` (640–1023 : 240 px), `gap-3`, rembourrage de piste 24 px, la carte suivante dépasse. Aucun décalage vertical. Lignes convergentes **masquées** ; bouton pleine largeur `max-w-80` centré. **Pagination à points** sous la piste : 7 boutons, cible 24 × 24 px, point 6 px `line-strong`, actif = pilule 20 × 6 px `ink` (transition de largeur via `scaleX`, 240 ms) ; `aria-label` « Étape 1 sur 7 : Léa » … ; clic = défilement vers la carte (`behavior: smooth`, instantané en mouvement réduit). **Aucun défilement automatique** : la boucle coche les cases à leur place, le curseur vit dans le repère de la piste (il est hors vue quand sa carte n'est pas affichée) |
| 390 / 360 | Idem < 1024 ; aucun débordement du document ; libellés sur une ligne (`truncate`, libellés ≤ 20 caractères) |

##### 2.11.8.4 Bloc B — grille « partenaire » de la solution (remplace les 7 cartes)

**Idée unique** : un dossier suit un chemin connu, entre des agents bornés et des garde-fous
réels. **En cinq secondes** : une feuille de route en zigzag, une courbe qui monte, une équipe
autour de « Vous », un compte-rendu, deux grands chiffres vrais. Le titre de la section, son
sur-titre et son paragraphe restent (`LandingHeading`, **sans effet**, § 2.11.8.2).

**Grille.** `mt-14`, `display: grid`, `gap-4` (16 px). ≥ 1024 : `grid-cols-3`, deux rangées ;
tuile 1 en `row-span-2` (colonne 1), tuiles 2 et 3 en colonne 2 (haut, bas), tuiles 4 et 5 en
colonne 3. 640–1023 : `grid-cols-2` ; tuile 1 `row-span-2` à gauche, 2 et 3 à droite, puis 4 et
5 côte à côte. < 640 : une colonne, ordre 1 → 5.

**Tuile (commune).** `bg-surface` opaque (`data-network-cover`), bord 1 px `--color-line`,
**rayon 24 px**, `shadow-subtle`, rembourrage 8 px. **Cadre du visuel** : `bg-surface-muted`
(#fafafa), bord 1 px `line`, rayon 16 px, `overflow: hidden`, hauteur 200 px (tuiles 2–5) ;
tuile 1 : remplit la hauteur disponible, minimum 456 px (≥ 1024), 400 px (< 1024). **Texte**
sous le cadre, rembourrage 16 px 16 px 12 px : ligne icône `Icon` `sm` 16 px (encre + accent
cobalt, histoire au survol de la tuile) + titre **Geist 16 px 500** `ink` ; paragraphe 14 px /
1,55 `ink-muted`, 2 lignes au plus à 1440. Étiquette de simulation **dans le cadre**, en haut à
gauche (12 px) : `SimulationBadge` + « Exemple fictif » (tuiles 1 à 4) ; la tuile 5 décrit des
règles réelles : pas d'étiquette.

| N° | Titre (icône) | Paragraphe | Visuel |
|---|---|---|---|
| 1 | **Un seul chemin** (`pipeline`) | « Sept étapes, un responsable chacune. Le dossier attend la validation humaine. » | **Feuille de route** : les 7 étapes de `solution.rail` en **zigzag** (impaires à gauche, paires à droite, largeur 70 % du cadre), chacune = petite carte blanche rayon 12, bord `line`, hauteur 52 px, rembourrage 8 × 10 : tuile `AgentAppIcon` `sm` (agent / humain / aboutissement) + pastille mono « 01 » 11 px `ink-subtle` + libellé 13 px 500 + responsable 12 px `ink-subtle`. Reliées par un **sentier pointillé** SVG courbe passant par les centres (trait 1,5 px `ink` à 0,35, `stroke-dasharray: 2 5`, bouts ronds). **Étape 04 « Validation humaine »** : carte en pointillé `line-strong`, tuile grisée, mention « En attente de vous » avec un point cobalt 6 px (seul cobalt de la tuile). Étapes au-delà (05–07) à opacité 0,55 (pas encore atteintes) ; la dernière est **coupée par le bas** (masque en fondu sur les 72 px inférieurs). Espacement vertical 12 px |
| 2 | **Un dossier qui avance** (`growth`) | « Chaque étape du pipeline, du nouveau contact au mandat signé. » | **Carte graphique** : en-tête « Progression — dossier fictif » 12 px 500 ; courbe SVG montante passant par 6 points en x réguliers (étapes réelles `PIPELINE_STAGE_LABELS` sauf « Perdu » : Nouveau, Qualifié, Chaud, RDV planifié, Estimation faite, Mandat signé, libellés 10 px `ink-subtle` sous l'axe, les 2 extrêmes seulement sous 640 px) ; **aucune valeur en y**, aucun axe chiffré ; trait 1,5 px `ink` ; aire **dégradé gris** `rgb(24 24 27 / 0.08)` → 0 (pas de couleur) ; point final « Mandat signé » = rond double contour (humain) |
| 3 | **Cinq agents, un conseiller** (`aiAgent`) | « Chaque agent prépare sa part. Vous gardez la décision. » | **Équipe** : au centre, carte nette 136 × 152 px (blanche, rayon 16, bord `line`, `shadow-raised`) : `AgentAppIcon` `md` `kind="human"` + « Vous » 14 px 600 + « Conseiller · décide » 12 px `ink-subtle`. Autour, sur une ellipse (rayons 44 % × 38 % du cadre), les **5 tuiles d'agents** `AgentAppIcon` `sm` + prénom 11 px `ink-muted`, opacité 0,7 (« côtés atténués » du modèle), reliées au centre par des traits 1 px `ink` à 0,08. **Aucune photo** |
| 4 | **Le compte-rendu, exploité** (`document`) | « Sarah transforme la visite en prochaines actions, à valider. » | **Rapport** : feuille blanche 70 % × 80 % du cadre, rayon 10, bord `line`, légèrement tournée de −2°, 6 lignes en **grille de points** (fond `radial-gradient` points 1,5 px `ink` à 0,25, pas de 6 px, découpé en barres de largeurs 92 / 78 / 85 / 60 / 88 / 40 %). Carte superposée en bas à droite (rayon 12, `shadow-raised`) : `SimulationBadge` (au lieu de « Enregistrement », **aucun point rouge**) + « Compte-rendu · Sarah » 12 px 500 + « 3 actions prêtes » 12 px `ink-subtle` |
| 5 | **Des garde-fous réels** (`humanValidation`) | « Vérifiés par le serveur à chaque action, pas seulement affichés. » | **Carte chiffres** : deux grands nombres côte à côte, **Bricolage 600, 56 px, interlignage 1, `-0.03em`**, `tabular-nums` : « 0 » / légende « envoi réel dans ce prototype » ; « 2 » / « validations humaines obligatoires » (légendes 12 px `ink-muted`, 2 lignes max) ; séparateur vertical 1 px `line`. Dessous, filet 1 px `line`, puis deux lignes libellé / valeur (13 px, libellé `ink-muted`, valeur `ink` 500, alignée à droite) : « Premier contact et mandat » / « Validés par un humain » ; « Coupe-circuit » / « Un clic » |

Les chiffres de la tuile 5 sont des **règles vraies du prototype** (aucun envoi réel ; deux
validations humaines obligatoires : premier contact, mandat — `CLAUDE.md`) ; aucun autre
chiffre dans le bloc.

**Mouvement (une fois à l'entrée, aucun rejeu automatique).** Déclencheur : chaque tuile entre à
≥ 35 % visible (le `Reveal` existant ou un observateur par grille). Arrivée des tuiles :
opacité 0 → 1, `translateY(16px)` → 0, 560 ms `--ease-emphasis`, décalage 80 ms dans l'ordre
1 → 5 (≥ 1024 : ordre de colonne). Puis, dans le visuel (t = 0 : arrivée de la tuile) :

| Tuile | Chronologie | Fin |
|---|---|---|
| 1 | Sentier révélé de haut en bas (`clip-path: inset(0 0 100% 0)` → `inset(0)`, 1 400 ms, `--ease-draw`, départ 200 ms) ; cartes d'étape opacité 0 → 1 + `translateY(8px)` → 0, 320 ms, décalage 120 ms (01 à 200 ms … 07 à 920 ms) ; point cobalt de l'étape 04 : opacité 0 → 1 à 1 200 ms (200 ms) | ≤ 1 600 ms |
| 2 | Courbe tracée (`pathLength=1`, `stroke-dashoffset` 1 → 0, 1 200 ms, `--ease-draw`, départ 200 ms) ; points d'étape apparaissent quand la courbe les atteint (opacité, 160 ms) ; aire : opacité 0 → 1, 600 ms, départ 800 ms | ≤ 1 400 ms |
| 3 | Carte centrale `scale(0.96)` → 1 + opacité, 400 ms ; tuiles d'agents partent du centre vers leur place (`translate` depuis le centre, 480 ms `--ease-emphasis`, décalage 70 ms) ; traits révélés (opacité 0 → 0,08, 300 ms) | ≤ 1 100 ms |
| 4 | Lignes de points révélées de gauche à droite (`clip-path`, 360 ms chacune, décalage 90 ms) ; carte superposée `translateY(12px)` → 0 + opacité, 320 ms, départ 800 ms | ≤ 1 200 ms |
| 5 | Nombres : opacité + `translateY(8px)` → 0, 400 ms, décalage 120 ms (pas de compteur qui défile) ; lignes du bas : opacité, 300 ms, départ 400 ms | ≤ 800 ms |

**Interaction (pointeur fin seulement)** : survol d'une tuile → la tuile monte de 2 px
(`translateY(-2px)`) et passe à `shadow-raised`, 240 ms `--ease-standard` ; l'icône du titre
joue son histoire une fois (§ 2.8, conteneur `[data-icon-trigger]`). Aucun lien, aucun focus
(les tuiles ne sont pas des contrôles). **Mouvement réduit, sans JS** : état final immédiat,
aucune transition. **Accessibilité** : `ul` de 5 `li` ; chaque visuel est `role="img"` avec un
`aria-label` court (ex. tuile 1 : « Feuille de route fictive : sept étapes, la validation
humaine attend le conseiller » ; tuile 2 : « Courbe fictive d'un dossier, de Nouveau à Mandat
signé, sans valeurs » ; tuile 3 : « Cinq agents autour du conseiller » ; tuile 4 : « Compte-rendu
fictif exploité par Sarah, simulation » ; tuile 5 : pas de `role="img"`, le texte est lu
tel quel). Contrastes : textes ≥ 4,5:1 (`ink-subtle` 5,7:1 sur blanc, 5,5:1 sur #fafafa).

##### 2.11.8.5 Bloc C — panneau final « processus » (remplace le panneau de `LandingFinal`)

**Idée unique** : déposez une demande, elle suivra ces sept étapes. **En cinq secondes** : un
grand panneau noir, le titre centré, l'action, puis une carte d'étape au centre d'un carrousel
qui montre l'étape en train de se faire. **Panneau sombre retenu** : c'est le seul aplat noir de
la page, il clôt le récit (le noir est la couleur de l'action principale dans la DA) et le
modèle en tire son impact ; contrastes AA mesurables ci-dessous.

**Panneau.** La section sort du `max-w-7xl` : `w-full`, marges latérales 16 px (≥ 640 px) /
8 px (< 640), `pt-16 pb-24 lg:pb-36` inchangés. Panneau `bg-inverse` `#0a0a0b`, **rayon 32 px**
(`rounded-2xl` ; 24 px < 640), aucune bordure, aucune ombre, `overflow: hidden`,
`data-network-cover`. Rembourrage haut 96 px (≥ 1024) / 64 px, bas 56 px / 40 px. Contenu
textuel centré, `max-w-[60rem]` (titre) et `max-w-[36rem]` (paragraphe).

**Grille de fond** (décor, `aria-hidden`, sous le carrousel et la rangée des flèches) : lignes
1 px `rgb(255 255 255 / 0.07)` — verticales alignées sur les **interstices** des cartes du
carrousel (pas = largeur de carte + espacement, centrées sur la carte active), deux
horizontales au haut et au bas de la bande des cartes (− 16 / + 16 px) ; fondu en haut sur
64 px (`mask-image`). Fixe : elle ne suit pas le défilement de la piste.

| Élément | Valeurs |
|---|---|
| Titre | `h2#final-title`, lignes d'auteur **inchangées** (« Déposez une demande *fictive*. / Retrouvez-la / dans l'espace agence. »), `text-statement`, **centré** (`text-align: center`, chaque ligne centrée), couleur `--color-ink-inverse` `#fafafa` (mot accentué compris), **aucun effet**, apparition ligne par ligne conservée (§ 2.2.7) |
| Paragraphe (nouveau) | 20 px sous le titre, `text-lede` centré, `--color-ink-inverse-muted` `#a8a8b0` : « Sept étapes, de la demande au mandat. Deux restent toujours humaines. » |
| Actions | 32 px sous le paragraphe, centrées, `flex-wrap gap-3` : « Demander une estimation » = bouton **clair** (variante `light` : fond `#fafafa`, texte `#0a0a0b`, survol fond `#e4e4e9`, flèche `arrowRight` dans un carré 22 px rayon 6, bord 1 px `rgb(10 10 11 / 0.16)`) ; « Espace agence » = variante `outline-light` (transparent, texte `#fafafa`, bord 1 px `rgb(255 255 255 / 0.24)`, survol fond `rgb(255 255 255 / 0.08)`). Hauteur `lg` actuelle. Focus : anneau cobalt 2 px, décalage 2 px (3,7:1 sur le noir) |
| Note | 16 px sous les actions, centrée, `text-xs` `#a8a8b0` (7,4:1), mot pour mot : « Prototype de démonstration. Aucune donnée réelle, aucun envoi réel. » |
| Flèches | 56 px sous la note, centrées, `gap-2` : deux pilules **56 × 44 px**, rayon 999, fond `rgb(255 255 255 / 0.06)`, bord 1 px `rgb(255 255 255 / 0.12)`, chevron 16 px `#fafafa` (`arrowLeft` / `arrowRight`) ; survol fond 0,12 ; désactivée (début / fin) : `aria-disabled="true"`, opacité 0,4, reste focusable. `aria-label` « Étape précédente » / « Étape suivante » |
| Piste | 32 px sous les flèches, pleine largeur du panneau. Cartes **380 px** (1024–1439 : 340 ; < 1024 : `min(300px, 100% − 48px)`), espacement **20 px**, carte active **centrée** (rembourrage de piste `calc(50% − carte/2)`, `scroll-snap-align: center`) ; pas de bouclage (la première et la dernière se centrent aussi). Bords du panneau : fondu `mask-image` sur 12 % de chaque côté |
| Étiquette de simulation | 24 px sous la piste, centrée : `SimulationBadge` **variante sombre** (fond `#fafafa`, texte `#0a0a0b`) + « Exemple fictif — simulation » 12 px `#a8a8b0` |
| Progression | 16 px dessous, centrée : barre **240 px** (< 640 : 160 px) × 2 px, rail `rgb(255 255 255 / 0.12)`, remplissage `--color-accent` (3,7:1), `transform: scaleX((i+1)/7)` origine gauche, 420 ms `--ease-emphasis` ; à droite, 12 px, pourcentage **Geist Mono 12 px `tabular-nums` `#a8a8b0`** : 14 % · 29 % · 43 % · 57 % · 71 % · 86 % · 100 % (calculé, `Math.round`, espace fine insécable avant « % ») |

**Carte d'étape.** Fond `rgb(255 255 255 / 0.03)` (≈ #131315), bord 1 px
`rgb(255 255 255 / 0.10)`, **rayon 24 px**, rembourrage 24 px (< 640 : 20), hauteur commune
(la plus haute). Haut : pastille mono « ÉTAPE N°1 » (Geist Mono 11 px 500 capitales,
`#d4d4d8` sur `rgb(255 255 255 / 0.08)`, rayon 8, 4 × 8 px ; 11,3:1). **Visuel animé** :
332 × 260 px (< 640 : 100 % × 220). Bas : icône `Icon` `sm` 16 px `currentColor`
`#fafafa` + titre **Geist 16 px 600** `#fafafa` (« Demande reçue · Léa ») ; paragraphe 14 px /
1,55 `#a8a8b0` (7,8:1), 3 lignes au plus. **Étapes humaines (04, 07)** : double contour (bord
+ `outline: 1px solid rgb(255 255 255 / 0.22)` à `outline-offset: -6px`) et pastille
« ÉTAPE N°4 · HUMAINE ». **Carte active** : opacité 1, net, `scale(1)`. **Autres** : opacité
0,45, `filter: blur(2px)`, `scale(0.96)` ; transition 320 ms `--ease-standard`.

**Contenu exact des 7 cartes** (`LANDING_TEXTS.final.steps`) :

| N° | Titre | Paragraphe | Visuel (étiquette pendant → après) |
|---|---|---|---|
| 1 | Demande reçue · Léa (`lea`) | « La source est vérifiée, les doublons écartés, une fiche propre est créée. » | **Radar** : 3 cercles pointillés (r 40 / 80 / 120 px, 1 px blanc 0,14, `2 4`), secteur de balayage `conic-gradient` blanc 0,14 → 0 sur 70°, **un tour** (0 → 360°, 1 600 ms, `--ease-standard`) puis fondu 240 ms ; deux cibles (points blancs 6 px à 0,5 : « Formulaire du site », « Appel reçu ») deviennent un anneau cobalt 10 px quand le secteur les touche (≈ 30 % et 62 %) ; à 1 900 ms elles **fusionnent** (320 ms, `--ease-emphasis`) en un seul point cobalt + pastille « 1 fiche ». Étiquette : « Vérification de la source… » → (fondu croisé à 2 200 ms) « Source vérifiée » |
| 2 | Qualification · Hugo (`hugo`) | « Bien, secteur, motivation et délai structurés. Ce qui manque est signalé, jamais inventé. » | 4 rangées libellé (12 px `#a8a8b0`) + barre 8 px rayon 4 blanche 0,16 qui se remplit (`scaleX`, 360 ms `--ease-emphasis`, décalage 140 ms) puis valeur 13 px `#fafafa` : Bien « T3 avec terrasse », Secteur « Cassis », Délai « Avant l'été » ; **Motivation** : contour pointillé tracé (300 ms, départ 1 000) + « Manquante — signalée ». Étiquette : « Structuration du projet… » → « Motivation à demander » |
| 3 | Relance préparée · Emma (`emma`) | « Un premier message adapté au dossier, consentement vérifié. Rien n'est envoyé. » | Mini e-mail : « E-mail · Brouillon », objet « Votre demande d'estimation à Cassis », 3 barres de texte écrites de gauche à droite (`clip-path`, 400 ms, décalage 160 ms), puce « Consentement vérifié » avec coche cobalt (1 200 ms), pied « Se désinscrire » souligné 11 px. Étiquette : « Rédaction du brouillon… » → « Brouillon prêt · rien n'est envoyé » |
| 4 | Validation humaine · Vous (`humanValidation`) | « Le conseiller relit, modifie, valide ou refuse. Sans lui, aucun premier contact ne part. » | Message + trois boutons factices « Modifier », « Refuser », « Valider » ; le **curseur « Vous »** du bloc A (même dessin) glisse du coin bas-droit au bouton « Valider » (560 ms, `--ease-emphasis`), clic (120 ms), le bouton devient plein clair avec coche. Étiquette : « En attente de votre décision… » → « Validé par un humain » |
| 5 | Rendez-vous · Louis (`louis`) | « Un créneau d'estimation libre est proposé, jamais réservé deux fois. » | 3 créneaux : « 9 h 30 · Déjà réservé » (texte barré, fond hachuré blanc 0,06), « 11 h 00 », « 15 h 30 · Libre » ; un anneau cobalt descend, passe sur 9 h 30 sans s'y poser et se pose sur 11 h 00 (480 ms) + mention « Proposé au vendeur ». Étiquette : « Recherche d'un créneau libre… » → « Créneau proposé » |
| 6 | Suivi · Sarah (`sarah`) | « Le compte-rendu de visite devient des prochaines actions, à valider. » | Feuille de compte-rendu (lignes en grille de points blancs 0,2) ; 3 lignes d'action apparaissent l'une après l'autre (opacité + `translateY(8px)`, 280 ms, décalage 160 ms) : « Avis de valeur — après validation », « Relance — si consentement valide », « Étape : estimation faite ». Étiquette : « Lecture du compte-rendu… » → « Prochaines actions prêtes » |
| 7 | Mandat · Vous (`mandate`) | « La signature est confirmée par le conseiller. Jamais déclarée par un agent IA. » | Mini pipeline (étapes réelles, `PIPELINE_STAGE_LABELS` sans « Perdu ») : un point avance de Nouveau à Estimation faite (160 ms par pas) et **s'arrête** ; « Mandat signé » en pointillé « À confirmer » ; le curseur « Vous » clique « Confirmer » (même geste que la carte 4) ; le nœud devient disque plein blanc à double contour. Étiquette : « Confirmation humaine requise… » → « Mandat confirmé par un humain » |

Étiquette du visuel : pastille centrée en haut du visuel, 12 px 500, `#e4e4e9` sur
`rgb(255 255 255 / 0.08)`, bord 1 px `rgb(255 255 255 / 0.12)`, rayon 999, 4 × 10 px ; « … »
pendant l'animation, texte final ensuite. Aucun rouge (les cibles du modèle sont cobalt ou
blanches).

**Mouvement.** Chaque visuel joue **une fois** quand sa carte devient active (≤ 2 400 ms,
`transform` / `opacity` / `clip-path` / `stroke-dashoffset`), puis reste sur son état final ;
redevenir active **par une action de l'utilisateur** le rejoue (borné, déclenché par un geste).
La carte 1 joue quand le carrousel entre à ≥ 50 % visible, une fois. Rien ne défile ni ne
change tout seul. Visuels marqués `data-visual-state` (`idle` | `playing` | `done`).

| Interaction | Comportement |
|---|---|
| Flèches | ± 1 carte ; glissement de la piste par la physique existante (`useTrackPhysics`, `GLIDE_TAU_MS` 140) |
| Glisser (souris) | Inertie et aimantation de `useTrackPhysics` (`DRAG_THRESHOLD_PX` 6, `MOMENTUM_TAU_MS` 325) ; un glisser n'active pas de clic |
| Tactile, stylet | Défilement **natif** + `scroll-snap` (inertie de la plateforme) ; `touch-action: pan-x pan-y` : le défilement vertical de la page n'est jamais bloqué |
| Clavier | La piste est focusable (`tabIndex=0`, anneau cobalt) : ← / → ± 1, Origine / Fin = première / dernière ; les flèches sont des `button`. Ordre de tabulation : actions → flèches → piste |
| Clic sur une carte voisine | Elle devient active |
| Fin d'un défilement | Carte active = la plus proche du centre ; flèches, progression, pourcentage et annonce mis à jour |
| Mouvement réduit | Visuels **statiques à l'état final**, déplacements instantanés (aucun glissement), atténuation conservée sans transition |

**Accessibilité.** Conteneur `role="region"`, `aria-roledescription="carrousel"`,
`aria-label` « Les sept étapes d'un dossier ». Chaque carte : `role="group"`,
`aria-roledescription="étape"`, `aria-label` « Étape 2 sur 7 : Qualification · Hugo ». Les
cartes **non actives** sont `aria-hidden="true"` (rien de focusable dedans ; elles restent
cliquables). Région `aria-live="polite"` `sr-only` : « Étape 2 sur 7 : Qualification · Hugo.
<paragraphe> » à chaque changement par l'utilisateur (jamais au chargement). Visuels
`aria-hidden` (le titre et le paragraphe portent le sens). Progression : `role="progressbar"`
non requis (c'est une position) — barre `aria-hidden`, le pourcentage visible est doublé
d'un texte `sr-only` « Étape 2 sur 7 ». Contrastes mesurés à reporter : titre 19,3:1,
paragraphe 7,4:1, texte de carte 7,8:1, pastille 11,3:1, flèches ≥ 3:1 (contour), remplissage
3,7:1. Le texte flouté des cartes voisines est un **état inactif décoratif** (masqué aux
technologies d'assistance, atteint en une action) — compromis consigné.

**Responsive.** 1440 : carte active + deux voisines entières visibles et des bords tronqués.
1024 : cartes 340 px, une voisine de chaque côté. 390 / 360 : cartes `min(300px, 100% − 48px)`,
la voisine dépasse de ≈ 24 px ; titre `text-statement` 36 px centré (lignes d'auteur sur une
ligne visuelle ou repliées sans débordement) ; actions empilées si nécessaire, centrées ;
flèches 56 × 44 (cibles ≥ 44 px) ; aucun débordement du document.

##### 2.11.8.6 Critères d'acceptation (audit de l'utilisateur, tests)

**Titres.**
- T1. Exactement **trois** titres de `/` ont un effet : `h1` (`underline`), problème
  (`focus`), contrôle (`data-accent-effect="tech"`). Solution, agents, résultat, final : aucun
  `[data-accent-frame]`, `[data-accent-mark]`, canvas ou `data-accent-replayable` ; mots
  `filter: none` ≤ 1 s après leur entrée.
- T2. « décide » : balayage démarré 760 ms (± 100) après l'entrée, `data-tech-state` revenu
  à `idle` ≤ 2 400 ms après l'entrée ; au repos canvas vide (0 pixel non transparent) et
  lettres HTML visibles ; lettres peintes = lettres HTML (≤ 1 px) ; étiquette sous le cadre, ne
  recouvre aucun autre texte ; nom accessible du `h2` inchangé ; boîte de ligne ≤ 0,5 px.
- T3. Rejeu au survol : le § 2.11.7 n° 6 bis s'applique aux **trois** titres (pour « décide »,
  « effet rejoué » = `data-tech-state="sweep"` à + 100 ms et `idle` ≤ + 1 700 ms si le pointeur
  est sorti) ; glisser une lettre de 80 px → déplacement plafonné à 0,6 em, retour < 0,5 px en
  ≤ 700 ms ; tactile et mouvement réduit : aucun canvas, aucun rejeu.
- T4. `THIRD_PARTY_NOTICES.md` contient la section TechText (licence à l'identique) et cite
  les nouveaux fichiers.

**Bloc A.**
- A1. 1440 × 900 : le haut des cartes est dans la première fenêtre ; 6 colonnes ; marges ≥
  32 px ; 1024 : 4 colonnes ; 390 / 360 : carrousel à points, aucun débordement du document.
- A2. HTML serveur et mouvement réduit = état final : 13 lignes agent dont **12 cochées** et
  1 manquante en pointillé (« Motivation »), **3 cases « Vous » cochées**, 2 pastilles
  « Vous » pleines, curseur sur la case du Mandat, aucun anneau actif.
- A3. Boucle : `data-loop-state="playing"` à l'écran ; `data-loop-cycles` passe de 1 à 2 en
  9,8 s (± 0,3) ; **0 appel à `requestAnimationFrame`** dû au bloc ; aucune animation à
  itérations infinies ; une case « Vous » ne passe à cochée **qu'après** que le curseur y est
  arrivé (positions comparées à ± 4 px).
- A4. Pause : section « problème » au centre → `data-loop-state="paused"` ≤ 1 s et aucun
  changement de pixel dans la figure ensuite ; onglet caché (événement `visibilitychange`
  simulé) → `paused` ; retour → `playing`, reprise au même pas.
- A5. Textes : badge « Simulation », « Exemple fictif — simulation », carte de texte, note
  « … Aucun prospect réel, aucun envoi. » et `hero.illustrationNote` visibles ; liste `sr-only`
  présente ; bouton → `/estimation`.

**Bloc B.**
- B1. 5 tuiles ; ≥ 1024 trois colonnes, tuile 1 sur deux rangées ; 640–1023 deux colonnes ;
  < 640 une ; aucun débordement à 1440 / 1024 / 390 / 360.
- B2. Toutes les animations du bloc finies ≤ 2 000 ms après l'entrée de la dernière tuile
  (`getAnimations` vide) ; mouvement réduit : état final à l'instant 0.
- B3. Étiquettes « Exemple fictif » sur les tuiles 1–4, aucune sur la 5 ; aucun chiffre hors
  tuile 5 ; aucun pixel rouge ; un seul point cobalt dans la tuile 1.

**Bloc C.**
- C1. Panneau `#0a0a0b`, rayon 32 px (24 < 640) ; titre centré (centre de chaque ligne = centre
  du panneau ± 2 px), blanc, sans effet ; paragraphe, deux actions, note dans cet ordre ;
  contrastes du § 2.11.8.5 mesurés (calcul sur couleurs calculées).
- C2. Au chargement de la section : carte 1 active, « 14 % », flèche précédente
  `aria-disabled` ; « Étape suivante » → carte 2 active, « 29 % », annonce `aria-live` ;
  → / ← sur la piste, Origine / Fin ; glisser souris de 200 px vers la gauche → carte suivante ;
  clic sur une voisine → active.
- C3. **Aucun défilement automatique** : 10 s sans interaction → carte active inchangée ;
  visuel de la carte active `done` ≤ 2 600 ms après activation ; aucune boucle (§ 2.11.7 n° 1
  vert sur `final`).
- C4. Mouvement réduit : tous les visuels `done` à l'instant 0, aucun glissement.
- C5. 390 / 360 : carte ≤ largeur − 48 px, flèches ≥ 44 × 44, aucun débordement.

**Page entière.** § 2.11.7 n° 1 (« aucune boucle ») passe **avec l'exception unique du bloc
A** : les captures masquent `[data-loop="allowed"]` (seul élément portant cet attribut), le
compteur `requestAnimationFrame` reste exigé à zéro (le bloc n'en utilise pas), la liste des
animations infinies reste exigée vide. Réseau, voiles, CRM (`particules`,
`voiles-lisibilite`, `premier-regard`) : non régressés.

## 3. Composants (`components/ui/`)

| Composant | Fichier | États |
|---|---|---|
| `Button` | `Button.tsx` | `primary` / `secondary` / `ghost` × `sm` / `md` / `lg` ; repos, survol, focus visible, actif (`scale .98`), `isLoading` (spinner + `aria-busy`), `disabled` (opacité 40 %) |
| `ButtonLink` | `ButtonLink.tsx` | Mêmes styles, mais reste une ancre `next/link` |
| `Card` | `Card.tsx` | En-tête optionnel (titre, description, actions), ton `default` / `inverse`, `headingLevel` 2 ou 3. Les actions (badge, lien court) restent **sur la ligne du titre** à toutes les largeurs ; la description passe dessous, pleine largeur — elle ne repousse jamais un badge sur une ligne à part |
| `LogoSymbol` | `LogoSymbol.tsx` | Symbole seul, `sm` / `md` / `lg` ; nommé par défaut, silencieux avec `label={null}` ; inversion par `currentColor` (§ 2.7) |
| `Logo` | `Logo.tsx` | Verrouillage complet (symbole + nom sur deux lignes), `sm` / `md` ; un seul nom accessible (§ 2.7.2) |
| `Reveal` | `Reveal.tsx` | Contenu visible par défaut ; entrée dans la fenêtre avec `rise-soft` ; mouvement réduit et absence d'`IntersectionObserver` pris en charge ; `frame="still"` : le bloc ne bouge pas, seul le déclencheur `data-reveal` sert (titres éditoriaux, § 3.8) |
| `Badge` | `Badge.tsx` | `neutral`, `outline`, `solid`, `dashed` (information absente) |
| `PipelineStageBadge` | `PipelineStageBadge.tsx` | 7 étapes ; barre de 6 points pour la progression, `perdu` en pointillés, `mandat_signé` en plein noir |
| `SimulationBadge` | `SimulationBadge.tsx` | Unique, toujours visible, toujours accompagné du mot « Simulation » |
| `Alert` | `Alert.tsx` | `error` (fond noir, `role="alert"`), `success` / `info` (`role="status"`) |
| `EmptyState` | `EmptyState.tsx` | Titre (`text-section`, Bricolage 600), mot accentué facultatif (`titleAccent`, § 3.8), description, action suggérée |
| `Skeleton` | `Skeleton.tsx` | Chargement, `aria-hidden`, scintillement désactivé si mouvement réduit |
| `Field` | `Field.tsx` | Libellé réel, aide, erreur (`aria-invalid` + `aria-describedby`), désactivé |
| `DataList` | `DataList.tsx` | `dl` 1 ou 2 colonnes |
| `PageHeader` | `PageHeader.tsx` | Fil d'Ariane, **sur-titre** (`overline`, § 3.8), `h1`, description, badges, actions |
| `Overline` | `Overline.tsx` | Sur-titre `label-mono` précédé du trait cobalt 12 × 2 px (§ 2.2.6, § 3.8) |
| `EditorialTitle` | `EditorialTitle.tsx` + `.module.css` | Titre-phrase du site public : lignes d'auteur, un mot accentué, apparition ligne par ligne (§ 2.2.7, § 3.8) ; landing : effet du mot accentué `accentEffect` et rejeu au survol `accentReplay` (§ 2.11.2) |
| `Select` | `Select.tsx` | `<select>` natif, `<label for>` réel, `id` obligatoire (utilisable en Server Component), survol, désactivé |
| `Checkbox` | `Checkbox.tsx` (client) | Case de confirmation explicite : toute la zone bordée est le `<label>`, contrôlée, **jamais précochée** ; cochée = cadre noir + fond atténué (jamais la couleur seule), désactivée |
| `Dialog` | `Dialog.tsx` (client) | Fenêtre modale sur `<dialog>` natif + `showModal()` : titre (`aria-labelledby`), résumé (`aria-describedby`), `aria-modal`, focus piégé par le navigateur, Échap et clic sur le fond pour annuler (`dismissible={false}` pendant une requête), retour du focus (`returnFocusRef`), pied d'actions empilé en mobile |
| `Textarea` | `Textarea.tsx` | Champ multiligne : libellé réel, aide, erreur (`aria-invalid` + `aria-describedby`), `maxLength` |
| `Pagination` | `Pagination.tsx` | `nav[aria-label="Pagination"]` : « 26–50 sur 131 » (total exact) + Précédent / Suivant en liens d'URL. Direction inexistante : bouton atténué (`opacity-40`), `aria-hidden`, pour que les boutons ne sautent pas d'une page à l'autre ; une seule page : le décompte seul, aucun bouton |
| `LinkTabs` | `LinkTabs.tsx` | Filtre segmenté en **liens** (pas de `tablist` : chaque choix charge une autre liste et vit dans l'URL). Piste `bg-surface-muted` arrondie, choix courant en pilule `bg-inverse` + graisse `semibold` + `aria-current="page"` (jamais la couleur seule) ; défile horizontalement si l'écran est étroit |
| `Disclosure` | `Disclosure.tsx` | `<details>` / `<summary>` natif, fermé par défaut (Tab, Entrée / Espace, annoncé « réduit / développé »). `card` ou `inline` ; en `inline`, `size="xs"` pour un rappel sous des chiffres (texte xs, chevron 16 px) — ex. « Un blocage n'est pas une erreur… » du tableau de bord, qui déplie la liste des garde-fous. Jamais d'info au seul survol |
| `ListTotal` | `ListTotal.tsx` | Total exact d'une liste paginée, **toujours** suivi de son périmètre — même motif « chiffre + périmètre » que le tableau de bord (§ 3.5), pour qu'un chiffre lu sur le tableau de bord se reconnaisse sur l'écran où il mène |

`Button` accepte `ref` (prop simple en React 19), pour les cas où le focus doit
être déplacé — par exemple sur le bouton de confirmation du coupe-circuit.

Règle : **réutiliser avant de créer**. Un nouveau composant n'est ajouté que s'il est
utilisé par au moins deux écrans, ou s'il porte une règle produit (badge simulation).

### 3.1 Composants du module « Agents IA » (`features/agents-ia/components/`)

| Composant | Fichier | Rôle |
|---|---|---|
| `AgentRunReplay` | `AgentRunReplay.tsx` (client) | Rejeu animé d'une exécution : barre d'outils (facteur de ralenti, durée mesurée, « Tout afficher » / « Rejouer »), flux visuel pointillé, liste détaillée et zone `aria-live` |
| `AgentRunProcessTrack` | `AgentRunProcessTrack.tsx` | Vue compacte du journal : icônes de la famille (§ 2.8), nano-sphères en attente, signal et progression pilotés par les mêmes durées mesurées que le rejeu |
| `AgentRunStepRow` | `AgentRunStepRow.tsx` | Une étape : phase, auteur (`Code` / `Fournisseur IA`), statut, durée mesurée, détail technique replié |
| `AgentRunHead` | `AgentRunHead.tsx` | Carte d'identité d'une exécution (dates, contact ou « Lead entrant », fournisseur, jetons, décision) |
| `AgentOverviewCard` | `AgentOverviewCard.tsx` | Un agent : prénom, mission, statut, compteurs par fenêtre (« Erreur technique : n » inversé, « Bloquée par un garde-fou : n » contour), dernière exécution, « Erreurs et blocages récents » distingués ligne par ligne (`RunStatusBadge` + « Motif : » pour un blocage) |
| `RunStatusBadge` | `RunStatusBadge.tsx` | Résultat d'une exécution, nommé sans ambiguïté : `Erreur technique` (`solid` + croix), `Bloquée par un garde-fou` (`outline` + cadenas), `En cours` (`dashed`), `Réussie` (`neutral`). Utilisé par le journal, la page d'exécution, la carte agent et l'historique de la fiche |
| `GuardRailNotice` | `GuardRailNotice.tsx` | Action refusée par un garde-fou : `Alert info` (`role="status"`, jamais `alert`), titre « Bloquée par un garde-fou », « Motif : » + message du serveur tel quel, « Ce n'est pas une erreur… » |
| `ActivityFigure` | `ActivityFigure.tsx` | Un compteur **toujours accompagné de sa fenêtre**, « Indisponible » si la lecture a échoué |
| `AgencyActivityCard` | `AgencyActivityCard.tsx` | Chiffres de l'agence : exécutions décomptées, limite, tentatives, brouillons à valider |
| `KillSwitchPanel` | `KillSwitchPanel.tsx` (client) | Coupe-circuit : état, confirmation en deux temps, refus expliqué ; `headingLevel` 2 (défaut, `/agents-ia`) ou 3 (sous la section « Agents IA » de `/parametres`) — un seul composant, deux écrans, mêmes règles |
| `AgentRunsHistory` / `AgentRunsFilters` / `AgentRunsList` | — | Journal filtrable et paginé (formulaire GET, sans JavaScript) ; un seul badge « Simulation » par bloc quand toutes les lignes sont simulées (`simulation-scope.ts`) |
| `SituationStrip` | `SituationStrip.tsx` | Niveau 1 de `/agents-ia` : agents actifs, validations attendues (lien vers la file), blocages et erreurs techniques **du jour**, comptes exacts sommés depuis le tableau de bord |
| `SelectedDossierCard` | `SelectedDossierCard.tsx` | Niveau 2 : dossier de la dernière exécution enregistrée rattachée à un contact (Léa exclue : lead brut) ; sinon état vide « Ouvrir les contacts » |
| `OperationalRail` | `OperationalRail.tsx` + `.module.css` | Rail « réseau opérationnel » : icône, nom, action, statut écrit, durée **seulement si mesurée**. États `pending` (en attente, pointillés), `running` (contour cobalt, pastille qui respire en opacité), `done` (contour noir 2 px), `human` (validation qui attend une action : **seul cobalt statique**), `blocked` (garde-fou, pointillés noirs), `stopped`, `failed` (erreur technique, fond inversé), `untraced`. Réseau (A1) : traits de 3 px, gris `--rail-idle` (mélange `ink-subtle`/`surface`) quand non atteints, noirs quand atteints ; trois **points relais** par trait (`relays`, repères visuels uniquement, aucun trait entre nœuds non consécutifs, masqués sur un trait coupé). `checkpoint` (validations et mandat) = **double contour** (`outline` décalé) gris/noir, cobalt seulement en état `human`. Cobalt limité à l'impulsion en mouvement, à l'étape en cours et à la validation en attente — règle vérifiée sur le CSS par `OperationalRail.test.tsx`. Pas de lueur (`--color-accent-glow` banni du rail). Le signal s'arrête après un blocage/erreur. Horizontal ≥ 768 px, vertical dessous ; statique et sans impulsion sous mouvement réduit. Aucun pourcentage |
| `DossierJourneyRail` / `DossierJourneyLoader` | — | Parcours d'un dossier (Prospect → Léa → validation humaine → Hugo → Emma → validation humaine → Louis → rendez-vous → Sarah → mandat confirmé par un humain), lu de `getContactTimeline` via `dossier-journey.ts` (pur, testé). Sur le rejeu, seule l'exécution rejouée porte sa durée mesurée (aucune si encore en cours) |
| `PendingMessagesList` | `PendingMessagesList.tsx` (client) | Bureau de validation en vue double (§ 3.1.1) : confirmation persistante (`aria-live`) + rafraîchissement serveur |
| `PendingMessageCard` | `PendingMessageCard.tsx` (client) | Une lettre à décider : rail du message, lettre, barre de décision (§ 3.1.1) |
| `MessageRejectionForm` | `MessageRejectionForm.tsx` (client) | Motif obligatoire (liste fermée, `fieldset`/`legend`) + note facultative bornée |
| `DraftEditForm` | `DraftEditForm.tsx` (client) | Correction en place de l'objet et du corps ; le canal et le destinataire restent hors du formulaire, puis le brouillon repasse « à valider » |
| `InboundLeadCard` | `InboundLeadCard.tsx` (client) | Un lead entrant : titre = prénom + initiale (`displayName`, texte brut ; « Nom non transmis » atténué sinon), puis source · commune · date ; éléments transmis, message du prospect en **texte brut**, « Lancer Léa », résultat et rejeu. Lead traité : bouton secondaire « Ouvrir la fiche » vers la fiche produite (distingue deux homonymes) |

#### Règles de ce module (non négociables)

1. **Le rejeu ne ment pas sur le rythme.** Chaque délai animé vient de
   `durationMs`, mesuré par le serveur et recalculé par la base. Pas de fausse
   barre de progression, pas de durée arrondie, pas de pause décorative.
   Le seul écart permis est un **ralentissement affiché** (« Rejeu ralenti ×10 »
   + durée réelle à côté), jamais une accélération.
2. **`prefers-reduced-motion`** : aucune animation, aucun `setTimeout`, la liste
   complète s'affiche immédiatement. Le bouton « Tout afficher » couvre le même
   besoin à la demande.
3. **Un chiffre sans sa fenêtre n'existe pas** : « 12 exécutions **aujourd'hui** ».
   Un comptage impossible affiche « Indisponible », **jamais** « 0 ».
4. **Auteur de l'étape visible** : une seule phase (`ai_call`) sort du code de
   l'agence ; la phase `decision` est encadrée et annotée.
5. Tout texte venant d'un prospect ou d'un journal s'affiche en **texte brut**
   (aucun `dangerouslySetInnerHTML` dans le projet).
6. **Valider n'est pas envoyer** : deux boutons distincts, jamais un seul. Le mot
   « envoyer » est toujours suivi de « (simulation) », et la confirmation répète
   que rien n'est parti.
7. Un **refus** demande toujours un motif (liste fermée) ; la note reste
   facultative et bornée.
8. **Un lead n'est pas un consentement.** L'écran « Leads entrants » affiche
   cette règle en tête (`data-testid="leads-rule"`) et la répète sous la seule
   action possible : Léa crée la fiche, elle ne recueille aucun consentement.
9. **Corriger n'est pas valider.** Seuls l'objet et le corps sont proposés à
   l'édition. Toute correction laisse ou remet le brouillon « à valider ».
10. **Un garde-fou n'est pas une erreur.** Une action refusée par une règle
    (coupe-circuit, limite quotidienne, reprise par un conseiller, consentement,
    mandat signé, dossier perdu, relance déjà préparée…) s'affiche avec
    `GuardRailNotice` (information) et `RunStatusBadge status="blocked"` ; une
    défaillance technique garde `Alert error` et « Erreur technique ». La
    classification n'est jamais décidée par l'interface : elle lit
    `runStatusForRefusal` (`lib/agents/runner.ts`) via
    `features/agents-ia/components/outcome.ts` ; un code inconnu reste une erreur.
11. **Validation humaine d'un message** (historique de la fiche) : « Validé par
    {email} ({rôle}) le {date à heure} » ou « Refusé par … », heure de Paris,
    uniquement à partir de `meta.review_outcome` / `validated_by_email` /
    `validated_by_role_label` / `validated_at`. Auteur absent : « Auteur non
    disponible » ; date absente : aucune date — jamais celle de l'envoi ni de
    l'entrée. En attente : « En attente de validation humaine ». Petite pastille
    pleine (décidé) ou creuse (en attente), texte brut.

### 3.1.1 Messages à valider — vue double, rail du message, lettre (Lot 2B-1)

**Ce que l'écran raconte** : *aucun message ne part sans la décision d'un humain.* On le lit
sans le texte : la lettre est arrêtée devant le point « Vous » (barre d'arrêt, anneau cobalt),
elle le franchit quand on valide, elle recule derrière la barre quand on refuse, elle entre dans
« Envoi » (badge « Simulation ») quand on envoie.

| Composant | Fichier | Rôle |
|---|---|---|
| `PendingMessagesList` | `PendingMessagesList.tsx` (client) | **Bureau de validation** (`validation/ValidationDesk.module.css`) : à gauche la file (`tablist` vertical), à droite le panneau perle où repose la lettre sélectionnée (`tabpanel`). **Toutes** les lettres sont dans le HTML (les autres en `hidden`) : changer de message est instantané, sans requête. Sélection initiale lue par la page dans `?message=` (aucune query changée) ; chaque onglet est un vrai lien `?message=id` (sans JavaScript, la page se recharge sur ce message). Confirmation persistante (`aria-live`) en tête du panneau ; un message refusé ou envoyé reste affiché dans son état final (`ResolvedMessage`) jusqu'au choix suivant |
| `MessageQueueItem` | `validation/MessageQueueItem.tsx` (client) | Un onglet : tuile de l'auteur (`AgentAppIcon`), destinataire, canal · « Préparé par … », première ligne (objet ou début du SMS), statut (`PendingDots` + « À valider », ou ✓ « Validé · Pas encore envoyé »), « Premier contact » en pointillés, marque d'arrêt + consentement s'il manque. Sélection : fond perle du panneau + filet + **repère cobalt 2 px** (même signe que le menu). Clavier : ↑ ↓ (en boucle), Début, Fin, la sélection suit le focus ; Entrée / Espace ouvrent la lettre ; tabindex itinérant |
| `PendingMessageCard` | `PendingMessageCard.tsx` (client) | La lettre et sa décision : `MessageDecisionRail`, phrase `consentBlocked` si le canal n'a pas de consentement valide, `MessageLetterView`, puis la **barre de décision collante** (`sticky bottom-3`, blanche translucide, `shadow-raised`) : Valider / Refuser / Modifier, ou Envoyer (simulation) / Modifier + « Validé : … Rien n'est parti. » (+ `sendBlocked`). Formulaires de refus et de correction **inchangés**, en place de la barre. Server actions, textes et motifs inchangés |
| `MessageDecisionRail` | `validation/MessageDecisionRail.tsx` + `.module.css` | Rail court « Préparé par {agent} → Vous → Envoi (simulation) ». « Vous » = `AgentAppIcon kind="human"` (double contour), anneau cobalt **seulement** en attente de décision ; le consentement du canal est posé dessous (« Consentement du canal » + badge). Un **jeton lettre** (glyphe `mail` dans une pastille) est sur la ligne : devant « Vous » (barre d'arrêt devant le nœud) → après validation, devant « Envoi » (ligne remplie en encre, « Envoi » en anneau cobalt : un geste humain est attendu) → envoyé : absorbé par « Envoi », ✓ ; refusé : recule, pointillé, derrière la barre ; sans consentement valide : ligne vers « Envoi » en pointillés + barre d'arrêt. Chaque état est aussi écrit sous son nœud |
| `messageRailModel` / `messageRailFor` | `validation/message-rail.ts`, `message-rail-view.ts` | Modèle pur et testé : étape = statut enregistré, ou issue **confirmée par le serveur** (`validated`, `rejected`, `sent`) jusqu'à la relecture de la file ; jamais d'optimisme avant la réponse |
| `ResolvedMessage` | `validation/ResolvedMessage.tsx` (client) | Fin de la scène : rail dans son état final, lettre en retrait (opacité 0,5) avec un tampon « Refusé » ou « Envoyé (simulation) » + `SimulationBadge`, bouton « Message suivant ». Reçoit le focus quand les boutons disparaissent |
| `queue-selection.ts` | `validation/queue-selection.ts` | Pur et testé : sélection initiale (`?message=`), cible clavier, message suivant |

**Mouvement (trois, chacun avec une cause).** 1. Changer de message : la lettre arrive
(`animate-rise-soft`, 4 px, 220 ms). 2. Une décision **confirmée par le serveur** : le jeton glisse
(`transform`, `--duration-slow`), la ligne se remplit (`scaleX`), la barre d'arrêt s'efface
(`--duration-base`). 3. Rien d'autre : pas d'animation décorative. Mouvement réduit : états finaux
immédiats. Erreur ou refus du serveur : le rail ne bouge pas.

**Mise en page.** Dès 1280 px (`xl`) : file 20 rem | panneau. En dessous : une seule vue à la
fois (`data-view="list" | "message"`, posé aussi par le serveur depuis `?message=`), « ← Retour à
la file » (lien réel), focus sur la lettre à l'ouverture et sur l'onglet au retour. Titre de la
lettre (destinataire) en `h2` : la hiérarchie `h1 → h2` de cet écran est désormais correcte.

**Garde-fous, une fois, au bon endroit.** `RuleNote` sous l'en-tête (« Premier contact : toujours
validé par un humain » + explication + « Seuls l'objet et le texte… ») ; « Texte affiché tel quel… »
sous la lettre ; ligne STOP **dans** le corps (jamais retirée) ; « Premier contact » et « Simulation »
sur l'en-tête de la lettre ; « Validé : … Rien n'est parti. » dans la barre de décision.

### 3.1.2 Relances Emma — le tamis (Lot 2B-1)

**Ce que l'écran raconte** : *Emma ne relance que les dossiers où c'est permis, et montre pourquoi
les autres sont bloqués.* Les dossiers entrent à gauche, chaque porte en arrête certains, ceux qui
passent tout arrivent à la validation humaine.

| Composant | Fichier | Rôle |
|---|---|---|
| `follow-up-sieve.ts` | `follow-ups/follow-up-sieve.ts` | Pur et testé. **Portes** = contrôles que la page reçoit déjà, dans l'ordre où le serveur calcule `blockedReason` : « Reprise par un conseiller » (`humanTakeover`), « Relance déjà en attente » (`hasPendingEmmaDraft`), « Consentement et coordonnée » (`channel`). La première porte fermée est donc toujours le motif du serveur. `groupCandidates`, `funnelOf`, `blockedCount` : décomptes **d'affichage** de la liste reçue. Coupe-circuit : non reçu par la page, non dessiné (le serveur le revérifie au clic) |
| `SieveFunnel` | `follow-ups/SieveFunnel.tsx` + `.module.css` | Bande de synthèse = le tamis : total → une porte par contrôle (nœud creux) avec « N arrêtés » (lien vers le groupe) et **un point creux par dossier** → `AgentAppIcon kind="human"` + « N prêts » (points pleins). Épaisseur du trait = part réelle des dossiers encore dans le flux (2 → 9 px). Pied : légende « 1 point = 1 dossier » + `RuleNote` « Un brouillon, jamais un envoi » (une fois). Horizontal dès 768 px, vertical dessous. Statique |
| `FollowUpSieve` | `follow-ups/FollowUpSieve.tsx` (client) | Une seule carte-liste : en-tête collant des portes (flou discret), groupe **Prêts** (note `runHint`, une fois), puis **Bloqués** avec un sous-groupe par motif (titre = texte de garde-fou, une fois ; « Valider le message » sur « Une relance attend déjà… »). Garde en mémoire le brouillon préparé pendant la visite |
| `EmmaFollowUpCard` | `EmmaFollowUpCard.tsx` (client) | **Ligne** du tamis : nom, étape · coordonnées disponibles (compactes), `FollowUpGates`, action. Prêt : « Préparer la relance » (action inchangée) ; bloqué : aucune action morte, le motif est lu (`sr-only`, `emma-blocked-reason`) et titré par le groupe. Survol : fond `surface-muted`, la barre d'arrêt s'allonge (×1,25) |
| `FollowUpGates` | `follow-ups/FollowUpGates.tsx` + `FollowUpRow.module.css` | Portes d'un dossier : encre là où il est passé, **marque d'arrêt** où le serveur l'arrête, pointillés après ; les portes suivantes gardent leur état réel en gris. Canal retenu écrit sous la porte du consentement. Fin : validation humaine, anneau cobalt **seulement** si un brouillon d'Emma y attend vraiment. Chaque porte a son état en toutes lettres pour les lecteurs d'écran |

**Préparer la relance.** Loader pendant l'action **et** la relecture de la liste (une seule
transition React : aucun état intermédiaire). Puis la ligne a rejoint « Une relance attend déjà
une validation humaine » : la page la suit (défilement + focus sur le résultat), **un** signal
cobalt court le long des portes jusqu'à la validation humaine (`sieve-signal`,
`--duration-slow` × 2,5), l'anneau cobalt s'y pose, et le résultat donne le brouillon en lettre
(`MessageLetter`) + « Valider le message » **direct** (`/agents-ia/a-valider?message={id}`) +
« Voir le rejeu ». « Rien n'a été envoyé… » reste écrit. Mouvement réduit : pas de signal, états
finaux. Mise en page des lignes : 3 colonnes dès 1280 px, nom sur sa ligne puis portes + action
de 768 à 1279 px, empilé dessous.

### 3.1.3 Signes partagés des écrans de travail (`features/agents-ia/components/flow/`)

| Composant | Rôle |
|---|---|
| `StopMark` | **Marque d'arrêt** : barre verticale 2 × 16 px (`md`) ou 12 px (`sm`), encre (le flux s'arrête vraiment ici) ou `line-strong` (porte fermée non atteinte). Même signe que la landing et le rail. Toujours `aria-hidden`, toujours accompagnée du motif écrit |
| `RuleNote` | Règle produit dite **une fois** par écran, au bon endroit : tuile humaine (double contour) + phrase en gras + explication. Plus calme qu'une `Alert` (ce n'est pas un événement). Textes jamais raccourcis |
| `WorkGroup` | Groupe d'un écran de travail : `section` + titre (`h2` « lead » en `text-section`, ou `h3` « sub ») + décompte exact + note d'une ligne + action à droite + ancre. `headerClassName` pour la bande d'un groupe posé dans une carte-liste |
| `MessageLetter` | Le message tel qu'il sera : **email** = feuille blanche (`shadow-raised`, rayon `xl`) « À » + canal + destinataire, objet sous un filet pointillé, corps `text-base` interligne 1,65 ; **SMS / WhatsApp** = fil perle avec **une bulle sortante** noire. Corps en texte brut, **complet** (ligne STOP incluse). `muted` + `stamp` pour un message traité |

À réutiliser pour « Leads entrants » et « Suivi des rendez-vous » : `StopMark` (champ manquant,
compte-rendu manquant), `WorkGroup` (couloirs / étapes), `RuleNote` (« Un lead n'est pas un
consentement »), `MessageLetter` ou sa feuille pour le message brut du prospect.

### 3.2 Composants du module « Pipeline » (`features/pipeline/components/`)

**Ce que l'écran raconte** : *chaque dossier avance de gauche à droite, jusqu'au mandat
scellé par une personne* — avec les mêmes signes que la frise du tableau de bord (§ 3.5),
pour que les deux écrans se lisent pareil : un point de la frise = une carte ici.

| Composant | Fichier | Rôle |
|---|---|---|
| `PipelineBoard` | `PipelineBoard.tsx` (+ `PipelineBoard.module.css`) | Répartit les contacts (`groupContactsByStage`), pose la carte des étapes, puis **une seule ligne** des six étapes actives dans une zone qui défile horizontalement, puis `perdu` à part, sous la ligne |
| `PipelineStageNav` | `PipelineStageNav.tsx` (client) | Carte du parcours au-dessus de la ligne : un segment par étape (2 px, `line-strong`), libellé + compte exact (libellé en `sr-only` sous 640 px), « Perdu » en pointillés à part. Grille `repeat(6, minmax(0,1fr))`, puis `minmax(max-content,1fr)` dès 1024 px : segments égaux quand la place le permet, jamais plus étroits que leur libellé (**aucun libellé tronqué à 1024, 1280, 1440 px**, E2E) ; en dessous, un libellé peut passer sur deux lignes, jamais d'ellipse ; le compte suit le dernier mot (en ligne). Les segments des colonnes visibles passent en `ink` (`IntersectionObserver`, 60 % de la colonne) : c'est la position dans le parcours, surtout sur téléphone. Liens d'ancre : sans JavaScript, saut natif ; avec, la zone est amenée **instantanément** sur la colonne (pas de défilement animé) sans bouger la page, et le focus va au titre de la colonne |
| `PipelineColumn` | `PipelineColumn.tsx` | Une étape : `section`/`h2` (`tabIndex=-1` pour la carte des étapes). En-tête sur la ligne du parcours : nœud creux 10 px (`border-ink-subtle`), segment `bg-line-strong` 1 px jusqu'au nœud suivant (chaque colonne dessine le sien), libellé `text-base`, compte exact `text-heading` + « dossier(s) » (`data-testid="pipeline-column-count"`). « Étape n sur 6 » visible sous 640 px, `sr-only` au-dessus. « Mandat signé » termine la ligne : `AgentAppIcon glyph="mandate" kind="outcome"` + « Confirmé par un humain » posé sur la ligne. Colonne vide : cadre pointillé « Aucun dossier à cette étape. ». Colonnes en `subgrid` (en-tête / cartes) : toutes les cartes commencent à la même hauteur |
| `PipelineLostLane` | `PipelineLostLane.tsx` | `perdu` hors de la ligne : cadre `border-dashed border-line-strong bg-surface-muted`, nœud pointillé, chiffre `text-ink-subtle`, note « Affichée à part… », cartes en grille qui passe à la ligne (jamais de défilement) |
| `PipelineContactCard` | `PipelineContactCard.tsx` | Un dossier : `rounded-xl`, `shadow-subtle` → `shadow-raised` + filet `line-strong` au survol du lien. Deux cibles jamais imbriquées : le corps est un lien vers `/contacts/[id]` (nom ; « Maison · 142 m² » ; secteur, sinon ville ; états via `ContactStateMarks` : forme humaine + « Repris par un conseiller », glyphe tâches + « 1 tâche ouverte ») ; « Changer d'étape » est un petit bouton rond dans le coin haut droit |
| `PipelineStageMenu` | `PipelineStageMenu.tsx` (client) | Bouton rond 32 px, glyphe `stageMove` (un nœud envoyé le long de la ligne), **toujours visible** (`ink-subtle`, `ink` au survol), nom accessible « Changer d'étape pour {nom} ». Au survol (pointeur fin) **et** au focus clavier, même état : « Changer d'étape » en bulle noire **à gauche du glyphe**, dans la carte (lue avec la flèche comme une seule phrase, jamais par-dessus la carte du dessus), et la flèche avance de 2,5 px le long de la ligne ; appuyé : le bouton s'enfonce (×0,92, fond `line`). Tactile : ni bulle ni texte permanent, nom accessible inchangé. Ouvert : la flèche tourne de 90° vers la liste, qui se **déplie dans la carte** (`bg-surface-muted`, jamais coupée par la zone qui défile) : sept étapes, actuelle cochée (`aria-current`) et non sélectionnable, flèches / Début / Fin, Échap rend le focus. Déplacement direct avec spinner sur l'option ; erreur serveur affichée telle quelle, sélection conservée |
| `MandateEnterDialog` | `MandateEnterDialog.tsx` (client) | Entrée en « Mandat signé » : rappel « décision humaine, jamais un agent IA », `Checkbox` obligatoire, bouton désactivé tant qu'elle n'est pas cochée — **inchangé** |
| `MandateExitDialog` | `MandateExitDialog.tsx` (client) | Sortie de « Mandat signé » (directeur) : `Checkbox` + `Textarea` « Motif (obligatoire) » 3–500 caractères avec compteur — **inchangé** |
| `PipelineStageChangeProvider` | `PipelineStageChangeProvider.tsx` (client) | Zone `role="status"` toujours présente (pastille noire translucide en bas d'écran, 6 s) ; rend le focus au bouton de la carte dans sa nouvelle colonne — **inchangé** |

**Une ligne, défilement natif.** `.scroller` : `overflow-x: auto`, `container-type:
inline-size`, déborde dans la gouttière de `.page-frame` (marges négatives + même padding)
avec un fondu (`mask-image`) limité à cette gouttière : au repos, rien n'est estompé.
Largeur d'une colonne : `max(16rem, (100cqw − 5 × 0,75rem) / 6)` dès 640 px (les six
tiennent sur un grand écran, sinon la ligne défile) ; téléphone : `100cqw − 2,75rem` (une
colonne et le bord de la suivante) avec `scroll-snap-type: x mandatory`. **Pas
d'aimantation dès 1024 px** : le navigateur ré-aimante sur l'élément qui prend le focus, ce
qui ferait sauter les colonnes. Aucun défilement scripté ni amorti : molette horizontale /
Maj + molette, tactile, flèches du clavier une fois la zone focalisée (`role="region"`,
`tabIndex=0`, nom « Parcours des dossiers, de gauche à droite » — **jamais** un libellé
d'étape dans ce nom : les tests cherchent les colonnes par sous-chaîne), Tab à travers les
cartes (le navigateur amène la carte à l'écran). `overflow-anchor: none` sur le tableau :
une carte qui change de colonne ne fait pas sauter la page.

**Mouvement (deux, chacun avec une cause).**
1. Survol d'une carte (pointeur fin) : le nœud de son étape passe en `ink` et grossit
   (×1,3), comme la frise.
2. Changement d'étape (une décision humaine) : la carte arrive dans sa nouvelle colonne
   (`card-arrive`, 560 ms : descend de 6 px, contour `ink` 1,5 px qui s'efface) et le nœud de
   l'étape l'enregistre une fois (`node-register`, 640 ms : ×1,5 et rempli, puis retour).
   Marques `data-arrived` / `data-arrival` posées par `PipelineStageMenu` quand le focus
   revient à la carte, retirées après 900 ms ; la carte est amenée à l'écran par
   `scrollIntoView({ block: "nearest", inline: "nearest" })` (instantané).

Rien ne bouge seul. Mouvement réduit : aucune animation (règle globale + règle explicite du
module), tous les états restent.

**Règles qui ne changent pas.**
1. Un déplacement ordinaire part au clic ; entrer dans ou sortir de « Mandat signé » passe
   **toujours** par un `Dialog` avec une case non précochée.
2. Une option indisponible (sortie de mandat pour un conseiller) reste focalisable
   (`aria-disabled`, pas `disabled`) et porte sa raison via `aria-describedby`.
3. La liste des étapes est **opaque** et dans le flux de la carte (un panneau flottant
   serait coupé par la zone qui défile).
4. Les guillemets « … » de ces textes utilisent des espaces insécables.

**`perdu` n'a pas le même poids visuel que les étapes actives** : hors de la ligne,
pointillés et texte atténué — jamais seulement par la couleur (le libellé le dit aussi).

**Compteurs réels uniquement.** Chaque colonne affiche le nombre de dossiers réellement lus
par `getContacts()`. Aucun taux de conversion, aucune durée moyenne, aucune évolution.

### 3.2.1 Contacts vendeurs et fiche contact (`features/contacts/components/`)

| Composant | Fichier | Rôle |
|---|---|---|
| `ContactsTable` | `ContactsTable.tsx` | Dès 768 px : tableau `rounded-2xl` en `table-fixed`, **jamais de défilement horizontal** (vérifié en E2E à 1280 et 1440 px). Dès 1440 px (`wide:`), six colonnes : Contact · Étape (`w-46`, tient le badge le plus long) · Bien (`w-42`) · Coordonnées · Source (`w-36`) · Mise à jour (`w-36`) ; Contact et Coordonnées se partagent le reste. De 1280 à 1439 px, cinq : la source passe sous le téléphone (`text-xs`) et Contact a une largeur fixe (`w-52`) — nom et marques d'état sur une ligne, email, téléphone et « Téléphone non renseigné » sur une ligne chacun (données fictives). De 768 à 1279 px (dont 1024 px avec la colonne de navigation), quatre colonnes : la date passe sous le nom (« Mis à jour le … », `text-xs`), la source sous le téléphone. Les emails se coupent d’abord après « @ » (`ContactEmail`), les lieux après « — », jamais une unité ni un nom composé. Toute la ligne mène à la fiche : le nom est le vrai lien, sa zone (`after:absolute inset-0`) couvre la ligne ; survol : fond `surface-muted`, nom souligné `line-strong`, flèche qui avance de 2 px en fin de ligne. Légende `aria-hidden` des formes au-dessus, à droite |
| `ContactsMobileList` | `ContactsMobileList.tsx` | Sous 768 px : une carte par contact (nom + date, badge d'étape + états, bien, coordonnées, source), toute la carte est la cible. Jamais un tableau miniature |
| `ContactEmail` | `ContactEmail.tsx` | Email qui peut passer à la ligne sans être coupé : coupure préférée après « @ » (`<wbr>`), `overflow-wrap:anywhere` en dernier recours |
| `ContactStateMarks` | `ContactStateMarks.tsx` | Les deux états réels d'un dossier **par la forme** : reprise par un conseiller = petit cercle à double contour (famille `human`) ; tâches ouvertes = glyphe `tasks` + nombre. `labelled` (forme + mots : pipeline, fiche, téléphone) ou `compact` (forme + chiffre, mots en `sr-only` et en infobulle : tableau). Rien si aucun état |
| `PropertyCell` / `propertyParts` | `PropertyCell.tsx`, `property-summary.ts` | Bien sur deux lignes : « Maison · 142 m² » (espace insécable avant « m² »), puis secteur, sinon ville (« Saint-Cyr-sur-Mer — Les Lecques », jamais coupé). Rien d'inventé : « Bien non identifié » sinon |
| `ContactTimeline` | `ContactTimeline.tsx` + `timeline-mark.ts` | Rail de tuiles `AgentAppIcon size="sm"` : le **symbole** dit ce qui s'est passé (symbole de l'agent pour une exécution IA, `mail`, `tasks`, `appointment`, `pipeline` pour un changement d'étape, `document` sinon), la **forme** dit qui a agi (tuile sombre = agent IA, double cercle = personne, tuile claire = système ; passage humain en « Mandat signé » = disque plein). Exécution bloquée ou en échec : tuile en creux + `RunStatusBadge`. En-tête : type · acteur en texte, badges « Simulation », date. Revue humaine inchangée |

Fiche contact : en-tête = badge d'étape, `ContactStateMarks`, « Dernière mise à jour … » en
texte atténué ; panneau Agents IA et carte Consentements **inchangés** (comportement et
textes : consentement vérifié côté serveur, simulation).

### 3.3 Composants du formulaire public d'estimation (`features/estimation/components/`)

| Composant | Fichier | Rôle |
|---|---|---|
| `EstimationForm` | `EstimationForm.tsx` (client) | Le formulaire entier : récapitulatif d'erreur, trois sections, champ piège invisible, bouton d'envoi et sa note, état de succès qui remplace le formulaire |
| `EstimationIdentityFields` | `EstimationIdentityFields.tsx` | Prénom, nom, email, téléphone |
| `EstimationPropertyFields` | `EstimationPropertyFields.tsx` | Type de bien (`Select`), ville, code postal, surface, pièces, message libre (`Textarea`) |
| `EstimationConsentGroup` | `EstimationConsentGroup.tsx` | `fieldset`/`legend`, une case par canal, lien vers la politique de confidentialité |
| `EstimationRequiredLabel` | `EstimationRequiredLabel.tsx` | Libellé d'un champ obligatoire : ajoute « (obligatoire) » **dans le texte du libellé** |

#### Règles de cet écran (non négociables)

1. **Aucune case n'est cochée par défaut.** C'est une exigence légale : le
   consentement est un acte positif. L'état initial du formulaire
   (`INITIAL_ESTIMATION_FORM_STATE`) et le composant sont couverts par des
   tests qui échouent si une case devient cochée, y compris un balayage de
   **toutes** les cases à cocher de l'écran (un cinquième canal serait couvert).
2. **Le texte affiché est le texte enregistré.** Le libellé visible d'une case
   vient mot pour mot de `features/estimation/consent-texts.ts`, jamais d'une
   variante rédigée dans le composant : c'est ce texte que la base conserve
   comme preuve (`consents.presented_text`).
3. **Aucun prix, jamais.** Ni titre, ni sous-titre, ni bouton, ni confirmation,
   ni métadonnée ne suggère un chiffre, une fourchette ou un calcul
   automatique. La promesse est l'étude d'un conseiller humain. Un test unitaire
   et un test E2E vérifient l'absence de « € » sur l'écran et dans la
   confirmation.
4. **Champ obligatoire annoncé par du texte.** `required` seul n'est perçu que
   par les lecteurs d'écran : le marqueur « (obligatoire) » fait partie du
   libellé, donc du nom accessible. Jamais d'astérisque seule, jamais une
   couleur. Conséquence pour les tests : un libellé se cherche avec une
   expression régulière ancrée (`^Nom( \(obligatoire\))?$`), sinon « Nom »
   attrape aussi « Prénom » et « Nombre de pièces ».
5. **Erreurs reliées au champ.** Chaque message est rendu par `Field`,
   `Textarea` ou la case concernée, relié par `aria-describedby` avec
   `aria-invalid`. Le récapitulatif (`Alert tone="error"`, `role="alert"`, dans
   une zone `aria-live="polite"`) reçoit le focus. S'il ne peut désigner aucun
   champ affiché, il affiche un texte général plutôt que d'envoyer le visiteur
   chercher un message qui n'existe pas.
6. **La validation navigateur est un confort.** Le formulaire réutilise
   `estimationRequestSchema` tel quel (aucune règle réécrite côté client) et le
   serveur, puis la base, revalident tout. Aucune vérification serveur n'est
   contournée ou anticipée.
7. **Le champ piège reste hors de portée** : hors écran, `aria-hidden`,
   `tabIndex={-1}`, jamais nommé dans l'interface, et aucun message d'erreur ne
   révèle son existence.

### 3.4 Le badge « simulation » est une règle produit

Toute action simulée (message, rendez-vous, exécution d'agent IA) affiche
`SimulationBadge`. C'est un garde-fou de `CLAUDE.md` : on ne doit **jamais** confondre
une action simulée avec un envoi réel. Le badge porte son propre texte : il ne se
réduit ni à une couleur ni à une icône.

### 3.5 Composants du tableau de bord (`features/dashboard/components/`)

| Composant | Fichier | Rôle |
|---|---|---|
| `DashboardFigure` | `DashboardFigure.tsx` | Un chiffre **toujours suivi de son périmètre** (« en attente, toutes dates », « ouvertes, toutes dates », « état actuel », « aujourd'hui », « sur 7 jours », « à venir ») ; « Indisponible » si le calcul a échoué, jamais `0` |
| `ActionListCard` | `ActionListCard.tsx` | Liste d'action générique : titre (`h3`, ou `h2` en bloc de premier niveau), total exact, aide d'**une ligne** sur bureau, échantillon (« Les 5 premiers sur 12 » si `hasMore`), lien vers l'écran de travail (« Tout voir » quand l'échantillon est partiel et que l'écran liste tout). **État vide compact** : une seule rangée (pastille ✓ `aria-hidden` + texte atténué) à la place du premier élément, sous le même filet. `layout="subgrid"` : la carte occupe trois rangées de la grille parente (`row-span-3 grid-rows-subgrid`) — en-tête, liste, pied — pour que filets et pieds des cartes d'une même rangée soient alignés au pixel |
| `MessageItem` / `InboundLeadItem` / `AppointmentItem` / `TaskItem` / `ContactLink` | — | Un élément d'échantillon : contact lié à sa fiche, statut en badge, `SimulationBadge` si simulé. Un lead n'a pas de fiche : il mène à « Leads entrants ». Aucun texte libre du prospect |
| `PipelineFrieze` (+ `FriezeStage`, `FriezeCheckpoint`, `FriezeRail`, `FriezeDots`, `frieze.ts`, `PipelineFrieze.module.css`) | — | **Démonstration de l'écran**, premier bloc : « Où en sont les dossiers ». Voir « Frise du pipeline » ci-dessous |
| `TodoSection` / `TodoRow` | `TodoSection.tsx`, `TodoRow.tsx` | « À faire maintenant » : **un seul panneau**, une rangée par type de décision humaine (messages, leads, rendez-vous à confirmer, à clôturer, tâches). Grille commune `lg:grid-cols-[18rem_minmax(0,1fr)]` : à gauche la tuile humaine (`AgentAppIcon kind="human"`, anneau cobalt seulement si quelque chose attend), le titre, le chiffre + périmètre, l'aide et **le lien vers l'écran de travail sous l'en-tête** ; à droite, toute la largeur pour les deux premiers éléments (`TODO_ROW_SAMPLE`, deux colonnes dès 1280 px), précédés de « Les 2 premiers sur N » si partiel. État vide : une ligne ✓ à la place des éléments. Sous 1024 px : en-tête, éléments, puis lien |
| `AgentsSummary` / `RunCountsList` | — | Badge « Simulation » sur la ligne du titre (actions de `Card`, comme la fiche contact). État du coupe-circuit (lu à part, visible même si les exécutions sont indisponibles) ; exécutions aujourd'hui et sur 7 jours : total, **erreurs techniques**, **bloquées par un garde-fou** (dit explicitement « pas une erreur »). Lien vers `/agents-ia`, jamais de bouton dupliqué |
| `UpcomingAppointments` | `UpcomingAppointments.tsx` | `ActionListCard` de premier niveau : total à venir + 5 prochains créneaux (heure de Paris) |

**Motif « chiffre + périmètre ».** Chiffre en `text-title` (`text-heading` en tuile),
unité en `text-sm text-ink-muted` sur la même ligne de base, périmètre en dessous en
`text-xs text-ink-subtle`, précédé d'un « Périmètre : » réservé aux lecteurs d'écran.
Ni tendance, ni flèche, ni pourcentage : l'écran n'affiche que ce que le serveur a compté.

**Frise du pipeline (`PipelineFrieze`).** Ce qu'elle raconte : *où sont les dossiers, et où
une personne doit décider*. `buildFrieze(pipeline, todo)` ne fait que **réordonner** ce que
`getDashboardSummary` a compté (aucun taux, aucune tendance, aucun nouveau chiffre).

- **Une ligne** (`bg-line-strong`, 1 px) dans l'ordre du parcours vendeur : horizontale dès
  1280 px, verticale à gauche en dessous. **De 768 à 1279 px**, la carte est en deux colonnes
  (`minmax(0,3fr) minmax(14rem,2fr)`) : la ligne verticale à gauche, et une colonne de marge
  séparée par un filet `line` avec la légende en haut (au départ de la ligne) et « Perdu » en
  bas (à hauteur de « Mandat signé ») — même proportion avec ou sans la colonne de navigation,
  donc pas de saut à 1024 px ni de grand blanc à droite. Sous 768 px : une colonne ; dès
  1280 px : « Perdu » puis la légende sous la ligne. Chaque pas dessine son propre segment
  (`FriezeRail`), la ligne est continue quelle que soit la largeur.
- **Étape** (`FriezeStage`) : un nœud creux de 10 px sur la ligne, le libellé
  (`PIPELINE_STAGE_LABELS`), le compte exact (`text-hero` dès 1280 px) + « dossier(s) », et
  **un point par dossier** (`FriezeDots`, 8 px, `bg-ink-subtle/55`) : barre de points qui monte
  depuis la ligne, 10 par colonne (`FRIEZE_COLUMN_ROWS`), plafonnée à `FRIEZE_DOT_CAP` = 40
  points et alors dite (« 40 points affichés »). La hauteur de la bande = la plus haute barre
  réellement dessinée. Compte indisponible : « Indisponible » et une barre en pointillés, jamais 0.
- **Décision humaine** (`FriezeCheckpoint`) : la tuile `AgentAppIcon kind="human" size="sm"`
  posée **sur** la ligne, là où la décision se prend (leads à traiter avant « Nouveau »,
  rendez-vous à confirmer avant « RDV planifié », comptes-rendus à saisir avant « Estimation
  faite »). Anneau cobalt (`state="active"`) **seulement** si le total est > 0 ; gris à zéro ;
  inactif si indisponible. Le chiffre est un lien vers l'écran où la décision se prend et vaut
  exactement le total de la rangée « À faire » correspondante.
- **Mandat signé** termine la ligne : forme « issue » (`AgentAppIcon glyph="mandate"
  kind="outcome"`, disque noir), points en `ink`, mention « Confirmé par un humain ».
- **Perdu** : hors de la ligne, en dessous, rangée en pointillés sur fond atténué, chiffre
  `text-ink-subtle`, points creux, note « Étape qui n'est plus travaillée activement ».
- Légende `aria-hidden` (le sens est porté par le texte) : « 1 point = 1 dossier »,
  « Décision humaine attendue ». Sous-titre : « Chaque dossier à son étape, et les
  décisions humaines en chemin · état actuel ».
- **Mouvement** : un seul, avec une cause — survoler une étape (pointeur fin) passe ses
  points en `ink` et grossit son nœud (×1,3), les autres barres reculent à 32 %
  (`--duration-base`, propriétés de peinture/transform seulement). Rien ne bouge seul ; en
  reduced motion, les états restent, les transitions disparaissent. Aucune information
  n'est derrière `Reveal` : l'écran entier est dans le HTML serveur.
- Pour `/pipeline` : reprendre les mêmes signes (nœud creux = étape, tuile humaine à double
  contour + anneau cobalt = décision humaine attendue, disque noir = mandat confirmé par un
  humain, pointillés = perdu) pour que les deux écrans se lisent de la même façon.

### 3.6 Tâches (`features/tasks/components/`) et rendez-vous (`features/appointments/components/`)

| Composant | Fichier | Rôle |
|---|---|---|
| `TaskList` | `TaskList.tsx` | Une page de tâches dans une surface unique à séparateurs (`divide-y`), entrée échelonnée (`stagger`), puis `Pagination` |
| `TaskRow` | `TaskRow.tsx` | Server Component : titre (`h3`, texte brut), contact lié à sa fiche ou « Tâche d'agence » (texte atténué, aucun lien), échéance en heure de Paris, badge `solid` « En retard » **écrit**, agent qui a ouvert la tâche |
| `CompleteTaskButton` | `CompleteTaskButton.tsx` (client) | « Marquer comme faite » : verrou par `ref` + `useTransition` (aucun double envoi), bouton désactivé une fois la tâche close, erreur serveur affichée telle quelle sous le bouton (`Alert error`) |
| `TaskCompletionProvider` | `TaskCompletionProvider.tsx` (client) | Zone `aria-live` au-dessus de la liste (la ligne terminée disparaît, elle ne peut pas porter sa confirmation) : succès en `Alert success`, « déjà terminée » en `Alert info` (une information, pas une alerte) ; le focus y est déplacé puis la liste est relue (`router.refresh`) |
| `AppointmentList` / `AppointmentRow` | — | Tuile calendrier (jour + mois court, `aria-hidden` : le créneau complet est écrit à côté), créneau avec l'année, contact lié, statut (`Proposé` contour, `Confirmé` ✓, `Réalisé` gris, `Annulé` pointillés — jamais `solid`, réservé au badge « Simulation » juste à côté), `SimulationBadge`. Lien vers le suivi **seulement** si une action est possible : « Confirmer » si `canBeConfirmed`, « Clôturer » si `canBeCompleted` **et** heure de début passée, sinon « Ouvrir dans le suivi » (confirmé, encore à venir). `now` est lu une fois par requête et passé en prop (`follow-through-action.ts`, rendu pur) |

**Motif « liste de travail paginée ».** `PageHeader` → rangée `ListTotal` (gauche) + `LinkTabs` (droite, passe dessous en mobile) → liste → `Pagination`. Filtres, onglets et page vivent dans l'URL et sont transmis tels quels au serveur, qui les valide : un filtre inconnu donne l'erreur du serveur, aucun onglet marqué courant et un lien de retour. Une page au-delà de la fin n'est pas « aucune tâche » : elle le dit et propose la première page.

### 3.7 Paramètres (`features/settings/components/`) et inscription

| Composant | Fichier | Rôle |
|---|---|---|
| `AgencyProfileCard` | `AgencyProfileCard.tsx` | `DataList` une colonne : nom, ville, secteur ; valeur vide → « Non renseigné » en `text-ink-subtle` |
| `TeamCard` | `TeamCard.tsx` | Liste à séparateurs : email (`break-all`), « (vous) » en graisse normale atténuée, « Membre depuis le … » (heure de Paris), rôle écrit en badge (`Directeur` contour, `Conseiller` gris). Badge de rôle sous l'email en mobile, à droite dès `sm` |
| `AgentsSettingsSection` | `AgentsSettingsSection.tsx` | Section `h2` + lien « Ouvrir les agents IA », puis `KillSwitchPanel` (`h3`, **seul contrôle actif de l'écran**) et la limite quotidienne au motif « chiffre + périmètre » (§ 3.5) |
| `IntegrationsCard` | `IntegrationsCard.tsx` | Trois colonnes (une en mobile) par catégorie, titre en `text-overline` (`h3`) ; chaque intégration : nom, `SimulationBadge` **et** badge `dashed` « Non connectée », puis ce qui est simulé à sa place — ou « Aucun échange, même simulé » |
| `RetentionCard` | `RetentionCard.tsx` | Valeur dans un cadre pointillé (motif « information absente », comme le badge `dashed`) : « Non définie — à valider avant mise en production », jamais une durée |
| `SectionUnavailable` | `SectionUnavailable.tsx` | « Indisponible » + explication + « Réessayer », pour **une seule** section en échec |

**Motif « écran en lecture seule ».** Badge `outline` « Lecture seule » sous le titre, puis
`Alert info` qui dit où se font les modifications (avec Ascend Strategy, lors de la mise en
place) — sans date ni « bientôt ». Aucun champ désactivé factice : on affiche des valeurs,
pas des formulaires grisés. Le seul contrôle actif (coupe-circuit) garde son composant et ses
règles d'origine.

**Inscription (`/inscription`).** Même gabarit que la connexion (`max-w-sm`, titre, sous-titre,
carte `shadow-raised`) : explication en carte avec pictogramme cadenas `aria-hidden`, séparateur,
bouton principal pleine largeur « Se connecter », lien discret « Retour à l'accueil ». Aucun
formulaire, aucune adresse de contact inventée.

### 3.8 Titres éditoriaux, sur-titres et états vides (typographie expressive, 01/10/2026)

Valeurs au § 2.2 ; textes exacts au § 2.2.9.

**`EditorialTitle`** (`components/ui/EditorialTitle.tsx` + `EditorialTitle.module.css`, Server
Component, aucun JavaScript). Seul composant de titre-phrase du site public : il remplace
`HeroTitle` (supprimé avec son module CSS), le `h2` de `LandingHeading` et celui de
`ProblemHeading`, et le `h1` de `/estimation`.

| Prop | Type | Règle |
|---|---|---|
| `as` | `"h1" \| "h2"` | Obligatoire. Un seul `h1` par page |
| `id` | `string` | Obligatoire (cible des `aria-labelledby` des sections) |
| `lines` | `readonly string[]` | Lignes d'auteur, déclarées dans les textes. 1 à 4 lignes animées ; au-delà, rendu statique |
| `accent` | `string?` | Un mot entier présent exactement une fois dans `lines` ; sinon aucun accent (et le test des textes échoue) |
| `subtleBefore` | `number?` | Les lignes d'indice < n sont en `ink-subtle` (section « problème » : 2) |
| `size` | `"poster" \| "statement" \| "page"` | `poster` : `min(var(--text-poster), 14cqi)` en `wdth` 92, à placer dans un conteneur `container-type: inline-size` ; `statement` : `text-statement` ; `page` : `text-title` → `sm:text-hero` → `lg:text-page` |
| `reveal` | `"load" \| "in-view" \| "none"` | `load` : animation CSS au chargement, `--title-line-delay` 100 ms ; `in-view` : joue sous le `Reveal` englobant (`[data-reveal="entering"]`), délai 0 ; `none` : statique |
| `accentEffect` *(lot landing-motion, à créer)* | `"none" \| "underline" \| "focus" \| "focus-underline"` | Défaut `"none"` (rendu actuel, CRM et `/estimation` inchangés). `underline` : hero ; `focus` : section « problème » ; `focus-underline` : panneau final, et depuis le 02/10 solution, agents, contrôle, résultat. Aucun autre titre. Spécification complète au § 2.11.2 |
| `accentReplay` *(02/10 — finition, à créer)* | `boolean?` | Défaut `false`. Si `true` **et** effet ≠ `none` : pose `data-accent-replayable` sur le titre, qui se rejoue au survol (pointeur fin, mouvement autorisé ; § 2.11.2 D). Landing seulement (les sept titres) ; jamais dans le CRM ni sur `/estimation` |
| `className` | `string?` | Mise en page seulement (marges, largeur max) |

Structure rendue (identique pour tous les modes, pour un seul test d'accessibilité) :

```
<h1|h2 id class="title size">              Bricolage 600, ink, approche du token
  <span class="sr-only">{lines.join(" ")}</span>   nom accessible, lu une fois
  <span aria-hidden="true" data-testid="editorial-title-visual">
    <span class="line" style="--line:n">   display:block, une par ligne d'auteur
      <span class="word">Chaque</span> …   inline-block (le flou l'exige), espaces texte entre mots
      <span class="nowrap">                inline, white-space:nowrap : préfixe + mot + suffixe
        <span class="word">l'</span><span class="title-accent" data-accent>administratif</span><span class="word">.</span>
```

- Découpage : par espaces ; le mot accentué est cherché comme **mot entier** (« main » n'est pas
  trouvé dans « maintenant ») ; article élidé et ponctuation restent hors du mot. Reprendre la
  logique `splitAccent` / `countAccent` déjà écrite et testée dans
  `app/dev/typographie/AccentTitle.tsx` (à déplacer dans `components/ui/editorial-title.ts`,
  fonction pure, avant la suppression de la galerie). **Fait** ; le module ajoute
  `splitTextAccent` (découpage d'un titre d'une ligne, utilisé par `EmptyState`), `findAccent`
  et `isAnimatable`, testés dans `components/ui/editorial-title.test.ts`.
- Mot accentué : classe globale `.title-accent` (`inline`), plus la classe d'animation « net »
  quand `reveal` ≠ `none`. Jamais `inline-block`.
- Pas de masque `overflow: hidden` (il couperait le flou et les jambages de l'italique).
- Sans JavaScript, sous mouvement réduit, sous pause du site, avec `reveal="none"` ou plus de
  quatre lignes : phrase complète, nette, immobile.

**`Overline`** (`components/ui/Overline.tsx`). Props : `children: string`, `as?: "p" | "span"`
(défaut `p`), `className?`. Rendu : `.label-mono` + trait `::before` 12 × 2 px `bg-accent`,
`inline-flex items-center gap-2.5`. Le texte est passé en casse normale (capitales par CSS).
Utilisé par `PageHeader`, `LandingHeading`, `ProblemHeading` et `/estimation` ; remplace les
`kicker` en `text-overline font-semibold uppercase` de la landing.

**`PageHeader`** (évolution, mêmes props + `overline?: string`) :

- Sur-titre au-dessus de la rangée « tuile + titre », sur le bord gauche de la page (même bord
  que le fil d'Ariane), `mb-3`, posé sur `.particle-veil .particle-veil-tight w-fit`. Si
  `eyebrow` (fil d'Ariane) est présent, pas de sur-titre (règle du § 2.2.6, non imposée par le
  type mais par les appels).
- `h1` : `font-display font-semibold text-title sm:text-hero lg:text-page text-balance text-ink`
  (fin de `font-extrabold`).
- Tuile d'écran (56 px), description, badges, actions, `animate-rise` : inchangés. Aucune
  apparition ligne par ligne, aucun mot accentué.
- Téléphone : sur-titre, puis titre 32 px ; le sur-titre ne passe jamais sur deux lignes (textes
  ≤ 16 caractères).

**`EmptyState`** (évolution, mêmes props + `titleAccent?: string`) :

- Titre : `font-display text-section font-semibold text-balance text-ink` (28 px, Bricolage 600,
  `-0.015em`), pour **tous** les états vides, accentués ou non.
- `titleAccent` (seulement si `title` est une chaîne et contient le mot entier) : le mot est
  enveloppé dans un `span.title-accent` **dans le texte**, sans copie `sr-only` ni
  `aria-hidden` (aucun découpage en mots, donc nom et `textContent` identiques au titre ;
  `getByText(titre)` continue de trouver un seul élément). Aucune animation propre : l'état vide
  garde `animate-rise`.
- Mot introuvable : titre rendu sans accent (jamais d'erreur à l'écran) ; le test des textes
  empêche ce cas.

**`Reveal`** (évolution) : prop `frame?: "move" | "still"` (défaut `move`, comportement actuel).
`still` pose `data-reveal-frame="still"` : le bloc reste opaque et immobile dans tous les
états ; l'attribut `data-reveal` continue de passer `hidden` → `entering` et sert uniquement de
déclencheur au titre éditorial qu'il contient. Utilisé par les sections de la landing dont le
premier bloc contient un `EditorialTitle`.

## 4. États d'écran obligatoires

Chaque écran gère quatre états :

| État | Mise en œuvre |
|---|---|
| Chargement | `loading.tsx` avec des `Skeleton` qui reprennent la forme réelle du contenu, conteneur `aria-busy` |
| Vide | `EmptyState` avec une action suggérée |
| Erreur | `Alert tone="error"` avec le message français renvoyé par le serveur **et** une action (réessayer / revenir) ; `app/(app)/error.tsx` en dernier recours |
| Succès | `Alert tone="success"` dans une zone `aria-live="polite"` |
| Bloqué par un garde-fou | `GuardRailNotice` (`Alert tone="info"`, `role="status"`) avec le motif du serveur ; jamais le style d'erreur |

## 5. Accessibilité

- Lien « Aller au contenu » en première position de l'espace connecté.
- Points de repère : `header`, `nav[aria-label]`, `main#content`, `footer`.
- Un seul `h1` par écran ; les cartes utilisent `h2`.
- Focus visible global (`:focus-visible`, contour 2 px noir, décalage 2 px) — jamais supprimé.
- Champs : `<label for>` réel, jamais un simple `placeholder`.
- Champ obligatoire : marqueur textuel dans le libellé (« (obligatoire) »), en plus de
  l'attribut `required`. Ni couleur seule, ni astérisque sans explication.
- Tableaux : `<caption>` en `sr-only`, `<th scope>` sur les en-têtes de colonne et de ligne.
- Les éléments décoratifs (points de progression, rails de frise, glyphes) sont `aria-hidden`.
- État courant de navigation : `aria-current="page"`.

## 6. Écriture

- Interface en **français**, code et commentaires en **anglais**.
- Tous les textes d'interface dans `components/texts.ts` (`APP_TEXTS`).
  Les libellés métier (étapes du pipeline, canaux, statuts) viennent de
  `features/contacts/types.ts` et `lib/agents/messages.ts` : **ne jamais les recopier**.
- Messages d'erreur : ce qui s'est passé + ce que l'utilisateur peut faire. Jamais de
  détail technique.
- Apostrophe typographique `’` dans les textes de l'espace connecté (convertis le
  26/09/2026 ; messages renvoyés par le serveur et textes publics gardent encore `'`).

## 7. Grille et points de rupture

- Conteneur applicatif : classe `page-frame` (§ 2.10) — `max-w-7xl`, gouttières `px-6`
  (mobile) / `px-10` (≥ 1024 px) ; `page-frame-reading` (`max-w-4xl`) et
  `page-frame-medium` (`max-w-5xl`) plafonnent sans recentrer.
- Fiche contact : `lg:grid-cols-[minmax(0,1fr)_22rem]`, colonne de droite collante.
- Écran Agents IA : bandeau `lg:grid-cols-2` (coupe-circuit + activité), grille des
  cinq agents `lg:grid-cols-2 2xl:grid-cols-3`, journal pleine largeur.
- Rejeu d'une exécution : colonne unique `max-w-4xl` (la lecture prime).
- « Messages à valider » : `page-frame`, bureau en vue double dès 1280 px (§ 3.1.1). « Relances Emma » : `page-frame`, tamis + carte-liste (§ 3.1.2).
- Files de travail (« Leads entrants ») : colonne unique
  `max-w-4xl`, une carte par élément, règle produit en `Alert tone="info"` en tête.
- Pipeline (`/pipeline`) : `page-frame`. Carte des étapes, puis les six étapes sur **une
  ligne** qui défile horizontalement (déborde dans la gouttière du cadre), colonnes de 16rem
  minimum ; une colonne par écran sous 640 px ; `perdu` en dessous, pleine largeur (§ 3.2).
- Contacts (`/contacts`) : `page-frame`, tableau dès 768 px, cartes en dessous (§ 3.2.1).
- Tableau de bord (`/dashboard`) : `page-frame`. Frise du pipeline pleine largeur (ligne
  horizontale dès 1280 px ; verticale en dessous, avec légende et « Perdu » dans une colonne
  de marge de 768 à 1279 px, § 3.5),
  puis « À faire maintenant » en un panneau à rangées (`TodoRow`,
  `lg:grid-cols-[18rem_minmax(0,1fr)]`), puis agents IA et prochains rendez-vous en
  `xl:grid-cols-2`. Blocs espacés de `gap-12` (`gap-14` dès 1024 px). Aucun `Reveal` : seule
  l'arrivée `stagger` (CSS pur, coupée en reduced motion) anime les rangées.
- Pages publiques de saisie (`/estimation`, `/politique-confidentialite`) : colonne
  unique `max-w-2xl` (sur `/estimation`, en-tête = `Overline` + `EditorialTitle` `h1` taille
  `page` + sous-titre `text-lede`, à la place de `PageHeader`, § 2.2.9), gouttières `px-6`, respiration `py-16` (`sm:py-20`). Le
  formulaire vit dans une `Card` unique, ses sections espacées de `gap-10`, l'action
  principale séparée par un filet `border-t border-line`. Les champs passent de deux
  colonnes (`sm:grid-cols-2`) à une seule sous 640 px.
- Listes paginées (`/taches`, `/rendez-vous`) : colonne unique `max-w-4xl`, comme les files de travail ; lignes empilées sous 640 px (action sous le texte).
- Navigation : barre haute + bouton « Menu » (feuille pleine hauteur) sous 1024 px, colonne
  fixe de 256 px au-dessus (§ 2.10).
- Points de rupture Tailwind par défaut (`sm` 640, `md` 768, `lg` 1024, `xl` 1280), plus
  `wide` 1440 (`--breakpoint-wide: 90rem`, largeur de référence) : un écran dense garde une
  composition plus légère de 1280 à 1439 px (tableau des contacts, § 3.2.1).

## 8. Limites connues (à traiter plus tard)

- Sans JavaScript, une page de l'espace connecté qui a un `loading.tsx` reste sur son
  squelette : Next.js envoie bien tout le contenu dans le HTML (vérifié par
  `e2e/dashboard.spec.ts`), mais c'est un script qui remplace le squelette par le contenu.
  Le squelette (état de chargement obligatoire) a été gardé ; le menu, lui, fonctionne
  sans JavaScript.

- Pas de thème sombre : les tokens sont prêts (surfaces inverses), le basculement ne l'est pas.
- Une seule modale (`Dialog`), réservée aux confirmations qui engagent l'agence
  et laissent une trace définitive dans l'historique (mandat signé). Les autres actions
  sensibles restent traitées **en place** : panneau de refus ou de correction dans la
  carte, panneau de confirmation du coupe-circuit avec focus déplacé sur « Confirmer ».
  Pas de système de toast générique : la pastille du pipeline est locale à cet écran.
- L'écran de Sarah réutilise les cartes, alertes, badges de pipeline et le rejeu existants.
  Le statut du rendez-vous conduit la carte : confirmation humaine de la proposition,
  saisie obligatoire du compte-rendu sur un rendez-vous confirmé, puis apparition de Sarah
  une fois le rendez-vous réalisé. Le compte-rendu reste un bloc de texte brut sur surface
  atténuée.
- L'espace de relances Emma (`/agents-ia/relances`) lit `getEmmaFollowUpCandidates()` : le
  canal retenu et un blocage éventuel (reprise humaine, brouillon déjà en attente, aucun
  canal consenti) sont un confort d'affichage — le bouton désactivé porte sa raison via
  `aria-describedby`, et le serveur revérifie tout au clic. Le même agent est aussi
  lançable depuis `AgentActionsPanel` de la fiche contact, à côté de Hugo et Louis.
- Le rejeu ne propose ni pause ni retour arrière étape par étape : « Tout afficher »
  et « Rejouer » suffisent pour le prototype.
- Polices Bricolage Grotesque / Instrument Serif italique / Geist / Geist Mono depuis le
  01/10/2026 (§ 2.2) ; le verrouillage du logo est composé en Geist (police d'interface), pas
  dans un caractère dessiné pour la marque. Le build a
  besoin d'accéder à Google Fonts (next/font) : hors ligne il échoue au lieu de dégrader.
- Le symbole est **matriciel**, pas vectoriel : le fichier fourni était un PNG sans canal
  alpha et aucun outil de traçage n'est installé. Le redessiner à la main aurait approximé
  la jambe incurvée et la contre-forme. Conséquence acceptée : au-delà d'environ 300 px de
  large, le tracé s'adoucit. Aucun usage actuel n'y arrive (§ 2.7.5).
- Le masque CSS n'a pas de repli visuel : sur un navigateur sans `mask-image`, le symbole
  n'est pas peint. Le nom écrit à côté dans `Logo` et le nom accessible restent, donc rien
  n'est perdu — mais un symbole seul y serait invisible.
- **Niveaux de titre des files de travail** (corrigé pour « Messages à valider » et « Relances Emma » au Lot 2B-1 : `h1 → h2`) : « Leads entrants » et « Messages à
  valider » enchaînent `h1` → `h3` (les cartes), sans `h2` intermédiaire, alors
  que le § 5 demande `h2` pour une carte. Le contournement n'est pas fait :
  corriger un seul des deux écrans les rendrait incohérents entre eux. À
  reprendre d'un coup, avec les deux fichiers dans le même lot.
- La galerie `/dev/animations`, `Reveal`, `rise-soft`, `settle` et `stagger` sont livrés.
  La reprise écran par écran reste progressive ; chaque ajout doit conserver l'information
  immédiatement disponible avec mouvement réduit.
- `--ease-exit` est défini mais n'est utilisé par aucun composant : aucune sortie
  n'est animée pour l'instant.
- Dans `PendingMessageCard`, un refus serveur au moment de l'envoi (consentement retiré
  entre-temps) s'affiche encore dans le style d'erreur (`AnimatedErrorState`, **sans**
  « Réessayer ») et non en `GuardRailNotice`. Le motif écrit est exact ; l'harmonisation
  avec les autres cartes reste à faire.
- **Fond de particules** (§ 2.5.8) : sur toute la fenêtre depuis le 26/09/2026, mais les
  cartes opaques en couvrent l'essentiel ; il se voit surtout dans les marges, les
  interstices et sous la navigation. Le contraste AA des textes hors carte repose sur
  `.particle-veil` (re-mesuré le 26/09 : minimum 5,41:1). Le voile doit être posé à la
  main sur tout nouveau bloc de texte hors carte ; un oubli est détecté par
  `e2e/voiles-lisibilite.spec.ts`, sur les onze écrans et les données fictives
  seulement (un état vide ou d'erreur non couvert par les fixtures peut encore
  échapper). Sur le perle (bas droit de la fenêtre), le voile blanc à 90 % reste
  perceptible comme une pastille très claire (+5 à +7 niveaux sur 255), surtout le
  voile serré dont le fondu est court. Les mesures de coût par image (`data-frame-ms`) sont celles de Chromium sans
  interface sur la machine de développement : elles ne comptent que le travail JavaScript de
  l'image, pas la composition du masque par le GPU.
