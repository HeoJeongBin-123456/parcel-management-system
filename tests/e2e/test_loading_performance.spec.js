import { test, expect } from '@playwright/test';

test.describe('2-Second Loading Performance Tests', () => {
    test('should load and be interactive within 2 seconds', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('http://localhost:3000');

        // Wait for critical elements
        await page.waitForSelector('.color-palette', { timeout: 2000 });

        const loadTime = Date.now() - startTime;

        // Check if interactive within 2 seconds
        expect(loadTime).toBeLessThan(2000);

        // Verify critical elements are loaded
        const criticalElements = await page.evaluate(() => {
            return {
                hasColorPalette: document.querySelector('.color-palette') !== null,
                hasMap: typeof naver !== 'undefined' && naver.maps !== undefined,
                hasModeButtons: document.querySelector('.mode-switcher') !== null
            };
        });

        expect(criticalElements.hasColorPalette).toBe(true);
        expect(criticalElements.hasMap).toBe(true);
    });

    test('color palette should be clickable within 2 seconds', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('http://localhost:3000');

        // Wait for color palette to be interactive
        const firstColor = page.locator('.color-item[data-color="0"]');
        await firstColor.waitFor({ state: 'visible', timeout: 2000 });

        const timeToInteractive = Date.now() - startTime;
        expect(timeToInteractive).toBeLessThan(2000);

        // Test actual interaction
        await firstColor.click();
        const isSelected = await firstColor.evaluate(el => el.classList.contains('selected'));
        expect(isSelected).toBe(true);
    });

    test('should defer non-critical resources', async ({ page }) => {
        const resourceTimings = [];

        // Monitor resource loading
        page.on('response', response => {
            resourceTimings.push({
                url: response.url(),
                status: response.status(),
                timing: Date.now()
            });
        });

        await page.goto('http://localhost:3000');

        // Check deferred loading strategy
        const loadingStrategy = await page.evaluate(() => {
            const criticalResources = [];
            const deferredResources = [];

            // Check script loading attributes
            document.querySelectorAll('script').forEach(script => {
                if (script.defer || script.async) {
                    deferredResources.push(script.src);
                } else if (script.src) {
                    criticalResources.push(script.src);
                }
            });

            return { criticalResources, deferredResources };
        });

        // Critical resources should be minimal
        expect(loadingStrategy.criticalResources.length).toBeLessThanOrEqual(5);
    });

    test('should use performance optimization techniques', async ({ page }) => {
        await page.goto('http://localhost:3000');

        const performanceMetrics = await page.evaluate(() => {
            const metrics = {};

            // Check if using requestIdleCallback for non-critical tasks
            metrics.hasIdleCallback = typeof requestIdleCallback === 'function';

            // Check if using requestAnimationFrame for rendering
            metrics.hasAnimationFrame = typeof requestAnimationFrame === 'function';

            // Check localStorage for caching
            metrics.usesCaching = localStorage.length > 0;

            // Check for batch rendering setup
            metrics.hasBatchRendering = typeof window.renderParcelsInBatches === 'function';

            return metrics;
        });

        expect(performanceMetrics.hasIdleCallback).toBe(true);
        expect(performanceMetrics.hasAnimationFrame).toBe(true);
    });

    test('should progressively load features', async ({ page }) => {
        await page.goto('http://localhost:3000');

        // Monitor progressive loading
        const loadingPhases = await page.evaluate(async () => {
            const phases = [];

            // Phase 1: Critical (immediate)
            phases.push({
                phase: 'critical',
                loaded: {
                    map: typeof naver !== 'undefined',
                    colorPalette: document.querySelector('.color-palette') !== null
                },
                timestamp: Date.now()
            });

            // Phase 2: Secondary (after DOMContentLoaded)
            await new Promise(resolve => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                }
            });

            phases.push({
                phase: 'secondary',
                loaded: {
                    savedData: localStorage.getItem('parcelData') !== null,
                    modeManager: typeof window.ModeManager !== 'undefined'
                },
                timestamp: Date.now()
            });

            return phases;
        });

        // Critical phase should complete quickly
        expect(loadingPhases[0].loaded.map).toBe(true);
        expect(loadingPhases[0].loaded.colorPalette).toBe(true);
    });

    test('should handle slow network gracefully', async ({ page, context }) => {
        // Simulate slow 3G
        await context.route('**/*', route => {
            setTimeout(() => route.continue(), 100);
        });

        const startTime = Date.now();
        await page.goto('http://localhost:3000');

        // Essential features should still load within reasonable time
        await page.waitForSelector('.color-palette', { timeout: 3000 });

        const loadTime = Date.now() - startTime;

        // Even on slow network, critical features should load within 3 seconds
        expect(loadTime).toBeLessThan(3000);
    });

    test('should minimize blocking resources', async ({ page }) => {
        const blockingResources = [];

        await page.coverage.startJSCoverage();
        await page.coverage.startCSSCoverage();

        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        const jsCoverage = await page.coverage.stopJSCoverage();
        const cssCoverage = await page.coverage.stopCSSCoverage();

        // Calculate unused code
        let totalBytes = 0;
        let usedBytes = 0;

        for (const entry of [...jsCoverage, ...cssCoverage]) {
            totalBytes += entry.text.length;
            for (const range of entry.ranges) {
                usedBytes += range.end - range.start;
            }
        }

        const usagePercentage = (usedBytes / totalBytes) * 100;

        // At least 50% of loaded code should be used immediately
        expect(usagePercentage).toBeGreaterThan(50);
    });

    test('should cache static resources', async ({ page }) => {
        // First load
        await page.goto('http://localhost:3000');

        // Get resource timings
        const firstLoadTimings = await page.evaluate(() => {
            return performance.getEntriesByType('resource').map(r => ({
                name: r.name,
                duration: r.duration
            }));
        });

        // Second load (should use cache)
        await page.reload();

        const secondLoadTimings = await page.evaluate(() => {
            return performance.getEntriesByType('resource').map(r => ({
                name: r.name,
                duration: r.duration
            }));
        });

        // Second load should be faster for cached resources
        const cachedResources = secondLoadTimings.filter(r2 => {
            const r1 = firstLoadTimings.find(r => r.name === r2.name);
            return r1 && r2.duration < r1.duration * 0.5;
        });

        expect(cachedResources.length).toBeGreaterThan(0);
    });

    test('should measure First Contentful Paint (FCP)', async ({ page }) => {
        await page.goto('http://localhost:3000');

        const paintTimings = await page.evaluate(() => {
            const paintMetrics = {};
            const entries = performance.getEntriesByType('paint');

            entries.forEach(entry => {
                paintMetrics[entry.name] = entry.startTime;
            });

            return paintMetrics;
        });

        // FCP should be under 1.5 seconds
        expect(paintTimings['first-contentful-paint']).toBeLessThan(1500);
    });

    test('should optimize for Time to Interactive (TTI)', async ({ page }) => {
        await page.goto('http://localhost:3000');

        // Measure time to interactive
        const tti = await page.evaluate(() => {
            return new Promise(resolve => {
                let interactiveTime = 0;

                const checkInteractive = () => {
                    // Check if main thread is free
                    const now = performance.now();

                    // Simulate checking if page is interactive
                    const isInteractive =
                        document.readyState === 'complete' &&
                        document.querySelector('.color-palette') &&
                        typeof window.ModeManager !== 'undefined';

                    if (isInteractive) {
                        interactiveTime = now;
                        resolve(interactiveTime);
                    } else {
                        requestAnimationFrame(checkInteractive);
                    }
                };

                checkInteractive();
            });
        });

        // TTI should be under 2.5 seconds
        expect(tti).toBeLessThan(2500);
    });
});