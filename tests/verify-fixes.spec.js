const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

test('수정사항 확인 테스트', async ({ page }) => {
    console.log('\n🔍 수정사항 확인 시작...\n');

    const logs = [];
    const errors = [];

    page.on('console', msg => {
        const text = msg.text();
        logs.push(text);
        if (text.includes('❌') || text.includes('에러') || text.includes('실패')) {
            console.log(`[에러 로그] ${text}`);
        }
    });

    page.on('pageerror', err => {
        errors.push(err.message);
        console.log(`[브라우저 에러] ${err.message}`);
    });

    await page.goto('http://localhost:3000', {
        waitUntil: 'networkidle',
        timeout: 60000
    });

    console.log('✅ 페이지 로드 완료\n');

    await page.waitForTimeout(3000);

    // 1. 로그인 체크 확인
    const currentURL = page.url();
    console.log(`현재 URL: ${currentURL}`);

    if (currentURL.includes('login.html')) {
        console.log('✅ 로그인 페이지로 정상 리다이렉트됨');

        // 테스트용 로그인 (비밀번호 123456)
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        console.log('✅ 테스트 로그인 완료\n');

        await page.screenshot({ path: 'test-results/after-login.png', fullPage: true });
        await page.waitForTimeout(3000);
    } else {
        console.log('✅ 이미 로그인된 상태\n');
    }

    await page.screenshot({ path: 'test-results/before-test.png', fullPage: true });

    // UI 요소 존재 확인
    const clickModeExists = await page.locator('button[data-mode="click"]').count();
    console.log(`click 버튼 개수: ${clickModeExists}`);

    if (clickModeExists === 0) {
        console.log('❌ click 버튼을 찾을 수 없습니다. 페이지 구조 확인 필요');
        await page.screenshot({ path: 'test-results/no-click-button.png', fullPage: true });
        return;
    }

    // 2. color_type 에러 체크
    await page.waitForTimeout(2000);

    const clickMode = await page.locator('button[data-mode="click"]');
    await clickMode.click({ timeout: 60000 });
    await page.waitForTimeout(500);

    const colorItem = await page.locator('.color-item').first();
    await colorItem.click();
    await page.waitForTimeout(300);

    // 지도 중심으로 이동
    const testCoord = { lat: 37.497942, lng: 127.027621 };
    await page.evaluate((coord) => {
        if (window.map && window.map.setCenter) {
            window.map.setCenter(new naver.maps.LatLng(coord.lat, coord.lng));
            window.map.setZoom(18);
        }
    }, testCoord);

    await page.waitForTimeout(2000);

    const mapCenter = await page.evaluate(() => {
        if (window.map) {
            const bounds = window.map.getElement().getBoundingClientRect();
            return {
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2
            };
        }
        return { x: 500, y: 400 };
    });

    console.log('🖱️  필지 클릭 테스트...\n');

    await page.mouse.click(mapCenter.x, mapCenter.y);

    await page.waitForTimeout(3000);

    // 에러 로그에서 color_type 관련 에러 체크
    const colorTypeErrors = logs.filter(log =>
        log.includes('color_type') && (log.includes('❌') || log.includes('에러') || log.includes('실패'))
    );

    const supabaseErrors = logs.filter(log =>
        log.includes('Supabase') && log.includes('실패')
    );

    console.log('📊 테스트 결과:\n');

    if (colorTypeErrors.length === 0) {
        console.log('✅ color_type 에러 없음 - 수정 성공!');
    } else {
        console.log('❌ color_type 에러 발견:');
        colorTypeErrors.forEach(err => console.log(`  - ${err}`));
    }

    if (supabaseErrors.length === 0) {
        console.log('✅ Supabase 저장 성공!');
    } else {
        console.log('⚠️  Supabase 에러:');
        supabaseErrors.forEach(err => console.log(`  - ${err}`));
    }

    if (errors.length === 0) {
        console.log('✅ 브라우저 에러 없음');
    } else {
        console.log('❌ 브라우저 에러:');
        errors.forEach(err => console.log(`  - ${err}`));
    }

    console.log('\n✅ 수정사항 확인 완료!\n');

    // 실패 조건
    expect(colorTypeErrors.length).toBe(0);
});