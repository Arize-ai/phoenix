## oils_failures_allowed: 3
## compare_shells: bash dash mksh ash
## legacy_tmp_dir: yes

#### glob double quote escape
echo "*.sh"
## stdout: *.sh

#### glob single quote escape
echo "*.sh"
## stdout: *.sh

#### glob backslash escape
echo \*.sh
## stdout: *.sh

#### 1 char glob
mkdir -p /tmp/testdir/bin
cd /tmp/testdir
echo [b]in
## stdout: bin

#### 0 char glob -- does NOT work
echo []bin
## STDOUT:
[]bin
## END

#### looks like glob at the start, but isn't
echo [bin
## stdout: [bin

#### looks like glob plus negation at the start, but isn't
echo [!bin
## stdout: [!bin

#### glob can expand to command and arg
## SKIP (unimplementable): Test requires Oils test infrastructure
cd $REPO_ROOT
spec/testdata/echo.s[hz]
## stdout: spec/testdata/echo.sz

#### glob after var expansion
touch _tmp/a.A _tmp/aa.A _tmp/b.B
f="_tmp/*.A"
g="$f _tmp/*.B"
echo $g
## stdout: _tmp/a.A _tmp/aa.A _tmp/b.B

#### quoted var expansion with glob meta characters
touch _tmp/a.A _tmp/aa.A _tmp/b.B
f="_tmp/*.A"
echo "[ $f ]"
## stdout: [ _tmp/*.A ]

#### glob after "$@" expansion
fun() {
  echo "$@"
}
fun '_tmp/*.B'
## stdout: _tmp/*.B

#### glob after $@ expansion
touch _tmp/b.B
fun() {
  echo $@
}
fun '_tmp/*.B'
## stdout: _tmp/b.B

#### no glob after ~ expansion
HOME=*
echo ~/*.py
## stdout: */*.py

#### store literal globs in array then expand
touch _tmp/a.A _tmp/aa.A _tmp/b.B
g=("_tmp/*.A" "_tmp/*.B")
echo ${g[@]}
## stdout: _tmp/a.A _tmp/aa.A _tmp/b.B
## N-I dash/ash stdout-json: ""
## N-I dash/ash status: 2

#### glob inside array
touch _tmp/a.A _tmp/aa.A _tmp/b.B
g=(_tmp/*.A _tmp/*.B)
echo "${g[@]}"
## stdout: _tmp/a.A _tmp/aa.A _tmp/b.B
## N-I dash/ash stdout-json: ""
## N-I dash/ash status: 2

#### glob with escaped - in char class
touch _tmp/foo.-
touch _tmp/c.C
echo _tmp/*.[C-D] _tmp/*.[C\-D]
## stdout: _tmp/c.C _tmp/c.C _tmp/foo.-

#### glob with char class expression
# note: mksh doesn't support [[:punct:]] ?
touch _tmp/e.E _tmp/foo.-
echo _tmp/*.[[:punct:]E]
## stdout: _tmp/e.E _tmp/foo.-
## BUG mksh stdout: _tmp/*.[[:punct:]E]

#### glob double quotes
# note: mksh doesn't support [[:punct:]] ?
touch _tmp/\"quoted.py\"
echo _tmp/\"*.py\"
## stdout: _tmp/"quoted.py"

#### glob escaped
# - mksh doesn't support [[:punct:]] ?
# - python shell fails because \[ not supported!
touch _tmp/\[abc\] _tmp/\?
echo _tmp/\[???\] _tmp/\?
## stdout: _tmp/[abc] _tmp/?

#### : escaped

touch _tmp/foo.-
echo _tmp/*.[[:punct:]] _tmp/*.[[:punct\:]]

## STDOUT:
_tmp/foo.- _tmp/*.[[:punct:]]
## END

## BUG mksh STDOUT:
_tmp/*.[[:punct:]] _tmp/*.[[:punct:]]
## END

## BUG bash/ash STDOUT:
_tmp/foo.- _tmp/foo.-
## END

#### Glob after var manipulation
touch _tmp/foo.zzz _tmp/bar.zzz
g='_tmp/*.zzzZ'
echo $g ${g%Z}
## stdout: _tmp/*.zzzZ _tmp/bar.zzz _tmp/foo.zzz

#### Glob after part joining
touch _tmp/foo.yyy _tmp/bar.yyy
g='_tmp/*.yy'
echo $g ${g}y
## stdout: _tmp/*.yy _tmp/bar.yyy _tmp/foo.yyy

#### Glob flags on file system
touch _tmp/-n _tmp/zzzzz
cd _tmp
echo -* hello zzzz?
## stdout-json: "hello zzzzz"

#### set -o noglob
cd $REPO_ROOT
touch _tmp/spec-tmp/a.zz _tmp/spec-tmp/b.zz
echo _tmp/spec-tmp/*.zz
set -o noglob
echo _tmp/spec-tmp/*.zz
## STDOUT:
_tmp/spec-tmp/a.zz _tmp/spec-tmp/b.zz
_tmp/spec-tmp/*.zz
## END

#### set -o noglob (bug #698)
var='\z'
set -f
echo $var
## STDOUT:
\z
## END

#### Splitting/Globbing doesn't happen on local assignment
cd $REPO_ROOT

f() {
  # Dash splits words and globs before handing it to the 'local' builtin.  But
  # ash doesn't!
  local foo=$1
  echo "$foo"
}
f 'void *'
## stdout: void *
## BUG dash stdout-json: ""
## BUG dash status: 2

#### Glob of unescaped [[] and []]
touch $TMP/[ $TMP/]
cd $TMP
echo [\[z] [\]z]  # the right way to do it
echo [[z] []z]    # also accepted
## STDOUT:
[ ]
[ ]
## END

#### Glob of negated unescaped [[] and []]
# osh does this "correctly" because it defers to libc!
touch $TMP/_G
cd $TMP
echo _[^\[z] _[^\]z]  # the right way to do it
echo _[^[z] _[^]z]    # also accepted
## STDOUT:
_G _G
_G _G
## END
## BUG dash/mksh STDOUT:
_[^[z] _[^]z]
_[^[z] _[^]z]
## END

#### PatSub of unescaped [[] and []]
x='[foo]'
echo ${x//[\[z]/<}  # the right way to do it
echo ${x//[\]z]/>}
echo ${x//[[z]/<}  # also accepted
echo ${x//[]z]/>}
## STDOUT:
<foo]
[foo>
<foo]
[foo>
## END
## N-I dash stdout-json: ""
## N-I dash status: 2

#### PatSub of negated unescaped [[] and []]
x='[foo]'
echo ${x//[^\[z]/<}  # the right way to do it
echo ${x//[^\]z]/>}
echo ${x//[^[z]/<}  # also accepted
#echo ${x//[^]z]/>}  # only busybox ash interprets as ^\]
## STDOUT:
[<<<<
>>>>]
[<<<<
## END
# mksh is doing something very odd, ignoring ^ altogether?
## BUG mksh STDOUT:
<foo]
[foo>
<foo]
## END
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Glob unicode char

touch $TMP/__a__
touch $TMP/__μ__
cd $TMP

echo __?__

## STDOUT:
__a__ __μ__
## END
## BUG dash/mksh/ash STDOUT:
__a__
## END
# note: zsh also passes this, but it doesn't run with this file.

#### Glob ordering respects LC_COLLATE (zsh respects this too)
## SKIP (unimplementable): Interactive shell invocation not implemented

# test/spec-common.sh sets LC_ALL=C.UTF_8
unset LC_ALL

touch hello hello.py hello_preamble.sh hello-test.sh
echo h*

# bash - hello_preamble.h comes first
# But ord('_') == 95 
#     ord('-') == 45

# https://serverfault.com/questions/122737/in-bash-are-wildcard-expansions-guaranteed-to-be-in-order

#LC_COLLATE=C.UTF-8
LC_COLLATE=en_US.UTF-8  # en_US is necessary
echo h*

LC_COLLATE=en_US.UTF-8 $SH -c 'echo h*'

## STDOUT:
hello hello-test.sh hello.py hello_preamble.sh
hello hello_preamble.sh hello.py hello-test.sh
hello hello_preamble.sh hello.py hello-test.sh
## END

## N-I dash/mksh/ash STDOUT:
hello hello-test.sh hello.py hello_preamble.sh
hello hello-test.sh hello.py hello_preamble.sh
hello hello-test.sh hello.py hello_preamble.sh
## END


#### \ in unquoted substitutions does not match a backslash
mkdir x
touch \
  x/test.ifs.\\.txt \
  x/test.ifs.\'.txt \
  x/test.ifs.a.txt \
  x/test.ifs.\\b.txt

v="*\\*.txt"
argv.py x/$v

v="*\'.txt"
argv.py x/$v

v='*\a.txt'
argv.py x/$v

v='*\b.txt'
argv.py x/$v

## STDOUT:
['x/*\\*.txt']
["x/test.ifs.'.txt"]
['x/test.ifs.a.txt']
['x/test.ifs.\\b.txt']
## END

# 3 shells treat \ in unquoted substitution $v as literal \
## BUG mksh/ksh/yash STDOUT:
['x/test.ifs.\\.txt', 'x/test.ifs.\\b.txt']
["x/*\\'.txt"]
['x/*\\a.txt']
['x/test.ifs.\\b.txt']
## END

#### \ in unquoted substitutions is preserved
v='\*\*.txt'
echo $v
echo "$v"

## STDOUT:
\*\*.txt
\*\*.txt
## END


#### \ in unquoted substitutions is preserved with set -o noglob
set -f
v='*\*.txt'
echo $v

## STDOUT:
*\*.txt
## END


#### \ in unquoted substitutions is preserved without glob matching
mkdir x
touch \
  'x/test.ifs.\.txt' \
  'x/test.ifs.*.txt'
v='*\*.txt'
argv.py x/unmatching.$v

## STDOUT:
['x/unmatching.*\\*.txt']
## END


#### \ in unquoted substitutions escapes globchars
mkdir x
touch \
  'x/test.ifs.\.txt' \
  'x/test.ifs.*.txt'

v='*\*.txt'
argv.py x/$v

v="\\" u='*.txt'
argv.py x/*$v$u

v="\\" u="*.txt"
argv.py x/*$v*.txt

## STDOUT:
['x/test.ifs.*.txt']
['x/test.ifs.*.txt']
['x/test.ifs.*.txt']
## END
## BUG mksh/ksh/yash STDOUT:
['x/test.ifs.\\.txt']
['x/test.ifs.\\.txt']
['x/test.ifs.\\.txt']
## END

#### pattern starting with . does not return . and ..

echo hi .*

## STDOUT:
hi .*
## END
## BUG dash/ash STDOUT:
hi . ..
## END

#### shopt -u globskipdots shows . and ..
case $SH in dash|ash|mksh) exit ;; esac

shopt -u globskipdots
echo hi .*

## STDOUT:
hi . ..
## END
## N-I dash/ash/mksh STDOUT:
## END
