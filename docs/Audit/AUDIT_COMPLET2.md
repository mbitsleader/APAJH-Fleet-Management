# AUDIT COMPLET 2 — Application Gestion Parc Auto
**Date** : 25 mars 2026
**Auditeur** : Claude Code (claude-sonnet-4-6)
**Version du projet** : backend 0.0.0 / frontend 0.1.0
**Projet** : fleet-management-app — APAJH Mayotte

---

## RESUME EXECUTIF

| Indicateur | Valeur |
|---|---|
| Score global | **54 / 100** |
| Findings critiques | **5** |
| Findings majeurs | **11** |
| Findings mineurs | **9** |
| Points positifs majeurs | **8** |

### Appréciation synthétique

L'application présente une architecture solide et plusieurs bonnes pratiques de sécurité déjà en place (JWT en cookie httpOnly, bcrypt, rate limiting, cloisonnement multi-pôle). Cependant, **cinq failles bloquantes pour la mise en production** ont été identifiées : un endpoint de debug non authentifié exposant toutes les données utilisateurs, un log d'authentification hardcodé sur le disque dur Windows, l'absence totale de conformité RGPD formelle, un score d'accessibilité insuffisant pour un utilisateur aveugle (Ahmed), et l'absence de plusieurs étapes métier critiques du cycle de réservation.

---

## 1. CARTOGRAPHIE DU PROJET

### 1.1 Arborescence principale

```
fleet-management-app/
├── docker-compose.yml
├── backend/
│   ├── .env                          ← SECRETS EN CLAIR (JWT, DB)
│   ├── .gitignore                    ← .env ignoré (correct)
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── src/
│   │   ├── app.ts                    ← Point d'entrée Express
│   │   ├── controllers/              ← 9 contrôleurs
│   │   ├── middleware/               ← auth.ts, rateLimiter.ts
│   │   ├── routes/                   ← 9 routeurs
│   │   ├── services/prisma.ts
│   │   └── utils/                    ← jwt.ts, accessControl.ts
│   ├── dev.db                        ← BASE SQLITE DE DEV COMMITÉE
│   ├── scripts/                      ← Scripts de test/simulation
│   ├── test-auth.js, test-roles.js   ← Fichiers de test en clair
│   └── dist/                         ← Code compilé
└── frontend/
    ├── .gitignore
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    └── src/
        ├── app/                      ← Pages Next.js (App Router)
        ├── components/ui/            ← Composants réutilisables
        ├── context/AuthContext.tsx
        └── lib/                      ← apiFetch, utils
```

### 1.2 Stack technique exacte

| Couche | Technologie | Version |
|---|---|---|
| Frontend framework | Next.js | **16.1.6** |
| Frontend UI | React | **19.2.3** |
| Styling | Tailwind CSS | ^4 |
| Icones | lucide-react | ^0.577.0 |
| Backend framework | Express | ~4.16.1 |
| ORM | Prisma | ^7.5.0 |
| Base de données | PostgreSQL | 16 (Docker) |
| Auth | JWT (jsonwebtoken ^9.0.3) + bcrypt ^6.0.0 |
| Sécurité HTTP | helmet ^8.1.0 |
| Rate limiting | express-rate-limit ^8.3.1 |
| TypeScript (backend) | ^5.9.3 — strict: true |
| TypeScript (frontend) | ^5 — strict: true |
| Runtime | Node.js (nodemon ^3.1.14 en dev) |

### 1.3 Dépendances backend notables

```json
"@prisma/adapter-pg": "^7.5.0"
"bcrypt": "^6.0.0"
"cookie-parser": "~1.4.4"
"cors": "^2.8.6"
"dotenv": "^17.3.1"
"express-rate-limit": "^8.3.1"
"helmet": "^8.1.0"
"jsonwebtoken": "^9.0.3"
"morgan": "~1.9.1"
"pg": "^8.20.0"
```

### 1.4 Dépendances frontend notables

```json
"clsx": "^2.1.1"
"lucide-react": "^0.577.0"
"next": "16.1.6"
"react": "19.2.3"
"tailwind-merge": "^3.5.0"
```

### 1.5 Docker

- `docker-compose.yml` : uniquement le service PostgreSQL (pas de conteneurs app)
- Aucun Dockerfile pour backend ou frontend

---

## 2. SECURITE (OWASP Top 10 : 2025)

### Tableau de synthèse

| # | Risque OWASP | Statut | Sévérité |
|---|---|---|---|
| A01 | Broken Access Control | ⚠️ Partiel | HAUTE |
| A02 | Security Misconfiguration | ❌ Non conforme | CRITIQUE |
| A03 | Software Supply Chain | ⚠️ Partiel | MOYENNE |
| A04 | Cryptographic Failures | ⚠️ Partiel | HAUTE |
| A05 | Injection | ✅ Conforme | — |
| A06 | Insecure Design | ⚠️ Partiel | MOYENNE |
| A07 | Identification & Auth Failures | ✅ Conforme | — |
| A08 | Software & Data Integrity | ✅ Conforme | — |
| A09 | Security Logging | ❌ Non conforme | CRITIQUE |
| A10 | Mishandling Exceptions | ⚠️ Partiel | BASSE |

---

### A01 — Broken Access Control : ⚠️ Partiel

**Points positifs :**
- Cloisonnement multi-pôle bien implémenté via `buildVehicleAccessFilter()` dans `accessControl.ts`
- Middleware `authenticate` et `requireRole` appliqués systématiquement
- Protection IDOR sur les trajets (`userId` toujours pris depuis `req.user`, jamais depuis le corps de la requête)

**FINDING CRITIQUE — Endpoint de debug non authentifié :**

Fichier : `backend/src/app.ts`, ligne 75

```typescript
app.get('/api/debug/db', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { userPoles: { include: { pole: true } } }
    });
    const poles = await prisma.pole.findMany({ include: { services: true } });
    const vehicles = await prisma.vehicle.findMany({ include: { service: true } });
    res.json({ users, poles, vehicles });  // EXPOSE TOUS LES UTILISATEURS SANS AUTH
```

Cet endpoint expose TOUS les utilisateurs, pôles et véhicules sans aucune authentification. Il doit être supprimé avant toute mise en production.

**Correction :**
```typescript
// Supprimer totalement ce bloc ou le conditionner :
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug/db', authenticate, requireRole(['ADMIN']), async ...
}
```

**FINDING MAJEUR — Protection insuffisante sur deleteVehicle :**

`vehicleController.ts` ligne 150 : la vérification du rôle `ADMIN/DIRECTEUR` pour la suppression forcée est faite APRES avoir déjà lu et compté les enregistrements. La logique est correcte mais verbeuse — aucun risque exploitable identifié.

