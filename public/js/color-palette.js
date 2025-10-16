/**
 * ColorPaletteManager - 8가지 색상 팔레트 관리
 * 색상 선택, 적용, 통계 추적
 */
class ColorPaletteManager {
    constructor() {
        this.colors = [
            { index: 0, hex: '#FF0000', name: '빨강', isActive: false, usageCount: 0 },
            { index: 1, hex: '#FFA500', name: '주황', isActive: false, usageCount: 0 },
            { index: 2, hex: '#FFFF00', name: '노랑', isActive: false, usageCount: 0 },
            { index: 3, hex: '#90EE90', name: '연두', isActive: false, usageCount: 0 },
            { index: 4, hex: '#0000FF', name: '파랑', isActive: false, usageCount: 0 },
            { index: 5, hex: '#000000', name: '검정', isActive: false, usageCount: 0 },
            { index: 6, hex: '#FFFFFF', name: '흰색', isActive: false, usageCount: 0 },
            { index: 7, hex: '#87CEEB', name: '하늘색', isActive: false, usageCount: 0 }
        ];

        this.SEARCH_COLOR_INDEX = 8;
        this.searchModeColor = {
            index: this.SEARCH_COLOR_INDEX,
            hex: '#9B59B6',
            name: '검색',
            isActive: false,
            usageCount: 0
        };

        this.currentSelection = null;

        this.selectionCallbacks = [];

        this.colorHexToIndexMap = new Map();
        this.colors.forEach(color => {
            this.colorHexToIndexMap.set(color.hex, color.index);
        });
        this.colorHexToIndexMap.set(this.searchModeColor.hex, this.SEARCH_COLOR_INDEX);
        console.log('[ColorPalette] 🚀 색상 인덱스 Map 초기화 완료 (O(1) 조회)');
    }

    getColorMeta(index) {
        if (typeof index !== 'number') {
            return null;
        }
        if (index >= 0 && index < this.colors.length) {
            return this.colors[index];
        }
        if (index === this.SEARCH_COLOR_INDEX) {
            return this.searchModeColor;
        }
        return null;
    }

