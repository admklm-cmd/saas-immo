# Audit visuel — landing en mouvement (lot `feat/landing-motion`)

- Date : 01/10/2026 (lot daté 02/10 dans le plan) — `web-designer`, aller-retour **1 sur 2**.
- Branche : `feat/landing-motion`, commits audités `f511ace` (effets de titre, parcours joué une
  fois, badge, `TechWordmark`, retrait de `MotionToggle`) et `6543ac5` (réseau neuronal 3D).
- Référentiel : `docs/design-system.md` § 2.11 (critères § 2.11.7, écarts § 2.11.4),
  `docs/plans/2026-10-02-landing-motion.md`, démo utilisateur `docs/references/reseau-neuronal-demo.html`.
- Décisions utilisateur prises comme acquises : pas de bouton « Rejouer » ; titre « problème »
  option A (réseau visible derrière les lignes grises, ≥ 3:1) ; impulsions × 1,5 ; aucune
  animation en boucle sur la landing.

## Verdict

**CONFORME AVEC CORRECTIONS MINEURES.**

La règle structurante du lot — **aucune boucle** — est tenue et vérifiée par mes propres mesures
aux trois largeurs. Le réseau est fidèle à la démo de l'utilisateur à 1440 et 1024. Une seule
non-conformité mesurée à une règle chiffrée : le contraste minimal des deux lignes grises du titre
« problème » tombe à **2,97:1** (mouvement autorisé) et **2,90:1** (mouvement réduit) à 1440
pour une position de défilement que les tests de `frontend-ux` ne couvraient pas (exigence ≥ 3:1).
Rien de bloquant : le médian reste 5,69:1 et le titre est lisible ; la correction est un réglage
de voile.

## 1. Méthode réellement exécutée

1. Lecture de `CLAUDE.md`, § 2.11 complet de `docs/design-system.md`, statistiques Git des deux
   commits (aucun changement non commité au départ).
2. Revue des captures de `frontend-ux` (passe 1 : effets de titre et wordmark ; passe 2 : réseau,
   comparaison avec la démo à 1440 et 390).
