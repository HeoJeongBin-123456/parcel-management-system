#!/usr/bin/env node

/**
 * Technical Debt Scanner
 * Main entry point for scanning codebase for constitution violations
 */

const fs = require('fs').promises;
const glob = require('glob');
const config = require('./config');
const { readFileContent } = require('./utils/file-reader');
const { getChangedFiles } = require('./utils/git-integration');
const { validateFileSize } = require('./validators/file-size');
const { validateHardcoding } = require('./validators/hardcoding');
const { validateNaming } = require('./validators/naming');
const { generateMarkdownReport } = require('./reporters/markdown');

/**
 * Parse command line arguments
 * @returns {object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    quick: args.includes('--quick'),
    full: args.includes('--full'),
    output: args[args.indexOf('--output') + 1] || config.report.output,
    format: args[args.indexOf('--format') + 1] || 'markdown',
    dryRun: args.includes('--dry-run'),
    silent: args.includes('--silent'),
    severity: args[args.indexOf('--severity') + 1]?.split(',') || ['Critical', 'High', 'Medium', 'Low'],
  };
}

/**
 * Get files to scan
 * @param {object} options - Scan options
 * @returns {string[]} Array of file paths
 */
function getFilesToScan(options) {
  if (options.quick) {
    return getChangedFiles();
  }

  // Full scan using glob patterns
  const files = [];
  config.include.forEach((pattern) => {
    const matchedFiles = glob.sync(pattern, {
      ignore: config.exclude,
      cwd: process.cwd(),
    });
    files.push(...matchedFiles);
  });

  return [...new Set(files)]; // Remove duplicates
}

/**
 * Scan single file for violations
 * @param {string} filePath - File path to scan
 * @returns {Promise<object[]>} Array of violations
 */
async function scanFile(filePath) {
  const violations = [];

  try {
    // File size validation
    const sizeViolation = await validateFileSize(filePath);
    if (sizeViolation) {
      violations.push(sizeViolation);
    }

    // Hardcoding validation
    const content = await readFileContent(filePath);
    const hardcodingViolations = await validateHardcoding(filePath, content);
    violations.push(...hardcodingViolations);

    // Naming validation
    const namingViolations = validateNaming(content, filePath);
    violations.push(...namingViolations);

    return violations;
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Main scan function
 * @param {object} options - Scan options
 * @returns {Promise<object>} Scan results
 */
async function scanCodebase(options) {
  const startTime = Date.now();

  if (!options.silent) {
    console.log('🔍 기술 부채 스캔 시작...');
  }

  const filesToScan = getFilesToScan(options);

  if (!options.silent) {
    console.log(`📂 ${filesToScan.length}개 파일 검사 중...`);
  }

  // Scan files in parallel with concurrency limit
  const violations = [];
  const batchSize = config.performance.maxConcurrency;

  for (let i = 0; i < filesToScan.length; i += batchSize) {
    const batch = filesToScan.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((file) => scanFile(file)));
    violations.push(...batchResults.flat());
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Filter by severity
  const filteredViolations = violations.filter((v) => options.severity.includes(v.severity));

  // Count by severity
  const summary = {
    Critical: filteredViolations.filter((v) => v.severity === 'Critical').length,
    High: filteredViolations.filter((v) => v.severity === 'High').length,
    Medium: filteredViolations.filter((v) => v.severity === 'Medium').length,
    Low: filteredViolations.filter((v) => v.severity === 'Low').length,
  };

  if (!options.silent) {
    console.log(`✓ ${filesToScan.length}개 파일 스캔 완료 (${duration}초)`);
    console.log(`⚠️  위반 항목: ${filteredViolations.length}개`);
    console.log('');
    console.log('심각도별 분포:');
    console.log(`  Critical: ${summary.Critical}`);
    console.log(`  High: ${summary.High}`);
    console.log(`  Medium: ${summary.Medium}`);
    console.log(`  Low: ${summary.Low}`);
  }

  return {
    scanDate: new Date().toISOString(),
    filesScanned: filesToScan.length,
    violations: filteredViolations,
    summary,
    duration,
  };
}

/**
 * Main entry point
 */
async function main() {
  try {
    const options = parseArgs();
    const results = await scanCodebase(options);

    if (options.format === 'markdown' && !options.dryRun) {
      const report = generateMarkdownReport(results);
      await fs.writeFile(options.output, report, 'utf-8');

      if (!options.silent) {
        console.log(`\n📝 보고서 저장: ${options.output}`);
      }
    }

    process.exit(results.summary.Critical > 0 ? 2 : results.violations.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ 스캔 실패:', error.message);
    process.exit(99);
  }
}

// Handle case when script is run directly
if (require.main === module) {
  main();
}

module.exports = {
  scanCodebase,
  scanFile,
  getFilesToScan,
};
