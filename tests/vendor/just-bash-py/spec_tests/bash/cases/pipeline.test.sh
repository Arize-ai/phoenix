## oils_failures_allowed: 1
## compare_shells: bash dash mksh zsh

#
# Tests for pipelines.
# NOTE: Grammatically, ! is part of the pipeline:
#
# pipeline         :      pipe_sequence
#                  | Bang pipe_sequence

#### Brace group in pipeline
{ echo one; echo two; } | tac
## STDOUT:
two
one
## END

#### For loop starts pipeline
for w in one two; do
  echo $w
done | tac
## STDOUT:
two
one
## END

#### While Loop ends pipeline
seq 3 | while read i
do
  echo ".$i"
done
## STDOUT:
.1
.2
.3
## END

#### Redirect in Pipeline
echo hi 1>&2 | wc -l
## stdout: 0
## BUG zsh stdout: 1

#### Pipeline comments
echo abcd |    # input
               # blank line
tr a-z A-Z     # transform
## stdout: ABCD

#### Exit code is last status
echo a | egrep '[0-9]+'
## status: 1

#### Initial value of PIPESTATUS is empty string
case $SH in dash|zsh) exit ;; esac

echo pipestatus ${PIPESTATUS[@]}
## STDOUT:
pipestatus
## END
## BUG mksh STDOUT:
pipestatus 0
## END
## N-I dash/zsh STDOUT:
## END

#### PIPESTATUS
return3() {
  return 3
}
{ sleep 0.03; exit 1; } | { sleep 0.02; exit 2; } | { sleep 0.01; return3; }
echo ${PIPESTATUS[@]}
## stdout: 1 2 3
## N-I dash status: 2
## N-I dash stdout-json: ""
## N-I zsh status: 0
## N-I zsh STDOUT:

## END

#### PIPESTATUS is set on simple commands
case $SH in dash|zsh) exit ;; esac

false
echo pipestatus ${PIPESTATUS[@]}

exit 55 | (exit 44)
echo pipestatus ${PIPESTATUS[@]}

true
echo pipestatus ${PIPESTATUS[@]}

## STDOUT:
pipestatus 1
pipestatus 55 44
pipestatus 0
## END
## N-I dash/zsh STDOUT:
## END

#### PIPESTATUS with shopt -s lastpipe
shopt -s lastpipe
return3() {
  return 3
}
{ sleep 0.03; exit 1; } | { sleep 0.02; exit 2; } | { sleep 0.01; return3; }
echo ${PIPESTATUS[@]}
## stdout: 1 2 3
## N-I dash status: 2
## N-I dash stdout-json: ""
## N-I zsh status: 0
## N-I zsh STDOUT:

## END

#### |&
stdout_stderr.py |& cat
## STDOUT:
STDERR
STDOUT
## END
## status: 0
## N-I dash/mksh stdout-json: ""
## N-I dash status: 2
## N-I osh stdout-json: ""
## N-I osh status: 1

#### ! turns non-zero into zero
! $SH -c 'exit 42'; echo $?
## stdout: 0
## status: 0

#### ! turns zero into 1
! $SH -c 'exit 0'; echo $?
## stdout: 1
## status: 0

#### ! in if
if ! echo hi; then
  echo TRUE
else
  echo FALSE
fi
## STDOUT:
hi
FALSE
## END
## status: 0

#### ! with ||
! echo hi || echo FAILED
## STDOUT:
hi
FAILED
## END
## status: 0

#### ! with { }
! { echo 1; echo 2; } || echo FAILED
## STDOUT:
1
2
FAILED
## END
## status: 0

#### ! with ( )
! ( echo 1; echo 2 ) || echo FAILED
## STDOUT:
1
2
FAILED
## END
## status: 0

#### ! is not a command
v='!'
$v echo hi
## status: 127

#### Evaluation of argv[0] in pipeline occurs in child
${cmd=echo} hi | wc -l
echo "cmd=$cmd"
## STDOUT:
1
cmd=
## END
## BUG zsh STDOUT:
1
cmd=echo
## END

#### bash/dash/mksh run the last command is run in its own process
echo hi | read line
echo "line=$line"
## stdout: line=hi
## OK bash/dash/mksh stdout: line=

#### shopt -s lastpipe (always on in OSH)
shopt -s lastpipe
echo hi | read line
echo "line=$line"
## stdout: line=hi
## N-I dash/mksh stdout: line=

#### shopt -s lastpipe (always on in OSH)
shopt -s lastpipe
i=0
seq 3 | while read line; do
  (( i++ ))
done
echo i=$i
## stdout: i=3
## N-I dash/mksh stdout: i=0


#### SIGPIPE causes pipeline to die (regression for issue #295)
## SKIP (unimplementable): PIPESTATUS and SIGPIPE handling not implemented - requires signal handling
cat /dev/urandom | sleep 0.1
echo ${PIPESTATUS[@]}

# hm bash gives '1 0' which seems wrong

## STDOUT:
141 0
## END
## N-I zsh stdout:
## N-I dash status: 2
## N-I dash stdout-json: ""

#### Nested pipelines
{ sleep 0.1 | seq 3; } | cat
{ sleep 0.1 | seq 10; } | { cat | cat; } | wc -l
## STDOUT:
1
2
3
10
## END

#### Pipeline in eval
ls /dev/null | eval 'cat | cat' | wc -l
## STDOUT:
1
## END


#### shopt -s lastpipe and shopt -s no_last_fork interaction

case $SH in dash) exit ;; esac

$SH -c '
shopt -s lastpipe
set -o errexit
set -o pipefail

ls | false | wc -l'
echo status=$?

# Why does this give status 0?  It should fail

$SH -c '
shopt -s lastpipe
shopt -s no_fork_last  # OSH only
set -o errexit
set -o pipefail

ls | false | wc -l'
echo status=$?

## STDOUT:
0
status=1
0
status=1
## END

## N-I dash STDOUT:
## END
