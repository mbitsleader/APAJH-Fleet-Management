import { Router } from 'express';
import { startTrip, endTrip, forceEndTrip, getOpenTrips, getVehicleHistory } from '../controllers/tripController';

const router = Router();

router.post('/start', startTrip);
router.post('/end', endTrip);
router.post('/force-end', forceEndTrip);
router.get('/open', getOpenTrips);
router.get('/vehicle/:vehicleId', getVehicleHistory);

export default router;
