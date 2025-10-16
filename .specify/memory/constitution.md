<!--
Sync Impact Report
==================
Version Change: [Not versioned] → 1.0.0
Modified Principles: N/A (initial version)
Added Sections:
  - Core Principles (6 principles: Clean Code, No Hard Coding, Code Reusability, Clear Naming, Consistent Style, Production Quality)
  - Development Standards
  - Quality Assurance
  - Governance

Templates Status:
  ✅ plan-template.md - Constitution Check section aligned
  ✅ spec-template.md - Requirements section aligned
  ✅ tasks-template.md - Quality standards integrated

Follow-up TODOs: None
Rationale: Initial constitution establishment with 6 core principles provided by user
-->

# Parcel Management System Constitution

## Core Principles

### I. Clean Code Principles
모든 코드는 읽기 쉽고 이해하기 쉬워야 합니다. 함수는 단일 책임을 가지며, 복잡한 로직은 작은 단위로 분해되어야 합니다. 주석은 "무엇을"이 아닌 "왜"를 설명합니다.

**Rationale**: 유지보수 비용을 최소화하고 팀 협업 효율성을 극대화하기 위해 코드의 가독성과 명확성이 필수적입니다.

**Non-Negotiable Rules**:
- 함수는 하나의 책임만 가져야 함 (Single Responsibility Principle)
- 중첩 depth는 최대 3단계까지 허용
- 함수 길이는 50줄을 넘지 않도록 권장
- 의미 없는 주석 금지 (코드가 스스로 설명되어야 함)

### II. No Hard Coding
설정값, API 키, URL, 매직 넘버 등은 절대 하드코딩하지 않습니다. 환경 변수, 설정 파일, 상수 선언을 통해 관리합니다.

**Rationale**: 환경별 배포 유연성 확보, 보안 강화, 유지보수 용이성 향상이 필요합니다.

**Non-Negotiable Rules**:
- API 키와 시크릿은 반드시 `.env` 파일 또는 환경 변수로 관리
- 매직 넘버는 명명된 상수로 선언 (예: `const MAX_RETRY_COUNT = 3`)
- URL은 설정 파일에 분리 (`config.js`, `constants.js` 등)
- 하드코딩 발견 시 코드 리뷰 단계에서 반려

### III. Code Reusability
동일하거나 유사한 로직이 반복될 경우 재사용 가능한 함수나 모듈로 추출합니다. 기존에 구현된 함수가 있다면 새로 만들지 않고 재사용합니다.

