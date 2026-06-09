## oils_failures_allowed: 0
## compare_shells: dash bash mksh

#### zero args: [ ]
[ ] || echo false
## stdout: false

#### one arg: [ x ] where x is one of '=' '!' '(' ']'
[ = ]
echo status=$?
[ ] ]
echo status=$?
[ '!' ]
echo status=$?
[ '(' ]
echo status=$?
## STDOUT: 
status=0
status=0
status=0
status=0
## END

#### one arg: empty string is false.  Equivalent to -n.
test 'a'  && echo true
test ''   || echo false
## STDOUT:
true
false
## END

#### -a as unary operator (alias of -e)
# NOT IMPLEMENTED FOR OSH, but could be later.  See comment in core/id_kind.py.
[ -a / ]
echo status=$?
[ -a /nonexistent ]
echo status=$?
## STDOUT:
status=0
status=1
## END
## N-I dash STDOUT:
status=2
status=2
## END

#### two args: -z with = ! ( ]
[ -z = ]
echo status=$?
[ -z ] ]
echo status=$?
[ -z '!' ]
echo status=$?
[ -z '(' ]
echo status=$?
## STDOUT: 
status=1
status=1
status=1
status=1
## END

#### three args
[ foo = '' ]
echo status=$?
[ foo -a '' ]
echo status=$?
[ foo -o '' ]
echo status=$?
[ ! -z foo ]
echo status=$?
[ \( foo \) ]
echo status=$?
## STDOUT: 
status=1
status=1
status=0
status=0
status=0
## END

#### four args
[ ! foo = foo ]
echo status=$?
[ \( -z foo \) ]
echo status=$?
## STDOUT: 
status=1
status=1
## END

#### test with extra args is syntax error
test -n x ]
echo status=$?
test -n x y
echo status=$?
## STDOUT:
status=2
status=2
## END

