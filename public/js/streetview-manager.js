// 거리뷰 관리자 - 클릭 가능한 선 표시 및 파노라마 연동
class StreetViewManager {
    constructor() {
        this.isActive = false;
        this.streetViewLines = []; // 거리뷰 가능한 선들
        this.panorama = null;
        this.clickListener = null;
        console.log('🛣️ StreetViewManager 초기화');
    }

    // 거리뷰 모드 활성화/비활성화
    toggleStreetViewMode() {
        if (this.isActive) {
            this.deactivateStreetView();
        } else {
            this.activateStreetView();
        }
    }

    // 거리뷰 모드 활성화
    activateStreetView() {
        this.isActive = true;
        
        // 거리뷰 버튼 상태 업데이트
        const streetBtn = document.querySelector('[data-type="street"]');
        if (streetBtn) {
            streetBtn.classList.add('active');
            streetBtn.textContent = '거리뷰 ON';
        }

        // 지도 클릭 리스너 추가
        this.addMapClickListener();
        
        // 현재 화면 영역의 거리뷰 선 표시
        this.loadStreetViewLines();
        
        console.log('🛣️ 거리뷰 모드 활성화');
    }

    // 거리뷰 모드 비활성화
    deactivateStreetView() {
        this.isActive = false;
        
        // 거리뷰 버튼 상태 업데이트
        const streetBtn = document.querySelector('[data-type="street"]');
        if (streetBtn) {
            streetBtn.classList.remove('active');
            streetBtn.textContent = '거리뷰';
        }

        // 클릭 리스너 제거
        this.removeMapClickListener();
        
        // 거리뷰 선 모두 제거
        this.clearStreetViewLines();
        
        // 파노라마 숨기기
        this.hidePanorama();
        
        console.log('🛣️ 거리뷰 모드 비활성화');
    }

    // 지도 클릭 리스너 추가
    addMapClickListener() {
        if (this.clickListener) return;
        
        this.clickListener = naver.maps.Event.addListener(window.map, 'click', (e) => {
            if (!this.isActive) return;
            
            const clickPosition = e.coord;
            this.openPanoramaAtPosition(clickPosition);
        });
    }

    // 지도 클릭 리스너 제거
    removeMapClickListener() {
        if (this.clickListener) {
            naver.maps.Event.removeListener(this.clickListener);
            this.clickListener = null;
        }
    }

    // 현재 화면 영역의 거리뷰 선 로드
    loadStreetViewLines() {
        const bounds = window.map.getBounds();
        
        // 간단한 거리뷰 선 생성 (실제로는 네이버에서 제공하는 거리뷰 가능 위치 데이터를 사용해야 함)
        this.generateSampleStreetViewLines(bounds);
    }

    // 샘플 거리뷰 선 생성 (실제 구현에서는 네이버 API 데이터 사용)
    generateSampleStreetViewLines(bounds) {
        const sw = bounds.getSW();
        const ne = bounds.getNE();
        
        // 격자 형태로 거리뷰 선 생성
        const latStep = (ne.lat() - sw.lat()) / 10;
        const lngStep = (ne.lng() - sw.lng()) / 10;
        
        for (let i = 1; i < 10; i++) {
            for (let j = 1; j < 10; j++) {
                const lat = sw.lat() + (latStep * i);
                const lng = sw.lng() + (lngStep * j);
                
                // 수평선
                if (j < 9) {
                    this.createStreetViewLine([
                        new naver.maps.LatLng(lat, lng),
                        new naver.maps.LatLng(lat, lng + lngStep)
                    ]);
                }
                
                // 수직선
                if (i < 9) {
                    this.createStreetViewLine([
                        new naver.maps.LatLng(lat, lng),
                        new naver.maps.LatLng(lat + latStep, lng)
                    ]);
                }
            }
        }
    }

    // 거리뷰 선 생성
    createStreetViewLine(path) {
        const line = new naver.maps.Polyline({
            map: window.map,
            path: path,
            strokeColor: '#4285F4',
            strokeWeight: 3,
            strokeOpacity: 0.8,
            strokeStyle: 'solid'
        });

        // 선 클릭 이벤트
        naver.maps.Event.addListener(line, 'click', (e) => {
            e.domEvent.stopPropagation();
            this.openPanoramaAtPosition(e.coord);
        });

        // 선 호버 효과
        naver.maps.Event.addListener(line, 'mouseover', () => {
            line.setOptions({
                strokeColor: '#FF6B35',
                strokeWeight: 4
            });
        });

        naver.maps.Event.addListener(line, 'mouseout', () => {
            line.setOptions({
                strokeColor: '#4285F4',
                strokeWeight: 3
            });
        });

        this.streetViewLines.push(line);
    }

