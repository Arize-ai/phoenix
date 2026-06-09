## compare_shells: bash mksh zsh ash

# dash doesn't have echo -e, $'', etc.

# TODO: fix J8 bug causing failure

# Cross-cutting test of serialization formats.  That is, what J8 Notation
# should fix.
#
# TODO: Also see spec/xtrace for another use case.

#### printf %q newline
case $SH in ash) return ;; esac  # yash and ash don't implement this

newline=$'one\ntwo'
printf '%q\n' "$newline"

quoted="$(printf '%q\n' "$newline")"
restored=$(eval "echo $quoted")
test "$newline" = "$restored" && echo roundtrip-ok

## STDOUT:
$'one\ntwo'
roundtrip-ok
## END
## OK mksh STDOUT:
'one'$'\n''two'
roundtrip-ok
## END
## OK zsh STDOUT:
one$'\n'two
roundtrip-ok
## END
## N-I ash stdout-json: ""

#### printf %q spaces
case $SH in ash) return ;; esac  # yash and ash don't implement this

# bash does a weird thing and uses \

spaces='one two'
printf '%q\n' "$spaces"

## STDOUT:
'one two'
## END
## OK bash/zsh STDOUT:
one\ two
## END
## N-I ash stdout-json: ""

#### printf %q quotes
case $SH in ash) return ;; esac  # yash and ash don't implement %q

quotes=\'\"
printf '%q\n' "$quotes"

quoted="$(printf '%q\n' "$quotes")"
restored=$(eval "echo $quoted")
test "$quotes" = "$restored" && echo roundtrip-ok

## STDOUT:
\'\"
roundtrip-ok
## END
## OK osh STDOUT:
$'\'"'
roundtrip-ok
## END
## BUG mksh STDOUT:
''\''"'
roundtrip-ok
## END
## N-I ash stdout-json: ""

#### printf %q unprintable
case $SH in ash) return ;; esac  # yash and ash don't implement this

unprintable=$'\xff'
printf '%q\n' "$unprintable"

# bash and zsh agree
## STDOUT:
$'\377'
## END
## OK osh STDOUT:
$'\xff'
## END
## BUG mksh STDOUT:
''$'\377'
## END
## N-I ash stdout-json: ""

#### printf %q unicode
case $SH in ash) return ;; esac  # yash and ash don't implement this

unicode=$'\u03bc'
unicode=$'\xce\xbc'  # does the same thing

printf '%q\n' "$unicode"

# OSH issue: we have quotes.  Isn't that OK?
## STDOUT:
μ
## END
## OK osh STDOUT:
'μ'
## END
## N-I ash stdout-json: ""

#### printf %q invalid unicode
case $SH in ash) return ;; esac

# Hm bash/mksh/zsh understand these.  They are doing decoding and error
# recovery!  inspecting the bash source seems to confirm this.
unicode=$'\xce'
printf '%q\n' "$unicode"

unicode=$'\xce\xce\xbc'
printf '%q\n' "$unicode"

unicode=$'\xce\xbc\xce'
printf '%q\n' "$unicode"

case $SH in mksh) return ;; esac  # it prints unprintable chars here!

unicode=$'\xcea'
printf '%q\n' "$unicode"
unicode=$'a\xce'
printf '%q\n' "$unicode"
## STDOUT:
$'\xce'
$'\xceμ'
$'μ\xce'
$'\xcea'
$'a\xce'
## END
## OK bash STDOUT:
$'\316'
$'\316μ'
$'μ\316'
$'\316a'
$'a\316'
## END
## BUG mksh STDOUT:
''$'\316'
''$'\316''μ'
'μ'$'\316'
## END
## OK zsh STDOUT:
$'\316'
$'\316'μ
μ$'\316'
$'\316'a
a$'\316'
## END
## N-I ash stdout-json: ""

#### set
case $SH in zsh) return ;; esac  # zsh doesn't make much sense

zz=$'one\ntwo'

set | grep zz
## STDOUT:
zz=$'one\ntwo'
## END
## OK ash STDOUT:
zz='one
## END
## BUG zsh stdout-json: ""


#### declare
case $SH in ash|zsh) return ;; esac  # zsh doesn't make much sense

zz=$'one\ntwo'

typeset | grep zz
typeset -p zz

## STDOUT:
zz=$'one\ntwo'
declare -- zz=$'one\ntwo'
## END

## OK mksh STDOUT:
typeset zz
typeset zz=$'one\ntwo'
## BUG zsh stdout-json: ""
## N-I ash stdout-json: ""

#### ${var@Q}
case $SH in zsh|ash) exit ;; esac

zz=$'one\ntwo \u03bc'

# weirdly, quoted and unquoted aren't different
echo ${zz@Q}
echo "${zz@Q}"
## STDOUT:
$'one\ntwo μ'
$'one\ntwo μ'
## END
## OK mksh STDOUT:
$'one
two μ'
$'one
two μ'
## END
## N-I ash/zsh stdout-json: ""

#### xtrace
zz=$'one\ntwo'
set -x
echo "$zz"
## STDOUT:
one
two
## END
## STDERR:
+ echo $'one\ntwo'
## END
## OK bash/ash STDERR:
+ echo 'one
two'
## END
## OK zsh STDERR:
+zsh:3> echo 'one
two'
## END

