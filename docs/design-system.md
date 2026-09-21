# Système de design — AiaA

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
| `shadow-overlay` | Modales et panneaux superposés (à venir) |

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

## 3. Composants (`components/ui/`)

| Composant | Fichier | États |
|---|---|---|
| `Button` | `Button.tsx` | `primary` / `secondary` / `ghost` × `sm` / `md` / `lg` ; repos, survol, focus visible, actif (`scale .98`), `isLoading` (spinner + `aria-busy`), `disabled` (opacité 40 %) |
| `ButtonLink` | `ButtonLink.tsx` | Mêmes styles, mais reste une ancre `next/link` |
| `Card` | `Card.tsx` | En-tête optionnel (titre, description, actions), ton `default` / `inverse`, `headingLevel` 2 ou 3 |
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
| `Textarea` | `Textarea.tsx` | Champ multiligne : libellé réel, aide, erreur (`aria-invalid` + `aria-describedby`), `maxLength` |
| `ComingSoon` | `ComingSoon.tsx` | Écran « À venir » soigné |

`Button` accepte `ref` (prop simple en React 19), pour les cas où le focus doit
être déplacé — par exemple sur le bouton de confirmation du coupe-circuit.

Règle : **réutiliser avant de créer**. Un nouveau composant n'est ajouté que s'il est
utilisé par au moins deux écrans, ou s'il porte une règle produit (badge simulation).

### 3.1 Composants du module « Agents IA » (`features/agents-ia/components/`)

| Composant | Fichier | Rôle |
|---|---|---|
| `AgentRunReplay` | `AgentRunReplay.tsx` (client) | Rejeu animé d'une exécution : barre d'outils (facteur de ralenti, durée mesurée, « Tout afficher » / « Rejouer »), frise des étapes, zone `aria-live` |
| `AgentRunStepRow` | `AgentRunStepRow.tsx` | Une étape : phase, auteur (`Code` / `Fournisseur IA`), statut, durée mesurée, détail technique replié |
| `AgentRunHead` | `AgentRunHead.tsx` | Carte d'identité d'une exécution (dates, contact ou « Lead entrant », fournisseur, jetons, décision) |
| `AgentOverviewCard` | `AgentOverviewCard.tsx` | Un agent : prénom, mission, statut, compteurs par fenêtre, dernière exécution, dernières erreurs |
| `ActivityFigure` | `ActivityFigure.tsx` | Un compteur **toujours accompagné de sa fenêtre**, « Indisponible » si la lecture a échoué |
| `AgencyActivityCard` | `AgencyActivityCard.tsx` | Chiffres de l'agence : exécutions décomptées, limite, tentatives, brouillons à valider |
| `KillSwitchPanel` | `KillSwitchPanel.tsx` (client) | Coupe-circuit : état, confirmation en deux temps, refus expliqué |
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

### 3.2 Le badge « simulation » est une règle produit

Toute action simulée (message, rendez-vous, exécution d'agent IA) affiche
`SimulationBadge`. C'est un garde-fou de `CLAUDE.md` : on ne doit **jamais** confondre
une action simulée avec un envoi réel. Le badge porte son propre texte : il ne se
réduit ni à une couleur ni à une icône.

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
- Navigation : barre horizontale défilante sous 1024 px, colonne fixe de 256 px au-dessus.
- Points de rupture Tailwind par défaut (`sm` 640, `md` 768, `lg` 1024, `xl` 1280).

## 8. Limites connues (à traiter plus tard)

- Pas de thème sombre : les tokens sont prêts (surfaces inverses), le basculement ne l'est pas.
- Pas encore de modale ni de toast. Les actions sensibles déjà livrées se traitent
  **en place** : panneau de refus ou de correction dans la carte, et panneau de
  confirmation du coupe-circuit avec focus déplacé sur « Confirmer ».
- L'écran de Sarah réutilise les cartes, alertes, badges de pipeline et le rejeu existants.
  Le statut du rendez-vous conduit la carte : confirmation humaine de la proposition,
  saisie obligatoire du compte-rendu sur un rendez-vous confirmé, puis apparition de Sarah
  une fois le rendez-vous réalisé. Le compte-rendu reste un bloc de texte brut sur surface
  atténuée. Emma reste sans bloc d'interface dédié à ce stade.
- Le rejeu ne propose ni pause ni retour arrière étape par étape : « Tout afficher »
  et « Rejouer » suffisent pour le prototype.
- Pas de police de marque (choix assumé, voir 2.2).
- **Niveaux de titre des files de travail** : « Leads entrants » et « Messages à
  valider » enchaînent `h1` → `h3` (les cartes), sans `h2` intermédiaire, alors
  que le § 5 demande `h2` pour une carte. Le contournement n'est pas fait :
  corriger un seul des deux écrans les rendrait incohérents entre eux. À
  reprendre d'un coup, avec les deux fichiers dans le même lot.
- **Mouvement : la spécification (§ 2.5) est écrite, l'outillage ne l'est pas.**
  Les phases 1 à 3 du plan `docs/plans/2026-09-18-animations.md` ne sont pas faites :
  - il n'existe ni variante d'entrée courte, ni échelonnement de liste, ni mise en
    avant du changement d'état d'une carte — les trois ajouts sont proposés et
    attendent une validation ;
  - il n'existe pas de primitive d'apparition à l'entrée dans la fenêtre
    (`Reveal`) ;
  - la galerie de développement `/dev/animations` n'existe pas ;
  - aucun écran n'a encore été repris écran par écran : le mouvement actuel se
    limite à `animate-rise`, `animate-fade`, `animate-shimmer`, `animate-spin-slow`
    et aux transitions de survol et de focus déjà présentes.
- `--ease-exit` est défini mais n'est utilisé par aucun composant : aucune sortie
  n'est animée pour l'instant.
