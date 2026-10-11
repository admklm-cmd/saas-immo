# Plan — Animations et micro-interactions

- **Date** : 2026-09-18
- **Auteur du plan** : agent `frontend-ux`
- **Statut** : phases 0 et 1 faites. Les phases 2 et 3 restent à réaliser écran par écran.

## Objectif

Donner à toute l'interface un mouvement cohérent et sobre, qui rend les changements d'état lisibles — sans ajouter une seule dépendance.

### Pourquoi (produit, pas décoration)

1. **Finition perçue.** L'agence achète aussi une impression de sérieux. Un écran qui apparaît proprement vaut mieux qu'un écran qui « saute ».
2. **Lisibilité des changements d'état.** Un brouillon validé, une alerte qui arrive, un squelette remplacé par du contenu : le mouvement dit *ce qui vient de changer* et *où regarder*.
3. **Rien d'autre.** Une animation qui ne sert ni la finition ni la compréhension n'est pas ajoutée. Le mouvement ne porte jamais une information à lui seul (règle noir et blanc du design system, § 1).

## Décisions déjà prises

- **Aucune nouvelle dépendance d'animation.** Pas de `framer-motion`, pas de `gsap`. CSS + Tailwind v4 + `@keyframes` uniquement.
  Raison : ces librairies sont des composants client, donc elles pousseraient vers le navigateur des écrans aujourd'hui rendus côté serveur ; elles alourdissent le bundle pour un besoin couvert par trois `@keyframes` ; et le délai de 2 à 3 jours ne laisse pas de place à une nouvelle surface de bug.
  Si une exception semble indispensable, **elle n'est pas prise** : elle est écrite en « Questions ouvertes » et tranchée par l'utilisateur.
