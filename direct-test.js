const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000  // 천천히 실행해서 확인
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 콘솔 로그 캡처
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#searchToggleBtn', { timeout: 15000 });

    console.log('🧪 실제 검색 테스트 시작');
    console.log('1. 검색 ON으로 전환...');

    // 검색 모드로 전환
    await page.click('#searchToggleBtn');
    await page.waitForTimeout(2000);

    console.log('2. "소하로 162" 검색 중...');
    await page.fill('#searchInput', '소하로 162');
    await page.click('#searchBtn');
    await page.waitForTimeout(5000); // 검색 완료 대기

    console.log('3. 보라색 필지 생성 확인...');
    await page.waitForTimeout(3000);

    console.log('4. 보라색 필지 클릭 시도...');
    // 지도 중앙 부분 클릭 (보라색 필지가 있을 것으로 예상)
    await page.click('#map', { position: { x: 400, y: 300 } });
    await page.waitForTimeout(2000);

    console.log('5. 삭제 다이얼로그 확인 대기...');

    // 페이지를 10초간 유지해서 사용자가 직접 확인할 수 있도록
    console.log('>>> 10초간 페이지 유지. 직접 보라색 필지를 클릭해보세요! <<<');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('테스트 실행 중 오류:', error);
  }

  // 브라우저를 닫지 않고 유지
  console.log('>>> 브라우저를 유지합니다. 직접 테스트해보세요! <<<');
  console.log('>>> Ctrl+C로 종료하세요 <<<');

  // 무한 대기
  await new Promise(() => {});
})();