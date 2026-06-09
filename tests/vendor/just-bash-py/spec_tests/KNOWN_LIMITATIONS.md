# Known Limitations

This document describes bash features that are intentionally not implemented in just-bash-py. Tests for these features are marked with `## SKIP:` in the spec test files or excluded via `SKIP_FILES` in `test_spec.py`.

---

## AI Agent Priority List

Features prioritized for AI agent use cases. These are the most impactful gaps for agents running scripts in sandboxed environments.

### Critical (Implement First)

| Feature | Tests | AI Agent Use Case | Status |
|---------|-------|-------------------|--------|
| **PIPESTATUS** | 7 | Agents chain commands (`cmd1 | cmd2 | cmd3`) and need to know which stage failed | Pending |
| **read -a array** | ~3 | Parse output into arrays: `read -a parts <<< "$line"` | Pending |
| **mapfile/readarray** | 13 | Process multi-line output into arrays: `mapfile -t lines < <(find ...)` | Pending |
| **errexit in compound commands** | 9 | Scripts with `set -e` must fail properly in `{ }` blocks and pipelines | Pending |

### High (Implement Second)

| Feature | Tests | AI Agent Use Case | Status |
|---------|-------|-------------------|--------|
| **read -d delim** | ~3 | Parse NUL-separated output from `find -print0`, handle CSV data | Pending |
| **read -n** | ~2 | Read fixed-length fields | Pending |
| **printf %q** | 14 | Safely quote strings when generating shell commands programmatically | Pending |
| **set -f (noglob)** | 2 | Disable glob expansion when handling untrusted input safely | Pending |
| **read -N** | ~2 | Read exact N chars ignoring delimiters | Pending |

### Medium (Nice to Have)

| Feature | Tests | AI Agent Use Case | Status |
|---------|-------|-------------------|--------|
| **IFS edge cases** | ~8 | Complex text parsing scenarios | Pending |
| **Here-doc edge cases** | ~5 | Multi-line string handling in scripts | Partial |
| **Right brace in default** | 46 | Complex parameter expansions | Pending |

### Low Priority for Agents

| Feature | Tests | Reason |
|---------|-------|--------|
| **read -t timeout** | ~2 | Less relevant in non-interactive sandbox |
| **read -s silent** | ~2 | No TTY in sandboxed environment |
| **extglob** | 50 | Basic globs usually sufficient |
| **hash** | 3 | Command caching irrelevant in sandbox |
| **history** | 29 | Interactive feature, out of scope |

---

## Currently Implemented Features

The following core features are implemented in just-bash-py:

### Parser & AST
- Command parsing (simple, compound, pipelines)
- Quoting (single, double, ANSI-C `$'...'`)
- Here-documents (`<<EOF`, `<<-EOF`, `<<<`)
- Parameter expansion (`$var`, `${var}`, `${var:-default}`, etc.)
- Command substitution (`$(cmd)` and backticks)
- Arithmetic expansion (`$((...))`)
- Brace expansion (`{a,b,c}`, `{1..10}`)
- Glob patterns (`*`, `?`, `[...]`)

### Control Flow
- if/elif/else
- for loops (word list and C-style)
- while/until loops
- case statements
- Functions
- Subshells `(...)`
- Brace groups `{ ...; }`

### Builtins
- `test` / `[`
- `cd`
- `export`
- `set` / `shift`
- `unset`
- `local`
- `source` / `.`
- `eval`
- `break` / `continue` / `return` / `exit`
- `echo` / `printf`
- `read` (basic)
- `true` / `false`
- `:`

### Conditionals
- `[[ ... ]]` extended test
- String comparisons (`=`, `!=`, `<`, `>`, `=~`)
- File tests (`-f`, `-d`, `-e`, `-r`, `-w`, `-x`, etc.)
- Arithmetic tests (`-eq`, `-ne`, `-lt`, `-gt`, etc.)
- Logical operators (`&&`, `||`, `!`)

---

## Summary by Category

| Category | Tests | Priority | AI Agent Priority | Status |
|----------|-------|----------|-------------------|--------|
| **PIPESTATUS variable** | 7 | High | Critical | Pending |
| **read -a array** | ~3 | Medium | Critical | Pending |
| **read -d/-n options** | ~4 | Medium | High | Pending |
| **printf %q format** | 14 | Low | High | Pending |
| **set -f (noglob)** | 2 | Low | High | Pending |
| **mapfile/readarray** | 13 | Medium | Critical | Pending |
| **errexit in compound commands** | 9 | High | Critical | Pending |
| **read -N option** | ~2 | Medium | High | Pending |
| IFS edge cases | ~8 | High | Medium | Pending |
| Here-doc edge cases | ~5 | Medium | Medium | Partial |
| Right brace in default value | 46 | Medium | Medium | Pending |
| extglob patterns | 50 | Low | Low | - |
| File descriptor operations | ~15 | Low | Low | - |
| Interactive/Shell invocation | ~85 | Out of scope | Out of scope | - |
| History builtin | 29 | Out of scope | Out of scope | - |

