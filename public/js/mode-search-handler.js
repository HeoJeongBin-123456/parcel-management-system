/**
 * 검색 모드 전용 이벤트 핸들러
 * 검색 결과 표시 및 편집을 지원하며, 지도 클릭으로 신규 추가는 제한
 */

// 🔍 검색 모드 전용 폴리곤 저장소
const searchModePolygons = new Map(); // PNU -> polygon 맵핑
const searchModeParcelData = new Map(); // PNU -> parcel data 맵핑

// 검색 모드 고정 색상
const SEARCH_MODE_COLOR = '#9370DB'; // 보라색

/**
 * 🔍 검색 모드 지도 이벤트 리스너 설정
 */
function setupSearchModeEventListeners() {
    if (!window.mapSearch) return;

    console.log('🔍 검색 모드 이벤트 리스너 설정');

    // 왼쪽 클릭 이벤트 (기능 없음)
    naver.maps.Event.addListener(window.mapSearch, 'click', function(e) {
        const coord = e.coord;
        console.log('🚫 검색 모드 왼쪽 클릭 (기능 없음):', coord.lat(), coord.lng());

        // 거리뷰 모드 처리만 허용
        if (window.isStreetViewMode) {
            handleSearchModeStreetViewClick(coord);
            return;
        }

        // 왼쪽 클릭은 아무 동작도 하지 않음
        console.log('🚫 검색 모드: 왼쪽 클릭 기능 없음');
    });

    // 오른쪽 클릭 이벤트 (삭제)
    naver.maps.Event.addListener(window.mapSearch, 'rightclick', function(e) {
        e.originalEvent?.preventDefault();
        const coord = e.coord;

        console.log('🗑️ 검색 모드 오른쪽 클릭 (삭제):', coord.lat(), coord.lng());
        handleSearchModeRightClick(coord.lat(), coord.lng());
    });

    // 컨텍스트 메뉴 방지
    window.mapSearch.getElement().addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
}

/**
 * 🔍 검색 결과 필지 표시
 */
async function displaySearchResultParcel(parcelData) {
    if (!parcelData || !parcelData.geometry) {
        console.warn('⚠️ 검색 모드: 잘못된 필지 데이터');
        return null;
    }

    const pnu = parcelData.properties?.PNU || parcelData.properties?.pnu || parcelData.pnu;
    if (!pnu) {
        console.warn('⚠️ 검색 모드: PNU 없음');
        return null;
    }

    // 기존 폴리곤 제거
    const existingPolygon = searchModePolygons.get(pnu);
    if (existingPolygon) {
        existingPolygon.setMap(null);
        searchModePolygons.delete(pnu);
    }

    try {
        // 새로운 스키마 필드 추가
        const searchParcelData = {
            ...parcelData,
            source: 'search',           // 🆕 기존 호환용
            mode: 'search',             // 🆕 기존 호환용
            mode_source: 'search',      // 🆕 새 스키마: 생성 모드
            current_mode: 'search',     // 🆕 새 스키마: 현재 활성 모드
            color: SEARCH_MODE_COLOR,   // 보라색 고정
            createdAt: Date.now()
        };

        // 폴리곤 생성
        const polygon = await drawSearchModeParcelPolygon(searchParcelData);

        if (polygon) {
            // 데이터 저장
            await saveSearchModeParcelData(searchParcelData);

            console.log(`🔍 검색 결과 필지 표시: ${pnu}`);
            return polygon;
        }

        return null;

    } catch (error) {
        console.error('❌ 검색 모드 필지 표시 실패:', error);
        return null;
    }
}

/**
 * 🎨 검색 모드 전용 폴리곤 그리기
 */
