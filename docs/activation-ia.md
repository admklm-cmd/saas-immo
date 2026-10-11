# Activer l'IA réelle — fiche « jour J »

État actuel : **tout fonctionne en simulation** (`AI_PROVIDER=simulator`). Le code d'une vraie
connexion (Anthropic) et la **Privacy Gateway** (le filtre qui transforme les informations avant
tout envoi à une IA) sont déjà écrits et testés, mais **éteints par défaut** : sans action de votre
part, aucun appel n'est possible, ni payant ni gratuit.

Cette fiche dit quoi faire le jour où une agence cliente est signée. Elle ne remplace pas l'avis
d'un juriste.

## 1. Ce qui est déjà prêt

| Pièce | Où | Rôle |
|---|---|---|
| Privacy Gateway | `lib/privacy-gateway/` | Seule porte de sortie vers un fournisseur IA. Politique fermée par agent, détection des coordonnées dans les textes libres, pseudonymes éphémères, ré-identification locale. |
| Connexion Anthropic | `lib/claude/anthropic.ts` | Appelle l'API Claude. **Ne peut recevoir qu'une requête déjà filtrée** par la Privacy Gateway. |
| Plafond de dépense | `lib/agents/external-budget.ts`, `lib/agents/runner.ts` | Limite d'appels par agence et par jour, vérifiée avant l'appel. |
| Tests anti-fuite | `features/agents-ia/privacy-leak.test.ts` | Échouent si une donnée interdite atteint l'appel SDK. |
| Coupe-circuit, reprise humaine | déjà en place | Bloquent toujours avant l'appel, simulateur ou non. |

Important : activer l'IA **n'active pas l'envoi de messages**. Les brouillons d'Emma et de Louis
restent à valider par un humain et les envois restent simulés tant que les intégrations email/SMS/
WhatsApp ne sont pas branchées.

## 2. Avant de toucher à quoi que ce soit (décisions humaines)

