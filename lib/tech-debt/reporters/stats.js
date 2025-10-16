#!/usr/bin/env node

/**
 * Technical Debt Statistics Reporter
 * Generate statistics and insights about technical debt across the codebase
 */

const fs = require('fs').promises;
const path = require('path');

const config = require('../config');

/**
 * Parse command line arguments
 * @returns {object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    chart: args.includes('--chart'),
    byPrinciple: args.includes('--by-principle'),
    history: args.includes('--history'),
    json: args.includes('--json'),
  };
}

/**
 * Read TECHNICAL_DEBT.md and extract violations
 * @returns {Promise<object[]>} Array of violations with metadata
 */
async function readDebtDocument() {
  const debtFilePath = path.join(process.cwd(), 'TECHNICAL_DEBT.md');

  try {
    const content = await fs.readFile(debtFilePath, 'utf-8');

    // Extract summary stats
    const criticalMatch = content.match(/🔴 Critical \|\s*(\d+)\s*\|/);
    const highMatch = content.match(/🟠 High \|\s*(\d+)\s*\|/);
    const mediumMatch = content.match(/🟡 Medium \|\s*(\d+)\s*\|/);
    const lowMatch = content.match(/🟢 Low \|\s*(\d+)\s*\|/);

    return {
      Critical: criticalMatch ? parseInt(criticalMatch[1]) : 0,
      High: highMatch ? parseInt(highMatch[1]) : 0,
      Medium: mediumMatch ? parseInt(mediumMatch[1]) : 0,
      Low: lowMatch ? parseInt(lowMatch[1]) : 0,
    };
  } catch (error) {
    console.error(`❌ 문서 읽기 실패: ${error.message}`);
    return { Critical: 0, High: 0, Medium: 0, Low: 0 };
  }
}

/**
 * Calculate statistics from violations
 * @param {object} severityStats - Severity counts
 * @returns {object} Statistics object
 */
function calculateStatistics(severityStats) {
  const total = Object.values(severityStats).reduce((a, b) => a + b, 0);

  return {
    total,
    bySeverity: severityStats,
    percentages: {
      critical: total > 0 ? ((severityStats.Critical / total) * 100).toFixed(1) : '0.0',
      high: total > 0 ? ((severityStats.High / total) * 100).toFixed(1) : '0.0',
      medium: total > 0 ? ((severityStats.Medium / total) * 100).toFixed(1) : '0.0',
      low: total > 0 ? ((severityStats.Low / total) * 100).toFixed(1) : '0.0',
    },
    avgSeverity: calculateAverageSeverity(severityStats),
  };
}

/**
 * Calculate average severity score
 * @param {object} severityStats - Severity counts
 * @returns {string} Average severity score (0-10)
 */
function calculateAverageSeverity(severityStats) {
  // Critical = 4, High = 3, Medium = 2, Low = 1
  const scores = {
    Critical: severityStats.Critical * 4,
    High: severityStats.High * 3,
    Medium: severityStats.Medium * 2,
    Low: severityStats.Low * 1,
  };

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const total = Object.values(severityStats).reduce((a, b) => a + b, 0);

  if (total === 0) return '0.0';
  return ((totalScore / total) / 4 * 10).toFixed(1);
}

/**
 * Generate text report
 * @param {object} stats - Statistics object
 * @param {object} args - Command arguments
 * @returns {string} Formatted report
 */
function generateTextReport(stats, args) {
  let report = '';

  report += '\n' + '='.repeat(60) + '\n';
  report += '  📊 기술 부채 통계 보고서\n';
  report += '='.repeat(60) + '\n\n';

  // Summary
  report += '## 📈 요약\n\n';
  report += `| 메트릭 | 값 |\n`;
  report += `|--------|-----|\n`;
  report += `| **전체 항목** | ${stats.total}개 |\n`;
  report += `| **평균 심각도** | ${stats.avgSeverity}/10 |\n\n`;

  // Severity breakdown
  report += '## 🎯 심각도별 분포\n\n';
  report += `| 심각도 | 개수 | 비중 |\n`;
  report += `|--------|------|------|\n`;
  report += `| 🔴 Critical | ${stats.bySeverity.Critical}개 | ${stats.percentages.critical}% |\n`;
  report += `| 🟠 High | ${stats.bySeverity.High}개 | ${stats.percentages.high}% |\n`;
  report += `| 🟡 Medium | ${stats.bySeverity.Medium}개 | ${stats.percentages.medium}% |\n`;
  report += `| 🟢 Low | ${stats.bySeverity.Low}개 | ${stats.percentages.low}% |\n\n`;

  // Chart if requested
  if (args.chart) {
    report += generateChart(stats);
  }

  // Principles breakdown if requested
  if (args.byPrinciple) {
    report += generatePrincipleStats();
  }

  // Insights
  report += generateInsights(stats);

  report += '\n' + '='.repeat(60) + '\n\n';

  return report;
}

