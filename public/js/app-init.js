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
        
        console.log('📡 저장된 필지 데이터 로드 중...');
        this.dataLoadComplete = true; // 중복 호출 방지

        if (!window.supabaseManager) {
            console.error('❌ SupabaseManager 없음');
            return;
        }

        try {
            // 필지 데이터 로드 (무한 루프 방지를 위해 한 번만 호출)
            const parcels = await window.supabaseManager.loadParcels();
            
            if (parcels && parcels.length > 0) {
                console.log(`📊 ${parcels.length}개 필지 로드됨`);
                
                // 지도에 필지 표시 (parcel-manager가 있는 경우)
                if (window.parcelManager && typeof window.parcelManager.loadSavedParcels === 'function') {
                    await window.parcelManager.loadSavedParcels(parcels);
                }
            } else {
                console.log('📊 저장된 필지 데이터 없음');
            }

            // localStorage에서도 로드 (fallback) - 한 번만
            if (window.parcelManager && typeof window.parcelManager.loadFromLocalStorage === 'function') {
                const localCount = await window.parcelManager.loadFromLocalStorage();
                if (localCount > 0) {
                    console.log(`🔍 localStorage에서 ${localCount}개 필지 로드`);
                }
            }

        } catch (error) {
            console.error('❌ 필지 데이터 로드 실패:', error);
            this.dataLoadComplete = false; // 실패 시 재시도 허용
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