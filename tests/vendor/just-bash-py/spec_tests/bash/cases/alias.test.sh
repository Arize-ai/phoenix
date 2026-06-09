## compare_shells: bash dash mksh zsh


# Alias is in POSIX.
#
# http://pubs.opengroup.org/onlinepubs/009695399/utilities/xcu_chap02.html#tag_02_03_01
#
# Bash is the only one that doesn't support aliases by default!

#### Usage of builtins
shopt -s expand_aliases || true
alias -- foo=echo
echo status=$?
foo x
unalias -- foo
foo x
## status: 127
## STDOUT:
status=0
x
## END
# dash doesn't accept --
## BUG dash STDOUT:
status=1
x
## END

#### Basic alias
shopt -s expand_aliases  # bash requires this
alias hi='echo hello world'
hi || echo 'should not run this'
echo hi  # second word is not
'hi' || echo 'expected failure'
## STDOUT:
hello world
hi
expected failure
## END

#### define and use alias on a single line
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases
alias e=echo; e one  # this is not alias-expanded because we parse lines at once
e two; e three
## STDOUT:
two
three
## END

#### alias can override builtin
shopt -s expand_aliases
alias echo='echo foo'
echo bar
## stdout: foo bar

#### defining multiple aliases, then unalias
shopt -s expand_aliases  # bash requires this
x=x
y=y
alias echo-x='echo $x' echo-y='echo $y'
echo status=$?
echo-x X
echo-y Y
unalias echo-x echo-y
echo status=$?
echo-x X || echo undefined
echo-y Y || echo undefined
## STDOUT:
status=0
x X
y Y
status=0
undefined
undefined
## END

#### alias not defined
alias e='echo' nonexistentZ
echo status=$?
## STDOUT:
status=1
## END
## OK mksh STDOUT:
nonexistentZ alias not found
status=1
## END

#### unalias not defined
alias e=echo ll='ls -l'
unalias e nonexistentZ ll
echo status=$?
## STDOUT:
status=1
## END

#### unalias -a

alias foo=bar
alias spam=eggs

alias | egrep 'foo|spam' | wc -l

unalias -a

alias
echo status=$?

## STDOUT:
2
status=0
## END

#### List aliases by providing names
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution

alias e=echo ll='ls -l'
alias e ll

## STDOUT:
alias e='echo'
alias ll='ls -l'
## END
## OK mksh/zsh STDOUT:
e=echo
ll='ls -l'
## END
## OK dash STDOUT:
e='echo'
ll='ls -l'
## END

#### alias without args lists all aliases
alias ex=exit ll='ls -l'
alias | grep -E 'ex=|ll='  # need to grep because mksh/zsh have builtin aliases
echo status=$?
## STDOUT:
alias ex='exit'
alias ll='ls -l'
status=0
## END
## OK dash STDOUT:
ex='exit'
ll='ls -l'
status=0
## END
## OK mksh/zsh STDOUT:
ex=exit
ll='ls -l'
status=0
## END

#### unalias without args is a usage error
unalias
if test "$?" != 0; then echo usage-error; fi
## STDOUT:
usage-error
## END
## BUG mksh/dash STDOUT: 
## END

#### alias with trailing space causes alias expansion on second word
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases  # bash requires this

alias hi='echo hello world '
alias punct='!!!'

hi punct

alias hi='echo hello world'  # No trailing space

hi punct

## STDOUT:
hello world !!!
hello world punct
## END

#### Recursive alias expansion of first word
shopt -s expand_aliases  # bash requires this
alias hi='e_ hello world'
alias e_='echo __'
hi   # first hi is expanded to echo hello world; then echo is expanded.  gah.
## STDOUT:
__ hello world
## END

#### Recursive alias expansion of SECOND word
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases  # bash requires this
alias one='ONE '
alias two='TWO '
alias e_='echo one '
e_ two hello world
## STDOUT:
one TWO hello world
## END

#### Expansion of alias with variable
shopt -s expand_aliases  # bash requires this
x=x
alias echo-x='echo $x'  # nothing is evaluated here
x=y
echo-x hi
## STDOUT:
y hi
## END

