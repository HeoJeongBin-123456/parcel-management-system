/**
 * ModeManager - 클릭, 검색, 손 모드 관리
 * 모드 간 전환 및 상태 관리를 담당
 */
class ModeManager {
    constructor() {
        this.currentMode = 'click'; // 'click' | 'search' | 'hand'
        this.previousMode = null;
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
            console.error(`Invalid mode: ${newMode}`);
            return false;
        }

        if (newMode === this.currentMode) {
            console.log(`Already in ${newMode} mode`);
            return true;
        }

        console.log(`[ModeManager] Switching from ${this.currentMode} to ${newMode}`);

        // 현재 모드 데이터 저장
        if (saveCurrentState) {
            await this.saveCurrentModeData();
        }

        // 이전 모드 기록
        this.previousMode = this.currentMode;

        // 이벤트 핸들러 전환
        this.removeEventListeners(this.currentMode);

        // 모드 전환
        this.currentMode = newMode;
        document.body.className = `mode-${newMode}`;

        // 새 모드 데이터 로드
        await this.loadModeData(newMode);

        // 새 모드 이벤트 핸들러 등록
        this.addEventListeners(newMode);

        // UI 업데이트
        this.updateUI(newMode);

        // 로컬 스토리지에 현재 모드 저장
        localStorage.setItem('currentMode', newMode);

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
                clickElements.forEach(el => el.style.display = '');
                break;
            case 'search':
                searchElements.forEach(el => el.style.display = '');
                break;
            case 'hand':
                handElements.forEach(el => el.style.display = '');
                break;
        }

        // 모드 버튼 활성화 상태 업데이트
        document.querySelectorAll('.mode-button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            }
        });

        // 지도 커서 스타일 업데이트
        const mapElement = document.getElementById('map');
        if (mapElement) {
            switch(mode) {
                case 'click':
                    mapElement.style.cursor = 'crosshair';
                    break;
                case 'search':
                    mapElement.style.cursor = 'pointer';
                    break;
                case 'hand':
                    mapElement.style.cursor = 'grab';
                    break;
                default:
                    mapElement.style.cursor = 'default';
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
     * 초기화
     */
    async initialize() {
        // 저장된 모드 복원
        const savedMode = localStorage.getItem('currentMode') || 'click';

        // 모드 데이터 로드
        await this.loadModeData(savedMode);

        // UI 초기화
        this.currentMode = savedMode;
        document.body.className = `mode-${savedMode}`;
        this.updateUI(savedMode);

        console.log(`[ModeManager] Initialized in ${savedMode} mode`);
    }
}

// 전역 인스턴스 생성
window.ModeManager = new ModeManager();