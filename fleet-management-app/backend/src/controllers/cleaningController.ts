import logger from '../lib/logger';
import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { buildVehicleAccessFilter } from '../utils/accessControl';

// Get Monday of the week containing a given date
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun,1=Mon,...
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// GET /api/cleaning?week=YYYY-MM-DD
// Returns schedules for the week, filtered by requester's role/poles
export const getCleaningSchedule = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  const weekParam = req.query.week as string | undefined;
  const weekStart = weekParam ? getWeekStart(new Date(weekParam)) : getWeekStart(new Date());

  try {
    // Remplacement de l'ancienne logique manuelle complexe par notre utilitaire
    const vehicleFilter = buildVehicleAccessFilter(requester);

    const vehicles = await prisma.vehicle.findMany({
      where: vehicleFilter,
      include: {
        service: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: { brand: 'asc' },
    });

    const vehicleIds = vehicles.map((v: any) => v.id);

    const schedules = await prisma.cleaningSchedule.findMany({
      where: { vehicleId: { in: vehicleIds }, weekStart },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true, name: true, role: true,
                userServices: { select: { serviceId: true, service: { select: { id: true, name: true } } } },
              },
            },
          },
        },
        logs: {
          include: { user: { select: { id: true, name: true } } }
        }
      },
    });

    // Build map vehicleId → schedule
    const scheduleMap: Record<string, any> = {};
    for (const s of schedules) {
      scheduleMap[s.vehicleId] = s;
    }

    const result = vehicles.map((v: any) => ({
      vehicle: v,
      schedule: scheduleMap[v.id] || null,
    }));

    res.json({ weekStart, items: result });
  } catch (error) {
    logger.error({ error }, 'Error fetching cleaning schedule:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Create or update schedule for a vehicle/week, assign professionals
export const upsertCleaningSchedule = async (req: Request, res: Response) => {
  const { vehicleId, weekDate, assignedUserIds, notes, plannedDays } = req.body;
  if (!vehicleId || !weekDate) {
    return res.status(400).json({ error: 'vehicleId et weekDate sont obligatoires.' });
  }

  const weekStart = getWeekStart(new Date(weekDate));

  const requester = (req as any).user;
  const accessFilter = buildVehicleAccessFilter(requester);
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, ...accessFilter } });
  if (!vehicle) return res.status(404).json({ error: 'Véhicule introuvable ou accès refusé.' });

  const userIds: string[] = Array.isArray(assignedUserIds) ? assignedUserIds : [];

  try {
    const full = await prisma.$transaction(async (tx) => {
      const schedule = await tx.cleaningSchedule.upsert({
        where: { vehicleId_weekStart: { vehicleId, weekStart } },
        create: { vehicleId, weekStart, notes: notes || null, plannedDays: plannedDays || null },
        update: { notes: notes || null, plannedDays: plannedDays || null, isDone: false },
      });

      // Replace all assignments atomically
      await tx.cleaningAssignment.deleteMany({ where: { scheduleId: schedule.id } });

      if (userIds.length > 0) {
        await tx.cleaningAssignment.createMany({
          data: userIds.map((uid: string) => ({ scheduleId: schedule.id, userId: uid })),
          skipDuplicates: true,
        });
      }

      return tx.cleaningSchedule.findUnique({
        where: { id: schedule.id },
        include: {
          assignments: {
            include: {
              user: {
                select: {
                  id: true, name: true, role: true,
                  userServices: { select: { serviceId: true, service: { select: { id: true, name: true } } } },
                },
              },
            },
          },
        },
      });
    });

    res.json(full);
  } catch (error) {
    logger.error({ error }, 'Error upserting cleaning schedule:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// PATCH /api/cleaning/schedule/:id/done
// Body: { isDone: boolean, completedByUserIds?: string[] }
// completedByUserIds: who actually did the cleaning (can include non-assigned colleagues)
export const markCleaningDone = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { isDone, completedByUserIds } = req.body;
  const requester = (req as any).user;
  const marking = isDone !== false;

  try {
    const accessFilter = buildVehicleAccessFilter(requester);
    const schedule = await prisma.cleaningSchedule.findUnique({ where: { id } });
    if (!schedule) return res.status(404).json({ error: 'Planning introuvable.' });

    const allowed = await prisma.vehicle.findFirst({ where: { id: schedule.vehicleId, ...accessFilter } });
    if (!allowed) return res.status(403).json({ error: 'Accès interdit.' });

    await prisma.$transaction(async (tx) => {
      await tx.cleaningSchedule.update({ where: { id }, data: { isDone: marking } });

      if (marking) {
        // Set completedAt for each declared contributor (create entry if not originally assigned)
        if (Array.isArray(completedByUserIds) && completedByUserIds.length > 0) {
          for (const userId of completedByUserIds) {
            await tx.cleaningAssignment.upsert({
              where: { scheduleId_userId: { scheduleId: id, userId } },
              update: { completedAt: new Date() },
              create: { scheduleId: id, userId, completedAt: new Date() },
            });
          }
        }
      } else {
        // Unmark: reset completedAt on all assignments
        await tx.cleaningAssignment.updateMany({ where: { scheduleId: id }, data: { completedAt: null } });
      }
    });

    const updatedSchedule = await prisma.cleaningSchedule.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true, name: true, role: true,
                userServices: { select: { serviceId: true, service: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
    });
    res.json(updatedSchedule);
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Planning introuvable.' });
    logger.error({ error }, 'Error marking cleaning done:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// PATCH /api/cleaning/schedule/:id/self-complete
// Any authenticated user declares they personally did the cleaning
export const selfCompleteClean = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const requester = (req as any).user;

  try {
    const accessFilter = buildVehicleAccessFilter(requester);
    const schedule = await prisma.cleaningSchedule.findUnique({ where: { id } });
    if (!schedule) return res.status(404).json({ error: 'Planning introuvable.' });

    const allowed = await prisma.vehicle.findFirst({ where: { id: schedule.vehicleId, ...accessFilter } });
    if (!allowed) return res.status(403).json({ error: 'Accès interdit.' });

    await prisma.cleaningAssignment.upsert({
      where: { scheduleId_userId: { scheduleId: id, userId: requester.id } },
      update: { completedAt: new Date() },
      create: { scheduleId: id, userId: requester.id, completedAt: new Date() },
    });

    const updated = await prisma.cleaningSchedule.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true, name: true, role: true,
                userServices: { select: { serviceId: true, service: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
    });
    res.json(updated);
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Planning introuvable.' });
    logger.error({ error }, 'Error self-completing cleaning:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// DELETE /api/cleaning/schedule/:id
export const deleteCleaningSchedule = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const requester = (req as any).user;
  try {
    const accessFilter = buildVehicleAccessFilter(requester);
    const schedule = await prisma.cleaningSchedule.findUnique({ where: { id } });
    if (!schedule) return res.status(404).json({ error: 'Planning introuvable.' });

    const allowed = await prisma.vehicle.findFirst({ where: { id: schedule.vehicleId, ...accessFilter } });
    if (!allowed) return res.status(403).json({ error: 'Accès interdit.' });

    await prisma.cleaningSchedule.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Planning introuvable.' });
    logger.error({ error }, 'Error deleting cleaning schedule:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createCleaningLog = async (req: Request, res: Response) => {
  const { scheduleId, date, notes } = req.body;
  const userId = (req as any).user.id;

  if (!scheduleId || !date) return res.status(400).json({ error: 'Missing scheduleId or date' });

  try {
    const log = await prisma.cleaningLog.upsert({
      where: {
        scheduleId_date_userId: {
          scheduleId,
          date: new Date(date),
          userId
        }
      },
      update: { notes },
      create: { scheduleId, date: new Date(date), userId, notes },
      include: { user: { select: { id: true, name: true } } }
    });
    res.json(log);
  } catch (error) {
    logger.error({ error }, 'Error saving log:');
    res.status(500).json({ error: 'Error saving log' });
  }
};
