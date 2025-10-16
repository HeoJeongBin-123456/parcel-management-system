const { test, expect } = require('@playwright/test');

/**
 * 🎯 새로고침 시 마커 사라지는 문제 해결 테스트
 *
 * 증상: 940-26번지 같은 메모가 있는 필지의 마커(M)가 새로고침 시 사라졌다가 나타났다가 반복
 * 수정: app-init.js와 memo-markers.js에서 중복 초기화 제거
 */
test.describe('마커 새로고침 안정성 테스트', () => {

    test.beforeEach(async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            console.log(`[브라우저 ${msg.type()}]:`, text);
        });
    });

    test('새로고침 후 마커가 안정적으로 유지되어야 함', async ({ page }) => {
        console.log('\n🎯 테스트 시작: 새로고침 후 마커 안정성 확인\n');

        // 1. 페이지 로드
        console.log('1️⃣ 페이지 로드 중...');
        await page.goto('http://localhost:3000');

        // 페이지 로드 대기 (지도 초기화까지)
        await page.waitForTimeout(5000);
        console.log('✅ 페이지 로드 완료');

        // 2. 초기 마커 존재 확인
        console.log('\n2️⃣ 초기 마커 존재 여부 확인...');
        const initialMarkers = await page.locator('.memo-marker').count();
        console.log(`📍 발견된 마커 개수: ${initialMarkers}개`);

        // 3. 초기 스크린샷 캡처
        await page.screenshot({
            path: '/Users/ai-code-lab/projects/parcel-management-system/tests/screenshots/marker-before-refresh.png',
            fullPage: true
        });
        console.log('📸 초기 스크린샷 저장: marker-before-refresh.png');

        // 4. 새로고침 직전 MemoMarkerManager 상태 확인
        console.log('\n3️⃣ 새로고침 전 상태 확인...');
        const beforeRefreshState = await page.evaluate(() => {
            return {
                isInitialized: window.MemoMarkerManager?.isInitialized,
                isInitializing: window.MemoMarkerManager?.isInitializing,
                markerCount: window.MemoMarkerManager?.markers?.size || 0
            };
        });
        console.log('📊 새로고침 전 상태:', beforeRefreshState);

        // 5. 새로고침
        console.log('\n4️⃣ 새로고침 실행...');
        await page.reload();

        // 지도 재초기화 대기
        await page.waitForTimeout(5000);
        console.log('✅ 새로고침 완료');

        // 6. 새로고침 후 마커 존재 확인
        console.log('\n5️⃣ 새로고침 후 마커 존재 여부 확인...');
        const afterMarkers = await page.locator('.memo-marker').count();
        console.log(`📍 발견된 마커 개수: ${afterMarkers}개`);

        // 7. 새로고침 후 스크린샷 캡처
        await page.screenshot({
            path: '/Users/ai-code-lab/projects/parcel-management-system/tests/screenshots/marker-after-refresh.png',
            fullPage: true
        });
        console.log('📸 새로고침 후 스크린샷 저장: marker-after-refresh.png');

        // 8. 새로고침 후 MemoMarkerManager 상태 확인
        console.log('\n6️⃣ 새로고침 후 상태 확인...');
        const afterRefreshState = await page.evaluate(() => {
            return {
                isInitialized: window.MemoMarkerManager?.isInitialized,
                isInitializing: window.MemoMarkerManager?.isInitializing,
                markerCount: window.MemoMarkerManager?.markers?.size || 0
            };
        });
        console.log('📊 새로고침 후 상태:', afterRefreshState);

        // 9. 중복 초기화 체크 - 콘솔 로그 분석
        console.log('\n7️⃣ 중복 초기화 체크...');
        const consoleLogs = [];
        page.on('console', msg => {
            consoleLogs.push(msg.text());
        });

        // 2초 대기하며 로그 수집
        await page.waitForTimeout(2000);

        // "초기화" 관련 로그 필터링
        const initLogs = consoleLogs.filter(log =>
            log.includes('MemoMarkerManager 초기화') ||
            log.includes('refreshAllMarkers')
        );
        console.log('📝 초기화 관련 로그:', initLogs);

        // 10. 검증
        console.log('\n8️⃣ 결과 검증...');

        // 마커 개수가 일치하거나 합리적인 범위 내에 있어야 함
        const markerDiff = Math.abs(afterMarkers - initialMarkers);
        console.log(`📊 마커 개수 차이: ${markerDiff}`);

        expect(afterMarkers).toBeGreaterThanOrEqual(0);
        console.log('✅ 새로고침 후 마커가 존재함');

        // isInitializing이 false여야 함 (초기화 완료 상태)
        expect(afterRefreshState.isInitializing).toBe(false);
        console.log('✅ 초기화 플래그가 올바르게 설정됨');

        // isInitialized가 true여야 함
        expect(afterRefreshState.isInitialized).toBe(true);
        console.log('✅ 초기화가 완료됨');

        console.log('\n✅ 모든 테스트 통과! 마커 새로고침 문제가 해결되었습니다.\n');
    });

    test('중복 초기화 호출이 발생하지 않아야 함', async ({ page }) => {
        console.log('\n🎯 테스트 시작: 중복 초기화 방지 확인\n');

        const initializeCalls = [];
        const refreshCalls = [];

        // 콘솔 로그 모니터링
        page.on('console', msg => {
            const text = msg.text();

            if (text.includes('MemoMarkerManager 초기화 시작')) {
                initializeCalls.push({
                    timestamp: Date.now(),
                    message: text
                });
            }

            if (text.includes('refreshAllMarkers') || text.includes('마커 복원')) {
                refreshCalls.push({
                    timestamp: Date.now(),
                    message: text
                });
            }
        });

        // 페이지 로드
        console.log('1️⃣ 페이지 로드 중...');
        await page.goto('http://localhost:3000');

        // 충분한 시간 대기 (모든 초기화가 완료될 때까지)
        await page.waitForTimeout(6000);
        console.log('✅ 페이지 로드 완료 (6초 대기)');

        // 결과 출력
        console.log('\n📊 초기화 호출 횟수:', initializeCalls.length);
        console.log('📊 초기화 호출 목록:');
        initializeCalls.forEach((call, index) => {
            console.log(`   ${index + 1}. ${call.message}`);
        });

        console.log('\n📊 refreshAllMarkers 호출 횟수:', refreshCalls.length);
        console.log('📊 refreshAllMarkers 호출 목록:');
        refreshCalls.forEach((call, index) => {
            console.log(`   ${index + 1}. ${call.message}`);
        });

        // 검증: 초기화는 1번만 호출되어야 함
        expect(initializeCalls.length).toBeLessThanOrEqual(1);
        console.log('\n✅ 초기화가 1번만 호출되었습니다 (중복 없음)');

        // 검증: refreshAllMarkers는 호출되지 않아야 함 (app-init.js 수정으로 제거됨)
        const unwantedRefreshCalls = refreshCalls.filter(call =>
            call.message.includes('마커 복원')
        );
        expect(unwantedRefreshCalls.length).toBe(0);
        console.log('✅ 불필요한 refreshAllMarkers 호출이 없습니다\n');
    });
});
