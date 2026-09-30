# Audit visuel — lot « Icônes animées » (`feat/animated-icons`, non commité) — 30/09/2026

Auteur : web-designer. Portée : rendu réel des changements non commités de `feat/animated-icons`
(famille `components/icons/`, navigation, écrans connectés, landing agents, `components/ui/*`).
Références : `docs/design-system.md` § 2.1, 2.2, 2.5.5, 2.8 ; `docs/plans/2026-09-27-animated-icons.md`.
La règle de direction artistique du 30/09 n'est **pas** évaluée comme non-conformité de ce lot
(voir « Pour le lot art-direction »).

## Verdict

**CONFORME AVEC CORRECTIONS MINEURES**

La famille d'icônes est cohérente, complète et correctement au repos : aucune icône Radix ni
placeholder, un seul accent par icône sur toutes les pages, aucune animation infinie, tout est
immobile après 5 s, rien ne bouge en mouvement réduit, la navigation clavier déclenche bien
l'histoire des icônes. Aucun point bloquant. Deux corrections mineures touchent le delta : le nom
« AiaA » réintroduit, et des flèches ou coches typographiques restées hors de la famille.
Plusieurs défauts **préexistants** (antérieurs à ce lot) ont été vus au passage et sont listés à part.

## Méthode (réellement exécutée)

- Serveur `npm run dev` local, base Supabase locale, données fictives rechargées par
  `e2e/global-setup.ts` (`npm run db:seed`). Connexion par `signIn(page, "directorA")`.
- Script Playwright temporaire `e2e/zz-audit-captures.spec.ts` (**supprimé après usage**).
- 15 routes : `/`, `/dashboard`, `/contacts`, `/contacts/<id>`, `/pipeline`, `/agents-ia`,
  `/agents-ia/leads-entrants`, `/agents-ia/relances`, `/agents-ia/suivi-rendez-vous`,
  `/agents-ia/a-valider`, `/rendez-vous`, `/taches`, `/parametres`, 404 contact
  (`/contacts/00000000-…`), 404 globale (`/page-inexistante`), `/dev/icons`.
- Chaque route à 1440 × 900 et 390 × 844, en `reducedMotion: "reduce"` **et** `"no-preference"`
  (page entière + pli). En `no-preference`, mesure des animations des `svg[data-icon]` à +1,5 s
  puis à +6,5 s.
- Mesures DOM par page : débordement horizontal, recouvrement texte/texte et texte/icône,
  `svg` hors famille, nombre de calques `accent` par icône, familles et graisses de `h1`/`h2`/`p`/`.figure`,
  éléments peints en `#c63838`, couleurs calculées des badges.
- Clavier : 22 Tab successifs sur `/dashboard` et `/agents-ia` à 1440 et 390 ; menu mobile ouvert au
  clavier (Tab → Entrée → Tab × 8 → Échap).
- Les recouvrements signalés par le script ont tous été **vérifiés sur capture** ; seuls ceux
  visibles sont retenus (voir « Faux positifs écartés »).

## Verdict par point

