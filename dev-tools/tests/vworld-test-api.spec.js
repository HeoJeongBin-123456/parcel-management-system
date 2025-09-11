const { test, expect } = require('@playwright/test');

test.describe('VWorld 테스트 API 검증', () => {
    test('VWorld 테스트 API 직접 호출', async ({ page }) => {
        console.log('🧪 VWorld 테스트 API 호출 시작');
        
        try {
            // 테스트 API 직접 호출
            const response = await page.goto('https://naver-field-manager.vercel.app/api/test-vworld');
            
            console.log('테스트 API 응답 상태:', response.status());
            
            if (response.status() === 200) {
                const content = await page.content();
                console.log('✅ 테스트 API 응답 성공!');
                
                try {
                    const data = JSON.parse(content);
                    console.log('📊 응답 데이터:', {
                        success: data.success,
                        message: data.message,
                        hasData: !!data.data
                    });
                    
                    if (data.success && data.data) {
                        console.log('🎯 VWorld API 정상 작동 확인!');
                        
                        // 필지 데이터 확인
                        if (data.data.response?.result?.featureCollection?.features) {
                            console.log('🏗️ 필지 개수:', data.data.response.result.featureCollection.features.length);
                        }
                    } else {
                        console.log('⚠️ API 응답은 받았지만 데이터가 없음');
                    }
                    
                } catch (parseError) {
                    console.log('❌ JSON 파싱 실패:', parseError.message);
                    console.log('원본 응답:', content.substring(0, 1000));
                }
            } else {
                console.log('❌ 테스트 API 실패:', response.status());
                const content = await page.content();
                console.log('에러 내용:', content.substring(0, 1000));
            }
            
        } catch (error) {
            console.error('❌ 테스트 API 호출 실패:', error.message);
        }
    });
    
    test('VWorld API 다양한 키 테스트', async ({ page }) => {
        console.log('🔑 여러 API 키로 테스트 시작');
        
        const testKeys = [
            'CEB482F7-CF7C-333B-B02C-4E7111C3AC77', // 공식 테스트 키
            '8C62256B-1D08-32FF-AB3C-1FCD67242196',
            'BBAC532E-A56D-34CF-B520-CE68E8D6D52A'
        ];
        
        for (let i = 0; i < testKeys.length; i++) {
            const key = testKeys[i];
            console.log(`\n🔑 API 키 ${i + 1} 테스트: ${key.substring(0, 8)}...`);
            
            try {
                // Vercel API 프록시를 통해 테스트
                const result = await page.evaluate(async (testKey) => {
                    try {
                        const response = await fetch(`/api/vworld?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${testKey}&geometry=true&geomFilter=POINT(126.9783882%2037.5666103)&size=10&format=json&crs=EPSG:4326`);
                        
                        if (response.ok) {
                            const data = await response.json();
                            return { 
                                success: true, 
                                status: response.status,
                                hasFeatures: !!(data.response?.result?.featureCollection?.features?.length),
                                featureCount: data.response?.result?.featureCollection?.features?.length || 0
                            };
                        } else {
                            const errorText = await response.text();
                            return { 
                                success: false, 
                                status: response.status,
                                error: errorText
                            };
                        }
                    } catch (error) {
                        return { 
                            success: false, 
                            error: error.message 
                        };
                    }
                }, key);
                
                if (result.success) {
                    console.log(`✅ 키 ${i + 1} 성공! 필지 ${result.featureCount}개 발견`);
                    break; // 하나라도 성공하면 중단
                } else {
                    console.log(`❌ 키 ${i + 1} 실패:`, result.error || result.status);
                }
                
            } catch (error) {
                console.log(`❌ 키 ${i + 1} 테스트 실패:`, error.message);
            }
        }
    });
});