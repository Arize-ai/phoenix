/**
 * Vitest runner for jq spec tests
 *
 * This runs the imported spec tests from the jqlang/jq project against just-bash's jq.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseJqTestFile } from "./parser.js";
import { formatError, runJqTestCase } from "./runner.js";
import { getSkipReason, isFileSkipped } from "./skips.js";

const CASES_DIR = path.join(__dirname, "cases");

// Get all .test files
const ALL_TEST_FILES = fs
  .readdirSync(CASES_DIR)
  .filter((f) => f.endsWith(".test"))
  .sort();

// Filter out completely skipped files
const TEST_FILES = ALL_TEST_FILES.filter((f) => !isFileSkipped(f));

/**
 * Truncate program for test name display
 */
function truncateProgram(program: string, maxLen = 50): string {
  const normalized = program.trim();
  if (normalized.length <= maxLen) {
    return normalized;
  }
  return `${normalized.slice(0, maxLen - 3)}...`;
}

describe("JQ Spec Tests", () => {
  // Add a placeholder test to ensure suite is not empty when all files are skipped
  if (TEST_FILES.length === 0) {
    it("All test files are currently skipped", () => {
      // This test passes - it's just a placeholder
    });
  }

  for (const fileName of TEST_FILES) {
    const filePath = path.join(CASES_DIR, fileName);

    describe(fileName, () => {
      // Parse the test file
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = parseJqTestFile(content, filePath);

      // Skip files with no parseable tests
      if (parsed.testCases.length === 0) {
        it.skip("No parseable tests", () => {});
        return;
      }

      for (const testCase of parsed.testCases) {
        // Check for individual test skip
        // For error tests, only check exact SKIP_TESTS matches (not patterns)
        // to avoid broad patterns marking error tests that actually pass
        const skipReason = getSkipReason(
          fileName,
          testCase.name,
          testCase.program,
          testCase.input,
          testCase.expectsError,
        );
        if (skipReason) {
          testCase.skip = skipReason;
        }

        const programPreview = truncateProgram(testCase.program);
        const testName = `[L${testCase.lineNumber}] ${programPreview}`;

        it(testName, async () => {
          const result = await runJqTestCase(testCase);

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
