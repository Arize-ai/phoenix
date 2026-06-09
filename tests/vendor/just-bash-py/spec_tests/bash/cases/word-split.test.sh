## compare_shells: bash dash mksh ash yash
## oils_failures_allowed: 2

# NOTE on bash bug:  After setting IFS to array, it never splits anymore?  Even
# if you assign IFS again.

#### IFS is scoped
IFS=b
word=abcd
f() { local IFS=c; argv.py $word; }
f
argv.py $word
## STDOUT:
['ab', 'd']
['a', 'cd']
## END

#### Tilde sub is not split, but var sub is
HOME="foo bar"
argv.py ~
argv.py $HOME
## STDOUT:
['foo bar']
['foo', 'bar']
## END

#### Word splitting
a="1 2"
b="3 4"
argv.py $a"$b"
## STDOUT:
['1', '23 4']
## END

#### Word splitting 2
a="1 2"
b="3 4"
c="5 6"
d="7 8"
argv.py $a"$b"$c"$d"
## STDOUT:
['1', '23 45', '67 8']
## END

# Has tests on differences between  $*  "$*"  $@  "$@"
# http://stackoverflow.com/questions/448407/bash-script-to-receive-and-repass-quoted-parameters

#### $*
fun() { argv.py -$*-; }
fun "a 1" "b 2" "c 3"
## stdout: ['-a', '1', 'b', '2', 'c', '3-']

#### "$*"
fun() { argv.py "-$*-"; }
fun "a 1" "b 2" "c 3"
## stdout: ['-a 1 b 2 c 3-']

#### $@
# How does this differ from $* ?  I don't think it does.
fun() { argv.py -$@-; }
fun "a 1" "b 2" "c 3"
## stdout: ['-a', '1', 'b', '2', 'c', '3-']

#### "$@"
fun() { argv.py "-$@-"; }
fun "a 1" "b 2" "c 3"
## stdout: ['-a 1', 'b 2', 'c 3-']

#### empty argv
argv.py 1 "$@" 2 $@ 3 "$*" 4 $* 5
## stdout: ['1', '2', '3', '', '4', '5']

#### $* with empty IFS
set -- "1 2" "3  4"

IFS=
argv.py $*
argv.py "$*"

## STDOUT:
['1 2', '3  4']
['1 23  4']
## END

#### Word elision with space
s1=' '
argv.py $s1
## stdout: []

#### Word elision with non-whitespace IFS
# Treated differently than the default IFS.  What is the rule here?
IFS='_'
char='_'
space=' '
empty=''
argv.py $char
argv.py $space
argv.py $empty
## STDOUT:
['']
[' ']
[]
## END
## BUG yash STDOUT:
[]
[' ']
[]
## END

#### Leading/trailing word elision with non-whitespace IFS
# This behavior is weird.
IFS=_
s1='_a_b_'
argv.py $s1
## stdout: ['', 'a', 'b']

#### Leading ' ' vs leading ' _ '
# This behavior is weird, but all shells agree.
IFS='_ '
s1='_ a  b _ '
s2='  a  b _ '
argv.py $s1
argv.py $s2
## STDOUT:
['', 'a', 'b']
['a', 'b']
## END

#### Multiple non-whitespace IFS chars.
IFS=_-
s1='a__b---c_d'
argv.py $s1
## stdout: ['a', '', 'b', '', '', 'c', 'd']

#### IFS with whitespace and non-whitepace.
# NOTE: Three delimiters means two empty words in the middle.  No elision.
IFS='_ '
s1='a_b _ _ _ c  _d e'
argv.py $s1
## stdout: ['a', 'b', '', '', 'c', 'd', 'e']

#### empty $@ and $* is elided
fun() { argv.py 1 $@ $* 2; }
fun
## stdout: ['1', '2']

#### unquoted empty arg is elided
empty=""
argv.py 1 $empty 2
## stdout: ['1', '2']

#### unquoted whitespace arg is elided
space=" "
argv.py 1 $space 2
## stdout: ['1', '2']

#### empty literals are not elided
space=" "
argv.py 1 $space"" 2
## stdout: ['1', '', '2']

#### no splitting when IFS is empty
IFS=""
foo="a b"
argv.py $foo
## stdout: ['a b']

#### default value can yield multiple words
argv.py 1 ${undefined:-"2 3" "4 5"} 6
## stdout: ['1', '2 3', '4 5', '6']

#### default value can yield multiple words with part joining
argv.py 1${undefined:-"2 3" "4 5"}6
## stdout: ['12 3', '4 56']

