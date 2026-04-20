# Deploiement Sur Un Serveur Ubuntu Local

## 1. Creer une archive legere depuis Windows

Depuis PowerShell, dans le dossier `fleet-management-app` :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-transfer-package.ps1
```

Le script exclut automatiquement `node_modules`, `.next`, `dist`, les logs et les anciennes archives.

## 2. Envoyer l'archive vers Ubuntu

Exemple avec `scp` :

```powershell
scp -C .\fleet-management-app-ubuntu-YYYYMMDD-HHMMSS.zip ubuntu@192.168.1.50:/home/ubuntu/
```

Remplacez `ubuntu` et `192.168.1.50` par votre utilisateur et l'adresse IP de votre serveur.

## 3. Extraire et lancer sur Ubuntu

```bash
cd /home/ubuntu
unzip fleet-management-app-ubuntu-YYYYMMDD-HHMMSS.zip
cd fleet-management-app
docker compose --env-file .env.prod -f docker-compose.prod.yml up --build -d
```

## 4. Si l'envoi echoue encore

- `Permission denied` : verifiez l'utilisateur SSH, le mot de passe ou la cle SSH.
- `Connection refused` ou timeout : verifiez que le serveur Ubuntu est accessible sur le port `22`.
- `No space left on device` : verifiez l'espace disque sur Ubuntu avec `df -h`.
- Envoi tres lent ou coupe : utilisez l'archive creee par le script ci-dessus au lieu de zipper tout le dossier complet.

## 5. Point important

Les fichiers `.dockerignore` ont ete corriges pour que les builds Docker n'envoient plus `node_modules`, `dist` et `.next` au daemon Docker. Sans cette correction, les builds peuvent devenir tres lourds et provoquer des erreurs pendant la phase d'envoi du contexte.
