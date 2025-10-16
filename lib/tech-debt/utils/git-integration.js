/**
 * Git Integration Utilities for Tech Debt Scanner
 */

const { execSync } = require('child_process');
const path = require('path');

/**
 * Get git repository root
 * @returns {string|null} Git root path or null
 */
function getGitRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    console.warn('⚠️  Not a git repository');
    return null;
  }
}

/**
 * Get list of changed files
 * @returns {string[]} Array of file paths
 */
function getChangedFiles() {
  try {
    const gitRoot = getGitRoot();
    if (!gitRoot) return [];

    // Get unstaged and staged changes
    const output = execSync('git diff --name-only --diff-filter=ACMR', {
      encoding: 'utf-8',
      cwd: gitRoot,
    });

    return output
      .split('\n')
      .filter((file) => file.endsWith('.js') && file.length > 0)
      .map((file) => path.join(gitRoot, file));
  } catch {
    console.warn('⚠️  Error getting changed files');
    return [];
  }
}

/**
 * Get file modification time
 * @param {string} filePath - File path
 * @returns {Date|null} Last modified time or null
 */
function getFileModificationTime(filePath) {
  try {
    const output = execSync(`git log -1 --format=%aI "${filePath}"`, {
      encoding: 'utf-8',
    }).trim();
    return output ? new Date(output) : null;
  } catch {
    return null;
  }
}

/**
 * Check if file was modified in last N days
 * @param {string} filePath - File path
 * @param {number} days - Number of days
 * @returns {boolean} True if modified within N days
 */
function isModifiedWithinDays(filePath, days = 7) {
  const modTime = getFileModificationTime(filePath);
  if (!modTime) return false;

  const now = new Date();
  const diffTime = now - modTime;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  return diffDays <= days;
}

module.exports = {
  getGitRoot,
  getChangedFiles,
  getFileModificationTime,
  isModifiedWithinDays,
};
