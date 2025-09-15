# Research Document: 클릭 모드와 검색 모드 기반 필지 관리 시스템

## Executive Summary
클릭 모드와 검색 모드를 독립적으로 운영하는 필지 관리 시스템 구현을 위한 연구 결과. 기존 시스템의 색상 토글 기능을 확장하여 8가지 색상 팔레트 시스템으로 발전시키고, 검색 전용 모드를 추가하여 두 모드 간 완전한 독립성을 보장.

## 1. 클릭 모드 구현 방식

### Decision: 기존 토글 메커니즘 확장
**Rationale**:
- 현재 parcel.js의 색상 토글 로직이 이미 구현되어 있음
- 재클릭시 삭제 기능이 검증된 상태
- 최소한의 코드 변경으로 8가지 색상 확장 가능

**Implementation Approach**:
```javascript
// 기존 단일 색상 토글을 8가지로 확장
const colorPalette = [
    '#FF6B6B', // 빨강
    '#4ECDC4', // 청록
    '#45B7D1', // 파랑
    '#96CEB4', // 녹색
    '#FECA57', // 노랑
    '#DDA0DD', // 보라 (클릭 모드용)
    '#FFB6C1', // 분홍
    '#98D8C8'  // 민트
];

// 색상 인덱스 관리
let currentColorIndex = 0;
const parcelColorMap = new Map(); // pnu -> colorIndex
```

**Alternatives Considered**:
- 새로운 색상 시스템 구축 → 기존 코드와 충돌 위험
- 외부 라이브러리 사용 → 불필요한 의존성 증가

## 2. 검색 모드 독립성 보장

### Decision: 별도 상태 관리 및 레이어 분리
**Rationale**:
- 클릭 모드와 검색 모드 데이터를 완전히 분리 저장
- 모드 전환 시 빠른 표시/숨김 처리 가능
- 새로고침 후에도 각 모드 상태 독립적 유지

**State Management Structure**:
```javascript
// 모드별 독립적 상태 관리
const modeState = {
    current: 'click', // 'click' | 'search' | 'hand'
    clickMode: {
        parcels: Map(), // pnu -> parcelData
        colors: Map(),  // pnu -> colorIndex
        markers: Map()  // pnu -> marker
    },
    searchMode: {
        parcels: Map(), // pnu -> searchData
        query: '',
        results: []
    }
};

// LocalStorage 키 분리
const STORAGE_KEYS = {
    CLICK_MODE: 'clickModeData',
    SEARCH_MODE: 'searchModeData',
    CURRENT_MODE: 'currentMode'
};
```

**Alternatives Considered**:
- 단일 상태로 플래그 관리 → 복잡도 증가, 버그 위험
- 서버 측 모드 관리 → 불필요한 네트워크 오버헤드

## 3. 성능 최적화 전략

### Decision: 지연 로딩 + 가상 스크롤링 + 웹 워커
**Rationale**:
- 2초 내 상호작용 가능 목표 달성
- 대량 필지(1000+) 처리 시 UI 블로킹 방지
- 메모리 효율적 관리

**Optimization Techniques**:
```javascript
// 1. 필수 요소만 즉시 로드
window.addEventListener('DOMContentLoaded', () => {
    // 지도 초기화
    initializeMap();
    // 색상 팔레트 UI만 먼저 로드
    initializeColorPalette();
    // 2초 내 클릭 가능 상태
    enableClickMode();

    // 나머지는 비동기 로드
    requestIdleCallback(() => {
        loadSavedParcels();
        initializeBackupSystem();
        initializeGoogleAuth();
    });
});

// 2. 대량 필지 렌더링 최적화
const renderParcelsInBatches = (parcels) => {
    const BATCH_SIZE = 50;
    let index = 0;

    const renderBatch = () => {
        const batch = parcels.slice(index, index + BATCH_SIZE);
        batch.forEach(parcel => renderParcel(parcel));
        index += BATCH_SIZE;

        if (index < parcels.length) {
            requestAnimationFrame(renderBatch);
        }
    };

    renderBatch();
};

// 3. 메모리 관리
const cleanupInvisibleParcels = () => {
    const viewport = map.getBounds();
    parcelsMap.forEach((parcel, pnu) => {
        if (!viewport.hasLatLng(parcel.position)) {
            // 뷰포트 밖 폴리곤 임시 제거
            parcel.polygon?.setMap(null);
        }
    });
};
```

**Alternatives Considered**:
- 서버 사이드 렌더링 → 실시간 상호작용 제한
- Canvas 렌더링 → Naver Maps API와 호환성 문제

## 4. 백업 시스템 강화

### Decision: 지수 백오프 재시도 + 사용자 알림
**Rationale**:
- 네트워크 일시적 장애 대응
- 사용자에게 명확한 피드백 제공
- 데이터 손실 방지

