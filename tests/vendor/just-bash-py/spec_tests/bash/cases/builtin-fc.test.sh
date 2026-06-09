## tags: interactive
## compare_shells: bash
## oils_failures_allowed: 2

#### fc -l lists history commands
## SKIP (unimplementable): history builtin not implemented
printf "echo %s\n" {1..3} > tmp

echo '
HISTFILE=tmp
history -c
history -r

fc -l
' | $SH --norc -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
1	 history -r
2	 echo 1
3	 echo 2
4	 echo 3
^D
## END

#### fc -ln lists history commands without numbers
## SKIP (unimplementable): history builtin not implemented
printf "echo %s\n" {1..3} > tmp

echo '
HISTFILE=tmp
history -c
history -r

fc -ln
' | $SH --norc -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
	 history -r
	 echo 1
	 echo 2
	 echo 3
^D
## END

#### fc -lr lists history commands in reverse order
## SKIP (unimplementable): history builtin not implemented
printf "echo %s\n" {1..3} > tmp

echo '
HISTFILE=tmp
history -c
history -r

fc -lr
' | $SH --norc -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
4	 echo 3
3	 echo 2
2	 echo 1
1	 history -r
^D
## END

#### fc -lnr lists history commands without numbers in reverse order
## SKIP (unimplementable): history builtin not implemented
printf "echo %s\n" {1..3} > tmp

echo '
HISTFILE=tmp
history -c
history -r

fc -lnr
' | $SH --norc -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
	 echo 3
	 echo 2
	 echo 1
	 history -r
^D
## END

#### fc -l lists history commands with default page size
## SKIP (unimplementable): history builtin not implemented
printf "echo %s\n" {1..16} > tmp

echo '
HISTFILE=tmp
history -c
history -r

fc -l
' | $SH --norc -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
2	 echo 1
3	 echo 2
4	 echo 3
5	 echo 4
6	 echo 5
7	 echo 6
8	 echo 7
9	 echo 8
10	 echo 9
11	 echo 10
12	 echo 11
13	 echo 12
14	 echo 13
15	 echo 14
16	 echo 15
17	 echo 16
^D
## END

#### fc -l [first] where first is an index
## SKIP (unimplementable): history builtin not implemented
printf "echo %s\n" {1..3} > tmp

echo '
HISTFILE=tmp
history -c
history -r

fc -l 2
' | $SH --norc -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
2	 echo 1
3	 echo 2
4	 echo 3
^D
## END

#### fc -l [first] where first is an offset from current command
## SKIP (unimplementable): history builtin not implemented
printf "echo %s\n" {1..3} > tmp

echo '
HISTFILE=tmp
history -c
history -r

fc -l -3
' | $SH --norc -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
2	 echo 1
3	 echo 2
4	 echo 3
^D
## END

#### fc -l [first] [last] where first and last are indexes
## SKIP (unimplementable): history builtin not implemented
printf "echo %s\n" {1..3} > tmp

echo '
HISTFILE=tmp
history -c
history -r

fc -l 2 3
' | $SH --norc -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
2	 echo 1
3	 echo 2
^D
## END

#### fc -l [first] [last] where first and last are offsets from current command
## SKIP (unimplementable): history builtin not implemented
printf "echo %s\n" {1..3} > tmp

echo '
HISTFILE=tmp
history -c
history -r

fc -l -3 -2
' | $SH --norc -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
2	 echo 1
3	 echo 2
^D
## END

#### fc -l [first] [last] where first and last are reversed indexes
## SKIP (unimplementable): history builtin not implemented
printf "echo %s\n" {1..3} > tmp

echo '
HISTFILE=tmp
history -c
history -r

fc -l 3 2
' | $SH --norc -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
3	 echo 2
2	 echo 1
^D
## END

#### fc -lr [first] [last] where first and last are reversed indexes does not undo reverse
## SKIP (unimplementable): history builtin not implemented
printf "echo %s\n" {1..3} > tmp

echo '
HISTFILE=tmp
history -c
history -r

fc -lr 3 2
' | $SH --norc -i

# match osh's behaviour of echoing ^D for EOF
case $SH in bash) echo '^D' ;; esac

## STDOUT:
3	 echo 2
2	 echo 1
^D
## END

#### fc ignores too many args
fc -l 0 1 2 || echo too many args!
## status: 0

#### fc errors out on too many args with strict_arg_parse
## SKIP (unimplementable): Oils-specific shopt options not implemented
shopt -s strict_arg_parse || true
fc -l 0 1 2 || echo too many args!
## STDOUT:
too many args!
## END
## N-I bash STDOUT:
## END

#### fc -l when no history is present
fc -l
## status: 0
