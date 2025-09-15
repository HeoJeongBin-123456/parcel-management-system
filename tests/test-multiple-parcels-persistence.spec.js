const { test, expect } = require('@playwright/test');

test.describe('🎨 다중 필지 색상 지속성 테스트', () => {
    test('여러 필지 색칠 후 새로고침 테스트', async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('저장') || text.includes('복원') || text.includes('필지')) {
                console.log(`[브라우저]: ${text}`);
            }
        });

        // localStorage 초기화
        await page.goto('http://localhost:3000');
        await page.evaluate(() => {
            localStorage.removeItem('parcelData');
            localStorage.removeItem('parcelColors');
            console.log('✅ localStorage 초기화 완료');
        });
        await page.waitForTimeout(2000);

        console.log('\n🎨 === 다중 필지 색칠 테스트 시작 ===\n');

        // 1. 첫 번째 필지 - 빨간색
        console.log('1️⃣ 첫 번째 필지 (빨간색)');
        await page.evaluate(() => {
            const redButton = document.querySelector('.color-item');
            if (redButton) redButton.click();
        });
        await page.waitForTimeout(500);

        await page.evaluate(async () => {
            if (window.handleClickModeLeftClick) {
                await window.handleClickModeLeftClick(37.5665, 126.9780); // 서울시청
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        });

        // 2. 두 번째 필지 - 파란색
        console.log('2️⃣ 두 번째 필지 (파란색)');
        await page.evaluate(() => {
            const blueButton = document.querySelectorAll('.color-item')[4];
            if (blueButton) blueButton.click();
        });
        await page.waitForTimeout(500);

        await page.evaluate(async () => {
            if (window.handleClickModeLeftClick) {
                await window.handleClickModeLeftClick(37.5636, 126.9756); // 덕수궁
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        });

        // 3. 세 번째 필지 - 노란색
        console.log('3️⃣ 세 번째 필지 (노란색)');
        await page.evaluate(() => {
            const yellowButton = document.querySelectorAll('.color-item')[2];
            if (yellowButton) yellowButton.click();
        });
        await page.waitForTimeout(500);

        await page.evaluate(async () => {
            if (window.handleClickModeLeftClick) {
                await window.handleClickModeLeftClick(37.5712, 126.9767); // 경복궁
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        });

        // 저장 확인
        const savedBefore = await page.evaluate(() => {
            const data = localStorage.getItem('parcelData');
            const colors = localStorage.getItem('parcelColors');
            return {
                parcels: data ? JSON.parse(data).length : 0,
                colors: colors ? Object.keys(JSON.parse(colors)).length : 0
            };
        });
        console.log(`📦 저장된 데이터: ${savedBefore.parcels}개 필지, ${savedBefore.colors}개 색상`);

        // 스크린샷 (새로고침 전)
        await page.screenshot({
            path: 'test-multiple-before-refresh.png',
            fullPage: true
        });

        // 새로고침
        console.log('🔄 페이지 새로고침...');
        await page.reload();
        await page.waitForTimeout(3000);

        // 복원 확인
        const restoredData = await page.evaluate(() => {
            const savedData = localStorage.getItem('parcelData');
            const savedColors = localStorage.getItem('parcelColors');
            return {
                localStorage: savedData ? JSON.parse(savedData).length : 0,
                colors: savedColors ? Object.keys(JSON.parse(savedColors)).length : 0,
                clickParcels: window.clickParcels ? window.clickParcels.size : 0,
                polygons: window.clickModePolygons ? window.clickModePolygons.size : 0
            };
        });

        console.log(`✅ 복원된 데이터:
        - localStorage: ${restoredData.localStorage}개
        - 색상: ${restoredData.colors}개
        - clickParcels: ${restoredData.clickParcels}개
        - 폴리곤: ${restoredData.polygons}개`);

        // 스크린샷 (새로고침 후)
        await page.screenshot({
            path: 'test-multiple-after-refresh.png',
            fullPage: true
        });

        // 검증
        expect(restoredData.localStorage).toBe(3);
        expect(restoredData.colors).toBe(3);
        expect(restoredData.clickParcels).toBe(3);
        expect(restoredData.polygons).toBe(3);

        console.log('\n🎨 === 다중 필지 색칠 테스트 완료 ===\n');
    });
});