## compare_shells: bash-4.4
## oils_failures_allowed: 2


# NOTE:
# -declare -A is required.
#
# Simply doing:
# a=([aa]=b [foo]=bar ['a+1']=c)
# gets utterly bizarre behavior.
#
# Associtative Arrays are COMPLETELY bash-specific.  mksh doesn't even come
# close.  So I will probably not implement them, or implement something
# slightly different, because the semantics are just weird.

# http://www.gnu.org/software/bash/manual/html_node/Arrays.html
# TODO: Need a SETUP section.

#### Literal syntax ([x]=y)
declare -A a
a=([aa]=b [foo]=bar ['a+1']=c)
echo ${a["aa"]}
echo ${a["foo"]}
echo ${a["a+1"]}
## STDOUT:
b
bar
c
## END

#### set associative array to indexed array literal (very surprising bash behavior)
declare -A assoc=([k1]=foo [k2]='spam eggs')
declare -p assoc

# Bash 5.1 assoc=(key value). Bash 5.0 (including the currently tested 4.4)
# does not implement this.

assoc=(foo 'spam eggs')
declare -p assoc

## STDOUT:
declare -A assoc=(['k1']=foo ['k2']='spam eggs')
declare -A assoc=(['foo']='spam eggs')
## END
## N-I bash STDOUT:
declare -A assoc=([k1]="foo" [k2]="spam eggs" )
declare -A assoc=()
## END

#### Can initialize assoc array with the "(key value ...)" sequence
declare -A A=(1 2 3)
echo status=$?
declare -p A
## STDOUT:
status=0
declare -A A=(['1']=2 ['3']='')
## END

# bash-4.4 prints warnings to stderr but gives no indication of the problem
## BUG bash STDOUT:
status=0
declare -A A=()
## END

#### create empty assoc array, put, then get
declare -A A  # still undefined
argv.py "${A[@]}"
argv.py "${!A[@]}"
A['foo']=bar
echo ${A['foo']}
## STDOUT:
[]
[]
bar
## END

#### Empty value (doesn't use EmptyWord?)
declare -A A=(["k"]= )
argv.py "${A["k"]}"
## STDOUT:
['']
## END

#### retrieve keys with !
declare -A a
var='x'
a["$var"]=b
a['foo']=bar
a['a+1']=c
for key in "${!a[@]}"; do
  echo $key
done | sort
## STDOUT:
a+1
foo
x
## END

#### retrieve values with ${A[@]}
declare -A A
var='x'
A["$var"]=b
A['foo']=bar
A['a+1']=c
for val in "${A[@]}"; do
  echo $val
done | sort
## STDOUT:
b
bar
c
## END

#### coerce to string with ${A[*]}, etc.
declare -A A
A['X X']=xx
A['Y Y']=yy
argv.py "${A[*]}"
argv.py "${!A[*]}"

argv.py ${A[@]}
argv.py ${!A[@]}
## STDOUT:
['xx yy']
['X X Y Y']
['xx', 'yy']
['X', 'X', 'Y', 'Y']
## END

#### ${A[@]/b/B}
# but ${!A[@]/b/B} doesn't work
declare -A A
A['aa']=bbb
A['bb']=ccc
A['cc']=ddd
for val in "${A[@]//b/B}"; do
  echo $val
done | sort
## STDOUT:
BBB
ccc
ddd
## END

#### ${A[@]#prefix}
declare -A A
A['aa']=one
A['bb']=two
A['cc']=three
for val in "${A[@]#t}"; do
  echo $val
done | sort
## STDOUT:
hree
one
wo
## END

#### ${assoc} is like ${assoc[0]}
declare -A a

a=([aa]=b [foo]=bar ['a+1']=c)
echo a="${a}"

a=([0]=zzz)
echo a="${a}"

a=(['0']=yyy)
echo a="${a}"

## STDOUT:
a=
a=zzz
a=yyy
## END

#### length ${#a[@]}
declare -A a
a["x"]=1
a["y"]=2
a["z"]=3
echo "${#a[@]}"
## stdout: 3

