# Feature Specification: 메모-마커 동기화 버그 수정

**Status**: Bug Fix
**Priority**: High
**Affected Component**: Memo Marker Rendering System
**Date**: 2025-10-16

---

## Executive Summary

새로고침 시 메모가 있는 필지의 마크표시(메모 마커)가 일관되게 표시되지 않는 버그를 수정합니다. 메모 데이터는 LocalStorage에 정상 저장되어 있으나, `MemoMarkerManager.loadAllMemoMarkers()` 함수 실행 중 지도 로드 타이밍, 초기화 플래그 상태, 마커 상태 복구 로직의 세 가지 동기화 문제로 인해 마커가 생성되지 않습니다.

---

## Problem Statement

### 발생 현상
1. 필지에 메모 입력 후 저장 → 마크표시 정상 표시 ✅
2. 페이지 새로고침 수행 → 마크표시 미표시 또는 불안정 ❌
3. 페이지 다시 조작 → 마크표시 재표시 ✅

**예시**: 940-26번지 (또는 메모가 있는 다른 필지)에는 메모가 저장되어 있으나 마크표시가 표시되지 않음

### 데이터 저장 상태 (실제 확인)
- **Supabase `parcels` 테이블**: 메모 데이터 거의 없음 (검색 결과 0개)
- **LocalStorage**: 메모 필지 데이터 정상 저장됨
  - `parcelData`: 필지 정보 배열
  - `parcelColors`: 색상 정보 맵
  - `markerStates`: 마커 표시 상태 플래그
- **메모 마커 생성 조건**: 5가지 중 하나라도 만족하면 마커 생성

### 근본 원인 분석

#### 1. 메모-마커 생성 조건 (정상 작동 ✅)

**memo-markers.js: `shouldShowMarker(parcelData)`**
```javascript
// 마커 표시 조건: 다음 5가지 중 하나라도 존재
1. memo (메모 텍스트)
2. owner_name (소유자명)
3. owner_address (소유자 주소)
4. owner_contact (연락처)
5. parcel_name (지번)
```

#### 2. 새로고침 시 마커 로드 흐름 (문제 지점 확인됨)

**app-init.js: Line 1383**
```
Page Load → SupabaseManager.initialize()
          → MemoMarkerManager.initialize()
            ├─ isInitialized/isInitializing 플래그 체크
            ├─ window.map 존재 여부 확인
            └─ Map 없으면 interval로 20초간 대기
               └─ Map 로드되면 loadAllMemoMarkers() 실행
```

**memo-markers.js: `loadAllMemoMarkers()`**
```
1. LocalStorage에서 필지 검색
   ├─ parcelData (모든 필지)
   ├─ parcelColors (색상 정보)
   └─ markerStates (마커 표시 상태)

2. shouldShowMarker() 조건 확인
   └─ 5가지 조건 중 하나 만족 시 마커 생성

3. createMemoMarker() 호출
   ├─ isDeleted 플래그 확인
   ├─ 삭제된 필지 목록 확인
   └─ 마커 Map에 추가
```

#### 3. 식별된 버그 (3가지)

**Bug#1: 초기화 중복 진입 방지 미흡**
- `initialize()` 호출 시 `isInitializing` 플래그 설정 (Line 61)
- 하지만 `loadAllMemoMarkers()` 호출 후 `isInitialized = true` 설정 (Line 91)
- 이 사이에 마커 조회 요청이 오면 `loadAllMemoMarkers()` 재실행 가능성

**Bug#2: 지도 로드 타이밍 미스**
- 지도 로드 대기 시간: 20초 (40 × 500ms)
- 지도 로드 직후 마커 생성 시작
- 이 시점에 Supabase 실시간 구독(onUpdate) 콜백이 동시 실행될 수 있음
- 두 프로세스가 동일한 마커 Map에 동시 접근 → 데이터 불일치

**Bug#3: 마커 상태 복구 로직 누락**
- `markerStates` (LocalStorage)에 마커 표시/비표시 정보 저장됨
- 하지만 `loadAllMemoMarkers()` 함수에서 이 상태를 읽지 않음
- 마커 생성 후 기존 상태를 복구하지 않아 표시 상태가 초기화됨

---

## Affected Users

- **대상**: 메모가 있는 필지를 조회한 모든 사용자
- **빈도**: 매번 새로고침 시 발생 (100% 재현율)
- **심각도**: 높음 - 메모의 가시성 완전 상실
- **영향 범위**: 필지 메모 기능 전체

---

## Functional Requirements

