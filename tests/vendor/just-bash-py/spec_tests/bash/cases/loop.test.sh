## compare_shells: dash bash mksh zsh
## oils_failures_allowed: 0

#### implicit for loop
# This is like "for i in $@".
fun() {
  for i; do
    echo $i
  done
  echo "finished=$i"
}
fun 1 2 3
## STDOUT:
1
2
3
finished=3
## END

#### empty for loop (has "in")
set -- 1 2 3
for i in ; do
  echo $i
done
## STDOUT:
## END

#### for loop with invalid identifier
# should be compile time error, but runtime error is OK too
for - in a b c; do
  echo hi
done
## stdout-json: ""
## status: 2
## OK bash/mksh status: 1
## BUG zsh stdout: hi
## BUG zsh status: 1

#### the word 'in' can be the loop variable

for in in a b c; do
  echo $in
done
echo finished=$in
## STDOUT:
a
b
c
finished=c
## END

#### Tilde expansion within for loop
HOME=/home/bob
for name in ~/src ~/git; do
  echo $name
done
## STDOUT: 
/home/bob/src
/home/bob/git
## END

#### Brace Expansion within Array
for i in -{a,b} {c,d}-; do
  echo $i
  done
## STDOUT: 
-a
-b
c-
d-
## END
## N-I dash STDOUT:
-{a,b}
{c,d}-
## END

#### using loop var outside loop
fun() {
  for i in a b c; do
    echo $i
  done
  echo $i
}
fun
## status: 0
## STDOUT:
a
b
c
c
## END

#### continue
for i in a b c; do
  echo $i
  if test $i = b; then
    continue
  fi
  echo $i
done
## status: 0
## STDOUT:
a
a
b
c
c
## END

#### break
for i in a b c; do
  echo $i
  if test $i = b; then
    break
  fi
done
## status: 0
## STDOUT:
a
b
## END

#### while in while condition
# This is a consequence of the grammar
while while true; do echo cond; break; done
do
  echo body
  break
done
## STDOUT:
cond
body
## END

#### while in pipe
x=$(find spec/ | wc -l)
y=$(find spec/ | while read path; do
  echo $path
done | wc -l
)
test $x -eq $y
echo status=$?
## stdout: status=0

#### while in pipe with subshell
i=0
seq 3 | ( while read foo; do
  i=$((i+1))
  #echo $i
done
echo $i )
## stdout: 3

#### until loop
# This is just the opposite of while?  while ! cond?
until false; do
  echo hi
  break
done
## stdout: hi

#### continue at top level
if true; then
  echo one
  continue
  echo two
fi
## status: 0
## STDOUT:
one
two
## END
# zsh behaves like strict_control_flow!
## OK zsh status: 1
## OK zsh STDOUT:
one
## END

#### continue in subshell
for i in $(seq 2); do
  echo "> $i"
  ( if true; then continue; fi; echo "Should not print" )
  echo subshell status=$?
  echo ". $i"
done
## STDOUT:
# osh lets you fail
> 1
subshell status=1
. 1
> 2
subshell status=1
. 2
## END
## OK dash/zsh/bash STDOUT:
> 1
subshell status=0
. 1
> 2
subshell status=0
. 2
## END
## BUG mksh STDOUT:
> 1
Should not print
subshell status=0
. 1
> 2
Should not print
subshell status=0
. 2
## END

#### continue in subshell aborts with errexit
# The other shells don't let you recover from this programming error!
set -o errexit
for i in $(seq 2); do
  echo "> $i"
  ( if true; then continue; fi; echo "Should not print" )
  echo 'should fail after subshell'
  echo ". $i"
done

## STDOUT:
> 1
## END
## status: 1

## OK bash STDOUT:
> 1
should fail after subshell
. 1
> 2
should fail after subshell
. 2
## END
## OK bash status: 0

## BUG-2 dash/zsh STDOUT:
> 1
should fail after subshell
. 1
> 2
should fail after subshell
. 2
## END
## BUG-2 dash/zsh status: 0

## BUG mksh STDOUT:
> 1
Should not print
should fail after subshell
. 1
> 2
Should not print
should fail after subshell
. 2
## END
## BUG mksh status: 0

#### bad arg to break
x=oops
while true; do 
  echo hi
  break $x
  sleep 0.1
done
## stdout: hi
## status: 1
## OK dash status: 2
## OK bash status: 128

#### too many args to continue
# OSH treats this as a parse error
for x in a b c; do
  echo $x
  # bash breaks rather than continue or fatal error!!!
  continue 1 2 3
done
echo --
## stdout-json: ""
## status: 2
## BUG bash STDOUT:
a
--
## END
## BUG bash status: 0
## OK just-bash STDOUT:
a
## END
## OK just-bash status: 1
## BUG-2 dash/mksh/zsh STDOUT:
a
b
c
--
## END
## BUG-2 dash/mksh/zsh status: 0