#### lookup with ${a[0]} -- "0" is a string
declare -A a
a["0"]=a
a["1"]=b
a["2"]=c
echo 0 "${a[0]}" 1 "${a[1]}" 2 "${a[2]}"
## STDOUT:
0 a 1 b 2 c
## END

#### lookup with double quoted strings "mykey"
declare -A a
a["aa"]=b
a["foo"]=bar
a['a+1']=c
echo "${a["aa"]}" "${a["foo"]}" "${a["a+1"]}"
## STDOUT:
b bar c
## END

#### lookup with single quoted string
declare -A a
a["aa"]=b
a["foo"]=bar
a['a+1']=c
echo "${a['a+1']}"
## stdout: c

#### lookup with unquoted $key and quoted "$i$i"
declare -A A
A["aa"]=b
A["foo"]=bar

key=foo
echo ${A[$key]}
i=a
echo ${A["$i$i"]}   # note: ${A[$i$i]} doesn't work in OSH
## STDOUT:
bar
b
## END

#### lookup by unquoted string doesn't work in OSH because it's a variable
declare -A a
a["aa"]=b
a["foo"]=bar
a['a+1']=c
echo "${a[a+1]}"
## stdout-json: ""
## status: 1
## BUG bash stdout: c
## BUG bash status: 0

#### bash bug: "i+1" and i+1 are the same key

i=1
array=(5 6 7)
echo array[i]="${array[i]}"
echo array[i+1]="${array[i+1]}"

# arithmetic does NOT work here in bash.  These are unquoted strings!
declare -A assoc
assoc[i]=$i
assoc[i+1]=$i+1

assoc["i"]=string
assoc["i+1"]=string+1

echo assoc[i]="${assoc[i]}" 
echo assoc[i+1]="${assoc[i+1]}"

echo assoc[i]="${assoc["i"]}" 
echo assoc[i+1]="${assoc["i+1"]}"

## status: 1
## STDOUT:
array[i]=6
array[i+1]=7
## END
## BUG bash status: 0
## BUG bash STDOUT:
array[i]=6
array[i+1]=7
assoc[i]=string
assoc[i+1]=string+1
assoc[i]=string
assoc[i+1]=string+1
## END

#### Array stored in associative array gets converted to string (without strict_array)

array=('1 2' 3)
declare -A d
d['key']="${array[@]}"
argv.py "${d['key']}"
## stdout: ['1 2 3']

#### Indexed array as key of associative array coerces to string (without shopt -s strict_array)
declare -a array=(1 2 3)
declare -A assoc
assoc[42]=43
assoc["${array[@]}"]=foo

echo "${assoc["${array[@]}"]}"
for entry in "${!assoc[@]}"; do
  echo $entry
done | sort

## STDOUT:
foo
1 2 3
42
## END

#### Append to associative array value A['x']+='suffix'
declare -A A
A['x']='foo'
A['x']+='bar'
A['x']+='bar'
argv.py "${A["x"]}"
## STDOUT:
['foobarbar']
## END

#### Slice of associative array doesn't make sense in bash
declare -A a
a[xx]=1
a[yy]=2
a[zz]=3
a[aa]=4
a[bb]=5
#argv.py ${a["xx"]}
argv.py ${a[@]: 0: 3}
argv.py ${a[@]: 1: 3}
argv.py ${a[@]: 2: 3}
argv.py ${a[@]: 3: 3}
argv.py ${a[@]: 4: 3}
argv.py ${a[@]: 5: 3}
## stdout-json: ""
## status: 1

#### bash variable can have an associative array part and a string part
# and $assoc is equivalent to ${assoc[0]}, just like regular arrays
declare -A assoc
assoc[1]=1
assoc[2]=2
echo ${assoc[1]} ${assoc[2]} ${assoc}
assoc[0]=zero
echo ${assoc[1]} ${assoc[2]} ${assoc}
assoc=string
echo ${assoc[1]} ${assoc[2]} ${assoc}
## STDOUT:
1 2
1 2 zero
1 2 string
## END
## N-I osh status: 1
## N-I osh STDOUT:
1 2
1 2 zero
## END

