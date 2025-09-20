import { test, expect } from '@playwright/test';

test.describe('Color Management API Contract Tests', () => {
    let baseUrl = 'http://localhost:3000';

    test.beforeEach(async ({ page, request }) => {
        await request.post(`${baseUrl}/api/colors/reset`);
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    });

    test('GET /api/colors/palette - should return color palette', async ({ request }) => {
        const response = await request.get(`${baseUrl}/api/colors/palette`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('colors');
        expect(Array.isArray(data.colors)).toBe(true);
        expect(data.colors).toHaveLength(8);

        // Validate each color
        data.colors.forEach((color, index) => {
            expect(color).toHaveProperty('index');
            expect(color.index).toBe(index);
            expect(color).toHaveProperty('hex');
            expect(color.hex).toMatch(/^#[0-9A-F]{6}$/i);
            expect(color).toHaveProperty('name');
            expect(color).toHaveProperty('usageCount');
            expect(typeof color.usageCount).toBe('number');
        });

        expect(data).toHaveProperty('currentSelection');
    });

    test('POST /api/parcel/color - should apply color to parcel', async ({ request }) => {
        const testParcel = {
            pnu: 'TEST_PNU_123',
            colorIndex: 2,
            parcelData: {
                lat: 37.5665,
                lng: 126.9780,
                parcelName: '서울특별시 중구 1-1'
            }
        };

        const response = await request.post(`${baseUrl}/api/parcel/color`, {
            data: testParcel
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('pnu');
        expect(data.pnu).toBe(testParcel.pnu);
        expect(data).toHaveProperty('colorIndex');
        expect(data.colorIndex).toBe(testParcel.colorIndex);
        expect(data).toHaveProperty('wasToggled');
        expect(typeof data.wasToggled).toBe('boolean');
    });

    test('POST /api/parcel/color - should toggle color on same parcel', async ({ request }) => {
        const testParcel = {
            pnu: 'TEST_PNU_456',
            colorIndex: 0,
            parcelData: {
                lat: 37.5665,
                lng: 126.9780,
                parcelName: '서울특별시 중구 2-2'
            }
        };

        // First application
        await request.post(`${baseUrl}/api/parcel/color`, {
            data: testParcel
        });

        // Second application (toggle)
        const response = await request.post(`${baseUrl}/api/parcel/color`, {
            data: testParcel
        });

        const data = await response.json();
        expect(data.wasToggled).toBe(true);
    });

    test('POST /api/parcel/color - should reject invalid color index', async ({ request }) => {
        const invalidParcel = {
            pnu: 'TEST_PNU_789',
            colorIndex: 10, // Invalid: should be 0-7
            parcelData: {
                lat: 37.5665,
                lng: 126.9780
            }
        };

        const response = await request.post(`${baseUrl}/api/parcel/color`, {
            data: invalidParcel
        });

        expect(response.status()).toBe(400);
    });

    test('DELETE /api/parcel/color/{pnu} - should remove color from parcel', async ({ request }) => {
        const pnu = 'TEST_PNU_DELETE';

        // First apply color
        await request.post(`${baseUrl}/api/parcel/color`, {
            data: {
                pnu: pnu,
                colorIndex: 3,
                parcelData: { lat: 37.5, lng: 127.0 }
            }
        });

        // Then remove it
        const response = await request.delete(`${baseUrl}/api/parcel/color/${pnu}`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('pnu');
        expect(data.pnu).toBe(pnu);
        expect(data).toHaveProperty('previousColorIndex');
        expect(data).toHaveProperty('markerRemoved');
    });

    test('GET /api/parcels/colored - should return all colored parcels', async ({ request }) => {
        const response = await request.get(`${baseUrl}/api/parcels/colored`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('parcels');
        expect(Array.isArray(data.parcels)).toBe(true);
        expect(data).toHaveProperty('total');
        expect(typeof data.total).toBe('number');
    });

    test('GET /api/parcels/colored - should filter by mode', async ({ request }) => {
        const response = await request.get(`${baseUrl}/api/parcels/colored?mode=click`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        data.parcels.forEach(parcel => {
            expect(parcel.mode).toBe('click');
        });
    });

    test('GET /api/parcels/colored - should filter by color index', async ({ request }) => {
        const targetColorIndex = 2;
        const response = await request.get(`${baseUrl}/api/parcels/colored?colorIndex=${targetColorIndex}`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        data.parcels.forEach(parcel => {
            expect(parcel.colorIndex).toBe(targetColorIndex);
        });
    });

    test('Color palette UI interaction', async ({ page }) => {
        // Check if color palette exists
        const palette = await page.locator('.color-palette');
        await expect(palette).toBeVisible();

        // Check if all 8 colors are present
        const colorItems = await page.locator('.color-item').all();
        expect(colorItems).toHaveLength(8);

        // Test color selection
        const firstColor = colorItems[0];
        await firstColor.click();
        await expect(firstColor).toHaveClass(/selected/);

        // Test color deselection
        await firstColor.click();
        await expect(firstColor).not.toHaveClass(/selected/);
    });

    test('Color persistence in localStorage', async ({ page }) => {
        const testColorEntries = [
            ['PNU001', 0],
            ['PNU002', 3],
            ['PNU003', 7]
        ];

        // Save colors to localStorage
        await page.evaluate((entries) => {
            if (window.ParcelColorStorage && typeof window.ParcelColorStorage.setAll === 'function') {
                window.ParcelColorStorage.setAll(new Map(entries));
            } else {
                localStorage.setItem('parcelColors', JSON.stringify(entries));
            }
        }, testColorEntries);

        // Reload and verify
        await page.reload();

        await page.waitForFunction(() => {
            if (window.ParcelColorStorage && typeof window.ParcelColorStorage.getAll === 'function') {
                return window.ParcelColorStorage.getAll().size >= 3;
            }

            const stored = localStorage.getItem('parcelColors');
            if (!stored) {
                return false;
            }
            try {
                const parsed = JSON.parse(stored);
                return Array.isArray(parsed) && parsed.length >= 3;
            } catch (error) {
                return false;
            }
        });

        const savedColorEntries = await page.evaluate(() => {
            if (window.ParcelColorStorage && typeof window.ParcelColorStorage.getAll === 'function') {
                return Array.from(window.ParcelColorStorage.getAll().entries());
            }

            const stored = localStorage.getItem('parcelColors');
            return stored ? JSON.parse(stored) : [];
        });

        const savedColors = new Map(savedColorEntries);
        expect(savedColors.get('PNU001')).toBe(0);
        expect(savedColors.get('PNU002')).toBe(3);
        expect(savedColors.get('PNU003')).toBe(7);
    });
});
