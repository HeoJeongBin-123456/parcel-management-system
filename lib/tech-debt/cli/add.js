#!/usr/bin/env node

/**
 * Technical Debt Item Addition CLI
 * Interactive command to add new technical debt items to TECHNICAL_DEBT.md
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const config = require('../config');

/**
 * Create readline interface for user input
 * @returns {object} Readline interface
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask user a question and get answer
 * @param {object} rl - Readline interface
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User answer
 */
function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Validate severity input (utility function for future use)
 * @param {string} severity - Severity level
 * @returns {boolean} Is valid
 */
function _isValidSeverity(severity) {
  return ['Critical', 'High', 'Medium', 'Low'].includes(severity);
}

/**
 * Validate principle input (utility function for future use)
 * @param {string} principle - Principle string
 * @returns {boolean} Is valid
 */
function _isValidPrinciple(principle) {
  return config.constitutionPrinciples.some(p => p.includes(principle));
}

/**
 * Parse principle selection
 * @param {string} input - User input
 * @returns {string} Full principle text or empty
 */
function parsePrinciple(input) {
  const trimmed = input.trim();

  // Allow input like "1" or "I"
  if (trimmed === '1' || trimmed === 'I') return config.constitutionPrinciples[0];
  if (trimmed === '2' || trimmed === 'II') return config.constitutionPrinciples[1];
  if (trimmed === '3' || trimmed === 'III') return config.constitutionPrinciples[2];
  if (trimmed === '4' || trimmed === 'IV') return config.constitutionPrinciples[3];
  if (trimmed === '5' || trimmed === 'V') return config.constitutionPrinciples[4];
  if (trimmed === '6' || trimmed === 'VI') return config.constitutionPrinciples[5];

  // Allow full principle text
  const matching = config.constitutionPrinciples.find(p =>
    p.toLowerCase().includes(trimmed.toLowerCase())
  );

  return matching || '';
}

/**
 * Generate next debt ID based on existing violations
 * @param {string} docContent - Current TECHNICAL_DEBT.md content
 * @returns {string} Next debt ID (e.g., "TD-001")
 */
function getNextDebtId(docContent) {
  const matches = docContent.match(/(?:TD|DEBT|FILE|HARD|NAME)-\d+/g) || [];
  if (matches.length === 0) return 'TD-001';

  const numbers = matches.map(m => {
    const num = m.match(/\d+/)[0];
    return parseInt(num, 10);
  });

  const maxNum = Math.max(...numbers);
  return `TD-${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Create new debt item object
 * @param {object} answers - User answers
 * @param {string} debtId - Debt item ID
 * @returns {object} Debt item
 */
function createDebtItem(answers, debtId) {
  return {
    id: debtId,
    file: answers.file,
    type: answers.type,
    severity: answers.severity,
    principle: answers.principle,
    message: answers.message,
    lineStart: answers.lineStart ? parseInt(answers.lineStart, 10) : null,
    lineEnd: answers.lineEnd ? parseInt(answers.lineEnd, 10) : null,
    suggestion: answers.suggestion || null,
    assignee: answers.assignee || null,
    deadline: answers.deadline || null,
    estimatedEffort: answers.estimatedEffort || null,
    status: 'New',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Format debt item for markdown
 * @param {object} item - Debt item
 * @returns {string} Markdown formatted item
 */
function formatDebtItemMarkdown(item) {
  let markdown = `### ${item.id}: ${item.message}\n\n`;
  markdown += `| 속성 | 값 |\n`;
  markdown += `|------|-----|\n`;
  markdown += `| **파일** | \`${item.file}\` |\n`;
  markdown += `| **위반 원칙** | ${item.principle} |\n`;
  markdown += `| **유형** | ${item.type} |\n`;
  markdown += `| **상태** | ${item.status} |\n`;

  if (item.lineStart && item.lineEnd) {
    markdown += `| **줄 번호** | ${item.lineStart}~${item.lineEnd} |\n`;
  }

  if (item.suggestion) {
    markdown += `| **권장사항** | ${item.suggestion} |\n`;
  }

  if (item.assignee) {
    markdown += `| **담당자** | ${item.assignee} |\n`;
  }

  if (item.deadline) {
    markdown += `| **기한** | ${item.deadline} |\n`;
  }

  if (item.estimatedEffort) {
    markdown += `| **예상 소요시간** | ${item.estimatedEffort} |\n`;
  }

  markdown += `| **작성 일시** | ${item.createdAt} |\n`;
  markdown += '\n';

  return markdown;
}

/**
 * Add debt item to TECHNICAL_DEBT.md
 * @param {object} item - Debt item to add
 * @returns {Promise<void>}
 */
