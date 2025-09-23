/**
 * ModeManager - 클릭, 검색, 손 모드 관리
 * 3개의 독립된 지도 인스턴스 간 전환 및 상태 관리를 담당
 */
class ModeManager {
    constructor() {
        this.currentMode = 'click'; // 'click' | 'search' | 'hand'
        this.previousMode = null;
        this.mapsInitialized = false;
        this.modeData = {
            click: {
                parcels: new Map(),
                colors: new Map(),
                markers: new Map(),
                lastAction: null,
                stats: {
                    totalParcels: 0,
                    coloredParcels: 0,
                    markersCount: 0
                }
            },
            search: {
                query: '',
                results: [],
                parcels: new Map(),
                searchTime: null,
                isActive: false
            },
            hand: {
                isLocked: false,
                previousMode: null
            }
        };

        this.eventHandlers = new Map();
        this.modeChangeCallbacks = [];
    }

    /**
     * 현재 모드 가져오기
     */
    getCurrentMode() {
        return this.currentMode;
    }

    /**
     * 모드 전환
     * @param {string} newMode - 'click' | 'search' | 'hand'
     * @param {boolean} saveCurrentState - 현재 상태 저장 여부
     */
    async switchMode(newMode, saveCurrentState = true) {
        if (!['click', 'search', 'hand'].includes(newMode)) {
            console.error(`[ModeManager] Invalid mode: ${newMode}`);
            return false;
        }

        if (newMode === this.currentMode) {
            console.log(`[ModeManager] Already in ${newMode} mode`);
            return true;
        }

        // 검색 모드에서 다른 모드로 전환 시 검색 결과를 숨김 (삭제 X)
        if (this.currentMode === 'search' && newMode !== 'search' && window.SearchModeManager) {
            const searchActive = typeof window.SearchModeManager.isActive === 'function'
                ? window.SearchModeManager.isActive()
                : !!window.SearchModeManager.isSearchActive;

            if (searchActive) {
                // 검색 결과를 숨기기만 함 (삭제하지 않음)
                window.SearchModeManager.setVisible(false);
                console.log('[ModeManager] 검색 결과를 숨김 (데이터는 유지)');
            }
        }

        // 검색 모드로 다시 전환 시 이전 검색 결과를 다시 표시
        if (newMode === 'search' && this.currentMode !== 'search' && window.SearchModeManager) {
            const searchActive = typeof window.SearchModeManager.isActive === 'function'
                ? window.SearchModeManager.isActive()
                : !!window.SearchModeManager.isSearchActive;

            if (searchActive) {
                // 숨겨진 검색 결과를 다시 표시
                window.SearchModeManager.setVisible(true);
                console.log('[ModeManager] 이전 검색 결과 복원');
            }
        }

        console.log(`🔄 모드 전환: ${this.currentMode} → ${newMode}`);

        // 지도 인스턴스 초기화 확인
        if (!this.mapsInitialized) {
            console.log('🏗️ 지도 인스턴스 초기화 중...');
            await this.initializeMaps();
        }

        // 현재 모드 데이터 저장
        if (saveCurrentState) {
            await this.saveCurrentModeData();
        }

        // 지도 위치 동기화
        await this.syncMapPositions(this.currentMode, newMode);

        // 이전 모드 기록
        this.previousMode = this.currentMode;

        // 모드 전환
        this.currentMode = newMode;
        window.currentMode = newMode; // 전역 변수 업데이트
        document.body.className = `mode-${newMode}`;

        // 지도 표시/숨김
        this.switchMapDisplay(newMode);

        // window.map 업데이트 (MemoMarkerManager 지원)
        if (window.updateWindowMapForMode) {
            window.updateWindowMapForMode(newMode);
            console.log(`🔄 window.map을 ${newMode} 모드 지도로 업데이트`);
        }

        // 새 모드 데이터 로드
        await this.loadModeData(newMode);

        // 모드별 이벤트 핸들러 설정
        this.setupModeEventHandlers(newMode);

        // UI 업데이트
        this.updateUI(newMode);

        // 로컬 스토리지에 현재 모드 저장 (snake/camel 동시 유지)
        localStorage.setItem('currentMode', newMode);
        localStorage.setItem('current_mode', newMode);

        // 콜백 실행
        this.notifyModeChange(newMode, this.previousMode);

        return true;
    }

    /**
     * 현재 모드 데이터 저장
     */
    async saveCurrentModeData() {
        const mode = this.currentMode;
        const data = this.collectModeData(mode);

        // LocalStorage에 저장
        localStorage.setItem(`${mode}ModeData`, JSON.stringify(data));

        console.log(`[ModeManager] Saved ${mode} mode data`);
    }

