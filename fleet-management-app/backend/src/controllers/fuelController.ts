import logger from '../lib/logger';
import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { buildVehicleAccessFilter } from '../utils/accessControl';

/**
 * Enregistrer un plein de carburant
 */
export const createFuelLog = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  const { vehicleId, liters, cost, mileageAtFill, lowFuel } = req.body;
  const userId = requester.id; // Always use authenticated user — prevents IDOR

  if (!vehicleId) {
    return res.status(400).json({ error: 'vehicleId est obligatoire.' });
  }

  const parsedLiters = liters !== undefined && liters !== null ? parseFloat(liters) : null;
  const parsedCost = cost !== undefined && cost !== null ? parseFloat(cost) : null;
  const mileage = mileageAtFill !== undefined && mileageAtFill !== null ? parseInt(mileageAtFill) : null;

  // Validation : At least one meaningful value required
  if (parsedLiters === null && parsedCost === null && mileage === null && lowFuel === undefined) {
    return res.status(400).json({ error: 'Au moins une donnée (litres, coût, kilométrage) est requise.' });
  }
  if (parsedLiters !== null && parsedLiters <= 0) {
    return res.status(400).json({ error: 'Le nombre de litres doit être positif.' });
  }
  if (parsedCost !== null && parsedCost <= 0) {
    return res.status(400).json({ error: 'Le coût doit être positif.' });
  }
  if (mileage !== null && mileage > 999999) {
    return res.status(400).json({ error: 'Le kilométrage ne peut pas dépasser 999 999 km.' });
  }

  try {
    const accessFilter = buildVehicleAccessFilter(requester);

    const allowed = await prisma.vehicle.findFirst({ where: { id: vehicleId, ...accessFilter } });
    if (!allowed) {
      return res.status(403).json({ error: 'Accès non autorisé pour configurer le carburant de ce véhicule.' });
    }

    const fuelLog = await prisma.fuelLog.create({
      data: {
        vehicleId,
        userId,
        liters: parsedLiters,
        cost: parsedCost,
        mileageAtFill: mileage,
      },
    });

    // Update vehicle: mileage + reset lowFuel if refueling with actual liters
    const updateData: any = {};

    if (mileage !== null) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (vehicle && mileage > vehicle.currentMileage) {
        updateData.currentMileage = mileage;
      }
    }

    if (parsedLiters !== null && parsedLiters > 0) {
      // A real fuel fill — clear the low fuel alert
      updateData.lowFuel = false;
    } else if (lowFuel !== undefined) {
      // Manual flag override
      updateData.lowFuel = lowFuel;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.vehicle.update({ where: { id: vehicleId }, data: updateData });
    }

    res.status(201).json(fuelLog);
  } catch (error) {
    logger.error({ error }, 'Error creating fuel log:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Récupérer tous les pleins (admin)
 */
export const getAllFuelLogs = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  try {
    const accessFilter = buildVehicleAccessFilter(requester);

    const fuelLogs = await prisma.fuelLog.findMany({
      where: { vehicle: accessFilter },
      include: { user: true, vehicle: true },
      orderBy: { date: 'desc' },
    });
    res.json(fuelLogs);
  } catch (error) {
    logger.error({ error }, 'Error fetching all fuel logs:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Récupérer l'historique des pleins d'un véhicule
 */
export const getVehicleFuelLogs = async (req: Request, res: Response) => {
  const { vehicleId } = req.params;
  const requester = (req as any).user;
  try {
    const accessFilter = buildVehicleAccessFilter(requester);
    const allowed = await prisma.vehicle.findFirst({ where: { id: vehicleId as string, ...accessFilter } });
    if (!allowed) return res.status(403).json({ error: 'Accès refusé.' });

    const fuelLogs = await prisma.fuelLog.findMany({
      where: { vehicleId: vehicleId as string },
      include: { user: true },
      orderBy: { date: 'desc' },
    });
    res.json(fuelLogs);
  } catch (error) {
    logger.error({ error }, 'Error fetching fuel logs:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Récupérer les statistiques mensuelles de consommation
 */
export const getMonthlyStats = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const accessFilter = buildVehicleAccessFilter(requester);
    const allowedVehicles = await prisma.vehicle.findMany({ where: accessFilter, select: { id: true } });
    const allowedVehicleIds = allowedVehicles.map(v => v.id);

    const stats = await prisma.fuelLog.groupBy({
      by: ['vehicleId'],
      where: {
        date: { gte: startOfMonth },
        vehicleId: { in: allowedVehicleIds }
      },
      _sum: {
        cost: true,
        liters: true
      },
      _count: {
        id: true
      }
    });

    res.json(stats);
  } catch (error) {
    logger.error({ error }, 'Error fetching monthly stats:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
