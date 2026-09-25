# Plan — Finition premium (niveau de démonstration commerciale)

Date : 24/09/2026 — Branche locale : feat/ui-finish (depuis feat/particle-animations).
Statut : validé par l'utilisateur. Aucun push, aucune fusion, aucun déploiement avant sa
validation visuelle.

## Contraintes
- Aucune modification de règle métier, migration, RLS, donnée, contrat serveur ou garde-fou.
- Réutiliser composants et tokens existants ; améliorer, ne pas tout réécrire.
- Référence de niveau : Pulsor Agency. Ne copier ni textes, témoignages, assets, classes CSS,
  structure complète ni identité. Recréer les principes dans le design system Ascend.
- Aucune donnée, métrique, client, témoignage, tarif ou résultat inventé.
- Accessibilité AA, clavier, prefers-reduced-motion, tests Playwright en reducedMotion reduce.

## Décisions utilisateur (24/09/2026)
1. Hero public : illustration animée du parcours d'un prospect fictif
   (Léa → Hugo → Emma → validation humaine → Louis → Sarah → mandat), étiquetée
   « Exemple fictif — simulation ». Aucune activité prétendument en direct.
2. Agents IA : le dossier mis en avant est celui de la dernière exécution réellement
   enregistrée ; sinon état vide invitant à lancer un agent depuis une fiche contact.
3. Clôture anticipée d'un rendez-vous : autorisée uniquement après confirmation humaine
   explicite et motif obligatoire ; jamais automatique. **Tâche séparée, hors de ce lot
   visuel** (touche une règle métier ; une éventuelle migration sera soumise à autorisation).
4. Landing : le fond de particules abstraites est remplacé par un « fond vivant » illustratif
   (prospects fictifs = points, signaux entre agents, lignes qui se connectent, étapes qui
   s'activent, arrêt devant validation humaine, blocage = impulsion arrêtée, reprise, dossiers
   qui avancent, fragments d'interface discrets), variant par section (hero, problème,
   solution, agents, contrôle humain, résultat, CTA final). Étiqueté Simulation. Particules
   abstraites conservées dans /dev/particles et l'application connectée.
5. Application connectée : uniquement des étapes et exécutions réellement enregistrées.

## Direction artistique
Noir profond, blanc légèrement chaud, gris perle, accent bleu cobalt #2457FF réservé à :
étape active, signal, bouton principal, statut important, focus clavier, point de contrôle
humain. Contraste renforcé, bordures fines, ombres légères directionnelles, typographie
éditoriale, icônes linéaires, pas de gradient multicolore ni glassmorphism envahissant.

## Lot 1 (puis arrêt pour validation visuelle)
1. Système commun de boutons (principal : montée 1–2 px, lettres décalées ≤ 12 ms, double
   flèche qui s'échange, pression 1 px, 180–260 ms, halo de bordure cobalt suivant le curseur
   via --pointer-x/--pointer-y et rAF, magnétique 3–5 px souris précise seulement, jamais sur
   destructif/formulaire sensible, désactivé tactile et reduced motion ; secondaire ; liens ;
   cartes cliquables ; onglets FLIP à capsule active là où utile).
2. /agents-ia : niveau 1 situation immédiate (agents actifs, validations attendues, blocages,
   erreurs techniques) ; niveau 2 parcours sélectionné (dernier dossier réellement traité) ;
   niveau 3 détails repliés.
3. Rejeu d'une exécution + rail « réseau opérationnel » (Prospect → Léa → validation humaine →
   Hugo → Emma → validation humaine → Louis → rendez-vous → Sarah → mandat confirmé par un
   humain) : icône, nom, action, statut réel, durée mesurée ; états en attente, en cours,
   terminé, validation humaine nécessaire, bloqué par garde-fou, erreur technique ; aucun
   pourcentage ni durée fictive.
4. Hero public + fond vivant de la landing (révélation ligne puis mot, masque, flou court,
   contenu visible sans JS, reduced motion = état final ; étiquette inclinée
   « 5 AGENTS · CONTRÔLE HUMAIN » ; CTA noir + CTA clair ; preuves réelles uniquement).
Bouton de contact flottant : aucun canal réel configuré → non affiché.

## Lot 2 (après validation)
Tableau de bord, pipeline, contacts, messages à valider, relances, rendez-vous, tâches,
paramètres, estimation. Puis vérifications complètes, audit cybersecurite, build.

## Ajustements validés (24/09/2026, après le Lot 1)
Validés par l'utilisateur avant implémentation. Même branche, même règle : aucun push avant
validation visuelle. Aucune donnée, règle métier, migration ni dépendance modifiée.
Aucune copie de code, texte, asset ou mise en page d'un site tiers : seuls les mécanismes
d'interaction et de composition sont repris, recréés dans l'identité Ascend.

