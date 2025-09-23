const { test, expect } = require('@playwright/test');

test('필지 삭제 함수 디버깅', async ({ page }) => {
    // 콘솔 로그 캡처
    const logs = [];
    page.on('console', msg => {
        const text = msg.text();
        logs.push(text);
        console.log(`[브라우저]: ${text}`);
    });

    // 1. 페이지 열기
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    // 2. 지도 클릭하여 필지 생성
    const mapContainer = page.locator('#map');
    const box = await mapContainer.boundingBox();

    if (box) {
        // 지도 중앙 클릭
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(2000);

        // 3. 필지 정보 입력
        await page.fill('#parcelNumber', '디버깅 테스트 필지');
        await page.fill('#ownerName', '디버깅 소유자');
        await page.fill('#memo', 'removeParcelFromAllStorage 디버깅');

        // 4. 저장
        await page.click('#saveBtn');
        await page.waitForTimeout(2000);

        // 5. 현재 PNU 가져오기
        const pnu = await page.evaluate(() => {
            return window.selectedPnu || window.selectedParcel?.properties?.PNU;
        });

        console.log(`테스트 필지 PNU: ${pnu}`);

        // 6. 마커 클릭
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 20);
        await page.waitForTimeout(1000);

        // 7. 삭제 버튼 클릭
        page.once('dialog', dialog => {
            console.log('다이얼로그:', dialog.message());
            dialog.accept();
        });

        await page.click('#resetBtn');
        await page.waitForTimeout(3000);

        // 8. removeParcelFromAllStorage 관련 로그 확인
        const relevantLogs = logs.filter(log =>
            log.includes('removeParcelFromAllStorage') ||
            log.includes('삭제 대상 식별자') ||
            log.includes('총') && log.includes('항목이 모든 저장소에서 제거')
        );

        console.log('\n=== removeParcelFromAllStorage 관련 로그 ===');
        relevantLogs.forEach(log => console.log(log));

        // 9. 삭제 확인
        const parcelData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('parcelData') || '[]');
        });

        const stillExists = parcelData.some(p =>
            p.parcelNumber === '디버깅 테스트 필지' ||
            p.pnu === pnu
        );

        if (stillExists) {
            console.error('❌ 필지가 여전히 localStorage에 존재합니다!');
        } else {
            console.log('✅ 필지가 localStorage에서 제거되었습니다.');
        }

        // 10. 새로고침 후 확인
        await page.reload();
        await page.waitForTimeout(3000);

        const parcelDataAfterReload = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('parcelData') || '[]');
        });

        const existsAfterReload = parcelDataAfterReload.some(p =>
            p.parcelNumber === '디버깅 테스트 필지'
        );

        expect(existsAfterReload).toBeFalsy();
        console.log('✅ 새로고침 후에도 필지가 삭제 상태 유지');
    }
});