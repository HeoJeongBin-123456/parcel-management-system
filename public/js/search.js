// 검색 기능

// 폴리곤 중심점 계산 함수
function calculatePolygonCenter(coordinates) {
    if (!coordinates || coordinates.length === 0) {
        return [0, 0];
    }
    
    let totalX = 0;
    let totalY = 0;
    let count = 0;
    
    for (const coord of coordinates) {
        if (coord && coord.length >= 2) {
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

// 필지 하이라이트 함수
function highlightParcel(parcelData) {
    try {
    // console.log('🎨 필지 하이라이트 시작:', parcelData);
        
        const geometry = parcelData.geometry;
        const properties = parcelData.properties || {};
        
        if (!geometry || !geometry.coordinates) {
            console.warn('❌ geometry 또는 coordinates가 없습니다:', geometry);
            return;
        }

        // formatJibun 함수를 사용하여 지번 포맷팅
        const displayText = formatJibun(properties);
        
    // console.log('🏠 포맷된 지번:', displayText);
    // console.log('📄 전체 properties:', properties);

        // 좌표 변환
        let paths = [];
        
        if (geometry.type === 'Polygon') {
            // 단일 폴리곤
            const coords = geometry.coordinates[0];
            paths = coords.map(coord => new naver.maps.LatLng(coord[1], coord[0]));
        } else if (geometry.type === 'MultiPolygon') {
            // 다중 폴리곤 - 첫 번째 폴리곤만 사용
            const coords = geometry.coordinates[0][0];
            paths = coords.map(coord => new naver.maps.LatLng(coord[1], coord[0]));
        }

        if (paths.length === 0) {
            console.warn('❌ paths가 비어있습니다');
            return;
        }

    // console.log('🗺️ 변환된 paths 개수:', paths.length);

        // 보라색 폴리곤 생성 (검색 필지용)
        const highlightPolygon = new naver.maps.Polygon({
            paths: paths,
            fillColor: '#9370DB', // 보라색 (Medium Purple)
            fillOpacity: 0.7,
            strokeColor: '#6A0DAD', // 진한 보라색 테두리
            strokeWeight: 3,
            strokeOpacity: 1.0,
            clickable: true, // 🖱️ 클릭 가능하도록 명시적으로 설정
            map: window.mapSearch || window.map
        });

        // 검색 필지 색상 고정 - setOptions 메서드 오버라이드
        const originalSetOptions = highlightPolygon.setOptions;
        highlightPolygon.setOptions = function(options) {
            // 검색 필지는 색상 변경을 무시하고 보라색 유지
            const fixedOptions = {
                ...options,
                fillColor: '#9370DB',
                fillOpacity: 0.7,
                strokeColor: '#6A0DAD',
                strokeWeight: 3,
                strokeOpacity: 1.0
            };
            console.log('🔍 검색 필지 색상 고정:', pnu);
            return originalSetOptions.call(this, fixedOptions);
        };

    // console.log('✅ 형광색 폴리곤 생성 완료');
    // console.log('🔍 폴리곤 paths 확인:', highlightPolygon.getPaths());
        
        // 강제로 지도에 다시 설정
        highlightPolygon.setMap(window.mapSearch || window.map);
    // console.log('🔄 폴리곤을 지도에 강제 설정 완료');
        
        // 폴리곤 중심에 라벨 표시 - 검은 글씨
        const coordsForCenter = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0];
        const center = calculatePolygonCenter(coordsForCenter);
    // console.log('📍 라벨 중심점:', center);
        
        const label = new naver.maps.Marker({
            position: new naver.maps.LatLng(center[1], center[0]),
            map: window.mapSearch || window.map, // 항상 표시
            icon: {
                content: `<div style="
                    padding: 8px 12px; 
                    background: rgba(255, 255, 255, 0.95); 
                    border: 2px solid #9370DB; 
                    border-radius: 6px; 
                    font-weight: bold; 
                    font-size: 13px; 
                    color: #6A0DAD; 
                    text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
                    box-shadow: 0 3px 8px rgba(106,13,173,0.3);
                    white-space: nowrap;
                    animation: searchPulse 2s ease-in-out infinite;
                ">${displayText}</div>
                <style>
                    @keyframes searchPulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                    }
                </style>`,
                anchor: new naver.maps.Point(0, 0)
            }
        });

    // console.log('✅ 라벨 생성 완료:', displayText);

        // window.searchParcels에 저장 - PNU 검증 및 고유 ID 생성
        let pnu = properties.PNU || properties.pnu;

        // PNU가 없거나 유효하지 않으면 고유 ID 생성
        if (!pnu || pnu === 'undefined' || pnu === 'null' || pnu === '') {
            pnu = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.log('🔍 검색 필지 고유 PNU 생성:', pnu);
        }

        const searchResult = {
            pnu: pnu,
            polygon: highlightPolygon,
            label: label,
            data: parcelData,
            displayText: displayText,
            colorType: 'search' // 검색 필지 구분자 추가
        };

        window.searchParcels.set(pnu, searchResult);
    // console.log('💾 searchParcels에 저장 완료, 총 개수:', window.searchParcels.size);

        // 검색 필지가 clickParcels에 잘못 추가되는 것을 방지
        if (window.clickParcels && window.clickParcels.has(pnu)) {
            console.log('🚫 검색 필지가 clickParcels에서 제거됨:', pnu);
            window.clickParcels.delete(pnu);
        }

        // currentSelectedPNU 설정 (저장 시 검색 필지로 인식되도록)
        window.currentSelectedPNU = pnu;
    // console.log('📌 currentSelectedPNU 설정:', pnu);

        // 🚫 검색 필지는 자동 저장하지 않음 (사용자가 명시적으로 저장할 때만)
        // saveSearchResultsToStorage(); // 주석 처리

        // 왼쪽 폼에 지번 자동 입력 (저장 없이 표시만)
        const parcelNumberInput = document.getElementById('parcelNumber');
        if (parcelNumberInput) {
            // formatJibun 함수 사용하여 지번 포맷팅
            const jibun = formatJibun(properties);

            // 🚫 자동 저장을 트리거하지 않도록 직접 값만 설정
            parcelNumberInput.value = jibun;
            console.log('📝 왼쪽 폼에 지번 표시 (저장 없음):', jibun);

            // 🚫 입력 이벤트 트리거 제거 (자동 저장 방지)
            // parcelNumberInput.dispatchEvent(new Event('input')); // 주석 처리
        }
        
        // 폴리곤 클릭 이벤트 추가 - 클릭 시 왼쪽 폼에 정보 입력 및 메모 기능 활성화
        // ⚠️ 무한 루프 방지: 이벤트 중복 등록 체크
        if (!highlightPolygon._searchEventAdded) {
            highlightPolygon._searchEventAdded = true;
            naver.maps.Event.addListener(highlightPolygon, 'click', async function(e) {
                // 이벤트 전파 중지 (무한 루프 방지)
                if (e && e.domEvent && typeof e.domEvent.stopPropagation === 'function') {
                    e.domEvent.stopPropagation();
                    e.domEvent.preventDefault();
                }

                console.log('🔍 검색 필지 전용 클릭 이벤트 실행:', pnu);

                const parcelNumberInput = document.getElementById('parcelNumber');
            if (parcelNumberInput) {
                // formatJibun 함수 사용하여 지번 포맷팅
                const jibun = formatJibun(properties);

                parcelNumberInput.value = jibun;
                console.log('🖱️ 검색 필지 클릭 - 지번 입력:', jibun);

                // 현재 클릭된 폴리곤의 PNU 찾기 (클로저 문제 해결)
                let clickedPNU = null;
                window.searchParcels.forEach((searchResult, searchPNU) => {
                    if (searchResult.polygon === highlightPolygon) {
                        clickedPNU = searchPNU;
                    }
                });

                if (!clickedPNU) {
                    clickedPNU = pnu; // 백업으로 원래 PNU 사용
                }

                window.currentSelectedPNU = clickedPNU;
                console.log('🎯 실제 클릭된 PNU:', clickedPNU);

                // 🗑️ 이미 보라색인 검색 필지 클릭 시 삭제 확인 다이얼로그 표시
                const searchParcel = window.searchParcels.get(clickedPNU);
                console.log('🔍 검색 필지 클릭 확인:', { clickedPNU, searchParcel, hasPolygon: !!searchParcel?.polygon });
                if (searchParcel && searchParcel.polygon) {
                    if (confirm(`검색 필지 "${displayText}"를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
                        console.log('🗑️ 검색 필지 삭제 시작:', clickedPNU);

                        try {
                            // ❌ 검색 필지는 Supabase에 저장된 데이터가 아니므로 삭제하지 않음
                            // 검색 필지는 VWorld API에서 가져온 임시 데이터이므로 메모리에서만 제거
                            console.log('🔍 검색 필지는 임시 데이터 - Supabase 삭제 건너뜀');

                            // 1. LocalStorage에서 삭제 (혹시 저장된 검색 필지가 있다면)
                            const savedData = JSON.parse(localStorage.getItem('parcelData') || '[]');
                            const updatedData = savedData.filter(item => {
                                return item.pnu !== clickedPNU && item.parcelNumber !== jibun;
                            });
                            localStorage.setItem('parcelData', JSON.stringify(updatedData));

                            // 3. 색상 정보 삭제
                            const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
                            delete parcelColors[clickedPNU];
                            localStorage.setItem('parcelColors', JSON.stringify(parcelColors));

                            // 4. 마커 상태 삭제
                            const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
                            delete markerStates[clickedPNU];
                            localStorage.setItem('markerStates', JSON.stringify(markerStates));

                            // 5. 지도에서 마커 제거
                            if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
                                const markerInfo = window.MemoMarkerManager.markers.get(clickedPNU);
                                if (markerInfo && markerInfo.marker) {
                                    markerInfo.marker.setMap(null);
                                    window.MemoMarkerManager.markers.delete(clickedPNU);
                                    console.log('✅ 마커 제거 완료:', clickedPNU);
                                }
                            }

                            // 6. 지도에서 폴리곤과 라벨 제거
                            if (searchParcel.polygon) {
                                searchParcel.polygon.setMap(null);
                            }
                            if (searchParcel.label) {
                                searchParcel.label.setMap(null);
                            }

                            // 7. searchParcels Map에서 제거
                            window.searchParcels.delete(clickedPNU);

                            // 8. localStorage 업데이트 (삭제된 상태 저장)
                            saveSearchResultsToStorage();

                            // 9. clickParcels에서도 제거 (혹시 있다면)
                            if (window.clickParcels && window.clickParcels.has(clickedPNU)) {
                                window.clickParcels.delete(clickedPNU);
                            }

                            // 9. 폼 초기화
                            document.getElementById('parcelForm').reset();
                            window.currentSelectedPNU = null;

                            console.log('✨ 검색 필지 삭제 완료:', jibun);
                            alert(`검색 필지 "${displayText}"가 삭제되었습니다.`);

                        } catch (error) {
                            console.error('❌ 검색 필지 삭제 실패:', error);
                            alert('필지 삭제 중 오류가 발생했습니다.');
                        }

                        return; // 삭제했으면 더 이상 진행하지 않음
                    }
                }

                // 검색 필지 색상을 다시 고정
                highlightPolygon.setOptions({
                    fillColor: '#9370DB',
                    fillOpacity: 0.7,
                    strokeColor: '#6A0DAD',
                    strokeWeight: 3,
                    strokeOpacity: 1.0
                });

                console.log('🔍 검색 필지 클릭 - 보라색 유지:', pnu);

                // 기존 저장된 데이터 로드 (메모가 있다면)
                await loadExistingParcelData(jibun, 'search');

                // 폼의 다른 필드도 초기화 또는 자동 입력 가능
                document.getElementById('ownerName')?.focus();

                console.log('📝 검색 필지 메모 기능 활성화:', pnu);
            }
            });
        }

    } catch (error) {
        console.error('💥 필지 하이라이트 실패:', error);
        console.error('오류 상세:', error.stack);
    }
}

// window.searchParcels가 정의되지 않았다면 초기화
if (typeof window.searchParcels === 'undefined') {
    window.searchParcels = new Map();
}

// localStorage 키 정의
const SEARCH_STORAGE_KEY = 'window.searchParcels';

// 검색 결과를 localStorage에 저장
function saveSearchResultsToStorage() {
    try {
        const searchData = [];
        window.searchParcels.forEach((result, pnu) => {
            // 폴리곤과 라벨은 저장하지 않고, 데이터만 저장
            searchData.push({
                pnu: result.pnu,
                data: result.data,
                displayText: result.displayText
            });
        });
        
        localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(searchData));
    // console.log('💾 검색 결과를 localStorage에 저장:', searchData.length + '개');
    } catch (error) {
        console.error('💥 검색 결과 저장 실패:', error);
    }
}

// localStorage에서 검색 결과 복원
function loadSearchResultsFromStorage() {
    try {
        const savedData = localStorage.getItem(SEARCH_STORAGE_KEY);
        if (!savedData) {
    // console.log('📂 저장된 검색 결과가 없습니다');
            return;
        }
        
        const searchData = JSON.parse(savedData);
    // console.log('📂 저장된 검색 결과를 복원:', searchData.length + '개');
        
        // 현재 모드를 먼저 체크
        const isSearchMode = window.currentMode === 'search';
    // console.log('🔍 현재 모드:', window.currentMode, '(검색 모드:', isSearchMode + ')');
        
        // 기존 검색 결과 초기화
        clearSearchResults();
        
        // 검색 모드일 때만 폴리곤을 지도에 표시
        if (isSearchMode) {
    // console.log('🔍 검색 모드이므로 검색 필지를 표시합니다');
            searchData.forEach(item => {
                highlightParcel(item.data);
            });
        } else {
    // console.log('🔧 클릭 모드이므로 검색 필지를 메모리에만 로드하고 표시하지 않습니다');
            // 데이터는 window.searchParcels에 저장하되 지도에는 표시하지 않음
            searchData.forEach(item => {
                const pnu = item.data.properties.PNU;
                if (pnu) {
                    // 폴리곤 없이 데이터만 저장
                    window.searchParcels.set(pnu, {
                        data: item.data,
                        polygon: null,
                        label: null
                    });
                }
            });
        }
        
    // console.log('✅ 검색 결과 복원 완료 (검색 필지 개수:', window.searchParcels.size + ')');
    } catch (error) {
        console.error('💥 검색 결과 복원 실패:', error);
        // 오류 발생 시 손상된 데이터 제거
        localStorage.removeItem(SEARCH_STORAGE_KEY);
    }
}

// 검색 결과 완전 초기화 (localStorage 포함)
function clearSearchResults() {
    try {
        // 지도에서 기존 검색 결과 제거
        if (window.searchParcels) {
            window.searchParcels.forEach((result) => {
                if (result.polygon) {
                    result.polygon.setMap(null);
                }
                if (result.label) {
                    result.label.setMap(null);
                }
            });
            window.searchParcels.clear();
        }
    // console.log('🧹 검색 결과 지도에서 제거 완료');
    } catch (error) {
        console.error('💥 검색 결과 제거 실패:', error);
    }
}

// localStorage에서 검색 결과 삭제
function removeSearchResultsFromStorage() {
    try {
        localStorage.removeItem(SEARCH_STORAGE_KEY);
    // console.log('🗑️ localStorage에서 검색 결과 삭제 완료');
    } catch (error) {
        console.error('💥 검색 결과 localStorage 삭제 실패:', error);
    }
}

// 검색 모드는 window.currentMode를 사용 ('search' 또는 'click')
// 초기값은 config.js에서 설정됨

// DOM 로드 완료 후 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', function() {
    // 검색 초기화 버튼
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
    // console.log('🧹 검색 초기화 버튼 클릭');
            clearSearchResults();
            removeSearchResultsFromStorage();
            alert('검색 결과가 초기화되었습니다.');
        });
    }
    
    // console.log('🎯 검색 관련 이벤트 리스너 설정 완료');
});

// 전역 변수로 interval 저장
let checkMapInterval = null;

// 기존 필지 색상 저장용
let hiddenParcels = [];

// 검색 모드 토글 기능 (전역 함수로 변경) - Supabase 저장 포함
async function toggleSearchMode() {
    // console.log('=== toggleSearchMode 시작 ===');
    // console.log('현재 currentMode:', window.currentMode);
    // console.log('clickParcels 상태:', window.clickParcels.size, '개');
    // console.log('searchParcels 상태:', window.searchParcels.size, '개');

    // 모드 전환
    const newMode = (window.currentMode === 'search') ? 'click' : 'search';
    window.currentMode = newMode;
    const toggleBtn = document.getElementById('searchToggleBtn');

    // 🎯 새로운 모드를 localStorage와 Supabase에 저장
    localStorage.setItem('current_mode', newMode);
    console.log('💾 localStorage에 모드 저장:', newMode);

    if (window.SupabaseManager) {
        try {
            await window.SupabaseManager.saveCurrentMode(newMode);
            console.log('🔄 검색 모드 저장 완료:', newMode);
        } catch (error) {
            console.error('❌ 검색 모드 저장 실패:', error);
        }
    }

    // console.log('새 currentMode:', window.currentMode);
    // console.log('toggleBtn 요소:', toggleBtn);
    
    if (!toggleBtn) {
        console.error('toggleBtn 요소를 찾을 수 없음!');
        return;
    }
    
    if (window.currentMode === 'search') {
        // 검색 모드: 클릭 필지 숨기고 검색 필지 표시
        toggleBtn.textContent = '검색 ON';
        toggleBtn.classList.add('active');

    // console.log('>> 검색 ON 모드로 전환');

        // 🚫 검색 모드에서 저장 버튼 비활성화
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.title = '검색 모드에서는 저장할 수 없습니다';
            console.log('🚫 검색 모드 - 저장 버튼 비활성화');
        }

        // 📍 검색 모드에서 모든 마커 숨김
        if (window.hideClickMarkers) window.hideClickMarkers();
        if (window.hideSearchMarkers) window.hideSearchMarkers();
        console.log('📍 검색 모드 - 모든 마커 숨김');

        // 클릭 필지 숨기기
    // console.log('클릭 필지 숨기기 시작...');
        window.hideClickParcels();
    // console.log('클릭 필지 숨기기 완료');

        // 검색 필지 표시 및 복원
    // console.log('검색 필지 표시 시작...');
        // localStorage에서 검색 결과 복원
        if (typeof loadSearchResultsFromStorage === 'function') {
            loadSearchResultsFromStorage();
        }
        window.showSearchParcels();
    // console.log('검색 필지 표시 완료');
        
    } else {
        // 클릭 모드: 검색 필지 숨기고 클릭 필지 표시
        toggleBtn.textContent = '검색 OFF';
        toggleBtn.classList.remove('active');

    // console.log('>> 검색 OFF (클릭) 모드로 전환');

        // ✅ 클릭 모드에서 저장 버튼 다시 활성화
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
            saveBtn.title = '';
            console.log('✅ 클릭 모드 - 저장 버튼 활성화');
        }

        // 검색 필지 숨기기 (데이터는 보존)
    // console.log('검색 필지 숨기기 시작...');
        window.hideSearchParcels();
        // clearSearchResults(); // 메모리에서 검색 결과 완전 제거 - 주석 처리
        // removeSearchResultsFromStorage(); // localStorage에서도 제거 - 주석 처리

        // 🧹 강화된 검색 필지 정리 시스템
        if (window.cleanupSearchParcelsFromClickMap) {
            window.cleanupSearchParcelsFromClickMap();
        }

        console.log('🧹 검색 OFF - 검색 필지 숨김 (데이터 보존)');
    // console.log('검색 필지 완전 정리 완료');

        // 클릭 필지 표시
    // console.log('클릭 필지 표시 시작...');
        window.showClickParcels();
    // console.log('클릭 필지 표시 완료');

        // Phase 3: 클릭 필지 마커 표시, 검색 필지 마커 숨김
        if (window.hideSearchMarkers) window.hideSearchMarkers();
        if (window.showClickMarkers) window.showClickMarkers();
    }

    // Phase 3: 검색 모드일 때 마커 처리
    if (window.currentMode === 'search') {
        // 클릭 필지 마커 숨김, 검색 필지 마커 표시
        if (window.hideClickMarkers) window.hideClickMarkers();
        if (window.showSearchMarkers) window.showSearchMarkers();
    }

    // console.log('=== toggleSearchMode 완료 ===');
}

// window 객체에도 연결 (호환성 유지)
window.toggleSearchMode = toggleSearchMode;

// 검색 결과 보이기
function showSearchResults() {
    // console.log('showSearchResults 호출, window.searchParcels 크기:', window.searchParcels.size);
    
    if (window.searchParcels.size === 0) {
    // console.log('표시할 검색 결과가 없음');
        return;
    }
    
    let showCount = 0;
    window.searchParcels.forEach((result, key) => {
    // console.log('검색 결과 표시:', key, result);
        if (result.polygon) {
            result.polygon.setMap(window.mapSearch || window.map);
            showCount++;
        }
        if (result.label) result.label.setMap(window.mapSearch || window.map);
        // 마커와 정보창은 더 이상 사용하지 않음
    });
    
    // console.log(`${showCount}개 검색 결과 표시 완료`);
}

// 검색 결과 숨기기
function hideSearchResults() {
    // console.log('hideSearchResults 호출, window.searchParcels 크기:', window.searchParcels.size);
    
    if (window.searchParcels.size === 0) {
    // console.log('숨길 검색 결과가 없음');
        return;
    }
    
    let hideCount = 0;
    window.searchParcels.forEach((result, key) => {
    // console.log('검색 결과 숨기기:', key, result);
        if (result.polygon) {
            result.polygon.setMap(null);
            hideCount++;
        }
        if (result.label) result.label.setMap(null);
        // 마커와 정보창은 더 이상 사용하지 않음
    });
    
    // console.log(`${hideCount}개 검색 결과 숨김 완료`);
}

// 주소/지번 검색 (레거시 함수 - SearchModeManager로 위임)
async function searchAddress(query) {
    // console.log('=== searchAddress 함수 시작 ===');
    // console.log('📍 검색어:', query);
    // console.log('🕒 시작 시간:', new Date().toLocaleString());

    // SearchModeManager가 있으면 그것을 사용 (중복 검색 방지)
    if (window.SearchModeManager && window.SearchModeManager.executeSearch) {
        console.log('SearchModeManager로 검색 위임');
        return window.SearchModeManager.executeSearch(query, 'all');
    }

    // SearchModeManager가 없을 때만 기존 로직 실행
    // 검색 시 자동으로 검색 모드로 전환
    if (window.currentMode !== 'search') {
        window.currentMode = 'search';
        const btn = document.getElementById('searchToggleBtn');
        if (btn) {
            btn.textContent = '검색 ON';
            btn.classList.add('active');
        }
    // console.log('🔄 검색 모드로 자동 전환됨');

        // 클릭 필지 숨기고 검색 필지 표시
        window.hideClickParcels();
        window.showSearchParcels();
    }
    
    // 검색이 시작되면 checkMapInterval 클리어
    if (checkMapInterval) {
    // console.log('⏹️ checkMapInterval 정리');
        clearInterval(checkMapInterval);
        checkMapInterval = null;
    }
    
    // 검색 모드에서 기존 필지 숨기기
    // console.log('👻 기존 필지 숨기기 실행');
    hideExistingParcels();
    
    // 🗺️ 지도 객체 확인 (3-지도 시스템 호환)
    const hasMapInstance = window.map || window.mapClick || window.mapSearch || window.mapHand;
    // console.log('🗺️ 지도 인스턴스 확인:', hasMapInstance);
    if (!hasMapInstance) {
        console.error('❌ 지도가 초기화되지 않았습니다.');
        console.warn('⚠️ 지도 로딩 중... 콘솔 경고로 처리');
        // alert('지도가 아직 로딩 중입니다. 잠시 후 다시 시도해주세요.'); // 다이얼로그 제거
        return;
    }
    
    // 네이버 지도 Service 확인
    // console.log('📡 naver.maps.Service 확인:', naver?.maps?.Service);
    if (!naver || !naver.maps || !naver.maps.Service) {
        console.error('❌ 네이버 지도 API가 로드되지 않았습니다.');
        console.warn('⚠️ 지도 API 로딩 중... 콘솔 경고로 처리');
        // alert('지도 API가 로딩 중입니다. 잠시 후 다시 시도해주세요.'); // 다이얼로그 제거
        return;
    }
    
    // console.log('✅ 사전 확인 완료, 지오코딩 API 호출 시작');
    
    // 네이버 Geocoding API로 주소 검색
    try {
        naver.maps.Service.geocode({
            query: query
        }, function(status, response) {
    // console.log('Geocoding 상태:', status);
    // console.log('Geocoding 응답:', response);
            
            if (status !== naver.maps.Service.Status.OK) {
    // console.log('Geocoding 실패, 지번 검색 시도');
                // Geocoding 실패 시 지번 검색 시도
                searchParcelByJibun(query);
                return;
            }
            
            const result = response.v2.addresses[0];
            if (!result) {
    // console.log('주소 결과 없음, 지번 검색 시도');
                searchParcelByJibun(query);
                return;
            }
            
            // 좌표 변환
            const lat = parseFloat(result.y);
            const lng = parseFloat(result.x);
            const point = new naver.maps.LatLng(lat, lng);
            
    // console.log('주소 검색 성공:', result);
    // console.log('좌표:', lat, lng);
            
            if (result && result.addressElements) {
                const addressElements = result.addressElements;
                let fullAddress = '';
                
                addressElements.forEach(element => {
                    if (element.longName && element.types.includes('POSTAL_CODE') === false) {
                        fullAddress += element.longName + ' ';
                    }
                });
                
                const item = {
                    address: fullAddress.trim(),
                    point: point
                };
                
    // console.log('주소 검색 성공:', item);
                
                // 지도 이동 - 검색 모드 지도 사용
                const searchMap = window.mapSearch || window.map;
                if (searchMap) {
                    searchMap.setCenter(point);
                    searchMap.setZoom(18);
                } else {
                    console.error('검색 모드 지도를 찾을 수 없습니다.');
                }
                
                // 해당 위치의 필지를 검색용으로 조회 (노란색 표시)
                searchParcelAtLocation(point.lat(), point.lng());
            }
        });
    } catch (error) {
        console.error('주소 검색 실패:', error);
        alert('검색 중 오류가 발생했습니다.');
    }
}

// 지번으로 필지 검색
async function searchParcelByJibun(jibun) {
    console.log('🔍 새로운 검색 시작:', jibun);

    // 🗺️ 지도 객체 확인 (3-지도 시스템 호환)
    const hasMapInstance = window.map || window.mapClick || window.mapSearch || window.mapHand;
    if (!hasMapInstance) {
        console.error('지도가 초기화되지 않았습니다.');
        console.warn('⚠️ 지도 로딩 중... 콘솔 경고로 처리');
        // alert('지도가 아직 로딩 중입니다. 잠시 후 다시 시도해주세요.'); // 다이얼로그 제거
        return;
    }

    // 🔥 새로운 검색 시작 시 기존 검색 결과 완전 정리
    console.log('🧹 기존 검색 결과 정리 중...');
    clearSearchResults();
    removeSearchResultsFromStorage();
    
    // 더 넓은 범위로 검색 - 서울 전체 영역
    // 현재 모드에 따른 지도 인스턴스 선택
    const currentMap = window.mapSearch || window.map || window.mapClick;
    if (!currentMap) {
        console.error('검색 모드 지도를 찾을 수 없습니다.');
        return;
    }
    const center = currentMap.getCenter();
    const centerLat = center.lat();
    const centerLng = center.lng();
    
    // 검색 범위를 크게 확장 (약 50km 반경)
    const expandedBounds = {
        minLat: centerLat - 0.45,  
        maxLat: centerLat + 0.45,
        minLng: centerLng - 0.45,  
        maxLng: centerLng + 0.45
    };
    
    // JSONP 방식으로 API 호출
    const apiKey = 'E5B1657B-9B6F-3A4B-91EF-98512BE931A1'; // 범용 VWorld API 키
    const callbackName = `searchCallback_${Date.now()}`;
    
    return new Promise((resolve) => {
        // script 변수를 먼저 선언
        let script;

        window[callbackName] = function(data) {
    // console.log('지번 검색 API 응답:', data);

            // 콜백 함수 정리
            delete window[callbackName];
            if (script && script.parentNode) {
                document.head.removeChild(script);
            }
            
            if (!data.response || data.response.status !== 'OK' || !data.response.result?.featureCollection?.features) {
                console.warn('VWorld API 응답 없음 또는 데이터 없음');

                // SearchModeManager UI 업데이트
                if (window.SearchModeManager) {
                    window.SearchModeManager.searchResults = [];
                    window.SearchModeManager.renderSearchResults([]);
                }

                resolve([]);
                return;
            }
            
            const features = data.response.result.featureCollection.features;
            
            // 지번으로 필터링
            const matchingParcels = features.filter(feature => {
                const properties = feature.properties;
                const parcelJibun = formatJibun(properties);
                const searchJibun = jibun.replace(/\s/g, '').toLowerCase();
                const targetJibun = parcelJibun.replace(/\s/g, '').toLowerCase();
                
    // console.log('지번 비교:', {
    //                 search: searchJibun,
    //                 target: targetJibun,
    //                 match: targetJibun.includes(searchJibun) || searchJibun.includes(targetJibun)
    //             });
                
                return targetJibun.includes(searchJibun) || searchJibun.includes(targetJibun);
            });
            
    // console.log('매칭된 필지 수:', matchingParcels.length);
            
            if (matchingParcels.length === 0) {
                console.warn('매칭되는 지번 없음:', jibun);

                // SearchModeManager가 있고 검색 결과가 아직 없을 때만 alert 표시
                if (window.SearchModeManager) {
                    // 이미 다른 검색 결과가 있으면 alert 표시 안함
                    if (window.SearchModeManager.searchResults.length === 0) {
                        alert('해당 지번의 필지를 찾을 수 없습니다.');
                    }
                    window.SearchModeManager.searchResults = [];
                    window.SearchModeManager.renderSearchResults([]);
                }

                resolve([]);
                return;
            }

            // 검색 결과를 SearchModeManager 형식으로 변환
            const results = matchingParcels.map(feature => {
                const properties = feature.properties || {};
                const geometry = feature.geometry;
                const coords = geometry.type === 'MultiPolygon'
                    ? geometry.coordinates[0][0]
                    : geometry.coordinates[0];
                const center = calculatePolygonCenter(coords);

                return {
                    pnu: properties.PNU || `JIBUN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    parcelName: formatJibun(properties),
                    ownerName: properties.OWNER_NM || '-',
                    ownerAddress: properties.JUSO || '-',
                    lat: center[1],
                    lng: center[0],
                    geometry: geometry
                };
            });

            // SearchModeManager에 결과 전달
            if (window.SearchModeManager) {
                window.SearchModeManager.searchResults = results;
                window.SearchModeManager.renderSearchResults(results);
            }

            // 첫 번째 매칭 필지로 지도 이동
            const firstFeature = matchingParcels[0];
            if (firstFeature.geometry && firstFeature.geometry.coordinates) {
                const coords = firstFeature.geometry.type === 'MultiPolygon'
                    ? firstFeature.geometry.coordinates[0][0]
                    : firstFeature.geometry.coordinates[0];
                const center = calculatePolygonCenter(coords);
                const searchMap = window.mapSearch || window.map;
                if (searchMap) {
                    searchMap.setCenter(new naver.maps.LatLng(center[1], center[0]));
                    searchMap.setZoom(18);
                } else {
                    console.error('검색 모드 지도를 찾을 수 없습니다.');
                }

    // console.log('지도 이동 완료:', center);
            }
            
            // 모든 매칭 필지를 검색 결과로 하이라이트
            matchingParcels.forEach(parcel => {
                highlightParcel(parcel);
            });
            
    // console.log(`${matchingParcels.length}개 필지 하이라이트 완료`);
            resolve(results);
        };
        
        // 타임아웃 처리
        const timeout = setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                console.error('지번 검색 타임아웃');
                alert('검색 시간이 초과되었습니다.');
                resolve([]);
            }
        }, 10000);
        
        // JSONP 스크립트 추가
        script = document.createElement('script');
        script.src = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${apiKey}&geometry=true&geomFilter=BOX(${expandedBounds.minLng},${expandedBounds.minLat},${expandedBounds.maxLng},${expandedBounds.maxLat})&size=1000&format=json&crs=EPSG:4326&callback=${callbackName}&domain=http://localhost:3000`;
        script.onerror = () => {
            clearTimeout(timeout);
            delete window[callbackName];
            console.error('지번 검색 스크립트 로드 실패');
            alert('검색 중 오류가 발생했습니다.');
            resolve([]);
        };
        document.head.appendChild(script);
    });
}

// 두 번째 highlightParcel 함수는 첫 번째 함수와 중복되므로 제거됨
// 첫 번째 highlightParcel 함수 (line 29)를 사용하세요

// 검색 결과 하이라이트 함수는 더 이상 사용하지 않음 - 필지만 표시

// VWorld API로 실제 필지 데이터 가져오기
async function getParcelForSearch(lat, lng) {
    // console.log(`🏢 검색용 실제 필지 정보 조회 시작: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    
    const apiKeys = [
        'E5B1657B-9B6F-3A4B-91EF-98512BE931A1', // 메인: 범용키 (제한없음)
        'C1C06245-E008-3F27-BD9E-9CBA4BE0F918', // 백업: localhost:3000
        '200C6A0D-D0A2-3E72-BADD-B385BB283CAE', // 백업: localhost:4000
        '37325C63-ACC1-39FA-949D-F4E7F4C9BCF3'  // 백업: localhost:5000
    ];
    
    // JSONP를 우선적으로 시도
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
    // console.log(`🔑 검색용 JSONP 시도 - API 키 ${i+1}/${apiKeys.length}`);
        
        try {
            const result = await new Promise((resolve) => {
                const callbackName = `vworld_search_callback_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                
                window[callbackName] = function(data) {
                    delete window[callbackName];
                    const script = document.querySelector(`script[src*="${callbackName}"]`);
                    if (script) script.remove();
                    
                    if (data && data.response && data.response.status === 'OK') {
                        const features = data.response.result?.featureCollection?.features;
                        if (features && features.length > 0) {
    // console.log('🎊 검색용 필지 데이터 획득 성공!');
                            resolve(features[0]); // 첫 번째 필지 반환
                        } else {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                };
                
                const script = document.createElement('script');
                script.src = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${apiKey}&geometry=true&geomFilter=POINT(${lng} ${lat})&size=1&format=json&crs=EPSG:4326&callback=${callbackName}&domain=http://localhost:3000`;
                script.onerror = () => {
                    delete window[callbackName];
                    script.remove();
                    resolve(null);
                };
                
                document.head.appendChild(script);
                
                // 타임아웃 설정
                setTimeout(() => {
                    if (window[callbackName]) {
                        delete window[callbackName];
                        script.remove();
                        resolve(null);
                    }
                }, 3000);
            });
            
            if (result) {
                return result;
            }
        } catch (error) {
    // console.log(`⚠️ 검색용 API 키 ${i+1} 실패:`, error);
        }
    }
    
    // console.log('❌ 모든 검색용 API 키 실패');
    return null;
}

