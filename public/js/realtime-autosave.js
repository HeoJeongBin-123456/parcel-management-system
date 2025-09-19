// 실시간 자동저장 및 데이터 검증 시스템
class RealtimeAutoSave {
    constructor() {
        this.isInitialized = false;
        this.saveQueue = new Set();
        this.lastSaveTime = Date.now();
        this.saveInterval = 5000; // 5초마다 자동저장
        this.debounceDelay = 1000; // 1초 디바운스
        this.maxRetries = 3;
        this.saveInProgress = false;
        this.dataValidator = new DataValidator();
        this.isSuspended = false;
        this.suspendReason = null;

        // 통계
        this.stats = {
            totalSaves: 0,
            successfulSaves: 0,
            failedSaves: 0,
            lastSuccessTime: null,
            lastFailTime: null
        };
        
        console.log('💾 RealtimeAutoSave 초기화');
        this.initialize();
    }

    // 시스템 초기화
    initialize() {
        try {
            // DOM 로드 대기
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.setupAutoSave();
                });
            } else {
                this.setupAutoSave();
            }
            
        } catch (error) {
            console.error('❌ RealtimeAutoSave 초기화 실패:', error);
        }
    }

    // 자동저장 시스템 설정
    setupAutoSave() {
        try {
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            // 주기적 자동저장 설정
            this.setupPeriodicSave();
            
            // 페이지 언로드 처리
            this.setupUnloadHandler();
            
            // 네트워크 상태 모니터링
            this.setupNetworkMonitoring();
            
            this.isInitialized = true;
            console.log('✅ 실시간 자동저장 시스템 활성화');
            
        } catch (error) {
            console.error('❌ 자동저장 설정 실패:', error);
        }
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 필지 관련 이벤트들
        document.addEventListener('click', (event) => {
            this.handleUserInteraction(event, 'click');
        });

        // 폼 입력 이벤트들
        const formElements = ['input', 'textarea', 'select'];
        formElements.forEach(selector => {
            document.addEventListener('change', (event) => {
                if (event.target.matches(selector)) {
                    this.handleFormChange(event);
                }
            }, true);

            document.addEventListener('input', (event) => {
                if (event.target.matches(selector)) {
                    this.handleFormInput(event);
                }
            }, true);
        });

        // 색상 선택 이벤트
        document.addEventListener('click', (event) => {
            if (event.target.matches('.color-item')) {
                this.handleColorChange(event);
            }
        });

        // 지도 클릭 이벤트 (전역 이벤트 후킹)
        this.hookMapEvents();
        
        console.log('🎣 자동저장 이벤트 리스너 설정 완료');
    }

    // 지도 이벤트 후킹
    hookMapEvents() {
        // 기존 지도 클릭 핸들러 후킹
        const originalMapClickHandler = window.handleMapClick;
        if (originalMapClickHandler) {
            window.handleMapClick = (...args) => {
                const result = originalMapClickHandler.apply(this, args);
                this.triggerAutoSave('map_click');
                return result;
            };
        }

        // 필지 저장 함수 후킹
        const originalSaveParcel = window.saveParcel;
        if (originalSaveParcel) {
            window.saveParcel = (...args) => {
                const result = originalSaveParcel.apply(this, args);
                this.triggerAutoSave('parcel_save');
                return result;
            };
        }

        console.log('🗺️ 지도 이벤트 후킹 완료');
    }

    // 사용자 상호작용 처리
    handleUserInteraction(event, type) {
        const interactionElements = [
            '#saveParcelInfoBtn',
            '#deleteParcelInfoBtn',
            '.color-item',
            '.map-type-btn',
            '#searchBtn'
        ];

        if (interactionElements.some(selector => event.target.matches(selector))) {
            this.triggerAutoSave(`user_${type}`);
        }
    }

    // 폼 변경 처리
    handleFormChange(event) {
        if (this.isParcelFormElement(event.target)) {
            this.triggerAutoSave('form_change');
        }
    }

    // 폼 입력 처리 (디바운스)
    handleFormInput(event) {
        if (this.isParcelFormElement(event.target)) {
            // 디바운스 적용
            clearTimeout(this.inputTimeout);
            this.inputTimeout = setTimeout(() => {
                this.triggerAutoSave('form_input');
            }, this.debounceDelay);
        }
    }

    // 색상 변경 처리
    handleColorChange(event) {
        this.triggerAutoSave('color_change');
    }

    // 필지 폼 요소 확인
    isParcelFormElement(element) {
        const parcelFormIds = [
            'parcelNumber', 
            'ownerName', 
            'ownerAddress', 
            'ownerContact', 
            'memo'
        ];
        
        return parcelFormIds.includes(element.id) || 
               element.closest('#parcelForm');
    }

    // 자동저장 트리거
    triggerAutoSave(reason) {
        if (this.isSuspended) {
            console.log(`⏸️ 자동저장 일시정지 상태 - 트리거(${reason}) 무시`);
            return;
        }

        this.saveQueue.add(reason);
        
        // 즉시 저장이 필요한 경우들
        const immediateSaveReasons = ['parcel_save', 'user_click', 'color_change'];
        
        if (immediateSaveReasons.includes(reason)) {
            this.performAutoSave(reason);
        } else {
            // 디바운스 적용
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                this.performAutoSave(reason);
            }, this.debounceDelay);
        }
    }

    // 자동저장 실행
    async performAutoSave(reason) {
        if (this.isSuspended) {
            console.log('⏸️ 자동저장 일시정지 상태 - 저장 실행 취소');
            this.saveQueue.clear();
            return;
        }

        if (this.saveInProgress) {
            console.log('⏳ 이미 저장 중이므로 대기');
            return;
        }

        this.saveInProgress = true;
        this.stats.totalSaves++;

        try {
            console.log(`💾 자동저장 시작 (이유: ${reason})`);
            
            // 1. 현재 데이터 수집 및 검증
            const currentData = await this.collectCurrentData();
            if (this.isSuspended) {
                console.log('⏸️ 자동저장 일시정지 상태 - 데이터 저장 단계 취소');
                this.saveQueue.clear();
                this.saveInProgress = false;
                return;
            }
            const validationResult = await this.dataValidator.validateData(currentData);
            
            if (!validationResult.isValid) {
                console.warn('⚠️ 데이터 유효성 검사 실패:', validationResult.errors);
                
                // 심각한 오류가 아니면 저장 계속 진행
                if (!validationResult.isCritical) {
                    console.log('⚠️ 경고 무시하고 저장 계속 진행');
                } else {
                    throw new Error('Critical validation failed: ' + validationResult.errors.join(', '));
                }
            }

            // 2. 다층 저장 시스템으로 저장
            await this.saveToMultipleLayers(currentData, reason);
            
            // 3. 통계 업데이트
            this.stats.successfulSaves++;
            this.stats.lastSuccessTime = new Date();
            this.lastSaveTime = Date.now();
            
            // 4. 저장 대기열 정리
            this.saveQueue.clear();
            
            console.log(`✅ 자동저장 완료 (${currentData.length}개 항목)`);
            
            // 5. UI 상태 업데이트
            this.updateSaveIndicator('success');
            
        } catch (error) {
            console.error('❌ 자동저장 실패:', error);
            
            this.stats.failedSaves++;
            this.stats.lastFailTime = new Date();
            
            // 재시도 로직
            await this.handleSaveFailure(error, reason);
            
            this.updateSaveIndicator('error');
            
        } finally {
            this.saveInProgress = false;
        }
    }

    // 현재 데이터 수집
    async collectCurrentData() {
        if (this.isSuspended) {
            console.log('⏸️ 자동저장 일시정지 상태 - 데이터 수집 건너뜀');
            return [];
        }

        let data = [];

        try {
            // 1. localStorage에서 기존 데이터 먼저 불러오기 (클릭 모드 데이터 포함)
            const savedData = JSON.parse(localStorage.getItem('parcelData') || '[]');
            if (Array.isArray(savedData)) {
                data = [...savedData];
                console.log(`📦 localStorage에서 ${savedData.length}개 필지 로드`);
            }

            // 2. window.parcelsData가 있으면 병합 (중복 제거)
            if (window.parcelsData && Array.isArray(window.parcelsData)) {
                // PNU 기준으로 중복 제거하며 병합
                const existingPNUs = new Set(data.map(item => item.pnu || item.properties?.PNU || item.properties?.pnu));

                window.parcelsData.forEach(parcel => {
                    const pnu = parcel.pnu || parcel.properties?.PNU || parcel.properties?.pnu;
                    if (pnu && !existingPNUs.has(pnu)) {
                        data.push(parcel);
                        existingPNUs.add(pnu);
                    } else if (pnu && existingPNUs.has(pnu)) {
                        // 기존 데이터 업데이트 (최신 데이터로)
                        const index = data.findIndex(item =>
                            (item.pnu || item.properties?.PNU || item.properties?.pnu) === pnu
                        );
                        if (index >= 0) {
                            // updatedAt 비교하여 최신 데이터 유지
                            const existingTime = data[index].updatedAt || 0;
                            const newTime = parcel.updatedAt || 0;
                            if (newTime > existingTime) {
                                data[index] = parcel;
                            }
                        }
                    }
                });
            }

            // 3. 폼 데이터 추가/업데이트
            const formData = this.getCurrentFormData();
            if (formData) {
                data = this.mergeFormData(data, formData);
            }

            // 4. 지도 상태 정보 추가
            const mapState = this.getMapState();
            
            // 4. 메타데이터 추가
            data = data.map(item => ({
                ...item,
                lastModified: new Date().toISOString(),
                autoSaved: true
            }));
            
            console.log(`📊 데이터 수집 완료: ${data.length}개 항목`);
            return data;
            
        } catch (error) {
            console.error('❌ 데이터 수집 실패:', error);
            return [];
        }
    }

    // 폴리곤 중심점 계산 함수 (메모 마커용)
    calculatePolygonCenter(coordinates) {
        if (!coordinates || coordinates.length === 0) {
            return [0, 0];
        }
        
        let totalX = 0;
        let totalY = 0;
        let count = 0;
        
        for (const coord of coordinates) {
            if (coord && coord.length >= 2) {
                totalX += coord[0];
                totalY += coord[1];
                count++;
            }
        }
        
        if (count === 0) {
            return [0, 0];
        }
        
        return [totalX / count, totalY / count];
    }

    // 현재 폼 데이터 가져오기
    getCurrentFormData() {
        try {
            const parcelForm = document.getElementById('parcelForm');
            if (!parcelForm) return null;
            
            const formData = {
                parcelNumber: document.getElementById('parcelNumber')?.value || '',
                ownerName: document.getElementById('ownerName')?.value || '',
                ownerAddress: document.getElementById('ownerAddress')?.value || '',
                ownerContact: document.getElementById('ownerContact')?.value || '',
                memo: document.getElementById('memo')?.value || '',
                color: document.getElementById('currentColor')?.style.backgroundColor || '#FF0000',
                timestamp: new Date().toISOString()
            };
            
            // 🔧 현재 선택된 필지의 추가 정보 포함 (좌표, geometry, pnu)
            if (window.currentSelectedPNU) {
                formData.pnu = window.currentSelectedPNU;
                
                // 검색 모드일 때는 searchParcels에서 geometry 가져오기
                if (window.currentMode === 'search' && window.searchParcels) {
                    const parcelData = window.searchParcels.get(window.currentSelectedPNU);
                    if (parcelData && parcelData.data) {
                        formData.geometry = parcelData.data.geometry;
                        formData.isSearchParcel = true;
                    }
                }
                
                // 클릭 모드일 때는 clickParcels에서 geometry 가져오기
                if (!formData.geometry && window.clickParcels) {
                    const parcelData = window.clickParcels.get(window.currentSelectedPNU);
                    if (parcelData && parcelData.data) {
                        formData.geometry = parcelData.data.geometry;
                        formData.isSearchParcel = false;
                    }
                }
                
                // 📍 geometry에서 중심 좌표 추출 (메모 마커용)
                if (formData.geometry && formData.geometry.coordinates) {
                    let centerLat, centerLng;
                    
                    if (formData.geometry.type === 'Point') {
                        [centerLng, centerLat] = formData.geometry.coordinates;
                    } else if (formData.geometry.type === 'Polygon') {
                        const center = this.calculatePolygonCenter(formData.geometry.coordinates[0]);
                        [centerLng, centerLat] = center;
                    } else if (formData.geometry.type === 'MultiPolygon') {
                        const center = this.calculatePolygonCenter(formData.geometry.coordinates[0][0]);
                        [centerLng, centerLat] = center;
                    }
                    
                    if (centerLat && centerLng) {
                        formData.lat = parseFloat(centerLat);
                        formData.lng = parseFloat(centerLng);
                        console.log('📍 자동저장용 좌표 추출:', { lat: formData.lat, lng: formData.lng });
                    }
                }
            }
            
            // 빈 폼은 무시
            const hasData = Object.values(formData).some(value => 
                value && value.toString().trim() !== '' && value !== '#FF0000'
            );
            
            return hasData ? formData : null;
            
        } catch (error) {
            console.warn('⚠️ 폼 데이터 수집 실패:', error);
            return null;
        }
    }

    // 폼 데이터를 기존 데이터와 병합
    mergeFormData(existingData, formData) {
        if (!formData || !formData.parcelNumber) return existingData;
        
        // 동일한 지번이 있으면 업데이트, 없으면 추가
        const existingIndex = existingData.findIndex(item => 
            item.parcelNumber === formData.parcelNumber || 
            item.pnu === formData.parcelNumber
        );
        
        if (existingIndex >= 0) {
            existingData[existingIndex] = {
                ...existingData[existingIndex],
                ...formData,
                updated_at: new Date().toISOString()
            };
        } else if (formData.parcelNumber.trim()) {
            existingData.push({
                id: Date.now(),
                pnu: formData.parcelNumber,
                ...formData,
                created_at: new Date().toISOString()
            });
        }
        
        return existingData;
    }

    // 지도 상태 정보
    getMapState() {
        try {
            if (!window.map) return null;
            
            return {
                center: window.map.getCenter(),
                zoom: window.map.getZoom(),
                mapTypeId: window.map.getMapTypeId()
            };
        } catch (error) {
            return null;
        }
    }

    // 다층 저장 시스템으로 저장
    async saveToMultipleLayers(data, reason) {
        const saveResults = [];
        
        try {
            // 1. DataPersistenceManager 사용 (우선순위)
            if (window.dataPersistenceManager) {
                const result = await window.dataPersistenceManager.save(data, {
                    priority: 'high',
                    reason: reason,
                    autoSave: true
                });
                saveResults.push({ layer: 'persistence_manager', success: result.success });
            }
            
            // 2. migratedSetItem을 통한 통합 저장 (localStorage + Supabase)
            try {
                const STORAGE_KEY = window.CONFIG?.STORAGE_KEY || 'parcelData';
                if (window.migratedSetItem && typeof window.migratedSetItem === 'function') {
                    await window.migratedSetItem(STORAGE_KEY, JSON.stringify(data));
                    console.log('💾 migratedSetItem으로 저장 완료');
                    saveResults.push({ layer: 'migratedSetItem', success: true });
                } else {
                    // 폴백: 직접 localStorage에 저장
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                    console.log('💾 localStorage 직접 저장 (migratedSetItem 없음)');
                    saveResults.push({ layer: 'localStorage_direct', success: true });
                }
                localStorage.setItem('lastAutoSave', new Date().toISOString());
            } catch (error) {
                console.error('❌ 저장 오류:', error);
                saveResults.push({ layer: 'integrated_save', success: false, error: error.message });
            }
            
            // 3. sessionStorage 저장 (세션 백업)
            try {
                sessionStorage.setItem('parcelData_session', JSON.stringify(data));
                saveResults.push({ layer: 'sessionStorage', success: true });
            } catch (error) {
                saveResults.push({ layer: 'sessionStorage', success: false, error: error.message });
            }
            
            // 4. 전역 변수 업데이트
            window.parcelsData = data;
            saveResults.push({ layer: 'globalVariable', success: true });
            
            // 결과 평가
            const successCount = saveResults.filter(r => r.success).length;
            const totalCount = saveResults.length;
            
            console.log(`💾 다층 저장 결과: ${successCount}/${totalCount} 성공`);
            
            if (successCount === 0) {
                throw new Error('모든 저장 계층에서 실패');
            }
            
            return saveResults;
            
        } catch (error) {
            console.error('❌ 다층 저장 실패:', error);
            throw error;
        }
    }

    // 저장 실패 처리
    async handleSaveFailure(error, reason) {
        console.warn(`⚠️ 저장 실패 처리 시작 (이유: ${reason})`);
        
        // 재시도 로직
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                if (this.isSuspended) {
                    console.log('⏸️ 자동저장 일시정지 상태 - 저장 재시도 중단');
                    return;
                }

                console.log(`🔄 저장 재시도 ${attempt}/${this.maxRetries}`);
                
                await new Promise(resolve => setTimeout(resolve, attempt * 1000)); // 지수 백오프
                
                const currentData = await this.collectCurrentData();
                if (this.isSuspended) {
                    console.log('⏸️ 자동저장 일시정지 상태 - 재시도 데이터 저장 취소');
                    return;
                }
                await this.saveToMultipleLayers(currentData, `retry_${reason}`);
                
                console.log(`✅ 저장 재시도 ${attempt} 성공`);
                this.stats.successfulSaves++;
                return;
                
            } catch (retryError) {
                console.warn(`❌ 저장 재시도 ${attempt} 실패:`, retryError);
                
                if (attempt === this.maxRetries) {
                    // 최종 실패 시 긴급 저장
                    this.performEmergencyBackup(error);
                }
            }
        }
    }

    // 긴급 백업
    performEmergencyBackup(originalError) {
        try {
            const emergencyData = {
                timestamp: new Date().toISOString(),
                error: originalError.message,
                data: window.parcelsData || [],
                formData: this.getCurrentFormData(),
                mapState: this.getMapState()
            };
            
            localStorage.setItem('emergency_autosave_backup', JSON.stringify(emergencyData));
            console.log('🆘 긴급 백업 완료');
            
            // 사용자에게 알림 (선택적)
            this.notifyUser('⚠️ 자동저장에 실패하여 긴급 백업을 수행했습니다.', 'warning');
            
        } catch (backupError) {
            console.error('❌ 긴급 백업마저 실패:', backupError);
        }
    }

    // 주기적 자동저장 설정
    setupPeriodicSave() {
        setInterval(() => {
            if (this.isSuspended) {
                return;
            }

            // 마지막 저장 후 일정 시간이 지났고, 대기열에 작업이 있으면 저장
            const timeSinceLastSave = Date.now() - this.lastSaveTime;
            
            if (timeSinceLastSave >= this.saveInterval && this.saveQueue.size > 0) {
                this.performAutoSave('periodic');
            }
        }, this.saveInterval);
        
        console.log(`⏰ 주기적 자동저장 설정 (${this.saveInterval / 1000}초 간격)`);
    }

    // 페이지 언로드 처리
    setupUnloadHandler() {
        window.addEventListener('beforeunload', () => {
            console.log('💾 페이지 종료 전 긴급 백업');

            // 동기적 저장 (간단한 버전)
            try {
                // 1. 기존 localStorage 데이터 보존
                const existingData = JSON.parse(localStorage.getItem('parcelData') || '[]');
                const dataMap = new Map();

                // 기존 데이터를 Map에 추가 (PNU를 키로 사용)
                existingData.forEach(item => {
                    const pnu = item.pnu || item.properties?.PNU || item.properties?.pnu;
                    if (pnu) {
                        dataMap.set(pnu, item);
                    }
                });

                // 2. window.parcelsData가 있으면 업데이트 (덮어쓰지 않고 병합)
                if (window.parcelsData && Array.isArray(window.parcelsData)) {
                    window.parcelsData.forEach(parcel => {
                        const pnu = parcel.pnu || parcel.properties?.PNU || parcel.properties?.pnu;
                        if (pnu) {
                            // 기존 데이터가 있으면 updatedAt 비교
                            const existing = dataMap.get(pnu);
                            if (!existing || (parcel.updatedAt > (existing.updatedAt || 0))) {
                                dataMap.set(pnu, parcel);
                            }
                        }
                    });
                }

                // 3. Map을 배열로 변환하여 저장
                const finalData = Array.from(dataMap.values());
                localStorage.setItem('parcelData', JSON.stringify(finalData));
                localStorage.setItem('lastAutoSave', new Date().toISOString());

                console.log(`✅ 긴급 백업 완료: ${finalData.length}개 필지`);
            } catch (error) {
                console.error('❌ 최종 저장 실패:', error);
            }
        });
    }

    // 네트워크 상태 모니터링
    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            console.log('🌐 네트워크 연결됨 - 지연된 저장 시도');
            if (this.isSuspended) {
                console.log('⏸️ 자동저장 일시정지 상태 - 네트워크 복구 저장 보류');
                return;
            }
            if (this.saveQueue.size > 0) {
                this.performAutoSave('network_reconnect');
            }
        });

        window.addEventListener('offline', () => {
            console.log('📴 네트워크 연결 끊어짐 - 로컬 저장만 수행');
        });
    }

    // 저장 상태 표시기 업데이트
    updateSaveIndicator(status) {
        try {
            let indicator = document.getElementById('autoSaveIndicator');
            
            if (!indicator) {
                // 표시기 생성
                indicator = document.createElement('div');
                indicator.id = 'autoSaveIndicator';
                indicator.style.cssText = `
                    position: absolute;
                    top: -2.5rem;
                    left: 0;
                    right: 0;
                    z-index: 10000;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    font-size: 0.875rem;
                    color: white;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                    text-align: center;
                `;
                
                // 저장 버튼 찾기
                const saveBtn = document.getElementById('saveParcelInfoBtn');
                if (saveBtn) {
                    // 저장 버튼의 부모 요소에 relative position 설정
                    const parentElement = saveBtn.closest('.form-buttons') || saveBtn.parentElement;
                    if (parentElement) {
                        parentElement.style.position = 'relative';
                        parentElement.appendChild(indicator);
                    } else {
                        // 저장 버튼을 찾을 수 없으면 기본 위치
                        indicator.style.position = 'fixed';
                        indicator.style.top = '1rem';
                        indicator.style.left = '50%';
                        indicator.style.transform = 'translateX(-50%)';
                        document.body.appendChild(indicator);
                    }
                } else {
                    // 저장 버튼을 찾을 수 없으면 기본 위치
                    indicator.style.position = 'fixed';
                    indicator.style.top = '1rem';
                    indicator.style.left = '50%';
                    indicator.style.transform = 'translateX(-50%)';
                    document.body.appendChild(indicator);
                }
            }
            
            // 상태별 스타일링
            const styles = {
                success: { bg: '#4CAF50', text: '✅ 자동저장 완료' },
                error: { bg: '#f44336', text: '❌ 저장 실패' },
                saving: { bg: '#2196F3', text: '💾 저장 중...' }
            };
            
            const style = styles[status] || styles.saving;
            indicator.style.backgroundColor = style.bg;
            indicator.textContent = style.text;
            indicator.style.opacity = '1';
            
            // 3초 후 숨김
            setTimeout(() => {
                indicator.style.opacity = '0';
            }, 3000);
            
        } catch (error) {
            console.warn('⚠️ 저장 표시기 업데이트 실패:', error);
        }
    }

    // 사용자 알림
    notifyUser(message, type = 'info') {
        try {
            // 기존 toast 시스템이 있으면 사용
            if (window.showToast) {
                window.showToast(message, type);
            } else {
                // 간단한 알림
                console.log(`🔔 [${type.toUpperCase()}] ${message}`);
            }
        } catch (error) {
            console.warn('⚠️ 사용자 알림 실패:', error);
        }
    }

    // 통계 정보 가져오기
    getStats() {
        return {
            ...this.stats,
            isInitialized: this.isInitialized,
            saveInProgress: this.saveInProgress,
            queueSize: this.saveQueue.size,
            timeSinceLastSave: Date.now() - this.lastSaveTime
        };
    }

    // 수동 저장 트리거
    async forceSave(reason = 'manual') {
        console.log('🔧 수동 저장 트리거');
        await this.performAutoSave(reason);
    }

    // 자동저장 시스템 중단
    disable() {
        this.isInitialized = false;
        clearTimeout(this.saveTimeout);
        clearTimeout(this.inputTimeout);
        console.log('⏹️ 실시간 자동저장 시스템 중단');
    }
}

