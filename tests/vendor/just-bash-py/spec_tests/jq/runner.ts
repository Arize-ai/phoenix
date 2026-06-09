/**
 * JQ spec test runner - executes parsed jq tests against just-bash's jq
 */

import { Bash } from "../../Bash.js";
import type { JqTestCase } from "./parser.js";

export interface JqTestResult {
  testCase: JqTestCase;
  passed: boolean;
  skipped: boolean;
  skipReason?: string;
  /** Test was expected to fail (skip) but unexpectedly passed */
  unexpectedPass?: boolean;
  actualOutputs?: string[];
  actualStderr?: string;
  actualStatus?: number;
  expectedOutputs?: string[];
  error?: string;
}

export interface RunOptions {
  /** Custom Bash options */
  bashEnvOptions?: ConstructorParameters<typeof Bash>[0];
}

/**
 * Run a single jq test case
 */
export async function runJqTestCase(
  testCase: JqTestCase,
  options: RunOptions = {},
): Promise<JqTestResult> {
  // Track if test is expected to fail (skip) - we'll still run it
  const expectedToFail = !!testCase.skip;
  const skipReason = testCase.skip;

  // Skip tests with no expected output (unless it's an error test)
  if (
    !testCase.expectsError &&
    testCase.expectedOutputs.length === 0 &&
    testCase.skip
  ) {
    return {
      testCase,
      passed: true,
      skipped: true,
      skipReason: `No expected output (parser issue): ${testCase.skip}`,
    };
  }

  // Create a fresh Bash for each test
  const env = new Bash({
    files: {
      "/tmp/_keep": "",
    },
    cwd: "/tmp",
    env: {
      HOME: "/tmp",
    },
    ...options.bashEnvOptions,
  });

  try {
    // Build the jq command
    // Escape single quotes in program and input
    const escapedProgram = testCase.program.replace(/'/g, "'\\''");
    const escapedInput = testCase.input.replace(/'/g, "'\\''");

    // Use -c for compact output
    const script = `echo '${escapedInput}' | jq -c '${escapedProgram}'`;

    const result = await env.exec(script);

    if (testCase.expectsError) {
      // For error tests, we expect non-zero exit code and error message
      const gotError = result.exitCode !== 0 || result.stderr.length > 0;

      const passed = gotError;

      // Handle skip tests
      if (expectedToFail) {
        if (passed) {
          return {
            testCase,
            passed: false,
            skipped: false,
            unexpectedPass: true,
            actualOutputs: result.stdout
              ? result.stdout.split("\n").filter((l) => l)
              : [],
            actualStderr: result.stderr,
            actualStatus: result.exitCode,
            expectedOutputs: testCase.expectedOutputs,
            error: `UNEXPECTED PASS: This test was marked skip (${skipReason}) but now passes. Please remove the skip.`,
          };
        }
        return {
          testCase,
          passed: true,
          skipped: true,
          skipReason: `skip: ${skipReason}`,
          actualStderr: result.stderr,
          actualStatus: result.exitCode,
        };
      }

      return {
        testCase,
        passed,
        skipped: false,
        actualStderr: result.stderr,
        actualStatus: result.exitCode,
        error: passed
          ? undefined
          : `Expected error but got success with output: ${result.stdout}`,
      };
    }

    // For normal tests, compare outputs
    const actualOutputs = normalizeOutputs(result.stdout);
    const expectedOutputs = testCase.expectedOutputs.map((o) => o.trim());

    const passed = arraysEqual(actualOutputs, expectedOutputs);

    // Handle skip tests
    if (expectedToFail) {
      if (passed) {
        return {
          testCase,
          passed: false,
          skipped: false,
          unexpectedPass: true,
          actualOutputs,
          actualStderr: result.stderr,
          actualStatus: result.exitCode,
          expectedOutputs,
          error: `UNEXPECTED PASS: This test was marked skip (${skipReason}) but now passes. Please remove the skip.`,
        };
      }
      return {
        testCase,
        passed: true,
        skipped: true,
        skipReason: `skip: ${skipReason}`,
        actualOutputs,
        actualStderr: result.stderr,
        actualStatus: result.exitCode,
        expectedOutputs,
      };
    }

    return {
      testCase,
      passed,
      skipped: false,
      actualOutputs,
      actualStderr: result.stderr,
      actualStatus: result.exitCode,
      expectedOutputs,
      error: passed
        ? undefined
        : `Output mismatch:\n  expected: ${JSON.stringify(expectedOutputs)}\n  actual:   ${JSON.stringify(actualOutputs)}`,
    };
  } catch (e) {
    // If test was expected to fail and threw an error, that counts as expected failure
    if (expectedToFail) {
      return {
        testCase,
        passed: true,
        skipped: true,
        skipReason: `skip: ${skipReason}`,
        error: `Execution error (expected): ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    return {
      testCase,
      passed: false,
      skipped: false,
      error: `Execution error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Normalize outputs for comparison
 */
function normalizeOutputs(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Normalize a JSON string to canonical form for comparison
 * This handles differences in whitespace (e.g., "key": 1 vs "key":1)
 */
function normalizeJson(s: string): string {
  try {
    const parsed = JSON.parse(s);
    return JSON.stringify(parsed);
  } catch {
    // If it's not valid JSON, return as-is
    return s;
  }
}

/**
 * Compare two arrays for equality, with JSON normalization
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    // Normalize both values to handle JSON formatting differences
    if (normalizeJson(a[i]) !== normalizeJson(b[i])) return false;
  }
  return true;
}

/**
 * Format error message for debugging
 */
export function formatError(result: JqTestResult): string {
  const lines: string[] = [];

  if (result.error) {
    lines.push(result.error);
    lines.push("");
  }

  lines.push("OUTPUT:");
  lines.push(`  expected: ${JSON.stringify(result.expectedOutputs ?? [])}`);
  lines.push(`  actual:   ${JSON.stringify(result.actualOutputs ?? [])}`);

  if (result.actualStderr) {
    lines.push("STDERR:");
    lines.push(`  ${JSON.stringify(result.actualStderr)}`);
  }

  lines.push("");
  lines.push("PROGRAM:");
  lines.push(result.testCase.program);

  lines.push("");
  lines.push("INPUT:");
  lines.push(result.testCase.input);

  return lines.join("\n");
}
