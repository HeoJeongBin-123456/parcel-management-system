#!/usr/bin/env node

/**
 * Technical Debt Item Update CLI
 * Update status, assignee, notes, and resolution of existing tech debt items
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

/**
 * Parse command line arguments
 * @returns {object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    debtId: args[args.indexOf('--id') + 1] || null,
    status: args[args.indexOf('--status') + 1] || null,
    assignee: args[args.indexOf('--assignee') + 1] || null,
    note: args[args.indexOf('--note') + 1] || null,
    resolve: args.includes('--resolve'),
    deadline: args[args.indexOf('--deadline') + 1] || null,
    effort: args[args.indexOf('--effort') + 1] || null,
    interactive: args.includes('--interactive') || args.length === 0,
  };
}

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
 * @param {string} defaultValue - Default value if empty
 * @returns {Promise<string>} User answer
 */
function askQuestion(rl, question, defaultValue = '') {
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} [${defaultValue}] ` : `${question} `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Extract debt ID from markdown line (utility for future use)
 * @param {string} line - Markdown line (e.g., "### TD-001: File exceeds size")
 * @returns {string} Debt ID or null
 */
function _extractDebtId(line) {
  const match = line.match(/###\s+([A-Z]+-\d+):/);
  return match ? match[1] : null;
}

/**
 * Parse debt item from markdown section
 * @param {string} section - Markdown section for one debt item
 * @returns {object} Parsed debt item
 */
function parseDebtItem(section) {
  const lines = section.split('\n');
  const item = {};

  // Extract ID and message from header
  const headerMatch = lines[0].match(/###\s+([A-Z]+-\d+):\s*(.*)/);
  if (headerMatch) {
    item.id = headerMatch[1];
    item.message = headerMatch[2];
  }

  // Parse table rows
  lines.forEach((line) => {
    if (line.includes('**파일**')) {
      const match = line.match(/`([^`]+)`/);
      item.file = match ? match[1] : '';
    } else if (line.includes('**위반 원칙**')) {
      item.principle = line.split('|')[2].trim();
    } else if (line.includes('**유형**')) {
      item.type = line.split('|')[2].trim();
    } else if (line.includes('**상태**')) {
      item.status = line.split('|')[2].trim();
    } else if (line.includes('**담당자**')) {
      item.assignee = line.split('|')[2].trim();
    } else if (line.includes('**기한**')) {
      item.deadline = line.split('|')[2].trim();
    } else if (line.includes('**예상 소요시간**')) {
      item.effort = line.split('|')[2].trim();
    }
  });

  return item;
}

/**
 * Find debt item section in document by ID
 * @param {string} content - TECHNICAL_DEBT.md content
 * @param {string} debtId - Debt ID to find
 * @returns {object} { section: string, startIndex: number, endIndex: number }
 */
