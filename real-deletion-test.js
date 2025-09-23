const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // 콘솔 메시지 캡처
    page.on('console', msg => {
        if (msg.text().includes('필지') || msg.text().includes('삭제') || msg.text().includes('최소')) {
            console.log(`[브라우저]: ${msg.text()}`);
        }
    });

    try {
        console.log('🚀 실제 삭제 버그 재현 테스트 시작');

        // 1. 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000);

        // 2. 지도 클릭하여 필지 선택
        console.log('\n📍 단계 1: 필지 선택 및 정보 입력');
        await page.click('#map', { position: { x: 500, y: 400 } });
        await page.waitForTimeout(2000);

        // 3. 필지 정보 입력
        const testNumber = '삭제테스트-' + Date.now();
        await page.fill('#parcelNumber', testNumber);
        await page.fill('#ownerName', '홍길동');
        await page.fill('#ownerAddress', '서울시 강남구');
        await page.fill('#ownerContact', '010-1234-5678');
        await page.fill('#memo', '이 정보는 삭제될 예정입니다');

        // 4. 저장
        await page.click('#saveParcelBtn');
        await page.waitForTimeout(2000);
        console.log('✅ 필지 정보 저장 완료');

        // 5. localStorage 확인 (삭제 전)
        const beforeDelete = await page.evaluate(() => {
            const data = localStorage.getItem('parcelData');
            const parsed = data ? JSON.parse(data) : [];
            return {
                count: parsed.length,
                hasTestData: parsed.some(p => p.parcelNumber && p.parcelNumber.includes('삭제테스트')),
                testItem: parsed.find(p => p.parcelNumber && p.parcelNumber.includes('삭제테스트'))
            };
        });
        console.log(`\n📊 삭제 전 상태:`);
        console.log(`  - 총 필지 수: ${beforeDelete.count}`);
        console.log(`  - 테스트 필지 존재: ${beforeDelete.hasTestData}`);
        if (beforeDelete.testItem) {
            console.log(`  - 소유자명: ${beforeDelete.testItem.ownerName}`);
            console.log(`  - 메모: ${beforeDelete.testItem.memo}`);
        }

        // 6. 삭제 버튼 클릭
        console.log('\n🗑️ 단계 2: 필지 정보 삭제');

        // 다이얼로그 처리기 설정
        page.once('dialog', async dialog => {
            console.log(`  📢 확인 다이얼로그: "${dialog.message()}"`);
            await dialog.accept();
        });

        await page.click('#deleteParcelInfoBtn');
        await page.waitForTimeout(2000);

        // 7. localStorage 확인 (삭제 후)
        const afterDelete = await page.evaluate(() => {
            const data = localStorage.getItem('parcelData');
            const parsed = data ? JSON.parse(data) : [];
            const testItem = parsed.find(p => p.parcelNumber && p.parcelNumber.includes('삭제테스트'));
            return {
                count: parsed.length,
                hasTestData: parsed.some(p => p.parcelNumber && p.parcelNumber.includes('삭제테스트')),
                testItem: testItem,
                hasMinimalData: parsed.some(p => p.isMinimalData === true)
            };
        });
        console.log(`\n📊 삭제 후 상태:`);
        console.log(`  - 총 필지 수: ${afterDelete.count}`);
        console.log(`  - 테스트 필지 존재: ${afterDelete.hasTestData}`);
        console.log(`  - isMinimalData 항목 존재: ${afterDelete.hasMinimalData}`);
        if (afterDelete.testItem) {
            console.log(`  - 테스트 필지 상태:`);
            console.log(`    - parcelNumber: "${afterDelete.testItem.parcelNumber}"`);
            console.log(`    - ownerName: "${afterDelete.testItem.ownerName}"`);
            console.log(`    - memo: "${afterDelete.testItem.memo}"`);
            console.log(`    - isMinimalData: ${afterDelete.testItem.isMinimalData}`);
        }

        // 8. UI 필드 확인
        const uiAfterDelete = await page.evaluate(() => {
            return {
                parcelNumber: document.querySelector('#parcelNumber')?.value || '',
                ownerName: document.querySelector('#ownerName')?.value || '',
                memo: document.querySelector('#memo')?.value || ''
            };
        });
        console.log(`\n📝 삭제 후 UI 상태:`);
        console.log(`  - 필지번호: "${uiAfterDelete.parcelNumber}"`);
        console.log(`  - 소유자명: "${uiAfterDelete.ownerName}"`);
        console.log(`  - 메모: "${uiAfterDelete.memo}"`);

        // 9. 새로고침
        console.log('\n🔄 단계 3: 페이지 새로고침');
        await page.reload();
        await page.waitForTimeout(3000);

        // 10. 다시 필지 클릭
        console.log('📍 동일한 위치 클릭');
        await page.click('#map', { position: { x: 500, y: 400 } });
        await page.waitForTimeout(2000);

        // 11. 새로고침 후 UI 상태 확인
        const uiAfterReload = await page.evaluate(() => {
            return {
                parcelNumber: document.querySelector('#parcelNumber')?.value || '',
                ownerName: document.querySelector('#ownerName')?.value || '',
                ownerAddress: document.querySelector('#ownerAddress')?.value || '',
                ownerContact: document.querySelector('#ownerContact')?.value || '',
                memo: document.querySelector('#memo')?.value || ''
            };
        });
        console.log(`\n📝 새로고침 후 UI 상태:`);
        console.log(`  - 필지번호: "${uiAfterReload.parcelNumber}"`);
        console.log(`  - 소유자명: "${uiAfterReload.ownerName}"`);
        console.log(`  - 소유자주소: "${uiAfterReload.ownerAddress}"`);
        console.log(`  - 연락처: "${uiAfterReload.ownerContact}"`);
        console.log(`  - 메모: "${uiAfterReload.memo}"`);

        // 12. localStorage 최종 확인
        const finalState = await page.evaluate(() => {
            const data = localStorage.getItem('parcelData');
            const parsed = data ? JSON.parse(data) : [];
            return {
                count: parsed.length,
                items: parsed.map(p => ({
                    pnu: p.pnu,
                    parcelNumber: p.parcelNumber,
                    isMinimalData: p.isMinimalData,
                    hasGeometry: !!p.geometry,
                    hasColor: !!p.color
                }))
            };
        });
        console.log(`\n📊 최종 localStorage 상태:`);
        console.log(`  - 총 항목 수: ${finalState.count}`);
        finalState.items.forEach((item, i) => {
            console.log(`  [${i+1}] PNU: ${item.pnu}, 번호: "${item.parcelNumber}", 최소데이터: ${item.isMinimalData}, geometry: ${item.hasGeometry}, color: ${item.hasColor}`);
        });

        // 13. 판정
        console.log('\n🎯 테스트 결과:');
        const hasDataRestored =
            uiAfterReload.parcelNumber ||
            uiAfterReload.ownerName ||
            uiAfterReload.ownerAddress ||
            uiAfterReload.ownerContact ||
            uiAfterReload.memo;

        if (hasDataRestored) {
            console.log('❌ 버그 확인: 삭제한 필지 정보가 새로고침 후 복원되었습니다!');
            console.log('   복원된 데이터:', uiAfterReload);
        } else {
            console.log('✅ 정상: 삭제한 필지 정보가 복원되지 않았습니다.');
        }

        // 스크린샷
        await page.screenshot({ path: 'deletion-bug-final.png', fullPage: true });
        console.log('📸 스크린샷 저장: deletion-bug-final.png');

    } catch (error) {
        console.error('❌ 테스트 실패:', error);
    } finally {
        await browser.close();
        console.log('\n🏁 테스트 종료');
    }
})();
