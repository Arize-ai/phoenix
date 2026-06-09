## oils_failures_allowed: 0
## compare_shells: bash dash mksh zsh

# Notes:
# - ash is just like dash, so don't bother testing
# - zsh fails several cases

#### >$file touches a file
rm -f myfile
test -f myfile
echo status=$?

>myfile
test -f myfile
echo status=$?

## STDOUT:
status=1
status=0
## END

## BUG zsh STDOUT:
status=1
## END

# regression for OSH
## stderr-json: ""

#### $(< $file) yields the contents of the file

seq 2 3 > myfile
foo=$(< myfile)
argv.py "$foo"

## STDOUT:
['2\n3']
## END

## N-I dash/ash/yash STDOUT:
['']
## END

#### `< $file` behaves like $(< file)

seq 7 8 > myfile

x=`< myfile`

echo "[$x]"

## STDOUT:
[7
8]
## END
## N-I dash/ash/yash STDOUT:
[]
## END

#### $(< file; end) is not a special case

seq 5 6 > myfile

# zsh prints the file each time!
# other shells do nothing?

foo=$(echo begin; < myfile)
echo $foo
echo ---

foo=$(< myfile; echo end)
echo $foo
echo ---

foo=$(< myfile; <myfile)
echo $foo
echo ---

## STDOUT:
begin
---
end
---

---
## END

## BUG zsh STDOUT:
begin
5
6
---
5
6
end
---
5
6
5
6
---
## END

#### < file in pipeline and subshell doesn't work
echo FOO > file2

# This only happens in command subs, which is weird
< file2 | tr A-Z a-z
( < file2 )
echo end
## STDOUT:
end
## END
## BUG zsh STDOUT:
foo
FOO
end
## END

#### Leading redirect in a simple command
echo hello >$TMP/hello.txt  # temporary fix
<$TMP/hello.txt cat
## stdout: hello

#### Redirect in the middle of a simple command
f=$TMP/out
echo -n 1 2 '3 ' > $f
echo -n 4 5 >> $f '6 '
echo -n 7 >> $f 8 '9 '
echo -n >> $f 1 2 '3 '
echo >> $f -n 4 5 '6'

cat $f
echo
## STDOUT:
1 2 3 4 5 6 7 8 9 1 2 3 4 5 6
## END

#### Redirect in command sub
FOO=$(echo foo 1>&2)
echo $FOO
## stdout:
## stderr: foo

#### Redirect in the middle of two assignments
FOO=foo >$TMP/out.txt BAR=bar printenv.py FOO BAR
tac $TMP/out.txt
## STDOUT:
bar
foo
## END
## BUG zsh STDOUT:
## END

#### Redirect in assignment
# dash captures stderr to a file here, which seems correct.  Bash doesn't and
# just lets it go to actual stderr.
# For now we agree with dash/mksh, since it involves fewer special cases in the
# code.

FOO=$(echo foo 1>&2) 2>$TMP/no-command.txt
echo FILE=
cat $TMP/no-command.txt
echo "FOO=$FOO"
## STDOUT:
FILE=
foo
FOO=
## END
## BUG bash STDOUT:
FILE=
FOO=
## END


#### Redirect in function body
fun() { echo hi; } 1>&2
fun
## STDOUT:
## END
## STDERR:
hi
## END

#### Redirect in function body is evaluated multiple times
i=0
fun() { echo "file $i"; } 1> "$TMP/file$((i++))"
fun
fun
echo i=$i
echo __
cat $TMP/file0
echo __
cat $TMP/file1
## STDOUT: 
i=2
__
file 1
__
file 2
## END
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Redirect in function body AND function call
fun() { echo hi; } 1>&2
fun 2>&1
## STDOUT:
hi
## END
## STDERR:
## END

#### redirect bash extensions:   [[  ((  for ((
case $SH in dash|mksh) exit ;; esac

rm -f dbracket dparen for-expr

[[ x = x ]] > dbracket

(( 42 )) > dparen

for ((x = 0; x < 1; ++x)); do
  echo for-expr
done > for-expr

wc -l dbracket dparen for-expr

## STDOUT:
  0 dbracket
  0 dparen
  1 for-expr
  1 total
## END

## N-I dash/mksh STDOUT:
## END

#### redirect if
if true; then
  echo if-body
fi >out

cat out

## STDOUT:
if-body
## END

#### redirect case
case foo in
  foo)
    echo case-body
    ;;
esac > out

cat out

## STDOUT:
case-body
## END

#### redirect while
while true; do
  echo while-body
  break
done > out

cat out

## STDOUT:
while-body
## END

#### redirect for loop
for i in $(seq 3)
do
  echo $i
done > $TMP/redirect-for-loop.txt
cat $TMP/redirect-for-loop.txt
## STDOUT:
1
2
3
## END

#### redirect subshell
( echo foo ) 1>&2
## stderr: foo
## stdout-json: ""

#### Prefix redirect for loop -- not allowed
>$TMP/redirect2.txt for i in $(seq 3)
do
  echo $i
done
cat $TMP/redirect2.txt
## status: 2
## OK mksh status: 1
## BUG zsh status: 0
## BUG zsh STDOUT:
1
2
3
## END

#### Brace group redirect
# Suffix works, but prefix does NOT work.
# That comes from '| compound_command redirect_list' in the grammar!
{ echo block-redirect; } > $TMP/br.txt
cat $TMP/br.txt | wc -c
## stdout: 15

#### Redirect function stdout
f() { echo one; echo two; }
f > $TMP/redirect-func.txt
cat $TMP/redirect-func.txt
## STDOUT:
one
two
## END

#### Nested function stdout redirect
# Shows that a stack is necessary.
inner() {
  echo i1
  echo i2
}
outer() {
  echo o1
  inner > $TMP/inner.txt
  echo o2
}
outer > $TMP/outer.txt
cat $TMP/inner.txt
echo --
cat $TMP/outer.txt
## STDOUT:
i1
i2
--
o1
o2
## END