| # | Point | Verdict | Preuve |
|---|---|---|---|
| 1 | Chevauchements 1440 / 390 | **Conforme pour le delta** ; 2 chevauchements préexistants | `overflowX = 0` sur les 64 mesures. Icônes, badges, voiles : aucun recouvrement visible. Préexistants : P-1, P-3 |
| 2 | Hiérarchie visuelle | Conforme | Les grandes tuiles d'en-tête restent secondaires face au `h1` (Geist 800) et sont masquées sous 640 px (vérifié : aucune tuile d'en-tête sur les captures 390) |
| 3 | Réel / simulation | Conforme | Badge « Simulation » présent sur agents IA, messages à valider, relances, leads, suivi, rendez-vous, fiche contact, historique, tableau de bord, landing. Mesuré : `#fafafa` sur `#0a0a0b`, 12 px / 500 → **18,9:1**. « Exemple fictif — simulation » (landing) : `#5a5a60` sur blanc à 90–94 % → **≈ 6,9:1** |
| 4 | Garde-fou / erreur technique | Conforme | `/agents-ia` : compteurs séparés « Blocages par un garde-fou » / « Erreurs techniques », badge « Erreur technique » noir avec icône `error` ; `/agents-ia/relances` : « Bloqués » groupés par motif écrit (repris par un conseiller, validation en attente, consentement manquant) |
| 5 | Typographie et couleurs | Conforme | `h1` Geist 800 sur les 12 écrans connectés à en-tête ; `h2` Geist 700/600 ; corps Inter 400 ; `.figure` Geist Mono partout où présent. Rouge `#c63838` détecté **uniquement** sur l'icône `alert` de `/dev/icons` (aucun usage produit : seul `DANGER_ICON_NAMES`) |
| 6 | Clavier | Conforme | Ordre : lien d'évitement → logo → navigation → déconnexion → action principale → contenu. Anneau de focus `2px solid #2457ff`, décalage 2–3 px, sur chaque arrêt. Menu mobile : `summary` atteint au 3ᵉ Tab, Entrée l'ouvre, Tab reste dans la feuille (Tableau de bord → … → Messages à valider), Échap ferme et rend le focus au `SUMMARY` |
| 7 | Mouvement réduit | Conforme | `reduce` : **0** animation en cours sur les 16 routes × 2 largeurs, icônes complètes à l'image fixe. `no-preference` : 0 animation infinie ; 0 animation en cours à +6,5 s partout (jusqu'à 29 en cours à +1,5 s sur `/dev/icons`, 5–6 sur `/agents-ia`) → fin < 5 s respectée |
| 8 | Cohérence de la famille | **Conforme avec corrections** | 0 `svg` hors famille dans l'espace connecté ; 0 icône à plusieurs accents ; aucune icône Radix, `Glyph` ou `glyphs` dans `app/`, `components/`, `features/`. Écarts : C-1 (nom « AiaA »), C-2 (flèches/coches typographiques restantes) |

## Non-conformités du lot

### Bloquantes

Aucune.

### À corriger

**C-1 — Le nom « AiaA » est réintroduit** (identité produit)
- Élément : titre visible de `/dev/icons` « Famille d'icônes AiaA » (1440 et 390) ; titre du
  § 2.8 de `docs/design-system.md` ; commentaires de `components/icons/{icons.css,Icon.tsx,icon-types.ts}`,
  `components/app/nav-items.ts`, `features/agents-ia/components/agent-icons.ts`,
  `features/agents-ia/components/icons/AgentAppIcon.module.css` (qui disait avant « Ascend glyph family »).
- Écart : `components/brand.test.ts` interdit explicitement « AiaA » (`FORMER_NAMES`), mais ne
  contrôle que `APP_TEXTS` ; `app/dev/icons/gallery-texts.ts` passe entre les mailles.
