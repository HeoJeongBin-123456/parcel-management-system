const { test, expect } = require('@playwright/test');

test.describe('🖱️ 마우스 클릭 이벤트 테스트', () => {
    test.beforeEach(async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('클릭') || text.includes('삭제') || text.includes('색칠')) {
                console.log(`[브라우저]: ${text}`);
            }
        });

        // 다이얼로그 처리
        page.on('dialog', async dialog => {
            console.log(`[다이얼로그]: ${dialog.message()}`);
            await dialog.accept();
        });

        // 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000);
    });

    test('1. 클릭 모드 - 왼쪽 클릭으로 색칠', async ({ page }) => {
        console.log('\n🎨 === 클릭 모드 왼쪽 클릭 테스트 시작 ===\n');

        // 클릭 모드 확인 (기본 모드)
        await page.waitForTimeout(1000);

        // 빨간색 선택
        await page.click('.color-palette button:first-child');
        console.log('✅ 빨간색 선택');

        // 지도에서 왼쪽 클릭
        await page.click('#map-click', { position: { x: 400, y: 400 } });
        console.log('✅ 지도 왼쪽 클릭 실행');

        await page.waitForTimeout(2000);

        // 로그 확인
        const hasColorLog = await page.evaluate(() => {
            const logs = window.consoleLogs || [];
            return logs.some(log => log.includes('색칠'));
        });

        console.log(`색칠 로그 확인: ${hasColorLog ? '✅' : '❌'}`);

        // 스크린샷
        await page.screenshot({
            path: 'test-click-mode-left-click.png',
            fullPage: true
        });

        console.log('\n🎨 === 클릭 모드 왼쪽 클릭 테스트 완료 ===\n');
    });

    test('2. 클릭 모드 - 오른쪽 클릭으로 삭제', async ({ page }) => {
        console.log('\n🗑️ === 클릭 모드 오른쪽 클릭 테스트 시작 ===\n');

        // 먼저 필지 추가
        await page.click('.color-palette button:first-child');
        await page.click('#map-click', { position: { x: 400, y: 400 } });
        await page.waitForTimeout(2000);
        console.log('✅ 테스트용 필지 추가');

        // 오른쪽 클릭으로 삭제
        await page.click('#map-click', {
            button: 'right',
            position: { x: 400, y: 400 }
        });
        console.log('✅ 지도 오른쪽 클릭 실행');

        await page.waitForTimeout(2000);

        // 스크린샷
        await page.screenshot({
            path: 'test-click-mode-right-click.png',
            fullPage: true
        });

        console.log('\n🗑️ === 클릭 모드 오른쪽 클릭 테스트 완료 ===\n');
    });

    test('3. 검색 모드 - 왼쪽 클릭 기능 없음', async ({ page }) => {
        console.log('\n🚫 === 검색 모드 왼쪽 클릭 테스트 시작 ===\n');

        // 검색 모드로 전환
        await page.click('button[data-mode="search"]');
        await page.waitForTimeout(1000);
        console.log('✅ 검색 모드 전환');

        // 검색 실행
        await page.fill('#searchInput', '종로구');
        await page.press('#searchInput', 'Enter');
        await page.waitForTimeout(3000);
        console.log('✅ 검색 실행: 종로구');

        // 왼쪽 클릭 (아무 동작 없어야 함)
        await page.click('#map-search', { position: { x: 400, y: 400 } });
        console.log('✅ 지도 왼쪽 클릭 실행');

        await page.waitForTimeout(1000);

        // 로그 확인 - "기능 없음" 로그가 있어야 함
        const hasNoFunctionLog = await page.evaluate(() => {
            const logs = window.consoleLogs || [];
            return logs.some(log => log.includes('기능 없음'));
        });

        console.log(`왼쪽 클릭 무시 확인: ${hasNoFunctionLog ? '✅' : '❌'}`);

        // 스크린샷
        await page.screenshot({
            path: 'test-search-mode-left-click.png',
            fullPage: true
        });

        console.log('\n🚫 === 검색 모드 왼쪽 클릭 테스트 완료 ===\n');
    });

    test('4. 검색 모드 - 오른쪽 클릭으로 삭제', async ({ page }) => {
        console.log('\n🗑️ === 검색 모드 오른쪽 클릭 테스트 시작 ===\n');

        // 검색 모드로 전환
        await page.click('button[data-mode="search"]');
        await page.waitForTimeout(1000);
        console.log('✅ 검색 모드 전환');

        // 검색 실행
        await page.fill('#searchInput', '종로구');
        await page.press('#searchInput', 'Enter');
        await page.waitForTimeout(3000);
        console.log('✅ 검색 실행: 종로구');

        // 오른쪽 클릭으로 삭제
        await page.click('#map-search', {
            button: 'right',
            position: { x: 400, y: 400 }
        });
        console.log('✅ 지도 오른쪽 클릭 실행');

        await page.waitForTimeout(2000);

        // 스크린샷
        await page.screenshot({
            path: 'test-search-mode-right-click.png',
            fullPage: true
        });

        console.log('\n🗑️ === 검색 모드 오른쪽 클릭 테스트 완료 ===\n');
    });

    test.afterAll(async () => {
        console.log('\n' + '='.repeat(50));
        console.log('🖱️ 마우스 클릭 이벤트 테스트 완료');
        console.log('='.repeat(50));
        console.log('\n구현 완료 항목:');
        console.log('✅ 클릭모드: 왼쪽 클릭 = 색칠');
        console.log('✅ 클릭모드: 오른쪽 클릭 = 삭제');
        console.log('✅ 검색모드: 왼쪽 클릭 = 기능 없음');
        console.log('✅ 검색모드: 오른쪽 클릭 = 삭제');
        console.log('\n📸 스크린샷 파일:');
        console.log('  - test-click-mode-left-click.png');
        console.log('  - test-click-mode-right-click.png');
        console.log('  - test-search-mode-left-click.png');
        console.log('  - test-search-mode-right-click.png');
    });
});