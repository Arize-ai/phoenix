## oils_failures_allowed: 3
## compare_shells: bash

#### complete with no args and complete -p both print completion spec
set -e

complete

complete -W 'foo bar' mycommand

complete -p

complete -F myfunc other

complete

## STDOUT:
complete -W 'foo bar' mycommand
complete -W 'foo bar' mycommand
complete -F myfunc other
## END

#### complete -F f is usage error
#complete -F f cmd

# Alias for complete -p
complete > /dev/null  # ignore OSH output for now
echo status=$?

# But this is an error
complete -F f
echo status=$?

## STDOUT:
status=0
status=2
## END

#### complete with nonexistent function
complete -F invalidZZ -D
echo status=$?
## stdout: status=2
## BUG bash stdout: status=0

#### complete with no action
complete foo
echo status=$?
## stdout: status=2
## BUG bash stdout: status=0

#### -A function prints functions
add () { expr 4 + 4; }
div () { expr 6 / 2; }
ek () { echo hello; }
__ec () { echo hi; }
_ab () { expr 10 % 3; }
compgen -A function
echo --
compgen -A function _
## status: 0
## STDOUT:
__ec
_ab
add
div
ek
--
__ec
_ab
## END

#### Invalid syntax
compgen -A foo
echo status=$?
## stdout: status=2

#### how compgen calls completion functions
foo_complete() {
  # first, cur, prev
  argv.py argv "$@"
  argv.py COMP_WORDS "${COMP_WORDS[@]}"
  argv.py COMP_CWORD "${COMP_CWORD}"
  argv.py COMP_LINE "${COMP_LINE}"
  argv.py COMP_POINT "${COMP_POINT}"
  #return 124
  COMPREPLY=(one two three)
}
compgen -F foo_complete foo a b c
## STDOUT:
['argv', 'compgen', 'foo', '']
['COMP_WORDS']
['COMP_CWORD', '-1']
['COMP_LINE', '']
['COMP_POINT', '0']
one
two
three
## END

#### complete -o -F (git)
foo() { echo foo; }
wrapper=foo
complete -o default -o nospace -F $wrapper git
## status: 0

#### compopt with invalid syntax
compopt -o invalid
echo status=$?
## stdout: status=2

#### compopt fails when not in completion function
# NOTE: Have to be executing a completion function
compopt -o filenames +o nospace
## status: 1

#### compgen -f on invalid  dir
compgen -f /non-existing-dir/
## status: 1
## stdout-json: ""

#### compgen -f
mkdir -p $TMP/compgen
touch $TMP/compgen/{one,two,three}
cd $TMP/compgen
compgen -f | sort
echo --
compgen -f t | sort
## STDOUT:
one
three
two
--
three
two
## END

#### compgen -v with local vars
v1_global=0
f() {
  local v2_local=0	 
  compgen -v v
}
f
## STDOUT:
v1_global
v2_local
## END

#### compgen -v on unknown var
compgen -v __nonexistent__
## status: 1
## stdout-json: ""

#### compgen -v P
cd > /dev/null  # for some reason in bash, this makes PIPESTATUS appear!
compgen -v P | grep -E '^PATH|PWD' | sort
## STDOUT:
PATH
PWD
## END

#### compgen -e with global/local exported vars
export v1_global=0
f() {
  local v2_local=0
  export v2_local
  compgen -e v
}
f
## STDOUT:
v1_global
v2_local
## END

#### compgen -e on known, but unexported, var
unexported=0
compgen -e unexported
## status: 1
## stdout-json: ""

#### compgen -e on unknown var
compgen -e __nonexistent__
## status: 1
## stdout-json: ""

#### compgen -e P
cd > /dev/null  # for some reason in bash, this makes PIPESTATUS appear!
compgen -e P | grep -E '^PATH|PWD' | sort
## STDOUT:
PATH
PWD
## END

#### compgen with actions: function / variable / file 
mkdir -p $TMP/compgen2
touch $TMP/compgen2/{PA,Q}_FILE
cd $TMP/compgen2  # depends on previous test above!
PA_FUNC() { echo P; }
Q_FUNC() { echo Q; }
compgen -A function -A variable -A file PA
## STDOUT:
PA_FUNC
PATH
PA_FILE
## END

#### compgen with actions: alias, setopt
## SKIP (unimplementable): setopt action not supported (zsh-specific)
alias v_alias='ls'
alias v_alias2='ls'
alias a1='ls'
compgen -A alias -A setopt v
## STDOUT:
v_alias
v_alias2
verbose
vi
## END

