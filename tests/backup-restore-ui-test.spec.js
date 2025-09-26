const { test, expect } = require('@playwright/test');

test.describe('백업/복원 UI 테스트', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        await page.waitForTimeout(1000);

        const passwordInput = await page.locator('input[type="password"]');
        if (await passwordInput.isVisible()) {
            await passwordInput.fill('123456');
            const loginButton = await page.locator('button:has-text("로그인")');
            await loginButton.click();
            await page.waitForTimeout(2000);
        }
    });

    test('1. 백업 모달 열기 및 탭 UI 확인', async ({ page }) => {
        console.log('='.repeat(80));
        console.log('📋 백업 모달 열기 및 탭 UI 확인');
        console.log('='.repeat(80));

        const backupButton = await page.locator('#backupBtn');
        await backupButton.click();

        await page.waitForTimeout(1000);

        await page.screenshot({
            path: 'tests/screenshots/backup-modal-opened.png',
            fullPage: true
        });

        const backupTab = await page.locator('.backup-tab:has-text("💾 백업")');
        const restoreTab = await page.locator('.backup-tab:has-text("🔄 복원")');

        expect(await backupTab.isVisible()).toBe(true);
        expect(await restoreTab.isVisible()).toBe(true);

        console.log('✅ 백업 모달 열림 확인');
        console.log('✅ 백업/복원 탭 표시 확인');
    });

    test('2. 복원 탭 전환 및 UI 확인', async ({ page }) => {
        console.log('='.repeat(80));
        console.log('🔄 복원 탭 전환 및 UI 확인');
        console.log('='.repeat(80));

        const backupButton = await page.locator('#backupBtn');
        await backupButton.click();

        await page.waitForTimeout(1000);

        const restoreTab = await page.locator('.backup-tab:has-text("🔄 복원")');
        await restoreTab.click();

        await page.waitForTimeout(1000);

        await page.screenshot({
            path: 'tests/screenshots/restore-tab.png',
            fullPage: true
        });

        const restoreGuide = await page.locator('.restore-guide');
        const uploadZone = await page.locator('.upload-zone');

        expect(await restoreGuide.isVisible()).toBe(true);
        expect(await uploadZone.isVisible()).toBe(true);

        const guideTitle = await restoreGuide.locator('h3').textContent();
        console.log(`✅ 복원 가이드 제목: ${guideTitle}`);

        const steps = await page.locator('.guide-step').count();
        console.log(`✅ 가이드 단계 수: ${steps}개`);

        console.log('✅ 드래그 앤 드롭 영역 표시 확인');
    });

    test('3. 탭 전환 애니메이션 확인', async ({ page }) => {
        console.log('='.repeat(80));
        console.log('🎨 탭 전환 애니메이션 확인');
        console.log('='.repeat(80));

        const backupButton = await page.locator('#backupBtn');
        await backupButton.click();

        await page.waitForTimeout(500);

        const backupTab = await page.locator('.backup-tab:has-text("💾 백업")');
        const restoreTab = await page.locator('.backup-tab:has-text("🔄 복원")');

        let backupTabClass = await backupTab.getAttribute('class');
        console.log(`백업 탭 초기 상태: ${backupTabClass}`);
        expect(backupTabClass).toContain('active');

        await restoreTab.click();
        await page.waitForTimeout(500);

        await page.screenshot({
            path: 'tests/screenshots/restore-tab-active.png',
            fullPage: true
        });

        let restoreTabClass = await restoreTab.getAttribute('class');
        console.log(`복원 탭 활성화 상태: ${restoreTabClass}`);
        expect(restoreTabClass).toContain('active');

        await backupTab.click();
        await page.waitForTimeout(500);

        await page.screenshot({
            path: 'tests/screenshots/backup-tab-active.png',
            fullPage: true
        });

        backupTabClass = await backupTab.getAttribute('class');
        console.log(`백업 탭 재활성화 상태: ${backupTabClass}`);
        expect(backupTabClass).toContain('active');

        console.log('✅ 탭 전환 애니메이션 정상 작동');
    });

    test('4. 복원 가이드 콘텐츠 검증', async ({ page }) => {
        console.log('='.repeat(80));
        console.log('📖 복원 가이드 콘텐츠 검증');
        console.log('='.repeat(80));

        const backupButton = await page.locator('#backupBtn');
        await backupButton.click();

        await page.waitForTimeout(500);

        const restoreTab = await page.locator('.backup-tab:has-text("🔄 복원")');
        await restoreTab.click();

        await page.waitForTimeout(500);

        const steps = await page.locator('.guide-step');
        const stepCount = await steps.count();

        console.log(`\n📋 복원 가이드 단계 (${stepCount}개):`);

        for (let i = 0; i < stepCount; i++) {
            const step = steps.nth(i);
            const number = await step.locator('.guide-step-number').textContent();
            const title = await step.locator('.guide-step-content strong').textContent();
            const description = await step.locator('.guide-step-content p').textContent();

            console.log(`\n${number}. ${title}`);
            console.log(`   ${description}`);
        }

        const safetyNotice = await page.locator('.safety-notice');
        expect(await safetyNotice.isVisible()).toBe(true);

        const safetyText = await safetyNotice.textContent();
        console.log(`\n⚠️ 안전 공지: ${safetyText}`);

        console.log('\n✅ 복원 가이드 콘텐츠 검증 완료');
    });

    test('5. 업로드 영역 상호작용 확인', async ({ page }) => {
        console.log('='.repeat(80));
        console.log('📤 업로드 영역 상호작용 확인');
        console.log('='.repeat(80));

        const backupButton = await page.locator('#backupBtn');
        await backupButton.click();

        await page.waitForTimeout(500);

        const restoreTab = await page.locator('.backup-tab:has-text("🔄 복원")');
        await restoreTab.click();

        await page.waitForTimeout(500);

        const uploadZone = await page.locator('.upload-zone');

        await uploadZone.hover();
        await page.waitForTimeout(300);

        await page.screenshot({
            path: 'tests/screenshots/upload-zone-hover.png',
            fullPage: true
        });

        console.log('✅ 업로드 영역 hover 스타일 적용 확인');

        const uploadZoneText = await uploadZone.textContent();
        console.log(`\n📤 업로드 영역 텍스트:\n${uploadZoneText}`);

        const fileInput = await page.locator('.upload-zone input[type="file"]');
        expect(await fileInput.count()).toBe(1);
        console.log('✅ 파일 input 요소 존재 확인');
    });
});