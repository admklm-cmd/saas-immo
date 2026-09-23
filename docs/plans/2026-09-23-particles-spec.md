# Spécification utilisateur — animations (fait foi)

## 1. Fond et direction artistique
- Fond blanc, dégradé gris perle très doux, halo blanc diffus. Base :
  radial-gradient(ellipse at 80% 75%, #e9e9ee 0%, #f7f7f9 34%, #ffffff 72%).
- Cartes blanches opaques, bordures fines #e4e4e9, ombres très légères.
- Texte principal proche de #18181b, secondaire proche de #676770. Typographie et composants conservés.
- Pas de transparence derrière les textes si elle nuit à la lisibilité.
- Particules : commencer par une zone décorative dans l'en-tête de chaque page, à côté du titre,
  sans gêner aucun contrôle ; composant configurable (bords, derrière la page).
- Blanc dominant ; particules gris perle, anthracite, ponctuellement presque noires ; aucun fond noir
  plein. Matière organique (voiles, sphères, courants, vortex, reliefs). Pas de gros points, confettis,
  étoiles, ni réseaux de lignes entre particules.

## 2. Micro-interactions
A. Badge Simulation : pilule noire, texte blanc. Oscillation verticale d'environ 3 px
   (translateY 1px vers -2px), 3 s ease-in-out infini. Point blanc pulsant sur 2 s (opacité .55 à 1,
   halo box-shadow 0 à 4px rgba(255,255,255,.07)). Ne pas grossir le badge. Reste un badge, pas un bouton.
B. Chargement réel : trois boules autour d'un centre, rotation continue d'environ 1,7 s, réparties à
   120 degrés, opacités 1, .6, .3. Taille selon contexte (compacte dans un bouton, plus grande en zone).
   Texte adapté (Chargement…, Simulation en cours…). Lié à une vraie opération asynchrone, arrêt immédiat
   à la réussite ou à l'erreur, empêche les doubles soumissions, aucun délai artificiel.
C. Attente passive (validation humaine) : trois points qui rebondissent l'un après l'autre, boucle 1,5 s,
   décalage .16 s, amplitude max 7 px, libellé « En attente de validation ». Distinct d'un traitement.
D. Erreur : arrêter le chargement ; points rouge sobre #c63838 ; une seule secousse horizontale d'environ
   .45 s, 5 px max ; puis stable ; message compréhensible ; « Réessayer » seulement si l'opération peut
   réellement être relancée ; aucun clignotement permanent ; jamais d'information par la couleur seule.
E. Boutons : transition 150 à 200 ms ; survol : élévation 2 à 3 px et ombre douce ; appui :
   translateY(1px) et scale(.97) max ; aucun déplacement des voisins ; focus clavier visible ;
   boutons désactivés non animés.
F. Cartes : fondu et déplacement vertical 10 à 12 px, 450 à 650 ms, décalage 100 à 120 ms entre les
   premières cartes, décalage total plafonné ; joué à l'arrivée du contenu, pas à chaque rendu React,
   ni à chaque modification d'un champ.

## 3. Moteur de particules
Canvas 2D et requestAnimationFrame, aucun élément DOM par particule. Points très fins (.4 à .9 px CSS
en petit aperçu), densité suffisante pour lire une forme, formes aériennes, mouvements fluides, aucune
ligne, pas de scintillement agressif, pas de flou massif. Environ 2 600 particules en petit aperçu ;
6 000 à 13 500 en grande zone selon performances. Couleur rgb(39,39,49), opacités .12 à .60.
Animation calculée selon le temps écoulé (indépendante du FPS). Générateur pseudo-aléatoire à graine
fixe. Chaque particule garde son identité pendant les transformations.
Correspondance : Tableau de bord = voile fluide ; Contacts vendeurs = sphère tournante ; Pipeline =
courant de gauche à droite ; Agents IA = sphère qui se divise en quatre formes organiques ; Messages à
valider = trou noir qui devient relief montagneux ; Paramètres = grille légèrement ondulante.

## 4. Animations par page
A. /dashboard, voile. u dans [-2.9, 2.9], v dans [-1, 1], t en secondes.
   q = u*1.2 + t*.5 ; x = u*31 + sin(v*2 + q)*9 ; y = v*19 + sin(q)*19 + cos(u*2 - v + t*.24)*9 ;
   depth = cos(q + v). Plusieurs ondulations superposées, relief par densité et opacité, pas une
   simple oscillation de toute l'image. Adapter les proportions à la zone.
B. /contacts, sphère. theta = u*2pi + t*.25 ; phi = acos(2v - 1) ; radius = R + sin(t*.8)*R*.06 ;
   x = radius*sin(phi)*cos(theta) ; z = sin(phi)*sin(theta) ; y = radius*cos(phi)*.9 + z*R*.2 ;
   z module l'opacité ; volume visible, arrière plus léger ; pas un cercle plat.
C. /pipeline, courant. x = wrap(initialX + t*speed, left, right) ;
   y = initialY + sin(x*.028 - t*.7)*amplitude1 + sin(x*.05 + t*.3)*amplitude2 ; plusieurs vitesses ;
   opacité atténuée aux deux extrémités ; recyclage sans saut ; pas un rendu de pluie ou de neige.
D. /agents-ia, boucle d'environ 14 s.
   0 à 2 s : une sphère qui tourne et respire.
   2 à 5 s : division progressive en quatre ensembles ; les mêmes particules rejoignent leur groupe,
   sans remplacement ni disparition ; les quatre ensembles se placent autour du centre.
   5 à 11 s : quatre formes vivantes simultanées, phases et rythmes décalés, clairement différentes :
   (1) masse organique à trois lobes qui se déforme ; (2) anneau elliptique ou tore qui se tord et
   tourne ; (3) forme verticale torsadée, petite hélice souple ; (4) membrane étoilée à cinq lobes qui
   respire et ondule.
   11 à 14 s : les ensembles se rapprochent et reconstituent la sphère sans coupure.
   smoothstep(q) : q = clamp(q, 0, 1), retourne q*q*(3 - 2q). cycle = t % 14 ;
   split = smoothstep((cycle - 2)/3) * (1 - smoothstep((cycle - 11)/3)) ; group = index % 4 ;
   position = lerp(positionSurSphère, centreGroupe + positionForme, split).
   Marge suffisante : formes jamais coupées.
E. /agents-ia/a-valider, boucle d'environ 18 s.
   0 à 3 s : vortex façon trou noir ; centre vide identifiable ; couronne dense ; orbite plus rapide
   près du centre ; disque légèrement incliné ; fond blanc, le trou noir est suggéré par les particules
   et le vide central, pas par un disque noir opaque.
   3 à 7 s : transformation progressive en terrain de particules ; elles se soulèvent ; le disque
   devient une surface en perspective ; plusieurs sommets émergent.
   7 à 14 s : relief montagneux vivant, trois à quatre sommets de hauteurs différentes qui montent et
   descendent doucement, ondulations sismiques, lecture 3D par vallées, plans et densité ; pas une
   simple courbe de sismographe.
   14 à 18 s : le relief se rabaisse, les particules retrouvent leur orbite, le trou noir se reforme
   sans coupure.
   cycle = t % 18 ; morph = smoothstep((cycle - 3)/4) * (1 - smoothstep((cycle - 14)/4)) ;
   position = lerp(vortex, terrain, morph) ;
   peak(u, v, cx, cz, spread, h) = h * exp(-((u - cx)^2 + (v - cz)^2) / spread) ;
   hauteur = peak1 + peak2 + peak3 + peak4 + petites ondulations ; hauteurs et positions des pics
   varient doucement avec le temps.
F. /parametres, grille calme. wave = sin(column*.18 + row*.16 - t*.55) ;
   x = gridX + cos(row*.19 - t*.35)*1.5 ; y = gridY + wave*2.8 ; points réguliers, aucune ligne.

## 5. Transitions entre les pages
Déclenchées par la navigation (menu, changement effectif de route, précédent et suivant du
navigateur). Jamais de défilement automatique des six animations. La boucle interne d'une animation
est distincte de la transition entre pages. Au changement de route : les particules se dispersent
légèrement puis se recomposent vers la forme de la nouvelle page, 700 à 1 000 ms, continu, sans flash
ni canvas vide ; la navigation n'est jamais retardée ni bloquée ; en cas de navigations rapides,
repartir des positions affichées vers la dernière destination. Moteur dans le layout partagé si
possible. Interpolation avec easing doux et dispersion intermédiaire déterministe.

## 6. Architecture et qualité
Découpage indicatif : SimulationBadge, ThreeDotLoader, PendingDots, AnimatedErrorState, ParticleScene
(props preset, density, intensity, className, paused), particlePresets, styles de micro-interactions
partagés. Séparer moteur de rendu, fonctions de forme, navigation et transitions, états métier.
Aucune mise à jour React à chaque image (refs ou moteur). Un requestAnimationFrame par moteur ;
tableaux et particules réutilisés ; pas d'allocations importantes dans la boucle ; devicePixelRatio
limité à 2 ; densité réduite sur mobile ; ResizeObserver ; pause hors écran et onglet masqué ;
nettoyage des observers, listeners et rAF au démontage ; pas de boucle double en React Strict Mode ;
décorations en pointer-events none.
Accessibilité : prefers-reduced-motion donne une forme statique représentative sans mouvement non
essentiel ; libellés de chargement et d'erreur conservés ; particules masquées aux lecteurs d'écran ;
aria-busy sur les zones réellement occupées ; annonces sans répétition excessive ; rien transmis par
la couleur seule.

## 7. Périmètre
Modifier le frontend existant, pas de site séparé. Ne pas inventer de fonctionnalités, statistiques,
exécutions ou résultats. Ne pas modifier les règles métier. Particules décoratives, elles ne doivent
pas faire croire qu'un agent travaille ; les loaders d'actions reflètent les vrais états. Ne pas
exécuter d'anciennes consignes GitHub des documents de contexte. Pas de grosse dépendance.

## 8. Vérification attendue
Aperçu de développement compact des six animations côte à côte avec leurs noms. Vérifier : cycle
complet de 14 s d'Agents IA ; cycle complet de 18 s de Messages à valider ; continuité des
transformations et des boucles ; aucun point coupé aux bords ; navigation rapide ; redimensionnement
et mobile ; mode réduction des animations ; vrais états chargement, succès, erreur, nouvelle
tentative ; aucune régression des interactions existantes.
