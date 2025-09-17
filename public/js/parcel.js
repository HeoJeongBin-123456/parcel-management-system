// 필지 관련 기능

// 폴리곤 중심점 계산 함수 (메모 마커용)
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

// 📍 필지 정보 조회 메인 함수 (모드별 핸들러로 라우팅)
async function getParcelInfo(lat, lng) {
    const currentMode = window.currentMode || 'click';

    console.log(`🏢 필지 정보 조회 (${currentMode} 모드): ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

    // 모드별 전용 핸들러로 라우팅
    switch(currentMode) {
        case 'click':
            if (window.getParcelInfoForClickMode) {
                return await window.getParcelInfoForClickMode(lat, lng);
            }
            break;
        case 'search':
            console.log('🔍 검색 모드에서는 직접 필지 조회 불가');
            return;
        case 'hand':
            console.log('✋ 손 모드에서는 필지 조회 불가');
            return;
        default:
            console.warn('⚠️ 알 수 없는 모드:', currentMode);
    }
}

// ❌ 중복 제거: getParcelInfoViaProxy, getParcelInfoViaJSONP
// 📍 이제 모드별 핸들러에서 처리:
// - mode-click-handler.js: getParcelInfoViaProxyForClickMode, getParcelInfoViaJSONPForClickMode
// - mode-search-handler.js: 해당 기능들




// VWorld API로 영역 내 실제 필지 폴리곤 데이터 로드
async function loadParcelsInBounds(bounds) {
    // 검색 모드에서는 자동으로 필지를 로드하지 않음
    if (window.currentMode === 'search') {
        // 검색 모드에서는 자동 필지 로드를 건너뜀
        return;
    }
    
    // console.log('🏘️ VWorld API로 영역 내 실제 필지 데이터 로드 시작');
    
    const ne = bounds.getNE();
    const sw = bounds.getSW();
    
    // 경계 박스 생성 (서남쪽 경도, 서남쪽 위도, 동북쪽 경도, 동북쪽 위도)
    const bbox = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`;
    // console.log('🗺️ 검색 영역 (BBOX):', bbox);
    
    // API 키 풀 (메인: 범용키, 백업: 로컬호스트 제한키들)
    const apiKeys = [
        'E5B1657B-9B6F-3A4B-91EF-98512BE931A1', // 메인: 범용키 (제한없음)
        'C1C06245-E008-3F27-BD9E-9CBA4BE0F918', // 백업: localhost:3000
        '200C6A0D-D0A2-3E72-BADD-B385BB283CAE', // 백업: localhost:4000
        '37325C63-ACC1-39FA-949D-F4E7F4C9BCF3'  // 백업: localhost:5000
    ];
    
    // CORS 우회를 위해 JSONP를 우선적으로 시도
    for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
        const apiKey = apiKeys[keyIndex];
    // console.log(`🔑 JSONP 폴리곤 우선 시도 - API 키 ${keyIndex+1}/${apiKeys.length}: ${apiKey.substring(0, 8)}...`);
        
        const result = await loadParcelsInBoundsViaJSONP(bounds, apiKey);
        if (result > 0) {
    // console.log(`🎊 JSONP로 실제 폴리곤 데이터 획득 성공! ${result}개 필지`);
            return; // 성공 시 함수 종료
        }
        
    // console.log(`⚠️ JSONP 폴리곤 API 키 ${keyIndex+1} 실패, 다음 키로 시도...`);
    }
    
    // JSONP가 모든 키로 실패한 경우 메시지 출력
    // console.log('⚠️ 모든 API 키로 필지 데이터를 가져오지 못했습니다.');
    // console.log('💡 VWorld API는 CORS 정책으로 인해 JSONP만 지원합니다.');
}

// JSONP 방식으로 VWorld API 폴리곤 로드
async function loadParcelsInBoundsViaJSONP(bounds, apiKey) {
    // console.log('🌐 JSONP 방식으로 VWorld 폴리곤 API 재시도...');
    
    const ne = bounds.getNE();
    const sw = bounds.getSW();
    const bbox = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`;
    
    return new Promise((resolve) => {
        const callbackName = `vworld_polygon_callback_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const script = document.createElement('script');
        
        // JSONP 콜백 함수 등록
        window[callbackName] = function(data) {
    // console.log('📡 폴리곤 JSONP 응답 수신:', data);
            
            try {
                if (data.response && data.response.status === 'OK' && data.response.result) {
                    const features = data.response.result.featureCollection?.features;
                    
                    if (features && features.length > 0) {
    // console.log(`🎊 JSONP로 실제 폴리곤 데이터 획득! ${features.length}개`);
                        
                        let loadedCount = 0;
                        features.forEach((feature, index) => {
                            const pnu = feature.properties?.PNU || feature.properties?.pnu || `UNKNOWN_${index}`;
                            
                            if (!window.clickParcels.has(pnu)) {
                                try {
                                    const polygon = drawParcelPolygon(feature, false);
                                    if (polygon) {
                                        loadedCount++;
    // console.log(`✅ JSONP 폴리곤 그리기: ${feature.properties?.JIBUN || pnu}`);
                                    }
                                } catch (drawError) {
                                    console.warn(`⚠️ JSONP 필지 ${pnu} 그리기 실패:`, drawError);
                                }
                            }
                        });
                        
    // console.log(`🎉 JSONP 폴리곤 로드 완료: ${loadedCount}개`);
                        resolve(loadedCount);
                        
                    } else {
    // console.log('📭 JSONP: 빈 폴리곤 결과');
                        resolve(0);
                    }
                } else {
                    console.warn('⚠️ JSONP: 예상하지 못한 폴리곤 응답');
                    resolve(0);
                }
            } finally {
                // 정리
                document.head.removeChild(script);
                delete window[callbackName];
            }
        };
        
        // JSONP 요청 URL 생성
        const url = `http://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${apiKey}&geometry=true&geomFilter=BOX(${bbox})&size=100&format=json&crs=EPSG:4326&callback=${callbackName}`;
        
        script.src = url;
        script.onerror = () => {
            console.error('💥 JSONP 폴리곤 요청 실패');
            document.head.removeChild(script);
            delete window[callbackName];
            resolve(0);
        };
        
        document.head.appendChild(script);
        
        // 15초 타임아웃 (폴리곤 데이터는 더 클 수 있음)
        setTimeout(() => {
            if (document.head.contains(script)) {
                console.warn('⏱️ JSONP 폴리곤 타임아웃');
                document.head.removeChild(script);
                delete window[callbackName];
                resolve(0);
            }
        }, 15000);
    });
}


// 필지 폴리곤 그리기
async function drawParcelPolygon(parcel, isSelected = false) {
    const geometry = parcel.geometry;
    const properties = parcel.properties;
    const pnu = properties.PNU || properties.pnu;
    const jibun = formatJibun(properties);
    
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        const paths = [];
        const coordinates = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
        
        coordinates.forEach(polygon => {
            polygon[0].forEach(coord => {
                paths.push(new naver.maps.LatLng(coord[1], coord[0]));
            });
        });
        
        // 저장된 필지 정보 확인 (PNU와 지번 둘 다 확인)
        let savedParcel = await getSavedParcelData(pnu);
        if (!savedParcel && jibun) {
            savedParcel = await getSavedParcelDataByJibun(jibun);
        }

        // LocalStorage에서 색상 상태 확인
        let fillColor = 'transparent';
        let fillOpacity = 0;

        // 1. parcelColors에서 색상 확인 (우선순위 높음)
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
        if (parcelColors[pnu] && parcelColors[pnu].color) {
            fillColor = parcelColors[pnu].color;
            fillOpacity = fillColor !== 'transparent' ? 0.5 : 0;
            console.log('🎨 parcelColors에서 색상 복원:', pnu, fillColor);
        }
        // 2. savedParcel에서 색상 확인 (대체 옵션)
        else if (savedParcel && savedParcel.color && savedParcel.color !== 'transparent') {
            fillColor = savedParcel.color;
            fillOpacity = 0.5;
            console.log('🎨 savedParcel에서 색상 복원:', pnu, fillColor);
        }
        
        const polygon = new naver.maps.Polygon({
            map: map,
            paths: paths,
            fillColor: fillColor,
            fillOpacity: fillOpacity,
            strokeColor: isSelected ? '#FF0000' : '#0000FF',
            strokeOpacity: 0.6,
            strokeWeight: isSelected ? 1.5 : 0.5,
            clickable: true
        });
        
        // 클릭 이벤트
        naver.maps.Event.addListener(polygon, 'click', async function(e) {
            // 안전한 stopPropagation 호출
            try {
                if (e && e.domEvent && typeof e.domEvent.stopPropagation === 'function') {
                    e.domEvent.stopPropagation(); // 지도 클릭 이벤트 방지
                }
            } catch (error) {
                console.warn('⚠️ stopPropagation 호출 실패:', error);
            }

            // PNU 확실히 설정 및 검증
            const pnu = parcel.properties.PNU || parcel.properties.pnu;

            // PNU 유효성 검사
            if (!pnu || pnu === 'undefined' || pnu === 'null' || pnu === '') {
                console.warn('⚠️ 유효하지 않은 PNU로 클릭 이벤트 건너뜀:', pnu);
                return;
            }

            window.currentSelectedPNU = pnu;
            window.currentSelectedParcel = parcel;
            console.log('🎯 필지 클릭 - PNU 설정:', pnu, formatJibun(parcel.properties));

            await toggleParcelSelection(parcel, polygon);
        });
        
        // 필지 저장
        window.clickParcels.set(pnu, {
            polygon: polygon,
            data: parcel,
            color: fillColor
        });

        // 🗺️ 폴리곤 데이터를 Supabase + LocalStorage에 저장 (실시간 공유)
        if (window.dataPersistenceManager) {
            window.dataPersistenceManager.savePolygonData(pnu, geometry, properties)
                .then(() => console.log('🗺️ 폴리곤 데이터 저장 완료:', pnu))
                .catch(error => console.error('❌ 폴리곤 저장 실패:', error));
        }

        return polygon; // 폴리곤 객체 반환
    }
}

