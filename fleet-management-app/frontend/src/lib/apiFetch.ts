const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function clearSessionAndRedirect() {
  if (typeof window === 'undefined') return;
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };
  
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch(`${API_BASE}${path}`, { 
        ...options, 
        headers,
        credentials: 'include'
      });

      // Si le serveur répond avec un code d'erreur interne 502/503/504
      if (response.status >= 502 && response.status <= 504) {
        throw new Error(`Server returned ${response.status}`);
      }

      // Si le serveur répond qu'il est en vie, déclencher un événement pour signaler le retour à la normale
      if (typeof window !== 'undefined') {
         window.dispatchEvent(new Event('backend-restored'));
      }

      // Session expirée ou utilisateur supprimé → déconnexion automatique
      if (response.status === 401 && !path.includes('/login') && !path.includes('/api/users/me')) {
        clearSessionAndRedirect();
      }

      return response;
    } catch (error) {
      attempt++;
      console.warn(`[apiFetch] Tentative ${attempt}/${maxRetries} échouée pour ${path}`, error);
      
      if (attempt >= maxRetries) {
        if (typeof window !== 'undefined') {
          // Émettre l'événement pour afficher l'interface serveur down avec animation
          window.dispatchEvent(new Event('backend-outage'));
        }
        throw error; // Propager l'erreur après les tentatives
      }
      
      // Pause exponentielle : 1s, puis 2s, puis 4s
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  throw new Error("apiFetch fetch engine failed unexpectedly");
}
