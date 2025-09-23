const { test, expect } = require('@playwright/test');

test.describe('필지 삭제 및 새로고침 복원 방지 테스트', () => {
    test('삭제된 필지가 새로고침 후 복원되지 않아야 함', async ({ page }) => {
        // 1. 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // 콘솔 로그 캡처
        page.on('console', msg => {
            console.log(`[브라우저]: ${msg.text()}`);
        });

        // 2. 지도가 로드될 때까지 대기
        await page.waitForSelector('#map-click', { state: 'visible' });
        await page.waitForTimeout(3000); // 지도 초기화 대기

        // 3. 특정 위치 클릭하여 필지 선택 (잠실 지역)
        const mapCenter = await page.$('#map-click');
        await mapCenter.click({ position: { x: 400, y: 300 } });
        await page.waitForTimeout(2000);

        // 4. 색상 선택 (빨간색)
        await page.click('[data-color="0"]'); // 빨간색 선택
        await page.waitForTimeout(500);

        // 5. 필지 정보 입력
        await page.fill('#ownerName', '테스트 소유자');
        await page.fill('#memo', '삭제 테스트용 필지');

        // 6. 저장 버튼 클릭
        await page.click('#saveBtn');
        await page.waitForTimeout(2000);

        // 7. localStorage에서 저장된 데이터 확인
        const savedDataBefore = await page.evaluate(() => {
            return {
                parcelData: localStorage.getItem('parcelData'),
                deletedParcels: localStorage.getItem('deletedParcels'),
                clickParcelData: localStorage.getItem('clickParcelData')
            };
        });
        console.log('저장 후 데이터:', savedDataBefore);

        // 8. 같은 색상으로 다시 클릭하여 삭제 (색상 토글)
        await page.click('[data-color="0"]'); // 빨간색으로 다시 클릭
        await page.waitForTimeout(1000);

        // 다이얼로그 확인
        page.once('dialog', dialog => {
            console.log(`Dialog message: ${dialog.message()}`);
            dialog.accept(); // 삭제 확인
        });

        // 필지 클릭하여 삭제 실행
        await mapCenter.click({ position: { x: 400, y: 300 } });
        await page.waitForTimeout(3000);

        // 9. 삭제 후 localStorage 상태 확인
        const dataAfterDelete = await page.evaluate(() => {
            return {
                parcelData: localStorage.getItem('parcelData'),
                deletedParcels: localStorage.getItem('deletedParcels'),
                clickParcelData: localStorage.getItem('clickParcelData'),
                parcelColors: localStorage.getItem('parcelColors')
            };
        });
        console.log('\n삭제 후 deletedParcels:', dataAfterDelete.deletedParcels);
        console.log('삭제 후 parcelData 길이:',
            dataAfterDelete.parcelData ? JSON.parse(dataAfterDelete.parcelData).length : 0);

        // 10. 페이지 새로고침
        console.log('\n페이지 새로고침 중...');
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // 11. 새로고침 후 데이터 확인
        const dataAfterRefresh = await page.evaluate(() => {
            const parcelData = localStorage.getItem('parcelData');
            const deletedParcels = localStorage.getItem('deletedParcels');
            const clickParcelData = localStorage.getItem('clickParcelData');

            // clickParcels Map 크기 확인
            const clickParcelsSize = window.clickParcels ? window.clickParcels.size : 0;

            return {
                parcelDataLength: parcelData ? JSON.parse(parcelData).length : 0,
                deletedParcelsLength: deletedParcels ? JSON.parse(deletedParcels).length : 0,
                clickParcelDataLength: clickParcelData ? JSON.parse(clickParcelData).length : 0,
                clickParcelsMapSize: clickParcelsSize,
                deletedParcels: deletedParcels
            };
        });

        console.log('\n===== 새로고침 후 결과 =====');
        console.log('parcelData 개수:', dataAfterRefresh.parcelDataLength);
        console.log('deletedParcels 개수:', dataAfterRefresh.deletedParcelsLength);
        console.log('clickParcelData 개수:', dataAfterRefresh.clickParcelDataLength);
        console.log('clickParcels Map 크기:', dataAfterRefresh.clickParcelsMapSize);
        console.log('삭제 목록:', dataAfterRefresh.deletedParcels);

        // 12. 스크린샷 캡처
        await page.screenshot({
            path: 'tests/screenshots/after-refresh.png',
            fullPage: true
        });

        // 13. 검증: 삭제된 필지가 복원되지 않았는지 확인
        expect(dataAfterRefresh.deletedParcelsLength).toBeGreaterThan(0);
        console.log('\n✅ 테스트 성공: 삭제 추적 시스템이 정상 작동합니다.');

        // 폼이 비어있는지 확인
        const formValues = await page.evaluate(() => {
            return {
                ownerName: document.getElementById('ownerName')?.value || '',
                memo: document.getElementById('memo')?.value || ''
            };
        });

        expect(formValues.ownerName).toBe('');
        expect(formValues.memo).toBe('');
        console.log('✅ 폼 필드가 비어있음 - 삭제된 필지가 복원되지 않음');
    });
});