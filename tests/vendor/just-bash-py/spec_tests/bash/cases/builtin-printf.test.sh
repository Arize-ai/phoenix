## oils_failures_allowed: 1
## compare_shells: dash bash mksh zsh ash

# printf
# bash-completion uses this odd printf -v construction.  It seems to mostly use
# %s and %q though.
#
# %s should just be
# declare $var='val'
#
# NOTE: 
# /usr/bin/printf %q "'" seems wrong.
# $ /usr/bin/printf  %q "'"
# ''\'''
#
# I suppose it is technically correct, but it looks very ugly.

#### printf with no args
printf
## status: 2
## OK mksh/zsh status: 1
## stdout-json: ""

#### printf -v %s
var=foo
printf -v $var %s 'hello there'
argv.py "$foo"
## STDOUT:
['hello there']
## END
## N-I mksh/zsh/ash STDOUT:
-v['']
## END
## N-I dash STDOUT:
['']
## END

#### printf -v %q
val='"quoted" with spaces and \'

# quote 'val' and store it in foo
printf -v foo %q "$val"
# then round trip back to eval
eval "bar=$foo"

# debugging:
#echo foo="$foo"
#echo bar="$bar"
#echo val="$val"

test "$bar" = "$val" && echo OK
## STDOUT:
OK
## END
## N-I mksh/zsh/ash stdout-json: "-v"
## N-I mksh/zsh/ash status: 1
## N-I dash stdout-json: ""
## N-I dash status: 1

#### printf -v a[1]
a=(a b c)
printf -v 'a[1]' %s 'foo'
echo status=$?
argv.py "${a[@]}"
## STDOUT:
status=0
['a', 'foo', 'c']
## END
## N-I mksh/zsh STDOUT:
-vstatus=0
['a', 'b', 'c']
## END
## N-I dash/ash stdout-json: ""
## N-I dash/ash status: 2

#### printf -v syntax error
printf -v 'a[' %s 'foo'
echo status=$?
## STDOUT:
status=2
## END
## N-I ash/mksh/zsh stdout: -vstatus=0

#### dynamic declare instead of %s
var=foo
declare $var='hello there'
argv.py "$foo"
## STDOUT:
['hello there']
## END
## N-I dash/mksh/ash STDOUT:
['']
## END

#### dynamic declare instead of %q
var=foo
val='"quoted" with spaces and \'
# I think this is bash 4.4 only.
declare $var="${val@Q}"
echo "$foo"
## STDOUT:
'"quoted" with spaces and \'
## END
## OK osh STDOUT:
$'"quoted" with spaces and \\'
## END
## N-I dash/ash stdout-json: ""
## N-I dash/ash status: 2
## N-I mksh STDOUT:

## END
## N-I zsh stdout-json: ""
## N-I zsh status: 1

#### printf -v dynamic scope
case $SH in mksh|zsh|dash|ash) echo not implemented; exit ;; esac
# OK so printf is like assigning to a var.
# printf -v foo %q "$bar" is like
# foo=${bar@Q}
dollar='dollar'
f() {
  local mylocal=foo
  printf -v dollar %q '$'  # assign foo to a quoted dollar
  printf -v mylocal %q 'mylocal'
  echo dollar=$dollar
  echo mylocal=$mylocal
}
echo dollar=$dollar
echo --
f
echo --
echo dollar=$dollar
echo mylocal=$mylocal
## STDOUT:
dollar=dollar
--
dollar=\$
mylocal=mylocal
--
dollar=\$
mylocal=
## END
## OK osh STDOUT:
dollar=dollar
--
dollar='$'
mylocal=mylocal
--
dollar='$'
mylocal=
## END
## N-I dash/ash/mksh/zsh STDOUT:
not implemented
## END

#### printf with too few arguments
printf -- '-%s-%s-%s-\n' 'a b' 'x y'
## STDOUT:
-a b-x y--
## END

#### printf with too many arguments
printf -- '-%s-%s-\n' a b c d e
## STDOUT:
-a-b-
-c-d-
-e--
## END

#### printf width strings
printf '[%5s]\n' abc
printf '[%-5s]\n' abc
## STDOUT:
[  abc]
[abc  ]
## END

