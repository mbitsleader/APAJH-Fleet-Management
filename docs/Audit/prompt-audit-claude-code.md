# PROMPT AUDIT — À copier-coller dans Claude Code

---

Tu es un auditeur technique senior spécialisé en sécurité applicative, RGPD et bonnes pratiques de développement web. Tu vas effectuer un audit complet de ce projet (application de gestion de parc automobile pour une association/ONG à Mayotte).

## CONTEXTE DU PROJET
- **Stack** : Next.js + PostgreSQL + Docker
- **Type d'organisation** : Association médico-sociale à Mayotte (pôle Enfance + pôle Adulte, avec plusieurs services à l'intérieur de chaque pôle)
- **Fonctionnalités V1** : Réservation de véhicules, suivi entretien/maintenance, planning de lavage véhicules
- **Fonctionnalités V2 prévues** : Déclaration d'incidents/accidents avec photos
- **Parc** : 6 à 10 véhicules (VP + VU), dédiés par pôle (les véhicules du pôle Enfance ne sont pas accessibles au pôle Adulte et inversement)
- **Utilisateurs** : 10 à 20 agents, dont un agent aveugle (Ahmed, éducateur technique, non-conducteur mais réserve des véhicules pour des accompagnements)
- **Rôles identifiés** : Agent terrain, secrétaire (une par pôle — gère planning + clés), chef de service/directeur (crée le planning de lavage, supervise), admin
- **Données sensibles** : Noms, emails, numéros de permis de conduire, immatriculations
- **Architecture multi-pôle** : Cloisonnement des données — chaque pôle voit uniquement ses véhicules, ses agents, ses réservations. Un admin/direction voit tout.
- **Pilote** : Démarrage sur le pôle Enfance uniquement, puis extension au pôle Adulte
- **Multi-sites à terme** : V1 sur 1 site, puis 2 pôles avec potentiellement des localisations distinctes
- **Horaires** : Principalement heures de travail, mais cas exceptionnels en soirée/weekend (événements spéciaux)
- **Statut** : App presque terminée, en test local (localhost Docker)
- **Objectif** : Identifier TOUT ce qui ne respecte pas les normes avant mise en production

## POINT CRITIQUE — RGPD MÉDICO-SOCIAL
L'association travaille avec des publics vulnérables (enfants, adultes en situation de handicap). Même si l'app ne gère pas directement de dossiers usagers, le champ "motif de déplacement" pourrait contenir des informations sur des bénéficiaires (ex : "accompagnement de Saïd au CHM" ou "transport rdv MDPH"). Vérifie :
- [ ] Y a-t-il un avertissement ou une consigne dans l'UI indiquant de ne PAS saisir de données nominatives d'usagers dans le motif ?
- [ ] Le champ motif est-il un champ libre (risque) ou une liste de choix prédéfinis (plus sûr) ?
- [ ] Si des données d'usagers sont présentes dans les motifs existants, c'est un finding CRITIQUE RGPD

## WORKFLOW MÉTIER RÉEL À VÉRIFIER
L'app remplace un système 100% papier. Vérifie que le code implémente bien ce cycle complet :

### Cycle de réservation
1. **Réservation** : L'agent réserve un véhicule (avant : email à la secrétaire). L'app DOIT bloquer les doublons car le système papier causait des conflits (un agent se positionnait sur un créneau déjà pris sans le savoir).
2. **Planning** : La secrétaire (ou tout utilisateur autorisé) visualise le planning de la semaine avec tous les véhicules et créneaux. Remplace le planning imprimé du vendredi.
3. **Remise des clés** : La secrétaire valide la remise des clés à l'agent. Remplace la fiche papier de remise des clés à signer.
4. **Départ** : L'agent saisit le kilométrage de départ, l'heure, le lieu de départ. Remplace le carnet de bord papier.
5. **Retour** : L'agent saisit le kilométrage de retour, l'heure, l'état du véhicule, observations éventuelles.
6. **Rendu des clés** : La secrétaire confirme la réception des clés et de la pochette.

