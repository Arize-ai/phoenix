## compare_shells: dash bash mksh zsh

# From:
#
# https://lobste.rs/s/xhtim1/problems_with_shells_test_builtin_what
# http://alangrow.com/blog/shell-quirk-assign-from-heredoc

## suite: disabled

#### Blog Post Example
paths=`tr '\n' ':' | sed -e 's/:$//'`<<EOPATHS
/foo
/bar
/baz
EOPATHS
echo "$paths"
## stdout: /foo:/bar:/baz

#### Blog Post Example Fix
paths=`tr '\n' ':' | sed -e 's/:$//'<<EOPATHS
/foo
/bar
/baz
EOPATHS`
echo "$paths"
## STDOUT:
/foo
/bar
/baz
## END

#### Rewrite of Blog Post Example
paths=$(tr '\n' ':' | sed -e 's/:$//' <<EOPATHS
/foo
/bar
/baz
EOPATHS
)
echo "$paths"
## STDOUT:
/foo
/bar
/baz
## END

#### Simpler example
foo=`cat`<<EOM
hello world
EOM
echo "$foo"
## stdout: hello world

#### ` after here doc delimiter
foo=`cat <<EOM
hello world
EOM`
echo "$foo"
## stdout: hello world

#### ` on its own line
foo=`cat <<EOM
hello world
EOM
`
echo "$foo"
## stdout: hello world