#### printf integer
printf '%d\n' 42
printf '%i\n' 42  # synonym
printf '%d\n' \'a # if first character is a quote, use character code
printf '%d\n' \"a # double quotes work too
printf '[%5d]\n' 42
printf '[%-5d]\n' 42
printf '[%05d]\n' 42
#printf '[%-05d]\n' 42  # the leading 0 is meaningless
#[42   ]
## STDOUT:
42
42
97
97
[   42]
[42   ]
[00042]
## END

#### printf %6.4d -- "precision" does padding for integers
printf '[%6.4d]\n' 42
printf '[%.4d]\n' 42
printf '[%6.d]\n' 42
echo --
printf '[%6.4d]\n' -42
printf '[%.4d]\n' -42
printf '[%6.d]\n' -42
## STDOUT:
[  0042]
[0042]
[    42]
--
[ -0042]
[-0042]
[   -42]
## END

#### printf %6.4x X o 
printf '[%6.4x]\n' 42
printf '[%.4x]\n' 42
printf '[%6.x]\n' 42
echo --
printf '[%6.4X]\n' 42
printf '[%.4X]\n' 42
printf '[%6.X]\n' 42
echo --
printf '[%6.4o]\n' 42
printf '[%.4o]\n' 42
printf '[%6.o]\n' 42
## STDOUT:
[  002a]
[002a]
[    2a]
--
[  002A]
[002A]
[    2A]
--
[  0052]
[0052]
[    52]
## END

#### %06d zero padding vs. %6.6d
printf '[%06d]\n' 42
printf '[%06d]\n' -42  # 6 TOTAL
echo --
printf '[%6.6d]\n' 42
printf '[%6.6d]\n' -42  # 6 + 1 for the - sign!!!
## STDOUT:
[000042]
[-00042]
--
[000042]
[-000042]
## END

#### %06x %06X %06o
printf '[%06x]\n' 42
printf '[%06X]\n' 42
printf '[%06o]\n' 42
## STDOUT:
[00002a]
[00002A]
[000052]
## END

