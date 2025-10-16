/**
 * Markdown Report Generator for Technical Debt
 */

/**
 * Generate markdown report from scan results
 * @param {object} results - Scan results
 * @returns {string} Markdown report
 */
function generateMarkdownReport(results) {
  const now = new Date().toISOString();
  const { violations, summary, filesScanned, duration } = results;

  // Group violations by severity
  const criticalItems = violations.filter((v) => v.severity === 'Critical');
  const highItems = violations.filter((v) => v.severity === 'High');
  const mediumItems = violations.filter((v) => v.severity === 'Medium');
  const lowItems = violations.filter((v) => v.severity === 'Low');

  let markdown = `# 기술 부채 현황 보고서

**생성 일시**: ${now}
**스캔 대상**: ${filesScanned} files
**소요 시간**: ${duration}초

## 📊 요약

| 심각도 | 개수 |
|--------|------|
| 🔴 Critical | ${summary.Critical} |
| 🟠 High | ${summary.High} |
| 🟡 Medium | ${summary.Medium} |
| 🟢 Low | ${summary.Low} |
| **합계** | **${violations.length}** |

---

`;

  // Generate sections for each severity
  if (criticalItems.length > 0) {
    markdown += generateSeveritySection('Critical', '🔴', criticalItems);
  }

  if (highItems.length > 0) {
    markdown += generateSeveritySection('High', '🟠', highItems);
  }

  if (mediumItems.length > 0) {
    markdown += generateSeveritySection('Medium', '🟡', mediumItems);
  }

  if (lowItems.length > 0) {
    markdown += generateSeveritySection('Low', '🟢', lowItems);
  }

  // Add instructions
  markdown += `
---

## 📋 사용 방법

### 기술 부채 항목 추가
\`\`\`bash
npm run debt:add
\`\`\`

### 진행 상황 업데이트
\`\`\`bash
npm run debt:update -- TD-001 --status "In Progress" --note "작업 진행 중"
\`\`\`

### 통계 조회
\`\`\`bash
npm run debt:stats
\`\`\`

### 문서 검증
\`\`\`bash
npm run validate:debt
\`\`\`

---

## 📖 헌법 원칙 참고

각 위반 항목은 다음 헌법 원칙 중 하나 이상을 위반합니다:

- **I. Clean Code Principles**: 코드 가독성, 파일 크기, 함수 길이
- **II. No Hard Coding**: API 키, 비밀번호 등의 하드코딩
- **III. Code Reusability**: 중복 로직
- **IV. Clear Naming Conventions**: 변수/함수명 명확성
- **V. Consistent Coding Style**: 일관된 스타일
- **VI. Production Quality Standards**: 에러 처리, 성능 등

---

*이 보고서는 자동 생성되었습니다.*
`;

  return markdown;
}

/**
 * Generate markdown for a severity section
 * @param {string} severity - Severity level
 * @param {string} emoji - Emoji for severity
 * @param {object[]} items - Violation items
 * @returns {string} Markdown section
 */
function generateSeveritySection(severity, emoji, items) {
  let markdown = `## ${emoji} ${severity} 심각도 (${items.length}개)\n\n`;

  items.forEach((item, index) => {
    const idNum = String(index + 1).padStart(3, '0');
    const debtId = item.id ? item.id.split('_')[0] + `-${idNum}` : `DEBT-${idNum}`;

    markdown += `### ${debtId}: ${item.message}\n\n`;
    markdown += `| 속성 | 값 |\n`;
    markdown += `|------|-----|\n`;
    markdown += `| **파일** | \`${item.file}\` |\n`;
    markdown += `| **위반 원칙** | ${item.principle} |\n`;
    markdown += `| **유형** | ${item.type} |\n`;
    markdown += `| **상태** | 신규 |\n`;

    if (item.lineStart && item.lineEnd) {
      markdown += `| **줄 번호** | ${item.lineStart}~${item.lineEnd} |\n`;
    }

    if (item.suggestion) {
      markdown += `| **권장사항** | ${item.suggestion} |\n`;
    }

    // Add improvement plan section if available
    if (item.improvementPlan) {
      markdown += generateImprovementPlanSection(item.improvementPlan);
    }

    markdown += '\n';
  });

  return markdown;
}

/**
 * Generate improvement plan section for a debt item
 * @param {object} plan - Improvement plan details
 * @returns {string} Markdown for improvement plan
 */
function generateImprovementPlanSection(plan) {
  let markdown = `\n#### 🎯 개선 계획\n\n`;

  if (plan.strategy) {
    markdown += `**전략**: ${plan.strategy}\n\n`;
  }

  if (plan.estimatedEffort || plan.priority || plan.deadline) {
    markdown += `| 속성 | 값 |\n`;
    markdown += `|------|-----|\n`;

    if (plan.estimatedEffort) {
      markdown += `| **예상 소요시간** | ${plan.estimatedEffort} |\n`;
    }

    if (plan.priority) {
      markdown += `| **우선순위** | ${plan.priority} |\n`;
    }

    if (plan.deadline) {
      markdown += `| **기한** | ${plan.deadline} |\n`;
    }

    markdown += '\n';
  }

  if (plan.assignee) {
    markdown += `**담당자**: ${plan.assignee}\n\n`;
  }

  if (plan.steps && plan.steps.length > 0) {
    markdown += `**추진 단계**:\n`;
    plan.steps.forEach((step, i) => {
      markdown += `${i + 1}. ${step}\n`;
    });
    markdown += '\n';
  }

  return markdown;
}

module.exports = {
  generateMarkdownReport,
  generateSeveritySection,
  generateImprovementPlanSection,
};
