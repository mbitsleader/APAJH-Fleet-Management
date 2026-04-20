# AUDIT COMPLET 5 — Gestion de Parc Auto (APAJH)

**Date** : 27 mars 2026
**Auditeur** : Claude Code (analyse statique — 4 passes parallèles)
**Périmètre** : `fleet-management-app/` (frontend + backend + docker + schéma BDD)
**Référentiels** : OWASP Top 10 2025 · WCAG 2.1 AA · RGAA 4.1 · RGPD

---

## 1. Résumé Exécutif

### Scores

| Axe | Note | Commentaire |
|-----|-----:|-------------|
| Sécurité applicative | **72/100** | Base saine, quelques réglages critiques restants |
| Contrôle d'accès | **80/100** | RBAC complet, multi-pôle appliqué partout |
| RGPD / gouvernance données | **28/100** | Politique absente, soft delete manquant, droits non implémentés |
| Accessibilité (WCAG 2.1 AA) | **43/100** | Bloquant pour Ahmed — modales sans focus trap, calendrier souris-only |
| UX / Ergonomie | **69/100** | Solide sur desktop, fragilités mobiles importantes |
| Qualité de code | **55/100** | 0% de tests, 100 occurrences `any`, logique dans les contrôleurs |
| Infrastructure | **70/100** | Docker correct, défauts de configuration production |
| **Score global** | **60/100** | **Non prêt pour la production** |

### Bilan des corrections des audits précédents — 8/8 appliquées

| Correction | Statut |
|------------|--------|
| Suppression `/api/debug/db` | ✅ |
| Suppression `fs.appendFileSync` dans auth.ts | ✅ |
| Suppression `console.debug` avec emails | ✅ |
| JWT secrets access/refresh séparés | ✅ |
| Guards admin (`useAuthorizedAdminLoader`) sur toutes les pages admin | ✅ |
| MANAGER ne peut plus supprimer de comptes | ✅ |
| Dates `toISOString().split('T')[0]` corrigées (`formatLocalDate()`) | ✅ |
| Avertissement RGPD champ destination/motif dans ReservationModal | ✅ |

### 4 bloquants absolus avant mise en production

1. **Mot de passe DB `admin123`** dans `.env` et docker-compose.yml
2. **Accessibilité** : Ahmed ne peut pas utiliser le calendrier ni les modales au clavier
3. **Politique de confidentialité RGPD absente** — obligatoire en contexte médico-social
4. **0 test automatisé** — les transactions critiques ne sont pas couvertes

---

## 2. Sécurité (OWASP Top 10 : 2025)

### A01 — Broken Access Control

| Point | Verdict | Détail |
|-------|---------|--------|
| RBAC côté serveur | ✅ | `requirePermission()` sur toutes les routes sensibles |
| Isolation multi-pôle | ✅ | `buildVehicleAccessFilter()` systématiquement appliqué |
| `userId` depuis JWT (jamais depuis le body) | ✅ | `req.user.id` partout dans les contrôleurs |
| `deleteCleaningSchedule` sans autorisation | ❌ | **Faille** — tout utilisateur authentifié peut supprimer n'importe quel planning |

**F-SEC-01 — HAUTE** — `deleteCleaningSchedule` sans contrôle d'accès
Fichier : `backend/src/controllers/cleaningController.ts` lignes 241–249

```typescript
// ❌ Actuel — aucune vérification
export const deleteCleaningSchedule = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.cleaningSchedule.delete({ where: { id } });
};

// ✅ Corrigé
export const deleteCleaningSchedule = async (req: Request, res: Response) => {
  const { id } = req.params;
  const requester = (req as any).user;
  if (!['ADMIN', 'DIRECTEUR', 'MANAGER'].includes(requester.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const schedule = await prisma.cleaningSchedule.findFirst({
    where: { id, vehicle: buildVehicleAccessFilter(requester) }
  });
  if (!schedule) return res.status(403).json({ error: 'Planning hors de votre pôle' });
  await prisma.cleaningSchedule.delete({ where: { id } });
  res.json({ message: 'Planning supprimé' });
};
```

**F-SEC-02 — MOYENNE** — `userId` envoyé dans le body depuis le frontend
Fichier : `frontend/src/components/ui/ReservationModal.tsx` lignes 146 et 169
Le backend l'ignore (lit depuis `req.user.id`), mais favorise les régressions IDOR.
**Correction** : supprimer `userId` du body côté frontend.

---

### A02 — Security Misconfiguration

**F-SEC-03 — CRITIQUE** — Mot de passe PostgreSQL `admin123` dans `.env` et docker-compose
```
# backend/.env
DATABASE_URL="postgresql://fleet_user:admin123@..."

# docker-compose.yml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-admin123}  ← valeur par défaut dangereuse
```
**Correction** :
```yaml
# ✅ Force la définition explicite — pas de valeur par défaut
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD doit être définie}
```

