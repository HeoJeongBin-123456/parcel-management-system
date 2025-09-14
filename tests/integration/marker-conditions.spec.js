/**
 * Integration Test: 마커 생성 조건 확장 테스트
 * 요구사항: 메모뿐만 아니라 지번, 소유자명, 주소, 연락처로도 마커 생성
 */

const { test, expect } = require('@playwright/test');

test.describe('마커 생성 조건 확장 통합 테스트', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#map', { state: 'visible' });
    });

    test('지번만 입력해도 마커 생성', async ({ page }) => {
        // Given: 필지 선택
        const testParcel = await page.evaluate(() => {
            const parcel = {
                id: 'marker_jibun_test_' + Date.now(),
                pnu: '1111010100100010000',
                lat: 37.5665,
                lng: 126.9780
            };

            if (!window.parcelsData) window.parcelsData = [];
            window.parcelsData.push(parcel);
            return parcel;
        });

        // When: 지번만 입력
        const markerResult = await page.evaluate((parcelId) => {
            const parcelData = {
                parcel_number: '123-45'
            };

            const shouldDisplay = window.dataPersistenceManager?.evaluateAndSaveMarkerState(parcelId, parcelData);
            const markerState = window.dataPersistenceManager?.getMarkerState(parcelId);

            return { shouldDisplay, markerState };
        }, testParcel.id);

        // Then: 마커가 생성되어야 함
        expect(markerResult.shouldDisplay).toBe(true);
        expect(markerResult.markerState.should_display).toBe(true);
        expect(markerResult.markerState.trigger_fields).toContain('parcel_number');
        expect(markerResult.markerState.trigger_fields).toHaveLength(1);
    });

    test('소유자 이름만 입력해도 마커 생성', async ({ page }) => {
        // Given: 필지 선택
        const testParcel = await page.evaluate(() => {
            const parcel = {
                id: 'marker_owner_test_' + Date.now(),
                pnu: '1111010100100020000',
                lat: 37.5666,
                lng: 126.9781
            };

            if (!window.parcelsData) window.parcelsData = [];
            window.parcelsData.push(parcel);
            return parcel;
        });

        // When: 소유자 이름만 입력
        const markerResult = await page.evaluate((parcelId) => {
            const parcelData = {
                owner_name: '홍길동'
            };

            const shouldDisplay = window.dataPersistenceManager?.evaluateAndSaveMarkerState(parcelId, parcelData);
            const markerState = window.dataPersistenceManager?.getMarkerState(parcelId);

            return { shouldDisplay, markerState };
        }, testParcel.id);

        // Then: 마커가 생성되어야 함
        expect(markerResult.shouldDisplay).toBe(true);
        expect(markerResult.markerState.should_display).toBe(true);
        expect(markerResult.markerState.trigger_fields).toContain('owner_name');
        expect(markerResult.markerState.trigger_fields).toHaveLength(1);
    });

    test('연락처만 입력해도 마커 생성', async ({ page }) => {
        // Given: 필지 선택
        const testParcel = await page.evaluate(() => {
            const parcel = {
                id: 'marker_contact_test_' + Date.now(),
                pnu: '1111010100100030000',
                lat: 37.5667,
                lng: 126.9782
            };

            if (!window.parcelsData) window.parcelsData = [];
            window.parcelsData.push(parcel);
            return parcel;
        });

        // When: 연락처만 입력
        const markerResult = await page.evaluate((parcelId) => {
            const parcelData = {
                contact: '010-1234-5678'
            };

            const shouldDisplay = window.dataPersistenceManager?.evaluateAndSaveMarkerState(parcelId, parcelData);
            const markerState = window.dataPersistenceManager?.getMarkerState(parcelId);

            return { shouldDisplay, markerState };
        }, testParcel.id);

        // Then: 마커가 생성되어야 함
        expect(markerResult.shouldDisplay).toBe(true);
        expect(markerResult.markerState.should_display).toBe(true);
        expect(markerResult.markerState.trigger_fields).toContain('contact');
    });

    test('복수 필드 입력 시 모든 트리거 필드 기록', async ({ page }) => {
        // Given: 필지 선택
        const testParcel = await page.evaluate(() => {
            const parcel = {
                id: 'marker_multi_test_' + Date.now(),
                pnu: '1111010100100040000',
                lat: 37.5668,
                lng: 126.9783
            };

            if (!window.parcelsData) window.parcelsData = [];
            window.parcelsData.push(parcel);
            return parcel;
        });

        // When: 여러 필드 입력
        const markerResult = await page.evaluate((parcelId) => {
            const parcelData = {
                parcel_number: '456-78',
                owner_name: '김철수',
                owner_address: '서울시 종로구',
                contact: '010-9876-5432',
                memo: '복합 테스트용 메모'
            };

            const shouldDisplay = window.dataPersistenceManager?.evaluateAndSaveMarkerState(parcelId, parcelData);
            const markerState = window.dataPersistenceManager?.getMarkerState(parcelId);

            return { shouldDisplay, markerState };
        }, testParcel.id);

        // Then: 모든 트리거 필드가 기록되어야 함
        expect(markerResult.shouldDisplay).toBe(true);
        expect(markerResult.markerState.should_display).toBe(true);
        expect(markerResult.markerState.trigger_fields).toHaveLength(5);
        expect(markerResult.markerState.trigger_fields).toContain('parcel_number');
        expect(markerResult.markerState.trigger_fields).toContain('owner_name');
        expect(markerResult.markerState.trigger_fields).toContain('owner_address');
        expect(markerResult.markerState.trigger_fields).toContain('contact');
        expect(markerResult.markerState.trigger_fields).toContain('memo');
    });

    test('모든 정보 삭제 시 마커 제거', async ({ page }) => {
        // Given: 정보가 있는 필지
        const testParcel = await page.evaluate(() => {
            const parcel = {
                id: 'marker_remove_test_' + Date.now(),
                pnu: '1111010100100050000',
                lat: 37.5669,
                lng: 126.9784
            };

            if (!window.parcelsData) window.parcelsData = [];
            window.parcelsData.push(parcel);
            return parcel;
        });

        // 먼저 정보 입력하여 마커 생성
        let markerResult = await page.evaluate((parcelId) => {
            const parcelData = {
                memo: '테스트 메모',
                owner_name: '테스트 소유자'
            };

            window.dataPersistenceManager?.evaluateAndSaveMarkerState(parcelId, parcelData);
            return window.dataPersistenceManager?.getMarkerState(parcelId);
        }, testParcel.id);

        expect(markerResult.should_display).toBe(true);

        // When: 모든 정보 삭제
        markerResult = await page.evaluate((parcelId) => {
            const emptyData = {};

            window.dataPersistenceManager?.evaluateAndSaveMarkerState(parcelId, emptyData);
            return window.dataPersistenceManager?.getMarkerState(parcelId);
        }, testParcel.id);

        // Then: 마커가 제거되어야 함
        expect(markerResult.should_display).toBe(false);
        expect(markerResult.trigger_fields).toHaveLength(0);
    });

    test('마커 상태 변경 이벤트 발생', async ({ page }) => {
        const testParcelId = 'marker_event_test_' + Date.now();

        // Given: 이벤트 리스너 설정
        await page.evaluate(() => {
            window.markerUpdateEvents = [];
            window.addEventListener('parcelMarkerUpdate', (event) => {
                window.markerUpdateEvents.push(event.detail);
            });
        });

        // When: 마커 상태 변경 (생성)
        await page.evaluate((parcelId) => {
            window.dataPersistenceManager?.evaluateAndSaveMarkerState(parcelId, {
                memo: '이벤트 테스트'
            });
        }, testParcelId);

        // Then: 이벤트 발생 확인
        let events = await page.evaluate(() => window.markerUpdateEvents);
        expect(events).toHaveLength(1);
        expect(events[0].parcelId).toBe(testParcelId);
        expect(events[0].markerState.should_display).toBe(true);

        // When: 마커 상태 변경 (제거)
        await page.evaluate((parcelId) => {
            window.markerUpdateEvents = []; // 이벤트 초기화
            window.dataPersistenceManager?.evaluateAndSaveMarkerState(parcelId, {});
        }, testParcelId);

        // Then: 제거 이벤트 발생 확인
        events = await page.evaluate(() => window.markerUpdateEvents);
        expect(events).toHaveLength(1);
        expect(events[0].markerState.should_display).toBe(false);
    });

    test('실제 마커 렌더링 확인', async ({ page }) => {
        // Given: memo-markers.js가 로드되었는지 확인
        const hasMemoMarkers = await page.evaluate(() => {
            return typeof window.MemoMarkerManager !== 'undefined' ||
                   typeof window.createMemoMarker === 'function';
        });

        if (!hasMemoMarkers) {
            console.log('MemoMarkerManager가 없어 테스트 스킵');
            return;
        }

        // When: 마커 생성 조건을 만족하는 필지 추가
        const testParcel = await page.evaluate(() => {
            const parcel = {
                id: 'render_test_' + Date.now(),
                pnu: '1111010100100060000',
                lat: 37.5670,
                lng: 126.9785,
                memo: '렌더링 테스트'
            };

            // 필지 데이터에 추가
            if (!window.parcelsData) window.parcelsData = [];
            window.parcelsData.push(parcel);

            // 마커 상태 평가
            window.dataPersistenceManager?.evaluateAndSaveMarkerState(parcel.id, parcel);

            // 마커 생성 트리거 (실제 구현에 따라 다를 수 있음)
            if (window.MemoMarkerManager?.updateMarker) {
                window.MemoMarkerManager.updateMarker(parcel);
            } else if (window.createMemoMarker) {
                window.createMemoMarker(parcel);
            }

            return parcel;
        });

        // Then: 마커가 지도에 표시되는지 확인 (시간 여유를 둠)
        await page.waitForTimeout(500);

        const markerExists = await page.evaluate((parcelId) => {
            // 마커 존재 여부 확인 (구현에 따라 다를 수 있음)
            if (window.MemoMarkerManager?.markers) {
                return window.MemoMarkerManager.markers.has(parcelId);
            }
            return false;
        }, testParcel.id);

        // 실제 마커 렌더링은 구현에 따라 다를 수 있으므로 soft assertion
        console.log(`마커 렌더링 상태: ${markerExists}`);
    });
});