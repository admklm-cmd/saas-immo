# AiaA — SaaS B2B pour agences immobilières — contexte projet

## Le produit

Un SaaS vendu aux **agences immobilières indépendantes** (1 agence = 1 compte, plusieurs utilisateurs par agence).
Objectif client : **gagner plus de mandats** grâce à un site, un CRM et des agents IA qui travaillent tout le cycle de vente.

Modules :
1. **Site public de l'agence** avec estimation en ligne (principal canal d'acquisition de leads, avec recueil du consentement).
2. **CRM** : contacts, biens, pipeline, historique des échanges, tâches, rendez-vous.
3. **Agents IA du produit** (propulsés par une API IA — voir « IA du produit vs IA de développement » ci-dessous). Chacun a un nom, une mission précise et un périmètre borné :
   - **Léa — acquisition** : vérifie la source d'un nouveau contact, dédoublonne, crée la fiche.
   - **Hugo — qualification** : identifie le bien, le secteur, la motivation et le délai du projet.
   - **Emma — relation** : prépare les relances et adapte le contenu des messages.
   - **Louis — rendez-vous** : propose un créneau d'estimation et prépare le dossier.
   - **Sarah — suivi** : exploite le compte-rendu du rendez-vous, suit le dossier jusqu'au mandat signé.

   Chaque agent a un écran dédié dans le module « Agents IA » du CRM : prénom, mission, statut, historique, erreurs.

Pipeline : `nouveau → qualifié → chaud → rdv_planifié → estimation_faite → mandat_signé` (+ `perdu`).

Intégrations prévues dès le départ : logiciels immo (Hektor, Apimo, Netty…), WhatsApp Business + SMS (Twilio, Brevo…), Google Calendar et Outlook.
Plus tard : paiement des abonnements (Stripe).

Marché : France, avec un premier focus sur **Marseille**.

## Écrans du produit

1. **Tableau de bord** : CRM et statistiques (calculées à partir des données réellement enregistrées, jamais inventées).
2. **Contacts vendeurs** : biens, historique, prochaines actions.
3. **Agents IA** : Léa, Hugo, Emma, Louis, Sarah — prénom, mission, statut, historique, erreurs (voir ci-dessus).
4. **Rendez-vous d'estimation**.
5. **Automatisations** : scénarios, simulation, pause, résultats.

## Format obligatoire pour définir un workflow d'agent IA

Tout workflow (Léa, Hugo, Emma, Louis, Sarah ou un futur agent) est documenté avec ces champs, dans `docs/workflows.md` :
déclencheur, entrées, étapes, outils utilisés, sorties, condition de passage à l'étape/agent suivant, conditions d'arrêt, gestion des erreurs, critères de réussite.

## Garde-fous produit (toujours actifs, prototype comme production)

- Aucun envoi ou action externe réelle sans consentement valide et vérifié côté serveur.
- **Premier contact** : toujours validé par un humain de l'agence.
- **Mandat signé** : toujours confirmé par un humain, jamais auto-déclaré par un agent IA.
- Relances arrêtées immédiatement en cas de refus du contact ou de reprise en main par un conseiller humain.
- Aucun double envoi, aucune double réservation de créneau.
- Un agent IA n'invente jamais une information manquante : il la signale comme manquante.
- **Coupe-circuit** : chaque agence peut suspendre tous ses agents IA d'un clic.

## Priorités (dans cet ordre)

1. **Sécurisé** : jamais sacrifié, dans tous les cas.
2. **Beau** : niveau de finition Apple.
3. **Utile** : chaque fonctionnalité doit faire gagner du temps ou des mandats à l'agence.
4. **Robuste et rapide à livrer** : ne doit pas casser facilement, et doit pouvoir être livré vite.

Une fonctionnalité qui menace la stabilité du projet ou qui retarderait fortement la livraison peut être coupée, même si elle est utile — voir « Contexte actuel » ci-dessous.

## Contexte actuel : prototype d'entraînement

On construit actuellement un **prototype fonctionnel**, pas encore un produit vendu. Objectif final : un déploiement **sur VPS**, ultra sécurisé, vendu à une agence précise. Rien n'est mis en ligne à cette étape et aucune personne réelle n'est contactée.

