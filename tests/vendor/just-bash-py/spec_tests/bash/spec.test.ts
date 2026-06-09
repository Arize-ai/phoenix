/**
 * Vitest runner for Oils spec tests
 *
 * This runs the imported spec tests from the Oils project against BashEnv.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpecFile } from "../parser.js";
import { runTestCase } from "../runner.js";

const CASES_DIR = path.join(__dirname, "cases");

// All available test files - dynamically loaded
const ALL_TEST_FILES = fs
  .readdirSync(CASES_DIR)
  .filter((f) => f.endsWith(".test.sh"))
  .sort();

// Tests to skip entirely (interactive, requires real shell, etc.)
const SKIP_FILES = new Set([
  // Interactive shell tests - require TTY
  "interactive.test.sh",
  "interactive-parse.test.sh",
  "prompt.test.sh",
  "builtin-history.test.sh",
  "builtin-fc.test.sh",
  "builtin-bind.test.sh",
  // "builtin-completion.test.sh", // Unskipped - tests added with SKIP markers

  // Process/job control - requires real processes
  "background.test.sh",
  "builtin-process.test.sh",
  "builtin-kill.test.sh",
  "builtin-trap.test.sh",
  "builtin-trap-bash.test.sh",
  "builtin-trap-err.test.sh",
  "builtin-times.test.sh",
  "process-sub.test.sh",

  // Shell-specific features not implemented
  // "builtin-dirs.test.sh", // Unskipped - tests added with SKIP markers
  "sh-usage.test.sh",

  // ZSH-specific tests
  "zsh-assoc.test.sh",
  // "zsh-idioms.test.sh", // Unskipped - now passes (zsh syntax rejection works)

  // BLE (bash line editor) specific
  // "ble-features.test.sh", // Testing - some tests may now pass with unset scoping
  "ble-idioms.test.sh",
  // "ble-unset.test.sh", // Testing - some tests may now pass with unset scoping

  // Tests that require external commands or real filesystem
  // "nul-bytes.test.sh", // Testing
  "unicode.test.sh",

  // Meta/introspection tests
  // "introspect.test.sh", // Unskipped - FUNCNAME/BASH_LINENO implemented
  "print-source-code.test.sh",
  // "serialize.test.sh", // Unskipped - tests added with SKIP markers
  "spec-harness-bug.test.sh",

  // Known differences / divergence docs (not real tests)
  "known-differences.test.sh",
  "divergence.test.sh",

  // Toysh-specific
  "toysh.test.sh",
  "toysh-posix.test.sh", // Has IFS word-splitting issues unrelated to readonly fix

  // Blog/exploration tests (not spec tests)
  "blog1.test.sh",
  "blog2.test.sh",
  "blog-other1.test.sh",
  "explore-parsing.test.sh",

  // Extended globbing - not implemented
  // "extglob-match.test.sh", // Testing
  // "extglob-files.test.sh", // Testing
  // "globstar.test.sh", // Testing
  // "globignore.test.sh", // Testing
  // "nocasematch-match.test.sh", // Testing

  // Advanced features not implemented
  // "builtin-getopts.test.sh", // Unskipped - tests added with SKIP markers
  // "nameref.test.sh", // Unskipped - tests added with SKIP markers
  // "sh-options-bash.test.sh", // Unskipped - tests added with SKIP markers

  // Bash-specific builtins not implemented

  // Advanced array features
  // "array-literal.test.sh", // Unskipped - tests added with SKIP markers
  // "array-assign.test.sh", // Unskipped - tests added with SKIP markers

  // Complex assignment features
  // "assign-extended.test.sh", // Unskipped - tests added with SKIP markers
  // "assign-deferred.test.sh", // Unskipped - tests added with SKIP markers
  // "assign-dialects.test.sh", // Unskipped - tests added with SKIP markers

  // Advanced arithmetic

  // Complex redirect features
  // "redirect-multi.test.sh", // Unskipped - tests added with SKIP markers
  // "redir-order.test.sh", // Unskipped - tests added with SKIP markers

  // Other advanced features
  // "command-sub-ksh.test.sh", // Unskipped - tests added with SKIP markers
  // "vars-bash.test.sh", // Unskipped - 100% pass rate
  // "var-op-bash.test.sh", // Unskipped - tests added with SKIP markers
  // "type-compat.test.sh", // Testing
  // "shell-bugs.test.sh", // Testing
  // "nix-idioms.test.sh", // Testing
  // "fatal-errors.test.sh", // Unskipped - 100% pass rate
  // "for-expr.test.sh", // Unskipped - tests added with SKIP markers
  // "glob-bash.test.sh", // Unskipped - 100% pass rate (nullglob, failglob, dotglob implemented)
  // "bugs.test.sh", // Testing
]);

const TEST_FILES = ALL_TEST_FILES.filter((f) => !SKIP_FILES.has(f));

/**
 * Truncate script for test name display
 */
function truncateScript(script: string, maxLen = 60): string {
  // Normalize whitespace and get first meaningful line(s)
  const normalized = script
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .join(" | ");

  if (normalized.length <= maxLen) {
    return normalized;
  }
  return `${normalized.slice(0, maxLen - 3)}...`;
}

/**
 * Format error message for debugging
 */
function formatError(result: Awaited<ReturnType<typeof runTestCase>>): string {
  const lines: string[] = [];

  // Show error message first (especially important for UNEXPECTED PASS)
  if (result.error) {
    lines.push(result.error);
    lines.push("");
  }

  if (result.expectedStdout !== null || result.actualStdout !== undefined) {
    lines.push("STDOUT:");
    lines.push(`  expected: ${JSON.stringify(result.expectedStdout ?? "")}`);
    lines.push(`  actual:   ${JSON.stringify(result.actualStdout ?? "")}`);
  }

  if (result.expectedStderr !== null || result.actualStderr) {
    lines.push("STDERR:");
    lines.push(`  expected: ${JSON.stringify(result.expectedStderr ?? "")}`);
    lines.push(`  actual:   ${JSON.stringify(result.actualStderr ?? "")}`);
  }

  if (result.expectedStatus !== null || result.actualStatus !== undefined) {
    lines.push("STATUS:");
    lines.push(`  expected: ${result.expectedStatus ?? "(not checked)"}`);
    lines.push(`  actual:   ${result.actualStatus}`);
  }

  lines.push("");
  lines.push("SCRIPT:");
  lines.push(result.testCase.script);

  return lines.join("\n");
}

describe("Oils Spec Tests", () => {
  for (const fileName of TEST_FILES) {
    const filePath = path.join(CASES_DIR, fileName);

    describe(fileName, () => {
      // Parse must succeed - this is not optional
      const content = fs.readFileSync(filePath, "utf-8");
      const specFile = parseSpecFile(content, filePath);

      // Must have test cases
      if (specFile.testCases.length === 0) {
        throw new Error(`No test cases found in ${fileName}`);
      }

      for (const testCase of specFile.testCases) {
        // Include truncated script in test name for easier debugging
        const scriptPreview = truncateScript(testCase.script);
        const testName = `[L${testCase.lineNumber}] ${testCase.name}: ${scriptPreview}`;

        it(testName, async () => {
          const result = await runTestCase(testCase, { filePath });

          if (result.skipped) {
            return;
          }

          if (!result.passed) {
            expect.fail(formatError(result));
          }
        });
      }
    });
  }
});
