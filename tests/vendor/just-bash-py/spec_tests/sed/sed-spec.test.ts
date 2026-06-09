/**
 * Vitest runner for sed spec tests
 *
 * This runs the imported spec tests from BusyBox and other sources
 * against just-bash's sed implementation.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSedTestFile } from "./parser.js";
import { formatError, runSedTestCase } from "./runner.js";
import { getSkipReason, isFileSkipped } from "./skips.js";

const CASES_DIR = path.join(__dirname, "cases");

// Get all .tests and .suite files
const ALL_TEST_FILES = fs
  .readdirSync(CASES_DIR)
  .filter((f) => f.endsWith(".tests") || f.endsWith(".suite"))
  .sort();

// Filter out completely skipped files
const TEST_FILES = ALL_TEST_FILES.filter((f) => !isFileSkipped(f));

/**
 * Truncate command for test name display
 */
function truncateCommand(command: string, maxLen = 50): string {
  const normalized = command.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLen) {
    return normalized;
  }
  return `${normalized.slice(0, maxLen - 3)}...`;
}

describe("SED Spec Tests", () => {
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
      const parsed = parseSedTestFile(content, filePath);

      // Skip files with no parseable tests
      if (parsed.testCases.length === 0) {
        it.skip("No parseable tests", () => {});
        return;
      }

      for (const testCase of parsed.testCases) {
        // Check for individual test skip
        const skipReason = getSkipReason(
          fileName,
          testCase.name,
          testCase.command,
        );
        if (skipReason) {
          testCase.skip = skipReason;
        }

        const commandPreview = truncateCommand(testCase.command);
        const testName = `[L${testCase.lineNumber}] ${testCase.name}: ${commandPreview}`;

        it(testName, async () => {
          const result = await runSedTestCase(testCase);

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
