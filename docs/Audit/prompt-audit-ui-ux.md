# AUDIT UI/UX COMPLET — À copier-coller dans Claude Code

---

Tu es un designer UX senior spécialisé dans les applications métier terrain. Tu vas effectuer un audit UI/UX complet de cette application de gestion de flotte automobile pour l'APAJH Mayotte.

## CONTEXTE

**L'application n'a PAS encore été testée par de vrais utilisateurs.** Cet audit doit anticiper les problèmes que les utilisateurs terrain vont rencontrer AVANT qu'ils ne les découvrent.

### Les utilisateurs réels

| Profil | Contexte | Besoin principal | Contrainte |
|--------|----------|-----------------|------------|
| **Marc** (Professionnel) | Agent terrain, smartphone Android, souvent pressé le matin | Réserver un véhicule rapidement, saisir les km au retour | Peu patient, veut du rapide |
| **Marie** (Professionnel) | Agente terrain, se positionne au dernier moment | Voir les dispos en temps réel, réserver un créneau libre | Besoin d'une vue claire instantanée |
| **Ahmed** (Professionnel) | Éducateur technique, aveugle, lecteur d'écran | Réserver un véhicule pour un accompagnement (passager) | 100% clavier + lecteur d'écran |
| **Secrétaire** (Manager) | Au bureau, PC, gère planning + clés pour 10-20 agents | Vue d'ensemble du planning, remettre/récupérer les clés | Multitâche, doit aller vite |
| **Directeur** | Supervise les 2 pôles, veut des stats | Vue globale, reporting, incidents | Pas le temps de chercher l'info |
| **Chef de service** | Crée le planning de lavage | Assigner des agents aux véhicules pour le nettoyage | Veut un planning visuel simple |

