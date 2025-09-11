const { test, expect } = require('@playwright/test');

test.describe('실제 필지 경계 데이터 소스 탐색', () => {
    test('공공데이터포털 지적도 API 상세 조사', async ({ page }) => {
        console.log('🔍 공공데이터포털 지적도 관련 API 상세 조사');
        
        const cadastralAPIs = [
            'https://www.data.go.kr/data/15057895/openapi.do', // 지적도
            'https://www.data.go.kr/data/15084817/openapi.do', // 부동산
            'https://www.data.go.kr/data/15057511/openapi.do', // 실거래가
            'https://www.data.go.kr/data/15058017/openapi.do' // 토지특성정보
        ];
        
        const foundAPIs = [];
        
        for (const apiUrl of cadastralAPIs) {
            try {
                console.log(`📋 조사 중: ${apiUrl}`);
                await page.goto(apiUrl, { timeout: 15000 });
                await page.waitForTimeout(3000);
                
                const apiInfo = await page.evaluate(() => {
                    // API 제목과 설명 추출
                    const title = document.querySelector('h1, .api-title, .title, .subject')?.textContent?.trim() || '';
                    const description = document.querySelector('.description, .summary, .api-desc')?.textContent?.trim() || '';
                    
                    // API 엔드포인트 찾기
                    const endpoints = [];
                    document.querySelectorAll('pre, code, .endpoint, .api-url').forEach(element => {
                        const text = element.textContent?.trim();
                        if (text && (text.includes('http') || text.includes('openapi'))) {
                            endpoints.push(text.substring(0, 200));
                        }
                    });
                    
                    // 필지/지적 관련 키워드 확인
                    const hasParcelData = title.includes('지적') || title.includes('필지') || title.includes('토지') || 
                                         description.includes('지적') || description.includes('필지') || description.includes('경계');
                    
                    return {
                        title: title.substring(0, 150),
                        description: description.substring(0, 300),
                        endpoints: endpoints.slice(0, 3),
                        hasParcelData
                    };
                });
                
                if (apiInfo.hasParcelData) {
                    foundAPIs.push({
                        url: apiUrl,
                        ...apiInfo
                    });
                }
                
                console.log(`  제목: ${apiInfo.title}`);
                console.log(`  필지 관련: ${apiInfo.hasParcelData ? '✅' : '❌'}`);
                if (apiInfo.endpoints.length > 0) {
                    console.log(`  엔드포인트: ${apiInfo.endpoints[0]}`);
                }
                console.log('');
                
            } catch (error) {
                console.log(`  ⚠️ 접근 실패: ${error.message}`);
            }
        }
        
        console.log('📋 발견된 필지 관련 API 목록:');
        foundAPIs.forEach((api, index) => {
            console.log(`${index + 1}. ${api.title}`);
            console.log(`   URL: ${api.url}`);
            console.log(`   설명: ${api.description}`);
            console.log('');
        });
    });
    
    test('OpenStreetMap 한국 필지 경계 데이터 확인', async ({ page }) => {
        console.log('🗺️ OpenStreetMap에서 한국 필지 경계 데이터 확인');
        
        // Overpass API를 통한 필지 경계선 검색
        const testQueries = [
            // 서울시청 주변 토지 구역 검색
            '[out:json][timeout:25];(way["landuse"](around:500,37.5666,126.9784););out geom;',
            // 행정구역 경계 검색
            '[out:json][timeout:25];(relation["admin_level"="8"]["name"~"중구"](around:1000,37.5666,126.9784););out geom;',
            // 건물 경계 검색
            '[out:json][timeout:25];(way["building"](around:200,37.5666,126.9784););out geom;'
        ];
        
        for (let i = 0; i < testQueries.length; i++) {
            const query = testQueries[i];
            console.log(`🔍 Overpass 쿼리 ${i + 1} 테스트 중...`);
            
            try {
                const result = await page.evaluate(async (overpassQuery) => {
                    try {
                        const response = await fetch('https://overpass-api.de/api/interpreter', {
                            method: 'POST',
                            body: overpassQuery,
                            headers: {
                                'Content-Type': 'text/plain'
                            }
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            return {
                                success: true,
                                elementCount: data.elements?.length || 0,
                                sampleElement: data.elements?.[0] || null,
                                dataSize: JSON.stringify(data).length
                            };
                        } else {
                            return {
                                success: false,
                                error: `HTTP ${response.status}`,
                                status: response.status
                            };
                        }
                    } catch (error) {
                        return {
                            success: false,
                            error: error.message
                        };
                    }
                }, query);
                
                console.log(`  결과:`, result);
                
                if (result.success && result.elementCount > 0) {
                    console.log(`  ✅ ${result.elementCount}개 지리 요소 발견!`);
                    console.log(`  데이터 크기: ${result.dataSize} bytes`);
                    
                    if (result.sampleElement) {
                        console.log(`  샘플 요소 타입: ${result.sampleElement.type}`);
                        console.log(`  태그:`, result.sampleElement.tags);
                    }
                } else if (!result.success) {
                    console.log(`  ❌ 실패: ${result.error}`);
                }
                
            } catch (error) {
                console.log(`  💥 쿼리 실행 실패: ${error.message}`);
            }
            
            // API 호출 간격 조절
            await page.waitForTimeout(2000);
        }
    });
    
    test('한국 GIS 오픈데이터 소스 탐색', async ({ page }) => {
        console.log('🌏 한국 GIS 오픈데이터 소스 탐색');
        
        const gisDataSources = [
            'https://data.seoul.go.kr/', // 서울 열린데이터광장
            'https://www.gg.go.kr/open_contents-opendata-list', // 경기도 오픈데이터
            'https://kosis.kr/', // 국가통계포털
            'https://www.nsdi.go.kr/' // 국가공간정보포털
        ];
        
        for (const sourceUrl of gisDataSources) {
            try {
                console.log(`📋 확인 중: ${sourceUrl}`);
                await page.goto(sourceUrl, { timeout: 15000 });
                await page.waitForTimeout(3000);
                
                // 지적도/필지 관련 데이터셋 검색
                const searchKeywords = ['지적도', '필지', '토지', '경계'];
                let foundDatasets = [];
                
                for (const keyword of searchKeywords) {
                    try {
                        // 검색창 찾기 및 검색
                        const searchInput = await page.locator('input[type="search"], input[name*="search"], input[placeholder*="검색"], .search-input').first();
                        
                        if (await searchInput.isVisible({ timeout: 2000 })) {
                            await searchInput.fill(keyword);
                            await page.keyboard.press('Enter');
                            await page.waitForTimeout(3000);
                            
                            // 검색 결과 수집
                            const results = await page.evaluate((searchTerm) => {
                                const resultItems = [];
                                const items = document.querySelectorAll('.result-item, .dataset-item, .data-item, .list-item, a[href*="dataset"], a[href*="data"]');
                                
                                items.forEach((item, index) => {
                                    if (index < 5) {
                                        const title = item.querySelector('h3, h4, .title, .name')?.textContent?.trim() || 
                                                    item.textContent?.trim() || '';
                                        const link = item.href || item.querySelector('a')?.href || '';
                                        
                                        if (title && (title.includes('지적') || title.includes('필지') || title.includes('토지'))) {
                                            resultItems.push({
                                                title: title.substring(0, 100),
                                                link: link,
                                                searchTerm: searchTerm,
                                                source: window.location.hostname
                                            });
                                        }
                                    }
                                });
                                
                                return resultItems;
                            }, keyword);
                            
                            foundDatasets.push(...results);
                        }
                        
                    } catch (searchError) {
                        console.log(`    검색 실패 (${keyword}): ${searchError.message}`);
                    }
                }
                
                console.log(`  발견된 데이터셋: ${foundDatasets.length}개`);
                foundDatasets.forEach((dataset, index) => {
                    console.log(`    ${index + 1}. ${dataset.title}`);
                    console.log(`       소스: ${dataset.source}, 키워드: ${dataset.searchTerm}`);
                });
                
            } catch (error) {
                console.log(`  ⚠️ 사이트 접근 실패: ${error.message}`);
            }
        }
    });
    
    test('국제 오픈 지리 데이터 소스 확인', async ({ page }) => {
        console.log('🌍 국제 오픈 지리 데이터 소스에서 한국 필지 데이터 확인');
        
        // OpenStreetMap 한국 데이터 품질 확인
        const result = await page.evaluate(async () => {
            try {
                // Nominatim에서 한국의 상세 토지 정보 샘플 확인
                const locations = [
                    { name: '서울시청', lat: 37.5666, lng: 126.9784 },
                    { name: '부산시청', lat: 35.1798, lng: 129.0751 },
                    { name: '대구시청', lat: 35.8714, lng: 128.6014 }
                ];
                
                const results = [];
                
                for (const location of locations) {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&zoom=18&addressdetails=1&extratags=1`);
                    
                    if (response.ok) {
                        const data = await response.json();
                        results.push({
                            location: location.name,
                            data: {
                                display_name: data.display_name,
                                osm_type: data.osm_type,
                                category: data.category,
                                type: data.type,
                                address: data.address,
                                extratags: data.extratags,
                                hasDetailedInfo: !!(data.address?.house_number || data.address?.building || data.extratags)
                            }
                        });
                    }
                    
                    // API 호출 간격
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                return results;
            } catch (error) {
                return { error: error.message };
            }
        });
        
        console.log('📊 한국 주요 도시 OSM 데이터 품질:');
        if (result.error) {
            console.log(`❌ 오류: ${result.error}`);
        } else {
            result.forEach((locationData, index) => {
                console.log(`${index + 1}. ${locationData.location}:`);
                console.log(`   주소: ${locationData.data.display_name}`);
                console.log(`   타입: ${locationData.data.osm_type}/${locationData.data.type}`);
                console.log(`   상세정보 유무: ${locationData.data.hasDetailedInfo ? '✅' : '❌'}`);
                if (locationData.data.address?.house_number) {
                    console.log(`   건물번호: ${locationData.data.address.house_number}`);
                }
                console.log('');
            });
        }
        
        // 결과 요약
        const detailedCount = result.filter ? result.filter(r => r.data?.hasDetailedInfo).length : 0;
        console.log(`📋 요약: ${result.length || 0}개 위치 중 ${detailedCount}개가 상세 정보 포함`);
    });
});