#### %06s is no-op
printf '(%6s)\n' 42
printf '(%6s)\n' -42
printf '(%06s)\n' 42
printf '(%06s)\n' -42
echo status=$?
## STDOUT:
(    42)
(   -42)
(    42)
(   -42)
status=0
## END
# mksh is stricter
## OK mksh STDOUT:
(    42)
(   -42)
((status=1
## END

#### printf %6.4s does both truncation and padding
printf '[%6s]\n' foo
printf '[%6.4s]\n' foo
printf '[%-6.4s]\n' foo
printf '[%6s]\n' spam-eggs
printf '[%6.4s]\n' spam-eggs
printf '[%-6.4s]\n' spam-eggs
## STDOUT:
[   foo]
[   foo]
[foo   ]
[spam-eggs]
[  spam]
[spam  ]
## END

#### printf %6.0s and %0.0s
printf '[%6.0s]\n' foo
printf '[%0.0s]\n' foo
## STDOUT:
[      ]
[]
## END
## N-I mksh stdout-json: "[      ]\n["
## N-I mksh status: 1

#### printf %6.s and %0.s
printf '[%6.s]\n' foo
printf '[%0.s]\n' foo
## STDOUT:
[      ]
[]
## END
## BUG zsh STDOUT:
[   foo]
[foo]
## END
## N-I mksh stdout-json: "[      ]\n["
## N-I mksh status: 1

#### printf %*.*s (width/precision from args)
printf '[%*s]\n' 9 hello
printf '[%.*s]\n' 3 hello
printf '[%*.3s]\n' 9 hello
printf '[%9.*s]\n' 3 hello
printf '[%*.*s]\n' 9 3 hello
## STDOUT:
[    hello]
[hel]
[      hel]
[      hel]
[      hel]
## END

#### unsigned / octal / hex
printf '[%u]\n' 42
printf '[%o]\n' 42
printf '[%x]\n' 42
printf '[%X]\n' 42
echo

printf '[%X]\n' \'a  # if first character is a quote, use character code
printf '[%X]\n' \'ab # extra chars ignored

## STDOUT:
[42]
[52]
[2a]
[2A]

[61]
[61]
## END

#### unsigned / octal / hex big
## SKIP (unimplementable): 64-bit shift overflow not implemented

for big in $(( 1 << 32 )) $(( (1 << 63) - 1 )); do
  printf '[%u]\n' $big
  printf '[%o]\n' $big
  printf '[%x]\n' $big
  printf '[%X]\n' $big
  echo
done

## STDOUT:
[4294967296]
[40000000000]
[100000000]
[100000000]

[9223372036854775807]
[777777777777777777777]
[7fffffffffffffff]
[7FFFFFFFFFFFFFFF]

## END

## BUG mksh STDOUT:
[1]
[1]
[1]
[1]

[2147483647]
[17777777777]
[7fffffff]
[7FFFFFFF]

## END

#### empty string (osh is more strict)
printf '%d\n' ''
## OK osh stdout-json: ""
## OK osh status: 1
## OK ash status: 1
## STDOUT:
0
## END

#### No char after ' => zero code point

# most shells use 0 here
printf '%d\n' \'
printf '%d\n' \"

## OK mksh status: 1
## STDOUT:
0
0
## END

#### Unicode char with ' 
case $SH in mksh) echo 'weird bug'; exit ;; esac

# the mu character is U+03BC

printf '%x\n' \'μ
printf '%u\n' \'μ
printf '%o\n' \'μ
echo

u3=三
# u4=😘

printf '%x\n' \'$u3
printf '%u\n' \'$u3
printf '%o\n' \'$u3
echo

# mksh DOES respect unicode on the new Debian bookworm.
# but even building the SAME SOURCE from scratch, somehow it doesn't on Ubuntu 8.
# TBH I should probably just upgrade the mksh version.
#
# $ ./mksh -c 'printf "%u\n" \"$1' dummy $'\u03bc'
# printf: warning: : character(s) following character constant have been ignored
# 206
# 
# andy@lenny:~/wedge/oils-for-unix.org/pkg/mksh/R52c$ cat /etc/os-release
# NAME="Ubuntu"
# VERSION="18.04.5 LTS (Bionic Beaver)"
# ID=ubuntu
# ID_LIKE=debian
# PRETTY_NAME="Ubuntu 18.04.5 LTS"
# VERSION_ID="18.04"
# HOME_URL="https://www.ubuntu.com/"
# SUPPORT_URL="https://help.ubuntu.com/"
# BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
# PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy"
# VERSION_CODENAME=bionic
# UBUNTU_CODENAME=bionic
# andy@lenny:~/wedge/oils-for-unix.org/pkg/mksh/R52c$ env|egrep 'LC|LANG'
# LANG=en_US.UTF-8
# andy@lenny:~/wedge/oils-for-unix.org/pkg/mksh/R52c$ LC_CTYPE=C.UTF-8 ./mksh -c 'printf "%u\n" \"$1' dummy $'\u03bc'
# printf: warning: : character(s) following character constant have been ignored
# 206
# andy@lenny:~/wedge/oils-for-unix.org/pkg/mksh/R52c$ LANG=C.UTF-8 ./mksh -c 'printf "%u\n" \"$1' dummy $'\u03bc'
# printf: warning: : character(s) following character constant have been ignored
# 206
# andy@lenny:~/wedge/oils-for-unix.org/pkg/mksh/R52c$ LC_ALL=C.UTF-8 ./mksh -c 'printf "%u\n" \"$1' dummy $'\u03bc'
# printf: warning: : character(s) following character constant have been ignored
# 206
# andy@lenny:~/wedge/oils-for-unix.org/pkg/mksh/R52c$ LC_ALL=en_US.UTF-8 ./mksh -c 'printf "%u\n" \"$1' dummy $'\u03bc'
# printf: warning: : character(s) following character constant have been ignored
# 206
# andy@lenny:~/wedge/oils-for-unix.org/pkg/mksh/R52c$ LC_ALL=en_US.utf-8 ./mksh -c 'printf "%u\n" \"$1' dummy $'\u03bc'
# printf: warning: : character(s) following character constant have been ignored
# 206


## STDOUT:
3bc
956
1674

4e09
19977
47011

## END
## BUG dash/ash STDOUT:
ce
206
316

e4
228
344

## END

## BUG mksh STDOUT:
weird bug
## END

#### Invalid UTF-8
## SKIP (unimplementable): python2 not available

echo bytes1
not_utf8=$(python2 -c 'print("\xce\xce")')

printf '%x\n' \'$not_utf8
printf '%u\n' \'$not_utf8
printf '%o\n' \'$not_utf8
echo

echo bytes2
not_utf8=$(python2 -c 'print("\xbc\xbc")')
printf '%x\n' \'$not_utf8
printf '%u\n' \'$not_utf8
printf '%o\n' \'$not_utf8
echo

# Copied from data_lang/utf8_test.cc

echo overlong2
overlong2=$(python2 -c 'print("\xC1\x81")')
printf '%x\n' \'$overlong2
printf '%u\n' \'$overlong2
printf '%o\n' \'$overlong2
echo

echo overlong3
overlong3=$(python2 -c 'print("\xE0\x81\x81")')
printf '%x\n' \'$overlong3
printf '%u\n' \'$overlong3
printf '%o\n' \'$overlong3
echo

## STDOUT:
bytes1
ce
206
316

bytes2
bc
188
274

overlong2
c1
193
301

overlong3
e0
224
340

## END


#### Too large
## SKIP (unimplementable): python2 not available
case $SH in mksh) echo 'weird bug'; exit ;; esac

