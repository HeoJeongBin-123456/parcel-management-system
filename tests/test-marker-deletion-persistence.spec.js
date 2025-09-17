import { test, expect } from '@playwright/test';

test.describe('마커 삭제 영속성 테스트', () => {
    test.beforeEach(async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('✅') || text.includes('❌') || text.includes('📍') ||
                text.includes('🗑️') || text.includes('🔍')) {
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
        await page.goto('http://localhost:3000', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        // 지도 로드 대기
        await page.waitForTimeout(3000);
    });

    test('필지 정보 삭제 후 마커가 새로고침 후에도 나타나지 않는지 확인', async ({ page }) => {
        console.log('🎯 마커 삭제 영속성 테스트 시작');

        // 1. 클릭 모드로 전환
        const clickModeBtn = page.locator('button').filter({ hasText: '클릭' }).first();
        await clickModeBtn.click();
        await page.waitForTimeout(1000);
        console.log('✅ 클릭 모드 활성화');

        // 2. 지도 중앙 클릭하여 필지 선택
        const mapContainer = page.locator('.map-container');
        const box = await mapContainer.boundingBox();
        if (!box) throw new Error('지도 컨테이너를 찾을 수 없습니다');

        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        // 필지 생성
        await page.mouse.click(centerX, centerY);
        await page.waitForTimeout(3000);

        // 3. 필지 정보 확인 및 메모 추가
        const parcelNumber = await page.inputValue('#parcelNumber');
        console.log('선택된 필지 번호:', parcelNumber || '알 수 없음');

        if (!parcelNumber) {
            console.log('⚠️ 필지를 선택할 수 없습니다. 테스트 종료.');
            return;
        }

        // 메모 추가하여 마커 생성
        await page.fill('#memo', '테스트 마커용 메모');
        await page.waitForTimeout(500);

        // 현재 PNU 가져오기
        const currentPNU = await page.evaluate(() => window.currentSelectedPNU);
        console.log('현재 PNU:', currentPNU);

        // 4. 저장 버튼 클릭
        const saveBtn = page.locator('button').filter({ hasText: '저장' }).first();
        await saveBtn.click();
        await page.waitForTimeout(2000);
        console.log('✅ 필지 정보 저장 완료');

        // 5. 마커가 생성되었는지 확인
        const hasMarkerBefore = await page.evaluate((pnu) => {
            if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
                return window.MemoMarkerManager.markers.has(pnu);
            }
            return false;
        }, currentPNU);
        console.log('마커 생성 확인:', hasMarkerBefore);

        // 6. localStorage 상태 확인
        const beforeDelete = await page.evaluate((pnu) => {
            const parcelData = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
            const foundData = parcelData.find(item => item.pnu === pnu);

            return {
                hasData: !!foundData,
                dataDetails: foundData,
                hasMarkerState: !!markerStates[pnu],
                markerState: markerStates[pnu]
            };
        }, currentPNU);
        console.log('삭제 전 상태:', beforeDelete);

        // 7. 필지 정보 삭제 버튼 클릭
        const deleteBtn = page.locator('button').filter({ hasText: '필지 정보 삭제' }).first();
        await deleteBtn.click();
        await page.waitForTimeout(2000);
        console.log('✅ 필지 정보 삭제 완료');

        // 8. 삭제 후 상태 확인
        const afterDelete = await page.evaluate((pnu) => {
            const parcelData = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
            const foundData = parcelData.find(item => item.pnu === pnu);

            const hasMarker = window.MemoMarkerManager &&
                             window.MemoMarkerManager.markers &&
                             window.MemoMarkerManager.markers.has(pnu);

            return {
                hasData: !!foundData,
                dataDetails: foundData,
                hasMarkerState: !!markerStates[pnu],
                markerState: markerStates[pnu],
                hasMarkerOnMap: hasMarker
            };
        }, currentPNU);
        console.log('삭제 후 상태:', afterDelete);

        // 마커가 제거되었는지 확인
        expect(afterDelete.hasMarkerOnMap).toBeFalsy();
        expect(afterDelete.hasMarkerState).toBeFalsy();

        // 9. 페이지 새로고침
        console.log('🔄 페이지 새로고침...');
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);

        // 10. 새로고침 후 상태 확인
        const afterRefresh = await page.evaluate((pnu) => {
            const parcelData = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
            const foundData = parcelData.find(item => item.pnu === pnu);

            // MemoMarkerManager가 로드될 때까지 대기
            let hasMarker = false;
            if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
                hasMarker = window.MemoMarkerManager.markers.has(pnu);
            }

            return {
                hasData: !!foundData,
                dataDetails: foundData,
                hasMarkerState: !!markerStates[pnu],
                markerState: markerStates[pnu],
                hasMarkerOnMap: hasMarker,
                markerManagerExists: !!window.MemoMarkerManager
            };
        }, currentPNU);

        console.log('=== 테스트 결과 ===');
        console.log('새로고침 후 상태:', afterRefresh);

        // 최종 검증: 마커가 다시 생성되지 않아야 함
        expect(afterRefresh.hasMarkerOnMap).toBeFalsy();
        expect(afterRefresh.hasMarkerState).toBeFalsy();

        // 데이터도 확인
        if (afterRefresh.dataDetails) {
            console.log('남은 데이터 내용:', {
                memo: afterRefresh.dataDetails.memo,
                ownerName: afterRefresh.dataDetails.ownerName,
                ownerAddress: afterRefresh.dataDetails.ownerAddress,
                ownerContact: afterRefresh.dataDetails.ownerContact
            });
        }

        if (!afterRefresh.hasMarkerOnMap && !afterRefresh.hasMarkerState) {
            console.log('✅ 테스트 성공: 마커가 영속적으로 삭제됨');
        } else {
            console.log('❌ 테스트 실패: 마커가 다시 나타남');
        }

        // 스크린샷 저장
        await page.screenshot({
            path: 'test-results/marker-deletion-persistence.png',
            fullPage: true
        });
    });
});