async function drawSearchModeParcelPolygon(parcelData) {
    if (!parcelData.geometry || !parcelData.geometry.coordinates) {
        console.warn('⚠️ 검색 모드: 폴리곤 좌표 데이터 없음');
        return null;
    }

    const pnu = parcelData.properties?.PNU || parcelData.properties?.pnu || parcelData.pnu;

    try {
        // 좌표 변환
        const coordinates = parcelData.geometry.coordinates[0].map(coord =>
            new naver.maps.LatLng(coord[1], coord[0])
        );

        // 검색 모드 전용 폴리곤 (보라색 고정)
        const polygon = new naver.maps.Polygon({
            map: window.mapSearch,
            paths: coordinates,
            fillColor: SEARCH_MODE_COLOR,
            fillOpacity: 0.4,
            strokeColor: SEARCH_MODE_COLOR,
            strokeWeight: 2,
            strokeOpacity: 0.8
        });

        // 왼쪽 클릭 이벤트 (정보 편집 허용)
        naver.maps.Event.addListener(polygon, 'click', async function(e) {
            e.cancelBubble = true;
            await displaySearchParcelInfoOnly(parcelData);
        });

        // 오른쪽 클릭 이벤트 (삭제)
        naver.maps.Event.addListener(polygon, 'rightclick', async function(e) {
            e.cancelBubble = true;
            e.originalEvent?.preventDefault();
            console.log('🗑️ 검색 폴리곤 오른쪽 클릭 (삭제):', pnu);

            // 삭제 확인
            const confirmDelete = confirm('이 검색 필지를 삭제하시겠습니까?');
            if (confirmDelete) {
                await removeSearchParcel(pnu);
            }
        });

        // 저장
        searchModePolygons.set(pnu, polygon);
        searchModeParcelData.set(pnu, parcelData);

        console.log(`🎨 검색 모드 폴리곤 생성: ${pnu} (보라색 고정)`);
        return polygon;

    } catch (error) {
        console.error('❌ 검색 모드 폴리곤 생성 실패:', error);
        return null;
    }
}

/**
 * 📝 검색 필지 정보 표시 및 편집 준비
 */
async function displaySearchParcelInfoOnly(parcelData) {
    const pnu = parcelData.properties?.PNU || parcelData.properties?.pnu || parcelData.pnu;
    const jibun = formatJibun(parcelData.properties);

    console.log(`📝 검색 필지 정보 표시: ${pnu}`);

    // 폼에 정보만 표시 (읽기 전용)
    document.getElementById('parcelNumber').value = jibun;
    window.currentSelectedPNU = pnu;

    const baseGeometry = parcelData.geometry || parcelData.data?.geometry;
    let lat = parcelData.lat || parcelData.data?.lat || null;
    let lng = parcelData.lng || parcelData.data?.lng || null;

    if ((!lat || !lng) && baseGeometry?.coordinates?.length) {
        const coordinateSet = baseGeometry.coordinates[0];
        if (typeof calculatePolygonCenter === 'function') {
            const [centerLng, centerLat] = calculatePolygonCenter(coordinateSet);
            lat = centerLat;
            lng = centerLng;
        } else {
            const total = coordinateSet.reduce((acc, coord) => {
                if (Array.isArray(coord) && coord.length >= 2) {
                    acc.lng += coord[0];
                    acc.lat += coord[1];
                    acc.count += 1;
                }
                return acc;
            }, { lat: 0, lng: 0, count: 0 });
            if (total.count > 0) {
                lng = total.lng / total.count;
                lat = total.lat / total.count;
            }
        }
    }

    if (typeof window.resetParcelFormFields === 'function') {
        window.resetParcelFormFields();
    } else {
        document.getElementById('parcelNumber').value = '';
        document.getElementById('ownerName').value = '';
        document.getElementById('ownerAddress').value = '';
        document.getElementById('ownerContact').value = '';
        document.getElementById('memo').value = '';
    }

    const parcelNumberInput = document.getElementById('parcelNumber');
    if (parcelNumberInput) {
        parcelNumberInput.value = jibun;
    }

    const ownerNameInput = document.getElementById('ownerName');
    const ownerAddressInput = document.getElementById('ownerAddress');
    const ownerContactInput = document.getElementById('ownerContact');
    const memoInput = document.getElementById('memo');

    const ownerNameValue = ownerNameInput?.value || '';
    const ownerAddressValue = ownerAddressInput?.value || '';
    const ownerContactValue = ownerContactInput?.value || '';
    const memoValue = memoInput?.value || '';

    window.selectedParcel = {
        pnu,
        id: pnu,
        parcelNumber: parcelNumberInput?.value || jibun || '',
        ownerName: ownerNameValue,
        ownerAddress: ownerAddressValue,
        ownerContact: ownerContactValue,
        memo: memoValue,
        geometry: baseGeometry,
        lat,
        lng,
        color: parcelData.color || SEARCH_MODE_COLOR,
        source: parcelData.source || 'search',
        mode: 'search'
    };

    window.currentSelectedParcel = window.selectedParcel;

    console.log('✏️ 검색 모드 편집 준비 완료:', {
        pnu: window.selectedParcel.pnu,
        ownerName: window.selectedParcel.ownerName,
        ownerContact: window.selectedParcel.ownerContact
    });
}

