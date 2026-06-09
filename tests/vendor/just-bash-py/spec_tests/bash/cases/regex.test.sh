## oils_failures_allowed: 0
## compare_shells: bash-4.4 zsh

#
# Only bash and zsh seem to implement [[ foo =~ '' ]]
#
# ^(a b)$ is a regex that should match 'a b' in a group.
#
# Not sure what bash is doing here... I think I have to just be empirical.
# Might need "compat" switch for parsing the regex.  It should be an opaque
# string like zsh, not sure why it isn't.
#
# I think this is just papering over bugs...
# https://www.gnu.org/software/bash/manual/bash.html#Conditional-Constructs
#
# Storing the regular expression in a shell variable is often a useful way to
# avoid problems with quoting characters that are special to the shell. It is
# sometimes difficult to specify a regular expression literally without using
# quotes, or to keep track of the quoting used by regular expressions while
# paying attention to the shell’s quote removal. Using a shell variable to
# store the pattern decreases these problems. For example, the following is
# equivalent to the above:
#
# pattern='[[:space:]]*(a)?b'
# [[ $line =~ $pattern ]]
# 
# If you want to match a character that’s special to the regular expression
# grammar, it has to be quoted to remove its special meaning. This means that in
# the pattern ‘xxx.txt’, the ‘.’ matches any character in the string (its usual
# regular expression meaning), but in the pattern ‘"xxx.txt"’ it can only match a
# literal ‘.’. Shell programmers should take special care with backslashes, since
# backslashes are used both by the shell and regular expressions to remove the
# special meaning from the following character. The following two sets of
# commands are not equivalent: 
#
# From bash code: ( | ) are treated special.  Normally they must be quoted, but
# they can be UNQUOTED in BASH_REGEX state.  In fact they can't be quoted!

#### BASH_REMATCH
[[ foo123 =~ ([a-z]+)([0-9]+) ]]
echo status=$?
argv.py "${BASH_REMATCH[@]}"

[[ failed =~ ([a-z]+)([0-9]+) ]]
echo status=$?
argv.py "${BASH_REMATCH[@]}"  # not cleared!

## STDOUT:
status=0
['foo123', 'foo', '123']
status=1
[]
## END
## N-I zsh STDOUT:
status=0
['']
status=1
['']
## END

#### Match is unanchored at both ends
[[ 'bar' =~ a ]] && echo true
## stdout: true

#### Failed match
[[ 'bar' =~ X ]] && echo true
## status: 1
## stdout-json: ""

#### Regex quoted with \ -- preferred in bash
[[ 'a b' =~ ^(a\ b)$ ]] && echo true
## stdout: true

#### Regex quoted with single quotes
# bash doesn't like the quotes
[[ 'a b' =~ '^(a b)$' ]] && echo true
## stdout-json: ""
## status: 1
## OK zsh stdout: true
## OK zsh status: 0

#### Regex quoted with double quotes
# bash doesn't like the quotes
[[ 'a b' =~ "^(a b)$" ]] && echo true
## stdout-json: ""
## status: 1
## OK zsh stdout: true
## OK zsh status: 0

#### Fix single quotes by storing in variable
pat='^(a b)$'
[[ 'a b' =~ $pat ]] && echo true
## stdout: true

#### Fix single quotes by storing in variable
pat="^(a b)$"
[[ 'a b' =~ $pat ]] && echo true
## stdout: true

#### Double quoting pat variable -- again bash doesn't like it.
pat="^(a b)$"
[[ 'a b' =~ "$pat" ]] && echo true
## stdout-json: ""
## status: 1
## OK zsh stdout: true
## OK zsh status: 0

#### Mixing quoted and unquoted parts
[[ 'a b' =~ 'a 'b ]] && echo true
[[ "a b" =~ "a "'b' ]] && echo true
## STDOUT:
true
true
## END

#### Regex with == and not =~ is parse error, different lexer mode required
# They both give a syntax error.  This is lame.
[[ '^(a b)$' == ^(a\ b)$ ]] && echo true
## status: 2
## OK zsh status: 1

#### Omitting ( )
[[ '^a b$' == ^a\ b$ ]] && echo true
## stdout: true

#### Malformed regex
# Are they trying to PARSE the regex?  Do they feed the buffer directly to
# regcomp()?
[[ 'a b' =~ ^)a\ b($ ]] && echo true
## stdout-json: ""
## status: 2
## OK zsh status: 1

#### Regex with |
[[ 'bar' =~ foo|bar ]] && echo true
## stdout: true
## N-I zsh stdout-json: ""
## N-I zsh status: 1

#### Regex to match literal brackets []
# bash-completion relies on this, so we're making it match bash.
# zsh understandably differs.
[[ '[]' =~ \[\] ]] && echo true

# Another way to write this.
pat='\[\]'
[[ '[]' =~ $pat ]] && echo true
## STDOUT:
true
true
## END
## OK zsh STDOUT:
true
## END

#### Regex to match literals . ^ $ etc.
[[ 'x' =~ \. ]] || echo false
[[ '.' =~ \. ]] && echo true

[[ 'xx' =~ \^\$ ]] || echo false
[[ '^$' =~ \^\$ ]] && echo true

