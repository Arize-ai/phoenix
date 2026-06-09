## oils_failures_allowed: 7
## compare_shells: bash mksh

#### pass array by reference
show_value() {
  local -n array_name=$1
  local idx=$2
  echo "${array_name[$idx]}"
}
shadock=(ga bu zo meu)
show_value shadock 2
## stdout: zo

#### mutate array by reference
set1() {
  local -n array_name=$1
  local val=$2
  array_name[1]=$val
}
shadock=(a b c d)
set1 shadock ZZZ
echo ${shadock[@]}
## STDOUT:
a ZZZ c d
## END

#### pass assoc array by reference
show_value() {
  local -n array_name=$1
  local idx=$2
  echo "${array_name[$idx]}"
}
days=([monday]=eggs [tuesday]=bread [sunday]=jam)
show_value days sunday
## stdout: jam
## BUG mksh stdout: [monday]=eggs
#  mksh note: it coerces "days" to 0?  Horrible.

#### pass local array by reference, relying on DYNAMIC SCOPING
show_value() {
  local -n array_name=$1
  local idx=$2
  echo "${array_name[$idx]}"
}
caller() {
  local shadock=(ga bu zo meu)
  show_value shadock 2
}
caller
## stdout: zo
# mksh appears not to have local arrays!
## BUG mksh stdout-json: ""
## BUG mksh status: 1


#### flag -n and +n
x=foo

ref=x

echo ref=$ref

typeset -n ref
echo ref=$ref

# mutate underlying var
x=bar
echo ref=$ref

typeset +n ref
echo ref=$ref

## STDOUT:
ref=x
ref=foo
ref=bar
ref=x
## END

#### mutating through nameref: ref=
x=XX
y=YY

ref=x
ref=y
echo 1 ref=$ref

# now it's a reference
typeset -n ref

echo 2 ref=$ref  # prints YY

ref=XXXX
echo 3 ref=$ref  # it actually prints y, which is XXXX

# now Y is mutated!
echo 4 y=$y

## STDOUT:
1 ref=y
2 ref=YY
3 ref=XXXX
4 y=XXXX
## END


#### flag -n combined ${!ref} -- bash INVERTS
foo=FOO  # should NOT use this

x=foo
ref=x

echo ref=$ref
echo "!ref=${!ref}"

echo 'NOW A NAMEREF'

typeset -n ref
echo ref=$ref
echo "!ref=${!ref}"

## STDOUT:
ref=x
!ref=foo
NOW A NAMEREF
ref=foo
!ref=x
## END
## N-I mksh STDOUT:
ref=x
!ref=ref
NOW A NAMEREF
ref=foo
!ref=x
## END

#### named ref with $# doesn't work
set -- one two three

ref='#'
echo ref=$ref
typeset -n ref
echo ref=$ref

## STDOUT:
ref=#
ref=#
## END

# mksh does respect it!!  Gah.
## OK mksh STDOUT:
ref=#
ref=3
## END


#### named ref with $# and shopt -s strict_nameref
shopt -s strict_nameref

ref='#'
echo ref=$ref
typeset -n ref
echo ref=$ref
## STDOUT:
ref=#
## END
## status: 1
## N-I bash status: 0
## N-I bash STDOUT:
ref=#
ref=#
## END
## N-I mksh status: 0
## N-I mksh STDOUT:
ref=#
ref=0
## END

#### named ref with 1 $1 etc.
set -- one two three

x=X

ref='1'
echo ref=$ref
typeset -n ref
echo ref=$ref

# BUG: This is really assigning '1', which is INVALID
# with strict_nameref that degrades!!!
ref2='$1'
echo ref2=$ref2
typeset -n ref2
echo ref2=$ref2

x=foo

ref3='x'
echo ref3=$ref3
typeset -n ref3
echo ref3=$ref3

## STDOUT:
ref=1
ref=1
ref2=$1
ref2=$1
ref3=x
ref3=foo
## END
## BUG mksh status: 1
## BUG mksh STDOUT:
ref=1
ref=one
ref2=$1
## END

