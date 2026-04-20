import request from 'supertest';
import app from '../src/app';
import prisma from '../src/services/prisma';
import { getAuthCookies, createTestVehicle } from './testUtils';

describe('Notification API', () => {
  let adminToken: string;
  let adminUser: any;
  let vehicle1: any;
  let vehicle2: any;

  beforeAll(async () => {
    // Clean database (some tables might have FK constraints, so order matters)
    await prisma.maintenanceAlert.deleteMany();
    await prisma.cleaningSchedule.deleteMany();
    await prisma.tripLog.deleteMany();
    await prisma.fuelLog.deleteMany();
    await prisma.incident.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.user.deleteMany();

    // Setup admin user and get cookies
    const auth = await getAuthCookies('admin@test.org', 'ADMIN');
    adminUser = auth.user;
    adminToken = auth.cookies[0].split(';')[0].split('=')[1];

    // Create vehicles
    vehicle1 = await createTestVehicle('ABC-123', auth.serviceId);
    vehicle2 = await createTestVehicle('DEF-456', auth.serviceId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should return 0 alerts when there are no issues', async () => {
    const res = await request(app)
      .get('/api/notifications/summary')
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.details.cleanings).toBe(0);
    expect(res.body.details.maintenance).toBe(0);
    expect(res.body.details.technicalInspection).toBe(0);
    expect(res.body.details.blocked).toBe(0);
  });

  it('should count technical inspection alerts', async () => {
    const today = new Date();
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(today.getDate() + 15);

    await prisma.vehicle.update({
      where: { id: vehicle1.id },
      data: { nextTechnicalInspection: fifteenDaysFromNow }
    });

    const res = await request(app)
      .get('/api/notifications/summary')
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.details.technicalInspection).toBe(1);
    expect(res.body.count).toBe(1);
  });

  it('should count maintenance alerts', async () => {
    await prisma.maintenanceAlert.create({
      data: {
        vehicleId: vehicle2.id,
        type: 'Oil Change',
        expiryDate: new Date(),
        isResolved: false
      }
    });

    const res = await request(app)
      .get('/api/notifications/summary')
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.details.maintenance).toBe(1);
    // 1 CT (from previous test) + 1 Maintenance
    expect(res.body.count).toBe(2);
  });

  it('should count blocked vehicles', async () => {
    await prisma.vehicle.update({
      where: { id: vehicle1.id },
      data: { status: 'BLOCKED' }
    });

    const res = await request(app)
      .get('/api/notifications/summary')
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.details.blocked).toBe(1);
    // 1 CT + 1 Maintenance + 1 Blocked
    expect(res.body.count).toBe(3);
  });

  it('should count pending cleanings', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await prisma.cleaningSchedule.create({
      data: {
        vehicleId: vehicle1.id,
        weekStart: today,
        isDone: false
      }
    });

    const res = await request(app)
      .get('/api/notifications/summary')
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.details.cleanings).toBe(1);
    // 1 CT + 1 Maintenance + 1 Blocked + 1 Cleaning
    expect(res.body.count).toBe(4);
  });
});
