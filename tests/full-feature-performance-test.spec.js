const { test, expect } = require('@playwright/test');

test.describe('🚀 전체 기능 성능 테스트', () => {
    test.setTimeout(180000); // 3분 타임아웃

    test('완전한 기능 및 성능 검증', async ({ page }) => {
        const performanceData = {
            colors: [],
            mapTypes: [],
            searchTime: 0,
            consoleLogs: 0
        };

        // 콘솔 로그 모니터링
        const consoleLogs = [];
        page.on('console', msg => {
            consoleLogs.push({
                type: msg.type(),
                text: msg.text(),
                time: Date.now()
            });
        });

        console.log('=====================================');
        console.log('🚀 전체 기능 성능 테스트 시작');
        console.log('=====================================\n');

        // =============================
        // 1단계: 로그인
        // =============================
        console.log('【1단계】 로그인');
        const loginStart = Date.now();
        await page.goto('http://localhost:3000');
        await page.waitForSelector('#password-input, input[type="password"]', { timeout: 10000 });
        await page.fill('#password-input, input[type="password"]', '123456');
        await page.click('button:has-text("로그인"), button:has-text("확인"), button#login-btn');

        // 지도 로드 대기
        await page.waitForFunction(() => window.naver && window.naver.maps, { timeout: 30000 });
        await page.waitForSelector('.map-container, #map-click, #map', { timeout: 30000 });
        const loginTime = Date.now() - loginStart;
        console.log(`✅ 로그인 및 지도 로드 완료: ${loginTime}ms\n`);

        await page.waitForTimeout(2000); // 안정화 대기

        // =============================
        // 2단계: 8개 색상 모두 테스트
        // =============================
        console.log('【2단계】 8개 색상 팔레트 테스트');

        // 클릭 모드 선택
        const clickMode = await page.locator('button[data-mode="click"], button:has-text("클릭")').first();
        if (await clickMode.isVisible()) {
            await clickMode.click();
            await page.waitForTimeout(500);
        }

        const colors = [
            { index: 0, name: '빨강', hex: '#FF0000' },
            { index: 1, name: '파랑', hex: '#0000FF' },
            { index: 2, name: '초록', hex: '#00FF00' },
            { index: 3, name: '노랑', hex: '#FFFF00' },
            { index: 4, name: '주황', hex: '#FFA500' },
            { index: 5, name: '분홍', hex: '#FFC0CB' },
            { index: 6, name: '청록', hex: '#00CED1' },
            { index: 7, name: '갈색', hex: '#8B4513' }
        ];

        for (const color of colors) {
            // 지도 클릭하여 필지 선택
            const mapElement = await page.locator('#map-click, #map, .map-container').first();
            const box = await mapElement.boundingBox();

            if (box) {
                // 랜덤 위치 클릭
                const x = box.x + Math.random() * box.width;
                const y = box.y + Math.random() * box.height;
                await page.mouse.click(x, y);
                await page.waitForTimeout(1500); // API 응답 대기

                // 색상 적용 시간 측정
                const colorStart = Date.now();
                const colorButton = await page.locator(
                    `.color-btn[data-index="${color.index}"], .palette-color:nth-child(${color.index + 1})`
                ).first();

                if (await colorButton.isVisible()) {
                    await colorButton.click();
                    const applyTime = Date.now() - colorStart;
                    performanceData.colors.push({
                        name: color.name,
                        time: applyTime
                    });
                    console.log(`  🎨 ${color.name} 색상 적용: ${applyTime}ms`);
                    await page.waitForTimeout(500);
                }
            }
        }

        // 색상 테스트 스크린샷
        await page.screenshot({
            path: 'test-all-colors-applied.png',
            fullPage: true
        });

        console.log(`✅ 8개 색상 평균 적용 시간: ${
            performanceData.colors.reduce((sum, c) => sum + c.time, 0) / performanceData.colors.length
        }ms\n`);

        // =============================
        // 3단계: 검색 기능 테스트
        // =============================
        console.log('【3단계】 검색 기능 테스트');

        // 검색 모드 전환
        const searchMode = await page.locator('button[data-mode="search"], button:has-text("검색")').first();
        if (await searchMode.isVisible()) {
            await searchMode.click();
            await page.waitForTimeout(500);
        }

        // 검색창 찾기
        const searchInput = await page.locator('input[placeholder*="검색"], input[placeholder*="주소"], #search-input').first();
        if (await searchInput.isVisible()) {
            const searchStart = Date.now();
            await searchInput.fill('서울특별시 강남구');
            await searchInput.press('Enter');
            await page.waitForTimeout(3000); // 검색 결과 대기
            performanceData.searchTime = Date.now() - searchStart;
            console.log(`  🔍 검색 응답 시간: ${performanceData.searchTime}ms`);

            // 검색 결과 스크린샷
            await page.screenshot({
                path: 'test-search-result.png',
                fullPage: true
            });
        }

        console.log(`✅ 검색 완료\n`);

        // =============================
        // 4단계: 지도 타입 변경 테스트
        // =============================
        console.log('【4단계】 지도 타입 변경 테스트');

        const mapTypes = [
            { type: 'normal', name: '일반지도' },
            { type: 'satellite', name: '위성지도' },
            { type: 'cadastral', name: '지적편집도' },
            { type: 'street', name: '거리뷰' }
        ];

        for (const mapType of mapTypes) {
            const typeButton = await page.locator(`button[data-type="${mapType.type}"], button:has-text("${mapType.name}")`).first();
            if (await typeButton.isVisible()) {
                const switchStart = Date.now();
                await typeButton.click();
                await page.waitForTimeout(1500);
                const switchTime = Date.now() - switchStart;
                performanceData.mapTypes.push({
                    type: mapType.name,
                    time: switchTime
                });
                console.log(`  🗺️ ${mapType.name} 전환: ${switchTime}ms`);

                // 각 지도 타입 스크린샷
                await page.screenshot({
                    path: `test-map-${mapType.type}.png`,
                    fullPage: false
                });
            }
        }

        console.log(`✅ 지도 타입 전환 평균: ${
            performanceData.mapTypes.reduce((sum, m) => sum + m.time, 0) / performanceData.mapTypes.length
        }ms\n`);

        // =============================
        // 5단계: 손 모드 테스트
        // =============================
        console.log('【5단계】 손 모드 드래그 테스트');

        // 손 모드 전환
        const handMode = await page.locator('button[data-mode="hand"], button:has-text("손")').first();
        if (await handMode.isVisible()) {
            await handMode.click();
            await page.waitForTimeout(500);

            const mapElement = await page.locator('#map-hand, #map, .map-container').first();
            const box = await mapElement.boundingBox();

            if (box) {
                const dragStart = Date.now();
                for (let i = 0; i < 3; i++) {
                    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                    await page.mouse.down();
                    await page.mouse.move(box.x + box.width / 3, box.y + box.height / 3, { steps: 10 });
                    await page.mouse.up();
                    await page.waitForTimeout(300);
                }
                const dragTime = Date.now() - dragStart;
                console.log(`  ✋ 손 모드 드래그 시간: ${dragTime}ms`);
            }
        }

        console.log(`✅ 손 모드 테스트 완료\n`);

        // =============================
        // 최종 분석
        // =============================
        console.log('=====================================');
        console.log('📊 최종 성능 분석 결과');
        console.log('=====================================');

        // 콘솔 로그 분석
        performanceData.consoleLogs = consoleLogs.length;
        const debugLogs = consoleLogs.filter(log =>
            log.text.includes('DEBUG') ||
            log.text.includes('마커 조건') ||
            log.text.includes('필지 확인 중')
        ).length;
        const loadCalls = consoleLogs.filter(log =>
            log.text.includes('loadSavedClickModeParcels')
        ).length;

        console.log(`📝 총 콘솔 로그: ${performanceData.consoleLogs}개`);
        console.log(`🐛 디버그 로그: ${debugLogs}개`);
        console.log(`🔄 중복 호출: ${loadCalls}회`);
        console.log('');

        // 색상 성능 요약
        if (performanceData.colors.length > 0) {
            const avgColorTime = performanceData.colors.reduce((sum, c) => sum + c.time, 0) / performanceData.colors.length;
            console.log(`🎨 색상 적용 평균: ${avgColorTime.toFixed(1)}ms`);
            const fastestColor = performanceData.colors.reduce((min, c) => c.time < min.time ? c : min);
            const slowestColor = performanceData.colors.reduce((max, c) => c.time > max.time ? c : max);
            console.log(`  - 가장 빠름: ${fastestColor.name} (${fastestColor.time}ms)`);
            console.log(`  - 가장 느림: ${slowestColor.name} (${slowestColor.time}ms)`);
        }

        // 지도 타입 성능 요약
        if (performanceData.mapTypes.length > 0) {
            const avgMapTime = performanceData.mapTypes.reduce((sum, m) => sum + m.time, 0) / performanceData.mapTypes.length;
            console.log(`\n🗺️ 지도 전환 평균: ${avgMapTime.toFixed(1)}ms`);
            const fastestMap = performanceData.mapTypes.reduce((min, m) => m.time < min.time ? m : min);
            console.log(`  - 가장 빠름: ${fastestMap.type} (${fastestMap.time}ms)`);
        }

        // 검색 성능
        if (performanceData.searchTime > 0) {
            console.log(`\n🔍 검색 응답: ${performanceData.searchTime}ms`);
        }

        // 최적화 판정
        console.log('\n=====================================');
        const isOptimized =
            performanceData.colors.every(c => c.time < 300) &&
            performanceData.mapTypes.every(m => m.time < 2000) &&
            debugLogs < 10 &&
            loadCalls <= 1;

        if (isOptimized) {
            console.log('✅ 성능 최적화 완벽하게 적용됨!');
            console.log('  - 색상 적용 즉시 반응 (Optimistic UI)');
            console.log('  - 중복 호출 제거됨');
            console.log('  - 디버그 로그 최소화');
            console.log('  - 지도 타입 전환 부드러움');
        } else {
            console.log('⚠️ 일부 최적화 필요');
            if (performanceData.colors.some(c => c.time >= 300)) {
                console.log('  - 일부 색상 적용이 느림');
            }
            if (debugLogs >= 10) {
                console.log('  - 디버그 로그가 많음');
            }
            if (loadCalls > 1) {
                console.log('  - 중복 호출 발생');
            }
        }
        console.log('=====================================');

        // 성능 검증
        expect(performanceData.colors.every(c => c.time < 500)).toBeTruthy();
        expect(debugLogs).toBeLessThan(20);
        expect(loadCalls).toBeLessThanOrEqual(1);
    });
});

console.log('🎯 전체 기능 성능 테스트 준비 완료');
console.log('💡 실행: npx playwright test tests/full-feature-performance-test.spec.js --headed');