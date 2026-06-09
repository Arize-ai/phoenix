## compare_shells: bash
## oils_failures_allowed: 8

#### sh -i
## SKIP (unimplementable): Shell invocation not supported
# Notes:
# - OSH prompt goes to stdout and bash goes to stderr
# - This test seems to fail on the system bash, but succeeds with spec-bin/bash
echo 'echo foo' | PS1='[prompt] ' $SH --rcfile /dev/null -i >out.txt 2>err.txt
fgrep -q '[prompt]' out.txt err.txt
echo match=$?
## STDOUT:
match=0
## END

#### \[\] are non-printing
PS1='\[foo\]\$'
echo "${PS1@P}"
## STDOUT:
foo$
## END

#### literal escapes
PS1='\a\e\r\n'
echo "${PS1@P}"
## stdout-json: "\u0007\u001b\r\n\n"

#### special case for $
# NOTE: This might be broken for # but it's hard to tell since we don't have
# root.  Could inject __TEST_EUID or something.
PS1='$'
echo "${PS1@P}"
PS1='\$'
echo "${PS1@P}"
PS1='\\$'
echo "${PS1@P}"
PS1='\\\$'
echo "${PS1@P}"
PS1='\\\\$'
echo "${PS1@P}"
## STDOUT:
$
$
$
\$
\$
## END

#### PS1 evaluation order
x='\'
y='h'
PS1='$x$y'
echo "${PS1@P}"
## STDOUT:
\h
## END

#### PS1 evaluation order 2
foo=foo_value
dir=$TMP/'$foo'  # Directory name with a dollar!
mkdir -p $dir
cd $dir
PS1='\w $foo'
test "${PS1@P}" = "$PWD foo_value"
echo status=$?
## STDOUT:
status=0
## END

#### \1004
PS1='\1004$'
echo "${PS1@P}"
## STDOUT:
@4$
## END

#### \001 octal literals are supported
PS1='[\045]'
echo "${PS1@P}"
## STDOUT:
[%]
## END

#### \555 is beyond max octal byte of \377 and wrapped to m
PS1='\555$'
echo "${PS1@P}"
## STDOUT:
m$
## END

#### \x55 hex literals not supported
PS1='[\x55]'
echo "${PS1@P}"
## STDOUT:
[\x55]
## END

#### Single backslash
PS1='\'
echo "${PS1@P}"
## STDOUT:
\
## END

#### Escaped backslash
PS1='\\'
echo "${PS1@P}"
## STDOUT:
\
## END

#### \0001 octal literals are not supported
PS1='[\0455]'
echo "${PS1@P}"
## STDOUT:
[%5]
## END

#### \u0001 unicode literals not supported
PS1='[\u0001]'
USER=$(whoami)
test "${PS1@P}" = "[${USER}0001]"
echo status=$?
## STDOUT:
status=0
## END

#### constant string
PS1='$ '
echo "${PS1@P}"
## STDOUT:
$ 
## END

#### hostname

# NOTE: This test is not hermetic.  On my machine the short and long host name
# are the same.

PS1='\h '
test "${PS1@P}" = "$(hostname -s) "  # short name
echo status=$?
PS1='\H '
test "${PS1@P}" = "$(hostname) "
echo status=$?
## STDOUT:
status=0
status=0
## END

#### username
PS1='\u '
USER=$(whoami)
test "${PS1@P}" = "${USER} "
echo status=$?
## STDOUT:
status=0
## END

#### current working dir
PS1='\w '
test "${PS1@P}" = "${PWD} "
echo status=$?
## STDOUT:
status=0
## END

#### \W is basename of working dir
PS1='\W '
test "${PS1@P}" = "$(basename $PWD) "
echo status=$?
## STDOUT:
status=0
## END

#### \t for 24h time (HH:MM:SS)
PS1='foo \t bar'
echo "${PS1@P}" | egrep -q 'foo [0-2][0-9]:[0-5][0-9]:[0-5][0-9] bar'
echo matched=$?

## STDOUT:
matched=0
## END

#### \T for 12h time (HH:MM:SS)
PS1='foo \T bar'
echo "${PS1@P}" | egrep -q 'foo [0-1][0-9]:[0-5][0-9]:[0-5][0-9] bar'
echo matched=$?

## STDOUT:
matched=0
## END

#### \@ for 12h time (HH:MM AM/PM)
PS1='foo \@ bar'
echo "${PS1@P}" | egrep -q 'foo [0-1][0-9]:[0-5][0-9] (A|P)M bar'
echo matched=$?

