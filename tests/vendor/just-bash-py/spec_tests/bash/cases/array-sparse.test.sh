## compare_shells: bash mksh
## oils_cpp_failures_allowed: 2

#### Performance demo
## SKIP (unimplementable): Oils-specific shopt options not implemented

case $SH in bash|mksh) exit ;; esac

shopt -s ysh:upgrade

#pp test_ (a)

sp=( foo {25..27} bar )

sp[10]='sparse'

echo $[type(sp)]

echo len: "${#sp[@]}"

#echo $[len(sp)]

echo subst: "${sp[@]}"
echo keys: "${!sp[@]}"

echo slice: "${sp[@]:2:3}"

sp[0]=set0

echo get0: "${sp[0]}"
echo get1: "${sp[1]}"
echo ---

to_append=(x y)
echo append
sp+=("${to_append[@]}")
echo subst: "${sp[@]}"
echo keys: "${!sp[@]}"
echo ---

echo unset
unset -v 'sp[11]'
echo subst: "${sp[@]}"
echo keys: "${!sp[@]}"

## STDOUT:
BashArray
len: 6
subst: foo 25 26 27 bar sparse
keys: 0 1 2 3 4 10
slice: 26 27 bar
get0: set0
get1: 25
---
append
subst: set0 25 26 27 bar sparse x y
keys: 0 1 2 3 4 10 11 12
---
unset
subst: set0 25 26 27 bar sparse y
keys: 0 1 2 3 4 10 12
## END

## N-I bash/mksh STDOUT:
## END


#### test length
sp=(x y z)

sp[5]=z

echo len=${#sp[@]}

sp[10]=z

echo len=${#sp[@]}

## STDOUT:
len=4
len=5
## END


#### test "declare -p sp"
a0=()
a1=(1)
a2=(1 2)
a=(x y z w)
a[500]=100
a[1000]=100

case $SH in
bash|mksh)
  typeset -p a0 a1 a2 a
  exit ;;
esac

declare -p a0 a1 a2 a

## STDOUT:
declare -a a0=()
declare -a a1=(1)
declare -a a2=(1 2)
declare -a a=([0]=x [1]=y [2]=z [3]=w [500]=100 [1000]=100)
## END

## OK bash STDOUT:
declare -a a0=()
declare -a a1=([0]="1")
declare -a a2=([0]="1" [1]="2")
declare -a a=([0]="x" [1]="y" [2]="z" [3]="w" [500]="100" [1000]="100")
## END

## OK mksh STDOUT:
set -A a1
typeset a1[0]=1
set -A a2
typeset a2[0]=1
typeset a2[1]=2
set -A a
typeset a[0]=x
typeset a[1]=y
typeset a[2]=z
typeset a[3]=w
typeset a[500]=100
typeset a[1000]=100
## END

#### +=
sp1[10]=a
sp1[20]=b
sp1[99]=c
typeset -p sp1 | sed 's/"//g'
sp1+=(1 2 3)
typeset -p sp1 | sed 's/"//g'

## STDOUT:
declare -a sp1=([10]=a [20]=b [99]=c)
declare -a sp1=([10]=a [20]=b [99]=c [100]=1 [101]=2 [102]=3)
## END


## OK mksh STDOUT:
set -A sp1
typeset sp1[10]=a
typeset sp1[20]=b
typeset sp1[99]=c
set -A sp1
typeset sp1[10]=a
typeset sp1[20]=b
typeset sp1[99]=c
typeset sp1[100]=1
typeset sp1[101]=2
typeset sp1[102]=3
## END


#### a[i]=v
sp1[10]=a
sp1[20]=b
sp1[30]=c
typeset -p sp1 | sed 's/"//g'
sp1[10]=X
sp1[25]=Y
sp1[90]=Z
typeset -p sp1 | sed 's/"//g'

## STDOUT:
declare -a sp1=([10]=a [20]=b [30]=c)
declare -a sp1=([10]=X [20]=b [25]=Y [30]=c [90]=Z)
## END

## OK mksh STDOUT:
set -A sp1
typeset sp1[10]=a
typeset sp1[20]=b
typeset sp1[30]=c
set -A sp1
typeset sp1[10]=X
typeset sp1[20]=b
typeset sp1[25]=Y
typeset sp1[30]=c
typeset sp1[90]=Z
## END


#### Negative index with a[i]=v
case $SH in mksh) exit ;; esac

