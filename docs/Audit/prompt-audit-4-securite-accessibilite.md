# AUDIT COMPLET 4 — Sécurité + Accessibilité — À copier-coller dans Claude Code

---

Tu es un auditeur technique senior spécialisé en sécurité applicative (OWASP 2025), accessibilité (WCAG 2.1 AA / RGAA 4.1) et bonnes pratiques de développement. Tu vas effectuer un audit complet de ce projet avec une DOUBLE PRIORITÉ : sécurité et accessibilité.

**IMPORTANT** : Cet audit ne doit pas seulement lister les problèmes — il doit fournir les CORRECTIONS CONCRÈTES (code exact à modifier) pour chaque finding. Chaque recommandation doit inclure le fichier, la ligne, le code actuel problématique, et le code corrigé.

## CONTEXTE DU PROJET

- **Application** : Gestion de flotte automobile pour l'APAJH Mayotte (Association Pour Adultes et Jeunes Handicapés)
- **Stack** : Next.js 16 + React 19 + Tailwind CSS 4 (frontend) / Express.js + TypeScript + Prisma 7.5 + PostgreSQL 16 (backend)
- **Auth** : JWT en cookie httpOnly (récemment migré depuis X-User-Id) + bcrypt 12 rounds
- **Multi-pôle** : Pôle Enfance + Pôle Adulte avec cloisonnement via buildVehicleAccessFilter()
- **Rôles** : ADMIN, DIRECTEUR, MANAGER, PROFESSIONNEL
- **Utilisateur critique** : Ahmed, agent aveugle (éducateur technique), doit pouvoir réserver un véhicule EN TOUTE AUTONOMIE avec un lecteur d'écran
- **Statut** : App presque terminée, en test local, 3 audits déjà réalisés (scores 52, 54/100)

## PROBLÈMES CONNUS DES AUDITS PRÉCÉDENTS (vérifier s'ils sont corrigés)

### Audit 2 — Failles critiques identifiées
- [ ] `/api/debug/db` exposait toutes les données sans auth → DEVRAIT être supprimé
- [ ] Log fichier Windows (fs.appendFileSync) dans auth.ts → DEVRAIT être supprimé
- [ ] console.debug avec emails dans accessControl.ts → DEVRAIT être supprimé
- [ ] Même secret JWT pour access et refresh tokens → DEVRAIT être séparé
- [ ] Photos d'incidents stockées en base64 dans PostgreSQL → Toujours présent ?

### Audit 3 — Nouvelles failles identifiées
- [ ] Pages admin chargent des données AVANT vérification des droits → fetch avant redirection
- [ ] MANAGER peut supprimer des comptes et réinitialiser des mots de passe → trop permissif
- [ ] Dates converties via toISOString().split('T')[0] → décalage UTC/local
- [ ] Mojibake (encodage cassé) dans les textes français
- [ ] node_modules, dist, dev.db dans le dépôt

## TA MISSION

Scanne l'INTÉGRALITÉ du projet (chaque fichier backend et frontend) et produis un fichier `AUDIT_COMPLET_4.md` à la racine du projet avec les corrections concrètes.

---

## ÉTAPES D'ANALYSE

### PARTIE A — SÉCURITÉ (priorité 1)

#### A1. Vérification des corrections précédentes

Vérifie si les findings des audits 2 et 3 ont été corrigés. Pour chaque point :
- Cherche dans le code si le problème existe toujours
- Si corrigé → marquer ✅ avec la preuve (fichier + ligne)
- Si PAS corrigé → marquer ❌ et fournir le code correctif complet

#### A2. Gardes d'accès pages admin (Finding Audit 3 #1)

Inspecte CHAQUE page dans `frontend/src/app/admin/` :

```
admin/page.tsx
admin/incidents/page.tsx
admin/vehicles/page.tsx
admin/cleaning/page.tsx
admin/users/page.tsx
admin/settings/page.tsx
admin/history/page.tsx
```

