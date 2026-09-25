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
  la prospection qui freine vos mandats. C'est l'administratif. » ; graphique SVG
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
- Le récit suit le travail réel de Léa, Hugo, Emma, Louis puis Sarah.
- Les preuves restent vérifiables dans le prototype : cinq rôles bornés, validation
  humaine, journalisation et simulation. Aucun logo client, chiffre commercial ou
  témoignage n'est inventé.
- La grande typographie utilise une échelle fluide propre au marketing. Elle complète
  `text-display`, dimensionné pour les autres pages, et conserve la pile système.
- Les sections utilisent `Reveal`, `rise-soft` et `stagger`. Le contenu reste visible
  sans JavaScript et immédiatement disponible avec `prefers-reduced-motion`.
- Sur mobile, toutes les compositions reviennent à une colonne, les actions peuvent
  passer à la ligne et aucune zone ne dépend d'une hauteur d'écran fixe.
- **Hero** (`components/landing/LandingHero.tsx`) : étiquette inclinée
  « 5 AGENTS · CONTRÔLE HUMAIN », titre `HeroTitle` révélé ligne puis mot (masque, flou
  court, CSS pur ; état final par défaut et sous mouvement réduit ; nom accessible lu
  une fois depuis une copie `sr-only`), action noire (`primary`) puis claire
  (`secondary`), ce que le prototype fait réellement, et `HeroJourney` : parcours d'un
  prospect **fictif** étiqueté « Exemple fictif — simulation » + `SimulationBadge`. Le
  HTML serveur est l'état final (toutes les étapes terminées).
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
  rien ne bouge.
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

Pile système native (`--font-sans`) : San Francisco sur macOS/iOS, Segoe UI Variable
sur Windows. **Choix assumé** : aucun téléchargement de police, donc aucun FOUT,
aucun décalage de mise en page et aucune dépendance réseau au build — ce qui compte
plus, pour ce prototype livré sur VPS, qu'une police de marque.

| Token | Taille | Interlignage | Usage |
|---|---|---|---|
| `text-display` | 52 px | 1.04 | Titre de page d'accueil publique |
| `text-title` | 32 px | 1.15 | `h1` des écrans applicatifs |
| `text-heading` | 21 px | 1.25 | Titre de carte (`h2`/`h3`) |
| `text-base` | 16 px | — | Corps |
| `text-sm` | 14 px | — | Texte d'interface courant |
| `text-xs` | 12 px | — | Légendes, badges |
| `text-overline` | 11 px, `0.09em` | 1.2 | Sur-titres en capitales (`dt`, en-têtes de tableau) |

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

Ces cinq tokens existent aujourd'hui dans `@theme` (`app/globals.css`). Aucun autre.

| Token | Valeur | Utilitaire | Quand l'utiliser |
|---|---|---|---|
| `--duration-fast` | 150 ms | `duration-150` | Réaction directe au doigt ou au clavier : survol, pression, focus, changement de fond d'une ligne de tableau |
| `--duration-base` | 220 ms | `duration-200` | Apparition d'un élément dans un écran déjà affiché : alerte, panneau de confirmation, étape de rejeu |
| `--duration-slow` | 300 ms | `duration-300` | Entrée d'une section entière au chargement : en-tête de page, carte, tableau, état vide |
| `--ease-standard` | `cubic-bezier(.22,.61,.36,1)` | `ease-standard` | **Toute entrée** : l'élément démarre vite puis se pose. C'est la courbe par défaut du projet |
| `--ease-exit` | `cubic-bezier(.4,0,1,1)` | `ease-exit` | **Toute sortie** : l'élément part et accélère. Token disponible, **aucun composant ne l'utilise encore** |

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
| Changement d'état d'une carte (brouillon validé ou refusé) | Opacité, et légère mise à l'échelle | `scale(0.98)` → `scale(1)` | `--duration-base` | File « à valider » *(écran livré ; variante `settle` encore attendue en phase 1)* |

#### 2.5.4 Interdits

1. **Jamais d'animation sur une propriété qui recalcule la mise en page.**
   Interdits : `height`, `width`, `margin`, `padding`, `top`, `left`, `font-size`.
   Autorisés : `opacity`, `transform`, et les propriétés de peinture pure
   (`background-color`, `color`, `border-color`, `box-shadow`).
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
1 800 sous 768 px (`devicePixelRatio` plafonné à 1,5). Opacités .08 à .35. Densité
adaptative : −25 % par palier si une image coûte plus de 8 ms en moyenne sur 2 s.

**Placement** (`components/motion/background-layout.ts`, zone normalisée du canvas) :

