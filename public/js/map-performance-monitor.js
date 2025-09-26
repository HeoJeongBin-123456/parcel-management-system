// 🚀 지도 렌더링 성능 모니터링 도구

(function() {
    'use strict';

    const performanceMonitor = {
        enabled: true,
        metrics: {
            idleEvents: 0,
            restoreCalls: 0,
            polygonCount: 0,
            avgRestoreTime: 0,
            totalRestoreTime: 0
        },

        // 성능 통계 수집 시작
        init() {
            if (!this.enabled) return;

            // idle 이벤트 카운트
            const originalIdleHandler = window.debouncedIdleHandler;

            // restoreSavedParcelsOnMap 모니터링
            const originalRestore = window.restoreSavedParcelsOnMap;
            if (originalRestore) {
                window.restoreSavedParcelsOnMap = async function(...args) {
                    const start = performance.now();
                    performanceMonitor.metrics.restoreCalls++;

                    const result = await originalRestore.apply(this, args);

                    const duration = performance.now() - start;
                    performanceMonitor.metrics.totalRestoreTime += duration;
                    performanceMonitor.metrics.avgRestoreTime =
                        performanceMonitor.metrics.totalRestoreTime / performanceMonitor.metrics.restoreCalls;

                    console.log(`📊 restoreSavedParcelsOnMap 실행 시간: ${duration.toFixed(2)}ms`);

                    return result;
                };
            }

            console.log('📊 지도 성능 모니터링 시작');
        },

        // 현재 통계 출력
        getStats() {
            const polygonCount = window.clickParcels ? window.clickParcels.size : 0;

            return {
                'restoreSavedParcelsOnMap 호출': this.metrics.restoreCalls,
                '평균 실행 시간': `${this.metrics.avgRestoreTime.toFixed(2)}ms`,
                '총 실행 시간': `${this.metrics.totalRestoreTime.toFixed(2)}ms`,
                '현재 폴리곤 수': polygonCount,
                '메모리 사용량': this.getMemoryUsage()
            };
        },

        // 메모리 사용량 확인
        getMemoryUsage() {
            if (performance.memory) {
                const used = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
                const total = (performance.memory.totalJSHeapSize / 1048576).toFixed(2);
                return `${used}MB / ${total}MB`;
            }
            return 'N/A';
        },

        // 통계 초기화
        reset() {
            this.metrics = {
                idleEvents: 0,
                restoreCalls: 0,
                polygonCount: 0,
                avgRestoreTime: 0,
                totalRestoreTime: 0
            };
            console.log('📊 성능 통계 초기화됨');
        },

        // 콘솔에 통계 출력
        print() {
            console.table(this.getStats());
        }
    };

    // 전역 노출
    window.MapPerformanceMonitor = performanceMonitor;

    // 자동 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => performanceMonitor.init());
    } else {
        performanceMonitor.init();
    }

    // 사용 안내
    console.log(`
%c🚀 지도 성능 모니터링 도구%c

사용 방법:
- MapPerformanceMonitor.print()     : 현재 성능 통계 출력
- MapPerformanceMonitor.reset()     : 통계 초기화
- MapPerformanceMonitor.getStats()  : 통계 객체 반환

`, 'background: #667eea; color: white; font-weight: bold; padding: 5px 10px; border-radius: 5px', '');

})();