sp1[9]=x
typeset -p sp1 | sed 's/"//g'

sp1[-1]=A
sp1[-4]=B
sp1[-8]=C
sp1[-10]=D
typeset -p sp1 | sed 's/"//g'

## STDOUT:
declare -a sp1=([9]=x)
declare -a sp1=([0]=D [2]=C [6]=B [9]=A)
## END

## N-I mksh STDOUT:
## END


#### a[i]=v with BigInt
## SKIP (unimplementable): BigInt array indices not supported - JavaScript limitation
case $SH in mksh) exit ;; esac

sp1[1]=x
sp1[5]=y
sp1[9]=z

echo "${#sp1[@]}"
sp1[0x7FFFFFFFFFFFFFFF]=a
echo "${#sp1[@]}"
sp1[0x7FFFFFFFFFFFFFFE]=b
echo "${#sp1[@]}"
sp1[0x7FFFFFFFFFFFFFFD]=c
echo "${#sp1[@]}"

## STDOUT:
3
4
5
6
## END

## N-I mksh STDOUT:
## END


#### Negative out-of-bound index with a[i]=v (1/2)
case $SH in mksh) exit ;; esac

sp1[9]=x
sp1[-11]=E
declare -p sp1

## status: 1
## STDOUT:
## END
## STDERR:
  sp1[-11]=E
  ^~~~
[ stdin ]:4: fatal: Index -11 is out of bounds for array of length 10
## END

## OK bash status: 0
## OK bash STDOUT:
declare -a sp1=([9]="x")
## END
## OK bash STDERR:
bash: line 4: sp1[-11]: bad array subscript
## END

## N-I mksh status: 0
## N-I mksh stdout-json: ""
## N-I mksh stderr-json: ""


#### Negative out-of-bound index with a[i]=v (2/2)
case $SH in mksh) exit ;; esac

sp1[9]=x

sp1[-21]=F
declare -p sp1

## status: 1
## STDOUT:
## END
## STDERR:
  sp1[-21]=F
  ^~~~
[ stdin ]:5: fatal: Index -21 is out of bounds for array of length 10
## END

## OK bash status: 0
## OK bash STDOUT:
declare -a sp1=([9]="x")
## END
## OK bash STDERR:
bash: line 5: sp1[-21]: bad array subscript
## END

## N-I mksh status: 0
## N-I mksh stdout-json: ""
## N-I mksh stderr-json: ""


#### xtrace a+=()
#case $SH in mksh) exit ;; esac

sp1=(1)
set -x
sp1+=(2)

## STDERR:
+ sp1+=(2)
## END

## OK mksh STDERR:
+ set -A sp1+ -- 2
## END


#### unset -v a[i]
a=(1 2 3 4 5 6 7 8 9)
typeset -p a
unset -v "a[1]"
typeset -p a
unset -v "a[9]"
typeset -p a
unset -v "a[0]"
typeset -p a

## STDOUT:
declare -a a=(1 2 3 4 5 6 7 8 9)
declare -a a=([0]=1 [2]=3 [3]=4 [4]=5 [5]=6 [6]=7 [7]=8 [8]=9)
declare -a a=([0]=1 [2]=3 [3]=4 [4]=5 [5]=6 [6]=7 [7]=8 [8]=9)
declare -a a=([2]=3 [3]=4 [4]=5 [5]=6 [6]=7 [7]=8 [8]=9)
## END

## OK bash STDOUT:
declare -a a=([0]="1" [1]="2" [2]="3" [3]="4" [4]="5" [5]="6" [6]="7" [7]="8" [8]="9")
declare -a a=([0]="1" [2]="3" [3]="4" [4]="5" [5]="6" [6]="7" [7]="8" [8]="9")
declare -a a=([0]="1" [2]="3" [3]="4" [4]="5" [5]="6" [6]="7" [7]="8" [8]="9")
declare -a a=([2]="3" [3]="4" [4]="5" [5]="6" [6]="7" [7]="8" [8]="9")
## END

