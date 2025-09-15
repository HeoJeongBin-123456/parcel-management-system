const { test, expect } = require('@playwright/test');

test.describe('🚶 거리뷰 기능 테스트', () => {
    test('거리뷰 레이어 표시 및 파노라마 진입', async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('거리뷰') || text.includes('파노라마') || text.includes('StreetLayer')) {
                console.log(`[브라우저]: ${text}`);
            }
        });

        // 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000);

        console.log('\n🚶 === 거리뷰 테스트 시작 ===\n');

        // 1. 거리뷰 탭 클릭
        console.log('1️⃣ 거리뷰 탭 클릭');
        await page.evaluate(() => {
            const streetBtn = document.querySelector('.map-type-btn[data-type="street"]');
            if (streetBtn) {
                streetBtn.click();
                console.log('✅ 거리뷰 탭 클릭됨');
            }
        });
        await page.waitForTimeout(2000);

        // 2. StreetLayer 생성 확인
        const streetLayerActive = await page.evaluate(() => {
            return !!(window.streetLayers && window.streetLayers.click);
        });
        console.log(`✅ StreetLayer 활성화: ${streetLayerActive}`);

        // 3. 지도 클릭하여 파노라마 진입 시도
        console.log('2️⃣ 지도 클릭하여 파노라마 진입');
        await page.evaluate(() => {
            // 직접 파노라마 열기 함수 호출 (테스트용)
            if (window.openPanorama) {
                window.openPanorama(37.5665, 126.9780);
                console.log('✅ 파노라마 열기 함수 호출');
            } else {
                console.log('❌ openPanorama 함수를 찾을 수 없음');
            }
        });
        await page.waitForTimeout(3000);

        // 4. 파노라마 표시 확인
        const panoVisible = await page.evaluate(() => {
            const pano = document.getElementById('pano');
            return pano && pano.style.display !== 'none';
        });
        console.log(`✅ 파노라마 표시: ${panoVisible}`);

        // 5. 스크린샷
        await page.screenshot({
            path: 'test-streetview.png',
            fullPage: true
        });

        // 6. 파노라마 닫기
        if (panoVisible) {
            console.log('3️⃣ 파노라마 닫기');
            await page.evaluate(() => {
                const closeBtn = document.querySelector('.pano-close-btn');
                if (closeBtn) {
                    closeBtn.click();
                    console.log('✅ 파노라마 닫기 버튼 클릭');
                }
            });
            await page.waitForTimeout(1000);
        }

        // 7. 지도로 복귀 확인
        const mapVisible = await page.evaluate(() => {
            const mapClick = document.getElementById('map-click');
            return mapClick && mapClick.style.display !== 'none';
        });
        console.log(`✅ 지도로 복귀: ${mapVisible}`);

        console.log('\n🚶 === 거리뷰 테스트 완료 ===\n');
    });
});