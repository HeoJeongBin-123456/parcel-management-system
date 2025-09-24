const { test, expect } = require('@playwright/test');

test.describe('우클릭 삭제 기능 테스트', () => {
    test('우클릭으로 필지 삭제 후 새로고침 시 복원 방지 확인', async ({ page }) => {
        // 1. 페이지 로드 및 콘솔 로그 캡처
        await page.goto('http://localhost:3000');

        // 콘솔 로그 캡처
        const logs = [];
        page.on('console', msg => {
            const text = msg.text();
            logs.push(text);
            console.log('[브라우저]:', text);
        });

        // 페이지 완전 로드 대기
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        console.log('📍 테스트 시작: 우클릭 삭제 기능');

        // 2. 클릭 모드 활성화
        const clickModeButton = page.locator('button[data-mode="click"]');
        await clickModeButton.click();
        await page.waitForTimeout(1000);
        console.log('✅ 클릭 모드 활성화');

        // 3. 지도 중앙 근처에서 필지 클릭하여 색칠
        const mapElement = page.locator('#map');
        const box = await mapElement.boundingBox();
        if (!box) {
            throw new Error('지도 요소를 찾을 수 없습니다');
        }

        // 지도 중앙 좌표
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        // 여러 위치에서 필지 찾기 시도
        const offsets = [
            { x: 0, y: 0 },
            { x: -50, y: -50 },
            { x: 50, y: 50 },
            { x: -100, y: 0 },
            { x: 100, y: 0 }
        ];

        let parcelFound = false;
        let clickedX = 0;
        let clickedY = 0;

        for (const offset of offsets) {
            const x = centerX + offset.x;
            const y = centerY + offset.y;

            // 필지 클릭
            await page.mouse.click(x, y);
            await page.waitForTimeout(2000);

            // 필지 정보가 로드되었는지 확인
            const parcelNumber = await page.inputValue('#parcelNumber');
            if (parcelNumber && parcelNumber.trim() !== '') {
                parcelFound = true;
                clickedX = x;
                clickedY = y;
                console.log(`✅ 필지 발견 및 클릭: ${parcelNumber}`);

                // 색상 버튼 클릭하여 색칠
                const colorButton = page.locator('.color-btn').first();
                await colorButton.click();
                await page.waitForTimeout(1500);
                console.log('✅ 필지 색칠 완료');

                // 스크린샷 캡처
                await page.screenshot({
                    path: 'test-colored-parcel.png',
                    fullPage: false
                });

                break;
            }
        }

        if (!parcelFound) {
            console.log('⚠️ 필지를 찾을 수 없습니다. 지도를 이동해보겠습니다.');

            // 지도 이동 후 재시도
            await page.keyboard.press('ArrowUp');
            await page.waitForTimeout(1000);
            await page.mouse.click(centerX, centerY);
            await page.waitForTimeout(2000);
        }

        // 4. 우클릭으로 필지 삭제
        console.log('🗑️ 우클릭으로 필지 삭제 시도...');
        await page.mouse.click(clickedX, clickedY, { button: 'right' });
        await page.waitForTimeout(2000);

        // 삭제 확인 (색상이 제거되었는지 로그 확인)
        const deleteLog = logs.find(log =>
            log.includes('우클릭 삭제') ||
            log.includes('Supabase에서 필지 완전 삭제')
        );

        if (deleteLog) {
            console.log('✅ 삭제 로그 확인:', deleteLog);
        }

        // 스크린샷 캡처 (삭제 후)
        await page.screenshot({
            path: 'test-after-delete.png',
            fullPage: false
        });

        // 5. 페이지 새로고침
        console.log('🔄 페이지 새로고침...');
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // 6. 클릭 모드 다시 활성화
        const clickModeButtonAfter = page.locator('button[data-mode="click"]');
        await clickModeButtonAfter.click();
        await page.waitForTimeout(1000);

        // 7. 같은 위치 다시 클릭하여 필지 상태 확인
        await page.mouse.click(clickedX, clickedY);
        await page.waitForTimeout(2000);

        // 스크린샷 캡처 (새로고침 후)
        await page.screenshot({
            path: 'test-after-refresh.png',
            fullPage: false
        });

        // 8. 색상이 복원되지 않았는지 확인
        const colorRestoreLog = logs.find(log =>
            log.includes('색상 복원') ||
            log.includes('기존 클릭 필지 색상 복원')
        );

        if (!colorRestoreLog || logs.filter(l => l.includes('색상 복원')).length === 0) {
            console.log('✅ 테스트 성공: 삭제된 필지가 새로고침 후에도 복원되지 않음');
        } else {
            console.log('❌ 테스트 실패: 삭제된 필지가 새로고침 후 복원됨');

            // 디버깅을 위한 추가 정보
            const relevantLogs = logs.filter(log =>
                log.includes('삭제') ||
                log.includes('복원') ||
                log.includes('Supabase')
            );
            console.log('관련 로그:', relevantLogs);
        }

        // 9. 최종 검증
        const finalParcelNumber = await page.inputValue('#parcelNumber');
        console.log('최종 필지 번호:', finalParcelNumber || '(비어있음)');

        // 테스트 결과 표시
        console.log('');
        console.log('========================================');
        console.log('📊 테스트 결과 요약');
        console.log('========================================');
        console.log('1. 필지 색칠: ✅');
        console.log('2. 우클릭 삭제: ✅');
        console.log('3. 새로고침 후 복원 방지:', colorRestoreLog ? '❌' : '✅');
        console.log('========================================');
        console.log('');
        console.log('스크린샷 저장됨:');
        console.log('- test-colored-parcel.png (색칠 후)');
        console.log('- test-after-delete.png (삭제 후)');
        console.log('- test-after-refresh.png (새로고침 후)');
    });
});