/**
 * 💾 검색 모드 필지 데이터 저장
 */
async function saveSearchModeParcelData(parcelData) {
    const pnu = parcelData.properties?.PNU || parcelData.properties?.pnu || parcelData.pnu;

    try {
        // 🔍 필지 검증: 색칠 또는 필지 정보가 있는지 확인
        if (window.ParcelValidationUtils && !window.ParcelValidationUtils.isParcelWorthSaving(parcelData)) {
            console.warn('⚠️ [검색 모드 저장 거부] 색칠도 없고 필지 정보도 없는 빈 필지:', pnu);
            window.ParcelValidationUtils.updateStats(false);
            return false;
        }

        window.ParcelValidationUtils.updateStats(true);
        console.log('✅ [검색 모드 저장 검증 통과]', pnu);

        // Supabase 저장 (새로운 스키마 필드 포함)
        if (window.SupabaseManager) {
            await window.SupabaseManager.saveParcel({
                pnu: pnu,
                parcel_name: formatJibun(parcelData.properties),
                data: parcelData,
                geometry: parcelData.geometry,
                source: 'search',            // 🆕 기존 호환용
                mode: 'search',              // 🆕 기존 호환용
                mode_source: 'search',       // 🆕 새 스키마: 생성 모드
                current_mode: 'search',      // 🆕 새 스키마: 현재 활성 모드
                color: SEARCH_MODE_COLOR,
                created_at: new Date().toISOString()
            });
        }

        // LocalStorage 백업
        const savedData = JSON.parse(localStorage.getItem('parcelData') || '[]');
        const existingIndex = savedData.findIndex(item =>
            (item.pnu && item.pnu === pnu) || (item.properties?.pnu === pnu)
        );

        if (existingIndex >= 0) {
            savedData[existingIndex] = parcelData;
        } else {
            savedData.push(parcelData);
        }

        localStorage.setItem('parcelData', JSON.stringify(savedData));

        // 색상 정보 저장 (검색은 항상 보라색)
        ParcelColorStorage.setHex(pnu, SEARCH_MODE_COLOR);

        // 삭제 목록에서 제거 (검색 추가 = 활성화)
        if (window.removeFromDeletedParcels) {
            window.removeFromDeletedParcels(pnu);
            console.log(`🔄 검색 모드: 삭제 목록에서 제거: ${pnu}`);
        }

        console.log(`💾 검색 모드 데이터 저장: ${pnu}`);

    } catch (error) {
        console.error('❌ 검색 모드 데이터 저장 실패:', error);
    }
}

/**
 * 🔍 검색 결과 일괄 표시
 */
