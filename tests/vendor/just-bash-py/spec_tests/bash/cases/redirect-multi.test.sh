## compare_shells: bash mksh zsh ash

#### File redirects with glob args (bash and zsh only)

touch one-bar

echo hi > one-*

cat one-bar

echo escaped > one-\*

cat one-\*

## STDOUT:
hi
escaped
## END
## N-I dash/mksh/ash STDOUT:
escaped
## END

#### File redirect without matching any file

echo hi > zz-*-xx
echo status=$?

echo zz*

## STDOUT:
status=0
zz-*-xx
## END

## OK zsh status: 1
## OK zsh STDOUT:
## END

#### ysh behavior when glob doesn't match

shopt -s ysh:upgrade

echo hi > qq-*-zz
echo status=$?

echo qq*

## status: 1
## STDOUT:
## END

## N-I bash/mksh/ash status: 0
## N-I bash/mksh/ash STDOUT:
status=0
qq-*-zz
## END

#### File redirect without matching any file, with failglob

shopt -s failglob

echo hi > zz-*-xx
echo status=$?

echo zz*
echo status=$?

## STDOUT:
status=1
status=1
## END
## N-I mksh/ash STDOUT:
status=0
zz-*-xx
status=0
## END

## OK zsh status: 1
## OK zsh STDOUT:
## END

#### Redirect to $empty (in function body)
empty=''
fun() { echo hi; } > $empty
fun
echo status=$?
## STDOUT:
status=1
## END
## OK dash STDOUT:
status=2
## END

#### Redirect to '' 
echo hi > ''
echo status=$?
## STDOUT:
status=1
## END



#### File redirect to $var with glob char

touch two-bar

star='*'

# This gets glob-expanded, as it does outside redirects
echo hi > two-$star
echo status=$?

head two-bar two-\*

## status: 1
## STDOUT:
status=0
==> two-bar <==
hi
## END

## OK mksh/zsh/ash status: 0
## OK mksh/zsh/ash STDOUT:
status=0
==> two-bar <==

==> two-* <==
hi
## END


#### File redirect that globs to more than one file (bash and zsh only)

touch foo-bar
touch foo-spam

echo hi > foo-*
echo status=$?

head foo-bar foo-spam

## STDOUT:
status=1
==> foo-bar <==

==> foo-spam <==
## END

## N-I dash/mksh/ash STDOUT:
status=0
==> foo-bar <==

==> foo-spam <==
## END

## BUG zsh STDOUT:
status=0
==> foo-bar <==
hi

==> foo-spam <==
hi
## END

#### File redirect with extended glob

shopt -s extglob

touch foo-bar

echo hi > @(*-bar|other)
echo status=$?

cat foo-bar

## status: 0
## STDOUT:
status=0
hi
## END

## N-I zsh status: 1
## N-I dash/ash status: 2

## N-I dash/zsh/ash STDOUT:
## END

## BUG mksh status: 0
## BUG mksh STDOUT:
status=0
## END

#### Extended glob that doesn't match anything
shopt -s extglob
rm bad_*

# They actually write this literal file!  This is what EvalWordToString() does,
# as opposed to _EvalWordToParts.
echo foo > bad_@(*.cc|*.h)
echo status=$?

echo bad_*

shopt -s failglob

# Note: ysh:ugprade doesn't allow extended globs
# shopt -s ysh:upgrade

echo foo > bad_@(*.cc|*.h)
echo status=$?

## STDOUT:
status=0
bad_@(*.cc|*.h)
status=1
## END
## N-I mksh STDOUT:
status=0
bad_@(*.cc|*.h)
status=0
## END

## N-I ash status: 2
## N-I ash stdout-json: ""

## N-I zsh status: 1
## N-I zsh stdout-json: ""


#### Non-file redirects don't respect glob args (we differe from bash)

touch 10

exec 10>&1  # open stdout as descriptor 10

# Does this go to stdout?  ONLY bash respects it, not zsh
echo should-not-be-on-stdout >& 1*

echo stdout
echo stderr >&2

## status: 0

## STDOUT:
stdout
## END

## BUG bash STDOUT:
should-not-be-on-stdout
stdout
## END

## N-I dash/zsh status: 127
## N-I dash/zsh STDOUT:
## END


#### Redirect with brace expansion isn't allowed

echo hi > a-{one,two}
echo status=$?

head a-*
echo status=$?


## STDOUT:
status=1
status=1
## END

## N-I mksh/ash STDOUT:
status=0
hi
status=0
## END

## BUG zsh STDOUT:
status=0
==> a-one <==
hi

==> a-two <==
hi
status=0
## END


#### File redirects have word splitting too!
file='foo bar'

echo hi > $file
echo status=$?

cat "$file"
echo status=$?

## STDOUT:
status=1
status=1
## END

## OK mksh/zsh/ash STDOUT:
status=0
hi
status=0
## END
