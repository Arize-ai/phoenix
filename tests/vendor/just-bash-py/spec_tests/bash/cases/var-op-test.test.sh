## compare_shells: bash dash mksh zsh
## oils_failures_allowed: 0

#### Lazy Evaluation of Alternative
i=0
x=x
echo ${x:-$((i++))}
echo $i
echo ${undefined:-$((i++))}
echo $i  # i is one because the alternative was only evaluated once
## status: 0
## STDOUT:
x
0
0
1
## END
## N-I dash status: 2
## N-I dash STDOUT:
x
0
## END

#### Default value when empty
empty=''
echo ${empty:-is empty}
## stdout: is empty

#### Default value when unset
echo ${unset-is unset}
## stdout: is unset

#### Unquoted with array as default value
set -- '1 2' '3 4'
argv.py X${unset=x"$@"x}X
argv.py X${unset=x$@x}X  # If you want OSH to split, write this
# osh
## STDOUT:
['Xx1', '2', '3', '4xX']
['Xx1', '2', '3', '4xX']
## END
## OK osh STDOUT:
['Xx1 2', '3 4xX']
['Xx1', '2', '3', '4xX']
## END
## OK zsh STDOUT:
['Xx1 2 3 4xX']
['Xx1 2 3 4xX']
## END

#### Quoted with array as default value
set -- '1 2' '3 4'
argv.py "X${unset=x"$@"x}X"
argv.py "X${unset=x$@x}X"  # OSH is the same here
## STDOUT:
['Xx1 2 3 4xX']
['Xx1 2 3 4xX']
## END

# Bash 4.2..4.4 had a bug. This was fixed in Bash 5.0.
#
# ## BUG bash STDOUT:
# ['Xx1', '2', '3', '4xX']
# ['Xx1 2 3 4xX']
# ## END

## OK osh STDOUT:
['Xx1 2', '3 4xX']
['Xx1 2 3 4xX']
## END

#### Assign default with array
set -- '1 2' '3 4'
argv.py X${unset=x"$@"x}X
argv.py "$unset"
## STDOUT:
['Xx1', '2', '3', '4xX']
['x1 2 3 4x']
## END
## OK osh STDOUT:
['Xx1 2', '3 4xX']
['x1 2 3 4x']
## END
## OK zsh STDOUT:
['Xx1 2 3 4xX']
['x1 2 3 4x']
## END

#### Assign default value when empty
empty=''
${empty:=is empty}
echo $empty
## stdout: is empty

#### Assign default value when unset
${unset=is unset}
echo $unset
## stdout: is unset

#### ${v:+foo} Alternative value when empty
v=foo
empty=''
echo ${v:+v is not empty} ${empty:+is not empty}
## stdout: v is not empty

#### ${v+foo} Alternative value when unset
v=foo
echo ${v+v is not unset} ${unset:+is not unset}
## stdout: v is not unset

#### "${x+foo}" quoted (regression)
# Python's configure caught this
argv.py "${with_icc+set}" = set
## STDOUT:
['', '=', 'set']
## END

#### ${s+foo} and ${s:+foo} when set -u
set -u
v=v
echo v=${v:+foo}
echo v=${v+foo}
unset v
echo v=${v:+foo}
echo v=${v+foo}
## STDOUT:
v=foo
v=foo
v=
v=
## END

#### "${array[@]} with set -u (bash is outlier)
case $SH in dash) exit ;; esac

set -u

typeset -a empty
empty=()

echo empty /"${empty[@]}"/
echo undefined /"${undefined[@]}"/

## status: 1
## STDOUT:
empty //
## END

## BUG bash status: 0
## BUG bash STDOUT:
empty //
undefined //
## END

# empty array is unset in mksh
## BUG mksh status: 1
## BUG mksh STDOUT:
## END

## N-I dash status: 0
## N-I dash STDOUT:
## END


#### "${undefined[@]+foo}" and "${undefined[@]:+foo}", with set -u
case $SH in dash) exit ;; esac

set -u

echo plus /"${array[@]+foo}"/
echo plus colon /"${array[@]:+foo}"/

## STDOUT:
plus //
plus colon //
## END

## N-I dash STDOUT:
## END

#### "${a[@]+foo}" and "${a[@]:+foo}" - operators are equivalent on arrays?

case $SH in dash) exit ;; esac

echo '+ ' /"${array[@]+foo}"/
echo '+:' /"${array[@]:+foo}"/
echo

typeset -a array
array=()

echo '+ ' /"${array[@]+foo}"/
echo '+:' /"${array[@]:+foo}"/
echo

array=('')

echo '+ ' /"${array[@]+foo}"/
echo '+:' /"${array[@]:+foo}"/
echo

