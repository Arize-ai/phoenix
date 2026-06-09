## compare_shells: bash mksh
## oils_failures_allowed: 2

# Arrays decay upon assignment (without splicing) and equality.

#### Assignment Causes Array Decay
set -- x y z
argv.py "[$@]"
var="[$@]"
argv.py "$var"
## STDOUT:
['[x', 'y', 'z]']
['[x y z]']
## END

#### Array Decay with IFS
IFS=x
set -- x y z
var="[$@]"
argv.py "$var"
## stdout: ['[x y z]']

#### User arrays decay
declare -a a b
a=(x y z)
b="${a[@]}"  # this collapses to a string
c=("${a[@]}")  # this preserves the array
c[1]=YYY  # mutate a copy -- doesn't affect the original
argv.py "${a[@]}"
argv.py "${b}"
argv.py "${c[@]}"
## STDOUT:
['x', 'y', 'z']
['x y z']
['x', 'YYY', 'z']
## END

#### strict_array: $array is not valid in OSH, is ${array[0]} in ksh/bash
shopt -s strict_array

a=(1 '2 3')
echo $a
## STDOUT:
1
## END
## OK osh status: 1
## OK osh stdout-json: ""

#### strict_array: ${array} is not valid in OSH, is ${array[0]} in ksh/bash
shopt -s strict_array

a=(1 '2 3')
echo ${a}
## STDOUT:
1
## END
## OK osh status: 1
## OK osh stdout-json: ""

#### Assign to array index without initialization
a[5]=5
a[6]=6
echo "${a[@]}" ${#a[@]}
## stdout: 5 6 2

#### a[40] grows array
a=(1 2 3)
a[1]=5
a[40]=30  # out of order
a[10]=20
echo "${a[@]}" "${#a[@]}"  # length is 1
## stdout: 1 5 3 20 30 5

#### array decays to string when comparing with [[ a = b ]]
a=('1 2' '3 4')
s='1 2 3 4'  # length 2, length 4
echo ${#a[@]} ${#s}
[[ "${a[@]}" = "$s" ]] && echo EQUAL
## STDOUT:
2 7
EQUAL
## END

#### ++ on a whole array increments the first element (disallowed with strict_array)
## SKIP (unimplementable): strict_array is an OSH-specific shopt option (not standard bash)
shopt -s strict_array

a=(1 10)
(( a++ ))  # doesn't make sense
echo "${a[@]}"
## stdout: 2 10
## OK osh status: 1
## OK osh stdout-json: ""

#### Apply vectorized operations on ${a[*]}
a=('-x-' 'y-y' '-z-')

# This does the prefix stripping FIRST, and then it joins.
argv.py "${a[*]#-}"
## STDOUT:
['x- y-y z-']
## END
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### value.BashArray internal representation - Indexed
case $SH in mksh) exit ;; esac

z=()
declare -a | grep z=

z+=(b c)
declare -a | grep z=

# z[5]= finds the index, or puts it in SORTED order I think
z[5]=d
declare -a | grep z=

z[1]=ZZZ
declare -a | grep z=

# Adds after last index
z+=(f g)
declare -a | grep z=

# This is the equivalent of z[0]+=mystr
z+=-mystr
declare -a | grep z=

z[1]+=-append
declare -a | grep z=

argv.py keys "${!z[@]}"  # 0 1 5 6 7
argv.py values "${z[@]}"

# can't do this conversion
declare -A z
declare -A | grep z=

echo status=$?

## STDOUT:
declare -a z=()
declare -a z=([0]="b" [1]="c")
declare -a z=([0]="b" [1]="c" [5]="d")
declare -a z=([0]="b" [1]="ZZZ" [5]="d")
declare -a z=([0]="b" [1]="ZZZ" [5]="d" [6]="f" [7]="g")
declare -a z=([0]="b-mystr" [1]="ZZZ" [5]="d" [6]="f" [7]="g")
declare -a z=([0]="b-mystr" [1]="ZZZ-append" [5]="d" [6]="f" [7]="g")
['keys', '0', '1', '5', '6', '7']
['values', 'b-mystr', 'ZZZ-append', 'd', 'f', 'g']
status=1
## END

## N-I mksh STDOUT:
## END

#### value.BashArray internal representation - Assoc (ordering is a problem)
case $SH in mksh) exit ;; esac

declare -A A=([k]=v)
declare -A | grep A=

argv.py keys "${!A[@]}"
argv.py values "${A[@]}"

exit

# Huh this actually works, we don't support it
# Hm the order here is all messed up, in bash 5.2
A+=([k2]=v2 [0]=foo [9]=9 [9999]=9999)
declare -A | grep A=

A+=-append
declare -A | grep A=

argv.py keys "${!A[@]}"
argv.py values "${A[@]}"

## STDOUT:
declare -A A=(['k']=v)
['keys', 'k']
['values', 'v']
## END

## BUG bash STDOUT:
declare -A A=([k]="v" )
['keys', 'k']
['values', 'v']
## END

## N-I mksh STDOUT:
## END
