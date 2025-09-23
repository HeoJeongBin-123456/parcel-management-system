// 🎯 실시간 성능 모니터링 도구
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoad: null,
            appInit: null,
            mapInit: null,
            dataLoad: null,
            renderTime: null,
            memoryUsage: null
        };
        
        this.timers = new Map();
        this.isMonitoring = false;
        this.intervalId = null;
        
        this.init();
    }

    init() {
        this.startTimer('pageLoad');
        
        // 페이지 로드 완료 이벤트
        window.addEventListener('load', () => {
            this.endTimer('pageLoad');
            this.startMonitoring();
        });

        // 언로드 시 모니터링 정리
        window.addEventListener('beforeunload', () => {
            this.stopMonitoring();
        });

        console.log('📊 PerformanceMonitor 초기화 완료');
    }

    // 🎯 타이머 시작
    startTimer(name) {
        this.timers.set(name, performance.now());
    }

    // 🎯 타이머 종료 및 기록
    endTimer(name) {
        const startTime = this.timers.get(name);
        if (startTime) {
            const duration = performance.now() - startTime;
            this.metrics[name] = duration;
            this.timers.delete(name);
            console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
            return duration;
        }
        return null;
    }

    // 🎯 실시간 모니터링 시작
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.intervalId = setInterval(() => {
            this.collectMetrics();
        }, 5000); // 5초마다 수집

        console.log('📈 실시간 모니터링 시작');
    }

    // 🎯 모니터링 중지
    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isMonitoring = false;
        console.log('📉 실시간 모니터링 중지');
    }

    // 🎯 메트릭 수집
    collectMetrics() {
        try {
            // 메모리 사용량
            if (performance.memory) {
                this.metrics.memoryUsage = {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                };
            }

            // DOM 노드 수
            this.metrics.domNodes = document.querySelectorAll('*').length;

            // 이벤트 리스너 수 (추정)
            this.metrics.eventListeners = this.estimateEventListeners();

            // 네트워크 리소스
            this.collectNetworkMetrics();

        } catch (error) {
            console.warn('⚠️ 메트릭 수집 중 오류:', error);
        }
    }

    // 🎯 이벤트 리스너 수 추정
    estimateEventListeners() {
        let count = 0;
        const elements = document.querySelectorAll('*');
        
        elements.forEach(element => {
            // onclick 등 인라인 핸들러 체크
            const attributes = element.attributes;
            for (let i = 0; i < attributes.length; i++) {
                if (attributes[i].name.startsWith('on')) {
                    count++;
                }
            }
        });

        return count;
    }

    // 🎯 네트워크 메트릭 수집
    collectNetworkMetrics() {
        if (performance.getEntriesByType) {
            const resources = performance.getEntriesByType('resource');
            
            this.metrics.network = {
                totalRequests: resources.length,
                scriptRequests: resources.filter(r => r.name.includes('.js')).length,
                styleRequests: resources.filter(r => r.name.includes('.css')).length,
                apiRequests: resources.filter(r => 
                    r.name.includes('supabase') || 
                    r.name.includes('maps.naver.com') ||
                    r.name.includes('google.com')
                ).length
            };
        }
    }

    // 🎯 현재 성능 상태 조회
    getCurrentMetrics() {
        this.collectMetrics();
        return {
            ...this.metrics,
            timestamp: new Date().toISOString(),
            isMonitoring: this.isMonitoring
        };
    }

    // 🎯 성능 등급 계산
    getPerformanceGrade() {
        const metrics = this.getCurrentMetrics();
        let score = 100;

        // 페이지 로드 시간 (3초 기준)
        if (metrics.pageLoad > 3000) score -= 20;
        else if (metrics.pageLoad > 2000) score -= 10;
        else if (metrics.pageLoad > 1000) score -= 5;

        // 앱 초기화 시간 (2초 기준)
        if (metrics.appInit > 2000) score -= 15;
        else if (metrics.appInit > 1000) score -= 7;

        // 메모리 사용량 (100MB 기준)
        if (metrics.memoryUsage?.used > 100) score -= 15;
        else if (metrics.memoryUsage?.used > 50) score -= 8;

        // DOM 노드 수 (1000개 기준)
        if (metrics.domNodes > 1000) score -= 10;
        else if (metrics.domNodes > 500) score -= 5;

        // 등급 계산
        if (score >= 90) return { grade: 'A', score, status: '매우 좋음' };
        if (score >= 80) return { grade: 'B', score, status: '좋음' };
        if (score >= 70) return { grade: 'C', score, status: '보통' };
        if (score >= 60) return { grade: 'D', score, status: '나쁨' };
        return { grade: 'F', score, status: '매우 나쁨' };
    }

    // 🎯 성능 리포트 생성
    generateReport() {
        const metrics = this.getCurrentMetrics();
        const grade = this.getPerformanceGrade();

        const report = {
            timestamp: new Date().toISOString(),
            grade: grade,
            metrics: metrics,
            recommendations: this.getRecommendations(metrics)
        };

        console.group('📊 성능 리포트');
        console.log('등급:', `${grade.grade} (${grade.score}점) - ${grade.status}`);
        console.log('메트릭:', metrics);
        console.log('권장사항:', report.recommendations);
        console.groupEnd();

        return report;
    }

    // 🎯 성능 개선 권장사항
    getRecommendations(metrics) {
        const recommendations = [];

        if (metrics.pageLoad > 3000) {
            recommendations.push('페이지 로드 시간이 너무 깁니다. 스크립트 최적화를 고려하세요.');
        }

        if (metrics.memoryUsage?.used > 100) {
            recommendations.push('메모리 사용량이 높습니다. 메모리 누수를 확인하세요.');
        }

        if (metrics.domNodes > 1000) {
            recommendations.push('DOM 노드가 너무 많습니다. 가상화를 고려하세요.');
        }

        if (metrics.network?.totalRequests > 50) {
            recommendations.push('네트워크 요청이 많습니다. 리소스 번들링을 고려하세요.');
        }

        if (recommendations.length === 0) {
            recommendations.push('성능이 양호합니다!');
        }

        return recommendations;
    }

    // 🎯 성능 모니터링 UI 생성
    createMonitoringUI() {
        const panel = document.createElement('div');
        panel.id = 'performance-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            max-height: 400px;
            overflow-y: auto;
        `;

        const updateUI = () => {
            const metrics = this.getCurrentMetrics();
            const grade = this.getPerformanceGrade();
            
            panel.innerHTML = `
                <div style="margin-bottom: 10px; font-weight: bold;">
                    📊 성능 모니터 (${grade.grade}급 - ${grade.score}점)
                </div>
                <div>페이지 로드: ${metrics.pageLoad?.toFixed(0) || 'N/A'}ms</div>
                <div>앱 초기화: ${metrics.appInit?.toFixed(0) || 'N/A'}ms</div>
                <div>메모리: ${metrics.memoryUsage?.used || 'N/A'}MB</div>
                <div>DOM 노드: ${metrics.domNodes || 'N/A'}개</div>
                <div>네트워크: ${metrics.network?.totalRequests || 'N/A'}개</div>
                <div style="margin-top: 10px;">
                    <button onclick="window.performanceMonitor.toggleMonitoring()" style="margin-right: 5px;">
                        ${this.isMonitoring ? '중지' : '시작'}
                    </button>
                    <button onclick="window.performanceMonitor.generateReport()">리포트</button>
                    <button onclick="window.performanceMonitor.hideUI()" style="float: right;">×</button>
                </div>
            `;
        };

        updateUI();
        
        // 5초마다 UI 업데이트
        setInterval(updateUI, 5000);

        document.body.appendChild(panel);
        this.uiPanel = panel;
        
        return panel;
    }

    // 🎯 UI 토글
    toggleMonitoring() {
        if (this.isMonitoring) {
            this.stopMonitoring();
        } else {
            this.startMonitoring();
        }
    }

    hideUI() {
        if (this.uiPanel) {
            this.uiPanel.remove();
            this.uiPanel = null;
        }
    }

    showUI() {
        if (!this.uiPanel) {
            this.createMonitoringUI();
        }
    }
}

// 🎯 전역 인스턴스 생성
window.performanceMonitor = new PerformanceMonitor();

// 🎯 전역 함수들
window.showPerformanceMonitor = () => window.performanceMonitor.showUI();
window.getPerformanceReport = () => window.performanceMonitor.generateReport();
window.getPerformanceMetrics = () => window.performanceMonitor.getCurrentMetrics();

// 🎯 키보드 단축키 (Ctrl+Shift+P)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
        window.performanceMonitor.showUI();
        e.preventDefault();
    }
});

console.log('📊 성능 모니터링 도구 로드 완료');
console.log('사용법: showPerformanceMonitor() 또는 Ctrl+Shift+P');
