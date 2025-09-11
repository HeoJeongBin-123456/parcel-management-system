// 🎯 통합 앱 매니저 - 중복 초기화 제거
class OptimizedAppManager {
    constructor() {
        this.isInitialized = false;
        this.initializationPromise = null;
        this.loadingStates = {
            supabase: false,
            map: false,
            parcels: false
        };
        
        // 성능 모니터링
        this.performanceMetrics = {
            startTime: performance.now(),
            initTime: null,
            loadTime: null
        };
    }

    // 🎯 단일 진입점 - 중복 호출 방지
    async initialize() {
        if (this.isInitialized) {
            console.log('✅ 앱이 이미 초기화되었습니다.');
            return;
        }

        if (this.initializationPromise) {
            console.log('⏳ 초기화 진행 중... 대기');
            return this.initializationPromise;
        }

        console.log('🚀 최적화된 앱 초기화 시작');
        
        this.initializationPromise = this._performInitialization();
        
        try {
            await this.initializationPromise;
            this.isInitialized = true;
            this.performanceMetrics.initTime = performance.now() - this.performanceMetrics.startTime;
            console.log(`✅ 앱 초기화 완료 (${this.performanceMetrics.initTime.toFixed(2)}ms)`);
        } catch (error) {
            console.error('❌ 앱 초기화 실패:', error);
            this.initializationPromise = null; // 재시도 가능하도록 초기화
        }
    }

    async _performInitialization() {
        try {
            // 1단계: 필수 의존성 병렬 로딩
            console.log('📦 1단계: 필수 의존성 병렬 로딩');
            await this._loadDependenciesInParallel();

            // 2단계: 데이터 로딩 (한 번만)
            console.log('📊 2단계: 데이터 통합 로딩');
            await this._loadDataOnce();

            // 3단계: UI 초기화
            console.log('🎨 3단계: UI 초기화');
            await this._initializeUI();

            this.performanceMetrics.loadTime = performance.now() - this.performanceMetrics.startTime;
            console.log(`🎉 모든 초기화 완료 (총 ${this.performanceMetrics.loadTime.toFixed(2)}ms)`);

        } catch (error) {
            console.error('💥 초기화 과정에서 오류 발생:', error);
            throw error;
        }
    }

    // 🎯 병렬 의존성 로딩
    async _loadDependenciesInParallel() {
        const dependencies = [
            this._waitForNaverMaps(),
            this._waitForSupabaseManager(),
            this._waitForDOM()
        ];

        try {
            await Promise.allSettled(dependencies);
            console.log('✅ 모든 의존성 로딩 완료');
        } catch (error) {
            console.warn('⚠️ 일부 의존성 로딩 실패, 계속 진행:', error);
        }
    }

    async _waitForNaverMaps() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 20;

