/**
 * Parser for grep test formats
 *
 * Supports:
 * - BusyBox format: testing "description" "commands" "result" "infile" "stdin"
 * - GNU grep format: exit_code@pattern@test_string[@note]
 */

import {
  type BusyBoxTestCase,
  type ParsedBusyBoxTestFile,
  parseBusyBoxTests,
} from "../../test-utils/busybox-test-parser.js";

// Re-export types with grep-specific names
export type GrepTestCase = BusyBoxTestCase;
export type ParsedGrepTestFile = ParsedBusyBoxTestFile;

/**
 * Parse a grep test file (auto-detects format)
 */
export function parseGrepTestFile(
  content: string,
  filePath: string,
): ParsedGrepTestFile {
  const fileName = filePath.split("/").pop() || filePath;

  // Detect format based on file name prefix
  if (fileName.startsWith("gnu-")) {
    // Determine if BRE or ERE based on filename
    const isERE =
      fileName.includes("ere") ||
      fileName.includes("spencer1") ||
      fileName.includes("spencer2");
    return parseGnuGrepTests(content, filePath, isERE);
  }

  return parseBusyBoxTests(content, filePath);
}

/**
 * Parse GNU grep test format
 *
 * Format: exit_code@pattern@test_string[@note]
 * - exit_code 0: pattern should match test_string
 * - exit_code 1: pattern should NOT match test_string
 * - exit_code 2: pattern is invalid (test_string contains error code)
 *
 * Supports skip comments:
 *   # SKIP: reason
 *   0@pattern@test_string
 * The skip applies to the immediately following test line.
 */
function parseGnuGrepTests(
  content: string,
  filePath: string,
  isERE: boolean,
): ParsedGrepTestFile {
  const fileName = filePath.split("/").pop() || filePath;
  const lines = content.split("\n");
  const testCases: GrepTestCase[] = [];

  let pendingSkip: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (line === "") {
      continue;
    }

    // Check for SKIP comment
    const skipMatch = line.match(/^#\s*SKIP:\s*(.+)$/);
    if (skipMatch) {
      pendingSkip = skipMatch[1];
      continue;
    }

    // Skip other comments
    if (line.startsWith("#")) {
      continue;
    }

    // Parse: exit_code@pattern@test_string[@note]
    const parts = line.split("@");
    if (parts.length < 3) {
      continue;
    }

    const exitCode = parseInt(parts[0], 10);
    const pattern = parts[1];
    const testString = parts[2];
    const note = parts.slice(3).join("@"); // Rejoin any additional @ in notes

    // Build grep command
    const grepFlag = isERE ? "-E" : "";
    const escapedPattern = pattern.replace(/'/g, "'\\''");
    const command = `grep ${grepFlag} '${escapedPattern}'`.trim();

    // Determine expected output based on exit code
    let expectedOutput: string;
    let stdin: string;

    if (exitCode === 2) {
      // Error expected - pattern is invalid
      // We expect grep to output nothing to stdout (error goes to stderr)
      expectedOutput = "";
      stdin = "test\n"; // Provide some input
    } else if (exitCode === 0) {
      // Match expected - grep should output the matching line
      expectedOutput = `${testString}\n`;
      stdin = `${testString}\n`;
    } else {
      // No match expected (exit code 1) - grep should output nothing
      expectedOutput = "";
      stdin = `${testString}\n`;
    }

    // Build test name
    const noteStr = note ? ` (${note})` : "";
    const name = `${isERE ? "ERE" : "BRE"}: /${pattern}/ vs "${testString}"${noteStr}`;

    const testCase: GrepTestCase = {
      name,
      command,
      expectedOutput,
      infile: "",
      stdin,
      lineNumber: i + 1,
    };

    // Apply pending skip if any
    if (pendingSkip) {
      testCase.skip = pendingSkip;
      pendingSkip = undefined;
    }

    testCases.push(testCase);
  }

  return { fileName, filePath, testCases };
}
