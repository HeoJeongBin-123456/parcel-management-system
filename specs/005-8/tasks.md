# Tasks: 클릭 모드와 검색 모드 기반 필지 관리 시스템

**Input**: Design documents from `/specs/005-8/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- JavaScript files in `public/js/`
- CSS files in `public/css/`
- Test files in `tests/`
- Server files in repository root

## Phase 3.1: Setup & Preparation
- [ ] T001 백업 기존 parcel.js 파일 (public/js/parcel.backup.js)
- [ ] T002 [P] 새 CSS 파일 생성 및 기본 구조 설정 (public/css/modes.css)
- [ ] T003 [P] 테스트 디렉토리 구조 생성 (tests/integration/, tests/e2e/)
- [ ] T004 환경 변수 확인 및 설정 (.env 파일)

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T005 [P] Mode Management API 테스트 작성 (tests/contract/test_mode_management.spec.js)
- [ ] T006 [P] Color Management API 테스트 작성 (tests/contract/test_color_management.spec.js)
- [ ] T007 [P] Search Mode API 테스트 작성 (tests/contract/test_search_mode.spec.js)

### Integration Tests
- [ ] T008 [P] 클릭 모드 색상 토글 테스트 (tests/integration/test_click_mode_toggle.spec.js)
- [ ] T009 [P] 검색 모드 자동 전환 테스트 (tests/integration/test_search_auto_switch.spec.js)
- [ ] T010 [P] 모드 간 데이터 독립성 테스트 (tests/integration/test_mode_independence.spec.js)
- [ ] T011 [P] 새로고침 후 상태 유지 테스트 (tests/integration/test_persistence.spec.js)
- [ ] T012 [P] 백업 재시도 메커니즘 테스트 (tests/integration/test_backup_retry.spec.js)

### Performance Tests
- [ ] T013 2초 내 로딩 성능 테스트 (tests/e2e/test_loading_performance.spec.js)
- [ ] T014 대량 필지(1000개) 렌더링 테스트 (tests/e2e/test_bulk_rendering.spec.js)

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Mode System Core
- [ ] T015 ModeManager 클래스 구현 (public/js/mode-manager.js)
- [ ] T016 [P] ColorPaletteManager 클래스 구현 (public/js/color-palette.js)
- [ ] T017 [P] SearchModeManager 클래스 구현 (public/js/search-mode.js)

### UI Components
- [ ] T018 8가지 색상 팔레트 UI 컴포넌트 (public/js/color-palette.js에 통합)
- [ ] T019 모드 전환 버튼 UI 추가 (index.html 수정)
- [ ] T020 손 모양 커서 모드 UI 추가 (index.html 수정)
- [ ] T021 검색 모드 UI 개선 (index.html 수정)

### Data Management
- [ ] T022 모드별 상태 저장 로직 구현 (public/js/mode-manager.js에 통합)
- [ ] T023 LocalStorage 키 분리 및 관리 (public/js/mode-manager.js에 통합)
- [ ] T024 [P] Supabase 동기화 확장 (public/js/supabase-manager.js 수정)

### Parcel Enhancement
- [ ] T025 parcel.js에 8가지 색상 지원 추가 (public/js/parcel.js 수정)
- [ ] T026 토글 메커니즘 확장 (public/js/parcel.js 수정)
- [ ] T027 클릭 모드 전용 처리 로직 (public/js/parcel.js 수정)

### Search Mode Implementation
- [ ] T028 검색 모드 보라색 필지 처리 (public/js/search-mode.js에 통합)
- [ ] T029 검색 시 자동 모드 전환 (public/js/search-mode.js에 통합)
- [ ] T030 검색 필지 클릭 시 색상 제거 (public/js/search-mode.js에 통합)

## Phase 3.4: Integration & Enhancement

### Mode Switching
- [ ] T031 모드 전환 시 데이터 저장/로드 (public/js/mode-manager.js에 통합)
- [ ] T032 CSS 클래스 기반 표시/숨김 처리 (public/css/modes.css 수정)
- [ ] T033 모드별 이벤트 핸들러 관리 (public/js/mode-manager.js에 통합)

### Backup System Enhancement
- [ ] T034 백업 재시도 로직 구현 (public/js/backup-manager.js 수정)
- [ ] T035 [P] 수동 백업 알림 시스템 (public/js/backup-manager.js 수정)
- [ ] T036 [P] 백업 상태 UI 표시 (index.html 수정)

### Performance Optimization
- [ ] T037 지연 로딩 구현 (public/js/app-init.js 수정)
- [ ] T038 배치 렌더링 최적화 (public/js/parcel.js 수정)
- [ ] T039 [P] 뷰포트 기반 메모리 관리 (public/js/parcel.js 수정)

### Google Integration
- [ ] T040 [P] 구글 캘린더 연동 확장 (public/js/google-auth.js 수정)
- [ ] T041 [P] 비로그인 사용자 제한 처리 (public/js/google-auth.js 수정)

## Phase 3.5: Polish & Validation

### Error Handling
- [ ] T042 모드 전환 에러 처리 (public/js/mode-manager.js 수정)
- [ ] T043 데이터 충돌 해결 로직 (public/js/supabase-manager.js 수정)

### Documentation
- [ ] T044 [P] CLAUDE.md 업데이트 (CLAUDE.md 수정)
- [ ] T045 [P] README.md 새 기능 문서화 (README.md 수정)

### Final Testing
- [ ] T046 전체 통합 테스트 실행 (npm test)
- [ ] T047 quickstart.md 시나리오 검증
- [ ] T048 Chrome 122+ 호환성 확인

## Dependencies
- Setup (T001-T004) → Tests (T005-T014)
- Tests (T005-T014) → Implementation (T015-T041)
- T015 (ModeManager) → T022, T023, T031, T033
- T016 (ColorPalette) → T018
- T017 (SearchMode) → T028, T029, T030
- T025-T027 (parcel.js) 순차 실행 필요
- Implementation → Polish (T042-T048)

## Parallel Execution Examples

### 병렬 실행 가능 그룹 1: Contract Tests (T005-T007)
```bash
# 동시 실행 가능 - 서로 다른 파일
Task: "Mode Management API 테스트 작성 in tests/contract/test_mode_management.spec.js"
Task: "Color Management API 테스트 작성 in tests/contract/test_color_management.spec.js"
Task: "Search Mode API 테스트 작성 in tests/contract/test_search_mode.spec.js"
```

### 병렬 실행 가능 그룹 2: Integration Tests (T008-T012)
```bash
# 동시 실행 가능 - 독립적인 테스트 파일들
Task: "클릭 모드 색상 토글 테스트 in tests/integration/test_click_mode_toggle.spec.js"
Task: "검색 모드 자동 전환 테스트 in tests/integration/test_search_auto_switch.spec.js"
Task: "모드 간 데이터 독립성 테스트 in tests/integration/test_mode_independence.spec.js"
Task: "새로고침 후 상태 유지 테스트 in tests/integration/test_persistence.spec.js"
Task: "백업 재시도 메커니즘 테스트 in tests/integration/test_backup_retry.spec.js"
```

### 병렬 실행 가능 그룹 3: Core Managers (T016-T017)
```bash
# 동시 실행 가능 - 서로 다른 모듈
Task: "ColorPaletteManager 클래스 구현 in public/js/color-palette.js"
Task: "SearchModeManager 클래스 구현 in public/js/search-mode.js"
```

## Notes
- **중요**: parcel.js 수정 작업(T025-T027, T038-T039)은 순차적으로 실행
- **중요**: index.html 수정 작업(T019-T021, T036)은 순차적으로 실행
- **주의**: 기존 기능 유지하면서 점진적 통합
- **필수**: 각 작업 후 git commit으로 롤백 가능하도록 유지
- 사이드 이펙트 방지를 위해 모드별 이벤트 격리 필수

## Task Count Summary
- Setup: 4 tasks
- Tests: 10 tasks
- Core Implementation: 16 tasks
- Integration: 12 tasks
- Polish: 6 tasks
- **Total: 48 tasks**

## Validation Checklist
- [x] 모든 contract 파일에 대한 테스트 작업 생성됨
- [x] 모든 엔티티(ModeState, Parcel, ColorPalette, Marker, BackupState)에 대한 구현 작업 포함
- [x] 모든 테스트가 구현보다 먼저 실행되도록 순서 지정
- [x] 병렬 작업이 진정으로 독립적임 (다른 파일)
- [x] 각 작업이 정확한 파일 경로 지정
- [x] 같은 파일을 수정하는 작업은 [P] 표시 없음

---
*기능 복잡도를 고려하여 초기 예상(30-35개)보다 많은 48개 작업으로 세분화됨*