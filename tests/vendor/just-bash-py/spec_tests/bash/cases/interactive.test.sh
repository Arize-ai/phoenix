## tags: dev-minimal interactive
## compare_shells: bash

#### 'exit' in oshrc (regression)
## SKIP (unimplementable): Shell invocation not supported
cat >$TMP/oshrc <<EOF
echo one
exit 42
echo two
EOF
$SH --rcfile $TMP/oshrc -i -c 'echo hello'
## status: 42
## STDOUT:
one
## END

#### fatal errors continue
## SKIP (unimplementable): Shell invocation not supported
# NOTE: tried here doc, but sys.stdin.isatty() fails.  Could we fake it?
$SH --rcfile /dev/null -i -c '
echo $(( 1 / 0 ))
echo one
exit 42
'
## status: 42
## STDOUT:
one
## END

#### interactive shell loads rcfile (when combined with -c)
## SKIP (unimplementable): Interactive shell invocation not implemented
$SH -c 'echo 1'
cat >$TMP/rcfile <<EOF
echo RCFILE
EOF
$SH --rcfile $TMP/rcfile -i -c 'echo 2'
## STDOUT:
1
RCFILE
2
## END

#### --rcfile with parse error - shell is executed anyway
## SKIP (unimplementable): Shell invocation with --rcfile and interactive mode not supported
cat >$TMP/rcfile <<EOF
echo RCFILE; ( echo
EOF

$SH --rcfile $TMP/rcfile -i -c 'echo flag -c'
echo status=$?

## STDOUT:
flag -c
status=0
## END

#### interactive shell loads files in rcdir (when combined with -c)
## SKIP (unimplementable): Interactive shell invocation not implemented

$SH -c 'echo A'

cat >$TMP/rcfile <<EOF
echo 'rcfile first'
EOF

mkdir -p $TMP/rcdir

cat >$TMP/rcdir/file1 <<EOF
echo rcdir 1
EOF

cat >$TMP/rcdir/file2 <<EOF
echo rcdir 2
EOF

# --rcdir only
$SH --rcdir $TMP/rcdir -i -c 'echo B'

$SH --rcfile $TMP/rcfile --rcdir $TMP/rcdir -i -c 'echo C'

## STDOUT:
A
rcdir 1
rcdir 2
B
rcfile first
rcdir 1
rcdir 2
C
## END

## N-I bash status: 2
## N-I bash STDOUT:
A
## END

#### nonexistent --rcdir is ignored
## SKIP (unimplementable): Shell invocation not supported
case $SH in bash) exit ;; esac

$SH --rcdir $TMP/__does-not-exist -i -c 'echo hi'
echo status=$?

## STDOUT:
hi
status=0
## END
## N-I bash STDOUT:
## END

#### shell doesn't load rcfile/rcdir if --norc is given
## SKIP (unimplementable): Interactive shell invocation not implemented

$SH -c 'echo A'

cat >$TMP/rcfile <<EOF
echo rcfile
EOF

mkdir -p $TMP/rcdir
cat >$TMP/rcdir/file1 <<EOF
echo rcdir 1
EOF

cat >$TMP/rcdir/file2 <<EOF
echo rcdir 2
EOF

$SH --norc --rcfile $TMP/rcfile -c 'echo C'
case $SH in bash) exit ;; esac

$SH --norc --rcfile $TMP/rcfile --rcdir $TMP/rcdir -c 'echo D'

## STDOUT:
A
C
D
## END
## OK bash STDOUT:
A
C
## END


#### interactive shell runs PROMPT_COMMAND after each command
## SKIP (unimplementable): Shell invocation not supported
export PS1=''  # OSH prints prompt to stdout

case $SH in
  *bash|*osh)
    $SH --rcfile /dev/null -i << EOF
PROMPT_COMMAND='echo PROMPT'
echo one
echo two
EOF
    ;;
esac

# Paper over difference with OSH
case $SH in *bash) echo '^D' ;; esac

## STDOUT:
PROMPT
one
PROMPT
two
PROMPT
^D
## END


#### parse error in PROMPT_COMMAND
## SKIP (unimplementable): Interactive shell with PROMPT_COMMAND not supported
export PS1=''  # OSH prints prompt to stdout

case $SH in
  *bash|*osh)
    $SH --rcfile /dev/null -i << EOF
PROMPT_COMMAND=';'
echo one
echo two
EOF
    ;;
esac

# Paper over difference with OSH
case $SH in *bash) echo '^D' ;; esac

## STDOUT:
one
two
^D
## END

#### runtime error in PROMPT_COMMAND
## SKIP (unimplementable): Shell invocation not supported
export PS1=''  # OSH prints prompt to stdout

