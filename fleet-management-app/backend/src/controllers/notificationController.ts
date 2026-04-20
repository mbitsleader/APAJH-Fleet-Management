import logger from '../lib/logger';
import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { buildVehicleAccessFilter } from '../utils/accessControl';

export const getNotificationSummary = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const accessFilter = buildVehicleAccessFilter(user);
  
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { ...accessFilter, deletedAt: null },
      select: { id: true, nextTechnicalInspection: true, status: true }
    });
    
    const vehicleIds = vehicles.map(v => v.id);
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const [pendingCleanings, activeMaintenance, pendingCleaningDates] = await Promise.all([
      prisma.cleaningSchedule.count({
        where: { 
          vehicleId: { in: vehicleIds },
          isDone: false,
          weekStart: { lte: today }
        }
      }),
      prisma.maintenanceAlert.count({
        where: {
          vehicleId: { in: vehicleIds },
          isResolved: false
        }
      }),
      prisma.cleaningSchedule.findMany({
        where: {
          vehicleId: { in: vehicleIds },
          isDone: false,
          weekStart: { lte: today }
        },
        select: { weekStart: true },
        distinct: ['weekStart'],
        orderBy: { weekStart: 'asc' }
      })
    ]);
    
    const ctAlerts = vehicles.filter(v => 
      v.nextTechnicalInspection && v.nextTechnicalInspection <= thirtyDaysFromNow
    ).length;
    
    const blockedVehicles = vehicles.filter(v => 
      ['BLOCKED', 'MAINTENANCE'].includes(v.status)
    ).length;
    
    const totalCount = pendingCleanings + activeMaintenance + ctAlerts + blockedVehicles;
    
    res.json({
      count: totalCount,
      details: {
        cleanings: pendingCleanings,
        cleaningWeeks: pendingCleaningDates.map(d => d.weekStart),
        maintenance: activeMaintenance,
        technicalInspection: ctAlerts,
        blocked: blockedVehicles
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching notification summary:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
