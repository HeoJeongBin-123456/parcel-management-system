/**
 * Hardcoding Detection Validator
 * Checks against constitution: II. No Hard Coding
 */

const config = require('../config');

/**
 * Find hardcoded secrets in file content
 * @param {string} content - File content
 * @param {string} filePath - File path
 * @returns {object[]} Array of violations
 */
function findHardcodedSecrets(content, filePath) {
  const violations = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Skip comments and empty lines
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || !line.trim()) {
      return;
    }

    config.secretPatterns.forEach((pattern) => {
      if (pattern.test(line)) {
        violations.push({
          id: 'HARDCODED_SECRET',
          file: filePath,
          type: 'HARDCODED_SECRET',
          severity: 'High',
          principle: 'II. No Hard Coding',
          lineNumber: index + 1,
          message: `Hardcoded secret detected: ${line.substring(0, 50).trim()}...`,
          lineStart: index + 1,
          lineEnd: index + 1,
          suggestion: 'Move this value to .env file or config.js',
        });
      }
    });
  });

  return violations;
}

/**
 * Validate for hardcoded secrets
 * @param {string} filePath - File path
 * @param {string} content - File content
 * @returns {Promise<object[]>} Array of violations
 */
async function validateHardcoding(filePath, content) {
  try {
    return findHardcodedSecrets(content, filePath);
  } catch (error) {
    console.error(`Error validating hardcoding for ${filePath}:`, error.message);
    return [];
  }
}

module.exports = {
  validateHardcoding,
  findHardcodedSecrets,
};
