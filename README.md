# APAJH Fleet Management

Système de gestion de flotte automobile pour l'APAJH Mayotte. Cette application permet de gérer les réservations de véhicules, le suivi du nettoyage, les rapports d'incidents et les journaux de bord.

## 🚀 Structure du Projet

L'arborescence du projet est organisée de la manière suivante :

- **leet-management-app/** : Cœur de l'application.
  - **ackend/** : API Node.js/Express avec Prisma ORM et PostgreSQL.
  - **rontend/** : Application web moderne avec Next.js (App Router) et Tailwind CSS.
- **database/** : Configuration Docker pour PostgreSQL et sauvegardes des données (db_dump_v4.json).
- **docs/** : Documentation du projet et rapports d'audit (UI/UX, Sécurité, Accessibilité).
- **ssets/** : Ressources graphiques et logos officiels.

## 🛠️ Installation et Démarrage

### Prérequis
- Docker et Docker Compose
- Node.js (v18+)
- npm ou yarn

### 1. Base de données
Naviguez dans le dossier database et lancez le conteneur PostgreSQL :
`ash
cd database
docker compose up -d
`

### 2. Backend
Configurez l'environnement et lancez le serveur :
`ash
cd ../fleet-management-app/backend
npm install
npx prisma generate
npm run dev
`

### 3. Frontend
Lancez l'application cliente :
`ash
cd ../frontend
npm install
npm run dev
`

L'application sera accessible sur [http://localhost:3000](http://localhost:3000).

## ✨ Fonctionnalités Clés
- **Tableau de bord interactif** : Vue d'ensemble de la flotte groupée par Pôles (Adulte/Enfance).
- **Gestion des réservations** : Planification et suivi de l'utilisation des véhicules.
- **Suivi du nettoyage** : Planning hebdomadaire et validation des tâches de nettoyage.
- **Gestion des incidents** : Signalement et suivi des problèmes mécaniques ou carrosserie.
- **Exports de données** : Génération de rapports d'activité au format Excel/PDF.

## 🔒 Sécurité et Accessibilité
L'application intègre :
- Authentification JWT avec gestion des rôles (Admin, Directeur, Manager, Professionnel).
- Protection contre les attaques courantes (Helmet, Rate Limiting).
- Respect des standards d'accessibilité (Audit A11Y réalisé).

## 📄 Licence
Ce projet est un outil interne propriétaire pour l'APAJH Mayotte.
