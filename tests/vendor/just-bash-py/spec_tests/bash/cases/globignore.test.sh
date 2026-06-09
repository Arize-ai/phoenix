## oils_failures_allowed: 0
## compare_shells: bash
## legacy_tmp_dir: true

#### Don't glob flags on file system with GLOBIGNORE
touch _tmp/-n _tmp/zzzzz
cd _tmp
GLOBIGNORE=-*:zzzzz  # colon-separated pattern list
echo -* hello zzzz?
## STDOUT:
-* hello zzzz?
## END
## N-I dash/mksh/ash stdout-json: "hello zzzzz"
## status: 0

#### Ignore *.txt
touch one.md one.txt
mkdir -p foo
touch foo/{two.md,two.txt}
GLOBIGNORE=*.txt
echo *.* foo/*.*
## STDOUT:
one.md foo/two.md foo/two.txt
## END

#### Ignore ?.txt
touch {1,10}.txt
mkdir -p foo
touch foo/{2,20}.txt
GLOBIGNORE=?.txt
echo *.* foo/*.*
## STDOUT:
10.txt foo/2.txt foo/20.txt
## END

#### Ignore *.o:*.h
touch {hello.c,hello.h,hello.o,hello}
GLOBIGNORE=*.o:*.h
echo hello*
## STDOUT:
hello hello.c
## END

#### Ignore single file src/__main__.py
mkdir src
touch src/{__init__.py,__main__.py}
GLOBIGNORE='src/__init__.py'
echo src/*
## STDOUT:
src/__main__.py
## END

#### Ignore dirs dist/*:node_modules/*
mkdir {src,compose,dist,node_modules}
touch src/{a.js,b.js}
touch compose/{base.compose.yaml,dev.compose.yaml}
touch dist/index.js
touch node_modules/package.js
GLOBIGNORE=dist/*:node_modules/*
echo */*
## STDOUT:
compose/base.compose.yaml compose/dev.compose.yaml src/a.js src/b.js
## END

#### find files in subdirectory but not the ignored pattern
mkdir {dir1,dir2}
touch dir1/{a.txt,ignore.txt}
touch dir2/{a.txt,ignore.txt}
GLOBIGNORE=*/ignore*
echo */*
## STDOUT:
dir1/a.txt dir2/a.txt
## END

#### Ignore globs with char patterns like [!ab]
## SKIP (unimplementable): Test relies on clean directory (fails with leftover files)
rm -rf _tmp
touch {a,b,c,d,A,B,C,D}
GLOBIGNORE=*[ab]*
echo *
GLOBIGNORE=*[ABC]*
echo *
GLOBIGNORE=*[!ab]*
echo *
## STDOUT:
A B C D c d
D a b c d
a b
## END

#### Ignore globs with char classes like [[:alnum:]]
touch {_testing.py,pyproject.toml,20231114.log,.env}
touch 'has space.docx'
GLOBIGNORE=[[:alnum:]]*
echo *.*
GLOBIGNORE=[![:alnum:]]*
echo *.*
GLOBIGNORE=*[[:space:]]*
echo *.*
GLOBIGNORE=[[:digit:]_.]*
echo *.*
## STDOUT:
.env _testing.py
20231114.log has space.docx pyproject.toml
.env 20231114.log _testing.py pyproject.toml
has space.docx pyproject.toml
## END

#### Ignore *
# This pattern appears in public repositories
touch {1.txt,2.log,3.md}
GLOBIGNORE=*
echo *
## STDOUT:
*
## END

#### treat escaped patterns literally
touch {escape-10.txt,escape*.txt}
GLOBIGNORE="escape\*.txt"
echo *.*
## STDOUT:
escape-10.txt
## END

#### resetting globignore reverts to default behaviour
touch reset.txt
GLOBIGNORE=*.txt
echo *.*
GLOBIGNORE=
echo *.*
## STDOUT:
*.*
reset.txt
## END

#### Ignore .:..
# globskipdots is enabled by default in bash >=5.2
# for bash <5.2 this pattern is a common way to match dotfiles but not . or ..
shopt -u globskipdots
touch .env
GLOBIGNORE=.:..
echo .*
GLOBIGNORE=
echo .* | sort
## STDOUT:
.env
. .. .env
## END

#### Quoting GLOBIGNORE
# each style of "ignore everything" spotted in a public repo
touch image.jpeg
GLOBIGNORE=*
echo *
GLOBIGNORE='*'
echo *
GLOBIGNORE="*"
echo *
GLOBIGNORE=\*
echo *
## STDOUT:
*
*
*
*
## END

#### . and .. always filtered when GLOBIGNORE is set
# When GLOBIGNORE is set to any non-null value, . and .. are always filtered
touch .hidden
GLOBIGNORE=*.txt

echo .*
shopt -u globskipdots
echo .*

## STDOUT:
.hidden
.hidden
## END

#### When GLOBIGNORE is set, glob may become empty (nullglob too)
touch -- foo.txt -foo.txt

echo *t

GLOBIGNORE=*.txt
echo *t

shopt -s nullglob
echo nullglob *t

## STDOUT:
-foo.txt foo.txt
*t
nullglob
## END

#### When GLOBIGNORE is set, no_dash_glob isn't respected
case $SH in bash) exit ;; esac

touch -- foo.txt -foo.txt

shopt -s no_dash_glob  # YSH option

echo *  # expansion does NOT include -foo.txt

GLOBIGNORE=f*.txt
echo *  # expansion includes -foo.txt, because it doesn't match GLOBIGNORE

## STDOUT:
_tmp foo.txt
-foo.txt _tmp
## END
## N-I bash STDOUT:
## END

#### Extended glob expansion combined with GLOBIGNORE
shopt -s extglob

touch foo.cc foo.h bar.cc bar.h 
echo @(*.cc|*.h)
GLOBIGNORE=foo.*
echo @(*.cc|*.h)

## STDOUT:
bar.cc bar.h foo.cc foo.h
bar.cc bar.h
## END
