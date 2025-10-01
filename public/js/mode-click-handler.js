/**
 * 클릭 모드 전용 이벤트 핸들러
 * 필지 클릭, 색칠, 정보 저장 등 클릭 모드만의 로직 처리
 */

/* global displayParcelInfo */

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

const clickModeGeometryCache = window.ClickModeGeometryCache || new Map();
window.ClickModeGeometryCache = clickModeGeometryCache;

const clickModeSaveTimers = window.__clickModeSaveTimers || new Map();
window.__clickModeSaveTimers = clickModeSaveTimers;

const CLICK_MODE_SAVE_DELAY = 120;

const CLICK_MODE_CACHE_MAX_AGE = 60 * 60 * 1000; // 1시간

const clickModeStorageState = window.__clickModeStorageState || {
    savedData: null,
    savedDataIndex: null,
    lastSync: 0
};
window.__clickModeStorageState = clickModeStorageState;

function getClickModeSavedState() {
    if (!Array.isArray(clickModeStorageState.savedData)) {
        let parsed = [];
        try {
            const raw = localStorage.getItem('parcelData');
            if (raw) {
                const candidate = JSON.parse(raw);
                if (Array.isArray(candidate)) {
                    parsed = candidate;
                }
            }
        } catch (error) {
            console.warn('⚠️ parcelData 파싱 실패, 캐시 초기화:', error);
        }
        clickModeStorageState.savedData = parsed;
        clickModeStorageState.savedDataIndex = null;
    }

    if (!(clickModeStorageState.savedDataIndex instanceof Map)) {
        const indexMap = new Map();
        clickModeStorageState.savedData.forEach((item, idx) => {
            const pnuKey = item?.pnu || item?.properties?.PNU || item?.properties?.pnu;
            if (pnuKey) {
                if (!indexMap.has(pnuKey)) {
                    indexMap.set(pnuKey, idx);
                }
            }
        });
        clickModeStorageState.savedDataIndex = indexMap;
    }

    return clickModeStorageState;
}

function persistClickModeSavedState() {
    if (!Array.isArray(clickModeStorageState.savedData)) {
        clickModeStorageState.savedData = [];
    }
    try {
        localStorage.setItem('parcelData', JSON.stringify(clickModeStorageState.savedData));
    } catch (error) {
        console.error('❌ parcelData 저장 실패:', error);
    }
}

function hasClickModeSavedEntry(pnu) {
    if (!pnu) {
        return false;
    }
    const state = getClickModeSavedState();
    return state.savedDataIndex instanceof Map && state.savedDataIndex.has(pnu);
}

function upsertClickModeSavedEntry(pnu, saveData) {
    if (!pnu) {
        return;
    }

    const state = getClickModeSavedState();
    const indexMap = state.savedDataIndex;
    const savedList = state.savedData;

    if (!(indexMap instanceof Map)) {
        state.savedDataIndex = new Map();
    }

    const targetIndex = indexMap instanceof Map ? indexMap.get(pnu) : undefined;
    if (typeof targetIndex === 'number') {
        savedList[targetIndex] = saveData;
    } else {
        const insertIndex = savedList.length;
        savedList.push(saveData);
        state.savedDataIndex.set(pnu, insertIndex);
    }

    persistClickModeSavedState();
}

function cloneParcelData(parcelData) {
    if (!parcelData) {
        return null;
    }

    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(parcelData);
        } catch (error) {
            console.warn('⚠️ structuredClone 실패, JSON 기반 복제로 대체:', error);
        }
    }

    try {
        return JSON.parse(JSON.stringify(parcelData));
    } catch (error) {
        console.warn('⚠️ JSON 기반 복제 실패, 얕은 복사로 대체:', error);
        return { ...parcelData };
    }
}

function scheduleClickModeParcelPersist(parcelData) {
    if (!parcelData) {
        return;
    }

    const pnu = parcelData.properties?.PNU || parcelData.properties?.pnu || parcelData.pnu;
    if (!pnu) {
        return;
    }

    const existing = clickModeSaveTimers.get(pnu);
    if (existing) {
        if (existing.type === 'idle' && typeof window.cancelIdleCallback === 'function') {
            window.cancelIdleCallback(existing.handle);
        } else {
            clearTimeout(existing.handle);
        }
    }

    const payload = cloneParcelData(parcelData);
    const runner = () => {
        clickModeSaveTimers.delete(pnu);
        saveClickModeParcelData(payload)
            .catch(error => console.error('❌ 클릭 모드 지연 저장 실패:', error));
    };

    if (typeof window.requestIdleCallback === 'function') {
        const handle = window.requestIdleCallback(() => runner(), { timeout: 500 });
        clickModeSaveTimers.set(pnu, { type: 'idle', handle });
    } else {
        const handle = window.setTimeout(runner, CLICK_MODE_SAVE_DELAY);
        clickModeSaveTimers.set(pnu, { type: 'timeout', handle });
    }
}

function computeSimplePathBounds(simplePath) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const point of simplePath) {
        if (point.lat < minLat) minLat = point.lat;
        if (point.lat > maxLat) maxLat = point.lat;
        if (point.lng < minLng) minLng = point.lng;
        if (point.lng > maxLng) maxLng = point.lng;
    }

    return {
        minLat,
        maxLat,
        minLng,
        maxLng
    };
}

