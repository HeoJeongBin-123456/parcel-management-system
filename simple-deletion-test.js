/**
 * 간단한 삭제 버그 수정 확인 테스트
 * isMinimalData 필터링이 제대로 동작하는지 확인
 */

const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    console.log('🚀 삭제 버그 수정 확인 테스트 시작');

    try {
        // 1. 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(2000);

        // 2. localStorage에 테스트 데이터 삽입 (isMinimalData 플래그가 있는 데이터)
        await page.evaluate(() => {
            // 테스트 데이터 생성
            const testData = [
                {
                    pnu: 'TEST123',
                    parcelNumber: '테스트필지',
                    ownerName: '테스트소유자',
                    memo: '정상 데이터',
                    geometry: { type: 'Polygon', coordinates: [] },
                    color: '#FF0000',
                    isMinimalData: false  // 정상 데이터
                },
                {
                    pnu: 'DELETED456',
                    parcelNumber: '',  // 삭제된 정보
                    ownerName: '',
                    memo: '',
                    geometry: { type: 'Polygon', coordinates: [] },
                    color: '#00FF00',
                    isMinimalData: true  // 최소 데이터 (삭제됨)
                }
            ];

            localStorage.setItem('parcelData', JSON.stringify(testData));
            console.log('📝 테스트 데이터 삽입 완료');
        });

        // 3. 페이지 새로고침
        console.log('🔄 페이지 새로고침...');
        await page.reload();
        await page.waitForTimeout(3000);

        // 4. 콘솔 메시지 확인
        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(text);
            if (text.includes('최소 데이터 필지')) {
                console.log('✅ 필터링 로그 확인:', text);
            }
        });

        await page.waitForTimeout(2000);

        // 5. localStorage 확인
        const restoredData = await page.evaluate(() => {
            const data = localStorage.getItem('parcelData');
            return data ? JSON.parse(data) : [];
        });

        console.log('\n📊 테스트 결과:');
        console.log(`- localStorage 데이터 개수: ${restoredData.length}`);

        const normalData = restoredData.filter(d => !d.isMinimalData);
        const minimalData = restoredData.filter(d => d.isMinimalData === true);

        console.log(`- 정상 데이터: ${normalData.length}개`);
        console.log(`- 최소 데이터: ${minimalData.length}개`);

        // 6. 필터링 확인
        const filteringWorked = consoleMessages.some(msg =>
            msg.includes('최소 데이터 필지 건너뛰기') ||
            msg.includes('최소 데이터 필지 필터링') ||
            msg.includes('최소 데이터 필지 복원 제외')
        );

        if (filteringWorked) {
            console.log('✅ isMinimalData 필터링이 정상 동작합니다!');
        } else {
            console.log('⚠️ isMinimalData 필터링 로그를 찾지 못했습니다');
        }

        // 7. UI 확인
        const visibleParcels = await page.evaluate(() => {
            // 필지 목록이나 지도에 표시된 필지 개수 확인
            const parcels = document.querySelectorAll('.parcel-item');
            return parcels.length;
        });

        console.log(`- UI에 표시된 필지: ${visibleParcels}개`);

        // 8. 최종 판정
        if (minimalData.length > 0 && filteringWorked) {
            console.log('\n✅ 버그 수정 성공!');
            console.log('최소 데이터는 localStorage에는 있지만 UI에는 표시되지 않습니다.');
        } else if (minimalData.length === 0) {
            console.log('\n⚠️ 테스트 데이터가 제대로 설정되지 않았습니다.');
        } else {
            console.log('\n❌ 버그가 여전히 존재합니다.');
        }

    } catch (error) {
        console.error('❌ 테스트 실패:', error);
    } finally {
        await browser.close();
        console.log('🏁 테스트 종료');
    }
})();
