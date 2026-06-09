## compare_shells: bash dash mksh zsh
## oils_failures_allowed: 3

# Various tests for dynamic parsing of arithmetic substitutions.

#### Double quotes
echo $(( "1 + 2" * 3 ))
echo $(( "1+2" * 3 ))
## STDOUT:
7
7
## END

## N-I dash status: 2
## N-I dash STDOUT:
## END

## N-I mksh status: 1
## N-I mksh STDOUT:
## END

## N-I zsh status: 1
## N-I zsh STDOUT:
## END

#### Single quotes
echo $(( '1' + '2' * 3 ))
echo status=$?

echo $(( '1 + 2' * 3 ))
echo status=$?
## STDOUT:
status=1
status=1
## END

## N-I dash status: 2
## N-I dash STDOUT:
## END

## BUG mksh status: 1
## BUG mksh STDOUT:
199
status=0
## END

## N-I zsh status: 1
## N-I zsh STDOUT:
## END

#### Substitutions
x='1 + 2'
echo $(( $x * 3 ))
echo $(( "$x" * 3 ))
## STDOUT:
7
7
## END

## N-I dash status: 2
## N-I dash STDOUT:
7
## END

## N-I mksh status: 1
## N-I mksh STDOUT:
7
## END

## N-I zsh status: 1
## N-I zsh STDOUT:
7
## END

#### Variable references
x='1'
echo $(( x + 2 * 3 ))
echo status=$?

# Expression like values are evaluated first (this is unlike double quotes)
x='1 + 2'
echo $(( x * 3 ))
echo status=$?
## STDOUT:
7
status=0
9
status=0
## END

## N-I dash status: 2
## N-I dash STDOUT:
7
status=0
## END
