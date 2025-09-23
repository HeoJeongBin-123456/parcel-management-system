const { test, expect } = require('@playwright/test');

test('마커 클릭 후 필지 정보 삭제 테스트', async ({ page }) => {
    // 콘솔 로그 캡처
    const logs = [];
    const errors = [];

    page.on('console', msg => {
        const text = msg.text();
        logs.push(text);
        if (msg.type() === 'error') {
            errors.push(text);
        }
    });

    // 에러 이벤트 캡처
    page.on('pageerror', error => {
        errors.push(error.message);
    });

    // 1. 페이지 열기
    await page.goto('http://localhost:3000');

    // 2. 지도가 로드될 때까지 대기
    await page.waitForTimeout(2000);

    // 3. 지도 중앙 클릭하여 필지 선택
    const mapContainer = page.locator('#map');
    const box = await mapContainer.boundingBox();

    if (box) {
        // 지도 중앙 클릭
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(2000);

        // 4. 필지 정보 입력
        await page.fill('#parcelNumber', '테스트 필지 123');
        await page.fill('#ownerName', '테스트 소유자');
        await page.fill('#ownerAddress', '테스트 주소');
        await page.fill('#ownerContact', '010-1234-5678');
        await page.fill('#memo', '마커 삭제 테스트용 메모');

        // 5. 저장 버튼 클릭
        await page.click('#saveBtn');
        await page.waitForTimeout(1000);

        // 6. 마커가 생성되었는지 확인
        console.log('마커 생성 확인 중...');

        // 7. 마커 클릭 (마커는 필지 위치에 생성됨)
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 20);
        await page.waitForTimeout(1000);

        // 8. 필지 정보 초기화 버튼 클릭
        console.log('필지 정보 초기화 시도...');
        await page.click('#resetBtn');

        // 9. confirm 다이얼로그 처리
        page.once('dialog', dialog => {
            console.log('Dialog message:', dialog.message());
            dialog.accept();
        });

        await page.waitForTimeout(2000);

        // 10. 오류 확인
        const hasError = errors.some(error =>
            error.includes('resolvedPnu') ||
            error.includes('초기화 중 오류')
        );

        if (hasError) {
            console.error('❌ 오류 발생:', errors);
            throw new Error('필지 정보 삭제 중 오류 발생: ' + errors.join(', '));
        }

        // 11. 성공 로그 확인
        const hasSuccess = logs.some(log =>
            log.includes('필지') && log.includes('삭제되었습니다')
        );

        expect(hasSuccess).toBeTruthy();
        console.log('✅ 마커 및 필지 정보 삭제 성공!');

        // 12. 입력 필드가 초기화되었는지 확인
        const parcelNumber = await page.inputValue('#parcelNumber');
        const ownerName = await page.inputValue('#ownerName');
        const memo = await page.inputValue('#memo');

        expect(parcelNumber).toBe('');
        expect(ownerName).toBe('');
        expect(memo).toBe('');

        console.log('✅ 입력 필드 초기화 확인 완료');
    }

    // 스크린샷 저장
    await page.screenshot({
        path: 'marker-deletion-test-result.png',
        fullPage: true
    });
});

test('정의되지 않은 변수 오류 체크', async ({ page }) => {
    const errors = [];

    page.on('pageerror', error => {
        errors.push(error.message);
    });

    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });

    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    // deleteCurrentParcel 함수를 직접 호출하여 테스트
    const result = await page.evaluate(async () => {
        try {
            // 빈 옵션으로 함수 호출
            await window.deleteCurrentParcel({
                skipPrompt: true,
                pnu: 'test-pnu-123'
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    });

    // resolvedPnu 오류가 없어야 함
    const hasResolvedPnuError = errors.some(error =>
        error.includes('resolvedPnu')
    );

    expect(hasResolvedPnuError).toBeFalsy();

    if (!result.success && result.error) {
        // resolvedPnu 관련 오류가 아니면 OK
        expect(result.error).not.toContain('resolvedPnu');
    }

    console.log('✅ resolvedPnu 오류 수정 확인 완료');
});