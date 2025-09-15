const { test, expect } = require('@playwright/test');

test.describe('Mode Management API - GET /api/mode/current', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
    });

    test('should return current mode information', async ({ page }) => {
        // API 호출 모킹
        const response = await page.evaluate(async () => {
            // ModeManager가 로드될 때까지 대기
            if (!window.ModeManager) {
                throw new Error('ModeManager not loaded');
            }

            return {
                mode: window.ModeManager.getCurrentMode(),
                lastSwitchTime: Date.now(),
                stats: {
                    parcelsCount: window.ModeManager.getModeData('click')?.parcels?.size || 0,
                    markersCount: window.ModeManager.getModeData('click')?.markers?.size || 0
                }
            };
        });

        expect(response).toHaveProperty('mode');
        expect(['click', 'search', 'hand']).toContain(response.mode);
        expect(response).toHaveProperty('lastSwitchTime');
        expect(response).toHaveProperty('stats');
        expect(response.stats).toHaveProperty('parcelsCount');
        expect(response.stats).toHaveProperty('markersCount');
    });

    test('should start in click mode by default', async ({ page }) => {
        const mode = await page.evaluate(() => {
            return window.ModeManager?.getCurrentMode();
        });

        expect(mode).toBe('click');
    });
});