function getCachedGeometryEntry(pnu, geometry) {
    if (!geometry) {
        return null;
    }

    const ring = typeof window.getPrimaryRingCoordinates === 'function'
        ? window.getPrimaryRingCoordinates(geometry)
        : null;

    if (!ring || ring.length === 0) {
        return null;
    }

    const cacheKey = JSON.stringify(ring);
    const existing = clickModeGeometryCache.get(pnu);
    if (existing && existing.cacheKey === cacheKey) {
        return existing;
    }

    const latLngPath = [];
    const simplePath = [];

    for (const coord of ring) {
        if (!Array.isArray(coord) || coord.length < 2) {
            continue;
        }
        const lng = Number(coord[0]);
        const lat = Number(coord[1]);
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            continue;
        }

        simplePath.push({ lat, lng });
        latLngPath.push(new naver.maps.LatLng(lat, lng));
    }

    if (latLngPath.length === 0) {
        return null;
    }

    const bounds = computeSimplePathBounds(simplePath);
    const entry = {
        cacheKey,
        latLngPath,
        simplePath,
        bounds
    };

    clickModeGeometryCache.set(pnu, entry);

    if (typeof window.cacheParcelFeature === 'function') {
        window.cacheParcelFeature({
            properties: {
                PNU: pnu,
                pnu: pnu
            },
            geometry: geometry
        });
    }

    return entry;
}

function getFeatureFromCache(lat, lng) {
    if (typeof window.findParcelFeatureByPoint !== 'function') {
        return null;
    }

    return window.findParcelFeatureByPoint(lat, lng);
}

function getStoredParcelContext(pnu) {
    if (!pnu) {
        return { parcel: null, color: null };
    }

    const context = { parcel: null, color: null };

    const mergeCandidate = candidate => {
        if (!candidate) return;
        const parcelSource = candidate.parcel || candidate.data || candidate;
        if (parcelSource) {
            context.parcel = context.parcel ? { ...context.parcel, ...parcelSource } : { ...parcelSource };
            if (!context.color && parcelSource.color && parcelSource.color !== 'transparent') {
                context.color = parcelSource.color;
            }
        }
        if (!context.color && candidate.color && candidate.color !== 'transparent') {
            context.color = candidate.color;
        }
    };

    if (window.clickParcels && window.clickParcels.has(pnu)) {
        mergeCandidate(window.clickParcels.get(pnu));
    }

    if (clickModeParcelData.has(pnu)) {
        mergeCandidate({ parcel: clickModeParcelData.get(pnu) });
    }

    if (!context.parcel) {
        try {
            const stored = JSON.parse(localStorage.getItem('parcelData') || '[]');
            const found = stored.find(item => item && (item.pnu === pnu || item?.properties?.PNU === pnu || item?.properties?.pnu === pnu));
            if (found) {
                mergeCandidate({ parcel: found });
            }
        } catch (error) {
            console.warn('⚠️ 기존 필지 데이터 로드 실패:', error);
        }
    }

    if (!context.color && window.ParcelColorStorage && typeof window.ParcelColorStorage.getHex === 'function') {
        const hex = window.ParcelColorStorage.getHex(pnu);
        if (hex) {
            context.color = hex;
        }
    }

    return context;
}

// clickParcels Map 초기화 (전역)
if (!window.clickParcels) {
    window.clickParcels = new Map();
}

// 이전 색상 추적을 위한 변수
let previousSelectedColor = null;

/**
 * 🎯 클릭 모드 지도 이벤트 리스너 설정
 */