echo too large
too_large=$(python2 -c 'print("\xF4\x91\x84\x91")')
printf '%x\n' \'$too_large
printf '%u\n' \'$too_large
printf '%o\n' \'$too_large
echo

## STDOUT:
too large
111111
1118481
4210421

## END

## BUG dash/ash STDOUT:
too large
f4
244
364

## END

## BUG mksh STDOUT:
weird bug
## END

# osh rejects code points that are too large for a DIFFERENT reason

## OK osh STDOUT:
too large
f4
244
364

## END


#### negative numbers with unsigned / octal / hex
## SKIP (unimplementable): 64-bit printf unsigned/octal/hex not implemented
printf '[%u]\n' -42
echo status=$?

printf '[%o]\n' -42
echo status=$?

printf '[%x]\n' -42
echo status=$?

printf '[%X]\n' -42
echo status=$?

## STDOUT:
[18446744073709551574]
status=0
[1777777777777777777726]
status=0
[ffffffffffffffd6]
status=0
[FFFFFFFFFFFFFFD6]
status=0
## END

# osh DISALLOWS this because the output depends on the machine architecture.
## N-I osh STDOUT:
status=1
status=1
status=1
status=1
## END

#### printf floating point (not required, but they all implement it)
printf '[%f]\n' 3.14159
printf '[%.2f]\n' 3.14159
printf '[%8.2f]\n' 3.14159
printf '[%-8.2f]\n' 3.14159
printf '[%-f]\n' 3.14159
printf '[%-f]\n' 3.14
## STDOUT:
[3.141590]
[3.14]
[    3.14]
[3.14    ]
[3.141590]
[3.140000]
## END
## N-I osh stdout-json: ""
## N-I osh status: 2

#### printf floating point with - and 0
printf '[%8.4f]\n' 3.14
printf '[%08.4f]\n' 3.14
printf '[%8.04f]\n' 3.14  # meaning less 0
printf '[%08.04f]\n' 3.14
echo ---
# these all boil down to the same thing.  The -, 8, and 4 are respected, but
# none of the 0 are.
printf '[%-8.4f]\n' 3.14
printf '[%-08.4f]\n' 3.14
printf '[%-8.04f]\n' 3.14
printf '[%-08.04f]\n' 3.14
## STDOUT:
[  3.1400]
[003.1400]
[  3.1400]
[003.1400]
---
[3.1400  ]
[3.1400  ]
[3.1400  ]
[3.1400  ]
## END
## N-I osh STDOUT:
---
## END
## N-I osh status: 2

#### printf eE fF gG
printf '[%e]\n' 3.14
printf '[%E]\n' 3.14
printf '[%f]\n' 3.14
# bash is the only one that implements %F?  Is it a synonym?
#printf '[%F]\n' 3.14
printf '[%g]\n' 3.14
printf '[%G]\n' 3.14
## STDOUT:
[3.140000e+00]
[3.140000E+00]
[3.140000]
[3.14]
[3.14]
## END
## N-I osh stdout-json: ""
## N-I osh status: 2

