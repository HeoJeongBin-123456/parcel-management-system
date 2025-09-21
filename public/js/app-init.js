/* eslint-disable */
// 애플리케이션 초기화 및 데이터 로딩 (개선된 버전)
class AppInitializer {
    constructor() {
        this.isInitialized = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.initInProgress = false;
        this.dependencyChecks = 0;
        this.maxDependencyChecks = 20; // 최대 10초 대기
        this.dataLoadComplete = false; // 무한 루프 방지
    }

    async initialize() {
        if (this.isInitialized || this.initInProgress) {
            console.log('✅ 초기화 이미 완료 또는 진행 중');
            return;
        }

        this.initInProgress = true;
        console.log('🚀 애플리케이션 초기화 시작');
        const startTime = performance.now();

        try {
            // ⚡ 병렬 처리로 속도 개선 - 의존성 체크와 초기화를 동시 실행
            const [dependencies, supabaseInit] = await Promise.all([
                this.waitForDependencies(),
                this.initializeSupabaseParallel()
            ]);

            // 🔄 기존 데이터 마이그레이션 실행 (Phase 1)
            if (window.migrateOldParcelData) {
                console.log('🔄 Phase 1: 필지 데이터 마이그레이션 실행');
                window.migrateOldParcelData();
            }

            // 🎯 순서 보장된 데이터 복원 프로세스
            await this.restoreDataInOrder();

            const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`⚡ 초기화 완료: ${loadTime}초`);

            this.isInitialized = true;
            this.initInProgress = false;
            console.log('✅ 애플리케이션 초기화 완료');

        } catch (error) {
            console.error('❌ 애플리케이션 초기화 실패:', error);
            this.initInProgress = false;

            // 재시도 로직 (제한적)
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`🔄 초기화 재시도 (${this.retryCount}/${this.maxRetries})`);
                setTimeout(() => this.initialize(), 3000);
            } else {
                console.error('💥 최대 재시도 횟수 초과, 초기화 실패');
            }
        }
    }

    async waitForDependencies() {
        console.log('⏳ 의존성 로딩 대기 중...');

        // 🗺️ 3-지도 시스템 로딩 대기 (제한적 체크)
        while ((!window.mapClick || !window.mapSearch || !window.mapHand) && this.dependencyChecks < this.maxDependencyChecks) {
            console.log('🗺️ 3-지도 시스템 로딩 대기... (mapClick:', !!window.mapClick, ', mapSearch:', !!window.mapSearch, ', mapHand:', !!window.mapHand, ')');
            await this.sleep(500);
            this.dependencyChecks++;
        }

        // 🆘 임시 해결책: 3-지도 시스템 미완성 시 기존 map 사용
        if (!window.mapClick || !window.mapSearch || !window.mapHand) {
            console.warn('⚠️ 3-지도 시스템 로딩 실패. 기존 map 확인...');

            // 기존 window.map이 있으면 계속 진행
            if (window.map) {
                console.log('✅ 기존 window.map 사용하여 계속 진행');
            } else {
                console.warn('⚠️ 지도 인스턴스 없음. 계속 진행하되 일부 기능 제한될 수 있음');
            }
        } else {
            console.log('✅ 3-지도 시스템 로딩 완료');
        }

        // SupabaseManager 로딩 대기 (제한적 체크)
        this.dependencyChecks = 0;
        while (!window.SupabaseManager && this.dependencyChecks < this.maxDependencyChecks) {
            await this.sleep(500);
            this.dependencyChecks++;
        }

        if (!window.SupabaseManager) {
            throw new Error('SupabaseManager 로딩 타임아웃');
        }

        console.log('✅ 모든 의존성 로딩 완료');
    }

    /**
     * 🎯 순서 보장된 데이터 복원 프로세스
     * 1. 지도 위치 복원 (이미 createMapOptions에서 처리됨)
     * 2. 검색 필지 복원 (검색 모드일 때)
     * 3. 클릭 필지 복원
     * 4. 마커 생성
     */
    async restoreDataInOrder() {
        console.log('🎯 순서 보장된 데이터 복원 시작');

        try {
            // Step 1: 현재 모드 확인
            const currentMode = window.currentMode || 'click';
            console.log('📍 현재 모드:', currentMode);

            // Step 2: 검색 필지 복원 (검색 모드이거나 메모리에 저장된 경우)
            if (typeof window.loadSearchResultsFromStorage === 'function') {
                console.log('🔍 검색 필지 복원 시작...');
                window.loadSearchResultsFromStorage();
                console.log('✅ 검색 필지 복원 완료');
            } else {
                console.warn('⚠️ loadSearchResultsFromStorage 함수 없음');
            }

            // Step 3: 클릭 필지 복원
            console.log('🎯 클릭 필지 복원 시작...');
            await this.loadAndDisplaySavedParcelsOptimized();
            console.log('✅ 클릭 필지 복원 완료');

            // Step 4: 마커 생성 및 복원 (지연 실행)
            setTimeout(() => {
                if (window.MemoMarkerManager) {
                    console.log('📍 마커 복원 시작...');
                    if (typeof window.MemoMarkerManager.refreshAllMarkers === 'function') {
                        window.MemoMarkerManager.refreshAllMarkers();
                        console.log('✅ 마커 복원 완료');
                    }
                } else {
                    console.warn('⚠️ MemoMarkerManager 없음');
                }
            }, 1000);

            console.log('🎉 순서 보장된 데이터 복원 완료');

        } catch (error) {
            console.error('❌ 데이터 복원 중 오류:', error);
            throw error;
        }
    }

    async initializeSupabase() {
        console.log('🔗 Supabase 초기화 확인 중...');

        if (window.SupabaseManager && window.SupabaseManager.isConnected) {
            console.log('✅ Supabase 이미 연결됨');
            return;
        }

        // Supabase 매니저 재연결 시도
        if (window.SupabaseManager && typeof window.SupabaseManager.reconnect === 'function') {
            console.log('🔄 Supabase 재연결 시도...');
            await window.SupabaseManager.reconnect();
        }
    }

    // 병렬 처리용 Supabase 초기화
    async initializeSupabaseParallel() {
        console.log('⚡ Supabase 병렬 초기화 시작...');

        for (let i = 0; i < 10; i++) {
            if (window.SupabaseManager) {
                if (window.SupabaseManager.isConnected) {
                    console.log('✅ Supabase 이미 연결됨');
                    return;
                }
                if (typeof window.SupabaseManager.reconnect === 'function') {
                    console.log('🔄 Supabase 재연결 시도...');
                    await window.SupabaseManager.reconnect();
                    return;
                }
            }
            await this.sleep(200);
        }

        console.log('⚠️ Supabase 초기화 스킵');
    }

    // 최적화된 데이터 로드
    async loadAndDisplaySavedParcelsOptimized() {
        if (this.dataLoadComplete) {
            console.log('✅ 필지 데이터 이미 로드됨');
            return;
        }

        console.log('⚡ 최적화된 데이터 로딩 시작...');
        this.dataLoadComplete = true;
        const startTime = performance.now();

        try {
            // 병렬로 여러 소스에서 데이터 로드 (Supabase 오류 무시)
            let supabaseData = [];
            let localData = [];
            let polygonData = [];

            console.log('📋 데이터 로드 시작...');
            try {
                supabaseData = await this.loadFromSupabase();
            } catch (e) {
                console.log('📋 Supabase 로드 건너뜀:', e.message);
            }

            console.log('📋 LocalStorage 로드 시도...');
            localData = await this.loadFromLocalStorage();

            console.log('📋 Polygon 로드 시도...');
            polygonData = await this.loadPolygonData();

            // 데이터 병합
            const restoredData = supabaseData.length > 0 ? supabaseData : localData;

            if (restoredData.length > 0 || polygonData.length > 0) {
                console.log(`⚡ 데이터 로드: ${restoredData.length}개 필지, ${polygonData.length}개 폴리곤`);

                window.parcelsData = restoredData;

                // 뷰포트 기반 최적화 렌더링
                await this.restoreParcelsToMapOptimized(restoredData, polygonData);

                // UI 업데이트 지연
                if (window.requestIdleCallback) {
                    window.requestIdleCallback(() => {
                        if (window.parcelManager) window.parcelManager.loadParcels();
                        if (typeof updateParcelList === 'function') updateParcelList();
                    });
                } else {
                    setTimeout(() => {
                        if (window.parcelManager) window.parcelManager.loadParcels();
                        if (typeof updateParcelList === 'function') updateParcelList();
                    }, 100);
                }
            }

            const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`⚡ 데이터 로드 완료: ${loadTime}초`);

            // 메모 마커 지연 로드
            setTimeout(() => this.initializeMemoMarkers(), 500);

            // 🔍 검색 모드인 경우 검색 결과 복원
            if (window.currentMode === 'search' && typeof loadSearchResultsFromStorage === 'function') {
                try {
                    setTimeout(() => {
                        loadSearchResultsFromStorage();
                        console.log('🔍 초기화 시 검색 결과 복원 완료');
                    }, 800); // 메모 마커 로드 후 실행
                } catch (error) {
                    console.error('❌ 초기화 시 검색 결과 복원 실패:', error);
                }
            }

        } catch (error) {
            console.error('❌ 데이터 로드 실패:', error);
            this.dataLoadComplete = false;
        }
    }

    // Supabase에서 데이터 로드
    async loadFromSupabase() {
        if (!window.SupabaseManager || !window.SupabaseManager.isConnected || !window.supabase) {
            return [];
        }

        try {
            const { data, error } = await window.supabase
                .from('parcels')
                .select('*')
                .neq('color', 'transparent')  // transparent 색상 제외
                .neq('color', null)            // null 색상 제외
                .order('created_at', { ascending: false })
                .limit(100);

            if (!error && data) {
                console.log(`✅ Supabase: ${data.length}개 필지`);
                return data.map(item => this.normalizeParcelRecord(item));
            }
        } catch (error) {
            console.warn('⚠️ Supabase 로드 실패:', error);
        }
        return [];
    }

    // LocalStorage에서 데이터 로드
    async loadFromLocalStorage() {
        console.log('🔍 loadFromLocalStorage 시작');

        // 삭제된 필지 목록 가져오기
        const deletedParcels = window.getDeletedParcels ? window.getDeletedParcels() : [];
        if (deletedParcels.length > 0) {
            console.log(`🗑️ 삭제된 필지 ${deletedParcels.length}개 필터링 예정`);
        }

        const sources = ['clickParcelData', 'parcelData', 'parcels', 'parcels_current_session'];
        const allParcels = [];

        for (const source of sources) {
            try {
                const stored = localStorage.getItem(source);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.length > 0) {
                        console.log(`✅ LocalStorage(${source}): ${parsed.length}개`);
                        // 모든 소스에서 데이터 병합
                        allParcels.push(...parsed);
                    }
                }
            } catch (error) {
                console.warn(`⚠️ ${source} 파싱 실패`);
            }
        }

        // 중복 제거 (PNU 기준) 및 삭제된 필지 필터링
        const uniqueParcels = [];
        const pnuSet = new Set();

        for (const parcel of allParcels) {
            const normalized = this.normalizeParcelRecord(parcel);
            const pnu = normalized.pnu || normalized.id;

            // 삭제된 필지는 건너뛰기
            if (pnu && deletedParcels.includes(pnu)) {
                console.log(`⏩ 삭제된 필지 건너뛰기: ${pnu}`);
                continue;
            }

            if (pnu && !pnuSet.has(pnu)) {
                pnuSet.add(pnu);

                if ((normalized.lat === undefined || normalized.lat === null || normalized.lat === '') ||
                    (normalized.lng === undefined || normalized.lng === null || normalized.lng === '')) {
                    const center = this.computeGeometryCenter(normalized.geometry);
                    if (center) {
                        normalized.lat = center.lat;
                        normalized.lng = center.lng;
                        console.log(`📏 좌표 추출: ${pnu} - lat:${normalized.lat}, lng:${normalized.lng}`);
                    }
                }

                uniqueParcels.push(normalized);
            }
        }

        console.log(`📦 총 ${uniqueParcels.length}개 고유 필지 로드`);
        return uniqueParcels;
    }

    parsePossibleJson(value) {
        if (!value) {
            return value;
        }

        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (error) {
                return value;
            }
        }

        return value;
    }

    normalizeMemoValue(value) {
        if (Array.isArray(value)) {
            return value.join('\n');
        }

        if (value === undefined || value === null) {
            return '';
        }

        return String(value);
    }

    safeParseFloat(value) {
        if (value === undefined || value === null || value === '') {
            return value;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
    }

    computeGeometryCenter(geometry) {
        const points = this.collectGeometryPoints(geometry);

        if (!points.length) {
            return null;
        }

        let totalLat = 0;
        let totalLng = 0;

        points.forEach(([lng, lat]) => {
            totalLng += Number(lng) || 0;
            totalLat += Number(lat) || 0;
        });

        return {
            lat: totalLat / points.length,
            lng: totalLng / points.length
        };
    }

    collectGeometryPoints(geometry) {
        if (!geometry) {
            return [];
        }

        const parsedGeometry = this.parsePossibleJson(geometry);
        if (!parsedGeometry || !parsedGeometry.coordinates) {
            return [];
        }

        const points = [];

        const visit = (node) => {
            if (!Array.isArray(node)) {
                return;
            }

            if (node.length >= 2 && !Array.isArray(node[0])) {
                points.push([node[0], node[1]]);
                return;
            }

            node.forEach(child => visit(child));
        };

        visit(parsedGeometry.coordinates);
        return points;
    }

    normalizeParcelRecord(parcel) {
        if (!parcel) {
            return parcel;
        }

        const normalized = { ...parcel };

        normalized.color_info = this.parsePossibleJson(parcel.color_info) || null;
        const polygonData = this.parsePossibleJson(parcel.polygon_data);
        const geometryData = this.parsePossibleJson(parcel.geometry);

        if (geometryData && geometryData.coordinates) {
            normalized.geometry = geometryData;
        } else if (polygonData && polygonData.coordinates) {
            normalized.geometry = polygonData;
        }

        normalized.parcelNumber = (parcel.parcelNumber || parcel.parcel_name || parcel.parcelName || '').toString().trim();
        normalized.parcel_name = normalized.parcelNumber || normalized.parcel_name || '';

        const ownerName = parcel.ownerName || parcel.owner_name || '';
        const ownerAddress = parcel.ownerAddress || parcel.owner_address || '';
        const ownerContact = parcel.ownerContact || parcel.owner_contact || '';

        normalized.ownerName = ownerName;
        normalized.ownerAddress = ownerAddress;
        normalized.ownerContact = ownerContact;
        normalized.owner_name = ownerName;
        normalized.owner_address = ownerAddress;
        normalized.owner_contact = ownerContact;

        normalized.memo = this.normalizeMemoValue(parcel.memo);

        if (!normalized.pnu && parcel.id) {
            normalized.pnu = parcel.id;
        }

        if (normalized.lat !== undefined) {
            normalized.lat = this.safeParseFloat(normalized.lat);
        }
        if (normalized.lng !== undefined) {
            normalized.lng = this.safeParseFloat(normalized.lng);
        }

        if (normalized.color_info && typeof normalized.color_info.color === 'string') {
            normalized.color = normalized.color_info.color;
        } else if (!normalized.color) {
            normalized.color = 'transparent';
        }

        const modeCandidates = [
            parcel.mode,
            parcel.current_mode,
            parcel.mode_source,
            parcel.parcel_type,
            normalized.color_info?.current_mode,
            normalized.color_info?.mode_source
        ].filter(value => typeof value === 'string' && value.trim().length > 0);

        if (modeCandidates.length > 0) {
            normalized.mode = modeCandidates[0];
        } else if (!normalized.mode) {
            normalized.mode = normalized.color === '#9370DB' ? 'search' : 'click';
        }

        if (typeof normalized.isSearchParcel !== 'boolean') {
            normalized.isSearchParcel = normalized.mode === 'search';
        }

        if ((normalized.lat === undefined || normalized.lat === null || normalized.lat === '') ||
            (normalized.lng === undefined || normalized.lng === null || normalized.lng === '')) {
            const center = this.computeGeometryCenter(normalized.geometry);
            if (center) {
                normalized.lat = center.lat;
                normalized.lng = center.lng;
            }
        }

        return normalized;
    }

    // 폴리곤 데이터 로드
    async loadPolygonData() {
        if (!window.dataPersistenceManager) return [];

        try {
            const polygons = await window.dataPersistenceManager.loadAllPolygons();
            console.log(`✅ 폴리곤: ${polygons.length}개`);
            return polygons;
        } catch (error) {
            console.warn('⚠️ 폴리곤 로드 실패');
            return [];
        }
    }

    // 뷰포트 기반 최적화 렌더링
    async restoreParcelsToMapOptimized(parcels, polygons) {
        console.log('⚡ 뷰포트 기반 렌더링 시작...');

        if (!window.map) return;

        const bounds = window.map.getBounds();
        const visibleParcels = [];
        const invisibleParcels = [];
        const visiblePolygons = [];
        const invisiblePolygons = [];

        // 필지 분류
        parcels.forEach(parcel => {
            const point = new window.naver.maps.LatLng(parcel.lat, parcel.lng);
            if (bounds.hasLatLng(point)) {
                visibleParcels.push(parcel);
            } else {
                invisibleParcels.push(parcel);
            }
        });

        // 폴리곤 분류
        polygons.forEach(polygon => {
            if (polygon.geometry && polygon.geometry.coordinates) {
                const coords = polygon.geometry.coordinates[0];
                if (coords && coords.length > 0) {
                    const point = new window.naver.maps.LatLng(coords[0][1], coords[0][0]);
                    if (bounds.hasLatLng(point)) {
                        visiblePolygons.push(polygon);
                    } else {
                        invisiblePolygons.push(polygon);
                    }
                }
            }
        });

        console.log(`👀 보이는 영역: ${visibleParcels.length}개 필지, ${visiblePolygons.length}개 폴리곤`);

        // 보이는 영역 먼저 렌더링
        for (const parcel of visibleParcels) {
            await this.restoreParcelOptimized(parcel);
        }

        for (const polygon of visiblePolygons) {
            await this.restorePolygonOptimized(polygon);
        }

        // 나머지는 비동기로 처리
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
                invisibleParcels.forEach(parcel => this.restoreParcelOptimized(parcel));
                invisiblePolygons.forEach(polygon => this.restorePolygonOptimized(polygon));
            });
        } else {
            setTimeout(() => {
                invisibleParcels.forEach(parcel => this.restoreParcelOptimized(parcel));
                invisiblePolygons.forEach(polygon => this.restorePolygonOptimized(polygon));
            }, 100);
        }

        console.log('✅ 뷰포트 기반 렌더링 완료');
    }

    // 최적화된 필지 복원
    async restoreParcelOptimized(parcel) {
        try {
            if (parcel.geometry && parcel.geometry.coordinates) {
                const feature = {
                    geometry: parcel.geometry,
                    properties: {
                        PNU: parcel.pnu,
                        pnu: parcel.pnu,
                        jibun: parcel.parcel_name || parcel.parcelNumber
                    }
                };

                if (typeof window.drawParcelPolygon === 'function') {
                    await window.drawParcelPolygon(feature, false);

                    // 색상 복원 - localStorage의 parcelColors도 확인
                    let colorToApply = null;

                    // 1. parcel 객체에서 색상 확인
                    if (parcel.color && parcel.color !== 'transparent') {
                        colorToApply = parcel.color;
                    }

                    // 2. localStorage의 parcelColors에서 색상 확인
                    if (!colorToApply) {
                        const storedHex = ParcelColorStorage.getHex(parcel.pnu);
                        if (storedHex) {
                            colorToApply = storedHex;
                        }
                    }

                    // 색상 적용
                    if (colorToApply && window.clickParcels) {
                        const parcelData = window.clickParcels.get(parcel.pnu);
                        if (parcelData && parcelData.polygon) {
                            parcelData.polygon.setOptions({
                                fillColor: colorToApply,
                                fillOpacity: 0.5,
                                strokeColor: colorToApply,
                                strokeOpacity: 0.7
                            });
                            parcelData.color = colorToApply;
                            console.log(`🎨 색상 복원: ${parcel.pnu} - ${colorToApply}`);
                        }
                    }
                }

                // 👍 geometry가 있어도 메모 정보가 있으면 마커 생성
                const hasRealInfo = !!(
                    (parcel.memo && parcel.memo.trim() && parcel.memo.trim() !== '(메모 없음)') ||
                    (parcel.ownerName && parcel.ownerName.trim() && parcel.ownerName.trim() !== '홍길동') ||
                    (parcel.ownerAddress && parcel.ownerAddress.trim() && parcel.ownerAddress.trim() !== '서울시 강남구...') ||
                    (parcel.ownerContact && parcel.ownerContact.trim() && parcel.ownerContact.trim() !== '010-1234-5678')
                );

                if (hasRealInfo) {
                    await this.restoreParcelAsMarker(parcel);
                    console.log('✅ 조건 충족으로 마커 복원 (geometry 있음):', parcel.pnu || parcel.parcelNumber);
                }
            } else {
                // 🛡️ 마커 생성 조건 확인 - 실제 정보가 있을 때만 마커 생성
                const hasRealInfo = !!(
                    (parcel.memo && parcel.memo.trim() && parcel.memo.trim() !== '(메모 없음)') ||
                    (parcel.ownerName && parcel.ownerName.trim() && parcel.ownerName.trim() !== '홍길동') ||
                    (parcel.ownerAddress && parcel.ownerAddress.trim() && parcel.ownerAddress.trim() !== '서울시 강남구...') ||
                    (parcel.ownerContact && parcel.ownerContact.trim() && parcel.ownerContact.trim() !== '010-1234-5678')
                );

                if (hasRealInfo) {
                    await this.restoreParcelAsMarker(parcel);
                    console.log('✅ 조건 충족으로 마커 복원:', parcel.pnu || parcel.parcelNumber);
                } else {
                    console.log('🚫 마커 생성 조건 미충족으로 건너뜀:', parcel.pnu || parcel.parcelNumber);
                }
            }
        } catch (error) {
            console.warn(`⚠️ 필지 복원 실패: ${parcel.pnu}`);
        }
    }

    // 최적화된 폴리곤 복원
    async restorePolygonOptimized(polygon) {
        try {
            const feature = {
                geometry: polygon.geometry,
                properties: polygon.properties || {
                    PNU: polygon.pnu,
                    pnu: polygon.pnu
                }
            };

            if (typeof window.drawParcelPolygon === 'function') {
                await window.drawParcelPolygon(feature, false);
            }
        } catch (error) {
            console.warn(`⚠️ 폴리곤 복원 실패: ${polygon.pnu}`);
        }
    }

    async loadAndDisplaySavedParcels() {
        // 이미 로드되었거나 진행 중인 경우 스킵
        if (this.dataLoadComplete) {
            console.log('✅ 필지 데이터 이미 로드됨');
            return;
        }

        console.log('🎯 Supabase 중심 단순 데이터 로딩 시작...');
        this.dataLoadComplete = true; // 중복 호출 방지

        try {
            // 🔥 새로운 단순 시스템: Supabase에서 직접 로드
            console.log('📡 Supabase에서 필지 데이터 직접 로드...');

            let restoredData = [];

            // Supabase가 연결되어 있으면 직접 로드
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                try {
                    const { data, error } = await window.supabase
                        .from('parcels')
                        .select('*')
                        .order('created_at', { ascending: false });

                    if (error) {
                        console.warn('⚠️ Supabase 로드 실패:', error);
                    } else if (data && data.length > 0) {
                        restoredData = data;
                        console.log(`✅ Supabase에서 ${data.length}개 필지 로드 성공`);
                    }
                } catch (error) {
                    console.warn('⚠️ Supabase 쿼리 실패:', error);
                }
            }

            // Supabase 실패시 localStorage 백업 사용
            if (restoredData.length === 0) {
                console.log('🔄 localStorage 백업에서 데이터 로드 시도...');
                const backupSources = ['parcels', 'parcels_current_session'];

                for (const source of backupSources) {
                    try {
                        const stored = localStorage.getItem(source);
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            if (parsed && parsed.length > 0) {
                                restoredData = parsed;
                                console.log(`✅ ${source}에서 ${parsed.length}개 필지 백업 복원`);
                                break;
                            }
                        }
                    } catch (error) {
                        console.warn(`⚠️ ${source} 복원 실패:`, error);
                    }
                }
            }

            // 🗺️ 폴리곤 데이터 로드 (새로 추가)
            console.log('🗺️ 저장된 폴리곤 데이터 로드 시작...');
            let polygonData = [];

            if (window.dataPersistenceManager) {
                polygonData = await window.dataPersistenceManager.loadAllPolygons();
                console.log(`🗺️ ${polygonData.length}개 폴리곤 로드 완료`);
            }

            if (restoredData && restoredData.length > 0) {
                console.log(`🎯 ${restoredData.length}개 필지 복원 완료`);

                // 전역 데이터 설정
                window.parcelsData = restoredData;

                // 지도에 필지 복원
                await this.restoreParcelsToMap(restoredData);

                // ParcelManager 동기화
                if (window.parcelManager) {
                    window.parcelManager.loadParcels();
                }

                // UI 업데이트
                if (typeof updateParcelList === 'function') {
                    await updateParcelList();
                }
            } else if (polygonData && polygonData.length > 0) {
                // 🗺️ 필지 데이터가 없어도 폴리곤 데이터가 있으면 복원
                console.log('🗺️ 폴리곤 데이터로 필지 복원 시도...');
                await this.restorePolygonsToMap(polygonData);
            } else {
                console.log('📭 복원할 필지 데이터가 없습니다');
            }
            
            // 메모 마커 매니저 초기화
            await this.initializeMemoMarkers();
            
            // 복원 완료 알림
            this.showRestoreNotification();

        } catch (error) {
            console.error('❌ 필지 데이터 로드 실패:', error);
            this.dataLoadComplete = false; // 실패 시 재시도 허용
            
            // 오류 복구 시도
            await this.attemptErrorRecovery();
        }
    }

    // 지도에 필지 복원 (개선된 버전)
    async restoreParcelsToMap(parcels) {
        console.log(`🗺️ ${parcels.length}개 필지를 지도에 복원합니다...`);
        let restoredCount = 0;
        
        for (const parcel of parcels) {
            try {
                // 🌟 새로운 Supabase 구조: polygon_data 필드 우선 처리
                let geometry = null;

                if (parcel.polygon_data && parcel.polygon_data.coordinates) {
                    // 새로운 Supabase JSONB 필드에서 폴리곤 데이터 추출
                    geometry = {
                        type: parcel.polygon_data.type,
                        coordinates: parcel.polygon_data.coordinates
                    };
                    console.log('🔺 Supabase polygon_data에서 폴리곤 복원:', parcel.parcel_name || parcel.pnu);
                } else if (parcel.geometry && parcel.geometry.coordinates) {
                    // 기존 geometry 필드 (하위 호환성)
                    geometry = parcel.geometry;
                    console.log('📐 기존 geometry에서 폴리곤 복원:', parcel.parcel_name || parcel.pnu);
                }

                if (geometry && geometry.coordinates) {
                    // 폴리곤으로 복원
                    const feature = {
                        geometry: geometry,
                        properties: {
                            PNU: parcel.pnu,
                            pnu: parcel.pnu,
                            jibun: parcel.parcel_name || parcel.parcelNumber,
                            JIBUN: parcel.parcel_name || parcel.parcelNumber
                        }
                    };
                    
                    if (typeof window.drawParcelPolygon === 'function') {
                        await window.drawParcelPolygon(feature, false);
                        
                        // 🎨 색상 적용 (localStorage의 parcelColors도 확인)
                        let colorToApply = null;

                        // 1. Supabase color_info 필드 확인
                        if (parcel.color_info && parcel.color_info.color) {
                            colorToApply = parcel.color_info.color;
                            console.log('🎨 Supabase color_info에서 색상 복원:', colorToApply);
                        }
                        // 2. 기존 color 필드 확인
                        else if (parcel.color && parcel.color !== 'transparent') {
                            colorToApply = parcel.color;
                            console.log('🎨 기존 color 필드에서 색상 복원:', colorToApply);
                        }
                        // 3. localStorage의 parcelColors 확인
                        else {
                            const storedHex = ParcelColorStorage.getHex(parcel.pnu);
                            if (storedHex) {
                                colorToApply = storedHex;
                                console.log('🎨 localStorage parcelColors에서 색상 복원:', colorToApply);
                            }
                        }

                        if (colorToApply) {
                            // 🎨 즉시 색상 적용 (setTimeout 제거)
                            this.applyParcelColor({...parcel, color: colorToApply});
                        }
                        
                        restoredCount++;
                    }
                } else if (parcel.lat && parcel.lng) {
                    // 🛡️ 마커 생성 조건 확인 - 실제 정보가 있을 때만 마커 생성
                    const hasRealInfo = !!(
                        (parcel.memo && parcel.memo.trim() && parcel.memo.trim() !== '(메모 없음)') ||
                        (parcel.ownerName && parcel.ownerName.trim() && parcel.ownerName.trim() !== '홍길동') ||
                        (parcel.ownerAddress && parcel.ownerAddress.trim() && parcel.ownerAddress.trim() !== '서울시 강남구...') ||
                        (parcel.ownerContact && parcel.ownerContact.trim() && parcel.ownerContact.trim() !== '010-1234-5678')
                    );

                    if (hasRealInfo) {
                        // 점 마커로 복원
                        this.restoreParcelAsMarker(parcel);
                        console.log('✅ 조건 충족으로 점 마커 복원:', parcel.parcelNumber || parcel.pnu);
                        restoredCount++;
                    } else {
                        console.log('🚫 점 마커 생성 조건 미충족으로 건너뜀:', parcel.parcelNumber || parcel.pnu);
                    }
                }
            } catch (error) {
                console.warn(`⚠️ 필지 복원 실패: ${parcel.parcelNumber || parcel.pnu}`, error);
            }
        }
        
        console.log(`✅ ${restoredCount}/${parcels.length}개 필지 지도 복원 완료`);

        // 🎨 모든 복원 완료 후 지도 강제 새로고침으로 색상 즉시 표시
        if (restoredCount > 0 && window.map) {
            setTimeout(() => {
                const currentZoom = window.map.getZoom();
                window.map.setZoom(currentZoom + 0.001); // 아주 미세한 변경
                setTimeout(() => {
                    window.map.setZoom(currentZoom); // 원래 줌으로 복원
                    console.log('🎨 지도 새로고침으로 색상 즉시 표시 완료');
                }, 10);
            }, 100);
        }

        return restoredCount;
    }

    // 필지 색상 적용
    applyParcelColor(parcel) {
        const targetMap = parcel.isSearchParcel ? window.searchParcels : window.clickParcels;

        if (!targetMap) return;

        const existingParcel = targetMap.get(parcel.pnu);

        if (existingParcel && existingParcel.polygon) {
            if (parcel.isSearchParcel) {
                // 검색 필지는 보라색 고정
                existingParcel.polygon.setOptions({
                    fillColor: '#9370DB',
                    fillOpacity: 0.7,
                    strokeColor: '#6A0DAD',
                    strokeWeight: 3
                });
                existingParcel.color = '#9370DB';
                console.log(`🔍 검색 필지 보라색 고정: ${parcel.parcelNumber}`);
            } else {
                // 일반 필지만 색상 변경
                existingParcel.polygon.setOptions({
                    fillColor: parcel.color,
                    fillOpacity: 0.5,
                    strokeColor: parcel.color,
                    strokeWeight: 2
                });
                existingParcel.color = parcel.color;
                console.log(`🎨 필지 색상 적용: ${parcel.parcelNumber} → ${parcel.color}`);
            }
        }
    }

    // 🗺️ 폴리곤 데이터로 필지 복원 (새로 추가)
    async restorePolygonsToMap(polygons) {
        console.log(`🗺️ ${polygons.length}개 폴리곤을 지도에 복원합니다...`);
        let restoredCount = 0;

        for (const polygonData of polygons) {
            try {
                const feature = {
                    geometry: polygonData.geometry,
                    properties: polygonData.properties || {
                        PNU: polygonData.pnu,
                        pnu: polygonData.pnu
                    }
                };

                if (typeof window.drawParcelPolygon === 'function') {
                    await window.drawParcelPolygon(feature, false);
                    restoredCount++;
                    console.log('🗺️ 폴리곤 복원 완료:', polygonData.pnu);
                }
            } catch (error) {
                console.warn(`⚠️ 폴리곤 복원 실패: ${polygonData.pnu}`, error);
            }
        }

        console.log(`✅ ${restoredCount}/${polygons.length}개 폴리곤 복원 완료`);
        return restoredCount;
    }

    // 점 마커로 필지 복원 (MemoMarkerManager 사용)
    async restoreParcelAsMarker(parcel) {
        if (!window.map || !window.naver) return;

        // MemoMarkerManager가 있으면 사용
        if (window.MemoMarkerManager) {
            // 좌표가 없으면 geometry에서 추출
            if (!parcel.lat || !parcel.lng) {
                if (parcel.geometry && parcel.geometry.coordinates) {
                    const coords = parcel.geometry.coordinates[0];
                    if (coords && coords.length > 0) {
                        // 폴리곤 중심점 계산
                        let totalLat = 0, totalLng = 0;
                        for (const coord of coords) {
                            totalLng += coord[0];
                            totalLat += coord[1];
                        }
                        parcel.lng = totalLng / coords.length;
                        parcel.lat = totalLat / coords.length;
                    }
                }
            }

            // 좌표가 있으면 MemoMarkerManager로 마커 생성
            if (parcel.lat && parcel.lng) {
                await window.MemoMarkerManager.createOrUpdateMarker(parcel);
                console.log('🎯 MemoMarkerManager로 마커 복원:', parcel.pnu || parcel.parcelNumber);
            } else {
                console.warn('⚠️ 좌표가 없어 마커 생성 불가:', parcel.pnu);
            }
        } else {
            // 폴백: 직접 마커 생성
            const color = parcel.color || '#FF0000';
            const marker = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(parcel.lat, parcel.lng),
                map: window.map,
                title: parcel.parcel_name || parcel.parcelNumber || 'Unknown',
                icon: {
                    content: '<div style="width: 24px; height: 24px; background-color: ' + color + '; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">M</div>',
                    anchor: new window.naver.maps.Point(12, 12)
                }
            });

            if (!window.restoredMarkers) {
                window.restoredMarkers = [];
            }
            window.restoredMarkers.push(marker);
        }
    }

    // 복원 완료 알림
    showRestoreNotification() {
        const dataCount = window.parcelsData ? window.parcelsData.length : 0;
        if (dataCount > 0) {
            console.log(`🎉 데이터 복원 완료: ${dataCount}개 필지가 복원되었습니다`);
            
            // 사용자에게 알림 표시 (선택적)
            if (window.showNotification && typeof window.showNotification === 'function') {
                window.showNotification(`${dataCount}개 필지 데이터 복원 완료`, 'success');
            }
        }
    }

    // 오류 복구 시도
    async attemptErrorRecovery() {
        console.log('🔧 오류 복구 시도...');
        
        try {
            // 1. 간단한 localStorage 복원 시도
            const simpleData = localStorage.getItem('parcelData');
            if (simpleData) {
                const data = JSON.parse(simpleData);
                if (data && data.length > 0) {
                    console.log('🔄 간단 복원 성공');
                    window.parcelsData = data;
                    await this.restoreParcelsToMap(data);
                    return;
                }
            }
            
            // 2. sessionStorage 복원 시도
            const sessionData = sessionStorage.getItem('parcelData_session');
            if (sessionData) {
                const data = JSON.parse(sessionData);
                if (data && data.length > 0) {
                    console.log('🔄 세션 복원 성공');
                    window.parcelsData = data;
                    await this.restoreParcelsToMap(data);
                    return;
                }
            }
            
            console.log('⚠️ 모든 복구 시도 실패');
        } catch (error) {
            console.error('❌ 복구 시도 중 오류:', error);
        }
    }

    async restoreSavedParcelsFromStorage() {
        console.log('🔄 localStorage에서 저장된 필지 복원 중...');
        
        // CONFIG.STORAGE_KEY 가져오기
        const STORAGE_KEY = window.CONFIG && window.CONFIG.STORAGE_KEY ? window.CONFIG.STORAGE_KEY : 'parcelData';
        const savedData = localStorage.getItem(STORAGE_KEY);
        
        if (!savedData) {
            console.log('📭 저장된 필지 데이터가 없습니다');
            return;
        }
        
        try {
            const parcels = JSON.parse(savedData);
            if (!parcels || parcels.length === 0) {
                console.log('📭 저장된 필지가 없습니다');
                return;
            }
            
            console.log(`🎯 ${parcels.length}개의 저장된 필지를 지도에 복원합니다`);
            
            // 1. parcel.js의 loadSavedParcels 함수 호출 (기본 로드)
            if (typeof window.loadSavedParcels === 'function') {
                console.log('📊 parcel.js loadSavedParcels 함수 호출');
                await window.loadSavedParcels();
            }
            
            // 2. parcel.js의 기존 복원 함수로 지도에 표시
            if (typeof window.restoreSavedParcelsOnMap === 'function') {
                console.log('🔄 parcel.js의 기존 복원 함수 사용');
                await window.restoreSavedParcelsOnMap();
            } else {
                // 백업: 개별 필지 복원
                console.log('⚡ 개별 필지 복원 모드');
                for (const parcelData of parcels) {
                    await this.restoreParcelToMap(parcelData);
                }
            }
            
            // ParcelManager에 데이터 로드
            if (window.parcelManager) {
                window.parcelManager.loadParcels();
                console.log('✅ ParcelManager 데이터 새로고침 완료');
            }
            
        } catch (error) {
            console.error('❌ 필지 복원 실패:', error);
        }
    }

    async restoreParcelToMap(parcelData) {
        try {
            // 필지 데이터 검증
            if (!parcelData.pnu && !parcelData.lat) {
                console.warn('⚠️ 유효하지 않은 필지 데이터:', parcelData);
                return;
            }

            // geometry가 있는 경우 폴리곤으로 복원
            if (parcelData.geometry && parcelData.geometry.coordinates) {
                console.log(`🎨 필지 폴리곤 복원: ${parcelData.parcelNumber || parcelData.pnu}`);
                
                // drawParcelPolygon 함수 호출 (parcel.js에 정의됨)
                if (typeof window.drawParcelPolygon === 'function') {
                    const mockParcelFeature = {
                        geometry: parcelData.geometry,
                        properties: {
                            PNU: parcelData.pnu,
                            pnu: parcelData.pnu,
                            jibun: parcelData.parcelNumber,
                            JIBUN: parcelData.parcelNumber
                        }
                    };
                    
                    await window.drawParcelPolygon(mockParcelFeature, false);
                    
                    // 색상 복원 (폴리곤 생성 후)
                    if (parcelData.color && parcelData.color !== 'transparent') {
                        const targetMap = parcelData.isSearchParcel ? window.searchParcels : window.clickParcels;
                        const existingParcel = targetMap ? targetMap.get(parcelData.pnu) : null;
                        
                        if (existingParcel && existingParcel.polygon) {
                            existingParcel.polygon.setOptions({
                                fillColor: parcelData.color,
                                fillOpacity: parcelData.isSearchParcel ? 0.7 : 0.5,
                                strokeColor: parcelData.color,
                                strokeWeight: 2
                            });
                            existingParcel.color = parcelData.color;
                            console.log(`✅ 필지 색상 복원: ${parcelData.parcelNumber} → ${parcelData.color}`);
                        }
                    }
                }
            }
            // 좌표만 있는 경우 점으로 표시
            else if (parcelData.lat && parcelData.lng) {
                console.log(`📍 필지 마커 복원: ${parcelData.parcelNumber || 'Unknown'}`);
                
                // 색상 정보가 있으면 해당 색상으로 표시
                const color = parcelData.color || '#FF0000';
                
                // 지도에 마커 추가 (간단한 원형 마커)
                if (window.map && window.naver && window.naver.maps) {
                    const marker = new window.naver.maps.Circle({
                        map: window.map,
                        center: new window.naver.maps.LatLng(parcelData.lat, parcelData.lng),
                        radius: 50,
                        fillColor: color,
                        fillOpacity: 0.6,
                        strokeColor: color,
                        strokeWeight: 2
                    });
                    
                    // 전역 저장소에 마커 추가 (나중에 관리를 위해)
                    if (!window.restoredMarkers) {
                        window.restoredMarkers = [];
                    }
                    window.restoredMarkers.push(marker);
                }
            }
            
        } catch (error) {
            console.error('❌ 개별 필지 복원 실패:', parcelData, error);
        }
    }

    async initializeMemoMarkers() {
        console.log('📍 메모 마커 매니저 초기화 시작...');

        try {
            // MemoMarkerManager가 로드되었는지 확인
            if (window.MemoMarkerManager) {
                // 초기화 시도 (지도 여부와 관계없이)
                await window.MemoMarkerManager.initialize();
                console.log('✅ 메모 마커 매니저 초기화 완료');

                // 🔥 window.map 설정 보장
                if (!window.map) {
                    // 현재 모드에 맞는 맵 설정
                    const currentMode = window.currentMode || 'click';
                    if (currentMode === 'click' && window.mapClick) {
                        window.map = window.mapClick;
                        console.log('✅ window.map을 mapClick으로 설정');
                    } else if (currentMode === 'search' && window.mapSearch) {
                        window.map = window.mapSearch;
                        console.log('✅ window.map을 mapSearch로 설정');
                    } else if (currentMode === 'hand' && window.mapHand) {
                        window.map = window.mapHand;
                        console.log('✅ window.map을 mapHand로 설정');
                    }
                }

                // 지도가 있으면 바로 마커 생성
                if (window.map) {
                    await this.ensureAllMarkersCreated();
                } else {
                    console.log('📍 지도 로딩 대기 중... 마커는 나중에 생성됩니다');
                    // 지도 로딩 감지를 위한 인터벌
                    let checkCount = 0;
                    const mapCheckInterval = setInterval(async () => {
                        checkCount++;

                        // 맵 인스턴스 재확인
                        if (!window.map) {
                            const currentMode = window.currentMode || 'click';
                            const mapInstance = window[`map${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}`];
                            if (mapInstance) {
                                window.map = mapInstance;
                                console.log(`✅ window.map을 ${currentMode} 모드 맵으로 설정`);
                            }
                        }

                        if (window.map) {
                            clearInterval(mapCheckInterval);
                            console.log('🗺️ 지도 로드 감지! 마커 생성 시작...');
                            await this.ensureAllMarkersCreated();
                        } else if (checkCount > 20) {
                            // 10초 후에도 지도가 없으면 중단
                            clearInterval(mapCheckInterval);
                            console.warn('⚠️ 지도 로딩 타임아웃');
                        }
                    }, 500);
                }
            } else {
                console.warn('⚠️ MemoMarkerManager가 로드되지 않음');
                // MemoMarkerManager 로딩 대기
                setTimeout(async () => {
                    if (window.MemoMarkerManager) {
                        await this.initializeMemoMarkers();
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('❌ 메모 마커 초기화 실패:', error);
        }
    }

    // 🎯 새로운 메서드: 모든 저장된 필지에 대해 마커 생성 보장
    async ensureAllMarkersCreated() {
        try {
            console.log('🔍 저장된 모든 필지에서 마커 필요 여부 확인...');

            // window.parcelsData에서 마커가 필요한 필지들 찾기
            if (window.parcelsData && Array.isArray(window.parcelsData)) {
                const parcelsNeedingMarkers = window.parcelsData.filter(parcel => {
                    // 실제 정보가 있을 때만 마커 필요
                    try {
                        return window.MemoMarkerManager && window.MemoMarkerManager.shouldShowMarker(parcel);
                    } catch (e) {
                        // 방어적 처리: 오류 시 마커 생성하지 않음
                        return false;
                    }
                });

                console.log(`📌 마커가 필요한 필지 ${parcelsNeedingMarkers.length}개 발견`);

                // 각 필지에 대해 마커 생성 시도
                for (const parcel of parcelsNeedingMarkers) {
                    try {
                        // 이미 마커가 있는지 확인
                        const markerKey = parcel.pnu || parcel.parcelNumber || parcel.id;
                        if (markerKey && !window.MemoMarkerManager.markers.has(markerKey)) {
                            // 마커 생성 (표시 조건 재검사)
                            if (parcel.lat && parcel.lng && window.MemoMarkerManager.shouldShowMarker(parcel)) {
                                window.MemoMarkerManager.createOrUpdateMarker(parcel);
                                console.log(`✅ 마커 생성: ${markerKey}`);
                            }
                        }
                    } catch (err) {
                        console.warn('⚠️ 개별 마커 생성 실패:', err);
                    }
                }
            }

            // localStorage에서도 확인
            const storageKeys = ['clickParcelData', 'parcelData', 'parcels_current_session', 'parcels'];
            for (const key of storageKeys) {
                try {
                    const data = localStorage.getItem(key);
                    if (data && data !== 'null' && data !== '[]') {
                        const parsed = JSON.parse(data);
                        if (Array.isArray(parsed)) {
                            const parcelsWithInfo = parsed.filter(p =>
                                (p.pnu && p.pnu.trim()) || (p.parcelNumber && p.parcelNumber.trim())
                            );

                            for (const parcel of parcelsWithInfo) {
                                const markerKey = parcel.pnu || parcel.parcelNumber || parcel.id;
                                if (markerKey && !window.MemoMarkerManager.markers.has(markerKey)) {
                                    // clickParcelData의 경우 geometry에서 좌표 추출
                                    if (!parcel.lat || !parcel.lng) {
                                        if (parcel.geometry && parcel.geometry.coordinates) {
                                            const coords = parcel.geometry.coordinates[0];
                                            if (coords && coords.length > 0) {
                                                // 폴리곤 중심점 계산
                                                let totalLat = 0, totalLng = 0;
                                                for (const coord of coords) {
                                                    totalLng += coord[0];
                                                    totalLat += coord[1];
                                                }
                                                parcel.lng = totalLng / coords.length;
                                                parcel.lat = totalLat / coords.length;
                                            }
                                        }
                                    }

                                    // 좌표가 있고 마커 표시 조건을 충족하면 생성
                                    if (parcel.lat && parcel.lng && window.MemoMarkerManager.shouldShowMarker(parcel)) {
                                        console.log(`👍 마커 복원: ${markerKey}`, {
                                            memo: parcel.memo,
                                            ownerName: parcel.ownerName
                                        });
                                        window.MemoMarkerManager.createOrUpdateMarker(parcel);
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ ${key} 처리 중 오류:`, err);
                }
            }

            console.log('✅ 마커 생성 확인 완료');
        } catch (error) {
            console.error('❌ 마커 생성 확인 실패:', error);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 수동 초기화 트리거
    forceInitialize() {
        this.isInitialized = false;
        this.initInProgress = false;
        this.retryCount = 0;
        this.dependencyChecks = 0;
        this.initialize();
    }
}

// 전역 인스턴스 생성 및 초기화 (중복 방지)
if (!window.appInitializer) {
    window.appInitializer = new AppInitializer();
    console.log('🎯 AppInitializer 생성됨');
} else {
    console.log('✅ AppInitializer 이미 존재');
}

// DOM 로드 후 안전한 초기화 시작 - 2초 내 로딩 최적화
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 DOM 준비 완료, 앱 초기화 시작');

    // 🚀 2초 내 상호작용을 위한 즉시 초기화
    // 1. 필수 요소만 먼저 초기화
    if (window.ModeManager) {
        await window.ModeManager.initialize();
        console.log('✅ ModeManager 초기화 완료');
    }

    if (window.ColorPaletteManager) {
        window.ColorPaletteManager.initialize();
        console.log('✅ ColorPaletteManager 초기화 완료');
    }

    if (window.SearchModeManager) {
        window.SearchModeManager.initialize();
        console.log('✅ SearchModeManager 초기화 완료');
    }

    // 모드 전환 버튼 이벤트 리스너
    document.querySelectorAll('.mode-button').forEach(button => {
        button.addEventListener('click', async (e) => {
            const mode = e.currentTarget.dataset.mode;
            if (window.ModeManager) {
                await window.ModeManager.switchMode(mode);

                // 모드 인디케이터 업데이트
                const indicator = document.querySelector('.mode-indicator');
                if (indicator) {
                    const modeTexts = {
                        'click': '클릭 모드',
                        'search': '검색 모드',
                        'hand': '손 모드'
                    };
                    indicator.textContent = modeTexts[mode] || mode;
                }
            }
        });
    });

    const resetButton = document.getElementById('resetMapBtn');
    if (resetButton) {
        resetButton.addEventListener('click', async () => {
            if (!window.parcelManager || typeof window.parcelManager.clearAllData !== 'function') {
                alert('초기화 기능을 사용할 수 없습니다. 잠시 후 다시 시도하세요.');
                return;
            }

            try {
                resetButton.disabled = true;
                resetButton.classList.add('pending');
                await window.parcelManager.clearAllData();
            } catch (error) {
                console.error('❌ 전체 초기화 중 오류:', error);
                alert('전체 초기화에 실패했습니다. 콘솔 로그를 확인하세요.');
            } finally {
                resetButton.classList.remove('pending');
                resetButton.disabled = false;
            }
        });
    }

    // 2. 나머지는 비동기로 로드
    requestIdleCallback(async () => {
        if (window.appInitializer && !window.appInitializer.isInitialized) {
            await window.appInitializer.initialize();
        }

        // 클릭 모드 저장된 필지 복원
        if (window.loadSavedClickModeParcels) {
            await window.loadSavedClickModeParcels();
        }
    });
});

// 윈도우 로드 후 추가 체크 (fallback)
window.addEventListener('load', function() {
    console.log('🎯 윈도우 로드 완료');

    setTimeout(async () => {
        if (window.appInitializer && !window.appInitializer.isInitialized) {
            console.log('🔄 DOM 후 초기화 재시도');
            await window.appInitializer.initialize();
        }

        // 클릭 모드 저장된 필지 복원 (백업)
        if (window.loadSavedClickModeParcels && !window.clickModeParcelsLoaded) {
            window.clickModeParcelsLoaded = true;
            await window.loadSavedClickModeParcels();
        }
    }, 2000);
});
