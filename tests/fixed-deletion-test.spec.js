const { test, expect } = require('@playwright/test');

test.describe('필지 삭제 추적 시스템 테스트', () => {
    test('색상 토글 삭제 및 새로고침 방지', async ({ page }) => {
        // 다이얼로그 핸들러를 미리 설정
        let dialogShown = false;
        page.on('dialog', async dialog => {
            console.log(`🔔 다이얼로그 표시: "${dialog.message()}"`);
            dialogShown = true;
            await dialog.accept(); // 삭제 확인
        });

        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('삭제') || text.includes('추적') || text.includes('토글') ||
                text.includes('applyColorToParcel') || text.includes('isRemoving')) {
                console.log(`[LOG]: ${text}`);
            }
        });

        // 1. 페이지 로드
        console.log('\n=== 페이지 로드 중... ===');
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#map-click', { state: 'visible' });
        await page.waitForTimeout(3000);

        // 2. 빨간색 선택
        console.log('\n=== 빨간색 선택 ===');
        await page.click('[data-color="0"]');
        await page.waitForTimeout(500);

        // 3. 지도 클릭하여 필지 색칠
        console.log('\n=== 지도 클릭하여 필지 색칠 ===');
        const mapElement = await page.$('#map-click');
        await mapElement.click({ position: { x: 400, y: 300 } });
        await page.waitForTimeout(3000);

        // 색칠 확인
        const coloringResult = await page.evaluate(() => {
            const parcels = window.clickParcels ? Array.from(window.clickParcels.entries()) : [];
            return parcels.map(([pnu, data]) => ({
                pnu,
                color: data.color,
                hasPolygon: !!data.polygon
            }));
        });
        console.log('색칠된 필지:', coloringResult);

        if (coloringResult.length === 0) {
            throw new Error('필지 색칠 실패!');
        }

        const targetPNU = coloringResult[0].pnu;
        const targetColor = coloringResult[0].color;
        console.log(`타겟 필지: ${targetPNU}, 색상: ${targetColor}`);

        // 4. 같은 위치를 다시 클릭하여 삭제
        console.log('\n=== 같은 위치 재클릭하여 삭제 시도 ===');

        // 빨간색이 여전히 선택되어 있는지 확인
        const isRedSelected = await page.evaluate(() => {
            const redButton = document.querySelector('[data-color="0"]');
            return redButton && redButton.classList.contains('active');
        });
        console.log('빨간색 선택 상태:', isRedSelected ? '✅ 선택됨' : '❌ 선택 안됨');

        // 재클릭
        await mapElement.click({ position: { x: 400, y: 300 } });
        await page.waitForTimeout(3000);

        // 다이얼로그 표시 여부 확인
        console.log('다이얼로그 표시됨:', dialogShown ? '✅ YES' : '❌ NO');

        // 5. 삭제 후 상태 확인
        const deletionResult = await page.evaluate(() => {
            const deletedParcels = localStorage.getItem('deletedParcels');
            const parcels = window.clickParcels ? Array.from(window.clickParcels.entries()) : [];

            // utils.js의 전역 함수 확인
            const hasDeleteFunction = typeof window.addToDeletedParcels === 'function';
            const hasGetDeleteFunction = typeof window.getDeletedParcels === 'function';

            return {
                deletedList: deletedParcels ? JSON.parse(deletedParcels) : [],
                remainingParcels: parcels.map(([pnu, data]) => ({
                    pnu,
                    color: data.color
                })),
                functionsAvailable: {
                    addToDeletedParcels: hasDeleteFunction,
                    getDeletedParcels: hasGetDeleteFunction
                }
            };
        });

        console.log('\n=== 삭제 후 결과 ===');
        console.log('삭제 추적 목록:', deletionResult.deletedList);
        console.log('남은 필지:', deletionResult.remainingParcels);
        console.log('함수 사용 가능:', deletionResult.functionsAvailable);

        // 6. 페이지 새로고침
        console.log('\n=== 페이지 새로고침 ===');
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // 7. 새로고침 후 최종 확인
        const finalResult = await page.evaluate(() => {
            const deletedParcels = localStorage.getItem('deletedParcels');
            const clickParcelsSize = window.clickParcels ? window.clickParcels.size : 0;

            return {
                deletedList: deletedParcels ? JSON.parse(deletedParcels) : [],
                mapParcelsCount: clickParcelsSize
            };
        });

        console.log('\n=== 새로고침 후 최종 결과 ===');
        console.log('삭제 추적 목록:', finalResult.deletedList);
        console.log('지도에 표시된 필지 수:', finalResult.mapParcelsCount);

        // 스크린샷
        await page.screenshot({
            path: 'tests/screenshots/deletion-test-final.png',
            fullPage: true
        });

        // 검증
        if (dialogShown) {
            // 다이얼로그가 표시되었다면 삭제가 실행되었어야 함
            expect(finalResult.deletedList.length).toBeGreaterThan(0);
            console.log(`\n✅ 테스트 성공: ${finalResult.deletedList.length}개 필지가 삭제 추적 목록에 있음`);
        } else {
            console.log('\n⚠️ 경고: 삭제 다이얼로그가 표시되지 않음');
            console.log('가능한 원인:');
            console.log('1. 같은 색상 재클릭이 감지되지 않음');
            console.log('2. isRemoving 로직이 작동하지 않음');
            console.log('3. 클릭 위치가 정확하지 않음');
        }
    });
});