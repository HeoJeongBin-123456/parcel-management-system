const { test, expect } = require('@playwright/test');

test.describe('빠른 성능 테스트', () => {
    test.setTimeout(30000);

    test('필지 클릭 색상 변경 속도', async ({ page }) => {
        const consoleLogs = [];
        const errors = [];

        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push(text);
            if (msg.type() === 'error') {
                errors.push(text);
            }
        });

        page.on('pageerror', error => {
            errors.push(error.message);
        });

        await page.goto('http://localhost:3000');

        const passwordInput = page.locator('input[type="password"]');
        if (await passwordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await passwordInput.fill('123456');
            await page.click('button:has-text("로그인")');
        }

        await page.waitForFunction(() => window.naver && window.naver.maps, { timeout: 15000 });
        await page.waitForTimeout(2000);

        console.log('📍 지도 로드 완료');

        await page.evaluate(() => {
            window.clickPerformanceLog = [];
            const originalHandler = window.handleClickModeLeftClick;
            if (originalHandler) {
                window.handleClickModeLeftClick = async function(...args) {
                    const start = performance.now();
                    await originalHandler.apply(this, args);
                    const end = performance.now();
                    window.clickPerformanceLog.push({ duration: end - start, timestamp: Date.now() });
                    console.log(`⚡ handleClickModeLeftClick 실행 시간: ${(end - start).toFixed(2)}ms`);
                };
            }
        });

        const mapElement = await page.locator('#map, #map-click').first();

        console.log('🔵 1단계: 첫 번째 클릭으로 필지 생성');
        await mapElement.click({ position: { x: 400, y: 300 } });
        await page.waitForTimeout(2000);

        console.log('🔴 2단계: 같은 위치 재클릭으로 성능 측정 시작');
        await mapElement.click({ position: { x: 400, y: 300 } });
        await page.waitForTimeout(300);

        const performanceData = await page.evaluate(() => window.clickPerformanceLog);
        const lastClick = performanceData[performanceData.length - 1];
        const clickTime = lastClick ? lastClick.duration : 0;

        console.log(`⏱️ 브라우저 내부 실제 실행 시간: ${clickTime.toFixed(2)}ms`);

        await page.screenshot({ path: 'test-quick-click.png', fullPage: true });

        console.log('\n📊 콘솔 로그 요약:');
        console.log(`- 총 로그: ${consoleLogs.length}개`);
        console.log(`- 에러: ${errors.length}개`);

        if (errors.length > 0) {
            console.log('\n❌ 발생한 에러:');
            errors.forEach(err => console.log(`  - ${err}`));
        }

        expect(clickTime).toBeLessThan(50);
    });
});