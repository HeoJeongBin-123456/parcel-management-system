const { test, expect } = require('@playwright/test');

test.describe('클릭 모드 - 색칠된 필지 클릭 테스트', () => {
    test.beforeEach(async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('ERROR') || text.includes('❌')) {
                console.error('[브라우저 에러]:', text);
            } else if (text.includes('🎨') || text.includes('📝') || text.includes('필지')) {
                console.log('[브라우저]:', text);
            }
        });

        // 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000); // 지도 로드 대기
    });

    test('색칠된 필지를 클릭하면 지번이 자동 입력되어야 함', async ({ page }) => {
        // 1. 클릭 모드 확인 또는 전환
        // 이미 클릭 모드인 경우도 처리
        const clickButton = page.locator('button:has-text("🎯 클릭")');
        const clickButtonDisabled = await clickButton.getAttribute('disabled');

        if (clickButtonDisabled === null) {
            // 버튼이 활성화되어 있으면 클릭
            await clickButton.click();
            await page.waitForTimeout(1000);
            console.log('✅ 클릭 모드로 전환 완료');
        } else {
            console.log('✅ 이미 클릭 모드 활성화됨');
        }
        await page.waitForTimeout(1000);

        // 2. 색상 선택 (빨간색) - 프로그래밍 방식으로 설정
        await page.evaluate(() => {
            window.currentColor = '#FF0000';
            if (window.ColorPaletteManager && window.ColorPaletteManager.setColor) {
                window.ColorPaletteManager.setColor('#FF0000');
            }
            console.log('색상 설정: #FF0000');
        });
        await page.waitForTimeout(500);
        console.log('✅ 빨간색 선택 완료');

        // 3. 특정 위치 클릭하여 필지 생성 및 색칠
        const mapElement = await page.locator('#map-click');
        const box = await mapElement.boundingBox();

        // 지도 중앙 약간 위쪽 클릭
        const clickX = box.x + box.width / 2;
        const clickY = box.y + box.height / 2 - 50;

        await page.mouse.click(clickX, clickY);
        await page.waitForTimeout(3000); // API 응답 대기
        console.log('✅ 첫 번째 클릭 - 필지 생성 및 색칠');

        // 4. 지번 입력 확인
        const parcelNumberInput = page.locator('#parcelNumber');
        let firstJibun = await parcelNumberInput.inputValue();
        console.log(`📝 첫 번째 클릭 후 지번: ${firstJibun}`);
        expect(firstJibun).toBeTruthy(); // 지번이 입력되었는지 확인

        // 5. 입력 필드 초기화 (다른 곳 클릭으로 선택 해제)
        await page.mouse.click(box.x + 50, box.y + 50);
        await page.waitForTimeout(1000);

        // 입력 필드 수동으로 비우기
        await parcelNumberInput.fill('');
        await page.waitForTimeout(500);
        console.log('✅ 입력 필드 초기화');

        // 6. 같은 필지 다시 클릭 (색칠된 필지)
        await page.mouse.click(clickX, clickY);
        await page.waitForTimeout(2000);
        console.log('✅ 두 번째 클릭 - 색칠된 필지 재클릭');

        // 7. 지번이 다시 자동 입력되었는지 확인
        let secondJibun = await parcelNumberInput.inputValue();
        console.log(`📝 두 번째 클릭 후 지번: ${secondJibun}`);

        // 검증: 지번이 자동으로 입력되었는지 확인
        expect(secondJibun).toBeTruthy();
        expect(secondJibun).toBe(firstJibun); // 같은 필지이므로 같은 지번이어야 함

        // 8. 스크린샷 캡처
        await page.screenshot({
            path: 'test-results/click-mode-colored-parcel-test.png',
            fullPage: true
        });
        console.log('📸 스크린샷 저장: test-results/click-mode-colored-parcel-test.png');

        // 9. 다른 색상으로 변경 테스트 - 프로그래밍 방식으로 설정
        await page.evaluate(() => {
            window.currentColor = '#0000FF';
            if (window.ColorPaletteManager && window.ColorPaletteManager.setColor) {
                window.ColorPaletteManager.setColor('#0000FF');
            }
            console.log('색상 설정: #0000FF');
        });
        await page.waitForTimeout(500);
        console.log('✅ 파란색 선택');

        // 10. 같은 필지 클릭 (색상 변경)
        await page.mouse.click(clickX, clickY);
        await page.waitForTimeout(2000);
        console.log('✅ 세 번째 클릭 - 색상 변경');

        // 11. 지번이 여전히 입력되는지 확인
        let thirdJibun = await parcelNumberInput.inputValue();
        console.log(`📝 색상 변경 후 지번: ${thirdJibun}`);
        expect(thirdJibun).toBeTruthy();
        expect(thirdJibun).toBe(firstJibun);

        console.log('✅ 테스트 완료: 색칠된 필지 클릭 시 지번 자동 입력 확인');
    });

    test('여러 색칠된 필지 간 전환 시 지번 자동 입력', async ({ page }) => {
        // 1. 클릭 모드 확인 또는 전환
        const clickButton = page.locator('button:has-text("🎯 클릭")');
        const clickButtonDisabled = await clickButton.getAttribute('disabled');

        if (clickButtonDisabled === null) {
            await clickButton.click();
            await page.waitForTimeout(1000);
            console.log('✅ 클릭 모드로 전환 완료');
        } else {
            console.log('✅ 이미 클릭 모드 활성화됨');
        }
        await page.waitForTimeout(1000);

        // 2. 빨간색 선택 - 프로그래밍 방식으로 설정
        await page.evaluate(() => {
            window.currentColor = '#FF0000';
            if (window.ColorPaletteManager && window.ColorPaletteManager.setColor) {
                window.ColorPaletteManager.setColor('#FF0000');
            }
        });
        await page.waitForTimeout(500);

        const mapElement = await page.locator('#map-click');
        const box = await mapElement.boundingBox();

        // 3. 첫 번째 필지 생성
        const click1X = box.x + box.width / 2 - 100;
        const click1Y = box.y + box.height / 2;

        await page.mouse.click(click1X, click1Y);
        await page.waitForTimeout(3000);

        const parcelNumberInput = page.locator('#parcelNumber');
        let jibun1 = await parcelNumberInput.inputValue();
        console.log(`📝 첫 번째 필지 지번: ${jibun1}`);

        // 4. 두 번째 필지 생성 (파란색) - 프로그래밍 방식으로 설정
        await page.evaluate(() => {
            window.currentColor = '#0000FF';
            if (window.ColorPaletteManager && window.ColorPaletteManager.setColor) {
                window.ColorPaletteManager.setColor('#0000FF');
            }
        });
        await page.waitForTimeout(500);

        const click2X = box.x + box.width / 2 + 100;
        const click2Y = box.y + box.height / 2;

        await page.mouse.click(click2X, click2Y);
        await page.waitForTimeout(3000);

        let jibun2 = await parcelNumberInput.inputValue();
        console.log(`📝 두 번째 필지 지번: ${jibun2}`);

        // 5. 첫 번째 필지 다시 클릭
        await page.mouse.click(click1X, click1Y);
        await page.waitForTimeout(2000);

        let reClickJibun1 = await parcelNumberInput.inputValue();
        console.log(`📝 첫 번째 필지 재클릭 지번: ${reClickJibun1}`);
        expect(reClickJibun1).toBe(jibun1);

        // 6. 두 번째 필지 다시 클릭
        await page.mouse.click(click2X, click2Y);
        await page.waitForTimeout(2000);

        let reClickJibun2 = await parcelNumberInput.inputValue();
        console.log(`📝 두 번째 필지 재클릭 지번: ${reClickJibun2}`);
        expect(reClickJibun2).toBe(jibun2);

        // 최종 스크린샷
        await page.screenshot({
            path: 'test-results/multiple-colored-parcels-test.png',
            fullPage: true
        });

        console.log('✅ 테스트 완료: 여러 색칠된 필지 간 전환 시 지번 자동 입력 확인');
    });
});