# Test combination of var ops.
#
# NOTE: There are also slice tests in {array,arith-context}.test.sh.

## compare_shells: bash mksh zsh

#### String slice
foo=abcdefg
echo ${foo:1:3}
## STDOUT:
bcd
## END

#### Cannot take length of substring slice
# These are runtime errors, but we could make them parse time errors.
v=abcde
echo ${#v:1:3}
## status: 1
## OK osh status: 2
# zsh actually implements this!
## OK zsh stdout: 3
## OK zsh status: 0

#### Out of range string slice: begin
# out of range begin doesn't raise error in bash, but in mksh it skips the
# whole thing!
foo=abcdefg
echo _${foo:100:3}
echo $?
## STDOUT:
_
0
## END
## BUG mksh STDOUT:

0
## END

#### Out of range string slice: length
# OK in both bash and mksh
foo=abcdefg
echo _${foo:3:100}
echo $?
## STDOUT:
_defg
0
## END
## BUG mksh STDOUT:
_defg
0
## END

#### Negative start index
foo=abcdefg
echo ${foo: -4:3}
## stdout: def

#### Negative start index respects unicode
foo=abcd-μ-
echo ${foo: -4:3}
## stdout: d-μ
## BUG mksh stdout: -μ

#### Negative second arg is position, not length!
foo=abcdefg
echo ${foo:3:-1} ${foo: 3: -2} ${foo:3 :-3 }
## stdout: def de d
## BUG mksh stdout: defg defg defg

#### Negative start index respects unicode
foo=abcd-μ-
echo ${foo: -5: -3}
## stdout: cd
## BUG mksh stdout: d-μ-

#### String slice with math
# I think this is the $(()) language inside?
i=1
foo=abcdefg
echo ${foo: i+4-2 : i + 2}
## stdout: def

#### Slice undefined
echo -${undef:1:2}-
set -o nounset
echo -${undef:1:2}-
echo -done-
## STDOUT:
--
## END
## status: 1
# mksh doesn't respect nounset!
## BUG mksh status: 0
## BUG mksh STDOUT:
--
--
-done-
## END

#### Slice UTF-8 String
# mksh slices by bytes.
foo='--μ--'
echo ${foo:1:3}
## stdout: -μ-
## BUG mksh stdout: -μ

#### Slice string with invalid UTF-8 results in empty string and warning
s=$(echo -e "\xFF")bcdef
echo -${s:1:3}-
## status: 0
## STDOUT:
--
## END
## STDERR:
[??? no location ???] warning: UTF-8 decode: Bad encoding at offset 0 in string of 6 bytes
## END
## BUG bash/mksh/zsh status: 0
## BUG bash/mksh/zsh STDOUT:
-bcd-
## END
## BUG bash/mksh/zsh stderr-json: ""


#### Slice string with invalid UTF-8 with strict_word_eval
shopt -s strict_word_eval || true
echo slice
s=$(echo -e "\xFF")bcdef
echo -${s:1:3}-
## status: 1
## STDOUT: 
slice
## END
## N-I bash/mksh/zsh status: 0
## N-I bash/mksh/zsh STDOUT:
slice
-bcd-
## END

#### Slice with an index that's an array -- silent a[0] decay
i=(3 4 5)
mystr=abcdefg
echo assigned
echo ${mystr:$i:2}

## status: 0
## STDOUT:
assigned
de
## END
## OK zsh status: 1
## OK zsh STDOUT:
assigned
## END

#### Slice with an assoc array
declare -A A=(['5']=3 ['6']=4)
mystr=abcdefg
echo assigned
echo ${mystr:$A:2}

## status: 0
## STDOUT:
assigned
ab
## END

## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### Simple ${@:offset}

set -- 4 5 6

result=$(argv.py ${@:0})
echo ${result//"$0"/'SHELL'}

argv.py ${@:1}
argv.py ${@:2}

## STDOUT:
['SHELL', '4', '5', '6']
['4', '5', '6']
['5', '6']
## END
## N-I mksh status: 1
## N-I mksh STDOUT:

## END


#### ${@:offset} and ${*:offset}
case $SH in zsh) return ;; esac  # zsh is very different

argv.shell-name-checked () {
  argv.py "${@//$0/SHELL}"
}
fun() {
  argv.shell-name-checked -${*:0}- # include $0
  argv.shell-name-checked -${*:1}- # from $1
  argv.shell-name-checked -${*:3}- # last parameter $3
  argv.shell-name-checked -${*:4}- # empty
  argv.shell-name-checked -${*:5}- # out of boundary
  argv.shell-name-checked -${@:0}-
  argv.shell-name-checked -${@:1}-
  argv.shell-name-checked -${@:3}-
  argv.shell-name-checked -${@:4}-
  argv.shell-name-checked -${@:5}-
  argv.shell-name-checked "-${*:0}-"
  argv.shell-name-checked "-${*:1}-"
  argv.shell-name-checked "-${*:3}-"
  argv.shell-name-checked "-${*:4}-"
  argv.shell-name-checked "-${*:5}-"
  argv.shell-name-checked "-${@:0}-"
  argv.shell-name-checked "-${@:1}-"
  argv.shell-name-checked "-${@:3}-"
  argv.shell-name-checked "-${@:4}-"
  argv.shell-name-checked "-${@:5}-"
}
fun "a 1" "b 2" "c 3"
## STDOUT:
['-SHELL', 'a', '1', 'b', '2', 'c', '3-']
['-a', '1', 'b', '2', 'c', '3-']
['-c', '3-']
['--']
['--']
['-SHELL', 'a', '1', 'b', '2', 'c', '3-']
['-a', '1', 'b', '2', 'c', '3-']
['-c', '3-']
['--']
['--']
['-SHELL a 1 b 2 c 3-']
['-a 1 b 2 c 3-']
['-c 3-']
['--']
['--']
['-SHELL', 'a 1', 'b 2', 'c 3-']
['-a 1', 'b 2', 'c 3-']
['-c 3-']
['--']
['--']
## END
## N-I mksh status: 1
## N-I mksh stdout-json: ""
## BUG zsh stdout-json: ""

#### ${@:offset:length} and ${*:offset:length}
case $SH in zsh) return ;; esac  # zsh is very different

