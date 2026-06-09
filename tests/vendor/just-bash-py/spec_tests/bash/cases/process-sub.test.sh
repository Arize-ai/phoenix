## compare_shells: bash-4.4 zsh

# mksh and dash don't support it

#### Process sub input
f=process-sub.txt
{ echo 1; echo 2; echo 3; } > $f
cat <(head -n 2 $f) <(tail -n 2 $f)
## STDOUT:
1
2
2
3
## END

#### Process sub from external process to stdin
seq 3 > >(tac)
## STDOUT:
3
2
1
## END

#### Process sub from shell to stdin
{ echo 1; echo 2; echo 3; } > >(tac)
## STDOUT:
3
2
1
## END

#### Non-linear pipeline with >()
stdout_stderr() {
  echo o1
  echo o2

  sleep 0.1  # Does not change order

  { echo e1;
    echo warning: e2 
    echo e3;
  } >& 2
}
stdout_stderr 2> >(grep warning) | tac >$TMP/out.txt
wait $!  # this does nothing in bash 4.3, but probably does in bash 4.4.
echo OUT
cat $TMP/out.txt
# PROBLEM -- OUT comes first, and then 'warning: e2', and then 'o2 o1'.  It
# looks like it's because nobody waits for the proc sub.
# http://lists.gnu.org/archive/html/help-bash/2017-06/msg00018.html
## STDOUT:
OUT
warning: e2
o2
o1
## END

#### $(<file) idiom with process sub
echo FOO >foo

# works in bash and zsh
echo $(<foo)

# this works in zsh, but not in bash
tr A-Z a-z < <(<foo)

cat < <(<foo; echo hi)

## STDOUT:
FOO
hi
## END
## OK zsh STDOUT:
FOO
foo
FOO
hi
## END

#### status code is available

shopt --set parse_at

cat <(seq 2; exit 2) <(seq 3; exit 3)

case $SH in bash*|zsh) exit ;; esac

echo status @_process_sub_status
echo done

## STDOUT:
1
2
1
2
3
status 2 3
done
## END
## N-I bash/zsh STDOUT:
1
2
1
2
3
## END

#### shopt -s process_sub_fail

case $SH in bash*|zsh) exit ;; esac

shopt --set parse_at

cat <(echo a; exit 2) <(echo b; exit 3)
echo status=$? ps @_process_sub_status

echo __
shopt -s process_sub_fail

cat <(echo a; exit 2) <(echo b; exit 3)
echo status=$? ps @_process_sub_status

# Now exit because of it
set -o errexit

cat <(echo a; exit 2) <(echo b; exit 3)
echo status=$? ps @_process_sub_status

## status: 3
## STDOUT:
a
b
status=0 ps 2 3
__
a
b
status=3 ps 2 3
a
b
## END
## N-I bash/zsh status: 0
## N-I bash/zsh STDOUT:
## END

#### process subs and pipelines together

# zsh is very similar to bash, but don't bother with the assertions
case $SH in bash*|zsh) exit ;; esac

shopt --set parse_at

f() {
  cat <(seq 1; exit 1) | {
    cat <(seq 2; exit 2) <(seq 3; exit 3)

    # 2022-11 workaround for race condition: sometimes we get pipeline=141 4
    # instead of pipeline=0 4, which means that the first 'cat' got SIGPIPE.
    # If we make this part of the pipeline take longer, then 'cat' should have
    # a chance to finish.

    sleep 0.01

    (exit 4)
  }
  echo status=$?
  echo process_sub @_process_sub_status
  echo pipeline @_pipeline_status
  echo __
}

f

## STDOUT:
1
2
1
2
3
status=4
process_sub 2 3
pipeline 0 4
__
## END
## N-I bash/zsh STDOUT:
## END

#### process sub in background &

cat <(seq 3; sleep 0.1) & wait

echo sync

# This one escapes, and the shell should still exit
cat <(sleep 0.1) &

echo fork

## STDOUT:
1
2
3
sync
fork
## END