#### printf backslash escapes
argv.py "$(printf 'a\tb')"
argv.py "$(printf '\xE2\x98\xA0')"
argv.py "$(printf '\044e')"
argv.py "$(printf '\0377')"  # out of range
## STDOUT:
['a\tb']
['\xe2\x98\xa0']
['$e']
['\x1f7']
## END
## N-I dash STDOUT:
['a\tb']
['\\xE2\\x98\\xA0']
['$e']
['\x1f7']
## END

#### printf octal backslash escapes
argv.py "$(printf '\0377')"
argv.py "$(printf '\377')"
## STDOUT:
['\x1f7']
['\xff']
## END

#### printf unicode backslash escapes
argv.py "$(printf '\u2620')"
argv.py "$(printf '\U0000065f')"
## STDOUT:
['\xe2\x98\xa0']
['\xd9\x9f']
## END
## N-I dash/ash STDOUT:
['\\u2620']
['\\U0000065f']
## END

#### printf invalid backslash escape (is ignored)
printf '[\Z]\n'
## STDOUT:
[\Z]
## END

#### printf % escapes
printf '[%%]\n'
## STDOUT:
[%]
## END

#### printf %c ASCII

printf '%c\n' a
printf '%c\n' ABC
printf '%cZ\n' ABC

## STDOUT:
a
A
AZ
## END

#### printf %c unicode - prints the first BYTE of a string - it does not respect UTF-8

# TODO: in YSH, this should be deprecated
case $SH in dash|ash) exit ;; esac

show_bytes() {
  od -A n -t x1
}
twomu=$'\u03bc\u03bc'
printf '[%s]\n' "$twomu"

# Hm this cuts off a UTF-8 character?
printf '%c' "$twomu" | show_bytes

## STDOUT:
[μμ]
 ce
## END
## N-I dash/ash STDOUT:
## END

#### printf invalid format
printf '%z' 42
echo status=$?
printf '%-z' 42
echo status=$?
## STDOUT:
status=1
status=1
## END
# osh emits parse errors
## OK dash/osh STDOUT:
status=2
status=2
## END

#### printf %q
x='a b'
printf '[%q]\n' "$x"
## STDOUT:
['a b']
## END
## OK bash/zsh STDOUT:
[a\ b]
## END
## N-I ash/dash stdout-json: "["
## N-I ash status: 1
## N-I dash status: 2

#### printf %6q (width)
# NOTE: coreutils /usr/bin/printf does NOT implement this %6q !!!
x='a b'
printf '[%6q]\n' "$x"
printf '[%1q]\n' "$x"
## STDOUT:
[ 'a b']
['a b']
## END
## OK bash/zsh STDOUT:
[  a\ b]
[a\ b]
## END
## N-I mksh/ash/dash stdout-json: "[["
## N-I mksh/ash status: 1
## N-I dash status: 2

#### printf negative numbers
printf '[%d] ' -42
echo status=$?
printf '[%i] ' -42
echo status=$?

# extra LEADING space too
printf '[%d] ' ' -42'
echo status=$?
printf '[%i] ' ' -42'
echo status=$?

# extra TRAILING space too
printf '[%d] ' ' -42 '
echo status=$?
printf '[%i] ' ' -42 '
echo status=$?

# extra TRAILING chars
printf '[%d] ' ' -42z'
echo status=$?
printf '[%i] ' ' -42z'
echo status=$?

exit 0  # ok

## STDOUT:
[-42] status=0
[-42] status=0
[-42] status=0
[-42] status=0
[-42] status=1
[-42] status=1
[-42] status=1
[-42] status=1
## END
# zsh is LESS STRICT
## OK zsh STDOUT:
[-42] status=0
[-42] status=0
[-42] status=0
[-42] status=0
[-42] status=0
[-42] status=0
[0] status=1
[0] status=1
## END

# osh is like zsh but has a hard failure (TODO: could be an option?)
## OK osh STDOUT:
[-42] status=0
[-42] status=0
[-42] status=0
[-42] status=0
[-42] status=0
[-42] status=0
status=1
status=1
## END

# ash is MORE STRICT
## OK ash STDOUT:
[-42] status=0
[-42] status=0
[-42] status=0
[-42] status=0
[0] status=1
[0] status=1
[0] status=1
[0] status=1
## END


