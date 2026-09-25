---
name: premium-product-motion
description: Direction artistique, illustration UI et motion design produit pour AiaA (Ascend). À utiliser pour toute section visuelle, scène animée, fond vivant, écran ou composant dont la mise en scène compte (landing, agents IA, tableau de bord, parcours). Définit la philosophie « show, don't explain », la hiérarchie du mouvement, la palette blanc / noir / gris / cobalt, le responsive, le reduced motion et le workflow de validation visuelle.
---

# PREMIUM PRODUCT MOTION
## Skill de direction artistique, illustration UI et motion design produit

Tu travailles sur un produit web premium qui doit donner l'impression
d'avoir été conçu comme un véritable produit technologique, et non comme
un assemblage de composants UI.

La référence de qualité est :
- Apple dans la précision et la retenue du motion ;
- les interfaces de produits technologiques haut de gamme ;
- les présentations produit / keynote où l'interface elle-même explique
  le fonctionnement.

La direction n'est PAS une copie d'Apple.
Elle reprend son niveau de finition, sa précision et sa discipline.

Ce skill complète, sans les remplacer, `CLAUDE.md` (garde-fous produit, simulation,
socle légal) et `docs/design-system.md` (tokens, composants, règles déjà validées).
En cas de conflit, les garde-fous produit et légaux de `CLAUDE.md` gagnent toujours
(badge « Simulation », « Exemple fictif », aucune donnée ni métrique inventée).

---

# 0. RÈGLE LA PLUS IMPORTANTE

> **L'agent est libre d'inventer la représentation, mais pas libre de dégrader la direction artistique.**

## Liberté créative : élevée, mais encadrée par la DA

L'agent peut inventer complètement la mise en scène s'il trouve une meilleure
manière de raconter le concept. Il ne doit pas être prisonnier d'un composant
ou d'un modèle existant.

Mais il doit toujours respecter :

- blanc dominant ;
- noir / gris pour la structure ;
- cobalt comme signal ;
- interfaces vivantes ;
- motion subtil et précis ;
- 80 % visuel / 20 % texte ;
- aucune animation décorative sans fonction ;
- aucune esthétique « vibe coding » ;
- pas de néon ;
- pas de surcharge ;
- niveau de finition premium.

## Validation visuelle

Pour une **grosse section** (nouvelle scène, section de landing, écran refondu,
animation importante), le workflow est obligatoirement :

**Concept → scène → implémentation → responsive → tests → capture → passe de finition → validation visuelle.**

L'agent ne peut donc pas conclure :

> « Les tests passent, c'est terminé. »

Il doit aussi pouvoir dire :

> « Voilà ce que la scène raconte et voilà comment elle le raconte visuellement. »

Pour une petite modification, pas besoin de bloquer le travail avec une
validation visuelle systématique.

---

# 1. PHILOSOPHIE CENTRALE

## SHOW, DON'T EXPLAIN

Une section importante doit viser approximativement :

80 % visuel
20 % texte

Le texte explique.
Le visuel démontre.

Avant d'ajouter un paragraphe, demande-toi :

"Est-ce que cette information peut être comprise en regardant
une interface fonctionner ?"

Si oui :
→ montrer d'abord
→ expliquer ensuite

Ne jamais transformer une idée visuelle en paragraphe simplement
par facilité d'implémentation.

---

# 2. UNE SECTION = UNE IDÉE VISUELLE

Chaque section importante doit posséder un élément visuel principal.

Cet élément doit raconter l'idée de la section.

Exemples :

Automatisation
→ une interface reçoit une demande
→ analyse
→ transformation
→ action

Validation humaine
→ une action arrive
→ l'interface s'arrête
→ une validation humaine intervient
→ le flux reprend

Blocage administratif
→ le flux progresse
→ des événements s'accumulent
→ la capacité se sature
→ la progression ralentit

Réseau d'agents
→ les agents deviennent des nœuds fonctionnels
→ les informations circulent
→ certains événements déclenchent une action

Ne jamais utiliser une animation générique simplement parce
qu'elle "fait premium".

Chaque mouvement doit avoir une signification.

---

# 3. L'INTERFACE EST L'ILLUSTRATION

La priorité visuelle est :

INTERFACE VIVANTE
>
MOTION
>
STRUCTURE
>
TEXTE

Les illustrations doivent autant que possible être construites
à partir d'éléments d'interface :

- fenêtres
- cartes
- champs
- boutons
- messages
- notifications
- timelines
- tableaux
- graphes
- agents
- curseurs
- états
- indicateurs
- connexions
- validations

Éviter les illustrations décoratives qui ne représentent rien.

L'interface elle-même doit devenir la démonstration.

---

# 4. RÈGLE ANTI-VIBE-CODING

Une section n'est PAS considérée comme terminée si elle ressemble à :