// 필지 선택/해제 토글
async function toggleParcelSelection(parcel, polygon) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const parcelData = window.clickParcels.get(pnu);
    const searchParcelData = window.searchParcels && window.searchParcels.get(pnu);
    const jibun = formatJibun(parcel.properties);
    
    // 보라색(검색 필지) 확인 - clickParcels 또는 searchParcels에서 확인
    const isSearchParcel = (parcelData && parcelData.color === '#9370DB') || 
                           (searchParcelData && searchParcelData.color === '#9370DB');
    if (isSearchParcel) {
    // console.log('🟣 검색 필지(보라색) 클릭 - 색상 복사 방지');
        // 폼에 정보만 표시하고 색상은 변경하지 않음
        document.getElementById('parcelNumber').value = jibun;
        window.currentSelectedPNU = pnu;
        
        // 저장된 정보가 있으면 로드
        const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
        const savedInfo = savedData.find(item => 
            (item.pnu && item.pnu === pnu) || 
            item.parcelNumber === jibun
        );
        
        if (savedInfo) {
            document.getElementById('ownerName').value = savedInfo.ownerName || '';
            document.getElementById('ownerAddress').value = savedInfo.ownerAddress || '';
            document.getElementById('ownerContact').value = savedInfo.ownerContact || '';
            document.getElementById('memo').value = savedInfo.memo || '';
        } else {
            document.getElementById('ownerName').value = '';
            document.getElementById('ownerAddress').value = '';
            document.getElementById('ownerContact').value = '';
            document.getElementById('memo').value = '';
        }
        
        return; // 보라색 필지는 여기서 종료
    }
    
    // 저장된 정보 확인
    const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
    const savedInfo = savedData.find(item => 
        (item.pnu && item.pnu === pnu) || 
        item.parcelNumber === jibun
    );
    
    // 저장된 정보가 있는지와 실제 데이터가 있는지 확인
    const hasActualData = savedInfo && (
        (savedInfo.ownerName && savedInfo.ownerName.trim() !== '') ||
        (savedInfo.ownerAddress && savedInfo.ownerAddress.trim() !== '') ||
        (savedInfo.ownerContact && savedInfo.ownerContact.trim() !== '') ||
        (savedInfo.memo && savedInfo.memo.trim() !== '')
    );
    
    // 저장된 실제 정보가 있으면 폼에 로드만 하고 색상은 유지
    if (hasActualData) {
    // console.log('저장된 정보가 있는 필지 클릭 - 정보 로드, 색상 보호');
        
        // 폼에 정보 로드
        window.currentSelectedPNU = pnu;
        document.getElementById('parcelNumber').value = savedInfo.parcelNumber || '';
        document.getElementById('ownerName').value = savedInfo.ownerName || '';
        document.getElementById('ownerAddress').value = savedInfo.ownerAddress || '';
        document.getElementById('ownerContact').value = savedInfo.ownerContact || '';
        document.getElementById('memo').value = savedInfo.memo || '';
        
        // 색상은 변경하지 않음
        if (savedInfo.color && savedInfo.color !== 'transparent') {
            // 보라색(검색 필지)이 아닐 때만 현재 색상 업데이트
            if (savedInfo.color !== '#9370DB') {
                currentColor = savedInfo.color;
                document.getElementById('currentColor').style.background = currentColor;
            }
            
            // 색상 팔레트에서 해당 색상 선택
            document.querySelectorAll('.color-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.color === currentColor) {
                    item.classList.add('active');
                }
            });
        }
        
        return; // 색상 변경 없이 종료
    }
    
    // 🎯 ULTRATHINK: 왼쪽 클릭은 항상 색칠만 (토글 기능 제거)
    // 저장된 정보가 없거나 빈 정보만 있는 경우 - 항상 색칠
    // 안전한 색상 폴백 체인: window.currentColor → currentColor → 기본값(빨강)
    const colorToApply = window.currentColor || currentColor || '#FF0000';
    // console.log('왼쪽 클릭 - 필지 색칠:', colorToApply);
    selectParcel(parcel, polygon);
    applyColorToParcel(parcel, colorToApply);
}

// 필지 색상 및 정보 제거
async function clearParcel(parcel, polygon) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const parcelData = window.clickParcels.get(pnu);
    const jibun = formatJibun(parcel.properties);
    
    if (parcelData) {
        // 폴리곤 색상 및 테두리 완전히 초기화
        polygon.setOptions({
            fillColor: 'transparent',
            fillOpacity: 0,
            strokeColor: '#0000FF',
            strokeOpacity: 0.6,
            strokeWeight: 0.5
        });
        parcelData.color = 'transparent';
        
        // LocalStorage에서 제거 (pnu와 parcelNumber 둘 다 확인)
        let savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
        savedData = savedData.filter(item => item.pnu !== pnu && item.parcelNumber !== jibun);
        await window.migratedSetItem(CONFIG.STORAGE_KEY, JSON.stringify(savedData));
    // console.log('색상 정보 제거됨:', pnu, jibun);
        
        // 폼 초기화
        document.getElementById('parcelNumber').value = '';
        document.getElementById('ownerName').value = '';
        document.getElementById('ownerAddress').value = '';
        document.getElementById('ownerContact').value = '';
        document.getElementById('memo').value = '';
    }
}

// 필지 선택
function selectParcel(parcel, polygon) {
    const properties = parcel.properties;
    // console.log('필지 속성:', properties); // 디버깅용
    
    // 검색 모드가 아닐 때만 currentSelectedPNU 업데이트
    // (검색 모드에서는 search.js에서 설정한 PNU 유지)
    if (window.currentMode !== 'search') {
        window.currentSelectedPNU = properties.PNU || properties.pnu;
    }
    
    // 지번 포맷팅 (utils.js 함수 사용)
    const jibun = formatJibun(properties);
    
    // 지번만 자동 입력, 나머지는 공란
    document.getElementById('parcelNumber').value = jibun;
    document.getElementById('ownerName').value = '';
    document.getElementById('ownerAddress').value = '';
    document.getElementById('ownerContact').value = '';
    document.getElementById('memo').value = '';
    
    // 폴리곤 강조
    if (polygon) {
        polygon.setOptions({
            strokeColor: '#FF0000',
            strokeWeight: 1.5
        });
    }
}

// 필지로부터 폴리곤 생성 함수
function createPolygonFromParcel(parcel) {
    try {
        const pnu = parcel.properties.PNU || parcel.properties.pnu;

        // 좌표 데이터 처리
        let paths = [];
        if (parcel.geometry) {
            if (parcel.geometry.type === 'Polygon') {
                paths = parcel.geometry.coordinates[0].map(coord =>
                    new naver.maps.LatLng(coord[1], coord[0])
                );
            } else if (parcel.geometry.type === 'MultiPolygon') {
                paths = parcel.geometry.coordinates[0][0].map(coord =>
                    new naver.maps.LatLng(coord[1], coord[0])
                );
            }
        }

        if (paths.length === 0) {
            console.warn('폴리곤 좌표 데이터 없음:', pnu);
            return null;
        }

        // 폴리곤 생성
        const polygon = new naver.maps.Polygon({
            map: map,
            paths: paths,
            fillColor: 'transparent',
            fillOpacity: 0,
            strokeColor: '#0000FF',
            strokeOpacity: 0.6,
            strokeWeight: 0.5,
            clickable: true
        });

        // 클릭 이벤트 추가 - 중복 등록 방지
        if (!polygon._parcelEventAdded) {
            polygon._parcelEventAdded = true;
            naver.maps.Event.addListener(polygon, 'click', async function(e) {
            // 안전한 stopPropagation 호출
            try {
                if (e && e.domEvent && typeof e.domEvent.stopPropagation === 'function') {
                    e.domEvent.stopPropagation();
                }
            } catch (error) {
                console.warn('⚠️ stopPropagation 호출 실패:', error);
            }

            const pnu = parcel.properties.PNU || parcel.properties.pnu;

            // PNU 유효성 검사
            if (!pnu || pnu === 'undefined' || pnu === 'null' || pnu === '') {
                console.warn('⚠️ 유효하지 않은 PNU로 클릭 이벤트 건너뜀:', pnu);
                return;
            }

            window.currentSelectedPNU = pnu;
            window.currentSelectedParcel = parcel;
            console.log('🎯 재생성된 필지 클릭 - PNU 설정:', pnu, formatJibun(parcel.properties));

            await toggleParcelSelection(parcel, polygon);

            // 색상 적용
            if (window.currentColor && window.currentColor !== 'transparent') {
                await applyColorToParcel(parcel, window.currentColor);
            }
            });
        }

        return polygon;
    } catch (error) {
        console.error('폴리곤 생성 중 오류:', error);
        return null;
    }
}

