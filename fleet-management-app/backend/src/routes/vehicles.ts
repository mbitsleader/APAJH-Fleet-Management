import { Router } from 'express';
import * as vehicleController from '../controllers/vehicleController';
import { requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', vehicleController.getVehicles);
router.get('/:id', vehicleController.getVehicleById);
router.post('/', requirePermission('manageVehicles'), vehicleController.createVehicle);
router.put('/:id', requirePermission('manageVehicles'), vehicleController.updateVehicle);
router.delete('/:id', requirePermission('manageVehicles'), vehicleController.deleteVehicle);

export default router;
