# 🔍 AUDIT COMPLET — Application Gestion Parc Auto
**Date** : 24 mars 2026
**Auditeur** : Antigravity (IA — audit automatisé)
**Version du projet** : backend 0.0.0 / frontend 0.1.0

---

## 📊 Résumé Exécutif
- **Score global : 52/100**
- Findings critiques : **6**
- Findings majeurs : **8**
- Findings mineurs : **7**
- Points positifs : **12**

---

## 🗂️ 1. Cartographie du Projet

### Arborescence (hors node_modules, .next, .git, dist)
```
fleet-management-app/
├── docker-compose.yml
├── backend/
│   ├── .env
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma (+ migrations/)
│   └── src/
│       ├── app.ts
│       ├── services/prisma.ts
│       ├── middleware/auth.ts, rateLimiter.ts
│       ├── controllers/ (9 fichiers)
│       │   ├── cleaningController.ts
│       │   ├── fuelController.ts
│       │   ├── incidentController.ts
│       │   ├── poleController.ts
│       │   ├── reservationController.ts
│       │   ├── serviceController.ts
│       │   ├── tripController.ts
│       │   ├── userController.ts
│       │   └── vehicleController.ts
│       └── routes/ (9 fichiers)
└── frontend/
    ├── package.json
    ├── next.config.ts
    └── src/
        ├── app/ (13 pages)
        │   ├── page.tsx (Dashboard)
        │   ├── login/page.tsx
        │   ├── calendar/page.tsx
        │   ├── nettoyage/page.tsx
        │   ├── search/page.tsx
        │   ├── settings/page.tsx
        │   └── admin/ (cleaning, history, incidents, settings, users, vehicles)
        ├── components/ui/ (Sidebar, VehicleCard, ReservationModal, TripModal, IncidentModal, FuelModal, ConfirmModal)
        ├── context/AuthContext.tsx
        └── lib/ (apiFetch.ts, utils.ts)
```

### Stack technique
| Composant | Technologie | Version |
|---|---|---|
| Frontend | Next.js (Turbopack) | 16.1.6 |
| UI | React | 19.2.3 |
| Styling | Tailwind CSS | 4.x |
| Backend | Express.js | ~4.16.1 |
| ORM | Prisma Client | 7.5.0 |
| BDD | PostgreSQL (Alpine) | 16 |
| Auth | bcrypt (hash) + Header X-User-Id | 6.0.0 |
| Sécurité | Helmet + express-rate-limit | 8.1.0 / 8.3.1 |
| Conteneur | Docker Compose | 3.8 |

---

## 🔒 2. Sécurité (OWASP Top 10 : 2025)

| # | Risque OWASP | Verdict | Commentaire |
|---|---|---|---|
| A01 | Broken Access Control | ⚠️ Partiel | RBAC côté serveur (`requireRole`), mais **aucun cloisonnement multi-pôle appliqué dans les requêtes API** (getReservations, getVehicles retournent TOUT) |
| A02 | Security Misconfiguration | ⚠️ Partiel | Helmet activé ✅, mais **Docker : credentials en dur** dans docker-compose.yml |
| A03 | Software Supply Chain | ⚠️ Partiel | **Pas de .gitignore** au niveau racine du projet, npm audit révèle des vulnérabilités |
| A04 | Cryptographic Failures | ✅ Conforme | bcrypt 12 rounds, passwordHash jamais exposé, anti-timing attack |
| A05 | Injection | ✅ Conforme | Prisma ORM partout (aucune requête SQL brute sauf healthcheck SELECT 1), validation des entrées |
| A06 | Insecure Design | ⚠️ Partiel | Détection chevauchement côté serveur ✅, mais **pas de vérification statut véhicule (MAINTENANCE)** lors de la réservation |
| A07 | Identification & Auth | ❌ Non conforme | **Auth par header X-User-Id sans JWT ni session**. N'importe qui connaissant un UUID peut usurper une identité. Pas de token signé. |
| A08 | Software & Data Integrity | ✅ Conforme | Validation côté serveur, transactions Prisma, protection mass assignment (champs explicites) |
| A09 | Security Logging | ⚠️ Partiel | console.error pour les erreurs, mais **pas de logging structuré** (winston/pino), pas de log des connexions/tentatives échouées |
| A10 | Mishandling Exceptions | ✅ Conforme | Global error handler, messages génériques en prod, JSON parse errors gérés |

