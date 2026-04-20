import request from 'supertest';
import app from '../src/app';
import prisma from '../src/services/prisma';
import { getAuthCookies, createTestVehicle } from './testUtils';

describe('Trips API', () => {
  let cookies: string | string[] | undefined;
  let vehicleId: string;
  let userId: string;

  beforeEach(async () => {
    const auth = await getAuthCookies('trip.test@apajh.org');
    cookies = auth.cookies;
    userId = auth.user.id;
    const vehicle = await createTestVehicle('TRIP-TEST-01', auth.serviceId, { assignedUserId: userId });
    vehicleId = vehicle.id;
  });

  afterEach(async () => {
    await prisma.tripLog.deleteMany({ where: { vehicleId } });
    await prisma.reservation.deleteMany({ where: { vehicleId } });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('should start a trip successfully', async () => {
    const response = await request(app)
      .post('/api/trips/start')
      .set('Cookie', cookies as string[])
      .send({
        vehicleId,
        startMileage: 1050
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.startMileage).toBe(1050);

    // Check vehicle status changed
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    expect(vehicle?.status).toBe('IN_USE');
  });

  it('should end a trip and update mileage', async () => {
    // 1. Start
    const startRes = await request(app)
      .post('/api/trips/start')
      .set('Cookie', cookies as string[])
      .send({ vehicleId, startMileage: 1000 });
    
    const tripId = startRes.body.id;

    // 2. End
    const response = await request(app)
      .post('/api/trips/end')
      .set('Cookie', cookies as string[])
      .send({
        tripId,
        endMileage: 1100,
        notes: 'Voyage terminé'
      });

    expect(response.status).toBe(200);
    expect(response.body.endMileage).toBe(1100);

    // Check vehicle status reverted to AVAILABLE
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    expect(vehicle?.status).toBe('AVAILABLE');
    expect(vehicle?.currentMileage).toBe(1100);
  });

  it('should fail if end mileage is less than start mileage', async () => {
    const startRes = await request(app)
      .post('/api/trips/start')
      .set('Cookie', cookies as string[])
      .send({ vehicleId, startMileage: 1000 });
    
    const tripId = startRes.body.id;

    const response = await request(app)
      .post('/api/trips/end')
      .set('Cookie', cookies as string[])
      .send({
        tripId,
        endMileage: 900 // Less than 1000
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('inférieur au kilométrage de début');
  });
});
