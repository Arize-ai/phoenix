## compare_shells: bash mksh zsh

# Test cases for the grammar.  It uses pidgin shell because we don't have a
# proper lexer in ANTLR (ANTLR's lexers don't have states anyway.)
#
# These tests should run under the normal shell.  But REAL shell tests won't
# run under the fake shells grammar/shell*.sh

## suite: disabled

#### Simple command
echo

#### Command with args
echo word word

#### Command with trailer
echo word word &

#### a & b
echo word_a & echo word_b

#### a & b &
echo word_a & echo word_b &

#### a && b 
echo word_a && echo word_b 

#### a || b 
echo word_a || echo word_b 

#### a && b || c
echo word_a && echo word_b || echo

#### Invalid token
;;
## status: 2

#### Filename Redirect
echo 2>filename

#### Append redirect
echo >>filename

#### Prefix redirect
<filename echo 

#### Var assignment
NAME=foo echo >>filename

#### Brace group
{ echo
  echo
}

#### Brace group on oneline
{ echo word_a; echo word_b; }

#### Subshell
(echo word_a; echo word_b;)

#### Command sub
#echo $(echo word_a; echo word_b;)
echo

#### Subshell on multiple lines
(echo
echo
echo
)

#### For loop
# TODO: need to add variables
for name in word_a word_b word_c
do
  echo word_x
  echo word_y
done

#### While loop with empty lines
while ! echo word_a
do

  echo word_b

  echo word_c

done

#### Until loop
until echo word_a
do
  echo word_b
  echo word_c
done

#### If
if echo
then
  echo
else
  echo
fi

#### If with then on same line
if echo; then
  echo
else
  echo
fi

#### If with then on same line missing semicolon
# My ANTLR parsers fail to flag this.  The 'else' keyword should be unexpected.
if echo then
  echo
else
  echo
fi
## status: 2

#### If on one line
if echo; then echo; else echo; fi

#### If pipe
if echo | echo word_b; then
  echo
else
  echo
fi


#### Empty case
case word_a in
esac

#### Case without last dsemi
case word_a in
  word_b) echo
esac

#### Case with last dsemi
case word_a in
  word_b) echo
    ;;
esac

#### Case with empty clauses
case word_a in
  word_b)
    ;;
  word_c)
esac

#### case item without ;; is not allowed
case word_a in
  word_a)
  word_b)
    echo
    ;;
esac
## status: 2


#### Case with last dsemi on same line
case word_a in
  word_b) echo ;;
esac

#### Case with 2 options
case word_a in
  word_b|word_c)
    echo word_d
    echo word_e
    ;;
  word_e)
    echo word_f
    ;;
esac

#### Case all on one line
case word_a in word_b) echo ;; word_c) echo ;; esac

#### Case all on one line without trailing ;;
case word_a in word_b) echo word_b;; word_c) echo word_c ;; esac

#### Case all on one line without trailing ;; or ;
# My ANTLR parsers don't fail here and they should.
case word_a in word_b) echo word_b;; word_c) echo word_c esac
## status: 2

#### case: Using ; instead of ;;
case word_a in
  word_a)
    ;
  word_b)
    echo
    ;;
esac
## status: 2


#### Function def
name_a() {
  echo word_a
  echo word_b
}

