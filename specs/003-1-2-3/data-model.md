# Data Model: 필지 데이터 영속성 및 마커 표시 개선

## Overview
이 문서는 필지 색상 영속성과 마커 표시 조건 확장을 위한 데이터 모델을 정의합니다.

## Entity Definitions

### 1. Parcel (필지)
기본 필지 정보를 담는 핵심 엔티티

```javascript
{
  id: string,                    // 고유 식별자 (UUID)
  lat: number,                   // 위도
  lng: number,                   // 경도
  pnu: string,                   // 필지고유번호
  address: string,               // 주소
  parcel_number: string,         // 지번
  owner_name: string,            // 소유자 이름
  owner_address: string,         // 소유자 주소
  contact: string,               // 연락처
  memo: string,                  // 메모
  created_at: timestamp,         // 생성 시간
  updated_at: timestamp,         // 수정 시간
  session_id: string             // 세션 ID
}
```

### 2. ParcelColorState (필지 색상 상태)
필지의 색상 정보를 별도로 관리

```javascript
{
  parcel_id: string,             // 필지 ID (FK)
  color: string,                 // 색상 코드 (예: "#FF5733")
  is_colored: boolean,           // 색상 적용 여부
  color_index: number,           // 색상 인덱스 (0-9)
  applied_at: timestamp,         // 색상 적용 시간
  applied_by: string             // 적용한 사용자 세션
}
```

### 3. MarkerState (마커 상태)
마커 표시 여부를 결정하는 계산된 상태

```javascript
{
  parcel_id: string,             // 필지 ID
  should_display: boolean,       // 마커 표시 여부
  trigger_fields: string[],      // 마커 생성 트리거 필드들
  last_evaluated: timestamp      // 마지막 평가 시간
}
```

## Relationships

```
Parcel (1) ──── (1) ParcelColorState
   │
   └──── (1) MarkerState (computed)
```

## State Transitions

### Color State Transitions
```
UNCOLORED → COLORED: 사용자가 색상 선택
COLORED → UNCOLORED: 사용자가 색상 제거
COLORED → COLORED: 사용자가 다른 색상 선택
```

### Marker State Transitions
```
HIDDEN → VISIBLE: 필지 정보 입력 (지번/소유자명/주소/연락처/메모 중 하나)
VISIBLE → HIDDEN: 모든 필지 정보 삭제
VISIBLE → VISIBLE: 추가 정보 입력 (상태 유지)
```

## Validation Rules

### Parcel Validation
- `lat`: -90 ≤ lat ≤ 90
- `lng`: -180 ≤ lng ≤ 180
- `pnu`: 19자리 숫자 문자열
- `contact`: 전화번호 형식 (선택적)

### ColorState Validation
- `color`: 유효한 HEX 색상 코드 (#RRGGBB)
- `color_index`: 0 ≤ index ≤ 9
- `is_colored`: color가 있으면 true

### MarkerState Validation
- `should_display`: trigger_fields가 비어있지 않으면 true
- `trigger_fields`: ['parcel_number', 'owner_name', 'owner_address', 'contact', 'memo'] 중 값

## Indexes

### Database Indexes
```sql
-- Primary indexes
CREATE INDEX idx_parcel_id ON parcels(id);
CREATE INDEX idx_parcel_latlng ON parcels(lat, lng);

-- Color state indexes
CREATE INDEX idx_color_parcel ON parcel_color_states(parcel_id);
CREATE INDEX idx_color_colored ON parcel_color_states(is_colored);

-- Session indexes
CREATE INDEX idx_parcel_session ON parcels(session_id);
```

### LocalStorage Keys
```javascript
// Primary data
'parcelData': Array<Parcel>
'parcelColors': Map<parcel_id, ParcelColorState>

// Cache keys
'lastSync': timestamp
'pendingUpdates': Array<Update>
```

## Data Flow

### Save Flow
```
1. User Action (색상 선택/정보 입력)
    ↓
2. Update LocalStorage (즉시)
    ↓
3. Update UI (즉시)
    ↓
4. Queue Supabase Update (비동기)
    ↓
5. Confirm Save (성공/실패 처리)
```

### Load Flow
```
1. Page Load
    ↓
2. Check LocalStorage
    ↓
3. Render Cached Data
    ↓
4. Fetch from Supabase
    ↓
5. Merge & Update UI
```

## Computed Properties

### shouldShowMarker()
```javascript
function shouldShowMarker(parcel) {
  return !!(
    parcel.parcel_number ||
    parcel.owner_name ||
    parcel.owner_address ||
    parcel.contact ||
    parcel.memo
  );
}
```

### getMarkerTriggerFields()
```javascript
function getMarkerTriggerFields(parcel) {
  const fields = [];
  if (parcel.parcel_number) fields.push('parcel_number');
  if (parcel.owner_name) fields.push('owner_name');
  if (parcel.owner_address) fields.push('owner_address');
  if (parcel.contact) fields.push('contact');
  if (parcel.memo) fields.push('memo');
  return fields;
}
```

## Migration Strategy

### From Current Schema
```javascript
// 기존 데이터 마이그레이션
function migrateParcelData(oldParcel) {
  return {
    ...oldParcel,
    // 색상 상태 분리
    colorState: {
      parcel_id: oldParcel.id,
      color: oldParcel.selectedColor || null,
      is_colored: !!oldParcel.selectedColor,
      color_index: oldParcel.colorIndex || 0,
      applied_at: new Date().toISOString()
    }
  };
}
```

## Performance Considerations

### Caching Strategy
- LocalStorage: 최대 100개 최근 필지
- Memory: 현재 뷰포트 내 필지만
- Supabase: 전체 데이터 (페이지네이션)

### Update Batching
- 색상 변경: 즉시 적용
- 정보 업데이트: 500ms 디바운싱
- 벌크 작업: requestAnimationFrame 사용

## Security Considerations

### Data Validation
- 모든 입력 데이터 sanitize
- XSS 방지를 위한 HTML 이스케이핑
- SQL 인젝션 방지 (파라미터 바인딩)

### Session Management
- 세션별 데이터 격리
- 24시간 세션 타임아웃
- 세션 ID 암호화 저장