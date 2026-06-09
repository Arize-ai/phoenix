# xtrace test.  Test PS4 and line numbers, etc.

## oils_failures_allowed: 1
## compare_shells: bash dash mksh

#### unset PS4
case $SH in dash) echo 'weird bug'; exit ;; esac

set -x
echo 1
unset PS4
echo 2
## STDOUT:
1
2
## STDERR:
+ echo 1
+ unset PS4
echo 2
## END

## BUG dash STDOUT:
weird bug
## END
## BUG dash STDERR:
## END

#### set -o verbose prints unevaluated code
set -o verbose
x=foo
y=bar
echo $x
echo $(echo $y)
## STDOUT:
foo
bar
## STDERR:
x=foo
y=bar
echo $x
echo $(echo $y)
## OK bash STDERR:
x=foo
y=bar
echo $x
echo $(echo $y)
## END

#### xtrace with unprintable chars
## SKIP (unimplementable): NUL byte handling in heredoc differs
case $SH in dash) exit ;; esac

$SH >stdout 2>stderr <<'EOF'

s=$'a\x03b\004c\x00d'
set -o xtrace
echo "$s"
EOF

show_hex() { od -A n -t c -t x1; }

echo STDOUT
cat stdout | show_hex
echo

echo STDERR
grep 'echo' stderr 

## STDOUT:
STDOUT
   a 003   b 004   c  \0   d  \n
  61  03  62  04  63  00  64  0a

STDERR
+ echo $'a\u0003b\u0004c\u0000d'
## END

## OK bash STDOUT:
STDOUT
   a 003   b 004   c  \n
  61  03  62  04  63  0a

STDERR
+ echo $'a\003b\004c'
## END

## BUG mksh STDOUT:
STDOUT
   a   ; 004   c  \r  \n
  61  3b  04  63  0d  0a

STDERR
+ echo $'a;\004c\r'
## END

## N-I dash stdout-json: ""

#### xtrace with unicode chars
case $SH in dash) exit ;; esac

mu1='[μ]'
mu2=$'[\u03bc]'

set -o xtrace
echo "$mu1" "$mu2"

## STDOUT:
[μ] [μ]
## END
## STDERR:
+ echo '[μ]' '[μ]'
## END
## N-I dash stdout-json: ""
## N-I dash stderr-json: ""

#### xtrace with paths
set -o xtrace
echo my-dir/my_file.cc
## STDOUT:
my-dir/my_file.cc
## END
## STDERR:
+ echo my-dir/my_file.cc
## END

#### xtrace with tabs
case $SH in dash) exit ;; esac

set -o xtrace
echo $'[\t]'
## stdout-json: "[\t]\n"
## STDERR:
+ echo $'[\t]'
## END
# this is a bug because it's hard to see
## BUG bash stderr-json: "+ echo '[\t]'\n"
## N-I dash stdout-json: ""
## N-I dash stderr-json: ""

#### xtrace with whitespace, quotes, and backslash
set -o xtrace
echo '1 2' \' \" \\
## STDOUT:
1 2 ' " \
## END

# YSH is different because backslashes require $'\\' and not '\', but that's OK
## STDERR:
+ echo '1 2' $'\'' '"' $'\\'
## END

## OK bash/mksh STDERR:
+ echo '1 2' \' '"' '\'
## END

## BUG dash STDERR:
+ echo 1 2 ' " \
## END

#### xtrace with newlines
# bash and dash trace this badly.  They print literal newlines, which I don't
# want.
set -x
echo $'[\n]'
## STDOUT:
[
]
## STDERR: 
+ echo $'[\n]'
## END
# bash has ugly output that spans lines
## OK bash STDERR:
+ echo '[
]'
## END
## N-I dash STDOUT:
$[
]
## END
## N-I dash STDERR:
+ echo $[\n]
## END

#### xtrace written before command executes
set -x
echo one >&2
echo two >&2
## stdout-json: ""
## STDERR:
+ echo one
one
+ echo two
two
## OK mksh STDERR:
# mksh traces redirects!
+ >&2 
+ echo one
one
+ >&2 
+ echo two
two
## END

