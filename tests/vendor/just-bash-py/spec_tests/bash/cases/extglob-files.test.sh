## oils_failures_allowed: 1
## compare_shells: bash mksh


# Extended globs are an OPTION in bash, but not mksh (because the feature
# originated in ksh).
#
# However all extended globs are syntax errors if shopt -s extglob isn't set.
# In Oils, they are not PARSE TIME errors, but the syntax won't be respected at
# RUNTIME, i.e. when passed to fnmatch().
#
# GNU libc has the FNM_EXTMATCH extension to fnmatch().  (I don't think musl
# libc has it.)  However, this came after all popular shells were implemented!
# I don't think any shell uses it, but we're taking advantage of it.
#
# Extended glob syntax is ugly, but I guess it's handy because it's similar to
# *.[ch]... but the extensions can be different length: *.@(cc|h)
# It's also used for negation like
#
#   cp !(_*) /tmp
#
# I tend to use 'find', but this is a shorter syntax.

# From the bash manual:

# "In addition to the traditional globs (supported by all Bourne-family shells)
# that we've seen so far, Bash (and Korn Shell) offers extended globs, which
# have the expressive power of regular expressions. Korn shell enables these by
# default; in Bash, you must run the command "

# ?(pattern-list): Matches empty or one of the patterns
# *(pattern-list): Matches empty or any number of occurrences of the patterns
# +(pattern-list): Matches at least one occurrences of the patterns
# @(pattern-list): Matches exactly one of the patterns
# !(pattern-list): Matches anything EXCEPT any of the patterns

#### @() matches exactly one of the patterns
shopt -s extglob
mkdir -p 0
cd 0
touch {foo,bar}.cc {foo,bar,baz}.h
echo @(*.cc|*.h)
## stdout: bar.cc bar.h baz.h foo.cc foo.h

#### ?() matches 0 or 1
shopt -s extglob
mkdir -p 1
cd 1
touch {foo,bar}.cc {foo,bar,baz}.h foo. foo.hh
ext=cc
echo foo.?($ext|h)
## stdout: foo. foo.cc foo.h

#### *() matches 0 or more
shopt -s extglob
mkdir -p eg1
touch eg1/_ eg1/_One eg1/_OneOne eg1/_TwoTwo eg1/_OneTwo
echo eg1/_*(One|Two)
## stdout: eg1/_ eg1/_One eg1/_OneOne eg1/_OneTwo eg1/_TwoTwo

#### +() matches 1 or more
shopt -s extglob
mkdir -p eg2
touch eg2/_ eg2/_One eg2/_OneOne eg2/_TwoTwo eg2/_OneTwo
echo eg2/_+(One|$(echo Two))
## stdout: eg2/_One eg2/_OneOne eg2/_OneTwo eg2/_TwoTwo

#### !(*.h|*.cc) to match everything except C++
shopt -s extglob
mkdir -p extglob2
touch extglob2/{foo,bar}.cc extglob2/{foo,bar,baz}.h \
      extglob2/{foo,bar,baz}.py
echo extglob2/!(*.h|*.cc)
## stdout: extglob2/bar.py extglob2/baz.py extglob2/foo.py

#### Two adjacent alternations
shopt -s extglob
mkdir -p 2
touch 2/{aa,ab,ac,ba,bb,bc,ca,cb,cc}
echo 2/!(b)@(b|c)
echo 2/!(b)?@(b|c)  # wildcard in between
echo 2/!(b)a@(b|c)  # constant in between
## STDOUT:
2/ab 2/ac 2/cb 2/cc
2/ab 2/ac 2/bb 2/bc 2/cb 2/cc
2/ab 2/ac
## END

#### Nested extended glob pattern 
shopt -s extglob
mkdir -p eg6
touch eg6/{ab,ac,ad,az,bc,bd}
echo eg6/a@(!(c|d))
echo eg6/a!(@(ab|b*))
## STDOUT:
eg6/ab eg6/az
eg6/ac eg6/ad eg6/az
## END

#### Extended glob patterns with spaces
shopt -s extglob
mkdir -p eg4
touch eg4/a 'eg4/a b' eg4/foo
argv.py eg4/@(a b|foo)
## STDOUT:
['eg4/a b', 'eg4/foo']
## END

#### Filenames with spaces
shopt -s extglob
mkdir -p eg5
touch eg5/'a b'{cd,de,ef}
argv.py eg5/'a '@(bcd|bde|zzz)
## STDOUT:
['eg5/a bcd', 'eg5/a bde']
## END

#### nullglob with extended glob
shopt -s extglob
mkdir eg6
argv.py eg6/@(no|matches)  # no matches
shopt -s nullglob  # test this too
argv.py eg6/@(no|matches)  # no matches
## STDOUT:
['eg6/@(no|matches)']
[]
## END
## BUG mksh STDOUT:
['eg6/@(no|matches)']
['eg6/@(no|matches)']
## END

