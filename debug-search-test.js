const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 콘솔 로그 캡처
  page.on('console', msg => {
    if (msg.text().includes('검색') || msg.text().includes('보라색') || msg.text().includes('클릭') || msg.text().includes('삭제')) {
      console.log(`[${msg.type()}] ${msg.text()}`);
    }
  });

  try {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#searchToggleBtn', { timeout: 15000 });

    console.log('\n🧪 보라색 필지 클릭 삭제 테스트');

    // 1. 검색 모드로 전환
    console.log('1️⃣ 검색 모드로 전환...');
    await page.click('#searchToggleBtn');
    await page.waitForTimeout(2000);

    // 2. 검색 실행
    console.log('2️⃣ "소하로 162" 검색...');
    await page.fill('#searchInput', '소하로 162');
    await page.click('#searchBtn');
    await page.waitForTimeout(5000);

    // 3. 보라색 필지 개수 확인
    const purpleParcelCount = await page.evaluate(() => {
      return window.searchParcels ? window.searchParcels.size : 0;
    });
    console.log(`3️⃣ 생성된 보라색 필지 개수: ${purpleParcelCount}`);

    if (purpleParcelCount > 0) {
      console.log('4️⃣ 보라색 필지가 있습니다! 지도 중앙을 클릭해보겠습니다...');

      // 지도 중앙 클릭 시도
      await page.click('#map', { position: { x: 400, y: 300 } });
      await page.waitForTimeout(2000);

      // 여러 위치 클릭 시도
      console.log('5️⃣ 여러 위치 클릭 시도...');
      const positions = [
        { x: 350, y: 250 },
        { x: 450, y: 350 },
        { x: 400, y: 300 },
        { x: 500, y: 400 }
      ];

      for (const pos of positions) {
        console.log(`위치 (${pos.x}, ${pos.y}) 클릭...`);
        await page.click('#map', { position: pos });
        await page.waitForTimeout(1000);
      }

    } else {
      console.log('❌ 보라색 필지가 생성되지 않았습니다!');
    }

    console.log('\n>>> 브라우저를 20초간 유지합니다. 직접 보라색 필지를 클릭해보세요! <<<');
    await page.waitForTimeout(20000);

  } catch (error) {
    console.error('테스트 중 오류:', error);
  } finally {
    await browser.close();
  }
})();