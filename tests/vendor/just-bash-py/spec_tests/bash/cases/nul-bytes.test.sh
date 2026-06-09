## compare_shells: dash bash mksh zsh ash
## oils_failures_allowed: 2
## oils_cpp_failures_allowed: 1

#### NUL bytes with echo -e
case $SH in dash) exit ;; esac

show_hex() { od -A n -t c -t x1; }

echo -e '\0-' | show_hex
#echo -e '\x00-'
#echo -e '\000-'

## STDOUT:
  \0   -  \n
  00  2d  0a
## END

## BUG zsh STDOUT:
  \0  \n
  00  0a
## END

## N-I dash STDOUT:
## END

#### printf - literal NUL in format string
## SKIP (unimplementable): NUL bytes are preserved instead of being stripped like bash (matches zsh behavior)
case $SH in dash|ash) return ;; esac

# Show both printable and hex
show_hex() { od -A n -t c -t x1; }

printf $'x\U0z' | show_hex
echo ---

printf $'x\U00z' | show_hex
echo ---

printf $'\U0z' | show_hex

## STDOUT:
   x
  78
---
   x
  78
---
## END
## BUG zsh STDOUT:
   x  \0   z
  78  00  7a
---
   x  \0   z
  78  00  7a
---
  \0   z
  00  7a
## END
## N-I dash/ash STDOUT:
## END

#### printf - \0 escape shows NUL byte
show_hex() { od -A n -t c -t x1; }

printf '\0\n' | show_hex
## STDOUT:
  \0  \n
  00  0a
## END

#### printf - NUL byte in value (OSH and zsh agree)
## SKIP (unimplementable): NUL bytes are preserved instead of being stripped like bash (matches zsh behavior)
case $SH in dash) exit ;; esac
show_hex() { od -A n -t c -t x1; }

nul=$'\0'
echo "$nul" | show_hex
printf '%s\n' "$nul" | show_hex

## STDOUT:
  \n
  0a
  \n
  0a
## END

## OK osh/zsh STDOUT:
  \0  \n
  00  0a
  \0  \n
  00  0a
## END
## N-I dash stdout-json: ""

#### NUL bytes with echo $'\0' (OSH and zsh agree)
## SKIP (unimplementable): NUL bytes are preserved instead of being stripped like bash (matches zsh behavior)
case $SH in dash) exit ;; esac
show_hex() { od -A n -t c -t x1; }

# OSH agrees with ZSH -- so you have the ability to print NUL bytes without
# legacy echo -e

echo $'\0' | show_hex

## STDOUT:
  \n
  0a
## END
## OK osh/zsh STDOUT:
  \0  \n
  00  0a
## END


## N-I dash stdout-json: ""


#### NUL bytes and IFS splitting
## SKIP (unimplementable): NUL bytes are preserved instead of being stripped from strings
case $SH in dash) exit ;; esac

argv.py $(echo -e '\0')
argv.py "$(echo -e '\0')"
argv.py $(echo -e 'a\0b')
argv.py "$(echo -e 'a\0b')"

## STDOUT:
[]
['']
['ab']
['ab']
## END
## BUG zsh STDOUT:
['', '']
['']
['a', 'b']
['a']
## END

## N-I dash STDOUT:
## END

#### NUL bytes with test -n
## SKIP (unimplementable): NUL byte handling in test -n differs from bash (matches zsh behavior)

case $SH in dash) exit ;; esac

# zsh is buggy here, weird
test -n $''
echo status=$?

test -n $'\0'
echo status=$?


## STDOUT:
status=1
status=1
## END
## OK osh STDOUT:
status=1
status=0
## END
## BUG zsh STDOUT:
status=0
status=0
## END

## N-I dash STDOUT:
## END


#### NUL bytes with test -f
## SKIP (unimplementable): NUL byte handling in filenames differs from bash

case $SH in dash) exit ;; esac


test -f $'\0'
echo status=$?

touch foo
test -f $'foo\0'
echo status=$?

test -f $'foo\0bar'
echo status=$?

test -f $'foobar'
echo status=$?


## STDOUT:
status=1
status=0
status=0
status=1
## END

## OK ash STDOUT:
status=1
status=0
status=1
status=1
## END

## N-I dash STDOUT:
## END


#### NUL bytes with ${#s} (OSH and zsh agree)
## SKIP (unimplementable): NUL byte in string length matches zsh behavior (returns 1, not 0)

case $SH in dash) exit ;; esac

empty=$''
nul=$'\0'