            const check = () => {
                if (typeof naver !== 'undefined' && 
                    typeof naver.maps !== 'undefined' &&
                    typeof naver.maps.Map !== 'undefined') {
                    console.log('✅ 네이버 지도 API 준비 완료');
                    resolve();
                    return;
                }

                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(check, 500);
                } else {
                    reject(new Error('네이버 지도 API 로드 실패'));
                }
            };

            check();
        });
    }

    async _waitForSupabaseManager() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 10;

            const check = () => {
                if (window.SupabaseManager) {
                    console.log('✅ SupabaseManager 준비 완료');
                    resolve();
                    return;
                }

                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(check, 200);
                } else {
                    console.log('⚠️ SupabaseManager 없이 진행');
                    resolve();
                }
            };

            check();
        });
    }

    async _waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                resolve();
            } else {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            }
        });
    }

    // 🎯 데이터 통합 로딩 - 중복 제거
    async _loadDataOnce() {
        if (this.loadingStates.parcels) {
            console.log('📊 데이터 이미 로딩됨 - 건너뛰기');
            return;
        }

        this.loadingStates.parcels = true;

        try {
            let savedParcels = [];

            // Supabase에서 데이터 로드 시도
            if (window.SupabaseManager?.isConnected) {
                try {
                    savedParcels = await window.SupabaseManager.loadParcels();
                    console.log(`📡 Supabase에서 ${savedParcels.length}개 필지 로드`);
                } catch (error) {
                    console.warn('⚠️ Supabase 로드 실패, localStorage 시도:', error.message);
                }
            }

            // localStorage 백업
            if (savedParcels.length === 0) {
                const localData = localStorage.getItem(CONFIG?.STORAGE_KEY || 'parcelData');
                if (localData) {
                    savedParcels = JSON.parse(localData);
                    console.log(`💾 localStorage에서 ${savedParcels.length}개 필지 로드`);
                }
            }

            // 전역 데이터 저장 (모든 컴포넌트가 공유)
            window.appData = window.appData || {};
            window.appData.parcels = savedParcels;
            window.appData.loaded = true;

            console.log(`✅ 통합 데이터 로딩 완료: ${savedParcels.length}개 필지`);

        } catch (error) {
            console.error('❌ 데이터 로딩 실패:', error);
            window.appData = { parcels: [], loaded: true };
        }
    }

    async _initializeUI() {
        try {
            // 지도 초기화 (한 번만)
            if (!window.map && typeof initMap === 'function') {
                await this._initializeMap();
            }

            // 필지 렌더링 (한 번만)
            await this._renderParcels();

            // 이벤트 리스너 초기화
            this._initializeEventListeners();

            console.log('✅ UI 초기화 완료');
        } catch (error) {
            console.error('❌ UI 초기화 실패:', error);
        }
    }

    async _initializeMap() {
        try {
            console.log('🗺️ 지도 초기화 중...');
            initMap();
            
            // 지도 준비 대기
            await new Promise((resolve) => {
                const checkMap = () => {
                    if (window.map) {
                        resolve();
                    } else {
                        setTimeout(checkMap, 100);
                    }
                };
                checkMap();
            });

            console.log('✅ 지도 초기화 완료');
        } catch (error) {
            console.error('❌ 지도 초기화 실패:', error);
        }
    }

    async _renderParcels() {
        if (!window.appData?.loaded || !window.map) {
            console.log('⚠️ 필지 렌더링 조건 미충족');
            return;
        }

        try {
            const parcels = window.appData.parcels || [];
            console.log(`🎨 ${parcels.length}개 필지 렌더링 시작`);

            let rendered = 0;
            for (const parcelData of parcels) {
                try {
                    await this._renderSingleParcel(parcelData);
                    rendered++;

                    // 성능을 위한 배치 처리
                    if (rendered % 5 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                } catch (error) {
                    console.warn('⚠️ 필지 렌더링 실패:', parcelData?.pnu || 'unknown', error);
                }
            }

            console.log(`✅ 필지 렌더링 완료: ${rendered}/${parcels.length}`);
        } catch (error) {
            console.error('❌ 필지 렌더링 실패:', error);
        }
    }

    async _renderSingleParcel(parcelData) {
        if (!parcelData.polygonCoordinates || !window.map) return;

        const key = parcelData.pnu || parcelData.id || `${parcelData.lat}_${parcelData.lng}`;
        
        // 적절한 맵에 저장
        if (parcelData.colorType === 'search') {
            window.searchParcels = window.searchParcels || new Map();
            window.searchParcels.set(key, parcelData);
        } else {
            window.clickParcels = window.clickParcels || new Map();
            window.clickParcels.set(key, parcelData);
        }

        // 폴리곤 생성
        if (typeof window.createParcelPolygon === 'function') {
            await window.createParcelPolygon(parcelData);
        }
    }

    _initializeEventListeners() {
        try {
            // 기존 이벤트 리스너들 초기화
            if (typeof initializeEventListeners === 'function') {
                initializeEventListeners();
            }

            // 지도 타입 버튼
            if (typeof initializeMapTypeButtons === 'function') {
                initializeMapTypeButtons();
            }

            console.log('✅ 이벤트 리스너 초기화 완료');
        } catch (error) {
            console.error('❌ 이벤트 리스너 초기화 실패:', error);
        }
    }

    // 성능 메트릭 조회
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            isInitialized: this.isInitialized,
            loadingStates: { ...this.loadingStates }
        };
    }

    // 강제 재초기화 (디버그 용도)
    async forceReinitialize() {
        console.log('🔄 강제 재초기화 시작');
        this.isInitialized = false;
        this.initializationPromise = null;
        this.loadingStates = { supabase: false, map: false, parcels: false };
        await this.initialize();
    }
}

// 🎯 전역 인스턴스 생성 (단일 인스턴스 보장)
if (!window.optimizedAppManager) {
    window.optimizedAppManager = new OptimizedAppManager();
    console.log('🚀 OptimizedAppManager 인스턴스 생성');
} else {
    console.log('✅ OptimizedAppManager 이미 존재');
}

// 🎯 통합 초기화 함수 - 모든 초기화를 여기서 처리
window.initializeOptimizedApp = async function() {
    try {
        await window.optimizedAppManager.initialize();
    } catch (error) {
        console.error('💥 앱 초기화 최종 실패:', error);
    }
};

// DOM 준비 시 자동 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM 준비 완료 - 최적화된 앱 초기화');
        setTimeout(() => {
            window.initializeOptimizedApp();
        }, 500); // 다른 스크립트들의 로딩 시간 확보
    });
} else {
    // 이미 DOM이 로드된 경우
    setTimeout(() => {
        window.initializeOptimizedApp();
    }, 100);
}

console.log('📋 OptimizedAppManager 로드 완료');