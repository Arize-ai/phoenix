## oils_failures_allowed: 0
## compare_shells: bash
## legacy_tmp_dir: yes

#### type -t -> function
f() { echo hi; }
type -t f
## stdout: function

#### type -t -> alias
shopt -s expand_aliases
alias foo=bar
type -t foo
## stdout: alias

#### type -t -> builtin
type -t echo read : [ declare local
## STDOUT:
builtin
builtin
builtin
builtin
builtin
builtin
## END

#### type -t -> keyword
type -t for time ! fi do {
## STDOUT: 
keyword
keyword
keyword
keyword
keyword
keyword
## END

#### type -t control flow
type -t break continue return exit

## STDOUT:
builtin
builtin
builtin
builtin
## END

# In OSH, tye are now keywords AND dynamic builtins
#
# We MAY make them builtins in OSH, and keywords in YSH

## OK osh STDOUT:
keyword
keyword
keyword
keyword
## END


#### type -t -> file
type -t find xargs
## STDOUT: 
file
file
## END

#### type -t doesn't find non-executable (like command -v)
PATH="$TMP:$PATH"
touch $TMP/non-executable
type -t non-executable
## STDOUT:
## END
## status: 1
## BUG bash STDOUT:
file
## END
## BUG bash status: 0

#### type -t -> not found
type -t echo ZZZ find ==
echo status=$?
## STDOUT: 
builtin
file
status=1
## END
## STDERR:
## END

#### type -p and -P builtin -> file
touch /tmp/{mv,tar,grep}
chmod +x /tmp/{mv,tar,grep}
PATH=/tmp:$PATH

type -p mv tar grep
echo --
type -P mv tar grep
## STDOUT:
/tmp/mv
/tmp/tar
/tmp/grep
--
/tmp/mv
/tmp/tar
/tmp/grep
## END

#### type -a -P gives multiple files

touch _tmp/pwd
chmod +x _tmp/pwd
PATH="_tmp:/bin"

type -a -P pwd

## STDOUT:
_tmp/pwd
/bin/pwd
## END

#### type -p builtin -> not found
type -p FOO BAR NOT_FOUND
## status: 1
## STDOUT:
## END

#### type -p builtin -> not a file
type -p cd type builtin command
## STDOUT:
## END

#### type -P builtin -> not found
type -P FOO BAR NOT_FOUND
## status: 1
## STDOUT:
## END

#### type -P builtin -> not a file
type -P cd type builtin command
## status: 1
## STDOUT:
## END

#### type -P builtin -> not a file but file found
touch _tmp/{mv,tar,grep}
chmod +x _tmp/{mv,tar,grep}
PATH=_tmp:$PATH

mv () { ls; }
tar () { ls; }
grep () { ls; }
type -P mv tar grep cd builtin command type
## status: 1
## STDOUT:
_tmp/mv
_tmp/tar
_tmp/grep
## END

#### type -f builtin -> not found
type -f FOO BAR NOT FOUND
## status: 1

#### type -f builtin -> function and file exists
touch /tmp/{mv,tar,grep}
chmod +x /tmp/{mv,tar,grep}
PATH=/tmp:$PATH

mv () { ls; }
tar () { ls; }
grep () { ls; }
type -f mv tar grep
## STDOUT:
mv is /tmp/mv
tar is /tmp/tar
grep is /tmp/grep
## END

#### type prints function source code
f () { echo; }
type -a f
echo

type f

## STDOUT:
f is a function
f () 
{ 
    echo
}

f is a function
f () 
{ 
    echo
}
## END
## OK osh STDOUT:
f is a shell function
f () { echo; }

f is a shell function
f () { echo; }
## END

#### type -ap -> function
f () { :; }
type -ap f
## STDOUT:
## END

#### type -a -> alias; prints alias definition
shopt -s expand_aliases
alias ll="ls -lha"
type -a ll
## stdout: ll is an alias for "ls -lha"
## OK bash stdout: ll is aliased to `ls -lha'

#### type -ap -> alias
shopt -s expand_aliases
alias ll="ls -lha"
type -ap ll
## STDOUT:
## END

#### type -a -> builtin
type -a cd
## stdout: cd is a shell builtin

#### type -ap -> builtin
type -ap cd
## STDOUT:
## END

#### type -a -> keyword
type -a while
## stdout: while is a shell keyword

#### type -a -> file
touch _tmp/date
chmod +x _tmp/date
PATH=/bin:_tmp  # control output

type -a date

## STDOUT:
date is /bin/date
date is _tmp/date
## END

#### type -ap -> file; abbreviated
touch _tmp/date
chmod +x _tmp/date
PATH=/bin:_tmp  # control output

type -ap date
## STDOUT:
/bin/date
_tmp/date
## END

#### type -a -> builtin and file
touch _tmp/pwd
chmod +x _tmp/pwd
PATH=/bin:_tmp  # control output

type -a pwd
## STDOUT:
pwd is a shell builtin
pwd is /bin/pwd
pwd is _tmp/pwd
## END

#### type -a -> builtin and file and shell function
touch _tmp/pwd
chmod +x _tmp/pwd
PATH=/bin:_tmp  # control output

type -a pwd
echo ---

pwd ()
{
    echo function-too
}

osh-normalize() {
  sed 's/shell function/function/'
}

type -a pwd | osh-normalize
echo ---

type -a -f pwd | osh-normalize

## STDOUT:
pwd is a shell builtin
pwd is /bin/pwd
pwd is _tmp/pwd
---
pwd is a function
pwd () 
{ 
    echo function-too
}
pwd is a shell builtin
pwd is /bin/pwd
pwd is _tmp/pwd
---
pwd is a shell builtin
pwd is /bin/pwd
pwd is _tmp/pwd
## END

#### type -ap -> builtin and file; doesn't print builtin or function
touch _tmp/pwd
chmod +x _tmp/pwd
PATH=/bin:_tmp  # control output

# Function is also ignored
pwd() { echo function-too; }

type -ap pwd
echo ---

type -p pwd

## STDOUT:
/bin/pwd
_tmp/pwd
---
## END

#### type -a -> executable not in PATH
touch _tmp/executable
chmod +x _tmp/executable
type -a executable
## status: 1

#### type -P does not find directories (regression)

mkdir -p _tmp
PATH="_tmp:$PATH"
mkdir _tmp/cat

type -P _tmp/cat
echo status=$?
type -P cat
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