#### Associative array expressions inside (( )) with keys that look like numbers
declare -A assoc
assoc[0]=42
(( var = ${assoc[0]} ))
echo $var
(( var = assoc[0] ))
echo $var
## STDOUT:
42
42
## END

#### (( A[5] += 42 ))
declare -A A
(( A[5] = 10 ))
(( A[5] += 6 ))
echo ${A[5]}
## STDOUT:
16
## END

#### (( A[5] += 42 )) with empty cell
shopt -u strict_arith  # default zero cell
declare -A A
(( A[5] += 6 ))
echo ${A[5]}
## STDOUT:
6
## END

#### setting key to itself (from bash-bug mailing list)
declare -A foo
foo=(["key"]="value1")
echo ${foo["key"]}
foo=(["key"]="${foo["key"]} value2")
echo ${foo["key"]}
## STDOUT:
value1
value1 value2
## END
## BUG bash STDOUT:
value1
value2
## END

#### readonly associative array can't be modified
declare -Ar A
A['x']=1
echo status=$?
## OK osh status: 1
## OK osh stdout-json: ""
# just-bash treats readonly assignment as fatal (matches osh)
## OK bash status: 1
## OK bash stdout-json: ""
## STDOUT:
status=1
## END

#### associative array and brace expansion
declare -A A=([k1]=v [k2]=-{a,b}-)
echo ${A["k1"]}
echo ${A["k2"]}
## STDOUT:
v
-{a,b}-
## END

#### declare -A A=() allowed
set -o nounset
shopt -s strict_arith || true

