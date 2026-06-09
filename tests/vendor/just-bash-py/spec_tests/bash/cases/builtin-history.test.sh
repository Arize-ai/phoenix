## tags: interactive
## compare_shells: bash
## oils_failures_allowed: 9
## oils_cpp_failures_allowed: 7

#### history -a
## SKIP (unimplementable): history builtin not implemented
rm -f tmp

echo '
history -c

HISTFILE=tmp
echo 1
history -a
cat tmp

echo 2

cat tmp
' | $SH -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
1
HISTFILE=tmp
echo 1
history -a
2
HISTFILE=tmp
echo 1
history -a
^D
## END


#### history -w writes out the in-memory history to the history file
## SKIP (unimplementable): history builtin not implemented

cd $TMP

# Populate a history file with a command to be overwritten
echo 'cmd old' > tmp
HISTFILE=tmp
history -c
echo 'cmd new' > /dev/null
history -w # Overwrite history file

# Verify that old command is gone
grep 'old' tmp > /dev/null
echo "found=$?"
## STDOUT:
found=1
## END


#### history -r reads from the history file, and appends it to the current history
## SKIP (unimplementable): history builtin not implemented

cd $TMP
printf "cmd orig%s\n" {1..10} > tmp
HISTFILE=tmp

history -c

history -r
history -r

history | grep orig | wc -l

## STDOUT:
20
## END


#### history -n reads *new* commands from the history file, and appends them to the current history
## SKIP (unimplementable): history builtin not implemented
# NB: Based on line ranges, not contents

cd $TMP

printf "cmd orig%s\n" {1..10} > tmp1
cp tmp1 tmp2
printf "cmd new%s\n" {1..10} >> tmp2

history -c
HISTFILE=tmp1 history -r
HISTFILE=tmp2 history -n

history | grep orig | wc -l
history | grep new | wc -l

## STDOUT:
10
10
## END


#### history -c clears in-memory history
## SKIP (unimplementable): history builtin not implemented

$SH --norc -i <<'EOF'
echo 'foo' > /dev/null
echo 'bar' > /dev/null
history -c 
history | wc -l
EOF

case $SH in bash) echo '^D' ;; esac

## STDOUT:
1
^D
## END


#### history -d to delete 1 item
## SKIP (unimplementable): history builtin not implemented

cd $TMP
HISTFILE=tmp
printf "cmd orig%s\n" {1..3} > tmp
history -c
history -r
history -d 1
history | grep orig1 > /dev/null
echo "status=$?"

## STDOUT:
status=1
## END


#### history -d to delete history from end
## SKIP (unimplementable): history builtin not implemented
# bash 4 doesn't support negative indices or ranges

rm -f myhist
export HISTFILE=myhist

$SH --norc -i <<'EOF'

echo 42
echo 43
echo 44

history -a

history -d 1
echo status=$?

# Invalid integers
history -d -1
echo status=$?
history -d -2
echo status=$?
history -d 99
echo status=$?

case $SH in bash*) echo '^D' ;; esac

EOF

## STDOUT:
42
43
44
status=0
status=2
status=2
status=2
^D
## END

# bash-4.4 used to give more errors like OSH?  Weird

## STDOUT:
42
43
44
status=0
status=0
status=0
status=1
^D
## END


#### HISTFILE is defined initially
## SKIP (unimplementable): Interactive shell invocation not implemented
echo '
if test -n $HISTFILE; then echo exists; fi
' | $SH -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
exists
^D
## END

#### HISTFILE must point to a file
## SKIP (unimplementable): history builtin not implemented

rm -f _tmp/does-not-exist

echo '
HISTFILE=_tmp/does-not-exist
history -r
echo status=$?
' | $SH -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
status=1
^D
## END

#### HISTFILE set to array
## SKIP (unimplementable): history builtin not implemented

echo '
HISTFILE=(a b c)
history -a
echo status=$?
' | $SH -i

case $SH in bash) echo '^D' ;; esac

# note that bash actually writes the file 'a', since that's ${HISTFILE[0]} 

## STDOUT:
status=1
^D
## END

## OK bash STDOUT:
status=0
^D
## END

#### HISTFILE unset
## SKIP (unimplementable): history builtin not implemented

echo '
unset HISTFILE
history -a
echo status=$?
' | $SH -i

case $SH in bash) echo '^D' ;; esac

## STDOUT:
status=1
^D
## END


#### history usage
## SKIP (unimplementable): history builtin not implemented

history not-a-number
echo status=$?

history 3 too-many
echo status=$?

## STDOUT:
status=2
status=2
## END

## OK bash STDOUT:
status=1
status=1
## END


#### HISTSIZE shrinks the in-memory history when changed
## SKIP (unimplementable): history builtin not implemented

cd $TMP
printf "cmd %s\n" {1..10} > tmp
HISTFILE=tmp
history -c
history -r
history | wc -l
HISTSIZE=5
history | wc -l

## STDOUT:
10
5
## END


#### HISTFILESIZE shrinks the history file when changed

cd $TMP
printf "cmd %s\n" {1..10} > tmp
HISTFILE=tmp
HISTFILESIZE=5
cat tmp | wc -l

## STDOUT:
5
## END


#### recording history can be toggled with set -o/+o history
## SKIP (unimplementable): history builtin not implemented

cd $TMP
printf "echo %s\n" {1..3} > tmp
HISTFILE=tmp $SH -i <<'EOF'
set +o history
echo "not recorded" >> /dev/null
set -o history
echo "recorded" >> /dev/null
EOF

case $SH in bash) echo '^D' ;; esac

grep "not recorded" tmp >> /dev/null
echo status=$?
grep "recorded" tmp >> /dev/null
echo status=$?

## STDOUT:
^D
status=1
status=0
## END


#### shopt histappend toggle check

shopt -s histappend
echo status=$?
shopt -p histappend
shopt -u histappend
echo status=$?
shopt -p histappend

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
status=0
shopt -s histappend
status=0
shopt -u histappend
^D
## END


#### shopt histappend - osh ignores shopt and appends, bash sometimes overwrites
## SKIP (unimplementable): history builtin not implemented
# When set, bash always appends when exiting, no matter what. 
# When unset, bash will append anyway as long the # of new commands < the hist length
# Either way, the file is truncated to HISTFILESIZE afterwards.
# osh always appends

cd $TMP 

export HISTSIZE=10
export HISTFILESIZE=1000
export HISTFILE=tmp

histappend_test() {
  local histopt
  if [[ "$1" == true ]]; then
    histopt='shopt -s histappend'
  else
    histopt='shopt -u histappend'
  fi

  printf "cmd orig%s\n" {1..10} > tmp

  $SH --norc -i <<EOF
  HISTSIZE=2 # Stifle the history down to 2 commands
  $histopt
  # Now run >2 commands to trigger bash's overwrite behavior
  echo cmd new1 > /dev/null
  echo cmd new2 > /dev/null
  echo cmd new3 > /dev/null
EOF

  case $SH in bash) echo '^D' ;; esac
}

# If we force histappend, bash won't overwrite the history file
histappend_test true
grep "orig" tmp > /dev/null
echo status=$?

# If we don't force histappend, bash will overwrite the history file when the number of cmds exceeds HISTSIZE
histappend_test false
grep "orig" tmp > /dev/null
echo status=$?

## STDOUT:
^D
status=0
^D
status=1
## OK osh STDOUT:
^D
status=0
^D
status=0
## END

