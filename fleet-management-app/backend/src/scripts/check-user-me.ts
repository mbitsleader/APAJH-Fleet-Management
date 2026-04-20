async function checkMe() {
  const loginRes = await fetch('http://localhost:4000/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pro1.adulte@apajh.re', password: 'Pro@12345!' })
  });
  
  const cookies = loginRes.headers.get('set-cookie');
  console.log('Login Status:', loginRes.status);
  
  const meRes = await fetch('http://localhost:4000/api/users/me', {
    headers: { 'Cookie': cookies || '' }
  });
  
  const profile = await meRes.json();
  console.log('User Profile Response:', JSON.stringify(profile, null, 2));
}

checkMe().catch(console.error);
