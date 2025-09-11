export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        console.log('=== VWorld 테스트 API 시작 ===');
        
        // VWorld 공식 테스트 키 사용
        const testKey = 'CEB482F7-CF7C-333B-B02C-4E7111C3AC77';
        
        // 서울시청 좌표로 테스트
        const testUrl = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${testKey}&geometry=true&geomFilter=POINT(126.9783882 37.5666103)&size=10&format=json&crs=EPSG:4326`;
        
        console.log('테스트 URL:', testUrl);
        
        // API 호출
        const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; VWorldTestProxy/1.0)',
                'Accept': 'application/json'
            }
        });
        
        console.log('테스트 응답 상태:', response.status, response.statusText);
        console.log('응답 헤더:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const responseText = await response.text();
            console.log('응답 길이:', responseText.length);
            console.log('응답 샘플:', responseText.substring(0, 500));
            
            try {
                const data = JSON.parse(responseText);
                console.log('✅ 테스트 성공!');
                
                // 결과 반환
                res.status(200).json({
                    success: true,
                    message: 'VWorld API 테스트 성공',
                    data: data,
                    timestamp: new Date().toISOString()
                });
                
            } catch (parseError) {
                console.error('JSON 파싱 실패:', parseError);
                res.status(200).json({
                    success: false,
                    message: 'JSON 파싱 실패',
                    response: responseText,
                    error: parseError.message
                });
            }
        } else {
            const errorText = await response.text();
            console.error('API 에러:', errorText);
            
            res.status(response.status).json({
                success: false,
                message: 'VWorld API 에러',
                status: response.status,
                error: errorText
            });
        }
        
    } catch (error) {
        console.error('=== 테스트 API 에러 ===');
        console.error(error);
        
        res.status(500).json({
            success: false,
            message: '테스트 API 호출 실패',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}