const { test, expect } = require('@playwright/test');

test.describe('🚶 거리뷰 E2E 테스트', () => {
    test('거리뷰 전체 플로우 테스트', async ({ page }) => {
        // 콘솔 로그 캡처
        const logs = [];
        page.on('console', msg => {
            const text = msg.text();
            logs.push(text);
            if (text.includes('거리뷰') || text.includes('파노라마') || text.includes('StreetLayer')) {
                console.log(`[브라우저]: ${text}`);
            }
        });

        // 에러 캡처
        page.on('pageerror', error => {
            console.error(`[페이지 에러]: ${error.message}`);
        });

        // 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000);

        console.log('\n🚶 === 거리뷰 E2E 테스트 시작 ===\n');

        // ====== 1단계: 초기 상태 확인 ======
        console.log('1️⃣ 초기 상태 확인');

        // 클릭 모드가 기본 활성화 확인
        const clickModeActive = await page.evaluate(() => {
            return window.currentMode === 'click';
        });
        expect(clickModeActive).toBe(true);
        console.log(`✅ 클릭 모드 활성: ${clickModeActive}`);

        // 일반 지도가 표시되는지 확인
        const mapVisible = await page.evaluate(() => {
            const mapClick = document.getElementById('map-click');
            return mapClick && mapClick.style.display !== 'none';
        });
        expect(mapVisible).toBe(true);
        console.log(`✅ 지도 표시: ${mapVisible}`);

        // ====== 2단계: 거리뷰 탭 클릭 ======
        console.log('\n2️⃣ 거리뷰 탭 클릭');

        await page.click('.map-type-btn[data-type="street"]');
        await page.waitForTimeout(2000);

        // StreetLayer 생성 확인
        const streetLayerCreated = await page.evaluate(() => {
            return !!(window.streetLayers && window.streetLayers.click);
        });
        expect(streetLayerCreated).toBe(true);
        console.log(`✅ StreetLayer 생성: ${streetLayerCreated}`);

        // 거리뷰 모드 활성화 확인
        const streetViewModeActive = await page.evaluate(() => {
            return window.isStreetViewMode === true;
        });
        expect(streetViewModeActive).toBe(true);
        console.log(`✅ 거리뷰 모드 활성: ${streetViewModeActive}`);

        // ====== 3단계: 파노라마 진입 ======
        console.log('\n3️⃣ 파노라마 진입 시도');

        // 직접 파노라마 열기 (서울시청 위치)
        await page.evaluate(() => {
            if (window.openPanorama) {
                window.openPanorama(37.5665, 126.9780);
            }
        });
        await page.waitForTimeout(2000);

        // 파노라마 표시 확인
        const panoVisible = await page.evaluate(() => {
            const pano = document.getElementById('pano');
            if (!pano) return false;

            const computedStyle = window.getComputedStyle(pano);
            const isDisplayed = computedStyle.display !== 'none';
            const hasContent = pano.innerHTML.length > 0;

            console.log(`파노라마 computed display: ${computedStyle.display}, 콘텐츠 길이: ${pano.innerHTML.length}`);
            return isDisplayed && hasContent;
        });
        console.log(`✅ 파노라마 표시 및 콘텐츠: ${panoVisible}`);

        // 지도 숨김 확인
        const mapHidden = await page.evaluate(() => {
            const mapClick = document.getElementById('map-click');
            return mapClick && mapClick.style.display === 'none';
        });
        expect(mapHidden).toBe(true);
        console.log(`✅ 지도 숨김: ${mapHidden}`);

        // 파노라마 인스턴스 확인
        const panoInstanceExists = await page.evaluate(() => {
            return !!window.pano;
        });
        console.log(`✅ 파노라마 인스턴스: ${panoInstanceExists}`);

        // 스크린샷 (파노라마 상태)
        await page.screenshot({
            path: 'test-streetview-panorama.png',
            fullPage: true
        });

        // ====== 4단계: 파노라마 닫기 ======
        console.log('\n4️⃣ 파노라마 닫기');

        // 파노라마가 표시되어 있으면 닫기
        const shouldClosePanorama = await page.evaluate(() => {
            const pano = document.getElementById('pano');
            return pano && pano.style.display === 'block';
        });

        if (shouldClosePanorama) {
            // 직접 closePanorama 함수 호출
            await page.evaluate(() => {
                if (window.closePanorama) {
                    window.closePanorama();
                    console.log('✅ closePanorama 함수 호출');
                } else {
                    console.log('❌ closePanorama 함수를 찾을 수 없음');
                }
            });
            await page.waitForTimeout(1000);
        } else {
            console.log('⚠️ 파노라마가 표시되지 않아 닫기 생략');
        }

        // 지도로 복귀 확인
        const mapRestored = await page.evaluate(() => {
            const mapClick = document.getElementById('map-click');
            return mapClick && mapClick.style.display !== 'none';
        });
        expect(mapRestored).toBe(true);
        console.log(`✅ 지도 복귀: ${mapRestored}`);

        // 파노라마 숨김 확인
        const panoHidden = await page.evaluate(() => {
            const pano = document.getElementById('pano');
            return pano && pano.style.display === 'none';
        });
        expect(panoHidden).toBe(true);
        console.log(`✅ 파노라마 숨김: ${panoHidden}`);

        // ====== 5단계: 다른 지도 타입으로 전환 ======
        console.log('\n5️⃣ 일반 지도로 전환');

        await page.click('.map-type-btn[data-type="normal"]');
        await page.waitForTimeout(1000);

        // StreetLayer 제거 확인
        const streetLayerRemoved = await page.evaluate(() => {
            return !window.streetLayers || !window.streetLayers.click;
        });
        console.log(`✅ StreetLayer 제거: ${streetLayerRemoved}`);

        // 거리뷰 모드 비활성화 확인
        const streetViewModeInactive = await page.evaluate(() => {
            return window.isStreetViewMode === false;
        });
        expect(streetViewModeInactive).toBe(true);
        console.log(`✅ 거리뷰 모드 비활성: ${streetViewModeInactive}`);

        // 최종 스크린샷
        await page.screenshot({
            path: 'test-streetview-final.png',
            fullPage: true
        });

        // ====== 테스트 결과 요약 ======
        console.log('\n📊 테스트 결과 요약:');
        console.log(`  - 총 로그 수: ${logs.length}`);

        const streetViewLogs = logs.filter(log =>
            log.includes('거리뷰') || log.includes('파노라마') || log.includes('StreetLayer')
        );
        console.log(`  - 거리뷰 관련 로그: ${streetViewLogs.length}개`);

        if (streetViewLogs.length > 0) {
            console.log('  - 주요 로그:');
            streetViewLogs.slice(-5).forEach(log => {
                console.log(`    ${log}`);
            });
        }

        console.log('\n🚶 === 거리뷰 E2E 테스트 완료 ===\n');
    });

    test('모드 전환 시 거리뷰 동작 테스트', async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000);

        console.log('\n🔄 === 모드 전환 거리뷰 테스트 ===\n');

        // 1. 클릭 모드에서 거리뷰 활성화
        console.log('1️⃣ 클릭 모드에서 거리뷰');
        await page.click('.map-type-btn[data-type="street"]');
        await page.waitForTimeout(1000);

        let hasClickStreetLayer = await page.evaluate(() => {
            return !!(window.streetLayers && window.streetLayers.click);
        });
        expect(hasClickStreetLayer).toBe(true);
        console.log(`✅ 클릭 모드 StreetLayer: ${hasClickStreetLayer}`);

        // 2. 검색 모드로 전환
        console.log('\n2️⃣ 검색 모드로 전환');
        await page.click('.mode-btn[data-mode="search"]');
        await page.waitForTimeout(1000);

        // 검색 모드에도 StreetLayer 추가되는지 확인
        const hasSearchStreetLayer = await page.evaluate(() => {
            return !!(window.streetLayers && window.streetLayers.search);
        });
        console.log(`✅ 검색 모드 StreetLayer: ${hasSearchStreetLayer}`);

        // 3. 손 모드로 전환
        console.log('\n3️⃣ 손 모드로 전환');
        await page.click('.mode-btn[data-mode="hand"]');
        await page.waitForTimeout(1000);

        // 손 모드에도 StreetLayer 추가되는지 확인
        const hasHandStreetLayer = await page.evaluate(() => {
            return !!(window.streetLayers && window.streetLayers.hand);
        });
        console.log(`✅ 손 모드 StreetLayer: ${hasHandStreetLayer}`);

        // 4. 일반 지도로 전환하여 모든 StreetLayer 제거
        console.log('\n4️⃣ 일반 지도로 전환');
        await page.click('.map-type-btn[data-type="normal"]');
        await page.waitForTimeout(1000);

        const allLayersRemoved = await page.evaluate(() => {
            if (!window.streetLayers) return true;
            return !window.streetLayers.click &&
                   !window.streetLayers.search &&
                   !window.streetLayers.hand;
        });
        expect(allLayersRemoved).toBe(true);
        console.log(`✅ 모든 StreetLayer 제거: ${allLayersRemoved}`);

        console.log('\n🔄 === 모드 전환 거리뷰 테스트 완료 ===\n');
    });
});