---

## High Priority (Core functionality gaps)

### PIPESTATUS Variable (7 tests)
The `PIPESTATUS` array containing exit statuses of pipeline commands is not implemented.
- **AI Use Case**: Agents frequently chain commands and need to identify which stage failed
- Example: `cmd1 | cmd2 | cmd3; echo "${PIPESTATUS[@]}"` to get `0 1 0`

### errexit in Compound Commands (9 tests)
`set -e` (errexit) doesn't interact correctly with:
- Brace groups `{ }`
- Pipelines
- Subshells
- **AI Use Case**: Scripts must fail reliably on errors for agent error handling

### IFS Edge Cases (~8 tests)
Complex IFS handling edge cases remain:
- Empty IFS with positional parameter existence checks
- IFS with backslash in certain contexts
- Some `$*` joining edge cases with empty IFS

---

## Medium Priority (Commonly used features)

### Right Brace in Default Value (46 tests)
Complex parameter expansions with `}` in default values like `${x:-a}b}` have parsing limitations.

### Here-Document Edge Cases (~11 tests)
- Quoted delimiters with special characters
- Multiple here-docs on same line
- Here-doc after function definition

### Parse Error Detection (~10 tests)
Some parse error messages and detection differ from bash:
- Unterminated quotes
- Nested array literals
- Ambiguous syntax

---

## Low Priority (Advanced/rarely used features)

### Shell Options

#### extglob (50 tests)
Extended glob patterns like `@(foo|bar)`, `+(pattern)`, `?(pattern)`, `!(pattern)` are not supported.

#### noclobber / set -C (6 tests)
The `set -C` option to prevent overwriting files with `>` is not implemented.

#### noglob / set -f (2 tests)
The `set -f` option to disable pathname expansion is not implemented.
- **AI Use Case**: Safely handle untrusted input containing glob characters

#### noexec / set -n (1 test)
The `set -n` option to parse but not execute commands is not implemented.

#### POSIX mode (8 tests)
`set -o posix` for strict POSIX compliance is not implemented.

### Builtins

#### mapfile/readarray (13 tests)
The `mapfile` and `readarray` builtins for reading lines into an array are not implemented.
- **AI Use Case**: Essential for processing multi-line command output
- Example: `mapfile -t files < <(find . -name "*.py")`

#### read Options (22 tests)
Advanced `read` options are not implemented:
- `-a array` - read into array (AI Critical)
- `-d delim` - custom delimiter (AI High)
- `-n N` / `-N N` - read N characters (AI High)
- `-t timeout` - timeout
- `-u fd` - read from file descriptor
- `-s` - silent mode
- `-e` - use readline
- `-i text` - default text
- `-p prompt` - prompt string

#### printf %q Format (14 tests)
The `%q` format for shell quoting is not implemented.
- **AI Use Case**: Safely quote strings when agents generate shell commands

#### printf strftime (4 tests)
The `%(format)T` strftime format is not implemented.

#### hash (3 tests)
The `hash` builtin for managing the command hash table is not implemented.

### File Descriptors

#### {fd} Variable Syntax (3 tests)
Automatic file descriptor allocation with `{fd}>file` syntax is not implemented.

#### Close/Move Syntax (5 tests)
File descriptor close (`>&-`, `<&-`) and move (`>&N-`) syntax is not implemented.

#### Advanced Redirections (6 tests)
- `exec N<file` - opening specific file descriptors
- `N<&M` - duplicating file descriptors
- Read-write mode `<>`

### Filesystem

#### Symbolic Links (6 tests)
Symlink operations including:
- `ln -s` command
- `-h` / `-L` test operators
- `pwd -P` / `cd -P` physical path resolution

#### File Time Comparison (2 tests)
`-ot` (older than), `-nt` (newer than), `-ef` (same file) test operators are not implemented.

### Arithmetic

#### 64-bit Integers (7 tests)
Python handles arbitrary precision integers, but some edge cases differ:
- Bitwise operations may differ at boundaries
- printf with unsigned/octal/hex of negative numbers

#### Dynamic Variable Names (5 tests)
Runtime variable name construction in arithmetic like `$((f$x + 1))` is not implemented.

#### Comments in Arithmetic (1 test)
Comments inside `$((...))` are not supported.

### Parameter Expansion

#### ${@:0:N} Slice (5 tests)
Slicing positional parameters starting from position 0 (which includes `$0`) is not implemented.

### Brace Expansion

#### Variable Expansion Order (1 test)
In bash, brace expansion happens before variable expansion.

