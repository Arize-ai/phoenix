## oils_failures_allowed: 1
## compare_shells: bash dash mksh zsh ash

# spec/bool-parse.test.sh
#
# [ and [[ share the BoolParser
#
# These test cases are for some bugs fixed
#
# See also
#   spec/builtin-bracket.test.sh for [
#   spec/dbracket.test.sh        for [[

#### test builtin - Unexpected trailing word '--' (#2409)

# Minimal repro of sqsh build error
set -- -o; test $# -ne 0 -a "$1" != "--"
echo status=$?

# Now hardcode $1
test $# -ne 0 -a "-o" != "--"
echo status=$?

# Remove quotes around -o
test $# -ne 0 -a -o != "--"
echo status=$?

# How about a different flag?
set -- -z; test $# -ne 0 -a "$1" != "--"
echo status=$?

# A non-flag?
set -- z; test $# -ne 0 -a "$1" != "--"
echo status=$?

## STDOUT:
status=0
status=0
status=0
status=0
status=0
## END

#### test builtin: ( = ) is confusing: equality test or non-empty string test

# here it's equality
test '(' = ')'
echo status=$?

# here it's like -n =
test 0 -eq 0 -a '(' = ')'
echo status=$?

## STDOUT:
status=1
status=0
## END

## BUG zsh STDOUT:
status=0
status=1
## END

#### test builtin: ( == ) is confusing: equality test or non-empty string test

# here it's equality
test '(' == ')'
echo status=$?

# here it's like -n ==
test 0 -eq 0 -a '(' == ')'
echo status=$?

## STDOUT:
status=1
status=0
## END

## BUG dash STDOUT:
status=0
status=0
## END

## BUG-2 zsh status: 1
## BUG-2 zsh STDOUT:
## END

#### Allowed: [[ = ]] and [[ == ]]

[[ = ]]
echo status=$?
[[ == ]]
echo status=$?

## STDOUT:
status=0
status=0
## END

## N-I dash STDOUT:
status=127
status=127
## END

## BUG zsh status: 1
## BUG zsh STDOUT:
status=0
## END

#### Not allowed: [[ ) ]] and [[ ( ]]

[[ ) ]]
echo status=$?
[[ ( ]]
echo status=$?

## status: 2
## OK mksh status: 1
## STDOUT:
## END
## OK zsh status: 1
## OK zsh STDOUT:
status=1
## END

#### test builtin: ( x ) behavior is the same in both cases

test '(' x ')'
echo status=$?

test 0 -eq 0 -a '(' x ')'
echo status=$?

## STDOUT:
status=0
status=0
## END

#### [ -f = ] and [ -f == ]

[ -f = ]
echo status=$?
[ -f == ]
echo status=$?

## STDOUT:
status=1
status=1
## END

## BUG zsh status: 1
## BUG zsh STDOUT:
status=1
## END

#### [[ -f -f ]] and [[ -f == ]]
[[ -f -f ]]
echo status=$?

[[ -f == ]]
echo status=$?

## STDOUT:
status=1
status=1
## END

## N-I dash STDOUT:
status=127
status=127
## END

## BUG zsh status: 1
## BUG zsh STDOUT:
status=1
## END
