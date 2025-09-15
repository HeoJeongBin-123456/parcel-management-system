/**
 * 클릭 모드 전용 이벤트 핸들러
 * 필지 클릭, 색칠, 정보 저장 등 클릭 모드만의 로직 처리
 */

// 🎨 클릭 모드 전용 폴리곤 저장소
const clickModePolygons = new Map(); // PNU -> polygon 맵핑
const clickModeParcelData = new Map(); // PNU -> parcel data 맵핑

// clickParcels Map 초기화 (전역)
if (!window.clickParcels) {
    window.clickParcels = new Map();
}

// 디바운싱 타이머
let clickModeDebounceTimer = null;

/**
 * 🎯 클릭 모드 지도 이벤트 리스너 설정
 */
function setupClickModeEventListeners() {
    if (!window.mapClick) return;

    console.log('🎯 클릭 모드 이벤트 리스너 설정');

    // 왼쪽 클릭 이벤트 (필지 조회 및 색칠)
    naver.maps.Event.addListener(window.mapClick, 'click', function(e) {
        const coord = e.coord;
        console.log('🎨 클릭 모드 왼쪽 클릭 (색칠):', coord.lat(), coord.lng());

        // 거리뷰 모드 처리
        if (window.isStreetViewMode) {
            handleStreetViewClick(coord);
            return;
        }

        // 디바운싱 적용 (100ms로 단축 - 성능 개선)
        if (clickModeDebounceTimer) {
            clearTimeout(clickModeDebounceTimer);
        }

        clickModeDebounceTimer = setTimeout(() => {
            // 왼쪽 클릭: 색칠 기능
            handleClickModeLeftClick(coord.lat(), coord.lng());
        }, 100);
    });

    // 오른쪽 클릭 이벤트 (필지 삭제)
    naver.maps.Event.addListener(window.mapClick, 'rightclick', function(e) {
        e.originalEvent?.preventDefault();
        const coord = e.coord;

        console.log('🗑️ 클릭 모드 오른쪽 클릭 (삭제):', coord.lat(), coord.lng());
        handleClickModeRightClick(coord.lat(), coord.lng());
    });

    // 컨텍스트 메뉴 방지
    window.mapClick.getElement().addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
}

/**
 * 🏢 클릭 모드 전용 필지 정보 조회
 */
