const { test, expect } = require('@playwright/test');

test.describe('🎯 간단한 클릭 테스트', () => {
    test('클릭 이벤트 및 저장 확인', async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            console.log(`[브라우저]: ${msg.text()}`);
        });

        // 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000);

        // 1. 색상 선택 (빨간색)
        await page.evaluate(() => {
            // 빨간색 버튼 직접 클릭
            const redButton = document.querySelector('.color-item');
            if (redButton) {
                redButton.click();
                console.log('✅ 빨간색 선택됨');
            }

            // 현재 색상 확인
            const currentColor = window.currentColor || window.ColorPaletteManager?.getCurrentColor()?.hex;
            console.log('현재 색상:', currentColor);
            return currentColor;
        });

        await page.waitForTimeout(500);

        // 2. 지도 클릭 이벤트 발생
        console.log('🖱️ 지도 클릭 시도...');

        // 직접 클릭 핸들러 호출
        const result = await page.evaluate(async () => {
            // 클릭 핸들러 직접 호출
            if (window.handleClickModeLeftClick) {
                console.log('클릭 핸들러 직접 호출');
                await window.handleClickModeLeftClick(37.5665, 126.9780);

                // 잠시 대기
                await new Promise(resolve => setTimeout(resolve, 2000));

                // localStorage 확인
                const savedData = localStorage.getItem('parcelData');
                const savedColors = localStorage.getItem('parcelColors');

                return {
                    savedData: savedData ? JSON.parse(savedData).length : 0,
                    savedColors: savedColors ? Object.keys(JSON.parse(savedColors)).length : 0,
                    clickParcelsSize: window.clickParcels ? window.clickParcels.size : 0
                };
            } else {
                console.log('handleClickModeLeftClick 함수를 찾을 수 없음');
                return null;
            }
        });

        console.log('저장 결과:', result);

        // 3. 새로고침
        await page.reload();
        await page.waitForTimeout(3000);

        // 4. 복원 확인
        const restoredData = await page.evaluate(() => {
            return {
                clickParcelsSize: window.clickParcels ? window.clickParcels.size : 0,
                polygonsSize: window.clickModePolygons ? window.clickModePolygons.size : 0,
                localStorage: localStorage.getItem('parcelData')
            };
        });

        console.log('복원 결과:', restoredData);

        // 스크린샷
        await page.screenshot({
            path: 'test-simple-click.png',
            fullPage: true
        });
    });
});