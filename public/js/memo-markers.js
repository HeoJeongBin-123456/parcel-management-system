// 메모 마커 관리자 - 메모가 있는 필지에 M 표시
class MemoMarkerManager {
    constructor() {
        this.markers = new Map(); // PNU -> marker 매핑
        this.isInitialized = false;
        console.log('📍 MemoMarkerManager 초기화');
    }

    // 초기화 (지도 로드 후 호출)
    async initialize() {
        if (this.isInitialized) return;
        
        // 지도 로드 대기
        if (!window.map) {
            setTimeout(() => this.initialize(), 500);
            return;
        }

        await this.loadAllMemoMarkers();
        this.isInitialized = true;
        console.log('✅ MemoMarkerManager 초기화 완료');
    }

    // 모든 메모 마커 로드
    async loadAllMemoMarkers() {
        try {
            // localStorage에서 직접 데이터 로드 (Supabase 문제 회피)
            let savedData = [];
            
            // 1. localStorage 직접 접근
            const localStorageData = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (localStorageData) {
                savedData = JSON.parse(localStorageData);
                console.log(`🔍 localStorage에서 ${savedData.length}개 필지 로드`);
            }
            
            // 2. migratedGetItem도 시도해보지만 실패해도 계속 진행
            try {
                const migratedData = await window.migratedGetItem(CONFIG.STORAGE_KEY);
                if (migratedData) {
                    const parsed = JSON.parse(migratedData);
                    if (parsed.length > savedData.length) {
                        savedData = parsed;
                        console.log(`📡 migratedGetItem에서 더 많은 데이터: ${parsed.length}개`);
                    }
                }
            } catch (supabaseError) {
                console.warn('⚠️ Supabase 연결 실패, localStorage 데이터 사용:', supabaseError.message);
            }

            const parcelsWithMemo = savedData.filter(parcel => 
                parcel.memo && parcel.memo.trim() !== ''
            );

            console.log(`📝 메모가 있는 필지: ${parcelsWithMemo.length}개`);

            for (const parcel of parcelsWithMemo) {
                await this.createMemoMarker(parcel);
            }
        } catch (error) {
            console.error('❌ 메모 마커 로드 실패:', error);
        }
    }

    // 메모 마커 생성
    async createMemoMarker(parcelData) {
        try {
            const pnu = parcelData.pnu || parcelData.id;
            
            // 이미 마커가 있으면 업데이트
            if (this.markers.has(pnu)) {
                await this.updateMemoMarker(pnu, parcelData);
                return;
            }

            // 좌표 계산
            const { lat, lng } = this.getParcelCoordinates(parcelData);
            if (!lat || !lng) {
                console.warn('❌ 필지 좌표 없음:', parcelData.parcelNumber);
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

        // 직접 좌표가 있는 경우
        if (parcelData.lat && parcelData.lng) {
            lat = parseFloat(parcelData.lat);
            lng = parseFloat(parcelData.lng);
        }
        // geometry에서 좌표 추출
        else if (parcelData.geometry && parcelData.geometry.coordinates) {
            const coords = parcelData.geometry.coordinates;
            if (parcelData.geometry.type === 'Point') {
                [lng, lat] = coords;
            } else if (parcelData.geometry.type === 'Polygon') {
                // 폴리곤 중심점 계산
                const center = this.calculatePolygonCenter(coords[0]);
                [lng, lat] = center;
            } else if (parcelData.geometry.type === 'MultiPolygon') {
                // MultiPolygon의 첫 번째 폴리곤의 중심점 계산
                const center = this.calculatePolygonCenter(coords[0][0]);
                [lng, lat] = center;
            }
        }
        // clickParcels/searchParcels에서 찾기
        else {
            const foundParcel = this.findParcelInMaps(parcelData.pnu || parcelData.id);
            if (foundParcel && foundParcel.data && foundParcel.data.geometry) {
                const coords = foundParcel.data.geometry.coordinates;
                if (foundParcel.data.geometry.type === 'Point') {
                    [lng, lat] = coords;
                } else if (foundParcel.data.geometry.type === 'Polygon') {
                    const center = this.calculatePolygonCenter(coords[0]);
                    [lng, lat] = center;
                } else if (foundParcel.data.geometry.type === 'MultiPolygon') {
                    const center = this.calculatePolygonCenter(coords[0][0]);
                    [lng, lat] = center;
                }
            }
        }

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

        // 메모가 없어졌으면 마커 제거
        if (!parcelData.memo || parcelData.memo.trim() === '') {
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

        console.log(`🔄 메모 마커 업데이트: ${parcelData.parcelNumber}`);
    }

    // 메모 마커 제거
    removeMemoMarker(pnu) {
        const markerInfo = this.markers.get(pnu);
        if (markerInfo) {
            markerInfo.marker.setMap(null);
            this.markers.delete(pnu);
            console.log(`🗑️ 메모 마커 제거: ${pnu}`);
        }
    }

    // 새 필지 메모 추가 시 호출
    async onParcelMemoAdded(parcelData) {
        if (parcelData.memo && parcelData.memo.trim() !== '') {
            await this.createMemoMarker(parcelData);
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
        
        // 메모 마커 새로고침
        if (window.MemoMarkerManager && window.MemoMarkerManager.isInitialized) {
            setTimeout(() => {
                window.MemoMarkerManager.refreshAllMarkers();
            }, 500);
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