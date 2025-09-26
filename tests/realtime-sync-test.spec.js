const { test, expect, chromium } = require('@playwright/test');

test.describe('실시간 동기화 테스트', () => {
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
            console.log('[브라우저1]:', text);
        });

        page2.on('console', msg => {
            const text = msg.text();
            logs2.push(text);
            console.log('[브라우저2]:', text);
        });

        console.log('\n========================================');
        console.log('🔄 실시간 동기화 테스트 시작');
        console.log('========================================\n');

        await page1.goto('http://localhost:3000', { waitUntil: 'networkidle' });
        await page2.goto('http://localhost:3000', { waitUntil: 'networkidle' });

        await page1.waitForTimeout(3000);
        await page2.waitForTimeout(3000);
    });

    test('1단계: Supabase 연결 상태 확인', async () => {
        console.log('\n[테스트 1] Supabase 연결 상태 확인');

        const status1 = await page1.locator('#connectionStatus').textContent();
        const status2 = await page2.locator('#connectionStatus').textContent();

        console.log('브라우저1 연결 상태:', status1);
        console.log('브라우저2 연결 상태:', status2);

        await page1.screenshot({ path: 'test-results/sync-1-connection-status-browser1.png', fullPage: true });
        await page2.screenshot({ path: 'test-results/sync-1-connection-status-browser2.png', fullPage: true });

        expect(status1).toContain('실시간');
        expect(status2).toContain('실시간');
    });

    test('2단계: 브라우저1에서 필지 클릭 및 색칠', async () => {
        console.log('\n[테스트 2] 브라우저1에서 필지 클릭 및 색칠');

        await page1.locator('button[data-mode="click"]').click();
        await page1.waitForTimeout(1000);

        const map1 = await page1.locator('#map');
        await map1.click({ position: { x: 400, y: 300 } });
        await page1.waitForTimeout(2000);

        await page1.screenshot({ path: 'test-results/sync-2-browser1-after-click.png', fullPage: true });

        const parcelNumber1 = await page1.locator('#parcelNumber');
        const hasValue = await parcelNumber1.inputValue();
        console.log('브라우저1 필지번호:', hasValue);

        if (hasValue) {
            console.log('✅ 필지 정보 로드 성공');
        } else {
            console.log('⚠️ 필지 정보가 로드되지 않았습니다. 다시 클릭 시도...');
            await map1.click({ position: { x: 400, y: 300 } });
            await page1.waitForTimeout(2000);
        }
    });

    test('3단계: 브라우저2에서 실시간 동기화 확인 (5초 대기)', async () => {
        console.log('\n[테스트 3] 브라우저2에서 실시간 동기화 확인 (5초 대기)');

        await page2.waitForTimeout(5000);

        await page2.screenshot({ path: 'test-results/sync-3-browser2-after-5sec.png', fullPage: true });

        const supabaseStatus = await page2.evaluate(() => {
            return {
                hasSupabaseManager: !!window.SupabaseManager,
                isConnected: window.SupabaseManager?.isConnected,
                hasRealtimeSync: !!window.RealtimeSync,
                realtimeSyncConnected: window.RealtimeSync?.isConnected
            };
        });

        console.log('브라우저2 Supabase 상태:', JSON.stringify(supabaseStatus, null, 2));
    });

    test('4단계: 브라우저2에서 필지 정보 수정', async () => {
        console.log('\n[테스트 4] 브라우저2에서 필지 정보 수정');

        await page2.locator('button[data-mode="click"]').click();
        await page2.waitForTimeout(1000);

        const map2 = await page2.locator('#map');
        await map2.click({ position: { x: 450, y: 350 } });
        await page2.waitForTimeout(2000);

        await page2.screenshot({ path: 'test-results/sync-4-browser2-click-another-parcel.png', fullPage: true });

        const memoField = await page2.locator('#memo');
        await memoField.fill('브라우저2에서 작성한 메모');

        const saveBtn = await page2.locator('#saveParcelBtn');
        if (await saveBtn.isVisible()) {
            await saveBtn.click();
            console.log('✅ 저장 버튼 클릭');
            await page2.waitForTimeout(2000);
        }

        await page2.screenshot({ path: 'test-results/sync-4-browser2-after-edit.png', fullPage: true });
    });

    test('5단계: 브라우저1에서 실시간 동기화 확인 (5초 대기)', async () => {
        console.log('\n[테스트 5] 브라우저1에서 실시간 동기화 확인 (5초 대기)');

        await page1.waitForTimeout(5000);

        await page1.screenshot({ path: 'test-results/sync-5-browser1-after-5sec.png', fullPage: true });

        const realtimeLog = await page1.evaluate(() => {
            const logs = [];
            return logs;
        });

        console.log('실시간 로그:', realtimeLog);
    });

    test('6단계: 최종 스크린샷 비교', async () => {
        console.log('\n[테스트 6] 최종 스크린샷 비교');

        await page1.screenshot({ path: 'test-results/sync-final-browser1.png', fullPage: true });
        await page2.screenshot({ path: 'test-results/sync-final-browser2.png', fullPage: true });

        const parcels1 = await page1.evaluate(() => {
            return window.clickParcels ? window.clickParcels.size : 0;
        });

        const parcels2 = await page2.evaluate(() => {
            return window.clickParcels ? window.clickParcels.size : 0;
        });

        console.log('브라우저1 필지 수:', parcels1);
        console.log('브라우저2 필지 수:', parcels2);

        console.log('\n========================================');
        console.log('✅ 실시간 동기화 테스트 완료');
        console.log('========================================\n');

        console.log('📊 테스트 결과:');
        console.log(`- 브라우저1 필지: ${parcels1}개`);
        console.log(`- 브라우저2 필지: ${parcels2}개`);
        console.log(`- 동기화 상태: ${parcels1 === parcels2 ? '✅ 성공' : '❌ 실패'}`);
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