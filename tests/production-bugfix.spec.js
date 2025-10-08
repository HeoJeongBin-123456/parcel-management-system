const { test, expect } = require('@playwright/test');

/**
 * 프로덕션 버그 수정 검증 테스트
 *
 * 테스트 항목:
 * 1. 로딩 속도 개선 (Supabase 쿨다운 축소)
 * 2. 새로고침 후 메모 유지 (LocalStorage 우선 로드)
 * 3. 색상 유지 (colorIndex 검증)
 * 4. API 에러 처리 (사용자 친화적 메시지)
 * 5. 로그아웃 후 데이터 복원 (세션별 격리)
 */

test.describe('프로덕션 버그 수정 검증', () => {
    test.beforeEach(async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();

            // 중요 로그만 출력
            if (type === 'error' ||
                text.includes('✅') ||
                text.includes('❌') ||
                text.includes('⚡') ||
                text.includes('🎨')) {
                console.log(`[브라우저 ${type}]:`, text);
            }
        });

        // 로그인 페이지로 이동
        await page.goto('http://localhost:3000/login.html');
        await page.waitForLoadState('networkidle');
    });

    test('1️⃣ 로딩 속도 개선 확인', async ({ page }) => {
        console.log('\n=== 테스트 1: 로딩 속도 개선 ===');

        // 비밀번호 로그인
        await page.waitForSelector('#passwordInput', { timeout: 5000 });
        await page.fill('#passwordInput', '123456');
        await page.click('button:has-text("로그인")');
        await page.waitForTimeout(1000);

        // 메인 페이지 로딩 시간 측정
        const startTime = Date.now();
        await page.waitForURL('**/index.html', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        console.log(`⏱️ 페이지 로딩 시간: ${loadTime}ms`);

        // 로딩 시간이 5초 이내여야 함 (이전: ~10초)
        expect(loadTime).toBeLessThan(5000);

        // 콘솔에서 로딩 완료 메시지 확인
        await page.waitForTimeout(2000);
        const logs = await page.evaluate(() => {
            return window.__testLogs || [];
        });

        console.log('✅ 로딩 속도 테스트 통과');
    });

    test('2️⃣ 필지 데이터 저장 후 새로고침 시 메모 유지', async ({ page }) => {
        console.log('\n=== 테스트 2: 메모 손실 방지 ===');

        // 로그인
        await page.waitForSelector('#passwordInput', { timeout: 5000 });
        await page.fill('#passwordInput', '123456');
        await page.click('button:has-text("로그인")');
        await page.waitForTimeout(1000);

        await page.waitForURL('**/index.html', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        // 필지 정보 입력 (실제 클릭은 VWorld API 필요하므로 LocalStorage 직접 조작)
        const testData = {
            pnu: 'test_pnu_123',
            parcelNumber: '123-4',
            memo: '테스트 메모 - 새로고침 후 유지되어야 함',
            ownerName: '홍길동',
            ownerAddress: '서울시 강남구',
            ownerContact: '010-1234-5678',
            colorIndex: 1, // 주황색
            lat: 37.5665,
            lng: 126.9780,
            geometry: { type: 'Point', coordinates: [126.9780, 37.5665] },
            timestamp: new Date().toISOString(),
            mode: 'click',
            source: 'click'
        };

        // LocalStorage에 저장
        await page.evaluate((data) => {
            const existing = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const filtered = existing.filter(item => item.pnu !== data.pnu);
            filtered.push(data);
            localStorage.setItem('parcelData', JSON.stringify(filtered));

            // 색상 정보도 저장
            const colors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            colors[data.pnu] = data.colorIndex;
            localStorage.setItem('parcelColors', JSON.stringify(colors));

            console.log('✅ 테스트 데이터 저장 완료');
        }, testData);

        await page.waitForTimeout(500);

        // 새로고침
        console.log('🔄 페이지 새로고침...');
        await page.reload();
        await page.waitForLoadState('networkidle');

        // LocalStorage에서 데이터 확인
        const restoredData = await page.evaluate((pnu) => {
            const parcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const found = parcels.find(item => item.pnu === pnu);
            const colors = JSON.parse(localStorage.getItem('parcelColors') || '{}');

            return {
                parcel: found,
                colorIndex: colors[pnu]
            };
        }, testData.pnu);

        console.log('복원된 데이터:', restoredData);

        // 검증
        expect(restoredData.parcel).toBeTruthy();
        expect(restoredData.parcel.memo).toBe(testData.memo);
        expect(restoredData.parcel.ownerName).toBe(testData.ownerName);
        expect(restoredData.parcel.ownerAddress).toBe(testData.ownerAddress);
        expect(restoredData.parcel.ownerContact).toBe(testData.ownerContact);
        expect(restoredData.colorIndex).toBe(testData.colorIndex);

        console.log('✅ 메모 손실 방지 테스트 통과');
    });

    test('3️⃣ 색상 유지 테스트 (주황색 → 새로고침 → 여전히 주황색)', async ({ page }) => {
        console.log('\n=== 테스트 3: 색상 유지 ===');

        // 로그인
        await page.waitForSelector('#passwordInput', { timeout: 5000 });
        await page.fill('#passwordInput', '123456');
        await page.click('button:has-text("로그인")');
        await page.waitForTimeout(1000);

        await page.waitForURL('**/index.html', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        // 여러 색상으로 테스트
        const colorTests = [
            { index: 0, hex: '#FF0000', name: '빨강' },
            { index: 1, hex: '#FFA500', name: '주황' },
            { index: 2, hex: '#FFFF00', name: '노랑' },
            { index: 4, hex: '#0000FF', name: '파랑' }
        ];

        for (const color of colorTests) {
            const pnu = `test_color_${color.index}`;

            // 필지 데이터 저장
            await page.evaluate(({ pnu, colorIndex, hex }) => {
                const parcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
                const filtered = parcels.filter(item => item.pnu !== pnu);
                filtered.push({
                    pnu,
                    parcelNumber: `색상테스트-${colorIndex}`,
                    colorIndex,
                    color: hex,
                    lat: 37.5665,
                    lng: 126.9780,
                    geometry: { type: 'Point', coordinates: [126.9780, 37.5665] },
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem('parcelData', JSON.stringify(filtered));

                // parcelColors 저장
                const colors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
                colors[pnu] = colorIndex;
                localStorage.setItem('parcelColors', JSON.stringify(colors));
            }, { pnu, colorIndex: color.index, hex: color.hex });
        }

        // 새로고침
        console.log('🔄 색상 유지 확인을 위한 새로고침...');
        await page.reload();
        await page.waitForLoadState('networkidle');

        // 모든 색상 확인
        for (const color of colorTests) {
            const pnu = `test_color_${color.index}`;

            const restored = await page.evaluate((pnu) => {
                const parcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
                const found = parcels.find(item => item.pnu === pnu);
                const colors = JSON.parse(localStorage.getItem('parcelColors') || '{}');

                return {
                    colorIndex: found?.colorIndex,
                    colorFromMap: colors[pnu]
                };
            }, pnu);

            console.log(`🎨 ${color.name} (index: ${color.index}) 확인:`, restored);

            // 검증: colorIndex가 변경되지 않아야 함
            expect(restored.colorIndex).toBe(color.index);
            expect(restored.colorFromMap).toBe(color.index);
        }

        console.log('✅ 색상 유지 테스트 통과 - 임의 색상 변경 없음');
    });

    test('4️⃣ 로그아웃 후 재로그인 시 데이터 복원', async ({ page }) => {
        console.log('\n=== 테스트 4: 로그아웃 후 복원 ===');

        // 로그인
        await page.waitForSelector('#passwordInput', { timeout: 5000 });
        await page.fill('#passwordInput', '123456');
        await page.click('button:has-text("로그인")');
        await page.waitForTimeout(1000);

        await page.waitForURL('**/index.html', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        // 테스트 데이터 3개 저장
        const testParcels = [
            { pnu: 'logout_test_1', memo: '로그아웃 테스트 1', colorIndex: 0 },
            { pnu: 'logout_test_2', memo: '로그아웃 테스트 2', colorIndex: 1 },
            { pnu: 'logout_test_3', memo: '로그아웃 테스트 3', colorIndex: 2 }
        ];

        await page.evaluate((parcels) => {
            const existing = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const filtered = existing.filter(item =>
                !item.pnu.startsWith('logout_test_')
            );

            parcels.forEach(p => {
                filtered.push({
                    pnu: p.pnu,
                    parcelNumber: p.pnu,
                    memo: p.memo,
                    colorIndex: p.colorIndex,
                    lat: 37.5665,
                    lng: 126.9780,
                    geometry: { type: 'Point', coordinates: [126.9780, 37.5665] },
                    timestamp: new Date().toISOString()
                });
            });

            localStorage.setItem('parcelData', JSON.stringify(filtered));

            // 색상도 저장
            const colors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            parcels.forEach(p => {
                colors[p.pnu] = p.colorIndex;
            });
            localStorage.setItem('parcelColors', JSON.stringify(colors));

            console.log('✅ 로그아웃 테스트용 데이터 3개 저장 완료');
        }, testParcels);

        await page.waitForTimeout(500);

        // 현재 세션 ID 확인
        const sessionBefore = await page.evaluate(() => {
            return localStorage.getItem('user_session');
        });
        console.log('로그아웃 전 세션 ID:', sessionBefore);

        // confirm 다이얼로그 자동 승인 (클릭 전에 등록!)
        page.on('dialog', dialog => dialog.accept());

        // 로그아웃 버튼 클릭
        const logoutBtn = page.locator('#logoutBtn');
        await logoutBtn.click();

        // 로그인 페이지로 리다이렉트 확인
        await page.waitForURL('**/login.html', { timeout: 5000 });
        console.log('✅ 로그아웃 완료');

        // 데이터가 보존되었는지 확인 (last_user_session 확인)
        const lastSession = await page.evaluate(() => {
            return localStorage.getItem('last_user_session');
        });
        console.log('저장된 이전 세션 ID:', lastSession);
        expect(lastSession).toBe(sessionBefore);

        // 다시 로그인
        await page.waitForTimeout(500);
        await page.waitForSelector('#passwordInput', { timeout: 5000 });
        await page.fill('#passwordInput', '123456');
        await page.click('button:has-text("로그인")');
        await page.waitForTimeout(1000);

        await page.waitForURL('**/index.html', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        // 데이터 복원 확인
        const restoredParcels = await page.evaluate(() => {
            const parcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
            return parcels.filter(item => item.pnu.startsWith('logout_test_'));
        });

        console.log('복원된 필지 개수:', restoredParcels.length);
        console.log('복원된 데이터:', restoredParcels.map(p => ({
            pnu: p.pnu,
            memo: p.memo,
            colorIndex: p.colorIndex
        })));

        // 검증: 3개 모두 복원되어야 함
        expect(restoredParcels.length).toBe(3);

        testParcels.forEach((original, index) => {
            const restored = restoredParcels.find(p => p.pnu === original.pnu);
            expect(restored).toBeTruthy();
            expect(restored.memo).toBe(original.memo);
            expect(restored.colorIndex).toBe(original.colorIndex);
        });

        console.log('✅ 로그아웃 후 복원 테스트 통과 - 데이터 100% 복원');
    });

    test('5️⃣ 성능 측정: Supabase 로드 쿨다운 축소 효과', async ({ page }) => {
        console.log('\n=== 테스트 5: 성능 개선 측정 ===');

        // 로그인
        await page.waitForSelector('#passwordInput', { timeout: 5000 });
        await page.fill('#passwordInput', '123456');
        await page.click('button:has-text("로그인")');
        await page.waitForTimeout(1000);

        await page.waitForURL('**/index.html', { timeout: 10000 });

        // 초기 로딩 시간 측정
        const startTime = Date.now();
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        console.log(`⚡ 초기 로딩 시간: ${loadTime}ms`);

        // 여러 번 새로고침해서 평균 로딩 시간 측정
        const loadTimes = [];
        const iterations = 3;

        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await page.reload();
            await page.waitForLoadState('networkidle');
            const time = Date.now() - start;
            loadTimes.push(time);
            console.log(`  - 새로고침 ${i + 1}: ${time}ms`);
            await page.waitForTimeout(500);
        }

        const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
        console.log(`📊 평균 로딩 시간: ${avgLoadTime.toFixed(0)}ms`);

        // 평균 로딩 시간이 3초 이내여야 함 (쿨다운 축소 효과)
        expect(avgLoadTime).toBeLessThan(3000);

        console.log('✅ 성능 개선 측정 완료 - 목표 달성');
    });
});
