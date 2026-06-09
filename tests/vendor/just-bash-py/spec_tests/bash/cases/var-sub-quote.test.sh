## compare_shells: dash bash mksh

# Tests for the args in:
#
# ${foo:-}
#
# I think the weird single quote behavior is a bug, but everyone agrees.  It's
# a consequence of quote removal.
#
# WEIRD: single quoted default, inside double quotes.  Oh I guess this is
# because double quotes don't treat single quotes as special?
#
# OK here is the issue.  If we have ${} bare, then the default is parsed as
# LexState.OUTER.  If we have "${}", then it's parsed as LexState.DQ.  That
# makes sense I guess.  Vim's syntax highlighting is throwing me off.

#### "${empty:-}"
empty=
argv.py "${empty:-}"
## stdout: ['']

#### ${empty:-}
empty=
argv.py ${empty:-}
## stdout: []

#### array with empty values
declare -a A=('' x "" '')
argv.py "${A[@]}"
## stdout: ['', 'x', '', '']
## N-I dash stdout-json: ""
## N-I dash status: 2
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### substitution of IFS character, quoted and unquoted
IFS=:
s=:
argv.py $s
argv.py "$s"
## STDOUT:
['']
[':']
## END

#### :-
empty=''
argv.py ${empty:-a} ${Unset:-b}
## stdout: ['a', 'b']

#### -
empty=''
argv.py ${empty-a} ${Unset-b}
# empty one is still elided!
## stdout: ['b']

#### Inner single quotes
argv.py ${Unset:-'b'}
## stdout: ['b']

#### Inner single quotes, outer double quotes
# This is the WEIRD ONE.  Single quotes appear outside.  But all shells agree!
argv.py "${Unset:-'b'}"
## stdout: ["'b'"]

#### Inner double quotes
argv.py ${Unset:-"b"}
## stdout: ['b']

#### Inner double quotes, outer double quotes
argv.py "${Unset-"b"}"
## stdout: ['b']

#### Multiple words: no quotes
argv.py ${Unset:-a b c}
## stdout: ['a', 'b', 'c']

#### Multiple words: no outer quotes, inner single quotes
argv.py ${Unset:-'a b c'}
## stdout: ['a b c']

#### Multiple words: no outer quotes, inner double quotes
argv.py ${Unset:-"a b c"}
## stdout: ['a b c']

#### Multiple words: outer double quotes, no inner quotes
argv.py "${Unset:-a b c}"
## stdout: ['a b c']

#### Multiple words: outer double quotes, inner double quotes
argv.py "${Unset:-"a b c"}"
## stdout: ['a b c']

#### Multiple words: outer double quotes, inner single quotes
argv.py "${Unset:-'a b c'}"
# WEIRD ONE.
## stdout: ["'a b c'"]

#### Mixed inner quotes
argv.py ${Unset:-"a b" c}
## stdout: ['a b', 'c']

#### Mixed inner quotes with outer quotes
argv.py "${Unset:-"a b" c}"
## stdout: ['a b c']

#### part_value tree with multiple words
## SKIP (unimplementable): Nested expansion with quotes requires major parser changes to track quote context through multiple expansion levels for proper word splitting
argv.py ${a:-${a:-"1 2" "3 4"}5 "6 7"}
## stdout: ['1 2', '3 45', '6 7']

#### part_value tree on RHS
v=${a:-${a:-"1 2" "3 4"}5 "6 7"}
argv.py "${v}"
## stdout: ['1 2 3 45 6 7']

#### Var with multiple words: no quotes
var='a b c'
argv.py ${Unset:-$var}
## stdout: ['a', 'b', 'c']

#### Multiple words: no outer quotes, inner single quotes
var='a b c'
argv.py ${Unset:-'$var'}
## stdout: ['$var']

#### Multiple words: no outer quotes, inner double quotes
var='a b c'
argv.py ${Unset:-"$var"}
## stdout: ['a b c']

#### Multiple words: outer double quotes, no inner quotes
var='a b c'
argv.py "${Unset:-$var}"
## stdout: ['a b c']

#### Multiple words: outer double quotes, inner double quotes
var='a b c'
argv.py "${Unset:-"$var"}"
## stdout: ['a b c']

#### Multiple words: outer double quotes, inner single quotes
# WEIRD ONE.
#
# I think I should just disallow any word with single quotes inside double
# quotes.
var='a b c'
argv.py "${Unset:-'$var'}"
## stdout: ["'a b c'"]