### A1. Rail « réseau opérationnel » plus lisible (/agents-ia et rejeu)
- Connexions entre les ronds plus visibles : traits plus épais et plus contrastés, ronds plus
  marqués, petits points relais le long de chaque trait (repères visuels uniquement : aucune
  connexion ajoutée entre agents qui ne se transmettent pas réellement le dossier).
- Réseau statique blanc/gris/noir. Bleu cobalt #2457FF réservé à : impulsions en mouvement,
  étape en cours, validation humaine qui attend réellement une action.
- Validation humaine reconnaissable par sa forme (double contour), pas par la couleur.
  Remplace la règle du Lot 1 « accent réservé au point de contrôle humain » pour le rail.
- Pas de lueur, pas d'effet néon. Statuts et durées : uniquement des données enregistrées.

### A2. Carrousel des agents sur la landing (section « agents »)
- Cartes façon « apps » dans un carrousel défilable : Léa → Hugo → Emma → validation humaine →
  Louis → Sarah → mandat confirmé par un humain. Les étapes humaines sont des cartes à part.
- Flèches/connecteurs entre les cartes pour montrer l'enchaînement.
- Clic sur une carte : panneau avec une scène illustrée de ce que fait l'agent, étiquetée
  « Exemple fictif — simulation ». Aucune activité réelle simulée.
- Scroll natif (scroll-snap), boutons précédent/suivant, clavier, tactile ; mouvement réduit =
  sans animation. Aucune librairie ajoutée.
- Impact sur le point 4 du Lot 1 : hero et fond vivant inchangés ; le parcours du hero reste un
  aperçu, le carrousel en est la version détaillée (même ordre, mêmes noms, textes alignés) ;
  le fond vivant est atténué derrière le carrousel pour la lisibilité.

### A3. Graphique « blocage administratif » (section « problème »)
- Courbe qui progresse puis plafonne ; zone d'alerte en pointillés = blocage administratif
  (relances manuelles, dossiers dispersés, doublons entre conseillers), pas une erreur technique.
- Titre proposé : « Ce n'est pas la prospection qui freine vos mandats. C'est l'administratif. »
- Aucun chiffre sur les axes (seulement « Temps » et « Mandats »), étiquette
  « Illustration — exemple fictif ». Tracé à l'apparition, statique en mouvement réduit,
  description textuelle pour les lecteurs d'écran. Esthétique Ascend.

## Refonte B (24/09/2026, validée)
Validée par l'utilisateur avant implémentation. Même branche (feat/ui-finish). Aucun changement
de base de données, migration, RLS, server action, query, règle métier ni garde-fou. Aucune
dépendance ajoutée. Aucun push avant validation visuelle.

### B1. Section agents en interface d'OS (remplace le rendu de A2, même contenu)
- Les 7 étapes, dans l'ordre (Léa → Hugo → Emma → Validation humaine → Louis → Sarah →
  Mandat), deviennent des **modules** d'une surface noire ; sélectionner un module
  « ouvre l'application » : la tuile grandit jusqu'à l'en-tête du panneau (FLIP fait main),
  puis la scène s'enchaîne dans une fenêtre blanche, toujours étiquetée « Exemple fictif —
  simulation ».
