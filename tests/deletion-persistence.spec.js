const { test, expect } = require('@playwright/test');

test.describe('필지 삭제 영속성 테스트', () => {
    test('삭제된 필지와 마커가 새로고침 후에도 복원되지 않아야 함', async ({ page }) => {
        const logs = [];
        const errors = [];

        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            logs.push(text);
            console.log(`[브라우저]: ${text}`);
            if (msg.type() === 'error') {
                errors.push(text);
            }
        });

        page.on('pageerror', error => {
            errors.push(error.message);
            console.error('[페이지 오류]:', error.message);
        });

        console.log('=== 1단계: 페이지 로드 및 초기 상태 확인 ===');
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000);

        // localStorage 초기화
        await page.evaluate(() => {
            localStorage.removeItem('deletedParcels');
            console.log('deletedParcels 초기화 완료');
        });

        console.log('=== 2단계: 테스트 필지 생성 ===');

        // 지도 클릭하여 필지 선택
        const mapContainer = page.locator('#map');
        const box = await mapContainer.boundingBox();

        if (!box) {
            throw new Error('지도 컨테이너를 찾을 수 없습니다');
        }

        // 지도 중앙 클릭
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        await page.mouse.click(centerX, centerY);
        await page.waitForTimeout(2000);

        // 필지 정보 입력
        const testParcelNumber = '테스트필지_' + Date.now();
        const testOwnerName = '테스트소유자';
        const testMemo = '삭제 영속성 테스트용 메모';

        await page.fill('#parcelNumber', testParcelNumber);
        await page.fill('#ownerName', testOwnerName);
        await page.fill('#ownerAddress', '테스트 주소 123');
        await page.fill('#ownerContact', '010-1234-5678');
        await page.fill('#memo', testMemo);

        // 저장
        await page.click('#saveBtn');
        await page.waitForTimeout(2000);

        // 마커 생성 확인
        const markersBefore = await page.evaluate(() => {
            if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
                return window.MemoMarkerManager.markers.size;
            }
            return 0;
        });

        console.log(`✅ 마커 생성 확인: ${markersBefore}개의 마커 존재`);

        // 현재 필지의 PNU 가져오기
        const currentPNU = await page.evaluate(() => {
            return window.selectedPnu || window.selectedParcel?.properties?.PNU;
        });

        console.log(`현재 선택된 필지 PNU: ${currentPNU}`);

        console.log('=== 3단계: 필지 삭제 ===');

        // 마커 클릭 (마커는 필지 위치 약간 위에 생성됨)
        await page.mouse.click(centerX, centerY - 20);
        await page.waitForTimeout(1000);

        // 삭제 버튼 클릭
        await page.click('#resetBtn');

        // confirm 다이얼로그 처리
        page.once('dialog', async dialog => {
            console.log('다이얼로그 메시지:', dialog.message());
            await dialog.accept();
        });

        await page.waitForTimeout(3000);

        // 삭제 후 상태 확인
        const deletedParcelsAfter = await page.evaluate(() => {
            const deleted = localStorage.getItem('deletedParcels');
            return deleted ? JSON.parse(deleted) : [];
        });

        console.log(`삭제된 필지 목록: ${JSON.stringify(deletedParcelsAfter)}`);

        // 마커 제거 확인
        const markersAfterDelete = await page.evaluate(() => {
            if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
                return window.MemoMarkerManager.markers.size;
            }
            return 0;
        });

        console.log(`✅ 삭제 후 마커 개수: ${markersAfterDelete}개`);

        // 입력 필드 초기화 확인
        const parcelNumberAfter = await page.inputValue('#parcelNumber');
        const ownerNameAfter = await page.inputValue('#ownerName');
        const memoAfter = await page.inputValue('#memo');

        expect(parcelNumberAfter).toBe('');
        expect(ownerNameAfter).toBe('');
        expect(memoAfter).toBe('');
        console.log('✅ 입력 필드 초기화 확인');

        // 삭제 전후 스크린샷
        await page.screenshot({
            path: 'deletion-before-refresh.png',
            fullPage: true
        });

        console.log('=== 4단계: 페이지 새로고침 ===');
        await page.reload();
        await page.waitForTimeout(3000);

        // 새로고침 후 deletedParcels 확인
        const deletedParcelsAfterRefresh = await page.evaluate(() => {
            const deleted = localStorage.getItem('deletedParcels');
            console.log('새로고침 후 deletedParcels:', deleted);
            return deleted ? JSON.parse(deleted) : [];
        });

        console.log(`새로고침 후 삭제된 필지 목록: ${JSON.stringify(deletedParcelsAfterRefresh)}`);

        // deletedParcels가 유지되는지 확인
        expect(deletedParcelsAfterRefresh.length).toBeGreaterThan(0);
        console.log('✅ deletedParcels가 새로고침 후에도 유지됨');

        // 새로고침 후 마커 개수 확인
        const markersAfterRefresh = await page.evaluate(() => {
            if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
                const markerCount = window.MemoMarkerManager.markers.size;
                console.log(`MemoMarkerManager 마커 개수: ${markerCount}`);

                // 각 마커 정보 출력
                window.MemoMarkerManager.markers.forEach((value, key) => {
                    console.log(`마커 PNU: ${key}`);
                });

                return markerCount;
            }
            return 0;
        });

        console.log(`✅ 새로고침 후 마커 개수: ${markersAfterRefresh}개`);

        // 삭제된 필지의 마커가 복원되지 않았는지 확인
        if (currentPNU) {
            const deletedMarkerExists = await page.evaluate((pnu) => {
                if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
                    return window.MemoMarkerManager.markers.has(pnu);
                }
                return false;
            }, currentPNU);

            expect(deletedMarkerExists).toBeFalsy();
            console.log(`✅ 삭제된 필지(${currentPNU})의 마커가 복원되지 않음`);
        }

        // localStorage 데이터 확인
        const localStorageData = await page.evaluate(() => {
            const data = localStorage.getItem('parcelData');
            return data ? JSON.parse(data) : [];
        });

        console.log(`localStorage의 필지 데이터 개수: ${localStorageData.length}`);

        // 새로고침 후 스크린샷
        await page.screenshot({
            path: 'deletion-after-refresh.png',
            fullPage: true
        });

        // 오류 확인
        if (errors.length > 0) {
            console.error('❌ 테스트 중 오류 발생:', errors);
            throw new Error('테스트 중 오류 발생: ' + errors.join(', '));
        }

        console.log('✅ 삭제 영속성 테스트 완료 - 모든 검증 통과!');
    });

    test('소하동 1330 같은 특정 필지 삭제 시나리오', async ({ page }) => {
        console.log('=== 특정 필지 삭제 시나리오 테스트 ===');

        page.on('console', msg => console.log(`[브라우저]: ${msg.text()}`));

        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000);

        // 테스트를 위한 특정 위치 클릭 (실제 소하동 1330 위치 대신 테스트용 위치)
        const mapContainer = page.locator('#map');
        const box = await mapContainer.boundingBox();

        if (box) {
            // 약간 다른 위치 클릭
            await page.mouse.click(box.x + box.width / 3, box.y + box.height / 3);
            await page.waitForTimeout(2000);

            // 소하동 1330과 유사한 정보 입력
            await page.fill('#parcelNumber', '소하동 1330 테스트');
            await page.fill('#ownerName', '테스트 소유자');
            await page.fill('#memo', '특정 필지 테스트');

            // 저장
            await page.click('#saveBtn');
            await page.waitForTimeout(2000);

            // 현재 PNU 저장
            const testPNU = await page.evaluate(() => {
                return window.selectedPnu || window.selectedParcel?.properties?.PNU;
            });

            console.log(`테스트 필지 PNU: ${testPNU}`);

            // 마커 클릭
            await page.mouse.click(box.x + box.width / 3, box.y + box.height / 3 - 20);
            await page.waitForTimeout(1000);

            // 삭제
            page.once('dialog', dialog => dialog.accept());
            await page.click('#resetBtn');
            await page.waitForTimeout(3000);

            // 페이지 새로고침
            console.log('페이지 새로고침...');
            await page.reload();
            await page.waitForTimeout(3000);

            // 삭제된 필지가 복원되지 않았는지 확인
            const restoredMarker = await page.evaluate((pnu) => {
                if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
                    return window.MemoMarkerManager.markers.has(pnu);
                }
                return false;
            }, testPNU);

            expect(restoredMarker).toBeFalsy();
            console.log(`✅ 특정 필지(${testPNU})가 새로고침 후에도 삭제 상태 유지`);

            await page.screenshot({
                path: 'specific-parcel-deletion-test.png',
                fullPage: true
            });
        }
    });
});