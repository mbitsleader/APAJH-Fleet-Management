import { Router } from 'express';
import { getNotificationSummary } from '../controllers/notificationController';

const router = Router();

router.get('/summary', getNotificationSummary);

export default router;
