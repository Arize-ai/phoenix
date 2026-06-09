## compare_shells: bash dash mksh zsh 
## oils_failures_allowed: 0

#### can continue after unknown option 
#
# TODO: this is the posix special builtin logic?
# dash and mksh make this a fatal error no matter what.

set -o errexit
set -o STRICT || true # unknown option
echo hello
## stdout: hello
## status: 0
## BUG dash/mksh/zsh stdout-json: ""
## BUG dash status: 2
## BUG mksh/zsh status: 1

#### set with both options and argv
set -o errexit a b c
echo "$@"
false
echo done
## stdout: a b c
## status: 1

#### nounset with "$@"
set a b c
set -u  # shouldn't touch argv
echo "$@"
## stdout: a b c

#### set -u -- clears argv
set a b c
set -u -- # shouldn't touch argv
echo "$@"
## stdout: 

#### set -u -- x y z
set a b c
set -u -- x y z
echo "$@"
## stdout: x y z

#### set -u with undefined variable exits the interpreter
## SKIP (unimplementable): Interactive shell invocation not implemented

# non-interactive
$SH -c 'set -u; echo before; echo $x; echo after'
if test $? -ne 0; then
  echo OK
fi

# interactive
$SH -i -c 'set -u; echo before; echo $x; echo after'
if test $? -ne 0; then
  echo OK
fi

## STDOUT:
before
OK
before
OK
## END

#### set -u with undefined var in interactive shell does NOT exit the interpreter
## SKIP (unimplementable): Interactive shell invocation not implemented

# In bash, it aborts the LINE only.  The next line is executed!

# non-interactive
$SH -c 'set -u; echo before; echo $x; echo after
echo line2
'
if test $? -ne 0; then
  echo OK
fi

# interactive
$SH -i -c 'set -u; echo before; echo $x; echo after
echo line2
'
if test $? -ne 0; then
  echo OK
fi

## STDOUT:
before
OK
before
line2
## END

## BUG dash/mksh/zsh STDOUT:
before
OK
before
OK
## END

#### set -u error can break out of nested evals
## SKIP (unimplementable): Interactive shell invocation not implemented
$SH -c '
set -u
test_function_2() {
  x=$blarg
}
test_function() {
  eval "test_function_2"
}

echo before
eval test_function
echo after
'
# status must be non-zero: bash uses 1, ash/dash exit 2
if test $? -ne 0; then
  echo OK
fi

## STDOUT:
before
OK
## END
## BUG zsh/mksh STDOUT:
before
after
## END

#### reset option with long flag
set -o errexit
set +o errexit
echo "[$unset]"
## stdout: []
## status: 0

#### reset option with short flag
set -u 
set +u
echo "[$unset]"
## stdout: []
## status: 0

#### set -eu (flag parsing)
set -eu 
echo "[$unset]"
echo status=$?
## stdout-json: ""
## status: 1
## OK dash status: 2

#### set -o lists options
# NOTE: osh doesn't use the same format yet.
set -o | grep -o noexec
## STDOUT:
noexec
## END

#### 'set' and 'eval' round trip

# NOTE: not testing arrays and associative arrays!
_space='[ ]'
_whitespace=$'[\t\r\n]'
_sq="'single quotes'"
_backslash_dq="\\ \""
_unicode=$'[\u03bc]'

# Save the variables
varfile=$TMP/vars-$(basename $SH).txt

set | grep '^_' > "$varfile"

# Unset variables
unset _space _whitespace _sq _backslash_dq _unicode
echo [ $_space $_whitespace $_sq $_backslash_dq $_unicode ]

# Restore them

. $varfile
echo "Code saved to $varfile" 1>&2  # for debugging

test "$_space" = '[ ]' && echo OK
test "$_whitespace" = $'[\t\r\n]' && echo OK
test "$_sq" = "'single quotes'" && echo OK
test "$_backslash_dq" = "\\ \"" && echo OK
test "$_unicode" = $'[\u03bc]' && echo OK

## STDOUT:
[ ]
OK
OK
OK
OK
OK
## END

## BUG zsh status: 1
## BUG zsh STDOUT:
[ ]
## END

#### set - - and so forth
set a b
echo "$@"

set - a b
echo "$@"

set -- a b
echo "$@"

set - -
echo "$@"

set -- --
echo "$@"

# note: zsh is different, and yash is totally different
## STDOUT:
a b
a b
a b
-
--
## END
## N-I yash STDOUT:
a b
- a b
a b
- -
--
## END
## BUG zsh STDOUT:
a b
a b
a b

--
## END

#### set - leading single dash is ignored, turns off xtrace verbose (#2364)

show_options() {
  case $- in
    *v*) echo verbose-on ;;
  esac
  case $- in
    *x*) echo xtrace-on ;;
  esac
}

set -x -v
show_options
echo

set - a b c
echo "$@"
show_options
echo

# dash that's not leading is not special
set x - y z
echo "$@"

## STDOUT:
verbose-on
xtrace-on

a b c

x - y z
## END

## BUG zsh STDOUT:
verbose-on
xtrace-on

a b c
verbose-on
xtrace-on

x - y z
## END

#### set - stops option processing like set --
case $SH in zsh) exit ;; esac

show_options() {
  case $- in
    *v*) echo verbose-on ;;
  esac
  case $- in
    *x*) echo xtrace-on ;;
  esac
}

set -x - -v

show_options
echo argv "$@"

## STDOUT:
argv -v
## END

## N-I zsh STDOUT:
## END

#### A single + is an ignored flag; not an argument
case $SH in zsh) exit ;; esac

show_options() {
  case $- in
    *v*) echo verbose-on ;;
  esac
  case $- in
    *x*) echo xtrace-on ;;
  esac
}

set +
echo plus "$@"

set -x + -v x y
show_options
echo plus "$@"

## STDOUT:
plus
verbose-on
xtrace-on
plus x y
## END

## BUG mksh STDOUT:
plus
xtrace-on
plus -v x y
## END

## N-I zsh STDOUT:
## END

#### set - + and + -
set - +
echo "$@"

set + -
echo "$@"

## STDOUT:
+
+
## END

## BUG mksh STDOUT:
+
-
## END

## OK zsh/osh STDOUT:
+

## END

#### set -a exports variables
set -a
FOO=bar
BAZ=qux
printenv.py FOO BAZ
## STDOUT:
bar
qux
## END

#### set +a stops exporting
set -a
FOO=exported
set +a
BAR=not_exported
printenv.py FOO BAR
## STDOUT:
exported
None
## END

#### set -o allexport (long form)
set -o allexport
VAR1=value1
set +o allexport
VAR2=value2
printenv.py VAR1 VAR2
## STDOUT:
value1
None
## END

#### variables set before set -a are not exported
BEFORE=before_value
set -a
AFTER=after_value
printenv.py BEFORE AFTER
## STDOUT:
None
after_value
## END

#### set -a exports local variables
set -a
f() {
  local ZZZ=zzz
  printenv.py ZZZ
}
f
## STDOUT:
zzz
## END
## BUG mksh stdout: None

#### set -a exports declare variables
set -a
declare ZZZ=zzz
printenv.py ZZZ
## STDOUT:
zzz
## END
## N-I dash/mksh stdout: None
