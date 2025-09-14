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

            // 데이터 로드는 의존성 완료 후 실행
            await this.loadAndDisplaySavedParcelsOptimized();

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

        // 지도 로딩 대기 (제한적 체크)
        while (!window.map && this.dependencyChecks < this.maxDependencyChecks) {
            console.log('🗺️ 지도 로딩 대기...');
            await this.sleep(500);
            this.dependencyChecks++;
        }

        if (!window.map) {
            throw new Error('지도 로딩 타임아웃');
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
            // 병렬로 여러 소스에서 데이터 로드
            const [supabaseData, localData, polygonData] = await Promise.all([
                this.loadFromSupabase(),
                this.loadFromLocalStorage(),
                this.loadPolygonData()
            ]);

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
        if (!window.SupabaseManager || !window.SupabaseManager.isConnected) {
            return [];
        }

        try {
            const { data, error } = await window.supabase
                .from('parcels')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (!error && data) {
                console.log(`✅ Supabase: ${data.length}개 필지`);
                return data;
            }
        } catch (error) {
            console.warn('⚠️ Supabase 로드 실패:', error);
        }
        return [];
    }

    // LocalStorage에서 데이터 로드
    async loadFromLocalStorage() {
        const sources = ['parcels', 'parcels_current_session'];
        for (const source of sources) {
            try {
                const stored = localStorage.getItem(source);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.length > 0) {
                        console.log(`✅ LocalStorage(${source}): ${parsed.length}개`);
                        return parsed;
                    }
                }
            } catch (error) {
                console.warn(`⚠️ ${source} 파싱 실패`);
            }
        }
        return [];
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
                        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
                        if (parcelColors[parcel.pnu]) {
                            colorToApply = parcelColors[parcel.pnu].color;
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
            } else {
                // 🛡️ 마커 생성 조건 확인 - 실제 정보가 있을 때만 마커 생성
                const hasRealInfo = !!(
                    (parcel.memo && parcel.memo.trim() && parcel.memo.trim() !== '(메모 없음)') ||
                    (parcel.ownerName && parcel.ownerName.trim() && parcel.ownerName.trim() !== '홍길동') ||
                    (parcel.ownerAddress && parcel.ownerAddress.trim() && parcel.ownerAddress.trim() !== '서울시 강남구...') ||
                    (parcel.ownerContact && parcel.ownerContact.trim() && parcel.ownerContact.trim() !== '010-1234-5678')
                );

                if (hasRealInfo) {
                    this.restoreParcelAsMarker(parcel);
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
                            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
                            if (parcelColors[parcel.pnu]) {
                                colorToApply = parcelColors[parcel.pnu].color;
                                console.log('🎨 localStorage parcelColors에서 색상 복원:', colorToApply);
                            }
                        }

                        if (colorToApply) {
                            setTimeout(() => {
                                this.applyParcelColor({...parcel, color: colorToApply});
                            }, 50); // 약간의 지연
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

    // 점 마커로 필지 복원 (일반 마커와 동일한 스타일)
    restoreParcelAsMarker(parcel) {
        if (!window.map || !window.naver) return;

        const color = parcel.color || '#FF0000';

        // 일반 마커와 동일한 스타일 적용
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
                // 지도가 준비되었는지 확인
                if (window.map) {
                    await window.MemoMarkerManager.initialize();
                    console.log('✅ 메모 마커 매니저 초기화 완료');

                    // 🎯 추가: 저장된 모든 필지에서 마커가 필요한 것들 확인
                    await this.ensureAllMarkersCreated();
                } else {
                    console.warn('⚠️ 지도가 준비되지 않아 메모 마커 초기화 지연');
                    // 지도 로딩 대기 후 재시도
                    setTimeout(async () => {
                        if (window.map && window.MemoMarkerManager) {
                            await window.MemoMarkerManager.initialize();
                            console.log('✅ 메모 마커 매니저 초기화 완료 (재시도)');

                            // 🎯 추가: 저장된 모든 필지에서 마커가 필요한 것들 확인
                            await this.ensureAllMarkersCreated();
                        }
                    }, 1000);
                }
            } else {
                console.warn('⚠️ MemoMarkerManager가 로드되지 않음');
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
                    // PNU 또는 지번이 있는 필지는 마커가 필요함
                    return (parcel.pnu && parcel.pnu.trim()) ||
                           (parcel.parcelNumber && parcel.parcelNumber.trim());
                });

                console.log(`📌 마커가 필요한 필지 ${parcelsNeedingMarkers.length}개 발견`);

                // 각 필지에 대해 마커 생성 시도
                for (const parcel of parcelsNeedingMarkers) {
                    try {
                        // 이미 마커가 있는지 확인
                        const markerKey = parcel.pnu || parcel.parcelNumber || parcel.id;
                        if (markerKey && !window.MemoMarkerManager.markers.has(markerKey)) {
                            // 마커 생성
                            if (parcel.lat && parcel.lng) {
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
            const storageKeys = ['parcelData', 'parcels_current_session', 'parcels'];
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
                                    if (parcel.lat && parcel.lng) {
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

// DOM 로드 후 안전한 초기화 시작
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM 준비 완료, 앱 초기화 시작');
    
    // 약간의 지연 후 초기화 (다른 스크립트들이 로드될 시간을 줌)
    setTimeout(() => {
        if (window.appInitializer && !window.appInitializer.isInitialized) {
            window.appInitializer.initialize();
        }
    }, 1000);
});

// 윈도우 로드 후 추가 체크 (fallback)
window.addEventListener('load', function() {
    console.log('🎯 윈도우 로드 완료');
    
    setTimeout(() => {
        if (window.appInitializer && !window.appInitializer.isInitialized) {
            console.log('🔄 DOM 후 초기화 재시도');
            window.appInitializer.initialize();
        }
    }, 2000);
});