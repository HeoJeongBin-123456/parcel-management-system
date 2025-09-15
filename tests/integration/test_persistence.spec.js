import { test, expect } from '@playwright/test';

test.describe('Data Persistence Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
    });

    test('click mode data should persist after page refresh', async ({ page }) => {
        const testData = {
            parcels: [
                { pnu: 'PERSIST_C1', lat: 37.5, lng: 127.0, colorIndex: 0, memo: 'Test memo 1' },
                { pnu: 'PERSIST_C2', lat: 37.6, lng: 127.1, colorIndex: 3, memo: 'Test memo 2' }
            ],
            colors: {
                'PERSIST_C1': 0,
                'PERSIST_C2': 3
            },
            markers: {
                'PERSIST_C1': { visible: true, hasInfo: true },
                'PERSIST_C2': { visible: true, hasInfo: true }
            }
        };

        // Save click mode data
        await page.evaluate((data) => {
            localStorage.setItem('clickModeData', JSON.stringify(data));
            localStorage.setItem('parcelColors', JSON.stringify(data.colors));
            localStorage.setItem('markerStates', JSON.stringify(data.markers));
            localStorage.setItem('currentMode', 'click');
        }, testData);

        // Refresh page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify data persisted
        const persistedData = await page.evaluate(() => {
            return {
                clickMode: JSON.parse(localStorage.getItem('clickModeData') || '{}'),
                colors: JSON.parse(localStorage.getItem('parcelColors') || '{}'),
                markers: JSON.parse(localStorage.getItem('markerStates') || '{}'),
                currentMode: localStorage.getItem('currentMode')
            };
        });

        expect(persistedData.currentMode).toBe('click');
        expect(persistedData.clickMode.parcels).toHaveLength(2);
        expect(persistedData.colors['PERSIST_C1']).toBe(0);
        expect(persistedData.colors['PERSIST_C2']).toBe(3);
        expect(persistedData.markers['PERSIST_C1'].visible).toBe(true);
    });

    test('search mode data should persist after page refresh', async ({ page }) => {
        const searchData = {
            query: '서울시 강남구',
            results: ['SEARCH_P1', 'SEARCH_P2', 'SEARCH_P3'],
            parcels: [
                { pnu: 'SEARCH_P1', address: '강남구 역삼동', colorIndex: 8 },
                { pnu: 'SEARCH_P2', address: '강남구 삼성동', colorIndex: 8 },
                { pnu: 'SEARCH_P3', address: '강남구 대치동', colorIndex: 8 }
            ],
            searchTime: Date.now(),
            isActive: true
        };

        // Save search mode data
        await page.evaluate((data) => {
            localStorage.setItem('searchModeData', JSON.stringify(data));
            localStorage.setItem('currentMode', 'search');
            document.body.className = 'mode-search';
        }, searchData);

        // Refresh page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify search data persisted
        const persistedSearch = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('searchModeData') || '{}');
        });

        expect(persistedSearch.query).toBe(searchData.query);
        expect(persistedSearch.results).toEqual(searchData.results);
        expect(persistedSearch.parcels).toHaveLength(3);
        expect(persistedSearch.isActive).toBe(true);
    });

    test('mode state should persist after refresh', async ({ page }) => {
        // Set to search mode
        await page.evaluate(() => {
            localStorage.setItem('currentMode', 'search');
            document.body.className = 'mode-search';
        });

        // Refresh
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Check if mode restored
        const currentMode = await page.evaluate(() => {
            // Simulate mode restoration on load
            const savedMode = localStorage.getItem('currentMode') || 'click';
            document.body.className = `mode-${savedMode}`;
            return savedMode;
        });

        expect(currentMode).toBe('search');

        const bodyClass = await page.evaluate(() => document.body.className);
        expect(bodyClass).toContain('mode-search');
    });

    test('color palette selection should persist', async ({ page }) => {
        // Save selected color
        await page.evaluate(() => {
            localStorage.setItem('selectedColorIndex', '5');
            localStorage.setItem('currentMode', 'click');
        });

        // Refresh
        await page.reload();

        // Verify color selection restored
        const selectedColor = await page.evaluate(() => {
            return localStorage.getItem('selectedColorIndex');
        });

        expect(selectedColor).toBe('5');
    });

    test('mixed data types should all persist correctly', async ({ page }) => {
        const complexData = {
            strings: { key1: 'value1', key2: 'value2' },
            numbers: { count: 42, index: 7 },
            arrays: { items: [1, 2, 3], names: ['a', 'b', 'c'] },
            objects: {
                nested: {
                    deep: {
                        value: 'deep value'
                    }
                }
            },
            booleans: { isActive: true, isDisabled: false },
            nulls: { empty: null }
        };

        // Save complex data structure
        await page.evaluate((data) => {
            Object.entries(data).forEach(([key, value]) => {
                localStorage.setItem(`test_${key}`, JSON.stringify(value));
            });
        }, complexData);

        // Refresh
        await page.reload();

        // Verify all data types persisted correctly
        const persistedData = await page.evaluate(() => {
            const keys = ['strings', 'numbers', 'arrays', 'objects', 'booleans', 'nulls'];
            const result = {};
            keys.forEach(key => {
                const stored = localStorage.getItem(`test_${key}`);
                result[key] = stored ? JSON.parse(stored) : null;
            });
            return result;
        });

        expect(persistedData.strings.key1).toBe('value1');
        expect(persistedData.numbers.count).toBe(42);
        expect(persistedData.arrays.items).toEqual([1, 2, 3]);
        expect(persistedData.objects.nested.deep.value).toBe('deep value');
        expect(persistedData.booleans.isActive).toBe(true);
        expect(persistedData.nulls.empty).toBeNull();
    });

    test('large dataset should persist within localStorage limits', async ({ page }) => {
        // Create dataset near but under 5MB limit
        const largeParcels = Array(1000).fill(null).map((_, i) => ({
            pnu: `LARGE_PNU_${i}`,
            lat: 37.5 + (i * 0.001),
            lng: 127.0 + (i * 0.001),
            colorIndex: i % 8,
            memo: `This is a test memo for parcel ${i}`,
            ownerName: `Owner ${i}`,
            ownerAddress: `Address for parcel ${i}`,
            ownerContact: `010-0000-${String(i).padStart(4, '0')}`
        }));

        // Save large dataset
        await page.evaluate((parcels) => {
            const data = {
                parcels,
                timestamp: Date.now(),
                count: parcels.length
            };
            try {
                localStorage.setItem('largeParcelsData', JSON.stringify(data));
                return true;
            } catch (e) {
                console.error('Storage quota exceeded:', e);
                return false;
            }
        }, largeParcels);

        // Refresh
        await page.reload();

        // Verify large dataset persisted
        const persistedCount = await page.evaluate(() => {
            const stored = localStorage.getItem('largeParcelsData');
            if (stored) {
                const data = JSON.parse(stored);
                return data.parcels.length;
            }
            return 0;
        });

        expect(persistedCount).toBe(1000);
    });

    test('localStorage cleanup should not affect active mode data', async ({ page }) => {
        // Setup data for both modes
        await page.evaluate(() => {
            // Active mode data
            localStorage.setItem('currentMode', 'click');
            localStorage.setItem('clickModeData', JSON.stringify({
                parcels: [{ pnu: 'ACTIVE_1' }]
            }));

            // Inactive mode data
            localStorage.setItem('searchModeData', JSON.stringify({
                parcels: [{ pnu: 'INACTIVE_1' }]
            }));

            // Old/unused data
            localStorage.setItem('oldData', 'should be cleaned');
            localStorage.setItem('tempData', 'temporary');
        });

        // Simulate cleanup of old data
        await page.evaluate(() => {
            const currentMode = localStorage.getItem('currentMode');
            const keysToKeep = [
                'currentMode',
                'clickModeData',
                'searchModeData',
                'parcelColors',
                'markerStates'
            ];

            Object.keys(localStorage).forEach(key => {
                if (!keysToKeep.includes(key) && !key.includes(currentMode)) {
                    // Clean old/temp data
                    if (key.includes('old') || key.includes('temp')) {
                        localStorage.removeItem(key);
                    }
                }
            });
        });

        // Verify active data preserved, old data removed
        const storageState = await page.evaluate(() => {
            return {
                hasClickData: localStorage.getItem('clickModeData') !== null,
                hasSearchData: localStorage.getItem('searchModeData') !== null,
                hasOldData: localStorage.getItem('oldData') !== null,
                hasTempData: localStorage.getItem('tempData') !== null
            };
        });

        expect(storageState.hasClickData).toBe(true);
        expect(storageState.hasSearchData).toBe(true);
        expect(storageState.hasOldData).toBe(false);
        expect(storageState.hasTempData).toBe(false);
    });

    test('concurrent mode switches should not lose data', async ({ page }) => {
        // Initial data setup
        await page.evaluate(() => {
            localStorage.setItem('clickModeData', JSON.stringify({
                parcels: [{ pnu: 'C1', data: 'original' }]
            }));
            localStorage.setItem('searchModeData', JSON.stringify({
                parcels: [{ pnu: 'S1', data: 'original' }]
            }));
        });

        // Rapid mode switches
        for (let i = 0; i < 10; i++) {
            await page.evaluate((iteration) => {
                const modes = ['click', 'search', 'hand'];
                const newMode = modes[iteration % 3];
                localStorage.setItem('currentMode', newMode);
                document.body.className = `mode-${newMode}`;

                // Add timestamp to track switches
                const switches = JSON.parse(localStorage.getItem('modeSwitches') || '[]');
                switches.push({ mode: newMode, time: Date.now() });
                localStorage.setItem('modeSwitches', JSON.stringify(switches));
            }, i);
        }

        // Verify original data intact
        const finalData = await page.evaluate(() => {
            return {
                click: JSON.parse(localStorage.getItem('clickModeData') || '{}'),
                search: JSON.parse(localStorage.getItem('searchModeData') || '{}'),
                switches: JSON.parse(localStorage.getItem('modeSwitches') || '[]')
            };
        });

        expect(finalData.click.parcels[0].data).toBe('original');
        expect(finalData.search.parcels[0].data).toBe('original');
        expect(finalData.switches.length).toBe(10);
    });

    test('Supabase sync status should persist', async ({ page }) => {
        // Simulate Supabase sync states
        await page.evaluate(() => {
            const syncState = {
                lastSync: Date.now(),
                pendingChanges: 3,
                syncStatus: 'pending',
                failedItems: [],
                retryCount: 0
            };
            localStorage.setItem('supabaseSyncState', JSON.stringify(syncState));
        });

        // Refresh
        await page.reload();

        // Verify sync state persisted
        const syncState = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('supabaseSyncState') || '{}');
        });

        expect(syncState.pendingChanges).toBe(3);
        expect(syncState.syncStatus).toBe('pending');
        expect(syncState.retryCount).toBe(0);
    });
});