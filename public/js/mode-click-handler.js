/**
 * 클릭 모드 전용 이벤트 핸들러
 * 필지 클릭, 색칠, 정보 저장 등 클릭 모드만의 로직 처리
 */

// Geometry 중심점 계산 함수
function getGeometryCenter(geometry) {
    if (!geometry) {
        return [0, 0];
    }

    if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
        return [geometry.coordinates[0], geometry.coordinates[1]];
    }

    if (geometry.coordinates) {
        let coordinates = geometry.coordinates;

        // MultiPolygon 처리: 첫 번째 폴리곤의 첫 번째 링 사용
        if (geometry.type === 'MultiPolygon' && coordinates.length > 0) {
            coordinates = coordinates[0]; // 첫 번째 폴리곤 선택
        }

        // Polygon 처리: 첫 번째 링(외곽) 사용
        if ((geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') && coordinates.length > 0) {
            coordinates = coordinates[0]; // 외곽 링 선택
        }

        // 이제 coordinates는 [[lng, lat], [lng, lat], ...] 형태
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
            return [0, 0];
        }

        let totalX = 0;
        let totalY = 0;
        let count = 0;

        // 단순 배열 순회
        for (const coord of coordinates) {
            if (Array.isArray(coord) && coord.length >= 2) {
                totalX += coord[0];
                totalY += coord[1];
                count++;
            }
        }

        if (count === 0) {
            return [0, 0];
        }

        return [totalX / count, totalY / count];
    }

    return [0, 0];
}

// 🎨 클릭 모드 전용 폴리곤 저장소
const clickModePolygons = new Map(); // PNU -> polygon 맵핑
const clickModeParcelData = new Map(); // PNU -> parcel data 맵핑

// clickParcels Map 초기화 (전역)
if (!window.clickParcels) {
    window.clickParcels = new Map();
}

// 이전 색상 추적을 위한 변수
let previousSelectedColor = null;

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
    naver.maps.Event.addListener(window.mapClick, 'rightclick', async function(e) {
        e.originalEvent?.preventDefault();
        const coord = e.coord;

        console.log('🗑️ 클릭 모드 오른쪽 클릭 (삭제):', coord.lat(), coord.lng());
        await handleClickModeRightClick(coord.lat(), coord.lng());
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
        const success = await getParcelInfoViaProxyForClickMode(lat, lng);
        if (!success) {
            console.warn('⚠️ 클릭 모드 필지 데이터를 찾지 못했습니다.');
            alert('필지 정보를 가져올 수 없습니다.');
        }
    } catch (error) {
        console.error('❌ 클릭 모드 필지 조회 실패:', error);
        alert('필지 정보를 가져올 수 없습니다.');
    }
}

/**
 * 🚀 클릭 모드 - 서버 프록시를 통한 필지 조회
 */
