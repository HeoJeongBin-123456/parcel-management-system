// 메모 마커 관리자 - 정보가 있는 필지에 M 표시 (확장된 조건)
class MemoMarkerManager {
    constructor() {
        this.markers = new Map(); // PNU -> marker 매핑
        this.isInitialized = false;
        console.log('📍 MemoMarkerManager 초기화');
    }

    // 마커 표시 조건 확인 (실제 정보가 있을 때만)
    shouldShowMarker(parcelData) {
        // isDeleted 플래그가 있으면 마커 표시 안 함
        if (parcelData.isDeleted === true) {
            return false;
        }

        // 🔥 데이터 스키마 호환성 개선: 다양한 키 이름 지원
        const memo = parcelData.memo || parcelData.parcelMemo || '';
        const parcelNumber = parcelData.parcelNumber || parcelData.parcel_number || parcelData.parcel_name || '';
        const ownerName = parcelData.ownerName || parcelData.owner_name || parcelData.owner || '';
        const ownerAddress = parcelData.ownerAddress || parcelData.owner_address || '';
        const ownerContact = parcelData.ownerContact || parcelData.owner_contact || parcelData.contact || '';

        const hasUserSuppliedInfo = !!(
            (memo && memo.trim() &&
             memo.trim() !== '(메모 없음)' &&
             memo.trim() !== '추가 메모...' &&
             memo.trim() !== '') ||
            (ownerName && ownerName.trim() &&
             ownerName.trim() !== '홍길동' &&
             ownerName.trim() !== '') ||
            (ownerAddress && ownerAddress.trim() &&
             ownerAddress.trim() !== '서울시 강남구...' &&
             ownerAddress.trim() !== '') ||
            (ownerContact && ownerContact.trim() &&
             ownerContact.trim() !== '010-1234-5678' &&
             ownerContact.trim() !== '')
        );

        // 지번만 있는 경우에는 사용자 입력이 없다고 간주
        const hasMeaningfulInfo = hasUserSuppliedInfo;

        // 검색 필지 여부는 로깅용으로만 사용 (조건 동일)
        const isSearchParcel = parcelData.pnu && window.searchParcels && window.searchParcels.has(parcelData.pnu);

        console.log(isSearchParcel ? '🔍 검색 필지 마커 조건 확인:' : '📍 일반 필지 마커 조건 확인:', {
            pnu: parcelData.pnu,
            parcelName: parcelData.parcelName || parcelData.parcel_name,
            parcelNumber: parcelNumber.trim() || '(없음)',
            hasRealInfo: hasMeaningfulInfo,
            memo: memo.trim() || '(없음)',
            ownerName: ownerName.trim() || '(없음)',
            ownerAddress: ownerAddress.trim() || '(없음)',
            ownerContact: ownerContact.trim() || '(없음)'
        });

        // 실제 정보가 있을 때만 마커 표시
        return hasMeaningfulInfo;
    }

    // 초기화 (지도 없이도 가능)
    async initialize() {
        if (this.isInitialized) {
            console.log('📍 MemoMarkerManager 이미 초기화됨');
            return;
        }

        // 초기화 상태 설정 (재진입 방지)
        this.isInitialized = true;
        console.log('✅ MemoMarkerManager 초기화 완료 (지도 대기 중)');

        // 지도가 이미 있으면 마커 로드
        if (window.map) {
            // 중복 마커 정리
            this.cleanupDuplicateMarkers();
            await this.loadAllMemoMarkers();
            console.log('📍 지도 있음: 마커 로드 완료');
        } else {
            // 지도 로드 감지를 위한 인터벌 설정
            console.log('🗺️ 지도 로딩 대기 중...');
            let checkCount = 0;
            const mapCheckInterval = setInterval(async () => {
                checkCount++;
                if (window.map) {
                    clearInterval(mapCheckInterval);
                    console.log('🗺️ 지도 로드 감지! 마커 로드 시작...');
                    this.cleanupDuplicateMarkers();
                    await this.loadAllMemoMarkers();
                } else if (checkCount > 40) {
                    // 20초 후에도 지도가 없으면 중단
                    clearInterval(mapCheckInterval);
                    console.warn('⚠️ 지도 로딩 타임아웃 (20초)');
                }
            }, 500);
        }
    }

