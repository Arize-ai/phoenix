## oils_failures_allowed: 0
## compare_shells: bash-4.4 mksh

# NOTE: zsh passes about half, and fails about half.  It supports a subset of
# [[ I guess.

#### [[ glob matching, [[ has no glob expansion
[[ foo.py == *.py ]] && echo true
[[ foo.p  == *.py ]] || echo false
## STDOUT:
true
false
## END

#### [[ glob matching with escapes
[[ 'foo.*' == *."*" ]] && echo true
# note that the pattern arg to fnmatch should be '*.\*'
## stdout: true

#### equality
[[ '*.py' == '*.py' ]] && echo true
[[ foo.py == '*.py' ]] || echo false
## STDOUT:
true
false
## END

#### [[ glob matching with unquoted var
pat=*.py
[[ foo.py == $pat ]] && echo true
[[ foo.p  == $pat ]] || echo false
## STDOUT:
true
false
## END

#### [[ regex matching
# mksh doesn't have this syntax of regex matching.  I guess it comes from perl?
regex='.*\.py'
[[ foo.py =~ $regex ]] && echo true
[[ foo.p  =~ $regex ]] || echo false
## STDOUT:
true
false
## END
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### [[ regex syntax error
# hm, it doesn't show any error, but it exits 2.
[[ foo.py =~ * ]] && echo true
## status: 2
## N-I mksh status: 1

#### [[ has no word splitting
var='one two'
[[ 'one two' == $var ]] && echo true
## stdout: true

#### [[ has quote joining
var='one two'
[[ 'one 'tw"o" == $var ]] && echo true
## stdout: true

#### [[ empty string is false
[[ 'a' ]] && echo true
[[ ''  ]] || echo false
## STDOUT:
true
false
## END

#### && chain
[[ t && t && '' ]] || echo false
## stdout: false

#### || chain
[[ '' || '' || t ]] && echo true
## stdout: true

#### [[ compound expressions
# Notes on whitespace:
# - 1 and == need space seprating them, but ! and ( don't.
# - [[ needs whitesapce after it, but ]] doesn't need whitespace before it!
[[ ''||! (1 == 2)&&(2 == 2)]] && echo true
## stdout: true

# NOTE on the two cases below.  We're comparing
#   (a || b) && c   vs.   a || (b && c)
#
# a = true, b = false, c = false is an example where they are different.
# && and || have precedence inside

#### precedence of && and || inside [[
[[ True || '' && '' ]] && echo true
## stdout: true

#### precedence of && and || in a command context
if test True || test '' && test ''; then
  echo YES
else
  echo "NO precedence"
fi
## stdout: NO precedence

# http://tldp.org/LDP/abs/html/testconstructs.html#DBLBRACKETS

#### Octal literals with -eq
shopt -u strict_arith || true
decimal=15
octal=017   # = 15 (decimal)
[[ $decimal -eq $octal ]] && echo true
[[ $decimal -eq ZZZ$octal ]] || echo false
## STDOUT:
true
false
## END
## N-I mksh stdout: false
# mksh doesn't implement this syntax for literals.

#### Hex literals with -eq
shopt -u strict_arith || true
decimal=15
hex=0x0f    # = 15 (decimal)
[[ $decimal -eq $hex ]] && echo true
[[ $decimal -eq ZZZ$hex ]] || echo false
## STDOUT:
true
false
## END
## N-I mksh stdout: false

# TODO: Add tests for this
# https://www.gnu.org/software/bash/manual/bash.html#Bash-Conditional-Expressions
# When used with [[, the ‘<’ and ‘>’ operators sort lexicographically using the
# current locale. The test command uses ASCII ordering.

#### > on strings
# NOTE: < doesn't need space, even though == does?  That's silly.
[[ b>a ]] && echo true
[[ b<a ]] || echo false
## STDOUT:
true
false
## END

#### != on strings
# NOTE: b!=a does NOT work
[[ b != a ]] && echo true
[[ a != a ]] || echo false
## STDOUT:
true
false
## END

#### -eq on strings 
# This is lame behavior: it does a conversion to 0 first for any string
shopt -u strict_arith || true
[[ a -eq a ]] && echo true
[[ a -eq b ]] && echo true
## STDOUT: 
true
true
## END

#### [[ compare with literal -f (compare with test-builtin.test.sh)
var=-f
[[ $var == -f ]] && echo true
[[ '-f' == $var ]] && echo true
## STDOUT:
true
true
## END

#### [[ with op variable (compare with test-builtin.test.sh)
# Parse error -- parsed BEFORE evaluation of vars
op='=='
[[ a $op a ]] && echo true
[[ a $op b ]] || echo false
## status: 2
## OK mksh status: 1

#### [[ with unquoted empty var (compare with test-builtin.test.sh)
empty=''
[[ $empty == '' ]] && echo true
## stdout: true

#### [[ at runtime doesn't work
dbracket=[[
$dbracket foo == foo ]]
## status: 127

#### [[ with env prefix doesn't work
FOO=bar [[ foo == foo ]]
## status: 127

#### [[ over multiple lines is OK
# Hm it seems you can't split anywhere?
[[ foo == foo
&& bar == bar
]] && echo true
## status: 0
## STDOUT:
true
## END

#### Argument that looks like a real operator
[[ -f < ]] && echo 'should be parse error'
## status: 2
## OK mksh status: 1

#### User array compared to "$@" (broken unless shopt -s strict_array)
# Both are coerced to string!  It treats it more like an  UNQUOTED ${a[@]}.

a=('1 3' 5)
b=(1 2 3)
set -- 1 '3 5'
[[ "$@" = "${a[@]}" ]] && echo true
[[ "$@" = "${b[@]}" ]] || echo false
## STDOUT:
true
false
## END

