import logger from '../lib/logger';
import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { buildVehicleAccessFilter } from '../utils/accessControl';
import { canDeleteVehicle } from '../utils/permissions';

export const getVehicles = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const accessFilter = buildVehicleAccessFilter(user);

    const vehicles = await prisma.vehicle.findMany({
      where: { ...accessFilter, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { id: true, name: true, poleId: true, pole: { select: { id: true, name: true } } } },
        assignedUser: { select: { id: true, name: true } },
      },
    });
    res.json(vehicles);
  } catch (error) {
    logger.error({ error }, 'Error fetching vehicles:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const VALID_STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'BLOCKED'];
const VALID_TYPES = ['PERMANENT', 'REPLACEMENT'];

export const createVehicle = async (req: Request, res: Response) => {
  const { brand, model, plateNumber, category, fuelType, status, currentMileage, imageUrl, type, serviceId, assignedUserId, nextTechnicalInspection } = req.body;
  if (!brand || !model || !plateNumber) {
    return res.status(400).json({ error: 'Marque, modèle et plaque sont obligatoires.' });
  }
  if (plateNumber.length > 15) return res.status(400).json({ error: 'La plaque ne peut pas dépasser 15 caractères.' });
  if (brand.length > 100) return res.status(400).json({ error: 'La marque ne peut pas dépasser 100 caractères.' });
  if (model.length > 100) return res.status(400).json({ error: 'Le modèle ne peut pas dépasser 100 caractères.' });
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs acceptées : ${VALID_STATUSES.join(', ')}` });
  }
  if (type && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Type invalide. Valeurs acceptées : ${VALID_TYPES.join(', ')}` });
  }
  const km = currentMileage !== undefined ? parseInt(currentMileage, 10) : 0;
  if (isNaN(km) || km < 0) return res.status(400).json({ error: 'Le kilométrage doit être un entier positif ou nul.' });
  
  if (imageUrl && !imageUrl.startsWith('https://') && !imageUrl.startsWith('http://') && !imageUrl.startsWith('/')) {
    return res.status(400).json({ error: 'L\'URL de l\'image doit commencer par https://, http:// ou / (chemin local).' });
  }

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        brand,
        model,
        plateNumber,
        category: category || null,
        fuelType: fuelType || null,
        status: status || 'AVAILABLE',
        currentMileage: km,
        imageUrl: imageUrl || null,
        type: type || 'PERMANENT',
        serviceId: serviceId || null,
        assignedUserId: assignedUserId || null,
        nextTechnicalInspection: nextTechnicalInspection ? new Date(nextTechnicalInspection) : null,
      },
    });
    res.status(201).json(vehicle);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Cette plaque d\'immatriculation existe déjà.' });
    logger.error('Error creating vehicle:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getVehicleById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const accessFilter = buildVehicleAccessFilter(user);

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: id as string, ...accessFilter, deletedAt: null },
      include: {
        service: { select: { id: true, name: true, poleId: true, pole: { select: { id: true, name: true } } } },
        assignedUser: { select: { id: true, name: true } },
      },
    });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(vehicle);
  } catch (error) {
    logger.error({ error }, 'Error fetching vehicle:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateVehicle = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const requester = (req as any).user;
  const { brand, model, plateNumber, category, fuelType, status, currentMileage, imageUrl, type, serviceId, assignedUserId, nextTechnicalInspection } = req.body;

  let parsedMileage: number | undefined;
  if (currentMileage !== undefined) {
    parsedMileage = parseInt(currentMileage, 10);
    if (isNaN(parsedMileage) || parsedMileage < 0) {
      return res.status(400).json({ error: 'Le kilométrage doit être un entier positif ou nul.' });
    }
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs acceptées : ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const accessFilter = buildVehicleAccessFilter(requester);
    const vehicleCheck = await prisma.vehicle.findFirst({ where: { id, ...accessFilter } });
    if (vehicleCheck) {
      if (imageUrl && !imageUrl.startsWith('https://') && !imageUrl.startsWith('http://') && !imageUrl.startsWith('/')) {
        return res.status(400).json({ error: 'L\'URL de l\'image doit commencer par https://, http:// ou / (chemin local).' });
      }
    }
    if (!vehicleCheck) {
      return res.status(403).json({ error: 'Accès refusé : véhicule hors de votre pôle.' });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(brand !== undefined && { brand }),
        ...(model !== undefined && { model }),
        ...(plateNumber !== undefined && { plateNumber }),
        ...(category !== undefined && { category }),
        ...(fuelType !== undefined && { fuelType }),
        ...(status !== undefined && { status }),
        ...(parsedMileage !== undefined && { currentMileage: parsedMileage }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(type !== undefined && { type }),
        ...(serviceId !== undefined && { serviceId: serviceId || null }),
        ...(assignedUserId !== undefined && { assignedUserId: assignedUserId || null }),
        ...(nextTechnicalInspection !== undefined && { nextTechnicalInspection: nextTechnicalInspection ? new Date(nextTechnicalInspection) : null }),
      },
    });
    res.json(vehicle);
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Vehicle not found' });
    logger.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteVehicle = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const force = req.query.force === 'true';
  const requester = (req as any).user;

  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) return res.status(404).json({ error: 'Véhicule introuvable.' });

    // Count linked records
    const [reservations, trips, fuel, incidents] = await Promise.all([
      prisma.reservation.count({ where: { vehicleId: id } }),
      prisma.tripLog.count({ where: { vehicleId: id } }),
      prisma.fuelLog.count({ where: { vehicleId: id } }),
      prisma.incident.count({ where: { vehicleId: id } }),
    ]);

    const hasData = reservations + trips + fuel + incidents > 0;

    if (hasData && !force) {
      return res.status(409).json({
        error: 'Ce véhicule a des données associées.',
        details: { reservations, trips, fuel, incidents },
      });
    }

    // Soft delete
    await prisma.vehicle.update({ 
      where: { id }, 
      data: { deletedAt: new Date() } 
    });
    res.status(204).send();
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Véhicule introuvable.' });
    logger.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
