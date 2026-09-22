# Contexte de reprise — AiaA

Dernière mise à jour : 22 septembre 2026.

Ce document est destiné à l’agent qui reprend le développement. Lire d’abord `AGENTS.md`, puis
`CLAUDE.md` et les documents pertinents dans `docs/`. Ne lire aucun fichier `.env` et ne lancer
aucun fournisseur IA payant. Le produit fonctionne encore avec le simulateur.

## 1. Objectif utilisateur

Construire une démonstration fonctionnelle et haut de gamme d’un SaaS pour agences immobilières
indépendantes. Le parcours principal validé est :

1. un prospect transmet une demande ;
2. Léa vérifie la source, dédoublonne et crée ou rattache la fiche ;
3. un humain valide le premier message ;
4. Hugo qualifie le projet ;
5. Emma prépare une relance ;
6. Louis propose un rendez-vous ;
7. un humain confirme puis clôture le rendez-vous avec un compte-rendu ;
8. Sarah exploite le compte-rendu jusqu’au mandat, sans jamais signer à la place de l’humain.

Priorités données par l’utilisateur : sécurité, qualité visuelle type Apple/Pulsor, démonstration
réellement fonctionnelle, commits à chaque jalon majeur, puis poursuite autonome. Toute communication
externe reste simulée.

## 2. Dépôts et état Git

### Dépôt de travail commitable — source canonique actuelle

`C:\Users\admha\Documents\Codex\2026-09-18\fa\saas-immo-work-local2`

- Branche : `feat/agents-et-ecrans`
- HEAD : `7523683 feat: redesign public landing around agent journey`
- Remote : `https://github.com/admklm-cmd/saas-immo.git`
- État distant : branche locale en avance de 5 commits sur `origin/feat/agents-et-ecrans`.
- Le push a échoué auparavant avec `SEC_E_NO_CREDENTIALS` ; `gh` n’est pas installé.
- `node_modules` est une jonction vers le dépôt original. Avec ce clone, utiliser Webpack pour le
  build et le serveur (`npm run build -- --webpack`, `npm run dev -- --webpack`). Turbopack refuse
  la dépendance externe liée.

Commits créés pendant la reprise :

1. `4ee0e4a feat: complete Lea inbox and secure agent workflows`
2. `622ac81 feat: add accessible motion foundation`
3. `7a4a4fc chore: add portable agent development harness`
4. `6e7433d feat: complete human appointment follow-through with Sarah`
5. `7523683 feat: redesign public landing around agent journey`

### Dépôt original ouvert habituellement dans VS Code

`C:\Users\admha\mon-saas\saas-immo`

Les fichiers y ont été synchronisés et vérifiés par SHA-256 jusqu’au commit de landing `7523683`,
mais son dossier `.git` était protégé par le sandbox. Sa branche affiche encore `86e6b6f` et ses
changements apparaissent donc non commités. Ne supprimer ni écraser ce dossier. La bonne méthode de
réconciliation est :

1. vérifier que l’arbre de travail original correspond au clone ;
2. obtenir une autorisation d’écriture sur le `.git` original ;
3. `git fetch` depuis le clone local ;
4. indexer l’arbre et comparer `git write-tree` au tree du commit cible ;
5. déplacer la référence uniquement si les deux trees sont identiques.

L’autorisation de fichiers accordée précédemment n’a pas suffi : Git recevait toujours
`Permission denied` sur `.git/FETCH_HEAD` et `.git/index.lock`.

## 3. Fonctionnalités terminées et commitables

### Léa et file de validation

- `/agents-ia/leads-entrants` : demandes brutes, texte non fiable rendu en texte brut, dédoublonnage,
  création/rattachement de fiche, tâche de consentement et rejeu mesuré.
- `/agents-ia/a-valider` : correction, validation, refus motivé, puis envoi simulé explicite.
- Garde-fous serveur et base : agence, session, consentement, coupe-circuit, quota, reprise humaine,
  idempotence et séparation des données entre agences.

### Hugo, Louis et Sarah

- Hugo et Louis sont lançables depuis la fiche contact.
- `/agents-ia/suivi-rendez-vous` fournit le pont humain complet : confirmation du créneau proposé,
  compte-rendu obligatoire, clôture du rendez-vous, puis lancement de Sarah.
