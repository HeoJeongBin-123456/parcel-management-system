/**
 * Integration Test: 색상 즉시 저장 테스트
 * 요구사항: 색상 선택 시 100ms 이내 저장
 */

const { test, expect } = require('@playwright/test');

test.describe('색상 즉시 저장 통합 테스트', () => {

    test.beforeEach(async ({ page }) => {
        // 애플리케이션 로드
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
    });

    test('색상 선택 시 100ms 이내 즉시 저장', async ({ page }) => {
        // Given: 지도에서 필지 선택
        await page.waitForSelector('#map', { state: 'visible' });

        // 테스트용 필지 데이터 주입
        const testParcel = await page.evaluate(() => {
            const parcel = {
                id: 'immediate_save_test_' + Date.now(),
                pnu: '1111010100100010000',
                lat: 37.5665,
                lng: 126.9780,
                address: '서울시 중구 테스트동'
            };

            // 전역 변수에 추가
            if (!window.parcelsData) window.parcelsData = [];
            window.parcelsData.push(parcel);

            return parcel;
        });

        // When: 색상 팔레트에서 색상 선택
        const colorIndex = 3; // 4번째 색상 선택
        const startTime = Date.now();

        const saveResult = await page.evaluate(async ({ parcelId, colorIndex }) => {
            // 색상 데이터
            const colors = [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
                '#FFEAA7', '#DDA0DD', '#98D8C8', '#FD79A8',
                '#A29BFE', '#FDCB6E'
            ];

            const colorData = {
                color: colors[colorIndex],
                is_colored: true,
                color_index: colorIndex
            };

            // 즉시 저장 실행
            const saveStart = Date.now();
            const result = await window.dataPersistenceManager?.saveColorState(parcelId, colorData);
            const saveTime = Date.now() - saveStart;

            return {
                success: result,
                saveTime: saveTime,
                savedColor: window.dataPersistenceManager?.getColorState(parcelId)
            };
        }, { parcelId: testParcel.id, colorIndex });

        const totalTime = Date.now() - startTime;

        // Then: 저장 시간 및 결과 검증
        expect(saveResult.success).toBe(true);
        expect(saveResult.saveTime).toBeLessThan(100); // 100ms 이내
        expect(totalTime).toBeLessThan(150); // 전체 프로세스 150ms 이내

        // 저장된 색상 확인
        expect(saveResult.savedColor).toBeTruthy();
        expect(saveResult.savedColor.is_colored).toBe(true);
        expect(saveResult.savedColor.color_index).toBe(colorIndex);

        // LocalStorage 확인
        const localStorageData = await page.evaluate(() => {
            return localStorage.getItem('parcelColors');
        });

        expect(localStorageData).toBeTruthy();
        const parsedData = JSON.parse(localStorageData);
        expect(parsedData[testParcel.id]).toBeTruthy();
    });

    test('여러 필지 연속 색상 변경 성능', async ({ page }) => {
        // Given: 여러 필지 준비
        const parcelCount = 10;
        const testParcels = await page.evaluate((count) => {
            const parcels = [];
            for (let i = 0; i < count; i++) {
                parcels.push({
                    id: `batch_color_test_${i}_${Date.now()}`,
                    pnu: `111101010010001000${i}`,
                    lat: 37.5665 + i * 0.001,
                    lng: 126.9780 + i * 0.001
                });
            }
            return parcels;
        }, parcelCount);

        // When: 모든 필지에 색상 적용
        const results = [];
        for (let i = 0; i < testParcels.length; i++) {
            const result = await page.evaluate(async ({ parcel, colorIndex }) => {
                const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
                const colorData = {
                    color: colors[colorIndex % colors.length],
                    is_colored: true,
                    color_index: colorIndex % colors.length
                };

                const start = Date.now();
                const success = await window.dataPersistenceManager?.saveColorState(parcel.id, colorData);
                const time = Date.now() - start;

                return { success, time, parcelId: parcel.id };
            }, { parcel: testParcels[i], colorIndex: i });

            results.push(result);
        }

        // Then: 모든 저장이 성공하고 각각 100ms 이내
        results.forEach((result, index) => {
            expect(result.success).toBe(true);
            expect(result.time).toBeLessThan(100);
        });

        // 평균 저장 시간 계산
        const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
        console.log(`평균 저장 시간: ${avgTime}ms`);
        expect(avgTime).toBeLessThan(50); // 평균 50ms 이내
    });

    test('오프라인 모드에서 즉시 저장', async ({ page, context }) => {
        // Given: 오프라인 모드 설정
        await context.setOffline(true);

        const testParcelId = 'offline_save_test_' + Date.now();

        // When: 오프라인 상태에서 색상 저장
        const saveResult = await page.evaluate(async (parcelId) => {
            const colorData = {
                color: '#FF0000',
                is_colored: true,
                color_index: 0
            };

            const start = Date.now();
            const success = await window.dataPersistenceManager?.saveColorState(parcelId, colorData);
            const time = Date.now() - start;

            // LocalStorage 확인
            const localData = localStorage.getItem('parcelColors');
            const hasLocal = localData && JSON.parse(localData)[parcelId];

            return { success, time, hasLocal };
        }, testParcelId);

        // Then: 오프라인에서도 즉시 저장 성공
        expect(saveResult.success).toBe(true);
        expect(saveResult.time).toBeLessThan(100);
        expect(saveResult.hasLocal).toBeTruthy();

        // When: 온라인 복귀
        await context.setOffline(false);

        // Then: 자동 동기화 확인 (시간 여유를 둠)
        await page.waitForTimeout(2000);

        const syncStatus = await page.evaluate((parcelId) => {
            const colorState = window.dataPersistenceManager?.getColorState(parcelId);
            return colorState;
        }, testParcelId);

        expect(syncStatus).toBeTruthy();
        expect(syncStatus.color).toBe('#FF0000');
    });

    test('색상 변경 이벤트 발생 확인', async ({ page }) => {
        const testParcelId = 'event_test_' + Date.now();

        // Given: 이벤트 리스너 설정
        await page.evaluate(() => {
            window.colorUpdateEvents = [];
            window.addEventListener('parcelColorUpdate', (event) => {
                window.colorUpdateEvents.push(event.detail);
            });
        });

        // When: 색상 저장
        await page.evaluate(async (parcelId) => {
            await window.dataPersistenceManager?.saveColorState(parcelId, {
                color: '#00FF00',
                is_colored: true,
                color_index: 1
            });
        }, testParcelId);

        // Then: 이벤트가 발생했는지 확인
        const events = await page.evaluate(() => window.colorUpdateEvents);

        expect(events).toHaveLength(1);
        expect(events[0].parcelId).toBe(testParcelId);
        expect(events[0].colorState.color).toBe('#00FF00');
    });
});