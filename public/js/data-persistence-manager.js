// 다층 데이터 영속성 관리자 - 5단계 보안 저장 시스템
class DataPersistenceManager {
    constructor() {
        this.STORAGE_KEYS = {
            MAIN: 'parcelData',
            SESSION: 'parcelData_session',
            BACKUP: 'parcelData_backup',
            SNAPSHOT: 'parcelData_snapshot',
            METADATA: 'parcelData_meta',
            COLORS: 'parcelColors',
            MARKERS: 'markerStates'
        };
        
        this.db = null;
        this.isIndexedDBReady = false;
        this.saveQueue = [];
        this.isSaving = false;
        this.lastSaveTime = 0;
        this.saveDebounceTime = 500; // 0.5초 디바운스

        // 색상 및 마커 상태 관리
        this.colorStates = new Map();
        this.markerStates = new Map();
        
        console.log('🛡️ DataPersistenceManager 초기화');
        this.initializeIndexedDB();
        this.setupAutoSave();
        this.initializeColorAndMarkerStates();
    }

    // IndexedDB 초기화
    async initializeIndexedDB() {
        try {
            const request = indexedDB.open('ParcelDB', 2); // 버전 업그레이드

            request.onerror = () => {
                console.error('❌ IndexedDB 초기화 실패');
                this.isIndexedDBReady = false;
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isIndexedDBReady = true;
                console.log('✅ IndexedDB 초기화 완료');
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 필지 데이터 저장소
                if (!db.objectStoreNames.contains('parcels')) {
                    const parcelStore = db.createObjectStore('parcels', { keyPath: 'id' });
                    parcelStore.createIndex('pnu', 'pnu', { unique: false });
                    parcelStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // 🗺️ 폴리곤 데이터 저장소 (새로 추가)
                if (!db.objectStoreNames.contains('polygons')) {
                    const polygonStore = db.createObjectStore('polygons', { keyPath: 'pnu' });
                    polygonStore.createIndex('savedAt', 'savedAt', { unique: false });
                    console.log('🗺️ 폴리곤 저장소 생성');
                }

                // 스냅샷 저장소 (히스토리)
                if (!db.objectStoreNames.contains('snapshots')) {
                    const snapshotStore = db.createObjectStore('snapshots', { keyPath: 'timestamp' });
                    snapshotStore.createIndex('type', 'type', { unique: false });
                }

                // 백업 메타데이터
                if (!db.objectStoreNames.contains('backups')) {
                    const backupStore = db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
                    backupStore.createIndex('date', 'date', { unique: false });
                }

                console.log('🗄️ IndexedDB 스키마 생성 완료');
            };

        } catch (error) {
            console.error('❌ IndexedDB 초기화 오류:', error);
            this.isIndexedDBReady = false;
        }
    }

    // 5단계 보안 저장
    async save(data, options = {}) {
        const now = Date.now();
        const metadata = {
            timestamp: now,
            version: '1.0',
            checksum: this.generateChecksum(data),
            source: options.source || 'user',
            count: data.length || 0
        };

        console.log(`💾 5단계 보안 저장 시작: ${data.length}개 필지`);

        const results = {
            localStorage: false,
            sessionStorage: false,
            indexedDB: false,
            supabase: false,
            snapshot: false
        };

        try {
            // 1단계: localStorage 메인 저장
            try {
                localStorage.setItem(this.STORAGE_KEYS.MAIN, JSON.stringify(data));
                localStorage.setItem(this.STORAGE_KEYS.METADATA, JSON.stringify(metadata));
                results.localStorage = true;
                console.log('✅ 1단계: localStorage 저장 완료');
            } catch (error) {
                console.error('❌ 1단계: localStorage 저장 실패:', error);
            }

            // 2단계: sessionStorage 세션 백업
            try {
                sessionStorage.setItem(this.STORAGE_KEYS.SESSION, JSON.stringify(data));
                results.sessionStorage = true;
                console.log('✅ 2단계: sessionStorage 저장 완료');
            } catch (error) {
                console.error('❌ 2단계: sessionStorage 저장 실패:', error);
            }

            // 3단계: IndexedDB 대용량 백업
            if (this.isIndexedDBReady && this.db) {
                try {
                    await this.saveToIndexedDB(data, metadata);
                    results.indexedDB = true;
                    console.log('✅ 3단계: IndexedDB 저장 완료');
                } catch (error) {
                    console.error('❌ 3단계: IndexedDB 저장 실패:', error);
                }
            }

            // 4단계: Supabase 클라우드 동기화 (배치 처리)
            if (window.SupabaseManager && window.SupabaseManager.isConnected && !options.skipSupabase) {
                try {
                    await this.saveToSupabase(data);
                    results.supabase = true;
                    console.log('✅ 4단계: Supabase 저장 완료');
                } catch (error) {
                    console.error('❌ 4단계: Supabase 저장 실패:', error);
                }
            }

            // 5단계: 스냅샷 생성 (시간별 백업)
            try {
                await this.createSnapshot(data, metadata);
                results.snapshot = true;
                console.log('✅ 5단계: 스냅샷 생성 완료');
            } catch (error) {
                console.error('❌ 5단계: 스냅샷 생성 실패:', error);
            }

            // 성공률 계산
            const successCount = Object.values(results).filter(Boolean).length;
            const successRate = (successCount / 5) * 100;
            
            console.log(`🎯 저장 완료: ${successCount}/5 단계 성공 (${successRate}%)`);
            
            // 최소 2단계는 성공해야 함
            if (successCount >= 2) {
                return { success: true, results, metadata };
            } else {
                throw new Error(`저장 실패: ${successCount}/5 단계만 성공`);
            }

        } catch (error) {
            console.error('💥 5단계 저장 시스템 오류:', error);
            return { success: false, error, results };
        }
    }

    // IndexedDB 저장
    async saveToIndexedDB(data, metadata) {
        return new Promise((resolve, reject) => {
            if (!this.isIndexedDBReady || !this.db) {
                reject(new Error('IndexedDB 준비되지 않음'));
                return;
            }

            const transaction = this.db.transaction(['parcels'], 'readwrite');
            const store = transaction.objectStore('parcels');
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);

            // 기존 데이터 삭제
            store.clear();

            // 새 데이터 저장
            data.forEach(item => {
                const parcelData = {
                    ...item,
                    id: item.id || this.generateId(),
                    timestamp: metadata.timestamp,
                    checksum: this.generateChecksum(item)
                };
                store.add(parcelData);
            });
        });
    }

