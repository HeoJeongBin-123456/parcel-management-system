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

// 실제 VWorld API로 필지 정보 조회
async function getParcelInfo(lat, lng) {
    // console.log(`🏢 실제 필지 정보 조회 시작: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    
    // 🚀 성능 최적화: 서버 프록시를 통한 빠른 API 호출
    try {
        const result = await getParcelInfoViaProxy(lat, lng);
        if (result) {
            // console.log('🎊 서버 프록시로 필지 데이터 획득 성공!');
            return;
        }
    } catch (error) {
        console.warn('⚠️ 서버 프록시 실패, JSONP 백업 시도:', error.message);
    }
    
    // 백업: JSONP 방식 (메인 키만 사용)
    const result = await getParcelInfoViaJSONP(lat, lng, 'E5B1657B-9B6F-3A4B-91EF-98512BE931A1');
    if (!result) {
        alert('해당 위치의 필지 정보를 찾을 수 없습니다.');
    }
}

// 🚀 서버 프록시를 통한 빠른 VWorld API 호출
async function getParcelInfoViaProxy(lat, lng) {
    const geometry = `POINT(${lng} ${lat})`;
    const url = `/api/vworld-proxy?geomFilter=${encodeURIComponent(geometry)}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.response && data.response.status === 'OK' && data.response.result) {
            const features = data.response.result.featureCollection?.features;
            
            if (features && features.length > 0) {
                const feature = features[0];
                const properties = feature.properties;
                
                // 필지 정보 UI 업데이트
                const parcelForUI = { properties: properties, geometry: feature.geometry };
                displayParcelInfo(parcelForUI);
                
                // 지도에 필지 표시
                const parcelForMap = { properties: properties, geometry: feature.geometry };
                const polygon = await drawParcelPolygon(parcelForMap, false);

                // 🎨 새로 조회한 필지에 현재 색상 적용
                if (polygon) {
                    console.log('🎨 새로운 필지에 색상 적용:', currentColor);
                    await toggleParcelSelection(parcelForMap, polygon);
                }

                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('❌ 서버 프록시 호출 실패:', error);
        throw error;
    }
}

// JSONP 방식으로 VWorld API 호출
async function getParcelInfoViaJSONP(lat, lng, apiKey) {
    // console.log('🌐 JSONP 방식으로 VWorld API 재시도...');
    
    return new Promise((resolve, reject) => {
        const callbackName = `vworld_callback_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const script = document.createElement('script');
        
        // JSONP 콜백 함수 등록
        window[callbackName] = async function(data) {
    // console.log('📡 JSONP 응답 수신:', data);
            
            try {
                if (data.response && data.response.status === 'OK' && data.response.result) {
                    const features = data.response.result.featureCollection?.features;
                    
                    if (features && features.length > 0) {
    // console.log(`🎊 JSONP로 실제 필지 데이터 획득! ${features.length}개`);
                        
                        const parcel = features[0];
                        displayParcelInfo(parcel);
                        const polygon = await drawParcelPolygon(parcel, true);
                        await toggleParcelSelection(parcel, polygon);
                        
                        resolve(parcel);
                    } else {
    // console.log('📭 JSONP: 빈 결과');
                        resolve(null);
                    }
                } else {
                    console.warn('⚠️ JSONP: 예상하지 못한 응답');
                    resolve(null);
                }
            } finally {
                // 정리
                document.head.removeChild(script);
                delete window[callbackName];
            }
        };
        
        // JSONP 요청 URL 생성
        const url = `http://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${apiKey}&geometry=true&geomFilter=POINT(${lng} ${lat})&size=10&format=json&crs=EPSG:4326&callback=${callbackName}`;
        
        script.src = url;
        script.onerror = () => {
            console.error('💥 JSONP 요청 실패');
            document.head.removeChild(script);
            delete window[callbackName];
            resolve(null);
        };
        
        document.head.appendChild(script);
        
        // 10초 타임아웃
        setTimeout(() => {
            if (document.head.contains(script)) {
                console.warn('⏱️ JSONP 타임아웃');
                document.head.removeChild(script);
                delete window[callbackName];
                resolve(null);
            }
        }, 10000);
    });
}




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

        // DataPersistenceManager에서 색상 상태 확인 (우선순위: DataPersistenceManager > savedParcel)
        let fillColor = 'transparent';
        let fillOpacity = 0;

        if (window.dataPersistenceManager) {
            const colorState = window.dataPersistenceManager.getColorState(pnu);
            if (colorState && colorState.is_colored && colorState.color) {
                fillColor = colorState.color;
                fillOpacity = 0.5;
                console.log('🎨 DataPersistenceManager에서 색상 복원:', pnu, fillColor);
            } else if (savedParcel && savedParcel.color) {
                fillColor = savedParcel.color;
                fillOpacity = savedParcel.color !== 'transparent' ? 0.5 : 0;
            }
        } else if (savedParcel && savedParcel.color) {
            fillColor = savedParcel.color;
            fillOpacity = savedParcel.color !== 'transparent' ? 0.5 : 0;
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
            e.domEvent.stopPropagation(); // 지도 클릭 이벤트 방지

            // PNU 확실히 설정
            const pnu = parcel.properties.PNU || parcel.properties.pnu;
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

        // 🗺️ 폴리곤 데이터를 Supabase + IndexedDB에 저장 (실시간 공유)
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
    // console.log('왼쪽 클릭 - 필지 색칠:', currentColor);
    selectParcel(parcel, polygon);
    applyColorToParcel(parcel, currentColor);
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

// 필지에 색상 적용 (즉시 저장 포함)
async function applyColorToParcel(parcel, color) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const parcelData = window.clickParcels.get(pnu);

    if (parcelData) {
        // 1. UI 즉시 업데이트
        parcelData.polygon.setOptions({
            fillColor: color,
            fillOpacity: 0.5
        });
        parcelData.color = color;

        // 2. 색상 즉시 저장 (DataPersistenceManager 사용)
        if (window.dataPersistenceManager) {
            const colorData = {
                color: color,
                is_colored: !!color,
                color_index: getColorIndex(color)
            };

            await window.dataPersistenceManager.saveColorState(pnu, colorData);
            console.log('🎨 색상 즉시 저장됨:', pnu, color);
        } else {
            // 폴백: 기존 방식으로 저장
            console.log('⚠️ DataPersistenceManager 없음, 기존 방식 사용');
        }

        // 3. 마커 상태 평가 (색상 변경이 마커에 영향 없음)
        if (window.dataPersistenceManager) {
            const parcelInfo = {
                parcel_number: parcel.properties.JIBUN || parcel.properties.jibun,
                owner_name: document.getElementById('ownerName')?.value,
                owner_address: document.getElementById('ownerAddress')?.value,
                contact: document.getElementById('ownerContact')?.value,
                memo: document.getElementById('memo')?.value
            };
            window.dataPersistenceManager.evaluateAndSaveMarkerState(pnu, parcelInfo);
        }
    }
}

