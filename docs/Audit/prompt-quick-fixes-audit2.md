# QUICK FIXES AUDIT 2 — À copier-coller dans Claude Code

---

Tu vas corriger TOUS les findings critiques et majeurs identifiés dans l'audit du 25 mars 2026 qui sont rapides à corriger. Ce sont des corrections chirurgicales — ne touche PAS à l'architecture, ne refactorise rien d'autre.

## CONTEXTE

L'audit 2 a trouvé des résidus de debug et des failles de configuration qui n'existaient pas dans l'audit 1. Le JWT et le cloisonnement multi-pôle sont en place et fonctionnels. Ce prompt corrige tout ce qui reste et qui prend moins d'une journée.

---

## CORRECTIONS CRITIQUES (à faire en premier)

### C1. Supprimer l'endpoint /api/debug/db (5 min)

**Fichier** : `backend/src/app.ts` (vers la ligne 75)

Cherche et **SUPPRIME ENTIÈREMENT** le bloc :
```typescript
app.get('/api/debug/db', async (req, res) => {
  // ... tout le bloc qui expose users, poles, vehicles sans auth
});
```

Ce endpoint expose TOUS les utilisateurs, pôles et véhicules sans aucune authentification. Il doit disparaître, pas être conditionné — supprime-le complètement.

### C2. Supprimer le log fichier Windows dans auth.ts (5 min)

**Fichier** : `backend/src/middleware/auth.ts` (vers la ligne 45-46)

Cherche et **SUPPRIME** les lignes qui contiennent :
```typescript
const fs = require('fs');
fs.appendFileSync('c:\\Users\\...\\debug_auth.log', ...);
```

Il peut y avoir 2 ou 3 lignes liées (le require + le appendFileSync). Supprime TOUT ce bloc. C'est une faille RGPD (emails loggés à chaque requête) + un chemin Windows hardcodé qui crashera en production Linux.

### C3. Supprimer les console.debug avec emails dans accessControl (5 min)

**Fichier** : `backend/src/utils/accessControl.ts` (vers les lignes 13-15)

Cherche et **SUPPRIME** toutes les lignes comme :
```typescript
console.debug(`[AccessControl] User: ${user.email}, Role: ${user.role}`);
console.debug(`[AccessControl] PoleIds:`, poleIds);
```

Ces logs exposent les emails des utilisateurs dans la console. En production, les logs de console sont souvent collectés par des outils de monitoring — c'est une violation RGPD.

**IMPORTANT** : Cherche aussi dans TOUS les autres fichiers du backend s'il y a d'autres `console.debug` ou `console.log` qui contiennent `user.email`, `user.name` ou d'autres données personnelles. Supprime-les tous.

```bash
# Commande pour trouver tous les logs avec données personnelles
grep -rn "console\.\(log\|debug\|info\)\(.*\(email\|user\.name\|passwordHash\)\)" backend/src/
```

### C4. Séparer les secrets JWT access/refresh (30 min)

**Fichier** : `backend/.env`

Ajouter une variable :
```env
JWT_REFRESH_SECRET=<GÉNÉRER UNE NOUVELLE CLÉ DIFFÉRENTE DE JWT_SECRET>
```

Génère la clé :
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Fichier** : `backend/src/utils/jwt.ts`

Modifier pour utiliser deux secrets distincts :
```typescript
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
if (!JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is required');

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
}
```

**Fichier** : `backend/src/middleware/auth.ts`

Mettre à jour pour utiliser `verifyAccessToken` (pas `verifyToken` générique) :
```typescript
import { verifyAccessToken } from '../utils/jwt';
// Remplacer verifyToken(token) par verifyAccessToken(token)
```

**Fichier** : `backend/src/controllers/userController.ts` (endpoint refresh)

Mettre à jour l'endpoint `/refresh` pour utiliser `verifyRefreshToken` :
```typescript
import { verifyRefreshToken, generateAccessToken } from '../utils/jwt';
// Dans le handler refresh, utiliser verifyRefreshToken au lieu de verifyToken
```

**Fichier** : `backend/.env.example`

Ajouter :
```env
JWT_REFRESH_SECRET=GENERATE_A_DIFFERENT_KEY_FROM_JWT_SECRET
```

### C5. Sécuriser docker-compose.yml (20 min)

**Fichier** : `docker-compose.yml`

Remplacer tout le contenu par :
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-fleet_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-fleet_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-fleet_db}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - fleet_pgdata:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-fleet_user} -d ${POSTGRES_DB:-fleet_db}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  fleet_pgdata:
```

**Changements** :
- Credentials via variables d'env avec valeurs par défaut dev
- Port restreint à `127.0.0.1` (pas accessible depuis l'extérieur)
- Healthcheck PostgreSQL ajouté

### C6. Avertissement RGPD sur le champ Destination/Motif (10 min)

**Fichier** : `frontend/src/components/ui/ReservationModal.tsx` (vers la ligne 384)

Trouver le champ destination/motif et ajouter un avertissement AVANT l'input :

```tsx
<label htmlFor="reservation-destination">Destination / Motif</label>
<p className="text-red-500 text-xs font-semibold mb-1" role="alert">
  ⚠️ Ne saisissez pas de noms de bénéficiaires/usagers (obligation RGPD)
