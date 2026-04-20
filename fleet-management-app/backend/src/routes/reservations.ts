import { Router } from 'express';
import { createReservation, getReservations, getVehicleReservations, updateReservation, deleteReservation } from '../controllers/reservationController';

const router = Router();

router.post('/', createReservation);
router.get('/', getReservations);
router.get('/vehicle/:id', getVehicleReservations);
router.put('/:id', updateReservation);
router.delete('/:id', deleteReservation);

export default router;