**F-SEC-04 — HAUTE** — Rate limiter global à 2000 req/15min (doit être 200)
Fichier : `backend/src/app.ts` ligne 56
```typescript
max: 2000,   // ❌ — le commentaire au-dessus dit "200 req / 15 min" mais la valeur est 2000
max: 200,    // ✅
```
De même, `loginLimiter` dans `rateLimiter.ts` est à `max: 100` au lieu de 10.

**F-SEC-05 — HAUTE** — TLS LDAP désactivé (`rejectUnauthorized: false`)
Fichier : `backend/src/services/ldap.ts` ligne 28
```typescript
// ❌ Vulnérable Man-in-the-Middle sur le réseau interne
tlsOptions: { rejectUnauthorized: false },
// ✅ Production
tlsOptions: { rejectUnauthorized: true, ca: fs.readFileSync('ldap-ca.crt') },
```

**F-SEC-06 — MOYENNE** — CSP Helmet non configurée
Fichier : `backend/src/app.ts` ligne 25 — `helmet()` sans configuration personnalisée.
```typescript
// ✅ Remplacer par
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'http://localhost:4000'],
      imgSrc: ["'self'", 'data:', 'https:'],
    }
  }
}));
```

**F-SEC-07 — MOYENNE** — `imageUrl` accepte n'importe quelle chaîne (risque XSS)
Fichier : `backend/src/controllers/vehicleController.ts` lignes 30–55
```typescript
// ✅ Valider le format avant stockage
if (imageUrl && !/^https?:\/\//.test(imageUrl) && !/^data:image\//.test(imageUrl)) {
  return res.status(400).json({ error: 'Format imageUrl invalide' });
}
```

**F-SEC-08 — BASSE** — Header `X-User-Id` dans les CORS `allowedHeaders` inutile
Fichier : `backend/src/app.ts` ligne 36 — supprimer `'X-User-Id'` des `allowedHeaders`.

---

### A04 — Cryptographic Failures

| Point | Verdict |
|-------|---------|
| Bcrypt (12 rounds) | ✅ |
| Anti-timing attack sur le login (dummy hash) | ✅ |
| Deux secrets JWT distincts access/refresh | ✅ |
| Cookies HttpOnly | ✅ |

---

### A06 — Insecure Design

**F-SEC-09 — HAUTE** — Refresh token non révocable côté serveur
Fichier : `backend/src/controllers/userController.ts` lignes 356–360
Le logout efface les cookies côté client mais n'invalide pas le token en base. Token volé = 7 jours de validité.

**Solution** :
```prisma
model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  user      User      @relation(...)
  @@index([userId])
}
```

**F-SEC-10 — HAUTE** — Refresh endpoint ne vérifie pas l'existence de l'utilisateur en base
Fichier : `backend/src/controllers/userController.ts` lignes 330–351
Un compte supprimé peut rafraîchir ses tokens pendant 7 jours.
**Correction** : ajouter `prisma.user.findUnique({ where: { id: decoded.userId } })` et retourner 401 si absent.

---

### A09 — Security Logging

**F-SEC-11 — MOYENNE** — Aucun logging structuré, pas d'audit trail
Tous les fichiers backend utilisent `console.log`/`console.error` sans timestamp ni requestId.
**Solution** : intégrer `pino` ou `winston`. Logger au minimum : connexion réussie/échouée (IP), suppression de compte, force-end de trajet, incidents CRITIQUES.

---

### Mojibake dans les messages d'erreur de sécurité

**F-SEC-12 — BASSE** — 4 chaînes UTF-8 corrompues

| Fichier | Ligne | Corrompu | Correct |
|---------|-------|----------|---------|
| `backend/src/middleware/auth.ts` | 73 | `AccÃ¨s refusÃ©…` | `Accès refusé…` |
| `backend/src/controllers/userController.ts` | 262 | `rÃ©initialiser` | `réinitialiser` |
| `backend/src/controllers/userController.ts` | 298 | `AccÃ¨s refusÃ©.` | `Accès refusé.` |
| `backend/src/controllers/userController.ts` | 304 | `rang Ã©gal ou supÃ©rieur` | `rang égal ou supérieur` |

---

## 3. Conformité RGPD

> **Contexte critique** : l'APAJH travaille avec des publics vulnérables (enfants, adultes en situation de handicap). Niveau d'exigence maximal.

### Données personnelles collectées

| Modèle | Données | Sensibilité |
|--------|---------|-------------|
| `User` | email, nom, département, rôle | Personnelles |
| `TripLog` | userId, km, heures, destination, notes | Déplacements — SENSIBLE |
| `Reservation` | userId, destination | Déplacements |
| `Incident` | userId, description, photoUrl | TRÈS SENSIBLE |
| `FuelLog` | userId | Comportement professionnel |

