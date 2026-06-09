## compare_shells: dash bash mksh zsh

#
# Tests for the blog.
#

#### -a
[ -a ]
echo status=$?
## stdout: status=0

#### -a -a
[ -a -a ]
echo status=$?
## stdout: status=1

#### -a -a -a
[ -a -a -a ]
echo status=$?
## stdout: status=0
## BUG mksh stdout: status=2

#### -a -a -a -a
[ -a -a -a -a ]
echo status=$?
## STDOUT:
status=1
## END

#### -a -a -a -a -a
[ -a -a -a -a -a ]
echo status=$?
## stdout: status=1
## BUG dash/zsh stdout: status=0

#### -a -a -a -a -a -a
[ -a -a -a -a -a -a ]
echo status=$?
## STDOUT:
status=1
## END

## OK bash/mksh STDOUT:
status=2
## END

#### -a -a -a -a -a -a -a
[ -a -a -a -a -a -a -a ]
echo status=$?
## STDOUT:
status=1
## END
## BUG dash/zsh STDOUT:
status=0
## END

#### -a -a -a -a -a -a -a -a
[ -a -a -a -a -a -a -a -a ]
echo status=$?
## stdout: status=1
