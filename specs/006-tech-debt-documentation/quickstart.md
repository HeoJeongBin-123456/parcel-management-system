# Quickstart Guide: 기술 부채 문서화 시스템

**5분 안에 시작하기** - 설치부터 첫 스캔까지

---

## 📋 Prerequisites

최소 요구사항:
- ✅ Node.js 18+ (현재 프로젝트 환경)
- ✅ npm 또는 yarn
- ✅ Git (선택 사항, 변경 파일 추적용)

확인:
```bash
node --version  # v18.0.0 이상
npm --version   # v9.0.0 이상
```

---

## 🚀 Quick Start (5분)

### Step 1: 의존성 설치 (1분)

```bash
# ESLint가 이미 설치되어 있으므로 추가 없음
# Husky 설치 (git hooks용)
npm install --save-dev husky lint-staged

# Husky 초기화
npx husky install
```

### Step 2: 프로젝트에 스크립트 추가 (1분)

`package.json`에 다음 스크립트 추가:

```json
{
  "scripts": {
    "scan:debt": "node lib/tech-debt/scanner.js",
    "scan:debt:quick": "npm run scan:debt -- --quick",
    "validate:debt": "node lib/tech-debt/validators/markdown-schema.js",
    "debt:stats": "node lib/tech-debt/reporters/stats.js"
  },
  "lint-staged": {
    "*.js": [
      "eslint --max-warnings 0",
      "npm run scan:debt -- --quick --severity Critical,High"
    ]
  }
}
```

### Step 3: 첫 스캔 실행 (2분)

```bash
# 전체 코드베이스 스캔
npm run scan:debt -- --full

# 출력 예시:
# 🔍 기술 부채 스캔 시작...
# ✓ 23 files scanned (3,126 lines)
# ⚠ 5 violations found
#
# Critical: 0
# High: 2
# Medium: 2
# Low: 1
#
# 📝 Report saved to TECHNICAL_DEBT.md
```

### Step 4: 생성된 문서 확인 (1분)

```bash
# 프로젝트 루트에 생성됨
cat TECHNICAL_DEBT.md
```

**축하합니다!** 🎉 기술 부채 문서화 시스템이 준비되었습니다.

---

## 📖 Basic Usage

### 1. 일상적인 스캔

```bash
# 변경된 파일만 빠르게 스캔 (일상 작업용)
npm run scan:debt -- --quick

# 전체 스캔 (주간/월간 리뷰용)
npm run scan:debt -- --full
```

### 2. 통계 확인

```bash
# 기본 통계
npm run debt:stats

# 헌법 원칙별 분포
npm run debt:stats -- --by-principle
```

### 3. 문서 검증

```bash
# TECHNICAL_DEBT.md 구조 검증
npm run validate:debt
```

---

## 🔧 Configuration

### 기본 설정 파일 생성

`lib/tech-debt/config.js` 생성:

```javascript
module.exports = {
  // 스캔 대상 (프로젝트에 맞게 수정)
  include: [
    'public/js/**/*.js',
    'lib/**/*.js',
    'tests/**/*.js'
  ],

  // 제외 대상
  exclude: [
    'node_modules/**',
    '*.min.js',
    'vendor/**'
  ],

  // 파일 크기 제한 (헌법 기준)
  maxFileLines: 500,

  // 하드코딩 패턴
  secretPatterns: [
    /API_KEY\s*=\s*['"][^'"]+['"]/,
    /[A-Z_]+_SECRET\s*=\s*['"][^'"]+['"]/,
    /(password|pwd)\s*=\s*['"][^'"]+['"]/i,
    /Bearer\s+[A-Za-z0-9\-_.]{20,}/
  ],

  // 리포트 설정
  report: {
    output: 'TECHNICAL_DEBT.md',
    includeResolved: true,
    maxResolvedAge: 90  // 90일 이상 된 해결 항목 아카이브
  }
};
```

---

## 🎯 Common Workflows

### Workflow 1: 로컬 개발

```bash
# 1. 코드 작성
vim public/js/new-feature.js

# 2. 스캔 실행 (선택 사항)
npm run scan:debt -- --quick

# 3. Git 커밋 (자동 스캔 실행)
git add .
git commit -m "feat: add new feature"
# → pre-commit hook이 자동으로 스캔 실행
```

### Workflow 2: PR 리뷰 전

```bash
# 1. 전체 스캔
npm run scan:debt -- --full

# 2. 통계 확인
npm run debt:stats

# 3. Critical/High 항목 확인
grep -A 5 "## Critical\|## High" TECHNICAL_DEBT.md
```

### Workflow 3: 월간 리뷰

```bash
# 1. 전체 스캔 + JSON 출력
npm run scan:debt -- --full --format json --output reports/debt-$(date +%Y-%m).json

# 2. 통계 및 추이 확인
npm run debt:stats -- --history

# 3. 문서를 git에 커밋
git add TECHNICAL_DEBT.md reports/
git commit -m "chore: monthly tech debt report"
```