async function getParcelInfoForClickMode(lat, lng) {
    console.log(`🏢 클릭 모드 필지 정보 조회: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

    try {
        // 서버 프록시 우선 시도
        const result = await getParcelInfoViaProxyForClickMode(lat, lng);
        if (result) return;

        // 백업: JSONP 방식
        await getParcelInfoViaJSONPForClickMode(lat, lng);
    } catch (error) {
        console.error('❌ 클릭 모드 필지 조회 실패:', error);
        alert('필지 정보를 가져올 수 없습니다.');
    }
}

/**
 * 🚀 클릭 모드 - 서버 프록시를 통한 필지 조회
 */
async function getParcelInfoViaProxyForClickMode(lat, lng) {
    const geometry = `POINT(${lng} ${lat})`;
    const url = `/api/vworld-proxy?geomFilter=${encodeURIComponent(geometry)}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.response && data.response.status === 'OK' && data.response.result) {
            const features = data.response.result.featureCollection?.features;

            if (features && features.length > 0) {
                const feature = features[0];
                const pnu = feature.properties.PNU || feature.properties.pnu;
                const parcelData = {
                    pnu: pnu,  // PNU를 최상위에 추가
                    properties: feature.properties,
                    geometry: feature.geometry,
                    source: 'click',          // 🆕 클릭으로 추가됨
                    mode: 'click',           // 🆕 클릭 모드에서 저장됨
                    createdAt: Date.now()
                };

                // UI 업데이트
                displayParcelInfoForClickMode(parcelData);

                // 지번 자동 입력
                const jibun = formatJibun(feature.properties);
                if (jibun && document.getElementById('parcelNumber')) {
                    document.getElementById('parcelNumber').value = jibun;
                    console.log(`📝 지번 자동 입력: ${jibun}`);
                }

                // 폴리곤 그리기
                const polygon = await drawClickModeParcelPolygon(parcelData);
                if (polygon) {
                    // 현재 선택된 색상이 있으면 적용
                    const currentColor = getCurrentSelectedColor();
                    if (currentColor) {
                        polygon.setOptions({
                            fillColor: currentColor,
                            strokeColor: currentColor,
                            fillOpacity: 0.5
                        });
                        // 데이터에 색상 정보 추가
                        parcelData.color = currentColor;
                    }
                    // 데이터 저장
                    await saveClickModeParcelData(parcelData);
                    console.log(`💾 클릭 모드 필지 저장 완료: ${pnu}, 색상: ${currentColor}`);
                }

                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('❌ 클릭 모드 서버 프록시 호출 실패:', error);
        throw error;
    }
}

/**
 * 🔄 클릭 모드 - JSONP를 통한 필지 조회 (백업)
 */
async function getParcelInfoViaJSONPForClickMode(lat, lng) {
    // 기존 JSONP 로직을 클릭 모드용으로 수정
    // 여기서는 간단히 처리
    console.log('🔄 클릭 모드 JSONP 백업 시도');
    return false;
}

/**
 * 🎨 클릭 모드 전용 폴리곤 그리기
 */
async function drawClickModeParcelPolygon(parcelData, isRestored = false) {
    if (!parcelData.geometry || !parcelData.geometry.coordinates) {
        console.warn('⚠️ 클릭 모드: 폴리곤 좌표 데이터 없음');
        return null;
    }

    const pnu = parcelData.properties.PNU || parcelData.properties.pnu;

    // 기존 폴리곤 제거
    const existingPolygon = clickModePolygons.get(pnu);
    if (existingPolygon) {
        existingPolygon.setMap(null);
        clickModePolygons.delete(pnu);
    }

    try {
        // 좌표 변환 - GeoJSON 구조에 맞게 수정
        // coordinates[0][0]에 실제 좌표 배열이 있음
        let coordArray;
        if (parcelData.geometry.coordinates[0] && parcelData.geometry.coordinates[0][0]) {
            // 중첩 배열 구조인 경우
            coordArray = parcelData.geometry.coordinates[0][0];
        } else if (parcelData.geometry.coordinates[0]) {
            // 단일 배열 구조인 경우
            coordArray = parcelData.geometry.coordinates[0];
        } else {
            console.error('좌표 데이터 구조가 올바르지 않습니다');
            return null;
        }

        const coordinates = coordArray.map(coord =>
            new naver.maps.LatLng(coord[1], coord[0])
        );

        // 현재 선택된 색상 가져오기
        const currentColor = getCurrentSelectedColor() || '#FF0000';

        // 폴리곤 생성
        const polygon = new naver.maps.Polygon({
            map: window.mapClick,
            paths: coordinates,
            fillColor: currentColor,  // 현재 선택된 색상 사용
            strokeColor: currentColor,
            strokeWeight: 2,
            strokeOpacity: 0.8,
            fillOpacity: 0.5  // 더 잘 보이도록 불투명도 증가
        });

        // 클릭 이벤트 추가
        naver.maps.Event.addListener(polygon, 'click', async function(e) {
            e.cancelBubble = true; // 이벤트 전파 방지
            await toggleClickModeParcelSelection(parcelData, polygon);
        });

        // 저장
        clickModePolygons.set(pnu, polygon);
        clickModeParcelData.set(pnu, parcelData);

        console.log(`🎨 클릭 모드 폴리곤 생성: ${pnu}`);
        return polygon;

    } catch (error) {
        console.error('❌ 클릭 모드 폴리곤 생성 실패:', error);
        return null;
    }
}

/**
 * 🖱️ 클릭 모드 필지 선택/해제 토글
 */
async function toggleClickModeParcelSelection(parcel, polygon) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const jibun = formatJibun(parcel.properties);

    console.log(`🖱️ 클릭 모드 필지 선택: ${pnu}`);

    // 현재 색상 적용
    const currentColor = getCurrentSelectedColor();
    if (currentColor) {
        await applyClickModeColorToParcel(parcel, currentColor, polygon);
    }

    // UI 업데이트
    updateParcelFormForClickMode(parcel);
}

