## oils_failures_allowed: 0
## compare_shells: bash dash mksh zsh ash yash

#### true is not special; prefix assignments don't persist, it can be redefined
foo=bar true
echo foo=$foo

true() {
  echo true func
}
foo=bar true
echo foo=$foo

## STDOUT:
foo=
true func
foo=
## END

## BUG mksh STDOUT:
foo=
true func
foo=bar
## END

# POSIX rule about special builtins pointed at:
#
# https://www.reddit.com/r/oilshell/comments/5ykpi3/oildev_is_alive/

#### Prefix assignments persist after special builtins, like : (set -o posix)
case $SH in
  bash) set -o posix ;;
esac

foo=bar :
echo foo=$foo

# Not true when you use 'builtin'
z=Z builtin :
echo z=$Z

## STDOUT:
foo=bar
z=
## END

## BUG zsh STDOUT:
foo=
z=
## END

#### Prefix assignments persist after readonly, but NOT exported (set -o posix)
# Bash only implements it behind the posix option
case $SH in
  bash) set -o posix ;;
esac
foo=bar readonly spam=eggs
echo foo=$foo
echo spam=$spam

# should NOT be exported
printenv.py foo
printenv.py spam

## STDOUT:
foo=bar
spam=eggs
None
None
## END

## BUG bash/yash STDOUT:
foo=bar
spam=eggs
bar
None
## END

#### Prefix binding for exec is a special case (versus e.g. readonly)

pre1=pre1 readonly x=x
pre2=pre2 exec sh -c 'echo pre1=$pre1 x=$x pre2=$pre2'

## STDOUT:
pre1= x= pre2=pre2
## END
## BUG yash STDOUT:
pre1=pre1 x= pre2=pre2
## END

#### exec without args is a special case of the special case in some shells

FOO=bar exec >& 2
echo FOO=$FOO
#declare -p | grep FOO

## STDERR:
FOO=
## END

## OK dash/mksh/ash/yash STDERR:
FOO=bar
## END

#### Which shells allow special builtins to be redefined?
eval() {
  echo 'eval func' "$@"
}
eval 'echo hi'

# we allow redefinition, but the definition is NOT used!
## status: 0
## STDOUT:
hi
## END

# we PREVENT redefinition
## OK dash/ash status: 2
## OK dash/ash STDOUT:
## END

# should not allow redefinition
## BUG bash/zsh status: 0
## BUG bash/zsh STDOUT:
eval func echo hi
## END


#### Special builtins can't be redefined as shell functions (set -o posix)
case $SH in
  bash) set -o posix ;;
esac

eval 'echo hi'

eval() {
  echo 'sh func' "$@"
}

eval 'echo hi'

## status: 0
## STDOUT:
hi
hi
## END

## OK bash/dash/ash status: 2
## OK bash/dash/ash STDOUT:
hi
## END

## BUG zsh status: 0
## BUG zsh STDOUT:
hi
sh func echo hi
## END

#### Non-special builtins CAN be redefined as functions
test -n "$BASH_VERSION" && set -o posix
true() {
  echo 'true func'
}
true hi
echo status=$?
## STDOUT:
true func
status=0
## END

#### Shift is special and fails whole script

# https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_14
#
# 2.8.1 - Consequences of shell errors
#
# Special built-ins should exit a non-interactive shell
# bash and busybox dont't implement this even with set -o posix, so it seems risky
# dash and mksh do it; so does AT&T ksh

$SH -c '
if test -n "$BASH_VERSION"; then
  set -o posix
fi
set -- a b
shift 3
echo status=$?
'
if test "$?" != 0; then
  echo 'non-zero status'
fi

## STDOUT:
non-zero status
## END

## N-I bash/zsh/ash/yash/osh status: 0
## N-I bash/zsh/ash/yash/osh STDOUT:
status=1
## END

#### set is special and fails whole script, even if using || true
$SH -c '
if test -n "$BASH_VERSION"; then
  set -o posix
fi

shopt -s invalid_ || true
echo ok
set -o invalid_ || true
echo should not get here
'
if test "$?" != 0; then
  echo 'non-zero status'
fi

## STDOUT:
ok
non-zero status
## END

## N-I bash/ash/yash/osh status: 0
## N-I bash/ash/yash/osh STDOUT:
ok
should not get here
## END

#### bash 'type' gets confused - says 'function', but runs builtin
case $SH in dash|mksh|zsh|ash|yash) exit ;; esac

echo TRUE
type -t true  # builtin
true() { echo true func; }
type -t true  # now a function
echo ---

echo EVAL

type -t eval  # builtin
# define function before set -o posix
eval() { echo "shell function: $1"; }
# bash runs the FUNCTION, but OSH finds the special builtin
# OSH doesn't need set -o posix
eval 'echo before posix'

if test -n "$BASH_VERSION"; then
  # this makes the eval definition invisible!
  set -o posix
fi

eval 'echo after posix'  # this is the builtin eval
# bash claims it's a function, but it's a builtin
type -t eval

# it finds the function and the special builtin
#type -a eval

## BUG bash STDOUT:
TRUE
builtin
function
---
EVAL
builtin
shell function: echo before posix
after posix
function
## END

## STDOUT:
TRUE
builtin
function
---
EVAL
builtin
before posix
after posix
builtin
## END

## N-I dash/mksh/zsh/ash/yash STDOUT:
## END

#### command, builtin - both can be redefined, not special (regression)
case $SH in dash|ash|yash) exit ;; esac

builtin echo b
command echo c

builtin() {
  echo builtin-redef "$@"
}

command() {
  echo command-redef "$@"
}

builtin echo b
command echo c

## STDOUT:
b
c
builtin-redef echo b
command-redef echo c
## END
## N-I dash/ash/yash STDOUT:
## END
