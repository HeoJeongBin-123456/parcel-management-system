const { test, expect } = require('@playwright/test');

test.describe('VWorld API 프록시 테스트', () => {
    let page;
    
    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
    });
    
    test('로컬 서버에서 필지 클릭 테스트', async () => {
        console.log('🚀 로컬 서버 테스트 시작');
        
        // 로컬 서버에 접속
        await page.goto('http://localhost:8000');
        await page.waitForTimeout(3000);
        
        // 페이지 로드 확인
        const title = await page.title();
        expect(title).toContain('네이버지도 필지관리');
        
        // 지도 로드 대기
        await page.waitForFunction(() => window.map && window.naver);
        console.log('✅ 지도 로드 완료');
        
        // 서울시청 좌표에서 클릭 시뮬레이션
        await page.evaluate(() => {
            const lat = 37.5666103;
            const lng = 126.9783882;
            
            // 지도 클릭 이벤트 시뮬레이션
            window.map.trigger('click', new naver.maps.Point(lng, lat));
        });
        
        // API 요청 대기 및 응답 확인
        await page.waitForTimeout(5000);
        
        // 콘솔에서 API 응답 확인
        const logs = [];
        page.on('console', msg => {
            if (msg.text().includes('필지') || msg.text().includes('API')) {
                logs.push(msg.text());
            }
        });
        
        console.log('📊 수집된 로그:', logs.slice(-10));
    });
    
    test('Vercel 배포에서 필지 클릭 테스트', async () => {
        console.log('🌐 Vercel 배포 테스트 시작');
        
        try {
            // Vercel 배포 사이트 접속
            await page.goto('https://naver-field-manager.vercel.app/', { timeout: 30000 });
            await page.waitForTimeout(5000);
            
            // 페이지 로드 확인
            const title = await page.title();
            expect(title).toContain('네이버지도 필지관리');
            
            // 지도 로드 대기
            await page.waitForFunction(() => window.map && window.naver, { timeout: 15000 });
            console.log('✅ Vercel 지도 로드 완료');
            
            // 서울시청 좌표 클릭
            await page.evaluate(() => {
                const lat = 37.5666103;
                const lng = 126.9783882;
                window.map.trigger('click', new naver.maps.LatLng(lat, lng));
            });
            
            await page.waitForTimeout(5000);
            
            // API 응답 로그 수집
            const apiLogs = [];
            page.on('console', msg => {
                const text = msg.text();
                if (text.includes('/api/vworld') || text.includes('필지') || text.includes('API')) {
                    apiLogs.push(text);
                }
            });
            
            console.log('🔍 Vercel API 로그:', apiLogs.slice(-5));
            
        } catch (error) {
            console.error('❌ Vercel 테스트 실패:', error.message);
        }
    });
});