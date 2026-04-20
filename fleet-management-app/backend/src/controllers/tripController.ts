import logger from '../lib/logger';
import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { buildVehicleAccessFilter } from '../utils/accessControl';
import { canManageAdminTrips } from '../utils/permissions';

/**
 * Commencer un trajet (Prise du véhicule)
 * - Si le véhicule est IN_USE (trajet précédent non terminé), clôture automatiquement le trajet précédent
 * - Bloque si le véhicule est MAINTENANCE ou BLOCKED
 */
export const startTrip = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  const { reservationId, vehicleId, startMileage } = req.body;
  const userId = requester.id;

  const km = parseInt(startMileage);
  if (!vehicleId || isNaN(km) || km < 0) {
    return res.status(400).json({ error: 'vehicleId et startMileage (≥0) sont obligatoires.' });
  }

  try {
    const accessFilter = buildVehicleAccessFilter(requester);

    const trip = await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findFirst({ where: { id: vehicleId, ...accessFilter } });
      if (!vehicle) throw Object.assign(new Error('VEHICLE_NOT_FOUND_OR_DENIED'), { statusCode: 404 });

      if (vehicle.status === 'MAINTENANCE' || vehicle.status === 'BLOCKED') {
        throw Object.assign(new Error('VEHICLE_NOT_AVAILABLE'), { statusCode: 409 });
      }

      if (km < vehicle.currentMileage) {
        throw Object.assign(new Error('MILEAGE_BACKWARDS'), { statusCode: 400 });
      }

      // Si le véhicule est IN_USE → auto-clôturer le trajet précédent
      // Le km d'arrivée estimé = km de départ du nouveau trajet (meilleure approximation disponible)
      // Garantie : km >= vehicle.currentMileage >= openTrip.startMileage (vérifié plus haut)
      if (vehicle.status === 'IN_USE') {
        const openTrip = await tx.tripLog.findFirst({
          where: { vehicleId, endTime: null },
          orderBy: { startTime: 'desc' },
        });
        if (openTrip) {
          // Sécurité : endMileage ne peut jamais être inférieur au startMileage du trajet ouvert
          const estimatedEndMileage = Math.max(km, openTrip.startMileage);
          const distanceEstimee = estimatedEndMileage - openTrip.startMileage;
          const dureeMin = Math.round((Date.now() - openTrip.startTime.getTime()) / 60000);
          await tx.tripLog.update({
            where: { id: openTrip.id },
            data: {
              endTime: new Date(),
              endMileage: estimatedEndMileage,
              notes: (openTrip.notes ? openTrip.notes + '\n' : '')
                + `[Clôture automatique — nouveau trajet démarré par ${requester.name || requester.email}. `
                + `Distance estimée : ${distanceEstimee} km. Durée : ${dureeMin} min.]`,
            },
          });
        }
      }

      const newTrip = await tx.tripLog.create({
        data: {
          reservationId: reservationId || null,
          userId,
          vehicleId,
          startMileage: km,
          startTime: new Date(),
        },
      });

      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { status: 'IN_USE', currentMileage: km },
      });

      return newTrip;
    });

    res.status(201).json(trip);
  } catch (error: any) {
    if (error.message === 'VEHICLE_NOT_FOUND_OR_DENIED') return res.status(404).json({ error: 'Véhicule introuvable ou vous n\'y avez pas accès.' });
    if (error.message === 'VEHICLE_NOT_AVAILABLE') return res.status(409).json({ error: 'Ce véhicule est en maintenance ou bloqué.' });
    if (error.message === 'MILEAGE_BACKWARDS') return res.status(400).json({ error: 'Le kilométrage saisi est inférieur au kilométrage actuel du véhicule. Vérifiez le compteur.' });
    logger.error({ error }, 'Erreur lors du démarrage du trajet:');
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

/**
 * Terminer un trajet (Restitution du véhicule)
 */
export const endTrip = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  const { tripId, endMileage, notes } = req.body;

  if (!tripId) return res.status(400).json({ error: 'tripId est obligatoire.' });

  const km = parseInt(endMileage);
  if (isNaN(km) || km < 0) {
    return res.status(400).json({ error: 'endMileage doit être un entier positif.' });
  }

  try {
    const accessFilter = buildVehicleAccessFilter(requester);

    const updatedTrip = await prisma.$transaction(async (tx) => {
      const trip = await tx.tripLog.findUnique({
        where: { id: tripId },
        include: { vehicle: true },
      });

      if (!trip) throw Object.assign(new Error('TRIP_NOT_FOUND'), { statusCode: 404 });
      if (trip.endTime !== null) throw Object.assign(new Error('TRIP_ALREADY_ENDED'), { statusCode: 409 });

      // Vérifier le cloisonnement
      const vehicleAllowed = await tx.vehicle.findFirst({ where: { id: trip.vehicleId, ...accessFilter } });
      if (!vehicleAllowed) {
        throw Object.assign(new Error('FORBIDDEN_VEHICLE'), { statusCode: 403 });
      }

      const isPrivileged = canManageAdminTrips(requester.role);
      if (!isPrivileged && trip.userId !== requester.id) {
        throw Object.assign(new Error('FORBIDDEN'), { statusCode: 403 });
      }

      if (km < trip.startMileage) {
        throw Object.assign(new Error('MILEAGE_BACKWARDS'), { statusCode: 400 });
      }

      const result = await tx.tripLog.update({
        where: { id: tripId },
        data: { endMileage: km, endTime: new Date(), notes },
      });

      const blockingIncidents = await tx.incident.count({
        where: { vehicleId: trip.vehicleId, severity: 'CRITICAL', status: 'OPEN' },
      });

      // Remettre AVAILABLE seulement s'il n'y a plus d'autre trajet ouvert
      const otherOpenTrip = await tx.tripLog.findFirst({
        where: { vehicleId: trip.vehicleId, endTime: null, id: { not: tripId } },
      });

      const newStatus = blockingIncidents > 0 ? trip.vehicle.status
        : otherOpenTrip ? 'IN_USE'
        : 'AVAILABLE';

      await tx.vehicle.update({
        where: { id: trip.vehicleId },
        data: { status: newStatus, currentMileage: km },
      });

      return result;
    });

    res.json(updatedTrip);
  } catch (error: any) {
    if (error.message === 'TRIP_NOT_FOUND') return res.status(404).json({ error: 'Trajet non trouvé.' });
    if (error.message === 'TRIP_ALREADY_ENDED') return res.status(409).json({ error: 'Ce trajet est déjà terminé.' });
    if (error.message === 'FORBIDDEN') return res.status(403).json({ error: 'Vous ne pouvez pas terminer le trajet d\'un autre utilisateur.' });
    if (error.message === 'FORBIDDEN_VEHICLE') return res.status(403).json({ error: 'Vous n\'avez pas accès à ce véhicule.' });
    if (error.message === 'MILEAGE_BACKWARDS') return res.status(400).json({ error: 'Le kilométrage de fin ne peut pas être inférieur au kilométrage de début.' });
    logger.error({ error }, 'Erreur lors de la fin du trajet:');
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

/**
 * Forcer la clôture d'un trajet (Admin / Manager uniquement)
 * Aucun km de fin requis — utilise le km du départ comme estimation
 */
export const forceEndTrip = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  const isPrivileged = canManageAdminTrips(requester.role);
  if (!isPrivileged) return res.status(403).json({ error: 'Accès refusé.' });

  const { tripId } = req.body;
  if (!tripId) return res.status(400).json({ error: 'tripId est obligatoire.' });

  try {
    const accessFilter = buildVehicleAccessFilter(requester);

    const updatedTrip = await prisma.$transaction(async (tx) => {
      const trip = await tx.tripLog.findUnique({
        where: { id: tripId },
        include: { vehicle: true },
      });

      if (!trip) throw Object.assign(new Error('TRIP_NOT_FOUND'), { statusCode: 404 });
      if (trip.endTime !== null) throw Object.assign(new Error('TRIP_ALREADY_ENDED'), { statusCode: 409 });

      const vehicleAllowed = await tx.vehicle.findFirst({ where: { id: trip.vehicleId, ...accessFilter } });
      if (!vehicleAllowed) {
        throw Object.assign(new Error('FORBIDDEN_VEHICLE'), { statusCode: 403 });
      }

      const result = await tx.tripLog.update({
        where: { id: tripId },
        data: {
          endTime: new Date(),
          endMileage: trip.startMileage, // km estimé = km de départ
          notes: (trip.notes ? trip.notes + '\n' : '') + `[Clôture forcée par ${requester.name || requester.email} le ${new Date().toLocaleDateString('fr-FR')}]`,
        },
      });

      // Remettre AVAILABLE si plus aucun trajet ouvert
      const otherOpenTrip = await tx.tripLog.findFirst({
        where: { vehicleId: trip.vehicleId, endTime: null, id: { not: tripId } },
      });
      const blockingIncidents = await tx.incident.count({
        where: { vehicleId: trip.vehicleId, severity: 'CRITICAL', status: 'OPEN' },
      });

      if (!otherOpenTrip && blockingIncidents === 0) {
        await tx.vehicle.update({
          where: { id: trip.vehicleId },
          data: { status: 'AVAILABLE' },
        });
      }

      return result;
    });

    res.json(updatedTrip);
  } catch (error: any) {
    if (error.message === 'TRIP_NOT_FOUND') return res.status(404).json({ error: 'Trajet non trouvé.' });
    if (error.message === 'TRIP_ALREADY_ENDED') return res.status(409).json({ error: 'Ce trajet est déjà terminé.' });
    if (error.message === 'FORBIDDEN_VEHICLE') return res.status(403).json({ error: 'Vous n\'avez pas accès à ce véhicule.' });
    logger.error({ error }, 'Erreur forceEndTrip:');
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

/**
 * Récupérer les trajets actuellement ouverts (Admin/Manager)
 */
export const getOpenTrips = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  const isPrivileged = canManageAdminTrips(requester.role);
  if (!isPrivileged) return res.status(403).json({ error: 'Accès refusé.' });

  try {
    const accessFilter = buildVehicleAccessFilter(requester);

    const openTrips = await prisma.tripLog.findMany({
      where: { 
        endTime: null,
        vehicle: accessFilter
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        vehicle: { select: { id: true, brand: true, model: true, plateNumber: true } },
      },
      orderBy: { startTime: 'asc' },
    });
    res.json(openTrips);
  } catch (error) {
    logger.error({ error }, 'Erreur getOpenTrips:');
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

/**
 * Récupérer l'historique des trajets d'un véhicule
 */
export const getVehicleHistory = async (req: Request, res: Response) => {
  const { vehicleId } = req.params;
  const requester = (req as any).user;
  try {
    const accessFilter = buildVehicleAccessFilter(requester);
    const allowed = await prisma.vehicle.findFirst({ where: { id: vehicleId as string, ...accessFilter } });
    if (!allowed) return res.status(403).json({ error: 'Accès refusé.' });

    const history = await prisma.tripLog.findMany({
      where: { vehicleId: vehicleId as string },
      include: { user: true },
      orderBy: { startTime: 'desc' },
    });
    res.json(history);
  } catch (error) {
    logger.error({ error }, 'Error fetching history:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
