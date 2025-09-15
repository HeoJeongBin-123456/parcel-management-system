const { test, expect } = require('@playwright/test');

test.describe('🔍 전체 검색 케이스 테스트', () => {
    // 테스트 케이스 정의
    const testCases = [
        {
            name: '지역명 검색',
            query: '종로구',
            expectedResult: true,
            description: '지역명(구 단위) 검색'
        },
        {
            name: '도로명 주소 검색',
            query: '소하로 162',
            expectedResult: true,
            description: '도로명과 번지 검색'
        },
        {
            name: '지번 주소 검색',
            query: '종로구 1-1',
            expectedResult: true,
            description: '구와 지번 조합 검색'
        },
        {
            name: '동 이름 검색',
            query: '삼성동',
            expectedResult: true,
            description: '동 단위 검색'
        },
        {
            name: '전체 주소 검색',
            query: '서울시 종로구 세종로 1-1',
            expectedResult: true,
            description: '시/구/도로명/번지 전체 주소'
        }
    ];

    test.beforeEach(async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            // SearchMode 관련 로그만 출력
            if (text.includes('SearchMode') || text.includes('검색')) {
                console.log(`[브라우저]: ${text}`);
            }
        });

        // 페이지 에러 캡처
        page.on('pageerror', error => {
            console.error('[페이지 에러]:', error.message);
        });

        // 페이지 로드
        await page.goto('http://localhost:4000');
        await page.waitForTimeout(3000);

        // 검색 모드로 전환
        await page.click('button[data-mode="search"]');
        await page.waitForTimeout(1000);
    });

    // 각 테스트 케이스를 개별 테스트로 실행
    testCases.forEach((testCase, index) => {
        test(`${index + 1}. ${testCase.name}: "${testCase.query}"`, async ({ page }) => {
            console.log(`\n🔍 === ${testCase.name} 테스트 시작 ===`);
            console.log(`설명: ${testCase.description}`);
            console.log(`검색어: "${testCase.query}"`);

            // 검색어 입력
            const searchInput = await page.locator('#searchInput');
            await searchInput.fill(testCase.query);

            // 엔터키로 검색 실행
            await searchInput.press('Enter');
            console.log('⏳ 검색 실행 중...');
            await page.waitForTimeout(3000); // API 응답 대기

            // 검색 결과 확인
            const searchResults = await page.evaluate(() => {
                const resultsDiv = document.getElementById('searchResults');
                const searchMgr = window.SearchModeManager;

                return {
                    // DOM 상태
                    dom: {
                        exists: !!resultsDiv,
                        hasChildren: resultsDiv ? resultsDiv.children.length > 0 : false,
                        childCount: resultsDiv ? resultsDiv.children.length : 0,
                        innerHTML: resultsDiv ? resultsDiv.innerHTML.substring(0, 200) : null,
                        hasNoResultsMessage: resultsDiv ? resultsDiv.innerHTML.includes('검색 결과가 없습니다') : false
                    },
                    // SearchModeManager 상태
                    manager: {
                        exists: !!searchMgr,
                        resultCount: searchMgr ? searchMgr.searchResults.length : 0,
                        currentQuery: searchMgr ? searchMgr.currentQuery : null,
                        isSearchActive: searchMgr ? searchMgr.isSearchActive : false,
                        parcelCount: searchMgr ? searchMgr.searchParcels.size : 0
                    }
                };
            });

            // UI 가시성 확인
            const containerVisible = await page.locator('.search-results-container').isVisible();
            const resultsVisible = await page.locator('#searchResults').isVisible();
            const resultItemCount = await page.locator('.search-result-item').count();

            // 스크린샷 저장
            await page.screenshot({
                path: `test-search-case-${index + 1}-${testCase.query.replace(/\s+/g, '-')}.png`,
                fullPage: true
            });

            // 결과 출력
            console.log('\n📊 검색 결과:');
            console.log(`  - DOM 존재: ${searchResults.dom.exists}`);
            console.log(`  - 검색 결과 개수: ${searchResults.manager.resultCount}`);
            console.log(`  - UI 아이템 개수: ${resultItemCount}`);
            console.log(`  - 폴리곤 개수: ${searchResults.manager.parcelCount}`);
            console.log(`  - 컨테이너 표시: ${containerVisible}`);
            console.log(`  - 결과 표시: ${resultsVisible}`);

            // 성공/실패 판정
            const hasResults = searchResults.manager.resultCount > 0 || resultItemCount > 0;

            if (hasResults) {
                console.log(`\n✅ ${testCase.name} 성공: ${searchResults.manager.resultCount}개 결과`);

                // 첫 번째 결과 내용 확인
                if (resultItemCount > 0) {
                    const firstResult = await page.locator('.search-result-item').first().textContent();
                    console.log(`  첫 번째 결과: ${firstResult.trim().replace(/\s+/g, ' ')}`);
                }
            } else {
                console.log(`\n❌ ${testCase.name} 실패: 검색 결과 없음`);

                // 실패 원인 분석
                if (searchResults.dom.hasNoResultsMessage) {
                    console.log('  원인: API가 결과를 반환하지 않음');
                } else if (!searchResults.manager.exists) {
                    console.log('  원인: SearchModeManager가 초기화되지 않음');
                } else if (!containerVisible) {
                    console.log('  원인: 검색 결과 컨테이너가 숨겨짐');
                } else {
                    console.log('  원인: 알 수 없음');
                }
            }

            // 테스트 어서션
            if (testCase.expectedResult) {
                expect(hasResults).toBe(true);
            }

            // 검색 입력 초기화
            await searchInput.clear();
            await page.waitForTimeout(500);
        });
    });

    // 전체 결과 요약
    test.afterAll(async () => {
        console.log('\n' + '='.repeat(50));
        console.log('📊 전체 검색 테스트 결과 요약');
        console.log('='.repeat(50));
        console.log('테스트한 검색 유형:');
        testCases.forEach((tc, i) => {
            console.log(`  ${i + 1}. ${tc.name}: "${tc.query}"`);
        });
        console.log('\n📸 스크린샷 파일:');
        testCases.forEach((tc, i) => {
            console.log(`  - test-search-case-${i + 1}-${tc.query.replace(/\s+/g, '-')}.png`);
        });
    });
});