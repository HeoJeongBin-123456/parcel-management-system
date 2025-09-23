// 필지 복원 헬퍼 - 새로고침 시 데이터 보존을 위한 추가 로직

class ParcelRestoreHelper {
    constructor() {
        this.isRestoring = false;
        this.restoreAttempts = 0;
        this.maxRestoreAttempts = 3;
        this.restoredCount = 0;
    }

    async ensureDataPersistence() {
        // 자동 복원 비활성화 - 사용자가 명시적으로 저장한 것만 유지
        console.log('🔒 자동 복원 시스템 비활성화');
        return;

        // // 1. 페이지 언로드 전 데이터 저장 보장
        // this.setupBeforeUnloadHandler();

        // // 2. 페이지 로드 후 데이터 복원 보장
        // this.setupPageLoadRestorer();

        // // 3. 주기적 데이터 검증 및 복원
        // this.startPeriodicValidation();
    }

    setupBeforeUnloadHandler() {
        // 자동 저장 비활성화
        return;

        // window.addEventListener('beforeunload', () => {
        //     console.log('💾 페이지 종료 전 필지 데이터 저장');
        //     this.saveAllParcelData();
        // });

        // // 페이지 숨김 시에도 저장 (모바일 대응)
        // document.addEventListener('visibilitychange', () => {
        //     if (document.visibilityState === 'hidden') {
        //         console.log('👁️ 페이지 숨김 시 필지 데이터 저장');
        //         this.saveAllParcelData();
        //     }
        // });
    }