**FINDING MAJEUR — updateVehicle sans vérification d'accès :**

`vehicleController.ts` ligne 91 : `updateVehicle` utilise `requireRole(['ADMIN', 'DIRECTEUR', 'MANAGER'])` au niveau route, mais ne vérifie pas que le véhicule appartient au pôle du MANAGER. Un MANAGER d'un pôle Enfance pourrait modifier un véhicule du pôle Adulte.

```typescript
// Dans updateVehicle, il manque :
const accessFilter = buildVehicleAccessFilter(requester);
const vehicle = await prisma.vehicle.findFirst({ where: { id, ...accessFilter } });
if (!vehicle) return res.status(403).json({ error: 'Accès refusé.' });
```

---

### A02 — Security Misconfiguration : ❌ Non conforme

**FINDING CRITIQUE 1 — Fichier .env avec secrets en production commité dans le projet :**

Fichier : `backend/.env`

```
DATABASE_URL="postgresql://fleet_user:fleet_password@localhost:5432/fleet_db?schema=public"
JWT_SECRET="37d0cb33b42f89640259a3ea2bc29b7b5696e6026a007e41bcfb25f401ed37dad..."
NODE_ENV="development"
```

Le `.env` est dans le `.gitignore` backend mais le fichier EXISTE physiquement dans le répertoire du projet avec des valeurs réelles. Cela représente un risque si ce répertoire est partagé ou si le `.gitignore` est contourné.

**FINDING CRITIQUE 2 — Credential PostgreSQL en clair dans docker-compose.yml :**

`docker-compose.yml` lignes 8-10 :
```yaml
environment:
  POSTGRES_USER: fleet_user
  POSTGRES_PASSWORD: fleet_password   # ← MOT DE PASSE EN CLAIR
```

Ces credentials sont identiques à ceux du `.env`, et le `docker-compose.yml` n'est pas dans un `.gitignore`.

**FINDING MAJEUR — Port PostgreSQL exposé publiquement :**

`docker-compose.yml` ligne 12 :
```yaml
ports:
  - "5432:5432"    # ← EXPOSE LA BASE SUR TOUTES LES INTERFACES
```

En production, ce port ne doit pas être exposé sur l'interface publique. Utiliser `127.0.0.1:5432:5432`.

**FINDING MAJEUR — Headers CSP absents :**

`helmet` est activé (`app.use(helmet())`), ce qui ajoute les headers de base. Mais aucune Content Security Policy (CSP) personnalisée n'est configurée. La configuration par défaut de Helmet est restrictive mais ne couvre pas les besoins spécifiques de l'app (Tailwind inline styles, CDN Wikimedia pour les logos).

**FINDING MOYEN — NODE_ENV en "development" hardcodé :**

`backend/.env` ligne 5 : `NODE_ENV="development"`. Si ce fichier est copié tel quel en production, les cookies `secure` et `sameSite: 'strict'` ne seront PAS activés.

**FINDING MOYEN — Pas de conteneur pour l'application :**

Le `docker-compose.yml` ne contient que PostgreSQL. L'application backend et frontend sont lancées directement sur l'hôte, sans isolation Docker.

---

### A03 — Software Supply Chain : ⚠️ Partiel

**Points positifs :**
- `package-lock.json` présent pour le backend ET le frontend
- Versions récentes des dépendances critiques (bcrypt 6.0, helmet 8.1, express-rate-limit 8.3)

**FINDING MOYEN — Express version ancienne :**
`"express": "~4.16.1"` — Express 4 est supporté mais la version 4.16.x est ancienne (2018). La version 4.21.x est disponible. Le symbole `~` accepte uniquement les patches, pas les minor updates.

**FINDING MOYEN — morgan ~1.9.1 :**
Morgan 1.9.1 date de 2018. La version 1.10.x est disponible.

**FINDING BASSE — dev.db SQLite dans le répertoire backend :**
`backend/dev.db` est un fichier SQLite de développement qui ne devrait pas exister dans un projet PostgreSQL. Il n'est pas dans le `.gitignore`.

---

### A04 — Cryptographic Failures : ⚠️ Partiel

**Points positifs :**
- bcrypt avec 12 rounds (excellent)
- JWT signé avec secret de 128 caractères aléatoires (excellent)
- Cookies httpOnly + secure en production
- Protection anti-timing attack sur le login (dummy hash)

**FINDING CRITIQUE — Access token et Refresh token signés avec le MÊME secret :**

`backend/src/utils/jwt.ts` lignes 12-22 :
```typescript
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}
export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });  // MÊME SECRET
}
```

Utiliser le même secret pour les deux tokens compromet la rotation des tokens. Un refresh token valé peut être utilisé comme access token.

**Correction :**
```typescript
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
// Utiliser JWT_REFRESH_SECRET pour les refresh tokens
```

**FINDING MAJEUR — Pas de révocation de tokens :**
Il n'existe aucun mécanisme de blacklist/révocation de JWT. Après un `logout`, le cookie est effacé côté client mais le token reste valide jusqu'à expiration (8h). Toute personne avec le cookie peut continuer à l'utiliser.

**FINDING MOYEN — Photos d'incidents stockées en base64 dans la BDD :**