// Nominatim API로 특정 위치의 주소 정보 검색
async function searchParcelAtLocation(lat, lng) {
    // console.log('🎯 위치 기반 필지 검색 시작:', lat, lng);
    
    try {
        // VWorld API로 실제 필지 데이터 가져오기
        const parcelData = await getParcelForSearch(lat, lng);
        
        if (parcelData) {
    // console.log('✅ 실제 필지 데이터를 찾았습니다. 하이라이트 시작...');
            highlightParcel(parcelData);
    // console.log('🎉 필지 하이라이트 완료');
        } else {
            // VWorld에서 못 찾으면 Nominatim으로 대체
    // console.log('⚠️ VWorld에서 필지를 찾지 못해 Nominatim으로 대체합니다.');
            
            const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    // console.log('📡 Nominatim API 요청 URL:', apiUrl);
            
            const response = await fetch(apiUrl, {
                headers: {
                    'User-Agent': 'NAVER Maps Field Management Program'
                }
            });
            
            if (!response.ok) {
                throw new Error('Nominatim API 요청 실패');
            }
            
            const data = await response.json();
    // console.log('📋 Nominatim 위치 검색 응답:', data);
            
            if (data && data.address) {
    // console.log('✅ 위치 정보를 찾았습니다. 하이라이트 시작...');
                
                // Nominatim 응답을 필지 형태로 변환 (더 큰 폴리곤으로)
                const parcel = createParcelFromNominatimForSearch(data, lat, lng);
    // console.log('🎨 생성된 필지 데이터:', parcel);
                
                highlightParcel(parcel);
    // console.log('🎉 1개 위치 하이라이트 완료');
            } else {
                console.warn('❌ 해당 위치에서 주소 정보를 찾을 수 없습니다.');
                alert('해당 위치에서 주소 정보를 찾을 수 없습니다.');
            }
        }
    } catch (error) {
        console.error('💥 위치 기반 필지 검색 실패:', error);
        alert('필지 검색 중 오류가 발생했습니다.');
    }
}

