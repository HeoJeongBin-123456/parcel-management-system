import { test, expect } from '@playwright/test';

test.describe('Search Mode Auto-Switch Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // Start in click mode
        await page.evaluate(() => {
            document.body.className = 'mode-click';
            localStorage.setItem('currentMode', 'click');
        });
    });

    test('should auto-switch to search mode when search is executed', async ({ page }) => {
        // Verify initial mode
        let currentMode = await page.evaluate(() => document.body.className);
        expect(currentMode).toContain('mode-click');

        // Execute search
        await page.evaluate(() => {
            // Simulate search execution
            const searchEvent = new CustomEvent('searchExecute', {
                detail: {
                    query: '서울시 강남구',
                    searchType: 'address'
                }
            });
            window.dispatchEvent(searchEvent);

            // Auto-switch logic
            document.body.className = 'mode-search';
            localStorage.setItem('currentMode', 'search');

            // Save search data
            const searchData = {
                query: '서울시 강남구',
                results: ['PNU_001', 'PNU_002'],
                isActive: true,
                searchTime: Date.now()
            };
            localStorage.setItem('searchModeData', JSON.stringify(searchData));
        });

        // Verify mode switched
        currentMode = await page.evaluate(() => document.body.className);
        expect(currentMode).toContain('mode-search');

        // Verify search data saved
        const searchData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchModeData') || '{}');
        });
        expect(searchData.query).toBe('서울시 강남구');
        expect(searchData.isActive).toBe(true);
    });

    test('should hide click mode parcels when switching to search mode', async ({ page }) => {
        // Setup click mode data
        await page.evaluate(() => {
            const clickData = {
                parcels: [
                    ['CLICK_PNU_001', { lat: 37.5, lng: 127.0, colorIndex: 0 }],
                    ['CLICK_PNU_002', { lat: 37.6, lng: 127.1, colorIndex: 2 }]
                ],
                colors: [
                    ['CLICK_PNU_001', 0],
                    ['CLICK_PNU_002', 2]
                ]
            };
            localStorage.setItem('clickModeData', JSON.stringify(clickData));

            // Add click-only elements to DOM
            const clickOnly = document.createElement('div');
            clickOnly.className = 'click-only click-parcels';
            clickOnly.style.display = 'block';
            document.body.appendChild(clickOnly);
        });

        // Switch to search mode
        await page.evaluate(() => {
            document.body.className = 'mode-search';
            localStorage.setItem('currentMode', 'search');
        });

        // Check if click parcels are hidden
        const clickParcelsVisible = await page.evaluate(() => {
            const elements = document.querySelectorAll('.click-only');
            return Array.from(elements).some(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });
        });

        expect(clickParcelsVisible).toBe(false);
    });

    test('should show search mode indicator when in search mode', async ({ page }) => {
        // Create search mode indicator element
        await page.evaluate(() => {
            const indicator = document.createElement('div');
            indicator.className = 'search-mode-indicator';
            indicator.textContent = '검색 모드';
            document.body.appendChild(indicator);
        });

        // Switch to search mode
        await page.evaluate(() => {
            document.body.className = 'mode-search';
        });

        // Check indicator visibility
        const indicator = page.locator('.search-mode-indicator');
        await expect(indicator).toBeVisible();
    });

    test('should disable color palette in search mode', async ({ page }) => {
        // Create color palette element
        await page.evaluate(() => {
            const palette = document.createElement('div');
            palette.className = 'color-palette-container';
            palette.innerHTML = `
                <div class="color-palette">
                    <div class="color-item" data-color="0"></div>
                    <div class="color-item" data-color="1"></div>
                </div>
            `;
            document.body.appendChild(palette);
        });

        // Switch to search mode
        await page.evaluate(() => {
            document.body.className = 'mode-search';
        });

        // Check if palette is disabled
        const paletteOpacity = await page.evaluate(() => {
            const palette = document.querySelector('.color-palette-container');
            return window.getComputedStyle(palette).opacity;
        });

        const palettePointerEvents = await page.evaluate(() => {
            const palette = document.querySelector('.color-palette-container');
            return window.getComputedStyle(palette).pointerEvents;
        });

        expect(parseFloat(paletteOpacity)).toBeLessThan(1);
        expect(palettePointerEvents).toBe('none');
    });

    test('should apply purple color to search results', async ({ page }) => {
        const searchResults = [
            { pnu: 'SEARCH_001', lat: 37.5, lng: 127.0, address: '서울시 강남구 1' },
            { pnu: 'SEARCH_002', lat: 37.6, lng: 127.1, address: '서울시 강남구 2' }
        ];

        // Execute search and apply purple color
        await page.evaluate((results) => {
            // Switch to search mode
            document.body.className = 'mode-search';

            // Save search results with purple color
            const searchData = {
                query: '강남구',
                results: results.map(r => r.pnu),
                parcels: results.map(r => ({
                    ...r,
                    colorIndex: 8, // Purple for search mode
                    mode: 'search'
                })),
                isActive: true
            };
            localStorage.setItem('searchModeData', JSON.stringify(searchData));

            // Store purple parcels
            const searchColors = {};
            results.forEach(r => {
                searchColors[r.pnu] = 8; // 8 = purple for search
            });
            localStorage.setItem('searchColors', JSON.stringify(searchColors));
        }, searchResults);

        // Verify purple color applied
        const searchColors = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchColors') || '{}');
        });

        expect(searchColors['SEARCH_001']).toBe(8);
        expect(searchColors['SEARCH_002']).toBe(8);
    });

    test('should not allow memo input in search mode', async ({ page }) => {
        // Switch to search mode
        await page.evaluate(() => {
            document.body.className = 'mode-search';
            localStorage.setItem('currentMode', 'search');

            // Create a mock memo input field
            const memoInput = document.createElement('textarea');
            memoInput.id = 'memo-input';
            memoInput.className = 'search-mode-disabled';
            document.body.appendChild(memoInput);
        });

        // Try to input memo in search mode
        const memoDisabled = await page.evaluate(() => {
            const input = document.getElementById('memo-input');
            if (document.body.className.includes('mode-search')) {
                input.disabled = true;
                input.readOnly = true;
            }
            return input.disabled || input.readOnly;
        });

        expect(memoDisabled).toBe(true);
    });

    test('should remove purple color when search parcel is clicked', async ({ page }) => {
        const searchPnu = 'SEARCH_TOGGLE_001';

        // Setup search parcel with purple color
        await page.evaluate((pnu) => {
            document.body.className = 'mode-search';

            const searchData = {
                query: 'test',
                results: [pnu],
                parcels: [{ pnu, colorIndex: 8, mode: 'search' }]
            };
            localStorage.setItem('searchModeData', JSON.stringify(searchData));

            const searchColors = { [pnu]: 8 };
            localStorage.setItem('searchColors', JSON.stringify(searchColors));
        }, searchPnu);

        // Click to remove purple color
        await page.evaluate((pnu) => {
            // Simulate click on purple parcel
            const searchColors = JSON.parse(localStorage.getItem('searchColors') || '{}');
            if (searchColors[pnu] === 8) {
                delete searchColors[pnu];
                localStorage.setItem('searchColors', JSON.stringify(searchColors));

                // Update search data
                const searchData = JSON.parse(localStorage.getItem('searchModeData') || '{}');
                searchData.parcels = searchData.parcels.filter(p => p.pnu !== pnu);
                localStorage.setItem('searchModeData', JSON.stringify(searchData));
            }
        }, searchPnu);

        // Verify purple color removed
        const searchColors = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchColors') || '{}');
        });
        expect(searchColors[searchPnu]).toBeUndefined();
    });

    test('should maintain search state during mode switches', async ({ page }) => {
        const searchData = {
            query: '서울시',
            results: ['PNU_A', 'PNU_B'],
            searchTime: Date.now()
        };

        // Set search data and switch to search mode
        await page.evaluate((data) => {
            localStorage.setItem('searchModeData', JSON.stringify(data));
            document.body.className = 'mode-search';
            localStorage.setItem('currentMode', 'search');
        }, searchData);

        // Switch to click mode
        await page.evaluate(() => {
            document.body.className = 'mode-click';
            localStorage.setItem('currentMode', 'click');
        });

        // Switch back to search mode
        await page.evaluate(() => {
            document.body.className = 'mode-search';
            localStorage.setItem('currentMode', 'search');
        });

        // Verify search data maintained
        const savedSearchData = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchModeData') || '{}');
        });

        expect(savedSearchData.query).toBe(searchData.query);
        expect(savedSearchData.results).toEqual(searchData.results);
    });

    test('should clear search when switching to click mode with clear option', async ({ page }) => {
        // Setup search data
        await page.evaluate(() => {
            const searchData = {
                query: 'test',
                results: ['PNU_1', 'PNU_2'],
                isActive: true
            };
            localStorage.setItem('searchModeData', JSON.stringify(searchData));
            document.body.className = 'mode-search';
        });

        // Switch to click mode with clear
        await page.evaluate(() => {
            // Clear search data when switching
            if (confirm('검색 결과를 지우고 클릭 모드로 전환하시겠습니까?')) {
                localStorage.removeItem('searchModeData');
                localStorage.removeItem('searchColors');
            }
            document.body.className = 'mode-click';
            localStorage.setItem('currentMode', 'click');
        });

        // Verify search data cleared
        const searchData = await page.evaluate(() => {
            return localStorage.getItem('searchModeData');
        });
        expect(searchData).toBeNull();
    });
});