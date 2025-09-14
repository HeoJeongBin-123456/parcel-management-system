// 메모 마커 관리자 - 정보가 있는 필지에 M 표시 (확장된 조건)
class MemoMarkerManager {
    constructor() {
        this.markers = new Map(); // PNU -> marker 매핑
        this.isInitialized = false;
        console.log('📍 MemoMarkerManager 초기화');
    }

    // 마커 표시 조건 확인 (확장된 조건)
    shouldShowMarker(parcelData) {
        // PNU, 지번, 메모, 소유자명, 소유자주소, 연락처 중 하나라도 있으면 마커 표시
        return !!(
            (parcelData.pnu) ||
            (parcelData.parcelNumber && parcelData.parcelNumber.trim()) ||
            (parcelData.memo && parcelData.memo.trim()) ||
            (parcelData.ownerName && parcelData.ownerName.trim()) ||
            (parcelData.ownerAddress && parcelData.ownerAddress.trim()) ||
            (parcelData.ownerContact && parcelData.ownerContact.trim())
        );
    }

    // 초기화 (지도 로드 후 호출)
    async initialize() {
        if (this.isInitialized) return;

        // 지도 로드 대기
        if (!window.map) {
            setTimeout(() => this.initialize(), 500);
            return;
        }

        // 중복 마커 정리
        this.cleanupDuplicateMarkers();

        await this.loadAllMemoMarkers();
        this.isInitialized = true;
        console.log('✅ MemoMarkerManager 초기화 완료');
    }

    // 중복 마커 정리
    cleanupDuplicateMarkers() {
        const pnuMap = new Map();

        // PNU별로 마커 그룹화
        for (const [key, markerInfo] of this.markers.entries()) {
            const pnu = markerInfo.data?.pnu || key;
            if (!pnuMap.has(pnu)) {
                pnuMap.set(pnu, []);
            }
            pnuMap.get(pnu).push({ key, markerInfo });
        }

        // 중복 마커 제거 (각 PNU당 하나만 유지)
        for (const [pnu, markers] of pnuMap.entries()) {
            if (markers.length > 1) {
                console.log(`🗑️ PNU ${pnu}에 중복 마커 ${markers.length}개 발견, 정리 시작`);

                // 첫 번째 마커만 유지하고 나머지 제거
                for (let i = 1; i < markers.length; i++) {
                    const { key, markerInfo } = markers[i];
                    if (markerInfo.marker) {
                        markerInfo.marker.setMap(null);
                    }
                    this.markers.delete(key);
                    console.log(`  ✅ 중복 마커 제거: ${key}`);
                }
            }
        }
    }

