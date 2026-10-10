# Rétrospective du prototype — 04/10/2026

Bilan honnête après ~3 semaines et 75 commits, rédigé par l'orchestrateur. But : savoir ce qui marche, ce qui est trop lourd, et ce qu'on change dans la façon de travailler.

## Chiffres (fichiers suivis par git)

| Partie | Fichiers | Lignes |
|---|---|---|
| `features/` (logique métier, agents IA, CRM) | 288 | ~44 400 |
| `components/` (interface, landing) | 260 | ~33 800 |
| `lib/` (Supabase, sécurité, intégrations) | 61 | ~7 600 |
| `app/` (pages, routes) | 68 | ~5 000 |
| `e2e/` (parcours Playwright) | 46 | ~9 900 |
| `supabase/migrations/` | 15 | ~2 900 |

183 fichiers de tests unitaires/intégration, 38 parcours E2E. Une grande partie des lignes de `features/` et `components/` sont des tests placés à côté du code (règle du projet).

## Côté serveur (features, lib, base)

**Ce qui marche**
- Démo de bout en bout : estimation → Léa → Hugo → Louis → Emma → RDV → Sarah → mandat signé confirmé par un humain.
- Isolation entre agences assurée par RLS (14 tables) et testée avec deux agences fictives.
- Garde-fous produit vérifiés côté serveur (consentement, premier contact humain, mandat humain, coupe-circuit, arrêt des relances).
- Agents IA sur simulateur, fournisseur interchangeable (`lib/claude/`), aucun appel payant.

**Ce qui est lourd**
- Les tests d'intégration saturent la base locale quand tout tourne en parallèle (dépassements de délai) → les lancer en série.
- Les tests d'intégration dépendent de Docker/Supabase local : quand ils sont éteints, une partie de la validation manque.
- Nettoyage du code mort côté serveur pas encore fait (à faire avec la base démarrée).

## Côté interface (components, app)

**Ce qui marche**
- CRM complet et cohérent, design noir et blanc, accessibilité vérifiée par tests.
- Page d'accueil riche : réseau 3D, effets de titre uniques, blocs animés, ROI sourcé.

**Ce qui est lourd**
- La page d'accueil a été refaite 5 fois en 3 jours : beaucoup de code et de documentation ont été écrits puis remplacés. Le nettoyage du 04/10 retire ces restes.
- Les animations ont fait grossir le CSS (~10 000 lignes) et les tests E2E (mesures au pixel, au milliseconde) : précis, mais longs (~17 min la suite complète) et parfois sensibles à la charge de la machine.
- `docs/design-system.md` mélangeait règles et historique (~3 700 lignes) → allégé et archivé le 04/10.

## Tests

**Ce qui marche** : la règle « résultat réel uniquement » a tenu ; chaque lot a été validé par tsc, lint, Vitest et Playwright ; plusieurs vrais bugs ont été attrapés (débordement du voile, contraste, sélecteurs ambigus).

**Ce qui est lourd** : la suite E2E complète prend ~15–17 min et dépend de la base locale ; quelques tests de mesure d'animation sont fragiles sous charge.

## Sécurité

- Aucun problème critique ou élevé ouvert. Aucun secret dans l'historique git.
- À faire avant le VPS : CSP avec nonce, limitation de débit (frontale et `/connexion`), HTTPS, sauvegardes, validation juridique (démarchage, RGPD, publicité — notamment la section ROI).
- 5 vulnérabilités dans les outils de lint seulement (pas en production), sans correctif publié : à surveiller, ne pas forcer.
- Détails : `docs/security.md`.

## Ce qu'on change dans la façon de travailler

1. **Fusionner régulièrement dans `main`.** Six branches enchaînées sans fusion ont rendu `main` presque vide : impossible de faire une revue globale (`/ultrareview` refuse 124 000 lignes). Ouvrir et fusionner les pull requests après chaque audit de l'utilisateur.
2. **Valider le visuel sur des maquettes avant de coder** quand la direction n'est pas claire, pour éviter de refaire la même section plusieurs fois.
3. **Démarrer Docker/Supabase en début de session** pour que les tests d'intégration tournent à chaque lot.
4. **Lancer les tests d'intégration en série**, et regrouper les tests E2E de mesure fine dans un lot à part pour accélérer les vérifications courantes.
5. **Tenir la documentation courte** : règles en vigueur dans `docs/`, historique dans `docs/archive/`.
6. **Prochaine étape** : nettoyage du code serveur (base démarrée), puis refonte du fond de la landing avec l'utilisateur, puis les pages de l'espace agence.