### FR-001: 마커 생성 후 초기화 플래그 정확히 관리
`loadAllMemoMarkers()` 완료 후에만 `isInitialized` 플래그를 설정하여 중복 초기화를 완벽히 방지해야 한다.

**Acceptance Criteria**:
- [ ] `isInitialized` 플래그는 모든 마커 로드 완료 후에만 설정
- [ ] `isInitializing` 플래그는 `loadAllMemoMarkers()` 실행 중에만 유지
- [ ] 5회 연속 새로고침에서 `loadAllMemoMarkers()`는 정확히 1회만 호출

### FR-002: 지도 로드와 마커 생성의 원자성 보장
지도 로드 완료부터 마커 생성 완료까지의 과정을 보호하여 다른 업데이트와의 동시 실행을 방지해야 한다.

**Acceptance Criteria**:
- [ ] 마커 생성 중 Supabase 실시간 업데이트는 대기 또는 무시
- [ ] 마커 생성 후 Supabase 업데이트 처리
- [ ] 마커 중복 생성 0회 (5회 새로고침)

### FR-003: LocalStorage의 마커 상태를 복구
`markerStates`에 저장된 마커 표시 상태를 로드 시 복구하여 사용자가 설정한 마커 표시/비표시를 유지해야 한다.

**Acceptance Criteria**:
- [ ] `loadAllMemoMarkers()` 실행 시 `markerStates`에서 표시 상태 읽기
- [ ] 표시 상태가 false인 마커는 생성 후 즉시 숨기기
- [ ] 사용자가 토글한 마커 상태가 새로고침 후에도 동일

### FR-004: 로깅 강화로 디버깅 용이성 증대
마커 생성 과정의 각 단계를 로깅하여 향후 이슈 재현 시 원인 파악을 쉽게 해야 한다.

**Acceptance Criteria**:
- [ ] `initialize()` 호출 시작/완료 로깅
- [ ] `loadAllMemoMarkers()` 호출 시작/완료 로깅
- [ ] 각 마커 생성/건너뛰기 이유 로깅
- [ ] Supabase 업데이트 충돌 감지 시 경고 로깅

---

## User Scenarios & Testing

### Scenario 1: 단순 메모 저장 후 새로고침
```
Given: 필지 1개에 메모를 입력 저장
When:  페이지 새로고침
Then:
  - 메모가 조회됨
  - 마크표시(M)가 필지 위에 표시됨
  - 마크 클릭 시 메모 내용 확인 가능
```

**테스트 스텝**:
1. 지도에서 임의 필지 클릭
2. 메모 입력 필드에 "테스트 메모 작성"입력
3. 저장 버튼 클릭
4. 메모 저장 확인 (콘솔: "✅ 필지 저장 완료")
5. F5 또는 Ctrl+R로 새로고침
6. 필지 위에 마크표시 확인 (콘솔: "✅ 마커 생성" 확인)
7. 마크 클릭하여 메모 확인

**기대 결과**: 마크표시가 안정적으로 표시되고 메모 조회 가능

---

### Scenario 2: 다중 필지 메모 저장 후 새로고침
```
Given: 3개 필지에 메모 저장
When:  페이지 새로고침
Then:
  - 모든 필지의 마크표시가 정확히 표시됨
  - 마크표시 개수 = 메모 있는 필지 개수
  - 중복 마크 없음
```

**테스트 스텝**:
1. 3개의 서로 다른 필지 클릭
2. 각각 메모 입력 및 저장 (메모1, 메모2, 메모3)
3. 새로고침 수행
4. 개발자 도구 콘솔 확인:
   - `MemoMarkerManager.markers.size` === 3
   - 각 마커 로그 확인
5. 화면에서 3개 마크표시 시각적 확인

**기대 결과**: 정확히 3개의 마크만 표시, 중복 없음

---

### Scenario 3: 마커 토글 후 새로고침
```
Given: 메모 필지의 마크표시가 표시 상태
When:  마크 클릭으로 숨김 → 새로고침
Then:  마크표시가 숨겨진 상태 유지
```

**테스트 스텝**:
1. 메모 있는 필지 확인 및 마크표시 시각적 확인
2. 마크표시 클릭하여 숨김
3. LocalStorage 확인: `markerStates[pnu] === false`
4. 새로고침 수행
5. 마크표시 숨겨진 상태 확인

**기대 결과**: 마커 표시 상태가 새로고침 후에도 유지됨

---

## Success Criteria

### SC-001: 100% 마커 표시 안정성
새로고침 후 메모가 있는 모든 필지의 마커가 안정적으로 표시되어야 한다.

- **Metric**: 5회 새로고침 중 마커 미표시 없음
- **Target**: 100% 성공률 (0회 실패)
- **Verification**: 화면 녹화 또는 콘솔 로그 분석

