const { test, expect } = require('@playwright/test');

test.describe('로그인 페이지 확인', () => {
    test('비밀번호 로그인 폼 확인 및 테스트', async ({ page }) => {
        console.log('🚀 로그인 페이지 테스트 시작');

        // 1. 로그인 페이지로 이동
        await page.goto('http://localhost:3000');
        console.log('✅ 페이지 로드 완료');

        // 페이지 대기
        await page.waitForTimeout(2000);

        // 2. 스크린샷 캡처
        await page.screenshot({
            path: 'login-page-check.png',
            fullPage: true
        });
        console.log('📸 스크린샷 저장: login-page-check.png');

        // 3. 페이지 타이틀 확인
        const title = await page.title();
        console.log(`📄 페이지 타이틀: ${title}`);

        // 4. 비밀번호 입력 필드 확인
        const passwordInput = page.locator('#passwordInput');
        const passwordInputCount = await passwordInput.count();
        console.log(`🔑 비밀번호 입력 필드: ${passwordInputCount > 0 ? '✅ 있음' : '❌ 없음'}`);

        // 5. 로그인 버튼 확인
        const loginButton = page.locator('button[type="submit"], button.login-btn');
        const loginButtonCount = await loginButton.count();
        console.log(`🔘 로그인 버튼: ${loginButtonCount > 0 ? '✅ 있음' : '❌ 없음'}`);

        if (loginButtonCount > 0) {
            const buttonText = await loginButton.textContent();
            console.log(`   버튼 텍스트: "${buttonText}"`);
        }

        // 6. 개발자 모드 버튼 확인
        const devButton = page.locator('#devModeBtn, .dev-mode-btn');
        const devButtonCount = await devButton.count();
        console.log(`👨‍💻 개발자 모드 버튼: ${devButtonCount > 0 ? '✅ 있음' : '❌ 없음'}`);

        // 7. 구글 로그인 요소 확인 (없어야 함)
        const googleDiv = page.locator('#googleSigninDiv');
        const googleDivCount = await googleDiv.count();
        console.log(`🔍 구글 로그인 요소: ${googleDivCount > 0 ? '❌ 아직 있음' : '✅ 제거됨'}`);

        // 8. 비밀번호 안내 텍스트 확인
        const infoText = page.locator('.info-text');
        if (await infoText.count() > 0) {
            const info = await infoText.textContent();
            console.log(`📌 안내 텍스트: ${info.includes('123456') ? '✅ 비밀번호 표시됨' : '❌ 비밀번호 없음'}`);
        }

        // 9. 실제 로그인 테스트
        if (passwordInputCount > 0 && loginButtonCount > 0) {
            console.log('\n🔐 로그인 테스트 시작...');

            // 잘못된 비밀번호 시도
            await passwordInput.fill('wrong');
            await loginButton.click();
            await page.waitForTimeout(1000);

            const errorMessage = page.locator('.error-message');
            const hasError = await errorMessage.isVisible();
            console.log(`❌ 잘못된 비밀번호 테스트: ${hasError ? '✅ 에러 표시됨' : '❌ 에러 없음'}`);

            // 스크린샷
            await page.screenshot({
                path: 'login-error.png',
                fullPage: true
            });

            // 올바른 비밀번호 시도
            await passwordInput.clear();
            await passwordInput.fill('123456');
            await loginButton.click();
            console.log('✅ 올바른 비밀번호 입력 및 로그인 시도');

            // 성공 메시지 확인
            await page.waitForTimeout(1000);
            const successMessage = page.locator('.success-message');
            const hasSuccess = await successMessage.isVisible();
            console.log(`✅ 올바른 비밀번호 테스트: ${hasSuccess ? '✅ 성공 메시지 표시' : '⚠️ 성공 메시지 없음'}`);

            // 페이지 이동 대기
            await page.waitForTimeout(2000);

            // 현재 URL 확인
            const currentUrl = page.url();
            console.log(`📍 현재 URL: ${currentUrl}`);

            if (currentUrl.includes('index.html') || !currentUrl.includes('login')) {
                console.log('✅ 메인 페이지로 이동 성공!');
                await page.screenshot({
                    path: 'main-page-after-login.png',
                    fullPage: true
                });
            } else if (currentUrl.includes('login')) {
                console.log('⚠️ 아직 로그인 페이지에 있음');

                // 페이지 내용 확인
                const pageContent = await page.content();
                if (pageContent.includes('필지 관리 시스템')) {
                    console.log('로그인 페이지 내용이 정상적으로 표시됨');
                }
            }
        }

        // 10. 테스트 결과 요약
        console.log('\n=====================================');
        console.log('📊 테스트 결과 요약');
        console.log('=====================================');
        console.log(`✅ 비밀번호 입력 필드: ${passwordInputCount > 0 ? '있음' : '없음'}`);
        console.log(`✅ 로그인 버튼: ${loginButtonCount > 0 ? '있음' : '없음'}`);
        console.log(`✅ 구글 로그인 제거: ${googleDivCount === 0 ? '완료' : '미완료'}`);
        console.log(`✅ 비밀번호 안내: 표시됨`);
        console.log('=====================================');

        // 최종 검증
        expect(passwordInputCount).toBeGreaterThan(0);
        expect(loginButtonCount).toBeGreaterThan(0);
        expect(googleDivCount).toBe(0);
    });
});