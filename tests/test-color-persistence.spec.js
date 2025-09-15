const { test, expect } = require('@playwright/test');

test.describe('🎨 색상 지속성 테스트', () => {
    test.beforeEach(async ({ page }) => {
        // 콘솔 로그 캡처
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('색상') || text.includes('복원') || text.includes('저장')) {
                console.log(`[브라우저]: ${text}`);
            }
        });

        // localStorage 초기화
        await page.goto('http://localhost:3000');
        await page.evaluate(() => {
            localStorage.removeItem('parcelData');
            localStorage.removeItem('parcelColors');
            console.log('✅ localStorage 초기화 완료');
        });
        await page.waitForTimeout(2000);
    });

    test('색상 적용 후 새로고침 테스트', async ({ page }) => {
        console.log('\n🎨 === 색상 지속성 테스트 시작 ===\n');

        // 1. 빨간색 선택
        await page.evaluate(() => {
            const redButton = document.querySelector('.color-palette button');
            if (redButton) {
                redButton.click();
                console.log('✅ 빨간색 선택');
            }
        });
        await page.waitForTimeout(500);

        // 2. 지도에 필지 추가 (3개)
        console.log('🖱️ 필지 3개 추가');
        const positions = [
            { x: 400, y: 300 },
            { x: 500, y: 400 },
            { x: 600, y: 350 }
        ];

        for (let i = 0; i < positions.length; i++) {
            await page.evaluate((pos) => {
                const mapElement = document.querySelector('#map-click');
                if (mapElement) {
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        clientX: pos.x,
                        clientY: pos.y
                    });
                    mapElement.dispatchEvent(clickEvent);
                    console.log(`필지 ${pos.x},${pos.y} 클릭`);
                }
            }, positions[i]);
            await page.waitForTimeout(1500);
        }

        // 3. localStorage 확인
        const storageData = await page.evaluate(() => {
            const parcels = localStorage.getItem('parcelData');
            const colors = localStorage.getItem('parcelColors');
            return {
                parcels: parcels ? JSON.parse(parcels).length : 0,
                colors: colors ? Object.keys(JSON.parse(colors)).length : 0
            };
        });
        console.log(`📦 저장된 데이터: ${storageData.parcels}개 필지, ${storageData.colors}개 색상`);

        // 4. 스크린샷 (새로고침 전)
        await page.screenshot({
            path: 'test-before-refresh.png',
            fullPage: true
        });

        // 5. 페이지 새로고침
        console.log('🔄 페이지 새로고침');
        await page.reload();
        await page.waitForTimeout(3000);

        // 6. 복원된 데이터 확인
        const restoredData = await page.evaluate(() => {
            const clickParcels = window.clickParcels;
            const polygons = window.clickModePolygons;
            return {
                parcelsCount: clickParcels ? clickParcels.size : 0,
                polygonsCount: polygons ? polygons.size : 0
            };
        });
        console.log(`✅ 복원된 데이터: ${restoredData.parcelsCount}개 필지, ${restoredData.polygonsCount}개 폴리곤`);

        // 7. 스크린샷 (새로고침 후)
        await page.screenshot({
            path: 'test-after-refresh.png',
            fullPage: true
        });

        // 8. 검증
        expect(restoredData.parcelsCount).toBeGreaterThan(0);
        expect(restoredData.polygonsCount).toBeGreaterThan(0);

        console.log('\n🎨 === 색상 지속성 테스트 완료 ===\n');
    });

    test('다양한 색상 지속성 테스트', async ({ page }) => {
        console.log('\n🌈 === 다양한 색상 테스트 시작 ===\n');

        const colors = [
            { index: 0, name: '빨강' },
            { index: 2, name: '노랑' },
            { index: 4, name: '파랑' }
        ];

        // 각 색상으로 필지 추가
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];

            // 색상 선택
            await page.evaluate((colorIndex) => {
                const buttons = document.querySelectorAll('.color-palette button');
                if (buttons[colorIndex]) {
                    buttons[colorIndex].click();
                    console.log(`색상 ${colorIndex} 선택`);
                }
            }, color.index);
            await page.waitForTimeout(300);

            // 필지 추가
            await page.evaluate((offsetX) => {
                const mapElement = document.querySelector('#map-click');
                if (mapElement) {
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        clientX: 350 + offsetX,
                        clientY: 350
                    });
                    mapElement.dispatchEvent(clickEvent);
                }
            }, i * 150);
            await page.waitForTimeout(1500);
        }

        // localStorage 확인
        const savedColors = await page.evaluate(() => {
            const colors = localStorage.getItem('parcelColors');
            return colors ? JSON.parse(colors) : {};
        });
        console.log(`📦 저장된 색상 정보:`, Object.values(savedColors));

        // 새로고침
        console.log('🔄 페이지 새로고침');
        await page.reload();
        await page.waitForTimeout(3000);

        // 복원 확인
        const restoredPolygons = await page.evaluate(() => {
            const polygons = window.clickModePolygons;
            if (!polygons) return [];

            const result = [];
            polygons.forEach((polygon, pnu) => {
                const options = polygon.getOptions();
                result.push({
                    pnu: pnu,
                    fillColor: options.fillColor
                });
            });
            return result;
        });

        console.log(`✅ 복원된 폴리곤:`, restoredPolygons.length);
        restoredPolygons.forEach(p => {
            console.log(`  - PNU: ${p.pnu}, 색상: ${p.fillColor}`);
        });

        // 스크린샷
        await page.screenshot({
            path: 'test-multiple-colors.png',
            fullPage: true
        });

        expect(restoredPolygons.length).toBe(3);

        console.log('\n🌈 === 다양한 색상 테스트 완료 ===\n');
    });

    test('우클릭 삭제 후 지속성 테스트', async ({ page }) => {
        console.log('\n🗑️ === 삭제 후 지속성 테스트 시작 ===\n');

        // 1. 파란색으로 2개 필지 추가
        await page.evaluate(() => {
            const blueButton = document.querySelectorAll('.color-palette button')[4];
            if (blueButton) {
                blueButton.click();
                console.log('✅ 파란색 선택');
            }
        });
        await page.waitForTimeout(300);

        // 2개 필지 추가
        for (let i = 0; i < 2; i++) {
            await page.evaluate((index) => {
                const mapElement = document.querySelector('#map-click');
                if (mapElement) {
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        clientX: 400 + (index * 100),
                        clientY: 400
                    });
                    mapElement.dispatchEvent(clickEvent);
                }
            }, i);
            await page.waitForTimeout(1500);
        }

        // 2. 첫 번째 필지 우클릭 삭제
        console.log('🗑️ 첫 번째 필지 삭제');
        await page.evaluate(() => {
            const mapElement = document.querySelector('#map-click');
            if (mapElement) {
                const rightClickEvent = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    clientX: 400,
                    clientY: 400,
                    button: 2
                });
                mapElement.dispatchEvent(rightClickEvent);
            }
        });
        await page.waitForTimeout(1000);

        // 3. 새로고침
        console.log('🔄 페이지 새로고침');
        await page.reload();
        await page.waitForTimeout(3000);

        // 4. 복원 확인 (1개만 있어야 함)
        const restoredCount = await page.evaluate(() => {
            return window.clickParcels ? window.clickParcels.size : 0;
        });

        console.log(`✅ 복원된 필지: ${restoredCount}개 (1개 예상)`);

        // 스크린샷
        await page.screenshot({
            path: 'test-after-delete.png',
            fullPage: true
        });

        expect(restoredCount).toBe(1);

        console.log('\n🗑️ === 삭제 후 지속성 테스트 완료 ===\n');
    });
});