#### Alias must be an unquoted word, no expansions allowed
shopt -s expand_aliases  # bash requires this
alias echo_alias_='echo'
cmd=echo_alias_
echo_alias_ X  # this works
$cmd X  # this fails because it's quoted
echo status=$?
## STDOUT:
X
status=127
## END

#### first and second word are the same alias, but no trailing space
shopt -s expand_aliases  # bash requires this
x=x
alias echo-x='echo $x'  # nothing is evaluated here
echo-x echo-x
## STDOUT:
x echo-x
## END

#### first and second word are the same alias, with trailing space
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases  # bash requires this
x=x
alias echo-x='echo $x '  # nothing is evaluated here
echo-x echo-x
## STDOUT:
x echo x
## END

#### Invalid syntax of alias
shopt -s expand_aliases  # bash requires this
alias echo_alias_= 'echo --; echo'  # bad space here
echo_alias_ x
## status: 127

#### Dynamic alias definition
shopt -s expand_aliases  # bash requires this
x=x
name='echo_alias_'
val='=echo'
alias "$name$val"
echo_alias_ X
## stdout: X

#### Alias name with punctuation
# NOTE: / is not OK in bash, but OK in other shells.  Must less restrictive
# than var names.
shopt -s expand_aliases  # bash requires this
alias e_+.~x='echo'
e_+.~x X
## stdout: X

#### Syntax error after expansion
shopt -s expand_aliases  # bash requires this
alias e_=';; oops'
e_ x
## status: 2
## OK mksh/zsh status: 1

#### Loop split across alias and arg works
shopt -s expand_aliases  # bash requires this
alias e_='for i in 1 2 3; do echo $i;'
e_ done
## STDOUT:
1
2
3
## END

#### Loop split across alias in another way
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases
alias e_='for i in 1 2 3; do echo '
e_ $i; done
## STDOUT:
1
2
3
## END
## OK osh stdout-json: ""
## OK osh status: 2

#### Loop split across both iterative and recursive aliases
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases  # bash requires this
alias FOR1='for '
alias FOR2='FOR1 '
alias eye1='i '
alias eye2='eye1 '
alias IN='in '
alias onetwo='$one "2" '  # NOTE: this does NOT work in any shell except bash.
one=1
FOR2 eye2 IN onetwo 3; do echo $i; done
## STDOUT:
1
2
3
## END
## OK osh stdout-json: ""
## OK osh status: 2
## BUG zsh stdout-json: ""

#### Alias with a quote in the middle is a syntax error
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases
alias e_='echo "'
var=x
e_ '${var}"'
## status: 2
## OK mksh/zsh status: 1

#### Alias with internal newlines
shopt -s expand_aliases
alias e_='echo 1
echo 2
echo 3'
var='echo foo'
e_ ${var}
## STDOUT:
1
2
3 echo foo
## END

#### Alias trailing newline
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases
alias e_='echo 1
echo 2
echo 3
'
var='echo foo'
e_ ${var}
## STDOUT:
1
2
3
foo
## END
## OK zsh STDOUT:
1
2
3
## END
## OK zsh status: 127

#### Two aliases in pipeline
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases
alias SEQ='seq '
alias THREE='3 '
alias WC='wc '
SEQ THREE | WC -l
## stdout: 3

#### Alias not respected inside $()
# This could be parsed correctly, but it is only defined in a child process.
shopt -s expand_aliases
echo $(alias sayhi='echo hello')
sayhi
## status: 127

#### Alias can be defined and used on a single line
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases
alias sayhi='echo hello'; sayhi same line
sayhi other line
## STDOUT:
hello other line
## END

#### Alias is respected inside eval
shopt -s expand_aliases
eval "alias sayhi='echo hello'
sayhi inside"
sayhi outside
## STDOUT:
hello inside
hello outside
## END
## BUG zsh STDOUT:
hello outside
## END

