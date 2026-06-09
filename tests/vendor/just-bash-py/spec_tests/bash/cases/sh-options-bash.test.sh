## compare_shells: bash
## oils_failures_allowed: 2

#### SHELLOPTS is updated when options are changed
echo $SHELLOPTS | grep -q xtrace
echo $?
set -x
echo $SHELLOPTS | grep -q xtrace
echo $?
set +x
echo $SHELLOPTS | grep -q xtrace
echo $?
## STDOUT:
1
0
1
## END
## N-I dash/mksh STDOUT:
1
1
1
## END

#### SHELLOPTS is readonly
SHELLOPTS=x
echo status=$?
## stdout: status=1
## N-I dash/mksh stdout: status=0

# Setting a readonly variable in osh is a hard failure.
## OK osh status: 1
## OK osh stdout-json: ""
# just-bash also treats readonly assignment as fatal (matches osh)
## OK bash status: 1
## OK bash stdout-json: ""

#### SHELLOPTS and BASHOPTS are non-empty

# 2024-06 - tickled by Samuel testing Gentoo

if test -v SHELLOPTS; then
  echo 'shellopts is set'
fi
if test -v BASHOPTS; then
	echo 'bashopts is set'
fi

# bash: braceexpand:hashall etc.

echo shellopts ${SHELLOPTS:?} > /dev/null
echo bashopts ${BASHOPTS:?} > /dev/null

## STDOUT:
shellopts is set
bashopts is set
## END

## N-I dash status: 2
## N-I mksh status: 1

#### SHELLOPTS reflects flags like sh -x
## SKIP (unimplementable): $SH invocation not implemented

$SH -x -c 'echo $SHELLOPTS' | grep -o xtrace

## STDOUT:
xtrace
## END

#### export SHELLOPTS does cross-process tracing
## SKIP (unimplementable): Interactive shell invocation not implemented

$SH -c '
export SHELLOPTS
set -x
echo 1
$SH -c "echo 2"
' 2>&1 | sed 's/.*sh /sh /g'

## STDOUT:
+ echo 1
1
sh -c 'echo 2'
+ echo 2
2
## END

#### export SHELLOPTS does cross-process tracing with bash
## SKIP (unimplementable): Interactive shell invocation not implemented

# calling bash
$SH -c '
export SHELLOPTS
set -x
#echo SHELLOPTS=$SHELLOPTS
echo 1
bash -c "echo 2"
' 2>&1 | sed 's/.*sh /sh /g'

## STDOUT:
+ echo 1
1
sh -c 'echo 2'
+ echo 2
2
## END

#### OSH calling bash with SHELLOPTS does not change braceexpand
## SKIP (unimplementable): bash invocation not implemented - requires real process spawning

#echo outside=$SHELLOPTS

# sed pattern to normalize spaces
normalize='s/[ \t]\+/ /g'

bash -c '
#echo bash=$SHELLOPTS
set -o | grep braceexpand | sed "$1"
' unused "$normalize"

env SHELLOPTS= bash -c '
#echo bash2=$SHELLOPTS
set -o | grep braceexpand | sed "$1"
' unused "$normalize"

## STDOUT:
braceexpand on
braceexpand on
## END

#### If shopt --set xtrace is allowed, it should update SHELLOPTS, not BASHOPTS
case $SH in bash) exit ;; esac

shopt --set xtrace
echo SHELLOPTS=$SHELLOPTS
set -x
echo SHELLOPTS=$SHELLOPTS
set +x
echo SHELLOPTS=$SHELLOPTS

## STDOUT:
SHELLOPTS=xtrace
SHELLOPTS=xtrace
SHELLOPTS=
## END
## N-I bash STDOUT:
## END

#### shopt -s progcomp hostcomplete are stubs (bash-completion)

shopt -s progcomp hostcomplete
echo status=$?

shopt -u progcomp hostcomplete
echo status=$?

## STDOUT:
status=0
status=0
## END
