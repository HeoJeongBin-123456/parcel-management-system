const { test, expect } = require('@playwright/test');

test.describe('VWorld API 직접 테스트', () => {
    test('Vercel API 엔드포인트 직접 테스트', async ({ page }) => {
        console.log('🔍 API 엔드포인트 직접 호출 테스트');
        
        // Vercel 배포 사이트에서 API 직접 테스트
        try {
            const response = await page.goto('https://naver-field-manager.vercel.app/api/vworld?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=8C62256B-1D08-32FF-AB3C-1FCD67242196&geometry=true&geomFilter=POINT(126.9783882%2037.5666103)&size=10&format=json&crs=EPSG:4326');
            
            console.log('API 응답 상태:', response.status());
            
            if (response.status() === 200) {
                const content = await page.content();
                console.log('✅ API 응답 성공!');
                console.log('📊 응답 내용 일부:', content.substring(0, 500));
                
                // JSON 파싱 시도
                try {
                    const data = JSON.parse(content);
                    console.log('🎯 파싱된 데이터 키:', Object.keys(data));
                    
                    if (data.response?.result?.featureCollection?.features) {
                        console.log('🏗️ 필지 개수:', data.response.result.featureCollection.features.length);
                    }
                } catch (parseError) {
                    console.log('JSON 파싱 실패:', parseError.message);
                }
            } else {
                console.log('❌ API 응답 실패:', response.status());
                const content = await page.content();
                console.log('에러 내용:', content.substring(0, 1000));
            }
            
        } catch (error) {
            console.error('❌ API 호출 실패:', error.message);
        }
    });
    
    test('브라우저 콘솔에서 API 테스트', async ({ page }) => {
        console.log('🌐 브라우저에서 실제 API 호출 테스트');
        
        // Vercel 사이트 방문
        await page.goto('https://naver-field-manager.vercel.app/');
        await page.waitForTimeout(3000);
        
        // 브라우저에서 직접 fetch 호출
        const result = await page.evaluate(async () => {
            try {
                const response = await fetch('/api/vworld?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=8C62256B-1D08-32FF-AB3C-1FCD67242196&geometry=true&geomFilter=POINT(126.9783882%2037.5666103)&size=10&format=json&crs=EPSG:4326');
                
                console.log('API 호출 상태:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('API 성공 응답:', data);
                    return { success: true, data: data, status: response.status };
                } else {
                    const errorText = await response.text();
                    console.log('API 에러 응답:', errorText);
                    return { success: false, error: errorText, status: response.status };
                }
            } catch (error) {
                console.log('Fetch 에러:', error.message);
                return { success: false, error: error.message };
            }
        });
        
        console.log('🎯 브라우저 API 테스트 결과:', result);
        
        if (result.success) {
            console.log('✅ API 정상 작동!');
            if (result.data?.response?.result?.featureCollection?.features) {
                console.log('🏗️ 필지 데이터 개수:', result.data.response.result.featureCollection.features.length);
            }
        } else {
            console.log('❌ API 실패:', result.error);
        }
    });
});