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

        // 🔥 중요: MemoMarkerManager를 위해 window.map 설정
        window.map = window.mapClick;
        console.log('✅ window.map을 window.mapClick으로 설정');

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
 * 🔄 모드 전환 시 window.map 업데이트
 */
function updateWindowMapForMode(mode) {
    const oldMap = window.map;

    switch(mode) {
        case 'click':
            window.map = window.mapClick;
            console.log('✅ window.map을 window.mapClick으로 변경');
            break;
        case 'search':
            window.map = window.mapSearch;
            console.log('✅ window.map을 window.mapSearch로 변경');
            break;
        case 'hand':
            window.map = window.mapHand;
            console.log('✅ window.map을 window.mapHand로 변경');
            break;
        default:
            console.warn(`⚠️ 알 수 없는 모드: ${mode}`);
            return;
    }

    // MemoMarkerManager가 새 지도를 사용하도록 알림
    if (window.MemoMarkerManager && window.MemoMarkerManager.isInitialized) {
        console.log('🔄 MemoMarkerManager에 지도 변경 알림');
        // 마커들을 새 지도로 이동
        if (window.MemoMarkerManager.markers) {
            window.MemoMarkerManager.markers.forEach(markerInfo => {
                if (markerInfo.marker && oldMap) {
                    // 기존 지도에서 제거
                    markerInfo.marker.setMap(null);
                    // 새 지도에 추가
                    markerInfo.marker.setMap(window.map);
                }
            });
        }
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

                // 현재 활성 지도에 StreetLayer 추가
                const currentMap = getCurrentActiveMap();
                if (currentMap) {
                    // 모드별 StreetLayer 관리
                    if (!window.streetLayers) {
                        window.streetLayers = {
                            click: null,
                            search: null,
                            hand: null
                        };
                    }

                    // 기존 StreetLayer가 있으면 제거
                    if (window.streetLayers[currentMode]) {
                        window.streetLayers[currentMode].setMap(null);
                        window.streetLayers[currentMode] = null;
                    }

                    // 새 StreetLayer 생성 및 추가
                    try {
                        window.streetLayers[currentMode] = new naver.maps.StreetLayer();
                        window.streetLayers[currentMode].setMap(currentMap);
                        console.log(`🚶 거리뷰 레이어 활성화 (${currentMode} 모드) - 파란 선을 클릭하세요`);

                        // 거리뷰 선 클릭 이벤트 등록
                        setupStreetViewClickEvent(currentMap, currentMode);
                    } catch (error) {
                        console.error('거리뷰 레이어 생성 실패:', error);
                    }
                }
            } else if (window.isStreetViewMode) {
                window.isStreetViewMode = false;

                // 모든 모드의 StreetLayer 제거
                if (window.streetLayers) {
                    Object.keys(window.streetLayers).forEach(mode => {
                        if (window.streetLayers[mode]) {
                            window.streetLayers[mode].setMap(null);
                            window.streetLayers[mode] = null;
                        }
                    });
                }

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

/**
 * 거리뷰 클릭 이벤트 설정
 */
function setupStreetViewClickEvent(map, mode) {
    // 기존 이벤트 리스너 제거 (중복 방지)
    if (window.streetViewClickListener && window.streetViewClickListener[mode]) {
        naver.maps.Event.removeListener(window.streetViewClickListener[mode]);
    }

    if (!window.streetViewClickListener) {
        window.streetViewClickListener = {};
    }

    // 지도 클릭 이벤트 등록
    window.streetViewClickListener[mode] = naver.maps.Event.addListener(map, 'click', function(e) {
        // 거리뷰 모드가 활성화되어 있을 때만
        if (window.isStreetViewMode && window.streetLayers && window.streetLayers[mode]) {
            const coord = e.coord;

            // 파노라마 열기
            openPanorama(coord.lat(), coord.lng());
        }
    });
}

/**
 * 파노라마 열기
 */
function openPanorama(lat, lng) {
    console.log(`🚶 파노라마 열기: ${lat}, ${lng}`);

    // 모든 지도 숨기기
    document.getElementById('map-click').style.display = 'none';
    document.getElementById('map-search').style.display = 'none';
    document.getElementById('map-hand').style.display = 'none';

    // 파노라마 레이어 표시
    const panoElement = document.getElementById('pano');
    if (!panoElement) {
        console.error('파노라마 엘리먼트를 찾을 수 없습니다');
        return;
    }

    // 기존 닫기 버튼 제거
    const existingCloseBtn = panoElement.querySelector('.pano-close-btn');
    if (existingCloseBtn) {
        existingCloseBtn.remove();
    }

    // 파노라마 엘리먼트 스타일 설정 - 각 속성을 개별적으로 설정
    panoElement.style.setProperty('display', 'block', 'important');
    panoElement.style.setProperty('width', '100vw', 'important');
    panoElement.style.setProperty('height', '100vh', 'important');
    panoElement.style.setProperty('position', 'fixed', 'important');
    panoElement.style.setProperty('top', '0', 'important');
    panoElement.style.setProperty('left', '0', 'important');
    panoElement.style.setProperty('z-index', '10000', 'important');
    panoElement.style.setProperty('background-color', '#000', 'important');

    // 잠시 대기 후 파노라마 초기화 (DOM 렌더링 대기)
    setTimeout(() => {
        try {
            // 기존 파노라마 인스턴스 정리
            if (window.pano) {
                window.pano = null;
            }

            // 새 파노라마 생성
            window.pano = new naver.maps.Panorama(panoElement, {
                position: new naver.maps.LatLng(lat, lng),
                pov: {
                    pan: 0,
                    tilt: 0,
                    fov: 100
                },
                visible: true,
                minZoom: 0,
                maxZoom: 3,
                flightSpot: true,
                aroundControl: true,
                zoomControl: true
            });

            // 파노라마 로드 완료 이벤트
            naver.maps.Event.addListener(window.pano, 'pano_changed', function() {
                console.log('✅ 파노라마 로드 완료');
                // 파노라마 로드 후 display 확실히 설정
                const panoEl = document.getElementById('pano');
                if (panoEl) {
                    panoEl.style.setProperty('display', 'block', 'important');
                }
            });

            // 파노라마 에러 이벤트
            naver.maps.Event.addListener(window.pano, 'pano_error', function() {
                console.error('❌ 파노라마 로드 실패');
                alert('이 위치에서는 거리뷰를 사용할 수 없습니다.');
                closePanorama();
            });

            // 파노라마 닫기 버튼 추가
            addPanoramaCloseButton();

            console.log('✅ 파노라마 초기화 성공');

            // 파노라마 초기화 후 display 확실히 설정
            panoElement.style.setProperty('display', 'block', 'important');
        } catch (error) {
            console.error('파노라마 초기화 실패:', error);
            alert('거리뷰를 사용할 수 없습니다.\n' + error.message);
            closePanorama();
        }
    }, 100);
}

/**
 * 파노라마 닫기 버튼 추가
 */
function addPanoramaCloseButton() {
    if (document.querySelector('.pano-close-btn')) {
        return; // 이미 버튼이 있으면 중복 추가하지 않음
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pano-close-btn';
    closeBtn.innerHTML = '✖';
    closeBtn.title = '거리뷰 닫기';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        background: white;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        z-index: 10001;
        display: block;
        line-height: 40px;
        text-align: center;
    `;

    closeBtn.addEventListener('click', closePanorama);
    document.getElementById('pano').appendChild(closeBtn);
}

/**
 * 파노라마 닫기
 */
function closePanorama() {
    console.log('🚶 파노라마 닫기');

    // 파노라마 숨기기
    const panoElement = document.getElementById('pano');
    if (panoElement) {
        panoElement.style.display = 'none';
    }

    // 현재 모드의 지도 다시 표시
    const currentMode = window.currentMode || 'click';
    document.getElementById(`map-${currentMode}`).style.display = 'block';

    // 닫기 버튼 제거
    const closeBtn = document.querySelector('.pano-close-btn');
    if (closeBtn) {
        closeBtn.remove();
    }
}

// 전역 함수로 노출
window.initAllMapInstances = initAllMapInstances;
window.syncMapPosition = syncMapPosition;
window.getCurrentActiveMap = getCurrentActiveMap;
window.getMapByMode = getMapByMode;
window.setMapTypeForMode = setMapTypeForMode;
window.updateWindowMapForMode = updateWindowMapForMode;
window.openPanorama = openPanorama;
window.closePanorama = closePanorama;

// 초기화 완료 후 자동 실행하지 않음 (mode-manager에서 호출)
console.log('🗺️ map-instances.js 로드 완료');