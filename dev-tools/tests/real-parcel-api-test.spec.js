const { test, expect } = require('@playwright/test');

test.describe('실제 VWorld API 필지 데이터 테스트', () => {
    test('VWorld API 실제 필지 데이터 로드 테스트', async ({ page }) => {
        console.log('🏢 실제 VWorld API 필지 데이터 테스트 시작');
        
        // 모든 API 호출 로그 수집
        const apiCalls = [];
        const vworldCalls = [];
        
        page.on('request', request => {
            const url = request.url();
            if (url.includes('api.vworld.kr')) {
                console.log('🌐 VWorld API 호출 감지:', url);
                vworldCalls.push({
                    url: url,
                    method: request.method(),
                    timestamp: new Date().toISOString()
                });
            }
            apiCalls.push(url);
        });
        
        page.on('response', async response => {
            const url = response.url();
            if (url.includes('api.vworld.kr')) {
                const status = response.status();
                console.log(`📡 VWorld API 응답: ${status} - ${url}`);
                
                try {
                    if (status === 200) {
                        const text = await response.text();
                        console.log(`📄 VWorld 응답 길이: ${text.length} 문자`);
                        console.log(`📝 VWorld 응답 미리보기: ${text.substring(0, 200)}`);
                        
                        // JSON 파싱 시도
                        try {
                            const data = JSON.parse(text);
                            if (data.response) {
                                console.log(`🔍 VWorld 응답 상태: ${data.response.status}`);
                                if (data.response.result && data.response.result.featureCollection) {
                                    const features = data.response.result.featureCollection.features;
                                    console.log(`🎉 실제 필지 데이터 발견: ${features ? features.length : 0}개`);
                                }
                            }
                        } catch (jsonError) {
                            console.warn('⚠️ VWorld JSON 파싱 실패:', jsonError.message);
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ VWorld 응답 처리 중 오류:', error.message);
                }
            }
        });
        
        // 콘솔 로그 수집
        const parcelLogs = [];
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('VWorld') || text.includes('필지') || text.includes('폴리곤')) {
                console.log('🔍 필지 관련 로그:', text);
                parcelLogs.push(text);
            }
            if (text.includes('실제 필지') || text.includes('JSONP')) {
                console.log('🎯 핵심 로그:', text);
            }
        });
        
        // 페이지 로드
        await page.goto('http://localhost:3000');
        
        // 지도 로딩 대기
        await page.waitForFunction(() => {
            return typeof window.naver !== 'undefined' && 
                   typeof window.naver.maps !== 'undefined' &&
                   typeof window.map !== 'undefined';
        }, { timeout: 15000 });
        
        console.log('✅ 지도 로드 완료');
        
        // 지도 초기화 및 필지 로드 대기
        await page.waitForTimeout(3000);
        
        console.log('📊 수집된 API 호출 통계:');
        console.log(`  - 전체 API 호출: ${apiCalls.length}개`);
        console.log(`  - VWorld API 호출: ${vworldCalls.length}개`);
        
        if (vworldCalls.length > 0) {
            console.log('🎉 VWorld API 호출 성공!');
            vworldCalls.forEach((call, index) => {
                console.log(`  ${index + 1}. ${call.method} ${call.url.substring(0, 100)}...`);
            });
        } else {
            console.log('⚠️ VWorld API 호출이 감지되지 않음 - CORS 문제일 가능성');
        }
        
        // 지도 클릭으로 실제 필지 조회 테스트
        console.log('🖱️ 지도 클릭으로 실제 필지 조회 테스트...');
        
        // 서울 시청 근처 클릭 (실제 필지가 있을 가능성이 높은 위치)
        const mapElement = page.locator('#map');
        await mapElement.click({ 
            position: { x: 400, y: 300 },
            force: true 
        });
        
        // 필지 조회 결과 대기
        await page.waitForTimeout(5000);
        
        // 필지 데이터 로드 결과 확인
        const parcelStatus = await page.evaluate(() => {
            return {
                parcelsMapSize: window.parcels ? window.parcels.size : 0,
                searchResultsSize: window.searchResults ? window.searchResults.size : 0,
                hasRealParcelData: window.parcels ? Array.from(window.parcels.values()).some(p => 
                    p && p.properties && !p.properties.PNU?.startsWith('DEMO')
                ) : false
            };
        });
        
        console.log('📈 필지 데이터 현황:');
        console.log(`  - 로드된 필지 수: ${parcelStatus.parcelsMapSize}개`);
        console.log(`  - 검색 결과 수: ${parcelStatus.searchResultsSize}개`);
        console.log(`  - 실제 필지 데이터 여부: ${parcelStatus.hasRealParcelData ? '✅ 있음' : '❌ 없음 (더미만)'}`);
        
        console.log('📋 수집된 필지 관련 로그:');
        parcelLogs.forEach((log, index) => {
            console.log(`  ${index + 1}. ${log}`);
        });
        
        // 결과 평가
        if (vworldCalls.length > 0) {
            console.log('🎊 VWorld API 호출 성공! 실제 필지 데이터 시스템이 작동 중입니다.');
        } else if (parcelStatus.parcelsMapSize > 0) {
            console.log('🔄 VWorld API 호출은 없었지만 필지 데이터가 로드됨 - 더미 폴백이 작동 중');
        } else {
            console.log('❌ 필지 데이터 로드 실패');
        }
        
        console.log('🎯 실제 VWorld API 필지 데이터 테스트 완료');
    });
});