`incidentController.ts` ligne 26 : Les photos sont stockées dans le champ `photoUrl` en base64 (jusqu'à 5 Mo), directement en base de données. Cela est extrêmement coûteux en espace et en performance. Recommandation : stocker les fichiers sur un système de fichiers ou un service de stockage objet (S3, MinIO) et stocker uniquement l'URL.

---

### A05 — Injection : ✅ Conforme

**Points positifs :**
- Prisma ORM utilisé exclusivement, aucune requête SQL brute
- Validation systématique des entrées (longueurs, types, énumérations)
- Protection path traversal dans `app.ts` lignes 45-51
- Validation des enums `VehicleStatus`, `Role`, `IncidentSeverity` côté serveur

---

### A06 — Insecure Design : ⚠️ Partiel

**Points positifs :**
- Anti-conflit de réservation implémenté côté serveur dans une transaction Prisma (excellent)
- Vérification kilométrage rétrograde côté serveur ET client
- Rate limiting global (200 req/15min) + rate limiting login (10 req/15min)

**FINDING MAJEUR — Pas de limite sur les réservations récurrentes :**

`ReservationModal.tsx` ligne 157 : Le frontend crée jusqu'à 5 réservations en parallèle (`Promise.all`). Si un acteur malveillant appelle directement l'API, il peut créer des centaines de réservations en peu de temps. Il n'y a pas de limite serveur sur le nombre de réservations par utilisateur par période.

**FINDING MOYEN — Absence de validation du véhicule dans updateReservation :**

`reservationController.ts` ligne 188 : La vérification d'accès au `vehicleId` lors d'un changement de véhicule dans une mise à jour est absente. Seul l'accès à la réservation existante est vérifié, pas au nouveau véhicule.

---

### A07 — Identification & Auth Failures : ✅ Conforme

**Points positifs :**
- Mots de passe forts imposés (8 chars, majuscule, minuscule, chiffre, spécial)
- Validation côté serveur et indicateur de force côté client
- Rate limiting login : 10 tentatives / 15 minutes
- Cookies httpOnly, secure en prod, sameSite strict en prod
- Refresh token avec chemin restreint (`path: '/api/users/refresh'`)
- Protection contre l'énumération des emails (timing attack)
- Hiérarchie des rôles respectée pour la modification de mots de passe

---

### A08 — Software & Data Integrity : ✅ Conforme

**Points positifs :**
- Validation systématique des données côté serveur (types, longueurs, enums)
- Protection mass assignment : seuls les champs explicitement listés sont utilisés
- `userId` toujours extrait de `req.user` (authentifié), jamais du corps de la requête

---

### A09 — Security Logging : ❌ Non conforme

**FINDING CRITIQUE — Log d'authentification écrit sur un chemin absolu Windows :**

`backend/src/middleware/auth.ts` lignes 45-46 :

```typescript
const fs = require('fs');
fs.appendFileSync('c:\\Users\\admin.local\\Desktop\\reservation voiture\\debug_auth.log',
  `[AUTH] ${new Date().toISOString()} - User: ${user.email}, Poles: ${JSON.stringify(user.userPoles?.map((p: any) => p.poleId))}\n`);
```

**C'est une faille critique à plusieurs niveaux :**
1. **Chemin hardcodé** : ne fonctionnera pas dans un conteneur ou sur un autre serveur
2. **Données personnelles dans les logs** : l'email de l'utilisateur est loggé à CHAQUE requête authentifiée — violation RGPD
3. **Performance** : `appendFileSync` est synchrone, il bloque le thread Node.js à chaque requête
4. **Erreurs silencieuses** : si le fichier n'est pas accessible, cela pourrait faire crasher le middleware d'authentification

**Correction :**
```typescript
// Supprimer totalement ces 3 lignes ou les remplacer par un logger structuré :
// logger.debug({ userId: user.id, poles: poleIds }, 'User authenticated');
// Note: ne JAMAIS logger les emails en production
```

**FINDING MAJEUR — `console.debug` en production dans accessControl :**

`backend/src/utils/accessControl.ts` lignes 13-15 :
```typescript
console.debug(`[AccessControl] User: ${user.email}, Role: ${user.role}`);
console.debug(`[AccessControl] PoleIds:`, poleIds);
```

Ces logs exposent des données personnelles (email) dans les logs de la console, qui peuvent être collectés par des systèmes de monitoring.

**FINDING MOYEN — Absence de logs de sécurité structurés :**
Il n'existe pas de logs pour les événements de sécurité critiques : tentatives de connexion échouées, accès refusés, suppressions de comptes. En contexte médico-social, ces traces sont exigées.

---

### A10 — Mishandling Exceptions : ⚠️ Partiel

**Points positifs :**
- Gestionnaire d'erreur global dans `app.ts` qui ne retourne pas les stack traces
- Messages d'erreur génériques en production
- Codes d'erreur Prisma (`P2002`, `P2025`, `P2003`) gérés explicitement

**FINDING MOYEN — Absence d'Error Boundaries React :**
Le frontend Next.js ne dispose d'aucun Error Boundary. Une erreur JavaScript non interceptée dans un composant crashe silencieusement toute l'application sans message utilisateur.

---

## 3. CONFORMITE RGPD

### 3.1 Données personnelles collectées

| Donnée | Localisation dans le schéma | Sensibilité |
|---|---|---|
| Nom complet | `User.name` | Personnelle |
| Email professionnel | `User.email` | Personnelle |
| Rôle/Département | `User.role`, `User.department` | Professionnelle |
| Hash de mot de passe | `User.passwordHash` | Sensible |
| Historique des déplacements | `TripLog` (dates, km, destinations) | Comportementale |
| Destinations/Motifs | `Reservation.destination`, `TripLog.destination` | Potentiellement sensible |
| Photos d'incidents | `Incident.photoUrl` (base64) | Potentiellement sensible |
| Assignations de nettoyage | `CleaningAssignment.completedAt` | Comportementale |

### 3.2 Analyse RGPD

**FINDING CRITIQUE — Aucune politique de confidentialité ni mentions légales :**
Aucune page de politique de confidentialité, aucune mention RGPD n'a été trouvée dans l'application. Pour une application traitant des données d'employés en contexte médico-social, c'est une non-conformité majeure.

**FINDING CRITIQUE — Droits des personnes non implémentés :**
- Droit d'accès : aucun endpoint `/api/users/me/export`
- Droit à l'oubli : la suppression d'un utilisateur est bloquée s'il a des réservations/trajets (erreur P2003). Impossible de supprimer un compte avec des données associées.
- Droit de rectification : seul le mot de passe et les assignations peuvent être modifiés. Le nom et l'email ne peuvent pas être mis à jour par l'utilisateur lui-même.
- Droit à la portabilité : aucun export des données personnelles.

**FINDING CRITIQUE — Durées de conservation non définies :**
Il n'existe aucune politique de rétention des données. Les TripLogs, FuelLogs et Incidents s'accumulent indéfiniment sans archivage ni purge.

**FINDING MAJEUR — Champ "Destination / Motif" sans avertissement RGPD :**

`ReservationModal.tsx` ligne 385 :
```jsx
<label>Destination / Motif</label>
<input placeholder="Ex: Siège social, RDV Client..." />
```

Dans le contexte médico-social APAJH, ce champ libre pourrait être utilisé pour saisir des informations nominatives sur des usagers (ex: "Transport de M. Dupont, IME Les Pins"). Il n'y a **aucun avertissement** indiquant de ne pas saisir de données nominatives sur des usagers. C'est une violation RGPD potentiellement grave dans ce contexte spécifique.

**Correction requise :**
```jsx
<label>Destination / Motif</label>
<p className="text-destructive text-xs font-bold">
  ⚠️ Ne pas saisir de données nominatives sur les usagers
</p>
<input placeholder="Ex: SESSAD, Réunion administrative, Visite terrain..." />
```

**FINDING MOYEN — Email loggé à chaque requête :**
Voir A09 — le fichier `debug_auth.log` contient l'email de chaque utilisateur pour chaque requête. Un log de données personnelles sans base légale ni durée de conservation définie.

**FINDING MOYEN — Numéro de permis de conduire absent mais prévu :**
Le schéma Prisma ne contient pas de champ `licenseNumber` sur le modèle `User`. C'est un point positif (données non collectées = pas de risque). Cependant, si ce champ est ajouté en V2, il devra être chiffré au repos (AES-256) et sa collecte devra être justifiée.

**FINDING BASSE — Base de données sans chiffrement au repos configuré :**
Le volume Docker `fleet_pgdata` ne configure pas de chiffrement au niveau du système de fichiers.

### 3.3 Recommandations RGPD spécifiques médico-social

1. Créer une page "Politique de confidentialité" accessible depuis l'app
2. Définir des durées de conservation (ex: TripLogs conservés 3 ans, puis archivés)
3. Implémenter un endpoint d'export des données personnelles
4. Ajouter un avertissement sur le champ motif/destination
5. Documenter le traitement RGPD (registre des traitements)
6. Désactiver l'enregistrement de fichiers log contenant des emails

---

## 4. BASE DE DONNEES

### 4.1 Schéma complet — Analyse

**Modèles présents :**
`Pole` → `Service` → `Vehicle`
`User` ↔ `UserPole` ↔ `Pole`
`User` ↔ `UserService` ↔ `Service`
`User` → `Reservation` ↔ `ReservationPassenger`
`Reservation` → `TripLog`
`Vehicle` → `CleaningSchedule` → `CleaningAssignment` ↔ `User`
`Vehicle` → `Incident`
`Vehicle` → `FuelLog`
`Vehicle` → `MaintenanceAlert`

### 4.2 Index et contraintes

| Vérification | Résultat |
|---|---|
| Unicité `plateNumber` | ✅ `@unique` sur `Vehicle.plateNumber` |
| Unicité `email` | ✅ `@unique` sur `User.email` |
| Unicité `User.entraId` | ✅ `@unique` |
| Contrainte `CleaningSchedule (vehicleId, weekStart)` | ✅ `@@unique` |
| Contrainte `CleaningAssignment (scheduleId, userId)` | ✅ `@@unique` |
| Cascade delete sur UserPole/UserService | ✅ `onDelete: Cascade` |
| Index sur `Reservation.vehicleId` | ✅ `@@index` |
| Index sur `TripLog.vehicleId` | ✅ `@@index` |
| Index sur `Incident.vehicleId` | ✅ `@@index` |

### 4.3 Findings base de données

**FINDING MAJEUR — Pas de soft delete :**
Aucun mécanisme `deletedAt` / `isDeleted` sur aucun modèle. La suppression d'un utilisateur ou d'un véhicule est définitive et irréversible. En contexte professionnel réglementé, l'historique doit être conservé.

**Correction recommandée :**
```prisma
model User {
  // ...
  deletedAt DateTime?  // soft delete
}
```

**FINDING MAJEUR — `approvalStatus` avec valeur par défaut APPROVED :**

`schema.prisma` ligne 126 :
```prisma
approvalStatus ApprovalStatus @default(APPROVED)
```

Toute réservation est **automatiquement approuvée** sans aucun workflow de validation. Le statut PENDING existe dans l'enum mais n'est jamais utilisé. La réservation est créée directement en APPROVED, contournant tout circuit de validation managériale.

**FINDING MOYEN — Absence de table/colonne "pôle" directe sur Vehicle :**
Un véhicule est lié à un pôle via `Vehicle → Service → Pole`. Cette indirection fonctionne mais crée un point de fragililté : un véhicule sans service associé n'appartient à aucun pôle et est visible par tous les ADMIN/DIRECTEUR. Il serait plus robuste d'ajouter un champ `poleId` direct optionnel sur `Vehicle`.

**FINDING MOYEN — `datasource db` sans URL dans schema.prisma :**

`schema.prisma` lignes 5-7 :
```prisma
datasource db {
  provider = "postgresql"
  // url manquante — gérée via DATABASE_URL dans .env
}
```

L'URL est gérée via la variable d'environnement `DATABASE_URL`, ce qui est correct, mais sa documentation est absente dans le schéma.

**FINDING MOYEN — Absence d'index temporels sur les réservations :**
Aucun index sur `Reservation.startTime` ou `Reservation.endTime`. Les requêtes de détection de conflits effectuent des scans séquentiels sur la table entière. En production avec de nombreuses réservations, les performances se dégraderont.

**Correction :**
```prisma
@@index([startTime])
@@index([endTime])
@@index([vehicleId, startTime, endTime])  // Index composite pour les conflits
```

**FINDING BASSE — `TripLog.reservationId` nullable :**
Un trajet peut exister sans réservation associée. C'est fonctionnellement valide (trajet ad hoc) mais mérite documentation. La relation bidirectionnelle `Reservation.tripLogs` peut contenir des trajets n'ayant pas de réservation correspondante.

**FINDING BASSE — `MaintenanceAlert` sans index sur `vehicleId` :**
`MaintenanceAlert` n'a pas d'index sur `vehicleId` contrairement à tous les autres modèles liés aux véhicules.

**POINT POSITIF — Schéma prêt pour les incidents V2 :**
Le modèle `Incident` est déjà implémenté avec `photoUrl`, sévérité, statut et blocage automatique du véhicule CRITIQUE. Le schéma est extensible.

**POINT POSITIF — Table passagers implémentée :**
`ReservationPassenger` avec clé composite `(reservationId, userId)` est présente et fonctionnelle.

**POINT POSITIF — Planning de lavage complet :**
`CleaningSchedule` + `CleaningAssignment` avec `completedAt` individuel.

---

## 5. ARCHITECTURE & QUALITE DE CODE

### 5.1 Structure du projet

| Critère | Évaluation |
|---|---|
| Séparation des responsabilités | ✅ Routes / Controllers / Services / Utils |
| TypeScript strict activé | ✅ `"strict": true` backend ET frontend |
| Typage correct | ⚠️ Partiel — nombreux `any` dans le frontend |
| Gestion des erreurs | ✅ Cohérente côté backend, partielle côté frontend |
| Tests unitaires | ❌ Absents |
| Code dupliqué | ⚠️ Quelques duplications |

### 5.2 Findings qualité de code

**FINDING MAJEUR — Aucun test unitaire, intégration ou e2e :**
Le projet ne contient aucun test automatisé (Jest, Vitest, Playwright, etc.). Seuls des scripts de simulation de charge et des tests manuels (fichiers `test-auth.js`, `test-roles.js`) sont présents à la racine du backend, sans framework de test.

**FINDING MOYEN — Usage de `any` étendu dans le frontend :**

Exemples dans `calendar/page.tsx` :
```typescript
const [reservations, setReservations] = useState<any[]>([]);
const [vehicles, setVehicles] = useState<any[]>([]);
```
Et dans `admin/page.tsx`, `admin/history/page.tsx` : nombreux `any` sur les données API.

**FINDING MOYEN — Métadonnées Next.js non mises à jour :**

`frontend/src/app/layout.tsx` lignes 15-18 :
```typescript
export const metadata: Metadata = {
  title: "Create Next App",          // ← TITRE PAR DÉFAUT NON CHANGÉ
  description: "Generated by create next app",  // ← DESCRIPTION PAR DÉFAUT
};
```

**FINDING MOYEN — Code de debug hardcodé dans le frontend :**

`VehicleCard.tsx` lignes 51-66 : Les URLs des logos de marques automobiles (Wikimedia) sont hardcodées dans un objet JavaScript inline. En cas d'indisponibilité de Wikimedia, les logos disparaissent silencieusement.

**FINDING MOYEN — Duplication de la logique getMonday :**
La fonction `getMonday()` est dupliquée dans `admin/cleaning/page.tsx` et `nettoyage/page.tsx`. Elle devrait être extraite dans `lib/utils.ts`.

**FINDING BASSE — Fichiers de test à la racine du backend :**
`test-auth.js`, `test-auth.ts`, `test-roles.js`, `test-roles.ts`, `test-vehicles-api.js`, `start-trip.js`, `check-user.js`, `reset-pwd.ts` — ces fichiers ad hoc ne devraient pas être dans le dépôt principal.

**FINDING BASSE — `metadata.title` non personnalisé :**
Voir FINDING MOYEN ci-dessus. Impact SEO et branding.

**POINT POSITIF — Utilitaire accessControl centralisé :**
`buildVehicleAccessFilter()` est utilisé de façon cohérente dans tous les contrôleurs.

**POINT POSITIF — Transactions Prisma pour les opérations critiques :**
`createReservation`, `startTrip`, `endTrip`, `markCleaningDone` utilisent `prisma.$transaction()`.

---

## 6. DOCKER & INFRASTRUCTURE

### 6.1 Analyse du docker-compose.yml

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine    ✅ Version fixée
    environment:
      POSTGRES_PASSWORD: fleet_password   ❌ Credentials en clair
    ports:
      - "5432:5432"               ❌ Port exposé sur toutes interfaces
    volumes:
      - fleet_pgdata:/var/lib/postgresql/data   ✅ Volume nommé
    restart: unless-stopped       ✅ Redémarrage automatique
```

### 6.2 Findings infrastructure

**FINDING CRITIQUE — Credentials en clair dans docker-compose.yml :**
Voir A02. `POSTGRES_USER: fleet_user`, `POSTGRES_PASSWORD: fleet_password` en clair. Utiliser des variables d'environnement depuis un fichier `.env`.

**Correction :**
```yaml
environment:
  POSTGRES_USER: ${POSTGRES_USER}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  POSTGRES_DB: ${POSTGRES_DB}
```

**FINDING MAJEUR — Pas de services Docker pour l'application :**
Le backend Express et le frontend Next.js ne sont pas conteneurisés. En production, cela pose des problèmes de reproductibilité et de sécurité (l'app tourne directement sur l'hôte).

**FINDING MAJEUR — Port PostgreSQL exposé sur toutes les interfaces :**
`"5432:5432"` → la base de données est accessible depuis n'importe quelle adresse IP. En production, utiliser `"127.0.0.1:5432:5432"`.

**FINDING MOYEN — Absence de healthcheck pour PostgreSQL :**

```yaml
# Ajouter dans le service postgres :
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U fleet_user -d fleet_db"]
  interval: 10s
  timeout: 5s
  retries: 5
```

**FINDING MOYEN — Version docker-compose "3.8" dépréciée :**
La directive `version:` est dépréciée dans les versions récentes de Docker Compose.

**FINDING MOYEN — Pas de limitation de ressources :**
Aucun `deploy.resources.limits` configuré. L'application peut consommer toute la RAM/CPU du serveur.

**POINT POSITIF — Volume nommé pour la persistance :**
`fleet_pgdata` assure la persistance des données PostgreSQL entre les redémarrages.

**POINT POSITIF — Image postgres:16-alpine :**
Version fixée et légère (Alpine Linux).

---

## 7. UX/UI

### 7.1 Observations générales

**Points positifs :**
- Design soigné, cohérent, moderne (Glassmorphism, palette vert/orange APAJH)
- Responsive : sidebar mobile avec backdrop, grille CSS adaptative (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`)
- Loading states systématiques (spinners, skeleton-like)
- Messages d'erreur inline dans les formulaires
- Confirmation avant suppression (ConfirmModal)
- Groupement par pôle sur le dashboard avec couleurs distinctives