// Nominatim 응답을 검색용 필지 형태로 변환
function createParcelFromNominatimForSearch(nominatimData, lat, lng) {
    const address = nominatimData.address || {};
    const displayName = nominatimData.display_name || '';
    
    // 한국 주소 체계에 맞는 지번 생성
    const dong = address.quarter || address.suburb || address.neighbourhood || '';
    const roadName = address.road || '';
    const houseNumber = address.house_number || '';
    
    // 지번 형식으로 변환
    let jibun = '';
    if (dong && houseNumber) {
        jibun = `${dong} ${houseNumber}`;
    } else if (roadName && houseNumber) {
        jibun = `${roadName} ${houseNumber}`;
    } else if (displayName) {
        const parts = displayName.split(',');
        jibun = parts[0].trim();
    } else {
        jibun = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    }
    
    // 다각형 생성 (중심점 주변 사각형)
    const size = 0.0005; // 약 50m (실제 필지 못 찾을 때 대체용)
    const coordinates = [
        [[
            [lng - size, lat - size],
            [lng + size, lat - size], 
            [lng + size, lat + size],
            [lng - size, lat + size],
            [lng - size, lat - size]
        ]]
    ];
    
    return {
        geometry: {
            type: "MultiPolygon",
            coordinates: coordinates
        },
        properties: {
            JIBUN: jibun,
            PNU: `OSM_${nominatimData.place_id || Date.now()}`,
            ADDR: displayName,
            sggnm: address.borough || address.county || '',
            ldong: dong,
            lnbrMnnm: houseNumber
        }
    };
}