    // Supabase 배치 저장
    async saveToSupabase(data) {
        if (!window.SupabaseManager || !window.SupabaseManager.isConnected) {
            throw new Error('Supabase 연결되지 않음');
        }

        // 배치 크기 제한 (한 번에 100개씩)
        const batchSize = 100;
        const batches = [];
        
        for (let i = 0; i < data.length; i += batchSize) {
            batches.push(data.slice(i, i + batchSize));
        }

        console.log(`📦 Supabase 배치 저장: ${batches.length}개 배치`);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            try {
                await window.SupabaseManager.saveParcels(batch);
                console.log(`✅ 배치 ${i + 1}/${batches.length} 저장 완료`);
            } catch (error) {
                console.error(`❌ 배치 ${i + 1} 저장 실패:`, error);
                // 배치 실패해도 계속 진행
            }
        }
    }

    // 스냅샷 생성 (시간별 히스토리)
    async createSnapshot(data, metadata) {
        if (!this.isIndexedDBReady || !this.db) {
            // IndexedDB 없으면 localStorage에 백업
            try {
                const snapshots = JSON.parse(localStorage.getItem('snapshots') || '[]');
                snapshots.push({
                    timestamp: metadata.timestamp,
                    data: data,
                    metadata: metadata
                });
                
                // 최근 24시간만 보관
                const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
                const recentSnapshots = snapshots.filter(s => s.timestamp > cutoffTime);
                
                localStorage.setItem('snapshots', JSON.stringify(recentSnapshots));
                return;
            } catch (error) {
                console.error('localStorage 스냅샷 실패:', error);
                return;
            }
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['snapshots'], 'readwrite');
            const store = transaction.objectStore('snapshots');
            
            const snapshot = {
                timestamp: metadata.timestamp,
                type: 'auto',
                data: data,
                metadata: metadata,
                compressed: this.compressData(data)
            };

            transaction.oncomplete = () => {
                console.log('📸 스냅샷 생성 완료:', new Date(metadata.timestamp).toLocaleString());
                this.cleanupOldSnapshots();
                resolve();
            };
            
            transaction.onerror = () => reject(transaction.error);

            store.add(snapshot);
        });
    }

    // 5단계 복원 시스템
    async restore() {
        console.log('🔄 5단계 데이터 복원 시작');
        
        const sources = [
            { name: 'localStorage', method: () => this.restoreFromLocalStorage() },
            { name: 'sessionStorage', method: () => this.restoreFromSessionStorage() },
            { name: 'IndexedDB', method: () => this.restoreFromIndexedDB() },
            { name: 'Supabase', method: () => this.restoreFromSupabase() },
            { name: 'Snapshot', method: () => this.restoreFromSnapshot() }
        ];

        for (const source of sources) {
            try {
                console.log(`🔍 ${source.name}에서 복원 시도...`);
                const data = await source.method();
                
                if (data && data.length > 0) {
                    console.log(`✅ ${source.name}에서 ${data.length}개 필지 복원 성공`);
                    
                    // 데이터 무결성 검증
                    const validatedData = this.validateData(data);
                    
                    // 다른 저장소에도 동기화
                    await this.save(validatedData, { source: source.name, skipSupabase: source.name === 'Supabase' });
                    
                    return validatedData;
                }
            } catch (error) {
                console.warn(`⚠️ ${source.name} 복원 실패:`, error);
            }
        }

        console.log('📭 모든 저장소에서 데이터를 찾을 수 없습니다');
        return [];
    }

    async clearAllData() {
        console.log('🧹 DataPersistenceManager 전체 데이터 초기화 시작');

        this.saveQueue = [];
        this.isSaving = false;
        this.lastSaveTime = 0;
        clearTimeout(this.saveTimeout);

        const localKeys = new Set([
            ...Object.values(this.STORAGE_KEYS),
            'snapshots',
            'lastAutoSave',
            'emergency_autosave_backup',
            'backup_settings',
            'parcelColors',
            'markerStates'
        ]);

        localKeys.forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.warn('⚠️ DataPersistenceManager 로컬 키 삭제 실패:', key, error);
            }
        });

        try {
            sessionStorage.removeItem(this.STORAGE_KEYS.SESSION);
        } catch (error) {
            console.warn('⚠️ DataPersistenceManager 세션 키 삭제 실패:', error);
        }

        this.colorStates.clear();
        this.markerStates.clear();

        if (this.isIndexedDBReady && this.db) {
            const storeNames = ['parcels', 'polygons', 'snapshots'];
            for (const storeName of storeNames) {
                await this.clearIndexedDBStore(storeName);
            }
        } else {
            if (typeof indexedDB !== 'undefined') {
                try {
                    const deleteRequest = indexedDB.deleteDatabase('ParcelDB');
                    await new Promise(resolve => {
                        deleteRequest.onsuccess = () => resolve();
                        deleteRequest.onerror = () => resolve();
                        deleteRequest.onblocked = () => resolve();
                    });
                    this.db = null;
                    this.isIndexedDBReady = false;
                } catch (error) {
                    console.warn('⚠️ IndexedDB 삭제 실패:', error);
                }
            }
        }

        console.log('✅ DataPersistenceManager 전체 데이터 초기화 완료');
    }

    async clearIndexedDBStore(storeName) {
        if (!this.db) {
            return;
        }

        if (!this.db.objectStoreNames.contains(storeName)) {
            return;
        }

        await new Promise(resolve => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.warn(`⚠️ IndexedDB 스토어 초기화 실패: ${storeName}`);
                resolve();
            };
        });
    }

    // localStorage에서 복원
    restoreFromLocalStorage() {
        const data = localStorage.getItem(this.STORAGE_KEYS.MAIN);
        return data ? JSON.parse(data) : null;
    }

    // sessionStorage에서 복원
    restoreFromSessionStorage() {
        const data = sessionStorage.getItem(this.STORAGE_KEYS.SESSION);
        return data ? JSON.parse(data) : null;
    }

    // IndexedDB에서 복원
    async restoreFromIndexedDB() {
        if (!this.isIndexedDBReady || !this.db) {
            return null;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['parcels'], 'readonly');
            const store = transaction.objectStore('parcels');
            const request = store.getAll();

            request.onsuccess = () => {
                const data = request.result || [];
                // 타임스탬프순 정렬
                data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                resolve(data);
            };

            request.onerror = () => reject(request.error);
        });
    }

    // Supabase에서 복원
    async restoreFromSupabase() {
        if (!window.SupabaseManager || !window.SupabaseManager.isConnected) {
            return null;
        }

        try {
            return await window.SupabaseManager.loadParcels();
        } catch (error) {
            console.error('Supabase 복원 실패:', error);
            return null;
        }
    }

    // 스냅샷에서 복원
    async restoreFromSnapshot() {
        if (!this.isIndexedDBReady || !this.db) {
            // localStorage 백업에서 시도
            try {
                const snapshots = JSON.parse(localStorage.getItem('snapshots') || '[]');
                if (snapshots.length > 0) {
                    const latest = snapshots[snapshots.length - 1];
                    return latest.data;
                }
            } catch (error) {
                console.error('localStorage 스냅샷 복원 실패:', error);
            }
            return null;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['snapshots'], 'readonly');
            const store = transaction.objectStore('snapshots');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev'); // 최신부터

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const snapshot = cursor.value;
                    resolve(snapshot.data || []);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    // 데이터 검증
    validateData(data) {
        if (!Array.isArray(data)) {
            console.warn('⚠️ 데이터가 배열이 아님, 빈 배열 반환');
            return [];
        }

        return data.filter(item => {
            // 필수 필드 검증
            if (!item.pnu && !item.lat) {
                console.warn('⚠️ 필수 필드 누락된 필지 제외:', item);
                return false;
            }
            return true;
        }).map(item => {
            // 데이터 정규화
            return {
                ...item,
                id: item.id || this.generateId(),
                timestamp: item.timestamp || Date.now(),
                parcelNumber: item.parcelNumber || item.pnu || 'Unknown'
            };
        });
    }

    // 유틸리티 함수들
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    generateChecksum(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32비트 정수로 변환
        }
        return hash.toString(16);
    }

    compressData(data) {
        // 간단한 압축 (실제로는 더 정교한 압축 라이브러리 사용 권장)
        try {
            const jsonStr = JSON.stringify(data);
            return btoa(encodeURIComponent(jsonStr));
        } catch (error) {
            console.warn('데이터 압축 실패:', error);
            return null;
        }
    }

    // 오래된 스냅샷 정리
    async cleanupOldSnapshots() {
        if (!this.isIndexedDBReady || !this.db) return;

        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7일 전

        try {
            const transaction = this.db.transaction(['snapshots'], 'readwrite');
            const store = transaction.objectStore('snapshots');
            const index = store.index('timestamp');
            const range = IDBKeyRange.upperBound(cutoffTime);
            
            index.openCursor(range).onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
        } catch (error) {
            console.error('스냅샷 정리 실패:', error);
        }
    }

    // 자동 저장 설정
    setupAutoSave() {
        // 페이지 언로드 시 강제 저장
        window.addEventListener('beforeunload', () => {
            console.log('💾 페이지 종료 전 데이터 저장');
            const data = this.getCurrentData();
            if (data && data.length > 0) {
                // 동기 저장 (빠른 저장)
                try {
                    localStorage.setItem(this.STORAGE_KEYS.MAIN, JSON.stringify(data));
                    sessionStorage.setItem(this.STORAGE_KEYS.SESSION, JSON.stringify(data));
                    localStorage.setItem(this.STORAGE_KEYS.BACKUP, JSON.stringify({
                        data: data,
                        timestamp: Date.now(),
                        source: 'beforeunload'
                    }));
                } catch (error) {
                    console.error('긴급 저장 실패:', error);
                }
            }
        });

        // 주기적 자동 저장 (5분마다)
        setInterval(() => {
            const data = this.getCurrentData();
            if (data && data.length > 0) {
                console.log('⏰ 자동 저장 실행');
                this.save(data, { source: 'auto' });
            }
        }, 5 * 60 * 1000);
    }

    // 현재 데이터 가져오기
    getCurrentData() {
        if (window.parcelsData && Array.isArray(window.parcelsData)) {
            return window.parcelsData;
        }
        
        // 백업으로 localStorage에서
        try {
            const stored = localStorage.getItem(this.STORAGE_KEYS.MAIN);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('현재 데이터 가져오기 실패:', error);
            return [];
        }
    }

    // 즉시 저장 (디바운스 없이)
    async saveImmediate(data, source = 'immediate') {
        console.log('⚡ 즉시 저장 실행');
        return await this.save(data, { source });
    }

    // 디바운스 저장
    debouncedSave(data, source = 'debounced') {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.save(data, { source });
        }, this.saveDebounceTime);
    }

    // 상태 정보
    getStatus() {
        return {
            isIndexedDBReady: this.isIndexedDBReady,
            lastSaveTime: this.lastSaveTime,
            saveQueueLength: this.saveQueue.length,
            isSaving: this.isSaving
        };
    }

    // ===== 색상 및 마커 영속성 기능 추가 =====

    /**
     * 색상 상태 즉시 저장
     * @param {string} parcelId - 필지 ID
     * @param {Object} colorData - 색상 데이터
     * @returns {Promise<boolean>} 저장 성공 여부
     */
    async saveColorState(parcelId, colorData) {
        const colorState = {
            parcel_id: parcelId,
            color: colorData.color || colorData.selectedColor,
            is_colored: colorData.is_colored !== undefined ? colorData.is_colored : !!colorData.color,
            color_index: colorData.color_index || colorData.colorIndex || 0,
            applied_at: new Date().toISOString(),
            applied_by: this.getSessionId()
        };

        // 1. 메모리에 즉시 저장
        this.colorStates.set(parcelId, colorState);

        // 2. LocalStorage에 즉시 저장
        this.saveColorStatesToLocalStorage();

        // 3. UI 업데이트 이벤트 발생
        this.triggerColorUpdate(parcelId, colorState);

        // 4. Supabase 비동기 저장
        if (window.SupabaseManager && window.SupabaseManager.isConnected) {
            try {
                await window.SupabaseManager.updateParcelColor(parcelId, {
                    selectedColor: colorState.color,
                    is_colored: colorState.is_colored,
                    color_index: colorState.color_index
                });
            } catch (error) {
                console.warn('Supabase 색상 저장 실패, 로컬 백업 유지:', error);
            }
        }

        console.log(`🎨 색상 저장 완료: ${parcelId} -> ${colorState.color}`);
        return true;
    }

    /**
     * 마커 상태 평가 및 저장
     * @param {string} parcelId - 필지 ID
     * @param {Object} parcelData - 필지 데이터
     * @returns {boolean} 마커 표시 여부
     */
    evaluateAndSaveMarkerState(parcelId, parcelData) {
        const triggerFields = [];

        // 확장된 마커 생성 조건 평가
        if (parcelData.parcel_number || parcelData.parcelNumber) triggerFields.push('parcel_number');
        if (parcelData.owner_name || parcelData.ownerName) triggerFields.push('owner_name');
        if (parcelData.owner_address || parcelData.ownerAddress) triggerFields.push('owner_address');
        if (parcelData.contact) triggerFields.push('contact');
        if (parcelData.memo) triggerFields.push('memo');

        const shouldDisplay = triggerFields.length > 0;

        const markerState = {
            parcel_id: parcelId,
            should_display: shouldDisplay,
            trigger_fields: triggerFields,
            last_evaluated: new Date().toISOString()
        };

        // 메모리 및 LocalStorage 저장
        this.markerStates.set(parcelId, markerState);
        this.saveMarkerStatesToLocalStorage();

        // UI 업데이트 이벤트 발생
        this.triggerMarkerUpdate(parcelId, markerState);

        return shouldDisplay;
    }

    /**
     * 색상 상태 조회
     * @param {string} parcelId - 필지 ID
     * @returns {Object|null} 색상 상태
     */
    getColorState(parcelId) {
        return this.colorStates.get(parcelId) || null;
    }

    /**
     * 모든 색상 상태 조회
     * @returns {Map} 모든 색상 상태
     */
    getAllColorStates() {
        return this.colorStates;
    }

    /**
     * 마커 상태 조회
     * @param {string} parcelId - 필지 ID
     * @returns {Object|null} 마커 상태
     */
    getMarkerState(parcelId) {
        return this.markerStates.get(parcelId) || null;
    }

    /**
     * 마커 상태 저장
     * @param {string} parcelId - 필지 ID (PNU)
     * @param {boolean} shouldDisplay - 마커 표시 여부
     */
    saveMarkerState(parcelId, shouldDisplay) {
        if (!parcelId) return;

        const markerState = {
            parcel_id: parcelId,
            should_display: shouldDisplay,
            updated_at: new Date().toISOString()
        };

        this.markerStates.set(parcelId, markerState);
        this.saveMarkerStatesToLocalStorage();
        console.log(`📍 마커 상태 저장: ${parcelId} -> ${shouldDisplay ? '표시' : '숨김'}`);
    }

    /**
     * 색상 상태 LocalStorage 저장
     */
    saveColorStatesToLocalStorage() {
        try {
            const colorData = Object.fromEntries(this.colorStates);
            localStorage.setItem(this.STORAGE_KEYS.COLORS, JSON.stringify(colorData));
        } catch (error) {
            console.error('색상 상태 LocalStorage 저장 실패:', error);
        }
    }

    /**
     * 마커 상태 LocalStorage 저장
     */
    saveMarkerStatesToLocalStorage() {
        try {
            const markerData = Object.fromEntries(this.markerStates);
            localStorage.setItem(this.STORAGE_KEYS.MARKERS, JSON.stringify(markerData));
        } catch (error) {
            console.error('마커 상태 LocalStorage 저장 실패:', error);
        }
    }

    /**
     * 색상 상태 LocalStorage에서 로드
     */
    loadColorStatesFromLocalStorage() {
        try {
            const colorData = localStorage.getItem(this.STORAGE_KEYS.COLORS);
            if (colorData) {
                const parsed = JSON.parse(colorData);
                this.colorStates = new Map(Object.entries(parsed));
                console.log(`🎨 ${this.colorStates.size}개 색상 상태 로드됨`);
            }
        } catch (error) {
            console.error('색상 상태 로드 실패:', error);
        }
    }

    /**
     * 마커 상태 LocalStorage에서 로드
     */
    loadMarkerStatesFromLocalStorage() {
        try {
            const markerData = localStorage.getItem(this.STORAGE_KEYS.MARKERS);
            if (markerData) {
                const parsed = JSON.parse(markerData);
                this.markerStates = new Map(Object.entries(parsed));
                console.log(`📍 ${this.markerStates.size}개 마커 상태 로드됨`);
            }
        } catch (error) {
            console.error('마커 상태 로드 실패:', error);
        }
    }

    /**
     * 색상 업데이트 이벤트 발생
     */
    triggerColorUpdate(parcelId, colorState) {
        const event = new CustomEvent('parcelColorUpdate', {
            detail: { parcelId, colorState }
        });
        window.dispatchEvent(event);
    }

    /**
     * 마커 업데이트 이벤트 발생
     */
    triggerMarkerUpdate(parcelId, markerState) {
        const event = new CustomEvent('parcelMarkerUpdate', {
            detail: { parcelId, markerState }
        });
        window.dispatchEvent(event);
    }

    /**
     * 세션 ID 조회
     * @returns {string} 세션 ID
     */
    getSessionId() {
        let sessionId = localStorage.getItem('user_session');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('user_session', sessionId);
        }
        return sessionId;
    }

    /**
     * 색상 및 마커 상태 초기화
     */
    initializeColorAndMarkerStates() {
        this.loadColorStatesFromLocalStorage();
        this.loadMarkerStatesFromLocalStorage();
        console.log('🎨📍 색상 및 마커 상태 초기화 완료');
    }

    /**
     * 배치 색상 업데이트
     * @param {Array} updates - 업데이트 배열
     */
    async batchUpdateColors(updates) {
        console.log(`🎨 ${updates.length}개 색상 배치 업데이트 시작`);
        for (const update of updates) {
            await this.saveColorState(update.parcelId, update.colorData);
        }
        console.log('✅ 배치 색상 업데이트 완료');
    }

    /**
     * 색상 제거
     * @param {string} parcelId - 필지 ID
     */
    async removeColorState(parcelId) {
        this.colorStates.delete(parcelId);
        this.saveColorStatesToLocalStorage();
        this.triggerColorUpdate(parcelId, null);

        if (window.SupabaseManager && window.SupabaseManager.isConnected) {
            try {
                await window.SupabaseManager.updateParcelColor(parcelId, {
                    selectedColor: null,
                    is_colored: false,
                    color_index: 0
                });
            } catch (error) {
                console.warn('Supabase 색상 제거 실패:', error);
            }
        }
    }

    /**
     * 🗺️ 폴리곤 데이터 저장 (Supabase + IndexedDB)
     * @param {string} pnu - 필지 고유번호
     * @param {Object} geometry - 폴리곤 좌표 데이터
     * @param {Object} properties - 필지 속성 정보
     */
    async savePolygonData(pnu, geometry, properties) {
        console.log('🗺️ 폴리곤 저장 시작:', pnu);

        try {
            // 1. IndexedDB에 저장 (로컬 캐시)
            if (this.db) {
                const tx = this.db.transaction('polygons', 'readwrite');
                const store = tx.objectStore('polygons');
                await store.put({
                    pnu: pnu,
                    geometry: geometry,
                    properties: properties,
                    savedAt: new Date().toISOString()
                });
                await tx.complete;
                console.log('💾 IndexedDB 폴리곤 저장 완료');
            }

            // 2. Supabase에 저장 (실시간 공유)
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                const result = await window.SupabaseManager.savePolygonData(pnu, geometry, properties);
                if (result) {
                    console.log('☁️ Supabase 폴리곤 저장 완료');
                    return true;
                }
            }

            return true;
        } catch (error) {
            console.error('❌ 폴리곤 저장 실패:', error);
            return false;
        }
    }

    /**
     * 🗺️ 폴리곤 데이터 조회
     * @param {string} pnu - 필지 고유번호
     * @returns {Object|null} 폴리곤 데이터
     */
    async getPolygonData(pnu) {
        try {
            // 1. IndexedDB에서 먼저 조회 (빠른 접근)
            if (this.db) {
                const tx = this.db.transaction('polygons', 'readonly');
                const store = tx.objectStore('polygons');
                const data = await store.get(pnu);
                if (data) {
                    console.log('💾 IndexedDB에서 폴리곤 찾음:', pnu);
                    return data;
                }
            }

            // 2. Supabase에서 조회
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                const data = await window.SupabaseManager.getPolygonData(pnu);
                if (data) {
                    console.log('☁️ Supabase에서 폴리곤 찾음:', pnu);
                    // IndexedDB에 캐싱
                    if (this.db) {
                        const tx = this.db.transaction('polygons', 'readwrite');
                        const store = tx.objectStore('polygons');
                        await store.put(data);
                    }
                    return data;
                }
            }

            return null;
        } catch (error) {
            console.error('❌ 폴리곤 조회 실패:', error);
            return null;
        }
    }

    /**
     * 🗺️ 모든 폴리곤 데이터 로드
     * @returns {Array} 폴리곤 데이터 배열
     */
    async loadAllPolygons() {
        console.log('🗺️ 모든 폴리곤 로드 시작');

        try {
            // Supabase에서 모든 폴리곤 로드
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                const polygons = await window.SupabaseManager.loadAllPolygons();

                // IndexedDB에 캐싱
                if (this.db && polygons.length > 0) {
                    const tx = this.db.transaction('polygons', 'readwrite');
                    const store = tx.objectStore('polygons');
                    for (const polygon of polygons) {
                        await store.put(polygon);
                    }
                    await tx.complete;
                    console.log(`💾 ${polygons.length}개 폴리곤 IndexedDB 캐싱 완료`);
                }

                return polygons;
            }

            // Supabase 연결 안 됨 - IndexedDB에서 로드
            if (this.db) {
                const tx = this.db.transaction('polygons', 'readonly');
                const store = tx.objectStore('polygons');
                const polygons = await store.getAll();
                console.log(`💾 IndexedDB에서 ${polygons.length}개 폴리곤 로드`);
                return polygons;
            }

            return [];
        } catch (error) {
            console.error('❌ 폴리곤 로드 실패:', error);
            return [];
        }
    }
}

// 전역 인스턴스 생성
if (!window.dataPersistenceManager) {
    window.dataPersistenceManager = new DataPersistenceManager();
    console.log('🛡️ DataPersistenceManager 전역 인스턴스 생성 완료');
}
