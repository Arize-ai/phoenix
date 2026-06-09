## oils_failures_allowed: 1
## compare_shells: bash dash mksh zsh

#### $SHELL is set to what is in /etc/passwd
## SKIP (unimplementable): Interactive shell invocation not implemented

sh=$(which $SH)

unset SHELL

prog='
if test -n "$SHELL"; then
  # the exact value is different on CI, so do not assert
  echo SHELL is set
  echo SHELL=$SHELL >&2
fi
'

$SH -c "$prog"

$SH -i -c "$prog"

# make it a login shell
$SH -l -c "$prog"

## STDOUT:
SHELL is set
SHELL is set
SHELL is set
## END
## N-I dash/mksh/zsh STDOUT:
## END