    // 모든 거리뷰 선 제거
    clearStreetViewLines() {
        this.streetViewLines.forEach(line => {
            line.setMap(null);
        });
        this.streetViewLines = [];
    }

    // 특정 위치에서 파노라마 열기
    openPanoramaAtPosition(position) {
        try {
            // 파노라마 컨테이너 표시
            this.showPanorama();
            
            // 파노라마 초기화 (또는 위치 업데이트)
            if (!this.panorama) {
                this.panorama = new naver.maps.Panorama(document.getElementById('pano'), {
                    position: position,
                    pov: {
                        heading: 0,
                        pitch: 0
                    },
                    zoom: 1,
                    flightSpot: false,
                    logoControl: false,
                    logoControlOptions: {
                        position: naver.maps.Position.BOTTOM_RIGHT
                    }
                });

                // 파노라마 이벤트 리스너
                naver.maps.Event.addListener(this.panorama, 'pano_changed', () => {
                    console.log('🛣️ 파노라마 변경됨');
                });

                naver.maps.Event.addListener(this.panorama, 'pov_changed', () => {
                    console.log('🛣️ 시점 변경됨');
                });
            } else {
                // 기존 파노라마 위치 업데이트
                this.panorama.setPosition(position);
            }

            console.log('🛣️ 파노라마 열기:', position.toString());
            
        } catch (error) {
            console.error('❌ 파노라마 열기 실패:', error);
            alert('이 위치에서는 거리뷰를 사용할 수 없습니다.');
        }
    }

    // 파노라마 컨테이너 표시
    showPanorama() {
        const panoContainer = document.getElementById('pano');
        const mapContainer = document.getElementById('map');
        
        if (panoContainer && mapContainer) {
            // 지도와 파노라마를 나란히 표시
            mapContainer.style.width = '50%';
            panoContainer.style.display = 'block';
            panoContainer.style.width = '50%';
            panoContainer.style.height = '100%';
            panoContainer.style.position = 'absolute';
            panoContainer.style.right = '0';
            panoContainer.style.top = '0';
            panoContainer.style.border = '2px solid #4285F4';
            panoContainer.style.borderRadius = '8px';

            // 지도 크기 재조정
            setTimeout(() => {
                window.map.refresh();
            }, 100);
        }
    }

    // 파노라마 숨기기
    hidePanorama() {
        const panoContainer = document.getElementById('pano');
        const mapContainer = document.getElementById('map');
        
        if (panoContainer && mapContainer) {
            panoContainer.style.display = 'none';
            mapContainer.style.width = '100%';
            
            // 지도 크기 재조정
            setTimeout(() => {
                window.map.refresh();
            }, 100);
        }
    }

    // 파노라마 닫기 버튼 추가
    addPanoramaCloseButton() {
        const panoContainer = document.getElementById('pano');
        if (!panoContainer) return;

        // 기존 닫기 버튼 제거
        const existingBtn = panoContainer.querySelector('.pano-close-btn');
        if (existingBtn) {
            existingBtn.remove();
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'pano-close-btn';
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: rgba(0,0,0,0.7);
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        closeBtn.addEventListener('click', () => {
            this.hidePanorama();
        });

        panoContainer.appendChild(closeBtn);
    }

    // 현재 위치로 파노라마 이동
    movePanoramaToCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const location = new naver.maps.LatLng(lat, lng);
                    this.openPanoramaAtPosition(location);
                },
                error => {
                    console.error('위치 정보를 가져올 수 없습니다:', error);
                    alert('현재 위치를 가져올 수 없습니다.');
                }
            );
        } else {
            alert('이 브라우저는 위치 서비스를 지원하지 않습니다.');
        }
    }

    // 상태 정보 반환
    getStatus() {
        return {
            isActive: this.isActive,
            lineCount: this.streetViewLines.length,
            panoramaActive: !!this.panorama
        };
    }
}

// 전역 인스턴스 생성
window.StreetViewManager = new StreetViewManager();

// 거리뷰 버튼 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', () => {
    const streetBtn = document.querySelector('[data-type="street"]');
    if (streetBtn) {
        streetBtn.addEventListener('click', () => {
            window.StreetViewManager.toggleStreetViewMode();
        });
    }
});

console.log('🛣️ StreetViewManager 로드 완료');