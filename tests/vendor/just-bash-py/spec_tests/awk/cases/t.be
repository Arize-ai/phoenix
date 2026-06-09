# some question of what FILENAME ought to be before execution.
# current belief:  "-", or name of first file argument.
# this may not be sensible.

BEGIN { print FILENAME }
END { print NR }