- un titre
- un paragraphe
- trois cartes
- une icône par carte
- beaucoup de texte
- une petite animation décorative

Ce pattern est interdit lorsqu'une représentation plus forte
est possible.

Avant de considérer une section terminée, vérifier :

1. Quelle est son idée principale ?
2. Où est sa démonstration visuelle ?
3. Est-ce que je comprends quelque chose en regardant
   sans lire le texte ?
4. Est-ce que l'animation raconte quelque chose ?
5. Est-ce que l'interface semble conçue autour de cette idée ?
6. Est-ce qu'un designer produit premium aurait réellement
   présenté cette information comme cela ?

Si la réponse est non :
→ refaire la composition.

---

# 5. MOTION — RÉFÉRENCE APPLE

Le motion doit être :

- subtil
- fluide
- précis
- naturel
- intentionnel
- hiérarchisé

Jamais :

- flashy
- néon
- gadget
- permanent
- excessivement rapide
- rempli de bounce artificiel
- rempli de transformations inutiles

Le mouvement doit être suffisamment subtil pour rester élégant,
mais suffisamment précis pour être perceptible.

---

# 6. LE MOUVEMENT DOIT AVOIR UNE CAUSE

Ne jamais animer un élément uniquement parce qu'il est possible
de l'animer.

Chaque animation doit répondre à une cause :

entrée d'information
→ apparition

traitement
→ progression

connexion
→ liaison

décision
→ changement d'état

validation
→ confirmation

erreur
→ interruption / correction

attente
→ état suspendu

action
→ transition

fin
→ stabilisation

---

# 7. MICRO-MOTION

Privilégier les micro-mouvements :

- déplacement de quelques pixels
- opacity progressive
- changement de poids visuel
- légère variation d'échelle
- déplacement d'un curseur
- progression d'une ligne
- apparition d'un état
- changement de statut
- impulsion le long d'une connexion

Le mouvement doit généralement commencer doucement,
accélérer légèrement puis se stabiliser.

Éviter les animations linéaires mécaniques lorsque le mouvement
représente une interaction réelle.

---

# 8. HIÉRARCHIE DU MOUVEMENT

Tout ne doit pas bouger.

Hiérarchie :

1. élément actif
2. événement important
3. interface concernée
4. contexte
5. arrière-plan

Le premier plan doit toujours gagner contre le décor.

Si l'utilisateur regarde un agent :
→ l'agent bouge.

Le réseau derrière :
→ reste beaucoup plus calme.

---

# 9. ARRIÈRE-PLAN

Le fond doit donner de la profondeur.

Il peut utiliser :

- réseau
- lignes
- points
- particules
- connexions
- parallaxe légère

Mais il ne doit jamais devenir le sujet principal.

Règle :

"Je dois remarquer qu'il existe,
mais je ne dois pas regarder le fond au lieu du produit."

Aucun effet néon.

Aucune lueur excessive.

Le cobalt est principalement réservé :
→ aux signaux
→ aux états actifs
→ aux interactions
→ aux événements importants.

---

# 10. COULEURS

Direction générale :

BLANC
→ surface dominante

NOIR
→ information importante / structure

GRIS
→ contexte / profondeur / éléments secondaires

COBALT
→ activité / action / signal / état sélectionné

Le cobalt ne doit pas devenir une couleur décorative omniprésente.

Un élément bleu doit généralement signifier quelque chose.

---

# 11. COMPOSITION

Éviter les interfaces qui remplissent artificiellement l'espace.

Le vide est autorisé.

Mais le vide doit être intentionnel.

Ne jamais remplir un espace simplement parce qu'il semble vide.

Avant d'ajouter un composant :

"Est-ce qu'il améliore l'histoire ?"

Si non :
→ ne pas l'ajouter.

---

# 12. TYPOGRAPHIE

La typographie doit être extrêmement travaillée.

Priorités :

- hiérarchie claire
- grandes phrases courtes
- largeur de ligne maîtrisée
- interlignage précis
- contraste de poids
- respiration

Éviter les longs paragraphes dans les sections visuelles.

Si une phrase devient longue :
→ chercher si elle peut être transformée en information visuelle.

Une grande section produit ne doit pas ressembler à un article.

---

# 13. COPYWRITING

Le texte doit accompagner le visuel.

Structure recommandée :

PETIT LABEL

Grande idée en une phrase.

Une courte explication.

Puis :
→ démonstration visuelle.

Ne jamais utiliser le texte pour décrire longuement
ce que l'animation aurait pu montrer.

Exception : les textes légaux et de garde-fou (consentement, « Simulation »,
« Exemple fictif », validation humaine) ne sont jamais raccourcis ni supprimés
pour gagner de la place.

---

# 14. SCÉNARISER AVANT DE CODER