    // 모든 메모 마커 로드 (Supabase 우선, localStorage 백업)
    async loadAllMemoMarkers() {
        try {
            console.log('🔍 메모 마커 로드 시작: Supabase 우선 → localStorage 백업');

            let allMemoData = [];

            // 🎯 1차: Supabase에서 메모가 있는 필지들 로드
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                try {
                    const supabaseMemoData = await window.SupabaseManager.loadMemoparcels();
                    if (supabaseMemoData && supabaseMemoData.length > 0) {
                        allMemoData = supabaseMemoData;
                        console.log(`📡 Supabase에서 ${allMemoData.length}개 메모 필지 로드 완료`);
                    }
                } catch (error) {
                    console.warn('⚠️ Supabase 메모 필지 로드 실패:', error);
                }
            }

            // 🔄 2차: Supabase 실패시 localStorage 백업 사용
            if (allMemoData.length === 0) {
                console.log('📁 localStorage에서 메모 필지 검색...');

                const possibleKeys = [
                    CONFIG.STORAGE_KEY,           // 'parcelData'
                    'parcels_current_session',    // 실제 저장되는 키
                    'parcels',                    // 다른 가능한 키
                    'parcelData_backup'           // 백업 키
                ];

                const seenParcels = new Set(); // 중복 제거용

                // 각 키에서 개별적으로 메모가 있는 필지 찾기
                for (const key of possibleKeys) {
                    try {
                        const data = localStorage.getItem(key);
                        if (data && data !== 'null' && data !== '[]') {
                            const parsed = JSON.parse(data);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                console.log(`🔍 ${key}에서 ${parsed.length}개 필지 발견`);

                                // 이 키에서 정보가 있는 필지들 찾기 (확장된 조건)
                                const withMemo = parsed.filter(parcel =>
                                    this.shouldShowMarker(parcel)
                                );

                                if (withMemo.length > 0) {
                                    console.log(`📝 ${key}에서 메모가 있는 필지 ${withMemo.length}개 발견`);

                                    // 중복 제거하면서 추가
                                    withMemo.forEach(parcel => {
                                        const identifier = parcel.pnu || parcel.parcelNumber || parcel.parcel_name || parcel.id;
                                        if (identifier && !seenParcels.has(identifier)) {
                                            seenParcels.add(identifier);
                                            allMemoData.push({
                                                ...parcel,
                                                sourceKey: key // 출처 키 저장
                                            });
                                            console.log(`📌 메모 필지 추가: ${identifier} (출처: ${key})`);
                                        }
                                    });
                                }
                            }
                        }
                    } catch (parseError) {
                        console.warn(`⚠️ ${key} 파싱 오류:`, parseError);
                    }
                }

                // 추가로 migratedGetItem에서도 메모 필지 찾기
                try {
                    if (window.migratedGetItem && typeof window.migratedGetItem === 'function') {
                        const migratedData = await window.migratedGetItem(CONFIG.STORAGE_KEY);
                        if (migratedData) {
                            const parsed = JSON.parse(migratedData);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                console.log(`📡 migratedGetItem에서 ${parsed.length}개 필지 발견`);

                                const withMemo = parsed.filter(parcel =>
                                    this.shouldShowMarker(parcel)
                                );

                                if (withMemo.length > 0) {
                                    console.log(`📝 migratedGetItem에서 메모가 있는 필지 ${withMemo.length}개 발견`);

                                    // 중복 제거하면서 추가
                                    withMemo.forEach(parcel => {
                                        const identifier = parcel.pnu || parcel.parcelNumber || parcel.parcel_name || parcel.id;
                                        if (identifier && !seenParcels.has(identifier)) {
                                            seenParcels.add(identifier);
                                            allMemoData.push({
                                                ...parcel,
                                                sourceKey: 'migratedGetItem' // 출처 키 저장
                                            });
                                        }
                                    });
                                }
                            }
                        }
                    }
                } catch (migratedError) {
                    console.warn('⚠️ migratedGetItem 오류:', migratedError);
                }
            }
            
            console.log(`📋 최종 메모 필지 발견: ${allMemoData.length}개`);
            
            if (allMemoData.length > 0) {
                console.log('📄 마커가 필요한 필지 목록:');
                allMemoData.forEach((parcel, index) => {
                    console.log(`${index + 1}. ${parcel.parcelNumber || parcel.parcel_name || parcel.pnu}:`, {
                        memo: parcel.memo ? parcel.memo.substring(0, 50) : '(메모 없음)',
                        hasLat: !!parcel.lat,
                        hasLng: !!parcel.lng,
                        source: parcel.sourceKey,
                        shouldShow: this.shouldShowMarker(parcel)
                    });
                });
            }

            // shouldShowMarker 조건을 만족하는 필지에 대해서만 마커 생성
            for (const parcel of allMemoData) {
                if (this.shouldShowMarker(parcel)) {
                    await this.createMemoMarker(parcel);
                    console.log('✅ 마커 생성:', parcel.pnu || parcel.parcelNumber || parcel.id);
                }
            }
        } catch (error) {
            console.error('❌ 메모 마커 로드 실패:', error);
        }
    }

    // 메모 마커 생성
    async createMemoMarker(parcelData) {
        try {
            // 일관된 키 생성: PNU 우선, 없으면 parcelNumber, 그것도 없으면 ID
            const pnu = parcelData.pnu || parcelData.parcelNumber || parcelData.id;

            if (!pnu) {
                console.warn('⚠️ 마커 키(PNU/지번)가 없어 생성 불가');
                return;
            }

            console.log('🔥 메모 마커 생성 시작:', {
                pnu: pnu,
                parcelNumber: parcelData.parcelNumber,
                hasLat: !!parcelData.lat,
                hasLng: !!parcelData.lng,
                lat: parcelData.lat,
                lng: parcelData.lng,
                hasGeometry: !!parcelData.geometry,
                geometryType: parcelData.geometry?.type,
                existingMarker: this.markers.has(pnu)
            });

            // 이미 마커가 있으면 기존 마커 제거 후 새로 생성
            if (this.markers.has(pnu)) {
                console.log('🔄 기존 마커 제거 후 재생성:', pnu);
                const existingMarker = this.markers.get(pnu);
                if (existingMarker && existingMarker.marker) {
                    existingMarker.marker.setMap(null);
                }
                this.markers.delete(pnu);
            }

            // 중복 마커 추가 체크: 같은 위치에 이미 마커가 있는지 확인
            for (const [key, markerInfo] of this.markers.entries()) {
                if (key !== pnu) {
                    const existingData = markerInfo.data;
                    if (existingData.pnu === parcelData.pnu ||
                        (existingData.parcelNumber && existingData.parcelNumber === parcelData.parcelNumber)) {
                        console.log('🗑️ 중복 마커 발견, 기존 마커 제거:', key);
                        if (markerInfo.marker) {
                            markerInfo.marker.setMap(null);
                        }
                        this.markers.delete(key);
                    }
                }
            }

            // 좌표 계산
            let { lat, lng } = this.getParcelCoordinates(parcelData);
            console.log('🎯 좌표 계산 결과:', { lat, lng, hasLat: !!lat, hasLng: !!lng });
            
            // 좌표가 없으면 VWorld API로 획득 시도
            if (!lat || !lng) {
                console.log('🚀 좌표 없음, VWorld API 시도:', parcelData.parcelNumber);
                const coordinates = await this.fetchCoordinatesFromVWorld(parcelData);
                if (coordinates && coordinates.lat && coordinates.lng) {
                    lat = coordinates.lat;
                    lng = coordinates.lng;
                    console.log('✅ VWorld API로 좌표 획득:', { lat, lng });
                    
                    // 획득한 좌표를 parcelData에 저장 (다음 사용을 위해)
                    parcelData.lat = lat;
                    parcelData.lng = lng;
                } else {
                    console.error('❌ VWorld API 좌표 획득 실패');
                }
            }
            
            if (!lat || !lng) {
                console.error('❌ 최종 좌표 획득 실패:', {
                    parcelNumber: parcelData.parcelNumber,
                    pnu: pnu,
                    lat: lat,
                    lng: lng,
                    parcelData: parcelData
                });
                return;
            }

            // 네이버 지도 좌표로 변환
            const position = new naver.maps.LatLng(lat, lng);

            // HTML 마커 엘리먼트 생성
            const markerElement = this.createMarkerElement(parcelData);

            // 네이버 지도 마커 생성
            const marker = new naver.maps.Marker({
                position: position,
                map: window.map,
                icon: {
                    content: markerElement.outerHTML,
                    anchor: new naver.maps.Point(12, 12)
                },
                zIndex: 1000
            });

            // 클릭 이벤트 추가
            naver.maps.Event.addListener(marker, 'click', () => {
                this.onMarkerClick(parcelData);
            });

            // 마커 저장
            this.markers.set(pnu, {
                marker: marker,
                data: parcelData,
                element: markerElement
            });

            // 🌟 Supabase에 마커 데이터 저장
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                try {
                    const markerData = {
                        type: 'memo',
                        position: { lat, lng },
                        memo: parcelData.memo,
                        parcelNumber: parcelData.parcelNumber,
                        element: markerElement.outerHTML
                    };
                    await window.SupabaseManager.saveParcelMarker(pnu, markerData);
                    console.log('✅ 메모 마커 Supabase 저장 완료:', pnu);
                } catch (error) {
                    console.error('❌ 메모 마커 Supabase 저장 실패:', error);
                }
            }

            console.log(`📍 메모 마커 생성: ${parcelData.parcelNumber}`);

        } catch (error) {
            console.error('❌ 메모 마커 생성 실패:', error, parcelData);
        }
    }

    // 마커 HTML 엘리먼트 생성
    createMarkerElement(parcelData) {
        const element = document.createElement('div');
        element.className = 'memo-marker';
        
        // 검색 필지와 클릭 필지 구분
        if (parcelData.isSearchParcel) {
            element.classList.add('search-parcel');
        }
        
        element.textContent = 'M';
        element.title = `메모: ${parcelData.memo.substring(0, 50)}${parcelData.memo.length > 50 ? '...' : ''}`;
        
        return element;
    }

    // 필지 좌표 계산
    getParcelCoordinates(parcelData) {
        let lat, lng;
        
        console.log('🔍 좌표 추출 시작:', {
            hasDirectLat: !!parcelData.lat,
            hasDirectLng: !!parcelData.lng,
            directLat: parcelData.lat,
            directLng: parcelData.lng,
            hasGeometry: !!parcelData.geometry,
            geometryType: parcelData.geometry?.type,
            hasCoordinates: !!(parcelData.geometry && parcelData.geometry.coordinates)
        });

        // 직접 좌표가 있는 경우
        if (parcelData.lat && parcelData.lng) {
            lat = parseFloat(parcelData.lat);
            lng = parseFloat(parcelData.lng);
            console.log('✅ 직접 좌표 사용:', { lat, lng });
        }
        // geometry에서 좌표 추출
        else if (parcelData.geometry && parcelData.geometry.coordinates) {
            console.log('🔍 geometry에서 좌표 추출:', parcelData.geometry);
            const coords = parcelData.geometry.coordinates;
            if (parcelData.geometry.type === 'Point') {
                [lng, lat] = coords;
                console.log('📍 Point 좌표 추출:', { lng, lat });
            } else if (parcelData.geometry.type === 'Polygon') {
                // 폴리곤 중심점 계산
                console.log('🔺 Polygon 중심점 계산:', coords[0]);
                const center = this.calculatePolygonCenter(coords[0]);
                [lng, lat] = center;
                console.log('📍 Polygon 중심점:', { lng, lat });
            } else if (parcelData.geometry.type === 'MultiPolygon') {
                // MultiPolygon의 첫 번째 폴리곤의 중심점 계산
                console.log('🔻 MultiPolygon 중심점 계산:', coords[0][0]);
                const center = this.calculatePolygonCenter(coords[0][0]);
                [lng, lat] = center;
                console.log('📍 MultiPolygon 중심점:', { lng, lat });
            }
        }
        // clickParcels/searchParcels에서 찾기
        else {
            console.log('🔍 clickParcels/searchParcels에서 검색:', parcelData.pnu || parcelData.id);
            const foundParcel = this.findParcelInMaps(parcelData.pnu || parcelData.id);
            console.log('🔍 검색된 필지:', foundParcel);
            if (foundParcel && foundParcel.data && foundParcel.data.geometry) {
                console.log('🔍 검색된 필지의 geometry:', foundParcel.data.geometry);
                const coords = foundParcel.data.geometry.coordinates;
                if (foundParcel.data.geometry.type === 'Point') {
                    [lng, lat] = coords;
                    console.log('📍 검색된 Point 좌표:', { lng, lat });
                } else if (foundParcel.data.geometry.type === 'Polygon') {
                    const center = this.calculatePolygonCenter(coords[0]);
                    [lng, lat] = center;
                    console.log('📍 검색된 Polygon 중심점:', { lng, lat });
                } else if (foundParcel.data.geometry.type === 'MultiPolygon') {
                    const center = this.calculatePolygonCenter(coords[0][0]);
                    [lng, lat] = center;
                    console.log('📍 검색된 MultiPolygon 중심점:', { lng, lat });
                }
            } else {
                console.warn('⚠️ clickParcels/searchParcels에서 필지를 찾을 수 없음');
                
                // 🆘 최후의 수단: VWorld API로 좌표 요청
                if (parcelData.parcelNumber) {
                    console.log('🆘 VWorld API로 좌표 검색 시도:', parcelData.parcelNumber);
                    try {
                        // 비동기로 좌표를 가져와서 나중에 마커 생성
                        this.fetchCoordinatesFromVWorld(parcelData).then(coords => {
                            if (coords.lat && coords.lng) {
                                console.log('🎯 VWorld API에서 좌표 획득:', coords);
                                lat = coords.lat;
                                lng = coords.lng;
                                // 좌표를 얻었으면 마커 생성 재시도
                                setTimeout(() => this.createMemoMarker({...parcelData, lat, lng}), 100);
                            }
                        });
                    } catch (error) {
                        console.error('❌ VWorld API 좌표 요청 실패:', error);
                    }
                }
            }
        }

        console.log('🎯 최종 좌표 결과:', { lat, lng });
        return { lat, lng };
    }

    // 폴리곤 중심점 계산
    calculatePolygonCenter(coordinates) {
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

    // VWorld API에서 좌표 가져오기 (최후의 수단)
    async fetchCoordinatesFromVWorld(parcelData) {
        try {
            // 지번 정보 추출
            const parcelNumber = parcelData.parcelNumber || parcelData.parcel_name;
            if (!parcelNumber) {
                console.warn('⚠️ 필지번호가 없어서 VWorld API 요청 불가');
                return { lat: null, lng: null };
            }
            
            console.log('🌐 VWorld API 좌표 요청:', parcelNumber);
            
            // Geocoding API를 통한 주소 검색 (대략적인 위치)
            // 이는 완전한 해결책은 아니지만 임시 방편으로 사용
            if (window.naver && window.naver.maps && window.naver.maps.Service) {
                return new Promise((resolve) => {
                    window.naver.maps.Service.geocode({
                        query: parcelNumber
                    }, (status, response) => {
                        if (status === window.naver.maps.Service.Status.OK && response.v2.addresses.length > 0) {
                            const result = response.v2.addresses[0];
                            const lat = parseFloat(result.y);
                            const lng = parseFloat(result.x);
                            console.log('✅ Naver Geocoding에서 좌표 획득:', { lat, lng });
                            resolve({ lat, lng });
                        } else {
                            console.warn('⚠️ Naver Geocoding 실패');
                            resolve({ lat: null, lng: null });
                        }
                    });
                });
            }
            
            return { lat: null, lng: null };
        } catch (error) {
            console.error('❌ VWorld API 좌표 요청 오류:', error);
            return { lat: null, lng: null };
        }
    }

    // clickParcels/searchParcels에서 필지 찾기
    findParcelInMaps(pnu) {
        if (window.clickParcels && window.clickParcels.has(pnu)) {
            return window.clickParcels.get(pnu);
        }
        if (window.searchParcels && window.searchParcels.has(pnu)) {
            return window.searchParcels.get(pnu);
        }
        return null;
    }

    // 메모 마커 클릭 이벤트
    onMarkerClick(parcelData) {
        // 폼에 데이터 로드
        document.getElementById('parcelNumber').value = parcelData.parcelNumber || '';
        document.getElementById('ownerName').value = parcelData.ownerName || '';
        document.getElementById('ownerAddress').value = parcelData.ownerAddress || '';
        document.getElementById('ownerContact').value = parcelData.ownerContact || '';
        document.getElementById('memo').value = parcelData.memo || '';

        // PNU 설정
        window.currentSelectedPNU = parcelData.pnu || parcelData.id;

        console.log('📍 메모 마커 클릭:', parcelData.parcelNumber);

        // 선택적: 해당 필지로 지도 이동
        const { lat, lng } = this.getParcelCoordinates(parcelData);
        if (lat && lng) {
            window.map.setCenter(new naver.maps.LatLng(lat, lng));
            window.map.setZoom(18);
        }
    }

    // 메모 마커 업데이트
    async updateMemoMarker(pnu, parcelData) {
        const markerInfo = this.markers.get(pnu);
        if (!markerInfo) return;

        // shouldShowMarker 조건을 만족하지 않으면 마커 제거
        if (!this.shouldShowMarker(parcelData)) {
            this.removeMemoMarker(pnu);
            return;
        }

        // 마커 엘리먼트 업데이트
        const newElement = this.createMarkerElement(parcelData);
        markerInfo.marker.setIcon({
            content: newElement.outerHTML,
            anchor: new naver.maps.Point(12, 12)
        });

        markerInfo.data = parcelData;
        markerInfo.element = newElement;

        // 🌟 Supabase에 업데이트된 마커 데이터 저장
        if (window.SupabaseManager && window.SupabaseManager.isConnected) {
            try {
                const markerData = {
                    type: 'memo',
                    position: { lat: parcelData.lat, lng: parcelData.lng },
                    memo: parcelData.memo,
                    parcelNumber: parcelData.parcelNumber,
                    element: newElement.outerHTML
                };
                await window.SupabaseManager.saveParcelMarker(pnu, markerData);
                console.log('✅ 메모 마커 Supabase 업데이트 완료:', pnu);
            } catch (error) {
                console.error('❌ 메모 마커 Supabase 업데이트 실패:', error);
            }
        }

        console.log(`🔄 메모 마커 업데이트: ${parcelData.parcelNumber}`);
    }

    // 메모 마커 제거
    removeMemoMarker(pnu) {
        const markerInfo = this.markers.get(pnu);
        if (markerInfo) {
            markerInfo.marker.setMap(null);
            this.markers.delete(pnu);

            // 🌟 Supabase에서 마커 데이터 제거 (marker_data 필드를 null로 설정)
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                try {
                    window.SupabaseManager.saveParcelMarker(pnu, null)
                        .then(() => {
                            console.log('✅ 메모 마커 Supabase 제거 완료:', pnu);
                        })
                        .catch(error => {
                            console.error('❌ 메모 마커 Supabase 제거 실패:', error);
                        });
                } catch (error) {
                    console.error('❌ 메모 마커 Supabase 제거 실패:', error);
                }
            }

            console.log(`🗑️ 메모 마커 제거: ${pnu}`);
        }
    }

    // 새 필지 메모 추가 시 호출
    async onParcelMemoAdded(parcelData) {
        // shouldShowMarker 조건 사용 (PNU, 지번, 메모, 소유자명 등 중 하나라도 있으면)
        if (this.shouldShowMarker(parcelData)) {
            const pnu = parcelData.pnu || parcelData.id;
            // 이미 마커가 있으면 업데이트, 없으면 새로 생성
            if (this.markers.has(pnu)) {
                console.log('🔄 기존 마커 업데이트:', pnu);
                await this.updateMemoMarker(pnu, parcelData);
            } else {
                console.log('📍 새 마커 생성:', pnu);
                await this.createMemoMarker(parcelData);
            }
        }
    }

    // 필지 메모 수정 시 호출
    async onParcelMemoUpdated(parcelData) {
        const pnu = parcelData.pnu || parcelData.id;
        await this.updateMemoMarker(pnu, parcelData);
    }

    // 필지 삭제 시 호출
    onParcelDeleted(pnu) {
        this.removeMemoMarker(pnu);
    }

    // 모든 마커 새로고침
    async refreshAllMarkers() {
        // 기존 마커 모두 제거
        this.markers.forEach((markerInfo, pnu) => {
            markerInfo.marker.setMap(null);
        });
        this.markers.clear();

        // 다시 로드
        await this.loadAllMemoMarkers();
        console.log('🔄 모든 메모 마커 새로고침 완료');
    }

    // 마커 표시/숨기기
    showAllMarkers() {
        this.markers.forEach(markerInfo => {
            markerInfo.marker.setMap(window.map);
        });
        console.log('👁️ 모든 메모 마커 표시');
    }

    hideAllMarkers() {
        this.markers.forEach(markerInfo => {
            markerInfo.marker.setMap(null);
        });
        console.log('👁️‍🗨️ 모든 메모 마커 숨김');
    }

    // createOrUpdateMarker 별칭 추가 (호환성을 위해)
    async createOrUpdateMarker(parcelData) {
        return await this.createMemoMarker(parcelData);
    }

    // 상태 정보 반환
    getStatus() {
        return {
            initialized: this.isInitialized,
            markerCount: this.markers.size,
            markers: Array.from(this.markers.keys())
        };
    }
}

