const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  let testResults = {
    searchModeToggle: false,
    searchExecution: false,
    purpleParcelCreation: false,
    purpleParcelClick: false,
    deleteDialogAppears: false,
    actualDeletion: false,
    offModeCleanup: false
  };

  // 콘솔 로그 캡처
  let deleteDialogShown = false;
  page.on('dialog', dialog => {
    console.log(`🔔 다이얼로그 감지: "${dialog.message()}"`);
    if (dialog.message().includes('삭제하시겠습니까')) {
      deleteDialogShown = true;
      testResults.deleteDialogAppears = true;
      console.log('✅ 삭제 다이얼로그 확인됨!');
      dialog.accept(); // "예" 클릭
    } else {
      dialog.accept();
    }
  });

  // 콘솔 로그 캡처
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('검색') || text.includes('보라색') || text.includes('클릭') || text.includes('삭제')) {
      console.log(`[${msg.type()}] ${text}`);
    }
  });

  try {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#searchToggleBtn', { timeout: 15000 });

    console.log('\n🧪 === 완전한 검색 모드 독립성 E2E 테스트 ===\n');

    // 1. 초기 상태 확인 (검색 OFF)
    console.log('1️⃣ 초기 상태 확인...');
    const initialMode = await page.textContent('#searchToggleBtn');
    console.log(`   초기 모드: ${initialMode}`);
    testResults.searchModeToggle = initialMode === '검색 OFF';

    // 2. 검색 ON 모드로 전환
    console.log('\n2️⃣ 검색 ON 모드로 전환...');
    await page.click('#searchToggleBtn');
    await page.waitForTimeout(2000);

    const searchModeText = await page.textContent('#searchToggleBtn');
    console.log(`   모드 전환: ${searchModeText}`);
    testResults.searchModeToggle = testResults.searchModeToggle && (searchModeText === '검색 ON');

    // 저장 버튼 비활성화 확인
    const saveBtn = await page.locator('#saveBtn');
    const isSaveBtnDisabled = !(await saveBtn.isEnabled());
    console.log(`   저장 버튼 비활성화: ${isSaveBtnDisabled}`);

    // 3. 검색 실행
    console.log('\n3️⃣ "소하로 162" 검색 실행...');
    await page.fill('#searchInput', '소하로 162');
    await page.click('#searchBtn');
    await page.waitForTimeout(5000);
    testResults.searchExecution = true;

    // 4. 보라색 필지 생성 확인
    console.log('\n4️⃣ 보라색 필지 생성 확인...');
    const purpleParcelCount = await page.evaluate(() => {
      return window.searchParcels ? window.searchParcels.size : 0;
    });
    console.log(`   생성된 보라색 필지 개수: ${purpleParcelCount}`);
    testResults.purpleParcelCreation = purpleParcelCount > 0;

    if (purpleParcelCount > 0) {
      // 5. 보라색 필지 클릭
      console.log('\n5️⃣ 보라색 필지 클릭 테스트...');

      // 여러 위치 클릭해서 보라색 필지 찾기
      const clickPositions = [
        { x: 400, y: 300 },
        { x: 350, y: 250 },
        { x: 450, y: 350 },
        { x: 500, y: 400 }
      ];

      let clickEventDetected = false;
      let clickAttempts = 0;

      for (const pos of clickPositions) {
        console.log(`   위치 (${pos.x}, ${pos.y}) 클릭...`);

        // 클릭 전 상태
        const beforeClick = await page.evaluate(() => window.searchParcels.size);

        await page.click('#map', { position: pos });
        await page.waitForTimeout(2000);

        // 삭제 다이얼로그가 나타났는지 확인
        if (deleteDialogShown) {
          console.log('   ✅ 보라색 필지 클릭 성공!');
          testResults.purpleParcelClick = true;

          // 삭제 후 상태 확인
          await page.waitForTimeout(2000);
          const afterClick = await page.evaluate(() => window.searchParcels.size);

          console.log(`   삭제 전 필지 수: ${beforeClick}, 삭제 후 필지 수: ${afterClick}`);
          testResults.actualDeletion = afterClick < beforeClick;

          if (testResults.actualDeletion) {
            console.log('   ✅ 실제 삭제 완료!');
          }
          break;
        }
        clickAttempts++;
      }

      if (!deleteDialogShown) {
        console.log('   ❌ 모든 위치 클릭했지만 삭제 다이얼로그 없음');
      }
    }

    // 6. 검색 OFF 모드로 전환
    console.log('\n6️⃣ 검색 OFF 모드로 전환...');
    await page.click('#searchToggleBtn');
    await page.waitForTimeout(3000);

    const offModeText = await page.textContent('#searchToggleBtn');
    console.log(`   모드 복귀: ${offModeText}`);

    // 7. 보라색 필지 완전 제거 확인
    console.log('\n7️⃣ 보라색 필지 완전 제거 확인...');
    const remainingPurpleParcels = await page.evaluate(() => {
      let purpleCount = 0;
      if (window.clickParcels) {
        window.clickParcels.forEach(parcel => {
          if (parcel.color === '#9370DB') purpleCount++;
        });
      }
      return purpleCount;
    });

    console.log(`   클릭 모드에서 보라색 필지 수: ${remainingPurpleParcels}`);
    testResults.offModeCleanup = remainingPurpleParcels === 0;

    // 저장 버튼 다시 활성화 확인
    const isSaveBtnReEnabled = await saveBtn.isEnabled();
    console.log(`   저장 버튼 재활성화: ${isSaveBtnReEnabled}`);

    // 8. 테스트 결과 출력
    console.log('\n🏆 === 테스트 결과 요약 ===');
    console.log(`✅ 검색 모드 토글: ${testResults.searchModeToggle ? '성공' : '실패'}`);
    console.log(`✅ 보라색 필지 생성: ${testResults.purpleParcelCreation ? '성공' : '실패'}`);
    console.log(`✅ 보라색 필지 클릭: ${testResults.purpleParcelClick ? '성공' : '실패'}`);
    console.log(`✅ 삭제 다이얼로그: ${testResults.deleteDialogAppears ? '성공' : '실패'}`);
    console.log(`✅ 실제 삭제 처리: ${testResults.actualDeletion ? '성공' : '실패'}`);
    console.log(`✅ 검색 OFF 정리: ${testResults.offModeCleanup ? '성공' : '실패'}`);

    const allTestsPassed = Object.values(testResults).every(result => result);
    console.log(`\n🎯 전체 테스트: ${allTestsPassed ? '✅ 모든 테스트 통과' : '❌ 일부 테스트 실패'}`);

    if (!allTestsPassed) {
      console.log('\n⚠️ 실패한 테스트들을 수정이 필요합니다.');
    }

    // 최종 확인을 위해 10초 대기
    console.log('\n>>> 10초간 최종 확인 시간 <<<');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error);
  } finally {
    await browser.close();
    console.log('\n🔚 테스트 완료');
  }
})();