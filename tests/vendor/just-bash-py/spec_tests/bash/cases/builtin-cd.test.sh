## compare_shells: dash bash mksh zsh ash
## oils_failures_allowed: 3
## oils_cpp_failures_allowed: 3

#### cd and $PWD
cd /
echo $PWD
## stdout: /

#### cd BAD/..

# Odd divergence in shells: dash and mksh normalize the path and don't check
# this error.
# TODO: I would like OSH to behave like bash and zsh, but separating chdir_arg
# and pwd_arg breaks case 17.

cd nonexistent_ZZ/..
echo status=$?
## STDOUT:
status=1
## END
## BUG dash/ash/mksh STDOUT:
status=0
## END

#### cd with 2 or more args - with strict_arg_parse
## SKIP (unimplementable): Oils-specific shopt options not implemented

shopt -s strict_arg_parse

mkdir -p foo
cd foo
echo status=$?
cd ..
echo status=$?


cd foo bar
st=$?
if test $st -ne 0; then
  echo 'failed with multiple args'
fi

## STDOUT:
status=0
status=0
failed with multiple args
## END

## N-I dash/ash STDOUT:
status=0
status=0
## END

#### cd with 2 or more args is allowed (strict_arg_parse disabled)

mkdir -p foo
cd foo bar

## status: 0
## OK bash/zsh status: 1
## OK mksh status: 2

#### cd - without OLDPWD

cd - > /dev/null  # silence dash output
echo status=$?
#pwd

## STDOUT:
status=1
## END

## OK mksh STDOUT:
status=2
## END

## BUG dash/ash/zsh STDOUT:
status=0
## END

#### $OLDPWD
cd /
cd $TMP
echo "old: $OLDPWD"
env | grep OLDPWD  # It's EXPORTED too!
cd -
## STDOUT:
old: /
OLDPWD=/
/
## END
## BUG mksh STDOUT:
old: /
/
## END
## BUG zsh STDOUT:
old: /
OLDPWD=/
## END

#### pwd
cd /
pwd
## STDOUT:
/
## END

#### pwd after cd ..
dir=$TMP/dir-one/dir-two
mkdir -p $dir
cd $dir
echo $(basename $(pwd))
cd ..
echo $(basename $(pwd))
## STDOUT:
dir-two
dir-one
## END

#### pwd with symlink and -P
tmp=$TMP/builtins-pwd-1
mkdir -p $tmp/target
ln -s -f $tmp/target $tmp/symlink

cd $tmp/symlink

echo pwd:
basename $(pwd)

echo pwd -P:
basename $(pwd -P)

## STDOUT:
pwd:
symlink
pwd -P:
target
## END

#### setting $PWD doesn't affect the value of 'pwd' builtin
dir=/tmp/oil-spec-test/pwd
mkdir -p $dir
cd $dir

PWD=foo
echo before $PWD
pwd
echo after $PWD
## STDOUT:
before foo
/tmp/oil-spec-test/pwd
after foo
## END

#### unset PWD; then pwd
dir=/tmp/oil-spec-test/pwd
mkdir -p $dir
cd $dir

unset PWD
echo PWD=$PWD
pwd
echo PWD=$PWD
## STDOUT:
PWD=
/tmp/oil-spec-test/pwd
PWD=
## END

#### 'unset PWD; pwd' before any cd (tickles a rare corner case)
dir=/tmp/oil-spec-test/pwd-2
mkdir -p $dir
cd $dir

# ensure clean shell process state
$SH -c 'unset PWD; pwd'

## STDOUT:
/tmp/oil-spec-test/pwd-2
## END

#### lie about PWD; pwd before any cd
dir=/tmp/oil-spec-test/pwd-3
mkdir -p $dir
cd $dir

# ensure clean shell process state
$SH -c 'PWD=foo; pwd'

## STDOUT:
/tmp/oil-spec-test/pwd-3
## END

