// Vercel Function for color state management
// In-memory cache (will reset on cold starts)
let colorStateCache = {
  parcels: {},
  currentSelection: null,
  updatedAt: new Date().toISOString()
};

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET': {
        res.setHeader('Cache-Control', 'public, s-maxage=1');
        return res.status(200).json(colorStateCache);
      }

      case 'POST':
      case 'PUT': {
        const body = req.body;

        if (body.parcels) {
          colorStateCache.parcels = body.parcels;
        }

        if (body.currentSelection !== undefined) {
          colorStateCache.currentSelection = body.currentSelection;
        }

        colorStateCache.updatedAt = new Date().toISOString();

        return res.status(200).json({
          success: true,
          data: colorStateCache
        });
      }

      case 'DELETE': {
        const { parcelId } = req.query;

        if (parcelId && colorStateCache.parcels[parcelId]) {
          delete colorStateCache.parcels[parcelId];
          colorStateCache.updatedAt = new Date().toISOString();
        }

        return res.status(200).json({
          success: true,
          data: colorStateCache
        });
      }

      default: {
        return res.status(405).json({
          error: '지원하지 않는 메서드입니다'
        });
      }
    }
  } catch (error) {
    console.error('Color state API 오류:', error);

    return res.status(500).json({
      error: '처리 중 오류가 발생했습니다',
      message: error.message
    });
  }
};