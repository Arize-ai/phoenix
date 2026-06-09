## compare_shells: bash
## oils_failures_allowed: 7

#### Lower Case with , and ,,
x='ABC DEF'
echo ${x,}
echo ${x,,}
echo empty=${empty,}
echo empty=${empty,,}
## STDOUT:
aBC DEF
abc def
empty=
empty=
## END

#### Upper Case with ^ and ^^
x='abc def'
echo ${x^}
echo ${x^^}
echo empty=${empty^}
echo empty=${empty^^}
## STDOUT:
Abc def
ABC DEF
empty=
empty=
## END

#### Case folding - Unicode characters

# https://www.utf8-chartable.de/unicode-utf8-table.pl

x=$'\u00C0\u00C8'  # upper grave
y=$'\u00E1\u00E9'  # lower acute

echo u ${x^}
echo U ${x^^}

echo l ${x,}
echo L ${x,,}

echo u ${y^}
echo U ${y^^}

echo l ${y,}
echo L ${y,,}

## STDOUT:
u ÀÈ
U ÀÈ
l àÈ
L àè
u Áé
U ÁÉ
l áé
L áé
## END

#### Case folding - multi code point
## SKIP (unimplementable): python2 not available

echo shell
small=$'\u00DF'
echo u ${small^}
echo U ${small^^}

echo l ${small,}
echo L ${small,,}
echo

echo python2
python2 -c '
small = u"\u00DF"
print(small.upper().encode("utf-8"))
print(small.lower().encode("utf-8"))
'
echo

# Not in the container images, but python 3 DOES support it!
# This is moved to demo/survey-case-fold.sh

if false; then
echo python3
python3 -c '
import sys
small = u"\u00DF"
sys.stdout.buffer.write(small.upper().encode("utf-8") + b"\n")
sys.stdout.buffer.write(small.lower().encode("utf-8") + b"\n")
'
fi

if false; then
  # Yes, supported
  echo node.js

  nodejs -e '
  var small = "\u00DF"
  console.log(small.toUpperCase())
  console.log(small.toLowerCase())
  '
fi

## STDOUT:
## END
## BUG bash STDOUT:
shell
u ß
U ß
l ß
L ß

python2
ß
ß

## END

#### Case folding that depends on locale (not enabled, requires Turkish locale)

# Hm this works in demo/survey-case-fold.sh
# Is this a bash 4.4 thing?

#export LANG='tr_TR.UTF-8'
#echo $LANG

x='i'

echo u ${x^}
echo U ${x^^}

echo l ${x,}
echo L ${x,,}

## OK bash/osh STDOUT:
u I
U I
l i
L i
## END

#### Lower Case with constant string (VERY WEIRD)
x='AAA ABC DEF'
echo ${x,A}
echo ${x,,A}  # replaces every A only?
## STDOUT:
aAA ABC DEF
aaa aBC DEF
## END

#### Lower Case glob

# Hm with C.UTF-8, this does no case folding?
export LC_ALL=en_US.UTF-8

x='ABC DEF'
echo ${x,[d-f]}
echo ${x,,[d-f]}  # bash 4.4 fixed in bash 5.2.21
## STDOUT:
ABC DEF
ABC DEF
## END

#### ${x@u} U L - upper / lower case (bash 5.1 feature)
# https://www.gnu.org/software/bash/manual/html_node/Shell-Parameter-Expansion.html

x='abc DEF'

echo "${x@u}"

echo "${x@U}"

echo "${x@L}"

## STDOUT:
Abc DEF
ABC DEF
abc def
## END


#### ${x@Q}
x="FOO'BAR spam\"eggs"
eval "new=${x@Q}"
test "$x" = "$new" && echo OK
## STDOUT:
OK
## END

#### ${array@Q} and ${array[@]@Q}
array=(x 'y\nz')
echo ${array[@]@Q}
echo ${array@Q}
echo ${array@Q}
## STDOUT:
'x' 'y\nz'
'x'
'x'
## END
## OK osh STDOUT:
x $'y\\nz'
x
x
## END

#### ${!prefix@} ${!prefix*} yields sorted array of var names
ZOO=zoo
ZIP=zip
ZOOM='one two'
Z='three four'

z=lower