#### remove pwd dir
dir=/tmp/oil-spec-test/pwd
mkdir -p $dir
cd $dir
pwd
rmdir $dir
echo status=$?
pwd
echo status=$?
## STDOUT:
/tmp/oil-spec-test/pwd
status=0
/tmp/oil-spec-test/pwd
status=0
## END
## OK mksh STDOUT:
/tmp/oil-spec-test/pwd
status=0
status=1
## END

#### pwd in symlinked dir on shell initialization
tmp=$TMP/builtins-pwd-2
mkdir -p $tmp
mkdir -p $tmp/target
ln -s -f $tmp/target $tmp/symlink

cd $tmp/symlink
$SH -c 'basename $(pwd)'
unset PWD
$SH -c 'basename $(pwd)'

## STDOUT:
symlink
target
## END
## OK mksh STDOUT:
target
target
## END
## stderr-json: ""

#### Test the current directory after 'cd ..' involving symlinks
dir=$TMP/symlinktest
mkdir -p $dir
cd $dir
mkdir -p a/b/c
mkdir -p a/b/d
ln -s -f a/b/c c > /dev/null
cd c
cd ..
# Expecting a c/ (since we are in symlinktest) but osh gives c d (thinks we are
# in b/)
ls
## STDOUT:
a
c
## END

#### cd with no arguments
HOME=$TMP/home
mkdir -p $HOME
cd
test $(pwd) = "$HOME" && echo OK
## stdout: OK

#### cd to nonexistent dir
cd /nonexistent/dir
echo status=$?
## stdout: status=1
## OK dash/ash/mksh stdout: status=2

#### cd away from dir that was deleted
dir=$TMP/cd-nonexistent
mkdir -p $dir
cd $dir
rmdir $dir
cd $TMP
echo $(basename $OLDPWD)
echo status=$?
## STDOUT:
cd-nonexistent
status=0
## END

#### cd permits double bare dash
cd -- /
echo $PWD
## stdout: /

#### cd to symlink with -L and -P
targ=$TMP/cd-symtarget
lnk=$TMP/cd-symlink
mkdir -p $targ
ln -s $targ $lnk

# -L behavior is the default
cd $lnk
test $PWD = "$TMP/cd-symlink" && echo OK

cd -L $lnk
test $PWD = "$TMP/cd-symlink" && echo OK

cd -P $lnk
test $PWD = "$TMP/cd-symtarget" && echo OK || echo $PWD
## STDOUT:
OK
OK
OK
## END

#### cd to relative path with -L and -P
die() { echo "$@"; exit 1; }

targ=$TMP/cd-symtarget/subdir
lnk=$TMP/cd-symlink
mkdir -p $targ
ln -s $TMP/cd-symtarget $lnk

# -L behavior is the default
cd $lnk/subdir
test $PWD = "$TMP/cd-symlink/subdir" || die "failed"
cd ..
test $PWD = "$TMP/cd-symlink" && echo OK

cd $lnk/subdir
test $PWD = "$TMP/cd-symlink/subdir" || die "failed"
cd -L ..
test $PWD = "$TMP/cd-symlink" && echo OK

cd $lnk/subdir
test $PWD = "$TMP/cd-symlink/subdir" || die "failed"
cd -P ..
test $PWD = "$TMP/cd-symtarget" && echo OK || echo $PWD
## STDOUT:
OK
OK
OK
## END

#### unset PWD; cd /tmp is allowed (regression)

unset PWD; cd /tmp
pwd

## STDOUT:
/tmp
## END

#### CDPATH is respected

mkdir -p /tmp/spam/foo /tmp/eggs/foo

CDPATH='/tmp/spam:/tmp/eggs'

cd foo
echo status=$?
pwd

## STDOUT:
/tmp/spam/foo
status=0
/tmp/spam/foo
## END

# doesn't print the dir
## BUG zsh STDOUT:
status=0
/tmp/spam/foo
## END


#### Change directory in non-shell parent process (make or Python)
## SKIP (unimplementable): Interactive shell invocation not implemented

# inspired by Perl package bug

old_dir=$(pwd)

mkdir -p cpan/Encode/Byte

