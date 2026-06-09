## oils_failures_allowed: 2
## compare_shells: bash dash mksh

#### >& and <& are the same

echo one 1>&2

echo two 1<&2

## STDERR:
one
two
## END


#### <&
# Is there a simpler test case for this?
echo foo51 > $TMP/lessamp.txt

exec 6< $TMP/lessamp.txt
read line <&6

echo "[$line]"
## stdout: [foo51]

#### 2>&1 with no command
( exit 42 )  # status is reset after this
echo status=$?
2>&1
echo status=$?
## STDOUT:
status=42
status=0
## END
## stderr-json: ""


#### 2&>1 (is it a redirect or is it like a&>1)
2&>1
echo status=$?
## STDOUT:
status=127
## END
## OK mksh/dash STDOUT:
status=0
## END


#### Nonexistent file
cat <$TMP/nonexistent.txt
echo status=$?
## stdout: status=1
## OK dash stdout: status=2

#### Descriptor redirect with spaces
# Hm this seems like a failure of lookahead!  The second thing should look to a
# file-like thing.
# I think this is a posix issue.
# tag: posix-issue
echo one 1>&2
echo two 1 >&2
echo three 1>& 2
## STDERR:
one
two 1
three
## END

#### Filename redirect with spaces
# This time 1 *is* a descriptor, not a word.  If you add a space between 1 and
# >, it doesn't work.
echo two 1> $TMP/file-redir1.txt
cat $TMP/file-redir1.txt
## stdout: two

#### Quoted filename redirect with spaces
# POSIX makes node of this
echo two \1 > $TMP/file-redir2.txt
cat $TMP/file-redir2.txt
## stdout: two 1

#### Descriptor redirect with filename
# bash/mksh treat this like a filename, not a descriptor.
# dash aborts.
echo one 1>&$TMP/nonexistent-filename__
echo "status=$?"
## stdout: status=1
## BUG bash stdout: status=0
## OK dash stdout-json: ""
## OK dash status: 2

#### Redirect echo to stderr, and then redirect all of stdout somewhere.
{ echo foo52 1>&2; echo 012345789; } > $TMP/block-stdout.txt
cat $TMP/block-stdout.txt |  wc -c 
## stderr: foo52
## stdout: 10

#### Named file descriptor
exec {myfd}> $TMP/named-fd.txt
echo named-fd-contents >& $myfd
cat $TMP/named-fd.txt
## stdout: named-fd-contents
## status: 0
## N-I dash/mksh stdout-json: ""
## N-I dash/mksh status: 127

#### Double digit fd (20> file)
exec 20> "$TMP/double-digit-fd.txt"
echo hello20 >&20
cat "$TMP/double-digit-fd.txt"
## stdout: hello20
## BUG dash stdout-json: ""
## BUG dash status: 127

#### : 9> fdleak (OSH regression)
true 9> "$TMP/fd.txt"
( echo world >&9 )
cat "$TMP/fd.txt"
## stdout-json: ""

#### : 3>&3 (OSH regression)

# mksh started being flaky on the continuous build and during release.  We
# don't care!  Related to issue #330.
case $SH in mksh) exit ;; esac

: 3>&3
echo hello
## stdout: hello
## BUG mksh stdout-json: ""
## BUG mksh status: 0

#### : 3>&3-
: 3>&3-
echo hello
## stdout: hello
## N-I dash/mksh stdout-json: ""
## N-I mksh status: 1
## N-I dash status: 2

#### 3>&- << EOF (OSH regression: fail to restore fds)
exec 3> "$TMP/fd.txt"
echo hello 3>&- << EOF
EOF
echo world >&3
exec 3>&-  # close
cat "$TMP/fd.txt"
## STDOUT:
hello
world
## END

#### Open file on descriptor 3 and write to it many times

# different than case below because 3 is the likely first FD of open()

exec 3> "$TMP/fd3.txt"
echo hello >&3
echo world >&3
exec 3>&-  # close
cat "$TMP/fd3.txt"
## STDOUT:
hello
world
## END

#### Open file on descriptor 4 and write to it many times

# different than the case above because because 4 isn't the likely first FD

exec 4> "$TMP/fd4.txt"
echo hello >&4
echo world >&4
exec 4>&-  # close
cat "$TMP/fd4.txt"
## STDOUT:
hello
world
## END

#### Redirect to empty string
f=''
echo s > "$f"
echo "result=$?"
set -o errexit
echo s > "$f"
echo DONE
## stdout: result=1
## status: 1
## OK dash stdout: result=2
## OK dash status: 2

#### Redirect to file descriptor that's not open
# Notes:
# - 7/2021: descriptor 7 seems to work on all CI systems.  The process state
#   isn't clean, but we could probably close it in OSH?
# - dash doesn't allow file descriptors greater than 9.  (This is a good
#   thing, because the bash chapter in AOSA book mentions that juggling user
#   vs.  system file descriptors is a huge pain.)
# - But somehow running in parallel under spec-runner.sh changes whether
#   descriptor 3 is open.  e.g. 'echo hi 1>&3'.  Possibly because of
#   /usr/bin/time.  The _tmp/spec/*.task.txt file gets corrupted!
# - Oh this is because I use time --output-file.  That opens descriptor 3.  And
#   then time forks the shell script.  The file descriptor table is inherited.
#   - You actually have to set the file descriptor to something.  What do
#   configure and debootstrap too?

