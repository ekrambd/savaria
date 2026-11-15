/**
 * API Base URL Resolver
 * Allows local development to seamlessly proxy/fetch from live production (https://savariabd.com)
 * when VITE_USE_LIVE_API=true or VITE_API_BASE_URL is configured in .env.local.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const liveApiEnv = (import.meta as any).env.VITE_USE_LIVE_API;
    const customApiUrl = (import.meta as any).env.VITE_API_BASE_URL;
    
    if (customApiUrl) {
      return customApiUrl.replace(/\/+$/, '');
    }
    
    // If running on localhost / 127.0.0.1 and LIVE API mode is active
    if (liveApiEnv === 'true' || liveApiEnv === true) {
      return 'https://savariabd.com/api';
    }
  }
  return '/api';
}

/**
 * Universal fetch wrapper that automatically routes to Live Production Database
 * when VITE_USE_LIVE_API=true
 */
export async function appFetch(input: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  let finalUrl = input;
  
  if (base !== '/api' && input.startsWith('/api')) {
    finalUrl = input.replace(/^\/api/, base);
  }
  
  return fetch(finalUrl, init);
}