#### Array coerces to string (shopt -s strict_array to disallow)
a=('1 3' 5)
[[ '1 3 5' = "${a[@]}" ]] && echo true
[[ '1 3 4' = "${a[@]}" ]] || echo false
## STDOUT:
true
false
## END

#### (( array1 == array2 )) doesn't work
a=('1 3' 5)
b=('1 3' 5)
c=('1' '3 5')
d=('1' '3 6')

# shells EXPAND a and b first
(( a == b ))
echo status=$?

(( a == c ))
echo status=$?

(( a == d ))
echo status=$?

## stdout-json: ""
## status: 1
## BUG bash STDOUT:
status=1
status=1
status=1
## END
## BUG bash status: 0

#### Quotes don't matter in comparison
[[ '3' = 3 ]] && echo true
[[ '3' -eq 3 ]] && echo true
## STDOUT:
true
true
## END

#### -eq does dynamic arithmetic parsing (not supported in OSH)
[[ 1+2 -eq 3 ]] && echo true
expr='1+2'
[[ $expr -eq 3 ]] && echo true  # must be dynamically parsed
## STDOUT:
true
true
## END

#### -eq coercion produces weird results
shopt -u strict_arith || true
[[ '' -eq 0 ]] && echo true
## stdout: true

#### [[ '(' ]] is treated as literal
[[ '(' ]]
echo status=$?
## stdout: status=0

#### [[ '(' foo ]] is syntax error
[[ '(' foo ]]
echo status=$?
## status: 2
## OK mksh status: 1

#### empty ! is treated as literal
[[ '!' ]]
echo status=$?
## stdout: status=0

#### [[ -z ]] is syntax error
[[ -z ]]
echo status=$?
## status: 2
## OK mksh status: 1

#### [[ -z '>' ]]
[[ -z '>' ]] || echo false  # -z is operator
## stdout: false

#### [[ -z '>' a ]] is syntax error
[[ -z '>' -- ]]
echo status=$?
## status: 2
## OK mksh status: 1

#### test whether ']]' is empty
[[ ']]' ]]
echo status=$?
## status: 0

#### [[ ]] is syntax error
[[ ]]
echo status=$?
## stdout-json: ""
## status: 2
## OK mksh status: 1

#### [[ && ]] is syntax error
[[ && ]]
echo status=$?
## stdout-json: ""
## status: 2
## OK mksh status: 1

#### [[ a 3< b ]] doesn't work (bug regression)
[[ a 3< b ]]
echo status=$?
[[ a 3> b ]]
echo status=$?
## status: 2

# Hm these shells use the same redirect trick that OSH used to!

## BUG mksh/zsh status: 0
## BUG mksh/zsh STDOUT:
status=0
status=1
## END

#### tilde expansion in [[
HOME=/home/bob
[[ ~ == /home/bob ]]
echo status=$?

[[ ~ == */bob ]]
echo status=$?

[[ ~ == */z ]]
echo status=$?

## STDOUT:
status=0
status=0
status=1
## END

#### more tilde expansion
[[ ~ ]]
echo status=$?
HOME=''
[[ ~ ]]
echo status=$?
[[ -n ~ ]]
echo unary=$?

[[ ~ == ~ ]]
echo status=$?

[[ $HOME == ~ ]]
echo fnmatch=$?
[[ ~ == $HOME ]]
echo fnmatch=$?

## STDOUT:
status=0
status=1
unary=1
status=0
fnmatch=0
fnmatch=0
## END

#### tilde expansion with =~ (confusing)
case $SH in mksh) exit ;; esac

HOME=foo
[[ ~ =~ $HOME ]]
echo regex=$?
[[ $HOME =~ ~ ]]
echo regex=$?

HOME='^a$'  # looks like regex
[[ ~ =~ $HOME ]]
echo regex=$?
[[ $HOME =~ ~ ]]
echo regex=$?

## STDOUT:
regex=0
regex=0
regex=1
regex=0
## END
## OK zsh STDOUT:
regex=0
regex=0
regex=1
regex=1
## END
## N-I mksh stdout-json: ""

#### [[ ]] with redirect
[[ $(stdout_stderr.py) == STDOUT ]] 2>$TMP/x.txt
echo $?
echo --
cat $TMP/x.txt
## STDOUT:
0
--
STDERR
## END

#### special chars
[[ ^ == ^ ]]
echo caret $?
[[ '!' == ! ]]
echo bang $?
## STDOUT:
caret 0
bang 0
## END


#### \(\) in pattern (regression)
if [[ 'foo()' == *\(\) ]]; then echo match1; fi
if [[ 'foo()' == *'()' ]]; then echo match2; fi
if [[ 'foo()' == '*()' ]]; then echo match3; fi

shopt -s extglob

if [[ 'foo()' == *\(\) ]]; then echo match1; fi
if [[ 'foo()' == *'()' ]]; then echo match2; fi
if [[ 'foo()' == '*()' ]]; then echo match3; fi

## STDOUT:
match1
match2
match1
match2
## END

#### negative numbers - zero, decimal, octal, hex, base N

[[ -0 -eq 0 ]]; echo zero=$?

[[ -42 -eq -42 ]]; echo decimal=$?

# note: mksh doesn't do octal conversion
[[ -0123 -eq -83 ]]; echo octal=$?

[[ -0xff -eq -255 ]]; echo hex=$?

[[ -64#a -eq -10 ]]; echo baseN=$?

## STDOUT:
zero=0
decimal=0
octal=0
hex=0
baseN=0
## END

## BUG mksh STDOUT:
zero=0
decimal=0
octal=1
hex=2
baseN=2
## END