async function addDebtItemToDocument(item) {
  const debtFilePath = path.join(process.cwd(), 'TECHNICAL_DEBT.md');

  try {
    let content = await fs.readFile(debtFilePath, 'utf-8');
    const debtId = getNextDebtId(content);
    item.id = debtId;

    // Find the section for this severity or create it
    const severityHeader = `## ${getSeverityEmoji(item.severity)} ${item.severity} 심각도`;

    if (content.includes(severityHeader)) {
      // Add to existing section
      const sectionRegex = new RegExp(
        `(${severityHeader}[^#]*)(?=(##|$))`,
        's'
      );

      const replacement = `$1${formatDebtItemMarkdown(item)}`;
      content = content.replace(sectionRegex, replacement);
    } else {
      // Create new section before instructions
      const instructionsStart = content.indexOf('## 📋 사용 방법');
      if (instructionsStart > -1) {
        const newSection = `${severityHeader} (새로운 항목)\n\n${formatDebtItemMarkdown(item)}\n---\n\n`;
        content = content.slice(0, instructionsStart) + newSection + content.slice(instructionsStart);
      } else {
        // Just append before the last horizontal rule
        const lastRuleIndex = content.lastIndexOf('---');
        const newSection = `${severityHeader}\n\n${formatDebtItemMarkdown(item)}\n---\n\n`;
        content = content.slice(0, lastRuleIndex) + newSection + content.slice(lastRuleIndex);
      }
    }

    await fs.writeFile(debtFilePath, content, 'utf-8');

    console.log(`\n✅ 기술 부채 항목 추가 완료!`);
    console.log(`📌 항목 ID: ${item.id}`);
    console.log(`📁 파일: ${item.file}`);
    console.log(`🎯 심각도: ${item.severity}`);
    console.log(`\n📝 보고서: ${debtFilePath}`);
  } catch (error) {
    console.error(`❌ 문서 업데이트 실패:`, error.message);
    throw error;
  }
}

/**
 * Get emoji for severity level
 * @param {string} severity - Severity level
 * @returns {string} Emoji
 */
function getSeverityEmoji(severity) {
  const emojis = {
    Critical: '🔴',
    High: '🟠',
    Medium: '🟡',
    Low: '🟢',
  };
  return emojis[severity] || '⚪';
}

/**
 * Main CLI flow for adding debt items
 */
async function main() {
  const rl = createInterface();

  try {
    console.log('\n' + '='.repeat(60));
    console.log('  🔧 기술 부채 항목 추가');
    console.log('='.repeat(60) + '\n');

    // Collect user input
    const answers = {};

    // File path
    answers.file = await askQuestion(rl, '📁 파일 경로: ');
    if (!answers.file) {
      console.log('❌ 파일 경로는 필수입니다.');
      process.exit(1);
    }

    // Violation message
    answers.message = await askQuestion(rl, '📝 위반 내용 설명: ');
    if (!answers.message) {
      console.log('❌ 위반 내용 설명은 필수입니다.');
      process.exit(1);
    }

    // Violation type
    console.log('\n📋 유형 선택 (예: FILE_SIZE, HARDCODED_SECRET, NAMING_CONVENTION):');
    answers.type = await askQuestion(rl, '   > ');
    if (!answers.type) {
      answers.type = 'OTHER';
    }

    // Severity
    console.log('\n🎯 심각도 선택:');
    console.log('   1. Critical (중대)');
    console.log('   2. High (높음)');
    console.log('   3. Medium (중간)');
    console.log('   4. Low (낮음)');
    let severityInput = await askQuestion(rl, '   > ');
    const severityMap = { '1': 'Critical', '2': 'High', '3': 'Medium', '4': 'Low' };
    answers.severity = severityMap[severityInput] || 'High';

    // Principle
    console.log('\n💡 헌법 원칙 선택 (번호 또는 번역):');
    config.constitutionPrinciples.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p}`);
    });
    let principleInput = await askQuestion(rl, '   > ');
    answers.principle = parsePrinciple(principleInput);
    if (!answers.principle) {
      console.log('❌ 올바른 헌법 원칙을 선택해주세요.');
      process.exit(1);
    }

    // Line numbers (optional)
    answers.lineStart = await askQuestion(rl, '\n🔢 시작 줄 번호 (선택사항): ');
    answers.lineEnd = await askQuestion(rl, '🔢 종료 줄 번호 (선택사항): ');

    // Suggestion
    answers.suggestion = await askQuestion(rl, '\n💬 권장사항 (선택사항): ');

    // Assignee
    answers.assignee = await askQuestion(rl, '👤 담당자 (선택사항): ');

    // Deadline
    answers.deadline = await askQuestion(rl, '📅 기한 (선택사항, 예: 2025-11-30): ');

    // Estimated effort
    answers.estimatedEffort = await askQuestion(rl, '⏱️  예상 소요시간 (선택사항, 예: 2주): ');

    // Create debt item and add to document
    const debtItem = createDebtItem(answers, '');
    await addDebtItemToDocument(debtItem);

    console.log('\n' + '='.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle case when script is run directly
if (require.main === module) {
  main();
}

module.exports = {
  createDebtItem,
  formatDebtItemMarkdown,
  addDebtItemToDocument,
  getNextDebtId,
};