async function displaySearchResults(results) {
    if (!results || !Array.isArray(results)) {
        console.warn('⚠️ 검색 모드: 잘못된 검색 결과');
        return;
    }

    console.log(`🔍 검색 결과 ${results.length}개 표시 시작`);

    // 기존 검색 결과 지우기
    clearSearchModePolygons();

    // 각 결과 표시
    const displayPromises = results.map(result => displaySearchResultParcel(result));

    try {
        const polygons = await Promise.all(displayPromises);
        const successCount = polygons.filter(p => p !== null).length;

        console.log(`🔍 검색 결과 표시 완료: ${successCount}/${results.length}개`);

        // 첫 번째 결과로 지도 이동 (선택사항)
        if (results.length > 0 && results[0].geometry && results[0].geometry.coordinates) {
            const firstCoord = results[0].geometry.coordinates[0][0];
            const center = new naver.maps.LatLng(firstCoord[1], firstCoord[0]);
            window.mapSearch.setCenter(center);
            window.mapSearch.setZoom(16);
        }

    } catch (error) {
        console.error('❌ 검색 결과 표시 실패:', error);
    }
}

/**
 * 🧹 검색 모드 폴리곤 지우기
 */
function clearSearchModePolygons() {
    console.log('🧹 검색 모드 폴리곤 지우기');

    searchModePolygons.forEach((polygon) => {
        polygon.setMap(null);
    });

    searchModePolygons.clear();
    searchModeParcelData.clear();
}

/**
 * 🔍 검색 실행
 */
async function executeSearchInSearchMode(query, searchType = 'all') {
    if (!query || query.trim().length === 0) {
        console.warn('🔍 검색 모드: 빈 검색어');
        return;
    }

    console.log(`🔍 검색 모드 검색 실행: "${query}"`);

    try {
        // 기존 SearchModeManager 사용
        if (window.SearchModeManager) {
            const result = await window.SearchModeManager.executeSearch(query, searchType);

            if (result.results && result.results.length > 0) {
                await displaySearchResults(result.results);
            } else {
                console.log('🔍 검색 결과 없음');
                clearSearchModePolygons();
            }

            return result;
        }

        // 백업: 직접 검색
        const results = await performLocalSearch(query, searchType);
        await displaySearchResults(results);

        return {
            query: query,
            results: results,
            totalResults: results.length
        };

    } catch (error) {
        console.error('❌ 검색 모드 검색 실패:', error);
        throw error;
    }
}

/**
 * 🔍 로컬 검색 (백업용)
 */
async function performLocalSearch(query, searchType) {
    const allParcels = JSON.parse(localStorage.getItem('parcelData') || '[]');

    return allParcels.filter(parcel => {
        const queryLower = query.toLowerCase();

        switch(searchType) {
            case 'address':
                return parcel.parcelName?.toLowerCase().includes(queryLower) ||
                       parcel.ownerAddress?.toLowerCase().includes(queryLower);
            case 'pnu':
                return parcel.pnu?.includes(query);
            case 'owner':
                return parcel.ownerName?.toLowerCase().includes(queryLower);
            case 'all':
            default:
                return parcel.parcelName?.toLowerCase().includes(queryLower) ||
                       parcel.ownerAddress?.toLowerCase().includes(queryLower) ||
                       parcel.pnu?.includes(query) ||
                       parcel.ownerName?.toLowerCase().includes(queryLower) ||
                       parcel.memo?.toLowerCase().includes(queryLower);
        }
    });
}

/**
 * 🚶 검색 모드 거리뷰 클릭 처리
 */
