# PRD — Ascend Strategy

> Version : 1.0 — 7 octobre 2026  
> Statut : source de cadrage produit du prototype  
> Portée : site public, CRM, agents IA simulés, démonstration commerciale  
> Références détaillées : `product.md`, `workflows.md`, `architecture.md`, `security.md`, `design-system.md`

## 1. Résumé

Ascend Strategy est un SaaS B2B destiné aux agences immobilières indépendantes. Il réunit un site d’acquisition, un CRM et cinq agents IA spécialisés afin qu’aucune demande vendeur ne soit oubliée, suivie deux fois ou relancée trop tard.

Le produit ne remplace pas le conseiller. Il prépare, structure, signale et propose. Deux décisions restent obligatoirement humaines : la validation du premier message et la confirmation du mandat signé.

Le prototype doit permettre une démonstration commerciale crédible sur des données fictives, sans envoi externe réel et sans promesse de résultat inventée.

## 2. Problème marché

Dans une agence indépendante, le suivi commercial est souvent réparti entre logiciel métier, tableur partagé, téléphone, carnet papier et mémoire des conseillers. Cela crée cinq douleurs principales :

1. une demande vendeur chaude rappelée trop tard ;
2. deux conseillers qui relancent le même prospect ;
3. des informations dispersées ou incomplètes ;
4. des relances irrégulières, sans consentement clairement vérifié ;
5. un dirigeant qui ne voit pas rapidement quels dossiers demandent une décision.

Les logiciels de diffusion gèrent les annonces et les mandats. Ascend Strategy se concentre sur le parcours commercial qui précède le mandat et sur la continuité du suivi.

## 3. Utilisateurs cibles

### 3.1 Dirigeant ou directrice d’agence

- Agence indépendante de 4 à 15 collaborateurs.
- Veut fiabiliser le suivi sans déresponsabiliser l’équipe.
- Veut connaître les dossiers bloqués, les validations à faire et l’activité des agents.
- Refuse un outil qui ajoute seulement un écran de plus.

### 3.2 Conseiller immobilier

- Reçoit, qualifie, rappelle et rencontre les vendeurs.
- Veut une prochaine action claire plutôt qu’une nouvelle tâche administrative.
- Doit pouvoir reprendre la main, corriger un brouillon et arrêter une automatisation.

### 3.3 Prospect vendeur

- Dépose une demande d’estimation.
- Attend une réponse cohérente et non une promesse de prix instantanée.
- Garde le contrôle de ses consentements par canal.

## 4. Proposition de valeur

**Chaque demande vendeur avance. L’agence garde la main.**

- Une seule fiche propre par prospect.
- Un responsable et une sortie attendue à chaque étape.
- Les informations manquantes deviennent des tâches, jamais des suppositions.
- Les relances sont préparées dans le contexte du dossier.
- Les décisions sensibles restent humaines et sont historisées.
- Le dirigeant voit immédiatement ce qui réclame une action.

## 5. Périmètre fonctionnel

### 5.1 Site public

- Landing page orientée démonstration et conversion.
- Formulaire « Demander une estimation » sans estimation chiffrée inventée.
- Consentements explicites, séparés par canal et non précochés.
- Mentions de simulation visibles dans le prototype.

### 5.2 CRM

- Tableau de bord calculé à partir des données enregistrées.
- Contacts vendeurs, fiche détaillée et historique.
- Pipeline : `nouveau → qualifié → chaud → rdv_planifié → estimation_faite → mandat_signé`, plus `perdu`.
- Tâches ouvertes et rendez-vous à venir.
- File de validation des messages.
- Paramètres de l’agence, membres et coupe-circuit.

### 5.3 Agents IA

| Agent | Mission | Sortie principale | Limite structurante |
|---|---|---|---|
| Léa | Acquisition | fiche propre et dédoublonnée | ne déduit jamais un consentement |
| Hugo | Qualification | projet structuré | n’invente aucune donnée manquante |
| Emma | Relation | brouillon de relance | aucun envoi sans garde-fous |
| Louis | Rendez-vous | créneau proposé et dossier préparé | aucune double réservation |
| Sarah | Suivi | prochaines actions après visite | ne confirme jamais seule un mandat |

## 6. Workflow principal de démonstration

1. Un prospect fictif remplit une demande d’estimation.
2. Léa vérifie la source, cherche un doublon et crée ou enrichit la fiche.
3. Hugo structure le bien, le secteur, la motivation et le délai ; une donnée absente devient une tâche.
4. Emma prépare une relance si le canal est autorisé et si aucun arrêt humain n’est actif.
5. Un conseiller relit, modifie, valide ou refuse le premier message.
6. Louis propose un créneau libre et prépare le dossier d’estimation.
7. Un humain confirme puis clôture le rendez-vous avec un compte-rendu.
8. Sarah transforme le compte-rendu en prochaines actions et fait passer le dossier à `estimation_faite`.
9. Un humain confirme le passage à `mandat_signe`.
10. Le tableau de bord et l’historique reflètent le résultat.

