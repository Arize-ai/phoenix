/**
 * SED spec test runner - executes parsed sed tests against just-bash's sed
 */

import { Bash } from "../../Bash.js";
import type { SedTestCase } from "./parser.js";

export interface SedTestResult {
  testCase: SedTestCase;
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
 * Run a single sed test case
 */
export async function runSedTestCase(
  testCase: SedTestCase,
  options: RunOptions = {},
): Promise<SedTestResult> {
  // Track if test is expected to fail (skip) - we'll still run it
  const expectedToFail = !!testCase.skip;
  const skipReason = testCase.skip;

  // Create files object
  const files: Record<string, string> = {
    "/tmp/_keep": "",
  };

  // Add input file if specified (even if empty, for tests that reference it)
  // Also create the file if the command references "input" (for empty file tests)
  if (testCase.infile || testCase.command.includes("input")) {
    files["/tmp/input"] = testCase.infile;
  }

  // Create a fresh Bash for each test
  const env = new Bash({
    files,
    cwd: "/tmp",
    env: {
      HOME: "/tmp",
    },
    ...options.bashEnvOptions,
  });

  try {
    // Build the command
    let command = testCase.command;

    // Replace "input" file reference with /tmp/input
    command = command.replace(/\binput\b/g, "/tmp/input");

    // If there's stdin, pipe it
    let script: string;
    if (testCase.stdin) {
      const escapedStdin = testCase.stdin.replace(/'/g, "'\\''");
      // Use printf instead of echo -n for better compatibility
      script = `printf '%s' '${escapedStdin}' | ${command}`;
    } else {
      script = command;
    }

    const result = await env.exec(script);

    const actualOutput = result.stdout;
    const expectedOutput = testCase.expectedOutput;

    // Handle special "???" marker meaning "expect error"
    // Test passes if there's an error (non-empty stderr or non-zero exit code)
    const expectError = expectedOutput === "???";
    const passed = expectError
      ? result.stderr !== "" || result.exitCode !== 0
      : actualOutput === expectedOutput;

    // Handle skip tests
    if (expectedToFail) {
      if (passed) {
        return {
          testCase,
          passed: false,
          skipped: false,
          unexpectedPass: true,
          actualOutput,
          actualStderr: result.stderr,
          actualStatus: result.exitCode,
          expectedOutput,
          error: `UNEXPECTED PASS: This test was marked skip (${skipReason}) but now passes. Please remove the skip.`,
        };
      }
      return {
        testCase,
        passed: true,
        skipped: true,
        skipReason: `skip: ${skipReason}`,
        actualOutput,
        actualStderr: result.stderr,
        actualStatus: result.exitCode,
        expectedOutput,
      };
    }

    return {
      testCase,
      passed,
      skipped: false,
      actualOutput,
      actualStderr: result.stderr,
      actualStatus: result.exitCode,
      expectedOutput,
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
 * Format error message for debugging
 */
export function formatError(result: SedTestResult): string {
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
  lines.push("COMMAND:");
  lines.push(result.testCase.command);

  if (result.testCase.stdin) {
    lines.push("");
    lines.push("STDIN:");
    lines.push(result.testCase.stdin);
  }

  if (result.testCase.infile) {
    lines.push("");
    lines.push("INFILE:");
    lines.push(result.testCase.infile);
  }

  return lines.join("\n");
}
