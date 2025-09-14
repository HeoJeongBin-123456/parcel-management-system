# Research Document: 필지 데이터 영속성 및 마커 표시 개선

## Research Summary
이 문서는 필지 색상 및 마커 데이터의 영속성 개선을 위한 기술적 조사 결과를 담고 있습니다.

## 1. Supabase 실시간 동기화와 로컬 저장소 충돌 해결

### Decision: Hybrid Sync Pattern with Conflict Resolution
Supabase를 주 저장소로, LocalStorage를 백업 및 오프라인 캐시로 사용하는 하이브리드 패턴 채택

### Rationale:
- 네트워크 연결 상태와 무관하게 즉시 저장 보장
- 충돌 발생 시 타임스탬프 기반 자동 해결
- 사용자 경험 저하 없이 백그라운드 동기화

### Implementation Details:
```javascript
// 저장 순서
1. LocalStorage 즉시 저장 (동기)
2. Supabase 비동기 저장 (백그라운드)
3. 충돌 시 last-write-wins 정책 적용
```

### Alternatives Considered:
- **Supabase-only**: 네트워크 의존성으로 인한 지연 문제
- **LocalStorage-only**: 다중 기기 동기화 불가
- **Event Sourcing**: 과도한 복잡성

## 2. 대량 필지 색상 데이터 효율적 저장 구조

### Decision: Indexed Color State Table
별도의 색상 상태 테이블을 생성하여 필지 ID로 인덱싱

### Rationale:
- 빠른 조회 성능 (O(1) lookup)
- 색상만 별도 업데이트 가능
- 히스토리 추적 가능

### Data Structure:
```javascript
{
  parcel_id: "unique_id",
  color: "#FF5733",
  is_colored: true,
  updated_at: "2025-01-14T10:00:00Z",
  updated_by: "user_session_id"
}
```

### Alternatives Considered:
- **Embedded in Parcel**: 전체 필지 데이터 업데이트 필요
- **JSON Blob**: 쿼리 성능 저하
- **Bitmap Index**: 색상 종류 제한

## 3. 마커 렌더링 성능 최적화

### Decision: Conditional Marker Rendering with Debouncing
조건 기반 선택적 렌더링과 디바운싱 적용

### Rationale:
- 뷰포트 내 마커만 렌더링
- 대량 업데이트 시 배치 처리
- 메모리 사용량 최소화

### Performance Targets:
- 초기 로드: < 500ms (100개 마커 기준)
- 개별 마커 추가: < 10ms
- 배치 업데이트: < 100ms (50개 동시)

### Optimization Techniques:
```javascript
// 1. Viewport-based rendering
if (isInViewport(marker)) { render(marker); }

// 2. Batch updates with requestAnimationFrame
requestAnimationFrame(() => {
  markers.forEach(marker => updateMarker(marker));
});

// 3. Marker pooling for reuse
const markerPool = new MarkerPool(maxSize: 200);
```

### Alternatives Considered:
- **Cluster Rendering**: UX 복잡성 증가
- **Virtual Scrolling**: 지도 인터페이스에 부적합
- **Canvas Rendering**: Naver Maps API 호환성 문제

## 4. 마커 생성 조건 확장

### Decision: Flexible Field-based Marker Trigger
필지 정보 필드 중 하나라도 값이 있으면 마커 생성

### Rationale:
- 직관적인 사용자 경험
- 유연한 조건 설정
- 확장 가능한 구조

### Marker Trigger Fields:
1. 지번 (parcel_number)
2. 소유자 이름 (owner_name)
3. 소유자 주소 (owner_address)
4. 연락처 (contact)
5. 메모 (memo)

### Implementation Logic:
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

### Alternatives Considered:
- **Memo-only**: 사용 시나리오 제한
- **All fields required**: 너무 엄격한 조건
- **Custom rules**: 설정 복잡성 증가

## 5. 색상 즉시 저장 메커니즘

### Decision: Optimistic UI with Background Sync
UI 즉시 업데이트 후 백그라운드 저장

### Rationale:
- 즉각적인 사용자 피드백
- 네트워크 지연 숨김
- 실패 시 자동 재시도

### Save Flow:
```javascript
1. UI 즉시 업데이트
2. LocalStorage 저장
3. Supabase 비동기 저장
4. 실패 시 큐에 추가 및 재시도
```

### Error Handling:
- 3회 재시도 with exponential backoff
- 실패 시 사용자 알림
- 오프라인 큐 유지

### Alternatives Considered:
- **Sync Save**: UI 블로킹 문제
- **Delayed Save**: 데이터 손실 위험
- **Manual Save**: 사용성 저하

## Technical Dependencies

### Required Libraries:
- @supabase/supabase-js: 2.57.4 (현재 사용 중)
- Naver Maps API v3 (현재 사용 중)

### New Dependencies:
없음 - 기존 라이브러리로 모두 구현 가능

## Performance Benchmarks

### Current State:
- 페이지 로드: ~2초 (100개 필지)
- 색상 변경: ~500ms (네트워크 포함)
- 마커 렌더링: ~1초 (50개)

### Target State:
- 페이지 로드: < 500ms
- 색상 변경: < 100ms (UI 업데이트)
- 마커 렌더링: < 200ms

## Risk Assessment

### High Priority:
1. **데이터 충돌**: 타임스탬프 기반 해결
2. **네트워크 실패**: 로컬 백업 및 재시도

### Medium Priority:
1. **성능 저하**: 디바운싱 및 배치 처리
2. **메모리 누수**: 마커 풀링 및 정리

### Low Priority:
1. **브라우저 호환성**: 폴리필 적용
2. **스토리지 한계**: 오래된 데이터 정리

## Conclusion

제안된 솔루션들은 현재 코드베이스와 호환되며, 최소한의 변경으로 요구사항을 충족합니다. 하이브리드 저장 전략과 조건부 마커 렌더링을 통해 안정성과 성능을 모두 확보할 수 있습니다.