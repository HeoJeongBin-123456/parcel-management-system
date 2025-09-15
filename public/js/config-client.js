// 클라이언트 사이드 설정 (환경변수 사용)
window.CONFIG = {
    // 이 값들은 빌드 시 환경변수로 대체됨
    NAVER_CLIENT_ID: 'xzbnwd2h1z', // 네이버 지도는 클라이언트 ID만 필요
    
    // 지도 초기 설정
    MAP_DEFAULT_CENTER: {
        lat: 37.5665,
        lng: 126.9780
    },
    MAP_DEFAULT_ZOOM: 15,
    
    // 색상 팔레트
    COLORS: {
        red: '#FF0000',
        orange: '#FFA500',
        yellow: '#FFFF00',
        green: '#90EE90',
        blue: '#0000FF',
        black: '#000000',
        white: '#FFFFFF',
        skyblue: '#87CEEB'
    },
    
    // 필지 하이라이트 색상 (검색 필지용)
    HIGHLIGHT_COLOR: '#9370DB',  // 보라색 (검색 필지)
    HIGHLIGHT_OPACITY: 0.7,
    CLICK_PARCEL_COLOR: '#FFFF00',  // 노란색 (클릭 필지)
    
    // LocalStorage 키
    STORAGE_KEY: 'parcelData',
    
    // Google Sheets Apps Script URL
    GOOGLE_SHEETS_URL: 'https://script.google.com/macros/s/AKfycbxR42RFSg32RjxLzBESBK6lL1KXaCipBiVHK2Crn-GeYyyVMdqTmZGfpBwUFqlZpVxw/exec' // 여기에 Google Apps Script 배포 URL을 입력하세요
};

// 전역 변수
let map = null;
// 색상은 항상 빨간색으로 시작 (보라색은 검색 모드 전용이므로 사용자가 직접 선택할 수 없음)
let currentColor = window.CONFIG.COLORS.red;
window.currentColor = currentColor; // window.currentColor도 동일하게 초기화

// 필지 모드 관리 - window에 직접 정의 (localStorage에서 복원)
window.currentMode = localStorage.getItem('current_mode') || 'click'; // 'search' 또는 'click' - 기본값은 클릭 모드 (검색 OFF)
window.clickParcels = new Map(); // 클릭으로 선택한 필지 데이터 저장
window.searchParcels = new Map(); // 검색으로 찾은 필지 데이터 저장

// 하위 호환성을 위한 alias
window.parcels = window.clickParcels;
window.searchResults = window.searchParcels;

let searchResultsVisible = true;
window.currentSelectedPNU = null; // 현재 선택된 필지의 PNU (전역 변수로 변경)

// 필지 표시/숨김 관련 유틸리티 함수들 (강화된 검색 필지 필터링)
window.showClickParcels = function() {
    console.log('🎯 클릭 필지 표시 시작 (현재 모드:', window.currentMode, ')');
    let showCount = 0, skipCount = 0;

    window.clickParcels.forEach((parcel, key) => {
        // 🔍 더 엄격한 검색 필지 감지 로직
        const isSearchParcel = parcel.color === '#9370DB' ||
                              parcel.colorType === 'search' ||
                              parcel.parcel_type === 'search' ||
                              parcel.isSearchParcel === true ||
                              window.searchParcels.has(key);

        if (isSearchParcel) {
            // 검색 필지는 클릭 모드에서 무조건 숨김
            console.log('🚫 검색 필지 숨김:', key, {
                color: parcel.color,
                colorType: parcel.colorType,
                parcel_type: parcel.parcel_type,
                isSearchParcel: parcel.isSearchParcel,
                inSearchMap: window.searchParcels.has(key)
            });
            if (parcel.polygon) parcel.polygon.setMap(null);
            if (parcel.label) parcel.label.setMap(null);
            skipCount++;
            return;
        }

        // 클릭 필지만 표시
        if (parcel.polygon) parcel.polygon.setMap(map);
        if (parcel.label) parcel.label.setMap(map);
        showCount++;
    });

    console.log(`✅ 클릭 필지 표시 완료: ${showCount}개 표시, ${skipCount}개 숨김`);
}

