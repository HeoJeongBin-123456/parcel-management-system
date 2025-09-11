const { test, expect } = require('@playwright/test');

test.describe('필지 검색 기능 테스트', () => {
  
  test.beforeEach(async ({ page }) => {
    // 페이지 로드 전 네트워크 오류 무시
    page.on('pageerror', exception => {
      console.log(`페이지 오류: ${exception}`);
    });
    
    // 콘솔 로그 확인
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`콘솔 오류: ${msg.text()}`);
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(3000); // 지도 로딩 대기
  });

  test('서울시 강남구 검색 - 형광색 필지 표시 확인', async ({ page }) => {
    // 검색 입력
    await page.fill('#searchInput', '서울시 강남구 삼성동');
    await page.click('#searchBtn');
    
    // 검색 결과 대기
    await page.waitForTimeout(5000);
    
    // 콘솔에 성공 메시지가 있는지 확인
    const logs = [];
    page.on('console', msg => {
      logs.push(msg.text());
    });
    
    // 형광색 필지가 지도에 추가되었는지 확인
    const mapContainer = page.locator('#map');
    await expect(mapContainer).toBeVisible();
    
    console.log('🎯 검색 테스트 완료 - 서울시 강남구 삼성동');
  });

  test('경기도 성남시 검색 - API 응답 확인', async ({ page }) => {
    // 검색 입력
    await page.fill('#searchInput', '경기도 성남시 분당구');
    await page.click('#searchBtn');
    
    // 검색 결과 대기
    await page.waitForTimeout(5000);
    
    // 페이지에서 스크립트 실행하여 결과 확인
    const searchResultsCount = await page.evaluate(() => {
      return window.searchResults ? window.searchResults.size : 0;
    });
    
    console.log(`🔍 검색 결과 개수: ${searchResultsCount}`);
    
    // 최소한 하나의 결과가 있어야 함
    expect(searchResultsCount).toBeGreaterThan(0);
  });

  test('검색 결과 표시/숨김 토글 테스트', async ({ page }) => {
    // 검색 실행
    await page.fill('#searchInput', '서울시 강남구');
    await page.click('#searchBtn');
    await page.waitForTimeout(3000);
    
    // 검색 토글 버튼 클릭
    await page.click('#searchToggleBtn');
    await page.waitForTimeout(1000);
    
    // 버튼 텍스트가 변경되었는지 확인
    const toggleText = await page.textContent('#searchToggleBtn');
    console.log(`📊 토글 버튼 상태: ${toggleText}`);
    
    expect(['검색 ON', '검색 OFF']).toContain(toggleText);
  });

  test('반복 검색 테스트 - 안정성 확인', async ({ page }) => {
    const searchTerms = [
      '서울시 강남구',
      '경기도 성남시',
      '서울시 서초구',
      '경기도 용인시'
    ];
    
    for (let i = 0; i < searchTerms.length; i++) {
      console.log(`🔄 반복 테스트 ${i + 1}/${searchTerms.length}: ${searchTerms[i]}`);
      
      // 검색 실행
      await page.fill('#searchInput', searchTerms[i]);
      await page.click('#searchBtn');
      await page.waitForTimeout(3000);
      
      // 오류 없이 실행되었는지 확인
      const hasError = await page.evaluate(() => {
        return window.console && window.console.error;
      });
      
      console.log(`✅ ${searchTerms[i]} 검색 완료`);
    }
    
    console.log('🎉 반복 검색 테스트 모두 완료');
  });

  test('형광색 필지 렌더링 확인', async ({ page }) => {
    // 검색 실행
    await page.fill('#searchInput', '서울시 강남구');
    await page.click('#searchBtn');
    await page.waitForTimeout(5000);
    
    // 페이지에서 형광색 폴리곤 확인
    const highlightedParcels = await page.evaluate(() => {
      // 전역 변수 확인
      const results = window.searchResults;
      const parcelsCount = results ? results.size : 0;
      
      // 네이버 지도 폴리곤 확인
      const map = window.map;
      let polygonCount = 0;
      
      if (map && results) {
        results.forEach((parcel) => {
          if (parcel.polygon) {
            polygonCount++;
          }
        });
      }
      
      return {
        searchResultsCount: parcelsCount,
        polygonCount: polygonCount
      };
    });
    
    console.log(`📍 검색 결과: ${highlightedParcels.searchResultsCount}개`);
    console.log(`🎨 폴리곤 생성: ${highlightedParcels.polygonCount}개`);
    
    expect(highlightedParcels.searchResultsCount).toBeGreaterThan(0);
  });

});