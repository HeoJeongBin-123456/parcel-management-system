const { test, expect } = require('@playwright/test');

test.describe('대체 지적도 API 탐색', () => {
    test('공공데이터포털 지적도 API 검색', async ({ page }) => {
        console.log('🔍 공공데이터포털에서 지적도 관련 API 검색 중...');
        
        try {
            // 공공데이터포털 접속
            await page.goto('https://www.data.go.kr/', { timeout: 30000 });
            await page.waitForTimeout(3000);
            
            // 검색창 찾기 및 검색
            const searchInput = page.locator('input[name="query"], .search-input, #searchKeyword');
            await searchInput.fill('지적도');
            await page.keyboard.press('Enter');
            
            await page.waitForTimeout(5000);
            
            // 검색 결과에서 API 정보 수집
            const apiResults = await page.evaluate(() => {
                const results = [];
                const items = document.querySelectorAll('.result-item, .api-item, .dataset-item, .list-item');
                
                items.forEach((item, index) => {
                    if (index < 10) { // 상위 10개만
                        const title = item.querySelector('a, .title, h3, h4')?.textContent?.trim();
                        const desc = item.querySelector('.description, .desc, .summary')?.textContent?.trim();
                        const link = item.querySelector('a')?.href;
                        
                        if (title && (title.includes('지적') || title.includes('필지') || title.includes('부동산'))) {
                            results.push({
                                title: title,
                                description: desc || '',
                                link: link || '',
                                source: '공공데이터포털'
                            });
                        }
                    }
                });
                
                return results;
            });
            
            console.log('📋 공공데이터포털 지적도 API 결과:');
            apiResults.forEach((result, index) => {
                console.log(`${index + 1}. ${result.title}`);
                console.log(`   설명: ${result.description.substring(0, 100)}...`);
                console.log(`   링크: ${result.link}`);
                console.log('');
            });
            
            // 결과가 있으면 첫 번째 API 상세 정보 확인
            if (apiResults.length > 0 && apiResults[0].link) {
                console.log('🔍 첫 번째 API 상세 정보 확인 중...');
                await page.goto(apiResults[0].link, { timeout: 30000 });
                await page.waitForTimeout(3000);
                
                const detailInfo = await page.evaluate(() => {
                    // API 엔드포인트나 사용법 찾기
                    const endpoint = document.querySelector('pre, code, .endpoint, .api-url')?.textContent?.trim() || '';
                    const usage = document.querySelector('.usage, .example, .guide')?.textContent?.trim() || '';
                    const auth = document.querySelector('.auth, .key, .token')?.textContent?.trim() || '';
                    
                    return {
                        endpoint: endpoint.substring(0, 200),
                        usage: usage.substring(0, 300),
                        auth: auth.substring(0, 200)
                    };
                });
                
                console.log('📄 API 상세 정보:');
                console.log('엔드포인트:', detailInfo.endpoint);
                console.log('사용법:', detailInfo.usage);
                console.log('인증:', detailInfo.auth);
            }
            
        } catch (error) {
            console.error('❌ 공공데이터포털 검색 실패:', error.message);
        }
    });
    
    test('네이버 지도 관련 API 확인', async ({ page }) => {
        console.log('🗺️ 네이버 지도 API 문서 확인 중...');
        
        try {
            // 네이버 클라우드 플랫폼 Maps API 문서
            await page.goto('https://api.ncloud-docs.com/docs/ai-naver-mapsgeocoding', { timeout: 30000 });
            await page.waitForTimeout(3000);
            
            const naverApiInfo = await page.evaluate(() => {
                const title = document.querySelector('h1, .title')?.textContent?.trim() || '';
                const description = document.querySelector('.description, .summary, p')?.textContent?.trim() || '';
                const endpoints = [];
                
                // API 엔드포인트 찾기
                document.querySelectorAll('pre, code, .endpoint').forEach(element => {
                    const text = element.textContent?.trim();
                    if (text && (text.includes('https://') || text.includes('ncloud'))) {
                        endpoints.push(text.substring(0, 100));
                    }
                });
                
                return {
                    title,
                    description: description.substring(0, 300),
                    endpoints: endpoints.slice(0, 5)
                };
            });
            
            console.log('📋 네이버 지도 API 정보:');
            console.log('제목:', naverApiInfo.title);
            console.log('설명:', naverApiInfo.description);
            console.log('엔드포인트들:');
            naverApiInfo.endpoints.forEach((endpoint, index) => {
                console.log(`  ${index + 1}. ${endpoint}`);
            });
            
        } catch (error) {
            console.error('❌ 네이버 API 문서 확인 실패:', error.message);
        }
    });
    
    test('카카오맵 API 탐색', async ({ page }) => {
        console.log('📍 카카오맵 API 문서 확인 중...');
        
        try {
            // 카카오 개발자 센터 Local API
            await page.goto('https://developers.kakao.com/docs/latest/ko/local/dev-guide', { timeout: 30000 });
            await page.waitForTimeout(3000);
            
            const kakaoApiInfo = await page.evaluate(() => {
                const apis = [];
                
                // API 목록 수집
                document.querySelectorAll('h2, h3, .api-title').forEach(element => {
                    const title = element.textContent?.trim();
                    if (title && (title.includes('주소') || title.includes('좌표') || title.includes('장소'))) {
                        const nextElement = element.nextElementSibling;
                        const description = nextElement?.textContent?.trim() || '';
                        apis.push({
                            title,
                            description: description.substring(0, 200)
                        });
                    }
                });
                
                // 엔드포인트 찾기
                const endpoints = [];
                document.querySelectorAll('pre, code').forEach(element => {
                    const text = element.textContent?.trim();
                    if (text && text.includes('dapi.kakao.com')) {
                        endpoints.push(text.substring(0, 150));
                    }
                });
                
                return { apis: apis.slice(0, 5), endpoints: endpoints.slice(0, 3) };
            });
            
            console.log('📋 카카오맵 API 정보:');
            console.log('사용 가능한 API들:');
            kakaoApiInfo.apis.forEach((api, index) => {
                console.log(`  ${index + 1}. ${api.title}`);
                console.log(`     ${api.description}`);
            });
            
            console.log('엔드포인트 예시들:');
            kakaoApiInfo.endpoints.forEach((endpoint, index) => {
                console.log(`  ${index + 1}. ${endpoint}`);
            });
            
        } catch (error) {
            console.error('❌ 카카오 API 문서 확인 실패:', error.message);
        }
    });
    
    test('국토교통부 관련 API 찾기', async ({ page }) => {
        console.log('🏛️ 국토교통부 관련 부동산 API 검색 중...');
        
        try {
            // 국토교통부 실거래가 공개시스템
            await page.goto('https://rt.molit.go.kr/', { timeout: 30000 });
            await page.waitForTimeout(3000);
            
            // 개발자 가이드나 API 정보 찾기
            const links = await page.evaluate(() => {
                const apiLinks = [];
                document.querySelectorAll('a').forEach(link => {
                    const text = link.textContent?.toLowerCase();
                    const href = link.href;
                    if (text && (text.includes('api') || text.includes('개발자') || text.includes('오픈데이터'))) {
                        apiLinks.push({
                            text: link.textContent?.trim(),
                            href: href
                        });
                    }
                });
                return apiLinks.slice(0, 5);
            });
            
            console.log('📋 국토교통부 관련 링크들:');
            links.forEach((link, index) => {
                console.log(`  ${index + 1}. ${link.text} - ${link.href}`);
            });
            
            // 공공데이터포털에서 국토교통부 데이터 직접 검색
            await page.goto('https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15057511', { timeout: 30000 });
            await page.waitForTimeout(3000);
            
            const molitleInfo = await page.evaluate(() => {
                const title = document.querySelector('h1, .title, .api-title')?.textContent?.trim() || '';
                const endpoint = document.querySelector('pre, code, .endpoint')?.textContent?.trim() || '';
                const usage = document.querySelector('.guide, .usage, .example')?.textContent?.trim() || '';
                
                return {
                    title,
                    endpoint: endpoint.substring(0, 200),
                    usage: usage.substring(0, 300)
                };
            });
            
            console.log('📋 국토교통부 실거래가 API:');
            console.log('제목:', molitleInfo.title);
            console.log('엔드포인트:', molitleInfo.endpoint);
            console.log('사용법:', molitleInfo.usage);
            
        } catch (error) {
            console.error('❌ 국토교통부 API 탐색 실패:', error.message);
        }
    });
    
    test('지적도 관련 대체 서비스 종합 탐색', async ({ page }) => {
        console.log('🌍 지적도 관련 대체 서비스 종합 탐색...');
        
        const searchTerms = ['지적도 API', '필지 경계 API', '부동산 공간정보 API', 'cadastral map API korea'];
        const foundAPIs = [];
        
        for (const term of searchTerms) {
            try {
                console.log(`🔍 "${term}" 검색 중...`);
                
                // 구글 검색으로 관련 서비스 찾기
                await page.goto(`https://www.google.com/search?q=${encodeURIComponent(term)}`, { timeout: 30000 });
                await page.waitForTimeout(3000);
                
                const results = await page.evaluate(() => {
                    const searchResults = [];
                    document.querySelectorAll('.g, .result').forEach((result, index) => {
                        if (index < 5) {
                            const titleElement = result.querySelector('h3, .title');
                            const linkElement = result.querySelector('a[href]');
                            const descElement = result.querySelector('.VwiC3b, .description, .snippet');
                            
                            if (titleElement && linkElement) {
                                const title = titleElement.textContent?.trim();
                                const link = linkElement.href;
                                const description = descElement?.textContent?.trim() || '';
                                
                                if (link && !link.includes('youtube.com') && !link.includes('blog')) {
                                    searchResults.push({ title, link, description: description.substring(0, 150) });
                                }
                            }
                        }
                    });
                    return searchResults;
                });
                
                results.forEach(result => {
                    if (result.title && (
                        result.title.includes('API') || 
                        result.description.includes('API') ||
                        result.link.includes('api') ||
                        result.link.includes('openapi')
                    )) {
                        foundAPIs.push({
                            ...result,
                            searchTerm: term
                        });
                    }
                });
                
                await page.waitForTimeout(2000);
                
            } catch (error) {
                console.log(`⚠️ "${term}" 검색 중 오류:`, error.message);
            }
        }
        
        console.log('📋 발견된 지적도/필지 관련 API들:');
        foundAPIs.forEach((api, index) => {
            console.log(`${index + 1}. ${api.title}`);
            console.log(`   검색어: ${api.searchTerm}`);
            console.log(`   설명: ${api.description}`);
            console.log(`   링크: ${api.link}`);
            console.log('');
        });
        
        console.log(`✅ 총 ${foundAPIs.length}개의 잠재적 대체 API 발견`);
    });
});