Pour chaque page, vérifie :
1. Y a-t-il un guard qui empêche le rendu si le rôle n'est pas autorisé ?
2. Les appels API (fetch/useEffect) sont-ils exécutés AVANT ou APRÈS la vérification du rôle ?
3. Si `authLoading` est true, l'UI affiche-t-elle un état de chargement (pas de données sensibles) ?

**Pattern correct à vérifier/imposer :**
```tsx
const { user, loading } = useAuth();

// 1. Pendant le chargement → rien
if (loading) return <LoadingSpinner />;

// 2. Si pas connecté ou rôle insuffisant → redirection immédiate
if (!user || !['ADMIN', 'DIRECTEUR'].includes(user.role)) {
  router.replace('/');
  return null; // CRUCIAL — ne rien rendre
}

// 3. Seulement ICI on peut faire les fetch
useEffect(() => {
  // fetch données admin...
}, [user]); // Dépend de user, pas exécuté tant que user est null
```

**Code correctif à fournir** : si une page ne suit pas ce pattern, fournir le code exact corrigé.

**Recommandation structurelle** : proposer un composant HOC ou un hook `useAdminGuard(allowedRoles)` qui encapsule cette logique pour toutes les pages admin :

```tsx
// hooks/useAdminGuard.ts
export function useAdminGuard(allowedRoles: string[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isAuthorized = !loading && user && allowedRoles.includes(user.role);
  
  useEffect(() => {
    if (!loading && (!user || !allowedRoles.includes(user.role))) {
      router.replace('/');
    }
  }, [user, loading]);
  
  return { user, loading, isAuthorized };
}
```

#### A3. Actions sensibles trop permissives (Finding Audit 3 #2)

Inspecte `frontend/src/app/admin/users/page.tsx` et les endpoints backend associés :

1. **Réinitialisation de mot de passe** : quels rôles peuvent le faire ?
   - Vérifier côté frontend (bouton visible pour quels rôles ?)
   - Vérifier côté backend (`userController.ts` → endpoint PATCH password)
   - Recommandation : ADMIN et DIRECTEUR uniquement (pas MANAGER, sauf sur les PROFESSIONNEL de son pôle)

2. **Suppression de comptes** : quels rôles peuvent le faire ?
   - Vérifier côté frontend (bouton visible ?)
   - Vérifier côté backend (endpoint DELETE user)
   - Recommandation : ADMIN uniquement

3. **Création de comptes** : quels rôles peuvent le faire ?
   - Recommandation : ADMIN et DIRECTEUR

**Pour chaque action, fournir :**
- Le code frontend actuel (bouton/condition de rendu)
- Le code backend actuel (middleware de rôle)
- Le code corrigé (frontend + backend alignés)

**Proposer une matrice de permissions :**

```
| Action                    | ADMIN | DIRECTEUR | MANAGER | PROFESSIONNEL |
|---------------------------|-------|-----------|---------|---------------|
| Voir /admin               |  ✅   |    ✅     |   ✅    |      ❌       |
| Créer un utilisateur      |  ✅   |    ✅     |   ❌    |      ❌       |
| Supprimer un utilisateur  |  ✅   |    ❌     |   ❌    |      ❌       |
| Réinitialiser mdp         |  ✅   |    ✅     |  ⚠️(*)  |      ❌       |
| Modifier un véhicule      |  ✅   |    ✅     |   ✅    |      ❌       |
| Supprimer un véhicule     |  ✅   |    ✅     |   ❌    |      ❌       |
| Gérer planning lavage     |  ✅   |    ✅     |   ✅    |      ❌       |
| Forcer fin de trajet      |  ✅   |    ✅     |   ✅    |      ❌       |
```
(*) MANAGER peut réinitialiser uniquement les PROFESSIONNEL de son pôle

#### A4. Gestion des dates UTC/locale (Finding Audit 3 #3)

Cherche TOUTES les occurrences de `toISOString().split('T')[0]` dans le frontend :

