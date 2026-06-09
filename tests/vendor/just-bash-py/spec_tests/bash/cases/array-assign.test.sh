## compare_shells: bash zsh mksh ash
## oils_failures_allowed: 9

# Note: this file elaborates on spec/ble-idioms.test.sh

#### Indexed LHS without spaces, and +=
a[1]=x
echo status=$?
argv.py "${a[@]}"

a[0+2]=y
#a[2|3]=y  # zsh doesn't allow this
argv.py "${a[@]}"

# += does appending
a[0+2]+=z
argv.py "${a[@]}"

## STDOUT:
status=0
['x']
['x', 'y']
['x', 'yz']
## END

## N-I ash status: 2
## N-I ash STDOUT:
status=127
## END

#### Indexed LHS with spaces
case $SH in zsh|ash) exit ;; esac

a[1 * 1]=x
a[ 1 + 2 ]=z
echo status=$?

argv.py "${a[@]}"
## STDOUT:
status=0
['x', 'z']
## END
## N-I zsh/ash STDOUT:
## END

#### Nested a[i[0]]=0

i=(0 1 2)

a[i[0]]=0
a[ i[1] ]=1
a[ i[2] ]=2
a[ i[1]+i[2] ]=3

argv.py "${a[@]}"

## STDOUT:
['0', '1', '2', '3']
## END
## N-I zsh/ash STDOUT:
## END

#### Multiple LHS array words
case $SH in zsh|ash) exit ;; esac

a=(0 1 2)
b=(3 4 5)

#declare -p a b

HOME=/home/spec-test

# empty string, and tilde sub
a[0 + 1]=  b[2 + 0]=~/src

typeset -p a b

echo ---

# In bash, this bad prefix binding prints an error, but nothing fails
a[0 + 1]='foo' argv.py b[2 + 0]='bar'
echo status=$?

typeset -p a b

## STDOUT:
declare -a a=([0]="0" [1]="" [2]="2")
declare -a b=([0]="3" [1]="4" [2]="/home/spec-test/src")
---
['b[2', '+', '0]=bar']
status=0
declare -a a=([0]="0" [1]="" [2]="2")
declare -a b=([0]="3" [1]="4" [2]="/home/spec-test/src")
## END

## OK mksh STDOUT:
set -A a
typeset a[0]=0
typeset a[1]=
typeset a[2]=2
set -A b
typeset b[0]=3
typeset b[1]=4
typeset b[2]=/home/spec-test/src
---
['b[2', '+', '0]=bar']
status=0
set -A a
typeset a[0]=0
typeset a[1]=
typeset a[2]=2
set -A b
typeset b[0]=3
typeset b[1]=4
typeset b[2]=/home/spec-test/src
## END

## N-I zsh/ash STDOUT:
## END

#### LHS array is protected with shopt -s eval_unsafe_arith, e.g. 'a[$(echo 2)]'
## SKIP (unimplementable): eval_unsafe_arith is an OSH-specific security feature
case $SH in zsh|ash) exit ;; esac

a=(0 1 2)
b=(3 4 5)
typeset -p b

expr='a[$(echo 2)]' 

echo 'get' "${b[expr]}"

b[expr]=zzz

echo 'set' "${b[expr]}"
typeset -p b

## STDOUT:
declare -a b=([0]="3" [1]="4" [2]="5")
get 5
set zzz
declare -a b=([0]="3" [1]="4" [2]="zzz")
## END

## OK mksh STDOUT:
set -A b
typeset b[0]=3
typeset b[1]=4
typeset b[2]=5
get 5
set zzz
set -A b
typeset b[0]=3
typeset b[1]=4
typeset b[2]=zzz
## END

## N-I zsh/ash STDOUT:
## END

#### file named a[ is  not executed
case $SH in zsh|ash) exit ;; esac

PATH=".:$PATH"

for name in 'a[' 'a[5'; do
  echo "echo hi from $name: \$# args: \$@" > "$name"
  chmod +x "$name"
done