Avant d'implémenter une animation complexe :

1. Identifier l'idée.
2. Identifier l'état initial.
3. Identifier l'événement.
4. Identifier la transformation.
5. Identifier l'état final.
6. Identifier ce que l'utilisateur doit comprendre.

Puis seulement :
→ concevoir le motion.

Exemple :

État initial
"Demande reçue"

↓

Événement
"L'agent analyse"

↓

Transformation
"Informations regroupées"

↓

Validation
"Humain requis"

↓

Résultat
"Action préparée"

L'animation devient alors une petite histoire.

---

# 15. ANIMATIONS INTERACTIVES

Le meilleur niveau de finition apparaît lorsque
l'utilisateur interagit.

Prévoir lorsque pertinent :

- hover
- focus
- click
- scroll
- drag
- sélection
- changement d'état
- progression

Mais ne jamais transformer toute la page en jeu.

L'interaction doit renforcer la compréhension.

---

# 16. SCROLL

Le scroll peut révéler progressivement une scène.

Mais éviter :

- animations qui bloquent le scroll
- scroll hijacking inutile
- mouvements permanents
- grandes transitions spectaculaires

Préférer :

scroll
→ scène entre progressivement

scroll
→ état suivant

scroll
→ stabilisation

---

# 17. RESPONSIVE

Le mobile n'est PAS une version miniature du desktop.

À 390 px :

- réduire la complexité
- conserver l'idée
- conserver la hiérarchie
- simplifier les connexions
- réduire le nombre d'éléments simultanés
- préserver les interactions essentielles

Ne jamais simplement réduire les tailles.

Adapter la composition.

---

# 18. REDUCED MOTION

Toutes les animations importantes doivent avoir
un état stable équivalent.

Si reduced motion est activé :

- aucune information ne doit disparaître ;
- aucune étape ne doit dépendre d'une animation ;
- les interfaces doivent rester compréhensibles ;
- les éléments doivent apparaître dans leur état final.

Le mouvement améliore la compréhension.
Il ne doit jamais être nécessaire à la compréhension.

---

# 19. PERFORMANCE

Animations faites avec les primitives déjà présentes
dans le projet lorsque possible.

Ne pas ajouter de dépendance uniquement pour obtenir
un effet esthétique.

Priorité :

CSS / transforms / opacity
>
canvas contrôlé
>
JavaScript minimal

Éviter les animations qui déclenchent constamment
des recalculs de layout.

---

# 20. FINITION

Après l'implémentation :

NE PAS considérer le travail terminé immédiatement.

Faire une passe dédiée :

### PASS 1 — STRUCTURE
La hiérarchie est-elle correcte ?

### PASS 2 — MOTION
Le mouvement raconte-t-il quelque chose ?

### PASS 3 — DENSITÉ
Y a-t-il trop de texte ?
Trop de cartes ?
Trop de vide ?
Trop d'éléments ?

### PASS 4 — MICRO-DÉTAILS
- alignements
- bordures
- rayons
- ombres
- espacements
- états
- icônes
- transitions

### PASS 5 — RESPONSIVE
1440 px
→ 1024 px
→ 390 px

### PASS 6 — REDUCED MOTION

### PASS 7 — REGARD HUMAIN

Faire une capture.

La regarder comme un utilisateur.

Question finale :

"Est-ce que ça ressemble à un produit premium déjà fini,
ou à une interface générée à partir de composants ?"

Si la seconde réponse apparaît :
→ continuer la finition.

---

# 21. TEST VISUEL OBLIGATOIRE

Pour toute nouvelle animation importante,
produire au minimum :

- desktop 1440 px
- mobile 390 px
- reduced motion

Vérifier :

- lisibilité
- hiérarchie
- rythme
- cohérence
- performance
- absence de distraction
- cohérence avec la DA globale

---

# 22. RÈGLE FINALE

NE PAS DEMANDER :

"Quelle animation puis-je ajouter ?"

DEMANDER :

"Comment puis-je faire comprendre cette idée
sans avoir besoin de l'expliquer longuement ?"

Puis construire l'interface qui répond à cette question.

Le meilleur résultat est une interface où l'utilisateur
comprend le fonctionnement avant même d'avoir fini de lire.

---

# 23. RAPPORT ATTENDU (grosse section)

Le rapport d'une grosse section contient obligatoirement :

- **Ce que la scène raconte** (l'idée, en une phrase).
- **Comment elle le raconte visuellement** (état initial → événement →
  transformation → état final, et ce que l'utilisateur comprend sans lire).
- Les captures : 1440 px, 390 px, reduced motion (et 1024 px si la mise en page change).
- Le résultat des 7 passes de finition, honnêtement (ce qui reste perfectible).
- Les tests réellement exécutés et leur résultat.