- Correction : remplacer par « Ascend » (« Famille d'icônes Ascend ») dans ces fichiers ; la
  correction de `docs/design-system.md` § 2.8 est faite par le web-designer au prochain passage
  sur ce document. Option : étendre le test de marque à `gallery-texts.ts`.
- Gravité : mineure (page de développement, 404 en production), mais règle d'identité explicite.

**C-2 — Flèches et coches typographiques restées hors de la famille**
- Élément et largeur (1440 et 390) :
  - Tableau de bord, « À faire maintenant » : « Ouvrir la file de validation → », « Ouvrir les
    leads entrants → », « Ouvrir le suivi des rendez-vous → » : caractère `→` fin
    (`features/dashboard/components/TodoRow.tsx:124`, **fichier modifié par ce lot**, et
    `ActionListCard.tsx:138`), alors que « Voir le rejeu → » et les boutons utilisent l'icône `arrowRight`.
  - Rendez-vous : « ✓ Confirmé » et « Ouvrir dans le suivi → » (`features/appointments/components/AppointmentRow.tsx:73,90`).
  - Fiche contact : « ← Contacts vendeurs » (`app/(app)/contacts/[id]/page.tsx:61`) — de plus non
    `aria-hidden` : le lecteur d'écran lit la flèche.
  - Pagination (`components/ui/Pagination.tsx:53–70`) et `Alert` succès `✓` (`components/ui/Alert.tsx:16`).
- Écart : deux dessins de flèche coexistent sur le même écran (tableau de bord : bouton d'en-tête
  en icône, liens de la liste en caractère), contraire à « une seule famille » (§ 2.8).
- Correction : `→` / `←` → `ButtonArrowGlyph` (ou `ArrowLink`) avec `arrowRight` / `arrowLeft` ;
  `✓` → `<Icon name="check" />` décoratif (le libellé porte le sens). Le lien retour de la fiche
  devient `ArrowLink direction="back"`.
- Gravité : mineure.

### Cosmétiques

**K-1 — Étapes en attente du rail avec accent cobalt plein.** `/agents-ia`, rail « Dernier dossier
traité », 1440 et 390 : les tuiles `pending` et `untraced` ont un symbole gris (`#66666e`) mais un
accent cobalt `#2457ff` plein (mesuré), identique à l'étape faite. L'anneau cobalt de l'étape active
se distingue encore, mais le cobalt est répété 8 fois sur des étapes qui n'ont pas eu lieu.
Correction proposée : passer `dimmed` aussi pour `pending`/`untraced` dans
`features/agents-ia/components/icons/AgentAppIcon.tsx` (ligne 58). À confirmer avec l'utilisateur
dans le lot art-direction (usage du bleu), donc **ne pas corriger dans ce lot**.

## Constats préexistants (hors delta, observés sur les captures)

Aucun n'est causé par ce lot : les fichiers de mise en page concernés sont inchangés (vérifié par `git diff HEAD`).

- **P-1 — À corriger — `/agents-ia` à 390 : résumé « Historique des exécutions » écrasé.** Titre sur
  3 lignes, description en colonne d'un mot par ligne, « pagination » recouvre « 4 exécutions
  enregistrées » (résumé de 340 × 272 px mesuré). Correction : sous 640 px, le compteur passe sous
  le titre (colonne), la description occupe toute la largeur. Fichier probable :
  `features/agents-ia/components/AgentRunsHistory.tsx` (en-tête du `Disclosure` carte).
- **P-2 — À corriger — `/agents-ia` à 1440 : rail « Dernier dossier traité » coupé à droite.**
  10 colonnes de 6,75 rem min. → `scrollWidth 1088` pour `clientWidth 1054` : « Mandat » est
  tronqué (« Confirmé pa… », « En attent… ») sans signe de défilement. Correction :
  `minmax(6.25rem, 1fr)` ou dégradé de fin + défilement visible ; le conteneur défilant doit être
  focusable (`tabindex="0"`, il porte déjà `aria-label`). Fichier : `OperationalRail.module.css`.
- **P-3 — Connu (lot 2B-1) — Messages à valider à 1440** : la barre Valider / Refuser / Modifier
  recouvre la fin de la lettre (« …appartement de La Ciotat. »). Déjà listé dans les corrections
  restantes du lot 2B-1.
- **P-4 — Cosmétique — 404 globale et 404 contact** : le titre (« Page introuvable »,
  « Contact introuvable. ») est un `<p>` d'`EmptyState` ; aucune page 404 n'a de `h1`. Correction :
  prop `titleAs="h1"` sur `EmptyState` pour les deux `not-found.tsx`.
- **P-5 — Cosmétique — landing, héros à 390** : dans « Parcours d'un prospect fictif », les étapes
  « Validation humaine » et « Mandat » sont tronquées (« Validati… », « Mandat … ») ; leur statut
  (« Validé par un conseiller », « Confirmé par un humain ») reste lisible, le garde-fou n'est donc
  pas masqué. Pastille « 5 AGENTS · CONTRÔLE HUMAIN » rognée sous l'en-tête ; « Demander une
  estimation » de l'en-tête sur 3 lignes. À 1440, la légende « Animations : exemple fictif… »
  passe sur le nœud « Léa » du réseau de la landing.
- **P-6 — Cosmétique — `/agents-ia` à 390** : « Dernier dossier traité » sur 3 lignes, serré par
  « Voir le rejeu → Voir la fiche → ». Les liens passent sous le titre sous 640 px.

## Faux positifs écartés

Recouvrements détectés par script mais **non visibles** sur capture : boîtes de ligne des titres
serrés de la landing (interlignage 1,04) ; lettres animées des liens (`Voir le rejeu`, `Ouvrir la
fiche`) contre leur flèche ; « 4 » contre la flèche du bouton du tableau de bord ; contenu de la
feuille de menu mobile fermée (x ≈ 300–340 px à 390) ; libellés « Étape n sur 6 » en lecteur
d'écran du pipeline.

## Pour le lot art-direction (non évalué ici)

- **Rouge** : l'accent de l'icône `alert` est `--color-danger` `#c63838` (vu sur `/dev/icons`,
  petite et grande variante) → passer à l'orange ; `--color-danger` sert aussi à `ErrorDots`.
- **Violet** : la grande variante peint l'accent en dégradé `#6366F1 → #A78BFA` (tuiles d'en-tête,
  cartes des agents, états vides) ; la règle du 30/09 ne connaît que le cobalt comme accent.
