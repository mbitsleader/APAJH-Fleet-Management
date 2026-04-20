import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter: adapter as any });

async function main() {
  console.log('Inderting test data...');

  // 1. Create Vehicles
  const v1 = await prisma.vehicle.upsert({
    where: { plateNumber: 'AA-123-BB' },
    update: { 
      imageUrl: '/vehicles/clio.png',
      currentMileage: 12560 
    },
    create: {
      plateNumber: 'AA-123-BB',
      brand: 'Renault',
      model: 'Clio V',
      status: 'AVAILABLE',
      category: 'Citadine',
      currentMileage: 12560,
      fuelType: 'Diesel',
      imageUrl: '/vehicles/clio.png',
    },
  });

  const v2 = await prisma.vehicle.upsert({
    where: { plateNumber: 'CC-456-DD' },
    update: { imageUrl: '/vehicles/208.png' },
    create: {
      plateNumber: 'CC-456-DD',
      brand: 'Peugeot',
      model: '208',
      status: 'AVAILABLE',
      category: 'Citadine',
      currentMileage: 8900,
      fuelType: 'Essence',
      imageUrl: '/vehicles/208.png',
    },
  });

  const v3 = await prisma.vehicle.upsert({
    where: { plateNumber: 'EE-789-FF' },
    update: { imageUrl: '/vehicles/golf.png' },
    create: {
      plateNumber: 'EE-789-FF',
      brand: 'Volkswagen',
      model: 'Golf 8',
      status: 'MAINTENANCE',
      category: 'Compacte',
      currentMileage: 45000,
      fuelType: 'Hybride',
      imageUrl: '/vehicles/golf.png',
    },
  });

  // Adding the Dacia Sandero requested by the user
  const v4 = await prisma.vehicle.upsert({
    where: { plateNumber: 'GG-101-HH' },
    update: { imageUrl: '/vehicles/sandero.png' },
    create: {
      plateNumber: 'GG-101-HH',
      brand: 'Dacia',
      model: 'Sandero',
      status: 'AVAILABLE',
      category: 'Citadine',
      currentMileage: 1500,
      fuelType: 'Essence',
      imageUrl: '/vehicles/sandero.png',
    },
  });

  // 5. Create a replacement vehicle
  const v5 = await prisma.vehicle.upsert({
    where: { plateNumber: 'JJ-202-KK' },
    update: { imageUrl: '/vehicles/twingo.png', type: 'REPLACEMENT' },
    create: {
      plateNumber: 'JJ-202-KK',
      brand: 'Renault',
      model: 'Twingo',
      status: 'AVAILABLE',
      category: 'Citadine',
      currentMileage: 4500,
      fuelType: 'Essence',
      imageUrl: '/vehicles/twingo.png',
      type: 'REPLACEMENT'
    },
  });

  // 2. Create a test User for reservations
  const testUser = await prisma.user.upsert({
    where: { email: 'test.user@apajh.org' },
    update: {},
    create: {
      entraId: 'test-entra-id-001',
      email: 'test.user@apajh.org',
      name: 'Utilisateur de Test',
      role: 'PROFESSIONNEL',
      department: 'Services Généraux',
    },
  });

  console.log({ v1, v2, v3, v4, v5, testUser });
  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
