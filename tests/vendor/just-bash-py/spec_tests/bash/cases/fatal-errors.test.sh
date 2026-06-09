## compare_shells: dash bash mksh zsh

# Some shell errors are unrecoverable!  Like divide by zero (except in bash.
#
# Any others?


#### Unrecoverable: divide by zero in redirect word

$SH -c '
echo hi > file$(( 42 / 0 )) in
echo inside=$?
'
echo outside=$?

## STDOUT:
outside=1
## END

## OK dash/ash STDOUT:
outside=2
## END

# bash makes the command fail
## OK bash STDOUT:
inside=1
outside=0
## END:


#### Unrecoverable: divide by zero in conditional word

$SH -c '
if test foo$(( 42 / 0 )) = foo; then
  echo true
else
  echo false
fi
echo inside=$?
'
echo outside=$?

echo ---

$SH -c '
if test foo$(( 42 / 0 )) = foo; then
  echo true
fi
echo inside=$?
'
echo outside=$?

## STDOUT:
outside=1
---
outside=1
## END

## OK dash/ash STDOUT:
outside=2
---
outside=2
## END

# bash makes the command fail
## OK bash STDOUT:
inside=1
outside=0
---
inside=1
outside=0
## END:

# weird difference in zsh!

## BUG zsh STDOUT:
outside=1
---
outside=0
## END


#### Unrecoverable: divide by zero in case

$SH -c '
case $(( 42 / 0 )) in
  (*) echo hi ;;
esac
echo inside=$?
'
echo outside=$?

echo ---

$SH -c '
case foo in
  ( $(( 42 / 0 )) )
    echo hi
    ;;
esac
echo inside=$?
'
echo outside=$?

## STDOUT:
outside=1
---
outside=1
## END

## OK dash/ash STDOUT:
outside=2
---
outside=2
## END

## OK bash STDOUT:
inside=1
outside=0
---
inside=1
outside=0
## END:

## BUG zsh STDOUT:
outside=0
---
outside=0
## END


#### Unrecoverable: ${undef?message}

$SH -c '
echo ${undef?message}
echo inside=$?
'
echo outside=$?

$SH -c '
case ${undef?message} in 
  (*) echo hi ;;
esac
echo inside=$?
'
echo outside=$?

## STDOUT:
outside=1
outside=1
## END
## OK dash STDOUT:
outside=2
outside=2
## END
## OK bash STDOUT:
outside=127
outside=127
## END

#### ${undef} with nounset

$SH -c '
set -o nounset
case ${undef} in 
  (*) echo hi ;;
esac
echo inside=$?
'
echo outside=$?

## STDOUT:
outside=1
## END

## OK dash STDOUT:
outside=2
## END

## OK bash STDOUT:
outside=127
## END

## BUG zsh STDOUT:
outside=0
## END