function findDebtItemSection(content, debtId) {
  // Find the start of the item
  const startRegex = new RegExp(`### ${debtId}:`, 'i');
  const startMatch = startRegex.exec(content);

  if (!startMatch) {
    return null;
  }

  const startIndex = startMatch.index;

  // Find the end of the item (next ### or ## or EOF)
  const endRegex = /\n(?=###|##)/;
  const contentFromStart = content.slice(startIndex);
  const endMatch = endRegex.exec(contentFromStart);

  let endIndex;
  if (endMatch) {
    endIndex = startIndex + endMatch.index;
  } else {
    // No next section found, go to end of file or last --- marker
    const lastRuleIndex = content.lastIndexOf('\n---');
    endIndex = lastRuleIndex > startIndex ? lastRuleIndex : content.length;
  }

  const section = content.slice(startIndex, endIndex);

  return {
    section,
    startIndex,
    endIndex,
  };
}

/**
 * List all debt items in document
 * @param {string} content - TECHNICAL_DEBT.md content
 * @returns {object[]} Array of debt items with basic info
 */
function listDebtItems(content) {
  const debtIds = [];
  const matches = content.matchAll(/### ([A-Z]+-\d+):\s*([^|\n]+)/g);

  for (const match of matches) {
    debtIds.push({
      id: match[1],
      message: match[2].trim(),
    });
  }

  return debtIds;
}

/**
 * Update debt item status and metadata
 * @param {string} currentSection - Current item markdown
 * @param {object} updates - Updates to apply
 * @returns {string} Updated markdown
 */
function updateDebtItemSection(currentSection, updates) {
  let updated = currentSection;

  // Update status
  if (updates.status) {
    const statusRegex = /(\| \*\*상태\*\* \|) ([^|]+)/;
    if (statusRegex.test(updated)) {
      updated = updated.replace(statusRegex, `$1 ${updates.status} `);
    } else {
      // Add status row if it doesn't exist
      const lastRowRegex = /(\| \*\*[^|]+\*\* \| [^|]+ \|\n)/;
      updated = updated.replace(lastRowRegex, `$1| **상태** | ${updates.status} |\n`);
    }
  }

  // Update assignee
  if (updates.assignee) {
    const assigneeRegex = /(\| \*\*담당자\*\* \|) ([^|]+)/;
    if (assigneeRegex.test(updated)) {
      updated = updated.replace(assigneeRegex, `$1 ${updates.assignee} `);
    } else {
      // Add assignee row if it doesn't exist
      updated = updated.replace(
        /(\n\n)(?=\||\n)/,
        `| **담당자** | ${updates.assignee} |\n$1`
      );
    }
  }

  // Update deadline
  if (updates.deadline) {
    const deadlineRegex = /(\| \*\*기한\*\* \|) ([^|]+)/;
    if (deadlineRegex.test(updated)) {
      updated = updated.replace(deadlineRegex, `$1 ${updates.deadline} `);
    } else {
      updated = updated.replace(
        /(\n\n)(?=\||\n)/,
        `| **기한** | ${updates.deadline} |\n$1`
      );
    }
  }

  // Update effort
  if (updates.effort) {
    const effortRegex = /(\| \*\*예상 소요시간\*\* \|) ([^|]+)/;
    if (effortRegex.test(updated)) {
      updated = updated.replace(effortRegex, `$1 ${updates.effort} `);
    } else {
      updated = updated.replace(
        /(\n\n)(?=\||\n)/,
        `| **예상 소요시간** | ${updates.effort} |\n$1`
      );
    }
  }

  // Add progress note
  if (updates.note) {
    const timestamp = new Date().toISOString();
    const noteEntry = `\n\n**📌 진행 노트** (${timestamp})\n${updates.note}`;
    updated = updated.replace(/(\n\n)$/, `$1${noteEntry}$1`);
  }

  // Mark as resolved
  if (updates.resolve) {
    updated = updated.replace(/\| \*\*상태\*\* \|[^|]*\|/, '| **상태** | ✅ 해결됨 |');
  }

  return updated;
}

/**
 * Interactive mode for updating debt items
 * @returns {Promise<object>} Update parameters
 */
async function interactiveMode() {
  const rl = createInterface();

  try {
    console.log('\n' + '='.repeat(60));
    console.log('  📝 기술 부채 항목 업데이트');
    console.log('='.repeat(60) + '\n');

    // Read document to list items
    const debtFilePath = path.join(process.cwd(), 'TECHNICAL_DEBT.md');
    const content = await fs.readFile(debtFilePath, 'utf-8');
    const items = listDebtItems(content);

    if (items.length === 0) {
      console.log('❌ 등록된 기술 부채 항목이 없습니다.');
      process.exit(1);
    }

    // Show available items
    console.log('📋 등록된 항목:');
    items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.id} - ${item.message}`);
    });

    const debtIdInput = await askQuestion(rl, '\n항목 ID 또는 번호를 입력하세요');
    let debtId;

    if (!isNaN(debtIdInput)) {
      const idx = parseInt(debtIdInput, 10) - 1;
      debtId = idx >= 0 && idx < items.length ? items[idx].id : null;
    } else {
      debtId = debtIdInput;
    }

    if (!debtId) {
      console.log('❌ 올바른 항목을 선택해주세요.');
      process.exit(1);
    }

    // Collect updates
    const updates = {};

    console.log('\n🔄 업데이트할 정보를 입력하세요 (선택사항):');

    const statusInput = await askQuestion(rl, '상태 (예: In Progress, 해결됨)');
    if (statusInput) updates.status = statusInput;

    const assigneeInput = await askQuestion(rl, '담당자');
    if (assigneeInput) updates.assignee = assigneeInput;

    const deadlineInput = await askQuestion(rl, '기한 (예: 2025-11-30)');
    if (deadlineInput) updates.deadline = deadlineInput;

    const effortInput = await askQuestion(rl, '예상 소요시간 (예: 2주)');
    if (effortInput) updates.effort = effortInput;

    const noteInput = await askQuestion(rl, '진행 노트');
    if (noteInput) updates.note = noteInput;

    const resolveInput = await askQuestion(rl, '해결됨으로 표시? (y/n)');
    if (resolveInput.toLowerCase() === 'y') updates.resolve = true;

    rl.close();

    return { debtId, ...updates };
  } catch (error) {
    rl.close();
    throw error;
  }
}

/**
 * Update debt item in document
 * @param {string} debtId - Debt item ID
 * @param {object} updates - Updates to apply
 * @returns {Promise<void>}
 */
async function updateDebtItem(debtId, updates) {
  const debtFilePath = path.join(process.cwd(), 'TECHNICAL_DEBT.md');

  try {
    let content = await fs.readFile(debtFilePath, 'utf-8');

    // Find the debt item section
    const itemSection = findDebtItemSection(content, debtId);
    if (!itemSection) {
      console.log(`❌ 항목 ${debtId}를 찾을 수 없습니다.`);
      process.exit(1);
    }

    // Update the section
    const updatedSection = updateDebtItemSection(itemSection.section, updates);

    // Replace in document
    const newContent = content.slice(0, itemSection.startIndex) +
      updatedSection +
      content.slice(itemSection.endIndex);

    await fs.writeFile(debtFilePath, newContent, 'utf-8');

    console.log(`\n✅ 항목 ${debtId} 업데이트 완료!`);
    if (updates.status) console.log(`   📌 상태: ${updates.status}`);
    if (updates.assignee) console.log(`   👤 담당자: ${updates.assignee}`);
    if (updates.deadline) console.log(`   📅 기한: ${updates.deadline}`);
    if (updates.note) console.log(`   💬 노트 추가됨`);

    console.log(`\n📝 보고서: ${debtFilePath}`);
  } catch (error) {
    console.error(`❌ 업데이트 실패:`, error.message);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const args = parseArgs();

    if (args.interactive) {
      // Interactive mode
      const params = await interactiveMode();
      await updateDebtItem(params.debtId, params);
    } else if (args.debtId) {
      // Command line mode
      const updates = {};
      if (args.status) updates.status = args.status;
      if (args.assignee) updates.assignee = args.assignee;
      if (args.note) updates.note = args.note;
      if (args.deadline) updates.deadline = args.deadline;
      if (args.effort) updates.effort = args.effort;
      if (args.resolve) updates.resolve = true;

      await updateDebtItem(args.debtId, updates);
    } else {
      console.log('사용법:');
      console.log('  npm run debt:update                    # 대화형 모드');
      console.log('  npm run debt:update -- --id TD-001 --status "In Progress"');
      process.exit(1);
    }

    console.log('\n' + '='.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

// Handle case when script is run directly
if (require.main === module) {
  main();
}

module.exports = {
  updateDebtItem,
  updateDebtItemSection,
  findDebtItemSection,
  listDebtItems,
  parseDebtItem,
};
