import { Router } from 'express';
import { getServices, createService, updateService, deleteService } from '../controllers/serviceController';
import { requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', getServices);
router.post('/', requirePermission('manageSettings'), createService);
router.patch('/:id', requirePermission('manageSettings'), updateService);
router.delete('/:id', requirePermission('manageSettings'), deleteService);

export default router;
