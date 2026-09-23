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

- Thème unique clair, strictement monochrome, sans image ni ressource distante.
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
| `--color-ink` | `#0a0a0b` | `text-ink` | Texte principal — **19,6:1** sur blanc |
| `--color-ink-muted` | `#5a5a60` | `text-ink-muted` | Texte secondaire — **6,9:1** |
| `--color-ink-subtle` | `#6f6f77` | `text-ink-subtle` | Légendes, sur-titres — **4,8:1** |
| `--color-ink-inverse` | `#fafafa` | `text-ink-inverse` | Texte sur fond noir |
| `--color-ink-inverse-muted` | `#a8a8b0` | `text-ink-inverse-muted` | Texte secondaire sur noir — **7,4:1** |
| `--color-line` | `#e7e7ea` | `border-line` | Séparateurs |
| `--color-line-strong` | `#d2d2d8` | `border-line-strong` | Bordures de champs et de puces |
| `--color-focus` | `#0a0a0b` | — | Anneau de focus |

Toutes les paires texte/fond utilisées dépassent 4,5:1 (WCAG AA texte normal).

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
| `shadow-overlay` | Éléments superposés : `Dialog`, panneau « Changer d'étape » du pipeline, pastille de confirmation du pipeline |

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
| `animate-spin-slow` | Rotation | 700 ms, en boucle | Spinner du `Button` en cours de chargement |
| `animate-pulse` (Tailwind) | Opacité, en boucle | Tailwind | Étape de rejeu **en cours** : indicateur d'activité, jamais une mesure d'avancement |

La phase 1 ajoute `animate-rise-soft` (4 px, 220 ms), `animate-settle`
(`scale(.98)` vers l'état final, 220 ms) et `.stagger` (pas de 40 ms, plafonné à
200 ms). `Reveal` utilise `IntersectionObserver` pour appliquer `rise-soft` sans
jamais retirer les enfants du HTML ; sans JavaScript, sans API disponible ou avec
un mouvement réduit, le contenu reste immédiatement visible.

#### 2.5.3 Inventaire des mouvements autorisés

Rien en dehors de cette liste. Pour chaque catégorie : ce qu'on anime, l'amplitude
maximale, la durée, un écran concerné.

