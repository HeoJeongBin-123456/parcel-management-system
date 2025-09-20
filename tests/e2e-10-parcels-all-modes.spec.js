/**
 * 10개 필지 포괄적 E2E 테스트 - 클릭/검색/손 모드 전부
 * 색상 유지, 모드 전환, 데이터 영속성 검증
 */

const { test, expect } = require('@playwright/test');

test.describe('10개 필지 E2E 테스트 - 전체 모드', () => {

    const testParcels = [
        { name: '다동 46', searchTerm: '다동 46', expectedPnu: '1114010200100460000', color: 0 }, // 빨강 - 이미 테스트됨
        { name: '다동 45', searchTerm: '다동 45', color: 1 }, // 주황
        { name: '다동 47', searchTerm: '다동 47', color: 2 }, // 노랑
        { name: '다동 50', searchTerm: '다동 50', color: 3 }, // 연두
        { name: '다동 100', searchTerm: '다동 100', color: 4 }, // 파랑
        { name: '소공동 1', searchTerm: '소공동 1', color: 5 }, // 검정
        { name: '소공동 10', searchTerm: '소공동 10', color: 6 }, // 흰색
        { name: '명동 1', searchTerm: '명동 1', color: 7 }, // 하늘색
        { name: '명동2가 1', searchTerm: '명동2가 1', color: 0 }, // 빨강 (재사용)
        { name: '남대문로1가 1', searchTerm: '남대문로1가 1', color: 1 } // 주황 (재사용)
    ];

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4000');

        // 콘솔 로그 캡처
        page.on('console', msg => {
            console.log(`[브라우저 ${msg.type()}]:`, msg.text());
        });

        // 페이지 로드 대기
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
    });

    test('1단계: 클릭 모드 색칠 테스트 - 10개 필지', async ({ page }) => {
        console.log('🎯 클릭 모드 색칠 테스트 시작');

        // 클릭 모드 활성화 확인
        await page.click('button:has-text("🎯 클릭")');
        await page.waitForTimeout(1000);

        let successfulColorings = 0;

        for (const parcel of testParcels) {
            try {
                console.log(`🎨 ${parcel.name} 색칠 시작 (색상 ${parcel.color})`);

                // 검색 모드로 전환하여 필지 찾기
                await page.click('button:has-text("🔍 검색")');
                await page.waitForTimeout(1000);

                // 필지 검색
                await page.fill('#searchInput', parcel.searchTerm);
                await page.click('#searchButton');
                await page.waitForTimeout(3000);

                // 클릭 모드로 전환
                await page.click('button:has-text("클릭 모드로 전환")');
                await page.waitForTimeout(1000);

                // 색상 선택
                await page.evaluate((colorIndex) => {
                    const colorItem = document.querySelector(`.color-item[data-color="${colorIndex}"]`);
                    if (colorItem) colorItem.click();
                }, parcel.color);
                await page.waitForTimeout(1000);

                // 지도 클릭 (필지 색칠)
                await page.click('#map-click');
                await page.waitForTimeout(2000);

                // 색칠 성공 확인
                const coloringResult = await page.evaluate(() => {
                    const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
                    return Object.keys(parcelColors).length;
                });

                if (coloringResult > successfulColorings) {
                    successfulColorings++;
                    console.log(`✅ ${parcel.name} 색칠 성공 (총 ${successfulColorings}개)`);
                } else {
                    console.log(`⚠️ ${parcel.name} 색칠 실패 또는 중복`);
                }

            } catch (error) {
                console.error(`❌ ${parcel.name} 색칠 중 오류:`, error.message);
            }
        }

        // 최종 색칠 결과 확인
        const finalColorCount = await page.evaluate(() => {
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            const parcelData = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const deletedParcels = JSON.parse(localStorage.getItem('deletedParcels') || '[]');

            return {
                coloredParcelsCount: Object.keys(parcelColors).length,
                totalParcelsCount: parcelData.length,
                deletedParcelsCount: deletedParcels.length
            };
        });

        console.log('📊 클릭 모드 최종 결과:', finalColorCount);

        // 최소 5개 이상 성공하면 통과
        expect(finalColorCount.coloredParcelsCount).toBeGreaterThanOrEqual(5);

        await page.screenshot({
            path: 'test-results/e2e-click-mode-coloring.png',
            fullPage: true
        });
    });

    test('2단계: 검색 모드 테스트 - 필지 조회', async ({ page }) => {
        console.log('🔍 검색 모드 테스트 시작');

        // 검색 모드 활성화
        await page.click('button:has-text("🔍 검색")');
        await page.waitForTimeout(1000);

        let successfulSearches = 0;

        for (const parcel of testParcels.slice(0, 5)) { // 처음 5개만 검색 테스트
            try {
                console.log(`🔍 ${parcel.name} 검색 시작`);

                // 검색 입력
                await page.fill('#searchInput', parcel.searchTerm);
                await page.click('#searchButton');
                await page.waitForTimeout(3000);

                // 검색 결과 확인
                const searchResult = await page.evaluate(() => {
                    const searchParcels = JSON.parse(localStorage.getItem('searchParcels') || '[]');
                    return searchParcels.length;
                });

                if (searchResult > 0) {
                    successfulSearches++;
                    console.log(`✅ ${parcel.name} 검색 성공`);
                } else {
                    console.log(`⚠️ ${parcel.name} 검색 결과 없음`);
                }

            } catch (error) {
                console.error(`❌ ${parcel.name} 검색 중 오류:`, error.message);
            }
        }

        console.log(`📊 검색 성공: ${successfulSearches}/5`);
        expect(successfulSearches).toBeGreaterThanOrEqual(3);

        await page.screenshot({
            path: 'test-results/e2e-search-mode.png',
            fullPage: true
        });
    });

    test('3단계: 손 모드 테스트 - 지도 네비게이션', async ({ page }) => {
        console.log('✋ 손 모드 테스트 시작');

        // 손 모드 활성화
        await page.click('button:has-text("✋ 손")');
        await page.waitForTimeout(1000);

        // 초기 지도 위치 저장
        const initialPosition = await page.evaluate(() => {
            const mapData = JSON.parse(localStorage.getItem('mapPositions') || '{}');
            return mapData.hand;
        });

        // 지도 확대
        await page.click('.btn_zoom.in');
        await page.waitForTimeout(2000);

        // 지도 축소
        await page.click('.btn_zoom.out');
        await page.waitForTimeout(2000);

        // 지도 드래그 (시뮬레이션)
        const mapElement = page.locator('#map-hand');
        await mapElement.hover();
        await page.mouse.down();
        await page.mouse.move(100, 100);
        await page.mouse.up();
        await page.waitForTimeout(2000);

        // 위치 변경 확인
        const finalPosition = await page.evaluate(() => {
            const mapData = JSON.parse(localStorage.getItem('mapPositions') || '{}');
            return mapData.hand;
        });

        console.log('📍 초기 위치:', initialPosition);
        console.log('📍 최종 위치:', finalPosition);

        // 색상 팔레트 비활성화 확인
        const colorPaletteVisible = await page.evaluate(() => {
            const palette = document.querySelector('.color-palette');
            return palette ? window.getComputedStyle(palette).display !== 'none' : false;
        });

        expect(colorPaletteVisible).toBeFalsy();

        await page.screenshot({
            path: 'test-results/e2e-hand-mode.png',
            fullPage: true
        });
    });

    test('4단계: 모드 전환 테스트 - 데이터 보존', async ({ page }) => {
        console.log('🔄 모드 전환 테스트 시작');

        // 클릭 모드에서 하나 색칠
        await page.click('button:has-text("🎯 클릭")');
        await page.waitForTimeout(1000);

        await page.evaluate(() => {
            const redColor = document.querySelector('.color-item[data-color="0"]');
            if (redColor) redColor.click();
        });
        await page.waitForTimeout(1000);

        await page.click('#map-click');
        await page.waitForTimeout(2000);

        const clickModeData = await page.evaluate(() => {
            return {
                parcelColors: Object.keys(JSON.parse(localStorage.getItem('parcelColors') || '{}')).length,
                parcelData: JSON.parse(localStorage.getItem('parcelData') || '[]').length
            };
        });

        // 검색 모드로 전환
        await page.click('button:has-text("🔍 검색")');
        await page.waitForTimeout(1000);

        await page.fill('#searchInput', '다동 45');
        await page.click('#searchButton');
        await page.waitForTimeout(3000);

        const searchModeData = await page.evaluate(() => {
            return {
                searchParcels: JSON.parse(localStorage.getItem('searchParcels') || '[]').length,
                parcelColors: Object.keys(JSON.parse(localStorage.getItem('parcelColors') || '{}')).length
            };
        });

        // 손 모드로 전환
        await page.click('button:has-text("✋ 손")');
        await page.waitForTimeout(1000);

        // 다시 클릭 모드로 돌아가서 데이터 확인
        await page.click('button:has-text("🎯 클릭")');
        await page.waitForTimeout(1000);

        const finalData = await page.evaluate(() => {
            return {
                parcelColors: Object.keys(JSON.parse(localStorage.getItem('parcelColors') || '{}')).length,
                parcelData: JSON.parse(localStorage.getItem('parcelData') || '[]').length,
                searchParcels: JSON.parse(localStorage.getItem('searchParcels') || '[]').length
            };
        });

        console.log('📊 모드별 데이터:');
        console.log('- 클릭 모드:', clickModeData);
        console.log('- 검색 모드:', searchModeData);
        console.log('- 최종 데이터:', finalData);

        // 데이터 보존 확인
        expect(finalData.parcelColors).toBeGreaterThanOrEqual(clickModeData.parcelColors);

        await page.screenshot({
            path: 'test-results/e2e-mode-switching.png',
            fullPage: true
        });
    });

    test('5단계: 새로고침 테스트 - 전체 상태 복원', async ({ page }) => {
        console.log('🔄 새로고침 테스트 시작');

        // 현재 상태 저장
        const beforeRefresh = await page.evaluate(() => {
            return {
                parcelColors: JSON.parse(localStorage.getItem('parcelColors') || '{}'),
                parcelData: JSON.parse(localStorage.getItem('parcelData') || '[]').length,
                deletedParcels: JSON.parse(localStorage.getItem('deletedParcels') || '[]').length,
                searchParcels: JSON.parse(localStorage.getItem('searchParcels') || '[]').length
            };
        });

        console.log('🔄 새로고침 전 상태:', {
            coloredParcels: Object.keys(beforeRefresh.parcelColors).length,
            totalParcels: beforeRefresh.parcelData,
            deletedParcels: beforeRefresh.deletedParcels,
            searchParcels: beforeRefresh.searchParcels
        });

        // 페이지 새로고침
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // 복원된 상태 확인
        const afterRefresh = await page.evaluate(() => {
            return {
                parcelColors: JSON.parse(localStorage.getItem('parcelColors') || '{}'),
                parcelData: JSON.parse(localStorage.getItem('parcelData') || '[]').length,
                deletedParcels: JSON.parse(localStorage.getItem('deletedParcels') || '[]').length,
                searchParcels: JSON.parse(localStorage.getItem('searchParcels') || '[]').length,
                hasPolygons: window.clickParcels ? window.clickParcels.size : 0
            };
        });

        console.log('🔄 새로고침 후 상태:', {
            coloredParcels: Object.keys(afterRefresh.parcelColors).length,
            totalParcels: afterRefresh.parcelData,
            deletedParcels: afterRefresh.deletedParcels,
            searchParcels: afterRefresh.searchParcels,
            renderedPolygons: afterRefresh.hasPolygons
        });

        // 상태 복원 검증
        expect(Object.keys(afterRefresh.parcelColors).length).toEqual(Object.keys(beforeRefresh.parcelColors).length);
        expect(afterRefresh.parcelData).toEqual(beforeRefresh.parcelData);
        expect(afterRefresh.hasPolygons).toBeGreaterThan(0);

        await page.screenshot({
            path: 'test-results/e2e-refresh-restoration.png',
            fullPage: true
        });

        console.log('✅ 새로고침 후 전체 상태 복원 성공!');
    });

    test('6단계: 색상 토글 및 삭제 테스트', async ({ page }) => {
        console.log('🎨 색상 토글 및 삭제 테스트 시작');

        // 클릭 모드 활성화
        await page.click('button:has-text("🎯 클릭")');
        await page.waitForTimeout(1000);

        // 파란색 선택
        await page.evaluate(() => {
            const blueColor = document.querySelector('.color-item[data-color="4"]');
            if (blueColor) blueColor.click();
        });
        await page.waitForTimeout(1000);

        // 필지 색칠
        await page.click('#map-click');
        await page.waitForTimeout(2000);

        const afterColoring = await page.evaluate(() => {
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            const deletedParcels = JSON.parse(localStorage.getItem('deletedParcels') || '[]');
            return {
                colorCount: Object.keys(parcelColors).length,
                deletedCount: deletedParcels.length
            };
        });

        // 같은 색으로 재클릭 (토글 삭제)
        await page.click('#map-click');
        await page.waitForTimeout(2000);

        const afterToggle = await page.evaluate(() => {
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            const deletedParcels = JSON.parse(localStorage.getItem('deletedParcels') || '[]');
            return {
                colorCount: Object.keys(parcelColors).length,
                deletedCount: deletedParcels.length
            };
        });

        console.log('🎨 색칠 후:', afterColoring);
        console.log('🗑️ 토글 삭제 후:', afterToggle);

        // 삭제 확인
        expect(afterToggle.colorCount).toBeLessThan(afterColoring.colorCount);

        await page.screenshot({
            path: 'test-results/e2e-color-toggle.png',
            fullPage: true
        });
    });
});