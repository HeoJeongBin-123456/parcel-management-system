const { test, expect } = require('@playwright/test');

test.describe('🎨 색상 팔레트 완전 테스트', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4000');
        await page.waitForLoadState('networkidle', { timeout: 15000 });

        // localStorage 초기화
        await page.evaluate(() => {
            localStorage.clear();
        });

        await page.reload();
        await page.waitForLoadState('networkidle', { timeout: 15000 });
    });

    test('모든 8가지 색상이 올바르게 적용되는지 확인', async ({ page }) => {
        const expectedColors = [
            { index: 0, hex: '#FF0000', name: '빨강' },
            { index: 1, hex: '#FFA500', name: '주황' },
            { index: 2, hex: '#FFFF00', name: '노랑' },
            { index: 3, hex: '#90EE90', name: '연두' },
            { index: 4, hex: '#0000FF', name: '파랑' },
            { index: 5, hex: '#000000', name: '검정' },
            { index: 6, hex: '#FFFFFF', name: '흰색' },
            { index: 7, hex: '#87CEEB', name: '하늘색' }
        ];

        for (const colorInfo of expectedColors) {
            console.log(`Testing color ${colorInfo.index}: ${colorInfo.name} (${colorInfo.hex})`);

            // 색상 선택
            const colorItem = page.locator(`.color-item[data-color="${colorInfo.index}"]`);
            await colorItem.click();

            // 클릭 후 이벤트 처리를 위한 대기
            await page.waitForTimeout(500);

            // 현재 색상 확인
            const currentColorBg = await page.evaluate(() => {
                const currentColorDiv = document.getElementById('currentColor');
                const style = window.getComputedStyle(currentColorDiv);
                return style.backgroundColor;
            });

            // RGB 변환 함수
            const hexToRgb = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                if (result) {
                    const r = parseInt(result[1], 16);
                    const g = parseInt(result[2], 16);
                    const b = parseInt(result[3], 16);
                    return `rgb(${r}, ${g}, ${b})`;
                }
                return null;
            };

            const expectedRgb = hexToRgb(colorInfo.hex);
            expect(currentColorBg).toBe(expectedRgb);

            // 전역 currentColor 변수 확인
            const globalCurrentColor = await page.evaluate(() => {
                return window.currentColor;
            });

            expect(globalCurrentColor).toBe(colorInfo.hex);

            // ColorPaletteManager 상태 확인
            const paletteState = await page.evaluate(() => {
                if (window.ColorPaletteManager) {
                    const current = window.ColorPaletteManager.getCurrentColor();
                    return {
                        index: current ? current.index : null,
                        hex: current ? current.hex : null
                    };
                }
                return null;
            });

            if (paletteState) {
                expect(paletteState.index).toBe(colorInfo.index);
                expect(paletteState.hex).toBe(colorInfo.hex);
            }

            // 필지에 색상 적용 시뮬레이션
            const testPnu = `test_pnu_${colorInfo.index}`;
            const applyResult = await page.evaluate(async ({ pnu, hex }) => {
                const testParcel = {
                    properties: { PNU: pnu },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[[126.9769, 37.5758], [126.9770, 37.5758], [126.9770, 37.5759], [126.9769, 37.5759]]]
                    }
                };

                // 색상 적용
                if (window.applyColorToParcel) {
                    await window.applyColorToParcel(testParcel, hex);
                }

                // localStorage에서 확인
                const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
                return parcelColors[pnu];
            }, { pnu: testPnu, hex: colorInfo.hex });

            // 색상이 올바르게 저장되었는지 확인
            expect(applyResult).toBe(colorInfo.index);

            console.log(`✅ Color ${colorInfo.name} test passed`);
        }
    });

    test('색상 선택 후 필지 클릭 시 올바른 색상 적용', async ({ page }) => {
        // 빨강 색상 선택
        await page.locator('.color-item[data-color="0"]').click();

        // currentColor 확인
        const currentColor = await page.evaluate(() => window.currentColor);
        expect(currentColor).toBe('#FF0000');

        // 필지 클릭 시뮬레이션
        await page.evaluate(async () => {
            const testParcel = {
                properties: {
                    PNU: 'test_click_pnu',
                    JIBUN: '테스트 지번'
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[126.9769, 37.5758], [126.9770, 37.5758], [126.9770, 37.5759], [126.9769, 37.5759]]]
                }
            };

            // 필지 선택 및 색상 적용
            if (window.selectParcel && window.applyColorToParcel) {
                const polygon = { setOptions: () => {} }; // 더미 폴리곤
                window.selectParcel(testParcel, polygon);
                await window.applyColorToParcel(testParcel, window.currentColor);
            }
        });

        // 대기 시간 추가
        await page.waitForTimeout(500);

        // 색상이 저장되었는지 확인
        const savedColor = await page.evaluate(() => {
            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
            return parcelColors['test_click_pnu'];
        });

        expect(savedColor).toBe(0); // 빨강의 인덱스
    });

    test('색상 변경 시 UI 동기화 확인', async ({ page }) => {
        // 파랑 색상 선택
        await page.locator('.color-item[data-color="4"]').click();

        // 클릭 후 대기
        await page.waitForTimeout(500);

        // active 클래스 확인
        const activeColor = await page.locator('.color-item.active').getAttribute('data-color');
        expect(activeColor).toBe('4');

        // currentColor div 배경색 확인 (rgb 형식으로 비교)
        const bgColor = await page.evaluate(() => {
            const div = document.getElementById('currentColor');
            const style = window.getComputedStyle(div);
            return style.backgroundColor;
        });
        expect(bgColor).toBe('rgb(0, 0, 255)');

        // 다른 색상 선택 시 이전 active 제거 확인
        await page.locator('.color-item[data-color="2"]').click();

        const activeCount = await page.locator('.color-item.active').count();
        expect(activeCount).toBe(1);

        const newActiveColor = await page.locator('.color-item.active').getAttribute('data-color');
        expect(newActiveColor).toBe('2');
    });
});