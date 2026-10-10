# Audit backend, confidentialité IA et choix cloud — 10 octobre 2026

## Statut de ce document

Ce document consolide les analyses réalisées pendant la revue du 8 au 10 octobre 2026 : état Git,
sécurité du backend, confidentialité des agents IA, faisabilité d'une Privacy Gateway, intérêt d'un
RAG et comparaison entre Supabase, AWS et OVHcloud.

La revue était en **lecture seule**. Aucun correctif de sécurité, aucune migration distante et aucun
fournisseur IA réel n'ont été activés. Les mesures ci-dessous sont donc des décisions proposées ou
des travaux à réaliser, sauf lorsqu'elles sont explicitement décrites comme déjà présentes.

## 1. Ce qui a été vérifié

### Dépôt et publication

- dépôt de travail audité : branche `chore/code-cleanup`, commit `a5a4c70` ;
- le commit de base est récupérable sur `origin/feat/landing-polish` ;
- treize modifications locales concernent la landing page et le design ;
- les documents PRD/directives, la rétrospective et l'image `particle-handoff.jpg` existent aussi
  localement ;
- une copie de publication propre et des bundles Git de secours ont été préparés hors du dépôt de
  travail ;
- aucun `.env` n'est suivi, à l'exception de `.env.example` ; les identifiants de fixtures restent
  dans `fixtures/.generated-credentials.json`, qui est ignoré par Git.

Un refus Git « dubious ownership » est possible lorsque le dépôt créé par `CodexSandboxOnline` est
utilisé depuis le compte Windows normal. La commande à exécuter depuis le compte propriétaire est :

```powershell
git config --global --add safe.directory C:/chemin/absolu/vers/le/depot
```

Cette exception doit viser le dépôt exact, jamais un joker global.

### Architecture réellement présente

- Next.js 16, React 19, TypeScript strict ;
- Supabase Auth, Postgres, PostgREST, RPC et Row Level Security ;
- douze tables publiques métier et deux tables privées techniques ;
- validation Zod côté serveur et validations SQL/triggers en défense en profondeur ;
- exécutions d'agents synchrones ; aucune file durable, aucun worker et aucune dead-letter queue ;
- webhooks WhatsApp, SMS et logiciel immobilier présents mais volontairement en `501` ;
- aucun RAG, aucun index vectoriel applicatif et aucun SDK de fournisseur IA réel ;
- seul le simulateur IA déterministe est raccordé. Toute autre valeur de `AI_PROVIDER` échoue
  explicitement.

## 2. Résultat de l'audit sécurité

| Référence | État démontré | Priorité |
|---|---|---|
| SEC-001 — RPC publique d'estimation | `p_ip_hash` est fourni à une RPC exécutable par `anon`. Un appel direct peut changer de compartiment et contourner le quota 3/10 min. Le plafond 30/h/agence résiste, mais peut être utilisé pour bloquer les visiteurs légitimes. | P1 élevée |
| SEC-002 — données CRM côté navigateur | L'espace Emma transmet l'email et le téléphone complets à un composant client alors qu'il n'affiche que leur disponibilité. | P1 moyenne |
| SEC-003 — session Supabase | Les pages privées utilisent bien `auth.getUser()`. En revanche, le client serveur suppose qu'un proxy renouvelle les cookies alors qu'aucun `proxy.ts`/middleware n'existe. Aucun contournement d'authentification n'a été démontré, mais le renouvellement est incomplet. | P1 moyenne |
| SEC-006 — données transmises à l'IA | Aucun transfert externe aujourd'hui : simulateur uniquement. Le contexte futur contient toutefois prénom, commune, secteur, notes, historique, texte libre et compte rendu. | P0 avant activation d'un LLM |
| SEC-007 — transitions directes | L'entrée/sortie de `mandat_signe` est protégée en base. Les autres changements d'étape peuvent encore être effectués directement via PostgREST sans activité obligatoire. | P1 élevée |

Points solides déjà présents :

- RLS et `agency_id` sur les tables métier ;
- clés étrangères composites empêchant de relier deux agences ;
- agence résolue depuis la session et non depuis une valeur envoyée par le navigateur ;
- consentements et activités sensibles append-only ;
- premier contact soumis à validation humaine ;
- mandat signé confirmé par un humain ;
- estimation chiffrée interdite à l'IA ;
- sorties IA validées par des schémas Zod stricts ;
- aucune utilisation du client `service_role` dans les chemins applicatifs déclenchés par un
  utilisateur.

Risques opérationnels encore ouverts :

- durée de conservation et procédure d'effacement non définies ;
- logs non centralisés et non systématiquement expurgés ;
- MFA désactivée dans la configuration locale ;
- CSP autorisant encore `script-src 'unsafe-inline'` ;
- sauvegardes, restauration, RPO et RTO de production non vérifiés ;
- dépendances à réauditer en ligne avant livraison ;
- absence de queue/idempotence avant l'activation d'emails, SMS, webhooks ou LLM réels.

## 3. Architecture Privacy Gateway retenue

La Privacy Gateway est indépendante d'un éventuel RAG. Elle doit devenir l'unique point de sortie
vers un fournisseur IA :

```text
Base CRM
  -> contexte métier minimal
  -> Privacy Gateway
       -> politique autorisée par tâche
       -> suppression des champs inutiles
       -> détection des identifiants dans les textes libres
       -> pseudonymes éphémères par exécution
       -> journal technique sans contenu sensible
  -> fournisseur IA
  -> validation stricte de la réponse
  -> réidentification locale si nécessaire
  -> règles métier déterministes
  -> validation humaine / écriture protégée
```

Règles proposées :

