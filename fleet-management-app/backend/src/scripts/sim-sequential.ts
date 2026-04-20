/**
 * Sequential simulation — 1000 operations
 * Tests: login → reserve → start trip → end trip → incident → resolve → fuel
 * Run: npx ts-node src/scripts/sim-sequential.ts
 */

const BASE_URL = 'http://localhost:4000';

interface SimResult {
  op: string;
  status: number;
  ok: boolean;
  ms: number;
}

const results: SimResult[] = [];
let cookieJar = '';
let vehicleId = '';
let vehiclePlate = '';

async function request(method: string, path: string, body?: object): Promise<{ status: number; data: any; ms: number; ok: boolean }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookieJar) headers['Cookie'] = cookieJar;
  
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  // Capture cookies from set-cookie header
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    // Basic cookie merging logic for simulation
    const cookies = setCookie.split(',').map(c => c.split(';')[0]);
    cookieJar = cookies.join('; ');
  }

  const ms = Date.now() - t0;
  let data: any = {};
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data, ms, ok: res.status >= 200 && res.status < 300 };
}

function record(op: string, status: number, ms: number) {
  results.push({ op, status, ok: status >= 200 && status < 300, ms });
}

async function setup() {
  // Login as admin
  const r = await request('POST', '/api/users/login', { 
    email: process.env.TEST_EMAIL || 'admin.test@apajh.re', 
    password: process.env.TEST_PASSWORD || 'Admin@1234!' 
  });
  if (r.status !== 200) {
    console.error('❌ Login failed. Did you run seed-test-data.ts first?', r.data);
    process.exit(1);
  }
  record('login', r.status, r.ms);

  // Pick an available vehicle
  const vr = await request('GET', '/api/vehicles');
  record('get-vehicles', vr.status, vr.ms);
  const available = vr.data.find((v: any) => v.status === 'AVAILABLE');
  if (!available) {
    console.error('❌ No available vehicle found for simulation.');
    process.exit(1);
  }
  vehicleId = available.id;
  vehiclePlate = available.plateNumber;
  console.log(`🚗 Using vehicle ${vehiclePlate} (${vehicleId})`);
}

async function runCycle(i: number): Promise<void> {
  const now = new Date();
  const start = new Date(now.getTime() + i * 48 * 60 * 60 * 1000); // +2 days per cycle to avoid conflicts
  const end   = new Date(start.getTime() + 4 * 60 * 60 * 1000);    // 4-hour trip

  // 1. Reserve
  const rv = await request('POST', '/api/reservations', {
    vehicleId,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    destination: `Simulation cycle ${i}`,
  });
  record('reserve', rv.status, rv.ms);
  if (!rv.ok) return; // skip rest if reservation failed

  // 2. Start trip
  const startKm = 10000 + i * 50;
  const st = await request('POST', '/api/trips/start', {
    vehicleId,
    startMileage: startKm,
    reservationId: rv.data.id,
  });
  record('start-trip', st.status, st.ms);
  if (!st.ok) return;

  const tripId = st.data.id;

  // 3. End trip
  const et = await request('POST', '/api/trips/end', {
    tripId,
    endMileage: startKm + 30,
    notes: `Return from cycle ${i}`,
  });
  record('end-trip', et.status, et.ms);

  // 4. Report MINOR incident (every 10th cycle)
  if (i % 10 === 0) {
    const inc = await request('POST', '/api/incidents', {
      vehicleId,
      description: `Minor scratch observed during cycle ${i}`,
      severity: 'MINOR',
    });
    record('incident', inc.status, inc.ms);

    if (inc.ok) {
      const res = await request('PATCH', `/api/incidents/${inc.data.id}/resolve`, {});
      record('resolve-incident', res.status, res.ms);
    }
  }

  // 5. Fuel log (every 5th cycle)
  if (i % 5 === 0) {
    const fl = await request('POST', '/api/fuel', {
      vehicleId,
      liters: 30 + Math.random() * 20,
      cost: 50 + Math.random() * 30,
      mileageAtFill: startKm + 30,
    });
    record('fuel-log', fl.status, fl.ms);
  }
}

async function main() {
  console.log('🔄 Sequential simulation — 1000 operations\n');
  await setup();

  const N = 1000;
  const t0 = Date.now();
  let cycleCount = 0;

  for (let i = 1; i <= N; i++) {
    await runCycle(i);
    cycleCount++;
    if (i % 100 === 0) process.stdout.write(`  ${i}/${N} cycles...\r`);
  }

  const elapsed = Date.now() - t0;

  // ── Statistics ──────────────────────────────────────────────────
  const successCount = results.filter(r => r.ok).length;
  const failCount    = results.filter(r => !r.ok).length;
  const latencies    = results.map(r => r.ms).sort((a, b) => a - b);
  const p50  = latencies[Math.floor(latencies.length * 0.50)] ?? 0;
  const p95  = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const p99  = latencies[Math.floor(latencies.length * 0.99)] ?? 0;
  const avgMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  const byOp: Record<string, { ok: number; fail: number }> = {};
  for (const r of results) {
    if (!byOp[r.op]) byOp[r.op] = { ok: 0, fail: 0 };
    r.ok ? byOp[r.op].ok++ : byOp[r.op].fail++;
  }

  const statusCodes: Record<number, number> = {};
  for (const r of results) statusCodes[r.status] = (statusCodes[r.status] ?? 0) + 1;

  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 SIMULATION RESULTS — SEQUENTIAL (1000 cycles)');
  console.log('═'.repeat(60));
  console.log(`Total operations : ${results.length}`);
  console.log(`Successes        : ${successCount} (${((successCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failures         : ${failCount}`);
  console.log(`Duration         : ${(elapsed / 1000).toFixed(2)}s`);
  console.log(`Throughput       : ${(results.length / (elapsed / 1000)).toFixed(1)} ops/s`);
  console.log(`\nLatency:`);
  console.log(`  avg  : ${avgMs.toFixed(0)} ms`);
  console.log(`  p50  : ${p50} ms`);
  console.log(`  p95  : ${p95} ms`);
  console.log(`  p99  : ${p99} ms`);
  console.log(`\nHTTP Status codes:`);
  for (const [code, count] of Object.entries(statusCodes).sort()) {
    console.log(`  ${code} : ${count}`);
  }
  console.log(`\nBy operation:`);
  for (const [op, counts] of Object.entries(byOp)) {
    const total = counts.ok + counts.fail;
    console.log(`  ${op.padEnd(20)} OK:${counts.ok}  FAIL:${counts.fail}  (${((counts.ok / total) * 100).toFixed(0)}%)`);
  }
  console.log('═'.repeat(60));

  if (successCount / results.length < 0.90) {
    console.warn('\n⚠️  Success rate below 90% — investigate failures above');
  } else {
    console.log('\n✅ All good — success rate ≥ 90%');
  }
}

main().catch(e => { console.error(e); process.exit(1); });

export {};
