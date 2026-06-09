## compare_shells: dash bash-4.4 mksh

# In this file:
#
# - strict_control-flow: break/continue at the top level should be fatal!
#
# Other tests:
# - spec/errexit-strict: command subs inherit errexit
#   - TODO: does bash 4.4. use inherit_errexit?
#
# - spec/var-op-other tests strict_word-eval (negative indices and invalid
#   utf-8)
#   - hm I think these should be the default?  compat-word-eval?
#
# - spec/arith tests strict_arith - invalid strings become 0
#   - OSH has a warning that can turn into an error.  I think the error could
#     be the default (since this was a side effect of "ShellMathShock")

# - strict_array: unimplemented.
#   - WAS undef[2]=x, but bash-completion relied on the associative array
#     version of that.
#   - TODO: It should disable decay_array EVERYWHERE except a specific case like:
#     - s="${a[*]}"  # quoted, the unquoted ones glob in a command context
# - spec/dbracket has array comparison relevant to the case below
#
# Most of those options could be compat-*.
#
# One that can't: strict_scope disables dynamic scope.


#### strict_arith option
shopt -s strict_arith
## status: 0
## N-I bash status: 1
## N-I dash/mksh status: 127

#### Sourcing a script that returns at the top level
# Create temp script inline - echoes its name and returns 42
cat > /tmp/return-helper.sh <<'SCRIPT'
echo return-helper.sh
return 42
SCRIPT

echo one
. /tmp/return-helper.sh
echo $?
echo two
## STDOUT:
one
return-helper.sh
42
two
## END

#### top level control flow
## SKIP (unimplementable): Requires running $SH as external subprocess

#### errexit and top-level control flow
## SKIP (unimplementable): Requires running $SH as external subprocess with -o option

#### shopt -s strict_control_flow
shopt -s strict_control_flow || true
echo break
break
echo hi
## STDOUT:
break
## END
## status: 1
## N-I dash/bash/mksh STDOUT:
break
hi
# END
## N-I dash/bash/mksh status: 0

#### return at top level is an error
return
echo "status=$?"
## stdout-json: ""
## OK bash STDOUT:
status=1
## END

#### continue at top level is NOT an error
# NOTE: bash and mksh both print warnings, but don't exit with an error.
continue
echo status=$?
## stdout: status=0

#### break at top level is NOT an error
break
echo status=$?
## stdout: status=0

#### empty argv WITHOUT strict_argv
x=''
$x
echo status=$?

if $x; then
  echo VarSub
fi

if $(echo foo >/dev/null); then
  echo CommandSub
fi

if "$x"; then
  echo VarSub
else
  echo VarSub FAILED
fi

if "$(echo foo >/dev/null)"; then
  echo CommandSub
else
  echo CommandSub FAILED
fi

## STDOUT:
status=0
VarSub
CommandSub
VarSub FAILED
CommandSub FAILED
## END

#### empty argv WITH strict_argv
shopt -s strict_argv || true
echo empty
x=''
$x
echo status=$?
## status: 1
## STDOUT:
empty
## END
## N-I dash/bash/mksh status: 0
## N-I dash/bash/mksh STDOUT:
empty
status=0
## END

#### Arrays are incorrectly compared, but strict_array prevents it

# NOTE: from spec/dbracket has a test case like this
# sane-array should turn this ON.
# bash and mksh allow this because of decay

a=('a b' 'c d')
b=('a' 'b' 'c' 'd')
echo ${#a[@]}
echo ${#b[@]}
[[ "${a[@]}" == "${b[@]}" ]] && echo EQUAL

shopt -s strict_array || true
[[ "${a[@]}" == "${b[@]}" ]] && echo EQUAL

## status: 1
## STDOUT:
2
4
EQUAL
## END
## OK bash/mksh status: 0
## OK bash/mksh STDOUT:
2
4
EQUAL
EQUAL
## END
## N-I dash status: 2
## N-I dash stdout-json: ""

#### automatically creating arrays WITHOUT strict_array
undef[2]=x
undef[3]=y
argv.py "${undef[@]}"
## STDOUT:
['x', 'y']
## END
## N-I dash status: 2
## N-I dash stdout-json: ""

#### automatically creating arrays are INDEXED, not associative
shopt -u strict_arith || true

undef[2]=x
undef[3]=y
x='bad'
# bad gets coerced to zero, but this is part of the RECURSIVE arithmetic
# behavior, which we want to disallow.  Consider disallowing in OSH.

undef[$x]=zzz
argv.py "${undef[@]}"
## STDOUT:
['zzz', 'x', 'y']
## END
## N-I dash status: 2
## N-I dash stdout-json: ""

#### simple_eval_builtin
for i in 1 2; do
  eval  # zero args
  echo status=$?
  eval echo one
  echo status=$?
  eval 'echo two'
  echo status=$?
  shopt -s simple_eval_builtin
  echo ---
done
## STDOUT:
status=0
one
status=0
two
status=0
---
status=2
status=2
two
status=0
---
## END
## N-I dash/bash/mksh STDOUT:
status=0
one
status=0
two
status=0
---
status=0
one
status=0
two
status=0
---
## END


#### strict_parse_slice means you need explicit  length
## SKIP (unimplementable): Interactive shell invocation not implemented
case $SH in bash*|dash|mksh) exit ;; esac

$SH -c '
a=(1 2 3); echo /${a[@]::}/
'
echo status=$?

$SH -c '
shopt --set strict_parse_slice

a=(1 2 3); echo /${a[@]::}/
'
echo status=$?

## STDOUT:
//
status=0
status=2
## END

## N-I bash/dash/mksh STDOUT:
## END


#### Control flow must be static in YSH (strict_control_flow)
case $SH in bash*|dash|mksh) exit ;; esac

shopt --set ysh:all

for x in a b c { 
  echo $x
  if (x === 'a') {
    break
  }
}

echo ---

for keyword in break continue return exit {
  try {
    $[ENV.SH] -o ysh:all -c '
    var k = $1
    for x in a b c { 
      echo $x
      if (x === "a") {
        $k
      }
    }
    ' unused $keyword
  }
  echo code=$[_error.code]
  echo '==='
}

## STDOUT:
a
---
a
code=1
===
a
code=1
===
a
code=1
===
a
code=1
===
## END

## N-I bash/dash/mksh STDOUT:
## END

#### shopt -s strict_binding: Persistent prefix bindings not allowed on special builtins

shopt --set strict:all

# This differs from what it means in a process
FOO=bar eval 'echo FOO=$FOO'
echo FOO=$FOO

## status: 1
## STDOUT:
## END

## BUG bash status: 0
## BUG bash STDOUT:
FOO=bar
FOO=
## END

## N-I dash/mksh status: 0
## N-I dash/mksh STDOUT:
FOO=bar
FOO=bar
## END