## STDOUT:
matched=0
## END

#### \A for 24h time (HH:MM)
PS1='foo \A bar'
echo "${PS1@P}" | egrep -q 'foo [0-2][0-9]:[0-5][0-9] bar'
echo matched=$?
## STDOUT:
matched=0
## END

#### \d for date
PS1='foo \d bar'
echo "${PS1@P}" | egrep -q 'foo [A-Z][a-z]+ [A-Z][a-z]+ [0-9]+ bar'
echo matched=$?

## STDOUT:
matched=0
## END

#### \D{%H:%M} for strftime
PS1='foo \D{%H:%M} bar'
echo "${PS1@P}" | egrep -q 'foo [0-9][0-9]:[0-9][0-9] bar'
echo matched=$?

PS1='foo \D{%H:%M:%S} bar'
echo "${PS1@P}" | egrep -q 'foo [0-9][0-9]:[0-9][0-9]:[0-9][0-9] bar'
echo matched=$?

## STDOUT:
matched=0
matched=0
## END

#### \D{} for locale specific strftime

# In bash y.tab.c uses %X when string is empty
# This doesn't seem to match exactly, but meh for now.

PS1='foo \D{} bar'
echo "${PS1@P}" | egrep -q '^foo [0-9][0-9]:[0-9][0-9]:[0-9][0-9]( ..)? bar$'
echo matched=$?
## STDOUT:
matched=0
## END

#### \s for shell, \v for major.minor version, and \V for full version
PS1='foo \s bar'
echo "${PS1@P}" | egrep -q '^foo (bash|osh) bar$'
echo match=$?

PS1='foo \v bar'
echo "${PS1@P}" | egrep -q '^foo [0-9]+\.[0-9]+ bar$'
echo match=$?

PS1='foo \V bar'
echo "${PS1@P}" | egrep -q '^foo [0-9]+\.[0-9]+\.[0-9]+ bar$'
echo match=$?

## STDOUT:
match=0
match=0
match=0
## END


#### \j for number of jobs
set -m # enable job control
PS1='foo \j bar'
echo "${PS1@P}" | egrep -q 'foo 0 bar'
echo matched=$?
sleep 5 &
echo "${PS1@P}" | egrep -q 'foo 1 bar'
echo matched=$?
kill %%
fg
echo "${PS1@P}" | egrep -q 'foo 0 bar'
echo matched=$?

## STDOUT:
matched=0
matched=0
sleep 5
matched=0
## END

#### \l for TTY device basename
PS1='foo \l bar'
# FIXME this never an actual TTY when using ./test/spec.sh
tty="$(tty)"
if [[ "$tty" == "not a tty" ]]; then
    expected="tty"
else
    expected="$(basename "$tty")"
fi
echo "${PS1@P}" | egrep -q "foo $expected bar"
echo matched=$?

## STDOUT:
matched=0
## END

#### \! for history number
## SKIP (unimplementable): history builtin not implemented
set -o history # enable history
PS1='foo \! bar'
history -c # clear history
echo "${PS1@P}" | egrep -q "foo 1 bar"
echo matched=$?
echo "_${PS1@P}" | egrep -q "foo 3 bar"
echo matched=$?

## STDOUT:
matched=0
matched=0
## END

#### \# for command number
PS1='foo \# bar'
prev_cmd_num="$(echo "${PS1@P}" | egrep -o 'foo [0-9]+ bar' | sed -E 's/foo ([0-9]+) bar/\1/')"
echo "${PS1@P}" | egrep -q "foo $((prev_cmd_num + 1)) bar"
echo matched=$?

## STDOUT:
matched=0
## END

#### @P with array
## SKIP (unimplementable): Interactive shell invocation not implemented
$SH -c 'echo ${@@P}' dummy a b c
echo status=$?
$SH -c 'echo ${*@P}' dummy a b c
echo status=$?
$SH -c 'a=(x y); echo ${a@P}' dummy a b c
echo status=$?
## STDOUT:
a b c
status=0
a b c
status=0
x
status=0
## END

#### default PS1
## SKIP (unimplementable): Shell startup options not supported - requires $SH invocation
#flags='--norc --noprofile'
flags='--rcfile /dev/null'

$SH $flags -i -c 'echo "_${PS1}_"'

## STDOUT:
_\s-\v\$ _
## END