#### Assignments and assign builtins
set -x
x=1 x=2; echo $x; readonly x=3
## STDOUT:
2
## END
## STDERR:
+ x=1
+ x=2
+ echo 2
+ readonly x=3
## END
## OK dash STDERR:
+ x=1 x=2
+ echo 2
+ readonly x=3
## END
## OK bash STDERR:
+ x=1
+ x=2
+ echo 2
+ readonly x=3
+ x=3
## END
## OK mksh STDERR:
+ x=1 x=2 
+ echo 2
+ readonly 'x=3'
## END

#### [[ ]]
case $SH in dash|mksh) exit ;; esac

set -x

dir=/
if [[ -d $dir ]]; then
  (( a = 42 ))
fi
## stdout-json: ""
## STDERR:
+ dir=/
+ [[ -d $dir ]]
+ (( a = 42 ))
## END
## OK bash STDERR:
+ dir=/
+ [[ -d / ]]
+ ((  a = 42  ))
## END
## N-I dash/mksh stderr-json: ""

#### PS4 is scoped
set -x
echo one
f() { 
  local PS4='- '
  echo func;
}
f
echo two
## STDERR:
+ echo one
+ f
+ local 'PS4=- '
- echo func
+ echo two
## END
## OK osh STDERR:
+ echo one
+ f
+ local PS4='- '
- echo func
+ echo two
## END
## OK dash STDERR:
# dash loses information about spaces!  There is a trailing space, but you
# can't see it.
+ echo one
+ f
+ local PS4=- 
- echo func
+ echo two
## END
## OK mksh STDERR:
# local gets turned into typeset
+ echo one
+ f
+ typeset 'PS4=- '
- echo func
+ echo two
## END

#### xtrace with variables in PS4
PS4='+$x:'
set -o xtrace
x=1
echo one
x=2
echo two
## STDOUT:
one
two
## END

## STDERR:
+:x=1
+1:echo one
+1:x=2
+2:echo two
## END

## OK mksh STDERR:
# mksh has trailing spaces
+:x=1 
+1:echo one
+1:x=2 
+2:echo two
## END

## OK osh/dash STDERR:
# the PS4 string is evaluated AFTER the variable is set.  That's OK
+1:x=1
+1:echo one
+2:x=2
+2:echo two
## END

#### PS4 with unterminated ${
# osh shows inline error; maybe fail like dash/mksh?
x=1
PS4='+${x'
set -o xtrace
echo one
echo status=$?
## STDOUT:
one
status=0
## END
# mksh and dash both fail.  bash prints errors to stderr.
## OK dash stdout-json: ""
## OK dash status: 2
## OK mksh stdout-json: ""
## OK mksh status: 1

#### PS4 with unterminated $(
# osh shows inline error; maybe fail like dash/mksh?
x=1
PS4='+$(x'
set -o xtrace
echo one
echo status=$?
## STDOUT:
one
status=0
## END
# mksh and dash both fail.  bash prints errors to stderr.
## OK dash stdout-json: ""
## OK dash status: 2
## OK mksh stdout-json: ""
## OK mksh status: 1

#### PS4 with runtime error
# osh shows inline error; maybe fail like dash/mksh?
x=1
PS4='+oops $(( 1 / 0 )) \$'
set -o xtrace
echo one
echo status=$?
## STDOUT:
one
status=0
## END
# mksh and dash both fail.  bash prints errors to stderr.
## OK dash stdout-json: ""
## OK dash status: 2
## OK mksh stdout-json: ""
## OK mksh status: 1


#### Reading $? in PS4
PS4='[last=$?] '
set -x
false
echo ok
## STDOUT:
ok
## END
## STDERR:
[last=0] false
[last=1] echo ok
## END
## OK osh STDERR:
[last=0] 'false'
[last=1] echo ok
## END


#### Regression: xtrace for "declare -a a+=(v)"
case $SH in dash|mksh) exit ;; esac

a=(1)
set -x
declare a+=(2)
## STDERR:
+ declare a+=(2)
## END
## OK bash STDERR:
+ a+=('2')
+ declare a
## END
## N-I dash/mksh STDERR:
## END


#### Regression: xtrace for "a+=(v)"
case $SH in dash|mksh) exit ;; esac

a=(1)
set -x
a+=(2)
## STDERR:
+ a+=(2)
## END
## N-I dash/mksh STDERR:
## END
