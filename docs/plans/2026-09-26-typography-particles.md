# Typographie, titres courts et fond de particules — 26/09/2026

Branche `feat/typography-particles` (agent `frontend-ux`).

## Critère d'acceptation (fait foi)

En regardant chaque écran connecté 2 à 3 secondes, sans lire un paragraphe, on sait ce
qui se passe, où regarder et quelle action compte. « Le produit se comprend en regardant
l'écran avant de le lire. »

## Plan

1. **Typographie** — quatre rôles distincts (docs/design-system.md § 2.2) : titre Geist
   700–800, corps Inter 400–500, chiffre Geist Mono tabulaire (`.figure`), étiquette Inter
   en capitales espacées (`text-overline` / `.label`). `next/font/google` (build,
   auto-hébergé, `display: swap`), variables branchées sur les tokens `@theme`
   (`--font-sans`, `--font-display`, `--font-mono`). Aucune dépendance ajoutée.
2. **Titres courts** — 1 à 4 mots, sous-titre d'une ligne ou supprimé ; apostrophe `’`.
3. **Explications → information visuelle** — retirer les phrases que le chiffre, le badge,
   la frise ou le libellé disent déjà ; une action principale par écran, visible sans
   défiler à 1440 × 900. Mentions protégées intactes (simulation, consentement,
   désinscription, validation humaine, mandat confirmé par un humain, coupe-circuit,
   erreurs).
4. **Particules** — forme sur toute la fenêtre (trois classes), masque latéral supprimé,
   opacités .08–.35 → .10–.46 (+30 %), trois plans de profondeur (taille, opacité,
   dérive de parallaxe), déterministe, sans allocation par image, mouvement réduit figé.

## Résultat

- Typographie : `app/layout.tsx` (Inter, Geist, Geist Mono), `app/globals.css`
  (tokens, règle `h1–h4`, `.figure`, `.label`), `PageHeader` (Geist 800), `Card` et titres
  de section (Geist 700), chiffres clés en `.figure`.
- Textes : `components/texts.ts` — sous-titres redondants supprimés sur tableau de bord,
  contacts, fiche, pipeline, tâches, agents IA, messages à valider, paramètres ; les autres
  raccourcis à une ligne ; apostrophes typographiques dans l'espace connecté.
- Actions principales : « Valider les messages » (tableau de bord, avec le nombre exact),
  « Ouvrir le suivi » (rendez-vous) ; coupe-circuit remonté en tête des paramètres.
- Particules : `engine/depth.ts` (plans), `engine/project.ts` (décalage par plan),
  `engine/renderer.ts` (taille et opacité par plan, plage .10–.46),
  `ParticleEngine.ts` (câblage, marge de parallaxe), `background-layout.ts` (région pleine),
  `.app-particles` supprimé. Coût mesuré : 1,1–1,7 ms par image à 1440 × 900, 0,4–0,7 ms
  à 390 px.
- Tests : `components/motion/engine/depth.test.ts` (nouveau), tests de particules mis à
  jour (valeurs de la spécification), `e2e/premier-regard.spec.ts` (nouveau),
  `e2e/particules.spec.ts` (fond plein écran, sans masque, matière dans les trois tiers).

## Compromis

- La visibilité supplémentaire des particules se voit surtout dans les marges et
  interstices : les cartes restent opaques par règle de lisibilité.
- Le contraste AA des textes hors carte repose sur `.particle-veil` ; la mesure sur
  captures du 23/09 n'a pas été refaite pixel par pixel.
- Les messages renvoyés par le serveur (`lib/`, actions) gardent l'apostrophe droite.
