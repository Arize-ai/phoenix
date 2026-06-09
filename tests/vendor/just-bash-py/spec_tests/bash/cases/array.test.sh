## compare_shells: bash mksh
## oils_failures_allowed: 2

#### nounset / set -u with empty array (bug in bash 4.3, fixed in 4.4)

# http://lists.gnu.org/archive/html/help-bash/2017-09/msg00005.html

set -o nounset
empty=()
argv.py "${empty[@]}"
echo status=$?
## STDOUT:
[]
status=0
## END
## BUG mksh stdout-json: ""
## BUG mksh status: 1

#### local array
# mksh support local variables, but not local arrays, oddly.
f() {
  local a=(1 '2 3')
  argv.py "${a[0]}"
}
f
## stdout: ['1']
## status: 0
## BUG mksh status: 1
## BUG mksh stdout-json: ""

#### Command with with word splitting in array
array=('1 2' $(echo '3 4'))
argv.py "${array[@]}"
## stdout: ['1 2', '3', '4']

#### space before ( in array initialization
# NOTE: mksh accepts this, but bash doesn't
a= (1 '2 3')
echo $a
## status: 2
## OK mksh status: 0
## OK mksh stdout: 1

#### array over multiple lines
a=(
1
'2 3'
)
argv.py "${a[@]}"
## stdout: ['1', '2 3']
## status: 0

#### array with invalid token
a=(
1
&
'2 3'
)
argv.py "${a[@]}"
## status: 2
## OK mksh status: 1

#### array with empty string
empty=('')
argv.py "${empty[@]}"
## stdout: ['']

#### Retrieve index
a=(1 '2 3')
argv.py "${a[1]}"
## stdout: ['2 3']

#### Retrieve out of bounds index
a=(1 '2 3')
argv.py "${a[3]}"
## stdout: ['']

#### Negative index
a=(1 '2 3')
argv.py "${a[-1]}" "${a[-2]}" "${a[-5]}"  # last one out of bounds
## stdout: ['2 3', '1', '']
## N-I mksh stdout: ['', '', '']

#### Negative index and sparse array
a=(0 1 2 3 4)
unset a[1]
unset a[4]
echo "${a[@]}"
echo -1 ${a[-1]}
echo -2 ${a[-2]}
echo -3 ${a[-3]}
echo -4 ${a[-4]}
echo -5 ${a[-5]}

a[-1]+=0  # append 0 on the end
echo ${a[@]}
(( a[-1] += 42 ))
echo ${a[@]}

## STDOUT:
0 2 3
-1 3
-2 2
-3
-4 0
-5
0 2 30
0 2 72
## END
## BUG mksh STDOUT:
0 2 3
-1
-2
-3
-4
-5
0 2 3 0
0 2 3 42
## END

#### Negative index and sparse array
a=(0 1)
unset 'a[-1]'  # remove last element
a+=(2 3)
echo ${a[0]} $((a[0]))
echo ${a[1]} $((a[1]))
echo ${a[2]} $((a[2]))
echo ${a[3]} $((a[3]))
## STDOUT:
0 0
2 2
3 3
0
## END
## BUG mksh STDOUT:
0 0
1 1
2 2
3 3
## END

