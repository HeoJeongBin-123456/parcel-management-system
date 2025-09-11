const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// 포트 설정 - 3000 또는 4000
const PORT = process.env.PORT || 3000;

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
            size = '10',
            format = 'json',
            crs = 'EPSG:4326'
        } = req.query;
        
        // VWorld API 키들 (메인: 범용키, 백업: 로컬호스트 제한키들)
        const apiKeys = [
            'E5B1657B-9B6F-3A4B-91EF-98512BE931A1', // 메인: 범용키 (제한없음)
            key || 'E5B1657B-9B6F-3A4B-91EF-98512BE931A1', // fallback
            'C1C06245-E008-3F27-BD9E-9CBA4BE0F918', // 백업: localhost:3000
            '200C6A0D-D0A2-3E72-BADD-B385BB283CAE', // 백업: localhost:4000
            '37325C63-ACC1-39FA-949D-F4E7F4C9BCF3'  // 백업: localhost:5000
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

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
const server = app.listen(PORT, () => {
    console.log(`
    ======================================
    🚀 서버가 시작되었습니다!
    
    📍 로컬: http://localhost:${PORT}
    📍 네트워크: http://127.0.0.1:${PORT}
    
    ✅ NAVER Maps Field Management Program
    ======================================
    `);
});

// 포트 충돌 시 다른 포트로 재시도
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        const newPort = PORT === 3000 ? 4000 : 3000;
        console.log(`⚠️ 포트 ${PORT}이 사용 중입니다. 포트 ${newPort}로 재시도합니다...`);
        
        app.listen(newPort, () => {
            console.log(`
            ======================================
            🚀 서버가 포트 ${newPort}에서 시작되었습니다!
            
            📍 로컬: http://localhost:${newPort}
            📍 네트워크: http://127.0.0.1:${newPort}
            
            ✅ NAVER Maps Field Management Program
            ======================================
            `);
        });
    } else {
        console.error('서버 시작 오류:', err);
    }
});