window.hideClickParcels = function() {
    // console.log('클릭 필지 숨김:', window.clickParcels.size, '개');
    window.clickParcels.forEach((parcel, key) => {
        if (parcel.polygon) parcel.polygon.setMap(null);
        if (parcel.label) parcel.label.setMap(null);
    });
}

window.showSearchParcels = function() {
    // console.log('검색 필지 표시:', window.searchParcels.size, '개');
    window.searchParcels.forEach((parcel, key) => {
        if (parcel.polygon) parcel.polygon.setMap(map);
        if (parcel.label) parcel.label.setMap(map);
    });
}

window.hideSearchParcels = function() {
    // console.log('검색 필지 숨김:', window.searchParcels.size, '개');
    window.searchParcels.forEach((parcel, key) => {
        if (parcel.polygon) parcel.polygon.setMap(null);
        if (parcel.label) parcel.label.setMap(null);
    });
}

// 🧹 clickParcels에서 검색 필지 완전 제거 함수 (강화된 버전)
window.cleanupSearchParcelsFromClickMap = function() {
    console.log('🧹 clickParcels에서 검색 필지 정리 시작...');
    let removedCount = 0;
    const keysToRemove = [];

    // 1. clickParcels에서 보라색 필지 제거
    window.clickParcels.forEach((parcel, key) => {
        const isSearchParcel = parcel.color === '#9370DB' ||
                              parcel.colorType === 'search' ||
                              parcel.parcel_type === 'search' ||
                              parcel.isSearchParcel === true ||
                              window.searchParcels.has(key);

        if (isSearchParcel) {
            // 지도에서도 제거
            if (parcel.polygon) parcel.polygon.setMap(null);
            if (parcel.label) parcel.label.setMap(null);
            keysToRemove.push(key);
            removedCount++;
        }
    });

    // clickParcels Map에서 제거
    keysToRemove.forEach(key => window.clickParcels.delete(key));

    // 2. localStorage에서도 보라색 필지 제거
    try {
        const savedData = JSON.parse(localStorage.getItem('parcelData') || '[]');
        const cleanedData = savedData.filter(item => {
            const isSearchParcel = item.color === '#9370DB' ||
                                  item.colorType === 'search' ||
                                  item.parcel_type === 'search';
            if (isSearchParcel) {
                console.log('🧹 localStorage에서 보라색 필지 제거:', item.parcelNumber || item.pnu);
                return false;
            }
            return true;
        });

        if (cleanedData.length !== savedData.length) {
            localStorage.setItem('parcelData', JSON.stringify(cleanedData));
            console.log(`🧹 localStorage에서 ${savedData.length - cleanedData.length}개 보라색 필지 제거`);
        }
    } catch (error) {
        console.error('🚨 localStorage 정리 실패:', error);
    }

    // 3. 색상 정보에서도 보라색 제거
    try {
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
        let colorRemovedCount = 0;
        Object.keys(parcelColors).forEach(pnu => {
            if (parcelColors[pnu] === '#9370DB') {
                delete parcelColors[pnu];
                colorRemovedCount++;
            }
        });

        if (colorRemovedCount > 0) {
            localStorage.setItem('parcelColors', JSON.stringify(parcelColors));
            console.log(`🧹 색상 정보에서 ${colorRemovedCount}개 보라색 제거`);
        }
    } catch (error) {
        console.error('🚨 색상 정보 정리 실패:', error);
    }

    if (removedCount > 0) {
        console.log(`✅ 총 ${removedCount}개 검색 필지 완전 제거 완료`);
    } else {
        console.log('✅ 제거할 검색 필지가 없음');
    }

    return removedCount;
}

// =================================================================
// Phase 3: 마커 시스템 모드별 독립 관리 함수들
// =================================================================

// 클릭 필지 마커만 표시
window.showClickMarkers = function() {
    if (!window.MemoMarkerManager || !window.MemoMarkerManager.markers) return;

    console.log('📍 클릭 필지 마커 표시');
    const clickParcelData = window.getClickParcelData();

    clickParcelData.forEach(parcel => {
        const pnu = parcel.pnu || parcel.id;
        if (pnu && window.MemoMarkerManager.markers.has(pnu)) {
            const markerInfo = window.MemoMarkerManager.markers.get(pnu);
            if (markerInfo && markerInfo.marker) {
                markerInfo.marker.setMap(map);
            }
        }
    });
}

