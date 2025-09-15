const { test, expect } = require('@playwright/test');

test.describe('🗑️ 우클릭 삭제 테스트', () => {
    test.beforeEach(async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            console.log(`[브라우저]: ${text}`);
        });

        // 다이얼로그 처리
        page.on('dialog', async dialog => {
            console.log(`[다이얼로그]: ${dialog.message()}`);
            await dialog.accept();
        });

        // 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(2000);
    });

    test('클릭 모드에서 우클릭 삭제 테스트', async ({ page }) => {
        console.log('\n🎯 === 우클릭 삭제 테스트 시작 ===\n');

        // 1. 먼저 필지 추가 (빨간색 선택 후 클릭)
        await page.click('.color-palette button:first-child');
        console.log('✅ 빨간색 선택');

        // 지도 클릭하여 필지 추가
        await page.click('#map-click', { position: { x: 500, y: 400 } });
        console.log('✅ 필지 추가 클릭');
        await page.waitForTimeout(3000);

        // 2. 오른쪽 클릭으로 삭제 시도
        console.log('🗑️ 오른쪽 클릭으로 삭제 시도');
        await page.click('#map-click', {
            button: 'right',
            position: { x: 500, y: 400 }
        });

        await page.waitForTimeout(2000);

        // 스크린샷
        await page.screenshot({
            path: 'test-right-click-delete-result.png',
            fullPage: true
        });

        console.log('✅ 스크린샷 저장: test-right-click-delete-result.png');
        console.log('\n🎯 === 우클릭 삭제 테스트 완료 ===\n');
    });
});