/**
 * 🎨 클릭 모드 색상 적용
 */
async function applyClickModeColor(parcelData, polygon) {
    const currentColor = getCurrentSelectedColor();
    if (!currentColor) return;

    await applyClickModeColorToParcel(parcelData, currentColor, polygon);
}

/**
 * 🎨 클릭 모드 필지에 색상 적용
 */
async function applyClickModeColorToParcel(parcel, color, polygon) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;

    try {
        // 같은 색상 재클릭 시 삭제 (토글)
        const currentParcelColor = await getParcelColorFromStorage(pnu);
        if (currentParcelColor === color) {
            console.log('🎨 클릭 모드: 같은 색상 토글 - 필지 삭제');
            await deleteClickModeParcel(pnu, polygon);
            return;
        }

        // 색상 적용
        polygon.setOptions({
            fillColor: color,
            fillOpacity: 0.5,
            strokeColor: color,
            strokeWeight: 2
        });

        // 데이터 저장 (새로운 스키마 필드 포함)
        const parcelDataWithSource = {
            ...parcel,
            source: 'click',           // 🆕 기존 호환용
            mode: 'click',             // 🆕 기존 호환용
            mode_source: 'click',      // 🆕 새 스키마: 생성 모드
            current_mode: 'click',     // 🆕 새 스키마: 현재 활성 모드
            color: color,
            updatedAt: Date.now()
        };

        // clickParcels Map에 추가
        if (window.clickParcels) {
            window.clickParcels.set(pnu, {
                parcel: parcelDataWithSource,
                polygon: polygon,
                color: color
            });
        }

        await saveClickModeParcelData(parcelDataWithSource);

        console.log(`🎨 클릭 모드 색상 적용: ${pnu} -> ${color}`);

    } catch (error) {
        console.error('❌ 클릭 모드 색상 적용 실패:', error);
    }
}

/**
 * 💾 클릭 모드 필지 데이터 저장
 */
async function saveClickModeParcelData(parcelData) {
    const pnu = parcelData.properties.PNU || parcelData.properties.pnu;

    try {
        // Supabase 저장 (새로운 스키마 필드 포함)
        if (window.SupabaseManager) {
            const jibun = formatJibun(parcelData.properties);
            await window.SupabaseManager.saveParcel(pnu, {
                parcelNumber: jibun,         // 🔺 supabase-config.js와 호환
                parcel_name: jibun,
                data: parcelData,
                geometry: parcelData.geometry,
                source: 'click',            // 🆕 기존 호환용
                mode: 'click',              // 🆕 기존 호환용
                mode_source: 'click',       // 🆕 새 스키마: 생성 모드
                current_mode: 'click',      // 🆕 새 스키마: 현재 활성 모드
                color: parcelData.color,
                created_at: new Date().toISOString()
            });
        }

        // LocalStorage 백업 - pnu를 포함한 완전한 데이터 구조 저장
        const savedData = JSON.parse(localStorage.getItem('parcelData') || '[]');
        const saveData = {
            pnu: pnu,
            properties: parcelData.properties,
            geometry: parcelData.geometry,
            color: parcelData.color,
            source: 'click',
            mode: 'click',
            updatedAt: Date.now()
        };

        const existingIndex = savedData.findIndex(item => item.pnu === pnu);
        if (existingIndex >= 0) {
            savedData[existingIndex] = saveData;
        } else {
            savedData.push(saveData);
        }

        localStorage.setItem('parcelData', JSON.stringify(savedData));

        // 색상 정보 저장
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
        parcelColors[pnu] = parcelData.color;
        localStorage.setItem('parcelColors', JSON.stringify(parcelColors));

        console.log(`💾 클릭 모드 데이터 저장: ${pnu}`);

    } catch (error) {
        console.error('❌ 클릭 모드 데이터 저장 실패:', error);
    }
}