#### ] syntax errors
[
echo status=$?
test  # not a syntax error
echo status=$?
[ -n x  # missing ]
echo status=$?
[ -n x ] y  # extra arg after ]
echo status=$?
[ -n x y  # extra arg
echo status=$?
## STDOUT:
status=2
status=1
status=2
status=2
status=2
## END

#### -n
test -n 'a'  && echo true
test -n ''   || echo false
## STDOUT:
true
false
## END

#### ! -a
[ -z '' -a ! -z x ]
echo status=$?
## stdout: status=0

#### -o
[ -z x -o ! -z x ]
echo status=$?
## stdout: status=0

#### ( )
[ -z '' -a '(' ! -z x ')' ]
echo status=$?
## stdout: status=0

#### ( ) ! -a -o with system version of [
command [ --version
command [ -z '' -a '(' ! -z x ')' ] && echo true
## stdout: true

#### == is alias for =
[ a = a ] && echo true
[ a == a ] && echo true
## STDOUT: 
true
true
## END
## BUG dash STDOUT: 
true
## END
## BUG dash status: 2

#### == and = does not do glob
[ abc = 'a*' ]
echo status=$?
[ abc == 'a*' ]
echo status=$?
## STDOUT:
status=1
status=1
## END
## N-I dash STDOUT:
status=1
status=2
## END

#### [ with op variable
# OK -- parsed AFTER evaluation of vars
op='='
[ a $op a ] && echo true
[ a $op b ] || echo false
## status: 0
## STDOUT:
true
false
## END

#### [ with unquoted empty var
empty=''
[ $empty = '' ] && echo true
## status: 2

#### [ compare with literal -f
# Hm this is the same
var=-f
[ $var = -f ] && echo true
[ '-f' = $var ] && echo true
## STDOUT:
true
true
## END

#### [ '(' foo ] is runtime syntax error
[ '(' foo ]
echo status=$?
## stdout: status=2

#### -z '>' implies two token lookahead
[ -z ] && echo true  # -z is operand
[ -z '>' ] || echo false  # -z is operator
[ -z '>' -- ] && echo true  # -z is operand
## STDOUT:
true
false
true
## END

#### operator/operand ambiguity with ]
# bash parses this as '-z' AND ']', which is true.  It's a syntax error in
# dash/mksh.
[ -z -a ] ]
echo status=$?
## stdout: status=0
## OK mksh stdout: status=2
## OK dash stdout: status=2

#### operator/operand ambiguity with -a
# bash parses it as '-z' AND '-a'.  It's a syntax error in mksh but somehow a
# runtime error in dash.
[ -z -a -a ]
echo status=$?
## stdout: status=0
## OK mksh stdout: status=2
## OK dash stdout: status=1

#### -d
test -d $TMP
echo status=$?
test -d $TMP/__nonexistent_Z_Z__
echo status=$?
## STDOUT:
status=0
status=1
## END

#### -x
rm -f $TMP/x
echo 'echo hi' > $TMP/x
test -x $TMP/x || echo 'no'
chmod +x $TMP/x
test -x $TMP/x && echo 'yes'
test -x $TMP/__nonexistent__ || echo 'bad'
## STDOUT:
no
yes
bad
## END

#### -r
echo '1' > $TMP/testr_yes
echo '2' > $TMP/testr_no
chmod -r $TMP/testr_no  # remove read permission
test -r $TMP/testr_yes && echo 'yes'
test -r $TMP/testr_no || echo 'no'
## STDOUT:
yes
no
## END

#### -w
rm -f $TMP/testw_*
echo '1' > $TMP/testw_yes
echo '2' > $TMP/testw_no
chmod -w $TMP/testw_no  # remove write permission
test -w $TMP/testw_yes && echo 'yes'
test -w $TMP/testw_no || echo 'no'
## STDOUT:
yes
no
## END

#### -k for sticky bit
# not isolated: /tmp usually has sticky bit on
# https://en.wikipedia.org/wiki/Sticky_bit

test -k /tmp
echo status=$?

test -k /bin
echo status=$?
## STDOUT:
status=0
status=1
## END

#### -h and -L test for symlink
tmp=$TMP/builtin-test-1
mkdir -p $tmp
touch $tmp/zz
ln -s -f $tmp/zz $tmp/symlink
ln -s -f $tmp/__nonexistent_ZZ__ $tmp/dangling
test -L $tmp/zz || echo no
test -h $tmp/zz || echo no
test -f $tmp/symlink && echo is-file
test -L $tmp/symlink && echo symlink
test -h $tmp/symlink && echo symlink
test -L $tmp/dangling && echo dangling
test -h $tmp/dangling  && echo dangling
test -f $tmp/dangling  || echo 'dangling is not file'
## STDOUT:
no
no
is-file
symlink
symlink
dangling
dangling
dangling is not file
## END

#### -t 1 for stdout
# There is no way to get a terminal in the test environment?
[ -t 1 ]
echo status=$?
## stdout: status=1

#### [ -t invalid ]
[ -t invalid ]
echo status=$?
## stdout: status=2
## BUG bash stdout: status=1

#### -ot and -nt
touch -d 2017/12/31 $TMP/x
touch -d 2018/01/01 > $TMP/y
test $TMP/x -ot $TMP/y && echo 'older'
test $TMP/x -nt $TMP/y || echo 'not newer'
test $TMP/x -ot $TMP/x || echo 'not older than itself'
test $TMP/x -nt $TMP/x || echo 'not newer than itself'
## STDOUT:
older
not newer
not older than itself
not newer than itself
## END

#### [ a -eq b ]
[ a -eq a ]
echo status=$?
## STDOUT:
status=2
## END
## BUG mksh STDOUT:
status=0
## END

#### test -s
test -s __nonexistent
echo status=$?
touch $TMP/empty
test -s $TMP/empty
echo status=$?
echo nonempty > $TMP/nonempty
test -s $TMP/nonempty
echo status=$?
## STDOUT:
status=1
status=1
status=0
## END

#### test -b -c -S (block, character, socket)
# NOTE: we do not have the "true" case

echo -b
test -b nonexistent
echo status=$?
test -b testdata
echo status=$?
test -b /
echo status=$?

echo -c
test -c nonexistent
echo status=$?
test -c testdata
echo status=$?

echo -S
test -S nonexistent
echo status=$?
test -S testdata
echo status=$?

## STDOUT:
-b
status=1
status=1
status=1
-c
status=1
status=1
-S
status=1
status=1
## END


#### test -p named pipe
## SKIP (unimplementable): Named pipes (mkfifo) not implemented - virtual filesystem limitation
mkfifo $TMP/fifo
test -p $TMP/fifo
echo status=$?

test -p testdata
echo status=$?

## STDOUT:
status=0
status=1
## END

#### -G and -O for effective user ID and group ID

mkdir -p $TMP/bin

test -O $TMP/bin
echo status=$?
test -O __nonexistent__
echo status=$?

test -G $TMP/bin
echo status=$?
test -G __nonexistent__
echo status=$?

## STDOUT:
status=0
status=1
status=0
status=1
## END

#### -u for setuid, -g too
touch $TMP/setuid $TMP/setgid
chmod u+s $TMP/setuid
chmod g+s $TMP/setgid

test -u $TMP/setuid
echo status=$?

test -u $TMP/setgid
echo status=$?

test -g $TMP/setuid
echo status=$?

test -g $TMP/setgid
echo status=$?


## STDOUT:
status=0
status=1
status=1
status=0
## END

#### -v to test variable (bash)
test -v nonexistent
echo global=$?

g=1
test -v g
echo global=$?

f() {
  local f_var=0
  g
}

g() {
  test -v f_var
  echo dynamic=$?
  test -v g
  echo dynamic=$?
  test -v nonexistent
  echo dynamic=$?
}
f

## STDOUT:
global=1
global=0
dynamic=0
dynamic=0
dynamic=1
## END
## N-I dash/mksh STDOUT:
global=2
global=2
dynamic=2
dynamic=2
dynamic=2
## END


#### test -o for options
# note: it's lame that the 'false' case is confused with the 'typo' case.
# but checking for error code 2 is unlikely anyway.
test -o nounset
echo status=$?

set -o nounset
test -o nounset
echo status=$?

test -o _bad_name_
echo status=$?
## STDOUT:
status=1
status=0
status=1
## END
## N-I dash STDOUT:
status=2
status=2
status=2
## END

#### -nt -ot
[ present -nt absent ] || exit 1
[ absent -ot present ] || exit 2
## status: 1

#### -ef
## SKIP (unimplementable): -ef with hardlinks requires inode tracking - virtual filesystem limitation
left=$TMP/left
right=$TMP/right
touch $left $right

ln -f $TMP/left $TMP/hardlink

test $left -ef $left && echo same
test $left -ef $TMP/hardlink && echo same
test $left -ef $right || echo different

test $TMP/__nonexistent -ef $right || echo different

## STDOUT:
same
same
different
different
## END

#### Overflow error
test -t 12345678910
echo status=$?
## STDOUT:
status=2
## END
## OK dash/bash STDOUT:
status=1
## END

#### Bug regression
test "$ipv6" = "yes" -a "$ipv6lib" != "none"
echo status=$?
## STDOUT:
status=1
## END


#### test -c 
test -c /dev/zero
echo status=$?
## STDOUT:
status=0
## END

#### test -S
test -S /dev/zero
echo status=$?
## STDOUT:
status=1
## END

#### bug from pnut: negative number $((-1))

# https://lobste.rs/s/lplim1/design_self_compiling_c_transpiler#c_km2ywc

[ $((-42)) -le 0 ]
echo status=$?

[ $((-1)) -le 0 ]
echo status=$?

echo

[ -1 -le 0 ]
echo status=$?

[ -42 -le 0 ]
echo status=$?

echo

test -1 -le 0
echo status=$?

test -42 -le 0
echo status=$?

## STDOUT:
status=0
status=0

status=0
status=0

status=0
status=0
## END

#### negative octal numbers, etc.

# zero
[ -0 -eq 0 ]
echo zero=$?

# octal numbers can be negative
[ -0123 -eq -83 ]
echo octal=$?

# hex doesn't have negative numbers?
[ -0xff -eq -255 ]
echo hex=$?

# base N doesn't either
[ -64#a -eq -10 ]
echo baseN=$?

## STDOUT:
zero=0
octal=1
hex=2
baseN=2
## END

#### More negative numbers
case $SH in dash) exit ;; esac

[[ -1 -le 0 ]]
echo status=$?

[[ $((-1)) -le 0 ]]
echo status=$?

## STDOUT:
status=0
status=0
## END

## N-I dash STDOUT:
## END

#### No octal, hex, base N conversion - leading 0 is a regular decimal

# arithmetic has octal conversion
echo $(( 073 ))
echo $(( -073 ))

echo

# Bracket does NOT have octal conversion!  That is annoying.
[ 073 -eq 73 ]
echo status=$?

[ -073 -eq -73 ]
echo status=$?

echo

[ 0xff -eq 255 ]
echo hex=$?
[ 64#a -eq 10 ]
echo baseN=$?

## STDOUT:
59
-59

status=0
status=0

hex=2
baseN=2
## END

## BUG mksh STDOUT:
73
-73

status=0
status=0

hex=2
baseN=2
## END

#### Looks like octal, but digit is too big

# arithmetic has octal conversion
echo $(( 083 ))
echo status=$?

echo $(( -083 ))
echo status=$?

echo

# Bracket does NOT have octal conversion!  That is annoying.
[ 083 -eq 83 ]
echo status=$?

[ -083 -eq -83 ]
echo status=$?

## status: 1
## STDOUT:
## END

## OK dash status: 2

## OK bash status: 0
## OK bash STDOUT:
status=1
status=1

status=0
status=0
## END

## OK mksh status: 0
## OK mksh STDOUT:
83
status=0
-83
status=0

status=0
status=0
## END

#### no recursive arith [ 1+2 -eq 3 ]

[ 1+2 -eq 3 ]
echo status=$?

s='1+2'
[ "$s" -eq 3 ]
echo status=$?

## STDOUT:
status=2
status=2
## END

## BUG mksh STDOUT:
status=0
status=0
## END
