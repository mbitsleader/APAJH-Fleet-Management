# Plan d'Implémentation - Version MVP (Application de Gestion de Flotte)

## 🎯 Objectif
Créer la première version opérationnelle (MVP) de l'application de gestion de parc automobile, visant à remplacer les carnets papiers par une application mobile (PWA) et une interface d'administration avec une authentification unique via Microsoft Entra ID.

---

## 🛠️ Stack Technique Sélectionnée
- **Base de données** : PostgreSQL 16 (via Docker)
- **ORM** : Prisma (pour typage stricte et migrations simples)
- **Backend (API REST)** : Express.js avec TypeScript ou NestJS (pour commencer rapidement mais structuré, nous opterons pour un backend TypeScript Express standardisé)
- **Frontend (Web/PWA)** : Next.js 14 (App Router) avec React, TailwindCSS, et Shadcn UI
- **Authentification** : `@azure/msal-browser` et `@azure/msal-react` (Microsoft Entra ID)
- **Hébergement Local (Phase 1)** : Docker Compose sur NAS Synology avec reverse proxy HTTPS (certificat Synology DDNS)

---

## 📂 Architecture du Projet

Nous allons construire l'application autour d'un monorepo simple pour ce MVP, contenant un dossier `backend` et un dossier `frontend`.

### Backend:
- Gérera l'API `REST` sécurisée.
- Validera les tokens d'accès JWT émis par Microsoft (SSO).
- Gérera la logique métier (vérification du kilométrage, blocage des véhicules) via les contrôleurs et les services (`Express/Prisma`).

### Frontend:
- Consommera l'API via [fetch](file:///C:/Users/KINDERFLEX/Desktop/reservation%20voiture/fleet-management-app/frontend/src/app/page.tsx#26-38) ou `Axios` ou React Query (`@tanstack/react-query`).
- Proposera des vues "Mobile-First" (Paddings larges, gros boutons) pour la saisie sur le terrain.
- Gérera les états locaux (véhicules disponibles, réservation en cours, etc...).

---

## 📝 Modèle de Données (Prisma Schema - Brouillon)

Le schéma Prisma sera le cœur de la plateforme. Voici le modèle initial :

```prisma
model User {
  id           String        @id @default(uuid())
  entraId      String        @unique  // ID venant de Microsoft Entra ID
  email        String        @unique
  name         String
  role         Role          @default(USER) // Enum: USER, MANAGER, ADMIN
  department   String?
  reservations Reservation[]
  tripLogs     TripLog[]
  fuelLogs     FuelLog[]
  incidents    Incident[]
  createdAt    DateTime      @default(now())
}

model Vehicle {
  id             String         @id @default(uuid())
  plateNumber    String         @unique
  brand          String
  model          String
  status         VehicleStatus  @default(AVAILABLE) // Enum: AVAILABLE, IN_USE, MAINTENANCE, BLOCKED
  category       String?
  currentMileage Int
  reservations   Reservation[]
  tripLogs       TripLog[]
  fuelLogs       FuelLog[]
  incidents      Incident[]
  maintenance    MaintenanceAlert[]
}

model Reservation {
  id             String            @id @default(uuid())
  user           User              @relation(fields: [userId], references: [id])
  userId         String
  vehicle        Vehicle           @relation(fields: [vehicleId], references: [id])
  vehicleId      String
  startTime      DateTime
  endTime        DateTime
  approvalStatus ApprovalStatus    @default(APPROVED) // Enum: PENDING, APPROVED, REJECTED
  destination    String?
  tripLogs       TripLog[]
  createdAt      DateTime          @default(now())
}

model TripLog {
  id            String       @id @default(uuid())
  reservation   Reservation? @relation(fields: [reservationId], references: [id])
  reservationId String?
  user          User         @relation(fields: [userId], references: [id])
  userId        String
  vehicle       Vehicle      @relation(fields: [vehicleId], references: [id])
  vehicleId     String
  startMileage  Int
  endMileage    Int?
  startTime     DateTime     @default(now())
  endTime       DateTime?
  destination   String?
}
// etc... FuelLog, Incident models
```

---

## 🚀 Prochaines Étapes Techniques (Sprint 1)

1. Initialiser le répertoire contenant le backend et le frontend.
2. Écrire le fichier [docker-compose.yml](file:///C:/Users/KINDERFLEX/Desktop/reservation%20voiture/fleet-management-app/docker-compose.yml) incluant la base de données PostgreSQL.
3. Créer un script d'initialisation (Seed) de la base de données avec des véhicules fictifs.
4. Mettre en place un squelette Frontend Next.js basique.
5. Inviter l'utilisateur à créer l'Application Registration dans Microsoft Entra ID côté portail Azure, afin de récupérer le `Client ID` et le `Tenant ID`.

## ⚠️ Configuration Requise par l'Utilisateur
Afin de mettre en place l'authentification et l'hébergement, deux actions côté "Infrastucture Client" seront requises avant d'aller plus loin :
1. **SSO Azure** : Création d'une application dans **Entra ID** avec comme URL de redirection `http://localhost:3000` (pour le dév) et `https://app-vehicules.synology.me` (pour la prod).
2. **Synology DSM** : Activer le DDNS (ex. `entreprise.synology.me`) depuis le panneau de configuration du NAS, générer le certificat Let's Encrypt, et préparer le Reverse Proxy pointant vers le futur conteneur Docker.

## ♿ Accessibilité & Inclusion
L'application étant destinée à la **Fédération APAJH**, l'accessibilité numérique (A11y) est intégrée par défaut :
- **Sémantique HTML5** : Utilisation stricte des balises structurelles.
- **Support Lecteurs d'écran (NVDA)** : Attributs ARIA pour les composants dynamiques (Modales, Status).
- **Navigation Clavier** : Focus visibles et ordre Tabologique logique.

Êtes-vous d'accord pour valider cette architecture pour le MVP ? Si oui, nous pouvons initialiser les dossiers du projet et le [docker-compose.yml](file:///C:/Users/KINDERFLEX/Desktop/reservation%20voiture/fleet-management-app/docker-compose.yml) tout de suite !
