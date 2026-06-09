## oils_failures_allowed: 0
## compare_shells: ash dash bash mksh zsh
#
# Here we list tests where different shells disagree with each other. For example we
# encountered some cases where osh and bash agree, but ash doesnt. For alpine / abuild
# this can cause build failures. So even if we don't directly plan on fixing them (ever)
# it can still be useful to keep track of these cases. This is also what separates these
# cases from the cases in the divergence spec tests (we plan on fixing those).
# The packages where these disagreements were encountered are mentioned after the dash

#### `set` output format - ifupdown-ng
export FOO=bar
set | grep bar | head -n 1
## STDOUT:
FOO=bar
## END
## OK ash/dash STDOUT:
FOO='bar'
## END
## OK zsh STDOUT:
## END

#### nested function declaration - xcb-util-renderutil
f() g() { echo 'hi'; }
## STDOUT:
## status: 2
## OK ash/dash/mksh/zsh status: 0

