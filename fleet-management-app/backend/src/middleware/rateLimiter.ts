import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
  message: { error: 'Trop de tentatives de connexion pour ce compte. Réessayez dans 15 minutes.' },
  // Utilise l'email comme clé au lieu de l'IP pour ne pas bloquer tout un pôle (NAT)
  keyGenerator: (req) => {
    return (req.body.email || req.ip || req.socket.remoteAddress || 'unknown').toLowerCase();
  },
  skip: (req) => {
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip.includes('::ffff:127.0.0.1') || ip === 'localhost';
  }
});
