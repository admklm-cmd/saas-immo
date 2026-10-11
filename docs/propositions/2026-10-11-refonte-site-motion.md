# Proposition — refonte du site et de son mouvement

> Date : 11/10/2026. Document de décision, écrit pour vous, pas pour un développeur.
> Aucun code n'est écrit tant que vous n'avez pas tranché les questions du § 8.
> Ce document ne modifie pas `docs/design-system.md`. Une fois vos choix faits, ils y seront reportés.

## 0. En une minute

- Votre ressenti est juste, et la cause principale n'est pas la police : c'est la **structure**. Le hero raconte une histoire (un humain, des machines qui se passent le relais). Les sections d'après ne la continuent pas : elles redeviennent des présentations de fonctionnalités, chacune dans sa boîte.
- La police aggrave le sentiment « pas tech », mais seule, elle ne ferait que changer l'habillage.
- Je propose deux directions. **A, « Le dossier en direct »** : un seul dossier fictif traverse tout le site, du premier écran au mandat. **B, « Le journal de bord »** : le site se lit comme un journal d'événements horodatés, plus radical. Je recommande **A**, avec un petit emprunt à B (la ligne de journal comme fil discret).
- Livraison en 4 lots, du plus visible au plus lourd. Le lot 1 (police + rythme + fil du dossier) change déjà le ressenti.

---

## 1. Diagnostic honnête

### Ce que je vois dans la landing actuelle

Ordre actuel (`app/(marketing)/page.tsx`) : Hero → Problème → Solution → Agents → Contrôle → Résultat (ROI) → Final.

