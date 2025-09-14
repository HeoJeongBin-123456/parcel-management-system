const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 콘솔 로그 캡처
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // 에러 캡처
  page.on('pageerror', error => {
    console.error('페이지 에러:', error);
  });

  try {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#searchToggleBtn', { timeout: 10000 });

    console.log('\n🧪 검색 모드 독립성 테스트 시작\n');

    // 1. 초기 상태 확인 (검색 OFF)
    console.log('1️⃣ 초기 상태 확인 (검색 OFF 모드)');
    const initialMode = await page.textContent('#searchToggleBtn');
    console.log(`초기 모드: ${initialMode}`);

    // 저장 버튼 활성화 상태 확인
    const saveBtn = await page.locator('#saveBtn');
    const isSaveBtnEnabled = await saveBtn.isEnabled();
    console.log(`저장 버튼 활성화: ${isSaveBtnEnabled}`);

    // 2. 검색 ON 모드로 전환
    console.log('\n2️⃣ 검색 ON 모드로 전환');
    await page.click('#searchToggleBtn');
    await page.waitForTimeout(2000);

    const searchModeText = await page.textContent('#searchToggleBtn');
    console.log(`모드 전환 후: ${searchModeText}`);

    // 검색 ON 모드에서 저장 버튼 비활성화 확인
    const isSaveBtnDisabledInSearch = !(await saveBtn.isEnabled());
    console.log(`검색 모드에서 저장 버튼 비활성화: ${isSaveBtnDisabledInSearch}`);

    // 저장 버튼 스타일 확인
    const saveBtnOpacity = await saveBtn.evaluate(el => getComputedStyle(el).opacity);
    console.log(`저장 버튼 투명도: ${saveBtnOpacity}`);

    // 3. 검색 실행
    console.log('\n3️⃣ 검색 실행');
    await page.fill('#searchInput', '서울시 중구 을지로1가 1');
    await page.click('#searchBtn');
    await page.waitForTimeout(3000);

    // 4. 검색 OFF 모드로 복귀
    console.log('\n4️⃣ 검색 OFF 모드로 복귀');
    await page.click('#searchToggleBtn');
    await page.waitForTimeout(2000);

    const clickModeText = await page.textContent('#searchToggleBtn');
    console.log(`모드 복귀 후: ${clickModeText}`);

    // 저장 버튼 다시 활성화 확인
    const isSaveBtnEnabledAfterReturn = await saveBtn.isEnabled();
    console.log(`클릭 모드로 복귀 후 저장 버튼 활성화: ${isSaveBtnEnabledAfterReturn}`);

    const saveBtnOpacityAfter = await saveBtn.evaluate(el => getComputedStyle(el).opacity);
    console.log(`저장 버튼 복귀 후 투명도: ${saveBtnOpacityAfter}`);

    // 5. 보라색 필지 존재 여부 확인
    console.log('\n5️⃣ 보라색 필지 존재 여부 확인');

    // 지도에서 보라색 폴리곤 검색
    const purpleCount = await page.evaluate(() => {
      if (window.clickParcels) {
        let purpleCount = 0;
        window.clickParcels.forEach(parcel => {
          if (parcel.color === '#9370DB') {
            purpleCount++;
          }
        });
        return purpleCount;
      }
      return 0;
    });

    console.log(`클릭 필지에서 보라색 필지 개수: ${purpleCount}`);

    // 6. 현재 색상 확인
    const currentColorDisplay = await page.locator('#currentColor').evaluate(el => {
      return getComputedStyle(el).backgroundColor;
    });
    console.log(`현재 선택된 색상: ${currentColorDisplay}`);

    console.log('\n✅ 테스트 완료!');

    // 결과 요약
    console.log('\n📊 테스트 결과 요약:');
    console.log(`✓ 초기 상태 저장 버튼 활성화: ${isSaveBtnEnabled ? '성공' : '실패'}`);
    console.log(`✓ 검색 모드에서 저장 버튼 비활성화: ${isSaveBtnDisabledInSearch ? '성공' : '실패'}`);
    console.log(`✓ 클릭 모드 복귀 후 저장 버튼 활성화: ${isSaveBtnEnabledAfterReturn ? '성공' : '실패'}`);
    console.log(`✓ 클릭 모드에서 보라색 필지 제거: ${purpleCount === 0 ? '성공' : '실패'}`);

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('테스트 실행 중 오류:', error);
  } finally {
    await browser.close();
  }
})();