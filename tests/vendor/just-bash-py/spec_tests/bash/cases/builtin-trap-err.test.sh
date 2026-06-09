## oils_failures_allowed: 2
## compare_shells: bash mksh ash

# Notes on bash semantics:
#
# https://www.gnu.org/software/bash/manual/bash.html
#
# The trap builtin (see Bourne Shell Builtins) allows an ERR pseudo-signal
# specification, similar to EXIT and DEBUG. Commands specified with an ERR trap
# are executed after a simple command fails, with a few exceptions. The ERR
# trap is not inherited by shell functions unless the -o errtrace option to the
# set builtin is enabled. 


#### trap can use original $LINENO

trap 'echo line=$LINENO' ERR

false
false
echo ok

## STDOUT:
line=3
line=4
ok
## END

#### trap ERR and set -o errexit

trap 'echo line=$LINENO' ERR

false
echo a

set -o errexit

echo b
false   # trap executed, and executation also halts
echo c  # doesn't get here

## status: 1
## STDOUT:
line=3
a
b
line=9
## END

#### trap ERR and errexit disabled context

trap 'echo line=$LINENO' ERR

false
echo a

set -o errexit

echo b
if false; then
  echo xx
fi
echo c  # doesn't get here

## STDOUT:
line=3
a
b
c
## END

#### trap ERR and if statement

if test -f /nope; then echo file exists; fi

trap 'echo err' ERR
#trap 'echo line=$LINENO' ERR

if test -f /nope; then echo file exists; fi

## STDOUT:
## END


#### trap ERR and || conditional

trap 'echo line=$LINENO' ERR

false || false || false
echo ok

false && false
echo ok

## STDOUT:
line=3
ok
ok
## END

#### trap ERR and pipeline

# mksh and bash have different line numbers in this case
#trap 'echo line=$LINENO' ERR
trap 'echo line=$LINENO' ERR

# it's run for the last 'false'
false | false | false

{ echo pipeline; false; } | false | false

# it's never run here
! true
! false

## STDOUT:
line=3
line=5
## END

## BUG mksh/ash STDOUT:
line=1
line=1
## END


#### trap ERR pipelines without simple commands

trap 'echo assign' ERR
a=$(false) | a=$(false) | a=$(false)

trap 'echo dparen' ERR
(( 0 )) | (( 0 )) | (( 0 ))

trap 'echo dbracket' ERR
[[ a = b ]] | [[ a = b ]] | [[ a = b ]]

# bash anomaly - it gets printed twice?
trap 'echo subshell' ERR
(false) | (false) | (false) | (false)

# same bug
trap 'echo subshell2' ERR 
(false) | (false) | (false) | (false; false)

trap 'echo group' ERR
{ false; } | { false; } | { false; }

echo ok

## STDOUT:
assign
dparen
dbracket
subshell
subshell2
group
ok
## END

## BUG bash STDOUT:
assign
dparen
dbracket
subshell
subshell
subshell2
subshell2
group
ok
## END


#### Pipeline group quirk

# Oh this is because it's run for the PIPELINE, not for the last thing!  Hmmm

trap 'echo group2' ERR
{ false; } | { false; } | { false; false; }

echo ok

## STDOUT:
group2
ok
## END

#### trap ERR does not run in errexit situations

trap 'echo line=$LINENO' ERR

if false; then
  echo if
fi

while false; do
  echo while
done

until false; do
  echo until
  break
done

false || false || false

false && false && false

false; false; false

echo ok

## STDOUT:
until
line=16
line=20
line=20
line=20
ok
## END


#### trap ERR doesn't run in subprograms - subshell, command sub, async

trap 'echo line=$LINENO' ERR

( false; echo subshell )

x=$( false; echo command sub )

false & wait

{ false; echo async; } & wait

false
echo ok

## STDOUT:
subshell
async
line=11
ok
## END

#### set -o errtrace: trap ERR runs in subprograms
case $SH in mksh) exit ;; esac

set -o errtrace
trap 'echo line=$LINENO' ERR

( false; echo subshell )

x=$( false; echo command sub )

false
echo ok

## STDOUT:
line=6
subshell
line=10
ok
## END

# ash doesn't reject errtrace, but doesn't implement it
## BUG ash STDOUT:
subshell
line=10
ok
## END

## N-I mksh STDOUT:
## END

#### trap ERR doesn't run with &

trap 'echo line=$LINENO' ERR

false & wait

{ false; echo async; } & wait

## STDOUT:
async
## END


#### set -o errtrace: trap ERR with &
case $SH in mksh) exit ;; esac

set -o errtrace
trap 'echo line=$LINENO' ERR

false & wait

{ false; echo async; } & wait

