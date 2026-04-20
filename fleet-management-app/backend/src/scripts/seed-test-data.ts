/**
 * Seed script — 10 test users + 20 vehicles
 * Run: npx ts-node src/scripts/seed-test-data.ts
 */
import prisma from '../services/prisma';
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding test data...');

  // ── Fetch existing poles and services ──────────────────────────
  const poles = await prisma.pole.findMany({ include: { services: true } });
  if (poles.length === 0) {
    console.error('❌ No poles found. Run the app first to seed poles/services.');
    process.exit(1);
  }

  const adulte = poles.find(p => p.name === 'Adulte');
  const enfance = poles.find(p => p.name === 'Enfance');
  if (!adulte || !enfance) {
    console.error('❌ Missing "Adulte" or "Enfance" pole. Check your database.');
    process.exit(1);
  }

  const adultServices = adulte.services;
  const enfanceServices = enfance.services;

  if (adultServices.length === 0 || enfanceServices.length === 0) {
    console.error('❌ Poles have no services. Run the app first to seed services.');
    process.exit(1);
  }

  // ── Users ───────────────────────────────────────────────────────
  const usersData = [
    { email: 'admin.test@apajh.re',         name: 'Admin Test',           role: 'ADMIN',         password: 'Admin@1234!',       poles: [adulte.id, enfance.id], services: [] },
    { email: 'directeur.test@apajh.re',     name: 'Directeur Test',       role: 'DIRECTEUR',     password: 'Directeur@1234!',   poles: [adulte.id, enfance.id], services: [] },
    { email: 'manager.adulte@apajh.re',     name: 'Manager Adulte',       role: 'MANAGER',       password: 'Manager@1234!',     poles: [adulte.id],             services: adultServices.slice(0, 2).map(s => s.id) },
    { email: 'manager.enfance@apajh.re',    name: 'Manager Enfance',      role: 'MANAGER',       password: 'Manager@1234!',     poles: [enfance.id],            services: enfanceServices.slice(0, 2).map(s => s.id) },
    { email: 'pro1.adulte@apajh.re',        name: 'Pro Adulte 1',         role: 'PROFESSIONNEL', password: 'Pro@12345!',        poles: [adulte.id],             services: [adultServices[0]?.id].filter(Boolean) },
    { email: 'pro2.adulte@apajh.re',        name: 'Pro Adulte 2',         role: 'PROFESSIONNEL', password: 'Pro@12345!',        poles: [adulte.id],             services: [adultServices[1]?.id ?? adultServices[0]?.id].filter(Boolean) },
    { email: 'pro3.enfance@apajh.re',       name: 'Pro Enfance 1',        role: 'PROFESSIONNEL', password: 'Pro@12345!',        poles: [enfance.id],            services: [enfanceServices[0]?.id].filter(Boolean) },
    { email: 'pro4.enfance@apajh.re',       name: 'Pro Enfance 2',        role: 'PROFESSIONNEL', password: 'Pro@12345!',        poles: [enfance.id],            services: [enfanceServices[1]?.id ?? enfanceServices[0]?.id].filter(Boolean) },
    { email: 'pro5.mixte@apajh.re',         name: 'Pro Multi-Pôle 1',     role: 'PROFESSIONNEL', password: 'Pro@12345!',        poles: [adulte.id, enfance.id], services: [adultServices[0]?.id, enfanceServices[0]?.id].filter(Boolean) },
    { email: 'pro6.mixte@apajh.re',         name: 'Pro Multi-Pôle 2',     role: 'PROFESSIONNEL', password: 'Pro@12345!',        poles: [adulte.id, enfance.id], services: [adultServices[2]?.id ?? adultServices[0]?.id, enfanceServices[2]?.id ?? enfanceServices[0]?.id].filter(Boolean) },
  ];

  const createdUsers: { id: string; email: string; role: string }[] = [];

  for (const u of usersData) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`  ⏭  User ${u.email} already exists — skipping`);
      createdUsers.push({ id: existing.id, email: existing.email, role: existing.role });
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        entraId: `seed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        email: u.email,
        name: u.name,
        role: u.role as any,
        passwordHash,
        userPoles: u.poles.length > 0 ? { create: u.poles.map(poleId => ({ poleId })) } : undefined,
        userServices: u.services.length > 0 ? { create: u.services.map(serviceId => ({ serviceId })) } : undefined,
      },
    });
    console.log(`  ✅ Created ${u.role.padEnd(14)} ${u.email}`);
    createdUsers.push({ id: user.id, email: user.email, role: user.role });
  }

  // ── Vehicles ────────────────────────────────────────────────────
  const vehicleData = [
    // Adulte services (10 vehicles)
    { plate: 'RA-001-AA', brand: 'Renault', model: 'Clio', km: 12000,  status: 'AVAILABLE',   type: 'PERMANENT',    serviceId: adultServices[0]?.id, fuelType: 'Essence' },
    { plate: 'RA-002-AA', brand: 'Peugeot', model: '208',  km: 34500,  status: 'AVAILABLE',   type: 'PERMANENT',    serviceId: adultServices[0]?.id, fuelType: 'Diesel' },
    { plate: 'RA-003-AA', brand: 'Citroën', model: 'C3',   km: 78000,  status: 'MAINTENANCE', type: 'PERMANENT',    serviceId: adultServices[1]?.id ?? adultServices[0]?.id, fuelType: 'Essence' },
    { plate: 'RA-004-AA', brand: 'Ford',    model: 'Focus', km: 52300,  status: 'AVAILABLE',   type: 'PERMANENT',    serviceId: adultServices[1]?.id ?? adultServices[0]?.id, fuelType: 'Diesel' },
    { plate: 'RA-005-AA', brand: 'Toyota',  model: 'Yaris', km: 9800,   status: 'AVAILABLE',   type: 'REPLACEMENT',  serviceId: adultServices[2]?.id ?? adultServices[0]?.id, fuelType: 'Hybride' },
    { plate: 'RA-006-AA', brand: 'Renault', model: 'Kangoo',km: 145000, status: 'AVAILABLE',   type: 'PERMANENT',    serviceId: adultServices[2]?.id ?? adultServices[0]?.id, fuelType: 'Diesel' },
    { plate: 'RA-007-AA', brand: 'Peugeot', model: 'Partner',km: 88200, status: 'IN_USE',      type: 'PERMANENT',    serviceId: adultServices[3]?.id ?? adultServices[0]?.id, fuelType: 'Diesel' },
    { plate: 'RA-008-AA', brand: 'Citroën', model: 'Berlingo',km:67000, status: 'AVAILABLE',   type: 'PERMANENT',    serviceId: adultServices[3]?.id ?? adultServices[0]?.id, fuelType: 'Diesel' },
    { plate: 'RA-009-AA', brand: 'Ford',    model: 'Transit',km: 180000,status: 'BLOCKED',     type: 'PERMANENT',    serviceId: adultServices[4]?.id ?? adultServices[0]?.id, fuelType: 'Diesel' },
    { plate: 'RA-010-AA', brand: 'Toyota',  model: 'Proace', km: 23000, status: 'AVAILABLE',   type: 'REPLACEMENT',  serviceId: adultServices[4]?.id ?? adultServices[0]?.id, fuelType: 'Diesel' },
    // Enfance services (10 vehicles)
    { plate: 'RE-001-AA', brand: 'Renault', model: 'Zoé',   km: 5000,   status: 'AVAILABLE',   type: 'PERMANENT',    serviceId: enfanceServices[0]?.id, fuelType: 'Électrique' },
    { plate: 'RE-002-AA', brand: 'Peugeot', model: 'e-208', km: 14300,  status: 'AVAILABLE',   type: 'PERMANENT',    serviceId: enfanceServices[0]?.id, fuelType: 'Électrique' },
    { plate: 'RE-003-AA', brand: 'Citroën', model: 'ë-C3',  km: 7200,   status: 'AVAILABLE',   type: 'REPLACEMENT',  serviceId: enfanceServices[1]?.id ?? enfanceServices[0]?.id, fuelType: 'Électrique' },
    { plate: 'RE-004-AA', brand: 'Ford',    model: 'Puma',   km: 31000,  status: 'AVAILABLE',   type: 'PERMANENT',    serviceId: enfanceServices[1]?.id ?? enfanceServices[0]?.id, fuelType: 'Hybride' },
    { plate: 'RE-005-AA', brand: 'Toyota',  model: 'Corolla',km: 48000, status: 'IN_USE',      type: 'PERMANENT',    serviceId: enfanceServices[2]?.id ?? enfanceServices[0]?.id, fuelType: 'Hybride' },
    { plate: 'RE-006-AA', brand: 'Renault', model: 'Trafic', km: 112000,status: 'AVAILABLE',   type: 'PERMANENT',    serviceId: enfanceServices[2]?.id ?? enfanceServices[0]?.id, fuelType: 'Diesel' },
    { plate: 'RE-007-AA', brand: 'Peugeot', model: 'Traveller',km:91000,status: 'AVAILABLE',   type: 'PERMANENT',    serviceId: enfanceServices[3]?.id ?? enfanceServices[0]?.id, fuelType: 'Diesel' },
    { plate: 'RE-008-AA', brand: 'Citroën', model: 'Jumpy', km: 76500,  status: 'IN_USE',      type: 'PERMANENT',    serviceId: enfanceServices[3]?.id ?? enfanceServices[0]?.id, fuelType: 'Diesel' },
    { plate: 'RE-009-AA', brand: 'Ford',    model: 'Galaxy', km: 138000,status: 'MAINTENANCE', type: 'PERMANENT',    serviceId: enfanceServices[4]?.id ?? enfanceServices[0]?.id, fuelType: 'Essence' },
    { plate: 'RE-010-AA', brand: 'Toyota',  model: 'RAV4',   km: 58700, status: 'AVAILABLE',   type: 'REPLACEMENT',  serviceId: enfanceServices[4]?.id ?? enfanceServices[0]?.id, fuelType: 'Hybride' },
  ];

  let vehicleCount = 0;
  for (const v of vehicleData) {
    const existing = await prisma.vehicle.findUnique({ where: { plateNumber: v.plate } });
    if (existing) {
      console.log(`  ⏭  Vehicle ${v.plate} already exists — skipping`);
      continue;
    }
    await prisma.vehicle.create({
      data: {
        plateNumber: v.plate,
        brand: v.brand,
        model: v.model,
        currentMileage: v.km,
        status: v.status as any,
        type: v.type as any,
        fuelType: v.fuelType,
        serviceId: v.serviceId ?? null,
      },
    });
    vehicleCount++;
    console.log(`  ✅ Created ${v.status.padEnd(12)} ${v.brand} ${v.model} (${v.plate})`);
  }

  console.log('\n✅ Seed complete!');
  console.log(`   Users created/skipped: ${usersData.length}`);
  console.log(`   Vehicles created: ${vehicleCount}`);
  console.log('\n📋 Test credentials:');
  for (const u of usersData) {
    console.log(`   ${u.role.padEnd(14)} ${u.email.padEnd(35)} ${u.password}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => (prisma as any).$disconnect?.());
