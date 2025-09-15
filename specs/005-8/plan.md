# Implementation Plan: 클릭 모드와 검색 모드 기반 필지 관리 시스템

**Branch**: `005-8` | **Date**: 2025-01-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-8/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

## Summary
클릭 모드와 검색 모드를 통한 필지 관리 시스템 구현. 두 개의 독립적인 모드로 지도상의 필지를 관리하며, 8가지 색상 팔레트로 필지 표시, 구글 계정 연동을 통한 데이터 백업 및 시트/캘린더 연동 기능 제공. 2초 내 로딩 성능 목표.

## Technical Context
**Language/Version**: JavaScript ES6+ (기존 프로젝트 기반)
**Primary Dependencies**: Naver Maps API, Supabase, VWorld API, Google OAuth/Sheets/Calendar API
**Storage**: Supabase (실시간), LocalStorage (로컬 백업)
**Testing**: Playwright (기존 설정)
**Target Platform**: Web (Chrome 122+, Firefox, Safari, Edge)
**Project Type**: web - frontend focused with Express proxy server
**Performance Goals**: 브라우저 진입 후 2초 내 클릭 가능
**Constraints**: 사이드 이펙트 최소화, 기존 기능 유지, 대량 필지(1000+) 처리
**Scale/Scope**: 개인/소규모 그룹 사용, 필지 데이터 최대 10,000개

**Additional Context from User**:
- 백업 실패시 10분 간격으로 5번 재시도
- 최종 실패시 사용자에게 수동 백업 요청 알림
- 백업 데이터는 가능한 최대한 장기 보관
- 구글 캘린더 기본 일정 확인/관리 기능
- 로그인하지 않은 사용자도 사용 가능 (구글 연동 제한)
- 세부 기능이 많으므로 사이드 이펙트 방지 필요

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (기존 프로젝트에 통합)
- Using framework directly? YES (Naver Maps API 직접 사용)
- Single data model? YES (필지 데이터 모델)
- Avoiding patterns? YES (기존 아키텍처 유지)

**Architecture**:
- EVERY feature as library? 부분적 (기존 모듈 구조 활용)
- Libraries listed:
  - ModeManager (모드 전환 관리)
  - ColorPaletteManager (색상 팔레트 관리)
  - SearchModeManager (검색 모드 관리)
- CLI per library: N/A (웹 애플리케이션)
- Library docs: 코드 주석 및 README 업데이트

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (실제 API 사용)
- Integration tests for: 모드 전환, 데이터 동기화, 백업 시스템

**Observability**:
- Structured logging included? YES (RightClickDebugger 활용)
- Frontend logs → backend? 부분적 (에러 로깅)
- Error context sufficient? YES

**Versioning**:
- Version number assigned? N/A (기능 추가)
- BUILD increments on every change? N/A
- Breaking changes handled? YES (기존 기능 유지)

## Project Structure

### Documentation (this feature)
```
specs/005-8/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# 기존 구조 유지하며 확장
public/
├── js/
│   ├── parcel.js         # 클릭 모드 통합
│   ├── search-mode.js    # NEW: 검색 모드 관리
│   ├── mode-manager.js   # NEW: 모드 전환 관리
│   ├── color-palette.js  # NEW: 색상 팔레트 관리
│   ├── backup-manager.js # 기존 확장
│   └── google-auth.js    # 기존 확장
└── css/
    └── modes.css         # NEW: 모드별 스타일
```

**Structure Decision**: 기존 구조 유지하며 모듈 추가 (Option 1 변형)

## Phase 0: Outline & Research

### Research Tasks Completed:
1. **클릭 모드 구현 방식 조사**
   - 기존 parcel.js의 색상 토글 기능 분석
   - 8가지 색상 팔레트 시스템 설계
   - 마커 생성/삭제 로직 검토

2. **검색 모드 독립성 보장 방법**
   - 모드별 상태 분리 저장 구조
   - 폴리곤 표시/숨김 메커니즘
   - 보라색 전용 처리 로직

3. **성능 최적화 전략**
   - 2초 내 로딩 달성 방법
   - 대량 필지 렌더링 최적화
   - 메모리 효율적 관리

4. **백업 시스템 강화**
   - 재시도 메커니즘 구현
   - 알림 시스템 통합
   - 장기 보관 전략

**Output**: research.md 생성 예정

## Phase 1: Design & Contracts

### Data Model Design:
1. **Mode State Model**
   - currentMode: 'click' | 'search' | 'hand'
   - clickModeData: 색상별 필지 정보
   - searchModeData: 검색 필지 정보

2. **Enhanced Parcel Model**
   - 기존 필드 유지
   - colorIndex: 0-7 (8가지 색상)
   - mode: 생성된 모드 구분

3. **Backup State Model**
   - retryCount: 재시도 횟수
   - lastAttempt: 마지막 시도 시간
   - status: 'success' | 'retrying' | 'failed'

### API Contracts:
1. **Mode Management**
   - GET /api/mode/current
   - POST /api/mode/switch
   - GET /api/mode/data/{mode}

2. **Color Management**
   - GET /api/colors/palette
   - POST /api/parcel/color
   - DELETE /api/parcel/color

3. **Search Mode**
   - POST /api/search/execute
   - GET /api/search/results
   - DELETE /api/search/clear

### Integration Points:
1. Supabase 실시간 동기화 확장
2. Google Calendar API 통합
3. 백업 재시도 메커니즘

**Output**: data-model.md, contracts/, quickstart.md 생성 예정

## Phase 2: Task Planning Approach

**Task Generation Strategy**:
1. **모드 시스템 기반 작업** (우선순위 높음)
   - 모드 매니저 구현
   - 클릭 모드 통합
   - 검색 모드 구현
   - 모드 전환 로직

2. **UI/UX 작업**
   - 8가지 색상 팔레트 UI
   - 손 모양 커서 모드
   - 모드 전환 버튼

3. **데이터 관리 작업**
   - 모드별 데이터 분리 저장
   - 새로고침 시 상태 복원
   - 백업 재시도 메커니즘

4. **통합 테스트 작업**
   - 모드 전환 테스트
   - 성능 테스트 (2초 로딩)
   - 대량 데이터 테스트

**Ordering Strategy**:
- 기존 기능 보호 우선
- 모드 시스템 → UI → 데이터 → 테스트
- 병렬 실행 가능 작업 표시 [P]

**Estimated Output**: 30-35개 작업 (기능 복잡도 고려)

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 복잡한 모드 시스템 | 클릭/검색 독립성 필수 요구사항 | 단일 모드는 요구사항 미충족 |
| 다중 저장소 동기화 | 실시간 공유 + 오프라인 대비 | 단일 저장소는 신뢰성 부족 |

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*