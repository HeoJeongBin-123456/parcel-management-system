const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 콘솔 로그 캡처
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // 다이얼로그 처리
  page.on('dialog', dialog => {
    console.log(`🔔 다이얼로그: "${dialog.message()}"`);
    dialog.accept();
  });

  try {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#searchToggleBtn', { timeout: 15000 });

    console.log('\n🧪 === 새로고침 후 검색 필지 지속성 테스트 ===\n');

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
    let purpleCount = await page.evaluate(() => {
      return window.searchParcels ? window.searchParcels.size : 0;
    });
    console.log(`3️⃣ 생성된 보라색 필지 개수: ${purpleCount}`);

    if (purpleCount > 0) {
      // 4. 보라색 필지 클릭해서 삭제
      console.log('4️⃣ 보라색 필지 클릭해서 삭제...');
      await page.click('#map', { position: { x: 400, y: 300 } });
      await page.waitForTimeout(3000);

      // 삭제 후 개수 확인
      purpleCount = await page.evaluate(() => {
        return window.searchParcels ? window.searchParcels.size : 0;
      });
      console.log(`   삭제 후 보라색 필지 개수: ${purpleCount}`);

      // 5. localStorage 상태 확인
      const localStorageData = await page.evaluate(() => {
        return localStorage.getItem('window.searchParcels');
      });
      console.log(`5️⃣ localStorage 상태: ${localStorageData ? '데이터 있음' : '데이터 없음'}`);
      if (localStorageData) {
        const parsedData = JSON.parse(localStorageData);
        console.log(`   localStorage 검색 필지 개수: ${parsedData.length}`);
      }

      // 6. 새로고침
      console.log('\n6️⃣ 페이지 새로고침...');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForSelector('#searchToggleBtn', { timeout: 15000 });
      await page.waitForTimeout(3000);

      // 7. 검색 모드로 다시 전환 (새로고침 후 OFF 모드가 될 것)
      const currentMode = await page.textContent('#searchToggleBtn');
      if (currentMode === '검색 OFF') {
        console.log('7️⃣ 새로고침 후 검색 모드로 재전환...');
        await page.click('#searchToggleBtn');
        await page.waitForTimeout(3000);
      }

      // 8. 새로고침 후 보라색 필지 개수 확인
      purpleCount = await page.evaluate(() => {
        return window.searchParcels ? window.searchParcels.size : 0;
      });
      console.log(`8️⃣ 새로고침 후 보라색 필지 개수: ${purpleCount}`);

      // 9. 지도에서 실제로 보라색 폴리곤이 보이는지 확인
      const visiblePolygons = await page.evaluate(() => {
        let count = 0;
        if (window.searchParcels) {
          window.searchParcels.forEach((result) => {
            if (result.polygon && result.polygon.getMap()) {
              count++;
            }
          });
        }
        return count;
      });
      console.log(`   지도에 표시된 보라색 폴리곤 개수: ${visiblePolygons}`);

      // 결과 판정
      console.log('\n🏆 === 테스트 결과 ===');
      if (purpleCount === 0 && visiblePolygons === 0) {
        console.log('✅ 성공: 삭제된 검색 필지가 새로고침 후에도 나타나지 않음');
      } else {
        console.log('❌ 실패: 삭제된 검색 필지가 새로고침 후 다시 나타남');
        console.log(`   searchParcels 개수: ${purpleCount}, 표시된 폴리곤: ${visiblePolygons}`);
      }

    } else {
      console.log('❌ 보라색 필지가 생성되지 않아 테스트를 진행할 수 없습니다.');
    }

    console.log('\n>>> 10초간 결과 확인 시간 <<<');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error);
  } finally {
    await browser.close();
    console.log('🔚 테스트 완료');
  }
})();