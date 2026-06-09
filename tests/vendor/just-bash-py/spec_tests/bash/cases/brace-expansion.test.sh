## compare_shells: bash mksh zsh
## oils_failures_allowed: 0

#### no expansion
echo {foo}
## stdout: {foo}

#### incomplete trailing expansion
echo {a,b}_{
## stdout: a_{ b_{
## OK osh stdout: {a,b}_{

#### partial leading expansion
echo }_{a,b}
## stdout: }_a }_b
## OK osh stdout: }_{a,b}

#### partial leading expansion 2
echo {x}_{a,b}
## stdout: {x}_a {x}_b

#### } in expansion
# hm they treat this the SAME.  Leftmost { is matched by first }, and then
# there is another } as the postfix.
echo {a,b}}
## stdout: a} b}
## status: 0
## OK osh stdout: {a,b}}
## OK zsh stdout-json: ""
## OK zsh status: 1

#### single expansion
echo {foo,bar}
## stdout: foo bar

#### double expansion
echo {a,b}_{c,d}
## stdout: a_c a_d b_c b_d

#### triple expansion
echo {0,1}{0,1}{0,1}
## stdout: 000 001 010 011 100 101 110 111

#### double expansion with single and double quotes
echo {'a',b}_{c,"d"}
## stdout: a_c a_d b_c b_d

#### expansion with mixed quotes
echo -{\X"b",'cd'}-
## stdout: -Xb- -cd-

#### expansion with simple var
a=A
echo -{$a,b}-
## stdout: -A- -b-

#### double expansion with simple var -- bash bug
# bash is inconsistent with the above
a=A
echo {$a,b}_{c,d}
## stdout: A_c A_d b_c b_d
## BUG bash stdout: b_c b_d

#### double expansion with braced variable
# This fixes it
a=A
echo {${a},b}_{c,d}
## stdout: A_c A_d b_c b_d

#### double expansion with literal and simple var
a=A
echo {_$a,b}_{c,d}
## stdout: _A_c _A_d b_c b_d
## BUG bash stdout: _ _ b_c b_d

#### expansion with command sub
a=A
echo -{$(echo a),b}-
## stdout: -a- -b-

#### expansion with arith sub
a=A
echo -{$((1 + 2)),b}-
## stdout: -3- -b-

#### double expansion with escaped literals
a=A
echo -{\$,\[,\]}-
## stdout: -$- -[- -]-

