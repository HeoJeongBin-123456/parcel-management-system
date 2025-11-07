// 프로덕션 환경 설정
(function() {
    'use strict';

    // 프로덕션 환경 감지
    const isProduction = window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1' &&
                        !window.location.hostname.includes('dev');

    window.PRODUCTION_CONFIG = {
        isProduction: isProduction,
        
        // 로그 설정
        logging: {
            level: isProduction ? 'error' : 'debug',
            enableConsole: !isProduction,
            enableRemote: isProduction // 프로덕션에서는 원격 로깅
        },
        
        // 성능 설정
        performance: {
            enableMonitoring: true,
            enableProfiling: !isProduction,
            sampleRate: isProduction ? 0.1 : 1.0 // 프로덕션에서는 10% 샘플링
        },
        
        // 보안 설정
        security: {
            validateInputs: true,
            sanitizeData: true,
            requireHTTPS: isProduction
        },
        
        // 데이터 저장 설정
        storage: {
            enableIndexedDB: true,
            enableSessionStorage: true,
            enableEmergencyBackup: true,
            autoSaveInterval: isProduction ? 300000 : 60000 // 프로덕션: 5분, 개발: 1분
        },
        
        // 에러 리포팅
        errorReporting: {
            enabled: isProduction,
            endpoint: null, // 외부 에러 리포팅 서비스 설정 가능
            sampleRate: 1.0
        }
    };

    // 프로덕션 모드일 때 console.log 최소화
    if (isProduction) {
        const originalLog = console.log;
        const originalWarn = console.warn;
        
        console.log = function(...args) {
            // 중요 메시지만 출력
            const message = args[0]?.toString() || '';
            if (message.includes('❌') || message.includes('⚠️') || message.includes('✅')) {
                originalLog.apply(console, args);
            }
        };
        
        console.warn = function(...args) {
            originalWarn.apply(console, args);
        };
        
        // 복원 함수
        window.restoreConsole = function() {
            console.log = originalLog;
            console.warn = originalWarn;
        };
    }

    console.log(`🚀 프로덕션 설정 로드 완료 (모드: ${isProduction ? 'Production' : 'Development'})`);
})();


