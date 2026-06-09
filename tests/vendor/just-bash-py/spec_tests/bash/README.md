# Bash Spec Tests

These spec tests are imported from the [Oils project](https://github.com/oils-for-unix/oils) (formerly Oil Shell).

## License for the cases/\*.sh files

Apache License 2.0 - see [LICENSE-APACHE-2.0.txt](./cases/LICENSE-APACHE-2.0.txt)

## Source

- Repository: https://github.com/oils-for-unix/oils
- Directory: `spec/`
- Imported: December 2025

## Format

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
```

## Shells Compared

The tests compare behavior across:

- bash
- dash
- mksh
- zsh
- ash (busybox)
- osh (Oils shell)

## Test Categories

- `arith*.test.sh` - Arithmetic expansion
- `array*.test.sh` - Array operations
- `assign*.test.sh` - Variable assignment
- `builtin-*.test.sh` - Builtin commands
- `glob*.test.sh` - Globbing/pathname expansion
- `var-op-*.test.sh` - Parameter expansion operators
- `word-*.test.sh` - Word splitting and expansion
- `redirect*.test.sh` - I/O redirection
- `command-sub.test.sh` - Command substitution
- `here-doc.test.sh` - Here documents
- And many more...

## Usage

These tests can be used to verify bash compatibility by:

1. Parsing the test format
2. Running each test case through bash-env
3. Comparing output against expected results

See the Oils project for their test runner implementation.
