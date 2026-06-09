# spec/interactive-parse


## suite: disabled
## compare_shells: bash dash mksh

#### parse if
## SKIP (unimplementable): Interactive shell invocation not implemented

case $SH in zsh) exit ;; esac

export PS1='[PS1]'

echo 'if true
then
  echo hi
fi' | $SH -i

if test -z "$OILS_VERSION"; then
  echo '^D'  # fudge
fi

## STDOUT:
hi
^D
## END

## stderr-json: "[PS1]> > > [PS1]"

# hm somehow bash prints it more nicely; code is echo'd to stderr

## OK bash STDERR:
[PS1]if true
> then
>   echo hi
> fi
[PS1]exit
## END
