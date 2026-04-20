/**
 * Monte Carlo simulation — 500 random scenarios
 * Each iteration picks randomly: operation type, user, vehicle, parameters
 * Measures: success rate, latency distribution, HTTP codes
 * Run: npx ts-node src/scripts/sim-monte-carlo.ts
 */

const BASE_URL = 'http://localhost:4000';
const N_ITERATIONS = 500;

const TEST_USERS = [
  { email: 'admin.test@apajh.re',      password: 'Admin@1234!' },
  { email: 'directeur.test@apajh.re',  password: 'Directeur@1234!' },
  { email: 'manager.adulte@apajh.re',  password: 'Manager@1234!' },
  { email: 'manager.enfance@apajh.re', password: 'Manager@1234!' },
  { email: 'pro1.adulte@apajh.re',     password: 'Pro@12345!' },
  { email: 'pro2.adulte@apajh.re',     password: 'Pro@12345!' },
  { email: 'pro3.enfance@apajh.re',    password: 'Pro@12345!' },
  { email: 'pro4.enfance@apajh.re',    password: 'Pro@12345!' },
  { email: 'pro5.mixte@apajh.re',      password: 'Pro@12345!' },
  { email: 'pro6.mixte@apajh.re',      password: 'Pro@12345!' },
];

const OPS = [
  'list-vehicles',
  'list-reservations',
  'list-incidents',
  'list-fuel',
  'create-reservation',
  'start-trip',
  'end-trip',
  'fuel-log',
  'incident',
] as const;

type Op = typeof OPS[number];

interface IterResult {
  iteration: number;
  op: Op;
  userEmail: string;
  status: number;
  ok: boolean;
  ms: number;
  error?: string;
}

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min: number, max: number) { return Math.random() * (max - min) + min; }

async function apiCall(method: string, path: string, body?: object, authId?: string): Promise<{ status: number; data: any; ms: number }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authId) headers['X-User-Id'] = authId;
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const ms = Date.now() - t0;
    let data: any = {};
    try { data = await res.json(); } catch { /* empty */ }
    return { status: res.status, data, ms };
  } catch (e: any) {
    return { status: 0, data: { error: e.message }, ms: Date.now() - t0 };
  }
}

