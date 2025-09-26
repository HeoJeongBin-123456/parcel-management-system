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
            { index: 7, hex: '#87CEEB', name: '하늘색', isActive: false, usageCount: 0 },
            { index: 8, hex: '#9B59B6', name: '검색', isActive: false, usageCount: 0 }
        ];

        this.currentSelection = null;
        this.searchModeColor = {
            hex: '#9B59B6',
            name: '검색'
        };

        this.selectionCallbacks = [];

        this.colorHexToIndexMap = new Map();
        this.colors.forEach(color => {
            this.colorHexToIndexMap.set(color.hex, color.index);
        });
        console.log('[ColorPalette] 🚀 색상 인덱스 Map 초기화 완료 (O(1) 조회)');
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
        if (index < 0 || index >= this.colors.length) {
            console.error(`[ColorPalette] Invalid color index: ${index}`);
            return;
        }

        // 이전 선택 해제
        // 색상 존재 확인
        if (!this.colors[index]) {
            console.warn(`[ColorPalette] Invalid color index: ${index}`);
            return;
        }

        if (this.currentSelection !== null && this.colors[this.currentSelection]) {
            this.colors[this.currentSelection].isActive = false;
        }

        // 새 색상 선택
        this.currentSelection = index;
        this.colors[index].isActive = true;

        // window.currentColor 업데이트 (중요!)
        window.currentColor = this.colors[index].hex;

        // UI 업데이트
        this.updatePaletteUI();

        // 색상 변경 시 이전 색상 필지 제거 기능 비활성화 (버그 수정)
        // 사용자가 같은 색상으로 여러 필지를 칠할 수 있도록 허용

        // 콜백 실행
        const selectedColor = this.colors[index];
        if (!selectedColor) {
            console.warn(`[ColorPalette] Invalid color index: ${index}`);
            return;
        }

        this.notifyColorSelection(index, selectedColor);

        console.log(`[ColorPalette] Color selected: ${selectedColor.name} (${index}) - ${selectedColor.hex}`);
    }

    /**
     * 색상 선택 해제
     */
    deselectColor() {
        if (this.currentSelection !== null) {
            this.colors[this.currentSelection].isActive = false;
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
        return this.colors[this.currentSelection];
    }

    /**
     * 색상 인덱스로 색상 정보 가져오기
     */
    getColorByIndex(index) {
        if (index >= 0 && index < this.colors.length) {
            return this.colors[index];
        }
        return null;
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
        if (index >= 0 && index < this.colors.length) {
            this.colors[index].usageCount = Math.max(0, this.colors[index].usageCount + delta);
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
        this.updatePaletteUI();
    }

    /**
     * 팔레트 UI 업데이트
     */
    updatePaletteUI() {
        const colorItems = document.querySelectorAll('.color-item');
        colorItems.forEach((item, index) => {
            const color = this.colors[index];
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
        if (colorIndex < 0 || colorIndex >= this.colors.length) {
            console.error(`[ColorPalette] Invalid color index: ${colorIndex}`);
            return false;
        }

        const color = this.colors[colorIndex];
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

        if (typeof colorIndex === 'number' && colorIndex >= 0 && colorIndex < this.colors.length) {
            return this.colors[colorIndex];
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
            if (typeof colorIndex === 'number' && colorIndex >= 0 && colorIndex < this.colors.length) {
                this.colors[colorIndex].usageCount++;
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
