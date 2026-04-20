import { PrismaClient, Role, VehicleStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

// Configuration de l'adaptateur PG pour correspondre au service de l'app
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter: adapter as any });

/**
 * Monte Carlo Simulation - 2000 Cycles
 * Simule des interactions aléatoires pour tester la robustesse des données.
 */
async function runMonteCarlo() {
  console.log('🚀 Démarrage de la simulation Monte Carlo (2000 cycles)...');
  
  const users = await prisma.user.findMany();
  const vehicles = await prisma.vehicle.findMany();
  
  if (users.length === 0 || vehicles.length === 0) {
    console.error('❌ Erreur : Il faut des utilisateurs et des véhicules pour simuler.');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  let conflictCount = 0;

  for (let i = 1; i <= 2000; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
    const actionType = Math.floor(Math.random() * 4); // 0: Réservation, 1: Plein, 2: Incident, 3: Trajet

    try {
      if (actionType === 0) {
        // Simuler une réservation
        const start = new Date();
        start.setHours(start.getHours() + Math.floor(Math.random() * 48));
        const end = new Date(start);
        end.setHours(end.getHours() + 2);

        // Vérifier conflit (simplifié pour la simulation)
        const conflict = await prisma.reservation.findFirst({
          where: {
            vehicleId: vehicle.id,
            OR: [
              { startTime: { lte: start }, endTime: { gte: start } },
              { startTime: { lte: end }, endTime: { gte: end } }
            ]
          }
        });

        if (conflict) {
          conflictCount++;
        } else {
          await prisma.reservation.create({
            data: {
              userId: user.id,
              vehicleId: vehicle.id,
              startTime: start,
              endTime: end,
              destination: 'Destination simulée'
            }
          });
          successCount++;
        }
      } else if (actionType === 1) {
        // Simuler un relevé kilométrique
        const latestMileage = await prisma.fuelLog.findFirst({
          where: { vehicleId: vehicle.id },
          orderBy: { mileageAtFill: 'desc' }
        });
        
        const currentKm = latestMileage?.mileageAtFill || vehicle.currentMileage;
        const newKm = currentKm + Math.floor(Math.random() * 500);

        await prisma.fuelLog.create({
          data: {
            userId: user.id,
            vehicleId: vehicle.id,
            mileageAtFill: newKm,
            cost: Math.floor(Math.random() * 100)
          }
        });
        
        // Update vehicle
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { currentMileage: newKm }
        });
        successCount++;
      } else if (actionType === 2) {
        // Simuler un incident
        await prisma.incident.create({
          data: {
            userId: user.id,
            vehicleId: vehicle.id,
            description: `Incident simulé cycle ${i}`,
            severity: 'MINOR'
          }
        });
        successCount++;
      } else {
        // Simuler un log de trajet simple
        await prisma.tripLog.create({
          data: {
            userId: user.id,
            vehicleId: vehicle.id,
            startMileage: vehicle.currentMileage,
            endMileage: vehicle.currentMileage + 10,
            destination: 'Trajet rapide simulation'
          }
        });
        successCount++;
      }
    } catch (err) {
      errorCount++;
      console.error(`❌ Erreur au cycle ${i}:`, err);
    }

    if (i % 500 === 0) {
      console.log(`📊 Progression : ${i}/2000 cycles terminés...`);
    }
  }

  console.log('\n--- Bilan Monte Carlo ---');
  console.log(`✅ Succès : ${successCount}`);
  console.log(`⚔️ Conflits évités : ${conflictCount}`);
  console.log(`❌ Erreurs : ${errorCount}`);
  console.log('--------------------------\n');
}

runMonteCarlo()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