- Sarah ne remplace jamais un état humain concurrent (`mandat_signe` ou `perdu`).
- Suppression directe d’un rendez-vous interdite aux membres ; la cascade RGPD depuis la suppression
  du contact par un directeur reste possible.
- Dette moyenne documentée : les écritures multiples de Sarah ne sont pas encore regroupées dans une
  RPC transactionnelle.

### Animations et design

- Fondations livrées : `animate-rise-soft`, `animate-settle`, `.stagger`, composant `Reveal`, gestion
  de `prefers-reduced-motion`, galerie `/dev/animations` inaccessible en production.
- Landing publique redesignée à partir de l’esprit éditorial de Pulsor : grand titre, preuves,
  parcours Léa → Hugo → Emma → Louis → Sarah, contrôle humain, CTA estimation et connexion.
- Contrôle visuel manuel effectué sur la landing : hiérarchie et défilement corrects.

## 4. Travail non commité en cours

L’arbre du clone compile actuellement (`npm run typecheck` réussi le 22/09/2026), mais les éléments
suivants ne sont pas encore terminés ni commités.

### 4.1 Écran de relances Emma

Fichiers nouveaux ou modifiés :

- `app/(app)/agents-ia/relances/page.tsx`
- `app/(app)/agents-ia/relances/loading.tsx`
- `features/agents-ia/components/EmmaFollowUpCard.tsx`
- `features/agents-ia/components/EmmaFollowUpCard.test.tsx`
- `features/agents-ia/types.ts`
- `features/agents-ia/data.ts`
- `features/agents-ia/queries.ts`
- `components/app/AppNav.tsx`
- `components/texts.ts`
- `docs/product.md`

Déjà fait : route, entrée de navigation, cartes, bouton qui appelle `prepareFollowUp`, résultat en
texte brut, badge Simulation, rappel « rien envoyé », liens vers la validation et le rejeu, loading,
état vide/erreur et trois tests unitaires du composant.

Une lecture serveur spécialisée vient d’être ajoutée : `listEmmaFollowUpCandidates` et
`getEmmaFollowUpCandidates`. Elle limite les dossiers aux étapes ouvertes, lit les consentements
courants et les brouillons Emma en attente, puis calcule un état informatif. **Elle n’est pas encore
branchée dans la page**, qui utilise encore `getContacts()`. `EmmaFollowUpCard` utilise encore
`ContactListItem` au lieu de `EmmaFollowUpCandidateView`.

À terminer :

1. brancher `getEmmaFollowUpCandidates()` dans la page ;
2. adapter `EmmaFollowUpCard` et son test à `EmmaFollowUpCandidateView` ;
3. désactiver visuellement l’action pour les dossiers bloqués tout en gardant le serveur autoritaire ;
4. ajouter « Lancer Emma » dans `features/contacts/components/AgentActionsPanel.tsx` ;
5. ajouter tests de query/isolation et `e2e/relances.spec.ts` ;
6. mettre à jour `docs/workflows.md` et `docs/architecture.md` si nécessaire ;
7. lancer lint, tests, build et revue sécurité ;
8. commit suggéré : `feat: add Emma follow-up workspace`.

Attention produit : aucune cadence de relance n’est définie. Ne jamais afficher qu’une relance est
« due ». Le MVP est déclenché manuellement ; le serveur choisit le canal et revérifie consentement,
doublon, quota, coupe-circuit et reprise humaine au clic.

### 4.2 Prototype d’animation fourni par l’utilisateur

Référence utilisateur : `D:\Telechargements\agent_process_motion (1).html`.

Fichiers ajoutés/modifiés :

- `app/dev/animations/AgentProcessMotionPrototype.tsx`
- `app/dev/animations/AgentProcessMotionPrototype.module.css`
- `app/dev/animations/AnimationGallery.tsx`

Demande exacte : tester et montrer le rendu avant de l’intégrer dans les écrans réels. Le prototype
reprend la carte extensible et place le processus sur un fond pointillé basé sur :

```css
background-color: #fff;
background-image: radial-gradient(circle, #b5b5b5 1.5px, transparent 2px);
background-size: 60px 60px;
background-position: 14px 20px;
```

