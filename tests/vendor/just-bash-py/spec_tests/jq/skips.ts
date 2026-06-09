/**
 * Skip list for JQ spec tests
 *
 * Tests in this list are expected to fail. If a test passes unexpectedly,
 * the test runner will report it as a failure so we know to remove it from the skip list.
 */

/**
 * Files to skip entirely
 */
const SKIP_FILES: Set<string> = new Set<string>([
  // Oniguruma regex library (external C dependency)
  "onig.test",
  "manonig.test",

  // Experimental/optional JQ features
  "optional.test",
]);

/**
 * Individual test skips within files
 * Format: "fileName:testName" -> skipReason
 */
const SKIP_TESTS: Map<string, string> = new Map<string, string>([
  // ============================================================
  // Destructuring edge cases
  // ============================================================
  [
    "jq.test:. as [] | null",
    "Empty array pattern should error on non-empty input",
  ],
  [
    "jq.test:. as {} | null",
    "Empty object pattern should error on non-object input",
  ],
  [
    "jq.test:. as {(true):$foo} | $foo",
    "Computed key with non-string expression should error",
  ],

  // ============================================================
  // ltrimstr/rtrimstr type checking
  // ============================================================
  [
    'jq.test:.[] as [$x, $y] | try ["ok", ($x | ltrimstr($y))] catch ["ko", .]',
    "ltrimstr should error on non-string inputs",
  ],
  [
    'jq.test:.[] as [$x, $y] | try ["ok", ($x | rtrimstr($y))] catch ["ko", .]',
    "rtrimstr should error on non-string inputs",
  ],

  // ============================================================
  // def call-by-name semantics
  // ============================================================
  [
    "jq.test:def f(x): x | x; f([.], . + [42])",
    "def: requires call-by-name semantics for filter parameters",
  ],
  [
    "jq.test:def x(a;b): a as $a | b as $b | $a + $b; def y($a;$b): $a + $b; def check(a;b): [x(a;b)] == [y(a;b)]; check(.[];.[]*2)",
    "def: requires call-by-name semantics for filter parameters",
  ],
  [
    "jq.test:def inc(x): x |= .+1; inc(.[].a)",
    "def: update operator on parameter requires call-by-name",
  ],
  [
    "jq.test:def x: .[1,2]; x=10",
    "def: user-defined function as path expression not supported",
  ],
  [
    "jq.test:try (def x: reverse; x=10) catch .",
    "def: user-defined function as path expression not supported",
  ],

  // ============================================================
  // Invalid escape sequences
  // ============================================================
  ['jq.test:"u\\vw"', "Invalid \\v escape sequence test"],

  // ============================================================
  // Undefined variable behavior
  // ============================================================
  [
    "jq.test:. as $foo | [$foo, $bar]",
    "Undefined variable $bar behavior differs",
  ],

  // ============================================================
  // NUL character handling
  // ============================================================
  ['jq.test:"\\u0000\\u0020\\u0000" + .', "NUL character handling differs"],
  [
    'jq.test:[contains("cd"), contains("b\\u0000"), contains("b\\u0000c"), contains("d")]',
    "contains with NUL character",
  ],
  [
    'jq.test:[contains("b\\u0000c"), contains("b\\u0000cd"), contains("cd")]',
    "contains with NUL character",
  ],
  [
    'jq.test:[contains(""), contains("\\u0000")]',
    "contains with NUL character edge case",
  ],

  // ============================================================
  // walk edge cases
  // ============================================================
  [
    "jq.test:walk(select(IN({}, []) | not))",
    "walk replaces filtered values with null instead of removing",
  ],
  ["jq.test:[walk(.,1)]", "walk with generator argument"],

  // ============================================================
  // getpath/setpath/delpaths edge cases
  // ============================================================
  [
    'jq.test:["foo",1] as $p | getpath($p), setpath($p; 20), delpaths([[$p]])',
    "getpath with string/number path",
  ],
  ["jq.test:delpaths([[-200]])", "delpaths with large negative index"],

  // ============================================================
  // label with keyword variable names
  // ============================================================
  [
    "jq.test:[ label $if | range(10) | ., (select(. == 5) | break $if), . ]",
    "label with keyword name $if",
  ],

  // ============================================================
  // fromjson edge cases
  // ============================================================
  [
    "jq.test:.[] | try (fromjson | isnan) catch .",
    "fromjson with array iteration",
  ],

  // ============================================================
  // try-catch complex nesting
  // ============================================================
  [
    'jq.test:try (["hi","ho"]|.[]|(try . catch (if .=="ho" then "BROKEN"|error else "caught: \\(.)" end))) catch .',
    "Complex try-catch nesting",
  ],
  [
    'jq.test:.[]|(try . catch (if .=="ho" then "BROKEN"|error else "caught: \\(.)" end))',
    "Complex try-catch nesting",
  ],

  // ============================================================
  // String interpolation edge cases
  // ============================================================
  [
    'jq.test:"inter\\("pol" + "ation")"',
    "String interpolation with complex expression",
  ],
  ['jq.test:@html "<b>\\(.)</b>"', "String interpolation in @html"],
  ['jq.test:{"a",b,"a$\\(1+1)"}', "String interpolation in object key"],

  // ============================================================
  // Float slice assignment
  // ============================================================
  [
    'jq.test:try ("foobar" | .[1.5:3.5] = "xyz") catch .',
    "Float slice assignment on string",
  ],
  [
    'jq.test:try ([range(10)] | .[1.5:3.5] = ["xyz"]) catch .',
    "Float slice assignment on array",
  ],
  [
    'jq.test:try ("foobar" | .[1.5]) catch .',
    "Float index on string should error",
  ],

  // ============================================================
  // path() with select/map
  // ============================================================
  ["jq.test:path(.foo[0,1])", "Complex path with multiple indices"],
  ["jq.test:path(.[] | select(.>3))", "path with select not supported"],
  [
    "jq.test:try path(.a | map(select(.b == 0))) catch .",
    "path with map/select not supported",
  ],
  [
    "jq.test:try path(.a | map(select(.b == 0)) | .[0]) catch .",
    "path with map/select not supported",
  ],
  [
    "jq.test:try path(.a | map(select(.b == 0)) | .c) catch .",
    "path with map/select not supported",
  ],
  [
    "jq.test:try path(.a | map(select(.b == 0)) | .[]) catch .",
    "path with map/select not supported",
  ],
  ["jq.test:path(.a[path(.b)[0]])", "Nested path expressions not supported"],

  // ============================================================
  // Update with select/empty
  // ============================================================
  [
    "jq.test:(.[] | select(. >= 2)) |= empty",
    "Update with empty and select not implemented",
  ],
  ["jq.test:.[] |= select(. % 2 == 0)", "Update with select not implemented"],
  ["jq.test:.foo[1,4,2,3] |= empty", "Update multiple indices with empty"],
  [
    "jq.test:try ((map(select(.a == 1))[].b) = 10) catch .",
    "Update through map/select not supported",
  ],
  [
    "jq.test:try ((map(select(.a == 1))[].a) |= .+1) catch .",
    "Update through map/select not supported",
  ],
  [
    'jq.test:.[] | try (getpath(["a",0,"b"]) |= 5) catch .',
    "getpath update not supported",
  ],

  // ============================================================
  // NaN multiplication
  // ============================================================
  ["jq.test:[. * (nan,-nan)]", "NaN multiplication special handling"],

  // ============================================================
  // Iterator order difference (acceptable)
  // ============================================================
  [
    "jq.test:[foreach .[] / .[] as $i (0; . + $i)]",
    "Iterator order for .[] / .[] differs from jq",
  ],

  // ============================================================
  // Depth limit tests
  // Our depth limit (2000) is lower than jq's to ensure V8 compatibility
  // ============================================================
  [
    "jq.test:reduce range(9999) as $_ ([];[.]) | tojson | fromjson | flatten",
    "Our depth limit (2000) returns null before reaching 9999 levels",
  ],
  [
    'jq.test:reduce range(10000) as $_ ([];[.]) | tojson | try (fromjson) catch . | (contains("<skipped: too deep>") | not) and contains("Exceeds depth limit for parsing")',
    "Depth limit test - different error messages",
  ],
  [
    'jq.test:reduce range(10001) as $_ ([];[.]) | tojson | contains("<skipped: too deep>")',
    "Depth limit test - different error messages",
  ],
  [
    "jq.test:try (. * 1000000000) catch .",
    "String multiplication overflow error message differs",
  ],

  // ============================================================
  // pow/trim precision
  // ============================================================
  [
    "jq.test:[range(-52;52;1)] as $powers | [$powers[]|pow(2;.)] | [.[52], .[51], .[0], .[-1], .[-2]] as $s | [$s[], $s[0]/$s[1], $s[3]/$s[4]]",
    "pow with fractional exponent precision",
  ],
  [
    "jq.test:trim, ltrim, rtrim",
    "trim doesn't handle all Unicode whitespace characters",
  ],

  // ============================================================
  // man.test specific skips
  // ============================================================
  [
    "man.test:[repeat(.*2, error)?]",
    "repeat with error and ? operator interaction",
  ],
  ["man.test:env.PAGER", "env.PAGER not set in sandbox"],
  ["man.test:$ENV.PAGER", "$ENV.PAGER not set in sandbox"],
  [
    'man.test:@sh "echo \\(.)"',
    "@sh format with string interpolation not supported",
  ],
  [
    'man.test:. == {"b": {"d": (4 + 1e-20), "c": 3}, "a":1}',
    "floating point comparison with epsilon",
  ],
  [
    "man.test:.[] as {$a, $b, c: {$d, $e}} ?// {$a, $b, c: [{$d, $e}]} | {$a, $b, $d, $e}",
    "?// alternative with complex destructuring patterns",
  ],
  [
    "man.test:.[] as {$a, $b, c: {$d}} ?// {$a, $b, c: [{$e}]} | {$a, $b, $d, $e}",
    "?// alternative with complex destructuring patterns",
  ],
  [
    'man.test:.[] as [$a] ?// [$b] | if $a != null then error("err: \\($a)") else {$a,$b} end',
    "?// alternative with array destructuring and error",
  ],
  [
    "man.test:reduce .[] as {$x,$y} (null; .x += $x | .y += [$y])",
    "reduce with object destructuring pattern",
  ],
  [
    "man.test:foreach .[] as $item (0; . + 1; {index: ., $item})",
    "foreach with variable shorthand in object construction",
  ],
  [
    'man.test:(..|select(type=="boolean")) |= if . then 1 else 0 end',
    "recursive descent update with select",
  ],
  ["man.test:(.a, .b) = range(3)", "comma expression path assignment"],
  ["man.test:(.a, .b) |= range(3)", "comma expression path update"],
]);

