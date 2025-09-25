export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return withCORS(new Response(null, { status: 204 }));
  }

  const url = new URL(request.url);
  const q = url.searchParams;

  // Extract params with defaults (align with server.js behavior)
  const service = q.get('service') || 'data';
  const requestType = q.get('request') || 'GetFeature';
  const dataType = q.get('data') || 'LP_PA_CBND_BUBUN';
  const geometry = q.get('geometry') || 'true';
  const format = q.get('format') || 'json';
  const crs = q.get('crs') || 'EPSG:4326';
  const size = q.get('size') || '10';

  let geomFilter = q.get('geomFilter') || '';
  const lat = q.get('lat');
  const lng = q.get('lng');
  if (!geomFilter && lat && lng) {
    geomFilter = `POINT(${lng} ${lat})`;
  }

  // Key priority: env -> query key -> fallback constant
  const FALLBACK_KEY = 'E5B1657B-9B6F-3A4B-91EF-98512BE931A1';
  const apiKeys = [env?.VWORLD_KEY, q.get('key'), FALLBACK_KEY].filter(Boolean);

  const params = new URLSearchParams();
  params.set('service', service);
  params.set('request', requestType);
  params.set('data', dataType);
  params.set('geometry', geometry);
  params.set('format', format);
  params.set('crs', crs);
  params.set('size', size);
  if (geomFilter) params.set('geomFilter', geomFilter);

  // Simple cache key (GET only)
  const baseParams = new URLSearchParams(params);
  // key is excluded from cache key so successful key can be reused
  const cacheKey = new Request('https://api.vworld.kr/req/data?' + baseParams.toString(), { method: 'GET' });
  const cache = caches.default;

  try {
    // Serve from cache first
    const cached = await cache.match(cacheKey);
    if (cached) {
      return withCORS(cached);
    }

    // Try keys in order
    let lastErr;
    for (const key of apiKeys) {
      const p = new URLSearchParams(baseParams);
      p.set('key', key);
      const apiUrl = 'https://api.vworld.kr/req/data?' + p.toString();

      try {
        const res = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json,text/plain;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Cloudflare Workers)',
            // 일부 API는 Referer 기반 도메인 검증을 수행함
            'Referer': env?.VWORLD_REFERER || `https://${url.host}`
          }
        });

        let data;
        try {
          data = await res.clone().json();
        } catch {
          const text = await res.text();
          data = { _raw: text };
        }

        // 상태 코드 200이 아니면 그대로 전달(디버깅 편의)
        if (!res.ok) {
          lastErr = { status: res.status, data };
          continue;
        }

        const ok = (data?.response?.status === 'OK') || (Array.isArray(data?.features) && data.features.length > 0);
        if (ok) {
          const body = JSON.stringify(data);
          const cfRes = new Response(body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
          // Cache for 10 minutes to reduce API calls
          cfRes.headers.set('Cache-Control', 'public, max-age=0, s-maxage=600');
          await cache.put(cacheKey, cfRes.clone());
          return withCORS(cfRes);
        }
        lastErr = { status: res.status, data };
      } catch (e) {
        lastErr = { error: stringifyErr(e) };
      }
    }

    return withCORS(new Response(JSON.stringify({ error: 'All API keys failed', detail: lastErr }), {
      status: typeof lastErr?.status === 'number' ? lastErr.status : 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    }));
  } catch (err) {
    return withCORS(new Response(JSON.stringify({ error: 'Proxy error', message: stringifyErr(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    }));
  }
}

function withCORS(res) {
  const clone = new Response(res.body, res);
  clone.headers.set('Access-Control-Allow-Origin', '*');
  clone.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  clone.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return clone;
}

function stringifyErr(e) {
  if (!e) return null;
  try { return typeof e === 'string' ? e : (e.message || JSON.stringify(e)); } catch { return 'unknown'; }
}
