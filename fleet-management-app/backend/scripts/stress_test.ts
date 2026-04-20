
async function stressTest() {
  const API_BASE = 'http://127.0.0.1:4000/api';
  const ENDPOINTS = ['/vehicles', '/reservations', '/incidents', '/users'];
  
  console.log('--- STARTING STRESS TEST VIA FETCH ---');
  const start = Date.now();
  let totalRequests = 0;
  let errors = 0;

  const runBatch = async () => {
    const promises = [];
    for (let i = 0; i < 50; i++) {
      const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
      promises.push(
        fetch(`${API_BASE}${endpoint}`)
          .then(res => { 
            if (res.ok) totalRequests++; 
            else errors++;
          })
          .catch(() => { errors++; })
      );
    }
    await Promise.all(promises);
  };

  for (let b = 0; b < 20; b++) {
    await runBatch();
    console.log(`Batch ${b+1}/20 completed...`);
  }

  const duration = (Date.now() - start) / 1000;
  console.log('--- STRESS TEST RESULTS ---');
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total Duration: ${duration.toFixed(2)}s`);
  console.log(`Requests per second: ${(totalRequests / duration).toFixed(2)}`);
  
  if (errors === 0) {
    console.log('✅ PASS: API is stable under concurrent load.');
  } else {
    console.warn(`❌ FAIL: API encountered ${errors} errors under load.`);
  }
}

stressTest();