async function getParcelInfoViaProxyForClickMode(lat, lng) {
    if (!window.vworldApi || typeof window.vworldApi.fetchFeatures !== 'function') {
        throw new Error('VWorld API 헬퍼가 초기화되지 않았습니다.');
    }

    const geometry = `POINT(${lng} ${lat})`;

    try {
        const features = await window.vworldApi.fetchFeatures({
            geomFilter: geometry,
            size: '1'
        });

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

                // UI 초기화 및 지번 설정
                if (typeof window.resetParcelFormFields === 'function') {
                    window.resetParcelFormFields();
                }
                displayParcelInfoForClickMode(parcelData);

                const jibun = formatJibun(feature.properties);
                if (jibun && document.getElementById('parcelNumber')) {
                    document.getElementById('parcelNumber').value = jibun;
                    console.log(`📝 지번 자동 입력: ${jibun}`);
                }

                window.currentSelectedPNU = pnu;
                // 현재 선택된 색상 가져오기
                const selectedColor = getCurrentSelectedColor() || 'transparent';
                window.selectedParcel = {
                    ...parcelData,
                    parcelNumber: jibun || parcelData.parcelNumber || '',
                    ownerName: '',
                    ownerAddress: '',
                    ownerContact: '',
                    memo: '',
                    color: selectedColor  // 현재 선택된 색상 사용
                };
                window.currentSelectedParcel = window.selectedParcel;

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

                    // 🔥 중요: window.clickParcels Map에 데이터 저장 (saveClickParcelInfo에서 필요)
                    if (!window.clickParcels) {
                        window.clickParcels = new Map();
                    }
                    window.clickParcels.set(pnu, {
                        polygon: polygon,
                        data: parcelData,    // 'data' 키로 저장 (parcel.js와 호환)
                        parcel: parcelData,  // 'parcel' 키로도 저장 (mode-click-handler와 호환)
                        color: currentColor || 'transparent'  // 현재 선택된 색상 저장
                    });
                    console.log('✅ window.clickParcels에 저장:', pnu);

                    // 데이터 저장
                    await saveClickModeParcelData(parcelData);
                    console.log(`💾 클릭 모드 필지 저장 완료: ${pnu}, 색상: ${currentColor}`);
                }

            return true;
        }

        return false;
    } catch (error) {
        console.error('❌ 클릭 모드 서버 프록시 호출 실패:', error);
        throw error;
    }
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

        // 색상 결정: 복원 시에는 저장된 색상, 그렇지 않으면 현재 선택된 색상
        let polygonColor;
        if (isRestored && parcelData.color) {
            // 복원 시: 저장된 색상 사용
            polygonColor = parcelData.color;
            console.log(`🎨 복원 시 저장된 색상 사용: ${polygonColor}`);
        } else {
            // 새로 그릴 때: 현재 선택된 색상 사용
            polygonColor = getCurrentSelectedColor() || '#FF0000';
            console.log(`🎨 새로 그릴 때 현재 색상 사용: ${polygonColor}`);
        }

        // 폴리곤 생성
        const polygon = new naver.maps.Polygon({
            map: window.mapClick,
            paths: coordinates,
            fillColor: polygonColor,
            strokeColor: polygonColor,
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
    const pnu = parcel.properties?.PNU || parcel.properties?.pnu || parcel.pnu;

    try {
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
        ParcelColorStorage.setHex(pnu, parcelData.color);

        // 삭제 목록에서 제거 (재색칠 = 활성화)
        if (window.removeFromDeletedParcels) {
            window.removeFromDeletedParcels(pnu);
            console.log(`🔄 클릭 모드: 삭제 목록에서 제거: ${pnu}`);
        }

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
        console.log(`🗑️ 클릭 모드 필지 삭제 시작: ${pnu}`);

        // 1. 삭제 추적 시스템에 추가
        if (window.addToDeletedParcels) {
            window.addToDeletedParcels(pnu);
            console.log('✅ 삭제 추적 시스템에 추가');
        }

        // 2. 폴리곤 제거
        if (polygon) {
            polygon.setMap(null);
            console.log('✅ 폴리곤 지도에서 제거');
        }

        // 3. 메모리 맵에서 제거
        clickModePolygons.delete(pnu);
        clickModeParcelData.delete(pnu);

        // window.clickParcels에서도 제거 (중요!)
        if (window.clickParcels) {
            window.clickParcels.delete(pnu);
            console.log('✅ window.clickParcels에서 제거');
        }

        // 4. Supabase에서 삭제
        if (window.SupabaseManager && window.SupabaseManager.deleteParcel) {
            await window.SupabaseManager.deleteParcel(pnu);
            console.log('✅ Supabase에서 삭제');
        }

        // 5. 모든 LocalStorage에서 완전 삭제 (utils.js 헬퍼 함수 사용)
        if (window.removeParcelFromAllStorage) {
            const removed = window.removeParcelFromAllStorage(pnu, { removeColor: true }); // 색상도 함께 삭제
            console.log(`✅ 총 ${removed}개 항목이 모든 localStorage에서 제거됨`);
        }

        // 6. 마커 제거
        if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
            const markerInfo = window.MemoMarkerManager.markers.get(pnu);
            if (markerInfo && markerInfo.marker) {
                markerInfo.marker.setMap(null);
                window.MemoMarkerManager.markers.delete(pnu);
                console.log('✅ 마커 제거');
            }
        }

        // 7. UI 업데이트 (현재 선택된 필지라면)
        if (window.currentSelectedPNU === pnu) {
            // 폼 초기화
            const fields = ['parcelNumber', 'ownerName', 'ownerAddress', 'ownerContact', 'memo'];
            fields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) field.value = '';
            });
            window.currentSelectedPNU = null;
            console.log('✅ UI 폼 초기화');
        }

        console.log(`✅ 클릭 모드 필지 완전 삭제 완료: ${pnu}`);

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

    // PNU가 변경되었는지 확인 (다른 필지 클릭)
    const previousPNU = window.currentSelectedPNU;
    const isNewParcel = previousPNU !== pnu;

    // 지번 업데이트
    document.getElementById('parcelNumber').value = jibun;
    window.currentSelectedPNU = pnu;

    // 다른 필지를 클릭한 경우 나머지 필드 초기화
    if (isNewParcel) {
        console.log(`🔄 다른 필지 선택: ${previousPNU} → ${pnu}, 필드 초기화`);

        // 나머지 필드들 초기화
        const fieldsToReset = ['ownerName', 'ownerAddress', 'ownerContact', 'memo'];
        fieldsToReset.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
            }
        });

        // 해당 필지의 저장된 데이터가 있으면 불러오기
        try {
            // LocalStorage에서 데이터 확인
            const savedData = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const savedParcel = savedData.find(item => item.pnu === pnu);

            if (savedParcel) {
                // 저장된 데이터가 있으면 폼에 채우기
                console.log(`📥 저장된 데이터 로드: ${pnu}`);

                if (savedParcel.ownerName && document.getElementById('ownerName')) {
                    document.getElementById('ownerName').value = savedParcel.ownerName;
                }
                if (savedParcel.ownerAddress && document.getElementById('ownerAddress')) {
                    document.getElementById('ownerAddress').value = savedParcel.ownerAddress;
                }
                if (savedParcel.ownerContact && document.getElementById('ownerContact')) {
                    document.getElementById('ownerContact').value = savedParcel.ownerContact;
                }
                if (savedParcel.memo && document.getElementById('memo')) {
                    document.getElementById('memo').value = savedParcel.memo;
                }
            } else {
                console.log(`📭 저장된 데이터 없음: ${pnu} (빈 폼 유지)`);
            }
        } catch (error) {
            console.error('❌ 저장된 데이터 로드 실패:', error);
        }
    } else {
        console.log(`🔁 같은 필지 재클릭: ${pnu} (필드 유지)`);
    }
}

