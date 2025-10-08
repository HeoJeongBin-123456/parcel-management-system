/* eslint-disable */
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
            // 🔒 데이터 정제: 잘못된 UTF-16 문자 제거
            const sanitizedParcels = window.sanitizeObject ? window.sanitizeObject(parcels) : parcels;

            // localStorage 형식을 Supabase 형식으로 변환
            const supabaseParcels = sanitizedParcels.map(localData => this.convertToSupabaseFormat(localData));
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
        const normalizedData = this.normalizeLegacyMemo({ ...localData });

        // 좌표 추출 (geometry에서 또는 직접 값에서)
        let lat, lng;

        if (normalizedData.geometry && normalizedData.geometry.coordinates) {
            // GeoJSON 형식
            [lng, lat] = normalizedData.geometry.coordinates;
        } else if (normalizedData.lat && normalizedData.lng) {
            // 직접 좌표
            lat = normalizedData.lat;
            lng = normalizedData.lng;
        } else {
            // 기본값 (서울시청)
            lat = 37.5666103;
            lng = 126.9783882;
        }

        const resolvedPnu = this.resolvePnu(normalizedData);
        const memoPayload = this.createMemoFromLocalData(normalizedData);

        const supabaseData = this.supabaseManager.createParcelData(
            lat,
            lng,
            normalizedData.parcelNumber || normalizedData.parcel_name || '알수없음',
            memoPayload,
            true, // 저장된 데이터는 모두 색칠된 것으로 간주
            normalizedData.isSearchParcel ? 'search' : 'click'
        );

        supabaseData.memo = memoPayload;

        if (normalizedData.id) {
            supabaseData.id = normalizedData.id;
        }
        if (resolvedPnu) {
            supabaseData.pnu = resolvedPnu;
            // ⚠️ pnu_code 컬럼 없음 - pnu만 사용
            // supabaseData.pnu_code = resolvedPnu;
            normalizedData.pnu = resolvedPnu;
            if (!supabaseData.id) {
                supabaseData.id = resolvedPnu;
            }
        }

        // ⚠️ geometry는 Supabase에 저장하지 않음 (컬럼 없음, 필요시 VWorld API로 재조회)

        // ✅ 색상 인덱스 보존 - 8색 팔레트 시스템
        if (normalizedData.colorIndex !== undefined) {
            supabaseData.colorIndex = normalizedData.colorIndex;
        } else if (normalizedData.isSearchParcel) {
            supabaseData.colorIndex = 8; // 검색 모드는 보라색 (인덱스 8)
        }

        // 모드 정보 추가
        supabaseData.mode = normalizedData.mode || (normalizedData.isSearchParcel ? 'search' : 'click');

        // 소유자 정보 분리 저장
        supabaseData.owner_name = normalizedData.ownerName || null;
        supabaseData.owner_address = normalizedData.ownerAddress || null;
        supabaseData.owner_contact = normalizedData.ownerContact || null;

        // ⚠️ owner_info는 Supabase에 저장하지 않음 (컬럼 없음, 개별 필드 사용)
        // if (normalizedData.ownerName || normalizedData.ownerAddress || normalizedData.ownerContact) {
        //     supabaseData.owner_info = {
        //         name: normalizedData.ownerName || '',
        //         address: normalizedData.ownerAddress || '',
        //         contact: normalizedData.ownerContact || '',
        //         updated_at: new Date().toISOString()
        //     };
        // } else {
        //     supabaseData.owner_info = null;
        // }

        return supabaseData;
    }

    // localStorage 형식에서 메모 생성 (소유자 정보는 memo에 포함하지 않음)
    createMemoFromLocalData(localData) {
        const memo = [];

        if (localData.memo && localData.memo.trim().length > 0) {
            memo.push(`메모: ${localData.memo.trim()}`);
        }
        if (localData.visitCount) {
            memo.push(`방문횟수: ${localData.visitCount}`);
        }
        if (localData.visitDate) {
            memo.push(`방문일: ${localData.visitDate}`);
        }

        return memo.join('\n');
    }

    normalizeLegacyMemo(localData) {
        if (!localData || typeof localData.memo !== 'string') {
            return localData;
        }

        const lines = localData.memo.split('\n');
        let explicitMemo = null;
        const remaining = [];

        lines.forEach(rawLine => {
            const line = rawLine.trim();
            if (!line) {
                return;
            }

            if (line.startsWith('소유자: ')) {
                if (!localData.ownerName || localData.ownerName.trim().length === 0) {
                    localData.ownerName = line.replace('소유자: ', '').trim();
                }
                return;
            }

            if (line.startsWith('주소: ')) {
                if (!localData.ownerAddress || localData.ownerAddress.trim().length === 0) {
                    localData.ownerAddress = line.replace('주소: ', '').trim();
                }
                return;
            }

            if (line.startsWith('연락처: ')) {
                if (!localData.ownerContact || localData.ownerContact.trim().length === 0) {
                    localData.ownerContact = line.replace('연락처: ', '').trim();
                }
                return;
            }

            if (line.startsWith('방문횟수: ')) {
                const parsed = parseInt(line.replace('방문횟수: ', '').trim(), 10);
                if (!Number.isNaN(parsed)) {
                    localData.visitCount = parsed;
                }
                return;
            }

            if (line.startsWith('방문일: ')) {
                if (!localData.visitDate) {
                    localData.visitDate = line.replace('방문일: ', '').trim();
                }
                return;
            }

            if (line.startsWith('메모: ')) {
                if (explicitMemo === null) {
                    explicitMemo = line.replace('메모: ', '').trim();
                }
                return;
            }

            remaining.push(rawLine);
        });

        if (explicitMemo !== null) {
            localData.memo = explicitMemo;
        } else {
            localData.memo = remaining.join('\n').trim();
        }

        return localData;
    }

    // Supabase 형식 → localStorage 형식 변환
    convertToLocalStorageFormat(supabaseData) {
        const rawMemo = typeof supabaseData.memo === 'string' ? supabaseData.memo : '';
        const memoLines = rawMemo.split('\n');
        const resolvedPnu = this.resolvePnu(supabaseData);

        // 🎯 색상 인덱스 검증 및 변환 (hex → index)
        let colorIndex = supabaseData.colorIndex;

        // colorIndex가 없거나 유효하지 않으면 color(hex)에서 변환 시도
        if (typeof colorIndex !== 'number' || colorIndex < 0 || colorIndex > 8) {
            if (supabaseData.color) {
                // hex 값을 index로 변환
                const hexToIndex = {
                    '#FF0000': 0, // 빨강
                    '#FFA500': 1, // 주황
                    '#FFFF00': 2, // 노랑
                    '#90EE90': 3, // 연두
                    '#0000FF': 4, // 파랑
                    '#000000': 5, // 검정
                    '#FFFFFF': 6, // 흰색
                    '#87CEEB': 7, // 하늘색
                    '#9B59B6': 8  // 검색 (보라색)
                };
                colorIndex = hexToIndex[supabaseData.color] ?? 0;
                console.log(`🎨 색상 hex → index 변환: ${supabaseData.color} → ${colorIndex}`);
            } else {
                colorIndex = 0; // 기본값: 빨강
            }
        }

        // parcelColors LocalStorage 동기화
        if (resolvedPnu && colorIndex >= 0 && colorIndex <= 8) {
            try {
                const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
                parcelColors[resolvedPnu] = colorIndex;
                localStorage.setItem('parcelColors', JSON.stringify(parcelColors));
            } catch (error) {
                console.warn('⚠️ parcelColors 동기화 실패:', error);
            }
        }

        const localData = {
            id: supabaseData.id,
            parcelNumber: supabaseData.parcel_name,
            lat: supabaseData.lat,
            lng: supabaseData.lng,
            ownerName: supabaseData.owner_name || '',
            ownerAddress: supabaseData.owner_address || '',
            ownerContact: supabaseData.owner_contact || '',
            memo: '',
            visitCount: 0,
            colorIndex: colorIndex, // 검증된 colorIndex 사용
            mode: supabaseData.mode || 'click',
            visitDate: '',
            isSearchParcel: supabaseData.parcel_type === 'search',
            pnu: resolvedPnu || supabaseData.id,
            // ✅ Supabase에 저장된 geometry가 있으면 사용, 없으면 Point로 생성
            geometry: supabaseData.geometry || {
                type: 'Point',
                coordinates: [supabaseData.lng, supabaseData.lat]
            },
            timestamp: supabaseData.created_at
        };

        // owner_info JSON 우선 적용
        if (supabaseData.owner_info) {
            const ownerInfo = typeof supabaseData.owner_info === 'string'
                ? this.safeParseJSON(supabaseData.owner_info)
                : supabaseData.owner_info;

            if (ownerInfo) {
                if (ownerInfo.name && (!localData.ownerName || localData.ownerName.trim().length === 0)) {
                    localData.ownerName = ownerInfo.name;
                }
                if (ownerInfo.address && (!localData.ownerAddress || localData.ownerAddress.trim().length === 0)) {
                    localData.ownerAddress = ownerInfo.address;
                }
                if (ownerInfo.contact && (!localData.ownerContact || localData.ownerContact.trim().length === 0)) {
                    localData.ownerContact = ownerInfo.contact;
                }
            }
        }

        const leftoverMemo = [];

        memoLines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) {
                return;
            }

            if (trimmed.startsWith('소유자: ')) {
                if (!localData.ownerName || localData.ownerName.trim().length === 0) {
                    localData.ownerName = trimmed.replace('소유자: ', '').trim();
                }
                return;
            }

            if (trimmed.startsWith('주소: ')) {
                if (!localData.ownerAddress || localData.ownerAddress.trim().length === 0) {
                    localData.ownerAddress = trimmed.replace('주소: ', '').trim();
                }
                return;
            }

            if (trimmed.startsWith('연락처: ')) {
                if (!localData.ownerContact || localData.ownerContact.trim().length === 0) {
                    localData.ownerContact = trimmed.replace('연락처: ', '').trim();
                }
                return;
            }

            if (trimmed.startsWith('메모: ')) {
                const memoValue = trimmed.replace('메모: ', '').trim();
                localData.memo = memoValue;
                return;
            }

            if (trimmed.startsWith('방문횟수: ')) {
                const parsed = parseInt(trimmed.replace('방문횟수: ', '').trim(), 10);
                if (!Number.isNaN(parsed)) {
                    localData.visitCount = parsed;
                }
                return;
            }

            if (trimmed.startsWith('방문일: ')) {
                localData.visitDate = trimmed.replace('방문일: ', '').trim();
                return;
            }

            leftoverMemo.push(line);
        });

        if (leftoverMemo.length > 0) {
            const tail = leftoverMemo.join('\n').trim();
            if (tail.length > 0) {
                localData.memo = localData.memo ? `${localData.memo}\n${tail}` : tail;
            }
        }

        localData.memo = (localData.memo || '').trim();

        return localData;
    }

    resolvePnu(data) {
        if (!data) {
            return null;
        }

        const candidates = [];

        const pushCandidate = (value) => {
            if (!value && value !== 0) {
                return;
            }
            const stringValue = String(value).trim();
            if (stringValue.length === 0 || stringValue === 'null' || stringValue === 'undefined') {
                return;
            }
            candidates.push(stringValue);
        };

        pushCandidate(data.pnu);
        pushCandidate(data.pnu_code);
        pushCandidate(data.pnuCode);
        pushCandidate(data.pnuNumber);
        pushCandidate(data.pnucode);
        pushCandidate(data.id);
        pushCandidate(data.parcelNumber);
        pushCandidate(data.parcel_name);

        if (data.properties) {
            pushCandidate(data.properties.PNU);
            pushCandidate(data.properties.pnu);
            pushCandidate(data.properties.pnuCode);
        }

        if (data.geometry && data.geometry.properties) {
            pushCandidate(data.geometry.properties.PNU);
            pushCandidate(data.geometry.properties.pnu);
        }

        const ownerInfo = data.owner_info || data.ownerInfo;
        if (ownerInfo) {
            const parsed = typeof ownerInfo === 'string' ? this.safeParseJSON(ownerInfo) : ownerInfo;
            if (parsed && parsed.pnu) {
                pushCandidate(parsed.pnu);
            }
        }

        return candidates.length > 0 ? candidates[0] : null;
    }

    safeParseJSON(payload) {
        try {
            return JSON.parse(payload);
        } catch (error) {
            return null;
        }
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

        // 🔒 데이터 정제: 잘못된 UTF-16 문자 제거
        const sanitizedParcels = window.sanitizeObject ? window.sanitizeObject(parcels) : parcels;
        const sanitizedValue = JSON.stringify(sanitizedParcels);

        // ✅ 중요: localStorage에도 저장해야 새로고침 시 복원 가능
        localStorage.setItem(key, sanitizedValue);
        console.log('💾 localStorage 저장 완료:', sanitizedParcels.length, '개 항목');

        // Supabase에도 저장 (실패해도 localStorage는 유지됨)
        try {
            await window.supabaseAdapter.saveParcels(sanitizedParcels);
            console.log('☁️ Supabase 저장 완료:', sanitizedParcels.length, '개 항목');
        } catch (error) {
            console.warn('⚠️ Supabase 저장 실패 (localStorage는 성공):', error);
        }
        return;
    }
    localStorage.setItem(key, value);
};

console.log('🔄 SupabaseAdapter 로드 완료');
