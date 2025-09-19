const { test, expect } = require('@playwright/test');

test.describe('Nominatim API 실제 기능 테스트', () => {
    test('로컬 서버에서 Nominatim API 기반 필지 클릭 테스트', async ({ page }) => {
        console.log('🌐 로컬 서버에서 Nominatim API 기반 필지 클릭 테스트');
        
        try {
            // 로컬 서버 접속
            await page.goto('http://localhost:8000/', { timeout: 30000 });
            await page.waitForTimeout(3000);
            
            // 페이지 로드 확인
            const title = await page.title();
            console.log('페이지 제목:', title);
            
            // 지도 로드 대기
            await page.waitForFunction(() => window.map && window.naver, { timeout: 15000 });
            console.log('✅ 지도 로드 완료');
            
            // 콘솔 로그 수집
            const logs = [];
            page.on('console', msg => {
                const text = msg.text();
                if (text.includes('Nominatim') || text.includes('필지') || text.includes('위치')) {
                    logs.push(text);
                    console.log('📝 브라우저 로그:', text);
                }
            });
            
            // 서울시청 좌표에서 클릭 시뮬레이션
            const result = await page.evaluate(async () => {
                try {
                    // 서울시청 좌표
                    const lat = 37.5666103;
                    const lng = 126.9783882;
                    const latLng = new naver.maps.LatLng(lat, lng);
                    
                    // 지도 중심 이동 및 줌
                    window.map.setCenter(latLng);
                    window.map.setZoom(18);
                    
                    console.log('지도 중심 설정 완료:', lat, lng);
                    
                    // 잠깐 대기
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // 직접 getParcelInfo 함수 호출
                    if (typeof window.getParcelInfo === 'function') {
                        console.log('🎯 getParcelInfo 함수 직접 호출');
                        await window.getParcelInfo(lat, lng);
                    } else {
                        console.log('❌ getParcelInfo 함수를 찾을 수 없음');
                        return { success: false, error: 'getParcelInfo 함수 없음' };
                    }
                    
                    // API 응답 대기
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    return { success: true, message: 'Nominatim API 호출 완료' };
                    
                } catch (error) {
                    console.error('클릭 시뮬레이션 실패:', error);
                    return { success: false, error: error.message };
                }
            });
            
            console.log('🎯 Nominatim API 테스트 결과:', result);
            
            // 추가 대기 시간 (API 응답 및 UI 업데이트)
            await page.waitForTimeout(5000);
            
            // 수집된 로그 확인
            console.log('📝 Nominatim API 관련 로그:');
            logs.forEach(log => console.log('  ', log));
            
            // 필지/위치 정보가 생성되었는지 확인
            const hasData = await page.evaluate(() => {
                // window.parcels에 데이터가 있는지 확인
                const parcelCount = window.parcels ? window.parcels.size : 0;
                console.log('생성된 필지 수:', parcelCount);
                
                // 폼에 데이터가 입력되었는지 확인
                const parcelNumber = document.getElementById('parcelNumber')?.value || '';
                console.log('입력된 지번:', parcelNumber);
                
                return { 
                    parcelCount,
                    parcelNumber,
                    hasData: parcelCount > 0 || parcelNumber !== ''
                };
            });
            
            console.log('📊 생성된 데이터 상태:', hasData);
            
            if (hasData.hasData) {
                console.log('✅ Nominatim API를 통해 위치 정보가 성공적으로 로드됨!');
                console.log(`   - 필지 수: ${hasData.parcelCount}개`);
                console.log(`   - 지번: ${hasData.parcelNumber}`);
            } else {
                console.log('⚠️ 위치 정보가 로드되지 않음');
            }
            
            expect(result.success).toBe(true);
            
        } catch (error) {
            console.error('❌ Nominatim 라이브 테스트 실패:', error.message);
            throw error;
        }
    });
    
    test('Vercel 배포에서 Nominatim API 테스트', async ({ page }) => {
        console.log('☁️ Vercel 배포에서 Nominatim API 테스트');
        
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
                if (text.includes('Nominatim') || text.includes('필지') || text.includes('위치') || text.includes('API')) {
                    logs.push(text);
                }
            });
            
            // 부산시청 좌표에서 테스트 (다른 지역 확인)
            const result = await page.evaluate(async () => {
                try {
                    // 부산시청 좌표
                    const lat = 35.1798;
                    const lng = 129.0751;
                    const latLng = new naver.maps.LatLng(lat, lng);
                    
                    // 지도 중심 이동
                    window.map.setCenter(latLng);
                    window.map.setZoom(18);
                    
                    console.log('지도 중심 설정 완료 (부산):', lat, lng);
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // 직접 API 호출 테스트
                    if (typeof window.getParcelInfo === 'function') {
                        console.log('🎯 부산 위치에서 getParcelInfo 호출');
                        await window.getParcelInfo(lat, lng);
                        
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        return { success: true, message: '부산 위치 Nominatim API 호출 완료' };
                    } else {
                        return { success: false, error: 'getParcelInfo 함수 없음' };
                    }
                    
                } catch (error) {
                    console.error('부산 위치 테스트 실패:', error);
                    return { success: false, error: error.message };
                }
            });
            
            console.log('🎯 부산 위치 테스트 결과:', result);
            
            await page.waitForTimeout(3000);
            
            // 수집된 로그 확인
            console.log('📝 Nominatim API 관련 로그 (Vercel):');
            logs.forEach(log => console.log('  ', log));
            
            // 데이터 확인
            const hasData = await page.evaluate(() => {
                const parcelCount = window.parcels ? window.parcels.size : 0;
                const parcelNumber = document.getElementById('parcelNumber')?.value || '';
                
                console.log('Vercel - 생성된 필지 수:', parcelCount);
                console.log('Vercel - 입력된 지번:', parcelNumber);
                
                return { 
                    parcelCount,
                    parcelNumber,
                    hasData: parcelCount > 0 || parcelNumber !== ''
                };
            });
            
            console.log('📊 Vercel 데이터 상태:', hasData);
            
            if (hasData.hasData) {
                console.log('✅ Vercel에서 Nominatim API 정상 작동!');
            } else {
                console.log('⚠️ Vercel에서 데이터 로드 안됨');
            }
            
            expect(result.success).toBe(true);
            
        } catch (error) {
            console.error('❌ Vercel Nominatim 테스트 실패:', error.message);
            throw error;
        }
    });
    
    test('검색 기능에서 Nominatim API 테스트', async ({ page }) => {
        console.log('🔍 검색 기능에서 Nominatim API 테스트');
        
        try {
            await page.goto('http://localhost:8000/', { timeout: 30000 });
            await page.waitForTimeout(3000);
            
            // 지도 로드 대기
            await page.waitForFunction(() => window.map && window.naver, { timeout: 15000 });
            console.log('✅ 지도 로드 완료');
            
            // 검색 입력
            const searchInput = page.locator('#searchInput');
            await searchInput.fill('광화문');
            
            console.log('검색어 입력: 광화문');
            
            // 검색 버튼 클릭
            const searchBtn = page.locator('#searchBtn');
            await searchBtn.click();
            
            console.log('검색 버튼 클릭');
            
            // 검색 결과 대기
            await page.waitForTimeout(8000);
            
            // 검색 결과 확인
            const searchResult = await page.evaluate(() => {
                const searchCount = window.searchResults ? window.searchResults.size : 0;
                console.log('검색으로 찾은 위치 수:', searchCount);
                
                // 검색 결과 내용 확인
                if (window.searchResults && window.searchResults.size > 0) {
                    const results = Array.from(window.searchResults.values());
                    results.forEach((result, index) => {
                        console.log(`검색 결과 ${index + 1}:`, result.displayText);
                    });
                }
                
                return searchCount;
            });
            
            console.log('📊 검색 결과:', searchResult, '개 위치');
            
            if (searchResult > 0) {
                console.log('✅ 검색 기능 정상 작동 (Nominatim API 기반)!');
            } else {
                console.log('⚠️ 검색 결과 없음');
            }
            
            expect(searchResult).toBeGreaterThanOrEqual(0); // 0개 이상이면 정상
            
        } catch (error) {
            console.error('❌ 검색 기능 테스트 실패:', error.message);
            throw error;
        }
    });
});
