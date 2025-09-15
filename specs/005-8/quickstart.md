# Quickstart Guide: 클릭 모드와 검색 모드 기반 필지 관리 시스템

## 시작하기

### 1. 기본 설정 확인
```bash
# 의존성 설치
npm install

# 환경 변수 확인
cat .env
# 필수: SUPABASE_URL, SUPABASE_ANON_KEY, VWORLD_API_KEY, GOOGLE_CLIENT_ID

# 개발 서버 실행
node server.js
```

브라우저에서 http://localhost:3000 접속

### 2. 2초 내 로딩 테스트
```javascript
// 브라우저 콘솔에서 실행
console.time('Interactive Ready');
window.addEventListener('DOMContentLoaded', () => {
    // 색상 팔레트가 표시되고 클릭 가능한지 확인
    const palette = document.querySelector('.color-palette');
    if (palette && palette.children.length === 8) {
        console.timeEnd('Interactive Ready'); // 2초 이내여야 함
    }
});
```

## 주요 기능 테스트

### 1. 클릭 모드 테스트

#### 1.1 색상 선택 및 필지 색칠
1. 색상 팔레트에서 빨간색 선택
2. 지도에서 필지 클릭
3. 필지가 빨간색으로 칠해지는지 확인
4. 지번이 자동으로 입력되는지 확인

#### 1.2 토글 기능 테스트
1. 이미 색칠된 필지를 다시 클릭
2. 색상과 정보가 모두 제거되는지 확인
3. 확인 메시지가 표시되는지 확인

#### 1.3 마커 생성 테스트
1. 색칠된 필지에 메모 입력
2. 저장 버튼 클릭
3. 마커가 생성되는지 확인
4. 필지 정보 초기화 시 마커가 사라지는지 확인

#### 1.4 8가지 색상 테스트
```javascript
// 모든 색상이 정상 작동하는지 확인
const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
                '#FECA57', '#DDA0DD', '#FFB6C1', '#98D8C8'];
colors.forEach((color, index) => {
    console.log(`Testing color ${index}: ${color}`);
    // 각 색상 선택 후 필지 클릭 테스트
});
```

### 2. 검색 모드 테스트

#### 2.1 자동 모드 전환
1. 검색창에 주소 입력
2. 검색 실행
3. 자동으로 검색 모드로 전환되는지 확인
4. 클릭 모드의 색칠과 마커가 숨겨지는지 확인

#### 2.2 보라색 필지 표시
1. 검색 결과 필지가 보라색으로 표시되는지 확인
2. 메모 입력이 불가능한지 확인
3. 보라색 필지 클릭 시 색상이 제거되는지 확인

### 3. 모드 전환 테스트

#### 3.1 클릭 → 검색 모드
```javascript
// 모드 전환 확인
console.log('Current mode:', document.body.className);
// 검색 실행
document.querySelector('#searchInput').value = '서울시 강남구';
document.querySelector('#searchButton').click();
// 모드 확인
setTimeout(() => {
    console.log('After search:', document.body.className); // mode-search
}, 1000);
```

#### 3.2 검색 → 클릭 모드
1. 클릭 모드 버튼 클릭
2. 검색 모드 필지가 숨겨지는지 확인
3. 클릭 모드 필지가 다시 표시되는지 확인

### 4. 손 모양 커서 모드
1. 손 모양 커서 버튼 클릭
2. 필지 클릭이 안 되는지 확인
3. 지도 드래그만 가능한지 확인

## 데이터 영속성 테스트

### 1. 새로고침 테스트
```javascript
// 테스트 데이터 생성
const testData = {
    mode: 'click',
    parcels: ['PNU123', 'PNU456'],
    colors: [0, 3]
};

// 새로고침 전 상태 저장
localStorage.setItem('testBefore', JSON.stringify(testData));

// 새로고침
location.reload();

// 새로고침 후 상태 확인
const savedData = JSON.parse(localStorage.getItem('clickModeData'));
console.log('Data persisted:', savedData);
```

