/**
 * Vitest runner for onetrueawk spec tests
 *
 * This runs the imported spec tests from the onetrueawk project against just-bash's awk.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAwkTestFile } from "./parser.js";
import { formatError, runAwkTestCase } from "./runner.js";
import { getSkipReason, isFileSkipped } from "./skips.js";

const CASES_DIR = path.join(__dirname, "cases");

// Get all T.* test files (the systematic test scripts)
// Filter: starts with T., no file extension (no second dot)
const ALL_TEST_FILES = fs
  .readdirSync(CASES_DIR)
  .filter((f) => f.startsWith("T.") && f.indexOf(".", 2) === -1)
  .sort();

// Filter out completely skipped files
const TEST_FILES = ALL_TEST_FILES.filter((f) => !isFileSkipped(f));

/**
 * Truncate program for test name display
 */
function truncateProgram(program: string, maxLen = 50): string {
  const normalized = program
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l)
    .join(" ");

  if (normalized.length <= maxLen) {
    return normalized;
  }
  return `${normalized.slice(0, maxLen - 3)}...`;
}

describe("OneTrue AWK Spec Tests", () => {
  for (const fileName of TEST_FILES) {
    const filePath = path.join(CASES_DIR, fileName);

    describe(fileName, () => {
      // Parse the test file
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = parseAwkTestFile(content, filePath);

      // Skip files with no parseable tests
      if (parsed.testCases.length === 0) {
        it.skip("No parseable tests", () => {});
        return;
      }

      for (const testCase of parsed.testCases) {
        // Check for individual test skip (pass program for pattern matching)
        const skipReason = getSkipReason(
          fileName,
          testCase.name,
          testCase.program,
        );
        if (skipReason) {
          testCase.skip = skipReason;
        }

        const programPreview = truncateProgram(testCase.program);
        const testName = `[L${testCase.lineNumber}] ${testCase.name}: ${programPreview}`;

        it(testName, async () => {
          const result = await runAwkTestCase(testCase);

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