**Rationale**: DRY (Don't Repeat Yourself) 원칙을 준수하여 코드 중복을 최소화하고 버그 수정 시 일관성을 유지합니다.

**Non-Negotiable Rules**:
- 동일 로직이 2회 이상 반복되면 함수화 필수
- 새 함수 작성 전 기존 유틸리티 함수 검색 필수
- 공통 로직은 `lib/`, `utils/`, `shared/` 디렉토리에 위치
- 재사용 가능한 함수는 순수 함수로 작성 권장

### IV. Clear Naming Conventions
변수명, 함수명, 파일명은 명확하고 일관되게 작성합니다. 이름만 보고도 목적과 역할을 파악할 수 있어야 합니다.

**Rationale**: 코드 이해 속도를 높이고 오해의 여지를 제거하여 버그를 사전에 방지합니다.

**Non-Negotiable Rules**:
- 변수명: camelCase 사용 (예: `userProfileData`, `isLoading`)
- 함수명: 동사로 시작 (예: `fetchUserData`, `validateInput`)
- 상수명: UPPER_SNAKE_CASE 사용 (예: `MAX_RETRY_COUNT`, `API_BASE_URL`)
- Boolean 변수는 `is`, `has`, `should` 접두사 사용
- 약어 사용 금지 (예: `usr` ❌ → `user` ✅)
- 단일 문자 변수는 반복문 인덱스(`i`, `j`) 외 금지

### V. Consistent Coding Style
프로젝트 전체에서 일관된 코딩 스타일을 유지합니다. 들여쓰기, 세미콜론, 따옴표 사용 규칙 등을 통일합니다.

**Rationale**: 스타일 일관성은 코드 리뷰 효율성을 높이고 팀 내 마찰을 줄입니다.

**Non-Negotiable Rules**:
- ESLint 설정을 프로젝트에 포함하고 모든 코드에 적용
- Prettier 또는 동등한 포맷터 사용 강제
- 들여쓰기: 2 스페이스 (탭 금지)
- 문자열: 싱글 쿼트(`'`) 사용 (템플릿 리터럴 제외)
- 세미콜론: 명시적 사용
- 모든 PR은 린트 검사 통과 필수

### VI. Production Quality Standards
모든 코드는 프로덕션 환경에서 안정적으로 동작할 수 있는 품질을 갖춰야 합니다. 에러 처리, 성능 최적화, 보안 고려가 필수입니다.

**Rationale**: 사용자 경험 보장, 시스템 안정성 확보, 유지보수 비용 감소가 목표입니다.

**Non-Negotiable Rules**:
- 모든 외부 API 호출은 에러 핸들링 필수 (try-catch 또는 .catch())
- 사용자 입력은 검증(validation) 필수
- 로딩 상태와 에러 상태는 UI에 명확히 표시
- 성능: 주요 API 응답 시간 2초 이내 목표
- 보안: XSS, SQL Injection 등 기본 공격 방어 로직 포함
- 브라우저 콘솔에 불필요한 경고/에러 로그 제거

## Development Standards

### Code Organization
- **모듈화**: 관련 기능은 하나의 모듈/파일로 그룹화
- **파일 크기**: 단일 파일은 500줄을 넘지 않도록 권장 (현재 `parcel.js` 59KB는 리팩토링 대상)
- **디렉토리 구조**: `public/js/`, `lib/`, `tests/` 구조 유지
- **의존성 관리**: `package.json`에 모든 의존성 명시

### Version Control
- **커밋 메시지**: Conventional Commits 형식 사용 (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)
- **브랜치 전략**: `main` 브랜치는 항상 배포 가능한 상태 유지
- **PR 요구사항**: 코드 리뷰 1명 이상 승인 필수

### Testing Requirements
- **Playwright 테스트**: UI 변경 시 화면 캡처 및 로그 확인 필수
- **테스트 체크리스트**: 스크린샷 + 콘솔 로그 + 실제 동작 확인
- **자동화**: 주요 사용자 플로우는 자동화 테스트 작성 권장

## Quality Assurance

### Pre-Commit Checks
1. ESLint 검사 통과
2. 하드코딩된 값 제거 확인
3. 변수명 명확성 검토
4. 주석 품질 검토

### Code Review Criteria
- ✅ 클린 코드 원칙 준수 여부
- ✅ 하드코딩 없음
- ✅ 재사용 가능한 코드 활용
- ✅ 네이밍 컨벤션 준수
- ✅ 스타일 가이드 일관성
- ✅ 프로덕션 품질 (에러 처리, 성능, 보안)

### Performance & Security
- **성능 모니터링**: 주요 API 응답 시간 추적
- **보안 스캔**: 민감 정보 노출 점검 (API 키, 토큰 등)
- **접근성**: 웹 접근성 기본 지침(WCAG 2.1 AA) 준수 권장

## Governance

### Amendment Procedure
1. 원칙 변경 제안 시 팀 전체 논의 필수
2. 변경 사항은 문서화 및 버전 업데이트
3. 기존 코드에 미치는 영향 분석 후 마이그레이션 계획 수립

### Versioning Policy
- **MAJOR**: 기존 원칙 제거 또는 근본적 재정의 (하위 호환성 없음)
- **MINOR**: 새로운 원칙 추가 또는 기존 원칙 확장
- **PATCH**: 명확성 개선, 오타 수정, 예시 추가

### Compliance Review
- 모든 PR은 헌법 준수 여부 검토
- 복잡도 증가는 명확한 근거와 함께 문서화
- 정기적인 코드 감사를 통해 헌법 위반 사항 점검

### Constitution Supremacy
이 헌법은 프로젝트의 모든 개발 관행보다 우선합니다. 예외가 필요한 경우 명확한 기술적/비즈니스적 근거와 함께 문서화해야 하며, 임시 예외는 반드시 기한을 명시해야 합니다.

**Version**: 1.0.0 | **Ratified**: 2025-01-16 | **Last Amended**: 2025-01-16
