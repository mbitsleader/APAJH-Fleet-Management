import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DIAGNOSTIC DATA ---');
  
  const vehiclesCount = await prisma.vehicle.count();
  console.log(`Vehicles: ${vehiclesCount}`);
  
  const usersCount = await prisma.user.count();
  console.log(`Users: ${usersCount}`);
  
  const resCount = await prisma.reservation.count();
  console.log(`Reservations: ${resCount}`);
  
  const incCount = await prisma.incident.count();
  console.log(`Incidents: ${incCount}`);
  
  if (vehiclesCount === 0) {
    console.warn('WARNING: No vehicles found in database! The dashboard stats will stay at 0.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