## OK mksh STDOUT:
set -A a
typeset a[0]=1
typeset a[1]=2
typeset a[2]=3
typeset a[3]=4
typeset a[4]=5
typeset a[5]=6
typeset a[6]=7
typeset a[7]=8
typeset a[8]=9
set -A a
typeset a[0]=1
typeset a[2]=3
typeset a[3]=4
typeset a[4]=5
typeset a[5]=6
typeset a[6]=7
typeset a[7]=8
typeset a[8]=9
set -A a
typeset a[0]=1
typeset a[2]=3
typeset a[3]=4
typeset a[4]=5
typeset a[5]=6
typeset a[6]=7
typeset a[7]=8
typeset a[8]=9
set -A a
typeset a[2]=3
typeset a[3]=4
typeset a[4]=5
typeset a[5]=6
typeset a[6]=7
typeset a[7]=8
typeset a[8]=9
## END


#### unset -v a[i] with out-of-bound negative index
case $SH in mksh) exit ;; esac

a=(1)

unset -v "a[-2]"
unset -v "a[-3]"

## status: 1
## STDOUT:
## END
## STDERR:
  unset -v "a[-2]"
           ^
[ stdin ]:5: a[-2]: Index is out of bounds for array of length 1
  unset -v "a[-3]"
           ^
[ stdin ]:6: a[-3]: Index is out of bounds for array of length 1
## END

## OK bash STDERR:
bash: line 5: unset: [-2]: bad array subscript
bash: line 6: unset: [-3]: bad array subscript
## END

## N-I mksh status: 0
## N-I mksh STDERR:
## END


#### unset -v a[i] for max index
case $SH in mksh) exit ;; esac

a=({1..9})
unset -v 'a[-1]'
a[-1]=x
declare -p a
unset -v 'a[-1]'
a[-1]=x
declare -p a

## STDOUT:
declare -a a=(1 2 3 4 5 6 7 x)
declare -a a=(1 2 3 4 5 6 x)
## END

## OK bash STDOUT:
declare -a a=([0]="1" [1]="2" [2]="3" [3]="4" [4]="5" [5]="6" [6]="7" [7]="x")
declare -a a=([0]="1" [1]="2" [2]="3" [3]="4" [4]="5" [5]="6" [6]="x")
## END

## N-I mksh STDOUT:
## END


#### [[ -v a[i] ]]
case $SH in mksh) exit ;; esac

sp1=()
[[ -v sp1[0] ]]; echo "$? (expect 1)"
[[ -v sp1[9] ]]; echo "$? (expect 1)"

sp2=({1..9})
[[ -v sp2[0] ]]; echo "$? (expect 0)"
[[ -v sp2[8] ]]; echo "$? (expect 0)"
[[ -v sp2[9] ]]; echo "$? (expect 1)"
[[ -v sp2[-1] ]]; echo "$? (expect 0)"
[[ -v sp2[-2] ]]; echo "$? (expect 0)"
[[ -v sp2[-9] ]]; echo "$? (expect 0)"

sp3=({1..9})
unset -v 'sp3[4]'
[[ -v sp3[3] ]]; echo "$? (expect 0)"
[[ -v sp3[4] ]]; echo "$? (expect 1)"
[[ -v sp3[5] ]]; echo "$? (expect 0)"
[[ -v sp3[-1] ]]; echo "$? (expect 0)"
[[ -v sp3[-4] ]]; echo "$? (expect 0)"
[[ -v sp3[-5] ]]; echo "$? (expect 1)"
[[ -v sp3[-6] ]]; echo "$? (expect 0)"
[[ -v sp3[-9] ]]; echo "$? (expect 0)"

## STDOUT:
1 (expect 1)
1 (expect 1)
0 (expect 0)
0 (expect 0)
1 (expect 1)
0 (expect 0)
0 (expect 0)
0 (expect 0)
0 (expect 0)
1 (expect 1)
0 (expect 0)
0 (expect 0)
0 (expect 0)
1 (expect 1)
0 (expect 0)
0 (expect 0)
## END

## N-I mksh STDOUT:
## END


#### [[ -v a[i] ]] with invalid negative index
case $SH in mksh) exit ;; esac

sp1=()
([[ -v sp1[-1] ]]; echo "$? (expect 1)")
sp2=({1..9})
([[ -v sp2[-10] ]]; echo "$? (expect 1)")
sp3=({1..9})
unset -v 'sp3[4]'
([[ -v sp3[-10] ]]; echo "$? (expect 1)")

## status: 1
## STDOUT:
## END
## STDERR:
  ([[ -v sp1[-1] ]]; echo "$? (expect 1)")
         ^~~
