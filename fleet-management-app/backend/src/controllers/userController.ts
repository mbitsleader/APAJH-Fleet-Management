import logger from '../lib/logger';
import crypto from 'crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../services/prisma';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { isLdapEnabled, authenticateWithLdap } from '../services/ldap';
import { ROLE_RANK, canDeleteUser, canResetPassword, type Role } from '../utils/permissions';

const SALT_ROUNDS = 12;

// Dummy hash used to prevent timing attacks when the user is not found
// (forces bcrypt.compare to still run, equalizing response time)
const DUMMY_HASH = '$2b$12$dummyhashfortimingattackpreventionXXXXXXXXXXXXXXXXXXX';
// Min 8 chars, uppercase, lowercase, digit, special char
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une majuscule.';
  if (!/[a-z]/.test(password)) return 'Le mot de passe doit contenir au moins une minuscule.';
  if (!/\d/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre.';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Le mot de passe doit contenir au moins un caractère spécial (!@#$%...).';
  return null;
}

/**
 * Récupérer tous les utilisateurs
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        createdAt: true,
        updatedAt: true,
        userPoles: { select: { poleId: true, pole: { select: { id: true, name: true } } } },
        userServices: { select: { serviceId: true, service: { select: { id: true, name: true } } } },
        // never expose passwordHash
      },
    });
    res.json(users);
  } catch (error) {
    logger.error({ error }, 'Error fetching users:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Login : vérifie l'email et le mot de passe (LDAP en priorité, fallback local)
 */
