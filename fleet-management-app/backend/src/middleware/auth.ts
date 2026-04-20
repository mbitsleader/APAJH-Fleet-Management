import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import prisma from '../services/prisma';
import { hasPermission, type Permission, type Role } from '../utils/permissions';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Récupérer le token depuis le cookie httpOnly
    const token = req.cookies?.access_token;
    
    if (!token) {
      return res.status(401).json({ error: 'Non authentifié. Token manquant.' });
    }

    // 2. Vérifier la signature JWT
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expirée' });
      }
      return res.status(401).json({ error: 'Token invalide' });
    }

    // 3. Charger l'utilisateur depuis la BDD
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        deletedAt: true,
        userPoles: { select: { poleId: true, pole: { select: { id: true, name: true } } } },
        userServices: { select: { serviceId: true, service: { select: { id: true, name: true } } } },
      },
    });

    if (!user || user.deletedAt) {
      return res.status(401).json({ error: 'Utilisateur introuvable ou compte supprimé' });
    }

    // 4. Peupler req.user
    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Erreur d\'authentification interne' });
  }
}

/**
 * Middleware de contrôle de rôle.
 * Usage: requireRole(['ADMIN', 'DIRECTEUR'])
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({
        error: `Accès refusé. Rôle requis : ${roles.join(', ')}.`,
      });
    }
    next();
  };
};

export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!hasPermission(user?.role as Role | undefined, permission)) {
      return res.status(403).json({
        error: `Accès refusé. Permission requise : ${permission}.`,
      });
    }
    next();
  };
};
