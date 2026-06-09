## oils_failures_allowed: 0
## compare_shells: dash bash-4.4 mksh zsh

#### Env value doesn't persist
FOO=foo printenv.py FOO
echo -$FOO-
## STDOUT:
foo
--
## END

#### Env value with equals
FOO=foo=foo printenv.py FOO
## stdout: foo=foo

#### Env binding can use preceding bindings, but not subsequent ones
# This means that for ASSIGNMENT_WORD, on the RHS you invoke the parser again!
# Could be any kind of quoted string.
FOO="foo" BAR="[$FOO][$BAZ]" BAZ=baz printenv.py FOO BAR BAZ
## STDOUT:
foo
[foo][]
baz
## BUG mksh STDOUT:
foo
[][]
baz
## END

#### Env value with two quotes
FOO='foo'"adjacent" printenv.py FOO
## stdout: fooadjacent

#### Env value with escaped <
FOO=foo\<foo printenv.py FOO
## stdout: foo<foo

#### FOO=foo echo [foo]
FOO=foo echo "[$foo]"
## stdout: []

#### FOO=foo fun
fun() {
  echo "[$FOO]"
}
FOO=foo fun
## stdout: [foo]

#### Multiple temporary envs on the stack
g() {
  echo "$F" "$G1" "$G2"
  echo '--- g() ---'
  P=p printenv.py F G1 G2 A P
}
f() {
  # NOTE: G1 doesn't pick up binding f, but G2 picks up a.
  # I don't quite understand why this is, but bash and OSH agree!
  G1=[$f] G2=[$a] g
  echo '--- f() ---'
  printenv.py F G1 G2 A P
}
a=A
F=f f
## STDOUT:
f [] [A]
--- g() ---
f
[]
[A]
None
p
--- f() ---
f
None
None
None
None
## END
## OK mksh STDOUT:
# G1 and G2 somehow persist.  I think that is a bug.  They should be local to
# the G call.
f [] [A]
--- g() ---
f
[]
[A]
None
p
--- f() ---
f
[]
[A]
None
None
## END
## BUG dash STDOUT:
# dash sets even less stuff.  Doesn't appear correct.
f [] [A]
--- g() ---
None
None
None
None
p
--- f() ---
None
None
None
None
None
## END

#### Escaped = in command name
## SKIP (unimplementable): Requires external file from Oils project
# foo=bar is in the 'spec/bin' dir.
foo\=bar
## stdout: HI

#### Env binding not allowed before compound command
# bash gives exit code 2 for syntax error, because of 'do'.
# dash gives 0 because there is stuff after for?  Should really give an error.
# mksh gives acceptable error of 1.
FOO=bar for i in a b; do printenv.py $FOO; done
## status: 2
## OK mksh/zsh status: 1

#### Trying to run keyword 'for'
FOO=bar for
## status: 127
## OK zsh status: 1

#### Empty env binding
EMPTY= printenv.py EMPTY
## stdout:

#### Assignment doesn't do word splitting
words='one two'
a=$words
argv.py "$a"
## stdout: ['one two']