### État de conformité

**F-RGPD-01 — HAUTE** — Politique de confidentialité absente
Aucune page `/politique-confidentialite` ni mentions légales. Obligatoire (Article 13 RGPD).
**Contenu minimum** : responsable du traitement, base légale, données collectées, durée de conservation, droits des personnes, contact DPO.

**F-RGPD-02 — HAUTE** — Soft delete absent — violation potentielle Article 17
Aucun champ `deletedAt` sur `User`, `Vehicle`, `Reservation`, `TripLog`, `Incident`.
Les suppressions sont des hard deletes. Une demande de suppression est bloquée si des trajets sont liés (erreur Prisma P2003).
**Correction** : ajouter `deletedAt DateTime?` sur `User` et `Vehicle` au minimum.

**F-RGPD-03 — HAUTE** — Durées de conservation non définies
Données conservées indéfiniment. Aucun job de purge.

| Table | Durée recommandée |
|-------|------------------|
| TripLog | 3 ans |
| FuelLog | 5 ans |
| Reservation | 1 an après clôture |
| Incident | 5–10 ans selon gravité |

**F-RGPD-04 — HAUTE** — Droits des personnes partiellement implémentés

| Droit RGPD | Statut |
|------------|--------|
| Accès (Art. 15) | ⚠️ `/api/users/me` — pas d'export complet |
| Rectification (Art. 16) | ⚠️ Changement de mot de passe uniquement |
| Suppression (Art. 17) | ❌ Absent self-service |
| Portabilité (Art. 20) | ❌ Absent |

**F-RGPD-05 — MOYENNE** — Avertissement RGPD absent dans `TripModal.tsx`
L'avertissement est présent dans `ReservationModal.tsx` (✅) mais le champ `notes` de fin de trajet est aussi un champ libre à risque.

---

## 4. Base de Données

### Analyse du schéma

| Modèle | Index | Unicité | Soft Delete | Commentaire |
|--------|-------|---------|-------------|-------------|
| User | ✅ | email ✅, entraId ✅ | ❌ | — |
| Vehicle | ✅ | plateNumber ✅ | ❌ | — |
| Reservation | ✅ composite | — | ❌ | 5 index dont composite vehicleId+startTime+endTime |
| CleaningSchedule | ✅ | vehicleId+weekStart ✅ | — | — |
| TripLog | ✅ | — | ❌ | — |
| Incident | ✅ | — | — | — |
| **MaintenanceAlert** | **❌** | — | — | **Aucun index sur vehicleId** |

**F-DB-01 — BASSE** — Index manquant sur `MaintenanceAlert.vehicleId`
Fichier : `backend/prisma/schema.prisma` — ajouter `@@index([vehicleId])`.

**F-DB-02 — MOYENNE** — `entraId` généré avec `Date.now()` — risque de collision
Fichier : `backend/src/controllers/userController.ts` ligne 160
```typescript
entraId: `local-${Date.now()}`,        // ❌ Collision possible
entraId: `local-${crypto.randomUUID()}`, // ✅
```

### Fonctionnalités du schéma

| Fonctionnalité | Statut |
|----------------|--------|
| Table passagers/accompagnants (`ReservationPassenger`) | ✅ |
| Distinction conducteur / passager | ✅ |
| Module lavage (`CleaningSchedule` + `CleaningAssignment`) | ✅ |
| Soft delete | ❌ |
| `ApprovalStatus` sur Reservation | ⚠️ Défini mais jamais utilisé — **fonctionnalité fantôme** |
| Carte de lavage physique | ❌ Absent du schéma |

---

## 5. Architecture et Qualité de Code

### TypeScript — `any`

| Périmètre | Occurrences |
|-----------|-------------|
| `backend/src/` | 67 |
| `frontend/src/` | 33 |
| **Total** | **100** |

> `strict: true` est activé dans les deux `tsconfig.json`. Ces 100 `as any` sont des contournements **volontaires**.

**Top 5 cas dangereux** :

| Fichier | Pattern | Impact |
|---------|---------|--------|
| `backend/src/middleware/auth.ts` | `(req as any).user` | **CRITIQUE** — req.user non typé partout |
| `backend/src/utils/accessControl.ts` | `buildVehicleAccessFilter(user: any)` | **CRITIQUE** — cœur du cloisonnement multi-pôle |
| `backend/src/controllers/userController.ts` | `issueSession(user: any)` | HAUTE — génération des cookies JWT |
| `backend/src/services/prisma.ts` | `pool as any, adapter as any` | HAUTE — incompatibilité API masquée |
| `backend/src/controllers/tripController.ts` | 5× `(req as any).user` | HAUTE — contrôleur le plus critique |

