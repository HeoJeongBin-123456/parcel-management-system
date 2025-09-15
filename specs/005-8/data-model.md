# Data Model: 클릭 모드와 검색 모드 기반 필지 관리 시스템

## Entity Relationship Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   ModeState │────▶│    Parcel    │◀────│   Marker    │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │                     │
       │                    │                     │
       ▼                    ▼                     │
┌─────────────┐     ┌──────────────┐            │
│ColorPalette │     │ BackupState  │            │
└─────────────┘     └──────────────┘            │
       │                                         │
       └─────────────────────────────────────────┘
```

## Core Entities

### 1. ModeState
현재 활성 모드와 각 모드별 데이터를 관리하는 최상위 엔티티

```javascript
{
    currentMode: String,        // 'click' | 'search' | 'hand'
    lastModeSwitchTime: Number, // timestamp
    clickModeData: {
        parcels: Map,           // pnu -> ParcelData
        colors: Map,            // pnu -> colorIndex (0-7)
        markers: Map,           // pnu -> MarkerData
        lastAction: String,     // 마지막 수행 동작
        stats: {
            totalParcels: Number,
            coloredParcels: Number,
            markersCount: Number
        }
    },
    searchModeData: {
        query: String,          // 현재 검색어
        results: Array,         // 검색 결과 PNU 목록
        parcels: Map,           // pnu -> SearchParcelData
        searchTime: Number,     // 마지막 검색 시간
        isActive: Boolean       // 검색 모드 활성 상태
    },
    handModeData: {
        isLocked: Boolean,      // 드래그만 가능 상태
        previousMode: String    // 이전 모드 기억
    }
}
```

**Validation Rules**:
- currentMode는 반드시 'click', 'search', 'hand' 중 하나
- 모드 전환 시 이전 모드 데이터 자동 저장
- searchModeData.results는 최대 1000개 제한

### 2. Parcel (Enhanced)
필지 정보를 담는 핵심 엔티티 (기존 확장)

```javascript
{
    // 기존 필드
    pnu: String,                // 필지 고유번호 (Primary Key)
    lat: Number,                // 위도
    lng: Number,                // 경도
    parcelName: String,         // 지번
    ownerName: String,          // 소유자명
    ownerAddress: String,       // 소유자 주소
    ownerContact: String,       // 연락처
    memo: String,               // 메모

    // 새로운 필드
    colorIndex: Number,         // 0-7 (8가지 색상), null if not colored
    mode: String,               // 'click' | 'search' - 생성된 모드
    createdAt: Number,          // 생성 시간
    updatedAt: Number,          // 수정 시간
    isVisible: Boolean,         // 현재 표시 상태
    geometry: Object,           // 폴리곤 좌표 데이터

    // 메타데이터
    version: Number,            // 데이터 버전 (충돌 방지)
    syncStatus: String          // 'synced' | 'pending' | 'error'
}
```

**Validation Rules**:
- pnu는 필수이며 고유해야 함
- colorIndex는 0-7 범위 또는 null
- mode는 'click' 또는 'search'만 허용
- 검색 모드 필지는 colorIndex가 항상 8 (보라색)

### 3. ColorPalette
색상 팔레트 관리 엔티티

```javascript
{
    colors: [
        {
            index: Number,      // 0-7
            hex: String,        // '#FF6B6B'
            name: String,       // '빨강'
            isActive: Boolean,  // 현재 선택 상태
            usageCount: Number  // 사용된 필지 수
        }
    ],
    currentSelection: Number,   // 현재 선택된 색상 인덱스
    searchModeColor: {
        hex: String,            // '#9B59B6' (보라색)
        name: String            // '검색'
    }
}
```

**State Transitions**:
- 색상 선택: `unselected` → `selected`
- 색상 적용: `selected` → `applied` → `unselected`
- 색상 제거: `applied` → `unselected`

### 4. Marker
마커 정보 엔티티

```javascript
{
    pnu: String,                // 연결된 필지 PNU
    position: {
        lat: Number,
        lng: Number
    },
    isVisible: Boolean,         // 표시 상태
    hasInfo: Boolean,           // 정보 존재 여부
    infoFields: Array,          // ['memo', 'ownerName', ...] 존재하는 필드
    createdAt: Number,
    mode: String                // 생성된 모드
}
```

**Creation Rules**:
- 필지에 지번, 소유자명, 주소, 연락처, 메모 중 하나라도 있으면 생성
- 모든 정보가 삭제되면 마커도 자동 삭제
- 모드 전환 시 해당 모드의 마커만 표시

### 5. BackupState
백업 상태 관리 엔티티

```javascript
{
    lastBackup: {
        timestamp: Number,
        type: String,           // 'daily' | 'monthly' | 'manual'
        status: String,         // 'success' | 'failed'
        size: Number            // 백업 데이터 크기 (bytes)
    },
    retryState: {
        count: Number,          // 현재 재시도 횟수 (0-5)
        nextRetryTime: Number,  // 다음 재시도 시간
        failureReason: String   // 실패 이유
    },
    schedule: {
        daily: {
            enabled: Boolean,
            time: String        // '03:00' (새벽 3시)
        },
        monthly: {
            enabled: Boolean,
            day: Number,        // 1-31
            time: String
        }
    },
    storage: {
        local: {
            used: Number,       // bytes
            limit: Number       // bytes
        },
        cloud: {
            provider: String,   // 'supabase' | 'googledrive'
            used: Number,
            limit: Number
        }
    }
}
```

**Retry Logic**:
- 실패 시 10분 간격으로 최대 5회 재시도
- 5회 실패 시 사용자에게 수동 백업 요청 알림
- 성공 시 retry count 리셋

### 6. UserSession
사용자 세션 관리 엔티티

```javascript
{
    isAuthenticated: Boolean,
    googleAccount: {
        email: String,
        name: String,
        picture: String,
        accessToken: String,
        refreshToken: String,
        expiresAt: Number
    },
    permissions: {
        sheets: Boolean,
        calendar: Boolean,
        drive: Boolean
    },
    preferences: {
        defaultMode: String,    // 시작 모드
        autoBackup: Boolean,
        theme: String          // 'light' | 'dark'
    },
    sessionStartTime: Number,
    lastActivityTime: Number
}
```

## Data Flow

### 1. Mode Switching Flow
```
User Action → ModeManager → Save Current State → Switch Mode → Load New State → Update UI
```

### 2. Parcel Coloring Flow
```
Click Event → Check Mode → Get Color → Apply/Remove Color → Update Storage → Sync
```

### 3. Backup Flow
```
Trigger (Timer/Manual) → Collect Data → Try Backup → Success/Retry → Update State → Notify
```

## Storage Schema

### LocalStorage Keys
```javascript
{
    'currentMode': String,
    'clickModeData': JSON,
    'searchModeData': JSON,
    'parcelColors': JSON,       // Map of pnu -> colorIndex
    'markerStates': JSON,       // Map of pnu -> visibility
    'backupState': JSON,
    'userSession': JSON,
    'userPreferences': JSON
}
```

### Supabase Tables

#### parcels table
```sql
CREATE TABLE parcels (
    pnu VARCHAR PRIMARY KEY,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    parcel_name VARCHAR,
    owner_name VARCHAR,
    owner_address TEXT,
    owner_contact VARCHAR,
    memo TEXT,
    color_index INTEGER CHECK (color_index >= 0 AND color_index <= 7),
    mode VARCHAR CHECK (mode IN ('click', 'search')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_visible BOOLEAN DEFAULT true,
    geometry JSONB,
    version INTEGER DEFAULT 1,
    sync_status VARCHAR DEFAULT 'synced'
);
```

#### backup_history table
```sql
CREATE TABLE backup_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type VARCHAR CHECK (backup_type IN ('daily', 'monthly', 'manual')),
    backup_time TIMESTAMPTZ DEFAULT NOW(),
    data_size BIGINT,
    status VARCHAR CHECK (status IN ('success', 'failed', 'partial')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    user_id VARCHAR
);
```

## State Management Rules

### Invariants
1. 한 번에 하나의 모드만 활성화
2. 검색 모드 필지는 항상 보라색
3. 클릭 모드 필지는 8가지 색상 중 하나
4. 모드 전환 시 이전 모드 데이터는 보존
5. 백업 재시도는 최대 5회

### Consistency Rules
1. 필지 삭제 시 관련 마커도 삭제
2. 색상 제거 시 필지 정보도 초기화
3. 모드 전환 시 표시 상태 즉시 업데이트
4. 실시간 동기화는 로컬 우선, 충돌 시 최신 버전 우선

## Performance Considerations

### Indexing Strategy
- pnu를 primary key로 사용하여 빠른 조회
- mode 필드에 인덱스 추가로 모드별 필터링 최적화
- created_at, updated_at에 인덱스로 시간 기반 쿼리 최적화

### Caching Strategy
- 활성 모드 데이터는 메모리에 유지
- 비활성 모드 데이터는 LocalStorage에만 저장
- 뷰포트 밖 필지는 폴리곤만 임시 제거

### Data Limits
- 검색 결과 최대 1000개
- 전체 필지 최대 10,000개
- 백업 데이터 최대 100MB
- LocalStorage 사용량 5MB 제한