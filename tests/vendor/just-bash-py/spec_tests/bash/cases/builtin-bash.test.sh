## oils_failures_allowed: 4
## compare_shells: bash


#### help
help
echo status=$? >&2
help help
echo status=$? >&2
help -- help
echo status=$? >&2
## STDERR:
status=0
status=0
status=0
## END

#### bad help topic
help ZZZ 2>$TMP/err.txt
echo "help=$?"
cat $TMP/err.txt | grep -i 'no help topics' >/dev/null
echo "grep=$?"
## STDOUT: 
help=1
grep=0
## END

#### mapfile
type mapfile >/dev/null 2>&1 || exit 0
printf '%s\n' {1..5..2} | {
  mapfile
  echo "n=${#MAPFILE[@]}"
  printf '[%s]\n' "${MAPFILE[@]}"
}
## STDOUT:
n=3
[1
]
[3
]
[5
]
## END
## N-I dash/mksh/zsh/ash STDOUT:
## END

#### readarray (synonym for mapfile)
type readarray >/dev/null 2>&1 || exit 0
printf '%s\n' {1..5..2} | {
  readarray
  echo "n=${#MAPFILE[@]}"
  printf '[%s]\n' "${MAPFILE[@]}"
}
## STDOUT:
n=3
[1
]
[3
]
[5
]
## END
## N-I dash/mksh/zsh/ash STDOUT:
## END

#### mapfile (array name): arr
type mapfile >/dev/null 2>&1 || exit 0
printf '%s\n' {1..5..2} | {
  mapfile arr
  echo "n=${#arr[@]}"
  printf '[%s]\n' "${arr[@]}"
}
## STDOUT:
n=3
[1
]
[3
]
[5
]
## END
## N-I dash/mksh/zsh/ash STDOUT:
## END

#### mapfile (delimiter): -d delim
# Note: Bash-4.4+
type mapfile >/dev/null 2>&1 || exit 0
printf '%s:' {1..5..2} | {
  mapfile -d : arr
  echo "n=${#arr[@]}"
  printf '[%s]\n' "${arr[@]}"
}
## STDOUT:
n=3
[1:]
[3:]
[5:]
## END
## N-I dash/mksh/zsh/ash STDOUT:
## END

#### mapfile (delimiter): -d '' (null-separated)
# Note: Bash-4.4+
type mapfile >/dev/null 2>&1 || exit 0
printf '%s\0' {1..5..2} | {
  mapfile -d '' arr
  echo "n=${#arr[@]}"
  printf '[%s]\n' "${arr[@]}"
}
## STDOUT:
n=3
[1]
[3]
[5]
## END
## N-I dash/mksh/zsh/ash STDOUT:
## END

#### mapfile (truncate delim): -t
type mapfile >/dev/null 2>&1 || exit 0
printf '%s\n' {1..5..2} | {
  mapfile -t arr
  echo "n=${#arr[@]}"
  printf '[%s]\n' "${arr[@]}"
}
## STDOUT:
n=3
[1]
[3]
[5]
## END
## N-I dash/mksh/zsh/ash STDOUT:
## END

#### mapfile -t doesn't remove \r
type mapfile >/dev/null 2>&1 || exit 0
printf '%s\r\n' {1..5..2} | {
  mapfile -t arr
  argv.py "${arr[@]}"
}
## STDOUT:
['1\r', '3\r', '5\r']
## END
## N-I dash/mksh/zsh/ash STDOUT:
## END

#### mapfile -t bugs (ble.sh)

# empty line
mapfile -t lines <<< $'hello\n\nworld'
echo len=${#lines[@]}
#declare -p lines

# initial newline
mapfile -t lines <<< $'\nhello'
echo len=${#lines[@]}
#declare -p lines

# trailing newline
mapfile -t lines <<< $'hello\n'
echo len=${#lines[@]}
#declare -p lines

## STDOUT:
len=3
len=2
len=2
## END

#### mapfile (store position): -O start
type mapfile >/dev/null 2>&1 || exit 0
printf '%s\n' a{0..2} | {
  arr=(x y z)
  mapfile -O 2 -t arr
  echo "n=${#arr[@]}"
  printf '[%s]\n' "${arr[@]}"
}
## STDOUT:
n=5
[x]
[y]
[a0]
[a1]
[a2]
## END
## N-I dash/mksh/zsh/ash STDOUT:
## END

#### mapfile (input range): -s start -n count
type mapfile >/dev/null 2>&1 || exit 0
printf '%s\n' a{0..10} | {
  mapfile -s 5 -n 3 -t arr
  echo "n=${#arr[@]}"
  printf '[%s]\n' "${arr[@]}"
}
## STDOUT:
n=3
[a5]
[a6]
[a7]
## END
## N-I dash/mksh/zsh/ash STDOUT:
## END

#### mapfile / readarray stdin  TODO: Fix me.
shopt -s lastpipe  # for bash

seq 2 | mapfile m
seq 3 | readarray r
echo ${#m[@]}
echo ${#r[@]}
## STDOUT:
2
3
## END