argv.py ${!Z*}
argv.py ${!Z@}
argv.py "${!Z*}"
argv.py "${!Z@}"
for i in 1 2; do argv.py ${!Z*}  ; done
for i in 1 2; do argv.py ${!Z@}  ; done
for i in 1 2; do argv.py "${!Z*}"; done
for i in 1 2; do argv.py "${!Z@}"; done
## STDOUT:
['Z', 'ZIP', 'ZOO', 'ZOOM']
['Z', 'ZIP', 'ZOO', 'ZOOM']
['Z ZIP ZOO ZOOM']
['Z', 'ZIP', 'ZOO', 'ZOOM']
['Z', 'ZIP', 'ZOO', 'ZOOM']
['Z', 'ZIP', 'ZOO', 'ZOOM']
['Z', 'ZIP', 'ZOO', 'ZOOM']
['Z', 'ZIP', 'ZOO', 'ZOOM']
['Z ZIP ZOO ZOOM']
['Z ZIP ZOO ZOOM']
['Z', 'ZIP', 'ZOO', 'ZOOM']
['Z', 'ZIP', 'ZOO', 'ZOOM']
## END

#### ${!prefix@} matches var name (regression)
hello1=1 hello2=2 hello3=3
echo ${!hello@}
hello=()
echo ${!hello@}
## STDOUT:
hello1 hello2 hello3
hello hello1 hello2 hello3
## END

#### ${var@a} for attributes
array=(one two)
echo ${array@a}
declare -r array=(one two)
echo ${array@a}
declare -rx PYTHONPATH=hi
echo ${PYTHONPATH@a}

# bash and osh differ here
#declare -rxn x=z
#echo ${x@a}
## STDOUT:
a
ar
rx
## END

#### ${var@a} error conditions
echo [${?@a}]
## STDOUT:
[]
## END

#### undef and @P @Q @a
$SH -c 'echo ${undef@P}'
echo status=$?
$SH -c 'echo ${undef@Q}'
echo status=$?
$SH -c 'echo ${undef@a}'
echo status=$?
## STDOUT:

status=0

status=0

status=0
## END


#### argv array and @P @Q @a
## SKIP (unimplementable): Interactive shell invocation not implemented
$SH -c 'echo ${@@P}' dummy a b c
echo status=$?
$SH -c 'echo ${@@Q}' dummy a 'b\nc'
echo status=$?
$SH -c 'echo ${@@a}' dummy a b c
echo status=$?
## STDOUT:
a b c
status=0
'a' 'b\nc'
status=0

status=0
## END

#### assoc array and @P @Q @a
## SKIP (unimplementable): Interactive shell invocation not implemented

# note: "y z" causes a bug!
$SH -c 'declare -A A=(["x"]="y"); echo ${A@P} - ${A[@]@P}'
echo status=$?

# note: "y z" causes a bug!
$SH -c 'declare -A A=(["x"]="y"); echo ${A@Q} - ${A[@]@Q}' | sed 's/^- y$/- '\''y'\''/'
echo status=$?

$SH -c 'declare -A A=(["x"]=y); echo ${A@a} - ${A[@]@a}'
echo status=$?
## STDOUT:
- y
status=0
- 'y'
status=0
A - A
status=0
## END

#### ${!var[@]@X}
# note: "y z" causes a bug!
$SH -c 'declare -A A=(["x"]="y"); echo ${!A[@]@P}'
if test $? -ne 0; then echo fail; fi

# note: "y z" causes a bug!
$SH -c 'declare -A A=(["x y"]="y"); echo ${!A[@]@Q}'
if test $? -ne 0; then echo fail; fi

$SH -c 'declare -A A=(["x"]=y); echo ${!A[@]@a}'
if test $? -ne 0; then echo fail; fi
# STDOUT:



# END

#### ${#var@X} is a parse error
## SKIP (unimplementable): Interactive shell invocation not implemented
# note: "y z" causes a bug!
$SH -c 'declare -A A=(["x"]="y"); echo ${#A[@]@P}'
if test $? -ne 0; then echo fail; fi

# note: "y z" causes a bug!
$SH -c 'declare -A A=(["x"]="y"); echo ${#A[@]@Q}'
if test $? -ne 0; then echo fail; fi

$SH -c 'declare -A A=(["x"]=y); echo ${#A[@]@a}'
if test $? -ne 0; then echo fail; fi
## STDOUT:
fail
fail
fail
## END

#### ${!A@a} and ${!A[@]@a}
declare -A A=(["x"]=y)
echo x=${!A[@]@a}
echo invalid=${!A@a}

# OSH prints 'a' for indexed array because the AssocArray with ! turns into
# it.  Disallowing it would be the other reasonable behavior.

## status: 1
## STDOUT:
x=
## END

# Bash succeeds with ${!A@a}, which references the variable named as $A (i.e.,
# '').  This must be a Bash bug since the behavior is inconsistent with the
# fact that ${!undef@a} and ${!empty@a} fail.