```bash
grep -rn "toISOString.*split" frontend/src/
```

Pour chaque occurrence :
1. Montrer le code actuel
2. Expliquer le bug (décalage UTC → jour précédent si après minuit UTC)
3. Fournir le code corrigé avec un helper centralisé :

```typescript
// lib/dateUtils.ts
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toLocalTimeString(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
```

#### A5. Fetch privilégiés avant vérification (Finding Audit 3 #4)

Cherche les patterns où un `useEffect` avec un fetch API est exécuté sans vérifier le rôle :

```bash
grep -rn "useEffect" frontend/src/app/admin/ | head -30
```

Pour chaque cas, vérifier que le fetch est conditionné par le rôle :
```tsx
// ❌ MAUVAIS — fetch avant vérification
useEffect(() => {
  fetch('/api/admin/data');
}, []);

// ✅ BON — fetch conditionné
useEffect(() => {
  if (user && ['ADMIN', 'DIRECTEUR'].includes(user.role)) {
    fetch('/api/admin/data');
  }
}, [user]);
```

#### A6. Audit sécurité complémentaire

- **Endpoints sans protection de rôle** : lister TOUTES les routes Express et vérifier que chacune a le bon middleware (`authenticate`, `requireRole`)
- **CORS** : vérifier la config CORS (origin, credentials)
- **Rate limiting** : vérifier la config sur login et endpoints sensibles
- **Validation des entrées** : vérifier que TOUS les endpoints POST/PATCH valident les données (longueurs, types, enums)
- **npm audit** : exécuter `cd backend && npm audit` et `cd frontend && npm audit`, rapporter les résultats

---

### PARTIE B — ACCESSIBILITÉ (priorité 2)

**Rappel critique** : Ahmed est aveugle. Il utilise un lecteur d'écran (VoiceOver/TalkBack/NVDA). S'il ne peut pas réserver un véhicule de manière autonome, l'app échoue dans son objectif.

#### B1. Audit par composant

Pour CHAQUE composant et page listée ci-dessous, scanne le code source et vérifie les points suivants. Donne un score sur 100% et liste les violations exactes avec le code correctif.

**Composants à auditer :**

```
frontend/src/app/login/page.tsx
frontend/src/app/page.tsx (Dashboard)
frontend/src/app/calendar/page.tsx
frontend/src/app/nettoyage/page.tsx
frontend/src/app/search/page.tsx
frontend/src/app/settings/page.tsx
frontend/src/app/admin/page.tsx
frontend/src/app/admin/vehicles/page.tsx
frontend/src/app/admin/users/page.tsx
frontend/src/app/admin/cleaning/page.tsx
frontend/src/app/admin/incidents/page.tsx
frontend/src/app/admin/settings/page.tsx
frontend/src/app/admin/history/page.tsx
frontend/src/components/ui/Sidebar.tsx
frontend/src/components/ui/VehicleCard.tsx
frontend/src/components/ui/ReservationModal.tsx
frontend/src/components/ui/TripModal.tsx
frontend/src/components/ui/IncidentModal.tsx
frontend/src/components/ui/FuelModal.tsx
frontend/src/components/ui/ConfirmModal.tsx
frontend/src/components/ui/VehicleDetailModal.tsx
frontend/src/app/layout.tsx
```

#### B2. Points de vérification par composant

Pour chaque composant, vérifie et corrige :

**Structure :**
- [ ] Un `<h1>` unique par page (peut être `sr-only` si visuellement absent)
- [ ] Hiérarchie des headings cohérente (h1 → h2 → h3, pas de saut)
- [ ] Éléments sémantiques utilisés (`<nav>`, `<main>`, `<section>`, `<header>`, pas de `<div>` partout)

