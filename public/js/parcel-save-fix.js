// 개선된 저장 함수 - 저장 버그 수정
async function saveParcelDataFixed() {
    const parcelNumber = document.getElementById('parcelNumber').value;
    
    if (!parcelNumber) {
        alert('지번을 입력해주세요.');
        return false;
    }
    
    console.log('💾 저장 시작:', parcelNumber);
    
    try {
        // 현재 선택된 필지의 PNU 사용
        let currentPNU = window.currentSelectedPNU;
        let geometry = null;
        let isSearchParcel = false;
        
        // PNU가 있으면 geometry 가져오기
        if (currentPNU) {
            // 검색 모드일 때는 searchParcels 우선
            if (window.currentMode === 'search') {
                let parcelData = window.searchParcels.get(currentPNU);
                if (parcelData) {
                    geometry = parcelData.data ? parcelData.data.geometry : parcelData.geometry;
                    isSearchParcel = true;
                }
            }
            
            // 못 찾았으면 clickParcels 확인
            if (!geometry) {
                let parcelData = window.clickParcels.get(currentPNU);
                if (parcelData && parcelData.data) {
                    geometry = parcelData.data.geometry;
                }
            }
        } else {
            // PNU가 없으면 지번으로 검색
            if (window.currentMode === 'search') {
                window.searchParcels.forEach((parcelData, pnu) => {
                    const jibun = formatJibun(parcelData.data?.properties || {});
                    if (jibun === parcelNumber && !currentPNU) {
                        currentPNU = pnu;
                        geometry = parcelData.data ? parcelData.data.geometry : parcelData.geometry;
                        isSearchParcel = true;
                    }
                });
            }
            
            // 못 찾았으면 clickParcels 확인
            if (!currentPNU) {
                window.clickParcels.forEach((parcelData, pnu) => {
                    const jibun = formatJibun(parcelData.data?.properties || {});
                    if (jibun === parcelNumber) {
                        currentPNU = pnu;
                        geometry = parcelData.data?.geometry;
                    }
                });
            }
        }
        
        const formData = {
            parcelNumber: parcelNumber,
            pnu: currentPNU,
            ownerName: document.getElementById('ownerName').value,
            ownerAddress: document.getElementById('ownerAddress').value,
            ownerContact: document.getElementById('ownerContact').value,
            memo: document.getElementById('memo').value,
            color: isSearchParcel ? '#9370DB' : currentColor,
            geometry: geometry,
            timestamp: new Date().toISOString(),
            isSearchParcel: isSearchParcel
        };
        
        console.log('📄 저장할 데이터:', formData);
        
        // 1단계: localStorage 직접 저장 (백업)
        let localStorageSuccess = false;
        try {
            let savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
            const existingIndex = savedData.findIndex(item => 
                (item.pnu && item.pnu === currentPNU) || 
                item.parcelNumber === formData.parcelNumber
            );
            
            if (existingIndex > -1) {
                savedData[existingIndex] = formData;
            } else {
                savedData.push(formData);
            }
            
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(savedData));
            localStorageSuccess = true;
            console.log('✅ localStorage 저장 성공');
        } catch (localError) {
            console.error('❌ localStorage 저장 실패:', localError);
        }
        
        // 2단계: Supabase 저장 시도
        let supabaseSuccess = false;
        try {
            if (window.migratedSetItem && typeof window.migratedSetItem === 'function') {
                const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
                await window.migratedSetItem(CONFIG.STORAGE_KEY, JSON.stringify(savedData));
                supabaseSuccess = true;
                console.log('✅ Supabase 저장 성공');
            } else {
                console.warn('⚠️ migratedSetItem 함수 없음 - localStorage만 사용');
            }
        } catch (supabaseError) {
            console.error('❌ Supabase 저장 실패:', supabaseError);
        }
        
        // 3단계: 지도 업데이트
        const targetMap = isSearchParcel ? window.searchParcels : window.clickParcels;
        const parcelData = targetMap.get(currentPNU);
        
        if (parcelData) {
            // Map에 저장된 데이터 업데이트
            parcelData.ownerName = formData.ownerName;
            parcelData.ownerAddress = formData.ownerAddress;
            parcelData.ownerContact = formData.ownerContact;
            parcelData.memo = formData.memo;
            parcelData.color = formData.color;
            parcelData.savedInfo = formData;
            
            // 폴리곤 색상 업데이트
            if (parcelData.polygon) {
                parcelData.polygon.setOptions({
                    fillColor: formData.color,
                    fillOpacity: isSearchParcel ? 0.7 : 0.5,
                    strokeColor: formData.color
                });
            }
            
            console.log('✅ 지도 업데이트 성공');
        }
        
        // 4단계: UI 업데이트
        await updateParcelList();
        
        // 우측 필지 관리자 목록 업데이트
        if (window.parcelManager) {
            window.parcelManager.loadParcels();
            window.parcelManager.applyFilters();
            window.parcelManager.render();
        }
        
        // 이벤트 발생
        window.dispatchEvent(new Event('refreshParcelList'));
        
        // 메모 마커 업데이트
        if (window.memoMarkerManager && formData.memo && formData.memo.trim() !== '') {
            await window.memoMarkerManager.createMemoMarker(formData);
            console.log('📍 메모 마커 생성/업데이트:', formData.parcelNumber);
        }
        
        // 저장 후 폼 초기화 (지번은 유지)
        const savedParcelNumber = document.getElementById('parcelNumber').value;
        document.getElementById('ownerName').value = '';
        document.getElementById('ownerAddress').value = '';
        document.getElementById('ownerContact').value = '';
        document.getElementById('memo').value = '';
        
        // 성공 메시지
        const saveStatus = [];
        if (localStorageSuccess) saveStatus.push('로컬저장');
        if (supabaseSuccess) saveStatus.push('클라우드저장');
        
        const statusText = saveStatus.length > 0 ? `(${saveStatus.join(', ')})` : '(오프라인저장)';
        // alert 제거 - 이미 상단에 자동저장 표시기가 있음
        console.log(`✅ 필지 저장 완료 ${statusText}`);
        
        console.log('✅ 저장 완료:', {
            parcelNumber: formData.parcelNumber,
            localStorage: localStorageSuccess,
            supabase: supabaseSuccess
        });
        
        return true;
        
    } catch (error) {
        console.error('🚨 저장 중 전체 오류:', error);
        // alert 제거 - 실시간 자동저장 시스템에서 오류 처리함
        console.error('❌ 저장 오류 - 실시간 자동저장 시스템이 처리합니다');
        return false;
    }
}

