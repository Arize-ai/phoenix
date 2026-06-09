## compare_shells: bash mksh
## our_shell: osh
## oils_failures_allowed: 5

# Corner cases for assignment that we're not handling now.

#### typeset a[3]=4
typeset a[3]=4 a[5]=6
echo status=$?
argv.py "${!a[@]}" "${a[@]}"
## STDOUT:
status=0
['3', '5', '4', '6']
## END

#### typeset -a a[1]=a a[3]=c
# declare works the same way in bash, but not mksh.
# spaces are NOT allowed here.
typeset -a a[1*1]=x a[1+2]=z
argv.py "${a[@]}"
## stdout: ['x', 'z']

#### local a[3]=4
f() {
  local a[3]=4 a[5]=6
  echo status=$?
  argv.py "${!a[@]}" "${a[@]}"
}
f
## STDOUT:
status=0
['3', '5', '4', '6']
## END

#### readonly a[7]=8
readonly b[7]=8
echo status=$?
argv.py "${!b[@]}" "${b[@]}"
## STDOUT:
status=0
['7', '8']
## END

# bash doesn't like this variable name!
## N-I bash STDOUT:
status=1
[]
## END

#### export a[7]=8
export a[7]=8
echo status=$?
argv.py "${!a[@]}" "${a[@]}"
printenv.py a
## STDOUT:
status=1
[]
None
## END
## OK osh STDOUT:
status=2
[]
None
## END
## BUG mksh STDOUT:
status=0
['7', '8']
None
## END

#### 'builtin' prefix is allowed on assignments
builtin export e='E'
echo e=$e
## STDOUT:
e=E
## END
## N-I dash STDOUT:
e=
## END

#### 'command' prefix is allowed on assignments
readonly r1='R1'  # zsh has this
command readonly r2='R2'  # but not this
echo r1=$r1
echo r2=$r2
## STDOUT:
r1=R1
r2=R2
## END
## N-I zsh STDOUT:
r1=R1
r2=
## END

#### is 'builtin' prefix and array allowed?  OSH is smarter
builtin typeset a=(1 2 3)
echo len=${#a[@]}
## STDOUT:
len=3
## END
## OK bash status: 2
## OK bash stdout-json: ""
## OK-2 mksh status: 1
## OK-2 mksh stdout-json: ""

#### is 'command' prefix and array allowed?  OSH is smarter
command typeset a=(1 2 3)
echo len=${#a[@]}
## STDOUT:
len=3
## END
## OK bash status: 2
## OK bash stdout-json: ""
## OK-2 mksh status: 1
## OK-2 mksh stdout-json: ""
