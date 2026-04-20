import { Router } from 'express';
import { createFuelLog, getAllFuelLogs, getVehicleFuelLogs, getMonthlyStats } from '../controllers/fuelController';

const router = Router();

router.post('/', createFuelLog);
router.get('/all', getAllFuelLogs);
router.get('/stats', getMonthlyStats);
router.get('/vehicle/:vehicleId', getVehicleFuelLogs);

export default router;