3. **Mesures propres** (script Playwright temporaire dans le dossier de travail de la session,
   hors dépôt ; Chromium sans interface, DPR 1, serveur de développement déjà lancé sur
   `localhost:3000`) à **1440 × 900, 1024 × 768, 390 × 844** :
   - compteur de `requestAnimationFrame` (enveloppe posée par script d'initialisation) ;
   - état du canvas (`data-motion`, `data-signals`, `data-lit`, `data-frames`, `data-sequences`)
     échantillonné toutes les ≈ 230 ms pendant l'arrivée, puis après avoir amené chaque section ;
   - pixels cobalt et rouges du canvas (lecture `getImageData`), encre (alpha moyen) ;
   - deux captures pleine fenêtre à 1 s d'écart comparées octet par octet (haut et bas de page) ;
   - `document.getAnimations()` à itérations infinies ;
   - débordement horizontal ;
   - mouvement réduit : `data-motion`, cobalt, rAF pendant et après un défilement, canvas du
     wordmark.
4. **Contraste propre** (second script) : pour chaque section amenée **en haut de fenêtre**
   (`scrollIntoView({ block: "start" })`) puis posée, chaque nœud de texte hors fond opaque
   (≥ 0,95) ; texte rendu transparent, pixel le plus sombre et pixel médian sous la boîte du texte
   comparés à la couleur calculée du texte. 1440 et 390, mouvement autorisé puis réduit.
5. Gros plans du titre « problème » à 1440, texte affiché puis masqué.
6. `npx vitest run components/landing components/ui/EditorialTitle` : **16 fichiers, 183 tests
   réussis**.
7. **Non exécuté par moi** : la suite E2E (elle recharge les données fictives et un audit de
   sécurité tourne en parallèle sur la même copie). Je m'appuie sur le journal de `frontend-ux`
   (`pass2/playwright-suite.txt` : **201 réussis**), sans l'avoir rejoué. Le survol et le glisser
   du wordmark n'ont pas été rejoués non plus : jugés sur les captures de la passe 1.

## 2. Mesures propres (résumé)

| Mesure | 1440 | 1024 | 390 | Exigence |
|---|---|---|---|---|
| `data-nodes` / `data-fibers` / `data-links` | 34 / 2 450 / 63 | 28 / 1 969 / 51 | 20 / 1 412 / 40 | 34 / 28 / 20, sous plafonds |
| `settled` après le début de la navigation (chargement inclus, ≈ 0,5–0,8 s) | 5,61 s | 6,69 s | 6,09 s | ≤ 6,0 s après le chargement → tenu (≈ 5,1 / 5,9 / 5,6 s) |
| rAF pendant 2 s, 7 s après le chargement | 0 | 0 | 0 | 0 |
| Deux captures à 1 s, haut et bas de page | identiques | identiques | identiques | identiques |
| `data-frames` stable au repos | oui | oui | oui | oui |
| Animations infinies (`getAnimations`) | aucune | aucune | aucune | aucune |
| Salve de section → `settled` (6 sections, pas d'échantillonnage ≈ 0,23 s) | 2,3–4,1 s | 2,3–4,1 s | 3,0–4,0 s | ≤ 4,0 s (WCAG 2.2.2 < 5 s tenu dans tous les cas) |
| rAF dans les 2 s suivant chaque salve | 0 | 0 | 0 | 0 |
| `data-sequences` final, puis après retour en haut | 7 scènes une fois, inchangé | idem | idem | chaque scène au plus une fois, rien rejoué |
| Pixels cobalt au repos (chaque section) | 0 | 0 | 0 | 0 |
| Pixels rouges | 0 | 0 | 0 | 0 |
| Encre au repos | 1,53–1,64 % | 1,36–1,49 % | 1,23–1,28 % | 1,2–2,2 % / 0,8–2,0 % |
| p95 d'une image (dernière fenêtre active) | 1,70 ms | 2,40 ms | 1,10 ms | ≤ 4 ms |
| Mouvement réduit : `data-motion`, cobalt, rAF au défilement, canvas du wordmark | `reduced`, 0, 0, 0 | idem | idem | idem |
| Débordement horizontal | 0 | 0 | 0 | 0 |
| Pic de pixels cobalt pendant une salve (visibilité des impulsions) | 483–928 | 22–650 | 46–370 | — (observation) |

Note sur les salves : le maximum de 4,1 s est une borne haute (échantillonnage de 0,23 s, plus le
temps de défilement) ; il ne contredit pas les 2,9–4,0 s mesurés par `frontend-ux`. Je ne le
retiens pas comme écart.

## 3. Verdict par critère (§ 2.11.7)

| # | Critère | Verdict | Preuve |
|---|---|---|---|
| 1 | Aucune boucle | **Conforme** | Mesures propres (§ 2) aux trois largeurs, haut et bas, après chaque section |
| 2 | Durées | **Conforme** | Réseau `settled` ≤ 6 s après chargement, salves ≤ 4 s (à la précision près) ; titres et parcours : tests E2E de `frontend-ux` (non rejoués) et captures passe 1 |
| 3 | Pendant les effets | **Conforme, réserve cosmétique** | Captures passe 1 à 0,9 s : flou tenu, mot net, cadre 4 coins. Le coin gauche du cadre recouvre l'apostrophe de « l' » et le coin droit le point final, tous deux floutés, pendant ≈ 1,3 s (voir C3) |
| 4 | Mouvement réduit | **Conforme** | Mesures propres : `reduced`, 0 cobalt, 0 rAF, wordmark sans canvas ; captures |
| 5 | Hauteur de ligne | **Conforme (déclaré)** | Test E2E `typographie-expressive` (non rejoué) |
| 6 | Wordmark | **Conforme, réserve cosmétique** | `aria-hidden`, aucun débordement, aucun canvas en réduit (mesuré) ; artefacts de contour (C2) |
| 7 | Réseau | **Conforme** | Comptes, encre, séquences uniques, coût, `data-frames` stable : mesurés. Verdict visuel § 4 |
| 8 | Contraste | **Non conforme (mineur)** | Lignes grises du titre « problème » : **2,97:1** (1440, mouvement autorisé) et **2,90:1** (1440, réduit) au pixel le plus sombre, section en haut de fenêtre ; médian 5,69:1. Tout le reste au-dessus des seuils (voir § 5) |
| 9 | Couleurs | **Conforme** | 0 rouge, 0 cobalt au repos et en réduit (mesuré) ; aucun `shadowBlur` / `drop-shadow` / `filter` dans `components/landing/living` et `wordmark` (recherche + test `source-guard`) |
| 10 | Garde-fous | **Conforme** | « Simulation », « Exemple fictif — simulation », « Animations : exemple fictif, simulation. Aucune activité en direct. » (4,77–4,86:1), « Aucun prospect réel, aucun envoi. », note finale, validation humaine, mandat confirmé : visibles sur les captures |
| 11 | Non-régression du CRM | **Conforme (déclaré)** | Suite E2E de `frontend-ux` (201 réussis), non rejouée par moi |

## 4. Fidélité à la démo de l'utilisateur

**1440 et 1024 : fidèle.** Corps cellulaires irréguliers avec noyau sombre, arbres dendritiques
qui s'affinent jusqu'au cheveu, liaisons sinueuses longues, profondeur lisible (neurones proches
noirs et nets, lointains pâles), impulsions cobalt à tête claire et courte traînée, cœur qui
s'allume avec un halo à peine perceptible (visible sur la salve « agents » à 1024). Le réseau est
présent à gauche, à droite, en haut, en bas et derrière les titres, conformément à la règle
globale. Écarts visibles et assumés : moins de contraste au centre de l'écran (voiles et zones
calmes, nécessaires à la lecture), pas d'épaississement des fibres excitées (adaptation
documentée), et surtout une activité **bornée** au lieu d'une pulsation permanente (décision
utilisateur).

