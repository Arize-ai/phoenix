# Snippets from http://landley.net/notes.html

## oils_failures_allowed: 3
## compare_shells: bash mksh

#### @Q
# http://landley.net/notes.html#24-06-2020

# Fix these
case $SH in dash|mksh|zsh) exit ;; esac

xx() { echo "${*@Q}";}; xx a b c d
xx() { echo "${@@Q}";}; xx a b c d
## STDOUT:
'a' 'b' 'c' 'd'
'a' 'b' 'c' 'd'
## END
## OK osh STDOUT:
a b c d
a b c d
## END
## N-I dash/mksh/zsh stdout-json: ""

#### extglob $IFS 1
# http://landley.net/notes.html#12-06-2020
shopt -s extglob

touch abc\)d
echo ab+(c?d)

IFS=c ABC="c?d"
echo ab+($ABC)

ABC='*'
echo $ABC

## STDOUT:
abc)d
ab+( ?d)
abc)d
## END
## OK mksh STDOUT:
abc)d
ab+(  ?d)
abc)d
## END

#### extglob $IFS 2
# http://landley.net/notes.html#17-05-2020

shopt -s extglob  # required for bash, not osh
IFS=x; ABC=cxd; for i in +($ABC); do echo =$i=; done

## STDOUT:
=+(c=
=d)=
## END

#### char class / extglob
## SKIP (unimplementable): Bracket expression with extglob requires complex parser changes to handle ambiguous syntax like [+()] where bracket and extglob patterns interact
# http://landley.net/notes.html#14-05-2020
shopt -s extglob

touch l; echo [hello"]"

touch b
echo [$(echo abc)]

touch +
echo [+()]
echo [+(])
## STDOUT:
[hello]
b
+
[+(])
## END
## BUG mksh STDOUT:
[hello]
b
[+()]
[+(])
## END

#### patsub of $* - http://landley.net/notes.html#23-04-2020
chicken() { echo ${*/b c/ghi}; }; chicken a b c d
## STDOUT:
a b c d
## END
## BUG mksh stdout-json: ""
## BUG mksh status: 1


#### Brace Expansion
# http://landley.net/notes.html#04-01-2020

HOME=/home/foo

echo {~,~root}/pwd
echo \{~,~root}/pwd
echo ""{~,~root}/pwd

## STDOUT:
/home/foo/pwd /root/pwd
{~,~root}/pwd
~/pwd ~root/pwd
## END
## OK mksh STDOUT:
~/pwd ~root/pwd
{~,~root}/pwd
~/pwd ~root/pwd
## END

#### {abc}<<< - http://landley.net/notes-2019.html#09-12-2019
{ echo; } {abc}<<< walrus
cat <&$abc
## STDOUT:

walrus
## END
## N-I mksh stdout-json: ""
## N-I mksh status: 1

#### slice of @ and @ - http://landley.net/notes.html#23-04-2020
IFS=x; X=x; eval abc=a${X}b

chicken() { for i in "${@:3:5}"; do echo =$i=; done; } ; chicken ab cd ef gh ij kl mn op qr

chicken() { for i in "${*:3:5}"; do echo =$i=; done; } ; chicken ab cd ef gh ij kl mn op qr

## STDOUT:
=ef=
=gh=
=ij=
=kl=
=mn=
=ef gh ij kl mn=
## END
## N-I mksh stdout-json: ""
## N-I mksh status: 1