// 필지에 색상 적용 (즉시 저장 포함) - 같은 색상 클릭 시 제거
async function applyColorToParcel(parcel, color) {
    // 거리뷰 모드에서는 색상 칠하기 비활성화
    if (window.isStreetViewMode) {
        console.log('🚶 거리뷰 모드에서는 색상 칠하기가 비활성화됩니다.');
        return;
    }

    // 모드 확인
    const currentMode = window.ModeManager ? window.ModeManager.getCurrentMode() : 'click';

    // 손 모드에서는 색상 적용 비활성화
    if (currentMode === 'hand') {
        console.log('✋ 손 모드에서는 색상 적용이 비활성화됩니다.');
        return;
    }

    const pnu = parcel.properties.PNU || parcel.properties.pnu;

    // 모드별 색상 확인 - 8가지 색상 팔레트 지원
    let expectedColor;
    let colorIndex = null;

    if (currentMode === 'search') {
        expectedColor = '#9B59B6'; // 검색 모드는 보라색
        if (typeof color === 'number' && color !== 8) {
            console.log('🔍 검색 모드에서는 보라색(인덱스 8)만 사용 가능합니다.');
            return;
        }
    } else if (currentMode === 'click') {
        // 클릭 모드 - 8가지 색상 팔레트 지원
        if (typeof color === 'number' && window.ColorPaletteManager) {
            // 색상 인덱스로 전달된 경우
            colorIndex = color;
            const colorData = window.ColorPaletteManager.getColorByIndex(color);
            if (colorData) {
                expectedColor = colorData.hex;
            } else {
                console.error('잘못된 색상 인덱스:', color);
                return;
            }
        } else if (typeof color === 'string' && color.startsWith('#')) {
            // 색상 값이 직접 전달된 경우 (#FF0000 같은)
            expectedColor = color;
            // ColorPaletteManager에서 해당 색상의 인덱스 찾기
            if (window.ColorPaletteManager) {
                for (let i = 0; i < window.ColorPaletteManager.colors.length; i++) {
                    if (window.ColorPaletteManager.colors[i].hex === color) {
                        colorIndex = i;
                        break;
                    }
                }
            }
        } else if (window.ColorPaletteManager) {
            // 현재 선택된 색상 사용
            const currentColorData = window.ColorPaletteManager.getCurrentColor();
            if (currentColorData) {
                colorIndex = currentColorData.index;
                expectedColor = currentColorData.hex;
            } else {
                // 색상이 선택되지 않은 경우 기본 색상 (빨강)
                expectedColor = color || '#FF0000';
            }
        } else {
            // ColorPaletteManager 없이 기존 호환성 유지 (빨강)
            expectedColor = color || '#FF0000';
        }
    }

    // 검색 필지인지 확인
    const searchParcelData = window.searchParcels && window.searchParcels.get(pnu);
    if (searchParcelData) {
        // 검색 필지는 검색 모드에서만 삭제 가능
        if (currentMode !== 'search') {
            console.log('🔍 검색 필지는 검색 모드에서만 수정 가능합니다.');
            return;
        }

        if (expectedColor === '#9B59B6') {
            console.log('🔍 검색 필지 삭제 요청:', pnu);

            // 삭제 확인 다이얼로그
            const displayText = searchParcelData.displayText || pnu;
            if (confirm(`검색 필지 "${displayText}"를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
                // 지도에서 제거
                if (searchParcelData.polygon) {
                    searchParcelData.polygon.setMap(null);
                }
                if (searchParcelData.label) {
                    searchParcelData.label.setMap(null);
                }

                // searchParcels에서 제거
                window.searchParcels.delete(pnu);

                // localStorage에서도 제거
                const searchStorage = JSON.parse(localStorage.getItem('searchParcels') || '{}');
                delete searchStorage[pnu];
                localStorage.setItem('searchParcels', JSON.stringify(searchStorage));

                console.log('✅ 검색 필지 삭제 완료:', displayText);
            }
        } else {
            console.log('🔍 검색 필지는 보라색으로만 삭제 가능. 현재 선택 색상:', color);
        }
        return; // 검색 필지는 다른 색상 변경 불가
    }

    let parcelData = window.clickParcels.get(pnu);

    // 필지 데이터가 없다면 새로 생성 (삭제된 필지 재색칠 대응)
    if (!parcelData) {
        console.log('🔄 삭제된 필지에 색상 재적용 - 폴리곤 재생성:', pnu);

        // 폴리곤 재생성
        const polygon = createPolygonFromParcel(parcel);
        if (polygon) {
            parcelData = {
                polygon: polygon,
                color: 'transparent',
                parcel: parcel
            };
            window.clickParcels.set(pnu, parcelData);
            console.log('✅ 필지 폴리곤 재생성 완료:', pnu);
        } else {
            console.error('❌ 폴리곤 생성 실패:', pnu);
            return;
        }
    }

    if (parcelData) {
        // 항상 새로운 색상 적용 (토글 없음)
        const newColor = color;
        const isRemoving = false; // 색상 제거 기능 비활성화

        // 1. UI 즉시 업데이트
        parcelData.polygon.setOptions({
            fillColor: newColor,
            fillOpacity: newColor === 'transparent' ? 0 : 0.5,
            strokeColor: newColor === 'transparent' ? 'transparent' : newColor,
            strokeOpacity: newColor === 'transparent' ? 0 : 0.7
        });
        parcelData.color = newColor;

        // 2. 색상 즉시 저장 (Supabase와 LocalStorage만 사용)
        if (isRemoving) {
            console.log('🎨 색상 제거 처리 (필지 데이터는 유지):', pnu);

            // 색상만 transparent로 변경, 데이터는 유지
            // Supabase에 색상 업데이트 (transparent로)
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                try {
                    const parcelToSave = {
                        id: pnu,
                        pnu: pnu,
                        color: 'transparent',
                        is_colored: false,
                        updated_at: new Date().toISOString()
                    };
                    await window.SupabaseManager.saveParcels([parcelToSave]);
                    console.log('✅ Supabase에 색상 제거 저장 완료');
                } catch (error) {
                    console.error('❌ Supabase 색상 제거 저장 실패:', error);
                }
            }
        } else {
            console.log('🎨 색상 적용:', pnu, newColor);

            // Supabase에 색상 저장
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                try {
                    const parcelToSave = {
                        id: pnu,
                        pnu: pnu,
                        color: newColor,
                        is_colored: true,
                        updated_at: new Date().toISOString()
                    };
                    await window.SupabaseManager.saveParcels([parcelToSave]);
                    console.log('✅ Supabase에 색상 저장 완료');
                } catch (error) {
                    console.error('❌ Supabase 색상 저장 실패:', error);
                }
            }
        }

        // 3. LocalStorage 업데이트 - 모든 관련 키에서 업데이트
        const storageKeys = ['parcelData', 'clickParcelData', 'parcels', 'parcels_current_session'];

        // 색상 제거 시에도 데이터는 유지하고 색상만 transparent로 업데이트
        if (isRemoving || !isRemoving) {
            // 색상 업데이트 처리
            for (const key of storageKeys) {
                const savedData = JSON.parse(localStorage.getItem(key) || '[]');
                const existingIndex = savedData.findIndex(item => item.pnu === pnu);

                if (existingIndex >= 0) {
                    // 색상 정보 업데이트
                    savedData[existingIndex].color = newColor;
                    savedData[existingIndex].is_colored = true;
                    savedData[existingIndex].currentColor = newColor;
                    // geometry 정보가 없으면 추가
                    if (!savedData[existingIndex].geometry && parcel.geometry) {
                        savedData[existingIndex].geometry = parcel.geometry;
                    }
                    localStorage.setItem(key, JSON.stringify(savedData));
                }
            }
        }

        // 새로운 필지를 모든 저장소에 추가해야 하는지 확인
        const needToAddNew = storageKeys.some(key => {
            const savedData = JSON.parse(localStorage.getItem(key) || '[]');
            return savedData.findIndex(item => item.pnu === pnu) < 0;
        });

        if (needToAddNew) {
            // 🔥 새로운 필지 데이터 완전 저장 (geometry 포함)
            const jibun = formatJibun(parcel.properties);

            // 중심 좌표 계산
            let centerLat, centerLng;
            if (parcel.geometry) {
                if (parcel.geometry.type === 'Point') {
                    [centerLng, centerLat] = parcel.geometry.coordinates;
                } else if (parcel.geometry.type === 'Polygon' && parcel.geometry.coordinates[0]) {
                    const coords = parcel.geometry.coordinates[0];
                    let totalLat = 0, totalLng = 0, count = 0;
                    for (const coord of coords) {
                        if (coord && coord.length >= 2) {
                            totalLng += coord[0];
                            totalLat += coord[1];
                            count++;
                        }
                    }
                    if (count > 0) {
                        centerLng = totalLng / count;
                        centerLat = totalLat / count;
                    }
                } else if (parcel.geometry.type === 'MultiPolygon' && parcel.geometry.coordinates[0] && parcel.geometry.coordinates[0][0]) {
                    const coords = parcel.geometry.coordinates[0][0];
                    let totalLat = 0, totalLng = 0, count = 0;
                    for (const coord of coords) {
                        if (coord && coord.length >= 2) {
                            totalLng += coord[0];
                            totalLat += coord[1];
                            count++;
                        }
                    }
                    if (count > 0) {
                        centerLng = totalLng / count;
                        centerLat = totalLat / count;
                    }
                }
            }

            const newParcelData = {
                parcelNumber: jibun,
                pnu: pnu,
                ownerName: '',
                ownerAddress: '',
                ownerContact: '',
                memo: '',
                color: newColor,
                geometry: parcel.geometry,
                timestamp: new Date().toISOString(),
                isSearchParcel: false,
                is_colored: true,
                currentColor: newColor
            };

            // 중심 좌표가 계산되었으면 추가
            if (centerLat && centerLng) {
                newParcelData.lat = parseFloat(centerLat);
                newParcelData.lng = parseFloat(centerLng);
            }

            // CONFIG.STORAGE_KEY에 저장
            const mainSavedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
            mainSavedData.push(newParcelData);
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(mainSavedData));
            console.log('✅ 새 필지 완전 데이터 저장 완료:', pnu, jibun);

            // 모든 관련 키에 새로운 데이터 추가
            for (const key of ['clickParcelData', 'parcels', 'parcels_current_session']) {
                if (key !== CONFIG.STORAGE_KEY) {
                    const otherData = JSON.parse(localStorage.getItem(key) || '[]');
                    const exists = otherData.findIndex(item => item.pnu === pnu);
                    if (exists < 0) {
                        otherData.push(newParcelData);
                        localStorage.setItem(key, JSON.stringify(otherData));
                        console.log(`✅ ${key}에도 새 필지 저장: ${pnu}`);
                    }
                }
            }
        }

        // 3-1. parcelColors에도 저장 (색상 전용 저장소)
        const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
        if (isRemoving) {
            // 색상 제거 시 transparent로 저장 (완전 삭제가 아님)
            parcelColors[pnu] = 'transparent';
            localStorage.setItem('parcelColors', JSON.stringify(parcelColors));
            console.log('✅ parcelColors에서 색상만 제거:', pnu);
        } else {
            // ColorPaletteManager를 사용하여 색상 인덱스 가져오기
            let colorIndex = null;
            if (window.ColorPaletteManager) {
                const colors = [
                    { index: 0, hex: '#FF0000' },
                    { index: 1, hex: '#FFA500' },
                    { index: 2, hex: '#FFFF00' },
                    { index: 3, hex: '#90EE90' },
                    { index: 4, hex: '#0000FF' },
                    { index: 5, hex: '#000000' },
                    { index: 6, hex: '#FFFFFF' },
                    { index: 7, hex: '#87CEEB' }
                ];
                const found = colors.find(c => c.hex === newColor);
                colorIndex = found ? found.index : null;
            }

            // 색상 인덱스가 있으면 인덱스 저장, 없으면 객체로 저장
            if (colorIndex !== null) {
                parcelColors[pnu] = colorIndex;
            } else {
                parcelColors[pnu] = {
                    parcel_id: pnu,
                    color: newColor,
                    is_colored: true,
                    updated_at: new Date().toISOString()
                };
            }
        }
        localStorage.setItem('parcelColors', JSON.stringify(parcelColors));

        // 4. 마커 제거 처리 (색상 제거 시에만)
        if (isRemoving) {
            // 마커 상태 삭제
            const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
            delete markerStates[pnu];
            localStorage.setItem('markerStates', JSON.stringify(markerStates));

            // 지도에서 마커 제거
            if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
                const markerInfo = window.MemoMarkerManager.markers.get(pnu);
                if (markerInfo && markerInfo.marker) {
                    markerInfo.marker.setMap(null);
                    window.MemoMarkerManager.markers.delete(pnu);
                    console.log('✅ 마커 제거 완료:', pnu);
                }
            }

            const jibun = parcel.properties.JIBUN || parcel.properties.jibun || pnu;
            console.log(`✨ 필지 ${jibun}의 색상과 데이터가 완전 삭제되었습니다.`);
        }
    }
}

// 색상 인덱스 찾기 헬퍼 함수
function getColorIndex(color) {
    const colors = [
        '#FF0000', '#FFA500', '#FFFF00', '#90EE90',
        '#0000FF', '#000000', '#FFFFFF', '#87CEEB'
    ];
    const index = colors.indexOf(color);
    return index >= 0 ? index : 0;
}

// 필지 정보 표시
function displayParcelInfo(parcel) {
    const properties = parcel.properties;
    // console.log('필지 전체 정보:', properties);
    
    // 디버깅용 - VWorld API 필드 확인
    // console.log('🔍 VWorld API 필드 확인:');
    // console.log('  - PNU:', properties.PNU || properties.pnu);
    // console.log('  - NU_NM:', properties.NU_NM || properties.nu_nm);
    // console.log('  - JIBUN:', properties.JIBUN || properties.jibun);
    // console.log('  - BONBUN:', properties.BONBUN || properties.bonbun);
    // console.log('  - BUBUN:', properties.BUBUN || properties.bubun);
    // console.log('  - ADDR:', properties.ADDR || properties.addr);
    // console.log('  - SAN:', properties.SAN || properties.san);
    // console.log('  - 모든 필드:', Object.keys(properties));
    
    // 검색 모드가 아닐 때만 currentSelectedPNU 업데이트
    // (검색 모드에서는 search.js에서 설정한 PNU 유지)
    if (window.currentMode !== 'search') {
        window.currentSelectedPNU = properties.PNU || properties.pnu;
    }
    
    // 지번 포맷팅 (utils.js 함수 사용)
    const jibun = formatJibun(properties);
    // console.log('📝 포맷된 지번:', jibun);
    
    // 폼에 정보 표시
    if (jibun) {
        document.getElementById('parcelNumber').value = jibun;
    }
}

// 저장 중 플래그 추가 - 무한루프 방지
let isSaving = false;

// 필지 데이터 저장 (개선된 버전 - 데이터 손실 방지)
async function saveParcelData() {
    // 이미 저장 중이면 무시
    if (isSaving) {
        console.log('⚠️ 이미 저장 중입니다. 중복 저장 방지');
        return false;
    }

    isSaving = true; // 저장 시작

    let parcelNumber = document.getElementById('parcelNumber').value;

    // PNU가 있으면 지번 체크 건너뛰기
    if (!window.currentSelectedPNU && !parcelNumber) {
        console.warn('⚠️ 필지를 선택하거나 지번을 입력해주세요.');
        return false;
    }

    // PNU가 있고 지번이 비어있으면 자동 설정
    if (window.currentSelectedPNU && !parcelNumber) {
        parcelNumber = '자동입력';
        console.log('🎯 PNU로 저장 진행:', window.currentSelectedPNU);
    }
    
    console.log('💾 저장 시작:', parcelNumber);
    
    try {
        // 현재 선택된 필지의 PNU 사용
        let currentPNU = window.currentSelectedPNU;
        let geometry = null;
        let isSearchParcel = false;
        
        // PNU가 있으면 geometry 가져오기
        if (currentPNU) {
            // 검색 모드일 때는 searchParcels 우선
            if (window.currentMode === 'search') {
                let parcelData = window.searchParcels.get(currentPNU);
                if (parcelData) {
                    geometry = parcelData.data ? parcelData.data.geometry : parcelData.geometry;
                    isSearchParcel = true;
                }
            }
            
            // 못 찾았으면 clickParcels 확인
            if (!geometry) {
                let parcelData = window.clickParcels.get(currentPNU);
                if (parcelData && parcelData.data) {
                    geometry = parcelData.data.geometry;
                }
            }
        } else {
            // PNU가 없으면 지번으로 검색
            if (window.currentMode === 'search') {
                window.searchParcels.forEach((parcelData, pnu) => {
                    const jibun = formatJibun(parcelData.data?.properties || {});
                    if (jibun === parcelNumber && !currentPNU) {
                        currentPNU = pnu;
                        geometry = parcelData.data ? parcelData.data.geometry : parcelData.geometry;
                        isSearchParcel = true;
                    }
                });
            }
            
            // 못 찾았으면 clickParcels 확인
            if (!currentPNU) {
                window.clickParcels.forEach((parcelData, pnu) => {
                    const jibun = formatJibun(parcelData.data?.properties || {});
                    if (jibun === parcelNumber) {
                        currentPNU = pnu;
                        geometry = parcelData.data?.geometry;
                    }
                });
            }
        }
        
        const formData = {
            parcelNumber: parcelNumber,
            pnu: currentPNU,
            ownerName: document.getElementById('ownerName').value,
            ownerAddress: document.getElementById('ownerAddress').value,
            ownerContact: document.getElementById('ownerContact').value,
            memo: document.getElementById('memo').value,
            color: isSearchParcel ? '#9370DB' : currentColor,
            geometry: geometry,
            timestamp: new Date().toISOString(),
            isSearchParcel: isSearchParcel
        };
        
        // 📍 geometry에서 중심 좌표 추출 (메모 마커용)
        console.log('🔍 geometry 디버깅:', {
            geometry: geometry,
            hasGeometry: !!geometry,
            geometryType: geometry?.type,
            hasCoordinates: !!(geometry && geometry.coordinates),
            coordinatesLength: geometry?.coordinates?.length
        });
        
        if (geometry && geometry.coordinates) {
            let centerLat, centerLng;
            
            console.log('🎯 좌표 추출 시작 - geometry type:', geometry.type);
            
            if (geometry.type === 'Point') {
                [centerLng, centerLat] = geometry.coordinates;
                console.log('📍 Point 좌표:', { centerLng, centerLat });
            } else if (geometry.type === 'Polygon') {
                console.log('🔺 Polygon 좌표 배열:', geometry.coordinates[0]);
                const center = calculatePolygonCenter(geometry.coordinates[0]);
                [centerLng, centerLat] = center;
                console.log('📍 Polygon 중심점:', { centerLng, centerLat });
            } else if (geometry.type === 'MultiPolygon') {
                console.log('🔻 MultiPolygon 좌표 배열:', geometry.coordinates[0][0]);
                const center = calculatePolygonCenter(geometry.coordinates[0][0]);
                [centerLng, centerLat] = center;
                console.log('📍 MultiPolygon 중심점:', { centerLng, centerLat });
            }
            
            if (centerLat && centerLng) {
                formData.lat = parseFloat(centerLat);
                formData.lng = parseFloat(centerLng);
                console.log('✅ 최종 추출된 중심 좌표:', { lat: formData.lat, lng: formData.lng });
            } else {
                console.warn('⚠️ 중심 좌표 계산 실패:', { centerLat, centerLng });
            }
        } else {
            console.warn('❌ geometry 또는 coordinates 없음:', { geometry, coordinates: geometry?.coordinates });

            // 🔥 geometry가 없을 때 selectedParcel이나 clickParcels에서 좌표 가져오기
            if (window.selectedParcel && window.selectedParcel.lat && window.selectedParcel.lng) {
                formData.lat = parseFloat(window.selectedParcel.lat);
                formData.lng = parseFloat(window.selectedParcel.lng);
                console.log('✅ selectedParcel에서 좌표 가져옴:', { lat: formData.lat, lng: formData.lng });
            } else if (currentPNU && window.clickParcels && window.clickParcels.has(currentPNU)) {
                const parcelData = window.clickParcels.get(currentPNU);
                if (parcelData && parcelData.center) {
                    formData.lat = parseFloat(parcelData.center.lat);
                    formData.lng = parseFloat(parcelData.center.lng);
                    console.log('✅ clickParcels에서 좌표 가져옴:', { lat: formData.lat, lng: formData.lng });
                }
            } else if (currentPNU && window.searchParcels && window.searchParcels.has(currentPNU)) {
                const parcelData = window.searchParcels.get(currentPNU);
                if (parcelData && parcelData.center) {
                    formData.lat = parseFloat(parcelData.center.lat);
                    formData.lng = parseFloat(parcelData.center.lng);
                    console.log('✅ searchParcels에서 좌표 가져옴:', { lat: formData.lat, lng: formData.lng });
                }
            }
        }
        
        console.log('📄 저장할 데이터:', formData);
        
        // 1단계: localStorage 직접 저장 (백업)
        let localStorageSuccess = false;
        try {
            let savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
            const existingIndex = savedData.findIndex(item => 
                (item.pnu && item.pnu === currentPNU) || 
                item.parcelNumber === formData.parcelNumber
            );
            
            if (existingIndex > -1) {
                savedData[existingIndex] = formData;
            } else {
                savedData.push(formData);
            }
            
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(savedData));
            localStorageSuccess = true;
            console.log('✅ localStorage 저장 성공');
        } catch (localError) {
            console.error('❌ localStorage 저장 실패:', localError);
        }
        
        // 2단계: 🌟 새로운 Supabase 올인원 저장 시도
        let supabaseSuccess = false;
        try {
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                // 🎯 개별 필지 데이터를 Supabase에 저장 (확장된 parcels 테이블 활용)
                const supabaseData = {
                    ...formData,
                    // 🔺 폴리곤 데이터 JSONB 필드로 저장
                    polygon_data: geometry ? {
                        type: geometry.type,
                        coordinates: geometry.coordinates,
                        center: { lat: formData.lat, lng: formData.lng }
                    } : null,
                    // 🎨 색상 정보 JSONB 필드로 저장
                    color_info: formData.color ? {
                        color: formData.color,
                        applied_at: new Date().toISOString(),
                        mode: isSearchParcel ? 'search' : 'click'
                    } : null
                };

                await window.SupabaseManager.saveParcel(currentPNU, supabaseData);
                supabaseSuccess = true;
                console.log('✅ Supabase 올인원 저장 성공:', currentPNU);
            } else {
                console.warn('⚠️ SupabaseManager 연결 없음 - localStorage만 사용');
            }
        } catch (supabaseError) {
            console.error('❌ Supabase 저장 실패:', supabaseError);
        }
        
        // 3단계: 지도 업데이트
        const targetMap = isSearchParcel ? window.searchParcels : window.clickParcels;
        const parcelData = targetMap.get(currentPNU);
        
        if (parcelData) {
            // Map에 저장된 데이터 업데이트
            parcelData.ownerName = formData.ownerName;
            parcelData.ownerAddress = formData.ownerAddress;
            parcelData.ownerContact = formData.ownerContact;
            parcelData.memo = formData.memo;
            parcelData.color = formData.color;
            parcelData.savedInfo = formData;
            
            // 폴리곤 색상 업데이트 (검색 필지 제외)
            if (parcelData.polygon && !isSearchParcel) {
                parcelData.polygon.setOptions({
                    fillColor: formData.color,
                    fillOpacity: 0.5,
                    strokeColor: formData.color
                });
            } else if (isSearchParcel) {
                // 검색 필지는 보라색 고정
                console.log('🔍 검색 필지는 보라색 유지:', currentPNU);
            }
            
            console.log('✅ 지도 업데이트 성공');
        }
        
        // 4단계: UI 업데이트
        await updateParcelList();
        
        // 우측 필지 관리자 목록 업데이트
        if (window.parcelManager) {
            window.parcelManager.loadParcels();
            window.parcelManager.applyFilters();
            window.parcelManager.render();
        }
        
        // 이벤트 발생
        window.dispatchEvent(new Event('refreshParcelList'));
        
        // 메모 마커 업데이트 (실제 정보만 확인: 소유자명, 주소, 연락처, 메모)
        const hasRealInfo = (formData.ownerName && formData.ownerName.trim() !== '') ||
                           (formData.ownerAddress && formData.ownerAddress.trim() !== '') ||
                           (formData.ownerContact && formData.ownerContact.trim() !== '') ||
                           (formData.memo && formData.memo.trim() !== '');

        // 실제 정보가 있을 때만 마커 생성/유지
        const shouldCreateMarker = hasRealInfo;

        if (window.MemoMarkerManager) {
            if (shouldCreateMarker) {
                // 좌표를 포함한 전체 데이터 전달 (formData에서 좌표 가져오기)
                const markerData = {
                    ...formData,
                    lat: formData.lat,
                    lng: formData.lng,
                    geometry: formData.geometry
                };
                await window.MemoMarkerManager.createMemoMarker(markerData);
                console.log('📍 마커 생성/업데이트 (필지 정보 존재):', formData.parcelNumber);

                // 마커 상태 저장
                if (window.DataPersistenceManager) {
                    window.DataPersistenceManager.saveMarkerState(formData.pnu || currentPNU, true);
                }
            } else {
                // 모든 정보가 삭제되면 마커도 제거
                const pnu = formData.pnu || currentPNU;
                if (pnu && window.MemoMarkerManager.markers.has(pnu)) {
                    window.MemoMarkerManager.removeMemoMarker(pnu);
                    console.log('🗑️ 마커 제거 (필지 정보 없음):', formData.parcelNumber);

                    // 마커 상태 저장
                    if (window.DataPersistenceManager) {
                        window.DataPersistenceManager.saveMarkerState(pnu, false);
                    }
                }
            }
        }
        
        // ⚠️ 중요: 폼 초기화 제거 - 데이터 유지를 위해
        // 사용자가 저장한 정보는 폼에 그대로 유지됩니다.
        
        // 성공 메시지
        const saveStatus = [];
        if (localStorageSuccess) saveStatus.push('로컬저장');
        if (supabaseSuccess) saveStatus.push('클라우드저장');
        
        const statusText = saveStatus.length > 0 ? `(${saveStatus.join(', ')})` : '(오프라인저장)';
        console.log(`✅ 필지 저장 완료 ${statusText}`);
        
        // 실시간 자동저장 시스템에 저장 완료 알림
        if (window.realtimeAutoSave) {
            window.realtimeAutoSave.triggerAutoSave('manual_save');
        }

        console.log('✅ 저장 완료:', {
            parcelNumber: formData.parcelNumber,
            localStorage: localStorageSuccess,
            supabase: supabaseSuccess
        });

        isSaving = false; // 저장 완료
        return true;

    } catch (error) {
        console.error('🚨 저장 중 전체 오류:', error);
        console.error('❌ 저장 오류 - 실시간 자동저장 시스템이 처리합니다');
        isSaving = false; // 에러 발생 시에도 플래그 해제
        return false;
    }
}

// =====================================================================
// Phase 2: 모드별로 분리된 저장 함수들
// =====================================================================

// 클릭 필지 저장 함수
async function saveClickParcelData() {
    let parcelNumber = document.getElementById('parcelNumber').value;

    // PNU가 있으면 지번 체크 건너뛰기
    if (!window.currentSelectedPNU && !parcelNumber) {
        console.warn('⚠️ 필지를 선택하거나 지번을 입력해주세요.');
        alert('필지를 선택하거나 지번을 입력해주세요.');
        return false;
    }

    // PNU가 있고 지번이 비어있으면 자동 설정
    if (window.currentSelectedPNU && !parcelNumber) {
        parcelNumber = '자동입력';
        console.log('🎯 클릭 필지 PNU로 저장 진행:', window.currentSelectedPNU);
    }

    console.log('💾 클릭 필지 저장 시작:', parcelNumber);
    console.log('🔍 [DEBUG] currentSelectedPNU:', window.currentSelectedPNU);
    console.log('🔍 [DEBUG] 입력된 데이터:', {
        parcelNumber: document.getElementById('parcelNumber').value,
        ownerName: document.getElementById('ownerName').value,
        ownerAddress: document.getElementById('ownerAddress').value,
        ownerContact: document.getElementById('ownerContact').value,
        memo: document.getElementById('memo').value
    });

    try {
        // 현재 선택된 필지의 PNU 사용
        let currentPNU = window.currentSelectedPNU;
        let geometry = null;
        let lat = null;
        let lng = null;

        // properties 정보를 저장할 변수 추가
        let properties = null;

        // PNU가 있으면 clickParcels에서 geometry와 properties 가져오기
        if (currentPNU) {
            let parcelData = window.clickParcels.get(currentPNU);
            console.log('🔍 [DEBUG] clickParcels에서 가져온 데이터:', parcelData);

            // 'data' 또는 'parcel' 키로 접근 시도 (mode-click-handler와 parcel.js 호환성)
            if (parcelData) {
                if (parcelData.data && parcelData.data.geometry) {
                    geometry = parcelData.data.geometry;
                    properties = parcelData.data.properties || {};
                    console.log('✅ [DEBUG] data.geometry와 properties 찾음');
                } else if (parcelData.parcel && parcelData.parcel.geometry) {
                    geometry = parcelData.parcel.geometry;
                    properties = parcelData.parcel.properties || {};
                    console.log('✅ [DEBUG] parcel.geometry와 properties 찾음');
                }
            }
        } else {
            // PNU가 없으면 지번으로 clickParcels에서 검색
            window.clickParcels.forEach((parcelData, pnu) => {
                let tempProperties = parcelData.data?.properties || parcelData.parcel?.properties || {};
                const jibun = formatJibun(tempProperties);
                if (jibun === parcelNumber) {
                    currentPNU = pnu;
                    geometry = parcelData.data?.geometry || parcelData.parcel?.geometry;
                    properties = tempProperties;
                    console.log('✅ [DEBUG] 지번으로 geometry와 properties 찾음:', jibun);
                }
            });
        }

        // properties가 없으면 최소한의 구조 생성
        if (!properties) {
            properties = {
                PNU: currentPNU,
                pnu: currentPNU
            };
        }

        const formData = {
            parcelNumber: parcelNumber,
            pnu: currentPNU,
            ownerName: document.getElementById('ownerName').value,
            ownerAddress: document.getElementById('ownerAddress').value,
            ownerContact: document.getElementById('ownerContact').value,
            memo: document.getElementById('memo').value,
            color: currentColor,
            geometry: geometry,
            properties: properties,  // 🆕 drawClickModeParcelPolygon에서 필요
            timestamp: new Date().toISOString(),
            isSearchParcel: false,
            parcel_type: 'click',
            mode: 'click',  // 🆕 loadSavedClickModeParcels에서 필요
            source: 'click'  // 🆕 loadSavedClickModeParcels에서 필요
        };

        // 📍 geometry에서 중심 좌표 추출 (메모 마커용)
        if (geometry && geometry.coordinates) {
            console.log('🗺️ [DEBUG] geometry 타입:', geometry.type);
            console.log('🗺️ [DEBUG] geometry.coordinates 구조:', geometry.coordinates);

            let centerLat, centerLng;

            if (geometry.type === 'Point') {
                [centerLng, centerLat] = geometry.coordinates;
            } else if (geometry.type === 'Polygon') {
                const center = calculatePolygonCenter(geometry.coordinates[0]);
                [centerLng, centerLat] = center;
                console.log('🗺️ [DEBUG] Polygon 중심점 계산:', { centerLng, centerLat });
            } else if (geometry.type === 'MultiPolygon') {
                const center = calculatePolygonCenter(geometry.coordinates[0][0]);
                [centerLng, centerLat] = center;
                console.log('🗺️ [DEBUG] MultiPolygon 중심점 계산:', { centerLng, centerLat });
            }

            if (centerLat && centerLng) {
                formData.lat = parseFloat(centerLat);
                formData.lng = parseFloat(centerLng);
                console.log('✅ [DEBUG] 좌표 저장: lat=' + formData.lat + ', lng=' + formData.lng);
            } else {
                console.error('❌ [DEBUG] 좌표 계산 실패');
            }
        } else {
            console.error('❌ [DEBUG] geometry 또는 coordinates 없음');
        }

        console.log('📄 클릭 필지 저장할 데이터:', formData);

        // 1단계: 새로운 분리된 localStorage 저장
        let localStorageSuccess = false;
        try {
            let savedData = window.getClickParcelData();
            const existingIndex = savedData.findIndex(item =>
                (item.pnu && item.pnu === currentPNU) ||
                item.parcelNumber === formData.parcelNumber
            );

            if (existingIndex > -1) {
                savedData[existingIndex] = formData;
            } else {
                savedData.push(formData);
            }

            // localStorage에 직접 저장 (재귀 호출 방지)
            localStorage.setItem(window.STORAGE_KEYS.CLICK_PARCEL_DATA, JSON.stringify(savedData));
            localStorageSuccess = true;
            console.log('✅ 클릭 필지 localStorage 저장 성공');
        } catch (localError) {
            console.error('❌ 클릭 필지 localStorage 저장 실패:', localError);
        }

        // 2단계: Supabase에 클릭 필지로 저장
        let supabaseSuccess = false;
        try {
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                await window.SupabaseManager.saveClickParcel(formData);
                supabaseSuccess = true;
                console.log('✅ 클릭 필지 Supabase 저장 성공:', currentPNU);
            } else {
                console.warn('⚠️ SupabaseManager 연결 없음 - localStorage만 사용');
            }
        } catch (supabaseError) {
            console.error('❌ 클릭 필지 Supabase 저장 실패:', supabaseError);
        }

        // 3단계: clickParcels Map 업데이트
        const parcelData = window.clickParcels.get(currentPNU);
        if (parcelData) {
            // Map에 저장된 데이터 업데이트
            parcelData.ownerName = formData.ownerName;
            parcelData.ownerAddress = formData.ownerAddress;
            parcelData.ownerContact = formData.ownerContact;
            parcelData.memo = formData.memo;
            parcelData.color = formData.color;
            parcelData.savedInfo = formData;

            // 폴리곤 색상 업데이트
            if (parcelData.polygon) {
                parcelData.polygon.setOptions({
                    fillColor: formData.color,
                    fillOpacity: 0.5,
                    strokeColor: formData.color
                });
            }

            console.log('✅ 클릭 필지 지도 업데이트 성공');
        }

        // 4단계: UI 업데이트
        await updateParcelList();
        if (window.parcelManager) {
            window.parcelManager.loadParcels();
            window.parcelManager.applyFilters();
            window.parcelManager.render();
        }
        window.dispatchEvent(new Event('refreshParcelList'));

        // 5단계: 마커 업데이트
        console.log('📍 마커 업데이트 시작...');

        // 현재 선택된 필지 정보를 전역 변수에 저장
        if (window.selectedParcel) {
            window.selectedParcel = {
                ...window.selectedParcel,
                ...formData
            };
        } else {
            window.selectedParcel = formData;
        }

        // 🔥 마커 생성/업데이트 로직 추가 (재시도 메커니즘 포함)
        const createMarkerWithRetry = async (retryCount = 0) => {
            try {
                if (!window.MemoMarkerManager) {
                    console.warn('⚠️ MemoMarkerManager가 없습니다. 초기화 중...');
                    if (window.appInitializer) {
                        await window.appInitializer.initializeMemoMarkers();
                    }
                }

                if (window.MemoMarkerManager) {
                    const shouldShow = window.MemoMarkerManager.shouldShowMarker(formData);
                    console.log('📍 마커 표시 조건:', { shouldShow, formData });

                    if (shouldShow) {
                        // 마커 생성 또는 업데이트
                        await window.MemoMarkerManager.createOrUpdateMarker(formData);
                        console.log('✅ 마커 생성/업데이트 완료');
                    } else if (currentPNU && window.MemoMarkerManager.markers.has(currentPNU)) {
                        // 정보가 없으면 마커 제거
                        window.MemoMarkerManager.removeMemoMarker(currentPNU);
                        console.log('🗑️ 마커 제거 (정보 없음)');
                    }
                }
            } catch (error) {
                console.error('❌ 마커 생성 실패:', error);
                if (retryCount < 3) {
                    console.log(`🔄 마커 생성 재시도 (${retryCount + 1}/3)...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                    await createMarkerWithRetry(retryCount + 1);
                }
            }
        };

        // 비동기로 마커 생성 (저장 완료에 영향 없도록)
        createMarkerWithRetry().catch(err => {
            console.error('❌ 마커 생성 최종 실패:', err);
        });

        const saveStatus = [];
        if (localStorageSuccess) saveStatus.push('로컬저장');
        if (supabaseSuccess) saveStatus.push('클라우드저장');

        const statusText = saveStatus.length > 0 ? `(${saveStatus.join(', ')})` : '(오프라인저장)';
        console.log(`✅ 클릭 필지 저장 완료 ${statusText}`);

        return true;

    } catch (error) {
        console.error('🚨 클릭 필지 저장 중 오류:', error);
        return false;
    }
}