[ stdin ]:4: fatal: -v got index -1, which is out of bounds for array of length 0
  ([[ -v sp2[-10] ]]; echo "$? (expect 1)")
         ^~~
[ stdin ]:6: fatal: -v got index -10, which is out of bounds for array of length 9
  ([[ -v sp3[-10] ]]; echo "$? (expect 1)")
         ^~~
[ stdin ]:9: fatal: -v got index -10, which is out of bounds for array of length 9
## END

## OK bash status: 0
## OK bash STDOUT:
1 (expect 1)
1 (expect 1)
1 (expect 1)
## END
## OK bash STDERR:
bash: line 4: sp1: bad array subscript
bash: line 6: sp2: bad array subscript
bash: line 9: sp3: bad array subscript
## END

## N-I mksh status: 0
## N-I mksh stdout-json: ""
## N-I mksh stderr-json: ""


#### ((sp[i])) and ((sp[i]++))
a=(1 2 3 4 5 6 7 8 9)
unset -v 'a[2]' 'a[3]' 'a[7]'

echo $((a[0]))
echo $((a[1]))
echo $((a[2]))
echo $((a[3]))
echo $((a[7]))

echo $((a[1]++))
echo $((a[2]++))
echo $((a[3]++))
echo $((a[7]++))

echo $((++a[1]))
echo $((++a[2]))
echo $((++a[3]))
echo $((++a[7]))

echo $((a[1] = 100, a[1]))
echo $((a[2] = 100, a[2]))
echo $((a[3] = 100, a[3]))
echo $((a[7] = 100, a[7]))

## STDOUT:
1
2
0
0
0
2
0
0
0
4
2
2
2
100
100
100
100
## END


#### ((sp[i])) and ((sp[i]++)) with invalid negative index
case $SH in mksh) exit ;; esac

a=({1..9})
unset -v 'a[2]' 'a[3]' 'a[7]'

echo $((a[-10]))

## STDOUT:
0
## END
## STDERR:
  echo $((a[-10]))
           ^
[ stdin ]:6: Index -10 out of bounds for array of length 9
## END

## OK bash STDERR:
bash: line 6: a: bad array subscript
## END

## N-I mksh STDOUT:
## END
## N-I mksh STDERR:
## END


#### ${sp[i]}
case $SH in mksh) exit ;; esac

sp=({1..9})
unset -v 'sp[2]'
unset -v 'sp[3]'
unset -v 'sp[7]'

echo "sp[0]: '${sp[0]}', ${sp[0]:-(empty)}, ${sp[0]+set}."
echo "sp[1]: '${sp[1]}', ${sp[1]:-(empty)}, ${sp[1]+set}."
echo "sp[8]: '${sp[8]}', ${sp[8]:-(empty)}, ${sp[8]+set}."
echo "sp[2]: '${sp[2]}', ${sp[2]:-(empty)}, ${sp[2]+set}."
echo "sp[3]: '${sp[3]}', ${sp[3]:-(empty)}, ${sp[3]+set}."
echo "sp[7]: '${sp[7]}', ${sp[7]:-(empty)}, ${sp[7]+set}."

echo "sp[-1]: '${sp[-1]}'."
echo "sp[-2]: '${sp[-2]}'."
echo "sp[-3]: '${sp[-3]}'."
echo "sp[-4]: '${sp[-4]}'."
echo "sp[-9]: '${sp[-9]}'."

## STDOUT:
sp[0]: '1', 1, set.
sp[1]: '2', 2, set.
sp[8]: '9', 9, set.
sp[2]: '', (empty), .
sp[3]: '', (empty), .
sp[7]: '', (empty), .
sp[-1]: '9'.
sp[-2]: ''.
sp[-3]: '7'.
sp[-4]: '6'.
sp[-9]: '1'.
## END

## N-I mksh STDOUT:
## END


#### ${sp[i]} with negative invalid index
case $SH in mksh) exit ;; esac

sp=({1..9})
unset -v 'sp[2]'
unset -v 'sp[3]'
unset -v 'sp[7]'

echo "sp[-10]: '${sp[-10]}'."
echo "sp[-11]: '${sp[-11]}'."
echo "sp[-19]: '${sp[-19]}'."