    /**
     * 모드 데이터 수집
     */
    collectModeData(mode) {
        const data = this.modeData[mode];

        if (mode === 'click' || mode === 'search') {
            // Map을 Object로 변환
            return {
                ...data,
                parcels: Array.from(data.parcels.entries()),
                colors: mode === 'click' ? Array.from(data.colors.entries()) : undefined,
                markers: mode === 'click' ? Array.from(data.markers.entries()) : undefined
            };
        }

        return data;
    }

    /**
     * 모드 데이터 로드
     */
    async loadModeData(mode) {
        const savedData = localStorage.getItem(`${mode}ModeData`);

        if (savedData) {
            try {
                const data = JSON.parse(savedData);

                if (mode === 'click' || mode === 'search') {
                    // Object를 Map으로 변환
                    if (data.parcels) {
                        this.modeData[mode].parcels = new Map(data.parcels);
                    }
                    if (mode === 'click' && data.colors) {
                        this.modeData[mode].colors = new Map(data.colors);
                    }
                    if (mode === 'click' && data.markers) {
                        this.modeData[mode].markers = new Map(data.markers);
                    }

                    // 나머지 데이터 복원
                    Object.keys(data).forEach(key => {
                        if (key !== 'parcels' && key !== 'colors' && key !== 'markers') {
                            this.modeData[mode][key] = data[key];
                        }
                    });
                }

                console.log(`[ModeManager] Loaded ${mode} mode data`);
            } catch (error) {
                console.error(`[ModeManager] Error loading ${mode} mode data:`, error);
            }
        }
    }

    /**
     * 이벤트 리스너 등록
     */
    addEventListeners(mode) {
        const handlers = this.eventHandlers.get(mode);
        if (handlers) {
            handlers.forEach(({element, event, handler}) => {
                element.addEventListener(event, handler);
            });
        }
    }

    /**
     * 이벤트 리스너 제거
     */
    removeEventListeners(mode) {
        const handlers = this.eventHandlers.get(mode);
        if (handlers) {
            handlers.forEach(({element, event, handler}) => {
                element.removeEventListener(event, handler);
            });
        }
    }

    /**
     * 모드별 이벤트 핸들러 등록
     */
    registerEventHandler(mode, element, event, handler) {
        if (!this.eventHandlers.has(mode)) {
            this.eventHandlers.set(mode, []);
        }

        this.eventHandlers.get(mode).push({element, event, handler});
    }

    /**
     * 🗺️ 지도 인스턴스 초기화
     */
    async initializeMaps() {
        if (this.mapsInitialized) return;

        try {
            console.log('🏗️ 지도 인스턴스 초기화 시작');
            await window.initAllMapInstances();
            this.mapsInitialized = true;
            console.log('✅ 지도 인스턴스 초기화 완료');
        } catch (error) {
            console.error('❌ 지도 인스턴스 초기화 실패:', error);
            throw error;
        }
    }

    /**
     * 📍 지도 위치 동기화
     */
    async syncMapPositions(fromMode, toMode) {
        const fromMap = window.getMapByMode(fromMode);
        const toMap = window.getMapByMode(toMode);

        if (fromMap && toMap && window.syncMapPosition) {
            window.syncMapPosition(fromMap, toMap);
        }
    }

    /**
     * 🎯 지도 표시/숨김 전환
     */
    switchMapDisplay(activeMode) {
        const mapContainers = {
            'click': document.getElementById('map-click'),
            'search': document.getElementById('map-search'),
            'hand': document.getElementById('map-hand')
        };

        // 모든 지도 숨김
        Object.values(mapContainers).forEach(container => {
            if (container) {
                container.style.display = 'none';
                container.classList.remove('active');
            }
        });

        // 활성 모드 지도만 표시
        const activeContainer = mapContainers[activeMode];
        if (activeContainer) {
            activeContainer.style.display = 'block';
            activeContainer.classList.add('active');
        }

        if (window.restoreMapViewForMode) {
            const activeMap = window.getMapByMode ? window.getMapByMode(activeMode) : null;
            if (activeMap) {
                window.restoreMapViewForMode(activeMode, activeMap);
            }
        }

        console.log(`🎯 지도 전환: ${activeMode} 모드 활성화`);
    }

