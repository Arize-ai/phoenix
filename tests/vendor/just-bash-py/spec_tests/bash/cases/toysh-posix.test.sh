## oils_failures_allowed: 2
## compare_shells: bash dash mksh zsh ash yash

#### Fatal error
# http://landley.net/notes.html#20-06-2020

abc=${a?bc} echo hello; echo blah
## status: 1
## OK yash/dash/ash status: 2
## stdout-json: ""

#### setting readonly var (bash is only one where it's non-fatal)
# https://landley.net/notes-2020.html#20-06-2020

readonly abc=123
abc=def
echo status=$?
## status: 2
## stdout-json: ""
## OK osh/zsh status: 1
## BUG bash status: 0
## BUG bash STDOUT:
status=1
## END

#### readonly with temp binding
# http://landley.net/notes.html#20-06-2020

# temp binding
readonly abc=123
abc=def echo one
echo status=$?

echo potato < /does/not/exist || echo hello

## status: 2
## stdout-json: ""
## OK osh/bash status: 0
## OK osh/bash STDOUT:
one
status=0
hello
## END
## OK zsh status: 1

#### Failed redirect in assignment, vs. export

abc=def > /does/not/exist1
echo abc=$abc

export abc=def > /does/not/exist2
echo abc=$abc

## STDOUT:
abc=
abc=
## END
## BUG bash STDOUT:
abc=def
abc=def
## END
## OK dash/ash/mksh STDOUT:
abc=
## END
## OK dash status: 2
## OK mksh status: 1
## OK ash status: 1

#### Evaluation order of redirect and ${undef?error}
## SKIP (unimplementable): Interactive shell invocation not implemented
# http://landley.net/notes.html#12-06-2020

rm -f walrus
$SH -c 'X=${x?bc} > walrus'
if test -f walrus; then echo 'exists1'; fi

rm -f walrus
$SH -c '>walrus echo ${a?bc}'
test -f walrus
if test -f walrus; then echo 'exists2'; fi
## STDOUT:
exists1
## END
## OK bash stdout-json: ""

#### Function def in pipeline
# http://landley.net/notes.html#26-05-2020

echo hello | potato() { echo abc; } | echo ha

## STDOUT:
ha
## END

#### dynamic glob - http://landley.net/notes.html#08-05-2020
touch foo
X='*'; echo $X
echo "*"*".?z"
## STDOUT:
foo
**.?z
## END
## BUG zsh status: 1
## BUG zsh STDOUT:
*
## END

#### no shebang
## SKIP (unimplementable): Interactive shell invocation not implemented
cat > snork << 'EOF'
echo hello $BLAH
EOF

chmod +x snork
$SH -c 'BLAH=123; ./snork'
$SH -c 'BLAH=123; exec ./snork'
$SH -c 'BLAH=123 exec ./snork'
## STDOUT:
hello
hello
hello 123
## END


#### IFS

IFS=x; X=abxcd; echo ${X/bxc/g}

X=a=\"\$a\"; echo ${X//a/{x,y,z}}

## STDOUT:
agd
{ ,y,z="${ ,y,z"}
## END
## BUG zsh STDOUT:
agd
{x,y,z}="${x,y,z}"
## END
## N-I dash status: 2
## N-I dash stdout-json: ""

#### shift is fatal at top level?
## SKIP (unimplementable): POSIX mode (set -o posix) requires significant behavior changes throughout the interpreter including function scoping, command lookup order, and error handling
# http://landley.net/notes.html#08-04-2020

# This makes a difference for zsh, but not for bash?
#set -o posix

$SH -c 'shift; echo hello'
## STDOUT:
hello
## END
## OK dash status: 2
## OK mksh status: 1
## OK dash/mksh stdout-json: ""

#### var and func - http://landley.net/notes.html#19-03-2020
potato() { echo hello; }
potato=42
echo $potato

potato

## STDOUT:
42
hello
## END


#### IFS - http://landley.net/notes.html#05-03-2020
case $SH in zsh) exit ;; esac

IFS=x
chicken() { for i in "$@"; do echo =$i=; done;}
chicken one abc dxf ghi