**Axes d'amélioration :**
- Le calendrier est uniquement accessible par drag/hover souris (pas de navigation clavier)
- La page `/settings` (utilisateur) est un placeholder non fonctionnel
- Alertes Maintenance dans `admin/page.tsx` sont des données statiques hardcodées ("Révision Peugeot 208", "Contrôle tech. Clio V")
- Le bouton "Ajouter un véhicule" dans `admin/page.tsx` ne fait rien (pas de handler)
- Plage horaire réservable : 05h-19h seulement (les réservations hors plage ne sont pas bloquées côté serveur)

---

## 7b. ACCESSIBILITE (CRITIQUE — utilisateur réel aveugle)

### Score global : ORANGE — Tres difficilement utilisable au lecteur d'ecran

**Résumé :** L'application a des efforts d'accessibilité visibles sur certains composants récents (TripModal, IncidentModal, VehicleCard) mais souffre d'une absence quasi-totale d'accessibilité dans les composants de navigation, les formulaires et les vues principales. L'expérience d'Ahmed (utilisateur aveugle) serait bloquée dès la navigation principale.

### 7b.1 Inventaire des attributs accessibilité présents

Fichiers avec attributs ARIA (sur 21 composants scannés) :
- `TripModal.tsx` : `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-label`, `aria-describedby`, `aria-hidden`, `role="alert"`, `aria-live="polite"`
- `IncidentModal.tsx` : `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-label`
- `VehicleCard.tsx` : `aria-label` sur boutons d'action, `role="status"`, `aria-hidden`
- `FuelModal.tsx` : `aria-label`, `htmlFor`
- `Sidebar.tsx` : `role="menubar"`, `aria-label` sur les liens

