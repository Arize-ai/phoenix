# Bash Spec Tests

These spec tests are imported from the [Oils project](https://github.com/oils-for-unix/oils) (formerly Oil Shell).

## License for the cases/*.sh files

Apache License 2.0 - see [LICENSE-APACHE-2.0.txt](./cases/LICENSE-APACHE-2.0.txt)

## Source

- Repository: https://github.com/oils-for-unix/oils
- Directory: `spec/`
- Imported: January 2025

## Running Tests

### Run All Spec Tests

```bash
# Run all spec tests (may take several minutes)
python -m pytest tests/spec_tests/test_spec.py -v

# Run with minimal output
python -m pytest tests/spec_tests/test_spec.py -q
```

### Run Specific Test Files

```bash
# Run tests from a specific spec file
python -m pytest tests/spec_tests/test_spec.py -k "arith.test.sh"

# Run builtin-related tests
python -m pytest tests/spec_tests/test_spec.py -k "builtin"

# Run loop tests
python -m pytest tests/spec_tests/test_spec.py -k "loop"
```

### Run with Failure Limits

```bash
# Stop after first 10 failures
python -m pytest tests/spec_tests/test_spec.py --maxfail=10

# Run without traceback for cleaner output
python -m pytest tests/spec_tests/test_spec.py --tb=no -q
```

### Run a Single Test Case

```bash
# Run a specific test case by name
python -m pytest "tests/spec_tests/test_spec.py::TestSpecTests::test_spec_case[arith.test.sh::Add one to var[L25]]" -v
```

## Test Format

Each `.test.sh` file contains test cases in the following format:

```bash
#### Test Name
command_to_test
## stdout: expected output
## status: 0

#### Another Test
some_command
## STDOUT:
multi
line
output
## END
## status: 0

## Shell-specific variations:
## OK zsh stdout: different output   # acceptable variation in zsh
## N-I dash status: 2                # Not Implemented in dash
## SKIP                              # Skip this test (known failure)
```

## Shells Compared

The original Oils tests compare behavior across:

- bash
- dash
- mksh
- zsh
- ash (busybox)
- osh (Oils shell)

Our implementation targets **bash** compatibility specifically.

## Test Categories

| Pattern | Description |
|---------|-------------|
| `arith*.test.sh` | Arithmetic expansion `$((...))` |
| `array*.test.sh` | Array operations |
| `assign*.test.sh` | Variable assignment |
| `builtin-*.test.sh` | Builtin commands (cd, test, read, etc.) |
| `glob*.test.sh` | Globbing/pathname expansion |
| `var-op-*.test.sh` | Parameter expansion operators |
| `word-*.test.sh` | Word splitting and expansion |
| `redirect*.test.sh` | I/O redirection |
| `command-sub.test.sh` | Command substitution `$(...)` |
| `here-doc.test.sh` | Here documents `<<EOF` |
| `loop.test.sh` | for/while/until loops |
| `case_.test.sh` | Case statements |
| `func*.test.sh` | Function definitions |

## Test Infrastructure

The test infrastructure consists of:

- `parser.py` - Parses the Oils spec test format
- `runner.py` - Executes tests against our bash interpreter
- `helpers.py` - Test helper commands (argv.py, etc.)
- `test_spec.py` - pytest integration

## Known Limitations

Some tests are skipped due to intentional limitations:

- Tests requiring `set -x` trace output (xtrace accepted but trace not implemented)
- Tests for features not implemented (e.g., `select`, coprocesses)
- Tests requiring real filesystem access
- Tests for interactive features

## Attribution

These test cases are derived from the Oils project's comprehensive bash compatibility test suite. The Oils project provides an excellent resource for understanding bash behavior across different shell implementations.

For more information about the Oils project, visit: https://www.oilshell.org/