#### Assignment doesn't do glob expansion
touch _tmp/z.Z _tmp/zz.Z
a=_tmp/*.Z
argv.py "$a"
## stdout: ['_tmp/*.Z']

#### Env binding in readonly/declare is NOT exported!  (pitfall)
# All shells agree on this, but it's very confusing behavior.
FOO=foo readonly v=$(printenv.py FOO)
echo "v=$v"

# bash has probems here:
FOO=foo readonly v2=$FOO
echo "v2=$v2"

## STDOUT:
v=None
v2=foo
## END
## BUG bash STDOUT:
v=None
v2=
## END

#### assignments / array assignments not interpreted after 'echo'
a=1 echo b[0]=2 c=3
## stdout: b[0]=2 c=3
# zsh interprets [0] as some kind of glob
## OK zsh stdout-json: ""
## OK zsh status: 1

#### dynamic local variables (and splitting)
f() {
  local "$1"  # Only x is assigned here
  echo x=\'$x\'
  echo a=\'$a\'

  local $1  # x and a are assigned here
  echo x=\'$x\'
  echo a=\'$a\'
}
f 'x=y a=b'
## OK dash/bash/mksh STDOUT:
x='y a=b'
a=''
x='y'
a='b'
## END
# osh and zsh don't do word splitting
## STDOUT:
x='y a=b'
a=''
x='y a=b'
a=''
## END

#### readonly x= gives empty string (regression)
readonly x=
argv.py "$x"
## STDOUT:
['']
## END

#### 'local x' does not set variable
set -o nounset
f() {
  local x
  echo $x
}
f
## status: 1
## OK dash status: 2
## BUG zsh status: 0

#### 'local -a x' does not set variable
set -o nounset
f() {
  local -a x
  echo $x
}
f
## status: 1
## OK dash status: 2
## BUG zsh status: 0

#### 'local x' and then array assignment
f() {
  local x
  x[3]=foo
  echo ${x[3]}
}
f
## status: 0
## stdout: foo
## N-I dash status: 2
## N-I dash stdout-json: ""
## BUG zsh stdout: o

#### 'declare -A' and then dict assignment
declare -A foo
key=bar
foo["$key"]=value
echo ${foo["bar"]}
## status: 0
## stdout: value
## N-I dash status: 2
## N-I dash stdout-json: ""
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### declare in an if statement
# bug caught by my feature detection snippet in bash-completion
if ! foo=bar; then
  echo BAD
fi
echo $foo
if ! eval 'spam=eggs'; then
  echo BAD
fi
echo $spam
## STDOUT:
bar
eggs
## END


#### Modify a temporary binding
# (regression for bug found by Michael Greenberg)
f() {
  echo "x before = $x"
  x=$((x+1))
  echo "x after  = $x"
}
x=5 f
## STDOUT:
x before = 5
x after  = 6
## END

#### Reveal existence of "temp frame" (All shells disagree here!!!)
f() {
  echo "x=$x"

  x=mutated-temp  # mutate temp frame
  echo "x=$x"

  # Declare a new local
  local x='local'
  echo "x=$x"

  # Unset it
  unset x
  echo "x=$x"
}

x=global
x=temp-binding f
echo "x=$x"

## STDOUT:
x=temp-binding
x=mutated-temp
x=local
x=mutated-temp
x=global
## END
## OK dash/zsh STDOUT:
x=temp-binding
x=mutated-temp
x=local
x=
x=global
## END
## BUG bash STDOUT:
x=temp-binding
x=mutated-temp
x=local
x=global
x=global
## END
## BUG mksh STDOUT:
x=temp-binding
x=mutated-temp
x=local
x=mutated-temp
x=mutated-temp
## END
## BUG yash STDOUT:
# yash has no locals
x=temp-binding
x=mutated-temp
x=mutated-temp
x=
x=
## END

#### Test above without 'local' (which is not POSIX)
f() {
  echo "x=$x"

  x=mutated-temp  # mutate temp frame
  echo "x=$x"

  # Unset it
  unset x
  echo "x=$x"
}

x=global
x=temp-binding f
echo "x=$x"

## OK dash/zsh STDOUT:
x=temp-binding
x=mutated-temp
x=
x=global
## END
## BUG mksh/yash STDOUT:
x=temp-binding
x=mutated-temp
x=
x=
## END
## STDOUT:
x=temp-binding
x=mutated-temp
x=global
x=global
## END

#### Using ${x-default} after unsetting local shadowing a global
f() {
  echo "x=$x"
  local x='local'
  echo "x=$x"
  unset x
  echo "- operator = ${x-default}"
  echo ":- operator = ${x:-default}"
}
x=global
f
## OK dash/bash/zsh STDOUT:
x=global
x=local
- operator = default
:- operator = default
## END
## STDOUT:
x=global
x=local
- operator = global
:- operator = global
## END

#### Using ${x-default} after unsetting a temp binding shadowing a global
f() {
  echo "x=$x"
  local x='local'
  echo "x=$x"
  unset x
  echo "- operator = ${x-default}"
  echo ":- operator = ${x:-default}"
}
x=global
x=temp-binding f
## OK dash/zsh STDOUT:
x=temp-binding
x=local
- operator = default
:- operator = default
## END
## STDOUT:
x=temp-binding
x=local
- operator = temp-binding
:- operator = temp-binding
## END
## BUG bash STDOUT:
x=temp-binding
x=local
- operator = global
:- operator = global
## END

#### static assignment doesn't split
words='a b c'
export ex=$words
glo=$words
readonly ro=$words
argv.py "$ex" "$glo" "$ro"

## STDOUT:
['a b c', 'a b c', 'a b c']
## END
## BUG dash STDOUT:
['a', 'a b c', 'a']
## END


#### aliased assignment doesn't split
shopt -s expand_aliases || true
words='a b c'
alias e=export
alias r=readonly
e ex=$words
r ro=$words
argv.py "$ex" "$ro"
## BUG dash STDOUT:
['a', 'a']
## END
## STDOUT:
['a b c', 'a b c']
## END


#### assignment using dynamic keyword (splits in most shells, not in zsh/osh)
words='a b c'
e=export
r=readonly
$e ex=$words
$r ro=$words
argv.py "$ex" "$ro"

# zsh and OSH are smart
## STDOUT:
['a b c', 'a b c']
## END

## OK dash/bash/mksh STDOUT:
['a', 'a']
## END


#### assignment using dynamic var names doesn't split
words='a b c'
arg_ex=ex=$words
arg_ro=ro=$words

# no quotes, this is split of course
export $arg_ex
readonly $arg_ro

argv.py "$ex" "$ro"

arg_ex2=ex2=$words
arg_ro2=ro2=$words

# quotes, no splitting
export "$arg_ex2"
readonly "$arg_ro2"

argv.py "$ex2" "$ro2"

## STDOUT:
['a b c', 'a b c']
['a b c', 'a b c']
## END
## OK dash/bash/mksh STDOUT:
['a', 'a']
['a b c', 'a b c']
## END

#### assign and glob
cd $TMP
touch foo=a foo=b
foo=*
argv.py "$foo"
unset foo

export foo=*
argv.py "$foo"
unset foo

## STDOUT:
['*']
['*']
## END
## BUG dash STDOUT:
['*']
['b']
## END

#### declare and glob
cd $TMP
touch foo=a foo=b
typeset foo=*
argv.py "$foo"
unset foo
## STDOUT:
['*']
## END
## N-I dash STDOUT:
['']
## END

#### readonly $x where x='b c'
one=a
two='b c'
readonly $two $one
a=new
echo status=$?
b=new
echo status=$?
c=new
echo status=$?

# in OSH and zsh, this is an invalid variable name
## status: 1
## stdout-json: ""

# most shells make two variable read-only

## OK dash/mksh status: 2
## OK bash status: 0
## OK bash STDOUT:
status=1
status=1
status=1
## END

#### readonly a=(1 2) no_value c=(3 4) makes 'no_value' readonly
readonly a=(1 2) no_value c=(3 4)
no_value=x
## status: 1
## stdout-json: ""
## OK dash status: 2

#### export a=1 no_value c=2
no_value=foo
export a=1 no_value c=2
printenv.py no_value
## STDOUT:
foo
## END

#### local a=loc $var c=loc
var='b'
b=global
echo $b
f() {
  local a=loc $var c=loc
  argv.py "$a" "$b" "$c"
}
f
## STDOUT:
global
['loc', '', 'loc']
## END
## BUG dash STDOUT:
global
['loc', 'global', 'loc']
## END

#### redirect after assignment builtin (eval redirects after evaluating arguments)
# See also: spec/redir-order.test.sh (#2307)
# The $(stdout_stderr.py) is evaluated *before* the 2>/dev/null redirection

readonly x=$(stdout_stderr.py) 2>/dev/null
echo done
## STDOUT:
done
## END
## STDERR:
STDERR
## END
## BUG zsh stderr-json: ""

#### redirect after command sub (like case above but without assignment builtin)
echo stdout=$(stdout_stderr.py) 2>/dev/null
## STDOUT:
stdout=STDOUT
## END
## STDERR:
STDERR
## END

#### redirect after bare assignment
x=$(stdout_stderr.py) 2>/dev/null
echo done
## STDOUT:
done
## END
## stderr-json: ""
## BUG bash STDERR:
STDERR
## END

#### redirect after declare -p
case $SH in *dash) exit 99 ;; esac  # stderr unpredictable

foo=bar
typeset -p foo 1>&2

# zsh and mksh agree on exact output, which we don't really care about
## STDERR:
typeset foo=bar
## END
## OK bash STDERR:
declare -- foo="bar"
## END
## OK osh STDERR:
declare -- foo=bar
## END
## N-I dash status: 99
## N-I dash stderr-json: ""
## stdout-json: ""

#### declare -a arr does not remove existing arrays (OSH regression)
case $SH in dash) exit 99 ;; esac # dash does not support arrays

declare -a arr
arr=(foo bar baz)
declare -a arr
echo arr:${#arr[@]}
## STDOUT:
arr:3
## END
## N-I dash status: 99
## N-I dash stdout-json: ""

#### declare -A dict does not remove existing arrays (OSH regression)
case $SH in dash|mksh) exit 99 ;; esac # dash/mksh does not support associative arrays

declare -A dict
dict['foo']=hello
dict['bar']=oil
dict['baz']=world
declare -A dict
echo dict:${#dict[@]}
## STDOUT:
dict:3
## END
## N-I dash/mksh status: 99
## N-I dash/mksh stdout-json: ""

#### "readonly -a arr" and "readonly -A dict" should not not remove existing arrays
# mksh's readonly does not support the -a option.
# dash/mksh does not support associative arrays.
case $SH in dash|mksh) exit 99 ;; esac

declare -a arr
arr=(foo bar baz)
declare -A dict
dict['foo']=hello
dict['bar']=oil
dict['baz']=world

readonly -a arr
echo arr:${#arr[@]}
readonly -A dict
echo dict:${#dict[@]}
## STDOUT:
arr:3
dict:3
## END
## N-I dash/mksh status: 99
## N-I dash/mksh stdout-json: ""

#### "declare -a arr" and "readonly -a a" creates an empty array (OSH)
case $SH in dash|mksh) exit 99 ;; esac # dash/mksh does not support associative arrays

declare -a arr1
readonly -a arr2
declare -A dict1
readonly -A dict2

declare -p arr1 arr2 dict1 dict2
## STDOUT:
declare -a arr1=()
declare -ra arr2=()
declare -A dict1=()
declare -rA dict2=()
## END
## N-I bash STDOUT:
declare -a arr1
declare -r arr2
declare -A dict1
declare -r dict2
## END
## OK zsh STDOUT:
typeset -a arr1
arr1=(  )
typeset -a arr2
arr2=(  )
typeset -ar arr2
typeset -A dict1
dict1=( )
typeset -a dict2
dict2=( )
typeset -Ar dict2
## END
## N-I dash/mksh status: 99
## N-I dash/mksh stdout-json: ""

## YSH-specific test - commented out
# #### "var d = {}; declare -p d" does not print anything (OSH)
# case $SH in bash-4.4|dash|mksh|zsh) exit 99 ;; esac
#
# # We pretend that the variable does not exist when the variable is not
# # representable with the "declare -p" format.
#
# var d = {}
# declare -p d
# ## STDOUT:
# ## END
# ## status: 1
# ## N-I bash/dash/mksh/zsh status: 99

#### readonly array should not be modified by a+=(1)
case $SH in dash) exit 99 ;; esac # dash/mksh does not support associative arrays

a=(1 2 3)
readonly -a a
eval 'a+=(4)'
argv.py "${a[@]}"
eval 'declare -n r=a; r+=(4)'
argv.py "${a[@]}"

## STDOUT:
['1', '2', '3']
['1', '2', '3']
## END
## OK mksh status: 1
## OK mksh stdout-json: ""
# just-bash treats readonly assignment as fatal (matches mksh)
## OK bash status: 1
## OK bash stdout-json: ""
## N-I dash status: 99
## N-I dash stdout-json: ""