function setupClickModeEventListeners() {
    if (!window.mapClick) return;

    if (window.__clickModeListenersInitialized) {
        console.log('🎯 클릭 모드 이벤트 리스너가 이미 설정되어 있습니다.');
        return;
    }
    window.__clickModeListenersInitialized = true;

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

        // 즉시 실행 (디바운스 제거 - 최대 반응 속도)
        handleClickModeLeftClick(coord.lat(), coord.lng());
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

async function getParcelInfoForHandMode(lat, lng) {
    console.log(`✋ 손 모드 필지 정보 조회: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

    try {
        const success = await getParcelInfoViaProxyForClickMode(lat, lng, {
            skipColoring: true,
            sourceMode: 'hand'
        });
        if (!success) {
            console.warn('⚠️ 손 모드에서 필지 데이터를 찾지 못했습니다.');
            alert('필지 정보를 가져올 수 없습니다.');
        }
    } catch (error) {
        console.error('❌ 손 모드 필지 조회 실패:', error);
        alert('필지 정보를 가져올 수 없습니다.');
    }
}

window.getParcelInfoForHandMode = getParcelInfoForHandMode;

/**
 * 🚀 클릭 모드 - 서버 프록시를 통한 필지 조회
 */
async function getParcelInfoViaProxyForClickMode(lat, lng, options = {}) {
    if (!window.vworldApi || typeof window.vworldApi.fetchFeatures !== 'function') {
        throw new Error('VWorld API 헬퍼가 초기화되지 않았습니다.');
    }

    const resolvedOptions = options || {};
    const skipColoring = !!resolvedOptions.skipColoring;
    const sourceMode = resolvedOptions.sourceMode || (skipColoring ? 'hand' : 'click');

    const geometry = `POINT(${lng} ${lat})`;

    try {
        let featureRecord = getFeatureFromCache(lat, lng);
        let feature = featureRecord ? featureRecord.feature : null;
        let featureSource = 'cache';

        if (!feature) {
            const features = await window.vworldApi.fetchFeatures({
                geomFilter: geometry,
                size: '1'
            });

            if (features && features.length > 0) {
                feature = features[0];
                featureSource = 'network';

                if (typeof window.cacheParcelFeature === 'function') {
                    window.cacheParcelFeature(feature);
                }
            }
        } else {
            console.log('⚡️ 캐시된 필지 데이터를 사용합니다.');
        }

        if (feature) {
            if (typeof window.cacheParcelFeature === 'function') {
                window.cacheParcelFeature(feature);
            }

            const pnu = feature.properties.PNU || feature.properties.pnu;
            console.log(`📦 필지 데이터 소스(${featureSource}):`, pnu);

            // 삭제된 필지인지 확인
            const deletedParcels = window.getDeletedParcels ? window.getDeletedParcels() : [];
            console.log('📋 삭제된 필지 목록:', deletedParcels);
            console.log('🔍 현재 필지 PNU:', pnu);
            if (deletedParcels.includes(pnu)) {
                console.log(`♻️ 삭제된 필지(${pnu})를 복원 시도`);
                if (typeof window.removeFromDeletedParcels === 'function') {
                    window.removeFromDeletedParcels(pnu);
                }
            }

            const parcelData = {
                pnu: pnu,
                properties: feature.properties,
                geometry: feature.geometry,
                source: 'click',
                mode: 'click',
                createdAt: Date.now()
            };

            const jibun = formatJibun(feature.properties);
            if (jibun) {
                parcelData.parcelNumber = jibun;
            }

            const storedContext = getStoredParcelContext(pnu);
            const existingParcel = storedContext.parcel;
            const existingColor = storedContext.color;

            if (skipColoring) {
                return await handleHandModeParcelSelection(
                    {
                        ...parcelData,
                        color: existingColor || parcelData.color || null
                    },
                    {
                        existingParcel,
                        existingColor,
                        sourceMode,
                        jibunOverride: jibun
                    }
                );
            }

            if (typeof window.resetParcelFormFields === 'function') {
                window.resetParcelFormFields();
            }

            const paletteColor = getCurrentSelectedColor();
            const initialColor = paletteColor || existingColor || 'transparent';

            const selectedParcel = {
                ...(existingParcel || {}),
                ...parcelData,
                parcelNumber: jibun || existingParcel?.parcelNumber || parcelData.parcelNumber || '',
                ownerName: existingParcel?.ownerName || '',
                ownerAddress: existingParcel?.ownerAddress || '',
                ownerContact: existingParcel?.ownerContact || '',
                memo: existingParcel?.memo || '',
                color: initialColor
            };

            displayParcelInfoForClickMode(selectedParcel);

            if (jibun && document.getElementById('parcelNumber')) {
                document.getElementById('parcelNumber').value = jibun;
                console.log(`📝 지번 자동 입력: ${jibun}`);
            }

            window.currentSelectedPNU = pnu;
            window.selectedParcel = selectedParcel;
            window.currentSelectedParcel = selectedParcel;

            const polygon = await drawClickModeParcelPolygon(selectedParcel, { colorOverride: selectedParcel.color });
            if (polygon) {
                if (!window.clickParcels) {
                    window.clickParcels = new Map();
                }

                const storedColorValue = selectedParcel.color && selectedParcel.color !== 'transparent'
                    ? selectedParcel.color
                    : null;

                window.clickParcels.set(pnu, {
                    polygon,
                    data: selectedParcel,
                    parcel: selectedParcel,
                    color: storedColorValue
                });
                clickModeParcelData.set(pnu, { ...selectedParcel, color: storedColorValue });

                scheduleClickModeParcelPersist({ ...selectedParcel, color: storedColorValue });
                console.log(`💾 클릭 모드 필지 저장 예약 완료: ${pnu}, 색상: ${storedColorValue || '없음'}`);
            }

            return true;
        }

        return false;
    } catch (error) {
        console.error('❌ 클릭 모드 서버 프록시 호출 실패:', error);
        throw error;
    }
}

async function handleHandModeParcelSelection(parcelData, context = {}) {
    const { existingParcel = null, existingColor = null, jibunOverride = null } = context;
    const pnu = parcelData.properties.PNU || parcelData.properties.pnu;

    const jibun = jibunOverride || parcelData.parcelNumber || formatJibun(parcelData.properties) || '';

    if (typeof window.resetParcelFormFields === 'function') {
        window.resetParcelFormFields();
    }

    const selectedParcel = {
        ...(existingParcel || {}),
        ...parcelData,
        parcelNumber: jibun || existingParcel?.parcelNumber || parcelData.parcelNumber || '',
        ownerName: existingParcel?.ownerName || '',
        ownerAddress: existingParcel?.ownerAddress || '',
        ownerContact: existingParcel?.ownerContact || '',
        memo: existingParcel?.memo || '',
        color: existingColor || parcelData.color || null,
        source: 'click',
        mode: 'click'
    };

    if (selectedParcel.color === 'transparent') {
        selectedParcel.color = null;
    }

    displayParcelInfoForClickMode(selectedParcel);

    if (jibun && document.getElementById('parcelNumber')) {
        document.getElementById('parcelNumber').value = jibun;
        console.log(`📝 손 모드 지번 자동 입력: ${jibun}`);
    }

    window.currentSelectedPNU = pnu;
    window.selectedParcel = selectedParcel;
    window.currentSelectedParcel = selectedParcel;

    updateParcelFormForClickMode(selectedParcel);

    let polygon = null;
    if (selectedParcel.geometry) {
        polygon = await drawClickModeParcelPolygon(selectedParcel, {
            colorOverride: selectedParcel.color || null,
            skipColoring: true,
            isRestored: !!(selectedParcel.color && selectedParcel.color !== 'transparent'),
            targetMap: window.map || window.mapHand || window.mapClick || null
        });
    }

    if (!window.clickParcels) {
        window.clickParcels = new Map();
    }

    window.clickParcels.set(pnu, {
        polygon,
        data: selectedParcel,
        parcel: selectedParcel,
        color: selectedParcel.color || null
    });

    clickModeParcelData.set(pnu, selectedParcel);

    scheduleClickModeParcelPersist(selectedParcel);

    console.log(`✋ 손 모드 필지 정보 로드 완료: ${pnu}`);
    return true;
}

/**
 * 🎨 클릭 모드 전용 폴리곤 그리기
 */
async function drawClickModeParcelPolygon(parcelData, options = {}) {
    if (!parcelData || !parcelData.geometry || !parcelData.geometry.coordinates) {
        console.warn('⚠️ 클릭 모드: 폴리곤 좌표 데이터 없음');
        return null;
    }

    let normalizedOptions = options;
    if (typeof options === 'boolean') {
        normalizedOptions = { isRestored: options };
    }

    const {
        isRestored = false,
        colorOverride = null,
        skipColoring = false,
        targetMap
    } = normalizedOptions || {};

    const pnu = parcelData.properties.PNU || parcelData.properties.pnu;

    const geometryEntry = getCachedGeometryEntry(pnu, parcelData.geometry);
    if (!geometryEntry || !Array.isArray(geometryEntry.latLngPath) || geometryEntry.latLngPath.length === 0) {
        console.warn('⚠️ 클릭 모드: 캐시된 폴리곤 경로가 없습니다.');
        return null;
    }

    let polygonColor = colorOverride;
    if (!polygonColor) {
        if ((isRestored || skipColoring) && parcelData.color) {
            polygonColor = parcelData.color;
            console.log(`🎨 저장된 색상 사용: ${polygonColor}`);
        } else if (skipColoring) {
            polygonColor = 'transparent';
            console.log('🎨 색상 적용 없이 폴리곤을 유지합니다.');
        } else {
            polygonColor = getCurrentSelectedColor() || parcelData.color || '#FF0000';
            console.log(`🎨 현재 선택된 색상 사용: ${polygonColor}`);
        }
    }

    const hasVisibleColor = polygonColor && polygonColor !== 'transparent';
    const activeMap = targetMap !== undefined ? targetMap : (window.map || window.mapClick || null);

    let polygon = clickModePolygons.get(pnu) || null;

    if (polygon && typeof polygon.setPaths === 'function') {
        polygon.setPaths(geometryEntry.latLngPath);
        if (polygon.getMap && polygon.getMap() !== activeMap) {
            polygon.setMap(activeMap);
        }
    } else {
        polygon = new naver.maps.Polygon({
            map: activeMap,
            paths: geometryEntry.latLngPath,
            fillColor: hasVisibleColor ? polygonColor : 'transparent',
            strokeColor: hasVisibleColor ? polygonColor : '#FF5500',
            strokeWeight: hasVisibleColor ? 2 : 1,
            strokeOpacity: hasVisibleColor ? 0.8 : 0,
            fillOpacity: hasVisibleColor ? 0.5 : 0
        });

        naver.maps.Event.addListener(polygon, 'click', async function(e) {
            e.cancelBubble = true;
            const currentMode = window.ModeManager && typeof window.ModeManager.getCurrentMode === 'function'
                ? window.ModeManager.getCurrentMode()
                : 'click';
            const latestParcel = clickModeParcelData.get(pnu) || parcelData;

            if (currentMode === 'hand') {
                window.currentSelectedPNU = pnu;
                window.currentSelectedParcel = latestParcel;
                window.selectedParcel = latestParcel;
                displayParcelInfoForClickMode(latestParcel);
                updateParcelFormForClickMode(latestParcel);
            } else {
                await toggleClickModeParcelSelection(latestParcel, polygon);
            }
        });
    }

    const baseOptions = hasVisibleColor ? {
        fillColor: polygonColor,
        fillOpacity: 0.5,
        strokeColor: polygonColor,
        strokeWeight: 2,
        strokeOpacity: 0.8
    } : {
        fillColor: 'transparent',
        fillOpacity: 0,
        strokeColor: '#FF5500',
        strokeWeight: 1,
        strokeOpacity: 0
    };

    polygon.setOptions(baseOptions);
    polygon.__clickModeFillColor = hasVisibleColor ? polygonColor : 'transparent';
    polygon.__clickModeCacheKey = geometryEntry.cacheKey;

    clickModePolygons.set(pnu, polygon);
    const storedColor = hasVisibleColor ? polygonColor : null;
    clickModeParcelData.set(pnu, { ...parcelData, color: storedColor });

    console.log(`🎨 클릭 모드 폴리곤 준비 완료: ${pnu}`);
    return polygon;
}

/**
 * 🖱️ 클릭 모드 필지 선택/해제 토글
 */
async function toggleClickModeParcelSelection(parcel, polygon) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;

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
 * 🎨 클릭 모드 필지에 색상 적용
 */
async function applyClickModeColorToParcel(parcel, color, polygon) {
    const pnu = parcel.properties?.PNU || parcel.properties?.pnu || parcel.pnu;

    if (!pnu) {
        console.warn('⚠️ 색상 적용 대상 PNU를 찾지 못했습니다.');
        return;
    }

    if (!polygon || typeof polygon.setOptions !== 'function') {
        console.warn('⚠️ 색상 적용 대상 폴리곤이 없습니다:', pnu);
        return;
    }

    try {
        const normalizedColor = color || getCurrentSelectedColor() || '#FF0000';

        if (polygon.__clickModeFillColor !== normalizedColor) {
            polygon.setOptions({
                fillColor: normalizedColor,
                fillOpacity: 0.5,
                strokeColor: normalizedColor,
                strokeWeight: 2
            });
            polygon.__clickModeFillColor = normalizedColor;
        }

        const parcelDataWithSource = {
            ...parcel,
            source: 'click',
            mode: 'click',
            mode_source: 'click',
            current_mode: 'click',
            color: normalizedColor,
            updatedAt: Date.now()
        };

        if (window.clickParcels) {
            const existing = window.clickParcels.get(pnu) || {};
            window.clickParcels.set(pnu, {
                ...existing,
                parcel: parcelDataWithSource,
                data: parcelDataWithSource,
                polygon,
                color: normalizedColor
            });
        }

        clickModeParcelData.set(pnu, parcelDataWithSource);

        let colorIndex = null;
        if (window.ColorPaletteManager && Array.isArray(window.ColorPaletteManager.colors)) {
            const matched = window.ColorPaletteManager.colors.find(item => item && typeof item.hex === 'string' && item.hex.toLowerCase() === normalizedColor.toLowerCase());
            if (matched) {
                colorIndex = matched.index;
                if (typeof window.ColorPaletteManager.applyColorToParcel === 'function') {
                    window.ColorPaletteManager.applyColorToParcel(pnu, colorIndex);
                }
            }
        }

        if (colorIndex === null) {
            if (typeof queueColorSave === 'function') {
                queueColorSave(pnu, normalizedColor, null);
            } else if (window.ParcelColorStorage && typeof window.ParcelColorStorage.setHex === 'function') {
                window.ParcelColorStorage.setHex(pnu, normalizedColor);
            }
        }

        if (!hasClickModeSavedEntry(pnu)) {
            scheduleClickModeParcelPersist(parcelDataWithSource);
        }

        console.log(`🎨 클릭 모드 색상 적용 완료: ${pnu} -> ${normalizedColor}`);

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
        const state = getClickModeSavedState();
        const savedData = state.savedData;
        const indexMap = state.savedDataIndex instanceof Map ? state.savedDataIndex : new Map();
        if (!(state.savedDataIndex instanceof Map)) {
            state.savedDataIndex = indexMap;
        }
        const existingIndex = indexMap.has(pnu) ? indexMap.get(pnu) : -1;
        const existingEntry = existingIndex >= 0 ? savedData[existingIndex] : null;

        let clickParcelList = [];
        let existingClickIndex = -1;
        let existingClickEntry = null;
        if (typeof window.getClickParcelData === 'function') {
            clickParcelList = window.getClickParcelData();
            existingClickIndex = clickParcelList.findIndex(item => item.pnu === pnu);
            existingClickEntry = existingClickIndex >= 0 ? clickParcelList[existingClickIndex] : null;
        }

        const selectString = (...values) => {
            for (const value of values) {
                if (typeof value === 'string' && value.trim() !== '') {
                    return value.trim();
                }
            }
            return '';
        };

        const coalesceNumber = (...values) => {
            for (const value of values) {
                if (value !== undefined && value !== null && value !== '') {
                    const numeric = typeof value === 'number' ? value : parseFloat(value);
                    if (!Number.isNaN(numeric)) {
                        return numeric;
                    }
                }
            }
            return null;
        };

        const mergedProperties = {
            ...(existingEntry?.properties || existingClickEntry?.properties || {}),
            ...(parcelData.properties || {})
        };
        const mergedGeometry = parcelData.geometry || existingEntry?.geometry || existingClickEntry?.geometry || null;

        let lat = coalesceNumber(parcelData.lat, existingEntry?.lat, existingClickEntry?.lat);
        let lng = coalesceNumber(parcelData.lng, existingEntry?.lng, existingClickEntry?.lng);

        if ((lat === null || lng === null) && mergedGeometry) {
            const [centerLng, centerLat] = getGeometryCenter(mergedGeometry);
            if ((centerLat || centerLat === 0) && (centerLng || centerLng === 0)) {
                lat = coalesceNumber(centerLat, lat);
                lng = coalesceNumber(centerLng, lng);
            }
        }

        const baseData = existingEntry ? { ...existingEntry } : existingClickEntry ? { ...existingClickEntry } : {};

        const mergedParcel = {
            ...baseData,
            ...parcelData,
            pnu: pnu,
            properties: mergedProperties,
            geometry: mergedGeometry,
            lat: lat,
            lng: lng,
            memo: selectString(parcelData.memo, baseData.memo, existingClickEntry?.memo),
            ownerName: selectString(parcelData.ownerName, baseData.ownerName, existingClickEntry?.ownerName),
            ownerAddress: selectString(parcelData.ownerAddress, baseData.ownerAddress, existingClickEntry?.ownerAddress),
            ownerContact: selectString(parcelData.ownerContact, baseData.ownerContact, existingClickEntry?.ownerContact),
            color: parcelData.color ?? baseData.color ?? null,
            source: 'click',
            mode: 'click',
            parcel_type: baseData.parcel_type || parcelData.parcel_type || 'click',
            updatedAt: Date.now()
        };

        const jibun = selectString(
            formatJibun(mergedProperties),
            parcelData.parcelNumber,
            baseData.parcelNumber,
            existingClickEntry?.parcelNumber
        );

        mergedParcel.parcelNumber = jibun;
        mergedParcel.parcel_name = selectString(mergedParcel.parcel_name, jibun);

        // 🔍 필지 검증: 색칠 또는 필지 정보가 있는지 확인
        if (window.ParcelValidationUtils && !window.ParcelValidationUtils.isParcelWorthSaving(mergedParcel)) {
            console.warn('⚠️ [클릭 모드 저장 거부] 색칠도 없고 필지 정보도 없는 빈 필지:', pnu);
            window.ParcelValidationUtils.updateStats(false);
            return false;
        }

        window.ParcelValidationUtils.updateStats(true);
        console.log('✅ [클릭 모드 저장 검증 통과]', pnu);

        // Supabase 저장 (병합 데이터 사용)
        if (window.SupabaseManager) {
            await window.SupabaseManager.saveParcel(pnu, {
                parcelNumber: jibun,
                parcel_name: jibun,
                data: mergedParcel,
                geometry: mergedParcel.geometry,
                source: 'click',
                mode: 'click',
                mode_source: 'click',
                current_mode: 'click',
                color: mergedParcel.color,
                created_at: new Date().toISOString()
            });
        }

        const saveData = { ...mergedParcel };

        if (existingIndex >= 0) {
            savedData[existingIndex] = saveData;
        } else {
            const insertIndex = savedData.length;
            savedData.push(saveData);
            if (indexMap instanceof Map) {
                indexMap.set(pnu, insertIndex);
            }
        }

        persistClickModeSavedState();

        if (typeof window.setClickParcelDataToStorage === 'function') {
            if (existingClickIndex >= 0) {
                clickParcelList[existingClickIndex] = {
                    ...clickParcelList[existingClickIndex],
                    ...saveData
                };
            } else {
                clickParcelList.push({ ...saveData });
            }

            window.setClickParcelDataToStorage(clickParcelList);
        }

        if (clickModeParcelData) {
            const existingParcelData = clickModeParcelData.get(pnu) || {};
            clickModeParcelData.set(pnu, {
                ...existingParcelData,
                ...saveData
            });
        }

        if (window.clickParcels) {
            const entry = window.clickParcels.get(pnu) || {};
            window.clickParcels.set(pnu, {
                ...entry,
                parcel: {
                    ...(entry.parcel || {}),
                    ...saveData
                },
                data: {
                    ...(entry.data || {}),
                    ...saveData
                },
                color: saveData.color ?? entry.color ?? null
            });
        }

        if (window.selectedParcel) {
            const selectedPnu = window.selectedParcel.pnu || window.selectedParcel.properties?.PNU || window.selectedParcel.properties?.pnu;
            if (selectedPnu === pnu) {
                window.selectedParcel = {
                    ...window.selectedParcel,
                    ...saveData
                };
            }
        }

        if (window.currentSelectedParcel) {
            const currentPnu = window.currentSelectedParcel.pnu || window.currentSelectedParcel.properties?.PNU || window.currentSelectedParcel.properties?.pnu;
            if (currentPnu === pnu) {
                window.currentSelectedParcel = {
                    ...window.currentSelectedParcel,
                    ...saveData
                };
            }
        }

        if (Array.isArray(window.parcelsData)) {
            const parcelsIndex = window.parcelsData.findIndex(item => item.pnu === pnu || item.id === pnu);
            if (parcelsIndex >= 0) {
                window.parcelsData[parcelsIndex] = {
                    ...window.parcelsData[parcelsIndex],
                    ...saveData
                };
            } else if (saveData.pnu) {
                window.parcelsData.push({ ...saveData });
            }
        } else if (saveData.pnu) {
            window.parcelsData = [{ ...saveData }];
        }

        Object.assign(parcelData, saveData);
        parcelData.properties = mergedProperties;
        parcelData.geometry = mergedGeometry;
        if (lat !== null) parcelData.lat = lat;
        if (lng !== null) parcelData.lng = lng;

        // 색상 정보 저장
        if (typeof ParcelColorStorage !== 'undefined') {
            if (saveData.color && saveData.color !== 'transparent') {
                ParcelColorStorage.setHex(pnu, saveData.color);
            } else if (typeof ParcelColorStorage.remove === 'function') {
                ParcelColorStorage.remove(pnu);
            }
        }

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

                window.applyColorToParcel(parcelToPass, currentColor);
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
 * 🧭 클릭 모드에서 좌표로 필지 찾기
 */
function findClickModeParcelAtLocation(lat, lng) {
    if (!window.isPointInPolygon) {
        console.warn('⚠️ 클릭 모드: isPointInPolygon 헬퍼를 찾을 수 없습니다.');
        return null;
    }

    if (window.clickParcels && window.clickParcels.size > 0) {
        for (const [pnu, info] of window.clickParcels) {
            const polygon = info?.polygon;
            if (!polygon || !polygon.getMap) {
                continue;
            }

            if (!polygon.getMap()) {
                continue;
            }

            const paths = typeof polygon.getPaths === 'function' ? polygon.getPaths() : null;
            if (!paths) {
                continue;
            }

            let path = null;
            if (typeof paths.getLength === 'function' && paths.getLength() > 0) {
                path = paths.getAt(0);
            } else if (paths.length > 0) {
                path = paths[0];
            }

            if (path && window.isPointInPolygon(lat, lng, path)) {
                return {
                    pnu,
                    polygon,
                    parcel: info.parcel || info.data || clickModeParcelData.get(pnu) || null
                };
            }
        }
    }

    for (const [pnu, polygon] of clickModePolygons) {
        if (!polygon || !polygon.getMap || !polygon.getMap()) {
            continue;
        }

        const paths = typeof polygon.getPaths === 'function' ? polygon.getPaths() : null;
        if (!paths) {
            continue;
        }

        let path = null;
        if (typeof paths.getLength === 'function' && paths.getLength() > 0) {
            path = paths.getAt(0);
        } else if (paths.length > 0) {
            path = paths[0];
        }

        if (path && window.isPointInPolygon(lat, lng, path)) {
            return {
                pnu,
                polygon,
                parcel: clickModeParcelData.get(pnu) || null
            };
        }
    }

    return null;
}

/**
 * 🧼 클릭 모드 필지 색상만 제거
 */
async function clearClickModeParcelColor(pnu, parcelContext = {}) {
    const polygon = parcelContext.polygon || (window.clickParcels?.get(pnu)?.polygon) || clickModePolygons.get(pnu) || null;

    if (polygon && typeof polygon.setOptions === 'function') {
        polygon.setOptions({
            fillColor: 'transparent',
            fillOpacity: 0,
            strokeColor: 'transparent',
            strokeOpacity: 0,
            strokeWeight: 0
        });
    }

    const storedEntry = window.clickParcels ? window.clickParcels.get(pnu) : null;
    const storedParcelData = parcelContext.parcel || parcelContext.data || clickModeParcelData.get(pnu) || storedEntry?.parcel || storedEntry?.data || null;

    let normalizedParcel = null;
    if (storedParcelData) {
        normalizedParcel = {
            ...storedParcelData,
            color: 'transparent',
            updatedAt: Date.now()
        };

        if (!normalizedParcel.properties && storedEntry?.parcel?.properties) {
            normalizedParcel.properties = storedEntry.parcel.properties;
        }
        if (!normalizedParcel.geometry && storedEntry?.parcel?.geometry) {
            normalizedParcel.geometry = storedEntry.parcel.geometry;
        }

        const properties = normalizedParcel.properties || {};
        const resolvedPnu = properties.PNU || properties.pnu || normalizedParcel.pnu || pnu;
        normalizedParcel.pnu = resolvedPnu;
        if (!normalizedParcel.properties) {
            normalizedParcel.properties = {};
        }
        if (!normalizedParcel.properties.PNU) {
            normalizedParcel.properties.PNU = resolvedPnu;
        }
        if (!normalizedParcel.properties.pnu) {
            normalizedParcel.properties.pnu = resolvedPnu;
        }
    }

    if (window.clickParcels) {
        const existingEntry = window.clickParcels.get(pnu) || {};
        window.clickParcels.set(pnu, {
            ...existingEntry,
            polygon: polygon || existingEntry.polygon || null,
            parcel: normalizedParcel || existingEntry.parcel || existingEntry.data || null,
            data: normalizedParcel || existingEntry.data || existingEntry.parcel || null,
            color: 'transparent'
        });
    }

    if (normalizedParcel) {
        clickModeParcelData.set(pnu, normalizedParcel);
    } else if (clickModeParcelData.has(pnu)) {
        const existing = {
            ...clickModeParcelData.get(pnu),
            color: 'transparent',
            updatedAt: Date.now()
        };
        clickModeParcelData.set(pnu, existing);
        normalizedParcel = existing;
    }

    try {
        ParcelColorStorage.remove(pnu);
    } catch (error) {
        console.warn('⚠️ ParcelColorStorage에서 색상 제거 실패:', error);
    }

    // clickParcelData 업데이트
    if (typeof window.getClickParcelData === 'function' && typeof window.setClickParcelDataToStorage === 'function') {
        try {
            const clickData = window.getClickParcelData();
            let updated = false;
            const refreshed = clickData.map(item => {
                if ((item.pnu && item.pnu === pnu) || (item.properties?.PNU === pnu) || (item.properties?.pnu === pnu)) {
                    updated = true;
                    return {
                        ...item,
                        color: 'transparent'
                    };
                }
                return item;
            });
            if (updated) {
                window.setClickParcelDataToStorage(refreshed);
            }
        } catch (error) {
            console.warn('⚠️ clickParcelData 색상 초기화 실패:', error);
        }
    }

    // parcelData 업데이트
    try {
        const raw = localStorage.getItem('parcelData');
        if (raw) {
            const parsed = JSON.parse(raw);
            let dirty = false;
            const updatedParcels = parsed.map(item => {
                if ((item.pnu && item.pnu === pnu) || (item.properties?.PNU === pnu) || (item.properties?.pnu === pnu)) {
                    dirty = true;
                    const next = {
                        ...item,
                        color: 'transparent'
                    };
                    if (next.data && typeof next.data === 'object') {
                        next.data = { ...next.data, color: 'transparent' };
                    }
                    return next;
                }
                return item;
            });
            if (dirty) {
                localStorage.setItem('parcelData', JSON.stringify(updatedParcels));
            }
        }
    } catch (error) {
        console.warn('⚠️ parcelData 색상 초기화 실패:', error);
    }

    if (typeof window.getClickParcelColors === 'function' && typeof window.saveClickParcelColors === 'function') {
        try {
            const colors = window.getClickParcelColors();
            if (colors && Object.prototype.hasOwnProperty.call(colors, pnu)) {
                delete colors[pnu];
                window.saveClickParcelColors(colors);
            }
        } catch (error) {
            console.warn('⚠️ 클릭 필지 색상 캐시 제거 실패:', error);
        }
    }

    if (normalizedParcel && window.SupabaseManager && typeof window.SupabaseManager.saveParcel === 'function') {
        try {
            const jibun = formatJibun(normalizedParcel.properties || {});
            await window.SupabaseManager.saveParcel(pnu, {
                parcelNumber: jibun,
                parcel_name: jibun,
                data: normalizedParcel,
                geometry: normalizedParcel.geometry,
                source: 'click',
                mode: 'click',
                mode_source: 'click',
                current_mode: 'click',
                color: null,
                updated_at: new Date().toISOString()
            });
        } catch (error) {
            console.warn('⚠️ Supabase 색상 초기화 실패:', error);
        }
    }

    if (window.parcelManager && typeof window.parcelManager.renderParcelList === 'function') {
        try {
            window.parcelManager.renderParcelList();
        } catch (error) {
            console.warn('⚠️ 필지 목록 갱신 실패:', error);
        }
    }

    if (normalizedParcel && window.currentSelectedPNU === pnu) {
        updateParcelFormForClickMode(normalizedParcel);
    }

    if (window.autoSaveEnabled && typeof window.triggerAutoSave === 'function') {
        try {
            window.triggerAutoSave('parcel_color_clear');
        } catch (error) {
            console.warn('⚠️ 자동 저장 트리거 실패:', error);
        }
    }
}

/**
 * 🗑️ 클릭 모드 오른쪽 클릭 처리 (색상 제거)
 */
async function handleClickModeRightClick(lat, lng) {
    console.log('🧼 클릭 모드 오른쪽 클릭: 색상 제거 처리');

    try {
        const target = findClickModeParcelAtLocation(lat, lng);

        if (!target) {
            console.log('⚠️ 클릭한 위치에 색칠된 필지가 없습니다.');
            return;
        }

        const confirmClear = confirm('이 필지의 색상을 지우시겠습니까?');
        if (!confirmClear) {
            return;
        }

        await clearClickModeParcelColor(target.pnu, target);
        console.log(`✅ 클릭 모드 필지 색상 제거 완료: ${target.pnu}`);
    } catch (error) {
        console.error('❌ 클릭 모드 색상 제거 실패:', error);
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
    // 중복 실행 방지
    if (window._loadingSavedClickModeParcels) {
        return;
    }
    window._loadingSavedClickModeParcels = true;

    try {

        // 삭제된 필지 목록 가져오기
        const deletedParcels = window.getDeletedParcels ? window.getDeletedParcels() : [];
        if (deletedParcels.length > 0) {
            // 삭제된 필지 스킵
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
                // 최소 데이터 필지 스킵
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
                            // 좌표 추출 성공
                        } else {
                            // 좌표 추출 실패
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
                // 최소 데이터 필지 스킵
                continue;
            }

            const pnu = parcel.pnu || parcel.id;

            // 삭제된 필지 체크 - geometry가 있으면 색상/폴리곤 복원용으로 포함
            if (deletedParcels.includes(pnu)) {
                if (parcel.geometry && parcel.color) {
                    // 색상/폴리곤 복원
                    // geometry와 color만 있는 필지는 포함 (정보는 없지만 색상은 유지)
                } else {
                    // 완전 삭제된 필지 스킵
                    continue;
                }
            }

            if (pnu && !pnuSet.has(pnu)) {
                pnuSet.add(pnu);
                savedParcels.push(parcel);
            }
        }

        const parcelColors = ParcelColorStorage.getAll();

        // LocalStorage에서 필지 로드 완료

        let restoredCount = 0;
        let skippedCount = 0;

        for (const parcelData of savedParcels) {
            // 필지 확인 중

            // 클릭 모드에서 생성된 필지만 복원
            if (parcelData.mode === 'click' || parcelData.source === 'click') {
                const pnu = parcelData.properties?.PNU || parcelData.properties?.pnu || parcelData.pnu;

                // 클릭 모드 필지 발견

                if (pnu && parcelData.geometry) {
                    // 저장된 색상 정보를 parcelData에 추가
                    const savedColorIndex = parcelColors.get(pnu);
                    const savedColor = typeof savedColorIndex === 'number'
                        ? ParcelColorStorage.palette[savedColorIndex]?.hex || parcelData.color
                        : parcelData.color;
                    if (savedColor) {
                        parcelData.color = savedColor;
                        // 저장된 색상 복원
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

                    // 🔍 현재 모드 확인: 검색 모드라면 폴리곤을 지도에 표시하지 않음
                    const currentMode = window.currentMode || localStorage.getItem('currentMode') || 'click';
                    const targetMap = currentMode === 'search' ? null : undefined;

                    // 폴리곤 그리기 (색상 정보가 포함된 parcelData 전달)
                    const polygon = await drawClickModeParcelPolygon(structuredData, {
                        isRestored: true,
                        targetMap: targetMap
                    });

                    if (polygon) {
                        // 폴리곤 생성 성공
                        // 색상은 이미 drawClickModeParcelPolygon에서 적용됨

                        if (currentMode === 'search') {
                            console.log(`🔍 검색 모드 - 클릭 필지 폴리곤 숨김: ${pnu}`);
                        }

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
                    // 필지 복원 조건 불충족
                }
            } else {
                skippedCount++;
                // 클릭 모드가 아닌 필지 건너뜀
            }
        }

        if (restoredCount > 0) {
            console.log(`✅ ${restoredCount}개 필지 복원 완료`);
        }
        return restoredCount;

    } catch (error) {
        console.error('❌ 클릭 모드 필지 복원 실패:', error);
        return 0;
    } finally {
        // 중복 실행 방지 플래그 해제
        window._loadingSavedClickModeParcels = false;
    }
}

function syncClickModePolygonsToMap(targetMap) {
    clickModePolygons.forEach(polygon => {
        if (polygon && typeof polygon.setMap === 'function') {
            polygon.setMap(targetMap || null);
        }
    });
}

function registerClickHandPolygonSync() {
    if (registerClickHandPolygonSync.initialized) {
        return;
    }

    if (window.ModeManager && typeof window.ModeManager.onModeChange === 'function') {
        registerClickHandPolygonSync.initialized = true;
        window.ModeManager.onModeChange((newMode) => {
            if (newMode === 'click' || newMode === 'hand') {
                const targetMap = window.map || (newMode === 'hand' ? window.mapHand : window.mapClick) || null;
                syncClickModePolygonsToMap(targetMap);
            } else {
                syncClickModePolygonsToMap(null);
            }
        });

        // 🔍 초기 동기화 시 현재 모드 확인
        const currentMode = window.currentMode || localStorage.getItem('currentMode') || 'click';
        if (currentMode === 'search') {
            // 검색 모드에서는 클릭 필지를 표시하지 않음
            syncClickModePolygonsToMap(null);
            console.log('[registerClickHandPolygonSync] 검색 모드 - 클릭 필지 숨김');
        } else {
            const initialMap = window.map || window.mapClick || null;
            syncClickModePolygonsToMap(initialMap);
            console.log('[registerClickHandPolygonSync] 클릭/손 모드 - 클릭 필지 표시');
        }
    } else {
        setTimeout(registerClickHandPolygonSync, 800);
    }
}

registerClickHandPolygonSync();

// 전역 함수로 노출
window.setupClickModeEventListeners = setupClickModeEventListeners;
window.getParcelInfoForClickMode = getParcelInfoForClickMode;
window.clickModePolygons = clickModePolygons;
window.clickModeParcelData = clickModeParcelData;
window.loadSavedClickModeParcels = loadSavedClickModeParcels;
window.handleClickModeLeftClick = handleClickModeLeftClick;  // 테스트용 노출
window.handleColorChange = handleColorChange;  // 색상 팔레트에서 호출용

console.log('🎯 mode-click-handler.js 로드 완료');
