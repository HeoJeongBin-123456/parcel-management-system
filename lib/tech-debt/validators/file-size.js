/**
 * File Size Validator
 * Checks against constitution: I. Clean Code Principles (max 500 lines)
 */

const config = require('../config');
const { getFileLineCount } = require('../utils/file-reader');

/**
 * Check if file exceeds max line count
 * @param {string} filePath - File path
 * @returns {Promise<object|null>} Violation object or null
 */
async function validateFileSize(filePath) {
  try {
    const lineCount = await getFileLineCount(filePath);
    const { maxFileLines } = config;

    if (lineCount > maxFileLines) {
      return {
        id: 'FILE_SIZE_VIOLATION',
        file: filePath,
        type: 'FILE_SIZE',
        severity: lineCount > maxFileLines * 3 ? 'Critical' : 'High',
        principle: 'I. Clean Code Principles',
        lineCount,
        maxLineCount: maxFileLines,
        message: `File exceeds ${maxFileLines} lines (${lineCount} lines, ${(lineCount / maxFileLines).toFixed(1)}x limit)`,
        lineStart: 1,
        lineEnd: lineCount,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error validating file size for ${filePath}:`, error.message);
    return null;
  }
}

module.exports = {
  validateFileSize,
};