    /**
     * 🔧 모드별 이벤트 핸들러 설정
     */
    setupModeEventHandlers(mode) {
        try {
            switch(mode) {
                case 'click':
                    if (window.setupClickModeEventListeners) {
                        window.setupClickModeEventListeners();
                        console.log('🎯 클릭 모드 이벤트 핸들러 설정 완료');
                    }
                    break;
                case 'search':
                    if (window.setupSearchModeEventListeners) {
                        window.setupSearchModeEventListeners();
                        console.log('🔍 검색 모드 이벤트 핸들러 설정 완료');
                    }
                    break;
                case 'hand':
                    // 손 모드는 별도 이벤트 핸들러가 필요 없음 (순수 탐색용)
                    this.setupHandModeEventListeners();
                    console.log('✋ 손 모드: 탐색 전용 모드로 설정 완료');
                    break;
            }
        } catch (error) {
            console.error(`❌ ${mode} 모드 이벤트 핸들러 설정 실패:`, error);
        }
    }

    /**
     * ✋ 손 모드 이벤트 핸들러 설정 (색칠 기능 비활성화)
     */
    setupHandModeEventListeners() {
        if (!window.mapHand) {
            console.warn('⚠️ 손 모드 지도 인스턴스가 없음');
            return;
        }

        // 기존 이벤트 제거
        naver.maps.Event.clearListeners(window.mapHand, 'click');
        naver.maps.Event.clearListeners(window.mapHand, 'rightclick');

        // 손 모드에서는 클릭 시 색칠 대신 필지 정보만 표시
        naver.maps.Event.addListener(window.mapHand, 'click', function(e) {
            const coord = e.coord;
            console.log('✋ 손 모드 클릭: 필지 정보 조회만 수행 (색칠 비활성화)');

            // 색칠 없이 필지 정보만 조회
            if (window.getParcelInfoForHandMode) {
                window.getParcelInfoForHandMode(coord.lat(), coord.lng());
            } else {
                console.log('✋ 손 모드: 필지 정보 입력 기능 사용 가능');
                // 기본 필지 정보 조회 (색칠 없이)
                if (window.getParcelInfoViaProxy) {
                    window.getParcelInfoViaProxy(coord.lat(), coord.lng(), { coloringDisabled: true });
                }
            }
        });

        // 오른쪽 클릭도 비활성화
        naver.maps.Event.addListener(window.mapHand, 'rightclick', function(e) {
            e.originalEvent?.preventDefault();
            console.log('✋ 손 모드: 색상 삭제 기능 비활성화됨');
        });

        // 컨텍스트 메뉴 방지
        if (window.mapHand.getElement()) {
            window.mapHand.getElement().addEventListener('contextmenu', function(e) {
                e.preventDefault();
                return false;
            });
        }

        console.log('✋ 손 모드 이벤트 핸들러 설정 완료 - 색칠 기능 비활성화됨');
    }

    /**
     * UI 업데이트
     */
    updateUI(mode) {
        // 모드별 UI 표시/숨김
        const clickElements = document.querySelectorAll('.click-only');
        const searchElements = document.querySelectorAll('.search-only');
        const handElements = document.querySelectorAll('.hand-only');

        // 모든 요소 숨김
        [...clickElements, ...searchElements, ...handElements].forEach(el => {
            el.style.display = 'none';
        });

        // 현재 모드 요소만 표시
        switch(mode) {
            case 'click':
                clickElements.forEach(el => {
                    el.style.display = '';
                    el.style.removeProperty('display');
                });
                break;
            case 'search':
                searchElements.forEach(el => {
                    // 인라인 스타일 완전히 제거하여 CSS가 적용되도록 함
                    el.style.removeProperty('display');
                    // 검색 결과 컨테이너는 명시적으로 block 설정
                    if (el.classList.contains('search-results-container')) {
                        el.style.display = 'block';
                    }
                });
                break;
            case 'hand':
                handElements.forEach(el => {
                    el.style.display = '';
                    el.style.removeProperty('display');
                });
                break;
        }

        // 모드 버튼 활성화 상태 업데이트
        document.querySelectorAll('.mode-button, .mode-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            }
        });

        // 모드별 지도 커서 설정
        this.updateMapCursors(mode);