#### alias with redirects works
shopt -s expand_aliases
alias e_=echo
>$TMP/alias1.txt e_ 1
e_ >$TMP/alias2.txt 2
e_ 3 >$TMP/alias3.txt
cat $TMP/alias1.txt $TMP/alias2.txt $TMP/alias3.txt
## STDOUT:
1
2
3
## END

#### alias with environment bindings works
shopt -s expand_aliases
alias p_=printenv.py
FOO=1 printenv.py FOO
FOO=2 p_ FOO
## STDOUT:
1
2
## END

#### alias with line continuation in the middle
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases
alias e_='echo '
alias one='ONE '
alias two='TWO '
alias three='THREE'  # no trailing space
e_ one \
  two one \
  two three two \
  one
## stdout: ONE TWO ONE TWO THREE two one

#### alias for left brace
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases
alias LEFT='{'
LEFT echo one; echo two; }
## STDOUT:
one
two
## END
## OK osh stdout-json: ""
## OK osh status: 2

#### alias for left paren
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases
alias LEFT='('
LEFT echo one; echo two )
## STDOUT:
one
two
## END
## OK osh stdout-json: ""
## OK osh status: 2

#### alias used in subshell and command sub
# This spec seems to be contradictoary?
# http://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_03_01
# "When used as specified by this volume of POSIX.1-2017, alias definitions
# shall not be inherited by separate invocations of the shell or by the utility
# execution environments invoked by the shell; see Shell Execution
# Environment."
shopt -s expand_aliases
alias echo_='echo [ '
( echo_ subshell; )
echo $(echo_ commandsub)
## STDOUT:
[ subshell
[ commandsub
## END

#### alias used in here doc
shopt -s expand_aliases
alias echo_='echo [ '
cat <<EOF
$(echo_ ])
EOF
## STDOUT:
[ ]
## END

#### here doc inside alias
shopt -s expand_aliases
alias c='cat <<EOF
$(echo hi)
EOF
'
c
## STDOUT:
hi
## END
## BUG bash stdout-json: ""
## BUG bash status: 127

#### Corner case: alias inside LHS array arithmetic expression
shopt -s expand_aliases
alias zero='echo 0'
a[$(zero)]=ZERO
a[1]=ONE
argv.py "${a[@]}"
## STDOUT:
['ZERO', 'ONE']
## END
## N-I dash stdout-json: ""
## N-I dash status: 2
## N-I zsh stdout-json: ""
## N-I zsh status: 1

#### Alias that is pipeline
shopt -s expand_aliases
alias t1='echo hi|wc -c'
t1
## STDOUT:
3
## END

#### Alias that is && || ;
shopt -s expand_aliases
alias t1='echo one && echo two && echo 3 | wc -l;
echo four'
t1
## STDOUT:
one
two
1
four
## END

#### Alias and command sub (bug regression)
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
cd $TMP
shopt -s expand_aliases
echo foo bar > tmp.txt
alias a=argv.py
a `cat tmp.txt`
## stdout: ['foo', 'bar']

#### Alias and arithmetic
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
shopt -s expand_aliases
alias a=argv.py
a $((1 + 2))
## stdout: ['3']

#### Alias and PS4
## SKIP (unimplementable): alias expansion not implemented - parsing happens before execution
# dash enters an infinite loop!
case $SH in
  dash)
    exit 1
    ;;
esac

set -x
PS4='+$(echo trace) '
shopt -s expand_aliases
alias a=argv.py
a foo bar
## stdout: ['foo', 'bar']
## BUG dash status: 1
## BUG dash stdout-json: ""

#### alias with keywords
# from issue #299
shopt -s expand_aliases
alias a=

# both of these fail to parse in OSH
# this is because of our cleaner evaluation model

a (( var = 0 ))
#a case x in x) true ;; esac

echo done
## stdout: done
## OK osh status: 2
## OK osh stdout-json: ""


#### alias with word of multiple lines
shopt -s expand_aliases

alias ll='ls -l'
ll '1
  2
  3'
echo status=$?

## STDOUT:
status=2
## END