#### assign to invalid ref
ref=1   # mksh makes this READ-ONLY!  Because it's not valid.

echo ref=$ref
typeset -n ref
echo ref=$ref

ref=foo
echo ref=$ref
## STDOUT:
ref=1
ref=1
ref=foo
## END
## OK mksh status: 2
## OK mksh STDOUT:
ref=1
ref=
## END

#### assign to invalid ref with strict_nameref
case $SH in *bash|*mksh) exit ;; esac

shopt -s strict_nameref

ref=1

echo ref=$ref
typeset -n ref
echo ref=$ref

ref=foo
echo ref=$ref
## status: 1
## STDOUT:
ref=1
## END
## N-I bash/mksh status: 0
## N-I bash/mksh stdout-json: ""

#### name ref on Undef cell
typeset  -n ref

# This is technically incorrect: an undefined name shouldn't evaluate to empty
# string.  mksh doesn't allow it.
echo ref=$ref

echo nounset
set -o nounset
echo ref=$ref
## status: 1
## STDOUT:
ref=
nounset
## END
## OK mksh stdout-json: ""

#### assign to empty nameref and invalid nameref
typeset -n ref
echo ref=$ref

# this is a no-op in bash, should be stricter
ref=x
echo ref=$ref

typeset -n ref2=undef
echo ref2=$ref2
ref2=x
echo ref2=$ref2

## STDOUT:
ref=
ref=
ref2=
ref2=x
## END

# mksh gives a good error: empty nameref target
## OK mksh status: 1
## OK mksh stdout-json: ""

#### -n attribute before it has a value
typeset -n ref

echo ref=$ref

# Now that it's a string, it still has the -n attribute
x=XX
ref=x
echo ref=$ref

## STDOUT:
ref=
ref=XX
## END
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### -n attribute on array is hard error, not a warning
x=X
typeset -n ref #=x
echo hi

# bash prints warning: REMOVES the nameref attribute here!
ref=(x y)
echo ref=$ref

## status: 1
## STDOUT:
hi
## END
## N-I mksh status: 1
## N-I mksh stdout-json: ""
## BUG bash status: 0
## BUG bash STDOUT:
hi
ref=x
## END

#### exported nameref
x=foo
typeset -n -x ref=x

# hm bash ignores it but mksh doesn't.  maybe disallow it.
printenv.py x ref
echo ---
export x
printenv.py x ref
## STDOUT:
None
x
---
foo
x
## END
## OK mksh STDOUT:
None
None
---
foo
None
## END


#### readonly nameref doesn't prevent assigning through it

# hm bash also ignores -r when -n is set

x=XX
typeset -n -r ref=x

echo ref=$ref

# it feels like I shouldn't be able to mutate this?
ref=XXXX
echo ref=$ref

x=X
echo x=$x

## STDOUT:
ref=XX
ref=XXXX
x=X
## END

#### readonly var can't be assigned through nameref

x=X
typeset -n -r ref=x

echo ref=$ref

# it feels like I shouldn't be able to mutate this?
ref=XX
echo ref=$ref

# now the underling variable is immutable
typeset -r x

ref=XXX
echo ref=$ref
echo x=$x

## status: 1
## OK mksh status: 2
## STDOUT:
ref=X
ref=XX
## END

## OK bash status: 0
## OK bash STDOUT:
ref=X
ref=XX
ref=XX
x=XX
## END

#### unset nameref
x=X
typeset -n ref=x
echo ref=$ref

# this works
unset ref
echo ref=$ref
echo x=$x

## STDOUT:
ref=X
ref=
x=
## END

#### Chain of namerefs
x=foo
typeset -n ref=x
typeset -n ref_to_ref=ref
echo ref_to_ref=$ref_to_ref
echo ref=$ref
## STDOUT:
ref_to_ref=foo
ref=foo
## END

