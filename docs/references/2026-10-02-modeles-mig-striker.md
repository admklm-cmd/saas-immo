# Modèles fournis par l'utilisateur — 02/10/2026

Trois compositions de sites tiers (MIG, Striker) à reproduire **à environ 90 %** (composition, rythme,
mouvement), **adaptées à Ascend Strategy** et à sa direction artistique (noir, blanc, gris, accent
cobalt, nos icônes `components/icons/`). On ne reprend **ni leur code, ni leurs images, ni leurs
textes**, et on ne charge **rien** depuis leurs serveurs. Aucune photo de personne réelle, aucun
chiffre inventé présenté comme réel : tout exemple porte « Exemple fictif » / badge « Simulation ».

## Règles de l'utilisateur (02/10)

- **Effets de titre : ne jamais répéter un effet.** Chaque effet de titre n'apparaît qu'une fois sur `/`.
  Les autres titres n'ont pas d'effet. Le titre du panneau final (« fictive ») : **aucun effet**, centré.
- Varier : l'effet de l'ancien mot « Ascend » (TechText : lettres en contour pointillé, cadre cobalt à
  poignées + étiquette mono, specks, lettre qu'on peut tirer) revient comme **effet d'un seul titre**.
- Les animations vont **seulement** dans les trois blocs ci-dessous. « Pas besoin de plus. »
- Blocs A, B, C : **fluides**. Le bloc A est **en boucle** (demande explicite de l'utilisateur).

## A. Remplace « Parcours d'un prospect fictif » (`HeroJourney`) — modèle MIG « écosystème »

Structure du modèle :
- Rangée horizontale de **cartes** blanches arrondies (rayon ≈ 24 px, ombre douce, bord très léger),
  largeurs automatiques, espacement 16 px, **centrée** ; les cartes ont des hauteurs différentes et sont
  **décalées verticalement** (rythme irrégulier) ; sur la gauche une colonne de 2 cartes empilées.
  Les cartes au bord sont coupées par le cadre (effet de débordement doux).
- Chaque carte : en-tête = **tuile d'icône colorée** (petit carré arrondi) + titre en 500 + à droite une
  pastille « Choisir » avec une case. Dessous, liste de **lignes** (pilule bordée) : petite icône grise
  + libellé + **case à cocher** à droite. Certaines cases sont cochées (case noire avec coche blanche).
- Un **curseur** (flèche cobalt) avec une **étiquette « Vous »** se déplace de case en case et coche
  (animation FLIP fluide de la case vers sa nouvelle position).
- Sous les cartes : **lignes courbes très fines** (opacité ≈ 6 %) qui partent du bas des cartes et
  **convergent** vers un **bouton CTA** centré, puis une petite carte de texte sous le bouton
  (« … vous avez la possibilité de **choisir** uniquement … » avec 2 mots en encre foncée).
- Mobile : carrousel horizontal (swiper) avec pagination à points.

Adaptation Ascend : une carte par agent (Léa · Acquisition, Hugo · Qualification, Emma · Relation,
Louis · Rendez-vous, Sarah · Suivi) avec **nos icônes** ; les lignes = les tâches de l'agent
(ex. Léa : Source vérifiée, Doublon écarté, Fiche créée). Le curseur « Vous » = le conseiller : il
coche **les étapes humaines** (valider le premier message, confirmer le mandat) — jamais un agent ne
« coche » une validation humaine. Bouton : « Demander une estimation ». Texte : garde-fou humain.
**Boucle** : pause hors écran et onglet caché ; mouvement réduit = image fixe, état final.
Badge « Simulation » + « Exemple fictif » toujours visibles.

## B. Remplace les 7 cartes de « La solution » (`LandingSolution`) — modèle grille « partenaire »

Structure du modèle : grille **3 colonnes**, tuiles blanches arrondies (≈ 24 px) bordées, chacune
= **visuel** en haut (dans un cadre) + en dessous **icône + titre en 500** + paragraphe gris court.
- Col. 1 (haute) : **feuille de route** — cartes d'étape (rond d'icône + pastille « 01 Audit »)
  disposées en zigzag gauche/droite, reliées par un **sentier pointillé** courbe ; l'étape 03 est
  grisée / en pointillés (pas encore atteinte) ; la dernière est coupée en bas (fondu).
- Col. 2 haut : **carte graphique** (« Progression – … », courbe montante fine avec aire en dégradé).
- Col. 2 bas : **équipe** — 3 cartes portrait, celle du centre plus grande et nette, les côtés atténués,
  avec étiquettes nom + rôle.
- Col. 3 haut : **rapport** (feuille avec lignes pointillées en grilles de points) + carte superposée
  « Enregistrement » avec point rouge.
- Col. 3 bas : **carte chiffres** (deux grands nombres, séparateur, deux lignes libellé/valeur).

Adaptation Ascend (5 tuiles, aucune donnée inventée) : 1. Le chemin du dossier (nos étapes, la
validation humaine grisée « en attente ») ; 2. le pipeline d'un dossier fictif (courbe Nouveau →
Mandat signé, « Exemple fictif ») ; 3. l'équipe = nos 5 agents (icônes, **pas de photos**) autour de
« Vous · Conseiller » ; 4. l'historique / compte-rendu de Sarah (étiquette « Simulation » au lieu de
« Enregistrement », **pas de point rouge** — aucun rouge dans la DA) ; 5. les garde-fous (règles
réelles du produit : envois réels 0, validation humaine au premier contact et au mandat, coupe-circuit
en 1 clic). Animations fluides à l'arrivée (pas de boucle imposée).