/**
 * 🎨 클릭 모드 왼쪽 클릭 처리 (색칠)
 */
async function handleClickModeLeftClick(lat, lng) {
    console.log('🎨 클릭 모드 왼쪽 클릭: 색칠 처리');

    try {
        // 먼저 클릭한 위치에 이미 필지가 있는지 확인
        const clickedPoint = new naver.maps.LatLng(lat, lng);
        let existingPNU = null;
        let existingPolygon = null;
        let existingParcelData = null;

        // window.clickParcels에서 먼저 확인
        if (window.clickParcels && window.clickParcels.size > 0) {
            for (const [pnu, data] of window.clickParcels) {
                if (data && data.polygon) {
                    const paths = data.polygon.getPaths();
                    if (paths && paths.length > 0) {
                        const path = paths.getAt(0);
                        // 폴리곤 내부 클릭 확인
                        if (window.isPointInPolygon && window.isPointInPolygon(lat, lng, path)) {
                            existingPNU = pnu;
                            existingPolygon = data.polygon;
                            existingParcelData = data.parcel || data.data;
                            console.log('✅ 기존 필지 발견 (clickParcels):', pnu);
                            break;
                        }
                    }
                }
            }
        }

        // clickModePolygons에서도 확인
        if (!existingPNU && clickModePolygons.size > 0) {
            for (const [pnu, polygon] of clickModePolygons) {
                if (polygon && polygon.getMap()) {
                    const paths = polygon.getPaths();
                    if (paths && paths.length > 0) {
                        const path = paths.getAt(0);
                        // 폴리곤 내부 클릭 확인
                        if (window.isPointInPolygon && window.isPointInPolygon(lat, lng, path)) {
                            existingPNU = pnu;
                            existingPolygon = polygon;
                            existingParcelData = clickModeParcelData.get(pnu);
                            console.log('✅ 기존 필지 발견 (clickModePolygons):', pnu);
                            break;
                        }
                    }
                }
            }
        }

        // 기존 필지가 있으면 색상 적용
        if (existingPNU && existingPolygon && existingParcelData) {
            const currentColor = getCurrentSelectedColor();
            console.log('🎨 기존 필지에 색상 적용:', existingPNU, '현재 색상:', currentColor);

            // parcel.js의 applyColorToParcel 함수 호출
            if (window.applyColorToParcel && typeof window.applyColorToParcel === 'function') {
                // applyColorToParcel이 기대하는 형식으로 데이터 구조 확인/변환
                let parcelToPass = existingParcelData;

                // properties 속성이 없으면 생성
                if (!parcelToPass.properties) {
                    parcelToPass = {
                        properties: {
                            PNU: existingPNU,
                            pnu: existingPNU
                        },
                        geometry: existingParcelData.geometry || null,
                        pnu: existingPNU,
                        ...existingParcelData
                    };
                }

                // PNU가 properties에 없으면 추가
                if (!parcelToPass.properties.PNU && !parcelToPass.properties.pnu) {
                    parcelToPass.properties.PNU = existingPNU;
                    parcelToPass.properties.pnu = existingPNU;
                }

                console.log('📦 applyColorToParcel에 전달할 데이터:', {
                    pnu: parcelToPass.properties?.PNU || parcelToPass.properties?.pnu,
                    hasProperties: !!parcelToPass.properties,
                    hasGeometry: !!parcelToPass.geometry
                });

                await window.applyColorToParcel(parcelToPass, currentColor);
                console.log('✅ applyColorToParcel 호출 완료');

                // 🆕 UI 업데이트 - 지번을 필지 정보 폼에 자동 입력
                updateParcelFormForClickMode(parcelToPass);
                console.log('📝 기존 필지 UI 업데이트 완료');
            } else {
                // 폴백: 직접 토글 처리
                await applyClickModeColorToParcel(existingParcelData, currentColor, existingPolygon);

                // 🆕 UI 업데이트 - 지번을 필지 정보 폼에 자동 입력
                updateParcelFormForClickMode(existingParcelData);
                console.log('📝 기존 필지 UI 업데이트 완료 (폴백)');
            }
        } else {
            // 새로운 필지 조회 및 생성
            console.log('🆕 새로운 필지 조회 시작');
            await getParcelInfoForClickMode(lat, lng);
        }
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
 * 🎨 색상 변경 감지 및 이전 색상 필지 제거
 */
async function handleColorChange() {
    const currentColor = getCurrentSelectedColor();

    // 색상이 실제로 변경되었는지 확인
    if (previousSelectedColor && previousSelectedColor !== currentColor) {
        console.log('🎨 색상 변경 감지:', previousSelectedColor, '->', currentColor);
        await removeParcelsWithColor(previousSelectedColor);
    }

    // 현재 색상을 이전 색상으로 업데이트
    previousSelectedColor = currentColor;
}

/**
 * 🗑️ 특정 색상의 모든 필지 제거
 */
async function removeParcelsWithColor(colorToRemove) {
    if (!colorToRemove) return;

    console.log('🗑️ 클릭 모드: 색상 변경으로 인한 기존 필지 제거 시작:', colorToRemove);

    const parcelsToRemove = [];

    // window.clickParcels에서 해당 색상의 필지들 찾기
    if (window.clickParcels) {
        for (const [pnu, parcelInfo] of window.clickParcels) {
            // 저장소에서 해당 필지의 색상 확인
            const storedColor = await getParcelColorFromStorage(pnu);
            if (storedColor === colorToRemove) {
                parcelsToRemove.push({ pnu, parcelInfo });
            }
        }
    }

    // clickModePolygons에서도 확인
    for (const [pnu, polygon] of clickModePolygons) {
        const storedColor = await getParcelColorFromStorage(pnu);
        if (storedColor === colorToRemove) {
            const parcelInfo = window.clickParcels?.get(pnu);
            if (!parcelsToRemove.find(item => item.pnu === pnu)) {
                parcelsToRemove.push({ pnu, parcelInfo: parcelInfo || { polygon } });
            }
        }
    }

    // 찾은 필지들 제거
    let removedCount = 0;
    for (const { pnu, parcelInfo } of parcelsToRemove) {
        try {
            await deleteClickModeParcel(pnu, parcelInfo?.polygon);
            removedCount++;
        } catch (error) {
            console.error('❌ 필지 제거 실패:', pnu, error);
        }
    }

    console.log(`✅ 색상 변경: ${colorToRemove} 색상의 필지 ${removedCount}개 제거 완료`);
}

/**
 * 💾 저장소에서 필지 색상 조회
 */
async function getParcelColorFromStorage(pnu) {
    try {
        const hex = ParcelColorStorage.getHex(pnu);
        return hex || null;
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
    console.error('🚨 [DEBUG] loadSavedClickModeParcels 함수 진입');

    try {
        console.error('🚨 [DEBUG] try 블록 진입');
        console.log('🔍 LocalStorage 접근 시도...');

        // 삭제된 필지 목록 가져오기
        const deletedParcels = window.getDeletedParcels ? window.getDeletedParcels() : [];
        if (deletedParcels.length > 0) {
            console.log(`🗑️ 삭제된 필지 ${deletedParcels.length}개는 복원하지 않음`);
        }

        // LocalStorage에서 데이터 로드 (clickParcelData 우선, parcelData 대체)
        const clickParcels = JSON.parse(localStorage.getItem('clickParcelData') || '[]');
        const normalParcels = JSON.parse(localStorage.getItem('parcelData') || '[]');

        // 두 데이터 병합 (중복 제거)
        const pnuSet = new Set();
        const savedParcels = [];

        // clickParcelData 먼저 처리
        for (const parcel of clickParcels) {
            // isMinimalData 플래그가 있는 항목은 건너뛰기 (삭제된 정보)
            if (parcel.isMinimalData === true) {
                console.log(`⏩ 최소 데이터 필지 복원 제외: ${parcel.pnu}`);
                continue;
            }

            const pnu = parcel.pnu || parcel.id;

            // 삭제된 필지는 건너뛰기
            if (deletedParcels.includes(pnu)) {
                console.log(`⏩ 삭제된 필지 복원 제외: ${pnu}`);
                continue;
            }

            if (pnu && !pnuSet.has(pnu)) {
                pnuSet.add(pnu);

                // clickParcelData의 항목은 mode와 source를 클릭 모드로 설정
                parcel.mode = parcel.mode || 'click';
                parcel.source = parcel.source || 'click';

                // geometry에서 좌표 추출
                if (!parcel.lat || !parcel.lng) {
                    if (parcel.geometry && parcel.geometry.coordinates) {
                        // getGeometryCenter 함수 사용하여 중심점 계산
                        const [centerLng, centerLat] = getGeometryCenter(parcel.geometry);

                        // 좌표가 유효한 경우 (둘 다 0이 아닌 경우)
                        if (centerLng !== 0 && centerLat !== 0) {
                            parcel.lng = centerLng;
                            parcel.lat = centerLat;
                            console.log(`📍 좌표 추출 성공: ${parcel.pnu} - lat:${parcel.lat}, lng:${parcel.lng}`);
                        } else {
                            console.warn(`⚠️ 좌표 추출 실패: ${parcel.pnu} - centerLng:${centerLng}, centerLat:${centerLat}`);
                        }
                    }
                }
                savedParcels.push(parcel);
            }
        }

        // parcelData 추가 (중복 제외)
        for (const parcel of normalParcels) {
            // isMinimalData 플래그가 있는 항목은 건너뛰기 (삭제된 정보)
            if (parcel.isMinimalData === true) {
                console.log(`⏩ 최소 데이터 필지 복원 제외: ${parcel.pnu}`);
                continue;
            }

            const pnu = parcel.pnu || parcel.id;

            // 삭제된 필지 체크 - geometry가 있으면 색상/폴리곤 복원용으로 포함
            if (deletedParcels.includes(pnu)) {
                if (parcel.geometry && parcel.color) {
                    console.log(`🎨 삭제된 필지의 색상/폴리곤 복원: ${pnu}`);
                    // geometry와 color만 있는 필지는 포함 (정보는 없지만 색상은 유지)
                } else {
                    console.log(`⏩ 삭제된 필지 복원 제외 (완전 삭제): ${pnu}`);
                    continue;
                }
            }

            if (pnu && !pnuSet.has(pnu)) {
                pnuSet.add(pnu);
                savedParcels.push(parcel);
            }
        }

        const parcelColors = ParcelColorStorage.getAll();

        console.log(`📦 LocalStorage에서 ${savedParcels.length}개 필지 로드 (clickParcelData: ${clickParcels.length}, parcelData: ${normalParcels.length})`);

        let restoredCount = 0;
        let skippedCount = 0;

        for (const parcelData of savedParcels) {
            console.log(`🔍 필지 확인 중:`, {
                pnu: parcelData.pnu,
                mode: parcelData.mode,
                source: parcelData.source,
                hasGeometry: !!parcelData.geometry,
                color: parcelData.color
            });

            // 클릭 모드에서 생성된 필지만 복원
            if (parcelData.mode === 'click' || parcelData.source === 'click') {
                const pnu = parcelData.properties?.PNU || parcelData.properties?.pnu || parcelData.pnu;

                console.log(`✅ 클릭 모드 필지 발견: ${pnu}`);

                if (pnu && parcelData.geometry) {
                    // 저장된 색상 정보를 parcelData에 추가
                    const savedColorIndex = parcelColors.get(pnu);
                    const savedColor = typeof savedColorIndex === 'number'
                        ? ParcelColorStorage.palette[savedColorIndex]?.hex || parcelData.color
                        : parcelData.color;
                    if (savedColor) {
                        parcelData.color = savedColor;
                        console.log(`🎨 필지 ${pnu}의 저장된 색상 복원: ${savedColor}`);
                    }

                    // drawClickModeParcelPolygon이 properties.PNU를 기대하므로 데이터 구조 조정
                    const structuredData = {
                        ...parcelData,
                        properties: parcelData.properties || {
                            PNU: pnu,
                            JIBUN: parcelData.parcelNumber || parcelData.jibun,
                            ...parcelData
                        }
                    };

                    // 폴리곤 그리기 (색상 정보가 포함된 parcelData 전달)
                    console.log(`🎯 drawClickModeParcelPolygon 호출: ${pnu}, isRestored=true`);
                    const polygon = await drawClickModeParcelPolygon(structuredData, true);

                    if (polygon) {
                        console.log(`✅ 폴리곤 생성 성공: ${pnu}`);
                        // 색상은 이미 drawClickModeParcelPolygon에서 적용됨

                        // clickParcels Map에 추가 (중요!)
                        if (window.clickParcels) {
                            window.clickParcels.set(pnu, {
                                parcel: parcelData,
                                polygon: polygon,
                                color: parcelData.color  // parcelData.color 사용
                            });
                        }

                        // clickModePolygons와 clickModeParcelData에도 추가
                        clickModePolygons.set(pnu, polygon);
                        clickModeParcelData.set(pnu, parcelData);

                        restoredCount++;
                        console.log(`✅ 클릭 모드 필지 복원: ${pnu} (색상: ${savedColor})`);

                        // 👍 마커 생성 조건 확인 (최소 데이터인 경우 마커 생성하지 않음)
                        if (window.MemoMarkerManager && !parcelData.isMinimalData) {
                            const hasRealInfo = !!(
                                (parcelData.memo && parcelData.memo.trim()) ||
                                (parcelData.ownerName && parcelData.ownerName.trim())
                            );

                            // 좌표가 없으면 geometry에서 다시 추출 시도
                            if (!parcelData.lat || !parcelData.lng) {
                                if (parcelData.geometry && parcelData.geometry.coordinates) {
                                    const [centerLng, centerLat] = getGeometryCenter(parcelData.geometry);

                                    // 좌표가 유효한 경우 (둘 다 0이 아닌 경우)
                                    if (centerLng !== 0 && centerLat !== 0) {
                                        parcelData.lng = centerLng;
                                        parcelData.lat = centerLat;
                                        console.log(`📍 마커용 좌표 추출: ${pnu} - lat:${parcelData.lat}, lng:${parcelData.lng}`);
                                    }
                                }
                            }

                            if (hasRealInfo && parcelData.lat && parcelData.lng) {
                                window.MemoMarkerManager.createOrUpdateMarker(parcelData);
                                console.log('🎯 MemoMarkerManager로 마커 복원:', pnu);
                            } else if (!parcelData.lat || !parcelData.lng) {
                                console.warn(`⚠️ 좌표가 없어 마커 생성 불가: ${pnu}`);
                            } else {
                                console.log(`✅ 조건 충족으로 마커 복원: ${pnu}`);
                            }
                        }
                    }
                } else {
                    console.log(`⚠️ 필지 복원 조건 불충족: pnu=${pnu}, hasGeometry=${!!parcelData.geometry}`);
                }
            } else {
                skippedCount++;
                console.log(`⏩ 클릭 모드가 아닌 필지 건너뜀: mode=${parcelData.mode}, source=${parcelData.source}`);
            }
        }

        console.log(`📥 클릭 모드 필지 복원 완료: ${restoredCount}개 복원, ${skippedCount}개 건너뜀`);
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
window.handleColorChange = handleColorChange;  // 색상 팔레트에서 호출용

console.log('🎯 mode-click-handler.js 로드 완료');