### Cycle de lavage véhicule (workflow parallèle)
Le lavage suit un cheminement similaire à la réservation, avec des différences clés :

**Création du planning :**
1. **Le chef de service ou directeur** crée un planning de lavage hebdomadaire (qui lave quel véhicule, quel jour).
2. Le planning est transmis à la secrétaire puis affiché (aujourd'hui : impression papier → à remplacer par une vue numérique).

**Cycle du jour de lavage (ex : Marc doit laver un véhicule) :**
3. **Remise** : Marc vient voir la secrétaire. Elle lui remet la pochette habituelle (clés + carnet de bord + constat) PLUS la **carte de lavage** du véhicule.
4. **Signature** : Marc signe une **fiche de remise de la carte de lavage** (distincte de la fiche remise des clés classique).
5. **Départ / Lavage / Retour** : même cycle que la réservation (saisie km départ, réalisation du lavage, saisie km retour).
6. **Rendu** : Marc rend les clés + la carte de lavage à la secrétaire.

**Différences clés avec la réservation :**
- Le planning de lavage est créé par le chef/directeur (pas par l'agent lui-même)
- Un document supplémentaire est remis : la **carte de lavage** (à gérer comme un asset du véhicule)
- Une fiche de signature spécifique pour la carte de lavage
- Le motif est implicite : "lavage" (pas besoin de le saisir)

**Points de vérification pour le lavage :**
- [ ] Y a-t-il un module de planning de lavage distinct du planning de réservation ?
- [ ] Le chef/directeur peut-il créer et assigner des tâches de lavage à des agents ?
- [ ] La carte de lavage est-elle gérée dans l'app (association carte ↔ véhicule) ?
- [ ] La fiche de remise de la carte de lavage est-elle numérisée (signature) ?
- [ ] Le planning de lavage est-il visible par les agents concernés ?
- [ ] L'historique des lavages est-il traçable par véhicule ?
- [ ] Le lavage bloque-t-il le véhicule à la réservation pendant le créneau de lavage ?

### Documents à numériser
- **Carnet de bord** : km, heures, lieux (départ + retour) → remplace le carnet papier dans la pochette
- **Fiche d'état du véhicule** : dégâts, observations → remplace la fiche constat papier
- **Planning de réservation** : vue calendrier par véhicule → remplace l'affichage papier
- **Planning de lavage** : vue hebdomadaire des lavages assignés → remplace le planning papier affiché
- **Fiche de remise de carte de lavage** : signature numérique → remplace la fiche papier

### Problèmes du système papier que l'app DOIT résoudre
- **Zéro traçabilité** : impossible de savoir qui a pris quel véhicule et quand
- **Conflits de planning** : double réservation fréquente car l'info n'est pas en temps réel
- **Réduction du papier** : éliminer les fiches, carnets, plannings imprimés

### Points de vérification fonctionnels critiques
- [ ] La détection de chevauchement de réservation fonctionne-t-elle côté serveur (pas juste côté client) ?
- [ ] Un véhicule en maintenance est-il automatiquement indisponible à la réservation ?
- [ ] Le workflow complet est-il implémenté (réservation → remise clés → départ km → retour km → rendu clés) ou juste un CRUD basique ?
- [ ] Y a-t-il un rôle "secrétaire" distinct avec les droits appropriés (gestion planning, remise/rendu clés) ?
- [ ] Le responsable a-t-il une vue superviseur (tous les véhicules, toutes les réservations, historique) ?
- [ ] Le carnet de bord numérique capture-t-il toutes les infos de l'ancien carnet papier ?
- [ ] La fiche d'état véhicule permet-elle de signaler des dégâts avec photo ?
- [ ] La réservation permet-elle d'ajouter des passagers/accompagnants ? (voir ci-dessous)
- [ ] L'app est-elle entièrement accessible au lecteur d'écran ? (voir ci-dessous)

### CAS CRITIQUE : Architecture multi-pôle (cloisonnement)
L'association a 2 pôles (Enfance + Adulte) avec des véhicules dédiés à chaque pôle et une secrétaire par pôle. Le pilote démarre sur le pôle Enfance. L'app DOIT :
- Cloisonner les données par pôle : un agent du pôle Enfance ne voit que les véhicules et réservations de son pôle
- La secrétaire du pôle Enfance ne gère que les clés/planning de son pôle
- Le directeur/admin a une vue transversale sur TOUS les pôles
- À terme, chaque pôle pourrait avoir plusieurs services internes
- Vérifier dans le code : y a-t-il une notion de "pôle", "site", "organisation", "tenant" ou "groupe" dans le modèle de données ?
- Si le cloisonnement n'existe pas, c'est un finding HAUTE priorité (l'app sera inutilisable en multi-pôle)

### CAS CRITIQUE : Passagers / Accompagnants
Un agent peut réserver un véhicule pour un déplacement en groupe. Exemple : Marc réserve mais il est accompagné de 3 autres agents. L'app DOIT permettre de :
- Ajouter 1 ou plusieurs passagers lors de la réservation (sélection parmi les agents existants)
- Savoir QUI était dans le véhicule à tout moment (traçabilité en cas d'accident, assurance)
- Distinguer le conducteur (responsable du véhicule) des passagers
- Un agent NON-conducteur (ex : Ahmed, malvoyant) peut réserver un véhicule pour un accompagnement — il sera passager, un autre agent conduira
- Vérifier dans le code si un champ "passagers" ou "accompagnants" existe dans le modèle de réservation

### CAS CRITIQUE : Accessibilité (Agent malvoyant)
Un des agents (Ahmed) est aveugle. Il est éducateur technique et doit pouvoir utiliser l'app EN TOUTE AUTONOMIE pour réserver un véhicule (pour des accompagnements, il ne conduit pas). Actuellement il dépend de la secrétaire — l'app doit lui rendre son autonomie.

**L'accessibilité n'est PAS un bonus, c'est une obligation :**
- Légale : RGAA 4.1 (Référentiel Général d'Amélioration de l'Accessibilité) obligatoire pour les services publics et recommandé pour les associations en France
- Morale : un utilisateur réel de l'app en dépend
- Technique : WCAG 2.1 niveau AA minimum

### MODULE V2 : Déclaration d'incidents / accidents
Ce module n'est pas dans la V1 mais le code doit être prêt à l'accueillir. Vérifie :
- [ ] Le modèle de données est-il extensible pour ajouter une table incidents (lien véhicule, agent, date, description, photos, gravité) ?
- [ ] L'upload de photos fonctionne-t-il déjà dans l'app (pour la fiche d'état véhicule) ? Si oui, il sera réutilisable pour les incidents.
- [ ] Y a-t-il déjà un début d'implémentation du module incidents dans le code ?

### CAS LIMITES À VÉRIFIER
- **Prolongation** : un agent peut-il prolonger sa réservation si sa mission dure plus longtemps que prévu ? Que se passe-t-il si ça crée un conflit avec la réservation suivante ?
- **Annulation tardive** : un agent peut-il annuler au dernier moment ? Y a-t-il un historique des annulations ?
- **Retard de retour** : si Marc ne ramène pas le véhicule à l'heure alors que Marie attend, l'app signale-t-elle le retard ?
- **Réservation hors horaires** : les cas exceptionnels (soirée/weekend pour événements spéciaux) sont-ils gérés dans le planning ?
- **Véhicule en panne pendant une mission** : l'agent peut-il signaler une panne depuis l'app ?

**Points d'audit accessibilité CRITIQUES à vérifier :**
- [ ] Tous les éléments interactifs sont-ils accessibles au clavier seul (Tab, Enter, Escape) ?
- [ ] Chaque input a-t-il un `<label>` associé (htmlFor/id) ou un aria-label ?
- [ ] Les images ont-elles des attributs `alt` descriptifs ?
- [ ] Les boutons et liens ont-ils un texte accessible (pas juste une icône sans label) ?
- [ ] Les messages d'erreur de formulaire sont-ils annoncés aux lecteurs d'écran (aria-live, aria-describedby) ?
- [ ] Le calendrier/planning de réservation est-il navigable au clavier et compréhensible par un lecteur d'écran ? (C'est souvent le composant le PLUS problématique)
- [ ] Les modales/popups gèrent-elles le focus trap (le focus reste dans la modale) ?
- [ ] Les toasts/notifications sont-elles annoncées (aria-live="polite") ?
- [ ] Le contraste des couleurs respecte-t-il le ratio WCAG AA (4.5:1 pour le texte, 3:1 pour les grands textes) ?
- [ ] La hiérarchie des headings est-elle cohérente (h1 → h2 → h3, pas de saut) ?
- [ ] Les tableaux de données ont-ils des `<th>` avec scope ?
- [ ] Les changements de page/vue sont-ils annoncés (gestion du focus après navigation) ?
- [ ] Y a-t-il des skip links ("Aller au contenu principal") ?
- [ ] Les états des composants sont-ils communiqués (aria-expanded, aria-selected, aria-checked) ?

## TA MISSION

Scanne l'intégralité du projet et produis un dossier d'audit structuré en fichier Markdown nommé `AUDIT_COMPLET.md` à la racine du projet.

## ÉTAPES D'ANALYSE (dans cet ordre)

### 1. CARTOGRAPHIE DU PROJET
- Liste l'arborescence complète du projet (hors node_modules, .next, .git)
- Identifie la stack exacte (versions de Next.js, React, ORM, packages auth, etc.)
- Liste toutes les dépendances du `package.json` avec leurs versions
- Identifie le `docker-compose.yml` et les Dockerfiles : analyse la config

### 2. AUDIT SÉCURITÉ (référentiel OWASP Top 10 : 2025)
Pour chaque point OWASP, analyse le code réel et donne un verdict : ✅ Conforme / ⚠️ Partiel / ❌ Non conforme

- **A01 - Broken Access Control** : Y a-t-il un système RBAC ? Les endpoints API vérifient-ils les rôles côté serveur ? Un agent peut-il accéder aux données d'un autre ? Un agent du pôle Enfance peut-il voir les véhicules/réservations du pôle Adulte ? (cloisonnement multi-pôle)
- **A02 - Security Misconfiguration** : Headers HTTP de sécurité (CSP, HSTS, X-Frame-Options) ? Config Docker (user root ?) ? Variables d'env exposées ? Debug mode activé ?
- **A03 - Software Supply Chain** : Lockfile commité ? Dépendances à jour ? `npm audit` clean ?
- **A04 - Cryptographic Failures** : Mots de passe hashés (bcrypt/argon2) ou en clair ? HTTPS configuré ? Tokens/secrets dans le code source ?
- **A05 - Injection** : ORM utilisé partout ? Requêtes SQL brutes ? Validation des entrées (Zod, Yup, ou rien) ? Protection XSS ?
- **A06 - Insecure Design** : Détection de chevauchement de réservations ? Gardes métier (réserver un véhicule en maintenance ?) ? Rate limiting ?
- **A07 - Identification & Auth Failures** : Comment fonctionne l'auth ? Sessions/JWT ? Mots de passe forts imposés ? Brute-force protection ?
- **A08 - Software & Data Integrity** : Validation côté serveur des données ? Protection mass assignment ?
- **A09 - Security Logging** : Logs de sécurité (connexions, erreurs, accès refusés) ? Données sensibles dans les logs ?
- **A10 - Mishandling Exceptions** : Error boundaries React ? Messages d'erreur génériques en prod ? Gestion des cas d'erreur API ?

### 3. AUDIT RGPD
- Quelles données personnelles sont collectées ? Sont-elles toutes nécessaires (minimisation) ?
- Y a-t-il une politique de confidentialité / mentions légales dans l'app ?
- Les droits des personnes sont-ils implémentés (accès, rectification, suppression, export) ?
- Y a-t-il des durées de conservation définies ?
- Les données sensibles (permis de conduire) sont-elles chiffrées au repos ?
- Les logs contiennent-ils des données personnelles ?
- **SPÉCIFIQUE MÉDICO-SOCIAL** : le champ "motif de déplacement" est-il un champ libre ? Si oui, y a-t-il un avertissement pour ne pas saisir de données nominatives d'usagers/bénéficiaires ? (risque RGPD critique dans le secteur médico-social)

### 4. AUDIT BASE DE DONNÉES
- Analyse le schéma complet (tables, colonnes, types, relations, contraintes)
- Index manquants ? Contraintes d'intégrité absentes ?
- Y a-t-il des contraintes d'unicité là où c'est nécessaire (immatriculation, email) ?
- Les mots de passe sont-ils stockés correctement ?
- Y a-t-il un mécanisme de soft delete ?
- Y a-t-il une table ou relation pour les passagers/accompagnants d'une réservation ?
- Le modèle distingue-t-il le conducteur des passagers ?
- Y a-t-il une table pour les tâches de lavage (planning lavage, assignation agent, véhicule, carte de lavage) ?
- La carte de lavage est-elle modélisée (association carte ↔ véhicule, historique de remise/retour) ?
- **MULTI-PÔLE** : y a-t-il une table/colonne "pôle" (ou site/organisation/tenant) qui rattache les véhicules, agents et réservations à un pôle ? Si non, c'est un finding HAUTE priorité — sans ça, impossible de cloisonner les données entre pôle Enfance et pôle Adulte
- **EXTENSIBILITÉ INCIDENTS** : le schéma est-il prêt à accueillir une table incidents (V2) sans refonte majeure ?

### 5. AUDIT ARCHITECTURE & CODE QUALITY
- Structure du projet : bien organisée ou code spaghetti ?
- TypeScript strict activé ? Typage correct ou `any` partout ?
- Séparation des responsabilités (routes API / logique métier / accès données) ?
- Gestion des erreurs cohérente ?
- Code dupliqué ?
- Tests existants ? Couverture ?

### 6. AUDIT DOCKER & INFRASTRUCTURE
- Le `docker-compose.yml` est-il prêt pour la production ?
- Ports exposés inutilement ?
- Volumes pour la persistance PostgreSQL ?
- L'app tourne-t-elle en root dans le container ?
- Variables d'environnement gérées correctement (.env, pas de secrets hardcodés) ?
- Healthchecks configurés ?

### 7. AUDIT UX/UI
- L'app est-elle responsive / mobile-first ?
- Feedback utilisateur (loading states, messages d'erreur, confirmations) ?
- Navigation cohérente ?

### 7b. AUDIT ACCESSIBILITÉ (CRITIQUE — utilisateur réel aveugle)
⚠️ **CETTE SECTION EST PRIORITAIRE** — Un agent aveugle (Ahmed) utilise l'app quotidiennement. L'accessibilité conditionne la mise en production.

**Référentiels** : WCAG 2.1 AA + RGAA 4.1

**Tests à effectuer :**
1. Cherche dans tout le code les éléments `<img>` sans `alt`, `<button>` ou `<a>` sans texte accessible, `<input>` sans `<label>` associé
2. Cherche les `onClick` sur des `<div>` ou `<span>` (non focusables au clavier — doivent être des `<button>`)
3. Vérifie si les composants de calendrier/planning utilisés sont accessibles (react-big-calendar, FullCalendar, composant custom ?)
4. Cherche les `aria-*` attributes dans le code — s'il n'y en a aucun, c'est un red flag majeur
5. Vérifie les contrastes de couleurs dans les fichiers CSS/Tailwind
6. Cherche si `tabIndex`, `role`, `aria-live`, `aria-label`, `aria-describedby` sont utilisés
7. Vérifie la gestion du focus : après soumission de formulaire, après navigation, dans les modales
8. Vérifie que les erreurs de formulaire sont liées aux champs via `aria-describedby`
9. Cherche les skip links et la structure des headings (h1→h2→h3 sans saut)

**Donne un score d'accessibilité sur 5 niveaux :**
- 🔴 Inutilisable au lecteur d'écran
- 🟠 Très difficilement utilisable
- 🟡 Partiellement accessible (certaines pages OK, d'autres non)
- 🟢 Largement accessible avec quelques ajustements
- ✅ Pleinement accessible WCAG AA

### 8. AUDIT WORKFLOW MÉTIER
C'est la section la plus importante pour l'utilisabilité. Vérifie que le code implémente RÉELLEMENT le cycle complet du terrain :

- **Réservation avec anti-conflit** : le système bloque-t-il les doublons côté serveur ? (cherche la logique de chevauchement de dates dans le code)
- **Statuts du cycle** : y a-t-il un vrai workflow à étapes (réservé → clés remises → en cours → retour → clés rendues) ou juste un CRUD réservation basique ?
- **Carnet de bord numérique** : l'agent peut-il saisir km départ, km retour, heure départ, heure retour, lieu, observations ?
- **Fiche d'état véhicule** : l'agent peut-il signaler des dégâts/observations sur l'état du véhicule ?
- **Rôle secrétaire** : y a-t-il un rôle dédié avec les droits spécifiques (gérer le planning, confirmer remise/rendu des clés) ?
- **Vue responsable/superviseur** : le responsable a-t-il un tableau de bord avec visibilité complète ?
- **Traçabilité** : peut-on retrouver l'historique complet d'un véhicule (qui l'a pris, quand, km parcourus, état au retour) ?
- **Planning visuel** : y a-t-il une vue calendrier par véhicule (remplace le planning papier affiché) ?

**Workflow de lavage (module parallèle) :**
- **Planning de lavage** : le chef/directeur peut-il créer un planning hebdomadaire de lavage et assigner des agents à des véhicules ?
- **Rôle chef/directeur** : a-t-il les droits spécifiques pour créer/modifier le planning de lavage ? (distinct du rôle secrétaire)
- **Carte de lavage** : y a-t-il une gestion de la carte de lavage dans l'app ? (association carte ↔ véhicule, remise, signature, retour)
- **Fiche de remise carte lavage** : la signature numérique de remise de la carte de lavage est-elle implémentée ?
- **Historique lavages** : l'historique des lavages est-il consultable par véhicule (date, agent, km) ?
- **Blocage créneau** : un véhicule en lavage est-il bloqué à la réservation pendant le créneau ?
- **Vue unifiée ou séparée** : le planning de lavage et le planning de réservation sont-ils sur la même vue ou séparés ? (la vue unifiée est recommandée pour éviter les conflits)

## FORMAT DE SORTIE

Produis le fichier `AUDIT_COMPLET.md` avec cette structure exacte :

```markdown
# 🔍 AUDIT COMPLET — Application Gestion Parc Auto
**Date** : [date du jour]
**Auditeur** : Claude Code
**Version du projet** : [version du package.json ou commit hash]

## 📊 Résumé Exécutif
- Score global : X/100
- Findings critiques : X
- Findings majeurs : X
- Findings mineurs : X
- Points positifs : X

## 🗂️ 1. Cartographie du Projet
[arborescence + stack + dépendances]

## 🔒 2. Sécurité (OWASP Top 10 : 2025)
[tableau récapitulatif + détail par risque avec extraits de code problématiques]

## 🛡️ 3. Conformité RGPD
[analyse + recommandations]

## 🗄️ 4. Base de Données
[schéma + analyse + recommandations]

## 🏗️ 5. Architecture & Qualité de Code
[analyse + recommandations]

## 🐳 6. Docker & Infrastructure
[analyse + recommandations]

## 🎨 7. UX/UI
[observations rapides]

## ♿ 7b. Accessibilité
[Score global + détail des findings + fichiers/lignes concernés]

## 🔄 8. Workflow Métier
[Le cycle complet est-il implémenté ? Quelles étapes manquent ? Gestion des passagers ?]

## 🚨 9. Plan d'Action Priorisé
### Priorité CRITIQUE (à corriger AVANT toute mise en production)
1. [finding + fichier concerné + correction recommandée]
2. ...

### Priorité HAUTE (à corriger rapidement)
1. ...

### Priorité MOYENNE (à planifier)
1. ...

### Priorité BASSE (améliorations)
1. ...

### Fonctionnalités métier manquantes (à développer)
1. [étape du workflow non implémentée + recommandation]
2. ...

## ✅ 10. Points Positifs
[ce qui est déjà bien fait]

## 📋 11. Checklist Pré-Production
- [ ] Item 1
- [ ] Item 2
...
```

## RÈGLES IMPORTANTES

1. **Sois brutalement honnête** — pas de complaisance, chaque problème doit être signalé avec le fichier et la ligne concernés
2. **Cite le code problématique** — pour chaque finding, montre l'extrait de code exact et la correction recommandée
3. **Priorise** — distingue clairement ce qui est bloquant pour la prod de ce qui est améliorable
4. **Sois concret** — pas de recommandations vagues, donne des exemples de code correctif
5. **Exécute npm audit** et inclus les résultats
6. **Cherche les secrets** — vérifie qu'il n'y a pas de mots de passe, tokens, clés API hardcodés dans le code
7. **Vérifie le .gitignore** — le .env est-il ignoré ? Les fichiers sensibles sont-ils protégés ?
8. **Vérifie le workflow métier** — compare le cycle réel (réservation → remise clés → départ km → retour km → rendu clés) avec ce qui est implémenté. Signale chaque étape manquante comme un finding fonctionnel
9. **Vérifie l'anti-conflit** — cherche spécifiquement la logique de détection de chevauchement de réservation côté serveur. Si elle n'existe pas ou est uniquement côté client, c'est un finding CRITIQUE
10. **Vérifie l'accessibilité en profondeur** — un utilisateur aveugle dépend de cette app. Scanne CHAQUE composant pour les violations d'accessibilité. Si le calendrier de réservation n'est pas navigable au clavier, c'est un finding CRITIQUE (ça bloque Ahmed)
11. **Vérifie la gestion des passagers** — la réservation doit permettre d'ajouter des accompagnants. Si le modèle de données n'a pas de relation réservation → passagers, c'est un finding HAUTE priorité
12. **Vérifie le module de lavage** — un planning de lavage distinct de la réservation doit exister. Si le module n'existe pas du tout, le signaler comme fonctionnalité manquante. S'il existe, vérifier que le cycle complet est implémenté (création planning par chef → assignation → remise carte → lavage → retour carte)
13. **Vérifie le cloisonnement multi-pôle** — cherche dans le modèle de données et les requêtes API si les données sont filtrées par pôle/site/tenant. Si tout est dans un seul espace sans cloisonnement, c'est un finding HAUTE priorité car l'app sera déployée sur 2 pôles avec des secrétaires et véhicules distincts
14. **Vérifie le risque RGPD médico-social** — cherche le champ "motif" dans le modèle de réservation. Si c'est un champ libre sans garde-fou, signaler le risque que des données nominatives d'usagers vulnérables (enfants, adultes handicapés) soient saisies involontairement

Lance l'audit maintenant. Scanne tout le projet sans exception.