// 검색 필지 전용 저장 함수
async function saveSearchParcelData() {
    let parcelNumber = document.getElementById('parcelNumber').value;

    // PNU가 있으면 지번 체크 건너뛰기
    if (!window.currentSelectedPNU && !parcelNumber) {
        console.warn('⚠️ 필지를 선택하거나 지번을 입력해주세요.');
        return false;
    }

    // PNU가 있고 지번이 비어있으면 자동 설정
    if (window.currentSelectedPNU && !parcelNumber) {
        parcelNumber = '자동입력';
        console.log('🎯 검색 필지 PNU로 저장 진행:', window.currentSelectedPNU);
    }

    console.log('💾 검색 필지 저장 시작:', parcelNumber);

    try {
        // 현재 선택된 필지의 PNU 사용
        let currentPNU = window.currentSelectedPNU;
        let geometry = null;

        // PNU가 있으면 searchParcels에서 geometry 가져오기
        if (currentPNU) {
            let parcelData = window.searchParcels.get(currentPNU);
            if (parcelData) {
                geometry = parcelData.data ? parcelData.data.geometry : parcelData.geometry;
            }
        } else {
            // PNU가 없으면 지번으로 searchParcels에서 검색
            window.searchParcels.forEach((parcelData, pnu) => {
                const jibun = formatJibun(parcelData.data?.properties || {});
                if (jibun === parcelNumber && !currentPNU) {
                    currentPNU = pnu;
                    geometry = parcelData.data ? parcelData.data.geometry : parcelData.geometry;
                }
            });
        }

        const formData = {
            parcelNumber: parcelNumber,
            pnu: currentPNU,
            ownerName: document.getElementById('ownerName').value,
            ownerAddress: document.getElementById('ownerAddress').value,
            ownerContact: document.getElementById('ownerContact').value,
            memo: document.getElementById('memo').value,
            color: '#9370DB', // 검색 필지는 항상 보라색
            geometry: geometry,
            timestamp: new Date().toISOString(),
            isSearchParcel: true,
            parcel_type: 'search'
        };

        // 📍 geometry에서 중심 좌표 추출 (메모 마커용)
        if (geometry && geometry.coordinates) {
            let centerLat, centerLng;

            if (geometry.type === 'Point') {
                [centerLng, centerLat] = geometry.coordinates;
            } else if (geometry.type === 'Polygon') {
                const center = calculatePolygonCenter(geometry.coordinates[0]);
                [centerLng, centerLat] = center;
            } else if (geometry.type === 'MultiPolygon') {
                const center = calculatePolygonCenter(geometry.coordinates[0][0]);
                [centerLng, centerLat] = center;
            }

            if (centerLat && centerLng) {
                formData.lat = parseFloat(centerLat);
                formData.lng = parseFloat(centerLng);
            }
        }

        console.log('📄 검색 필지 저장할 데이터:', formData);

        // 1단계: 새로운 분리된 localStorage 저장
        let localStorageSuccess = false;
        try {
            let savedData = window.getSearchParcelData();
            const existingIndex = savedData.findIndex(item =>
                (item.pnu && item.pnu === currentPNU) ||
                item.parcelNumber === formData.parcelNumber
            );

            if (existingIndex > -1) {
                savedData[existingIndex] = formData;
            } else {
                savedData.push(formData);
            }

            window.saveSearchParcelData(savedData);
            localStorageSuccess = true;
            console.log('✅ 검색 필지 localStorage 저장 성공');
        } catch (localError) {
            console.error('❌ 검색 필지 localStorage 저장 실패:', localError);
        }

        // 2단계: Supabase에 검색 필지로 저장
        let supabaseSuccess = false;
        try {
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                await window.SupabaseManager.saveSearchParcel(formData);
                supabaseSuccess = true;
                console.log('✅ 검색 필지 Supabase 저장 성공:', currentPNU);
            } else {
                console.warn('⚠️ SupabaseManager 연결 없음 - localStorage만 사용');
            }
        } catch (supabaseError) {
            console.error('❌ 검색 필지 Supabase 저장 실패:', supabaseError);
        }

        // 3단계: searchParcels Map 업데이트
        const parcelData = window.searchParcels.get(currentPNU);
        if (parcelData) {
            // Map에 저장된 데이터 업데이트
            parcelData.ownerName = formData.ownerName;
            parcelData.ownerAddress = formData.ownerAddress;
            parcelData.ownerContact = formData.ownerContact;
            parcelData.memo = formData.memo;
            parcelData.color = formData.color;
            parcelData.savedInfo = formData;

            // 검색 필지는 보라색 유지
            console.log('🔍 검색 필지는 보라색 유지:', currentPNU);

            console.log('✅ 검색 필지 지도 업데이트 성공');
        }

        // 4단계: UI 업데이트
        await updateParcelList();
        if (window.parcelManager) {
            window.parcelManager.loadParcels();
            window.parcelManager.applyFilters();
            window.parcelManager.render();
        }
        window.dispatchEvent(new Event('refreshParcelList'));

        // 5단계: 마커 업데이트 (검색 필지는 더 엄격하게)
        const hasRealInfo = (formData.ownerName && formData.ownerName.trim() !== '') ||
                           (formData.ownerAddress && formData.ownerAddress.trim() !== '') ||
                           (formData.ownerContact && formData.ownerContact.trim() !== '') ||
                           (formData.memo && formData.memo.trim() !== '');

        if (window.MemoMarkerManager) {
            if (hasRealInfo) {
                const markerData = {
                    ...formData,
                    lat: formData.lat,
                    lng: formData.lng,
                    geometry: formData.geometry
                };
                await window.MemoMarkerManager.createMemoMarker(markerData);
                console.log('📍 검색 필지 마커 생성/업데이트:', formData.parcelNumber);
            } else {
                const pnu = formData.pnu || currentPNU;
                if (pnu && window.MemoMarkerManager.markers.has(pnu)) {
                    window.MemoMarkerManager.removeMemoMarker(pnu);
                    console.log('🗑️ 검색 필지 마커 제거:', formData.parcelNumber);
                }
            }
        }

        const saveStatus = [];
        if (localStorageSuccess) saveStatus.push('로컬저장');
        if (supabaseSuccess) saveStatus.push('클라우드저장');

        const statusText = saveStatus.length > 0 ? `(${saveStatus.join(', ')})` : '(오프라인저장)';
        console.log(`✅ 검색 필지 저장 완료 ${statusText}`);

        return true;

    } catch (error) {
        console.error('🚨 검색 필지 저장 중 오류:', error);
        return false;
    }
}