    // 중복 마커 정리 (개선된 버전)
    cleanupDuplicateMarkers() {
        const pnuMap = new Map();
        const positionMap = new Map(); // 위치별 마커 그룹화 추가

        // PNU별로 마커 그룹화
        for (const [key, markerInfo] of this.markers.entries()) {
            const pnu = markerInfo.data?.pnu || key;
            const position = `${markerInfo.data?.lat}_${markerInfo.data?.lng}`;

            // PNU별 그룹화
            if (!pnuMap.has(pnu)) {
                pnuMap.set(pnu, []);
            }
            pnuMap.get(pnu).push({ key, markerInfo, position });

            // 위치별 그룹화 (같은 위치의 다른 PNU 마커도 체크)
            if (!positionMap.has(position)) {
                positionMap.set(position, []);
            }
            positionMap.get(position).push({ key, markerInfo, pnu });
        }

        let removedCount = 0;

        // 1. PNU 기준 중복 제거
        for (const [pnu, markers] of pnuMap.entries()) {
            if (markers.length > 1) {
                console.log(`🗑️ PNU ${pnu}에 중복 마커 ${markers.length}개 발견, 정리 시작`);

                // 가장 최신 데이터를 가진 마커를 유지하고 나머지 제거
                markers.sort((a, b) => {
                    const aTime = new Date(a.markerInfo.data?.timestamp || 0).getTime();
                    const bTime = new Date(b.markerInfo.data?.timestamp || 0).getTime();
                    return bTime - aTime; // 최신 순
                });

                for (let i = 1; i < markers.length; i++) {
                    const { key, markerInfo } = markers[i];
                    if (markerInfo.marker) {
                        markerInfo.marker.setMap(null);
                        removedCount++;
                    }
                    this.markers.delete(key);
                    console.log(`  ✅ PNU 중복 마커 제거: ${key}`);
                }
            }
        }

        // 2. 같은 위치의 서로 다른 PNU 마커들도 체크 (너무 가까운 마커들)
        for (const [position, markers] of positionMap.entries()) {
            if (markers.length > 1 && position !== 'undefined_undefined') {
                const uniquePNUs = new Set(markers.map(m => m.pnu));
                if (uniquePNUs.size > 1) {
                    console.log(`📍 동일 위치 ${position}에 서로 다른 PNU 마커 ${markers.length}개 발견:`);
                    markers.forEach(m => console.log(`  - PNU: ${m.pnu}, Key: ${m.key}`));

                    // 이 경우는 로그만 남기고 자동 제거하지 않음 (사용자가 의도적으로 같은 위치에 다른 필지를 표시했을 수 있음)
                    console.log(`⚠️ 사용자 확인 필요: 같은 위치의 서로 다른 PNU 마커들`);
                }
            }
        }

        console.log(`🧹 중복 마커 정리 완료: ${removedCount}개 제거`);
        return removedCount;
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

                                // deletedParcels 목록 가져오기
                                const deletedParcels = window.getDeletedParcels ? window.getDeletedParcels() : [];

                                // 이 키에서 정보가 있는 필지들 찾기 (확장된 조건 + 삭제된 필지 제외)
                                const withMemo = parsed.filter(parcel => {
                                    // 삭제된 필지 체크
                                    const pnu = parcel.pnu || parcel.properties?.PNU || parcel.properties?.pnu || parcel.id;
                                    if (pnu && deletedParcels.includes(pnu)) {
                                        return false; // 삭제된 필지는 마커 생성 안 함
                                    }
                                    return this.shouldShowMarker(parcel);
                                });

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
        console.log('🔍 [DEBUG] createMemoMarker 호출됨:', {
            pnu: parcelData.pnu,
            lat: parcelData.lat,
            lng: parcelData.lng,
            memo: parcelData.memo,
            ownerName: parcelData.ownerName
        });

        try {
            // isDeleted 플래그 체크
            if (parcelData.isDeleted === true) {
                console.log(`⏩ isDeleted 플래그가 있는 필지 마커 생성 건너뛰기: ${parcelData.pnu || parcelData.id}`);
                return;
            }

            // 삭제된 필지 체크
            const deletedParcels = window.getDeletedParcels ? window.getDeletedParcels() : [];
            const deletedSet = new Set(deletedParcels.map(id => String(id).trim()));

            const identifiers = [
                parcelData.pnu,
                parcelData.id,
                parcelData.pnu_code,
                parcelData.parcelNumber,
                parcelData.parcel_name
            ].filter(Boolean).map(id => String(id).trim());

            if (identifiers.some(id => deletedSet.has(id))) {
                console.log(`⏩ 삭제된 필지 마커 생성 건너뛰기: ${parcelData.pnu || parcelData.id}`);
                return;
            }

            // 🛡️ 마커 생성 조건 확인 (가장 중요한 체크)
            const shouldShow = this.shouldShowMarker(parcelData);
            console.log('🔍 [DEBUG] shouldShowMarker 결과:', shouldShow);

            if (!shouldShow) {
                console.log('🚫 마커 생성 조건 미충족:', {
                    parcelName: parcelData.parcelName || parcelData.parcel_name,
                    parcelNumber: parcelData.parcelNumber?.trim() || '(없음)',
                    memo: parcelData.memo?.trim() || '(없음)',
                    ownerName: parcelData.ownerName?.trim() || '(없음)',
                    ownerAddress: parcelData.ownerAddress?.trim() || '(없음)',
                    ownerContact: parcelData.ownerContact?.trim() || '(없음)'
                });
                return;
            }

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

            // 🌟 Supabase에 마커 데이터 저장 - 잘못된 콜럼으로 인한 에러 방지를 위해 주석 처리
            // Supabase 테이블 스키마가 업데이트되면 다시 활성화
            /*
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
            */

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

        // 🔥 데이터 스키마 호환성: 다양한 키 이름 지원
        const memo = parcelData.memo || parcelData.parcelMemo || '';
        const parcelNumber = parcelData.parcelNumber || parcelData.parcel_number || parcelData.parcel_name || '';

        // 지번만 있는 경우와 메모가 있는 경우 구분해서 title 설정
        if (memo && memo.trim() && memo.trim() !== '(메모 없음)') {
            element.title = `메모: ${memo.substring(0, 50)}${memo.length > 50 ? '...' : ''}`;
        } else if (parcelNumber && parcelNumber.trim()) {
            element.title = `지번: ${parcelNumber}`;
        } else {
            element.title = '필지 정보';
        }

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

        const baseGeometry = parcelData.geometry || parcelData.data?.geometry;
        window.selectedParcel = {
            ...parcelData,
            pnu: window.currentSelectedPNU,
            id: window.currentSelectedPNU,
            geometry: baseGeometry,
            color: parcelData.color || (window.currentMode === 'search' ? '#9370DB' : parcelData.color)
        };
        window.currentSelectedParcel = window.selectedParcel;

        console.log('📍 메모 마커 클릭:', parcelData.parcelNumber);

        // 해당 필지로 지도 이동 (줌 레벨은 변경하지 않음)
        const { lat, lng } = this.getParcelCoordinates(parcelData);
        if (lat && lng) {
            // 현재 줌 레벨 유지하며 중심점만 이동
            window.map.setCenter(new naver.maps.LatLng(lat, lng));
            // setZoom을 제거하여 현재 줌 레벨 유지
            console.log('📍 마커 위치로 이동 (줌 유지)');
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

        // 🌟 Supabase에 업데이트된 마커 데이터 저장 - 주석 처리
        /*
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
        */

        console.log(`🔄 메모 마커 업데이트: ${parcelData.parcelNumber}`);
    }

    // 메모 마커 제거
    removeMemoMarker(pnu) {
        const markerInfo = this.markers.get(pnu);
        if (markerInfo) {
            markerInfo.marker.setMap(null);
            this.markers.delete(pnu);

            // 🌟 Supabase에서 마커 데이터 제거 - 주석 처리
            /*
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
            */

            console.log(`🗑️ 메모 마커 제거: ${pnu}`);
        }
    }

    // 새 필지 메모 추가 시 호출
    async onParcelMemoAdded(parcelData) {
        // 삭제된 필지 체크
        const deletedParcels = window.getDeletedParcels ? window.getDeletedParcels() : [];
        const deletedSet = new Set(deletedParcels.map(id => String(id).trim()));

        const identifiers = [
            parcelData.pnu,
            parcelData.id,
            parcelData.pnu_code,
            parcelData.parcelNumber,
            parcelData.parcel_name
        ].filter(Boolean).map(id => String(id).trim());

        if (identifiers.some(id => deletedSet.has(id))) {
            console.log(`⏩ 삭제된 필지 마커 업데이트 건너뛰기: ${parcelData.pnu || parcelData.id}`);
            return;
        }

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
        // 거리뷰 모드에서는 마커를 숨김
        if (window.isStreetViewMode) {
            console.log('🚶 거리뷰 모드에서는 마커가 숨겨집니다');
            return;
        }

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

    // 거리뷰 모드 변경 시 호출
    onStreetViewModeChange(isStreetViewMode) {
        if (isStreetViewMode) {
            console.log('🚶 거리뷰 모드 진입 - 모든 마커 숨김');
            this.hideAllMarkers();
        } else {
            console.log('🗺️ 지도 모드 진입 - 마커 표시');
            this.showAllMarkers();
        }
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

    // 🔧 디버깅 및 정리 도구
    // 모든 마커 상태 출력
    debugMarkerStatus() {
        console.log('🔍 === 마커 상태 디버깅 ===');
        console.log(`총 마커 개수: ${this.markers.size}`);

        const markersByPNU = new Map();
        let duplicateCount = 0;

        // 마커 정보 수집
        for (const [key, markerInfo] of this.markers.entries()) {
            const pnu = markerInfo.data?.pnu || key;
            if (!markersByPNU.has(pnu)) {
                markersByPNU.set(pnu, []);
            }
            markersByPNU.get(pnu).push({ key, markerInfo });

            console.log(`📍 마커 ${key}:`, {
                pnu: pnu,
                parcelNumber: markerInfo.data?.parcelNumber,
                hasMarker: !!markerInfo.marker,
                onMap: markerInfo.marker?.getMap() === window.map,
                lat: markerInfo.data?.lat,
                lng: markerInfo.data?.lng,
                memo: markerInfo.data?.memo?.substring(0, 30) || '(없음)'
            });
        }

        // 중복 체크
        for (const [pnu, markers] of markersByPNU.entries()) {
            if (markers.length > 1) {
                duplicateCount += markers.length - 1;
                console.warn(`⚠️ PNU ${pnu}에 ${markers.length}개 중복 마커:`);
                markers.forEach((item, idx) => {
                    console.log(`  ${idx + 1}. ${item.key}`);
                });
            }
        }

        console.log(`🔄 중복 마커 총 ${duplicateCount}개 발견`);
        return { totalMarkers: this.markers.size, duplicates: duplicateCount, markersByPNU };
    }

    // 모든 마커 강제 제거 (디버깅용)
    forceRemoveAllMarkers() {
        console.log('🧹 모든 마커 강제 제거 시작...');
        let removedCount = 0;

        // 현재 등록된 마커들 제거
        for (const [key, markerInfo] of this.markers.entries()) {
            if (markerInfo.marker) {
                try {
                    markerInfo.marker.setMap(null);
                    removedCount++;
                    console.log(`✅ 마커 제거: ${key}`);
                } catch (error) {
                    console.error(`❌ 마커 제거 실패: ${key}`, error);
                }
            }
        }

        // Map 초기화
        this.markers.clear();

        // DOM에서 남은 마커 엘리먼트들도 제거 시도
        const markerElements = document.querySelectorAll('.memo-marker');
        markerElements.forEach(element => {
            try {
                element.remove();
            } catch (error) {
                console.warn('마커 엘리먼트 제거 중 오류:', error);
            }
        });

        console.log(`🧹 총 ${removedCount}개 마커 강제 제거 완료`);
        console.log(`📊 DOM 마커 엘리먼트 ${markerElements.length}개 제거 완료`);

        return { removedMarkers: removedCount, removedElements: markerElements.length };
    }

    // 전체 마커 시스템 재초기화
    async forceReinitialize() {
        console.log('🔄 마커 시스템 완전 재초기화...');

        // 1. 모든 마커 제거
        this.forceRemoveAllMarkers();

        // 2. 초기화 상태 리셋
        this.isInitialized = false;

        // 3. 잠시 대기 후 재초기화
        setTimeout(async () => {
            await this.initialize();
            console.log('✅ 마커 시스템 재초기화 완료');
        }, 1000);

        return true;
    }
}

// 전역 인스턴스 생성
window.MemoMarkerManager = new MemoMarkerManager();

// 중복 호출 방지를 위한 디바운싱
let saveClickParcelDataInProgress = false;
let markerUpdateTimeout = null;

// 함수 후킹을 나중에 수행하도록 지연
function hookSaveFunctions() {
    console.log('🔧 저장 함수 후킹 시작...');

    // saveClickParcelData 함수 후킹 (클릭 모드 필지 저장 시 마커 업데이트)
    const originalSaveClickParcelData = window.saveClickParcelData;
    if (originalSaveClickParcelData) {
        console.log('✅ saveClickParcelData 후킹 성공');
        window.saveClickParcelData = async function() {
        // 이미 실행 중이면 바로 리턴
        if (saveClickParcelDataInProgress) {
            console.log('⚠️ saveClickParcelData 이미 실행 중 - 건너뜀기');
            return;
        }

        saveClickParcelDataInProgress = true;
        let result;

        try {
            result = await originalSaveClickParcelData.apply(this, arguments);
        } finally {
            saveClickParcelDataInProgress = false;
        }

        // 마커 업데이트를 디바운싱하여 처리
        if (markerUpdateTimeout) {
            clearTimeout(markerUpdateTimeout);
        }

        markerUpdateTimeout = setTimeout(async () => {
            if (window.MemoMarkerManager && window.MemoMarkerManager.isInitialized && window.selectedParcel) {
                const parcelData = window.selectedParcel;
                console.log('💾 [클릭 모드] 저장 후 마커 업데이트:', {
                    pnu: parcelData.pnu,
                    shouldShowMarker: window.MemoMarkerManager.shouldShowMarker(parcelData)
                });

                if (parcelData.pnu) {
                    if (window.MemoMarkerManager.shouldShowMarker(parcelData)) {
                        // 정보가 있는 경우 - 마커 생성/업데이트
                        console.log('📍 [클릭 모드] 마커 생성:', parcelData);
                        await window.MemoMarkerManager.onParcelMemoAdded(parcelData);
                    } else {
                        // 정보가 없는 경우 - 마커 제거
                        console.log('🗑️ [클릭 모드] 마커 제거:', parcelData.pnu);
                        window.MemoMarkerManager.removeMemoMarker(parcelData.pnu);
                    }
                }
            }
        }, 500); // 500ms 후 마커 업데이트

        return result;
        };
    } else {
        console.warn('⚠️ saveClickParcelData 함수가 아직 정의되지 않음');
    }

    // saveParcelData 함수 후킹 (검색 모드 필지 저장 시 마커 업데이트)
    const originalSaveParcelData = window.saveParcelData;
    if (originalSaveParcelData) {
        console.log('✅ saveParcelData 후킹 성공');
        window.saveParcelData = async function() {
        const result = await originalSaveParcelData.apply(this, arguments);

        // 검색 모드일 때만 처리
        if (window.currentMode === 'search' && window.MemoMarkerManager && window.MemoMarkerManager.isInitialized) {
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

            console.log('💾 [검색 모드] 저장 후 마커 업데이트:', {
                currentPNU: currentPNU,
                parcelNumber: parcelNumber,
                shouldShowMarker: window.MemoMarkerManager.shouldShowMarker(parcelData)
            });

            if (currentPNU) {
                if (window.MemoMarkerManager.shouldShowMarker(parcelData)) {
                    // 정보가 있는 경우 - 마커 생성/업데이트
                    console.log('📍 [검색 모드] 마커 생성:', parcelData);
                    await window.MemoMarkerManager.onParcelMemoAdded(parcelData);
                } else {
                    // 정보가 없는 경우 - 마커 제거
                    console.log('🗑️ [검색 모드] 마커 제거:', currentPNU);
                    window.MemoMarkerManager.removeMemoMarker(currentPNU);
                }
            }
        }

        return result;
        };
    } else {
        console.warn('⚠️ saveParcelData 함수가 아직 정의되지 않음');
    }
}

// 함수 후킹을 지연 실행
setTimeout(() => {
    hookSaveFunctions();

    // 후킹이 실패한 경우 재시도
    if (!window.saveParcelData || !window.saveClickParcelData) {
        console.log('🔄 저장 함수 후킹 재시도...');
        setTimeout(hookSaveFunctions, 2000);
    }
}, 1000);

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

        // 저장 함수 후킹 재시도
        if (!window.saveParcelData || !window.saveClickParcelData) {
            console.log('🔄 DOMContentLoaded에서 저장 함수 후킹 재시도');
            hookSaveFunctions();
        }
    }, 4000); // AppInitializer 보다 늦게 실행하여 중복 방지
});