| Fenêtre | Zone de la forme | Intensité | Pourquoi |
|---|---|---|---|
| Bureau (≥ 1 024 px) | `x .54 → .98`, `y .01 → .43` | 1 | Bande d'en-tête à droite du titre : la partie de la page que les cartes ne couvrent pas au chargement ; la navigation (256 px à gauche) et les titres alignés à gauche restent dégagés |
| Tablette (768 à 1 023 px) | `x .40 → .98`, `y .10 → .46` | .9 | Même principe, sous la barre de navigation horizontale |
| Mobile (< 768 px) | `x .02 → .98`, `y .34 → .98` | .7 | Le texte occupe toute la largeur : forme discrète, derrière, sous la zone d'en-tête |

**Lisibilité — deux voiles, jamais de transparence sur les cartes.**
1. `.app-particles` (sur le canvas) : masque dégradé peint par le compositeur, sans
   calque ni dessin supplémentaire. Bureau : transparent jusqu'à 36 % de la largeur,
   plein à 66 % ; tablette : 22 % → 62 % ; mobile : vertical, transparent sur le haut
   (26 %), plein à 62 %.
2. `.particle-veil` (sur un bloc de texte) : pastille blanche à 90 %, bords fondus
   (3 rem × 1,25 rem), sous **chaque bloc de texte posé hors carte**. Le canvas est fixe
   et la page défile : n'importe quel texte hors carte peut passer sur la forme. Sur le
   fond blanc et perle la pastille est invisible ; elle n'efface que les particules.
   Appliquée par : `PageHeader` (lien de retour, titre, description, badges),
   `ListTotal`, le résumé de `Pagination`, l'en-tête « À faire maintenant » du tableau de
   bord, l'en-tête « Les cinq agents » d'Agents IA, l'en-tête « Agents IA » des
   paramètres, la légende « perdu » du pipeline. **Tout nouveau texte hors carte doit
   la recevoir.** Dans une carte, elle serait blanc sur blanc : sans effet.

Contraste mesuré le 23/09/2026 sur captures (texte masqué, pixel **le plus sombre**
sous chaque ligne de texte hors carte, 3 instants × 3 positions de défilement, 1 440 /
1 280 / 1 024 / 768 / 390 px, 11 écrans) : minimum **5,24:1** (AA : 4,5:1).

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
- `.app-particles` / `.particle-veil` : voiles de lisibilité du fond de particules (§ 2.5.8).
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

### 2.8 Famille d'icônes et tuiles d'app (`features/agents-ia/components/icons/`)

Famille dessinée à la main, sans dépendance, pour les **agents et les étapes d'un
dossier** (et les symboles utilitaires des scènes de la landing). Les icônes Radix
restent pour les icônes utilitaires de l'application (phases d'une exécution, actions).

- **Grille** : `viewBox 0 0 24 24`, zone utile 3–21 ; **un seul trait** 1,75 (≈ 1 px à
  14 px) ; extrémités et jonctions arrondies ; `fill="none"`, `stroke="currentColor"` ;
  toujours `aria-hidden`. Lisible de 14 à 72 px. Données dans `glyphs.ts` (tracés
  seuls), rendu par `Glyph` ; `glyphIcon(name)` en fait un composant d'icône.
- **Symboles** : `lea` (un contact entre dans le bac), `hugo` (loupe + validation),
  `emma` (bulle, lignes écrites), `louis` (page de calendrier, un créneau),
  `sarah` (dossier qui avance), `human` (personne + décision), `mandate` (document +
  signature), `prospect`, `appointment` (lieu de la visite) ; utilitaires `check`,
  flèches, `lock`, `clock`, `document`, `merge`, `question`, `mail` ; pipeline : `stageMove`
  (un nœud envoyé le long de la ligne, bouton « Changer d'étape »).
- **Deux calques** : le corps (immobile) et l'**accent** (la partie qui dit le métier, la
  seule qui bouge). Mouvements nommés : `drop`, `nudge`, `pop`, `draw` (tracé). Ils
  ne jouent qu'au survol d'un parent interactif ou à l'activation ; jamais sous mouvement
  réduit.
- **Tuile `AgentAppIcon`** — la **forme** dit qui agit, jamais la couleur :
  `agent` carré arrondi (rayon 30 % du côté), tuile sombre, symbole clair ;
  `human` cercle à double contour ; `outcome` cercle plein à double contour (le mandat,
  scellé par une personne) ; `neutral` carré clair (prospect, rendez-vous).
  Tailles `sm` 28 / `md` 40 / `lg` 56 / `xl` 72 px (symbole 14 / 18 / 24 / 30).
  Surfaces `light` et `dark`. États `idle`, `active` (soulevée de 2 px, fin anneau
  cobalt, le symbole joue son mouvement une fois), `inactive` (en creux, symbole gris,
  contour pointillé pour les formes rondes). Survol du parent : soulevée de 1 px,
  l'accent bouge.