1. refus fermé : si la politique ne sait pas traiter un champ, aucun appel externe n'est effectué ;
2. aucune adresse, email, téléphone, nom complet ou identifiant CRM brut dans une requête externe ;
3. pseudonymes différents à chaque exécution, sans table permanente pour le MVP ;
4. table de correspondance uniquement en mémoire et détruite à la fin de l'exécution ;
5. politiques distinctes pour Léa, Hugo, Emma, Louis et Sarah ;
6. texte libre toujours considéré comme non fiable et comme source possible d'identifiants ;
7. fournisseur avec région, durée de rétention, non-entraînement, DPA et sous-traitants validés ;
8. aucun log de prompt ou de réponse brute en production ;
9. aucune action sensible décidée uniquement par le modèle ;
10. test automatique bloquant le déploiement si une donnée interdite atteint l'adaptateur externe.

### RAG

Un RAG n'est pas nécessaire pour protéger la base. Il ajoute au contraire des copies, des chunks,
des embeddings, un index et des obligations d'effacement supplémentaires. Il ne sera étudié que si
un besoin documentaire réel apparaît. Dans ce cas : index séparé par agence, autorisation avant la
recherche, provenance de chaque fragment, suppression propagée et absence d'identifiants directs
dans les embeddings.

## 4. Choix cloud

Déplacer l'application sur AWS ou OVHcloud ne corrige pas SEC-001, SEC-002, SEC-003 ou SEC-007 et
n'empêche pas l'application d'envoyer des données brutes à un LLM. Le cloud règle surtout le
contenant : réseau privé, chiffrement, sauvegardes, secrets, supervision et résidence des données.

Recommandation provisoire :

1. conserver Supabase managé dans une région européenne pendant le pilote ;
2. corriger les problèmes P1 ;
3. placer la Privacy Gateway dans le backend serveur ;
4. ajouter un worker durable avant toute intégration réelle ;
5. ne migrer vers AWS/OVHcloud que pour une exigence contractuelle, de souveraineté, de charge ou
   de reprise clairement définie.

Si aucune donnée, même pseudonymisée, ne doit atteindre une IA frontière, la seule architecture
cohérente consiste à héberger aussi un modèle privé dans le même réseau cloud. OVHcloud est naturel
pour une exigence européenne forte ; AWS offre un catalogue de services managés plus large. Dans
les deux cas, la sécurité applicative reste à la charge du projet.

L'auto-hébergement de Supabase transfère au projet la responsabilité des correctifs système,
sauvegardes, restaurations, haute disponibilité, supervision et capacité. Il ne doit pas être choisi
sans responsable d'exploitation identifié.

## 5. Plan de correction proposé

1. **SEC-001** : retirer la maîtrise du compartiment IP à l'appelant et ajouter une protection
   frontale. Test de fin : un appel anonyme direct ne peut pas changer de compartiment.
2. **SEC-007** : obliger toutes les transitions d'étape à passer par la RPC auditée. Test de fin :
   tout `UPDATE contacts.stage` direct est refusé.
3. **SEC-003** : ajouter le proxy officiel de renouvellement Supabase et tester token expiré,
   redirection, logout et propagation des cookies.
4. **SEC-002** : remplacer `email`/`phone` par `hasEmail`/`hasPhone` dans le payload client Emma.
5. **Privacy Gateway** : implémenter les politiques et les tests anti-fuite avant tout fournisseur
   réel.
6. **Fiabilité** : outbox, worker, idempotence, reprises bornées et dead-letter queue.
7. **Exploitation** : logs structurés expurgés, métriques, alertes, sauvegarde et test de restauration.

Responsabilités :

- Codex : code, migrations locales, tests et documentation ;
- propriétaire du projet : fournisseur IA, seuils anti-abus, durée de conservation et règles
  métier ;
- administrateur infrastructure : réseau, secrets, sauvegardes, alertes, RPO/RTO et déploiement ;
- revue indépendante/juridique : DPA, information des personnes, conservation et conformité des
  parcours de consentement.

## 6. Démarrage local et comptes de démonstration

Prérequis : Docker Desktop doit être démarré. Ensuite :

```powershell
npm run db:start
npm run dev
```

L'application répond sur `http://127.0.0.1:3000` et Supabase local sur
`http://127.0.0.1:54321`.

Les comptes fictifs sont générés par les fixtures. Leurs mots de passe ne doivent jamais être
copiés dans Git ni dans cette documentation :

```powershell
Get-Content fixtures/.generated-credentials.json
```

Le fichier indique notamment les profils `directorA`, `agentA` et `userB`. Pour examiner l'agence
principale, utiliser le compte `directorA` (« Calanques Immobilier »).

Limite observée pendant la session du 10 octobre : Docker Desktop n'était pas démarré et le compte
sandbox ne pouvait pas lancer son moteur. Next.js a également rencontré un refus Windows lors de la
canonicalisation d'un dépôt appartenant à un autre SID. Ces problèmes concernent l'environnement
local/ACL, pas le code de l'application. Le lancement depuis le compte Windows propriétaire, après
démarrage de Docker Desktop, reste la voie normale.

## 7. État de décision

- **Démontré** : architecture actuelle, simulateur uniquement, principales garanties RLS et cinq
  constats SEC décrits ci-dessus.
- **À confirmer en environnement réel** : cookies HTTP, politiques Supabase de production,
  restauration, audit de dépendances en ligne et état distant GitHub.
- **Interdit avant correction** : fournisseur IA réel, envoi réel de messages et exposition publique
  sans protection frontale.
- **Décision humaine attendue** : fournisseur IA ou modèle privé, AWS/OVH/Supabase, seuils de quota,
  conservation et objectifs RPO/RTO.