# this does not executed a[5
a[5 + 1]=
a[5 / 1]=y
echo len=${#a[@]}

# Not detected as assignment because there's a non-arith character
# bash and mksh both give a syntax error
a[5 # 1]=

## status: 1
## STDOUT:
len=2
## END

## N-I zsh/ash status: 0
## N-I zsh/ash STDOUT:
## END

#### More fragments like a[  a[5  a[5 +  a[5 + 3]

for name in 'a[' 'a[5'; do
  echo "echo hi from $name: \$# args: \$@" > "$name"
  chmod +x "$name"
done

# syntax error in bash
$SH -c 'a['
echo "a[ status=$?"

$SH -c 'a[5'
echo "a[5 status=$?"

# 1 arg +
$SH -c 'a[5 +'
echo "a[5 + status=$?"

# 2 args
$SH -c 'a[5 + 3]'
echo "a[5 + 3] status=$?"

$SH -c 'a[5 + 3]='
echo "a[5 + 3]= status=$?"

$SH -c 'a[5 + 3]+'
echo "a[5 + 3]+ status=$?"

$SH -c 'a[5 + 3]+='
echo "a[5 + 3]+= status=$?"

# mksh doesn't issue extra parse errors
# and it doesn't turn a[5 + 3] and a[5 + 3]+ into commands!

## STDOUT:
a[ status=127
a[5 status=127
a[5 + status=127
a[5 + 3] status=127
a[5 + 3]= status=0
a[5 + 3]+ status=127
a[5 + 3]+= status=0
## END

## BUG bash STDOUT:
a[ status=2
a[5 status=2
a[5 + status=2
a[5 + 3] status=127
a[5 + 3]= status=0
a[5 + 3]+ status=127
a[5 + 3]+= status=0
## END

# in zsh, everything becomes "bad pattern"

## BUG-2 zsh STDOUT:
a[ status=1
a[5 status=1
a[5 + status=1
a[5 + 3] status=1
a[5 + 3]= status=1
a[5 + 3]+ status=1
a[5 + 3]+= status=1
## END

# ash behavior is consistent

## N-I ash STDOUT:
a[ status=127
a[5 status=127
a[5 + status=127
a[5 + 3] status=127
a[5 + 3]= status=127
a[5 + 3]+ status=127
a[5 + 3]+= status=127
## END

#### Are quotes allowed?

# double quotes allowed in bash
a["1"]=2
echo status=$? len=${#a[@]}

a['2']=3
echo status=$? len=${#a[@]}

# allowed in bash
a[2 + "3"]=5
echo status=$? len=${#a[@]}

a[3 + '4']=5
echo status=$? len=${#a[@]}

## status: 1
## STDOUT:
## END

## OK ash status: 2

# syntax errors are not fatal in bash

## BUG bash status: 0
## BUG bash STDOUT:
status=0 len=1
status=1 len=1
status=0 len=2
status=1 len=2
## END

# bash 3.2+ treats single quotes in array index as character values
## OK bash status: 0
## OK bash STDOUT:
status=0 len=1
status=0 len=2
status=0 len=3
status=0 len=4
## END

#### Tricky parsing - a[ a[0]=1 ]=X  a[ a[0]+=1 ]+=X
# the nested [] means we can't use regular language lookahead?

echo assign=$(( z[0] = 42 ))

a[a[0]=1]=X
declare -p a

a[ a[2]=3 ]=Y
declare -p a

echo ---

a[ a[0]+=1 ]+=X
declare -p a

## STDOUT:
assign=42
declare -a a=([0]="1" [1]="X")
declare -a a=([0]="1" [1]="X" [2]="3" [3]="Y")
---
declare -a a=([0]="2" [1]="X" [2]="3X" [3]="Y")
## END

## N-I zsh/mksh/ash STDOUT:
## END

#### argv.py a[1 + 2]=
case $SH in zsh|ash) exit ;; esac

# This tests that the worse parser doesn't unconditinoally treat a[ as special

a[1 + 2]= argv.py a[1 + 2]=
echo status=$?

a[1 + 2]+= argv.py a[1 + 2]+=
echo status=$?

argv.py a[3 + 4]=

argv.py a[3 + 4]+=

## STDOUT:
['a[1', '+', '2]=']
status=0
['a[1', '+', '2]+=']
status=0
['a[3', '+', '4]=']
['a[3', '+', '4]+=']
## END

## N-I zsh/ash STDOUT:
## END

#### declare builtin doesn't allow spaces
case $SH in zsh|mksh|ash) exit ;; esac

# OSH doesn't allow this
declare a[a[0]=1]=X
declare -p a

# neither bash nor OSH allow this
declare a[ a[2]=3 ]=Y
declare -p a

## STDOUT:
declare -a a=([0]="1" [1]="X")
declare -a a=([0]="1" [1]="X" [2]="3")
## END

## OK osh status: 1
## OK osh STDOUT:
## END

## N-I zsh/mksh/ash STDOUT:
## END
