{ x = $1
  for (i = 1; i <= 3; i++)
	if (getline)
		x = x " " $1
  print x
  x = ""
}
END {
  if (x != "") print x
}
