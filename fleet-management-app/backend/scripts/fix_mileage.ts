import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.vehicle.updateMany({
    where: { plateNumber: 'AA-123-BB' },
    data: { currentMileage: 12560 }
  });
  console.log('Database cleaned: Renault Clio V reset to 12560 km');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