// 디버깅 함수들을 전역에 추가
window.debugMarkerIssue = function() {
    console.log('🔍 마커 디버깅 시작...');

    // 1. MemoMarkerManager 상태 확인
    if (!window.MemoMarkerManager) {
        console.error('❌ MemoMarkerManager가 없습니다!');
        return;
    }

    console.log('✅ MemoMarkerManager 상태:', window.MemoMarkerManager.getStatus());

    // 2. localStorage 데이터 확인
    const localData = JSON.parse(localStorage.getItem('parcelData') || '[]');
    console.log('📁 localStorage 필지 데이터:', localData.length, '개');

    // 3. 각 필지별 마커 생성 조건 확인
    localData.forEach((parcel, index) => {
        const shouldShow = window.MemoMarkerManager.shouldShowMarker(parcel);
        console.log(`📍 필지 ${index + 1}:`, {
            parcelNumber: parcel.parcelNumber,
            pnu: parcel.pnu,
            shouldShowMarker: shouldShow,
            memo: parcel.memo?.substring(0, 30) || '(없음)',
            ownerName: parcel.ownerName || '(없음)',
            hasLat: !!parcel.lat,
            hasLng: !!parcel.lng
        });
    });

    // 4. 강제 마커 새로고침
    console.log('🔄 마커 강제 새로고침 시작...');
    window.MemoMarkerManager.refreshAllMarkers();
};

