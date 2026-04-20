/**
 * Fleet Management API - Comprehensive Stress Test
 * Runs ~1000 operations across all endpoints
 * Usage: npx ts-node stress_test.ts
 */

const BASE_URL = 'http://127.0.0.1:4000/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpResult {
  op: string;
  status: number;
  ok: boolean;
  durationMs: number;
  errorBody?: string;
}

interface ErrorBucket {
  op: string;
  status: number;
  body: string;
  count: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

const results: OpResult[] = [];
const createdVehicleIds: string[] = [];
const createdUserIds: string[] = [];
const createdReservationIds: string[] = [];
const createdTripIds: string[] = [];
const createdIncidentIds: string[] = [];
const createdFuelLogIds: string[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiCall(
  op: string,
  method: string,
  path: string,
  body?: object
): Promise<{ status: number; data: any }> {
  const start = Date.now();
  let status = 0;
  let data: any = null;
  let errorBody: string | undefined;

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    status = res.status;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    const ok = status >= 200 && status < 300;
    const durationMs = Date.now() - start;

    if (!ok) {
      errorBody = typeof data === 'string' ? data : JSON.stringify(data);
    }

    results.push({ op, status, ok, durationMs, errorBody });
    return { status, data };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    errorBody = err?.message ?? String(err);
    results.push({ op, status: 0, ok: false, durationMs, errorBody });
    return { status: 0, data: null };
  }
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function uniquePlate(i: number): string {
  return `ST-${Date.now()}-${i}`.slice(0, 20);
}

function uniqueEmail(i: number): string {
  return `stress_user_${Date.now()}_${i}@test.local`;
}

function futureDate(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
}

// ─── Phase 1: Create Vehicles (100 vehicles) ──────────────────────────────────

async function phase_createVehicles(count: number) {
  console.log(`\n[Phase 1] Creating ${count} vehicles...`);
  const brands = ['Renault', 'Peugeot', 'Citroën', 'Toyota', 'Ford', 'BMW', 'Audi', 'Volkswagen'];
  const models = ['Clio', '308', 'C3', 'Yaris', 'Focus', 'Serie3', 'A4', 'Golf'];
  const fuelTypes = ['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID'];
  const categories = ['SEDAN', 'SUV', 'VAN', 'TRUCK'];
  const types = ['PERMANENT', 'POOL'];

  for (let i = 0; i < count; i++) {
    const { status, data } = await apiCall('CREATE_VEHICLE', 'POST', '/vehicles', {
      brand: brands[i % brands.length],
      model: `${models[i % models.length]}-${i}`,
      plateNumber: uniquePlate(i),
      category: categories[i % categories.length],
      fuelType: fuelTypes[i % fuelTypes.length],
      status: 'AVAILABLE',
      currentMileage: rand(0, 150000),
      type: types[i % types.length],
    });
    if (status === 201 && data?.id) {
      createdVehicleIds.push(data.id);
    }
  }
  console.log(`  -> Created ${createdVehicleIds.length} vehicles so far.`);
}

// ─── Phase 2: Create Users (100 users) ───────────────────────────────────────

async function phase_createUsers(count: number) {
  console.log(`\n[Phase 2] Creating ${count} users...`);
  const roles = ['PROFESSIONNEL', 'MANAGER'];
  const departments = ['IT', 'RH', 'Finance', 'Logistique', 'Commercial'];

  for (let i = 0; i < count; i++) {
    const ts = Date.now();
    const { status, data } = await apiCall('CREATE_USER', 'POST', '/users', {
      entraId: `stress-entra-${ts}-${i}`,
      email: uniqueEmail(i),
      name: `StressUser_${i}`,
      role: roles[i % roles.length],
      department: departments[i % departments.length],
    });
    if (status === 201 && data?.id) {
      createdUserIds.push(data.id);
    }
  }
  console.log(`  -> Created ${createdUserIds.length} users so far.`);
}

// ─── Phase 3: GET list endpoints (50 ops) ────────────────────────────────────

async function phase_getListEndpoints(count: number) {
  console.log(`\n[Phase 3] GET list endpoints (${count} ops)...`);
  const endpoints = [
    ['/vehicles', 'GET_VEHICLES'],
    ['/users', 'GET_USERS'],
    ['/reservations', 'GET_RESERVATIONS'],
    ['/incidents', 'GET_INCIDENTS'],
    ['/fuel/all', 'GET_FUEL_ALL'],
    ['/fuel/stats', 'GET_FUEL_STATS'],
  ] as const;

  for (let i = 0; i < count; i++) {
    const [path, op] = endpoints[i % endpoints.length];
    await apiCall(op, 'GET', path);
  }
}

// ─── Phase 4: Create Reservations (80 reservations) ──────────────────────────

async function phase_createReservations(count: number) {
  console.log(`\n[Phase 4] Creating ${count} reservations...`);
  if (createdVehicleIds.length === 0 || createdUserIds.length === 0) {
    console.log('  -> Skipped: no vehicles or users available.');
    return;
  }

  const destinations = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Nantes', 'Strasbourg'];

  for (let i = 0; i < count; i++) {
    // Each reservation uses a different vehicle so no overlap
    const vehicleId = createdVehicleIds[i % createdVehicleIds.length];
    const userId = createdUserIds[i % createdUserIds.length];
    // Stagger time windows: each slot is 2 hours, offset by index * 3 hours to avoid conflicts per vehicle
    const slotOffset = Math.floor(i / createdVehicleIds.length) * 3;
    const startHours = 1 + slotOffset;
    const endHours = startHours + 1;

    const { status, data } = await apiCall('CREATE_RESERVATION', 'POST', '/reservations', {
      userId,
      vehicleId,
      startTime: futureDate(startHours),
      endTime: futureDate(endHours),
      destination: destinations[i % destinations.length],
    });
    if ((status === 200 || status === 201) && data?.id) {
      createdReservationIds.push(data.id);
    }
  }
  console.log(`  -> Created ${createdReservationIds.length} reservations so far.`);
}

// ─── Phase 5: Start Trips (60 trips) ─────────────────────────────────────────

async function phase_startTrips(count: number) {
  console.log(`\n[Phase 5] Starting ${count} trips...`);
  if (createdVehicleIds.length === 0 || createdUserIds.length === 0) {
    console.log('  -> Skipped: no vehicles or users available.');
    return;
  }

  for (let i = 0; i < count; i++) {
    const vehicleId = createdVehicleIds[i % createdVehicleIds.length];
    const userId = createdUserIds[i % createdUserIds.length];
    const startMileage = rand(1000, 100000);

    const { status, data } = await apiCall('START_TRIP', 'POST', '/trips/start', {
      userId,
      vehicleId,
      startMileage,
    });
    if (status === 201 && data?.id) {
      createdTripIds.push(data.id);
    }
  }
  console.log(`  -> Started ${createdTripIds.length} trips so far.`);
}

// ─── Phase 6: End Trips (60 ops) ─────────────────────────────────────────────

async function phase_endTrips() {
  console.log(`\n[Phase 6] Ending ${createdTripIds.length} trips...`);
  for (let i = 0; i < createdTripIds.length; i++) {
    const tripId = createdTripIds[i];
    const endMileage = rand(100001, 200000);
    await apiCall('END_TRIP', 'POST', '/trips/end', {
      tripId,
      endMileage,
      notes: `Stress test trip #${i}`,
    });
  }
}

// ─── Phase 7: Create Incidents (80 incidents) ────────────────────────────────

async function phase_createIncidents(count: number) {
  console.log(`\n[Phase 7] Creating ${count} incidents...`);
  if (createdVehicleIds.length === 0 || createdUserIds.length === 0) {
    console.log('  -> Skipped: no vehicles or users available.');
    return;
  }

  const severities = ['MINOR', 'MAJOR', 'CRITICAL'];
  const descriptions = [
    'Pneu crevé',
    'Pare-brise fissuré',
    'Problème moteur',
    'Fuite huile',
    'Frein défectueux',
    'Phare cassé',
    'Carrosserie endommagée',
    'Batterie faible',
  ];

  for (let i = 0; i < count; i++) {
    const vehicleId = createdVehicleIds[i % createdVehicleIds.length];
    const userId = createdUserIds[i % createdUserIds.length];

    const { status, data } = await apiCall('CREATE_INCIDENT', 'POST', '/incidents', {
      vehicleId,
      userId,
      description: descriptions[i % descriptions.length],
      severity: severities[i % severities.length],
    });
    if (status === 201 && data?.id) {
      createdIncidentIds.push(data.id);
    }
  }
  console.log(`  -> Created ${createdIncidentIds.length} incidents so far.`);
}

// ─── Phase 8: Resolve Incidents (80 ops) ─────────────────────────────────────

async function phase_resolveIncidents() {
  console.log(`\n[Phase 8] Resolving ${createdIncidentIds.length} incidents...`);
  for (const id of createdIncidentIds) {
    await apiCall('RESOLVE_INCIDENT', 'PATCH', `/incidents/${id}/resolve`);
  }
}

// ─── Phase 9: Create Fuel Logs (80 logs) ─────────────────────────────────────

async function phase_createFuelLogs(count: number) {
  console.log(`\n[Phase 9] Creating ${count} fuel logs...`);
  if (createdVehicleIds.length === 0 || createdUserIds.length === 0) {
    console.log('  -> Skipped: no vehicles or users available.');
    return;
  }

  for (let i = 0; i < count; i++) {
    const vehicleId = createdVehicleIds[i % createdVehicleIds.length];
    const userId = createdUserIds[i % createdUserIds.length];

    const { status, data } = await apiCall('CREATE_FUEL_LOG', 'POST', '/fuel', {
      vehicleId,
      userId,
      liters: rand(20, 80),
      cost: rand(30, 120),
      mileageAtFill: rand(5000, 150000),
      lowFuel: false,
    });
    if (status === 201 && data?.id) {
      createdFuelLogIds.push(data.id);
    }
  }
  console.log(`  -> Created ${createdFuelLogIds.length} fuel logs so far.`);
}

// ─── Phase 10: GET per-vehicle sub-resources (50 ops) ────────────────────────

async function phase_getVehicleSubResources(count: number) {
  console.log(`\n[Phase 10] GET per-vehicle sub-resources (${count} ops)...`);
  if (createdVehicleIds.length === 0) {
    console.log('  -> Skipped: no vehicles available.');
    return;
  }

  const endpoints = [
    (id: string) => [`/trips/vehicle/${id}`, 'GET_TRIP_HISTORY'],
    (id: string) => [`/reservations/vehicle/${id}`, 'GET_VEHICLE_RESERVATIONS'],
    (id: string) => [`/incidents/vehicle/${id}`, 'GET_VEHICLE_INCIDENTS'],
    (id: string) => [`/fuel/vehicle/${id}`, 'GET_VEHICLE_FUEL'],
    (id: string) => [`/vehicles/${id}`, 'GET_VEHICLE_BY_ID'],
  ] as const;

  for (let i = 0; i < count; i++) {
    const vehicleId = createdVehicleIds[i % createdVehicleIds.length];
    const [path, op] = endpoints[i % endpoints.length](vehicleId);
    await apiCall(op, 'GET', path);
  }
}

// ─── Phase 11: Update Vehicles (40 ops) ──────────────────────────────────────

async function phase_updateVehicles(count: number) {
  console.log(`\n[Phase 11] Updating ${count} vehicles...`);
  if (createdVehicleIds.length === 0) {
    console.log('  -> Skipped: no vehicles available.');
    return;
  }

  const statuses = ['AVAILABLE', 'MAINTENANCE'];
  for (let i = 0; i < count; i++) {
    const id = createdVehicleIds[i % createdVehicleIds.length];
    await apiCall('UPDATE_VEHICLE', 'PUT', `/vehicles/${id}`, {
      status: statuses[i % statuses.length],
      currentMileage: rand(10000, 200000),
    });
  }
}

// ─── Phase 12: Error / Edge-case Probing (50 ops) ────────────────────────────

async function phase_errorProbing() {
  console.log('\n[Phase 12] Error / edge-case probing (50 ops)...');

  // Missing required fields on vehicle
  for (let i = 0; i < 5; i++) {
    await apiCall('CREATE_VEHICLE_MISSING_FIELDS', 'POST', '/vehicles', {
      brand: 'TestBrand',
      // model and plateNumber intentionally missing
    });
  }

  // Duplicate plate
  if (createdVehicleIds.length > 0) {
    // Fetch an existing vehicle to get its plate
    const { data } = await apiCall('GET_VEHICLE_BY_ID_PROBE', 'GET', `/vehicles/${createdVehicleIds[0]}`);
    if (data?.plateNumber) {
      for (let i = 0; i < 5; i++) {
        await apiCall('CREATE_VEHICLE_DUPLICATE_PLATE', 'POST', '/vehicles', {
          brand: 'X',
          model: 'Y',
          plateNumber: data.plateNumber,
        });
      }
    }
  }

  // Delete non-existent vehicle
  for (let i = 0; i < 5; i++) {
    await apiCall('DELETE_VEHICLE_NOT_FOUND', 'DELETE', `/vehicles/non-existent-id-${i}`);
  }

  // Delete non-existent user
  for (let i = 0; i < 5; i++) {
    await apiCall('DELETE_USER_NOT_FOUND', 'DELETE', `/users/non-existent-id-${i}`);
  }

  // Invalid reservation dates (end before start)
  if (createdVehicleIds.length > 0 && createdUserIds.length > 0) {
    for (let i = 0; i < 5; i++) {
      await apiCall('CREATE_RESERVATION_BAD_DATES', 'POST', '/reservations', {
        userId: createdUserIds[0],
        vehicleId: createdVehicleIds[0],
        startTime: futureDate(10),
        endTime: futureDate(5), // end before start
        destination: 'Test',
      });
    }
  }

  // Overlapping reservation on same vehicle
  if (createdVehicleIds.length > 0 && createdUserIds.length > 0) {
    // First create a base reservation
    await apiCall('CREATE_RESERVATION_BASE', 'POST', '/reservations', {
      userId: createdUserIds[0],
      vehicleId: createdVehicleIds[createdVehicleIds.length - 1],
      startTime: futureDate(200),
      endTime: futureDate(202),
      destination: 'Base',
    });
    // Then overlap it
    for (let i = 0; i < 5; i++) {
      await apiCall('CREATE_RESERVATION_CONFLICT', 'POST', '/reservations', {
        userId: createdUserIds[0],
        vehicleId: createdVehicleIds[createdVehicleIds.length - 1],
        startTime: futureDate(200),
        endTime: futureDate(202),
        destination: 'Overlap',
      });
    }
  }

  // End trip with bad mileage (lower than start)
  await apiCall('END_TRIP_BAD_MILEAGE', 'POST', '/trips/end', {
    tripId: 'fake-trip-id-999',
    endMileage: 0,
  });

  // End non-existent trip
  for (let i = 0; i < 5; i++) {
    await apiCall('END_TRIP_NOT_FOUND', 'POST', '/trips/end', {
      tripId: `non-existent-trip-${i}`,
      endMileage: 99999,
    });
  }

  // Fuel log missing required data
  if (createdVehicleIds.length > 0 && createdUserIds.length > 0) {
    for (let i = 0; i < 5; i++) {
      await apiCall('CREATE_FUEL_LOG_MISSING_DATA', 'POST', '/fuel', {
        vehicleId: createdVehicleIds[0],
        userId: createdUserIds[0],
        liters: 40,
        // cost, mileageAtFill, lowFuel all missing
      });
    }
  }

  // Fuel log mileage over limit
  if (createdVehicleIds.length > 0 && createdUserIds.length > 0) {
    await apiCall('CREATE_FUEL_LOG_MILEAGE_OVERFLOW', 'POST', '/fuel', {
      vehicleId: createdVehicleIds[0],
      userId: createdUserIds[0],
      liters: 40,
      cost: 60,
      mileageAtFill: 1000000, // over 999999
    });
  }

  // User login missing email
  for (let i = 0; i < 2; i++) {
    await apiCall('USER_LOGIN_MISSING_EMAIL', 'POST', '/users/login', {
      name: 'Nobody',
    });
  }

  // GET non-existent vehicle by id
  for (let i = 0; i < 3; i++) {
    await apiCall('GET_VEHICLE_NOT_FOUND', 'GET', `/vehicles/no-such-vehicle-${i}`);
  }
}

// ─── Phase 13: Delete Reservations (clean prereqs for vehicle deletion) ───────

async function phase_deleteReservations() {
  console.log(`\n[Phase 13] Deleting ${createdReservationIds.length} reservations (cleanup prerequisite)...`);
  for (const id of createdReservationIds) {
    await apiCall('DELETE_RESERVATION', 'DELETE', `/reservations/${id}`);
  }
}

// ─── Phase 14: Delete Users ───────────────────────────────────────────────────

async function phase_deleteUsers() {
  console.log(`\n[Phase 14] Deleting ${createdUserIds.length} users...`);
  for (const id of createdUserIds) {
    await apiCall('DELETE_USER', 'DELETE', `/users/${id}`);
  }
}

// ─── Phase 15: Delete Vehicles ────────────────────────────────────────────────

async function phase_deleteVehicles() {
  console.log(`\n[Phase 15] Deleting ${createdVehicleIds.length} vehicles...`);
  for (const id of createdVehicleIds) {
    await apiCall('DELETE_VEHICLE', 'DELETE', `/vehicles/${id}`);
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

function printReport(totalDurationMs: number) {
  const total = results.length;
  const successes = results.filter((r) => r.ok).length;
  const failures = results.filter((r) => !r.ok).length;

  // Bucket errors by (op, status, body)
  const errorMap = new Map<string, ErrorBucket>();
  for (const r of results) {
    if (!r.ok) {
      const key = `${r.op}|${r.status}|${r.errorBody ?? ''}`;
      if (errorMap.has(key)) {
        errorMap.get(key)!.count++;
      } else {
        errorMap.set(key, {
          op: r.op,
          status: r.status,
          body: r.errorBody ?? '(no body)',
          count: 1,
        });
      }
    }
  }

  // Timing stats
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const avgMs = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
  const minMs = durations[0];
  const maxMs = durations[durations.length - 1];
  const p95Ms = durations[Math.floor(durations.length * 0.95)];
  const p99Ms = durations[Math.floor(durations.length * 0.99)];

  // Per-operation summary
  const opStats = new Map<string, { total: number; ok: number; fail: number }>();
  for (const r of results) {
    if (!opStats.has(r.op)) opStats.set(r.op, { total: 0, ok: 0, fail: 0 });
    const s = opStats.get(r.op)!;
    s.total++;
    if (r.ok) s.ok++; else s.fail++;
  }

  const sep = '='.repeat(72);
  const line = '-'.repeat(72);

  console.log('\n\n' + sep);
  console.log('  FLEET MANAGEMENT API - STRESS TEST REPORT');
  console.log(sep);

  console.log(`\n  Total wall time     : ${(totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`  Total operations    : ${total}`);
  console.log(`  Successes           : ${successes}  (${((successes / total) * 100).toFixed(1)}%)`);
  console.log(`  Failures            : ${failures}  (${((failures / total) * 100).toFixed(1)}%)`);

  console.log('\n  Timing (per request):');
  console.log(`    Min   : ${minMs}ms`);
  console.log(`    Avg   : ${avgMs}ms`);
  console.log(`    P95   : ${p95Ms}ms`);
  console.log(`    P99   : ${p99Ms}ms`);
  console.log(`    Max   : ${maxMs}ms`);

  console.log('\n' + line);
  console.log('  Per-Operation Breakdown');
  console.log(line);
  const opKeys = Array.from(opStats.keys()).sort();
  for (const op of opKeys) {
    const s = opStats.get(op)!;
    const pct = ((s.ok / s.total) * 100).toFixed(0);
    console.log(`  ${op.padEnd(42)} total=${String(s.total).padStart(4)}  ok=${String(s.ok).padStart(4)}  fail=${String(s.fail).padStart(4)}  (${pct}%)`);
  }

  console.log('\n' + line);
  console.log('  Distinct Errors Encountered');
  console.log(line);

  if (errorMap.size === 0) {
    console.log('  (none)');
  } else {
    // Sort by (op, status)
    const sorted = Array.from(errorMap.values()).sort((a, b) =>
      a.op.localeCompare(b.op) || a.status - b.status
    );
    for (const e of sorted) {
      console.log(`\n  Operation : ${e.op}`);
      console.log(`  HTTP      : ${e.status === 0 ? 'CONNECTION ERROR' : e.status}`);
      console.log(`  Count     : ${e.count}`);
      console.log(`  Body      : ${e.body.slice(0, 300)}`);
    }
  }

  console.log('\n' + line);
  console.log('  Cleanup Summary');
  console.log(line);
  console.log(`  Vehicles created   : ${createdVehicleIds.length}`);
  console.log(`  Users created      : ${createdUserIds.length}`);
  console.log(`  Reservations       : ${createdReservationIds.length}`);
  console.log(`  Trips              : ${createdTripIds.length}`);
  console.log(`  Incidents          : ${createdIncidentIds.length}`);
  console.log(`  Fuel logs          : ${createdFuelLogIds.length}`);
  console.log('\n' + sep + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fleet Management API Stress Test');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  // Verify server is reachable before starting
  try {
    const probe = await fetch(`${BASE_URL}/health`);
    console.log(`Server reachable - status ${probe.status}`);
  } catch (err) {
    console.error(`ERROR: Cannot reach ${BASE_URL} - is the server running?`);
    console.error(err);
    process.exit(1);
  }

  const globalStart = Date.now();

  // ~1000 operations:
  // Phase 1:  100 (create vehicles)
  // Phase 2:  100 (create users)
  // Phase 3:   50 (GET lists)
  // Phase 4:   80 (create reservations)
  // Phase 5:   60 (start trips)
  // Phase 6:   60 (end trips)
  // Phase 7:   80 (create incidents)
  // Phase 8:   80 (resolve incidents)
  // Phase 9:   80 (create fuel logs)
  // Phase 10:  50 (GET sub-resources)
  // Phase 11:  40 (update vehicles)
  // Phase 12:  50 (error probing)
  // Phase 13: var (delete reservations)
  // Phase 14: var (delete users)
  // Phase 15: var (delete vehicles)
  // Total planned (excl. cleanup): ~830 + cleanup

  await phase_createVehicles(100);
  await phase_createUsers(100);
  await phase_getListEndpoints(50);
  await phase_createReservations(80);
  await phase_startTrips(60);
  await phase_endTrips();
  await phase_createIncidents(80);
  await phase_resolveIncidents();
  await phase_createFuelLogs(80);
  await phase_getVehicleSubResources(50);
  await phase_updateVehicles(40);
  await phase_errorProbing();

  // Cleanup - order matters: reservations before vehicles, users last
  await phase_deleteReservations();
  await phase_deleteUsers();
  await phase_deleteVehicles();

  const totalDurationMs = Date.now() - globalStart;
  printReport(totalDurationMs);
}

main().catch((err) => {
  console.error('Unhandled error in stress test:', err);
  process.exit(1);
});