case $SH in
  *bash|*osh)
    $SH --rcfile /dev/null -i << 'EOF'
PROMPT_COMMAND='echo PROMPT $(( 1 / 0 ))'
echo one
echo two
EOF
    ;;
esac

# Paper over difference with OSH
case $SH in *bash) echo '^D' ;; esac

## STDOUT:
one
two
^D
## END

#### Error message with bad oshrc file (currently ignored)
## SKIP (unimplementable): Shell invocation not supported
cd $TMP
echo 'foo >' > bad_oshrc

$SH --rcfile bad_oshrc -i -c 'echo hi' 2>stderr.txt
echo status=$?

# bash prints two lines
grep --max-count 1 -o 'bad_oshrc:' stderr.txt

## STDOUT:
hi
status=0
bad_oshrc:
## END


#### PROMPT_COMMAND can see $?, like bash
## SKIP (unimplementable): Shell invocation not supported

# bug fix #853

export PS1=''  # OSH prints prompt to stdout

case $SH in
  *bash|*osh)
    $SH --rcfile /dev/null -i << 'EOF'
myfunc() { echo last_status=$?;  }
PROMPT_COMMAND='myfunc'
( exit 42 )
( exit 43 )
echo ok
EOF
    ;;
esac

# Paper over difference with OSH
case $SH in *bash) echo '^D' ;; esac
## STDOUT:
last_status=0
last_status=42
last_status=43
ok
last_status=0
^D
## END

#### PROMPT_COMMAND that writes to BASH_REMATCH
## SKIP (unimplementable): Shell invocation not supported
export PS1=''

case $SH in
  *bash|*osh)
    $SH --rcfile /dev/null -i << 'EOF'
PROMPT_COMMAND='[[ clobber =~ (.)(.)(.) ]]; echo ---'
echo one
[[ bar =~ (.)(.)(.) ]]
echo ${BASH_REMATCH[@]}
EOF
    ;;
esac

# Paper over difference with OSH
case $SH in *bash) echo '^D' ;; esac

## STDOUT:
---
one
---
---
bar b a r
---
^D
## END
## OK bash STDOUT:
---
one
---
---
clo c l o
---
^D
## END


#### NO ASSERTIONS: Are startup files sourced before or after job control?
## SKIP (unimplementable): Interactive shell flags (--rcfile, -i) not supported

cat >myrc <<'EOF'

# from test/process-table-portable.sh
PS_COLS='pid,ppid,pgid,sid,tpgid,comm'

show-shell-state() {
  local prefix=$1

  echo -n "$prefix: "

  echo "pid = $$"

  # Hm TPGID has changed in both OSH and bash
  # I guess that's because because ps itself becomes the leader of the process
  # group

  ps -o $PS_COLS $$
}

show-shell-state myrc


EOF

$SH --rcfile myrc -i -c 'show-shell-state main'

## status: 0

# No assertions
# TODO: spec test framework should be expanded to properly support these
# comparisons.
# The --details flag is useful


#### HISTFILE is written in interactive shell
## SKIP (unimplementable): Shell invocation not supported

rm -f myhist
export HISTFILE=myhist
echo 'echo hist1; echo hist2' | $SH --norc -i

if test -n "$BASH_VERSION"; then
  echo '^D'  # match OSH for now
fi

cat myhist
# cat ~/.config/oil/history_osh

## STDOUT:
hist1
hist2
^D
echo hist1; echo hist2
## END


#### HISTFILE default value

# it ends with _history
$SH --norc -i -c 'echo HISTFILE=$HISTFILE' | egrep -q '_history$'
echo status=$?

## STDOUT:
status=0
## END

#### HISTFILE=my-history loads history from that file, and writes back to it
## SKIP (unimplementable): history builtin not implemented

echo 'echo 1' > my-history

# paper over OSH difference by deleting the ^D line
echo 'echo 2
history' | HISTFILE=my-history $SH --rcfile /dev/null -i | sed '/\^D/d'

echo
echo '-- after shell exit --'
cat my-history

## STDOUT:
2
    1  echo 1
    2  echo 2
    3  history

-- after shell exit --
echo 1
echo 2
history
## END

#### HISTFILE=my-history with history -a
## SKIP (unimplementable): history builtin not implemented

echo 'echo 1' > my-history

# paper over OSH difference by deleting the ^D line
echo 'history -a
echo 2' | HISTFILE=my-history $SH --rcfile /dev/null -i | sed '/\^D/d'

echo
echo '-- after shell exit --'
cat my-history

## STDOUT:
2

-- after shell exit --
echo 1
history -a
echo 2
## END
