/**
 * Parser for onetrueawk test format (T.* shell scripts)
 *
 * The onetrueawk test suite uses shell scripts with patterns like:
 * - $awk 'program' [input] >foo1
 * - echo 'expected' >foo2
 * - diff foo1 foo2 || echo 'BAD: testname'
 *
 * This parser extracts individual test cases from these scripts.
 */

import {
  extractCatHeredoc,
  tryParseBuiltinStyleTest as tryParseBuiltinStyleTestImpl,
  tryParseMultiLineAwkTest as tryParseMultiLineAwkTestImpl,
} from "./parser-test-styles.js";

export interface AwkTestCase {
  name: string;
  /** The awk program to run */
  program: string;
  /** Input data (stdin or file content) */
  input: string;
  /** Expected stdout */
  expectedOutput: string;
  /** Expected exit status (default 0) */
  expectedStatus?: number;
  /** Line number in source file */
  lineNumber: number;
  /** If set, test is expected to fail (value is reason) */
  skip?: string;
  /** Original shell command for reference */
  originalCommand?: string;
  /** Field separator to use (default is space/whitespace) */
  fieldSeparator?: string;
  /** Command-line arguments to pass to awk (for ARGV/ARGC tests) */
  args?: string[];
  /** Command-line variable assignments via -v var=value */
  vars?: Record<string, string>;
}

/**
 * Strip control characters from test names (except common whitespace)
 */
function cleanTestName(name: string): string {
  // Remove control characters (0x00-0x1F except tab, newline, carriage return)
  // Also remove 0x7F (DEL) and Unicode replacement character U+FFFD
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFD]/g, "").trim();
}

export interface ParsedAwkTestFile {
  fileName: string;
  filePath: string;
  testCases: AwkTestCase[];
  /** Tests that couldn't be parsed */
  unparsedTests: string[];
}

/**
 * Parse a T.* shell test file
 */
