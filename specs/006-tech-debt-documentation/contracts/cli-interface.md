# CLI Interface Contract: 기술 부채 스캐너

**Purpose**: 기술 부채 스캔 도구의 명령줄 인터페이스 정의
**Created**: 2025-01-16

---

## Command: `tech-debt scan`

### Description
코드베이스를 스캔하여 헌법 위반 사항을 찾고 `TECHNICAL_DEBT.md` 파일을 생성/업데이트합니다.

### Usage
```bash
node lib/tech-debt/scanner.js [options]

# Alias (package.json scripts)
npm run scan:debt [-- options]
```

### Options

| Flag | Type | Default | Description | Example |
|------|------|---------|-------------|---------|
| `--full` | boolean | false | 전체 스캔 (캐시 무시) | `--full` |
| `--quick` | boolean | false | 빠른 스캔 (변경된 파일만) | `--quick` |
| `--output` | string | `TECHNICAL_DEBT.md` | 출력 파일 경로 | `--output docs/debt.md` |
| `--format` | string | `markdown` | 출력 형식 (markdown, json) | `--format json` |
| `--severity` | string | all | 필터링할 심각도 | `--severity Critical,High` |
| `--dry-run` | boolean | false | 파일 수정 없이 미리보기 | `--dry-run` |
| `--silent` | boolean | false | 콘솔 출력 숨김 (에러만 출력) | `--silent` |
| `--help` | boolean | - | 도움말 표시 | `--help` |

### Examples

#### 1. 전체 스캔 (최초 실행 또는 월간 리포트)
```bash
npm run scan:debt -- --full
```

**Output**:
```
🔍 기술 부채 스캔 시작...
✓ 23 files scanned (3,126 lines)
⚠ 5 violations found

Critical: 0
High: 2
Medium: 2
Low: 1

📝 Report saved to TECHNICAL_DEBT.md
```

#### 2. 빠른 스캔 (pre-commit hook용)
```bash
npm run scan:debt -- --quick
```

**Output**:
```
🔍 변경된 파일 스캔 중...
✓ 3 files scanned (412 lines)
✓ No new violations detected
```

#### 3. JSON 형식 출력 (CI/CD 통합용)
```bash
npm run scan:debt -- --format json --output scan-result.json
```

**Output** (`scan-result.json`):
```json
{
  "scanDate": "2025-01-16T14:30:00Z",
  "filesScanned": 23,
  "totalLines": 3126,
  "violations": [
    {
      "id": "TD-001",
      "file": "public/js/parcel.js",
      "type": "FILE_SIZE",
      "severity": "High",
      "lineCount": 2926,
      "message": "File exceeds 500 lines (2,926 lines, 5.8x over limit)"
    }
  ],
  "summary": {
    "Critical": 0,
    "High": 2,
    "Medium": 2,
    "Low": 1
  }
}
```

#### 4. 특정 심각도만 스캔
```bash
npm run scan:debt -- --severity Critical,High
```

### Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Success | 스캔 완료, 위반 없음 |
| 1 | Success with warnings | 스캔 완료, Low/Medium 위반 발견 |
| 2 | Success with errors | 스캔 완료, Critical/High 위반 발견 |
| 10 | Configuration error | 설정 파일 오류 (config.js) |
| 11 | Permission error | 파일 접근 권한 오류 |
| 99 | Unknown error | 예상치 못한 오류 |

**CI/CD Integration**:
```yaml
# GitHub Actions 예시
- name: Scan tech debt
  run: npm run scan:debt -- --format json
  continue-on-error: true  # exit code 1,2는 경고만
```

---

## Command: `tech-debt validate`

### Description
`TECHNICAL_DEBT.md` 파일의 구조와 내용이 올바른지 검증합니다.

### Usage
```bash
node lib/tech-debt/validators/markdown-schema.js [file]

# Alias
npm run validate:debt [-- file]
```

### Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `file` | string | `TECHNICAL_DEBT.md` | 검증할 마크다운 파일 경로 |

### Examples

#### 1. 기본 검증
```bash
npm run validate:debt
```

**Output** (성공):
```
✓ TECHNICAL_DEBT.md is valid
  - 5 debt items found
  - All required fields present
  - No duplicate IDs
```

**Output** (실패):
```
✗ TECHNICAL_DEBT.md validation failed

Errors:
  - TD-003: Missing required field 'severity'
  - TD-005: Invalid status 'WIP' (allowed: Open, In Progress, Resolved)
  - Duplicate ID found: TD-002
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Valid |
| 1 | Invalid |

---

## Command: `tech-debt add`

### Description
새로운 기술 부채 항목을 대화형으로 추가합니다.

### Usage
```bash
node lib/tech-debt/cli/add.js

# Alias
npm run debt:add
```

### Interactive Prompts

```
❓ What file has the technical debt?
   public/js/auth.js

❓ What is the violation?
   Hardcoded API key in line 42

❓ Severity? (Critical/High/Medium/Low)
   High

❓ Which constitution principle is violated?
   1. Clean Code Principles
   2. No Hard Coding ←
   3. Code Reusability
   ...

❓ Assignee (or leave blank for TBD)?
   @security-team

✓ Technical debt TD-006 added to TECHNICAL_DEBT.md
```

### Non-Interactive Mode
```bash
npm run debt:add -- \
  --file public/js/auth.js \
  --violation "Hardcoded API key in line 42" \
  --severity High \
  --principle "II" \
  --assignee @security-team
```

---

## Command: `tech-debt update`

### Description
기존 기술 부채 항목의 상태를 업데이트합니다.

### Usage
```bash
node lib/tech-debt/cli/update.js <debt-id> [options]

