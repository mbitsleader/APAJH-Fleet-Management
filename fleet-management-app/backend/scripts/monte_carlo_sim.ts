
async function monteCarlo() {
  const API_BASE = 'http://127.0.0.1:4000/api';
  console.log('--- STARTING MONTE CARLO SIMULATION (2000 RUNS) VIA FETCH ---');
  
  try {
    const resVehicles = await fetch(`${API_BASE}/vehicles`);
    const resUsers = await fetch(`${API_BASE}/users`);

    const vehicles = await resVehicles.json();
    const users = await resUsers.json();

    if (!vehicles.length || !users.length) {
      console.error('Missing data for simulation.');
      return;
    }

    const vIds = vehicles.map((v: any) => v.id);
    const uIds = users.map((u: any) => u.id);

    let success = 0;
    let conflicts = 0;
    let errors = 0;

    for (let i = 0; i < 2000; i++) {
      const vId = vIds[Math.floor(Math.random() * vIds.length)];
      const uId = uIds[Math.floor(Math.random() * uIds.length)];
      
      const startDay = Math.floor(Math.random() * 30);
      const startHour = 8 + Math.floor(Math.random() * 8);
      const start = new Date();
      start.setDate(start.getDate() + startDay);
      start.setHours(startHour, 0, 0, 0);
      
      const end = new Date(start);
      end.setHours(start.getHours() + 1 + Math.floor(Math.random() * 4));

      try {
        const response = await fetch(`${API_BASE}/reservations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicleId: vId,
            userId: uId,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            destination: 'MonteCarlo-' + i
          })
        });
        
        if (response.ok) {
          success++;
        } else if (response.status === 409) {
          conflicts++;
        } else {
          errors++;
        }
      } catch (err) {
        errors++;
      }

      if (i % 500 === 0) console.log(`Progress: ${i}/2000...`);
    }

    console.log('--- MONTE CARLO RESULTS ---');
    console.log(`Success: ${success}`);
    console.log(`Conflicts Handled: ${conflicts}`);
    console.log(`Technical Errors: ${errors}`);
    
    if (errors === 0) {
      console.log('✅ PASS: System is logically sound.');
    } else {
      console.warn(`❌ FAIL: Encountered ${errors} technical errors.`);
    }

  } catch (err) {
    console.error('Simulation failed to start:', err);
  }
}

monteCarlo();