- **Bleu répété** : cobalt sur l'icône de chaque entrée de navigation (13), sur chaque tuile du
  rail y compris en attente (K-1), sur les pastilles du pipeline : à hiérarchiser.
- **Accents de titres** : aucun eyebrow ni repère bleu autour des `h1` (hors landing).
- **Orange** : aucun usage aujourd'hui ; candidats observés : « Erreurs techniques 1 », groupe
  « Bloqués », tâche « Réponse IA invalide : reprise humaine nécessaire », onglet « En retard ».
- **Réseau vivant** : particules visibles surtout en grappes (droite de `/taches`, bas de la 404
  contact), pas encore réparties sur toute la surface.

## Éléments préservés (vérifiés)

Badges « Simulation » ; validation humaine (tuile ronde à double contour, distincte des agents) ;
« Mandat signé — Confirmé par un humain » ; coupe-circuit et son libellé ; distinction garde-fou /
erreur technique ; mentions de consentement ; données réelles des fixtures (aucun chiffre inventé
observé).

## Captures produites (scratchpad, hors dépôt)

Dossier : `C:/Users/admha/AppData/Local/Temp/claude/c--Users-admha-mon-saas-saas-immo/5dd87a48-6733-41ee-82d0-4f865d3562e0/scratchpad/`
- `shots/` : 113 fichiers — pour chaque route `<route>-{1440,390}-{reduce,no-preference}.png`
  (page entière) et `<route>-{1440,390}-reduce-fold.png` (pli) ; `landing-agents-*` ;
  clavier `kbd_dashboard-*`, `kbd_agents-ia-*`, `kbd-menu-{focused,open,tabbed}-390.png`.
- `crops/` : `agents390-history.png` (P-1), `agents1440-rail-end.png` (P-2), `agents390-rail.png`,
  `agents390-errors.png`, `dash1440-todo.png` (C-2), `fiche-back.png` (C-2), `devicons-large.png`,
  `devicons-rest.png`, `landing1440-agents.png`, `landing1440-frieze.png`, `landing390-*.png`,
  `relances1440-bottom.png`, `relances390-{top,bottom}.png`.
- Mesures : `measures.jsonl`, `measures2.jsonl`.
