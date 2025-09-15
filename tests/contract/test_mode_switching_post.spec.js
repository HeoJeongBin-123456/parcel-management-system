const { test, expect } = require('@playwright/test');

test.describe('Mode Management API - POST /api/mode/switch', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
    });

    test('should switch to search mode', async ({ page }) => {
        const result = await page.evaluate(async () => {
            if (!window.ModeManager) {
                throw new Error('ModeManager not loaded');
            }

            const previousMode = window.ModeManager.getCurrentMode();
            await window.ModeManager.switchMode('search');
            const currentMode = window.ModeManager.getCurrentMode();

            return {
                previousMode,
                currentMode,
                switchTime: Date.now()
            };
        });

        expect(result.previousMode).toBe('click');
        expect(result.currentMode).toBe('search');
        expect(result.switchTime).toBeDefined();
    });

    test('should switch to hand mode', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const previousMode = window.ModeManager.getCurrentMode();
            await window.ModeManager.switchMode('hand');
            const currentMode = window.ModeManager.getCurrentMode();

            return {
                previousMode,
                currentMode,
                switchTime: Date.now()
            };
        });

        expect(result.currentMode).toBe('hand');
        expect(result.switchTime).toBeDefined();
    });

    test('should reject invalid mode', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const success = await window.ModeManager.switchMode('invalid');
            return success;
        });

        expect(result).toBe(false);
    });

    test('should save current state when switching', async ({ page }) => {
        await page.evaluate(async () => {
            // 클릭 모드에서 데이터 추가
            window.ModeManager.getModeData('click').parcels.set('test123', { pnu: 'test123' });

            // 검색 모드로 전환
            await window.ModeManager.switchMode('search', true);
        });

        // LocalStorage에 저장되었는지 확인
        const savedData = await page.evaluate(() => {
            return localStorage.getItem('clickModeData');
        });

        expect(savedData).toBeTruthy();
        const parsed = JSON.parse(savedData);
        expect(parsed.parcels).toBeDefined();
    });
});