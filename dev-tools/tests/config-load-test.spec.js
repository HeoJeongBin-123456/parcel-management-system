const { test, expect } = require('@playwright/test');

test.describe('CONFIG 로드 테스트', () => {
    test('CONFIG 객체 로드 상태 확인', async ({ page }) => {
        console.log('🔧 CONFIG 로드 테스트 시작');
        
        // 모든 스크립트 로드 추적
        const loadedScripts = [];
        page.on('response', async response => {
            if (response.url().includes('.js')) {
                const status = response.status();
                const url = response.url();
                console.log(`📜 JS 파일: ${url} (상태: ${status})`);
                loadedScripts.push({ url, status });
                
                if (url.includes('config-client.js')) {
                    const content = await response.text();
                    console.log(`✅ config-client.js 내용 (처음 100자): ${content.substring(0, 100)}`);
                }
            }
        });
        
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('CONFIG') || text.includes('config') || text.includes('undefined')) {
                console.log('🔍 CONFIG 관련 로그:', text);
            }
        });
        
        // 페이지 로드
        await page.goto('http://localhost:3000');
        
        // 스크립트들이 로드될 때까지 잠시 대기
        await page.waitForTimeout(3000);
        
        // CONFIG 상태 상세 확인
        const configStatus = await page.evaluate(() => {
            return {
                CONFIG_exists: typeof window.CONFIG !== 'undefined',
                CONFIG_type: typeof window.CONFIG,
                CONFIG_keys: window.CONFIG ? Object.keys(window.CONFIG) : null,
                CONFIG_NAVER_CLIENT_ID: window.CONFIG?.NAVER_CLIENT_ID,
                CONFIG_MAP_DEFAULT_CENTER: window.CONFIG?.MAP_DEFAULT_CENTER,
                scripts_loaded: document.scripts.length,
                current_script_srcs: Array.from(document.scripts).map(s => s.src).filter(s => s),
                errors: window.onerror ? 'error handler exists' : 'no error handler'
            };
        });
        
        console.log('🔧 CONFIG 상태 분석:');
        console.log('  - CONFIG 존재:', configStatus.CONFIG_exists);
        console.log('  - CONFIG 타입:', configStatus.CONFIG_type);
        console.log('  - CONFIG 키들:', configStatus.CONFIG_keys);
        console.log('  - NAVER_CLIENT_ID:', configStatus.CONFIG_NAVER_CLIENT_ID);
        console.log('  - MAP_DEFAULT_CENTER:', configStatus.CONFIG_MAP_DEFAULT_CENTER);
        console.log('  - 로드된 스크립트 수:', configStatus.scripts_loaded);
        console.log('  - 스크립트 SRC들:', configStatus.current_script_srcs);
        
        // 전역 변수들 확인
        const globalVars = await page.evaluate(() => {
            return {
                map: typeof window.map,
                currentColor: typeof window.currentColor,
                parcels: typeof window.parcels,
                searchResults: typeof window.searchResults,
                naver: typeof window.naver,
                naverMaps: typeof window.naver?.maps
            };
        });
        
        console.log('🌐 전역 변수 상태:');
        Object.entries(globalVars).forEach(([key, value]) => {
            console.log(`  - ${key}: ${value}`);
        });
        
        // 만약 CONFIG가 undefined라면 수동으로 다시 시도
        if (!configStatus.CONFIG_exists) {
            console.log('⚠️ CONFIG가 undefined! 수동 로드 시도...');
            
            const manualLoad = await page.evaluate(() => {
                // 수동으로 config-client.js 다시 로드
                return new Promise((resolve) => {
                    const script = document.createElement('script');
                    script.src = '/js/config-client.js';
                    script.onload = () => {
                        resolve({
                            success: true,
                            CONFIG_after_reload: typeof window.CONFIG !== 'undefined',
                            CONFIG_keys_after: window.CONFIG ? Object.keys(window.CONFIG) : null
                        });
                    };
                    script.onerror = () => {
                        resolve({
                            success: false,
                            error: 'Failed to load config-client.js'
                        });
                    };
                    document.head.appendChild(script);
                });
            });
            
            console.log('🔄 수동 로드 결과:', manualLoad);
        }
        
        console.log('✅ CONFIG 로드 테스트 완료');
    });
});