- **Espace connecté** : `AGENT_ICONS` / `JOURNEY_ICONS` (`agent-icons.ts`) pointent vers
  la famille. Rail `OperationalRail` : `RailNode.tone` donne la forme (agent terminé =
  tuile sombre, agent en échec = cadre noir en creux, validations en cercle, mandat
  confirmé = cercle plein) ; les états et la règle cobalt du rail sont inchangés, les
  phases d'une exécution n'ont pas de `tone`. `AgentOverviewCard` : tuile `md` devant le
  prénom, `inactive` quand l'agent est en pause.
- **Contrôle** : `/dev/icons` (404 en production) ; `glyphs.test.tsx` vérifie la grille,
  le trait, les attributs et qu'aucune étape du carrousel ni du rail n'est sans symbole.

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
- **En-tête** : `PageHeader` (`components/ui/PageHeader.tsx`) — `h1` en `text-title`
  (téléphone) puis `text-hero` dès 640 px, une phrase `text-base text-ink-muted`
  (`max-w-2xl`), badges (`meta`, ex. `SimulationBadge`) **sous** la phrase, actions à
  droite. `size="hero"` ne change que la graisse (écrans Agents IA).
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

## 3. Composants (`components/ui/`)

| Composant | Fichier | États |
|---|---|---|
| `Button` | `Button.tsx` | `primary` / `secondary` / `ghost` × `sm` / `md` / `lg` ; repos, survol, focus visible, actif (`scale .98`), `isLoading` (spinner + `aria-busy`), `disabled` (opacité 40 %) |
| `ButtonLink` | `ButtonLink.tsx` | Mêmes styles, mais reste une ancre `next/link` |
| `Card` | `Card.tsx` | En-tête optionnel (titre, description, actions), ton `default` / `inverse`, `headingLevel` 2 ou 3. Les actions (badge, lien court) restent **sur la ligne du titre** à toutes les largeurs ; la description passe dessous, pleine largeur — elle ne repousse jamais un badge sur une ligne à part |
| `LogoSymbol` | `LogoSymbol.tsx` | Symbole seul, `sm` / `md` / `lg` ; nommé par défaut, silencieux avec `label={null}` ; inversion par `currentColor` (§ 2.7) |
| `Logo` | `Logo.tsx` | Verrouillage complet (symbole + nom sur deux lignes), `sm` / `md` ; un seul nom accessible (§ 2.7.2) |
| `Reveal` | `Reveal.tsx` | Contenu visible par défaut ; entrée dans la fenêtre avec `rise-soft` ; mouvement réduit et absence d'`IntersectionObserver` pris en charge |
| `Badge` | `Badge.tsx` | `neutral`, `outline`, `solid`, `dashed` (information absente) |
| `PipelineStageBadge` | `PipelineStageBadge.tsx` | 7 étapes ; barre de 6 points pour la progression, `perdu` en pointillés, `mandat_signé` en plein noir |
| `SimulationBadge` | `SimulationBadge.tsx` | Unique, toujours visible, toujours accompagné du mot « Simulation » |
| `Alert` | `Alert.tsx` | `error` (fond noir, `role="alert"`), `success` / `info` (`role="status"`) |
| `EmptyState` | `EmptyState.tsx` | Titre, description, action suggérée |
| `Skeleton` | `Skeleton.tsx` | Chargement, `aria-hidden`, scintillement désactivé si mouvement réduit |
| `Field` | `Field.tsx` | Libellé réel, aide, erreur (`aria-invalid` + `aria-describedby`), désactivé |
| `DataList` | `DataList.tsx` | `dl` 1 ou 2 colonnes |
| `PageHeader` | `PageHeader.tsx` | Fil d'Ariane, `h1`, description, badges, actions |
| `Select` | `Select.tsx` | `<select>` natif, `<label for>` réel, `id` obligatoire (utilisable en Server Component), survol, désactivé |
| `Checkbox` | `Checkbox.tsx` (client) | Case de confirmation explicite : toute la zone bordée est le `<label>`, contrôlée, **jamais précochée** ; cochée = cadre noir + fond atténué (jamais la couleur seule), désactivée |
| `Dialog` | `Dialog.tsx` (client) | Fenêtre modale sur `<dialog>` natif + `showModal()` : titre (`aria-labelledby`), résumé (`aria-describedby`), `aria-modal`, focus piégé par le navigateur, Échap et clic sur le fond pour annuler (`dismissible={false}` pendant une requête), retour du focus (`returnFocusRef`), pied d'actions empilé en mobile |
| `Textarea` | `Textarea.tsx` | Champ multiligne : libellé réel, aide, erreur (`aria-invalid` + `aria-describedby`), `maxLength` |
| `Pagination` | `Pagination.tsx` | `nav[aria-label="Pagination"]` : « 26–50 sur 131 » (total exact) + Précédent / Suivant en liens d'URL. Direction inexistante : bouton atténué (`opacity-40`), `aria-hidden`, pour que les boutons ne sautent pas d'une page à l'autre ; une seule page : le décompte seul, aucun bouton |
| `LinkTabs` | `LinkTabs.tsx` | Filtre segmenté en **liens** (pas de `tablist` : chaque choix charge une autre liste et vit dans l'URL). Piste `bg-surface-muted` arrondie, choix courant en pilule `bg-inverse` + graisse `semibold` + `aria-current="page"` (jamais la couleur seule) ; défile horizontalement si l'écran est étroit |
| `ListTotal` | `ListTotal.tsx` | Total exact d'une liste paginée, **toujours** suivi de son périmètre — même motif « chiffre + périmètre » que le tableau de bord (§ 3.5), pour qu'un chiffre lu sur le tableau de bord se reconnaisse sur l'écran où il mène |

`Button` accepte `ref` (prop simple en React 19), pour les cas où le focus doit
être déplacé — par exemple sur le bouton de confirmation du coupe-circuit.

Règle : **réutiliser avant de créer**. Un nouveau composant n'est ajouté que s'il est
utilisé par au moins deux écrans, ou s'il porte une règle produit (badge simulation).

### 3.1 Composants du module « Agents IA » (`features/agents-ia/components/`)

| Composant | Fichier | Rôle |
|---|---|---|
| `AgentRunReplay` | `AgentRunReplay.tsx` (client) | Rejeu animé d'une exécution : barre d'outils (facteur de ralenti, durée mesurée, « Tout afficher » / « Rejouer »), flux visuel pointillé, liste détaillée et zone `aria-live` |
| `AgentRunProcessTrack` | `AgentRunProcessTrack.tsx` | Vue compacte du journal : icônes Radix, nano-sphères en attente, signal et progression pilotés par les mêmes durées mesurées que le rejeu |
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
| `PendingMessagesList` | `PendingMessagesList.tsx` (client) | File « à valider » : confirmation persistante (`aria-live`) + rafraîchissement serveur |
| `PendingMessageCard` | `PendingMessageCard.tsx` (client) | Un brouillon : contact, canal, consentement, texte brut, valider / refuser / envoyer (simulation) |
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
- Apostrophe typographique `'` dans les textes.

## 7. Grille et points de rupture

- Conteneur applicatif : classe `page-frame` (§ 2.10) — `max-w-7xl`, gouttières `px-6`
  (mobile) / `px-10` (≥ 1024 px) ; `page-frame-reading` (`max-w-4xl`) et
  `page-frame-medium` (`max-w-5xl`) plafonnent sans recentrer.
- Fiche contact : `lg:grid-cols-[minmax(0,1fr)_22rem]`, colonne de droite collante.
- Écran Agents IA : bandeau `lg:grid-cols-2` (coupe-circuit + activité), grille des
  cinq agents `lg:grid-cols-2 2xl:grid-cols-3`, journal pleine largeur.
- Rejeu d'une exécution : colonne unique `max-w-4xl` (la lecture prime).
- Files de travail (« Leads entrants », « Messages à valider ») : colonne unique
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
  unique `max-w-2xl`, gouttières `px-6`, respiration `py-16` (`sm:py-20`). Le
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
- Pas de police de marque (choix assumé, voir 2.2). Le verrouillage compose donc « Ascend »
  et « Strategy » dans la pile système, pas dans un caractère dessiné pour la marque.
- Le symbole est **matriciel**, pas vectoriel : le fichier fourni était un PNG sans canal
  alpha et aucun outil de traçage n'est installé. Le redessiner à la main aurait approximé
  la jambe incurvée et la contre-forme. Conséquence acceptée : au-delà d'environ 300 px de
  large, le tracé s'adoucit. Aucun usage actuel n'y arrive (§ 2.7.5).
- Le masque CSS n'a pas de repli visuel : sur un navigateur sans `mask-image`, le symbole
  n'est pas peint. Le nom écrit à côté dans `Logo` et le nom accessible restent, donc rien
  n'est perdu — mais un symbole seul y serait invisible.
- **Niveaux de titre des files de travail** : « Leads entrants » et « Messages à
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
- **Fond de particules** (§ 2.5.8) : sur mobile, la forme est volontairement discrète et
  presque entièrement couverte par les cartes ; sur bureau, elle vit surtout dans la bande
  d'en-tête et disparaît derrière les cartes au défilement. Le voile `.particle-veil` doit
  être posé à la main sur tout nouveau bloc de texte hors carte (pas de détection
  automatique). Les mesures de coût par image (`data-frame-ms`) sont celles de Chromium sans
  interface sur la machine de développement : elles ne comptent que le travail JavaScript de
  l'image, pas la composition du masque par le GPU.
