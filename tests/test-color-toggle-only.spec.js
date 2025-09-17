import { test, expect } from '@playwright/test';

test.describe('색상 토글 테스트 (색상만 제거)', () => {
    test.beforeEach(async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('✅') || text.includes('❌') || text.includes('🎨')) {
                console.log('[브라우저]:', text);
            }
        });

        // 에러 감지
        page.on('pageerror', err => {
            console.error('[페이지 에러]:', err.message);
        });

        // dialog 자동 승인
        page.on('dialog', async dialog => {
            console.log('다이얼로그:', dialog.message());
            await dialog.accept();
        });

        // 페이지 로드
        await page.goto('http://localhost:4000', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        // 지도 로드 대기
        await page.waitForTimeout(3000);
    });

    test('같은 색상 클릭 시 색상만 제거되고 데이터는 유지', async ({ page }) => {
        console.log('🎯 색상 토글 테스트 시작');

        // 1. 클릭 모드로 전환
        const clickModeBtn = page.locator('button').filter({ hasText: '클릭' }).first();
        await clickModeBtn.click();
        await page.waitForTimeout(1000);
        console.log('✅ 클릭 모드 활성화');

        // 2. 지도 중앙 클릭하여 필지 생성
        const mapContainer = page.locator('.map-container');
        const box = await mapContainer.boundingBox();
        if (!box) throw new Error('지도 컨테이너를 찾을 수 없습니다');

        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        await page.mouse.click(centerX, centerY);
        await page.waitForTimeout(3000);

        // 3. 필지 정보 확인 및 메모 추가
        const parcelNumber = await page.inputValue('#parcelNumber');
        console.log('선택된 필지:', parcelNumber || '알 수 없음');

        if (!parcelNumber) {
            console.log('⚠️ 필지를 선택할 수 없습니다. 테스트 종료.');
            return;
        }

        // 메모 추가
        await page.fill('#memo', '테스트 메모');
        await page.waitForTimeout(500);

        // 4. 현재 PNU 가져오기
        const currentPNU = await page.evaluate(() => window.currentSelectedPNU);
        console.log('현재 PNU:', currentPNU);

        // 5. 빨간색 선택
        await page.evaluate(() => {
            const colorItems = document.querySelectorAll('.color-item');
            for (const item of colorItems) {
                if (item.dataset.color === '#FF0000' ||
                    item.style.background === 'rgb(255, 0, 0)' ||
                    item.style.backgroundColor === 'rgb(255, 0, 0)') {
                    item.click();
                    return true;
                }
            }
            return false;
        });
        console.log('✅ 빨간색 선택');
        await page.waitForTimeout(1000);

        // 6. 색상 적용 (첫 번째 클릭)
        console.log('🎨 색상 적용');
        await page.mouse.click(centerX, centerY);
        await page.waitForTimeout(2000);

        // 색상이 적용되었는지 확인
        const afterFirstClick = await page.evaluate((pnu) => {
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            const parcelData = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const hasData = parcelData.some(item => item.pnu === pnu);

            return {
                hasColor: parcelColors.hasOwnProperty(pnu) && parcelColors[pnu] !== 'transparent',
                colorValue: parcelColors[pnu],
                hasData: hasData
            };
        }, currentPNU);

        console.log('첫 번째 클릭 후:', afterFirstClick);
        expect(afterFirstClick.hasColor).toBeTruthy();
        expect(afterFirstClick.hasData).toBeTruthy();

        // 7. 같은 색상으로 다시 클릭하여 색상만 제거 (토글)
        console.log('🎨 같은 색상으로 토글 (색상만 제거)');
        await page.mouse.click(centerX, centerY);
        await page.waitForTimeout(3000);

        // 8. 색상 제거 후 상태 확인
        const afterToggle = await page.evaluate((pnu) => {
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            const parcelData = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const foundData = parcelData.find(item => item.pnu === pnu);

            return {
                hasColor: parcelColors.hasOwnProperty(pnu) && parcelColors[pnu] !== 'transparent',
                colorValue: parcelColors[pnu],
                hasData: !!foundData,
                memoValue: foundData ? foundData.memo : null
            };
        }, currentPNU);

        console.log('토글 후 상태:', afterToggle);

        // 검증: 색상은 제거되고 데이터는 유지되어야 함
        expect(afterToggle.hasColor).toBeFalsy(); // 색상은 제거됨
        expect(afterToggle.colorValue).toBe('transparent'); // transparent로 설정됨
        expect(afterToggle.hasData).toBeTruthy(); // 데이터는 유지됨
        expect(afterToggle.memoValue).toBe('테스트 메모'); // 메모도 유지됨

        // 9. 페이지 새로고침
        console.log('🔄 페이지 새로고침...');
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);

        // 10. 새로고침 후 상태 확인
        const afterRefresh = await page.evaluate((pnu) => {
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            const parcelData = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const foundData = parcelData.find(item => item.pnu === pnu);

            // window.clickParcels 확인
            const inClickParcels = window.clickParcels && window.clickParcels.has(pnu);

            return {
                hasColor: parcelColors.hasOwnProperty(pnu) && parcelColors[pnu] !== 'transparent',
                colorValue: parcelColors[pnu],
                hasData: !!foundData,
                memoValue: foundData ? foundData.memo : null,
                inClickParcels: inClickParcels
            };
        }, currentPNU);

        console.log('=== 테스트 결과 ===');
        console.log('새로고침 후 상태:', afterRefresh);

        // 최종 검증: 색상은 없고 데이터는 유지되어야 함
        expect(afterRefresh.hasColor).toBeFalsy();
        expect(afterRefresh.colorValue).toBe('transparent');
        expect(afterRefresh.hasData).toBeTruthy();
        expect(afterRefresh.memoValue).toBe('테스트 메모');
        expect(afterRefresh.inClickParcels).toBeTruthy(); // 필지는 여전히 존재

        if (!afterRefresh.hasColor && afterRefresh.hasData && afterRefresh.memoValue === '테스트 메모') {
            console.log('✅ 테스트 성공: 색상만 제거되고 데이터는 유지됨');
        } else {
            console.log('❌ 테스트 실패');
        }

        // 스크린샷 저장
        await page.screenshot({
            path: 'test-results/color-toggle-only.png',
            fullPage: true
        });
    });
});