/**
 * 🗑️ 클릭 모드 필지 삭제
 */
async function deleteClickModeParcel(pnu, polygon) {
    try {
        // 폴리곤 제거
        if (polygon) {
            polygon.setMap(null);
        }
        clickModePolygons.delete(pnu);
        clickModeParcelData.delete(pnu);

        // Supabase에서 삭제
        if (window.SupabaseManager) {
            await window.SupabaseManager.deleteParcel(pnu);
        }

        // LocalStorage에서 삭제
        const savedData = JSON.parse(localStorage.getItem('parcelData') || '[]');
        const filteredData = savedData.filter(item => item.pnu !== pnu);
        localStorage.setItem('parcelData', JSON.stringify(filteredData));

        // 색상 정보 삭제
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
        delete parcelColors[pnu];
        localStorage.setItem('parcelColors', JSON.stringify(parcelColors));

        console.log(`🗑️ 클릭 모드 필지 삭제: ${pnu}`);

    } catch (error) {
        console.error('❌ 클릭 모드 필지 삭제 실패:', error);
    }
}

/**
 * 📝 클릭 모드 UI 업데이트
 */
function displayParcelInfoForClickMode(parcelData) {
    // 기존 displayParcelInfo 로직 사용하되 클릭 모드 전용 처리
    if (typeof displayParcelInfo === 'function') {
        displayParcelInfo(parcelData);
    }
}

function updateParcelFormForClickMode(parcelData) {
    const pnu = parcelData.properties.PNU || parcelData.properties.pnu;
    const jibun = formatJibun(parcelData.properties);

    // 폼 업데이트
    document.getElementById('parcelNumber').value = jibun;
    window.currentSelectedPNU = pnu;
}

/**
 * 🎨 클릭 모드 왼쪽 클릭 처리 (색칠)
 */
async function handleClickModeLeftClick(lat, lng) {
    console.log('🎨 클릭 모드 왼쪽 클릭: 색칠 처리');

    try {
        // 필지 정보 조회 및 색칠
        await getParcelInfoForClickMode(lat, lng);
    } catch (error) {
        console.error('❌ 클릭 모드 색칠 실패:', error);
    }
}

/**
 * 🗑️ 클릭 모드 오른쪽 클릭 처리 (삭제)
 */
async function handleClickModeRightClick(lat, lng) {
    console.log('🗑️ 클릭 모드 오른쪽 클릭: 삭제 처리');

    try {
        // 클릭한 위치의 필지 찾기
        const clickedPoint = new naver.maps.LatLng(lat, lng);
        let targetPNU = null;
        let targetPolygon = null;

        // 저장된 모든 폴리곤 확인
        for (const [pnu, polygon] of clickModePolygons) {
            if (polygon && polygon.getMap()) {
                const paths = polygon.getPaths();
                const path = paths.getAt(0);

                // 폴리곤 내부 클릭 확인 - 자체 구현 함수 사용
                if (window.isPointInPolygon && window.isPointInPolygon(lat, lng, path)) {
                    targetPNU = pnu;
                    targetPolygon = polygon;
                    break;
                }
            }
        }

        // 필지를 찾았으면 삭제
        if (targetPNU && targetPolygon) {
            const confirmDelete = confirm('이 필지를 삭제하시겠습니까?');
            if (confirmDelete) {
                await deleteClickModeParcel(targetPNU, targetPolygon);
                console.log(`✅ 클릭 모드 필지 삭제 완료: ${targetPNU}`);
            }
        } else {
            console.log('⚠️ 클릭한 위치에 필지가 없습니다.');
        }
    } catch (error) {
        console.error('❌ 클릭 모드 삭제 실패:', error);
    }
}