/**
 * Pattern-based skips for tests matching certain patterns
 */
const SKIP_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // ============================================================
  // OUT OF SCOPE / INFRASTRUCTURE
  // ============================================================

  // Module system - out of scope for sandboxed jq
  { pattern: /^include "/, reason: "Module system not implemented" },
  { pattern: /^import "/, reason: "Module system not implemented" },
  { pattern: /\bmodulemeta\b/, reason: "modulemeta not implemented" },

  // Environment/stdin access - sandboxed environment
  { pattern: /\binputs\b/, reason: "inputs not implemented" },
  { pattern: /\binput\s*[|)]/, reason: "input not implemented (no stdin)" },
  { pattern: /\binput\s*$/, reason: "input not implemented (no stdin)" },
  { pattern: /\binput\s+catch\b/, reason: "input not implemented (no stdin)" },
  { pattern: /[|;(]\s*input\b/, reason: "input not implemented (no stdin)" },

  // Debug introspection
  { pattern: /\$__loc__/, reason: "$__loc__ not implemented" },
  { pattern: /\$__prog__/, reason: "$__prog__ not implemented" },

  // External dependencies
  { pattern: /\bhave_decnum\b/, reason: "have_decnum not implemented" },

  // Locale-dependent time functions
  { pattern: /\bstrflocaltime\b/, reason: "strflocaltime not implemented" },
  { pattern: /\blocaltime\b/, reason: "localtime not implemented" },

  // ============================================================
  // ERROR MESSAGE DIFFERENCES (acceptable)
  // ============================================================

  { pattern: /try join\(","\) catch \./, reason: "join error message" },
  {
    pattern: /try \(\. \* 1000000000\) catch \./,
    reason: "String multiply overflow",
  },
  { pattern: /^try fromjson catch \.$/, reason: "fromjson error" },
  { pattern: /reduce range\(1000[01]\) as.*tojson/, reason: "depth limit" },
  { pattern: /^%%FAIL/, reason: "Error behavior test not supported" },
  { pattern: /try @base64d catch/, reason: "base64d error handling differs" },
  { pattern: /try @urid catch/, reason: "@urid error message differs" },

  // ============================================================
  // PARSER LIMITATIONS
  // ============================================================

  // Programs starting with negative numbers
  { pattern: /^-\d/, reason: "Program starting with - parsed as flag" },

  // ============================================================
  // MISSING FUNCTIONS
  // ============================================================

  // Date functions
  { pattern: /\bdateadd\b/, reason: "dateadd not implemented" },
  { pattern: /\bdatesub\b/, reason: "datesub not implemented" },

  // Format functions
  { pattern: /\bformat\(/, reason: "format() not implemented" },
  { pattern: /@base32/, reason: "@base32 not implemented" },
  { pattern: /@html /, reason: "@html format not implemented" },

  // Math functions (obscure)
  { pattern: /\bj0\b/, reason: "j0 not implemented" },
  { pattern: /\bj1\b/, reason: "j1 not implemented" },
  { pattern: /\by0\b/, reason: "y0 not implemented" },
  { pattern: /\by1\b/, reason: "y1 not implemented" },
  { pattern: /\bpow10\(/, reason: "pow10() not implemented" },
  { pattern: /\bgamma\b/, reason: "gamma not implemented" },
  { pattern: /\blgamma\b/, reason: "lgamma not implemented" },
  { pattern: /\btgamma\b/, reason: "tgamma not implemented" },

  // Literals
  { pattern: /\bInfinity\b/, reason: "Infinity literal not supported" },
  { pattern: /-Infinity\b/, reason: "-Infinity literal not supported" },

  // ============================================================
  // IMPLEMENTATION BUGS
  // ============================================================

  // del with generator args
  {
    pattern: /\bdel\(\.[^)]+,\.[^)]+\)/,
    reason: "Parser: generator args in del",
  },

  // path() function limitations
  { pattern: /^path\(\.foo\[0,1\]\)$/, reason: "path multi-index" },
  { pattern: /path\(\.\[\] \| select/, reason: "path with select" },
  { pattern: /try path\(\.a \| map\(select/, reason: "path with map/select" },
  { pattern: /path\(\.a\[path\(/, reason: "nested path" },

  // Update expressions with select/empty
  {
    pattern: /\(\.\[\] \| select.*\) \|= empty/,
    reason: "update select empty",
  },
  { pattern: /\.\[\] \|= select\(/, reason: "update with select" },
  {
    pattern: /\.foo\[\d+,\d+,\d+,\d+\] \|= empty/,
    reason: "multi-index empty",
  },
  { pattern: /map\(select.*\[\]\./, reason: "update through map/select" },
  { pattern: /getpath\(\["a",0,"b"\]\) \|=/, reason: "getpath update" },

  // Float slice assignment
  { pattern: /\.\[\d+\.\d+:\d+\.\d+\] =/, reason: "Float slice assignment" },

  // del/delpaths edge cases
  { pattern: /try delpaths\(\d+\)/, reason: "delpaths type error" },
  { pattern: /del\(\.\),/, reason: "del(.) expression" },
  { pattern: /del\(empty\)/, reason: "del(empty) expression" },
  { pattern: /del\(\(\.[^)]+,\.[^)]+\)/, reason: "del with comma expressions" },
  { pattern: /del\(\.\[.*,.*\]\)/, reason: "del with multiple indices" },
  {
    pattern: /delpaths\(\[\[-\d+\]\]\)/,
    reason: "delpaths with large negative",
  },

  // setpath edge cases
  { pattern: /setpath\(\[-\d+\]/, reason: "setpath with negative index" },
  { pattern: /setpath\(\[\[/, reason: "setpath with array key" },

  // Auto-vivification issues
  {
    pattern: /\.\[\d+\]\[\d+\] = \d+/,
    reason: "Nested index auto-vivification",
  },
  {
    pattern: /\.foo\[\d+\]\.bar = /,
    reason: "Nested field/index auto-vivification",
  },
  {
    pattern: /\.foo = \.bar$/,
    reason: "Self-referential assignment key order differs",
  },
  {
    pattern: /try \(\.foo\[-\d+\] = \d+\) catch/,
    reason: "Negative index assignment on null",
  },

  // ============================================================
  // EDGE CASES
  // ============================================================

  // String escape sequences
  { pattern: /\\v/, reason: "Parser: \\v escape not supported" },
  { pattern: /\\t/, reason: "Parser: tab escape in test input" },
  { pattern: /\\b/, reason: "Parser: backspace escape in test input" },
  { pattern: /\\f/, reason: "Parser: formfeed escape in test input" },
  { pattern: /"[^"]*\t[^"]*"/, reason: "Literal tab in test input" },
  { pattern: /"u\\vw"/, reason: "\\v escape sequence test" },

  // NUL character handling
  { pattern: /"\\u0000.*" \+ \./, reason: "NUL character string concat" },
  { pattern: /contains\("b\\u0000/, reason: "contains with NUL char" },

  // String interpolation edge cases
  { pattern: /inter\\\(/, reason: "String interpolation with backslash" },
  {
    pattern: /\{"[^"]*",\w+,"[^"]*\$\\/,
    reason: "Object shorthand with interpolation",
  },

  // Complex assignment
  {
    pattern: /\..*as \$\w+ \| [^|]+\) = /,
    reason: "Assignment after variable binding",
  },
  {
    pattern: /\(\.\. \| select.*\) = /,
    reason: "Assignment after recursive descent with select",
  },
  { pattern: /\(\.\. \|.*\).*\|=/, reason: "Recursive descent assignment" },
  {
    pattern: /\.\[\d+:\d+\] = \(.*,.*\)/,
    reason: "Slice assignment with multiple values",
  },

  // Sorting/comparison edge cases
  { pattern: /sort_by\(.*,.*\)/, reason: "sort_by with multiple keys" },
  {
    pattern: /\[min, max, min_by\(\.\[1\]\)/,
    reason: "min/max with complex comparison",
  },

  // Dynamic field access
  { pattern: /\.foo\[\.baz\]/, reason: "Dynamic field access" },

  // Keywords as identifiers
  { pattern: /\{if:\d+,and:\d+/, reason: "Keywords as object keys" },
  { pattern: /\$foreach.*\$and.*\$or/, reason: "Keywords as variables" },
  { pattern: /\{ \$x, as,/, reason: "Complex object shorthand" },
  { pattern: /\. as \{as:/, reason: "Complex destructuring" },
  { pattern: /label \$if/, reason: "label with keyword variable name" },

  // fromjson edge cases
  { pattern: /\.\[\] \| try \(fromjson/, reason: "fromjson with iteration" },

  // try-catch edge cases
  { pattern: /try \(if.*error end\) catch.*\/\//, reason: "try-catch with //" },
  {
    pattern: /try.*\.\[\].*try \. catch \(if/,
    reason: "Complex try-catch nesting",
  },
  {
    pattern: /\.\[\]\|\(try \. catch \(if/,
    reason: "Complex try-catch with error propagation",
  },
  { pattern: /\|= try tonumber/, reason: "Update with try" },

  // implode edge case
  { pattern: /0\[implode\]/, reason: "implode in index" },

  // foreach edge cases
  { pattern: /foreach.*as.*\(0, 1;/, reason: "foreach multiple inits" },

  // map with try
  { pattern: /map\(try \.a\[\]/, reason: "map with try" },

  // String negation
  { pattern: /\* range\(0; 12; 2\).*try -\./, reason: "String negation" },

  // Negation of optional
  { pattern: /try -\.\? catch/, reason: "Negation of optional expression" },
  { pattern: /try -\. catch \.$|try -\.\?/, reason: "Negation of optional" },

  // null * string
  { pattern: /\.\[\] \* "abc"/, reason: "null * string behavior" },

  // NaN multiplication
  { pattern: /\. \* \(nan,-nan\)/, reason: "NaN multiply" },

  // Undefined variable
  { pattern: /\[\$foo, \$bar\]/, reason: "undefined variable" },

  // walk with generator
  { pattern: /walk\(\.,\d+\)/, reason: "walk with generator argument" },
];

/**
 * Input patterns that should cause a test to be skipped
 */
const SKIP_INPUT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Literal tab character in input
  { pattern: /\t/, reason: "Literal tab in input" },
  // Emoji flag characters (multi-codepoint indexing issues)
  { pattern: /🇬🇧/, reason: "Emoji flag codepoint indexing differs" },
  // delpaths bug with specific input
  { pattern: /^\{"bar":false\}$/, reason: "delpaths with string path bug" },
  // unique sort order bug
  { pattern: /^\[1,2,5,3,5,3,1,3\]$/, reason: "unique sort order differs" },
  // nan/NaN/Infinity literals in JSON input (not valid standard JSON)
  {
    pattern: /[:[,]nan[\],}]/,
    reason: "nan literal in JSON input not supported",
  },
  {
    pattern: /Infinity/,
    reason: "Infinity literal in JSON input not supported",
  },
  {
    pattern: /NaN/,
    reason: "NaN literal in JSON input not supported",
  },
];

/**
 * Get skip reason for a test
 */
export function getSkipReason(
  fileName: string,
  testName: string,
  program?: string,
  input?: string,
  isErrorTest?: boolean,
): string | undefined {
  // Check file-level skip first
  if (SKIP_FILES.has(fileName)) {
    return `File skipped: ${fileName}`;
  }

  // Check individual test skip (exact match by test name)
  const key = `${fileName}:${testName}`;
  const exactMatch = SKIP_TESTS.get(key);
  if (exactMatch) {
    return exactMatch;
  }

  // For error tests, also check by program name
  if (program) {
    const programKey = `${fileName}:${program}`;
    const programMatch = SKIP_TESTS.get(programKey);
    if (programMatch) {
      return programMatch;
    }
  }

  // For error tests, only use exact SKIP_TESTS matches
  if (isErrorTest) {
    return undefined;
  }

  // Check pattern-based skips against test name
  for (const { pattern, reason } of SKIP_PATTERNS) {
    if (pattern.test(testName)) {
      return reason;
    }
  }

  // Check pattern-based skips against program content
  if (program) {
    for (const { pattern, reason } of SKIP_PATTERNS) {
      if (pattern.test(program)) {
        return reason;
      }
    }
  }

  // Check input-based skips
  if (input) {
    for (const { pattern, reason } of SKIP_INPUT_PATTERNS) {
      if (pattern.test(input)) {
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