// 전역 인스턴스 생성
window.MemoMarkerManager = new MemoMarkerManager();

// saveParcelData 함수 후킹 (메모 저장 시 마커 업데이트)
const originalSaveParcelData = window.saveParcelData;
if (originalSaveParcelData) {
    window.saveParcelData = async function() {
        const result = await originalSaveParcelData.apply(this, arguments);

        // 🔥 ULTRATHINK 수정: refreshAllMarkers 대신 직접 마커 생성/업데이트
        if (window.MemoMarkerManager && window.MemoMarkerManager.isInitialized) {
            // 현재 저장된 필지 정보 직접 가져오기
            const parcelNumber = document.getElementById('parcelNumber').value;
            const memo = document.getElementById('memo').value;
            const ownerName = document.getElementById('ownerName').value;
            const ownerAddress = document.getElementById('ownerAddress').value;
            const ownerContact = document.getElementById('ownerContact').value;
            const currentPNU = window.currentSelectedPNU;

            // 현재 선택된 필지의 좌표 가져오기
            let lat = null, lng = null;
            if (window.selectedParcel) {
                lat = window.selectedParcel.lat;
                lng = window.selectedParcel.lng;
            } else if (window.parcelsData) {
                // parcelsData에서 찾기
                const found = window.parcelsData.find(p => p.pnu === currentPNU || p.id === currentPNU);
                if (found) {
                    lat = found.lat;
                    lng = found.lng;
                }
            }

            const parcelData = {
                pnu: currentPNU,
                id: currentPNU,
                parcelNumber: parcelNumber,
                memo: memo,
                ownerName: ownerName,
                ownerAddress: ownerAddress,
                ownerContact: ownerContact,
                lat: lat,
                lng: lng
            };

            console.log('💾 저장 후 마커 업데이트:', {
                currentPNU: currentPNU,
                parcelNumber: parcelNumber,
                shouldShowMarker: window.MemoMarkerManager.shouldShowMarker(parcelData)
            });

            if (currentPNU) {
                if (window.MemoMarkerManager.shouldShowMarker(parcelData)) {
                    // 정보가 있는 경우 - 마커 생성/업데이트 (확장된 조건)
                    console.log('📍 마커 즉시 생성 (확장된 조건):', parcelData);
                    await window.MemoMarkerManager.onParcelMemoAdded(parcelData);
                } else {
                    // 정보가 없는 경우 - 마커 제거
                    console.log('🗑️ 마커 제거:', currentPNU);
                    window.MemoMarkerManager.removeMemoMarker(currentPNU);
                }
            }
        }

        return result;
    };
}

// 페이지 로드 시 자동 초기화 (AppInitializer가 없는 경우에만)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.MemoMarkerManager && !window.MemoMarkerManager.isInitialized) {
            // AppInitializer가 없거나 초기화되지 않은 경우에만 직접 초기화
            if (!window.appInitializer || !window.appInitializer.isInitialized) {
                console.log('🔄 AppInitializer 없음, 메모 마커 직접 초기화');
                window.MemoMarkerManager.initialize();
            }
        }
    }, 4000); // AppInitializer 보다 늦게 실행하여 중복 방지
});

console.log('📍 MemoMarkerManager 로드 완료');