function handleSearchModeStreetViewClick(coord) {
    console.log('🚶 검색 모드 거리뷰 클릭:', coord.lat(), coord.lng());

    // 지도 숨기고 파노라마 표시
    document.getElementById('map-search').style.display = 'none';
    document.getElementById('pano').style.display = 'block';

    // 파노라마 닫기 버튼 처리
    if (!document.querySelector('.pano-close-btn')) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'pano-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = function() {
            document.getElementById('map-search').style.display = 'block';
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
 * 🗑️ 검색 필지 삭제 (PNU로 직접 삭제)
 */
async function removeSearchParcel(targetPNU) {
    try {
        console.log(`🗑️ 검색 필지 삭제 시작: ${targetPNU}`);

        // 해당 PNU의 폴리곤 찾기 (searchModePolygons 우선, window.searchParcels도 확인)
        let targetPolygon = searchModePolygons.get(targetPNU);
        let foundInSearchModePolygons = !!targetPolygon;

        // searchModePolygons에서 찾지 못한 경우, window.searchParcels에서 찾기
        if (!targetPolygon && window.searchParcels) {
            const searchParcel = window.searchParcels.get(targetPNU);
            if (searchParcel && searchParcel.polygon) {
                targetPolygon = searchParcel.polygon;
                console.log(`🔍 window.searchParcels에서 폴리곤 발견: ${targetPNU}`);
            }
        }

        if (targetPolygon) {
            // 폴리곤 제거
            targetPolygon.setMap(null);
            console.log(`🗑️ 지도에서 폴리곤 제거: ${targetPNU}`);

            // searchModePolygons에서 제거 (있는 경우만)
            if (foundInSearchModePolygons) {
                searchModePolygons.delete(targetPNU);
                searchModeParcelData.delete(targetPNU);
                console.log(`🗑️ searchModePolygons에서 제거: ${targetPNU}`);
            }

            // window.searchParcels에서도 제거
            if (window.searchParcels && window.searchParcels.has(targetPNU)) {
                window.searchParcels.delete(targetPNU);
                console.log(`🗑️ window.searchParcels에서 제거: ${targetPNU}`);

                // localStorage의 기존 searchParcels 데이터를 읽어와서 삭제할 항목만 제거
                const existingSearchParcels = JSON.parse(localStorage.getItem('searchParcels') || '[]');
                console.log(`📦 localStorage에서 ${existingSearchParcels.length}개 검색 필지 로드`);

                // 삭제할 PNU와 일치하는 항목만 제거 (전체 데이터 보존)
                const updatedSearchParcels = existingSearchParcels.filter(item =>
                    item.pnu !== targetPNU
                );

                // 수정된 전체 데이터를 다시 저장
                localStorage.setItem('searchParcels', JSON.stringify(updatedSearchParcels));
                console.log(`💾 localStorage searchParcels 업데이트: ${existingSearchParcels.length} → ${updatedSearchParcels.length}개 (1개 삭제)`);
            }
        } else {
            console.warn(`⚠️ 폴리곤을 찾을 수 없음: ${targetPNU}`);
        }

        // clickParcels에서도 제거
        if (window.clickParcels && window.clickParcels.has(targetPNU)) {
            window.clickParcels.delete(targetPNU);
        }

        // Supabase에서 삭제
        if (window.SupabaseManager) {
            await window.SupabaseManager.deleteParcel(targetPNU);
        }

        // LocalStorage에서 삭제
        const savedData = JSON.parse(localStorage.getItem('parcelData') || '[]');
        const filteredData = savedData.filter(item => item.pnu !== targetPNU);
        localStorage.setItem('parcelData', JSON.stringify(filteredData));

        // 색상 정보 삭제
        ParcelColorStorage.remove(targetPNU);

        // 마커 삭제
        if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
            const markerInfo = window.MemoMarkerManager.markers.get(targetPNU);
            if (markerInfo && markerInfo.marker) {
                markerInfo.marker.setMap(null);
                window.MemoMarkerManager.markers.delete(targetPNU);
            }
        }

        // 삭제 목록에서 제거 (재색칠 = 활성화)
        if (window.removeFromDeletedParcels) {
            window.removeFromDeletedParcels(targetPNU);
            console.log(`🔄 검색 모드: 삭제 목록에서 제거: ${targetPNU}`);
        }

        console.log(`✅ 검색 필지 삭제 완료: ${targetPNU}`);
        return true;

    } catch (error) {
        console.error('❌ 검색 필지 삭제 실패:', error);
        return false;
    }
}

