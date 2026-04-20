import logger from '../lib/logger';
import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { buildVehicleAccessFilter } from '../utils/accessControl';

const MAX_DESTINATION_LENGTH = 500;

/**
 * Créer une nouvelle réservation avec vérification de disponibilité
 * - Passagers optionnels (passengerIds[])
 * - Blocage si l'utilisateur a un trajet ouvert sur ce véhicule
 */
export const createReservation = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  const { vehicleId, startTime, endTime, destination, passengerIds } = req.body;
  const userId = requester.id;

  if (destination && destination.length > MAX_DESTINATION_LENGTH) {
    return res.status(400).json({ error: `Destination limitée à ${MAX_DESTINATION_LENGTH} caractères.` });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: 'Dates invalides.' });
  }
  if (start >= end) {
    return res.status(400).json({ error: 'La date de fin doit être après la date de début.' });
  }

  // Valider les passengerIds
  const sanitizedPassengerIds: string[] = Array.isArray(passengerIds)
    ? passengerIds.filter((id: any) => typeof id === 'string' && id !== userId)
    : [];

    const accessFilter = buildVehicleAccessFilter(requester);

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      // Vérifier si l'utilisateur a accès au véhicule (Cloisonnement pôle)
      const allowedVehicle = await tx.vehicle.findFirst({
        where: { id: vehicleId, ...accessFilter },
      });
      if (!allowedVehicle) {
         throw Object.assign(new Error('ACCESS_DENIED'), { statusCode: 403 });
      }

      // Bloquer si le véhicule est en maintenance ou bloqué
      if (allowedVehicle.status === 'MAINTENANCE' || allowedVehicle.status === 'BLOCKED') {
        throw Object.assign(new Error('VEHICLE_UNAVAILABLE'), { statusCode: 409 });
      }

      // Blocage : l'utilisateur a-t-il un trajet ouvert sur CE véhicule ?
      const openTrip = await tx.tripLog.findFirst({
        where: { userId, vehicleId, endTime: null },
      });
      if (openTrip) {
        throw Object.assign(new Error('OPEN_TRIP'), { statusCode: 409 });
      }

      // Vérification de conflit de disponibilité
      const conflict = await tx.reservation.findFirst({
        where: {
          vehicleId,
          approvalStatus: { in: ['PENDING', 'APPROVED'] },
          OR: [
            { startTime: { lte: start }, endTime: { gte: start } },
            { startTime: { lte: end },   endTime: { gte: end }   },
            { startTime: { gte: start }, endTime: { lte: end }   },
          ],
        },
      });
      if (conflict) {
        throw Object.assign(new Error('CONFLICT'), { statusCode: 409 });
      }

      // Créer la réservation avec les passagers
      const created = await tx.reservation.create({
        data: {
          userId,
          vehicleId,
          startTime: start,
          endTime: end,
          destination,
          passengers: sanitizedPassengerIds.length > 0 ? {
            create: sanitizedPassengerIds.map((pid: string) => ({ userId: pid })),
          } : undefined,
        },
        include: {
          vehicle: true,
          user: { select: { id: true, name: true, email: true, role: true } },
          passengers: { include: { user: { select: { id: true, name: true } } } },
        },
      });
      return created;
    });

    res.status(201).json(reservation);
  } catch (error: any) {
    if (error.message === 'OPEN_TRIP') {
      return res.status(409).json({ error: 'Vous avez un trajet en cours sur ce véhicule. Terminez-le avant de le réserver à nouveau.' });
    }
    if (error.message === 'CONFLICT') {
      return res.status(409).json({ error: 'Le véhicule est déjà réservé sur ce créneau horaire.' });
    }
    if (error.message === 'VEHICLE_UNAVAILABLE') {
      return res.status(409).json({ error: 'Ce véhicule est actuellement indisponible (maintenance ou bloqué).' });
    }
    if (error.message === 'ACCESS_DENIED') {
      return res.status(403).json({ error: 'Accès non autorisé pour réserver ce véhicule.' });
    }
    logger.error({ error }, 'Erreur lors de la réservation:');
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

/**
 * Lister toutes les réservations
 */
export const getReservations = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const accessFilter = buildVehicleAccessFilter(user);

    const reservations = await prisma.reservation.findMany({
      where: { vehicle: accessFilter },
      include: {
        vehicle: true,
        user: true,
        passengers: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { startTime: 'asc' },
    });
    res.json(reservations);
  } catch (error) {
    logger.error({ error }, 'Error fetching reservations:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Lister les réservations d'un véhicule spécifique
 */
export const getVehicleReservations = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const accessFilter = buildVehicleAccessFilter(user);

  try {
    // Vérifier l'accès
    const allowed = await prisma.vehicle.findFirst({ where: { id: id as string, ...accessFilter } });
    if (!allowed) return res.status(403).json({ error: 'Accès non autorisé pour ce véhicule.' });

    const reservations = await prisma.reservation.findMany({
      where: { vehicleId: id as string },
      include: {
        user: true,
        passengers: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { startTime: 'asc' },
    });
    res.json(reservations);
  } catch (error) {
    logger.error({ error }, 'Error fetching vehicle reservations:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Mettre à jour une réservation existante
 */
export const updateReservation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startTime, endTime, destination, vehicleId, passengerIds } = req.body;
  const requester = (req as any).user;

  try {
    const start = new Date(startTime);
    const end = new Date(endTime);

    const accessFilter = buildVehicleAccessFilter(requester);
    const reservationExists = await prisma.reservation.findFirst({
      where: { id: id as string, vehicle: accessFilter },
    });
    if (!reservationExists) {
      return res.status(403).json({ error: 'Réservation introuvable ou vous n\'y avez pas accès.' });
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Dates invalides' });
    }
    if (start >= end) {
      return res.status(400).json({ error: 'La date de fin doit être après la date de début' });
    }

    if (vehicleId) {
      // Vérifier que le nouveau véhicule est dans le pôle de l'utilisateur
      const newVehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, ...accessFilter },
      });
      if (!newVehicle) {
        return res.status(403).json({ error: 'Accès refusé : nouveau véhicule hors de votre pôle.' });
      }
      if (newVehicle.status === 'MAINTENANCE' || newVehicle.status === 'BLOCKED') {
        return res.status(409).json({ error: 'Ce véhicule est actuellement indisponible (maintenance ou bloqué).' });
      }

      const conflicts = await prisma.reservation.findFirst({
        where: {
          vehicleId,
          id: { not: id as string },
          approvalStatus: { in: ['PENDING', 'APPROVED'] },
          OR: [
            { startTime: { lte: start }, endTime: { gte: start } },
            { startTime: { lte: end },   endTime: { gte: end }   },
            { startTime: { gte: start }, endTime: { lte: end }   },
          ],
        },
      });
      if (conflicts) {
        return res.status(409).json({ error: 'Le véhicule est déjà réservé sur ce créneau horaire' });
      }
    }

    const sanitizedPassengerIds: string[] = Array.isArray(passengerIds)
      ? passengerIds.filter((pid: any) => typeof pid === 'string' && pid !== requester.id)
      : [];

    const reservation = await prisma.reservation.update({
      where: { id: id as string },
      data: {
        startTime: start,
        endTime: end,
        destination,
        passengers: {
          deleteMany: {},
          create: sanitizedPassengerIds.map((pid: string) => ({ userId: pid })),
        },
      },
      include: {
        vehicle: true,
        user: true,
        passengers: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    res.json(reservation);
  } catch (error) {
    logger.error({ error }, 'Erreur lors de la mise à jour de la réservation:');
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

/**
 * Supprimer une réservation
 */
export const deleteReservation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const requester = (req as any).user;
  try {
    const reservation = await prisma.reservation.findUnique({ where: { id: id as string } });
    if (!reservation) return res.status(404).json({ error: 'Réservation introuvable.' });

    const isCadre = ['ADMIN', 'DIRECTEUR', 'MANAGER'].includes(requester?.role);
    const isOwner = reservation.userId === requester?.id;
    if (!isCadre && !isOwner) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres réservations.' });
    }

    await prisma.reservation.delete({ where: { id: id as string } });
    res.status(204).send();
  } catch (error) {
    logger.error({ error }, 'Erreur lors de la suppression de la réservation:');
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};
