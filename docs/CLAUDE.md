# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gestion de Parc Auto** — A B2B PWA for the APAJH Federation to manage vehicle fleet reservations, trips, fuel logs, and incident reporting. It replaces paper-based processes for transportation professionals across multiple organizational "poles" (Adulte/Enfance divisions).

## Development Commands

### Backend (`fleet-management-app/backend/`)
```bash
npm run dev          # Development with hot reload (nodemon + ts-node)
npm run build        # Compile TypeScript to dist/
node dist/app.js     # Run compiled production server
```

### Frontend (`fleet-management-app/frontend/`)
```bash
npm run dev          # Next.js dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint
```

### Database
```bash
# Start PostgreSQL (Docker)
cd fleet-management-app && docker-compose up -d
docker start fleet_postgres   # If container already exists

# Schema management (uses db push, not migrations)
cd backend && npx prisma db push
npx ts-node prisma/seed.ts    # Seed test data

# Load test scripts
npx ts-node src/scripts/seed-test-data.ts   # 10 users + 20 vehicles
npx ts-node src/scripts/sim-sequential.ts   # 1000 sequential ops
npx ts-node src/scripts/sim-concurrent.ts   # 20 concurrent users
```

### Ports
- Backend API: `http://localhost:4000`
- Frontend: `http://localhost:3000`
- PostgreSQL: `localhost:5432` (Docker container `fleet_postgres`, volume `fleet_pgdata`)

## Architecture

### Stack
- **Frontend**: Next.js 16.1.6 (App Router) + React 19.2.3 + TailwindCSS 4 + TypeScript
- **Backend**: Express.js + TypeScript → compiled to `dist/`
- **Database**: PostgreSQL 16 (Docker) via Prisma ORM
- **Auth**: JWT (8h access, 7d refresh) stored in HttpOnly cookies

### Request Flow
```
Frontend (apiFetch.ts)
  → cookies: { access_token, refresh_token }
  → Backend Express (port 4000)
      → authenticate middleware (JWT verify → req.user)
      → requireRole middleware (RBAC check)
      → Controller (business logic)
      → Prisma ORM (PostgreSQL)
```

### Role Hierarchy
`ADMIN > DIRECTEUR > MANAGER > PROFESSIONNEL`

### Multi-Pole Data Isolation
Users belong to one or more "poles" (Adulte, Enfance). Vehicles belong to services which belong to poles. The `buildVehicleAccessFilter()` utility in backend controllers enforces that users only access their pole's data. User IDs are always taken from `req.user` (never from request body) to prevent IDOR.

### Frontend Auth State
`AuthContext.tsx` manages authentication state globally. `apiFetch.ts` is the centralized HTTP client — it automatically redirects to `/login` on 401. All protected pages check auth state and redirect accordingly.

### Key Backend Files
- `src/app.ts` — Express entry point, middleware chain, route registration
- `src/middleware/auth.ts` — `authenticate` + `requireRole` middlewares
- `src/services/prisma.ts` — Prisma client singleton
- `src/utils/jwt.ts` — Token generation/verification
- `prisma/schema.prisma` — 12-model data schema with indexes

### Key Frontend Files
- `src/app/page.tsx` — Main dashboard (vehicle cards grouped by pole)
- `src/app/admin/` — Admin-only pages (vehicles, users, cleaning, incidents, history)
- `src/components/ui/` — 11 reusable components (modals, cards, skeleton loaders)
- `src/lib/apiFetch.ts` — All API calls go through here
- `src/context/AuthContext.tsx` — Auth state provider

## Data Model Key Points

- **Vehicle statuses**: `AVAILABLE`, `IN_USE`, `MAINTENANCE`, `BLOCKED`
- **Complex operations** (start/end trip, reservations) use Prisma transactions to prevent race conditions
- **Schema changes**: Use `npx prisma db push` (no migration files tracked)
- **Indexes**: Defined on all FK columns for query performance

## Security Constraints

- Never take `userId` from request body — always from `req.user` (set by JWT middleware)
- Rate limits: login endpoint 10 req/15min, global 200 req/15min (in-memory, resets on restart)
- CORS is restricted to `localhost:3000`
- Production cookies require `Secure` flag (set via `NODE_ENV=production`)
- Helmet.js headers are applied globally in `app.ts`

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin.test@apajh.re | Admin@1234! |
| DIRECTEUR | directeur.test@apajh.re | Directeur@1234! |
| MANAGER (Adulte) | manager.adulte@apajh.re | Manager@1234! |
| MANAGER (Enfance) | manager.enfance@apajh.re | Manager@1234! |

## Known Limitations

- Rate limiter is in-memory (state lost on server restart)
- Microsoft Entra ID SSO field exists in schema but is not integrated
- No structured logging (uses `console.log`)
- `prisma db push` is used instead of tracked migration files
