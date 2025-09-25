const { test, expect } = require('@playwright/test');

test.describe('완전한 E2E 성능 최적화 테스트', () => {
    test.setTimeout(120000); // 2분 타임아웃

    let page;
    let performanceMetrics = {
        loginTime: 0,
        mapLoadTime: 0,
        parcelClickTime: 0,
        colorApplyTime: 0,
        mapDragTime: 0,
        totalConsoleLogs: 0,
        debugLogs: 0,
        duplicateCalls: 0
    };

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();

        // 콘솔 로그 모니터링
        const consoleLogs = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push({
                type: msg.type(),
                text: text,
                time: Date.now()
            });

            // 특정 패턴 감지
            if (text.includes('loadSavedClickModeParcels')) {
                performanceMetrics.duplicateCalls++;
            }
            if (text.includes('DEBUG') || text.includes('마커 조건') || text.includes('필지 확인 중')) {
                performanceMetrics.debugLogs++;
            }
        });

        // 에러 캡처
        page.on('pageerror', error => {
            console.error('❌ 페이지 에러:', error);
        });

        performanceMetrics.totalConsoleLogs = consoleLogs.length;
    });

    test('1. 로그인 및 지도 초기 로딩 성능', async () => {
        console.log('🔐 로그인 시작...');
        const startTime = Date.now();

        // 페이지 로드
        await page.goto('http://localhost:3000');

        // 비밀번호 입력 필드 대기
        await page.waitForSelector('#password-input, input[type="password"]', { timeout: 10000 });

        // 비밀번호 입력
        const passwordInput = await page.locator('#password-input, input[type="password"]').first();
        await passwordInput.fill('123456');

        // 로그인 버튼 클릭
        const loginButton = await page.locator('button:has-text("로그인"), button:has-text("확인"), button#login-btn').first();
        await loginButton.click();

        performanceMetrics.loginTime = Date.now() - startTime;
        console.log(`✅ 로그인 완료: ${performanceMetrics.loginTime}ms`);

        // 지도 로드 대기
        const mapStartTime = Date.now();

        // 네이버 지도 API 로드 확인
        await page.waitForFunction(() => {
            return window.naver && window.naver.maps;
        }, { timeout: 30000 });

        // 지도 인스턴스 생성 확인
        await page.waitForFunction(() => {
            return window.mapClick || window.mapSearch || window.mapHand || window.map;
        }, { timeout: 30000 });

        // UI 요소 로드 확인
        await page.waitForSelector('.map-container, #map-click, #map', { timeout: 30000 });

        performanceMetrics.mapLoadTime = Date.now() - mapStartTime;
        console.log(`🗺️ 지도 로드 시간: ${performanceMetrics.mapLoadTime}ms`);

        // 스크린샷 캡처
        await page.screenshot({
            path: 'test-map-loaded.png',
            fullPage: true
        });

        // 성능 기준 체크
        expect(performanceMetrics.mapLoadTime).toBeLessThan(15000); // 15초 이내
    });

    test('2. 필지 클릭 및 색상 적용 속도', async () => {
        console.log('🎯 필지 클릭 테스트 시작...');

        // 로그인 과정
        await page.goto('http://localhost:3000');
        await page.waitForSelector('#password-input, input[type="password"]');
        await page.fill('#password-input, input[type="password"]', '123456');
        await page.click('button:has-text("로그인"), button:has-text("확인"), button#login-btn');

        // 지도 로드 대기
        await page.waitForFunction(() => window.naver && window.naver.maps, { timeout: 30000 });
        await page.waitForSelector('.map-container, #map-click, #map', { timeout: 30000 });
        await page.waitForTimeout(2000); // 지도 완전 로드 대기

        // 클릭 모드 확인/선택
        const clickModeButton = await page.locator('button[data-mode="click"], button:has-text("클릭")').first();
        if (await clickModeButton.isVisible()) {
            await clickModeButton.click();
            await page.waitForTimeout(500);
        }

        // 지도 클릭하여 필지 선택
        const clickStartTime = Date.now();
        const mapElement = await page.locator('#map-click, #map, .map-container').first();

        // 지도 중앙 클릭
        const box = await mapElement.boundingBox();
        if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            performanceMetrics.parcelClickTime = Date.now() - clickStartTime;
            console.log(`📍 필지 클릭 응답 시간: ${performanceMetrics.parcelClickTime}ms`);

            // API 응답 대기
            await page.waitForTimeout(2000);

            // 필지 정보 창 확인
            const parcelInfo = await page.locator('.parcel-info, #parcelInfo, .info-panel').first();
            if (await parcelInfo.isVisible()) {
                console.log('✅ 필지 정보 표시됨');

                // 색상 팔레트 찾기
                const colorStartTime = Date.now();
                const colorButton = await page.locator('.color-btn[data-index="0"], .color-button, .palette-color').first();

                if (await colorButton.isVisible()) {
                    await colorButton.click();
                    performanceMetrics.colorApplyTime = Date.now() - colorStartTime;
                    console.log(`🎨 색상 적용 시간: ${performanceMetrics.colorApplyTime}ms`);

                    // Optimistic UI 검증 - 즉시 적용되어야 함
                    expect(performanceMetrics.colorApplyTime).toBeLessThan(200);
                }
            }
        }

        // 스크린샷 캡처
        await page.screenshot({
            path: 'test-parcel-colored.png',
            fullPage: true
        });
    });

    test('3. 지도 이동 부드러움 테스트', async () => {
        console.log('🔄 지도 드래그 성능 테스트...');

        // 로그인 과정
        await page.goto('http://localhost:3000');
        await page.waitForSelector('#password-input, input[type="password"]');
        await page.fill('#password-input, input[type="password"]', '123456');
        await page.click('button:has-text("로그인"), button:has-text("확인"), button#login-btn');

        // 지도 로드 대기
        await page.waitForFunction(() => window.naver && window.naver.maps, { timeout: 30000 });
        await page.waitForSelector('.map-container, #map-click, #map', { timeout: 30000 });
        await page.waitForTimeout(2000);

        const mapElement = await page.locator('#map-click, #map, .map-container').first();
        const box = await mapElement.boundingBox();

        if (box) {
            const dragStartTime = Date.now();

            // 5번 드래그 수행
            for (let i = 0; i < 5; i++) {
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await page.mouse.down();
                await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4, { steps: 10 });
                await page.mouse.up();
                await page.waitForTimeout(300);
            }

            performanceMetrics.mapDragTime = Date.now() - dragStartTime;
            console.log(`🌊 지도 드래그 총 시간: ${performanceMetrics.mapDragTime}ms`);

            // 부드러운 드래그를 위해 3초 이내여야 함
            expect(performanceMetrics.mapDragTime).toBeLessThan(3000);
        }

        // 스크린샷 캡처
        await page.screenshot({
            path: 'test-map-dragged.png',
            fullPage: true
        });
    });

    test('4. 콘솔 로그 및 중복 호출 검증', async () => {
        console.log('📊 로그 분석 시작...');

        const consoleLogs = [];
        let loadCallCount = 0;

        // 새 페이지로 로그 수집
        const context = await page.context();
        const newPage = await context.newPage();

        newPage.on('console', msg => {
            const text = msg.text();
            consoleLogs.push(text);

            if (text.includes('loadSavedClickModeParcels') || text.includes('필지 복원')) {
                loadCallCount++;
            }
        });

        // 로그인 및 지도 로드
        await newPage.goto('http://localhost:3000');
        await newPage.waitForSelector('#password-input, input[type="password"]');
        await newPage.fill('#password-input, input[type="password"]', '123456');
        await newPage.click('button:has-text("로그인"), button:has-text("확인"), button#login-btn');

        // 지도 로드 대기
        await newPage.waitForFunction(() => window.naver && window.naver.maps, { timeout: 30000 });
        await newPage.waitForTimeout(5000); // 로그 수집 대기

        const totalLogs = consoleLogs.length;
        const debugLogs = consoleLogs.filter(log =>
            log.includes('DEBUG') ||
            log.includes('마커 조건') ||
            log.includes('필지 확인 중')
        ).length;

        console.log(`📝 총 콘솔 로그: ${totalLogs}개`);
        console.log(`🐛 디버그 로그: ${debugLogs}개`);
        console.log(`🔄 loadSavedClickModeParcels 호출: ${loadCallCount}번`);

        // 검증
        expect(loadCallCount).toBeLessThanOrEqual(1); // 1번만 호출
        expect(debugLogs).toBeLessThan(5); // 디버그 로그 최소화
        expect(totalLogs).toBeLessThan(150); // 전체 로그 감소

        await newPage.close();
    });

    test.afterAll(async () => {
        console.log('\n========================================');
        console.log('📊 성능 테스트 최종 결과');
        console.log('========================================');
        console.log(`🔐 로그인 시간: ${performanceMetrics.loginTime}ms`);
        console.log(`🗺️ 지도 로드 시간: ${performanceMetrics.mapLoadTime}ms`);
        console.log(`📍 필지 클릭 응답: ${performanceMetrics.parcelClickTime}ms`);
        console.log(`🎨 색상 적용 시간: ${performanceMetrics.colorApplyTime}ms`);
        console.log(`🌊 지도 드래그 시간: ${performanceMetrics.mapDragTime}ms`);
        console.log('========================================');

        // 최적화 성공 여부 판단
        const isOptimized =
            performanceMetrics.mapLoadTime < 15000 &&
            performanceMetrics.colorApplyTime < 200 &&
            performanceMetrics.mapDragTime < 3000;

        if (isOptimized) {
            console.log('✅ 성능 최적화 확인됨!');
        } else {
            console.log('⚠️ 추가 최적화 필요');
        }
    });
});

console.log('🚀 완전한 E2E 성능 테스트 준비 완료');
console.log('💡 실행: npx playwright test tests/e2e-performance-test.spec.js --headed');