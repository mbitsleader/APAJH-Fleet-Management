#!/bin/bash

# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker si absent
if ! command -v docker &> /dev/null; then
    echo "Installation de Docker..."
    sudo apt install docker.io -y
    sudo systemctl start docker
    sudo systemctl enable docker
fi

# Installer Docker Compose si absent
if ! command -v docker-compose &> /dev/null; then
    sudo apt install docker-compose -y
fi

# Installer Node.js et NPM si absents
if ! command -v node &> /dev/null; then
    echo "Installation de Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Lancer la base de données
echo "Lancement de la base de données..."
cd database
sudo docker-compose up -d

# Attendre que la DB soit prête
echo "Attente de la base de données..."
sleep 10

# Installer et lancer le Backend
echo "Configuration du Backend..."
cd ../fleet-management-app/backend
npm install
cp .env.example .env
# Note: Le .env devra être ajusté avec les bonnes infos si nécessaire
npx prisma generate
npm run build
# On lance avec PM2 ou en arrière-plan
sudo npm install -g pm2
pm2 delete backend 2>/dev/null || true
pm2 start dist/index.js --name "backend"

# Installer et lancer le Frontend
echo "Configuration du Frontend..."
cd ../frontend
npm install
npm run build
pm2 delete frontend 2>/dev/null || true
pm2 start "npm run start" --name "frontend"

echo "Déploiement terminé !"
pm2 status