opened=$(ls /proc/$$/fd)
if echo "$opened" | egrep '^7$'; then
  echo "FD 7 shouldn't be open"
  echo "OPENED:"
  echo "$opened"
fi

echo hi 1>&7
## stdout-json: ""
## status: 1
## OK dash status: 2

#### Open descriptor with exec
# What is the point of this?  ./configure scripts and debootstrap use it.
exec 3>&1
echo hi 1>&3
## stdout: hi
## status: 0

#### Open multiple descriptors with exec
# What is the point of this?  ./configure scripts and debootstrap use it.
exec 3>&1
exec 4>&1
echo three 1>&3
echo four 1>&4
## STDOUT:
three
four
## END
## status: 0

#### >| to clobber
echo XX >| $TMP/c.txt

set -o noclobber

echo YY >  $TMP/c.txt  # not clobber
echo status=$?

cat $TMP/c.txt
echo ZZ >| $TMP/c.txt

cat $TMP/c.txt
## STDOUT: 
status=1
XX
ZZ
## END
## OK dash STDOUT:
status=2
XX
ZZ
## END

#### &> redirects stdout and stderr
tmp="$(basename $SH)-$$.txt"  # unique name for shell and test case
#echo $tmp

stdout_stderr.py &> $tmp

# order is indeterminate
grep STDOUT $tmp
grep STDERR $tmp

## STDOUT:
STDOUT
STDERR
## END
## N-I dash stdout: STDOUT
## N-I dash stderr: STDERR
## N-I dash status: 1

#### >&word redirects stdout and stderr when word is not a number or -
# dash, mksh don't implement this bash behaviour.
case $SH in dash|mksh) exit 1 ;; esac

tmp="$(basename $SH)-$$.txt"  # unique name for shell and test case

stdout_stderr.py >&$tmp

# order is indeterminate
grep STDOUT $tmp
grep STDERR $tmp

## STDOUT:
STDOUT
STDERR
## END
## N-I dash/mksh status: 1
## N-I dash/mksh stdout-json: ""

#### 1>&- to close file descriptor
exec 5> "$TMP/f.txt"
echo hello >&5
exec 5>&-
echo world >&5
cat "$TMP/f.txt"
## STDOUT:
hello
## END

#### 1>&2- to move file descriptor
exec 5> "$TMP/f.txt"
echo hello5 >&5
exec 6>&5-
echo world5 >&5
echo world6 >&6
exec 6>&-
cat "$TMP/f.txt"
## STDOUT:
hello5
world6
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### 1>&2- (Bash bug: fail to restore closed fd)
# 7/2021: descriptor 8 is open on Github Actions, so use descriptor 6 instead

# Fix for CI systems where process state isn't clean: Close descriptors 6 and 7.
exec 6>&- 7>&-

opened=$(ls /proc/$$/fd)
if echo "$opened" | egrep '^7$'; then
  echo "FD 7 shouldn't be open"
  echo "OPENED:"
  echo "$opened"
fi
if echo "$opened" | egrep '^6$'; then
  echo "FD 6 shouldn't be open"
  echo "OPENED:"
  echo "$opened"
fi

exec 7> "$TMP/f.txt"
: 6>&7 7>&-
echo hello >&7
: 6>&7-
echo world >&7
exec 7>&-
cat "$TMP/f.txt"

## status: 1
## stdout-json: ""

## OK dash status: 2

## BUG bash status: 0
## BUG bash stdout: hello

#### <> for read/write
echo first >$TMP/rw.txt
exec 8<>$TMP/rw.txt
read line <&8
echo line=$line
echo second 1>&8
echo CONTENTS
cat $TMP/rw.txt
## STDOUT:
line=first
CONTENTS
first
second
## END

#### <> for read/write named pipes
## SKIP (unimplementable): Named pipes (mkfifo) not implemented and fd read/write with pipes not working
rm -f "$TMP/f.pipe"
mkfifo "$TMP/f.pipe"
exec 8<> "$TMP/f.pipe"
echo first >&8
echo second >&8
read line1 <&8
read line2 <&8
exec 8<&-
echo line1=$line1 line2=$line2
## stdout: line1=first line2=second

#### &>> appends stdout and stderr

# Fix for flaky tests: dash behaves non-deterministically under load!  It
# doesn't implement the behavior anyway so I don't care why.
case $SH in
  *dash)
    exit 1
    ;;
esac

echo "ok" > $TMP/f.txt
stdout_stderr.py &>> $TMP/f.txt
grep ok $TMP/f.txt >/dev/null && echo 'ok'
grep STDOUT $TMP/f.txt >/dev/null && echo 'ok'
grep STDERR $TMP/f.txt >/dev/null && echo 'ok'
## STDOUT:
ok
ok
ok
## END
## N-I dash stdout-json: ""
## N-I dash status: 1

