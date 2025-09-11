const { test, expect } = require('@playwright/test');

test.describe('빠른 대체 API 검색', () => {
    test('공공데이터포털 지적도 API 직접 확인', async ({ page }) => {
        console.log('🔍 공공데이터포털 지적도 API 직접 확인...');
        
        const apiUrls = [
            'https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15057511', // 국토교통부 실거래가
            'https://www.data.go.kr/data/15057895/openapi.do', // 지적도 관련
            'https://www.data.go.kr/data/15084817/openapi.do', // 부동산 가격정보
        ];
        
        for (const apiUrl of apiUrls) {
            try {
                console.log(`📋 확인 중: ${apiUrl}`);
                await page.goto(apiUrl, { timeout: 15000 });
                await page.waitForTimeout(2000);
                
                const apiInfo = await page.evaluate(() => {
                    const title = document.querySelector('h1, .api-title, .title')?.textContent?.trim() || '';
                    const endpoint = document.querySelector('pre, code, .endpoint')?.textContent?.trim() || '';
                    const params = document.querySelector('.param, .parameter, .요청변수')?.textContent?.trim() || '';
                    
                    return {
                        title: title.substring(0, 100),
                        endpoint: endpoint.substring(0, 200),
                        params: params.substring(0, 200)
                    };
                });
                
                console.log(`  제목: ${apiInfo.title}`);
                console.log(`  엔드포인트: ${apiInfo.endpoint}`);
                console.log(`  파라미터: ${apiInfo.params}`);
                console.log('');
                
            } catch (error) {
                console.log(`  ⚠️ 접근 실패: ${error.message}`);
            }
        }
    });
    
    test('한국국토정보공사 API 확인', async ({ page }) => {
        console.log('🏛️ 한국국토정보공사 VWorld 대체 서비스 확인...');
        
        try {
            // 한국국토정보공사 공식 사이트
            await page.goto('https://www.lx.or.kr/', { timeout: 15000 });
            await page.waitForTimeout(3000);
            
            // API나 오픈데이터 링크 찾기
            const links = await page.evaluate(() => {
                const foundLinks = [];
                document.querySelectorAll('a').forEach(link => {
                    const text = link.textContent?.toLowerCase();
                    if (text && (text.includes('api') || text.includes('오픈데이터') || text.includes('지적') || text.includes('공간정보'))) {
                        foundLinks.push({
                            text: link.textContent?.trim(),
                            href: link.href
                        });
                    }
                });
                return foundLinks.slice(0, 5);
            });
            
            console.log('📋 한국국토정보공사 관련 링크:');
            links.forEach((link, index) => {
                console.log(`  ${index + 1}. ${link.text} - ${link.href}`);
            });
            
        } catch (error) {
            console.error('❌ 한국국토정보공사 사이트 확인 실패:', error.message);
        }
    });
    
    test('네이버/카카오 지도 API 실제 테스트', async ({ page }) => {
        console.log('📍 네이버/카카오 지도 API 실제 호출 테스트...');
        
        // 네이버 지도 Geocoding API 테스트 (무료 API)
        try {
            const naverResult = await page.evaluate(async () => {
                try {
                    // 네이버 지도 역지오코딩 API (주소 -> 좌표)
                    const response = await fetch('https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=126.9783882,37.5666103&sourcecrs=epsg:4326&targetcrs=epsg:4326&orders=legalcode', {
                        headers: {
                            'X-NCP-APIGW-API-KEY-ID': 'test', // 실제로는 키 필요
                            'X-NCP-APIGW-API-KEY': 'test'
                        }
                    });
                    
                    return {
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries())
                    };
                } catch (error) {
                    return { error: error.message };
                }
            });
            
            console.log('📋 네이버 지오코딩 API 응답:', naverResult);
            
        } catch (error) {
            console.log('⚠️ 네이버 API 테스트 실패:', error.message);
        }
        
        // 카카오 지도 Local API 테스트
        try {
            const kakaoResult = await page.evaluate(async () => {
                try {
                    // 카카오 좌표-행정구역정보 변환 API
                    const response = await fetch('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=126.9783882&y=37.5666103', {
                        headers: {
                            'Authorization': 'KakaoAK test' // 실제로는 키 필요
                        }
                    });
                    
                    return {
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries())
                    };
                } catch (error) {
                    return { error: error.message };
                }
            });
            
            console.log('📋 카카오 Local API 응답:', kakaoResult);
            
        } catch (error) {
            console.log('⚠️ 카카오 API 테스트 실패:', error.message);
        }
    });
    
    test('무료 공개 지도 API 탐색', async ({ page }) => {
        console.log('🌍 무료 공개 지도 API 서비스 탐색...');
        
        // OpenStreetMap 기반 서비스들 확인
        const osmServices = [
            'https://nominatim.openstreetmap.org/reverse?format=json&lat=37.5666103&lon=126.9783882&zoom=18',
            'https://api.mapbox.com/geocoding/v5/mapbox.places/126.9783882,37.5666103.json?access_token=test',
        ];
        
        for (const serviceUrl of osmServices) {
            try {
                console.log(`🔍 테스트 중: ${serviceUrl}`);
                
                const result = await page.evaluate(async (url) => {
                    try {
                        const response = await fetch(url);
                        const data = await response.text();
                        
                        return {
                            status: response.status,
                            contentType: response.headers.get('content-type'),
                            dataPreview: data.substring(0, 200),
                            dataLength: data.length
                        };
                    } catch (error) {
                        return { error: error.message };
                    }
                }, serviceUrl);
                
                console.log(`  결과:`, result);
                
                // 성공적인 응답인 경우 더 자세히 확인
                if (result.status === 200 && result.dataLength > 0) {
                    console.log(`  ✅ 사용 가능한 API 발견!`);
                    console.log(`  미리보기: ${result.dataPreview}`);
                }
                
            } catch (error) {
                console.log(`  ❌ 실패: ${error.message}`);
            }
        }
    });
});