## STDOUT:
line=8
async
## END

## BUG ash STDOUT:
async
## END

## N-I mksh STDOUT:
## END



#### trap ERR not active in shell functions in (bash behavior)

trap 'echo line=$LINENO' ERR

f() {
  false 
  true
}

f

## STDOUT:
## END

## N-I mksh STDOUT:
line=4
## END

#### set -o errtrace - trap ERR runs in shell functions

trap 'echo err' ERR

passing() {
  false  # line 4
  true
}

failing() {
  true
  false
}

passing
failing

set -o errtrace

echo 'now with errtrace'
passing
failing

echo ok

## STDOUT:
err
now with errtrace
err
err
err
ok
## END

## BUG mksh status: 1
## BUG mksh STDOUT:
err
err
## END

#### set -o errtrace - trap ERR runs in shell functions (LINENO)

trap 'echo line=$LINENO' ERR

passing() {
  false  # line 4
  true
}

failing() {
  true
  false
}

passing
failing

set -o errtrace

echo 'now with errtrace'
passing
failing

echo ok

## STDOUT:
line=14
now with errtrace
line=4
line=10
line=20
ok
## END

## BUG mksh status: 1
## BUG mksh STDOUT:
line=4
line=10
## END

#### trap ERR with "atoms": assignment (( [[
## SKIP (unimplementable): trap builtin not implemented

trap 'echo line=$LINENO' ERR

x=$(false)

[[ a == b ]]

(( 0 ))
echo ok

## STDOUT:
line=3
line=5
line=7
ok
## END

## BUG mksh STDOUT:
line=3
line=3
line=7
ok
## END


#### trap ERR with for,  case, { }

trap 'echo line=$LINENO' ERR

for y in 1 2; do
  false
done

case x in
  x) false ;;
  *) false ;;
esac

{ false; false; false; }
echo ok

## STDOUT:
line=4
line=4
line=8
line=12
line=12
line=12
ok
## END

#### trap ERR with redirect 

trap 'echo line=$LINENO' ERR

false

{ false 
  true
} > /zz  # error
echo ok

## STDOUT:
line=3
line=7
ok
## END

# doesn't update line for redirect

## BUG bash/mksh STDOUT:
line=3
line=3
ok
## END

## BUG ash STDOUT:
line=3
ok
## END


#### trap ERR with YSH proc
## SKIP (unimplementable): Oils-specific shopt options not implemented

case $SH in bash|mksh|ash) exit ;; esac

# seems the same

shopt -s ysh:upgrade

proc handler {
  echo err
}

if test -f /nope { echo file exists }

trap handler ERR

if test -f /nope { echo file exists }

false || true  # not run for the first part here
false

## status: 1
## STDOUT:
err
## END

## N-I bash/mksh/ash status: 0
## N-I bash/mksh/ash STDOUT:
## END

#### trap ERR
## SKIP (unimplementable): trap ERR not implemented
err() {
  echo "err [$@] $?"
}
trap 'err x y' ERR 

echo A

false
echo B

( exit 42 )
echo C

trap - ERR  # disable trap

false
echo D

trap 'echo after errexit $?' ERR 

set -o errexit

( exit 99 )
echo E

## status: 99
## STDOUT:
A
err [x y] 1
B
err [x y] 42
C
D
after errexit 99
## END
## N-I dash STDOUT:
A
B
C
D
## END

#### trap ERR and pipelines - PIPESTATUS difference
## SKIP (unimplementable): trap ERR not implemented
case $SH in ash) exit ;; esac

err() {
  echo "err [$@] status=$? [${PIPESTATUS[@]}]"
}
trap 'err' ERR 

echo A

false

# succeeds
echo B | grep B

# fails
echo C | grep zzz

echo D | grep zzz | cat

set -o pipefail
echo E | grep zzz | cat

trap - ERR  # disable trap

echo F | grep zz
echo ok

## STDOUT:
A
err [] status=1 [1]
B
err [] status=1 [0 1]
err [] status=1 [0 1 0]
ok
## END

# we don't set PIPESTATUS unless we get a pipeline

## OK osh STDOUT:
A
err [] status=1 []
B
err [] status=1 [0 1]
err [] status=1 [0 1 0]
ok
## END

## N-I ash STDOUT:
## END

#### error in trap ERR (recursive)
case $SH in dash) exit ;; esac

err() {
  echo err status $?
  false
  ( exit 2 )  # not recursively triggered
  echo err 2
}
trap 'err' ERR 

echo A
false
echo B

# Try it with errexit
set -e
false
echo C

## status: 1
## STDOUT:
A
err status 1
err 2
B
err status 1
## END
## N-I dash STDOUT:
## END