export const getOrCreateUserByEmail = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });
  if (!password) return res.status(400).json({ error: 'Mot de passe requis.' });

  const isProd = process.env.NODE_ENV === 'production';

  // Génère les cookies JWT et renvoie l'utilisateur (chemin commun LDAP + local)
  const issueSession = async (user: any) => {
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    // Store hashed refresh token in DB for revocation support
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }
    });

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/users/refresh',
    });

    const { passwordHash: _, ...safeUser } = user;
    return res.json(safeUser);
  };

  try {
    // ── Authentification LDAP (si configurée) ──────────────────────────────
    if (isLdapEnabled()) {
      const ldapResult = await authenticateWithLdap(email, password).catch(() => null);

      if (ldapResult) {
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          // Auto-provisioning : premier login LDAP — création avec rôle PROFESSIONNEL
          user = await prisma.user.create({
            data: {
              email: ldapResult.email,
              name: ldapResult.name,
              entraId: ldapResult.dn,
              role: 'PROFESSIONNEL',
              passwordHash: null,
            },
          });
        }

        return await issueSession(user);
      }
      // LDAP a échoué (mauvais mot de passe, utilisateur absent de l'AD, ou AD inaccessible)
      // → on continue vers l'authentification locale ci-dessous
    }

    // ── Authentification locale (fallback / défaut sans LDAP) ───────────────
    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });

    if (!user) {
      // Run dummy compare to prevent timing attacks (email enumeration)
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    // If passwordHash not yet set, deny login (admin must set a password first)
    if (!user.passwordHash) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: 'Aucun mot de passe défini pour ce compte. Contactez un administrateur.' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    return await issueSession(user);
  } catch (error) {
    logger.error({ error }, 'Error login:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Créer un utilisateur (ADMIN / DIRECTEUR only)
 */
export const createUser = async (req: Request, res: Response) => {
  const { email, name, role, department, password, poleIds, serviceIds } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, nom et mot de passe requis.' });
  }

  const pwdError = validatePasswordStrength(password);
  if (pwdError) return res.status(400).json({ error: pwdError });

  const poles: string[] = Array.isArray(poleIds) ? poleIds : [];
  const services: string[] = Array.isArray(serviceIds) ? serviceIds : [];

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        entraId: `local-${crypto.randomUUID()}`,
        email,
        name,
        role: role || 'PROFESSIONNEL',
        department,
        passwordHash,
        userPoles: poles.length > 0 ? { create: poles.map(id => ({ poleId: id })) } : undefined,
        userServices: services.length > 0 ? { create: services.map(id => ({ serviceId: id })) } : undefined,
      },
      select: {
        id: true, email: true, name: true, role: true, department: true, createdAt: true, updatedAt: true,
        userPoles: { select: { poleId: true, pole: { select: { id: true, name: true } } } },
        userServices: { select: { serviceId: true, service: { select: { id: true, name: true } } } },
      },
    });
    res.status(201).json(user);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    }
    logger.error({ error }, 'Error creating user:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Mettre à jour les pôles/services d'un utilisateur
 */
export const updateUserAssignments = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { poleIds, serviceIds } = req.body;

  const poles: string[] = Array.isArray(poleIds) ? poleIds : [];
  const services: string[] = Array.isArray(serviceIds) ? serviceIds : [];

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    // Replace poles
    await prisma.userPole.deleteMany({ where: { userId: id } });
    if (poles.length > 0) {
      await prisma.userPole.createMany({ data: poles.map(poleId => ({ userId: id, poleId })), skipDuplicates: true });
    }

    // Replace services
    await prisma.userService.deleteMany({ where: { userId: id } });
    if (services.length > 0) {
      await prisma.userService.createMany({ data: services.map(serviceId => ({ userId: id, serviceId })), skipDuplicates: true });
    }

    const updated = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, role: true, department: true, createdAt: true, updatedAt: true,
        userPoles: { select: { poleId: true, pole: { select: { id: true, name: true } } } },
        userServices: { select: { serviceId: true, service: { select: { id: true, name: true } } } },
      },
    });
    res.json(updated);
  } catch (error) {
    logger.error({ error }, 'Error updating user assignments:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Modifier le mot de passe d'un utilisateur.
 * - un utilisateur peut modifier son propre mot de passe avec son mot de passe actuel
 * - seul ADMIN / DIRECTEUR peut reinitialiser le mot de passe d'un autre utilisateur
 */
export const updateUserPassword = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { password, currentPassword } = req.body;
  const requester = (req as any).user;

  if (!password) return res.status(400).json({ error: 'Nouveau mot de passe requis.' });

  const pwdError = validatePasswordStrength(password);
  if (pwdError) return res.status(400).json({ error: pwdError });

  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    // Self-change : exiger le mot de passe actuel
    if (id === requester.id) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Mot de passe actuel requis pour modifier votre propre mot de passe.' });
      }
      if (!target.passwordHash) {
        return res.status(400).json({ error: 'Aucun mot de passe défini sur ce compte.' });
      }
      const isCurrentValid = await bcrypt.compare(currentPassword, target.passwordHash);
      if (!isCurrentValid) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
      }
    }

    // A user cannot change the password of someone with equal or higher rank (unless it's their own)
    if (id !== requester.id) {
      if (!canResetPassword(requester.role)) {
        return res.status(403).json({ error: 'Seuls les administrateurs et directeurs peuvent réinitialiser le mot de passe d\'un autre utilisateur.' });
      }
      const requesterRank = ROLE_RANK[requester.role as Role] ?? 0;
      const targetRank = ROLE_RANK[target.role as Role] ?? 0;
      if (targetRank >= requesterRank) {
        return res.status(403).json({ error: 'Vous ne pouvez pas modifier le mot de passe d\'un utilisateur de rang égal ou supérieur.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    res.json({ message: 'Mot de passe mis à jour avec succès.' });
  } catch (error) {
    logger.error({ error }, 'Error updating password:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Supprimer un utilisateur
 */
export const deleteUser = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const requester = (req as any).user;
  try {
    // Prevent self-deletion
    if (requester.id === id) {
      return res.status(403).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'ADMIN') return res.status(403).json({ error: 'Cannot delete primary admin' });

    if (!canDeleteUser(requester.role)) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    const requesterRank = ROLE_RANK[requester.role as Role] ?? 0;
    const targetRank = ROLE_RANK[user.role as Role] ?? 0;
    if (targetRank >= requesterRank) {
      return res.status(403).json({ error: 'Vous ne pouvez pas supprimer un utilisateur de rang égal ou supérieur.' });
    }

    await prisma.user.update({ 
      where: { id }, 
      data: { deletedAt: new Date() } 
    });
    res.status(204).send();
  } catch (error) {
    logger.error({ error }, 'Error soft deleting user:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Exporter toutes les données d'un utilisateur (Droit à la portabilité - RGPD)
 */
export const exportUserData = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const data = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        reservations: true,
        passengerOn: { include: { reservation: true } },
        tripLogs: true,
        fuelLogs: true,
        incidents: true,
        cleaningAssignments: { include: { schedule: true } },
        userPoles: { include: { pole: true } },
        userServices: { include: { service: true } },
      },
    });

    if (!data) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const { passwordHash: _, ...safeData } = data as any;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=export-donnees-${userId}.json`);
    res.json(safeData);
  } catch (error) {
    logger.error({ error }, 'Error exporting user data:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Endpoint '/me' pour vérifier la session du frontend
 */
export const getMe = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Non authentifié' });
  res.json(user);
};

/**
 * Rafraîchir l'access token avec le refresh token en cookie (rotation des tokens)
 */
export const refreshTokenEndpoint = async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: 'Refresh token manquant' });

  try {
    const payload = verifyRefreshToken(token);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // 1. Check if token exists in DB (revocation support)
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!storedToken || storedToken.user.deletedAt) {
      res.clearCookie('refresh_token', { path: '/api/users/refresh' });
      return res.status(401).json({ error: 'Session révoquée ou utilisateur supprimé' });
    }

    // 2. Token rotation: Delete old token and issue new one
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const accessToken = generateAccessToken({ userId: payload.userId, role: payload.role });
    const newRefreshToken = generateRefreshToken({ userId: payload.userId, role: payload.role });
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    await prisma.refreshToken.create({
      data: {
        userId: payload.userId,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }
    });
    
    // 3. Update cookies
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/users/refresh',
    });
    
    res.json({ message: 'Session rafraîchie' });
  } catch (err) {
    res.status(401).json({ error: 'Refresh token invalide ou expiré' });
  }
};

/**
 * Logout : efface les cookies et révoque le token en base
 */
export const logoutUser = async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token;
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.refreshToken.delete({ where: { tokenHash } }).catch(() => {});
  }
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/users/refresh' });
  res.json({ message: 'Déconnecté avec succès' });
};