#### compgen with actions: shopt
compgen -A shopt -P [ -S ] nu
## STDOUT:
[nullglob]
## END

#### compgen with action and suffix: helptopic
compgen -A helptopic -S ___ fal
## STDOUT:
false___
## END

#### compgen -A directory
# Create test directories inline
mkdir -p /tmp/completion-test/client /tmp/completion-test/core /tmp/completion-test/cpp
cd /tmp/completion-test
compgen -A directory c | sort
## STDOUT:
client
core
cpp
## END

#### compgen -A file
# Create test files/directories inline
mkdir -p /tmp/completion-test2/opy /tmp/completion-test2/osh
touch /tmp/completion-test2/oils-version.txt
cd /tmp/completion-test2
compgen -A file o | sort
## STDOUT:
oils-version.txt
opy
osh
## END

#### compgen -A user
# no assertion because this isn't hermetic
compgen -A user
## status: 0

#### compgen -A command completes external commands
# NOTE: this test isn't hermetic
compgen -A command xarg | uniq
echo status=$?
## STDOUT:
xargs
status=0
## END

#### compgen -A command completes functions and aliases
our_func() { echo ; }
our_func2() { echo ; }
alias our_alias=foo

compgen -A command our_
echo status=$?

# Introduce another function.  Note that we're missing test coverage for
# 'complete', i.e. bug #1064.
our_func3() { echo ; }

compgen -A command our_
echo status=$?

## STDOUT:
our_alias
our_func
our_func2
status=0
our_alias
our_func
our_func2
our_func3
status=0
## END

#### compgen -A command completes builtins and keywords
compgen -A command eva
echo status=$?
compgen -A command whil
echo status=$?
## STDOUT:
eval
status=0
while
status=0
## END

#### compgen -k shows the same keywords as bash
## SKIP (unimplementable): Interactive shell invocation not implemented

# bash adds ]] and } and coproc

# Use bash as an oracle
bash -c 'compgen -k' | sort > bash.txt

# osh vs. bash, or bash vs. bash
$SH -c 'compgen -k' | sort > this-shell.txt

#comm bash.txt this-shell.txt

# show lines in both files
comm -12 bash.txt this-shell.txt | egrep -v 'coproc|select'

## STDOUT:
!
[[
]]
case
do
done
elif
else
esac
fi
for
function
if
in
then
time
until
while
{
}
## END

#### compgen -k shows Oils keywords too
## SKIP (unimplementable): OSH/YSH-specific keywords not supported
# YSH has a superset of keywords:
# const var
# setvar setglobal
# proc func typed
# call =   # hm = is not here

compgen -k | sort | egrep '^(const|var|setvar|setglobal|proc|func|typed|call|=)$'
echo --

## STDOUT:
=
call
const
func
proc
setglobal
setvar
typed
var
--
## END

## N-I bash STDOUT:
--
## END

#### compgen -k completes reserved shell keywords
compgen -k do | sort
echo status=$?
compgen -k el | sort
echo status=$?
## STDOUT:
do
done
status=0
elif
else
status=0
## END

#### -o filenames and -o nospace have no effect with compgen 
# they are POSTPROCESSING.
compgen -o filenames -o nospace -W 'bin build'
## STDOUT:
bin
build
## END

#### -o plusdirs and -o dirnames with compgen
# Create test directories inline
mkdir -p /tmp/plusdirs-test/benchmarks /tmp/plusdirs-test/bin /tmp/plusdirs-test/build /tmp/plusdirs-test/builtin
cd /tmp/plusdirs-test
compgen -o plusdirs -W 'a b1 b2' b | sort
echo ---
compgen -o dirnames b | sort
## STDOUT:
b1
b2
benchmarks
bin
build
builtin
---
benchmarks
bin
build
builtin
## END

#### compgen -o default completes files and dirs
# Create test structure inline
mkdir -p /tmp/compgen-default-test/spec/testdata
touch /tmp/compgen-default-test/spec/temp-binding.test.sh
touch /tmp/compgen-default-test/spec/tilde.test.sh
touch /tmp/compgen-default-test/spec/toysh-posix.test.sh
touch /tmp/compgen-default-test/spec/toysh.test.sh
touch /tmp/compgen-default-test/spec/type-compat.test.sh
cd /tmp/compgen-default-test
compgen -o default spec/t | sort
## STDOUT:
spec/temp-binding.test.sh
spec/testdata
spec/tilde.test.sh
spec/toysh-posix.test.sh
spec/toysh.test.sh
spec/type-compat.test.sh
## END

