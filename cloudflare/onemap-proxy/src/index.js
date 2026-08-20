let tokenCache = { token: '', obtainedAt: 0 };
const TOKEN_CACHE_MS = 20 * 60 * 1000;

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || 'https://sgdining.github.io').split(',').map(x => x.trim()).filter(Boolean));
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env);
  const headers = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Max-Age': '86400'
  };
  if (origin && allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-store',
      ...corsHeaders(request, env)
    }
  });
}

function assertCors(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return allowedOrigins(env).has(origin);
}

async function getToken(env, forceRefresh = false) {
  if (!forceRefresh && tokenCache.token && Date.now() - tokenCache.obtainedAt < TOKEN_CACHE_MS) {
    return tokenCache.token;
  }
  if (!env.ONEMAP_API_EMAIL || !env.ONEMAP_API_PASSWORD) {
    throw new Error('OneMap Worker secrets are not configured');
  }
  const response = await fetch('https://www.onemap.gov.sg/api/auth/post/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.ONEMAP_API_EMAIL, password: env.ONEMAP_API_PASSWORD })
  });
  if (!response.ok) throw new Error(`OneMap authentication failed (${response.status})`);
  const data = await response.json();
  if (!data.access_token) throw new Error('OneMap authentication returned no access token');
  tokenCache = { token: data.access_token, obtainedAt: Date.now() };
  return tokenCache.token;
}

async function searchOneMap(query, env, forceRefresh = false) {
  const token = await getToken(env, forceRefresh);
  const params = new URLSearchParams({
    searchVal: query,
    returnGeom: 'Y',
    getAddrDetails: 'Y',
    pageNum: '1'
  });
  return fetch(`https://www.onemap.gov.sg/api/common/elastic/search?${params}`, {
    headers: { 'Authorization': token, 'Accept': 'application/json' }
  });
}

function sanitizeResults(data) {
  return (data.results || []).slice(0, 12).map(row => ({
    SEARCHVAL: row.SEARCHVAL || '',
    BLK_NO: row.BLK_NO || '',
    ROAD_NAME: row.ROAD_NAME || '',
    BUILDING: row.BUILDING || '',
    ADDRESS: row.ADDRESS || '',
    POSTAL: row.POSTAL || '',
    LATITUDE: row.LATITUDE || '',
    LONGITUDE: row.LONGITUDE || row.LONGTITUDE || ''
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!assertCors(request, env)) return json(request, env, { error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (request.method !== 'GET') return json(request, env, { error: 'Method not allowed' }, 405);
    if (url.pathname === '/health') return json(request, env, { ok: true, service: 'sgdining-onemap-proxy' });
    if (url.pathname !== '/location-search') return json(request, env, { error: 'Not found' }, 404);

    const query = (url.searchParams.get('q') || '').trim();
    if (query.length < 2 || query.length > 120) return json(request, env, { error: 'q must contain 2 to 120 characters' }, 400);

    try {
      let response = await searchOneMap(query, env, false);
      if (response.status === 401 || response.status === 403) {
        tokenCache = { token: '', obtainedAt: 0 };
        response = await searchOneMap(query, env, true);
      }
      if (!response.ok) return json(request, env, { error: `OneMap search failed (${response.status})` }, 502);
      const data = await response.json();
      return json(request, env, { query, found: Number(data.found || 0), results: sanitizeResults(data) });
    } catch (error) {
      return json(request, env, { error: error?.message || 'OneMap proxy failure' }, 502);
    }
  }
};
