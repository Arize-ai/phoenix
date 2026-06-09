# spec/append.test.sh: Test +=

## compare_shells: bash mksh zsh

#### Append string to string
s='abc'
s+=d
echo $s
## stdout: abcd

#### Append array to array
a=(x y )
a+=(t 'u v')
argv.py "${a[@]}"
## stdout: ['x', 'y', 't', 'u v']

#### Append string to undefined variable

s+=foo
echo s=$s

# bash and mksh agree that this does NOT respect set -u.
# I think that's a mistake, but += is a legacy construct, so let's copy it.

set -u

t+=foo
echo t=$t
t+=foo
echo t=$t
## STDOUT:
s=foo
t=foo
t=foofoo
## END

#### Append to array to undefined variable

y+=(c d)
argv.py "${y[@]}"
## STDOUT:
['c', 'd']
## END

#### error: s+=(my array)
s='abc'
s+=(d e f)
argv.py "${s[@]}"
## status: 0
## STDOUT:
['abc', 'd', 'e', 'f']
## END

#### error: myarray+=s

# They treat this as implicit index 0.  We disallow this on the LHS, so we will
# also disallow it on the RHS.
a=(x y )
a+=z
argv.py "${a[@]}"
## status: 1
## stdout-json: ""
## OK bash/mksh status: 0
## OK bash/mksh stdout: ['xz', 'y']
## OK zsh status: 0
## OK zsh stdout: ['x', 'y', 'z']

#### typeset s+=(my array)
typeset s='abc'
echo $s

typeset s+=(d e f)
echo status=$?
argv.py "${s[@]}"

## status: 0
## STDOUT:
abc
status=0
['abc', 'd', 'e', 'f']
## END
## N-I mksh/zsh status: 1
## N-I mksh/zsh stdout: abc
## N-I mksh stderr: mksh: <stdin>[4]: syntax error: '(' unexpected
## N-I zsh stderr: typeset: not valid in this context: s+

#### error: typeset myarray+=s
typeset a=(x y)
argv.py "${a[@]}"
typeset a+=s
argv.py "${a[@]}"

## status: 1
## STDOUT:
['x', 'y']
## END
## BUG bash status: 0
## BUG bash STDOUT:
['x', 'y']
['xs', 'y']
## END
## N-I mksh STDOUT:
## END

#### error: append used like env prefix
# This should be an error in other shells but it's not.
A=a
A+=a printenv.py A
## status: 2
## BUG bash/zsh status: 0
## BUG bash/zsh stdout: aa
## BUG mksh status: 0
## BUG mksh stdout: a

#### myarray[1]+=s - Append to element
# They treat this as implicit index 0.  We disallow this on the LHS, so we will
# also disallow it on the RHS.
a=(x y )
a[1]+=z
argv.py "${a[@]}"
## status: 0
## stdout: ['x', 'yz']
## BUG zsh stdout: ['xz', 'y']

#### myarray[-1]+=s - Append to last element
# Works in bash, but not mksh.  It seems like bash is doing the right thing.
# a[-1] is allowed on the LHS.  mksh doesn't have negative indexing?
a=(1 '2 3')
a[-1]+=' 4'
argv.py "${a[@]}"
## stdout: ['1', '2 3 4']
## BUG mksh stdout: ['1', '2 3', ' 4']

#### Try to append list to element
# bash - runtime error: cannot assign list to array number
# mksh - a[-1]+: is not an identifier
# osh - parse error -- could be better!
a=(1 '2 3')
a[-1]+=(4 5)
argv.py "${a[@]}"

## stdout-json: ""
## status: 2

## OK bash status: 0
## OK bash STDOUT:
['1', '2 3']
## END

## OK zsh status: 0
## OK zsh STDOUT:
['1', '2 3', '4', '5']
## END

## N-I mksh status: 1

#### Strings have value semantics, not reference semantics
s1='abc'
s2=$s1
s1+='d'
echo $s1 $s2
## stdout: abcd abc

#### typeset s+=

typeset s+=foo
echo s=$s

# bash and mksh agree that this does NOT respect set -u.
# I think that's a mistake, but += is a legacy construct, so let's copy it.

set -u

typeset t+=foo
echo t=$t
typeset t+=foo
echo t=$t
## STDOUT:
s=foo
t=foo
t=foofoo
## END
## N-I zsh status: 1
## N-I zsh stdout-json: ""

#### typeset s${dyn}+=

dyn=x

typeset s${dyn}+=foo
echo sx=$sx

# bash and mksh agree that this does NOT respect set -u.
# I think that's a mistake, but += is a legacy construct, so let's copy it.

set -u

typeset t${dyn}+=foo
echo tx=$tx
typeset t${dyn}+=foo
echo tx=$tx
## STDOUT:
sx=foo
tx=foo
tx=foofoo
## END
## N-I zsh status: 1
## N-I zsh stdout-json: ""

#### export readonly +=

export e+=foo
echo e=$e

readonly r+=bar
echo r=$r

set -u

export e+=foo
echo e=$e

#readonly r+=foo
#echo r=$e

## STDOUT:
e=foo
r=bar
e=foofoo
## END
## N-I zsh status: 1
## N-I zsh stdout-json: ""

#### local +=

f() {
  local s+=foo
  echo s=$s

  set -u
  local s+=foo
  echo s=$s
}

f
## STDOUT:
s=foo
s=foofoo
## END
## N-I zsh status: 1
## N-I zsh stdout-json: ""

#### assign builtin appending array: declare d+=(d e)

declare d+=(d e)
echo "${d[@]}"
declare d+=(c l)
echo "${d[@]}"

readonly r+=(r e)
echo "${r[@]}"
# can't do this again

f() {
  local l+=(l o)
  echo "${l[@]}"

  local l+=(c a)
  echo "${l[@]}"
}

f

## STDOUT:
d e
d e c l
r e
l o
l o c a
## END
## N-I mksh status: 1
## N-I mksh stdout-json: ""
## N-I zsh status: 1
## N-I zsh stdout-json: ""

#### export+=array disallowed (strict_array)
shopt -s strict_array

export e+=(e x)
echo "${e[@]}"

## status: 1
## STDOUT:
## END
## N-I bash status: 0
## N-I bash STDOUT:
e x
## END


#### Type mismatching of lhs+=rhs should not cause a crash
case $SH in mksh|zsh) exit ;; esac
s=
a=()
declare -A d=([lemon]=yellow)

s+=(1)
s+=([melon]=green)

a+=lime
a+=([1]=banana)

d+=orange
d+=(0)

true

## STDOUT:
## END

## OK osh status: 1

## N-I mksh/zsh STDOUT:
## END
