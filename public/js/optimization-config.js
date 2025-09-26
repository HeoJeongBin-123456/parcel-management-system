/**
 * 최적화 시나리오 설정 시스템
 * URL 쿼리로 시나리오 선택 가능: ?scenario=aggressive
 */

const OPTIMIZATION_SCENARIOS = {
    // 🚀 극한 최적화 시나리오 (10가지)

    // 1️⃣ UltraFast - 극한 속도
    ultrafast: {
        name: 'UltraFast (극한 속도)',
        description: '60초 캐시, 2000 LRU - 최대 속도 추구',
        cacheMs: 60000,             // 60초 캐시
        lruSize: 2000,              // 2000개 LRU
        parallelMode: 'unlimited',  // 무제한 병렬
        debounceMs: 0,
        prefetch: true,
        lazyRender: false
    },

    // 2️⃣ SuperCache - 대용량 캐시
    supercache: {
        name: 'SuperCache (대용량 캐시)',
        description: '45초 캐시, 1500 LRU - 대용량 데이터 처리',
        cacheMs: 45000,             // 45초 캐시
        lruSize: 1500,              // 1500개 LRU
        parallelMode: 'unlimited',
        debounceMs: 0,
        prefetch: true,
        lazyRender: false
    },

    // 3️⃣ Current - 현재 적용 설정
    current: {
        name: 'Current (현재)',
        description: '30초 캐시, 1000 LRU - 이전 최적 설정',
        cacheMs: 30000,             // 30초 캐시
        lruSize: 1000,              // 1000개 LRU
        parallelMode: 'unlimited',
        debounceMs: 0,
        prefetch: true,
        lazyRender: false
    },

    // 4️⃣ FastClick - 클릭 최적화
    fastclick: {
        name: 'FastClick (클릭 최적화)',
        description: '20초 캐시, 800 LRU, chunked(5) - 클릭 반응 최적화',
        cacheMs: 20000,             // 20초 캐시
        lruSize: 800,               // 800개 LRU
        parallelMode: 'chunked',
        chunkSize: 5,               // 5개씩 chunk
        debounceMs: 0,
        prefetch: true,
        lazyRender: false
    },

    // 5️⃣ SmartChunk - 청크 최적화
    smartchunk: {
        name: 'SmartChunk (청크 최적화)',
        description: '15초 캐시, 500 LRU, chunked(10) - 안정적인 청크 처리',
        cacheMs: 15000,             // 15초 캐시
        lruSize: 500,               // 500개 LRU
        parallelMode: 'chunked',
        chunkSize: 10,              // 10개씩 chunk
        debounceMs: 50,
        prefetch: true,
        lazyRender: true
    },

    // 6️⃣ RapidDrag - 드래그 최적화
    rapiddrag: {
        name: 'RapidDrag (드래그 최적화)',
        description: '10초 캐시, 300 LRU, adaptive - 지도 드래그 최적화',
        cacheMs: 10000,             // 10초 캐시
        lruSize: 300,               // 300개 LRU
        parallelMode: 'adaptive',
        adaptiveThreshold: 30,      // 30개 이상 병렬
        debounceMs: 0,
        prefetch: false,
        lazyRender: true
    },

    // 7️⃣ LowLatency - 저지연
    lowlatency: {
        name: 'LowLatency (저지연)',
        description: '5초 캐시, 200 LRU, chunked(20) - 최소 지연',
        cacheMs: 5000,              // 5초 캐시
        lruSize: 200,               // 200개 LRU
        parallelMode: 'chunked',
        chunkSize: 20,              // 20개씩 chunk
        debounceMs: 30,
        prefetch: true,
        lazyRender: true
    },

    // 8️⃣ Micro - 마이크로 캐시
    micro: {
        name: 'Micro (마이크로 캐시)',
        description: '2초 캐시, 100 LRU, sequential - 짧은 캐시',
        cacheMs: 2000,              // 2초 캐시
        lruSize: 100,               // 100개 LRU
        parallelMode: 'sequential',
        debounceMs: 0,
        prefetch: false,
        lazyRender: false
    },

    // 9️⃣ Instant - 즉시 반영
    instant: {
        name: 'Instant (즉시 반영)',
        description: '1초 캐시, 50 LRU, unlimited - 실시간 반영',
        cacheMs: 1000,              // 1초 캐시
        lruSize: 50,                // 50개 LRU
        parallelMode: 'unlimited',
        debounceMs: 0,
        prefetch: false,
        lazyRender: false
    },

    // 🔟 ZeroCache - 캐시 없음
    zerocache: {
        name: 'ZeroCache (캐시 없음)',
        description: '0초 캐시, 10 LRU, sequential - 캐시 비활성화',
        cacheMs: 0,                 // 캐시 없음
        lruSize: 10,                // 10개 LRU
        parallelMode: 'sequential',
        debounceMs: 0,
        prefetch: false,
        lazyRender: false
    }
};

/**
 * URL 쿼리 파라미터에서 시나리오 가져오기
 */
function getScenarioFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const scenario = urlParams.get('scenario');

    if (scenario && OPTIMIZATION_SCENARIOS[scenario]) {
        console.log(`🎯 URL에서 최적화 시나리오 선택: ${OPTIMIZATION_SCENARIOS[scenario].name}`);
        return scenario;
    }

    return 'current';
}

/**
 * 현재 적용된 설정 가져오기
 */
function getCurrentConfig() {
    const scenarioKey = getScenarioFromURL();
    const config = OPTIMIZATION_SCENARIOS[scenarioKey];

    console.log('⚙️ 최적화 설정 로드:', config.name);
    console.log('  - 캐시 유효기간:', config.cacheMs, 'ms');
    console.log('  - LRU 크기:', config.lruSize, '개');
    console.log('  - 병렬 처리 모드:', config.parallelMode);

    return {
        ...config,
        scenarioKey
    };
}

/**
 * 전역 설정 초기화
 */
window.OPTIMIZATION_CONFIG = getCurrentConfig();
window.OPTIMIZATION_SCENARIOS = OPTIMIZATION_SCENARIOS;

/**
 * 시나리오 변경 함수
 */
window.switchOptimizationScenario = function(scenarioKey) {
    if (!OPTIMIZATION_SCENARIOS[scenarioKey]) {
        console.error('❌ 존재하지 않는 시나리오:', scenarioKey);
        return false;
    }

    const newURL = new URL(window.location);
    newURL.searchParams.set('scenario', scenarioKey);
    window.location.href = newURL.toString();
    return true;
};

console.log('✅ 최적화 설정 시스템 초기화 완료');
console.log('💡 사용 가능한 시나리오:', Object.keys(OPTIMIZATION_SCENARIOS).join(', '));
console.log('💡 시나리오 변경: window.switchOptimizationScenario("aggressive")');