#### printf + and space flags
# I didn't know these existed -- I only knew about - and 0 !
printf '[%+d]\n' 42
printf '[%+d]\n' -42
printf '[% d]\n' 42
printf '[% d]\n' -42
## STDOUT:
[+42]
[-42]
[ 42]
[-42]
## END
## N-I osh stdout-json: ""
## N-I osh status: 2

#### printf # flag
# I didn't know these existed -- I only knew about - and 0 !
# Note: '#' flag for integers outputs a prefix ONLY WHEN the value is non-zero
printf '[%#o][%#o]\n' 0 42
printf '[%#x][%#x]\n' 0 42
printf '[%#X][%#X]\n' 0 42
echo ---
# Note: '#' flag for %f, %g always outputs the decimal point.
printf '[%.0f][%#.0f]\n' 3 3
# Note: In addition, '#' flag for %g does not omit zeroes in fraction
printf '[%g][%#g]\n' 3 3
## STDOUT:
[0][052]
[0][0x2a]
[0][0X2A]
---
[3][3.]
[3][3.00000]
## END
## N-I osh STDOUT:
---
## END
## N-I osh status: 2

#### Runtime error for invalid integer
x=3abc
printf '%d\n' $x
echo status=$?
printf '%d\n' xyz
echo status=$?
## STDOUT:
3
status=1
0
status=1
## END
# zsh should exit 1 in both cases
## BUG zsh STDOUT:
0
status=1
0
status=0
## END
# fails but also prints 0 instead of 3abc
## BUG ash STDOUT:
0
status=1
0
status=1
## END
# osh doesn't print anything invalid
## OK osh STDOUT:
status=1
status=1
## END

#### %(strftime format)T
# The result depends on timezone
export TZ=Asia/Tokyo
printf '%(%Y-%m-%d)T\n' 1557978599
export TZ=US/Eastern
printf '%(%Y-%m-%d)T\n' 1557978599
echo status=$?
## STDOUT:
2019-05-16
2019-05-15
status=0
## END
## N-I mksh/zsh/ash STDOUT:
status=1
## END
## N-I dash STDOUT:
status=2
## END

#### %(strftime format)T doesn't respect TZ if not exported
## SKIP (unimplementable): TZ export semantics differ - our interpreter runs in same process so TZ affects libc regardless

# note: this test leaks!  It assumes that /etc/localtime is NOT Portugal.

TZ=Portugal  # NOT exported
localtime=$(printf '%(%Y-%m-%d %H:%M:%S)T\n' 1557978599)

# TZ is respected
export TZ=Portugal
tz=$(printf '%(%Y-%m-%d %H:%M:%S)T\n' 1557978599)

#echo $localtime
#echo $tz

if ! test "$localtime" = "$tz"; then
  echo 'not equal'
fi
## STDOUT:
not equal
## END
## N-I mksh/zsh/ash/dash stdout-json: ""

#### %(strftime format)T TZ in environ but not in shell's memory

# note: this test leaks!  It assumes that /etc/localtime is NOT Portugal.

# TZ is respected
export TZ=Portugal
tz=$(printf '%(%Y-%m-%d %H:%M:%S)T\n' 1557978599)

unset TZ  # unset in the shell, but still in the environment

localtime=$(printf '%(%Y-%m-%d %H:%M:%S)T\n' 1557978599)

if ! test "$localtime" = "$tz"; then
  echo 'not equal'
fi

## STDOUT:
not equal
## END
## N-I mksh/zsh/ash/dash stdout-json: ""