#### default value with unquoted IFS char
IFS=_
argv.py 1${undefined:-"2_3"x_x"4_5"}6
## stdout: ['12_3x', 'x4_56']

#### IFS empty doesn't do splitting
## SKIP (unimplementable): python2 not available
IFS=''
x=$(python2 -c 'print(" a b\tc\n")')
argv.py $x
## STDOUT:
[' a b\tc']
## END

#### IFS unset behaves like $' \t\n'
## SKIP (unimplementable): python2 not available
unset IFS
x=$(python2 -c 'print(" a b\tc\n")')
argv.py $x
## STDOUT:
['a', 'b', 'c']
## END

#### IFS='\'
# NOTE: OSH fails this because of double backslash escaping issue!
IFS='\'
s='a\b'
argv.py $s
## STDOUT:
['a', 'b']
## END

#### IFS='\ '
# NOTE: OSH fails this because of double backslash escaping issue!
# When IFS is \, then you're no longer using backslash escaping.
IFS='\ '
s='a\b \\ c d\'
argv.py $s
## STDOUT:
['a', 'b', '', 'c', 'd']
## END

#### IFS characters are glob metacharacters
IFS='* '
s='a*b c'
argv.py $s

IFS='?'
s='?x?y?z?'
argv.py $s

IFS='['
s='[x[y[z['
argv.py $s
## STDOUT:
['a', 'b', 'c']
['', 'x', 'y', 'z']
['', 'x', 'y', 'z']
## END

#### Trailing space
argv.py 'Xec  ho '
argv.py X'ec  ho '
argv.py X"ec  ho "
## STDOUT:
['Xec  ho ']
['Xec  ho ']
['Xec  ho ']
## END

#### Empty IFS (regression for bug)
IFS=
echo ["$*"]
set a b c
echo ["$*"]
## STDOUT:
[]
[abc]
## END

#### Unset IFS (regression for bug)
set a b c
unset IFS
echo ["$*"]
## STDOUT:
[a b c]
## END

#### IFS=o (regression for bug)
IFS=o
echo hi
## STDOUT:
hi
## END

#### IFS and joining arrays
IFS=:
set -- x 'y z'
argv.py "$@"
argv.py $@
argv.py "$*"
argv.py $*
## STDOUT:
['x', 'y z']
['x', 'y z']
['x:y z']
['x', 'y z']
## END

#### IFS and joining arrays by assignments
IFS=:
set -- x 'y z'

s="$@"
argv.py "$s"

s=$@
argv.py "$s"

s="$*"
argv.py "$s"

s=$*
argv.py "$s"

# bash and mksh agree, but this doesn't really make sense to me.
# In OSH, "$@" is the only real array, so that's why it behaves differently.

## STDOUT:
['x y z']
['x y z']
['x:y z']
['x:y z']
## END
## BUG dash/ash/yash STDOUT:
['x:y z']
['x:y z']
['x:y z']
['x:y z']
## END


# TODO:
# - unquoted args of whitespace are not elided (when IFS = null)
# - empty quoted args are kept
#
# - $* $@ with empty IFS
# - $* $@ with custom IFS
#
# - no splitting when IFS is empty
# - word splitting removes leading and trailing whitespace

# TODO: test framework needs common setup

# Test IFS and $@ $* on all these
#### TODO
empty=""
space=" "
AB="A B"
X="X"
Yspaces=" Y "


#### IFS='' with $@ and $* (bug #627)
set -- a 'b c'
IFS=''
argv.py at $@
argv.py star $*

# zsh agrees
## STDOUT:
['at', 'a', 'b c']
['star', 'a', 'b c']
## END

#### IFS='' with $@ and $* and printf (bug #627)
set -- a 'b c'
IFS=''
printf '[%s]\n' $@
printf '[%s]\n' $*
## STDOUT:
[a]
[b c]
[a]
[b c]
## END

#### IFS='' with ${a[@]} and ${a[*]} (bug #627)
case $SH in dash | ash) exit 0 ;; esac

myarray=(a 'b c')
IFS=''
argv.py at ${myarray[@]}
argv.py star ${myarray[*]}

## STDOUT:
['at', 'a', 'b c']
['star', 'a', 'b c']
## END
## N-I dash/ash stdout-json: ""

#### IFS='' with ${!prefix@} and ${!prefix*} (bug #627)
case $SH in dash | mksh | ash | yash) exit 0 ;; esac

