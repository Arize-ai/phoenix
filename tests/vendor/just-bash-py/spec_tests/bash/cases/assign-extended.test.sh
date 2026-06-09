## compare_shells: bash-4.4 mksh
## oils_failures_allowed: 1

# note: some of these pass with AT&T ksh

# Extended assignment language, e.g. typeset, declare, arrays, etc.
# Things that dash doesn't support.

#### local -a
# nixpkgs setup.sh uses this (issue #26)
f() {
  local -a array=(x y z)
  argv.py "${array[@]}"
}
f
## stdout: ['x', 'y', 'z']
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### declare -a
# nixpkgs setup.sh uses this (issue #26)
declare -a array=(x y z)
argv.py "${array[@]}"
## stdout: ['x', 'y', 'z']
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### declare -f exit code indicates function existence
func2=x  # var names are NOT found
declare -f myfunc func2
echo $?

myfunc() { echo myfunc; }
declare -f myfunc func2 > /dev/null
echo $?

func2() { echo func2; }
declare -f myfunc func2 > /dev/null
echo $?
## STDOUT:
1
1
0
## END
## N-I mksh STDOUT:
127
127
127
## END

#### declare -F prints function names
add () { expr 4 + 4; }
div () { expr 6 / 2; }
ek () { echo hello; }
__ec () { echo hi; }
_ab () { expr 10 % 3; }

declare -F
## STDOUT:
declare -f __ec
declare -f _ab
declare -f add
declare -f div
declare -f ek
## END
## N-I mksh stdout-json: ""
## N-I mksh status: 127

#### declare -F with shopt -s extdebug prints more info
## SKIP (unimplementable): extdebug not implemented

#### declare -F with shopt -s extdebug and main file
## SKIP (unimplementable): extdebug not implemented

#### declare -p var (exit status)
var1() { echo func; }  # function names are NOT found.
declare -p var1 var2 >/dev/null
echo $?

var1=x
declare -p var1 var2 >/dev/null
echo $?

var2=y
declare -p var1 var2 >/dev/null
echo $?
## STDOUT:
1
1
0
## N-I mksh STDOUT:
127
127
127
## END

#### declare
test_var1=111
readonly test_var2=222
export test_var3=333
declare -n test_var4=test_var1
f1() {
  local test_var5=555
  {
    echo '[declare]'
    declare
    echo '[readonly]'
    readonly
    echo '[export]'
    export
    echo '[local]'
    local
  } | grep -E '^\[|^\b.*test_var.\b'
}
f1
## STDOUT:
[declare]
test_var1=111
test_var2=222
test_var3=333
test_var4=test_var1
test_var5=555
[readonly]
declare -r test_var2=222
[export]
declare -x test_var3=333
[local]
test_var5=555
## END
## OK bash STDOUT:
[declare]
test_var1=111
test_var2=222
test_var3=333
test_var4=test_var1
test_var5=555
[readonly]
declare -r test_var2="222"
[export]
declare -x test_var3="333"
[local]
test_var5=555
## END
## N-I mksh STDOUT:
[declare]
[readonly]
test_var2
[export]
test_var3
[local]
typeset test_var1
typeset -r test_var2
typeset -x test_var3
typeset test_var5
## END

#### declare -p
# BUG: bash doesn't output flags with "local -p", which seems to contradict
#   with manual.
test_var1=111
readonly test_var2=222
export test_var3=333
declare -n test_var4=test_var1
f1() {
  local test_var5=555
  {
    echo '[declare]'
    declare -p
    echo '[readonly]'
    readonly -p
    echo '[export]'
    export -p
    echo '[local]'
    local -p
  } | grep -E '^\[|^\b.*test_var.\b'
}
f1
## STDOUT:
[declare]
declare -- test_var1=111
declare -r test_var2=222
declare -x test_var3=333
declare -n test_var4=test_var1
declare -- test_var5=555
[readonly]
declare -r test_var2=222
[export]
declare -x test_var3=333
[local]
declare -- test_var5=555
## END
## BUG bash STDOUT:
[declare]
declare -- test_var1="111"
declare -r test_var2="222"
declare -x test_var3="333"
declare -n test_var4="test_var1"
declare -- test_var5="555"
[readonly]
declare -r test_var2="222"
[export]
declare -x test_var3="333"
[local]
test_var5=555
## END
## N-I mksh STDOUT:
[declare]
[readonly]
readonly test_var2=222
[export]
export test_var3=333
[local]
typeset test_var1=111
typeset -r test_var2=222
typeset -x test_var3=333
typeset test_var5=555
## END

