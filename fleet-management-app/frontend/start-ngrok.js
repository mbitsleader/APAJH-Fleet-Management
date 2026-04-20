const ngrok = require('@ngrok/ngrok');

// Get your endpoint online
ngrok.connect({ 
  addr: 3000, 
  authtoken: "3B732FrfTDZQmMTGPfV7YkumDGx_2S5CG9fndo577wqVskYu1" 
})
.then(listener => {
  console.log(`✅ L'application est maintenant en ligne via Ngrok !`);
  console.log(`➡️ URL Publique : ${listener.url()}`);
  console.log(`(Gardez cette fenêtre ouverte pour maintenir le tunnel actif)`);
})
.catch(error => {
  console.error("Erreur lors de la connexion Ngrok:", error);
});
