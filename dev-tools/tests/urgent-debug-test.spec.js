const { test, expect } = require('@playwright/test');

test.describe('긴급 화면 진단', () => {
    test('검은 화면 원인 파악', async ({ page }) => {
        console.log('🚨 긴급! 검은 화면 진단 시작');
        
        // 모든 에러 캐치
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error') {
                console.log('🔴 에러:', text);
            } else if (type === 'warning') {
                console.log('🟡 경고:', text);
            } else if (text.includes('Failed') || text.includes('Error')) {
                console.log('⚠️ 실패:', text);
            }
        });
        
        page.on('requestfailed', request => {
            console.log('❌ 로드 실패:', request.url());
        });
        
        page.on('pageerror', error => {
            console.log('💥 페이지 에러:', error.message);
        });
        
        // 페이지 로드
        try {
            console.log('🔄 페이지 로드 시도...');
            await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
            console.log('✅ 페이지 로드 완료');
        } catch (error) {
            console.log('💥 페이지 로드 실패:', error.message);
        }
        
        // 스크린샷 촬영
        await page.screenshot({ 
            path: 'black-screen-debug.png',
            fullPage: true 
        });
        console.log('📸 스크린샷 촬영: black-screen-debug.png');
        
        // HTML 구조 확인
        const bodyContent = await page.evaluate(() => {
            return {
                bodyHTML: document.body ? document.body.innerHTML.substring(0, 500) : 'body 없음',
                headHTML: document.head ? document.head.innerHTML.substring(0, 500) : 'head 없음',
                doctype: document.doctype ? document.doctype.name : '없음',
                scripts: Array.from(document.scripts).map(s => s.src || s.textContent.substring(0, 100)),
                stylesheets: Array.from(document.styleSheets).map(s => s.href || 'inline'),
                errors: window.jsErrors || []
            };
        });
        
        console.log('📄 문서 정보:');
        console.log('  - DOCTYPE:', bodyContent.doctype);
        console.log('  - Body 내용 (500자):', bodyContent.bodyHTML);
        console.log('  - Scripts 개수:', bodyContent.scripts.length);
        console.log('  - CSS 개수:', bodyContent.stylesheets.length);
        
        // CSS 로딩 상태 확인
        const cssStatus = await page.evaluate(() => {
            const styles = [];
            for (let i = 0; i < document.styleSheets.length; i++) {
                try {
                    const sheet = document.styleSheets[i];
                    styles.push({
                        href: sheet.href,
                        rules: sheet.cssRules ? sheet.cssRules.length : 'ACCESS_DENIED',
                        disabled: sheet.disabled
                    });
                } catch (e) {
                    styles.push({
                        href: 'unknown',
                        error: e.message
                    });
                }
            }
            return styles;
        });
        
        console.log('🎨 CSS 상태:');
        cssStatus.forEach((css, i) => {
            console.log(`  ${i + 1}. ${css.href || 'inline'} - 규칙: ${css.rules}, 비활성: ${css.disabled}`);
        });
        
        // 네이버 API 상태 체크
        const naverStatus = await page.evaluate(() => {
            return {
                naver: typeof window.naver,
                naverMaps: typeof window.naver?.maps,
                map: typeof window.map,
                config: typeof window.CONFIG
            };
        });
        
        console.log('🗺️ 네이버 API 상태:');
        console.log('  - naver:', naverStatus.naver);
        console.log('  - naver.maps:', naverStatus.naverMaps);
        console.log('  - map:', naverStatus.map);
        console.log('  - CONFIG:', naverStatus.config);
        
        // 가시적 요소 확인
        const visibility = await page.evaluate(() => {
            const elements = ['#app', '.header', '.main-container', '#map', '.sidebar'];
            return elements.map(selector => {
                const el = document.querySelector(selector);
                if (!el) return { selector, status: 'NOT_FOUND' };
                
                const style = window.getComputedStyle(el);
                return {
                    selector,
                    display: style.display,
                    visibility: style.visibility,
                    opacity: style.opacity,
                    backgroundColor: style.backgroundColor,
                    width: style.width,
                    height: style.height,
                    position: style.position
                };
            });
        });
        
        console.log('👁️ 요소 가시성 검사:');
        visibility.forEach(el => {
            console.log(`  ${el.selector}:`, el);
        });
        
        // 네트워크 리소스 확인
        console.log('🌐 현재 로드된 리소스 확인...');
        
        console.log('🔍 진단 완료!');
    });
});