// 데이터 검증 클래스
class DataValidator {
    constructor() {
        this.requiredFields = ['parcelNumber'];
        this.maxFieldLengths = {
            parcelNumber: 50,
            ownerName: 100,
            ownerAddress: 200,
            ownerContact: 50,
            memo: 1000
        };
    }

    // 데이터 유효성 검사
    async validateData(data) {
        const errors = [];
        const warnings = [];
        let isCritical = false;

        try {
            // 기본 구조 검사
            if (!Array.isArray(data)) {
                errors.push('데이터가 배열 형태가 아닙니다');
                isCritical = true;
            } else {
                // 각 항목 검사
                data.forEach((item, index) => {
                    const itemErrors = this.validateItem(item, index);
                    errors.push(...itemErrors.errors);
                    warnings.push(...itemErrors.warnings);
                    
                    if (itemErrors.isCritical) {
                        isCritical = true;
                    }
                });
            }

            // 중복 검사
            const duplicateErrors = this.checkDuplicates(data);
            warnings.push(...duplicateErrors);

            // 전체 데이터 크기 검사
            const sizeCheck = this.checkDataSize(data);
            if (!sizeCheck.isValid) {
                warnings.push(sizeCheck.message);
            }

            return {
                isValid: errors.length === 0,
                isCritical,
                errors,
                warnings,
                itemCount: Array.isArray(data) ? data.length : 0
            };

        } catch (error) {
            console.error('❌ 데이터 검증 중 오류:', error);
            return {
                isValid: false,
                isCritical: true,
                errors: [`검증 오류: ${error.message}`],
                warnings: [],
                itemCount: 0
            };
        }
    }

