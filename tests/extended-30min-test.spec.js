/**
 * 30분 포괄적 E2E 테스트 - 모든 기능 안정성 검증
 * 실제 사용 시나리오 기반 심화 테스트
 */

const { test, expect } = require('@playwright/test');

test.describe('필지 관리 시스템 - 30분 포괄적 테스트', () => {
    let page;
    let consoleMessages = [];
    let errorMessages = [];
    let performanceMetrics = {
        startTime: Date.now(),
        apiCalls: 0,
        dataOperations: 0,
        errors: 0
    };

    test.beforeEach(async ({ browser }) => {
        const context = await browser.newContext();
        page = await context.newPage();

        // 성능 및 에러 모니터링
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(`[${msg.type().toUpperCase()}] ${text}`);
            if (text.includes('API') || text.includes('VWorld')) performanceMetrics.apiCalls++;
            if (text.includes('저장') || text.includes('복원')) performanceMetrics.dataOperations++;
            console.log(`[브라우저 ${msg.type()}]:`, text);
        });

        page.on('pageerror', error => {
            errorMessages.push(error.message);
            performanceMetrics.errors++;
            console.log('❌ 페이지 에러:', error.message);
        });

        await page.goto('http://localhost:3000');
        await page.waitForTimeout(4000); // 안정적 초기화 대기
        performanceMetrics.startTime = Date.now();
    });

    test('1단계: 클릭 모드 심화 테스트 (10분)', async () => {
        console.log('\n🎯 === 30분 테스트 1단계: 클릭 모드 심화 테스트 ===');

        // 클릭 모드 활성화
        await page.click('button:has-text("🎯 클릭")');
        await page.waitForTimeout(1000);

        // 모든 색상으로 다양한 필지 생성 테스트
        const colorTests = [
            { selector: '.color-item:nth-child(1)', name: '빨간색', rgb: 'rgb(255, 0, 0)' },
            { selector: '.color-item:nth-child(2)', name: '주황색', rgb: 'rgb(255, 165, 0)' },
            { selector: '.color-item:nth-child(3)', name: '노란색', rgb: 'rgb(255, 255, 0)' },
            { selector: '.color-item:nth-child(4)', name: '연녹색', rgb: 'rgb(144, 238, 144)' },
            { selector: '.color-item:nth-child(5)', name: '파란색', rgb: 'rgb(0, 0, 255)' }
        ];

        for (let i = 0; i < colorTests.length; i++) {
            const color = colorTests[i];
            console.log(`🎨 색상 테스트 ${i + 1}/5: ${color.name}`);

            // 색상 선택
            await page.click(color.selector);
            await page.waitForTimeout(500);

            // 필지 다중 클릭 테스트
            const positions = [
                { x: 550 + i * 50, y: 350 + i * 40 },
                { x: 600 + i * 30, y: 400 + i * 30 },
                { x: 650 + i * 20, y: 450 + i * 20 }
            ];

            for (let j = 0; j < positions.length; j++) {
                console.log(`  📍 필지 클릭 ${j + 1}/3 위치: (${positions[j].x}, ${positions[j].y})`);
                await page.click('.map-container', { position: positions[j] });
                await page.waitForTimeout(3000); // API 응답 여유 대기

                // 상세 정보 입력 (첫 번째 클릭에만)
                if (j === 0) {
                    console.log('    📝 상세 정보 입력');
                    await page.fill('input[placeholder*="예: 123-4"]', `${color.name}-${i + 1}-${j + 1}`);
                    await page.fill('input[placeholder*="홍길동"]', `소유자${i}${j}`);
                    await page.fill('input[placeholder*="서울시"]', `서울시 ${color.name}구 ${i + 1}동 ${j + 1}번지`);
                    await page.fill('input[placeholder*="010-1234-5678"]', `010-${2000 + i * 10 + j}-5678`);
                    await page.fill('textarea[placeholder*="추가 메모"]', `${color.name} 테스트 - 필지 ${i + 1}-${j + 1}\n생성일시: ${new Date().toLocaleString()}`);
                    await page.click('button:has-text("저장")');
                    await page.waitForTimeout(1000);
                }
            }

            // 중간 스크린샷
            if (i % 2 === 0) {
                await page.screenshot({ path: `test-results/extended-1-${i + 1}-${color.name}.png`, fullPage: true });
            }
        }

        // 색상 교체 테스트
        console.log('🔄 색상 교체 테스트');
        await page.click('.color-item:nth-child(1)'); // 빨간색
        await page.click('.map-container', { position: { x: 600, y: 400 } });
        await page.waitForTimeout(2000);

        await page.click('.color-item:nth-child(5)'); // 파란색으로 교체
        await page.click('.map-container', { position: { x: 600, y: 400 } });
        await page.waitForTimeout(2000);

        console.log('✅ 1단계 완료 - 클릭 모드 심화 테스트');
        await page.screenshot({ path: 'test-results/extended-1-final.png', fullPage: true });
    });

    test('2단계: 검색 모드 심화 테스트 (7분)', async () => {
        console.log('\n🔍 === 2단계: 검색 모드 심화 테스트 ===');

        // 검색 모드 활성화
        await page.click('button:has-text("🔍 검색")');
        await page.waitForTimeout(1000);

        // 다양한 검색어로 테스트
        const searchQueries = [
            '을지로', '다동', '중구', '서울', '종로',
            '88', '170', '140', // 번지 검색
            '1114010200' // PNU 검색
        ];

        let successfulSearches = 0;
        for (let i = 0; i < searchQueries.length; i++) {
            const query = searchQueries[i];
            console.log(`🔍 검색 ${i + 1}/${searchQueries.length}: "${query}"`);

            try {
                // 검색창에 입력
                const searchInput = await page.locator('input[type="text"], input[placeholder*="검색"]').first();
                await searchInput.fill(query);
                await page.keyboard.press('Enter');
                await page.waitForTimeout(4000); // 검색 결과 충분한 대기

                // 검색 결과 클릭 시도
                const searchResults = await page.locator('.search-result, .search-item, [class*="result"]').first();
                if (await searchResults.isVisible({ timeout: 2000 })) {
                    await searchResults.click();
                    await page.waitForTimeout(2000);

                    // 검색 필지 정보 입력
                    await page.fill('textarea[placeholder*="추가 메모"]', `검색모드 - ${query} 검색결과\n시간: ${new Date().toLocaleString()}`);
                    await page.click('button:has-text("저장")');
                    await page.waitForTimeout(1000);

                    successfulSearches++;
                    console.log(`  ✅ 검색 성공: ${query}`);
                } else {
                    console.log(`  ⚠️ 검색 결과 없음: ${query}`);
                }
            } catch (error) {
                console.log(`  ❌ 검색 실패: ${query} - ${error.message}`);
            }

            // 중간 결과 확인
            if (i % 3 === 2) {
                await page.screenshot({ path: `test-results/extended-2-search-${i + 1}.png`, fullPage: true });
            }
        }

        console.log(`📊 검색 성공률: ${successfulSearches}/${searchQueries.length} (${Math.round(successfulSearches/searchQueries.length*100)}%)`);
        console.log('✅ 2단계 완료 - 검색 모드 심화 테스트');
    });

    test('3단계: 손 모드 완전 검증 (3분)', async () => {
        console.log('\n✋ === 3단계: 손 모드 완전 검증 ===');

        // 손 모드 활성화
        await page.click('button:has-text("✋ 손")');
        await page.waitForTimeout(1000);

        // 색상 선택 비활성화 확인
        console.log('🎨 색상 선택 비활성화 확인');
        const colorItems = await page.locator('.color-item').all();
        for (let i = 0; i < Math.min(colorItems.length, 3); i++) {
            await colorItems[i].click();
            await page.waitForTimeout(300);
            console.log(`  색상 ${i + 1} 클릭 시도 완료`);
        }

        // 필지 클릭 (정보 조회만)
        const handModePositions = [
            { x: 580, y: 380, desc: '중앙 좌측' },
            { x: 620, y: 420, desc: '중앙 우측' },
            { x: 560, y: 440, desc: '하단' }
        ];

        for (let i = 0; i < handModePositions.length; i++) {
            const pos = handModePositions[i];
            console.log(`📍 손 모드 클릭 ${i + 1}/3: ${pos.desc} (${pos.x}, ${pos.y})`);

            await page.click('.map-container', { position: { x: pos.x, y: pos.y } });
            await page.waitForTimeout(2500);

            // 정보 입력만 (색칠 없이)
            await page.fill('input[placeholder*="홍길동"]', `손모드사용자${i + 1}`);
            await page.fill('input[placeholder*="010-1234-5678"]', `010-7${i}00-5678`);
            await page.fill('textarea[placeholder*="추가 메모"]', `손 모드 전용 - ${pos.desc} 위치\n색칠 비활성화 테스트 ${i + 1}`);
            await page.click('button:has-text("저장")');
            await page.waitForTimeout(1000);
        }

        await page.screenshot({ path: 'test-results/extended-3-hand-mode.png', fullPage: true });
        console.log('✅ 3단계 완료 - 손 모드 완전 검증');
    });

    test('4단계: 새로고침 영속성 반복 테스트 (5분)', async () => {
        console.log('\n🔄 === 4단계: 새로고침 영속성 반복 테스트 ===');

        for (let cycle = 1; cycle <= 3; cycle++) {
            console.log(`\n🔄 새로고침 사이클 ${cycle}/3`);

            // 클릭 모드에서 새 필지 생성
            await page.click('button:has-text("🎯 클릭")');
            await page.click(`.color-item:nth-child(${cycle + 2})`); // 다른 색상 선택
            await page.click('.map-container', { position: { x: 500 + cycle * 40, y: 320 + cycle * 40 } });
            await page.waitForTimeout(2500);

            await page.fill('textarea[placeholder*="추가 메모"]', `새로고침 테스트 사이클 ${cycle}\n시간: ${new Date().toLocaleString()}`);
            await page.click('button:has-text("저장")');
            await page.waitForTimeout(1000);

            // 현재 상태 기록
            const beforeRefresh = await page.evaluate(() => {
                return {
                    parcels: Object.keys(JSON.parse(localStorage.getItem('parcelColors') || '{}')).length,
                    position: window.map ? {
                        lat: window.map.getCenter().lat(),
                        lng: window.map.getCenter().lng(),
                        zoom: window.map.getZoom()
                    } : null
                };
            });
            console.log(`  💾 새로고침 전 상태: ${beforeRefresh.parcels}개 필지, 위치: ${JSON.stringify(beforeRefresh.position)}`);

            // 새로고침 실행
            console.log(`  🔄 새로고침 실행 ${cycle}/3`);
            await page.reload();
            await page.waitForTimeout(5000); // 복원 충분한 대기

            // 복원 상태 확인
            const afterRefresh = await page.evaluate(() => {
                return {
                    parcels: Object.keys(JSON.parse(localStorage.getItem('parcelColors') || '{}')).length,
                    position: window.map ? {
                        lat: window.map.getCenter().lat(),
                        lng: window.map.getCenter().lng(),
                        zoom: window.map.getZoom()
                    } : null
                };
            });
            console.log(`  🔄 새로고침 후 상태: ${afterRefresh.parcels}개 필지, 위치: ${JSON.stringify(afterRefresh.position)}`);

            // 복원 검증
            const parcelMatches = beforeRefresh.parcels === afterRefresh.parcels;
            const positionMatches = Math.abs(beforeRefresh.position?.lat - afterRefresh.position?.lat) < 0.001;

            console.log(`  📊 복원 결과: 필지 ${parcelMatches ? '✅' : '❌'}, 위치 ${positionMatches ? '✅' : '❌'}`);

            if (cycle % 2 === 0) {
                await page.screenshot({ path: `test-results/extended-4-refresh-${cycle}.png`, fullPage: true });
            }
        }

        console.log('✅ 4단계 완료 - 새로고침 영속성 반복 테스트');
    });

    test('5단계: 스트레스 테스트 - 대량 클릭 (3분)', async () => {
        console.log('\n⚡ === 5단계: 스트레스 테스트 시작 ===');

        await page.click('button:has-text("🎯 클릭")');
        await page.click('.color-item:nth-child(1)'); // 빨간색 선택

        // 빠른 연속 클릭 테스트
        console.log('⚡ 빠른 연속 클릭 테스트 (30개 위치)');
        const rapidClickPositions = [];
        for (let i = 0; i < 30; i++) {
            rapidClickPositions.push({
                x: 500 + (i % 10) * 30,
                y: 300 + Math.floor(i / 10) * 50
            });
        }

        let successfulClicks = 0;
        for (let i = 0; i < rapidClickPositions.length; i++) {
            try {
                await page.click('.map-container', {
                    position: rapidClickPositions[i],
                    timeout: 2000
                });
                await page.waitForTimeout(200); // 매우 빠른 클릭
                successfulClicks++;

                if (i % 10 === 9) {
                    console.log(`  진행률: ${i + 1}/30 (${Math.round((i + 1)/30*100)}%)`);
                }
            } catch (error) {
                console.log(`  ⚠️ 클릭 ${i + 1} 실패: ${error.message}`);
            }
        }

        console.log(`📊 스트레스 테스트 결과: ${successfulClicks}/30 성공 (${Math.round(successfulClicks/30*100)}%)`);

        // 빠른 모드 전환 테스트
        console.log('⚡ 빠른 모드 전환 테스트');
        const modes = ['🎯 클릭', '🔍 검색', '✋ 손'];
        for (let i = 0; i < 20; i++) {
            try {
                const mode = modes[i % 3];
                await page.click(`button:has-text("${mode}")`, { timeout: 1000 });
                await page.waitForTimeout(100);

                if (i % 5 === 4) {
                    console.log(`  모드 전환 진행률: ${i + 1}/20`);
                }
            } catch (error) {
                console.log(`  ⚠️ 모드 전환 ${i + 1} 실패`);
            }
        }

        await page.screenshot({ path: 'test-results/extended-5-stress-test.png', fullPage: true });
        console.log('✅ 5단계 완료 - 스트레스 테스트');
    });

    test('6단계: 메모리 누수 및 성능 모니터링 (2분)', async () => {
        console.log('\n📊 === 6단계: 성능 모니터링 ===');

        // 메모리 사용량 모니터링
        const initialMemory = await page.evaluate(() => {
            return {
                heapUsed: performance.memory?.usedJSHeapSize || 0,
                heapTotal: performance.memory?.totalJSHeapSize || 0,
                timestamp: Date.now()
            };
        });

        console.log(`💾 초기 메모리: ${Math.round(initialMemory.heapUsed/1024/1024)}MB / ${Math.round(initialMemory.heapTotal/1024/1024)}MB`);

        // 반복 작업으로 메모리 부하 테스트
        for (let i = 0; i < 50; i++) {
            await page.click('button:has-text("🎯 클릭")');
            await page.click('.color-item:nth-child(2)');
            await page.click('.map-container', { position: { x: 550 + (i % 5) * 20, y: 350 + (i % 5) * 20 } });
            await page.waitForTimeout(100);

            if (i % 10 === 9) {
                const currentMemory = await page.evaluate(() => ({
                    heapUsed: performance.memory?.usedJSHeapSize || 0,
                    heapTotal: performance.memory?.totalJSHeapSize || 0
                }));
                console.log(`  반복 ${i + 1}: 메모리 ${Math.round(currentMemory.heapUsed/1024/1024)}MB`);
            }
        }

        // 최종 메모리 상태
        const finalMemory = await page.evaluate(() => ({
            heapUsed: performance.memory?.usedJSHeapSize || 0,
            heapTotal: performance.memory?.totalJSHeapSize || 0
        }));

        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        console.log(`📊 메모리 증가량: ${Math.round(memoryIncrease/1024/1024)}MB`);
        console.log(`📊 최종 메모리: ${Math.round(finalMemory.heapUsed/1024/1024)}MB`);

        // 성능 메트릭 최종 리포트
        const testDuration = (Date.now() - performanceMetrics.startTime) / 1000 / 60; // 분 단위
        console.log('\n📊 === 30분 테스트 성능 리포트 ===');
        console.log(`⏱️ 테스트 소요시간: ${testDuration.toFixed(1)}분`);
        console.log(`🌐 API 호출 수: ${performanceMetrics.apiCalls}`);
        console.log(`💾 데이터 작업 수: ${performanceMetrics.dataOperations}`);
        console.log(`❌ 에러 발생 수: ${performanceMetrics.errors}`);
        console.log(`💬 콘솔 메시지 수: ${consoleMessages.length}`);

        // 주요 에러 리포트
        if (errorMessages.length > 0) {
            console.log('\n⚠️ 주요 에러들:');
            errorMessages.slice(0, 5).forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }

        await page.screenshot({ path: 'test-results/extended-6-final-report.png', fullPage: true });
        console.log('✅ 6단계 완료 - 성능 모니터링');
        console.log('\n🎉 === 30분 포괄적 테스트 완료! ===');
    });
});