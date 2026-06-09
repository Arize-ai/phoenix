## oils_failures_allowed: 0
## oils_cpp_failures_allowed: 7
## compare_shells: bash

# NB: This is only for NON-interactive tests of bind. 
# See spec/stateful/bind.py for the remaining tests.

#### bind -l should report readline functions
## SKIP (unimplementable): bind readline builtin not implemented


#### bind -p -P to print function names and key bindings

# silly workaround for spec test format - change # comment to %
bind -p | grep vi-subst | sed 's/^#/%/'
echo

bind -P | grep vi-subst

## STDOUT:
% vi-subst (not bound)

vi-subst is not bound to any keys
## END

#### bind -s -S accepted

# TODO: add non-trivial tests here

bind -s
bind -S

## STDOUT:
## END

#### bind -v -V accepted

bind -v | grep blink-matching-paren
echo

# transform silly quote so we don't mess up syntax highlighting
bind -V | grep blink-matching-paren | sed "s/\`/'/g"

## STDOUT:
set blink-matching-paren off

blink-matching-paren is set to 'off'
## END

#### bind -q

bind -q zz-bad
echo status=$?

# bash prints message to stdout

bind -q vi-subst
echo status=$?

bind -q yank
echo status=$?

## STDOUT:
status=1
vi-subst is not bound to any keys.
status=1
yank can be invoked via "\C-y".
status=0
## END


#### bind -X
bind -X | grep -oF '\C-o\C-s\C-h'
echo status=$?

bind -x '"\C-o\C-s\C-h": echo foo'
bind -X | grep -oF '\C-o\C-s\C-h'
bind -X | grep -oF 'echo foo'
echo status=$?

## STDOUT:
status=1
\C-o\C-s\C-h
echo foo
status=0
## END


#### bind -m with bind -x/-X
bind -X | grep -oF 'emacs|vi'
echo status=$?

bind -m emacs -x '"\C-o\C-s\C-h": echo emacs'
bind -m emacs -X | grep -oF 'emacs'
echo status=$?

bind -m vi -x '"\C-o\C-s\C-h": echo vi'
bind -m vi -X | grep -oF 'vi'
echo status=$?

## STDOUT:
status=1
emacs
status=0
vi
status=0
## END


#### bind -r 
bind -q yank | grep -oF '\C-o\C-s\C-h'
echo status=$?

bind '"\C-o\C-s\C-h": yank'
bind -q yank | grep -oF '\C-o\C-s\C-h'
echo status=$?

bind -r "\C-o\C-s\C-h"
bind -q yank | grep -oF '\C-o\C-s\C-h'
echo status=$?

## STDOUT:
status=1
\C-o\C-s\C-h
status=0
status=1
## END


#### bind -r of bind -x commands
bind -X | grep -oF '\C-o\C-s\C-h'
echo status=$?

bind -x '"\C-o\C-s\C-h": echo foo'
bind -X | grep -oF '\C-o\C-s\C-h'
echo status=$?

bind -r "\C-o\C-s\C-h"
bind -X | grep -oF '\C-o\C-s\C-h'
echo status=$?

## STDOUT:
status=1
\C-o\C-s\C-h
status=0
status=1
## END