**Solution systémique** — un seul fichier élimine 67 occurrences backend :
```typescript
// backend/src/types/express.d.ts
import { AuthenticatedUser } from '../middleware/auth';
declare global {
  namespace Express {
    interface Request { user?: AuthenticatedUser; }
  }
}
```

### Error Boundaries React

**F-QUAL-01 — HAUTE** — Aucun Error Boundary dans le frontend
Un crash JavaScript fait tomber toute l'interface sans message utilisateur.
```typescript
// frontend/src/app/error.tsx (Next.js App Router)
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-xl font-semibold">Une erreur est survenue</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="btn-primary">Réessayer</button>
    </div>
  );
}
```

### Tests

**F-QUAL-02 — HAUTE** — 0% de couverture de tests
Aucun fichier `*.test.ts` dans `backend/src/` ni `frontend/src/`.
**Priorités** : auth · createReservation (race conditions) · startTrip/endTrip (transactions) · deleteUser (RBAC)

### Fichiers indésirables

| Fichier | Risque | Action |
|---------|--------|--------|
| `backend/dev.db` | Données de dev | `git ls-files backend/dev.db` — retirer si tracké |
| `backend/check-user.js`, `check-users-db.ts` | — | Supprimer ou `scripts/admin/` |
| `backend/create-admin.ts`, `reset-pwd.ts` | **Sensible** | Déplacer hors du build |
| `backend/dist/` | Build accidentel | Ajouter `dist/` au `.gitignore` backend |

**F-QUAL-03 — CRITIQUE** — Credentials admin hardcodés dans un script compilé
Fichier : `backend/src/scripts/sim-sequential.ts` ligne 42
```typescript
// ❌ Compilé dans dist/ — visible en production
{ email: 'admin.test@apajh.re', password: 'Admin@1234!' }
// ✅
{ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }
```

### Versions des packages

| Package | Version | Problème |
|---------|---------|---------|
| `express` | `~4.16.1` | Express 5.x stable depuis oct 2024 |
| `morgan` | `~1.9.1` | Non utilisé dans `app.ts` — dépendance morte |
| `next` | `16.1.6` | **Version non standard** — pas dans les releases officielles |
| `@types/jsonwebtoken` | dans `dependencies` | Doit être en `devDependencies` |

---

## 6. Docker et Infrastructure

| Point | Statut |
|-------|--------|
| Port PostgreSQL restreint à `127.0.0.1` | ✅ |
| Healthcheck PostgreSQL | ✅ |
| Volume de persistance nommé | ✅ |
| Image `postgres:16-alpine` | ✅ |
| Restart policy `unless-stopped` | ✅ |
| Credentials externalisés | ⚠️ Valeurs par défaut `admin123` |
| Réseau Docker isolé | ❌ Absent |

**F-INFRA-01 — HAUTE** — Valeurs par défaut `admin123` dans docker-compose
```yaml
# ❌ Actuel — admin123 si variable non définie
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-admin123}
# ✅ Force la définition explicite
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD doit être définie}
```

**F-INFRA-02 — BASSE** — Pas de réseau Docker isolé
Ajouter un réseau `fleet_net` pour isoler PostgreSQL des autres conteneurs éventuels.

---

## 7. UI/UX

### Scores

| Axe | Score |
|-----|------:|
| Ergonomie | 68/100 |
| Design visuel | 76/100 |
| Parcours utilisateur | 62/100 |
| **Global UX** | **69/100** |

### Problèmes critiques

**F-UX-01 — CRITIQUE** — Bouton "Ajouter un véhicule" mort dans `admin/page.tsx` lignes 113–115
Ni `onClick` ni navigation. Clic sans effet.

**F-UX-02 — CRITIQUE** — Alertes maintenance hardcodées ("Peugeot 208", "Clio V")
Données statiques dans le JSX d'`admin/page.tsx`. Apparaissent pour **tous les admins, quelle que soit la flotte réelle**.
**Correction** : supprimer ces lignes immédiatement.

**F-UX-03 — CRITIQUE** — Calendrier inutilisable sur smartphone Android
`frontend/src/app/calendar/page.tsx` : `min-w-[1000px]` + `onMouseDown`/`onMouseEnter` uniquement. Les agents Android ne peuvent pas créer de réservation.

**F-UX-04 — HAUTE** — Login affiche "Secured by Microsoft Entra ID Architecture"
L'intégration SSO Entra ID n'est pas active. Cette mention est fausse.

### Contrastes

| Couleur | Contexte | Ratio | WCAG AA |
|---------|----------|-------|---------|
| Orange `#F18E38` sur blanc | Boutons primaires | 2.97:1 | ❌ Échec |
| `text-muted-foreground` sur glassmorphism | Labels | ~4.3:1 | ⚠️ Borderline |

