const { test } = require('@playwright/test');

test('리디렉트 확인', async ({ page }) => {
    page.on('console', msg => console.log(`[브라우저]: ${msg.text()}`));

    console.log('📍 초기 URL: http://localhost:3000');
    await page.goto('http://localhost:3000');

    await page.waitForTimeout(2000);

    const currentURL = page.url();
    console.log(`\n📍 현재 URL: ${currentURL}`);

    const title = await page.title();
    console.log(`📄 페이지 제목: ${title}`);

    const bodyText = await page.evaluate(() => {
        return document.body.innerText.substring(0, 500);
    });
    console.log(`\n📝 페이지 내용 (첫 500자):\n${bodyText}`);

    const scriptSrcs = await page.evaluate(() => {
        return Array.from(document.getElementsByTagName('script'))
            .map(s => s.src)
            .filter(s => s);
    });
    console.log(`\n📜 외부 스크립트 (${scriptSrcs.length}개):`);
    scriptSrcs.forEach(src => console.log(`  - ${src}`));
});
