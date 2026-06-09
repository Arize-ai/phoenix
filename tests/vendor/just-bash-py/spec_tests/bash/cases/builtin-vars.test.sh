## oils_failures_allowed: 1
## compare_shells: dash bash-4.4 mksh zsh

# Tests for builtins having to do with variables: export, readonly, unset, etc.
#
# Also see assign.test.sh.

#### Export sets a global variable
# Even after you do export -n, it still exists.
f() { export GLOBAL=X; }
f
echo $GLOBAL
printenv.py GLOBAL
## STDOUT:
X
X
## END

#### Export sets a global variable that persists after export -n
f() { export GLOBAL=X; }
f
echo $GLOBAL
printenv.py GLOBAL
export -n GLOBAL
echo $GLOBAL
printenv.py GLOBAL
## STDOUT: 
X
X
X
None
## END
## N-I mksh/dash STDOUT:
X
X
## END
## N-I mksh status: 1
## N-I dash status: 2
## N-I zsh STDOUT:
X
X
X
X
## END

#### export -n undefined is ignored
set -o errexit
export -n undef
echo status=$?
## stdout: status=0
## N-I mksh/dash/zsh stdout-json: ""
## N-I mksh status: 1
## N-I dash status: 2
## N-I zsh status: 1

#### export -n foo=bar not allowed
foo=old
export -n foo=new
echo status=$?
echo $foo
## STDOUT:
status=2
old
## END
## OK bash STDOUT:
status=0
new
## END
## N-I zsh STDOUT:
status=1
old
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### Export a global variable and unset it
f() { export GLOBAL=X; }
f
echo $GLOBAL
printenv.py GLOBAL
unset GLOBAL
echo g=$GLOBAL
printenv.py GLOBAL
## STDOUT: 
X
X
g=
None
## END

#### Export existing global variables
G1=g1
G2=g2
export G1 G2
printenv.py G1 G2
## STDOUT: 
g1
g2
## END

#### Export existing local variable
f() {
  local L1=local1
  export L1
  printenv.py L1
}
f
printenv.py L1
## STDOUT: 
local1
None
## END

#### Export a local that shadows a global
V=global
f() {
  local V=local1
  export V
  printenv.py V
}
f
printenv.py V  # exported local out of scope; global isn't exported yet
export V
printenv.py V  # now it's exported
## STDOUT: 
local1
None
global
## END

#### Export a variable before defining it
export U
U=u
printenv.py U
## stdout: u

#### Unset exported variable, then define it again.  It's NOT still exported.
export U
U=u
printenv.py U
unset U
printenv.py U
U=newvalue
echo $U
printenv.py U
## STDOUT:
u
None
newvalue
None
## END

#### Exporting a parent func variable (dynamic scope)
# The algorithm is to walk up the stack and export that one.
inner() {
  export outer_var
  echo "inner: $outer_var"
  printenv.py outer_var
}
outer() {
  local outer_var=X
  echo "before inner"
  printenv.py outer_var
  inner
  echo "after inner"
  printenv.py outer_var
}
outer
## STDOUT:
before inner
None
inner: X
X
after inner
X
## END

#### Dependent export setting
# FOO is not respected here either.
export FOO=foo v=$(printenv.py FOO)
echo "v=$v"
## stdout: v=None

#### Exporting a variable doesn't change it
old=$PATH
export PATH
new=$PATH
test "$old" = "$new" && echo "not changed"
## stdout: not changed

#### can't export array (strict_array)
## SKIP (unimplementable): shopt strict_array not implemented (OSH-specific, not standard bash)
shopt -s strict_array

typeset -a a
a=(1 2 3)

export a
printenv.py a
## STDOUT:
None
## END
## BUG mksh STDOUT:
1
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## OK osh status: 1
## OK osh stdout-json: ""

#### can't export associative array (strict_array)
## SKIP (unimplementable): shopt strict_array not implemented (OSH-specific, not standard bash)
shopt -s strict_array

typeset -A a
a["foo"]=bar

export a
printenv.py a
## STDOUT:
None
## END
## N-I mksh status: 1
## N-I mksh stdout-json: ""
## OK osh status: 1
## OK osh stdout-json: ""