# Simulate make changing the dir
wrapped_chdir() {
  #set -- $SH -c 'echo BEFORE; pwd; echo CD; cd Byte; echo AFTER; pwd'

  set -- $SH -c 'cd Byte; pwd'
  # strace comes out the same - one getcwd() and one chdir()
  #set -- strace -e 'getcwd,chdir' "$@"

  python2 -c '
from __future__ import print_function
import os, sys, subprocess

argv = sys.argv[1:]
print("Python PWD = %r" % os.getenv("PWD"), file=sys.stderr)
print("Python argv = %r" % argv, file=sys.stderr)

os.chdir("cpan/Encode")
subprocess.check_call(argv)
' "$@"
}

#wrapped_chdir
new_dir=$(wrapped_chdir)

#echo $old_dir

# Make the test insensitive to absolute paths
echo "${new_dir##$old_dir}"

## STDOUT:
/cpan/Encode/Byte
## END

#### What happens when inherited $PWD and current dir disagree?
## SKIP (unimplementable): Interactive shell invocation not implemented

DIR=/tmp/osh-spec-cd
mkdir -p $DIR
cd $DIR

old_dir=$(pwd)

mkdir -p cpan/Encode/Byte

# Simulate make changing the dir
wrapped_chdir() {
  #set -- $SH -c 'echo BEFORE; pwd; echo CD; cd Byte; echo AFTER; pwd'

  # disagreement before we gert here
  set -- $SH -c '
echo "PWD = $PWD"; pwd
cd Byte; echo cd=$?
echo "PWD = $PWD"; pwd
'

  # strace comes out the same - one getcwd() and one chdir()
  #set -- strace -e 'getcwd,chdir' "$@"

  python2 -c '
from __future__ import print_function
import os, sys, subprocess

argv = sys.argv[1:]
print("Python argv = %r" % argv, file=sys.stderr)

os.chdir("cpan/Encode")
print("Python PWD = %r" % os.getenv("PWD"), file=sys.stdout)
sys.stdout.flush()

subprocess.check_call(argv)
' "$@"
}

#unset PWD
wrapped_chdir

## STDOUT:
Python PWD = '/tmp/osh-spec-cd'
PWD = /tmp/osh-spec-cd/cpan/Encode
/tmp/osh-spec-cd/cpan/Encode
cd=0
PWD = /tmp/osh-spec-cd/cpan/Encode/Byte
/tmp/osh-spec-cd/cpan/Encode/Byte
## END

## BUG mksh STDOUT:
Python PWD = None
PWD = /tmp/osh-spec-cd/cpan/Encode
/tmp/osh-spec-cd/cpan/Encode
cd=0
PWD = /tmp/osh-spec-cd/cpan/Encode/Byte
/tmp/osh-spec-cd/cpan/Encode/Byte
## END

#### Survey of getcwd() syscall

# This is not that important -- see core/sh_init.py
# Instead of verifying that stat('.') == stat(PWD), which is two sycalls,
# OSH just calls getcwd() unconditionally.

# so C++ leak sanitizer  doesn't print to stderr
export ASAN_OPTIONS='detect_leaks=0'

strace -e getcwd -- $SH -c 'echo hi; pwd; echo $PWD' 1> /dev/null 2> err.txt

wc -l err.txt
#cat err.txt

## STDOUT:
1 err.txt
## END
## BUG mksh STDOUT:
2 err.txt
## END

#### chdir is a synonym for cd - busybox ash

chdir /tmp

if test $? -ne 0; then
  echo fail
  exit
fi

pwd

# It's the same with no args, but mksh fails because of $HOME
#chdir
#echo status=$?

## STDOUT:
/tmp
## END

## N-I bash STDOUT:
fail
## END

#### arguments to pwd
pwd /
## status: 0
## OK zsh/mksh status: 1

#### pwd errors out on args with strict_arg_parse
## SKIP (unimplementable): Oils-specific shopt options not implemented
shopt -s strict_arg_parse || true
pwd / >/dev/null || echo 'too many args!'
## N-I bash/dash/ash STDOUT:
## END
## STDOUT:
too many args!
## END
