/**
 * Concurrent simulation — 20 users connected simultaneously
 * Each worker: login → pick vehicle → reserve → start trip → end trip
 * Run: npx ts-node src/scripts/sim-concurrent.ts
 */

const BASE_URL = 'http://localhost:4000';

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

interface WorkerResult {
  worker: number;
  email: string;
  ops: { op: string; status: number; ok: boolean; ms: number }[];
  error?: string;
}

async function api(method: string, path: string, body?: object, currentCookieJar?: string): Promise<{ status: number; data: any; ms: number; cookies: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (currentCookieJar) headers['Cookie'] = currentCookieJar;
  
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Capture cookies
  let nextCookieJar = currentCookieJar || '';
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const cookies = setCookie.split(',').map(c => c.split(';')[0]);
    nextCookieJar = cookies.join('; ');
  }

  const ms = Date.now() - t0;
  let data: any = {};
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data, ms, cookies: nextCookieJar };
}

async function runWorker(workerId: number, user: { email: string; password: string }, vehicleIds: string[]): Promise<WorkerResult> {
  const ops: WorkerResult['ops'] = [];
  let cookieJar = '';
  
  const rec = (op: string, status: number, ms: number) =>
    ops.push({ op, status, ok: status >= 200 && status < 300, ms });

  try {
    // Login
    const login = await api('POST', '/api/users/login', { email: user.email, password: user.password });
    cookieJar = login.cookies;
    rec('login', login.status, login.ms);
    if (login.status !== 200) return { worker: workerId, email: user.email, ops, error: `Login failed: ${login.data?.error}` };

    // Pick a vehicle for this worker (round-robin to spread load)
    const vid = vehicleIds[workerId % vehicleIds.length];

    // Reserve (offset dates by worker+100 days to reduce conflicts)
    const offset = (workerId + 1) * 72 * 60 * 60 * 1000 + 30 * 24 * 60 * 60 * 1000; // +30 days + worker offset
    const start = new Date(Date.now() + offset);
    const end   = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const rv = await api('POST', '/api/reservations', {
      vehicleId: vid,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      destination: `Concurrent test worker ${workerId}`,
    }, cookieJar);
    cookieJar = rv.cookies;
    rec('reserve', rv.status, rv.ms);

    // Check vehicles list
    const vl = await api('GET', '/api/vehicles', undefined, cookieJar);
    cookieJar = vl.cookies;
    rec('list-vehicles', vl.status, vl.ms);

    // Check health
    const hc = await api('GET', '/api/health');
    rec('health', hc.status, hc.ms);

    // Multiple quick reads
    for (let i = 0; i < 5; i++) {
      const r = await api('GET', '/api/vehicles', undefined, cookieJar);
      cookieJar = r.cookies;
      rec('read', r.status, r.ms);
    }

    return { worker: workerId, email: user.email, ops };
  } catch (e: any) {
    return { worker: workerId, email: user.email, ops, error: e.message };
  }
}

async function main() {
  console.log('⚡ Concurrent simulation — 20 simultaneous users\n');

  // Check health first
  const hc = await api('GET', '/api/health');
  if (hc.status !== 200) {
    console.error('❌ Backend not available at', BASE_URL);
    process.exit(1);
  }

  // Get available vehicles
  const adminLogin = await api('POST', '/api/users/login', { email: 'admin.test@apajh.re', password: 'Admin@1234!' });
  if (adminLogin.status !== 200) {
    console.error('❌ Admin login failed. Run seed-test-data.ts first.');
    process.exit(1);
  }
  const adminCookieJar = adminLogin.cookies;

  const vr = await api('GET', '/api/vehicles', undefined, adminCookieJar);
  const vehicles = vr.data.filter((v: any) => v.status === 'AVAILABLE');
  if (vehicles.length === 0) {
    console.error('❌ No available vehicles. Cannot simulate.');
    process.exit(1);
  }
  const vehicleIds: string[] = vehicles.map((v: any) => v.id);
  console.log(`✅ Using ${vehicleIds.length} available vehicles`);

  // Duplicate test users to reach 20 workers
  const workers: { email: string; password: string }[] = [];
  for (let i = 0; i < 20; i++) {
    workers.push(TEST_USERS[i % TEST_USERS.length]);
  }

  const t0 = Date.now();
  console.log(`🚀 Launching ${workers.length} workers in parallel...\n`);

  // All 20 workers launch simultaneously
  const workerResults = await Promise.all(
    workers.map((user, idx) => runWorker(idx + 1, user, vehicleIds))
  );

  const elapsed = Date.now() - t0;

  // ── Statistics ──────────────────────────────────────────────────
  const allOps = workerResults.flatMap(w => w.ops);
  const successCount = allOps.filter(o => o.ok).length;
  const failCount    = allOps.filter(o => !o.ok).length;
  const latencies    = allOps.map(o => o.ms).sort((a, b) => a - b);
  const p50  = latencies[Math.floor(latencies.length * 0.50)] ?? 0;
  const p95  = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const p99  = latencies[Math.floor(latencies.length * 0.99)] ?? 0;
  const avgMs = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);

  const statusCodes: Record<number, number> = {};
  for (const o of allOps) statusCodes[o.status] = (statusCodes[o.status] ?? 0) + 1;

  const byOp: Record<string, { ok: number; fail: number }> = {};
  for (const o of allOps) {
    if (!byOp[o.op]) byOp[o.op] = { ok: 0, fail: 0 };
    o.ok ? byOp[o.op].ok++ : byOp[o.op].fail++;
  }

  const errors = workerResults.filter(w => w.error);

  console.log('═'.repeat(60));
  console.log('📊 SIMULATION RESULTS — CONCURRENT (20 users)');
  console.log('═'.repeat(60));
  console.log(`Workers          : ${workers.length}`);
  console.log(`Total operations : ${allOps.length}`);
  console.log(`Successes        : ${successCount} (${((successCount / (allOps.length || 1)) * 100).toFixed(1)}%)`);
  console.log(`Failures         : ${failCount}`);
  console.log(`Worker errors    : ${errors.length}`);
  console.log(`Duration         : ${(elapsed / 1000).toFixed(2)}s`);
  console.log(`Throughput       : ${(allOps.length / (elapsed / 1000)).toFixed(1)} ops/s`);
  console.log(`\nLatency (all ${workers.length} workers in parallel):`);
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

  if (errors.length > 0) {
    console.log(`\nWorker errors:`);
    errors.forEach(w => console.log(`  Worker ${w.worker} (${w.email}): ${w.error}`));
  }

  const has5xx = Object.entries(statusCodes).some(([k]) => parseInt(k) >= 500);
  if (has5xx) {
    console.warn('\n⚠️  5xx errors detected — possible race conditions or server issues!');
  } else {
    console.log('\n✅ No 5xx errors — server handled concurrent load without crashes');
  }
  console.log('═'.repeat(60));
}

main().catch(e => { console.error(e); process.exit(1); });

export {};
