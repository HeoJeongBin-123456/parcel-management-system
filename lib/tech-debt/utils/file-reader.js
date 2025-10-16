/**
 * File Reader Utilities for Tech Debt Scanner
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Get line count of a file
 * @param {string} filePath - File path
 * @returns {Promise<number>} Line count
 */
async function getFileLineCount(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.split('\n').length - 1; // -1 for empty last line
  } catch (error) {
    if (error.code === 'EACCES') {
      console.warn(`⚠️  Permission denied: ${filePath}`);
    } else if (error.code === 'ENOENT') {
      console.warn(`⚠️  File not found: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Read file content
 * @param {string} filePath - File path
 * @returns {Promise<string>} File content
 */
async function readFileContent(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if (error.code === 'EACCES') {
      throw new Error(`Permission denied: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Get file stats
 * @param {string} filePath - File path
 * @returns {Promise<object>} File stats
 */
async function getFileStats(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    console.warn(`⚠️  Cannot stat file: ${filePath}`);
    return null;
  }
}

/**
 * Check if file is JavaScript
 * @param {string} filePath - File path
 * @returns {boolean} Is JavaScript
 */
function isJavaScriptFile(filePath) {
  return /\.js$/.test(filePath);
}

/**
 * Get relative path from project root
 * @param {string} filePath - Absolute file path
 * @returns {string} Relative path
 */
function getRelativePath(filePath) {
  const projectRoot = process.cwd();
  return path.relative(projectRoot, filePath);
}

module.exports = {
  getFileLineCount,
  readFileContent,
  getFileStats,
  isJavaScriptFile,
  getRelativePath,
};