### 2. 모드별 데이터 분리
```javascript
// 각 모드 데이터가 독립적으로 저장되는지 확인
const clickData = localStorage.getItem('clickModeData');
const searchData = localStorage.getItem('searchModeData');
console.log('Click mode data:', clickData);
console.log('Search mode data:', searchData);
```

## 백업 시스템 테스트

### 1. 자동 백업 테스트
```javascript
// 백업 상태 확인
const backupState = JSON.parse(localStorage.getItem('backupState'));
console.log('Last backup:', new Date(backupState.lastBackup.timestamp));
console.log('Backup status:', backupState.lastBackup.status);
```

### 2. 백업 실패 시뮬레이션
```javascript
// 네트워크 끊기 (개발자 도구 > Network > Offline)
// 백업 트리거
window.BackupManager.triggerBackup();

// 재시도 확인 (10분 간격)
setTimeout(() => {
    const state = JSON.parse(localStorage.getItem('backupState'));
    console.log('Retry count:', state.retryState.count);
}, 600000); // 10분
```

### 3. 수동 백업
1. 백업 실패 5회 후 알림 확인
2. 수동 백업 버튼 표시 확인
3. 수동 백업 실행

## 구글 연동 테스트

### 1. 로그인 테스트
```javascript
// 구글 로그인 상태 확인
const session = JSON.parse(localStorage.getItem('userSession'));
console.log('Authenticated:', session?.isAuthenticated);
console.log('Permissions:', session?.permissions);
```

### 2. 구글 시트 전송
1. 필지 선택
2. 구글 시트 전송 버튼 클릭
3. 권한 요청 확인
4. 데이터 전송 확인

### 3. 비로그인 사용자 테스트
1. 로그아웃 상태에서 기본 기능 사용 가능 확인
2. 구글 연동 기능 제한 확인

## 성능 테스트

### 1. 대량 필지 테스트
```javascript
// 1000개 필지 생성 및 렌더링
console.time('Render 1000 parcels');
for (let i = 0; i < 1000; i++) {
    // 필지 생성 로직
}
console.timeEnd('Render 1000 parcels');
```

### 2. 메모리 사용량 확인
```javascript
// Chrome DevTools > Memory > Heap Snapshot
// 작업 전후 메모리 비교
console.log('Memory usage:', performance.memory.usedJSHeapSize / 1048576, 'MB');
```

## 트러블슈팅

### 문제: 2초 내 로딩 실패
```javascript
// 해결: 필수 요소만 먼저 로드
document.addEventListener('DOMContentLoaded', () => {
    // Critical path only
    initializeMap();
    initializeColorPalette();

    // Defer non-critical
    requestIdleCallback(() => {
        loadSavedData();
        initializeBackup();
    });
});
```

### 문제: 모드 전환 시 데이터 손실
```javascript
// 해결: 모드 전환 전 데이터 저장 확인
if (window.ModeManager) {
    window.ModeManager.saveCurrentModeData();
    window.ModeManager.switchMode('search');
}
```

### 문제: 백업 실패 알림 안 뜸
```javascript
// 해결: 백업 매니저 상태 확인
const backupManager = window.BackupManager;
if (backupManager.retryCount >= 5) {
    backupManager.notifyManualBackupRequired();
}
```

## 검증 체크리스트

- [ ] 브라우저 진입 후 2초 내 클릭 가능
- [ ] 8가지 색상 모두 정상 작동
- [ ] 토글 기능 (재클릭 시 삭제) 작동
- [ ] 검색 시 자동 모드 전환
- [ ] 모드 전환 시 데이터 숨김/표시
- [ ] 새로고침 후 데이터 유지
- [ ] 백업 재시도 메커니즘 작동
- [ ] 구글 로그인 및 연동
- [ ] 비로그인 사용자 기본 기능 사용 가능
- [ ] 1000개 이상 필지 처리 시 성능 유지