**Icônes de statut — daltonisme** : `MAINTENANCE` et `BLOCKED` utilisent la même icône `AlertCircle`.
**Correction** : `MAINTENANCE` → icône `Wrench`, `BLOCKED` → icône `Lock`.

### 25 Quick wins (≈ 14h de dev)

| # | Fichier | Action |
|---|---------|--------|
| QW01 | `app/layout.tsx` | Skip-to-content `#main-content` |
| QW02 | `Sidebar.tsx` | Labels 9px → 11px + corriger "Véhicules", "Paramètres" |
| QW03 | `Sidebar.tsx` | `ConfirmModal` avant logout |
| QW04 | `app/page.tsx` | Barre de compteurs Disponibles/En cours/Maintenance |
| QW05 | `app/page.tsx` | Gestion d'erreur réseau + bouton Réessayer |
| QW06 | `admin/page.tsx` | Supprimer alertes maintenance hardcodées |
| QW07 | `admin/page.tsx` | Brancher bouton "Ajouter un véhicule" |
| QW08 | `admin/page.tsx` | Remplacer `confirm()` natif par `ConfirmModal` |
| QW09 | `admin/page.tsx` | Traduire statuts incidents `OPEN`→`Ouvert` |
| QW10 | `login/page.tsx` | Supprimer mention "Secured by Microsoft Entra ID" |
| QW11 | `login/page.tsx` | Toggle show/hide password |
| QW12 | `login/page.tsx` | Enrichir message d'erreur avec contact de secours |
| QW13 | `admin/users/page.tsx` | Remplacer `alert()` par message inline |
| QW14 | `admin/vehicles/page.tsx` | Remplacer `alert()` + fallback image logo → VehiclePlaceholder |
| QW15 | `admin/vehicles/page.tsx` | `STATUS_LABELS` dans les selects |
| QW16 | `VehicleCard.tsx` | MAINTENANCE → `Wrench`, BLOCKED → `Lock` |
| QW17 | `VehicleCard.tsx` | `prefers-reduced-motion` sur `animate-pulse` |
| QW18 | `ReservationModal.tsx` | Pré-remplir dates/heures avec aujourd'hui + heure courante |
| QW19 | `ReservationModal.tsx` | Style avertissement RGPD amber au lieu de rouge |
| QW20 | `calendar/page.tsx` | Textes événements 8px → 11px |
| QW21 | `calendar/page.tsx` | "Initialisation calendrier sécurisé…" → "Chargement…" |
| QW22 | `calendar/page.tsx` | Grille 6h–18h → 5h–19h |
| QW23 | `VehicleDetailModal.tsx` | Blocs colorés au lieu de text-[7px] dans la mini-grille |
| QW24 | `VehicleDetailModal.tsx` | `toLocaleTimeString()` cohérent pour les heures |
| QW25 | `nettoyage/page.tsx` | `aria-label` sur boutons navigation semaine |

---

## 8. Accessibilité (WCAG 2.1 AA / RGAA 4.1)

> **Score global : 43/100 — Non conforme**
> Ahmed (agent aveugle) ne peut pas effectuer le parcours de réservation de manière autonome.

### Scores par composant

| Composant | Score | Niveau |
|-----------|------:|--------|
| `login/page.tsx` | 82% | 🟢 Largement accessible |
| `VehicleCard.tsx` | 68% | 🟡 Partiel |
| `Sidebar.tsx` | 65% | 🟡 Partiel |
| `TripModal.tsx` | 52% | 🟠 Difficile |
| `ConfirmModal.tsx` | 58% | 🟠 Difficile |
| `nettoyage/page.tsx` | 50% | 🟠 Difficile |
| `layout.tsx` | 55% | 🟠 Difficile |
| `app/page.tsx` (Dashboard) | 55% | 🟠 Difficile |
| `admin/page.tsx` | 45% | 🟠 Difficile |
| `ReservationModal.tsx` | 38% | 🔴 Inutilisable |
| `VehicleDetailModal.tsx` | 35% | 🔴 Inutilisable |
| `admin/users/page.tsx` | 30% | 🔴 Inutilisable |
| `admin/vehicles/page.tsx` | 28% | 🔴 Inutilisable |
| **`calendar/page.tsx`** | **22%** | 🔴 **Inutilisable** |

### Les 5 bloquants absolus pour Ahmed

**F-A11Y-01 — CRITIQUE** — Focus trap absent dans toutes les modales
Fichiers : `ReservationModal.tsx`, `TripModal.tsx`, `ConfirmModal.tsx`, `VehicleDetailModal.tsx`, modales dans `admin/vehicles/page.tsx`, `admin/users/page.tsx`