**390 : fidèle en matière, nettement plus discret en activité.** La texture est la bonne, mais
dans le hero le réseau ne se lit plus vraiment comme « des neurones » : la colonne de texte
occupe toute la largeur, les voiles et zones calmes effacent le centre, et il reste des fibres
pâles en bordure. Les salves y sont à peine perceptibles (pic de 46 pixels cobalt pour
« problème », 51 pour « agents », soit 2 à 4 têtes d'impulsion ; 22 pour « problème » à 1024).
C'est la conséquence attendue de l'écart n° 4 (« plus courte, jamais plus rapide ») et des zones
calmes : **conforme à la spécification**, mais moins démonstratif que la démo sur téléphone. Je
ne demande pas de correction dans ce lot (aucune règle chiffrée n'est violée) ; proposition au § 8.

## 5. Contraste — détail des mesures propres

Pixel le plus sombre / médian, texte masqué, état posé, section en haut de fenêtre.

| Texte | 1440 autorisé | 1440 réduit | 390 autorisé | 390 réduit | Seuil |
|---|---|---|---|---|---|
| Lignes grises « problème » (64 px / 36 px, `rgb(102,102,110)`) | **2,97** (« vos ») – 4,90 ; médian 5,69 | **2,90** (« vos ») – 4,99 | 3,47 – 5,04 | 3,44 – 5,13 | ≥ 3 et médian ≥ 4,5 |
| Petits textes les plus faibles (11–13 px) | 4,72 (« Relation », carrousel) ; 4,86 (note du hero) ; 5,08 | 4,77 ; 4,91 | 4,73 ; 4,82 ; 4,91 | 4,73 ; 4,82 ; 5,00 | ≥ 4,5 |
| Titres en encre | ≥ 9 (hors artefact ci-dessous) | idem | idem | idem | ≥ 7 |

Artefact écarté : « main », « fictive » et « Retrouvez-la » sortent à 3,28:1 parce que la boîte
de glyphe contient le **trait cobalt** du mot accentué (contraste encre / cobalt = 3,28:1) ; ce
n'est pas un fond, le trait est voulu et ne touche pas les lettres de la ligne suivante (vérifié
sur captures).

Cause de l'écart : les mesures de `frontend-ux` (3,65–3,88:1) ont été faites à d'autres
positions de défilement. La caméra tournant avec le défilement, le pire cas dépend de la pose :
section en haut de fenêtre, une fibre proche (ou un recouvrement de deux tracés) passe sous
« vos ». Calcul : sous un voile blanc à 70 %, un pixel d'encre presque plein donne
`0,7 × 255 + 0,3 × ≈ 36 ≈ 189` → 2,97:1 contre le gris `#66666e`. Le seuil de 3:1 exige un voile
**≥ 71 %** même pour un pixel d'encre pur (`v × 255 + (1 − v) × 24 ≥ 188`).

## 6. Avis sur les écarts déclarés par `frontend-ux`

| # | Écart | Avis | Motif |
|---|---|---|---|
| 1 | Graine `DEFAULT_SEED` = 20261069 | **Accepté** | Couverture vérifiée par test ; même réseau à chaque chargement (constaté entre mes runs) |
| 2 | Cache seulement caméra immobile ; redessin direct en mouvement | **Accepté** | p95 mesuré 1,1–2,4 ms ≤ 4 ms |
| 3 | Dérive caméra sur la durée effective | **Accepté** | La pose finale ne dépend pas des séquences ; `settled` dans les délais |
| 4 | Origine élargie (`data-network-cover`, exclusion haut de fenêtre) | **Accepté, avec réserve** | Juste : une impulsion née derrière une surface opaque ne serait jamais vue. Réserve : faible visibilité des salves en compact (§ 4), renvoyée à un lot ultérieur |
| 5 | Voiles débordants (`.network-veil-title` +1,5 rem, `[data-landing] .particle-veil` +0,375 rem) | **Accepté** | Justifié par mesure (glyphes qui débordent la boîte de ligne) ; CRM non touché |
| 6 | Voile du système « problème » 76 → 90 % ; voile + zone calme sur la navigation du carrousel | **Accepté** | Justifié par mesure (4,2:1 et 1,14:1 sinon) ; petits textes mesurés ≥ 4,72:1 |
| 7 | Neurone allumé redessiné un peu plus sombre ≈ 2 s ; impulsions sous les corps | **Accepté** | Transitoire, encre seulement, 0 cobalt au repos mesuré ; invisible à l'œil sur les captures |
| 8 | Mouvement réduit sans atténuation des corps sous les textes | **Accepté sur le principe, à corriger dans ses effets** | La raison est bonne (l'atténuation serait décalée sans redessin) ; mais en réduit le pire cas descend à 2,90:1 sous « vos » : couvert par la correction n° 1 |
| 9 | `TechWordmark` : interlettrage −0,04em, `font-optical-sizing: none` | **Accepté** | Mesuré (aucun chevauchement à −0,04em, lettres peintes = lettres HTML) |
| 10 | Petits pointillés internes dans « c » et « e » en mode contour | **Accepté pour ce lot, correction cosmétique recommandée** | Sur la capture de survol (passe 1, 1440), la barre du « e » se prolonge en pointillé dans l'œil de la lettre et vers le « c » : on lit un défaut de tracé, pas un effet. Survol seulement, décoratif, aucune information. Voir C2 |
| 11 | `LivingEngine.ts` 414 lignes, `renderer.ts` 410 lignes | **Accepté** | Hors de mon périmètre de jugement visuel ; découpage déjà fait en 15 modules |
| 12 | Cascade très courte sur téléphone | **Accepté** | Conséquence assumée de « plus courte, jamais plus rapide » ; voir § 8 |

## 7. Corrections demandées

1. **Contraste des lignes grises du titre « problème »** — *mineur, à corriger dans ce lot.*
   - Fichiers : `components/landing/problem/ProblemHeading.tsx` (et la classe de voile qu'il
     utilise), `app/globals.css` si une variante est créée, `e2e/landing-reseau.spec.ts` (ou le
     test de contraste existant).
   - Constat mesuré : 2,97:1 (1440, mouvement autorisé) et 2,90:1 (1440, mouvement réduit) au
     pixel le plus sombre sous « vos », section « problème » amenée en haut de fenêtre
     (`scrollIntoView({ block: "start" })`) puis posée. Exigence § 2.11.4 : ≥ 3:1.
   - Correction attendue : voile des **deux lignes grises seulement** à **75 %** (variante locale
     de `.network-veil-title`, landing seulement ; la ligne en encre et les autres titres restent
     à 70 %). 75 % garantit ≥ 3,3:1 même sur un pixel d'encre pur, en mouvement autorisé comme
     réduit, sans dépendre de la pose. L'option A est conservée (réseau visible à 25 %).
     Alternative acceptée si `frontend-ux` la préfère et la mesure : corps cellulaires × 0 (au
     lieu de × 0,5) dans les zones calmes de titre **et** une fibre proche plafonnée — mais elle
     ne couvre pas le mouvement réduit ; le voile est la solution recommandée.
   - Test : ajouter au test de contraste la position « section en haut de fenêtre » et le
     mouvement réduit, aux deux largeurs (1440, 390). Critère : ≥ 3:1 au pire, médian ≥ 4,5:1.
   - Report : mettre à jour la ligne « Contraste minimal » du § 2.11.4 avec la nouvelle mesure.

2. **Contour du wordmark : pointillés internes du « c » et du « e »** — *cosmétique, recommandé,
   non bloquant.*
   - Fichiers : `components/landing/wordmark/paint-wordmark.ts`.
   - Constat : capture `pass1/final-panel-hover-1440-motion.png` ; les contours superposés de la
     police variable produisent des tracés internes (barre du « e » prolongée dans la lettre).
   - Correction attendue : n'afficher que le contour extérieur. Piste sans dépendance : tracer le
     pointillé à `2 × strokeWidth`, puis `globalCompositeOperation = "destination-out"` et
     `fillText` de la même lettre ; il reste la moitié extérieure du trait (1,5 px) et tous les
     tracés internes disparaissent. Garder la tolérance « lettre peinte = lettre HTML ≤ 1 px »
     (le contour extérieur dépasse de 0,75 px de plus qu'aujourd'hui : acceptable, à vérifier).
     Si le coût dépasse 2 ms par image active ou si le rendu se dégrade, laisser en l'état et le
     signaler : la réserve est alors acceptée définitivement.

3. **Cadre de mise au point sur l'apostrophe et le point** — *cosmétique, aucune correction
   demandée.* Le coin gauche recouvre l'apostrophe de « l' » et le coin droit le point final
   pendant ≈ 1,3 s, tous deux floutés à ce moment. La spécification (« aucune branche ne touche
   un glyphe ») vise le mot encadré, dont le dégagement est respecté. Aucune action.

## 8. Défauts préexistants (hors lot, non imputables à `frontend-ux`)

1. **En-tête public à 390** : « Demander une estimation » se replie sur trois lignes et déborde
   de sa boîte (hauteur mesurée de 32 px pour un texte sur trois lignes) ;
   `app/(marketing)/layout.tsx` n'a pas changé depuis `947d781`. Déjà signalé le 01/10.
2. **Cartes du carrousel des agents translucides** : le réseau se voit à travers les cartes
   (corps cellulaire visible derrière « Hugo · Qualification » à 1024). Contraste mesuré ≥ 4,72:1,
   donc pas de non-conformité ; à réévaluer avec le lot direction artistique (surface opaque ou
   `data-network-cover`).

## 9. Propositions pour un lot ultérieur

1. **Salves visibles en compact** : à 390 (et pour « problème » à 1024) une salve n'allume que
   2 à 4 têtes d'impulsion visibles. Piste : en compact, choisir l'origine parmi les neurones
   **en bordure de colonne** (marges gauche et droite, hors zones calmes) plutôt qu'au centre,
   et préférer les liaisons courtes. Valeurs d'impulsion inchangées (plafonds de la référence).
2. **Hero à 390** : laisser au moins un neurone proche lisible dans la marge basse du hero
   (sous les boutons), là où il n'y a pas de texte, pour que la lecture « neurones » existe
   aussi sur téléphone.
3. **Variété des origines à 1440** : « problème » et « solution » partent du même neurone (même
   pose, même zone libre à droite). Piste : exclure une origine déjà utilisée par une séquence
   précédente du même chargement.
4. Préexistants du § 8 (en-tête 390, cartes translucides).

## 10. Éléments préservés (vérifiés)

- Garde-fous visibles : « Simulation », « Exemple fictif — simulation », mention d'animation
  fictive, « Aucun prospect réel, aucun envoi. », note finale, validation humaine distincte,
  mandat confirmé par un humain.
- Aucune animation ne lit un état réel ; aucune ne dure plus de 5 s ; rien n'est rejoué.
- Aucun rouge ; cobalt réservé aux traits, cadres, impulsions et cœurs ; aucune dépendance
  ajoutée.
- CRM : non modifié par ce lot d'après les statistiques Git ; non-régression déclarée par la
  suite E2E de `frontend-ux` (non rejouée par moi).
