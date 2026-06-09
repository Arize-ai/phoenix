length($1) == 0 { next }

{gsub("[" $1 "]","(&)"); print}
{gsub("[" $1 "]","(\\&)"); print}
