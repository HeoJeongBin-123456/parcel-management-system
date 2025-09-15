const { test, expect } = require('@playwright/test');

test.describe('검색 기능 완전 디버깅', () => {
    test('검색이 실제로 작동하는지 확인', async ({ page }) => {
        console.log('\n=== 검색 기능 디버깅 시작 ===\n');

        // 콘솔 로그 캡처
        const consoleLogs = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push(text);
            console.log(`[브라우저]: ${text}`);
        });

        // 페이지 에러 캡처
        page.on('pageerror', error => {
            console.error('[페이지 에러]:', error.message);
        });

        // 1. 페이지 로드
        await page.goto('http://localhost:4000');
        await page.waitForTimeout(3000);
        console.log('\n✅ 페이지 로드 완료\n');

        // 2. 초기 스크린샷
        await page.screenshot({ path: 'test-search-1-initial.png', fullPage: true });

        // 3. 검색 모드로 전환
        await page.click('button[data-mode="search"]');
        await page.waitForTimeout(1000);
        console.log('✅ 검색 모드 전환 완료\n');

        // 4. 검색 입력 필드 확인
        const searchInput = await page.locator('#searchInput');
        const inputExists = await searchInput.count() > 0;
        console.log(`검색 입력 필드 존재: ${inputExists}\n`);

        if (!inputExists) {
            console.error('❌ 검색 입력 필드를 찾을 수 없습니다!');
            return;
        }

        // 5. 검색어 입력
        const searchQuery = '종로구';
        await searchInput.fill(searchQuery);
        console.log(`검색어 입력: "${searchQuery}"\n`);

        // 6. 검색 실행 전 상태 확인
        const beforeSearchState = await page.evaluate(() => {
            return {
                searchModeManagerExists: !!window.SearchModeManager,
                searchResultsLength: window.SearchModeManager?.searchResults?.length || 0,
                searchParcelsSize: window.SearchModeManager?.searchParcels?.size || 0
            };
        });
        console.log('검색 전 상태:', beforeSearchState);

        // 7. 엔터키로 검색 실행
        await searchInput.press('Enter');
        console.log('\n⏳ 검색 실행 중...\n');
        await page.waitForTimeout(3000);

        // 8. 검색 후 스크린샷
        await page.screenshot({ path: 'test-search-2-after-search.png', fullPage: true });

        // 9. 검색 후 상태 확인
        const afterSearchState = await page.evaluate(() => {
            const resultsDiv = document.getElementById('searchResults');
            const searchState = {
                searchModeManagerExists: !!window.SearchModeManager,
                searchResultsLength: window.SearchModeManager?.searchResults?.length || 0,
                searchParcelsSize: window.SearchModeManager?.searchParcels?.size || 0,
                resultsDiv: {
                    exists: !!resultsDiv,
                    visible: resultsDiv?.style.display !== 'none',
                    innerHTML: resultsDiv?.innerHTML?.substring(0, 200),
                    childCount: resultsDiv?.children?.length || 0,
                    hasNoResultsMessage: resultsDiv?.innerHTML?.includes('검색 결과가 없습니다')
                },
                currentQuery: window.SearchModeManager?.currentQuery,
                isSearchActive: window.SearchModeManager?.isSearchActive
            };

            // 검색 함수들 체크
            const functionChecks = {
                searchAddressByKeyword: typeof window.searchAddressByKeyword,
                searchParcelByJibun: typeof window.searchParcelByJibun,
                searchAddress: typeof window.searchAddress
            };

            return { searchState, functionChecks };
        });

        console.log('\n=== 검색 후 상태 ===');
        console.log('검색 상태:', JSON.stringify(afterSearchState.searchState, null, 2));
        console.log('함수 체크:', afterSearchState.functionChecks);

        // 10. 검색 결과 UI 체크
        const searchResultsVisible = await page.locator('#searchResults').isVisible();
        console.log(`\n검색 결과 UI 표시 여부: ${searchResultsVisible}`);

        // 11. 검색 결과가 실제로 표시되는지 확인
        if (afterSearchState.searchState.resultsDiv.hasNoResultsMessage) {
            console.error('\n❌ "검색 결과가 없습니다" 메시지가 표시됨!');
        } else if (afterSearchState.searchState.searchResultsLength > 0) {
            console.log(`\n✅ ${afterSearchState.searchState.searchResultsLength}개의 검색 결과 발견!`);
        } else {
            console.error('\n❌ 검색 결과가 없습니다!');
        }

        // 12. 검색 버튼 클릭 테스트
        console.log('\n=== 검색 버튼 테스트 ===');
        const searchButton = await page.locator('#searchButton');
        const buttonExists = await searchButton.count() > 0;

        if (buttonExists) {
            await searchInput.fill('서울시');
            await searchButton.click();
            await page.waitForTimeout(2000);
            console.log('검색 버튼 클릭 완료');
        } else {
            console.log('검색 버튼이 없음');
        }

        // 13. 최종 스크린샷
        await page.screenshot({ path: 'test-search-3-final.png', fullPage: true });

        // 14. 테스트 결과 요약
        console.log('\n=== 테스트 결과 요약 ===');
        console.log(`- SearchModeManager 존재: ${afterSearchState.searchState.searchModeManagerExists}`);
        console.log(`- 검색 결과 개수: ${afterSearchState.searchState.searchResultsLength}`);
        console.log(`- 검색 결과 UI 표시: ${searchResultsVisible}`);
        console.log(`- 에러 발생 여부: ${consoleLogs.filter(log => log.includes('Error')).length > 0}`);

        // 15. 콘솔 에러 체크
        const errors = consoleLogs.filter(log => log.includes('Error') || log.includes('error'));
        if (errors.length > 0) {
            console.log('\n⚠️ 콘솔 에러 발견:');
            errors.forEach(err => console.log(`  - ${err}`));
        }

        console.log('\n=== 검색 기능 디버깅 완료 ===\n');
        console.log('📸 스크린샷 파일:');
        console.log('  - test-search-1-initial.png (초기 화면)');
        console.log('  - test-search-2-after-search.png (검색 후)');
        console.log('  - test-search-3-final.png (최종)');

        // 테스트 통과 조건
        expect(afterSearchState.searchState.searchModeManagerExists).toBe(true);
        expect(searchResultsVisible).toBe(true);
    });
});