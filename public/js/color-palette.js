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

        this.currentSelection = null;
        this.searchModeColor = {
            hex: '#9B59B6',
            name: '검색'
        };

        this.selectionCallbacks = [];
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
            // 클릭 이벤트
            item.addEventListener('click', () => {
                this.selectColor(index);

                // 선택 상태 UI 업데이트
                colorItems.forEach(el => el.classList.remove('active', 'selected'));
                item.classList.add('active', 'selected');

                // 현재 색상 표시 업데이트
                const currentColorDiv = document.getElementById('currentColor');
                if (currentColorDiv) {
                    currentColorDiv.style.background = this.colors[index].hex;
                }
            });

            // 사용 카운트 표시
            if (this.colors[index] && this.colors[index].usageCount > 0) {
                let badge = item.querySelector('.usage-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'usage-badge';
                    item.appendChild(badge);
                }
                badge.textContent = this.colors[index].usageCount;
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
        if (this.currentSelection !== null) {
            this.colors[this.currentSelection].isActive = false;
        }

        // 새 색상 선택
        this.currentSelection = index;
        this.colors[index].isActive = true;

        // UI 업데이트
        this.updatePaletteUI();

        // 콜백 실행
        this.notifyColorSelection(index, this.colors[index]);

        console.log(`[ColorPalette] Color selected: ${this.colors[index].name} (${index})`);
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

            // 사용 카운트 뱃지 업데이트
            let badge = item.querySelector('.usage-badge');
            if (color.usageCount > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'usage-badge';
                    item.appendChild(badge);
                }
                badge.textContent = color.usageCount;
            } else if (badge) {
                badge.remove();
            }
        });

        // 색상 통계 업데이트
        const statsElement = document.getElementById('colorStats');
        if (statsElement) {
            const totalColored = this.colors.reduce((sum, color) => sum + color.usageCount, 0);
            statsElement.textContent = `총 ${totalColored}개 필지`;
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

        // 색상 사용 카운트 증가
        this.updateUsageCount(colorIndex, 1);

        // LocalStorage에 색상 정보 저장
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
        const previousColorIndex = parcelColors[pnu];

        // 이전 색상이 있었다면 카운트 감소
        if (previousColorIndex !== undefined && previousColorIndex !== colorIndex) {
            this.updateUsageCount(previousColorIndex, -1);
        }

        parcelColors[pnu] = colorIndex;
        localStorage.setItem('parcelColors', JSON.stringify(parcelColors));

        console.log(`[ColorPalette] Applied color ${color.name} to parcel ${pnu}`);
        return true;
    }

    /**
     * 필지 색상 제거
     */
    removeColorFromParcel(pnu) {
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
        const colorIndex = parcelColors[pnu];

        if (colorIndex !== undefined) {
            // 색상 사용 카운트 감소
            this.updateUsageCount(colorIndex, -1);

            // LocalStorage에서 제거
            delete parcelColors[pnu];
            localStorage.setItem('parcelColors', JSON.stringify(parcelColors));

            console.log(`[ColorPalette] Removed color from parcel ${pnu}`);
            return true;
        }

        return false;
    }

    /**
     * 필지의 현재 색상 가져오기
     */
    getParcelColor(pnu) {
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
        const colorIndex = parcelColors[pnu];

        if (colorIndex !== undefined && colorIndex >= 0 && colorIndex < this.colors.length) {
            return this.colors[colorIndex];
        }

        return null;
    }

    /**
     * 모든 색상 정보 로드
     */
    loadColorData() {
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');

        // 사용 카운트 재계산
        this.resetUsageCounts();
        Object.values(parcelColors).forEach(colorIndex => {
            if (colorIndex >= 0 && colorIndex < this.colors.length) {
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
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
        const parcels = [];

        Object.entries(parcelColors).forEach(([pnu, index]) => {
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
                this.selectColor(index);
            } else if (key === '0' || key === 'Escape') {
                this.deselectColor();
            }
        });

        console.log('[ColorPalette] Initialized');
    }
}

// 전역 인스턴스 생성
window.ColorPaletteManager = new ColorPaletteManager();