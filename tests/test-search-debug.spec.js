const { test, expect } = require('@playwright/test');

test.describe('검색 디버깅', () => {
    test('검색 함수 및 UI 확인', async ({ page }) => {
        console.log('=== 검색 디버깅 시작 ===');

        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            console.log(`[브라우저]: ${text}`);
        });

        // 페이지 로드
        await page.goto('http://localhost:4000');
        await page.waitForTimeout(3000);

        // 검색 모드로 전환
        await page.click('button[data-mode="search"]');
        await page.waitForTimeout(1000);

        // 개발자 콘솔에서 검색 함수 확인
        const functionsExist = await page.evaluate(() => {
            const result = {
                searchAddressByKeyword: typeof window.searchAddressByKeyword,
                searchParcelByJibun: typeof window.searchParcelByJibun,
                SearchModeManager: typeof window.SearchModeManager,
                executeSearch: window.SearchModeManager ? typeof window.SearchModeManager.executeSearch : 'N/A'
            };
            console.log('함수 존재 여부:', result);
            return result;
        });

        console.log('함수 타입 확인:', functionsExist);

        // SearchModeManager로 직접 검색 실행
        const searchResult = await page.evaluate(async () => {
            if (window.SearchModeManager && window.SearchModeManager.executeSearch) {
                console.log('SearchModeManager.executeSearch 호출');
                const result = await window.SearchModeManager.executeSearch('종로', 'address');
                console.log('검색 결과:', result);
                return result;
            }
            return null;
        });

        console.log('SearchModeManager 검색 결과:', searchResult);

        // UI 요소 확인
        const uiElements = await page.evaluate(() => {
            return {
                searchInput: !!document.getElementById('searchInput'),
                searchButton: !!document.getElementById('searchButton'),
                searchResults: !!document.getElementById('searchResults'),
                searchResultsVisible: document.getElementById('searchResults')?.style.display !== 'none'
            };
        });

        console.log('UI 요소 상태:', uiElements);

        // 검색 입력 필드로 직접 검색
        const searchInput = await page.locator('#searchInput');
        if (searchInput) {
            await searchInput.fill('서울시 종로구');
            await searchInput.press('Enter');
            await page.waitForTimeout(3000);

            // 검색 후 UI 상태 확인
            const afterSearch = await page.evaluate(() => {
                const resultsDiv = document.getElementById('searchResults');
                return {
                    exists: !!resultsDiv,
                    visible: resultsDiv?.style.display !== 'none',
                    innerHTML: resultsDiv?.innerHTML?.substring(0, 200),
                    childCount: resultsDiv?.children?.length || 0,
                    searchParcelsSize: window.SearchModeManager?.searchParcels?.size || 0,
                    searchResultsLength: window.SearchModeManager?.searchResults?.length || 0
                };
            });

            console.log('검색 후 상태:', afterSearch);
        }

        // 스크린샷
        await page.screenshot({ path: 'test-search-debug.png', fullPage: true });

        console.log('=== 검색 디버깅 완료 ===');
    });
});