#### declare -p doesn't print binary data, but can be loaded into bash

# bash prints binary data!
case $SH in bash*|mksh) exit ;; esac

unquoted='foo'
sq='foo bar'
bash1=$'\x1f'  # ASCII control char
bash2=$'\xfe\xff'  # Invalid UTF-8

s1=$unquoted
s2=$sq
s3=$bash1
s4=$bash2

declare -a a=("$unquoted" "$sq" "$bash1" "$bash2")
declare -A A=(["$unquoted"]="$sq" ["$bash1"]="$bash2")

#echo lengths ${#s1} ${#s2} ${#s3} ${#s4} ${#a[@]} ${#A[@]}

declare -p s1 s2 s3 s4 a A | tee tmp.bash

echo ---

bash -c 'source tmp.bash; echo "$s1 $s2"; echo -n "$s3" "$s4" | od -A n -t x1'
echo bash=$?

## STDOUT:
declare -- s1=foo
declare -- s2='foo bar'
declare -- s3=$'\u001f'
declare -- s4=$'\xfe\xff'
declare -a a=(foo 'foo bar' $'\u001f' $'\xfe\xff')
declare -A A=([$'\u001f']=$'\xfe\xff' ['foo']='foo bar')
---
foo foo bar
 1f 20 fe ff
bash=0
## END

## N-I bash/mksh STDOUT:
## END



#### declare -p var
# BUG? bash doesn't output anything for 'local/readonly -p var', which seems to
#   contradict with manual.  Besides, 'export -p var' is not described in
#   manual
test_var1=111
readonly test_var2=222
export test_var3=333
declare -n test_var4=test_var1
f1() {
  local test_var5=555
  {
    echo '[declare]'
    declare -p test_var{0..5}
    echo '[readonly]'
    readonly -p test_var{0..5}
    echo '[export]'
    export -p test_var{0..5}
    echo '[local]'
    local -p test_var{0..5}
  } | grep -E '^\[|^\b.*test_var.\b'
}
f1
## STDOUT:
[declare]
declare -- test_var1=111
declare -r test_var2=222
declare -x test_var3=333
declare -n test_var4=test_var1
declare -- test_var5=555
[readonly]
declare -r test_var2=222
[export]
declare -x test_var3=333
[local]
declare -- test_var5=555
## END
## BUG bash STDOUT:
[declare]
declare -- test_var1="111"
declare -r test_var2="222"
declare -x test_var3="333"
declare -n test_var4="test_var1"
declare -- test_var5="555"
[readonly]
[export]
[local]
## END
## N-I mksh STDOUT:
[declare]
[readonly]
## END

#### declare -p arr
test_arr1=()
declare -a test_arr2=()
declare -A test_arr3=()
test_arr4=(1 2 3)
declare -a test_arr5=(1 2 3)
declare -A test_arr6=(['a']=1 ['b']=2 ['c']=3)
test_arr7=()
test_arr7[3]=foo
declare -p test_arr{1..7}
## STDOUT:
declare -a test_arr1=()
declare -a test_arr2=()
declare -A test_arr3=()
declare -a test_arr4=(1 2 3)
declare -a test_arr5=(1 2 3)
declare -A test_arr6=(['a']=1 ['b']=2 ['c']=3)
declare -a test_arr7=([3]=foo)
## END
## OK bash STDOUT:
declare -a test_arr1=()
declare -a test_arr2=()
declare -A test_arr3=()
declare -a test_arr4=([0]="1" [1]="2" [2]="3")
declare -a test_arr5=([0]="1" [1]="2" [2]="3")
declare -A test_arr6=([a]="1" [b]="2" [c]="3" )
declare -a test_arr7=([3]="foo")
## END