async function main() {
  console.log(`🎲 Monte Carlo simulation — ${N_ITERATIONS} random scenarios\n`);

  // ── Setup: login all test users ──────────────────────────────────
  const sessions: { email: string; userId: string }[] = [];
  for (const u of TEST_USERS) {
    const r = await apiCall('POST', '/api/users/login', { email: u.email, password: u.password });
    if (r.status === 200) {
      sessions.push({ email: u.email, userId: r.data.id });
    } else {
      console.warn(`  ⚠️  Could not login ${u.email}: ${r.data?.error}`);
    }
  }

  if (sessions.length === 0) {
    console.error('❌ No users available. Run seed-test-data.ts first.');
    process.exit(1);
  }
  console.log(`✅ ${sessions.length} users authenticated\n`);

  // Get vehicles
  const adminSession = sessions[0];
  const vr = await apiCall('GET', '/api/vehicles', undefined, adminSession.userId);
  const vehicles: any[] = Array.isArray(vr.data) ? vr.data : [];
  if (vehicles.length === 0) {
    console.error('❌ No vehicles found.');
    process.exit(1);
  }
  const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE');
  console.log(`🚗 ${vehicles.length} vehicles (${availableVehicles.length} available)\n`);

  // ── Monte Carlo iterations ───────────────────────────────────────
  const results: IterResult[] = [];
  const t0 = Date.now();

  for (let i = 1; i <= N_ITERATIONS; i++) {
    const session = rand(sessions);
    const op: Op = rand([...OPS]);
    const vehicle = rand(vehicles.length > 0 ? vehicles : [{ id: 'none' }]);

    let status = 0;
    let ms = 0;
    let err: string | undefined;

    try {
      switch (op) {
        case 'list-vehicles': {
          const r = await apiCall('GET', '/api/vehicles', undefined, session.userId);
          status = r.status; ms = r.ms;
          break;
        }
        case 'list-reservations': {
          const r = await apiCall('GET', '/api/reservations', undefined, session.userId);
          status = r.status; ms = r.ms;
          break;
        }
        case 'list-incidents': {
          const r = await apiCall('GET', '/api/incidents', undefined, session.userId);
          status = r.status; ms = r.ms;
          break;
        }
        case 'list-fuel': {
          const r = await apiCall('GET', '/api/fuel/all', undefined, session.userId);
          status = r.status; ms = r.ms;
          break;
        }
        case 'create-reservation': {
          // Random future date (1-180 days ahead) with random 1-8h duration
          const dayOffset = randInt(200, 1000); // far future to avoid conflicts
          const startMs = Date.now() + dayOffset * 24 * 60 * 60 * 1000 + i * 3600 * 1000;
          const durHours = randInt(1, 8);
          const r = await apiCall('POST', '/api/reservations', {
            vehicleId: vehicle.id,
            startTime: new Date(startMs).toISOString(),
            endTime: new Date(startMs + durHours * 3600 * 1000).toISOString(),
            destination: `MC-${i}-${op}`,
          }, session.userId);
          status = r.status; ms = r.ms;
          break;
        }
        case 'start-trip': {
          const r = await apiCall('POST', '/api/trips/start', {
            vehicleId: vehicle.id,
            startMileage: randInt(1000, 200000),
          }, session.userId);
          status = r.status; ms = r.ms;
          break;
        }
        case 'end-trip': {
          // Try to find an open trip for this vehicle
          const tr = await apiCall('GET', `/api/trips/vehicle/${vehicle.id}`, undefined, session.userId);
          const trips: any[] = Array.isArray(tr.data) ? tr.data : [];
          const openTrip = trips.find((t: any) => !t.endTime);
          if (openTrip) {
            const r = await apiCall('POST', '/api/trips/end', {
              tripId: openTrip.id,
              endMileage: openTrip.startMileage + randInt(10, 200),
              notes: `MC end trip ${i}`,
            }, session.userId);
            status = r.status; ms = r.ms;
          } else {
            // No open trip — skip by counting as no-op success
            status = 204; ms = 0;
          }
          break;
        }
        case 'fuel-log': {
          const liters = randFloat(5, 60);
          const r = await apiCall('POST', '/api/fuel', {
            vehicleId: vehicle.id,
            liters,
            cost: liters * randFloat(1.4, 2.2),
            mileageAtFill: randInt(1000, 200000),
          }, session.userId);
          status = r.status; ms = r.ms;
          break;
        }
        case 'incident': {
          const severities = ['MINOR', 'MODERATE', 'MINOR', 'MINOR']; // weighted toward MINOR
          const r = await apiCall('POST', '/api/incidents', {
            vehicleId: vehicle.id,
            description: `MC incident scenario ${i}: random test event`,
            severity: rand(severities),
          }, session.userId);
          status = r.status; ms = r.ms;
          break;
        }
      }
    } catch (e: any) {
      err = e.message;
      status = 0;
    }

    results.push({
      iteration: i,
      op,
      userEmail: session.email,
      status,
      ok: status >= 200 && status < 300,
      ms,
      error: err,
    });

    if (i % 50 === 0) process.stdout.write(`  ${i}/${N_ITERATIONS} iterations...\r`);
  }

  const elapsed = Date.now() - t0;

  // ── Statistics ──────────────────────────────────────────────────
  const successCount = results.filter(r => r.ok).length;
  const failCount    = results.filter(r => !r.ok).length;
  const latencies    = results.filter(r => r.ms > 0).map(r => r.ms).sort((a, b) => a - b);
  const p50  = latencies[Math.floor(latencies.length * 0.50)] ?? 0;
  const p95  = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const p99  = latencies[Math.floor(latencies.length * 0.99)] ?? 0;
  const avg  = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);

  const statusCodes: Record<number, number> = {};
  for (const r of results) statusCodes[r.status] = (statusCodes[r.status] ?? 0) + 1;

  const byOp: Record<string, { ok: number; fail: number; codes: Record<number, number> }> = {};
  for (const r of results) {
    if (!byOp[r.op]) byOp[r.op] = { ok: 0, fail: 0, codes: {} };
    r.ok ? byOp[r.op].ok++ : byOp[r.op].fail++;
    byOp[r.op].codes[r.status] = (byOp[r.op].codes[r.status] ?? 0) + 1;
  }

  console.log('\n\n' + '═'.repeat(65));
  console.log(`📊 MONTE CARLO RESULTS — ${N_ITERATIONS} RANDOM SCENARIOS`);
  console.log('═'.repeat(65));
  console.log(`Total iterations : ${results.length}`);
  console.log(`Successes        : ${successCount} (${((successCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failures         : ${failCount}`);
  console.log(`Duration         : ${(elapsed / 1000).toFixed(2)}s`);
  console.log(`Throughput       : ${(results.length / (elapsed / 1000)).toFixed(1)} ops/s`);
  console.log(`\nLatency distribution:`);
  console.log(`  avg  : ${avg.toFixed(0)} ms`);
  console.log(`  p50  : ${p50} ms`);
  console.log(`  p95  : ${p95} ms`);
  console.log(`  p99  : ${p99} ms`);
  console.log(`  max  : ${latencies[latencies.length - 1] ?? 0} ms`);
  console.log(`\nHTTP Status distribution:`);
  for (const [code, count] of Object.entries(statusCodes).sort()) {
    const pct = ((count / results.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / results.length * 40));
    console.log(`  ${code} : ${bar} ${count} (${pct}%)`);
  }
  console.log(`\nBy operation (${OPS.length} op types, random distribution):`);
  for (const [op, d] of Object.entries(byOp)) {
    const total = d.ok + d.fail;
    const pct   = ((d.ok / total) * 100).toFixed(0);
    const codes = Object.entries(d.codes).map(([k, v]) => `${k}×${v}`).join(' ');
    console.log(`  ${op.padEnd(22)} ✓${d.ok} ✗${d.fail} (${pct}%)  [${codes}]`);
  }

  // Risk assessment
  const has5xx = Object.entries(statusCodes).some(([k]) => parseInt(k) >= 500);
  const rate = successCount / results.length;
  console.log('\n─── Risk Assessment ──────────────────────────────────────');
  console.log(`  Success rate    : ${(rate * 100).toFixed(1)}% ${rate >= 0.80 ? '✅ good' : rate >= 0.60 ? '⚠️  moderate' : '❌ poor'}`);
  console.log(`  Server errors   : ${has5xx ? '❌ 5xx detected — investigate!' : '✅ None'}`);
  const p99Risk = p99 > 2000 ? '⚠️  high latency' : p99 > 1000 ? '⚠️  moderate' : '✅ acceptable';
  console.log(`  p99 latency     : ${p99}ms — ${p99Risk}`);
  console.log('═'.repeat(65));
}

main().catch(e => { console.error(e); process.exit(1); });

export {};
