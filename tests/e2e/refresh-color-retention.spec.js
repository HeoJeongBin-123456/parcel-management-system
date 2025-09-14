/**
 * E2E Test: 새로고침 후 색상 유지 테스트
 * 요구사항: 브라우저 새로고침 후에도 필지 색상이 유지되어야 함
 */

const { test, expect } = require('@playwright/test');

test.describe('새로고침 후 색상 유지 E2E 테스트', () => {

    test('단일 필지 색상 새로고침 후 유지', async ({ page }) => {
        // Given: 애플리케이션 로드
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#map', { state: 'visible' });

        // 테스트 필지 생성 및 색상 적용
        const testData = await page.evaluate(() => {
            const parcel = {
                id: 'refresh_test_' + Date.now(),
                pnu: '1111010100100010000',
                lat: 37.5665,
                lng: 126.9780,
                address: '서울시 중구 테스트동'
            };

            // 필지 추가
            if (!window.parcelsData) window.parcelsData = [];
            window.parcelsData.push(parcel);

            // 색상 적용
            const colorData = {
                color: '#FF6B6B',
                is_colored: true,
                color_index: 0
            };

            window.dataPersistenceManager?.saveColorState(parcel.id, colorData);

            return {
                parcelId: parcel.id,
                appliedColor: colorData.color
            };
        });

        // LocalStorage 확인
        const beforeRefresh = await page.evaluate(() => {
            return localStorage.getItem('parcelColors');
        });
        expect(beforeRefresh).toBeTruthy();

        // When: 페이지 새로고침
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#map', { state: 'visible' });

        // Then: 색상이 복원되었는지 확인
        const afterRefresh = await page.evaluate((parcelId) => {
            // DataPersistenceManager 초기화 대기
            const colorState = window.dataPersistenceManager?.getColorState(parcelId);
            return colorState;
        }, testData.parcelId);

        expect(afterRefresh).toBeTruthy();
        expect(afterRefresh.color).toBe(testData.appliedColor);
        expect(afterRefresh.is_colored).toBe(true);
        expect(afterRefresh.color_index).toBe(0);
    });

    test('여러 필지 색상 새로고침 후 모두 유지', async ({ page }) => {
        // Given: 애플리케이션 로드
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#map', { state: 'visible' });

        // 여러 필지에 다양한 색상 적용
        const testParcels = await page.evaluate(() => {
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
            const parcels = [];

            for (let i = 0; i < 5; i++) {
                const parcel = {
                    id: `multi_refresh_${i}_${Date.now()}`,
                    pnu: `111101010010001000${i}`,
                    lat: 37.5665 + i * 0.001,
                    lng: 126.9780 + i * 0.001
                };

                // 필지 추가
                if (!window.parcelsData) window.parcelsData = [];
                window.parcelsData.push(parcel);

                // 색상 적용
                const colorData = {
                    color: colors[i],
                    is_colored: true,
                    color_index: i
                };

                window.dataPersistenceManager?.saveColorState(parcel.id, colorData);

                parcels.push({
                    id: parcel.id,
                    expectedColor: colors[i],
                    expectedIndex: i
                });
            }

            return parcels;
        });

        // When: 페이지 새로고침
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#map', { state: 'visible' });

        // Then: 모든 색상이 복원되었는지 확인
        for (const parcel of testParcels) {
            const colorState = await page.evaluate((parcelId) => {
                return window.dataPersistenceManager?.getColorState(parcelId);
            }, parcel.id);

            expect(colorState).toBeTruthy();
            expect(colorState.color).toBe(parcel.expectedColor);
            expect(colorState.is_colored).toBe(true);
            expect(colorState.color_index).toBe(parcel.expectedIndex);
        }
    });

    test('색상 제거 후 새로고침 시 제거 상태 유지', async ({ page }) => {
        // Given: 애플리케이션 로드
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#map', { state: 'visible' });

        const testParcelId = 'remove_refresh_test_' + Date.now();

        // 색상 적용 후 제거
        await page.evaluate((parcelId) => {
            const parcel = {
                id: parcelId,
                pnu: '1111010100100020000',
                lat: 37.5666,
                lng: 126.9781
            };

            // 필지 추가
            if (!window.parcelsData) window.parcelsData = [];
            window.parcelsData.push(parcel);

            // 색상 적용
            window.dataPersistenceManager?.saveColorState(parcelId, {
                color: '#FF0000',
                is_colored: true,
                color_index: 0
            });

            // 색상 제거
            window.dataPersistenceManager?.removeColorState(parcelId);
        }, testParcelId);

        // When: 페이지 새로고침
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#map', { state: 'visible' });

        // Then: 색상이 없는 상태가 유지되는지 확인
        const colorState = await page.evaluate((parcelId) => {
            return window.dataPersistenceManager?.getColorState(parcelId);
        }, testParcelId);

        expect(colorState).toBeNull();
    });

    test('브라우저 탭 닫고 다시 열어도 색상 유지', async ({ browser }) => {
        // Given: 첫 번째 탭에서 색상 적용
        const context1 = await browser.newContext();
        const page1 = await context1.newPage();

        await page1.goto('http://localhost:3000');
        await page1.waitForLoadState('networkidle');
        await page1.waitForSelector('#map', { state: 'visible' });

        const testData = await page1.evaluate(() => {
            const parcel = {
                id: 'tab_test_' + Date.now(),
                pnu: '1111010100100030000',
                lat: 37.5667,
                lng: 126.9782
            };

            // 필지 추가
            if (!window.parcelsData) window.parcelsData = [];
            window.parcelsData.push(parcel);

            // 색상 적용
            const colorData = {
                color: '#45B7D1',
                is_colored: true,
                color_index: 2
            };

            window.dataPersistenceManager?.saveColorState(parcel.id, colorData);

            return { parcelId: parcel.id, color: colorData.color };
        });

        // 첫 번째 탭 닫기
        await page1.close();
        await context1.close();

        // When: 새 탭에서 애플리케이션 열기
        const context2 = await browser.newContext();
        const page2 = await context2.newPage();

        await page2.goto('http://localhost:3000');
        await page2.waitForLoadState('networkidle');
        await page2.waitForSelector('#map', { state: 'visible' });

        // Then: 색상이 유지되는지 확인
        const colorState = await page2.evaluate((parcelId) => {
            return window.dataPersistenceManager?.getColorState(parcelId);
        }, testData.parcelId);

        expect(colorState).toBeTruthy();
        expect(colorState.color).toBe(testData.color);
        expect(colorState.is_colored).toBe(true);

        await page2.close();
        await context2.close();
    });

    test('색상 복원 시간 측정', async ({ page }) => {
        // Given: 많은 필지에 색상 적용
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#map', { state: 'visible' });

        const parcelCount = 100;
        await page.evaluate((count) => {
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

            for (let i = 0; i < count; i++) {
                const parcel = {
                    id: `perf_test_${i}`,
                    pnu: `11110101001000${i.toString().padStart(5, '0')}`,
                    lat: 37.5665 + (i % 10) * 0.001,
                    lng: 126.9780 + Math.floor(i / 10) * 0.001
                };

                // 색상 적용
                window.dataPersistenceManager?.saveColorState(parcel.id, {
                    color: colors[i % colors.length],
                    is_colored: true,
                    color_index: i % colors.length
                });
            }
        }, parcelCount);

        // When: 페이지 새로고침 및 복원 시간 측정
        const startTime = Date.now();
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#map', { state: 'visible' });

        // 색상 복원 완료 확인
        const restoredCount = await page.evaluate(() => {
            return window.dataPersistenceManager?.getAllColorStates()?.size || 0;
        });

        const restorationTime = Date.now() - startTime;

        // Then: 복원 시간 및 데이터 무결성 확인
        console.log(`${parcelCount}개 필지 색상 복원 시간: ${restorationTime}ms`);
        expect(restorationTime).toBeLessThan(500); // 500ms 이내
        expect(restoredCount).toBeGreaterThanOrEqual(parcelCount);
    });
});