| Catégorie | On anime | Amplitude max | Durée | Exemple |
|---|---|---|---|---|
| Entrée de page ou de section | Opacité + translation verticale | 8 px | `--duration-slow` | En-tête de la liste des contacts (`PageHeader`) |
| Apparition d'une alerte ou d'une confirmation | Opacité seule | aucune translation | `--duration-base` | `Alert` d'erreur après une action ; panneau de confirmation du coupe-circuit |
| Échelonnement d'une liste | Décalage du départ de l'entrée de chaque élément | pas de 40 ms, plafonné | `--duration-base` par élément | Lignes de la liste des contacts *(nécessite l'ajout de phase 1)* |
| Survol ou pression d'un élément interactif | Fond, texte, bordure, ombre, `transform: scale` | `scale(0.98)` à la pression | `--duration-fast` | `Button` (`active:scale-[0.98]`), lignes de `ContactsTable` et `AgentRunsTable`, liens de `AppNav` |
| Champ de formulaire | Couleur de bordure (et ombre pour `Field`) | aucune | `--duration-fast` | `Field`, `Select`, `Textarea`. **L'anneau de focus global (`:focus-visible`), lui, n'est jamais animé** : il apparaît instantanément |
| Passage squelette → contenu | Scintillement du squelette, puis entrée du contenu | 8 px | 1,4 s en boucle, puis `--duration-slow` | `app/(app)/contacts/loading.tsx` puis la liste réelle |
| Ouverture d'une fenêtre de confirmation (`Dialog`) | Opacité + `scale(.98)` → `scale(1)` (`animate-settle`), fond flouté fixe | `scale(0.98)` | `--duration-base` | Confirmation du mandat signé (pipeline) |
| Ouverture d'un panneau ancré ou d'une pastille de confirmation | Opacité + translation de 4 px (`animate-rise-soft`) | 4 px | `--duration-base` | Panneau « Changer d'étape », pastille « dossier déplacé » du pipeline |
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
4. **Jamais d'animation infinie hors indicateur de chargement.** Seuls
   `animate-shimmer` (squelette), `animate-spin-slow` (bouton en cours) et
   `animate-pulse` (étape en cours) tournent en boucle. Rien d'autre.
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

### 2.6 Utilitaires maison

- `.panel-blur` / `.panel-blur-inverse` : fond translucide + `backdrop-filter`, réservés
  aux barres fixes (navigation de l'espace connecté, en-tête du site public).
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
| `AgentOverviewCard` | `AgentOverviewCard.tsx` | Un agent : prénom, mission, statut, compteurs par fenêtre, dernière exécution, dernières erreurs |
| `ActivityFigure` | `ActivityFigure.tsx` | Un compteur **toujours accompagné de sa fenêtre**, « Indisponible » si la lecture a échoué |
| `AgencyActivityCard` | `AgencyActivityCard.tsx` | Chiffres de l'agence : exécutions décomptées, limite, tentatives, brouillons à valider |
| `KillSwitchPanel` | `KillSwitchPanel.tsx` (client) | Coupe-circuit : état, confirmation en deux temps, refus expliqué ; `headingLevel` 2 (défaut, `/agents-ia`) ou 3 (sous la section « Agents IA » de `/parametres`) — un seul composant, deux écrans, mêmes règles |
| `AgentRunsHistory` / `AgentRunsFilters` / `AgentRunsTable` | — | Journal filtrable et paginé (formulaire GET, sans JavaScript) |
| `PendingMessagesList` | `PendingMessagesList.tsx` (client) | File « à valider » : confirmation persistante (`aria-live`) + rafraîchissement serveur |
| `PendingMessageCard` | `PendingMessageCard.tsx` (client) | Un brouillon : contact, canal, consentement, texte brut, valider / refuser / envoyer (simulation) |
| `MessageRejectionForm` | `MessageRejectionForm.tsx` (client) | Motif obligatoire (liste fermée, `fieldset`/`legend`) + note facultative bornée |
| `DraftEditForm` | `DraftEditForm.tsx` (client) | Correction en place de l'objet et du corps ; le canal et le destinataire restent hors du formulaire, puis le brouillon repasse « à valider » |
| `InboundLeadCard` | `InboundLeadCard.tsx` (client) | Un lead entrant : source, date, éléments transmis, message du prospect en **texte brut**, « Lancer Léa », résultat et rejeu de l'exécution |

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

### 3.2 Composants du module « Pipeline » (`features/pipeline/components/`)

| Composant | Fichier | Rôle |
|---|---|---|
| `PipelineBoard` | `PipelineBoard.tsx` | Répartit les contacts par étape (`groupContactsByStage`) et pose la grille des six étapes actives, puis `perdu` à part |
| `PipelineColumn` | `PipelineColumn.tsx` | Une étape : `section`/`h2` (landmark correctement annoncé), compteur réel, état vide, `emphasis="muted"` pour `perdu` |
| `PipelineContactCard` | `PipelineContactCard.tsx` | Une carte compacte en deux cibles jamais imbriquées : le bloc haut est un lien vers `/contacts/[id]` (nom, bien via `propertySummary`, badges de reprise humaine et de tâches ouvertes), le pied porte « Changer d'étape » |
| `PipelineStageMenu` | `PipelineStageMenu.tsx` (client) | Bouton de divulgation (`aria-expanded`, nom accessible « Changer d'étape pour {nom} ») + panneau ancré opaque : sept étapes, actuelle cochée (`aria-current`) et non sélectionnable, flèches / Début / Fin, Échap rend le focus. Déplacement direct avec spinner sur l'option ; erreur serveur affichée telle quelle dans le panneau, sélection conservée |
| `MandateEnterDialog` | `MandateEnterDialog.tsx` (client) | Entrée en « Mandat signé » : rappel « décision humaine, jamais un agent IA », `Checkbox` obligatoire, bouton désactivé tant qu'elle n'est pas cochée (raison écrite sous la case) |
| `MandateExitDialog` | `MandateExitDialog.tsx` (client) | Sortie de « Mandat signé » (directeur) : `Checkbox` + `Textarea` « Motif (obligatoire) » 3–500 caractères avec compteur, bouton désactivé tant que les deux ne sont pas remplis |
| `PipelineStageChangeProvider` | `PipelineStageChangeProvider.tsx` (client) | Zone `role="status"` toujours présente au niveau du tableau (la carte déplacée change de colonne, elle ne peut pas porter sa propre confirmation) : pastille noire translucide en bas d'écran, 6 s ; rend le focus au bouton de la carte dans sa nouvelle colonne |

**Changer d'étape, au clavier, sans glisser-déposer.** Seul `PipelineStageMenu`
(et ses fenêtres) est un composant client ; colonnes et cartes restent des Server
Components, et seuls l'identifiant, le nom et l'étape du contact atteignent le
navigateur. Règles :

1. Un déplacement ordinaire part au clic ; entrer dans ou sortir de « Mandat signé »
   passe **toujours** par un `Dialog` avec une case non précochée.
2. Une option indisponible (sortie de mandat pour un conseiller) reste focalisable
   (`aria-disabled`, pas `disabled`) et porte sa raison via `aria-describedby` :
   l'explication est lue, l'action ne part pas. Le serveur refuse de toute façon.
3. Le panneau est **opaque** (`bg-surface`) : un flou laissait transparaître les
   cartes du dessous et nuisait à la lecture. Le flou est réservé aux barres fixes et
   à la pastille de confirmation.
4. Les guillemets « … » de ces textes utilisent des espaces insécables pour ne jamais couper un
   libellé d'étape en fin de ligne.

**`perdu` n'a pas le même poids visuel que les étapes actives.** Elle est
affichée à part, sur une largeur contrainte (`max-w-sm`), en bordure
pointillée et texte atténué — jamais seulement par la couleur : le libellé
« Perdu » et la bordure pointillée le disent tous les deux, comme pour
`PipelineStageBadge`.

**Compteurs réels uniquement.** Chaque colonne affiche le nombre de dossiers
réellement lus par `getContacts()`. Aucun taux de conversion, aucune durée
moyenne, aucune évolution : ce que l'écran ne peut pas compter, il ne
l'affiche pas.

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
| `TodoSection` | `TodoSection.tsx` | Bloc « À faire maintenant », premier de l'écran : cinq `ActionListCard` |
| `PipelineSummary` / `PipelineStageTile` | — | Un compte par étape avec `PipelineStageBadge` dans une grille de six tuiles ; `perdu` **intégré sous un filet léger**, sur une rangée pleine largeur et lue sur une ligne (badge, chiffre + périmètre, note « Étape qui n'est plus travaillée activement » à droite dès `sm`) — pointillés, fond atténué, chiffre en `text-ink-subtle` : en retrait, jamais une tuile orpheline |
| `AgentsSummary` / `RunCountsList` | — | Badge « Simulation » sur la ligne du titre (actions de `Card`, comme la fiche contact). État du coupe-circuit (lu à part, visible même si les exécutions sont indisponibles) ; exécutions aujourd'hui et sur 7 jours : total, erreurs, **bloquées par un garde-fou** (dit explicitement « pas une erreur »). Lien vers `/agents-ia`, jamais de bouton dupliqué |
| `UpcomingAppointments` | `UpcomingAppointments.tsx` | `ActionListCard` de premier niveau : total à venir + 5 prochains créneaux (heure de Paris) |

**Motif « chiffre + périmètre ».** Chiffre en `text-title` (`text-heading` en tuile),
unité en `text-sm text-ink-muted` sur la même ligne de base, périmètre en dessous en
`text-xs text-ink-subtle`, précédé d'un « Périmètre : » réservé aux lecteurs d'écran.
Ni tendance, ni flèche, ni pourcentage : l'écran n'affiche que ce que le serveur a compté.

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

- Conteneur applicatif : `max-w-7xl`, gouttières `px-6` (mobile) / `px-10` (≥ 1024 px).
- Fiche contact : `lg:grid-cols-[minmax(0,1fr)_22rem]`, colonne de droite collante.
- Écran Agents IA : bandeau `lg:grid-cols-2` (coupe-circuit + activité), grille des
  cinq agents `lg:grid-cols-2 2xl:grid-cols-3`, journal pleine largeur.
- Rejeu d'une exécution : colonne unique `max-w-4xl` (la lecture prime).
- Files de travail (« Leads entrants », « Messages à valider ») : colonne unique
  `max-w-4xl`, une carte par élément, règle produit en `Alert tone="info"` en tête.
- Tableau de pipeline (`/pipeline`) : `max-w-7xl`, grille des six étapes actives
  `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` (deux rangées de trois à partir de
  1280 px, jamais de défilement horizontal disgracieux), `perdu` en dessous sur
  une colonne unique `max-w-sm`.
- Tableau de bord (`/dashboard`) : `max-w-7xl`. « À faire maintenant » en grille
  `md:grid-cols-2 xl:grid-cols-3`, sans espacement vertical de grille (`gap-x-6 gap-y-0`,
  chaque carte porte `mb-6`) : les cartes sont en `grid-rows-subgrid`, donc en-têtes, filets,
  premiers éléments et pieds sont alignés d'une carte à l'autre d'une même rangée, et un état
  vide tient sur une rangée. Pipeline pleine largeur en `grid-cols-2 sm:grid-cols-3 xl:grid-cols-6`
  (tuiles `p-3`, `p-4` dès `sm`) avec `perdu` en rangée pleine largeur sous un filet, puis agents IA et prochains rendez-vous en
  `lg:grid-cols-2`. Blocs espacés de `gap-12`, entrée des blocs suivants via `Reveal`.
- Pages publiques de saisie (`/estimation`, `/politique-confidentialite`) : colonne
  unique `max-w-2xl`, gouttières `px-6`, respiration `py-16` (`sm:py-20`). Le
  formulaire vit dans une `Card` unique, ses sections espacées de `gap-10`, l'action
  principale séparée par un filet `border-t border-line`. Les champs passent de deux
  colonnes (`sm:grid-cols-2`) à une seule sous 640 px.
- Listes paginées (`/taches`, `/rendez-vous`) : colonne unique `max-w-4xl`, comme les files de travail ; lignes empilées sous 640 px (action sous le texte).
- Navigation : barre horizontale défilante sous 1024 px (l'entrée courante est ramenée dans la bande visible), colonne fixe de 256 px au-dessus.
- Points de rupture Tailwind par défaut (`sm` 640, `md` 768, `lg` 1024, `xl` 1280).

## 8. Limites connues (à traiter plus tard)

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
