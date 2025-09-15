// 저장 시스템 실시간 디버깅 도구
console.log('🔧 저장 시스템 디버깅 도구 로드됨');

// localStorage 직접 테스트 함수
window.testLocalStorageSave = function() {
    console.group('🧪 localStorage 테스트');
    
    try {
        // 테스트 데이터
        const testData = {
            test: true,
            timestamp: new Date().toISOString(),
            parcelNumber: 'TEST-123'
        };
        
        console.log('1️⃣ 테스트 데이터:', testData);
        
        // localStorage에 직접 저장
        localStorage.setItem('debug_test', JSON.stringify(testData));
        console.log('2️⃣ localStorage 저장 완료');
        
        // 바로 읽어보기
        const retrieved = localStorage.getItem('debug_test');
        console.log('3️⃣ localStorage 읽기:', retrieved);
        
        // CONFIG.STORAGE_KEY로도 테스트
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify([testData]));
        console.log('4️⃣ CONFIG.STORAGE_KEY 저장:', CONFIG.STORAGE_KEY);
        
        const configRetrieved = localStorage.getItem(CONFIG.STORAGE_KEY);
        console.log('5️⃣ CONFIG.STORAGE_KEY 읽기:', configRetrieved);
        
        console.log('✅ localStorage 테스트 완료 - 정상 작동');
        
    } catch (error) {
        console.error('❌ localStorage 테스트 실패:', error);
    } finally {
        localStorage.removeItem('debug_test');
        console.groupEnd();
    }
};

// 현재 localStorage 상태 확인
window.checkCurrentStorage = function() {
    console.group('📂 현재 localStorage 상태');
    
    console.log('🔑 CONFIG.STORAGE_KEY:', CONFIG.STORAGE_KEY);
    
    const currentData = localStorage.getItem(CONFIG.STORAGE_KEY);
    console.log('📄 현재 저장된 데이터:', currentData);
    
    if (currentData) {
        try {
            const parsed = JSON.parse(currentData);
            console.log('📊 파싱된 데이터:', parsed);
            console.log('📈 데이터 개수:', Array.isArray(parsed) ? parsed.length : '배열이 아님');
        } catch (e) {
            console.error('❌ JSON 파싱 실패:', e);
        }
    } else {
        console.log('📭 저장된 데이터 없음');
    }
    
    // 모든 localStorage 키 확인
    console.log('🗂️ 전체 localStorage 키들:');
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        console.log(`  ${i}: ${key} = ${localStorage.getItem(key).substring(0, 100)}...`);
    }
    
    console.groupEnd();
};

// 저장 함수 후킹하여 디버깅
window.debugSaveProcess = function() {
    console.log('🎯 저장 함수 디버깅 활성화');
    
    // 원본 saveParcelData 함수 백업
    const originalSave = window.saveParcelData;
    
    if (!originalSave) {
        console.error('❌ saveParcelData 함수를 찾을 수 없습니다!');
        return;
    }
    
    // 디버깅용 래퍼 함수
    window.saveParcelData = async function() {
        console.group('🚀 saveParcelData 실행 추적');
        
        console.log('🎬 저장 함수 시작');
        console.log('📝 현재 폼 데이터:', {
            parcelNumber: document.getElementById('parcelNumber').value,
            ownerName: document.getElementById('ownerName').value,
            ownerAddress: document.getElementById('ownerAddress').value,
            ownerContact: document.getElementById('ownerContact').value,
            memo: document.getElementById('memo').value
        });
        
        try {
            const result = await originalSave.call(this);
            console.log('✅ 저장 함수 완료, 결과:', result);
            
            // 저장 후 localStorage 확인
            setTimeout(() => {
                checkCurrentStorage();
            }, 100);
            
            return result;
        } catch (error) {
            console.error('❌ 저장 함수 실행 중 오류:', error);
            throw error;
        } finally {
            console.groupEnd();
        }
    };
    
    console.log('🎯 디버깅 활성화 완료 - 이제 저장 버튼을 눌러보세요');
};

// 페이지 로드 시 자동 디버깅 - 비활성화
window.autoDebugOnLoad = function() {
    // 디버그 로그 비활성화
    return;

    // console.group('🔍 페이지 로드 시 자동 디버깅');
    // testLocalStorageSave();
    // checkCurrentStorage();
    // console.log('⚙️ CONFIG 설정:', {
    //     STORAGE_KEY: CONFIG?.STORAGE_KEY,
    //     CONFIG_객체: CONFIG
    // });
    // console.log('🔧 함수 존재 여부:', {
    //     saveParcelData: typeof window.saveParcelData,
    //     migratedSetItem: typeof window.migratedSetItem,
    //     migratedGetItem: typeof window.migratedGetItem,
    //     supabaseAdapter: typeof window.supabaseAdapter
    // });
    
    console.groupEnd();
    
    // 저장 함수 디버깅 자동 활성화
    setTimeout(debugSaveProcess, 1000);
};

// 수동 디버깅 명령어들
console.log('🛠️ 사용 가능한 디버깅 명령어들:');
console.log('  testLocalStorageSave() - localStorage 기능 테스트');
console.log('  checkCurrentStorage() - 현재 저장 상태 확인'); 
console.log('  debugSaveProcess() - 저장 함수 디버깅 활성화');
console.log('  autoDebugOnLoad() - 전체 자동 디버깅 실행');

// DOM이 로드되면 자동 디버깅 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoDebugOnLoad);
} else {
    autoDebugOnLoad();
}