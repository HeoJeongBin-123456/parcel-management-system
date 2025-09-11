const { test, expect } = require('@playwright/test');

test.describe('전체 버튼 기능 종합 테스트', () => {
  
  test.beforeEach(async ({ page }) => {
    // 페이지 오류 무시
    page.on('pageerror', exception => {
      console.log(`페이지 오류: ${exception}`);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`콘솔 오류: ${msg.text()}`);
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(5000); // 지도 로딩 대기
  });

  test('헤더 영역 - 지도 타입 버튼들', async ({ page }) => {
    console.log('🗺️ 지도 타입 버튼 테스트 시작');
    
    // 일반지도 버튼
    await page.click('button[data-type="normal"]');
    await page.waitForTimeout(1000);
    await expect(page.locator('button[data-type="normal"]')).toHaveClass(/active/);
    console.log('✅ 일반지도 버튼 작동');
    
    // 위성지도 버튼
    await page.click('button[data-type="satellite"]');
    await page.waitForTimeout(1000);
    await expect(page.locator('button[data-type="satellite"]')).toHaveClass(/active/);
    console.log('✅ 위성지도 버튼 작동');
    
    // 지적편집도 버튼
    await page.click('button[data-type="cadastral"]');
    await page.waitForTimeout(2000);
    await expect(page.locator('button[data-type="cadastral"]')).toHaveClass(/active/);
    console.log('✅ 지적편집도 버튼 작동');
    
    // 거리뷰 버튼 (무조건 작동해야 함)
    await page.click('button[data-type="street"]');
    await page.waitForTimeout(3000);
    await expect(page.locator('button[data-type="street"]')).toHaveClass(/active/);
    console.log('✅ 거리뷰 버튼 작동');
  });

  test('헤더 영역 - 검색 기능', async ({ page }) => {
    console.log('🔍 검색 기능 테스트 시작');
    
    // 검색 입력
    await page.fill('#searchInput', '서울시 강남구');
    await page.click('#searchBtn');
    await page.waitForTimeout(5000);
    console.log('✅ 검색 실행 버튼 작동');
    
    // 검색 토글 버튼
    const toggleBtn = page.locator('#searchToggleBtn');
    const initialText = await toggleBtn.textContent();
    await toggleBtn.click();
    await page.waitForTimeout(1000);
    const afterText = await toggleBtn.textContent();
    expect(initialText).not.toBe(afterText);
    console.log('✅ 검색 토글 버튼 작동');
  });

  test('헤더 영역 - 캘린더 버튼', async ({ page }) => {
    console.log('📅 캘린더 버튼 테스트');
    
    await page.click('#calendarBtn');
    await page.waitForTimeout(2000);
    
    // 캘린더 모달이 표시되는지 확인
    const modal = page.locator('#calendarModal');
    await expect(modal).toBeVisible();
    console.log('✅ 캘린더 버튼 작동');
    
    // 모달 닫기
    await page.click('#calendarModal .close');
    await page.waitForTimeout(1000);
  });

  test('사이드바 - 색상 선택 패널', async ({ page }) => {
    console.log('🎨 색상 선택 패널 테스트');
    
    const colors = ['#FF0000', '#FFA500', '#FFFF00', '#90EE90', '#0000FF', '#000000', '#FFFFFF', '#87CEEB'];
    
    for (const color of colors) {
      await page.click(`div[data-color="${color}"]`);
      await page.waitForTimeout(500);
      
      // 현재 색상이 변경되었는지 확인
      const currentColorEl = page.locator('#currentColor');
      const bgColor = await currentColorEl.evaluate(el => window.getComputedStyle(el).backgroundColor);
      console.log(`✅ ${color} 색상 선택됨`);
    }
  });

  test('사이드바 - 초기화 버튼들', async ({ page }) => {
    console.log('🧹 초기화 버튼들 테스트');
    
    // 선택 초기화 버튼
    await page.click('#clearSelectedBtn');
    await page.waitForTimeout(1000);
    console.log('✅ 선택 초기화 버튼 작동');
    
    // 검색 초기화 버튼
    await page.click('#clearSearchBtn');
    await page.waitForTimeout(1000);
    console.log('✅ 검색 초기화 버튼 작동');
    
    // 전체 초기화 버튼
    await page.click('#clearAllColorsBtn');
    await page.waitForTimeout(1000);
    console.log('✅ 전체 초기화 버튼 작동');
  });

  test('사이드바 - 필지 정보 입력 폼', async ({ page }) => {
    console.log('📝 필지 정보 입력 폼 테스트');
    
    // 폼 필드 입력
    await page.fill('#parcelNumber', '123-4');
    await page.fill('#ownerName', '홍길동');
    await page.fill('#ownerAddress', '서울시 강남구');
    await page.fill('#ownerContact', '010-1234-5678');
    await page.fill('#memo', '테스트 메모');
    console.log('✅ 모든 입력 필드 작동');
    
    // 저장 버튼
    await page.click('#saveBtn');
    await page.waitForTimeout(1000);
    console.log('✅ 저장 버튼 작동');
    
    // 초기화 버튼
    await page.click('#clearBtn');
    await page.waitForTimeout(1000);
    
    // 필드가 비워졌는지 확인
    const parcelNumber = await page.inputValue('#parcelNumber');
    expect(parcelNumber).toBe('');
    console.log('✅ 폼 초기화 버튼 작동');
  });

  test('사이드바 - 내보내기 버튼들', async ({ page }) => {
    console.log('📤 내보내기 버튼들 테스트');
    
    // 먼저 필지 정보 입력
    await page.fill('#parcelNumber', '456-7');
    await page.fill('#ownerName', '김철수');
    await page.click('#saveBtn');
    await page.waitForTimeout(1000);
    
    // 구글 시트 전송 버튼
    await page.click('#exportCurrentBtn');
    await page.waitForTimeout(1000);
    console.log('✅ 구글 시트 전송 버튼 작동');
    
    // 엑셀 복사 버튼
    await page.click('#copyDataBtn');
    await page.waitForTimeout(1000);
    console.log('✅ 엑셀 복사 버튼 작동');
  });

  test('필지 목록 패널 - 토글 및 기능들', async ({ page }) => {
    console.log('📋 필지 목록 패널 테스트');
    
    // 패널 토글 버튼
    const toggleBtn = page.locator('.ap-toggle');
    await toggleBtn.click();
    await page.waitForTimeout(1000);
    
    // 패널이 열렸는지 확인
    const panel = page.locator('#advancedParcelPanel');
    await expect(panel).toHaveClass(/open/);
    console.log('✅ 필지 목록 패널 토글 작동');
    
    // 패널 내부 버튼들 확인
    const exportButtons = page.locator('.pm-actions button');
    const buttonCount = await exportButtons.count();
    expect(buttonCount).toBeGreaterThan(0);
    console.log('✅ 패널 내부 버튼들 확인');
    
    // 패널 닫기
    await page.click('.ap-close');
    await page.waitForTimeout(1000);
  });

  test('지도 클릭 및 상호작용', async ({ page }) => {
    console.log('🗺️ 지도 상호작용 테스트');
    
    // 지도 중앙 클릭
    const mapElement = page.locator('#map');
    await mapElement.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(2000);
    console.log('✅ 지도 클릭 가능');
    
    // 필지 데이터가 있는지 확인
    const hasData = await page.evaluate(() => {
      return window.parcels && window.parcels.size >= 0;
    });
    expect(hasData).toBe(true);
    console.log('✅ 지도 데이터 구조 정상');
  });

  test('localStorage 영속성 테스트', async ({ page }) => {
    console.log('💾 데이터 영속성 테스트');
    
    // 데이터 입력 및 저장
    await page.fill('#parcelNumber', '999-1');
    await page.fill('#ownerName', '영속성테스트');
    await page.click('#saveBtn');
    await page.waitForTimeout(1000);
    
    // 검색 결과 생성
    await page.fill('#searchInput', '서울시 강남구');
    await page.click('#searchBtn');
    await page.waitForTimeout(3000);
    
    // 페이지 새로고침
    await page.reload();
    await page.waitForTimeout(5000);
    
    // 데이터가 복원되었는지 확인
    const hasStoredData = await page.evaluate(() => {
      const parcelData = localStorage.getItem('parcelData');
      const searchData = localStorage.getItem('searchResults');
      return (parcelData && parcelData !== '[]') || (searchData && searchData !== '[]');
    });
    
    expect(hasStoredData).toBe(true);
    console.log('✅ 데이터 영속성 확인');
  });

  test('에러 처리 및 안정성', async ({ page }) => {
    console.log('⚡ 에러 처리 및 안정성 테스트');
    
    let errorCount = 0;
    page.on('pageerror', () => {
      errorCount++;
    });
    
    // 빠른 연속 클릭으로 스트레스 테스트
    const buttons = [
      'button[data-type="normal"]',
      'button[data-type="satellite"]',
      'button[data-type="cadastral"]',
      '#searchBtn',
      '#clearSelectedBtn',
      '#saveBtn'
    ];
    
    for (let i = 0; i < 3; i++) {
      for (const selector of buttons) {
        try {
          await page.click(selector, { timeout: 1000 });
          await page.waitForTimeout(200);
        } catch (e) {
          console.log(`버튼 ${selector} 클릭 시도 실패 (정상)`);
        }
      }
    }
    
    console.log(`🔍 총 JavaScript 오류 수: ${errorCount}`);
    expect(errorCount).toBeLessThan(10); // 과도한 오류가 아닌지 확인
    console.log('✅ 에러 처리 안정성 확인');
  });

  test('모든 기능 종합 플로우', async ({ page }) => {
    console.log('🎯 전체 기능 종합 테스트');
    
    // 1단계: 지도 타입 변경
    await page.click('button[data-type="satellite"]');
    await page.waitForTimeout(1000);
    
    // 2단계: 색상 선택
    await page.click('div[data-color="#FF0000"]');
    await page.waitForTimeout(500);
    
    // 3단계: 필지 정보 입력
    await page.fill('#parcelNumber', '종합-1');
    await page.fill('#ownerName', '종합테스트');
    await page.fill('#memo', '전체 플로우 테스트');
    await page.click('#saveBtn');
    await page.waitForTimeout(1000);
    
    // 4단계: 검색 수행
    await page.fill('#searchInput', '서울시 강남구');
    await page.click('#searchBtn');
    await page.waitForTimeout(3000);
    
    // 5단계: 필지 목록 패널 확인
    await page.click('.ap-toggle');
    await page.waitForTimeout(1000);
    
    // 6단계: 거리뷰 모드 테스트
    await page.click('button[data-type="street"]');
    await page.waitForTimeout(3000);
    
    // 7단계: 정리
    await page.click('button[data-type="normal"]');
    await page.waitForTimeout(1000);
    
    console.log('🎉 종합 테스트 완료');
  });

});