## compare_shells: dash bash-4.4 mksh zsh
## oils_failures_allowed: 0

#### Eval
eval "a=3"
echo $a
## stdout: 3

#### eval accepts/ignores --
eval -- echo hi
## STDOUT:
hi
## END
## BUG dash status: 127
## BUG dash stdout-json: ""

#### eval usage
eval -
echo $?
eval -z
echo $?
## STDOUT:
127
2
## END
## OK dash STDOUT:
127
127
## END
## OK-2 mksh status: 1
## OK-2 mksh STDOUT:
127
## END
## OK-3 zsh STDOUT:
0
127
## END

#### eval string with 'break continue return error'

set -e

sh_func_that_evals() {
  local code_str=$1
  for i in 1 2; do
    echo $i
    eval "$code_str"
  done
  echo 'end func'
}

for code_str in break continue return false; do
  echo "--- $code_str"
  sh_func_that_evals "$code_str"
done
echo status=$?

## status: 1
## STDOUT:
--- break
1
end func
--- continue
1
2
end func
--- return
1
--- false
1
## END

## BUG mksh STDOUT:
--- break
1
2
end func
--- continue
1
2
end func
--- return
1
--- false
1
## END

## YSH-specific test - commented out
# #### eval YSH block with 'break continue return error'
# case $SH in dash|bash*|mksh|zsh) exit ;; esac
#
# shopt -s ysh:all
#
# proc proc_that_evals(; ; ;b) {
#   for i in 1 2; do
#     echo $i
#     call io->eval(b)
#   done
#   echo 'end func'
# }
#
# var cases = [
#   ['break', ^(break)],
#   ['continue', ^(continue)],
#   ['return', ^(return)],
#   ['false', ^(false)],
# ]
#
# for test_case in (cases) {
#   var code_str, block = test_case
#   echo "--- $code_str"
#   proc_that_evals (; ; block)
# }
# echo status=$?
#
# ## status: 1
# ## STDOUT:
# --- break
# 1
# end func
# --- continue
# 1
# 2
# end func
# --- return
# 1
# --- false
# 1
# ## END
#
# ## N-I dash/bash/mksh/zsh status: 0
# ## N-I dash/bash/mksh/zsh STDOUT:
# ## END

#### exit within eval (regression)
eval 'exit 42'
echo 'should not get here'
## stdout-json: ""
## status: 42

#### exit within source (regression)
cd $TMP
echo 'exit 42' > lib.sh
. ./lib.sh
echo 'should not get here'
## stdout-json: ""
## status: 42

#### Source
lib=$TMP/spec-test-lib.sh
echo 'LIBVAR=libvar' > $lib
. $lib  # dash doesn't have source
echo $LIBVAR
## stdout: libvar

#### source accepts/ignores --
echo 'echo foo' > $TMP/foo.sh
source -- $TMP/foo.sh
## STDOUT:
foo
## END
## N-I dash stdout-json: ""
## N-I dash status: 127

#### Source nonexistent
source /nonexistent/path
echo status=$?
## stdout: status=1
## OK dash/zsh stdout: status=127

#### Source with no arguments
source
echo status=$?
## stdout: status=2
## OK mksh/zsh stdout: status=1
## N-I dash stdout: status=127

#### Source with arguments
# Create test script inline - echoes "show-argv:" followed by args
cat > /tmp/show-argv.sh <<'SCRIPT'
echo "show-argv: $*"
SCRIPT

. /tmp/show-argv.sh foo bar  # dash doesn't have source
## STDOUT:
show-argv: foo bar
## END
## N-I dash STDOUT:
show-argv:
## END

#### Source from a function, mutating argv and defining a local var
# Create source-argv.sh inline - shift mutates caller's argv when no args given
cat > /tmp/source-argv.sh <<'SCRIPT'
echo "source-argv: $*"
shift
local foo=foo_val
SCRIPT
f() {
  . /tmp/source-argv.sh              # no argv
  . /tmp/source-argv.sh args to src  # new argv
  echo $@
  echo foo=$foo  # defined in source-argv.sh
}
f args to func
echo foo=$foo  # not defined
## STDOUT:
source-argv: args to func
source-argv: args to src
to func
foo=foo_val
foo=
## END
## N-I dash STDOUT:
source-argv: args to func
source-argv: to func
func
foo=foo_val
foo=
## END

