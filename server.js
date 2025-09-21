const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const fsp = fs.promises;
require('dotenv').config();

const app = express();

// 포트 설정 - 3000 또는 4000
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const COLOR_STATE_FILE = path.join(DATA_DIR, 'color-state.json');

const DEFAULT_COLOR_PALETTE = [
    { index: 0, hex: '#FF0000', name: '빨강' },
    { index: 1, hex: '#FFA500', name: '주황' },
    { index: 2, hex: '#FFFF00', name: '노랑' },
    { index: 3, hex: '#00FF00', name: '초록' },
    { index: 4, hex: '#0000FF', name: '파랑' },
    { index: 5, hex: '#000000', name: '검정' },
    { index: 6, hex: '#FFFFFF', name: '흰색' },
    { index: 7, hex: '#87CEEB', name: '하늘색' }
];

function createDefaultColorState() {
    return {
        parcels: {},
        currentSelection: null,
        updatedAt: new Date().toISOString()
    };
}

function normalizeColorState(state) {
    if (!state || typeof state !== 'object') {
        return createDefaultColorState();
    }

    const normalized = createDefaultColorState();
    normalized.parcels = state.parcels && typeof state.parcels === 'object' ? state.parcels : {};
    normalized.currentSelection = typeof state.currentSelection === 'number' ? state.currentSelection : null;
    normalized.updatedAt = state.updatedAt || new Date().toISOString();
    return normalized;
}

function loadColorStateFromDisk() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        if (fs.existsSync(COLOR_STATE_FILE)) {
            const raw = fs.readFileSync(COLOR_STATE_FILE, 'utf8');
            if (raw && raw.trim().length > 0) {
                const parsed = JSON.parse(raw);
                return normalizeColorState(parsed);
            }
        }
    } catch (error) {
        console.error('색상 상태 로드 실패:', error);
    }

    return createDefaultColorState();
}

