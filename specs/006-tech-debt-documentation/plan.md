# Implementation Plan: 기술 부채 문서화 시스템

**Branch**: `006-tech-debt-documentation` | **Date**: 2025-01-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-tech-debt-documentation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

프로젝트 헌법(Constitution)을 기반으로 현재 코드베이스의 위반 사항을 체계적으로 문서화하고, 개선 계획을 수립하며, 신규 기술 부채 발생을 자동 차단하는 시스템을 구축합니다.

**핵심 목표**:
1. 기술 부채 투명성 확보 - 개발자가 5분 내 위반 사항 3가지 파악 가능
2. 실행 가능한 개선 계획 수립 - 각 항목에 리팩토링 전략, 소요 시간, 담당자 명시
3. 예방적 품질 관리 - ESLint 규칙과 pre-commit hook으로 신규 부채 차단

**기술적 접근**:
- 마크다운 기반 문서(`TECHNICAL_DEBT.md`)로 기술 부채 추적 (git 버전 관리)
- Node.js 스크립트로 파일 크기, 하드코딩 패턴 자동 검증
- ESLint 커스텀 규칙으로 헌법 원칙 위반 감지

## Technical Context

**Language/Version**: JavaScript (Node.js 18+), Markdown
**Primary Dependencies**: ESLint 9.x, Glob pattern matching, Git hooks
**Storage**: Git repository (마크다운 파일), LocalStorage (없음 - 문서만 관리)
**Testing**: Playwright (스크립트 동작 검증), Manual validation (문서 품질)
**Target Platform**: macOS/Linux/Windows 개발 환경 (CLI 도구)
**Project Type**: single (문서 + 검증 스크립트)
**Performance Goals**: 전체 코드베이스 스캔 30초 이내 (2900줄 파일 기준), pre-commit hook 실행 3초 이내
**Constraints**:
- CI/CD 빌드 시간 30초 이상 증가 금지
- 외부 서비스 의존성 없음 (Jira, Notion 등 사용 금지)
- 마크다운 파일만 사용 (데이터베이스 불필요)
**Scale/Scope**:
- 현재 프로젝트 약 3,000줄 코드 스캔 대상
- 기술 부채 항목 약 10-20개 예상
- 월 1회 정기 리뷰

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Gate 1: Clean Code Principles
- **함수 길이 50줄 제한**: PASS - 검증 스크립트는 단순 유틸리티 함수로 구성 (각 20-30줄 예상)
- **단일 책임 원칙**: PASS - `scanCodebase()`, `validateFile()`, `generateReport()` 등 명확한 책임 분리
- **중첩 depth 3단계**: PASS - 파일 스캔 로직에 중첩 최소화 (flat map 사용)

### ✅ Gate 2: No Hard Coding
- **설정값 분리**: PASS - 파일 크기 제한(500줄), 스캔 대상 경로 등을 `config.js`에 정의
- **매직 넘버 금지**: PASS - `MAX_FILE_LINES = 500`, `SCAN_TIMEOUT_MS = 30000` 등 상수 선언

### ✅ Gate 3: Code Reusability
- **중복 로직 방지**: PASS - 파일 읽기, 줄 수 계산 등 재사용 가능한 유틸 함수로 분리
- **기존 함수 재사용**: PASS - Node.js 내장 `fs`, `path` 모듈 활용

### ✅ Gate 4: Clear Naming Conventions
- **함수명 명확성**: PASS - `scanForHardcodedSecrets()`, `checkFileSize()`, `generateDebtReport()`
- **변수명 camelCase**: PASS - `violationItems`, `scanResults`, `configSettings`

### ✅ Gate 5: Consistent Coding Style
- **ESLint 적용**: PASS - 프로젝트 기존 ESLint 설정 준수
- **2 스페이스 들여쓰기**: PASS - Prettier 포맷터 사용

### ✅ Gate 6: Production Quality Standards
- **에러 핸들링**: PASS - 파일 읽기 실패, 권한 오류 등 예외 처리 포함
- **성능 목표**: PASS - 비동기 병렬 스캔으로 3000줄 코드베이스 30초 내 완료
- **보안 고려**: PASS - API 키 패턴 검색만 수행, 실제 키 노출 없음

**최종 판정**: ✅ **모든 게이트 통과** - Phase 0로 진행 가능

---

## Post-Phase 1 Re-evaluation

*Phase 1 design artifacts complete. Re-checking constitution compliance.*

### Design Review
- **data-model.md**: 5개 엔티티 정의, 모두 명확한 책임 분리 ✅
- **contracts/cli-interface.md**: CLI 명령어 5개, 각각 단일 책임 원칙 준수 ✅
- **quickstart.md**: 5분 quickstart 가이드, 실행 가능성 검증 ✅

### Complexity Assessment
- **파일 수**: 약 10개 (config, scanner, validators, reporters, utils) - 적정 수준
- **함수 길이**: 평균 20-30줄 예상, 50줄 제한 준수 가능
- **의존성**: Node.js 내장 모듈 + ESLint (이미 설치됨), 새 의존성 최소화

### Final Verdict
**✅ 모든 헌법 게이트 통과 유지** - Phase 2 (tasks 생성)로 진행 가능

**추가 고려사항 없음** - 설계 단계에서 복잡도 증가 없음

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
/Users/ai-code-lab/projects/parcel-management-system/
├── TECHNICAL_DEBT.md           # 기술 부채 문서 (메인 산출물)
├── lib/
│   └── tech-debt/              # 검증 스크립트 모음
│       ├── config.js           # 설정 (파일 크기 제한, 스캔 경로 등)
│       ├── scanner.js          # 코드베이스 스캔 메인 로직
│       ├── validators/
│       │   ├── file-size.js    # 파일 크기 검증
│       │   ├── hardcoding.js   # 하드코딩 패턴 검출
│       │   └── naming.js       # 네이밍 컨벤션 검증
│       ├── reporters/
│       │   └── markdown.js     # 마크다운 리포트 생성
│       └── utils/
│           ├── file-reader.js  # 파일 읽기 유틸
│           └── git-integration.js # git 변경 이력 분석
├── .eslintrc.js                # 헌법 위반 ESLint 규칙 추가
├── .husky/                     # Git hooks
│   └── pre-commit              # 커밋 전 검증 스크립트
└── tests/
    └── tech-debt/              # 스크립트 테스트
        ├── scanner.spec.js
        └── validators.spec.js
```

**Structure Decision**:
- **문서 위치**: 프로젝트 루트에 `TECHNICAL_DEBT.md` 배치 (가시성 최대화)
- **스크립트 위치**: `lib/tech-debt/` 디렉토리에 모듈화된 검증 로직 배치
- **기존 구조 활용**: 현재 프로젝트의 `lib/`, `tests/` 구조 재사용
- **Git hooks**: `.husky/` 사용 (프로젝트에 이미 존재하는 경우 재사용, 없으면 생성)

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

