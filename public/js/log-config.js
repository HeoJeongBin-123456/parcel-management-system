// 로그 레벨 설정 및 관리
const LogConfig = {
    // 로그 레벨 설정 (true = 활성화, false = 비활성화)
    levels: {
        debug: false,    // 디버그 정보
        info: false,     // 일반 정보
        warn: true,      // 경고
        error: true,     // 에러
        critical: true   // 중요 정보만
    },

    // 모듈별 로그 설정
    modules: {
        supabase: false,
        backup: false,
        realtime: false,
        restore: false,
        debug: false,
        memo: false,
        parcel: false
    }
};

// 원본 console 메서드 백업
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    group: console.group,
    groupEnd: console.groupEnd
};

// console.log 오버라이드
console.log = function(...args) {
    // 중요 시스템 메시지만 표시
    const message = args[0]?.toString() || '';

    // 필수 메시지 패턴
    const essentialPatterns = [
        '✅ 모든 데이터',
        '🗑️ 삭제',
        '💾 저장 완료',
        '⚠️ 오류',
        '❌'
    ];

    // 무시할 패턴
    const ignorePatterns = [
        '📍 Memo',
        '🔍',
        '📊',
        '📡',
        '🔄',
        '💾 백업',
        '📅',
        '📆',
        '🏃‍♂️',
        '📋',
        '📄',
        '📸',
        '☁️',
        '📝',
        '🎣',
        '🗺️',
        '⏰',
        '🛡️',
        '🎛️',
        '🔧',
        '🛠️',
        '🎯',
        '📄 DOM',
        '✅ parcels',
        '✅ parcel_polygons',
        '✅ user_settings',
        '✅ Supabase 연결',
        '🚀',
        '📁',
        '⚡',
        '👀',
        '📌',
        '🆘',
        '🌐',
        '🚀 좌표',
        '🔥'
    ];

    // 무시할 패턴이 있으면 로그 출력 안함
    const shouldIgnore = ignorePatterns.some(pattern => message.includes(pattern));
    if (shouldIgnore && !essentialPatterns.some(pattern => message.includes(pattern))) {
        return;
    }

    // 그 외 메시지는 원본 console.log 호출
    originalConsole.log.apply(console, args);
};

// console.group 오버라이드
console.group = function(...args) {
    const message = args[0]?.toString() || '';
    if (message.includes('🔍') || message.includes('🧪') || message.includes('📂')) {
        return;
    }
    originalConsole.group.apply(console, args);
};

console.groupEnd = function() {
    // 그룹이 열려있을 때만 닫기
    try {
        originalConsole.groupEnd();
    } catch (e) {
        // 무시
    }
};

// 로그 레벨 복원 함수
window.restoreConsoleLogs = function() {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.group = originalConsole.group;
    console.groupEnd = originalConsole.groupEnd;
    console.log('✅ 콘솔 로그 복원됨');
};

// 로그 레벨 설정 함수
window.setLogLevel = function(level) {
    LogConfig.levels.debug = (level === 'debug');
    LogConfig.levels.info = (level === 'debug' || level === 'info');
    console.log(`✅ 로그 레벨 설정: ${level}`);
};