## STDOUT:
sp[-10]: ''.
sp[-11]: ''.
sp[-19]: ''.
## END
## STDERR:
  echo "sp[-10]: '${sp[-10]}'."
                    ^~
[ stdin ]:8: Index -10 out of bounds for array of length 9
  echo "sp[-11]: '${sp[-11]}'."
                    ^~
[ stdin ]:9: Index -11 out of bounds for array of length 9
  echo "sp[-19]: '${sp[-19]}'."
                    ^~
[ stdin ]:10: Index -19 out of bounds for array of length 9
## END

## OK bash STDERR:
bash: line 8: sp: bad array subscript
bash: line 9: sp: bad array subscript
bash: line 10: sp: bad array subscript
## END

## N-I mksh STDOUT:
## END
## N-I mksh STDERR:
## END


#### ${a[@]:offset:length}
case $SH in mksh) exit ;; esac

a=(v{0..9})
unset -v 'a[2]' 'a[3]' 'a[4]' 'a[7]'

echo '==== ${a[@]:offset} ===='
echo "[${a[@]:0}][${a[*]:0}]"
echo "[${a[@]:2}][${a[*]:2}]"
echo "[${a[@]:3}][${a[*]:3}]"
echo "[${a[@]:5}][${a[*]:5}]"
echo "[${a[@]:9}][${a[*]:9}]"
echo "[${a[@]:10}][${a[*]:10}]"
echo "[${a[@]:11}][${a[*]:11}]"

echo '==== ${a[@]:negative} ===='
echo "[${a[@]: -1}][${a[*]: -1}]"
echo "[${a[@]: -2}][${a[*]: -2}]"
echo "[${a[@]: -5}][${a[*]: -5}]"
echo "[${a[@]: -9}][${a[*]: -9}]"
echo "[${a[@]: -10}][${a[*]: -10}]"
echo "[${a[@]: -11}][${a[*]: -11}]"
echo "[${a[@]: -21}][${a[*]: -21}]"

echo '==== ${a[@]:offset:length} ===='
echo "[${a[@]:0:0}][${a[*]:0:0}]"
echo "[${a[@]:0:1}][${a[*]:0:1}]"
echo "[${a[@]:0:3}][${a[*]:0:3}]"
echo "[${a[@]:2:1}][${a[*]:2:1}]"
echo "[${a[@]:2:4}][${a[*]:2:4}]"
echo "[${a[@]:3:4}][${a[*]:3:4}]"
echo "[${a[@]:5:4}][${a[*]:5:4}]"
echo "[${a[@]:5:0}][${a[*]:5:0}]"
echo "[${a[@]:9:1}][${a[*]:9:1}]"
echo "[${a[@]:9:2}][${a[*]:9:2}]"
echo "[${a[@]:10:1}][${a[*]:10:1}]"

## STDOUT:
==== ${a[@]:offset} ====
[v0 v1 v5 v6 v8 v9][v0 v1 v5 v6 v8 v9]
[v5 v6 v8 v9][v5 v6 v8 v9]
[v5 v6 v8 v9][v5 v6 v8 v9]
[v5 v6 v8 v9][v5 v6 v8 v9]
[v9][v9]
[][]
[][]
==== ${a[@]:negative} ====
[v9][v9]
[v8 v9][v8 v9]
[v5 v6 v8 v9][v5 v6 v8 v9]
[v1 v5 v6 v8 v9][v1 v5 v6 v8 v9]
[v0 v1 v5 v6 v8 v9][v0 v1 v5 v6 v8 v9]
[][]
[][]
==== ${a[@]:offset:length} ====
[][]
[v0][v0]
[v0 v1 v5][v0 v1 v5]
[v5][v5]
[v5 v6 v8 v9][v5 v6 v8 v9]
[v5 v6 v8 v9][v5 v6 v8 v9]
[v5 v6 v8 v9][v5 v6 v8 v9]
[][]
[v9][v9]
[v9][v9]
[][]
## END

## N-I mksh STDOUT:
## END


#### ${@:offset:length}
case $SH in mksh) exit ;; esac

set -- v{1..9}

