const { test, expect } = require('@playwright/test');

test.describe('폴리곤 렌더링 빠른 테스트', () => {
    test('지도 로드 및 기본 기능 확인', async ({ page }) => {
        console.log('🚀 빠른 테스트 시작');
        
        // 콘솔 로그 수집
        const logs = [];
        page.on('console', msg => {
            logs.push(msg.text());
        });
        
        // 로컬 서버 접속
        await page.goto('http://127.0.0.1:3000', { timeout: 10000 });
        console.log('✅ 페이지 로드 완료');
        
        // 지도 로드 대기 (짧게)
        await page.waitForTimeout(3000);
        
        // 네이버 지도가 로드되었는지 확인
        const mapLoaded = await page.evaluate(() => {
            return typeof window.naver !== 'undefined' && 
                   typeof window.map !== 'undefined';
        });
        
        console.log(`🗺️ 지도 로드 상태: ${mapLoaded ? '성공' : '실패'}`);
        
        // 관련 로그만 필터링
        const relevantLogs = logs.filter(log => 
            log.includes('폴리곤') || 
            log.includes('geometry') || 
            log.includes('좌표') ||
            log.includes('Overpass') ||
            log.includes('ERROR') ||
            log.includes('WARN')
        );
        
        if (relevantLogs.length > 0) {
            console.log('📋 관련 로그:');
            relevantLogs.slice(0, 10).forEach(log => {
                console.log(`  ${log}`);
            });
        }
        
        console.log('🏁 빠른 테스트 완료');
    });
});