/**
 * AWK spec test runner - executes parsed awk tests against just-bash's awk
 */

import { Bash } from "../../Bash.js";
import type { AwkTestCase } from "./parser.js";

export interface AwkTestResult {
  testCase: AwkTestCase;
  passed: boolean;
  skipped: boolean;
  skipReason?: string;
  /** Test was expected to fail (skip) but unexpectedly passed */
  unexpectedPass?: boolean;
  actualOutput?: string;
  actualStderr?: string;
  actualStatus?: number;
  expectedOutput?: string;
  error?: string;
}

export interface RunOptions {
  /** Custom Bash options */
  bashEnvOptions?: ConstructorParameters<typeof Bash>[0];
}

/**
 * Run a single awk test case
 */
export async function runAwkTestCase(
  testCase: AwkTestCase,
  options: RunOptions = {},
): Promise<AwkTestResult> {
  // Track if test is expected to fail (skip) - we'll still run it
  const expectedToFail = !!testCase.skip;
  const skipReason = testCase.skip;

  // Skip tests that need external files we don't have
  if (testCase.input.startsWith("[file:")) {
    return {
      testCase,
      passed: true,
      skipped: true,
      skipReason: `Requires external file: ${testCase.input}`,
    };
  }

  // Skip tests with no expected output (parser couldn't extract it)
  // These tests would trivially pass with empty output matching empty expected
  if (!testCase.expectedOutput && testCase.skip) {
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
    // Build the awk command
    let script: string;

    // Build the -F flag if a field separator is specified
    const fsFlag = testCase.fieldSeparator
      ? `-F'${testCase.fieldSeparator.replace(/'/g, "'\\''")}' `
      : "";

    // Build -v var=value flags for command-line variable assignments
    const varsFlag = testCase.vars
      ? `${Object.entries(testCase.vars)
          .map(([k, v]) => `-v ${k}='${v.replace(/'/g, "'\\''")}'`)
          .join(" ")} `
      : "";

    // Build command-line args string (for ARGV/ARGC tests)
    const argsStr = testCase.args
      ? " " +
        testCase.args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")
      : "";

    // For heredoc-style tests (which have fieldSeparator set), even empty input
    // should be piped to awk as an empty line. We detect this by checking if
    // fieldSeparator is set, since those tests always have input (even if empty).
    const hasInput =
      testCase.input.length > 0 || testCase.fieldSeparator !== undefined;

    if (hasInput) {
      // Escape single quotes in input for the echo command
      const escapedInput = testCase.input.replace(/'/g, "'\\''");
      script = `echo '${escapedInput}' | awk ${fsFlag}${varsFlag}'${testCase.program.replace(/'/g, "'\\''")}'${argsStr}`;
    } else {
      script = `awk ${fsFlag}${varsFlag}'${testCase.program.replace(/'/g, "'\\''")}'${argsStr} </dev/null`;
    }

    const result = await env.exec(script);

    const actualOutput = normalizeOutput(result.stdout);
    const expectedOutput = normalizeOutput(testCase.expectedOutput);

    let passed = actualOutput === expectedOutput;

    // Also check exit status if specified
    if (testCase.expectedStatus !== undefined) {
      passed = passed && result.exitCode === testCase.expectedStatus;
    }

    // Handle skip tests: if expected to fail but actually passed, that's an unexpected pass
    if (expectedToFail) {
      if (passed) {
        // Test was expected to fail but passed - report as failure so we can unskip it
        return {
          testCase,
          passed: false,
          skipped: false,
          unexpectedPass: true,
          actualOutput: result.stdout,
          actualStderr: result.stderr,
          actualStatus: result.exitCode,
          expectedOutput: testCase.expectedOutput,
          error: `UNEXPECTED PASS: This test was marked skip (${skipReason}) but now passes. Please remove the skip.`,
        };
      }
      // Test was expected to fail and did fail - that's fine, mark as skipped
      return {
        testCase,
        passed: true,
        skipped: true,
        skipReason: `skip: ${skipReason}`,
        actualOutput: result.stdout,
        actualStderr: result.stderr,
        actualStatus: result.exitCode,
        expectedOutput: testCase.expectedOutput,
      };
    }

    return {
      testCase,
      passed,
      skipped: false,
      actualOutput: result.stdout,
      actualStderr: result.stderr,
      actualStatus: result.exitCode,
      expectedOutput: testCase.expectedOutput,
      error: passed
        ? undefined
        : `Output mismatch:\n  expected: ${JSON.stringify(expectedOutput)}\n  actual:   ${JSON.stringify(actualOutput)}`,
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
 * Normalize output for comparison
 */
function normalizeOutput(output: string): string {
  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}

/**
 * Format error message for debugging
 */
export function formatError(result: AwkTestResult): string {
  const lines: string[] = [];

  if (result.error) {
    lines.push(result.error);
    lines.push("");
  }

  lines.push("OUTPUT:");
  lines.push(`  expected: ${JSON.stringify(result.expectedOutput ?? "")}`);
  lines.push(`  actual:   ${JSON.stringify(result.actualOutput ?? "")}`);

  if (result.actualStderr) {
    lines.push("STDERR:");
    lines.push(`  ${JSON.stringify(result.actualStderr)}`);
  }

  lines.push("");
  lines.push("PROGRAM:");
  lines.push(result.testCase.program);

  if (result.testCase.input) {
    lines.push("");
    lines.push("INPUT:");
    lines.push(result.testCase.input);
  }

  return lines.join("\n");
}