{
  echo '==== ${@:offset:length} ===='
  echo "[${*:0:3}][${*:0:3}]"
  echo "[${*:1:3}][${*:1:3}]"
  echo "[${*:3:3}][${*:3:3}]"
  echo "[${*:5:10}][${*:5:10}]"

  echo '==== ${@:negative} ===='
  echo "[${*: -1}][${*: -1}]"
  echo "[${*: -3}][${*: -3}]"
  echo "[${*: -9}][${*: -9}]"
  echo "[${*: -10}][${*: -10}]"
  echo "[${*: -11}][${*: -11}]"
  echo "[${*: -3:2}][${*: -3:2}]"
  echo "[${*: -9:4}][${*: -9:4}]"
  echo "[${*: -10:4}][${*: -10:4}]"
  echo "[${*: -11:4}][${*: -11:4}]"
} | sed "s:$SH:\$SH:g;s:${SH##*/}:\$SH:g"

## STDOUT:
==== ${@:offset:length} ====
[$SH v1 v2][$SH v1 v2]
[v1 v2 v3][v1 v2 v3]
[v3 v4 v5][v3 v4 v5]
[v5 v6 v7 v8 v9][v5 v6 v7 v8 v9]
==== ${@:negative} ====
[v9][v9]
[v7 v8 v9][v7 v8 v9]
[v1 v2 v3 v4 v5 v6 v7 v8 v9][v1 v2 v3 v4 v5 v6 v7 v8 v9]
[$SH v1 v2 v3 v4 v5 v6 v7 v8 v9][$SH v1 v2 v3 v4 v5 v6 v7 v8 v9]
[][]
[v7 v8][v7 v8]
[v1 v2 v3 v4][v1 v2 v3 v4]
[$SH v1 v2 v3][$SH v1 v2 v3]
[][]
## END

## N-I mksh STDOUT:
## END


#### ${a[@]:BigInt}
case $SH in mksh) exit ;; esac

case $SH in
  bash)
    # disabled with soil-ovm-tarball image 2025-04-30b - the CI runs on Debian 12
    # now
    exit

    # Work around bash integer overflow bug that only happens on say Debian 10,
    # but NOT Debian 12.  The bug exists in bash 5.2.  It's unclear why it
    # depends on the OS version.
    v='/etc/debian_version'
    # debian version 10 / debian buster
    if test -f $v && grep -E 'buster/sid|^10' $v >/dev/null; then
      cat << 'EOF'
[x][x]
[y x][y x]
[z y x][z y x]
[z y x][z y x]
EOF
      exit
    fi
    # Actual STDOUT of buggy bash builds:
    # [][]
    # [][]
    # [][]
    # [][]
    ;;
esac

a=(1 2 3)
a[0x7FFFFFFFFFFFFFFF]=x
a[0x7FFFFFFFFFFFFFFE]=y
a[0x7FFFFFFFFFFFFFFD]=z

echo "[${a[@]: -1}][${a[*]: -1}]"
echo "[${a[@]: -2}][${a[*]: -2}]"
echo "[${a[@]: -3}][${a[*]: -3}]"
echo "[${a[@]: -4}][${a[*]: -4}]"

## STDOUT:
[x][x]
[y x][y x]
[z y x][z y x]
[z y x][z y x]
## END

## N-I mksh STDOUT:
## END

## BUG bash STDOUT:
## END


#### ${a[@]}
a=(v{0,1,2,3,4,5,6,7,8,9})
unset -v 'a[2]' 'a[3]' 'a[4]' 'a[7]'

argv.py "${a[@]}"
argv.py "abc${a[@]}xyz"

## STDOUT:
['v0', 'v1', 'v5', 'v6', 'v8', 'v9']
['abcv0', 'v1', 'v5', 'v6', 'v8', 'v9xyz']
## END


#### ${a[@]#...}
case $SH in mksh) exit ;; esac

a=(v{0..9})
unset -v 'a[2]' 'a[3]' 'a[4]' 'a[7]'

argv.py "${a[@]#v}"
argv.py "abc${a[@]#v}xyz"
argv.py "${a[@]%[0-5]}"
argv.py "abc${a[@]%[0-5]}xyz"
argv.py "${a[@]#v?}"

## STDOUT:
['0', '1', '5', '6', '8', '9']
['abc0', '1', '5', '6', '8', '9xyz']
['v', 'v', 'v', 'v6', 'v8', 'v9']
['abcv', 'v', 'v', 'v6', 'v8', 'v9xyz']
['', '', '', '', '', '']
## END

## N-I mksh STDOUT:
## END