#### No outer quotes, Multiple internal quotes
# It's like a single command word.  Parts are joined directly.
var='a b c'
argv.py ${Unset:-A$var " $var"D E F}
## stdout: ['Aa', 'b', 'c', ' a b cD', 'E', 'F']

#### Strip a string with single quotes, unquoted
foo="'a b c d'"
argv.py ${foo%d\'}
## stdout: ["'a", 'b', 'c']

#### Strip a string with single quotes, double quoted
foo="'a b c d'"
argv.py "${foo%d\'}"
## STDOUT:
["'a b c "]
## END

#### The string to strip is space sensitive
foo='a b c d'
argv.py "${foo%c d}" "${foo%c  d}"
## stdout: ['a b ', 'a b c d']

#### The string to strip can be single quoted, outer is unquoted
foo='a b c d'
argv.py ${foo%'c d'} ${foo%'c  d'}
## stdout: ['a', 'b', 'a', 'b', 'c', 'd']

#### Syntax error for single quote in double quote
foo="'a b c d'"
argv.py "${foo%d'}"
## stdout-json: ""
## status: 2
## OK mksh status: 1

#### "${undef-'c d'}" and "${foo%'c d'}" are parsed differently

# quotes are LITERAL here
argv.py "${undef-'c d'}" "${undef-'c  d'}"
argv.py ${undef-'c d'} ${undef-'c  d'}

echo ---

# quotes are RESPECTED here
foo='a b c d'
argv.py "${foo%'c d'}" "${foo%'c  d'}"

case $SH in dash) exit ;; esac

argv.py "${foo//'c d'/zzz}" "${foo//'c  d'/zzz}"
argv.py "${foo//'c d'/'zzz'}" "${foo//'c  d'/'zzz'}"

## STDOUT:
["'c d'", "'c  d'"]
['c d', 'c  d']
---
['a b ', 'a b c d']
['a b zzz', 'a b c d']
['a b zzz', 'a b c d']
## END
## OK dash STDOUT:
["'c d'", "'c  d'"]
['c d', 'c  d']
---
['a b ', 'a b c d']
## END

#### $'' allowed within VarSub arguments
# Odd behavior of bash/mksh: $'' is recognized but NOT ''!
x=abc
echo ${x%$'b'*}
echo "${x%$'b'*}"  # git-prompt.sh relies on this
## STDOUT:
a
a
## END
## N-I dash STDOUT:
abc
abc
## END

#### # operator with single quoted arg (dash/ash and bash/mksh disagree, reported by Crestwave)
var=a
echo -${var#'a'}-
echo -"${var#'a'}"-
var="'a'"
echo -${var#'a'}-
echo -"${var#'a'}"-
## STDOUT:
--
--
-'a'-
-'a'-
## END
## OK ash STDOUT:
--
-a-
-'a'-
--
## END

#### / operator with single quoted arg (causes syntax error in regex in OSH, reported by Crestwave)
var="++--''++--''"
echo no plus or minus "${var//[+-]}"
echo no plus or minus "${var//['+-']}"
## STDOUT:
no plus or minus ''''
no plus or minus ''''
## END
## status: 0
## BUG ash STDOUT:
no plus or minus ''''
no plus or minus ++--++--
## END
## BUG ash status: 0
## N-I dash stdout-json: ""
## N-I dash status: 2

#### single quotes work inside character classes
x='a[[[---]]]b'
echo "${x//['[]']}"
## STDOUT:
a---b
## END
## BUG ash STDOUT:
a[[[---]]]b
## END
## N-I dash stdout-json: ""
## N-I dash status: 2

#### comparison: :- operator with single quoted arg
echo ${unset:-'a'}
echo "${unset:-'a'}"
## STDOUT:
a
'a'
## END


#### Right Brace as argument (similar to #702)

echo "${var-}}"
echo "${var-\}}"
echo "${var-'}'}"
echo "${var-"}"}"
## STDOUT:
}
}
''}
}
## END
## BUG bash STDOUT:
}
}
'}'
}
## END
## BUG yash STDOUT:
}
}
}
}
## END

#### Var substitution with newlines (#2492)
echo "${var-a \
b}"
echo "${var-a
b}"

echo "${var:-c \
d}"
echo "${var:-c
d}"

var=set
echo "${var:+e \
f}"
echo "${var:+e
f}"

## STDOUT:
a b
a
b
c d
c
d
e f
e
f
## END


#### Var substitution with \n in value
echo "${var-a\nb}"
echo "${var:-c\nd}"
var=val
echo "${var:+e\nf}"

## STDOUT:
a\nb
c\nd
e\nf
## END
## BUG dash/mksh STDOUT:
a
b
c
d
e
f
## END
