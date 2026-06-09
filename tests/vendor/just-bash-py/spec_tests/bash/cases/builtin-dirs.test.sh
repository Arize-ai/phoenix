## compare_shells: bash zsh

# dash and mksh don't implement 'dirs'

#### pushd/popd
set -o errexit
cd /
pushd /tmp
echo -n pwd=; pwd
popd
echo -n pwd=; pwd
## status: 0
## STDOUT:
~ /
pwd=/tmp
/
pwd=/
## END
## OK zsh STDOUT:
pwd=/tmp
pwd=/
## END
## N-I dash/mksh status: 127
## N-I dash/mksh stdout-json: ""

#### pushd usage
pushd -z
echo status=$?
pushd /tmp >/dev/null
echo status=$?
pushd -- /tmp >/dev/null
echo status=$?
## STDOUT:
status=2
status=0
status=0
## END
## OK zsh STDOUT:
status=1
status=0
status=0
## END

#### popd usage error
pushd / >/dev/null
popd zzz
echo status=$?

popd -- >/dev/null
echo status=$?

popd -z
echo status=$?
## STDOUT:
status=2
status=0
status=2
## END
## BUG zsh STDOUT:
status=0
status=0
status=0
## END

#### popd returns error on empty directory stack
message=$(popd 2>&1)
echo $?
echo "$message" | grep -o "directory stack"
## STDOUT:
1
directory stack
## END

#### cd replaces the lowest entry on the directory stack!
# stable temp dir
dir=/tmp/oils-spec/builtin-dirs

mkdir -p $dir
cd $dir

pushd /tmp >/dev/null
echo pushd=$?

dirs

cd /
echo cd=$?

dirs

popd >/dev/null
echo popd=$?

popd >/dev/null
echo popd=$?

## STDOUT:
pushd=0
~ ~/oils-spec/builtin-dirs
cd=0
/ ~/oils-spec/builtin-dirs
popd=0
popd=1
## END

#### dirs builtin
cd /
dirs
## status: 0
## STDOUT:
/
## END

#### dirs -c to clear the stack
set -o errexit
cd /
pushd /tmp >/dev/null  # zsh pushd doesn't print anything, but bash does
echo --
dirs
dirs -c
echo --
dirs
## status: 0
## STDOUT:
--
~ /
--
~
## END

#### dirs -v to print numbered stack, one entry per line
set -o errexit
cd /
pushd /tmp >/dev/null
echo --
dirs -v
pushd /dev >/dev/null
echo --
dirs -v
## status: 0
## STDOUT:
--
 0  ~
 1  /
--
 0  /dev
 1  ~
 2  /
## END
#
#  zsh uses tabs
## OK zsh stdout-json: "--\n0\t/tmp\n1\t/\n--\n0\t/dev\n1\t/tmp\n2\t/\n"

#### dirs -p to print one entry per line
set -o errexit
cd /
pushd /tmp >/dev/null
echo --
dirs -p
pushd /dev >/dev/null
echo --
dirs -p
## STDOUT:
--
~
/
--
/dev
~
/
## END

#### dirs -l to print in long format, no tilde prefix
# Can't use the OSH test harness for this because
# /home/<username> may be included in a path.
cd /
HOME=/tmp
mkdir -p $HOME/oil_test
pushd $HOME/oil_test >/dev/null
dirs
dirs -l
## status: 0
## STDOUT:
~/oil_test /
/tmp/oil_test /
## END

#### dirs to print using tilde-prefix format
cd /
HOME=/tmp
mkdir -p $HOME/oil_test
pushd $HOME/oil_test >/dev/null
dirs
## stdout: ~/oil_test /
## status: 0

#### dirs test converting true home directory to tilde
cd /
HOME=/tmp
mkdir -p $HOME/oil_test/$HOME
pushd $HOME/oil_test/$HOME >/dev/null
dirs
## stdout: ~/oil_test/tmp /
## status: 0

#### dirs don't convert to tilde when $HOME is substring
cd /
mkdir -p /tmp/oil_test
mkdir -p /tmp/oil_tests
HOME=/tmp/oil_test
pushd /tmp/oil_tests
dirs

#### dirs tilde test when $HOME is exactly $PWD
cd /
mkdir -p /tmp/oil_test
HOME=/tmp/oil_test
pushd $HOME
dirs
## status: 0
# zsh doesn't duplicate the stack I guess.
## OK zsh STDOUT:
~ /
## END
## STDOUT:
~ /
~ /
## END

#### dirs test of path alias `..`
cd /tmp
pushd .. >/dev/null
dirs
## stdout: / ~
## status: 0

#### dirs test of path alias `.`
cd /tmp
pushd . >/dev/null
dirs
## stdout: ~ ~
## status: 0

#### pushd does not take more than one argument
pushd . . >/dev/null || echo too many args!
## N-I zsh STDOUT:
## END
## STDOUT:
too many args!
## END

#### dirs does not take arguments
dirs a || echo failed
dirs -l a || echo failed
## STDOUT:
failed
failed
## END
## BUG zsh STDOUT:
## END
