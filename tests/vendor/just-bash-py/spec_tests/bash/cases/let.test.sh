## compare_shells: bash mksh zsh
## our_shell: -

#### let
# NOTE: no spaces are allowed.  How is this tokenized?
let x=1
let y=x+2
let z=y*3  # zsh treats this as a glob; bash doesn't
let z2='y*3'  # both are OK with this
echo $x $y $z $z2
## stdout: 1 3 9 9
## OK zsh stdout-json: ""
## OK zsh status: 1

#### let with ()
let x=( 1 )
let y=( x + 2 )
let z=( y * 3 )
echo $x $y $z
## stdout: 1 3 9
## status: 0
## N-I mksh/zsh stdout-json: ""
## N-I mksh/zsh status: 1