</p>
<input
  id="reservation-destination"
  placeholder="Ex: SESSAD, Réunion administrative, Visite terrain..."
  // ... reste des props existantes
/>
```

Changer aussi le placeholder actuel s'il dit "Ex: Siège social, RDV Client..." pour quelque chose de plus adapté au contexte médico-social.

### C7. Vérification NODE_ENV (2 min)

**Fichier** : `backend/.env`

Vérifier que la ligne existe :
```env
NODE_ENV=development
```

**Fichier** : `backend/.env.example`

Ajouter un commentaire clair :
```env
# ⚠️ CHANGER EN "production" POUR LE DÉPLOIEMENT
NODE_ENV=development
```

---

## CORRECTIONS HAUTES PRIORITÉ

### H1. Contrôle d'accès pôle dans updateVehicle (30 min)

**Fichier** : `backend/src/controllers/vehicleController.ts` (fonction updateVehicle)

Ajouter la vérification d'accès au pôle AVANT la mise à jour :

```typescript
import { buildVehicleAccessFilter } from '../utils/accessControl';

// Dans updateVehicle, AVANT le prisma.vehicle.update :
const requester = (req as any).user;
const accessFilter = buildVehicleAccessFilter(requester);
const vehicleCheck = await prisma.vehicle.findFirst({
  where: { id: req.params.id, ...accessFilter }
});

