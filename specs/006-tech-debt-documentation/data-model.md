# Data Model: 기술 부채 문서화 시스템

**Purpose**: 기술 부채 추적 및 개선 계획을 위한 데이터 엔티티 정의
**Created**: 2025-01-16

---

## Entity 1: TechnicalDebtItem

**설명**: 헌법을 위반하는 코드 또는 아키텍처 요소를 표현하는 핵심 엔티티

### Attributes

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `id` | String | ✅ | 고유 식별자 (TD-###) | "TD-001" |
| `title` | String | ✅ | 간략한 제목 (50자 이내) | "parcel.js 파일 크기 위반" |
| `filePath` | String | ✅ | 위반 파일의 상대 경로 | "public/js/parcel.js" |
| `description` | String | ✅ | 위반 내용 상세 설명 | "2,926줄 (권장 500줄의 5.8배 초과)" |
| `severity` | Enum | ✅ | 심각도 | "Critical", "High", "Medium", "Low" |
| `principle` | String | ✅ | 위반한 헌법 원칙 | "I. Clean Code Principles" |
| `discoveredDate` | Date | ✅ | 발견 일자 (ISO 8601) | "2025-01-16" |
| `assignee` | String | ❌ | 담당자 (없으면 "TBD") | "@developer" |
| `status` | Enum | ✅ | 현재 상태 | "Open", "In Progress", "Resolved" |
| `resolvedDate` | Date | ❌ | 해결 일자 (해결 시에만) | "2025-02-01" |
| `lineStart` | Number | ❌ | 위반 시작 줄 번호 | 1 |
| `lineEnd` | Number | ❌ | 위반 종료 줄 번호 | 2926 |
| `tags` | Array<String> | ❌ | 추가 태그 | ["legacy", "refactor-needed"] |

### Relationships

- `TechnicalDebtItem` 1 → 1 `ImprovementPlan` (one-to-one)
- `TechnicalDebtItem` N → 1 `ConstitutionPrinciple` (many-to-one)
- `TechnicalDebtItem` N → 1 `SeverityLevel` (many-to-one)

### Validation Rules

- `id`: 패턴 `TD-\d{3}` 준수 (예: TD-001, TD-023)
- `severity`: "Critical", "High", "Medium", "Low" 중 하나
- `status`: "Open", "In Progress", "Resolved" 중 하나
- `filePath`: 프로젝트 루트 기준 상대 경로
- `title`: 50자 제한 (가독성)
- `lineEnd >= lineStart` (줄 범위 유효성)

### State Transitions

```
Open → In Progress → Resolved
  ↑                      ↓
  └──── (재발 시) ────┘
```

- **Open**: 발견되었으나 작업 미착수
- **In Progress**: 개선 작업 진행 중
- **Resolved**: 해결 완료 (resolvedDate 필수)
- **재발**: Resolved → Open (새로운 ID 부여, 이전 ID 참조)

---

## Entity 2: ImprovementPlan

**설명**: 각 기술 부채 항목의 구체적 해결 방안

### Attributes

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `debtId` | String | ✅ | 연결된 기술 부채 ID | "TD-001" |
| `strategy` | String | ✅ | 리팩토링 전략 설명 | "5개 모듈로 분할 (data, ui, api, utils, events)" |
| `estimatedEffort` | String | ✅ | 예상 소요 시간 | "2 weeks" |
| `priority` | Enum | ✅ | 우선순위 | "P1", "P2", "P3" |
| `deadline` | Date | ❌ | 목표 완료 기한 | "2025-02-15" |
| `dependencies` | Array<String> | ❌ | 선행 작업 ID 목록 | ["TD-005", "TD-012"] |
| `risks` | String | ❌ | 리팩토링 시 위험 요소 | "전역 상태 의존성으로 인한 사이드 이펙트 가능" |
| `progressNotes` | Array<ProgressNote> | ❌ | 진행 상황 메모 | [{date: "2025-01-20", note: "data 모듈 분리 완료"}] |

### Nested Type: ProgressNote

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `date` | Date | ✅ | 메모 작성일 |
| `note` | String | ✅ | 진행 상황 메모 |
| `author` | String | ❌ | 작성자 |

### Validation Rules

- `priority`: "P1" (긴급), "P2" (중요), "P3" (보통) 중 하나
- `estimatedEffort`: "N weeks" 또는 "N days" 형식
- `debtId`: 존재하는 TechnicalDebtItem의 ID여야 함
- `dependencies`: 순환 참조 불가 (DAG 검증)

---

## Entity 3: ConstitutionPrinciple

**설명**: 프로젝트 헌법의 6가지 핵심 원칙 (변경 거의 없음)

### Attributes

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `id` | String | ✅ | 원칙 번호 (I~VI) | "I" |
| `name` | String | ✅ | 원칙 이름 | "Clean Code Principles" |
| `description` | String | ✅ | 원칙 설명 | "함수는 단일 책임, 50줄 제한..." |
| `rules` | Array<String> | ✅ | 세부 규칙 목록 | ["함수 50줄 제한", "중첩 3단계 제한"] |

### Validation Rules

- `id`: "I", "II", "III", "IV", "V", "VI" 중 하나
- 헌법 파일(`.specify/memory/constitution.md`)과 동기화

---

## Entity 4: SeverityLevel

**설명**: 기술 부채의 심각도 분류 기준

### Attributes

| 필드 | 타입 | 필수 | 설명 | 기준 |
|------|------|------|------|------|
| `level` | String | ✅ | 심각도 레벨 | "Critical", "High", "Medium", "Low" |
| `definition` | String | ✅ | 정의 | "시스템 안정성 위협" |
| `slaInDays` | Number | ❌ | 권장 해결 기한 (일) | Critical: 7, High: 30, Medium: 90, Low: 180 |

### Levels

- **Critical**: 시스템 안정성 위협, 즉시 조치 필요 (7일 이내)
- **High**: 유지보수에 심각한 장애, 1개월 이내 해결 권장
- **Medium**: 생산성 저하, 3개월 이내 개선 권장
- **Low**: 개선 권장 사항, 6개월 이내

---

## Entity 5: ScanResult

**설명**: 자동 스캔 도구의 실행 결과 (일회성, 저장 불필요)

### Attributes

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `scanDate` | Date | ✅ | 스캔 실행 일시 | "2025-01-16T14:30:00Z" |
| `filesScanned` | Number | ✅ | 스캔한 파일 수 | 23 |
| `totalLines` | Number | ✅ | 전체 코드 줄 수 | 3126 |
| `violations` | Array<Violation> | ✅ | 발견된 위반 목록 | [...] |
| `skippedFiles` | Array<String> | ❌ | 스캔 실패한 파일 | ["node_modules/..."] |
| `duration` | Number | ❌ | 스캔 소요 시간 (ms) | 4523 |

### Nested Type: Violation

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | String | ✅ | 파일 경로 |
| `type` | String | ✅ | 위반 유형 (FILE_SIZE, HARDCODED_SECRET 등) |
| `line` | Number | ❌ | 줄 번호 |
| `message` | String | ✅ | 설명 메시지 |
| `suggestion` | String | ❌ | 개선 제안 |

---

## Data Flow

### 1. 스캔 → 보고서 생성

```
[코드베이스]
    ↓ (scanner.js 실행)
[ScanResult 생성]
    ↓ (위반 항목 추출)
[TechnicalDebtItem 목록]
    ↓ (markdown 템플릿 적용)
[TECHNICAL_DEBT.md 업데이트]
```

### 2. 개선 계획 수립

```
[기존 TechnicalDebtItem]
    ↓ (개발자가 분석)
[ImprovementPlan 작성]
    ↓ (문서에 추가)
[TECHNICAL_DEBT.md 섹션 업데이트]
```

### 3. 진행 상황 추적

```
[ImprovementPlan.progressNotes 추가]
    ↓ (작업 진행)
[TechnicalDebtItem.status 변경: Open → In Progress]
    ↓ (리팩토링 완료)
[TechnicalDebtItem.status = Resolved, resolvedDate 설정]
```

---

## Persistence Strategy

### 마크다운 기반 저장 (Single Source of Truth)

**File**: `TECHNICAL_DEBT.md`

**Structure**:
```markdown
# 기술 부채 현황 보고서

## Critical 심각도

### TD-001: [Title]
- **파일**: [filePath]
- **위반 내용**: [description]
- **헌법 원칙**: [principle]
- **발견일**: [discoveredDate]
- **담당자**: [assignee]
- **상태**: [status]

#### 개선 계획
- **전략**: [strategy]
- **소요 시간**: [estimatedEffort]
- **우선순위**: [priority]

#### 진행 상황
- [date]: [note]
```

### 장점
- Git 버전 관리로 변경 이력 추적
- 마크다운 diff로 변경 사항 명확
- 별도 데이터베이스 불필요
- GitHub/GitLab에서 바로 렌더링

### 단점 및 완화 방안
- **검색 불편**: → GitHub Search 활용
- **구조 변경 어려움**: → 템플릿 스크립트로 일관성 유지
- **병합 충돌**: → 심각도별 섹션 분리로 충돌 최소화

---

## Example Data

### TechnicalDebtItem (JSON 표현)

```json
{
  "id": "TD-001",
  "title": "parcel.js 파일 크기 위반",
  "filePath": "public/js/parcel.js",
  "description": "2,926줄 (권장 500줄의 5.8배 초과)",
  "severity": "High",
  "principle": "I. Clean Code Principles",
  "discoveredDate": "2025-01-16",
  "assignee": "TBD",
  "status": "Open",
  "lineStart": 1,
  "lineEnd": 2926,
  "tags": ["legacy", "monolithic"]
}
```

### ImprovementPlan (JSON 표현)

```json
{
  "debtId": "TD-001",
  "strategy": "5개 모듈로 분할: data-handler.js (필지 데이터), ui-manager.js (UI 업데이트), api-client.js (VWorld API), utils.js (유틸리티), event-handlers.js (이벤트)",
  "estimatedEffort": "2 weeks",
  "priority": "P1",
  "deadline": "2025-02-15",
  "dependencies": [],
  "risks": "전역 상태(parcelsData, selectedParcel) 의존성으로 인한 사이드 이펙트 가능. 단계적 분할 필요.",
  "progressNotes": []
}
```

---

## Schema Validation

### ESLint Rule for Markdown Structure (선택 사항)

자동 검증을 위해 마크다운 파싱 스크립트 작성 가능:

```javascript
// lib/tech-debt/validators/markdown-schema.js
function validateDebtItem(mdSection) {
  const required = ['id', 'title', 'filePath', 'severity', 'principle', 'discoveredDate', 'status'];
  const missing = required.filter(field => !mdSection.includes(`**${field}**:`));

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}
```

---

## Implementation Notes

- 데이터 모델은 마크다운 템플릿과 1:1 대응
- 자동 스캔 도구는 `ScanResult` → `TechnicalDebtItem` 변환 담당
- 개선 계획은 개발자가 수동 작성 (자동화 불가)
- 월간 리포트는 모든 항목의 스냅샷 생성 (이력 추적)