// 연결 상태 확인 함수
function checkSaveSystemStatus() {
    const status = {
        localStorage: false,
        supabaseAdapter: false,
        supabaseManager: false,
        migratedFunctions: false
    };
    
    // localStorage 테스트
    try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        status.localStorage = true;
    } catch (e) {
        console.error('localStorage 접근 불가:', e);
    }
    
    // SupabaseAdapter 확인
    status.supabaseAdapter = !!(window.supabaseAdapter && typeof window.supabaseAdapter.setItem === 'function');
    
    // SupabaseManager 확인
    status.supabaseManager = !!(window.SupabaseManager && window.SupabaseManager.isConnected);
    
    // migratedSetItem 확인
    status.migratedFunctions = !!(window.migratedSetItem && typeof window.migratedSetItem === 'function');
    
    console.log('💾 저장 시스템 상태:', status);
    return status;
}

// 수동 저장 시스템 진단
function diagnoseSaveSystem() {
    console.group('🔍 저장 시스템 진단');
    
    const status = checkSaveSystemStatus();
    
    console.log('1. 기본 저장 시스템:');
    console.log('  - localStorage:', status.localStorage ? '✅ 정상' : '❌ 오류');
    
    console.log('2. Supabase 어댑터:');
    console.log('  - supabaseAdapter:', status.supabaseAdapter ? '✅ 로드됨' : '❌ 미로드');
    console.log('  - migratedSetItem:', status.migratedFunctions ? '✅ 사용가능' : '❌ 사용불가');
    
    console.log('3. Supabase 연결:');
    console.log('  - SupabaseManager:', status.supabaseManager ? '✅ 연결됨' : '❌ 미연결');
    
    if (window.SupabaseManager) {
        console.log('  - 연결상태:', window.SupabaseManager.isConnected);
        console.log('  - 초기화시도:', window.SupabaseManager.initializationAttempts);
    }
    
    console.log('4. 권장사항:');
    if (!status.localStorage) {
        console.log('  ⚠️ localStorage 오류 - 브라우저 설정 확인 필요');
    }
    if (!status.migratedFunctions) {
        console.log('  ⚠️ Supabase 어댑터 미로드 - supabase-adapter.js 확인 필요');
    }
    if (!status.supabaseManager) {
        console.log('  ⚠️ Supabase 미연결 - 오프라인 모드로 동작');
    }
    
    console.groupEnd();
    return status;
}

// 전역 함수로 등록
window.saveParcelDataFixed = saveParcelDataFixed;
window.checkSaveSystemStatus = checkSaveSystemStatus;
window.diagnoseSaveSystem = diagnoseSaveSystem;

console.log('🔧 저장 시스템 수정 패치 로드됨');
console.log('사용법: diagnoseSaveSystem() - 저장 시스템 진단');
console.log('사용법: saveParcelDataFixed() - 개선된 저장 함수');