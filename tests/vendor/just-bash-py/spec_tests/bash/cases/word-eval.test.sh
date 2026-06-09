## compare_shells: dash bash mksh

# word-eval.test.sh: Test the word evaluation pipeline in order.
#
# Part evaluation, splitting, joining, elision, globbing.

# TODO: Rename word-eval-smoke.test.sh?
# Word sequence evaluation.
# This is more like a vertical slice.  For exhaustive tests, see:
# 
# word-split.test.sh (perhaps rename word-reframe?)
# glob.test.sh

#### Evaluation of constant parts
argv.py bare 'sq'
## stdout: ['bare', 'sq']

#### Evaluation of each part
#set -o noglob
HOME=/home/bob
str=s
array=(a1 a2)
argv.py bare 'sq' ~ $str "-${str}-" "${array[@]}" $((1+2)) $(echo c) `echo c`
## stdout: ['bare', 'sq', '/home/bob', 's', '-s-', 'a1', 'a2', '3', 'c', 'c']
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Word splitting
s1='1 2'
s2='3 4'
s3='5 6'
argv.py $s1$s2 "$s3"
## stdout: ['1', '23', '4', '5 6']

#### Word joining
set -- x y z
s1='1 2'
array=(a1 a2)
argv.py $s1"${array[@]}"_"$@"
## stdout: ['1', '2a1', 'a2_x', 'y', 'z']
## N-I dash stdout-json: ""
## N-I dash status: 2

#### Word elision
s1=''
argv.py $s1 - "$s1"
## stdout: ['-', '']

#### Default values -- more cases
argv.py ${undef:-hi} ${undef:-'a b'} "${undef:-c d}" "${un:-"e f"}" "${un:-'g h'}"
## stdout: ['hi', 'a b', 'c d', 'e f', "'g h'"]

#### Globbing after splitting
mkdir -p _tmp
touch _tmp/foo.gg _tmp/bar.gg _tmp/foo.hh
pat='_tmp/*.hh _tmp/*.gg'
argv.py $pat
## stdout: ['_tmp/foo.hh', '_tmp/bar.gg', '_tmp/foo.gg']

#### Globbing escaping
mkdir -p _tmp
touch '_tmp/[bc]ar.mm' # file that looks like a glob pattern
touch _tmp/bar.mm _tmp/car.mm
argv.py '_tmp/[bc]'*.mm - _tmp/?ar.mm
## stdout: ['_tmp/[bc]ar.mm', '-', '_tmp/bar.mm', '_tmp/car.mm']
