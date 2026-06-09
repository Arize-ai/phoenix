## compare_shells: bash dash mksh zsh


# Interesting interpretation of constants.
#
# "Constants with a leading 0 are interpreted as octal numbers. A leading ‘0x’
# or ‘0X’ denotes hexadecimal. Otherwise, numbers take the form [base#]n, where
# the optional base is a decimal number between 2 and 64 representing the
# arithmetic base, and n is a number in that base. If base# is omitted, then
# base 10 is used. When specifying n, the digits greater than 9 are represented
# by the lowercase letters, the uppercase letters, ‘@’, and ‘_’, in that order.
# If base is less than or equal to 36, lowercase and uppercase letters may be
# used interchangeably to represent numbers between 10 and 35. "
# 
# NOTE $(( 8#9 )) can fail, and this can be done at parse time...

#### Side Effect in Array Indexing
a=(4 5 6)
echo "${a[b=2]} b=$b"
## stdout: 6 b=2
## OK zsh stdout: 5 b=2
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Add one to var
i=1
echo $(($i+1))
## stdout: 2

#### $ is optional
i=1
echo $((i+1))
## stdout: 2

#### SimpleVarSub within arith
j=0
echo $(($j + 42))
## stdout: 42

#### BracedVarSub within ArithSub
echo $((${j:-5} + 1))
## stdout: 6

#### Arith word part
foo=1; echo $((foo+1))bar$(($foo+1))
## stdout: 2bar2

#### Arith sub with word parts
# Making 13 from two different kinds of sub.  Geez.
echo $((1 + $(echo 1)${undefined:-3}))
## stdout: 14

#### Constant with quotes like '1'
# NOTE: Compare with [[.  That is a COMMAND level expression, while this is a
# WORD level expression.
echo $(('1' + 2))
## status: 0
## N-I bash/zsh status: 1
## N-I dash status: 2

#### Arith sub within arith sub
# This is unnecessary but works in all shells.
echo $((1 + $((2 + 3)) + 4))
## stdout: 10

#### Backticks within arith sub
# This is unnecessary but works in all shells.
echo $((`echo 1` + 2))
## stdout: 3

#### Invalid string to int
# bash, mksh, and zsh all treat strings that don't look like numbers as zero.
shopt -u strict_arith || true
s=foo
echo $((s+5))
## OK dash stdout-json: ""
## OK dash status: 2
## OK bash/mksh/zsh/osh stdout: 5
## OK bash/mksh/zsh/osh status: 0

#### Invalid string to int with strict_arith
shopt -s strict_arith || true
s=foo
echo $s
echo $((s+5))
echo 'should not get here'
## status: 1
## STDOUT:
foo
## END
## OK dash status: 2
## N-I bash/mksh/zsh STDOUT:
foo
5
should not get here
## END
## N-I bash/mksh/zsh status: 0