## BUG bash status: 0
## BUG bash STDOUT:
x=
invalid=
## END

#### undef vs. empty string in var ops

empty=''
x=x

echo ${x@Q} ${empty@Q} ${undef@Q} ${x@Q}

echo ${x@K} ${empty@K} ${undef@K} ${x@K}

echo ${x@k} ${empty@k} ${undef@k} ${x@k}

echo ${x@A} ${empty@A} ${undef@A} ${x@A}

declare -r x
echo ${x@a} ${empty@a} ${undef@a} ${x@a}

# x x
#echo ${x@E} ${empty@E} ${undef@E} ${x@E}
# x x
#echo ${x@P} ${empty@P} ${undef@P} ${x@P}

## STDOUT:
'x' '' 'x'
'x' '' 'x'
'x' '' 'x'
x='x' empty='' x='x'
r r
## END

#### -o nounset with var ops

set -u
(echo ${undef@Q}); echo "stat: $?"
(echo ${undef@P}); echo "stat: $?"
(echo ${undef@a}); echo "stat: $?"

## STDOUT:
stat: 1
stat: 1
stat: 1
## END


#### ${a[0]@a} and ${a@a}

a=(1 2 3)
echo "attr = '${a[0]@a}'"
echo "attr = '${a@a}'"

## STDOUT:
attr = 'a'
attr = 'a'
## END


#### ${!r@a} with r='a[0]' (attribute for indirect expansion of an array element)
a=(1 2 3)
r='a'
echo ${!r@a}
r='a[0]'
echo ${!r@a}

declare -A d=([0]=foo [1]=bar)
r='d'
echo ${!r@a}
r='d[0]'
echo ${!r@a}

## STDOUT:
a
a
A
A
## END


#### Array expansion with nullary var op @Q
declare -a a=({1..9})
declare -A A=(['a']=hello ['b']=world ['c']=osh ['d']=ysh)

argv.py "${a[@]@Q}"
argv.py "${a[*]@Q}"
argv.py "${A[@]@Q}"
argv.py "${A[*]@Q}"
argv.py "${u[@]@Q}"
argv.py "${u[*]@Q}"

## STDOUT:
['1', '2', '3', '4', '5', '6', '7', '8', '9']
['1 2 3 4 5 6 7 8 9']
['hello', 'world', 'osh', 'ysh']
['hello world osh ysh']
[]
['']
## END

## OK bash STDOUT:
["'1'", "'2'", "'3'", "'4'", "'5'", "'6'", "'7'", "'8'", "'9'"]
["'1' '2' '3' '4' '5' '6' '7' '8' '9'"]
["'ysh'", "'osh'", "'world'", "'hello'"]
["'ysh' 'osh' 'world' 'hello'"]
[]
['']
## END

## OK just-bash STDOUT:
["'1'", "'2'", "'3'", "'4'", "'5'", "'6'", "'7'", "'8'", "'9'"]
["'1' '2' '3' '4' '5' '6' '7' '8' '9'"]
["'hello'", "'world'", "'osh'", "'ysh'"]
["'hello' 'world' 'osh' 'ysh'"]
[]
['']
## END

#### Array expansion with nullary var op @P
declare -a a=({1..9})
declare -A A=(['a']=hello ['b']=world ['c']=osh ['d']=ysh)

argv.py "${a[@]@P}"
argv.py "${a[*]@P}"
argv.py "${A[@]@P}"
argv.py "${A[*]@P}"
argv.py "${u[@]@P}"
argv.py "${u[*]@P}"

## STDOUT:
['1', '2', '3', '4', '5', '6', '7', '8', '9']
['1 2 3 4 5 6 7 8 9']
['hello', 'world', 'osh', 'ysh']
['hello world osh ysh']
[]
['']
## END

## OK bash STDOUT:
['1', '2', '3', '4', '5', '6', '7', '8', '9']
['1 2 3 4 5 6 7 8 9']
['ysh', 'osh', 'world', 'hello']
['ysh osh world hello']
[]
['']
## END


#### Array expansion with nullary var op @a
declare -a a=({1..9})
declare -A A=(['a']=hello ['b']=world ['c']=osh ['d']=ysh)

argv.py "${a[@]@a}"
argv.py "${a[*]@a}"
argv.py "${A[@]@a}"
argv.py "${A[*]@a}"
argv.py "${u[@]@a}"
argv.py "${u[*]@a}"

## STDOUT:
['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a']
['a a a a a a a a a']
['A', 'A', 'A', 'A']
['A A A A']
[]
['']
## END
