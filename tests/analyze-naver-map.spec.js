const { test, expect } = require('@playwright/test');

test('네이버 지도 공식 웹사이트 분석', async ({ page }) => {
    console.log('=== 네이버 지도 공식 분석 시작 ===');

    // 1. 네이버 지도 접속
    await page.goto('https://map.naver.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);

    // 2. 지도 컨테이너 찾기
    const mapContainer = await page.locator('#app').first();

    // 3. 배경색 확인
    const bgColor = await mapContainer.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
    });
    console.log('📍 지도 컨테이너 배경색:', bgColor);

    // 4. 페이지 전체 스크린샷 (초기 상태)
    await page.screenshot({ path: '/tmp/naver-map-initial.png', fullPage: true });
    console.log('📸 초기 상태 스크린샷 저장');

    // 5. 지도 빠르게 드래그 (여러 방향)
    const mapElement = await page.locator('.map_wrap, #app').first();
    const box = await mapElement.boundingBox();

    if (box) {
        // 우→좌 드래그
        await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(500);

        // 하→상 드래그
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.7);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(500);
    }

    // 6. 드래그 후 스크린샷
    await page.screenshot({ path: '/tmp/naver-map-after-drag.png', fullPage: true });
    console.log('📸 드래그 후 스크린샷 저장');

    // 7. 개발자 도구로 네이버 지도 옵션 추출
    const naverMapOptions = await page.evaluate(() => {
        // naver.maps.Map 인스턴스 찾기
        const results = {};

        // 모든 전역 변수 검색
        for (let key in window) {
            try {
                const obj = window[key];
                if (obj && typeof obj === 'object') {
                    // naver.maps.Map 인스턴스인지 확인
                    if (obj.constructor && obj.constructor.name === 'Map') {
                        // 옵션 추출 시도
                        if (obj.getOptions) {
                            results.options = obj.getOptions();
                        }
                        // 기타 설정 확인
                        results.zoom = obj.getZoom ? obj.getZoom() : null;
                        results.mapTypeId = obj.getMapTypeId ? obj.getMapTypeId() : null;
                    }
                }
            } catch (e) {}
        }

        // CSS 설정 확인
        const mapEl = document.querySelector('.map_wrap, #app, [class*="map"]');
        if (mapEl) {
            const styles = window.getComputedStyle(mapEl);
            results.css = {
                backgroundColor: styles.backgroundColor,
                transform: styles.transform,
                willChange: styles.willChange,
                backfaceVisibility: styles.backfaceVisibility
            };
        }

        return results;
    });

    console.log('⚙️  네이버 지도 설정:', JSON.stringify(naverMapOptions, null, 2));

    // 8. 네트워크 요청 분석 (타일 로딩 패턴)
    const tileRequests = [];
    page.on('request', request => {
        if (request.url().includes('naver') && request.url().includes('tile')) {
            tileRequests.push(request.url());
        }
    });

    // 한번 더 드래그해서 타일 요청 캡처
    if (box) {
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 10 });
        await page.mouse.up();
    }

    await page.waitForTimeout(1000);
    console.log(`🌐 타일 요청 수: ${tileRequests.length}개`);
    if (tileRequests.length > 0) {
        console.log('🌐 타일 요청 예시:', tileRequests[0]);
    }

    console.log('=== 분석 완료 ===');
});