/**
 * SearchModeManager - 검색 모드 관리
 * 검색 실행, 결과 처리, 보라색 필지 렌더링
 */
class SearchModeManager {
    constructor() {
        this.searchColor = '#9B59B6'; // 보라색 (검색 전용)
        this.searchResults = [];
        this.searchParcels = new Map();
        this.currentQuery = '';
        this.isSearchActive = false;
    }

    persistSearchState(extra = {}) {
        try {
            const serializedResults = this.searchResults.map(result => {
                const base = {
                    pnu: result.pnu || result.PNU || result.id || null,
                    lat: result.lat || result.latitude || null,
                    lng: result.lng || result.longitude || null,
                    ownerName: result.ownerName || null,
                    ownerAddress: result.ownerAddress || null,
                    mode: 'search'
                };

                if (result.geometry && typeof result.geometry === 'object') {
                    base.geometry = result.geometry;
                }

                if (result.address) {
                    base.address = result.address;
                }

                return base;
            });

            const payload = {
                query: this.currentQuery,
                results: serializedResults.map(item => item.pnu).filter(Boolean),
                parcels: serializedResults,
                isActive: this.isSearchActive,
                searchTime: Date.now(),
                ...extra
            };

            localStorage.setItem('searchModeData', JSON.stringify(payload));
        } catch (error) {
            console.error('[SearchMode] Failed to persist search state:', error);
        }
    }

    clearStoredSearchState() {
        localStorage.removeItem('searchModeData');
        localStorage.removeItem('searchColors');
    }

    /**
     * 검색 실행
     * @param {string} query - 검색어
     * @param {string} searchType - 'address' | 'pnu' | 'owner' | 'all'
     */
    async executeSearch(query, searchType = 'all') {
        if (!query || query.trim().length === 0) {
            console.warn('[SearchMode] Empty search query');
            return { results: [], totalResults: 0 };
        }

        console.log(`[SearchMode] Executing search: "${query}" (type: ${searchType})`);

        this.currentQuery = query;
        this.isSearchActive = true;

        // 자동으로 검색 모드로 전환
        if (window.ModeManager && window.ModeManager.getCurrentMode() !== 'search') {
            await window.ModeManager.switchMode('search');
        }

        try {
            // 검색 실행 (실제 구현시 API 호출)
            const results = await this.performSearch(query, searchType);

            this.searchResults = results;
            this.renderSearchResults(results);

            // 검색 시간 기록
            const searchTime = Date.now();
            if (window.ModeManager) {
                window.ModeManager.updateModeData('search', {
                    query: query,
                    results: results.map(r => r.pnu),
                    searchTime: searchTime,
                    isActive: true
                });
            }

            this.persistSearchState({ searchTime, totalResults: results.length });

            return {
                query: query,
                results: results,
                totalResults: results.length,
                searchTime: searchTime,
                modeAutoSwitched: true
            };

        } catch (error) {
            console.error('[SearchMode] Search error:', error);
            throw error;
        }
    }