**Retry Mechanism**:
```javascript
class EnhancedBackupManager {
    constructor() {
        this.maxRetries = 5;
        this.retryDelay = 10 * 60 * 1000; // 10분
        this.retryCount = 0;
    }

    async backupWithRetry(data) {
        try {
            await this.performBackup(data);
            this.retryCount = 0;
            this.notifySuccess();
        } catch (error) {
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                this.scheduleRetry(data);
                this.notifyRetrying(this.retryCount);
            } else {
                this.notifyManualBackupRequired();
                this.saveFailedBackupLocally(data);
            }
        }
    }

    scheduleRetry(data) {
        setTimeout(() => {
            this.backupWithRetry(data);
        }, this.retryDelay);
    }

    notifyManualBackupRequired() {
        // 사용자에게 수동 백업 요청 알림
        alert('자동 백업이 실패했습니다. 수동으로 백업해 주세요.');
        // 백업 가이드 표시
        this.showBackupGuide();
    }
}
```

**Alternatives Considered**:
- 무한 재시도 → 리소스 낭비
- 즉시 실패 → 일시적 장애 대응 불가

## 5. 모드 전환 메커니즘

### Decision: CSS 클래스 기반 즉시 전환
**Rationale**:
- DOM 재렌더링 최소화
- 부드러운 전환 효과
- 상태 보존 용이

**Mode Switching**:
```javascript
class ModeManager {
    switchMode(newMode) {
        // 이전 모드 데이터 저장
        this.saveCurrentModeData();

        // CSS 클래스로 즉시 전환
        document.body.className = `mode-${newMode}`;

        // 새 모드 데이터 로드
        this.loadModeData(newMode);

        // 모드별 UI 업데이트
        this.updateUI(newMode);

        // 상태 저장
        localStorage.setItem('currentMode', newMode);
    }

    saveCurrentModeData() {
        const mode = this.currentMode;
        const data = this.collectModeData(mode);
        localStorage.setItem(`${mode}ModeData`, JSON.stringify(data));
    }
}
```

**CSS Structure**:
```css
/* 클릭 모드 */
body.mode-click .search-only { display: none; }
body.mode-click .click-parcels { display: block; }

/* 검색 모드 */
body.mode-search .click-only { display: none; }
body.mode-search .search-parcels { display: block; }

/* 손 모드 */
body.mode-hand .interactive-elements { pointer-events: none; }
```

## 6. 구글 서비스 통합

### Decision: 점진적 권한 요청
**Rationale**:
- 로그인하지 않은 사용자도 기본 기능 사용 가능
- 필요시에만 권한 요청으로 사용자 부담 감소
- 각 서비스별 독립적 권한 관리

**Integration Approach**:
```javascript
class GoogleIntegration {
    constructor() {
        this.isAuthenticated = false;
        this.permissions = {
            sheets: false,
            calendar: false,
            drive: false
        };
    }

    async requestPermission(service) {
        if (!this.isAuthenticated) {
            const auth = await this.authenticate();
            if (!auth) return false;
        }

        const scope = this.getScope(service);
        return await this.requestScope(scope);
    }

    getScope(service) {
        const scopes = {
            sheets: 'https://www.googleapis.com/auth/spreadsheets',
            calendar: 'https://www.googleapis.com/auth/calendar',
            drive: 'https://www.googleapis.com/auth/drive.file'
        };
        return scopes[service];
    }
}
```

## 7. 사이드 이펙트 방지 전략

### Decision: 이벤트 격리 + 상태 불변성
**Rationale**:
- 모드 간 이벤트 충돌 방지
- 예측 가능한 상태 변경
- 디버깅 용이성

**Implementation**:
```javascript
// 이벤트 네임스페이스
const EventNamespaces = {
    CLICK_MODE: 'click',
    SEARCH_MODE: 'search',
    COMMON: 'common'
};

// 모드별 이벤트 핸들러 등록
class SafeEventManager {
    constructor() {
        this.handlers = new Map();
    }

    register(mode, eventType, handler) {
        const key = `${mode}:${eventType}`;
        this.handlers.set(key, handler);
    }

    switchMode(newMode) {
        // 이전 모드 이벤트 해제
        this.removeEventListeners(this.currentMode);
        // 새 모드 이벤트 등록
        this.addEventListeners(newMode);
        this.currentMode = newMode;
    }
}

// 상태 불변성 보장
const updateState = (state, updates) => {
    return {
        ...state,
        ...updates,
        updatedAt: Date.now()
    };
};
```

## Conclusions

### Key Decisions Summary:
1. **클릭 모드**: 기존 토글 메커니즘을 8가지 색상으로 확장
2. **검색 모드**: 완전히 독립된 상태 관리 및 레이어 분리
3. **성능**: 지연 로딩 + 배치 렌더링으로 2초 내 상호작용 달성
4. **백업**: 지수 백오프 재시도 + 사용자 알림 시스템
5. **모드 전환**: CSS 클래스 기반 즉시 전환
6. **구글 통합**: 점진적 권한 요청 방식
7. **안정성**: 이벤트 격리 및 상태 불변성으로 사이드 이펙트 방지

### Next Steps:
- Phase 1에서 상세 데이터 모델 및 API 계약 정의
- 기존 코드베이스와의 통합 지점 식별
- 테스트 시나리오 작성