/**
 * Contract Test: Parcel Color API
 * POST /api/parcels/{id}/color
 * GET /api/parcels/with-colors
 */

const { test, expect } = require('@playwright/test');

test.describe('Parcel Color API Contract Tests', () => {
    let testParcelId;

    test.beforeAll(async () => {
        // 테스트용 필지 ID 생성
        testParcelId = 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    });

    test.beforeEach(async ({ page }) => {
        // 애플리케이션 로드
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // DataPersistenceManager 초기화 대기
        await page.waitForFunction(() => {
            return window.dataPersistenceManager !== undefined;
        }, { timeout: 5000 });
    });

    test('POST /api/parcels/{id}/color - 색상 즉시 저장', async ({ page }) => {
        // Given: 색상 데이터
        const colorData = {
            color: '#FF5733',
            is_colored: true,
            color_index: 3
        };

        // When: 색상 저장 API 호출
        const startTime = Date.now();
        const response = await page.evaluate(async ({ parcelId, colorData }) => {
            // DataPersistenceManager를 통한 색상 저장
            if (window.dataPersistenceManager) {
                return await window.dataPersistenceManager.saveColorState(parcelId, colorData);
            }
            return false;
        }, { parcelId: testParcelId, colorData });

        const responseTime = Date.now() - startTime;

        // Then: 응답 검증
        expect(response).toBe(true);
        expect(responseTime).toBeLessThan(100); // 100ms 이내 응답

        // LocalStorage 확인
        const savedColor = await page.evaluate((parcelId) => {
            const colorState = window.dataPersistenceManager?.getColorState(parcelId);
            return colorState;
        }, testParcelId);

        expect(savedColor).toBeTruthy();
        expect(savedColor.color).toBe('#FF5733');
        expect(savedColor.is_colored).toBe(true);
        expect(savedColor.color_index).toBe(3);
    });

    test('GET /api/parcels/with-colors - 색상 적용된 필지 조회', async ({ page }) => {
        // Given: 여러 필지에 색상 적용
        const testParcels = [
            { id: 'test1', color: '#FF5733', is_colored: true },
            { id: 'test2', color: '#33FF57', is_colored: true },
            { id: 'test3', color: null, is_colored: false }
        ];

        // 색상 적용
        for (const parcel of testParcels) {
            await page.evaluate(async ({ parcel }) => {
                if (window.dataPersistenceManager && parcel.is_colored) {
                    await window.dataPersistenceManager.saveColorState(parcel.id, parcel);
                }
            }, { parcel });
        }

        // When: 색상이 적용된 필지 조회
        const coloredParcels = await page.evaluate(() => {
            const allStates = window.dataPersistenceManager?.getAllColorStates();
            if (!allStates) return [];

            const colored = [];
            allStates.forEach((state, id) => {
                if (state.is_colored) {
                    colored.push({ id, ...state });
                }
            });
            return colored;
        });

        // Then: 색상이 적용된 필지만 반환되는지 확인
        expect(coloredParcels.length).toBeGreaterThanOrEqual(2);
        const testColoredParcels = coloredParcels.filter(p => p.id.startsWith('test'));
        expect(testColoredParcels.some(p => p.id === 'test1')).toBe(true);
        expect(testColoredParcels.some(p => p.id === 'test2')).toBe(true);
        expect(testColoredParcels.some(p => p.id === 'test3')).toBe(false);
    });

    test('POST /api/parcels/bulk-color - 배치 색상 업데이트', async ({ page }) => {
        // Given: 배치 업데이트 데이터
        const bulkUpdates = [
            { parcelId: 'bulk1', colorData: { color: '#FF0000', is_colored: true, color_index: 0 } },
            { parcelId: 'bulk2', colorData: { color: '#00FF00', is_colored: true, color_index: 1 } },
            { parcelId: 'bulk3', colorData: { color: '#0000FF', is_colored: true, color_index: 2 } }
        ];

        // When: 배치 업데이트 실행
        const result = await page.evaluate(async (updates) => {
            if (window.dataPersistenceManager) {
                await window.dataPersistenceManager.batchUpdateColors(updates);
                return true;
            }
            return false;
        }, bulkUpdates);

        // Then: 모든 색상이 저장되었는지 확인
        expect(result).toBe(true);

        for (const update of bulkUpdates) {
            const savedColor = await page.evaluate((parcelId) => {
                return window.dataPersistenceManager?.getColorState(parcelId);
            }, update.parcelId);

            expect(savedColor).toBeTruthy();
            expect(savedColor.color).toBe(update.colorData.color);
            expect(savedColor.is_colored).toBe(true);
        }
    });

    test('색상 제거 기능', async ({ page }) => {
        // Given: 색상이 적용된 필지
        const parcelId = 'remove_test';
        await page.evaluate(async ({ id, color }) => {
            await window.dataPersistenceManager?.saveColorState(id, {
                color: color,
                is_colored: true,
                color_index: 5
            });
        }, { id: parcelId, color: '#123456' });

        // When: 색상 제거
        await page.evaluate(async (id) => {
            await window.dataPersistenceManager?.removeColorState(id);
        }, parcelId);

        // Then: 색상이 제거되었는지 확인
        const colorState = await page.evaluate((id) => {
            return window.dataPersistenceManager?.getColorState(id);
        }, parcelId);

        expect(colorState).toBeNull();
    });
});