    // 개별 항목 검증
    validateItem(item, index) {
        const errors = [];
        const warnings = [];
        let isCritical = false;

        if (!item || typeof item !== 'object') {
            errors.push(`항목 ${index}: 유효하지 않은 데이터 구조`);
            isCritical = true;
            return { errors, warnings, isCritical };
        }

        // 필수 필드 검사
        this.requiredFields.forEach(field => {
            if (!item[field] || item[field].toString().trim() === '') {
                warnings.push(`항목 ${index}: 필수 필드 '${field}' 누락`);
            }
        });

        // 필드 길이 검사
        Object.entries(this.maxFieldLengths).forEach(([field, maxLength]) => {
            if (item[field] && item[field].toString().length > maxLength) {
                warnings.push(`항목 ${index}: '${field}' 필드가 최대 길이(${maxLength})를 초과`);
            }
        });

        // 좌표 검증
        if (item.lat !== undefined || item.lng !== undefined) {
            const coordCheck = this.validateCoordinates(item.lat, item.lng);
            if (!coordCheck.isValid) {
                warnings.push(`항목 ${index}: ${coordCheck.message}`);
            }
        }

        // 색상 검증
        if (item.color && !this.isValidColor(item.color)) {
            warnings.push(`항목 ${index}: 유효하지 않은 색상값 '${item.color}'`);
        }

        return { errors, warnings, isCritical };
    }

