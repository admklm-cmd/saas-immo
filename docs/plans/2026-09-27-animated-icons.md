# Icônes animées — une seule famille (27/09/2026)

Branche `feat/animated-icons`. Référence : `docs/references/icons/planche-1-noir-cobalt.png`
(style), `planche-2-tuiles-verre.png` (tuile de la grande variante). Règles : design-system § 2.8.

## Décisions validées par l'utilisateur

- Petite variante (12–24 px) : encre pleine + un accent cobalt ; histoire jouée une fois (survol,
  focus du contrôle parent, ou `animate`) ; jamais de boucle.
- Grande variante (48–96 px) : même dessin dans une tuile de verre givré ; dégradé #6366F1 → #A78BFA
  sur l'accent seul ; boucle douce autorisée mais bornée (WCAG 2.2.2).
- Rouge réservé à l'alerte, toujours à côté d'un texte.
- SVG faits main + CSS (transform / opacity), aucune dépendance ; `@radix-ui/react-icons` retiré.

## Choix d'implémentation

1. `components/icons/` : `Icon.tsx` (composant unique, serveur-compatible), `icons.ts` (registre),
   `definitions/` (4 fichiers), `shapes.tsx` (briques communes), `icons.css` (peinture, tuile,
   déclencheurs, mouvement réduit), `icon-stories.css` (histoire de chaque icône, en données).
2. CSS global scopé par attributs plutôt que CSS module : les noms d'images clés passent par des
   propriétés personnalisées (`--story`), que les modules renommeraient.
3. Grande variante : histoire à l'arrivée puis deux respirations de l'accent, fin < 5 s. Retenu
   plutôt que « boucle tant que visible » : aucun JavaScript, aucune boucle infinie.
4. `AgentAppIcon` garde son langage de formes (qui agit) ; son symbole devient une petite icône.
5. Emplacements de la grande variante : en-tête des 7 écrans principaux (masquée sous 640 px),
   cartes des agents, états vides. Nulle part ailleurs.

## Critères de réussite

- Les 24 icônes de la planche + 5 agents + étapes + signes rendus par `Icon`, un seul accent chacune.
- Aucun import de `Glyph`, `glyphs` ni Radix restant ; `tsc`, `lint`, `vitest`, Playwright verts.
- `e2e/icones.spec.ts` : galerie complète (2 variantes), aucune animation sous mouvement réduit,
  aucune animation infinie, tout au repos en moins de 5 s.
