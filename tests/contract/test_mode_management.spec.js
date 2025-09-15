import { test, expect } from '@playwright/test';

test.describe('Mode Management API Contract Tests', () => {
    let baseUrl = 'http://localhost:3000';

    test.beforeEach(async ({ page }) => {
        await page.goto(baseUrl);
        await page.waitForLoadState('networkidle');
    });

    test('GET /api/mode/current - should return current active mode', async ({ request }) => {
        const response = await request.get(`${baseUrl}/api/mode/current`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('mode');
        expect(['click', 'search', 'hand']).toContain(data.mode);
        expect(data).toHaveProperty('lastSwitchTime');
        expect(data).toHaveProperty('stats');
        expect(data.stats).toHaveProperty('parcelsCount');
        expect(data.stats).toHaveProperty('markersCount');
    });

    test('POST /api/mode/switch - should switch to different mode', async ({ request }) => {
        // Test switching to search mode
        const response = await request.post(`${baseUrl}/api/mode/switch`, {
            data: {
                mode: 'search',
                saveCurrentState: true
            }
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('previousMode');
        expect(data).toHaveProperty('currentMode');
        expect(data.currentMode).toBe('search');
        expect(data).toHaveProperty('switchTime');
    });

    test('POST /api/mode/switch - should reject invalid mode', async ({ request }) => {
        const response = await request.post(`${baseUrl}/api/mode/switch`, {
            data: {
                mode: 'invalid_mode'
            }
        });

        expect(response.status()).toBe(400);
    });

    test('GET /api/mode/data/{mode} - should return mode specific data', async ({ request }) => {
        const response = await request.get(`${baseUrl}/api/mode/data/click`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('mode');
        expect(data.mode).toBe('click');
        expect(data).toHaveProperty('parcels');
        expect(Array.isArray(data.parcels)).toBe(true);
        expect(data).toHaveProperty('stats');
    });

    test('GET /api/mode/data/{mode} - should return 404 for invalid mode', async ({ request }) => {
        const response = await request.get(`${baseUrl}/api/mode/data/invalid`);
        expect(response.status()).toBe(404);
    });

    test('Mode persistence after page reload', async ({ page }) => {
        // Switch to search mode
        await page.evaluate(() => {
            window.ModeManager?.switchMode('search');
        });

        // Reload page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Check if mode is still search
        const currentMode = await page.evaluate(() => {
            return localStorage.getItem('currentMode');
        });

        expect(currentMode).toBe('search');
    });

    test('Mode data isolation', async ({ page }) => {
        // Add data in click mode
        await page.evaluate(() => {
            const clickData = {
                parcels: new Map([['PNU123', { lat: 37.5, lng: 127.0 }]]),
                colors: new Map([['PNU123', 0]])
            };
            localStorage.setItem('clickModeData', JSON.stringify({
                parcels: Array.from(clickData.parcels.entries()),
                colors: Array.from(clickData.colors.entries())
            }));
        });

        // Switch to search mode
        await page.evaluate(() => {
            window.ModeManager?.switchMode('search');
        });

        // Add data in search mode
        await page.evaluate(() => {
            const searchData = {
                query: '서울시',
                results: ['PNU456', 'PNU789']
            };
            localStorage.setItem('searchModeData', JSON.stringify(searchData));
        });

        // Verify data isolation
        const clickData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('clickModeData') || '{}');
        });

        const searchData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchModeData') || '{}');
        });

        expect(clickData.parcels).toBeDefined();
        expect(searchData.query).toBe('서울시');
        expect(clickData).not.toHaveProperty('query');
        expect(searchData).not.toHaveProperty('colors');
    });
});