    // 좌표 유효성 검사
    validateCoordinates(lat, lng) {
        if (lat === undefined || lng === undefined) {
            return { isValid: true }; // 좌표가 없는 것은 허용
        }

        const numLat = parseFloat(lat);
        const numLng = parseFloat(lng);

        if (isNaN(numLat) || isNaN(numLng)) {
            return { isValid: false, message: '유효하지 않은 좌표 형식' };
        }

        if (numLat < -90 || numLat > 90) {
            return { isValid: false, message: '위도가 범위(-90~90)를 벗어남' };
        }

        if (numLng < -180 || numLng > 180) {
            return { isValid: false, message: '경도가 범위(-180~180)를 벗어남' };
        }

        return { isValid: true };
    }

    // 색상 유효성 검사
    isValidColor(color) {
        const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        const rgbColorRegex = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
        
        return hexColorRegex.test(color) || rgbColorRegex.test(color);
    }

    // 중복 데이터 검사
    checkDuplicates(data) {
        if (!Array.isArray(data)) return [];

        const warnings = [];
        const seen = new Set();

        data.forEach((item, index) => {
            if (item.parcelNumber || item.pnu) {
                const key = item.parcelNumber || item.pnu;
                if (seen.has(key)) {
                    warnings.push(`중복된 지번 발견: '${key}' (항목 ${index})`);
                } else {
                    seen.add(key);
                }
            }
        });

        return warnings;
    }

