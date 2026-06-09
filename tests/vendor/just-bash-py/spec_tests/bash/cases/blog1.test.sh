## compare_shells: dash bash mksh zsh

# Tests for the blog.
#
# Fun game: try to come up with an expression that behaves differently on ALL
# FOUR shells.

#### ${##}
set -- $(seq 25)
echo ${##}
## stdout: 2

#### ${###}
set -- $(seq 25)
echo ${###}
## stdout: 25
## N-I osh stdout-json: ""
## N-I osh status: 2

#### ${####}
set -- $(seq 25)
echo ${####}
## stdout: 25
## N-I osh stdout-json: ""
## N-I osh status: 2

#### ${##2}
set -- $(seq 25)
echo ${##2}
## stdout: 5
## N-I osh stdout-json: ""
## N-I osh status: 2

#### ${###2}
set -- $(seq 25)
echo ${###2}
## stdout: 5
## BUG mksh stdout: 25
## N-I osh stdout-json: ""
## N-I osh status: 2

#### ${1####}
set -- '####'
echo ${1####}
## stdout: ##

#### ${1#'###'}
set -- '####'
echo ${1#'###'}
## stdout: #

#### ${#1#'###'}
set -- '####'
echo ${#1#'###'}
# dash and zsh accept; mksh/bash/osh don't.
## status: 2
## stdout-json: ""
## OK dash/zsh status: 0
## OK dash stdout: 4
## OK zsh stdout: 1
## N-I bash/mksh status: 1

#### Julia example from spec/oil-user-feedback

case $SH in dash|mksh|zsh) exit ;; esac

git-branch-merged() {
  cat <<EOF
  foo
* bar
  baz
  master
EOF
}

shopt -s lastpipe  # required for bash, not OSH

branches=()  # dangerous when set -e is on
git-branch-merged | while read -r line; do
  line=${line# *}  # strip leading spaces
  if [[ $line != 'master' && ! ${line:0:1} == '*' ]]; then
    branches+=("$line")
  fi
done

if [[ ${#branches[@]} -eq 0 ]]; then
  echo "No merged branches"
else
  echo git branch -D "${branches[@]}"
fi

## STDOUT:
git branch -D foo baz
## END
## N-I dash/mksh/zsh STDOUT:
## END