// 클릭 필지 마커만 숨김
window.hideClickMarkers = function() {
    if (!window.MemoMarkerManager || !window.MemoMarkerManager.markers) return;

    console.log('📍 클릭 필지 마커 숨김');
    const clickParcelData = window.getClickParcelData();

    clickParcelData.forEach(parcel => {
        const pnu = parcel.pnu || parcel.id;
        if (pnu && window.MemoMarkerManager.markers.has(pnu)) {
            const markerInfo = window.MemoMarkerManager.markers.get(pnu);
            if (markerInfo && markerInfo.marker) {
                markerInfo.marker.setMap(null);
            }
        }
    });
}

// 검색 필지 마커만 표시
window.showSearchMarkers = function() {
    if (!window.MemoMarkerManager || !window.MemoMarkerManager.markers) return;

    console.log('📍 검색 필지 마커 표시');
    const searchParcelData = window.getSearchParcelData();

    searchParcelData.forEach(parcel => {
        const pnu = parcel.pnu || parcel.id;
        if (pnu && window.MemoMarkerManager.markers.has(pnu)) {
            const markerInfo = window.MemoMarkerManager.markers.get(pnu);
            if (markerInfo && markerInfo.marker) {
                markerInfo.marker.setMap(map);
            }
        }
    });
}

// 검색 필지 마커만 숨김
window.hideSearchMarkers = function() {
    if (!window.MemoMarkerManager || !window.MemoMarkerManager.markers) return;

    console.log('📍 검색 필지 마커 숨김');
    const searchParcelData = window.getSearchParcelData();

    searchParcelData.forEach(parcel => {
        const pnu = parcel.pnu || parcel.id;
        if (pnu && window.MemoMarkerManager.markers.has(pnu)) {
            const markerInfo = window.MemoMarkerManager.markers.get(pnu);
            if (markerInfo && markerInfo.marker) {
                markerInfo.marker.setMap(null);
            }
        }
    });
}

// =================================================================
// localStorage 키 분리 유틸리티 함수들 (Phase 1)
// =================================================================

// 새로운 localStorage 키 정의
window.STORAGE_KEYS = {
    CLICK_PARCEL_DATA: 'clickParcelData',
    SEARCH_PARCEL_DATA: 'searchParcelData',
    CLICK_PARCEL_COLORS: 'clickParcelColors',
    SEARCH_PARCEL_COLORS: 'searchParcelColors',
    CLICK_MARKER_STATES: 'clickMarkerStates',
    SEARCH_MARKER_STATES: 'searchMarkerStates',
    MIGRATION_COMPLETED: 'parcel_migration_completed'
};

// 클릭 필지 데이터 관리 함수들
window.getClickParcelData = function() {
    try {
        const data = localStorage.getItem(window.STORAGE_KEYS.CLICK_PARCEL_DATA);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('🚨 클릭 필지 데이터 로드 오류:', error);
        return [];
    }
};

window.saveClickParcelData = function(data) {
    try {
        localStorage.setItem(window.STORAGE_KEYS.CLICK_PARCEL_DATA, JSON.stringify(data));
        console.log('✅ 클릭 필지 데이터 저장 완료:', data.length, '개');
        return true;
    } catch (error) {
        console.error('🚨 클릭 필지 데이터 저장 오류:', error);
        return false;
    }
};

// 검색 필지 데이터 관리 함수들
window.getSearchParcelData = function() {
    try {
        const data = localStorage.getItem(window.STORAGE_KEYS.SEARCH_PARCEL_DATA);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('🚨 검색 필지 데이터 로드 오류:', error);
        return [];
    }
};

window.saveSearchParcelData = function(data) {
    try {
        localStorage.setItem(window.STORAGE_KEYS.SEARCH_PARCEL_DATA, JSON.stringify(data));
        console.log('✅ 검색 필지 데이터 저장 완료:', data.length, '개');
        return true;
    } catch (error) {
        console.error('🚨 검색 필지 데이터 저장 오류:', error);
        return false;
    }
};