- **La galerie `/dev/animations` est strictement réservée au développement.** Elle ne doit jamais être atteignable dans une version déployée (confirmé par l'utilisateur). Voir la spécification plus bas.
- **L'implémentation ne commence qu'après le push et l'audit sécurité de l'étape A** (file des leads entrants, édition de brouillon, validation). Tant que l'étape A n'est pas poussée, personne n'écrit de code sur `app/(app)/agents-ia/`, `features/agents-ia/`, `components/texts.ts`, `lib/agents/`, `e2e/`.
- **Le rejeu d'exécution ne change pas.** Ses règles sont déjà non négociables (design system § 3.1, règles 1 et 2). Aucune phase de ce plan ne les modifie.

## Phases

### Phase 0 — Documentation (`frontend-ux`) — FAITE

- **Périmètre** : ce plan, et la spécification du mouvement dans le design system.
- **Fichiers** : `docs/plans/2026-09-18-animations.md`, `docs/design-system.md` (§ 2.5 réécrite, § 8 mise à jour).
- **Aucun code.**
- **Critère de fin** : `git status --short` ne montre que ces deux fichiers en plus des fichiers déjà modifiés par l'étape A. Chaque token cité dans la documentation existe réellement dans `app/globals.css`.

### Phase 1 — Socle technique (`frontend-ux`), après l'étape A — FAITE

- **Périmètre** : tokens complémentaires, primitives réutilisables, galerie de développement. **Aucun écran produit n'est modifié dans cette phase.**
- **Fichiers visés** :
  - `app/globals.css` : ajouts éventuels dans `@theme` (liste soumise à validation ci-dessous).
  - `components/ui/Reveal.tsx` (nouveau, client).
  - `app/dev/animations/page.tsx` (nouveau) et son fichier de garde.
  - `docs/design-system.md` : mise à jour avec les nouveaux tokens et la nouvelle primitive.
- **Tokens livrés** :

  | Ajout proposé | Raison |
  |---|---|
  | `@keyframes rise-soft` + `--animate-rise-soft` (opacité 0→1, `translate3d(0, 4px, 0)`, `--duration-base`) | `animate-rise` translate de 8 px sur 300 ms : trop ample pour une ligne de liste ou une carte dans une grille. Une variante courte évite l'effet de vague. |
  | `--stagger-step: 40ms` + utilitaire `.stagger` | Échelonner une liste sans JavaScript, avec un pas unique et documenté, au lieu d'un `animationDelay` recopié dans chaque écran. |
  | `@keyframes settle` + `--animate-settle` (opacité 0→1, `scale(0.98)` → `scale(1)`, `--duration-base`) | Marquer le changement d'état d'une carte (brouillon validé ou refusé) sans décaler la mise en page. |

  Si l'utilisateur refuse un ajout, la phase 2 se fait avec les tokens existants : c'est possible, simplement moins fin.
- **Primitives proposées** :
  - `Reveal` (`components/ui/Reveal.tsx`, client) : révèle ses enfants quand ils entrent dans la fenêtre (`IntersectionObserver`). Contraintes obligatoires : les enfants sont toujours présents dans le HTML rendu (aucun rendu conditionnel, le contenu reste lisible sans JavaScript) ; si `prefers-reduced-motion` est actif, ou si `IntersectionObserver` est indisponible, le contenu est visible immédiatement ; le composant ne reçoit que des `children`, donc les enfants restent des Server Components.
  - `.stagger` : classe CSS posée sur un conteneur de liste, qui décale l'animation de ses enfants directs d'un pas `--stagger-step`, plafonné (au-delà d'un petit nombre d'éléments, le délai n'augmente plus). Aucun JavaScript.
- **Critère de fin** : `npx tsc --noEmit`, `npm run lint` et `npx vitest run` au vert ; la galerie s'affiche en développement ; un test prouve qu'elle est introuvable en production ; `git diff` ne touche aucun écran produit.

### Phase 2 — Application aux écrans (`frontend-ux`), écran par écran

Un écran à la fois, chacun avec ses tests relancés avant de passer au suivant. Uniquement des écrans **stabilisés**.

Ordre recommandé, du plus fort au plus faible retour sur effort :

1. **Accueil public** — `app/(marketing)/page.tsx`. C'est la première impression du propriétaire. Entrée du bloc titre (déjà en `animate-rise`), révélation des sections suivantes lorsqu'elles existeront.
2. **Connexion** — `app/(auth)/connexion/page.tsx`. Premier écran vu par l'agent chaque matin. Entrée du panneau, retour de pression sur le bouton, apparition de l'erreur.
3. **Liste des contacts** — `app/(app)/contacts/page.tsx`. L'écran le plus fréquenté. Échelonnement des lignes, survol de ligne, passage squelette → contenu avec `app/(app)/contacts/loading.tsx`.
4. **Fiche contact** — `app/(app)/contacts/[id]/page.tsx`. Entrée des deux colonnes, apparition de l'historique.
5. **Agents IA** — `app/(app)/agents-ia/page.tsx`. Entrée des cartes d'agent, apparition du panneau de confirmation du coupe-circuit.

**Hors périmètre de la phase 2, explicitement** :

- `app/(app)/agents-ia/a-valider/`, `app/(app)/agents-ia/leads-entrants/` et leurs composants : livrés par l'étape A, pas encore audités. À rouvrir seulement dans une itération ultérieure, après audit.
- `app/(app)/agents-ia/executions/[runId]/` et le rejeu (`AgentRunReplay`, `AgentRunStepRow`) : règles figées au § 3.1 du design system.
- `app/(app)/dashboard/`, `app/(app)/pipeline/`, `app/(app)/parametres/`, `app/(marketing)/estimation/`, `app/(auth)/inscription/` : ce sont encore des coquilles `ComingSoon`. Animer une coquille ne sert à rien, et le vrai écran serait à refaire.

- **Critère de fin, par écran** : `npx tsc --noEmit`, `npm run lint` et le test Playwright du parcours concerné au vert ; aucune classe de mouvement ajoutée hors de l'inventaire du design system § 2.5 ; aucune durée ni courbe en dur.

### Phase 3 — Vérification

1. **`frontend-ux`** :
   - Accessibilité : focus visible conservé partout, ordre de tabulation inchangé, aucun contenu masqué en attendant une animation.
   - `prefers-reduced-motion` : parcourir les écrans animés avec le réglage actif et vérifier que tout est immédiatement visible et utilisable.
   - E2E : proposer l'ajout de `reducedMotion: "reduce"` dans le bloc `use` de `playwright.config.ts` (aujourd'hui absent), pour que les tests ne dépendent d'aucun délai d'animation.
   - Test dédié de la galerie : présente en développement, introuvable en production, aucun lien depuis la navigation.
2. **`cybersecurite`** : la route de développement ne doit fuir ni en production, ni dans un futur `sitemap.ts` ou `robots.ts`, ni via un lien de navigation. Elle ne lit aucune donnée, n'ouvre aucune session, n'appelle aucun agent IA.
- **Critère de fin** : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npx playwright test` au vert, avec les sorties réelles rapportées ; avis de `cybersecurite` rendu.

## Spécification de la galerie `/dev/animations`

Écrite comme une exigence. Aucun code ici : il sera écrit en phase 1.

- **But** : une page unique qui montre côte à côte chaque mouvement autorisé du design system, pour comparer durées et amplitudes sans ouvrir cinq écrans produit.
- **Emplacement proposé** : `app/dev/animations/page.tsx`. Elle vit hors des groupes `(app)`, `(marketing)` et `(auth)` : elle n'hérite donc d'aucun layout applicatif, d'aucune navigation et d'aucune vérification de session.
- **Garde côté serveur** : la page est un Server Component qui appelle `notFound()` si `process.env.NODE_ENV === "production"`. Le mécanisme exact est confirmé en phase 1 : la valeur doit être lue au rendu, et le comportement vérifié sur un vrai build de production, pas seulement en théorie.
- **Aucun lien** : aucune entrée dans `components/app/AppNav.tsx`, aucun lien en pied de page, aucune mention dans un futur `sitemap.ts`. On y accède en tapant l'adresse, en développement uniquement.
- **Aucune donnée** : la page n'appelle ni Supabase, ni une `query`, ni une `action`, ni un agent IA. Tous les exemples utilisent du texte factice écrit dans le fichier (« Titre d'exemple », « Ligne 1 »…), jamais un nom, un téléphone ou un message de l'agence fictive.
- **Contenu attendu** : un bloc par catégorie de l'inventaire § 2.5 du design system, chacun avec le nom du token utilisé, sa durée, et un bouton « Rejouer ». Un rappel écrit de l'état de `prefers-reduced-motion` détecté.
- **Contrainte technique** : aucune balise `<script>` en ligne. La politique de sécurité du contenu du projet est stricte (`lib/security/headers.ts`) et cette page ne doit pas devenir la raison de l'assouplir.
- **Tests attendus** :
  - Un test qui ouvre `/dev/animations` en développement et vérifie que le titre s'affiche.
  - Un test qui vérifie qu'aucun lien de la navigation produit ne pointe vers `/dev`.
  - Une vérification que la page renvoie une page introuvable quand `NODE_ENV` vaut `production`. Forme exacte à décider en phase 1 : test unitaire sur la fonction de garde, ou test E2E sur un build de production.

## Ce qui est explicitement coupé

| Coupé | Pourquoi |
|---|---|
| Transitions de page complètes entre routes | Demande un composant client englobant tout le layout, ou des transitions de vue encore mouvantes. Risque de flash, de perte du focus et de régression des tests E2E, pour un gain faible sur un outil de travail. |
| Animation d'élément partagé entre deux routes (la ligne contact qui devient la fiche) | Coût de mise en œuvre très supérieur au reste du plan, et fragile au moindre changement de mise en page. |
| Parallaxe et effets au défilement sur le site public | Contraire à la sobriété demandée, coûteux en CPU, et pénible avec un mouvement réduit. |
| Animation de réordonnancement d'une liste (déplacement fluide d'une ligne) | Impossible proprement sans librairie dédiée, donc contraire à la décision « aucune dépendance ». |
| Pipeline animé en colonnes (glisser-déposer) | L'écran pipeline est encore une coquille : hors périmètre. |
| Chiffres qui défilent jusqu'à leur valeur | Donne l'illusion d'un calcul en cours. Contraire à la règle « un chiffre sans sa fenêtre n'existe pas » et à l'esprit du § 3.1. |

## Risques

| Risque | Comment on l'évite |
|---|---|
| Une animation retarde ou masque une action | Rien n'est rendu conditionnellement à la fin d'une animation. Un bouton est cliquable dès qu'il est affiché. Une alerte d'erreur apparaît en opacité, jamais après un délai. |
| Une animation laisse croire à une progression réelle | Aucune barre de progression décorative, aucun compteur animé. Un indicateur d'activité (spinner, pulsation) dit « ça travaille », jamais « c'est à 60 % ». Règle déjà posée pour le rejeu au § 3.1. |
| Décalage de mise en page (CLS) | On n'anime que `opacity` et `transform`. Jamais `height`, `width`, `margin`, `top`. Translation limitée à 8 px. |
| Coût CPU sur une liste longue | Échelonnement plafonné, translations courtes, `translate3d`, aucune animation infinie sur un élément de liste. À vérifier sur la liste de contacts complète de l'agence fictive. |
| Régression des tests E2E existants à cause des délais | Les tests ne doivent dépendre d'aucune animation. Proposition de phase 3 : `reducedMotion: "reduce"` dans `playwright.config.ts`. Relancer `e2e/agents-ia.spec.ts`, `e2e/parcours-hugo-louis.spec.ts` et `e2e/smoke.spec.ts` après chaque écran animé. |
| Conflit avec l'étape A en cours | Aucune écriture sur les fichiers de l'étape A avant son push et son audit. La phase 2 les place explicitement hors périmètre. |

## Décisions confirmées par l'implémentation

1. Les trois ajouts (`rise-soft`, `.stagger` + `--stagger-step`, `settle`) sont livrés.
2. La galerie `/dev/animations` est livrée avec une garde de production testée.
3. Aucune dépendance d'animation n'a été ajoutée.
