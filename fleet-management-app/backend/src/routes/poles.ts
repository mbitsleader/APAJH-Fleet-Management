import { Router } from 'express';
import { getPoles, createPole, updatePole, deletePole } from '../controllers/poleController';
import { requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', getPoles);
router.post('/', requirePermission('manageSettings'), createPole);
router.patch('/:id', requirePermission('manageSettings'), updatePole);
router.delete('/:id', requirePermission('manageSettings'), deletePole);

export default router;