**Formulaires :**
- [ ] Chaque `<input>` / `<select>` / `<textarea>` a un `<label>` avec `htmlFor` correspondant à l'`id` de l'input
- [ ] `aria-invalid="true"` sur les champs en erreur
- [ ] Messages d'erreur liés via `aria-describedby`
- [ ] Messages de succès annoncés via `role="alert"` ou `aria-live="polite"`

**Boutons et liens :**
- [ ] Chaque bouton a un texte accessible (texte visible OU `aria-label`)
- [ ] Les boutons avec icône uniquement ont un `aria-label` descriptif
- [ ] Les icônes décoratives ont `aria-hidden="true"`
- [ ] Aucun `<div onClick>` ou `<span onClick>` — utiliser `<button>` natif
- [ ] Si un `<div>` interactif est inévitable : `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter + Space)

**Modales :**
- [ ] `role="dialog"` et `aria-modal="true"`
- [ ] `aria-labelledby` pointe vers le titre de la modale
- [ ] Focus trap : Tab/Shift+Tab restent dans la modale
- [ ] Escape ferme la modale
- [ ] À l'ouverture, le focus va sur le premier élément interactif
- [ ] À la fermeture, le focus retourne à l'élément qui a ouvert la modale

**Navigation :**
- [ ] Skip links ("Aller au contenu principal") en premier élément du DOM
- [ ] `<main id="main-content" tabIndex={-1}>` sur le contenu principal
- [ ] Changements de page annoncés (RouteAnnouncer avec `aria-live="assertive"`)

**Calendrier (CRITIQUE pour Ahmed) :**
- [ ] `role="grid"` sur le conteneur
- [ ] `role="row"` sur chaque ligne
- [ ] `role="columnheader"` sur les en-têtes de colonnes
- [ ] `role="gridcell"` sur chaque cellule
- [ ] Navigation clavier : ArrowUp/Down/Left/Right entre les cellules
- [ ] `tabIndex` roving : seule la cellule focusée a tabIndex=0, les autres -1
- [ ] Enter/Space ouvre la modale de réservation
- [ ] Chaque cellule a un `aria-label` descriptif ("Lundi 24 mars, Peugeot 208, disponible")
- [ ] Les boutons de navigation semaine (chevrons) ont un `aria-label`
- [ ] Le changement de semaine est annoncé via `aria-live`

**Dashboard — VehicleCard :**
- [ ] La carte est focusable au clavier (`role="button"`, `tabIndex={0}`, `onKeyDown`)
- [ ] Les boutons d'action dans la carte ont des `aria-label` descriptifs
- [ ] Les états (disponible, en maintenance, réservé) sont communiqués (`aria-label` ou `role="status"`)
- [ ] Les boutons toggle (accompagnants) ont `aria-pressed`

**Contrastes :**
- [ ] Tous les textes respectent le ratio WCAG AA (4.5:1 pour texte normal, 3:1 pour grand texte)
- [ ] Vérifier spécifiquement : `text-muted-foreground`, couleur accent `#F18E38`, textes `text-white/40`

#### B3. Score d'accessibilité global

Après l'audit, donner un score par composant sur cette échelle :
- 🔴 0-20% — Inutilisable au lecteur d'écran
- 🟠 21-50% — Très difficilement utilisable
- 🟡 51-70% — Partiellement accessible
- 🟢 71-90% — Largement accessible
- ✅ 91-100% — Pleinement accessible WCAG AA

Et un score global pondéré (le calendrier et ReservationModal comptent double car ce sont les parcours critiques pour Ahmed).

---

### PARTIE C — QUALITÉ ET ROBUSTESSE

#### C1. Encodage / Mojibake (Finding Audit 3 #6)

Cherche les textes français avec des caractères cassés :
```bash
grep -rn "Ã©\|Ã¨\|Ã\|Ã´\|Ã®\|Ã§\|â€\|Ã¢" frontend/src/ backend/src/
```

Pour chaque occurrence, fournir le texte corrigé.

#### C2. Fichiers à nettoyer (Finding Audit 3 #7)