async function persistColorState() {
    try {
        await fsp.mkdir(DATA_DIR, { recursive: true });
        const payload = { ...colorState, updatedAt: new Date().toISOString() };
        await fsp.writeFile(COLOR_STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
        colorState.updatedAt = payload.updatedAt;
    } catch (error) {
        console.error('색상 상태 저장 실패:', error);
    }
}

function computeUsageCounts() {
    const usage = Array(DEFAULT_COLOR_PALETTE.length).fill(0);
    Object.values(colorState.parcels).forEach((parcel) => {
        if (typeof parcel.colorIndex === 'number' && parcel.colorIndex >= 0 && parcel.colorIndex < usage.length) {
            usage[parcel.colorIndex] += 1;
        }
    });
    return usage;
}

function serializePalette() {
    const usage = computeUsageCounts();
    return DEFAULT_COLOR_PALETTE.map((color) => ({
        index: color.index,
        hex: color.hex,
        name: color.name,
        usageCount: usage[color.index]
    }));
}

function listColoredParcels() {
    return Object.values(colorState.parcels).map((parcel) => ({
        pnu: parcel.pnu,
        colorIndex: parcel.colorIndex,
        colorHex: parcel.colorHex,
        colorName: parcel.colorName,
        updatedAt: parcel.updatedAt,
        mode: parcel.mode,
        parcelData: parcel.parcelData
    }));
}

let colorState = loadColorStateFromDisk();

const DEV_LOGIN_ENABLED = process.env.DEV_LOGIN_USER || process.env.DEV_LOGIN_PASSWORD || process.env.DEV_LOGIN_CODE;

// CORS 설정
app.use(cors());
app.use(express.json());

// 정적 파일 제공
app.use(express.static('public'));
app.use('/assets', express.static(path.join(__dirname, 'srcassets')));
app.use('/components', express.static(path.join(__dirname, 'srccomponents')));
app.use('/pages', express.static(path.join(__dirname, 'srcpages')));

// VWorld API 프록시 라우트
app.get('/api/vworld', async (req, res) => {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
        console.log('VWorld API 프록시 요청:', req.query);

        // 쿼리 파라미터 추출
        const {
            service = 'data',
            request: requestType = 'GetFeature',
            data: dataType = 'LP_PA_CBND_BUBUN',
            key,
            geometry = 'true',
            geomFilter = '',
            lat,
            lng,
            size = '10',
            format = 'json',
            crs = 'EPSG:4326'
        } = req.query;

        // lat/lng가 있고 geomFilter가 없으면 geomFilter 생성
        let finalGeomFilter = geomFilter;
        if (lat && lng && !geomFilter) {
            finalGeomFilter = `POINT(${lng} ${lat})`;
            console.log('lat/lng -> geomFilter 변환:', finalGeomFilter);
        }
        
        // VWorld API 키들 (고정된 범용 키)
        const apiKeys = [
            'E5B1657B-9B6F-3A4B-91EF-98512BE931A1', // 지정된 고정 키
            key || 'E5B1657B-9B6F-3A4B-91EF-98512BE931A1' // fallback
        ];
        
        let lastError;
        let successResult;
        
        // 각 키를 순서대로 시도
        for (let i = 0; i < apiKeys.length; i++) {
            const currentKey = apiKeys[i];
            
            try {
                console.log(`API 키 ${i + 1}/${apiKeys.length} 시도 중...`);

                const params = new URLSearchParams();
                params.append('service', service);
                params.append('request', requestType);
                params.append('data', dataType);
                params.append('key', currentKey);
                params.append('geometry', geometry);
                params.append('format', format);
                params.append('crs', crs);

                if (finalGeomFilter) {
                    params.append('geomFilter', finalGeomFilter);
                }
                params.append('size', size);
                
                const url = `https://api.vworld.kr/req/data?${params.toString()}`;
                
                const { default: fetch } = await import('node-fetch');
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                
                const data = await response.json();
                
                if (data.response?.status === 'OK' || (data.features && data.features.length > 0)) {
                    console.log(`✓ API 키 성공: ${currentKey.substring(0, 8)}...`);
                    successResult = data;
                    break;
                } else {
                    console.log(`✗ API 키 실패: ${data.response?.status || '데이터 없음'}`);
                    lastError = data;
                }
            } catch (error) {
                console.error(`API 키 ${currentKey.substring(0, 8)}... 오류:`, error.message);
                lastError = error;
            }
        }
        
        if (successResult) {
            return res.json(successResult);
        } else {
            console.error('모든 API 키 실패');
            return res.status(500).json({
                error: '모든 API 키가 실패했습니다',
                lastError: lastError
            });
        }
        
    } catch (error) {
        console.error('프록시 오류:', error);
        res.status(500).json({ 
            error: '프록시 서버 오류', 
            message: error.message 
        });
    }
});

// VWorld API 프록시 라우트 (클라이언트 호환성)
app.get('/api/vworld-proxy', async (req, res) => {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
        console.log('VWorld API 프록시 요청 (vworld-proxy):', req.query);
        
        // 쿼리 파라미터 추출
        const {
            service = 'data',
            request: requestType = 'GetFeature', 
            data: dataType = 'LP_PA_CBND_BUBUN',
            key,
            geometry = 'true',
            geomFilter = '',
            size = '10',
            format = 'json',
            crs = 'EPSG:4326'
        } = req.query;
        
        // VWorld API 키들 (고정된 범용 키)
        const apiKeys = [
            'E5B1657B-9B6F-3A4B-91EF-98512BE931A1', // 지정된 고정 키
            key || 'E5B1657B-9B6F-3A4B-91EF-98512BE931A1' // fallback
        ];
        
        let lastError;
        let successResult;
        
        // 각 키를 순서대로 시도
        for (let i = 0; i < apiKeys.length; i++) {
            const currentKey = apiKeys[i];
            
            try {
                console.log(`API 키 ${i + 1}/${apiKeys.length} 시도 중... (vworld-proxy)`);
                
                const params = new URLSearchParams();
                params.append('service', service);
                params.append('request', requestType);
                params.append('data', dataType);
                params.append('key', currentKey);
                params.append('geometry', geometry);
                params.append('format', format);
                params.append('crs', crs);
                
                if (geomFilter) {
                    params.append('geomFilter', geomFilter);
                }
                params.append('size', size);
                
                const url = `https://api.vworld.kr/req/data?${params.toString()}`;
                
                const { default: fetch } = await import('node-fetch');
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                
                const data = await response.json();
                
                if (data.response?.status === 'OK' || (data.features && data.features.length > 0)) {
                    console.log(`✓ API 키 성공: ${currentKey.substring(0, 8)}... (vworld-proxy)`);
                    successResult = data;
                    break;
                } else {
                    console.log(`✗ API 키 실패: ${data.response?.status || '데이터 없음'} (vworld-proxy)`);
                    lastError = data;
                }
            } catch (error) {
                console.error(`API 키 ${currentKey.substring(0, 8)}... 오류 (vworld-proxy):`, error.message);
                lastError = error;
            }
        }
        
        if (successResult) {
            return res.json(successResult);
        } else {
            console.error('모든 API 키 실패 (vworld-proxy)');
            return res.status(500).json({
                error: '모든 API 키가 실패했습니다',
                lastError: lastError
            });
        }
        
    } catch (error) {
        console.error('프록시 오류 (vworld-proxy):', error);
        res.status(500).json({ 
            error: '프록시 서버 오류', 
            message: error.message 
        });
    }
});

