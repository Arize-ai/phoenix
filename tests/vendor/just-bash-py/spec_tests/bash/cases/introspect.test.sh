## compare_shells: bash

# Test call stack introspection.  There are a bunch of special variables
# defined here:
#
# https://www.gnu.org/software/bash/manual/html_node/Bash-Variables.html
# 
# - The shell function ${FUNCNAME[$i]} is defined in the file
#   ${BASH_SOURCE[$i]} and called from ${BASH_SOURCE[$i+1]}
#
# - ${BASH_LINENO[$i]} is the line number in the source file
#   (${BASH_SOURCE[$i+1]}) where ${FUNCNAME[$i]} was called (or
#   ${BASH_LINENO[$i-1]} if referenced within another shell function). 
#
# - For instance, ${FUNCNAME[$i]} was called from the file
#   ${BASH_SOURCE[$i+1]} at line number ${BASH_LINENO[$i]}. The caller builtin
#   displays the current call stack using this information. 
#
# So ${BASH_SOURCE[@]} doesn't line up with ${BASH_LINENO}.  But
# ${BASH_SOURCE[0]} does line up with $LINENO!
#
# Geez.
#
# In other words, BASH_SOURCE is about the DEFINITION.  While FUNCNAME and
# BASH_LINENO are about the CALL.


#### ${FUNCNAME[@]} array
g() {
  argv.py "${FUNCNAME[@]}"
}
f() {
  argv.py "${FUNCNAME[@]}"
  g
  argv.py "${FUNCNAME[@]}"
}
f
## STDOUT: 
['f']
['g', 'f']
['f']
## END

#### FUNCNAME with source (scalar or array)
## SKIP (unimplementable): Requires external test data files from Oils project
cd $REPO_ROOT

# Comments on bash quirk:
# https://github.com/oilshell/oil/pull/656#issuecomment-599162211

f() {
  . spec/testdata/echo-funcname.sh
}
g() {
  f
}

g
echo -----

. spec/testdata/echo-funcname.sh
echo -----

argv.py "${FUNCNAME[@]}"

# Show bash inconsistency.  FUNCNAME doesn't behave like a normal array.
case $SH in 
  (bash)
    echo -----
    a=('A')
    argv.py '  @' "${a[@]}"
    argv.py '  0' "${a[0]}"
    argv.py '${}' "${a}"
    argv.py '  $' "$a"
    ;;
esac

## STDOUT:
['  @', 'source', 'f', 'g']
['  0', 'source']
['${}', 'source']
['  $', 'source']
-----
['  @', 'source']
['  0', 'source']
['${}', 'source']
['  $', 'source']
-----
[]
## END
## BUG bash STDOUT:
['  @', 'source', 'f', 'g']
['  0', 'source']
['${}', 'source']
['  $', 'source']
-----
['  @']
['  0', '']
['${}', '']
['  $', '']
-----
[]
-----
['  @', 'A']
['  0', 'A']
['${}', 'A']
['  $', 'A']
## END


#### BASH_SOURCE and BASH_LINENO scalar or array (e.g. for virtualenv)


#### ${FUNCNAME} with prefix/suffix operators

check() {
  argv.py "${#FUNCNAME}"
  argv.py "${FUNCNAME::1}"
  argv.py "${FUNCNAME:1}"
}
check
## STDOUT:
['5']
['c']
['heck']
## END

#### operators on FUNCNAME
check() {
  argv.py "${FUNCNAME}"
  argv.py "${#FUNCNAME}"
  argv.py "${FUNCNAME::1}"
  argv.py "${FUNCNAME:1}"
}
check
## status: 0
## STDOUT:
['check']
['5']
['c']
['heck']
## END

#### ${FUNCNAME} and "set -u" (OSH regression)
set -u
argv.py "$FUNCNAME"
## status: 1
## stdout-json: ""

#### $((BASH_LINENO)) (scalar form in arith)
check() {
  echo $((BASH_LINENO))
}
check
## stdout: 4

#### ${BASH_SOURCE[@]} with source and function name
## SKIP (unimplementable): Requires external test data files from Oils project
cd $REPO_ROOT

argv.py "${BASH_SOURCE[@]}"
source spec/testdata/bash-source-simple.sh
f
## STDOUT: 
[]
['spec/testdata/bash-source-simple.sh']
['spec/testdata/bash-source-simple.sh']
## END

#### ${BASH_SOURCE[@]} with line numbers

#### ${BASH_LINENO[@]} is a stack of line numbers for function calls
# note: it's CALLS, not DEFINITIONS.
g() {
  argv.py G "${BASH_LINENO[@]}"
}
f() {
  argv.py 'begin F' "${BASH_LINENO[@]}"
  g  # line 7
  argv.py 'end F' "${BASH_LINENO[@]}"
}
argv.py ${BASH_LINENO[@]}
f  # line 11
## STDOUT:
[]
['begin F', '11']
['G', '7', '11']
['end F', '11']
## END

#### Locations with temp frame
## SKIP (unimplementable): Requires external test data files from Oils project

cd $REPO_ROOT

$SH spec/testdata/bash-source-pushtemp.sh

## STDOUT:
F
G
STACK:spec/testdata/bash-source-pushtemp.sh:g:3
STACK:spec/testdata/bash-source-pushtemp.sh:f:19
STACK:spec/testdata/bash-source-pushtemp.sh:main:0
## END

#### Locations when sourcing
## SKIP (unimplementable): Interactive shell invocation not implemented

cd $REPO_ROOT

# like above test case, but we source

# bash location doesn't make sense:
# - It says 'source' happens at line 1 of bash-source-pushtemp.  Well I think
# - It really happens at line 2 of '-c' !    I guess that's to line up
#   with the 'main' frame

$SH -c 'true;
source spec/testdata/bash-source-pushtemp.sh'

## STDOUT:
F
G
STACK:spec/testdata/bash-source-pushtemp.sh:g:3
STACK:spec/testdata/bash-source-pushtemp.sh:f:19
STACK:spec/testdata/bash-source-pushtemp.sh:source:2
## END

#### Sourcing inside function grows the debug stack
