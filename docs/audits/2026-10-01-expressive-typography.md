# Audit visuel — typographie expressive (01/10/2026)

Branche : `feat/expressive-typography` (travail non commité). Auditeur : `web-designer`.
Référence : `docs/design-system.md` § 2.2 (dont § 2.2.10, critères de contrôle), § 1.1, § 2.5,
§ 3.8. Choix de l'utilisateur : Bricolage Grotesque 600, mot accentué variante A + apparition C
sur le site public, CRM « expressif contrôlé ».

## Verdict

**CONFORME AVEC CORRECTIONS MINEURES.**

Les treize critères de contrôle du § 2.2.10 sont satisfaits sur les points que j'ai pu vérifier
(détail plus bas). Aucun garde-fou touché, aucune donnée inventée, aucune requête vers Google.
Deux corrections mineures (veil visible dans le panneau final, veuves des titres repliés sur
téléphone). Une **question à soumettre à l'utilisateur** : la taille du hero (78,6 px) ne me
paraît pas à la hauteur de « très expressif » (voir § 4).

## 1. Méthode réellement exécutée

1. Lecture de la spécification (§ 2.2.1 à 2.2.11) et des diffs de `components/landing/*`,
   `components/ui/EditorialTitle.*`, `app/(marketing)/layout.tsx` (non modifié).
2. Examen des captures de `frontend-ux` (`scratchpad/typo-final/`) : accueil 1440/1024/390 et
   page entière 1440, `/estimation` 1440/1024/390 et mouvement réduit à l'instant 0, tableau de
   bord, contacts, a-valider avec et sans messages, tâches vides ; `measures.json`.