### Finding CRITIQUE — A07 : Auth par X-User-Id sans signature
**Fichier** : `backend/src/middleware/auth.ts` (ligne 9)
```typescript
const userId = req.headers['x-user-id'] as string | undefined;
```
**Problème** : L'authentification repose sur un simple header HTTP contenant l'UUID de l'utilisateur. Aucun token signé (JWT), aucune session côté serveur. **N'importe quel client HTTP (curl, Postman) peut usurper n'importe quel utilisateur** en envoyant son UUID.

**Correction recommandée** : Implémenter JWT avec signature côté serveur (jsonwebtoken + clé secrète) ou sessions express-session + cookie HttpOnly.

### Finding CRITIQUE — A01 : Pas de cloisonnement multi-pôle dans les requêtes
**Fichier** : `backend/src/controllers/reservationController.ts` (ligne 100)
```typescript
const reservations = await prisma.reservation.findMany({
  include: { vehicle: true, user: true, passengers: {...} },
  orderBy: { startTime: 'asc' },
});
```
**Problème** : `getReservations` retourne TOUTES les réservations sans filtrage par pôle. Un agent du pôle Enfance voit les réservations du pôle Adulte. Idem pour `getVehicles`.

**Correction** : Filtrer par pôle de l'utilisateur connecté (via UserPole → Service → Vehicle).

### Finding MAJEUR — A02 : Credentials en dur dans docker-compose.yml
```yaml
POSTGRES_USER: fleet_user
POSTGRES_PASSWORD: fleet_password
```
**Correction** : Utiliser des variables d'environnement (`${POSTGRES_PASSWORD}`) avec un fichier `.env` **exclu du dépôt**.

### Finding MAJEUR — A03 : Pas de .gitignore
Aucun `.gitignore` trouvé à la racine du projet. Le fichier `.env` (contenant le DATABASE_URL) pourrait être commité.

### npm audit
```
@hono/node-server < 1.19.10 — Severity: high (authorization bypass)
express ~4.16.1 — Severity: moderate (plusieurs CVE)
cookie < 0.7.0 — Severity: moderate
```
**Action** : Mettre à jour Express vers 4.22+ et les dépendances transitives.

---

## 🛡️ 3. Conformité RGPD

| Point | Verdict | Commentaire |
|---|---|---|
| Données collectées | ⚠️ | Noms, emails, hash mdp, departments. **Pas de numéro de permis** (bon point). |
| Minimisation | ✅ | Seules les données nécessaires sont collectées |
| Politique de confidentialité | ❌ | **Aucune mention légale ni politique de vie privée dans l'app** |
| Droits (accès, rectification, suppression, export) | ❌ | **Aucun mécanisme de droit d'accès/export/suppression** pour l'utilisateur. La suppression existe mais uniquement par l'admin. |
| Durée de conservation | ❌ | **Aucune durée de conservation** définie. Les données sont conservées indéfiniment. |
| Chiffrement au repos | ❌ | Les données ne sont pas chiffrées au repos (PostgreSQL standard) |
| Données sensibles dans les logs | ⚠️ | `console.error` peut afficher des erreurs Prisma contenant des données utilisateur |

### Finding CRITIQUE — Champ "destination" en texte libre (risque médico-social)
**Fichier** : `backend/prisma/schema.prisma` (ligne 169)
```prisma
destination    String?
```
**Fichier** : `backend/src/controllers/reservationController.ts` (ligne 4)
```typescript
const MAX_DESTINATION_LENGTH = 500;
```
**Problème** : Le champ `destination` est un champ libre (String, max 500 chars). Dans le contexte médico-social (enfants, adultes handicapés), un professionnel pourrait saisir "Accompagnement de Saïd au CHM" ou "Transport rdv MDPH pour fatima". **Risque RGPD critique** : données nominatives de bénéficiaires vulnérables dans un champ non sécurisé.

**Aucun avertissement dans l'UI** n'indique de ne pas saisir de données nominatives d'usagers.

**Correction recommandée** :
1. Remplacer le champ libre par une **liste de destinations prédéfinies** (Type de lieu : "CHM", "MDPH", "Domicile", "Autre")
2. OU ajouter un avertissement RGPD visible dans la modale de réservation
3. Ajouter une purge automatique des anciennes données (>12 mois)