#### break in condition of loop
while break; do
  echo x
done
echo done
## STDOUT:
done
## END


#### break in condition of nested loop
for i in 1 2 3; do
  echo i=$i
  while break; do
    echo x
  done
done
echo done
## STDOUT:
i=1
i=2
i=3
done
## END

#### return within eval
f() {
  echo one
  eval 'return'
  echo two
}
f
## STDOUT:
one
## END

#### break/continue within eval
# NOTE: This changes things
# set -e
f() {
  for i in $(seq 5); do 
    if test $i = 2; then
      eval continue
    fi
    if test $i = 4; then
      eval break
    fi
    echo $i
  done

  eval 'return'
  echo 'done'
}
f
## STDOUT:
1
3
## END
## BUG mksh STDOUT:
1
2
3
4
5
## END

#### break/continue within source
# NOTE: This changes things
# set -e

# Create the test data files inline
mkdir -p /tmp/testdata
echo 'continue' > /tmp/testdata/continue.sh
echo 'break' > /tmp/testdata/break.sh
echo 'return' > /tmp/testdata/return.sh

f() {
  for i in $(seq 5); do
    if test $i = 2; then
      . /tmp/testdata/continue.sh
    fi
    if test $i = 4; then
      . /tmp/testdata/break.sh
    fi
    echo $i
  done

  # Return is different!
  . /tmp/testdata/return.sh
  echo done
}
f
## STDOUT:
1
3
done
## END
## BUG zsh/mksh STDOUT:
1
2
3
4
5
done
## END

#### top-level break/continue/return (without strict_control_flow)
# Test break/continue/return at top level (outside of loops/functions)
# In bash, break/continue print warnings but succeed with exit 0
# return at top level fails with exit 1
break; echo break=$?
continue; echo continue=$?
return; echo return=$?
## STDOUT:
break=0
continue=0
return=1
## END
## BUG-2 zsh STDOUT:
## END


#### multi-level break with argument 

# reported in issue #1459

counterA=100
counterB=100

while test "$counterA" -gt 0
do
    counterA=$((counterA - 1))
    while test "$counterB" -gt 0
    do
        counterB=$((counterB - 1))
        if test "$counterB" = 50
        then
            break 2
        fi
    done
done

echo "$counterA"
echo "$counterB"

## STDOUT:
99
50
## END


#### multi-level continue

for i in 1 2; do
  for j in a b c; do
    if test $j = b; then
      continue
    fi
    echo $i $j
  done
done

echo ---

for i in 1 2; do
  for j in a b c; do
    if test $j = b; then
      continue 2   # MULTI-LEVEL
    fi
    echo $i $j
  done
done

## STDOUT:
1 a
1 c
2 a
2 c
---
1 a
2 a
## END

#### $b break, $c continue, $r return, $e exit

# hm would it be saner to make FATAL builtins called break/continue/etc.?
# On the other hand, this spits out errors loudly.

echo '- break'
b=break
for i in 1 2 3; do
  echo $i
  $b
done

echo '- continue'
c='continue'
for i in 1 2 3; do
  if test $i = 2; then
    $c
  fi
  echo $i
done

r='return'
f() {
  echo '- return'
  for i in 1 2 3; do
    echo $i
    if test $i = 2; then
      $r 99
    fi
  done
}
f
echo status=$?

echo '- exit'
e='exit'
$e 5
echo 'not executed'

## status: 5
## STDOUT:
- break
1
- continue
1
3
- return
1
2
status=99
- exit
## END

#### \break \continue \return \exit

echo '- break'
for i in 1 2 3; do
  echo $i
  \break
done

echo '- continue'
for i in 1 2 3; do
  if test $i = 2; then
    \continue
  fi
  echo $i
done

f() {
  echo '- return'
  for i in 1 2 3; do
    echo $i
    if test $i = 2; then
      \return 99
    fi
  done
}
f
echo status=$?

echo '- exit'
\exit 5
echo 'not executed'

## status: 5
## STDOUT:
- break
1
- continue
1
3
- return
1
2
status=99
- exit
## END

#### builtin,command break,continue,return,exit
case $SH in dash|zsh) exit ;; esac

echo '- break'
for i in 1 2 3; do
  echo $i
  builtin break
done

echo '- continue'
for i in 1 2 3; do
  if test $i = 2; then
    command continue
  fi
  echo $i
done

f() {
  echo '- return'
  for i in 1 2 3; do
    echo $i
    if test $i = 2; then
      builtin command return 99
    fi
  done
}
f
echo status=$?

echo '- exit'
command builtin exit 5
echo 'not executed'

## status: 5
## STDOUT:
- break
1
- continue
1
3
- return
1
2
status=99
- exit
## END

## N-I dash/zsh status: 0
## N-I dash/zsh STDOUT:
## END