    /**
     * 색상 팔레트 UI 생성 - 기존 사이드바 UI 활용
     */
    createPaletteUI() {
        // 기존 사이드바의 색상 팔레트 활용
        const colorItems = document.querySelectorAll('.color-item');

        if (colorItems.length === 0) {
            console.warn('[ColorPalette] Color items not found in sidebar');
            return;
        }

        // 기존 색상 아이템들에 이벤트 리스너 추가
        colorItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                const alreadySelected = this.currentSelection === index;
                if (alreadySelected) {
                    this.deselectColor();
                    return;
                }

                this.selectColor(index);
            });

            // 사용 카운트 뱃지 제거 (숫자 표시 안함)
            let badge = item.querySelector('.usage-badge');
            if (badge) {
                badge.remove();
            }
        });

        console.log('[ColorPalette] Sidebar UI connected');
    }

    /**
     * 색상 선택
     */
    selectColor(index) {
        if (index == null || Number.isNaN(index)) {
            console.error('[ColorPalette] Invalid color index: null/NaN');
            return;
        }

        if (index === this.SEARCH_COLOR_INDEX) {
            console.warn('[ColorPalette] 검색 모드 색상은 팔레트에서 직접 선택할 수 없습니다.');
            return;
        }

        if (index < 0 || index >= this.colors.length) {
            console.error(`[ColorPalette] Invalid color index: ${index}`);
            return;
        }

        const colorMeta = this.getColorMeta(index);
        if (!colorMeta) {
            console.error(`[ColorPalette] Invalid color index: ${index}`);
            return;
        }

        if (this.currentSelection !== null) {
            const previous = this.getColorMeta(this.currentSelection);
            if (previous) {
                previous.isActive = false;
            }
        }

        this.currentSelection = index;
        colorMeta.isActive = true;

        window.currentColor = colorMeta.hex;

        this.updatePaletteUI();

        this.notifyColorSelection(index, colorMeta);

        console.log(`[ColorPalette] Color selected: ${colorMeta.name} (${index}) - ${colorMeta.hex}`);
    }

    /**
     * 색상 선택 해제
     */
    deselectColor() {
        if (this.currentSelection !== null) {
            const current = this.getColorMeta(this.currentSelection);
            if (current) {
                current.isActive = false;
            }
            this.currentSelection = null;
            this.updatePaletteUI();
            this.notifyColorSelection(null, null);
            window.currentColor = null;

            const currentColorDiv = document.getElementById('currentColor');
            if (currentColorDiv) {
                currentColorDiv.style.background = 'transparent';
            }
            console.log('[ColorPalette] Color deselected');
        }
    }

    /**
     * 현재 선택된 색상 가져오기
     */
    getCurrentColor() {
        if (this.currentSelection === null) {
            return null;
        }
        return this.getColorMeta(this.currentSelection);
    }

    /**
     * 색상 인덱스로 색상 정보 가져오기
     */
    getColorByIndex(index) {
        return this.getColorMeta(index);
    }

    /**
     * 색상 hex 값으로 인덱스 가져오기 (O(1) 최적화)
     */
    getIndexByHex(hexColor) {
        return this.colorHexToIndexMap.get(hexColor) ?? null;
    }

    /**
     * 색상 사용 통계 업데이트
     */
    updateUsageCount(index, delta) {
        const colorMeta = this.getColorMeta(index);
        if (!colorMeta) {
            return;
        }

        colorMeta.usageCount = Math.max(0, colorMeta.usageCount + delta);
        if (index >= 0 && index < this.colors.length) {
            this.updatePaletteUI();
        }
    }

    /**
     * 색상 사용 통계 초기화
     */
    resetUsageCounts() {
        this.colors.forEach(color => {
            color.usageCount = 0;
        });
        this.searchModeColor.usageCount = 0;
        this.updatePaletteUI();
    }

    /**
     * 팔레트 UI 업데이트
     */
    updatePaletteUI() {
        const colorItems = document.querySelectorAll('.color-item');
        colorItems.forEach((item, index) => {
            const color = this.getColorMeta(index);
            if (!color) return;

            // 선택 상태 업데이트
            if (this.currentSelection === index) {
                item.classList.add('active', 'selected');
            } else {
                item.classList.remove('active', 'selected');
            }

            // 툴팁 업데이트
            item.title = `${color.name} (${color.usageCount}개 사용중)`;

            // 사용 카운트 뱃지 제거 (숫자 표시 안함)
            let badge = item.querySelector('.usage-badge');
            if (badge) {
                badge.remove();
            }
        });

        // 색상 통계 표시 제거
        const statsElement = document.getElementById('colorStats');
        if (statsElement) {
            statsElement.textContent = '';
        }
    }

    /**
     * 색상 선택 콜백 등록
     */
    onColorSelection(callback) {
        this.selectionCallbacks.push(callback);
    }

    /**
     * 색상 선택 알림
     */
    notifyColorSelection(index, color) {
        this.selectionCallbacks.forEach(callback => {
            try {
                callback(index, color);
            } catch (error) {
                console.error('[ColorPalette] Error in selection callback:', error);
            }
        });
    }

    /**
     * 필지 색상 적용
     */
    applyColorToParcel(pnu, colorIndex) {
        if (typeof colorIndex !== 'number') {
            console.warn(`[ColorPalette] Invalid color index for applyColorToParcel: ${colorIndex}`);
            return false;
        }

        const color = this.getColorMeta(colorIndex);
        if (!color) {
            console.warn(`[ColorPalette] Invalid color index for applyColorToParcel: ${colorIndex}`);
            return false;
        }

        // 색상 사용 카운트 증가
        this.updateUsageCount(colorIndex, 1);

        const parcelColors = ParcelColorStorage.getAll();
        const previousColorIndex = parcelColors.get(pnu);

        // 이전 색상이 있었다면 카운트 감소
        if (typeof previousColorIndex === 'number' && previousColorIndex !== colorIndex) {
            this.updateUsageCount(previousColorIndex, -1);
        }

        parcelColors.set(pnu, colorIndex);
        ParcelColorStorage.setAll(parcelColors);

        console.log(`[ColorPalette] Applied color ${color.name} to parcel ${pnu}`);
        return true;
    }

    /**
     * 필지 색상 제거
     */
    removeColorFromParcel(pnu) {
        const parcelColors = ParcelColorStorage.getAll();
        const colorIndex = parcelColors.get(pnu);

        if (typeof colorIndex === 'number') {
            // 색상 사용 카운트 감소
            this.updateUsageCount(colorIndex, -1);

            // LocalStorage에서 제거
            parcelColors.delete(pnu);
            ParcelColorStorage.setAll(parcelColors);

            console.log(`[ColorPalette] Removed color from parcel ${pnu}`);
            return true;
        }

        return false;
    }

    /**
     * 필지의 현재 색상 가져오기
     */
    getParcelColor(pnu) {
        const colorIndex = ParcelColorStorage.getIndex(pnu);

        if (typeof colorIndex === 'number') {
            return this.getColorMeta(colorIndex);
        }

        return null;
    }

    /**
     * 모든 색상 정보 로드
     */
    loadColorData() {
        const parcelColors = ParcelColorStorage.getAll();

        // 사용 카운트 재계산
        this.resetUsageCounts();
        parcelColors.forEach(colorIndex => {
            const colorMeta = this.getColorMeta(colorIndex);
            if (colorMeta) {
                colorMeta.usageCount++;
            }
        });

        this.updatePaletteUI();
        console.log('[ColorPalette] Color data loaded');
    }

    /**
     * 색상별 필지 목록 가져오기
     */
    getParcelsByColor(colorIndex) {
        const parcels = [];

        ParcelColorStorage.getAll().forEach((index, pnu) => {
            if (index === colorIndex) {
                parcels.push(pnu);
            }
        });

        return parcels;
    }

    /**
     * 초기화
     */
    initialize() {
        // 색상 데이터 로드
        this.loadColorData();

        // UI 생성
        this.createPaletteUI();

        // 키보드 단축키 (1-8 숫자키로 색상 선택)
        document.addEventListener('keypress', (e) => {
            const key = e.key;
            if (key >= '1' && key <= '8') {
                const index = parseInt(key) - 1;
                if (this.currentSelection === index) {
                    this.deselectColor();
                } else {
                    this.selectColor(index);
                }
            } else if (key === '0' || key === 'Escape') {
                this.deselectColor();
            }
        });

        console.log('[ColorPalette] Initialized');
        window.dispatchEvent(new Event('color-palette-ready'));
    }
}

// 전역 인스턴스 생성
window.ColorPaletteManager = new ColorPaletteManager();
