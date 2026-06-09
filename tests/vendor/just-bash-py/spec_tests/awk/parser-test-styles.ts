/**
 * Test parsing functions for specific onetrueawk test styles
 */

import type { AwkTestCase } from "./parser.js";

export interface ParseResult {
  testCase: AwkTestCase;
  nextLine: number;
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

/**
 * Extract a multi-line heredoc expected output (cat << \EOF ... EOF or cat <<! ... !)
 */
export function extractCatHeredoc(
  lines: string[],
  startLine: number,
): { content: string; endLine: number } | null {
  const line = lines[startLine];

  // Look for cat <<\EOF or cat << \EOF or cat << 'EOF' or cat <<! patterns
  const catMatch = line.match(
    /cat\s+<<\s*\\?(['"])?(\w+|!)\1?\s*(?:>\s*foo([12]))?/,
  );
  if (!catMatch) {
    return null;
  }

  const delimiter = catMatch[2];
  const contentLines: string[] = [];
  let endLine = startLine + 1;

  for (let j = startLine + 1; j < lines.length; j++) {
    const trimmedLine = lines[j].trim();
    // Check for delimiter (with optional leading/trailing whitespace)
    if (trimmedLine === delimiter) {
      endLine = j;
      break;
    }
    contentLines.push(lines[j]);
  }

  return { content: contentLines.join("\n"), endLine };
}

/**
 * Try to parse a T.builtin style test:
 * $awk 'program' [input] >foo1
 * echo 'expected' >foo2
 * diff foo1 foo2 || echo 'BAD: testname'
 */
export function tryParseBuiltinStyleTest(
  lines: string[],
  startLine: number,
  tryParseMultiLineAwkTest: (
    lines: string[],
    startLine: number,
  ) => ParseResult | null,
): ParseResult | null {
  const awkLine = lines[startLine];

  // Extract the awk program from $awk '...' or $awk "..."
  // Capture any flags/options between $awk and the program quote
  // Also handle subshell closing paren: $awk '...'[)] >foo
  const awkMatch = awkLine.match(
    /\$awk\s+((?:-[^\s']+\s+)*)(['"])([\s\S]*?)\2(?:\s+([^\s>]+))?\)?\s*>\s*foo([12])/,
  );
  if (!awkMatch) {
    // Try multi-line awk program
    return tryParseMultiLineAwkTest(lines, startLine);
  }

  const flagsStr = awkMatch[1] || "";
  const program = awkMatch[3];
  const inputFile = awkMatch[4];
  const fooNum = awkMatch[5];

  // Parse -v var=value options from flags
  const vars: Record<string, string> = {};
  // Match both -v var=value and -vvar=value formats
  const varMatches = flagsStr.matchAll(/-v\s*(\w+)=([^\s]+)\s*/g);
  for (const match of varMatches) {
    vars[match[1]] = match[2];
  }

  // Determine which is output and which is expected
  // Usually: awk output goes to foo1 or foo2, expected goes to the other
  let expectedOutput = "";
  let testName = "";
  let inputData = "";
  let nextLine = startLine + 1;

  // Check for piped input: echo 'data' | $awk (same line)
  const pipeMatch = awkLine.match(/echo\s+(['"])(.*?)\1\s*\|\s*\$awk/);
  if (pipeMatch) {
    inputData = pipeMatch[2];
  }

  // Also check for unquoted piped input: echo data | $awk (same line)
  // This matches multi-word input like "echo 3 5 | $awk"
  if (!inputData) {
    const unquotedPipeMatch = awkLine.match(/echo\s+(.+?)\s*\|\s*\$awk/);
    if (unquotedPipeMatch) {
      inputData = unquotedPipeMatch[1];
    }
  }

  // Check for piped input from previous line: echo 'data' | (then $awk on this line)
  if (!inputData && startLine > 0) {
    const prevLine = lines[startLine - 1];
    // Match: echo 'input' | or echo "input" | at end of line (single line)
    // Also match when echo is preceded by other commands (e.g., "export ... && echo 'data' |")
    const prevPipeMatch = prevLine.match(/echo\s+(['"])(.*?)\1\s*\|\s*$/);
    if (prevPipeMatch) {
      inputData = prevPipeMatch[2];
    }
    // Also try matching echo anywhere in the line (for cases like "... && echo 'data' |")
    if (!inputData) {
      const anyEchoMatch = prevLine.match(/&&\s*echo\s+(['"])(.*?)\1\s*\|\s*$/);
      if (anyEchoMatch) {
        inputData = anyEchoMatch[2];
      }
    }
    // Check for multi-line echo input ending with ' | or " |
    // e.g., echo 'line1\nline2' | spanning multiple lines
    if (!inputData && prevLine.trim().endsWith("' |")) {
      // Search backwards for the echo start
      for (let j = startLine - 1; j >= 0 && j >= startLine - 15; j--) {
        const searchLine = lines[j];
        if (searchLine.match(/^echo\s+'/)) {
          // Found start of echo, extract content up to the pipe
          const echoContent = lines
            .slice(j, startLine)
            .join("\n")
            .match(/echo\s+'([\s\S]*?)'\s*\|/);
          if (echoContent) {
            inputData = echoContent[1];
          }
          break;
        }
      }
    }
  }

  // Check for expected output from PREVIOUS lines (when awk output goes to foo2, expected in foo1)
  // Pattern: ./echo 'expected' >foo1  then  ./echo 'input' >foo  then  $awk '...' foo >foo2
  // Need to search backwards for multi-line echo patterns
  if (fooNum === "2" && startLine > 0) {
    // Search backwards for echo pattern ending with >foo1
    for (let j = startLine - 1; j >= Math.max(0, startLine - 15); j--) {
      const prevLine = lines[j];
      // Skip empty lines and comments
      if (prevLine.trim() === "" || prevLine.trim().startsWith("#")) {
        continue;
      }
      // Stop if we hit another awk command or comparison (to not cross test boundaries)
      if (
        prevLine.match(/^\$awk/) ||
        prevLine.match(/^(?:diff|cmp)\s+/) ||
        prevLine.match(/\|\|\s*\.?\/?echo/)
      ) {
        break;
      }
      // Single-line echo with quotes - handles both 'echo' and './echo'
      const prevEchoMatch = prevLine.match(
        /^\.?\/?echo\s+(['"])(.*?)\1\s*>\s*foo1$/,
      );
      if (prevEchoMatch) {
        expectedOutput = prevEchoMatch[2]
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t");
        break;
      }
      // Single-line echo without quotes - handles both 'echo' and './echo'
      const prevEchoNoQuoteMatch = prevLine.match(
        /^\.?\/?echo\s+(.+?)\s*>\s*foo1$/,
      );
      if (prevEchoNoQuoteMatch) {
        expectedOutput = prevEchoNoQuoteMatch[1];
        break;
      }
      // Multi-line echo (check if this line ends with ' >foo1 or " >foo1)
      if (prevLine.match(/^[^'"]*['"]\s*>\s*foo1$/)) {
        // Search backwards for the echo start
        for (let k = j; k >= Math.max(0, j - 15); k--) {
          if (lines[k].match(/^\.?\/?echo\s+'/)) {
            const echoContent = lines
              .slice(k, j + 1)
              .join("\n")
              .match(/\.?\/?echo\s+'([\s\S]*?)'\s*>\s*foo1/);
            if (echoContent) {
              expectedOutput = echoContent[1];
            }
            break;
          }
        }
        break;
      }
    }
  }

  // Look for the expected output and diff/cmp line
  for (let j = startLine + 1; j < Math.min(startLine + 15, lines.length); j++) {
    const line = lines[j];

    // echo 'expected' >foo1/foo2 (with quotes) - handles both 'echo' and './echo'
    const echoMatch = line.match(/\.?\/?echo\s+(['"])(.*?)\1\s*>\s*foo([12])/);
    if (echoMatch && echoMatch[3] !== fooNum) {
      expectedOutput = echoMatch[2].replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      nextLine = j + 1;
    }

    // echo expected >foo1/foo2 (without quotes) - handles both 'echo' and './echo'
    if (!echoMatch) {
      const echoNoQuoteMatch = line.match(
        /^\.?\/?echo\s+(\S+)\s*>\s*foo([12])$/,
      );
      if (echoNoQuoteMatch && echoNoQuoteMatch[2] !== fooNum) {
        expectedOutput = echoNoQuoteMatch[1];
        nextLine = j + 1;
      }
    }

    // Multi-line echo expected output (echo 'line1\nline2' spanning lines)
    // Check if this line starts an echo but doesn't end with >foo on same line
    if (
      line.match(/^\.?\/?echo\s+['"][^'"]*$/) &&
      !line.includes(">foo") &&
      !expectedOutput
    ) {
      const quoteChar = line.includes('"') ? '"' : "'";
      const echoLines: string[] = [line.replace(/^\.?\/?echo\s+['"]/, "")];
      let echoEndLine = j;
      for (let k = j + 1; k < lines.length; k++) {
        const kLine = lines[k];
        // Check if line ends with quote followed by >foo
        if (kLine.match(new RegExp(`${quoteChar}\\s*>\\s*foo([12])$`))) {
          const fooMatch = kLine.match(/foo([12])$/);
          // Only use this expected output if foo number differs from AWK output
          if (fooMatch && fooMatch[1] !== fooNum) {
            echoLines.push(
              kLine.replace(new RegExp(`${quoteChar}\\s*>\\s*foo\\d$`), ""),
            );
            expectedOutput = echoLines.join("\n");
            nextLine = k + 1;
          }
          echoEndLine = k;
          break;
        }
        echoLines.push(kLine);
      }
      j = echoEndLine;
      continue;
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
  }

  if (!testName) {
    testName = `test at line ${startLine + 1}`;
  }

  // Handle input file
  if (inputFile && inputFile !== "/dev/null") {
    // Input from a file - we'd need to track file contents
    // For now, mark as needing the file
    inputData = `[file: ${inputFile}]`;
  }

  return {
    testCase: {
      name: testName,
      program,
      input: inputData,
      expectedOutput,
      lineNumber: startLine + 1,
      originalCommand: awkLine.trim(),
      ...(Object.keys(vars).length > 0 ? { vars } : {}),
    },
    nextLine,
  };
}

/**
 * Try to parse a multi-line awk program test
 */
export function tryParseMultiLineAwkTest(
  lines: string[],
  startLine: number,
): ParseResult | null {
  const firstLine = lines[startLine];

  // Check for $awk ' pattern that continues on next lines
  if (!firstLine.match(/\$awk\s+'/)) {
    return null;
  }

  // Find the closing quote - need to handle the case where awk program spans multiple lines
  let program = "";
  let endLine = startLine;
  let quoteCount = 0;

  for (let j = startLine; j < lines.length; j++) {
    const line = lines[j];
    // Count single quotes (very basic - doesn't handle escapes properly)
    for (const char of line) {
      if (char === "'") quoteCount++;
    }
    program += (j === startLine ? "" : "\n") + line;
    // Need at least 2 quotes and even count
    if (quoteCount >= 2 && quoteCount % 2 === 0) {
      // Check if line ends with >foo or has redirection
      if (line.includes(">foo") || line.match(/'[^']*$/)) {
        endLine = j;
        break;
      }
    }
  }

  // Extract the program from between quotes
  const programMatch = program.match(
    /\$awk\s+(?:-[^\s]+\s+)?'([\s\S]*?)'\s*(?:\/dev\/null|[^\s>]*)?/,
  );
  if (!programMatch) {
    return null;
  }

  // Skip commands that redirect to /dev/null - these aren't real tests
  if (program.includes(">/dev/null") || program.includes("> /dev/null")) {
    return null;
  }

  // Check for input file or heredoc input
  let inputData = "";
  const inputFileMatch = program.match(/'\s+(\S+)\s*>\s*foo/);
  if (inputFileMatch && inputFileMatch[1] !== "/dev/null") {
    inputData = `[file: ${inputFileMatch[1]}]`;
  }

  // Check for heredoc input (<<! ... !)
  const heredocInputMatch = program.match(/<<\s*!$/);
  if (heredocInputMatch) {
    const heredocLines: string[] = [];
    let heredocEndLine = endLine;
    for (let j = endLine + 1; j < lines.length; j++) {
      if (lines[j] === "!") {
        heredocEndLine = j;
        break;
      }
      heredocLines.push(lines[j]);
    }
    inputData = heredocLines.join("\n");
    endLine = heredocEndLine;
  }

  // Look for expected output and test name
  let expectedOutput = "";
  let testName = "";
  let nextLine = endLine + 1;

  for (let j = endLine + 1; j < Math.min(endLine + 20, lines.length); j++) {
    const line = lines[j];

    // Simple echo expected output (with quotes) - handles both 'echo' and './echo'
    const echoMatch = line.match(
      /^\.?\/?(echo)\s+(['"])(.*?)\2\s*>\s*foo([12])$/,
    );
    if (echoMatch) {
      expectedOutput = echoMatch[3].replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      nextLine = j + 1;
    }

    // Simple echo expected output (without quotes) - handles both 'echo' and './echo'
    if (!echoMatch) {
      const echoNoQuoteMatch = line.match(
        /^\.?\/?(echo)\s+(\S+)\s*>\s*foo([12])$/,
      );
      if (echoNoQuoteMatch) {
        expectedOutput = echoNoQuoteMatch[2];
        nextLine = j + 1;
      }
    }

    // Multi-line echo expected output (echo '1\n0\n1' style) - handles both 'echo' and './echo'
    const multiLineEchoMatch = line.match(
      /\.?\/?echo\s+['"]([^'"]*(?:\\n[^'"]*)*)['"]\s*>\s*foo([12])/,
    );
    if (multiLineEchoMatch) {
      expectedOutput = multiLineEchoMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t");
      nextLine = j + 1;
    }

    // Multi-line echo expected output (echo "foo\nbar" spanning lines) - handles both 'echo' and './echo'
    if (line.match(/^\.?\/?echo\s+["'][^"']*$/) && !line.includes(">foo")) {
      const quoteChar = line.includes('"') ? '"' : "'";
      const echoLines: string[] = [line.replace(/^\.?\/?echo\s+["']/, "")];
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

    // cat << heredoc expected output
    if (line.match(/cat\s+<<\s*\\?['"]?(\w+)['"]?\s*>\s*foo/)) {
      const heredoc = extractCatHeredoc(lines, j);
      if (heredoc) {
        expectedOutput = heredoc.content;
        nextLine = heredoc.endLine + 1;
        j = heredoc.endLine;
        continue;
      }
    }

    // cat <<! ... ! expected output (different delimiter)
    if (line.match(/cat\s+<<\s*!?\s*>\s*foo/)) {
      const heredocLines: string[] = [];
      let heredocEndLine = j;
      for (let k = j + 1; k < lines.length; k++) {
        if (lines[k] === "!") {
          heredocEndLine = k;
          break;
        }
        heredocLines.push(lines[k]);
      }
      expectedOutput = heredocLines.join("\n");
      nextLine = heredocEndLine + 1;
      j = heredocEndLine;
      continue;
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

    // Also check for grep-based error checks (grep 'pattern' ... || echo 'BAD:')
    const grepMatch = line.match(
      /grep\s+.*\|\|\s*echo\s+(['"])?(?:BAD:\s*)?([^'"]+)\1?/,
    );
    if (grepMatch) {
      testName = cleanTestName(grepMatch[2]);
      nextLine = j + 1;
      break;
    }

    // grep ... && echo 'BAD:' means: if grep finds pattern, test fails
    // This implies expected output should NOT contain the pattern (effectively empty output)
    const grepAndMatch = line.match(
      /grep\s+.*&&\s*echo\s+(['"])?(?:BAD:\s*)?([^'"]+)\1?/,
    );
    if (grepAndMatch) {
      testName = cleanTestName(grepAndMatch[2]);
      expectedOutput = ""; // grep should NOT find pattern, so output is empty
      nextLine = j + 1;
      break;
    }
  }

  if (!testName) {
    testName = `test at line ${startLine + 1}`;
  }

  // If no expected output found after the AWK command, check previous lines
  // Pattern: echo 'expected' >foo1  followed by  $awk '...' >foo2
  if (!expectedOutput && startLine > 0) {
    for (let j = startLine - 1; j >= Math.max(0, startLine - 5); j--) {
      const prevLine = lines[j];
      // Skip comments and empty lines
      if (prevLine.trim() === "" || prevLine.trim().startsWith("#")) {
        continue;
      }
      // Multi-line echo (check if this line ends a multi-line echo)
      // Handles both 'echo' and './echo' for onetrueawk test suite
      if (prevLine.match(/^[^']*'\s*>\s*foo1$/)) {
        // Search backwards for the echo start
        for (let k = j; k >= Math.max(0, j - 10); k--) {
          if (lines[k].match(/^\.?\/?echo\s+'/)) {
            const echoContent = lines
              .slice(k, j + 1)
              .join("\n")
              .match(/\.?\/?echo\s+'([\s\S]*?)'\s*>\s*foo1/);
            if (echoContent) {
              expectedOutput = echoContent[1];
            }
            break;
          }
        }
        break;
      }
      // Single-line echo with quotes - handles both 'echo' and './echo'
      const prevEchoMatch = prevLine.match(
        /\.?\/?echo\s+(['"])(.*?)\1\s*>\s*foo1$/,
      );
      if (prevEchoMatch) {
        expectedOutput = prevEchoMatch[2]
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t");
        break;
      }
      // Single-line echo without quotes - handles both 'echo' and './echo'
      const prevEchoNoQuoteMatch = prevLine.match(
        /\.?\/?echo\s+(.+?)\s*>\s*foo1$/,
      );
      if (prevEchoNoQuoteMatch) {
        expectedOutput = prevEchoNoQuoteMatch[1];
        break;
      }
      // Stop if we hit another command that's not echo
      if (
        prevLine.match(/^\$awk/) ||
        prevLine.match(/^diff/) ||
        prevLine.match(/^cmp/)
      ) {
        break;
      }
    }
  }

  return {
    testCase: {
      name: testName,
      program: programMatch[1],
      input: inputData,
      expectedOutput,
      lineNumber: startLine + 1,
      originalCommand: program.split("\n")[0].trim(),
    },
    nextLine,
  };
}
