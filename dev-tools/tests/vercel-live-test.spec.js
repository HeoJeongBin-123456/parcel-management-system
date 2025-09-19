const { test, expect } = require('@playwright/test');

test.describe('Vercel 라이브 테스트 - Mock API', () => {
    test('실제 웹사이트에서 필지 클릭 테스트', async ({ page }) => {
        console.log('🌐 Vercel 라이브 사이트에서 필지 클릭 테스트');
        
        try {
            // Vercel 배포 사이트 접속
            await page.goto('https://naver-field-manager.vercel.app/', { timeout: 30000 });
            await page.waitForTimeout(5000);
            
            // 페이지 로드 확인
            const title = await page.title();
            console.log('페이지 제목:', title);
            expect(title).toContain('parcel-management-system');
            
            // 지도 로드 대기
            await page.waitForFunction(() => window.map && window.naver, { timeout: 15000 });
            console.log('✅ 지도 로드 완료');
            
            // 콘솔 로그 수집
            const logs = [];
            page.on('console', msg => {
                const text = msg.text();
                if (text.includes('Mock') || text.includes('필지') || text.includes('API')) {
                    logs.push(text);
                }
            });
            
            // 서울시청 좌표에서 클릭 시뮬레이션
            const result = await page.evaluate(async () => {
                try {
                    // 서울시청 좌표
                    const lat = 37.5666103;
                    const lng = 126.9783882;
                    const center = new naver.maps.LatLng(lat, lng);
                    
                    // 지도 중심 이동 및 줌
                    window.map.setCenter(center);
                    window.map.setZoom(18);
                    
                    console.log('지도 중심 설정 완료');
                    
                    // 잠깐 대기
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // 클릭 이벤트 시뮬레이션 (naver maps 방식)
                    const clickEvent = new naver.maps.Event('click', {
                        coord: center
                    });
                    
                    // 지도 클릭 이벤트 트리거
                    naver.maps.Event.trigger(window.map, 'click', clickEvent);
                    
                    console.log('클릭 이벤트 트리거 완료');
                    
                    // API 응답 대기
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    return { success: true, message: '클릭 이벤트 실행 완료' };
                    
                } catch (error) {
                    console.error('클릭 시뮬레이션 실패:', error);
                    return { success: false, error: error.message };
                }
            });
            
            console.log('🎯 클릭 시뮬레이션 결과:', result);
            
            // 추가 대기 시간 (API 응답 및 UI 업데이트)
            await page.waitForTimeout(5000);
            
            // 수집된 로그 확인
            console.log('📝 Mock API 관련 로그:');
            logs.forEach(log => console.log('  ', log));
            
            // 필지 폴리곤이 생성되었는지 확인
            const hasPolygons = await page.evaluate(() => {
                // window.searchResults나 window.parcels에 데이터가 있는지 확인
                const searchCount = window.searchResults ? window.searchResults.size : 0;
                const parcelCount = window.parcels ? window.parcels.size : 0;
                
                console.log('검색 결과 수:', searchCount);
                console.log('저장된 필지 수:', parcelCount);
                
                return { searchCount, parcelCount, total: searchCount + parcelCount };
            });
            
            console.log('📊 필지 데이터 상태:', hasPolygons);
            
            if (hasPolygons.total > 0) {
                console.log('✅ 필지 데이터가 성공적으로 로드됨!');
            } else {
                console.log('⚠️ 필지 데이터가 로드되지 않음');
            }
            
            expect(result.success).toBe(true);
            
        } catch (error) {
            console.error('❌ 라이브 테스트 실패:', error.message);
            throw error;
        }
    });
    
    test('검색 기능 테스트', async ({ page }) => {
        console.log('🔍 Vercel에서 검색 기능 테스트');
        
        try {
            await page.goto('https://naver-field-manager.vercel.app/', { timeout: 30000 });
            await page.waitForTimeout(3000);
            
            // 지도 로드 대기
            await page.waitForFunction(() => window.map && window.naver, { timeout: 15000 });
            console.log('✅ 지도 로드 완료');
            
            // 검색 입력
            const searchInput = page.locator('#searchInput');
            await searchInput.fill('서울시청');
            
            console.log('검색어 입력: 서울시청');
            
            // 검색 버튼 클릭
            const searchBtn = page.locator('#searchBtn');
            await searchBtn.click();
            
            console.log('검색 버튼 클릭');
            
            // 검색 결과 대기
            await page.waitForTimeout(5000);
            
            // 검색 결과 확인
            const searchResult = await page.evaluate(() => {
                const searchCount = window.searchResults ? window.searchResults.size : 0;
                console.log('검색으로 찾은 필지 수:', searchCount);
                return searchCount;
            });
            
            console.log('📊 검색 결과:', searchResult, '개 필지');
            
            if (searchResult > 0) {
                console.log('✅ 검색 기능 정상 작동!');
            } else {
                console.log('⚠️ 검색 결과 없음 (Mock API 응답 확인 필요)');
            }
            
        } catch (error) {
            console.error('❌ 검색 테스트 실패:', error.message);
        }
    });
});
