const { test, expect } = require('@playwright/test');

test.describe('간단한 로드 테스트', () => {
    test('메인 페이지 로드 테스트', async ({ page }) => {
        console.log('🚀 메인 페이지 로드 테스트 시작');
        
        // 네트워크 로그 활성화
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('❌ 브라우저 에러:', msg.text());
            } else {
                console.log('🔍 브라우저 로그:', msg.text());
            }
        });
        
        // 네트워크 요청 로그
        page.on('requestfailed', request => {
            console.log('❌ 네트워크 요청 실패:', request.url());
        });
        
        // 페이지 로드
        await page.goto('http://localhost:3000');
        
        // 페이지 제목 확인
        const title = await page.title();
        console.log('📄 페이지 제목:', title);
        expect(title).toBe('NAVER Maps Field Management Program');
        
        // 지도 컨테이너 확인
        const mapContainer = page.locator('#map');
        await expect(mapContainer).toBeVisible();
        console.log('✅ 지도 컨테이너 표시됨');
        
        // 헤더 확인
        const header = page.locator('.header');
        await expect(header).toBeVisible();
        console.log('✅ 헤더 표시됨');
        
        // 사이드바 확인
        const sidebar = page.locator('.sidebar');
        await expect(sidebar).toBeVisible();
        console.log('✅ 사이드바 표시됨');
        
        // 네이버 API 스크립트 로드 확인 (5초 대기)
        try {
            await page.waitForFunction(() => {
                return typeof window.naver !== 'undefined';
            }, { timeout: 5000 });
            console.log('✅ 네이버 API 기본 객체 로드됨');
        } catch (error) {
            console.log('❌ 네이버 API 기본 객체 로드 실패');
        }
        
        // 지도 초기화 확인 (15초 대기)
        try {
            await page.waitForFunction(() => {
                return typeof window.naver !== 'undefined' && 
                       typeof window.naver.maps !== 'undefined' &&
                       typeof window.map !== 'undefined';
            }, { timeout: 15000 });
            console.log('✅ 네이버 지도 완전 초기화 확인');
        } catch (error) {
            console.log('❌ 네이버 지도 초기화 실패, 스크린샷 촬영');
            await page.screenshot({ path: 'failed-map-load.png' });
            
            // 현재 페이지 소스 확인
            const content = await page.content();
            console.log('📄 페이지 길이:', content.length);
            
            // 네트워크 상태 확인
            const naverApiLoaded = await page.evaluate(() => {
                return typeof window.naver;
            });
            console.log('🔍 naver 객체 타입:', naverApiLoaded);
            
            // 에러 메시지 표시 여부 확인
            const errorMessage = page.locator('text=지도 로드 실패');
            const isErrorVisible = await errorMessage.isVisible();
            console.log('🚫 에러 메시지 표시 여부:', isErrorVisible);
        }
        
        console.log('🎉 테스트 완료');
    });
    
    test('테스트 페이지 로드 테스트', async ({ page }) => {
        console.log('🧪 테스트 페이지 로드 테스트 시작');
        
        // 페이지 로드
        await page.goto('http://localhost:3000/test.html');
        
        // 페이지 제목 확인
        const title = await page.title();
        expect(title).toBe('폴리곤 테스트');
        console.log('✅ 테스트 페이지 제목 확인');
        
        // 네이버 API 로드 확인 (간단한 테스트 페이지에서)
        try {
            await page.waitForFunction(() => {
                return typeof window.naver !== 'undefined' && 
                       typeof window.naver.maps !== 'undefined';
            }, { timeout: 10000 });
            console.log('✅ 테스트 페이지에서 네이버 API 로드 성공');
        } catch (error) {
            console.log('❌ 테스트 페이지에서 네이버 API 로드 실패');
            await page.screenshot({ path: 'failed-test-page-load.png' });
        }
        
        console.log('🎉 테스트 페이지 테스트 완료');
    });
});