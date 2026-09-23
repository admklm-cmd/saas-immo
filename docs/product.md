# Produit — Ascend Strategy

> Source de vérité produit : écrans, personas, parcours.
> Propriétaire : agent `frontend-ux`. Les workflows détaillés des agents IA vivent dans
> `docs/workflows.md`, les choix techniques dans `docs/architecture.md`.
>
> **État au 23/09/2026** : prototype. Sont réellement implémentés : le premier parcours
> (connexion → contacts → fiche → Hugo → Louis → historique), la boîte « Leads entrants »
> de Léa, la file « Messages à valider » avec correction humaine des brouillons, le
> module « Agents IA » (les cinq agents, le coupe-circuit, le journal des exécutions et le
> rejeu animé d'une exécution), les relances d'Emma, le suivi post-estimation de Sarah et
> le pipeline avec changement d'étape humain (garde-fous sur « Mandat signé »), le tableau de bord (comptages exacts avec périmètre
> affiché, « Indisponible » en cas d'échec). Les paramètres utilisent explicitement
> `ComingSoon`.

## 1. À qui on vend

Agences immobilières indépendantes de transaction résidentielle, 4 à 15 collaborateurs,
300 000 à 600 000 € de chiffre d'affaires annuel. Une agence = un compte, plusieurs
utilisateurs. Premier marché : Marseille et sa région (agence fictive de test :
La Ciotat / Cassis).

Promesse : **gagner plus de mandats** grâce à un site qui capte des estimations, un CRM
simple, et des agents IA qui préparent le travail sans jamais envoyer quoi que ce soit
sans validation humaine.

## 2. Personas

### 2.1 Claire — directrice d'agence
- Objectif : voir le pipeline, savoir où sont les mandats, arbitrer.
- Contexte : ordinateur, 10 minutes le matin et 10 minutes le soir.
- Craintes : qu'un agent IA écrive n'importe quoi à un vendeur au nom de l'agence.
- Besoins produit : coupe-circuit visible, historique complet, statistiques calculées
  à partir de données réelles — jamais estimées.

### 2.2 Marc — conseiller
- Objectif : traiter ses contacts vite et bien, ne rien oublier.
- Contexte : ordinateur toute la journée, souvent pressé, pas technicien.
- Craintes : perdre du temps à ressaisir, ou passer pour un robot auprès du vendeur.
- Besoins produit : fiche contact complète en un écran, actions IA en un clic, messages
  proposés modifiables.

### 2.3 Sylvie — propriétaire vendeuse (prospect)
- Objectif : savoir combien vaut son bien, sans être harcelée.
- Contexte : téléphone, le soir, 3 minutes d'attention.
- Craintes : donner son numéro et recevoir 20 appels.
- Besoins produit : formulaire court, consentement clair canal par canal, lien vers la
  politique de confidentialité.

## 3. Pipeline

`nouveau → qualifié → chaud → rdv_planifié → estimation_faite → mandat_signé`, plus
`perdu`.

Deux règles produit :
- **`rdv_planifié`** n'est atteint qu'après confirmation humaine du créneau.
- **`mandat_signé`** est toujours confirmé par un humain, jamais auto-déclaré par un agent IA.

`/pipeline` affiche cette répartition et permet à un membre de l'agence de **changer
l'étape** d'un dossier (server action `changeContactStage`, voir § 5) :

- **Pas de glisser-déposer.** Chaque carte porte une commande « Changer d'étape »
  utilisable au clavier : un petit panneau liste les sept étapes, l'étape actuelle est
  marquée et non sélectionnable. Un déplacement ordinaire part immédiatement ; la carte
  change de colonne et une confirmation discrète est annoncée (zone `aria-live`).
- **Entrer en « Mandat signé »** ouvre une fenêtre de confirmation : case obligatoire,
  jamais précochée, « Je confirme qu'un mandat a été signé avec ce vendeur ». La fenêtre
  rappelle que c'est une décision humaine, jamais celle d'un agent IA.
- **Sortir de « Mandat signé »** est réservé au directeur : case de confirmation explicite
  et motif obligatoire (3 à 500 caractères, compteur visible). Pour un conseiller, les
  options sont désactivées avec l'explication « Seul un directeur peut sortir un dossier
  de « Mandat signé ». » — la base refuse de toute façon.
- Une erreur serveur s'affiche telle quelle, dans le panneau ou la fenêtre, sans perdre la
  sélection ni la saisie ; le bouton est désactivé pendant la requête (pas de double envoi).
- **Historique** : chaque changement apparaît sur la fiche contact sous la forme
  « Étape : X → Y », avec le motif le cas échéant (texte brut). C'est une décision CRM
  humaine : aucun badge « Simulation ». L'historique est append-only : une sortie de
  mandat n'efface jamais la signature.

## 4. Les agents IA du produit

| Agent | Mission | État |
|---|---|---|
| **Léa** — acquisition | Vérifie la source d'un lead entrant, dédoublonne, crée la fiche | **Implémenté (simulateur)**, lançable depuis « Leads entrants » |
| **Hugo** — qualification | Type de bien, secteur, motivation, délai. Ne comble jamais un trou : il le signale | **Implémenté (simulateur)**, lançable depuis la fiche contact |
| **Emma** — relation | Prépare les relances et adapte le contenu | **Implémenté (simulateur)**, lançable depuis « Relances Emma » et depuis la fiche contact |
| **Louis** — rendez-vous | Propose un créneau d'estimation libre et rédige le message | **Implémenté (simulateur)**, lançable depuis la fiche contact |
| **Sarah** — suivi | Exploite le compte-rendu de RDV, suit jusqu'au mandat | **Implémenté (simulateur)**, lançable depuis « Suivi des rendez-vous » quand le compte-rendu humain est présent |

Les cinq agents sont visibles sur l'écran « Agents IA » avec leur activité réelle,
qu'ils aient déjà tourné ou non.

Tous tournent aujourd'hui sur un **simulateur** : aucun appel payant, aucun envoi réel.
Chaque trace produite porte un badge « simulation » dans l'interface.

## 5. Écrans

| Écran | Route | État | Contenu |
|---|---|---|---|
| Accueil public | `/` | Coquille soignée | Promesse, accès estimation et espace agence |
| Estimation | `/estimation` | `ComingSoon` | Formulaire progressif, consentement par canal, cases **non précochées** |
| Connexion | `/connexion` | **Fait** | Email + mot de passe, session Supabase réelle |
| Inscription | `/inscription` | Coquille | Création de compte accompagnée par Ascend Strategy |
| Tableau de bord | `/dashboard` | **Fait** (23/09) | `getDashboardSummary()` : **À faire maintenant** en premier (messages à valider ou validés non envoyés, leads à traiter, tâches ouvertes, rendez-vous à confirmer et à clôturer — total exact + 5 premiers éléments liés à leur fiche, « Tout voir » vers l'écran de travail), pipeline par étape (`perdu` en retrait), agents IA (état du coupe-circuit toujours affiché, exécutions aujourd'hui et sur 7 jours : total, erreurs, blocages par garde-fou), prochains rendez-vous. Chaque chiffre affiche son périmètre ; un calcul en échec affiche « Indisponible », jamais 0, sans masquer les autres. Aucune tendance ni pourcentage |
| Contacts vendeurs | `/contacts` | **Fait** | Liste : nom, étape, coordonnées, bien, source, mise à jour |
| Fiche contact | `/contacts/[id]` | **Fait** | Coordonnées, bien, consentements par canal, historique, actions Hugo, Louis et Emma |
| Pipeline | `/pipeline` | **Fait** (23/09) | Contacts réels de `getContacts()` répartis par étape, `perdu` affiché à part avec moins de poids visuel, compteurs réels uniquement, une carte mène à la fiche contact. « Changer d'étape » au clavier sur chaque carte (`changeContactStage`), confirmation obligatoire pour « Mandat signé », sortie réservée au directeur avec motif (voir § 3) |
| Agents IA | `/agents-ia` | **Fait** | Les 5 agents (mission, statut, compteurs, dernière exécution, erreurs), activité de l'agence, **coupe-circuit**, journal filtrable et paginé |
| Rejeu d'une exécution | `/agents-ia/executions/[runId]` | **Fait** | Étapes réellement enregistrées, rejouées avec les durées mesurées |
| Leads entrants | `/agents-ia/leads-entrants` | **Fait** | Demandes brutes : source, données non fiables, dédoublonnage par Léa, création ou rattachement de fiche, tâche de consentement et rejeu |
| Relances Emma | `/agents-ia/relances` | **Fait** | Dossiers éligibles (`getEmmaFollowUpCandidates`), canal retenu et blocage affichés lisiblement (reprise humaine, brouillon déjà en attente, aucun canal consenti — confort d'affichage, le serveur revérifie tout au clic), brouillon simulé envoyé vers la validation humaine et rejeu |
| Messages à valider | `/agents-ia/a-valider` | **Fait** | File d'attente : contact, canal, consentement, message proposé ; corriger, valider, refuser (motif obligatoire) ou déclencher un envoi **simulé** |
| Suivi des rendez-vous | `/agents-ia/suivi-rendez-vous` | **Fait** | Proposition confirmée par un humain, compte-rendu obligatoire à la clôture, puis résultat et rejeu de Sarah |
| Paramètres | `/parametres` | `ComingSoon` | Agence, utilisateurs, intégrations, conservation |

## 6. Parcours implémenté : « premier parcours complet »

**Acteur** : Marc (conseiller, agence A). **Objectif** : qualifier un vendeur et
préparer une proposition de rendez-vous, sans rien envoyer.

1. **Connexion** — `/connexion`. Une erreur d'identifiants affiche un message unique
   (« Adresse email ou mot de passe incorrect. ») : on ne révèle jamais si le compte existe.
   Sans session, toute page de `/(app)` renvoie vers `/connexion`.
2. **Liste des contacts** — `/contacts`. Chaque ligne indique l'étape du pipeline, les
   coordonnées, le bien et la source. Une reprise en main humaine et les tâches ouvertes
   sont signalées par un badge.
3. **Fiche contact** — `/contacts/[id]`. Trois blocs à gauche (coordonnées + notes, bien,
   historique) et deux à droite (agents IA, consentements par canal).
   Un contact inconnu **ou d'une autre agence** donne exactement la même page
   « Contact introuvable. ».
4. **Lancer Hugo**. Appel de `qualifyContact` (server action). Résultat affiché : décision,
   étape du pipeline, informations manquantes signalées, tâche créée le cas échéant.
5. **Lancer Louis**. Appel de `proposeAppointment`. Résultat affiché : créneau proposé,
   message rédigé, et rappel que **le message reste à valider par un humain**.
6. **Historique**. La frise se met à jour : activités, rendez-vous, messages, tâches et
   exécutions d'agents, du plus récent au plus ancien. Chaque entrée simulée porte le
   badge « Simulation ».
7. **Voir l'agent travailler**. Sous les boutons, le rejeu affiche les étapes réellement
   enregistrées (garde-fous → dossier chargé → prompt construit → appel du fournisseur →
   sortie validée → décision du code → écritures), avec **les durées mesurées par le
   serveur**. Le même rejeu est consultable plus tard depuis `/agents-ia`.

### 6.1 Ce que le rejeu doit faire comprendre

1. **C'est le code qui décide.** Une seule étape sort du code de l'agence (« Appel du
   fournisseur IA ») ; la phase « Décision du code » est encadrée — chez Louis elle
   précède même l'appel, parce que les créneaux sont calculés par le code et que le
   modèle ne fait qu'en choisir un.
2. **Une exécution bloquée montre où et pourquoi elle s'est arrêtée** (coupe-circuit,
   limite quotidienne, reprise humaine) : c'est un outil de diagnostic.
3. **Tout est simulé**, et le badge « Simulation » le dit en toutes lettres.
4. **Le rythme n'est jamais inventé** : aucune fausse barre de progression, aucune durée
   arrondie. Un ralentissement est affiché (« Rejeu ralenti ×10 ») à côté de la durée
   réelle, « Tout afficher » saute l'animation, et `prefers-reduced-motion` la supprime.

### Cas d'arrêt couverts par l'interface

| Situation | Ce que voit l'utilisateur |
|---|---|
| Coupe-circuit de l'agence actif | « Les agents IA sont suspendus par le coupe-circuit de l'agence… » — aucune action métier, seul le refus est journalisé |
| Limite quotidienne atteinte | Message expliquant la limite et la marche à suivre |
| Dossier repris par un conseiller | Message expliquant qu'aucune action automatique n'est possible |
| Consentement manquant sur le canal | Envoi refusé, message explicite |
| Réponse IA invalide | Aucune action, une tâche est créée pour un conseiller |
| Contact d'une autre agence | Page « Contact introuvable. », sans aucune donnée |

## 6.2 Parcours « Messages à valider »

**Acteur** : Marc (conseiller). **Objectif** : décider ce qui partira, sans jamais subir
une décision d'un agent IA.

1. `/agents-ia/a-valider` liste les brouillons, du plus ancien au plus récent : contact,
   canal, qui a préparé le message, **état du consentement du canal**, et le texte proposé
   affiché en **texte brut**.
2. **Valider n'est pas envoyer** : la validation fait passer le message en « Validé » et
   affiche « Rien n'a été envoyé ». Un second geste, explicite, déclenche l'**envoi simulé**.
3. **Refuser** demande un motif dans une liste fermée (plus une note facultative) : c'est ce
   qui permettra de corriger les agents plus tard. Le message ne partira jamais.
4. Sans consentement valide sur le canal, le bouton d'envoi est désactivé **et** expliqué ;
   le serveur refuse de toute façon, et relit le consentement au moment de l'envoi.
5. **Corriger** permet à un membre de modifier uniquement l'objet et le corps. Le canal et
   le destinataire ne sont pas proposés à l'édition. Un brouillon corrigé reste « à valider » ;
   s'il était déjà validé, sa validation précédente est annulée et doit être redonnée.

## 6.3 Parcours « Leads entrants »

**Acteur** : Marc (conseiller). **Objectif** : transformer une demande brute en fiche
exploitable sans inventer de donnée ni confondre demande et consentement.

1. `/agents-ia/leads-entrants` liste les demandes de l'agence et n'expose jamais celles
   d'une autre agence.
2. Le message du prospect est affiché comme texte non fiable, jamais comme HTML ni comme
   instruction adressée à l'agent.
3. **Lancer Léa** vérifie la source, recherche un doublon exact, puis crée ou rattache la
   fiche. Un lead déjà traité ne peut pas être exécuté une seconde fois.
4. Léa n'enregistre aucun consentement. Si nécessaire, elle ouvre une tâche pour qu'un
   conseiller recueille une preuve valide avant tout contact.
5. Le résultat et les étapes réellement enregistrées sont visibles dans la carte puis dans
   le rejeu permanent de l'exécution.

## 7. Règles produit visibles dans l'interface

1. **Premier contact validé par un humain** : le message de Louis est affiché comme
   « à valider », jamais comme envoyé, et il ne part qu'après une décision humaine prise
   dans `/agents-ia/a-valider`.
2. **Badge « simulation »** sur toute action simulée, dans l'interface et dans les journaux.
3. **Consentement par canal** : la fiche liste les quatre canaux (email, SMS, WhatsApp,
   téléphone) y compris ceux sans consentement, avec la date, la source et la version du texte.
4. **Rien d'inventé** : une information absente s'affiche « Non renseigné », jamais comblée.
5. **Coupe-circuit** accessible en haut de l'écran « Agents IA » : confirmation explicite
   dans les deux sens, état affiché sans ambiguïté, et « Réactiver » désactivé pour un
   conseiller avec l'explication « Seul un directeur peut réactiver les agents IA. »
   (le serveur refuse de toute façon : l'interface explique, elle ne protège pas).
6. **Chiffres nommés** : un compteur est toujours affiché avec sa fenêtre
   (« aujourd'hui », « sur 7 jours ») ; un comptage impossible affiche « Indisponible »,
   jamais « 0 ».
7. **Léa n'a pas de contact** : ses exécutions affichent « Lead entrant », pas un tiret.

## 8. Prochaines itérations (proposition)

1. Formulaire d'estimation public avec consentement par canal (cases non précochées).
2. Remplacer la coquille `ComingSoon` des paramètres.
3. ~~Changement d'étape depuis `/pipeline`~~ : livré le 23/09 (voir § 3).
