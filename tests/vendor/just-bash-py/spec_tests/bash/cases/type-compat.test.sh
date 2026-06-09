## compare_shells: bash-4.4

# Tests for bash's type flags on cells.  Hopefully we don't have to implement
# this, but it's good to know the behavior.
#
# OSH follows a Python-ish model of types carried with values/objects, not
# locations.
#
# See https://github.com/oilshell/oil/issues/26


#### declare -i -l -u errors can be silenced - ignore_flags_not_impl
declare -i foo=2+3
echo status=$?
echo foo=$foo
echo

shopt -s ignore_flags_not_impl
declare -i bar=2+3
echo status=$?
echo bar=$bar

## STDOUT:
status=2
foo=

status=0
bar=2+3
## END

# bash doesn't need this

## OK bash STDOUT:
status=0
foo=5

status=0
bar=5
## END

#### declare -i with +=
declare s
s='1 '
s+=' 2 '  # string append

declare -i i
i='1 '
i+=' 2 '  # arith add

declare -i j
j=x  # treated like zero
j+=' 2 '  # arith add

echo "[$s]"
echo [$i]
echo [$j]
## STDOUT:
[1  2 ]
[3]
[2]
## END
## N-I osh STDOUT:
[1  2 ]
[1 2 ]
[x 2 ]
## END

#### declare -i with arithmetic inside strings (Nix, issue 864)
# example
# https://github.com/NixOS/nixpkgs/blob/master/pkgs/stdenv/generic/setup.sh#L379

declare -i s
s='1 + 2'
echo s=$s

declare -a array=(1 2 3)
declare -i item
item='array[1+1]'
echo item=$item

## STDOUT:
s=3
item=3
## END
## N-I osh STDOUT:
s=1 + 2
item=array[1+1]
## END

#### append in arith context
declare s
(( s='1 '))
(( s+=' 2 '))  # arith add
declare -i i
(( i='1 ' ))
(( i+=' 2 ' ))
declare -i j
(( j='x ' ))  # treated like zero
(( j+=' 2 ' ))
echo "$s|$i|$j"
## STDOUT:
3|3|2
## END

#### declare array vs. string: mixing -a +a and () ''
# dynamic parsing of first argument.
declare +a 'xyz1=1'
declare +a 'xyz2=(2 3)'
declare -a 'xyz3=4'
declare -a 'xyz4=(5 6)'
argv.py "${xyz1}" "${xyz2}" "${xyz3[@]}" "${xyz4[@]}"
## STDOUT:
['1', '(2 3)', '4', '5', '6']
## END
## N-I osh STDOUT:
['', '']
## END


#### declare array vs. associative array
# Hm I don't understand why the array only has one element.  I guess because
# index 0 is used twice?
declare -a 'array=([a]=b [c]=d)'
declare -A 'assoc=([a]=b [c]=d)'
argv.py "${#array[@]}" "${!array[@]}" "${array[@]}"
argv.py "${#assoc[@]}" "${!assoc[@]}" "${assoc[@]}"
## STDOUT:
['1', '0', 'd']
['2', 'a', 'c', 'b', 'd']
## END
## N-I osh STDOUT:
['0']
['0']
## END


#### declare -l -u

declare -l lower=FOO
declare -u upper=foo

echo $lower
echo $upper

# other:
# -t trace
# -I inherit attributes

## STDOUT:
foo
FOO
## END

## N-I osh STDOUT:
FOO
foo
## END