**Solution — hook réutilisable** :
```typescript
// frontend/src/hooks/useFocusTrap.ts
export function useFocusTrap(ref: RefObject<HTMLElement>, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen || !ref.current) return;
    const focusables = ref.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusables[0]?.focus();
    const handleTab = (e: KeyboardEvent) => {
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);
}
```

**F-A11Y-02 — CRITIQUE** — Touche `Escape` non gérée dans aucune modale
```tsx
// Dans chaque modale
useEffect(() => {
  const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) resetAndClose(); };
  document.addEventListener('keydown', onEscape);
  return () => document.removeEventListener('keydown', onEscape);
}, [isOpen]);
```

**F-A11Y-03 — CRITIQUE** — Retour du focus absent à la fermeture des modales
```tsx
const triggerRef = useRef<HTMLElement | null>(null);
// À l'ouverture : triggerRef.current = document.activeElement as HTMLElement;
// À la fermeture : triggerRef.current?.focus();
```

**F-A11Y-04 — CRITIQUE** — Calendrier entièrement souris-only
Fichier : `frontend/src/app/calendar/page.tsx` lignes 298–595
`onMouseDown`/`onMouseEnter` sans équivalent clavier.
**Solution pragmatique** : ajouter un bouton "Nouvelle réservation" avec `aria-label` qui ouvre `ReservationModal` directement.

**F-A11Y-05 — CRITIQUE** — Labels sans `htmlFor` dans les formulaires critiques
Fichiers : `ReservationModal.tsx`, `admin/vehicles/page.tsx`, `admin/users/page.tsx`
```tsx
// ❌ Actuel
<label>Début de mission</label>
<input type="date" ... />

// ✅ Corrigé
<label htmlFor="startDate">Début de mission</label>
<input id="startDate" type="date" aria-describedby="startDate-error" ... />
```

### Autres findings importants

| ID | Fichier | Problème | Sévérité |
|----|---------|----------|---------|
| A02 | `Sidebar.tsx:64` | `role="menubar"` incorrect sur `<nav>` — retirer | Majeur |
| A06 | `app/page.tsx:169` | Éléments `pointer-events-none` dans l'ordre de tab sans label explicatif | Majeur |
| A13 | `ReservationModal.tsx:255` | Zone d'erreur sans `role="alert"` ni `aria-live` | Majeur |
| A20 | `calendar/page.tsx:243` | Boutons Précédente/Suivante semaine sans `aria-label` | Critique |
| A21 | `calendar/page.tsx:243` | Bouton filtre sans `aria-expanded` ni `aria-haspopup` | Majeur |
| A38 | `layout.tsx` | Pas de skip link "Aller au contenu principal" | Critique |

### Points positifs accessibilité

