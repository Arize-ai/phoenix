## compare_shells: bash

#### Tilde expansions in RHS of [k]=v (BashArray)
HOME=/home/user
a=([2]=~ [4]=~:~:~)
echo "${a[2]}"
echo "${a[4]}"
## STDOUT:
/home/user
/home/user:/home/user:/home/user
## END

#### Tilde expansions in RHS of [k]=v (BashAssoc)
# Note: bash-5.2 has a bug that the tilde doesn't expand on the right hand side
# of [key]=value.  This problem doesn't happen in bash-3.1..5.1 and bash-5.3.
HOME=/home/user
declare -A a
declare -A a=(['home']=~ ['hello']=~:~:~)
echo "${a['home']}"
echo "${a['hello']}"
## STDOUT:
/home/user
/home/user:/home/user:/home/user
## END
## BUG bash STDOUT:
~
~:~:~
## END

#### index increments without [k]= (BashArray)
a=([100]=1 2 3 4)
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
a=([100]=1 2 3 4 [5]=a b c d)
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
## STDOUT:
keys: ['100', '101', '102', '103']
vals: ['1', '2', '3', '4']
keys: ['5', '6', '7', '8', '100', '101', '102', '103']
vals: ['a', 'b', 'c', 'd', '1', '2', '3', '4']
## END

#### [k]=$v and [k]="$@" (BashArray)
i=5
v='1 2 3'
a=($v [i]=$v)
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"

x=(3 5 7)
a=($v [i]="${x[*]}")
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
a=($v [i]="${x[@]}")
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
a=($v [i]=${x[*]})
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
a=($v [i]=${x[@]})
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
## STDOUT:
keys: ['0', '1', '2', '5']
vals: ['1', '2', '3', '1 2 3']
keys: ['0', '1', '2', '5']
vals: ['1', '2', '3', '3 5 7']
keys: ['0', '1', '2', '5']
vals: ['1', '2', '3', '3 5 7']
keys: ['0', '1', '2', '5']
vals: ['1', '2', '3', '3 5 7']
keys: ['0', '1', '2', '5']
vals: ['1', '2', '3', '3 5 7']
## END

#### [k]=$v and [k]="$@" (BashAssoc)
i=5
v='1 2 3'
declare -A a
a=([i]=$v)
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"

x=(3 5 7)
a=([i]="${x[*]}")
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
a=([i]="${x[@]}")
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
a=([i]=${x[*]})
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
a=([i]=${x[@]})
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
## STDOUT:
keys: ['i']
vals: ['1 2 3']
keys: ['i']
vals: ['3 5 7']
keys: ['i']
vals: ['3 5 7']
keys: ['i']
vals: ['3 5 7']
keys: ['i']
vals: ['3 5 7']
## END

#### append to element (BashArray)
a=([hello]=1 [hello]+=2)
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
a+=([hello]+=:34 [hello]+=:56)
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
## STDOUT:
keys: ['0']
vals: ['12']
keys: ['0']
vals: ['12:34:56']
## END

#### append to element (BashAssoc)
declare -A a
hello=100
a=([hello]=1 [hello]+=2)
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
a+=([hello]+=:34 [hello]+=:56)
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
## STDOUT:
keys: ['hello']
vals: ['12']
keys: ['hello']
vals: ['12:34:56']
## END
# Bash >= 5.1 has a bug. Bash <= 5.0 is OK.
## BUG bash STDOUT:
keys: ['hello']
vals: ['2']
keys: ['hello']
vals: ['2:34:56']
## END

#### non-index forms of element (BashAssoc)
declare -A a
a=([j]=1 2 3 4)
echo "status=$?"
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
## status: 0
## STDOUT:
status=0
keys: ['j']
vals: ['1']
## END
## STDERR:
bash: line 2: a: 2: must use subscript when assigning associative array
bash: line 2: a: 3: must use subscript when assigning associative array
bash: line 2: a: 4: must use subscript when assigning associative array
## END

#### Evaluation order (1)
# RHS of [k]=v are expanded when the initializer list is instanciated.  For the
# indexed array, the array indices are evaluated when the array is modified.
i=1
a=([100+i++]=$((i++)) [200+i++]=$((i++)) [300+i++]=$((i++)))
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
## STDOUT:
keys: ['104', '205', '306']
vals: ['1', '2', '3']
## END

#### Evaluation order (2)
# When evaluating the index, the modification to the array by the previous item
# of the initializer list is visible to the current item.
a=([0]=1+2+3 [a[0]]=10 [a[6]]=hello)
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
## STDOUT:
keys: ['0', '6', '10']
vals: ['1+2+3', '10', 'hello']
## END

