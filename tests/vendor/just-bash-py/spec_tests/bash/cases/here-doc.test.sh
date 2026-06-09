## oils_failures_allowed: 2
## compare_shells: dash bash mksh

#### Here string
cat <<< 'hi'
## STDOUT:
hi
## END
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Here string with $
cat <<< $'one\ntwo\n'
## STDOUT:
one
two

## END
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Here redirect with explicit descriptor
# A space between 0 and <<EOF causes it to pass '0' as an arg to cat.
cat 0<<EOF
one
EOF
## stdout: one

#### Here doc from another input file descriptor
# NOTE: OSH fails on descriptor 9, but not descriptor 8?  Is this because of
# the Python VM?  How  to inspect state?
read_from_fd.py 8  8<<EOF
here doc on descriptor
EOF
## stdout: 8: here doc on descriptor

#### Multiple here docs with different descriptors
read_from_fd.py 0 3 <<EOF 3<<EOF3
fd0
EOF
fd3
EOF3
## STDOUT:
0: fd0
3: fd3
## END

#### Here doc with bad var delimiter
# Most shells accept this, but OSH is stricter.
cat <<${a}
here
${a}
## stdout: here
## OK osh stdout-json: ""
## OK osh status: 2

#### Here doc with bad comsub delimiter
# bash is OK with this; dash isn't.  Should be a parse error.
cat <<$(a)
here
$(a)
## stdout-json: ""
## status: 2
## BUG bash stdout: here
## BUG bash status: 0
## OK mksh status: 1

#### Here doc and < redirect -- last one wins

echo hello >$TMP/hello.txt

cat <<EOF <$TMP/hello.txt
here
EOF
## stdout: hello

#### < redirect and here doc -- last one wins

echo hello >$TMP/hello.txt

cat <$TMP/hello.txt <<EOF
here
EOF
## stdout: here

#### Here doc with var sub, command sub, arith sub
var=v
cat <<EOF
var: ${var}
command: $(echo hi)
arith: $((1+2))
EOF
## STDOUT:
var: v
command: hi
arith: 3
## END

#### Here doc in middle.  And redirects in the middle.
# This isn't specified by the POSIX grammar, but it's accepted by both dash and
# bash!
echo foo > foo.txt
echo bar > bar.txt
cat <<EOF 1>&2 foo.txt - bar.txt
here
EOF
## STDERR:
foo
here
bar
## END

#### Here doc line continuation
cat <<EOF \
; echo two
one
EOF
## STDOUT:
one
two
## END

#### Here doc with quote expansion in terminator
cat <<'EOF'"2"
one
two
EOF2
## STDOUT:
one
two
## END

#### Here doc with multiline double quoted string
cat <<EOF; echo "two
three"
one
EOF
## STDOUT:
one
two
three
## END

#### Two here docs -- first is ignored; second ones wins!
<<EOF1 cat <<EOF2
hello
EOF1
there
EOF2
## stdout: there

#### Here doc with line continuation, then pipe.  Syntax error.
cat <<EOF \
1
2
3
EOF
| tac
## status: 2
## OK mksh status: 1

#### Here doc with pipe on first line
cat <<EOF | tac
1
2
3
EOF
## STDOUT:
3
2
1
## END

#### Here doc with pipe continued on last line
cat <<EOF |
1
2
3
EOF
tac
## STDOUT:
3
2
1
## END

#### Here doc with builtin 'read'
# read can't be run in a subshell.
read v1 v2 <<EOF
val1 val2
EOF
echo =$v1= =$v2=
## stdout: =val1= =val2=

#### Compound command here doc
while read line; do
  echo X $line
done <<EOF
1
2
3
EOF
## STDOUT:
X 1
X 2
X 3
## END


#### Here doc in while condition and here doc in body
while cat <<E1 && cat <<E2; do cat <<E3; break; done
1
E1
2
E2
3
E3
## STDOUT:
1
2
3
## END

#### Here doc in while condition and here doc in body on multiple lines
while cat <<E1 && cat <<E2
1
E1
2
E2
do
  cat <<E3
3
E3
  break
done
## STDOUT:
1
2
3
## END

#### Here doc in while loop split up more
while cat <<E1
1
E1

cat <<E2
2
E2

do
  cat <<E3
3
E3
  break
done
## STDOUT:
1
2
3
## END

#### Mixing << and <<-
cat <<-EOF; echo --; cat <<EOF2
	one
EOF
two
EOF2
## STDOUT:
one
--
two
## END



#### Two compound commands with two here docs
while read line; do echo X $line; done <<EOF; echo ==;  while read line; do echo Y $line; done <<EOF2
1
2
EOF
3
4
EOF2
## STDOUT:
X 1
X 2
==
Y 3
Y 4
## END

#### Function def and execution with here doc
fun() { cat; } <<EOF; echo before; fun; echo after
1
2
EOF
## STDOUT:
before
1
2
after
## END

#### Here doc as command prefix
<<EOF tac
1
2
3
EOF
## STDOUT:
3
2
1
## END

  # NOTE that you can have redirection AFTER the here doc thing.  And you don't
  # need a space!  Those are operators.
  #
  # POSIX doesn't seem to have this?  They have io_file, which is for
  # filenames, and io_here, which is here doc.  But about 1>&2 syntax?  Geez.
#### Redirect after here doc
cat <<EOF 1>&2
out
EOF
## stderr: out

#### here doc stripping tabs
cat <<-EOF
	1
	2
		3  # 2 tabs are both stripped
  4  # spaces are preserved
	EOF
## STDOUT:
1
2
3  # 2 tabs are both stripped
  4  # spaces are preserved
## END

#### Here doc within subshell with boolean
[[ $(cat <<EOF
foo
EOF
) == foo ]]; echo $?
## stdout: 0
## N-I dash stdout: 127

#### Here Doc in if condition
if cat <<EOF; then
here doc in IF CONDITION
EOF
  echo THEN executed
fi
## STDOUT:
here doc in IF CONDITION
THEN executed
## END

#### Nested here docs which are indented
cat <<- EOF
	outside
	$(cat <<- INSIDE
		inside
INSIDE
)
EOF
## STDOUT:
outside
inside
## END

#### Multiple here docs in pipeline
case $SH in *osh) exit ;; esac

# The second instance reads its stdin from the pipe, and fd 5 from a here doc.
read_from_fd.py 3 3<<EOF3 | read_from_fd.py 0 5 5<<EOF5
fd3
EOF3
fd5
EOF5

echo ok

## STDOUT:
0: 3: fd3
5: fd5
ok
## END

#### Multiple here docs in pipeline on multiple lines
case $SH in *osh) exit ;; esac

# SKIPPED: hangs with osh on Debian
# The second instance reads its stdin from the pipe, and fd 5 from a here doc.
read_from_fd.py 3 3<<EOF3 |
fd3
EOF3
read_from_fd.py 0 5 5<<EOF5
fd5
EOF5

echo ok

## STDOUT:
0: 3: fd3
5: fd5
ok
## END

#### Here doc and backslash double quote
cat <<EOF
a \"quote\"
EOF

## STDOUT:
a \"quote\"
## END

#### Here doc escapes
# these are the chars from _DQ_ESCAPED_CHAR
cat <<EOF
\\ \" \$ \`
EOF

## STDOUT:
\ \" $ `
## END
