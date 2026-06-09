## compare_shells: dash bash mksh zsh
## oils_failures_allowed: 1

# Test the length oeprator, which dash supports.  Dash doesn't support most
# other ops.

#### String length
v=foo
echo ${#v}
## stdout: 3

#### Unicode string length (UTF-8)
v=$'_\u03bc_'
echo ${#v}
## stdout: 3
## N-I dash stdout: 9
## N-I mksh stdout: 4

#### Unicode string length (mixed byte UTF-8 chars)
# Japanese chars: 3 chars, 9 bytes in UTF-8
v="日本語"
echo ${#v}
# Emoji: 1 char, 4 bytes in UTF-8
v2="😀"
echo ${#v2}
## STDOUT:
3
1
## END
## N-I dash STDOUT:
9
4
## END
## N-I mksh STDOUT:
9
4
## END

#### String length with incomplete utf-8
## SKIP (unimplementable): OSH-specific UTF-8 validation warnings not implemented

#### String length with invalid utf-8 continuation bytes
## SKIP (unimplementable): OSH-specific UTF-8 validation warnings not implemented

#### Length of undefined variable
echo ${#undef}
## stdout: 0

#### Length of undefined variable with nounset
set -o nounset
echo ${#undef}
## status: 1
## OK dash status: 2

#### Length operator can't be followed by test operator
echo ${#x-default}

x=''
echo ${#x-default}

x='foo'
echo ${#x-default}

## status: 2
## OK bash/mksh status: 1
## stdout-json: ""
## BUG zsh status: 0
## BUG zsh STDOUT:
7
0
3
## END
## BUG dash status: 0
## BUG dash STDOUT:
0
0
3
## END

#### ${#s} respects LC_ALL - length in bytes or code points
## SKIP (unimplementable): Locale settings not supported - JS strings are UTF-16 based
case $SH in dash) exit ;; esac

# This test case is sorta "infected" because spec-common.sh sets LC_ALL=C.UTF-8
#
# For some reason mksh behaves differently
#
# See demo/04-unicode.sh

#echo $LC_ALL
unset LC_ALL 

# note: this may depend on the CI machine config
LANG=en_US.UTF-8

#LC_ALL=en_US.UTF-8

for s in $'\u03bc' $'\U00010000'; do
  LC_ALL=
  echo "len=${#s}"

  LC_ALL=C
  echo "len=${#s}"

  echo
done

## STDOUT:
len=1
len=2

len=1
len=4

## END

## N-I dash STDOUT:
## END

## BUG mksh STDOUT:
len=2
len=2

len=3
len=3

## END