---

## 🗄️ 4. Base de Données

### Schéma (13 modèles)
| Modèle | Rôle | Verdict |
|---|---|---|
| `Pole` | Pôle organisationnel | ✅ Existe avec `isActive` |
| `Service` | Service rattaché à un pôle | ✅ Relation Pole→Service |
| `UserPole` / `UserService` | Many-to-Many User↔Pole/Service | ✅ Tables pivot |
| `User` | Utilisateur (agent, secrétaire, admin) | ⚠️ Pas de rôle `SECRETAIRE` distinct |
| `Vehicle` | Véhicule | ✅ `serviceId` pour rattachement pôle |
| `Reservation` | Réservation | ✅ Avec passagers |
| `ReservationPassenger` | Accompagnants | ✅ Many-to-Many |
| `TripLog` | Carnet de bord numérique | ✅ km départ/retour, heures, notes |
| `FuelLog` | Plein carburant | ✅ |
| `Incident` | Rapport d'incident | ✅ Avec sévérité, photo, statut |
| `MaintenanceAlert` | Alerte maintenance | ✅ |
| `CleaningSchedule` | Planning lavage | ✅ Par véhicule/semaine |
| `CleaningAssignment` | Assignation lavage | ✅ Agent→Schedule |

### Points positifs ✅
- Multi-pôle modélisé (Pole → Service → Vehicle, UserPole, UserService)
- Passagers/accompagnants (ReservationPassenger)
- Module lavage complet (CleaningSchedule + CleaningAssignment)
- Module incidents avec sévérité et photo
- Index sur vehicleId, userId pour les requêtes fréquentes
- Contrainte unique sur plateNumber et email

### Finding MAJEUR — Pas de rôle `SECRETAIRE`
```prisma
enum Role {
  ADMIN
  DIRECTEUR
  MANAGER
  PROFESSIONNEL
}
```
Le workflow prévoit un rôle spécifique pour la secrétaire (gestion planning, remise/rendu des clés). Actuellement, la secrétaire serait un `MANAGER` ou `PROFESSIONNEL`, sans droits dédiés.

### Finding MAJEUR — Pas de soft delete
Toutes les suppressions sont des `DELETE` définitifs. Aucun champ `deletedAt` pour la traçabilité.

### Finding MINEUR — Pas d'index sur `startTime`/`endTime` dans Reservation
La vérification de chevauchement effectue un scan sans index sur les dates. Avec 20 agents, c'est acceptable. À surveiller si le volume augmente.

---

## 🏗️ 5. Architecture & Qualité de Code

| Critère | Verdict | Commentaire |
|---|---|---|
| Structure | ✅ | Séparation claire : controllers / routes / middleware / services |
| TypeScript | ⚠️ | Utilisé mais `any` fréquent (ex: `(req as any).user`, types controllers) |
| Séparation responsabilités | ⚠️ | Logique métier directement dans les controllers (pas de couche service dédiée) |
| Gestion erreurs | ✅ | Cohérente, error handler global |
| Code dupliqué | ⚠️ | Filtrage multi-pôle dupliqué dans cleaningController |
| Tests | ❌ | **AUCUN test** (ni unitaire, ni intégration, ni e2e) |

### Finding CRITIQUE — Zéro tests
Aucun fichier de test n'a été trouvé dans le projet. Pas de `jest.config`, pas de `*.test.ts`, pas de `*.spec.ts`. Pour un outil métier en production, c'est un risque majeur.

---

## 🐳 6. Docker & Infrastructure

| Point | Verdict | Commentaire |
|---|---|---|
| docker-compose prod-ready | ❌ | Credentials en dur, pas de healthcheck, pas de réseau dédié |
| Ports exposés | ⚠️ | Port 5432 exposé sur l'hôte (risque si pas de firewall) |
| Volumes | ✅ | `fleet_pgdata` pour la persistance |
| Root container | ⚠️ | Image postgres standard (pas de user non-root explicite) |
| Variables d'env | ❌ | Hardcodées dans docker-compose.yml |
| Healthcheck | ❌ | Aucun healthcheck PostgreSQL configuré |
| HTTPS | ❌ | Aucune configuration TLS (accepté pour dev/localhost) |