        // 색상 패널 표시 상태 업데이트
        this.updateColorPanel(mode);
    }

    /**
     * 🖱️ 모드별 지도 커서 업데이트
     */
    updateMapCursors(mode) {
        const mapContainers = {
            'click': document.getElementById('map-click'),
            'search': document.getElementById('map-search'),
            'hand': document.getElementById('map-hand')
        };

        Object.entries(mapContainers).forEach(([mapMode, container]) => {
            if (container) {
                // 모든 지도에서 커서 스타일 초기화
                container.style.cursor = '';

                // 활성 모드에만 커서 적용
                if (mapMode === mode) {
                    switch(mode) {
                        case 'click':
                            container.style.cursor = 'crosshair';
                            break;
                        case 'search':
                            container.style.cursor = 'pointer';
                            break;
                        case 'hand':
                            container.style.cursor = 'grab';
                            break;
                    }
                }
            }
        });
    }

    /**
     * 🎨 색상 패널 표시 상태 업데이트
     */
    updateColorPanel(mode) {
        const colorContent = document.getElementById('colorPanelContent');
        const colorPlaceholder = document.getElementById('colorPanelPlaceholder');

        if (!colorContent && !colorPlaceholder) {
            return;
        }

        if (mode === 'click') {
            if (colorContent) {
                colorContent.style.removeProperty('display');
                colorContent.style.removeProperty('opacity');
                colorContent.style.removeProperty('pointer-events');
            }
            if (colorPlaceholder) {
                colorPlaceholder.style.display = 'none';
                colorPlaceholder.style.removeProperty('opacity');
                colorPlaceholder.style.removeProperty('pointer-events');
            }
        } else {
            if (colorContent) {
                colorContent.style.display = 'none';
                colorContent.style.opacity = '0.35';
                colorContent.style.pointerEvents = 'none';
            }
            if (colorPlaceholder) {
                colorPlaceholder.style.display = 'flex';
                colorPlaceholder.style.opacity = '1';
                colorPlaceholder.style.pointerEvents = 'auto';
            }
        }
    }

    /**
     * 모드 변경 콜백 등록
     */
    onModeChange(callback) {
        this.modeChangeCallbacks.push(callback);
    }

    /**
     * 모드 변경 알림
     */
    notifyModeChange(newMode, previousMode) {
        this.modeChangeCallbacks.forEach(callback => {
            try {
                callback(newMode, previousMode);
            } catch (error) {
                console.error('[ModeManager] Error in mode change callback:', error);
            }
        });
    }

    /**
     * 모드 데이터 가져오기
     */
    getModeData(mode) {
        return this.modeData[mode];
    }

    /**
     * 모드 데이터 업데이트
     */
    updateModeData(mode, updates) {
        if (this.modeData[mode]) {
            Object.assign(this.modeData[mode], updates);
        }
    }

    /**
     * 통계 업데이트
     */
    updateStats(mode) {
        if (mode === 'click') {
            const data = this.modeData.click;
            data.stats.totalParcels = data.parcels.size;
            data.stats.coloredParcels = data.colors.size;
            data.stats.markersCount = data.markers.size;
        }
    }

    /**
     * 모드 버튼 이벤트 리스너 설정
     */
    setupModeButtons() {
        document.querySelectorAll('.mode-btn, .mode-button').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const mode = btn.dataset.mode;
                if (mode) {
                    await this.switchMode(mode);
                }
            });
        });
    }

    /**
     * 초기화
     */
    async initialize() {
        console.log('🚀 ModeManager 초기화 시작...');

        try {
            // 저장된 모드 복원
            const savedMode = localStorage.getItem('currentMode') || 'click';
            console.log(`📋 저장된 모드: ${savedMode}`);

            // 지도 인스턴스 초기화
            await this.initializeMaps();

            // 모드 데이터 로드
            await this.loadModeData(savedMode);

            // 초기 모드 설정
            this.currentMode = savedMode;
            window.currentMode = savedMode;
            document.body.className = `mode-${savedMode}`;

            // 지도 표시/숨김
            this.switchMapDisplay(savedMode);

            // window.map 초기 설정 (MemoMarkerManager 지원)
            if (window.updateWindowMapForMode) {
                window.updateWindowMapForMode(savedMode);
                console.log(`🔄 초기화: window.map을 ${savedMode} 모드 지도로 설정`);
            }

            // 모드별 이벤트 핸들러 설정
            this.setupModeEventHandlers(savedMode);

            // UI 초기화
            this.updateUI(savedMode);

            // 모드 버튼 이벤트 리스너 설정
            this.setupModeButtons();

            console.log(`✅ ModeManager 초기화 완료: ${savedMode} 모드`);

        } catch (error) {
            console.error('❌ ModeManager 초기화 실패:', error);
            throw error;
        }
    }
}

// 전역 인스턴스 생성
window.ModeManager = new ModeManager();
