const { test, expect } = require('@playwright/test');

test.describe('폴리곤 렌더링 테스트', () => {
    test('지도 클릭 시 폴리곤이 정상적으로 그려지는지 확인', async ({ page }) => {
        console.log('🗺️ 폴리곤 렌더링 테스트 시작');
        
        // 로컬 서버에 접속
        await page.goto('http://127.0.0.1:3000');
        
        // 네이버 지도 API 로드 대기
        await page.waitForFunction(() => {
            return typeof window.naver !== 'undefined' && 
                   typeof window.naver.maps !== 'undefined' &&
                   typeof window.map !== 'undefined';
        }, { timeout: 15000 });
        
        console.log('✅ 네이버 지도 API 로드 완료');
        
        // 콘솔 로그 모니터링
        const logs = [];
        page.on('console', msg => {
            if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warn') {
                logs.push(`${msg.type().toUpperCase()}: ${msg.text()}`);
            }
        });
        
        // 지도 중심 좌표로 이동 (서울시청)
        await page.evaluate(() => {
            if (window.map) {
                window.map.setCenter(new naver.maps.LatLng(37.5666, 126.9784));
                window.map.setZoom(18);
                console.log('🎯 지도 중심을 서울시청으로 이동');
            }
        });
        
        await page.waitForTimeout(2000);
        
        // 지도 클릭 시뮬레이션
        console.log('🖱️ 지도 클릭 시뮬레이션');
        const mapElement = await page.locator('#map');
        await mapElement.click({ position: { x: 400, y: 300 } });
        
        // 폴리곤 생성 대기
        await page.waitForTimeout(5000);
        
        // 콘솔 로그 출력
        console.log('📋 브라우저 콘솔 로그:');
        logs.forEach(log => {
            if (log.includes('폴리곤') || log.includes('geometry') || log.includes('좌표')) {
                console.log(`  ${log}`);
            }
        });
        
        // 폴리곤이 생성되었는지 확인
        const polygonCount = await page.evaluate(() => {
            return window.parcels ? window.parcels.size : 0;
        });
        
        console.log(`📊 생성된 폴리곤 개수: ${polygonCount}`);
        
        // 폴리곤 상세 정보 확인
        if (polygonCount > 0) {
            const polygonInfo = await page.evaluate(() => {
                const results = [];
                if (window.parcels) {
                    window.parcels.forEach((parcelData, pnu) => {
                        results.push({
                            pnu: pnu,
                            hasPolygon: !!parcelData.polygon,
                            color: parcelData.color,
                            geometryType: parcelData.data?.geometry?.type
                        });
                    });
                }
                return results;
            });
            
            console.log('📍 폴리곤 상세 정보:');
            polygonInfo.forEach((info, index) => {
                console.log(`  ${index + 1}. PNU: ${info.pnu}`);
                console.log(`     폴리곤 생성: ${info.hasPolygon ? '✅' : '❌'}`);
                console.log(`     색상: ${info.color}`);
                console.log(`     Geometry: ${info.geometryType}`);
                console.log('');
            });
        }
        
        // 색상 적용 테스트
        console.log('🎨 색상 적용 테스트');
        await page.click('[data-color="#FF0000"]'); // 빨간색 선택
        
        if (polygonCount > 0) {
            // 첫 번째 폴리곤에 색상 적용
            await page.evaluate(() => {
                if (window.parcels && window.parcels.size > 0) {
                    const firstParcel = Array.from(window.parcels.values())[0];
                    if (firstParcel && firstParcel.polygon) {
                        // 폴리곤 클릭 시뮬레이션
                        const clickEvent = {
                            domEvent: { stopPropagation: () => {} }
                        };
                        naver.maps.Event.trigger(firstParcel.polygon, 'click', clickEvent);
                    }
                }
            });
            
            await page.waitForTimeout(1000);
            
            // 색상이 적용되었는지 확인
            const colorApplied = await page.evaluate(() => {
                if (window.parcels && window.parcels.size > 0) {
                    const firstParcel = Array.from(window.parcels.values())[0];
                    return firstParcel.color;
                }
                return null;
            });
            
            console.log(`✅ 적용된 색상: ${colorApplied}`);
        }
        
        console.log('🏁 폴리곤 렌더링 테스트 완료');
    });
    
    test('검색 기능 폴리곤 테스트', async ({ page }) => {
        console.log('🔍 검색 기능 폴리곤 테스트 시작');
        
        await page.goto('http://127.0.0.1:3000');
        
        // 네이버 지도 API 로드 대기
        await page.waitForFunction(() => {
            return typeof window.naver !== 'undefined' && 
                   typeof window.naver.maps !== 'undefined';
        }, { timeout: 15000 });
        
        // 검색 입력
        await page.fill('#searchInput', '서울시청');
        await page.click('#searchBtn');
        
        console.log('📝 검색 실행: 서울시청');
        
        // 검색 결과 대기
        await page.waitForTimeout(5000);
        
        // 검색 결과 폴리곤 확인
        const searchResultCount = await page.evaluate(() => {
            return window.searchResults ? window.searchResults.size : 0;
        });
        
        console.log(`🔍 검색 결과 폴리곤 개수: ${searchResultCount}`);
        
        if (searchResultCount > 0) {
            const searchInfo = await page.evaluate(() => {
                const results = [];
                if (window.searchResults) {
                    window.searchResults.forEach((result, pnu) => {
                        results.push({
                            pnu: result.pnu,
                            displayText: result.displayText,
                            hasPolygon: !!result.polygon,
                            hasLabel: !!result.label
                        });
                    });
                }
                return results;
            });
            
            console.log('🎯 검색 결과 상세:');
            searchInfo.forEach((info, index) => {
                console.log(`  ${index + 1}. ${info.displayText}`);
                console.log(`     PNU: ${info.pnu}`);
                console.log(`     폴리곤: ${info.hasPolygon ? '✅' : '❌'}`);
                console.log(`     라벨: ${info.hasLabel ? '✅' : '❌'}`);
            });
        }
        
        console.log('🏁 검색 기능 폴리곤 테스트 완료');
    });
});