gLwbmGzS_var1=1
gLwbmGzS_var2=2
IFS=''
argv.py at ${!gLwbmGzS_@}
argv.py star ${!gLwbmGzS_*}

## STDOUT:
['at', 'gLwbmGzS_var1', 'gLwbmGzS_var2']
['star', 'gLwbmGzS_var1', 'gLwbmGzS_var2']
## END
## BUG bash STDOUT:
['at', 'gLwbmGzS_var1', 'gLwbmGzS_var2']
['star', 'gLwbmGzS_var1gLwbmGzS_var2']
## END
## N-I dash/mksh/ash/yash stdout-json: ""

#### IFS='' with ${!a[@]} and ${!a[*]} (bug #627)
case $SH in dash | mksh | ash | yash) exit 0 ;; esac

IFS=''
a=(v1 v2 v3)
argv.py at ${!a[@]}
argv.py star ${!a[*]}

## STDOUT:
['at', '0', '1', '2']
['star', '0', '1', '2']
## END
## BUG bash STDOUT:
['at', '0', '1', '2']
['star', '0 1 2']
## END
## N-I dash/mksh/ash/yash stdout-json: ""

#### Bug #628 split on : with : in literal word

# 2025-03: What's the cause of this bug?
#
# OSH is very wrong here
#   ['a', '\\', 'b']
# Is this a fundamental problem with the IFS state machine?
# It definitely relates to the use of backslashes.
# So we have at least 4 backslash bugs

IFS=':'
word='a:'
argv.py ${word}:b
argv.py ${word}:

echo ---

# Same thing happens for 'z'
IFS='z'
word='az'
argv.py ${word}zb
argv.py ${word}z
## STDOUT:
['a', ':b']
['a', ':']
---
['a', 'zb']
['a', 'z']
## END

#### Bug #698, similar crash
var='\'
set -f
echo $var
## STDOUT:
\
## END

#### Bug #1664, \\ with noglob

# Note that we're not changing IFS

argv.py [\\]_
argv.py "[\\]_"

# TODO: no difference observed here, go back to original bug

#argv.py [\\_
#argv.py "[\\_"

echo noglob

# repeat cases with -f, noglob
set -f

argv.py [\\]_
argv.py "[\\]_"

#argv.py [\\_
#argv.py "[\\_"

## STDOUT:
['[\\]_']
['[\\]_']
noglob
['[\\]_']
['[\\]_']
## END


#### Empty IFS bug #2141 (from pnut)

res=0
sum() {
  # implement callee-save calling convention using `set`
  # here, we save the value of $res after the function parameters
  set $@ $res           # $1 $2 $3 are now set
  res=$(($1 + $2))
  echo "$1 + $2 = $res"
  res=$3                # restore the value of $res
}

unset IFS
sum 12 30 # outputs "12 + 30 = 42"

IFS=' '
sum 12 30 # outputs "12 + 30 = 42"

IFS=
sum 12 30 # outputs "1230 + 0 = 1230"

# I added this
IFS=''
sum 12 30

set -u
IFS=
sum 12 30 # fails with "fatal: Undefined variable '2'" on res=$(($1 + $2))

## STDOUT:
12 + 30 = 42
12 + 30 = 42
12 + 30 = 42
12 + 30 = 42
12 + 30 = 42
## END

#### Unicode in IFS

# bash, zsh, and yash support unicode in IFS, but dash/mksh/ash don't.

# for zsh, though we're not testing it here
setopt SH_WORD_SPLIT

x=çx IFS=ç
printf "<%s>\n" $x

## STDOUT:
<>
<x>
## END

## BUG dash/mksh/ash STDOUT:
<>
<>
<x>
## END

#### 4 x 3 table: (default IFS, IFS='', IFS=zx) x ( $* "$*" $@ "$@" )

setopt SH_WORD_SPLIT  # for zsh

set -- 'a b' c ''

# default IFS
argv.py '  $*  '  $*
argv.py ' "$*" ' "$*"
argv.py '  $@  '  $@
argv.py ' "$@" ' "$@"
echo

IFS=''
argv.py '  $*  '  $*
argv.py ' "$*" ' "$*"
argv.py '  $@  '  $@
argv.py ' "$@" ' "$@"
echo

IFS=zx
argv.py '  $*  '  $*
argv.py ' "$*" ' "$*"
argv.py '  $@  '  $@
argv.py ' "$@" ' "$@"