// 기존 필지 숨기기
function hideExistingParcels() {
    // console.log('hideExistingParcels 호출, parcels 크기:', window.parcels?.size || 0);
    
    if (!window.parcels || window.parcels.size === 0) {
    // console.log('숨길 기존 필지가 없음');
        return;
    }
    
    hiddenParcels = [];
    let hideCount = 0;
    
    window.parcels.forEach((parcelData, pnu) => {
        if (parcelData.polygon && parcelData.polygon.getMap()) {
            // 현재 상태 저장
            hiddenParcels.push({
                pnu: pnu,
                polygon: parcelData.polygon,
                visible: true
            });
            
            // 지도에서 제거
            parcelData.polygon.setMap(null);
            hideCount++;
    // console.log(`필지 ${hideCount} 숨김 완료: ${pnu}`);
        }
    });
    
    // console.log(`${hideCount}개 기존 필지 숨김 완료`);
}

// 기존 필지 복원
function showExistingParcels() {
    // console.log('showExistingParcels 호출, hiddenParcels 수:', hiddenParcels.length);
    
    if (hiddenParcels.length === 0) {
    // console.log('복원할 필지가 없음');
        return;
    }
    
    let restoreCount = 0;
    hiddenParcels.forEach((item, index) => {
        if (item.visible && item.polygon) {
            item.polygon.setMap(window.mapSearch || window.map);
            restoreCount++;
    // console.log(`필지 ${index + 1} 복원 완료`);
        }
    });
    
    // console.log(`기존 필지 ${restoreCount}개 복원 완료`);
    hiddenParcels = [];
}