argv.shell-name-checked () {
  argv.py "${@//$0/SHELL}"
}
fun() {
  argv.shell-name-checked -${*:0:2}- # include $0
  argv.shell-name-checked -${*:1:2}- # from $1
  argv.shell-name-checked -${*:3:2}- # last parameter $3
  argv.shell-name-checked -${*:4:2}- # empty
  argv.shell-name-checked -${*:5:2}- # out of boundary
  argv.shell-name-checked -${@:0:2}-
  argv.shell-name-checked -${@:1:2}-
  argv.shell-name-checked -${@:3:2}-
  argv.shell-name-checked -${@:4:2}-
  argv.shell-name-checked -${@:5:2}-
  argv.shell-name-checked "-${*:0:2}-"
  argv.shell-name-checked "-${*:1:2}-"
  argv.shell-name-checked "-${*:3:2}-"
  argv.shell-name-checked "-${*:4:2}-"
  argv.shell-name-checked "-${*:5:2}-"
  argv.shell-name-checked "-${@:0:2}-"
  argv.shell-name-checked "-${@:1:2}-"
  argv.shell-name-checked "-${@:3:2}-"
  argv.shell-name-checked "-${@:4:2}-"
  argv.shell-name-checked "-${@:5:2}-"
}
fun "a 1" "b 2" "c 3"
## STDOUT:
['-SHELL', 'a', '1-']
['-a', '1', 'b', '2-']
['-c', '3-']
['--']
['--']
['-SHELL', 'a', '1-']
['-a', '1', 'b', '2-']
['-c', '3-']
['--']
['--']
['-SHELL a 1-']
['-a 1 b 2-']
['-c 3-']
['--']
['--']
['-SHELL', 'a 1-']
['-a 1', 'b 2-']
['-c 3-']
['--']
['--']
## END
## N-I mksh status: 1
## N-I mksh stdout-json: ""
## BUG zsh stdout-json: ""

#### ${@:0:1}
set a b c
result=$(echo ${@:0:1})
echo ${result//"$0"/'SHELL'}
## STDOUT:
SHELL
## END
## N-I mksh STDOUT:

## END

#### Permutations of implicit begin and length
array=(1 2 3)

argv.py ${array[@]}

# *** implicit length of N **
argv.py ${array[@]:0}

# Why is this one not allowed
#argv.py ${array[@]:}

# ** implicit length of ZERO **
#argv.py ${array[@]::}
#argv.py ${array[@]:0:}

argv.py ${array[@]:0:0}
echo

# Same agreed upon permutations
set -- 1 2 3
argv.py ${@}
argv.py ${@:1}
argv.py ${@:1:0}
echo

s='123'
argv.py "${s}"
argv.py "${s:0}"
argv.py "${s:0:0}"

## STDOUT:
['1', '2', '3']
['1', '2', '3']
[]

['1', '2', '3']
['1', '2', '3']
[]

['123']
['123']
['']
## END

## BUG mksh status: 1
## BUG mksh STDOUT:
['1', '2', '3']
## END

#### ${array[@]:} vs ${array[@]: }  - bash and zsh inconsistent
## SKIP (unimplementable): Interactive shell invocation not implemented

$SH -c 'array=(1 2 3); argv.py ${array[@]:}'
$SH -c 'array=(1 2 3); argv.py space ${array[@]: }'

$SH -c 's=123; argv.py ${s:}'
$SH -c 's=123; argv.py space ${s: }'

## STDOUT:
['space', '1', '2', '3']
['space', '123']
## END

## OK osh STDOUT:
['1', '2', '3']
['space', '1', '2', '3']
['123']
['space', '123']
## END

## BUG mksh STDOUT:
['space', '123']
## END

#### ${array[@]::} has implicit length of zero - for ble.sh

# https://oilshell.zulipchat.com/#narrow/stream/121540-oil-discuss/topic/.24.7Barr.5B.40.5D.3A.3A.7D.20in.20bash.20-.20is.20it.20documented.3F

array=(1 2 3)
argv.py ${array[@]::}
argv.py ${array[@]:0:}

echo

set -- 1 2 3
argv.py ${@::}
argv.py ${@:0:}

## status: 0
## STDOUT:
[]
[]

[]
[]
## END

## OK mksh/zsh status: 1
## OK mksh/zsh STDOUT:
## END
