# Tasks: 필지 데이터 영속성 및 마커 표시 개선

**Input**: Design documents from `/specs/003-1-2-3/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Loaded - JavaScript ES6+, Naver Maps API, Supabase, Express.js
   → Structure: Web application (public/js/, server.js)
2. Load optional design documents:
   → ✅ data-model.md: Parcel, ParcelColorState, MarkerState entities
   → ✅ contracts/: 3 API contracts (color, marker, realtime)
   → ✅ research.md: Technical decisions loaded
   → ✅ quickstart.md: 6 test scenarios defined
3. Generate tasks by category:
   → Setup: 색상 저장 시스템 초기화
   → Tests: Contract tests, integration tests, E2E tests
   → Core: 데이터 모델, 영속성 매니저, 마커 시스템
   → Integration: Supabase 실시간 동기화, LocalStorage 백업
   → Polish: 성능 최적화, 문서화
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T028)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests? ✅
   → All entities have models? ✅
   → All endpoints implemented? ✅
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Frontend**: `public/js/` (브라우저 JavaScript)
- **Backend**: `server.js`, `api/` (Express proxy)
- **Tests**: `tests/integration/`, `tests/e2e/`

## Phase 3.1: Setup
- [ ] T001 Create data persistence manager module structure in public/js/data-persistence-manager.js
- [ ] T002 Update LocalStorage schema for color states and marker conditions
- [ ] T003 [P] Add color state table structure to Supabase database

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T004 [P] Contract test POST /api/parcels/{id}/color in tests/integration/parcel-color-api.spec.js
- [ ] T005 [P] Contract test GET /api/parcels/with-colors in tests/integration/parcel-color-query.spec.js
- [ ] T006 [P] Contract test GET /api/parcels/with-markers in tests/integration/marker-api.spec.js
- [ ] T007 [P] Contract test WebSocket realtime sync in tests/integration/realtime-sync.spec.js

### Integration Tests
- [ ] T008 [P] Integration test 색상 즉시 저장 (<100ms) in tests/integration/color-immediate-save.spec.js
- [ ] T009 [P] Integration test 마커 생성 조건 확장 in tests/integration/marker-conditions.spec.js
- [ ] T010 [P] Integration test LocalStorage-Supabase 동기화 in tests/integration/storage-sync.spec.js

### E2E Tests
- [ ] T011 [P] E2E test 새로고침 후 색상 유지 in tests/e2e/refresh-color-retention.spec.js
- [ ] T012 [P] E2E test 마커 표시 조건 변경 in tests/e2e/marker-display-conditions.spec.js
- [ ] T013 [P] E2E test 대량 데이터 성능 (100개 필지) in tests/e2e/bulk-performance.spec.js

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models & Storage
- [ ] T014 [P] Implement ParcelColorState model in public/js/models/parcel-color-state.js
- [ ] T015 [P] Implement MarkerState evaluator in public/js/models/marker-state.js
- [ ] T016 Implement DataPersistenceManager core in public/js/data-persistence-manager.js

### Color Management System
- [ ] T017 Add immediate color save logic to parcel.js (applyColorToParcel 함수 수정)
- [ ] T018 Implement color state restoration on page load in parcel.js (initializeColors 함수)
- [ ] T019 Add LocalStorage color persistence layer in public/js/storage/local-color-storage.js

### Marker System Enhancement
- [ ] T020 Extend marker creation conditions in public/js/memo-markers.js (shouldShowMarker 함수)
- [ ] T021 Update marker evaluation logic for all fields in public/js/memo-markers.js
- [ ] T022 Implement marker state persistence in public/js/memo-markers.js

## Phase 3.4: Integration

### Supabase Synchronization
- [ ] T023 Connect color state to Supabase realtime in public/js/supabase-adapter.js
- [ ] T024 Implement conflict resolution with timestamps in public/js/supabase-adapter.js
- [ ] T025 Add retry mechanism with exponential backoff in public/js/supabase-adapter.js

### API Endpoints (Optional - if backend needed)
- [ ] T026 Implement POST /api/parcels/{id}/color endpoint in server.js
- [ ] T027 Implement GET /api/parcels/with-colors endpoint in server.js

## Phase 3.5: Polish
- [ ] T028 [P] Performance optimization: viewport-based marker rendering in public/js/memo-markers.js
- [ ] T029 [P] Add debouncing for batch color updates in public/js/data-persistence-manager.js
- [ ] T030 [P] Memory leak prevention: marker pooling in public/js/memo-markers.js
- [ ] T031 Update CLAUDE.md with new color persistence architecture
- [ ] T032 Run quickstart.md validation scenarios

## Dependencies
- Setup (T001-T003) enables all other tasks
- Tests (T004-T013) MUST complete before implementation (T014-T027)
- T014-T015 (models) before T016 (persistence manager)
- T016 before T017-T019 (color system)
- T020-T022 (markers) can run parallel to T017-T019
- T023-T025 (Supabase) requires T016
- T026-T027 (API) optional, can be parallel
- Polish (T028-T032) after all implementation

## Parallel Execution Examples

### Launch all contract tests together (T004-T007):
```javascript
Task: "Contract test POST /api/parcels/{id}/color"
Task: "Contract test GET /api/parcels/with-colors"
Task: "Contract test GET /api/parcels/with-markers"
Task: "Contract test WebSocket realtime sync"
```

### Launch all integration tests together (T008-T010):
```javascript
Task: "Integration test 색상 즉시 저장 (<100ms)"
Task: "Integration test 마커 생성 조건 확장"
Task: "Integration test LocalStorage-Supabase 동기화"
```

### Launch E2E tests together (T011-T013):
```javascript
Task: "E2E test 새로고침 후 색상 유지"
Task: "E2E test 마커 표시 조건 변경"
Task: "E2E test 대량 데이터 성능"
```

### Launch model implementations together (T014-T015):
```javascript
Task: "Implement ParcelColorState model"
Task: "Implement MarkerState evaluator"
```

## Notes
- 🔴 Tests MUST fail first (TDD strict enforcement)
- ⚡ Performance critical: color save < 100ms, page load < 500ms
- 🔒 Data integrity: always save to LocalStorage first
- 🔄 Realtime sync: handle conflicts with timestamps
- 📍 Marker conditions: any field triggers display (not just memo)

## Task Generation Rules Applied
1. **From Contracts** (3 files):
   - parcel-color-api.json → T004, T005, T026, T027
   - marker-api.json → T006
   - realtime-sync.json → T007, T023-T025

2. **From Data Model** (3 entities):
   - ParcelColorState → T014
   - MarkerState → T015
   - Persistence layer → T016

3. **From Quickstart** (6 scenarios):
   - 색상 즉시 저장 → T008
   - 새로고침 색상 유지 → T011
   - 마커 조건 확장 → T009, T012
   - 대량 데이터 성능 → T013
   - 오프라인 모드 → T010

4. **From Research Decisions**:
   - Hybrid sync pattern → T023-T025
   - Viewport rendering → T028
   - Marker pooling → T030

## Validation Checklist
- ✅ All 3 contracts have corresponding tests (T004-T007)
- ✅ All 3 entities have model tasks (T014-T016)
- ✅ All tests come before implementation (Phase 3.2 before 3.3)
- ✅ Parallel tasks truly independent (different files)
- ✅ Each task specifies exact file path
- ✅ No [P] task modifies same file as another [P] task
- ✅ Performance targets specified (100ms, 500ms)
- ✅ Quickstart scenarios covered (6/6)