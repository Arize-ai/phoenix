## compare_shells: zsh-5.9
## our_shell: -

# Differences from bash:
# - literal syntax alternates key-value
# - (@k) syntax for keys.  Although this is sort of like my ${@array} syntax
# for arrays.
# - zsh allows $a[$k], not just ${a[$k]}


#### TODO: SETUP should be shared
typeset -A a
a=(aa b foo bar a+1 c)

#### retrieve key
typeset -A a
a=(aa b foo bar a+1 c)
echo ${a[aa]}
## stdout: b

#### set key
typeset -A a
a=(aa b foo bar a+1 c)
a[X]=XX
argv.py "${a[@]}"
# What order is this?
## stdout: ['bar', 'b', 'c', 'XX']

#### iterate over keys
typeset -A assoc
assoc=(k1 v1 k2 v2 k3 v3)
for k in "${(@k)assoc}"; do
  echo "$k: $assoc[$k]"
done
## STDOUT:
k1: v1
k2: v2
k3: v3
## END

#### iterate over both keys and values
typeset -A assoc
assoc=(k1 v1 k2 v2 k3 v3)
for k v ("${(@kv)assoc}"); do
  echo "$k: $v"
done
## STDOUT:
k1: v1
k2: v2
k3: v3
## END

#### get length
typeset -A assoc
assoc=(k1 v1 k2 v2 k3 v3)
echo ${#assoc} ${#assoc[k1]}
## stdout: 3 2

#### index by integer does not work
typeset -A assoc
assoc=(k1 v1 k2 v2 k3 v3)
argv.py "${assoc[1]}"
## stdout: ['']