/**
 * 🚶 거리뷰 클릭 처리
 */
function handleStreetViewClick(coord) {
    console.log('🚶 클릭 모드 거리뷰 클릭:', coord.lat(), coord.lng());

    // 지도 숨기고 파노라마 표시
    document.getElementById('map-click').style.display = 'none';
    document.getElementById('pano').style.display = 'block';

    // 파노라마 닫기 버튼 처리
    if (!document.querySelector('.pano-close-btn')) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'pano-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = function() {
            document.getElementById('map-click').style.display = 'block';
            document.getElementById('pano').style.display = 'none';
        };
        document.getElementById('pano').appendChild(closeBtn);
    }

    // 파노라마 생성/업데이트
    if (!window.panorama) {
        window.panorama = new naver.maps.Panorama('pano', {
            position: coord,
            pov: { pan: 0, tilt: 0, fov: 100 },
            logoControl: false,
            zoomControl: true,
            arrowControl: true
        });
    } else {
        window.panorama.setPosition(coord);
    }
}

/**
 * 🎨 현재 선택된 색상 가져오기
 */
function getCurrentSelectedColor() {
    return window.currentColor || null;
}

/**
 * 💾 저장소에서 필지 색상 조회
 */
async function getParcelColorFromStorage(pnu) {
    try {
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
        return parcelColors[pnu] || null;
    } catch (error) {
        console.error('❌ 필지 색상 조회 실패:', error);
        return null;
    }
}

/**
 * 📥 저장된 클릭 모드 필지 데이터 복원
 */
async function loadSavedClickModeParcels() {
    console.log('📥 클릭 모드 저장된 필지 복원 시작...');

    try {
        // LocalStorage에서 데이터 로드
        const savedParcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');

        let restoredCount = 0;

        for (const parcelData of savedParcels) {
            // 클릭 모드에서 생성된 필지만 복원
            if (parcelData.mode === 'click' || parcelData.source === 'click') {
                const pnu = parcelData.properties?.PNU || parcelData.properties?.pnu || parcelData.pnu;

                if (pnu && parcelData.geometry) {
                    // 폴리곤 그리기
                    const polygon = await drawClickModeParcelPolygon(parcelData, true);

                    if (polygon) {
                        // 저장된 색상 적용
                        const savedColor = parcelColors[pnu] || parcelData.color;
                        if (savedColor) {
                            polygon.setOptions({
                                fillColor: savedColor,
                                strokeColor: savedColor,
                                fillOpacity: 0.5,
                                strokeOpacity: 0.8
                            });
                        }

                        // clickParcels Map에 추가 (중요!)
                        if (window.clickParcels) {
                            window.clickParcels.set(pnu, {
                                parcel: parcelData,
                                polygon: polygon,
                                color: savedColor
                            });
                        }

                        // clickModePolygons와 clickModeParcelData에도 추가
                        clickModePolygons.set(pnu, polygon);
                        clickModeParcelData.set(pnu, parcelData);

                        restoredCount++;
                        console.log(`✅ 클릭 모드 필지 복원: ${pnu} (색상: ${savedColor})`);
                    }
                }
            }
        }

        console.log(`📥 클릭 모드 필지 복원 완료: ${restoredCount}개`);
        return restoredCount;

    } catch (error) {
        console.error('❌ 클릭 모드 필지 복원 실패:', error);
        return 0;
    }
}

// 전역 함수로 노출
window.setupClickModeEventListeners = setupClickModeEventListeners;
window.getParcelInfoForClickMode = getParcelInfoForClickMode;
window.clickModePolygons = clickModePolygons;
window.clickModeParcelData = clickModeParcelData;
window.loadSavedClickModeParcels = loadSavedClickModeParcels;
window.handleClickModeLeftClick = handleClickModeLeftClick;  // 테스트용 노출

console.log('🎯 mode-click-handler.js 로드 완료');