#### ${a[@]/pat/rep}

case $SH in mksh) exit ;; esac

a=(v{0..9})
unset -v 'a[2]' 'a[3]' 'a[4]' 'a[7]'

argv.py "${a[@]/?}"
argv.py "${a[@]//?}"
argv.py "${a[@]/#?}"
argv.py "${a[@]/%?}"

argv.py "${a[@]/v/x}"
argv.py "${a[@]//v/x}"
argv.py "${a[@]/[0-5]/D}"
argv.py "${a[@]//[!0-5]/_}"

## STDOUT:
['0', '1', '5', '6', '8', '9']
['', '', '', '', '', '']
['0', '1', '5', '6', '8', '9']
['v', 'v', 'v', 'v', 'v', 'v']
['x0', 'x1', 'x5', 'x6', 'x8', 'x9']
['x0', 'x1', 'x5', 'x6', 'x8', 'x9']
['vD', 'vD', 'vD', 'v6', 'v8', 'v9']
['_0', '_1', '_5', '__', '__', '__']
## END

## N-I mksh STDOUT:
## END


#### ${a[@]@P}, ${a[@]@Q}, and ${a[@]@a}
case $SH in mksh) exit ;; esac

a=(v{0..9})
unset -v 'a[2]' 'a[3]' 'a[4]' 'a[7]'

argv.py "${a[@]@P}"
argv.py "${a[*]@P}"
argv.py "${a[@]@Q}"
argv.py "${a[*]@Q}"
argv.py "${a[@]@a}"
argv.py "${a[*]@a}"

## STDOUT:
['v0', 'v1', 'v5', 'v6', 'v8', 'v9']
['v0 v1 v5 v6 v8 v9']
['v0', 'v1', 'v5', 'v6', 'v8', 'v9']
['v0 v1 v5 v6 v8 v9']
['a', 'a', 'a', 'a', 'a', 'a']
['a a a a a a']
## END

## OK bash STDOUT:
['v0', 'v1', 'v5', 'v6', 'v8', 'v9']
['v0 v1 v5 v6 v8 v9']
["'v0'", "'v1'", "'v5'", "'v6'", "'v8'", "'v9'"]
["'v0' 'v1' 'v5' 'v6' 'v8' 'v9'"]
['a', 'a', 'a', 'a', 'a', 'a']
['a a a a a a']
## END

## N-I mksh STDOUT:
## END


#### ${a[@]-unset}, ${a[@]:-empty}, etc.
a1=()
a2=("")
a3=("" "")

echo "a1 unset: [${a1[@]-unset}]"
echo "a1 empty: [${a1[@]:-empty}]"
echo "a2 unset: [${a2[@]-unset}]"
echo "a2 empty: [${a2[@]:-empty}]"
echo "a3 unset: [${a3[@]-unset}]"
echo "a3 empty: [${a3[@]:-empty}]"

## STDOUT:
a1 unset: [unset]
a1 empty: [empty]
a2 unset: []
a2 empty: [empty]
a3 unset: [ ]
a3 empty: [ ]
## END


#### ${a-}
a1=()
a2=("" "")
a3=(foo bar)

echo "$a1, ${a1-(unset)}, ${a1:-(empty)};"
echo "$a2, ${a2-(unset)}, ${a2:-(empty)};"
echo "$a3, ${a3-(unset)}, ${a3:-(empty)};"

## STDOUT:
, (unset), (empty);
, , (empty);
foo, foo, foo;
## END


#### ${!a[0]}
case $SH in mksh) exit ;; esac

v1=hello v2=world
a=(v1 v2)

echo "${!a[0]}, ${!a[1]}"

## STDOUT:
hello, world
## END

## N-I mksh STDOUT:
## END


#### ${!a[@]}
case $SH in mksh) exit ;; esac

a=(v{0..9})
unset -v 'a[3]' 'a[4]' 'a[7]' 'a[9]'

argv.py "${!a[@]}"

## STDOUT:
['0', '1', '2', '5', '6', '8']
## END

## N-I mksh STDOUT:
## END


#### "${a[*]}"
a=(v{0,1,2,3,4,5,6,7,8,9})
unset -v 'a[3]' 'a[4]' 'a[7]' 'a[9]'

echo "${a[*]}"
IFS=
echo "${a[*]}"
IFS=/
echo "${a[*]}"

