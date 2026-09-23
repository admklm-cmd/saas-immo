# Particules et micro-interactions — brief utilisateur

Périmètre : frontend existant, aucune modification métier, base, provider ou dépendance.

1. Moteur Canvas 2D déterministe : voile, sphère, courant, sphère/quatre formes,
   vortex/terrain, grille. Conservation des positions pour les transitions interrompues.
2. Intégration dans le layout connecté, près des en-têtes ; repli en bandeau mobile.
3. Badge Simulation, chargement réel des boutons, attente humaine, erreur unique,
   survol/pression et apparition des cartes. Aucun délai artificiel.
4. Galerie de développement /dev/particles, absente en production.
5. Vérification des cycles complets, navigation, mobile, mouvement réduit, tests
   des formes et des composants affectés, typecheck et lint.

Le brief ne prévoit aucune forme pour la landing publique `/` : elle n'est pas modifiée.
Les six animations sont décoratives ; le rejeu mesuré existant reste indépendant.
Les tests de base et Playwright existants réinitialisent les données : ne pas les lancer
pendant la visite utilisateur ou en concurrence avec la livraison Claude.
