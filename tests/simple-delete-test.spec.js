const { test, expect } = require('@playwright/test');

test.describe('간단한 삭제 테스트', () => {
    test('페이지 로드 및 우클릭 삭제 테스트', async ({ page }) => {
        console.log('🚀 테스트 시작');

        // 페이지 로드
        await page.goto('http://localhost:3000');
        console.log('✅ 페이지 로드 완료');

        // 콘솔 로그 캡처
        const logs = [];
        page.on('console', msg => {
            const text = msg.text();
            logs.push(text);
            console.log('[콘솔]:', text);
        });

        // 대기
        await page.waitForTimeout(5000);

        // 페이지 스크린샷
        await page.screenshot({ path: 'page-loaded.png' });
        console.log('✅ 스크린샷 저장: page-loaded.png');

        // 버튼 존재 확인
        const clickButton = await page.locator('button[data-mode="click"]').count();
        console.log(`클릭 모드 버튼 개수: ${clickButton}`);

        if (clickButton > 0) {
            // 클릭 모드 활성화
            await page.locator('button[data-mode="click"]').first().click();
            console.log('✅ 클릭 모드 활성화');
            await page.waitForTimeout(2000);

            // 지도 중앙 클릭 (필지 선택)
            const map = page.locator('#map');
            const box = await map.boundingBox();

            if (box) {
                const centerX = box.x + box.width / 2;
                const centerY = box.y + box.height / 2;

                // 필지 클릭
                console.log('🎯 필지 클릭 시도...');
                await page.mouse.click(centerX, centerY);
                await page.waitForTimeout(3000);

                // 필지 번호 확인
                const parcelNumber = await page.inputValue('#parcelNumber');
                console.log(`필지 번호: ${parcelNumber || '없음'}`);

                if (parcelNumber) {
                    // 색상 버튼 클릭
                    const colorBtn = page.locator('.color-btn').first();
                    if (await colorBtn.count() > 0) {
                        await colorBtn.click();
                        console.log('✅ 필지 색칠 완료');
                        await page.waitForTimeout(2000);

                        // 색칠 후 스크린샷
                        await page.screenshot({ path: 'colored.png' });

                        // 우클릭으로 삭제
                        console.log('🗑️ 우클릭 삭제 시도...');
                        await page.mouse.click(centerX, centerY, { button: 'right' });
                        await page.waitForTimeout(3000);

                        // 삭제 후 스크린샷
                        await page.screenshot({ path: 'after-delete.png' });

                        // 삭제 로그 확인
                        const deleteLog = logs.filter(log =>
                            log.includes('삭제') ||
                            log.includes('Supabase')
                        );
                        console.log('삭제 관련 로그:', deleteLog);

                        // 페이지 새로고침
                        console.log('🔄 페이지 새로고침...');
                        await page.reload();
                        await page.waitForTimeout(5000);

                        // 새로고침 후 스크린샷
                        await page.screenshot({ path: 'after-refresh.png' });

                        // 클릭 모드 다시 활성화
                        await page.locator('button[data-mode="click"]').first().click();
                        await page.waitForTimeout(2000);

                        // 같은 위치 다시 클릭
                        await page.mouse.click(centerX, centerY);
                        await page.waitForTimeout(3000);

                        // 필지 번호 재확인
                        const parcelNumberAfter = await page.inputValue('#parcelNumber');
                        console.log(`새로고침 후 필지 번호: ${parcelNumberAfter || '없음'}`);

                        // 최종 스크린샷
                        await page.screenshot({ path: 'final.png' });

                        // 테스트 결과
                        console.log('\n========== 테스트 결과 ==========');
                        console.log('삭제 전 필지:', parcelNumber);
                        console.log('삭제 후 필지:', parcelNumberAfter);
                        console.log('삭제 유지 여부:', !parcelNumberAfter ? '✅ 성공' : '❌ 실패');
                        console.log('==================================\n');
                    }
                }
            }
        } else {
            console.log('❌ 클릭 모드 버튼을 찾을 수 없습니다');

            // 페이지 HTML 확인
            const pageContent = await page.content();
            console.log('페이지 내용 일부:', pageContent.substring(0, 500));
        }
    });
});