#### Length after unset
a=(0 1 2 3)
unset a[-1]
echo len=${#a[@]}
unset a[-1]
echo len=${#a[@]}
## STDOUT:
len=3
len=2
## END
## BUG mksh STDOUT:
len=4
len=4
## END

#### Retrieve index that is a variable
a=(1 '2 3')
i=1
argv.py "${a[$i]}"
## stdout: ['2 3']

#### Retrieve index that is a variable without $
a=(1 '2 3')
i=5
argv.py "${a[i-4]}"
## stdout: ['2 3']

#### Retrieve index that is a command sub
a=(1 '2 3')
argv.py "${a[$(echo 1)]}"
## stdout: ['2 3']

#### Retrieve array indices with ${!a}
a=(1 '2 3')
argv.py "${!a[@]}"
## stdout: ['0', '1']

#### Retrieve sparse array indices with ${!a}
a=()
(( a[99]=1 ))
argv.py "${!a[@]}"
## STDOUT:
['99']
## END

#### ${!a[1]} is named ref in bash
# mksh ignores it
foo=bar
a=('1 2' foo '2 3')
argv.py "${!a[1]}"
## status: 0
## stdout: ['bar']
## N-I mksh stdout: ['a[1]']

#### ${!a} on array

# bash gives empty string because it's like a[0]
# mksh gives the name of the variable with !.  Very weird.

a=(1 '2 3')
argv.py "${!a}"

## stdout: ['']
## status: 0
## BUG mksh stdout: ['a']
## BUG mksh status: 0

#### All elements unquoted
a=(1 '2 3')
argv.py ${a[@]}
## stdout: ['1', '2', '3']

#### All elements quoted
a=(1 '2 3')
argv.py "${a[@]}"
## stdout: ['1', '2 3']

#### $*
a=(1 '2 3')
argv.py ${a[*]}
## stdout: ['1', '2', '3']

#### "$*"
a=(1 '2 3')
argv.py "${a[*]}"
## stdout: ['1 2 3']

#### Interpolate array into array
a=(1 '2 3')
a=(0 "${a[@]}" '4 5')
argv.py "${a[@]}"
## stdout: ['0', '1', '2 3', '4 5']

#### Exporting array doesn't do anything, not even first element
# bash parses, but doesn't execute.
# mksh gives syntax error -- parses differently with 'export'
# osh no longer parses this statically.

export PYTHONPATH

PYTHONPATH=mystr  # NOTE: in bash, this doesn't work afterward!
printenv.py PYTHONPATH

PYTHONPATH=(myarray)
printenv.py PYTHONPATH

PYTHONPATH=(a b c)
printenv.py PYTHONPATH

## status: 0
## STDOUT:
mystr
None
None
## END

#### strict_array prevents exporting array

shopt -s strict_array

export PYTHONPATH
PYTHONPATH=(a b c)
printenv.py PYTHONPATH

## status: 1
## STDOUT:
## END

## N-I bash/mksh status: 0
## N-I bash/mksh STDOUT:
None
## END

#### Arrays can't be used as env bindings
# Hm bash it treats it as a string!
A=a B=(b b) printenv.py A B
## status: 2
## stdout-json: ""
## OK bash STDOUT:
a
(b b)
## END
## OK bash status: 0
## OK mksh status: 1

#### Associative arrays can't be used as env bindings either
A=a B=([k]=v) printenv.py A B
## status: 2
## stdout-json: ""
## OK bash STDOUT:
a
([k]=v)
## OK bash status: 0
## OK mksh status: 1

#### Set element
a=(1 '2 3')
a[0]=9
argv.py "${a[@]}"
## stdout: ['9', '2 3']

#### Set element with var ref
a=(1 '2 3')
i=0
a[$i]=9
argv.py "${a[@]}"
## stdout: ['9', '2 3']

#### Set element with array ref
# This makes parsing a little more complex.  Anything can be inside [],
# including other [].
a=(1 '2 3')
i=(0 1)
a[${i[1]}]=9
argv.py "${a[@]}"
## stdout: ['1', '9']

#### Set array item to array
a=(1 2)
a[0]=(3 4)
echo "status=$?"
## stdout-json: ""
## status: 2
## N-I mksh status: 1
## BUG bash stdout: status=1
## BUG bash status: 0

#### Slice of array with [@]
# mksh doesn't support this syntax!  It's a bash extension.
a=(1 2 3)
argv.py "${a[@]:1:2}"
## stdout: ['2', '3']
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### Negative slice begin
# mksh doesn't support this syntax!  It's a bash extension.
# NOTE: for some reason -2) has to be in parens?  Ah that's because it
# conflicts with :-!  That's silly.  You can also add a space.
a=(1 2 3 4 5)
argv.py "${a[@]:(-4)}"
## stdout: ['2', '3', '4', '5']
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### Negative slice length
a=(1 2 3 4 5)
argv.py "${a[@]: 1: -3}"
## status: 1
## stdout-json: ""

#### Slice with arithmetic
a=(1 2 3)
i=5
argv.py "${a[@]:i-4:2}"
## stdout: ['2', '3']
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### Number of elements
a=(1 '2 3')
echo "${#a[@]}" ${#a[@]}  # bug fix: also test without quotes
## stdout: 2 2

#### Length of an element
a=(1 '2 3')
echo "${#a[1]}"
## stdout: 3

#### Iteration
a=(1 '2 3')
for v in "${a[@]}"; do
  echo $v
done
## STDOUT:
1
2 3
## END

#### glob within array yields separate elements
touch y.Y yy.Y
a=(*.Y)
argv.py "${a[@]}"
## stdout: ['y.Y', 'yy.Y']

#### declare array and then append
declare -a array
array+=(a)
array+=(b c)
argv.py "${array[@]}"
## stdout: ['a', 'b', 'c']

#### Array syntax in wrong place
ls foo=(1 2)
## status: 1
## OK bash status: 2

#### Single array with :-

# 2024-06 - bash 5.2 and mksh now match, bash 4.4 differed.
# Could change OSH
# zsh agrees with OSH, but it fails most test cases
# 2025-01 We changed OSH.

single=('')
argv.py ${single[@]:-none} x "${single[@]:-none}"
## stdout: ['none', 'x', 'none']

#### Stripping a whole array unquoted
# Problem: it joins it first.
files=('foo.c' 'sp ace.h' 'bar.c')
argv.py ${files[@]%.c}
## status: 0
## stdout: ['foo', 'sp', 'ace.h', 'bar']
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### Stripping a whole array quoted
files=('foo.c' 'sp ace.h' 'bar.c')
argv.py "${files[@]%.c}"
## status: 0
## stdout: ['foo', 'sp ace.h', 'bar']
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### Multiple subscripts not allowed
# NOTE: bash 4.3 had a bug where it ignored the bad subscript, but now it is
# fixed.
a=('123' '456')
argv.py "${a[0]}" "${a[0][0]}"
## stdout-json: ""
## status: 2
## OK bash/mksh status: 1

#### Length op, index op, then transform op is not allowed
a=('123' '456')
echo "${#a[0]}" "${#a[0]/1/xxx}"
## stdout-json: ""
## status: 2
## OK bash/mksh status: 1

#### ${mystr[@]} and ${mystr[*]} are no-ops
s='abc'
echo ${s[@]}
echo ${s[*]}
## STDOUT:
abc
abc
## END

#### ${mystr[@]} and ${mystr[*]} disallowed with strict_array
## SKIP (unimplementable): Interactive shell invocation not implemented

$SH -c 'shopt -s strict_array; s="abc"; echo ${s[@]}'
echo status=$?

$SH -c 'shopt -s strict_array; s="abc"; echo ${s[*]}'
echo status=$?

## status: 0
## STDOUT:
status=1
status=1
## END
## N-I bash/mksh STDOUT:
abc
status=0
abc
status=0
## END

#### Create a "user" array out of the argv array
set -- 'a b' 'c'
array1=('x y' 'z')
array2=("$@")
argv.py "${array1[@]}" "${array2[@]}"
## stdout: ['x y', 'z', 'a b', 'c']

#### Tilde expansion within array
HOME=/home/bob
a=(~/src ~/git)
echo "${a[@]}"
## stdout: /home/bob/src /home/bob/git

#### Brace Expansion within Array
a=(-{a,b} {c,d}-)
echo "${a[@]}"
## stdout: -a -b c- d-

#### array default
default=('1 2' '3')
argv.py "${undef[@]:-${default[@]}}"
## stdout: ['1 2', '3']

#### Singleton Array Copy and Assign.  OSH can't index strings with ints
a=( '12 3' )
b=( "${a[@]}" )
c="${a[@]}"  # This decays it to a string
d=${a[*]}  # This decays it to a string
echo ${#a[0]} ${#b[0]}
echo ${#a[@]} ${#b[@]}

# osh is intentionally stricter, and these fail.
echo ${#c[0]} ${#d[0]}
echo ${#c[@]} ${#d[@]}

## status: 1
## STDOUT:
4 4
1 1
## END
## OK bash/mksh status: 0
## OK bash/mksh STDOUT:
4 4
1 1
4 4
1 1
## END

#### declare -a / local -a is empty array
declare -a myarray
argv.py "${myarray[@]}"
myarray+=('x')
argv.py "${myarray[@]}"

f() {
  local -a myarray
  argv.py "${myarray[@]}"
  myarray+=('x')
  argv.py "${myarray[@]}"
}
f
## STDOUT:
[]
['x']
[]
['x']
## END

#### Create sparse array
a=()
(( a[99]=1 )) # osh doesn't parse index assignment outside arithmetic yet
echo len=${#a[@]}
argv.py "${a[@]}"
echo "unset=${a[33]}"
echo len-of-unset=${#a[33]}
## STDOUT:
len=1
['1']
unset=
len-of-unset=0
## END

#### Create sparse array implicitly
(( a[99]=1 ))
echo len=${#a[@]}
argv.py "${a[@]}"
echo "unset=${a[33]}"
echo len-of-unset=${#a[33]}
## STDOUT:
len=1
['1']
unset=
len-of-unset=0
## END

#### Append sparse arrays
a=()
(( a[99]=1 ))
b=()
(( b[33]=2 ))
(( b[66]=3 ))
a+=( "${b[@]}" )
argv.py "${a[@]}"
argv.py "${a[99]}" "${a[100]}" "${a[101]}"
## STDOUT:
['1', '2', '3']
['1', '2', '3']
## END

#### Slice of sparse array with [@]
# mksh doesn't support this syntax!  It's a bash extension.
(( a[33]=1 ))
(( a[66]=2 ))
(( a[99]=2 ))
argv.py "${a[@]:15:2}"
## stdout: ['1', '2']
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### Using an array itself as the index on LHS
shopt -u strict_arith
a[a]=42
a[a]=99
argv.py "${a[@]}" "${a[0]}" "${a[42]}" "${a[99]}"

## status: 0
## STDOUT:
['42', '99', '42', '99', '']
## END

#### Using an array itself as the index on RHS
shopt -u strict_arith
a=(1 2 3)
(( x = a[a] ))
echo $x
## status: 0
## STDOUT:
2
## END

#### a[$x$y] on LHS and RHS
x=1
y=2
a[$x$y]=foo

# not allowed by OSH parsing
#echo ${a[$x$y]}

echo ${a[12]}
echo ${#a[@]}

## STDOUT:
foo
1
## END


#### Dynamic parsing of LHS a[$code]=value

declare -a array
array[x=1]='one'

code='y=2'
#code='1+2'  # doesn't work either
array[$code]='two'

argv.py "${array[@]}"
echo x=$x
echo y=$y

## STDOUT:
['one', 'two']
x=1
y=2
## END
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Dynamic parsing of RHS ${a[$code]}
declare -a array
array=(zero one two three)

echo ${array[1+2]}

code='1+2'
echo ${array[$code]}

## STDOUT:
three
three
## END

# it still dynamically parses

## OK zsh STDOUT:
two
two
## END


#### Is element set?  test -v a[i]

# note: modern versions of zsh implement this

array=(1 2 3 '')

test -v 'array[1]'
echo set=$?

test -v 'array[3]'
echo empty=$?

test -v 'array[4]'
echo unset=$?

## STDOUT:
set=0
empty=0
unset=1
## END

## N-I mksh STDOUT:
set=2
empty=2
unset=2
## END


#### [[ -v a[i] ]]

# note: modern versions of zsh implement this

array=(1 2 3)
[[ -v array[1] ]]
echo status=$?

[[ -v array[4] ]]
echo status=$?

## STDOUT:
status=0
status=1
## END

## N-I mksh status: 1
## N-I mksh STDOUT:
## END


#### test -v a[i] with arith expressions

array=(1 2 3 '')

test -v 'array[1+1]'
echo status=$?

test -v 'array[4+1]'
echo status=$?

echo
echo dbracket

[[ -v array[1+1] ]]
echo status=$?

[[ -v array[4+1] ]]
echo status=$?

## STDOUT:
status=0
status=1

dbracket
status=0
status=1
## END

## N-I mksh status: 1
## N-I mksh STDOUT:
status=2
status=2

dbracket
## END


#### More arith expressions in [[ -v array[expr]] ]] 

typeset -a array
array=('' nonempty)

# This feels inconsistent with the rest of bash?
zero=0

[[ -v array[zero+0] ]]
echo zero=$?

[[ -v array[zero+1] ]]
echo one=$?

[[ -v array[zero+2] ]]
echo two=$?

echo ---

i='0+0'
[[ -v array[i] ]]
echo zero=$?

i='0+1'
[[ -v array[i] ]]
echo one=$?

i='0+2'
[[ -v array[i] ]]
echo two=$?

echo ---

i='0+0'
[[ -v array[$i] ]]
echo zero=$?

i='0+1'
[[ -v array[$i] ]]
echo one=$?

i='0+2'
[[ -v array[$i] ]]
echo two=$?


## STDOUT:
zero=0
one=0
two=1
---
zero=0
one=0
two=1
---
zero=0
one=0
two=1
## END

## N-I mksh status: 1
## N-I mksh STDOUT:
## END


#### Regression: Assigning with out-of-range negative index
a=()
a[-1]=1

## status: 1
## STDOUT:
## END
## STDERR:
  a[-1]=1
  ^~
[ stdin ]:2: fatal: Index -1 is out of bounds for array of length 0
## END

## OK bash STDERR:
bash: line 2: a[-1]: bad array subscript
## END

# Note: mksh interprets -1 as 0xFFFFFFFF
## N-I mksh status: 0
## N-I mksh STDERR:
## END


#### Regression: Negative index in [[ -v a[index] ]]
a[0]=x
a[5]=y
a[10]=z
[[ -v a[-1] ]] && echo 'a has -1'
[[ -v a[-2] ]] && echo 'a has -2'
[[ -v a[-5] ]] && echo 'a has -5'
[[ -v a[-6] ]] && echo 'a has -6'
[[ -v a[-10] ]] && echo 'a has -10'
[[ -v a[-11] ]] && echo 'a has -11'

## STDOUT:
a has -1
a has -6
a has -11
## END

## N-I mksh status: 1
## N-I mksh STDOUT:
## END


#### Regression: Negative out-of-range index in [[ -v a[index] ]]
e=()
[[ -v e[-1] ]] && echo 'e has -1'

## status: 1
## STDERR:
  [[ -v e[-1] ]] && echo 'e has -1'
        ^
[ stdin ]:2: fatal: -v got index -1, which is out of bounds for array of length 0
## END

## OK bash STDERR:
bash: line 2: e: bad array subscript
## END

## N-I mksh STDERR:
mksh: <stdin>[2]: syntax error: 'e[-1]' unexpected operator/operand
## END


## YSH-specific test - commented out
# #### a+=() modifies existing instance of BashArray
# case $SH in mksh|bash) exit ;; esac
#
# a=(1 2 3)
# var b = a
# a+=(4 5)
# echo "a=(${a[*]})"
# echo "b=(${b[*]})"
#
# ## STDOUT:
# a=(1 2 3 4 5)
# b=(1 2 3 4 5)
# ## END
#
# ## N-I mksh/bash STDOUT:
# ## END


#### Regression: unset a[-2]: out-of-bound negative index should cause error
case $SH in mksh) exit ;; esac

a=(1)
unset -v 'a[-2]'

## status: 1
## STDOUT:
## END
## STDERR:
  unset -v 'a[-2]'
           ^
[ stdin ]:4: a[-2]: Index is out of bounds for array of length 1
## END

## OK bash STDERR:
bash: line 4: unset: [-2]: bad array subscript
## END

## N-I mksh status: 0
## N-I mksh STDERR:
## END


#### Regression: Out-of-bound negative offset for ${a[@]:offset}
case $SH in mksh) exit ;; esac

a=(1 2 3 4)
echo "a=(${a[*]})"
echo "begin=-1 -> (${a[*]: -1})"
echo "begin=-2 -> (${a[*]: -2})"
echo "begin=-3 -> (${a[*]: -3})"
echo "begin=-4 -> (${a[*]: -4})"
echo "begin=-5 -> (${a[*]: -5})"

## STDOUT:
a=(1 2 3 4)
begin=-1 -> (4)
begin=-2 -> (3 4)
begin=-3 -> (2 3 4)
begin=-4 -> (1 2 3 4)
begin=-5 -> ()
## END

## N-I mksh STDOUT:
## END


#### Regression: Array length after unset
case $SH in mksh) exit ;; esac

a=(x)
a[9]=y
echo "len ${#a[@]};"

unset -v 'a[-1]'
echo "len ${#a[@]};"
echo "last ${a[@]: -1};"

## STDOUT:
len 2;
len 1;
last x;
## END

## N-I mksh STDOUT:
## END


#### Regression: ${a[@]@Q} crash with `a[0]=x a[2]=y`
case $SH in mksh) exit ;; esac

a[0]=x
a[2]=y
echo "quoted = (${a[@]@Q})"

## STDOUT:
quoted = (x y)
## END

## OK bash STDOUT:
quoted = ('x' 'y')
## END

## N-I mksh STDOUT:
## END


#### Regression: silent out-of-bound negative index in ${a[-2]} and $((a[-2]))
case $SH in mksh) exit ;; esac

a=(x)
echo "[${a[-2]}]"
echo $?
echo "[$((a[-2]))]"
echo $?

## STDOUT:
[]
0
[0]
0
## END
## STDERR:
  echo "[${a[-2]}]"
           ^
[ stdin ]:4: Index -2 out of bounds for array of length 1
  echo "[$((a[-2]))]"
             ^
[ stdin ]:6: Index -2 out of bounds for array of length 1
## END

## OK bash STDERR:
bash: line 4: a: bad array subscript
bash: line 6: a: bad array subscript
## END

## N-I mksh status: 0
## N-I mksh STDOUT:
## END
## N-I mksh STDERR:
## END