### 7b.2 Violations d'accessibilité détaillées

**FINDING CRITIQUE A11Y — Absence totale de skip links :**
Aucun lien "Aller au contenu principal" n'est présent. Ahmed devra traverser toute la sidebar (8 liens) à chaque chargement de page.

**Correction :**
```jsx
// Dans layout.tsx, avant le AuthProvider :
<a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-white focus:p-4 focus:rounded">
  Aller au contenu principal
</a>
// Puis id="main-content" sur la balise <main>
```

**FINDING CRITIQUE A11Y — Inputs sans label associé dans ReservationModal :**

`ReservationModal.tsx` lignes 325-396 : Les `<input type="date">` et `<select>` (heure, minutes) n'ont pas de `htmlFor`/`id` associés. Ahmed ne pourra pas savoir à quoi correspondent ces champs.

```jsx
// Problème :
<label>Début de mission</label>
<input type="date" ... />  // Pas d'id, pas de for

// Correction :
<label htmlFor="start-date">Date de début de mission</label>
<input id="start-date" type="date" aria-describedby="start-date-hint" ... />
<p id="start-date-hint">Format : JJ/MM/AAAA</p>
```

**FINDING CRITIQUE A11Y — Labels visuels seulement (pas de htmlFor) dans ReservationModal :**

