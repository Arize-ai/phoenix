## oils_failures_allowed: 0
## compare_shells: dash bash mksh zsh ash

# TODO mapfile options: -c, -C, -u, etc.

#### echo dashes
echo -
echo --
echo ---
## STDOUT:
-
--
---
## END
## BUG zsh STDOUT:

--
---
## END

#### echo backslashes
echo \\
echo '\'
echo '\\'
echo "\\"
## STDOUT:
\
\
\\
\
## BUG dash/mksh/zsh STDOUT:
\
\
\
\
## END

#### echo -e backslashes
echo -e \\
echo -e '\'
echo -e '\\'
echo -e "\\"
echo

# backslash at end of line
echo -e '\
line2'
## STDOUT:
\
\
\
\

\
line2
## N-I dash STDOUT:
-e \
-e \
-e \
-e \

-e \
line2
## END

## YSH-specific test - commented out
# #### echo builtin should disallow typed args - literal
# echo (42)
# ## status: 2
# ## OK mksh/zsh status: 1
# ## STDOUT:
# ## END

## YSH-specific test - commented out
# #### echo builtin should disallow typed args - variable
# var x = 43
# echo (x)
# ## status: 2
# ## OK mksh/zsh status: 1
# ## STDOUT:
# ## END

#### echo -en
echo -en 'abc\ndef\n'
## STDOUT:
abc
def
## END
## N-I dash STDOUT:
-en abc
def

## END

#### echo -ez (invalid flag)
# bash differs from the other three shells, but its behavior is possibly more
# sensible, if you're going to ignore the error.  It doesn't make sense for
# the 'e' to mean 2 different things simultaneously: flag and literal to be
# printed.
echo -ez 'abc\n'
## STDOUT:
-ez abc\n
## END
## OK dash/mksh/zsh STDOUT:
-ez abc

## END

#### echo -e with embedded newline
flags='-e'
case $SH in dash) flags='' ;; esac

echo $flags 'foo
bar'
## STDOUT:
foo
bar
## END

#### echo -e line continuation
flags='-e'
case $SH in dash) flags='' ;; esac

echo $flags 'foo\
bar'
## STDOUT:
foo\
bar
## END

#### echo -e with C escapes
# https://www.gnu.org/software/bash/manual/bashref.html#Bourne-Shell-Builtins
# not sure why \c is like NUL?
# zsh doesn't allow \E for some reason.
echo -e '\a\b\d\e\f'
## stdout-json: "\u0007\u0008\\d\u001b\u000c\n"
## N-I dash stdout-json: "-e \u0007\u0008\\d\\e\u000c\n"

#### echo -e with whitespace C escapes
echo -e '\n\r\t\v'
## stdout-json: "\n\r\t\u000b\n"
## N-I dash stdout-json: "-e \n\r\t\u000b\n"

#### \0
echo -e 'ab\0cd'
## stdout-json: "ab\u0000cd\n"
## N-I dash stdout-json: "-e ab\u0000cd\n"

#### \c stops processing input
flags='-e'
case $SH in dash) flags='' ;; esac

echo $flags xy  'ab\cde'  'zzz'
## stdout-json: "xy ab"
## N-I mksh stdout-json: "xy abde zzz"

#### echo -e with hex escape
echo -e 'abcd\x65f'
## STDOUT:
abcdef
## END
## N-I dash STDOUT:
-e abcd\x65f
## END

#### echo -e with octal escape
flags='-e'
case $SH in dash) flags='' ;; esac

echo $flags 'abcd\044e'
## STDOUT:
abcd$e
## END

#### echo -e with 4 digit unicode escape
flags='-e'
case $SH in dash) flags='' ;; esac

echo $flags 'abcd\u0065f'
## STDOUT:
abcdef
## END
## N-I dash/ash STDOUT:
abcd\u0065f
## END

#### echo -e with 8 digit unicode escape
flags='-e'
case $SH in dash) flags='' ;; esac

echo $flags 'abcd\U00000065f'
## STDOUT:
abcdef
## END
## N-I dash/ash STDOUT:
abcd\U00000065f
## END

#### \0377 is the highest octal byte
echo -en '\03777' | od -A n -t x1 | sed 's/ \+/ /g'
## STDOUT:
 ff 37
## END
## N-I dash STDOUT:
 2d 65 6e 20 ff 37 0a
## END

#### \0400 is one more than the highest octal byte
# It is 256 % 256 which gets interpreted as a NUL byte.
echo -en '\04000' | od -A n -t x1 | sed 's/ \+/ /g'
## STDOUT:
 00 30
## END
## BUG ash STDOUT:
 20 30 30
## END
## N-I dash STDOUT:
 2d 65 6e 20 00 30 0a
## END

#### \0777 is out of range
flags='-en'
case $SH in dash) flags='-n' ;; esac

echo $flags '\0777' | od -A n -t x1 | sed 's/ \+/ /g'
## STDOUT:
 ff
## END
## BUG mksh STDOUT:
 c3 bf
## END
## BUG ash STDOUT:
 3f 37
## END

#### incomplete hex escape
echo -en 'abcd\x6' | od -A n -c | sed 's/ \+/ /g'
## STDOUT:
 a b c d 006
## END
## N-I dash STDOUT:
 - e n a b c d \ x 6 \n
## END

#### \x
# I consider mksh and zsh a bug because \x is not an escape
echo -e '\x' '\xg' | od -A n -c | sed 's/ \+/ /g'
## STDOUT:
 \ x \ x g \n
## END
## N-I dash STDOUT:
 - e \ x \ x g \n
## END
## BUG mksh/zsh STDOUT:
 \0 \0 g \n
## END

#### incomplete octal escape
flags='-en'
case $SH in dash) flags='-n' ;; esac

echo $flags 'abcd\04' | od -A n -c | sed 's/ \+/ /g'
## STDOUT:
 a b c d 004
## END

#### incomplete unicode escape
echo -en 'abcd\u006' | od -A n -c | sed 's/ \+/ /g'
## STDOUT:
 a b c d 006
## END
## N-I dash STDOUT:
 - e n a b c d \ u 0 0 6 \n
## END
## BUG ash STDOUT:
 a b c d \ u 0 0 6
## END

#### \u6
flags='-en'
case $SH in dash) flags='-n' ;; esac

echo $flags '\u6' | od -A n -c | sed 's/ \+/ /g'
## STDOUT:
 006
## END
## N-I dash/ash STDOUT:
 \ u 6
## END

#### \0 \1 \8
# \0 is special, but \1 isn't in bash
# \1 is special in dash!  geez
flags='-en'
case $SH in dash) flags='-n' ;; esac

echo $flags '\0' '\1' '\8' | od -A n -c | sed 's/ \+/ /g'
## STDOUT:
 \0 \ 1 \ 8
## END
## BUG dash/ash STDOUT:
 \0 001 \ 8
## END


#### echo to redirected directory is an error
mkdir -p dir

echo foo > ./dir
echo status=$?
printf foo > ./dir
echo status=$?

## STDOUT:
status=1
status=1
## END
## OK dash STDOUT:
status=2
status=2
## END

