## oils_failures_allowed: 2
## compare_shells: dash bash mksh ash

#### Unquoted words
echo unquoted    words
## stdout: unquoted words

#### Single-quoted
echo 'single   quoted'
## stdout: single   quoted

#### Two single-quoted parts
echo 'two single-quoted pa''rts in one token'
## stdout: two single-quoted parts in one token

#### Unquoted and single quoted
echo unquoted' and single-quoted'
## stdout: unquoted and single-quoted

#### newline inside single-quoted string
echo 'newline
inside single-quoted string'
## STDOUT:
newline
inside single-quoted string
## END

#### Double-quoted
echo "double   quoted"
## stdout: double   quoted

#### Mix of quotes in one word
echo unquoted'  single-quoted'"  double-quoted  "unquoted
## stdout: unquoted  single-quoted  double-quoted  unquoted

#### Var substitution
FOO=bar
echo "==$FOO=="
## stdout: ==bar==

#### Var substitution with braces
FOO=bar
echo foo${FOO}
## stdout: foobar

#### Var substitution with braces, quoted
FOO=bar
echo "foo${FOO}"
## stdout: foobar

#### Var length
FOO=bar
echo "foo${#FOO}"
## stdout: foo3

#### Storing backslashes and then echoing them
# This is a bug fix; it used to cause problems with unescaping.
one='\'
two='\\'
echo $one $two
echo "$one" "$two"
## STDOUT:
\ \\
\ \\
## END
## BUG dash/mksh STDOUT:
\ \
\ \
## END

#### Backslash escapes
echo \$ \| \a \b \c \d \\
## stdout: $ | a b c d \

#### Backslash escapes inside double quoted string
echo "\$ \\ \\ \p \q"
## stdout: $ \ \ \p \q

#### C-style backslash escapes inside double quoted string
# mksh and dash implement POSIX incompatible extensions.  $ ` " \ <newline>
# are the only special ones
echo "\a \b"
## stdout: \a \b
## BUG dash/mksh stdout-json: "\u0007 \u0008\n"

# BUG

#### Literal $
echo $
## stdout: $

#### Quoted Literal $
echo $ "$" $
## stdout: $ $ $

#### Line continuation
echo foo\
$
## stdout: foo$

#### Line continuation inside double quotes
echo "foo\
$"
## stdout: foo$

#### $? split over multiple lines
# Same with $$, etc.  OSH won't do this because $? is a single token.
echo $\
?
## stdout: $?
## OK dash/bash/mksh/ash stdout: 0

#
# Bad quotes
#

# TODO: Also test unterminated quotes inside ${} and $()

#### Unterminated single quote
## code: ls foo bar '
## status: 2
## OK mksh status: 1

#### Unterminated double quote
## code: ls foo bar "
## status: 2
## OK mksh status: 1


#
# TODO: Might be another section?
#

#### Semicolon
echo separated; echo by semi-colon
## STDOUT:
separated
by semi-colon
## END

#
# TODO: Variable substitution operators.
#

#### No tab escapes within single quotes
# dash and mksh allow this, which is a BUG.
# POSIX says: "Enclosing characters in single-quotes ( '' ) shall preserve the
# literal value of each character within the single-quotes. A single-quote
# cannot occur within single-quotes"
echo 'a\tb'
## stdout: a\tb
## BUG dash/mksh stdout-json: "a\tb\n"

# See if it supports ANSI C escapes.  Bash supports this, but dash does NOT.  I
# guess dash you would do IFS=$(printf '\n\t')

#### $''
echo $'foo'
## stdout: foo
## N-I dash stdout: $foo

#### $'' with quotes
echo $'single \' double \"'
## stdout: single ' double "
## N-I dash stdout-json: ""
## N-I dash status: 2

#### $'' with newlines
echo $'col1\ncol2\ncol3'
## STDOUT:
col1
col2
col3
## END
# In dash, \n is special within single quotes
## N-I dash STDOUT:
$col1
col2
col3
## END

#### $'' octal escapes don't have leading 0
# echo -e syntax is echo -e \0377
echo -n $'\001' $'\377' | od -A n -c | sed 's/ \+/ /g'
## STDOUT:
 001 377
## END
## N-I dash STDOUT:
 $ 001 $ 377
## END

#### $'' octal escapes with fewer than 3 chars
echo $'\1 \11 \11 \111' | od -A n -c | sed 's/ \+/ /g'
## STDOUT:
 001 \t \t I \n
## END
## N-I dash STDOUT:
 $ 001 \t \t I \n
## END


#### OSH allows invalid backslashes
case $SH in dash|mksh) exit ;; esac

w=$'\uZ'
x=$'\u{03bc'
y=$'\z'
echo $w $x $y
## STDOUT:
\uZ \u{03bc \z
## END
## N-I dash/mksh stdout-json: ""

#### YSH allows unquoted foo\ bar too
shopt -s ysh:all
touch foo\ bar
ls foo\ bar
## STDOUT:
foo bar
## END

#### $"" is a synonym for ""
echo $"foo"
x=x
echo $"foo $x"
## STDOUT:
foo
foo x
## END
## N-I dash/ash STDOUT:
$foo
$foo x
## END

#### printf supports tabs
# This accepts \t by itself, hm.
printf "c1\tc2\nc3\tc4\n"
## stdout-json: "c1\tc2\nc3\tc4\n"

#### $'' supports \cA escape for Ctrl-A - mask with 0x1f
# note: AT&T ksh supports this too

case $SH in dash|ash) exit ;; esac

show_bytes() {
  # -A n - no file offset
  od -A n -t c -t x1
}

# this isn't special
# mksh doesn't like it
#echo -n $'\c' | show_bytes

echo -n $'\c0\c9-' | show_bytes
echo

# control chars are case insensitive
echo -n $'\ca\cz' | show_bytes
echo

echo -n $'\cA\cZ' | show_bytes
echo

echo -n $'\c-\c+\c"' | show_bytes

## STDOUT:
 020 031   -
  10  19  2d

 001 032
  01  1a

 001 032
  01  1a

  \r  \v 002
  0d  0b  02
## END
## N-I dash/ash STDOUT:
## END

#### \c' is an escape, unlike bash
# mksh and ksh agree this is an esacpe

case $SH in dash|ash) exit ;; esac

show_bytes() {
  # -A n - no file offset
  od -A n -t c -t x1
}

# this isn't special
# mksh doesn't like it
echo -n $'\c'' | show_bytes

## STDOUT:
  \a
  07
## END

## BUG bash status: 2
## BUG bash STDOUT:
## END

## N-I dash/ash STDOUT:
## END
