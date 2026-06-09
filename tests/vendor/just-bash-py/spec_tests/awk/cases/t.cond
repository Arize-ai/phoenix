{ print (substr($2,1,1) > substr($2,2,1)) ? $1 : $2 }
{ x = substr($1, 1, 1); y = substr($1, 2, 1); z = substr($1, 3, 1)
  print (x > y ? (x > z ? x : z) : y > z ? y : z) }