[[ 'xxx' =~ \+\*\? ]] || echo false
[[ '*+?' =~ \*\+\? ]] && echo true

[[ 'xx' =~ \{\} ]] || echo false
[[ '{}' =~ \{\} ]] && echo true
## STDOUT:
false
true
false
true
false
true
false
true
## END
## BUG zsh STDOUT:
true
false
false
false
## END
## BUG zsh status: 1

#### Unquoted { is a regex parse error
[[ { =~ { ]] && echo true
echo status=$?
## stdout-json: ""
## status: 2
## BUG bash STDOUT:
status=2
## END
## BUG bash status: 0
## BUG zsh STDOUT:
status=1
## END
## BUG zsh status: 0

#### Fatal error inside [[ =~ ]]

# zsh and osh are stricter than bash.  bash treats [[ like a command.

[[ a =~ $(( 1 / 0 )) ]]
echo status=$?
## stdout-json: ""
## status: 1
## BUG bash stdout: status=1
## BUG bash status: 0

#### Quoted { and +
[[ { =~ "{" ]] && echo 'yes {'
[[ + =~ "+" ]] && echo 'yes +'
[[ * =~ "*" ]] && echo 'yes *'
[[ ? =~ "?" ]] && echo 'yes ?'
[[ ^ =~ "^" ]] && echo 'yes ^'
[[ $ =~ "$" ]] && echo 'yes $'
[[ '(' =~ '(' ]] && echo 'yes ('
[[ ')' =~ ')' ]] && echo 'yes )'
[[ '|' =~ '|' ]] && echo 'yes |'
[[ '\' =~ '\' ]] && echo 'yes \'
echo ---

[[ . =~ "." ]] && echo 'yes .'
[[ z =~ "." ]] || echo 'no .'
echo ---

# This rule is weird but all shells agree.  I would expect that the - gets
# escaped?  It's an operator?  but it behaves like a-z.
[[ a =~ ["a-z"] ]]; echo "a $?"
[[ - =~ ["a-z"] ]]; echo "- $?"
[[ b =~ ['a-z'] ]]; echo "b $?"
[[ z =~ ['a-z'] ]]; echo "z $?"

echo status=$?
## STDOUT:
yes {
yes +
yes *
yes ?
yes ^
yes $
yes (
yes )
yes |
yes \
---
yes .
no .
---
a 0
- 1
b 0
z 0
status=0
## END
## N-I zsh STDOUT:
yes ^
yes $
yes )
yes |
---
yes .
---
a 0
- 1
b 0
z 0
status=0
## END

#### Escaped {
# from bash-completion
[[ '$PA' =~ ^(\$\{?)([A-Za-z0-9_]*)$ ]] && argv.py "${BASH_REMATCH[@]}"
## STDOUT:
['$PA', '$', 'PA']
## END
## BUG zsh stdout-json: ""
## BUG zsh status: 1

#### Escaped { stored in variable first
# from bash-completion
pat='^(\$\{?)([A-Za-z0-9_]*)$'
[[ '$PA' =~ $pat ]] && argv.py "${BASH_REMATCH[@]}"
## STDOUT:
['$PA', '$', 'PA']
## END
## BUG zsh STDOUT:
['']
## END

#### regex with ?
[[ 'c' =~ c? ]] && echo true
[[ '' =~ c? ]] && echo true
## STDOUT:
true
true
## END

#### regex with unprintable characters
# can't have nul byte

# This pattern has literal characters
pat=$'^[\x01\x02]+$'

[[ $'\x01\x02\x01' =~ $pat ]]; echo status=$?
[[ $'a\x01' =~ $pat ]]; echo status=$?

# NOTE: There doesn't appear to be any way to escape these!
pat2='^[\x01\x02]+$'

## STDOUT:
status=0
status=1
## END

#### pattern $f(x)  -- regression
f=fff
[[ fffx =~ $f(x) ]]
echo status=$?
[[ ffx =~ $f(x) ]]
echo status=$?
## STDOUT:
status=0
status=1
## END

#### pattern a=(1)
[[ a=x =~ a=(x) ]]
echo status=$?
[[ =x =~ a=(x) ]]
echo status=$?
## STDOUT:
status=0
status=1
## END
## BUG zsh status: 1
## BUG zsh STDOUT:
status=0
## END

#### pattern @f(x)
shopt -s parse_at
[[ @fx =~ @f(x) ]]
echo status=$?
[[ fx =~ @f(x) ]]
echo status=$?
## STDOUT:
status=0
status=1
## END


#### Bug: Nix idiom with closing ) next to pattern

if [[ ! (" ${params[*]} " =~ " -shared " || " ${params[*]} " =~ " -static ") ]]; then
  echo one
fi

# Reduced idiom
if [[ (foo =~ foo) ]]; then
  echo two
fi

## STDOUT:
one
two
## END

#### unquoted (a  b) as pattern, (a  b|c)

if [[ 'a  b' =~ (a  b) ]]; then
  echo one
fi

if [[ 'a b' =~ (a  b) ]]; then
  echo BAD
fi

if [[ 'a b' =~ (a b|c) ]]; then
  echo two
fi

# I think spaces are only allowed within ()

if [[ '  c' =~ (a|  c) ]]; then
  echo three
fi

## STDOUT:
one
two
three
## END

#### Multiple adjacent () groups
if [[ 'a-b-c-d' =~ a-(b|  >>)-c-( ;|[de])|ff|gg ]]; then
  argv.py "${BASH_REMATCH[@]}"
fi

if [[ ff =~ a-(b|  >>)-c-( ;|[de])|ff|gg ]]; then
  argv.py "${BASH_REMATCH[@]}"
fi

# empty group ()

if [[ zz =~ ([a-z]+)() ]]; then
  argv.py "${BASH_REMATCH[@]}"
fi

# nested empty group
if [[ zz =~ ([a-z]+)(()z) ]]; then
  argv.py "${BASH_REMATCH[@]}"
fi

## STDOUT:
['a-b-c-d', 'b', 'd']
['ff', '', '']
['zz', 'zz', '']
['zz', 'z', 'z', '']
## END

## BUG zsh status: 1
## BUG zsh STDOUT:
['']
['']
['']
['']
## END

#### unquoted [a  b] as pattern, [a  b|c]

$SH <<'EOF'
[[ a =~ [ab] ]] && echo yes
EOF
echo "[ab]=$?"

$SH <<'EOF'
[[ a =~ [a b] ]] && echo yes
EOF
echo "[a b]=$?"

$SH <<'EOF'
[[ a =~ ([a b]) ]] && echo yes
EOF
echo "[a b]=$?"

## STDOUT:
yes
[ab]=0
[a b]=2
yes
[a b]=0
## END

## OK zsh STDOUT:
yes
[ab]=0
[a b]=1
yes
[a b]=0
## END

#### c|a unquoted

if [[ a =~ c|a ]]; then
  echo one
fi

## STDOUT:
one
## END
## N-I zsh status: 1

#### Operator chars ; & but not |
# Hm semicolon is still an operator in bash
$SH <<'EOF'
[[ ';' =~ ; ]] && echo semi
EOF
echo semi=$?

$SH <<'EOF'
[[ ';' =~ (;) ]] && echo semi paren
EOF
echo semi paren=$?

echo

$SH <<'EOF'
[[ '&' =~ & ]] && echo amp
EOF
echo amp=$?

# Oh I guess this is not a bug?  regcomp doesn't reject this trivial regex?
$SH <<'EOF'
[[ '|' =~ | ]] && echo pipe1
[[ 'a' =~ | ]] && echo pipe2
EOF
echo pipe=$?

$SH <<'EOF'
[[ '|' =~ a| ]] && echo four
EOF
echo pipe=$?

# This is probably special because > operator is inside foo [[ a > b ]]
$SH <<'EOF'
[[ '<>' =~ <> ]] && echo angle
EOF
echo angle=$?

# Bug: OSH allowed this!
$SH <<'EOF'
[[ $'a\nb' =~ a
b ]] && echo newline
EOF
echo newline=$?

## STDOUT:
semi=2
semi paren
semi paren=0

amp=2
pipe1
pipe2
pipe=0
four
pipe=0
angle=2
newline=2
## END

## BUG zsh STDOUT:
semi=1
semi paren=1

amp=1
pipe=1
pipe=1
angle=1
newline=1
## END



#### Quotes '' "" $'' $"" in pattern

$SH <<'EOF'
[[ '|' =~ '|' ]] && echo sq
EOF
echo sq=$?

$SH <<'EOF'
[[ '|' =~ "|" ]] && echo dq
EOF
echo dq=$?

$SH <<'EOF'
[[ '|' =~ $'|' ]] && echo dollar-sq
EOF
echo dollar-sq=$?

$SH <<'EOF'
[[ '|' =~ $"|" ]] && echo dollar-dq
EOF
echo dollar-dq=$?

## STDOUT:
sq
sq=0
dq
dq=0
dollar-sq
dollar-sq=0
dollar-dq
dollar-dq=0
## END


#### Unicode in pattern

$SH <<'EOF'
[[ μ =~ μ ]] && echo mu
EOF
echo mu=$?

## STDOUT:
mu
mu=0
## END

#### Parse error with 2 words

if [[ a =~ c a ]]; then
  echo one
fi

## status: 2
## STDOUT:
## END

## BUG zsh status: 1
## BUG zsh STDOUT:
one
## END

#### make a lisp example

str='(hi)'
[[ "${str}" =~ ^^([][{}\(\)^@])|^(~@)|(\"(\\.|[^\\\"])*\")|^(;[^$'\n']*)|^([~\'\`])|^([^][ ~\`\'\";{}\(\)^@\,]+)|^[,]|^[[:space:]]+ ]]
echo status=$?

m=${BASH_REMATCH[0]}
echo m=$m

## STDOUT:
status=0
m=(
## END

## BUG zsh STDOUT:
status=1
m=
## END

#### Operators and space lose meaning inside ()
[[ '< >' =~ (< >) ]] && echo true
## stdout: true
## N-I zsh stdout-json: ""
## N-I zsh status: 1