// 지도와 API가 로드된 후에 이벤트 리스너 등록
function initSearchEventListeners() {
    // console.log('=== search.js 이벤트 리스너 초기화 시작 ===');
    // console.log('현재 시간:', new Date().toLocaleString());
    
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    
    // console.log('searchBtn 요소:', searchBtn);
    // console.log('searchInput 요소:', searchInput);
    
    if (!searchBtn) {
        console.error('❌ searchBtn을 찾을 수 없습니다');
        return;
    }
    
    if (!searchInput) {
        console.error('❌ searchInput을 찾을 수 없습니다');
        return;
    }
    
    // console.log('✅ HTML 요소 찾기 성공');
    
    // 검색 버튼
    searchBtn.addEventListener('click', () => {
    // console.log('🔍 검색 버튼 클릭됨!');
    // console.log('현재 시간:', new Date().toLocaleString());
        const query = searchInput.value.trim();
    // console.log('입력된 검색어:', `"${query}"`);

        if (query) {
    // console.log('✅ 검색어 유효함, SearchModeManager 사용');
            // SearchModeManager가 있으면 그것을 사용, 없으면 searchAddress 사용
            if (window.SearchModeManager && window.SearchModeManager.executeSearch) {
                window.SearchModeManager.executeSearch(query, 'all');
            } else {
                searchAddress(query);
            }
        } else {
    // console.log('❌ 검색어가 비어있음');
            alert('검색어를 입력하세요');
        }
    });

    // 엔터키로 검색
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
    // console.log('엔터키 검색');
            const query = e.target.value.trim();
            if (query) {
    // console.log('검색 실행:', query);
                // SearchModeManager가 있으면 그것을 사용, 없으면 searchAddress 사용
                if (window.SearchModeManager && window.SearchModeManager.executeSearch) {
                    window.SearchModeManager.executeSearch(query, 'all');
                } else {
                    searchAddress(query);
                }
            } else {
                alert('검색어를 입력하세요');
            }
        }
    });
    
    // 검색 토글 버튼 초기 상태 설정
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    if (searchToggleBtn) {
        if (window.currentMode === 'search') {
            searchToggleBtn.textContent = '검색 ON';
            searchToggleBtn.classList.add('active');
        } else {
            searchToggleBtn.textContent = '검색 OFF';
            searchToggleBtn.classList.remove('active');
        }
        
    // console.log('검색 토글 버튼 초기 상태 설정 완료. onclick="toggleSearchMode()" 사용');
    } else {
        console.error('searchToggleBtn을 찾을 수 없습니다. DOM 요소 확인:', document.getElementById('searchToggleBtn'));
    }
    
    // console.log('🎯 이벤트 리스너 등록 완료');
    // console.log('✅ searchBtn 클릭 이벤트:', '등록됨');
    // console.log('✅ searchInput 엔터키 이벤트:', '등록됨');
    // console.log('=== initSearchEventListeners 완료 ===');
}

