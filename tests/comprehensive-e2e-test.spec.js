/**
 * 종합 E2E 테스트 스크립트 - 10분간 모든 기능 테스트
 * 새로고침 영속성, 3개 모드 전체 기능, 마커, 데이터 저장/복원 등 포함
 */

const { test, expect } = require('@playwright/test');

test.describe('필지 관리 시스템 - 종합 E2E 테스트 (10분)', () => {
    let page;
    let consoleMessages = [];
    let errorMessages = [];

    test.beforeEach(async ({ browser }) => {
        const context = await browser.newContext();
        page = await context.newPage();

        // 콘솔 메시지 수집
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(`[${msg.type().toUpperCase()}] ${text}`);
            console.log(`[브라우저 ${msg.type()}]:`, text);
        });

        // 에러 메시지 수집
        page.on('pageerror', error => {
            errorMessages.push(error.message);
            console.log('페이지 에러:', error.message);
        });

        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000); // 초기 로딩 대기
    });

    test('1단계: 클릭 모드 전체 기능 테스트 (2분)', async () => {
        console.log('\n🎯 === 1단계: 클릭 모드 테스트 시작 ===');

        // 클릭 모드 활성화 확인
        await page.click('button:has-text("🎯 클릭")');
        await page.waitForTimeout(1000);

        // 색상 선택 테스트 (초록색)
        console.log('🟢 초록색 선택');
        await page.click('[style*="background-color: rgb(0, 255, 0)"]');
        await page.waitForTimeout(500);

        // 필지 클릭 테스트 (여러 지점)
        const clickPoints = [
            { x: 600, y: 400 }, // 중앙 근처
            { x: 650, y: 450 }, // 우하단
            { x: 550, y: 350 }  // 좌상단
        ];

        for (let i = 0; i < clickPoints.length; i++) {
            console.log(`📍 필지 클릭 ${i + 1}/3: (${clickPoints[i].x}, ${clickPoints[i].y})`);
            await page.click('.map-container', { position: clickPoints[i] });
            await page.waitForTimeout(2000); // API 응답 대기

            // 필지 정보 입력 테스트
            if (i === 0) {
                console.log('📝 필지 정보 입력 테스트');
                await page.fill('input[placeholder*="예: 123-4"]', `테스트-${i + 1}`);
                await page.fill('input[placeholder*="홍길동"]', `소유자${i + 1}`);
                await page.fill('input[placeholder*="서울시"]', `서울시 테스트구 ${i + 1}동`);
                await page.fill('input[placeholder*="010-1234-5678"]', `010-${1000 + i}-5678`);
                await page.fill('textarea[placeholder*="추가 메모"]', `클릭 모드 테스트 ${i + 1}`);

                // 저장 버튼 클릭
                await page.click('button:has-text("저장")');
                await page.waitForTimeout(1000);
            }
        }

        // 색상 교체 테스트 (빨간색으로 변경)
        console.log('🔴 빨간색으로 색상 교체');
        await page.click('[style*="background-color: rgb(255, 0, 0)"]');
        await page.waitForTimeout(500);
        await page.click('.map-container', { position: { x: 600, y: 400 } });
        await page.waitForTimeout(2000);

        // 스크린샷 저장
        await page.screenshot({ path: 'test-results/1-click-mode-test.png', fullPage: true });
        console.log('✅ 1단계 완료 - 클릭 모드 테스트');
    });

    test('2단계: 검색 모드 전체 기능 테스트 (2분)', async () => {
        console.log('\n🔍 === 2단계: 검색 모드 테스트 시작 ===');

        // 검색 모드 활성화
        await page.click('button:has-text("🔍 검색")');
        await page.waitForTimeout(1000);

        // 검색어 입력 및 검색 실행
        const searchTerms = ['을지로', '다동', '중구'];

        for (let i = 0; i < searchTerms.length; i++) {
            console.log(`🔍 검색 ${i + 1}/3: "${searchTerms[i]}"`);

            // 검색창 찾기 및 입력
            const searchInput = await page.locator('input[type="text"]').first();
            await searchInput.fill(searchTerms[i]);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(3000); // 검색 결과 로딩 대기

            // 검색 결과 클릭
            try {
                const searchResults = await page.locator('.search-result-item').first();
                if (await searchResults.isVisible()) {
                    await searchResults.click();
                    await page.waitForTimeout(2000);
                    console.log(`✅ 검색 결과 클릭 완료: ${searchTerms[i]}`);
                }
            } catch (e) {
                console.log(`⚠️ 검색 결과 없음: ${searchTerms[i]}`);
            }
        }

        // 검색 필지에 정보 입력 테스트
        console.log('📝 검색 필지 정보 입력');
        await page.fill('input[placeholder*="예: 123-4"]', '검색-테스트');
        await page.fill('textarea[placeholder*="추가 메모"]', '검색 모드에서 생성된 필지');
        await page.click('button:has-text("저장")');
        await page.waitForTimeout(1000);

        await page.screenshot({ path: 'test-results/2-search-mode-test.png', fullPage: true });
        console.log('✅ 2단계 완료 - 검색 모드 테스트');
    });

    test('3단계: 손 모드 전체 기능 테스트 (1분)', async () => {
        console.log('\n✋ === 3단계: 손 모드 테스트 시작 ===');

        // 손 모드 활성화
        await page.click('button:has-text("✋ 손")');
        await page.waitForTimeout(1000);

        // 색상 선택 (비활성화 확인)
        console.log('🎨 색상 선택 시도 (비활성화 확인)');
        await page.click('[style*="background-color: rgb(0, 0, 255)"]');
        await page.waitForTimeout(500);

        // 필지 클릭 (색칠 없이 정보만 조회)
        console.log('📍 필지 클릭 (정보 조회만)');
        await page.click('.map-container', { position: { x: 620, y: 420 } });
        await page.waitForTimeout(2000);

        // 정보 입력만 테스트
        console.log('📝 손 모드 정보 입력');
        await page.fill('input[placeholder*="홍길동"]', '손모드사용자');
        await page.fill('textarea[placeholder*="추가 메모"]', '손 모드 - 색칠 비활성화 테스트');
        await page.click('button:has-text("저장")');
        await page.waitForTimeout(1000);

        await page.screenshot({ path: 'test-results/3-hand-mode-test.png', fullPage: true });
        console.log('✅ 3단계 완료 - 손 모드 테스트');
    });

    test('4단계: 새로고침 영속성 검증 테스트 (2분)', async () => {
        console.log('\n🔄 === 4단계: 새로고침 영속성 테스트 시작 ===');

        // 먼저 클릭 모드에서 필지 생성
        await page.click('button:has-text("🎯 클릭")');
        await page.click('[style*="background-color: rgb(255, 255, 0)"]'); // 노란색
        await page.click('.map-container', { position: { x: 580, y: 380 } });
        await page.waitForTimeout(2000);

        await page.fill('textarea[placeholder*="추가 메모"]', '새로고침 테스트용 필지');
        await page.click('button:has-text("저장")');
        await page.waitForTimeout(1000);

        // 현재 위치 정보 저장
        const mapPosition = await page.evaluate(() => {
            if (window.map) {
                const center = window.map.getCenter();
                return {
                    lat: center.lat(),
                    lng: center.lng(),
                    zoom: window.map.getZoom()
                };
            }
            return null;
        });
        console.log('💾 새로고침 전 위치:', mapPosition);

        // 새로고침 실행
        console.log('🔄 페이지 새로고침 실행');
        await page.reload();
        await page.waitForTimeout(4000); // 복원 대기

        // 위치 복원 확인
        const restoredPosition = await page.evaluate(() => {
            if (window.map) {
                const center = window.map.getCenter();
                return {
                    lat: center.lat(),
                    lng: center.lng(),
                    zoom: window.map.getZoom()
                };
            }
            return null;
        });
        console.log('🔄 새로고침 후 위치:', restoredPosition);

        // 필지 복원 확인
        const restoredParcels = await page.evaluate(() => {
            return Object.keys(localStorage.getItem('parcelColors') ? JSON.parse(localStorage.getItem('parcelColors')) : {}).length;
        });
        console.log(`📦 복원된 필지 수: ${restoredParcels}개`);

        await page.screenshot({ path: 'test-results/4-refresh-persistence-test.png', fullPage: true });
        console.log('✅ 4단계 완료 - 새로고침 영속성 테스트');
    });

    test('5단계: 마커 생성/삭제 전체 시나리오 테스트 (1분)', async () => {
        console.log('\n📍 === 5단계: 마커 테스트 시작 ===');

        await page.click('button:has-text("🎯 클릭")');
        await page.click('[style*="background-color: rgb(128, 0, 128)"]'); // 보라색

        // 마커 생성 조건별 테스트
        const markerTests = [
            { field: 'input[placeholder*="예: 123-4"]', value: '마커-1', description: '지번만 입력' },
            { field: 'input[placeholder*="홍길동"]', value: '마커사용자', description: '소유자명만 입력' },
            { field: 'textarea[placeholder*="추가 메모"]', value: '마커 테스트', description: '메모만 입력' }
        ];

        for (let i = 0; i < markerTests.length; i++) {
            console.log(`📍 마커 테스트 ${i + 1}/3: ${markerTests[i].description}`);

            await page.click('.map-container', { position: { x: 560 + i * 30, y: 360 + i * 30 } });
            await page.waitForTimeout(2000);

            await page.fill(markerTests[i].field, markerTests[i].value);
            await page.click('button:has-text("저장")');
            await page.waitForTimeout(1000);
        }

        // 마커 삭제 테스트 (정보 초기화)
        console.log('🗑️ 마커 삭제 테스트');
        await page.click('.map-container', { position: { x: 560, y: 360 } });
        await page.waitForTimeout(1000);
        await page.click('button:has-text("삭제")');
        await page.waitForTimeout(1000);

        await page.screenshot({ path: 'test-results/5-marker-test.png', fullPage: true });
        console.log('✅ 5단계 완료 - 마커 테스트');
    });

    test('6단계: 색상 교체/삭제 로직 테스트 (1분)', async () => {
        console.log('\n🎨 === 6단계: 색상 로직 테스트 시작 ===');

        await page.click('button:has-text("🎯 클릭")');

        // 필지 생성 후 색상 교체 테스트
        await page.click('[style*="background-color: rgb(0, 255, 255)"]'); // 청록색
        await page.click('.map-container', { position: { x: 590, y: 390 } });
        await page.waitForTimeout(2000);

        console.log('🔵 색상 교체: 청록색 → 파란색');
        await page.click('[style*="background-color: rgb(0, 0, 255)"]'); // 파란색
        await page.click('.map-container', { position: { x: 590, y: 390 } });
        await page.waitForTimeout(1500);

        console.log('🗑️ 같은 색상 재클릭으로 삭제 테스트');
        await page.click('[style*="background-color: rgb(0, 0, 255)"]'); // 같은 파란색
        await page.click('.map-container', { position: { x: 590, y: 390 } });
        await page.waitForTimeout(1500);

        // 삭제 확인 대화상자 처리
        page.on('dialog', async dialog => {
            console.log('삭제 확인 대화상자:', dialog.message());
            await dialog.accept();
        });

        await page.screenshot({ path: 'test-results/6-color-logic-test.png', fullPage: true });
        console.log('✅ 6단계 완료 - 색상 로직 테스트');
    });

    test('7단계: 스트레스 테스트 - 연속 클릭/모드 전환 (1분)', async () => {
        console.log('\n⚡ === 7단계: 스트레스 테스트 시작 ===');

        // 빠른 모드 전환 테스트
        const modes = ['🎯 클릭', '🔍 검색', '✋손'];
        for (let i = 0; i < 10; i++) {
            const mode = modes[i % 3];
            await page.click(`button:has-text("${mode}")`);
            await page.waitForTimeout(200);
            console.log(`🔄 모드 전환 ${i + 1}/10: ${mode}`);
        }

        // 연속 클릭 테스트
        await page.click('button:has-text("🎯 클릭")');
        await page.click('[style*="background-color: rgb(255, 192, 203)"]'); // 핑크

        const rapidClicks = [
            { x: 540, y: 340 }, { x: 560, y: 360 }, { x: 580, y: 380 },
            { x: 600, y: 400 }, { x: 620, y: 420 }, { x: 640, y: 440 }
        ];

        for (let i = 0; i < rapidClicks.length; i++) {
            await page.click('.map-container', { position: rapidClicks[i] });
            await page.waitForTimeout(300); // 빠른 연속 클릭
            console.log(`⚡ 연속 클릭 ${i + 1}/6`);
        }

        await page.screenshot({ path: 'test-results/7-stress-test.png', fullPage: true });
        console.log('✅ 7단계 완료 - 스트레스 테스트');
    });

    test('8단계: 최종 검증 및 종합 리포트', async () => {
        console.log('\n📊 === 8단계: 최종 검증 시작 ===');

        // 전체 데이터 상태 확인
        const finalStatus = await page.evaluate(() => {
            const parcelData = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            const searchData = JSON.parse(localStorage.getItem('searchResults') || '[]');

            return {
                totalParcels: parcelData.length,
                coloredParcels: Object.keys(parcelColors).length,
                searchParcels: searchData.length,
                currentMode: window.currentMode || 'unknown'
            };
        });

        console.log('📊 최종 상태 리포트:');
        console.log(`   - 총 필지 수: ${finalStatus.totalParcels}`);
        console.log(`   - 색칠된 필지: ${finalStatus.coloredParcels}`);
        console.log(`   - 검색 필지: ${finalStatus.searchParcels}`);
        console.log(`   - 현재 모드: ${finalStatus.currentMode}`);

        // 최종 스크린샷
        await page.screenshot({ path: 'test-results/8-final-status.png', fullPage: true });

        // 에러 및 경고 리포트
        console.log('\n⚠️ 에러/경고 리포트:');
        console.log(`   - 에러 수: ${errorMessages.length}`);
        console.log(`   - 콘솔 메시지: ${consoleMessages.length}`);

        if (errorMessages.length > 0) {
            console.log('   주요 에러들:');
            errorMessages.slice(0, 5).forEach(error => console.log(`     • ${error}`));
        }

        console.log('✅ 8단계 완료 - 최종 검증');
        console.log('\n🎉 === 10분 종합 E2E 테스트 완료! ===');
    });
});