// 저장된 필지 데이터 가져오기
async function getSavedParcelData(pnu) {
    const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
    // PNU로 찾기
    return savedData.find(item => item.pnu === pnu);
}

// 지번으로 저장된 필지 데이터 가져오기
async function getSavedParcelDataByJibun(jibun) {
    const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
    return savedData.find(item => item.parcelNumber === jibun);
}

// 필지에 메모가 있는지 확인
async function hasParcelMemo(parcel) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const jibun = formatJibun(parcel.properties);
    const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
    // PNU 또는 지번으로 찾기
    const parcelInfo = savedData.find(item => 
        (item.pnu && item.pnu === pnu) || 
        item.parcelNumber === jibun
    );
    return parcelInfo && parcelInfo.memo && parcelInfo.memo.trim() !== '';
}

// 필지에 저장된 정보가 있는지 확인 (소유자명, 주소, 연락처, 메모 중 하나라도)
async function hasParcelInfo(parcel) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const jibun = formatJibun(parcel.properties);
    const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
    // PNU 또는 지번으로 찾기
    const parcelInfo = savedData.find(item => 
        (item.pnu && item.pnu === pnu) || 
        item.parcelNumber === jibun
    );
    
    if (!parcelInfo) return false;
    
    // 정보 중 하나라도 있으면 true
    return (parcelInfo.ownerName && parcelInfo.ownerName.trim() !== '') ||
           (parcelInfo.ownerAddress && parcelInfo.ownerAddress.trim() !== '') ||
           (parcelInfo.ownerContact && parcelInfo.ownerContact.trim() !== '') ||
           (parcelInfo.memo && parcelInfo.memo.trim() !== '');
}

