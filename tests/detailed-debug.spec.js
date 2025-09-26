const { test, expect } = require('@playwright/test');

test('window 객체 상세 분석', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
        const allKeys = Object.keys(window);
        const parcelKeys = allKeys.filter(k => 
            k.toLowerCase().includes('parcel')
        );

        let validationUtilsValue = null;
        try {
            validationUtilsValue = window.ParcelValidationUtils;
        } catch (e) {
            validationUtilsValue = `에러: ${e.message}`;
        }

        const scriptTags = Array.from(document.getElementsByTagName('script'))
            .map(s => ({
                src: s.src || '(inline)',
                async: s.async,
                defer: s.defer
            }));

        return {
            hasParcelValidationUtils: typeof window.ParcelValidationUtils !== 'undefined',
            parcelValidationUtilsType: typeof window.ParcelValidationUtils,
            parcelValidationUtilsValue: validationUtilsValue,
            parcelRelatedKeys: parcelKeys,
            totalWindowKeys: allKeys.length,
            scriptCount: scriptTags.length,
            scripts: scriptTags
        };
    });

    console.log('\n📊 상세 분석 결과:');
    console.log(JSON.stringify(result, null, 2));

    expect(result.hasParcelValidationUtils).toBeTruthy();
});
