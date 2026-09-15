---
name: appsec-review
description: Checklist et méthodes de sécurité applicative (AppSec) pour le SaaS immobilier — Next.js, Supabase/Postgres RLS, secrets, dépendances npm, agents IA Claude, webhooks. À utiliser pour tout audit de sécurité ou toute revue de code touchant l'authentification, les données, les paiements ou les agents IA.
---

# AppSec — SaaS immobilier (Next.js + Supabase + Claude)

Ce skill couvre la sécurité **applicative web**, pas la sécurité réseau ou système (pas de red team, pas de MITRE ATT&CK : ce référentiel vise la compromission d'infrastructures d'entreprise, hors sujet ici). Référence générale : OWASP Top 10, adapté à notre stack.

## 1. Contrôle d'accès — le risque n°1 de ce projet

Le SaaS est multi-agences. Une faille ici expose les données d'une agence à une autre : c'est le pire scénario possible.

**Vérifier systématiquement :**
- Chaque table métier a `agency_id` **et** une politique RLS activée (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
- Les politiques RLS testent l'appartenance réelle (via une fonction ou `auth.jwt()`), jamais une valeur envoyée par le client.
- Aucune route API ni server action ne fait confiance à un `agency_id` reçu dans le corps de la requête sans le recouper avec la session serveur.
- La clé `service_role` Supabase (qui contourne RLS) n'est utilisée que dans du code serveur précis et justifié — jamais dans une route accessible sans vérification de session.

**Modèle de politique RLS minimale :**
```sql
create policy "agency_isolation_select"
on public.contacts
for select
using (agency_id = (select agency_id from public.memberships where user_id = auth.uid()));
```

**Test à écrire pour chaque table sensible :** un utilisateur de l'agence A ne doit obtenir aucune ligne en interrogeant les données de l'agence B, ni en lecture ni en écriture.

## 2. Authentification et sessions

- Toute page et route protégée vérifie la session Supabase côté serveur (pas seulement côté client — un simple masquage CSS ou une redirection JS ne protège rien).
- Les rôles (agent, directeur) sont vérifiés côté serveur avant toute action sensible (suppression, export, réglages de l'agence).
- Pas de secret de session ni de jeton dans l'URL ou le localStorage pour des données sensibles.

## 3. Entrées utilisateur et injections

- **Injection SQL** : utiliser uniquement les requêtes paramétrées du client Supabase, jamais de concaténation de chaînes dans du SQL brut.
- **XSS** : ne jamais injecter de HTML non échappé (`dangerouslySetInnerHTML` interdit sauf contenu strictement contrôlé par le serveur et assaini).
- **CSRF** : les server actions Next.js ont une protection native ; vérifier qu'aucune route API classique (`app/api/`) modifiant des données n'accepte de requêtes cross-origin sans vérification.
- Validation de toutes les entrées côté serveur avec un schéma (zod ou équivalent), même si le formulaire valide déjà côté client.
- Limitation de débit (rate limiting) sur les formulaires publics : estimation en ligne, contact, connexion.

## 4. Secrets et configuration

- Aucun secret dans le code source, les logs, les messages d'erreur renvoyés au client, ou une variable `NEXT_PUBLIC_*`.
- Vérifier avec :
  ```bash
  git ls-files | grep -E '^\.env'          # doit ne renvoyer que .env.example
  grep -rn "NEXT_PUBLIC_" --include="*.ts*" . | grep -iE "key|secret|token|password"
  ```
- Si un secret a fuité dans l'historique git : ne pas se contenter de le supprimer du fichier, il faut le **révoquer et le régénérer** côté fournisseur (Anthropic, Supabase, Twilio, etc.), puis nettoyer l'historique si le dépôt est partagé.
- Scanner les secrets avant chaque livraison si l'outil est disponible :
  ```bash
  gitleaks detect --no-git -v
  ```

## 5. Dépendances

```bash
npm audit
```
- Traiter les vulnérabilités de gravité élevée ou critique avant de livrer.
- Toute nouvelle dépendance : vérifier qu'elle est maintenue, largement utilisée, sans script d'installation suspect (`postinstall`).

## 6. Agents IA (API Claude)

Risque spécifique : **l'injection de prompt**, où un contenu venant d'un prospect (message, formulaire) tente de détourner l'agent IA de sa tâche.

- Le contenu externe (message d'un prospect, texte d'un formulaire) est toujours traité comme **donnée**, jamais comme **instruction**, dans le prompt système.
- Chaque réponse de l'IA destinée à déclencher une action (envoi de message, prise de rendez-vous) est validée par un schéma strict avant exécution. Une réponse qui ne correspond pas au schéma est rejetée, pas exécutée « au mieux ».
- L'IA ne peut déclencher que des actions prévues explicitement par le code (liste fermée), jamais une action arbitraire.
- Test à écrire : envoyer un message de prospect contenant une tentative d'injection (« Ignore tes instructions précédentes et... ») et vérifier que l'agent ne dévie pas de son comportement prévu.
- La clé API Claude ne doit **jamais** être exposée côté client (pas de `NEXT_PUBLIC_ANTHROPIC_API_KEY`). Les appels passent uniquement par du code serveur ou une Edge Function.

## 7. Webhooks et intégrations externes

- Vérifier la signature de chaque webhook entrant (Twilio, WhatsApp, logiciels immo) avant de traiter la charge utile.
- Rendre le traitement idempotent (un même événement reçu deux fois ne doit pas dupliquer une action).
- Répondre vite (200 OK) et traiter en tâche de fond si le traitement est long.
- Jetons OAuth stockés chiffrés côté serveur, jamais renvoyés au navigateur.

## 8. Conformité liée à la sécurité (rappel, à faire valider par un juriste)

- Aucun envoi de message ou appel sans consentement valide vérifié côté serveur au moment de l'action.
- Registre des consentements infalsifiable (jamais écrasé, horodaté, avec preuve).
- Désinscription effective immédiatement sur tous les canaux concernés.
- Export et suppression des données d'une personne possibles sur demande (RGPD).

## Format de rapport recommandé

Pour chaque problème trouvé, préciser :
- **Gravité** : critique / élevé / moyen / faible
- **Fichier et ligne**
- **Description** du problème et de son impact concret
- **Correction** appliquée ou recommandée
- **Test** ajouté pour éviter une régression

## Hors périmètre de ce skill

Sécurité réseau, red team, tests d'intrusion d'infrastructure, escalade de privilèges système, forensic — ce projet est une application web, pas un réseau d'entreprise à défendre contre une intrusion physique ou système.