---

## 🛠 Troubleshooting

### Problem 1: "No such file or directory"

**증상**:
```
Error: ENOENT: no such file or directory, open 'lib/tech-debt/scanner.js'
```

**해결**:
```bash
# 디렉토리 생성
mkdir -p lib/tech-debt/validators lib/tech-debt/reporters lib/tech-debt/utils

# 구현은 /speckit.tasks 명령으로 자동 생성됨
```

### Problem 2: "Permission denied"

**증상**:
```
Error: EACCES: permission denied, open 'public/js/restricted.js'
```

**해결**:
```bash
# 파일 권한 확인
ls -l public/js/restricted.js

# 필요 시 권한 변경
chmod 644 public/js/restricted.js
```

### Problem 3: "Git not found"

**증상**:
```
Warning: Git not found, falling back to full scan
```

**해결**:
```bash
# Git 설치 (macOS)
brew install git

# Git 설치 (Ubuntu)
sudo apt-get install git

# 또는 --full 플래그 사용
npm run scan:debt -- --full
```

---

## 📚 Next Steps

### 1. Pre-commit Hook 설정 (권장)

```bash
# .husky/pre-commit 생성
npx husky add .husky/pre-commit "npm run scan:debt -- --quick --severity Critical,High"
chmod +x .husky/pre-commit
```

**효과**: 커밋 시 자동으로 Critical/High 위반 사항 체크

### 2. ESLint 규칙 추가

`.eslintrc.js`에 헌법 기반 규칙 추가:

```javascript
module.exports = {
  rules: {
    'max-lines': ['warn', { max: 500, skipBlankLines: true }],
    'max-depth': ['error', 3],
    'camelcase': ['error', { properties: 'always' }],
    'no-magic-numbers': ['warn', { ignore: [0, 1, -1] }]
  }
};
```

### 3. GitHub Actions 설정 (CI/CD)

`.github/workflows/tech-debt-scan.yml` 생성:

```yaml
name: Tech Debt Scan

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
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

### 4. 월간 자동 리포트

`.github/workflows/monthly-report.yml` 생성:

```yaml
name: Monthly Tech Debt Report

on:
  schedule:
    - cron: '0 0 1 * *'  # 매월 1일 00:00 UTC
  workflow_dispatch:      # 수동 실행 가능

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
      - name: Install dependencies
        run: npm ci
      - name: Generate report
        run: npm run scan:debt -- --full
      - name: Commit report
        run: |
          git config user.name "Tech Debt Bot"
          git config user.email "bot@example.com"
          git add TECHNICAL_DEBT.md
          git diff --quiet && git diff --staged --quiet || (git commit -m "chore: monthly tech debt report [automated]" && git push)
```

---

## 🎓 Best Practices

### 1. 정기 스캔 습관
- **일간**: `--quick` 모드로 변경 파일만 스캔
- **주간**: `--full` 모드로 전체 스캔
- **월간**: 통계 리뷰 및 개선 계획 수립

### 2. 우선순위 관리
- **Critical**: 즉시 조치 (1주 이내)
- **High**: 다음 스프린트 포함
- **Medium**: 분기별 계획
- **Low**: 기회가 될 때 개선

### 3. 팀 협업
- PR 리뷰 시 `TECHNICAL_DEBT.md` 변경 사항 확인
- 월간 회의에서 통계 공유
- 해결된 항목은 담당자와 해결 전략 문서화

### 4. False Positive 처리
- 정당한 예외는 `// tech-debt: approved TD-XXX` 주석 추가
- 승인 사유를 문서에 기록
- 정기 리뷰 시 승인 항목 재검토

---

## 📊 Success Metrics

시스템 도입 후 3개월 내 다음 지표 달성:

✅ Critical 항목 **0개** 유지
✅ High 항목 **80% 이상** 해결
✅ 신규 발생 기술 부채 **월 2건 이하**
✅ 팀 리뷰 시 문서 참조 **주 1회 이상**

---

## 🆘 Getting Help

### 문서 참조
- [CLI Interface Contract](./contracts/cli-interface.md) - 명령어 상세 가이드
- [Data Model](./data-model.md) - 데이터 구조 설명
- [Research](./research.md) - 기술 결정 배경

### 커뮤니티
- GitHub Issues: 버그 리포트 및 기능 제안
- Team Wiki: 내부 팀 가이드 및 FAQ
- Slack #tech-debt 채널: 실시간 질문

---

## 🚀 You're All Set!

이제 기술 부채 문서화 시스템이 완전히 준비되었습니다.

**다음 단계**:
1. ✅ 첫 스캔 완료
2. ⏭️ `/speckit.tasks` 실행하여 구현 작업 시작
3. 📝 개선 계획 수립
4. 🎯 우선순위 높은 항목부터 리팩토링

**Happy Refactoring!** 🎉