## C. Remplace le panneau final « Déposez une demande fictive » (`LandingFinal`) — modèle Striker « processus »

Capture : capture fournie par l’utilisateur (hors dépôt).
Structure du modèle : section **sombre** (grand panneau quasi noir arrondi), **titre centré** sur
2 lignes, paragraphe centré court, **bouton clair centré** avec petite flèche ↗ dans un carré ;
puis **flèches précédent/suivant** (pilules) centrées ; **fond à grille de lignes fines** (colonnes
et rangées) ; **carrousel horizontal** de cartes (≈ 380 px, espacement 4 px, carte active centrée,
voisines atténuées/floues) : chaque carte = pastille « ÉTAPE N°1 » + **visuel animé** (ex. radar qui
balaie avec étiquette « Recherche de faille… » et cibles) + icône + titre + paragraphe gris ;
en bas **barre de progression** + pourcentage.

Adaptation Ascend : titre = le titre final actuel (« Déposez une demande fictive. Retrouvez-la dans
l'espace agence. »), **centré, sans effet** ; boutons actuels (Demander une estimation / Espace agence)
et note prototype conservés. Cartes = les 7 étapes (Demande reçue · Léa, Qualification · Hugo,
Relance préparée · Emma, Validation humaine · Conseiller, Rendez-vous · Louis, Suivi · Sarah,
Mandat · Conseiller), visuels animés propres à chaque étape (ex. Léa : balayage « Vérification de
la source… »). Palette : noir / blanc / gris + cobalt, **pas de rouge**. Accessible au clavier
(flèches = boutons), pas de défilement automatique bloquant, mouvement réduit = cartes statiques.

## Retours de l'utilisateur après son audit (03/10)

1. **Bloc A (cartes des agents, haut de page)** : « parfait », mais **trop bordélique** → le rendre **ordonné** : cartes alignées sur une même ligne de base, hauteurs régulières, plus de décalages verticaux irréguliers ; coches dans l'ordre du parcours (carte par carte, gauche → droite) ; trajet du curseur « Vous » simple et lisible. La boucle reste.
2. **Bloc B (« Chaque dossier suit le même chemin »)** : « parfait », mais **enlever le texte** des tuiles (titre + paragraphe sous chaque visuel) : **illustrations seules**. Le titre de section reste.
3. **Section contrôle (« L'IA prépare. Votre équipe décide. »)** : titre **centré** (pas à gauche). Garde l'effet TechText sur « décide ».
4. **Section contrôle, sous le titre** : la grille de 6 cartes texte est **remplacée** par deux tuiles animées, modèle MIG « expert » (grille 2 colonnes, tuiles blanches arrondies ≈ 24 px, ombre douce, visuel en haut, légende en dessous : titre en 500 + paragraphe gris court ; séparateurs fins entre colonnes ; sur-titre « // FLUIDE ET EFFICACE // » centré au-dessus dans le modèle).
   - **Tuile 1 — organigramme** (modèle « Libérez-vous de votre charge mentale ») : à gauche un avatar rond « Vous » avec **badge vérifié**, une ligne horizontale vers un nœud central (« Chef de projet » avec photo dans le modèle), puis un **arbre de lignes fines** (opacité ≈ 15 %, coins arrondis) qui se divise vers une colonne de rôles à droite, chacun = **pastille ronde blanche avec icône** + libellé. Animation : apparition en cascade (avatars, ligne qui se trace, branches, puis rôles un par un, léger glissement + fondu/flou).
     Adaptation : « Vous · Conseiller » (badge vérifié cobalt), nœud central = l'espace agence / Ascend (pas de photo), 5 rôles = Léa, Hugo, Emma, Louis, Sarah avec **nos icônes**. Légende : les agents préparent, vous gardez la main.
   - **Tuile 2 — frise multi-pistes** (modèle « Montage multi-format ») : en haut un aperçu (image vidéo dans le modèle — **chez nous : pas d'image**, une mini-fiche de dossier fictif), graduation horizontale (0s…18s → **J0…J9** chez nous), pistes de **blocs gris arrondis** de longueurs variées, une **tête de lecture verticale** avec petit triangle qui avance, des **curseurs étiquetés** (pastille + flèche) qui se déplacent (chez nous : « Léa », « Emma », « Vous »), un bloc **en pointillé coloré** (orange dans le modèle → **cobalt** chez nous) = **validation humaine en attente**.
   - **Garde-fous** : les 6 faits retirés (premier contact validé, mandat confirmé par un humain, consentement vérifié par canal, coupe-circuit, arrêt des relances sur refus/reprise en main, information manquante signalée) **doivent rester visibles** autrement (étiquettes dans la frise, légendes) — règle produit « un écran plus épuré ne justifie jamais la disparition d'un garde-fou ».
   - Badge « Simulation » / « Exemple fictif ». Aucune photo, aucune image ni code du modèle, pas d'orange ni de rouge. Animations à l'arrivée ; la frise peut boucler doucement **seulement si** la spec l'assume (pause hors écran, mouvement réduit = état final) — sinon une fois.
