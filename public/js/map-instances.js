/**
 * 모드별 독립 지도 인스턴스 관리
 * 3개의 독립된 네이버 지도 인스턴스를 생성하고 관리
 */

// 🗺️ 3개의 독립된 네이버 지도 인스턴스
window.mapClick = null;     // 클릭 모드 전용 지도
window.mapSearch = null;    // 검색 모드 전용 지도
window.mapHand = null;      // 손 모드 전용 지도

// 각 지도별 레이어 관리
const mapLayers = {
    click: {
        cadastral: null,
        street: null
    },
    search: {
        cadastral: null,
        street: null
    },
    hand: {
        cadastral: null,
        street: null
    }
};

// 공통 지도 옵션 생성
async function createMapOptions() {
    // 저장된 위치 정보 불러오기
    let center, zoom;

    try {
        if (window.SupabaseManager) {
            const savedPosition = await window.SupabaseManager.loadMapPosition();
            if (savedPosition && savedPosition.lat && savedPosition.lng) {
                center = new naver.maps.LatLng(savedPosition.lat, savedPosition.lng);
                zoom = savedPosition.zoom || CONFIG.MAP_DEFAULT_ZOOM;
                console.log('🗺️ Supabase에서 저장된 위치 로드:', savedPosition);
            }
        }
    } catch (error) {
        console.warn('⚠️ Supabase 위치 로드 실패, localStorage 시도:', error.message);
    }

    // localStorage에서 백업 위치 로드
    if (!center) {
        try {
            const savedPosition = JSON.parse(localStorage.getItem('mapPosition') || '{}');
            if (savedPosition.lat && savedPosition.lng) {
                center = new naver.maps.LatLng(savedPosition.lat, savedPosition.lng);
                zoom = savedPosition.zoom || CONFIG.MAP_DEFAULT_ZOOM;
                console.log('🗺️ localStorage에서 위치 로드:', savedPosition);
            }
        } catch (error) {
            console.warn('⚠️ localStorage 위치 로드 실패:', error.message);
        }
    }

    // 기본 위치 사용
    if (!center) {
        center = new naver.maps.LatLng(CONFIG.MAP_DEFAULT_CENTER.lat, CONFIG.MAP_DEFAULT_CENTER.lng);
        zoom = CONFIG.MAP_DEFAULT_ZOOM;
        console.log('🎯 기본 위치 사용:', CONFIG.MAP_DEFAULT_CENTER);
    }

    return {
        center: center,
        zoom: zoom,
        mapTypeId: naver.maps.MapTypeId.NORMAL,
        scaleControl: true,
        logoControl: true,
        mapDataControl: true,
        zoomControl: true,
        minZoom: 7,
        maxZoom: 19
    };
}

/**
 * 🎯 클릭 모드 지도 초기화
 */
async function initClickModeMap() {
    if (window.mapClick) return; // 이미 초기화됨

    try {
        const mapOptions = await createMapOptions();
        window.mapClick = new naver.maps.Map('map-click', mapOptions);

        // 레이어 초기화
        mapLayers.click.cadastral = new naver.maps.CadastralLayer();
        mapLayers.click.street = new naver.maps.StreetLayer();

        console.log('🎯 클릭 모드 지도 초기화 완료');

        // 🔧 클릭 모드 이벤트 핸들러 설정 (지연 실행)
        setTimeout(() => {
            if (window.setupClickModeEventListeners) {
                window.setupClickModeEventListeners();
                console.log('🎯 클릭 모드 이벤트 리스너 설정 완료');
            } else {
                console.warn('⚠️ setupClickModeEventListeners 함수가 아직 로드되지 않음');
                // 재시도
                setTimeout(() => {
                    if (window.setupClickModeEventListeners) {
                        window.setupClickModeEventListeners();
                        console.log('🎯 클릭 모드 이벤트 리스너 설정 완료 (재시도)');
                    }
                }, 500);
            }
        }, 500);

        return window.mapClick;
    } catch (error) {
        console.error('❌ 클릭 모드 지도 초기화 실패:', error);
        throw error;
    }
}

/**
 * 🔍 검색 모드 지도 초기화
 */
async function initSearchModeMap() {
    if (window.mapSearch) return; // 이미 초기화됨

    try {
        const mapOptions = await createMapOptions();
        window.mapSearch = new naver.maps.Map('map-search', mapOptions);

        // 레이어 초기화
        mapLayers.search.cadastral = new naver.maps.CadastralLayer();
        mapLayers.search.street = new naver.maps.StreetLayer();

        console.log('🔍 검색 모드 지도 초기화 완료');

        // 🔧 검색 모드 이벤트 핸들러 설정 (지연 실행)
        setTimeout(() => {
            if (window.setupSearchModeEventListeners) {
                window.setupSearchModeEventListeners();
                console.log('🔍 검색 모드 이벤트 리스너 설정 완료');
            } else {
                console.warn('⚠️ setupSearchModeEventListeners 함수가 아직 로드되지 않음');
            }
        }, 100);

        return window.mapSearch;
    } catch (error) {
        console.error('❌ 검색 모드 지도 초기화 실패:', error);
        throw error;
    }
}

