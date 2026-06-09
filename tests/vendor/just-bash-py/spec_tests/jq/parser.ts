/**
 * Parser for jq test format
 *
 * The jq test format is simple:
 * - Tests are groups of three lines: program, input, expected output
 * - Blank lines and lines starting with # are ignored
 * - Multiple expected output lines mean multiple outputs
 * - %%FAIL indicates an error test
 */

export interface JqTestCase {
  name: string;
  /** The jq program to run */
  program: string;
  /** Input JSON */
  input: string;
  /** Expected outputs (may be multiple) */
  expectedOutputs: string[];
  /** If true, test expects an error */
  expectsError: boolean;
  /** Expected error message (if expectsError) */
  expectedError?: string;
  /** Line number in source file */
  lineNumber: number;
  /** If set, test is expected to fail (value is reason) */
  skip?: string;
}

export interface ParsedJqTestFile {
  fileName: string;
  filePath: string;
  testCases: JqTestCase[];
}

/**
 * Parse a jq test file
 */
export function parseJqTestFile(
  content: string,
  filePath: string,
): ParsedJqTestFile {
  const fileName = filePath.split("/").pop() || filePath;
  const lines = content.split("\n");
  const testCases: JqTestCase[] = [];

  let i = 0;
  let testNumber = 0;

  while (i < lines.length) {
    // Skip blank lines and comments
    while (
      i < lines.length &&
      (lines[i].trim() === "" || lines[i].startsWith("#"))
    ) {
      i++;
    }

    if (i >= lines.length) break;

    // Check for %%FAIL error test
    if (lines[i] === "%%FAIL") {
      i++;
      // Skip any blank lines after %%FAIL
      while (i < lines.length && lines[i].trim() === "") {
        i++;
      }

      if (i >= lines.length) break;

      const programLine = i;
      const program = lines[i];
      i++;

      // Collect error message lines until blank line or next test
      const errorLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].startsWith("#")
      ) {
        errorLines.push(lines[i]);
        i++;
      }

      testNumber++;
      testCases.push({
        name: `error test ${testNumber}: ${truncateProgram(program)}`,
        program,
        input: "null",
        expectedOutputs: [],
        expectsError: true,
        expectedError: errorLines.join("\n"),
        lineNumber: programLine + 1,
      });
      continue;
    }

    // Regular test: program, input, expected output(s)
    const programLine = i;
    const program = lines[i];
    i++;

    // Skip blank lines between program and input
    while (i < lines.length && lines[i].trim() === "") {
      i++;
    }

    if (i >= lines.length) break;

    const input = lines[i];
    i++;

    // Collect expected output lines until blank line, comment, or %%FAIL
    const expectedOutputs: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      lines[i] !== "%%FAIL"
    ) {
      expectedOutputs.push(lines[i]);
      i++;
    }

    // Skip if we didn't get any expected output
    if (expectedOutputs.length === 0) {
      continue;
    }

    testNumber++;
    testCases.push({
      name: `test ${testNumber}: ${truncateProgram(program)}`,
      program,
      input,
      expectedOutputs,
      expectsError: false,
      lineNumber: programLine + 1,
    });
  }

  return { fileName, filePath, testCases };
}

/**
 * Truncate program for display
 */
function truncateProgram(program: string, maxLen = 50): string {
  const normalized = program.trim();
  if (normalized.length <= maxLen) {
    return normalized;
  }
  return `${normalized.slice(0, maxLen - 3)}...`;
}
