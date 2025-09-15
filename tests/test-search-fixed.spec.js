const { test, expect } = require('@playwright/test');

test.describe('검색 기능 수정 확인', () => {
    test('검색 결과가 화면에 표시되는지 확인', async ({ page }) => {
        console.log('\n🔍 === 검색 기능 수정 확인 시작 ===\n');

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
        console.log('✅ 페이지 로드 완료\n');

        // 2. 초기 스크린샷
        await page.screenshot({ path: 'test-search-fixed-1-initial.png', fullPage: true });

        // 3. 검색 모드로 전환
        await page.click('button[data-mode="search"]');
        await page.waitForTimeout(1000);
        console.log('✅ 검색 모드 전환 완료\n');

        // 4. 검색 결과 컨테이너 상태 확인
        const beforeSearchState = await page.evaluate(() => {
            const container = document.querySelector('.search-results-container');
            const resultsDiv = document.getElementById('searchResults');
            return {
                container: {
                    exists: !!container,
                    display: container ? window.getComputedStyle(container).display : null,
                    visible: container ? container.offsetParent !== null : false,
                    classList: container ? Array.from(container.classList) : []
                },
                resultsDiv: {
                    exists: !!resultsDiv,
                    display: resultsDiv ? window.getComputedStyle(resultsDiv).display : null,
                    visible: resultsDiv ? resultsDiv.offsetParent !== null : false
                }
            };
        });
        console.log('검색 전 컨테이너 상태:', JSON.stringify(beforeSearchState, null, 2));

        // 5. 검색어 입력 및 실행
        const searchInput = await page.locator('#searchInput');
        await searchInput.fill('종로구');
        console.log('검색어 입력: "종로구"');

        await searchInput.press('Enter');
        console.log('⏳ 검색 실행 중...');
        await page.waitForTimeout(3000);

        // 6. 검색 후 스크린샷
        await page.screenshot({ path: 'test-search-fixed-2-after-search.png', fullPage: true });

        // 7. 검색 후 상태 확인
        const afterSearchState = await page.evaluate(() => {
            const container = document.querySelector('.search-results-container');
            const resultsDiv = document.getElementById('searchResults');
            const searchState = {
                container: {
                    exists: !!container,
                    display: container ? window.getComputedStyle(container).display : null,
                    visible: container ? container.offsetParent !== null : false,
                    inlineStyle: container ? container.style.display : null,
                    classList: container ? Array.from(container.classList) : []
                },
                resultsDiv: {
                    exists: !!resultsDiv,
                    display: resultsDiv ? window.getComputedStyle(resultsDiv).display : null,
                    visible: resultsDiv ? resultsDiv.offsetParent !== null : false,
                    innerHTML: resultsDiv?.innerHTML?.substring(0, 200),
                    childCount: resultsDiv?.children?.length || 0,
                    hasContent: resultsDiv ? resultsDiv.innerHTML.length > 0 : false,
                    hasNoResultsMessage: resultsDiv?.innerHTML?.includes('검색 결과가 없습니다')
                },
                searchModeManager: {
                    exists: !!window.SearchModeManager,
                    searchResultsLength: window.SearchModeManager?.searchResults?.length || 0,
                    searchParcelsSize: window.SearchModeManager?.searchParcels?.size || 0
                }
            };
            return searchState;
        });

        console.log('\n=== 검색 후 상태 ===');
        console.log(JSON.stringify(afterSearchState, null, 2));

        // 8. 검색 결과 UI 가시성 확인 (실제 Playwright API 사용)
        const containerVisible = await page.locator('.search-results-container').isVisible();
        const searchResultsVisible = await page.locator('#searchResults').isVisible();

        console.log('\n=== Playwright 가시성 테스트 ===');
        console.log(`검색 결과 컨테이너 표시: ${containerVisible}`);
        console.log(`검색 결과 DIV 표시: ${searchResultsVisible}`);

        // 9. 검색 결과 아이템 확인
        const resultItems = await page.locator('.search-result-item').count();
        console.log(`검색 결과 아이템 개수: ${resultItems}`);

        if (resultItems > 0) {
            const firstItemText = await page.locator('.search-result-item').first().textContent();
            console.log(`첫 번째 검색 결과: ${firstItemText}`);
        }

        // 10. 최종 스크린샷
        await page.screenshot({ path: 'test-search-fixed-3-final.png', fullPage: true });

        // 11. 테스트 결과 요약
        console.log('\n=== 📊 테스트 결과 요약 ===');
        console.log(`✅ SearchModeManager 존재: ${afterSearchState.searchModeManager.exists}`);
        console.log(`✅ 검색 결과 개수: ${afterSearchState.searchModeManager.searchResultsLength}`);
        console.log(`✅ 컨테이너 표시 (computed): ${afterSearchState.container.display}`);
        console.log(`✅ 컨테이너 표시 (Playwright): ${containerVisible}`);
        console.log(`✅ 검색 결과 표시 (Playwright): ${searchResultsVisible}`);
        console.log(`✅ 검색 결과 아이템: ${resultItems}개`);

        // 성공/실패 판정
        if (containerVisible && searchResultsVisible && resultItems > 0) {
            console.log('\n🎉 === 검색 기능이 정상적으로 작동합니다! ===');
        } else {
            console.log('\n❌ === 아직 문제가 있습니다 ===');
            if (!containerVisible) console.log('  - 검색 결과 컨테이너가 보이지 않음');
            if (!searchResultsVisible) console.log('  - 검색 결과 DIV가 보이지 않음');
            if (resultItems === 0) console.log('  - 검색 결과 아이템이 없음');
        }

        console.log('\n📸 스크린샷 파일:');
        console.log('  - test-search-fixed-1-initial.png (초기 화면)');
        console.log('  - test-search-fixed-2-after-search.png (검색 후)');
        console.log('  - test-search-fixed-3-final.png (최종)');

        // 테스트 통과 조건
        expect(afterSearchState.searchModeManager.exists).toBe(true);
        expect(containerVisible).toBe(true);
        expect(searchResultsVisible).toBe(true);
        expect(resultItems).toBeGreaterThan(0);
    });
});