/**
 * ✋ 손 모드 지도 초기화
 */
async function initHandModeMap() {
    if (window.mapHand) return; // 이미 초기화됨

    try {
        const mapOptions = await createMapOptions();
        window.mapHand = new naver.maps.Map('map-hand', mapOptions);

        // 레이어 초기화
        mapLayers.hand.cadastral = new naver.maps.CadastralLayer();
        mapLayers.hand.street = new naver.maps.StreetLayer();

        console.log('✋ 손 모드 지도 초기화 완료');

        // 손 모드는 폴리곤 없이 순수 탐색용
        return window.mapHand;
    } catch (error) {
        console.error('❌ 손 모드 지도 초기화 실패:', error);
        throw error;
    }
}

/**
 * 📍 지도 위치 동기화 (모드 전환 시)
 */
function syncMapPosition(fromMap, toMap) {
    if (!fromMap || !toMap) return;

    try {
        const center = fromMap.getCenter();
        const zoom = fromMap.getZoom();

        toMap.setCenter(center);
        toMap.setZoom(zoom);

        console.log('📍 지도 위치 동기화:', {
            lat: center.lat(),
            lng: center.lng(),
            zoom: zoom
        });
    } catch (error) {
        console.error('❌ 지도 위치 동기화 실패:', error);
    }
}

/**
 * 🗺️ 모드별 지도 타입 변경
 */
function setMapTypeForMode(mode, mapType) {
    const maps = {
        click: window.mapClick,
        search: window.mapSearch,
        hand: window.mapHand
    };

    const targetMap = maps[mode];
    if (!targetMap) return;

    const layers = mapLayers[mode];
    if (!layers) return;

    // 모든 레이어 제거
    layers.cadastral.setMap(null);
    layers.street.setMap(null);

    switch(mapType) {
        case 'normal':
            targetMap.setMapTypeId(naver.maps.MapTypeId.NORMAL);
            break;
        case 'satellite':
            targetMap.setMapTypeId(naver.maps.MapTypeId.HYBRID);
            break;
        case 'cadastral':
            targetMap.setMapTypeId(naver.maps.MapTypeId.NORMAL);
            layers.cadastral.setMap(targetMap);
            break;
        case 'street':
            // 거리뷰는 별도 처리
            break;
    }

    console.log(`🗺️ ${mode} 모드 지도 타입 변경: ${mapType}`);
}

/**
 * 🏗️ 모든 지도 인스턴스 초기화
 */
async function initAllMapInstances() {
    console.log('🏗️ 모든 지도 인스턴스 초기화 시작...');

    try {
        // 순차적으로 초기화
        await initClickModeMap();
        await initSearchModeMap();
        await initHandModeMap();

        console.log('✅ 모든 지도 인스턴스 초기화 완료!');

        // 지도 타입 변경 이벤트 리스너 설정
        setupMapTypeButtons();

        return {
            mapClick: window.mapClick,
            mapSearch: window.mapSearch,
            mapHand: window.mapHand
        };
    } catch (error) {
        console.error('❌ 지도 인스턴스 초기화 실패:', error);
        throw error;
    }
}

/**
 * 🎛️ 지도 타입 버튼 이벤트 설정
 */
function setupMapTypeButtons() {
    document.querySelectorAll('.map-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // 활성 버튼 변경
            document.querySelectorAll('.map-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const mapType = this.dataset.type;
            const currentMode = window.currentMode || 'click';

            // 현재 모드의 지도에 타입 적용
            setMapTypeForMode(currentMode, mapType);

            // 거리뷰 모드 처리
            if (mapType === 'street') {
                window.isStreetViewMode = true;
                console.log('🚶 거리뷰 모드 활성화');
            } else if (window.isStreetViewMode) {
                window.isStreetViewMode = false;
                document.getElementById('map-click').style.display = 'block';
                document.getElementById('map-search').style.display = 'block';
                document.getElementById('map-hand').style.display = 'block';
                document.getElementById('pano').style.display = 'none';
                console.log('🚶 거리뷰 모드 해제');
            }
        });
    });
}

/**
 * 현재 활성 지도 반환
 */
function getCurrentActiveMap() {
    const currentMode = window.currentMode || 'click';
    const maps = {
        click: window.mapClick,
        search: window.mapSearch,
        hand: window.mapHand
    };

    return maps[currentMode];
}

/**
 * 모드별 지도 인스턴스 반환
 */
function getMapByMode(mode) {
    const maps = {
        click: window.mapClick,
        search: window.mapSearch,
        hand: window.mapHand
    };

    return maps[mode];
}

// 전역 함수로 노출
window.initAllMapInstances = initAllMapInstances;
window.syncMapPosition = syncMapPosition;
window.getCurrentActiveMap = getCurrentActiveMap;
window.getMapByMode = getMapByMode;
window.setMapTypeForMode = setMapTypeForMode;

// 초기화 완료 후 자동 실행하지 않음 (mode-manager에서 호출)
console.log('🗺️ map-instances.js 로드 완료');