### Contexte Mayotte
- Réseau 4G instable par endroits → l'app doit être rapide et légère
- Majorité des agents sur smartphone Android (pas toujours récent)
- Habitudes numériques variables (certains agents peu à l'aise avec le numérique)
- Soleil fort → les contrastes doivent être bons en extérieur

### Stack visuelle actuelle
- Tailwind CSS 4
- Design glassmorphism (verre dépoli)
- Couleur primaire : vert foncé (#4A6728)
- Couleur accent : orange (#F18E38)
- Icônes : Lucide React
- Interface en français

---

## TA MISSION

Scanne TOUTES les pages et composants du frontend. Analyse chaque écran comme si tu étais chacun des 6 utilisateurs listés ci-dessus. Produis un fichier `AUDIT_UX.md` à la racine du projet.

---

## ÉTAPES D'ANALYSE

### 1. AUDIT ERGONOMIE GÉNÉRALE

#### 1.1 Navigation

Inspecte `frontend/src/components/ui/Sidebar.tsx` et la structure de navigation :

- [ ] Le nombre de liens dans la sidebar est-il raisonnable ? (max 7-8 pour éviter la surcharge cognitive)
- [ ] Les labels sont-ils clairs pour un utilisateur non-technique ? (pas de jargon dev)
- [ ] Les icônes sont-elles intuitives ? (une icône seule sans label est-elle compréhensible ?)
- [ ] La navigation est-elle adaptée à chaque rôle ? (un PROFESSIONNEL voit-il des liens qui ne le concernent pas ?)
- [ ] Y a-t-il un indicateur visuel de la page active ? (highlight, couleur, bordure)
- [ ] La sidebar est-elle rétractable sur mobile ? (hamburger menu)
- [ ] Le bouton de déconnexion est-il facilement trouvable mais pas accidentellement cliquable ?
- [ ] L'ordre des liens suit-il la fréquence d'usage ? (les plus utilisés en haut)

**Recommandation d'ordre de navigation pour un PROFESSIONNEL :**
1. Tableau de bord (accueil)
2. Réserver / Planning
3. Nettoyage (si assigné)
4. Paramètres
5. Déconnexion

**Recommandation d'ordre pour un MANAGER/Secrétaire :**
1. Tableau de bord
2. Planning réservations
3. Nettoyage
4. Administration (sous-menu)
5. Paramètres

#### 1.2 Cohérence visuelle

- [ ] Les boutons primaires ont-ils tous le même style ? (même couleur, même taille, même border-radius)
- [ ] Les boutons de suppression sont-ils tous en rouge ?
- [ ] Les boutons d'annulation sont-ils tous identiques (outline/ghost) ?
- [ ] Les modales ont-elles toutes le même gabarit ? (même largeur, même espacement, même position des boutons)
- [ ] Les messages d'erreur ont-ils tous le même style ? (couleur, icône, position)
- [ ] Les messages de succès ont-ils tous le même style ?
- [ ] Les tableaux de données ont-ils tous la même structure ? (header, lignes alternées, pagination)
- [ ] Les cartes (VehicleCard, etc.) suivent-elles le même pattern ?
- [ ] Les états de chargement sont-ils cohérents ? (skeleton, spinner — un seul style partout)
- [ ] Les états vides sont-ils gérés ? ("Aucune réservation" au lieu d'un tableau vide)

#### 1.3 Clarté de l'information

- [ ] Les statuts des véhicules sont-ils immédiatement compréhensibles ? (pastille couleur + texte)
- [ ] Les dates sont-elles affichées en format français ? (24/03/2026 et non 2026-03-24)
- [ ] Les heures sont-elles en format 24h ? (14h30 et non 2:30 PM)
- [ ] Les nombres sont-ils formatés ? (12 500 km et non 12500)
- [ ] Les messages de confirmation sont-ils clairs ? ("Réservation créée pour le 24/03 de 8h à 12h" et non "Success")
- [ ] Les messages d'erreur expliquent-ils QUOI faire ? ("Ce créneau est déjà réservé — choisissez un autre horaire" et non "Error 409")

---

### 2. AUDIT DESIGN VISUEL

#### 2.1 Palette de couleurs

Extrais toutes les couleurs utilisées dans l'app (inspecte les fichiers Tailwind config, CSS variables, et les couleurs hardcodées dans les composants).

Vérifie :
- [ ] La palette est-elle cohérente ? (2-3 couleurs principales maximum)
- [ ] Les couleurs ont-elles une signification claire ? (vert = disponible, rouge = indisponible, orange = attention)
- [ ] Le glassmorphism est-il lisible sur petit écran ? (les effets de flou peuvent masquer le texte)
- [ ] Les contrastes sont-ils suffisants pour une utilisation en extérieur/soleil ? (ratio WCAG AA)

**Vérifier spécifiquement :**
- Texte sur fond glassmorphism : le texte est-il lisible ?
- Couleur accent orange (#F18E38) sur fond blanc : ratio suffisant pour du texte petit ?
- Textes grisés/muted : sont-ils lisibles sur fond clair ET sur fond glassmorphism ?
- Statuts véhicule : les couleurs sont-elles distinguables par un daltonien ? (ne pas se fier uniquement à la couleur — ajouter un texte ou une icône)

#### 2.2 Typographie

- [ ] La taille de police de base est-elle ≥ 16px ? (recommandé pour mobile)
- [ ] Y a-t-il des textes en dessous de 12px ? (illisible sur petit écran)
- [ ] La hiérarchie typographique est-elle claire ? (titre > sous-titre > corps > légende)
- [ ] La police est-elle lisible ? (pas de font décoratif pour le contenu)
- [ ] L'interligne est-il suffisant ? (1.5 minimum pour le corps de texte)

#### 2.3 Espacement et densité

- [ ] Les zones tactiles sont-elles ≥ 44x44px ? (standard mobile Apple/Google)
- [ ] Y a-t-il assez d'espace entre les éléments cliquables ? (pas de "fat finger" accidentel)
- [ ] Les marges sont-elles cohérentes ? (même espacement partout)
- [ ] Les formulaires sont-ils aérés ? (pas de champs collés les uns aux autres)
- [ ] Les cartes ont-elles assez de padding interne ?
- [ ] Le contenu respire-t-il ? (pas de mur de texte)

#### 2.4 Iconographie

- [ ] Les icônes Lucide utilisées sont-elles intuitives ? (une icône doit être comprise sans le label)
- [ ] La taille des icônes est-elle cohérente ? (même taille partout dans la sidebar, les boutons, etc.)
- [ ] Les icônes sont-elles accompagnées de texte pour les actions importantes ? (pas d'icône seule pour "Supprimer")

---

### 3. AUDIT PARCOURS UTILISATEUR

Pour chaque parcours ci-dessous, simule mentalement l'expérience de l'utilisateur concerné. Compte le nombre de clics/étapes et identifie les points de friction.

#### 3.1 Parcours "Marc réserve un véhicule" (PROFESSIONNEL)

Le parcours idéal : **≤ 3 clics**

```
Étape 1 : Marc ouvre l'app → il voit le dashboard
Étape 2 : Il clique sur un véhicule disponible
Étape 3 : Il remplit le formulaire de réservation (date, heure, motif)
Étape 4 : Il confirme → message de succès
```

**Vérifier :**
- Combien de clics faut-il réellement pour réserver ?
- Le formulaire de réservation est-il pré-rempli intelligemment ? (date du jour, heure courante arrondie au quart d'heure suivant)
- Les véhicules disponibles sont-ils immédiatement visibles ? (pas besoin de filtrer/chercher)
- Après réservation, l'utilisateur est-il redirigé quelque part ? Où ?
- Le message de confirmation est-il clair ? (véhicule + date + heure)

#### 3.2 Parcours "Marc démarre un trajet" (PROFESSIONNEL)

```
Étape 1 : Marc arrive au véhicule
Étape 2 : Il ouvre l'app, trouve le véhicule
Étape 3 : Il clique "Démarrer le trajet"
Étape 4 : Il saisit le kilométrage de départ
```

**Vérifier :**
- Le bouton "Démarrer le trajet" est-il visible immédiatement ? (pas caché dans un menu)
- Le champ kilométrage est-il de type numérique ? (clavier numérique sur mobile)
- Le kilométrage actuel du véhicule est-il pré-affiché comme référence ?
- Que se passe-t-il si Marc se trompe de km ? Peut-il corriger ?

#### 3.3 Parcours "Marc termine un trajet" (PROFESSIONNEL)

```
Étape 1 : Marc revient au bureau
Étape 2 : Il ouvre l'app, trouve son trajet en cours
Étape 3 : Il clique "Terminer le trajet"
Étape 4 : Il saisit le km de retour + observations
```

**Vérifier :**
- Le trajet en cours est-il mis en évidence sur le dashboard ? (badge, couleur, position en haut)
- Le bouton "Terminer" est-il aussi visible que "Démarrer" ?
- La validation km retour ≥ km départ est-elle claire ? (message d'erreur compréhensible)
- Peut-il ajouter des observations (notes de texte) ?

#### 3.4 Parcours "Marie cherche un véhicule disponible" (PROFESSIONNEL)

Marie ne réserve pas à l'avance — elle regarde le planning au dernier moment.

```
Étape 1 : Marie ouvre l'app
Étape 2 : Elle veut voir QUELS véhicules sont libres MAINTENANT ou dans l'heure
Étape 3 : Elle en choisit un et réserve
```

**Vérifier :**
- Le dashboard montre-t-il clairement les véhicules disponibles vs indisponibles ?
- Y a-t-il un filtre "Disponible maintenant" ?
- La vue calendrier permet-elle de voir les créneaux libres d'un coup d'œil ?
- Les codes couleur sont-ils évidents ? (vert = libre, rouge/gris = pris)

#### 3.5 Parcours "Secrétaire gère la journée" (MANAGER)

La secrétaire arrive le matin. Elle doit :
1. Voir toutes les réservations du jour
2. Préparer les pochettes (clés + documents)
3. Quand un agent arrive : remettre les clés
4. Quand il revient : récupérer les clés

**Vérifier :**
- Y a-t-il une vue "Réservations du jour" dédiée ?
- Les réservations sont-elles triées par heure de départ ?
- Le nom de l'agent et le véhicule sont-ils clairement affichés ?
- Le statut de chaque réservation est-il visible ? (en attente, clés remises, en cours, terminé)
- Combien de clics pour voir le planning de la semaine complète ?

#### 3.6 Parcours "Chef crée le planning de lavage" (MANAGER/DIRECTEUR)

```
Étape 1 : Le chef va dans Administration > Nettoyage
Étape 2 : Il sélectionne la semaine
Étape 3 : Pour chaque véhicule, il assigne 2 agents
Étape 4 : Il valide
```

**Vérifier :**
- L'assignation est-elle intuitive ? (drag-and-drop, checkboxes, multi-select ?)
- Peut-on assigner rapidement le même agent à plusieurs véhicules ?
- Le planning est-il copiable d'une semaine à l'autre ? (si c'est souvent le même)
- Les agents disponibles sont-ils filtrés par pôle ?

#### 3.7 Parcours "Directeur consulte l'état du parc" (DIRECTEUR)

```
Étape 1 : Le directeur ouvre l'app
Étape 2 : Il veut savoir : combien de véhicules disponibles ? incidents en cours ? entretiens à prévoir ?
```

**Vérifier :**
- Le dashboard directeur montre-t-il les KPIs essentiels ? (véhicules dispos, en maintenance, incidents ouverts)
- Les infos sont-elles accessibles sans clic ? (visible directement sur la page d'accueil)
- Y a-t-il une vue par pôle ? (Enfance vs Adulte)
- Les alertes (assurance expirée, CT à faire) sont-elles visibles immédiatement ?

---

### 4. POINTS DE FRICTION FRÉQUENTS DANS LES APPS MÉTIER

Vérifie si ces anti-patterns classiques sont présents :

- [ ] **Formulaire long** : le formulaire de réservation a-t-il trop de champs pour une action quotidienne ?
- [ ] **Confirmation inutile** : y a-t-il des confirmations pour des actions non destructives ? (réserver ne devrait pas demander "Êtes-vous sûr ?")
- [ ] **Confirmation manquante** : les actions destructives (supprimer véhicule, annuler réservation) demandent-elles bien une confirmation ?
- [ ] **Pas de retour arrière** : l'utilisateur peut-il annuler une action qu'il vient de faire ? (annuler une réservation qu'il vient de créer)
- [ ] **Page blanche** : que voit un nouvel utilisateur qui se connecte pour la première fois ? (onboarding ? message d'accueil ? ou juste un dashboard vide ?)
- [ ] **Erreur sans issue** : les messages d'erreur proposent-ils une solution ? ("Véhicule indisponible — voir les alternatives" et pas juste "Erreur")
- [ ] **Scroll infini sans repère** : les longues listes ont-elles une pagination ou un scroll avec position ?
- [ ] **Actions cachées** : des fonctionnalités importantes sont-elles cachées dans des menus secondaires ?
- [ ] **Feedback absent** : après une action (réservation, trajet, etc.), y a-t-il un feedback visuel immédiat ?
- [ ] **Double saisie** : l'utilisateur doit-il saisir deux fois la même info ? (ex : destination dans la réservation ET dans le trajet)

---

### 5. RECOMMANDATIONS DE DESIGN

Après l'analyse, proposer :

#### 5.1 Quick wins (< 1 jour chacun)
Les changements visuels/ergonomiques rapides qui améliorent immédiatement l'expérience.

#### 5.2 Améliorations structurelles (1 semaine)
Réorganisation de la navigation, du dashboard, ou des formulaires.

#### 5.3 Vision V2
Propositions de fonctionnalités UX pour les prochaines versions (onboarding, raccourcis, personnalisation).

---

## FORMAT DE SORTIE

Produis le fichier `AUDIT_UX.md` à la racine du projet avec cette structure :

```markdown
# 🎨 AUDIT UI/UX — Application Gestion Flotte APAJH
**Date** : [date du jour]
**Auditeur** : Claude Code

## Résumé exécutif
- Score ergonomie : X/100
- Score design : X/100
- Score parcours utilisateur : X/100
- Score global UX : X/100
- Nombre de points de friction identifiés : X
- Quick wins proposés : X

## 1. Ergonomie générale
### 1.1 Navigation
[Analyse + recommandations avec captures de code]
### 1.2 Cohérence visuelle
[Liste des incohérences trouvées]
### 1.3 Clarté de l'information
[Formats de date, messages, statuts]

## 2. Design visuel
### 2.1 Palette de couleurs
[Couleurs trouvées + analyse + recommandations]
### 2.2 Typographie
[Tailles, hiérarchie, lisibilité]
### 2.3 Espacement
[Zones tactiles, padding, marges]
### 2.4 Iconographie
[Cohérence, clarté]

## 3. Parcours utilisateur
### 3.1 Marc réserve un véhicule
[Nombre de clics, points de friction, recommandations]
### 3.2 Marc démarre un trajet
[idem]
### 3.3 Marc termine un trajet
[idem]
### 3.4 Marie cherche un véhicule
[idem]
### 3.5 Secrétaire gère la journée
[idem]
### 3.6 Chef crée le planning lavage
[idem]
### 3.7 Directeur consulte l'état
[idem]

## 4. Points de friction
[Liste des anti-patterns trouvés]

## 5. Recommandations
### 5.1 Quick wins (< 1 jour)
[Liste numérotée avec effort estimé]
### 5.2 Améliorations structurelles
[Liste avec effort estimé]
### 5.3 Vision V2
[Propositions futures]

## 6. Checklist UX pré-lancement
- [ ] ...
```

## RÈGLES

1. **Pense comme un utilisateur, pas comme un dev** — Marc n'a pas le temps de chercher un bouton. Marie veut voir les dispos en 2 secondes. La secrétaire gère 10 agents en même temps.
2. **Compte les clics** — chaque clic supplémentaire est un risque que l'utilisateur abandonne.
3. **Vérifie le mobile** — 80% des agents utiliseront l'app sur smartphone. Le design doit être mobile-first.
4. **Le glassmorphism est joli mais...** — vérifie qu'il ne nuit pas à la lisibilité, surtout sur petit écran et en plein soleil.
5. **Les codes couleur doivent être évidents** — si un utilisateur ne comprend pas un statut en 1 seconde, c'est un problème.
6. **Les formulaires doivent être pré-remplis intelligemment** — date du jour, heure courante, dernier km connu.
7. **Chaque action doit avoir un feedback** — pas de clic "dans le vide".
8. **Anticipe les erreurs** — que se passe-t-il si l'utilisateur fait une erreur ? Le message l'aide-t-il à corriger ?
9. **Sois concret** — pour chaque problème trouvé, propose une solution avec le changement de code ou de design.
10. **Le contexte Mayotte compte** — réseau instable, soleil fort, smartphones variés.

Lance l'audit maintenant.
