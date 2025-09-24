const { test, expect } = require('@playwright/test');

test.describe('우클릭 삭제 영구성 테스트', () => {
    test('우클릭 삭제 후 새로고침 시 복원 방지 확인', async ({ page }) => {
        console.log('🚀 테스트 시작');

        // 1. 로그인 페이지 로드
        await page.goto('http://localhost:3000');
        console.log('✅ 페이지 로드 완료');

        // 콘솔 로그 캡처
        const logs = [];
        page.on('console', msg => {
            const text = msg.text();
            logs.push(text);
            if (text.includes('삭제') || text.includes('Supabase') || text.includes('복원')) {
                console.log('[중요 로그]:', text);
            }
        });

        // 2. 개발자 모드로 로그인 건너뛰기
        const devModeBtn = page.locator('#devModeBtn, .dev-mode-btn');
        if (await devModeBtn.count() > 0) {
            console.log('📌 개발자 모드 버튼 발견');
            await devModeBtn.click();
            console.log('✅ 개발자 모드로 진입');
            await page.waitForTimeout(3000);
        }

        // 3. 메인 페이지 로드 대기
        await page.waitForSelector('#map', { timeout: 10000 });
        console.log('✅ 지도 로드 완료');
        await page.waitForTimeout(3000);

        // 4. 클릭 모드 활성화
        const clickModeButton = page.locator('button[data-mode="click"]');
        if (await clickModeButton.count() > 0) {
            await clickModeButton.click();
            console.log('✅ 클릭 모드 활성화');
            await page.waitForTimeout(2000);
        }

        // 5. 지도에서 필지 클릭하여 색칠
        const map = page.locator('#map');
        const box = await map.boundingBox();

        if (box) {
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;

            // 여러 위치에서 필지 찾기
            const positions = [
                { x: centerX, y: centerY },
                { x: centerX - 100, y: centerY },
                { x: centerX + 100, y: centerY },
                { x: centerX, y: centerY - 100 },
                { x: centerX, y: centerY + 100 }
            ];

            let parcelFound = false;
            let clickedX = 0;
            let clickedY = 0;
            let originalPNU = '';

            for (const pos of positions) {
                console.log(`🎯 위치 (${pos.x}, ${pos.y})에서 필지 클릭 시도...`);
                await page.mouse.click(pos.x, pos.y);
                await page.waitForTimeout(2500);

                const parcelNumber = await page.inputValue('#parcelNumber');
                if (parcelNumber && parcelNumber.trim() !== '') {
                    parcelFound = true;
                    clickedX = pos.x;
                    clickedY = pos.y;
                    originalPNU = parcelNumber;
                    console.log(`✅ 필지 발견: ${parcelNumber}`);

                    // 색상 버튼 클릭
                    const colorBtn = page.locator('.color-btn').first();
                    if (await colorBtn.count() > 0) {
                        await colorBtn.click();
                        console.log('✅ 필지 색칠 완료');
                        await page.waitForTimeout(2000);

                        // 색칠 확인 스크린샷
                        await page.screenshot({ path: 'test-1-colored.png' });
                        break;
                    }
                }
            }

            if (!parcelFound) {
                console.log('⚠️ 필지를 찾을 수 없습니다');
                return;
            }

            // 6. 우클릭으로 삭제
            console.log(`🗑️ 우클릭 삭제 시도 (${clickedX}, ${clickedY})...`);
            await page.mouse.click(clickedX, clickedY, { button: 'right' });
            await page.waitForTimeout(3000);

            // 삭제 후 스크린샷
            await page.screenshot({ path: 'test-2-after-delete.png' });

            // 삭제 로그 확인
            const deleteLogFound = logs.some(log =>
                log.includes('우클릭 삭제') ||
                log.includes('Supabase에서 필지 완전 삭제')
            );
            console.log(`삭제 로그 발견: ${deleteLogFound ? '✅' : '❌'}`);

            // 7. 페이지 새로고침
            console.log('🔄 페이지 새로고침...');
            await page.reload();
            await page.waitForSelector('#map', { timeout: 10000 });
            await page.waitForTimeout(5000);

            // 8. 개발 모드 재진입 (필요 시)
            const devModeBtnAfter = page.locator('#devModeBtn, .dev-mode-btn');
            if (await devModeBtnAfter.count() > 0) {
                await devModeBtnAfter.click();
                await page.waitForTimeout(3000);
                await page.waitForSelector('#map', { timeout: 10000 });
            }

            // 9. 클릭 모드 다시 활성화
            const clickModeButtonAfter = page.locator('button[data-mode="click"]');
            if (await clickModeButtonAfter.count() > 0) {
                await clickModeButtonAfter.click();
                console.log('✅ 클릭 모드 재활성화');
                await page.waitForTimeout(2000);
            }

            // 10. 같은 위치 다시 클릭
            console.log(`📍 같은 위치 재클릭 (${clickedX}, ${clickedY})...`);
            await page.mouse.click(clickedX, clickedY);
            await page.waitForTimeout(3000);

            // 필지 정보 확인
            const parcelNumberAfter = await page.inputValue('#parcelNumber');
            console.log(`새로고침 후 필지 번호: ${parcelNumberAfter || '(없음)'}`);

            // 새로고침 후 스크린샷
            await page.screenshot({ path: 'test-3-after-refresh.png' });

            // 11. 색상 복원 여부 확인
            const colorRestored = logs.some(log =>
                log.includes('색상 복원') ||
                log.includes('기존 클릭 필지 색상 복원')
            );

            // 12. 테스트 결과 분석
            console.log('\n');
            console.log('=====================================');
            console.log('📊 테스트 결과 요약');
            console.log('=====================================');
            console.log(`원래 필지 번호: ${originalPNU}`);
            console.log(`삭제 후 필지 번호: ${parcelNumberAfter || '없음'}`);
            console.log(`삭제 로그 확인: ${deleteLogFound ? '✅' : '❌'}`);
            console.log(`색상 복원 로그: ${colorRestored ? '❌ 발견 (문제)' : '✅ 없음 (정상)'}`);
            console.log('-------------------------------------');

            if (parcelNumberAfter === originalPNU && colorRestored) {
                console.log('❌ 테스트 실패: 삭제된 필지가 새로고침 후 복원됨');
                console.log('💡 문제: Supabase에서 제대로 삭제되지 않았거나 다시 로드됨');
            } else if (!parcelNumberAfter || parcelNumberAfter !== originalPNU) {
                console.log('✅ 테스트 성공: 삭제가 영구적으로 유지됨');
            } else {
                console.log('⚠️ 부분 성공: 필지는 있지만 색상은 복원되지 않음');
            }

            console.log('=====================================\n');
            console.log('스크린샷 저장 위치:');
            console.log('  1. test-1-colored.png (색칠 후)');
            console.log('  2. test-2-after-delete.png (삭제 후)');
            console.log('  3. test-3-after-refresh.png (새로고침 후)');
        }
    });
});