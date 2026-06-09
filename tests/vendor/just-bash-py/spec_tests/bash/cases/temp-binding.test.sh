## compare_shells: dash bash zsh mksh ash yash
## oils_failures_allowed: 0

# forked from spec/ble-idioms
# the IFS= eval 'local x' bug

#### More eval 'local v='
case $SH in mksh) exit ;; esac

set -u

# Create temp script inline
cat > /tmp/define-local-var-z.sh <<'SCRIPT'
local z=z
SCRIPT

f() {
  # The temp env messes it up
  tmp1= local x=x
  tmp2= eval 'local y=y'

  # similar to eval
  tmp3= . /tmp/define-local-var-z.sh

  # Bug does not appear with only eval
  #eval 'local v=hello'

  #declare -p v
  echo x=$x
  echo y=$y
  echo z=$z
}

f

## STDOUT:
x=x
y=y
z=z
## END

## N-I mksh STDOUT:
## END

#### Temp bindings with local

f() {
  local x=x
  tmp='' local tx=tx

  # Hm both y and ty persist in bash/zsh
  eval 'local y=y'
  tmp='' eval 'local ty=ty'

  # Why does this have an effect in OSH?  Oh because 'unset' is a special
  # builtin
  if true; then
    x='X' unset x
    tx='TX' unset tx
    y='Y' unset y
    ty='TY' unset ty
  fi

  #unset y
  #unset ty

  echo x=$x
  echo tx=$tx
  echo y=$y
  echo ty=$ty
}

f

## BUG bash/zsh STDOUT:
x=x
tx=tx
y=y
ty=ty
## END

## STDOUT:
x=
tx=
y=
ty=
## END

#### Temp bindings with unset 

# key point:
# unset looks up the stack
# local doesn't though

x=42
unset x
echo x=$x

echo ---

x=42
tmp= unset x
echo x=$x

x=42
tmp= eval 'unset x'
echo x=$x

echo ---

shadow() {
  x=42
  x=tmp unset x
  echo x=$x
  
  x=42
  x=tmp eval 'unset x'
  echo x=$x
}

shadow

echo ---

case $SH in
  bash) set -o posix ;;
esac
shadow

# Now shadow

# unset is a special builtin
# type unset

## STDOUT:
x=
---
x=
x=
---
x=42
x=42
---
x=42
x=42
## END

## BUG mksh/ash/dash/yash STDOUT:
x=
---
x=
x=
---
x=
x=
---
x=
x=
## END

#### FOO=bar $unset - temp binding, then empty argv from unquoted unset var (#2411)
foo=alive! $unset
echo $foo
## STDOUT:
alive!
## END
