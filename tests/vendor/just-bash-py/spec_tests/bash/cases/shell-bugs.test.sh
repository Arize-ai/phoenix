## compare_shells: bash dash mksh zsh ash
## oils_failures_allowed: 0
## suite: disabled

# NOTE: disabled this file because the spec-cpp docker image doesn't have
# 'time', so 'if command time' fails!
# I'm just running it locally.

# bugs we ran into in ./configure
#
# - old version of dash: doesn't unset _do_fork=0
# - old version of bash on OS X: background job and if command time -f
#
# other bug I ran into:
# - weird shopt -s lastpipe issue on bash

#### ./configure idiom
set -o errexit

if command time -f '%e %M' true; then
  echo 'supports -f'
  # BUG: this was wrong
  #time -f '%e %M' true

  # Need 'command time'
  command time -f '%e %M' true
fi

if env time -f '%e %M' true; then
  echo 'env'
  env time -f '%e %M' true
fi
## STDOUT:
supports -f
env
## END