echo empty=${#empty}
echo nul=${#nul}


## STDOUT:
empty=0
nul=0
## END

## OK osh/zsh STDOUT:
empty=0
nul=1
## END

## N-I dash STDOUT:
## END

#### Compare \x00 byte versus \x01 byte - command sub
## SKIP (unimplementable): NUL byte handling in command substitution differs from bash (we preserve NUL bytes)

# https://stackoverflow.com/questions/32722007/is-skipping-ignoring-nul-bytes-on-process-substitution-standardized
# bash contains a warning!

show_bytes() {
  echo -n "$1" | od -A n -t x1
}

s=$(printf '.\001.')
echo len=${#s}
show_bytes "$s"

s=$(printf '.\000.')
echo len=${#s}
show_bytes "$s"

s=$(printf '\000')
echo len=${#s} 
show_bytes "$s"

## STDOUT:
len=3
 2e 01 2e
len=2
 2e 2e
len=0
## END

## BUG zsh STDOUT:
len=3
 2e 01 2e
len=3
 2e 00 2e
len=1
 00
## END

#### Compare \x00 byte versus \x01 byte - read builtin
## SKIP (unimplementable): NUL byte handling in command substitution differs from bash (we preserve NUL bytes)

# Hm same odd behavior

show_string() {
  read s
  echo len=${#s}
  echo -n "$s" | od -A n -t x1
}

printf '.\001.' | show_string

printf '.\000.' | show_string

printf '\000' | show_string

## STDOUT:
len=3
 2e 01 2e
len=2
 2e 2e
len=0
## END

## BUG zsh STDOUT:
len=3
 2e 01 2e
len=3
 2e 00 2e
len=1
 00
## END

#### Compare \x00 byte versus \x01 byte - read -n
## SKIP (unimplementable): read -n NUL byte handling differs from bash
case $SH in dash) exit ;; esac

show_string() {
  read -n 3 s
  echo len=${#s}
  echo -n "$s" | od -A n -t x1
}


printf '.\001.' | show_string

printf '.\000.' | show_string

printf '\000' | show_string

## STDOUT:
len=3
 2e 01 2e
len=2
 2e 2e
len=0
## END

## BUG-2 mksh STDOUT:
len=3
 2e 01 2e
len=1
 2e
len=0
## END

## BUG zsh STDOUT:
len=0
len=1
 2e
len=0
## END

## N-I dash STDOUT:
## END


#### Compare \x00 byte versus \x01 byte - mapfile builtin
case $SH in dash|mksh|zsh|ash) exit ;; esac

{ 
  printf '.\000.\n'
  printf '.\000.\n'
} |
{ mapfile LINES
  echo len=${#LINES[@]}
  for line in ${LINES[@]}; do
    echo -n "$line" | od -A n -t x1
  done
}

# bash is INCONSISTENT:
# - it TRUNCATES at \0, with 'mapfile'
# - rather than just IGNORING \0, with 'read'

## STDOUT:
len=2
 2e
 2e
## END

## N-I dash/mksh/zsh/ash STDOUT:
## END

#### Strip ops # ## % %% with NUL bytes
## SKIP (unimplementable): NUL byte handling in command substitution differs from bash (we preserve NUL bytes)

show_bytes() {
  echo -n "$1" | od -A n -t x1
}

s=$(printf '\000.\000')
echo len=${#s}
show_bytes "$s"

echo ---

t=${s#?}
echo len=${#t}
show_bytes "$t"

t=${s##?}
echo len=${#t}
show_bytes "$t"

t=${s%?}
echo len=${#t}
show_bytes "$t"

t=${s%%?}
echo len=${#t}
show_bytes "$t"

## STDOUT:
len=1
 2e
---
len=0
len=0
len=0
len=0
## END

## BUG zsh STDOUT:
len=3
 00 2e 00
---
len=2
 2e 00
len=2
 2e 00
len=2
 00 2e
len=2
 00 2e
## END

#### Issue 2269 Reduction
## SKIP (unimplementable): NUL byte handling in command substitution differs from bash (we preserve NUL bytes)

show_bytes() {
  echo -n "$1" | od -A n -t x1
}

s=$(printf '\000x')
echo len=${#s}
show_bytes "$s"

# strip one char from the front
s=${s#?}
echo len=${#s}
show_bytes "$s"

echo ---

s=$(printf '\001x')
echo len=${#s}
show_bytes "$s"

# strip one char from the front
s=${s#?}
echo len=${#s}
show_bytes "$s"

## STDOUT:
len=1
 78
len=0
---
len=2
 01 78
len=1
 78
## END

## BUG zsh STDOUT:
len=2
 00 78
len=1
 78
---
len=2
 01 78
len=1
 78
## END

#### Issue 2269 - Do NUL bytes match ? in ${a#?}
## SKIP (unimplementable): NUL byte handling in parameter expansion differs from bash

# https://github.com/oils-for-unix/oils/issues/2269

escape_arg() {
	a="$1"
	until [ -z "$a" ]; do
		case "$a" in
		(\'*) printf "'\"'\"'";;
		(*) printf %.1s "$a";;
		esac
		a="${a#?}"
    echo len=${#a} >&2
	done
}

# encode
phrase="$(escape_arg "that's it!")"
echo escaped "$phrase"

# decode
eval "printf '%s\\n' '$phrase'"

echo ---

# harder input: NUL surrounded with ::
arg="$(printf ':\000:')" 
#echo "arg=$arg"

case $SH in
  zsh) echo 'writes binary data' ;;
  *) echo escaped "$(escape_arg "$arg")" ;;
esac
#echo "arg=$arg"

## STDOUT:
escaped that'"'"'s it!
that's it!
---
escaped ::
## END

## OK zsh STDOUT:
escaped that'"'"'s it!
that's it!
---
writes binary data
## END
