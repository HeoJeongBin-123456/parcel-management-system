// Supabase 마이그레이션 어댑터 - 기존 localStorage 코드와 호환성 제공
class SupabaseAdapter {
    constructor() {
        this.supabaseManager = window.SupabaseManager;
        this.migrationComplete = false;
        this.init();
    }

    async init() {
        // 초기화 대기
        await this.waitForSupabase();
        
        // 기존 localStorage 데이터 마이그레이션
        await this.migrateFromLocalStorage();
        
        // 실시간 동기화 설정
        this.setupRealTimeSync();
        
        console.log('✅ SupabaseAdapter 초기화 완료');
    }

    async waitForSupabase() {
        let attempts = 0;
        while (!this.supabaseManager && attempts < 50) {
            this.supabaseManager = window.SupabaseManager;
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.supabaseManager) {
            console.error('❌ SupabaseManager 로드 실패');
            return false;
        }
        return true;
    }

    // ========================================
    // localStorage 호환 메서드들
    // ========================================

    async getItem(key) {
        if (key === CONFIG.STORAGE_KEY) {
            return await this.getParcels();
        }
        // 다른 키들은 localStorage 사용
        return localStorage.getItem(key);
    }

    async setItem(key, value) {
        if (key === CONFIG.STORAGE_KEY) {
            const parcels = JSON.parse(value);
            return await this.saveParcels(parcels);
        }
        // 다른 키들은 localStorage 사용
        localStorage.setItem(key, value);
    }

    // ========================================
    // 필지 데이터 변환 및 관리
    // ========================================

    async getParcels() {
        try {
            const supabaseParcels = await this.supabaseManager.loadParcels();
            // Supabase 형식을 localStorage 형식으로 변환
            const localStorageParcels = supabaseParcels.map(this.convertToLocalStorageFormat);
            return JSON.stringify(localStorageParcels);
        } catch (error) {
            console.error('❌ 필지 데이터 로드 실패:', error);
            // Fallback to localStorage
            return localStorage.getItem(CONFIG.STORAGE_KEY) || '[]';
        }
    }