## 7. Règles métier non négociables

- Une ligne métier appartient à une agence ; l’isolation est imposée et testée en base.
- Session, adhésion à l’agence, rôle, consentement, quotas et coupe-circuit sont revérifiés côté serveur.
- Le contenu d’un prospect est une donnée non fiable, jamais une instruction adressée au modèle.
- La sortie d’un modèle est validée par schéma ; le code décide et écrit.
- Le premier contact et le mandat signé demandent une action humaine explicite.
- Refus, désinscription ou reprise humaine arrêtent immédiatement la relance.
- Une information absente reste absente.
- Le prototype ne contacte personne et marque chaque action externe comme simulation.

## 8. Expérience attendue

### 8.1 Landing page

- Compréhension de la promesse en moins de dix secondes.
- Composition éditoriale noire, blanche et gris perle, avec cobalt réservé au signal et à l’action.
- Hero centré, titre contenu dans la partie haute, puis respiration visuelle pour laisser apparaître la transmission en particules.
- Fond vivant : illustration pointilliste humaine et nanoparticules Anime.js, jamais une représentation neuronale générique.
- Les blocs Acquisition, Validation humaine et Suivi sont reliés par des traits lisibles.
- `prefers-reduced-motion` produit une composition statique complète.

### 8.2 Espace agence

- La prochaine action prime sur la quantité de données.
- Chaque statut doit distinguer réussite, blocage métier et erreur technique.
- Les simulations, validations humaines et informations indisponibles sont explicites.
- L’interface doit rester exploitable au clavier et respecter WCAG AA.

## 9. Architecture fonctionnelle d’une agence

```text
Direction
├── pilote l’agence, les rôles, les limites et le coupe-circuit
├── voit le tableau de bord et le pipeline global
└── confirme les décisions réservées à la direction

Conseillers
├── possèdent et suivent leurs dossiers vendeurs
├── valident les premiers messages
├── confirment et clôturent les rendez-vous
└── confirment les mandats selon leurs droits

Ascend Strategy
├── Acquisition : formulaire → Léa → contact
├── Qualification : Hugo → données structurées / tâche manquante
├── Relation : Emma → brouillon → validation humaine
├── Rendez-vous : Louis → créneau → confirmation humaine
├── Suivi : Sarah → actions → confirmation du mandat
└── Supervision : tableau de bord, historique, erreurs, coupe-circuit
```

## 10. Données et intégrations

- Supabase/Postgres, Auth et RLS pour l’isolation des agences.
- Next.js App Router et actions serveur pour l’application.
- Fournisseur IA interchangeable derrière une interface serveur.
- Intégrations futures : Hektor, Apimo, Netty, WhatsApp Business, SMS, Google Calendar, Outlook.
- Aucune intégration externe réelle n’est activée dans le prototype.

## 11. Indicateurs de succès

### Prototype

- Parcours de démonstration reproductible de bout en bout.
- Aucun mélange de données entre deux agences fictives.
- Aucun envoi réel.
- Toutes les décisions humaines visibles dans l’historique.
- Landing comprise sans explication technique.
- Typecheck, lint, tests pertinents et build de production verts.

### Pilote agence

- Délai médian avant première prise en charge.
- Nombre de demandes sans prochaine action.
- Nombre de doublons évités.
- Taux de brouillons validés, modifiés ou refusés.
- Adoption par les deux conseillers pilotes.
- Temps administratif déclaré avant/après, sans présenter l’écart comme une causalité certaine.

## 12. Offre commerciale à valider

- Pilote recommandé : 4 semaines, 2 conseillers, 750 € HT, sans engagement annuel.
- Déploiement personnalisé visé : 3 000 à 4 000 € HT selon reprise et paramétrage.
- Maintenance et exploitation visées : 600 € HT par mois.
- Ces montants sont des hypothèses commerciales internes, pas des prix affichés automatiquement dans le produit.

## 13. Hors périmètre actuel

- Estimation immobilière chiffrée sans source de valorisation réelle.
- Envoi réel d’e-mails, SMS ou WhatsApp.
- Appels automatisés.
- Scraping massif de portails.
- Promesse de chiffre d’affaires ou de taux de conversion.
- Paiement Stripe et facturation définitive.
- Déploiement Supabase distant depuis l’environnement de développement.

## 14. Jalons

1. Stabiliser le prototype et sa démonstration.
2. Finaliser la landing et le récit commercial.
3. Tester un pilote limité avec une agence et deux profils contrastés.
4. Mesurer l’usage réel avant d’activer une intégration payante.
5. Faire valider le cadre RGPD et la prospection par un juriste.
6. Préparer le déploiement VPS, la supervision, les sauvegardes et les journaux d’accès.

## 15. Définition de terminé

Un jalon est terminé lorsque son comportement est visible, documenté, testé avec des résultats réels, accessible, compatible avec les garde-fous, et enregistré dans un commit relisible. Aucun écran ne doit inventer une donnée, masquer une simulation ou faire croire qu’une action externe a eu lieu.