1. **Choisir le fournisseur et le modèle.** Un seul est câblé : Anthropic. Les identifiants de
   modèle valides se lisent dans la documentation officielle à jour (page « Models overview » de
   platform.claude.com) ; à la date de la dernière vérification (octobre 2026) : `claude-haiku-5-5`
   (le moins cher, adapté à l'extraction et à la classification), `claude-sonnet-5-5`,
   `claude-opus-5-5`. Les 5 agents sont des tâches courtes : commencer par le plus économique et ne
   monter que si la qualité est insuffisante.
2. **Fixer un budget mensuel** et le traduire en plafond d'appels par jour (voir §4). Sans budget
   défini par vous, ne pas activer (règle de `CLAUDE.md`).
3. **Vérifier le contrat avec le fournisseur**, dans ses conditions commerciales à jour, et le
   faire valider par un juriste :
   - accord de traitement des données (DPA) signé ou accepté ;
   - durée de conservation des requêtes et des réponses ;
   - engagement de **non-entraînement** sur les données envoyées par l'API ;
   - région de traitement, transferts hors Union européenne et garanties associées ;
   - liste des sous-traitants.
4. **Informer les personnes** (mentions du formulaire d'estimation, registre des traitements) que
   des outils d'IA participent au traitement de leur demande.
5. **Relire l'audit de sécurité** (`docs/audits/2026-10-10-backend-security-privacy-cloud.md`) et
   faire confirmer par l'agent `cybersecurite` que les points P1 (SEC-001, 002, 003, 007) sont bien
   corrigés dans la version déployée. La Privacy Gateway est la règle 5 du plan de correction ; les
   règles suivantes (file durable, logs expurgés, sauvegardes) restent à faire avant un vrai envoi
   de messages.

## 3. Créer la clé d'API

- Créer dans la console du fournisseur une clé **dédiée à ce produit** (jamais celle de
  l'abonnement Claude Code, qui ne couvre pas ces appels), idéalement dans un espace de travail
  avec une **limite de dépense mensuelle** côté fournisseur : c'est le filet de sécurité si le
  plafond du code était mal réglé.
- La stocker dans le gestionnaire de secrets du serveur (VPS). **Jamais** dans Git, jamais dans un
  fichier partagé, jamais dans une variable `NEXT_PUBLIC_*`.
- Une clé qui a fuité se **révoque et se remplace**, on ne se contente pas de la supprimer du code.

## 4. Variables à renseigner (serveur uniquement)

| Variable | Obligatoire | Rôle | Valeur par défaut |
|---|---|---|---|
| `AI_PROVIDER` | oui, pour activer | `anthropic` pour l'IA réelle. Absente ou `simulator` : simulateur. | simulateur |
| `ANTHROPIC_API_KEY` | oui | Clé d'API. Absente : **refus explicite**, jamais de repli silencieux sur le simulateur. | aucune |
| `AI_MODEL` | oui | Identifiant exact du modèle. Absent ou mal formé : refus explicite. | aucune |
| `AI_EXTERNAL_DAILY_CALL_LIMIT` | recommandé | Plafond d'appels IA externes par agence et par jour parisien. Valeur absente ou invalide : 100. `0` bloque tout appel externe. | 100 |
| `AI_MAX_OUTPUT_TOKENS` | non | Longueur maximale d'une réponse (256 à 8192). | 2048 |
| `AI_TIMEOUT_MS` | non | Délai maximal d'une tentative (5 000 à 120 000 ms). | 30 000 |
| `AI_MAX_RETRIES` | non | Reprises automatiques sur panne réseau, 429 ou 5xx (0 à 3). | 1 |

Une valeur hors bornes est **refusée** (l'IA ne démarre pas) plutôt que corrigée en silence.

Comment lire le plafond : l'unité est l'appel. Une exécution d'agent fait **au plus 2 appels** (un
second seulement si la première réponse est invalide) : le code autorise donc
`plafond ÷ 2` exécutions par jour et par agence, même si chacune a besoin de sa reprise. Les
reprises réseau du SDK (`AI_MAX_RETRIES`) s'ajoutent dans le pire cas : budgétez avec
`plafond × (1 + AI_MAX_RETRIES)` appels facturables au maximum. La réflexion interne des modèles
5.5 est facturée comme du texte produit et compte dans `AI_MAX_OUTPUT_TOKENS` ; elle est active par
défaut et n'est pas désactivée par le code (selon la documentation, Sonnet 5.5 refuse de la
désactiver). À surveiller dans les premiers jours.

Le plafond de l'agence (`agencies.ai_daily_run_limit`, réglable dans l'application) continue de
s'appliquer en plus.

## 5. Les tests à lancer, dans cet ordre

```powershell
# 1. Bloquant : aucune donnée interdite ne doit atteindre l'appel SDK (SDK simulé, aucun appel réel)
npx vitest run --project unit features/agents-ia/privacy-leak.test.ts lib/privacy-gateway lib/claude

# 2. Toute la suite unitaire
npx vitest run --project unit

# 3. Chaîne complète sur la base locale (agent réel + base + Privacy Gateway + SDK simulé)
npm run db:start
npx vitest run --project integration features/agents-ia/privacy-gateway.integration.test.ts
```

4. **Un seul essai réel, contrôlé**, sur un dossier fictif, avant toute agence réelle :
   - démarrer avec `AI_EXTERNAL_DAILY_CALL_LIMIT=4` ;
   - lancer **Hugo** sur un contact de test (jamais une vraie personne) ;
   - vérifier dans l'écran de l'exécution : fournisseur `anthropic`, pas de badge « simulation »,
     jetons enregistrés, étape « fournisseur IA » avec les compteurs de la Privacy Gateway
     (nombre d'identifiants remplacés par type, jamais leurs valeurs) ;
   - vérifier dans la console du fournisseur que la requête reçue ne contient que des pseudonymes
     (`[PERSONNE_1_…]`, `[EMAIL_1_…]`) et aucune coordonnée ;
   - relancer jusqu'au plafond : l'exécution suivante doit être **bloquée avant tout appel**
     (« plafond quotidien d'appels à l'IA externe atteint »).

## 6. Ce qui part réellement vers le fournisseur

Rien ne part en dehors de cette liste fermée (`lib/privacy-gateway/policies.ts`). Un champ qui n'y
figure pas **bloque l'appel entier** (« refus fermé ») : aucune donnée n'est transmise, une tâche
est créée pour un conseiller.

Valeurs « de fait » (énumérations, booléens, nombres bornés — jamais une chaîne libre) :

| Agent | Faits envoyés |
|---|---|
| Léa | origine du lead ; nombre de caractères du texte ; 4 indicateurs « le formulaire contient un prénom / nom / email / téléphone » |
| Hugo | étape ; origine du contact ; indicateurs « a un email / un téléphone » ; bien connu ou non, type de bien, **département seul** du code postal (`13***`), surface, pièces |
| Emma | étape ; origine ; bien (5 champs ci-dessus) ; canal (email, SMS, WhatsApp) ; jours depuis le dernier message ; rendez-vous en attente ou non |
| Louis | étape ; bien ; canal ; durée du rendez-vous ; **créneaux proposés** (identifiant `creneau-N` + date et heure, calculés par le code) |
| Sarah | étape ; statut du rendez-vous ; jours depuis le rendez-vous ; nombre de caractères du compte rendu ; bien |

Textes libres (toujours analysés, chaque coordonnée remplacée par un pseudonyme, tronqués) :

| Agent | Blocs de texte envoyés |
|---|---|
| Léa | texte brut du lead, **uniquement si le dossier donne déjà un prénom ET un nom** (sinon l'appel est refusé, voir §7) |
| Hugo | motivation, délai, ville, secteur, notes du contact, historique récent |
| Emma, Louis | idem Hugo, plus le **nom de l'agence** et le **prénom** du contact, remplacés en bloc par `[AGENCE_n]` et `[PRENOM_n]` |
| Sarah | compte rendu du rendez-vous, ville, secteur, notes, historique récent |

**Ne sont jamais envoyés comme champ** (et sont recherchés puis remplacés dans les textes libres,
avec les limites du §7 : la détection est une aide, pas une garantie) : email, téléphone, nom de
famille, nom complet, adresse postale (numéro + voie), identifiants techniques (contact, agence, lead, exécution, utilisateur), IBAN, numéros de
sécurité sociale ou de carte, liens, nom de l'agence, estimation chiffrée (n'existe dans aucune
politique), consentements, contenu des messages déjà envoyés.

Le texte du prospect reste dans un bloc `<donnee_non_fiable>` du message utilisateur ; il n'entre
jamais dans le prompt système. Les pseudonymes changent à chaque exécution (étiquette aléatoire de 8
caractères dans chaque jeton) et la table de correspondance n'existe qu'en mémoire, détruite à la
fin de l'exécution. La réponse du modèle est validée par le schéma zod **avant** que les
pseudonymes soient remplacés par les vraies valeurs, puis validée une seconde fois après ; un jeton
inventé ou modifié rend la réponse invalide (nouvelle tentative, puis repli sûr : aucune écriture,
une tâche pour un humain).

## 7. Limites connues de la détection (à lire avant de promettre quoi que ce soit)

La pseudonymisation **réduit** fortement l'exposition mais **n'anonymise pas**. Aux yeux du RGPD, les
données restent personnelles : le contrat (§2) reste indispensable.

Non couvert, ou couvert seulement en partie :

- **Un nom sans indice.** Les noms du dossier (contact, agence, formulaire) sont reconnus partout,
  avec ou sans accents ni majuscules. Une personne tierce n'est reconnue que si elle est introduite
  par une civilité (« Mme Dupont »), une formule (« je m'appelle… », « Cordialement, »,
  « Bonjour Pierre »). « Ma voisine Jeannette » ou un surnom passe en clair.
- **Léa** est le cas le plus exposé : sa mission est justement de lire un nom dans un texte libre.
  Depuis la revue du 11 octobre 2026, **le texte d'un lead n'est envoyé que si le formulaire donne
  déjà un prénom ET un nom** (reconnus ensuite partout dans le texte, avec ou sans accents ni
  majuscules, noms composés et particules compris) ; sinon l'appel est refusé avant toute
  transmission (`identity_unknown_for_free_text`) et une tâche est ouverte pour un conseiller.
  Reste non couvert : le nom d'un **tiers** cité dans le texte (« mon mari Paul Durand ») sans
  civilité ni formule d'introduction.
- **Caractères trompeurs** : les pleines largeurs, points idéographiques et caractères invisibles
  sont normalisés avant analyse ; les homoglyphes (lettre cyrillique à la place d'une lettre
  latine) ne le sont pas.
- **Les lieux.** La ville, le secteur, le nom d'une résidence et un code postal écrit dans un texte
  libre passent en clair : l'agent en a besoin. Un lieu très rare, combiné à une situation
  personnelle, peut permettre de ré-identifier quelqu'un.
- **Le contexte sensible.** La motivation (divorce, succession, difficultés financières, santé…)
  est envoyée telle quelle : elle est utile et ne contient pas d'identifiant, mais c'est une
  information sensible.
- **Adresses sans type de voie** (« chez moi, résidence Les Pins bât. B ») et lieux-dits : détection
  partielle.
- **Formats exotiques** : numéros écrits en toutes lettres, avec des mots entre les chiffres, mobile
  à 9 chiffres sans zéro (« 6 12 34 56 78 »), emails épelés (« jean point dupont chez… »), dates
  de naissance, plaques d'immatriculation, identifiants étrangers.
- **Sur-masquage volontaire** : « Je suis Marseillais » ou « Bonjour Tout le monde » peuvent être
  masqués par excès. Un texte long est coupé (4 000 caractères par bloc).
- **Pas de pièces jointes ni d'images** : le code ne sait envoyer que du texte.
- **La base locale conserve les vraies valeurs** (historique CRM, journal d'exécution). Seul le
  contenu envoyé au fournisseur est pseudonymisé.
- **Course sur le plafond** : le compte est lu au démarrage de chaque exécution ; deux exécutions
  simultanées peuvent dépasser le plafond de quelques unités. Le plafond côté fournisseur (§3) est
  le vrai filet de sécurité.

## 8. Revenir au simulateur (en cas de doute, d'incident ou de budget épuisé)

Du plus rapide au plus complet :

1. **Coupe-circuit de l'agence** (écran « Agents IA ») : suspend tous les agents d'un clic, sans
   redémarrage.
2. **Repasser en simulation** : retirer `AI_PROVIDER` (ou le mettre à `simulator`) et redémarrer
   l'application. Les exécutions suivantes sont de nouveau simulées et gratuites.
3. **Couper l'accès fournisseur** : mettre `AI_EXTERNAL_DAILY_CALL_LIMIT=0` (plus aucun appel
   externe) et, si la clé est soupçonnée d'avoir fuité, la **révoquer** dans la console puis en
   créer une nouvelle.

Les exécutions déjà faites restent dans l'historique, marquées comme réelles (non simulées).
