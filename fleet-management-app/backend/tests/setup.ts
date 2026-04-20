import dotenv from 'dotenv';
import prisma from '../src/services/prisma';

dotenv.config({ path: '.env.test' });

// Global setup before all tests
beforeAll(async () => {
  // logic to connect to DB
});

// Global teardown after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