// 필지 정보를 폼에 로드
async function loadParcelInfoToForm(parcel) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const jibun = formatJibun(parcel.properties);
    
    // 현재 선택된 PNU 업데이트
    window.currentSelectedPNU = pnu;
    
    const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
    // PNU 또는 지번으로 찾기
    const parcelInfo = savedData.find(item => 
        (item.pnu && item.pnu === pnu) || 
        item.parcelNumber === jibun
    );
    
    if (parcelInfo) {
        document.getElementById('parcelNumber').value = parcelInfo.parcelNumber || '';
        document.getElementById('ownerName').value = parcelInfo.ownerName || '';
        document.getElementById('ownerAddress').value = parcelInfo.ownerAddress || '';
        document.getElementById('ownerContact').value = parcelInfo.ownerContact || '';
        document.getElementById('memo').value = parcelInfo.memo || '';
        
        if (parcelInfo.color) {
            // 보라색(검색 필지)이 아닐 때만 현재 색상 업데이트
            if (parcelInfo.color !== '#9370DB') {
                currentColor = parcelInfo.color;
                document.getElementById('currentColor').style.background = currentColor;
                
                // 색상 팔레트에서 해당 색상 선택
                document.querySelectorAll('.color-item').forEach(item => {
                    item.classList.remove('active');
                    if (item.dataset.color === currentColor) {
                        item.classList.add('active');
                    }
                });
            }
        }
    }
}

// 저장된 필지 목록 업데이트
async function updateParcelList() {
    const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
    const container = document.getElementById('parcelListContainer');
    
    // DOM 요소가 없으면 건너뛰기
    if (!container) {
    // console.log('parcelListContainer not found, skipping update');
        return;
    }
    
    container.innerHTML = '';
    
    savedData.forEach(item => {
        const div = document.createElement('div');
        div.className = 'parcel-item';
        div.innerHTML = `
            <div class="parcel-item-header">
                <span class="parcel-item-number">${item.parcelNumber}</span>
                <div class="parcel-item-color" style="background: ${item.color}"></div>
            </div>
            <div class="parcel-item-info">
                ${item.ownerName ? `소유자: ${item.ownerName}` : ''}
                ${item.ownerContact ? `<br>연락처: ${item.ownerContact}` : ''}
            </div>
        `;
        
        div.addEventListener('click', () => {
            loadParcelToForm(item);
        });
        
        container.appendChild(div);
    });
}

// 필지 정보를 폼에 로드
function loadParcelToForm(data) {
    document.getElementById('parcelNumber').value = data.parcelNumber || '';
    document.getElementById('ownerName').value = data.ownerName || '';
    document.getElementById('ownerAddress').value = data.ownerAddress || '';
    document.getElementById('ownerContact').value = data.ownerContact || '';
    document.getElementById('memo').value = data.memo || '';
    
    // 보라색(검색 필지)이 아닐 때만 현재 색상 업데이트
    if (data.color !== '#9370DB') {
        currentColor = data.color;
        document.getElementById('currentColor').style.background = currentColor;
    }
}

// 저장된 필지 불러오기
async function loadSavedParcels() {
    const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
    await updateParcelList();
    
    // 현재 화면에 보이는 영역의 필지들에 색상 복원
    await restoreSavedParcelsOnMap();
}

// 지도에 저장된 필지 색상 복원
async function restoreSavedParcelsOnMap() {
    const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
    // console.log(`저장된 필지 ${savedData.length}개 복원 시작`);
    
    // 저장된 데이터 중 geometry가 있는 항목들 처리
    for (const saved of savedData) {
        if (saved.geometry && saved.color && saved.color !== 'transparent') {
            // 검색 필지인지 클릭 필지인지 구분
            const targetMap = saved.isSearchParcel ? window.searchParcels : window.clickParcels;
            
            // 해당 Map에 이미 있는지 확인
            const existingParcel = targetMap.get(saved.pnu);
            
            if (existingParcel && existingParcel.polygon) {
                // 이미 있으면 색상만 변경
                existingParcel.polygon.setOptions({
                    fillColor: saved.color,
                    fillOpacity: saved.isSearchParcel ? 0.7 : 0.5  // 검색 필지는 더 진하게
                });
                existingParcel.color = saved.color;
    // console.log(`기존 ${saved.isSearchParcel ? '검색' : '클릭'} 필지 색상 복원: ${saved.parcelNumber} - ${saved.color}`);
            } else if (saved.geometry) {
                // 없으면 폴리곤 생성
                const parcelData = {
                    geometry: saved.geometry,
                    properties: {
                        PNU: saved.pnu,
                        jibun: saved.parcelNumber
                    }
                };
                
                // 검색 필지인 경우 searchParcels에, 클릭 필지인 경우 clickParcels에 추가
                if (saved.isSearchParcel) {
                    // searchParcels에 추가 (보라색으로)
                    const polygonOptions = {
                        fillColor: '#9370DB',
                        fillOpacity: 0.7,
                        strokeColor: '#9370DB',
                        strokeOpacity: 0.8,
                        strokeWeight: 2
                    };
                    
                    // 폴리곤 생성 로직 (drawParcelPolygon 대신 직접 구현)
                    const coords = parcelData.geometry.coordinates[0].map(coord => 
                        new naver.maps.LatLng(coord[1], coord[0])
                    );
                    
                    const polygon = new naver.maps.Polygon({
                        map: window.currentMode === 'search' ? map : null,
                        paths: coords,
                        ...polygonOptions
                    });
                    
                    targetMap.set(saved.pnu, {
                        polygon: polygon,
                        data: parcelData,
                        color: '#9370DB'
                    });
                    
    // console.log(`새 검색 필지 생성 및 색상 복원: ${saved.parcelNumber} - #9370DB`);
                } else {
                    // 폴리곤 그리기 (클릭 필지)
                    await drawParcelPolygon(parcelData, false);
                    
                    // 색상 적용
                    const newParcel = window.clickParcels.get(saved.pnu);
                    if (newParcel && newParcel.polygon) {
                        newParcel.polygon.setOptions({
                            fillColor: saved.color,
                            fillOpacity: 0.5
                        });
                        newParcel.color = saved.color;
    // console.log(`새 클릭 필지 생성 및 색상 복원: ${saved.parcelNumber} - ${saved.color}`);
                    }
                }
            }
        }
    }
    
    // 현재 지도에 표시된 필지들도 확인
    window.clickParcels.forEach((parcelData, pnu) => {
        if (!parcelData.color || parcelData.color === 'transparent') {
            const jibun = formatJibun(parcelData.data.properties);
            
            // 저장된 데이터에서 해당 필지 찾기
            const saved = savedData.find(item => 
                (item.pnu && item.pnu === pnu) || 
                (item.parcelNumber && item.parcelNumber === jibun)
            );
            
            if (saved && saved.color && saved.color !== 'transparent') {
                // 색상 복원
                if (parcelData.polygon) {
                    parcelData.polygon.setOptions({
                        fillColor: saved.color,
                        fillOpacity: 0.5
                    });
                    parcelData.color = saved.color;
    // console.log(`추가 색상 복원: ${jibun} - ${saved.color}`);
                }
            }
        }
    });
}