| Section | Ce qui la rend « plate » |
|---|---|
| **Hero** | Le point fort. Mais sous le terminal, on retombe sur une liste de « preuves » à puces, puis sur `HeroEcosystem` : une rangée de cartes d'agents. Le hero finit en widgets. |
| **Problème** | Un graphique de courbe + quatre causes en texte. Propre, mais c'est un schéma de manuel : rien ne rappelle l'humain ni les machines du hero. Aucun lien avec ce que le visiteur vient de voir. |
| **Solution** | Une **grille de 5 tuiles** (feuille de route, courbe, équipe, compte-rendu, garde-fous). Cinq boîtes de poids égal : l'œil ne sait pas laquelle regarder. C'est le cas typique du « que des widgets ». |
| **Agents** | La section la plus riche (7 modules, scènes illustrées), mais c'est un **carrousel** : le visiteur doit cliquer pour voir. Il manipule une interface au lieu de voir une histoire se dérouler. Elle redit aussi ce que Solution a déjà dit (la même feuille de route en 7 étapes). |
| **Contrôle** | Encore **deux tuiles** dans une grille. Le message le plus important du produit (l'humain décide) est traité à égalité avec le reste. |
| **Résultat (ROI)** | **Quatre widgets** avec curseurs. Utile, mais registre « calculette » : on change de ton sans transition. |
| **Final** | Un grand panneau noir avec un **carrousel** de plus (7 étapes) : on revoit le parcours une troisième fois. |

### Les causes précises

1. **Tout a le même poids.** Cartes et tuiles de tailles proches, bords fins, ombre légère. Rien ne domine, donc rien ne marque. Les sites de référence jouent au contraire sur de très grands écarts : un élément immense, du vide, puis un détail minuscule.
2. **Pas de fil narratif continu.** Le hero a un récit (l'humain, les mains, le terminal). Ensuite chaque section recommence à zéro avec son titre et son décor. Le visiteur change de sujet sept fois au lieu de suivre une seule histoire.
3. **Pas de changement d'échelle ni de rythme.** Toutes les sections ont la même construction : titre, paragraphe, puis boîtes. Aucune ne prend tout l'écran, aucune ne passe en sombre, aucune ne devient une scène où l'on reste.
4. **Le parcours en 7 étapes est répété trois fois** (hero, agents, final), chaque fois en cartes. Montré une fois, en grand, il serait plus fort.
5. **Le mouvement est surtout « apparaître en fondu ».** Les éléments arrivent (révélation, flou vers net), puis restent immobiles. Peu de mouvements **expliquent** quelque chose : un trait qui relie, une information qui passe d'une main à l'autre. Seul le hero le fait vraiment.
6. **Le titre est trop « éditorial ».** Bricolage Grotesque + un mot en italique serif (Instrument Serif) évoque un magazine ou un studio de création, pas un outil technologique.
7. **Très peu de matière « machine ».** Le monospace n'apparaît qu'en petites touches. Le hero montre un terminal ; le reste du site n'en garde aucune trace.
8. **Beaucoup de pictogrammes et de pastilles.** Les icônes sont réussies (vous l'avez dit), mais elles servent à remplir les cartes ; elles ne portent pas le récit.

### L'espace agence

- Le tableau de bord (`app/(app)/dashboard`) empile des **listes et blocs de même valeur** (à faire, messages, rendez-vous, résumé des agents, frise du pipeline). La frise est le seul élément qui raconte quelque chose, mais elle ne domine pas.
- Plusieurs zones se disputent l'attention ; la question « quelle est ma prochaine action ? » n'a pas de réponse visuelle unique.
- Le « relais humain ⇄ machine » du hero n'y apparaît jamais.

### Ce qui fonctionne et qu'on garde

Le hero (points, nanorobots, terminal), la famille d'icônes, le noir/blanc/gris perle avec cobalt rare, les garde-fous (simulation, validation humaine), le graphique d'illustration sans chiffre, la discipline « zéro boucle gratuite ».

---

## 2. Concept directeur

L'idée commune aux deux directions : **le hero ne doit pas être le seul moment où le site raconte quelque chose**. Le visiteur doit pouvoir suivre une seule histoire jusqu'en bas : *une demande entre, des agents préparent, un humain décide, un mandat naît*.

### Direction A — « Le dossier en direct » (recommandée)

**Principe.**
Un seul dossier fictif (exemple La Ciotat, étiqueté « Exemple fictif — simulation ») traverse tout le site. Un fil vertical discret (un trait fin avec un point cobalt) descend le long de la page et avance au défilement. Chaque section est **une étape de ce dossier**, pas une rubrique.

**Ce que voit le visiteur en défilant.**
1. **Hero (conservé).** L'humain en points, les nanorobots, le terminal. Le terminal écrit la première ligne du dossier : « Demande reçue ». Le fil cobalt naît ici.
2. **Le blocage.** Le fil ralentit sur un amas de petites tâches (relances, doublons, pièces manquantes) qui s'accumulent autour du dossier. On le voit **s'enliser**. À la place du graphique de courbe : la même idée, mais avec le dossier lui-même.
3. **Le relais des agents.** Plein écran, sans cliquer : en défilant, le dossier passe de Léa à Hugo, à Emma ; le cadre reste, le contenu change sur place. Le terminal écrit la ligne correspondante.
4. **L'arrêt humain.** Le fil s'arrête devant une barre, le point devient « Vous ». Le fond passe en noir. C'est la section la plus forte du site, et elle est courte : « Rien ne part sans vous. »
5. **Louis, Sarah, le mandat.** Le fil repart, la page repasse en clair. Le dossier atteint « Mandat », confirmé par le conseiller, jamais par une machine.
6. **Ce que ça change.** Les ordres de grandeur du ROI restent, mais comme une ligne de bilan du dossier, pas quatre widgets : un seul chiffre indicatif à la fois.
7. **Final.** Court, sombre, deux boutons. Plus de carrousel.

**Ce qui change par rapport à aujourd'hui.**
- La grille de 5 tuiles disparaît ; son contenu devient la scène des agents.
- Les carrousels (agents, final) disparaissent ; le défilement remplace le clic.
- Une seule histoire au lieu de sept rubriques.

**Risques.**
- Un défilement « accroché » peut agacer ou poser des problèmes d'accessibilité. Règle : on ne bloque jamais le défilement, on **ralentit** seulement un élément ; tout reste lisible sans mouvement.
- Si le fil est trop présent, le site fait « effets spéciaux ». Il doit rester un trait fin.
- La compréhension en 5 secondes doit tenir même pour quelqu'un qui ne défile pas jusqu'en bas.

**Effort : moyen à grand.** On réutilise beaucoup (scènes des agents, terminal, nanorobots, icônes), mais la disposition des sections change.

### Direction B — « Le journal de bord »

**Principe.**
Le site entier se lit comme le journal du hero : une colonne centrale, des lignes horodatées (« 09:14 Léa — fiche créée »), et des **visuels qui s'ouvrent dans les lignes**. Plus de sections autonomes : des chapitres du journal. Ambiance nettement « console ».

**Ce que voit le visiteur en défilant.**
1. Hero identique.
2. Le journal continue sous le terminal ; chaque nouvelle ligne ouvre un visuel pleine largeur (le blocage, chaque agent, la validation).
3. Les lignes « humain » se distinguent des lignes « machine » (fond blanc et double contour contre monospace sur gris).
4. Le journal se termine par « Mandat confirmé par le conseiller » et les boutons.

**Ce qui change.** Beaucoup plus de monospace et de ton technique ; moins de rubriques, plus de continuité de lecture.

**Risques.**
- Un dirigeant d'agence peut trouver un journal rébarbatif : il doit comprendre par l'image, pas par le texte.
- Plus difficile à rendre beau sur mobile (lignes longues).
- Moins de variété de rythme : tout est une colonne.

**Effort : moyen.** Moins de scènes nouvelles, mais réécriture du ton et de la mise en page.

### Recommandation

**La direction A**, avec un seul emprunt à B : la **ligne de journal** (une ligne monospace qui s'écrit) sert de sous-titre à chaque étape.

Pourquoi : A garde la valeur du produit au centre (un dossier qui avance, un humain qui décide), reste lisible par un dirigeant sans culture technique, et réutilise le plus de ce qui existe. B paraît plus « tech » mais risque de faire un site de développeurs, alors que vos clients sont des agences immobilières.

---

## 3. Typographie : police ou structure ?

**Ma réponse : surtout la structure, un peu la police.**

- Changer seulement la police sur la structure actuelle donnerait un site un peu plus technique, mais toujours une suite de cartes.
- Ce qui fait « produit IA récent » chez Grok / xAI, ce n'est pas une police rare : ce sont de **très grands écarts d'échelle**, beaucoup de vide, du monospace pour tout ce qui est machine, et une seule chose qui bouge à la fois.
- La police actuelle renforce le côté magazine. Là, vous avez raison : on peut gagner du « tech » en la changeant.

Toutes les polices ci-dessous sont disponibles sur Google Fonts sous licence libre (OFL) et se chargent avec `next/font/google`, comme aujourd'hui.

### Option 1 — « Geist poussé » (la plus simple)

- Titres : **Geist**, graisse 600 à 700, plus serrée, plus grande.
- Texte : **Geist** (déjà chargée).
- Machine, données, journal : **Geist Mono**, utilisée **beaucoup plus** (sur-titres, lignes de journal, étiquettes, valeurs).
- Le mot accentué quitte l'italique serif : il passe en Geist Mono (ou souligné cobalt fin).
- **Effet attendu :** unité nette avec le hero (déjà en Geist Mono), ton « produit moderne » proche des outils IA récents, moins de polices à charger donc plus léger.
- **À refaire :** retirer Bricolage Grotesque et Instrument Serif ; revoir le composant des titres éditoriaux et les effets du mot accentué ; revérifier les retours à la ligne et les tests de titres.
- **Risque :** peut sembler générique si la structure ne change pas.

### Option 2 — « Grotesque technique + mono » (plus de caractère)

- Titres : **Space Grotesk**, graisse 500 à 700.
- Texte : **Inter**.
- Machine, données, journal : **JetBrains Mono**.
- Mot accentué : en mono, majuscules espacées ou souligné cobalt.
- **Effet attendu :** personnalité affirmée, ton « laboratoire / console », très éloigné du look magazine actuel.
- **À refaire :** remplacer les familles de titre, texte et mono ; revoir les échelles de taille (Space Grotesk est plus large : titres un peu plus petits) ; repasser sur les titres, les chiffres du ROI et le terminal du hero pour garder la cohérence.
- **Risque :** police très reconnaissable ; en excès, effet « startup 2021 ». À doser avec du blanc et de la retenue.

### Recommandation

**Option 1 pour le lot 1**, avec un essai de l'Option 2 sur une page de test avant de s'engager (vous voyez la différence en direct). Dans les deux cas : **mot accentué en mono plutôt qu'en italique serif** — c'est la plus petite modification qui change le plus le ressenti.

---

## 4. Système de mouvement

### Principe

Aujourd'hui le mouvement est un habillage. Désormais chaque mouvement doit **dire quelque chose** : « ça passe de l'un à l'autre », « ça s'écrit », « ça s'arrête devant vous ». Une seule idée qui bouge par écran.

### Les 6 mouvements signature

| # | Nom | Ce que ça fait | Ce que ça explique | Où |
|---|---|---|---|---|
| 1 | **Transmission** | Un petit point cobalt part d'un élément, suit un trait, arrive sur un autre qui réagit (s'allume brièvement). | Une information passe d'un agent à un autre, ou d'une machine à un humain. | Entre les agents, vers « Vous » |
| 2 | **Frappe** | Une ligne de journal s'écrit caractère par caractère, une fois, curseur qui disparaît à la fin. | Une action vient d'avoir lieu. | Sous chaque étape, terminal du hero |
| 3 | **Trait qui relie** | Un trait se dessine d'un point à un autre, sa progression liée au défilement. | Le dossier avance, deux choses sont liées. | Fil vertical du dossier, rail des agents |
| 4 | **Arrêt** | Le trait s'arrête sur une barre, l'ensemble se fige un instant, le point « Vous » s'allume. | Rien ne passe sans validation humaine. | Section contrôle, mandat |
| 5 | **Compteur** | Un nombre monte jusqu'à sa valeur, une fois, en mono. Seulement sur des valeurs réelles ou clairement marquées indicatives. | Une mesure, un ordre de grandeur. | Bilan ROI |
| 6 | **Révélation par masque** | Un volet découvre un contenu (gauche vers droite ou bas vers haut). Pas de flou, pas de fondu. | Un avant/après, un contenu qui apparaît. | Du blocage vers le dossier traité |

Option : un 7ᵉ, **déplacement de dossier** (une fiche passe d'une colonne à l'autre), pour le pipeline et la confirmation dans l'espace agence.

### Qui fait quoi

- **CSS** : états simples (survol, apparition, masque, focus). Léger, fiable, fonctionne sans JavaScript.
- **Anime.js 4.5.0** : tout ce qui est **orchestré** — transmissions, tracés de traits, frappe, séquences, progression liée au défilement. Déjà installé et déjà utilisé par les nanorobots.
- **`motion` (Bklit UI)** : **uniquement** les graphiques de l'espace agence (courbe en aires, entonnoir). Pas sur la landing, pour ne pas faire cohabiter deux moteurs d'animation.

### Règles

1. **Une idée par écran.** Pas deux mouvements concurrents dans le champ de vision.
2. **Déclenchement au défilement**, une fois, quand la section entre à l'écran.
3. **Pas de boucle gratuite.** Ce qui se répète doit représenter une activité réelle ; sinon on joue une fois (règle déjà en place).
4. **Pause et rejouer :** on garde le bouton « Rejouer les animations ».
5. **`prefers-reduced-motion` :** l'état final est affiché tout de suite, rien ne bouge, tout reste lisible (transmission = trait fixe, frappe = ligne complète).
6. **Performance :** uniquement `transform` et `opacity` (et le tracé de trait), arrêt de ce qui n'est plus visible, budget conservé : moins de 4 ms par image sur ordinateur.
7. **Aucune progression fictive :** un trait qui avance ne doit jamais faire croire qu'un traitement réel est en cours.

---

## 5. Structure proposée de la landing (Direction A)

Séquence actuelle : Hero → Problème → Solution → Agents → Contrôle → Résultat → Final.

| # | Section | Action | Message | Visuel principal (pas une grille de cartes) | Mouvement signature |
|---|---|---|---|---|---|
| 1 | **Hero** | **Garde.** On retire la liste de « preuves » à puces et la rangée de cartes `HeroEcosystem`. Le terminal lance le fil. | « Une demande arrive. Des agents préparent. Vous décidez. » | L'humain en points, nanorobots, terminal (existant). | Frappe ; naissance du fil. |
| 2 | **Le blocage** | **Remplace** « Problème » : plus de graphique, une scène. | « L'administratif absorbe vos mandats. » | Un dossier au centre, autour de lui des petites tâches (relance, doublon, pièce manquante) qui s'accumulent. Exemple fictif étiqueté. | Révélation par masque (de l'enlisement vers le dossier traité). |
| 3 | **Le relais** | **Fusionne** « Solution » + « Agents ». Ni grille de 5 tuiles, ni carrousel. | « Cinq agents se passent le dossier. » | Une scène large (le dossier) et, à côté, un **rail vertical** des agents ; en défilant, la scène se transforme sur place pour chaque agent. | Transmission, trait qui relie, frappe. |
| 4 | **L'arrêt humain** | **Promeut** « Contrôle » en section pivot, courte, **en noir**. | « Rien ne part sans vous. » | Le trait s'arrête sur une barre ; une zone « Vous » contient les deux décisions (premier contact, mandat). Garde-fous en une ligne chacun. | Arrêt. |
| 5 | **Le mandat** | **Nouveau, court.** Reprend Louis → Sarah → Mandat. | « Le mandat est confirmé par le conseiller. » | Le dossier arrive au bout du fil, « Mandat » en cercle plein, jamais automatique. | Trait qui relie (fin). |
| 6 | **Ce que ça change** | **Allège** « Résultat (ROI) ». | « Des ordres de grandeur, jamais une promesse. » | Un seul grand chiffre indicatif à la fois avec sa source, choix par onglet au lieu de 4 widgets. Libellés « source / hypothèse / estimation » conservés. | Compteur. |
| 7 | **Final** | **Raccourcit :** plus de carrousel. | « Estimer un bien, ou se connecter. » | Panneau sombre, titre, deux boutons, note prototype. | Aucun (fin calme). |

**Supprimé :** la grille de 5 tuiles, les deux carrousels, la liste de preuves du hero, les quatre widgets simultanés du ROI.
**Gardé :** hero, terminal, nanorobots, icônes, scènes des agents (réutilisées dans « Le relais »), graphique de blocage (réutilisable en version réduite), toutes les mentions « Exemple fictif — simulation », le bouton « Rejouer ».
**Ajouté :** le fil vertical du dossier, la section noire de l'arrêt humain, l'alternance clair/sombre.

Rythme obtenu : clair, clair, clair, **noir**, clair, clair, noir. C'est ce changement d'échelle et de fond qui manque aujourd'hui.

Mobile : le fil devient un trait fin à gauche ; la scène du « Relais » passe au-dessus du rail (rail horizontal défilable). Aucune information n'est masquée.

---

## 6. Espace agence : 5 améliorations ciblées

Pas de refonte lourde. Chaque écran reçoit **une action principale** et une zone qui domine.

1. **Tableau de bord : une phrase, une action, puis le reste.** En haut, une ligne qui dit l'essentiel (par exemple « des messages attendent votre validation », avec le vrai nombre) et un seul bouton principal. Les listes passent dessous, plus calmes.
2. **Courbe en aires (Bklit) en bandeau, pas en carte.** Pleine largeur sous la phrase d'état, sans cadre épais, avec des axes réels. Aucune donnée inventée : si les données manquent, l'état vide l'explique.
3. **Entonnoir (Bklit) en tête du pipeline.** Il devient la vue principale du haut de page ; la frise actuelle passe en second niveau. Chaque étage est cliquable pour filtrer la liste.
4. **Le relais humain ⇄ machine là où l'humain décide.** Sur « Messages à valider » et « Relances », la signature du site : une ligne de journal (« Emma a préparé — en attente de vous ») et le point « Vous ». Les garde-fous existants ne bougent pas.
5. **Un seul mouvement de confirmation.** À la validation, le dossier se déplace visiblement vers l'étape suivante, puis une ligne de journal confirme. Aucune autre animation décorative.

Inchangés : garde-fous, mention « simulation », états vides et d'erreur.

---

## 7. Plan par lots

Chaque lot est livrable seul ; vous pouvez vous arrêter après n'importe lequel.

### Lot 1 — Police, rythme et fil (le plus de ressenti pour le moins d'effort)
- Nouvelle typographie (§ 3), mot accentué en mono.
- Alternance clair/noir (sections 4 et 7 en sombre), plus de respirations.
- Retrait de la liste de preuves du hero et du carrousel final.
- Fil vertical du dossier (trait fin + point), sans nouvelle scène.
- **Vous validez :** la police (page de test des deux options), le rythme, la sensation générale.
- **Gemini en amont** (cf. `docs/outils-ia.md`) : 2 maquettes du haut de page (Option 1 vs Option 2) ; une image de référence du passage clair vers noir.

### Lot 2 — Le blocage et le relais
- Scène « blocage » à la place du graphique.
- Fusion Solution + Agents en une scène qui se transforme au défilement ; suppression de la grille et du carrousel.
- Mouvements : transmission, trait qui relie, frappe.
- **Vous validez :** que la scène se comprend sans lire.
- **Gemini :** storyboard en 4 images (début, enlisé, traité, validé) ; propositions de lignes de journal courtes.

### Lot 3 — L'arrêt humain, le mandat, le bilan, le final
- Section noire « Rien ne part sans vous », section mandat, ROI allégé, final raccourci.
- Mouvements : arrêt, compteur.
- Passage complet mouvement réduit, mobile, contrastes.
- **Vous validez :** le moment « l'humain décide » (cœur du produit), les libellés ROI.
- **Gemini :** maquette de la section noire ; relecture du rendu mobile sur captures.

### Lot 4 — Espace agence
- Phrase d'état + action principale ; courbe en aires ; entonnoir ; signature du relais ; mouvement de confirmation.
- **Vous validez :** que chaque écran répond à « quelle est ma prochaine action ? ».
- **Gemini :** maquette du tableau de bord avec la courbe en bandeau.

Ordre recommandé : **1, 2, 3, 4**. Le lot 4 est indépendant et peut passer en premier si l'espace agence vous presse davantage.

À chaque lot : tests existants adaptés, vérification à 1440 / 1024 / 390 px, mouvement réduit, contrastes. L'audit final reste le vôtre.

---

## 8. Questions à trancher

1. **Direction A (« dossier en direct ») ou B (« journal de bord ») ?**
   *Ma réponse : A, avec la ligne de journal de B en sous-titre de chaque étape.*
2. **Police : Option 1 (Geist poussé) ou Option 2 (Space Grotesk + JetBrains Mono) ?**
   *Ma réponse : Option 1 d'abord ; on essaie l'Option 2 sur une page de test avant de s'y engager.*
3. **Le mot accentué des titres passe-t-il de l'italique serif au monospace ?**
   *Ma réponse : oui, c'est le plus petit changement pour le plus gros effet.*
4. **Supprime-t-on la grille de 5 tuiles et les deux carrousels (leur contenu est repris dans « Le relais » et « L'arrêt humain ») ?**
   *Ma réponse : oui, sinon la landing reste une suite de cartes.*
5. **Le ROI à 4 widgets passe-t-il à un chiffre indicatif à la fois ?**
   *Ma réponse : oui, libellés source / hypothèse / estimation conservés. Si vous tenez aux curseurs, on les garde dans un panneau replié.*
6. **Ordre : site d'abord (lots 1 à 3) ou espace agence d'abord (lot 4) ?**
   *Ma réponse : site d'abord, c'est ce que vous avez remarqué et ce qui vend ; l'espace agence ensuite, avec les graphiques Bklit.*
