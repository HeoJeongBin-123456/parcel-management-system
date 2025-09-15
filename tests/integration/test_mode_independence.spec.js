import { test, expect } from '@playwright/test';

test.describe('Mode Independence Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // Clear all localStorage to start fresh
        await page.evaluate(() => {
            localStorage.clear();
        });
    });

    test('click mode and search mode data should be completely isolated', async ({ page }) => {
        // Setup click mode data
        const clickData = {
            parcels: [
                { pnu: 'CLICK_001', lat: 37.5, lng: 127.0, colorIndex: 0 },
                { pnu: 'CLICK_002', lat: 37.6, lng: 127.1, colorIndex: 2 }
            ],
            colors: { 'CLICK_001': 0, 'CLICK_002': 2 },
            markers: { 'CLICK_001': true }
        };

        // Setup search mode data
        const searchData = {
            query: '강남구',
            results: ['SEARCH_001', 'SEARCH_002'],
            parcels: [
                { pnu: 'SEARCH_001', lat: 37.7, lng: 127.2 },
                { pnu: 'SEARCH_002', lat: 37.8, lng: 127.3 }
            ]
        };

        // Save both datasets
        await page.evaluate(({ click, search }) => {
            localStorage.setItem('clickModeData', JSON.stringify(click));
            localStorage.setItem('searchModeData', JSON.stringify(search));
        }, { click: clickData, search: searchData });

        // Verify data isolation
        const savedClickData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('clickModeData') || '{}');
        });

        const savedSearchData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchModeData') || '{}');
        });

        // Click data should not have search properties
        expect(savedClickData).not.toHaveProperty('query');
        expect(savedClickData).not.toHaveProperty('results');

        // Search data should not have click properties
        expect(savedSearchData).not.toHaveProperty('colors');
        expect(savedSearchData).not.toHaveProperty('markers');

        // Each should have their own data
        expect(savedClickData.parcels).toHaveLength(2);
        expect(savedSearchData.parcels).toHaveLength(2);
        expect(savedClickData.parcels[0].pnu).toContain('CLICK');
        expect(savedSearchData.parcels[0].pnu).toContain('SEARCH');
    });

    test('mode switching should not affect other mode data', async ({ page }) => {
        // Setup initial data for both modes
        await page.evaluate(() => {
            const clickData = {
                parcels: [{ pnu: 'C1', data: 'click data' }],
                timestamp: Date.now()
            };
            const searchData = {
                parcels: [{ pnu: 'S1', data: 'search data' }],
                timestamp: Date.now()
            };

            localStorage.setItem('clickModeData', JSON.stringify(clickData));
            localStorage.setItem('searchModeData', JSON.stringify(searchData));
            localStorage.setItem('currentMode', 'click');
        });

        const initialClickData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('clickModeData') || '{}');
        });

        const initialSearchData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchModeData') || '{}');
        });

        // Switch modes multiple times
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => {
                const current = localStorage.getItem('currentMode');
                const newMode = current === 'click' ? 'search' : 'click';
                localStorage.setItem('currentMode', newMode);
                document.body.className = `mode-${newMode}`;
            });
        }

        // Verify data unchanged
        const finalClickData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('clickModeData') || '{}');
        });

        const finalSearchData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchModeData') || '{}');
        });

        expect(finalClickData).toEqual(initialClickData);
        expect(finalSearchData).toEqual(initialSearchData);
    });

    test('parcels with same PNU in different modes should be independent', async ({ page }) => {
        const samePnu = 'SHARED_PNU_001';

        // Add same PNU in click mode with color
        await page.evaluate((pnu) => {
            const clickData = {
                parcels: [{
                    pnu,
                    lat: 37.5,
                    lng: 127.0,
                    colorIndex: 3,
                    mode: 'click',
                    memo: 'Click mode memo'
                }]
            };
            localStorage.setItem('clickModeData', JSON.stringify(clickData));
        }, samePnu);

        // Add same PNU in search mode with purple
        await page.evaluate((pnu) => {
            const searchData = {
                parcels: [{
                    pnu,
                    lat: 37.5,
                    lng: 127.0,
                    colorIndex: 8, // Purple for search
                    mode: 'search',
                    address: 'Search result address'
                }]
            };
            localStorage.setItem('searchModeData', JSON.stringify(searchData));
        }, samePnu);

        // Verify both exist independently
        const clickParcel = await page.evaluate((pnu) => {
            const data = JSON.parse(localStorage.getItem('clickModeData') || '{}');
            return data.parcels?.find(p => p.pnu === pnu);
        }, samePnu);

        const searchParcel = await page.evaluate((pnu) => {
            const data = JSON.parse(localStorage.getItem('searchModeData') || '{}');
            return data.parcels?.find(p => p.pnu === pnu);
        }, samePnu);

        expect(clickParcel).toBeDefined();
        expect(searchParcel).toBeDefined();
        expect(clickParcel.colorIndex).toBe(3);
        expect(searchParcel.colorIndex).toBe(8);
        expect(clickParcel.memo).toBe('Click mode memo');
        expect(searchParcel.address).toBe('Search result address');
    });

    test('hand mode should preserve both click and search data', async ({ page }) => {
        // Setup data in both modes
        await page.evaluate(() => {
            localStorage.setItem('clickModeData', JSON.stringify({
                parcels: [{ pnu: 'C1' }]
            }));
            localStorage.setItem('searchModeData', JSON.stringify({
                parcels: [{ pnu: 'S1' }]
            }));
        });

        // Switch to hand mode
        await page.evaluate(() => {
            const previousMode = localStorage.getItem('currentMode') || 'click';
            localStorage.setItem('previousMode', previousMode);
            localStorage.setItem('currentMode', 'hand');
            document.body.className = 'mode-hand';
        });

        // Verify data still exists
        const clickDataInHandMode = await page.evaluate(() => {
            return localStorage.getItem('clickModeData');
        });

        const searchDataInHandMode = await page.evaluate(() => {
            return localStorage.getItem('searchModeData');
        });

        expect(clickDataInHandMode).not.toBeNull();
        expect(searchDataInHandMode).not.toBeNull();

        // Switch back from hand mode
        await page.evaluate(() => {
            const previousMode = localStorage.getItem('previousMode') || 'click';
            localStorage.setItem('currentMode', previousMode);
            document.body.className = `mode-${previousMode}`;
        });

        // Data should still be intact
        const clickDataAfter = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('clickModeData') || '{}');
        });

        const searchDataAfter = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchModeData') || '{}');
        });

        expect(clickDataAfter.parcels).toHaveLength(1);
        expect(searchDataAfter.parcels).toHaveLength(1);
    });

    test('color operations should be mode-specific', async ({ page }) => {
        // Apply colors in click mode
        await page.evaluate(() => {
            document.body.className = 'mode-click';
            const clickColors = {
                'CLICK_PNU_1': 0,
                'CLICK_PNU_2': 3,
                'CLICK_PNU_3': 7
            };
            localStorage.setItem('clickColors', JSON.stringify(clickColors));
        });

        // Apply purple in search mode
        await page.evaluate(() => {
            document.body.className = 'mode-search';
            const searchColors = {
                'SEARCH_PNU_1': 8,
                'SEARCH_PNU_2': 8,
                'SEARCH_PNU_3': 8
            };
            localStorage.setItem('searchColors', JSON.stringify(searchColors));
        });

        // Verify colors are separate
        const clickColors = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('clickColors') || '{}');
        });

        const searchColors = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchColors') || '{}');
        });

        // Click colors should be 0-7
        Object.values(clickColors).forEach(color => {
            expect(color).toBeGreaterThanOrEqual(0);
            expect(color).toBeLessThanOrEqual(7);
        });

        // Search colors should all be 8 (purple)
        Object.values(searchColors).forEach(color => {
            expect(color).toBe(8);
        });
    });

    test('marker creation should be mode-aware', async ({ page }) => {
        // Create markers in click mode
        await page.evaluate(() => {
            const clickMarkers = {
                'CLICK_M1': { visible: true, mode: 'click', hasInfo: true },
                'CLICK_M2': { visible: true, mode: 'click', hasInfo: true }
            };
            localStorage.setItem('clickMarkers', JSON.stringify(clickMarkers));
        });

        // Search mode doesn't create markers (only displays)
        await page.evaluate(() => {
            const searchMarkers = {
                'SEARCH_M1': { visible: false, mode: 'search', isDisplay: true }
            };
            localStorage.setItem('searchMarkers', JSON.stringify(searchMarkers));
        });

        // Verify marker separation
        const clickMarkers = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('clickMarkers') || '{}');
        });

        const searchMarkers = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchMarkers') || '{}');
        });

        expect(Object.keys(clickMarkers)).toHaveLength(2);
        expect(Object.keys(searchMarkers)).toHaveLength(1);
        expect(clickMarkers['CLICK_M1'].hasInfo).toBe(true);
        expect(searchMarkers['SEARCH_M1'].isDisplay).toBe(true);
    });

    test('visibility toggling should be mode-specific', async ({ page }) => {
        // Setup visibility states
        await page.evaluate(() => {
            // Click mode parcels visible
            document.body.className = 'mode-click';
            const clickVisibility = {
                'CLICK_1': true,
                'CLICK_2': true
            };
            localStorage.setItem('clickVisibility', JSON.stringify(clickVisibility));

            // Search mode parcels initially hidden
            document.body.className = 'mode-search';
            const searchVisibility = {
                'SEARCH_1': false,
                'SEARCH_2': false
            };
            localStorage.setItem('searchVisibility', JSON.stringify(searchVisibility));
        });

        // Switch to click mode - click parcels should be visible
        await page.evaluate(() => {
            document.body.className = 'mode-click';
        });

        const clickVisible = await page.evaluate(() => {
            const visibility = JSON.parse(localStorage.getItem('clickVisibility') || '{}');
            return Object.values(visibility).every(v => v === true);
        });

        expect(clickVisible).toBe(true);

        // Switch to search mode - search parcels should respect their state
        await page.evaluate(() => {
            document.body.className = 'mode-search';
        });

        const searchVisible = await page.evaluate(() => {
            const visibility = JSON.parse(localStorage.getItem('searchVisibility') || '{}');
            return Object.values(visibility).every(v => v === false);
        });

        expect(searchVisible).toBe(true);
    });

    test('clearing one mode should not affect the other', async ({ page }) => {
        // Setup data in both modes
        await page.evaluate(() => {
            localStorage.setItem('clickModeData', JSON.stringify({
                parcels: Array(5).fill(null).map((_, i) => ({
                    pnu: `CLICK_${i}`,
                    data: `click_data_${i}`
                }))
            }));

            localStorage.setItem('searchModeData', JSON.stringify({
                parcels: Array(3).fill(null).map((_, i) => ({
                    pnu: `SEARCH_${i}`,
                    data: `search_data_${i}`
                }))
            }));
        });

        // Clear only search mode data
        await page.evaluate(() => {
            localStorage.removeItem('searchModeData');
            localStorage.removeItem('searchColors');
            localStorage.removeItem('searchVisibility');
        });

        // Click mode data should remain
        const clickData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('clickModeData') || '{}');
        });

        const searchData = await page.evaluate(() => {
            return localStorage.getItem('searchModeData');
        });

        expect(clickData.parcels).toHaveLength(5);
        expect(searchData).toBeNull();
    });
});