// 선택 필지 색상 초기화
async function clearSelectedParcelsColors() {
    let clearedCount = 0;
    
    for (const [pnu, parcelData] of window.clickParcels) {
        // 사용자가 색칠한 필지만 초기화 (8가지 색상 중 하나)
        if (parcelData.polygon && parcelData.color !== 'transparent' && parcelData.color !== '#FFFF00') {
            // 저장된 정보가 있는 필지는 건너뛰기
            const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
            const hasInfo = savedData.some(item => {
                if (item.pnu !== pnu && (!item.parcelNumber || item.parcelNumber !== parcelData.data?.properties?.jibun)) {
                    return false;
                }
                return (item.ownerName && item.ownerName.trim() !== '') ||
                       (item.ownerAddress && item.ownerAddress.trim() !== '') ||
                       (item.ownerContact && item.ownerContact.trim() !== '') ||
                       (item.memo && item.memo.trim() !== '');
            });
            
            if (hasInfo) {
    // console.log('정보가 있는 필지 보호:', pnu);
                continue;
            }
            
            // 폴리곤 색상 제거
            parcelData.polygon.setOptions({
                fillColor: 'transparent',
                fillOpacity: 0,
                strokeColor: '#0000FF',
                strokeWeight: 0.5
            });
            parcelData.color = 'transparent';
            clearedCount++;
        }
    }
    
    if (clearedCount > 0) {
        // 폼 초기화
        document.getElementById('parcelForm').reset();
        alert(`${clearedCount}개의 선택 필지가 초기화되었습니다.`);
    } else {
        alert('초기화할 선택 필지가 없습니다.');
    }
}

// 모든 필지 색상 초기화 (선택 + 검색)
async function clearAllParcelsColors() {
    // confirm은 utils.js에서 이미 처리됨
    let clearedCount = 0;
    
    // 선택 필지 초기화 (저장된 정보가 있어도 강제로 초기화)
    window.clickParcels.forEach((parcelData, pnu) => {
        if (parcelData.polygon && parcelData.color !== 'transparent') {
            // 폴리곤 색상 제거
            parcelData.polygon.setOptions({
                fillColor: 'transparent',
                fillOpacity: 0,
                strokeColor: '#0000FF',
                strokeWeight: 0.5
            });
            parcelData.color = 'transparent';
            clearedCount++;
        }
    });
    
    // 검색 필지도 초기화
    if (typeof clearAllSearchResults === 'function') {
        clearAllSearchResults();
    }
    
    // 폼 초기화
    document.getElementById('parcelForm').reset();
    
    // console.log(`전체 초기화: ${clearedCount}개 필지 색상 제거`);
    alert('모든 필지가 초기화되었습니다.');
}

// 이벤트 리스너 초기화
function initializeEventListeners() {
    // 색상 선택
    // 색상 이벤트 핸들러는 utils.js에서 처리함 (중복 제거)
    // document.querySelectorAll('.color-item').forEach(item => {
    //     item.addEventListener('click', function() {
    //         document.querySelectorAll('.color-item').forEach(i => i.classList.remove('active'));
    //         this.classList.add('active');
    //         // dataset.hex에서 실제 색상 값 가져오기 (dataset.color는 인덱스임)
    //         const hexColor = this.dataset.hex || this.style.background;
    //         currentColor = hexColor;
    //         window.currentColor = hexColor;
    //         document.getElementById('currentColor').style.background = hexColor;
    //     });
    // });
    
    // 필지 정보 저장 버튼 - Phase 4: 모드별 함수 호출
    const saveParcelInfoBtn = document.getElementById('saveParcelInfoBtn');
    if (saveParcelInfoBtn) {
        saveParcelInfoBtn.addEventListener('click', async () => {
            // 🚫 검색 모드에서는 저장 불가
            if (window.currentMode === 'search') {
                console.warn('🚫 검색 모드에서는 저장할 수 없습니다');
                alert('검색 모드에서는 저장할 수 없습니다.\n\n' +
                      '• 검색 필지를 삭제하려면 해당 필지를 클릭하세요\n' +
                      '• 필지에 정보를 저장하려면 검색 OFF 모드로 전환하세요');
                return;
            }

            console.log('🎯 클릭 모드에서 saveClickParcelData() 호출');
            await saveClickParcelData();
        });
    }

    // 클립보드 복사 버튼 - 엑셀 호환 탭 구분 형식
    const copyToClipboardBtn = document.getElementById('copyToClipboardBtn');
    if (copyToClipboardBtn) {
        copyToClipboardBtn.addEventListener('click', async () => {
            try {
                // 현재 필지 정보 가져오기
                const parcelNumber = document.getElementById('parcelNumber').value || '';
                const ownerName = document.getElementById('ownerName').value || '';
                const ownerAddress = document.getElementById('ownerAddress').value || '';
                const ownerContact = document.getElementById('ownerContact').value || '';
                const memo = document.getElementById('memo').value || '';

                // 탭으로 구분된 텍스트 생성 (엑셀 붙여넣기 호환)
                const tabSeparatedText = `${parcelNumber}\t${ownerName}\t${ownerAddress}\t${ownerContact}\t${memo}`;

                // 클립보드에 복사
                await navigator.clipboard.writeText(tabSeparatedText);

                // 성공 피드백
                const originalText = copyToClipboardBtn.textContent;
                copyToClipboardBtn.textContent = '✅ 복사 완료!';
                copyToClipboardBtn.style.backgroundColor = '#28a745';

                setTimeout(() => {
                    copyToClipboardBtn.textContent = originalText;
                    copyToClipboardBtn.style.backgroundColor = '#007bff';
                }, 2000);

                console.log('📋 클립보드 복사 완료:', {
                    parcelNumber,
                    ownerName,
                    ownerAddress,
                    ownerContact,
                    memo
                });

            } catch (error) {
                console.error('❌ 클립보드 복사 실패:', error);
                alert('클립보드 복사에 실패했습니다.');
            }
        });
    }

    // 초기화 버튼들 (제거된 버튼들은 안전하게 체크)
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.getElementById('parcelForm').reset();
        });
    }
    
    const clearSelectedBtn = document.getElementById('clearSelectedBtn');
    if (clearSelectedBtn) {
        clearSelectedBtn.addEventListener('click', async () => {
            await clearSelectedParcelsColors();
        });
    }
    
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            // search.js의 clearAllSearchResults 함수 호출
            if (typeof clearAllSearchResults === 'function') {
                clearAllSearchResults();
            }
        });
    }
    // 중복 이벤트 리스너 제거 - utils.js에서 이미 등록됨
}