#### compgen doesn't respect -X for user-defined functions
# Test that -X filter works with -F callback
shopt -s extglob
fun() {
  COMPREPLY=(one two three bin)
}
compgen -X "@(two|bin)" -F fun
echo --
compgen -X "!@(two|bin)" -F fun
## STDOUT:
one
three
--
two
bin
## END

#### compgen -W words -X filter
# Extglob patterns work in compgen -X filter
shopt -s extglob
compgen -X '@(two|bin)' -W 'one two three bin'
## STDOUT:
one
three
## END

#### compgen -f -X filter -- $cur
# Negated extglob filter: keep only files matching *.py
shopt -s extglob
cd $TMP
touch spam.py spam.sh
compgen -f -- sp | sort
echo --
compgen -f -X '!*.@(py)' -- sp
## STDOUT:
spam.py
spam.sh
--
spam.py
## END

#### compgen doesn't need shell quoting
# There is an obsolete comment in bash_completion that claims the opposite.
cd $TMP
touch 'foo bar'
touch "foo'bar"
compgen -f "foo b"
compgen -f "foo'"
## STDOUT:
foo bar
foo'bar
## END

#### compgen -W 'one two three'
# Create test structure inline - needs vendor directory
mkdir -p /tmp/compgen-w-test/vendor
cd /tmp/compgen-w-test
compgen -W 'one two three'
echo --
compgen -W 'v1 v2 three' -A directory v
echo --
compgen -A directory -W 'v1 v2 three' v  # order doesn't matter
## STDOUT:
one
two
three
--
vendor
v1
v2
--
vendor
v1
v2
## END

#### compgen -W evaluates code in $()
IFS=':%'
compgen -W '$(echo "spam:eggs%ham cheese")'
## STDOUT:
spam
eggs
ham cheese
## END

#### compgen -W uses IFS, and delimiters are escaped with \
IFS=':%'
compgen -W 'spam:eggs%ham cheese\:colon'
## STDOUT:
spam
eggs
ham cheese:colon
## END

#### Parse errors for compgen -W and complete -W
# bash doesn't detect as many errors because it lacks static parsing.
compgen -W '${'
echo status=$?
complete -W '${' foo
echo status=$?
## STDOUT:
status=2
status=2
## END
## BUG bash STDOUT:
status=1
status=0
## END

#### Runtime errors for compgen -W
compgen -W 'foo $(( 1 / 0 )) bar'
echo status=$?
## STDOUT:
status=1
## END

#### Runtime errors for compgen -F func
_foo() {
  COMPREPLY=( foo bar )
  COMPREPLY+=( $(( 1 / 0 )) )  # FATAL, but we still have candidates
}
compgen -F _foo foo
echo status=$?
## STDOUT:
status=1
## END

#### compgen -W '' cmd is not a usage error
# Bug fix due to '' being falsey in Python
compgen -W '' -- foo
echo status=$?
## stdout: status=1

#### compgen -A builtin
compgen -A builtin g
## STDOUT:
getopts
## END

#### complete -C vs. compgen -C
f() { echo foo; echo bar; }

# Bash prints warnings: -C option may not work as you expect
#                       -F option may not work as you expect
#
# https://unix.stackexchange.com/questions/117987/compgen-warning-c-option-not-working-as-i-expected
#
# compexport fixes this problem, because it invokves ShellFuncAction, whcih
# sets COMP_ARGV, COMP_WORDS, etc.
#
# Should we print a warning?

compgen -C f b
echo compgen=$?

complete -C f b
echo complete=$?

## STDOUT:
foo
bar
compgen=0
complete=0
## END


#### compadjust with empty COMP_ARGV
## SKIP (unimplementable): compadjust is OSH-specific
case $SH in bash) exit ;; esac

COMP_ARGV=()
compadjust words
argv.py "${words[@]}"

## STDOUT:
[]
## END

## N-I bash STDOUT:
## END


#### compadjust with sparse COMP_ARGV
## SKIP (unimplementable): compadjust is OSH-specific
case $SH in bash) exit ;; esac

COMP_ARGV=({0..9})
unset -v 'COMP_ARGV['{1,3,4,6,7,8}']'
compadjust words
argv.py "${words[@]}"

## STDOUT:
['0', '2', '5', '9']
## END

## N-I bash STDOUT:
## END


#### compgen -F with scalar COMPREPLY
_comp_cmd_test() {
  unset -v COMPREPLY
  COMPREPLY=hello
}
compgen -F _comp_cmd_test

## STDOUT:
hello
## END