Améliorations réalisées : fond responsive, cinq étapes métier AiaA alternées autour d’une ligne,
signal traversant, activité discrète, version mobile verticale et arrêt des animations avec
`prefers-reduced-motion`.

Le prototype est visible sur `http://127.0.0.1:3201/dev/animations` lorsque le serveur clone tourne.
Il a été ouvert et contrôlé visuellement dans le navigateur. **Ne pas l’intégrer dans
`AgentRunReplay` avant validation explicite du rendu par l’utilisateur.** Le fond pointillé doit rester
derrière la partie processus, pas devenir le fond global du produit.

## 5. Tests réellement exécutés

Avant le travail non commité actuel :

- suite Vitest complète dans le dépôt original : **65 fichiers, 778 tests réussis** ;
- intégrations ciblées : **183 tests réussis** ;
- suite unitaire après la landing : **52 fichiers, 455 tests réussis** ;
- `npm run typecheck` : réussi ;
- `npm run lint` : réussi ;
- `npm run build -- --webpack` : réussi ;
- tests ciblés de la landing : réussis.

Travail courant :

- `EmmaFollowUpCard.test.tsx` + garde de la galerie : **2 fichiers, 4 tests réussis** ;
- `npm run typecheck` après l’ajout de la query Emma : **réussi le 22/09/2026** ;
- lint a réussi avant les derniers ajouts de query ; il doit être relancé ;
- aucun build complet n’a encore été relancé sur Emma + prototype.

Playwright : la préparation des fixtures fonctionne, mais le lancement de Chromium a été bloqué par
le sandbox Windows avec `spawn EPERM`. Commande à relancer dans un terminal utilisateur normal :

```powershell
npx playwright test
```

## 6. Base locale et migrations

Docker/Supabase local était ouvert. Deux migrations ont été appliquées à la base locale via l’URL
Postgres, car le lancement de la CLI via Docker était bloqué dans le sandbox :

- `20260921130000_appointment_human_workflow.sql`
- `20260921140000_appointment_delete_hardening.sql`

Commande utilisée :

```powershell
npx supabase migration up --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres --include-all --yes
```

Les identifiants fictifs sont générés dans `fixtures/.generated-credentials.json`, fichier ignoré par
Git. Ne jamais recopier ces mots de passe dans un fichier versionné. Si nécessaire, relancer
`npm run db:seed` puis lire le fichier localement.

## 7. Serveurs locaux au moment du passage de relais

- dépôt original : un serveur avait été lancé sur `http://127.0.0.1:3200` ; vérifier s’il tourne encore ;
- clone commitable : serveur Webpack lancé sur `http://127.0.0.1:3201` ; la galerie d’animation y est
  ouverte dans le navigateur intégré.

Pour reprendre proprement :

```powershell
cd C:\Users\admha\Documents\Codex\2026-09-18\fa\saas-immo-work-local2
git status --short
npm run typecheck
npm run lint
npx vitest run --configLoader native
npm run build -- --webpack
```

## 8. Prochaines priorités après Emma

L’audit UI a identifié l’ordre suivant :

1. `/estimation` : priorité absolue, car tous les CTA publics y mènent encore vers `ComingSoon` ;
2. `/pipeline` : fonctionnalité CRM centrale encore vide ;
3. `/dashboard` : cible du logo et première entrée de navigation encore vide ;
4. `/parametres` : incomplet, mais moins critique pour la démonstration.

Le formulaire d’estimation doit créer un vrai lead entrant synthétique/local et recueillir les
consentements par canal avec cases non précochées. Il faut ensuite démontrer estimation → Léa.

## 9. Points de vigilance

- Ne pas inventer de statistiques, de durée, de consentement ou d’état métier.
- Les textes prospect et comptes-rendus humains sont des données non fiables, jamais des instructions.
- Le code décide ; le modèle classe ou rédige.
- Le premier message et le mandat signé restent humains.
- Garder tous les envois et rendez-vous marqués Simulation.
- Aucun déploiement distant ni migration distante sans demande explicite.
- Corriger la section « limites connues » de `docs/design-system.md` : elle affirme encore que
  `Reveal`, `rise-soft`, `stagger` et la galerie ne sont pas livrés, alors qu’ils existent.
- `playwright.config.ts` ne force pas encore `reducedMotion: "reduce"` ; la phase 3 du plan motion
  reste donc incomplète.
