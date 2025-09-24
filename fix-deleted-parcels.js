// 삭제된 필지 목록 초기화 스크립트

// 브라우저 콘솔에서 실행할 수 있는 함수들

/**
 * 현재 삭제된 필지 목록 확인
 */
function checkDeletedParcels() {
    const deleted = localStorage.getItem('deletedParcels');
    const parcels = deleted ? JSON.parse(deleted) : [];
    console.log(`🗑️ 현재 삭제된 필지 개수: ${parcels.length}개`);
    console.log('삭제된 필지 목록:', parcels);
    return parcels;
}

/**
 * 삭제된 필지 목록 완전 초기화
 */
function clearDeletedParcels() {
    localStorage.removeItem('deletedParcels');
    console.log('✅ 삭제된 필지 목록이 초기화되었습니다.');
    console.log('이제 모든 필지를 다시 생성할 수 있습니다.');
}

/**
 * 특정 필지만 삭제 목록에서 제거
 */
function removeSpecificParcelFromDeleted(pnu) {
    const deleted = localStorage.getItem('deletedParcels');
    if (!deleted) {
        console.log('삭제된 필지 목록이 비어있습니다.');
        return;
    }

    let parcels = JSON.parse(deleted);
    const originalLength = parcels.length;
    parcels = parcels.filter(p => p !== pnu);

    if (parcels.length < originalLength) {
        localStorage.setItem('deletedParcels', JSON.stringify(parcels));
        console.log(`✅ ${pnu}가 삭제 목록에서 제거되었습니다.`);
        console.log(`남은 삭제 필지: ${parcels.length}개`);
    } else {
        console.log(`❌ ${pnu}는 삭제 목록에 없습니다.`);
    }
}

/**
 * 디버깅 정보 출력
 */
function debugParcelStorage() {
    console.log('========== 필지 저장소 디버깅 ==========');

    // 1. 삭제된 필지 목록
    const deleted = checkDeletedParcels();

    // 2. 저장된 필지 데이터
    const parcelData = localStorage.getItem('parcelData');
    const parcels = parcelData ? JSON.parse(parcelData) : [];
    console.log(`📦 저장된 필지 개수: ${parcels.length}개`);

    // 3. 클릭 모드 필지 데이터
    const clickData = localStorage.getItem('clickParcelData');
    const clickParcels = clickData ? JSON.parse(clickData) : [];
    console.log(`🎯 클릭 모드 필지 개수: ${clickParcels.length}개`);

    // 4. 색상 데이터
    const colors = localStorage.getItem('parcelColors');
    const colorMap = colors ? JSON.parse(colors) : {};
    console.log(`🎨 색상 적용된 필지 개수: ${Object.keys(colorMap).length}개`);

    console.log('========================================');
}

// 사용 방법 출력
console.log(`
🔧 삭제된 필지 목록 관리 도구
================================

사용 가능한 명령어:

1. checkDeletedParcels()
   - 현재 삭제된 필지 목록 확인

2. clearDeletedParcels()
   - 삭제된 필지 목록 완전 초기화
   - 모든 필지를 다시 생성 가능하게 함

3. removeSpecificParcelFromDeleted('PNU번호')
   - 특정 필지만 삭제 목록에서 제거

4. debugParcelStorage()
   - 전체 저장소 디버깅 정보 출력

예시:
clearDeletedParcels(); // 모든 삭제 기록 초기화
`);

// 자동으로 현재 상태 체크
debugParcelStorage();