# Alias
npm run debt:update -- <debt-id> [options]
```

### Arguments & Options

| Argument/Flag | Type | Description | Example |
|---------------|------|-------------|---------|
| `<debt-id>` | string | 업데이트할 항목 ID (필수) | `TD-001` |
| `--status` | string | 상태 변경 | `--status "In Progress"` |
| `--assignee` | string | 담당자 변경 | `--assignee @developer` |
| `--note` | string | 진행 상황 메모 추가 | `--note "data 모듈 분리 완료"` |
| `--resolve` | boolean | 해결 완료 처리 | `--resolve` |

### Examples

#### 1. 상태 변경
```bash
npm run debt:update -- TD-001 --status "In Progress"
```

#### 2. 진행 메모 추가
```bash
npm run debt:update -- TD-001 --note "data-handler.js 분리 완료 (1/5)"
```

#### 3. 해결 완료
```bash
npm run debt:update -- TD-001 --resolve
```

**Output**:
```
✓ TD-001 marked as Resolved
  - resolvedDate set to 2025-02-01
  - Status: Open → Resolved
```

---

## Command: `tech-debt stats`

### Description
기술 부채 통계를 출력합니다.

### Usage
```bash
node lib/tech-debt/reporters/stats.js [options]

# Alias
npm run debt:stats [-- options]
```

### Options

| Flag | Description |
|------|-------------|
| `--chart` | ASCII 차트 표시 |
| `--by-principle` | 헌법 원칙별 집계 |
| `--history` | 월별 추이 표시 (git history 분석) |

### Examples

#### 1. 기본 통계
```bash
npm run debt:stats
```

**Output**:
```
📊 기술 부채 통계 (2025-01-16)

Total Items: 5
  Open: 3
  In Progress: 1
  Resolved: 1

By Severity:
  Critical: 0
  High: 2 (40%)
  Medium: 2 (40%)
  Low: 1 (20%)

Average Age: 12 days
Oldest Item: TD-002 (45 days old)
```

#### 2. 헌법 원칙별 집계
```bash
npm run debt:stats -- --by-principle
```

**Output**:
```
📊 위반 원칙별 분포

I. Clean Code: 2 items (40%)
II. No Hard Coding: 1 item (20%)
V. Consistent Style: 1 item (20%)
VI. Production Quality: 1 item (20%)
```

---

## Configuration File

**Location**: `lib/tech-debt/config.js`

```javascript
module.exports = {
  // 스캔 대상
  include: ['public/js/**/*.js', 'lib/**/*.js', 'tests/**/*.js'],
  exclude: ['node_modules/**', '*.min.js', 'vendor/**'],

  // 파일 크기 제한
  maxFileLines: 500,

  // 하드코딩 패턴
  secretPatterns: [
    /API_KEY\s*=\s*['"][^'"]+['"]/,
    /[A-Z_]+_SECRET\s*=\s*['"][^'"]+['"]/,
    /(password|pwd)\s*=\s*['"][^'"]+['"]/i
  ],

  // 리포트 설정
  report: {
    output: 'TECHNICAL_DEBT.md',
    includeResolved: true,  // 해결된 항목도 포함
    maxResolvedAge: 90      // 90일 이상 된 해결 항목은 아카이브
  },

  // 성능 설정
  performance: {
    maxConcurrency: 10,     // 동시 스캔 파일 수
    timeout: 30000          // 전체 스캔 타임아웃 (ms)
  }
};
```

---

## Error Handling

### Common Errors

#### 1. EACCES (Permission Denied)
```
Error: Cannot read file public/js/restricted.js
Reason: EACCES (permission denied)
Solution: Check file permissions or run with sudo
```

#### 2. Invalid Configuration
```
Error: Configuration validation failed
Details:
  - config.maxFileLines must be a positive number (got: -1)
  - config.exclude must be an array (got: string)
```

#### 3. Git Not Found (for --quick mode)
```
Warning: Git not found, falling back to full scan
Tip: Install git or use --full flag explicitly
```

---

## API for Programmatic Usage

```javascript
// Node.js 프로그램에서 사용
const TechDebtScanner = require('./lib/tech-debt/scanner');

const scanner = new TechDebtScanner({
  include: ['src/**/*.js'],
  maxFileLines: 500
});

const result = await scanner.scan({ quick: false });
console.log(`Found ${result.violations.length} violations`);
```

---

## Integration Examples

### 1. package.json scripts
```json
{
  "scripts": {
    "scan:debt": "node lib/tech-debt/scanner.js",
    "scan:debt:quick": "npm run scan:debt -- --quick",
    "validate:debt": "node lib/tech-debt/validators/markdown-schema.js",
    "debt:stats": "node lib/tech-debt/reporters/stats.js"
  }
}
```

### 2. Husky pre-commit hook
``bash
#!/bin/sh
npm run scan:debt -- --quick --severity Critical,High
if [ $? -eq 2 ]; then
  echo "❌ Critical/High violations detected. Commit aborted."
  exit 1
fi
```

### 3. GitHub Actions
```yaml
name: Tech Debt Scan

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: npm ci
      - name: Scan tech debt
        run: npm run scan:debt -- --format json --output scan-result.json
      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: tech-debt-report
          path: scan-result.json
```

---

## Output Formats

### Markdown (Default)
- Human-readable
- GitHub 렌더링 지원
- Git diff 친화적

### JSON
- Machine-readable
- CI/CD 파이프라인 통합 용이
- 커스텀 대시보드 구축 가능

### Future Formats (Phase 3)
- HTML (대화형 대시보드)
- CSV (스프레드시트 분석용)
- JUnit XML (테스트 리포터 통합)