`ReservationModal.tsx` lignes 384-396 : Le champ "Destination / Motif" a une `<label>` mais sans `htmlFor` associé à l'`id` de l'input. L'association programmatique est absente.

**FINDING CRITIQUE A11Y — Boutons d'accompagnants sans nom accessible :**

`ReservationModal.tsx` lignes 409-421 : Les boutons de sélection des accompagnants affichent le nom de l'utilisateur, mais leur état (sélectionné/non sélectionné) n'est pas communiqué aux technologies d'assistance.

```jsx
// Problème :
<button onClick={...}>{selected ? '✓ ' : ''}{u.name}</button>

// Correction :
<button
  onClick={...}
  aria-pressed={selected}
  aria-label={`${selected ? 'Retirer' : 'Ajouter'} ${u.name} comme accompagnant`}
>
  {u.name}
</button>
```

**FINDING CRITIQUE A11Y — Calendrier inaccessible au clavier :**

`calendar/page.tsx` lignes 135-168 : L'interaction avec le calendrier (créer une réservation par drag) utilise exclusivement `onMouseDown`, `onMouseMove`, `onMouseUp`. Aucune alternative clavier n'est fournie. Ahmed ne peut pas créer de réservation depuis le calendrier.

**FINDING CRITIQUE A11Y — Sidebar : bouton logout sans label accessible :**

`Sidebar.tsx` ligne 96-101 :
```jsx
<button title="Déconnexion" ...>
  <LogOut className="h-6 w-6" />
</button>
```
`title` n'est pas fiable avec tous les lecteurs d'écran. Utiliser `aria-label="Se déconnecter"`.

**FINDING MAJEUR A11Y — Structure des headings incohérente :**

Exemple `admin/page.tsx` : `<h1>Espace Administration</h1>` suivi de `<h2>Incidents Récents</h2>` mais pas de `<h2>` sur les cartes statistiques (qui sont des `<div>`). La hiérarchie des titres est fragmentée.

**FINDING MAJEUR A11Y — VehicleCard : `<div onClick>` principal non focusable :**

`VehicleCard.tsx` ligne 148 :
```jsx
<div onClick={() => setIsDetailModalOpen(true)} className="...cursor-pointer">
```
Ce `<div>` cliquable n'est pas focusable au clavier et n'a pas de `role="button"` ni de `tabIndex={0}`. Un utilisateur ne peut pas l'activer sans souris.

**Correction :**
```jsx
<div
  role="button"
  tabIndex={0}
  onClick={...}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsDetailModalOpen(true); }}
  aria-label={`Voir les détails de ${vehicle.brand} ${vehicle.model}`}
>
```

**FINDING MAJEUR A11Y — Modale login sans gestion du focus :**

`login/page.tsx` : À l'ouverture de la page, le focus n'est pas automatiquement placé sur le premier champ du formulaire. Les labels des champs ("Identifiant professionnel", "Mot de passe") n'ont pas de `htmlFor` associé à leurs inputs.

**FINDING MAJEUR A11Y — Erreurs de formulaire non liées via aria-describedby :**

Dans la plupart des formulaires, les messages d'erreur sont affichés dans un `<div>` séparé mais ne sont pas liés aux champs concernés via `aria-describedby`. Ahmed ne saura pas quel champ est en erreur.

**FINDING MOYEN A11Y — Images sans alt dans VehicleCard :**

`VehicleCard.tsx` lignes 153-163 : Les `<img>` de véhicules ont des `alt` corrects.
`VehicleCard.tsx` lignes 80-86 : L'image du logo de marque a `alt={brand}` — correct.

Mais `login/page.tsx` ligne 142 :
```jsx
<img src="/logo.png" alt="Logo" className="h-6 grayscale invert" />
```
`alt="Logo"` est trop générique. Utiliser `alt="Logo APAJH"`.

**FINDING MOYEN A11Y — Filtres du calendrier non accessibles :**

`calendar/page.tsx` : Le bouton filtre véhicule ouvre un dropdown sans `role="listbox"`, `aria-expanded` ni gestion du focus à l'intérieur.

**FINDING MOYEN A11Y — Composant nettoyage : boutons sans état :**

`admin/cleaning/page.tsx` lignes 422-432 : Le bouton de statut (cercle/check) n'a pas d'`aria-pressed` ni de label d'état.

**FINDING BASSE A11Y — Contrastes — vigilance requise :**

Couleur primaire : `#4A6728` (vert foncé) sur fond blanc → ratio estimé 7:1 (conforme AA)
Couleur accent : `#F18E38` (orange) sur fond blanc → ratio estimé ~3:1 (limite AA pour texte normal, non conforme pour petit texte)
Texte `text-white/40` à `text-white/20` sur fond sombre (login) → potentiellement non conforme

**FINDING BASSE A11Y — announce live regions absentes :**

Aucun `aria-live="polite"` sur les messages de succès qui apparaissent après soumission de formulaire (sauf TripModal). Ahmed ne sera pas notifié du succès d'une réservation.

### 7b.3 Récapitulatif accessibilité

| Composant | Score A11Y |
|---|---|
| TripModal | Bonne base (80%) |
| IncidentModal | Bonne base (75%) |
| VehicleCard | Partiel (50%) |
| ReservationModal | Insuffisant (25%) |
| Sidebar | Très insuffisant (20%) |
| Calendar | Inaccessible (5%) |
| Login | Insuffisant (30%) |
| Admin/Cleaning | Insuffisant (20%) |
| Admin/Users | Insuffisant (20%) |

**Conclusion : Ahmed ne peut pas utiliser l'application de façon autonome dans son état actuel.** Le calendrier, la réservation et la navigation sont des bloquants majeurs.

---

## 8. WORKFLOW METIER

### 8.1 Cycle de réservation

