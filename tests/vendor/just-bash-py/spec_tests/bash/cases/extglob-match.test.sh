## compare_shells: bash mksh
## oils_failures_allowed: 3

# TODO: can also run against ksh, brush, sush

# Test extended glob matching with [[, case, etc.

#### @ matches exactly one
[[ --verbose == --@(help|verbose) ]] && echo TRUE
[[ --oops == --@(help|verbose) ]] || echo FALSE
## STDOUT:
TRUE
FALSE
## END

#### @() with variable arms
choice1='help'
choice2='verbose'
[[ --verbose == --@($choice1|$choice2) ]] && echo TRUE
[[ --oops == --@($choice1|$choice2) ]] || echo FALSE
## STDOUT:
TRUE
FALSE
## END

#### extglob in variable
shopt -s extglob

# this syntax requires extglob in bash!!
# OSH never allows it
g=--@(help|verbose)

quoted='--@(help|verbose)'

[[ --help == $g ]] && echo TRUE
[[ --verbose == $g ]] && echo TRUE
[[ -- == $g ]] || echo FALSE
[[ --help == $q ]] || echo FALSE
[[ -- == $q ]] || echo FALSE
## STDOUT:
TRUE
TRUE
FALSE
FALSE
FALSE
## END
## N-I mksh STDOUT:
FALSE
FALSE
FALSE
## END

#### Matching literal '@(cc)'
# extglob is OFF.  Doesn't affect bash or mksh!
[[ cc == @(cc) ]] 
echo status=$?
[[ cc == '@(cc)' ]]
echo status=$?

shopt -s extglob

[[ cc == @(cc) ]]
echo status=$?
[[ cc == '@(cc)' ]]
echo status=$?

## STDOUT:
status=0
status=1
status=0
status=1
## END

#### nested @()
shopt -s extglob
pat='--@(help|verbose|no-@(long|short)-option)'
[[ --no-long-option == $pat ]] && echo TRUE
[[ --no-short-option == $pat ]] && echo TRUE
[[ --help == $pat ]] && echo TRUE
[[ --oops == $pat ]] || echo FALSE
## STDOUT:
TRUE
TRUE
TRUE
FALSE
## END
## BUG mksh STDOUT:
FALSE
## END

#### nested @() with quotes and vars
shopt -s extglob
prefix=no
[[ --no-long-option == --@(help|verbose|$prefix-@(long|short)-'option') ]] &&
  echo TRUE
## STDOUT:
TRUE
## END

#### ? matches 0 or 1
[[ -- == --?(help|verbose) ]] && echo TRUE
[[ --oops == --?(help|verbose) ]] || echo FALSE
## STDOUT:
TRUE
FALSE
## END

#### + matches 1 or more
[[ --helphelp == --+(help|verbose) ]] && echo TRUE
[[ -- == --+(help|verbose) ]] || echo FALSE
## STDOUT:
TRUE
FALSE
## END

#### * matches 0 or more
[[ -- == --*(help|verbose) ]] && echo TRUE
[[ --oops == --*(help|verbose) ]] || echo FALSE
## STDOUT:
TRUE
FALSE
## END

#### simple repetition with *(foo) and +(Foo)
[[ foofoo == *(foo) ]] && echo TRUE
[[ foofoo == +(foo) ]] && echo TRUE
## STDOUT:
TRUE
TRUE
## END

#### ! matches none
[[ --oops == --!(help|verbose) ]] && echo TRUE
[[ --help == --!(help|verbose) ]] || echo FALSE
## STDOUT:
TRUE
FALSE
## END

#### match is anchored
[[ foo_ == @(foo) ]] || echo FALSE
[[ _foo == @(foo) ]] || echo FALSE
[[ foo == @(foo) ]] && echo TRUE
## STDOUT:
FALSE
FALSE
TRUE
## END

#### repeated match is anchored
[[ foofoo_ == +(foo) ]] || echo FALSE
[[ _foofoo == +(foo) ]] || echo FALSE
[[ foofoo == +(foo) ]] && echo TRUE
## STDOUT:
FALSE
FALSE
TRUE
## END

#### repetition with glob
# NOTE that * means two different things here
[[ foofoo_foo__foo___ == *(foo*) ]] && echo TRUE
[[ Xoofoo_foo__foo___ == *(foo*) ]] || echo FALSE
## STDOUT:
TRUE
FALSE
## END

#### No brace expansion in ==
[[ --X{a,b}X == --@(help|X{a,b}X) ]] && echo TRUE
[[ --oops == --@(help|X{a,b}X) ]] || echo FALSE
## STDOUT:
TRUE
FALSE
## END

