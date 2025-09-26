const { test } = require('@playwright/test');

test('인증 후 리디렉트 확인', async ({ page }) => {
    page.on('console', msg => console.log(`[브라우저]: ${msg.text()}`));

    console.log('1. 첫 번째 페이지 로드');
    await page.goto('http://localhost:3000');

    console.log('2. localStorage 설정');
    await page.evaluate(() => {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('authProvider', 'test');
        console.log('✅ localStorage 설정 완료');
    });

    console.log('3. 페이지 재로드');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log(`\n최종 URL: ${url}`);

    const hasUtils = await page.evaluate(() => {
        return typeof window.ParcelValidationUtils !== 'undefined';
    });

    console.log(`ParcelValidationUtils: ${hasUtils ? '있음' : '없음'}`);

    const scriptCount = await page.evaluate(() => {
        return document.getElementsByTagName('script').length;
    });

    console.log(`스크립트 개수: ${scriptCount}`);
});