#### Integer constant parsing
echo $(( 0x12A ))
echo $(( 0x0A ))
echo $(( 0777 ))
echo $(( 0010 ))
echo $(( 24#ag7 ))
## STDOUT:
298
10
511
8
6151
## END

## N-I dash status: 2
## N-I dash STDOUT:
298
10
511
8
## END

## BUG zsh STDOUT:
298
10
777
10
6151
## END

## BUG mksh STDOUT:
298
10
777
10
6151
## END

#### Integer constant validation
## SKIP (unimplementable): $SH -c invocations produce different validation results
check() {
  $SH -c "shopt --set strict_arith; echo $1"
  echo status=$?
}

check '$(( 0x1X ))'
check '$(( 09 ))'
check '$(( 2#A ))'
check '$(( 02#0110 ))'
## STDOUT:
status=1
status=1
status=1
status=1
## END

## OK dash STDOUT:
status=2
status=2
status=2
status=2
## END

## BUG zsh STDOUT:
status=1
9
status=0
status=1
6
status=0
## END

## BUG mksh STDOUT:
status=1
9
status=0
status=1
6
status=0
## END

#### Newline in the middle of expression
echo $((1
+ 2))
## stdout: 3

#### Ternary operator
a=1
b=2
echo $((a>b?5:10))
## stdout: 10

#### Preincrement
a=4
echo $((++a))
echo $a
## STDOUT:
5
5
## END
## N-I dash status: 0
## N-I dash STDOUT:
4
4
## END

#### Postincrement
a=4
echo $((a++))
echo $a
## STDOUT:
4
5
## END
## N-I dash status: 2
## N-I dash stdout-json: ""

#### Increment undefined variables
shopt -u strict_arith || true
(( undef1++ ))
(( ++undef2 ))
echo "[$undef1][$undef2]"
## stdout: [1][1]
## N-I dash stdout: [][]

#### Increment and decrement array elements
shopt -u strict_arith || true
a=(5 6 7 8)
(( a[0]++, ++a[1], a[2]--, --a[3] ))
(( undef[0]++, ++undef[1], undef[2]--, --undef[3] ))
echo "${a[@]}" - "${undef[@]}"
## stdout: 6 7 6 7 - 1 1 -1 -1
## N-I dash stdout-json: ""
## N-I dash status: 2
## BUG zsh stdout: 5 6 7 8 -

#### Increment undefined variables with nounset
set -o nounset
(( undef1++ ))
(( ++undef2 ))
echo "[$undef1][$undef2]"
## stdout-json: ""
## status: 1
## OK dash status: 2
## BUG mksh/zsh status: 0
## BUG mksh/zsh STDOUT:
[1][1]
## END

#### Comma operator (borrowed from C)
a=1
b=2
echo $((a,(b+1)))
## stdout: 3
## N-I dash status: 2
## N-I dash stdout-json: ""

#### Augmented assignment
a=4
echo $((a+=1))
echo $a
## STDOUT:
5
5
## END

#### Comparison Ops
echo $(( 1 == 1 ))
echo $(( 1 != 1 ))
echo $(( 1 < 1 ))
echo $(( 1 <= 1 ))
echo $(( 1 > 1 ))
echo $(( 1 >= 1 ))
## STDOUT:
1
0
0
1
0
1
## END

#### Logical Ops
echo $((1 || 2))
echo $((1 && 2))
echo $((!(1 || 2)))
## STDOUT:
1
1
0
## END

#### Logical Ops Short Circuit
x=11
(( 1 || (x = 22) ))
echo $x
(( 0 || (x = 33) ))
echo $x
(( 0 && (x = 44) ))
echo $x
(( 1 && (x = 55) ))
echo $x
## STDOUT:
11
33
33
55
## END
## N-I dash STDOUT:
11
11
11
11
## END

#### Bitwise ops
echo $((1|2))
echo $((1&2))
echo $((1^2))
echo $((~(1|2)))
## STDOUT:
3
0
3
-4
## END

#### Unary minus and plus
a=1
b=3
echo $((- a + + b))
## STDOUT:
2
## END

#### No floating point
echo $((1 + 2.3))
## status: 2
## OK bash/mksh status: 1
## BUG zsh status: 0

#### Array indexing in arith
# zsh does 1-based indexing!
array=(1 2 3 4)
echo $((array[1] + array[2]*3))
## stdout: 11
## OK zsh stdout: 7
## N-I dash status: 2
## N-I dash stdout-json: ""

#### Constants in base 36
echo $((36#a))-$((36#z))
## stdout: 10-35
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Constants in bases 2 to 64
# This is a truly bizarre syntax.  Oh it comes from zsh... which allows 36.
echo $((64#a))-$((64#z)), $((64#A))-$((64#Z)), $((64#@)), $(( 64#_ ))
## stdout: 10-35, 36-61, 62, 63
## N-I dash stdout-json: ""
## N-I dash status: 2
## N-I mksh/zsh stdout-json: ""
## N-I mksh/zsh status: 1

#### Multiple digit constants with base N
echo $((10#0123)), $((16#1b))
## stdout: 123, 27
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Dynamic base constants
base=16
echo $(( ${base}#a ))
## stdout: 10
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Octal constant
echo $(( 011 ))
## stdout: 9
## N-I mksh/zsh stdout: 11

#### Dynamic octal constant
zero=0
echo $(( ${zero}11 ))
## stdout: 9
## N-I mksh/zsh stdout: 11

#### Dynamic hex constants
zero=0
echo $(( ${zero}xAB ))
## stdout: 171

#### Hex constant with capital X
echo $(( 0XAA ))
## stdout: 170

#### Dynamic var names - result of runtime parse/eval
foo=5
x=oo
echo $(( foo + f$x + 1 ))
## stdout: 11

#### Recursive name evaluation is a result of runtime parse/eval
foo=5
bar=foo
spam=bar
eggs=spam
echo $((foo+1)) $((bar+1)) $((spam+1)) $((eggs+1))
## stdout: 6 6 6 6
## N-I dash stdout-json: ""
## N-I dash status: 2

#### nounset with arithmetic
set -o nounset
x=$(( y + 5 ))
echo "should not get here: x=${x:-<unset>}"
## stdout-json: ""
## status: 1
## BUG dash/mksh/zsh stdout: should not get here: x=5
## BUG dash/mksh/zsh status: 0

#### 64-bit integer doesn't overflow
## SKIP (unimplementable): JavaScript uses 32-bit signed integers for bitwise operations

a=$(( 1 << 31 ))
echo $a

b=$(( a + a ))
echo $b

c=$(( b + a ))
echo $c

x=$(( 1 << 62 ))
y=$(( x - 1 ))
echo "max positive = $(( x + y ))"

#echo "overflow $(( x + x ))"

## STDOUT:
2147483648
4294967296
6442450944
max positive = 9223372036854775807
## END

# mksh still uses int!
## BUG mksh STDOUT:
-2147483648
0
-2147483648
max positive = 2147483647
## END

#### More 64-bit ops
case $SH in dash) exit ;; esac

#shopt -s strict_arith

# This overflows - the extra 9 puts it above 2**31
#echo $(( 12345678909 ))

[[ 12345678909 = $(( 1 << 30 )) ]]
echo eq=$?
[[ 12345678909 = 12345678909 ]]
echo eq=$?

# Try both [ and [[
[ 12345678909 -gt $(( 1 << 30 )) ]
echo greater=$?
[[ 12345678909 -gt $(( 1 << 30 )) ]]
echo greater=$?

[[ 12345678909 -ge $(( 1 << 30 )) ]]
echo ge=$?
[[ 12345678909 -ge 12345678909 ]]
echo ge=$?

[[ 12345678909 -le $(( 1 << 30 )) ]]
echo le=$?
[[ 12345678909 -le 12345678909 ]]
echo le=$?

## STDOUT:
eq=1
eq=0
greater=0
greater=0
ge=0
ge=0
le=1
le=0
## END
## N-I dash STDOUT:
## END
## BUG mksh STDOUT:
eq=1
eq=0
greater=1
greater=1
ge=1
ge=0
le=0
le=0
## END

# mksh still uses int!

#### Invalid LValue
a=9
(( (a + 2) = 3 ))
echo $a
## status: 2
## stdout-json: ""
## OK bash/mksh/zsh stdout: 9
## OK bash/mksh/zsh status: 0
#   dash doesn't implement assignment
## N-I dash status: 2
## N-I dash stdout-json: ""

#### Invalid LValue that looks like array
(( 1[2] = 3 ))
echo "status=$?"
## status: 1
## stdout-json: ""

## OK bash stdout: status=1
## OK bash status: 0

## OK mksh/zsh stdout: status=2
## OK mksh/zsh status: 0

## N-I dash stdout: status=127
## N-I dash status: 0

#### Invalid LValue: two sets of brackets
(( a[1][2] = 3 ))
echo "status=$?"
#   shells treat this as a NON-fatal error
## status: 2
## stdout-json: ""
## OK bash stdout: status=1
## OK mksh/zsh stdout: status=2
## OK bash/mksh/zsh status: 0
#   dash doesn't implement assignment
## N-I dash stdout: status=127
## N-I dash status: 0

#### Operator Precedence
echo $(( 1 + 2*3 - 8/2 ))
## stdout: 3

#### Exponentiation with **
echo $(( 3 ** 0 ))
echo $(( 3 ** 1 ))
echo $(( 3 ** 2 ))
## STDOUT:
1
3
9
## END
## N-I dash stdout-json: ""
## N-I dash status: 2
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### Exponentiation operator has buggy precedence
# NOTE: All shells agree on this, but R and Python give -9, which is more
# mathematically correct.
echo $(( -3 ** 2 ))
## stdout: 9
## N-I dash stdout-json: ""
## N-I dash status: 2
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### Negative exponent
# bash explicitly disallows negative exponents!
echo $(( 2**-1 * 5 ))
## stdout-json: ""
## status: 1
## OK zsh stdout: 2.5
## OK zsh status: 0
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Comment not allowed in the middle of multiline arithmetic
echo $((
1 +
2 + \
3
))
echo $((
1 + 2  # not a comment
))
(( a = 3 + 4  # comment
))
echo [$a]
## status: 1
## STDOUT:
6
## END
## OK dash/osh status: 2
## OK bash STDOUT:
6
[]
## END
## OK bash status: 0

#### Add integer to indexed array (a[0] decay)
declare -a array=(1 2 3)
echo $((array + 5))
## status: 0
## STDOUT:
6
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## N-I mksh/zsh status: 1
## N-I mksh/zsh stdout-json: ""

#### Add integer to associative array (a[0] decay)
typeset -A assoc
assoc[0]=42
echo $((assoc + 5))
## status: 0
## stdout: 47
## BUG dash status: 0
## BUG dash stdout: 5

#### Double subscript
a=(1 2 3)
echo $(( a[1] ))
echo $(( a[1][1] ))
## status: 1
## OK osh status: 2
## STDOUT:
2
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## OK zsh STDOUT:
1
## END

#### result of ArithSub -- array[0] decay
a=(4 5 6)
echo declared
b=$(( a ))
echo $b

## status: 0
## STDOUT:
declared
4
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## N-I zsh status: 1
## N-I zsh STDOUT:
declared
## END

#### result of ArithSub -- assoc[0] decay
declare -A A=(['foo']=bar ['spam']=eggs)
echo declared
b=$(( A ))
echo $b

## status: 0
## STDOUT:
declared
0
## END

## N-I mksh status: 1
## N-I mksh stdout-json: ""


## N-I dash status: 2
## N-I dash stdout-json: ""

#### comma operator
a=(4 5 6)

# zsh and osh can't evaluate the array like that
# which is consistent with their behavior on $(( a ))

echo $(( a, last = a[2], 42 ))
echo last=$last

## status: 0
## STDOUT:
42
last=6
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## N-I zsh status: 1
## N-I zsh stdout-json: ""


#### assignment with dynamic var name
foo=bar
echo $(( x$foo = 42 ))
echo xbar=$xbar
## STDOUT:
42
xbar=42
## END

#### array assignment with dynamic array name
foo=bar
echo $(( x$foo[5] = 42 ))
echo "xbar[5]="${xbar[5]}
## STDOUT:
42
xbar[5]=42
## END
## BUG zsh STDOUT:
42
xbar[5]=
## END
## N-I dash status: 2
## N-I dash stdout-json: ""

#### unary assignment with dynamic var name
foo=bar
xbar=42
echo $(( x$foo++ ))
echo xbar=$xbar
## STDOUT:
42
xbar=43
## END
## BUG dash status: 2
## BUG dash stdout-json: ""

#### unary array assignment with dynamic var name
foo=bar
xbar[5]=42
echo $(( x$foo[5]++ ))
echo "xbar[5]="${xbar[5]}
## STDOUT:
42
xbar[5]=43
## END
## BUG zsh STDOUT:
0
xbar[5]=42
## END
## N-I dash status: 2
## N-I dash stdout-json: ""

#### Dynamic parsing of arithmetic
e=1+2
echo $(( e + 3 ))
[[ e -eq 3 ]] && echo true
[ e -eq 3 ]
echo status=$?
## STDOUT:
6
true
status=2
## END
## BUG mksh STDOUT:
6
true
status=0
## END
## N-I dash status: 2
## N-I dash stdout-json: ""

#### Dynamic parsing on empty string
a=''
echo $(( a ))

a2=' '
echo $(( a2 ))
## STDOUT:
0
0
## END
 
#### nested ternary (bug fix)
echo $((1?2?3:4:5))
## STDOUT:
3
## END

#### 1 ? a=1 : b=2 ( bug fix)
echo $((1 ? a=1 : 42 ))
echo a=$a

# this does NOT work
#echo $((1 ? a=1 : b=2 ))

## STDOUT:
1
a=1
## END
## BUG zsh stdout-json: ""
## BUG zsh status: 1

#### Invalid constant

echo $((a + x42))
echo status=$?

# weird asymmetry -- the above is a syntax error, but this isn't
$SH -c 'echo $((a + 42x))'
echo status=$?

# regression
echo $((a + 42x))
echo status=$?
## status: 1
## STDOUT:
0
status=0
status=1
## END
## OK dash status: 2
## OK dash STDOUT:
0
status=0
status=2
## END
## BUG bash status: 0
## BUG bash STDOUT:
0
status=0
status=1
status=1
## END

#### Negative numbers with integer division /

echo $(( 10 / 3))
echo $((-10 / 3))
echo $(( 10 / -3))
echo $((-10 / -3))

echo ---

a=20
: $(( a /= 3 ))
echo $a

a=-20
: $(( a /= 3 ))
echo $a

a=20
: $(( a /= -3 ))
echo $a

a=-20
: $(( a /= -3 ))
echo $a

## STDOUT:
3
-3
-3
3
---
6
-6
-6
6
## END

#### Negative numbers with %

echo $(( 10 % 3))
echo $((-10 % 3))
echo $(( 10 % -3))
echo $((-10 % -3))

## STDOUT:
1
-1
1
-1
## END

#### Negative numbers with bit shift
## SKIP (unimplementable): JavaScript uses 32-bit signed integers for bitwise operations

echo $(( 5 << 1 ))
echo $(( 5 << 0 ))
$SH -c 'echo $(( 5 << -1 ))'  # implementation defined - OSH fails
echo ---

echo $(( 16 >> 1 ))
echo $(( 16 >> 0 ))
$SH -c 'echo $(( 16 >> -1 ))'  # not sure why this is zero
$SH -c 'echo $(( 16 >> -2 ))'  # also 0
echo ---

## STDOUT:
10
5
---
8
16
---
## END

## OK bash/dash/zsh STDOUT:
10
5
-9223372036854775808
---
8
16
0
0
---
## END

## BUG mksh STDOUT:
10
5
-2147483648
---
8
16
0
0
---
## END

#### undef[0]
case $SH in dash) exit ;; esac

echo ARITH $(( undef[0] ))
echo status=$?
echo

(( undef[0] ))
echo status=$?
echo

echo UNDEF ${undef[0]}
echo status=$?

## STDOUT:
ARITH 0
status=0

status=1

UNDEF
status=0
## END
## N-I dash STDOUT:
## END

#### undef[0] with nounset
case $SH in dash) exit ;; esac

set -o nounset
echo UNSET $(( undef[0] ))
echo status=$?

## status: 1
## STDOUT:
## END

## N-I dash status: 0

## BUG mksh/zsh status: 0
## BUG mksh/zsh STDOUT:
UNSET 0
status=0
## END

## N-I dash STDOUT:
## END

#### s[0] with string abc
case $SH in dash) exit ;; esac

s='abc'
echo abc $(( s[0] )) $(( s[1] ))
echo status=$?
echo

(( s[0] ))
echo status=$?
echo

## STDOUT:
abc 0 0
status=0

status=1

## END
## N-I dash STDOUT:
## END

#### s[0] with string 42 
case $SH in dash) exit ;; esac

s='42'
echo 42 $(( s[0] )) $(( s[1] ))
echo status=$?

## STDOUT:
42 42 0
status=0
## END
## N-I dash STDOUT:
## END

## BUG zsh STDOUT:
42 0 4
status=0
## END

#### s[0] with string '12 34'

s='12 34'
echo '12 34' $(( s[0] )) $(( s[1] ))
echo status=$?

## status: 1
## STDOUT:
## END

## OK dash status: 2

## BUG zsh status: 0
## BUG zsh STDOUT:
12 34 0 1
status=0
## END

# bash prints an error, but doesn't fail

## BUG bash status: 0
## BUG bash STDOUT:
status=1
## END
