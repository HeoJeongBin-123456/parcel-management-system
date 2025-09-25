// Vercel Edge Function for VWorld API proxy
export const config = {
  runtime: 'edge',
  regions: ['icn1'], // 서울 리전
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const apikey = searchParams.get('apikey') || process.env.VWORLD_API_KEY;
  const format = searchParams.get('format') || 'json';
  const crs = searchParams.get('crs') || 'EPSG:4326';

  if (!lat || !lng) {
    return new Response(JSON.stringify({
      error: '위도와 경도가 필요합니다'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const params = new URLSearchParams({
      key: apikey,
      point: `${lng},${lat}`,
      format,
      crs,
      size: '10',
      page: '1',
      type: 'parcel',
      domain: 'https://parcel-management-system.vercel.app'
    });

    const vworldUrl = `https://api.vworld.kr/req/data?${params}`;

    const response = await fetch(vworldUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ParcelManagementSystem/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`VWorld API 오류: ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
        'X-Cache-Status': 'edge'
      }
    });
  } catch (error) {
    console.error('VWorld API 프록시 오류:', error);

    return new Response(JSON.stringify({
      error: 'VWorld API 호출 실패',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });
  }
}