    // 데이터 크기 검사
    checkDataSize(data) {
        try {
            const dataString = JSON.stringify(data);
            const sizeInBytes = new Blob([dataString]).size;
            const sizeInMB = sizeInBytes / (1024 * 1024);

            const MAX_SIZE_MB = 50; // 50MB 제한

            if (sizeInMB > MAX_SIZE_MB) {
                return {
                    isValid: false,
                    message: `데이터 크기(${sizeInMB.toFixed(2)}MB)가 제한(${MAX_SIZE_MB}MB)을 초과`
                };
            }

            return {
                isValid: true,
                size: sizeInMB
            };

        } catch (error) {
            return {
                isValid: false,
                message: `크기 검사 실패: ${error.message}`
            };
        }
    }

    async suspendAutoSave(reason = 'manual') {
        if (this.isSuspended) {
            return;
        }

        this.isSuspended = true;
        this.suspendReason = reason;
        this.saveQueue.clear();
        clearTimeout(this.saveTimeout);
        clearTimeout(this.inputTimeout);

        if (this.saveInProgress) {
            console.log(`⏸️ 자동저장 일시정지 대기 중 (${reason})`);
            await this.waitUntilIdle();
        }

        this.saveInProgress = false;
        console.log(`⏸️ 자동저장 일시정지 완료 (${reason})`);
    }

    async waitUntilIdle(timeout = 3000) {
        const start = Date.now();

        while (this.saveInProgress) {
            if (Date.now() - start > timeout) {
                console.warn('⚠️ 자동저장 일시정지 대기 타임아웃 도달');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    resumeAutoSave(triggerImmediate = false) {
        if (!this.isSuspended) {
            return;
        }

        const previousReason = this.suspendReason;
        this.isSuspended = false;
        this.suspendReason = null;
        console.log(`▶️ 자동저장 재개 (${previousReason || 'no reason'})`);

        if (triggerImmediate && this.saveQueue.size > 0) {
            this.performAutoSave('resume');
        }
    }
}

// 전역 인스턴스 생성
if (!window.realtimeAutoSave) {
    window.realtimeAutoSave = new RealtimeAutoSave();
    console.log('💾 RealtimeAutoSave 전역 인스턴스 생성 완료');
}