## OK bash-2 STDOUT:
declare -a test_arr1=()
declare -a test_arr2=()
declare -A test_arr3=()
declare -a test_arr4=([0]="1" [1]="2" [2]="3")
declare -a test_arr5=([0]="1" [1]="2" [2]="3")
declare -A test_arr6=(['a']=1 ['b']=2 ['c']=3)
declare -a test_arr7=([3]="foo")
## END
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### declare -p foo=bar doesn't make sense
case $SH in mksh) exit 0 ;; esac

declare -p foo=bar
echo status=$?

a=b
declare -p a foo=bar > tmp.txt
echo status=$?
sed 's/"//g' tmp.txt  # don't care about quotes
## STDOUT:
status=1
status=1
declare -- a=b
## END
## N-I mksh stdout-json: ""

#### declare -pnrx
test_var1=111
readonly test_var2=222
export test_var3=333
declare -n test_var4=test_var1
f1() {
  local test_var5=555
  {
    echo '[declare -pn]'
    declare -pn
    echo '[declare -pr]'
    declare -pr
    echo '[declare -px]'
    declare -px
  } | grep -E '^\[|^\b.*test_var.\b'
}
f1
## STDOUT:
[declare -pn]
declare -n test_var4=test_var1
[declare -pr]
declare -r test_var2=222
[declare -px]
declare -x test_var3=333
## END
## OK bash STDOUT:
[declare -pn]
declare -n test_var4="test_var1"
[declare -pr]
declare -r test_var2="222"
[declare -px]
declare -x test_var3="333"
## END
## N-I mksh STDOUT:
[declare -pn]
[declare -pr]
[declare -px]
## END

#### declare -paA
declare -a test_var6=()
declare -A test_var7=()
f1() {
  {
    echo '[declare -pa]'
    declare -pa
    echo '[declare -pA]'
    declare -pA
  } | grep -E '^\[|^\b.*test_var.\b'
}
f1
## STDOUT:
[declare -pa]
declare -a test_var6=()
[declare -pA]
declare -A test_var7=()
## END
## OK bash STDOUT:
[declare -pa]
declare -a test_var6=()
[declare -pA]
declare -A test_var7=()
## END
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### declare -pnrx var
# Note: Bash ignores other flags (-nrx) when variable names are supplied while
#   OSH uses other flags to select variables.  Bash's behavior is documented.
test_var1=111
readonly test_var2=222
export test_var3=333
declare -n test_var4=test_var1
f1() {
  local test_var5=555
  {
    echo '[declare -pn]'
    declare -pn test_var{0..5}
    echo '[declare -pr]'
    declare -pr test_var{0..5}
    echo '[declare -px]'
    declare -px test_var{0..5}
  } | grep -E '^\[|^\b.*test_var.\b'
}
f1
## STDOUT:
[declare -pn]
declare -n test_var4=test_var1
[declare -pr]
declare -r test_var2=222
[declare -px]
declare -x test_var3=333
## END
## N-I bash STDOUT:
[declare -pn]
declare -- test_var1="111"
declare -r test_var2="222"
declare -x test_var3="333"
declare -n test_var4="test_var1"
declare -- test_var5="555"
[declare -pr]
declare -- test_var1="111"
declare -r test_var2="222"
declare -x test_var3="333"
declare -n test_var4="test_var1"
declare -- test_var5="555"
[declare -px]
declare -- test_var1="111"
declare -r test_var2="222"
declare -x test_var3="333"
declare -n test_var4="test_var1"
declare -- test_var5="555"
## END
## N-I mksh STDOUT:
[declare -pn]
[declare -pr]
[declare -px]
## END

