// Vercel Edge Function for color state management
export const config = {
  runtime: 'edge',
  regions: ['icn1'],
};

// In-memory cache for Edge Function (will reset on cold starts)
let colorStateCache = {
  parcels: {},
  currentSelection: null,
  updatedAt: new Date().toISOString()
};

export default async function handler(req) {
  const { method } = req;
  const url = new URL(req.url);

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache',
  };

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers
    });
  }

  try {
    switch (method) {
      case 'GET': {
        return new Response(JSON.stringify(colorStateCache), {
          status: 200,
          headers: {
            ...headers,
            'Cache-Control': 'public, s-maxage=1'
          }
        });
      }

      case 'POST':
      case 'PUT': {
        const body = await req.json();

        if (body.parcels) {
          colorStateCache.parcels = body.parcels;
        }

        if (body.currentSelection !== undefined) {
          colorStateCache.currentSelection = body.currentSelection;
        }

        colorStateCache.updatedAt = new Date().toISOString();

        return new Response(JSON.stringify({
          success: true,
          data: colorStateCache
        }), {
          status: 200,
          headers
        });
      }

      case 'DELETE': {
        const parcelId = url.searchParams.get('parcelId');

        if (parcelId && colorStateCache.parcels[parcelId]) {
          delete colorStateCache.parcels[parcelId];
          colorStateCache.updatedAt = new Date().toISOString();
        }

        return new Response(JSON.stringify({
          success: true,
          data: colorStateCache
        }), {
          status: 200,
          headers
        });
      }

      default: {
        return new Response(JSON.stringify({
          error: '지원하지 않는 메서드입니다'
        }), {
          status: 405,
          headers
        });
      }
    }
  } catch (error) {
    console.error('Color state API 오류:', error);

    return new Response(JSON.stringify({
      error: '처리 중 오류가 발생했습니다',
      message: error.message
    }), {
      status: 500,
      headers
    });
  }
}