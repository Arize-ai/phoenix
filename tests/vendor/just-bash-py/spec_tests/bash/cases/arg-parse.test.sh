## compare_shells: bash dash mksh zsh ash
## oils_failures_allowed: 0

# TODO:
# - go through all of compgen -A builtin - which ones allow extra args?
# - cd builtin should be strict

#### true extra
true extra
## STDOUT:
## END

#### shift 1 extra
## SKIP (unimplementable): Interactive shell invocation not implemented
$SH -c '
set -- a b c
shift 1 extra
'
if test $? -eq 0; then
  echo fail
fi

## STDOUT:
## END
## BUG dash/mksh/zsh/ash STDOUT:
fail
## END

#### continue 1 extra, break, etc.
$SH -c '
for i in foo; do
  continue 1 extra
done
echo status=$?
'
if test $? -eq 0; then
  echo fail
fi

## STDOUT:
## END

## BUG dash/ash/mksh STDOUT:
status=0
fail
## END

## BUG-2 zsh STDOUT:
status=1
fail
## END