#### Source with syntax error
# TODO: We should probably use dash behavior of a fatal error.
# Although set-o errexit handles this.  We don't want to break the invariant
# that a builtin like 'source' behaves like an external program.  An external
# program can't halt the shell!
echo 'echo >' > $TMP/syntax-error.sh
. $TMP/syntax-error.sh
echo status=$?
## stdout: status=2
## OK bash/mksh stdout: status=1
## OK zsh stdout: status=126
## OK dash stdout-json: ""
## OK dash status: 2

#### Eval with syntax error
eval 'echo >'
echo status=$?
## stdout: status=2
## OK bash/zsh stdout: status=1
## OK dash stdout-json: ""
## OK dash status: 2
## OK mksh stdout-json: ""
## OK mksh status: 1

#### Eval in does tilde expansion

x="~"
eval y="$x"  # scalar
test "$x" = "$y" || echo FALSE
[[ $x == /* ]] || echo FALSE  # doesn't start with /
[[ $y == /* ]] && echo TRUE

#argv "$x" "$y"

## STDOUT:
FALSE
FALSE
TRUE
## END
## BUG dash status: 127
## BUG dash STDOUT:
FALSE
## END
## BUG mksh status: 1
## BUG mksh STDOUT:
FALSE
## END

#### Eval in bash does tilde expansion in array

# the "make" plugin in bash-completion relies on this?  wtf?
x="~"

# UPSTREAM CODE

#eval array=( "$x" )

# FIXED CODE -- proper quoting.

eval 'array=(' "$x" ')'  # array

test "$x" = "${array[0]}" || echo FALSE
[[ $x == /* ]] || echo FALSE  # doesn't start with /
[[ "${array[0]}" == /* ]] && echo TRUE
## STDOUT:
FALSE
FALSE
TRUE
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## BUG mksh status: 1
## BUG mksh STDOUT:
FALSE
## END
## BUG zsh status: 1
## BUG zsh STDOUT:
FALSE
FALSE
## END

#### source works for files in current directory (bash only)
cd $TMP
echo "echo current dir" > cmd
. cmd
echo status=$?
## STDOUT:
current dir
status=0
## END
## N-I zsh STDOUT:
status=127
## END

# This is a special builtin so failure is fatal.

## N-I dash stdout-json: ""
## N-I dash status: 2
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### source looks in PATH for files
mkdir -p dir
echo "echo hi" > dir/cmd
PATH="dir:$PATH"
. cmd
rm dir/cmd
## STDOUT:
hi
## END

#### source finds files in PATH before current dir
cd $TMP
mkdir -p dir
echo "echo path" > dir/cmd
echo "echo current dir" > cmd
PATH="dir:$PATH"
. cmd
echo status=$?
## STDOUT:
path
status=0
## END

#### source works for files in subdirectory
mkdir -p dir
echo "echo path" > dir/cmd
. dir/cmd
rm dir/cmd
## STDOUT:
path
## END

#### source doesn't crash when targeting a directory
cd $TMP
mkdir -p dir
. ./dir/
echo status=$?
## stdout: status=1
## OK dash/zsh/mksh stdout: status=0

#### sourcing along PATH should ignore directories

mkdir -p _tmp/shell
mkdir -p _tmp/dir/hello.sh
printf 'echo hi' >_tmp/shell/hello.sh

DIR=$PWD/_tmp/dir
SHELL=$PWD/_tmp/shell

# Should find the file hello.sh right away and source it
PATH="$SHELL:$PATH" . hello.sh
echo status=$?

# Should fail because hello.sh cannot be found
PATH="$DIR:$SHELL:$PATH" . hello.sh
echo status=$?

## STDOUT:
hi
status=0
hi
status=0
## END

## OK mksh STDOUT:
hi
status=0
status=0
## END
