const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // 콘솔 메시지 캡처
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('최소 데이터') || text.includes('isMinimalData')) {
            console.log(`[필터링]: ${text}`);
        }
    });

    try {
        console.log('🚀 최종 버그 수정 확인 테스트');
        console.log('========================================\n');

        // 1. 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000);

        // 2. 지도 클릭하여 필지 선택
        console.log('📍 단계 1: 필지 선택 및 정보 입력');
        await page.click('#map', { position: { x: 600, y: 350 } });
        await page.waitForTimeout(2000);

        // 3. 필지 정보 입력
        const testId = Date.now();
        await page.fill('#parcelNumber', `테스트-${testId}`);
        await page.fill('#ownerName', '김철수');
        await page.fill('#ownerAddress', '서울시 강남구 테헤란로');
        await page.fill('#ownerContact', '010-9999-8888');
        await page.fill('#memo', '삭제 테스트용 메모입니다');

        // 4. 저장
        await page.click('#saveParcelBtn');
        await page.waitForTimeout(2000);
        console.log('✅ 필지 정보 저장 완료\n');

        // 5. 삭제 전 상태 확인
        const beforeUI = await page.evaluate(() => ({
            parcelNumber: document.querySelector('#parcelNumber')?.value,
            ownerName: document.querySelector('#ownerName')?.value,
            memo: document.querySelector('#memo')?.value
        }));
        console.log('📊 삭제 전 UI 상태:');
        console.log(`  필지: ${beforeUI.parcelNumber}`);
        console.log(`  소유자: ${beforeUI.ownerName}`);
        console.log(`  메모: ${beforeUI.memo}\n`);

        // 6. 삭제 버튼 클릭
        console.log('🗑️ 단계 2: 필지 정보 삭제');
        page.once('dialog', async dialog => {
            await dialog.accept();
        });
        await page.click('#deleteParcelInfoBtn');
        await page.waitForTimeout(2000);

        // 7. 삭제 후 localStorage 상태
        const afterDelete = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const testItem = data.find(p => p.parcelNumber && p.parcelNumber.includes('테스트'));
            return {
                totalCount: data.length,
                minimalCount: data.filter(p => p.isMinimalData === true).length,
                testItem: testItem ? {
                    parcelNumber: testItem.parcelNumber,
                    ownerName: testItem.ownerName,
                    isMinimalData: testItem.isMinimalData
                } : null
            };
        });
        console.log('📊 삭제 후 localStorage:');
        console.log(`  총 항목: ${afterDelete.totalCount}개`);
        console.log(`  최소 데이터: ${afterDelete.minimalCount}개`);
        if (afterDelete.testItem) {
            console.log(`  테스트 필지: isMinimalData=${afterDelete.testItem.isMinimalData}`);
        }
        console.log('');

        // 8. 새로고침
        console.log('🔄 단계 3: 페이지 새로고침');
        await page.reload();
        await page.waitForTimeout(3000);

        // 9. 동일한 위치 클릭
        console.log('📍 동일한 위치 다시 클릭');
        await page.click('#map', { position: { x: 600, y: 350 } });
        await page.waitForTimeout(2000);

        // 10. 새로고침 후 UI 확인
        const afterReload = await page.evaluate(() => ({
            parcelNumber: document.querySelector('#parcelNumber')?.value,
            ownerName: document.querySelector('#ownerName')?.value,
            ownerAddress: document.querySelector('#ownerAddress')?.value,
            ownerContact: document.querySelector('#ownerContact')?.value,
            memo: document.querySelector('#memo')?.value
        }));

        console.log('📝 새로고침 후 UI 상태:');
        console.log(`  필지: "${afterReload.parcelNumber}"`);
        console.log(`  소유자: "${afterReload.ownerName}"`);
        console.log(`  주소: "${afterReload.ownerAddress}"`);
        console.log(`  연락처: "${afterReload.ownerContact}"`);
        console.log(`  메모: "${afterReload.memo}"\n`);

        // 11. 최종 판정
        console.log('========================================');
        console.log('🎯 테스트 결과:\n');

        const hasRestoredData =
            (afterReload.ownerName && afterReload.ownerName.trim() !== '') ||
            (afterReload.ownerAddress && afterReload.ownerAddress.trim() !== '') ||
            (afterReload.ownerContact && afterReload.ownerContact.trim() !== '') ||
            (afterReload.memo && afterReload.memo.trim() !== '');

        if (hasRestoredData) {
            console.log('❌ 버그 존재: 삭제된 정보가 복원되었습니다!');
            console.log('\n복원된 정보:');
            if (afterReload.ownerName) console.log(`  - 소유자명: ${afterReload.ownerName}`);
            if (afterReload.ownerAddress) console.log(`  - 주소: ${afterReload.ownerAddress}`);
            if (afterReload.ownerContact) console.log(`  - 연락처: ${afterReload.ownerContact}`);
            if (afterReload.memo) console.log(`  - 메모: ${afterReload.memo}`);
        } else {
            console.log('✅ 성공: 삭제된 정보가 복원되지 않았습니다!');
            console.log('\n확인 사항:');
            console.log('  - 필지 번호(지번)만 표시: 정상');
            console.log('  - 소유자 정보 없음: 정상');
            console.log('  - 메모 없음: 정상');
        }

        console.log('========================================\n');

        // 스크린샷
        await page.screenshot({ path: 'final-test-result.png', fullPage: true });
        console.log('📸 스크린샷: final-test-result.png');

    } catch (error) {
        console.error('❌ 테스트 실패:', error);
    } finally {
        await browser.close();
        console.log('\n테스트 종료');
    }
})();
