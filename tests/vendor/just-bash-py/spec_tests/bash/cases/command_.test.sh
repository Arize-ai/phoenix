## compare_shells: dash bash mksh zsh

# Miscellaneous tests for the command language.

#### Command block
PATH=/bin

{ which ls; }
## stdout: /bin/ls

#### Permission denied
touch $TMP/text-file
$TMP/text-file
## status: 126

#### Not a dir
$TMP/not-a-dir/text-file
## status: 127

#### Name too long
./0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789
## status: 127
## OK dash status: 2
## OK bash status: 126

#### External programs don't have _OVM in environment
# bug fix for leakage
env | grep _OVM
echo status=$?
## stdout: status=1

#### File with no shebang is executed
# most shells execute /bin/sh; bash may execute itself
echo 'echo hi' > $TMP/no-shebang
chmod +x $TMP/no-shebang
$SH -c '$TMP/no-shebang'
## stdout: hi
## status: 0

#### File with relative path and no shebang is executed
cd $TMP
echo 'echo hi' > no-shebang
chmod +x no-shebang
"$SH" -c './no-shebang'
## stdout: hi
## status: 0

#### File in relative subdirectory and no shebang is executed
cd $TMP
mkdir -p test-no-shebang
echo 'echo hi' > test-no-shebang/script
chmod +x test-no-shebang/script
"$SH" -c 'test-no-shebang/script'
## stdout: hi
## status: 0

#### $PATH lookup
cd $TMP
mkdir -p one two
echo 'echo one' > one/mycmd
echo 'echo two' > two/mycmd
chmod +x one/mycmd two/mycmd

PATH='one:two'
mycmd
## STDOUT:
one
## END

#### filling $PATH cache, then insert the same command earlier in cache
cd $TMP
PATH="one:two:$PATH"
mkdir -p one two
rm -f one/* two/*
echo 'echo two' > two/mycmd
chmod +x two/mycmd
mycmd

# Insert earlier in the path
echo 'echo one' > one/mycmd
chmod +x one/mycmd
mycmd  # still runs the cached 'two'

# clear the cache
hash -r
mycmd  # now it runs the new 'one'

## STDOUT:
two
two
one
## END

# zsh doesn't do caching!
## OK zsh STDOUT:
two
one
one
## END

#### filling $PATH cache, then deleting command
## SKIP (unimplementable): We follow zsh/mksh behavior (re-search PATH) not bash behavior (fail on deleted cached command)
cd $TMP
PATH="one:two:$PATH"
mkdir -p one two
rm -f one/mycmd two/mycmd

echo 'echo two' > two/mycmd
chmod +x two/mycmd
mycmd
echo status=$?

# Insert earlier in the path
echo 'echo one' > one/mycmd
chmod +x one/mycmd
rm two/mycmd
mycmd  # still runs the cached 'two'
echo status=$?

## STDOUT:
two
status=0
status=127
## END

# mksh and zsh correctly searches for the executable again!
## OK zsh/mksh STDOUT:
two
status=0
one
status=0
## END

#### Non-executable on $PATH
# shells differ in whether they actually execve('one/cmd') and get EPERM

mkdir -p one two
PATH="one:two:$PATH"

rm -f one/mycmd two/mycmd
echo 'echo one' > one/mycmd
echo 'echo two' > two/mycmd

# only make the second one executable
chmod +x two/mycmd
mycmd
echo status=$?

## STDOUT:
two
status=0
## END

#### hash without args prints the cache
whoami >/dev/null
hash
echo status=$?
## STDOUT:
/usr/bin/whoami
status=0
## END

# bash uses a weird table.  Although we could use TSV2.
## OK bash stdout-json: "hits\tcommand\n   1\t/usr/bin/whoami\nstatus=0\n"
## OK-2 bash stdout-json: "hits\tcommand\n   1\t/bin/whoami\nstatus=0\n"

## OK mksh/zsh STDOUT:
whoami=/usr/bin/whoami
status=0
## END

#### hash with args
hash whoami
echo status=$?
hash | grep -o /whoami  # prints it twice
hash _nonexistent_
echo status=$?
## STDOUT:
status=0
/whoami
status=1
## END

# mksh doesn't fail
## BUG mksh STDOUT:
status=0
/whoami
status=0
## END

#### hash -r doesn't allow additional args
hash -r whoami >/dev/null  # avoid weird output with mksh
echo status=$?
## stdout: status=1
## OK osh stdout: status=2
## BUG dash/bash stdout: status=0

#### PATH resolution skips directories and non-executables
# Make the following directory structure. File type and permission bits are
# given on the left.
# [drwxr-xr-x]  _tmp
# +-- [drwxr-xr-x]  bin
# |   \-- [-rwxr-xr-x]  hello
# +-- [drwxr-xr-x]  notbin
# |   \-- [-rw-r--r--]  hello
# \-- [drwxr-xr-x]  dir
#     \-- [drwxr-xr-x]  hello
mkdir -p _tmp/bin
mkdir -p _tmp/bin2
mkdir -p _tmp/notbin
mkdir -p _tmp/dir/hello
printf '#!/usr/bin/env sh\necho hi\n' >_tmp/notbin/hello
printf '#!/usr/bin/env sh\necho hi\n' >_tmp/bin/hello
chmod +x _tmp/bin/hello

DIR=$PWD/_tmp/dir
BIN=$PWD/_tmp/bin
NOTBIN=$PWD/_tmp/notbin

# The command resolution will search the path for matching *files* (not
# directories) WITH the execute bit set.

# Should find executable hello right away and run it
PATH="$BIN:$PATH" hello
echo status=$?

hash -r  # Needed to clear the PATH cache

# Will see hello dir, skip it and then find&run the hello exe
PATH="$DIR:$BIN:$PATH" hello
echo status=$?

hash -r  # Needed to clear the PATH cache

# Will see hello (non-executable) file, skip it and then find&run the hello exe
PATH="$NOTBIN:$BIN:$PATH" hello
echo status=$?

## STDOUT:
hi
status=0
hi
status=0
hi
status=0
## END