#### Glob other punctuation chars (lexer mode)
shopt -s extglob
mkdir -p eg5
cd eg5
touch __{aa,'<>','{}','#','&&'}
argv.py @(__aa|'__<>'|__{}|__#|__&&|)

# mksh sorts them differently
## STDOUT:
['__#', '__&&', '__<>', '__aa', '__{}']
## END

#### More glob escaping
shopt -s extglob
mkdir -p eg7
cd eg7
touch '_[:]' '_*' '_?'
argv.py @('_[:]'|'_*'|'_?')
argv.py @(nested|'_?'|@('_[:]'|'_*'))

# mksh sorts them differently
## STDOUT:
['_*', '_?', '_[:]']
['_*', '_?', '_[:]']
## END

#### Escaping of pipe (glibc bug, see demo/glibc_fnmatch.c)
shopt -s extglob

mkdir -p extpipe
cd extpipe

touch '__|' foo
argv.py @('foo'|__\||bar)
argv.py @('foo'|'__|'|bar)

## STDOUT:
['__|', 'foo']
['__|', 'foo']
## END

#### Extended glob as argument to ${undef:-} (dynamic globbing)

# This case popped into my mind after inspecting osh/word_eval.py for calls to
# _EvalWordToParts()

shopt -s extglob

mkdir -p eg8
cd eg8
touch {foo,bar,spam}.py

# regular glob
echo ${undef:-*.py}

# extended glob
echo ${undef:-@(foo|bar).py}

## STDOUT:
bar.py foo.py spam.py
bar.py foo.py
## END
## OK mksh STDOUT:
bar.py foo.py spam.py
@(foo|bar).py
## END
## OK osh status: 1
## OK osh STDOUT:
bar.py foo.py spam.py
## END

#### Extended glob in assignment builtin

# Another invocation of _EvalWordToParts() that OSH should handle

shopt -s extglob
mkdir -p eg9
cd eg9
touch {foo,bar}.py
typeset -@(*.py) myvar
echo status=$?
## STDOUT:
status=2
## END
## OK mksh STDOUT:
status=1
## END
## OK osh status: 1
## OK osh STDOUT:
## END

#### Extended glob in same word as array
shopt -s extglob
mkdir -p eg10
cd eg10

touch {'a b c',bee,cee}.{py,cc}
set -- 'a b' 'c'

argv.py "$@"

# This works!
argv.py star glob "$*"*.py
argv.py star extglob "$*"*@(.py|cc)

# Hm this actually still works!  the first two parts are literal.  And then
# there's something like the simple_word_eval algorithm on the rest.  Gah.
argv.py at extglob "$@"*@(.py|cc)

## STDOUT:
['a b', 'c']
['star', 'glob', 'a b c.py']
['star', 'extglob', 'a b c.cc', 'a b c.py']
['at', 'extglob', 'a b', 'cee.cc', 'cee.py']
## END
## N-I osh STDOUT:
['a b', 'c']
['star', 'glob', 'a b c.py']
['star', 'extglob', 'a b c.cc', 'a b c.py']
## END
## N-I osh status: 1

#### Extended glob with word splitting
shopt -s extglob
mkdir -p 3
cd 3

x='a b'
touch bar.{cc,h}

# OSH may disallow splitting when there's an extended glob
argv.py $x*.@(cc|h)

## STDOUT:
['a', 'bar.cc', 'bar.h']
## END
## N-I osh STDOUT:
['a b*.@(cc|h)']
## END

#### In Array Literal and for loop
shopt -s extglob
mkdir -p eg11
cd eg11
touch {foo,bar,spam}.py
for x in @(fo*|bar).py; do
  echo $x
done

echo ---
declare -a A
A=(zzz @(fo*|bar).py)
echo "${A[@]}"
## STDOUT:
bar.py
foo.py
---
zzz bar.py foo.py
## END

#### No extended glob with simple_word_eval (YSH evaluation)
shopt -s ysh:all
shopt -s extglob
mkdir -p eg12
cd eg12
touch {foo,bar,spam}.py
builtin write -- x@(fo*|bar).py
builtin write -- @(fo*|bar).py
## status: 1
## STDOUT:
## END

#### no match
shopt -s extglob
echo @(__nope__)

# OSH has glob quoting here
echo @(__nope__*|__nope__?|'*'|'?'|'[:alpha:]'|'|')

## STDOUT:
@(__nope__)
@(__nope__*|__nope__?|*|?|[:alpha:]||)
## END

#### no_dash_glob
## SKIP (unimplementable): no_dash_glob is a YSH-specific shopt option
shopt -s extglob
mkdir -p opts
cd opts

touch -- foo bar -dash
echo @(*)

shopt --set no_dash_glob
echo @(*)


## STDOUT:
-dash bar foo
bar foo
## END
## N-I bash/mksh STDOUT:
-dash bar foo
-dash bar foo
## END

#### noglob
shopt -s extglob
mkdir -p _noglob
cd _noglob

set -o noglob
echo @(*)
echo @(__nope__*|__nope__?|'*'|'?'|'[:alpha:]'|'|')

## STDOUT:
@(*)
@(__nope__*|__nope__?|*|?|[:alpha:]||)
## END

#### failglob
shopt -s extglob

rm -f _failglob/*
mkdir -p _failglob
cd _failglob

shopt -s failglob
echo @(*)
echo status=$?

touch foo
echo @(*)
echo status=$?

## STDOUT:
status=1
foo
status=0
## END
## N-I mksh STDOUT:
@(*)
status=0
foo
status=0
## END
