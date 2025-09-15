const { test, expect } = require('@playwright/test');

test.describe('Color Management API - GET /api/colors/palette', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
    });

    test('should return color palette with 8 colors', async ({ page }) => {
        const palette = await page.evaluate(() => {
            if (!window.ColorPaletteManager) {
                throw new Error('ColorPaletteManager not loaded');
            }

            return {
                colors: window.ColorPaletteManager.colors,
                currentSelection: window.ColorPaletteManager.currentSelection
            };
        });

        expect(palette.colors).toHaveLength(8);
        expect(palette.currentSelection).toBeNull(); // 초기에는 선택 없음

        // 각 색상 검증
        palette.colors.forEach((color, index) => {
            expect(color).toHaveProperty('index', index);
            expect(color).toHaveProperty('hex');
            expect(color).toHaveProperty('name');
            expect(color).toHaveProperty('usageCount');
            expect(color.hex).toMatch(/^#[0-9A-F]{6}$/i);
        });
    });

    test('should track color usage count', async ({ page }) => {
        await page.evaluate(() => {
            window.ColorPaletteManager.applyColorToParcel('test_pnu', 0);
        });

        const palette = await page.evaluate(() => {
            return window.ColorPaletteManager.colors;
        });

        expect(palette[0].usageCount).toBe(1);
    });
});