### Finding MAJEUR — docker-compose.yml non sécurisé pour la production
```yaml
POSTGRES_USER: fleet_user
POSTGRES_PASSWORD: fleet_password
```
**Correction** :
```yaml
POSTGRES_USER: ${POSTGRES_USER}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```
Avec un fichier `.env` (exclu du dépôt via `.gitignore`).

---

## 🎨 7. UX/UI

| Point | Verdict |
|---|---|
| Responsive / mobile | ✅ Design responsive avec breakpoints Tailwind |
| Loading states | ✅ Spinner d'initialisation, skeleton states |
| Feedback utilisateur | ✅ Messages d'erreur, confirmations de suppression (ConfirmModal) |
| Navigation | ✅ Sidebar avec icônes et labels, rôles-dépendant |
| Internationalisation | ✅ Interface entièrement en français |
| Couleurs/Design | ✅ Design moderne, glassmorphism, animations subtiles |

---

## ♿ 7b. Accessibilité

### Score global : 🟠 Très difficilement utilisable au lecteur d'écran

### Ce qui est fait ✅
- `aria-modal`, `aria-labelledby` sur les modales (TripModal, FuelModal, IncidentModal)
- `aria-label` sur les boutons de fermeture
- `aria-label` dans la Sidebar (`role="menubar"`, `aria-label="Navigation principale"`)
- `aria-label` sur VehicleCard (boutons d'action)
- `aria-hidden="true"` sur les icônes décoratives
- `aria-live="polite"` sur le chargement dans TripModal
- `aria-describedby="mileage-hint"` sur l'input kilométrage
- `<label>` avec `htmlFor` dans TripModal, ReservationModal, IncidentModal, FuelModal

### Ce qui manque ❌

1. **Calendrier/Planning INACCESSIBLE au clavier** (Finding CRITIQUE)
   - `page.tsx (calendar)` : Composant custom basé sur des `<div>` avec `onMouseDown/onMouseMove/onMouseUp`
   - **Aucune navigation au clavier** (Tab, Enter, Escape)
   - **Aucun `role="grid"`**, `aria-label`, `aria-selected` sur les cellules
   - Ahmed NE PEUT PAS utiliser le planning de réservation

2. **Pas de skip links** ("Aller au contenu principal")

3. **Pas de focus trap** dans les modales ouvertes
   - Tab peut sortir de la modale et naviguer derrière elle

4. **Boutons sans texte accessible** dans certains composants
   - Boutons ChevronLeft/ChevronRight dans le calendrier (juste une icône)

5. **Structure des headings** : Pas de h1 unique garanti sur chaque page

6. **Contrastes** : Non vérifié numériquement, mais les textes `text-muted-foreground` en `text-[10px]` risquent de ne pas atteindre le ratio 4.5:1

7. **Gestion du focus après navigation** : Non implémentée

8. **Erreurs de formulaire** : Non liées aux champs via `aria-describedby` (sauf TripModal)

---

## 🔄 8. Workflow Métier

### Cycle de réservation

| Étape | Implémenté ? | Commentaire |
|---|---|---|
| 1. Réservation | ✅ | CRUD complet + détection chevauchement serveur |
| 2. Planning visuel | ✅ | Vue calendrier hebdomadaire par véhicule |
| 3. Remise des clés (secrétaire) | ❌ | **NON IMPLÉMENTÉ** — Aucun workflow "remise de clés" |
| 4. Départ km/heure/lieu | ✅ | TripLog.startMileage, startTime |
| 5. Retour km/heure/observations | ✅ | TripLog.endMileage, endTime, notes |
| 6. Rendu des clés (secrétaire) | ❌ | **NON IMPLÉMENTÉ** |
| Passagers/accompagnants | ✅ | ReservationPassenger (multi-select) |
| Anti-conflit serveur | ✅ | Transaction Prisma avec vérification chevauchement |
| Auto-clôture trajet | ✅ | Si véhicule IN_USE, le trajet précédent est clôturé automatiquement |
| Forcer fin trajet (admin) | ✅ | forceEndTrip pour les managers/admins |
| Véhicule en maintenance bloqué | ⚠️ | Bloqué pour le **démarrage de trajet**, mais **PAS pour la réservation** |

### Finding MAJEUR — Pas de workflow "Remise/Rendu des clés"
Le cycle complet du terrain inclut une étape de signature pour la remise des clés par la secrétaire. Ce workflow n'existe pas dans l'app. Le statut passe directement de "réservé" à "en trajet" sans validation de la secrétaire.

### Finding MAJEUR — Réservation possible sur véhicule en MAINTENANCE
**Fichier** : `reservationController.ts` — La création de réservation ne vérifie PAS `vehicle.status`. Un véhicule en MAINTENANCE peut être réservé.
```typescript
// MANQUANT :
// const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
// if (vehicle.status === 'MAINTENANCE' || vehicle.status === 'BLOCKED') {
//   throw new Error('VEHICLE_UNAVAILABLE');
// }
```

### Cycle de lavage

| Étape | Implémenté ? | Commentaire |
|---|---|---|
| Planning hebdomadaire | ✅ | CleaningSchedule par véhicule/semaine |
| Assignation agents | ✅ | CleaningAssignment (min 2 agents ou assignation solo) |
| Rôle chef/directeur | ✅ | Restreint par RBAC dans les routes |
| Carte de lavage | ❌ | **PAS modélisée** dans la BDD (pas d'association carte ↔ véhicule) |
| Fiche remise carte | ❌ | **PAS de signature numérique** |
| Historique lavages | ✅ | Via CleaningSchedule.isDone + completedAt |
| Blocage créneau lavage | ❌ | Un véhicule en lavage n'est **PAS bloqué** à la réservation |
| Self-complete | ✅ | Un agent peut déclarer avoir fait le lavage |
| Filtre multi-pôle | ✅ | cleaningController filtre par pôle du MANAGER |

### Cas limites

| Cas | Implémenté ? |
|---|---|
| Prolongation de réservation | ❌ Non implémenté |
| Annulation tardive / historique | ⚠️ Suppression possible, mais pas d'historique d'annulation |
| Retard de retour / alerte | ❌ Non implémenté |
| Réservation hors horaires | ✅ Pas de restriction horaire |
| Signalement panne en mission | ✅ Via module Incidents |

---

## 🚨 9. Plan d'Action Priorisé

### Priorité CRITIQUE (à corriger AVANT toute mise en production)

1. **Authentification JWT** — Remplacer X-User-Id par JWT signé
   - `backend/src/middleware/auth.ts`
   - Installer `jsonwebtoken`, créer un endpoint `/api/users/login` qui retourne un JWT, vérifier la signature dans le middleware

2. **Cloisonnement multi-pôle dans les requêtes API** — Filtrer réservations et véhicules par pôle
   - `reservationController.ts` : ajouter filtre `vehicle.service.poleId IN userPoles`
   - `vehicleController.ts` : idem

3. **Calendrier accessible au clavier** — Ahmed ne peut pas utiliser l'app
   - `frontend/src/app/calendar/page.tsx` : Ajouter `role="grid"`, `tabIndex`, `onKeyDown`, navigation clavier (ArrowUp/Down/Left/Right)

4. **Avertissement RGPD sur le champ destination** — Risque donnée nominative bénéficiaire
   - Ajouter un tooltip/avertissement dans ReservationModal
   - Envisager une liste de choix prédéfinis

5. **Créer `.gitignore`** — Exclure `.env`, `node_modules/`, `.next/`, `dist/`

6. **Tests unitaires et d'intégration** — Au minimum pour la détection de chevauchement et l'auth

### Priorité HAUTE (à corriger rapidement)

1. **Bloquer la réservation sur véhicule en MAINTENANCE/BLOCKED** — `reservationController.ts`
2. **Rôle SECRETAIRE** — Ajouter dans l'enum Role de Prisma
3. **Workflow remise/rendu des clés** — Ajouter un statut de workflow dans Reservation
4. **Mettre à jour express à 4.22+** — npm audit vulnérabilités
5. **Variables d'env Docker** — Externaliser les credentials
6. **Politique de confidentialité** — Ajouter une page /mentions-legales
7. **Focus trap dans les modales** — Empêcher Tab de sortir
8. **Soft delete** — Ajouter `deletedAt` sur User, Vehicle, Reservation

### Priorité MOYENNE (à planifier)

1. **Durée de conservation RGPD** — Purge automatique > 12 mois
2. **Logging structuré** — Winston/Pino avec niveaux
3. **Couche service** — Extraire la logique métier des controllers
4. **Skip links** — "Aller au contenu principal"
5. **Healthcheck Docker** — PostgreSQL
6. **HTTPS** — Certificat Let's Encrypt pour la prod
7. **Carte de lavage numérique** — Modéliser dans la BDD

### Priorité BASSE (améliorations)

1. **TypeScript strict** — Réduire les `any`
2. **Index sur dates** — `@@index([startTime, endTime])` dans Reservation
3. **Erreurs formulaires liées** — `aria-describedby` sur chaque champ
4. **Contrastes couleurs** — Vérifier WCAG AA sur le texte muted
5. **Structure headings** — h1 unique par page
6. **Alertes retard** — Notification si véhicule pas rendu à l'heure
7. **Extensibilité incidents V2** — Module déjà présent ✅

### Fonctionnalités métier manquantes (à développer)

1. **Workflow remise/rendu des clés** — Ajouter un statut `KEYS_HANDED` / `KEYS_RETURNED` dans Reservation ou un modèle KeyHandoff
2. **Carte de lavage** — Modéliser comme un asset du véhicule (WashCard ↔ Vehicle)
3. **Signature numérique** — Pour la fiche de remise de clés et de carte de lavage
4. **Prolongation de réservation** — Avec gestion du conflit dynamique
5. **Alerte retard** — Notification push / alerte visuelle quand un véhicule n'est pas rendu
6. **Export données utilisateur** — Conformité RGPD (droit d'accès/portabilité)

---

## ✅ 10. Points Positifs

1. ✅ **Détection chevauchement côté serveur** dans une transaction Prisma (anti-conflit robuste)
2. ✅ **bcrypt 12 rounds** avec protection anti-timing (dummy hash)
3. ✅ **Politique de mot de passe forte** (8 chars, majuscule, minuscule, chiffre, spécial)
4. ✅ **Helmet + CORS + Rate Limiting** configurés
5. ✅ **Protection path traversal** (middleware anti-`..`)
6. ✅ **Body size limit** (6 MB) pour prévenir les payloads massifs
7. ✅ **Multi-pôle modélisé en BDD** (Pole → Service → Vehicle → UserPole → UserService)
8. ✅ **Module passagers/accompagnants** (ReservationPassenger)
9. ✅ **Module lavage** complet avec planning, assignation, self-complete et filtre multi-pôle
10. ✅ **Module incidents** avec sévérité, photo, blocage véhicule auto, résolution
11. ✅ **Auto-clôture trajet** (si l'ancien conducteur oublie de terminer, le suivant peut démarrer)
12. ✅ **Accessibilité partielle** dans les modales et la sidebar (aria-*, labels, rôles)

---

## 📋 11. Checklist Pré-Production

### Sécurité
- [ ] Implémenter JWT pour l'authentification
- [ ] Créer `.gitignore` et vérifier qu'aucun secret n'est commité
- [ ] Externaliser les credentials Docker dans `.env`
- [ ] Mettre à jour Express (4.22+) et dépendances vulnérables
- [ ] Configurer HTTPS (Let's Encrypt / reverse proxy nginx)
- [ ] Ajouter healthcheck Docker

### RGPD
- [ ] Ajouter page mentions légales / politique de confidentialité
- [ ] Avertissement RGPD sur le champ "destination" (ne pas saisir de noms de bénéficiaires)
- [ ] Implémenter droit d'accès / export / suppression RGPD
- [ ] Définir durée de conservation et purge automatique

### Fonctionnel
- [ ] Cloisonnement multi-pôle dans TOUTES les requêtes API
- [ ] Bloquer la réservation sur véhicule en MAINTENANCE
- [ ] Implémenter le workflow remise/rendu des clés
- [ ] Ajouter le rôle SECRETAIRE

### Accessibilité
- [ ] Rendre le calendrier navigable au clavier
- [ ] Ajouter focus trap dans les modales
- [ ] Ajouter skip links
- [ ] Vérifier les contrastes WCAG AA
- [ ] Boutons d'icônes avec texte accessible

### Qualité
- [ ] Écrire des tests (détection chevauchement, auth, RBAC, incidents)
- [ ] Mettre en place CI/CD
- [ ] Logger les connexions et erreurs (winston/pino)
- [ ] Documenter l'API (Swagger/OpenAPI)