## STDOUT:
v0 v1 v2 v5 v6 v8
v0v1v2v5v6v8
v0/v1/v2/v5/v6/v8
## END


#### compgen -F _set_COMPREPLY
case $SH in mksh) exit ;; esac

_set_COMPREPLY() {
  COMPREPLY=({0..9})
  unset -v 'COMPREPLY[2]' 'COMPREPLY[4]' 'COMPREPLY[6]'
}

compgen -F _set_COMPREPLY

## STDOUT:
0
1
3
5
7
8
9
## END

## N-I mksh STDOUT:
## END


#### compadjust
case $SH in bash|mksh) exit ;; esac

COMP_ARGV=(echo 'Hello,' 'Bash' 'world!')
compadjust cur prev words cword
argv.py "$cur" "$prev" "$cword"
argv.py "${words[@]}"

## STDOUT:
['world!', 'Bash', '3']
['echo', 'Hello,', 'Bash', 'world!']
## END

## N-I bash/mksh STDOUT:
## END


#### (YSH) @[sp] and @sp
case $SH in bash|mksh) exit ;; esac

a=({0..5})
unset -v 'a[1]' 'a[2]' 'a[4]'

shopt -s parse_at
argv.py @[a]
argv.py @a
## STDOUT:
['0', '3', '5']
['0', '3', '5']
## END

## N-I bash/mksh STDOUT:
## END


#### (YSH) $[a1 === a2]
## SKIP (unimplementable): Oils-specific shopt options not implemented
case $SH in bash|mksh) exit ;; esac

a1=(1 2 3)
unset -v 'a1[1]'
a2=(1 2 3)
unset -v 'a2[1]'
a3=(1 2 4)
unset -v 'a3[1]'
a4=(1 2 3)

shopt -s ysh:upgrade

echo $[a1 === a1]
echo $[a1 === a2]
echo $[a1 === a3]
echo $[a1 === a4]
echo $[a2 === a1]
echo $[a3 === a1]
echo $[a4 === a1]

## STDOUT:
true
true
false
false
true
false
false
## END

## N-I bash/mksh STDOUT:
## END


#### (YSH) append v1 v2... (a)
case $SH in bash|mksh) exit ;; esac

a=(1 2 3)
unset -v 'a[1]'
append 'x' 'y' 'z' (a)
= a

## STDOUT:
(BashArray [0]='1' [2]='3' [3]='x' [4]='y' [5]='z')
## END

## N-I bash/mksh STDOUT:
## END


#### (YSH) $[bool(a)]
## SKIP (unimplementable): Oils-specific shopt options not implemented
case $SH in bash|mksh) exit ;; esac

a1=()
a2=(0)
a3=(0 1 2)
a4=(0 0)
unset -v 'a4[0]'

shopt -s ysh:upgrade

echo $[bool(a1)]
echo $[bool(a2)]
echo $[bool(a3)]
echo $[bool(a4)]

## STDOUT:
false
true
true
true
## END

## N-I bash/mksh STDOUT:
## END


#### crash dump
case $SH in bash|mksh) exit ;; esac

OILS_CRASH_DUMP_DIR=$TMP $SH -ec 'a=({0..3}); unset -v "a[2]"; false'
json read (&crash_dump) < $TMP/*.json
json write (crash_dump.var_stack[0].a)

## STDOUT:
{
  "val": {
    "type": "BashArray",
    "data": {
      "0": "0",
      "1": "1",
      "3": "3"
    }
  }
}
## END

## N-I bash/mksh STDOUT:
## END


#### Regression: a[-1]=1
case $SH in mksh) exit 99 ;; esac

a[-1]=1

## status: 1
## STDOUT:
## END
## STDERR:
  a[-1]=1
  ^~
[ stdin ]:3: fatal: Index -1 is out of bounds for array of length 0
## END
## OK bash STDERR:
bash: line 3: a[-1]: bad array subscript
## END
## N-I mksh status: 99
## N-I mksh stderr-json: ""


#### Initializing indexed array with ([index]=value)
case $SH in mksh) exit 99 ;; esac
declare -a a=([xx]=1 [yy]=2 [zz]=3)
echo status=$?
argv.py "${a[@]}"
## STDOUT:
status=0
['3']
## END
## N-I mksh status: 99
## N-I mksh stdout-json: ""