    async saveParcels(parcels) {
        try {
            // localStorage 형식을 Supabase 형식으로 변환
            const supabaseParcels = parcels.map(localData => this.convertToSupabaseFormat(localData));
            return await this.supabaseManager.saveParcels(supabaseParcels);
        } catch (error) {
            console.error('❌ 필지 데이터 저장 실패:', error);
            // Fallback to localStorage
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(parcels));
            return false;
        }
    }

    // localStorage 형식 → Supabase 형식 변환
    convertToSupabaseFormat(localData) {
        // 좌표 추출 (geometry에서 또는 직접 값에서)
        let lat, lng;

        if (localData.geometry && localData.geometry.coordinates) {
            // GeoJSON 형식
            [lng, lat] = localData.geometry.coordinates;
        } else if (localData.lat && localData.lng) {
            // 직접 좌표
            lat = localData.lat;
            lng = localData.lng;
        } else {
            // 기본값 (서울시청)
            lat = 37.5666103;
            lng = 126.9783882;
        }

        const supabaseData = this.supabaseManager.createParcelData(
            lat,
            lng,
            localData.parcelNumber || localData.parcel_name || '알수없음',
            this.createMemoFromLocalData(localData),
            true, // 저장된 데이터는 모두 색칠된 것으로 간주
            localData.isSearchParcel ? 'search' : 'click'
        );

        // ✅ geometry 정보 보존 - 폴리곤 복원에 필요
        if (localData.geometry) {
            supabaseData.geometry = localData.geometry;
        }

        return supabaseData;
    }

    // localStorage 형식에서 메모 생성
    createMemoFromLocalData(localData) {
        const memo = [];
        
        if (localData.ownerName) memo.push(`소유자: ${localData.ownerName}`);
        if (localData.ownerAddress) memo.push(`주소: ${localData.ownerAddress}`);
        if (localData.ownerContact) memo.push(`연락처: ${localData.ownerContact}`);
        if (localData.memo) memo.push(`메모: ${localData.memo}`);
        if (localData.visitCount) memo.push(`방문횟수: ${localData.visitCount}`);
        if (localData.visitDate) memo.push(`방문일: ${localData.visitDate}`);
        
        return memo.join('\n');
    }

    // Supabase 형식 → localStorage 형식 변환
    convertToLocalStorageFormat(supabaseData) {
        const memoLines = supabaseData.memo.split('\n');
        const localData = {
            id: supabaseData.id,
            parcelNumber: supabaseData.parcel_name,
            lat: supabaseData.lat,
            lng: supabaseData.lng,
            ownerName: '',
            ownerAddress: '',
            ownerContact: '',
            memo: '',
            visitCount: 0,
            visitDate: '',
            isSearchParcel: supabaseData.color_type === 'search',
            pnu: supabaseData.id, // ID를 PNU로 사용
            // ✅ Supabase에 저장된 geometry가 있으면 사용, 없으면 Point로 생성
            geometry: supabaseData.geometry || {
                type: 'Point',
                coordinates: [supabaseData.lng, supabaseData.lat]
            },
            timestamp: supabaseData.created_at
        };

        // 메모 파싱
        memoLines.forEach(line => {
            if (line.startsWith('소유자: ')) localData.ownerName = line.replace('소유자: ', '');
            else if (line.startsWith('주소: ')) localData.ownerAddress = line.replace('주소: ', '');
            else if (line.startsWith('연락처: ')) localData.ownerContact = line.replace('연락처: ', '');
            else if (line.startsWith('메모: ')) localData.memo = line.replace('메모: ', '');
            else if (line.startsWith('방문횟수: ')) localData.visitCount = parseInt(line.replace('방문횟수: ', '')) || 0;
            else if (line.startsWith('방문일: ')) localData.visitDate = line.replace('방문일: ', '');
        });

        return localData;
    }

    // ========================================
    // 마이그레이션
    // ========================================

    async migrateFromLocalStorage() {
        if (this.migrationComplete) return;

        try {
            const localData = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (!localData || localData === '[]') {
                console.log('📦 마이그레이션할 localStorage 데이터 없음');
                this.migrationComplete = true;
                return;
            }

            const parcels = JSON.parse(localData);
            console.log('📦 localStorage 데이터 마이그레이션 시작:', parcels.length, '개 필지');

            // Supabase에 저장
            await this.saveParcels(parcels);

            // 마이그레이션 완료 표시
            localStorage.setItem('migration_complete', new Date().toISOString());
            this.migrationComplete = true;

            console.log('✅ localStorage → Supabase 마이그레이션 완료');
        } catch (error) {
            console.error('❌ 마이그레이션 실패:', error);
        }
    }

    // ========================================
    // 실시간 동기화 설정
    // ========================================

    setupRealTimeSync() {
        if (!this.supabaseManager.isConnected) {
            console.log('⚠️ Supabase 미연결로 실시간 동기화 생략');
            return;
        }

        // Supabase Realtime 구독
        const subscription = this.supabaseManager.setupRealTimeSync();

        // BroadcastChannel로 탭 간 동기화
        if (typeof BroadcastChannel !== 'undefined') {
            this.broadcastChannel = new BroadcastChannel('parcels_sync');
            this.broadcastChannel.addEventListener('message', (event) => {
                this.handleBroadcastMessage(event.data);
            });
        }

        console.log('📡 실시간 동기화 활성화');
    }

    handleBroadcastMessage(data) {
        const { type, data: messageData, timestamp } = data;
        
        // 자신이 보낸 메시지는 무시
        if (Date.now() - timestamp < 100) return;

        switch (type) {
            case 'parcels_updated':
                this.onParcelsUpdated(messageData);
                break;
            case 'parcel_deleted':
                this.onParcelDeleted(messageData);
                break;
        }
    }

    onParcelsUpdated(parcels) {
        // 지도 새로고침
        if (window.loadSavedParcels) {
            window.loadSavedParcels();
        }
        console.log('🔄 실시간 업데이트: 필지 데이터 갱신');
    }

    onParcelDeleted(parcel) {
        // 특정 필지 제거
        if (window.removeParcelFromMap) {
            window.removeParcelFromMap(parcel.id);
        }
        console.log('🗑️ 실시간 업데이트: 필지 삭제');
    }

    // ========================================
    // 유틸리티 메서드
    // ========================================

    async deleteParcel(parcelId) {
        return await this.supabaseManager.deleteParcel(parcelId);
    }

    async searchParcels(query) {
        return await this.supabaseManager.searchParcels(query);
    }

    async getConnectionStatus() {
        return await this.supabaseManager.getConnectionStatus();
    }

    async createBackup() {
        return await this.supabaseManager.createDailyBackup();
    }

    async exportToGoogle() {
        const parcels = await this.supabaseManager.loadParcels();
        return await this.supabaseManager.exportToGoogleSheets(parcels);
    }
}

// ========================================
// 기존 localStorage 함수들을 Supabase로 대체
// ========================================

// 전역 어댑터 인스턴스 생성
window.supabaseAdapter = new SupabaseAdapter();

// localStorage 래퍼 함수들
async function getStorageItem(key) {
    return await window.supabaseAdapter.getItem(key);
}

async function setStorageItem(key, value) {
    return await window.supabaseAdapter.setItem(key, value);
}

// 기존 코드와의 호환성을 위한 헬퍼 함수들 (무한 루프 방지)
window.migratedGetItem = async function(key) {
    if (key === CONFIG.STORAGE_KEY) {
        // 🚨 무한 루프 방지: localStorage에서 직접 읽기 (로그 제거)
        return localStorage.getItem(key) || '[]';
    }
    return localStorage.getItem(key);
};

window.migratedSetItem = async function(key, value) {
    if (key === CONFIG.STORAGE_KEY) {
        const parcels = JSON.parse(value);
        
        // ✅ 중요: localStorage에도 저장해야 새로고침 시 복원 가능
        localStorage.setItem(key, value);
        console.log('💾 localStorage 저장 완료:', parcels.length, '개 항목');
        
        // Supabase에도 저장 (실패해도 localStorage는 유지됨)
        try {
            await window.supabaseAdapter.saveParcels(parcels);
            console.log('☁️ Supabase 저장 완료:', parcels.length, '개 항목');
        } catch (error) {
            console.warn('⚠️ Supabase 저장 실패 (localStorage는 성공):', error);
        }
        return;
    }
    localStorage.setItem(key, value);
};

console.log('🔄 SupabaseAdapter 로드 완료');