// 🎯 ULTRATHINK: 강화된 Point-in-Polygon 검사 (다중 알고리즘)
function isPointInPolygon(point, polygon) {
    try {
        const path = polygon.getPath();
        if (!path || path.length < 3) {
    // console.log(`   ❌ 폴리곤 경로 없음 또는 점 부족 (${path ? path.length : 0})`);
            return false;
        }
        
        const clickX = point.lng(), clickY = point.lat();
    // console.log(`   🎯 클릭 좌표: (${clickX.toFixed(6)}, ${clickY.toFixed(6)})`);
        
        // 폴리곤 범위 확인 먼저
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (let i = 0; i < path.length; i++) {
            const vertex = path.getAt(i);
            const x = vertex.lng(), y = vertex.lat();
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
        
    // console.log(`   📦 폴리곤 범위: X(${minX.toFixed(6)} ~ ${maxX.toFixed(6)}), Y(${minY.toFixed(6)} ~ ${maxY.toFixed(6)})`);
        
        // 클릭 점이 폴리곤 경계 범위 안에 있는지 확인
        if (clickX < minX || clickX > maxX || clickY < minY || clickY > maxY) {
    // console.log(`   ❌ 클릭 점이 폴리곤 경계 범위 밖에 있음`);
            return false;
        }
        
    // console.log(`   ✅ 클릭 점이 폴리곤 경계 범위 안에 있음`);
        
        // 1. 개선된 Ray Casting 알고리즘
        let intersections = 0;
        for (let i = 0; i < path.length; i++) {
            const j = (i + 1) % path.length;
            const xi = path.getAt(i).lng(), yi = path.getAt(i).lat();
            const xj = path.getAt(j).lng(), yj = path.getAt(j).lat();
            
            // 수평 광선과 선분의 교차 검사 (더 정밀한 방법)
            if (((yi > clickY) !== (yj > clickY)) && 
                (clickX < (xj - xi) * (clickY - yi) / (yj - yi) + xi)) {
                intersections++;
            }
        }
        
        const raycastResult = intersections % 2 === 1;
    // console.log(`   🏹 Ray Casting: ${intersections}번 교차 → ${raycastResult ? '내부' : '외부'}`);
        
        // 2. Winding Number 알고리즘 (더 정확함)
        let wn = 0;
        for (let i = 0; i < path.length; i++) {
            const j = (i + 1) % path.length;
            const xi = path.getAt(i).lng(), yi = path.getAt(i).lat();
            const xj = path.getAt(j).lng(), yj = path.getAt(j).lat();
            
            if (yi <= clickY) {
                if (yj > clickY) { // upward crossing
                    const cross = (xj - xi) * (clickY - yi) - (clickX - xi) * (yj - yi);
                    if (cross > 0) wn++;
                }
            } else {
                if (yj <= clickY) { // downward crossing
                    const cross = (xj - xi) * (clickY - yi) - (clickX - xi) * (yj - yi);
                    if (cross < 0) wn--;
                }
            }
        }
        
        const windingResult = wn !== 0;
    // console.log(`   🌪️ Winding Number: ${wn} → ${windingResult ? '내부' : '외부'}`);
        
        // 두 알고리즘 결과 비교
        if (raycastResult === windingResult) {
    // console.log(`   ✅ 두 알고리즘 일치: ${raycastResult ? '폴리곤 내부' : '폴리곤 외부'}`);
            return raycastResult;
        } else {
    // console.log(`   ⚠️ 알고리즘 불일치! Ray: ${raycastResult}, Winding: ${windingResult} → Winding 결과 채택`);
            return windingResult;
        }
        
    } catch (error) {
        console.error(`   ❌ Point-in-Polygon 검사 오류:`, error);
        return false;
    }
}

// 우클릭한 위치의 필지 삭제 (Point-in-Polygon 방식)
async function removeParcelAtLocation(lat, lng) {
    try {
        // 디버깅 로그: 함수 시작
        window.RightClickDebugger.log('SEARCH', 'removeParcelAtLocation 함수 시작', {
            coordinates: { lat, lng },
            formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        });
        
        console.log(`🗑️ 우클릭 삭제 시도: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        
        // 🔍 디버깅: clickParcels 상태 확인
        const parcelCount = window.clickParcels ? window.clickParcels.size : 0;
        window.RightClickDebugger.log('SEARCH', 'clickParcels 상태 확인', {
            exists: !!window.clickParcels,
            count: parcelCount,
            isEmpty: parcelCount === 0
        });
        
        if (window.clickParcels) {
            const parcelInfo = [];
            window.clickParcels.forEach((parcelData, pnu) => {
                parcelInfo.push({
                    pnu,
                    color: parcelData.color,
                    hasPolygon: !!parcelData.polygon,
                    isColored: parcelData.color !== 'transparent'
                });
            });
            
            window.RightClickDebugger.log('SEARCH', 'clickParcels 내용 분석', {
                parcels: parcelInfo,
                coloredCount: parcelInfo.filter(p => p.isColored).length
            });
        }
        
        let targetParcel = null;
        
        // 🎯 ULTRATHINK: 정확한 Point-in-Polygon 기반 삭제 (폴리곤 내부만 삭제)
        window.RightClickDebugger.log('POLYGON', 'Point-in-Polygon 검사 시작');
        
        // 색칠된 필지들 중에서 클릭 위치가 내부에 있는 것 찾기
        if (window.clickParcels) {
            let checkedCount = 0;
            let coloredCount = 0;
            const polygonResults = [];
            
            window.clickParcels.forEach((parcelData, pnu) => {
                checkedCount++;

                // 모든 필지에 대해 체크 (색상 유무와 관계없이)
                if (parcelData.polygon) {
                    if (parcelData.color !== 'transparent') {
                        coloredCount++;
                    }

                    const path = parcelData.polygon.getPath();

                    if (path && path.getLength && path.getLength() > 0) {
                        // Point-in-Polygon 체크 - 클릭 위치가 폴리곤 내부에 있는지 확인
                        const isInside = isPointInPolygon(lat, lng, path);

                        polygonResults.push({
                            pnu,
                            color: parcelData.color,
                            pathLength: path.getLength(),
                            isInside
                        });

                        window.RightClickDebugger.log('POLYGON', `필지 ${pnu} 검사 완료`, {
                            pnu,
                            color: parcelData.color,
                            pathPoints: path.getLength(),
                            isInside,
                            result: isInside ? '내부 - 삭제 대상' : '외부 - 제외'
                        });

                        if (isInside) {
                            targetParcel = { pnu, data: parcelData };
                            window.RightClickDebugger.log('POLYGON', '삭제 대상 필지 발견!', {
                                selectedPNU: pnu,
                                color: parcelData.color
                            });
                            return; // 내부에 있으면 즉시 선택하고 종료
                        }
                    } else {
                        window.RightClickDebugger.log('POLYGON', `필지 ${pnu} 경로 정보 없음`, {
                            pnu,
                            hasPath: !!path,
                            pathLength: path ? path.getLength() : 0
                        });
                    }
                }
            });
            
            window.RightClickDebugger.log('POLYGON', 'Point-in-Polygon 검사 완료', {
                totalChecked: checkedCount,
                coloredParcels: coloredCount,
                polygonResults,
                targetFound: !!targetParcel
            });
        }
        
        // 클릭 위치가 정확히 폴리곤 내부에 있을 때만 삭제
        if (targetParcel) {
            const { pnu, data } = targetParcel;

            window.RightClickDebugger.log('DELETE', '필지 삭제 처리 시작', {
                pnu,
                currentColor: data.color,
                hasPolygon: !!data.polygon
            });

            console.log(`🗑️ 우클릭 삭제: ${pnu} - 색상과 모든 정보 삭제`);

            // 1. 색칠 해제 수행
            if (data.polygon) {
                data.polygon.setOptions({
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    strokeColor: '#0000FF',
                    strokeOpacity: 0.6,
                    strokeWeight: 0.5
                });
                data.color = 'transparent';

                window.RightClickDebugger.log('DELETE', '폴리곤 색상 제거 완료', {
                    pnu,
                    newColor: 'transparent'
                });
            }

            // 2. 마커 제거
            if (window.MemoMarkerManager) {
                try {
                    window.MemoMarkerManager.removeMemoMarker(pnu);
                    console.log(`📍 마커 제거 완료: ${pnu}`);
                    window.RightClickDebugger.log('DELETE', '마커 제거 완료', { pnu });
                } catch (err) {
                    console.warn('마커 제거 중 오류:', err);
                }

                // 마커 상태도 저장소에서 제거
                if (window.DataPersistenceManager) {
                    window.DataPersistenceManager.saveMarkerState(pnu, false);
                }
            }

            // 3. LocalStorage에서 모든 정보 제거
            const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
            const beforeCount = savedData.length;
            const updatedData = savedData.filter(item => item.pnu !== pnu);
            const afterCount = updatedData.length;
            await window.migratedSetItem(CONFIG.STORAGE_KEY, JSON.stringify(updatedData));

            // 4. parcelsData 배열에서도 제거
            if (window.parcelsData) {
                window.parcelsData = window.parcelsData.filter(item =>
                    item.pnu !== pnu && item.parcelNumber !== data.data?.PNU
                );
            }

            // 5. 색상 정보 제거
            if (window.DataPersistenceManager) {
                window.DataPersistenceManager.removeParcelColor(pnu);
            }

            // 6. Supabase에서도 삭제
            if (window.SupabaseManager && window.SupabaseManager.client) {
                try {
                    // parcels 테이블에서 삭제
                    const { error } = await window.SupabaseManager.client
                        .from('parcels')
                        .delete()
                        .or(`pnu.eq.${pnu},parcel_name.eq.${data.data?.ADDR || ''}`);

                    if (error) {
                        console.warn('Supabase 삭제 실패:', error);
                    } else {
                        console.log('☁️ Supabase에서 삭제 완료');
                    }
                } catch (err) {
                    console.warn('Supabase 삭제 중 오류:', err);
                }
            }

            window.RightClickDebugger.log('DELETE', 'LocalStorage 및 전체 데이터 제거 완료', {
                pnu,
                beforeCount,
                afterCount,
                removed: beforeCount - afterCount
            });

            // 7. 필지 목록 업데이트
            if (window.parcelManager && window.parcelManager.renderParcelList) {
                window.parcelManager.renderParcelList();
                window.RightClickDebugger.log('DELETE', '필지 목록 업데이트 완료');
            }

            // 8. 현재 선택된 필지라면 폼도 초기화
            if (window.currentSelectedPNU === pnu) {
                document.getElementById('parcelNumber').value = '';
                document.getElementById('ownerName').value = '';
                document.getElementById('ownerAddress').value = '';
                document.getElementById('ownerContact').value = '';
                document.getElementById('memo').value = '';
                window.currentSelectedPNU = null;

                window.RightClickDebugger.log('DELETE', '선택된 필지 폼 초기화 완료', {
                    clearedPNU: pnu
                });
            }

            // 9. 실시간 동기화 트리거
            if (window.autoSaveEnabled && window.triggerAutoSave) {
                window.triggerAutoSave('parcel_delete');
            }

            window.RightClickDebugger.log('SUCCESS', '필지 완전 삭제 성공!', {
                pnu,
                totalOperations: '색상, 마커, 정보, Supabase 모두 삭제 완료'
            });
            
        } else {
            window.RightClickDebugger.log('DELETE', '삭제 대상 필지 없음 - 클릭 위치가 색칠된 폴리곤 내부에 없음', {
                clickPosition: { lat, lng },
                reason: 'Point-in-Polygon 검사에서 일치하는 필지 없음'
            });
        }
        
        // 함수 종료 (API 호출은 비동기로 처리됨)
    } catch (error) {
        console.error('🚨 removeParcelAtLocation 함수 전체 에러:', error);
        console.error('🔍 에러 상세:', {
            message: error.message,
            stack: error.stack,
            coordinates: { lat, lng }
        });
    }
}

// 삭제용 필지 정보 조회 (간소화된 버전)
async function getParcelInfoForDeletion(lat, lng) {
    // console.log('🔍 삭제용 필지 정보 조회 중...');

    // 서버 프록시를 통한 VWorld API 호출 - 올바른 형식 사용
    try {
        const geometry = `POINT(${lng} ${lat})`;
        const response = await fetch(`/api/vworld-proxy?geomFilter=${encodeURIComponent(geometry)}`);
        if (!response.ok) {
            throw new Error(`HTTP 오류: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.response && data.response.status === 'OK' && data.response.result) {
            const features = data.response.result.featureCollection?.features;
            if (features && features.length > 0) {
                const feature = features[0];
                return {
                    pnu: feature.properties.PNU || feature.properties.pnu,
                    properties: feature.properties,
                    geometry: feature.geometry
                };
            }
        }
        return null;
    } catch (error) {
        console.error('삭제용 필지 조회 실패:', error);
        return null;
    }
}

// 🎯 ULTRATHINK: Point-in-Polygon 헬퍼 함수 (Ray Casting Algorithm)
function isPointInPolygon(pointLat, pointLng, polygonPath) {
    let inside = false;

    // MVCArray인지 일반 배열인지 확인
    const pathLength = polygonPath.length || polygonPath.getLength();
    const getPoint = (index) => {
        const point = polygonPath.getAt ? polygonPath.getAt(index) : polygonPath[index];
        return {
            lat: typeof point.lat === 'function' ? point.lat() : point.lat,
            lng: typeof point.lng === 'function' ? point.lng() : point.lng
        };
    };

    for (let i = 0, j = pathLength - 1; i < pathLength; j = i++) {
        const pi = getPoint(i);
        const pj = getPoint(j);

        const xi = pi.lng;
        const yi = pi.lat;
        const xj = pj.lng;
        const yj = pj.lat;

        if (((yi > pointLat) !== (yj > pointLat)) &&
            (pointLng < (xj - xi) * (pointLat - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}

// 전역으로 노출 (mode-click-handler.js와 mode-search-handler.js에서 사용)
window.isPointInPolygon = isPointInPolygon;

// 🎯 ULTRATHINK: 점에서 폴리곤 경계까지의 최단 거리 계산
function getDistanceToPolygonEdge(pointLat, pointLng, polygonPath) {
    let minDistance = Infinity;
    const pathLength = polygonPath.length;
    
    // 각 선분(edge)과의 거리를 계산
    for (let i = 0; i < pathLength; i++) {
        const j = (i + 1) % pathLength;
        const x1 = polygonPath.getAt(i).lng();
        const y1 = polygonPath.getAt(i).lat();
        const x2 = polygonPath.getAt(j).lng();
        const y2 = polygonPath.getAt(j).lat();
        
        const distance = getDistanceToLineSegment(pointLng, pointLat, x1, y1, x2, y2);
        if (distance < minDistance) {
            minDistance = distance;
        }
    }
    
    return minDistance;
}

// 🎯 ULTRATHINK: 점에서 선분까지의 최단 거리 계산
function getDistanceToLineSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    let param = -1;
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// 기존 필지 데이터 로드 (검색/클릭 구분)
async function loadExistingParcelData(jibun, type = 'click') {
    try {
        const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
        const existingParcel = savedData.find(item => 
            item.parcelNumber === jibun && 
            item.isSearchParcel === (type === 'search')
        );

        if (existingParcel) {
            // 폼에 데이터 로드
            document.getElementById('ownerName').value = existingParcel.ownerName || '';
            document.getElementById('ownerAddress').value = existingParcel.ownerAddress || '';
            document.getElementById('ownerContact').value = existingParcel.ownerContact || '';
            document.getElementById('memo').value = existingParcel.memo || '';

            console.log('📂 기존 데이터 로드:', jibun, type);
            return existingParcel;
        } else {
            // 새 필지인 경우 폼 초기화
            document.getElementById('ownerName').value = '';
            document.getElementById('ownerAddress').value = '';
            document.getElementById('ownerContact').value = '';
            document.getElementById('memo').value = '';
            
            console.log('📄 새 필지:', jibun, type);
            return null;
        }
    } catch (error) {
        console.error('❌ 기존 데이터 로드 실패:', error);
        return null;
    }
}

// 전역 함수로 등록
window.removeParcelAtLocation = removeParcelAtLocation;
window.loadExistingParcelData = loadExistingParcelData;
window.applyColorToParcel = applyColorToParcel;
window.selectParcel = selectParcel;
window.saveClickParcelData = saveClickParcelData;
window.saveParcelData = saveParcelData; // 🔥 중요: saveParcelData를 전역으로 노출