# Test ${x/pat*/replace}
# TODO: can add $BUSYBOX_ASH

## oils_failures_allowed: 2
## compare_shells: bash mksh zsh

#### Pattern replacement
v=abcde
echo ${v/c*/XX}
## stdout: abXX

#### Pattern replacement on unset variable
echo -${v/x/y}-
echo status=$?
set -o nounset  # make sure this fails
echo -${v/x/y}-
## STDOUT:
--
status=0
## BUG mksh STDOUT:
# patsub disrespects nounset!
--
status=0
--
## status: 1
## OK ash status: 2
## BUG mksh status: 0

#### Global Pattern replacement with /
s=xx_xx_xx
echo ${s/xx?/yy_} ${s//xx?/yy_}
## stdout: yy_xx_xx yy_yy_xx

#### Left Anchored Pattern replacement with #
s=xx_xx_xx
echo ${s/?xx/_yy} ${s/#?xx/_yy}
## stdout: xx_yy_xx xx_xx_xx

#### Right Anchored Pattern replacement with %
s=xx_xx_xx
echo ${s/?xx/_yy} ${s/%?xx/_yy}
## STDOUT:
xx_yy_xx xx_xx_yy
## END
## BUG ash STDOUT:
xx_yy_xx xx_xx_xx
## END

#### Replace fixed strings
s=xx_xx
echo ${s/xx/yy} ${s//xx/yy} ${s/#xx/yy} ${s/%xx/yy}
## STDOUT:
yy_xx yy_yy yy_xx xx_yy
## END
## BUG ash STDOUT:
yy_xx yy_yy xx_xx xx_xx
## END

#### Replace is longest match
# If it were shortest, then you would just replace the first <html>
s='begin <html></html> end'
echo ${s/<*>/[]}
## stdout: begin [] end

#### Replace char class
s=xx_xx_xx
echo ${s//[[:alpha:]]/y} ${s//[^[:alpha:]]/-}
## stdout: yy_yy_yy xx-xx-xx
## N-I mksh stdout: xx_xx_xx xx_xx_xx

#### Replace hard glob
s='aa*bb+cc'
echo ${s//\**+/__}  # Literal *, then any sequence of characters, then literal +
## stdout: aa__cc

#### ${v/} is empty search and replacement
v=abcde
echo -${v/}-
echo status=$?
## status: 0
## STDOUT:
-abcde-
status=0
## END
## BUG ash STDOUT:
-abcde -
status=0
## END

#### ${v//} is empty search and replacement
v='a/b/c'
echo -${v//}-
echo status=$?
## status: 0
## STDOUT:
-a/b/c-
status=0
## END
## BUG ash STDOUT:
-a/b/c -
status=0
## END

#### Confusing unquoted slash matches bash (and ash)
x='/_/'
echo ${x////c}

echo ${x//'/'/c}

## STDOUT:
c_c
c_c
## END
## BUG mksh STDOUT:
/_/
c_c
## END
## BUG zsh STDOUT:
/c//c_/c/
/_/
## END
## BUG ash STDOUT:
c_c
/_/ /c
## END

#### Synthesized ${x///} bug (similar to above)

# found via test/parse-errors.sh

x='slash / brace } hi'
echo 'ambiguous:' ${x///}

echo 'quoted:   ' ${x//'/'}

# Wow we have all combination here -- TERRIBLE

## STDOUT:
ambiguous: slash brace } hi
quoted:    slash brace } hi
## END
## BUG mksh STDOUT:
ambiguous: slash / brace } hi
quoted:    slash brace } hi
## END
## BUG zsh STDOUT:
ambiguous: slash / brace } hi
quoted:    slash / brace } hi
## END
## BUG ash STDOUT:
ambiguous: slash brace } hi
quoted:    slash / brace } hi
## END


#### ${v/a} is the same as ${v/a/}  -- no replacement string
v='aabb'
echo ${v/a}
echo status=$?
## STDOUT:
abb
status=0
## END

#### Replacement with special chars (bug fix)
v=xx
echo ${v/x/"?"}
## stdout: ?x

#### Replace backslash
v='[\f]'
x='\f'
echo ${v/"$x"/_}

# mksh and zsh differ on this case, but this is consistent with the fact that
# \f as a glob means 'f', not '\f'.  TODO: Warn that it's a bad glob?
# The canonical form is 'f'.
echo ${v/$x/_}

echo ${v/\f/_}
echo ${v/\\f/_}
## STDOUT:
[_]
[\_]
[\_]
[_]
## END
## BUG mksh/zsh STDOUT:
[_]
[_]
[\_]
[_]
## END

#### Replace right ]
v='--]--'
x=']'
echo ${v/"$x"/_}
echo ${v/$x/_}
## STDOUT:
--_--
--_--
## END

#### Substitute glob characters in pattern, quoted and unquoted

# INFINITE LOOP in ash!
case $SH in ash) exit ;; esac

g='*'
v='a*b'
echo ${v//"$g"/-}
echo ${v//$g/-}
## STDOUT:
a-b
-
## END
## BUG zsh STDOUT:
a-b
a-b
## END

#### Substitute one unicode character (UTF-8)
export LANG='en_US.UTF-8'

s='_μ_ and _μ_'

# ? should match one char

echo ${s//_?_/foo}  # all
echo ${s/#_?_/foo}  # left
echo ${s/%_?_/foo}  # right

## STDOUT:
foo and foo
foo and _μ_
_μ_ and foo
## END
## BUG mksh STDOUT:
_μ_ and _μ_
_μ_ and _μ_
_μ_ and _μ_
## END

#### When LC_ALL=C, pattern ? doesn't match multibyte character
## SKIP (unimplementable): Locale settings not supported - JS strings are UTF-16 based
export LC_ALL='C'

s='_μ_ and _μ_'

# ? should match one char

echo ${s//_?_/foo}  # all
echo ${s/#_?_/foo}  # left
echo ${s/%_?_/foo}  # right
echo

a='_x_ and _y_'

echo ${a//_?_/foo}  # all
echo ${a/#_?_/foo}  # left
echo ${a/%_?_/foo}  # right

## STDOUT:
_μ_ and _μ_
_μ_ and _μ_
_μ_ and _μ_

foo and foo
foo and _y_
_x_ and foo
## END

#### ${x/^} regression
x=abc
echo ${x/^}
echo ${x/!}

y=^^^
echo ${y/^}
echo ${y/!}

z=!!!
echo ${z/^}
echo ${z/!}

s=a^b!c
echo ${s/a^}
echo ${s/b!}

## STDOUT:
abc
abc
^^
^^^
!!!
!!
b!c
a^c
## END

#### \(\) in pattern (regression)

# Not extended globs
x='foo()' 
echo 1 ${x//*\(\)/z}
echo 2 ${x//*\(\)/z}
echo 3 ${x//\(\)/z}
echo 4 ${x//*\(\)/z}

## STDOUT:
1 z
2 z
3 fooz
4 z
## END

#### patsub with single quotes and hyphen in character class (regression)

# from Crestwave's bf.bash

program='^++--hello.,world<>[]'
program=${program//[^'><+-.,[]']} 
echo $program
## STDOUT:
++--.,<>[]
## END
## BUG mksh STDOUT:
helloworld
## END

#### patsub with [^]]

# This is a PARSING divergence.  In OSH we match [], rather than using POSIX
# rules!

pat='[^]]'
s='ab^cd^'
echo ${s//$pat/z}
## STDOUT:
ab^cd^
## END

#### [a-z] Invalid range end is syntax error
x=fooz
pat='[z-a]'  # Invalid range.  Other shells don't catch it!
#pat='[a-y]'
echo ${x//$pat}
echo status=$?
## stdout-json: ""
## status: 1
## OK bash/mksh/zsh/ash STDOUT:
fooz
status=0
## END
## OK bash/mksh/zsh/ash status: 0


#### Pattern is empty $foo$bar -- regression for infinite loop

x=-foo-

echo ${x//$foo$bar/bar}

## STDOUT:
-foo-
## END

# feels like memory unsafety in ZSH
## BUG zsh STDOUT:
bar-barfbarobarobar-
## END

#### Chromium from http://www.oilshell.org/blog/2016/11/07.html

case $SH in zsh) exit ;; esac

HOST_PATH=/foo/bar/baz
echo ${HOST_PATH////\\/}

# The way bash parses it
echo ${HOST_PATH//'/'/\\/}

## STDOUT:
\/foo\/bar\/baz
\/foo\/bar\/baz
## END

# zsh has crazy bugs
## BUG zsh stdout-json: ""

## BUG mksh STDOUT:
/foo/bar/baz
\/foo\/bar\/baz
## END


#### ${x//~homedir/}

path=~/git/oilshell

# ~ expansion occurs
#echo path=$path

echo ${path//~/z}

echo ${path/~/z}

## STDOUT:
z/git/oilshell
z/git/oilshell
## END


