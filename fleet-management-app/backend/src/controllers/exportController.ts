import logger from '../lib/logger';
import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { buildVehicleAccessFilter } from '../utils/accessControl';
import { ExportMetadata } from '../utils/exportHelpers';
import {
  generateTripJournalExcel, generateTripJournalCSV, generateTripJournalPDF,
  generateWeeklyPlanningPDF,
  generateCleaningPlanningPDF,
  generateActivityReportExcel, generateActivityReportPDF,
  generateCostSummaryExcel,
  generateUtilizationExcel,
  generateFuelHistoryExcel, generateFuelHistoryCSV,
  generateIncidentReportExcel, generateIncidentReportPDF, generateIncidentReportCSV,
  generateMaintenanceHistoryExcel, generateMaintenanceHistoryPDF, generateMaintenanceHistoryCSV,
  generateDocumentScheduleExcel, generateDocumentSchedulePDF, generateDocumentScheduleCSV,
  generateVehicleCardPDF,
  generateUserDataJSON,
} from '../services/exportService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDateFilter(startDate?: string, endDate?: string) {
  const filter: any = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); filter.lte = e; }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

function sendFile(res: Response, buffer: Buffer | string, format: string, filename: string) {
  const mimeMap: Record<string, string> = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf:  'application/pdf',
    csv:  'text/csv; charset=utf-8',
    json: 'application/json; charset=utf-8',
  };
  res.setHeader('Content-Type', mimeMap[format] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.${format}"`);
  res.send(buffer);
}

function auditExport(req: Request, reportName: string, format: string, rowCount?: number) {
  const user = (req as any).user;
  const ip = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown';
  logger.info({
    audit: 'EXPORT',
    report: reportName,
    format,
    exportedBy: { id: user.id, name: user.name, role: user.role },
    filters: {
      startDate:   req.query.startDate,
      endDate:     req.query.endDate,
      vehicleId:   req.query.vehicleId,
      poleId:      req.query.poleId,
      poleName:    req.query.poleName,
    },
    rowCount: rowCount ?? null,
    ip,
    at: new Date().toISOString(),
  }, `[AUDIT] Export "${reportName}" (${format}) par ${user.name} (${user.role})`);
}

function buildMeta(req: Request, reportName: string): ExportMetadata {
  const user = (req as any).user;
  return {
    reportName,
    generatedBy: { name: user.name, role: user.role },
    filters: {
      startDate: req.query.startDate as string | undefined,
      endDate:   req.query.endDate   as string | undefined,
      pole:      req.query.poleName  as string | undefined,
      vehicle:   req.query.vehicleName as string | undefined,
    },
  };
}

function today() { return new Date().toISOString().split('T')[0]; }

// ─── Export 4 : Journal des déplacements ─────────────────────────────────────

