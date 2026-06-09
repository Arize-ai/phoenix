## compare_shells: dash bash mksh

# Cases from
# http://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html

# My tests

#### Empty for loop is allowed
set -- a b
for x in; do
  echo hi
  echo $x
done
## stdout-json: ""

#### Empty for loop without in.  Do can be on the same line I guess.
set -- a b
for x do
  echo hi
  echo $x
done
## STDOUT:
hi
a
hi
b
## END

#### Empty case statement
case foo in
esac
## stdout-json: ""

#### Last case without ;;
foo=a
case $foo in
  a) echo A ;;
  b) echo B
esac
## stdout: A

#### Only case without ;;
foo=a
case $foo in
  a) echo A
esac
## stdout: A

#### Case with optional (
foo=a
case $foo in
  (a) echo A ;;
  (b) echo B
esac
## stdout: A

#### Empty action for case is syntax error
# POSIX grammar seems to allow this, but bash and dash don't.  Need ;;
foo=a
case $foo in
  a)
  b)
    echo A ;;
  d)
esac
## status: 2
## OK mksh status: 1

#### Empty action is allowed for last case
foo=b
case $foo in
  a) echo A ;;
  b)
esac
## stdout-json: ""

#### Case with | pattern
foo=a
case $foo in
  a|b) echo A ;;
  c)
esac
## stdout: A


#### Bare semi-colon not allowed
# This is disallowed by the grammar; bash and dash don't accept it.
;
## status: 2
## OK mksh status: 1



#
# Explicit tests
#



#### Command substitution in default
echo ${x:-$(ls -d /bin)}
## stdout: /bin


#### Arithmetic expansion
x=3
while [ $x -gt 0 ]
do
  echo $x
  x=$(($x-1))
done
## STDOUT:
3
2
1
## END

#### Newlines in compound lists
mkdir -p tests _tmp
echo hello > tests/hello.txt
x=3
while
  # a couple of <newline>s

  # a list
  date && ls -d /bin || echo failed; cat tests/hello.txt
  # a couple of <newline>s

  # another list
  wc tests/hello.txt > _tmp/posix-compound.txt & true

do
  # 2 lists
  ls -d /bin
  cat tests/hello.txt
  x=$(($x-1))
  [ $x -eq 0 ] && break
done
# Not testing anything but the status since output is complicated
## status: 0

#### Multiple here docs on one line
cat <<EOF1; cat <<EOF2
one
EOF1
two
EOF2
## STDOUT:
one
two
## END

#### cat here doc; echo; cat here doc
cat <<EOF1; echo two; cat <<EOF2
one
EOF1
three
EOF2
## STDOUT:
one
two
three
## END
