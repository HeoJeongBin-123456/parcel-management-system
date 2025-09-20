/**
 * 삭제된 필지 추적 시스템 논리적 결함 수정 테스트
 * 다동 46 필지와 기타 문제 필지들의 색상 유지 확인
 */

const { test, expect } = require('@playwright/test');

test.describe('삭제된 필지 논리적 결함 수정 테스트', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4000');

        // 콘솔 로그 캡처
        page.on('console', msg => {
            console.log(`[브라우저 ${msg.type()}]:`, msg.text());
        });

        // 페이지 로드 대기
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('다동 46 필지 색칠 후 새로고침 시 색상 유지 테스트', async ({ page }) => {
        console.log('🧪 다동 46 필지 색상 유지 테스트 시작');

        // 1. 다동 46 검색
        const searchInput = page.locator('#searchInput');
        await searchInput.fill('다동 46');
        await page.click('#searchButton');

        // 검색 결과 대기
        await page.waitForTimeout(3000);

        // 2. 빨간색 선택
        console.log('🎨 빨간색 선택');
        await page.click('.color-item[data-color="0"]'); // 빨간색
        await page.waitForTimeout(1000);

        // 3. 검색된 필지 클릭하여 색칠
        console.log('🖱️ 필지 클릭하여 색칠');
        await page.click('#mapSearch');
        await page.waitForTimeout(2000);

        // 4. 삭제 목록에서 제거되었는지 콘솔 로그 확인
        console.log('📝 삭제 목록에서 제거 로그 확인');

        // 5. 색상 저장 확인
        const colorStorageCheck = await page.evaluate(() => {
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            const deletedParcels = JSON.parse(localStorage.getItem('deletedParcels') || '[]');

            // 다동 46의 PNU
            const pnu = '1114010200100460000';

            return {
                hasColor: pnu in parcelColors,
                colorValue: parcelColors[pnu],
                isDeleted: deletedParcels.includes(pnu),
                parcelColorsCount: Object.keys(parcelColors).length,
                deletedCount: deletedParcels.length
            };
        });

        console.log('색상 저장 상태:', colorStorageCheck);
        expect(colorStorageCheck.hasColor).toBeTruthy();
        expect(colorStorageCheck.isDeleted).toBeFalsy();

        // 6. 페이지 새로고침
        console.log('🔄 페이지 새로고침');
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // 7. 새로고침 후 색상 확인
        const afterReloadCheck = await page.evaluate(() => {
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            const deletedParcels = JSON.parse(localStorage.getItem('deletedParcels') || '[]');

            const pnu = '1114010200100460000';

            return {
                hasColor: pnu in parcelColors,
                colorValue: parcelColors[pnu],
                isDeleted: deletedParcels.includes(pnu),
                parcelColorsCount: Object.keys(parcelColors).length
            };
        });

        console.log('새로고침 후 색상 상태:', afterReloadCheck);

        // 8. 검증
        expect(afterReloadCheck.hasColor).toBeTruthy();
        expect(afterReloadCheck.colorValue).toBe(0); // 빨간색 인덱스
        expect(afterReloadCheck.isDeleted).toBeFalsy();

        // 9. 스크린샷 촬영
        await page.screenshot({
            path: 'test-results/dadong-46-color-fix.png',
            fullPage: true
        });

        console.log('✅ 다동 46 필지 색상 유지 테스트 완료');
    });

    test('삭제-복원 시나리오 테스트', async ({ page }) => {
        console.log('🧪 삭제-복원 시나리오 테스트 시작');

        // 1. 테스트용 필지 검색 (다동 46)
        const searchInput = page.locator('#searchInput');
        await searchInput.fill('다동 46');
        await page.click('#searchButton');
        await page.waitForTimeout(3000);

        // 2. 파란색으로 색칠
        console.log('🎨 파란색으로 색칠');
        await page.click('.color-item[data-color="4"]'); // 파란색
        await page.waitForTimeout(1000);
        await page.click('#mapSearch');
        await page.waitForTimeout(2000);

        // 3. 같은 색 재클릭으로 삭제
        console.log('🗑️ 같은 색 재클릭으로 삭제');
        await page.click('#mapSearch');
        await page.waitForTimeout(2000);

        // 4. 삭제 확인
        const deletedCheck = await page.evaluate(() => {
            const deletedParcels = JSON.parse(localStorage.getItem('deletedParcels') || '[]');
            const pnu = '1114010200100460000';
            return deletedParcels.includes(pnu);
        });

        expect(deletedCheck).toBeTruthy();
        console.log('✅ 삭제 확인됨');

        // 5. 노란색으로 재색칠
        console.log('🎨 노란색으로 재색칠');
        await page.click('.color-item[data-color="2"]'); // 노란색
        await page.waitForTimeout(1000);
        await page.click('#mapSearch');
        await page.waitForTimeout(2000);

        // 6. 삭제 목록에서 제거 확인
        const restoredCheck = await page.evaluate(() => {
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            const deletedParcels = JSON.parse(localStorage.getItem('deletedParcels') || '[]');
            const pnu = '1114010200100460000';

            return {
                hasColor: pnu in parcelColors,
                colorValue: parcelColors[pnu],
                isDeleted: deletedParcels.includes(pnu)
            };
        });

        expect(restoredCheck.hasColor).toBeTruthy();
        expect(restoredCheck.colorValue).toBe(2); // 노란색 인덱스
        expect(restoredCheck.isDeleted).toBeFalsy();
        console.log('✅ 복원 확인됨');

        // 7. 새로고침 후 색상 유지 확인
        console.log('🔄 새로고침 후 색상 유지 확인');
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const finalCheck = await page.evaluate(() => {
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            const pnu = '1114010200100460000';
            return {
                hasColor: pnu in parcelColors,
                colorValue: parcelColors[pnu]
            };
        });

        expect(finalCheck.hasColor).toBeTruthy();
        expect(finalCheck.colorValue).toBe(2); // 노란색 유지

        await page.screenshot({
            path: 'test-results/delete-restore-scenario.png',
            fullPage: true
        });

        console.log('✅ 삭제-복원 시나리오 테스트 완료');
    });
});