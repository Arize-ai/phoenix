## compare_shells: dash bash mksh zsh ash

#### Parsing shell words \r \v
## SKIP (unimplementable): Interactive shell invocation not implemented

# frontend/lexer_def.py has rules for this

tab=$(python2 -c 'print "argv.py -\t-"')
cr=$(python2 -c 'print "argv.py -\r-"')
vert=$(python2 -c 'print "argv.py -\v-"')
ff=$(python2 -c 'print "argv.py -\f-"')

$SH -c "$tab"
$SH -c "$cr"
$SH -c "$vert"
$SH -c "$ff"

## STDOUT:
['-', '-']
['-\r-']
['-\x0b-']
['-\x0c-']
## END

#### \r in arith expression is allowed by some shells, but not most!
## SKIP (unimplementable): Interactive shell invocation not implemented

arith=$(python2 -c 'print "argv.py $(( 1 +\n2))"')
arith_cr=$(python2 -c 'print "argv.py $(( 1 +\r\n2))"')

$SH -c "$arith"
if test $? -ne 0; then
  echo 'failed'
fi

$SH -c "$arith_cr"
if test $? -ne 0; then
  echo 'failed'
fi

## STDOUT:
['3']
failed
## END

## OK mksh/ash/osh STDOUT:
['3']
['3']
## END

#### whitespace in string to integer conversion
## SKIP (unimplementable): Interactive shell invocation not implemented

tab=$(python2 -c 'print "\t42\t"')
cr=$(python2 -c 'print "\r42\r"')

$SH -c 'echo $(( $1 + 1 ))' dummy0 "$tab"
if test $? -ne 0; then
  echo 'failed'
fi

$SH -c 'echo $(( $1 + 1 ))' dummy0 "$cr"
if test $? -ne 0; then
  echo 'failed'
fi

## STDOUT:
43
failed
## END

## OK mksh/ash/osh STDOUT:
43
43
## END

#### \r at end of line is not special
## SKIP (unimplementable): Interactive shell invocation not implemented

# hm I wonder if Windows ports have rules for this?

cr=$(python2 -c 'print "argv.py -\r"')

$SH -c "$cr"

## STDOUT:
['-\r']
## END

#### Default IFS does not include \r \v \f
## SKIP (unimplementable): Interactive shell invocation not implemented

# dash and zsh don't have echo -e
tab=$(python2 -c 'print "-\t-"')
cr=$(python2 -c 'print "-\r-"')
vert=$(python2 -c 'print "-\v-"')
ff=$(python2 -c 'print "-\f-"')

$SH -c 'argv.py $1' dummy0 "$tab"
$SH -c 'argv.py $1' dummy0 "$cr"
$SH -c 'argv.py $1' dummy0 "$vert"
$SH -c 'argv.py $1' dummy0 "$ff"

## STDOUT:
['-', '-']
['-\r-']
['-\x0b-']
['-\x0c-']
## END

# No word splitting in zsh

## OK zsh STDOUT:
['-\t-']
['-\r-']
['-\x0b-']
['-\x0c-']
## END