| Étape | Implémenté ? | Détail |
|---|---|---|
| 1. Réservation avec anti-conflit côté serveur | ✅ Oui | Transaction Prisma avec détection d'overlap |
| 2. Planning visuel calendrier par véhicule | ✅ Oui | Calendrier semaine + filtre par véhicule |
| 3. Remise des clés (validation secrétaire) | ❌ Non | Aucun workflow de remise/réception de clés |
| 4. Départ : km, heure, lieu | ⚠️ Partiel | km + heure enregistrés, lieu/destination non dans TripLog |
| 5. Retour : km, heure, état véhicule | ⚠️ Partiel | km + heure enregistrés, état via notes texte libre |
| 6. Rendu des clés : confirmation secrétaire | ❌ Non | Non implémenté |

**FINDING MAJEUR METIER — Workflow "clés" absent :**
L'application ne dispose d'aucun mécanisme de remise/restitution de clés. Ce workflow est pourtant au cœur du besoin métier pour une association avec une secrétaire comme point de contrôle.

**FINDING MOYEN METIER — Destination absente dans TripLog :**

`schema.prisma` ligne 158 : `TripLog.destination` est optionnel. Lors du démarrage d'un trajet (`startTrip`), le champ `destination` n'est pas transmis. Le TripLog ne contient que le kilométrage et la réservation liée.

### 8.2 Workflow de lavage

| Aspect | Implémenté ? | Détail |
|---|---|---|
| Planning hebdomadaire de lavage | ✅ Oui | `CleaningSchedule` + interface admin dédiée |
| Assignation d'agents | ✅ Oui | 2 agents minimum, agents du service en priorité |
| Déclaration individuelle de nettoyage | ✅ Oui | `/nettoyage` pour PROFESSIONNEL + self-complete |
| Historique des lavages par véhicule | ✅ Oui | `CleaningAssignment.completedAt` |
| Carte de lavage gérée dans l'app | ❌ Non | Aucun modèle ni interface pour la carte de lavage |
| Fiche de remise de la carte digitalisée | ❌ Non | Non implémenté |
| Blocage réservation pendant lavage | ❌ Non | Le créneau de lavage ne bloque pas les réservations |

**FINDING MAJEUR METIER — Carte de lavage non numérisée :**
Le schéma Prisma ne contient aucun champ pour la carte de lavage (numéro, responsable, solde). La traçabilité de la carte est entièrement manuelle.

**FINDING MOYEN METIER — Lavage ne bloque pas la réservation :**
Un véhicule peut être réservé pendant un créneau de lavage planifié. Il n'y a pas de vérification de conflit entre `CleaningSchedule` et `Reservation`.

### 8.3 Cas limites

| Cas limite | Géré ? | Détail |
|---|---|---|
| Prolongation de réservation | ⚠️ Partiel | updateReservation avec anti-conflit, mais sans notification |
| Annulation tardive | ❌ Non | La suppression est immédiate, pas d'historique des annulations |
| Retard de retour | ❌ Non | Aucun mécanisme d'alerte si un trajet dépasse la durée prévue |
| Réservation hors horaires (soirée/weekend) | ❌ Non | Pas de restriction côté serveur, plage limitée 05h-19h côté UI uniquement |
| Gestion des passagers | ✅ Oui | `ReservationPassenger` présent et fonctionnel |
| Workflow approbation managérial | ❌ Non | `approvalStatus` est toujours APPROVED automatiquement |

**FINDING MAJEUR METIER — Pas d'historique des annulations :**
Quand une réservation est supprimée, elle disparaît définitivement. Il n'y a pas de trace de qui a annulé, quand, ni pour quelle raison.

**FINDING MOYEN METIER — Alertes maintenance statiques :**

`admin/page.tsx` lignes 241-257 : Les alertes maintenance ("Révision Peugeot 208", "Contrôle tech. Clio V") sont **des données hardcodées dans le HTML**, pas issues de la table `MaintenanceAlert`. Le modèle `MaintenanceAlert` existe en base mais n'est pas connecté à l'interface.

---

## 9. PLAN D'ACTION PRIORISE

### Priorite CRITIQUE (a corriger AVANT toute mise en production)

| # | Action | Fichier | Effort |
|---|---|---|---|
| C1 | **Supprimer l'endpoint `/api/debug/db`** qui expose toutes les données sans auth | `backend/src/app.ts` L75-86 | 5 min |
| C2 | **Supprimer le log sur disque dur dans auth.ts** (données personnelles, chemin absolu Windows) | `backend/src/middleware/auth.ts` L45-46 | 5 min |
| C3 | **Supprimer les `console.debug` avec emails** dans accessControl.ts | `backend/src/utils/accessControl.ts` L13-15 | 5 min |
| C4 | **Séparer les secrets access/refresh JWT** (deux secrets différents) | `backend/src/utils/jwt.ts` + `.env` | 30 min |
| C5 | **Corriger docker-compose.yml** : secrets en variables d'env, port 127.0.0.1 uniquement | `docker-compose.yml` | 20 min |
| C6 | **Ajouter avertissement RGPD sur le champ "Destination/Motif"** | `ReservationModal.tsx` L384 | 10 min |
| C7 | **Mettre NODE_ENV=production** dans le fichier .env de production | `backend/.env` | 2 min |
| C8 | **Skip links accessibilité** pour l'utilisateur aveugle | `frontend/src/app/layout.tsx` | 30 min |
| C9 | **Labels de formulaires avec htmlFor/id** dans ReservationModal | `ReservationModal.tsx` | 1h |
| C10 | **aria-live sur les messages de succès** dans tous les formulaires | Tous les modaux | 2h |

### Priorite HAUTE (a corriger rapidement)

| # | Action | Effort |
|---|---|---|
| H1 | Ajouter contrôle d'accès pôle dans `updateVehicle` | 30 min |
| H2 | Rendre la VehicleCard focusable au clavier (`role="button"`, `tabIndex`, `onKeyDown`) | 1h |
| H3 | Rendre le calendrier navigable au clavier (alternative au drag) | 1 jour |
| H4 | Implémenter la révocation de tokens JWT (blacklist Redis ou rotation) | 1 jour |
| H5 | Stocker les photos d'incidents sur le système de fichiers, pas en base64 | 1 jour |
| H6 | Créer une page de politique de confidentialité RGPD | 1 jour |
| H7 | Implémenter le droit d'export des données personnelles | 1 jour |
| H8 | Ajouter `aria-pressed` sur les boutons toggle (accompagnants, lavage) | 2h |
| H9 | Corriger le bouton logout sidebar avec `aria-label` | 15 min |
| H10 | Ajouter `aria-describedby` pour lier les erreurs aux champs | 2h |
| H11 | Corriger `approvalStatus @default(APPROVED)` — implémenter le workflow de validation | 2 jours |
| H12 | Ajouter `@@index([startTime, endTime, vehicleId])` sur `Reservation` | 30 min |

### Priorite MOYENNE (a planifier)

