# Plan — Démonstration complète

Date : 23/09/2026 — Branche : `feat/complete-demo` (depuis `feat/dashboard`). Statut : validé.

## Objectif

Aucun écran « Bientôt disponible », aucun lien vers une vue inadaptée. Marque Ascend Strategy,
design actuel et mode simulation conservés.

## Décisions validées par l'utilisateur

1. Paramètres en **lecture seule** ; le coupe-circuit existant y reste utilisable selon les
   autorisations (suspendre : membre ; réactiver : directeur — règles existantes).
2. Changement d'étape depuis le pipeline. `mandat_signe` exige une confirmation humaine
   explicite. **Seul un directeur** peut sortir un dossier de `mandat_signe`, avec
   confirmation explicite et **motif enregistré** ; l'historique du mandat est conservé
   (append-only). Garde en base (aucun contournement par UPDATE direct).
3. Conservation des données : « Non définie — à valider avant mise en production ». Aucune
   durée inventée.
4. Emma intégrée au parcours de démonstration : relance simulée avec validation humaine.
5. Écran « Automatisations » reporté (les écrans Agents IA montrent déjà agents, état,
   résultats et coupe-circuit).
6. Deux nouvelles migrations autorisées en local uniquement : `change_contact_stage`
   (+ garde trigger) et `list_agency_members`. Aucune migration existante modifiée.

## Jalons (commit + push à chaque jalon)

1. Changement d'étape (pipeline) + garde mandat.
2. `/taches` : tâches ouvertes, total exact, « Marquer comme faite ».
3. `/rendez-vous` : filtre exact « à venir » + passés.
4. `/parametres` (lecture seule + coupe-circuit) et `/inscription` sans badge.
5. Finitions du tableau de bord + parcours E2E complet (estimation → Léa → validation →
   Hugo → Emma → validation → Louis → confirmation RDV → Sarah → mandat humain → tableau de bord).
Audit `cybersecurite` après jalons 1 et 4, puis audit final. Vérification visuelle de chaque écran.
