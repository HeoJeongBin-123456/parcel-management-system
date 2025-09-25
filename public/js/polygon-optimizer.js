// 🚀 폴리곤 렌더링 최적화 모듈

(function() {
    'use strict';

    // 가시 영역 체크
    function isPolygonInViewBounds(polygon, map) {
        if (!polygon || !map) return false;

        try {
            const bounds = map.getBounds();
            if (!bounds) return false;

            // 폴리곤의 경로 가져오기
            const paths = polygon.getPaths();
            if (!paths || paths.length === 0) return false;

            // 폴리곤의 어느 점이라도 보이는 영역에 있는지 체크
            if (typeof paths.getAt === 'function') {
                // MVCArray인 경우
                for (let i = 0; i < paths.getLength(); i++) {
                    const path = paths.getAt(i);
                    if (path && typeof path.getAt === 'function') {
                        for (let j = 0; j < path.getLength(); j++) {
                            const point = path.getAt(j);
                            if (bounds.hasLatLng(point)) {
                                return true;
                            }
                        }
                    }
                }
            } else if (Array.isArray(paths)) {
                // 일반 배열인 경우
                for (const path of paths) {
                    if (Array.isArray(path)) {
                        for (const point of path) {
                            if (bounds.hasLatLng(point)) {
                                return true;
                            }
                        }
                    } else if (bounds.hasLatLng(path)) {
                        return true;
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ 폴리곤 가시성 체크 실패:', error);
            return true; // 에러시 안전하게 true 반환
        }

        return false;
    }

    // 보이는 폴리곤만 업데이트
    function updateVisiblePolygons(map, updateFn) {
        if (!map || !window.clickParcels) return;

        const visibleCount = { updated: 0, skipped: 0 };

        window.clickParcels.forEach((parcelData, pnu) => {
            if (parcelData && parcelData.polygon) {
                if (isPolygonInViewBounds(parcelData.polygon, map)) {
                    updateFn(parcelData, pnu);
                    visibleCount.updated++;
                } else {
                    visibleCount.skipped++;
                }
            }
        });

        console.log(`📊 폴리곤 업데이트: ${visibleCount.updated}개 처리, ${visibleCount.skipped}개 스킵`);
        return visibleCount;
    }

    // 줌 레벨에 따른 폴리곤 단순화
    function getSimplificationLevel(zoomLevel) {
        if (zoomLevel < 10) return 0.001;  // 매우 단순화
        if (zoomLevel < 13) return 0.0005; // 중간 단순화
        if (zoomLevel < 16) return 0.0001; // 약간 단순화
        return 0; // 단순화 없음
    }

    // 폴리곤 좌표 단순화 (Douglas-Peucker 알고리즘 간소화 버전)
    function simplifyPolygonCoords(coords, tolerance) {
        if (!coords || coords.length <= 2 || tolerance === 0) return coords;

        // 간단한 거리 기반 필터링
        const simplified = [coords[0]];
        let lastPoint = coords[0];

        for (let i = 1; i < coords.length - 1; i++) {
            const point = coords[i];
            const distance = Math.sqrt(
                Math.pow(point.lat() - lastPoint.lat(), 2) +
                Math.pow(point.lng() - lastPoint.lng(), 2)
            );

            if (distance > tolerance) {
                simplified.push(point);
                lastPoint = point;
            }
        }

        // 마지막 점은 항상 포함
        simplified.push(coords[coords.length - 1]);
        return simplified;
    }

    // 일괄 폴리곤 업데이트 with 최적화
    function batchUpdatePolygons(polygonUpdates) {
        if (!polygonUpdates || polygonUpdates.length === 0) return;

        const BATCH_SIZE = 10; // 한 번에 처리할 폴리곤 수
        let index = 0;

        function processBatch() {
            const endIndex = Math.min(index + BATCH_SIZE, polygonUpdates.length);

            for (let i = index; i < endIndex; i++) {
                const update = polygonUpdates[i];
                if (update && typeof update === 'function') {
                    update();
                }
            }

            index = endIndex;

            if (index < polygonUpdates.length) {
                // 다음 배치 처리
                requestAnimationFrame(processBatch);
            } else {
                console.log(`✅ ${polygonUpdates.length}개 폴리곤 업데이트 완료`);
            }
        }

        requestAnimationFrame(processBatch);
    }

    // 메모리 정리 함수
    function cleanupInactivePolygons(activeMode) {
        const modes = ['click', 'search', 'hand'];
        let cleanedCount = 0;

        modes.forEach(mode => {
            if (mode !== activeMode) {
                const mapKey = `map${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
                const mapInstance = window[mapKey];

                if (mapInstance) {
                    // 비활성 모드의 지도에서 폴리곤 숨기기
                    const parcelsMap = mode === 'search' ? window.searchParcels : window.clickParcels;

                    if (parcelsMap && parcelsMap.size > 0) {
                        parcelsMap.forEach(parcelData => {
                            if (parcelData && parcelData.polygon) {
                                // 임시로 맵에서 제거 (메모리 절약)
                                parcelData.polygon.setMap(null);
                                cleanedCount++;
                            }
                        });
                    }
                }
            }
        });

        if (cleanedCount > 0) {
            console.log(`🧹 ${cleanedCount}개 비활성 폴리곤 메모리 정리`);
        }

        return cleanedCount;
    }

    // CSS 최적화 적용
    function applyPerformanceStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* 네이버 지도 성능 최적화 */
            .naver-map-container {
                will-change: transform;
                transform: translateZ(0);
                backface-visibility: hidden;
            }

            /* 폴리곤 레이어 GPU 가속 */
            svg.nmap-shapes {
                will-change: transform;
                transform: translateZ(0);
            }

            /* 마커 성능 최적화 */
            .map-marker {
                will-change: transform;
                transform: translateZ(0);
                backface-visibility: hidden;
            }

            /* 애니메이션 최적화 */
            * {
                animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            }
        `;
        document.head.appendChild(style);
    }

    // 전역 노출
    window.PolygonOptimizer = {
        isPolygonInViewBounds,
        updateVisiblePolygons,
        getSimplificationLevel,
        simplifyPolygonCoords,
        batchUpdatePolygons,
        cleanupInactivePolygons,
        applyPerformanceStyles
    };

    // 자동 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyPerformanceStyles);
    } else {
        applyPerformanceStyles();
    }

    console.log('🚀 폴리곤 최적화 모듈 로드됨');
})();