    setupPageLoadRestorer() {
        // DOM 준비 후 복원
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.attemptDataRestore(), 2000);
            });
        } else {
            setTimeout(() => this.attemptDataRestore(), 1000);
        }

        // 윈도우 로드 후 추가 복원 시도
        window.addEventListener('load', () => {
            setTimeout(() => this.attemptDataRestore(), 3000);
        });
    }

    async attemptDataRestore() {
        if (this.isRestoring || this.restoreAttempts >= this.maxRestoreAttempts) {
            return;
        }

        this.isRestoring = true;
        this.restoreAttempts++;

        console.log(`🔄 필지 데이터 복원 시도 ${this.restoreAttempts}/${this.maxRestoreAttempts}`);

        try {
            // 지도와 필요한 함수들이 로드될 때까지 대기
            await this.waitForMapAndFunctions();
            
            // 저장된 데이터 복원
            const restoredCount = await this.restoreStoredParcels();
            
            if (restoredCount > 0) {
                this.restoredCount = restoredCount;
                console.log(`✅ ${restoredCount}개 필지 복원 완료`);
                
                // UI 업데이트
                this.updateUIAfterRestore();
            } else {
                console.log('📭 복원할 필지 데이터가 없습니다');
            }

        } catch (error) {
            console.error(`❌ 필지 복원 시도 ${this.restoreAttempts} 실패:`, error);
            
            // 마지막 시도가 아니면 재시도
            if (this.restoreAttempts < this.maxRestoreAttempts) {
                setTimeout(() => {
                    this.isRestoring = false;
                    this.attemptDataRestore();
                }, 2000);
            }
        } finally {
            this.isRestoring = false;
        }
    }

    async waitForMapAndFunctions() {
        const maxWait = 15000; // 15초 대기
        const checkInterval = 500;
        let waited = 0;

        return new Promise((resolve, reject) => {
            const checkReady = () => {
                if (window.map && 
                    window.naver && 
                    window.drawParcelPolygon && 
                    window.CONFIG) {
                    resolve();
                } else if (waited >= maxWait) {
                    reject(new Error('지도 및 필수 함수 로딩 타임아웃'));
                } else {
                    waited += checkInterval;
                    setTimeout(checkReady, checkInterval);
                }
            };
            checkReady();
        });
    }

    async restoreStoredParcels() {
        const STORAGE_KEY = window.CONFIG?.STORAGE_KEY || 'parcelData';
        const savedData = localStorage.getItem(STORAGE_KEY);
        
        if (!savedData) {
            return 0;
        }

        try {
            const parcels = JSON.parse(savedData);
            if (!parcels || parcels.length === 0) {
                return 0;
            }

            console.log(`📊 ${parcels.length}개 필지 복원 시작`);
            let restoredCount = 0;

            for (const parcel of parcels) {
                try {
                    if (await this.restoreIndividualParcel(parcel)) {
                        restoredCount++;
                    }
                } catch (error) {
                    console.error('개별 필지 복원 실패:', parcel.parcelNumber, error);
                }
            }

            return restoredCount;

        } catch (error) {
            console.error('필지 데이터 파싱 실패:', error);
            return 0;
        }
    }

    async restoreIndividualParcel(parcelData) {
        if (!parcelData.geometry?.coordinates) {
            return false;
        }

        try {
            // 필지 폴리곤 생성
            const feature = {
                geometry: parcelData.geometry,
                properties: {
                    PNU: parcelData.pnu,
                    pnu: parcelData.pnu,
                    jibun: parcelData.parcelNumber,
                    JIBUN: parcelData.parcelNumber
                }
            };

            await window.drawParcelPolygon(feature, false);

            // 색상 적용
            if (parcelData.color && parcelData.color !== 'transparent') {
                setTimeout(() => {
                    this.applyParcelColor(parcelData);
                }, 100);
            }

            return true;

        } catch (error) {
            console.error('개별 필지 복원 실패:', error);
            return false;
        }
    }

    applyParcelColor(parcelData) {
        const targetMap = parcelData.isSearchParcel ? window.searchParcels : window.clickParcels;
        
        if (!targetMap) {
            return;
        }

        const parcel = targetMap.get(parcelData.pnu);

        if (parcel && parcel.polygon) {
            if (parcelData.isSearchParcel) {
                // 검색 필지는 보라색 고정
                parcel.polygon.setOptions({
                    fillColor: '#9370DB',
                    fillOpacity: 0.7,
                    strokeColor: '#6A0DAD',
                    strokeWeight: 3
                });
                parcel.color = '#9370DB';
                console.log(`🔍 검색 필지 보라색 고정: ${parcelData.parcelNumber}`);
            } else {
                parcel.polygon.setOptions({
                    fillColor: parcelData.color,
                    fillOpacity: 0.5,
                    strokeColor: parcelData.color,
                    strokeWeight: 2
                });
                parcel.color = parcelData.color;
                console.log(`🎨 필지 색상 적용: ${parcelData.parcelNumber} → ${parcelData.color}`);
            }
        }
    }

    saveAllParcelData() {
        try {
            const STORAGE_KEY = window.CONFIG?.STORAGE_KEY || 'parcelData';
            const currentData = localStorage.getItem(STORAGE_KEY);
            
            if (currentData) {
                // 백업 저장 (혹시 모를 데이터 손실 방지)
                localStorage.setItem(STORAGE_KEY + '_backup', currentData);
                localStorage.setItem(STORAGE_KEY + '_backup_time', Date.now().toString());
                console.log('💾 필지 데이터 백업 저장 완료');
            }

            // 현재 화면의 필지 정보도 저장 (추가 안전장치)
            if (window.parcelsData && window.parcelsData.length > 0) {
                localStorage.setItem('parcels_current_session', JSON.stringify(window.parcelsData));
            }

        } catch (error) {
            console.error('❌ 필지 데이터 저장 실패:', error);
        }
    }

    updateUIAfterRestore() {
        // ParcelManager 새로고침
        if (window.parcelManager && typeof window.parcelManager.loadParcels === 'function') {
            window.parcelManager.loadParcels();
        }

        // 사용자에게 알림 (선택적)
        if (this.restoredCount > 0) {
            console.log(`📊 복원 완료: ${this.restoredCount}개 필지가 지도에 복원되었습니다`);
        }
    }

    startPeriodicValidation() {
        // 30초마다 필지 데이터 유효성 검증
        setInterval(() => {
            this.validateAndMaintainData();
        }, 30000);
    }

    validateAndMaintainData() {
        // 데이터 일관성 검증 및 유지 로직
        const STORAGE_KEY = window.CONFIG?.STORAGE_KEY || 'parcelData';
        const savedData = localStorage.getItem(STORAGE_KEY);
        
        if (savedData && window.parcelsData) {
            try {
                const stored = JSON.parse(savedData);
                if (stored.length !== window.parcelsData.length) {
                    console.warn('⚠️ 필지 데이터 불일치 감지, 동기화 필요');
                    // 필요시 동기화 로직 추가
                }
            } catch (error) {
                console.error('데이터 검증 실패:', error);
            }
        }
    }
}

// 전역 인스턴스 생성 및 초기화
if (!window.parcelRestoreHelper) {
    window.parcelRestoreHelper = new ParcelRestoreHelper();
    window.parcelRestoreHelper.ensureDataPersistence();
    console.log('🛡️ ParcelRestoreHelper 초기화 완료');
}
