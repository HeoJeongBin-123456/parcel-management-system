// Supabase Edge Function (Deno) for VWorld proxy
// Route: /functions/v1/vworld

const ALLOW_ORIGIN = Deno.env.get('ALLOW_ORIGIN') || '*';
const VWORLD_KEYS = (Deno.env.get('VWORLD_KEYS') || '').split(',').map(s => s.trim()).filter(Boolean);
const VWORLD_KEY = Deno.env.get('VWORLD_KEY') || '';
const FALLBACK_KEY = 'E5B1657B-9B6F-3A4B-91EF-98512BE931A1'; // 범용 키
const REFERER = Deno.env.get('VWORLD_REFERER') || '';

function withCORS(r: Response) {
  const res = new Response(r.body, r);
  res.headers.set('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Vary', 'Origin');
  return res;
}

function decodeGeomFilter(value: string | null) {
  if (!value) return '';
  try {
    const decoded = decodeURIComponent(value);
    if (/^POINT\(/.test(decoded)) return decoded;
  } catch {}
  return value;
}

function buildKeyList(queryKey?: string | null) {
  const list: string[] = [];
  list.push(FALLBACK_KEY);
  if (VWORLD_KEY) list.push(VWORLD_KEY);
  if (VWORLD_KEYS.length) list.push(...VWORLD_KEYS);
  if (queryKey) list.push(queryKey);
  return Array.from(new Set(list.filter(Boolean)));
}

async function proxy(params: URLSearchParams) {
  const keyParam = params.get('key');
  const keys = buildKeyList(keyParam);

  // 공통 파라미터 디폴트
  if (!params.has('service')) params.set('service', 'data');
  if (!params.has('request')) params.set('request', 'GetFeature');
  if (!params.has('data')) params.set('data', 'LP_PA_CBND_BUBUN');
  if (!params.has('geometry')) params.set('geometry', 'true');
  if (!params.has('format')) params.set('format', 'json');
  if (!params.has('crs')) params.set('crs', 'EPSG:4326');

  // geomFilter 정규화(이중 인코딩 방지)
  const gf = decodeGeomFilter(params.get('geomFilter'));
  if (gf) params.set('geomFilter', gf);

  for (const key of keys) {
    const p = new URLSearchParams(params);
    p.set('key', key);
    const url = `https://api.vworld.kr/req/data?${p.toString()}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json,text/plain;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
          ...(REFERER ? { 'Referer': REFERER, 'Origin': REFERER } : {}),
        },
      });

      let data: unknown;
      try {
        data = await res.clone().json();
      } catch {
        data = await res.text();
      }

      if (res.ok) {
        const body = typeof data === 'string' ? data : JSON.stringify(data);
        const out = new Response(body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
        return withCORS(out);
      }
      // 다음 키 시도
    } catch (_) {
      // 무시 후 다음 키 시도
    }
  }

  return withCORS(new Response(JSON.stringify({ error: 'All keys failed' }), { status: 502, headers: { 'Content-Type': 'application/json' } }));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return withCORS(new Response(null, { status: 204 }));

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const params = new URLSearchParams(url.search);
      return await proxy(params);
    }

    if (req.method === 'POST') {
      const ct = req.headers.get('Content-Type') || '';
      let params = new URLSearchParams();
      if (ct.includes('application/json')) {
        const body = await req.json().catch(() => ({} as any));
        Object.entries(body || {}).forEach(([k, v]) => {
          if (v !== undefined && v !== null) params.set(k, String(v));
        });
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        const body = await req.text();
        params = new URLSearchParams(body);
      }
      return await proxy(params);
    }

    return withCORS(new Response('Method Not Allowed', { status: 405 }));
  } catch (e) {
    return withCORS(new Response(JSON.stringify({ error: 'Edge error', message: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
  }
});