export async function tripJournal(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { format = 'xlsx', startDate, endDate, vehicleId } = req.query;
    const accessFilter = buildVehicleAccessFilter(user);
    const dateFilter = buildDateFilter(startDate as string, endDate as string);

    const trips = await prisma.tripLog.findMany({
      where: {
        endTime: { not: null },
        ...(dateFilter && { startTime: dateFilter }),
        vehicle: { ...accessFilter, deletedAt: null, ...(vehicleId && { id: vehicleId as string }) },
      },
      include: {
        vehicle: { include: { service: { include: { pole: true } } } },
        user:    { select: { id: true, name: true } },
        reservation: { select: { destination: true, passengers: { include: { user: { select: { name: true } } } } } },
      },
      orderBy: { startTime: 'asc' },
    });

    const meta = buildMeta(req, 'Journal des déplacements');
    const fname = `journal_deplacements_${today()}`;
    auditExport(req, 'Journal des déplacements', format as string, trips.length);

    if (format === 'csv') {
      const csv = await generateTripJournalCSV(trips, meta);
      return sendFile(res, csv, 'csv', fname);
    }
    if (format === 'pdf') {
      const buf = await generateTripJournalPDF(trips, meta);
      return sendFile(res, buf, 'pdf', fname);
    }
    const buf = await generateTripJournalExcel(trips, meta);
    sendFile(res, buf, 'xlsx', fname);
  } catch (err) {
    logger.error({ err }, 'Export tripJournal error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}

// ─── Export 5 : Planning hebdomadaire ────────────────────────────────────────

export async function weeklyPlanning(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const accessFilter = buildVehicleAccessFilter(user);
    let weekStart: Date;
    if (req.query.startDate) {
      weekStart = new Date(req.query.startDate as string);
    } else {
      weekStart = new Date();
      const day = weekStart.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
    }
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const reservations = await prisma.reservation.findMany({
      where: {
        startTime: { gte: weekStart },
        endTime:   { lte: weekEnd },
        approvalStatus: 'APPROVED',
        vehicle: { ...accessFilter, deletedAt: null },
      },
      include: {
        user:    { select: { name: true } },
        vehicle: { select: { id: true, brand: true, model: true, plateNumber: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const meta = buildMeta(req, 'Planning hebdomadaire des réservations');
    auditExport(req, 'Planning hebdomadaire', 'pdf', reservations.length);
    const buf = await generateWeeklyPlanningPDF(reservations, weekStart, meta);
    sendFile(res, buf, 'pdf', `planning_hebdo_${today()}`);
  } catch (err) {
    logger.error({ err }, 'Export weeklyPlanning error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}

// ─── Export 6 : Planning de nettoyage ────────────────────────────────────────

export async function cleaningPlanning(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const accessFilter = buildVehicleAccessFilter(user);
    const dateFilter = buildDateFilter(req.query.startDate as string, req.query.endDate as string);

    const schedules = await prisma.cleaningSchedule.findMany({
      where: {
        ...(dateFilter && { weekStart: dateFilter }),
        vehicle: { ...accessFilter, deletedAt: null },
      },
      include: {
        vehicle:     { select: { brand: true, model: true, plateNumber: true } },
        assignments: { include: { user: { select: { name: true } } } },
        logs:        { select: { date: true } },
      },
      orderBy: { weekStart: 'desc' },
    });

    const meta = buildMeta(req, 'Planning de nettoyage');
    auditExport(req, 'Planning de nettoyage', 'pdf', schedules.length);
    const buf = await generateCleaningPlanningPDF(schedules, meta);
    sendFile(res, buf, 'pdf', `planning_nettoyage_${today()}`);
  } catch (err) {
    logger.error({ err }, 'Export cleaningPlanning error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}

// ─── Export 1 : Rapport d'activité ───────────────────────────────────────────

export async function activityReport(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { format = 'xlsx', startDate, endDate, vehicleId } = req.query;
    const accessFilter = buildVehicleAccessFilter(user);
    const dateFilter = buildDateFilter(startDate as string, endDate as string);

    const [trips, reservations] = await Promise.all([
      prisma.tripLog.findMany({
        where: {
          endTime: { not: null },
          ...(dateFilter && { startTime: dateFilter }),
          vehicle: { ...accessFilter, deletedAt: null, ...(vehicleId && { id: vehicleId as string }) },
        },
        include: {
          vehicle: { include: { service: { include: { pole: true } } } },
          user:    { select: { id: true, name: true } },
          reservation: { select: { destination: true } },
        },
        orderBy: { startTime: 'asc' },
      }),
      prisma.reservation.findMany({
        where: {
          ...(dateFilter && { startTime: dateFilter }),
          approvalStatus: 'APPROVED',
          vehicle: { ...accessFilter, deletedAt: null, ...(vehicleId && { id: vehicleId as string }) },
        },
        include: { vehicle: { include: { service: { include: { pole: true } } } } },
      }),
    ]);

    const meta = buildMeta(req, "Rapport d'activité véhicules");
    const fname = `rapport_activite_${today()}`;
    auditExport(req, "Rapport d'activité véhicules", format as string, trips.length);

    if (format === 'pdf') {
      const buf = await generateActivityReportPDF(trips, meta);
      return sendFile(res, buf, 'pdf', fname);
    }
    const buf = await generateActivityReportExcel(trips, reservations, meta);
    sendFile(res, buf, 'xlsx', fname);
  } catch (err) {
    logger.error({ err }, 'Export activityReport error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}

// ─── Export 2 : Synthèse des coûts ───────────────────────────────────────────

export async function costSummary(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { startDate, endDate, vehicleId } = req.query;
    const accessFilter = buildVehicleAccessFilter(user);
    const dateFilter = buildDateFilter(startDate as string, endDate as string);

    const [fuelLogs, trips] = await Promise.all([
      prisma.fuelLog.findMany({
        where: {
          ...(dateFilter && { date: dateFilter }),
          vehicle: { ...accessFilter, deletedAt: null, ...(vehicleId && { id: vehicleId as string }) },
        },
        include: { vehicle: { include: { service: { include: { pole: true } } } }, user: { select: { name: true } } },
      }),
      prisma.tripLog.findMany({
        where: {
          endTime: { not: null },
          ...(dateFilter && { startTime: dateFilter }),
          vehicle: { ...accessFilter, deletedAt: null, ...(vehicleId && { id: vehicleId as string }) },
        },
        include: { vehicle: { include: { service: { include: { pole: true } } } } },
      }),
    ]);

    const meta = buildMeta(req, 'Synthèse des coûts');
    auditExport(req, 'Synthèse des coûts', 'xlsx', fuelLogs.length);
    const buf = await generateCostSummaryExcel(fuelLogs, trips, meta);
    sendFile(res, buf, 'xlsx', `synthese_couts_${today()}`);
  } catch (err) {
    logger.error({ err }, 'Export costSummary error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}

// ─── Export 3 : Taux d'utilisation ───────────────────────────────────────────

export async function utilization(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { startDate, endDate, poleId } = req.query;
    const accessFilter = buildVehicleAccessFilter(user);
    const dateFilter = buildDateFilter(startDate as string, endDate as string);

    const [vehicles, reservations] = await Promise.all([
      prisma.vehicle.findMany({
        where: {
          ...accessFilter, deletedAt: null,
          ...(poleId && { service: { poleId: poleId as string } }),
        },
        include: { service: { include: { pole: true } } },
      }),
      prisma.reservation.findMany({
        where: {
          approvalStatus: 'APPROVED',
          ...(dateFilter && { startTime: dateFilter }),
          vehicle: { ...accessFilter, deletedAt: null },
        },
        select: { vehicleId: true, startTime: true, endTime: true },
      }),
    ]);

    const meta = buildMeta(req, "Taux d'utilisation des véhicules");
    auditExport(req, "Taux d'utilisation", 'xlsx', vehicles.length);
    const buf = await generateUtilizationExcel(vehicles, reservations, meta);
    sendFile(res, buf, 'xlsx', `taux_utilisation_${today()}`);
  } catch (err) {
    logger.error({ err }, 'Export utilization error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}

// ─── Export 7 : Historique carburant ─────────────────────────────────────────

export async function fuelHistory(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { format = 'xlsx', startDate, endDate, vehicleId } = req.query;
    const accessFilter = buildVehicleAccessFilter(user);
    const dateFilter = buildDateFilter(startDate as string, endDate as string);

    const fuelLogs = await prisma.fuelLog.findMany({
      where: {
        ...(dateFilter && { date: dateFilter }),
        vehicle: { ...accessFilter, deletedAt: null, ...(vehicleId && { id: vehicleId as string }) },
      },
      include: {
        vehicle: { include: { service: { include: { pole: true } } } },
        user:    { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const meta = buildMeta(req, 'Historique carburant');
    const fname = `historique_carburant_${today()}`;
    auditExport(req, 'Historique carburant', format as string, fuelLogs.length);

    if (format === 'csv') {
      const csv = await generateFuelHistoryCSV(fuelLogs, meta);
      return sendFile(res, csv, 'csv', fname);
    }
    const buf = await generateFuelHistoryExcel(fuelLogs, meta);
    sendFile(res, buf, 'xlsx', fname);
  } catch (err) {
    logger.error({ err }, 'Export fuelHistory error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}

// ─── Export 8 : Rapport d'incidents ──────────────────────────────────────────

export async function incidentReport(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { format = 'xlsx', startDate, endDate, vehicleId } = req.query;
    const accessFilter = buildVehicleAccessFilter(user);
    const dateFilter = buildDateFilter(startDate as string, endDate as string);

    const incidents = await prisma.incident.findMany({
      where: {
        ...(dateFilter && { createdAt: dateFilter }),
        vehicle: { ...accessFilter, deletedAt: null, ...(vehicleId && { id: vehicleId as string }) },
      },
      include: {
        vehicle: { include: { service: { include: { pole: true } } } },
        user:    { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const meta = buildMeta(req, "Rapport d'incidents");
    const fname = `rapport_incidents_${today()}`;
    auditExport(req, "Rapport d'incidents", format as string, incidents.length);

    if (format === 'csv') {
      const csv = await generateIncidentReportCSV(incidents, meta);
      return sendFile(res, csv, 'csv', fname);
    }
    if (format === 'pdf') {
      const buf = await generateIncidentReportPDF(incidents, meta);
      return sendFile(res, buf, 'pdf', fname);
    }
    const buf = await generateIncidentReportExcel(incidents, meta);
    sendFile(res, buf, 'xlsx', fname);
  } catch (err) {
    logger.error({ err }, 'Export incidentReport error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}

// ─── Export 9 : Historique entretien ─────────────────────────────────────────

export async function maintenanceHistory(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { format = 'xlsx', vehicleId } = req.query;
    const accessFilter = buildVehicleAccessFilter(user);

    const alerts = await prisma.maintenanceAlert.findMany({
      where: {
        vehicle: { ...accessFilter, deletedAt: null, ...(vehicleId && { id: vehicleId as string }) },
      },
      include: {
        vehicle: { include: { service: { include: { pole: true } } } },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const meta = buildMeta(req, "Historique d'entretien");
    const fname = `historique_entretien_${today()}`;
    auditExport(req, "Historique d'entretien", format as string, alerts.length);

    if (format === 'csv') {
      const csv = await generateMaintenanceHistoryCSV(alerts, meta);
      return sendFile(res, csv, 'csv', fname);
    }
    if (format === 'pdf') {
      const buf = await generateMaintenanceHistoryPDF(alerts, meta);
      return sendFile(res, buf, 'pdf', fname);
    }
    const buf = await generateMaintenanceHistoryExcel(alerts, meta);
    sendFile(res, buf, 'xlsx', fname);
  } catch (err) {
    logger.error({ err }, 'Export maintenanceHistory error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}

// ─── Export 10 : Échéancier documents ────────────────────────────────────────

export async function documentSchedule(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { format = 'xlsx', poleId } = req.query;
    const accessFilter = buildVehicleAccessFilter(user);

    const vehicles = await prisma.vehicle.findMany({
      where: {
        ...accessFilter, deletedAt: null,
        ...(poleId && { service: { poleId: poleId as string } }),
      },
      include: {
        service: { include: { pole: true } },
        maintenanceAlert: { where: { isResolved: false }, orderBy: { expiryDate: 'asc' }, take: 1 },
      },
      orderBy: { brand: 'asc' },
    });

    const meta = buildMeta(req, 'Échéancier documents & alertes');
    const fname = `echeancier_documents_${today()}`;
    auditExport(req, 'Échéancier documents & alertes', format as string, vehicles.length);

    if (format === 'csv') {
      const csv = await generateDocumentScheduleCSV(vehicles, meta);
      return sendFile(res, csv, 'csv', fname);
    }
    if (format === 'pdf') {
      const buf = await generateDocumentSchedulePDF(vehicles, meta);
      return sendFile(res, buf, 'pdf', fname);
    }
    const buf = await generateDocumentScheduleExcel(vehicles, meta);
    sendFile(res, buf, 'xlsx', fname);
  } catch (err) {
    logger.error({ err }, 'Export documentSchedule error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}

// ─── Export 11 : Fiche véhicule ───────────────────────────────────────────────

export async function vehicleCard(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const vehicleId = req.params.id as string;
    const variant = (req.query.variant as string) === 'summary' ? 'summary' : 'detailed';
    const accessFilter = buildVehicleAccessFilter(user);

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ...accessFilter, deletedAt: null },
      include: {
        service: { include: { pole: true } },
        maintenanceAlert: { orderBy: { expiryDate: 'asc' } },
      },
    });

    if (!vehicle) return res.status(404).json({ error: 'Véhicule introuvable ou accès non autorisé' });

    const [trips, incidents, fuelLogs, cleaningSchedules] = await Promise.all([
      prisma.tripLog.findMany({
        where: { vehicleId: vehicleId, endTime: { not: null } },
        include: { user: { select: { id: true, name: true } }, reservation: { select: { destination: true } } },
        orderBy: { startTime: 'desc' }, take: variant === 'detailed' ? 50 : 10,
      }),
      prisma.incident.findMany({
        where: { vehicleId: vehicleId },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fuelLog.findMany({
        where: { vehicleId: vehicleId },
        include: { user: { select: { name: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.cleaningSchedule.findMany({
        where: { vehicleId: vehicleId },
        include: {
          assignments: { include: { user: { select: { name: true } } } },
          logs: { select: { date: true }, take: 1, orderBy: { date: 'desc' } },
        },
        orderBy: { weekStart: 'desc' },
        take: 20,
      }),
    ]);

    const meta = buildMeta(req, `Fiche véhicule — ${vehicle.brand} ${vehicle.model}`);
    auditExport(req, `Fiche véhicule (${variant})`, 'pdf');
    const buf = await generateVehicleCardPDF(vehicle, trips, incidents, fuelLogs, cleaningSchedules, meta, variant);
    sendFile(res, buf, 'pdf', `fiche_vehicule_${vehicle.plateNumber.replace(/\s/g, '_')}_${today()}`);
  } catch (err) {
    logger.error({ err }, 'Export vehicleCard error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}

// ─── Export 12 : RGPD données personnelles ───────────────────────────────────

export async function userDataExport(req: Request, res: Response) {
  try {
    const currentUser = (req as any).user;

    const [user, reservations, trips, incidents, fuelLogs, cleaningAssignments] = await Promise.all([
      prisma.user.findUnique({
        where: { id: currentUser.id },
        include: {
          userPoles:    { include: { pole:    { select: { name: true } } } },
          userServices: { include: { service: { select: { name: true } } } },
        },
      }),
      prisma.reservation.findMany({
        where: { userId: currentUser.id },
        include: {
          vehicle:    { select: { brand: true, model: true, plateNumber: true } },
          passengers: { include: { user: { select: { name: true } } } },
        },
        orderBy: { startTime: 'desc' },
      }),
      prisma.tripLog.findMany({
        where: { userId: currentUser.id },
        include: { vehicle: { select: { brand: true, model: true, plateNumber: true } } },
        orderBy: { startTime: 'desc' },
      }),
      prisma.incident.findMany({
        where: { userId: currentUser.id },
        include: { vehicle: { select: { brand: true, model: true, plateNumber: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fuelLog.findMany({
        where: { userId: currentUser.id },
        include: { vehicle: { select: { brand: true, model: true, plateNumber: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.cleaningAssignment.findMany({
        where: { userId: currentUser.id },
        include: {
          schedule: {
            select: { weekStart: true, isDone: true },
            include: { vehicle: { select: { brand: true, model: true, plateNumber: true } } } as any,
          },
        },
      }),
    ]);

    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    auditExport(req, 'Export données personnelles RGPD (Art.15)', 'json');
    const json = await generateUserDataJSON(user, reservations, trips, incidents, fuelLogs, cleaningAssignments);
    const fname = `mes_donnees_personnelles_${today()}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(json);
  } catch (err) {
    logger.error({ err }, 'Export userData error:');
    res.status(500).json({ error: "Erreur lors de la génération de l'export" });
  }
}