// DOMContentLoaded 이벤트
document.addEventListener('DOMContentLoaded', function() {
    // console.log('🚀 search.js DOMContentLoaded 실행');
    // console.log('📍 현재 시간:', new Date().toLocaleString());
    
    // 초기 모드 설정 (클릭 모드 = 검색 OFF)
    window.currentMode = 'click';
    window.showClickParcels();
    window.hideSearchParcels();
    
    // 버튼 초기 상태 설정
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    if (searchToggleBtn) {
        searchToggleBtn.textContent = '검색 OFF';
        searchToggleBtn.classList.remove('active');
    }
    
    // console.log('🔧 초기 모드 설정: 클릭 모드 (검색 OFF)');
    
    // 지도가 초기화될 때까지 기다림
    // console.log('⏳ 지도 및 API 로딩 상태 체크 시작...');
    checkMapInterval = setInterval(() => {
    // console.log('🔍 지도 상태 체크:');
    // console.log('  - window.map:', !!window.map);
    // console.log('  - naver:', !!naver);
    // console.log('  - naver.maps:', !!(naver?.maps));
    // console.log('  - naver.maps.Service:', !!(naver?.maps?.Service));
        
        // 🗺️ 3-지도 시스템 또는 기존 지도 확인
        const hasMapInstance = window.map || window.mapClick || window.mapSearch || window.mapHand;

        if (hasMapInstance && naver && naver.maps && naver.maps.Service) {
            clearInterval(checkMapInterval);
            checkMapInterval = null;
    // console.log('✅ 지도 및 API 로드 완료, 검색 이벤트 리스너 등록');
            initSearchEventListeners();
        } else {
    // console.log('⏳ 지도 또는 API 로딩 대기 중...');
        }
    }, 500);
    
    // 10초 후에도 로드되지 않으면 에러 (다이얼로그 제거)
    setTimeout(() => {
        if (checkMapInterval) {
            clearInterval(checkMapInterval);
            checkMapInterval = null;
            console.error('지도 초기화 시간 초과');
            console.warn('⚠️ 지도 로딩 실패 - 다이얼로그 대신 콘솔 경고로 처리');
            // alert('지도 로딩에 실패했습니다. 페이지를 새로고침해주세요.'); // 다이얼로그 제거
        }
    }, 10000);
});