array=(spam eggs)

echo '+ ' /"${array[@]+foo}"/
echo '+:' /"${array[@]:+foo}"/
echo


## BUG mksh STDOUT:
+  //
+: //

+  //
+: //

+  /foo/
+: //

+  /foo/
+: /foo/

## END

# Bash 2.0..4.4 has a bug that "${a[@]:-xxx}" produces an empty string.  It
# seemed to consider a[@] and a[*] are non-empty when there is at least one
# element even if the element is empty.  This was fixed in Bash 5.0.
#
# ## BUG bash STDOUT:
# +  //
# +: //
#
# +  //
# +: //
#
# +  /foo/
# +: /foo/
#
# +  /foo/
# +: /foo/
#
# ## END

## BUG zsh STDOUT:
+  //
+: //

+  /foo/
+: //

+  /foo/
+: /foo/

+  /foo/
+: /foo/

## END

## N-I dash STDOUT:
## END



#### Nix idiom ${!hooksSlice+"${!hooksSlice}"} - was workaround for obsolete bash 4.3 bug

case $SH in dash|mksh|zsh) exit ;; esac

# https://oilshell.zulipchat.com/#narrow/stream/307442-nix/topic/Replacing.20bash.20with.20osh.20in.20Nixpkgs.20stdenv

(argv.py ${!hooksSlice+"${!hooksSlice}"})

hooksSlice=x

argv.py ${!hooksSlice+"${!hooksSlice}"}

declare -a hookSlice=()

argv.py ${!hooksSlice+"${!hooksSlice}"}

foo=42
bar=43

declare -a hooksSlice=(foo bar spam eggs)

argv.py ${!hooksSlice+"${!hooksSlice}"}

## STDOUT:
[]
[]
[]
['42']
## END

## OK dash/mksh/zsh STDOUT:
## END

#### ${v-foo} and ${v:-foo} when set -u
set -u
v=v
echo v=${v:-foo}
echo v=${v-foo}
unset v
echo v=${v:-foo}
echo v=${v-foo}
## STDOUT:
v=v
v=v
v=foo
v=foo
## END

#### array and - and +
## SKIP (unimplementable): shopt compat_array not implemented (OSH-specific), empty string in unquoted array expansion loses space
case $SH in dash) exit ;; esac

shopt -s compat_array  # to refer to array as scalar

empty=()
a1=('')
a2=('' x)
a3=(3 4)
echo empty=${empty[@]-minus}
echo a1=${a1[@]-minus}
echo a1[0]=${a1[0]-minus}
echo a2=${a2[@]-minus}
echo a3=${a3[@]-minus}
echo ---

echo empty=${empty[@]+plus}
echo a1=${a1[@]+plus}
echo a1[0]=${a1[0]+plus}
echo a2=${a2[@]+plus}
echo a3=${a3[@]+plus}
echo ---

echo empty=${empty+plus}
echo a1=${a1+plus}
echo a2=${a2+plus}
echo a3=${a3+plus}
echo ---

# Test quoted arrays too
argv.py "${empty[@]-minus}"
argv.py "${empty[@]+plus}"
argv.py "${a1[@]-minus}"
argv.py "${a1[@]+plus}"
argv.py "${a1[0]-minus}"
argv.py "${a1[0]+plus}"
argv.py "${a2[@]-minus}"
argv.py "${a2[@]+plus}"
argv.py "${a3[@]-minus}"
argv.py "${a3[@]+plus}"

## STDOUT:
empty=minus
a1=
a1[0]=
a2= x
a3=3 4
---
empty=
a1=plus
a1[0]=plus
a2=plus
a3=plus
---
empty=
a1=plus
a2=plus
a3=plus
---
['minus']
[]
['']
['plus']
['']
['plus']
['', 'x']
['plus']
['3', '4']
['plus']
## END
## N-I dash stdout-json: ""
## N-I zsh STDOUT:
empty=
a1=
## END
## N-I zsh status: 1

#### $@ (empty) and - and +
echo argv=${@-minus}
echo argv=${@+plus}
echo argv=${@:-minus}
echo argv=${@:+plus}
## STDOUT:
argv=minus
argv=
argv=minus
argv=
## END
## BUG dash/zsh STDOUT:
argv=
argv=plus
argv=minus
argv=
## END

#### $@ ("") and - and +
set -- ""
echo argv=${@-minus}
echo argv=${@+plus}
echo argv=${@:-minus}
echo argv=${@:+plus}
## STDOUT:
argv=
argv=plus
argv=minus
argv=
## END

# Zsh treats $@ as an array unlike Bash converting it to a string by joining it
# with a space.

## OK zsh STDOUT:
argv=
argv=plus
argv=
argv=plus
## END