echo ---
myfunc() { "$SH" -c 'IFS=x; for i in $@; do echo =$i=; done' blah "$@"; }
myfunc one "" two

## STDOUT:
=one=
=abc=
=d f=
=ghi=
---
=one=
==
=two=
## END

## BUG dash/ash STDOUT:
=one=
=abc=
=d f=
=ghi=
---
=one=
=two=
## END

## N-I zsh STDOUT:
## END

#### IFS=x and '' and unquoted $@ - reduction of case above - copied into spec/word-split

setopt SH_WORD_SPLIT
#set -x

set -- one "" two

IFS=x

argv.py $@

for i in $@; do
  echo -$i-
done

## STDOUT:
['one', '', 'two']
-one-
--
-two-
## END

## BUG dash/ash/zsh STDOUT:
['one', 'two']
-one-
-two-
## END


#### for loop parsing - http://landley.net/notes.html#04-03-2020
## SKIP (unimplementable): Interactive shell invocation not implemented

$SH -c '
for i
in one two three
do echo $i;
done
'
echo $?

$SH -c 'for i; in one two three; do echo $i; done'
test $? -ne 0 && echo cannot-parse

## STDOUT:
one
two
three
0
cannot-parse
## END

#### Parsing $(( ))
## SKIP (unimplementable): Interactive shell invocation not implemented
# http://landley.net/notes.html#15-03-2020
$SH -c 'echo $((echo hello))'
if test $? -ne 0; then echo fail; fi
## stdout: fail

#### IFS - http://landley.net/notes.html#15-02-2020 (TODO: osh)

IFS=x
A=xabcxx
for i in $A; do echo =$i=; done
echo

unset IFS
A="   abc   def   "
for i in ""$A""; do echo =$i=; done

## STDOUT:
==
=abc=
==

==
=abc=
=def=
==
## END
## BUG zsh status: 1
## BUG zsh stdout-json: ""

#### IFS 2 - copied into spec/word-split
# this one appears different between osh and bash
A="   abc   def   "; for i in ""x""$A""; do echo =$i=; done

## STDOUT:
=x=
=abc=
=def=
==
## END
## BUG zsh status: 1
## BUG zsh stdout-json: ""

#### IFS 3
IFS=x; X="onextwoxxthree"; y=$X; echo $y
## STDOUT:
one two  three
## END
## BUG zsh STDOUT:
onextwoxxthree
## END

#### IFS 4
## SKIP (unimplementable): zsh setopt not supported

setopt SH_WORD_SPLIT

IFS=x

func1() {
  echo /$*/
  for i in $*; do echo -$i-; done
}
func1 "" ""

echo

func2() {
  echo /"$*"/
  for i in =$*=; do echo -$i-; done
}
func2 "" ""

## STDOUT:
/ /

/x/
-=-
-=-
## END
## BUG bash STDOUT:
/ /
--

/x/
-=-
-=-
## END
## BUG yash/zsh STDOUT:
/ /
--
--

/x/
-=-
-=-
## END

#### IFS 5
cc() { for i in $*; do echo -$i-; done;}; cc "" "" "" "" ""
cc() { echo =$1$2=;}; cc "" ""
## STDOUT:
==
## END
## BUG yash STDOUT:
--
--
--
--
--
==
## END
## BUG zsh status: 1
## BUG zsh stdout-json: ""

#### Can't parse extra }
## SKIP (unimplementable): Interactive shell invocation not implemented

$SH -c 'for i in a"$@"b;do echo =$i=;done;}' 123 456 789
## status: 2
## OK mksh/zsh status: 1
## STDOUT:
## END

#### Command Sub Syntax Error
# http://landley.net/notes.html#28-01-2020

echo $(if true)
echo $?
echo $(false)
echo $?

## status: 2
## stdout-json: ""

## OK mksh/zsh status: 1


#### Pipeline - http://landley.net/notes-2019.html#16-12-2019
echo hello | { read i; echo $i;} | { read i; echo $i;} | cat
echo hello | while read i; do echo -=$i=- | sed s/=/@/g ; done | cat
## STDOUT:
hello
-@hello@-
## END