#### exec redirect then various builtins
exec 5>$TMP/log.txt
echo hi >&5
set -o >&5
echo done
## STDOUT:
done
## END

#### can't mention big file descriptor
echo hi 9>&1
# trivia: 23 is the max descriptor for mksh
#echo hi 24>&1
echo hi 99>&1
echo hi 100>&1
## OK osh STDOUT:
hi
hi
hi 100
## END
## STDOUT:
hi
hi 99
hi 100
## END
## BUG bash STDOUT:
hi
hi
hi
## END

#### : >/dev/null 2> / (OSH regression: fail to pop fd frame)
# oil 0.8.pre4 fails to restore fds after redirection failure. In the
# following case, the fd frame remains after the redirection failure
# "2> /" so that the effect of redirection ">/dev/null" remains after
# the completion of the command.
: >/dev/null 2> /
echo hello
## stdout: hello
## OK dash stdout-json: ""
## OK dash status: 2
## OK mksh stdout-json: ""
## OK mksh status: 1
# dash/mksh terminates the execution of script on the redirection.

#### echo foo >&100 (OSH regression: does not fail with invalid fd 100)
# oil 0.8.pre4 does not fail with non-existent fd 100.
fd=100
echo foo53 >&$fd
## stdout-json: ""
## status: 1
## OK dash status: 2

#### echo foo >&N where N is first unused fd
# 1. prepare default fd for internal uses
minfd=10
case ${SH##*/} in
(mksh) minfd=24 ;;
(osh) minfd=100 ;;
esac

# 2. prepare first unused fd
fd=$minfd
is_fd_open() { : >&$1; }
while is_fd_open "$fd"; do
  : $((fd+=1))

  # OLD: prevent infinite loop for broken oils-for-unix
  #if test $fd -gt 1000; then
  #  break
  #fi
done

# 3. test
echo foo54 >&$fd
## stdout-json: ""
## status: 1
## OK dash status: 2

#### exec {fd}>&- (OSH regression: fails to close fd)
# mksh, dash do not implement {fd} redirections.
case $SH in mksh|dash) exit 1 ;; esac
# oil 0.8.pre4 fails to close fd by {fd}&-.
exec {fd}>file1
echo foo55 >&$fd
exec {fd}>&-
echo bar >&$fd
cat file1
## stdout: foo55
## N-I mksh/dash stdout-json: ""
## N-I mksh/dash status: 1

#### noclobber can still write to non-regular files like /dev/null
set -C  # noclobber
set -e  # errexit (raise any redirection errors)

# Each redirect to /dev/null should succeed
echo a  >  /dev/null  # trunc, write stdout
echo a &>  /dev/null  # trunc, write stdout and stderr
echo a  >> /dev/null  # append, write stdout
echo a &>> /dev/null  # append, write stdout and stderr
echo a  >| /dev/null  # ignore noclobber, trunc, write stdout
## OK dash STDOUT:
a
a
## END
## STDOUT:
## END

#### Parsing of x=1> and related cases

echo x=1>/dev/stdout
echo x=1 >/dev/stdout
echo x= 1>/dev/stdout

echo +1>/dev/stdout
echo +1 >/dev/stdout
echo + 1>/dev/stdout

echo a1>/dev/stdout

## STDOUT:
x=1
x=1
x=
+1
+1
+
a1
## END

#### Parsing of x={myvar} and related cases
case $SH in dash) exit ;; esac

echo {myvar}>/dev/stdout
# Bash chooses fds starting with 10 here, osh with 100, and there can already
# be some open fds, so compare further fds against this one
starting_fd=$myvar

echo x={myvar}>/dev/stdout
echo $((myvar-starting_fd))
echo x={myvar} >/dev/stdout
echo $((myvar-starting_fd))
echo x= {myvar}>/dev/stdout
echo $((myvar-starting_fd))

echo +{myvar}>/dev/stdout
echo $((myvar-starting_fd))
echo +{myvar} >/dev/stdout
echo $((myvar-starting_fd))
echo + {myvar}>/dev/stdout
echo $((myvar-starting_fd))
## STDOUT:

x={myvar}
0
x={myvar}
0
x=
1
+{myvar}
1
+{myvar}
1
+
2
## END
## BUG mksh/ash STDOUT:
{myvar}
x={myvar}
0
x={myvar}
0
x= {myvar}
0
+{myvar}
0
+{myvar}
0
+ {myvar}
0
## END
## N-I dash STDOUT:
## END

#### xtrace not affected by redirects
set -x
printf 'aaaa' > /dev/null 2> test_osh
set +x
cat test_osh
## STDERR:
+ printf aaaa
+ set +x
## END
## STDOUT:
## END

## OK osh STDERR:
+ printf aaaa
+ set '+x'
## END

## OK mksh STDERR:
+ >/dev/null 
+ 2>test_osh 
+ printf aaaa
+ set +x
## END
