import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import prisma from './services/prisma';
import vehicleRoutes from './routes/vehicles';
import reservationRoutes from './routes/reservations';
import tripRoutes from './routes/trips';
import incidentRoutes from './routes/incidents';
import fuelRoutes from './routes/fuel';
import userRoutes from './routes/users';
import poleRoutes from './routes/poles';
import serviceRoutes from './routes/services';
import cleaningRoutes from './routes/cleaning';
import notificationRoutes from './routes/notifications';
import exportRoutes from './routes/exportRoutes';
import { authenticate } from './middleware/auth';
import logger from './lib/logger';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

console.log('--- STARTUP DIAGNOSTICS ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20), '...');
console.log('---------------------------');

// Security headers — strict CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline for Next.js in some dev modes
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"], // Allow external images via explicit protocols
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "http://localhost:4000", "http://127.0.0.1:4000", ...((process.env.ALLOWED_ORIGINS || '').split(','))],
      upgradeInsecureRequests: [],
    },
  },
}));

// CORS — restricted to the frontend origin only
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',');
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Removed deprecated X-User-Id
}));

app.use(cookieParser());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url, ip: req.ip }, 'Incoming request');
  next();
});

// Body size limit — prevent 100MB payloads
app.use(express.json({ limit: '6mb' }));

// Block path traversal attacks (check originalUrl before Express normalization)
app.use((req: Request, res: Response, next: NextFunction) => {
  const raw = req.originalUrl || '';
  if (raw.includes('..') || raw.includes('%2e%2e') || raw.includes('%2E%2E')) {
    return res.status(400).json({ error: 'Requête invalide.' });
  }
  next();
});

// Global rate limiter — NAT/VPN Friendly
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Augmenté pour être plus flexible en environnement pro
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
  message: { error: 'Trop de requêtes pour votre session. Réessayez dans 15 minutes.' },
  // Identifie l'utilisateur par son ID unique (JWT) s'il est connecté, sinon par IP
  keyGenerator: (req) => {
    // Tente de récupérer le userId depuis le cookie sans valider (juste pour la clé)
    const token = req.cookies?.access_token;
    if (token) {
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (payload.userId) return `user_${payload.userId}`;
      } catch (e) { /* ignore */ }
    }
    // Fallback sur l'IP (NAT friendly: localhost skip déjà géré via skip)
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  skip: (req) => {
    // Skip rate limiting for localhost during local simulation/dev
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip.includes('::ffff:127.0.0.1') || ip === 'localhost';
  }
});
app.use(globalLimiter);


// Basic healthcheck route
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    logger.error({ error }, 'Healthcheck database connection failed');
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// All routes below require authentication via X-User-Id header
// (except /api/users/login which is handled inside userRoutes before authenticate)
app.use('/api/vehicles', authenticate, vehicleRoutes);
app.use('/api/reservations', authenticate, reservationRoutes);
app.use('/api/trips', authenticate, tripRoutes);
app.use('/api/incidents', authenticate, incidentRoutes);
app.use('/api/fuel', authenticate, fuelRoutes);
app.use('/api/users', userRoutes); // login endpoint is public; others use authenticate inside
app.use('/api/poles', authenticate, poleRoutes);
app.use('/api/services', authenticate, serviceRoutes);
app.use('/api/cleaning', authenticate, cleaningRoutes);
app.use('/api/notifications', authenticate, notificationRoutes);
app.use('/api/exports', exportRoutes);

// Global error handler — never expose stack traces to clients
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // JSON parse errors from body-parser
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corps de la requête invalide (JSON malformé).' });
  }
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  res.status(err.status || 500).json({ error: 'Une erreur interne est survenue.' });
});

export default app;
