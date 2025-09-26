const { test, expect } = require('@playwright/test');

test.describe('종합 필지 검증 시나리오 테스트', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');

        await page.evaluate(() => {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('authProvider', 'dev');
            const futureTime = new Date().getTime() + (24 * 60 * 60 * 1000);
            localStorage.setItem('devLoginExpiry', futureTime.toString());
        });

        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[저장 거부]') ||
                text.includes('[검증') ||
                text.includes('필터링') ||
                text.includes('빈 필지')) {
                console.log(`[콘솔]: ${text}`);
            }
        });
    });

    test('시나리오 1: 완전히 빈 필지 저장 시도 (차단되어야 함)', async ({ page }) => {
        console.log('\n🧪 테스트: 빈 필지 저장 차단');

        const result = await page.evaluate(() => {
            const emptyParcel = {
                pnu: 'test-empty-001',
                parcelNumber: '',
                ownerName: '',
                ownerAddress: '',
                ownerContact: '',
                memo: '',
                color: null,
                is_colored: false
            };

            const isValid = window.ParcelValidationUtils.isParcelWorthSaving(emptyParcel);
            return { isValid, pnu: emptyParcel.pnu };
        });

        expect(result.isValid).toBeFalsy();
        console.log(`✅ 빈 필지 저장 차단됨: ${result.pnu}`);
    });

    test('시나리오 2: 색상만 있는 필지 저장 (통과해야 함)', async ({ page }) => {
        console.log('\n🧪 테스트: 색상만 있는 필지 저장');

        const result = await page.evaluate(() => {
            const coloredParcel = {
                pnu: 'test-colored-001',
                parcelNumber: '',
                ownerName: '',
                memo: '',
                color: '#FF5733',
                is_colored: true
            };

            const isValid = window.ParcelValidationUtils.isParcelWorthSaving(coloredParcel);
            return { isValid, color: coloredParcel.color };
        });

        expect(result.isValid).toBeTruthy();
        console.log(`✅ 색상 필지 저장 허용: ${result.color}`);
    });

    test('시나리오 3: 메모만 있는 필지 저장 (통과해야 함)', async ({ page }) => {
        console.log('\n🧪 테스트: 메모만 있는 필지 저장');

        const result = await page.evaluate(() => {
            const memoParcel = {
                pnu: 'test-memo-001',
                parcelNumber: '',
                ownerName: '',
                memo: '중요한 필지입니다',
                color: null,
                is_colored: false
            };

            const isValid = window.ParcelValidationUtils.isParcelWorthSaving(memoParcel);
            return { isValid, memo: memoParcel.memo };
        });

        expect(result.isValid).toBeTruthy();
        console.log(`✅ 메모 필지 저장 허용: "${result.memo}"`);
    });

    test('시나리오 4: 소유자명만 있는 필지 (기본값은 차단, 실제 이름은 허용)', async ({ page }) => {
        console.log('\n🧪 테스트: 소유자명 검증');

        const result = await page.evaluate(() => {
            const defaultOwner = {
                pnu: 'test-owner-001',
                ownerName: '홍길동',
                memo: ''
            };

            const realOwner = {
                pnu: 'test-owner-002',
                ownerName: '김철수',
                memo: ''
            };

            return {
                defaultValid: window.ParcelValidationUtils.isParcelWorthSaving(defaultOwner),
                realValid: window.ParcelValidationUtils.isParcelWorthSaving(realOwner),
                defaultName: defaultOwner.ownerName,
                realName: realOwner.ownerName
            };
        });

        expect(result.defaultValid).toBeFalsy();
        expect(result.realValid).toBeTruthy();
        console.log(`✅ 기본값 차단: "${result.defaultName}"`);
        console.log(`✅ 실제 이름 허용: "${result.realName}"`);
    });

    test('시나리오 5: 배치 필터링 (10개 중 유효한 것만 추출)', async ({ page }) => {
        console.log('\n🧪 테스트: 대량 필지 배치 필터링');

        const result = await page.evaluate(() => {
            const parcels = [
                { pnu: '1', color: '#FF0000', is_colored: true },
                { pnu: '2' },
                { pnu: '3', memo: '중요' },
                { pnu: '4', ownerName: '홍길동' },
                { pnu: '5', ownerName: '김철수' },
                { pnu: '6' },
                { pnu: '7', parcelNumber: '123-4', ownerName: '' },
                { pnu: '8', color: '#00FF00', is_colored: true },
                { pnu: '9' },
                { pnu: '10', memo: '테스트' }
            ];

            const validParcels = window.ParcelValidationUtils.filterValidParcels(parcels);

            return {
                total: parcels.length,
                valid: validParcels.length,
                invalid: parcels.length - validParcels.length,
                validPnus: validParcels.map(p => p.pnu)
            };
        });

        console.log(`📊 총 ${result.total}개 중 ${result.valid}개 유효, ${result.invalid}개 무효`);
        console.log(`✅ 유효한 필지: ${result.validPnus.join(', ')}`);

        expect(result.valid).toBeGreaterThan(0);
        expect(result.valid).toBeLessThan(result.total);
    });

    test('시나리오 6: 검증 통계 수집 및 확인', async ({ page }) => {
        console.log('\n🧪 테스트: 검증 통계 수집');

        const stats = await page.evaluate(() => {
            window.ParcelValidationUtils.resetStats();

            const testCases = [
                { pnu: '1', color: '#FF0000', is_colored: true },
                { pnu: '2' },
                { pnu: '3', memo: '메모' },
                { pnu: '4' },
                { pnu: '5', ownerName: '김철수' }
            ];

            testCases.forEach(parcel => {
                const isValid = window.ParcelValidationUtils.isParcelWorthSaving(parcel);
                window.ParcelValidationUtils.updateStats(isValid);
            });

            return window.ParcelValidationUtils.getStats();
        });

        console.log(`📊 통계:`);
        console.log(`   총 검증: ${stats.totalChecks}회`);
        console.log(`   통과: ${stats.validParcels}개`);
        console.log(`   거부: ${stats.rejectedParcels}개`);
        console.log(`   거부율: ${((stats.rejectedParcels / stats.totalChecks) * 100).toFixed(1)}%`);

        expect(stats.totalChecks).toBe(5);
        expect(stats.validParcels).toBe(3);
        expect(stats.rejectedParcels).toBe(2);
    });

    test('시나리오 7: 실시간 통합 검증 플로우', async ({ page }) => {
        console.log('\n🧪 테스트: 실시간 통합 검증');

        await page.screenshot({
            path: 'test-screenshots/comprehensive-test.png',
            fullPage: true
        });

        const result = await page.evaluate(() => {
            const scenarios = {
                emptyParcel: { pnu: 'e1' },
                coloredParcel: { pnu: 'c1', color: '#FF0000', is_colored: true },
                infoParcel: { pnu: 'i1', memo: '정보' },
                mixedParcel: { pnu: 'm1', color: '#00FF00', is_colored: true, memo: '복합' }
            };

            return {
                empty: window.ParcelValidationUtils.isParcelWorthSaving(scenarios.emptyParcel),
                colored: window.ParcelValidationUtils.isParcelWorthSaving(scenarios.coloredParcel),
                info: window.ParcelValidationUtils.isParcelWorthSaving(scenarios.infoParcel),
                mixed: window.ParcelValidationUtils.isParcelWorthSaving(scenarios.mixedParcel),
                utilsLoaded: typeof window.ParcelValidationUtils !== 'undefined'
            };
        });

        console.log('✅ 검증 결과:');
        console.log(`   - 빈 필지: ${result.empty ? '❌ 통과(오류)' : '✅ 차단'}`);
        console.log(`   - 색칠 필지: ${result.colored ? '✅ 통과' : '❌ 차단(오류)'}`);
        console.log(`   - 정보 필지: ${result.info ? '✅ 통과' : '❌ 차단(오류)'}`);
        console.log(`   - 복합 필지: ${result.mixed ? '✅ 통과' : '❌ 차단(오류)'}`);

        expect(result.empty).toBeFalsy();
        expect(result.colored).toBeTruthy();
        expect(result.info).toBeTruthy();
        expect(result.mixed).toBeTruthy();
        expect(result.utilsLoaded).toBeTruthy();

        console.log('\n✨ 전체 검증 시스템 정상 작동!');
    });
});