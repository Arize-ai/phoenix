## oils_failures_allowed: 0
## compare_shells: dash bash mksh zsh ash

#### builtin declare a=(x y) is allowed
## SKIP (unimplementable): Interactive shell invocation not implemented
case $SH in dash|zsh|mksh|ash) exit ;; esac

$SH -c 'declare a=(x y); declare -p a'
if test $? -ne 0; then
  echo 'fail'
fi

$SH -c 'builtin declare a=(x y); declare -p a'
if test $? -ne 0; then
  echo 'fail'
fi

$SH -c 'builtin declare -a a=(x y); declare -p a'
if test $? -ne 0; then
  echo 'fail'
fi

## BUG bash STDOUT:
declare -a a=([0]="x" [1]="y")
fail
fail
## END

## STDOUT:
declare -a a=(x y)
declare -a a=(x y)
declare -a a=(x y)
## END

## N-I dash/zsh/mksh/ash STDOUT:
## END


#### command export,readonly
case $SH in zsh) exit ;; esac

# dash doesn't have declare typeset

command export c=export
echo c=$c

command readonly c=readonly
echo c=$c

echo --

command command export cc=export
echo cc=$cc

command command readonly cc=readonly
echo cc=$cc

## STDOUT:
c=export
c=readonly
--
cc=export
cc=readonly
## END
## N-I zsh STDOUT:
## END

#### command local

f() {
  command local s=local
  echo s=$s
}

f

## STDOUT:
s=local
## END

## BUG dash/ash STDOUT:
s=
## END

## N-I mksh/zsh STDOUT:
s=
## END

#### export, builtin export

x='a b'

export y=$x
echo $y

builtin export z=$x
echo $z

## STDOUT:
a b
a b
## END

## BUG bash/mksh STDOUT:
a b
a
## END

## N-I dash STDOUT:
a

## END

## N-I ash STDOUT:
a b

## END

#### \builtin declare - ble.sh relies on it
case $SH in dash|mksh|ash) exit ;; esac

x='a b'

builtin declare c=$x
echo $c

\builtin declare d=$x
echo $d

'builtin' declare e=$x
echo $e

b=builtin
$b declare f=$x
echo $f

b=b
${b}uiltin declare g=$x
echo $g

## STDOUT:
a b
a b
a b
a b
a b
## END

## BUG bash STDOUT:
a
a
a
a
a
## END

## N-I dash/ash/mksh STDOUT:
## END

#### \command readonly - similar issue
case $SH in zsh) exit ;; esac

# \command readonly is equivalent to \builtin declare
# except dash implements it

x='a b'

readonly b=$x
echo $b

command readonly c=$x
echo $c

\command readonly d=$x
echo $d

'command' readonly e=$x
echo $e

# The issue here is that we have a heuristic in EvalWordSequence2:
# fs len(part_vals) == 1

## STDOUT:
a b
a b
a b
a b
## END

## BUG bash STDOUT:
a b
a
a
a
## END

# note: later versions of dash are fixed
## BUG dash STDOUT:
a
a
a
a
## END

## N-I zsh STDOUT:
## END

#### Dynamic $c readonly - bash and dash change behavior, mksh bug
case $SH in zsh) exit ;; esac

x='a b'

z=command
$z readonly c=$x
echo $c

z=c
${z}ommand readonly d=$x
echo $d

## STDOUT:
a b
a b
## END

## BUG bash/dash STDOUT:
a
a
## END

## BUG mksh status: 2
## BUG mksh STDOUT:
a
## END

## N-I zsh STDOUT:
## END


#### static builtin command ASSIGN, command builtin ASSIGN
case $SH in dash|ash|zsh) exit ;; esac

# dash doesn't have declare typeset

builtin command export bc=export
echo bc=$bc

builtin command readonly bc=readonly
echo bc=$bc

echo --

command builtin export cb=export
echo cb=$cb

command builtin readonly cb=readonly
echo cb=$cb

## STDOUT:
bc=export
bc=readonly
--
cb=export
cb=readonly
## END
## N-I dash/ash/zsh STDOUT:
## END

#### dynamic builtin command ASSIGN, command builtin ASSIGN
case $SH in dash|ash|zsh) exit ;; esac

b=builtin
c=command
e=export
r=readonly

$b $c export bc=export
echo bc=$bc

$b $c readonly bc=readonly
echo bc=$bc

echo --

$c $b export cb=export
echo cb=$cb

$c $b readonly cb=readonly
echo cb=$cb

echo --

$b $c $e bce=export
echo bce=$bce

$b $c $r bcr=readonly
echo bcr=$bcr

echo --

$c $b $e cbe=export
echo cbe=$cbe

$c $b $r cbr=readonly
echo cbr=$cbr

## STDOUT:
bc=export
bc=readonly
--
cb=export
cb=readonly
--
bce=export
bcr=readonly
--
cbe=export
cbr=readonly
## END
## N-I dash/ash/zsh STDOUT:
## END

#### builtin typeset, export,readonly
case $SH in dash|ash) exit ;; esac

builtin typeset s=typeset
echo s=$s

builtin export s=export
echo s=$s

builtin readonly s=readonly
echo s=$s

echo --

builtin builtin typeset s2=typeset
echo s2=$s2

builtin builtin export s2=export
echo s2=$s2

builtin builtin readonly s2=readonly
echo s2=$s2

## STDOUT:
s=typeset
s=export
s=readonly
--
s2=typeset
s2=export
s2=readonly
## END
## N-I dash/ash STDOUT:
## END

#### builtin declare,local
case $SH in dash|ash|mksh) exit ;; esac

builtin declare s=declare
echo s=$s

f() {
  builtin local s=local
  echo s=$s
}

f

## STDOUT:
s=declare
s=local
## END
## N-I dash/ash/mksh STDOUT:
## END