#### Mixed Case Ranges (1 test)
Character ranges like `{z..A}` mixing cases are not implemented.

### Quoting

#### Backtick Quoting (4 tests)
Complex escape sequences within backticks are not fully supported.

### Conditional Expressions

#### [[ ]] Edge Cases (5 tests)
- Runtime evaluation via variable expansion
- Arguments resembling operators
- Tilde expansion edge cases

### Functions

#### Name with Expansion (2 tests)
Function names containing `$` or command substitution are not supported.

#### Here-doc After Definition (1 test)
`func() { } <<EOF` syntax is not implemented.

---

## Out of Scope

### Interactive Shell Invocation (~85 tests)
Tests requiring `$SH -c` or `$SH -i` to spawn subshells, TTY interaction, or process control.

### History Builtin (29 tests)
The `history` builtin and history expansion are not implemented.

### Oils-Specific Features (~10 tests)
YSH/Oils extensions like `shopt -s ysh:*`, `strict_arg_parse`, `command_sub_errexit`.

### ZSH-Specific (~3 tests)
ZSH-specific `setopt` options.

---

## Skipped Test Files

The following test files are entirely skipped via `SKIP_FILES` in `test_spec.py`:

### Interactive Shell (require TTY)
- `interactive.test.sh`
- `interactive-parse.test.sh`
- `prompt.test.sh`
- `builtin-history.test.sh`
- `builtin-fc.test.sh`
- `builtin-bind.test.sh`
- `builtin-completion.test.sh`

### Process/Job Control (require real processes)
- `background.test.sh`
- `builtin-process.test.sh`
- `builtin-kill.test.sh`
- `builtin-trap.test.sh`
- `builtin-trap-bash.test.sh`
- `builtin-trap-err.test.sh`
- `builtin-times.test.sh`
- `process-sub.test.sh`

### Shell Features Not Implemented
- `alias.test.sh` - alias expansion
- `xtrace.test.sh` - set -x tracing
- `builtin-dirs.test.sh` - directory stack
- `sh-usage.test.sh` - shell invocation options

### ZSH-Specific
- `zsh-assoc.test.sh`
- `zsh-idioms.test.sh`

### BLE (Bash Line Editor)
- `ble-features.test.sh`
- `ble-idioms.test.sh`
- `ble-unset.test.sh`

### External Dependencies
- `nul-bytes.test.sh` - NUL byte handling
- `unicode.test.sh` - Unicode support

### Meta/Introspection
- `introspect.test.sh`
- `print-source-code.test.sh`
- `serialize.test.sh`
- `spec-harness-bug.test.sh`

### Documentation (not real tests)
- `known-differences.test.sh`
- `divergence.test.sh`

### Toysh-Specific
- `toysh.test.sh`
- `toysh-posix.test.sh`

### Blog/Exploration (not spec tests)
- `blog1.test.sh`
- `blog2.test.sh`
- `blog-other1.test.sh`
- `explore-parsing.test.sh`

### Extended Globbing
- `extglob-match.test.sh`
- `extglob-files.test.sh`
- `globstar.test.sh`
- `globignore.test.sh`
- `nocasematch-match.test.sh`

### Advanced Features Not Implemented
- `builtin-getopts.test.sh` - getopts builtin
- `nameref.test.sh` - nameref/declare -n
- `var-ref.test.sh` - ${!var} indirect references
- `regex.test.sh` - =~ regex matching
- `sh-options.test.sh` - shopt options
- `sh-options-bash.test.sh`

### Bash-Specific Builtins
- `builtin-bash.test.sh`
- `builtin-type-bash.test.sh`
- `builtin-vars.test.sh`
- `builtin-meta.test.sh`
- `builtin-meta-assign.test.sh`

### Advanced Array Features
- `array-assoc.test.sh` - associative arrays
- `array-sparse.test.sh` - sparse arrays
- `array-compat.test.sh`
- `array-literal.test.sh`
- `array-assign.test.sh`

### Complex Assignment
- `assign-extended.test.sh`
- `assign-deferred.test.sh`
- `assign-dialects.test.sh`

### Advanced Arithmetic
- `arith-dynamic.test.sh`

### Complex Redirections
- `redirect-multi.test.sh`
- `redirect-command.test.sh`
- `redir-order.test.sh`

### Other Advanced Features
- `command-sub-ksh.test.sh`
- `vars-bash.test.sh`
- `var-op-bash.test.sh`
- `type-compat.test.sh`
- `shell-grammar.test.sh`
- `shell-bugs.test.sh`
- `nix-idioms.test.sh`
- `paren-ambiguity.test.sh`
- `fatal-errors.test.sh`
- `for-expr.test.sh`
- `glob-bash.test.sh`
- `bool-parse.test.sh`
- `arg-parse.test.sh`
- `append.test.sh`
- `bugs.test.sh`