    /**
     * 실제 검색 수행
     */
    async performSearch(query, searchType) {
        const results = [];

        try {
            switch (searchType) {
                case 'address': {
                    if (window.searchAddressByKeyword) {
                        const searchResults = await window.searchAddressByKeyword(query);
                        return searchResults || [];
                    }
                    break;
                }

                case 'pnu':
                case 'jibun': {
                    if (window.searchParcelByJibun) {
                        const searchResults = await window.searchParcelByJibun(query);
                        return searchResults || [];
                    }
                    break;
                }

                case 'owner': {
                    if (window.SupabaseManager) {
                        const supabaseResults = await window.SupabaseManager.searchByOwner(query);
                        if (supabaseResults && supabaseResults.length > 0) {
                            return supabaseResults;
                        }
                    }

                    const localParcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
                    return localParcels.filter(p => p.ownerName?.includes(query));
                }

                case 'all':
                default: {
                    const pureJibunPattern = /^\d+(-\d+)?$/;
                    const areaJibunPattern = /^[가-힣]+\s+\d+(-\d+)?$/;

                    if (pureJibunPattern.test(query.trim()) || areaJibunPattern.test(query.trim())) {
                        console.log(`[SearchMode] 지번 형식으로 검색: "${query}"`);
                        if (window.searchParcelByJibun) {
                            const searchResults = await window.searchParcelByJibun(query);
                            if (searchResults && searchResults.length > 0) {
                                return searchResults;
                            }
                        }
                        console.log('[SearchMode] 지번 검색 실패, 주소 검색으로 재시도');
                        if (window.searchAddressByKeyword) {
                            const searchResults = await window.searchAddressByKeyword(query);
                            // searchAddressByKeyword가 이미 alert를 표시하므로 중복 alert 제거
                            return searchResults || [];
                        }
                    } else {
                        console.log(`[SearchMode] 주소 형식으로 검색: "${query}"`);
                        if (window.searchAddressByKeyword) {
                            const searchResults = await window.searchAddressByKeyword(query);
                            return searchResults || [];
                        }
                    }

                    const allParcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
                    return allParcels.filter(parcel =>
                        parcel.parcelName?.includes(query) ||
                        parcel.ownerAddress?.includes(query) ||
                        parcel.pnu?.includes(query) ||
                        parcel.ownerName?.includes(query)
                    );
                }
            }
        } catch (error) {
            console.error('[SearchMode] Search API error:', error);

            // API 실패시 LocalStorage 폴백
            const allParcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
            return allParcels.filter(parcel => {
                switch(searchType) {
                    case 'address':
                        return parcel.parcelName?.includes(query) ||
                               parcel.ownerAddress?.includes(query);
                    case 'pnu':
                        return parcel.pnu?.includes(query);
                    case 'owner':
                        return parcel.ownerName?.includes(query);
                    case 'all':
                    default:
                        return parcel.parcelName?.includes(query) ||
                               parcel.ownerAddress?.includes(query) ||
                               parcel.pnu?.includes(query) ||
                               parcel.ownerName?.includes(query);
                }
            });
        }

        return results;
    }

    /**
     * 검색 결과 렌더링
     */
    renderSearchResults(results) {
        console.log(`[SearchMode] Rendering ${results.length} search results`);

        // 기존 검색 결과 제거
        this.clearSearchParcels();

        // 새 검색 결과 렌더링
        results.forEach(result => {
            this.renderSearchParcel(result);
        });

        // 검색 결과 목록 UI 업데이트
        this.updateSearchResultsUI(results);

        this.persistSearchState({ totalResults: results.length });
    }

    /**
     * 검색 필지 렌더링 (보라색)
     */
    renderSearchParcel(parcelData) {
        if (!window.map || !parcelData.pnu) {
            return;
        }

        try {
            // 폴리곤 생성 또는 업데이트
            let polygon = this.searchParcels.get(parcelData.pnu);

            if (!polygon && parcelData.geometry) {
                // 새 폴리곤 생성
                const coords = this.parseGeometry(parcelData.geometry);
                if (coords && coords.length > 0) {
                    polygon = new naver.maps.Polygon({
                        map: window.map,
                        paths: coords,
                        fillColor: this.searchColor,
                        fillOpacity: 0.5,
                        strokeColor: this.searchColor,
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        clickable: true
                    });

                    // 클릭 이벤트 추가
                    naver.maps.Event.addListener(polygon, 'click', () => {
                        this.handleSearchParcelClick(parcelData);
                    });

                    this.searchParcels.set(parcelData.pnu, polygon);
                }
            } else if (polygon) {
                // 기존 폴리곤 업데이트
                polygon.setOptions({
                    fillColor: this.searchColor,
                    strokeColor: this.searchColor
                });
            }

        } catch (error) {
            console.error('[SearchMode] Error rendering search parcel:', error);
        }
    }

    /**
     * 지오메트리 파싱
     */
    parseGeometry(geometry) {
        if (!geometry) return null;

        try {
            if (typeof geometry === 'string') {
                geometry = JSON.parse(geometry);
            }

            if (geometry.coordinates && geometry.coordinates.length > 0) {
                return geometry.coordinates[0].map(coord =>
                    new naver.maps.LatLng(coord[1], coord[0])
                );
            }
        } catch (error) {
            console.error('[SearchMode] Error parsing geometry:', error);
        }

        return null;
    }

