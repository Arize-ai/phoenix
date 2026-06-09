## compare_shells: dash bash mksh

#### Subshell exit code
( false; )
echo $?
## stdout: 1
## status: 0

#### Subshell with redirects
( echo 1 ) > a.txt
( env echo 2 ) > b.txt
( env echo 3; ) > c.txt  # Sentence in LST
( echo 4; echo 5 ) > d.txt
echo status=$?
cat a.txt b.txt c.txt d.txt
## STDOUT:
status=0
1
2
3
4
5
## END
