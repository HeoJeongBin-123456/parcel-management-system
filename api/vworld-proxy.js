// Vercel Function for VWorld API proxy
module.exports = async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { lat, lng, apikey, format = 'json', crs = 'EPSG:4326' } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      error: '위도와 경도가 필요합니다'
    });
  }

  const apiKey = apikey || process.env.VWORLD_API_KEY;

  try {
    const params = new URLSearchParams({
      key: apiKey,
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

    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json(data);
  } catch (error) {
    console.error('VWorld API 프록시 오류:', error);

    return res.status(500).json({
      error: 'VWorld API 호출 실패',
      message: error.message
    });
  }
};