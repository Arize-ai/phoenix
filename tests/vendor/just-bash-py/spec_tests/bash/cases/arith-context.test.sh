## compare_shells: bash mksh zsh
## oils_failures_allowed: 0

# Test arithmetic expressions in all their different contexts.

# $(( 1 + 2 ))
# (( a=1+2 ))
# ${a[ 1 + 2 ]}
# ${a : 1+2 : 1+2}
# a[1 + 2]=foo

#### Multiple right brackets inside expression

a=(1 2 3)
echo ${a[a[0]]} ${a[a[a[0]]]}

## STDOUT:
2 3
## END

## N-I zsh status: 0
## N-I zsh STDOUT:

## END

#### Slicing of string with constants
s='abcd'
echo ${s:0} ${s:0:4} ${s:1:1}
## stdout: abcd abcd b

#### Slicing of string with variables
s='abcd'
zero=0
one=1
echo ${s:$zero} ${s:$zero:4} ${s:$one:$one}
## stdout: abcd abcd b

#### Array index on LHS of assignment
a=(1 2 3)
zero=0
a[zero+5-4]=X
echo ${a[@]}
## stdout: 1 X 3
## OK zsh stdout: X 2 3

#### Array index on LHS with indices
a=(1 2 3)
a[a[1]]=X
echo ${a[@]}
## stdout: 1 2 X
## OK zsh stdout: X 2 3

#### Slicing of string with expressions
# mksh accepts ${s:0} and ${s:$zero} but not ${s:zero}
# zsh says unrecognized modifier 'z'
s='abcd'
zero=0
echo ${s:zero} ${s:zero+0} ${s:zero+1:zero+1}
## stdout: abcd abcd b
## BUG mksh stdout-json: ""
## BUG mksh status: 1
## BUG zsh stdout-json: ""
## BUG zsh status: 1

#### Ambiguous colon in slice
s='abcd'
echo $(( 0 < 1 ? 2 : 0 ))  # evaluates to 2
echo ${s: 0 < 1 ? 2 : 0 : 1}  # 2:1 -- TRICKY THREE COLONS
## STDOUT:
2
c
## END
## BUG mksh/zsh STDOUT:
2
## END
## BUG mksh/zsh status: 1

#### Triple parens should be disambiguated
# The first paren is part of the math, parens 2 and 3 are a single token ending
# arith sub.
((a=1 + (2*3)))
echo $a $((1 + (2*3)))
## STDOUT:
7 7
## END

#### Quadruple parens should be disambiguated
((a=1 + (2 * (3+4))))
echo $a $((1 + (2 * (3+4))))
## STDOUT:
15 15
## END

#### $[ is a synonym for $((
echo $[1+2] $[3 * 4]

## STDOUT:
3 12
## END
## N-I mksh STDOUT:
$[1+2] $[3 * 4]
## END

#### $[$var is a synonym for $(($var (#2426)
var=1
echo $[$var+2]

## STDOUT:
3
## END
## N-I mksh STDOUT:
$[1+2]
## END

#### $[$undefined] is a synonym for $(($undefined (#2566)
a[0]=$[1+3]
b[0]=$[b[0]]
c[0]=$[b[0]]
echo ${c[0]}

## STDOUT:
0
## END

## BUG zsh status: 1
## BUG zsh STDOUT:
## END

## N-I mksh STDOUT:
$[b[0]]
## END

#### Empty expression (( ))  $(( ))

(( ))
echo status=$?

echo $(( ))

#echo $[]

## STDOUT:
status=1
0
## END

#### Empty expression for (( ))

for (( ; ; )); do
  echo one
  break
done

## STDOUT:
one
## END

## N-I mksh status: 1
## N-I mksh STDOUT:
## END

#### Empty expression in ${a[@]: : }

a=(a b c d e f)

# space required here -- see spec/var-op-slice
echo slice ${a[@]: }
echo status=$?
echo

echo slice ${a[@]: : }
echo status=$?
echo

# zsh doesn't accept this
echo slice ${a[@]:: }
echo status=$?

## STDOUT:
slice a b c d e f
status=0

slice
status=0

slice
status=0
## END

## BUG zsh status: 1
## BUG zsh STDOUT:
slice a b c d e f
status=0

slice
status=0

## END

## BUG mksh status: 1
## BUG mksh STDOUT:
## END


#### Empty expression a[]

a=(1 2 3)

a[]=42
echo status=$?
echo ${a[@]}

echo ${a[]}
echo status=$?

## status: 2
## STDOUT:
## END

## OK zsh status: 1

# runtime failures

## OK bash status: 0
## OK bash STDOUT:
status=1
1 2 3
status=1
## END

## BUG mksh status: 0
## BUG mksh STDOUT:
status=0
42 2 3
42
status=0
## END


# Others 
# [ 1+2 -eq 3 ]
# [[ 1+2 -eq 3 ]]
# unset a[]
# printf -v a[]