declare -A ASSOC=()
echo len=${#ASSOC[@]}

# Check that it really can be used like an associative array
ASSOC['k']='32'
echo len=${#ASSOC[@]}

# bash allows a variable to be an associative array AND unset, while OSH
# doesn't
set +o nounset
declare -A u
echo unset len=${#u[@]}
## STDOUT:
len=0
len=1
unset len=0
## END

#### unset -v and assoc array
shopt -s eval_unsafe_arith || true

show-len() {
  echo len=${#assoc[@]}
}

declare -A assoc=(['K']=val)
show-len

unset -v 'assoc["K"]'
show-len

declare -A assoc=(['K']=val)
show-len
key=K
unset -v 'assoc[$key]'
show-len

declare -A assoc=(['K']=val)
show-len
unset -v 'assoc[$(echo K)]'
show-len

# ${prefix} doesn't work here, even though it does in arithmetic
#declare -A assoc=(['K']=val)
#show-len
#prefix=as
#unset -v '${prefix}soc[$key]'
#show-len

## STDOUT:
len=1
len=0
len=1
len=0
len=1
len=0
## END

#### nameref and assoc array
show-values() {
  echo values: ${A[@]}
}

declare -A A=(['K']=val)
show-values

declare -n ref='A["K"]'
echo before $ref
ref='val2'
echo after $ref
show-values

echo ---

key=K
declare -n ref='A[$key]'
echo before $ref
ref='val3'
echo after $ref
show-values

## STDOUT:
values: val
before val
after val2
values: val2
---
before val2
after val3
values: val3
## END

#### ${!ref} and assoc array
show-values() {
  echo values: ${A[@]}
}

declare -A A=(['K']=val)
show-values

declare ref='A["K"]'
echo ref ${!ref}

key=K
declare ref='A[$key]'
echo ref ${!ref}

## STDOUT:
values: val
ref val
ref val
## END

#### printf -v and assoc array
show-values() {
  echo values: ${assoc[@]}
}

declare -A assoc=(['K']=val)
show-values

printf -v 'assoc["K"]' '/%s/' val2
show-values

key=K
printf -v 'assoc[$key]' '/%s/' val3
show-values

# Somehow bash doesn't allow this
#prefix=as
#printf -v '${prefix}soc[$key]' '/%s/' val4
#show-values

## STDOUT:
values: val
values: /val2/
values: /val3/
## END

#### bash bug: (( A["$key"] = 1 )) doesn't work
declare -A A
#A["$key"]=1

# Works in both
#A["$key"]=42

# Works in bash only
#(( A[\$key] = 42 ))

(( A["$key"] = 42 ))

argv.py "${!A[@]}"
argv.py "${A[@]}"
## STDOUT:
['\\']
['42']
## END
## BUG bash STDOUT:
[]
[]
## END


#### Implicit increment of keys
declare -a arr=( [30]=a b [40]=x y)
argv.py "${!arr[@]}"
argv.py "${arr[@]}"

## STDOUT:
['30', '31', '40', '41']
['a', 'b', 'x', 'y']
## END

#### test -v assoc[key]

typeset -A assoc
assoc=([empty]='' [k]=v)

echo 'no quotes'

test -v assoc[empty]
echo empty=$?

test -v assoc[k]
echo k=$?

test -v assoc[nonexistent]
echo nonexistent=$?

echo

# Now with quotes
echo 'quotes'

test -v assoc["empty"]
echo empty=$?

test -v assoc['k']
echo k=$?

test -v assoc['nonexistent'] 
echo nonexistent=$?

## STDOUT:
no quotes
empty=0
k=0
nonexistent=1

quotes
empty=0
k=0
nonexistent=1
## END

#### test -v with dynamic parsing

typeset -A assoc
assoc=([empty]='' [k]=v)

key=empty
test -v 'assoc[$key]'
echo empty=$?

key=k
test -v 'assoc[$key]'
echo k=$?

key=nonexistent
test -v 'assoc[$key]'
echo nonexistent=$?

## STDOUT:
empty=0
k=0
nonexistent=1
## END

#### [[ -v assoc[key] ]]

typeset -A assoc
assoc=([empty]='' [k]=v)

echo 'no quotes'

[[ -v assoc[empty] ]]
echo empty=$?

[[ -v assoc[k] ]]
echo k=$?

[[ -v assoc[nonexistent] ]]
echo nonexistent=$?

echo

# Now with quotes
echo 'quotes'

[[ -v assoc["empty"] ]]
echo empty=$?

[[ -v assoc['k'] ]]
echo k=$?

[[ -v assoc['nonexistent'] ]]
echo nonexistent=$?

echo

echo 'vars'

key=empty
[[ -v assoc[$key] ]]
echo empty=$?

key=k
[[ -v assoc[$key] ]]
echo k=$?

key=nonexistent
[[ -v assoc[$key] ]]
echo nonexistent=$?

## STDOUT:
no quotes
empty=0
k=0
nonexistent=1

quotes
empty=0
k=0
nonexistent=1

vars
empty=0
k=0
nonexistent=1
## END

## N-I mksh status: 1
## N-I mksh STDOUT:
## END

#### [[ -v assoc[key] ]] syntax errors
typeset -A assoc
assoc=([empty]='' [k]=v)

[[ -v assoc[empty] ]]
echo empty=$?

[[ -v assoc[k] ]]
echo k=$?

[[ -v assoc[k]z ]]
echo typo=$?

## STDOUT:
empty=0
k=0
typo=1
## END


#### BashAssoc a+=()
declare -A a=([apple]=red [orange]=orange)
a+=([lemon]=yellow [banana]=yellow)
echo "apple is ${a['apple']}"
echo "orange is ${a['orange']}"
echo "lemon is ${a['lemon']}"
echo "banana is ${a['banana']}"

## STDOUT:
apple is red
orange is orange
lemon is yellow
banana is yellow
## END


#### BashAssoc ${a[@]@Q}

declare -A a=()
a['symbol1']=\'\'
a['symbol2']='"'
a['symbol3']='()<>&|'
a['symbol4']='[]*?'
echo "[${a[@]@Q}]"
echo "[${a[*]@Q}]"

## STDOUT:
[$'\'\'' '"' '()<>&|' '[]*?']
[$'\'\'' '"' '()<>&|' '[]*?']
## END

## OK bash STDOUT:
['[]*?' ''\'''\''' '"' '()<>&|']
['[]*?' ''\'''\''' '"' '()<>&|']
## END
