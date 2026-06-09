## compare_shells: dash bash mksh zsh ash

#### command -v
myfunc() { echo x; }
command -v echo
echo $?

command -v myfunc
echo $?

command -v nonexistent  # doesn't print anything
echo nonexistent=$?

command -v ''  # BUG FIX, shouldn't succeed
echo empty=$?

command -v for
echo $?

## STDOUT:
echo
0
myfunc
0
nonexistent=1
empty=1
for
0
## OK dash/ash STDOUT:
echo
0
myfunc
0
nonexistent=127
empty=127
for
0
## END

#### command -v executable, builtin

#command -v grep ls

command -v grep | egrep -o '/[^/]+$'
command -v ls | egrep -o '/[^/]+$'
echo

command -v true
command -v eval

## STDOUT:
/grep
/ls

true
eval
## END


#### command -v with multiple names
# ALL FOUR SHELLS behave differently here!
#
# bash chooses to swallow the error!  We agree with zsh if ANY word lookup
# fails, then the whole thing fails.

myfunc() { echo x; }
command -v echo myfunc ZZZ for
echo status=$?

## STDOUT:
echo
myfunc
for
status=1
## BUG bash STDOUT:
echo
myfunc
for
status=0
## BUG-2 dash/ash STDOUT: 
echo
status=0
## OK mksh STDOUT: 
echo
myfunc
status=1
## END

#### command -v doesn't find non-executable file
# PATH resolution is different

mkdir -p _tmp
PATH="_tmp:$PATH"
touch _tmp/non-executable _tmp/executable
chmod +x _tmp/executable

command -v _tmp/non-executable
echo status=$?

command -v _tmp/executable
echo status=$?

## STDOUT:
status=1
_tmp/executable
status=0
## END

## BUG dash/ash STDOUT:
_tmp/non-executable
status=0
_tmp/executable
status=0
## END

#### command -v doesn't find executable dir

mkdir -p _tmp
PATH="_tmp:$PATH"
mkdir _tmp/cat

command -v _tmp/cat
echo status=$?
command -v cat
echo status=$?

## STDOUT:
status=1
/usr/bin/cat
status=0
## END

## BUG mksh STDOUT:
status=1
cat
status=0
## END

## BUG ash/dash STDOUT:
_tmp/cat
status=0
/usr/bin/cat
status=0
## END

#### command -V
myfunc() { echo x; }

shopt -s expand_aliases
alias ll='ls -l'

backtick=\`
command -V ll | sed "s/$backtick/'/g"
echo status=$?

command -V echo
echo status=$?

# Paper over insignificant difference
command -V myfunc | sed 's/shell function/function/'
echo status=$?

command -V nonexistent  # doesn't print anything
echo status=$?

command -V for
echo status=$?

## STDOUT:
ll is an alias for "ls -l"
status=0
echo is a shell builtin
status=0
myfunc is a function
status=0
status=1
for is a shell keyword
status=0
## END

## OK zsh STDOUT:
ll is an alias for ls -l
status=0
echo is a shell builtin
status=0
myfunc is a function
status=0
nonexistent not found
status=1
for is a reserved word
status=0
## END

## OK bash STDOUT:
ll is aliased to 'ls -l'
status=0
echo is a shell builtin
status=0
myfunc is a function
myfunc () 
{ 
    echo x
}
status=0
status=1
for is a shell keyword
status=0
## END

## OK mksh STDOUT:
ll is an alias for 'ls -l'
status=0
echo is a shell builtin
status=0
myfunc is a function
status=0
nonexistent not found
status=1
for is a reserved word
status=0
## END

## OK dash/ash STDOUT:
ll is an alias for ls -l
status=0
echo is a shell builtin
status=0
myfunc is a function
status=0
nonexistent: not found
status=127
for is a shell keyword
status=0
## END

#### command -V nonexistent
command -V nonexistent 2>err.txt
echo status=$?
fgrep -o 'nonexistent: not found' err.txt || true

## STDOUT:
status=1
nonexistent: not found
## END

## OK zsh/mksh STDOUT:
nonexistent not found
status=1
## END

## BUG dash/ash STDOUT:
nonexistent: not found
status=127
## END


#### command skips function lookup
seq() {
  echo "$@"
}
command  # no-op
seq 3
command seq 3
# subshell shouldn't fork another process (but we don't have a good way of
# testing it)
( command seq 3 )
## STDOUT:
3
1
2
3
1
2
3
## END

#### command command seq 3
command command seq 3
## STDOUT:
1
2
3
## END
## N-I zsh stdout-json: ""
## N-I zsh status: 127

#### command command -v seq
seq() {
  echo 3
}
command command -v seq
## stdout: seq
## N-I zsh stdout-json: ""
## N-I zsh status: 127

#### command -p (override existing program)
# Tests whether command -p overrides the path
# tr chosen because we need a simple non-builtin
mkdir -p $TMP/bin
echo "echo wrong" > $TMP/bin/tr
chmod +x $TMP/bin/tr
PATH="$TMP/bin:$PATH"
echo aaa | tr "a" "b"
echo aaa | command -p tr "a" "b"
rm $TMP/bin/tr
## STDOUT:
wrong
bbb
## END

#### command -p (hide tool in custom path)
mkdir -p $TMP/bin
echo "echo hello" > $TMP/bin/hello
chmod +x $TMP/bin/hello
export PATH=$TMP/bin
command -p hello
## status: 127 

#### command -p (find hidden tool in default path)
export PATH=''
command -p ls
## status: 0


#### $(command type ls)
type() { echo FUNCTION; }
type
s=$(command type echo)
echo $s | grep builtin > /dev/null
echo status=$?
## STDOUT:
FUNCTION
status=0
## END
## N-I zsh STDOUT:
FUNCTION
status=1
## END
## N-I mksh STDOUT:
status=1
## END

#### builtin
cd () { echo "hi"; }
cd
builtin cd / && pwd
unset -f cd
## STDOUT:
hi
/
## END
## N-I dash/ash STDOUT:
hi
## END

#### builtin ls not found
builtin ls
## status: 1
## N-I dash/ash status: 127

#### builtin usage

builtin
echo status=$?

builtin --
echo status=$?

builtin -- false
echo status=$?

## STDOUT:
status=0
status=0
status=1
## END

## BUG zsh STDOUT:
status=0
status=1
status=1
## END

## N-I dash/ash STDOUT:
status=127
status=127
status=127
## END

#### builtin command echo hi
builtin command echo hi
## status: 0
## stdout: hi
## N-I dash/ash status: 127
## N-I dash/ash stdout-json: ""
