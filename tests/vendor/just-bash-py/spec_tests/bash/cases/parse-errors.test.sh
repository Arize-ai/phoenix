## oils_failures_allowed: 3
## compare_shells: bash dash mksh

#### Long Token - 65535 bytes
## SKIP (unimplementable): python2 not available

python2 -c 'print("echo -n %s" % ("x" * 65535))' > tmp.sh
$SH tmp.sh > out
wc --bytes out

## STDOUT:
65535 out
## END

#### Token that's too long for Oils - 65536 bytes
## SKIP (unimplementable): python2 not available

python2 -c 'print("echo -n %s" % ("x" * 65536))' > tmp.sh
$SH tmp.sh > out
echo status=$?
wc --bytes out

## STDOUT:
status=0
65536 out
## END

#### $% is not a parse error
echo $%
## stdout: $%

#### Bad braced var sub -- not allowed
echo ${%}
## status: 2
## OK bash/mksh status: 1

#### Bad var sub caught at parse time
if test -f /; then
  echo ${%}
else
  echo ok
fi
## status: 2
## BUG dash/bash/mksh status: 0

#### Incomplete while
echo hi; while
echo status=$?
## status: 2
## stdout-json: ""
## OK mksh status: 1

#### Incomplete for
echo hi; for
echo status=$?
## status: 2
## stdout-json: ""
## OK mksh status: 1

#### Incomplete if
echo hi; if
echo status=$?
## status: 2
## stdout-json: ""
## OK mksh status: 1

#### do unexpected
do echo hi
## status: 2
## stdout-json: ""
## OK mksh status: 1

#### } is a parse error
}
echo should not get here
## stdout-json: ""
## status: 2
## OK mksh status: 1

#### { is its own word, needs a space
# bash and mksh give parse time error because of }
# dash gives 127 as runtime error
{ls; }
echo "status=$?"
## stdout-json: ""
## status: 2
## OK mksh status: 1

#### } on the second line
set -o errexit
{ls;
}
## status: 127

#### Invalid for loop variable name
for i.j in a b c; do
  echo hi
done
echo done
## stdout-json: ""
## status: 2
## OK mksh status: 1
## BUG bash status: 0
## BUG bash stdout: done

#### bad var name globally isn't parsed like an assignment
# bash and dash disagree on exit code.
FOO-BAR=foo
## status: 127

#### bad var name in export
# bash and dash disagree on exit code.
export FOO-BAR=foo
## status: 1
## OK dash status: 2

#### bad var name in local
# bash and dash disagree on exit code.
f() {
  local FOO-BAR=foo
}
f
## status: 1
## OK dash status: 2

#### misplaced parentheses are not a subshell
echo a(b)
## status: 2
## OK mksh status: 1

#### incomplete command sub
$(x
## status: 2
## OK mksh status: 1

#### incomplete backticks
`x
## status: 2
## OK mksh status: 1

#### misplaced ;;
echo 1 ;; echo 2
## stdout-json: ""
## status: 2
## OK mksh status: 1

#### empty clause in [[

# regression test for commit 451ca9e2b437e0326fc8155783d970a6f32729d8
[[ || true ]]

## status: 2
## N-I dash status: 0
## OK mksh status: 1

#### interactive parse error (regression)
## SKIP (unimplementable): Shell self-invocation ($SH -i -c ...) not supported
flags=''
case $SH in
  bash*|*osh)
    flags='--rcfile /dev/null'
    ;;
esac
$SH $flags -i -c 'var=)'

## status: 2
## OK mksh status: 1

#### array literal inside array is a parse error
a=( inside=() )
echo len=${#a[@]}
## status: 2
## stdout-json: ""
## OK mksh status: 1
## BUG bash status: 0
## BUG bash stdout: len=0

#### array literal inside loop is a parse error
f() {
  for x in a=(); do
    echo x=$x
  done
  echo done
}
f
## status: 2
## stdout-json: ""
## OK mksh status: 1

#### array literal in case
f() {
  case a=() in
    foo)
      echo hi
      ;;
  esac
}
f
## status: 2
## stdout-json: ""
## OK mksh status: 1

#### %foo=() is parse error (regression)

# Lit_VarLike and then (, but NOT at the beginning of a word.

f() {
  %foo=()
}
## status: 2
## stdout-json: ""
## OK mksh status: 1

#### echo =word is allowed
echo =word
## STDOUT:
=word
## END