    /**
     * 검색 필지 클릭 처리
     */
    handleSearchParcelClick(parcelData) {
        console.log('[SearchMode] Search parcel clicked:', parcelData.pnu);

        // 보라색 필지 클릭 시 색상 제거 (토글)
        const polygon = this.searchParcels.get(parcelData.pnu);
        if (polygon) {
            polygon.setMap(null);
            this.searchParcels.delete(parcelData.pnu);

            // 검색 결과에서도 제거
            this.searchResults = this.searchResults.filter(r => r.pnu !== parcelData.pnu);
            this.updateSearchResultsUI(this.searchResults);
        }
    }

    /**
     * 검색 결과 UI 업데이트
     */
    updateSearchResultsUI(results) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = '';

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">검색 결과가 없습니다</div>';
            return;
        }

        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div class="result-name">${result.parcelName || result.pnu}</div>
                <div class="result-owner">${result.ownerName || '-'}</div>
                <div class="result-address">${result.ownerAddress || '-'}</div>
            `;
            item.onclick = () => this.focusOnParcel(result);
            resultsContainer.appendChild(item);
        });
    }

    /**
     * 필지에 포커스
     */
    focusOnParcel(parcelData) {
        if (!window.map || !parcelData.lat || !parcelData.lng) return;

        const position = new naver.maps.LatLng(parcelData.lat, parcelData.lng);
        window.map.setCenter(position);
        window.map.setZoom(18);
    }

    /**
     * 검색 결과 가져오기
     */
    getSearchResults() {
        return {
            query: this.currentQuery,
            results: this.searchResults,
            searchTime: Date.now(),
            isActive: this.isSearchActive
        };
    }

    /**
     * 검색 결과 삭제
     */
    clearSearch(keepMode = false) {
        console.log('[SearchMode] Clearing search results');

        // 모든 검색 폴리곤 제거
        this.clearSearchParcels();

        // 상태 초기화
        this.searchResults = [];
        this.currentQuery = '';
        this.isSearchActive = false;

        // UI 초기화
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }

        // 검색 입력 초기화
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }

        this.clearStoredSearchState();

        if (window.ModeManager) {
            window.ModeManager.updateModeData('search', {
                query: '',
                results: [],
                isActive: false
            });
        }

        // 모드 전환 (필요시)
        if (!keepMode && window.ModeManager) {
            window.ModeManager.switchMode('click');
        }

        return {
            clearedParcels: this.searchParcels.size,
            modeSwitched: !keepMode,
            newMode: keepMode ? 'search' : 'click'
        };
    }

    /**
     * 검색 폴리곤 모두 제거
     */
    clearSearchParcels() {
        this.searchParcels.forEach(polygon => {
            polygon.setMap(null);
        });
        this.searchParcels.clear();
    }

    /**
     * 특정 검색 필지 제거
     */
    removeSearchParcel(pnu) {
        const polygon = this.searchParcels.get(pnu);
        if (polygon) {
            polygon.setMap(null);
            this.searchParcels.delete(pnu);

            // 검색 결과에서도 제거
            this.searchResults = this.searchResults.filter(r => r.pnu !== pnu);

            this.persistSearchState({ totalResults: this.searchResults.length });

            return {
                pnu: pnu,
                removed: true
            };
        }

        return {
            pnu: pnu,
            removed: false
        };
    }

    /**
     * 검색 모드 표시/숨김
     */
    setVisible(visible) {
        this.searchParcels.forEach(polygon => {
            polygon.setMap(visible ? window.map : null);
        });
    }

    /**
     * 검색 모드 활성화 여부
     */
    isActive() {
        return this.isSearchActive;
    }

    /**
     * 초기화
     */
    initialize() {
        // 검색 버튼 이벤트 리스너
        const searchButton = document.getElementById('searchButton');
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                const input = document.getElementById('searchInput');
                if (input && input.value) {
                    this.executeSearch(input.value);
                }
            });
        }

        // 검색 입력 엔터키 처리
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.executeSearch(searchInput.value);
                }
            });
        }

        // 검색 지우기 버튼
        const clearButton = document.getElementById('clearSearchButton');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.clearSearch();
            });
        }

        console.log('[SearchMode] Initialized');
    }
}

// 전역 인스턴스 생성
window.SearchModeManager = new SearchModeManager();