window.forceCreateMarkerForCurrentParcel = function() {
    console.log('🔧 현재 필지 강제 마커 생성...');

    const parcelNumber = document.getElementById('parcelNumber').value;
    const memo = document.getElementById('memo').value;
    const ownerName = document.getElementById('ownerName').value;
    const ownerAddress = document.getElementById('ownerAddress').value;
    const ownerContact = document.getElementById('ownerContact').value;
    const currentPNU = window.currentSelectedPNU;

    if (!currentPNU) {
        console.error('❌ 선택된 필지(PNU)가 없습니다!');
        return;
    }

    // 좌표 찾기
    let lat = null, lng = null;
    if (window.selectedParcel) {
        lat = window.selectedParcel.lat;
        lng = window.selectedParcel.lng;
    }

    const testParcelData = {
        pnu: currentPNU,
        parcelNumber: parcelNumber,
        memo: memo,
        ownerName: ownerName,
        ownerAddress: ownerAddress,
        ownerContact: ownerContact,
        lat: lat,
        lng: lng
    };

    console.log('🎯 테스트 데이터:', testParcelData);
    console.log('🔍 shouldShowMarker 결과:', window.MemoMarkerManager.shouldShowMarker(testParcelData));

    // 강제 마커 생성
    window.MemoMarkerManager.createMemoMarker(testParcelData);
};

console.log('📍 MemoMarkerManager 로드 완료');
console.log('🔧 디버깅 함수: debugMarkerIssue(), forceCreateMarkerForCurrentParcel()');
