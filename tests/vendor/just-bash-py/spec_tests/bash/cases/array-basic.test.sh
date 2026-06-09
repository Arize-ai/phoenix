## compare_shells: bash mksh zsh

# Common between bash/zsh

#### "${a[@]}" and "${a[*]}"
a=(1 '2 3')
argv.py "${a[@]}" "${a[*]}"
## stdout: ['1', '2 3', '1 2 3']

#### ${a[@]} and ${a[*]}
a=(1 '2 3')
argv.py ${a[@]} ${a[*]}
## STDOUT:
['1', '2', '3', '1', '2', '3']
## END
## BUG zsh STDOUT:
['1', '2 3', '1', '2 3']
## END

#### 4 ways to interpolate empty array
argv.py 1 "${a[@]}" 2 ${a[@]} 3 "${a[*]}" 4 ${a[*]} 5
## STDOUT:
['1', '2', '3', '', '4', '5']
## END

## BUG zsh STDOUT:
['1', '', '2', '3', '', '4', '5']
## END

#### empty array
empty=()
argv.py "${empty[@]}"
## STDOUT:
[]
## END

#### Empty array with :-
empty=()
argv.py ${empty[@]:-not one} "${empty[@]:-not one}"
## STDOUT:
['not', 'one', 'not one']
## END
## BUG zsh STDOUT:
['not one', 'not one']
## END
