/**
 * Skip list for grep spec tests
 *
 * Tests in this list are expected to fail. If a test passes unexpectedly,
 * the test runner will report it as a failure so we know to remove it from the skip list.
 */

/**
 * Files to skip entirely
 */
const SKIP_FILES: Set<string> = new Set<string>([]);

/**
 * Individual test skips within files
 * Format: "fileName:testName" -> skipReason
 */
const SKIP_TESTS: Map<string, string> = new Map<string, string>([
  // ============================================================
  // BusyBox tests
  // ============================================================
  // Tests that reference $0 or external state
  ["busybox-grep.tests:grep (exit success)", "references $0 script name"],

  // Tests using - for stdin argument position
  ["busybox-grep.tests:grep - (specify stdin)", "- stdin arg not supported"],
  [
    "busybox-grep.tests:grep - infile (specify stdin and file)",
    "- stdin arg not supported",
  ],
  [
    "busybox-grep.tests:grep - nofile (specify stdin and nonexisting file)",
    "- stdin arg not supported",
  ],
  [
    "busybox-grep.tests:grep -q - nofile (specify stdin and nonexisting file, match)",
    "- stdin arg not supported",
  ],
  [
    "busybox-grep.tests:grep -s nofile - (stdin and nonexisting file, match)",
    "- stdin arg not supported",
  ],
  ["busybox-grep.tests:grep -L exitcode 0 #2", "- stdin arg not supported"],

  // Tests that create external files (>empty, mkdir)
  ["busybox-grep.tests:grep two files", "creates external empty file"],

  // -s option (suppress errors)
  [
    "busybox-grep.tests:grep -s nofile (nonexisting file, no match)",
    "-s option not implemented",
  ],

  // NUL byte handling with -a option
  ["busybox-grep.tests:grep handles NUL in files", "-a option / NUL handling"],
  ["busybox-grep.tests:grep handles NUL on stdin", "-a option / NUL handling"],

  // Multiple -e patterns
  [
    "busybox-grep.tests:grep handles multiple regexps",
    "multiple -e patterns not supported",
  ],
  [
    "busybox-grep.tests:grep -F handles multiple expessions",
    "multiple -e patterns not supported",
  ],
  [
    "busybox-grep.tests:grep -x -v -e EXP1 -e EXP2 finds nothing if either EXP matches",
    "multiple -e patterns not supported",
  ],

  // -f option (read patterns from file)
  [
    "busybox-grep.tests:grep can read regexps from stdin",
    "-f option not supported",
  ],

  // -L option (print files without matches)
  ["busybox-grep.tests:grep -L exitcode 0", "-L option not implemented"],

  // -o option (only matching) - these tests now pass since POSIX character classes are implemented
  [
    "busybox-grep.tests:grep -o does not loop forever",
    "-o option not implemented",
  ],
  [
    "busybox-grep.tests:grep -o does not loop forever on zero-length match",
    "-o option not implemented",
  ],

  // -v with -f on empty file
  ["busybox-grep.tests:grep -v -f EMPTY_FILE", "-f option not supported"],
  ["busybox-grep.tests:grep -vxf EMPTY_FILE", "-f option not supported"],

  // Newline-delimited patterns via command substitution
  [
    "busybox-grep.tests:grep PATTERN can be a newline-delimited list",
    "newline-delimited patterns not supported",
  ],
  [
    "busybox-grep.tests:grep -e PATTERN can be a newline-delimited list",
    "newline-delimited patterns not supported",
  ],

  // Recursive grep with symlinks (requires mkdir/symlink setup)
  [
    "busybox-grep.tests:grep -r on symlink to dir",
    "test requires external directory setup",
  ],
  [
    "busybox-grep.tests:grep -r on dir/symlink to dir",
    "test requires external directory setup",
  ],
]);

/**
 * Pattern-based skips for tests matching certain patterns
 *
 * NOTE: For GNU grep tests, prefer using # SKIP: comments directly in the
 * test files rather than adding patterns here.
 */
const SKIP_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [];

/**
 * Get skip reason for a test
 */
export function getSkipReason(
  fileName: string,
  testName: string,
  command?: string,
): string | undefined {
  // Check file-level skip first
  if (SKIP_FILES.has(fileName)) {
    return `File skipped: ${fileName}`;
  }

  // Check individual test skip (exact match)
  const key = `${fileName}:${testName}`;
  const exactMatch = SKIP_TESTS.get(key);
  if (exactMatch) {
    return exactMatch;
  }

  // Check pattern-based skips against test name
  for (const { pattern, reason } of SKIP_PATTERNS) {
    if (pattern.test(testName)) {
      return reason;
    }
  }

  // Check pattern-based skips against command content
  if (command) {
    for (const { pattern, reason } of SKIP_PATTERNS) {
      if (pattern.test(command)) {
        return reason;
      }
    }
  }

  return undefined;
}

/**
 * Check if entire file should be skipped
 */
export function isFileSkipped(fileName: string): boolean {
  return SKIP_FILES.has(fileName);
}
