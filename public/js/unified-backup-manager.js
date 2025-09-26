/**
 * 통합 백업 매니저
 * - 팀 협업: Supabase를 메인 DB로 사용
 * - 로컬 캐싱: LocalStorage는 오프라인/속도용
 * - 수동 백업: Excel 다운로드
 */

class UnifiedBackupManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.pendingSync = [];
        this.lastBackupCheck = null;

        console.log('💾 UnifiedBackupManager 초기화');
        this.initialize();
    }

    async initialize() {
        this.setupNetworkMonitoring();
        this.setupAutoSave();
        await this.syncPendingChanges();
    }

    /**
     * ========================================
     * 1. 실시간 저장 (팀 협업용 - Supabase 메인)
     * ========================================
     */

    async saveToCloud(data, options = {}) {
        const {
            skipCache = false,
            showNotification = true
        } = options;

        try {
            // 데이터 정제
            const sanitizedData = window.sanitizeObject ? window.sanitizeObject(data) : data;

            // 🔍 필지 검증: 유효한 필지만 백업
            let filteredData = sanitizedData;
            if (Array.isArray(sanitizedData) && window.ParcelValidationUtils) {
                filteredData = window.ParcelValidationUtils.filterValidParcels(sanitizedData);
                const filtered = sanitizedData.length - filteredData.length;
                if (filtered > 0) {
                    console.log(`🔍 [백업] ${filtered}개의 빈 필지 필터링됨`);
                }
            }

            if (Array.isArray(filteredData) && filteredData.length === 0) {
                console.warn('⚠️ [백업] 저장할 유효한 필지가 없습니다');
                return { success: false, reason: 'no_valid_parcels' };
            }

            // 1. Supabase에 즉시 저장 (메인 DB)
            if (!window.SupabaseManager || !window.SupabaseManager.isConnected) {
                throw new Error('Supabase 연결 안됨');
            }

            const result = await window.SupabaseManager.saveParcels(filteredData);

            if (!result) {
                throw new Error('Supabase 저장 실패');
            }

            // 2. LocalStorage에 캐싱 (빠른 로딩용)
            if (!skipCache) {
                this.saveToCache(filteredData);
            }

            console.log(`☁️ 클라우드 저장 완료: ${Array.isArray(filteredData) ? filteredData.length : 1}개`);

            if (showNotification) {
                this.showNotification('✅ 저장 완료', 'success');
            }

            return { success: true };

        } catch (error) {
            console.error('❌ 클라우드 저장 실패:', error);

            // 오프라인이거나 연결 실패 시: 대기열에 추가
            if (!this.isOnline || error.message.includes('연결')) {
                this.addToPendingSync(data);
                this.saveToCache(data);
                this.showNotification('⚠️ 오프라인 - 나중에 동기화됩니다', 'warning');
                return { success: false, queued: true };
            }

            this.showNotification('❌ 저장 실패', 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * ========================================
     * 2. 로컬 캐시 (오프라인/빠른 로딩)
     * ========================================
     */

    saveToCache(data) {
        try {
            // 🔍 필지 검증: 유효한 필지만 캐시
            let filteredData = data;
            if (Array.isArray(data) && window.ParcelValidationUtils) {
                filteredData = window.ParcelValidationUtils.filterValidParcels(data);
                const filtered = data.length - filteredData.length;
                if (filtered > 0) {
                    console.log(`🔍 [캐시] ${filtered}개의 빈 필지 필터링됨`);
                }
            }

            const cacheData = {
                data: filteredData,
                timestamp: Date.now(),
                version: Date.now()
            };

            localStorage.setItem('parcelData', JSON.stringify(filteredData));
            localStorage.setItem('parcelDataCache', JSON.stringify(cacheData));

            console.log('💾 로컬 캐시 저장 완료');
            return true;

        } catch (error) {
            console.error('❌ 로컬 캐시 저장 실패:', error);

            if (error.name === 'QuotaExceededError') {
                this.cleanupOldCache();
                try {
                    // 필터링된 데이터 사용 (이미 필터링 완료)
                    const filteredData = Array.isArray(data) && window.ParcelValidationUtils
                        ? window.ParcelValidationUtils.filterValidParcels(data)
                        : data;
                    localStorage.setItem('parcelData', JSON.stringify(filteredData));
                    return true;
                } catch (retryError) {
                    console.error('❌ 재시도 실패:', retryError);
                }
            }

            return false;
        }
    }

    loadFromCache() {
        try {
            const data = localStorage.getItem('parcelData');
            if (!data) return null;

            const parsed = JSON.parse(data);
            console.log(`💾 로컬 캐시에서 로드: ${parsed.length}개`);
            return parsed;

        } catch (error) {
            console.error('❌ 로컬 캐시 로드 실패:', error);
            return null;
        }
    }

    async loadFromCloud() {
        try {
            if (!window.SupabaseManager || !window.SupabaseManager.isConnected) {
                throw new Error('Supabase 연결 안됨');
            }

            const rawData = await window.SupabaseManager.loadParcels();

            // 🔍 필지 검증: 유효한 필지만 로드
            const data = window.ParcelValidationUtils
                ? window.ParcelValidationUtils.filterValidParcels(rawData)
                : rawData;

            const filtered = rawData.length - data.length;
            if (filtered > 0) {
                console.log(`🔍 [클라우드 로드] ${filtered}개의 빈 필지 필터링됨`);
            }

            console.log(`☁️ 클라우드에서 로드: ${data.length}개 (유효한 필지만)`);

            this.saveToCache(data);
            return data;

        } catch (error) {
            console.error('❌ 클라우드 로드 실패:', error);

            const cached = this.loadFromCache();
            if (cached) {
                console.log('⚠️ 캐시된 데이터 사용');
                // 캐시된 데이터도 필터링
                return window.ParcelValidationUtils
                    ? window.ParcelValidationUtils.filterValidParcels(cached)
                    : cached;
            }

            throw error;
        }
    }

    cleanupOldCache() {
        console.log('🧹 캐시 정리 중...');

        const keysToClean = [
            'emergency_backup',
            'backup_before_restore',
            'daily_backup_local'
        ];

        keysToClean.forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn(`캐시 삭제 실패: ${key}`);
            }
        });
    }

    /**
     * ========================================
     * 3. Excel 다운로드 (수동 백업)
     * ========================================
     */

    async downloadExcel() {
        try {
            console.log('📥 Excel 다운로드 시작...');

            const rawData = await this.loadFromCloud();

            // 🔍 필지 검증: 유효한 필지만 다운로드
            const data = window.ParcelValidationUtils
                ? window.ParcelValidationUtils.filterValidParcels(rawData)
                : rawData;

            const filtered = rawData.length - data.length;
            if (filtered > 0) {
                console.log(`🔍 [Excel 다운로드] ${filtered}개의 빈 필지 필터링됨`);
            }

            if (!data || data.length === 0) {
                alert('내보낼 유효한 데이터가 없습니다.');
                return;
            }

            if (!window.XLSX) {
                console.error('SheetJS 라이브러리가 로드되지 않았습니다.');
                alert('Excel 라이브러리를 로드하는 중입니다. 잠시 후 다시 시도해주세요.');

                await this.loadSheetJSLibrary();
                return this.downloadExcel();
            }

            const excelData = this.convertToExcelFormat(data);
            const ws = window.XLSX.utils.json_to_sheet(excelData);

            const colWidths = [
                { wch: 20 },
                { wch: 15 },
                { wch: 30 },
                { wch: 15 },
                { wch: 40 },
                { wch: 12 },
                { wch: 12 },
                { wch: 12 },
                { wch: 20 }
            ];
            ws['!cols'] = colWidths;

            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, '필지정보');

            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `필지관리_백업_${dateStr}.xlsx`;

            window.XLSX.writeFile(wb, fileName);

            console.log(`✅ Excel 다운로드 완료: ${fileName}`);
            this.showNotification(`✅ ${fileName} 다운로드 완료`, 'success');

        } catch (error) {
            console.error('❌ Excel 다운로드 실패:', error);
            alert(`Excel 다운로드 실패: ${error.message}`);
        }
    }

    convertToExcelFormat(data) {
        return data.map((item, index) => ({
            '번호': index + 1,
            '지번': item.parcelNumber || item.parcel_name || '',
            '소유자명': item.ownerName || item.owner_name || '',
            '소유자주소': item.ownerAddress || item.owner_address || '',
            '연락처': item.ownerContact || item.owner_contact || '',
            '메모': (item.memo || '').replace(/\n/g, ' '),
            '색상': this.getColorName(item.color || item.colorIndex),
            '위도': item.lat || '',
            '경도': item.lng || '',
            '생성일시': item.created_at || item.timestamp || ''
        }));
    }

    getColorName(colorValue) {
        const colorMap = {
            0: '빨강', 1: '주황', 2: '노랑', 3: '연두',
            4: '파랑', 5: '검정', 6: '흰색', 7: '하늘색',
            '#FF0000': '빨강', '#FFA500': '주황', '#FFFF00': '노랑',
            '#90EE90': '연두', '#0000FF': '파랑', '#000000': '검정',
            '#FFFFFF': '흰색', '#87CEEB': '하늘색'
        };

        return colorMap[colorValue] || '없음';
    }

    async loadSheetJSLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
            script.onload = () => {
                console.log('✅ SheetJS 라이브러리 로드 완료');
                resolve();
            };
            script.onerror = () => reject(new Error('SheetJS 로드 실패'));
            document.head.appendChild(script);
        });
    }

    /**
     * ========================================
     * 4. 백업 복원
     * ========================================
     */

    async restore(backupSource = 'cloud') {
        if (!confirm('⚠️ 현재 데이터가 백업 데이터로 교체됩니다.\n계속하시겠습니까?')) {
            return;
        }

        try {
            console.log(`📥 백업 복원 시작: ${backupSource}`);

            const currentData = await this.loadFromCloud();
            if (currentData && currentData.length > 0) {
                const emergencyBackup = {
                    timestamp: new Date().toISOString(),
                    data: currentData
                };
                localStorage.setItem('backup_before_restore', JSON.stringify(emergencyBackup));
                console.log('💾 복원 전 현재 데이터 백업 완료');
            }

            let restoredData = null;

            switch (backupSource) {
                case 'cloud':
                    restoredData = await this.restoreFromCloud();
                    break;
                case 'cache':
                    restoredData = this.loadFromCache();
                    break;
                case 'emergency':
                    restoredData = this.restoreFromEmergency();
                    break;
                default:
                    throw new Error('알 수 없는 백업 소스');
            }

            if (!restoredData || restoredData.length === 0) {
                throw new Error('복원할 데이터가 없습니다');
            }

            await this.saveToCloud(restoredData, { skipCache: false });

            alert(`✅ 백업 복원 완료\n${restoredData.length}개의 필지가 복원되었습니다.`);

            if (confirm('페이지를 새로고침하시겠습니까?')) {
                window.location.reload();
            }

        } catch (error) {
            console.error('❌ 백업 복원 실패:', error);

            const rollbackData = localStorage.getItem('backup_before_restore');
            if (rollbackData && confirm('복원 실패. 이전 데이터로 롤백하시겠습니까?')) {
                const parsed = JSON.parse(rollbackData);
                await this.saveToCloud(parsed.data);
                alert('이전 데이터로 롤백되었습니다.');
            } else {
                alert(`백업 복원 실패: ${error.message}`);
            }
        }
    }

    async restoreFromCloud() {
        const data = await window.SupabaseManager.loadParcels();
        console.log(`☁️ 클라우드에서 ${data.length}개 복원`);
        return data;
    }

    restoreFromEmergency() {
        const backup = localStorage.getItem('emergency_backup');
        if (!backup) throw new Error('긴급 백업이 없습니다');

        const parsed = JSON.parse(backup);
        console.log(`⚡ 긴급 백업에서 ${parsed.data.length}개 복원`);
        return parsed.data;
    }

    /**
     * ========================================
     * 5. 오프라인 동기화
     * ========================================
     */

    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            console.log('🌐 온라인 복구');
            this.isOnline = true;
            this.syncPendingChanges();
        });

        window.addEventListener('offline', () => {
            console.log('📴 오프라인 전환');
            this.isOnline = false;
        });
    }

    addToPendingSync(data) {
        this.pendingSync.push({
            data: data,
            timestamp: Date.now()
        });

        localStorage.setItem('pendingSync', JSON.stringify(this.pendingSync));
        console.log(`📋 동기화 대기열에 추가: ${this.pendingSync.length}개`);
    }

    async syncPendingChanges() {
        if (!this.isOnline || this.pendingSync.length === 0) {
            return;
        }

        console.log(`🔄 대기 중인 변경사항 동기화 시작: ${this.pendingSync.length}개`);

        const toSync = [...this.pendingSync];
        this.pendingSync = [];

        for (const item of toSync) {
            try {
                await this.saveToCloud(item.data, { showNotification: false });
            } catch (error) {
                console.error('동기화 실패:', error);
                this.pendingSync.push(item);
            }
        }

        if (this.pendingSync.length > 0) {
            localStorage.setItem('pendingSync', JSON.stringify(this.pendingSync));
            console.log(`⚠️ ${this.pendingSync.length}개 항목 동기화 실패 - 나중에 재시도`);
        } else {
            localStorage.removeItem('pendingSync');
            console.log('✅ 모든 변경사항 동기화 완료');
            this.showNotification('✅ 오프라인 변경사항 동기화 완료', 'success');
        }
    }

    setupAutoSave() {
        window.addEventListener('beforeunload', () => {
            if (window.parcelsData && window.parcelsData.length > 0) {
                const emergency = {
                    timestamp: new Date().toISOString(),
                    data: window.parcelsData
                };
                localStorage.setItem('emergency_backup', JSON.stringify(emergency));
                console.log('⚡ 긴급 백업 완료');
            }
        });
    }

    /**
     * ========================================
     * 6. 백업 상태 조회
     * ========================================
     */

    getStatus() {
        const cacheData = localStorage.getItem('parcelDataCache');
        const pendingSync = localStorage.getItem('pendingSync');

        let cacheInfo = null;
        if (cacheData) {
            try {
                const parsed = JSON.parse(cacheData);
                cacheInfo = {
                    timestamp: parsed.timestamp,
                    count: parsed.data?.length || 0,
                    age: Date.now() - parsed.timestamp
                };
            } catch (e) {
                cacheInfo = null;
            }
        }

        return {
            isOnline: this.isOnline,
            supabaseConnected: window.SupabaseManager?.isConnected || false,
            cache: cacheInfo,
            pendingSyncCount: pendingSync ? JSON.parse(pendingSync).length : 0
        };
    }

    /**
     * ========================================
     * 7. 유틸리티
     * ========================================
     */

    showNotification(message, type = 'info') {
        try {
            const existing = document.getElementById('backupNotification');
            if (existing) existing.remove();

            const notification = document.createElement('div');
            notification.id = 'backupNotification';
            notification.textContent = message;

            const colors = {
                success: '#4CAF50',
                error: '#f44336',
                warning: '#FF9800',
                info: '#2196F3'
            };

            notification.style.cssText = `
                position: fixed;
                top: 1rem;
                right: 1rem;
                z-index: 10001;
                padding: 0.75rem 1rem;
                border-radius: 6px;
                background: ${colors[type] || colors.info};
                color: white;
                font-size: 0.875rem;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                opacity: 0;
                transition: opacity 0.3s;
            `;

            document.body.appendChild(notification);

            setTimeout(() => notification.style.opacity = '1', 100);

            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }, 3000);

        } catch (error) {
            console.warn('알림 표시 실패:', error);
        }
    }
}

window.UnifiedBackupManager = new UnifiedBackupManager();

window.downloadExcel = () => window.UnifiedBackupManager.downloadExcel();
window.restoreBackup = (source) => window.UnifiedBackupManager.restore(source);
window.getBackupStatus = () => window.UnifiedBackupManager.getStatus();

console.log('💾 UnifiedBackupManager 로드 완료');