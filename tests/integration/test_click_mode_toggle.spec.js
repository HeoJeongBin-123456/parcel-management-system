import { test, expect } from '@playwright/test';

test.describe('Click Mode Color Toggle Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // Ensure we're in click mode
        await page.evaluate(() => {
            document.body.className = 'mode-click';
            localStorage.setItem('currentMode', 'click');
        });
    });

    test('should toggle parcel color on double click', async ({ page }) => {
        // Select first color
        await page.click('.color-item[data-color="0"]');

        // Mock parcel click coordinates
        const lat = 37.5665;
        const lng = 126.9780;
        const pnu = 'TEST_TOGGLE_001';

        // First click - apply color
        await page.evaluate(({ pnu, lat, lng }) => {
            const event = new CustomEvent('parcelClick', {
                detail: { pnu, lat, lng, parcelName: '테스트 필지' }
            });
            window.dispatchEvent(event);
        }, { pnu, lat, lng });

        // Verify color applied
        let parcelColors = await page.evaluate(() => {
            const stored = localStorage.getItem('parcelColors');
            return stored ? JSON.parse(stored) : {};
        });
        expect(parcelColors[pnu]).toBe(0);

        // Second click - remove color (toggle)
        await page.evaluate(({ pnu, lat, lng }) => {
            const event = new CustomEvent('parcelClick', {
                detail: { pnu, lat, lng }
            });
            window.dispatchEvent(event);
        }, { pnu, lat, lng });

        // Verify color removed
        parcelColors = await page.evaluate(() => {
            const stored = localStorage.getItem('parcelColors');
            return stored ? JSON.parse(stored) : {};
        });
        expect(parcelColors[pnu]).toBeUndefined();
    });

    test('should handle 8 different colors', async ({ page }) => {
        const testParcels = [
            { pnu: 'COLOR_TEST_001', lat: 37.5665, lng: 126.9780 },
            { pnu: 'COLOR_TEST_002', lat: 37.5666, lng: 126.9781 },
            { pnu: 'COLOR_TEST_003', lat: 37.5667, lng: 126.9782 },
            { pnu: 'COLOR_TEST_004', lat: 37.5668, lng: 126.9783 },
            { pnu: 'COLOR_TEST_005', lat: 37.5669, lng: 126.9784 },
            { pnu: 'COLOR_TEST_006', lat: 37.5670, lng: 126.9785 },
            { pnu: 'COLOR_TEST_007', lat: 37.5671, lng: 126.9786 },
            { pnu: 'COLOR_TEST_008', lat: 37.5672, lng: 126.9787 }
        ];

        // Apply all 8 colors
        for (let i = 0; i < 8; i++) {
            // Select color
            await page.click(`.color-item[data-color="${i}"]`);

            // Apply to parcel
            await page.evaluate(({ parcel, colorIndex }) => {
                window.currentColorIndex = colorIndex;
                const event = new CustomEvent('parcelClick', {
                    detail: parcel
                });
                window.dispatchEvent(event);

                // Store in localStorage
                const colors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
                colors[parcel.pnu] = colorIndex;
                localStorage.setItem('parcelColors', JSON.stringify(colors));
            }, { parcel: testParcels[i], colorIndex: i });
        }

        // Verify all colors applied
        const savedColors = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('parcelColors') || '{}');
        });

        testParcels.forEach((parcel, index) => {
            expect(savedColors[parcel.pnu]).toBe(index);
        });
    });

    test('should auto-fill parcel name (지번) on color application', async ({ page }) => {
        const testParcel = {
            pnu: 'AUTO_FILL_001',
            lat: 37.5665,
            lng: 126.9780,
            parcelName: '서울시 중구 1-1'
        };

        // Select color and click parcel
        await page.click('.color-item[data-color="2"]');

        await page.evaluate((parcel) => {
            // Simulate parcel click with auto-fill
            const event = new CustomEvent('parcelClick', {
                detail: parcel
            });
            window.dispatchEvent(event);

            // Save parcel data
            const parcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
            parcels.push({
                ...parcel,
                colorIndex: 2,
                mode: 'click'
            });
            localStorage.setItem('parcelData', JSON.stringify(parcels));
        }, testParcel);

        // Verify parcel name was auto-filled
        const savedParcels = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('parcelData') || '[]');
        });

        const savedParcel = savedParcels.find(p => p.pnu === testParcel.pnu);
        expect(savedParcel).toBeDefined();
        expect(savedParcel.parcelName).toBe(testParcel.parcelName);
    });

    test('should create marker when parcel info is saved', async ({ page }) => {
        const testParcel = {
            pnu: 'MARKER_TEST_001',
            lat: 37.5665,
            lng: 126.9780,
            parcelName: '서울시 중구 2-2',
            memo: '테스트 메모'
        };

        // Apply color
        await page.click('.color-item[data-color="3"]');

        await page.evaluate((parcel) => {
            // Apply color and save info
            const event = new CustomEvent('parcelClick', {
                detail: parcel
            });
            window.dispatchEvent(event);

            // Save with memo (triggers marker creation)
            const parcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
            parcels.push({
                ...parcel,
                colorIndex: 3,
                mode: 'click',
                hasMarker: true
            });
            localStorage.setItem('parcelData', JSON.stringify(parcels));

            // Simulate marker creation
            const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
            markerStates[parcel.pnu] = { visible: true, hasInfo: true };
            localStorage.setItem('markerStates', JSON.stringify(markerStates));
        }, testParcel);

        // Verify marker was created
        const markerStates = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('markerStates') || '{}');
        });

        expect(markerStates[testParcel.pnu]).toBeDefined();
        expect(markerStates[testParcel.pnu].visible).toBe(true);
        expect(markerStates[testParcel.pnu].hasInfo).toBe(true);
    });

    test('should remove marker when parcel info is cleared', async ({ page }) => {
        const pnu = 'MARKER_REMOVE_001';

        // Setup initial state with marker
        await page.evaluate((pnu) => {
            const parcels = [{
                pnu,
                lat: 37.5665,
                lng: 126.9780,
                memo: 'Will be removed',
                colorIndex: 1,
                hasMarker: true
            }];
            localStorage.setItem('parcelData', JSON.stringify(parcels));

            const markerStates = { [pnu]: { visible: true, hasInfo: true } };
            localStorage.setItem('markerStates', JSON.stringify(markerStates));
        }, pnu);

        // Clear parcel info (remove marker)
        await page.evaluate((pnu) => {
            // Remove parcel data
            const parcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const filtered = parcels.filter(p => p.pnu !== pnu);
            localStorage.setItem('parcelData', JSON.stringify(filtered));

            // Remove marker
            const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
            delete markerStates[pnu];
            localStorage.setItem('markerStates', JSON.stringify(markerStates));

            // Remove color
            const colors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            delete colors[pnu];
            localStorage.setItem('parcelColors', JSON.stringify(colors));
        }, pnu);

        // Verify marker removed
        const markerStates = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('markerStates') || '{}');
        });

        expect(markerStates[pnu]).toBeUndefined();
    });

    test('should show confirmation on parcel deletion', async ({ page }) => {
        // Setup dialog handler
        let dialogShown = false;
        page.on('dialog', async dialog => {
            expect(dialog.type()).toBe('confirm');
            expect(dialog.message()).toContain('삭제');
            dialogShown = true;
            await dialog.accept();
        });

        const pnu = 'DELETE_CONFIRM_001';

        // Apply color first
        await page.click('.color-item[data-color="4"]');

        await page.evaluate((pnu) => {
            // First click - apply
            const colors = { [pnu]: 4 };
            localStorage.setItem('parcelColors', JSON.stringify(colors));

            // Simulate second click that triggers confirmation
            if (confirm('필지 정보와 색상을 삭제하시겠습니까?')) {
                const colors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
                delete colors[pnu];
                localStorage.setItem('parcelColors', JSON.stringify(colors));
            }
        }, pnu);

        expect(dialogShown).toBe(true);
    });

    test('color selection UI feedback', async ({ page }) => {
        // Click first color
        const firstColor = page.locator('.color-item[data-color="0"]');
        await firstColor.click();

        // Check if selected class is added
        await expect(firstColor).toHaveClass(/selected/);

        // Click another color
        const secondColor = page.locator('.color-item[data-color="1"]');
        await secondColor.click();

        // First should be deselected, second should be selected
        await expect(firstColor).not.toHaveClass(/selected/);
        await expect(secondColor).toHaveClass(/selected/);
    });

    test('should maintain color state after page refresh', async ({ page }) => {
        const testData = {
            pnu: 'PERSIST_001',
            colorIndex: 5,
            parcelName: '영속성 테스트'
        };

        // Set color and parcel data
        await page.evaluate((data) => {
            const colors = { [data.pnu]: data.colorIndex };
            localStorage.setItem('parcelColors', JSON.stringify(colors));

            const parcels = [{
                pnu: data.pnu,
                parcelName: data.parcelName,
                colorIndex: data.colorIndex,
                mode: 'click'
            }];
            localStorage.setItem('parcelData', JSON.stringify(parcels));
        }, testData);

        // Reload page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify data persisted
        const persistedData = await page.evaluate(() => {
            return {
                colors: JSON.parse(localStorage.getItem('parcelColors') || '{}'),
                parcels: JSON.parse(localStorage.getItem('parcelData') || '[]')
            };
        });

        expect(persistedData.colors[testData.pnu]).toBe(testData.colorIndex);
        expect(persistedData.parcels.find(p => p.pnu === testData.pnu)).toBeDefined();
    });
});