export function parseAwkTestFile(
  content: string,
  filePath: string,
): ParsedAwkTestFile {
  const fileName = filePath.split("/").pop() || filePath;
  const lines = content.split("\n");
  const testCases: AwkTestCase[] = [];
  const unparsedTests: string[] = [];

  // Track state for multi-line parsing
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Look for piped input: echo '...' | $awk '...' >foo (multi-line version)
    // The pipe might be on a different line than the echo start
    if (line.includes("| $awk")) {
      const result = tryParseMultiLinePipedAwkTest(lines, i);
      if (result) {
        testCases.push(result.testCase);
        i = result.nextLine;
        continue;
      }
    }

    // Look for $awk commands that write to foo1 or foo2
    if (line.includes("$awk") && line.includes(">foo")) {
      const result = tryParseBuiltinStyleTestImpl(
        lines,
        i,
        tryParseMultiLineAwkTestImpl,
      );
      if (result) {
        testCases.push(result.testCase);
        i = result.nextLine;
        continue;
      }
    }

    // Look for multi-line $awk programs starting on a line
    // Check if this is a $TEMP-style test by looking ahead for >$TEMP or >foo
    if (line.match(/^\$awk\s+'/) && !line.includes(">foo")) {
      // Look ahead to see if this test uses $TEMP or foo patterns
      let usesTempPattern = false;
      for (let j = i; j < Math.min(i + 30, lines.length); j++) {
        if (lines[j].match(/>\s*\$TEMP/)) {
          usesTempPattern = true;
          break;
        }
        if (lines[j].match(/>\s*foo[12]/)) {
          break;
        }
      }

      if (usesTempPattern) {
        // Use $TEMP-style parser
        const result = tryParseTempVarStyleTest(lines, i);
        if (result) {
          testCases.push(result.testCase);
          i = result.nextLine;
          continue;
        }
      } else {
        const result = tryParseMultiLineAwkTestImpl(lines, i);
        if (result) {
          testCases.push(result.testCase);
          i = result.nextLine;
          continue;
        }
      }
    }

    // Look for echo '...' >foo1 followed by $awk >foo2 (reversed expected/actual pattern)
    // Handles both quoted (echo 'x') and unquoted (echo 1)
    // Also matches ./echo for onetrueawk test suite
    if (
      line.match(/^\.?\/?\s*echo\s+(?:['"][^'"]*['"]|\S+)\s*>\s*foo[12]$/) &&
      i + 1 < lines.length
    ) {
      const nextLine = lines[i + 1];
      if (nextLine.match(/^\$awk\s+'/)) {
        const result = tryParseReversedTest(lines, i);
        if (result) {
          testCases.push(result.testCase);
          i = result.nextLine;
          continue;
        }
      }
    }

    // Look for heredoc-style tests (T.expr format with !!!!!)
    if (line.includes("<<") && line.includes("!!!!")) {
      const result = tryParseHeredocTests(lines, i);
      if (result) {
        testCases.push(...result.testCases);
        i = result.nextLine;
        continue;
      }
    }

    // Look for $TEMP-style tests (T.split format with $TEMP0, $TEMP1, $TEMP2)
    if (line.includes("$awk") && line.match(/>\s*\$TEMP/)) {
      const result = tryParseTempVarStyleTest(lines, i);
      if (result) {
        testCases.push(result.testCase);
        i = result.nextLine;
        continue;
      }
    }

    i++;
  }

  return { fileName, filePath, testCases, unparsedTests };
}

interface ParseResult {
  testCase: AwkTestCase;
  nextLine: number;
}

interface HeredocParseResult {
  testCases: AwkTestCase[];
  nextLine: number;
}

/**
 * Try to parse a reversed test where expected output comes first:
 * echo 'expected' >foo1
 * $awk 'program' >foo2
 * diff foo1 foo2 || echo 'BAD: testname'
 */
function tryParseReversedTest(
  lines: string[],
  startLine: number,
): ParseResult | null {
  // Extract expected output from echo line (quoted or unquoted)
  // Also matches ./echo for onetrueawk test suite
  const echoLine = lines[startLine];
  let expectedOutput = "";
  const echoQuotedMatch = echoLine.match(
    /^\.?\/?\s*echo\s+'([^']*)'\s*>\s*foo([12])$/,
  );
  if (echoQuotedMatch) {
    expectedOutput = echoQuotedMatch[1];
  } else {
    const echoUnquotedMatch = echoLine.match(
      /^\.?\/?\s*echo\s+(\S+)\s*>\s*foo([12])$/,
    );
    if (echoUnquotedMatch) {
      expectedOutput = echoUnquotedMatch[1];
    } else {
      return null;
    }
  }

  // Find the awk program (starts on next line, may span multiple lines)
  const awkStartLine = startLine + 1;
  let awkEndLine = awkStartLine;

  // Find where the awk program ends (look for ' >foo pattern)
  // Also match: ' <filename> >foo where filename is an input file
  for (let j = awkStartLine; j < lines.length; j++) {
    if (
      lines[j].includes("' >foo") ||
      lines[j].includes("'>foo") ||
      lines[j].match(/'\s+\/dev\/null\s*>\s*foo/) ||
      lines[j].match(/'\s*>\s*foo/) ||
      lines[j].match(/'\s+\S+\s*>\s*foo/) // ' <filename> >foo
    ) {
      awkEndLine = j;
      break;
    }
  }

  // Extract the awk program
  const awkLines = lines.slice(awkStartLine, awkEndLine + 1).join("\n");
  const programMatch = awkLines.match(
    /\$awk\s+(?:-[^\s]+\s+)?'([\s\S]*?)'\s*(?:\/dev\/null\s*)?>/,
  );
  if (!programMatch) {
    return null;
  }
  const program = programMatch[1];

  // Find test name from diff/cmp line
  let testName = "";
  let nextLine = awkEndLine + 1;

  for (
    let j = awkEndLine + 1;
    j < Math.min(awkEndLine + 10, lines.length);
    j++
  ) {
    const line = lines[j];

    // diff/cmp line with test name
    const diffMatch = line.match(
      /(?:diff|cmp)\s+(?:-s\s+)?foo1\s+foo2\s*\|\|\s*\.?\/?echo\s+(['"])?(?:BAD:\s*)?([^'"]+)\1?/,
    );
    if (diffMatch) {
      testName = cleanTestName(diffMatch[2]);
      nextLine = j + 1;
      break;
    }

    // grep-based error checks
    const grepMatch = line.match(
      /grep\s+.*\|\|\s*echo\s+(['"])?(?:BAD:\s*)?([^'"]+)\1?/,
    );
    if (grepMatch) {
      testName = cleanTestName(grepMatch[2]);
      nextLine = j + 1;
      break;
    }
  }

  if (!testName) {
    testName = `test at line ${startLine + 1}`;
  }

  return {
    testCase: {
      name: testName,
      program,
      input: "",
      expectedOutput,
      lineNumber: startLine + 1,
      originalCommand: echoLine.trim(),
    },
    nextLine,
  };
}

/**
 * Try to parse a multi-line piped awk test where both echo and awk span multiple lines:
 * echo '10 2
 * 2 10
 * ...' | $awk '
 * function f() { ... }
 * { main block }
 * ' >foo1
 */
function tryParseMultiLinePipedAwkTest(
  lines: string[],
  pipeLineIndex: number,
): ParseResult | null {
  // Find where the echo starts (search backwards)
  let echoStartLine = pipeLineIndex;
  for (let j = pipeLineIndex; j >= 0; j--) {
    if (lines[j].match(/^echo\s+'/)) {
      echoStartLine = j;
      break;
    }
  }

  // Extract the input from echo '...' up to the pipe
  // We need to find the content between the opening ' after echo and the closing ' before |
  const fullCommand = lines.slice(echoStartLine, pipeLineIndex + 1).join("\n");
  const inputMatch = fullCommand.match(/echo\s+'([\s\S]*?)'\s*\|\s*\$awk/);
  if (!inputMatch) {
    return null;
  }
  const inputData = inputMatch[1];

  // Now find the awk program - it starts after $awk ' on the pipe line
  // and ends with ' >foo
  const awkStartLine = pipeLineIndex;
  let awkEndLine = pipeLineIndex;

  // Find where the awk program ends (look for ' >foo pattern)
  for (let j = pipeLineIndex; j < lines.length; j++) {
    if (lines[j].includes("' >foo") || lines[j].includes("'>foo")) {
      awkEndLine = j;
      break;
    }
  }

  // Extract the awk program
  const awkLines = lines.slice(awkStartLine, awkEndLine + 1).join("\n");
  const programMatch = awkLines.match(
    /\$awk\s+(?:-[^\s]+\s+)?'([\s\S]*?)'\s*>/,
  );
  if (!programMatch) {
    return null;
  }
  const program = programMatch[1];

  // Now find expected output and test name
  let expectedOutput = "";
  let testName = "";
  let nextLine = awkEndLine + 1;

  for (
    let j = awkEndLine + 1;
    j < Math.min(awkEndLine + 30, lines.length);
    j++
  ) {
    const line = lines[j];

    // Simple echo expected output (single line)
    const echoMatch = line.match(/^echo\s+(['"])(.*?)\1\s*>\s*foo([12])$/);
    if (echoMatch) {
      expectedOutput = echoMatch[2].replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      nextLine = j + 1;
    }

    // Multi-line echo expected output (echo '1\n0\n1' or literal newlines)
    if (line.match(/^echo\s+'[^']*$/) && !line.includes(">foo")) {
      // This is the start of a multi-line echo - find the end
      const echoLines: string[] = [line.replace(/^echo\s+'/, "")];
      let echoEndLine = j;
      for (let k = j + 1; k < lines.length; k++) {
        if (lines[k].includes("' >foo")) {
          echoLines.push(lines[k].replace(/' >foo\d$/, ""));
          echoEndLine = k;
          break;
        }
        echoLines.push(lines[k]);
      }
      expectedOutput = echoLines.join("\n");
      nextLine = echoEndLine + 1;
      j = echoEndLine;
      continue;
    }

    // cat heredoc expected output (cat <<! ... ! or cat << \EOF ... EOF)
    if (line.match(/^cat\s+<</)) {
      const heredoc = extractCatHeredoc(lines, j);
      if (heredoc) {
        expectedOutput = heredoc.content;
        nextLine = heredoc.endLine + 1;
        j = heredoc.endLine;
        continue;
      }
    }

    // diff/cmp line with test name
    const diffMatch = line.match(
      /(?:diff|cmp)\s+(?:-s\s+)?foo1\s+foo2\s*\|\|\s*\.?\/?echo\s+(['"])?(?:BAD:\s*)?([^'"]+)\1?/,
    );
    if (diffMatch) {
      testName = cleanTestName(diffMatch[2]);
      nextLine = j + 1;
      break;
    }

    // grep-based error checks
    const grepMatch = line.match(
      /grep\s+.*\|\|\s*echo\s+(['"])?(?:BAD:\s*)?([^'"]+)\1?/,
    );
    if (grepMatch) {
      testName = cleanTestName(grepMatch[2]);
      nextLine = j + 1;
      break;
    }
  }

  if (!testName) {
    testName = `test at line ${echoStartLine + 1}`;
  }

  return {
    testCase: {
      name: testName,
      program,
      input: inputData,
      expectedOutput,
      lineNumber: echoStartLine + 1,
      originalCommand: lines[echoStartLine].trim(),
    },
    nextLine,
  };
}

/**
 * Try to parse a test with piped input:
 * echo '...' | $awk '...' >foo1
 * echo 'expected' >foo2  OR  cat << \EOF >foo2 ... EOF
 * diff foo1 foo2 || echo 'BAD: testname'
 */
function _tryParsePipedInputTest(
  lines: string[],
  startLine: number,
): ParseResult | null {
  const line = lines[startLine];

  // Match: echo 'input' | $awk 'program' >foo1
  // Or multi-line piped input (echo '...\n...' | $awk)
  const pipeMatch = line.match(
    /echo\s+(['"])([\s\S]*?)\1\s*\|\s*\$awk\s+(?:-[^\s]+\s+)?(['"])([\s\S]*?)\3\s*>\s*foo([12])/,
  );

  if (!pipeMatch) {
    // Try multi-line awk program after pipe
    return tryParseMultiLinePipedTest(lines, startLine);
  }

  const inputData = pipeMatch[2].replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  const program = pipeMatch[4];
  const fooNum = pipeMatch[5];

  let expectedOutput = "";
  let testName = "";
  let nextLine = startLine + 1;

  // Look for expected output and test name
  for (let j = startLine + 1; j < Math.min(startLine + 15, lines.length); j++) {
    const currentLine = lines[j];

    // Simple echo expected output (also matches ./echo)
    const echoMatch = currentLine.match(
      /\.?\/?\s*echo\s+(['"])(.*?)\1\s*>\s*foo([12])/,
    );
    if (echoMatch && echoMatch[3] !== fooNum) {
      expectedOutput = echoMatch[2].replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      nextLine = j + 1;
    }

    // Multi-line expected output with heredoc (cat << \EOF ... EOF)
    if (currentLine.match(/cat\s+<</) && currentLine.includes(">foo")) {
      const heredoc = extractCatHeredoc(lines, j);
      if (heredoc) {
        expectedOutput = heredoc.content;
        nextLine = heredoc.endLine + 1;
        j = heredoc.endLine;
        continue;
      }
    }

    // diff/cmp line with test name
    const diffMatch = currentLine.match(
      /(?:diff|cmp)\s+(?:-s\s+)?foo1\s+foo2\s*\|\|\s*\.?\/?echo\s+(['"])?(?:BAD:\s*)?([^'"]+)\1?/,
    );
    if (diffMatch) {
      testName = cleanTestName(diffMatch[2]);
      nextLine = j + 1;
      break;
    }
  }

  if (!testName) {
    testName = `test at line ${startLine + 1}`;
  }

  return {
    testCase: {
      name: testName,
      program,
      input: inputData,
      expectedOutput,
      lineNumber: startLine + 1,
      originalCommand: line.trim(),
    },
    nextLine,
  };
}

/**
 * Try to parse multi-line piped awk test
 */
function tryParseMultiLinePipedTest(
  lines: string[],
  startLine: number,
): ParseResult | null {
  const firstLine = lines[startLine];

  // Check for echo '...' | $awk ' pattern
  const echoMatch = firstLine.match(/echo\s+(['"])(.*?)\1\s*\|\s*\$awk\s+'/);
  if (!echoMatch) {
    return null;
  }

  const inputData = echoMatch[2].replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  // Find the closing quote for the awk program
  let program = "";
  let endLine = startLine;
  let quoteCount = 0;
  let inProgram = false;

  for (let j = startLine; j < lines.length; j++) {
    const line = lines[j];

    for (let k = 0; k < line.length; k++) {
      const char = line[k];
      if (char === "'" && (k === 0 || line[k - 1] !== "\\")) {
        quoteCount++;
        if (quoteCount === 1) {
          inProgram = true;
        } else if (inProgram && quoteCount % 2 === 0) {
          // Found closing quote, but check if it's part of the awk program
          // We need at least 2 quotes: one after $awk and one to close
          const programStart = line.indexOf("$awk");
          if (programStart >= 0 && k > programStart) {
            // This is the closing quote
            program =
              lines
                .slice(startLine, j + 1)
                .join("\n")
                .match(/\$awk\s+'([\s\S]*?)'/)?.[1] || "";
            endLine = j;
            break;
          }
        }
      }
    }
    if (program) break;

    // Simple case: look for >foo to mark end
    if (j > startLine && line.includes(">foo")) {
      program =
        lines
          .slice(startLine, j + 1)
          .join("\n")
          .match(/\$awk\s+(?:-[^\s]+\s+)?'([\s\S]*?)'\s*>/)?.[1] || "";
      endLine = j;
      break;
    }
  }

  if (!program) {
    return null;
  }

  // Look for expected output and test name
  let expectedOutput = "";
  let testName = "";
  let nextLine = endLine + 1;

  for (let j = endLine + 1; j < Math.min(endLine + 20, lines.length); j++) {
    const currentLine = lines[j];

    // Simple echo expected output (single or double quotes, or no quotes)
    const echoExpMatch = currentLine.match(
      /^echo\s+(['"])(.*?)\1\s*>\s*foo([12])$/,
    );
    if (echoExpMatch) {
      expectedOutput = echoExpMatch[2]
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t");
      nextLine = j + 1;
    }

    // Simple echo without quotes (echo x >foo2)
    const echoNoQuoteMatch = currentLine.match(
      /^echo\s+(\S+)\s*>\s*foo([12])$/,
    );
    if (!echoExpMatch && echoNoQuoteMatch) {
      expectedOutput = echoNoQuoteMatch[1];
      nextLine = j + 1;
    }

    // Multi-line echo expected output (echo 'line1\nline2' or echo "line1\nline2" spanning lines)
    if (
      currentLine.match(/^echo\s+["'][^"']*$/) &&
      !currentLine.includes(">foo")
    ) {
      // This is the start of a multi-line echo - find the end
      const quoteChar = currentLine.includes('"') ? '"' : "'";
      const echoLines: string[] = [currentLine.replace(/^echo\s+["']/, "")];
      let echoEndLine = j;
      for (let k = j + 1; k < lines.length; k++) {
        if (
          lines[k].includes(`${quoteChar} >foo`) ||
          lines[k].match(new RegExp(`${quoteChar}\\s*>\\s*foo`))
        ) {
          echoLines.push(
            lines[k].replace(new RegExp(`${quoteChar}\\s*>\\s*foo\\d$`), ""),
          );
          echoEndLine = k;
          break;
        }
        echoLines.push(lines[k]);
      }
      expectedOutput = echoLines.join("\n");
      nextLine = echoEndLine + 1;
      j = echoEndLine;
      continue;
    }

    // Multi-line expected output with heredoc
    if (currentLine.match(/^cat\s+<</)) {
      const heredoc = extractCatHeredoc(lines, j);
      if (heredoc) {
        expectedOutput = heredoc.content;
        nextLine = heredoc.endLine + 1;
        j = heredoc.endLine;
        continue;
      }
    }

    // diff/cmp line
    const diffMatch = currentLine.match(
      /(?:diff|cmp)\s+(?:-s\s+)?foo1\s+foo2\s*\|\|\s*\.?\/?echo\s+(['"])?(?:BAD:\s*)?([^'"]+)\1?/,
    );
    if (diffMatch) {
      testName = cleanTestName(diffMatch[2]);
      nextLine = j + 1;
      break;
    }
  }

  if (!testName) {
    testName = `test at line ${startLine + 1}`;
  }

  return {
    testCase: {
      name: testName,
      program,
      input: inputData,
      expectedOutput,
      lineNumber: startLine + 1,
      originalCommand: firstLine.trim(),
    },
    nextLine,
  };
}

/**
 * Parse T.expr style heredoc tests
 * Format:
 * try { awk program }
 * input1\texpected1
 * input2\texpected2
 * (blank line ends test)
 *
 * Note: T.expr tests use tab as field separator (-F"\t")
 */
function tryParseHeredocTests(
  lines: string[],
  startLine: number,
): HeredocParseResult | null {
  // Find the heredoc content
  let heredocStart = -1;
  let heredocEnd = -1;

  for (let j = startLine; j < lines.length; j++) {
    if (lines[j].includes("<<") && lines[j].includes("!!!!")) {
      heredocStart = j + 1;
    }
    if (heredocStart > 0 && lines[j] === "!!!!") {
      heredocEnd = j;
      break;
    }
  }

  if (heredocStart < 0 || heredocEnd < 0) {
    return null;
  }

  const testCases: AwkTestCase[] = [];
  let currentProgram = "";
  let testInputs: Array<{ input: string; expected: string }> = [];
  let testLineNumber = heredocStart;

  for (let j = heredocStart; j < heredocEnd; j++) {
    const line = lines[j];

    // Skip comments and empty lines at start
    if (line.startsWith("#") || line.trim() === "") {
      if (currentProgram && testInputs.length > 0) {
        // End of current test, save it
        for (let k = 0; k < testInputs.length; k++) {
          testCases.push({
            name: `${currentProgram.slice(0, 40)}... case ${k + 1}`,
            program: currentProgram,
            input: testInputs[k].input,
            expectedOutput: testInputs[k].expected,
            lineNumber: testLineNumber,
            fieldSeparator: "\t", // T.expr tests use tab as FS
          });
        }
        currentProgram = "";
        testInputs = [];
      }
      continue;
    }

    // New test program
    if (line.startsWith("try ")) {
      if (currentProgram && testInputs.length > 0) {
        // Save previous test
        for (let k = 0; k < testInputs.length; k++) {
          testCases.push({
            name: `${currentProgram.slice(0, 40)}... case ${k + 1}`,
            program: currentProgram,
            input: testInputs[k].input,
            expectedOutput: testInputs[k].expected,
            lineNumber: testLineNumber,
            fieldSeparator: "\t", // T.expr tests use tab as FS
          });
        }
      }
      currentProgram = line.slice(4).trim();
      testInputs = [];
      testLineNumber = j + 1;
      continue;
    }

    // Input/expected line (tab-separated)
    if (currentProgram && line.includes("\t")) {
      const parts = line.split("\t");
      const expected = parts[parts.length - 1];
      const input = parts.slice(0, -1).join("\t");
      testInputs.push({
        input,
        expected: expected === '""' ? "" : expected,
      });
    }
  }

  // Don't forget last test
  if (currentProgram && testInputs.length > 0) {
    for (let k = 0; k < testInputs.length; k++) {
      testCases.push({
        name: `${currentProgram.slice(0, 40)}... case ${k + 1}`,
        program: currentProgram,
        input: testInputs[k].input,
        expectedOutput: testInputs[k].expected,
        lineNumber: testLineNumber,
        fieldSeparator: "\t", // T.expr tests use tab as FS
      });
    }
  }

  return {
    testCases,
    nextLine: heredocEnd + 1,
  };
}

/**
 * Try to parse a $TEMP-style test (T.split format):
 * echo 'input' > $TEMP0
 * $awk 'program' $TEMP0 > $TEMP1  OR  $awk 'program' > $TEMP1 <<XXX ... XXX
 * echo 'expected' > $TEMP2
 * diff $TEMP1 $TEMP2 || fail 'BAD: T.split testname'
 *
 * Note: $TEMP0 is input file, $TEMP1 is awk output, $TEMP2 is expected output
 */
function tryParseTempVarStyleTest(
  lines: string[],
  startLine: number,
): ParseResult | null {
  const awkLine = lines[startLine];

  // Match: $awk '...' [file] > $TEMP1 or $awk '...' > $TEMP1 <<XXX
  // Also handle multi-line awk programs
  let program = "";
  let awkEndLine = startLine;

  // Check if this is a single-line or multi-line awk command
  const singleLineMatch = awkLine.match(
    /\$awk\s+(?:-[^\s]+\s+)?'([^']+)'\s*(?:([^\s>]+)\s*)?>\s*\$TEMP(\d)/,
  );

  if (singleLineMatch) {
    program = singleLineMatch[1];
    awkEndLine = startLine;
  } else {
    // Multi-line awk program: find the closing quote
    for (let j = startLine; j < lines.length; j++) {
      if (lines[j].match(/'\s*(?:\$TEMP\d|[^\s>]+)?\s*>\s*\$TEMP/)) {
        awkEndLine = j;
        break;
      }
      // Also check for heredoc input: > $TEMP1 <<XXX
      if (lines[j].match(/>\s*\$TEMP\d?\s*<</)) {
        awkEndLine = j;
        break;
      }
    }

    // Extract program from multi-line
    const awkLines = lines.slice(startLine, awkEndLine + 1).join("\n");
    const programMatch = awkLines.match(
      /\$awk\s+(?:-[^\s]+\s+)?'([\s\S]*?)'\s*(?:[^\s>]+\s*)?>/,
    );
    if (!programMatch) {
      return null;
    }
    program = programMatch[1];
  }

  // Check for heredoc input in the awk line: > $TEMP1 <<XXX
  let inputData = "";
  const heredocMatch = lines[awkEndLine].match(/>\s*\$TEMP\d?\s*<<\s*(\w+)/);
  if (heredocMatch) {
    const delimiter = heredocMatch[1];
    const heredocLines: string[] = [];
    let heredocEndLine = awkEndLine;
    for (let j = awkEndLine + 1; j < lines.length; j++) {
      if (lines[j] === delimiter || lines[j].trim() === delimiter) {
        heredocEndLine = j;
        break;
      }
      heredocLines.push(lines[j]);
    }
    inputData = heredocLines.join("\n");
    awkEndLine = heredocEndLine;
  }

  // Search backwards for input file content (echo '...' > $TEMP0)
  if (!inputData) {
    for (let j = startLine - 1; j >= Math.max(0, startLine - 30); j--) {
      const line = lines[j];

      // Stop at previous diff/fail (test boundary)
      if (line.match(/diff\s+\$TEMP/) || line.match(/fail\s+'/)) {
        break;
      }

      // Multi-line echo ending with > $TEMP0
      if (line.match(/'\s*>\s*\$TEMP0$/)) {
        // Search backwards for echo start
        for (let k = j; k >= Math.max(0, j - 20); k--) {
          if (lines[k].match(/^echo\s+'/)) {
            const echoContent = lines
              .slice(k, j + 1)
              .join("\n")
              .match(/echo\s+'([\s\S]*?)'\s*>\s*\$TEMP0/);
            if (echoContent) {
              inputData = echoContent[1];
            }
            break;
          }
        }
        break;
      }

      // Single-line echo > $TEMP0
      const singleEchoMatch = line.match(
        /^echo\s+(['"])([\s\S]*?)\1\s*>\s*\$TEMP0$/,
      );
      if (singleEchoMatch) {
        inputData = singleEchoMatch[2];
        break;
      }
    }
  }

  // Check if awk command references $TEMP0 as input file
  const inputFileMatch = lines
    .slice(startLine, awkEndLine + 1)
    .join("\n")
    .match(/'\s+['"]?\$TEMP0['"]?\s*>\s*\$TEMP/);
  const usesTemp0AsFile = !!inputFileMatch;

  // Look for expected output and test name
  let expectedOutput = "";
  let testName = "";
  let nextLine = awkEndLine + 1;

  for (
    let j = awkEndLine + 1;
    j < Math.min(awkEndLine + 20, lines.length);
    j++
  ) {
    const line = lines[j];

    // Multi-line echo ending with > $TEMP2
    if (line.match(/'\s*>\s*\$TEMP2$/) && !expectedOutput) {
      // Search backwards for echo start within this section
      for (let k = j; k >= awkEndLine + 1; k--) {
        if (lines[k].match(/^echo\s+'/)) {
          const echoContent = lines
            .slice(k, j + 1)
            .join("\n")
            .match(/echo\s+'([\s\S]*?)'\s*>\s*\$TEMP2/);
          if (echoContent) {
            expectedOutput = echoContent[1];
            nextLine = j + 1;
          }
          break;
        }
      }
    }

    // Single-line echo > $TEMP2 (with quotes)
    const echoMatch = line.match(/^echo\s+(['"])(.*?)\1\s*>\s*\$TEMP2$/);
    if (echoMatch && !expectedOutput) {
      expectedOutput = echoMatch[2].replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      nextLine = j + 1;
    }

    // Single-line echo > $TEMP2 (without quotes)
    if (!echoMatch && !expectedOutput) {
      const echoNoQuoteMatch = line.match(/^echo\s+(\S+)\s*>\s*\$TEMP2$/);
      if (echoNoQuoteMatch) {
        expectedOutput = echoNoQuoteMatch[1];
        nextLine = j + 1;
      }
    }

    // diff $TEMP1 $TEMP2 || fail '...'
    const diffMatch = line.match(
      /diff\s+\$TEMP1\s+\$TEMP2\s*\|\|\s*fail\s+(['"])(?:BAD:\s*)?([^'"]+)\1/,
    );
    if (diffMatch) {
      testName = cleanTestName(diffMatch[2]);
      nextLine = j + 1;
      break;
    }
  }

  if (!program) {
    return null;
  }

  if (!testName) {
    testName = `test at line ${startLine + 1}`;
  }

  // If test uses $TEMP0 as file but we have no input, mark it
  if (usesTemp0AsFile && !inputData) {
    inputData = "[file: $TEMP0]";
  }

  return {
    testCase: {
      name: testName,
      program,
      input: inputData,
      expectedOutput,
      lineNumber: startLine + 1,
      originalCommand: awkLine.trim(),
    },
    nextLine,
  };
}
