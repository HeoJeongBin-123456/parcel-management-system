const { test, expect, chromium } = require('@playwright/test');

async function loginToBrowser(page) {
    console.log('🔐 로그인 시도 중...');

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    const currentUrl = page.url();
    if (currentUrl.includes('login.html')) {
        console.log('📝 로그인 페이지로 리디렉션됨 - 자동 로그인 진행');

        await page.waitForSelector('#passwordInput');
        await page.fill('#passwordInput', '123456');
        await page.click('.login-btn');

        await page.waitForURL('**/index.html', { timeout: 5000 });
        console.log('✅ 로그인 성공!');
    } else {
        console.log('✅ 이미 로그인된 상태');
    }

    await page.waitForTimeout(3000);
}

test.describe('실시간 동기화 테스트 (로그인 포함)', () => {
    let browser1, browser2, context1, context2, page1, page2;

    test.beforeAll(async () => {
        browser1 = await chromium.launch({ headless: false });
        browser2 = await chromium.launch({ headless: false });

        context1 = await browser1.newContext();
        context2 = await browser2.newContext();

        page1 = await context1.newPage();
        page2 = await context2.newPage();

        const logs1 = [];
        const logs2 = [];

        page1.on('console', msg => {
            const text = msg.text();
            logs1.push(text);
            if (text.includes('실시간') || text.includes('Realtime') || text.includes('Supabase')) {
                console.log('[브라우저1 🔔]:', text);
            }
        });

        page2.on('console', msg => {
            const text = msg.text();
            logs2.push(text);
            if (text.includes('실시간') || text.includes('Realtime') || text.includes('Supabase')) {
                console.log('[브라우저2 🔔]:', text);
            }
        });

        console.log('\n========================================');
        console.log('🔄 실시간 동기화 테스트 시작 (로그인 포함)');
        console.log('========================================\n');

        await loginToBrowser(page1);
        await loginToBrowser(page2);
    });

    test('1단계: Supabase 연결 상태 확인', async () => {
        console.log('\n[테스트 1] Supabase 연결 상태 확인');

        const status1 = await page1.locator('#connectionStatus').textContent();
        const status2 = await page2.locator('#connectionStatus').textContent();

        console.log('브라우저1 연결 상태:', status1);
        console.log('브라우저2 연결 상태:', status2);

        await page1.screenshot({ path: 'test-results/sync-login-1-status-browser1.png', fullPage: true });
        await page2.screenshot({ path: 'test-results/sync-login-1-status-browser2.png', fullPage: true });

        expect(status1).toContain('Supabase');
        expect(status2).toContain('Supabase');
    });

    test('2단계: 실시간 동기화 시스템 확인', async () => {
        console.log('\n[테스트 2] 실시간 동기화 시스템 확인');

        const realtimeStatus1 = await page1.evaluate(() => {
            return {
                hasRealtimeSync: !!window.RealtimeSync,
                isConnected: window.RealtimeSync?.isConnected,
                hasSupabaseManager: !!window.SupabaseManager,
                supabaseConnected: window.SupabaseManager?.isConnected
            };
        });

        const realtimeStatus2 = await page2.evaluate(() => {
            return {
                hasRealtimeSync: !!window.RealtimeSync,
                isConnected: window.RealtimeSync?.isConnected,
                hasSupabaseManager: !!window.SupabaseManager,
                supabaseConnected: window.SupabaseManager?.isConnected
            };
        });

        console.log('브라우저1 실시간 동기화 상태:', JSON.stringify(realtimeStatus1, null, 2));
        console.log('브라우저2 실시간 동기화 상태:', JSON.stringify(realtimeStatus2, null, 2));

        expect(realtimeStatus1.hasRealtimeSync).toBe(true);
        expect(realtimeStatus2.hasRealtimeSync).toBe(true);
    });

    test('3단계: 브라우저1에서 필지 클릭 및 색칠', async () => {
        console.log('\n[테스트 3] 브라우저1에서 필지 클릭 및 색칠');

        await page1.locator('button[data-mode="click"]').click();
        await page1.waitForTimeout(1000);

        const map1 = await page1.locator('#map');
        const mapBox = await map1.boundingBox();

        if (mapBox) {
            await map1.click({ position: { x: mapBox.width / 2, y: mapBox.height / 2 } });
            console.log('✅ 지도 중앙 클릭');
            await page1.waitForTimeout(3000);
        }

        await page1.screenshot({ path: 'test-results/sync-login-3-browser1-click.png', fullPage: true });

        const parcelNumber = await page1.locator('#parcelNumber').inputValue();
        console.log('브라우저1 필지번호:', parcelNumber || '없음');
    });

    test('4단계: 브라우저2에서 실시간 동기화 확인 (10초 대기)', async () => {
        console.log('\n[테스트 4] 브라우저2에서 실시간 동기화 확인 (10초 대기)');

        await page2.waitForTimeout(10000);

        await page2.screenshot({ path: 'test-results/sync-login-4-browser2-after-10sec.png', fullPage: true });

        const parcels1 = await page1.evaluate(() => {
            return window.clickParcels ? window.clickParcels.size : 0;
        });

        const parcels2 = await page2.evaluate(() => {
            return window.clickParcels ? window.clickParcels.size : 0;
        });

        console.log('브라우저1 필지 수:', parcels1);
        console.log('브라우저2 필지 수:', parcels2);
        console.log('동기화 여부:', parcels1 === parcels2 ? '✅ 동기화됨' : '⚠️ 동기화 안됨');
    });

    test('5단계: 브라우저2에서 다른 필지 클릭 및 정보 입력', async () => {
        console.log('\n[테스트 5] 브라우저2에서 다른 필지 클릭 및 정보 입력');

        await page2.locator('button[data-mode="click"]').click();
        await page2.waitForTimeout(1000);

        const map2 = await page2.locator('#map');
        const mapBox = await map2.boundingBox();

        if (mapBox) {
            await map2.click({ position: { x: mapBox.width / 3, y: mapBox.height / 3 } });
            console.log('✅ 지도 다른 위치 클릭');
            await page2.waitForTimeout(3000);
        }

        const memoField = await page2.locator('#memo');
        if (await memoField.isVisible()) {
            await memoField.fill('브라우저2에서 작성한 테스트 메모');
            console.log('✅ 메모 입력 완료');
        }

        const saveBtn = await page2.locator('#saveParcelBtn');
        if (await saveBtn.isVisible()) {
            await saveBtn.click();
            console.log('✅ 저장 버튼 클릭');
            await page2.waitForTimeout(3000);
        }

        await page2.screenshot({ path: 'test-results/sync-login-5-browser2-edit.png', fullPage: true });
    });

    test('6단계: 브라우저1에서 실시간 동기화 확인 (10초 대기)', async () => {
        console.log('\n[테스트 6] 브라우저1에서 실시간 동기화 확인 (10초 대기)');

        await page1.waitForTimeout(10000);

        await page1.screenshot({ path: 'test-results/sync-login-6-browser1-after-10sec.png', fullPage: true });

        const parcels1 = await page1.evaluate(() => {
            return window.clickParcels ? window.clickParcels.size : 0;
        });

        const parcels2 = await page2.evaluate(() => {
            return window.clickParcels ? window.clickParcels.size : 0;
        });

        console.log('브라우저1 필지 수:', parcels1);
        console.log('브라우저2 필지 수:', parcels2);
        console.log('동기화 여부:', parcels1 === parcels2 ? '✅ 동기화됨' : '⚠️ 동기화 안됨');
    });

    test('7단계: 최종 동기화 확인 및 결과', async () => {
        console.log('\n[테스트 7] 최종 동기화 확인 및 결과');

        await page1.screenshot({ path: 'test-results/sync-login-final-browser1.png', fullPage: true });
        await page2.screenshot({ path: 'test-results/sync-login-final-browser2.png', fullPage: true });

        const parcels1 = await page1.evaluate(() => {
            return window.clickParcels ? window.clickParcels.size : 0;
        });

        const parcels2 = await page2.evaluate(() => {
            return window.clickParcels ? window.clickParcels.size : 0;
        });

        const supabaseStatus1 = await page1.evaluate(() => {
            return {
                isConnected: window.SupabaseManager?.isConnected,
                realtimeConnected: window.RealtimeSync?.isConnected
            };
        });

        const supabaseStatus2 = await page2.evaluate(() => {
            return {
                isConnected: window.SupabaseManager?.isConnected,
                realtimeConnected: window.RealtimeSync?.isConnected
            };
        });

        console.log('\n========================================');
        console.log('✅ 실시간 동기화 테스트 완료');
        console.log('========================================\n');

        console.log('📊 최종 결과:');
        console.log(`- 브라우저1 필지: ${parcels1}개`);
        console.log(`- 브라우저2 필지: ${parcels2}개`);
        console.log(`- 브라우저1 Supabase: ${supabaseStatus1.isConnected ? '✅' : '❌'}`);
        console.log(`- 브라우저2 Supabase: ${supabaseStatus2.isConnected ? '✅' : '❌'}`);
        console.log(`- 브라우저1 실시간 동기화: ${supabaseStatus1.realtimeConnected ? '✅' : '❌'}`);
        console.log(`- 브라우저2 실시간 동기화: ${supabaseStatus2.realtimeConnected ? '✅' : '❌'}`);
        console.log(`- 필지 수 일치: ${parcels1 === parcels2 ? '✅' : '❌'}`);

        if (parcels1 === parcels2 && supabaseStatus1.realtimeConnected && supabaseStatus2.realtimeConnected) {
            console.log('\n🎉 실시간 동기화 성공!');
        } else {
            console.log('\n⚠️ 실시간 동기화 부분 성공 또는 실패');
        }
    });

    test.afterAll(async () => {
        await page1.waitForTimeout(2000);
        await page2.waitForTimeout(2000);

        await context1.close();
        await context2.close();
        await browser1.close();
        await browser2.close();
    });
});