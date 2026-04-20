import request from 'supertest';
import app from '../src/app';
import prisma from '../src/services/prisma';
import bcrypt from 'bcrypt';

export async function getAuthCookies(email: string = 'test.user@apajh.org', role: 'ADMIN' | 'DIRECTEUR' | 'MANAGER' | 'PROFESSIONNEL' = 'PROFESSIONNEL') {
  const password = 'Password@123!';
  const name = 'Test User';
  
  // 1. Create a test Pole and Service
  const pole = await prisma.pole.upsert({
    where: { name: 'Test Pole' },
    update: {},
    create: { name: 'Test Pole' }
  });

  const service = await prisma.service.upsert({
    where: { name: 'Test Service' },
    update: {},
    create: { name: 'Test Service', poleId: pole.id }
  });

  // 2. Cleanup and create user
  await prisma.user.deleteMany({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role,
      entraId: `test-id-${Math.random()}`,
      userPoles: {
        create: { poleId: pole.id }
      }
    }
  });

  const response = await request(app)
    .post('/api/users/login')
    .send({ email, password });

  return {
    cookies: response.headers['set-cookie'],
    user,
    serviceId: service.id
  };
}

export async function createTestVehicle(plate: string = 'TEST-123-AA', serviceId?: string, extra: any = {}) {
  await prisma.vehicle.deleteMany({ where: { plateNumber: plate } });
  
  let finalServiceId = serviceId;
  if (!finalServiceId) {
    const service = await prisma.service.findFirst({ where: { name: 'Test Service' } });
    finalServiceId = service?.id;
  }

  return await prisma.vehicle.create({
    data: {
      plateNumber: plate,
      brand: 'TestBrand',
      model: 'TestModel',
      currentMileage: 1000,
      status: 'AVAILABLE',
      serviceId: finalServiceId,
      ...extra
    }
  });
}