// 색상 인덱스 찾기 헬퍼 함수
function getColorIndex(color) {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#FD79A8',
        '#A29BFE', '#FDCB6E'
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

// 필지 데이터 저장 (개선된 버전 - 데이터 손실 방지)
async function saveParcelData() {
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
            
            // 폴리곤 색상 업데이트
            if (parcelData.polygon) {
                parcelData.polygon.setOptions({
                    fillColor: formData.color,
                    fillOpacity: isSearchParcel ? 0.7 : 0.5,
                    strokeColor: formData.color
                });
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
        
        // 메모 마커 업데이트 (확장된 조건: PNU, 지번, 소유자명, 주소, 연락처, 메모 중 하나라도 있으면 마커 생성)
        const hasAnyInfo = (formData.pnu) ||
                          (formData.parcelNumber && formData.parcelNumber.trim() !== '') ||
                          (formData.ownerName && formData.ownerName.trim() !== '') ||
                          (formData.ownerAddress && formData.ownerAddress.trim() !== '') ||
                          (formData.ownerContact && formData.ownerContact.trim() !== '') ||
                          (formData.memo && formData.memo.trim() !== '');

        if (window.MemoMarkerManager) {
            if (hasAnyInfo) {
                // 좌표를 포함한 전체 데이터 전달
                const markerData = {
                    ...formData,
                    lat: parcelData.lat,
                    lng: parcelData.lng,
                    geometry: parcelData.geometry
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
        
        return true;
        
    } catch (error) {
        console.error('🚨 저장 중 전체 오류:', error);
        console.error('❌ 저장 오류 - 실시간 자동저장 시스템이 처리합니다');
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
    document.querySelectorAll('.color-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.color-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            currentColor = this.dataset.color;
            document.getElementById('currentColor').style.background = currentColor;
        });
    });
    
    // 저장 버튼
    document.getElementById('saveBtn').addEventListener('click', async () => {
        await saveParcelData();
    });
    
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
                
                if (parcelData.color !== 'transparent' && parcelData.polygon) {
                    coloredCount++;
                    const path = parcelData.polygon.getPath();
                    
                    if (path && path.length > 0) {
                        // Point-in-Polygon 체크 - 클릭 위치가 폴리곤 내부에 있는지 확인
                        const isInside = isPointInPolygon(lat, lng, path);
                        
                        polygonResults.push({
                            pnu,
                            color: parcelData.color,
                            pathLength: path.length,
                            isInside
                        });
                        
                        window.RightClickDebugger.log('POLYGON', `필지 ${pnu} 검사 완료`, {
                            pnu,
                            color: parcelData.color,
                            pathPoints: path.length,
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
                            pathLength: path ? path.length : 0
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
            
            console.log(`✅ 우클릭 삭제: ${pnu}`);
            
            // 색칠 해제 수행
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
            
            // LocalStorage에서 제거
            const savedData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
            const beforeCount = savedData.length;
            const updatedData = savedData.filter(item => item.pnu !== pnu);
            const afterCount = updatedData.length;
            await window.migratedSetItem(CONFIG.STORAGE_KEY, JSON.stringify(updatedData));
            
            window.RightClickDebugger.log('DELETE', 'LocalStorage 데이터 제거 완료', {
                pnu,
                beforeCount,
                afterCount,
                removed: beforeCount - afterCount
            });
            
            // 필지 목록 업데이트
            if (window.parcelManager && window.parcelManager.renderParcelList) {
                window.parcelManager.renderParcelList();
                window.RightClickDebugger.log('DELETE', '필지 목록 업데이트 완료');
            }
            
            // 현재 선택된 필지라면 폼도 초기화
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
            
            window.RightClickDebugger.log('SUCCESS', '필지 삭제 성공!', {
                pnu,
                totalOperations: '폴리곤 색상 제거, LocalStorage 업데이트, 목록 갱신 완료'
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
    
    // 서버 프록시를 통한 VWorld API 호출
    try {
        const response = await fetch(`/api/vworld?lat=${lat}&lng=${lng}`);
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
    const pathLength = polygonPath.length;
    
    for (let i = 0, j = pathLength - 1; i < pathLength; j = i++) {
        const xi = polygonPath.getAt(i).lng();
        const yi = polygonPath.getAt(i).lat();
        const xj = polygonPath.getAt(j).lng();
        const yj = polygonPath.getAt(j).lat();
        
        if (((yi > pointLat) !== (yj > pointLat)) &&
            (pointLng < (xj - xi) * (pointLat - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    return inside;
}

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