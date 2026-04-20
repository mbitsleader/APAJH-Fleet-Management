import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter: adapter as any });

async function main() {
  const dumpPath = path.join(__dirname, '..', '..', '..', 'database', 'db_dump_v4.json');
  console.log(`Reading dump from ${dumpPath}...`);
  const data = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

  console.log('Restoring Poles and Services...');
  for (const pole of data.poles) {
    const { services, ...poleData } = pole;
    await prisma.pole.upsert({
      where: { id: pole.id },
      update: poleData,
      create: poleData,
    });

    if (services) {
      for (const service of services) {
        await prisma.service.upsert({
          where: { id: service.id },
          update: service,
          create: service,
        });
      }
    }
  }

  console.log('Restoring Users...');
  for (const user of data.users) {
    const { userPoles, ...userData } = user;
    // Remove id from userData to let Prisma use email for upserting
    const { id, ...dataToUpsert } = userData;
    await prisma.user.upsert({
      where: { email: user.email },
      update: dataToUpsert,
      create: userData,
    });

    if (userPoles) {
        // We need the resolved userId from the database
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (dbUser) {
            for (const up of userPoles) {
                await prisma.userPole.upsert({
                    where: { userId_poleId: { userId: dbUser.id, poleId: up.poleId } },
                    update: {},
                    create: { userId: dbUser.id, poleId: up.poleId }
                });
            }
        }
    }
  }

  console.log('Restoring Vehicles...');
  for (const vehicle of data.vehicles) {
    const { service, ...vehicleData } = vehicle;
    // Remove id from vehicleData to let Prisma use plateNumber for upserting
    const { id, ...dataToUpsert } = vehicleData;
    await prisma.vehicle.upsert({
      where: { plateNumber: vehicle.plateNumber },
      update: dataToUpsert,
      create: vehicleData,
    });
  }

  console.log('Restoration completed successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
