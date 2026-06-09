## compare_shells: bash dash mksh zsh
## oils_failures_allowed: 0

# Note: zsh passes most of these tests too

#### Case statement
case a in
  a) echo A ;;
  *) echo star ;;
esac

for x in a b; do
  case $x in
    # the pattern is DYNAMIC and evaluated on every iteration
    $x) echo loop ;;
    *) echo star ;;
  esac
done
## STDOUT:
A
loop
loop
## END

#### Case statement with ;;&
# ;;& keeps testing conditions
# NOTE: ;& and ;;& are bash 4 only, not on Mac
case a in
  a) echo A ;;&
  *) echo star ;;&
  *) echo star2 ;;
esac
## status: 0
## STDOUT: 
A
star
star2
## END
## N-I dash stdout-json: ""
## N-I dash status: 2
## N-I zsh stdout-json: ""
## N-I zsh status: 1

#### Case statement with ;&
# ;& ignores the next condition.  Why would that be useful?

for x in aa bb cc dd zz; do
  case $x in
    aa) echo aa ;&
    bb) echo bb ;&
    cc) echo cc ;;
    dd) echo dd ;;
  esac
  echo --
done

## status: 0
## STDOUT:
aa
bb
cc
--
bb
cc
--
cc
--
dd
--
--
## END
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Case with empty condition
case $empty in
  ''|foo) echo match ;;
  *) echo no ;;
esac
## stdout: match

#### Match a literal with a glob character
x='*.py'
case "$x" in
  '*.py') echo match ;;
esac
## stdout: match

#### Match a literal with a glob character with a dynamic pattern
x='b.py'
pat='[ab].py'
case "$x" in
  $pat) echo match ;;
esac
## stdout: match
## BUG zsh stdout-json: ""

#### Quoted literal in glob pattern
x='[ab].py'
pat='[ab].py'
case "$x" in
  "$pat") echo match ;;
esac
## stdout: match

#### Multiple Patterns Match
x=foo
result='-'
case "$x" in
  f*|*o) result="$result X"
esac
echo $result
## stdout: - X

#### Pattern ? matches 1 code point (many bytes), but not multiple code points

# These two code points form a single character.
two_code_points="__$(echo $'\u0061\u0300')__"

# U+0061 is A, and U+0300 is an accent.  
#
# (Example taken from # https://blog.golang.org/strings)
#
# However ? in bash/zsh only counts CODE POINTS.  They do NOT take into account
# this case.

for s in '__a__' '__μ__' "$two_code_points"; do
  case $s in
    __?__)
      echo yes
      ;;
    *)
      echo no
  esac
done
## STDOUT:
yes
yes
no
## END
## BUG dash/mksh STDOUT:
yes
no
no
## END

#### matching the byte 0xff against empty string - DISABLED - CI only bug?

case $SH in *osh) echo soil-ci-buster-slim-bug; exit ;; esac

# This doesn't make a difference on my local machine?
# Is the underlying issue how libc fnmatch() respects Unicode?

#LC_ALL=C
#LC_ALL=C.UTF-8

c=$(printf \\377)

# OSH prints -1 here
#echo "${#c}"

case $c in
  '')   echo a ;;
  "$c") echo b ;;
esac

case "$c" in
  '')   echo a ;;
  "$c") echo b ;;
esac

## STDOUT:
b
b
## END

## OK osh STDOUT:
soil-ci-buster-slim-bug
## END

#### matching every byte against itself

# Why does OSH on the CI machine behave differently?  Probably a libc bug fix
# I'd guess?

sum=0

# note: NUL byte crashes OSH!
for i in $(seq 1 255); do
  hex=$(printf '%x' "$i")
  c="$(printf "\\x$hex")"  # command sub quirk: \n or \x0a turns into empty string

  #echo -n $c | od -A n -t x1
  #echo ${#c}

  case "$c" in
    # Newline matches empty string somehow.  All shells agree.  I guess
    # fnmatch() ignores trailing newline?
    #'')   echo "[empty i=$i hex=$hex c=$c]" ;;
    "$c") sum=$(( sum + 1 )) ;;
    *)   echo "[bug i=$i hex=$hex c=$c]" ;;
  esac
done

echo sum=$sum

## STDOUT:
sum=255
## END

#### \(\) in pattern (regression)
s='foo()'

case $s in
  *\(\)) echo 'match'
esac

case $SH in dash) exit ;; esac  # not implemented

shopt -s extglob

case $s in
  *(foo|bar)'()') echo 'extglob'
esac
## STDOUT:
match
extglob
## END
## N-I dash STDOUT:
match
## END


#### case \n bug regression

case
in esac

## STDOUT:
## END
## status: 2
## OK mksh status: 1
## OK zsh status: 127

