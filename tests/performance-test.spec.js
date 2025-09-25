const { test, expect } = require('@playwright/test');

test.describe('성능 최적화 테스트', () => {
    test.setTimeout(60000); // 60초 타임아웃

    test('페이지 로딩 및 초기화 성능', async ({ page }) => {
        // 콘솔 로그 캡처
        const consoleLogs = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push({
                type: msg.type(),
                text: text,
                time: Date.now()
            });
        });

        // 성능 측정 시작
        const startTime = Date.now();

        // 페이지 로드
        await page.goto('http://localhost:3000', {
            waitUntil: 'networkidle'
        });

        // 네이버 지도 API 로드 대기
        await page.waitForFunction(() => {
            return window.naver && window.naver.maps;
        }, { timeout: 10000 });

        // 지도 인스턴스 생성 대기
        await page.waitForFunction(() => {
            return window.mapClick || window.map;
        }, { timeout: 10000 });

        const loadTime = Date.now() - startTime;
        console.log(`✅ 페이지 로딩 시간: ${loadTime}ms`);

        // loadSavedClickModeParcels 호출 횟수 확인
        const loadCallCount = consoleLogs.filter(log =>
            log.text.includes('loadSavedClickModeParcels') ||
            log.text.includes('필지 복원 완료')
        ).length;

        console.log(`📊 loadSavedClickModeParcels 호출 횟수: ${loadCallCount}`);

        // 중복 호출이 없어야 함 (1회만 호출)
        expect(loadCallCount).toBeLessThanOrEqual(1);

        // 스크린샷 캡처
        await page.screenshot({
            path: 'test-initial-load.png',
            fullPage: true
        });

        // 성능 기준 체크
        expect(loadTime).toBeLessThan(10000); // 10초 이내 로드
    });

    test('색상 적용 응답 속도', async ({ page }) => {
        await page.goto('http://localhost:3000', {
            waitUntil: 'networkidle'
        });

        // 지도 로드 대기
        await page.waitForFunction(() => {
            return window.naver && window.naver.maps && (window.mapClick || window.map);
        }, { timeout: 10000 });

        // 클릭 모드 확인
        await page.click('button[data-mode="click"]');
        await page.waitForTimeout(500);

        // 지도 클릭하여 필지 선택
        const mapElement = await page.locator('#map, #map-click').first();
        await mapElement.click({ position: { x: 400, y: 300 } });
        await page.waitForTimeout(1000);

        // 색상 팔레트에서 빨간색 선택
        const colorStartTime = Date.now();

        // 색상 버튼 클릭
        const redButton = await page.locator('.color-btn[data-index="0"], .color-button').first();
        if (await redButton.isVisible()) {
            await redButton.click();

            // 색상 적용 시간 측정
            const colorApplyTime = Date.now() - colorStartTime;
            console.log(`🎨 색상 적용 시간: ${colorApplyTime}ms`);

            // 100ms 이내에 적용되어야 함 (Optimistic UI)
            expect(colorApplyTime).toBeLessThan(100);
        }

        // 스크린샷 캡처
        await page.screenshot({
            path: 'test-color-applied.png',
            fullPage: true
        });
    });

    test('지도 이동 성능 및 부드러움', async ({ page }) => {
        await page.goto('http://localhost:3000', {
            waitUntil: 'networkidle'
        });

        // 지도 로드 대기
        await page.waitForFunction(() => {
            return window.naver && window.naver.maps && (window.mapClick || window.map);
        }, { timeout: 10000 });

        const mapElement = await page.locator('#map, #map-click').first();

        // 지도 드래그 테스트
        const dragStartTime = Date.now();

        // 5번 드래그 수행
        for (let i = 0; i < 5; i++) {
            await mapElement.dragTo(mapElement, {
                sourcePosition: { x: 400, y: 300 },
                targetPosition: { x: 200, y: 200 }
            });
            await page.waitForTimeout(200);
        }

        const dragTime = Date.now() - dragStartTime;
        console.log(`🗺️ 지도 드래그 총 시간: ${dragTime}ms`);

        // 부드러운 이동을 위해 2초 이내여야 함
        expect(dragTime).toBeLessThan(2000);

        // 최종 스크린샷
        await page.screenshot({
            path: 'test-map-dragged.png',
            fullPage: true
        });
    });

    test('콘솔 로그 감소 확인', async ({ page }) => {
        const consoleLogs = [];
        page.on('console', msg => {
            consoleLogs.push(msg.text());
        });

        await page.goto('http://localhost:3000', {
            waitUntil: 'networkidle'
        });

        // 10초 동안 로그 수집
        await page.waitForTimeout(10000);

        const totalLogs = consoleLogs.length;
        const debugLogs = consoleLogs.filter(log =>
            log.includes('DEBUG') ||
            log.includes('마커 조건') ||
            log.includes('필지 확인 중')
        ).length;

        console.log(`📝 총 콘솔 로그: ${totalLogs}개`);
        console.log(`🐛 디버그 로그: ${debugLogs}개`);

        // 과도한 로그가 없어야 함
        expect(totalLogs).toBeLessThan(100);
        expect(debugLogs).toBeLessThan(10);
    });
});

console.log('🚀 성능 테스트 시작...');
console.log('💡 Tip: npx playwright test tests/performance-test.spec.js --headed 로 브라우저를 보면서 테스트할 수 있습니다.');