if (!vehicleCheck) {
  return res.status(403).json({ error: 'Accès refusé : véhicule hors de votre pôle' });
}
```

Faire la même chose pour `deleteVehicle` si ce n'est pas déjà fait.

### H2. Métadonnées Next.js (5 min)

**Fichier** : `frontend/src/app/layout.tsx`

Remplacer :
```typescript
export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};
```

Par :
```typescript
export const metadata: Metadata = {
  title: "Gestion de Flotte — APAJH Mayotte",
  description: "Application de gestion du parc automobile pour l'APAJH Mayotte",
};
```

### H3. Logo alt text (2 min)

**Fichier** : `frontend/src/app/login/page.tsx` (vers la ligne 142)

Remplacer :
```tsx
<img src="/logo.png" alt="Logo" ... />
```

Par :
```tsx
<img src="/logo.png" alt="Logo APAJH Mayotte" ... />
```

### H4. Supprimer dev.db et l'ajouter au .gitignore (5 min)

**Fichier** : `backend/.gitignore`

Ajouter :
```gitignore
# SQLite dev database (legacy)
dev.db
dev.db-journal
```

Puis supprimer le fichier du tracking git :
```bash
git rm --cached backend/dev.db 2>/dev/null || true
```

### H5. Supprimer les fichiers de test ad hoc (5 min)

**Fichier** : Racine du backend

Supprimer (ou déplacer dans un dossier `scripts/debug/` exclu du build) :
```
backend/test-auth.js
backend/test-auth.ts
backend/test-roles.js
backend/test-roles.ts
backend/test-vehicles-api.js
backend/start-trip.js
backend/check-user.js
backend/reset-pwd.ts
```

Si certains sont utiles pour le dev, les déplacer dans `backend/scripts/debug/` et ajouter ce dossier au `.gitignore`.

### H6. Bloquer réservation sur véhicule en MAINTENANCE (15 min)

**Fichier** : `backend/src/controllers/reservationController.ts` (dans createReservation)

Dans la transaction Prisma de création de réservation, APRÈS la vérification de chevauchement et AVANT la création, ajouter :

```typescript
// Vérifier que le véhicule n'est pas en MAINTENANCE ou BLOCKED
const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
if (!vehicle) {
  throw new Error('VEHICLE_NOT_FOUND');
}
if (vehicle.status === 'MAINTENANCE' || vehicle.status === 'BLOCKED') {
  throw new Error('VEHICLE_UNAVAILABLE');
}
```

Et gérer l'erreur dans le catch :
```typescript
if (error.message === 'VEHICLE_UNAVAILABLE') {
  return res.status(409).json({ error: 'Ce véhicule est actuellement indisponible (maintenance ou bloqué)' });
}
if (error.message === 'VEHICLE_NOT_FOUND') {
  return res.status(404).json({ error: 'Véhicule introuvable' });
}
```

### H7. Index composite sur Reservation pour les conflits (10 min)

**Fichier** : `backend/prisma/schema.prisma`

Dans le modèle Reservation, ajouter :
```prisma
@@index([vehicleId, startTime, endTime])
@@index([startTime])
@@index([endTime])
```

Puis lancer :
```bash
npx prisma migrate dev --name add_reservation_time_indexes
```

### H8. updateReservation — vérifier accès au nouveau véhicule (15 min)

**Fichier** : `backend/src/controllers/reservationController.ts` (dans updateReservation)

Si l'utilisateur change le `vehicleId` dans une mise à jour de réservation, vérifier que le nouveau véhicule est dans son pôle :

```typescript
// Si vehicleId est modifié
if (vehicleId && vehicleId !== existingReservation.vehicleId) {
  const accessFilter = buildVehicleAccessFilter(requester);
  const newVehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, ...accessFilter }
  });
  if (!newVehicle) {
    return res.status(403).json({ error: 'Accès refusé : nouveau véhicule hors de votre pôle' });
  }
  // Vérifier aussi que le nouveau véhicule n'est pas en MAINTENANCE
  if (newVehicle.status === 'MAINTENANCE' || newVehicle.status === 'BLOCKED') {
    return res.status(409).json({ error: 'Ce véhicule est actuellement indisponible' });
  }
}
```

---

## RÉSUMÉ DES FICHIERS

### Suppressions de code (C1-C3)
- `backend/src/app.ts` — supprimer bloc /api/debug/db
- `backend/src/middleware/auth.ts` — supprimer fs.appendFileSync + require('fs')
- `backend/src/utils/accessControl.ts` — supprimer console.debug avec emails
- Vérifier tous les fichiers pour d'autres console.log/debug avec données personnelles

### Modifications (C4-C7, H1-H8)
- `backend/.env` — ajouter JWT_REFRESH_SECRET
- `backend/.env.example` — ajouter JWT_REFRESH_SECRET + commentaire NODE_ENV
- `backend/src/utils/jwt.ts` — séparer secrets access/refresh
- `backend/src/middleware/auth.ts` — utiliser verifyAccessToken
- `backend/src/controllers/userController.ts` — utiliser verifyRefreshToken dans /refresh
- `backend/src/controllers/vehicleController.ts` — contrôle pôle dans updateVehicle
- `backend/src/controllers/reservationController.ts` — bloquer MAINTENANCE + vérifier nouveau véhicule
- `backend/prisma/schema.prisma` — index composite sur Reservation
- `docker-compose.yml` — credentials externalisés + port 127.0.0.1 + healthcheck
- `frontend/src/components/ui/ReservationModal.tsx` — avertissement RGPD
- `frontend/src/app/layout.tsx` — métadonnées title/description
- `frontend/src/app/login/page.tsx` — alt="Logo APAJH Mayotte"

### Suppressions de fichiers (H4-H5)
- `backend/dev.db` — retirer du git
- `backend/test-*.js`, `backend/test-*.ts`, `backend/start-trip.js`, etc. — supprimer ou déplacer

---

## VÉRIFICATIONS POST-CORRECTIONS

1. **`/api/debug/db` supprimé** : `curl http://localhost:4000/api/debug/db` → 404 (pas 200)
2. **Plus de log fichier** : vérifier qu'aucun fichier `debug_auth.log` n'est créé
3. **Plus de console.debug emails** : `grep -rn "console.debug.*email" backend/src/` → aucun résultat
4. **Secrets JWT séparés** : vérifier que l'access token n'est PAS vérifiable avec le refresh secret et vice-versa
5. **Docker** : `docker compose up -d` fonctionne avec les valeurs par défaut
6. **Port PostgreSQL** : `nmap localhost -p 5432` depuis une autre machine → port fermé (127.0.0.1 only)
7. **Avertissement RGPD** : ouvrir la modale de réservation → le message rouge est visible sous le champ destination
8. **updateVehicle** : connecté en MANAGER pôle Enfance, tenter de modifier un véhicule Adulte → 403
9. **Réservation MAINTENANCE** : tenter de réserver un véhicule en MAINTENANCE → 409
10. **Index** : `npx prisma migrate status` → migrations appliquées
11. **Métadonnées** : ouvrir l'app dans le navigateur → l'onglet affiche "Gestion de Flotte — APAJH Mayotte"
12. **dev.db** : `git status` → dev.db n'apparaît pas

## RÈGLES

1. **Suppressions chirurgicales** — supprime UNIQUEMENT les lignes identifiées, ne refactorise pas le code autour
2. **Teste après chaque correction** — vérifie que l'app démarre et fonctionne
3. **Commite après chaque groupe** — un commit pour C1-C3 (debug cleanup), un pour C4 (JWT secrets), un pour C5 (Docker), etc.
4. **Ne touche PAS à l'accessibilité** dans ce prompt — c'est un chantier séparé
5. **Ne touche PAS au workflow métier** (clés, lavage) — c'est un autre chantier
6. **Vérifie qu'il n'y a pas d'autres résidus de debug** — fais un grep global

Lance les corrections maintenant, en commençant par C1-C3 (les 3 suppressions critiques).
