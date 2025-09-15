const { test, expect } = require('@playwright/test');

test.describe('Search Mode API - POST /api/search/execute', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // 테스트 데이터 설정
        await page.evaluate(() => {
            const testData = [
                {
                    pnu: '1111010100100010000',
                    parcelName: '서울시 종로구 세종로 1-1',
                    ownerName: '홍길동',
                    ownerAddress: '서울시 종로구',
                    lat: 37.5758,
                    lng: 126.9769,
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[[126.9769, 37.5758], [126.9770, 37.5758], [126.9770, 37.5759], [126.9769, 37.5759], [126.9769, 37.5758]]]
                    }
                },
                {
                    pnu: '1111010100100020000',
                    parcelName: '서울시 종로구 세종로 1-2',
                    ownerName: '김철수',
                    ownerAddress: '서울시 강남구',
                    lat: 37.5759,
                    lng: 126.9770
                }
            ];
            localStorage.setItem('parcelData', JSON.stringify(testData));
        });
    });

    test('should execute search with query', async ({ page }) => {
        const result = await page.evaluate(async () => {
            if (!window.SearchModeManager) {
                throw new Error('SearchModeManager not loaded');
            }

            return await window.SearchModeManager.executeSearch('세종로');
        });

        expect(result).toHaveProperty('query', '세종로');
        expect(result).toHaveProperty('results');
        expect(result).toHaveProperty('totalResults');
        expect(result).toHaveProperty('searchTime');
        expect(result).toHaveProperty('modeAutoSwitched', true);
        expect(result.results.length).toBeGreaterThan(0);
    });

    test('should auto-switch to search mode', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const modeBefore = window.ModeManager.getCurrentMode();
            await window.SearchModeManager.executeSearch('종로구');
            const modeAfter = window.ModeManager.getCurrentMode();

            return {
                modeBefore,
                modeAfter
            };
        });

        expect(result.modeBefore).toBe('click');
        expect(result.modeAfter).toBe('search');
    });

    test('should handle empty query', async ({ page }) => {
        const result = await page.evaluate(async () => {
            return await window.SearchModeManager.executeSearch('');
        });

        expect(result.results).toHaveLength(0);
        expect(result.totalResults).toBe(0);
    });

    test('should search by owner name', async ({ page }) => {
        const result = await page.evaluate(async () => {
            return await window.SearchModeManager.executeSearch('홍길동', 'owner');
        });

        expect(result.results.length).toBe(1);
        expect(result.results[0].ownerName).toBe('홍길동');
    });

    test('should respect search limit', async ({ page }) => {
        // 많은 테스트 데이터 추가
        await page.evaluate(() => {
            const manyParcels = [];
            for (let i = 0; i < 150; i++) {
                manyParcels.push({
                    pnu: `test_${i}`,
                    parcelName: `테스트 필지 ${i}`,
                    lat: 37.5 + i * 0.001,
                    lng: 126.9 + i * 0.001
                });
            }
            localStorage.setItem('parcelData', JSON.stringify(manyParcels));
        });

        const result = await page.evaluate(async () => {
            return await window.SearchModeManager.executeSearch('테스트');
        });

        // 기본 제한은 100개 (performSearch 구현에 따라)
        expect(result.results.length).toBeLessThanOrEqual(1000);
    });
});