/**
 * 🗑️ 검색 모드 오른쪽 클릭 처리 (삭제)
 */
async function handleSearchModeRightClick(lat, lng) {
    console.log('🗑️ 검색 모드 오른쪽 클릭: 삭제 처리');

    try {
        // 클릭한 위치의 필지 찾기
        let targetPNU = null;
        let targetPolygon = null;

        // 저장된 모든 폴리곤 확인 (검색 결과 폴리곤)
        for (const [pnu, polygon] of searchModePolygons) {
            if (polygon && polygon.getMap()) {
                const paths = polygon.getPaths();
                const path = paths.getAt(0);

                // 폴리곤 내부 클릭 확인
                if (window.isPointInPolygon && window.isPointInPolygon(lat, lng, path)) {
                    targetPNU = pnu;
                    targetPolygon = polygon;
                    break;
                }
            }
        }

        // 검색 결과가 아닌 일반 필지 확인 (clickParcels에서)
        if (!targetPNU && window.clickParcels) {
            for (const [pnu, polygon] of window.clickParcels) {
                if (polygon && polygon.getMap()) {
                    const paths = polygon.getPaths();
                    const path = paths.getAt(0);

                    // 폴리곤 내부 클릭 확인
                    if (window.isPointInPolygon && window.isPointInPolygon(lat, lng, path)) {
                        targetPNU = pnu;
                        targetPolygon = polygon;
                        break;
                    }
                }
            }
        }

        // 필지를 찾았으면 삭제
        if (targetPNU && targetPolygon) {
            const confirmDelete = confirm('이 필지를 삭제하시겠습니까?');
            if (confirmDelete) {
                // 폴리곤 제거
                targetPolygon.setMap(null);

                // 검색 결과 목록에서 제거
                if (searchModePolygons.has(targetPNU)) {
                    searchModePolygons.delete(targetPNU);
                    searchModeParcelData.delete(targetPNU);
                }

                // clickParcels에서도 제거
                if (window.clickParcels && window.clickParcels.has(targetPNU)) {
                    window.clickParcels.delete(targetPNU);
                }

                // Supabase에서 삭제
                if (window.SupabaseManager) {
                    await window.SupabaseManager.deleteParcel(targetPNU);
                }

                // LocalStorage에서 삭제
                const savedData = JSON.parse(localStorage.getItem('parcelData') || '[]');
                const filteredData = savedData.filter(item => item.pnu !== targetPNU);
                localStorage.setItem('parcelData', JSON.stringify(filteredData));

                // 색상 정보 삭제
                ParcelColorStorage.remove(targetPNU);

                // 마커 삭제
                if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
                    const markerInfo = window.MemoMarkerManager.markers.get(targetPNU);
                    if (markerInfo && markerInfo.marker) {
                        markerInfo.marker.setMap(null);
                        window.MemoMarkerManager.markers.delete(targetPNU);
                    }
                }

                console.log(`✅ 검색 모드 필지 삭제 완료: ${targetPNU}`);
            }
        } else {
            console.log('⚠️ 클릭한 위치에 필지가 없습니다.');
        }
    } catch (error) {
        console.error('❌ 검색 모드 삭제 실패:', error);
    }
}

// 전역 함수로 노출
window.setupSearchModeEventListeners = setupSearchModeEventListeners;
window.displaySearchResults = displaySearchResults;
window.clearSearchModePolygons = clearSearchModePolygons;
window.executeSearchInSearchMode = executeSearchInSearchMode;
window.handleSearchModeRightClick = handleSearchModeRightClick;
window.removeSearchParcel = removeSearchParcel;
window.searchModePolygons = searchModePolygons;
window.searchModeParcelData = searchModeParcelData;
window.SEARCH_MODE_COLOR = SEARCH_MODE_COLOR;

console.log('🔍 mode-search-handler.js 로드 완료');
