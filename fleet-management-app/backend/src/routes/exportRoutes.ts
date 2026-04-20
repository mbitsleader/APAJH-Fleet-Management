import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import * as exportController from '../controllers/exportController';

const router = Router();

const exportRoles = ['ADMIN', 'DIRECTEUR', 'MANAGER'];
const seniorRoles = ['ADMIN', 'DIRECTEUR'];

// Exports bailleurs / activité
router.get('/activity-report',     authenticate, requireRole(exportRoles),  exportController.activityReport);
router.get('/cost-summary',        authenticate, requireRole(seniorRoles),  exportController.costSummary);
router.get('/utilization',         authenticate, requireRole(exportRoles),  exportController.utilization);
router.get('/trip-journal',        authenticate, requireRole(exportRoles),  exportController.tripJournal);

// Exports opérationnels
router.get('/weekly-planning',     authenticate, requireRole(exportRoles),  exportController.weeklyPlanning);
router.get('/cleaning-planning',   authenticate, requireRole(exportRoles),  exportController.cleaningPlanning);
router.get('/fuel-history',        authenticate, requireRole(exportRoles),  exportController.fuelHistory);
router.get('/incident-report',     authenticate, requireRole(exportRoles),  exportController.incidentReport);
router.get('/maintenance-history', authenticate, requireRole(exportRoles),  exportController.maintenanceHistory);

// Documents réglementaires
router.get('/document-schedule',   authenticate, requireRole(exportRoles),  exportController.documentSchedule);
router.get('/vehicle-card/:id',    authenticate, requireRole(exportRoles),  exportController.vehicleCard);

// RGPD — accessible à tous les utilisateurs connectés
router.get('/user-data',           authenticate, exportController.userDataExport);

export default router;