#### declare -pg
test_var1=global
f1() {
  local test_var1=local
  {
    declare -pg
  } | grep -E '^\[|^\b[^"]*test_var.\b'
}
f1
## STDOUT:
declare -- test_var1=global
## END
## N-I bash STDOUT:
declare -- test_var1="local"
## END
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### declare -pg var
test_var1=global
f1() {
  local test_var1=local
  {
    declare -pg test_var1
  } | grep -E '^\[|^\b.*test_var.\b'
}
f1
## STDOUT:
declare -- test_var1=global
## END
## N-I bash STDOUT:
declare -- test_var1="local"
## END
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### ble.sh: eval -- "$(declare -p var arr)"
# This illustrates an example usage of "eval & declare" for exporting
# multiple variables from $().
eval -- "$(
  printf '%s\n' a{1..10} | {
    sum=0 i=0 arr=()
    while read line; do
      ((sum+=${#line},i++))
      arr[$((i/3))]=$line
    done
    declare -p sum arr
  })"
echo sum=$sum
for ((i=0;i<${#arr[@]};i++)); do
  echo "arr[$i]=${arr[i]}"
done
## STDOUT:
sum=21
arr[0]=a2
arr[1]=a5
arr[2]=a8
arr[3]=a10
## END
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### declare -p and value.Undef
# This is a regression for a crash
# But actually there is also an incompatibility -- we don't print anything

declare x
declare -p x

function f { local x; declare -p x; }
x=1
f

## STDOUT:
declare -- x
declare -- x
## END

## N-I mksh status: 127
## N-I mksh STDOUT:
## END

#### eval -- "$(declare -p arr)" (restore arrays w/ unset elements)
arr=(1 2 3)
eval -- "$(arr=(); arr[3]= arr[4]=foo; declare -p arr)"
for i in {0..4}; do
  echo "arr[$i]: ${arr[$i]+set ... [}${arr[$i]-unset}${arr[$i]+]}"
done
## STDOUT:
arr[0]: unset
arr[1]: unset
arr[2]: unset
arr[3]: set ... []
arr[4]: set ... [foo]
## END
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### declare -p UNDEF (and typeset) -- prints something to stderr

x=42
readonly x
export x

declare -p x undef1 undef2 2> de

typeset -p x undef1 undef2 2> ty

# readonly -p and export -p don't accept args!  They only print all
#
# These do not accept args
# readonly -p x undef1 undef2 2> re
# export -p x undef1 undef2 2> ex

f() {
  # it behaves weird with x
  #local -p undef1 undef2 2>lo
  local -p a b b>lo
  #local -p x undef1 undef2 2> lo
}
# local behaves differently in bash 4.4 and bash 5, not specifying now
# f
# files='de ty lo'

files='de ty'

wc -l $files
#cat $files

## STDOUT:
declare -rx x="42"
declare -rx x="42"
  2 de
  2 ty
  4 total
## END

## OK osh STDOUT:
declare -rx x=42
declare -rx x=42
  2 de
  2 ty
  4 total
## END

## N-I mksh STDOUT:
typeset -x -r x=42
 1 de
 0 ty
 1 total
## END


#### typeset -f 
# mksh implement typeset but not declare
typeset  -f myfunc func2
echo $?

myfunc() { echo myfunc; }
# This prints the source code.
typeset  -f myfunc func2 > /dev/null
echo $?

func2() { echo func2; }
typeset  -f myfunc func2 > /dev/null
echo $?
## STDOUT:
1
1
0
## END

#### typeset -p 
var1() { echo func; }  # function names are NOT found.
typeset -p var1 var2 >/dev/null
echo $?

var1=x
typeset -p var1 var2 >/dev/null
echo $?

var2=y
typeset -p var1 var2 >/dev/null
echo $?
## STDOUT:
1
1
0
## BUG mksh STDOUT:
# mksh doesn't respect exit codes
0
0
0
## END

#### typeset -r makes a string readonly
typeset -r s1='12'
typeset -r s2='34'

s1='c'
echo status=$?
s2='d'
echo status=$?

s1+='e'
echo status=$?
s2+='f'
echo status=$?

unset s1
echo status=$?
unset s2
echo status=$?

## status: 1
## stdout-json: ""
## OK mksh status: 2
## OK bash status: 0
## OK bash STDOUT:
status=1
status=1
status=1
status=1
status=1
status=1
## END

#### typeset -ar makes it readonly
typeset -a -r array1=(1 2)
typeset -ar array2=(3 4)

array1=('c')
echo status=$?
array2=('d')
echo status=$?

array1+=('e')
echo status=$?
array2+=('f')
echo status=$?

unset array1
echo status=$?
unset array2
echo status=$?

## status: 1
## stdout-json: ""
## OK bash status: 0
## OK bash STDOUT:
status=1
status=1
status=1
status=1
status=1
status=1
## END
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### typeset -x makes it exported
typeset -rx PYTHONPATH=lib/
printenv.py PYTHONPATH
## STDOUT:
lib/
## END

#### Multiple assignments / array assignments on a line
a=1 b[0+0]=2 c=3
echo $a ${b[@]} $c
## stdout: 1 2 3

#### Env bindings shouldn't contain array assignments
a=1 b[0]=2 c=3 printenv.py a b c
## status: 2
## stdout-json: ""
## OK bash STDOUT:
1
None
3
## END
## OK bash status: 0
## BUG mksh STDOUT:
1
2
3
## END
## BUG mksh status: 0

#### syntax error in array assignment
a=x b[0+]=y c=z
echo $a $b $c
## status: 2
## stdout-json: ""
## BUG bash stdout: x
## BUG bash status: 0
## OK bash stdout-json: ""
## OK bash status: 1
## OK mksh stdout-json: ""
## OK mksh status: 1

#### declare -g (bash-specific; bash-completion uses it)
f() {
  declare -g G=42
  declare L=99

  declare -Ag dict
  dict["foo"]=bar

  declare -A localdict
  localdict["spam"]=Eggs

  # For bash-completion
  eval 'declare -Ag ev'
  ev["ev1"]=ev2
}
f
argv.py "$G" "$L"
argv.py "${dict["foo"]}" "${localdict["spam"]}"
argv.py "${ev["ev1"]}"
## STDOUT:
['42', '']
['bar', '']
['ev2']
## END
## N-I mksh STDOUT:
['', '']
## END
## N-I mksh status: 1

#### myvar=typeset (another form of dynamic assignment)
myvar=typeset
x='a b'
$myvar x=$x
echo $x
## STDOUT:
a
## END
## OK osh STDOUT:
a b
## END

#### dynamic array parsing is not allowed
code='x=(1 2 3)'
typeset -a "$code"  # note: -a flag is required
echo status=$?
argv.py "$x"
## STDOUT:
status=2
['']
## END
## OK mksh STDOUT:
status=0
['(1 2 3)']
## END
# bash allows it
## OK bash STDOUT:
status=0
['1']
## END

#### dynamic flag in array in assign builtin
typeset b
b=(unused1 unused2)  # this works in mksh

a=(x 'foo=F' 'bar=B')
typeset -"${a[@]}"
echo foo=$foo
echo bar=$bar
printenv.py foo
printenv.py bar

# syntax error in mksh!  But works in bash and zsh.
#typeset -"${a[@]}" b=(spam eggs)
#echo "length of b = ${#b[@]}"
#echo "b[0]=${b[0]}"
#echo "b[1]=${b[1]}"

## STDOUT:
foo=F
bar=B
F
B
## END

#### typeset +x
export e=E
printenv.py e
typeset +x e=E2
printenv.py e  # no longer exported
## STDOUT:
E
None
## END

#### typeset +r removes read-only attribute (TODO: documented in bash to do nothing)
readonly r=r1
echo r=$r

# clear the readonly flag.  Why is this accepted in bash, but doesn't do
# anything?
typeset +r r=r2
echo r=$r

r=r3
echo r=$r

## status: 0
## STDOUT:
r=r1
r=r2
r=r3
## END

# mksh doesn't allow you to unset
## OK mksh status: 2
## OK mksh STDOUT:
r=r1
## END
# just-bash treats readonly assignment as fatal
## OK bash status: 1
## OK bash STDOUT:
r=r1
## END

# bash doesn't allow you to unset
## OK bash status: 0
## OK bash STDOUT:
r=r1
r=r1
r=r1
## END


#### function name with /
ble/foo() { echo hi; }
declare -F ble/foo
echo status=$?
## STDOUT:
ble/foo
status=0
## END
## N-I mksh stdout: status=127
## N-I zsh stdout-json: ""
## N-I zsh status: 1
## N-I ash stdout-json: ""
## N-I ash status: 2

#### invalid var name
typeset foo/bar
## status: 1

#### unset and shell funcs
foo() {
  echo bar
}

foo

declare -F
unset foo
declare -F

foo

## status: 127
## STDOUT:
bar
declare -f foo
## END
## N-I mksh status: 0
## N-I mksh STDOUT:
bar
bar
## END
