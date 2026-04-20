import logger from '../lib/logger';
import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { buildVehicleAccessFilter } from '../utils/accessControl';
import { canDeclareCriticalIncident } from '../utils/permissions';

/**
 * Créer un nouvel incident
 */
const VALID_SEVERITIES = ['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'];
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB base64

export const createIncident = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  const { vehicleId, description, severity, photoUrl } = req.body;
  const userId = requester.id; // Always use authenticated user — prevents IDOR

  if (!vehicleId || !description) {
    return res.status(400).json({ error: 'vehicleId et description sont obligatoires.' });
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return res.status(400).json({ error: `Description limitée à ${MAX_DESCRIPTION_LENGTH} caractères.` });
  }
  if (severity && !VALID_SEVERITIES.includes(severity)) {
    return res.status(400).json({ error: `Sévérité invalide. Valeurs : ${VALID_SEVERITIES.join(', ')}` });
  }
  if (photoUrl && Buffer.byteLength(photoUrl, 'utf8') > MAX_PHOTO_SIZE_BYTES) {
    return res.status(400).json({ error: 'La photo dépasse la limite de 5 Mo.' });
  }

  try {
    const accessFilter = buildVehicleAccessFilter(requester);

    // Vérifier l'accès au véhicule
    const allowedVehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ...accessFilter }
    });
    if (!allowedVehicle) {
      return res.status(403).json({ error: 'Accès non autorisé pour ce véhicule.' });
    }

    // Pour les incidents CRITIQUES, vérifier que l'utilisateur a le rôle requis
    if (severity === 'CRITICAL') {
      const reporter = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (!reporter || !canDeclareCriticalIncident(reporter.role)) {
        return res.status(403).json({ error: 'Seuls les ADMIN, DIRECTEUR et MANAGER peuvent déclarer un incident CRITIQUE.' });
      }
    }

    const incident = await prisma.incident.create({
      data: {
        vehicleId,
        userId,
        description,
        severity: severity || 'MINOR',
        status: 'OPEN',
        ...(photoUrl && { photoUrl }),
      },
    });

    if (severity === 'CRITICAL') {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { status: 'BLOCKED' },
      });
    }

    res.status(201).json(incident);
  } catch (error) {
    logger.error({ error }, 'Erreur lors de la création de l\'incident:');
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

/**
 * Récupérer les incidents d'un véhicule
 */
export const getVehicleIncidents = async (req: Request, res: Response) => {
  const { vehicleId } = req.params;
  const requester = (req as any).user;
  try {
    const accessFilter = buildVehicleAccessFilter(requester);
    const allowed = await prisma.vehicle.findFirst({ where: { id: vehicleId as string, ...accessFilter } });
    if (!allowed) return res.status(403).json({ error: 'Accès non autorisé.' });

    const incidents = await prisma.incident.findMany({
      where: { vehicleId: vehicleId as string },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(incidents);
  } catch (error) {
    logger.error({ error }, 'Error fetching incidents:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Résoudre un incident
 */
export const resolveIncident = async (req: Request, res: Response) => {
  const { id } = req.params;
  const requester = (req as any).user;
  try {
    const accessFilter = buildVehicleAccessFilter(requester);

    const incident = await prisma.$transaction(async (tx) => {
      // Fetch incident + check vehicle access
      const existing = await tx.incident.findUnique({ where: { id: id as string }, include: { vehicle: true } });
      if (!existing) throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404 });

      const allowed = await tx.vehicle.findFirst({ where: { id: existing.vehicleId, ...accessFilter } });
      if (!allowed) throw Object.assign(new Error('ACCESS_DENIED'), { statusCode: 403 });

      const updated = await tx.incident.update({
        where: { id: id as string },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });

      // If no more CRITICAL open incidents → unblock vehicle (only if currently BLOCKED)
      const remainingCritical = await tx.incident.count({
        where: { vehicleId: updated.vehicleId, severity: 'CRITICAL', status: 'OPEN' },
      });

      if (remainingCritical === 0) {
        const vehicle = await tx.vehicle.findUnique({ where: { id: updated.vehicleId } });
        if (vehicle && vehicle.status === 'BLOCKED') {
          await tx.vehicle.update({
            where: { id: updated.vehicleId },
            data: { status: 'AVAILABLE' },
          });
        }
      }

      return updated;
    });

    res.json(incident);
  } catch (error: any) {
    if (error.message === 'NOT_FOUND' || error.code === 'P2025') return res.status(404).json({ error: 'Incident introuvable.' });
    if (error.message === 'ACCESS_DENIED') return res.status(403).json({ error: 'Accès non autorisé.' });
    logger.error({ error }, 'Error resolving incident:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Lister tous les incidents (Dashboard Admin)
 */
export const getAllIncidents = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  try {
    const accessFilter = buildVehicleAccessFilter(requester);

    const incidents = await prisma.incident.findMany({
      where: { vehicle: accessFilter },
      include: { 
        vehicle: true,
        user: true 
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(incidents);
  } catch (error) {
    logger.error({ error }, 'Error fetching all incidents:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