#### %10.5(strftime format)T
# The result depends on timezone
export TZ=Asia/Tokyo
printf '[%10.5(%Y-%m-%d)T]\n' 1557978599
export TZ=US/Eastern
printf '[%10.5(%Y-%m-%d)T]\n' 1557978599
echo status=$?
## STDOUT:
[     2019-]
[     2019-]
status=0
## END
## N-I mksh/zsh/ash STDOUT:
[[status=1
## END
## N-I dash STDOUT:
[[status=2
## END

#### Regression for 'printf x y'
printf x y
printf '%s\n' z
## STDOUT:
xz
## END

#### bash truncates long strftime string at 128
## SKIP (unimplementable): Bash-specific 128-byte strftime buffer truncation - implementation detail

case $SH in ash|dash|mksh|zsh) exit ;; esac

strftime-format() {
  local n=$1

  # Prints increasingly long format strings:
  # %(%Y)T %(%Y)T %(%Y%Y)T ...

  echo -n '%('
  for i in $(seq $n); do
    echo -n '%Y'
  done
  echo -n ')T'
}

printf $(strftime-format 1) | wc --bytes
printf $(strftime-format 10) | wc --bytes
printf $(strftime-format 30) | wc --bytes
printf $(strftime-format 31) | wc --bytes
printf $(strftime-format 32) | wc --bytes

case $SH in
  (*/_bin/cxx-dbg/*)    
    # Ensure that oils-for-unix detects the truncation of a fixed buffer.
    # bash has a buffer of 128.

    set +o errexit
    (
      printf $(strftime-format 1000)
    )
    status=$?
    if test $status -ne 1; then
      echo FAIL
    fi
    ;;
esac

## STDOUT:
4
40
120
124
0
## END
## OK osh STDOUT:
4
40
120
124
128
## END

## N-I ash/dash/mksh/zsh STDOUT:
## END

#### printf positive integer overflow
## SKIP (unimplementable): 64-bit integer edge cases not implemented

# %i seems like a synonym for %d

for fmt in '%u\n' '%d\n'; do
  # bash considers this in range for %u
  # same with mksh
  # zsh cuts everything off after 19 digits
  # ash truncates everything
  printf "$fmt" '18446744073709551615'
  echo status=$?
  printf "$fmt" '18446744073709551616'
  echo status=$?
  echo
done

## STDOUT:
status=1
status=1

status=1
status=1

## END

## OK bash status: 0
## OK bash STDOUT:
18446744073709551615
status=0
18446744073709551615
status=0

9223372036854775807
status=0
9223372036854775807
status=0

## END

## OK dash/mksh status: 0
## OK dash/mksh STDOUT:
18446744073709551615
status=0
18446744073709551615
status=1

9223372036854775807
status=1
9223372036854775807
status=1

## END

## BUG ash status: 0
## BUG ash STDOUT:
18446744073709551615
status=0
0
status=1

0
status=1
0
status=1

## END

## BUG zsh status: 0
## BUG zsh STDOUT:
1844674407370955161
status=0
1844674407370955161
status=0

1844674407370955161
status=0
1844674407370955161
status=0

## END

#### printf negative integer overflow
## SKIP (unimplementable): 64-bit integer edge cases not implemented

# %i seems like a synonym for %d

for fmt in '%u\n' '%d\n'; do

  printf "$fmt" '-18446744073709551615'
  echo status=$?
  printf "$fmt" '-18446744073709551616'
  echo status=$?
  echo
done

## STDOUT:
status=1
status=1

status=1
status=1

## END

## OK bash status: 0
## OK bash STDOUT:
1
status=0
18446744073709551615
status=0

-9223372036854775808
status=0
-9223372036854775808
status=0

## END

## OK dash/mksh status: 0
## OK dash/mksh STDOUT:
1
status=0
18446744073709551615
status=1

-9223372036854775808
status=1
-9223372036854775808
status=1

## END

## BUG zsh status: 0
## BUG zsh STDOUT:
16602069666338596455
status=0
16602069666338596455
status=0

-1844674407370955161
status=0
-1844674407370955161
status=0

## END

## BUG ash status: 0
## BUG ash STDOUT:
0
status=1
0
status=1

0
status=1
0
status=1

## END

#### printf %b does backslash escaping

printf '[%s]\n' '\044'  # escapes not evaluated
printf '[%b]\n' '\044'  # YES, escapes evaluated
echo

printf '[%s]\n' '\x7e'  # escapes not evaluated
printf '[%b]\n' '\x7e'  # YES, escapes evaluated
echo

# not a valid escape
printf '[%s]\n' '\A'
printf '[%b]\n' '\A'

## STDOUT:
[\044]
[$]

[\x7e]
[~]

[\A]
[\A]
## END

## N-I dash STDOUT:
[\044]
[$]

[\x7e]
[\x7e]

[\A]
[\A]
## END

#### printf %b unicode escapes

printf '[%s]\n' '\u03bc'  # escapes not evaluated
printf '[%b]\n' '\u03bc'  # YES, escapes evaluated

## STDOUT:
[\u03bc]
[μ]
## END

## N-I dash/ash STDOUT:
[\u03bc]
[\u03bc]
## END

#### printf %b respects \c early return
printf '[%b]\n' 'ab\ncd\cxy'
echo $?
## STDOUT:
[ab
cd0
## END


#### printf %b supports octal escapes, both \141 and \0141

printf 'three %b\n' '\141'  # di
printf 'four  %b\n' '\0141'
echo

# trailing 9
printf '%b\n' '\1419'
printf '%b\n' '\01419'

# Notes:
#
# - echo -e: 
#   - NO  3 digit octal  - echo -e '\141' does not work
#   - YES 4 digit octal
# - printf %b
#   - YES 3 digit octal
#   - YES 4 digit octal
# - printf string (outer)
#   - YES 3 digit octal
#   - NO  4 digit octal
# - $'' and $PS1
#   - YES 3 digit octal
#   - NO  4 digit octal

## STDOUT:
three a
four  a

a9
a9
## END

## N-I zsh STDOUT:
three \141
four  a

\1419
a9
## END

#### printf %b with truncated octal escapes

# 8 is not a valid octal digit

printf '%b\n' '\558'
printf '%b\n' '\0558'
echo

show_bytes() {
  od -A n -t x1
}
printf '%b' '\7' | show_bytes
printf '%b' '\07' | show_bytes
printf '%b' '\007' | show_bytes
printf '%b' '\0007' | show_bytes

## STDOUT:
-8
-8

 07
 07
 07
 07
## END

## N-I zsh STDOUT:
\558
-8

 5c 37
 07
 07
 07
## END

#### printf %d %X support hex 0x5 and octal 055

echo hex
printf '%d\n' 0x55
printf '%X\n' 0x55

echo hex CAPS
printf '%d\n' 0X55
printf '%X\n' 0X55

echo octal 3
printf '%d\n' 055
printf '%X\n' 055

echo octal 4
printf '%d\n' 0055
printf '%X\n' 0055

echo octal 5
printf '%d\n' 00055
printf '%X\n' 00055

## STDOUT:
hex
85
55
hex CAPS
85
55
octal 3
45
2D
octal 4
45
2D
octal 5
45
2D
## END

## BUG zsh STDOUT:
hex
85
55
hex CAPS
85
55
octal 3
55
37
octal 4
55
37
octal 5
55
37
## END

#### printf %d with + prefix (positive sign)

echo decimal
printf '%d\n' +42

echo octal
printf '%d\n' +077

echo hex lowercase
printf '%d\n' +0xab

echo hex uppercase
printf '%d\n' +0XAB

## STDOUT:
decimal
42
octal
63
hex lowercase
171
hex uppercase
171
## END

## BUG zsh STDOUT:
decimal
42
octal
77
hex lowercase
171
hex uppercase
171
## END

#### leading spaces are accepted in value given to %d %X, but not trailing spaces

case $SH in zsh) exit ;; esac

# leading space is allowed
printf '%d\n' ' -123'
echo status=$?
printf '%d\n' ' -123 '
echo status=$?

echo ---

printf '%d\n' ' +077'
echo status=$?

printf '%d\n' ' +0xff'
echo status=$?

printf '%X\n' ' +0xff'
echo status=$?

printf '%x\n' ' +0xff'
echo status=$?

## STDOUT:
-123
status=0
-123
status=1
---
63
status=0
255
status=0
FF
status=0
ff
status=0
## END

## OK osh STDOUT:
-123
status=0
status=1
---
63
status=0
255
status=0
FF
status=0
ff
status=0
## END

## BUG ash STDOUT:
-123
status=0
0
status=1
---
63
status=0
255
status=0
FF
status=0
ff
status=0
## END

## BUG-2 zsh STDOUT:
## END


#### Arbitrary base 64#a is rejected (unlike in shell arithmetic)

printf '%d\n' '64#a'
echo status=$?

# bash, dash, and mksh print 64 and return status 1
# zsh and ash print 0 and return status 1
# OSH rejects it completely (prints nothing) and returns status 1

## STDOUT:
status=1
## END

## OK dash/bash/mksh STDOUT:
64
status=1
## END

## OK zsh/ash STDOUT:
0
status=1
## END