- Traitements différenciés : agents IA = tuiles d'app ; validation humaine = point de
  contrôle (cercle à double contour, le flux s'arrête devant) ; mandat = aboutissement,
  confirmé par un humain (cercle plein, bloc de conclusion « confirmé par le conseiller »).
- Presque plus de bordures ; état actif = plaque plus claire + tuile soulevée à fin anneau
  cobalt + mouvement du symbole + mission qui apparaît + flux allumé jusqu'au module.
- Navigation discrète « ← 04 / 07 → » ; défilement physique fait main (glisser à la souris
  avec inertie et arrêt sur un module, balayage tactile natif avec scroll-snap, molette
  horizontale native, clavier) ; un glissement ne sélectionne jamais. Mouvement réduit :
  état final immédiat.

### B2. Famille d'icônes sur mesure, alignée dans l'espace connecté
- Glyphes SVG dessinés à la main (grille 24, trait unique 1,75, extrémités arrondies) pour
  les agents et les étapes (prospect, validation humaine, rendez-vous, mandat), plus quelques
  symboles utilitaires des scènes ; tuile commune `AgentAppIcon` (formes : agent, humain,
  aboutissement, neutre ; états repos / actif / inactif).
- Espace connecté : rail « réseau opérationnel » d'un dossier et cartes des agents de
  /agents-ia utilisent la même famille ; icônes utilitaires Radix inchangées ailleurs.
  Page de contrôle /dev/icons (404 en production).

### B3. Graphique « blocage administratif » refait en scène de friction
- Réalisé par un autre agent, en parallèle (section « problème »).

### B4. Retouche claire des sections agents et problème
- Retouche du commit 03ff51f (24/09/2026, non documentée jusqu'ici) : sections « agents » et
  « problème » passées en direction artistique claire (plus de surface noire, le fond vivant
  reste visible entre les surfaces) et présence du réseau relevée à 1,35 dans ces deux scènes
  seulement (`RAISED_PRESENCE`, moitié du gain sur mobile) ; les autres scènes restent à 1.

## C1. Réseau vivant plus lisible (probleme et agents, validé 25/09/2026)
Validé par l'utilisateur (option B). Même branche. Aucune donnée, texte, section, dépendance
ni second moteur : le fond vivant existant (`components/landing/living/`) est étendu.
- **Portée** : scènes `probleme` et `agents` uniquement (`SceneSpec.mesh` = 1 ; 0 ailleurs).
  Hero, solution, contrôle, résultat et final dessinent exactement les mêmes appels qu'avant
  (empreintes figées dans `mesh.test.ts`). Rail /agents-ia et particules de l'espace connecté
  non touchés.
- **Trame** (`mesh.ts`) : chaque point ambiant est relié à 2 voisins (35 % à un 3ᵉ) et au
  nœud du chemin le plus proche (≤ 190 px), liens choisis une fois par scène et par taille
  d'écran depuis les positions de repos (cache, aucun calcul de voisins par image, aucun
  clignotement). Plafond : 150 liens en large, 30 en compact ; traits gris très fins dont
  l'opacité baisse avec la longueur courante et plafonnée à 0,08 par trait. Les dossiers
  fictifs circulent toujours sur le seul chemin des 8 étapes.
- **Nœuds et connexions principales** un peu plus présents (extension de `LIFT` :
  contour des étapes, pastille de l'étape active, liens `strong`).
- **Visibilité** mesurée (« encre » = opacité × surface, `canvas-recorder.test-helper.ts`) :
  +33 % (probleme) et +37 % (agents) par rapport au rendu d'avant, dans la fourchette
  [+30 %, +40 %] ; +15 % et +14 % sur mobile (moitié du gain).
- **Impulsions** : au plus 3 petites impulsions cobalt simultanées (1 sur mobile), une
  toutes les 7,5 s par emplacement, 2,8 s de trajet, le long de liens bien visibles de la
  trame. Cobalt réservé à ce qui bouge ou est actif : aucun lien de repos bleu. Aucune
  lueur, aucun `shadowBlur`, aucun dégradé.
- **Mouvement** : dérive lente des points (celle des prospects ambiants) ; deux plans
  (lointain : 45 % des points, plus pâles, plus petits, parallaxe × 0,4) ; parallaxe liée à
  la progression du défilement dans la section, lissée (0,25 s), ≤ 20 px (≤ 10 px sur
  mobile), appliquée à la trame seule, pondérée par le poids de trame. Mouvement réduit :
  aucune parallaxe, image statique comme avant.
- **Transitions** : poids de trame mélangé en smoothstep sur 1,6 s, comme la présence.
- **Performance** : mesurée 0,94 ms/image (probleme) et 0,62 ms/image (agents) à
  1440 × 900 en Chromium (`data-frame-ms`), budget < 4 ms vérifié par `e2e/accueil.spec.ts`.

## C2. Ajustement de composition (agents) et étiquettes dégagées (25/09/2026)
Même branche. Aucune donnée, texte, section ni dépendance ; présence, ALPHA, plafonds d'arêtes
et d'impulsions inchangés. Les 5 autres scènes restent identiques (empreintes).
- **Scène agents** : positions mesurées dans Chromium (`getBoundingClientRect`) à 1440 × 900,
  1280 × 800 et 1920 × 1080 pendant que la scène est active. Chemin en colonne quasi verticale
  à droite du titre, descendant entre les modules « Validation humaine » et « Louis » jusqu'au
  « Mandat » sous la rangée. Points de la trame placés dans les zones libres (`field`,
  répartition régulière) : à droite du titre, barre, sous l'introduction, interstices des
  modules, bande modules/fenêtre, marges. Cadre de référence 1440 × 900 centré sur grand écran.
- **Étiquettes dégagées** (`labels.ts`) : les traits de trame sont interrompus à 4 px d'une
  étiquette, les impulsions s'y effacent en fondu ; seul changement de la scène probleme.
- **Visibilité** : +37 % (agents, référence remesurée pour la nouvelle composition avec le
  rendu d'avant la trame) et +32 % (probleme) ; mobile +14 % / +15 %. Budget : 0,6–0,8 ms/image.
