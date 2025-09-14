/**
 * Contract Test: Marker API
 * GET /api/parcels/with-markers
 * GET /api/parcels/{id}/marker-state
 */

const { test, expect } = require('@playwright/test');

test.describe('Marker API Contract Tests', () => {

    test('GET /api/parcels/{id}/marker-state - 마커 표시 조건 평가', async ({ page }) => {
        // Given: 다양한 필지 데이터
        const testCases = [
            {
                id: 'marker_test_1',
                data: { memo: '테스트 메모' },
                expectedDisplay: true,
                expectedFields: ['memo']
            },
            {
                id: 'marker_test_2',
                data: { parcel_number: '123-45' },
                expectedDisplay: true,
                expectedFields: ['parcel_number']
            },
            {
                id: 'marker_test_3',
                data: { owner_name: '홍길동' },
                expectedDisplay: true,
                expectedFields: ['owner_name']
            },
            {
                id: 'marker_test_4',
                data: { owner_address: '서울시 강남구' },
                expectedDisplay: true,
                expectedFields: ['owner_address']
            },
            {
                id: 'marker_test_5',
                data: { contact: '010-1234-5678' },
                expectedDisplay: true,
                expectedFields: ['contact']
            },
            {
                id: 'marker_test_6',
                data: {
                    memo: '복합 테스트',
                    owner_name: '김철수',
                    contact: '010-9876-5432'
                },
                expectedDisplay: true,
                expectedFields: ['memo', 'owner_name', 'contact']
            },
            {
                id: 'marker_test_7',
                data: {},
                expectedDisplay: false,
                expectedFields: []
            }
        ];

        for (const testCase of testCases) {
            // When: 마커 상태 평가
            const markerState = await page.evaluate(({ id, data }) => {
                if (window.dataPersistenceManager) {
                    const shouldDisplay = window.dataPersistenceManager.evaluateAndSaveMarkerState(id, data);
                    const state = window.dataPersistenceManager.getMarkerState(id);
                    return { shouldDisplay, state };
                }
                return null;
            }, { id: testCase.id, data: testCase.data });

            // Then: 기대값과 일치하는지 확인
            expect(markerState).toBeTruthy();
            expect(markerState.shouldDisplay).toBe(testCase.expectedDisplay);
            expect(markerState.state.should_display).toBe(testCase.expectedDisplay);
            expect(markerState.state.trigger_fields.sort()).toEqual(testCase.expectedFields.sort());
        }
    });

    test('GET /api/parcels/with-markers - 마커 표시할 필지 목록 조회', async ({ page }) => {
        // Given: 마커 표시 조건을 만족하는 필지들
        const parcelsWithMarkers = [
            { id: 'with_marker_1', memo: '표시됨' },
            { id: 'with_marker_2', owner_name: '소유자' },
            { id: 'with_marker_3', contact: '연락처' }
        ];

        const parcelsWithoutMarkers = [
            { id: 'without_marker_1' },
            { id: 'without_marker_2' }
        ];

        // 마커 상태 설정
        for (const parcel of [...parcelsWithMarkers, ...parcelsWithoutMarkers]) {
            await page.evaluate(({ parcel }) => {
                window.dataPersistenceManager?.evaluateAndSaveMarkerState(parcel.id, parcel);
            }, { parcel });
        }

        // When: 마커 표시할 필지 조회
        const parcelsToDisplay = await page.evaluate(() => {
            const markerStates = window.dataPersistenceManager?.markerStates;
            if (!markerStates) return [];

            const displayParcels = [];
            markerStates.forEach((state, id) => {
                if (state.should_display) {
                    displayParcels.push({ id, ...state });
                }
            });
            return displayParcels;
        });

        // Then: 조건을 만족하는 필지만 반환되는지 확인
        const testParcels = parcelsToDisplay.filter(p =>
            p.id.startsWith('with_marker_') || p.id.startsWith('without_marker_')
        );

        expect(testParcels.some(p => p.id === 'with_marker_1')).toBe(true);
        expect(testParcels.some(p => p.id === 'with_marker_2')).toBe(true);
        expect(testParcels.some(p => p.id === 'with_marker_3')).toBe(true);
        expect(testParcels.some(p => p.id === 'without_marker_1')).toBe(false);
        expect(testParcels.some(p => p.id === 'without_marker_2')).toBe(false);
    });

    test('마커 상태 변경 - 정보 추가/제거', async ({ page }) => {
        const parcelId = 'marker_change_test';

        // Given: 빈 필지 (마커 없음)
        let markerState = await page.evaluate((id) => {
            window.dataPersistenceManager?.evaluateAndSaveMarkerState(id, {});
            return window.dataPersistenceManager?.getMarkerState(id);
        }, parcelId);

        expect(markerState.should_display).toBe(false);

        // When: 메모 추가
        markerState = await page.evaluate((id) => {
            window.dataPersistenceManager?.evaluateAndSaveMarkerState(id, { memo: '새 메모' });
            return window.dataPersistenceManager?.getMarkerState(id);
        }, parcelId);

        // Then: 마커 표시되어야 함
        expect(markerState.should_display).toBe(true);
        expect(markerState.trigger_fields).toContain('memo');

        // When: 소유자 정보 추가
        markerState = await page.evaluate((id) => {
            window.dataPersistenceManager?.evaluateAndSaveMarkerState(id, {
                memo: '새 메모',
                owner_name: '새 소유자'
            });
            return window.dataPersistenceManager?.getMarkerState(id);
        }, parcelId);

        // Then: 여전히 마커 표시, 트리거 필드 증가
        expect(markerState.should_display).toBe(true);
        expect(markerState.trigger_fields).toContain('memo');
        expect(markerState.trigger_fields).toContain('owner_name');

        // When: 모든 정보 제거
        markerState = await page.evaluate((id) => {
            window.dataPersistenceManager?.evaluateAndSaveMarkerState(id, {});
            return window.dataPersistenceManager?.getMarkerState(id);
        }, parcelId);

        // Then: 마커 숨김
        expect(markerState.should_display).toBe(false);
        expect(markerState.trigger_fields).toHaveLength(0);
    });

    test('마커 상태 영속성 - LocalStorage 저장/로드', async ({ page }) => {
        const testParcels = [
            { id: 'persist_1', memo: '저장 테스트 1' },
            { id: 'persist_2', owner_name: '저장 테스트 2' },
            { id: 'persist_3', contact: '010-1111-2222' }
        ];

        // Given: 마커 상태 저장
        for (const parcel of testParcels) {
            await page.evaluate(({ parcel }) => {
                window.dataPersistenceManager?.evaluateAndSaveMarkerState(parcel.id, parcel);
            }, { parcel });
        }

        // When: 새로운 인스턴스에서 로드 (페이지 새로고침 시뮬레이션)
        const loadedStates = await page.evaluate(() => {
            // 기존 상태 백업
            const backup = window.dataPersistenceManager?.markerStates;

            // 새 인스턴스 생성하여 LocalStorage에서 로드
            const newManager = new DataPersistenceManager();

            // 로드된 상태 확인
            const states = [];
            newManager.markerStates.forEach((state, id) => {
                if (id.startsWith('persist_')) {
                    states.push({ id, ...state });
                }
            });

            return states;
        });

        // Then: 저장된 상태가 올바르게 로드되었는지 확인
        expect(loadedStates).toHaveLength(3);
        expect(loadedStates.every(s => s.should_display)).toBe(true);
        expect(loadedStates.some(s => s.id === 'persist_1')).toBe(true);
        expect(loadedStates.some(s => s.id === 'persist_2')).toBe(true);
        expect(loadedStates.some(s => s.id === 'persist_3')).toBe(true);
    });
});