## STDOUT:
['  $*  ', 'a', 'b', 'c']
[' "$*" ', 'a b c ']
['  $@  ', 'a', 'b', 'c']
[' "$@" ', 'a b', 'c', '']

['  $*  ', 'a b', 'c']
[' "$*" ', 'a bc']
['  $@  ', 'a b', 'c']
[' "$@" ', 'a b', 'c', '']

['  $*  ', 'a b', 'c']
[' "$*" ', 'a bzcz']
['  $@  ', 'a b', 'c']
[' "$@" ', 'a b', 'c', '']
## END

# zsh disagrees on
# - $@ with default IFS an
# - $@ with IFS=zx

## BUG zsh STDOUT:
['  $*  ', 'a', 'b', 'c']
[' "$*" ', 'a b c ']
['  $@  ', 'a b', 'c']
[' "$@" ', 'a b', 'c', '']

['  $*  ', 'a b', 'c']
[' "$*" ', 'a bc']
['  $@  ', 'a b', 'c']
[' "$@" ', 'a b', 'c', '']

['  $*  ', 'a b', 'c', '']
[' "$*" ', 'a bzcz']
['  $@  ', 'a b', 'c']
[' "$@" ', 'a b', 'c', '']
## END

## BUG yash STDOUT:
['  $*  ', 'a', 'b', 'c', '']
[' "$*" ', 'a b c ']
['  $@  ', 'a', 'b', 'c', '']
[' "$@" ', 'a b', 'c', '']

['  $*  ', 'a b', 'c', '']
[' "$*" ', 'a bc']
['  $@  ', 'a b', 'c', '']
[' "$@" ', 'a b', 'c', '']

['  $*  ', 'a b', 'c', '']
[' "$*" ', 'a bzcz']
['  $@  ', 'a b', 'c', '']
[' "$@" ', 'a b', 'c', '']
## END

#### 4 x 3 table - with for loop
case $SH in yash) exit ;; esac  # no echo -n

setopt SH_WORD_SPLIT  # for zsh

set -- 'a b' c ''

# default IFS
echo -n '  $*  ';  for i in  $*;  do echo -n ' '; echo -n -$i-; done; echo
echo -n ' "$*" ';  for i in "$*"; do echo -n ' '; echo -n -$i-; done; echo
echo -n '  $@  ';  for i in  $@;  do echo -n ' '; echo -n -$i-; done; echo
echo -n ' "$@" ';  for i in "$@"; do echo -n ' '; echo -n -$i-; done; echo
echo

IFS=''
echo -n '  $*  ';  for i in  $*;  do echo -n ' '; echo -n -$i-; done; echo
echo -n ' "$*" ';  for i in "$*"; do echo -n ' '; echo -n -$i-; done; echo
echo -n '  $@  ';  for i in  $@;  do echo -n ' '; echo -n -$i-; done; echo
echo -n ' "$@" ';  for i in "$@"; do echo -n ' '; echo -n -$i-; done; echo
echo

IFS=zx
echo -n '  $*  ';  for i in  $*;  do echo -n ' '; echo -n -$i-; done; echo
echo -n ' "$*" ';  for i in "$*"; do echo -n ' '; echo -n -$i-; done; echo
echo -n '  $@  ';  for i in  $@;  do echo -n ' '; echo -n -$i-; done; echo
echo -n ' "$@" ';  for i in "$@"; do echo -n ' '; echo -n -$i-; done; echo

## STDOUT:
  $*   -a- -b- -c-
 "$*"  -a b c -
  $@   -a- -b- -c-
 "$@"  -a b- -c- --

  $*   -a b- -c-
 "$*"  -a bc-
  $@   -a b- -c-
 "$@"  -a b- -c- --

  $*   -a b- -c-
 "$*"  -a b c -
  $@   -a b- -c-
 "$@"  -a b- -c- --
## END

## N-I yash STDOUT:
## END

#### IFS=x and '' and $@ - same bug as spec/toysh-posix case #12
case $SH in yash) exit ;; esac  # no echo -n

setopt SH_WORD_SPLIT  # for zsh

set -- one '' two

IFS=zx
echo -n '  $*  ';  for i in  $*;  do echo -n ' '; echo -n -$i-; done; echo
echo -n ' "$*" ';  for i in "$*"; do echo -n ' '; echo -n -$i-; done; echo
echo -n '  $@  ';  for i in  $@;  do echo -n ' '; echo -n -$i-; done; echo
echo -n ' "$@" ';  for i in "$@"; do echo -n ' '; echo -n -$i-; done; echo