#### Evaluation order (3)
# RHS should be expanded before any modification to the array.
a=(old1 old2 old3)
a=("${a[2]}" "${a[0]}" "${a[1]}" "${a[2]}" "${a[0]}")
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
a=(old1 old2 old3)
old1=101 old2=102 old3=103
new1=201 new2=202 new3=203
a+=([0]=new1 [1]=new2 [2]=new3 [5]="${a[2]}" [a[0]]="${a[0]}" [a[1]]="${a[1]}")
printf 'keys: '; argv.py "${!a[@]}"
printf 'vals: '; argv.py "${a[@]}"
## STDOUT:
keys: ['0', '1', '2', '3', '4']
vals: ['old3', 'old1', 'old2', 'old3', 'old1']
keys: ['0', '1', '2', '5', '201', '202']
vals: ['new1', 'new2', 'new3', 'old3', 'old1', 'old2']
## END

#### [k1]=v1 (BashArray)
# Note: This and next tests have originally been in "spec/assign.test.sh" and
# compared the behavior of OSH's BashAssoc and Bash's indexed array.  After
# supporting "arr=([index]=value)" for indexed arrays, the test was adjusted
# and copied here. See also the corresponding tests in "spec/assign.test.sh"
a=([k1]=v1 [k2]=v2)
echo ${a["k1"]}
echo ${a["k2"]}
## STDOUT:
v2
v2
## END

#### [k1]=v1 (BashAssoc)
declare -A a
a=([k1]=v1 [k2]=v2)
echo ${a["k1"]}
echo ${a["k2"]}
## STDOUT:
v1
v2
## END

#### [k1]=v1 looking like brace expansions (BashAssoc)
declare -A a
a=([k2]=-{a,b}-)
echo ${a["k2"]}
## STDOUT:
-{a,b}-
## END

#### [k1]=v1 looking like brace expansions (BashArray)
a=([k2]=-{a,b}-)
echo ${a["k2"]}
## STDOUT:
-{a,b}-
## END
## BUG bash STDOUT:
[k2]=-a-
## END

#### BashArray cannot be changed to BashAssoc and vice versa
declare -a a=(1 2 3 4)
eval 'declare -A a=([a]=x [b]=y [c]=z)'
echo status=$?
argv.py "${a[@]}"

declare -A A=([a]=x [b]=y [c]=z)
eval 'declare -a A=(1 2 3 4)'
echo status=$?
argv.py $(printf '%s\n' "${A[@]}" | sort)
## STDOUT:
status=1
['1', '2', '3', '4']
status=1
['x', 'y', 'z']
## END

#### (strict_array) s+=()
case $SH in bash) ;; *) shopt --set strict_array ;; esac

s1=hello
s2=world

# Overwriting Str with a new BashArray is allowed
eval 's1=(1 2 3 4)'
echo status=$?
declare -p s1
# Promoting Str to a BashArray is disallowed
eval 's2+=(1 2 3 4)'
echo status=$?
declare -p s2
## STDOUT:
status=0
declare -a s1=(1 2 3 4)
status=1
declare -- s2=world
## END
## N-I bash STDOUT:
status=0
declare -a s1=([0]="1" [1]="2" [2]="3" [3]="4")
status=0
declare -a s2=([0]="world" [1]="1" [2]="2" [3]="3" [4]="4")
## END

#### (strict_array) declare -A s+=()
case $SH in bash) ;; *) shopt --set strict_array ;; esac

s1=hello
s2=world

# Overwriting Str with a new BashAssoc is allowed
eval 'declare -A s1=([a]=x [b]=y)'
echo status=$?
declare -p s1
# Promoting Str to a BashAssoc is disallowed
eval 'declare -A s2+=([a]=x [b]=y)'
echo status=$?
declare -p s2
## STDOUT:
status=0
declare -A s1=(['a']=x ['b']=y)
status=1
declare -- s2=world
## END
## N-I bash STDOUT:
status=0
declare -A s1=([b]="y" [a]="x" )
status=0
declare -A s2=([0]="world" [b]="y" [a]="x" )
## END

#### (strict_array) assoc=(key value ...) is not allowed
case $SH in bash) ;; *) shopt --set strict_array ;; esac

declare -A a=([a]=b)
eval "a=(1 2 3 4)"
declare -p a
## STDOUT:
declare -A a=()
## END
## N-I bash STDOUT:
declare -A a=([3]="4" [1]="2" )
## END
