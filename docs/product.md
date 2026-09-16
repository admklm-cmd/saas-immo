# Produit — AiaA

> Source de vérité produit : écrans, personas, parcours.
> Propriétaire : agent `frontend-ux`. Les workflows détaillés des agents IA vivent dans
> `docs/workflows.md`, les choix techniques dans `docs/architecture.md`.
>
> **État au 16/09/2026** : prototype. Seul le premier parcours (connexion → contacts →
> fiche → Hugo → Louis → historique) est réellement implémenté. Les autres écrans sont
> des coquilles « À venir » assumées.

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

## 4. Les agents IA du produit

| Agent | Mission | État |
|---|---|---|
| **Léa** — acquisition | Vérifie la source d'un contact, dédoublonne, crée la fiche | À venir |
| **Hugo** — qualification | Type de bien, secteur, motivation, délai. Ne comble jamais un trou : il le signale | **Implémenté (simulateur)** |
| **Emma** — relation | Prépare les relances et adapte le contenu | À venir |
| **Louis** — rendez-vous | Propose un créneau d'estimation libre et rédige le message | **Implémenté (simulateur)** |
| **Sarah** — suivi | Exploite le compte-rendu de RDV, suit jusqu'au mandat | À venir |

Tous tournent aujourd'hui sur un **simulateur** : aucun appel payant, aucun envoi réel.
Chaque trace produite porte un badge « simulation » dans l'interface.

## 5. Écrans

| Écran | Route | État | Contenu |
|---|---|---|---|
| Accueil public | `/` | Coquille soignée | Promesse, accès estimation et espace agence |
| Estimation | `/estimation` | Coquille | Formulaire progressif, consentement par canal, cases **non précochées** |
| Connexion | `/connexion` | **Fait** | Email + mot de passe, session Supabase réelle |
| Inscription | `/inscription` | Coquille | Création de compte accompagnée par AiaA |
| Tableau de bord | `/dashboard` | Coquille | Statistiques calculées sur données réelles |
| Contacts vendeurs | `/contacts` | **Fait** | Liste : nom, étape, coordonnées, bien, source, mise à jour |
| Fiche contact | `/contacts/[id]` | **Fait** | Coordonnées, bien, consentements par canal, historique, actions Hugo et Louis |
| Pipeline | `/pipeline` | Coquille | Vue par étape |
| Agents IA | `/agents-ia` | Coquille | Mission, statut, historique, erreurs + **coupe-circuit** |
| Messages à valider | `/agents-ia/a-valider` | Coquille | File d'attente des premiers contacts |
| Paramètres | `/parametres` | Coquille | Agence, utilisateurs, intégrations, conservation |

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

### Cas d'arrêt couverts par l'interface

| Situation | Ce que voit l'utilisateur |
|---|---|
| Coupe-circuit de l'agence actif | « Les agents IA sont suspendus par le coupe-circuit de l'agence… » — aucune action métier, seul le refus est journalisé |
| Limite quotidienne atteinte | Message expliquant la limite et la marche à suivre |
| Dossier repris par un conseiller | Message expliquant qu'aucune action automatique n'est possible |
| Consentement manquant sur le canal | Envoi refusé, message explicite |
| Réponse IA invalide | Aucune action, une tâche est créée pour un conseiller |
| Contact d'une autre agence | Page « Contact introuvable. », sans aucune donnée |

## 7. Règles produit visibles dans l'interface

1. **Premier contact validé par un humain** : le message de Louis est affiché comme
   « à valider », jamais comme envoyé.
2. **Badge « simulation »** sur toute action simulée, dans l'interface et dans les journaux.
3. **Consentement par canal** : la fiche liste les quatre canaux (email, SMS, WhatsApp,
   téléphone) y compris ceux sans consentement, avec la date, la source et la version du texte.
4. **Rien d'inventé** : une information absente s'affiche « Non renseigné », jamais comblée.
5. **Coupe-circuit** accessible depuis les réglages de l'agence (écran à construire).

## 8. Prochaines itérations (proposition)

1. Écran de validation du premier contact (`/agents-ia/a-valider`) : message proposé,
   contact, canal, statut du consentement, modifier / valider / refuser en un clic.
2. Écran « Agents IA » avec le coupe-circuit réel et l'historique par agent.
3. Formulaire d'estimation public avec consentement par canal (cases non précochées).
4. Tableau de bord et vue pipeline.
