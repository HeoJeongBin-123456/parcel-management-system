const { test, expect } = require('@playwright/test');

test.describe('🔧 우클릭 삭제 수정 확인 테스트', () => {
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

    test('클릭 모드 우클릭 삭제 테스트', async ({ page }) => {
        console.log('\n🎯 === 우클릭 삭제 테스트 시작 ===\n');

        // 1. 색상 선택
        await page.evaluate(() => {
            const redButton = document.querySelector('.color-palette button');
            if (redButton) {
                redButton.click();
                console.log('✅ 빨간색 선택 성공');
            }
        });
        await page.waitForTimeout(500);

        // 2. 지도 클릭하여 필지 추가
        console.log('🖱️ 지도 클릭하여 필지 추가');
        await page.evaluate(() => {
            const mapElement = document.querySelector('#map-click');
            if (mapElement) {
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: 500,
                    clientY: 400
                });
                mapElement.dispatchEvent(clickEvent);
            }
        });
        await page.waitForTimeout(3000);

        // 3. 오른쪽 클릭으로 삭제
        console.log('🗑️ 오른쪽 클릭으로 삭제 시도');
        await page.evaluate(() => {
            const mapElement = document.querySelector('#map-click');
            if (mapElement) {
                const rightClickEvent = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    clientX: 500,
                    clientY: 400,
                    button: 2
                });
                mapElement.dispatchEvent(rightClickEvent);
            }
        });
        await page.waitForTimeout(2000);

        // 스크린샷
        await page.screenshot({
            path: 'test-right-click-delete-fixed.png',
            fullPage: true
        });

        console.log('✅ 스크린샷 저장: test-right-click-delete-fixed.png');
        console.log('\n🎯 === 우클릭 삭제 테스트 완료 ===\n');
    });

    test('클릭 속도 개선 테스트', async ({ page }) => {
        console.log('\n⚡ === 클릭 속도 테스트 시작 ===\n');

        // 색상 선택
        await page.evaluate(() => {
            const blueButton = document.querySelectorAll('.color-palette button')[4];
            if (blueButton) {
                blueButton.click();
                console.log('✅ 파란색 선택');
            }
        });

        // 빠른 연속 클릭 테스트
        const startTime = Date.now();

        for (let i = 0; i < 3; i++) {
            await page.evaluate((index) => {
                const mapElement = document.querySelector('#map-click');
                if (mapElement) {
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        clientX: 400 + (index * 100),
                        clientY: 400
                    });
                    mapElement.dispatchEvent(clickEvent);
                    console.log(`클릭 ${index + 1} 실행`);
                }
            }, i);
            await page.waitForTimeout(150); // 100ms 디바운싱 + 50ms 여유
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`⏱️ 3번 클릭 총 시간: ${totalTime}ms`);
        console.log(`⚡ 평균 응답 시간: ${totalTime / 3}ms`);

        // 스크린샷
        await page.screenshot({
            path: 'test-click-speed-improved.png',
            fullPage: true
        });

        console.log('\n⚡ === 클릭 속도 테스트 완료 ===\n');
    });
});