app.get('/api/colors/palette', (req, res) => {
    const palette = serializePalette();
    return res.json({
        colors: palette,
        currentSelection: colorState.currentSelection,
        updatedAt: colorState.updatedAt
    });
});

app.post('/api/auth/dev-login', (req, res) => {
    if (!DEV_LOGIN_ENABLED) {
        return res.status(404).json({ error: 'Developer login is disabled.' });
    }

    const { username, password, code } = req.body || {};
    const expectedUser = process.env.DEV_LOGIN_USER;
    const expectedPassword = process.env.DEV_LOGIN_PASSWORD;
    const expectedCode = process.env.DEV_LOGIN_CODE;

    let isValid = false;

    if (expectedCode && code && code === expectedCode) {
        isValid = true;
    }

    if (!isValid && expectedUser && expectedPassword) {
        if (username === expectedUser && password === expectedPassword) {
            isValid = true;
        }
    }

    if (!isValid) {
        return res.status(401).json({ error: 'Invalid developer credentials.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const minutes = parseInt(process.env.DEV_LOGIN_DURATION_MINUTES || '720', 10); // default 12h
    const expiresAt = Date.now() + minutes * 60 * 1000;

    const profile = {
        name: process.env.DEV_LOGIN_NAME || 'Developer Account',
        email: process.env.DEV_LOGIN_EMAIL || `${expectedUser || 'dev'}@local`,
        role: 'developer'
    };

    return res.json({
        token,
        expiresAt,
        profile
    });
});

app.post('/api/colors/reset', async (req, res) => {
    try {
        colorState = createDefaultColorState();
        await persistColorState();
        return res.json({ success: true });
    } catch (error) {
        console.error('색상 상태 초기화 실패:', error);
        return res.status(500).json({ success: false, error: '색상 상태 초기화에 실패했습니다.' });
    }
});

app.post('/api/parcel/color', async (req, res) => {
    try {
        const { pnu, colorIndex, parcelData = {}, mode } = req.body || {};

        if (!pnu || typeof pnu !== 'string' || pnu.trim().length === 0) {
            return res.status(400).json({ error: 'PNU가 필요합니다.' });
        }

        if (typeof colorIndex !== 'number' || Number.isNaN(colorIndex)) {
            return res.status(400).json({ error: 'colorIndex는 숫자여야 합니다.' });
        }

        if (colorIndex < 0 || colorIndex >= DEFAULT_COLOR_PALETTE.length) {
            return res.status(400).json({ error: '유효하지 않은 colorIndex 입니다.' });
        }

        const normalizedPnu = pnu.trim();
        const existing = colorState.parcels[normalizedPnu];

        if (existing && existing.colorIndex === colorIndex) {
            delete colorState.parcels[normalizedPnu];
            colorState.currentSelection = null;
            await persistColorState();

            return res.json({
                pnu: normalizedPnu,
                colorIndex: null,
                colorHex: null,
                wasToggled: true,
                removed: true
            });
        }

        const paletteItem = DEFAULT_COLOR_PALETTE[colorIndex];
        const resolvedMode = typeof mode === 'string' && mode.trim().length > 0
            ? mode.trim()
            : (typeof parcelData.mode === 'string' && parcelData.mode.trim().length > 0
                ? parcelData.mode.trim()
                : 'click');

        const sanitizedParcelData = {
            lat: typeof parcelData.lat === 'number' ? parcelData.lat : null,
            lng: typeof parcelData.lng === 'number' ? parcelData.lng : null,
            parcelName: typeof parcelData.parcelName === 'string' ? parcelData.parcelName : null
        };

        const record = {
            pnu: normalizedPnu,
            colorIndex,
            colorHex: paletteItem.hex,
            colorName: paletteItem.name,
            updatedAt: new Date().toISOString(),
            mode: resolvedMode,
            parcelData: sanitizedParcelData
        };

        colorState.parcels[normalizedPnu] = record;
        colorState.currentSelection = colorIndex;
        await persistColorState();

        return res.json({
            ...record,
            wasToggled: false
        });
    } catch (error) {
        console.error('색상 적용 중 오류:', error);
        return res.status(500).json({ error: '색상 적용에 실패했습니다.' });
    }
});

app.delete('/api/parcel/color/:pnu', async (req, res) => {
    try {
        const pnu = req.params.pnu;
        if (!pnu || pnu.trim().length === 0) {
            return res.status(400).json({ error: 'PNU가 필요합니다.' });
        }

        const normalizedPnu = pnu.trim();
        const existing = colorState.parcels[normalizedPnu];

        if (!existing) {
            return res.status(404).json({ error: '해당 PNU의 색상 정보가 없습니다.' });
        }

        delete colorState.parcels[normalizedPnu];
        colorState.currentSelection = null;
        await persistColorState();

        return res.json({
            pnu: normalizedPnu,
            previousColorIndex: existing.colorIndex,
            previousColorHex: existing.colorHex,
            markerRemoved: true
        });
    } catch (error) {
        console.error('색상 제거 중 오류:', error);
        return res.status(500).json({ error: '색상 제거에 실패했습니다.' });
    }
});

app.get('/api/parcels/colored', (req, res) => {
    try {
        const { mode, colorIndex } = req.query;

        let parcels = listColoredParcels();

        if (typeof mode === 'string' && mode.trim().length > 0) {
            const normalizedMode = mode.trim();
            parcels = parcels.filter((parcel) => (parcel.mode || 'click') === normalizedMode);
        }

        if (colorIndex !== undefined) {
            const parsedColorIndex = parseInt(colorIndex, 10);
            if (Number.isNaN(parsedColorIndex)) {
                return res.status(400).json({ error: 'colorIndex 쿼리 값이 유효하지 않습니다.' });
            }

            parcels = parcels.filter((parcel) => parcel.colorIndex === parsedColorIndex);
        }

        return res.json({
            parcels,
            total: parcels.length,
            palette: serializePalette()
        });
    } catch (error) {
        console.error('색칠된 필지 조회 중 오류:', error);
        return res.status(500).json({ error: '색칠된 필지 조회에 실패했습니다.' });
    }
});

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
function startServer() {
    const server = app.listen(PORT, () => {
        console.log(`
        ======================================
        🚀 서버가 시작되었습니다!
        
        📍 로컬: http://localhost:${PORT}
        📍 네트워크: http://127.0.0.1:${PORT}
        
        ✅ parcel-management-system
        ======================================
        `);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ 포트 ${PORT}이 이미 사용 중입니다. 서버를 종료합니다.`);
            console.error('이미 실행 중인 개발 서버가 있다면 종료 후 다시 시도해주세요.');
            process.exit(1);
        } else {
            console.error('서버 시작 오류:', err);
            process.exit(1);
        }
    });
}

if (require.main === module) {
    startServer();
}

module.exports = app;
