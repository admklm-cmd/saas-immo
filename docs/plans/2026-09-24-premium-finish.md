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
