export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        console.log('=== VWorld API 프록시 시작 ===');
        console.log('요청 쿼리:', req.query);
        
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
        
        // VWorld API 키들 - 공식 개발자 키 우선
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
                console.log(`API 키 ${i + 1}/${apiKeys.length} 시도: ${currentKey.substring(0, 8)}...`);
                
                // URL 인코딩 제대로 처리
                const params = new URLSearchParams();
                params.append('service', service);
                params.append('request', requestType);
                params.append('data', dataType);
                params.append('key', currentKey);
                params.append('geometry', geometry);
                params.append('geomFilter', geomFilter);
                params.append('size', size);
                params.append('format', format);
                params.append('crs', crs);
                
                // 도메인 추가 (일부 API 키에서 필요할 수 있음)
                if (i === 1) {
                    params.append('domain', 'https://naver-field-manager.vercel.app');
                }
                
                // VWorld 표준 API 엔드포인트 사용
                const vworldUrl = `https://api.vworld.kr/req/data?${params.toString()}`;
                console.log('요청 URL:', vworldUrl);
                
                // VWorld API 호출 - 타임아웃과 에러 핸들링 강화
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃
                
                const response = await fetch(vworldUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Node.js',
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                console.log(`API 키 ${i + 1} 응답:`, response.status, response.statusText);
                console.log('응답 헤더:', Object.fromEntries(response.headers.entries()));
                
                if (response.ok) {
                    const responseText = await response.text();
                    console.log('응답 길이:', responseText.length);
                    console.log('응답 샘플:', responseText.substring(0, 300) + '...');
                    
                    // JSON 파싱 시도
                    let data_result;
                    try {
                        data_result = JSON.parse(responseText);
                        console.log(`API 키 ${i + 1} JSON 파싱 성공`);
                        
                        // VWorld API 에러 체크
                        if (data_result.response?.status === 'ERROR') {
                            const errorMsg = data_result.response.error?.text || 'VWorld API 에러';
                            console.log(`API 키 ${i + 1} VWorld 에러:`, errorMsg);
                            throw new Error(`VWorld API Error: ${errorMsg}`);
                        }
                        
                        // 성공 - 데이터 있는지 확인
                        const features = data_result.response?.result?.featureCollection?.features;
                        console.log(`API 키 ${i + 1} 필지 개수:`, features?.length || 0);
                        
                        successResult = data_result;
                        console.log(`✅ API 키 ${i + 1} 성공!`);
                        break; // 성공하면 루프 종료
                        
                    } catch (parseError) {
                        console.log(`API 키 ${i + 1} JSON 파싱 실패:`, parseError.message);
                        console.log('파싱 실패한 응답:', responseText.substring(0, 500));
                        throw new Error(`JSON 파싱 실패: ${parseError.message}`);
                    }
                } else {
                    const errorText = await response.text();
                    console.log(`API 키 ${i + 1} HTTP 에러:`, response.status, errorText.substring(0, 200));
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
            } catch (keyError) {
                console.log(`❌ API 키 ${i + 1} 실패:`, keyError.message);
                lastError = keyError;
                
                // 마지막 키가 아니면 다음 키 시도
                if (i < apiKeys.length - 1) {
                    console.log(`다음 API 키로 재시도...`);
                    continue;
                }
            }
        }
        
        // 모든 키가 실패한 경우
        if (!successResult) {
            console.error('❌ 모든 API 키 실패');
            console.error('마지막 에러:', lastError?.message);
            
            res.status(500).json({
                error: 'VWorld API 호출 실패',
                message: `모든 API 키 실패. 마지막 에러: ${lastError?.message || 'Unknown error'}`,
                keysTried: apiKeys.length,
                timestamp: new Date().toISOString()
            });
            return;
        }
        
        console.log('✅ VWorld API 프록시 성공');
        
        // 성공 결과 반환
        res.status(200).json(successResult);
        
    } catch (error) {
        console.error('=== VWorld 프록시 치명적 에러 ===');
        console.error('에러 메시지:', error.message);
        console.error('에러 스택:', error.stack);
        
        res.status(500).json({
            error: 'VWorld API 프록시 오류',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}