- **Délai : 2 à 3 jours.** Périmètre volontairement simple : beau, utile, sécurisé, maintenable — pas un projet d'entreprise sur plusieurs mois.
- **Agence fictive de test** : agence indépendante de transaction résidentielle, 4 à 15 collaborateurs, 300 000 à 600 000 € de CA annuel, secteur La Ciotat / Cassis et alentours. Données synthétiques plausibles dans `fixtures/`, jamais de vraies données personnelles.
- **Toute communication externe est simulée** à ce stade : emails, SMS, appels, calendrier, scraping. Chaque action simulée doit être clairement identifiée comme telle dans l'interface et les journaux (ex. badge « simulation »), pour qu'on ne la confonde jamais avec un envoi réel.
- Si une fonctionnalité est complexe, fragile, ou risque de retarder fortement la livraison : ne pas la faire, même si elle serait utile ou jolie. L'orchestrateur tranche et explique son choix plutôt que de deviner en silence.
- Décisions réversibles (nommage, détails d'implémentation mineurs) : l'orchestrateur avance sans redemander confirmation à chaque fois. Décisions structurantes (schéma de données, choix de stack, argent réel, sécurité) : toujours validées avec l'utilisateur d'abord.

## IA du produit vs IA de développement — ne pas confondre

- **L'abonnement Claude Code** (utilisé pour développer avec les agents `orchestrateur`, `frontend-ux`, `automatisation-ia`, `cybersecurite`) sert uniquement à **coder**. Il ne fournit aucune API pour faire fonctionner Léa, Hugo, Emma, Louis ou Sarah une fois le produit en marche.
- **Les agents IA du produit** (Léa, Hugo, Emma, Louis, Sarah) auront besoin de leur **propre clé API**, avec son propre budget, séparée de l'abonnement Claude Code. Ne jamais supposer que l'abonnement de développement couvre ces appels.
- **Fournisseur IA interchangeable** : la logique des agents IA du produit doit passer par une interface commune (`lib/claude/`), pas d'appel figé à un seul fournisseur — pour pouvoir changer de fournisseur plus tard sans tout réécrire.
- **Simulateur d'abord** : tant qu'aucun budget n'est fixé pour l'API IA du produit, les agents Léa/Hugo/Emma/Louis/Sarah tournent sur un **simulateur** (réponses simulées, pas d'appel réel facturé). Ne jamais déclencher un service payant sans budget explicitement défini par l'utilisateur.

## Méthode de travail (inspirée de BMAD)

On applique l'esprit de la méthode BMAD (Breakthrough Method for Agile AI-Driven Development) — documents avant code, tâches atomiques, pas d'improvisation — sans installer son framework complet ni ses propres agents : nos 4 agents suffisent.

- **Le plan écrit fait foi.** Avant de coder, l'orchestrateur écrit un plan précis qui sert de référence pendant toute la tâche.
- **Découpage en tâches atomiques**, avec périmètre et critère de réussite précis pour chacune — jamais « fais le CRM », toujours une tâche vérifiable.
- **Tests en deux temps, obligatoires** : 1) chaque agent teste sa pièce isolément avant de l'intégrer, 2) une fois connectée au reste du code, elle est retestée en intégration. Un problème détecté à l'une ou l'autre étape est corrigé avant de continuer.
- **Résultats de test réels uniquement.** Un agent ne déclare jamais un test réussi s'il ne l'a pas réellement exécuté.
- **Premier parcours complet tôt** : avant d'élargir le périmètre, faire fonctionner un parcours simple de bout en bout — ex. contact fictif → qualification (Hugo) → proposition de rendez-vous (Louis) → historique CRM — puis élargir progressivement.

## Stack

- Next.js (App Router) + TypeScript strict
- Supabase : Postgres, Auth, Row Level Security, Storage
- Tailwind CSS
- API Claude via `@anthropic-ai/sdk`, **uniquement côté serveur**
- Tests : Vitest (unitaires) + Playwright (parcours E2E)

## Structure de dossiers

```
saas-immo/
├── CLAUDE.md
├── .env.example
├── app/
│   ├── (marketing)/                 # site public de l'agence (non connecté)
│   │   ├── page.tsx                 # accueil
│   │   ├── estimation/
│   │   │   └── page.tsx             # formulaire d'estimation
│   │   └── layout.tsx
│   ├── (app)/                       # espace connecté de l'agence
│   │   ├── layout.tsx               # vérifie la session, pose le agency_id
│   │   ├── dashboard/page.tsx
│   │   ├── contacts/
│   │   │   ├── page.tsx             # liste
│   │   │   └── [id]/page.tsx        # fiche contact
│   │   ├── pipeline/page.tsx
│   │   ├── agents-ia/
│   │   │   ├── page.tsx             # réglages des agents IA + coupe-circuit
│   │   │   └── a-valider/page.tsx   # file d'attente des premiers contacts
│   │   └── parametres/page.tsx
│   ├── (auth)/
│   │   ├── connexion/page.tsx
│   │   └── inscription/page.tsx
│   ├── api/
│   │   └── webhooks/
│   │       ├── whatsapp/route.ts
│   │       ├── sms/route.ts
│   │       └── logiciel-immo/route.ts
│   └── layout.tsx                   # layout racine
│
├── components/
│   └── ui/                          # composants réutilisables (bouton, carte, champ…)
│
├── features/                        # logique + composants regroupés par domaine
│   ├── contacts/
│   │   ├── components/
│   │   ├── actions.ts               # server actions du domaine
│   │   ├── queries.ts               # lectures Supabase du domaine
│   │   └── types.ts
│   ├── pipeline/
│   ├── estimation/
│   ├── consentements/
│   └── agents-ia/
│       ├── lea-acquisition/
│       ├── hugo-qualification/
│       ├── emma-relation/
│       ├── louis-rendez-vous/
│       └── sarah-suivi/
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # client navigateur
│   │   ├── server.ts                # client serveur (cookies de session)
│   │   └── admin.ts                 # client service_role, usage restreint
│   ├── claude/
│   │   ├── client.ts                # instance @anthropic-ai/sdk, serveur uniquement
│   │   └── schemas.ts               # schémas zod des sorties IA
│   ├── integrations/
│   │   ├── whatsapp/
│   │   ├── sms/
│   │   ├── calendrier/
│   │   └── logiciels-immo/
│   │       ├── types.ts             # interface commune à tous les adaptateurs
│   │       ├── hektor.ts
│   │       ├── apimo.ts
│   │       └── netty.ts
│   └── utils/
│
├── types/
│   └── database.ts                  # types générés depuis Supabase
│
├── supabase/
│   ├── migrations/
│   │   └── 20260101000000_init.sql
│   └── seed.sql
│
├── docs/
│   ├── design-system.md
│   ├── product.md                   # écrans, personas, parcours (source de vérité produit)
│   ├── architecture.md              # choix techniques et pourquoi
│   ├── workflows.md                 # workflows des agents IA (format obligatoire, voir plus haut)
│   └── security.md                  # état des lieux sécurité, ce qui est couvert / pas encore
│
├── fixtures/                        # données synthétiques (agence(s) fictive(s) de test)
│
├── infra/                           # configuration de déploiement (VPS, plus tard)
│
├── e2e/                              # tests Playwright
│   └── estimation.spec.ts
│
└── (fichiers de test unitaires en `*.test.ts` à côté du fichier testé)
```

## Conventions de code

**Nommage**
- Fichiers et dossiers : `kebab-case` (`agents-ia/`, `a-valider/`).
- Composants React : `PascalCase`, un composant par fichier, nom du fichier = nom du composant (`ContactCard.tsx`).
- Fonctions et variables : `camelCase` en anglais (`getContactById`, `isConsentValid`).
- Tables et colonnes Supabase : `snake_case` en anglais (`agency_id`, `created_at`).
- Types et interfaces TypeScript : `PascalCase` (`type Contact = {...}`).

**Next.js App Router**
- Server Components par défaut. `"use client"` seulement pour l'interactivité (formulaires, état local, animations).
- **Server actions** (`features/<domaine>/actions.ts`) pour toute mutation déclenchée depuis un composant : créer/modifier un contact, valider un message IA, etc.
- **Routes API** (`app/api/`) réservées aux webhooks externes et aux cas où un vrai endpoint HTTP est nécessaire.
- Chaque server action et route API revérifie la session et l'`agency_id` côté serveur, même si l'interface les affiche déjà correctement.

**Accès aux données**
- Lectures : fonctions dans `features/<domaine>/queries.ts`, qui utilisent le client serveur (`lib/supabase/server.ts`).
- Écritures : dans les server actions du même domaine.
- Le client `service_role` (`lib/supabase/admin.ts`) n'est utilisé que pour des tâches serveur précises qui doivent légitimement contourner RLS (ex. job planifié). Jamais dans un chemin déclenché directement par une requête utilisateur.

**Gestion des erreurs**
- Les fonctions serveur (actions, queries) renvoient un résultat explicite `{ data, error }` plutôt que de laisser remonter une exception brute jusqu'à l'interface.
- Les erreurs utilisateur (validation, consentement manquant) sont des messages clairs en français. Les erreurs techniques sont loguées côté serveur sans détail technique exposé au client.

**Validation**
- Toute entrée provenant du client (formulaire, server action, webhook) est validée avec un schéma zod avant tout traitement.
- Les schémas partagés entre plusieurs domaines vivent dans `lib/` ; les schémas spécifiques à un domaine vivent dans `features/<domaine>/types.ts`.

**Agents IA**
- Un dossier par agent sous `features/agents-ia/<nom-agent>/` : prompt système (fichier séparé), schéma de sortie zod, fonction d'appel, logique de décision.
- Aucun agent IA n'est appelé depuis un composant client : toujours via une server action ou une route API.

**Intégrations externes**
- Chaque service (WhatsApp, SMS, logiciel immo, agenda) a un adaptateur dans `lib/integrations/` qui respecte une interface commune définie dans `types.ts` du dossier concerné. Le reste du code appelle l'interface, jamais directement la librairie du fournisseur.

**Tests**
- Unitaires (Vitest) : `nom-du-fichier.test.ts`, à côté du fichier testé.
- E2E (Playwright) : dans `e2e/`, un fichier par parcours utilisateur.

**Général**
- Interface en français. Code, noms de variables, commits et commentaires techniques en anglais.
- Textes d'interface centralisés (pas de chaînes françaises dispersées dans la logique métier).
- Chaque table métier porte un `agency_id`. L'isolation entre agences est assurée par RLS, jamais seulement par le code applicatif.
- Migrations Supabase dans `supabase/migrations/`, une par changement, jamais de modification d'une migration existante.
- Secrets uniquement dans les variables d'environnement serveur. Seules les variables `NEXT_PUBLIC_*` sont exposées au navigateur : n'y mettre aucun secret.
- Commits en anglais, format Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`).

## Design

Noir et blanc, sobre, futuriste à la manière d'Apple : grands espaces, typographie soignée, flou et transparence discrets, micro-animations fluides. Pas de néon. Pensé **ordinateur d'abord**, responsive ensuite. Accessibilité WCAG AA.
Le système de design vit dans `docs/design-system.md` (tenu à jour par l'agent `frontend-ux`).

## Socle légal et sécurité (non négociable)

Rappel : ces règles résument la réglementation connue en septembre 2026 et doivent être validées par un juriste avant la commercialisation.

- **Démarchage téléphonique** : depuis le 11 août 2026, interdit envers un particulier sans consentement préalable (acte positif, prouvable). Interdit d'appeler pour demander ce consentement. Exception : demande explicite du particulier, recontact sous 5 jours ouvrables. Quand l'appel est autorisé : lundi–vendredi hors fériés, 10h–13h et 14h–20h, 4 appels par mois maximum par personne.
- **Email, SMS, WhatsApp vers des particuliers** : consentement préalable, lien ou mot-clé de désinscription dans chaque message, désinscription effective immédiatement.
- **Registre des consentements** : pour chaque contact et chaque canal, on stocke la date, la source, le texte présenté et la preuve. Aucun envoi sans consentement valide vérifié côté serveur.
- **Premier contact** : toujours validé par un humain de l'agence. Relances : automatiques, uniquement si le consentement est valide.
- **Pas d'extraction massive** de sites tiers (Leboncoin, SeLoger…) : risque juridique (droit des bases de données, RGPD). Utiliser des API officielles, partenariats ou données publiques ouvertes.
- **RGPD** : minimisation des données, durée de conservation définie, droit d'accès et d'effacement, journal des accès sensibles.
- **Coupe-circuit** : chaque agence peut suspendre tous ses agents IA d'un clic.
- **Mots de passe et comptes** : aucun mot de passe ni token en dur dans le code, aucun compte administrateur avec mot de passe codé en dur. Mots de passe hachés (jamais stockés en clair).
- **Isolation testée concrètement** : les tests d'isolation entre agences se font avec **deux agences fictives distinctes** dans les fixtures, pas seulement en théorie.
- **Avant tout déploiement réel** (hors périmètre du prototype actuel) : HTTPS, sauvegardes protégées, accès restreint à la base de données.
- **Une clé exposée doit être révoquée et renouvelée**, jamais juste supprimée du code.
- **L'agent `cybersecurite` peut bloquer une livraison** si un problème critique ou élevé n'est pas corrigé — ce n'est pas qu'un avis consultatif.
- Ne jamais promettre une sécurité absolue : décrire ce qui est couvert et ce qui ne l'est pas encore.

## Commandes utiles

- `npm run dev` : serveur local
- `npm run lint`, `npx tsc --noEmit` : vérifications
- `npx vitest run` : tests unitaires
- `npx playwright test` : tests E2E