Vérifier si les éléments suivants sont dans le dépôt Git (et pas dans .gitignore) :
```bash
git ls-files | grep -E "node_modules|\.next|dist/|dev\.db|test-.*\.(js|ts)$"
```

Fournir le .gitignore corrigé si nécessaire.

#### C3. TypeScript — Usage de `any`

```bash
grep -rn ": any\|as any" frontend/src/ | wc -l
grep -rn ": any\|as any" backend/src/ | wc -l
```

Lister les 10 cas les plus critiques (dans les controllers et les composants principaux) et proposer des types corrects.

#### C4. Error Boundaries React

Vérifier si des Error Boundaries existent. Si non, proposer un composant ErrorBoundary générique et indiquer où l'intégrer.

---

## FORMAT DE SORTIE

Produis le fichier `AUDIT_COMPLET_4.md` avec cette structure :

```markdown
# 🔍 AUDIT COMPLET 4 — Sécurité + Accessibilité
**Date** : [date du jour]
**Auditeur** : Claude Code
**Priorités** : Sécurité (P1) + Accessibilité (P2)

## 📊 Résumé exécutif
- Score sécurité : X/100
- Score accessibilité : X/100
- Score global : X/100
- Corrections des audits précédents : X/Y appliquées
- Nouveaux findings : X

## ✅ Vérification des corrections précédentes
[Pour chaque finding des audits 2 et 3 : ✅ Corrigé / ❌ Toujours présent + code correctif]

## 🔒 A. Sécurité
### A1. Gardes d'accès pages admin
[Pour chaque page admin : état actuel + code corrigé]

### A2. Actions sensibles
[Matrice de permissions + code correctif frontend + backend]

### A3. Gestion des dates
[Chaque occurrence + helper centralisé + code corrigé]

### A4. Fetch avant vérification
[Chaque cas + code corrigé]

### A5. Audit complémentaire
[Routes sans protection, npm audit, validation entrées]

## ♿ B. Accessibilité
### B1. Score par composant
[Tableau avec score et violations principales]

### B2. Corrections par composant
[Pour chaque composant : code actuel → code corrigé]

### B3. Parcours Ahmed
[Test du parcours complet : login → dashboard → calendrier → réservation → confirmation]

## 🛠️ C. Qualité
[Encodage, nettoyage, TypeScript, Error Boundaries]

## 🚨 Plan d'action priorisé

### Immédiat (< 1 jour)
[Actions de 5-15 min avec code exact]

### Semaine 1
[Corrections sécurité]

### Semaine 2
[Corrections accessibilité]

### Semaine 3
[Qualité et robustesse]

## 📋 Checklist pré-production
- [ ] ...
```

## RÈGLES

1. **Code exact pour chaque correction** — pas de recommandations vagues. Pour chaque finding, montre le code AVANT et APRÈS avec le fichier et la ligne.
2. **Vérifie si les anciens findings sont corrigés** — ne re-signale pas ce qui a déjà été fixé.
3. **Priorité absolue : le parcours d'Ahmed** — teste mentalement le flux login → dashboard → calendrier → réservation avec un lecteur d'écran. Chaque étape doit être possible au clavier seul.
4. **Sois brutal** — pas de complaisance, chaque faille compte.
5. **Propose un hook useAdminGuard** — solution structurelle pour les gardes admin, pas des corrections ad-hoc page par page.
6. **Propose un helper dateUtils** — solution centralisée pour les dates, pas des corrections dispersées.
7. **Exécute npm audit** dans les deux dossiers et inclus les résultats.
8. **Cherche les résidus de debug** : grep pour console.log/debug/warn avec données personnelles, fs.appendFileSync, chemins Windows hardcodés.
9. **Vérifie le docker-compose.yml** — credentials externalisés ? Port 127.0.0.1 ? Healthcheck ?
10. **Compte les `any` TypeScript** et signale les plus dangereux.

Lance l'audit maintenant. Scanne tout le projet sans exception.