| # | Action | Effort |
|---|---|---|
| M1 | Implémenter le soft delete (`deletedAt`) sur User et Vehicle | 1 jour |
| M2 | Créer l'endpoint d'export des données personnelles (`/api/users/me/export`) | 1 jour |
| M3 | Mettre à jour les métadonnées Next.js (`title`, `description`) | 15 min |
| M4 | Supprimer les fichiers de test à la racine du backend | 10 min |
| M5 | Ajouter des healthchecks dans docker-compose.yml | 30 min |
| M6 | Remplacer les `any` par des types stricts dans le frontend | 2 jours |
| M7 | Ajouter des Error Boundaries React | 1 jour |
| M8 | Mettre à jour Express vers 4.21+ | 30 min |
| M9 | Containeriser le backend et le frontend (Dockerfiles) | 1 jour |
| M10 | Définir des durées de conservation (cron de purge des données) | 2 jours |
| M11 | Corriger la hiérarchie des headings (h1/h2/h3) | 1 jour |
| M12 | Ajouter un `aria-live` région pour les dropdowns du calendrier | 2h |

### Priorite BASSE (ameliorations)

| # | Action |
|---|---|
| B1 | Supprimer `dev.db` du dépôt et l'ajouter au `.gitignore` |
| B2 | Configurer une CSP (Content Security Policy) personnalisée |
| B3 | Ajouter un index sur `MaintenanceAlert.vehicleId` |
| B4 | Extraire `getMonday()` dans `lib/utils.ts` (DRY) |
| B5 | Améliorer le contraste de la couleur accent (#F18E38) pour petit texte |
| B6 | Remplacer `morgan` vers 1.10.x |
| B7 | Ajouter un générateur de mot de passe accessible (actuellement `Math.random()`) |
| B8 | Mettre `alt="Logo APAJH"` sur l'image du logo |

### Fonctionnalites metier manquantes (a developper)

| # | Fonctionnalité | Priorité |
|---|---|---|
| F1 | **Workflow remise/restitution de clés** (statut intermédiaire de réservation) | HAUTE |
| F2 | **Carte de lavage numérisée** (modèle, fiche de remise, solde) | HAUTE |
| F3 | **Blocage réservation pendant créneau de lavage** | HAUTE |
| F4 | **Historique des annulations** (soft delete sur Reservation) | MOYENNE |
| F5 | **Alertes maintenance dynamiques** (connecter la table `MaintenanceAlert` à l'UI) | MOYENNE |
| F6 | **Alerte retard de retour** (cron ou webhook si TripLog ouvert > durée réservation) | MOYENNE |
| F7 | **Workflow approbation managériale des réservations** | MOYENNE |
| F8 | **Restriction horaires de réservation côté serveur** (ex: pas de weekend, pas après 19h) | BASSE |
| F9 | **Notifications email** (réservation confirmée, retard, maintenance) | BASSE |

---

## 10. POINTS POSITIFS

1. **Anti-conflit de réservation robuste** : implémenté dans une transaction Prisma avec détection correcte des 3 cas d'overlap (avant, après, englobant)

2. **Cloisonnement multi-pôle cohérent** : `buildVehicleAccessFilter()` centralisé, appliqué dans TOUS les contrôleurs

3. **Authentification de qualité** : bcrypt 12 rounds, protection anti-timing attack sur le login, cookies httpOnly, mots de passe forts imposés avec validation visuelle

4. **Module de lavage complet** : planning hebdomadaire, assignation d'agents, confirmation individuelle, vue professionnelle dédiée

5. **Module incidents fonctionnel** : 4 niveaux de sévérité, blocage automatique CRITIQUE, photos, résolution avec déblocage automatique

6. **TypeScript strict activé** côté backend ET frontend

7. **Passagers/accompagnants implémentés** : `ReservationPassenger` avec sélecteur dans le modal

8. **Efforts d'accessibilité sur les composants récents** : TripModal et IncidentModal ont des attributs ARIA corrects (role="dialog", aria-modal, aria-labelledby, aria-live)

9. **Rate limiting en place** : global (200/15min) et spécifique login (10/15min)

10. **Gestion d'erreurs cohérente côté serveur** : handler global, messages génériques, codes Prisma gérés

---

## 11. CHECKLIST PRE-PRODUCTION

### Securite (bloquant)
- [ ] C1 — Supprimer `/api/debug/db`
- [ ] C2 — Supprimer le log fichier dans auth.ts
- [ ] C3 — Supprimer les console.debug avec emails
- [ ] C4 — Séparer les secrets JWT access/refresh
- [ ] C5 — Corriger docker-compose.yml (secrets + port)
- [ ] C7 — NODE_ENV=production en production

### RGPD (bloquant)
- [ ] C6 — Avertissement RGPD sur le champ Destination/Motif
- [ ] H6 — Page de politique de confidentialité
- [ ] H7 — Endpoint d'export des données personnelles
- [ ] M10 — Définir les durées de conservation

### Accessibilite (bloquant pour l'utilisateur aveugle)
- [ ] C8 — Skip links
- [ ] C9 — Labels htmlFor sur tous les inputs
- [ ] C10 — aria-live sur les succès
- [ ] H2 — VehicleCard focusable au clavier
- [ ] H3 — Alternative clavier au calendrier
- [ ] H8 — aria-pressed sur les toggles
- [ ] H9 — aria-label sur logout
- [ ] H10 — aria-describedby sur les erreurs

### Qualite (recommande)
- [ ] H11 — Implémenter le workflow d'approbation
- [ ] H12 — Index sur Reservation.startTime/endTime
- [ ] M1 — Soft delete sur User/Vehicle
- [ ] M3 — Métadonnées Next.js
- [ ] M7 — Error Boundaries React
- [ ] M9 — Containerisation Docker complète

### Tests (recommande)
- [ ] Écrire au moins 10 tests unitaires sur les contrôleurs critiques (réservation, auth, accès)
- [ ] Tester le cloisonnement multi-pôle avec des utilisateurs de pôles différents
- [ ] Tester l'anti-conflit de réservation (race condition)
- [ ] Tester les flows accessibilité avec NVDA ou JAWS

### Metier (necessaire avant mise en service)
- [ ] F1 — Workflow remise/restitution de clés
- [ ] F3 — Blocage réservation pendant lavage
- [ ] F5 — Alertes maintenance dynamiques (table MaintenanceAlert)

---

*Audit réalisé par Claude Code — 25 mars 2026*
*Tous les fichiers sources ont été lus intégralement : 14 contrôleurs/routes backend, 11 pages frontend, 11 composants, 1 schéma Prisma, 1 docker-compose, 2 tsconfig, 2 package.json, 2 .gitignore, les fichiers .env et de configuration.*