#### $@ ("" "") and - and +
set -- "" ""
echo argv=${@-minus}
echo argv=${@+plus}
echo argv=${@:-minus}
echo argv=${@:+plus}
## STDOUT:
argv=
argv=plus
argv=
argv=plus
## END

#### $* ("" "") and - and + (IFS=)
set -- "" ""
IFS=
echo argv=${*-minus}
echo argv=${*+plus}
echo argv=${*:-minus}
echo argv=${*:+plus}
## STDOUT:
argv=
argv=plus
argv=
argv=plus
## END
## BUG mksh STDOUT:
argv=
argv=plus
argv=minus
argv=
## END

#### "$*" ("" "") and - and + (IFS=)
set -- "" ""
IFS=
echo "argv=${*-minus}"
echo "argv=${*+plus}"
echo "argv=${*:-minus}"
echo "argv=${*:+plus}"
## STDOUT:
argv=
argv=plus
argv=
argv=plus
## END

#### assoc array and - and +
case $SH in dash|mksh) exit ;; esac

declare -A empty=()
declare -A assoc=(['k']=v)

echo empty=${empty[@]-minus}
echo empty=${empty[@]+plus}
echo assoc=${assoc[@]-minus}
echo assoc=${assoc[@]+plus}

echo ---
echo empty=${empty[@]:-minus}
echo empty=${empty[@]:+plus}
echo assoc=${assoc[@]:-minus}
echo assoc=${assoc[@]:+plus}
## STDOUT:
empty=minus
empty=
assoc=v
assoc=plus
---
empty=minus
empty=
assoc=v
assoc=plus
## END

## BUG zsh STDOUT:
empty=
empty=plus
assoc=minus
assoc=
---
empty=minus
empty=
assoc=minus
assoc=
## END

## N-I dash/mksh STDOUT:
## END


#### Error when empty
empty=''
echo ${empty:?'is em'pty}  # test eval of error
echo should not get here
## stdout-json: ""
## status: 1
## OK dash status: 2

#### Error when unset
echo ${unset?is empty}
echo should not get here
## stdout-json: ""
## status: 1
## OK dash status: 2

#### Error when unset
v=foo
echo ${v+v is not unset} ${unset:+is not unset}
## stdout: v is not unset

#### ${var=x} dynamic scope
f() { : "${hello:=x}"; echo $hello; }
f
echo hello=$hello

f() { hello=x; }
f
echo hello=$hello
## STDOUT:
x
hello=x
hello=x
## END

