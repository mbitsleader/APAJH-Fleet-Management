import { Router } from 'express';
import { createIncident, getVehicleIncidents, resolveIncident, getAllIncidents } from '../controllers/incidentController';

const router = Router();

router.post('/', createIncident);
router.get('/', getAllIncidents);
router.get('/vehicle/:vehicleId', getVehicleIncidents);
router.patch('/:id/resolve', resolveIncident);

export default router;