// 색상 정보 관리 함수들
window.getClickParcelColors = function() {
    try {
        const data = localStorage.getItem(window.STORAGE_KEYS.CLICK_PARCEL_COLORS);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error('🚨 클릭 필지 색상 데이터 로드 오류:', error);
        return {};
    }
};

window.saveClickParcelColors = function(colors) {
    try {
        localStorage.setItem(window.STORAGE_KEYS.CLICK_PARCEL_COLORS, JSON.stringify(colors));
        console.log('✅ 클릭 필지 색상 데이터 저장 완료');
        return true;
    } catch (error) {
        console.error('🚨 클릭 필지 색상 데이터 저장 오류:', error);
        return false;
    }
};

window.getSearchParcelColors = function() {
    try {
        const data = localStorage.getItem(window.STORAGE_KEYS.SEARCH_PARCEL_COLORS);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error('🚨 검색 필지 색상 데이터 로드 오류:', error);
        return {};
    }
};

window.saveSearchParcelColors = function(colors) {
    try {
        localStorage.setItem(window.STORAGE_KEYS.SEARCH_PARCEL_COLORS, JSON.stringify(colors));
        console.log('✅ 검색 필지 색상 데이터 저장 완료');
        return true;
    } catch (error) {
        console.error('🚨 검색 필지 색상 데이터 저장 오류:', error);
        return false;
    }
};

// 기존 데이터 자동 마이그레이션 함수
window.migrateOldParcelData = function() {
    // 이미 마이그레이션 완료되었는지 확인
    if (localStorage.getItem(window.STORAGE_KEYS.MIGRATION_COMPLETED)) {
        console.log('✅ 필지 데이터 마이그레이션이 이미 완료됨');
        return;
    }

    console.log('🔄 기존 필지 데이터 마이그레이션 시작...');

    try {
        // 기존 parcelData 가져오기
        const oldData = localStorage.getItem('parcelData');
        if (!oldData || oldData === '[]' || oldData === 'null') {
            console.log('📝 마이그레이션할 기존 데이터가 없음');
            localStorage.setItem(window.STORAGE_KEYS.MIGRATION_COMPLETED, 'true');
            return;
        }

        const parcels = JSON.parse(oldData);
        console.log('📊 발견된 기존 필지:', parcels.length, '개');

        // 클릭 필지와 검색 필지 분리
        const clickParcels = [];
        const searchParcels = [];
        const clickColors = {};
        const searchColors = {};

        parcels.forEach(parcel => {
            // 보라색(#9370DB)이면 검색 필지, 아니면 클릭 필지
            if (parcel.color === '#9370DB' || parcel.colorType === 'search') {
                parcel.parcel_type = 'search';
                searchParcels.push(parcel);
                if (parcel.pnu || parcel.id) {
                    searchColors[parcel.pnu || parcel.id] = parcel.color;
                }
            } else {
                parcel.parcel_type = 'click';
                clickParcels.push(parcel);
                if (parcel.pnu || parcel.id) {
                    clickColors[parcel.pnu || parcel.id] = parcel.color;
                }
            }
        });

        // 새로운 저장소에 저장
        window.saveClickParcelData(clickParcels);
        window.saveSearchParcelData(searchParcels);
        window.saveClickParcelColors(clickColors);
        window.saveSearchParcelColors(searchColors);

        console.log(`✅ 마이그레이션 완료: 클릭 필지 ${clickParcels.length}개, 검색 필지 ${searchParcels.length}개`);

        // 마이그레이션 완료 플래그 저장
        localStorage.setItem(window.STORAGE_KEYS.MIGRATION_COMPLETED, 'true');

        // 기존 데이터는 백업으로 변경 (삭제하지 않고 보존)
        localStorage.setItem('parcelData_backup', oldData);
        console.log('📦 기존 데이터 백업 완료 (parcelData_backup)');

    } catch (error) {
        console.error('🚨 마이그레이션 오류:', error);
    }
};