#### array ${arr[0]=x}
arr=()
echo ${#arr[@]}
: ${arr[0]=x}
echo ${#arr[@]}
## STDOUT:
0
1
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## N-I zsh status: 1
## N-I zsh STDOUT:
0
## END

#### assoc array ${arr["k"]=x}
# note: this also works in zsh

declare -A arr=()
echo ${#arr[@]}
: ${arr['k']=x}
echo ${#arr[@]}
## STDOUT:
0
1
## END
## N-I dash status: 2
## N-I dash stdout-json: ""
## N-I mksh status: 1
## N-I mksh stdout-json: ""

#### "\z" as arg
echo "${undef-\$}"
echo "${undef-\(}"
echo "${undef-\z}"
echo "${undef-\"}"
echo "${undef-\`}"
echo "${undef-\\}"
## STDOUT:
$
\(
\z
"
`
\
## END
## BUG yash STDOUT:
$
(
z
"
`
\
## END
# Note: this line terminates the quoting by ` not to confuse the text editor.


#### "\e" as arg
echo "${undef-\e}"
## STDOUT:
\e
## END
## BUG zsh/mksh stdout-json: "\u001b\n"
## BUG yash stdout: e


#### op-test for ${a} and ${a[0]}
case $SH in dash) exit ;; esac

test-hyphen() {
  echo "a   : '${a-no-colon}' '${a:-with-colon}'"
  echo "a[0]: '${a[0]-no-colon}' '${a[0]:-with-colon}'"
}

a=()
test-hyphen
a=("")
test-hyphen
a=("" "")
test-hyphen
IFS=
test-hyphen

## STDOUT:
a   : 'no-colon' 'with-colon'
a[0]: 'no-colon' 'with-colon'
a   : '' 'with-colon'
a[0]: '' 'with-colon'
a   : '' 'with-colon'
a[0]: '' 'with-colon'
a   : '' 'with-colon'
a[0]: '' 'with-colon'
## END

# Zsh's ${a} and ${a[@]} implement something different from the other shells'.

## OK zsh STDOUT:
a   : '' 'with-colon'
a[0]: 'no-colon' 'with-colon'
a   : '' 'with-colon'
a[0]: 'no-colon' 'with-colon'
a   : ' ' ' '
a[0]: 'no-colon' 'with-colon'
a   : '' 'with-colon'
a[0]: 'no-colon' 'with-colon'
## END

## N-I dash STDOUT:
## END:


#### op-test for ${a[@]} and ${a[*]}
case $SH in dash) exit ;; esac

test-hyphen() {
  echo "a[@]: '${a[@]-no-colon}' '${a[@]:-with-colon}'"
  echo "a[*]: '${a[*]-no-colon}' '${a[*]:-with-colon}'"
}

a=()
test-hyphen
a=("")
test-hyphen
a=("" "")
test-hyphen
IFS=
test-hyphen

## STDOUT:
a[@]: 'no-colon' 'with-colon'
a[*]: 'no-colon' 'with-colon'
a[@]: '' 'with-colon'
a[*]: '' 'with-colon'
a[@]: ' ' ' '
a[*]: ' ' ' '
a[@]: ' ' ' '
a[*]: '' 'with-colon'
## END

# Bash 2.0..4.4 has a bug that "${a[@]:-xxx}" produces an empty string.  It
# seemed to consider a[@] and a[*] are non-empty when there is at least one
# element even if the element is empty.  This was fixed in Bash 5.0.
#
# ## BUG bash STDOUT:
# a[@]: 'no-colon' 'with-colon'
# a[*]: 'no-colon' 'with-colon'
# a[@]: '' ''
# a[*]: '' ''
# a[@]: ' ' ' '
# a[*]: ' ' ' '
# a[@]: ' ' ' '
# a[*]: '' ''
# ## END

# Zsh's ${a} and ${a[@]} implement something different from the other shells'.

## OK zsh STDOUT:
a[@]: '' 'with-colon'
a[*]: '' 'with-colon'
a[@]: '' ''
a[*]: '' 'with-colon'
a[@]: ' ' ' '
a[*]: ' ' ' '
a[@]: ' ' ' '
a[*]: '' 'with-colon'
## END

## N-I dash STDOUT:
## END:


#### op-test for ${!array} with array="a" and array="a[0]"
case $SH in dash|mksh|zsh) exit ;; esac

test-hyphen() {
  ref='a'
  echo "ref=a   : '${!ref-no-colon}' '${!ref:-with-colon}'"
  ref='a[0]'
  echo "ref=a[0]: '${!ref-no-colon}' '${!ref:-with-colon}'"
}

a=()
test-hyphen
a=("")
test-hyphen
a=("" "")
test-hyphen
IFS=
test-hyphen

## STDOUT:
ref=a   : 'no-colon' 'with-colon'
ref=a[0]: 'no-colon' 'with-colon'
ref=a   : '' 'with-colon'
ref=a[0]: '' 'with-colon'
ref=a   : '' 'with-colon'
ref=a[0]: '' 'with-colon'
ref=a   : '' 'with-colon'
ref=a[0]: '' 'with-colon'
## END

## N-I dash/mksh/zsh STDOUT:
## END:


#### op-test for ${!array} with array="a[@]" or array="a[*]"
case $SH in dash|mksh|zsh) exit ;; esac

test-hyphen() {
  ref='a[@]'
  echo "ref=a[@]: '${!ref-no-colon}' '${!ref:-with-colon}'"
  ref='a[*]'
  echo "ref=a[*]: '${!ref-no-colon}' '${!ref:-with-colon}'"
}

a=()
test-hyphen
a=("")
test-hyphen
a=("" "")
test-hyphen
IFS=
test-hyphen

## STDOUT:
ref=a[@]: 'no-colon' 'with-colon'
ref=a[*]: 'no-colon' 'with-colon'
ref=a[@]: '' 'with-colon'
ref=a[*]: '' 'with-colon'
ref=a[@]: ' ' ' '
ref=a[*]: ' ' ' '
ref=a[@]: ' ' ' '
ref=a[*]: '' 'with-colon'
## END

## BUG bash STDOUT:
ref=a[@]: 'no-colon' 'with-colon'
ref=a[*]: 'no-colon' 'with-colon'
ref=a[@]: '' ''
ref=a[*]: '' ''
ref=a[@]: ' ' ' '
ref=a[*]: ' ' ' '
ref=a[@]: ' ' ' '
ref=a[*]: '' ''
## END

## N-I dash/mksh/zsh STDOUT:
## END:


#### op-test for unquoted ${a[*]:-empty} with IFS=
case $SH in dash) exit ;; esac

IFS=
a=("" "")
argv.py ${a[*]:-empty}

## STDOUT:
[]
## END

## BUG mksh STDOUT:
['empty']
## END

## N-I dash STDOUT:
## END:
