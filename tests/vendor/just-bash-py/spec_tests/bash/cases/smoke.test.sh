# For testing the Python sketch


## tags: dev-minimal
## compare_shells: bash dash mksh

#### builtin
echo hi
## stdout: hi

#### command sub 
echo $(expr 3)
## stdout: 3

#### command sub with builtin
echo $(echo hi)
## stdout: hi

#### pipeline
hostname | wc -l
## stdout: 1

#### pipeline with builtin
echo hi | wc -l
## stdout: 1

#### and-or chains
echo 1 && echo 2 || echo 3 && echo 4
echo --
false || echo A
false || false || echo B
false || false || echo C && echo D || echo E
## STDOUT:
1
2
4
--
A
B
C
D
## END

#### here doc with var
v=one
tac <<EOF
$v
"two
EOF
## stdout-json: "\"two\none\n"

#### here doc without var
tac <<"EOF"
$v
"two
EOF
## stdout-json: "\"two\n$v\n"

#### here doc with builtin
read var <<EOF
value
EOF
echo "var = $var"
## stdout: var = value

#### Redirect external command
expr 3 > $TMP/expr3.txt
cat $TMP/expr3.txt
## stdout: 3
## stderr-json: ""

#### Redirect with builtin
echo hi > hi.txt
cat hi.txt
## stdout: hi

#### Here doc with redirect
cat <<EOF >smoke1.txt
one
two
EOF
wc -c smoke1.txt
## stdout: 8 smoke1.txt

#### "$@" "$*"
fun () {
  argv.py "$@" "$*"
}
fun "a b" "c d"
## stdout: ['a b', 'c d', 'a b c d']

#### $@ $*
fun() {
  argv.py $@ $*
}
fun "a b" "c d"
## stdout: ['a', 'b', 'c', 'd', 'a', 'b', 'c', 'd']

#### failed command
ls /nonexistent-zzZZ
## status: 2

#### subshell
(echo 1; echo 2)
## status: 0
## STDOUT:
1
2
## END

#### for loop
for i in a b c
do
  echo $i
done
## status: 0
## STDOUT:
a
b
c
## END

#### vars
a=5
echo $a ${a} "$a ${a}"
## stdout: 5 5 5 5
