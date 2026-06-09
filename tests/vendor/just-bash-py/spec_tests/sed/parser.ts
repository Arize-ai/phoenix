/**
 * Parser for sed test formats
 *
 * Supports two formats:
 * 1. BusyBox format: testing "description" "commands" "result" "infile" "stdin"
 * 2. PythonSed .suite format:
 *    ---
 *    description
 *    ---
 *    sed script
 *    ---
 *    input
 *    ---
 *    expected output
 *    ---
 */

import {
  type BusyBoxTestCase,
  type ParsedBusyBoxTestFile,
  parseBusyBoxTests,
} from "../../test-utils/busybox-test-parser.js";

// Re-export types with sed-specific names for backwards compatibility
export type SedTestCase = BusyBoxTestCase;
export type ParsedSedTestFile = ParsedBusyBoxTestFile;

/**
 * Parse a sed test file (auto-detects format)
 */
export function parseSedTestFile(
  content: string,
  filePath: string,
): ParsedSedTestFile {
  const fileName = filePath.split("/").pop() || filePath;

  // Detect format based on file extension or content
  if (fileName.endsWith(".suite")) {
    return parsePythonSedSuite(content, filePath);
  }

  return parseBusyBoxTests(content, filePath);
}

/**
 * Parse PythonSed .suite format
 *
 * Format:
 * ---
 * description
 * ---
 * sed script
 * ---
 * input
 * ---
 * expected output
 * ---
 */
function parsePythonSedSuite(
  content: string,
  filePath: string,
): ParsedSedTestFile {
  const fileName = filePath.split("/").pop() || filePath;
  const lines = content.split("\n");
  const testCases: SedTestCase[] = [];

  let i = 0;

  while (i < lines.length) {
    // Skip lines until we find a --- delimiter
    while (i < lines.length && lines[i].trim() !== "---") {
      i++;
    }

    if (i >= lines.length) break;

    // Found ---
    const startLine = i;
    i++;

    // Read description (may be multi-line)
    const descriptionLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "---") {
      descriptionLines.push(lines[i]);
      i++;
    }

    if (i >= lines.length) break;

    // Skip ---
    i++;

    // Read sed script (may be multi-line)
    const scriptLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "---") {
      scriptLines.push(lines[i]);
      i++;
    }

    if (i >= lines.length) break;

    // Skip ---
    i++;

    // Read input (may be multi-line)
    const inputLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "---") {
      inputLines.push(lines[i]);
      i++;
    }

    if (i >= lines.length) break;

    // Skip ---
    i++;

    // Read expected output (may be multi-line)
    const outputLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "---") {
      outputLines.push(lines[i]);
      i++;
    }

    // Skip final ---
    if (i < lines.length && lines[i].trim() === "---") {
      i++;
    }

    // Build the test case
    const description = descriptionLines.join("\n").trim();
    const script = scriptLines.join("\n").trim();
    // Join input lines and add trailing newline for non-empty input
    // (matching typical file behavior where files end with newline)
    let input = inputLines.join("\n");
    if (input !== "") {
      input += "\n";
    }
    // Expected output from test file - join lines and add trailing newline
    // (real sed always outputs trailing newline for each line)
    let expectedOutput = outputLines.join("\n");
    // Add trailing newline for non-empty output (matches real sed behavior)
    // "???" is a special marker meaning "expect error" - don't add newline
    if (expectedOutput !== "" && expectedOutput !== "???") {
      expectedOutput += "\n";
    }

    // Skip empty tests or comments (lines starting with **)
    if (!script || description.startsWith("**")) {
      continue;
    }

    // Skip placeholder tests with empty input AND empty expected output
    if (input.trim() === "" && expectedOutput.trim() === "") {
      continue;
    }

    // Build sed command from script
    // The script may be multi-line, so we need to use -e for each line or escape newlines
    const command = buildSedCommand(script);

    // Provide default input for tests that have empty input but expect output
    // This is common in pythonsed test suites where tests reuse a default pattern
    let effectiveInput = input;
    if (input.trim() === "" && expectedOutput.trim() !== "") {
      // Default input for a/i/c and similar tests that match /TAG/
      effectiveInput = "1\nTAG\n2\n";
    }

    testCases.push({
      name: description || `test at line ${startLine + 1}`,
      command,
      expectedOutput,
      infile: "",
      stdin: effectiveInput,
      lineNumber: startLine + 1,
    });
  }

  return { fileName, filePath, testCases };
}

/**
 * Build a sed command from a script
 */
function buildSedCommand(script: string): string {
  // If script has multiple lines, use multiple -e arguments
  const lines = script.split("\n").filter((l) => l.trim() !== "");

  if (lines.length === 0) {
    return "sed ''";
  }

  if (lines.length === 1) {
    const escapedScript = lines[0].replace(/'/g, "'\\''");
    return `sed '${escapedScript}'`;
  }

  // Multiple lines - use multiple -e arguments
  const args = lines.map((l) => `-e '${l.replace(/'/g, "'\\''")}'`).join(" ");
  return `sed ${args}`;
}
