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
// 색상은 모드에 따라 결정: 검색 모드면 보라색, 클릭 모드면 빨간색
let currentColor = window.currentMode === 'search' ? '#9370DB' : window.CONFIG.COLORS.red;

// 필지 모드 관리 - window에 직접 정의 (localStorage에서 복원)
window.currentMode = localStorage.getItem('current_mode') || 'click'; // 'search' 또는 'click' - 기본값은 클릭 모드 (검색 OFF)
window.clickParcels = new Map(); // 클릭으로 선택한 필지 데이터 저장
window.searchParcels = new Map(); // 검색으로 찾은 필지 데이터 저장

// 하위 호환성을 위한 alias
window.parcels = window.clickParcels;
window.searchResults = window.searchParcels;

let searchResultsVisible = true;
window.currentSelectedPNU = null; // 현재 선택된 필지의 PNU (전역 변수로 변경)

// 필지 표시/숨김 관련 유틸리티 함수들
window.showClickParcels = function() {
    // console.log('클릭 필지 표시:', window.clickParcels.size, '개');
    window.clickParcels.forEach((parcel, key) => {
        if (parcel.polygon) parcel.polygon.setMap(map);
        if (parcel.label) parcel.label.setMap(map);
    });
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