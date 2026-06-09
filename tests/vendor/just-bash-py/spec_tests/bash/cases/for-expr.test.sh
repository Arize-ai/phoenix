## compare_shells: bash-4.4 zsh

# Constructs borrowed from ksh.  Hm I didn't realize zsh also implements these!
# mksh implements most too.

#### C-style for loop
n=10
for ((a=1; a <= n ; a++))  # Double parentheses, and naked 'n'
do
  if test $a = 3; then
    continue
  fi
  if test $a = 6; then
    break
  fi
  echo $a
done
## status: 0
## STDOUT:
1
2
4
5
## END

#### For loop with and without semicolon
for ((a=1; a <= 3; a++)); do
  echo $a
done
for ((a=1; a <= 3; a++)) do
  echo $a
done
## status: 0
## STDOUT:
1
2
3
1
2
3
## END

#### Accepts { } syntax too
for ((a=1; a <= 3; a++)) {
  echo $a
}
## STDOUT:
1
2
3
## END

#### Empty init
i=1
for ((  ;i < 4;  i++ )); do
  echo $i
done
## status: 0
## STDOUT:
1
2
3
## END

#### Empty init and cond
i=1
for ((  ; ;  i++ )); do
  if test $i = 4; then
    break
  fi
  echo $i
done
## status: 0
## STDOUT:
1
2
3
## END

#### Infinite loop with ((;;))
a=1
for ((  ;  ;  )); do
  if test $a = 4; then
    break
  fi
  echo $((a++))
done
## status: 0
## STDOUT:
1
2
3
## END


#### Arith lexer mode

# bash is lenient; zsh disagrees

for ((i = '3';  i < '5';  ++i)); do echo $i; done
for ((i = "3";  i < "5";  ++i)); do echo $i; done
for ((i = $'3'; i < $'5'; ++i)); do echo $i; done
for ((i = $"3"; i < $"5"; ++i)); do echo $i; done

## STDOUT:
3
4
3
4
3
4
3
4
## END
## OK zsh status: 1
## OK zsh STDOUT:
## END


#### Integers near 31, 32, 62 bits
## SKIP (unimplementable): 64-bit integers not supported

# Hm this was never a bug, but it's worth testing.
# The bug was EvalToInt() in the condition.

for base in 31 32 62; do

  start=$(( (1 << $base) - 2))
  end=$(( (1 << $base) + 2))

  for ((i = start; i < end; ++i)); do
    echo $i
  done
  echo ---
done

## STDOUT:
2147483646
2147483647
2147483648
2147483649
---
4294967294
4294967295
4294967296
4294967297
---
4611686018427387902
4611686018427387903
4611686018427387904
4611686018427387905
---
## END


#### Condition that's greater than 32 bits
## SKIP (unimplementable): 64-bit integers not supported

iters=0

for ((i = 1 << 32; i; ++i)); do
  echo $i
  iters=$(( iters + 1 ))
  if test $iters -eq 5; then
    break
  fi
done

## STDOUT:
4294967296
4294967297
4294967298
4294967299
4294967300
## END