/**
 * Generate ASCII chart
 * @param {object} stats - Statistics object
 * @returns {string} ASCII chart
 */
function generateChart(stats) {
  const maxCount = Math.max(
    stats.bySeverity.Critical,
    stats.bySeverity.High,
    stats.bySeverity.Medium,
    stats.bySeverity.Low
  );

  const scale = maxCount > 0 ? 40 / maxCount : 1;

  let chart = '## 📊 시각화\n\n';
  chart += '```\n';
  chart += `🔴 Critical: ${'█'.repeat(Math.round(stats.bySeverity.Critical * scale))} ${stats.bySeverity.Critical}\n`;
  chart += `🟠 High:     ${'█'.repeat(Math.round(stats.bySeverity.High * scale))} ${stats.bySeverity.High}\n`;
  chart += `🟡 Medium:   ${'█'.repeat(Math.round(stats.bySeverity.Medium * scale))} ${stats.bySeverity.Medium}\n`;
  chart += `🟢 Low:      ${'█'.repeat(Math.round(stats.bySeverity.Low * scale))} ${stats.bySeverity.Low}\n`;
  chart += '```\n\n';

  return chart;
}

/**
 * Generate principle-based statistics
 * @returns {string} Principle statistics
 */
function generatePrincipleStats() {
  let stats = '## 💡 헌법 원칙별 분석\n\n';

  stats += '| 원칙 | 설명 |\n';
  stats += `|------|------|\n`;

  config.constitutionPrinciples.forEach((principle) => {
    const [num, desc] = principle.split('. ');
    stats += `| ${num} | ${desc.substring(0, 50)} |\n`;
  });

  stats += '\n';

  return stats;
}

/**
 * Generate insights from statistics
 * @param {object} stats - Statistics object
 * @returns {string} Insights section
 */
function generateInsights(stats) {
  let insights = '## 💡 인사이트\n\n';

  // Calculate priorities
  const issues = [];

  if (stats.bySeverity.Critical > 0) {
    issues.push(`🔴 **Critical 항목이 ${stats.bySeverity.Critical}개 있습니다.** 즉시 처리가 필요합니다.`);
  }

  if (stats.bySeverity.High > 0) {
    issues.push(`🟠 **High 항목이 ${stats.bySeverity.High}개 있습니다.** 2주 내 해결을 권장합니다.`);
  }

  if (stats.bySeverity.Low > 0) {
    const lowPercent = stats.percentages.low;
    issues.push(`🟢 **Low 항목이 전체의 ${lowPercent}%를 차지합니다.** 지속적 개선이 필요합니다.`);
  }

  // Health assessment
  const avgSeverity = parseFloat(stats.avgSeverity);
  let health = '';
  let healthEmoji = '';

  if (avgSeverity < 3) {
    health = '건강한 상태 - 지속 모니터링 필요';
    healthEmoji = '✅';
  } else if (avgSeverity < 6) {
    health = '주의 필요 - 정기적 개선 권장';
    healthEmoji = '⚠️';
  } else {
    health = '위험한 상태 - 즉시 개선 필요';
    healthEmoji = '🚨';
  }

  insights += `### 📌 건강도 평가\n\n${healthEmoji} **${health}**\n\n`;

  issues.forEach((issue) => {
    insights += `- ${issue}\n`;
  });

  insights += '\n';

  // Recommendations
  insights += '### 🎯 권장사항\n\n';
  insights += `1. **Critical 항목 처리**: 다음 스프린트에 ${Math.ceil(stats.bySeverity.Critical / 2)}개씩 할당\n`;
  insights += `2. **High 항목 추적**: 월별 2-3개 항목 리팩토링\n`;
  insights += `3. **자동화 강화**: ESLint 규칙 추가로 Low 항목 사전 차단\n`;
  insights += `4. **정기 검토**: 주 1회 기술 부채 현황 검토 회의 진행\n\n`;

  return insights;
}

/**
 * Generate JSON output
 * @param {object} stats - Statistics object
 * @returns {string} JSON output
 */
function generateJsonOutput(stats) {
  return JSON.stringify(stats, null, 2);
}

/**
 * Main function
 */
async function main() {
  try {
    const args = parseArgs();
    const severityStats = await readDebtDocument();
    const stats = calculateStatistics(severityStats);

    if (args.json) {
      console.log(generateJsonOutput(stats));
    } else {
      console.log(generateTextReport(stats, args));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 통계 생성 실패:', error.message);
    process.exit(1);
  }
}

// Handle case when script is run directly
if (require.main === module) {
  main();
}

module.exports = {
  readDebtDocument,
  calculateStatistics,
  generateTextReport,
  generateJsonOutput,
};