#### assign to readonly variable
# bash doesn't abort unless errexit!
readonly foo=bar
foo=eggs
echo "status=$?"  # nothing happens
## stdout-json: ""
## status: 1
## BUG bash stdout: status=1
## BUG bash status: 0
## OK dash/mksh status: 2

#### Make an existing local variable readonly
f() {
	local x=local
	readonly x
	echo $x
	eval 'x=bar'  # Wrap in eval so it's not fatal
	echo status=$?
}
x=global
f
echo $x
## STDOUT:
local
status=1
global
## END
## OK dash STDOUT:
local
## END
## OK dash status: 2
# just-bash treats readonly assignment as fatal (matches dash)
## OK bash STDOUT:
local
## END
## OK bash status: 1

# mksh aborts the function, weird
## OK mksh STDOUT:
local
global
## END

#### assign to readonly variable - errexit
set -o errexit
readonly foo=bar
foo=eggs
echo "status=$?"  # nothing happens
## status: 1
## OK dash/mksh status: 2

#### Unset a variable
foo=bar
echo foo=$foo
unset foo
echo foo=$foo
## STDOUT:
foo=bar
foo=
## END

#### Unset exit status
V=123
unset V
echo status=$?
## stdout: status=0

#### Unset nonexistent variable
unset ZZZ
echo status=$?
## stdout: status=0

#### Unset readonly variable
# dash and zsh abort the whole program.   OSH doesn't?
readonly R=foo
unset R
echo status=$?
## status: 0
## stdout: status=1
## OK dash status: 2
## OK dash stdout-json: ""
## OK zsh status: 1
## OK zsh stdout-json: ""

#### Unset a function without -f
f() {
  echo foo
}
f
unset f
f
## stdout: foo
## status: 127
## N-I dash/mksh/zsh status: 0
## N-I dash/mksh/zsh STDOUT:
foo
foo
## END

#### Unset has dynamic scope
f() {
  unset foo
}
foo=bar
echo foo=$foo
f
echo foo=$foo
## STDOUT:
foo=bar
foo=
## END

#### Unset and scope (bug #653)
unlocal() { unset "$@"; }

level2() {
  local hello=yy

  echo level2=$hello
  unlocal hello
  echo level2=$hello
}

level1() {
  local hello=xx

  level2

  echo level1=$hello
  unlocal hello
  echo level1=$hello

  level2
}

hello=global
level1

# bash, mksh, yash agree here.
## STDOUT:
level2=yy
level2=xx
level1=xx
level1=global
level2=yy
level2=global
## END
## OK dash/ash/zsh STDOUT:
level2=yy
level2=
level1=xx
level1=
level2=yy
level2=
## END

#### unset of local reveals variable in higher scope

# OSH has a RARE behavior here (matching yash and mksh), but at least it's
# consistent.

x=global
f() {
  local x=foo
  echo x=$x
  unset x
  echo x=$x
}
f
## STDOUT:
x=foo
x=global
## END
## OK dash/bash/zsh/ash STDOUT:
x=foo
x=
## END

#### Unset invalid variable name
unset %
echo status=$?
## STDOUT:
status=1
## END
## OK osh STDOUT:
status=2
## END
## BUG zsh STDOUT:
status=0
## END
# dash does a hard failure!
## OK dash stdout-json: ""
## OK dash status: 2

#### Unset nonexistent variable
unset _nonexistent__
echo status=$?
## STDOUT:
status=0
## END

#### Unset -v
foo() {
  echo "function foo"
}
foo=bar
unset -v foo
echo foo=$foo
foo
## STDOUT: 
foo=
function foo
## END

#### Unset -f
foo() {
  echo "function foo"
}
foo=bar
unset -f foo
echo foo=$foo
foo
echo status=$?
## STDOUT: 
foo=bar
status=127
## END

#### Unset array member
a=(x y z)
unset 'a[1]'
echo status=$?
echo "${a[@]}" len="${#a[@]}"
## STDOUT:
status=0
x z len=2
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## OK zsh STDOUT:
status=0
 y z len=3
## END

#### Unset errors
unset undef
echo status=$?

a=(x y z)
unset 'a[99]'  # out of range
echo status=$?

unset 'not_array[99]'  # not an array
echo status=$?

## STDOUT:
status=0
status=0
status=0
## END
## N-I dash status: 2
## N-I dash STDOUT:
status=0
## END

