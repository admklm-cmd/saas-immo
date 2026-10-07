# Directives pour Gemini — Ascend Strategy

Utilise ce document comme brief avant toute proposition de design ou de code. Lis ensuite `CLAUDE.md`, `docs/PRD.md`, `docs/design-system.md`, `docs/product.md` et `docs/workflows.md`. Le dépôt existant est la source de vérité ; ne remplace pas une règle métier par une invention visuelle.

## Ta mission

Améliorer la finition du frontend existant sans modifier le fonctionnement métier. Le résultat doit montrer comment une agence immobilière travaille et comment Ascend Strategy coordonne les étapes, plutôt que produire une landing abstraite sur « l’IA ».

## Structure de l’agence à représenter

- **Direction** : supervise l’équipe, le pipeline, les limites et le coupe-circuit.
- **Conseiller** : reste responsable du client, relit le premier message, confirme les rendez-vous et le mandat.
- **Léa** : acquisition et dédoublonnage.
- **Hugo** : qualification du projet.
- **Emma** : préparation des relances.
- **Louis** : proposition de rendez-vous.
- **Sarah** : suivi après estimation.

La hiérarchie visuelle doit toujours placer l’humain comme décideur. Les agents sont des applications spécialisées coordonnées autour de lui.

## Workflow obligatoire à raconter

```text
Demande d’estimation
→ Léa vérifie la source et dédoublonne
→ Hugo structure le projet et signale les manques
→ Emma prépare le message
→ le conseiller valide le premier contact
→ Louis propose un créneau libre
→ le conseiller confirme et clôture le rendez-vous
→ Sarah prépare le suivi
→ le conseiller confirme le mandat
→ le tableau de bord reflète le résultat
```

## Direction visuelle

- Noir, blanc, gris perle ; cobalt uniquement pour le signal, le focus, le curseur humain et l’action importante.
- Typographie chargée dans le dépôt : Bricolage Grotesque pour les titres, Geist pour le texte et l’interface, Geist Mono pour les chiffres.
- Ne jamais référencer une police qui n’est pas réellement chargée.
- Grand espace, grille éditoriale, traits fins mais visibles, surfaces nettes, ombres rares.
- Hero centré dans la partie haute ; titre contenu, jamais envahissant ; espace libre ensuite pour voir l’illustration.
- Univers visuel : transfert, coordination, matière pointilliste, poussière numérique, nanoparticules mobiles.
- Éviter : cerveau, neurones, robot humanoïde, néon, orbite 3D générique, dégradé violet SaaS, cartes flottantes sans logique.

## Mouvement

- Anime.js 4.5.0 est déjà installé et figé.
- Utiliser Anime.js pour la dérive organique des nanoparticules et les mouvements continus maîtrisés.
- Animer uniquement `transform` et `opacity` pour les éléments décoratifs.
- Chaque particule suit une trajectoire lente légèrement différente ; aucun tremblement uniforme.
- L’illustration centrale respire à peine ; les particules proches bougent davantage que les lointaines.
- Les traits Acquisition → Validation humaine → Suivi doivent être perceptibles et montrer la convergence.
- Les animations métier racontent une action réelle du workflow ; elles ne décorent pas un écran vide.
- Sous `prefers-reduced-motion`, afficher immédiatement une composition statique complète.

## Contenu et sécurité

- Données fictives uniquement.
- Aucune statistique, aucun témoignage, aucun prix et aucun résultat inventé.
- Ne jamais laisser penser qu’un message a été envoyé dans le prototype.
- Le premier contact et le mandat signé restent humains.
- Une information manquante est affichée comme manquante.
- Ne modifie pas les migrations existantes, la RLS, les actions serveur ou les garde-fous sans une mission backend distincte.

## Méthode attendue

1. Auditer l’écran et nommer le problème précis.
2. Proposer une intention visuelle reliée au workflow d’agence.
3. Lister les fichiers touchés et les critères d’acceptation.
4. Implémenter avec les composants et tokens existants.
5. Vérifier 1440 px, 1024 px, 390 px et mouvement réduit.
6. Exécuter typecheck, lint, tests pertinents et build.
7. Montrer le rendu, puis documenter le changement.

## Critère final

Un dirigeant d’agence doit comprendre en quelques secondes : où entre la demande, ce que font les agents, où l’humain décide, et quelle prochaine action fait avancer le dossier. Si l’effet visuel n’aide pas cette compréhension, retire-le.