- `login/page.tsx` : `aria-live`, `htmlFor`, `focus-visible`, icônes masquées — meilleur fichier du projet
- `VehicleCard.tsx` : `role="button"`, `tabIndex={0}`, `onKeyDown`, `aria-label` dynamiques
- `TripModal.tsx` : `aria-describedby` sur l'input kilométrage
- Toutes les modales ont `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- `lang="fr"` sur `<html>`

---

## 9. Workflow Métier

### Cycle de réservation

| Étape | Statut | Détail |
|-------|--------|--------|
| Réservation avec anti-conflit serveur | ✅ | Transaction Prisma atomique |
| Blocage véhicule MAINTENANCE/BLOCKED | ✅ | Double vérification backend |
| Remise physique des clés | ❌ | Absent — confondu avec le démarrage de trajet |
| Départ km (carnet de bord) | ✅ | `TripModal` + `POST /api/trips/start` |
| Retour km | ✅ | Validation km retour ≥ km départ côté serveur |
| Lieu de départ physique | ⚠️ | Champ dans le modèle, jamais saisi dans TripModal |
| Notes sur le trajet | ⚠️ | Uniquement à la fin, pas au départ |
| Rendu physique des clés | ❌ | Absent |
| Détection de retard de retour | ❌ | Aucune alerte |
| Prolongation de réservation | ⚠️ | Possible via PUT, sans logique spécifique |
| Historique des trajets | ✅ | `admin/history/page.tsx` |

### Workflow de lavage

| Fonctionnalité | Statut | Détail |
|----------------|--------|--------|
| Planning de lavage (chef/directeur) | ✅ | `POST /api/cleaning/schedule` |
| Assignation de professionnels | ✅ | CleaningAssignment |
| Historique des lavages | ⚠️ | Planning courant visible, pas d'historique multi-semaines |
| Carte de lavage physique | ❌ | Absent du schéma et de l'UI |
| Vue intégrée lavage + réservation | ⚠️ | Deux vues séparées — risque de conflit |

### Fonctionnalités manquantes à développer

| Priorité | Fonctionnalité | Effort |
|----------|----------------|--------|
| 1 | Workflow remise/rendu de clés | Moyen |
| 2 | Rôle "secrétaire" distinct (MANAGER trop large) | Moyen |
| 3 | Détection retard de retour + alerte | Moyen |
| 4 | Carte de lavage physique | Moyen |
| 5 | `ApprovalStatus` — implémenter ou supprimer (fantôme) | Variable |
| 6 | Export RGPD données personnelles | Faible |
| 7 | Historique lavages multi-semaines | Faible |

---

## 10. Plan d'Action Priorisé

### Immédiat — avant tout déploiement (< 1 jour)

| # | Action | Fichier | Temps |
|---|--------|---------|-------|
| 1 | Changer mot de passe DB `admin123` | `.env`, `docker-compose.yml` | 5 min |
| 2 | Rate limiter global `2000` → `200` | `app.ts:56` | 2 min |
| 3 | loginLimiter `100` → `10` req/15min | `rateLimiter.ts` | 2 min |
| 4 | Supprimer alertes maintenance hardcodées | `admin/page.tsx` | 5 min |
| 5 | Supprimer "Secured by Microsoft Entra ID" | `login/page.tsx` | 2 min |
| 6 | Brancher le bouton mort "Ajouter un véhicule" | `admin/page.tsx:113` | 10 min |
| 7 | Corriger les 4 chaînes mojibake | `auth.ts:73`, `userController.ts:262,298,304` | 10 min |
| 8 | Supprimer credentials hardcodés dans `sim-sequential.ts` | `scripts/sim-sequential.ts:42` | 10 min |
| 9 | Vérifier si `dev.db` est tracké git | `git ls-files backend/dev.db` | 5 min |
| 10 | Ajouter `dist/` au `.gitignore` backend | `backend/.gitignore` | 2 min |

### Semaine 1 — Sécurité

| # | Action | Fichier | Temps |
|---|--------|---------|-------|
| 1 | Contrôle d'autorisation dans `deleteCleaningSchedule` | `cleaningController.ts:241` | 30 min |
| 2 | Corriger TLS LDAP | `ldap.ts:28` | 30 min |
| 3 | Configurer CSP Helmet | `app.ts:25` | 1h |
| 4 | Valider format `imageUrl` (regex HTTPS) | `vehicleController.ts` | 30 min |
| 5 | `entraId` avec `crypto.randomUUID()` | `userController.ts:160` | 10 min |
| 6 | Supprimer `userId` du body ReservationModal | `ReservationModal.tsx:146,169` | 15 min |
| 7 | Corriger valeurs par défaut docker-compose | `docker-compose.yml` | 15 min |
| 8 | Index `MaintenanceAlert.vehicleId` | `schema.prisma` | 10 min |
| 9 | Supprimer `X-User-Id` des CORS allowedHeaders | `app.ts:36` | 5 min |
| 10 | Refresh endpoint : vérifier existence user en base | `userController.ts:330` | 2h |

### Semaine 2 — Accessibilité (bloquant pour Ahmed)

| # | Action | Temps |
|---|--------|-------|
| 1 | Hook `useFocusTrap` + Escape + returnFocus | 1 jour |
| 2 | Migrer toutes les modales | 1 jour |
| 3 | Skip link dans `layout.tsx` | 30 min |
| 4 | Corriger tous les `htmlFor`/`id` manquants | 2h |
| 5 | `aria-label` sur boutons icône-only | 1h |
| 6 | Bouton "Nouvelle réservation" accessible dans le calendrier | 2h |
| 7 | `aria-live` sur zones d'erreur | 1h |

### Semaine 3 — RGPD et qualité

| # | Action | Temps |
|---|--------|-------|
| 1 | Page `/politique-confidentialite` | 1 jour |
| 2 | Soft delete (`deletedAt`) sur `User` et `Vehicle` | 1 jour |
| 3 | Durées de conservation + job de purge | 2h |
| 4 | `GET /api/users/me/export` (portabilité RGPD) | 1 jour |
| 5 | Déclarer `Request.user` dans `.d.ts` (élimine 67 `as any`) | 2h |
| 6 | Error Boundary global dans `app/error.tsx` | 1h |
| 7 | Logger structuré (pino) + audit trail | 1 jour |
| 8 | Avertissement RGPD dans `TripModal.tsx` (champ notes) | 30 min |

### Mois 1 — Améliorations structurelles

| # | Action | Effort |
|---|--------|--------|
| 1 | Vue calendrier mobile (Agenda responsive) | 4–5 jours |
| 2 | Système toast global (remplacer tous les `alert()`/`confirm()`) | 2–3 jours |
| 3 | Clic primaire VehicleCard → ReservationModal directement | 2 jours |
| 4 | Workflow remise/rendu de clés | 2 jours |
| 5 | Détection retard de retour + affichage admin | 2 jours |
| 6 | Refresh automatique dans `apiFetch.ts` | 1 jour |
| 7 | Tests unitaires/intégration (auth, createReservation, startTrip) | 3 jours |

### Vision V2

| Fonctionnalité | Impact | Complexité |
|----------------|--------|-----------|
| PWA offline-first (Service Worker) | Réseau instable Mayotte | Haute |
| Scan QR Code pour identifier un véhicule | Terrain | Moyenne |
| KPI et exports directeur | Gouvernance | Moyenne |
| Notifications push (rappel 30min avant réservation) | Fiabilité opérationnelle | Haute |
| Historique personnel du PROFESSIONNEL | Transparence | Faible |
| Carte de lavage physique | Métier demandé | Moyenne |
| Rôle secrétaire distinct | Granularité accès | Moyenne |

---

## 11. Points Positifs

- Architecture de sécurité saine : JWT HttpOnly, RBAC via `permissions.ts`, `buildVehicleAccessFilter()` systématique
- Anti-timing attack sur le login (dummy hash bcrypt si utilisateur introuvable)
- Transactions Prisma pour toutes les opérations critiques
- Détection de chevauchement de réservation côté serveur dans une transaction atomique
- **Corrections audits 2 et 3 : 8/8 appliquées** — l'équipe répond efficacement aux retours
- Table `ReservationPassenger` en place — distinction conducteur/passager correcte
- Module lavage complet (`CleaningSchedule` + `CleaningAssignment`)
- Échappement LDAP des caractères spéciaux dans les filtres
- Infrastructure Docker : port `127.0.0.1`, healthcheck, volume nommé
- Base d'accessibilité solide : `lang="fr"`, `role="dialog"` sur les modales, `tabIndex`/`onKeyDown` sur `VehicleCard`, page login bien implémentée

---

## 12. Checklist Pré-Production

### Sécurité
- [ ] Mot de passe PostgreSQL changé (plus `admin123`)
- [ ] Rate limiter global corrigé (200 req/15min)
- [ ] Rate limiter login corrigé (10 req/15min)
- [ ] TLS LDAP `rejectUnauthorized: true` en production
- [ ] CSP Helmet configurée
- [ ] Validation format `imageUrl`
- [ ] `deleteCleaningSchedule` avec contrôle d'accès
- [ ] Refresh token révocable côté serveur
- [ ] Credentials hardcodés supprimés de `sim-sequential.ts`
- [ ] Valeurs par défaut docker-compose supprimées
- [ ] `.env` jamais commité git (`git log --all -- backend/.env`)
- [ ] `dev.db` non tracké git
- [ ] `dist/` dans `.gitignore` backend

### RGPD
- [ ] Politique de confidentialité publiée
- [ ] Soft delete implémenté sur User et Vehicle
- [ ] Durées de conservation documentées et automatisées
- [ ] Export données personnelles (`/api/users/me/export`)
- [ ] Avertissement RGPD dans TripModal (champ notes)

### Accessibilité (Ahmed)
- [ ] Skip link "Aller au contenu principal" dans `layout.tsx`
- [ ] Focus trap dans toutes les modales
- [ ] Touche Escape ferme toutes les modales
- [ ] Retour du focus à l'élément déclencheur à la fermeture
- [ ] Tous les labels avec `htmlFor` et inputs avec `id`
- [ ] Bouton accessible pour créer une réservation sans passer par le calendrier
- [ ] Boutons icône-only avec `aria-label`
- [ ] Zones d'erreur avec `aria-live`

### Qualité
- [ ] Alertes maintenance hardcodées supprimées
- [ ] Mention "Secured by Microsoft Entra ID" supprimée
- [ ] Bouton "Ajouter un véhicule" fonctionnel
- [ ] `confirm()`/`alert()` natifs remplacés par `ConfirmModal`
- [ ] Chaînes mojibake corrigées (4 occurrences)
- [ ] Error Boundary global ajouté
- [ ] Tests unitaires des endpoints critiques
- [ ] Logging structuré avec audit trail
- [ ] Version Next.js vérifiée (16.1.6 non standard)

### Métier
- [ ] Statuts incidents traduits en français
- [ ] Icônes MAINTENANCE/BLOCKED différenciées (Wrench/Lock)
- [ ] Dates/heures pré-remplies dans ReservationModal
- [ ] `ApprovalStatus` : décision prise (implémenter ou supprimer)
- [ ] Calendrier utilisable sur Android (vue Agenda ou bouton alternatif)

---

*Audit réalisé le 27 mars 2026 — 4 passes parallèles : Sécurité/RGPD/BDD · Accessibilité/Workflow · UI/UX · Qualité de code*