#### Mutually recursive namerefs detected on READ
typeset -n ref1=ref2
typeset -n ref2=ref1
echo defined
echo ref1=$ref1
echo ref2=$ref1
## status: 1
## STDOUT:
defined
## END
## OK mksh stdout-json: ""
## BUG bash status: 0
## BUG bash STDOUT:
defined
ref1=
ref2=
## END

#### Mutually recursive namerefs detected on WRITE
typeset -n ref1=ref2
typeset -n ref2=ref1  # not detected here
echo defined $?
ref1=z  # detected here
echo mutated $?
## status: 1
## STDOUT:
defined 0
## END
## OK mksh stdout-json: ""
## BUG bash status: 0
## BUG bash STDOUT:
defined 0
mutated 1
## END

#### Dynamic scope with namerefs

f3() {
  local -n ref=$1
  ref=x
}

f2() {
  f3 "$@"
}

f1() {
  local F1=F1
  echo F1=$F1
  f2 F1
  echo F1=$F1
}
f1

## STDOUT:
F1=F1
F1=x
## END


#### change reference itself
x=XX
y=YY
typeset -n ref=x
echo ref=$ref
echo x=$x
echo y=$y

echo ----
typeset -n ref=y
echo ref=$ref
echo x=$x
echo y=$y
echo ----
ref=z
echo ref=$ref
echo x=$x
echo y=$y

## STDOUT:
ref=XX
x=XX
y=YY
----
ref=YY
x=XX
y=YY
----
ref=z
x=XX
y=z
## END

#### a[2] in nameref

typeset -n ref='a[2]'
a=(zero one two three)
echo ref=$ref
## STDOUT:
ref=two
## END

#### a[expr] in nameref

# this confuses code and data
typeset -n ref='a[$(echo 2) + 1]'
a=(zero one two three)
echo ref=$ref
## STDOUT:
ref=three
## END

#### a[@] in nameref

# this confuses code and data
typeset -n ref='a[@]'
a=('A B' C)
argv.py ref "$ref"  # READ through ref works
ref=(X Y Z)    # WRITE through doesn't work
echo status=$?
argv.py 'ref[@]' "${ref[@]}"
argv.py ref "$ref"  # JOINING mangles the array?
argv.py 'a[@]' "${a[@]}"
## STDOUT:
['ref', 'A B', 'C']
status=1
['ref[@]']
['ref', 'A B', 'C']
['a[@]', 'A B', 'C']
## END
## OK mksh status: 1
## OK mksh stdout-json: ""

#### mutate through nameref: ref[0]=

# This is DIFFERENT than the nameref itself being 'array[0]' !

array=(X Y Z)
typeset -n ref=array
ref[0]=xx
echo ${array[@]}
## STDOUT:
xx Y Z
## END

#### bad mutation through nameref: ref[0]= where ref is array[0]
array=(X Y Z)
typeset -n ref='array[0]'
ref[0]=foo  # error in bash: 'array[0]': not a valid identifier
echo status=$?
echo ${array[@]}
## STDOUT:
status=1
X Y Z
## END
## BUG mksh STDOUT:
status=0
foo Y Z
## END

#### @ in nameref isn't supported, unlike in ${!ref}

set -- A B
typeset -n ref='@'  # bash gives an error here
echo status=$?

echo ref=$ref  # bash doesn't give an error here
echo status=$?
## status: 1
## stdout-json: ""
## OK bash status: 0
## OK bash STDOUT:
status=1
ref=
status=0
## END

#### Unquoted assoc reference on RHS
typeset -A bashup_ev_r
bashup_ev_r['foo']=bar

p() {
  local s=foo
  local -n e=bashup_ev["$s"] f=bashup_ev_r["$s"]
  # Different!
  #local e=bashup_ev["$s"] f=bashup_ev_r["$s"]
  argv.py "$f"
}
p
## STDOUT:
['bar']
## END
## N-I mksh stdout-json: ""
## N-I mksh status: 1