#### adjacent extglob
[[ --help == @(--|++)@(help|verbose) ]] && echo TRUE
[[ ++verbose == @(--|++)@(help|verbose) ]] && echo TRUE
## STDOUT:
TRUE
TRUE
## END

#### nested extglob
[[ --help == --@(help|verbose=@(1|2)) ]] && echo TRUE
[[ --verbose=1 == --@(help|verbose=@(1|2)) ]] && echo TRUE
[[ --verbose=2 == --@(help|verbose=@(1|2)) ]] && echo TRUE
[[ --verbose == --@(help|verbose=@(1|2)) ]] || echo FALSE
## STDOUT:
TRUE
TRUE
TRUE
FALSE
## END

#### extglob empty string
shopt -s extglob
[[ '' == @(foo|bar) ]] || echo FALSE
[[ '' == @(foo||bar) ]] && echo TRUE
## STDOUT:
FALSE
TRUE
## END

#### extglob empty pattern
shopt -s extglob
[[ '' == @() ]] && echo TRUE
[[ '' == @(||) ]] && echo TRUE
[[ X == @() ]] || echo FALSE
[[ '|' == @(||) ]] || echo FALSE
## STDOUT:
TRUE
TRUE
FALSE
FALSE
## END

#### case with extglob
shopt -s extglob
for word in --help --verbose --unmatched -- -zxzx -; do
  case $word in
    --@(help|verbose) )
      echo A
      continue
      ;;
    ( --?(b|c) )
      echo B
      continue
      ;;
    ( -+(x|z) )
      echo C
      continue
      ;;
    ( -*(x|z) )
      echo D
      continue
      ;;
    *)
      echo U
      continue
      ;;
  esac
done
## STDOUT:
A
A
U
B
C
D
## END

#### [[ $x == !($str) ]]
shopt -s extglob
empty=''
str='x'
[[ $empty == !($str) ]] && echo TRUE  # test glob match
[[ $str == !($str) ]]   || echo FALSE
## STDOUT:
TRUE
FALSE
## END

#### Turning extglob on changes the meaning of [[ !(str) ]] in bash
empty=''
str='x'
[[ !($empty) ]]  && echo TRUE   # test if $empty is empty
[[ !($str) ]]    || echo FALSE  # test if $str is empty
shopt -s extglob  # mksh doesn't have this
[[ !($empty) ]]  && echo TRUE   # negated glob
[[ !($str) ]]    && echo TRUE   # negated glob
## STDOUT:
TRUE
FALSE
TRUE
TRUE
## END
## N-I mksh/ksh STDOUT:
TRUE
TRUE
TRUE
## END

#### With extglob on, !($str) on the left or right of == has different meanings
shopt -s extglob
str='x'
[[ 1 == !($str) ]]  && echo TRUE   # glob match

## STDOUT:
TRUE
## END

#### extglob inside arg word
shopt -s extglob
[[ foo == @(foo|bar) ]] && echo rhs
[[ foo == ${unset:-@(foo|bar)} ]] && echo 'rhs arg'
[[ fo == ${unset:-@(foo|bar)} ]] || echo nope
## STDOUT:
rhs
rhs arg
nope
## END
## BUG mksh/ksh STDOUT:
rhs
nope
## END

#### extglob is not detected in regex!
shopt -s extglob
[[ foo =~ ^@(foo|bar)$ ]] || echo FALSE
## STDOUT:
FALSE
## END
## N-I mksh/ksh stdout-json: ""
## N-I mksh/ksh status: 1

#### regular glob of single unicode char
shopt -s extglob
[[ __a__ == __?__ ]]
echo $?
[[ __μ__ == __?__ ]]
echo $?
## STDOUT:
0
0
## END
## BUG mksh STDOUT:
0
1
## END

#### extended glob of single unicode char
shopt -s extglob
[[ __a__ == @(__?__) ]]
echo $?
[[ __μ__ == @(__?__) ]]
echo $?
## STDOUT:
0
0
## END
## BUG mksh STDOUT:
0
1
## END

#### Extended glob in ${x//pat/replace}
# not supported in OSH due to GlobToERE() strategy for positional info

shopt -s extglob
x=foo.py
echo ${x//@(?.py)/Z}
## STDOUT:
foZ
## END
## N-I osh status: 1
## N-I osh stdout-json: ""

#### Extended glob in ${x%PATTERN}

shopt -s extglob
x=foo.py
echo 'strip % ' ${x%.@(py|cc)}
echo 'strip %%' ${x%%.@(py|cc)}
echo 'strip # ' ${x#@(foo)}
echo 'strip ##' ${x##@(foo)}

## STDOUT:
strip %  foo
strip %% foo
strip #  .py
strip ## .py
## END
