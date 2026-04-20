import { Router } from 'express';
import {
  getCleaningSchedule,
  upsertCleaningSchedule,
  markCleaningDone,
  selfCompleteClean,
  deleteCleaningSchedule,
  createCleaningLog,
} from '../controllers/cleaningController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

// GET open to all authenticated users (filter applied per role in controller)
router.get('/', getCleaningSchedule);
router.post('/log', authenticate, createCleaningLog);
router.post('/schedule', requirePermission('manageCleaningSchedule'), upsertCleaningSchedule);
router.patch('/schedule/:id/done', requirePermission('manageCleaningSchedule'), markCleaningDone);
// Self-declare: any authenticated user can mark themselves as having done a cleaning
router.patch('/schedule/:id/self-complete', selfCompleteClean);
router.delete('/schedule/:id', requirePermission('deleteCleaningSchedule'), deleteCleaningSchedule);

export default router;