#### { in expansion
# bash and mksh treat this differently.  bash treats the
# first { is a prefix.  I think it's harder to read, and \{{a,b} should be
# required.
echo {{a,b}
## stdout: {{a,b}
## BUG bash/zsh stdout: {a {b

#### quoted { in expansion
echo \{{a,b}
## stdout: {a {b

#### Empty expansion
echo a{X,,Y}b
## stdout: aXb ab aYb

#### Empty alternative
# zsh and mksh don't do word elision, probably because they do brace expansion
# AFTER variable substitution.
argv.py {X,,Y,}
## stdout: ['X', 'Y']
## OK mksh/zsh stdout: ['X', '', 'Y', '']
## status: 0

#### Empty alternative with empty string suffix
# zsh and mksh don't do word elision, probably because they do brace expansion
# AFTER variable substitution.
argv.py {X,,Y,}''
## stdout: ['X', '', 'Y', '']
## status: 0

#### nested brace expansion
echo -{A,={a,b}=,B}-
## stdout: -A- -=a=- -=b=- -B-

#### triple nested brace expansion
echo -{A,={a,.{x,y}.,b}=,B}-
## stdout: -A- -=a=- -=.x.=- -=.y.=- -=b=- -B-

#### nested and double brace expansion
echo -{A,={a,b}{c,d}=,B}-
## stdout: -A- -=ac=- -=ad=- -=bc=- -=bd=- -B-

#### expansion on RHS of assignment
# I think bash's behavior is more consistent.  No splitting either.
v={X,Y}
echo $v
## stdout: {X,Y}
## BUG mksh stdout: X Y

#### no expansion with RHS assignment
{v,x}=X
## status: 127
## stdout-json: ""
## OK zsh status: 1

#### Tilde expansion
HOME=/home/foo
echo ~
HOME=/home/bar
echo ~
## STDOUT:
/home/foo
/home/bar
## END

#### Tilde expansion with brace expansion

# The brace expansion happens FIRST.  After that, the second token has tilde
# FIRST, so it gets expanded.  The first token has an unexpanded tilde, because
# it's not in the leading position.

HOME=/home/bob

# Command

echo {foo~,~}/bar

# Loop

for x in {foo~,~}/bar; do
  echo -- $x
done

# Array

a=({foo~,~}/bar)

for y in "${a[@]}"; do
  echo "== $y"
done

## STDOUT:
foo~/bar /home/bob/bar
-- foo~/bar
-- /home/bob/bar
== foo~/bar
== /home/bob/bar
## END

## BUG mksh STDOUT:
foo~/bar ~/bar
-- foo~/bar
-- ~/bar
== foo~/bar
== ~/bar
## END

#### Two kinds of tilde expansion

HOME=/home/bob

# Command
echo ~{/src,root}

# Loop

for x in ~{/src,root}; do
  echo -- $x
done

# Array

a=(~{/src,root})

for y in "${a[@]}"; do
  echo "== $y"
done

## STDOUT:
/home/bob/src /root
-- /home/bob/src
-- /root
== /home/bob/src
== /root
## END

## BUG mksh STDOUT:
~/src ~root
-- ~/src
-- ~root
== ~/src
== ~root
## END

#### Tilde expansion come before var expansion
HOME=/home/bob
foo=~
echo $foo
foo='~'
echo $foo
# In the second instance, we expand into a literal ~, and since var expansion
# comes after tilde expansion, it is NOT tried again.
## STDOUT:
/home/bob
~
## END

#### Number range expansion
echo -{1..8..3}-
echo -{1..10..3}-
## STDOUT:
-1- -4- -7-
-1- -4- -7- -10-
## N-I mksh STDOUT:
-{1..8..3}-
-{1..10..3}-
## END

#### Ascending number range expansion with negative step is invalid
echo -{1..8..-3}-
## stdout-json: ""
## status: 2
## BUG bash stdout: -1- -4- -7-
## BUG zsh stdout: -7- -4- -1-
## BUG bash/zsh status: 0
## N-I mksh stdout: -{1..8..-3}-
## N-I mksh status: 0

#### regression: -1 step disallowed
echo -{1..4..-1}-
## stdout-json: ""
## status: 2
## BUG bash stdout: -1- -2- -3- -4-
## BUG zsh stdout: -4- -3- -2- -1-
## BUG bash/zsh status: 0
## N-I mksh stdout: -{1..4..-1}-
## N-I mksh status: 0

#### regression: 0 step disallowed
echo -{1..4..0}-
## stdout-json: ""
## status: 2
## BUG bash stdout: -1- -2- -3- -4-
## BUG zsh stdout: -1..4..0-
## BUG bash/zsh status: 0
## N-I mksh stdout: -{1..4..0}-
## N-I mksh status: 0

#### Descending number range expansion with positive step is invalid
echo -{8..1..3}-
## stdout-json: ""
## status: 2
## BUG bash/zsh stdout: -8- -5- -2-
## BUG bash/zsh status: 0
## N-I mksh stdout: -{8..1..3}-
## N-I mksh status: 0

#### Descending number range expansion with negative step
echo -{8..1..-3}-
## stdout: -8- -5- -2-
# zsh behavior seems clearly wrong!
## BUG zsh stdout: -2- -5- -8-
## N-I mksh stdout: -{8..1..-3}-

#### Singleton ranges
echo {1..1}-
echo {-9..-9}-
echo {-9..-9..3}-
echo {-9..-9..-3}-
echo {a..a}-
## STDOUT:
1-
-9-
-9-
-9-
a-
## END
## N-I mksh STDOUT:
{1..1}-
{-9..-9}-
{-9..-9..3}-
{-9..-9..-3}-
{a..a}-
## END

#### Singleton char ranges with steps
echo {a..a..2}-
echo {a..a..-2}-
## STDOUT:
a-
a-
## END
# zsh is considered buggy because it implements {a..a} but not {a..a..1} !
## BUG zsh STDOUT:
{a..a..2}-
{a..a..-2}-
## END
## N-I mksh STDOUT:
{a..a..2}-
{a..a..-2}-
## END

#### Char range expansion
echo -{a..e}-
## stdout: -a- -b- -c- -d- -e-
## N-I mksh stdout: -{a..e}-

#### Char range expansion with step
echo -{a..e..2}-
## stdout: -a- -c- -e-
## N-I mksh/zsh stdout: -{a..e..2}-

#### Char ranges with steps of the wrong sign
echo -{a..e..-2}-
echo -{e..a..2}-
## stdout-json: ""
## status: 2
## BUG bash STDOUT:
-a- -c- -e-
-e- -c- -a-
## END
## BUG bash status: 0
## N-I mksh/zsh STDOUT:
-{a..e..-2}-
-{e..a..2}-
## END
## N-I mksh/zsh status: 0

#### Mixed case char expansion is invalid
case $SH in *zsh) echo BUG; exit ;; esac
echo -{z..A}-
echo -{z..A..2}-
## stdout-json: ""
## status: 2
## OK mksh STDOUT:
-{z..A}-
-{z..A..2}-
## END
## OK mksh status: 0
## BUG zsh stdout: BUG
## BUG zsh status: 0
# This is exposed a weird bash bug!!!
## BUG bash stdout-json: ""
## BUG bash status: 1

#### Descending char range expansion
echo -{e..a..-2}-
## stdout: -e- -c- -a-
## N-I mksh/zsh stdout: -{e..a..-2}-

#### Fixed width number range expansion
echo -{01..03}-
echo -{09..12}-  # doesn't become -012-, fixed width
echo -{12..07}-
## STDOUT:
-01- -02- -03-
-09- -10- -11- -12-
-12- -11- -10- -09- -08- -07-
## END
## N-I mksh STDOUT:
-{01..03}-
-{09..12}-
-{12..07}-
## END

#### Inconsistent fixed width number range expansion
# zsh uses the first one, bash uses the max width?
echo -{01..003}-
## stdout: -001- -002- -003-
## OK zsh stdout: -01- -02- -03-
## N-I mksh stdout: -{01..003}-

#### Inconsistent fixed width number range expansion
# zsh uses the first width, bash uses the max width?
echo -{01..3}-
## stdout: -01- -02- -03-
## N-I mksh stdout: -{01..3}-

#### Adjacent comma and range works
echo -{a,b}{1..3}-
## STDOUT:
-a1- -a2- -a3- -b1- -b2- -b3-
## END
## N-I mksh STDOUT:
-a{1..3}- -b{1..3}-
## END

#### Range inside comma works
echo -{a,_{1..3}_,b}-
## STDOUT:
-a- -_1_- -_2_- -_3_- -b-
## END
## N-I mksh STDOUT:
-a- -_{1..3}_- -b-
## END

#### Mixed comma and range doesn't work
echo -{a,b,1..3}-
## STDOUT:
-a- -b- -1..3-
## END

#### comma and invalid range (adjacent and nested)
echo -{a,b}{1...3}-
echo -{a,{1...3}}-
echo {a,b}{}
## STDOUT:
-a{1...3}- -b{1...3}-
-a- -{1...3}-
a{} b{}
## END
# osh doesn't expand ANYTHING on invalid syntax.  That's OK because of the test
# case below.
## OK osh STDOUT:
-{a,b}{1...3}-
-{a,{1...3}}-
{a,b}{}
## END

#### OSH provides an alternative to invalid syntax
echo -{a,b}\{1...3\}-
echo -{a,\{1...3\}}-
echo {a,b}\{\}
## STDOUT:
-a{1...3}- -b{1...3}-
-a- -{1...3}-
a{} b{}
## END

#### Side effect in expansion
# bash is the only one that does it first.  I guess since this is
# non-POSIX anyway, follow bash?
i=0
echo {a,b,c}-$((i++))
## stdout: a-0 b-1 c-2
## OK mksh/zsh stdout: a-0 b-0 c-0

#### Invalid brace expansions don't expand
echo {1.3}
echo {1...3}
echo {1__3}
## STDOUT:
{1.3}
{1...3}
{1__3}
## END

#### Invalid brace expansions mixing characters and numbers
# zsh does something crazy like : ; < = > that I'm not writing
case $SH in *zsh) echo BUG; exit ;; esac
echo {1..a}
echo {z..3}
## STDOUT:
{1..a}
{z..3}
## END
## BUG zsh STDOUT:
BUG
## END