// 검색 결과 전체 지우기 (parcel.js에서 사용)
function clearAllSearchResults() {
    // console.log('검색 결과 전체 지우기');
    
    if (window.searchParcels.size === 0) {
    // console.log('지울 검색 결과가 없음');
        return;
    }
    
    window.searchParcels.forEach((result, key) => {
        if (result.polygon) result.polygon.setMap(null);
        if (result.label) result.label.setMap(null);
        // 마커와 정보창은 더 이상 사용하지 않음
    });
    
    window.searchParcels.clear();
    // console.log('모든 검색 결과 제거 완료');
}

// 주소로 검색하는 함수 (네이버 Geocoding API 사용)
async function searchAddressByKeyword(keyword) {
    console.log('🔍 주소 검색 시작:', keyword);

    // 검색 결과 초기화
    clearSearchResults();
    removeSearchResultsFromStorage();

    // 현재 지도 확인
    const searchMap = window.mapSearch || window.map;
    if (!searchMap) {
        console.error('검색 모드 지도를 찾을 수 없습니다.');
        return [];
    }

    try {
        // 네이버 Geocoding API 사용
        if (naver && naver.maps && naver.maps.Service) {
            return new Promise((resolve) => {
                naver.maps.Service.geocode({
                    query: keyword
                }, async function(status, response) {
                    if (status === naver.maps.Service.Status.ERROR) {
                        console.error('주소 검색 실패');
                        alert('주소를 찾을 수 없습니다.');
                        resolve([]);
                        return;
                    }

                    const items = response.v2.addresses;
                    if (items && items.length > 0) {
                        console.log(`🎯 ${items.length}개 검색 결과 발견`);

                        // 첫 번째 결과로 지도 이동
                        const first = items[0];
                        const point = new naver.maps.LatLng(first.y, first.x);
                        searchMap.setCenter(point);
                        searchMap.setZoom(18);

                        // 검색 결과를 SearchModeManager 형식으로 변환
                        const results = items.map(item => ({
                            pnu: `ADDR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            parcelName: item.roadAddress || item.jibunAddress || item.englishAddress,
                            ownerName: '-',
                            ownerAddress: item.roadAddress || item.jibunAddress,
                            lat: parseFloat(item.y),
                            lng: parseFloat(item.x),
                            geometry: {
                                type: "Polygon",
                                coordinates: [[
                                    [parseFloat(item.x) - 0.0002, parseFloat(item.y) - 0.0002],
                                    [parseFloat(item.x) + 0.0002, parseFloat(item.y) - 0.0002],
                                    [parseFloat(item.x) + 0.0002, parseFloat(item.y) + 0.0002],
                                    [parseFloat(item.x) - 0.0002, parseFloat(item.y) + 0.0002],
                                    [parseFloat(item.x) - 0.0002, parseFloat(item.y) - 0.0002]
                                ]]
                            }
                        }));

                        // SearchModeManager에 결과 전달
                        if (window.SearchModeManager) {
                            window.SearchModeManager.searchResults = results;
                            window.SearchModeManager.renderSearchResults(results);
                        }

                        // 첫 번째 위치에서 실제 필지도 검색
                        searchParcelAtLocation(first.y, first.x);

                        resolve(results);
                    } else {
                        console.warn('검색 결과가 없습니다.');
                        alert('검색 결과가 없습니다.');

                        // SearchModeManager UI 업데이트
                        if (window.SearchModeManager) {
                            window.SearchModeManager.searchResults = [];
                            window.SearchModeManager.renderSearchResults([]);
                        }

                        resolve([]);
                    }
                });
            });
        } else {
            // 네이버 API를 사용할 수 없으면 지번 검색으로 폴백
            console.warn('네이버 Geocoding API를 사용할 수 없습니다. 지번 검색으로 시도합니다.');
            const results = await searchParcelByJibun(keyword);
            return results || [];
        }
    } catch (error) {
        console.error('주소 검색 오류:', error);
        alert('검색 중 오류가 발생했습니다.');
        return [];
    }
}

// 전역 함수로 노출
window.clearAllSearchResults = clearAllSearchResults;
window.loadSearchResultsFromStorage = loadSearchResultsFromStorage;
window.saveSearchResultsToStorage = saveSearchResultsToStorage;
window.removeSearchResultsFromStorage = removeSearchResultsFromStorage;
window.searchAddressByKeyword = searchAddressByKeyword;
window.searchParcelByJibun = searchParcelByJibun;
window.searchParcelAtLocation = searchParcelAtLocation;