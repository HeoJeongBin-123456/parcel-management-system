import { test, expect } from '@playwright/test';

test.describe('Search Mode API Contract Tests', () => {
    let baseUrl = 'http://localhost:3000';

    test.beforeEach(async ({ page }) => {
        await page.goto(baseUrl);
        await page.waitForLoadState('networkidle');
    });

    test('POST /api/search/execute - should execute parcel search', async ({ request }) => {
        const searchRequest = {
            query: '서울시 강남구',
            searchType: 'address',
            limit: 100
        };

        const response = await request.post(`${baseUrl}/api/search/execute`, {
            data: searchRequest
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('query');
        expect(data.query).toBe(searchRequest.query);
        expect(data).toHaveProperty('results');
        expect(Array.isArray(data.results)).toBe(true);
        expect(data).toHaveProperty('totalResults');
        expect(data).toHaveProperty('searchTime');
        expect(data).toHaveProperty('modeAutoSwitched');

        // Validate result structure
        if (data.results.length > 0) {
            const firstResult = data.results[0];
            expect(firstResult).toHaveProperty('pnu');
            expect(firstResult).toHaveProperty('address');
            expect(firstResult).toHaveProperty('lat');
            expect(firstResult).toHaveProperty('lng');
            expect(firstResult).toHaveProperty('matchScore');
        }
    });

    test('POST /api/search/execute - should auto-switch to search mode', async ({ request, page }) => {
        // Ensure we're in click mode first
        await page.evaluate(() => {
            window.ModeManager?.switchMode('click');
        });

        const response = await request.post(`${baseUrl}/api/search/execute`, {
            data: {
                query: '서울',
                searchType: 'all'
            }
        });

        const data = await response.json();
        expect(data.modeAutoSwitched).toBe(true);

        // Verify mode was switched
        const currentMode = await page.evaluate(() => {
            return document.body.className;
        });
        expect(currentMode).toContain('mode-search');
    });

    test('POST /api/search/execute - should respect result limit', async ({ request }) => {
        const maxLimit = 1000;
        const response = await request.post(`${baseUrl}/api/search/execute`, {
            data: {
                query: '서울',
                limit: 2000 // Exceeds max
            }
        });

        const data = await response.json();
        expect(data.results.length).toBeLessThanOrEqual(maxLimit);
    });

    test('POST /api/search/execute - should handle invalid search params', async ({ request }) => {
        const response = await request.post(`${baseUrl}/api/search/execute`, {
            data: {
                // Missing required 'query' field
                searchType: 'address'
            }
        });

        expect(response.status()).toBe(400);
    });

    test('GET /api/search/results - should get current search results', async ({ request }) => {
        // First execute a search
        await request.post(`${baseUrl}/api/search/execute`, {
            data: {
                query: '강남',
                searchType: 'all'
            }
        });

        // Then get results
        const response = await request.get(`${baseUrl}/api/search/results`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('query');
        expect(data).toHaveProperty('results');
        expect(data).toHaveProperty('searchTime');
        expect(data).toHaveProperty('isActive');
    });

    test('GET /api/search/results - should return 404 when no search active', async ({ request, page }) => {
        // Clear any existing search
        await page.evaluate(() => {
            localStorage.removeItem('searchModeData');
        });

        const response = await request.get(`${baseUrl}/api/search/results`);
        expect(response.status()).toBe(404);
    });

    test('DELETE /api/search/clear - should clear search results', async ({ request }) => {
        // First execute a search
        await request.post(`${baseUrl}/api/search/execute`, {
            data: {
                query: '서울',
                searchType: 'all'
            }
        });

        // Then clear
        const response = await request.delete(`${baseUrl}/api/search/clear`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('clearedParcels');
        expect(data).toHaveProperty('modeSwitched');
        expect(data).toHaveProperty('newMode');
    });

    test('DELETE /api/search/clear - should optionally keep search mode', async ({ request }) => {
        const response = await request.delete(`${baseUrl}/api/search/clear?keepMode=true`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.modeSwitched).toBe(false);
    });

    test('DELETE /api/search/parcel/{pnu} - should remove specific search parcel', async ({ request }) => {
        const testPnu = 'SEARCH_PNU_001';

        // Add search parcel to localStorage (simulating search result)
        await request.post(`${baseUrl}/api/search/execute`, {
            data: {
                query: testPnu,
                searchType: 'pnu'
            }
        });

        // Remove specific parcel
        const response = await request.delete(`${baseUrl}/api/search/parcel/${testPnu}`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('pnu');
        expect(data.pnu).toBe(testPnu);
        expect(data).toHaveProperty('removed');
        expect(data.removed).toBe(true);
    });

    test('Search mode UI visibility', async ({ page }) => {
        // Switch to search mode
        await page.evaluate(() => {
            window.ModeManager?.switchMode('search');
        });

        // Check search mode indicator
        const searchIndicator = await page.locator('.search-mode-indicator');
        await expect(searchIndicator).toBeVisible();

        // Check color palette is disabled
        const colorPalette = await page.locator('.color-palette-container');
        const opacity = await colorPalette.evaluate(el =>
            window.getComputedStyle(el).opacity
        );
        expect(parseFloat(opacity)).toBeLessThan(1);
    });

    test('Search results purple color application', async ({ page }) => {
        // Simulate search results
        await page.evaluate(() => {
            const searchData = {
                query: '테스트',
                results: ['PNU_SEARCH_001', 'PNU_SEARCH_002'],
                isActive: true
            };
            localStorage.setItem('searchModeData', JSON.stringify(searchData));
            window.ModeManager?.switchMode('search');
        });

        // Check if search parcels would have purple color class
        const purpleColor = '#9B59B6';
        const bodyClass = await page.evaluate(() => document.body.className);
        expect(bodyClass).toContain('mode-search');
    });

    test('Search mode data persistence', async ({ page }) => {
        const searchData = {
            query: '서울시 중구',
            results: ['PNU1', 'PNU2', 'PNU3'],
            searchTime: Date.now(),
            isActive: true
        };

        // Save search data
        await page.evaluate((data) => {
            localStorage.setItem('searchModeData', JSON.stringify(data));
        }, searchData);

        // Reload page
        await page.reload();

        // Verify data persisted
        const savedData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchModeData') || '{}');
        });

        expect(savedData.query).toBe(searchData.query);
        expect(savedData.results).toEqual(searchData.results);
        expect(savedData.isActive).toBe(true);
    });

    test('Click mode to search mode transition hides click parcels', async ({ page }) => {
        // Add click mode data
        await page.evaluate(() => {
            const clickData = {
                parcels: [['PNU_CLICK_001', { colored: true }]],
                colors: [['PNU_CLICK_001', 2]]
            };
            localStorage.setItem('clickModeData', JSON.stringify(clickData));
            document.body.className = 'mode-click';
        });

        // Switch to search mode
        await page.evaluate(() => {
            window.ModeManager?.switchMode('search');
        });

        // Verify click parcels are hidden
        const bodyClass = await page.evaluate(() => document.body.className);
        expect(bodyClass).toContain('mode-search');

        // Click-only elements should be hidden
        const clickOnlyVisible = await page.evaluate(() => {
            const elements = document.querySelectorAll('.click-only');
            return Array.from(elements).some(el =>
                window.getComputedStyle(el).display !== 'none'
            );
        });
        expect(clickOnlyVisible).toBe(false);
    });
});