// 고급 필지 관리 시스템
class ParcelManager {
    constructor() {
        this.parcels = [];
        this.filteredParcels = [];
        this.selectedParcels = new Set();
        this.viewMode = 'grid'; // 'grid' or 'list'
        this.filterBy = 'all'; // 'all', 'red', 'blue', 'green', etc
        this.searchQuery = '';
        this.isPanelOpen = false;
        this.isRendering = false; // 렌더링 중 플래그
        this.isComposing = false; // 한글 조합 중 플래그
        this.init();
    }
    
    init() {
        this.loadParcels();
        this.setupEventListeners();
        
        // DOM이 준비되었을 때 렌더링 및 통계 업데이트
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.render();
                this.updateStatisticsOnly();
            });
        } else {
            // 이미 DOM이 준비된 경우
            setTimeout(() => {
                this.render();
                this.updateStatisticsOnly();
            }, 100);
        }
        
        // 초기 로드 시 검색 필지 라벨 숨기기
        this.hideSearchLabels();
    }
    
    loadParcels() {
        // CONFIG.STORAGE_KEY를 사용하여 parcel.js와 같은 데이터 접근
        const STORAGE_KEY = window.CONFIG && window.CONFIG.STORAGE_KEY ? window.CONFIG.STORAGE_KEY : 'parcelData';
        const saved = localStorage.getItem(STORAGE_KEY);
        const rawParcels = saved ? JSON.parse(saved) : [];
        
        // 기존 데이터 형식 변환 (id와 createdAt 추가)
        this.parcels = rawParcels.map((parcel, index) => {
            return {
                ...parcel,
                id: parcel.id || `parcel_${parcel.pnu || parcel.parcelNumber}_${index}`,
                createdAt: parcel.createdAt || parcel.timestamp || new Date().toISOString(),
                address: parcel.address || parcel.parcelNumber || parcel.pnu || '주소 없음',
                coordinates: parcel.coordinates || parcel.geometry // geometry를 coordinates로도 참조 가능하게
            };
        });
        
        // searchParcels Map의 저장된 데이터도 추가 (중복 제외)
        if (window.searchParcels && window.searchParcels.size > 0) {
    // console.log('searchParcels 데이터 추가 시도:', window.searchParcels.size);
            window.searchParcels.forEach((parcelData, pnu) => {
                // 저장된 정보가 있는 검색 필지만 추가
                if (parcelData.savedInfo || parcelData.ownerName || parcelData.ownerAddress || parcelData.memo) {
                    const exists = this.parcels.some(p => p.pnu === pnu);
                    if (!exists) {
                        const jibun = parcelData.data?.properties?.jibun || 
                                     parcelData.data?.properties?.JIBUN || 
                                     (window.formatJibun ? window.formatJibun(parcelData.data?.properties) : '') || 
                                     parcelData.savedInfo?.parcelNumber ||
                                     pnu;
                        
                        const newParcel = {
                            id: `search_${pnu}_${Date.now()}`,
                            pnu: pnu,
                            parcelNumber: jibun,
                            ownerName: parcelData.ownerName || parcelData.savedInfo?.ownerName || '',
                            ownerAddress: parcelData.ownerAddress || parcelData.savedInfo?.ownerAddress || '',
                            ownerContact: parcelData.ownerContact || parcelData.savedInfo?.ownerContact || '',
                            memo: parcelData.memo || parcelData.savedInfo?.memo || '',
                            color: '#9370DB', // 검색 필지는 보라색
                            isSearchParcel: true,
                            geometry: parcelData.data?.geometry,
                            createdAt: parcelData.savedInfo?.timestamp || new Date().toISOString(),
                            address: jibun,
                            coordinates: parcelData.data?.geometry
                        };
                        
                        this.parcels.push(newParcel);
    // console.log('검색 필지 추가됨:', newParcel);
                    }
                }
            });
        }
        
        this.filteredParcels = [...this.parcels];
        
        // 수량 표시 업데이트
        const countEl = document.getElementById('apCount');
        if (countEl) {
            countEl.textContent = this.parcels.length;
        }
    }
    
    saveParcels() {
        // CONFIG.STORAGE_KEY를 사용하여 parcel.js와 같은 데이터 저장
        const STORAGE_KEY = window.CONFIG && window.CONFIG.STORAGE_KEY ? window.CONFIG.STORAGE_KEY : 'parcelData';
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.parcels));
    }
    
    addParcel(parcel) {
        parcel.id = Date.now().toString();
        parcel.createdAt = new Date().toISOString();
        parcel.tags = [];
        this.parcels.unshift(parcel);
        this.saveParcels();
        this.applyFilters();
        this.render();
    }
    
    removeParcel(id) {
        this.parcels = this.parcels.filter(p => p.id !== id);
        this.selectedParcels.delete(id);
        this.saveParcels();
        this.applyFilters();
        this.render();
    }
    
    toggleSelection(id) {
        if (this.selectedParcels.has(id)) {
            this.selectedParcels.delete(id);
        } else {
            this.selectedParcels.add(id);
        }
        this.render();
    }
    
    selectAll() {
        this.filteredParcels.forEach(p => this.selectedParcels.add(p.id));
        this.render();
    }
    
    deselectAll() {
        this.selectedParcels.clear();
        this.render();
    }
    
    deleteSelected() {
        if (this.selectedParcels.size === 0) return;
        if (!confirm(`선택한 ${this.selectedParcels.size}개 필지를 삭제하시겠습니까?`)) return;
        
        this.parcels = this.parcels.filter(p => !this.selectedParcels.has(p.id));
        this.selectedParcels.clear();
        this.saveParcels();
        this.applyFilters();
        this.render();
        
        // 지도에서도 색상 제거
        this.clearMapColors();
    }
    
    // 전체 데이터 초기화
    clearAllData() {
        const confirmMsg = `경고: 전체 초기화\n\n모든 필지 정보와 색상이 영구적으로 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.\n\n정말로 전체 초기화를 진행하시겠습니까?`;
        
        if (!confirm(confirmMsg)) return;
        
        // 두 번 확인
        const secondConfirm = prompt(`정말로 모든 데이터를 삭제하시려면 "초기화"를 입력하세요:`);
        if (secondConfirm !== "초기화") {
            alert('초기화가 취소되었습니다.');
            return;
        }
        
        // 모든 데이터 삭제
        this.parcels = [];
        this.filteredParcels = [];
        this.selectedParcels.clear();
        
        // LocalStorage 초기화
        const STORAGE_KEY = window.CONFIG && window.CONFIG.STORAGE_KEY ? window.CONFIG.STORAGE_KEY : 'parcelData';
        localStorage.removeItem(STORAGE_KEY);
        
        // 지도에서 모든 색상 제거
        this.clearAllMapColors();
        
        // 검색 필지도 모두 제거 (search.js의 clearAllSearchResults 함수 호출)
        if (typeof window.clearAllSearchResults === 'function') {
            window.clearAllSearchResults();
    // console.log('검색 필지도 모두 제거됨');
        } else {
    // console.log('clearAllSearchResults 함수를 찾을 수 없음');
        }
        
        // UI 업데이트
        this.render();
        
        // 수량 표시 업데이트
        const countEl = document.getElementById('apCount');
        if (countEl) {
            countEl.textContent = '0';
        }
        
        alert('전체 초기화가 완료되었습니다.');
    }
    
    // 전체 필지를 구글 시트로 전송
    async exportAllToGoogleSheets() {
        if (this.parcels.length === 0) {
            alert('전송할 필지 데이터가 없습니다.');
            return;
        }
        
        // 데이터 형식 변환
        const dataToExport = this.parcels.map(parcel => ({
            parcelNumber: parcel.parcelNumber || '',
            ownerName: parcel.ownerName || '',
            ownerAddress: parcel.ownerAddress || '',
            ownerContact: parcel.ownerContact || '',
            memo: parcel.memo || ''
        }));
        
        // exportToGoogleSheets 함수 호출 (sheets.js의 함수에 데이터 전달)
        if (typeof exportToGoogleSheets === 'function') {
            await exportToGoogleSheets(dataToExport);
        } else {
            alert('구글 시트 연동 기능을 사용할 수 없습니다.');
        }
    }
    
    // 지도에서 색상 제거
    clearMapColors() {
        if (window.parcels) {
            window.parcels.forEach((parcelData) => {
                if (parcelData.polygon) {
                    parcelData.polygon.setOptions({
                        fillColor: 'transparent',
                        fillOpacity: 0
                    });
                    parcelData.color = 'transparent';
                }
            });
        }
    }
    
    // 지도에서 모든 색상 제거
    clearAllMapColors() {
        // 클릭 필지 색상 제거
        if (window.parcels) {
            window.parcels.forEach((parcelData) => {
                if (parcelData.polygon) {
                    parcelData.polygon.setOptions({
                        fillColor: 'transparent',
                        fillOpacity: 0,
                        strokeColor: '#0000FF',
                        strokeOpacity: 0.6,
                        strokeWeight: 0.5
                    });
                    parcelData.color = 'transparent';
                }
            });
        }
        
        // 검색 필지도 지도에서 제거
        if (window.searchParcels) {
            window.searchParcels.forEach((parcelData) => {
                if (parcelData.polygon) {
                    parcelData.polygon.setMap(null);
                }
                if (parcelData.label) {
                    parcelData.label.setMap(null);
                }
            });
            // searchParcels Map 자체는 유지하되, 폴리곤만 제거
    // console.log('검색 필지 폴리곤 제거 완료');
        }
    }
    
    search(query) {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
        this.renderList(); // 리스트만 업데이트
    }
    
    setFilter(filterType) {
    // console.log('setFilter 호출됨:', filterType); // 디버깅용
        this.filterBy = filterType;
        
        // 보라색(검색 필지) 필터 처리
        if (filterType === '#9370DB') {
            // 검색 필지 표시 (폴리곤 + 라벨)
            this.showSearchParcelsWithLabels();
        } else {
            // 검색 필지 라벨만 숨기기 (폴리곤은 유지)
            this.hideSearchLabels();
        }
        
        this.applyFilters();
    // console.log('필터링 후 필지 개수:', this.filteredParcels.length); // 디버깅용
        this.renderList(); // 리스트만 업데이트
    }
    
    // 검색 필지의 폴리곤과 라벨 모두 표시
    showSearchParcelsWithLabels() {
        if (!window.searchParcels || window.searchParcels.size === 0) {
    // console.log('표시할 검색 필지가 없음');
            return;
        }
        
    // console.log('🟣 보라색 필터: 검색 필지 표시 시작');
        let showCount = 0;
        
        window.searchParcels.forEach((result, key) => {
            // 폴리곤 표시
            if (result.polygon) {
                result.polygon.setMap(window.map);
                result.polygon.setOptions({
                    fillColor: '#9370DB',
                    fillOpacity: 0.7,
                    strokeColor: '#6A0DAD',
                    strokeWeight: 2
                });
            }
            
            // 라벨 표시
            if (result.label) {
                result.label.setMap(window.map);
                showCount++;
            }
        });
        
    // console.log(`✅ ${showCount}개 검색 필지 라벨 표시 완료`);
    }
    
    // 검색 필지의 라벨만 숨기기
    hideSearchLabels() {
        if (!window.searchParcels || window.searchParcels.size === 0) {
            return;
        }
        
    // console.log('🔸 다른 필터: 검색 필지 라벨 숨기기');
        let hideCount = 0;
        
        window.searchParcels.forEach((result, key) => {
            // 라벨만 숨기기
            if (result.label) {
                result.label.setMap(null);
                hideCount++;
            }
            
            // 폴리곤은 기본 스타일로 변경
            if (result.polygon && result.polygon.getMap()) {
                result.polygon.setOptions({
                    fillColor: '#9370DB',
                    fillOpacity: 0.3,
                    strokeColor: '#9370DB',
                    strokeWeight: 1
                });
            }
        });
        
    // console.log(`✅ ${hideCount}개 검색 필지 라벨 숨김 완료`);
    }
    
    
    applyFilters() {
    // console.log('applyFilters 시작 - filterBy:', this.filterBy); // 디버깅용
    // console.log('전체 필지 수:', this.parcels.length); // 디버깅용
        
        // 필터링
        this.filteredParcels = this.parcels.filter(parcel => {
            // 검색어 필터
            if (this.searchQuery) {
                const searchIn = [
                    parcel.parcelNumber,
                    parcel.pnu,
                    parcel.ownerName,
                    parcel.ownerAddress,
                    parcel.ownerContact,
                    parcel.memo
                ].join(' ').toLowerCase();
                
                if (!searchIn.includes(this.searchQuery)) {
                    return false;
                }
            }
            
            // 색상 필터
            if (this.filterBy !== 'all') {
                // 디버깅: 각 필지의 색상 확인
                if (this.parcels.length < 10) { // 필지가 적을 때만 로그
    // console.log(`필지 색상 비교: ${parcel.parcelNumber} - color: ${parcel.color}, filterBy: ${this.filterBy}`);
                }
                if (parcel.color !== this.filterBy) {
                    return false;
                }
            }
            
            return true;
        });
        
        // 최신순으로 고정 정렬
        this.filteredParcels.sort((a, b) => {
            return new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp);
        });
    }
    
    togglePanel() {
        this.isPanelOpen = !this.isPanelOpen;
        const panel = document.getElementById('advancedParcelPanel');
        if (panel) {
            panel.classList.toggle('open', this.isPanelOpen);
        }
    }
    
    setViewMode(mode) {
        this.viewMode = mode;
        this.render();
    }
    
    exportSelected() {
        if (this.selectedParcels.size === 0) {
            alert('내보낼 필지를 선택해주세요.');
            return;
        }
        
        const selected = this.parcels.filter(p => this.selectedParcels.has(p.id));
        const csv = this.generateCSV(selected);
        this.downloadCSV(csv, `선택필지_${new Date().toLocaleDateString()}.csv`);
    }
    
    exportAll() {
        if (this.filteredParcels.length === 0) {
            alert('복사할 필지가 없습니다.');
            return;
        }
        
        // 엑셀 붙여넣기용 탭 구분 형식으로 생성 (헤더 제외, 필수 4개 항목만)
        let tableData = this.filteredParcels.map(p => 
            `${p.parcelNumber || ''}\t${p.ownerName || ''}\t${p.ownerAddress || ''}\t${p.ownerContact || ''}`
        ).join('\n');
        
        // 클립보드에 복사
        this.copyToClipboard(tableData);
    }
    
    copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            const count = this.filteredParcels.length;
            alert(`${count}개의 필지 정보가 클립보드에 복사되었습니다.\n\n엑셀에서 Ctrl+V로 붙여넣기 하세요.`);
        } catch (err) {
            console.error('복사 실패:', err);
            alert('복사에 실패했습니다.');
        } finally {
            document.body.removeChild(textarea);
        }
    }
    
    generateCSV(parcels) {
        let csv = '\uFEFF지번,PNU,소유자이름,소유자주소,연락처,메모,색상,저장일시\n';
        parcels.forEach(p => {
            csv += `"${p.parcelNumber || ''}","${p.pnu || ''}","${p.ownerName || ''}","${p.ownerAddress || ''}","${p.ownerContact || ''}","${p.memo || ''}","${p.color || ''}","${p.createdAt || p.timestamp || ''}"\n`;
        });
        return csv;
    }
    
    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }
    
    getStatistics() {
        // 선택 필지: parcel.js에서 클릭해서 색칠한 필지 (window.clickParcels)
        let selectedCount = 0;
        if (window.clickParcels && window.clickParcels.size > 0) {
            window.clickParcels.forEach((parcelData) => {
                // transparent가 아닌 색상으로 칠해진 필지가 선택 필지
                if (parcelData.color && parcelData.color !== 'transparent') {
                    selectedCount++;
                }
            });
        }
        
        // 검색 필지: search.js에서 검색해서 나온 필지 (window.searchParcels)  
        let searchCount = 0;
        if (window.searchParcels && window.searchParcels.size > 0) {
            // 저장된 정보가 있는 검색 필지만 카운트
            window.searchParcels.forEach((parcel) => {
                if (parcel.savedInfo || parcel.ownerName || parcel.ownerAddress) {
                    searchCount++;
                }
            });
        }
        
        const stats = {
            total: this.parcels.length,
            filtered: this.filteredParcels.length,
            selectedCount: selectedCount,    // 클릭해서 색칠한 필지
            searchCount: searchCount,        // 검색해서 나온 필지
            selected: this.selectedParcels.size,
            byColor: {},
            totalArea: 0
        };
        
        this.parcels.forEach(p => {
            const color = p.color || 'transparent';
            stats.byColor[color] = (stats.byColor[color] || 0) + 1;
            stats.totalArea += parseFloat(p.area) || 0;
        });
        
        return stats;
    }
    
    // 통계만 업데이트하는 메서드
    updateStatisticsOnly() {
        // localStorage에서 데이터 다시 로드
        this.loadParcels();
        
        const stats = this.getStatistics();
        
        // 선택 통계 업데이트
        const selectedStatEl = document.querySelector('.stat-item .stat-value');
        if (selectedStatEl) {
            selectedStatEl.textContent = stats.selectedCount;
        }
        
        // 검색 통계 업데이트
        const searchStatEls = document.querySelectorAll('.stat-item .stat-value');
        if (searchStatEls.length > 1) {
            searchStatEls[1].textContent = stats.searchCount;
        }
        
    // console.log('통계 업데이트 완료:', { 선택: stats.selectedCount, 검색: stats.searchCount });
    }
    
    render() {
        const container = document.getElementById('parcelManagerContent');
        if (!container) return;
        
        // 필터가 적용된 상태를 유지하기 위해 loadParcels는 제거
        // this.loadParcels(); // 이것이 필터를 초기화시킴
        
        const stats = this.getStatistics();
        
        container.innerHTML = `
            <!-- 헤더 통계 및 내보내기 버튼 -->
            <div class="pm-header">
                <div class="pm-stats">
                    <div class="stat-item">
                        <span class="stat-label">선택</span>
                        <span class="stat-value">${stats.selectedCount}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">검색</span>
                        <span class="stat-value">${stats.searchCount}</span>
                    </div>
                </div>
                <div class="pm-actions">
                    <button onclick="parcelManager.exportAllToGoogleSheets()" class="btn-export-google">
                        구글 시트 전송
                    </button>
                    <button onclick="parcelManager.exportAll()" class="btn-export">
                        엑셀 복사
                    </button>
                    <button onclick="parcelManager.clearAllData()" class="btn-danger">
                        전체 초기화
                    </button>
                </div>
            </div>
            
            <!-- 검색 바 -->
            <div class="pm-search">
                <input type="text" 
                       id="pmSearchInput" 
                       placeholder="검색 (주소, 소유자, 메모...)" 
                       value="${this.searchQuery}">
            </div>
            
            <!-- 필터 -->
            <div class="pm-controls">
                <div class="pm-filters">
                    <button class="filter-btn ${this.filterBy === 'all' ? 'active' : ''}" 
                            data-filter="all">전체</button>
                    <button class="filter-btn ${this.filterBy === '#FF0000' ? 'active' : ''}" 
                            data-filter="#FF0000" 
                            style="background: #FF0000;"></button>
                    <button class="filter-btn ${this.filterBy === '#FFA500' ? 'active' : ''}" 
                            data-filter="#FFA500" 
                            style="background: #FFA500;"></button>
                    <button class="filter-btn ${this.filterBy === '#FFFF00' ? 'active' : ''}" 
                            data-filter="#FFFF00" 
                            style="background: #FFFF00;"></button>
                    <button class="filter-btn ${this.filterBy === '#90EE90' ? 'active' : ''}" 
                            data-filter="#90EE90" 
                            style="background: #90EE90;"></button>
                    <button class="filter-btn ${this.filterBy === '#0000FF' ? 'active' : ''}" 
                            data-filter="#0000FF" 
                            style="background: #0000FF;"></button>
                    <button class="filter-btn ${this.filterBy === '#000000' ? 'active' : ''}" 
                            data-filter="#000000" 
                            style="background: #000000;"></button>
                    <button class="filter-btn ${this.filterBy === '#FFFFFF' ? 'active' : ''}" 
                            data-filter="#FFFFFF" 
                            style="background: #FFFFFF; border: 1px solid #ccc;"></button>
                    <button class="filter-btn ${this.filterBy === '#87CEEB' ? 'active' : ''}" 
                            data-filter="#87CEEB" 
                            style="background: #87CEEB;"></button>
                    <!-- 검색 필지용 보라색 필터 - 구분을 위해 떨어뜨려 배치 -->
                    <div style="width: 15px;"></div>
                    <button class="filter-btn search-filter ${this.filterBy === '#9370DB' ? 'active' : ''}" 
                            data-filter="#9370DB" 
                            style="background: #9370DB; border: 2px solid #6A0DAD;" 
                            title="검색 필지"></button>
                </div>
            </div>
            
            <!-- 일괄 작업 도구 -->
            ${this.selectedParcels.size > 0 ? `
                <div class="pm-bulk-actions">
                    <button onclick="parcelManager.selectAll()">전체선택</button>
                    <button onclick="parcelManager.deselectAll()">선택해제</button>
                    <button onclick="parcelManager.deleteSelected()" class="danger">선택삭제</button>
                    <button onclick="parcelManager.exportSelected()">선택내보내기</button>
                </div>
            ` : ''}
            
            <!-- 필지 목록 -->
            <div class="pm-list table">
                ${this.filteredParcels.length === 0 ? `
                    <div class="pm-empty">
                        <div class="empty-icon">—</div>
                        <p class="empty-title">저장된 필지가 없습니다</p>
                        <p class="empty-subtitle">필지를 선택하고 저장 버튼을 눌러주세요</p>
                    </div>
                ` : this.filteredParcels.map(parcel => this.renderParcelCard(parcel)).join('')}
            </div>
            
        `;
        
        this.attachEventListeners();
    }
    
    // 리스트만 업데이트하는 메서드
    renderList() {
        const listContainer = document.querySelector('.pm-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = this.filteredParcels.length === 0 ? `
            <div class="pm-empty">
                <div class="empty-icon">—</div>
                <p class="empty-title">저장된 필지가 없습니다</p>
                <p class="empty-subtitle">필지를 선택하고 저장 버튼을 눌러주세요</p>
            </div>
        ` : this.filteredParcels.map(parcel => this.renderParcelCard(parcel)).join('');
    }
    
    renderParcelCard(parcel) {
        const isSelected = this.selectedParcels.has(parcel.id);
        const date = new Date(parcel.createdAt || parcel.timestamp).toLocaleDateString();
        
        if (this.viewMode === 'grid') {
            return `
                <div class="pm-card ${isSelected ? 'selected' : ''}" 
                     data-id="${parcel.id}"
                     onclick="parcelManager.focusOnMap('${parcel.id}')"
                     style="cursor: pointer;">
                    <div class="pm-card-select">
                        <input type="checkbox" 
                               ${isSelected ? 'checked' : ''} 
                               onclick="event.stopPropagation();"
                               onchange="parcelManager.toggleSelection('${parcel.id}')">
                    </div>
                    <div class="pm-card-color" 
                         style="background: ${parcel.color || '#ccc'}"></div>
                    <div class="pm-card-content">
                        <h4>${parcel.parcelNumber || '지번 없음'}</h4>
                        <div class="pm-card-info">
                            ${parcel.ownerName ? `<div>👤 ${parcel.ownerName}</div>` : ''}
                            ${parcel.ownerAddress ? `<div>🏠 ${parcel.ownerAddress}</div>` : ''}
                            ${parcel.ownerContact ? `<div>📞 ${parcel.ownerContact}</div>` : ''}
                            ${parcel.memo ? `<div>메모: ${parcel.memo.substring(0, 50)}${parcel.memo.length > 50 ? '...' : ''}</div>` : ''}
                        </div>
                        <p class="pm-card-date">${date}</p>
                    </div>
                    <div class="pm-card-actions">
                        <button onclick="parcelManager.editParcel('${parcel.id}')" 
                                title="수정" class="btn-edit">수정</button>
                        <button onclick="parcelManager.removeParcel('${parcel.id}')" 
                                title="삭제" class="btn-delete">삭제</button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="pm-list-item ${isSelected ? 'selected' : ''}" 
                     data-id="${parcel.id}"
                     onclick="parcelManager.focusOnMap('${parcel.id}')"
                     style="cursor: pointer;">
                    <input type="checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           onclick="event.stopPropagation();"
                           onchange="parcelManager.toggleSelection('${parcel.id}')">
                    <div class="pm-list-color" 
                         style="background: ${parcel.color || '#ccc'}"></div>
                    <div class="pm-list-content">
                        <span class="pm-list-address">${parcel.parcelNumber || '지번 없음'}</span>
                        <span class="pm-list-owner">${parcel.ownerName || '-'}</span>
                        <span class="pm-list-contact">${parcel.ownerContact || '-'}</span>
                        <span class="pm-list-memo">${parcel.memo ? parcel.memo.substring(0, 30) + '...' : '-'}</span>
                        <span class="pm-list-date">${date}</span>
                    </div>
                    <div class="pm-list-actions">
                        <button onclick="parcelManager.editParcel('${parcel.id}')" class="btn-edit" title="수정">수정</button>
                        <button onclick="parcelManager.removeParcel('${parcel.id}')" class="btn-delete" title="삭제">삭제</button>
                    </div>
                </div>
            `;
        }
    }
    
    focusOnMap(id) {
        const parcel = this.parcels.find(p => p.id === id);
        if (!parcel || !window.map) return;
        
        const geometry = parcel.geometry || parcel.coordinates;
        if (!geometry) return;
        
        // geometry에서 좌표 추출
        if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
            const coords = geometry.coordinates[0];
            let sumLat = 0, sumLng = 0, count = 0;
            
            coords.forEach(coord => {
                // [lng, lat] 형식
                sumLat += coord[1];
                sumLng += coord[0];
                count++;
            });
            
            if (count > 0) {
                const center = new naver.maps.LatLng(sumLat / count, sumLng / count);
                window.map.setCenter(center);
                window.map.setZoom(18);
            }
        } else if (Array.isArray(geometry)) {
            // 이전 형식 호환
            let sumLat = 0, sumLng = 0, count = 0;
            geometry.forEach(coord => {
                sumLat += coord.lat || coord[1];
                sumLng += coord.lng || coord[0];
                count++;
            });
            
            if (count > 0) {
                const center = new naver.maps.LatLng(sumLat / count, sumLng / count);
                window.map.setCenter(center);
                window.map.setZoom(18);
            }
        }
        
        // 패널 닫기
        this.togglePanel();
    }
    
    editParcel(id) {
        const parcel = this.parcels.find(p => p.id === id);
        if (!parcel) return;
        
        // 폼에 데이터 채우기
        document.getElementById('parcelNumber').value = parcel.parcelNumber || '';
        document.getElementById('ownerName').value = parcel.ownerName || '';
        document.getElementById('ownerAddress').value = parcel.ownerAddress || '';
        document.getElementById('ownerContact').value = parcel.ownerContact || '';
        document.getElementById('memo').value = parcel.memo || '';
        
        // 색상 선택
        if (parcel.color) {
            const colorBtn = document.querySelector(`.color-item[data-color="${parcel.color}"]`);
            if (colorBtn) colorBtn.click();
        }
        
        // 지도 포커스
        this.focusOnMap(id);
    }
    
    attachEventListeners() {
        // 검색
        const searchInput = document.getElementById('pmSearchInput');
        if (searchInput && !searchInput.hasAttribute('data-listener-attached')) {
            searchInput.setAttribute('data-listener-attached', 'true');
            
            // 한글 조합 시작
            searchInput.addEventListener('compositionstart', () => {
                this.isComposing = true;
            });
            
            // 한글 조합 종료
            searchInput.addEventListener('compositionend', (e) => {
                this.isComposing = false;
                if (!this.isRendering) {
                    this.search(e.target.value);
                }
            });
            
            // 일반 입력 처리
            searchInput.addEventListener('input', (e) => {
                // 렌더링 중이거나 한글 조합 중이 아닐 때만 처리
                if (!this.isRendering && !this.isComposing) {
                    this.search(e.target.value);
                }
            });
        }
        
        // 필터 - 이벤트 핸들러 수정 (중복 방지)
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (!btn.hasAttribute('data-listener-attached')) {
                btn.setAttribute('data-listener-attached', 'true');
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // currentTarget을 사용하여 정확한 버튼 요소 가져오기
                    const filterValue = e.currentTarget.getAttribute('data-filter');
    // console.log('필터 클릭:', filterValue); // 디버깅용
                    
                    if (filterValue) {
                        this.setFilter(filterValue);
                    }
                });
            }
        });
        
        // 정렬
        const sortSelect = document.getElementById('pmSortSelect');
        if (sortSelect && !sortSelect.hasAttribute('data-listener-attached')) {
            sortSelect.setAttribute('data-listener-attached', 'true');
            sortSelect.addEventListener('change', (e) => {
                this.setSortBy(e.target.value);
            });
        }
    }
    
    setupEventListeners() {
        // 외부에서 필지 추가 이벤트 리스닝
        window.addEventListener('parcelAdded', (e) => {
            this.loadParcels();  // 데이터 변경 시에만 로드
            this.addParcel(e.detail);
        });
        
        // 외부에서 필지 목록 갱신 요청
        window.addEventListener('refreshParcelList', () => {
            this.loadParcels();
            this.applyFilters();
            this.render();
        });
    }
}

// 전역 인스턴스 생성
window.parcelManager = new ParcelManager();