### SC-002: 마커 생성 원자성
마커 생성 중 다른 업데이트가 마커 상태를 손상시키지 않아야 한다.

- **Metric**: 마커 중복 생성 횟수 = 0
- **Target**: 5회 새로고침 중 중복 생성 0회
- **Verification**: 개발자 도구에서 `MemoMarkerManager.markers.size` 확인

### SC-003: 마커 상태 일관성
사용자가 설정한 마커 표시/비표시 상태가 새로고침 후에도 유지되어야 한다.

- **Metric**: LocalStorage 상태 ===  화면 표시 상태
- **Target**: 100% 일치
- **Verification**: 마킹 토글 후 새로고침 테스트

### SC-004: 성능 영향 없음
버그 수정으로 인한 성능 저하가 없어야 한다.

- **Metric**: 새로고침 시간
- **Target**: < 2초 (메모 10개 기준)
- **Verification**: Chrome DevTools Performance 탭 측정

---

## Key Entities & Data Model

### MemoMarkerManager (메모 마커 관리자)
```javascript
{
  markers: Map<pnu, {marker: Marker, data: ParcelData}>,
  isInitialized: boolean,           // ← FR-001에서 수정 필요
  isInitializing: boolean,          // ← FR-001에서 강화 필요
  shouldShowMarker(parcelData): boolean,
  loadAllMemoMarkers(): Promise<void>,
  createMemoMarker(parcelData): Promise<void>,
  cleanupDuplicateMarkers(): void
}
```

### LocalStorage Keys
```javascript
{
  parcelData: ParcelData[],         // 필지 정보
  markerStates: {[pnu]: boolean},   // ← FR-003에서 사용 필요
  parcelColors: {[pnu]: string},    // 색상 정보
}
```

---

## Scope

### In Scope ✅
- 새로고침 시 메모 마커 안정적 렌더링 보장
- 마커 생성 중복 방지
- 마커 표시 상태 복구 로직 추가
- 초기화 플래그 관리 개선
- 로깅 강화

### Out of Scope ❌
- 마커 디자인/스타일 변경
- Supabase 실시간 구독 전체 리팩토링
- 메모 기능 자체 개선 (검색, 필터 등)
- 성능 최적화 (별도 사안)

---

## Assumptions

1. **LocalStorage 가용성**: 모든 브라우저에서 LocalStorage 사용 가능
2. **메모 저장 정확성**: 메모 저장 시 LocalStorage 기록은 정확함
3. **지도 로드 신뢰성**: window.map 객체는 지도 로드 시 반드시 설정됨
4. **마커 상태 저장**: markerStates는 마커 토글 시 즉시 저장됨
5. **브라우저 호환성**: Chrome, Firefox, Safari 지원

---

## Dependencies

- **memo-markers.js**: 마커 관리 클래스 (수정 대상)
- **parcel.js**: 메모 저장/조회 로직
- **app-init.js**: MemoMarkerManager 초기화 코드
- **supabase-config.js**: Supabase 실시간 구독 (동시성 고려)

---

## Known Limitations

1. **LocalStorage 용량**: 5MB 제한 (메모 데이터량 증가 시 주의)
2. **지도 로드 지연**: 20초 타임아웃 설정 (느린 네트워크에서 마커 미표시 가능)
3. **동시 업데이트**: Supabase 실시간 구독과 마커 생성이 동시에 발생하면 마커 누락 가능

---

## Implementation Notes

### 마커 생성 흐름 다이어그램
```
페이지 로드
    ↓
app-init.js: MemoMarkerManager.initialize()
    ↓
window.map 대기 (최대 20초)
    ↓
지도 로드됨 → loadAllMemoMarkers() 실행
    ↓
[FR-001] isInitializing = true
    ↓
LocalStorage에서 메모 필지 검색
    ↓
[FR-003] markerStates에서 표시 상태 읽기
    ↓
shouldShowMarker() 조건 확인
    ↓
각 필지별 마커 생성 또는 건너뛰기
    ↓
[FR-001] isInitialized = true, isInitializing = false
    ↓
마커 로드 완료
```

---

## Related Documentation

- **CLAUDE.md**: 메모-마커 시스템 아키텍처 설명
- **memo-markers.js**: 마커 관리 코드 (52KB)
- **app-init.js**: 초기화 시퀀스 (1660줄)

---

**Specification Version**: 2.0 (Direct Analysis)
**Last Updated**: 2025-10-16 16:30 UTC
**Analysis Method**: Direct Supabase + Code Inspection
