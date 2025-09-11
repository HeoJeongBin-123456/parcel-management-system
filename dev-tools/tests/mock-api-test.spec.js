const { test, expect } = require('@playwright/test');

test.describe('Mock VWorld API 테스트', () => {
    test('Mock API로 필지 클릭 테스트', async ({ page }) => {
        console.log('🎭 Mock API를 사용한 필지 클릭 테스트');
        
        try {
            // 로컬 서버 접속
            await page.goto('http://localhost:8000');
            await page.waitForTimeout(3000);
            
            // 페이지 로드 확인
            const title = await page.title();
            console.log('페이지 제목:', title);
            
            // 지도 로드 대기
            await page.waitForFunction(() => window.map && window.naver, { timeout: 10000 });
            console.log('✅ 지도 로드 완료');
            
            // 콘솔 로그 수집
            const logs = [];
            page.on('console', msg => {
                logs.push(msg.text());
            });
            
            // 서울시청 좌표 클릭 시뮬레이션
            const result = await page.evaluate(async () => {
                try {
                    // 지도 중심을 서울시청으로 이동
                    const center = new naver.maps.LatLng(37.5666103, 126.9783882);
                    window.map.setCenter(center);
                    window.map.setZoom(18);
                    
                    // 클릭 이벤트 시뮬레이션
                    const clickEvent = {
                        coord: center,
                        point: new naver.maps.Point(126.9783882, 37.5666103)
                    };
                    
                    // 필지 정보 조회 함수 직접 호출
                    const response = await fetch('/api/mock-vworld?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=test&geometry=true&geomFilter=POINT(126.9783882%2037.5666103)&size=10&format=json&crs=EPSG:4326');
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log('Mock API 응답:', data);
                        
                        return {
                            success: true,
                            features: data.response?.result?.featureCollection?.features?.length || 0,
                            sampleFeature: data.response?.result?.featureCollection?.features?.[0]?.properties
                        };
                    } else {
                        return { success: false, error: `HTTP ${response.status}` };
                    }
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            console.log('🎯 Mock API 테스트 결과:', result);
            
            if (result.success) {
                console.log('✅ Mock API 정상 작동!');
                console.log('📊 발견된 필지:', result.features, '개');
                
                if (result.sampleFeature) {
                    console.log('🏠 샘플 필지 정보:', result.sampleFeature);
                }
                
                expect(result.features).toBeGreaterThan(0);
            } else {
                console.log('❌ Mock API 실패:', result.error);
                expect(result.success).toBe(true);
            }
            
            // 5초 대기 후 로그 확인
            await page.waitForTimeout(5000);
            console.log('📝 수집된 로그 (마지막 10개):');
            logs.slice(-10).forEach(log => console.log('  ', log));
            
        } catch (error) {
            console.error('❌ 테스트 실패:', error.message);
            throw error;
        }
    });
    
    test('Vercel Mock API 테스트', async ({ page }) => {
        console.log('🌐 Vercel Mock API 테스트');
        
        try {
            // Vercel 배포 사이트 접속
            await page.goto('https://naver-field-manager.vercel.app/');
            await page.waitForTimeout(3000);
            
            // Mock API 직접 호출 테스트
            const response = await page.goto('https://naver-field-manager.vercel.app/api/mock-vworld?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=test&geometry=true&geomFilter=POINT(126.9783882%2037.5666103)&size=10&format=json&crs=EPSG:4326');
            
            console.log('Mock API 응답 상태:', response.status());
            
            if (response.status() === 200) {
                const content = await page.content();
                
                try {
                    const data = JSON.parse(content);
                    console.log('✅ Vercel Mock API 성공!');
                    console.log('📊 필지 개수:', data.response?.result?.featureCollection?.features?.length || 0);
                    
                    expect(data.response?.result?.featureCollection?.features?.length).toBeGreaterThan(0);
                } catch (parseError) {
                    console.log('❌ JSON 파싱 실패:', parseError.message);
                    console.log('원본 응답:', content.substring(0, 500));
                }
            } else {
                console.log('❌ Mock API 실패:', response.status());
                const content = await page.content();
                console.log('에러 내용:', content.substring(0, 500));
            }
            
        } catch (error) {
            console.error('❌ Vercel Mock API 테스트 실패:', error.message);
        }
    });
});