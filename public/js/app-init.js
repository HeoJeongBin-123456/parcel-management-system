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

        try {
            // 1. 필수 요소들이 로드될 때까지 대기
            await this.waitForDependencies();

            // 2. Supabase 연결 확인 및 초기화
            await this.initializeSupabase();

            // 3. 저장된 필지 데이터 로드 및 표시
            await this.loadAndDisplaySavedParcels();

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
        while (!window.supabaseManager && this.dependencyChecks < this.maxDependencyChecks) {
            await this.sleep(500);
            this.dependencyChecks++;
        }

        if (!window.supabaseManager) {
            throw new Error('SupabaseManager 로딩 타임아웃');
        }

        console.log('✅ 모든 의존성 로딩 완료');
    }

    async initializeSupabase() {
        console.log('🔗 Supabase 초기화 확인 중...');

        if (window.supabaseManager && window.supabaseManager.isConnected) {
            console.log('✅ Supabase 이미 연결됨');
            return;
        }

        // Supabase 매니저 재연결 시도
        if (window.supabaseManager && typeof window.supabaseManager.reconnect === 'function') {
            console.log('🔄 Supabase 재연결 시도...');
            await window.supabaseManager.reconnect();
        }
    }

    async loadAndDisplaySavedParcels() {
        // 이미 로드되었거나 진행 중인 경우 스킵
        if (this.dataLoadComplete) {
            console.log('✅ 필지 데이터 이미 로드됨');
            return;
        }
        
        console.log('🛡️ 5단계 데이터 복원 시스템 시작...');
        this.dataLoadComplete = true; // 중복 호출 방지

        try {
            // DataPersistenceManager를 사용한 완벽한 복원
            if (window.dataPersistenceManager) {
                const restoredData = await window.dataPersistenceManager.restore();
                
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
                } else {
                    console.log('📭 복원할 필지 데이터가 없습니다');
                }
            } else {
                // 백업: 기존 복원 시스템 사용
                await this.restoreSavedParcelsFromStorage();
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
                if (parcel.geometry && parcel.geometry.coordinates) {
                    // 폴리곤으로 복원
                    const feature = {
                        geometry: parcel.geometry,
                        properties: {
                            PNU: parcel.pnu,
                            pnu: parcel.pnu,
                            jibun: parcel.parcelNumber,
                            JIBUN: parcel.parcelNumber
                        }
                    };
                    
                    if (typeof window.drawParcelPolygon === 'function') {
                        await window.drawParcelPolygon(feature, false);
                        
                        // 색상 적용
                        if (parcel.color && parcel.color !== 'transparent') {
                            setTimeout(() => {
                                this.applyParcelColor(parcel);
                            }, 50); // 약간의 지연
                        }
                        
                        restoredCount++;
                    }
                } else if (parcel.lat && parcel.lng) {
                    // 점 마커로 복원
                    this.restoreParcelAsMarker(parcel);
                    restoredCount++;
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
            existingParcel.polygon.setOptions({
                fillColor: parcel.color,
                fillOpacity: parcel.isSearchParcel ? 0.7 : 0.5,
                strokeColor: parcel.color,
                strokeWeight: 2
            });
            existingParcel.color = parcel.color;
            console.log(`🎨 필지 색상 적용: ${parcel.parcelNumber} → ${parcel.color}`);
        }
    }

    // 점 마커로 필지 복원
    restoreParcelAsMarker(parcel) {
        if (!window.map || !window.naver) return;
        
        const color = parcel.color || '#FF0000';
        const marker = new window.naver.maps.Circle({
            map: window.map,
            center: new window.naver.maps.LatLng(parcel.lat, parcel.lng),
            radius: 30,
            fillColor: color,
            fillOpacity: 0.6,
            strokeColor: color,
            strokeWeight: 2
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
                } else {
                    console.warn('⚠️ 지도가 준비되지 않아 메모 마커 초기화 지연');
                    // 지도 로딩 대기 후 재시도
                    setTimeout(async () => {
                        if (window.map && window.MemoMarkerManager) {
                            await window.MemoMarkerManager.initialize();
                            console.log('✅ 메모 마커 매니저 초기화 완료 (재시도)');
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