/**
 * Naming Convention Validator
 * Checks against constitution: IV. Clear Naming Conventions
 */

/**
 * Validate naming conventions
 * @param {string} content - File content
 * @param {string} filePath - File path
 * @returns {object[]} Array of violations (summary only)
 */
function validateNaming(content, filePath) {
  // For MVP, return summary only (detailed AST parsing would require more complex setup)
  // In production, would use esprima or similar for proper AST analysis

  const violations = [];

  // Simple pattern-based checks
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Check for common abbreviations
    if (/usr|pwd|msg|num|str|arr|obj|fn/.test(line)) {
      // Lightweight check - only flag if it looks like a variable declaration
      if (/(?:const|let|var|function)\s+\w+/.test(line)) {
        violations.push({
          id: 'NAMING_CONVENTION',
          file: filePath,
          type: 'NAMING',
          severity: 'Low',
          principle: 'IV. Clear Naming Conventions',
          lineNumber: index + 1,
          message: `Abbreviation detected in naming (usr, pwd, msg, etc.)`,
          lineStart: index + 1,
          lineEnd: index + 1,
          suggestion: 'Use full words: user, password, message, etc.',
        });
      }
    }
  });

  return violations;
}

module.exports = {
  validateNaming,
};
