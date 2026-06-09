## compare_shells: bash
## oils_failures_allowed: 0

# Tests nocasematch matching

#### [[ equality matching
shopt -s nocasematch
[[ a == A ]]; echo $?
[[ A == a ]]; echo $?
[[ A == [a] ]]; echo $?
[[ a == [A] ]]; echo $?
## STDOUT:
0
0
0
0
## END

#### [[ regex matching
shopt -s nocasematch
[[ a =~ A ]]; echo $?
[[ A =~ a ]]; echo $?
[[ a =~ [A] ]]; echo $?
[[ A =~ [a] ]]; echo $?
## STDOUT:
0
0
0
0
## END

#### [ matching
shopt -s nocasematch
[ a = A ]; echo $?
[ A = a ]; echo $?
## STDOUT:
1
1
## END

#### case matching
shopt -s nocasematch
case a in A) echo 0 ;; *) echo 1 ;; esac
case A in a) echo 0 ;; *) echo 1 ;; esac
case a in [A]) echo 0 ;; *) echo 1 ;; esac
case A in [a]) echo 0 ;; *) echo 1 ;; esac
## STDOUT:
0
0
0
0
## END

#### file matching
shopt -s nocasematch
touch a B
echo [A] [b]
## STDOUT:
[A] [b]
## END

#### parameter expansion matching
shopt -s nocasematch
foo=a
bar=A
echo "${foo#A}" "${foo#[A]}"
echo "${bar#a}" "${bar#[a]}"
## STDOUT:
a a
A A
## END