#### Unset wrong type
case $SH in mksh) exit ;; esac

declare undef
unset -v 'undef[1]'
echo undef $?
unset -v 'undef["key"]'
echo undef $?

declare a=(one two)
unset -v 'a[1]'
echo array $?

#shopt -s strict_arith || true
# In OSH, the string 'key' is converted to an integer, which is 0, unless
# strict_arith is on, when it fails.
unset -v 'a["key"]'
echo array $?

declare -A A=(['key']=val)
unset -v 'A[1]'
echo assoc $?
unset -v 'A["key"]'
echo assoc $?

## STDOUT:
undef 1
undef 1
array 0
array 1
assoc 0
assoc 0
## END
## OK osh STDOUT:
undef 1
undef 1
array 0
array 0
assoc 0
assoc 0
## END
## BUG zsh STDOUT:
undef 0
undef 1
array 0
array 1
assoc 0
assoc 0
## END
## N-I dash/mksh stdout-json: ""
## N-I dash status: 2


#### unset -v assoc (related to issue #661)

case $SH in dash|mksh|zsh) return ;; esac

declare -A dict=()
key=1],a[1
dict["$key"]=foo
echo ${#dict[@]}
echo keys=${!dict[@]}
echo vals=${dict[@]}

unset -v 'dict["$key"]'
echo ${#dict[@]}
echo keys=${!dict[@]}
echo vals=${dict[@]}
## STDOUT:
1
keys=1],a[1
vals=foo
0
keys=
vals=
## END
## N-I dash/mksh/zsh stdout-json: ""

#### unset assoc errors

case $SH in dash|mksh) return ;; esac

declare -A assoc=(['key']=value)
unset 'assoc["nonexistent"]'
echo status=$?

## STDOUT:
status=0
## END
## N-I dash/mksh stdout-json: ""


#### Unset array member with dynamic parsing
i=1
a=(w x y z)
unset 'a[ i - 1 ]' a[i+1]  # note: can't have space between a and [
echo status=$?
echo "${a[@]}" len="${#a[@]}"
## STDOUT:
status=0
x z len=2
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## N-I zsh status: 1
## N-I zsh stdout-json: ""

#### Use local twice
f() {
  local foo=bar
  local foo
  echo $foo
}
f
## stdout: bar
## BUG zsh STDOUT:
foo=bar
bar
## END

#### Local without variable is still unset!
set -o nounset
f() {
  local foo
  echo "[$foo]"
}
f
## stdout-json: ""
## status: 1
## OK dash status: 2
# zsh doesn't support nounset?
## BUG zsh stdout: []
## BUG zsh status: 0

#### local after readonly
f() {
  readonly y
  local x=1 y=$(( x ))
  echo y=$y
}
f
echo y=$y
## status: 1
## stdout-json: ""

## OK dash status: 2

## BUG mksh status: 0
## BUG mksh STDOUT:
y=0
y=
## END

## BUG bash status: 0
## BUG bash STDOUT:
y=
y=
## END

#### unset a[-1] (bf.bash regression)
case $SH in dash|zsh) exit ;; esac

a=(1 2 3)
unset a[-1]
echo len=${#a[@]}

echo last=${a[-1]}
(( last = a[-1] ))
echo last=$last

(( a[-1] = 42 ))
echo "${a[@]}"

## STDOUT:
len=2
last=2
last=2
1 42
## END
## BUG mksh STDOUT:
len=3
last=
last=0
1 2 3 42
## END
## N-I dash/zsh stdout-json: ""


#### unset a[-1] in sparse array (bf.bash regression)
case $SH in dash|zsh) exit ;; esac

a=(0 1 2 3 4)
unset a[1]
unset a[4]
echo len=${#a[@]} a=${a[@]}
echo last=${a[-1]} second=${a[-2]} third=${a[-3]}

echo ---
unset a[3]
echo len=${#a[@]} a=${a[@]}
echo last=${a[-1]} second=${a[-2]} third=${a[-3]}

## STDOUT:
len=3 a=0 2 3
last=3 second=2 third=
---
len=2 a=0 2
last=2 second= third=0
## END

## BUG mksh STDOUT:
len=3 a=0 2 3
last= second= third=
---
len=2 a=0 2
last= second= third=
## END

## N-I dash/zsh stdout-json: ""