3. Captures et mesures complémentaires (script Playwright temporaire, supprimé), serveur de dev
   local :
   - **Animation du hero avec mouvement autorisé**, échantillonnée à ≈ 160 / 300 / 460 / 700 /
     1000 ms (temps compté depuis l'apparition du `h1`) + capture à 300 ms.
   - Styles calculés de tous les `h1`/`h2` et `.title-accent` de `/` (famille, graisse, taille,
     `display`, couleur), nombre de `h1`, absence de `<em>`/`<i>`, débordement du document,
     écoute réseau `fonts.googleapis.com` / `fonts.gstatic.com`.
   - Gros plans des sept mots accentués et de leur ponctuation à 1440.
   - Chaque section de la landing à 1440 ; panneau final à 1440 / 1024 / 390 avec mesure du
     voile ; `/estimation` à 1024 et 390.
   - **Balayage de la taille du hero** à 768, 900, 1023, 1024, 1100, 1180, 1280, 1366, 1440,
     1600, 1920 px (taille calculée, largeur de colonne, nombre de lignes visuelles par ligne
     d'auteur).
4. Exécution réelle de `npx playwright test e2e/typographie-expressive.spec.ts
   e2e/voiles-lisibilite.spec.ts e2e/premier-regard.spec.ts` : **18 tests passés sur 18**
   (1,3 min).

Non exécuté par moi : `npm run build`, `npx vitest run`, `npx tsc --noEmit`, lint (déclarés par
`frontend-ux`, non revérifiés ici). Pas de vérification au lecteur d'écran réel (seulement la
structure `sr-only` + `aria-hidden` couverte par le test E2E).

## 2. Verdict point par point (§ 2.2.10)

| # | Critère | Résultat | Preuve |
|---|---|---|---|
| 1 | Aucune requête Google, pas d'Inter | Conforme | 0 requête mesurée sur `/` ; test E2E n° 4 passé. Build non revérifié. |
| 2 | Familles calculées | Conforme | `h1`/`h2` « Bricolage Grotesque » ; 7 `.title-accent` en « Instrument Serif » italique 400, `display: inline`, encre `rgb(24,24,27)`. |
| 3 | Graisse 600 | Conforme | Tous les `h1`/`h2` de `/` à 600 ; test CRM n° 12 (aucun titre ≥ 700) passé. Le hero paraît plus dense à 1440 qu'à 1024 : c'est l'axe optique (`opsz: auto`), pas la graisse (600 mesuré). |
| 4 | Contraste | Conforme | `voiles-lisibilite.spec.ts` passé à 1440 et 390. |
| 5 | Débordement, lignes d'auteur | Conforme | Aucun débordement ; à 1440 et 1024 chaque ligne d'auteur sur une ligne (mesures + balayage 1024–1920). |
| 6 | Hauteur de ligne | Conforme | Écart 0 px (hero 74,69 / 57,61 / 41,86 ; état vide 33,59). |
| 7 | Mot ≥ 28 px | Conforme | Plus petit : 29,68 px (états vides) ; landing 76,3–83,3 px. |
| 8 | Mouvement réduit, sans JS, pause | Conforme | Tests n° 7, 8, 9, 11 passés ; capture `/estimation` instant 0 nette. |
| 9 | Rythme | Conforme | Mot accentué opaque dès ≈ 300 ms (0,93 à 163 ms), flou résiduel des autres mots 3,4 px à 300 ms, 0,15 px à 460 ms, **0 à 706 ms**, opacité 1 à 1003 ms. Capture à 300 ms : « *main* » net et noir, « garde la » encore flou et pâle. **Le mot accentué arrive net en premier.** La ponctuation « . » suit sa ligne (floue), ce qui est cohérent avec la règle (le mot seul est net). |
| 10 | Structure | Conforme | 1 seul `h1`, aucun `<em>`/`<i>` ; test E2E (nom accessible) passé. |
| 11 | CRM | Conforme | `h1` 48 / 42 / 32 px (1440–1024 / 800 / 390–360) ; sur-titres sur les onze écrans (test n° 12) ; italique seulement dans les états vides. |
| 12 | Premier regard | Conforme | `premier-regard.spec.ts` passé (3/3). |
| 13 | Garde-fous | Conforme | « Simulation », « Exemple fictif — simulation », note finale, sous-titre de `/estimation` (« aucune estimation chiffrée ») visibles et inchangés. |

### Points que `frontend-ux` m'a demandé de regarder

- **Marge de 12 px du hero à 1024.** Acceptée. Le balayage montre que 1024 est le pire cas de la
  plage à deux colonnes (l'axe optique élargit les glyphes aux petites tailles : 455/467 à 1024,
  575/605 à 1440) et que rien ne se replie entre 1024 et 1920. Le seul risque est un repli
  passager pendant l'échange de police (`swap`), atténué par le repli métrique : pas de
  correction.
- **Rapport titre / texte de `/estimation`.** 48 px contre 19 px (≈ 2,5:1) à 1024 et plus. Accepté :
  le sous-titre est long parce qu'il porte un garde-fou (« aucune estimation chiffrée »), il ne
  doit pas être raccourci ; le titre en deux lignes d'auteur domine nettement. Pas de correction.
- **Panneau final en une colonne.** Conforme à la décision (§ 2.2.9) et plus lisible : titre,
  actions, note. Mais le voile de lisibilité du titre devient visible dans le panneau (correction 1).
- **En-tête public à 390** (« Demander une estimation » sur trois lignes). **Préexistant** :
  `app/(marketing)/layout.tsx` et `ButtonLink` ne sont pas modifiés par ce lot. Hors lot (§ 6).
- **Italique et ponctuation.** Contrôlé en gros plan sur « *main*. », « *s'arrête*. »,
  « *commencer*. », « *chemin*, » : aucun glyphe ne touche la ponctuation, l'espace optique est
  correct. Conforme.

### Observations sans correction

- CRM : le sur-titre « — PILOTAGE » est aligné sur le bord gauche du bloc (la tuile d'icône), pas
  sur le texte du `h1`. C'est le même bord que les cartes en dessous : un seul axe de lecture.
  Accepté.
- Titre final : « Retrouvez-la » seul sur sa ligne d'auteur crée une ligne courte au milieu ; c'est
  le découpage spécifié et il tient à 1024 comme à 1440. Accepté.
- Section « problème » décalée de 48 px à 1440 : préexistant et voulu (aligné sur le graphique,
  `ProblemHeading.module.css`).

## 3. Corrections demandées à `frontend-ux`

1. **Voile visible dans le panneau final** — mineur.
   - Fichiers : `components/landing/LandingFinal.tsx`, `components/landing/LandingHeading.tsx`.
   - Constat mesuré : `LandingHeading` pose `.particle-veil` (pseudo-élément blanc à 90 %,
     débord 3 rem × 1,25 rem) à l'intérieur d'un panneau déjà opaque (`bg-surface/90` +
     `backdrop-blur`). À 1440 le voile couvre x 129–1108 dans un panneau 128–1312 : son bord
     droit se lit comme un rectangle plus clair derrière le titre (capture). À 390 il déborde du
     panneau (x 9–381 pour un panneau 24–366).
   - Correction attendue : pas de voile pour le titre du panneau final (option de
     `LandingHeading`, ex. `veil={false}`, ou classe qui neutralise le `::before` dans ce seul
     appel). Les autres sections gardent leur voile. Relancer `e2e/voiles-lisibilite.spec.ts`
     (le panneau doit rester ≥ 4,5:1 sans le voile) et capturer le panneau à 1440 / 1024 / 390.
2. **Veuves des titres repliés sous 1024 px** — mineur.
   - Fichier : `components/ui/EditorialTitle.module.css` (`.line`).
   - Constat : à 390, `/estimation` affiche « Parlez-nous de votre / **bien.** » et « Un
     *conseiller* vous / **répond.** » ; même effet sur les lignes repliées de la landing à
     390 / 360 (« Ce n'est pas la prospection », « où son travail commence. », etc.).
   - Correction attendue : `text-wrap: balance` sur `.line` (chaque ligne d'auteur reste une
     unité d'animation ; aucun effet à 1440 / 1024 où chaque ligne tient sur une ligne).
     Vérifier à 390 et 360 : `/estimation` doit se lire « Parlez-nous de / votre bien. » et « Un
     *conseiller* / vous répond. » (ou équivalent équilibré), aucun débordement, écart de hauteur
     de ligne toujours ≤ 0,5 px.

Aucune correction bloquante.

## 4. Taille du hero : à soumettre à l'utilisateur

**Avis : 78,6 px n'est pas à la hauteur de « très expressif ».** Trois mesures le montrent :

- le hero est **plus petit qu'avant** (88 px en Geist serré) ;
- il ne domine presque plus les titres de section : 78,6 px contre 72 px, **rapport 1,09** ;
  le premier écran et la deuxième section ont quasiment la même voix ;
- il **plafonne à 78,6 px dès 1280 px** (colonne bornée à 605 px) et il est même plus petit sur
  grand écran qu'à 1023 px (89,7 px, une colonne).

Le dessin de Bricolage et le mot italique compensent en partie, mais la hiérarchie
hero / sections est trop plate. Options, **non appliquées** :

- **Option 1 (recommandée, la moins coûteuse)** : activer l'option « serré » prévue au § 2.2.1
  (axe `wdth` 92 sur `text-poster` seulement) et passer le coefficient à `14cqi` → ≈ 85 px à
  1440 ; **et** ramener le plafond de `text-statement` de 72 à 64 px (4 rem). Rapport hero /
  sections ≈ 1,33, grille inchangée. Coût : un axe de police de plus au build, sections un peu
  moins grandes.
- **Option 2** : élargir la colonne du titre dès 1280 px (≈ 690 px au lieu de 605) → ≈ 90 px.
  Coût : la scène « Parcours d'un prospect fictif » passe à ≈ 430 px et ses descriptions sont
  tronquées comme aujourd'hui à 1024 (« délai struct… »). Je ne la recommande pas.
- **Option 3** : garder l'état actuel (décision assumée au § 2.2.3).

## 5. Éléments préservés

Garde-fous et mentions (« Simulation », « Exemple fictif — simulation », note « Aucune donnée
réelle, aucun envoi réel », sous-titre de `/estimation`, consentement), validation humaine du
premier contact (bandeau de `/agents-ia/a-valider` inchangé), icônes validées, réseau vivant,
données réelles des écrans CRM.

## 6. Défauts préexistants, hors de ce lot

1. **En-tête public à 390** : le lien fantôme « Demander une estimation » se replie sur trois
   lignes (`app/(marketing)/layout.tsx`, non modifié). Correction proposée pour un lot ultérieur :
   libellé court « Estimation » sous 640 px (texte centralisé) ou lien masqué sous 640 px (l'action
   reste dans le hero), `whitespace-nowrap`.
2. **En-tête public à 1440** : le logo commence à x = 168 (conteneur `max-w-6xl`) alors que le
   contenu de la landing commence à x = 128 (`max-w-7xl`) : deux bords gauches. Cosmétique.
3. **Barre latérale du CRM** : l'adresse « …@example.test » se coupe en « example.tes / t ».
   Cosmétique (cause non inspectée dans le code ; piste : troncature avec l'adresse complète en
   infobulle accessible, ou coupure autorisée seulement avant « @ »).

## 7. Contre-audit (aller-retour 2, dernier)

**Verdict final : CONFORME AVEC RÉSERVES.** Aucun défaut bloquant. Les réserves ci-dessous sont
acceptées pour cette livraison ou renvoyées à l'utilisateur ; aucune nouvelle correction n'est
demandée à `frontend-ux`.

### 7.1 Vérifications réellement faites

- Lecture des captures de `frontend-ux` (`typo-final-v2/` : accueil 1440 / 1024 / 390 / 360,
  panneau final 1440 / 1024 / 390, `/estimation` 390 / 360).
- Captures complémentaires sur le serveur local déjà lancé (Playwright, `deviceScaleFactor` 2,
  `reducedMotion: reduce`, titre du hero à 1440 / 1024 / 390 ; script temporaire supprimé) et
  mesures calculées :

  | Largeur | Taille du hero | `wdth` | Interlettrage | Largeur titre / colonne | Débordement page |
  |---|---|---|---|---|---|
  | 1440 | 84,67 px | 92 | −2,96 px (−0,035 em) | 605 / 605 (scrollWidth = clientWidth) | non |
  | 1024 | 65,32 px | 92 | −2,29 px | 467 / 467 | non |
  | 390 | 44,08 px | 92 | −1,54 px | 342 / 342 | non |

- Clavier (3 tailles) : logo (contour 3 px), « Demander une estimation », « Espace agence » :
  contour visible, ordre logique, inchangé.
- Nom accessible du titre : copie `sr-only` unique, lignes visuelles `aria-hidden` (inchangé).
- Code relu (sans modification) : `LandingHeading` prop `veil` (défaut `true`), `veil={false}`
  dans le seul `LandingFinal` ; `text-wrap: balance` sur `.line` ; `.poster` =
  `min(var(--text-poster), 14cqi)` + `wdth` 92 ; `--text-statement` plafonné à 4 rem ;
  axe `wdth` chargé pour Bricolage dans `app/layout.tsx`.
- Non refait par moi : mesure de contraste du panneau final (17,3:1 / 17,5:1 rapportés par
  `frontend-ux`, cohérents avec un noir sur panneau opaque quasi blanc) et e2e.

### 7.2 Correction par correction

1. **Voile du panneau final** — corrigé. Le rectangle clair a disparu à 1440 / 1024 / 390 ; les
   autres sections gardent leur voile.
2. **Veuves sous 1024 px** — corrigé. `/estimation` à 390 : « Parlez-nous / de votre bien. »,
   « Un *conseiller* / vous répond. ». Aucune ligne d'un seul mot dans les titres audités.
3. **Hero (option 1)** — conforme à la recommandation. 84,7 px à 1440 contre 64 px pour les
   sections (rapport 1,32) : le premier écran a maintenant une voix distincte. Le titre remplit
   exactement sa colonne, sans débordement. À 1024 le rapport tombe à 1,09 (colonne limitante) :
   accepté, la hiérarchie y est portée par la position et le mot italique.
4. **Test e2e instable** — préexistant, hors design ; pris acte.

### 7.3 Points restants

**(a) Acceptés pour cette livraison**

- Marge de 56 px dans la colonne à 1440 : c'est la borne `14cqi` spécifiée ; le titre occupe
  toute la largeur mesurée de son conteneur, la marge relève de la grille, pas du titre.
- Panneau final à 390 : « Retrouvez-la / dans l'espace / agence. » — trois lignes équilibrées
  par `balance`, lisibles, aucun mot isolé fautif ; pas de correction.
- Deux taches claires très légères à droite du titre du panneau final à 1440 : étiquettes du
  réseau vivant vues à travers le `backdrop-blur` du panneau. Préexistant, sans effet sur la
  lisibilité (titre à 17:1).

**(b) À proposer à l'utilisateur dans un lot ultérieur**

1. **Interlettrage du hero serré** (cosmétique, goût) : à 84,7 px, `wdth` 92 et −0,035 em
   produisent des quasi-contacts (« ur » de *vendeur*, « rd » de *garde*, « Vo »). C'est
   lisible et cohérent avec « très expressif », mais si l'utilisateur trouve l'effet trop
   compact, passer `.poster` à −0,025 em (sans changer la taille, perte ≈ 1 px de marge par
   ligne, à revérifier dans la colonne).
2. **Option 2 du § 4** (colonne de titre élargie à ≈ 690 px dès 1280 px) seulement si
   l'utilisateur veut un hero encore plus grand ; elle coûte la lisibilité de la scène
   « Parcours d'un prospect fictif ».
3. **Taches du `backdrop-blur`** du panneau final : soit masquer les étiquettes du réseau sous
   les panneaux opaques, soit réduire le flou ; à traiter avec le réseau vivant.
4. Défauts préexistants du § 6 (en-tête public à 390, deux bords gauches à 1440, adresse coupée
   dans la barre latérale) : inchangés.

Garde-fous vérifiés de nouveau dans les captures : « Simulation », « Exemple fictif —
simulation », « Illustration rejouée en boucle. Aucun prospect réel, aucun envoi. », « Prototype
de démonstration. Aucune donnée réelle, aucun envoi réel. », validation humaine et mandat
confirmé par un humain dans la scène, sous-titre de `/estimation` (« aucune estimation chiffrée
n'est communiquée par ce formulaire »).
