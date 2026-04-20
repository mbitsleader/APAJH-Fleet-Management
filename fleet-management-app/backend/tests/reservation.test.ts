import request from 'supertest';
import app from '../src/app';
import prisma from '../src/services/prisma';
import { getAuthCookies, createTestVehicle } from './testUtils';

describe('Reservations API', () => {
  let cookies: string | string[] | undefined;
  let vehicleId: string;
  let userId: string;

  beforeAll(async () => {
    const auth = await getAuthCookies('res.test@apajh.org');
    cookies = auth.cookies;
    userId = auth.user.id;
    const vehicle = await createTestVehicle('RES-TEST-01', auth.serviceId, { assignedUserId: userId });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { vehicleId } });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('should create a new reservation', async () => {
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 1); // Tomorrow
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 2);

    const response = await request(app)
      .post('/api/reservations')
      .set('Cookie', cookies as string[])
      .send({
        vehicleId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        destination: 'Test Destination'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.vehicleId).toBe(vehicleId);
  });

  it('should fail if dates overlap with an existing reservation', async () => {
    // This overlaps with the one created above
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 1); 
    startTime.setHours(startTime.getHours() + 1); // Starts in the middle of previous
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 2);

    const response = await request(app)
      .post('/api/reservations')
      .set('Cookie', cookies as string[])
      .send({
        vehicleId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        destination: 'Overlap Test'
      });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('déjà réservé');
  });

  it('should fail if end time is before start time', async () => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() - 3600000); // 1 hour before

    const response = await request(app)
      .post('/api/reservations')
      .set('Cookie', cookies as string[])
      .send({
        vehicleId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        destination: 'Invalid Dates'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('La date de fin doit être après la date de début.');
  });
});
