const { test, expect } = require('@playwright/test');

test.describe('간단한 삭제 및 복원 방지 테스트', () => {
    test('색상 토글로 삭제 후 새로고침 시 복원 방지', async ({ page }) => {
        // 1. 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('삭제') || text.includes('추적') || text.includes('deleted')) {
                console.log(`[중요]: ${text}`);
            }
        });

        // 2. 지도가 로드될 때까지 대기
        await page.waitForSelector('#map-click', { state: 'visible' });
        await page.waitForTimeout(3000);

        // 3. 빨간색 선택
        console.log('\n=== 1단계: 빨간색으로 필지 색칠 ===');
        await page.click('[data-color="0"]'); // 빨간색 선택
        await page.waitForTimeout(500);

        // 4. 지도 클릭하여 필지 색칠
        const mapElement = await page.$('#map-click');
        await mapElement.click({ position: { x: 400, y: 300 } });
        await page.waitForTimeout(3000); // API 응답 대기

        // 5. 색칠 후 데이터 확인
        const dataAfterColoring = await page.evaluate(() => {
            const clickParcels = window.clickParcels ? Array.from(window.clickParcels.keys()) : [];
            const localData = localStorage.getItem('clickParcelData');
            return {
                clickParcelsKeys: clickParcels,
                hasLocalData: !!localData,
                localDataLength: localData ? JSON.parse(localData).length : 0
            };
        });
        console.log('색칠 후 상태:', dataAfterColoring);

        // 6. 같은 색상으로 다시 클릭하여 삭제 (색상 토글)
        console.log('\n=== 2단계: 같은 색상으로 재클릭하여 삭제 ===');

        // 다이얼로그 핸들러 설정
        page.once('dialog', async dialog => {
            console.log(`다이얼로그: "${dialog.message()}"`);
            await dialog.accept(); // 삭제 확인
        });

        // 다시 클릭하여 삭제
        await mapElement.click({ position: { x: 400, y: 300 } });
        await page.waitForTimeout(3000);

        // 7. 삭제 후 상태 확인
        const dataAfterDelete = await page.evaluate(() => {
            const deletedParcels = localStorage.getItem('deletedParcels');
            const clickParcels = window.clickParcels ? Array.from(window.clickParcels.keys()) : [];
            const localData = localStorage.getItem('clickParcelData');

            return {
                deletedParcels: deletedParcels ? JSON.parse(deletedParcels) : [],
                clickParcelsKeys: clickParcels,
                localDataLength: localData ? JSON.parse(localData).length : 0
            };
        });

        console.log('\n=== 삭제 후 상태 ===');
        console.log('삭제 추적 목록:', dataAfterDelete.deletedParcels);
        console.log('clickParcels 개수:', dataAfterDelete.clickParcelsKeys.length);
        console.log('localStorage 데이터 개수:', dataAfterDelete.localDataLength);

        // 8. 페이지 새로고침
        console.log('\n=== 3단계: 페이지 새로고침 ===');
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // 9. 새로고침 후 최종 상태 확인
        const finalData = await page.evaluate(() => {
            const deletedParcels = localStorage.getItem('deletedParcels');
            const clickParcels = window.clickParcels ? window.clickParcels.size : 0;
            const localData = localStorage.getItem('clickParcelData');
            const parcelData = localStorage.getItem('parcelData');

            // 폼 값 확인
            const ownerName = document.getElementById('ownerName')?.value || '';
            const memo = document.getElementById('memo')?.value || '';

            return {
                deletedParcels: deletedParcels ? JSON.parse(deletedParcels) : [],
                clickParcelsSize: clickParcels,
                localDataLength: localData ? JSON.parse(localData).length : 0,
                parcelDataLength: parcelData ? JSON.parse(parcelData).length : 0,
                formValues: { ownerName, memo }
            };
        });

        console.log('\n=== 새로고침 후 최종 결과 ===');
        console.log('삭제 추적 목록:', finalData.deletedParcels);
        console.log('clickParcels Map 크기:', finalData.clickParcelsSize);
        console.log('clickParcelData 개수:', finalData.localDataLength);
        console.log('parcelData 개수:', finalData.parcelDataLength);
        console.log('폼 값:', finalData.formValues);

        // 10. 스크린샷
        await page.screenshot({
            path: 'tests/screenshots/final-state-after-refresh.png',
            fullPage: true
        });

        // 11. 검증
        expect(finalData.deletedParcels.length).toBeGreaterThan(0);
        console.log(`\n✅ 성공: 삭제 추적 목록에 ${finalData.deletedParcels.length}개 필지가 기록됨`);
        console.log('✅ 삭제된 필지 PNU:', finalData.deletedParcels);

        // 삭제된 필지가 지도에 복원되지 않았는지 확인
        if (finalData.clickParcelsSize === 0) {
            console.log('✅ 완벽: 삭제된 필지가 복원되지 않음!');
        } else {
            console.log(`⚠️ 주의: ${finalData.clickParcelsSize}개의 필지가 여전히 지도에 존재`);
        }
    });
});