argv.py '  $*  '  $*
argv.py ' "$*" ' "$*"
argv.py '  $@  '  $@
argv.py ' "$@" ' "$@"


## OK bash/mksh STDOUT:
  $*   -one- -- -two-
 "$*"  -one  two-
  $@   -one- -- -two-
 "$@"  -one- -- -two-
['  $*  ', 'one', '', 'two']
[' "$*" ', 'onezztwo']
['  $@  ', 'one', '', 'two']
[' "$@" ', 'one', '', 'two']
## END

## STDOUT:
  $*   -one- -two-
 "$*"  -one  two-
  $@   -one- -two-
 "$@"  -one- -- -two-
['  $*  ', 'one', 'two']
[' "$*" ', 'onezztwo']
['  $@  ', 'one', 'two']
[' "$@" ', 'one', '', 'two']
## END

## N-I yash STDOUT:
## END

#### IFS=x and '' and $@ (#2)
setopt SH_WORD_SPLIT  # for zsh

set -- "" "" "" "" ""
argv.py =$@=
argv.py =$*=
echo

IFS=
argv.py =$@=
argv.py =$*=
echo

IFS=x
argv.py =$@=
argv.py =$*=

## STDOUT:
['=', '=']
['=', '=']

['=', '=']
['=', '=']

['=', '=']
['=', '=']
## END

## OK bash/mksh STDOUT:
['=', '=']
['=', '=']

['=', '=']
['=', '=']

['=', '', '', '', '=']
['=', '', '', '', '=']
## END

# yash-2.49 seems to behave in a strange way, but this behavior seems to have
# been fixed at least in yash-2.57.

## BUG yash STDOUT:
['=', '', '', '', '=']
['=', '', '', '', '=']

['=', '', '', '', '=']
['=', '', '', '', '=']

['=', '', '', '', '=']
['=', '', '', '', '=']
## END

#### IFS=x and '' and $@ (#3)
setopt SH_WORD_SPLIT  # for zsh

IFS=x
set -- "" "" "" "" ""

argv.py $*
set -- $*
argv.py $*
set -- $*
argv.py $*
set -- $*
argv.py $*
set -- $*
argv.py $*

## STDOUT:
[]
[]
[]
[]
[]
## END

## OK bash STDOUT:
['', '', '', '']
['', '', '']
['', '']
['']
[]
## END

## OK-2 mksh STDOUT:
['', '', '']
['']
[]
[]
[]
## END

## OK-3 zsh/yash STDOUT:
['', '', '', '', '']
['', '', '', '', '']
['', '', '', '', '']
['', '', '', '', '']
['', '', '', '', '']
## END

#### ""$A"" - empty string on both sides - derived from spec/toysh-posix #15

A="   abc   def   "

argv.py $A
argv.py ""$A""

unset IFS

argv.py $A
argv.py ""$A""

echo

# Do the same thing in a for loop - this is IDENTICAL behavior

for i in $A; do echo =$i=; done
echo

for i in ""$A""; do echo =$i=; done
echo

unset IFS

for i in $A; do echo =$i=; done
echo

for i in ""$A""; do echo =$i=; done

## STDOUT:
['abc', 'def']
['', 'abc', 'def', '']
['abc', 'def']
['', 'abc', 'def', '']

=abc=
=def=

==
=abc=
=def=
==

=abc=
=def=

==
=abc=
=def=
==
## END


#### Regression: "${!v*}"x should not be split
case $SH in dash|mksh|ash|yash) exit 99;; esac
IFS=x
axb=1
echo "${!axb*}"
echo "${!axb*}"x
## STDOUT:
axb
axbx
## END
## N-I dash/mksh/ash/yash status: 99
## N-I dash/mksh/ash/yash STDOUT:
## END


#### Regression: ${!v} should be split
v=hello
IFS=5
echo ${#v}
echo "${#v}"
## STDOUT:

5
## END


#### Regression: "${v:-AxBxC}"x should not be split
IFS=x
v=
echo "${v:-AxBxC}"
echo "${v:-AxBxC}"x  # <-- osh failed this
echo ${v:-AxBxC}
echo ${v:-AxBxC}x
echo ${v:-"AxBxC"}
echo ${v:-"AxBxC"}x
echo "${v:-"AxBxC"}"
echo "${v:-"AxBxC"}"x
## STDOUT:
AxBxC
AxBxCx
A B C
A B Cx
AxBxC
AxBxCx
AxBxC
AxBxCx
## END
